import { getRun } from "@/runtime/source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/runs/[id]/messages { text, kind: "steer" | "answer", questionId? }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = getRun(id);
  if (!run) return Response.json({ error: "run not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { text?: string; kind?: string; questionId?: string };
  const text = body.text?.trim();
  if (!text) return Response.json({ error: "text is required" }, { status: 400 });
  const kind = body.kind === "answer" ? "answer" : "steer";
  const ok = run.postMessage({ text, kind, questionId: body.questionId });
  return ok ? Response.json({ ok: true }) : Response.json({ error: "run cannot take this message now" }, { status: 409 });
}
