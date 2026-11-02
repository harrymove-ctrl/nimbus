// Seed a live Nimbus with real conversations: import each use-case template with `nimbus ws import`, then drive one
// run of it through `nimbus mcp` the way a person would (approve most actions, reject one with a note, answer each
// question with its first option). Every run's calls are written to docs/usecases/<slug>.md.
//   NIMBUS_URL=https://nimbus-staging.up.railway.app node --import tsx scripts/run-usecases.mts [slug ...]
// Stops early when the day cap refuses a run. Never prints a key; the bearer stays in the child's environment.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const BIN = path.resolve("bin/nimbus.mjs");
const base = process.env.NIMBUS_URL ?? "http://localhost:3000";
const ALL = ["school-email-digest", "price-drop-watch", "subscription-renewals", "lease-review", "flight-delay-claim", "spending-summary", "macro-morning-brief", "fridge-meal-plan", "home-maintenance", "local-leads", "tax-deductions", "arxiv-triage"];
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
// one rejection per seeding, so the conversations show the gate saying no as well as yes
const REJECT: Record<string, string> = { "local-leads": "Too pushy. Shorter, one question, no discount talk." };

type R = { content?: { type: string; text?: string }[]; isError?: boolean };
const transport = new StdioClientTransport({ command: process.execPath, args: [BIN, "mcp"], env: { ...process.env } as Record<string, string>, stderr: "pipe" });
const client = new Client({ name: "nimbus-usecase-seed", version: "1.0.0" });
await client.connect(transport);

const results: string[] = [];
for (const slug of slugs) {
  const lines: string[] = [];
  const log = (s: string) => { console.log(s); lines.push(s); };
  const call = async (name: string, args: Record<string, unknown>) => {
    const t0 = Date.now();
    const r = (await client.callTool({ name, arguments: args }, undefined, { timeout: 620_000 })) as R;
    const text = r.content?.[0]?.text ?? "";
    let data: Record<string, unknown> = {};
    try { data = JSON.parse(r.content?.[1]?.text ?? "{}") as Record<string, unknown>; } catch { /* text only */ }
    log(`\n### ${name}(${JSON.stringify(args)})  · ${((Date.now() - t0) / 1000).toFixed(1)} s${r.isError ? " · ERROR" : ""}`);
    log("```\n" + text.trim().split("\n").slice(0, 16).join("\n") + "\n```");
    return { text, data, error: !!r.isError };
  };

  log(`# ${slug} · ${new Date().toISOString()} · ${base}`);
  const out = execFileSync(process.execPath, [BIN, "ws", "import", `templates/${slug}.yaml`], { env: process.env, encoding: "utf8" });
  const wsId = /imported (\S+)/.exec(out)?.[1];
  log(`\nImported: ${out.trim().split("\n")[0]}`);
  if (!wsId) { results.push(`${slug}: import failed`); continue; }

  const sr = await call("start_run", { workstream: wsId });
  const runId = String(sr.data.run_id ?? "");
  if (!/^run_/.test(runId)) {
    results.push(`${slug}: not started (${sr.text.split("\n")[0]})`);
    if (/day cap/i.test(sr.text)) break;
    continue;
  }
  let decisions = 0;
  for (let i = 0; i < 12; i++) {
    const w = await call("wait_for_run", { run_id: runId, until: "approval", timeout_s: 600 });
    if (w.data.ended) break;
    const waiting = w.data.waiting as { kind?: string; id?: string } | undefined;
    if (!waiting?.kind) continue;
    if (waiting.kind === "approval") {
      const note = REJECT[slug];
      await call("approve", note && decisions === 0
        ? { run_id: runId, approval_id: String(waiting.id), decision: "reject", note }
        : { run_id: runId, approval_id: String(waiting.id), decision: "approve" });
      decisions++;
    } else if (waiting.kind === "question") {
      await call("answer", { run_id: runId, question_id: String(waiting.id), text: "1" });
      decisions++;
    }
  }
  const end = await call("wait_for_run", { run_id: runId, until: "end", timeout_s: 600 });
  await call("read_artifact", { run_id: runId });
  const status = String(end.data.end_status ?? "?");
  log(`\nRun ${runId}: ${status} · ${decisions} decision(s) · ${base}/?run=${runId}`);
  results.push(`${slug}: ${runId} ${status}, ${decisions} decision(s)`);
  mkdirSync("docs/usecases", { recursive: true });
  writeFileSync(`docs/usecases/${slug}.md`, lines.join("\n") + "\n");
}
await client.close();
console.log("\n== SUMMARY\n" + results.join("\n"));
