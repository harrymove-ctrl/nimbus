// The Trace view's data (docs/TRACE.md): the run's events in, one flat list of spans out (a model call, a tool call, a
// wait on a person, the plan gate), with depth and parent, the headline numbers and the longest span. Pure and
// client-safe: the panel, the export and scripts/check-trace.mts all read it, and nothing here knows about React.
import type { AnyRunEvent } from "./events";
import { TIERS, type Tier } from "./models";
import { TIER_LABEL, laneName, type RouteInfo } from "./run-view";

export type SpanKind = "model" | "tool" | "wait" | "gate";

export type Span = {
  /** segId for model calls, callId for tools, approvalId or questionId for waits, "gate" for the plan approval */
  id: string;
  kind: SpanKind;
  /** lane name ("Researcher 2") */
  agent: string;
  role: string;
  instance: string;
  /** "Nemotron 3 Super", "run_code · script.py", "Approval: send to #growth" */
  label: string;
  /** what the hop was doing (the timeline's segment label), for model spans */
  note?: string;
  /** run-relative ms */
  startMs: number;
  /** missing while the span is live */
  endMs?: number;
  failed?: boolean;
  model?: {
    tier: Tier;
    model: string;
    in: number;
    out: number;
    cached?: boolean;
    /** wall time of the call as the runtime measured it (the usage event's `ms`) */
    ms?: number;
    /** only when the client streamed; never 0 */
    ttftMs?: number;
    tokPerS?: number;
    route?: RouteInfo;
    /** the model's text, and the tool calls it asked for */
    output?: string;
    calls: { name: string; input: unknown }[];
    /** what the hop was given: the brief or goal on its first hop, the previous tool results after that */
    prompt?: string;
  };
  tool?: { name: string; input: unknown; output?: unknown; ok?: boolean; where?: "nebius-sandbox" | "local"; sandbox?: { image: string; operation: string; elapsedS?: number }; exitCode?: number };
  wait?: { what: "approval" | "question"; text?: string; decision?: string; by?: string; via?: string };
  /** 1 for a tool call under the model hop that asked for it */
  depth: 0 | 1;
  parentId?: string;
  /** an orchestration call (plan, spawn_agents, handoff, finish): it has no segment of its own and can wrap its children's whole runtime, so it never counts as the longest or slowest span */
  control?: boolean;
  /** what the lane timeline and Agent I/O call this span: { instance, id } of the segment to select */
  ref: { instance: string; id: string };
};

export type Trace = {
  runId?: string;
  title: string;
  /** wall-clock start of the run (epoch ms), for the export */
  startedAt: number;
  spans: Span[];
  totalMs: number;
  /** no run.end yet */
  live: boolean;
  longest: Span | null;
  longestShare: number;
  modelCalls: number;
  toolCalls: number;
  waits: number;
  tokens: number;
  failed: number;
  waitingMs: number;
};

export const spanDur = (s: Span, nowMs?: number) => Math.max(0, (s.endMs ?? nowMs ?? s.startMs) - s.startMs);
export const isLive = (s: Span) => s.endMs === undefined;
export const isWaitKind = (s: Span) => s.kind === "wait" || s.kind === "gate";

/**
 * The row's human title: "Search the web", "Run code · funnel.py", "Write doc · Checkout report", "Send to #growth".
 * The raw tool id stays on the span (`tool.name`) for the card. `detail` is the part of the segment's label after
 * the tool id ("run_code · funnel.py" gives "funnel.py").
 */
export function toolTitle(name: string, input: unknown, segLabel?: string): string {
  const inp = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const detail = segLabel?.includes(" · ") ? segLabel.slice(segLabel.indexOf(" · ") + 3) : "";
  const channel = typeof inp.channel === "string" ? inp.channel : "";
  const withDetail = (head: string, d = detail) => (d ? `${head} · ${d}` : head);
  switch (name) {
    case "web_search":
      return "Search the web";
    case "fetch_url":
      return withDetail("Read page");
    case "run_code":
      return withDetail("Run code");
    case "write_artifact":
      return withDetail(inp.kind === "code" ? "Write code" : "Write doc", detail || (typeof inp.title === "string" ? inp.title : ""));
    case "send_message":
      return `Send to ${channel || detail || "a channel"}`;
    case "read_repo":
      return withDetail("Read repo");
    case "open_pr":
      return withDetail("Open PR");
    case "save_learning":
      return "Save learning";
    case "ask_user":
      return "Ask you";
    case "plan":
      return "Plan the run";
    case "spawn_agents":
      return "Spawn the crew";
    case "handoff":
      return "Hand off";
    case "finish":
      return "Finish the run";
    case "request_approval":
      return "Ask for approval";
    default:
      return segLabel ?? name;
  }
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);
const show = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v, null, 2) ?? "");
const bytes = (s: unknown) => (typeof s === "string" ? new TextEncoder().encode(s).length : 0);

