import { revertSkill } from "@/runtime/skills";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/workstreams/[id]/skill/revert — undo the Learner's latest SKILL.md rewrite.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const content = await revertSkill(id);
  return content === null ? Response.json({ error: "nothing to revert" }, { status: 409 }) : Response.json({ ok: true, content });
}
