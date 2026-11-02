// C2 (docs/CONVERSATION.md): a message on a finished run is a follow-up, not a new run. The Orchestrator first tries to
// answer from the run's events and artifacts (one cheap Super call, no workers; mock mode: extractive, $0). When the
// request needs work ("shorter", "add Thursday's calendar") it starts a small continuation run linked by parent_run_id,
// which writes the next version of the same artifact. Both lines are added to the finished run's conversation.
import { generateText } from "ai";
import { asc, eq, inArray } from "drizzle-orm";
import { getDb, retryBusy, schema } from "@/db";
import type { AnyRunEvent, PayloadMap } from "@/lib/events";
import { FOLLOWUP_TIER, TIERS, costUsd } from "@/lib/models";
import { getModel, modelMode, stripThink } from "@/lib/tokenfactory";
import { checkDayBudget } from "./budget";
import { PHONE_MAX, pickDoc, toPhone } from "./chat-util";
import { transcriptOf } from "./live";
import { cacheGet, cachePut, sha } from "./router";
import { getRun, startRun, type FollowUpArtifact, type RunHandle } from "./source";

export type FollowUpVia = "web" | "chat" | "telegram";
export type FollowUpOutcome =
  | { kind: "answer"; parentRunId: string; text: string; usage: { in: number; out: number } }
  | { kind: "continuation"; parentRunId: string; run: RunHandle; title: string }
  | { kind: "error"; status: number; error: string };

/** "shorter, top three only" → "Follow up: shorter, top three only" (the runs picker's title). */
export function followUpTitle(text: string): string {
  const line = text.trim().split("\n")[0].replace(/[.!\s]+$/, "");
  return `Follow up: ${line.length > 48 ? `${line.slice(0, 47).trimEnd()}…` : line}`;
}

const QUESTION = /\?\s*$|^(why|what|when|where|how|which|who|whose|did|does|do you|is|are|was|were|can you explain|explain|tell me why)\b/i;
/** Mock mode, and the fallback when the model's reply does not parse: a question is answered, anything else is work. */
export const looksLikeQuestion = (text: string) => QUESTION.test(text.trim());

/** The newest version of each artifact, walking up the follow-up chain so a v3 can build on a v2 whose v1 lives in the first run. */
async function latestArtifacts(runId: string): Promise<FollowUpArtifact[]> {
  const db = await getDb();
  const chain: string[] = [];
  for (let id: string | null = runId; id && chain.length < 6 && !chain.includes(id); ) {
    chain.push(id);
    const [r]: { parent: string | null }[] = await db.select({ parent: schema.runs.parentRunId }).from(schema.runs).where(eq(schema.runs.id, id));
    id = r?.parent ?? null;
  }
  const rows = await db.select().from(schema.artifacts).where(inArray(schema.artifacts.runId, chain)).orderBy(asc(schema.artifacts.version), asc(schema.artifacts.createdAt));
  const latest = new Map<string, FollowUpArtifact>();
  for (const a of rows) if ((latest.get(a.artifactId)?.version ?? 0) <= a.version) latest.set(a.artifactId, { artifactId: a.artifactId, kind: a.kind, title: a.title, version: a.version, content: a.content, language: a.language });
  return [...latest.values()];
}

async function storedEvents(runId: string): Promise<AnyRunEvent[]> {
  const rows = await (await getDb()).select().from(schema.runEvents).where(eq(schema.runEvents.runId, runId)).orderBy(asc(schema.runEvents.seq));
  return rows.map((r) => ({ id: r.id, runId: r.runId, seq: r.seq, tMs: r.tMs, agent: r.agent, agentInstance: r.agentInstance, type: r.type, payload: r.payload }) as AnyRunEvent);
}

// one follow-up at a time per run: the lines it appends take the next sequence numbers
const chains = new Map<string, Promise<unknown>>();

/** Append messages to a finished run (the database, and the in-memory handle when the server still holds it). */
async function appendMessages(runId: string, handle: RunHandle | undefined, events: AnyRunEvent[], msgs: { agent: string; instance: string; payload: PayloadMap["message"] }[]) {
  const db = await getDb();
  const last = events[events.length - 1];
  const stored = await db.select({ seq: schema.runEvents.seq }).from(schema.runEvents).where(eq(schema.runEvents.runId, runId));
  let seq = Math.max(events.length, ...stored.map((r) => r.seq + 1));
  for (const m of msgs) {
    // the run's last instant: the timeline's scale stays the run's own, the transcript shows the line after the summary
    const e = { id: `${runId}-${seq}`, runId, seq, tMs: last?.tMs ?? 0, agent: m.agent, agentInstance: m.instance, type: "message", payload: m.payload } as AnyRunEvent;
    await retryBusy(() => db.insert(schema.runEvents).values({ id: e.id, runId, seq, tMs: e.tMs, agent: m.agent, agentInstance: m.instance, type: "message", payload: m.payload as never }));
    if (handle && handle.events.length === seq) (handle.events as AnyRunEvent[]).push(e);
    seq++;
  }
}

