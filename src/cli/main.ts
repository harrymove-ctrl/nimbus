// `nimbus <command>`: Nimbus from a terminal, through the same HTTP API the web app uses (docs/CLI.md).
import { spawn } from "node:child_process";
import { accessSync, chmodSync, constants, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import type { AnyRunEvent } from "../lib/events";
import { TIERS } from "../lib/models";
import { buildView, fmtCost, TIER_SHORT } from "../lib/run-view";
import { ApiError, api, createWorkstream, findWorkstream, follow, listWorkstreams, snapshot, type ActiveRow, type Budget } from "./api";
import { REPO_ROOT, baseUrl, loadEnv, runLink } from "./env";
import { Timeline, c, mainArtifact, short, waitingOn } from "./format";
import { parseYaml, toYaml } from "./yaml";

const HELP = `nimbus: your Nimbus crew from a terminal (talks to NIMBUS_URL, default http://localhost:3000)

  nimbus init                          ask for the keys, write .env.local, run the smoke check
  nimbus doctor                        check models, Sandboxes, Telegram, data and the day cap
  nimbus run <workstream> [goal]       start a run and follow it; answer approvals and questions here
         --yes                         approve the plan, every approval and the first option of each question
  nimbus status [--json]               what is running and what waits for you
  nimbus approve [runId] [approvalId]  approve the latest waiting plan or action (--always: and from now on)
  nimbus reject [runId] [approvalId] "note"
  nimbus answer [runId] "text"         answer the open question (a number picks that option)
  nimbus ws list                       the workstreams
  nimbus ws create --title T --goal G --tools web_search,write_artifact [--schedule "weekdays 08:00"]
  nimbus ws export <workstream> [file] one workstream as YAML (stdout without a file)
  nimbus ws import <file>              create a workstream from YAML
  nimbus mcp                           the MCP server on stdio, for Claude Code, Cursor, OpenClaw, Hermes
  nimbus mcp install claude|cursor|openclaw [--write]

Config: NIMBUS_URL and NIMBUS_API_TOKEN from the environment or .env.local. Docs: docs/CLI.md`;

type Flags = Record<string, string | true>;
const BOOL = new Set(["yes", "write", "always", "json", "help", "no-smoke"]);
function parseArgs(argv: string[]) {
  const pos: string[] = [];
  const flags: Flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h") flags.help = true;
    else if (a === "-y") flags.yes = true;
    else if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      const name = eq > 0 ? a.slice(2, eq) : a.slice(2);
      if (eq > 0) flags[name] = a.slice(eq + 1);
      else if (BOOL.has(name) || i + 1 >= argv.length) flags[name] = true;
      else flags[name] = argv[++i];
    } else pos.push(a);
  }
  return { pos, flags };
}
const str = (v: string | true | string[] | undefined) => (typeof v === "string" ? v : Array.isArray(v) ? v.join(", ") : undefined);

class UsageError extends Error {}

/* ---------------- terminal input ---------------- */

/** Lines from stdin, asked one at a time. Lines typed (or piped) before a prompt wait their turn; null at end of input. */
class Input {
  private lines: string[] = [];
  private waiter: ((l: string | null) => void) | null = null;
  private closed = false;
  private rl = createInterface({ input: process.stdin, terminal: false });
  constructor() {
    this.rl.on("line", (l) => (this.waiter ? (this.waiter(l), (this.waiter = null)) : this.lines.push(l)));
    this.rl.on("close", () => {
      this.closed = true;
      this.waiter?.(null);
      this.waiter = null;
    });
  }
  /** piped answers are echoed after the prompt so a log reads like the session; `echo: false` for secrets */
  ask(prompt: string, echo = true): Promise<string | null> {
    process.stdout.write(prompt);
    const show = (l: string | null) => {
      if (l !== null && !process.stdin.isTTY) process.stdout.write(echo ? `${l}\n` : "\n");
      return l;
    };
    if (this.lines.length) return Promise.resolve(show(this.lines.shift()!));
    if (this.closed) return Promise.resolve(null);
    return new Promise((r) => (this.waiter = (l) => r(show(l))));
  }
  close() {
    this.rl.close();
  }
}

/** a TTY prompt that echoes nothing for a secret: raw mode, one key at a time */
function askTty(prompt: string, secret: boolean): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    let buf = "";
    const onData = (d: Buffer) => {
      for (const ch of d.toString("utf8")) {
        if (ch === "\u0003") {
          stdin.setRawMode(false);
          process.stdout.write("\n");
          process.exit(130);
        } else if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write(secret && buf ? c.dim("(hidden)\n") : "\n");
          resolve(buf.trim());
          return;
        } else if (ch === "\u007f" || ch === "\b") {
          if (buf) {
            buf = buf.slice(0, -1);
            if (!secret) process.stdout.write("\b \b");
          }
        } else if (ch >= " ") {
          buf += ch;
          if (!secret) process.stdout.write(ch);
        }
      }
    };
    stdin.on("data", onData);
  });
}

