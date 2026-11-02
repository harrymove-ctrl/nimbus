import { followUp } from "@/runtime/followup";
import { getRun } from "@/runtime/source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/runs/[id]/messages { text, kind: "steer" | "answer" | "followup", questionId? }
// While the run is live: steer it or answer its question. Once it has ended (or with kind "followup"): a follow-up (C2),
// answered from the run → { kind: "answer", text }, or a continuation run → { kind: "continuation", runId, title }.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = getRun(id);
  const body = (await req.json().catch(() => ({}))) as { text?: string; kind?: string; questionId?: string };
  const text = body.text?.trim();
  if (!text) return Response.json({ error: "text is required" }, { status: 400 });
  const ended = !run || run.finished || run.events.some((e) => e.type === "run.end");
  if (body.kind === "followup" || (ended && body.kind !== "answer")) {
    const r = await followUp(id, text, { via: "web" });
    if (r.kind === "error") return Response.json({ error: r.error }, { status: r.status });
    return r.kind === "answer" ? Response.json({ ok: true, kind: "answer", text: r.text }) : Response.json({ ok: true, kind: "continuation", runId: r.run.id, title: r.title, parentRunId: r.parentRunId }, { status: 201 });
  }
  if (!run) return Response.json({ error: "run not found" }, { status: 404 });
  const kind = body.kind === "answer" ? "answer" : "steer";
  const ok = run.postMessage({ text, kind, questionId: body.questionId });
  return ok ? Response.json({ ok: true }) : Response.json({ error: "run cannot take this message now" }, { status: 409 });
}
