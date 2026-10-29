// templates/*.yaml (docs/TEMPLATES.md): a workstream ready to start, in the same YAML `nimbus ws export` writes and
// `nimbus ws import` reads, plus the SKILL.md seed and sample attachments. Server only (reads the repository).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseYaml, type YamlMap } from "@/cli/yaml";
import { DEFAULT_ROLES, parseRoles, type CrewRole } from "./roles";

export type Template = {
  /** the file name without .yaml: `{ template: "study-coach" }` */
  slug: string;
  title: string;
  goal: string;
  /** "daily 08:00", "weekdays 08:00", "mondays 10:00" or a five-field cron line; absent = on demand */
  schedule?: string;
  tools: string[];
  roles: CrewRole[];
  /** SKILL.md the first run starts from */
  skill: string;
  /** attachment paths as written in the file, relative to it */
  attachments: string[];
  /** the gallery order (lower first) */
  order: number;
};

export const templatesDir = () => path.join(process.cwd(), "templates");
const SCHEDULE = /^(daily|weekdays|mondays)\s+(\d{1,2}):(\d{2})$/i;
const LABEL: Record<string, string> = { daily: "Daily", weekdays: "Weekdays", mondays: "Mondays" };

/** "daily 08:00" → "Daily 08:00" (the rail's words); a cron line stays as it is */
export const scheduleLabel = (s?: string) => {
  const m = s ? SCHEDULE.exec(s.trim()) : null;
  return m ? `${LABEL[m[1].toLowerCase()]} ${m[2].padStart(2, "0")}:${m[3]}` : s?.trim() || "On demand";
};

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : typeof v === "string" && v.trim() ? v.split(",").map((t) => t.trim()) : []);

/** One template from its YAML. Throws with the file and the reason when a field is missing or wrong. */
export function parseTemplate(slug: string, yaml: string, dir = templatesDir()): Template {
  const y = parseYaml(yaml);
  const where = `templates/${slug}.yaml`;
  const title = text(y.title);
  const goal = text(y.goal);
  const tools = list(y.tools);
  if (!title || !goal || !tools.length) throw new Error(`${where}: needs title, goal and tools`);
  const roles = y.roles === undefined ? DEFAULT_ROLES : parseRoles((y.roles as YamlMap[]).map((r) => ({ ...r })));
  if (typeof roles === "string") throw new Error(`${where}: ${roles}`);
  const attachments = list(y.attachments);
  for (const a of attachments) if (!existsSync(path.resolve(dir, a))) throw new Error(`${where}: attachment ${a} not found`);
  return { slug, title, goal, schedule: text(y.schedule) || undefined, tools, roles, skill: text(y.skill), attachments, order: Number(text(y.order)) || 50 };
}

export function listTemplates(): Template[] {
  const dir = templatesDir();
  if (!existsSync(dir)) return [];
  const out: Template[] = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".yaml")).sort()) {
    try {
      out.push(parseTemplate(f.replace(/\.yaml$/, ""), readFileSync(path.join(dir, f), "utf8"), dir));
    } catch (e) {
      console.warn("[nimbus] skipping template:", e instanceof Error ? e.message : e);
    }
  }
  return out.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

export const getTemplate = (slug: string) => listTemplates().find((t) => t.slug === slug);

/** The template's attachments as files to store with a new workstream (name and content). */
export function templateFiles(t: Template): { name: string; content: string }[] {
  return t.attachments.map((a) => ({ name: path.basename(a), content: readFileSync(path.resolve(templatesDir(), a), "utf8") }));
}
