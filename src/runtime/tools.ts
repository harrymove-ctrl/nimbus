// Tool definitions (zod) and executors. Structure comes from tool calls, never response_format (SPEC §2).
// Tools are given to the model WITHOUT execute: agent.ts runs them itself so every call can emit events.
import { execFile, spawn } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { dataDir } from "@/db";
import type { AgentRole, BuiltinRole } from "@/lib/models";
import { modelMode } from "@/lib/tokenfactory";
import { sandboxEnabled, sandboxRun, type SandboxResult } from "./sandbox";
import type { RunCtx } from "./context";

/** The roles the Orchestrator may plan with: the workstream's crew minus the Learner, which runs after every finished run. */
export const DEFAULT_CREW = ["researcher", "analyst", "writer", "checker"];
const role = z.enum(DEFAULT_CREW as [string, ...string[]]);
const agentBrief = z.object({ role, brief: z.string() });

export const SCHEMAS = {
  web_search: z.object({ query: z.string() }),
  fetch_url: z.object({ url: z.string() }),
  run_code: z.object({ language: z.enum(["python", "node", "shell"]).optional(), filename: z.string().optional(), code: z.string() }),
  write_artifact: z.object({ artifactId: z.string(), kind: z.enum(["doc", "code"]), title: z.string(), language: z.string().optional(), content: z.string() }),
  send_message: z.object({ channel: z.string(), text: z.string() }),
  read_repo: z.object({ action: z.enum(["read", "list", "diff", "changed"]), path: z.string().optional(), ref: z.string().optional() }),
  open_pr: z.object({ branch: z.string(), title: z.string(), body: z.string(), patchArtifactId: z.string() }),
  ask_user: z.object({ text: z.string(), options: z.array(z.string()).optional() }),
  plan: z.object({ agents: z.array(agentBrief), tools: z.array(z.string()), steps: z.array(z.object({ text: z.string(), role })).optional(), estimate: z.object({ costUsd: z.number(), tokens: z.number(), label: z.string() }) }),
  spawn_agents: z.object({ agents: z.array(agentBrief) }),
  handoff: z.object({ to: role, context: z.string() }),
  request_approval: z.object({
    action: z.object({ kind: z.enum(["send_message", "write_file", "http_request", "run_code", "open_pr"]), summary: z.string(), risk: z.enum(["low", "medium", "high"]), details: z.unknown() }),
  }),
  finish: z.object({ summary: z.string() }),
  save_learning: z.object({ memories: z.array(z.string()), skill: z.string() }),
} as const;

export type ToolName = keyof typeof SCHEMAS;

/** plan, spawn_agents and handoff for a crew of its own: the same shapes with the workstream's role names. */
function crewSchemas(crew: string[]): Partial<Record<ToolName, z.ZodType>> {
  const r = z.enum(crew as [string, ...string[]]);
  const brief = z.object({ role: r, brief: z.string() });
  return {
    plan: SCHEMAS.plan.extend({ agents: z.array(brief), steps: z.array(z.object({ text: z.string(), role: r })).optional() }),
    spawn_agents: z.object({ agents: z.array(brief) }),
    handoff: z.object({ to: r, context: z.string() }),
  };
}

