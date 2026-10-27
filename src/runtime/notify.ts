// Nimbus messages you first (docs/CHAT-APPS.md Phase B): when a run nobody is watching needs a person, or ends, one Telegram
// message goes out through the Bot API. Send only: this file never polls for replies, so it cannot compete with OpenClaw,
// which owns the bot's incoming messages. The reply "approve" arrives through OpenClaw as an ordinary chat message and
// resolves the approval recorded here in chat_threads.
//
// Needs NIMBUS_TELEGRAM_BOT_TOKEN and NIMBUS_TELEGRAM_CHAT_ID. NIMBUS_TELEGRAM_API_BASE points at a local stub in tests.
// The token is only ever put in the request path; it is never logged.
import type { AnyRunEvent } from "@/lib/events";
import { PHONE_MAX, publicBase, runLink, toPhone, waitingFromEvents } from "./chat-util";

declare global {
  var __nimbusFollowed: Map<string, number> | undefined;
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
/** The thread key under which pushed approvals and questions are recorded; any chat's "approve" falls back to it. */
export const telegramThreadKey = () => `tg:${chatId()}`;

export async function sendTelegram(text: string): Promise<boolean> {
  if (!telegramConfigured()) return false;
  const base = (process.env.NIMBUS_TELEGRAM_API_BASE || "https://api.telegram.org").replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/bot${token()}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId(), text: text.slice(0, 4000), disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error(`[nimbus] telegram sendMessage failed: HTTP ${res.status}`);
    return res.ok;
  } catch (e) {
    console.error("[nimbus] telegram sendMessage failed:", e instanceof Error ? e.name : "error"); // not the message: undici puts the URL (and so the token) in it
    return false;
  }
}

type Source = { runId: string; title: string; trigger: string; /** someone has this run open in the web app */ watching: boolean; events: readonly AnyRunEvent[] };

const batches = new Map<string, ReturnType<typeof setTimeout>>();
const BATCH_MS = () => Number(process.env.NIMBUS_NOTIFY_BATCH_MS) || 1200;

/** Called by the live runtime for every event of every run; does nothing unless it is the right moment to message. */
export function notifyEvent(r: Source, e: AnyRunEvent): void {
  if (!telegramConfigured() || r.trigger === "manual" || r.watching) return;
  if ((followed.get(r.runId) ?? 0) > 0) return; // a chat request is following the run: its reply carries this
  if (e.type === "approval.request") {
    // Several approvals arrive together (Morning brief: three replies): one message for the batch.
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

async function announceApprovals(r: Source) {
  const pending = waitingFromEvents(r.events).filter((w) => w.kind === "approval");
  if (!pending.length) return; // a saved rule or Auto already took them
  const link = runLink(r.runId, publicBase());
  const body = pending.length === 1 ? `${r.title} needs your OK: ${pending[0].kind === "approval" ? pending[0].summary : ""}.` : `${r.title} needs your OK on ${pending.length} things:\n${pending.map((w) => `• ${w.kind === "approval" ? w.summary : ""}`).join("\n")}`;
  const text = `${body}\nReply approve${pending.length > 1 ? " (or approve all)" : ""} or deny.\n${link}`;
  await record({ runId: r.runId, pendingApprovalId: `${r.runId}:${pending[0].id}` }).catch((e) => console.error("[nimbus] chat thread write failed:", e instanceof Error ? e.message : e));
  await sendTelegram(text);
}

async function announceQuestion(r: Source, questionId: string) {
  const w = waitingFromEvents(r.events).find((x) => x.kind === "question" && x.id === questionId);
  if (!w || w.kind !== "question") return;
  const opts = w.options ?? [];
  const list = opts.length ? `\n${opts.map((o, i) => `${i + 1}) ${o}`).join("\n")}\nReply 1${opts.length > 1 ? `-${opts.length}` : ""} or type an answer.` : "\nReply with your answer.";
  await record({ runId: r.runId, pendingQuestionId: `${r.runId}:${questionId}` }).catch((e) => console.error("[nimbus] chat thread write failed:", e instanceof Error ? e.message : e));
  await sendTelegram(`${r.title}: ${w.agent} asks: ${w.text}${list}\n${runLink(r.runId, publicBase())}`);
}

async function announceEnd(r: Source, status: string) {
  const link = runLink(r.runId, publicBase());
  if (status !== "done") return void (await sendTelegram(`${r.title} ${status}.\n${link}`));
  const docs = r.events.filter((e): e is Extract<AnyRunEvent, { type: "artifact.version" }> => e.type === "artifact.version" && e.payload.kind === "doc");
  const body = docs.length ? toPhone(docs[docs.length - 1].payload.content, { maxLines: 4, maxChars: PHONE_MAX - 160 }) : "";
  await sendTelegram(`${r.title} finished.${body ? `\n${body}` : ""}\n${link}`);
}
