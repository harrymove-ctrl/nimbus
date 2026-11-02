// C1 (docs/CONVERSATION.md): before it plans a goal a person typed, the Orchestrator checks it for five slots (what,
// from where, how often, what counts as done, what needs my OK) with one Nano call. With two or more missing it asks up
// to three numbered questions in ONE ask_user card, saves the answers as memories of the workstream, and plans. A
// workstream that answered once is never asked again: its "Intake" memories fill the slots.
import { generateText } from "ai";
import { and, eq, like } from "drizzle-orm";
import { getDb, retryBusy, schema } from "@/db";
import { INTAKE_TIER, TIERS, costUsd } from "@/lib/models";
import { getModel, modelMode } from "@/lib/tokenfactory";
import type { RunCtx } from "./context";
import { saveMemories } from "./memory";
import { cacheGet, cachePut, sha } from "./router";

export const SLOTS = ["what", "where", "often", "done", "ok"] as const;
export type Slot = (typeof SLOTS)[number];
export type IntakeQuestion = { slot: Slot; text: string; options?: string[] };

/** The first line of the intake card: the transcript, the chat and the checks tell it apart from a worker's question. */
export const INTAKE_HEAD = "Before I plan, a few quick questions:";
/** The card's one button: a person who does not want to answer lets the crew decide (also the chat's no-answer fallback). */
export const INTAKE_SKIP = "Use your best judgment";
const MEMORY_PREFIX = "Intake";

// Mock mode and the fallback when the Nano reply does not parse: what each slot looks like in plain words.
const SLOT_RX: Record<Slot, RegExp> = {
  what: /\b(watch|track|check|find|read|summari[sz]e|draft|write|compare|monitor|list|build|fix|book|plan|review|brief|tell|send|research|analy[sz]e|run|keep|give|open|prepare|audit|scan)\b/i,
  where: /https?:\/\/|\b(inbox|calendar|e-?mails?|repo|github|csv|files?|data|sites?|pages?|feeds?|catalog|log|notifications?|from|in my|on my|at [A-Z])\b|\.(com|org|io|dev|csv|json|md)\b/i,
  often: /\b(every|daily|weekly|hourly|monthly|each|mornings?|evenings?|tonight|nightly|weekdays?|mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|once|today|now|at \d{1,2}(:\d{2})?)\b|\b\d{1,2}(:\d{2})?\s?(am|pm)\b/i,
  done: /\b(one page|summary|list|report|draft|tell me (when|if|what)|alert|only (if|when)|until|drops?|below|under|above|more than|threshold|pull request|brief|find the cause|deadline)\b|%/i,
  ok: /\b(approv\w*|my ok|ask (me )?(first|before)|before (sending|buying|booking|cancel\w*)|don'?t (send|buy|book)|without asking|needs? my|for me to review|for my ok)\b/i,
};

const WATCHING = /\b(watch|track|monitor|alert|price|prices)\b/i;

/** The question for a missing slot (mock mode, and the fallback when Nano's reply does not parse). */
function questionFor(slot: Slot, goal: string): IntakeQuestion {
  const watching = WATCHING.test(goal);
  switch (slot) {
    case "what":
      return { slot, text: "What exactly should the crew do?" };
    case "where":
      return { slot, text: watching ? "Which places, sites or pages should I watch? (for a trip: the hotel or the area, and your dates)" : "Where should I look: which sites, pages, files or accounts?" };
    case "often":
      return { slot, text: "How often should I do this?", options: ["Once, now", "Every morning", "Every week"] };
    case "done":
      return watching ? { slot, text: "What change is worth telling you about?", options: ["Any change", "A drop of 10 % or more", "A short summary each time"] } : { slot, text: "What counts as done?", options: ["A one-page summary", "A short list", "A draft for my OK"] };
    case "ok":
      return { slot, text: "What needs your OK first?", options: ["Anything sent, bought or booked", "Nothing, just tell me"] };
  }
}

/** Which slots the words fill, by rule. */
export function slotsByRule(text: string): Slot[] {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return SLOTS.filter((s) => (s === "what" ? words >= 3 && SLOT_RX.what.test(text) : SLOT_RX[s].test(text)));
}

/** Questions in the order that changes a plan most: what, where, done, how often, then what needs an OK. */
const PRIORITY: Slot[] = ["what", "where", "done", "often", "ok"];

type Check = { missing: Slot[]; questions: IntakeQuestion[]; usage: { in: number; out: number } };

/** The slot check. Mock mode: the rules above, $0. Real mode: one Nano call (cached), the rules when its reply does not parse. */
export async function checkSlots(goal: string, context: string): Promise<Check> {
  const byRule = (): Check => {
    const filled = new Set(slotsByRule(`${goal}\n${context}`));
    const missing = PRIORITY.filter((s) => !filled.has(s));
    return { missing, questions: missing.slice(0, 3).map((s) => questionFor(s, goal)), usage: { in: 0, out: 0 } };
  };
  if (modelMode() === "mock") return byRule();
  const prompt = `A person gave a crew of agents this goal. Check it for five slots: what (the task), where (the sources: sites, files, accounts, places), often (once or a schedule), done (what result or condition counts as done, or is worth telling them), ok (which actions need their approval first). The context may fill a slot.
Reply with JSON only: {"missing":["where","often"],"questions":[{"slot":"where","text":"Which hotel or area?","options":[]}]}
At most three questions, the one that changes the plan most first, each one short line for a phone. Options only where natural: at most 3, a few words each.

Goal: ${goal.slice(0, 600)}
Context: ${context.slice(0, 1500) || "(none)"}`;
  const key = sha(`intake|${prompt}`);
  const hit = await cacheGet(key);
  let text = hit ? String((hit.response as { text: string }).text) : "";
  let usage = { in: 0, out: 0 };
  if (!hit) {
    try {
      const r = await generateText({ model: getModel({ tier: INTAKE_TIER, role: "router", turn: 1 }), prompt, maxOutputTokens: 400, maxRetries: 1 });
      text = r.text;
      usage = { in: r.usage.inputTokens ?? 0, out: r.usage.outputTokens ?? 0 };
      await cachePut(key, TIERS[INTAKE_TIER], { text }, usage);
    } catch (e) {
      console.error("[nimbus] intake check failed, using the rules:", e instanceof Error ? e.message : e);
      return byRule();
    }
  }
  const parsed = parseCheck(text);
  return parsed ? { ...parsed, usage } : { ...byRule(), usage };
}

function parseCheck(text: string): Omit<Check, "usage"> | null {
  const m = text.replace(/<think>[\s\S]*?<\/think>/g, "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]) as { missing?: unknown; questions?: { slot?: unknown; text?: unknown; options?: unknown }[] };
    const missing = (Array.isArray(j.missing) ? j.missing : []).filter((s): s is Slot => SLOTS.includes(s as Slot));
    const questions = (Array.isArray(j.questions) ? j.questions : [])
      .filter((q) => typeof q?.text === "string" && q.text.trim())
      .slice(0, 3)
      .map((q) => ({ slot: (SLOTS.includes(q.slot as Slot) ? q.slot : "what") as Slot, text: String(q.text).trim(), options: Array.isArray(q.options) ? q.options.filter((o): o is string => typeof o === "string" && !!o.trim()).slice(0, 3) : undefined }));
    return { missing, questions };
  } catch {
    return null;
  }
}

/** One card: the questions numbered, each one's options in brackets, and how to answer in one message. */
export function intakeCard(questions: IntakeQuestion[]): string {
  const lines = questions.map((q, i) => `${i + 1}. ${q.text}${q.options?.length ? ` (${q.options.join(" / ")})` : ""}`);
  return `${INTAKE_HEAD}\n${lines.join("\n")}\nAnswer in one message, e.g. "1. Shinjuku, Dec 12 to 15  2. 10 %  3. every morning".`;
}

/** "1. Shinjuku 2. 10 % 3. daily" → one answer per question; anything else → the whole answer for each question, once. */
export function splitAnswers(answer: string, n: number): string[] | null {
  const parts = answer.split(/(?:^|\s|[,;])(?=[1-9][.)]\s*)/).map((p) => p.trim()).filter(Boolean);
  const byNo = new Map<number, string>();
  for (const p of parts) {
    const m = p.match(/^([1-9])[.)]\s*([\s\S]+)$/);
    if (m && Number(m[1]) <= n) byNo.set(Number(m[1]), m[2].replace(/[,;\s]+$/, "").trim());
  }
  if (!byNo.size) return null;
  return Array.from({ length: n }, (_, i) => byNo.get(i + 1) ?? "");
}

