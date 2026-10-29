// Run events as terminal lines, and a run as the short status a phone (or a coding agent) reads.
import type { AnyRunEvent } from "../lib/events";
import { buildView, fmtCost, laneName, ROLE_LABEL, TIER_SHORT, type Artifact, type RunView } from "../lib/run-view";
import type { AgentRole } from "../lib/models";
import { runLink } from "./env";

const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: string) => (s: string) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
export const c = { dim: paint("2"), bold: paint("1"), green: paint("32"), red: paint("31"), yellow: paint("33"), cyan: paint("36") };

export const short = (v: unknown, n = 90) => {
  const s = String(typeof v === "string" ? v : JSON.stringify(v)).replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};

const lane = (e: AnyRunEvent) => (e.agent in ROLE_LABEL ? laneName(e.agentInstance, e.agent as AgentRole) : e.agentInstance === "user" ? "You" : e.agentInstance);

/** crew moves that have their own timeline line (plan, question, approval, handoff, artifact), so the call is not shown */
const OWN_LINE = new Set(["plan", "ask_user", "request_approval", "handoff", "write_artifact", "spawn_agents", "finish", "save_learning"]);

/** what one event says on the timeline, or null for the ones a reader does not need (usage, segments, starts) */
function said(e: AnyRunEvent, before: AnyRunEvent[]): string | null {
  switch (e.type) {
    case "plan":
      return `plan${e.payload.revision ? ` (revision ${e.payload.revision})` : ""}: ${e.payload.agents.map((a) => ROLE_LABEL[a.role]).join(", ")} · ${e.payload.estimate.label}`;
    case "plan.approve":
      return `plan approved${e.payload.edited ? " (edited)" : ""}`;
    case "agent.spawn":
      return `joins (brief from ${e.payload.by}): ${short(e.payload.brief, 70)}`;
    case "agent.end": {
      // the summary usually repeats what the agent just said
      const spoke = before.some((x) => x.type === "message" && x.agentInstance === e.agentInstance && x.payload.role === "agent" && !x.payload.card);
      return e.payload.summary && !spoke ? `done: ${short(e.payload.summary, 90)}` : "done";
    }
    case "agent.error":
      return c.red(`error: ${short(e.payload.message, 100)}`);
    case "tool.call":
      return OWN_LINE.has(e.payload.tool) ? null : `→ ${e.payload.tool} ${c.dim(short(e.payload.input, 60))}`;
    case "tool.result":
      return e.payload.ok ? null : c.red(`✗ ${e.payload.tool} failed: ${short(e.payload.output, 80)}`);
    case "route":
      return e.payload.fallback || e.payload.chosen !== e.payload.ceiling ? c.dim(`routed to ${TIER_SHORT[e.payload.chosen]} (ceiling ${TIER_SHORT[e.payload.ceiling]})${e.payload.fallback ? ", fallback" : ""}: ${short(e.payload.reason, 60)}`) : null;
    case "message":
      if (e.payload.card === "summary" && e.payload.summary) {
        const s = e.payload.summary;
        const add = s.skillDiff.filter((d) => d.op === "+").length;
        const del = s.skillDiff.filter((d) => d.op === "-").length;
        return c.cyan(`learned: ${s.memories.length} memor${s.memories.length === 1 ? "y" : "ies"}, SKILL.md +${add} −${del}`);
      }
      if (e.payload.queued) return null;
      return e.payload.role === "user" ? `you: ${short(e.payload.text, 100)}` : `says: ${short(e.payload.text, 110)}`;
    case "handoff":
      return `hands off to ${e.payload.to}`;
    case "artifact.version":
      return `artifact ${e.payload.kind} "${short(e.payload.title, 50)}" v${e.payload.version}`;
    case "approval.request":
      return c.yellow(`approval needed (${e.payload.action.risk} risk): ${short(e.payload.action.summary, 80)}`);
    case "approval.resolve":
      return `${e.payload.approvalId} ${e.payload.decision}${e.payload.always ? " (always)" : ""} by ${e.payload.by}${e.payload.note ? `: ${short(e.payload.note, 60)}` : ""}`;
    case "question":
      return c.yellow(`asks: ${e.payload.text}`);
    case "policy":
      return c.cyan(`new rule: ${short(e.payload.rule, 90)}`);
    case "run.pause":
      return e.payload.paused ? "paused" : "resumed";
    case "run.error":
      return c.red(`run error: ${e.payload.message}`);
    case "run.end":
      return (e.payload.status === "done" ? c.green : c.red)(`run ${e.payload.status}`);
    default:
      return null;
  }
}