/* ---------------- run: follow the timeline, answer the gates ---------------- */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function decide(runId: string, approvalId: string, decision: "approve" | "approve_always" | "reject", note?: string) {
  try {
    await api(`/api/runs/${runId}/approvals/${approvalId}`, { body: { decision, note } });
    return true;
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      console.log(c.dim(`  ${approvalId} was already decided elsewhere`));
      return false;
    }
    throw e;
  }
}

async function postAnswer(runId: string, questionId: string, text: string) {
  try {
    await api(`/api/runs/${runId}/messages`, { body: { text, kind: "answer", questionId } });
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) console.log(c.dim("  that question was already answered"));
    else throw e;
  }
}

/** Prints the run as it happens and asks at each gate. Resolves with the process exit code. */
async function followRun(runId: string, o: { yes: boolean }): Promise<number> {
  const tl = new Timeline();
  const received: AnyRunEvent[] = [];
  const queue: AnyRunEvent[] = [];
  let wake: (() => void) | null = null;
  let streamDone = false;
  let streamErr: unknown = null;
  const ac = new AbortController();
  void follow(runId, { signal: ac.signal, onEvent: (e) => (received.push(e), queue.push(e), wake?.()) }).then(
    () => ((streamDone = true), wake?.()),
    (err) => ((streamErr = err), (streamDone = true), wake?.()),
  );
  const input = o.yes ? null : new Input();
  /** a gate is still open once the events that arrived meanwhile are in (a policy may approve it the same instant) */
  const stillOpen = async (test: (v: ReturnType<typeof buildView>) => boolean) => (await sleep(250), test(buildView(received)));
  let endedAt = 0;
  let leftWaiting = false;

  loop: for (;;) {
    if (!queue.length) {
      if (streamDone) break;
      const left = endedAt ? 8000 - (Date.now() - endedAt) : Infinity; // after run.end, a few seconds for the learner's summary
      if (left <= 0) break;
      await new Promise<void>((r) => {
        wake = r;
        if (left !== Infinity) setTimeout(r, left);
      });
      wake = null;
      continue;
    }
    const e = queue.shift()!;
    tl.push(e);
    const line = tl.line(e);
    if (line) console.log(line);
    if (e.type === "run.end") endedAt = Date.now();

    if (e.type === "plan" && e.payload.awaiting && (await stillOpen((v) => v.planAwaiting))) {
      e.payload.steps?.forEach((s, i) => console.log(`         ${i + 1}. ${s.text} ${c.dim(`(${TIER_SHORT[s.tier]})`)}`));
      let ok = true;
      if (input) {
        const a = await input.ask(c.bold("  approve the plan? [Y/n] "));
        if (a === null) {
          leftWaiting = true;
          break loop;
        }
        ok = !/^n/i.test(a.trim());
      } else console.log(c.dim("  plan approved (--yes)"));
      if (ok) await api(`/api/runs/${runId}/plan`, { body: { approve: true } }).catch((err) => console.log(c.dim(`  ${err instanceof Error ? err.message : err}`)));
      else {
        await api(`/api/runs/${runId}/stop`, { body: { reason: "cancel" } });
        console.log("  plan declined: run cancelled");
      }
    }

    if (e.type === "approval.request" && (await stillOpen((v) => v.pendingApprovals.some((a) => a.approvalId === e.payload.approvalId)))) {
      const d = e.payload.action.details;
      if (d !== undefined && d !== null) console.log(c.dim(`         ${short(d, 160)}`));
      if (!input) {
        console.log(c.dim("  approved (--yes)"));
        await decide(runId, e.payload.approvalId, "approve");
      } else
        for (;;) {
          const a = await input.ask(c.bold("  [a]pprove, approve a[l]ways, [r]eject? "));
          if (a === null) {
            leftWaiting = true;
            break loop;
          }
          const k = a.trim().toLowerCase();
          if (/^(a|y|yes|approve)$/.test(k)) await decide(runId, e.payload.approvalId, "approve");
          else if (/^(l|always)$/.test(k)) await decide(runId, e.payload.approvalId, "approve_always");
          else if (/^(r|n|no|reject)$/.test(k)) {
            const note = await input.ask("  note for the crew (why not): ");
            await decide(runId, e.payload.approvalId, "reject", note?.trim() || undefined);
          } else continue;
          break;
        }
    }

    if (e.type === "question" && (await stillOpen((v) => v.openQuestion?.questionId === e.payload.questionId))) {
      const opts = e.payload.options ?? [];
      opts.forEach((op, i) => console.log(`         ${i + 1}) ${op}`));
      let text = opts[0] ?? "continue";
      if (input)
        for (;;) {
          const a = await input.ask(c.bold(`  answer${opts.length ? ` (1-${opts.length} or text)` : ""}: `));
          if (a === null) {
            leftWaiting = true;
            break loop;
          }
          const t = a.trim();
          if (!t) continue;
          text = /^\d+$/.test(t) && opts[Number(t) - 1] ? opts[Number(t) - 1] : t;
          break;
        }
      else console.log(c.dim(`  answered "${text}" (--yes)`));
      await postAnswer(runId, e.payload.questionId, text);
    }
  }
  ac.abort();
  input?.close();
  if (streamErr) throw streamErr;

  const v = buildView(received);
  if (leftWaiting) {
    const w = waitingOn(v);
    console.log(`\n${c.yellow("left waiting for you")}${w ? `: ${w.kind} ${w.id}` : ""}. Decide later with \`nimbus approve ${runId}\`, \`nimbus reject ${runId} "note"\` or \`nimbus answer ${runId} "text"\`, or in the web app:\n${runLink(runId)}`);
    return 2;
  }
  const status = v.status;
  console.log(`\n${(status === "done" ? c.green : c.red)(`── ${status}`)} · ${fmtCost(v.costUsd)} · ${v.tokens.toLocaleString("en-US")} tokens · ${(v.lastTMs / 1000).toFixed(1)}s · ${v.lanes.length} agents`);
  const art = mainArtifact(v);
  if (art) {
    const lines = art.latest.content.split("\n").filter((l) => l.trim());
    console.log(c.bold(`\n${art.latest.title} (v${art.latest.version})`));
    for (const l of lines.slice(0, 8)) console.log(`  ${l}`);
    if (lines.length > 8) console.log(c.dim(`  … ${lines.length - 8} more lines`));
  }
  console.log(`\n${runLink(runId)}`);
  return status === "done" ? 0 : 1;
}

