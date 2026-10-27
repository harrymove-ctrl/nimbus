// The conversation layer behind POST /v1/chat/completions when `model` is "nimbus" (docs/CHAT-APPS.md Phase A):
// one message in, one intent out (approve, deny, answer, status, ask, run, help), an answer short enough for a phone.
// Rules decide first (free, instant); only a message no rule recognises goes to the cached Nano classifier.
import { and, desc, eq } from "drizzle-orm";
import { generateText } from "ai";
import { getDb, retryBusy, schema } from "@/db";
import type { AnyRunEvent } from "@/lib/events";
import { getModel, modelMode } from "@/lib/tokenfactory";
import { TIERS } from "@/lib/models";
import { WORKSTREAMS, type Workstream } from "@/lib/workstreams";
import { checkDayBudget } from "./budget";
import { lastUserText, messagesOf, textOf, type ChatBody, type Usage } from "./chat-api";
import { PHONE_MAX, ago, publicBase, runLink, toPhone, waitingFromEvents, type Waiting } from "./chat-util";
import { markFollowed } from "./notify";
import { cacheGet, cachePut, sha } from "./router";
import { getRun, liveRuns, startRun, type RunHandle } from "./source";

export type IntentName = "approve" | "deny" | "answer" | "status" | "ask" | "run" | "help";
export type Intent = { name: IntentName; note?: string; all?: boolean; ws?: Workstream | null; via: "rule" | "classifier" };

export type Thread = { key: string; lastRunId: string | null; pendingApprovalId: string | null; pendingQuestionId: string | null; updatedAt: number };
export type Turn = { intent: IntentName; pieces: AsyncGenerator<string>; usage: () => Usage; runId?: string; link?: string };
export type ChatFailure = { error: { status: number; message: string; code?: string } };

/* ------------------------------------------------------------------ threads (A4) */

/** token + `user` field when the client sends one, else the system prompt + first user message: one person, one bot → one thread. */
export function threadKey(token: string, body: ChatBody): string {
  const msgs = messagesOf(body);
  const system = msgs.filter((m) => m.role === "system").map((m) => textOf(m.content)).join("\n");
  const first = msgs.find((m) => m.role === "user");
  const who = body.user ? `user:${body.user}` : `conv:${sha(`${system}|${first ? textOf(first.content) : ""}`)}`;
  return sha(`${token}|${who}`).slice(0, 32);
}

export async function getThread(key: string): Promise<Thread> {
  const db = await getDb();
  const [row] = await db.select().from(schema.chatThreads).where(eq(schema.chatThreads.key, key));
  return row ?? { key, lastRunId: null, pendingApprovalId: null, pendingQuestionId: null, updatedAt: 0 };
}

export async function saveThread(key: string, patch: Partial<Omit<Thread, "key">>): Promise<void> {
  const db = await getDb();
  const cur = await getThread(key);
  const next = { ...cur, ...patch, key, updatedAt: Date.now() };
  await retryBusy(() => db.insert(schema.chatThreads).values(next).onConflictDoUpdate({ target: schema.chatThreads.key, set: { lastRunId: next.lastRunId, pendingApprovalId: next.pendingApprovalId, pendingQuestionId: next.pendingQuestionId, updatedAt: next.updatedAt } }));
}

const split = (id: string | null): [string, string] | null => {
  const i = id ? id.indexOf(":") : -1;
  return id && i > 0 ? [id.slice(0, i), id.slice(i + 1)] : null;
};

