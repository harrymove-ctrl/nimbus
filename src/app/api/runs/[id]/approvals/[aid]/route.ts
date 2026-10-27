import { getRun } from "@/runtime/source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/runs/[id]/approvals/[aid] { decision: "approve" | "approve_always" | "reject", note? }
export async function POST(req: Request, { params }: { params: Promise<{ id: string; aid: string }> }) {
  const { id, aid } = await params;
  const run = getRun(id);
  if (!run) return Response.json({ error: "run not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { decision?: string; note?: string };
  if (body.decision !== "approve" && body.decision !== "approve_always" && body.decision !== "reject") {
    return Response.json({ error: "decision must be approve, approve_always or reject" }, { status: 400 });
  }
  const ok = run.resolveApproval(aid, {
    decision: body.decision === "reject" ? "rejected" : "approved",
    always: body.decision === "approve_always",
    note: body.note?.trim() || undefined,
  });
  return ok ? Response.json({ ok: true }) : Response.json({ error: "approval is not pending" }, { status: 409 });
}
