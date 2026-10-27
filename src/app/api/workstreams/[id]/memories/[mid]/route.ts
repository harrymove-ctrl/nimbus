import { forgetMemory } from "@/runtime/learning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE /api/workstreams/[id]/memories/[mid] — FORGET: the next run's prompt no longer includes it.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; mid: string }> }) {
  const { id, mid } = await params;
  return (await forgetMemory(id, mid)) ? Response.json({ ok: true }) : Response.json({ error: "no such memory" }, { status: 404 });
}
