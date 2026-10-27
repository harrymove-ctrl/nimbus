import { getDb, schema } from "@/db";
import { WORKSTREAMS, type Workstream } from "@/lib/workstreams";

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
