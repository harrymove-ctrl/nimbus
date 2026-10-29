// Crews per workstream and the templates gallery (docs/TEMPLATES.md, docs/ROADMAP.md rows 7.1 and 7.2) in mock mode ($0):
// an old database gets the default crew, every template starts through the API and through `nimbus ws import`, a
// Study coach run has Tutor, Quizmaster and Checker lanes, a crew nobody scripted still runs, the default workstreams keep
// their five lanes and their exact role prompts, and `ws export` then `import` carries the crew and the SKILL.md.
//   pnpm check:templates      (--verbose prints the terminal run)
process.env.NIMBUS_DATA_DIR = "./data/check-templates";
process.env.NIMBUS_MODEL = "mock";
process.env.NIMBUS_MOCK_FAST = "1";
process.env.NIMBUS_CACHE = "off";
process.env.NIMBUS_SCHEDULER = "off";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { createClient } from "@libsql/client";
import { dataDir } from "../src/db";
import type { AnyRunEvent } from "../src/lib/events";
import { DEFAULT_ROLES, type CrewRole } from "../src/lib/roles";
import { buildView, laneName, ROLE_COLOR, ROLE_LABEL } from "../src/lib/run-view";
import { listTemplates } from "../src/lib/templates";
import { WORKSTREAMS, type Workstream } from "../src/lib/workstreams";
import { roleSpec } from "../src/runtime/agent";
import { getRun, startRun } from "../src/runtime/source";

const T0 = Date.now();
rmSync(dataDir(), { recursive: true, force: true });
const checks: [string, boolean][] = [];
const check = (n: string, ok: boolean, detail = "") => (checks.push([n, ok]), console.log(`${ok ? "✓" : "✗"} ${n}${!ok && detail ? `\n    ${detail.slice(0, 1500).replace(/\n/g, "\n    ")}` : ""}`));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

console.log("— a database from before crews");
{
  // the workstreams table as the last release created it, with one row a person made
  mkdirSync(dataDir(), { recursive: true });
  const old = createClient({ url: `file:${path.join(dataDir(), "nimbus.db")}` });
  await old.execute("CREATE TABLE workstreams (id TEXT PRIMARY KEY, title TEXT NOT NULL, goal TEXT NOT NULL, schedule_cron TEXT, schedule_label TEXT, tools TEXT NOT NULL, unread INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0, schedule_edited INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)");
  await old.execute({ sql: "INSERT INTO workstreams (id, title, goal, tools, created_at) VALUES ('ws-u-old-0001', 'Old one', 'An old goal', ?, 1)", args: [JSON.stringify(["web_search"])] });
  old.close();
}