const DESCRIPTIONS: Record<ToolName, string> = {
  web_search: "Search the web (Tavily). Returns title, url and snippet for each result.",
  fetch_url: "Fetch a page and return its readable text (first 20k characters).",
  run_code: "Run a short Python or Node script in an isolated sandbox (a Nebius Token Factory Sandbox when configured, networking off) that already contains the attached data files (e.g. data.csv). Python 3 has pandas and numpy in the Nebius sandbox (the csv module always works); Node 20 has no npm packages. No network, no pip or npm install. 60 s timeout. language \"shell\" runs one allow-listed command in the repository: pnpm eval [--only <golden>] [--patch <artifact>], pnpm eval:ab, pnpm typecheck, git apply --check <artifact>, git diff.",
  write_artifact: "Create or update a document or code artifact. Calling it again with the same artifactId creates the next version.",
  send_message: "Send a message to a channel. Always needs the person's approval.",
  read_repo: "Read the repository, read-only: action read (a file), list (a directory), diff (git diff, optionally of one path or against a ref) or changed (files changed since HEAD). Never writes.",
  open_pr: "Open a pull request from a patch artifact: creates the branch, commits the patch and opens the PR. Always needs the person's approval.",
  ask_user: "Ask the person one short question when you cannot proceed. Offer options when you can.",
  plan: "Your first call: the agents and tools you will use, the steps in order (steps: each a sentence and the agent that does it) and a cost estimate. The person may edit the steps and approve; if the result says revise, plan again with their edits.",
  spawn_agents: "Run several agents concurrently and get their reports.",
  handoff: "Hand one piece of work to one agent and wait for its report.",
  request_approval: "Ask the person to approve a side-effecting action before it happens.",
  finish: "End the run with a one-paragraph summary.",
  save_learning: "Save up to 8 memories and the rewritten SKILL.md for this workstream.",
};

/** Control tools run inside the orchestrator and show as waits, not tool segments. */
export const CONTROL_TOOLS = new Set<ToolName>(["plan", "spawn_agents", "handoff", "request_approval", "ask_user", "finish"]);

export const ROLE_TOOLS: Record<BuiltinRole, ToolName[]> = {
  orchestrator: ["plan", "spawn_agents", "handoff", "request_approval", "ask_user", "finish"],
  researcher: ["web_search", "fetch_url", "read_repo", "ask_user"],
  analyst: ["run_code", "read_repo", "write_artifact", "ask_user"],
  checker: ["run_code", "fetch_url", "read_repo"],
  writer: ["write_artifact", "read_repo", "send_message", "open_pr"],
  learner: ["save_learning"],
};

/** The tools one agent gets: its role's tools the run allows, plus the control tools. `crew` names the roles plan, spawn_agents and handoff accept. */
export function toolSet(names: ToolName[], allowed: string[], crew: string[] = DEFAULT_CREW): ToolSet {
  const own = crew.join() === DEFAULT_CREW.join() || !crew.length ? {} : crewSchemas(crew);
  const set: ToolSet = {};
  for (const n of names) if (CONTROL_TOOLS.has(n) || n === "save_learning" || allowed.includes(n)) set[n] = tool({ description: DESCRIPTIONS[n], inputSchema: (own[n] ?? SCHEMAS[n]) as unknown as z.ZodType<unknown> });
  return set;
}

/** Short text for a tool segment label. */
export function toolLabel(name: string, input: Record<string, unknown>): string {
  const s = (v: unknown) => String(v ?? "").slice(0, 40);
  if (name === "web_search") return `web_search · ${s(input.query)}`;
  if (name === "fetch_url") return `fetch_url · ${s(String(input.url ?? "").replace(/^https?:\/\//, ""))}`;
  if (name === "run_code") return `run_code · ${input.language === "shell" ? String(input.code ?? "").slice(0, 48) : s(input.filename ?? "script")}`;
  if (name === "read_repo") return `read_repo · ${input.action}${input.path ? ` ${s(input.path)}` : ""}`;
  if (name === "open_pr") return `open_pr · ${s(input.branch)}`;
  if (name === "write_artifact") return `write_artifact · ${s(input.title)}`;
  if (name === "send_message") return `send_message · ${s(input.channel)}`;
  if (name === "save_learning") return "save_learning · SKILL.md";
  return name;
}

/* ---------------- executors ---------------- */

type SearchFixture = { match: string[]; results: { title: string; url: string; snippet: string }[] };
const fixturesDir = (...p: string[]) => path.join(process.cwd(), "fixtures", ...p);