const STOP = new Set("a an and are as at be but by did do does for from get got had has have how i in is it its me my of on or our so than that the their then there these they this to up was we were what when where which who why will with you your please about any".split(" "));
const terms = (s: string) => s.toLowerCase().replace(/[^a-z0-9$%.\- ]+/g, " ").split(/\s+/).filter((x) => x.length > 1 && !STOP.has(x));

const SAME: Record<string, string[]> = {
  skip: ["skip", "wait", "invoice", "digest"],
  skipped: ["skipped", "wait", "invoice", "digest"],
  email: ["email", "inbox", "reply", "invoice", "digest"],
  emails: ["emails", "inbox", "replies", "invoice", "digest"],
  third: ["third", "3."],
};

/** Mock mode: the lines of the run's documents and its agents' messages that share the most words with the question. */
function extractiveAnswer(question: string, events: AnyRunEvent[], artifacts: FollowUpArtifact[], title: string): string {
  const docs = artifacts.filter((a) => a.kind === "doc");
  const doc = pickDoc(docs, title);
  const body = doc ? toPhone(doc.content, { maxLines: 400, maxChars: 100_000 }).split("\n") : [];
  const said = events.flatMap((e) => (e.type === "message" && e.payload.role === "agent" && !e.payload.card ? [e.payload.text] : []));
  const pool = [...body, ...said].map((l) => l.trim()).filter((l) => l.length > 3);
  // the person's words for what the crew wrote: "skip" is what the brief calls "can wait", an "email" is a message or reply
  const q = new Set(terms(question).flatMap((t) => SAME[t] ?? [t]));
  const scored = pool.map((l, i) => ({ l, i, s: terms(l).filter((x) => q.has(x)).length })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.i - b.i).slice(0, 3).sort((a, b) => a.i - b.i);
  const lines = scored.length ? scored.map((x) => x.l) : pool.slice(0, 3);
  return lines.length ? toPhone(lines.join("\n"), { maxLines: 5, maxChars: PHONE_MAX - 120 }) : "This run left nothing I can answer that from.";
}

type Decision = { answer?: string; work?: boolean; usage: { in: number; out: number } };

