import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { WORKSTREAMS } from "@/lib/workstreams";
import { checkDayBudget } from "@/runtime/budget";
import { startRun } from "@/runtime/source";

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
  };
  const ws = WORKSTREAMS.find((w) => w.id === body.workstreamId);
  if (!ws) return Response.json({ error: "unknown workstream" }, { status: 404 });
  const budget = await checkDayBudget();
  if (!budget.ok) return Response.json({ error: "day_cap", message: budget.message, spentUsd: budget.spentUsd, capUsd: budget.capUsd }, { status: 429 });
  const goal = body.goal?.trim() || ws.goal;
  const run = startRun({ workstreamId: ws.id, title: ws.title, goal, mode: body.mode, tier: body.tier, tools: body.tools, files: body.files });
  return Response.json({ runId: run.id }, { status: 201 });
}

// GET /api/runs?workstreamId=ws-… — the workstream's recent runs, newest first (the run view opens the latest, frozen).
export async function GET(req: Request) {
  const wsId = new URL(req.url).searchParams.get("workstreamId");
  const db = await getDb();
  const q = db.select({ id: schema.runs.id, status: schema.runs.status, trigger: schema.runs.trigger, startedAt: schema.runs.startedAt, costUsd: schema.runs.costUsd }).from(schema.runs);
  const rows = await (wsId ? q.where(eq(schema.runs.workstreamId, wsId)) : q).orderBy(desc(schema.runs.startedAt)).limit(10);
  return Response.json({ runs: rows });
}
