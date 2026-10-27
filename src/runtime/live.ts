// The live runtime behind RunHandle (the same interface replay.ts implements, so the UI and API routes do not change).
// Mock model by default (NIMBUS_MODEL=mock); NIMBUS_MODEL=nebius switches to Token Factory.
import path from "node:path";
import { eq } from "drizzle-orm";
import { dataDir, getDb, retryBusy, schema } from "@/db";
import type { AnyRunEvent, PayloadMap, ProposedAction, RunEventType } from "@/lib/events";
import type { AgentRole } from "@/lib/models";
import { modelMode } from "@/lib/tokenfactory";
import { SpendCapError, inflight } from "./budget";
import { RunAborted, deferred, untilAborted, type ApprovalResult, type RunCtx } from "./context";
import { runLearner } from "./learner";
import { writeRecording } from "./recorder";
import { topMemories } from "./memory";
import { runOrchestrator } from "./orchestrator";
import { appendPolicy, countPolicyUse, loadSkill, policyAllows, policySection, ruleFor } from "./skills";
import type { ApprovalDecision, RunHandle, StartRunInput } from "./source";

export function createLiveRun(input: StartRunInput): RunHandle {
  const id = `run_${crypto.randomUUID().slice(0, 8)}`;
  const startedAt = Date.now();
  const events: AnyRunEvent[] = [];
  const eventFns = new Set<(e: AnyRunEvent) => void>();
  const doneFns = new Set<() => void>();
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(5 * 60_000)]); // wall-clock cap
  let finished = false;
  let persistChain: Promise<unknown> = Promise.resolve();
  let n = 0;

  const persist = (fn: (db: Awaited<ReturnType<typeof getDb>>) => Promise<unknown>) => {
    persistChain = persistChain.then(async () => retryBusy(async () => fn(await getDb()))).catch((e) => console.error("[nimbus] persist failed:", e instanceof Error ? e.message : e));
  };

  function emit<T extends RunEventType>(type: T, agent: AgentRole, agentInstance: string, payload: PayloadMap[T]) {
    const e = { id: `${id}-${events.length}`, runId: id, seq: events.length, tMs: Date.now() - startedAt, agent, agentInstance, type, payload } as AnyRunEvent;
    events.push(e);
    for (const fn of eventFns) fn(e);
    persist((db) => db.insert(schema.runEvents).values({ id: e.id, runId: id, seq: e.seq, tMs: e.tMs, agent, agentInstance, type, payload: payload as never }));
  }

  // ----- approvals, questions and steering are deferreds the HTTP routes (or the CLI) resolve -----
  const pendingApprovals = new Map<string, { d: ReturnType<typeof deferred<ApprovalResult>>; action: ProposedAction; who: { role: AgentRole; instance: string } }>();
  const pendingQuestions = new Map<string, { d: ReturnType<typeof deferred<string>>; role: AgentRole; instance: string }>();
  const steering: { id: string; text: string }[] = [];

  const ctx: RunCtx = {
    runId: id,
    workstreamId: input.workstreamId,
    goal: input.goal,
    mode: input.mode ?? "ask",
    allowedTools: input.tools ?? ["web_search", "fetch_url", "run_code", "write_artifact", "send_message", "read_repo", "open_pr"],
    tierChoice: input.tier ?? "auto",
    startedAt,
    workspace: path.join(dataDir(), "workspaces", id),
    signal,
    emit,
    script: input.workstreamId,
    skill: "",
    memories: [],
    hop: 0,
    routedHops: 0,
    usage: { in: 0, out: 0, costUsd: 0, baselineUsd: 0 },
    artifactVersions: new Map(),
    artifactContent: new Map(),
    instances: new Set(["orchestrator"]),
    async askUser(instance, role, text, options) {
      const questionId = `q-${++n}`;
      const d = deferred<string>();
      pendingQuestions.set(questionId, { d, role, instance });
      emit("question", role, instance, { questionId, text, options });
      const answer = await untilAborted(d.promise, signal);
      // mock mode: the first answer picks the script variant ("Golden" → ws-ship-nimbus+golden, where that directory exists)
      const slug = answer.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);
      if (slug && !ctx.script.includes("+")) ctx.script += `+${slug}`;
      return answer;
    },
    async requestApproval(action, who) {
      const approvalId = `ap-${++n}`;
      const auto = policyAllows(ctx.skill, action) ? "policy" : ctx.mode === "auto-low" && action.risk === "low" ? "mode" : null;
      // Register before emitting: a synchronous listener (the CLI's --yes) may resolve inside emit().
      const d = deferred<ApprovalResult>();
      if (!auto) pendingApprovals.set(approvalId, { d, action, who });
      if (auto === "policy") persist(() => countPolicyUse(input.workstreamId, ctx.skill, action));
      emit("approval.request", who.role, who.instance, { approvalId, action });
      persist((db) => db.insert(schema.approvals).values({ id: `${id}:${approvalId}`, runId: id, action: action as never, status: "pending" }));
      if (auto) {
        const r: ApprovalResult = { decision: "approved", by: auto };
        emit("approval.resolve", who.role, who.instance, { approvalId, decision: "approved", by: auto });
        persist((db) => db.update(schema.approvals).set({ status: "approved", decidedAt: Date.now() }).where(eq(schema.approvals.id, `${id}:${approvalId}`)));
        return r;
      }
      return untilAborted(d.promise, signal);
    },
    drainSteering: () => steering.splice(0),
    ackSteering(msgId, text) {
      emit("message", "orchestrator", "orchestrator", { id: `ack-${msgId}`, role: "agent", text: `Noted: "${text.length > 70 ? `${text.slice(0, 70)}…` : text}". Applying it from this step.`, ackOf: msgId });
    },
    saveArtifact: async (a) => {
      persist((db) => db.insert(schema.artifacts).values({ id: `${id}:${a.artifactId}:v${a.version}`, runId: id, artifactId: a.artifactId, kind: a.kind, title: a.title, version: a.version, content: a.content, language: a.language ?? null, createdAt: Date.now() }));
    },
  };

  let settle!: () => void;
  const settled = new Promise<void>((r) => (settle = r));

  const finish = () => {
    if (finished) return;
    finished = true;
    for (const fn of doneFns) fn();
    void persistChain.then(settle);
  };

  void (async () => {
    const db = await getDb();
    inflight.set(id, 0);
    // NIMBUS_FREEZE_CONTEXT=1 (tests only): no SKILL.md or memories in prompts, so identical runs hit the llm_cache.
    const freeze = process.env.NIMBUS_FREEZE_CONTEXT === "1";
    ctx.skill = freeze ? "" : await loadSkill(input.workstreamId);
    ctx.memories = freeze ? [] : await topMemories(input.workstreamId, input.goal);
    if (ctx.memories.length) ctx.script = `${input.workstreamId}~2`; // mock mode: run two plays its "~2" scripts where they exist
    await retryBusy(() => db.insert(schema.runs).values({ id, workstreamId: input.workstreamId, title: input.title, goal: input.goal, status: "running", trigger: input.trigger ?? "manual", startedAt, model: modelMode() }));
    emit("run.start", "orchestrator", "orchestrator", { title: input.title, workstreamId: input.workstreamId, goal: input.goal, startedAt, trigger: input.trigger ?? "manual", learned: { memories: ctx.memories.length, policies: policySection(ctx.skill).length } });

    let status: "done" | "failed" | "cancelled" | "stopped" = "done";
    try {
      await runOrchestrator(ctx);
    } catch (e) {
      if (e instanceof SpendCapError) {
        status = "failed";
        emit("run.error", "orchestrator", "orchestrator", { message: "spend cap", kind: "spend_cap", spentUsd: e.spentUsd, capUsd: e.capUsd });
        controller.abort(e); // concurrent agents stop at their next check
      } else if (e instanceof RunAborted) status = e.reason === "cancel" ? "cancelled" : "stopped";
      else if (signal.aborted) status = "stopped";
      else {
        status = "failed";
        emit("run.error", "orchestrator", "orchestrator", { message: e instanceof Error ? e.message : String(e) });
      }
    }
    // a stopped run rejects whatever was still waiting for the person
    for (const [approvalId, p] of pendingApprovals) emit("approval.resolve", p.who.role, p.who.instance, { approvalId, decision: "rejected", by: "system", note: "Run stopped" });
    pendingApprovals.clear();
    emit("run.end", "orchestrator", "orchestrator", { status });

    if (status === "done") {
      try {
        await runLearner(ctx, transcriptOf(events));
      } catch (e) {
        console.error("[nimbus] learner failed:", e instanceof Error ? e.message : e);
      }
    }
    await persistChain;
    await retryBusy(() => db.update(schema.runs).set({ status, endedAt: Date.now(), tokensIn: ctx.usage.in, tokensOut: ctx.usage.out, costUsd: ctx.usage.costUsd, baselineUsd: ctx.usage.baselineUsd }).where(eq(schema.runs.id, id)));
    inflight.delete(id);
    if (process.env.NIMBUS_RECORD_REAL === "1") {
      try {
        console.log(`[nimbus] recorded ${id} → ${writeRecording(events, input.workstreamId)}`);
      } catch (e) {
        console.error("[nimbus] recording failed:", e instanceof Error ? e.message : e);
      }
    }
    finish();
  })().catch((e) => {
    console.error("[nimbus] run crashed:", e);
    inflight.delete(id);
    finish();
  });

  return {
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
      const p = pendingApprovals.get(approvalId);
      if (!p || finished) return false;
      pendingApprovals.delete(approvalId);
      emit("approval.resolve", p.who.role, p.who.instance, { approvalId, decision: d.decision, by: "you", always: d.always, note: d.note });
      persist((db) => db.update(schema.approvals).set({ status: d.decision, always: d.always ? 1 : 0, note: d.note ?? null, decidedAt: Date.now() }).where(eq(schema.approvals.id, `${id}:${approvalId}`)));
      if (d.always && d.decision === "approved") {
        const rule = ruleFor(p.action);
        emit("policy", p.who.role, p.who.instance, { rule });
        persist(async () => {
          await appendPolicy(input.workstreamId, rule, id);
          ctx.skill = await loadSkill(input.workstreamId);
        });
      }
      if (d.decision === "rejected" && d.note) emit("message", "orchestrator", "user", { id: `note-${++n}`, role: "user", text: d.note });
      p.d.resolve({ decision: d.decision, always: d.always, note: d.note, by: "you" });
      return true;
    },
    postMessage({ text, kind, questionId }) {
      if (finished) return false;
      if (kind === "answer") {
        const qid = questionId ?? [...pendingQuestions.keys()][0];
        const q = qid ? pendingQuestions.get(qid) : undefined;
        if (!q) return false;
        pendingQuestions.delete(qid);
        emit("message", q.role, "user", { id: `ans-${++n}`, role: "user", text, answerTo: qid });
        q.d.resolve(text);
        return true;
      }
      const msgId = `steer-${++n}`;
      steering.push({ id: msgId, text });
      emit("message", "orchestrator", "user", { id: msgId, role: "user", text, queued: true });
      return true;
    },
    stop(reason) {
      if (finished) return;
      controller.abort(new RunAborted(reason));
    },
  };
}

/** A short plain-text digest of the run for the learner. */
function transcriptOf(events: AnyRunEvent[]): string {
  const lines: string[] = [];
  for (const e of events) {
    if (e.type === "message" && !e.payload.card) lines.push(`${e.payload.role === "user" ? "person" : e.agentInstance}: ${e.payload.text}`);
    else if (e.type === "artifact.version") lines.push(`artifact ${e.payload.title} v${e.payload.version}`);
    else if (e.type === "approval.resolve") lines.push(`approval ${e.payload.decision}${e.payload.always ? " (always allow)" : ""}`);
    else if (e.type === "tool.result" && !e.payload.ok) lines.push(`${e.agentInstance}: tool ${e.payload.tool} failed`);
  }
  return lines.slice(-40).join("\n");
}