/** Real mode: one Super call (cached) that answers from the run, or says the follow-up needs a continuation run. */
async function decide(text: string, events: AnyRunEvent[], artifacts: FollowUpArtifact[], goal: string): Promise<Decision> {
  const material = `GOAL: ${goal}\n\nWHAT HAPPENED:\n${transcriptOf(events).slice(-4000)}\n\n${artifacts.slice(0, 3).map((a) => `ARTIFACT ${a.artifactId} v${a.version} (${a.title}):\n${a.content.slice(0, 3000)}`).join("\n\n")}`;
  const prompt = `You are the Orchestrator of a crew that finished the run below. The person sent a follow-up. If it is a question the material answers (why, what, did you), answer it in at most 5 short plain lines for a phone. If it asks for changed or new work (shorter, add something, redo, send), do not do it: say it needs work.
Reply with JSON only: {"answer":"..."} or {"work":true}.

${material}

Follow-up: ${text.slice(0, 600)}`;
  const key = sha(`followup|${prompt}`);
  const hit = await cacheGet(key);
  let out = hit ? String((hit.response as { text: string }).text) : "";
  let usage = { in: 0, out: 0 };
  if (!hit) {
    const r = await generateText({ model: getModel({ tier: FOLLOWUP_TIER, role: "router", turn: 1 }), prompt, maxOutputTokens: 500, maxRetries: 1 });
    out = stripThink(r.text);
    usage = { in: r.usage.inputTokens ?? 0, out: r.usage.outputTokens ?? 0 };
    await cachePut(key, TIERS[FOLLOWUP_TIER], { text: out }, usage);
  }
  try {
    const j = JSON.parse(out.match(/\{[\s\S]*\}/)?.[0] ?? "") as { answer?: unknown; work?: unknown };
    if (typeof j.answer === "string" && j.answer.trim()) return { answer: j.answer.trim(), usage };
    if (j.work) return { work: true, usage };
  } catch {}
  return looksLikeQuestion(text) && out.trim() && !/^\{/.test(out.trim()) ? { answer: out.trim(), usage } : { work: true, usage };
}

/**
 * Handle a follow-up on run `parentRunId`. Only for a run that has ended (a live run takes steering instead); a run whose
 * Learner is still finishing is waited for, so the continuation sees the memories it saves.
 */
export async function followUp(parentRunId: string, text: string, o: { via?: FollowUpVia } = {}): Promise<FollowUpOutcome> {
  const prev = chains.get(parentRunId) ?? Promise.resolve();
  const p = prev.catch(() => {}).then(() => doFollowUp(parentRunId, text.trim(), o.via ?? "web"));
  chains.set(parentRunId, p);
  try {
    return await p;
  } finally {
    if (chains.get(parentRunId) === p) chains.delete(parentRunId);
  }
}

async function doFollowUp(parentRunId: string, text: string, via: FollowUpVia): Promise<FollowUpOutcome> {
  if (!text) return { kind: "error", status: 400, error: "text is required" };
  const handle = getRun(parentRunId);
  if (handle && !handle.finished) {
    if (!handle.events.some((e) => e.type === "run.end")) return { kind: "error", status: 409, error: "the run is still going: steer it instead" };
    await handle.settled; // run.end is out, the Learner is finishing
  }
  const db = await getDb();
  const [row] = await db.select().from(schema.runs).where(eq(schema.runs.id, parentRunId));
  if (!row && !handle) return { kind: "error", status: 404, error: "run not found" };
  if (!row) return { kind: "error", status: 409, error: "this run was not saved, so it cannot be followed up" };
  if (row.status === "running" && !handle) return { kind: "error", status: 409, error: "the run is still going in another process" };
  const events = handle ? [...handle.events] : await storedEvents(parentRunId);
  const artifacts = await latestArtifacts(parentRunId);
  const sayVia = via === "web" ? {} : { via };
  const userLine = { agent: "orchestrator", instance: "user", payload: { id: `fu-${Date.now().toString(36)}`, role: "user" as const, text, ...sayVia, followUp: {} } };

  const d: Decision = modelMode() === "mock" ? (looksLikeQuestion(text) ? { answer: extractiveAnswer(text, events, artifacts, row.title), usage: { in: 0, out: 0 } } : { work: true, usage: { in: 0, out: 0 } }) : await decide(text, events, artifacts, row.goal);
  if (d.usage.in || d.usage.out) {
    // the follow-up's own spend counts on the run it was asked on (the day cap reads runs.cost_usd)
    const c = costUsd(FOLLOWUP_TIER, d.usage.in, d.usage.out);
    await retryBusy(() => db.update(schema.runs).set({ tokensIn: row.tokensIn + d.usage.in, tokensOut: row.tokensOut + d.usage.out, costUsd: row.costUsd + c, baselineUsd: row.baselineUsd + c }).where(eq(schema.runs.id, parentRunId)));
  }

  if (d.answer) {
    await appendMessages(parentRunId, handle, events, [userLine, { agent: "orchestrator", instance: "orchestrator", payload: { id: `fu-a-${Date.now().toString(36)}`, role: "agent", text: d.answer, followUp: {} } }]);
    return { kind: "answer", parentRunId, text: d.answer, usage: d.usage };
  }

  const budget = await checkDayBudget();
  if (!budget.ok) return { kind: "error", status: 429, error: budget.message ?? "Daily spend cap reached" };
  const [ws] = await db.select({ tools: schema.workstreams.tools }).from(schema.workstreams).where(eq(schema.workstreams.id, row.workstreamId));
  const title = followUpTitle(text);
  const run = startRun({
    workstreamId: row.workstreamId,
    title,
    goal: row.goal,
    trigger: via === "web" ? "manual" : via,
    mode: "ask",
    tools: ws?.tools,
    followUp: { parentRunId, text, artifacts },
  });
  await appendMessages(parentRunId, handle, events, [userLine, { agent: "orchestrator", instance: "orchestrator", payload: { id: `fu-c-${Date.now().toString(36)}`, role: "agent", text: `This needs work: started "${title}" as a new run linked to this one.`, followUp: { continuationRunId: run.id } } }]);
  return { kind: "continuation", parentRunId, run, title };
}
