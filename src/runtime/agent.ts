// One agent = a loop of hops. Each hop: route → model call (cached, retried, falls one tier down) → run the
// tool calls it asked for, emitting segment/usage/route events the whole way (SPEC §4).
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { JSONValue, ModelMessage } from "ai";
import { dataDir } from "@/db";
import type { AgentRole, BuiltinRole, Tier } from "@/lib/models";
import { ROLE_TIER, costUsd } from "@/lib/models";
import { isDefaultCrew, roleTitle } from "@/lib/roles";
import { hopLabel, stripThink } from "@/lib/tokenfactory";
import { attachedSentence } from "./attachments";
import { RunAborted, type RunCtx } from "./context";
import { SpendCapError, inflight, runCapUsd } from "./budget";
import { callHop, pickTier } from "./router";
import { CONTROL_TOOLS, DEFAULT_CREW, ROLE_TOOLS, fetchUrl, openPr, readRepo, runCode, sendMessage, toolLabel, toolSet, webSearch, writeArtifact, type ToolName } from "./tools";

export type AgentRef = { role: AgentRole; instance: string };
export type Exec = Partial<Record<ToolName, (input: never) => Promise<unknown>>>;

// Who the replies are from: NIMBUS_USER_NAME when set. Without it the Writer signs nothing rather than "[Your Name]".
const SIGNER = process.env.NIMBUS_USER_NAME?.trim();
const SIGN_OFF = SIGNER ? `Sign each reply "${SIGNER}".` : "End each reply after its closing line, with no signature.";

// Role prompts are a stable prefix (Token Factory's cached-input price); per-run material goes in the first user message.
// The default crew's briefs in src/lib/roles.ts are these prompts after "You are the <Role>. ", so roleSpec() rebuilds
// them byte for byte; this table is the fallback for a built-in role a crew does not list.
const ROLE_PROMPT: Record<BuiltinRole, string> = {
  orchestrator: "You are the Orchestrator of a small crew of agents working for one person. First call plan, then spawn_agents for parallel work, handoff for sequential work, request_approval before any action with side effects, ask_user only when blocked, and finish when done. Be brief.",
  researcher: "You are the Researcher. Use web_search and fetch_url, cite sources, and return a short sourced report. Ask the person with ask_user only if the brief is ambiguous.",
  analyst: "You are the Analyst. Use run_code on the attached data to compute exact numbers, fix your own script errors, save useful code with write_artifact, and report the numbers.",
  writer: `You are the Writer. Produce the document with write_artifact: the number first, then cause, evidence, open questions and next step. Edit by writing a new version of the same artifactId. When the brief asks you to send something, call send_message once per message, to its address; send_message asks for approval itself. Say only what your sources and the crew's reports say, using the latest of them. Never leave a placeholder in brackets such as [Your Name] or [Date]. ${SIGN_OFF}`,
  checker: "You are the Checker. Validate data and fact-check claims quickly; report what is supported and any caveat.",
  learner: "You are the Learner. From the run summary, call save_learning once with at most 8 durable memories and the rewritten SKILL.md (keep its structure).",
};

/** Tools for a role the workstream named without listing any: every worker tool (the run's allowed tools still filter them). */
const ANY_WORKER_TOOLS: ToolName[] = ["web_search", "fetch_url", "run_code", "write_artifact", "read_repo", "send_message", "open_pr", "ask_user"];

/** The Orchestrator's crew: the roles it may plan, spawn and hand off to (the Learner runs on its own after the run). */
export const crewNames = (ctx: Pick<RunCtx, "roles">) => {
  const names = ctx.roles.map((r) => r.role).filter((r) => r !== "learner");
  return names.length ? names : DEFAULT_CREW;
};

/** System prompt, tier ceiling and tools of one role in this run's crew. */
export function roleSpec(ctx: Pick<RunCtx, "roles">, role: AgentRole): { system: string; ceiling: Tier; tools: ToolName[] } {
  if (role === "orchestrator") return { system: ROLE_PROMPT.orchestrator, ceiling: ROLE_TIER.orchestrator, tools: ROLE_TOOLS.orchestrator };
  const builtin = role in ROLE_PROMPT ? (role as BuiltinRole) : null;
  const r = ctx.roles.find((x) => x.role === role);
  if (role === "learner") return { system: r ? `You are the Learner. ${r.brief}` : ROLE_PROMPT.learner, ceiling: ROLE_TIER.learner, tools: ROLE_TOOLS.learner };
  if (!r) return builtin ? { system: ROLE_PROMPT[builtin], ceiling: ROLE_TIER[builtin], tools: ROLE_TOOLS[builtin] } : { system: `You are the ${roleTitle(role)}. Do what your brief asks and report back briefly.`, ceiling: "super", tools: ANY_WORKER_TOOLS };
  const tools = (r.tools as ToolName[] | undefined) ?? (builtin ? ROLE_TOOLS[builtin] : ANY_WORKER_TOOLS);
  return { system: `You are the ${roleTitle(role)}. ${r.brief}${tools.includes("send_message") ? ` ${SIGN_OFF}` : ""}`, ceiling: r.tier, tools };
}