/* ---------- Nimbus over HTTP: the route handlers behind a node:http server (as in check-cli) ---------- */
const wsRoute = await import("../src/app/api/workstreams/route");
const wsIdRoute = await import("../src/app/api/workstreams/[id]/route");
const tplRoute = await import("../src/app/api/templates/route");
const runsRoute = await import("../src/app/api/runs/route");
const runIdRoute = await import("../src/app/api/runs/[id]/route");
const activeRoute = await import("../src/app/api/runs/active/route");
const eventsRoute = await import("../src/app/api/runs/[id]/events/route");
const planRoute = await import("../src/app/api/runs/[id]/plan/route");
const approvalRoute = await import("../src/app/api/runs/[id]/approvals/[aid]/route");
const messagesRoute = await import("../src/app/api/runs/[id]/messages/route");
const budgetRoute = await import("../src/app/api/budget/route");
type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response> | Response;
const ROUTES: [string, RegExp, Handler][] = [
  ["GET", /^\/api\/workstreams$/, wsRoute.GET as Handler],
  ["POST", /^\/api\/workstreams$/, wsRoute.POST as Handler],
  ["PATCH", /^\/api\/workstreams\/(?<id>[^/]+)$/, wsIdRoute.PATCH as Handler],
  ["DELETE", /^\/api\/workstreams\/(?<id>[^/]+)$/, wsIdRoute.DELETE as Handler],
  ["GET", /^\/api\/templates$/, tplRoute.GET as Handler],
  ["GET", /^\/api\/runs$/, runsRoute.GET as Handler],
  ["POST", /^\/api\/runs$/, runsRoute.POST as Handler],
  ["GET", /^\/api\/runs\/active$/, activeRoute.GET as Handler],
  ["GET", /^\/api\/runs\/(?<id>[^/]+)$/, runIdRoute.GET as Handler],
  ["GET", /^\/api\/runs\/(?<id>[^/]+)\/events$/, eventsRoute.GET as Handler],
  ["POST", /^\/api\/runs\/(?<id>[^/]+)\/plan$/, planRoute.POST as Handler],
  ["POST", /^\/api\/runs\/(?<id>[^/]+)\/approvals\/(?<aid>[^/]+)$/, approvalRoute.POST as Handler],
  ["POST", /^\/api\/runs\/(?<id>[^/]+)\/messages$/, messagesRoute.POST as Handler],
  ["GET", /^\/api\/budget$/, budgetRoute.GET as Handler],
];
async function serve(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const route = ROUTES.map(([m, re, h]) => ({ m, h, match: re.exec(url.pathname) })).find((r) => r.m === req.method && r.match);
  if (!route) return void res.writeHead(404).end("no route");
  const chunks: Buffer[] = [];
  for await (const ch of req) chunks.push(ch as Buffer);
  const ac = new AbortController();
  res.on("close", () => ac.abort());
  const r = await route.h(new Request(url, { method: req.method, headers: req.headers as Record<string, string>, body: chunks.length ? Buffer.concat(chunks) : undefined, signal: ac.signal }), { params: Promise.resolve({ ...(route.match!.groups ?? {}) }) });
  res.writeHead(r.status, Object.fromEntries(r.headers));
  if (!r.body) return void res.end();
  const reader = r.body.getReader();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      res.write(value);
    }
  } catch {
    /* the client went away */
  }
  res.end();
}
const nimbus = createServer((req, res) => void serve(req, res).catch((e) => (res.headersSent ? res.end() : res.writeHead(500).end(String(e)))));
await new Promise<void>((r) => nimbus.listen(0, "127.0.0.1", r));
const URL_ = `http://127.0.0.1:${(nimbus.address() as AddressInfo).port}`;
const http = async <T,>(p: string, init?: { method?: string; body?: unknown }) => {
  const r = await fetch(`${URL_}${p}`, { method: init?.method ?? (init?.body ? "POST" : "GET"), headers: { "content-type": "application/json" }, body: init?.body ? JSON.stringify(init.body) : undefined });
  return { status: r.status, json: (await r.json().catch(() => ({}))) as T };
};
const listWs = async () => (await http<{ workstreams: Workstream[] }>("/api/workstreams")).json.workstreams;

const BIN = path.resolve("bin/nimbus.mjs");
const childEnv: NodeJS.ProcessEnv = { ...process.env, NIMBUS_URL: URL_, NIMBUS_ENV_FILE: "none", NO_COLOR: "1" };
type Out = { code: number; out: string };
function cli(args: string[], answers: [RegExp, string][] = [], timeoutMs = 45_000): Promise<Out> {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [BIN, ...args], { env: childEnv, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    const answered = new Map<number, number>();
    p.stdout.on("data", (d: Buffer) => {
      out += d.toString();
      answers.forEach(([re, line], i) => {
        const seen = out.match(new RegExp(re.source, "g"))?.length ?? 0;
        if (seen > (answered.get(i) ?? 0)) {
          answered.set(i, seen);
          p.stdin.write(`${line}\n`);
        }
      });
    });
    p.stderr.on("data", (d: Buffer) => (out += d.toString()));
    if (!answers.length) p.stdin.end();
    const kill = setTimeout(() => p.kill("SIGKILL"), timeoutMs);
    p.on("exit", (code) => (clearTimeout(kill), resolve({ code: code ?? -1, out })));
  });
}

