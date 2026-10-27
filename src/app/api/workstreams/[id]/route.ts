import cron from "node-cron";
import { eq } from "drizzle-orm";
import { getDb, retryBusy, schema } from "@/db";
import { restartScheduler } from "@/runtime/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/workstreams/[id] { archived?: boolean, schedule?: { cron: string | null, label: string | null } }
// The rail's right-click menu: Archive / Restore and Edit schedule. A schedule the person set is kept when the seed runs again.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { archived?: boolean; schedule?: { cron: string | null; label: string | null } };
  const db = await getDb();
  const [w] = await db.select({ id: schema.workstreams.id }).from(schema.workstreams).where(eq(schema.workstreams.id, id));
  if (!w) return Response.json({ error: "no such workstream" }, { status: 404 });
  const set: Partial<typeof schema.workstreams.$inferInsert> = {};
  if (typeof body.archived === "boolean") set.archived = body.archived ? 1 : 0;
  if (body.schedule) {
    const expr = body.schedule.cron?.trim() || null;
    if (expr && !cron.validate(expr)) return Response.json({ error: `"${expr}" is not a cron expression (minute hour day month weekday)` }, { status: 400 });
    set.scheduleCron = expr;
    set.scheduleLabel = expr ? (body.schedule.label?.trim().slice(0, 40) || `Cron ${expr}`) : null;
    set.scheduleEdited = 1;
  }
  if (!Object.keys(set).length) return Response.json({ error: "nothing to change" }, { status: 400 });
  await retryBusy(() => db.update(schema.workstreams).set(set).where(eq(schema.workstreams.id, id)));
  if (body.schedule) await restartScheduler();
  return Response.json({ ok: true });
}