export function firstPrompt(ctx: RunCtx, brief: string, role?: AgentRole) {
  const parts: string[] = [];
  // a crew of its own: the Orchestrator learns who it can call on (the default crew's prompts stay as they were)
  if (role === "orchestrator" && !isDefaultCrew(ctx.roles)) parts.push(`Your crew (plan, spawn_agents and handoff take these role names):\n${ctx.roles.filter((r) => r.role !== "learner").map((r) => `- ${r.role} (${r.tier}): ${r.brief}`).join("\n")}`);
  if (ctx.skill.trim()) parts.push(`SKILL.md for this workstream:\n${ctx.skill.trim()}`);
  if (ctx.memories.length) parts.push(`Memories from earlier runs:\n${ctx.memories.map((m) => `- ${m}`).join("\n")}`);
  parts.push(`Goal: ${ctx.goal}`);
  const attached = attachedSentence(ctx.attached ?? []);
  if (attached) parts.push(attached);
  parts.push(`Your brief: ${brief}`);
  return parts.join("\n\n");
}

const json = (v: unknown) => JSON.parse(JSON.stringify(v ?? null)) as JSONValue;

export async function runAgent(ctx: RunCtx, ref: AgentRef, brief: string, exec: Exec = {}): Promise<string> {
  const { role, instance } = ref;
  const spec = roleSpec(ctx, role);
  const tools = toolSet(spec.tools, ctx.allowedTools, crewNames(ctx));
  const ceiling = spec.ceiling;
  const maxTurns = role === "orchestrator" ? 10 : 12;
  const messages: ModelMessage[] = [{ role: "user", content: firstPrompt(ctx, brief, role) }];
  const now = () => Date.now() - ctx.startedAt;
  let report = "";
  let finished = false;

  ctx.emit("agent.start", role, instance, {});
  if (process.env.NIMBUS_DEBUG_PROMPTS === "1") {
    mkdirSync(path.join(dataDir(), "prompts"), { recursive: true });
    appendFileSync(path.join(dataDir(), "prompts", `${ctx.runId}.jsonl`), JSON.stringify({ instance, role, system: spec.system, user: messages[0].content }) + "\n");
  }
  for (let turn = 1; turn <= maxTurns && !finished; turn++) {
    if (ctx.signal.aborted) throw ctx.signal.reason instanceof RunAborted ? ctx.signal.reason : new RunAborted("stop");
    await ctx.untilResumed(); // paused by the person: no new hop starts until they resume
    if (role === "orchestrator") {
      for (const n of ctx.drainSteering()) {
        messages.push({ role: "user", content: `Steering note from the person (apply it from now on): ${n.text}` });
        ctx.ackSteering(n.id, n.text);
      }
    }
    // A child that spends every turn on tool calls (a real model reading files one per turn) would report nothing back:
    // its last turn has no tools and asks for the report.
    const last = turn === maxTurns && role !== "orchestrator";
    if (last) messages.push({ role: "user", content: "That was your last tool call. Write your report now from what you have." });
    const hopTools = last ? {} : tools;
    const hopNo = ++ctx.hop;
    const { tier, reason } = await pickTier(ctx, { role, turn, brief: messages.map((m) => (typeof m.content === "string" ? m.content : "")).join("\n").slice(-1200), hasTools: Object.keys(hopTools).length > 0, ws: ctx.script, instance }, ceiling);
    ctx.emit("route", role, instance, { hop: hopNo, role, chosen: tier, ceiling, reason });
    if (tier !== ceiling) ctx.routedHops++;

    const segId = `${instance}-h${turn}`;
    const label = hopLabel(role, turn, ctx.script, instance);
    ctx.emit(`segment.think`, role, instance, { segId, label, startMs: now() });
    let call;
    try {
      call = await callHop(ctx, {
        role, instance, turn, hopNo, ceiling, tier, system: spec.system, messages, tools: hopTools,
        onFallback: (to, why) => {
          ctx.emit("route", role, instance, { hop: hopNo, role, chosen: to, ceiling, reason: why, fallback: true });
          ctx.routedHops++;
        },
      });
    } finally {
      ctx.emit("segment.think", role, instance, { segId, label, endMs: now() });
    }
    ctx.emit("usage", role, instance, { tier: call.tier, in: call.usage.in, out: call.usage.out, cached: call.cached || undefined });
    ctx.usage.in += call.usage.in;
    ctx.usage.out += call.usage.out;
    const bt = ctx.usageByTier[call.tier];
    bt.in += call.usage.in;
    bt.out += call.usage.out;
    if (!call.cached) {
      bt.costUsd += costUsd(call.tier, call.usage.in, call.usage.out);
      ctx.usage.costUsd += costUsd(call.tier, call.usage.in, call.usage.out);
      ctx.usage.baselineUsd += costUsd(ceiling, call.usage.in, call.usage.out);
      inflight.set(ctx.runId, ctx.usage.costUsd);
      // per-run spend cap: stop the whole run the moment its running cost passes it
      if (ctx.usage.costUsd > runCapUsd()) throw new SpendCapError(ctx.usage.costUsd, runCapUsd());
    }

    const text = stripThink(call.text);
    if (text) {
      report = text;
      ctx.emit("message", role, instance, { id: `msg-${instance}-${turn}`, role: "agent", text });
    }
    if (call.toolCalls.length === 0) break;

    messages.push({
      role: "assistant",
      content: [...(text ? [{ type: "text" as const, text }] : []), ...call.toolCalls.map((c) => ({ type: "tool-call" as const, toolCallId: c.toolCallId, toolName: c.toolName, input: c.input }))],
    });
    const results = [];
    for (const tc of call.toolCalls) {
      const r = await execTool(ctx, ref, tc, exec);
      if (tc.toolName === "finish" || tc.toolName === "save_learning") finished = true; // the Learner's one call ends its run
      results.push({ type: "tool-result" as const, toolCallId: tc.toolCallId, toolName: tc.toolName, output: { type: "json" as const, value: json(r) } });
    }
    messages.push({ role: "tool", content: results });
  }
  ctx.emit("agent.end", role, instance, { summary: report.slice(0, 160) || undefined });
  return report;
}

