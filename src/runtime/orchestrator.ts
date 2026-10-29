// The Orchestrator is an agent whose tools are control tools: plan, spawn_agents, handoff, request_approval,
// ask_user, finish (SPEC §4). Turns are capped at 6 and the run has a 5 minute wall clock (live.ts).
import type { z } from "zod";
import type { PlanStep } from "@/lib/events";
import { ROLE_TIER, type AgentRole } from "@/lib/models";
import { modelMode } from "@/lib/tokenfactory";
import { RunAborted, sleep, type RunCtx } from "./context";
import { runAgent, type AgentRef, type Exec } from "./agent";
import { SpendCapError } from "./budget";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dataDir } from "@/db";
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

  // Plan steps tick as the orchestrator's actions (spawn, handoff, approval) finish, in order (SPEC §17.2).
  let steps: PlanStep[] = [];
  let stepIdx = 0;
  const emitStep = (s: PlanStep | undefined, state: "running" | "done" | "failed") => s && ctx.emit("step", "orchestrator", ORCH.instance, { stepId: s.id, state });
  const stepped = <I, R>(fn: (input: I) => Promise<R>) => async (input: I): Promise<R> => {
    const s = steps[stepIdx++];
    emitStep(s, "running");
    try {
      const r = await fn(input);
      const o = r as { ok?: boolean; decision?: string } | null;
      emitStep(s, o?.ok === false || o?.decision === "rejected" ? "failed" : "done");
      return r;
    } catch (e) {
      emitStep(s, "failed");
      throw e;
    }
  };

  // What the crew reported so far rides along with every handoff: a real Orchestrator does not reliably paste a child's
  // report into the next brief (seen: "Researcher's report: … (include the report)"), so the next agent never re-reads it.
  const crewReports: { instance: string; report: string }[] = [];
  const withReports = (context: string) =>
    crewReports.length ? `${context}\n\nReports from the crew so far:\n${crewReports.map((r) => `[${r.instance}]\n${r.report.slice(0, 6000)}`).join("\n\n")}` : context;

  const exec: Exec = {
    plan: async (input: z.infer<typeof SCHEMAS.plan>) => {
      const agents = input.agents.map((a) => ({ role: a.role, instance: `${a.role}-1`, tier: ROLE_TIER[a.role], brief: a.brief }));
      const label = (r: AgentRole) => r[0].toUpperCase() + r.slice(1);
      let draft: PlanStep[] = (input.steps?.length ? input.steps.map((s) => ({ text: s.text, role: s.role })) : input.agents.map((a) => ({ text: `${label(a.role)}: ${a.brief}`, role: a.role }))).map((s, i) => ({ id: `s${i + 1}`, text: s.text, role: s.role, tier: ROLE_TIER[s.role] }));
      for (let revision = 0; ; revision++) {
        ctx.emit("plan", "orchestrator", ORCH.instance, { agents, tools: input.tools, estimate: input.estimate, steps: draft, awaiting: ctx.review, revision });
        if (!ctx.review) {
          steps = draft;
          await sleep(planWindowMs(), ctx.signal); // the person's 3 s cancel window; stop() during it cancels the run
          return { ok: true, started: true };
        }
        // a person is editing the draft: the crew does nothing until they approve (or stop the run)
        const a = await ctx.awaitPlan();
        const edited = JSON.stringify(a.steps.map((s) => [s.text, s.role])) !== JSON.stringify(draft.map((s) => [s.text, s.role]));
        draft = a.steps;
        if (a.action === "approve") {
          steps = draft;
          ctx.emit("plan.approve", "orchestrator", ORCH.instance, { steps: draft, edited });
          return { ok: true, started: true, approvedSteps: draft.map((s) => s.text), edited };
        }
        ctx.emit("plan.revise", "orchestrator", ORCH.instance, { steps: draft });
        // A real model plans again with the edits; the scripted mock cannot, so it shows the edited draft again.
        if (modelMode() !== "mock") return { ok: false, revise: true, steps: draft.map((s) => s.text), note: "The person edited your plan and asked you to revise it. Call plan again with their steps in mind." };
        await sleep(450, ctx.signal);
      }
    },
    spawn_agents: stepped(async (input: z.infer<typeof SCHEMAS.spawn_agents>) =>
      wait(`Waiting on ${input.agents.map((a) => a.role[0].toUpperCase() + a.role.slice(1)).join(", ")}`, async () => {
        const kids = input.agents.map((a) => {
          const instance = nextInstance(ctx, a.role);
          ctx.emit("agent.spawn", a.role, instance, { by: ORCH.instance, role: a.role, instance, brief: a.brief });
          return { ref: { role: a.role, instance } as AgentRef, brief: a.brief };
        });
        // concurrently: the timeline shows the lanes filling at the same time
        const reports = await Promise.all(kids.map((k) => runChild(ctx, k.ref, k.brief, {})));
        for (const r of reports) if (r.report) crewReports.push(r);
        return { reports: Object.fromEntries(reports.map((r) => [r.instance, r.report])) };
      })),
    handoff: stepped(async (input: z.infer<typeof SCHEMAS.handoff>) => {
      const instance = nextInstance(ctx, input.to);
      // a placeholder ("[paste the report here]") or a bare one-liner gets the named agents' reports pasted in, and the
      // stored event shows that context, so the timeline never displays the placeholder
      const resolved = resolveHandoff(input.context, crewReports);
      ctx.emit("handoff", "orchestrator", ORCH.instance, { from: ORCH.instance, to: instance, context: resolved });
      ctx.emit("agent.spawn", input.to, instance, { by: ORCH.instance, role: input.to, instance, brief: resolved });
      return wait(`Waiting on ${input.to[0].toUpperCase()}${input.to.slice(1)}`, async () => {
        const r = await runChild(ctx, { role: input.to, instance }, resolved === input.context ? withReports(input.context) : resolved, {});
        if (r.report) crewReports.push(r);
        return { report: r.report };
      });
    }),
    request_approval: stepped(async (input: z.infer<typeof SCHEMAS.request_approval>) => {
      const action = normalizeSend(input.action as import("@/lib/events").ProposedAction);
      const a = await ctx.requestApproval(action, ORCH);
      if (a.decision !== "approved") return { decision: "rejected", note: a.note ?? null, sent: false };
      if (action.kind === "send_message") return { decision: "approved", ...sendMessage(ctx, action.details as { channel: string; text: string }) };
      if (action.kind === "write_file") {
        // Router rules: recorded in data/router-rules.json (the Overview shows the saving); the router does not read the file yet.
        const d = action.details as { path?: string; content?: string; expectedSavingPct?: number };
        if (d.path?.endsWith("router-rules.json") && ctx.mode !== "dry") {
          let rules: unknown = {};
          try {
            rules = JSON.parse(d.content ?? "{}");
          } catch {
            rules = { raw: d.content };
          }
          mkdirSync(dataDir(), { recursive: true });
          writeFileSync(path.join(dataDir(), "router-rules.json"), JSON.stringify({ ...(rules as object), expectedSavingPct: d.expectedSavingPct, appliedAt: Date.now(), runId: ctx.runId }, null, 2));
          return { decision: "approved", written: "data/router-rules.json", note: "recorded in data/router-rules.json; the router applies it from the next run" };
        }
        return { decision: "approved", written: false, note: "demo mode: nothing was written" };
      }
      if (action.kind === "open_pr") return { decision: "approved", ...(await openPr(ctx, action.details as { branch: string; title: string; body: string; patchArtifactId: string })) };
      return { decision: "approved" };
    }),
    ask_user: async (input: z.infer<typeof SCHEMAS.ask_user>) => ({ answer: await ctx.askUser(ORCH.instance, "orchestrator", input.text, input.options) }),
    finish: async (input: z.infer<typeof SCHEMAS.finish>) => {
      // whatever the plan listed that no action covered is done once the orchestrator finishes
      while (stepIdx < steps.length) {
        const s = steps[stepIdx++];
        emitStep(s, "running");
        emitStep(s, "done");
      }
      return { ok: true, summary: input.summary };
    },
  } as Exec;

  return runAgent(ctx, ORCH, ctx.goal, exec);
}