export function buildTrace(events: AnyRunEvent[]): Trace {
  const spans: Span[] = [];
  const byId = new Map<string, Span>();
  const lastModel = new Map<string, Span>(); // instance → its latest model span
  const pendingRoute = new Map<string, RouteInfo>();
  const openTool = new Map<string, { segId: string; label: string; startMs: number }>(); // instance → its latest unclaimed segment.tool
  const briefs = new Map<string, string>(); // instance → its brief
  const hops = new Map<string, number>(); // instance → model calls so far
  const results = new Map<string, string[]>(); // instance → tool results since its last model call
  const calls = new Map<string, Span>(); // `${instance}:${callId}` → its tool span
  const needUsage = new Map<string, Span>(); // instance → model span waiting for its usage event
  let goal = "";
  let runId: string | undefined;
  let title = "";
  let startedAt = 0;
  let lastT = 0;
  let ended = false;

  const add = (s: Span) => {
    let id = s.id;
    if (byId.has(id)) id = `${id}@${s.instance}`;
    s.id = id;
    byId.set(id, s);
    spans.push(s);
    return s;
  };
  const base = (instance: string, role: string) => ({ agent: laneName(instance, role), role, instance });
  const closeAll = (tMs: number, instance?: string) => {
    for (const s of spans) if (s.endMs === undefined && (!instance || s.instance === instance)) s.endMs = tMs;
  };

  for (const e of events) {
    lastT = Math.max(lastT, e.tMs);
    runId = e.runId;
    const inst = e.agentInstance;
    switch (e.type) {
      case "run.start":
        title = e.payload.title;
        goal = e.payload.goal;
        startedAt = e.payload.startedAt;
        break;
      case "run.end":
        ended = true;
        closeAll(e.tMs);
        break;
      case "agent.spawn":
        briefs.set(e.payload.instance, e.payload.brief);
        break;
      case "agent.end":
        closeAll(e.tMs, inst);
        break;
      case "agent.error": {
        closeAll(e.tMs, inst);
        const last = [...spans].reverse().find((s) => s.instance === inst);
        if (last) last.failed = true;
        break;
      }
      case "route": {
        const p = e.payload;
        const info: RouteInfo = { hop: p.hop, chosen: p.chosen, ceiling: p.ceiling, reason: p.reason, fallback: p.fallback };
        const open = lastModel.get(inst);
        if (p.fallback && open && open.endMs === undefined && open.model) {
          open.model.route = info;
          open.model.tier = p.chosen;
          open.model.model = TIERS[p.chosen];
          open.failed = true;
        } else pendingRoute.set(inst, info);
        break;
      }
      case "segment.tool":
        if (e.payload.endMs === undefined) openTool.set(inst, { segId: e.payload.segId, label: e.payload.label, startMs: e.payload.startMs ?? e.tMs });
        break;
      case "segment.think": {
        const p = e.payload;
        const existing = byId.get(p.segId);
        if (existing) {
          if (p.endMs !== undefined) existing.endMs = p.endMs;
          if (p.failed) existing.failed = true;
          break;
        }
        const route = pendingRoute.get(inst);
        pendingRoute.delete(inst);
        const tier: Tier = route?.chosen ?? "super";
        const n = (hops.get(inst) ?? 0) + 1;
        hops.set(inst, n);
        const given = n === 1 ? (inst === "orchestrator" ? goal : (briefs.get(inst) ?? "")) : (results.get(inst) ?? []).join("\n\n");
        results.set(inst, []);
        const s = add({
          id: p.segId,
          kind: "model",
          ...base(inst, e.agent),
          label: TIER_LABEL[tier],
          note: p.label,
          startMs: p.startMs ?? e.tMs,
          endMs: p.endMs,
          failed: p.failed || route?.fallback || undefined,
          model: { tier, model: TIERS[tier], in: 0, out: 0, route, calls: [], prompt: given ? clip(given, 6000) : undefined },
          depth: 0,
          ref: { instance: inst, id: p.segId },
        });
        lastModel.set(inst, s);
        needUsage.set(inst, s);
        break;
      }
      case "usage": {
        const s = needUsage.get(inst);
        if (!s?.model) break;
        needUsage.delete(inst);
        const p = e.payload;
        s.model.tier = p.tier;
        s.model.model = TIERS[p.tier];
        s.label = TIER_LABEL[p.tier];
        s.model.in = p.in;
        s.model.out = p.out;
        if (p.cached) s.model.cached = true;
        if (p.ms !== undefined) s.model.ms = p.ms;
        if (p.ttftMs) s.model.ttftMs = p.ttftMs;
        break;
      }
      case "message": {
        const p = e.payload;
        if (p.role === "agent" && !p.card && !p.ackOf && p.id.startsWith(`msg-${inst}-`)) {
          const s = lastModel.get(inst);
          if (s?.model) s.model.output = clip(s.model.output ? `${s.model.output}\n${p.text}` : p.text, 8000);
        } else if (p.role === "user" && p.answerTo) {
          const w = byId.get(p.answerTo);
          if (w?.wait) {
            w.endMs = e.tMs;
            w.wait.decision = p.text;
            w.wait.by = p.via === "auto" ? "the crew" : "you";
            if (p.via && p.via !== "auto") w.wait.via = p.via;
            else if (p.via === "auto") w.wait.via = "auto";
          }
        }
        break;
      }
      case "tool.call": {
        const p = e.payload;
        const parent = lastModel.get(inst);
        // the segment.tool that opened just before this call is its segment; a control tool has none
        const open = openTool.get(inst);
        const seg = open && Math.abs(open.startMs - e.tMs) <= 50 ? open : undefined;
        if (seg) openTool.delete(inst);
        const t = add({
          id: p.callId,
          kind: "tool",
          ...base(inst, e.agent),
          label: toolTitle(p.tool, p.input, seg?.label),
          startMs: e.tMs,
          depth: parent ? 1 : 0,
          parentId: parent?.id,
          control: seg ? undefined : true,
          tool: { name: p.tool, input: p.input },
          ref: { instance: inst, id: seg?.segId ?? parent?.id ?? `${inst}-c-${p.callId}` },
        });
        calls.set(`${inst}:${p.callId}`, t);
        parent?.model?.calls.push({ name: p.tool, input: p.input });
        break;
      }
      case "tool.result": {
        const p = e.payload;
        const t = calls.get(`${inst}:${p.callId}`);
        if (t?.tool) {
          t.endMs = e.tMs;
          t.tool.ok = p.ok;
          t.tool.output = p.output;
          if (!p.ok) t.failed = true;
          const o = p.output && typeof p.output === "object" ? (p.output as Record<string, unknown>) : null;
          if (p.tool === "run_code" && o) {
            if (o.where === "nebius-sandbox" || o.where === "local") t.tool.where = o.where;
            if (typeof o.exitCode === "number") t.tool.exitCode = o.exitCode;
            const sb = o.sandbox as { image?: string; operation?: string; elapsedS?: number | null } | undefined;
            if (sb && o.where === "nebius-sandbox") t.tool.sandbox = { image: sb.image ?? "", operation: sb.operation ?? "", ...(typeof sb.elapsedS === "number" ? { elapsedS: sb.elapsedS } : {}) };
          }
        }
        const list = results.get(inst) ?? [];
        list.push(`${p.tool} → ${clip(show(p.output), 1200)}`);
        results.set(inst, list);
        break;
      }
      case "approval.request": {
        const p = e.payload;
        add({
          id: p.approvalId,
          kind: "wait",
          ...base(inst, e.agent),
          label: `Approval: ${p.action.summary}`,
          startMs: e.tMs,
          depth: 0,
          wait: { what: "approval", text: p.action.summary },
          ref: { instance: inst, id: `ap:${p.approvalId}` },
        });
        break;
      }
      case "approval.resolve": {
        const p = e.payload;
        const w = byId.get(p.approvalId);
        if (w?.wait) {
          w.endMs = e.tMs;
          w.wait.decision = p.decision;
          w.wait.by = p.by;
          if (p.by === "telegram" || p.by === "chat") w.wait.via = p.by;
        }
        break;
      }
      case "question": {
        const p = e.payload;
        add({
          id: p.questionId,
          kind: "wait",
          ...base(inst, e.agent),
          label: `Question: ${clip(p.text, 60)}`,
          startMs: e.tMs,
          depth: 0,
          wait: { what: "question", text: p.text },
          ref: { instance: inst, id: `q:${p.questionId}` },
        });
        break;
      }
      case "plan": {
        if (e.payload.awaiting && !byId.has("gate")) {
          const parent = lastModel.get("orchestrator");
          add({
            id: "gate",
            kind: "gate",
            ...base("orchestrator", "orchestrator"),
            label: "Approval: the plan",
            startMs: e.tMs,
            depth: 0,
            wait: { what: "approval", text: "The plan" },
            ref: { instance: "orchestrator", id: parent?.id ?? "orchestrator-h1" },
          });
        }
        break;
      }
      case "plan.approve": {
        const g = byId.get("gate");
        if (g?.wait && g.endMs === undefined) {
          g.endMs = e.tMs;
          g.wait.decision = "approved";
          g.wait.by = "you";
        }
        break;
      }
      default:
        break;
    }
  }

  // chronological; a model span sorts before the tool calls it asked for
  const order = new Map(spans.map((s, i) => [s, i]));
  spans.sort((a, b) => a.startMs - b.startMs || (order.get(a) ?? 0) - (order.get(b) ?? 0));

  let tokens = 0;
  let waitingMs = 0;
  let longest: Span | null = null;
  let totalMs = lastT;
  for (const s of spans) {
    if (s.endMs !== undefined) totalMs = Math.max(totalMs, s.endMs);
    if (s.model) {
      tokens += s.model.in + s.model.out;
      const dur = s.model.ms ?? (s.endMs !== undefined ? s.endMs - s.startMs : 0);
      const gen = dur - (s.model.ttftMs ?? 0);
      if (!s.model.cached && s.model.out > 0 && gen > 0) s.model.tokPerS = s.model.out / (gen / 1000);
    }
    if (isWaitKind(s) && s.endMs !== undefined) waitingMs += s.endMs - s.startMs;
    if (!s.control && s.endMs !== undefined && (!longest || s.endMs - s.startMs > (longest.endMs ?? 0) - longest.startMs)) longest = s;
  }
  const dur = longest ? (longest.endMs ?? 0) - longest.startMs : 0;
  return {
    runId,
    title,
    startedAt,
    spans,
    totalMs,
    live: !ended && spans.length + events.length > 0,
    longest: dur > 0 ? longest : null,
    longestShare: totalMs > 0 && dur > 0 ? dur / totalMs : 0,
    modelCalls: spans.filter((s) => s.kind === "model").length,
    toolCalls: spans.filter((s) => s.kind === "tool").length,
    waits: spans.filter(isWaitKind).length,
    tokens,
    failed: spans.filter((s) => s.failed).length,
    waitingMs,
  };
}