type Target = { run: RunHandle; w: Waiting };
/** What this conversation can answer right now: its own announced item first, then the latest one announced to any chat (the Telegram push), then anything waiting. */
async function findTarget(th: Thread, kind: Waiting["kind"]): Promise<{ target: Target | null; others: number }> {
  const own = split(kind === "approval" ? th.pendingApprovalId : th.pendingQuestionId);
  const live = (runId: string) => getRun(runId);
  const pickIn = (run: RunHandle | undefined, id?: string): Target | null => {
    if (!run || run.finished) return null;
    const ws = waitingFromEvents(run.events).filter((w) => w.kind === kind);
    const w = id ? ws.find((x) => x.id === id) : ws[0];
    return w ? { run, w } : null;
  };
  let target = own ? pickIn(live(own[0]), own[1]) : null;
  if (!target) {
    const db = await getDb();
    const rows = (await db.select().from(schema.chatThreads).orderBy(desc(schema.chatThreads.updatedAt))).filter((r) => (kind === "approval" ? r.pendingApprovalId : r.pendingQuestionId));
    for (const r of rows) {
      const s = split(kind === "approval" ? r.pendingApprovalId : r.pendingQuestionId);
      target = s ? pickIn(live(s[0]), s[1]) : null;
      if (target) break;
    }
  }
  if (!target) for (const run of liveRuns().sort((a, b) => b.startedAt - a.startedAt)) if ((target = pickIn(run))) break;
  const others = target ? waitingFromEvents(target.run.events).filter((w) => w.kind === kind && w.id !== target!.w.id).length : 0;
  return { target, others };
}

/* ------------------------------------------------------------------ intents (A3) */

const KEYWORDS: Record<string, string[]> = {
  "ship-nimbus": ["ship nimbus", "ship", "the repo", "repo", "evals", "pull request"],
  "hackathon-radar": ["hackathon radar", "radar", "hackathons", "hackathon"],
  "morning-brief": ["morning brief", "brief", "inbox", "emails", "replies"],
  "cost-audit": ["cost audit", "token factory cost", "audit", "spend"],
  "token-factory-watch": ["token factory watch", "token factory", "prices", "price", "catalog"],
  "release-watch": ["release watch", "releases", "release", "sdk"],
  "checkout-drop": ["checkout", "conversion"],
};

/** The workstream a sentence is about: the longest keyword phrase that appears in it. */
export function matchWorkstream(text: string): Workstream | null {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9 ]+/g, " ")} `;
  let best: { w: Workstream; score: number } | null = null;
  for (const w of WORKSTREAMS) {
    if (w.archived) continue;
    for (const k of [...(KEYWORDS[w.slug ?? ""] ?? []), w.title.toLowerCase()]) if (t.includes(` ${k} `) && (!best || k.length > best.score)) best = { w, score: k.length };
  }
  return best?.w ?? null;
}

const APPROVE = /^(approve( all)?|approved|yes( please)?|yep|yeah|y|ok(ay)?|sure|go ahead|do it|send it|ok(ay)? send it|looks good|lgtm|👍)$/i;
const DENY = /^(deny|denied|reject(ed)?|no|nope|n|don'?t( do it| send it)?|cancel|👎)\b[\s:,\-–]*([\s\S]*)$/i;
const HELP = /^(help|\/help|\/start|start|hi|hello|hey|\?|what can you do|commands)$/i;
const STATUS = /^(\/status|status|what('?s| is| are)( currently| now)? (running|waiting|pending|going on|up)|what needs (me|my (ok|approval|attention))|anything (waiting|pending|needs me|for me)|(is )?anything (running|waiting)|any(thing)? (running|waiting)|what('?s| is) happening|show (me )?(runs|status))\b.*$/i;
const RUN_VERB = /^(please |pls )?(run|start|kick off|launch|trigger|do|check|ship|scan|audit|prepare|draft|go)\b/i;
const ASK_START = /^(what|when|where|why|how|did|does|do you|is|are|was|were|which|who|show|tell|summari[sz]e|any|list|give me|explain|remind)\b/i;

const WORDS = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** Rules first. Returns null when no rule is sure, which sends the message to the classifier. */
export function ruleIntent(raw: string, ctx: { approval: boolean; question: boolean }): Intent | null {
  const text = raw.trim();
  const t = text.replace(/[!.\s]+$/, "");
  const intent = (name: IntentName, extra: Partial<Intent> = {}): Intent => ({ name, via: "rule", ...extra });
  if (HELP.test(t)) return intent("help");
  if (STATUS.test(t)) return intent("status");
  // a question waits and nothing else does: a bare "yes", "1" or free text answers it
  if (ctx.question && !ctx.approval && !RUN_VERB.test(t)) return intent("answer");
  if (/^\d{1,2}$/.test(t)) return intent("answer"); // a bare number is a pick from a list, even a late one
  if (APPROVE.test(t)) return intent("approve", { all: /\ball$/i.test(t) });
  const d = DENY.exec(t);
  if (d && (WORDS(t) <= 12 || /[:,]/.test(t))) return intent("deny", { note: d[4]?.trim() || undefined });
  if (ctx.question) return intent("answer"); // both wait: explicit approve/deny words went to the approval above
  const ws = matchWorkstream(t);
  if (RUN_VERB.test(t) && !/\?$/.test(t)) return intent("run", { ws });
  if (/\?$/.test(t) || ASK_START.test(t)) return intent("ask", { ws });
  if (ws && WORDS(t) <= 4) return intent("run", { ws });
  return null;
}

const INTENT_NAMES: IntentName[] = ["approve", "deny", "answer", "status", "ask", "run", "help"];

/** Nano classifier for what the rules could not place. Mock mode has no model to call: a fixed, documented fallback. */
async function classify(text: string, ctx: { approval: boolean; question: boolean }): Promise<{ name: IntentName; usage: { in: number; out: number } }> {
  if (modelMode() === "mock") return { name: matchWorkstream(text) ? "run" : "ask", usage: { in: 0, out: 0 } };
  const prompt = `You route one chat message sent to a work assistant. Reply with exactly one word from: approve, deny, answer, status, ask, run, help.\napprove/deny = decide a waiting request${ctx.approval ? " (one is waiting)" : ""}; answer = reply to the crew's question${ctx.question ? " (one is waiting)" : ""}; status = what is running or waiting; ask = a question about past work; run = start work now; help = what can you do.\nMessage: ${text.slice(0, 400)}`;
  const key = sha(`intent|${prompt}`);
  const hit = await cacheGet(key);
  const word = hit ? String((hit.response as { text: string }).text) : "";
  if (INTENT_NAMES.includes(word as IntentName)) return { name: word as IntentName, usage: { in: 0, out: 0 } };
  const r = await generateText({ model: getModel({ tier: "nano", role: "router", turn: 1 }), prompt, maxOutputTokens: 8, maxRetries: 0 });
  const got = r.text.trim().toLowerCase().split(/[^a-z]+/)[0] as IntentName;
  const name = INTENT_NAMES.includes(got) ? got : "ask";
  const usage = { in: r.usage.inputTokens ?? 0, out: r.usage.outputTokens ?? 0 };
  await cachePut(key, TIERS.nano, { text: name }, usage);
  return { name, usage };
}

