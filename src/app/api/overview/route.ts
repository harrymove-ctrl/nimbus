import { getOverview } from "@/runtime/overview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/overview — every number on the Overview screen, from SQLite.
export async function GET() {
  return Response.json(await getOverview());
}