/* ---------------- formatting ---------------- */

export function fmtDur(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h} h ${m} m` : `${m} m ${s % 60} s`;
}
export function fmtTok(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${k >= 100 ? Math.round(k) : Number(k.toFixed(1))} K`;
}
export const fmtPct = (f: number) => (f > 0 && f < 0.005 ? "< 1 %" : `${Math.round(f * 100)} %`);
/** Axis label for a tick at `sec` seconds: 0, 5s, 1m 30s */
export function fmtAxis(sec: number): string {
  if (sec === 0) return "0";
  if (sec < 60) return `${Number(sec.toFixed(2))}s`;
  const m = Math.floor(sec / 60);
  const r = Math.round(sec % 60);
  return r ? `${m}m ${r}s` : `${m}m`;
}
export const fmtDelta = (ms: number) => `${ms >= 0 ? "+" : "−"}${(Math.abs(ms) / 1000).toFixed(1)} s`;

/* ---------------- the headline ---------------- */

/** "run_code took 7.1 s, 48 % of the run." (a wait: "You took 3 m 20 s to approve, 71 % of the run.") */
export function headline(t: Trace): { text: string; spanId: string } | null {
  const s = t.longest;
  if (!s) return null;
  const d = fmtDur((s.endMs ?? 0) - s.startMs);
  const share = fmtPct(t.longestShare);
  let who: string;
  if (s.kind === "gate") who = `You took ${d} to approve the plan`;
  else if (s.wait?.what === "question") who = `You took ${d} to answer`;
  else if (s.kind === "wait") who = `You took ${d} to approve`;
  else if (s.kind === "tool") who = `${s.tool?.name ?? s.label} took ${d}`;
  else who = `${s.label} took ${d}`;
  return { text: `${who}, ${share} of the run.`, spanId: s.id };
}