async function cmdRun(pos: string[], flags: Flags) {
  const [q, ...goalWords] = pos;
  if (!q) throw new UsageError("nimbus run <workstream> [goal]");
  const ws = await findWorkstream(q);
  const goal = str(flags.goal) ?? (goalWords.join(" ").trim() || undefined);
  let runId: string;
  try {
    ({ runId } = await api<{ runId: string }>("/api/runs", { body: { workstreamId: ws.id, goal, review: true, mode: str(flags.mode), tier: str(flags.tier) } }));
  } catch (e) {
    if (e instanceof ApiError && e.status === 429) throw new Error(`the day cap is reached: ${(e.body as { message?: string })?.message ?? e.message}`);
    throw e;
  }
  console.log(`${c.bold(`Nimbus · ${ws.title}`)}\n  goal: ${goal ?? ws.goal}\n  run:  ${runId} · ${runLink(runId)}\n`);
  return followRun(runId, { yes: flags.yes === true });
}

/* ---------------- status, approve, reject, answer ---------------- */

const ago = (ms: number) => (ms < 60_000 ? `${Math.round(ms / 1000)}s` : ms < 3_600_000 ? `${Math.round(ms / 60_000)}m` : ms < 86_400_000 ? `${Math.round(ms / 3_600_000)}h` : `${Math.round(ms / 86_400_000)}d`);

