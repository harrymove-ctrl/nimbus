import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getRun } from "@/runtime/source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/runs/[id] — enough for a deep link (?run=<id>) to open the right workstream.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const live = getRun(id);
  const [row] = await (await getDb()).select().from(schema.runs).where(eq(schema.runs.id, id));
  if (!row && !live) return Response.json({ error: "run not found" }, { status: 404 });
  return Response.json({ id, workstreamId: row?.workstreamId ?? live?.workstreamId, status: live && !live.finished ? "running" : (row?.status ?? "unknown"), trigger: row?.trigger });
}
