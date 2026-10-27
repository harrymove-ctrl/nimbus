import { getRun } from "@/runtime/source";
import type { AnyRunEvent } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/runs/[id]/events?since=N — replays stored events from index N, then streams live.
// A refresh mid-run reconnects with since=0 and the timeline rebuilds from the log.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = getRun(id);
  if (!run) return new Response("run not found", { status: 404 });

  const url = new URL(req.url);
  const lastId = req.headers.get("last-event-id");
  const since = Math.max(0, Number(url.searchParams.get("since") ?? (lastId !== null ? Number(lastId) + 1 : 0)) || 0);
  const enc = new TextEncoder();

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
