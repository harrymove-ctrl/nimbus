import { getDb, schema } from "@/db";
import type { Workstream } from "@/lib/workstreams";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  const [ws, skills] = await Promise.all([db.select().from(schema.workstreams), db.select().from(schema.skills)]);
  const skill = new Map(skills.map((s) => [s.workstreamId, s.content]));
  const workstreams: Workstream[] = ws
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((w) => ({ id: w.id, title: w.title, goal: w.goal, scheduleCron: w.scheduleCron ?? undefined, scheduleLabel: w.scheduleLabel ?? undefined, tools: w.tools, unread: !!w.unread, skill: skill.get(w.id) ?? "" }));
  return Response.json({ workstreams });
}
