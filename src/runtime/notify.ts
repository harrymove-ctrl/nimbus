// Nimbus messages you first (docs/CHAT-APPS.md Phase B, docs/ROADMAP.md §2): when a run nobody is watching needs a person,
// or ends, Telegram messages go out through the Bot API.
//
// Two modes. NIMBUS_TELEGRAM_MODE=poll (the default) means Nimbus owns the bot (src/runtime/telegram.ts reads its updates):
// every approval and every crew question arrives as its own card with inline buttons, and the card is edited once decided,
// wherever the decision came from. NIMBUS_TELEGRAM_MODE=off means another client (OpenClaw) owns the bot's incoming
// messages: send only, plain text, "Reply approve or deny", and the reply arrives through /v1 as an ordinary chat message.
// Either way the announced item is recorded in chat_threads, so a typed "approve" resolves it.
//
// Needs NIMBUS_TELEGRAM_BOT_TOKEN and NIMBUS_TELEGRAM_CHAT_ID. NIMBUS_TELEGRAM_API_BASE points at a local stub in tests.
// The token is only ever put in the request path; it is never logged.
import type { AnyRunEvent } from "@/lib/events";
import { PHONE_MAX, pickDoc, publicBase, runLink, toPhone, waitingFromEvents, type Waiting } from "./chat-util";

declare global {
  var __nimbusFollowed: Map<string, number> | undefined;
  var __nimbusTgCards: Map<string, Card> | undefined;
}
const followed = (globalThis.__nimbusFollowed ??= new Map<string, number>());

/** A chat request is following this run (its reply carries approvals and the result): do not also message. Returns the release. */
export function markFollowed(runId: string): () => void {
  followed.set(runId, (followed.get(runId) ?? 0) + 1);
  return () => {
    const n = (followed.get(runId) ?? 1) - 1;
    if (n <= 0) followed.delete(runId);
    else followed.set(runId, n);
  };
}

const token = () => process.env.NIMBUS_TELEGRAM_BOT_TOKEN || "";
const chatId = () => process.env.NIMBUS_TELEGRAM_CHAT_ID || "";
export const telegramConfigured = () => !!(token() && chatId());
/** Nimbus reads the bot's updates itself, so pushes can carry buttons (anything but NIMBUS_TELEGRAM_MODE=off). */
export const telegramPolling = () => !!token() && (process.env.NIMBUS_TELEGRAM_MODE || "poll").toLowerCase() !== "off";
/** The thread key under which pushed approvals and questions are recorded; any chat's "approve" falls back to it. */
export const telegramThreadKey = () => `tg:${chatId()}`;

export type InlineKeyboard = { text: string; callback_data: string }[][];

/** One Bot API call. Returns `result`, or null on any failure (logged by HTTP status and Telegram's description, never the URL). */
export async function telegramApi<T = unknown>(method: string, body: Record<string, unknown>, o: { signal?: AbortSignal; quiet?: boolean } = {}): Promise<T | null> {
  if (!token()) return null;
  const base = (process.env.NIMBUS_TELEGRAM_API_BASE || "https://api.telegram.org").replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/bot${token()}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: o.signal ?? AbortSignal.timeout(10_000),
    });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null;
    if (!res.ok || !json?.ok) {
      if (!o.quiet) console.error(`[nimbus] telegram ${method} failed: HTTP ${res.status}${json?.description ? ` ${json.description}` : ""}`);
      return null;
    }
    return (json.result ?? null) as T | null;
  } catch (e) {
    if (!o.quiet && !(e instanceof Error && e.name === "AbortError")) console.error(`[nimbus] telegram ${method} failed:`, e instanceof Error ? e.name : "error"); // not the message: undici puts the URL (and so the token) in it
    return null;
  }
}

/** A message to the owner's chat; returns its message id, or null. */
export async function sendTelegram(text: string, keyboard?: InlineKeyboard, chat = chatId()): Promise<number | null> {
  if (!token() || !chat) return null;
  const m = await telegramApi<{ message_id: number }>("sendMessage", { chat_id: chat, text: text.slice(0, 4000), disable_web_page_preview: true, ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}) });
  return m?.message_id ?? null;
}

/** Replace a message's text; no keyboard given removes its buttons. */
export async function editTelegram(messageId: number, text: string, keyboard?: InlineKeyboard, chat = chatId()): Promise<boolean> {
  const r = await telegramApi("editMessageText", { chat_id: chat, message_id: messageId, text: text.slice(0, 4000), disable_web_page_preview: true, reply_markup: { inline_keyboard: keyboard ?? [] } }, { quiet: true });
  return r !== null;
}

