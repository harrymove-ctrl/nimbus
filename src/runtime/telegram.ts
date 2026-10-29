// The Nimbus Telegram bot (docs/ROADMAP.md §2, docs/TELEGRAM.md): Nimbus reads its own bot's updates, so a phone needs no
// OpenClaw. A long-poll `getUpdates` loop in the server process; text goes through the same intent router as /v1
// (src/runtime/chat.ts); taps on the cards that notify.ts pushes resolve approvals and answer crew questions through the
// same RunHandle calls the API routes use.
//
// One poller per database: the `telegram_poller` row names the process that reads updates and carries its heartbeat and the
// next update offset, so a second dev server or a deploy overlap stands by instead of handling an update twice.
// Private by default: only NIMBUS_TELEGRAM_CHAT_ID is served. Uses fetch only; the token never reaches a log line.
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { getDb, retryBusy, schema } from "@/db";
import type { AnyRunEvent } from "@/lib/events";
import { buildView, fmtCost, laneName } from "@/lib/run-view";
import { WORKSTREAMS } from "@/lib/workstreams";
import { handleChat } from "./chat";
import { PHONE_MAX, ago, publicBase, toPhone, waitingFromEvents } from "./chat-util";
import { askRejectNote, editTelegram, getCard, sendTelegram, telegramApi, telegramPolling, telegramThreadKey } from "./notify";
import { getRun, type RunHandle } from "./source";

type TgChat = { id: number };
type TgMessage = { message_id: number; chat: TgChat; text?: string };
type TgCallback = { id: string; from: { id: number }; message?: TgMessage; data?: string };
type TgUpdate = { update_id: number; message?: TgMessage; callback_query?: TgCallback };

export const PRIVATE_TEXT = "This Nimbus is private. Run your own: github.com/harrymove-ctrl/nimbus";
const NOT_PAIRED = "This Nimbus is not paired with a chat yet. Its owner finds this chat's id in the server log.";

const POLL_S = () => Number(process.env.NIMBUS_TELEGRAM_POLL_S) || 25;
/** a heartbeat older than this belongs to a process that is gone */
const STALE_MS = () => (POLL_S() + 35) * 1000;
const EDIT_MS = () => Number(process.env.NIMBUS_TELEGRAM_EDIT_MS) || 3000;
const owner = () => process.env.NIMBUS_TELEGRAM_CHAT_ID || "";

type Poller = { id: string; ctrl: AbortController; stopped: boolean; done: Promise<void> };
declare global {
  var __nimbusTelegram: Poller | undefined;
  var __nimbusTgRejects: Map<string, { runId: string; approvalId: string }> | undefined;
  var __nimbusTgFollowing: Set<string> | undefined;
}
/** Reject was tapped and the card asked for a note: the chat's next plain line is it (or /skip). */
const rejects = (globalThis.__nimbusTgRejects ??= new Map());
const following = (globalThis.__nimbusTgFollowing ??= new Set<string>());

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((r) => {
    const t = setTimeout(r, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), r()), { once: true });
  });

/* ------------------------------------------------------------------ one poller per database */

const T = schema.telegramPoller;

/** Take or keep the poller row. Returns the next update offset, or null while another live process holds it. */
export async function claimPoller(id: string): Promise<{ offset: number } | null> {
  const db = await getDb();
  const now = Date.now();
  await retryBusy(() => db.insert(T).values({ id: 1, owner: null, heartbeatAt: 0, updateOffset: 0 }).onConflictDoNothing());
  const rows = await retryBusy(() =>
    db
      .update(T)
      .set({ owner: id, heartbeatAt: now })
      .where(and(eq(T.id, 1), or(eq(T.owner, id), isNull(T.owner), lt(T.heartbeatAt, now - STALE_MS()))))
      .returning(),
  );
  return rows[0] ? { offset: rows[0].updateOffset } : null;
}

async function saveOffset(id: string, offset: number) {
  const db = await getDb();
  await retryBusy(() => db.update(T).set({ updateOffset: offset, heartbeatAt: Date.now() }).where(and(eq(T.id, 1), eq(T.owner, id))));
}

async function releasePoller(id: string) {
  const db = await getDb();
  await retryBusy(() => db.update(T).set({ owner: null, heartbeatAt: 0 }).where(and(eq(T.id, 1), eq(T.owner, id))));
}

/** Started from src/instrumentation.ts. Needs NIMBUS_TELEGRAM_BOT_TOKEN; NIMBUS_TELEGRAM_MODE=off leaves the bot to another client. */
export function startTelegram(): boolean {
  if (!telegramPolling()) return false;
  if (globalThis.__nimbusTelegram && !globalThis.__nimbusTelegram.stopped) return true;
  const p: Poller = { id: `${process.pid}-${crypto.randomUUID().slice(0, 8)}`, ctrl: new AbortController(), stopped: false, done: Promise.resolve() };
  p.done = loop(p).catch((e) => console.error("[nimbus] telegram poller stopped:", e instanceof Error ? e.message : e));
  globalThis.__nimbusTelegram = p;
  return true;
}

