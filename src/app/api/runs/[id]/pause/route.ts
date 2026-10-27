import { getRun } from "@/runtime/source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/runs/[id]/pause { paused: boolean }: hops in flight finish, no new hop starts until resumed.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = getRun(id);
  if (!run) return Response.json({ error: "run not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { paused?: boolean };
  return run.setPaused(body.paused !== false) ? Response.json({ ok: true }) : Response.json({ error: "run already ended" }, { status: 409 });
}