export async function routeIntent(text: string, ctx: { approval: boolean; question: boolean }): Promise<{ intent: Intent; usage: { in: number; out: number } }> {
  const rule = ruleIntent(text, ctx);
  if (rule) return { intent: rule, usage: { in: 0, out: 0 } };
  const c = await classify(text, ctx);
  return { intent: { name: c.name, ws: matchWorkstream(text), via: "classifier", note: c.name === "deny" ? text : undefined }, usage: c.usage };
}

/* ------------------------------------------------------------------ the turn */

const QUESTION_WAIT_MS = () => Number(process.env.NIMBUS_CHAT_QUESTION_WAIT_MS) || 10 * 60_000;
const HELP_TEXT = "Nimbus: your crew, from this chat.\n• run morning brief\n• what needs me?\n• what did the radar find today?\n• approve  /  deny: too long";

async function* say(text: string): AsyncGenerator<string> {
  yield text;
}

/** `ws` set = the client asked for nimbus/<workstream>: no routing, the message starts that workstream (the pre-chat-apps behaviour). */
export async function handleChat(body: ChatBody, o: { token: string; origin: string; ws?: Workstream }): Promise<Turn | ChatFailure> {
  const text = lastUserText(body) ?? "";
  const key = threadKey(o.token, body);
  const th = await getThread(key);
  const base = publicBase(o.origin);
  let tokens = { in: 0, out: 0 };
  const usage = (): Usage => ({ prompt_tokens: tokens.in, completion_tokens: tokens.out, total_tokens: tokens.in + tokens.out });
  const done = (intent: IntentName, pieces: AsyncGenerator<string>, extra: Partial<Turn> = {}): Turn => ({ intent, pieces, usage, ...extra });

  const none = { target: null, others: 0 };
  const [apr, qst] = o.ws ? [none, none] : await Promise.all([findTarget(th, "approval"), findTarget(th, "question")]);
  const { intent, usage: u } = o.ws ? { intent: { name: "run", ws: o.ws, via: "rule" } as Intent, usage: { in: 0, out: 0 } } : await routeIntent(text, { approval: !!apr.target, question: !!qst.target });
  tokens = { in: u.in, out: u.out };

  switch (intent.name) {
    case "help":
      return done("help", say(HELP_TEXT));

    case "status":
      return done("status", say(await statusText(base)));

    case "approve":
    case "deny": {
      const { target, others } = apr;
      if (!target || target.w.kind !== "approval") return done(intent.name, say("Nothing is waiting for your OK.\nSay \"what needs me?\" to check."));
      const approved = intent.name === "approve";
      const ids = approved && intent.all ? waitingFromEvents(target.run.events).filter((w) => w.kind === "approval").map((w) => w.id) : [target.w.id];
      const labels: string[] = [];
      for (const id of ids) {
        const w = waitingFromEvents(target.run.events).find((x) => x.kind === "approval" && x.id === id);
        if (w?.kind === "approval" && target.run.resolveApproval(id, { decision: approved ? "approved" : "rejected", note: approved ? undefined : intent.note, by: "chat" })) labels.push(w.summary);
      }
      await saveThread(key, { lastRunId: target.run.id, pendingApprovalId: null });
      const left = approved && intent.all ? 0 : others;
      const head = `${approved ? "Approved" : "Rejected"}: ${labels.join("; ") || target.w.summary}.${!approved && intent.note ? ` Noted: "${intent.note}".` : ""}${left ? `\n${left} more waiting. Reply approve (or approve all).` : ""}\n`;
      return done(intent.name, (async function* () {
        yield head;
        yield* follow(target.run, { key, base, from: target.run.events.length, used: head.length });
      })(), { runId: target.run.id, link: runLink(target.run.id, base) });
    }

    case "answer": {
      const { target } = qst;
      if (!target || target.w.kind !== "question") return done("answer", say(await noQuestionText(th)));
      const opts = target.w.options ?? [];
      const n = /^\d+$/.test(text.trim()) ? Number(text.trim()) : 0;
      if (n && opts.length && (n < 1 || n > opts.length)) return done("answer", say(`Pick a number from 1 to ${opts.length}, or type your answer.`));
      const answer = n && opts.length ? opts[n - 1] : (opts.find((x) => x.toLowerCase() === text.trim().toLowerCase()) ?? text.trim());
      target.run.postMessage({ kind: "answer", text: answer, questionId: target.w.id, via: "chat" });
      await saveThread(key, { lastRunId: target.run.id, pendingQuestionId: null });
      const head = `Answered ${target.w.agent}: ${answer}.\n`;
      return done("answer", (async function* () {
        yield head;
        yield* follow(target.run, { key, base, from: target.run.events.length, used: head.length });
      })(), { runId: target.run.id, link: runLink(target.run.id, base) });
    }

    case "ask": {
      const ws = intent.ws ?? (await bestWorkstreamFor(th));
      const a = await answerAsk(text, ws);
      tokens = { in: tokens.in + a.usage.in, out: tokens.out + a.usage.out };
      return done("ask", say(a.text));
    }

    case "run": {
      const ws = intent.ws;
      if (!ws) return done("run", say(`Which one?\n${WORKSTREAMS.filter((w) => !w.archived).map((w, i) => `${i + 1}) ${w.title}`).join("\n")}\nSay "run <name>".`));
      const budget = await checkDayBudget();
      if (!budget.ok) return { error: { status: 429, message: budget.message ?? "Daily spend cap reached", code: "day_cap" } };
      const run = startRun({ workstreamId: ws.id, title: ws.title, goal: text || ws.goal, trigger: "chat", mode: "ask", tools: ws.tools });
      await saveThread(key, { lastRunId: run.id, pendingApprovalId: null, pendingQuestionId: null });
      const ack = `On it: ${ws.title}.\n`; // first token at once
      return done("run", (async function* () {
        yield ack;
        yield* follow(run, { key, base, from: 0, used: ack.length });
      })(), { runId: run.id, link: runLink(run.id, base) });
    }
  }
}

