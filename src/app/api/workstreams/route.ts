import { randomBytes } from "node:crypto";
import { getDb, retryBusy, schema } from "@/db";
import { DEFAULT_ROLES, crewOf, parseRoles } from "@/lib/roles";
import { getTemplate, templateFiles } from "@/lib/templates";
import { TOOL_LABELS, WORKSTREAMS, type Workstream } from "@/lib/workstreams";
import { MAX_FILE_BYTES, MAX_FILES, saveWorkstreamFiles, workstreamFiles } from "@/runtime/attachments";
import { restartScheduler } from "@/runtime/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  const [ws, skills] = await Promise.all([db.select().from(schema.workstreams), db.select().from(schema.skills)]);
  const skill = new Map(skills.map((s) => [s.workstreamId, s.content]));
  const workstreams: Workstream[] = ws
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((w) => ({ id: w.id, title: w.title, goal: w.goal, scheduleCron: w.scheduleCron ?? undefined, scheduleLabel: w.scheduleLabel ?? undefined, tools: w.tools, roles: crewOf(w.roles), files: workstreamFiles(w.id), unread: !!w.unread, archived: !!w.archived, skill: skill.get(w.id) ?? "", estimatedManualMinutes: WORKSTREAMS.find((x) => x.id === w.id)?.estimatedManualMinutes ?? 30, color: WORKSTREAMS.find((x) => x.id === w.id)?.color ?? "#9ca3af" }));
  return Response.json({ workstreams });
}

/** The schedules the "New workstream" form offers, as cron expressions with the label the rail shows. */
const SCHEDULES = { daily: { days: "*", label: "Daily" }, weekdays: { days: "1-5", label: "Weekdays" }, mondays: { days: "1", label: "Mondays" } } as const;

type Body = {
  title?: string;
  goal?: string;
  /** { kind, time } from the form, or a template's words: "daily 08:00" */
  schedule?: { kind?: string; time?: string } | string | null;
  tools?: string[];
  roles?: unknown;
  /** the SKILL.md seed (a template's, or one `nimbus ws import` read) */
  skill?: string;
  /** small text files stored with the workstream and attached to every run (`nimbus ws import` sends a template's CSVs) */
  files?: { name?: string; content?: string }[];
  /** start from templates/<slug>.yaml: its fields fill whatever the body leaves out; its attachments are copied */
  template?: string;
};

// POST /api/workstreams { title, goal, schedule?, tools, roles?, skill?, files?, template? }
// "+ New workstream": a standing goal of your own, or a template (`{ template: "study-coach" }` alone is enough). It gets
// a skill file to learn into, its crew, its files, and the scheduler picks up its schedule at once (no restart).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const tpl = body.template ? getTemplate(String(body.template)) : undefined;
  if (body.template && !tpl) return Response.json({ error: `no template "${body.template}"; GET /api/templates lists them` }, { status: 404 });
  const title = (body.title ?? tpl?.title)?.trim().slice(0, 60);
  const goal = (body.goal ?? tpl?.goal)?.trim().slice(0, 600);
  if (!title || !goal) return Response.json({ error: "a name and a goal are needed" }, { status: 400 });
  const tools = [...new Set((body.tools ?? tpl?.tools ?? []).filter((t) => t in TOOL_LABELS))];
  if (!tools.length) return Response.json({ error: "pick at least one tool" }, { status: 400 });
  const roles = body.roles !== undefined ? parseRoles(body.roles) : (tpl?.roles ?? DEFAULT_ROLES);
  if (typeof roles === "string") return Response.json({ error: roles }, { status: 400 });
  const files = (body.files ?? []).filter((f) => f && typeof f.name === "string" && typeof f.content === "string") as { name: string; content: string }[];
  if (files.length > MAX_FILES || files.some((f) => Buffer.byteLength(f.content) > MAX_FILE_BYTES)) return Response.json({ error: `at most ${MAX_FILES} files of ${MAX_FILE_BYTES / 1024} KB each` }, { status: 400 });
  let scheduleCron: string | null = null;
  let scheduleLabel: string | null = null;
  let sched = body.schedule === undefined ? (tpl?.schedule ?? null) : body.schedule;
  if (typeof sched === "string") {
    const m = /^(daily|weekdays|mondays)\s+(\S+)$/i.exec(sched.trim());
    sched = m ? { kind: m[1].toLowerCase(), time: m[2] } : null;
  }
  if (sched?.kind && sched.kind in SCHEDULES) {
    const m = (sched.time ?? "").match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (!m) return Response.json({ error: "the time reads HH:MM, e.g. 08:00" }, { status: 400 });
    const s = SCHEDULES[sched.kind as keyof typeof SCHEDULES];
    scheduleCron = `${Number(m[2])} ${Number(m[1])} * * ${s.days}`;
    scheduleLabel = `${s.label} ${m[1].padStart(2, "0")}:${m[2]}`;
  }
  // a template's slug names the id, so the mock model finds its scripts (fixtures/mock-model/tpl-<slug>)
  const slug = tpl?.slug ?? (title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "workstream");
  const id = `ws-u-${slug}-${randomBytes(2).toString("hex")}`; // "ws-u-": made by a person, so it may be deleted
  const skill = (body.skill ?? tpl?.skill)?.trim().slice(0, 20_000) || `## ${title}\n1. ${goal}`;
  const db = await getDb();
  await retryBusy(() => db.insert(schema.workstreams).values({ id, title, goal, scheduleCron, scheduleLabel, tools, roles, scheduleEdited: scheduleCron ? 1 : 0, createdAt: Date.now() }));
  await retryBusy(() => db.insert(schema.skills).values({ workstreamId: id, content: /^## Policy\b/m.test(skill) ? skill : `${skill}\n\n## Policy\n(none yet)`, version: 1, updatedAt: Date.now() }));
  const stored = saveWorkstreamFiles(id, [...(tpl ? templateFiles(tpl) : []), ...files]);
  if (scheduleCron) await restartScheduler();
  return Response.json({ id, title, goal, scheduleCron, scheduleLabel, tools, roles, files: stored, template: tpl?.slug ?? null }, { status: 201 });
}