/**
 * A real Orchestrator raises its own send with { to | recipient, text | body | message } instead of the Writer's
 * { channel, text }: name them the one way, so a saved rule ("allow: send_message to …") matches and the send has an address.
 */
function normalizeSend(action: import("@/lib/events").ProposedAction): import("@/lib/events").ProposedAction {
  if (action.kind !== "send_message") return action;
  const d = (action.details ?? {}) as Record<string, unknown>;
  const channel = d.channel ?? d.to ?? d.recipient;
  const text = d.text ?? d.body ?? d.message;
  return { ...action, details: { ...d, ...(channel ? { channel } : {}), ...(text ? { text } : {}) } };
}

// "[paste the researcher report content here]", "[insert findings]", "(include the report)": a real Orchestrator's stand-in
// for a report it did not paste. Words inside the brackets decide it, so "[Your Name]" or d[key] do not count.
const HANDOFF_PLACEHOLDER = /\[[^\]\n]*\b(?:paste|insert|include|attach|here)\b[^\]\n]*\]|\([^)\n]*\b(?:paste|insert|include|attach)\b[^)\n]*\)/gi;

/**
 * The handoff context the receiving agent (and the stored event) gets. Unchanged unless it holds a placeholder, or is
 * under 200 characters while a crew report exists: then the placeholders become a pointer and the latest report of each
 * agent the context names (every agent's, when it names none) is appended.
 */
export function resolveHandoff(context: string, reports: { instance: string; report: string }[]): string {
  const latest = new Map<string, string>();
  for (const r of reports) if (r.report && !r.report.startsWith("FAILED:")) latest.set(r.instance, r.report);
  if (!latest.size) return context;
  const hasPlaceholder = new RegExp(HANDOFF_PLACEHOLDER.source, "i").test(context);
  if (!hasPlaceholder && context.trim().length >= 200) return context;
  const lower = context.toLowerCase();
  const named = [...latest.keys()].filter((inst) => lower.includes(inst.toLowerCase()) || lower.includes(inst.replace(/-\d+$/, "")));
  const pick = named.length ? named : [...latest.keys()];
  const body = context.replace(HANDOFF_PLACEHOLDER, "(the report is below)").trim();
  return `${body}\n\nReports from the crew:\n${pick.map((inst) => `[${inst}]\n${latest.get(inst)!.slice(0, 6000)}`).join("\n\n")}`;
}
