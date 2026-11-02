// The Conversations inbox (docs/CONVERSATION.md C0): one row per run across every workstream that is not archived and
// every door (web, schedule, Telegram, chat API, terminal), newest first, the runs that need the person on top.
// `loadConversations()` reads SQLite (and the in-memory events of runs still going); `conversationRows()` is pure.
import { and, desc, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AnyRunEvent } from "@/lib/events";
import { WORKSTREAMS } from "@/lib/workstreams";
import { waitingFromEvents, type Waiting } from "./chat-util";
import { getRun } from "./source";

export type Door = "web" | "schedule" | "telegram" | "chat" | "terminal" | "api";
/** `quiet` is reserved for C4 (a run with nothing to report) and is not emitted yet */
export type ConversationState = "needs" | "running" | "done" | "stopped" | "failed" | "quiet";
export type ConversationFilter = "needs" | "scheduled" | "phone" | "all";
export const FILTERS: ConversationFilter[] = ["needs", "scheduled", "phone", "all"];

export type Conversation = {
  runId: string;
  workstreamId: string;
  workstreamTitle: string;
  door: Door;
  /** the run's goal, first line */
  asked: string;
  /** what is waiting on the person, else the latest message (first line, not the summary card), else the latest artifact title */
  last: string;
  costUsd: number;
  startedAt: number;
  endedAt: number | null;
  state: ConversationState;
  /** open approvals and questions (and a draft plan waiting for review) */
  waiting: number;
};

export type Conversations = { rows: Conversation[]; counts: Record<ConversationFilter, number>; scanned: number };

/** the newest runs the inbox reads; older ones are not listed or searched */
export const SCAN_CAP = 300;

/** Which door a run came in through. CLI and MCP runs go through POST /api/runs like the web app and are not told apart. */
export function doorOf(trigger: string): Door {
  switch (trigger) {
    case "manual":
      return "web";
    case "cron":
      return "schedule";
    case "telegram":
      return "telegram";
    case "chat":
      return "chat";
    case "job":
      return "terminal";
    default:
      return "api";
  }
}

const firstLine = (s: string) => s.replace(/\r/g, "").split("\n").map((l) => l.trim()).find(Boolean) ?? "";

/** the minimal shape of an event the inbox reads (a stored row or a live event) */
export type InboxEvent = Pick<AnyRunEvent, "type" | "payload" | "agentInstance">;

export type RunInput = {
  run: { id: string; workstreamId: string; title: string; goal: string; status: string; trigger: string; startedAt: number; endedAt: number | null; costUsd: number };
  workstreamTitle?: string;
  /** message, approval, question and plan events, in order */
  events: InboxEvent[];
  /** artifact titles, oldest first */
  artifacts: string[];
  /** the run is still going in this server process */
  live: boolean;
};

/** Is a draft plan still waiting for the person's review? */
function planWaiting(events: InboxEvent[]): boolean {
  let waiting = false;
  for (const e of events) {
    if (e.type === "plan") waiting = !!(e.payload as { awaiting?: boolean }).awaiting;
    else if (e.type === "plan.approve") waiting = false;
  }
  return waiting;
}

const waitingLine = (w: Waiting) => (w.kind === "approval" ? `Approve: ${firstLine(w.summary)}` : `Question: ${firstLine(w.text)}`);

/** One inbox row from a run, its events and its artifact titles. */
export function conversationRow(r: RunInput): Conversation {
  const { run } = r;
  const running = r.live && run.status === "running";
  const waits = running ? waitingFromEvents(r.events as AnyRunEvent[]) : [];
  const plan = running && planWaiting(r.events);
  const waiting = waits.length + (plan ? 1 : 0);
  const state: ConversationState = waiting > 0 ? "needs" : running ? "running" : run.status === "done" ? "done" : run.status === "failed" ? "failed" : "stopped";
  let last = "";
  if (waits.length) last = waitingLine(waits[0]);
  else if (plan) last = "Plan waiting for your review";
  else {
    for (let i = r.events.length - 1; i >= 0 && !last; i--) {
      const e = r.events[i];
      // the summary card's message is a label ("Run summary"), not something anyone said
      if (e.type === "message" && !(e.payload as { card?: string }).card) last = firstLine((e.payload as { text: string }).text);
    }
    if (!last && r.artifacts.length) last = r.artifacts[r.artifacts.length - 1];
  }
  return {
    runId: run.id,
    workstreamId: run.workstreamId,
    workstreamTitle: r.workstreamTitle ?? run.title,
    door: doorOf(run.trigger),
    asked: firstLine(run.goal) || run.title,
    last,
    costUsd: run.costUsd,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    state,
    waiting,
  };
}

/** Does the run's goal, one of its messages or one of its artifact titles contain `q` (any case)? */
export function matches(r: RunInput, q: string): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return true;
  if (r.run.goal.toLowerCase().includes(n)) return true;
  if (r.artifacts.some((t) => t.toLowerCase().includes(n))) return true;
  return r.events.some((e) => e.type === "message" && (e.payload as { text: string }).text.toLowerCase().includes(n));
}