/* ------------------------------------------------------------------ cards (poll mode) */

/** A pushed approval or question, so its message can be edited when it is decided (here, in the web app, or by a typed reply). */
export type Card = { messageId: number; text: string; runId: string; title: string; w: Waiting };
const cards = (globalThis.__nimbusTgCards ??= new Map<string, Card>());
export const cardKey = (runId: string, kind: Waiting["kind"], id: string) => `${runId}:${kind}:${id}`;
export const getCard = (runId: string, kind: Waiting["kind"], id: string) => cards.get(cardKey(runId, kind, id));

/** Callback data stays under Telegram's 64 bytes: `a:<run>:<approval>:<y|al|n>` and `q:<run>:<question>:<option index>`. */
export function approvalKeyboard(runId: string, approvalId: string): InlineKeyboard {
  return [[{ text: "Approve", callback_data: `a:${runId}:${approvalId}:y` }, { text: "Always allow", callback_data: `a:${runId}:${approvalId}:al` }, { text: "Reject", callback_data: `a:${runId}:${approvalId}:n` }]];
}
export function questionKeyboard(runId: string, questionId: string, options: string[]): InlineKeyboard {
  return options.slice(0, 8).map((o, i) => [{ text: o.length > 60 ? `${o.slice(0, 57)}…` : o, callback_data: `q:${runId}:${questionId}:${i}` }]);
}

/** "writer-2" → "Writer 2", "analyst-1" → "Analyst" (the lane names the web app shows). */
const who = (instance: string) => instance.replace(/-1$/, "").replace(/-(\d+)$/, " $1").replace(/^\w/, (c) => c.toUpperCase());

async function pushCard(r: Source, w: Waiting) {
  const key = cardKey(r.runId, w.kind, w.id);
  if (cards.has(key)) return;
  const link = runLink(r.runId, publicBase());
  let text: string;
  let keyboard: InlineKeyboard;
  if (w.kind === "approval") {
    text = toPhone(`${r.title} needs your OK: ${w.summary}.\nRisk: ${w.risk} · asked by ${who(w.agent)}\n${link}`, { maxLines: 8 });
    keyboard = approvalKeyboard(r.runId, w.id);
  } else {
    const opts = w.options ?? [];
    text = toPhone(`${r.title}: ${who(w.agent)} asks: ${w.text}\n${opts.length ? "Tap an option or type your answer." : "Reply with your answer."}\n${link}`, { maxLines: 8 });
    keyboard = questionKeyboard(r.runId, w.id, opts);
  }
  cards.set(key, { messageId: 0, text, runId: r.runId, title: r.title, w }); // claimed before the send: a second batch must not push it again
  const id = await sendTelegram(text, keyboard.length ? keyboard : undefined);
  if (id === null) return void cards.delete(key);
  cards.set(key, { messageId: id, text, runId: r.runId, title: r.title, w });
  if (cards.size > 200) cards.delete(cards.keys().next().value as string);
}

/** The card's last state: the decision, who made it, and no buttons (the record stays in the chat). */
async function settleCard(card: Card, line: string) {
  if (!card.messageId) return;
  card.text = `${card.text}\n${line}`;
  await editTelegram(card.messageId, card.text);
}

/** Reject was tapped: the buttons go, and the card asks for a one-line note. */
export async function askRejectNote(card: Card) {
  if (card.messageId) await editTelegram(card.messageId, `${card.text}\nReject: reply with one line of note, or /skip.`);
}

const VIA = (by: string) => (by === "you" ? "in the web app" : by === "policy" ? "by a saved rule" : by === "mode" ? "automatically (low risk)" : by === "system" ? "by Nimbus" : `via ${by}`);

/* ------------------------------------------------------------------ the event hook */

type Source = { runId: string; title: string; trigger: string; /** someone has this run open in the web app */ watching: boolean; events: readonly AnyRunEvent[] };

const batches = new Map<string, ReturnType<typeof setTimeout>>();
const BATCH_MS = () => Number(process.env.NIMBUS_NOTIFY_BATCH_MS) || 1200;

