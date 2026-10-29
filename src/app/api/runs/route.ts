import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { WORKSTREAMS } from "@/lib/workstreams";
import { checkDayBudget } from "@/runtime/budget";
import { getRun, startRun } from "@/runtime/source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    workstreamId?: string;
    goal?: string;
    mode?: "ask" | "auto-low" | "dry";
    tier?: "auto" | "cheap" | "max";
    tools?: string[];
    files?: string[];
    /** false: keep the 3 s window instead of a draft plan to approve (API clients that cannot edit plans) */
    review?: boolean;
  };
  // the seeded workstreams and the ones a person made ("+ New workstream") alike: the database row is the source
  const db = await getDb();
  const [row] = body.workstreamId ? await db.select().from(schema.workstreams).where(eq(schema.workstreams.id, body.workstreamId)) : [];
  const ws = row ?? WORKSTREAMS.find((w) => w.id === body.workstreamId);
  if (!ws) return Response.json({ error: "unknown workstream" }, { status: 404 });
  const budget = await checkDayBudget();
  if (!budget.ok) return Response.json({ error: "day_cap", message: budget.message, spentUsd: budget.spentUsd, capUsd: budget.capUsd }, { status: 429 });
  const goal = body.goal?.trim() || ws.goal;
  const run = startRun({ workstreamId: ws.id, title: ws.title, goal, mode: body.mode, tier: body.tier, tools: body.tools ?? ws.tools, files: body.files, review: body.review !== false, trigger: "manual" });
  return Response.json({ runId: run.id }, { status: 201 });
}

// GET /api/runs?workstreamId=ws-… — the workstream's recent runs, newest first (the run view opens the latest, frozen).
export async function GET(req: Request) {
  const wsId = new URL(req.url).searchParams.get("workstreamId");
  const db = await getDb();
  const q = db.select({ id: schema.runs.id, status: schema.runs.status, trigger: schema.runs.trigger, startedAt: schema.runs.startedAt, costUsd: schema.runs.costUsd }).from(schema.runs);
  const rows = await (wsId ? q.where(eq(schema.runs.workstreamId, wsId)) : q).orderBy(desc(schema.runs.startedAt)).limit(10);
  // A run that says "running" but is not in memory died with its server process (a redeploy mid-run): show it, and
  // store it, as stopped, so history never lists a run that is running forever.
  const orphans = rows.filter((r) => r.status === "running" && !getRun(r.id));
  for (const r of orphans) r.status = "stopped";
  if (orphans.length) void Promise.all(orphans.map((r) => db.update(schema.runs).set({ status: "stopped" }).where(eq(schema.runs.id, r.id)))).catch(() => {});
  return Response.json({ runs: rows });
}
