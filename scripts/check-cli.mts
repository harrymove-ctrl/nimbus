// The `nimbus` CLI and MCP server against Nimbus in mock mode ($0, no keys): docs/ROADMAP.md section 3.
// The route handlers are served over real HTTP on a free port, so the CLI binary and the MCP server (child processes)
// go through the same API a deployed Nimbus has. Token Factory, Sandboxes and Telegram are one local stub.
//   pnpm check:cli             (--verbose prints what the terminal run showed)
process.env.NIMBUS_DATA_DIR = "./data/check-cli";
process.env.NIMBUS_MODEL = "mock";
process.env.NIMBUS_MOCK_FAST = "1";
process.env.NIMBUS_CACHE = "off";
process.env.NIMBUS_SCHEDULER = "off";
import { spawn } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { dataDir } from "../src/db";
import { TIERS } from "../src/lib/models";
import * as wsRoute from "../src/app/api/workstreams/route";
import * as wsIdRoute from "../src/app/api/workstreams/[id]/route";
import * as memRoute from "../src/app/api/workstreams/[id]/memories/route";
import * as runsRoute from "../src/app/api/runs/route";
import * as runIdRoute from "../src/app/api/runs/[id]/route";
import * as activeRoute from "../src/app/api/runs/active/route";
import * as eventsRoute from "../src/app/api/runs/[id]/events/route";
import * as planRoute from "../src/app/api/runs/[id]/plan/route";
import * as approvalRoute from "../src/app/api/runs/[id]/approvals/[aid]/route";
import * as messagesRoute from "../src/app/api/runs/[id]/messages/route";
import * as stopRoute from "../src/app/api/runs/[id]/stop/route";
import * as budgetRoute from "../src/app/api/budget/route";