async function cmdStatus(flags: Flags) {
  const [{ runs }, budget, recent] = await Promise.all([api<{ runs: ActiveRow[] }>("/api/runs/active"), api<Budget>("/api/budget"), api<{ runs: { id: string; status: string; trigger: string; startedAt: number; costUsd: number }[] }>("/api/runs")]);
  if (flags.json) return void console.log(JSON.stringify({ active: runs, recent: recent.runs, budget }, null, 2));
  if (!runs.length) console.log("Nothing running.");
  for (const r of runs) {
    const wait = r.planAwaiting || r.approval || r.question;
    console.log(`${wait ? c.yellow("●") : c.green("●")} ${c.bold(r.title)}  ${r.id}  ${r.status}${r.step ? ` · step ${r.step.index}/${r.step.total}` : ""} · ${ago(r.elapsedMs)}`);
    console.log(`    ${r.activity}${r.approval ? ` (${r.approval.approvalId}, ${r.approval.risk} risk)` : ""}`);
    if (r.planAwaiting || r.approval) console.log(c.dim(`    nimbus approve ${r.id}${r.approval ? ` ${r.approval.approvalId}` : ""}   ·   nimbus reject ${r.id} "why"`));
    if (r.question) console.log(c.dim(`    nimbus answer ${r.id} "your answer"`));
  }
  const done = recent.runs.filter((r) => !runs.some((a) => a.id === r.id)).slice(0, 5);
  if (done.length) {
    console.log(c.dim("\nrecent"));
    for (const r of done) console.log(`  ${r.id}  ${r.status.padEnd(9)} ${fmtCost(r.costUsd ?? 0).padStart(6)}  ${r.trigger.padEnd(6)} ${ago(Date.now() - r.startedAt)} ago`);
  }
  console.log(`\ntoday ${fmtCost(budget.todayUsd)} of the ${fmtCost(budget.dayCapUsd)} day cap${budget.refusing ? c.red(" · refusing new runs") : ""}${budget.mock ? c.dim(" · mock models") : ""}`);
}

type Target = { runId: string; kind: "plan" | "approval" | "question"; id: string; text: string };
const RUN_ID = /^run_[\w-]+$/;

/** the run and gate a decision is for: named, or the newest run that waits for you */
async function findGate(runId: string | undefined, gateId: string | undefined, want: "decision" | "question"): Promise<Target> {
  if (!runId) {
    const { runs } = await api<{ runs: ActiveRow[] }>("/api/runs/active");
    const r = runs.filter((x) => (want === "question" ? x.question : x.planAwaiting || x.approval)).sort((a, b) => b.startedAt - a.startedAt)[0];
    if (!r) throw new Error(want === "question" ? "no run is asking you a question" : "nothing waits for your approval");
    runId = r.id;
  }
  const v = buildView((await snapshot(runId)).events);
  if (want === "question") {
    const q = v.openQuestion;
    if (!q || (gateId && q.questionId !== gateId)) throw new Error(`${runId} has no open question${gateId ? ` ${gateId}` : ""}`);
    return { runId, kind: "question", id: q.questionId, text: q.text };
  }
  if (gateId === "plan" || (!gateId && v.planAwaiting)) {
    if (!v.planAwaiting) throw new Error(`${runId} has no plan waiting`);
    return { runId, kind: "plan", id: "plan", text: "the plan" };
  }
  const ap = gateId ? v.pendingApprovals.find((a) => a.approvalId === gateId) : v.pendingApprovals[v.pendingApprovals.length - 1];
  if (!ap) throw new Error(`${runId} has no pending approval${gateId ? ` ${gateId}` : ""}`);
  return { runId, kind: "approval", id: ap.approvalId, text: ap.action.summary };
}

async function cmdApprove(pos: string[], flags: Flags) {
  const [runId, gateId] = pos;
  const t = await findGate(runId, gateId, "decision");
  if (t.kind === "plan") await api(`/api/runs/${t.runId}/plan`, { body: { approve: true } });
  else await api(`/api/runs/${t.runId}/approvals/${t.id}`, { body: { decision: flags.always ? "approve_always" : "approve" } });
  console.log(`${c.green("approved")} ${t.id}${flags.always ? " (always)" : ""}: ${t.text} · ${t.runId}`);
}

async function cmdReject(pos: string[], flags: Flags) {
  // reject [runId] [approvalId] "note": ids look like run_… and ap-N, so the note is whatever is left
  const runId = pos.find((p) => RUN_ID.test(p));
  const gateId = pos.find((p) => /^ap-\d+$/.test(p) || p === "plan");
  const note = str(flags.note) ?? pos.filter((p) => p !== runId && p !== gateId).join(" ").trim();
  const t = await findGate(runId, gateId, "decision");
  if (t.kind === "plan") await api(`/api/runs/${t.runId}/stop`, { body: { reason: "cancel" } });
  else await api(`/api/runs/${t.runId}/approvals/${t.id}`, { body: { decision: "reject", note: note || undefined } });
  console.log(`${c.red("rejected")} ${t.id}: ${t.text}${t.kind === "plan" ? " (run cancelled)" : ""}${note ? ` · note: ${note}` : ""} · ${t.runId}`);
}

