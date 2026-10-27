// The Orchestrator is an agent whose tools are control tools: plan, spawn_agents, handoff, request_approval,
// ask_user, finish (SPEC §4). Turns are capped at 6 and the run has a 5 minute wall clock (live.ts).
import type { z } from "zod";
import { ROLE_TIER, type AgentRole } from "@/lib/models";
import { RunAborted, sleep, type RunCtx } from "./context";
import { runAgent, type AgentRef, type Exec } from "./agent";
import { SpendCapError } from "./budget";
import { SCHEMAS, openPr, sendMessage } from "./tools";

const ORCH: AgentRef = { role: "orchestrator", instance: "orchestrator" };
const planWindowMs = () => (process.env.NIMBUS_PLAN_WINDOW_MS ? Number(process.env.NIMBUS_PLAN_WINDOW_MS) : process.env.NIMBUS_MOCK_FAST === "1" ? 0 : 3000);

function nextInstance(ctx: RunCtx, role: AgentRole) {
  let n = 1;
  while (ctx.instances.has(`${role}-${n}`)) n++;
  const instance = `${role}-${n}`;
  ctx.instances.add(instance);
  return instance;
}

/** Spawn one child agent: emits agent.spawn (the dotted connector) and runs it to its report. A failed child does not kill the run. */
export async function spawnChild(ctx: RunCtx, parent: AgentRef, role: AgentRole, brief: string, exec: Exec = {}): Promise<{ instance: string; report: string }> {
  const instance = nextInstance(ctx, role);
  ctx.emit("agent.spawn", role, instance, { by: parent.instance, role, instance, brief });
  return runChild(ctx, { role, instance }, brief, exec);
}

async function runChild(ctx: RunCtx, ref: AgentRef, brief: string, exec: Exec) {
  try {
    return { instance: ref.instance, report: await runAgent(ctx, ref, brief, exec) };
  } catch (e) {
    if (e instanceof RunAborted || e instanceof SpendCapError || ctx.signal.aborted) throw e;
    const message = e instanceof Error ? e.message : String(e);
    ctx.emit("agent.error", ref.role, ref.instance, { message });
    return { instance: ref.instance, report: `FAILED: ${message}` };
  }
}

export async function runOrchestrator(ctx: RunCtx): Promise<string> {
  let waitN = 0;
  const wait = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
    const segId = `orchestrator-w${++waitN}`;
    ctx.emit("segment.wait", "orchestrator", ORCH.instance, { segId, label, startMs: Date.now() - ctx.startedAt });
    try {
      return await fn();
    } finally {
      ctx.emit("segment.wait", "orchestrator", ORCH.instance, { segId, label, endMs: Date.now() - ctx.startedAt });
    }
  };

  const exec: Exec = {
    plan: async (input: z.infer<typeof SCHEMAS.plan>) => {
      ctx.emit("plan", "orchestrator", ORCH.instance, {
        agents: input.agents.map((a) => ({ role: a.role, instance: `${a.role}-1`, tier: ROLE_TIER[a.role], brief: a.brief })),
        tools: input.tools,
        estimate: input.estimate,
      });
      await sleep(planWindowMs(), ctx.signal); // the person's 3 s cancel window; stop() during it cancels the run
      return { ok: true, started: true };
    },
    spawn_agents: async (input: z.infer<typeof SCHEMAS.spawn_agents>) =>
      wait(`Waiting on ${input.agents.map((a) => a.role[0].toUpperCase() + a.role.slice(1)).join(", ")}`, async () => {
        const kids = input.agents.map((a) => {
          const instance = nextInstance(ctx, a.role);
          ctx.emit("agent.spawn", a.role, instance, { by: ORCH.instance, role: a.role, instance, brief: a.brief });
          return { ref: { role: a.role, instance } as AgentRef, brief: a.brief };
        });
        // concurrently: the timeline shows the lanes filling at the same time
        const reports = await Promise.all(kids.map((k) => runChild(ctx, k.ref, k.brief, {})));
        return { reports: Object.fromEntries(reports.map((r) => [r.instance, r.report])) };
      }),
    handoff: async (input: z.infer<typeof SCHEMAS.handoff>) => {
      const instance = nextInstance(ctx, input.to);
      ctx.emit("handoff", "orchestrator", ORCH.instance, { from: ORCH.instance, to: instance, context: input.context });
      ctx.emit("agent.spawn", input.to, instance, { by: ORCH.instance, role: input.to, instance, brief: input.context });
      return wait(`Waiting on ${input.to[0].toUpperCase()}${input.to.slice(1)}`, async () => {
        const r = await runChild(ctx, { role: input.to, instance }, input.context, {});
        return { report: r.report };
      });
    },
    request_approval: async (input: z.infer<typeof SCHEMAS.request_approval>) => {
      const action = input.action as import("@/lib/events").ProposedAction;
      const a = await ctx.requestApproval(action, ORCH);
      if (a.decision !== "approved") return { decision: "rejected", note: a.note ?? null, sent: false };
      if (action.kind === "send_message") return { decision: "approved", ...sendMessage(ctx, action.details as { channel: string; text: string }) };
      if (action.kind === "open_pr") return { decision: "approved", ...(await openPr(ctx, action.details as { branch: string; title: string; body: string; patchArtifactId: string })) };
      return { decision: "approved" };
    },
    ask_user: async (input: z.infer<typeof SCHEMAS.ask_user>) => ({ answer: await ctx.askUser(ORCH.instance, "orchestrator", input.text, input.options) }),
    finish: async (input: z.infer<typeof SCHEMAS.finish>) => ({ ok: true, summary: input.summary }),
  } as Exec;

  return runAgent(ctx, ORCH, ctx.goal, exec);
}
