// Small pure helpers shared by the chat endpoint (chat.ts) and the Telegram notifier (notify.ts).
import type { AnyRunEvent } from "@/lib/events";

export type Waiting =
  | { kind: "approval"; id: string; agent: string; summary: string; risk: string }
  | { kind: "question"; id: string; agent: string; text: string; options?: string[] };

/** Approvals and questions a run is still waiting on, oldest first, read from its event log. */
export function waitingFromEvents(events: readonly AnyRunEvent[]): Waiting[] {
  const out: Waiting[] = [];
  for (const e of events) {
    if (e.type === "approval.request") out.push({ kind: "approval", id: e.payload.approvalId, agent: e.agentInstance, summary: e.payload.action.summary, risk: e.payload.action.risk });
    else if (e.type === "question") out.push({ kind: "question", id: e.payload.questionId, agent: e.agentInstance, text: e.payload.text, options: e.payload.options });
    else if (e.type === "approval.resolve") remove(out, "approval", e.payload.approvalId);
    else if (e.type === "message" && e.payload.answerTo) remove(out, "question", e.payload.answerTo);
  }
  return out;
}
function remove(list: Waiting[], kind: Waiting["kind"], id: string) {
  const i = list.findIndex((w) => w.kind === kind && w.id === id);
  if (i >= 0) list.splice(i, 1);
}

/** The base URL for links in chat: NIMBUS_PUBLIC_URL when set (the phone cannot reach localhost), else where the request came in. */
export const publicBase = (origin?: string) => (process.env.NIMBUS_PUBLIC_URL || origin || `http://localhost:${process.env.PORT || 3241}`).replace(/\/+$/, "");
export const runLink = (runId: string, origin?: string) => `${publicBase(origin)}/?run=${runId}`;

export const PHONE_MAX = 900;

/** Markdown to what reads on a phone: no markup, tables as lines, at most `maxLines` lines and `maxChars` characters. */
export function toPhone(md: string, o: { maxLines?: number; maxChars?: number } = {}): string {
  const maxLines = o.maxLines ?? 6;
  const maxChars = o.maxChars ?? PHONE_MAX;
  const lines = md
    .replace(/\r/g, "")
    .split("\n")
    .map((l) =>
      l
        .replace(/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/, "") // table rule row
        .replace(/^\s*\|(.*)\|\s*$/, (_, row: string) => row.split("|").map((c) => c.trim()).filter(Boolean).join(" · "))
        .replace(/^#{1,6}\s+/, "")
        .replace(/^\s*[-*]\s+/, "• ")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/__(.+?)__/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1 ($2)")
        .trim(),
    )
    .filter(Boolean); // a phone screen has no room for blank lines
  let out = lines.slice(0, maxLines).join("\n");
  let cut = lines.length > maxLines;
  if (out.length > maxChars) {
    out = out.slice(0, maxChars - 1).replace(/\s+\S*$/, "");
    cut = true;
  }
  return cut ? `${out} …` : out;
}

/** A short "3 min ago" for the status and ask replies. */
export function ago(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 90) return `${s} s ago`;
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 129600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
