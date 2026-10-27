import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/workstreams/[id]/read — clears the unread dot (a scheduled run finished while you were away).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await (await getDb()).update(schema.workstreams).set({ unread: 0 }).where(eq(schema.workstreams.id, id));
  return Response.json({ ok: true });
}