{
  const all = await listWs();
  const oldRow = all.find((w) => w.id === "ws-u-old-0001");
  check("the old row and every seeded workstream read back with the default five roles", !!oldRow && same(oldRow.roles, DEFAULT_ROLES) && WORKSTREAMS.every((s) => same(all.find((w) => w.id === s.id)?.roles, DEFAULT_ROLES)), JSON.stringify(oldRow));
}

console.log("— role prompts and lanes");
{
  // today's prompts, verbatim from before crews: the default crew must rebuild them byte for byte (goldens and the cache)
  const BEFORE: Record<string, string> = {
    researcher: "You are the Researcher. Use web_search and fetch_url, cite sources, and return a short sourced report. Ask the person with ask_user only if the brief is ambiguous.",
    analyst: "You are the Analyst. Use run_code on the attached data to compute exact numbers, fix your own script errors, save useful code with write_artifact, and report the numbers.",
    writer: "You are the Writer. Produce the document with write_artifact: the number first, then cause, evidence, open questions and next step. Edit by writing a new version of the same artifactId. When the brief asks you to send something, call send_message once per message, to its address; send_message asks for approval itself. Say only what your sources and the crew's reports say, using the latest of them. Never leave a placeholder in brackets such as [Your Name] or [Date]. End each reply after its closing line, with no signature.",
    checker: "You are the Checker. Validate data and fact-check claims quickly; report what is supported and any caveat.",
    learner: "You are the Learner. From the run summary, call save_learning once with at most 8 durable memories and the rewritten SKILL.md (keep its structure).",
  };
  const TOOLS_BEFORE: Record<string, string[]> = { researcher: ["web_search", "fetch_url", "read_repo", "ask_user"], analyst: ["run_code", "read_repo", "write_artifact", "ask_user"], checker: ["run_code", "fetch_url", "read_repo"], writer: ["write_artifact", "read_repo", "send_message", "open_pr"], learner: ["save_learning"] };
  const ctx = { roles: DEFAULT_ROLES };
  const bad = Object.keys(BEFORE).filter((r) => { const s = roleSpec(ctx, r); return s.system !== BEFORE[r] || !same(s.tools, TOOLS_BEFORE[r]); });
  check("the default crew's system prompts and tool lists are exactly today's", !bad.length, bad.map((r) => `${r}: ${roleSpec(ctx, r).system}`).join("\n"));
  const tutor = roleSpec({ roles: listTemplates().find((t) => t.slug === "study-coach")!.roles }, "tutor");
  check("a role of its own: prompt from its brief, its tier and its tools", tutor.system.startsWith("You are the Tutor. Use run_code on flashcards.csv") && tutor.ceiling === "super" && same(tutor.tools, ["run_code", "write_artifact"]), JSON.stringify(tutor));
  check("lane names and colours fall back for any role (Quiz master, a colour of its own)", laneName("quiz-master-2", "quiz-master") === "Quiz master 2" && ROLE_LABEL.tutor === "Tutor" && /^oklch\(/.test(ROLE_COLOR.tutor) && ROLE_COLOR.tutor !== ROLE_COLOR.checker && Object.keys(ROLE_COLOR).length === 6, `${laneName("quiz-master-2", "quiz-master")} ${ROLE_COLOR.tutor}`);
}

console.log("— GET /api/templates");
const templates = listTemplates();
{
  const r = await http<{ templates: (CrewRole & { slug: string; title: string; goal: string; tools: string[]; roles: CrewRole[]; skill: string; attachments: string[]; scheduleLabel: string })[] }>("/api/templates");
  const t = r.json.templates ?? [];
  const slugs = t.map((x) => x.slug);
  check("nine templates, the three personal ones first", r.status === 200 && t.length === 9 && same(slugs.slice(0, 3), ["job-hunt-radar", "study-coach", "household-ops"]) && ["morning-brief", "hackathon-radar", "ship-nimbus", "cost-audit", "release-watch", "checkout-drop"].every((s) => slugs.includes(s)), slugs.join(", "));
  check("each has a title, a goal, tools, a crew, a SKILL.md seed with a Policy section and a schedule label", t.every((x) => x.title && x.goal && x.tools.length && x.roles.length && /^## Policy$/m.test(x.skill) && x.scheduleLabel), JSON.stringify(t.find((x) => !x.skill)));
  const seeded = t.filter((x) => WORKSTREAMS.some((w) => w.title === x.title));
  check("the six seeded templates match the seed (title, goal, tools, SKILL.md, the default crew)", seeded.length === 6 && seeded.every((x) => { const w = WORKSTREAMS.find((s) => s.title === x.title)!; return x.goal === w.goal && same(x.tools, w.tools) && x.skill === w.skill && same(x.roles, DEFAULT_ROLES); }), seeded.map((x) => x.slug).join());
  const crew = (s: string) => t.find((x) => x.slug === s)?.roles.map((r) => r.role).join();
  check("personal crews: scout, screener, writer · tutor, quizmaster, checker · planner, accountant, writer (each with the learner)", crew("job-hunt-radar") === "scout,screener,writer,learner" && crew("study-coach") === "tutor,quizmaster,checker,learner" && crew("household-ops") === "planner,accountant,writer,learner", `${crew("job-hunt-radar")} · ${crew("study-coach")} · ${crew("household-ops")}`);
  check("the sample files are named: flashcards.csv, review-log.csv, bills.csv, calendar.txt", same(t.find((x) => x.slug === "study-coach")?.attachments, ["flashcards.csv", "review-log.csv"]) && same(t.find((x) => x.slug === "household-ops")?.attachments, ["bills.csv", "calendar.txt"]));
}

console.log("— every template through POST /api/workstreams { template } and through nimbus ws import");
const made: Record<string, string> = {};
{
  const bad: string[] = [];
  for (const t of templates) {
    const r = await http<{ id?: string; roles?: CrewRole[]; files?: string[]; error?: string }>("/api/workstreams", { body: { template: t.slug } });
    const w = (await listWs()).find((x) => x.id === r.json.id);
    const ok = r.status === 201 && !!w && w.id.startsWith(`ws-u-${t.slug}-`) && w.title === t.title && same(w.roles, t.roles) && w.skill === t.skill && same(w.files, t.attachments.map((a) => path.basename(a)).sort()) && same(w.tools, t.tools);
    if (!ok) bad.push(`${t.slug}: ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
    else made[t.slug] = w.id;
  }
  check("API: all nine create a workstream with the template's crew, SKILL.md, tools and files", !bad.length, bad.join("\n"));
  const fileOk = existsSync(path.join(dataDir(), "workstreams", made["study-coach"], "files", "flashcards.csv")) && readFileSync(path.join(dataDir(), "workstreams", made["study-coach"], "files", "flashcards.csv"), "utf8") === readFileSync("fixtures/templates/study-coach/flashcards.csv", "utf8");
  check("the attachments are copied into the workstream's files", fileOk);

  const cliBad: string[] = [];
  const outs = await Promise.all(templates.map((t) => cli(["ws", "import", `templates/${t.slug}.yaml`])));
  const all = await listWs();
  templates.forEach((t, i) => {
    const id = /imported (ws-u-[\w-]+)/.exec(outs[i].out)?.[1];
    const w = all.find((x) => x.id === id);
    if (outs[i].code !== 0 || !w || !same(w.roles, t.roles) || w.skill !== t.skill || !same(w.files, t.attachments.map((a) => path.basename(a)).sort())) cliBad.push(`${t.slug}: ${outs[i].out.trim().slice(0, 300)}`);
  });
  check("CLI: nimbus ws import templates/<slug>.yaml creates all nine the same way (crew, skill, files)", !cliBad.length, cliBad.join("\n"));
  const sc = outs[templates.findIndex((t) => t.slug === "study-coach")].out;
  check("the import line names the crew and the files", /crew tutor, quizmaster, checker, learner · files flashcards\.csv, review-log\.csv/.test(sc), sc);
}

console.log("— crews that the API refuses");
{
  const base = { title: "Bad crew", goal: "x", tools: ["web_search"] };
  const a = await http<{ error?: string }>("/api/workstreams", { body: { ...base, roles: [{ role: "orchestrator", brief: "lead", tier: "ultra" }] } });
  const b = await http<{ error?: string }>("/api/workstreams", { body: { ...base, roles: [{ role: "tutor", brief: "teach", tier: "mega" }] } });
  const c = await http<{ error?: string }>("/api/workstreams", { body: { template: "no-such-template" } });
  const d = await http<{ error?: string }>(`/api/workstreams/${made["study-coach"]}`, { method: "PATCH", body: { roles: [{ role: "a", brief: "x", tier: "nano" }, { role: "A", brief: "y", tier: "nano" }] } });
  check("orchestrator as a role, an unknown tier, an unknown template and duplicate names are refused with a reason", a.status === 400 && /orchestrator/.test(a.json.error ?? "") && b.status === 400 && /tier/.test(b.json.error ?? "") && c.status === 404 && d.status === 400 && /two roles/.test(d.json.error ?? ""), JSON.stringify([a.json, b.json, c.json, d.json]));
}

console.log("— a Study coach run from the terminal (nimbus run, plan approved with y)");
{
  const r = await cli(["run", made["study-coach"]], [[/approve the plan\? \[Y\/n\]/, "y"], [/\[a\]pprove, approve a\[l\]ways, \[r\]eject\?/, "a"], [/answer \(1-\d+ or text\):/, "1"]]);
  if (process.argv.includes("--verbose")) console.log(r.out.replace(/^/gm, "    | "));
  const runId = /run:\s+(run_\w+)/.exec(r.out)?.[1] ?? "";
  check("the terminal timeline names the lanes Tutor, Quizmaster and Checker; the run ends done", r.code === 0 && /Tutor\s+Super/.test(r.out) && /Quizmaster\s+Super/.test(r.out) && /Checker\s+Nano/.test(r.out) && /── done/.test(r.out), r.out.slice(-1500));
  // the server is this process: the run's handle holds every event the timeline drew
  const events = (getRun(runId)?.events ?? []) as AnyRunEvent[];
  const v = buildView(events);
  const lanes = v.lanes.map((l) => l.instance);
  check("lanes: orchestrator, tutor-1, quizmaster-1, checker-1 and learner-1, all done", same(lanes, ["orchestrator", "tutor-1", "quizmaster-1", "checker-1", "learner-1"]) && v.lanes.every((l) => l.status === "done") && v.status === "done", `${lanes.join()} ${v.status} ${v.lanes.map((l) => l.status).join()}`);
  const plan = events.find((e) => e.type === "plan");
  check("the plan carries the crew's own tiers (tutor Super, checker Nano)", plan?.type === "plan" && plan.payload.agents.find((a) => a.role === "tutor")?.tier === "super" && plan.payload.agents.find((a) => a.role === "checker")?.tier === "nano");
  const runCode = events.find((e) => e.type === "tool.result" && e.agent === "tutor" && e.payload.tool === "run_code");
  const stdout = runCode?.type === "tool.result" ? String((runCode.payload.output as { stdout?: string })?.stdout ?? "") : "";
  check("the Tutor's run_code read the attached flashcards.csv and review-log.csv (SM-2 ran)", /due per day: \{'Mon 02': 13/.test(stdout) && /wrote flashcards-updated\.csv: 24 cards/.test(stdout), stdout || JSON.stringify(runCode?.payload));
  check("artifacts: the updated deck, the quiz and the answer sheet", ["deck", "quiz", "quiz-answers"].every((a) => v.artifacts.some((x) => x.id === a)), v.artifacts.map((a) => a.id).join());
  const w = (await listWs()).find((x) => x.id === made["study-coach"]);
  check("the Learner rewrote the Study coach SKILL.md (rule 5 learned, Policy kept)", !!w && /5\. When one day carries more than half the week/.test(w.skill) && /^## Policy$/m.test(w.skill), w?.skill);
}

console.log("— a crew nobody scripted (Job hunt radar), and the default crew");
{
  const go = async (wsId: string, title: string, goal: string, tools: string[]) => {
    const run = startRun({ workstreamId: wsId, title, goal, trigger: "manual", tools });
    const act = (e: AnyRunEvent) => {
      if (e.type === "approval.request") run.resolveApproval(e.payload.approvalId, { decision: "approved" });
      if (e.type === "question") run.postMessage({ kind: "answer", text: e.payload.options?.[0] ?? "ok", questionId: e.payload.questionId });
    };
    for (const e of run.events) act(e);
    run.onEvent(act);
    await run.settled;
    return buildView(run.events as AnyRunEvent[]);
  };
  const jh = templates.find((t) => t.slug === "job-hunt-radar")!;
  const v1 = await go(made["job-hunt-radar"], jh.title, jh.goal, jh.tools);
  check("Job hunt radar runs with lanes scout, screener and writer, and ends done", v1.status === "done" && ["orchestrator", "scout-1", "screener-1", "writer-1", "learner-1"].every((l) => v1.lanes.some((x) => x.instance === l)) && !v1.lanes.some((l) => ["researcher", "analyst"].includes(l.role)), v1.lanes.map((l) => l.instance).join());
  const ck = WORKSTREAMS.find((w) => w.id === "ws-checkout")!;
  const v2 = await go(ck.id, ck.title, ck.goal, ck.tools);
  const roles = [...new Set(v2.lanes.map((l) => l.role))].filter((r) => r !== "orchestrator").sort();
  check("a default workstream (Checkout) still produces the five known lanes", v2.status === "done" && same(roles, ["analyst", "checker", "learner", "researcher", "writer"]), roles.join());
}

console.log("— ws export, then import: the crew and the SKILL.md travel");
{
  const crew = [
    { role: "tutor", brief: "Teach: one concept at a time, with an example.", tier: "super", tools: ["run_code", "write_artifact"] },
    { role: "quiz-master", brief: "Ask 5 questions: one per line, answers at the end.", tier: "nano" },
    { role: "learner", brief: "From the run summary, call save_learning once.", tier: "nano" },
  ];
  const p = await http<{ ok?: boolean; error?: string }>(`/api/workstreams/${made["household-ops"]}`, { method: "PATCH", body: { roles: crew } });
  const file = path.join(dataDir(), "household.yaml");
  const e = await cli(["ws", "export", made["household-ops"], file]);
  const yaml = existsSync(file) ? readFileSync(file, "utf8") : "";
  check("PATCH roles replaces the crew; export writes roles as a list of maps and the skill as a block", p.status === 200 && e.code === 0 && /^roles:\n {2}- role: tutor\n {4}tier: super\n {4}tools: \[run_code, write_artifact\]/m.test(yaml) && /^skill: \|\n {2}## Household ops/m.test(yaml), yaml);
  const i = await cli(["ws", "import", file]);
  const id = /imported (ws-u-[\w-]+)/.exec(i.out)?.[1];
  const all = await listWs();
  const src = all.find((w) => w.id === made["household-ops"]);
  const copy = all.find((w) => w.id === id);
  check("import of the export gives the same crew and the same SKILL.md", !!copy && same(copy.roles, src?.roles) && copy.skill === src?.skill && same(copy.roles?.map((r) => r.role), ["tutor", "quiz-master", "learner"]), `${i.out}\n${JSON.stringify(copy?.roles)}`);
}

nimbus.close();
const failed = checks.filter(([, ok]) => !ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed in ${((Date.now() - T0) / 1000).toFixed(1)} s`);
process.exit(failed.length ? 1 : 0);
