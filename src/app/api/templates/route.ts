import path from "node:path";
import { listTemplates, scheduleLabel } from "@/lib/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/templates: the gallery in the New workstream sheet (templates/*.yaml). Start one with
// POST /api/workstreams { template: "<slug>" }, or take the file itself to `nimbus ws import`.
export async function GET() {
  const templates = listTemplates().map((t) => ({ ...t, scheduleLabel: scheduleLabel(t.schedule), attachments: t.attachments.map((a) => path.basename(a)) }));
  return Response.json({ templates });
}
