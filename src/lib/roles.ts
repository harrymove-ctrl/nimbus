// The crew of a workstream (docs/TEMPLATES.md): which roles the Orchestrator may plan with, each with its own brief,
// tier ceiling and tools. The default five are today's fixed crew; their briefs are the role prompts the runtime always
// used, so a workstream that never changed its crew prompts exactly as before. Safe for the client (no node imports).
import type { Tier } from "./models";

export type CrewRole = { role: string; brief: string; tier: Tier; tools?: string[] };

/** Worker tools a role may list (control tools belong to the Orchestrator; save_learning to the Learner). */
export const ROLE_TOOL_NAMES = ["web_search", "fetch_url", "run_code", "write_artifact", "send_message", "read_repo", "open_pr", "ask_user"] as const;

export const DEFAULT_ROLES: CrewRole[] = [
  { role: "researcher", brief: "Use web_search and fetch_url, cite sources, and return a short sourced report. Ask the person with ask_user only if the brief is ambiguous.", tier: "super", tools: ["web_search", "fetch_url", "read_repo", "ask_user"] },
  { role: "analyst", brief: "Use run_code on the attached data to compute exact numbers, fix your own script errors, save useful code with write_artifact, and report the numbers.", tier: "super", tools: ["run_code", "read_repo", "write_artifact", "ask_user"] },
  {
    role: "writer",
    brief:
      "Produce the document with write_artifact: the number first, then cause, evidence, open questions and next step. Edit by writing a new version of the same artifactId. When the brief asks you to send something, call send_message once per message, to its address; send_message asks for approval itself. Say only what your sources and the crew's reports say, using the latest of them. Never leave a placeholder in brackets such as [Your Name] or [Date].",
    tier: "super",
    tools: ["write_artifact", "read_repo", "send_message", "open_pr"],
  },
  { role: "checker", brief: "Validate data and fact-check claims quickly; report what is supported and any caveat.", tier: "nano", tools: ["run_code", "fetch_url", "read_repo"] },
  { role: "learner", brief: "From the run summary, call save_learning once with at most 8 durable memories and the rewritten SKILL.md (keep its structure).", tier: "nano" },
];

/** "quiz-master" → "Quiz master" (lane names, chips, plan cards) */
export const roleTitle = (role: string) => {
  const s = role.replace(/[-_]+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : role;
};

/** A role name is a lane id: lowercase, no spaces ("Quiz master" → "quiz-master"). */
export const roleSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);

const TIERS = ["ultra", "super", "nano"] as const;
export const MAX_ROLES = 8;
const MAX_BRIEF = 1200;

/** Same crew as the default five (names, briefs, tiers and tools): nothing about the run changes. */
export const isDefaultCrew = (roles: CrewRole[]) => crewKey(roles) === crewKey(DEFAULT_ROLES);
const crewKey = (roles: CrewRole[]) => JSON.stringify(roles.map((r) => [r.role, r.brief, r.tier, r.tools ?? null]));

/**
 * The roles a person or a template sent, checked: names become slugs and must be unique, "orchestrator" is reserved,
 * tiers are ultra, super or nano, tools come from ROLE_TOOL_NAMES. Returns the cleaned list or a sentence saying what is wrong.
 */
export function parseRoles(input: unknown): CrewRole[] | string {
  if (!Array.isArray(input)) return "roles is a list of { role, brief, tier, tools? }";
  if (!input.length) return "the crew needs at least one role";
  if (input.length > MAX_ROLES) return `at most ${MAX_ROLES} roles`;
  const out: CrewRole[] = [];
  for (const [i, raw] of input.entries()) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const role = roleSlug(String(r.role ?? r.name ?? ""));
    if (!role) return `role ${i + 1} needs a name`;
    if (role === "orchestrator") return `"orchestrator" leads every crew; pick another name for role ${i + 1}`;
    if (out.some((o) => o.role === role)) return `two roles are named "${role}"`;
    const brief = String(r.brief ?? "").trim().slice(0, MAX_BRIEF);
    if (!brief) return `${role} needs a brief: one or two sentences on what it does`;
    const tier = String(r.tier ?? "super").toLowerCase();
    if (!(TIERS as readonly string[]).includes(tier)) return `${role}: tier is ultra, super or nano, not "${tier}"`;
    let tools: string[] | undefined;
    if (r.tools !== undefined && r.tools !== null) {
      const list = Array.isArray(r.tools) ? r.tools.map(String) : String(r.tools).split(",");
      const bad = list.map((t) => t.trim()).filter((t) => t && !(ROLE_TOOL_NAMES as readonly string[]).includes(t));
      if (bad.length) return `${role}: unknown tool ${bad.join(", ")}`;
      tools = [...new Set(list.map((t) => t.trim()).filter(Boolean))];
    }
    out.push({ role, brief, tier: tier as Tier, ...(tools && role !== "learner" ? { tools } : {}) });
  }
  if (!out.some((r) => r.role !== "learner")) return "the crew needs a role besides the learner";
  return out;
}

/** The workstream's crew, or the default five for a row from before crews (or a broken value). */
export function crewOf(roles: unknown): CrewRole[] {
  if (roles == null) return DEFAULT_ROLES;
  const r = parseRoles(roles);
  return typeof r === "string" ? DEFAULT_ROLES : r;
}
