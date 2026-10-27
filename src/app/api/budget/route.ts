import { checkDayBudget, runCapUsd } from "@/runtime/budget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/budget — what the rail footer and the run header's spend meter show.
export async function GET() {
  const b = await checkDayBudget();
  return Response.json({ todayUsd: b.spentUsd, dayCapUsd: b.capUsd, runCapUsd: runCapUsd(), refusing: !b.ok });
}
