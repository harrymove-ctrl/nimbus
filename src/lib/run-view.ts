// Pure reducer: the full RunEvent[] → everything the run view draws. The UI keeps no
// other run state, so a refresh (replay from seq 0) rebuilds the same screen.
import type { AnyRunEvent, PlanAgent, PlanStep, ProposedAction, RunEndStatus, RunSummary } from "./events";
import { costUsd, roleTier, type AgentRole, type Tier } from "./models";
import { roleTitle } from "./roles";

export type RouteInfo = { hop: number; chosen: Tier; ceiling: Tier; reason: string; fallback?: boolean };

export type Seg = {
  id: string;
  instance: string;
  kind: "think" | "tool" | "wait";
  label: string;
  startMs: number;
  endMs?: number;
  failed?: boolean;
  route?: RouteInfo;
};

export type Lane = {
  instance: string;
  role: AgentRole;
  spawnedAt?: number;
  spawnedBy?: string;
  brief?: string;
  startedAt?: number;
  endedAt?: number;
  status: "pending" | "running" | "done" | "error";
  segments: Seg[];
  tokens: number;
  costUsd: number;
  tier: Tier;
  ceiling: Tier;
  routed: boolean;
  /** the latest routed-below-ceiling or fallback hop, for the legend hover */
  routeReason?: string;
  fellBack?: boolean;
};

export type ToolCall = { callId: string; instance: string; tool: string; input: unknown; startMs: number; endMs?: number; ok?: boolean; output?: unknown };
export type UsageRow = { instance: string; tMs: number; tier: Tier; in: number; out: number };

export type Artifact = {
  id: string;
  kind: "doc" | "code";
  title: string;
  language?: string;
  versions: { version: number; content: string; tMs: number; title: string }[];
};

export type TItem =
  | { t: "user"; seq: number; tMs: number; id: string; text: string; queued: boolean; via?: "chat" | "telegram" | "auto" }
  | { t: "agent"; seq: number; tMs: number; instance: string; role: AgentRole; text: string }
  | { t: "plan"; seq: number; tMs: number; agents: PlanAgent[]; tools: string[]; estimate: { costUsd: number; tokens: number; label: string }; steps: PlanStep[]; /** a person is reviewing this draft */ awaiting: boolean; approved: boolean; edited: boolean; revision: number; /** when the person approved it (ms since run start) */ approvedMs?: number }
  | { t: "handoff"; seq: number; tMs: number; from: string; to: string; context: string }
  | { t: "question"; seq: number; tMs: number; instance: string; role: AgentRole; questionId: string; text: string; options?: string[]; answer?: string }
  | { t: "approval"; seq: number; tMs: number; approvalId: string; action: ProposedAction; status: "pending" | "approved" | "rejected"; always?: boolean; note?: string; by?: string; resolvedMs?: number }
  | { t: "policy"; seq: number; tMs: number; rule: string }
  | { t: "artifact"; seq: number; tMs: number; artifactId: string; title: string; version: number; kind: "doc" | "code" }
  | { t: "summary"; seq: number; tMs: number; summary: RunSummary }
  | { t: "end"; seq: number; tMs: number; status: RunEndStatus }
  | { t: "error"; seq: number; tMs: number; message: string; spentUsd?: number; capUsd?: number };

export type ApprovalItem = Extract<TItem, { t: "approval" }>;
export type QuestionItem = Extract<TItem, { t: "question" }>;
export type PlanItem = Extract<TItem, { t: "plan" }>;

export type ViewStatus = "idle" | "planning" | "running" | "asked" | "waiting" | "done" | "failed" | "cancelled" | "stopped";