/* ---------------- filters ---------------- */

export type TraceFilter = "all" | "slow" | "failed" | "sandbox" | "waiting" | "models" | "tools";
export const FILTERS: { key: TraceFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "slow", label: "Slow" },
  { key: "failed", label: "Failed" },
  { key: "sandbox", label: "Sandbox" },
  { key: "waiting", label: "Waiting on you" },
  { key: "models", label: "Models" },
  { key: "tools", label: "Tools" },
];
export const isFilter = (v: unknown): v is TraceFilter => FILTERS.some((f) => f.key === v);

/** The ids a filter keeps lit; every other span is dimmed, not removed, so the axis never jumps. */
export function filterIds(t: Trace, f: TraceFilter): Set<string> {
  const keep = (p: (s: Span) => boolean) => new Set(t.spans.filter(p).map((s) => s.id));
  switch (f) {
    case "all":
      return keep(() => true);
    case "slow":
      return new Set(
        t.spans
          .filter((s) => s.endMs !== undefined && !s.control)
          .sort((a, b) => spanDur(b) - spanDur(a))
          .slice(0, 3)
          .map((s) => s.id),
      );
    case "failed":
      return keep((s) => !!s.failed);
    case "sandbox":
      return keep((s) => s.tool?.name === "run_code" && s.tool.where === "nebius-sandbox");
    case "waiting":
      return keep(isWaitKind);
    case "models":
      return keep((s) => s.kind === "model");
    case "tools":
      return keep((s) => s.kind === "tool");
  }
}
export const filterCounts = (t: Trace): Record<TraceFilter, number> => Object.fromEntries(FILTERS.map((f) => [f.key, filterIds(t, f.key).size])) as Record<TraceFilter, number>;