/* ------------------------------------------------------------------ following a run (A5, A6) */

type FollowOpts = { key: string; base: string; from: number; used: number };

/**
 * Text for as long as the run is going, until it needs the person (an approval or a question: the reply ends there and the
 * run keeps waiting) or it ends. The request that started the run is not the only follower: after "approve" or "1" the next
 * request picks the run up from the point where it was released.
 */
async function* follow(run: RunHandle, o: FollowOpts): AsyncGenerator<string> {
  const link = runLink(run.id, o.base);
  let used = o.used;
  const out = (s: string) => ((used += s.length), s);
  const queue: AnyRunEvent[] = [];
  let wake: (() => void) | undefined;
  const off = run.onEvent((e) => (queue.push(e), wake?.()));
  queue.push(...run.events.slice(o.from));
  const unmark = markFollowed(run.id);
  try {
    // something may already be waiting (several approvals at once): announce it instead of idling
    const first = waitingFromEvents(run.events)[0];
    if (first && o.from > 0) {
      yield out(await announce(run, first, o.key, link));
      return;
    }
    for (;;) {
      while (!queue.length) {
        if (run.finished && !queue.length) return;
        await new Promise<void>((r) => ((wake = r), setTimeout(r, 1000)));
      }
      const e = queue.shift()!;
      if (e.type === "plan" && !e.payload.awaiting) yield out(`Plan: ${e.payload.agents.map((a) => a.role).join(", ")}.\n`);
      else if (e.type === "approval.request" || e.type === "question") {
        const id = e.type === "question" ? e.payload.questionId : e.payload.approvalId;
        if (!waitingFromEvents(run.events).some((x) => x.id === id && x.kind === (e.type === "question" ? "question" : "approval"))) continue; // a saved policy or Auto resolved it in the same tick
        await new Promise((r) => setTimeout(r, Number(process.env.NIMBUS_CHAT_SETTLE_MS) || 600)); // agents ask in parallel: let the others arrive so "2 more waiting" is true
        const w = waitingFromEvents(run.events)[0];
        if (!w) continue;
        yield out(await announce(run, w, o.key, link));
        return;
      } else if (e.type === "run.end") {
        yield out(finalText(run, e.payload.status, link, used));
        return;
      } else if (e.type === "run.error") {
        yield out(`Run failed: ${e.payload.message}\n${link}\n`);
        return;
      }
    }
  } finally {
    off();
    unmark();
  }
}

