// The Trace view's data (docs/TRACE.md) in mock mode ($0): spans from the recorded runs, spans growing during a live
// mock run, the new `usage` fields, the filters, the comparison and the OpenTelemetry export.
//   pnpm check:trace
process.env.NIMBUS_DATA_DIR = "./data/check-trace";
process.env.NIMBUS_MODEL = "mock";
process.env.NIMBUS_CACHE = "off";
process.env.NIMBUS_SCHEDULER = "off";
delete process.env.NIMBUS_MOCK_FAST; // real mock delays (300 to 900 ms a hop), so `ms` and tokens per second mean something
import { readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { dataDir } from "../src/db";
import type { AnyRunEvent } from "../src/lib/events";
import { FILTERS, buildTrace, compareTraces, filterCounts, filterIds, headline, spanDur, toOtel, type Trace } from "../src/lib/trace";
import { WORKSTREAMS } from "../src/lib/workstreams";
import { startRun } from "../src/runtime/source";

const T0 = Date.now();
rmSync(dataDir(), { recursive: true, force: true });
const checks: [string, boolean][] = [];
const check = (n: string, ok: boolean, detail = "") => (checks.push([n, ok]), console.log(`${ok ? "✓" : "✗"} ${n}${!ok && detail ? `\n    ${detail.slice(0, 1200).replace(/\n/g, "\n    ")}` : ""}`));

/** What the spec says a trace has: one span per model call, tool call and wait, plus the plan gate. */
function structure(name: string, events: AnyRunEvent[]) {
  const t = buildTrace(events);
  const models = new Set(events.filter((e) => e.type === "segment.think").map((e) => `${e.agentInstance}:${(e.payload as { segId: string }).segId}`)).size;
  const tools = events.filter((e) => e.type === "tool.call").length;
  const waits = events.filter((e) => e.type === "approval.request" || e.type === "question").length;
  const gate = events.some((e) => e.type === "plan" && e.payload.awaiting) ? 1 : 0;
  check(`${name}: ${t.spans.length} spans = ${models} model + ${tools} tool + ${waits} wait + ${gate} gate`, t.spans.length === models + tools + waits + gate, `${t.spans.length} vs ${models + tools + waits + gate}`);
  const orphans = t.spans.filter((s) => s.kind === "tool" && !t.spans.some((p) => p.id === s.parentId && p.kind === "model" && p.instance === s.instance));
  check(`${name}: every tool span has a parent model span of the same instance (depth 1)`, orphans.length === 0 && t.spans.filter((s) => s.kind === "tool").every((s) => s.depth === 1), orphans.map((s) => s.id).join());
  const max = Math.max(0, ...t.spans.filter((s) => s.endMs !== undefined && !s.control).map((s) => (s.endMs ?? 0) - s.startMs));
  check(`${name}: longest is the maximum endMs - startMs (${max} ms; orchestration calls like plan and spawn_agents wrap other work and are left out) and longestShare matches`, !!t.longest && spanDur(t.longest) === max && Math.abs(t.longestShare - max / t.totalMs) < 1e-9, `${t.longest?.id} ${t.longestShare}`);
  check(`${name}: spans are in chronological order and none is left open after run.end`, t.spans.every((s, i) => i === 0 || s.startMs >= t.spans[i - 1].startMs) && t.spans.every((s) => s.endMs !== undefined) && !t.live);
  const hl = headline(t);
  check(`${name}: the headline names the longest span ("${hl?.text}")`, !!hl && hl.spanId === t.longest?.id && /\d+ %|< 1 % of the run\./.test(hl.text));
  const otel = JSON.parse(JSON.stringify(toOtel(t))) as ReturnType<typeof toOtel>;
  const ids = new Set(otel.spans.map((s) => s.spanId));
  check(`${name}: the OpenTelemetry export round-trips (${otel.spans.length} spans, ids unique, parents resolve)`, otel.spans.length === t.spans.length && ids.size === t.spans.length && /^[0-9a-f]{32}$/.test(otel.traceId) && otel.spans.every((s) => /^[0-9a-f]{16}$/.test(s.spanId) && (s.parentSpanId === "" || ids.has(s.parentSpanId)) && BigInt(s.endTimeUnixNano) >= BigInt(s.startTimeUnixNano)));
  return t;
}

console.log("· Recorded runs");
const recorded: [string, AnyRunEvent[]][] = [];
const norm = (list: Record<string, unknown>[], runId: string) => list.map((e, seq) => ({ runId, seq, ...e })) as unknown as AnyRunEvent[];
recorded.push(["demo-run", norm(JSON.parse(readFileSync("fixtures/demo-run.events.json", "utf8")), "run_demo")]);
for (const f of readdirSync("fixtures/seed-runs").filter((x) => x.endsWith(".json"))) recorded.push([`seed-runs/${f}`, norm(JSON.parse(readFileSync(path.join("fixtures/seed-runs", f), "utf8")).events, `run_${f}`)]);
for (const [name, events] of recorded) {
  const t = structure(name, events);
  check(`${name}: old events carry no usage.ms, so the model spans fall back to the segment's duration for tokens per second`, t.spans.filter((s) => s.model && s.model.out > 0).every((s) => s.model!.ms === undefined && (spanDur(s) === 0 || s.model!.tokPerS !== undefined)));
}

console.log("· A live mock run (Checkout)");
let live: Trace;
{
  const ws = WORKSTREAMS.find((w) => w.id === "ws-checkout")!;
  const run = startRun({ workstreamId: ws.id, title: ws.title, goal: ws.goal, trigger: "manual", mode: "ask", tools: ws.tools, review: true });
  const seen: AnyRunEvent[] = [];
  const counts: number[] = [];
  let sawLiveBar = false;
  let planGate = 0;
  const act = (e: AnyRunEvent) => {
    seen.push(e);
    if (e.type === "plan" && e.payload.awaiting) planGate++;
    if (e.type === "approval.request") run.resolveApproval(e.payload.approvalId, { decision: "approved" });
    if (e.type === "question") run.postMessage({ kind: "answer", text: e.payload.options?.[0] ?? "ok", questionId: e.payload.questionId });
    if (e.type === "plan" && e.payload.awaiting) setTimeout(() => run.planAction({ action: "approve", steps: e.payload.steps ?? [] }), 400);
    if (e.type === "segment.think" || e.type === "tool.call" || e.type === "tool.result") {
      const t = buildTrace(seen);
      counts.push(t.spans.length);
      if (t.spans.some((s) => s.endMs === undefined) && t.live) sawLiveBar = true;
    }
  };
  for (const e of run.events) act(e as AnyRunEvent);
  run.onEvent((e) => act(e as AnyRunEvent));
  await run.settled;
  live = structure("live run", run.events as AnyRunEvent[]);
  check("spans appear as events arrive: the count never goes down, and a span was open (live) in between", counts.length > 10 && counts.every((n, i) => i === 0 || n >= counts[i - 1]) && sawLiveBar, `${counts.length} samples, live bar seen ${sawLiveBar}`);

  const ends = (run.events as AnyRunEvent[]).filter((e) => e.type === "agent.end");
  const late = ends.filter((e) => live.spans.filter((s) => s.instance === e.agentInstance).some((s) => (s.endMs ?? Infinity) > e.tMs + 1));
  check(`each agent's spans end by the time the agent ends (${ends.length} agents)`, ends.length >= 4 && late.length === 0, late.map((e) => e.agentInstance).join());

  const usage = (run.events as AnyRunEvent[]).filter((e) => e.type === "usage");
  check(`every new usage event carries ms (${usage.length} events)`, usage.length > 5 && usage.every((e) => e.type === "usage" && typeof e.payload.ms === "number" && e.payload.ms >= 0));
  check("ttftMs is present only if the client streamed: present or absent, never 0 (this client does not stream, so absent)", usage.every((e) => e.type === "usage" && (e.payload.ttftMs === undefined || e.payload.ttftMs > 0)));
  const modelSpans = live.spans.filter((s) => s.model && s.model.out > 0 && !s.model.cached);
  check(`tokPerS is computed in buildTrace for every model span (${modelSpans.length}) = out / (ms / 1000)`, modelSpans.length > 5 && modelSpans.every((s) => s.model!.ms !== undefined && s.model!.tokPerS !== undefined && Math.abs(s.model!.tokPerS - s.model!.out / (s.model!.ms! / 1000)) < 1e-6 && s.model!.ttftMs === undefined), modelSpans.map((s) => `${s.id} ${s.model!.ms} ${s.model!.tokPerS}`).join("\n"));
  check("a model span carries its prompt (hop 1: the brief or goal) and its output (text or the tool calls as name(args))", live.spans.filter((s) => s.model).every((s) => (s.model!.prompt ?? "").length > 0 || s.id.endsWith("-h1") === false) && live.spans.some((s) => s.model && /\w+\(\{/.test(s.model.calls.map((c) => `${c.name}(${JSON.stringify(c.input)})`).join())));
  const titles = new Map(live.spans.filter((x) => x.tool).map((x) => [x.tool!.name, x.label]));
  check(`tool rows have human titles and keep the raw id on the span (${[...titles].map(([n, t]) => `${n} → ${t}`).join(", ")})`, titles.get("web_search") === "Search the web" && /^Run code · \S+/.test(titles.get("run_code") ?? "") && /^Write doc · /.test(titles.get("write_artifact") ?? "") && titles.get("request_approval") === "Ask for approval" && live.spans.filter((x) => x.tool).every((x) => x.label !== x.tool!.name));
  const gate = live.spans.find((s) => s.kind === "gate");
  check(`the plan gate (${gate ? spanDur(gate) : "none"} ms until you approve) and the approval waits are spans of their own`, planGate > 0 && !!gate && spanDur(gate) >= 300 && live.spans.some((s) => s.kind === "wait" && s.wait?.what === "approval" && s.wait.decision === "approved"));
}

console.log("· Filters");
{
  const ids = (f: (typeof FILTERS)[number]["key"]) => filterIds(live, f);
  const counts = filterCounts(live);
  check("Slow keeps the top three spans by duration", ids("slow").size === 3 && [...ids("slow")].every((id) => { const s = live.spans.find((x) => x.id === id)!; return live.spans.filter((o) => !o.control && spanDur(o) > spanDur(s)).length <= 2; }));
  check(`Failed matches the failed count (${live.failed})`, ids("failed").size === live.failed && live.spans.filter((s) => s.failed).every((s) => ids("failed").has(s.id)));
  const box = live.spans.filter((s) => s.tool?.where === "nebius-sandbox").length;
  check(`Sandbox matches where === "nebius-sandbox" (${box}; in mock that is zero, so the chip is disabled)`, ids("sandbox").size === box && box === 0 && counts.sandbox === 0);
  check(`Models (${counts.models}), Tools (${counts.tools}) and Waiting on you (${counts.waiting}) add up to All (${counts.all})`, counts.models + counts.tools + counts.waiting === counts.all && counts.models === live.modelCalls && counts.tools === live.toolCalls);
  const cmp = compareTraces(live, live);
  check("compare: a run against itself matches every span with a delta of 0 and is 0 % faster", cmp.deltas.size === live.spans.length && [...cmp.deltas.values()].every((d) => d === 0) && cmp.fasterPct === 0);
}

const bad = checks.filter(([, ok]) => !ok).length;
console.log(`\n${checks.length - bad}/${checks.length} checks passed in ${((Date.now() - T0) / 1000).toFixed(1)} s`);
process.exit(bad ? 1 : 0);