/** Has this workstream answered its intake questions before? Then its memories fill the slots and nothing is asked. */
async function answeredBefore(workstreamId: string): Promise<boolean> {
  const db = await getDb();
  const rows = await retryBusy(() => db.select({ id: schema.memories.id }).from(schema.memories).where(and(eq(schema.memories.workstreamId, workstreamId), like(schema.memories.text, `${MEMORY_PREFIX}%`))).limit(1));
  return rows.length > 0;
}

/**
 * Runs inside the Orchestrator before its first hop. Asks only when two or more slots are missing; the answers become
 * memories ("Intake · where: Shinjuku, Dec 12 to 15") and join this run's prompt at once.
 */
export async function runIntake(ctx: RunCtx): Promise<void> {
  if (!ctx.intake || (await answeredBefore(ctx.workstreamId))) return;
  const context = [ctx.intake.wsGoal.trim() !== ctx.goal.trim() ? ctx.intake.wsGoal : "", ...ctx.memories].filter(Boolean).join("\n");
  const check = await checkSlots(ctx.goal, context);
  if (check.usage.in || check.usage.out) {
    const c = costUsd(INTAKE_TIER, check.usage.in, check.usage.out);
    ctx.usage.in += check.usage.in;
    ctx.usage.out += check.usage.out;
    ctx.usage.costUsd += c;
    ctx.usage.baselineUsd += c;
    const bt = ctx.usageByTier[INTAKE_TIER];
    bt.in += check.usage.in;
    bt.out += check.usage.out;
    bt.costUsd += c;
  }
  if (check.missing.length < 2 || !check.questions.length) return;
  const questions = check.questions.slice(0, 3);
  // the mock picks its script from a run's first answer (live.ts askUser); an intake answer must not change the crew's script
  const script = ctx.script;
  const answer = (await ctx.askUser("orchestrator", "orchestrator", intakeCard(questions), [INTAKE_SKIP])).trim();
  ctx.script = script;
  const goal = ctx.goal.length > 80 ? `${ctx.goal.slice(0, 80)}…` : ctx.goal;
  let mems: string[];
  if (!answer || answer === INTAKE_SKIP) mems = [`${MEMORY_PREFIX} for "${goal}": the person left ${questions.map((q) => q.slot).join(", ")} to the crew's judgment.`];
  else {
    const per = splitAnswers(answer, questions.length);
    mems = per ? questions.flatMap((q, i) => (per[i] ? [`${MEMORY_PREFIX} · ${q.slot}: ${q.text} ${per[i]}`] : [])) : [`${MEMORY_PREFIX} for "${goal}": ${answer}`];
  }
  await retryBusy(() => saveMemories(ctx.workstreamId, ctx.runId, mems, "intake"));
  ctx.memories.push(...mems);
}