/** Stop polling and hand the row back so another process can take over at once (tests, shutdown). */
export async function stopTelegram(): Promise<void> {
  const p = globalThis.__nimbusTelegram;
  if (!p) return;
  p.stopped = true;
  p.ctrl.abort();
  await p.done;
  await releasePoller(p.id).catch(() => {});
  globalThis.__nimbusTelegram = undefined;
}

async function loop(p: Poller) {
  let standing = false;
  let announced = false;
  let backoff = 0;
  while (!p.stopped) {
    const claim = await claimPoller(p.id).catch((e) => (console.error("[nimbus] telegram poller row:", e instanceof Error ? e.message : e), null));
    if (!claim) {
      if (!standing) console.log("[nimbus] telegram: another server is reading this bot's updates; standing by");
      standing = true;
      await sleep(Math.min(15_000, STALE_MS() / 3), p.ctrl.signal);
      continue;
    }
    if (standing || !announced) console.log(`[nimbus] telegram: ${standing ? "took over reading" : "reading"} the bot's updates${owner() ? "" : " (not paired: send /start to the bot)"}`);
    standing = false;
    announced = true;
    const signal = AbortSignal.any([p.ctrl.signal, AbortSignal.timeout((POLL_S() + 10) * 1000)]);
    const updates = await telegramApi<TgUpdate[]>("getUpdates", { offset: claim.offset, timeout: POLL_S(), allowed_updates: ["message", "callback_query"] }, { signal, quiet: p.stopped });
    if (p.stopped) break;
    if (!updates) {
      // 409: a webhook is set or another client polls this bot; 401: wrong token. Back off, keep the row.
      backoff = Math.min(30_000, backoff < 2000 ? 2000 : backoff * 2);
      await sleep(backoff, p.ctrl.signal);
      continue;
    }
    backoff = 0;
    for (const u of updates) {
      if (p.stopped) break;
      await saveOffset(p.id, u.update_id + 1); // before handling: a crash mid-update skips it rather than approving twice
      try {
        await handleUpdate(u);
      } catch (e) {
        console.error("[nimbus] telegram update failed:", e instanceof Error ? e.message : e);
      }
    }
  }
}

/* ------------------------------------------------------------------ updates */

export async function handleUpdate(u: TgUpdate): Promise<void> {
  if (u.callback_query) return onCallback(u.callback_query);
  if (u.message) return onMessage(u.message);
}

const reply = (chat: string, text: string) => sendTelegram(toPhone(text, { maxLines: 30, maxChars: PHONE_MAX }), undefined, chat);