async function cmdAnswer(pos: string[]) {
  const runId = pos.find((p) => RUN_ID.test(p));
  const qid = pos.find((p) => /^q-\d+$/.test(p));
  const text = pos.filter((p) => p !== runId && p !== qid).join(" ").trim();
  if (!text) throw new UsageError('nimbus answer [runId] "text"');
  const t = await findGate(runId, qid, "question");
  const v = buildView((await snapshot(t.runId)).events);
  const opts = v.openQuestion?.options ?? [];
  const answer = /^\d+$/.test(text) && opts[Number(text) - 1] ? opts[Number(text) - 1] : text;
  await postAnswer(t.runId, t.id, answer);
  console.log(`answered ${t.id} "${answer}": ${t.text} · ${t.runId}`);
}

/* ---------------- ws ---------------- */

const SCHED_LABEL = /^(Daily|Weekdays|Mondays) (\d{2}:\d{2})$/;

async function cmdWs(pos: string[], flags: Flags) {
  const [sub, ...rest] = pos;
  if (sub === "list" || !sub) {
    const all = await listWorkstreams();
    if (flags.json) return void console.log(JSON.stringify(all.map((w) => ({ ...w, skill: undefined })), null, 2));
    console.log(c.dim(`${"id".padEnd(26)} ${"title".padEnd(30)} ${"schedule".padEnd(16)} tools`));
    for (const w of all) console.log(`${w.id.padEnd(26)} ${short(w.title, 30).padEnd(30)} ${(w.scheduleLabel ?? "manual").padEnd(16)} ${w.tools.join(", ")}${w.archived ? c.dim(" (archived)") : ""}`);
    return;
  }
  if (sub === "create") {
    if (rest[0] && !str(flags.title)) return cmdWs(["import", rest[0]], flags);
    const title = str(flags.title);
    const goal = str(flags.goal);
    const tools = (str(flags.tools) ?? "").split(",").map((t) => t.trim()).filter(Boolean);
    if (!title || !goal || !tools.length) throw new UsageError('nimbus ws create --title "Inbox zero" --goal "…" --tools web_search,write_artifact [--schedule "weekdays 08:00"]');
    const w = await createWorkstream({ title, goal, tools, schedule: str(flags.schedule) });
    return void console.log(`created ${w.id} · ${w.title}${w.scheduleLabel ? ` · ${w.scheduleLabel}` : ""} · tools ${w.tools.join(", ")}`);
  }
  if (sub === "export") {
    if (!rest[0]) throw new UsageError("nimbus ws export <workstream> [file]");
    const w = await findWorkstream(rest[0]);
    const m = SCHED_LABEL.exec(w.scheduleLabel ?? "");
    const yaml = toYaml(
      { title: w.title, goal: w.goal, schedule: m ? `${m[1].toLowerCase()} ${m[2]}` : (w.scheduleCron ?? undefined), schedule_label: !m && w.scheduleCron ? w.scheduleLabel : undefined, tools: w.tools },
      `Nimbus workstream "${w.title}" (${w.id}). Import it with: nimbus ws import <this file>`,
    );
    if (rest[1]) {
      writeFileSync(rest[1], yaml);
      console.log(`wrote ${rest[1]}`);
    } else process.stdout.write(yaml);
    return;
  }
  if (sub === "import") {
    const file = rest[0];
    if (!file) throw new UsageError("nimbus ws import <file>   (- reads stdin)");
    const y = parseYaml(file === "-" ? readFileSync(0, "utf8") : readFileSync(file, "utf8"));
    const title = str(y.title);
    const goal = str(y.goal);
    const tools = Array.isArray(y.tools) ? y.tools : (str(y.tools) ?? "").split(",").map((t) => t.trim()).filter(Boolean);
    if (!title || !goal || !tools.length) throw new Error(`${file}: needs title, goal and tools`);
    const w = await createWorkstream({ title, goal, tools, schedule: str(y.schedule), scheduleLabel: str(y.schedule_label) });
    return void console.log(`imported ${w.id} · ${w.title}${w.scheduleLabel ? ` · ${w.scheduleLabel}` : ""} · tools ${w.tools.join(", ")}`);
  }
  throw new UsageError("nimbus ws list|create|export|import");
}

/* ---------------- doctor ---------------- */

type Row = { ok: boolean | null; name: string; detail: string };
const redact = (s: string) => {
  for (const k of ["NEBIUS_API_KEY", "NIMBUS_TELEGRAM_BOT_TOKEN", "NIMBUS_API_TOKEN", "TAVILY_API_KEY"]) {
    const v = process.env[k];
    if (v && v.length > 3) s = s.split(v).join("***");
  }
  return s;
};
const errText = (e: unknown) => redact(e instanceof Error ? (e.cause instanceof Error ? `${e.message}: ${e.cause.message}` : e.message) : String(e));

async function getJson(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: res.status, body, text };
}