/** The document that answers for a run: the one titled like the workstream ("Morning brief · Tue Oct 27"), else the last. Drafts it also wrote come later. */
function pickDoc<T extends { title: string }>(docs: T[], wsTitle: string): T | undefined {
  const t = wsTitle.toLowerCase();
  return docs.find((d) => d.title.toLowerCase().startsWith(t)) ?? docs[docs.length - 1];
}

function finalText(run: RunHandle, status: string, link: string, used: number): string {
  if (status !== "done") return `Run ${status}.\n${link}\n`;
  const title = (run.events.find((e) => e.type === "run.start") as Extract<AnyRunEvent, { type: "run.start" }> | undefined)?.payload.title ?? "";
  const docs = run.events.flatMap((e) => (e.type === "artifact.version" && e.payload.kind === "doc" ? [e.payload] : []));
  // the newest version of each document
  const latest = [...new Map(docs.map((d) => [d.artifactId, d])).values()];
  const last = [...run.events].reverse().find((e) => e.type === "message" && e.agentInstance === "orchestrator" && e.payload.role === "agent" && !e.payload.card);
  const md = pickDoc(latest, title)?.content ?? (last && last.type === "message" ? last.payload.text : "Done.");
  const room = Math.max(300, PHONE_MAX - used - link.length - 2);
  return `${toPhone(md, { maxLines: 6, maxChars: room })}\n${link}\n`;
}

