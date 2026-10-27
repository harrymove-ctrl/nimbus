import { WORKSTREAMS } from "@/lib/workstreams";
import { startRun } from "@/runtime/source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    workstreamId?: string;
    goal?: string;
    mode?: "ask" | "auto-low" | "dry";
    tier?: "auto" | "cheap" | "max";
  };
  const ws = WORKSTREAMS.find((w) => w.id === body.workstreamId);
  if (!ws) return Response.json({ error: "unknown workstream" }, { status: 404 });
  const goal = body.goal?.trim() || ws.goal;
  const run = startRun({ workstreamId: ws.id, title: ws.title, goal, mode: body.mode, tier: body.tier });
  return Response.json({ runId: run.id }, { status: 201 });
}