async function cmdDoctor(flags: Flags) {
  const rows: Row[] = [];
  const add = (ok: boolean | null, name: string, detail: string) => rows.push({ ok, name, detail: redact(detail) });
  const url = baseUrl();
  const local = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(url);

  let budget: Budget | null = null;
  try {
    budget = await api<Budget>("/api/budget", { timeoutMs: 15_000 });
    add(true, "Nimbus", `${url} answers · ${budget.mock ? "scripted mock models" : "real Nemotron models"}`);
  } catch (e) {
    add(false, "Nimbus", errText(e));
  }

  const key = process.env.NEBIUS_API_KEY;
  const tfBase = (process.env.NEBIUS_BASE_URL || "https://api.tokenfactory.nebius.com/v1").replace(/\/+$/, "");
  if (!key) add(false, "Token Factory models", "NEBIUS_API_KEY is not set here (nimbus init). Without it runs use the scripted mock");
  else
    try {
      const r = await getJson(`${tfBase}/models`, { Authorization: `Bearer ${key}` });
      const ids = new Set(((r.body as { data?: { id: string }[] })?.data ?? []).map((m) => m.id.toLowerCase()));
      const missing = Object.entries(TIERS).filter(([, id]) => !ids.has(id.toLowerCase())).map(([t]) => t);
      if (r.status !== 200) add(false, "Token Factory models", `${tfBase}/models answered ${r.status}${r.status === 401 ? " (the key is not accepted)" : ""}`);
      else add(!missing.length, "Token Factory models", missing.length ? `the key works, but ${missing.join(", ")} is not in the catalog` : `the key works · Ultra, Super and Nano listed (${ids.size} models)`);
    } catch (e) {
      add(false, "Token Factory models", errText(e));
    }

  const project = process.env.NEBIUS_PROJECT_ID;
  const sbBase = (process.env.NEBIUS_SANDBOX_BASE_URL || "https://api.tokenfactory.nebius.com/sandboxes/v1").replace(/\/+$/, "");
  if (!project || !key) {
    add(null, "Sandboxes whoami", `${!key ? "NEBIUS_API_KEY" : "NEBIUS_PROJECT_ID"} not set: run_code runs on the server, not in Nebius Sandboxes`);
    add(null, "Sandbox images", "skipped");
  } else {
    const h = { Authorization: `Bearer ${key}`, Project: project };
    try {
      const r = await getJson(`${sbBase}/whoami`, h);
      const b = r.body as { permissions?: Record<string, boolean>; limits?: Record<string, number> } | null;
      const perms = Object.entries(b?.permissions ?? {}).filter(([, v]) => v).length;
      const limits = Object.entries(b?.limits ?? {}).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(", ");
      add(r.status === 200, "Sandboxes whoami", r.status === 200 ? `the key and project are accepted · ${perms} permissions${limits ? ` · ${limits}` : ""}` : `answered ${r.status}`);
    } catch (e) {
      add(false, "Sandboxes whoami", errText(e));
    }
    try {
      const want = { python: process.env.NIMBUS_SANDBOX_IMAGE_PYTHON || "python:3.12-slim", node: process.env.NIMBUS_SANDBOX_IMAGE_NODE || "node:20-slim" };
      const found: string[] = [];
      const missing: string[] = [];
      for (const [lang, img] of Object.entries(want)) {
        const r = await getJson(`${sbBase}/images?tag=${encodeURIComponent(lang)}&limit=20`, h);
        const tags = ((r.body as { images?: { tag: string | null }[] })?.images ?? []).map((i) => i.tag);
        (tags.includes(img) ? found : missing).push(img);
      }
      add(!missing.length, "Sandbox images", missing.length ? `${missing.join(", ")} not in the catalog yet (the first run imports it from the registry)${found.length ? ` · found ${found.join(", ")}` : ""}` : `${found.join(" and ")} ready`);
    } catch (e) {
      add(false, "Sandbox images", errText(e));
    }
  }

  const bot = process.env.NIMBUS_TELEGRAM_BOT_TOKEN;
  if (!bot) add(null, "Telegram", "NIMBUS_TELEGRAM_BOT_TOKEN not set (optional)");
  else
    try {
      const tgBase = (process.env.NIMBUS_TELEGRAM_API_BASE || "https://api.telegram.org").replace(/\/+$/, "");
      const r = await getJson(`${tgBase}/bot${bot}/getMe`);
      const me = (r.body as { ok?: boolean; result?: { username?: string } })?.result;
      add(r.status === 200 && !!me, "Telegram", me ? `getMe: @${me.username}${process.env.NIMBUS_TELEGRAM_CHAT_ID ? " · chat id set" : " · NIMBUS_TELEGRAM_CHAT_ID not set, nothing is sent"}` : `getMe answered ${r.status} (the token is not accepted)`);
    } catch (e) {
      add(false, "Telegram", errText(e));
    }

  if (local) {
    const dir = path.resolve(process.env.NIMBUS_DATA_DIR || "./data");
    try {
      if (existsSync(dir)) accessSync(dir, constants.W_OK);
      else accessSync(path.dirname(dir), constants.W_OK);
      const ws = budget ? (await listWorkstreams()).length : 0;
      add(true, "Data", `${dir} ${existsSync(dir) ? "is writable" : "will be created"}${budget ? ` · ${ws} workstreams` : ""}`);
    } catch (e) {
      add(false, "Data", `${dir}: ${errText(e)}`);
    }
  } else if (budget)
    try {
      const ws = await listWorkstreams();
      add(true, "Data", `on the server · ${ws.length} workstreams, ${ws.filter((w) => w.skill).length} with a SKILL.md`);
    } catch (e) {
      add(false, "Data", errText(e));
    }
  else add(false, "Data", "the server did not answer");

  if (budget) add(!budget.refusing, "Day cap", `today ${fmtCost(budget.todayUsd)} of ${fmtCost(budget.dayCapUsd)} · run cap ${fmtCost(budget.runCapUsd)}${budget.refusing ? " · refusing new runs until tomorrow" : ""}`);
  else add(false, "Day cap", "the server did not answer");

  if (flags.json) console.log(JSON.stringify(rows, null, 2));
  else for (const r of rows) console.log(`${r.ok === true ? c.green("✓") : r.ok === false ? c.red("✗") : c.dim("·")} ${r.name.padEnd(22)} ${r.ok === null ? c.dim(r.detail) : r.detail}`);
  return rows.some((r) => r.ok === false) ? 1 : 0;
}