/** "/run@NimbusBot morning brief" → "run morning brief"; other commands keep their slash (the router knows /status, /help, /start). */
export function normalize(text: string): string {
  const m = /^\/([a-z_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/i.exec(text.trim());
  if (!m) return text.trim();
  const cmd = m[1].toLowerCase();
  const rest = (m[2] ?? "").trim();
  if (cmd === "run") return rest ? `run ${rest}` : "run";
  if (cmd === "approve" || cmd === "deny" || cmd === "ask") return rest ? `${cmd === "ask" ? "" : `${cmd} `}${rest}`.trim() : cmd;
  return rest ? `/${cmd} ${rest}` : `/${cmd}`;
}

async function onMessage(m: TgMessage) {
  const chat = String(m.chat.id);
  const text = (m.text ?? "").trim();
  if (!owner()) {
    if (/^\/start\b/i.test(text)) console.log(`[nimbus] telegram: /start from chat ${chat}. Set NIMBUS_TELEGRAM_CHAT_ID=${chat} to pair the bot with this chat.`);
    await sendTelegram(NOT_PAIRED, undefined, chat);
    return;
  }
  if (chat !== owner()) return void (await sendTelegram(PRIVATE_TEXT, undefined, chat));
  if (!text) return void (await reply(chat, "I read text only. Try /help."));

  // the note for a rejection (or /skip); any other command leaves the rejection waiting
  const rej = rejects.get(chat);
  const skip = /^\/skip\b/i.test(text);
  if (rej && (skip || !text.startsWith("/"))) {
    rejects.delete(chat);
    const note = skip ? undefined : text.slice(0, 300);
    const ok = getRun(rej.runId)?.resolveApproval(rej.approvalId, { decision: "rejected", note, by: "telegram" });
    return void (await reply(chat, ok ? `Rejected.${note ? ` Noted: "${note}".` : ""}` : "That approval is no longer waiting."));
  }
  if (skip) return void (await reply(chat, "Nothing to skip."));

  const turn = await handleChat({ model: "nimbus", user: `tg:${chat}`, messages: [{ role: "user", content: normalize(text) }] }, { token: "telegram", origin: publicBase(), key: telegramThreadKey(), via: "telegram" });
  if ("error" in turn) return void (await reply(chat, turn.error.message));
  // Only the turn's first piece is read: the reply itself. The rest of a turn follows the run as text for /v1 clients; here the
  // progress message below and the cards notify.ts pushes do that job, with buttons.
  if (turn.intent === "run" && turn.runId) {
    await turn.pieces.return(undefined);
    const run = getRun(turn.runId);
    if (run) void followRun(run, chat).catch((e) => console.error("[nimbus] telegram progress failed:", e instanceof Error ? e.message : e));
    return;
  }
  const first = await turn.pieces.next();
  await turn.pieces.return(undefined);
  await reply(chat, String(first.value ?? "").trim() || "Done.");
}

async function onCallback(q: TgCallback) {
  const answer = (text: string) => telegramApi("answerCallbackQuery", { callback_query_id: q.id, text: text.slice(0, 190) });
  const chat = String(q.message?.chat.id ?? q.from.id);
  if (!owner() || chat !== owner()) return void (await answer(PRIVATE_TEXT));
  const [kind, runId, id, arg] = (q.data ?? "").split(":");
  const run = getRun(runId ?? "");
  const gone = async (why: string) => {
    await answer(why);
    if (q.message) await editTelegram(q.message.message_id, `${q.message.text ?? ""}\n${why}`, undefined, chat); // the buttons go either way
  };

  if (kind === "a") {
    if (!run || run.finished) return gone("That run is no longer running.");
    if (!waitingFromEvents(run.events).some((w) => w.kind === "approval" && w.id === id)) return void (await answer("Already decided."));
    if (arg === "n") {
      rejects.set(chat, { runId, approvalId: id });
      await answer("Reject: send one line of note, or /skip.");
      const card = getCard(runId, "approval", id);
      if (card) await askRejectNote(card);
      return;
    }
    const always = arg === "al";
    const ok = run.resolveApproval(id, { decision: "approved", always, by: "telegram" }); // the card is edited by notify.ts on approval.resolve
    return void (await answer(ok ? (always ? "Approved. Always allowed from now on." : "Approved.") : "Already decided."));
  }

  if (kind === "q") {
    if (!run || run.finished) return gone("That run is no longer running.");
    const w = waitingFromEvents(run.events).find((x) => x.kind === "question" && x.id === id);
    const option = w?.kind === "question" ? w.options?.[Number(arg)] : undefined;
    if (!w || !option) return void (await answer("Already answered."));
    const ok = run.postMessage({ kind: "answer", text: option, questionId: id, via: "telegram" });
    return void (await answer(ok ? `Answered: ${option}` : "Already answered."));
  }

  await answer("Unknown button.");
}

/* ------------------------------------------------------------------ a run started from Telegram: one message, edited */

const RUN_STATE: Record<string, string> = { idle: "starting", planning: "planning", running: "running", asked: "asks you", waiting: "waits for your OK", done: "done", failed: "failed", cancelled: "cancelled", stopped: "stopped" };
const LANE_STATE: Record<string, string> = { pending: "queued", running: "working", done: "done", error: "failed" };

/** "Morning brief · running · $0.004" then one line per lane. Numbers first, plain text, no clock (it would force an edit every tick). */
export function progressText(run: RunHandle, title: string): string {
  const events = run.events as AnyRunEvent[];
  const v = buildView(events);
  const waiting = waitingFromEvents(events);
  const head = `${title} · ${RUN_STATE[v.status] ?? v.status} · ${fmtCost(v.costUsd)}${run.finished ? ` · ${ago(run.startedAt).replace(" ago", "")}` : ""}`;
  const lanes = v.lanes.map((l) => {
    const w = waiting.find((x) => x.agent === l.instance);
    return `• ${laneName(l.instance, l.role)}: ${w ? (w.kind === "approval" ? "waits for your OK" : "asks you") : (LANE_STATE[l.status] ?? l.status)}`;
  });
  return [head, ...(lanes.length ? lanes.slice(0, 10) : ["• planning the crew"])].join("\n").slice(0, PHONE_MAX);
}

async function followRun(run: RunHandle, chat: string) {
  if (following.has(run.id)) return;
  following.add(run.id);
  try {
    const title = WORKSTREAMS.find((w) => w.id === run.workstreamId)?.title ?? "Run";
    let text = progressText(run, title);
    const id = await sendTelegram(text, undefined, chat);
    if (id === null) return;
    while (!run.finished) {
      await sleep(EDIT_MS());
      const next = progressText(run, title);
      if (next !== text && (await editTelegram(id, next, undefined, chat))) text = next; // a failed edit (rate limit) is retried next tick
    }
    const last = progressText(run, title);
    if (last !== text) await editTelegram(id, last, undefined, chat);
    // the run's answer (first six lines and the link) is the message notify.ts sends on run.end
  } finally {
    following.delete(run.id);
  }
}
