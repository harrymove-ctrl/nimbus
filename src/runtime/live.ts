// The live runtime behind RunHandle (the same interface replay.ts implements, so the UI and API routes do not change).
// Mock model by default (NIMBUS_MODEL=mock); NIMBUS_MODEL=nebius switches to Token Factory.
import path from "node:path";
import { eq } from "drizzle-orm";
import { dataDir, getDb, retryBusy, schema } from "@/db";
import type { AnyRunEvent, PayloadMap, ProposedAction, RunEventType, PlanStep } from "@/lib/events";
import type { AgentRole } from "@/lib/models";
import { DEFAULT_ROLES, crewOf, isDefaultCrew } from "@/lib/roles";
import { modelMode, setMockCrew } from "@/lib/tokenfactory";
import { SpendCapError, inflight } from "./budget";
import { prepareAttachments } from "./attachments";
import { RunAborted, deferred, untilAborted, type ApprovalResult, type RunCtx } from "./context";
import { runLearner } from "./learner";
import { notifyEvent } from "./notify";
import { writeRecording } from "./recorder";
import { topMemories } from "./memory";
import { crewNames } from "./agent";
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
  const signal = controller.signal;
  // Two clocks. The crew gets ACTIVE_CAP_MS of its own time; while a plan, an approval, a question or a pause waits on the
  // person, that clock stops (a run must not die because someone read the plan for six minutes). A gate left open longer than
  // GATE_CAP_MS (nobody is there: a cron run at 07:00) stops the run instead of holding a model process forever.
  const ACTIVE_CAP_MS = Number(process.env.NIMBUS_RUN_ACTIVE_MS) || 5 * 60_000;
  const GATE_CAP_MS = Number(process.env.NIMBUS_RUN_GATE_MS) || 60 * 60_000;
  let waitedMs = 0;
  let openGates = 0;
  let waitingSince = 0;
  const gated = async <T>(p: Promise<T>): Promise<T> => {
    if (openGates++ === 0) waitingSince = Date.now();
    try {
      return await untilAborted(p, signal);
    } finally {
      if (--openGates === 0) {
        waitedMs += Date.now() - waitingSince;
        waitingSince = 0;
      }
    }
  };
  const clock = setInterval(() => {
    const now = Date.now();
    const active = now - startedAt - waitedMs - (waitingSince ? now - waitingSince : 0);
    if (active > ACTIVE_CAP_MS || (waitingSince && now - waitingSince > GATE_CAP_MS)) controller.abort(new RunAborted("stop"));
  }, 2_000);
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
    notifyEvent({ runId: id, title: input.title, trigger: input.trigger ?? "manual", watching: eventFns.size > 0, events }, e);
    persist((db) => db.insert(schema.runEvents).values({ id: e.id, runId: id, seq: e.seq, tMs: e.tMs, agent, agentInstance, type, payload: payload as never }));
  }

  // ----- approvals, questions and steering are deferreds the HTTP routes (or the CLI) resolve -----
  const pendingApprovals = new Map<string, { d: ReturnType<typeof deferred<ApprovalResult>>; action: ProposedAction; who: { role: AgentRole; instance: string } }>();
  const pendingQuestions = new Map<string, { d: ReturnType<typeof deferred<string>>; role: AgentRole; instance: string }>();
  const steering: { id: string; text: string }[] = [];
  let pauseGate: ReturnType<typeof deferred<void>> | null = null;
  let planGate: ReturnType<typeof deferred<{ action: "approve" | "revise"; steps: PlanStep[] }>> | null = null;

  const ctx: RunCtx = {
    runId: id,
    workstreamId: input.workstreamId,
    goal: input.goal,
    mode: input.mode ?? "ask",
    roles: DEFAULT_ROLES,
    allowedTools: input.tools ?? ["web_search", "fetch_url", "run_code", "write_artifact", "send_message", "read_repo", "open_pr"],
    tierChoice: input.tier ?? "auto",
    startedAt,
    review: !!input.review,
    untilResumed() {
      return pauseGate ? gated(pauseGate.promise) : Promise.resolve();
    },
    awaitPlan() {
      planGate = deferred();
      return gated(planGate.promise);
    },
    workspace: path.join(dataDir(), "workspaces", id),
    attached: [],
    signal,
    emit,
    script: input.workstreamId,
    skill: "",
    memories: [],
    hop: 0,
    routedHops: 0,
    usage: { in: 0, out: 0, costUsd: 0, baselineUsd: 0 },
    usageByTier: { ultra: { in: 0, out: 0, costUsd: 0 }, super: { in: 0, out: 0, costUsd: 0 }, nano: { in: 0, out: 0, costUsd: 0 } },
    artifactVersions: new Map(),
    artifactContent: new Map(),
    instances: new Set(["orchestrator"]),
    async askUser(instance, role, text, options) {
      const questionId = `q-${++n}`;
      const d = deferred<string>();
      pendingQuestions.set(questionId, { d, role, instance });
      emit("question", role, instance, { questionId, text, options });
      const answer = await gated(d.promise);
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
      return gated(d.promise);
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
    clearInterval(clock);
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
    const [crew] = await retryBusy(() => db.select({ roles: schema.workstreams.roles }).from(schema.workstreams).where(eq(schema.workstreams.id, input.workstreamId)));
    ctx.roles = crewOf(crew?.roles);
    // mock mode: a crew of its own without a scripted fixture plans and spawns its own roles (tokenfactory.ts)
    if (!isDefaultCrew(ctx.roles)) setMockCrew(input.workstreamId, crewNames(ctx), ctx.skill);
    ctx.attached = await prepareAttachments(ctx, input.files);
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

    // the Learner stays unless the workstream's crew drops it
    if (status === "done" && ctx.roles.some((r) => r.role === "learner")) {
      try {
        await runLearner(ctx, transcriptOf(events));
      } catch (e) {
        const why = e instanceof Error ? e.message : String(e);
        console.error("[nimbus] learner failed:", why);
        // visible in the run, not only in the server log (a failure inside save_learning already said so itself)
        if (!events.some((x) => x.type === "message" && x.payload.id === "m-learn-failed")) emit("message", "learner", "learner-1", { id: "m-learn-failed", role: "agent", text: `Learning failed, nothing was saved from this run: ${why}` });
      }
    }
    await persistChain;
    await retryBusy(() => db.update(schema.runs).set({ status, endedAt: Date.now(), tokensIn: ctx.usage.in, tokensOut: ctx.usage.out, costUsd: ctx.usage.costUsd, baselineUsd: ctx.usage.baselineUsd, usageByTier: ctx.usageByTier }).where(eq(schema.runs.id, id)), 40); // patient: a lost final update leaves the run "running" forever
    inflight.delete(id);
    // F14: a run that finished marks its workstream unread; the app clears the dot at once when the person was looking at it
    // (a browser that is watching the run holds its event stream open: that run is already read)
    if (eventFns.size === 0) await retryBusy(() => db.update(schema.workstreams).set({ unread: 1 }).where(eq(schema.workstreams.id, input.workstreamId))).catch(() => {});
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
      emit("approval.resolve", p.who.role, p.who.instance, { approvalId, decision: d.decision, by: d.by ?? "you", always: d.always, note: d.note });
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
      p.d.resolve({ decision: d.decision, always: d.always, note: d.note, by: d.by ?? "you" });
      return true;
    },
    setPaused(paused) {
      if (finished) return false;
      if (paused && !pauseGate) {
        pauseGate = deferred();
        emit("run.pause", "orchestrator", "orchestrator", { paused: true });
      } else if (!paused && pauseGate) {
        const g = pauseGate;
        pauseGate = null;
        emit("run.pause", "orchestrator", "orchestrator", { paused: false });
        g.resolve();
      }
      return true;
    },
    planAction(a) {
      if (finished || !planGate) return false;
      const g = planGate;
      planGate = null;
      g.resolve(a);
      return true;
    },
    postMessage({ text, kind, questionId, via }) {
      if (finished) return false;
      if (kind === "answer") {
        const qid = questionId ?? [...pendingQuestions.keys()][0];
        const q = qid ? pendingQuestions.get(qid) : undefined;
        if (!q) return false;
        pendingQuestions.delete(qid);
        emit("message", q.role, "user", { id: `ans-${++n}`, role: "user", text, answerTo: qid, ...(via ? { via } : {}) });
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
