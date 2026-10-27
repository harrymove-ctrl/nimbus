import { listMemories } from "@/runtime/learning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/workstreams/[id]/memories — every memory of the workstream, newest first.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return Response.json({ memories: await listMemories(id) });
}
