import { getRun } from "@/runtime/source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/runs/[id]/stop { reason?: "cancel" | "stop" } — cancel inside the plan window, stop later.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = getRun(id);
  if (!run) return Response.json({ error: "run not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { reason?: string };
  run.stop(body.reason === "cancel" ? "cancel" : "stop");
  return Response.json({ ok: true });
}