async function execTool(ctx: RunCtx, ref: AgentRef, tc: { toolCallId: string; toolName: string; input: unknown }, exec: Exec): Promise<unknown> {
  const { role, instance } = ref;
  const name = tc.toolName as ToolName;
  const input = (tc.input ?? {}) as Record<string, unknown>;
  const control = CONTROL_TOOLS.has(name);
  const segId = `${instance}-c-${tc.toolCallId}`;
  const label = toolLabel(name, input);
  const now = () => Date.now() - ctx.startedAt;

  if (!control) ctx.emit("segment.tool", role, instance, { segId, label, startMs: now() });
  ctx.emit("tool.call", role, instance, { callId: tc.toolCallId, tool: name, input });
  let ok = true;
  let output: unknown;
  try {
    const custom = exec[name];
    if (custom) output = await custom(input as never);
    else output = await builtin(ctx, ref, name, input);
    if ((output as { ok?: boolean } | null)?.ok === false) ok = false;
  } catch (e) {
    if (e instanceof RunAborted || e instanceof SpendCapError || ctx.signal.aborted) throw e;
    ok = false;
    output = { error: e instanceof Error ? e.message : String(e) };
  }
  ctx.emit("tool.result", role, instance, { callId: tc.toolCallId, tool: name, ok, output: json(output) });
  if (!control) ctx.emit("segment.tool", role, instance, { segId, label, endMs: now(), failed: ok ? undefined : true });
  return output;
}

async function builtin(ctx: RunCtx, ref: AgentRef, name: ToolName, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "web_search":
      return webSearch(String(input.query));
    case "fetch_url":
      return fetchUrl(String(input.url));
    case "run_code":
      return runCode(ctx, input as never);
    case "write_artifact":
      return writeArtifact(ctx, ref, input as never);
    case "send_message": {
      const i = input as { channel: string; text: string };
      const a = await ctx.requestApproval({ kind: "send_message", summary: `Send message to ${i.channel}`, risk: "medium", details: i }, ref);
      return a.decision === "approved" ? sendMessage(ctx, i) : { sent: false, note: a.note ?? "rejected" };
    }
    case "read_repo":
      return readRepo(input as never);
    case "open_pr": {
      const i = input as { branch: string; title: string; body: string; patchArtifactId: string };
      const a = await ctx.requestApproval({ kind: "open_pr", summary: `Open PR ${i.branch} → main`, risk: "medium", details: i }, ref);
      return a.decision === "approved" ? openPr(ctx, i) : { opened: false, note: a.note ?? "rejected" };
    }
    case "ask_user":
      return { answer: await ctx.askUser(ref.instance, ref.role, String(input.text), input.options as string[] | undefined) };
    default:
      throw new Error(`tool ${name} is not available to ${ref.role}`);
  }
}