/* ---------------- init ---------------- */

const INIT_KEYS: { key: string; label: string; secret: boolean; optional: boolean }[] = [
  { key: "NEBIUS_API_KEY", label: "Nebius Token Factory API key (tokenfactory.nebius.com)", secret: true, optional: false },
  { key: "NEBIUS_PROJECT_ID", label: "Token Factory project id, for Sandboxes (project/api-keys page)", secret: false, optional: true },
  { key: "TAVILY_API_KEY", label: "Tavily API key, for the Researcher's web search", secret: true, optional: true },
  { key: "NIMBUS_TELEGRAM_BOT_TOKEN", label: "Telegram bot token, from @BotFather", secret: true, optional: true },
  { key: "NIMBUS_TELEGRAM_CHAT_ID", label: "Telegram chat id that receives the messages", secret: false, optional: true },
];

/** set KEY=value in .env text: replace the line when the key is there, append it otherwise */
function setEnvLine(text: string, key: string, value: string) {
  const re = new RegExp(`^\\s*${key}\\s*=.*$`, "m");
  const line = `${key}=${value}`;
  return re.test(text) ? text.replace(re, line) : `${text.replace(/\n*$/, "\n")}${line}\n`;
}

async function cmdInit(flags: Flags) {
  const file = path.resolve(".env.local");
  const had = existsSync(file);
  const example = path.join(REPO_ROOT, ".env.example");
  let text = had ? readFileSync(file, "utf8") : existsSync(example) ? readFileSync(example, "utf8") : "";
  const current = (k: string) => /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*(?:#.*)?$/m.exec(text.split("\n").find((l) => new RegExp(`^\\s*${k}\\s*=`).test(l)) ?? "")?.[2].replace(/^["']|["']$/g, "") ?? "";
  console.log(`${c.bold("nimbus init")}: writes ${file}${had ? " (keeps what you skip)" : ""}. Values are never shown.\n`);
  const tty = !!process.stdin.isTTY;
  const input = tty ? null : new Input();
  let changed = 0;
  for (const k of INIT_KEYS) {
    const has = !!current(k.key);
    const hint = has ? c.dim(" [set, enter keeps it]") : k.optional ? c.dim(" [optional, enter skips]") : "";
    const prompt = `${k.label}${hint}\n  ${k.key}: `;
    const v = tty ? await askTty(prompt, k.secret) : ((await input!.ask(prompt, !k.secret)) ?? "").trim();
    if (!tty && v && k.secret) process.stdout.write(c.dim("  (hidden)\n"));
    if (v) {
      text = setEnvLine(text, k.key, v);
      changed++;
    }
  }
  input?.close();
  writeFileSync(file, text);
  try {
    chmodSync(file, 0o600);
  } catch {
    /* not a POSIX file system */
  }
  console.log(`\n${changed ? `saved ${changed} value${changed === 1 ? "" : "s"} to` : "nothing changed in"} ${file}`);
  if (flags["no-smoke"]) return 0;
  if (!current("NEBIUS_API_KEY")) {
    console.log("no NEBIUS_API_KEY yet, so no smoke check: runs use the scripted mock models until you add one");
    return 0;
  }
  console.log(c.dim("\nsmoke check: one call per Nemotron tier and one tool call (well under $0.01)\n"));
  const code = await new Promise<number>((resolve) => {
    const p = spawn(process.execPath, ["--env-file-if-exists=.env.local", "--import", "tsx", path.join(REPO_ROOT, "scripts/smoke.mts")], { stdio: "inherit", cwd: process.cwd() });
    p.on("exit", (n) => resolve(n ?? 1));
  });
  if (code === 0) console.log(`\nnext: ${c.bold("pnpm dev")}, then ${c.bold("nimbus doctor")}`);
  return code;
}

/* ---------------- mcp install ---------------- */

function cmdMcpInstall(client: string | undefined, flags: Flags) {
  const bin = path.join(REPO_ROOT, "bin/nimbus.mjs");
  const tokenRef = client === "cursor" ? "${env:NIMBUS_API_TOKEN}" : "${NIMBUS_API_TOKEN:-}";
  const server = { command: "node", args: [bin, "mcp"], env: { NIMBUS_URL: baseUrl(), NIMBUS_API_TOKEN: tokenRef } };
  if (client === "claude") {
    const snippet = { mcpServers: { nimbus: { type: "stdio", ...server } } };
    if (flags.write) {
      const file = path.resolve(".mcp.json");
      const cur = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as { mcpServers?: Record<string, unknown> }) : {};
      cur.mcpServers = { ...(cur.mcpServers ?? {}), nimbus: snippet.mcpServers.nimbus };
      writeFileSync(file, `${JSON.stringify(cur, null, 2)}\n`);
      console.log(`wrote the nimbus server into ${file}. Restart Claude Code in this folder and approve the server.`);
      return;
    }
    console.log(`# Claude Code: .mcp.json in your project (or run with --write to add it here)\n${JSON.stringify(snippet, null, 2)}\n\n# or, from the shell:\nclaude mcp add nimbus --env NIMBUS_URL=${baseUrl()} -- node ${bin} mcp`);
    return;
  }
  if (client === "cursor") {
    console.log(`# Cursor: .cursor/mcp.json in your project, or ~/.cursor/mcp.json for every project\n${JSON.stringify({ mcpServers: { nimbus: server } }, null, 2)}`);
    return;
  }
  if (client === "openclaw") {
    console.log(`# OpenClaw (and Hermes): add this stdio server to the MCP servers in your agent's config\n${JSON.stringify({ mcpServers: { nimbus: { ...server, env: { NIMBUS_URL: baseUrl() } } } }, null, 2)}\n\n# OpenClaw can also talk to Nimbus with no MCP at all: /v1/chat/completions (docs/openclaw.md)`);
    return;
  }
  throw new UsageError("nimbus mcp install claude|cursor|openclaw [--write]");
}

