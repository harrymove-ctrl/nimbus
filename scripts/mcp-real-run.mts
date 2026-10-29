// One real run on a live Nimbus, driven only through `nimbus mcp` (docs/ROADMAP.md row 7.4): the client lists the
// workstreams, starts one, waits for every gate, decides, waits for the end and reads the artifact. Every call and
// the first lines of every reply are written to docs/mcp/<date>-<workstream>.md as the transcript.
//   NIMBUS_URL=https://... node --import tsx scripts/mcp-real-run.mts [workstream] [goal]
//   ... scripts/mcp-real-run.mts --run run_xxxx [workstream]   resumes driving a run that is already live
// Decisions: open_pr is rejected with a note (the hosted demo does not open PRs); everything else is approved;
// a question gets its first option. Nothing secret is written: the bearer never leaves the child's environment.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const BIN = path.resolve("bin/nimbus.mjs");
const resumeIdx = process.argv.indexOf("--run");
const resume = resumeIdx > 0 ? process.argv[resumeIdx + 1] : undefined;
const argv = process.argv.filter((a, i) => i < 2 || (i !== resumeIdx && i !== resumeIdx + 1));
const ws = argv[2] ?? "release watch";
const goal = argv[3];
const base = process.env.NIMBUS_URL ?? "http://localhost:3000";
type R = { content?: { type: string; text?: string }[]; structuredContent?: Record<string, unknown>; isError?: boolean };
const lines: string[] = [];
const log = (s: string) => { console.log(s); lines.push(s); };

const transport = new StdioClientTransport({ command: process.execPath, args: [BIN, "mcp"], env: { ...process.env } as Record<string, string>, stderr: "pipe" });
const client = new Client({ name: "nimbus-real-run", version: "1.0.0" });
await client.connect(transport);

async function call(name: string, args: Record<string, unknown>) {
  const t0 = Date.now();
  const r = (await client.callTool({ name, arguments: args }, undefined, { timeout: 620_000 })) as R;
  const text = r.content?.[0]?.text ?? "";
  // the tools answer with two text items: the phone-length text, then the JSON
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(r.content?.[1]?.text ?? "{}") as Record<string, unknown>; } catch { /* text only */ }
  log(`\n### ${name}(${JSON.stringify(args)})  · ${((Date.now() - t0) / 1000).toFixed(1)} s${r.isError ? " · ERROR" : ""}`);
  log("```\n" + text.trim().split("\n").slice(0, 14).join("\n") + "\n```");
  return { text, data };
}

const started = new Date();
log(`# Real MCP run · ${started.toISOString()} · ${base}`);
log(`Client: @modelcontextprotocol/sdk over stdio to \`nimbus mcp\`. Every tool call below is as issued; replies are the tool's text block (first 14 lines).`);
const tools = ((await client.listTools()).tools ?? []).map((t) => t.name).sort();
log(`\nTools: ${tools.join(", ")}`);

await call("list_workstreams", {});
const runId = resume ?? String((await call("start_run", goal ? { workstream: ws, goal } : { workstream: ws })).data.run_id ?? "");
if (resume) log(`\nResuming ${resume} (started by an earlier client call)`);
if (!/^run_/.test(runId)) { log("no run id, stopping"); process.exit(1); }

let decisions = 0;
for (let i = 0; i < 12; i++) {
  const w = await call("wait_for_run", { run_id: runId, until: "approval", timeout_s: 600 });
  if (w.data.ended) break;
  const waiting = w.data.waiting as { kind?: string; id?: string; tool?: string; title?: string; options?: string[] } | undefined;
  if (!waiting?.kind) continue;
  if (waiting.kind === "approval") {
    const isPr = /open_pr|pull request|\bPR\b/i.test(`${waiting.tool ?? ""} ${waiting.title ?? ""}`);
    await call("approve", isPr
      ? { run_id: runId, approval_id: String(waiting.id), decision: "reject", note: "The hosted demo does not open PRs; keep the patch as the artifact." }
      : { run_id: runId, approval_id: String(waiting.id), decision: "approve" });
    decisions++;
  } else if (waiting.kind === "question") {
    await call("answer", { run_id: runId, question_id: String(waiting.id), text: "1" });
    decisions++;
  }
}
const end = await call("wait_for_run", { run_id: runId, until: "end", timeout_s: 600 });
await call("run_status", { run_id: runId });
await call("read_artifact", { run_id: runId });
await call("list_memories", { workstream: ws });
log(`\nRun ${runId}: ${String(end.data.end_status ?? "?")} · ${decisions} decision(s) made through MCP · ${((Date.now() - started.getTime()) / 1000).toFixed(0)} s wall clock · ${base}/?run=${runId}`);
await client.close();

const slug = ws.toLowerCase().replace(/[^a-z0-9]+/g, "-");
mkdirSync("docs/mcp", { recursive: true });
const file = `docs/mcp/${started.toISOString().slice(0, 10)}-${slug}.md`;
writeFileSync(file, lines.join("\n") + "\n");
console.log(`\ntranscript: ${file}`);
