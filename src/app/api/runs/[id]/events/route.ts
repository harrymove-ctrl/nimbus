import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getRun } from "@/runtime/source";
import type { AnyRunEvent } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/runs/[id]/events?since=N — replays stored events from index N, then streams live.
// A refresh mid-run reconnects with since=0 and the timeline rebuilds from the log.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = getRun(id);
  const url = new URL(req.url);
  const lastId = req.headers.get("last-event-id");
  const since = Math.max(0, Number(url.searchParams.get("since") ?? (lastId !== null ? Number(lastId) + 1 : 0)) || 0);
  const enc = new TextEncoder();

  if (!run) {
    // Not in memory (server restarted, or a finished run from an earlier session): rebuild from the stored events.
    const rows = await (await getDb()).select().from(schema.runEvents).where(eq(schema.runEvents.runId, id)).orderBy(asc(schema.runEvents.seq));
    if (!rows.length) return new Response("run not found", { status: 404 });
    const events: Record<string, unknown>[] = rows.map((r) => ({ id: r.id, runId: r.runId, seq: r.seq, tMs: r.tMs, agent: r.agent, agentInstance: r.agentInstance, type: r.type, payload: r.payload }));
    // A run whose server process died never wrote run.end (nobody can answer its question or approve its action any more).
    // Close it for display so history does not show a run that is "running" forever. These two events are not stored.
    if (!rows.some((r) => r.type === "run.end")) {
      const last = rows[rows.length - 1];
      let seq = rows.length;
      const open = new Map<string, { agent: string; agentInstance: string }>();
      for (const r of rows) {
        const p = r.payload as { approvalId?: string };
        if (r.type === "approval.request" && p.approvalId) open.set(p.approvalId, { agent: r.agent, agentInstance: r.agentInstance });
        if (r.type === "approval.resolve" && p.approvalId) open.delete(p.approvalId);
      }
      for (const [approvalId, who] of open) events.push({ id: `${id}-x${seq}`, runId: id, seq: seq++, tMs: last.tMs, ...who, type: "approval.resolve", payload: { approvalId, decision: "rejected", by: "system", note: "Server restarted" } });
      events.push({ id: `${id}-x${seq}`, runId: id, seq: seq++, tMs: last.tMs, agent: "orchestrator", agentInstance: "orchestrator", type: "run.end", payload: { status: "stopped" } });
    }
    const body = events.filter((e) => (e.seq as number) >= since).map((e) => `id: ${e.seq}\ndata: ${JSON.stringify(e)}\n\n`).join("") + "event: done\ndata: {}\n\n";
    return new Response(body, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform" } });
  }

  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let offEvent = () => {};
      let offDone = () => {};
      let keepAlive: ReturnType<typeof setInterval> | undefined = undefined;
      const write = (s: string) => {
        if (!closed) controller.enqueue(enc.encode(s));
      };
      const send = (e: AnyRunEvent) => write(`id: ${e.seq}\ndata: ${JSON.stringify(e)}\n\n`);
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(keepAlive);
        offEvent();
        offDone();
        try {
          controller.close();
        } catch {}
      };
      cleanup = close;

      for (const e of run.events.slice(since)) send(e);
      if (run.finished) {
        write("event: done\ndata: {}\n\n");
        close();
        return;
      }
      offEvent = run.onEvent(send);
      offDone = run.onDone(() => {
        write("event: done\ndata: {}\n\n");
        close();
      });
      keepAlive = setInterval(() => write(": keep-alive\n\n"), 15000);
      req.signal.addEventListener("abort", close);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