/** The notice for an approval or a question; records it in the thread so the next message resolves it. */
async function announce(run: RunHandle, w: Waiting, key: string, link: string): Promise<string> {
  if (w.kind === "approval") {
    await saveThread(key, { lastRunId: run.id, pendingApprovalId: `${run.id}:${w.id}` });
    const more = waitingFromEvents(run.events).filter((x) => x.kind === "approval").length - 1;
    return `Needs your OK: ${w.summary}.${more > 0 ? `\n${more} more waiting after this.` : ""}\nReply approve or deny.\n${link}\n`;
  }
  await saveThread(key, { lastRunId: run.id, pendingQuestionId: `${run.id}:${w.id}` });
  armQuestionTimer(run, w, key);
  const opts = w.options ?? [];
  const wait = Math.round(QUESTION_WAIT_MS() / 60_000);
  const list = opts.length ? `${opts.map((o, i) => `${i + 1}) ${o}`).join("\n")}\nReply 1${opts.length > 1 ? `-${opts.length}` : ""} or type an answer.` : "Reply with your answer.";
  const fallback = opts.length ? ` If I hear nothing in ${wait >= 1 ? `${wait} min` : `${Math.round(QUESTION_WAIT_MS() / 1000)} s`}, the crew picks "${opts[opts.length - 1]}".` : "";
  return `${w.agent} asks: ${w.text}\n${list}${fallback}\n${link}\n`;
}

/** No answer in the wait window: take the old behaviour (the last option, or "best judgment") and leave a visible note on the run. */
function armQuestionTimer(run: RunHandle, w: Extract<Waiting, { kind: "question" }>, key: string) {
  const t = setTimeout(() => {
    if (run.finished || !waitingFromEvents(run.events).some((x) => x.kind === "question" && x.id === w.id)) return;
    const answer = w.options?.[w.options.length - 1] ?? "Use your best judgment.";
    run.postMessage({ kind: "answer", text: answer, questionId: w.id, via: "auto" });
    void saveThread(key, { pendingQuestionId: null }).catch(() => {});
  }, QUESTION_WAIT_MS());
  t.unref?.();
}

async function noQuestionText(th: Thread): Promise<string> {
  const run = th.lastRunId ? getRun(th.lastRunId) : undefined;
  const auto = run?.events.find((e) => e.type === "message" && e.payload.via === "auto");
  return auto && auto.type === "message" ? `No one is waiting on you. The crew got no answer in time and picked "${auto.payload.text}".` : "Nothing is waiting for an answer.";
}

/* ------------------------------------------------------------------ status, ask */

async function statusText(base: string): Promise<string> {
  const lines: string[] = [];
  let needs = 0;
  let running = 0;
  for (const run of liveRuns().sort((a, b) => b.startedAt - a.startedAt)) {
    const ws = WORKSTREAMS.find((w) => w.id === run.workstreamId);
    const title = ws?.title ?? run.workstreamId;
    const wait = waitingFromEvents(run.events)[0];
    if (wait) {
      needs++;
      lines.push(`• ${title}: ${wait.kind === "approval" ? `OK to ${wait.summary}` : `asks "${wait.text}"`} → ${runLink(run.id, base)}`);
    } else {
      running++;
      lines.push(`• ${title}: running, ${ago(run.startedAt).replace(" ago", "")} → ${runLink(run.id, base)}`);
    }
  }
  if (!lines.length) {
    const db = await getDb();
    const [last] = await db.select().from(schema.runs).orderBy(desc(schema.runs.startedAt)).limit(1);
    return `Nothing is running or waiting.${last ? `\nLast: ${last.title}, ${last.status} ${ago(last.endedAt ?? last.startedAt)}.` : ""}`;
  }
  return `${needs} need${needs === 1 ? "s" : ""} you · ${running} running\n${lines.join("\n")}`;
}

async function bestWorkstreamFor(th: Thread): Promise<Workstream | null> {
  const db = await getDb();
  const id = th.lastRunId ?? (await db.select().from(schema.runs).orderBy(desc(schema.runs.startedAt)).limit(1))[0]?.id;
  if (!id) return null;
  const [r] = await db.select().from(schema.runs).where(eq(schema.runs.id, id));
  return WORKSTREAMS.find((w) => w.id === r?.workstreamId) ?? null;
}

const STOP = new Set("a an and are as at be but by did do does for from get got had has have how i in is it its me my of on or our so than that the their then there these they this to up was we were what when where which who why will with you your today yesterday find found say said tell show please about any".split(" "));
const terms = (s: string) => s.toLowerCase().replace(/[^a-z0-9$%.\- ]+/g, " ").split(/\s+/).filter((x) => x.length > 1 && !STOP.has(x));