/* ---------------- compare with the workstream's earlier run ---------------- */

export type Comparison = { deltas: Map<string, number>; /** > 0: this run was faster */ fasterPct: number | null; excludesWaits: boolean };

/** Spans matched by role, kind, label and order of appearance; the delta is this run's duration minus the earlier one's. */
export function compareTraces(cur: Trace, prev: Trace): Comparison {
  const key = (s: Span) => `${s.kind}|${s.role}|${s.kind === "tool" ? (s.tool?.name ?? s.label) : s.label}`;
  const seen = new Map<string, Span[]>();
  for (const s of prev.spans) if (s.endMs !== undefined) (seen.get(key(s)) ?? seen.set(key(s), []).get(key(s))!).push(s);
  const used = new Map<string, number>();
  const deltas = new Map<string, number>();
  for (const s of cur.spans) {
    if (s.endMs === undefined) continue;
    const k = key(s);
    const n = used.get(k) ?? 0;
    used.set(k, n + 1);
    const p = seen.get(k)?.[n];
    if (p) deltas.set(s.id, spanDur(s) - spanDur(p));
  }
  const excludesWaits = cur.waitingMs > 0 || prev.waitingMs > 0;
  const a = Math.max(1, cur.totalMs - cur.waitingMs);
  const b = Math.max(1, prev.totalMs - prev.waitingMs);
  return { deltas, fasterPct: prev.totalMs > 0 && cur.totalMs > 0 ? (b - a) / b : null, excludesWaits };
}

/* ---------------- what a span says, for the card and for Copy ---------------- */

export const modelOutput = (s: Span) => {
  const m = s.model;
  if (!m) return "";
  const calls = m.calls.map((c) => `${c.name}(${typeof c.input === "string" ? c.input : JSON.stringify(c.input ?? {})})`);
  return [m.output, ...calls].filter(Boolean).join("\n\n");
};
export function runCodeIO(s: Span): { stdout: string; stderr: string } {
  const o = s.tool?.output && typeof s.tool.output === "object" ? (s.tool.output as { stdout?: unknown; stderr?: unknown }) : null;
  return { stdout: typeof o?.stdout === "string" ? o.stdout : "", stderr: typeof o?.stderr === "string" ? o.stderr : "" };
}
export const hasRunCodeIO = (s: Span) => s.tool?.name === "run_code" && !!s.tool.output && typeof s.tool.output === "object";
export const ioBytes = (s: Span) => {
  const io = runCodeIO(s);
  return { stdout: bytes(io.stdout), stderr: bytes(io.stderr) };
};
/** The text Copy puts on the clipboard for the span's default tab */
export function spanCopyText(s: Span, tab?: string): string {
  if (s.model) return tab === "prompt" ? (s.model.prompt ?? "") : modelOutput(s);
  if (s.tool) {
    if (tab === "stdout") return runCodeIO(s).stdout;
    if (tab === "stderr") return runCodeIO(s).stderr;
    if (tab === "input") return show(s.tool.input);
    return s.tool.output === undefined ? "" : show(s.tool.output);
  }
  return s.wait ? [s.label, s.wait.decision && `Decision: ${s.wait.decision}`].filter(Boolean).join("\n") : s.label;
}