/** Called by the live runtime for every event of every run; does nothing unless it is the right moment to message. */
export function notifyEvent(r: Source, e: AnyRunEvent): void {
  if (!telegramConfigured() || r.trigger === "manual") return;
  // a pushed card was decided (a button, a typed reply, the web app): show it on the card, whoever is watching
  if (e.type === "approval.resolve") {
    const c = cards.get(cardKey(r.runId, "approval", e.payload.approvalId));
    if (c) void settleCard(c, `${e.payload.decision === "approved" ? "Approved" : "Rejected"} ${VIA(e.payload.by)}${e.payload.always ? " · always allow saved" : ""}${e.payload.note ? `: "${e.payload.note}"` : ""}.`);
    return;
  }
  if (e.type === "message" && e.payload.answerTo) {
    const c = cards.get(cardKey(r.runId, "question", e.payload.answerTo));
    if (c) void settleCard(c, `Answered ${e.payload.via === "auto" ? "automatically (no reply in time)" : e.payload.via ? `via ${e.payload.via}` : "in the web app"}: ${e.payload.text}`);
    return;
  }
  // a run started from Telegram reports to Telegram even when the web app also has it open
  if (r.watching && r.trigger !== "telegram") return;
  if ((followed.get(r.runId) ?? 0) > 0) return; // a chat request is following the run: its reply carries this
  if (e.type === "approval.request") {
    // Several approvals arrive together (Morning brief: three replies): wait for the batch, then one message (or one card each).
    if (batches.has(r.runId)) return;
    batches.set(
      r.runId,
      setTimeout(() => {
        batches.delete(r.runId);
        void announceApprovals(r);
      }, BATCH_MS()),
    );
  } else if (e.type === "question") {
    void announceQuestion(r, e.payload.questionId);
  } else if (e.type === "run.end") {
    void announceEnd(r, e.payload.status);
  }
}

async function record(patch: { runId: string; pendingApprovalId?: string; pendingQuestionId?: string }) {
  const { saveThread } = await import("./chat"); // lazy: chat.ts imports this file
  await saveThread(telegramThreadKey(), { lastRunId: patch.runId, ...(patch.pendingApprovalId ? { pendingApprovalId: patch.pendingApprovalId } : {}), ...(patch.pendingQuestionId ? { pendingQuestionId: patch.pendingQuestionId } : {}) });
}
const recordErr = (e: unknown) => console.error("[nimbus] chat thread write failed:", e instanceof Error ? e.message : e);

async function announceApprovals(r: Source) {
  const pending = waitingFromEvents(r.events).filter((w) => w.kind === "approval");
  if (!pending.length) return; // a saved rule or Auto already took them
  await record({ runId: r.runId, pendingApprovalId: `${r.runId}:${pending[0].id}` }).catch(recordErr);
  if (telegramPolling()) {
    for (const w of pending) await pushCard(r, w); // in order, so the cards read top to bottom like the run
    return;
  }
  const link = runLink(r.runId, publicBase());
  const body = pending.length === 1 ? `${r.title} needs your OK: ${pending[0].kind === "approval" ? pending[0].summary : ""}.` : `${r.title} needs your OK on ${pending.length} things:\n${pending.map((w) => `• ${w.kind === "approval" ? w.summary : ""}`).join("\n")}`;
  await sendTelegram(`${body}\nReply approve${pending.length > 1 ? " (or approve all)" : ""} or deny.\n${link}`);
}

async function announceQuestion(r: Source, questionId: string) {
  const w = waitingFromEvents(r.events).find((x) => x.kind === "question" && x.id === questionId);
  if (!w || w.kind !== "question") return;
  await record({ runId: r.runId, pendingQuestionId: `${r.runId}:${questionId}` }).catch(recordErr);
  if (telegramPolling()) return void (await pushCard(r, w));
  const opts = w.options ?? [];
  const list = opts.length ? `\n${opts.map((o, i) => `${i + 1}) ${o}`).join("\n")}\nReply 1${opts.length > 1 ? `-${opts.length}` : ""} or type an answer.` : "\nReply with your answer.";
  await sendTelegram(`${r.title}: ${w.agent} asks: ${w.text}${list}\n${runLink(r.runId, publicBase())}`);
}

/** The run's answer for a phone: the first six lines of its document (the one titled like the workstream) and the deep link. */
export function endText(title: string, events: readonly AnyRunEvent[], status: string, link: string): string {
  if (status !== "done") return `${title} ${status}.\n${link}`;
  const docs = events.flatMap((e) => (e.type === "artifact.version" && e.payload.kind === "doc" ? [e.payload] : []));
  const latest = [...new Map(docs.map((d) => [d.artifactId, d])).values()]; // the newest version of each document
  const doc = pickDoc(latest, title);
  const body = doc ? toPhone(doc.content, { maxLines: 6, maxChars: PHONE_MAX - link.length - title.length - 20 }) : "";
  return `${title} finished.${body ? `\n${body}` : ""}\n${link}`;
}

async function announceEnd(r: Source, status: string) {
  await sendTelegram(endText(r.title, r.events, status, runLink(r.runId, publicBase())));
}
