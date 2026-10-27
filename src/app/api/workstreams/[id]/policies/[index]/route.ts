import { revokePolicy } from "@/runtime/skills";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE /api/workstreams/[id]/policies/[index] — REVOKE an `allow:` line: the next run asks for approval again.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; index: string }> }) {
  const { id, index } = await params;
  const rule = await revokePolicy(id, Number(index));
  return rule === null ? Response.json({ error: "no such rule" }, { status: 404 }) : Response.json({ ok: true, rule });
}