const T0 = Date.now();
rmSync(dataDir(), { recursive: true, force: true });
const checks: [string, boolean][] = [];
const check = (n: string, ok: boolean, detail = "") => (checks.push([n, ok]), console.log(`${ok ? "✓" : "✗"} ${n}${!ok && detail ? `\n    ${detail.slice(0, 1500).replace(/\n/g, "\n    ")}` : ""}`));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ---------- Nimbus over HTTP: the route handlers behind a node:http server ---------- */
type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response> | Response;
const ROUTES: [string, RegExp, Handler][] = [
  ["GET", /^\/api\/workstreams$/, wsRoute.GET as Handler],
  ["POST", /^\/api\/workstreams$/, wsRoute.POST as Handler],
  ["PATCH", /^\/api\/workstreams\/(?<id>[^/]+)$/, wsIdRoute.PATCH as Handler],
  ["GET", /^\/api\/workstreams\/(?<id>[^/]+)\/memories$/, memRoute.GET as Handler],
  ["GET", /^\/api\/runs$/, runsRoute.GET as Handler],
  ["POST", /^\/api\/runs$/, runsRoute.POST as Handler],
  ["GET", /^\/api\/runs\/active$/, activeRoute.GET as Handler],
  ["GET", /^\/api\/runs\/(?<id>[^/]+)$/, runIdRoute.GET as Handler],
  ["GET", /^\/api\/runs\/(?<id>[^/]+)\/events$/, eventsRoute.GET as Handler],
  ["POST", /^\/api\/runs\/(?<id>[^/]+)\/plan$/, planRoute.POST as Handler],
  ["POST", /^\/api\/runs\/(?<id>[^/]+)\/approvals\/(?<aid>[^/]+)$/, approvalRoute.POST as Handler],
  ["POST", /^\/api\/runs\/(?<id>[^/]+)\/messages$/, messagesRoute.POST as Handler],
  ["POST", /^\/api\/runs\/(?<id>[^/]+)\/stop$/, stopRoute.POST as Handler],
  ["GET", /^\/api\/budget$/, budgetRoute.GET as Handler],
];
const hits: string[] = [];
async function serve(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const route = ROUTES.map(([m, re, h]) => ({ m, h, match: re.exec(url.pathname) })).find((r) => r.m === req.method && r.match);
  hits.push(`${req.method} ${url.pathname}`);
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

/* ---------- one stub for Token Factory /models, Sandboxes /whoami and /images, Telegram getMe ---------- */
const KEY = "tf-test-key-7f3a9c";
const BOT = "123456:tg-test-token-9b2e";
const stub = createServer((req, res) => {
  const u = new URL(req.url ?? "/", "http://x");
  const json = (code: number, b: unknown) => res.writeHead(code, { "content-type": "application/json" }).end(JSON.stringify(b));
  const authed = req.headers.authorization === `Bearer ${KEY}`;
  if (u.pathname === "/tf/models") return authed ? json(200, { data: [...Object.values(TIERS), "meta/llama"].map((id) => ({ id })) }) : json(401, { error: "bad key" });
  if (u.pathname === "/sb/whoami") return authed && req.headers.project === "proj-test" ? json(200, { token_uuid: "u", permissions: { run: true, images: true }, limits: { concurrent: 4 } }) : json(401, {});
  if (u.pathname === "/sb/images") return json(200, { images: [{ uuid: "i1", tag: u.searchParams.get("tag") === "python" ? "python:3.12-slim" : "node:20-slim" }] });
  if (u.pathname === `/tg/bot${BOT}/getMe`) return json(200, { ok: true, result: { username: "nimbus_check_bot" } });
  json(404, {});
});
await new Promise<void>((r) => stub.listen(0, "127.0.0.1", r));
const STUB = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;

const BIN = path.resolve("bin/nimbus.mjs");
const childEnv: NodeJS.ProcessEnv = {
  ...process.env,
  NIMBUS_URL: URL_,
  NIMBUS_ENV_FILE: "none",
  NO_COLOR: "1",
  NEBIUS_API_KEY: KEY,
  NEBIUS_BASE_URL: `${STUB}/tf`,
  NEBIUS_PROJECT_ID: "proj-test",
  NEBIUS_SANDBOX_BASE_URL: `${STUB}/sb`,
  NIMBUS_TELEGRAM_BOT_TOKEN: BOT,
  NIMBUS_TELEGRAM_CHAT_ID: "42",
  NIMBUS_TELEGRAM_API_BASE: `${STUB}/tg`,
};

type Out = { code: number; out: string };
/** run the real binary; `answers` maps a prompt (seen on stdout) to the line typed back, once per time it shows */
function cli(args: string[], answers: [RegExp, string][] = [], timeoutMs = 45_000): Promise<Out> {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [BIN, ...args], { env: childEnv, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    const answered = new Map<number, number>();
    const onOut = (d: Buffer) => {
      out += d.toString();
      answers.forEach(([re, line], i) => {
        const seen = out.match(new RegExp(re.source, "g"))?.length ?? 0;
        if (seen > (answered.get(i) ?? 0)) {
          answered.set(i, seen);
          p.stdin.write(`${line}\n`);
        }
      });
    };
    p.stdout.on("data", onOut);
    p.stderr.on("data", (d: Buffer) => (out += d.toString()));
    if (!answers.length) p.stdin.end();
    const kill = setTimeout(() => p.kill("SIGKILL"), timeoutMs);
    p.on("exit", (code) => (clearTimeout(kill), resolve({ code: code ?? -1, out })));
  });
}