/* ---------------- main ---------------- */

async function main(): Promise<number> {
  loadEnv();
  const [cmd, ...argv] = process.argv.slice(2);
  const { pos, flags } = parseArgs(argv);
  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h" || flags.help) return console.log(HELP), 0;
  switch (cmd) {
    case "init":
      return cmdInit(flags);
    case "doctor":
      return cmdDoctor(flags);
    case "run":
      return cmdRun(pos, flags);
    case "status":
      return cmdStatus(flags).then(() => 0);
    case "approve":
      return cmdApprove(pos, flags).then(() => 0);
    case "reject":
      return cmdReject(pos, flags).then(() => 0);
    case "answer":
      return cmdAnswer(pos).then(() => 0);
    case "ws":
      return cmdWs(pos, flags).then(() => 0);
    case "mcp":
      if (pos[0] === "install") return cmdMcpInstall(pos[1], flags), 0;
      await (await import("./mcp")).serve();
      return -1; // keeps serving until the client closes stdin
    default:
      throw new UsageError(`unknown command "${cmd}"\n\n${HELP}`);
  }
}

main().then(
  (code) => {
    if (code >= 0) process.exit(code);
  },
  (e) => {
    console.error(`nimbus: ${e instanceof UsageError ? `usage: ${e.message}` : e instanceof Error ? e.message : String(e)}`);
    process.exit(e instanceof UsageError ? 2 : 1);
  },
);