/** "What did the radar find today?": answered from the workstream's latest document and its memories, with no new run. */
export async function answerAsk(question: string, ws: Workstream | null): Promise<{ text: string; usage: { in: number; out: number } }> {
  if (!ws) return { text: "I have no finished work to answer from yet.\nTry \"run morning brief\" first.", usage: { in: 0, out: 0 } };
  const db = await getDb();
  const runs = await db.select().from(schema.runs).where(and(eq(schema.runs.workstreamId, ws.id), eq(schema.runs.status, "done"))).orderBy(desc(schema.runs.startedAt)).limit(5);
  let doc: { title: string; content: string; runId: string; at: number } | null = null;
  for (const r of runs) {
    const arts = await db.select().from(schema.artifacts).where(and(eq(schema.artifacts.runId, r.id), eq(schema.artifacts.kind, "doc"))).orderBy(desc(schema.artifacts.createdAt));
    const latest = [...new Map(arts.slice().reverse().map((a) => [a.artifactId, a])).values()]; // newest version of each document, oldest document first
    const a = pickDoc(latest, ws.title);
    if (a) {
      doc = { title: a.title, content: a.content, runId: r.id, at: r.endedAt ?? r.startedAt };
      break;
    }
  }
  const mems = (await db.select().from(schema.memories).where(eq(schema.memories.workstreamId, ws.id))).map((m) => m.text);
  if (!doc && !mems.length) return { text: `${ws.title} has not produced anything yet.\nSay "run ${ws.title.toLowerCase()}" to start it.`, usage: { in: 0, out: 0 } };
  const src = doc ? `From ${ws.title}, ${ago(doc.at)}` : `From what ${ws.title} has learned`;

  if (modelMode() !== "mock") {
    const ctx = `${doc ? `DOCUMENT (${doc.title}):\n${doc.content.slice(0, 6000)}\n\n` : ""}MEMORIES:\n${mems.slice(0, 12).map((m) => `- ${m}`).join("\n")}`;
    const key = sha(`ask|${ws.id}|${sha(ctx)}|${question}`);
    const hit = await cacheGet(key);
    if (hit) return { text: `${String((hit.response as { text: string }).text)}\n${src}.`, usage: { in: 0, out: 0 } };
    const r = await generateText({ model: getModel({ tier: "nano", role: "router", turn: 1 }), prompt: `Answer the question using only the material below. At most 5 short lines, plain text, numbers first. If the material does not say, say so.\n\n${ctx}\n\nQuestion: ${question}`, maxOutputTokens: 300, maxRetries: 0 });
    const usage = { in: r.usage.inputTokens ?? 0, out: r.usage.outputTokens ?? 0 };
    await cachePut(key, TIERS.nano, { text: r.text.trim() }, usage);
    return { text: `${toPhone(r.text, { maxChars: PHONE_MAX - 80 })}\n${src}.`, usage };
  }

  // Mock mode: extractive. The lines of the document and the memories that share the most words with the question.
  const own = new Set(terms(`${ws.title} ${(KEYWORDS[ws.slug ?? ""] ?? []).join(" ")}`)); // "the radar" matches every line of the radar's doc: it says which doc, not which line
  const q = new Set(terms(question).filter((x) => !own.has(x)));
  const body = doc ? toPhone(doc.content, { maxLines: 400, maxChars: 100_000 }).split("\n").slice(/^#/.test(doc.content.trim()) ? 1 : 0) : [];
  const pool = [...body, ...mems.map((m) => `• ${m}`)].filter((l) => l.length > 3);
  const scored = pool.map((l, i) => ({ l, i, s: terms(l).filter((x) => q.has(x)).length })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.i - b.i).slice(0, 4).sort((a, b) => a.i - b.i);
  const lines = scored.length ? scored.map((x) => x.l) : pool.slice(0, 4);
  return { text: `${toPhone(lines.join("\n"), { maxLines: 5, maxChars: PHONE_MAX - 80 })}\n${src}.`, usage: { in: 0, out: 0 } };
}