export async function webSearch(query: string) {
  const useMock = modelMode() === "mock" || !process.env.TAVILY_API_KEY;
  if (!useMock) {
    const { tavily } = await import("@tavily/core");
    const r = await tavily({ apiKey: process.env.TAVILY_API_KEY! }).search(query, { maxResults: 5 });
    return { source: "tavily", results: r.results.map((x) => ({ title: x.title, url: x.url, snippet: x.content.slice(0, 280) })) };
  }
  const q = query.toLowerCase();
  const files = readdirSync(fixturesDir("search")).filter((f) => f.endsWith(".json") && f !== "pages.json");
  const all = files.map((f) => JSON.parse(readFileSync(fixturesDir("search", f), "utf8")) as SearchFixture);
  const hit = all.find((f) => f.match.length > 0 && f.match.every((k) => q.includes(k))) ?? all.find((f) => f.match.length === 0) ?? all[0];
  return { source: "fixture", results: hit.results };
}

export async function fetchUrl(url: string) {
  if (modelMode() === "mock" || !process.env.TAVILY_API_KEY) {
    const pages = JSON.parse(readFileSync(fixturesDir("search", "pages.json"), "utf8")) as Record<string, string>;
    return { url, text: pages[url] ?? `No fixture for ${url}.` };
  }
  const res = await fetch(url, { headers: { "user-agent": "NimbusBot/0.1" }, signal: AbortSignal.timeout(15_000) });
  const html = await res.text();
  const text = html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { url, text: text.slice(0, 20_000) };
}

export type RunCodeResult = { ok: boolean; exitCode: number | null; stdout: string; stderr: string; workspace: string; where: "nebius-sandbox" | "local"; sandbox?: SandboxResult["sandbox"]; sandboxError?: string };

/**
 * run_code. With Nebius Token Factory Sandboxes on (NEBIUS_PROJECT_ID set), a Python or Node script runs in a fresh
 * isolated VM at Nebius with networking off and the attached data files under /work; nothing model-written touches
 * this server. Otherwise, or if the sandbox call fails, it runs as a local subprocess: a per-run temp workspace,
 * stripped environment (no API keys), 30 s timeout, output capped. The result says which one happened (`where`).
 */
export async function runCode(ctx: RunCtx, i: { language?: "python" | "node" | "shell"; filename?: string; code: string }): Promise<RunCodeResult> {
  mkdirSync(ctx.workspace, { recursive: true });
  if (i.language === "shell") return { ...(await runShell(ctx, i.code)), where: "local" };
  // The model sometimes labels Python as node (or the reverse); the code itself is unambiguous, so trust it.
  const script = { language: sniffLanguage(i.language, i.code), filename: i.filename, code: i.code };
  if (script.language !== i.language) script.filename = i.filename?.replace(/\.(py|js|mjs)$/i, script.language === "python" ? ".py" : ".js");
  if (sandboxEnabled()) {
    const file = (script.filename ?? (script.language === "python" ? "script.py" : "script.js")).replace(/[^\w.-]/g, "_");
    // the run's attached files (copied into the workspace at run start, usage-7d.csv included), else the sample CSVs
    const names = ctx.attached?.length ? ctx.attached : readdirSync(fixturesDir()).filter((n) => n.endsWith(".csv"));
    const files = names.map((n) => ({ path: n, content: readFileSync(existsSync(path.join(ctx.workspace, n)) ? path.join(ctx.workspace, n) : fixturesDir(n)) }));
    try {
      const r = await sandboxRun({ language: script.language, file, code: i.code, files, timeoutS: 60 });
      return { ok: r.ok, exitCode: r.exitCode, stdout: r.stdout, stderr: r.timedOut ? `${r.stderr}\n[sandbox: timed out]`.trim() : r.stderr, workspace: "/work", where: "nebius-sandbox", sandbox: r.sandbox };
    } catch (e) {
      const sandboxError = e instanceof Error ? e.message : String(e);
      console.warn("[nimbus] sandbox unavailable, running locally:", sandboxError);
      return { ...(await runLocal(ctx, script)), sandboxError };
    }
  }
  return runLocal(ctx, script);
}