/**
 * Feeds events in order; `line` gives the timeline row for the newest one:
 *   "  12.3s  Analyst        Super  $0.012  → run_code {…}"  (time, lane, its model tier, the run's spend so far)
 */
export class Timeline {
  events: AnyRunEvent[] = [];
  push(e: AnyRunEvent) {
    this.events.push(e);
  }
  view(): RunView {
    return buildView(this.events);
  }
  line(e: AnyRunEvent): string | null {
    const text = said(e, this.events);
    if (text === null) return null;
    const v = this.view();
    const l = v.lanes.find((x) => x.instance === e.agentInstance);
    const tier = l ? TIER_SHORT[l.tier] : "";
    return `${c.dim(`${(e.tMs / 1000).toFixed(1).padStart(6)}s`)}  ${lane(e).padEnd(14)} ${tier.padEnd(5)} ${c.dim(fmtCost(v.costUsd).padStart(6))}  ${text}`;
  }
}

/** the artifact a reader wants: the newest doc, else the newest code */
export function mainArtifact(v: RunView): (Artifact & { latest: Artifact["versions"][number] }) | undefined {
  const pick = [...v.artifacts].reverse().find((a) => a.kind === "doc") ?? v.artifacts[v.artifacts.length - 1];
  const latest = pick?.versions[pick.versions.length - 1];
  return pick && latest ? { ...pick, latest } : undefined;
}

export type Waiting = { kind: "plan"; id: "plan"; text: string; steps: string[] } | { kind: "approval"; id: string; text: string; risk: string; details: unknown } | { kind: "question"; id: string; text: string; options: string[] };

/** what the run waits for the person on, if anything: the plan first, then the oldest approval, then the question */
export function waitingOn(v: RunView): Waiting | undefined {
  if (v.planAwaiting && v.plan) return { kind: "plan", id: "plan", text: `approve the plan: ${v.plan.agents.map((a) => ROLE_LABEL[a.role]).join(", ")}, ${v.plan.estimate.label}`, steps: v.plan.steps.map((s) => `${ROLE_LABEL[s.role]}: ${s.text}`) };
  const ap = v.pendingApprovals[0];
  if (ap) return { kind: "approval", id: ap.approvalId, text: ap.action.summary, risk: ap.action.risk, details: ap.action.details };
  if (v.openQuestion) return { kind: "question", id: v.openQuestion.questionId, text: v.openQuestion.text, options: v.openQuestion.options ?? [] };
  return undefined;
}

/** the run as structured JSON, the same shape every MCP tool and `nimbus status --json` returns */
export function runJson(runId: string, v: RunView) {
  const art = mainArtifact(v);
  return {
    run_id: runId,
    title: v.title,
    status: v.status,
    ended: !v.active,
    end_status: v.active ? null : v.status,
    cost_usd: Number(v.costUsd.toFixed(4)),
    tokens: v.tokens,
    elapsed_s: Number((v.lastTMs / 1000).toFixed(1)),
    waiting: waitingOn(v) ?? null,
    lanes: v.lanes.map((l) => ({ lane: laneName(l.instance, l.role), tier: l.tier, status: l.status, cost_usd: Number(l.costUsd.toFixed(4)) })),
    artifact: art ? { title: art.latest.title, kind: art.kind, version: art.latest.version } : null,
    error: v.error ?? null,
    url: runLink(runId),
  };
}

/** phone length, numbers first: "$0.031 · 14.2s · waiting · approval ap-1: Send summary to #growth" */
export function runLine(runId: string, v: RunView): string {
  const w = waitingOn(v);
  const head = `${fmtCost(v.costUsd)} · ${(v.lastTMs / 1000).toFixed(1)}s · ${v.status}`;
  const tail = w ? (w.kind === "plan" ? `plan waiting for you (${v.plan?.steps.length ?? 0} steps)` : w.kind === "approval" ? `approval ${w.id} (${w.risk}): ${short(w.text, 70)}` : `question ${w.id}: ${short(w.text, 70)}${w.options.length ? ` [${w.options.map((o, i) => `${i + 1}) ${o}`).join(" ")}]` : ""}`) : "";
  return `${head}${tail ? ` · ${tail}` : ""}\n${v.title || runId} · ${runId}`;
}
