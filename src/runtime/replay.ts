// Replays fixtures/demo-run.events.json as a live run: real-time pacing, and the
// replay pauses at `gate` events until a person answers or approves, exactly like
// the live orchestrator will. Everything after a gate is shifted by how long the
// person took, so lane segments and the playhead stay truthful.
import { readFileSync } from "node:fs";
import path from "node:path";
import type { AnyRunEvent, FixtureEvent, RunEventType, PayloadMap } from "@/lib/events";
import type { AgentRole } from "@/lib/models";
import type { ApprovalDecision, RunHandle, StartRunInput } from "./source";

let FIXTURE_CACHE: FixtureEvent[] | undefined;
const fixture = () => (FIXTURE_CACHE ??= JSON.parse(readFileSync(path.join(process.cwd(), "fixtures", "demo-run.events.json"), "utf8")) as FixtureEvent[]);

type Gate = { kind: "question" | "approval"; id: string; wallAt: number };

export function createReplayRun(input: StartRunInput): RunHandle {
  const id = `run_${crypto.randomUUID().slice(0, 8)}`;
  const startedAt = Date.now();
  const events: AnyRunEvent[] = [];
  const eventFns = new Set<(e: AnyRunEvent) => void>();
  const doneFns = new Set<() => void>();
  let finished = false;
  let idx = 0;
  let shift = 0;
  let gate: Gate | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingAction: PayloadMap["approval.request"]["action"] | undefined;
  let counter = 0;
  let settle!: () => void;
  const settled = new Promise<void>((r) => (settle = r));

  function emit<T extends RunEventType>(
    type: T,
    agent: AgentRole,
    agentInstance: string,
    payload: PayloadMap[T],
    tMs = Date.now() - startedAt,
  ) {
    const e = { id: `${id}-${events.length}`, runId: id, seq: events.length, tMs, agent, agentInstance, type, payload } as AnyRunEvent;
    events.push(e);
    for (const fn of eventFns) fn(e);
  }

  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    for (const fn of doneFns) fn();
    settle();
  }

  function emitFixture(fx: FixtureEvent) {
    const payload = structuredClone(fx.payload) as Record<string, unknown>;
    if (fx.type.startsWith("segment.")) {
      for (const k of ["startMs", "endMs"]) if (typeof payload[k] === "number") payload[k] = (payload[k] as number) + shift;
    }
    if (fx.type === "run.start") {
      payload.title = input.title;
      payload.goal = input.goal;
      payload.workstreamId = input.workstreamId;
      payload.startedAt = startedAt;
    }
    if (fx.type === "approval.request") pendingAction = (payload as PayloadMap["approval.request"]).action;
    emit(fx.type, fx.agent, fx.agentInstance, payload as never, fx.tMs + shift);
  }

  function tick() {
    clearTimeout(timer);
    if (finished || gate) return;
    while (idx < fixture().length) {
      const fx = fixture()[idx];
      const delay = startedAt + fx.tMs + shift - Date.now();
      if (delay > 0) {
        timer = setTimeout(tick, delay);
        return;
      }
      idx++;
      emitFixture(fx);
      if (fx.gate) {
        const p = fx.payload as { questionId?: string; approvalId?: string };
        gate = { kind: fx.gate, id: (fx.gate === "question" ? p.questionId : p.approvalId) ?? "", wallAt: Date.now() };
        return;
      }
    }
    finish();
  }

  function release() {
    if (!gate) return;
    // Everything after the gate moves later by how long the person took.
    shift += Date.now() - gate.wallAt;
    gate = null;
    tick();
  }

  const nextId = () => `m-${id}-${++counter}`;

  const run: RunHandle = {
    id,
    workstreamId: input.workstreamId,
    startedAt,
    events,
    get finished() {
      return finished;
    },
    settled,
    onEvent(fn) {
      eventFns.add(fn);
      return () => eventFns.delete(fn);
    },
    onDone(fn) {
      doneFns.add(fn);
      return () => doneFns.delete(fn);
    },
    resolveApproval(approvalId: string, d: ApprovalDecision) {
      if (finished || !gate || gate.kind !== "approval" || gate.id !== approvalId) return false;
      emit("approval.resolve", "orchestrator", "orchestrator", {
        approvalId,
        decision: d.decision,
        by: "you",
        always: d.always,
        note: d.note,
      });
      if (d.always && d.decision === "approved" && pendingAction) {
        const scope = (pendingAction.details as { channel?: string } | undefined)?.channel;
        emit("policy", "orchestrator", "orchestrator", {
          rule: `allow: ${pendingAction.kind}${scope ? ` to ${scope}` : ""} for this workstream`,
        });
      }
      if (d.decision === "rejected" && d.note) {
        emit("message", "orchestrator", "user", { id: nextId(), role: "user", text: d.note });
      }
      release();
      return true;
    },
    postMessage({ text, kind, questionId }) {
      if (finished) return false;
      if (kind === "answer") {
        if (!gate || gate.kind !== "question" || (questionId && gate.id !== questionId)) return false;
        emit("message", "orchestrator", "user", { id: nextId(), role: "user", text, answerTo: gate.id });
        release();
        return true;
      }
      const msgId = nextId();
      emit("message", "orchestrator", "user", { id: msgId, role: "user", text, queued: true });
      // Delivered at the orchestrator's next turn boundary (never mid-tool).
      setTimeout(() => {
        if (finished) return;
        emit("message", "orchestrator", "orchestrator", {
          id: nextId(),
          role: "agent",
          text: `Noted: "${text.length > 70 ? `${text.slice(0, 70)}…` : text}". I'll pass it to the next step.`,
          ackOf: msgId,
        });
      }, 2500);
      return true;
    },
    stop(reason) {
      if (finished) return;
      clearTimeout(timer);
      if (gate?.kind === "approval") {
        emit("approval.resolve", "orchestrator", "orchestrator", { approvalId: gate.id, decision: "rejected", by: "system", note: "Run stopped" });
      }
      gate = null;
      emit("run.end", "orchestrator", "orchestrator", { status: reason === "cancel" ? "cancelled" : "stopped" });
      finish();
    },
  };

  tick();
  return run;
}
