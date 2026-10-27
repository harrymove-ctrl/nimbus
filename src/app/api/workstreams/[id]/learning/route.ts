import { getLearning } from "@/runtime/learning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/workstreams/[id]/learning — memories, rules, skill and "last learned", for the Memory & skill tab.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return Response.json(await getLearning(id));
}