export type RunView = {
  runId?: string;
  title: string;
  goal: string;
  startedAt: number;
  /** what started the run: a person, the scheduler, a chat app, a job */
  trigger?: "manual" | "cron" | "chat" | "telegram" | "job";
  status: ViewStatus;
  /** true until run.end (the learner may still run after it) */
  active: boolean;
  endedMs?: number;
  lastTMs: number;
  spawned: boolean;
  lanes: Lane[];
  connectors: { from: string; to: string; tMs: number }[];
  transcript: TItem[];
  pendingApprovals: ApprovalItem[];
  openQuestion?: QuestionItem;
  plan?: PlanItem;
  /** per plan step: where it is, and when it started and ended (ms since run start) */
  stepState: Record<string, { state: "pending" | "running" | "done" | "failed"; startMs?: number; endMs?: number }>;
  /** the run is waiting for the person to approve the draft plan */
  planAwaiting: boolean;
  /** the person paused the crew */
  paused: boolean;
  artifacts: Artifact[];
  policies: string[];
  summary?: RunSummary;
  toolCalls: ToolCall[];
  usage: UsageRow[];
  tokens: number;
  costUsd: number;
  baselineUsd: number;
  /** 0..1 saved vs pricing every hop at its ceiling tier; null until there is spend */
  savings: number | null;
  routedHops: number;
  /** memories and policy lines this run loaded from earlier runs (the "learned" chip) */
  learned?: { memories: number; policies: number };
  /** the run stopped because its spend passed NIMBUS_RUN_CAP_USD (header pill "Cap hit") */
  capHit: boolean;
  error?: string;
};

/**
 * A lookup that answers for any role: the built-in crew from the table, a role the workstream named itself (a tutor, a
 * scout) from `fallback`. Only the built-in keys are enumerable, so a legend still lists the five it always listed.
 */
const anyRole = (known: Record<string, string>, fallback: (role: string) => string): Record<AgentRole, string> =>
  new Proxy(known, { get: (t, k) => (typeof k === "string" && !(k in t) && k !== "then" && k !== "toJSON" && !k.startsWith("$$") ? fallback(k) : Reflect.get(t, k)) });

export const ROLE_LABEL: Record<AgentRole, string> = anyRole(
  {
    orchestrator: "Orchestrator",
    researcher: "Researcher",
    analyst: "Analyst",
    writer: "Writer",
    checker: "Checker",
    learner: "Learner",
  },
  roleTitle,
);

export const TIER_LABEL: Record<Tier, string> = { ultra: "Nemotron 3 Ultra", super: "Nemotron 3 Super", nano: "Nemotron 3 Nano" };
export const TIER_SHORT: Record<Tier, string> = { ultra: "Ultra", super: "Super", nano: "Nano" };

/** Agent colors (sketch Part 3): the only places color carries meaning besides the cloud. */
export const ROLE_COLOR: Record<AgentRole, string> = anyRole(
  {
    orchestrator: "var(--color-neutral-300)",
    checker: "oklch(0.72 0.14 250)",
    researcher: "oklch(0.72 0.15 305)",
    analyst: "oklch(0.78 0.15 60)",
    writer: "oklch(0.78 0.11 190)",
    learner: "var(--rb-accent)",
  },
  (role) => `oklch(0.76 0.14 ${CUSTOM_HUES[hashOf(role) % CUSTOM_HUES.length]})`,
);

