import { activeRuns } from "@/runtime/active";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/runs/active: the runs going or waiting now, for the status pill.
export async function GET() {
  return Response.json({ runs: activeRuns() });
}