console.log(`— doctor (Nimbus at ${URL_}, stubs at ${STUB})`);
{
  const r = await cli(["doctor"]);
  const rows = r.out.trim().split("\n");
  check("doctor prints one ✓ row each: Nimbus, models, whoami, images, Telegram, data, day cap; exit 0", r.code === 0 && ["Nimbus", "Token Factory models", "Sandboxes whoami", "Sandbox images", "Telegram", "Data", "Day cap"].every((n) => rows.some((l) => l.startsWith("✓") && l.includes(n))), r.out);
  check("doctor names the bot and the Nemotron tiers and never prints a key or token", r.out.includes("@nimbus_check_bot") && r.out.includes("Ultra, Super and Nano") && !r.out.includes(KEY) && !r.out.includes(BOT), r.out);
  const bad = await new Promise<Out>((resolve) => {
    const p = spawn(process.execPath, [BIN, "doctor"], { env: { ...childEnv, NEBIUS_API_KEY: "wrong-key-123", NIMBUS_TELEGRAM_BOT_TOKEN: "", NEBIUS_PROJECT_ID: "" }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.on("exit", (code) => resolve({ code: code ?? -1, out }));
  });
  check("a rejected key is a ✗ row and exit 1; unset optional parts are skipped, not failed", bad.code === 1 && /✗ Token Factory models .*401/.test(bad.out) && /· Telegram/.test(bad.out) && !bad.out.includes("wrong-key-123"), bad.out);
}

console.log("— ws list");
{
  const r = await cli(["ws", "list"]);
  check("ws list shows the seeded workstreams with schedules and tools", r.code === 0 && r.out.includes("ws-checkout") && r.out.includes("ws-release") && r.out.includes("run_code"), r.out);
}

console.log("— run checkout, answering in the terminal (plan: y, approval: a, question: 1)");
let runId = "";
{
  const t = Date.now();
  const r = await cli(["run", "checkout"], [
    [/approve the plan\? \[Y\/n\]/, "y"],
    [/\[a\]pprove, approve a\[l\]ways, \[r\]eject\?/, "a"],
    [/answer \(1-2 or text\):/, "1"],
  ]);
  runId = /run:\s+(run_\w+)/.exec(r.out)?.[1] ?? "";
  if (process.argv.includes("--verbose")) console.log(r.out.replace(/^/gm, "    | "));
  check("run starts and prints the run id and link", !!runId && r.out.includes(`${URL_}/?run=${runId}`), r.out);
  check("timeline lines carry lane, model tier and spend (Researcher · Super · $)", /\d+\.\ds\s+Researcher\s+Super\s+\$\d/.test(r.out) && /Orchestrator\s+Ultra/.test(r.out) && /Checker\s+Nano/.test(r.out), r.out);
  check("the plan prompt showed the steps and the answer approved it", /approve the plan\? \[Y\/n\] y/.test(r.out) && r.out.includes("plan approved"), r.out);
  check("the question listed numbered options and '1' answered with the first (Oct 7)", r.out.includes("1) Oct 7") && /you: Oct 7/.test(r.out), r.out);
  check("the approval prompt approved ap-… by you", /approval needed \(medium risk\): Send summary to #growth/.test(r.out) && /ap-\d+ approved by you/.test(r.out), r.out);
  check("ends done with cost, the artifact's first lines and the link; exit 0", r.code === 0 && /── done · \$\d/.test(r.out) && /Checkout conversion/.test(r.out.split("── done")[1] ?? "") && r.out.trim().endsWith(`/?run=${runId}`), r.out);
  console.log(`    (run took ${((Date.now() - t) / 1000).toFixed(1)} s)`);
}

console.log("— status");
{
  const r = await cli(["status"]);
  check("status says nothing runs, lists the run as done and shows the day cap", r.code === 0 && r.out.includes("Nothing running.") && new RegExp(`${runId}\\s+done`).test(r.out) && /today \$[\d.]+ of the \$[\d.]+ day cap/.test(r.out), r.out);
  const j = await cli(["status", "--json"]);
  check("status --json is JSON with active, recent and budget", (() => { try { const x = JSON.parse(j.out); return Array.isArray(x.active) && x.recent.some((r: { id: string }) => r.id === runId) && typeof x.budget.dayCapUsd === "number"; } catch { return false; } })(), j.out);
  const none = await cli(["approve"]);
  check("approve with nothing waiting says so and exits 1", none.code === 1 && none.out.includes("nothing waits for your approval"), none.out);
}

console.log("— approve and reject from another terminal (the latest waiting gate, no ids typed)");
{
  const start = await fetch(`${URL_}/api/runs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workstreamId: "ws-release" }) });
  const { runId: rel } = (await start.json()) as { runId: string };
  const waitActive = async (test: (r: { planAwaiting: boolean; approval?: unknown }) => boolean) => {
    for (let i = 0; i < 100; i++) {
      const { runs } = (await (await fetch(`${URL_}/api/runs/active`)).json()) as { runs: { id: string; planAwaiting: boolean; approval?: unknown }[] };
      const r = runs.find((x) => x.id === rel);
      if (r && test(r)) return true;
      await sleep(100);
    }
    return false;
  };
  await waitActive((r) => r.planAwaiting);
  const a = await cli(["approve"]);
  check("`nimbus approve` approves the waiting plan of the newest run", a.code === 0 && a.out.includes(`approved plan: the plan · ${rel}`), a.out);
  const sawApproval = await waitActive((r) => !!r.approval);
  const rj = await cli(["reject", "not today, the release notes are wrong"]);
  check("`nimbus reject \"note\"` rejects the pending action with the note", sawApproval && rj.code === 0 && /rejected ap-\d+: .+ · note: not today, the release notes are wrong/.test(rj.out), rj.out);
  const ev = await fetch(`${URL_}/api/runs/${rel}/events`).then((r) => r.text());
  const resolves = ev.split("\n").filter((l) => l.includes('"approval.resolve"'));
  check("the run's log has the rejection by you with the note", resolves.some((l) => { const p = JSON.parse(l.slice(6)).payload; return p.decision === "rejected" && p.by === "you" && p.note === "not today, the release notes are wrong"; }), resolves.join("\n"));
  await fetch(`${URL_}/api/runs/${rel}/stop`, { method: "POST", body: "{}" });
}

console.log("— ws export, then import");
{
  const file = path.join(dataDir(), "checkout.yaml");
  const e = await cli(["ws", "export", "checkout", file]);
  const yaml = readFileSync(file, "utf8");
  check("export writes YAML with title, goal, schedule and a tools list", e.code === 0 && /^title: /m.test(yaml) && /^goal: /m.test(yaml) && /^tools:\n {2}- /m.test(yaml), yaml);
  const i = await cli(["ws", "import", file]);
  const id = /imported (ws-u-[\w-]+)/.exec(i.out)?.[1];
  const all = ((await (await fetch(`${URL_}/api/workstreams`)).json()) as { workstreams: { id: string; title: string; goal: string; tools: string[]; scheduleLabel?: string }[] }).workstreams;
  const src = all.find((w) => w.id === "ws-checkout")!;
  const copy = all.find((w) => w.id === id);
  check("import creates a workstream with the same title, goal, tools and schedule", !!copy && copy.title === src.title && copy.goal === src.goal && copy.tools.join() === src.tools.join() && (copy.scheduleLabel ?? "") === (src.scheduleLabel ?? ""), `${i.out}\n${JSON.stringify({ src, copy })}`);
  const c = await cli(["ws", "create", "--title", "Inbox zero", "--goal", "Triage my inbox: three reply drafts", "--tools", "web_search,write_artifact", "--schedule", "weekdays 8:00"]);
  check("ws create with flags sets the schedule (Weekdays 08:00)", c.code === 0 && /created ws-u-inbox-zero-\w+ · Inbox zero · Weekdays 08:00/.test(c.out), c.out);
}

console.log("— MCP server over stdio (the SDK's client)");
{
  const transport = new StdioClientTransport({ command: process.execPath, args: [BIN, "mcp"], env: childEnv as Record<string, string>, stderr: "pipe" });
  const client = new Client({ name: "check-cli", version: "1.0.0" });
  await client.connect(transport);
  type R = { content: { type: string; text: string }[]; isError?: boolean };
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r = (await client.callTool({ name, arguments: args }, undefined, { timeout: 90_000 })) as R;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the tools' JSON, asserted field by field below
    let data: any = null;
    try {
      data = JSON.parse(r.content[1]?.text ?? "null");
    } catch {
      /* checked below */
    }
    return { text: r.content[0]?.text ?? "", data, n: r.content.length, isError: !!r.isError };
  };
  const shape = (r: { text: string; data: unknown; n: number; isError: boolean }) => !r.isError && r.n === 2 && r.data !== null && r.text.length > 0 && r.text.length <= 700;

  const tools = (await client.listTools()).tools.map((t) => t.name).sort();
  check("9 tools listed", tools.join() === "answer,approve,create_workstream,list_memories,list_workstreams,read_artifact,run_status,start_run,wait_for_run", tools.join());
  const lw = await call("list_workstreams");
  check("list_workstreams: short text plus JSON with ws-release", shape(lw) && /^\d+ workstreams/.test(lw.text) && lw.data.some((w: { id: string }) => w.id === "ws-release"), lw.text);
  const sr = await call("start_run", { workstream: "release watch" });
  const mrun: string = sr.data?.run_id;
  check("start_run('release watch') resolves the name and starts a run", shape(sr) && /^run_/.test(mrun) && sr.data.workstream_id === "ws-release", sr.text);
  const w1 = await call("wait_for_run", { run_id: mrun, until: "approval", timeout_s: 60 });
  const apId: string = w1.data?.waiting?.id;
  check("wait_for_run(until: approval) returns at the approval, numbers first", shape(w1) && w1.data.reason === "reached" && w1.data.waiting?.kind === "approval" && /^ap-\d+$/.test(apId) && /^reached approval · \$\d/.test(w1.text), w1.text);
  const st = await call("run_status", { run_id: mrun });
  check("run_status names the same approval and the next call", shape(st) && st.data.waiting?.id === apId && st.text.includes(`approve("${mrun}", "${apId}"`), st.text);
  const ap = await call("approve", { run_id: mrun, approval_id: apId, decision: "approve" });
  check("approve decides it", shape(ap) && ap.text.startsWith(`approved ${apId}`), ap.text);
  const w2 = await call("wait_for_run", { run_id: mrun, until: "end", timeout_s: 60 });
  check("wait_for_run(until: end) returns once the run is done", shape(w2) && w2.data.reason === "reached" && w2.data.ended === true && w2.data.end_status === "done", `${w2.text}\n${JSON.stringify(w2.data).slice(0, 600)}`);
  const ra = await call("read_artifact", { run_id: mrun });
  check("read_artifact: title and first lines as text, the full doc in JSON", shape(ra) && typeof ra.data.content === "string" && ra.data.content.length > 100 && ra.text.startsWith(ra.data.title), ra.text);
  const lm = await call("list_memories", { workstream: "ws-release" });
  check("list_memories answers with a count and JSON", shape(lm) && /^\d+ memories/.test(lm.text) && Array.isArray(lm.data.memories), lm.text);
  const cw = await call("create_workstream", { title: "Standup notes", goal: "Draft my standup from yesterday's commits", schedule: "daily 09:15", tools: ["read_repo", "write_artifact"] });
  check("create_workstream with a schedule", shape(cw) && /^ws-u-standup-notes-/.test(cw.data.id) && cw.data.scheduleLabel === "Daily 09:15", cw.text);
  const bad = await call("start_run", { workstream: "no such thing at all" });
  check("a tool error comes back as isError with the reason", bad.isError && bad.text.includes("no workstream matches"), bad.text);
  const evRes = await client.readResource({ uri: `nimbus://runs/${mrun}/events` });
  const evJson = JSON.parse((evRes.contents[0] as { text: string }).text);
  check("resource nimbus://runs/{id}/events returns the event log", evJson.finished === true && evJson.events.some((e: { type: string }) => e.type === "run.end"), JSON.stringify(evJson).slice(0, 300));
  const skills = (await client.listResources()).resources.filter((r) => r.uri.endsWith("/skill"));
  const sk = await client.readResource({ uri: "nimbus://workstreams/ws-release/skill" });
  check("resource nimbus://workstreams/{id}/skill is listed and returns the SKILL.md", skills.length >= 7 && /## /.test((sk.contents[0] as { text: string }).text), JSON.stringify(sk).slice(0, 300));
  await client.close();
}

console.log("— mcp install");
{
  const r = await cli(["mcp", "install", "claude"]);
  const j = JSON.parse(r.out.slice(r.out.indexOf("{"), r.out.lastIndexOf("}") + 1));
  check("mcp install claude prints an mcpServers.nimbus stdio entry pointing at the binary", j.mcpServers?.nimbus?.args?.[0] === BIN && j.mcpServers.nimbus.args[1] === "mcp" && j.mcpServers.nimbus.env.NIMBUS_URL === URL_, r.out);
  const cu = await cli(["mcp", "install", "cursor"]);
  check("mcp install cursor uses Cursor's ${env:…} form", cu.out.includes("${env:NIMBUS_API_TOKEN}"), cu.out);
}

const secs = (Date.now() - T0) / 1000;
check(`under 90 s (${secs.toFixed(1)} s)`, secs < 90);
check("every call went through the HTTP API", hits.some((h) => h.startsWith("GET /api/runs/") && h.endsWith("/events")) && hits.some((h) => h.startsWith("POST /api/runs/") && h.includes("/approvals/")));
nimbus.closeAllConnections();
nimbus.close();
stub.close();
const pass = checks.every(([, ok]) => ok);
console.log(`\n${checks.filter(([, ok]) => ok).length}/${checks.length} checks · CHECK-CLI: ${pass ? "PASS" : "FAIL"}`);
process.exit(pass ? 0 : 1);