/* ---------------- the OpenTelemetry-shaped export ---------------- */

function hex(str: string, bytesN: number): string {
  let out = "";
  for (let i = 0; i < bytesN / 4; i++) {
    let h = (2166136261 ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0;
    for (let c = 0; c < str.length; c++) h = Math.imul(h ^ str.charCodeAt(c), 16777619) >>> 0;
    out += h.toString(16).padStart(8, "0");
  }
  return out;
}
type Attr = { key: string; value: { stringValue: string } | { intValue: string } | { doubleValue: number } | { boolValue: boolean } };
const attr = (key: string, v: string | number | boolean | undefined): Attr[] => {
  if (v === undefined || v === "") return [];
  if (typeof v === "boolean") return [{ key, value: { boolValue: v } }];
  if (typeof v === "number") return [{ key, value: Number.isInteger(v) ? { intValue: String(v) } : { doubleValue: Number(v.toFixed(3)) } }];
  return [{ key, value: { stringValue: v } }];
};
/** epoch ms as a nanosecond string (whole milliseconds, so no BigInt is needed) */
const nano = (epochMs: number) => `${Math.round(epochMs)}000000`;

export type OtelSpan = { spanId: string; parentSpanId: string; name: string; startTimeUnixNano: string; endTimeUnixNano: string; kind: number; status: { code: number }; attributes: Attr[] };
export type OtelTrace = { traceId: string; resource: { attributes: Attr[] }; spans: OtelSpan[] };

export function toOtel(t: Trace): OtelTrace {
  const traceId = hex(t.runId ?? "run", 16);
  const sid = (id: string) => hex(`${t.runId}:${id}`, 8);
  return {
    traceId,
    resource: { attributes: [...attr("service.name", "nimbus"), ...attr("nimbus.run.id", t.runId), ...attr("nimbus.run.title", t.title)] },
    spans: t.spans.map((s) => ({
      spanId: sid(s.id),
      parentSpanId: s.parentId ? sid(s.parentId) : "",
      name: s.kind === "tool" ? (s.tool?.name ?? s.label) : s.label,
      startTimeUnixNano: nano(t.startedAt + s.startMs),
      endTimeUnixNano: nano(t.startedAt + (s.endMs ?? t.totalMs)),
      kind: 1,
      status: { code: s.failed ? 2 : 1 },
      attributes: [
        ...attr("nimbus.span.kind", s.kind),
        ...attr("nimbus.agent", s.agent),
        ...attr("nimbus.role", s.role),
        ...attr("nimbus.instance", s.instance),
        ...attr("nimbus.live", s.endMs === undefined || undefined),
        ...attr("gen_ai.request.model", s.model?.model),
        ...attr("gen_ai.usage.input_tokens", s.model?.in),
        ...attr("gen_ai.usage.output_tokens", s.model?.out),
        ...attr("nimbus.model.tier", s.model?.tier),
        ...attr("nimbus.model.cached", s.model?.cached),
        ...attr("nimbus.model.ttft_ms", s.model?.ttftMs),
        ...attr("nimbus.model.tokens_per_s", s.model?.tokPerS),
        ...attr("nimbus.route.reason", s.model?.route?.reason),
        ...attr("nimbus.tool.name", s.tool?.name),
        ...attr("nimbus.tool.ok", s.tool?.ok),
        ...attr("nimbus.tool.where", s.tool?.where),
        ...attr("nimbus.tool.exit_code", s.tool?.exitCode),
        ...attr("nimbus.sandbox.image", s.tool?.sandbox?.image),
        ...attr("nimbus.sandbox.operation", s.tool?.sandbox?.operation),
        ...attr("nimbus.wait.what", s.wait?.what),
        ...attr("nimbus.wait.decision", s.wait?.decision),
        ...attr("nimbus.wait.via", s.wait?.via),
      ],
    })),
  };
}
