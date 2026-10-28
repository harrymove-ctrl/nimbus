import { randomBytes } from "node:crypto";
import { getDb, retryBusy, schema } from "@/db";
import { TOOL_LABELS, WORKSTREAMS, type Workstream } from "@/lib/workstreams";
import { restartScheduler } from "@/runtime/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  const [ws, skills] = await Promise.all([db.select().from(schema.workstreams), db.select().from(schema.skills)]);
  const skill = new Map(skills.map((s) => [s.workstreamId, s.content]));
  const workstreams: Workstream[] = ws
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((w) => ({ id: w.id, title: w.title, goal: w.goal, scheduleCron: w.scheduleCron ?? undefined, scheduleLabel: w.scheduleLabel ?? undefined, tools: w.tools, unread: !!w.unread, archived: !!w.archived, skill: skill.get(w.id) ?? "", estimatedManualMinutes: WORKSTREAMS.find((x) => x.id === w.id)?.estimatedManualMinutes ?? 30, color: WORKSTREAMS.find((x) => x.id === w.id)?.color ?? "#9ca3af" }));
  return Response.json({ workstreams });
}

/** The schedules the "New workstream" form offers, as cron expressions with the label the rail shows. */
const SCHEDULES = { daily: { days: "*", label: "Daily" }, weekdays: { days: "1-5", label: "Weekdays" }, mondays: { days: "1", label: "Mondays" } } as const;

// POST /api/workstreams { title, goal, schedule?: { kind: "daily" | "weekdays" | "mondays", time: "HH:MM" }, tools: string[] }
// "+ New workstream": a standing goal of your own. It gets a skill file to learn into, and the scheduler picks up its
// schedule at once (no restart).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { title?: string; goal?: string; schedule?: { kind?: string; time?: string } | null; tools?: string[] };
  const title = body.title?.trim().slice(0, 60);
  const goal = body.goal?.trim().slice(0, 600);
  if (!title || !goal) return Response.json({ error: "a name and a goal are needed" }, { status: 400 });
  const tools = [...new Set((body.tools ?? []).filter((t) => t in TOOL_LABELS))];
  if (!tools.length) return Response.json({ error: "pick at least one tool" }, { status: 400 });
  let scheduleCron: string | null = null;
  let scheduleLabel: string | null = null;
  if (body.schedule?.kind && body.schedule.kind in SCHEDULES) {
    const m = (body.schedule.time ?? "").match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (!m) return Response.json({ error: "the time reads HH:MM, e.g. 08:00" }, { status: 400 });
    const s = SCHEDULES[body.schedule.kind as keyof typeof SCHEDULES];
    scheduleCron = `${Number(m[2])} ${Number(m[1])} * * ${s.days}`;
    scheduleLabel = `${s.label} ${m[1].padStart(2, "0")}:${m[2]}`;
  }
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "workstream";
  const id = `ws-u-${slug}-${randomBytes(2).toString("hex")}`; // "ws-u-": made by a person, so it may be deleted
  const db = await getDb();
  await retryBusy(() => db.insert(schema.workstreams).values({ id, title, goal, scheduleCron, scheduleLabel, tools, scheduleEdited: scheduleCron ? 1 : 0, createdAt: Date.now() }));
  await retryBusy(() => db.insert(schema.skills).values({ workstreamId: id, content: `## ${title}\n1. ${goal}\n\n## Policy\n(none yet)`, version: 1, updatedAt: Date.now() }));
  if (scheduleCron) await restartScheduler();
  return Response.json({ id, title, goal, scheduleCron, scheduleLabel, tools }, { status: 201 });
}