/** Hues for roles a workstream named itself, away from the built-in five so a tutor never reads as the Checker. */
const CUSTOM_HUES = [25, 95, 140, 340, 280, 165, 0, 115];
function hashOf(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export const laneName = (instance: string, role: AgentRole) => {
  const n = instance.match(/-(\d+)$/)?.[1];
  return n && n !== "1" ? `${ROLE_LABEL[role]} ${n}` : ROLE_LABEL[role];
};

const STATUS_MAP: Record<RunEndStatus, ViewStatus> = { done: "done", failed: "failed", cancelled: "cancelled", stopped: "stopped" };

export function buildView(events: AnyRunEvent[]): RunView {
  const v: RunView = {
    title: "",
    goal: "",
    startedAt: 0,
    status: "idle",
    active: false,
    lastTMs: 0,
    spawned: false,
    lanes: [],
    connectors: [],
    transcript: [],
    pendingApprovals: [],
    stepState: {},
    planAwaiting: false,
    paused: false,
    artifacts: [],
    policies: [],
    toolCalls: [],
    usage: [],
    tokens: 0,
    costUsd: 0,
    baselineUsd: 0,
    savings: null,
    routedHops: 0,
    capHit: false,
  };
  const lanes = new Map<string, Lane>();
  const segs = new Map<string, Seg>();
  const pendingRoute = new Map<string, RouteInfo>();
  const calls = new Map<string, ToolCall>();
  const artifacts = new Map<string, Artifact>();
  const userMsgs = new Map<string, Extract<TItem, { t: "user" }>>();
  const questions = new Map<string, QuestionItem>();
  const approvals = new Map<string, ApprovalItem>();
  let endStatus: RunEndStatus | undefined;

  const lane = (instance: string, role: AgentRole): Lane => {
    let l = lanes.get(instance);
    if (!l) {
      l = { instance, role, status: "pending", segments: [], tokens: 0, costUsd: 0, tier: roleTier(role), ceiling: roleTier(role), routed: false };
      lanes.set(instance, l);
      v.lanes.push(l);
    }
    return l;
  };
  const openSeg = (instance: string, role: AgentRole, id: string, kind: Seg["kind"], label: string, startMs: number) => {
    const s: Seg = { id, instance, kind, label, startMs };
    const r = pendingRoute.get(instance);
    if (r && kind !== "wait") {
      s.route = r;
      pendingRoute.delete(instance);
    }
    segs.set(`${instance}:${id}`, s);
    lane(instance, role).segments.push(s);
    return s;
  };
  const closeOpen = (l: Lane, tMs: number) => {
    for (const s of l.segments) if (s.endMs === undefined) s.endMs = tMs;
  };

  for (const e of events) {
    v.lastTMs = Math.max(v.lastTMs, e.tMs);
    v.runId = e.runId;
    switch (e.type) {
      case "run.start": {
        const p = e.payload;
        v.title = p.title;
        v.goal = p.goal;
        v.startedAt = p.startedAt;
        v.trigger = p.trigger;
        v.learned = p.learned;
        v.active = true;
        lane("orchestrator", "orchestrator");
        break;
      }
      case "run.end": {
        endStatus = e.payload.status;
        v.endedMs = e.tMs;
        v.active = false;
        for (const l of v.lanes) if (l.status !== "pending") closeOpen(l, e.tMs);
        if (e.payload.status === "cancelled" || e.payload.status === "stopped") {
          for (const l of v.lanes) if (l.status === "running" || l.status === "pending") l.status = "done";
          v.transcript.push({ t: "end", seq: e.seq, tMs: e.tMs, status: e.payload.status });
        } else {
          const o = lanes.get("orchestrator");
          if (o) {
            o.status = "done";
            o.endedAt = e.tMs;
          }
        }
        break;
      }
      case "run.error": {
        const p = e.payload;
        v.error = p.message;
        v.capHit = p.kind === "spend_cap";
        v.transcript.push({ t: "error", seq: e.seq, tMs: e.tMs, message: p.message, spentUsd: p.spentUsd, capUsd: p.capUsd });
        break;
      }
      case "agent.spawn": {
        const p = e.payload;
        const l = lane(p.instance, p.role);
        l.spawnedAt = e.tMs;
        l.spawnedBy = p.by;
        l.brief = p.brief;
        v.spawned = true;
        v.connectors.push({ from: p.by, to: p.instance, tMs: e.tMs });
        break;
      }
      case "agent.start": {
        const l = lane(e.agentInstance, e.agent);
        l.status = "running";
        l.startedAt ??= e.tMs;
        break;
      }
      case "agent.end":
      case "agent.error": {
        const l = lane(e.agentInstance, e.agent);
        closeOpen(l, e.tMs);
        l.status = e.type === "agent.end" ? "done" : "error";
        l.endedAt = e.tMs;
        if (e.type === "agent.error") {
          const last = l.segments[l.segments.length - 1];
          if (last) last.failed = true;
        }
        break;
      }
      case "segment.think":
      case "segment.tool":
      case "segment.wait": {
        const p = e.payload;
        const kind = e.type.slice(8) as Seg["kind"];
        const key = `${e.agentInstance}:${p.segId}`;
        const s = segs.get(key) ?? openSeg(e.agentInstance, e.agent, p.segId, kind, p.label, p.startMs ?? e.tMs);
        if (p.endMs !== undefined) s.endMs = p.endMs;
        if (p.failed) s.failed = true;
        break;
      }
      case "tool.call": {
        const p = e.payload;
        const c: ToolCall = { callId: p.callId, instance: e.agentInstance, tool: p.tool, input: p.input, startMs: e.tMs };
        calls.set(p.callId, c);
        v.toolCalls.push(c);
        break;
      }
      case "tool.result": {
        const c = calls.get(e.payload.callId);
        if (c) {
          c.endMs = e.tMs;
          c.ok = e.payload.ok;
          c.output = e.payload.output;
        }
        break;
      }
      case "route": {
        const p = e.payload;
        const info: RouteInfo = { hop: p.hop, chosen: p.chosen, ceiling: p.ceiling, reason: p.reason, fallback: p.fallback };
        pendingRoute.set(e.agentInstance, info);
        const l = lane(e.agentInstance, e.agent);
        l.tier = p.chosen;
        l.ceiling = p.ceiling;
        if (p.chosen !== p.ceiling || p.fallback) {
          l.routed = true;
          l.routeReason = p.reason;
          l.fellBack = l.fellBack || !!p.fallback;
          v.routedHops++;
        }
        break;
      }
      case "usage": {
        const p = e.payload;
        const l = lane(e.agentInstance, e.agent);
        // A cache hit skipped the call: tokens are shown, nothing is billed (cost and baseline both 0).
        const c = p.cached ? 0 : costUsd(p.tier, p.in, p.out);
        l.tokens += p.in + p.out;
        l.costUsd += c;
        v.tokens += p.in + p.out;
        v.costUsd += c;
        v.baselineUsd += p.cached ? 0 : costUsd(l.ceiling, p.in, p.out);
        v.usage.push({ instance: e.agentInstance, tMs: e.tMs, tier: p.tier, in: p.in, out: p.out });
        break;
      }
      case "plan": {
        const p = e.payload;
        const steps = p.steps ?? p.agents.map((a, i) => ({ id: `s${i + 1}`, text: `${ROLE_LABEL[a.role]}: ${a.brief}`, role: a.role, tier: a.tier }));
        const item: PlanItem = { t: "plan", seq: e.seq, tMs: e.tMs, agents: p.agents, tools: p.tools, estimate: p.estimate, steps, awaiting: !!p.awaiting, approved: false, edited: false, revision: p.revision ?? 0 };
        // a revised plan replaces the draft it revises (same card, new revision)
        const at = v.plan && !v.plan.approved ? v.transcript.indexOf(v.plan) : -1;
        if (at >= 0) v.transcript[at] = item;
        else v.transcript.push(item);
        v.plan = item;
        for (const s of steps) v.stepState[s.id] ??= { state: "pending" };
        break;
      }
      case "plan.approve": {
        if (v.plan) {
          v.plan.steps = e.payload.steps;
          v.plan.awaiting = false;
          v.plan.approved = true;
          v.plan.approvedMs = e.tMs;
          v.plan.edited = e.payload.edited;
          v.stepState = Object.fromEntries(e.payload.steps.map((s) => [s.id, { state: "pending" as const }]));
        }
        break;
      }
      case "plan.revise":
        break;
      case "run.pause":
        v.paused = e.payload.paused;
        break;
      case "step": {
        const s = (v.stepState[e.payload.stepId] ??= { state: "pending" });
        s.state = e.payload.state;
        if (e.payload.state === "running") s.startMs = e.tMs;
        else s.endMs = e.tMs;
        break;
      }
      case "handoff":
        v.transcript.push({ t: "handoff", seq: e.seq, tMs: e.tMs, ...e.payload });
        break;
      case "question": {
        const p = e.payload;
        const q: QuestionItem = { t: "question", seq: e.seq, tMs: e.tMs, instance: e.agentInstance, role: e.agent, questionId: p.questionId, text: p.text, options: p.options };
        questions.set(p.questionId, q);
        v.transcript.push(q);
        openSeg(e.agentInstance, e.agent, `q:${p.questionId}`, "wait", "Waiting for you", e.tMs);
        break;
      }
      case "approval.request": {
        const p = e.payload;
        const a: ApprovalItem = { t: "approval", seq: e.seq, tMs: e.tMs, approvalId: p.approvalId, action: p.action, status: "pending" };
        approvals.set(p.approvalId, a);
        v.transcript.push(a);
        openSeg(e.agentInstance, e.agent, `ap:${p.approvalId}`, "wait", "Waiting for approval", e.tMs);
        break;
      }
      case "approval.resolve": {
        const p = e.payload;
        const a = approvals.get(p.approvalId);
        if (a) {
          a.status = p.decision;
          a.always = p.always;
          a.note = p.note;
          a.by = p.by;
          a.resolvedMs = e.tMs;
        }
        const s = segs.get(`${e.agentInstance}:ap:${p.approvalId}`);
        if (s) s.endMs = e.tMs;
        break;
      }
      case "policy":
        v.policies.push(e.payload.rule);
        v.transcript.push({ t: "policy", seq: e.seq, tMs: e.tMs, rule: e.payload.rule });
        break;
      case "artifact.version": {
        const p = e.payload;
        let a = artifacts.get(p.artifactId);
        if (!a) {
          a = { id: p.artifactId, kind: p.kind, title: p.title, language: p.language, versions: [] };
          artifacts.set(p.artifactId, a);
          v.artifacts.push(a);
        }
        a.title = p.title;
        a.versions.push({ version: p.version, content: p.content, tMs: e.tMs, title: p.title });
        v.transcript.push({ t: "artifact", seq: e.seq, tMs: e.tMs, artifactId: p.artifactId, title: p.title, version: p.version, kind: p.kind });
        break;
      }
      case "message": {
        const p = e.payload;
        if (p.card === "summary" && p.summary) {
          v.summary = p.summary;
          v.transcript.push({ t: "summary", seq: e.seq, tMs: e.tMs, summary: p.summary });
        } else if (p.role === "user") {
          const m = { t: "user" as const, seq: e.seq, tMs: e.tMs, id: p.id, text: p.text, queued: !!p.queued, ...(p.via ? { via: p.via } : {}) };
          userMsgs.set(p.id, m);
          v.transcript.push(m);
          if (p.answerTo) {
            const q = questions.get(p.answerTo);
            if (q) {
              q.answer = p.text;
              const s = segs.get(`${q.instance}:q:${q.questionId}`);
              if (s) s.endMs = e.tMs;
            }
          }
        } else {
          if (p.ackOf) {
            const m = userMsgs.get(p.ackOf);
            if (m) m.queued = false;
          }
          v.transcript.push({ t: "agent", seq: e.seq, tMs: e.tMs, instance: e.agentInstance, role: e.agent, text: p.text });
        }
        break;
      }
    }
  }

  v.pendingApprovals = [...approvals.values()].filter((a) => a.status === "pending");
  v.openQuestion = [...questions.values()].find((q) => q.answer === undefined);
  v.artifacts.sort((a, b) => a.id.localeCompare(b.id));
  v.savings = v.baselineUsd > 0 ? Math.max(0, 1 - v.costUsd / v.baselineUsd) : null;

  v.planAwaiting = !!v.plan?.awaiting && !endStatus;
  if (v.startedAt === 0) v.status = "idle";
  else if (endStatus) v.status = STATUS_MAP[endStatus];
  else if (v.openQuestion) v.status = "asked";
  else if (v.pendingApprovals.length > 0 || v.plan?.awaiting) v.status = "waiting";
  else if (v.spawned) v.status = "running";
  else v.status = "planning";
  return v;
}

export const fmtSecs = (ms: number) => `${(Math.max(0, ms) / 1000).toFixed(1)}s`;
export const fmtTokens = (n: number) => n.toLocaleString("en-US");
export const fmtCost = (n: number) => `$${n < 0.1 ? n.toFixed(3) : n.toFixed(2)}`;
/** Legend: three decimals, an em dash when nothing was spent. */
export const fmtCost3 = (n: number) => (n > 0 ? `$${n.toFixed(3)}` : "—");