function sniffLanguage(declared: "python" | "node" | undefined, code: string): "python" | "node" {
  // The model sometimes omits the language (the schema allows it): decide from the code, Python when unsure.
  const py = /^\s*(import \w+(\s+as\s+\w+)?|from \w+ import|def \w+\(|print\()/m.test(code) && !/\b(const|let|var)\s+\w+\s*=|require\(|=>|console\./.test(code);
  const js = /\b(const|let|var)\s+\w+\s*=|require\(|=>|console\.|module\.exports/.test(code) && !/^\s*(def \w+\(|from \w+ import)/m.test(code);
  if (declared === "node" && py) return "python";
  if (declared === "python" && js) return "node";
  if (declared !== "python" && declared !== "node") return js && !py ? "node" : "python";
  return declared;
}

function runLocal(ctx: RunCtx, i: { language: "python" | "node"; filename?: string; code: string }): Promise<RunCodeResult> {
  // the workstream's attached data files (sample CSVs live in fixtures/)
  for (const f of readdirSync(fixturesDir()).filter((n) => n.endsWith(".csv"))) if (!existsSync(path.join(ctx.workspace, f))) copyFileSync(fixturesDir(f), path.join(ctx.workspace, f));
  const file = (i.filename ?? (i.language === "python" ? "script.py" : "script.js")).replace(/[^\w.-]/g, "_");
  writeFileSync(path.join(ctx.workspace, file), i.code);
  return new Promise((resolve) => {
    const child = spawn(i.language === "python" ? "python3" : process.execPath, [file], { cwd: ctx.workspace, env: { PATH: process.env.PATH ?? "", HOME: ctx.workspace, LANG: "en_US.UTF-8" } as unknown as NodeJS.ProcessEnv, timeout: 30_000 });
    let out = "", err = "";
    child.stdout.on("data", (d) => (out = (out + d).slice(0, 8000)));
    child.stderr.on("data", (d) => (err = (err + d).slice(-2000)));
    // macOS python3 shim noise (xcrun cache file) is not the script's error
    const clean = (e: string) => e.split("\n").filter((l) => !l.includes("xcrun_db")).join("\n").trim();
    child.on("error", (e) => resolve({ ok: false, exitCode: null, stdout: out, stderr: String(e), workspace: ctx.workspace, where: "local" }));
    child.on("close", (code) => resolve({ ok: code === 0, exitCode: code, stdout: out, stderr: clean(err), workspace: ctx.workspace, where: "local" }));
  });
}

export async function writeArtifact(ctx: RunCtx, who: { role: AgentRole; instance: string }, i: z.infer<typeof SCHEMAS.write_artifact>) {
  const version = (ctx.artifactVersions.get(i.artifactId) ?? 0) + 1;
  ctx.artifactVersions.set(i.artifactId, version);
  ctx.artifactContent.set(i.artifactId, i.content);
  // code artifacts are files in the run workspace, so a later run_code can `git apply --check` or `pnpm eval --patch` them
  mkdirSync(ctx.workspace, { recursive: true });
  writeFileSync(path.join(ctx.workspace, i.artifactId.replace(/[^\w.-]/g, "_")), i.content);
  await ctx.saveArtifact({ ...i, version });
  ctx.emit("artifact.version", who.role, who.instance, { artifactId: i.artifactId, kind: i.kind, title: i.title, version, content: i.content, language: i.language });
  return { artifactId: i.artifactId, version };
}

/** Logs instead of sending: the demo never leaves the machine. Dry run logs nothing. */
export function sendMessage(ctx: RunCtx, i: { channel: string; text: string }) {
  if (ctx.mode === "dry") return { sent: false, logged: false, note: "dry run: nothing was sent" };
  mkdirSync(dataDir(), { recursive: true });
  appendFileSync(path.join(dataDir(), "outbox.log"), `${new Date().toISOString()} ${ctx.runId} ${i.channel}: ${i.text}\n`);
  return { sent: false, logged: true, note: "demo mode: logged to data/outbox.log instead of sending" };
}


/* ---------------- shell commands in the repository (the Ship Nimbus crew's real work) ---------------- */

const SAFE_ARG = /^[\w@:=.,/~^+-]+$/;
const PNPM_OK = new Set(["eval", "eval:ab", "typecheck"]);
const GIT_OK = new Set(["diff", "status", "log", "apply"]);

/** One allow-listed command, no shell: pnpm eval|eval:ab|typecheck, git diff|status|log|apply --check. Real even in mock mode. */
function runShell(ctx: RunCtx, command: string): Promise<{ ok: boolean; exitCode: number | null; stdout: string; stderr: string; workspace: string }> {
  const fail = (stderr: string) => ({ ok: false, exitCode: 126, stdout: "", stderr, workspace: ctx.workspace });
  const [bin, sub, ...args] = command.trim().split(/\s+/);
  if (![bin, sub, ...args].every((a) => a && SAFE_ARG.test(a))) return Promise.resolve(fail("command refused: only plain words, no shell syntax"));
  const okCmd = (bin === "pnpm" && PNPM_OK.has(sub)) || (bin === "git" && GIT_OK.has(sub) && (sub !== "apply" || args.includes("--check")));
  if (!okCmd) return Promise.resolve(fail(`command refused: allowed are pnpm ${[...PNPM_OK].join("|")} and git ${[...GIT_OK].join("|")} (apply --check only)`));
  // an argument that names a file in the run workspace (an artifact) is passed as its absolute path
  const argv = args.map((a) => (existsSync(path.join(ctx.workspace, a)) && statSync(path.join(ctx.workspace, a)).isFile() ? path.join(ctx.workspace, a) : a));
  // stripped environment: no API keys, always the mock model, its own database so a nested run never locks the app's
  const env: Record<string, string> = { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? ctx.workspace, LANG: "en_US.UTF-8", NIMBUS_MODEL: "mock", NIMBUS_MOCK_FAST: "1", NIMBUS_SCHEDULER: "off", NIMBUS_EVAL_NO_REPORT: "1", NIMBUS_DATA_DIR: path.join(ctx.workspace, ".data"), CI: "1" };
  for (const [k, v] of Object.entries(process.env)) if (v && (k.startsWith("npm_config_") || k.startsWith("PNPM_") || k === "TMPDIR")) env[k] = v;
  return new Promise((resolve) => {
    execFile(bin, [sub, ...argv], { cwd: process.cwd(), env: env as unknown as NodeJS.ProcessEnv, timeout: 180_000, maxBuffer: 4_000_000 }, (err, stdout, stderr) => {
      const code = err ? ((err as { code?: number | string }).code ?? 1) : 0;
      const tail = (t: string) => (t.length > 6000 ? `…${t.slice(-6000)}` : t);
      // `pnpm eval` exits 1 when a golden fails: the tool worked and reported it; exit 2 (usage) or a crash is a failed call
      const evalFailed = bin === "pnpm" && sub.startsWith("eval") && code === 1 && /EVAL: (PASS|FAIL)/.test(stdout);
      resolve({ ok: !err || evalFailed, exitCode: typeof code === "number" ? code : 1, stdout: tail(stdout.trim()), stderr: tail(stderr.trim()), workspace: ctx.workspace });
    });
  });
}

/* ---------------- read_repo: read-only view of the repository ---------------- */

const DENY = [/^\.env/, /^data(\/|$)/, /^node_modules(\/|$)/, /^\.git(\/|$)/, /^\.next/, /^\.claude(\/|$)/];
const git = (args: string[]) =>
  new Promise<string>((resolve, reject) => execFile("git", args, { cwd: process.cwd(), timeout: 10_000, maxBuffer: 2_000_000 }, (e, out, err) => (e ? reject(new Error(err.trim() || e.message)) : resolve(out))));

export async function readRepo(i: { action: "read" | "list" | "diff" | "changed"; path?: string; ref?: string }) {
  const root = process.cwd();
  const rel = path.normalize(i.path ?? ".").replace(/^\/+/, "");
  const abs = path.resolve(root, rel);
  if (abs !== root && (!abs.startsWith(root + path.sep) || DENY.some((r) => r.test(path.relative(root, abs))))) return { ok: false, error: `${i.path} is outside what the crew may read` };
  const cap = (t: string) => (t.length > 20_000 ? `${t.slice(0, 20_000)}\n… (${t.length - 20_000} more characters)` : t);
  if (i.action === "read") {
    if (!existsSync(abs) || !statSync(abs).isFile()) return { ok: false, error: `no such file: ${rel}` };
    return { ok: true, path: rel, text: cap(readFileSync(abs, "utf8")) };
  }
  if (i.action === "list") {
    if (!existsSync(abs) || !statSync(abs).isDirectory()) return { ok: false, error: `no such directory: ${rel}` };
    const entries = readdirSync(abs, { withFileTypes: true }).filter((d) => !DENY.some((r) => r.test(path.relative(root, path.join(abs, d.name))))).map((d) => d.name + (d.isDirectory() ? "/" : ""));
    return { ok: true, path: rel, entries: entries.slice(0, 200) };
  }
  if (i.ref && !/^[\w./~^-]+$/.test(i.ref)) return { ok: false, error: "bad ref" };
  try {
    if (i.action === "changed") return { ok: true, status: (await git(["status", "--porcelain"])).trim().split("\n").filter(Boolean).slice(0, 100) };
    return { ok: true, diff: cap(await git(["diff", "--no-color", ...(i.ref ? [i.ref] : []), ...(i.path ? ["--", rel] : [])])) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/* ---------------- open_pr: approval-gated; mock mode logs the PR instead of opening it ---------------- */

const BRANCH = /^[\w.-]+\/[\w./-]+$/;
const run = (cmd: string, args: string[], cwd: string) =>
  new Promise<string>((resolve, reject) => execFile(cmd, args, { cwd, timeout: 120_000, maxBuffer: 4_000_000 }, (e, out, err) => (e ? reject(new Error(`${cmd} ${args[0]}: ${(err || e.message).trim().slice(-600)}`)) : resolve(out.trim()))));

export async function openPr(ctx: RunCtx, i: { branch: string; title: string; body: string; patchArtifactId: string }) {
  const patch = ctx.artifactContent.get(i.patchArtifactId);
  if (!BRANCH.test(i.branch) || /^(main|master)\//.test(i.branch)) return { opened: false, error: `branch name not allowed: ${i.branch}` };
  if (patch === undefined) return { opened: false, error: `no patch artifact named ${i.patchArtifactId}` };
  if (ctx.mode === "dry") return { opened: false, logged: false, note: "dry run: no branch, no PR" };
  if (modelMode() === "mock") {
    let h = 0;
    for (const c of i.branch) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const url = `https://github.com/harrymove-ctrl/nimbus/pull/${100 + (h % 900)}`;
    mkdirSync(dataDir(), { recursive: true });
    appendFileSync(path.join(dataDir(), "outbox.log"), `${new Date().toISOString()} ${ctx.runId} PR ${i.branch}: ${i.title}\n${i.body}\n---\n`);
    return { opened: false, logged: true, url, note: "demo mode: the PR body was logged to data/outbox.log; the URL is a placeholder" };
  }
  // Real: a throwaway git worktree, so the person's checkout is never switched or touched.
  const login = (await run("gh", ["api", "user", "--jq", ".login"], process.cwd()).catch(() => "")) || "";
  if (login !== "harrymove-ctrl") return { opened: false, error: `gh is signed in as "${login || "nobody"}", not harrymove-ctrl` };
  const wt = path.join(dataDir(), "pr-work", ctx.runId);
  mkdirSync(path.dirname(wt), { recursive: true });
  const patchFile = path.join(ctx.workspace, "pr.patch");
  writeFileSync(patchFile, patch);
  try {
    await run("git", ["worktree", "add", "-b", i.branch, wt, "HEAD"], process.cwd());
    await run("git", ["apply", "--index", patchFile], wt);
    await run("git", ["commit", "-m", i.title], wt);
    await run("git", ["push", "-u", "origin", i.branch], wt);
    const bodyFile = path.join(ctx.workspace, "pr-body.md");
    writeFileSync(bodyFile, i.body);
    const url = (await run("gh", ["pr", "create", "--head", i.branch, "--title", i.title, "--body-file", bodyFile], wt)).split("\n").pop();
    return { opened: true, url };
  } catch (e) {
    return { opened: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    await run("git", ["worktree", "remove", "--force", wt], process.cwd()).catch(() => {});
  }
}
