import { modelMode } from "@/lib/tokenfactory";
import { checkDayBudget, runCapUsd } from "@/runtime/budget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/budget — what the rail footer and the run header's spend meter show.
export async function GET() {
  const b = await checkDayBudget();
  // mock: the server's model mode (the same source as /api/overview), so the rail never guesses it on the client
  return Response.json({ todayUsd: b.spentUsd, dayCapUsd: b.capUsd, runCapUsd: runCapUsd(), refusing: !b.ok, mock: modelMode() === "mock" });
}