export const inFilter = (c: Conversation, f: ConversationFilter) => (f === "needs" ? c.state === "needs" : f === "scheduled" ? c.door === "schedule" : f === "phone" ? c.door === "telegram" || c.door === "chat" : true);

/** Pure: rows for the inputs that match `q`, filtered, needs first then newest first, with a count per filter. */
export function conversationRows(inputs: RunInput[], o: { filter?: ConversationFilter; q?: string } = {}): Conversations {
  const all = inputs.filter((r) => matches(r, o.q ?? "")).map(conversationRow);
  const counts = Object.fromEntries(FILTERS.map((f) => [f, all.filter((c) => inFilter(c, f)).length])) as Record<ConversationFilter, number>;
  const rows = all.filter((c) => inFilter(c, o.filter ?? "all")).sort((a, b) => Number(b.state === "needs") - Number(a.state === "needs") || b.startedAt - a.startedAt);
  return { rows, counts, scanned: inputs.length };
}

const EVENT_TYPES = ["message", "approval.request", "approval.resolve", "question", "plan", "plan.approve"] as const;

/** Read the newest SCAN_CAP runs of workstreams that are not archived, with what the inbox needs of each. */
export async function loadConversationInputs(): Promise<RunInput[]> {
  const db = await getDb();
  const wsRows = await db.select({ id: schema.workstreams.id, title: schema.workstreams.title, archived: schema.workstreams.archived }).from(schema.workstreams);
  const archived = new Set(wsRows.filter((w) => w.archived).map((w) => w.id));
  const titles = new Map<string, string>([...WORKSTREAMS.map((w) => [w.id, w.title] as const), ...wsRows.map((w) => [w.id, w.title] as const)]);
  const runs = (
    await db
      .select({ id: schema.runs.id, workstreamId: schema.runs.workstreamId, title: schema.runs.title, goal: schema.runs.goal, status: schema.runs.status, trigger: schema.runs.trigger, startedAt: schema.runs.startedAt, endedAt: schema.runs.endedAt, costUsd: schema.runs.costUsd })
      .from(schema.runs)
      .orderBy(desc(schema.runs.startedAt))
      .limit(SCAN_CAP) // the cap is on what is read; archived workstreams' runs are dropped after
  ).filter((r) => !archived.has(r.workstreamId));
  if (!runs.length) return [];
  const ids = runs.map((r) => r.id);
  // SQLite caps bound parameters; read in chunks
  const evs: { runId: string; seq: number; type: string; agentInstance: string; payload: unknown }[] = [];
  const arts: { runId: string; title: string; createdAt: number }[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const [e, a] = await Promise.all([
      db.select({ runId: schema.runEvents.runId, seq: schema.runEvents.seq, type: schema.runEvents.type, agentInstance: schema.runEvents.agentInstance, payload: schema.runEvents.payload }).from(schema.runEvents).where(and(inArray(schema.runEvents.runId, chunk), inArray(schema.runEvents.type, [...EVENT_TYPES]))),
      db.select({ runId: schema.artifacts.runId, title: schema.artifacts.title, createdAt: schema.artifacts.createdAt }).from(schema.artifacts).where(inArray(schema.artifacts.runId, chunk)),
    ]);
    evs.push(...e);
    arts.push(...a);
  }
  const evBy = new Map<string, typeof evs>();
  for (const e of evs) (evBy.get(e.runId) ?? evBy.set(e.runId, []).get(e.runId)!).push(e);
  const artBy = new Map<string, typeof arts>();
  for (const a of arts) (artBy.get(a.runId) ?? artBy.set(a.runId, []).get(a.runId)!).push(a);
  return runs.map((run) => {
    const handle = getRun(run.id);
    const live = !!handle && !handle.finished;
    // ended in memory a moment before the runs row was updated: take the status from its run.end
    const end = handle?.finished && run.status === "running" ? handle.events.findLast((e) => e.type === "run.end") : undefined;
    if (end?.type === "run.end") run.status = end.payload.status;
    // a run still going reads its events from memory (the database write lags a little); a stored one from SQLite
    const events: InboxEvent[] = live ? handle.events.filter((e) => (EVENT_TYPES as readonly string[]).includes(e.type)) : (evBy.get(run.id) ?? []).sort((a, b) => a.seq - b.seq).map((e) => ({ type: e.type, payload: e.payload, agentInstance: e.agentInstance }) as InboxEvent);
    const artifacts = (artBy.get(run.id) ?? []).sort((a, b) => a.createdAt - b.createdAt).map((a) => a.title);
    return { run, workstreamTitle: titles.get(run.workstreamId), events, artifacts, live };
  });
}

/** GET /api/conversations: the inbox, filtered and searched. */
export async function listConversations(o: { filter?: ConversationFilter; q?: string } = {}): Promise<Conversations> {
  return conversationRows(await loadConversationInputs(), o);
}
