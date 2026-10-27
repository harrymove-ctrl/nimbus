// Workstream SKILL.md: what the crew learned, plus the "allow:" policy lines written by Approve & always allow.
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { ProposedAction } from "@/lib/events";
import { WORKSTREAMS } from "@/lib/workstreams";

export async function loadSkill(workstreamId: string): Promise<string> {
  const db = await getDb();
  const [row] = await db.select().from(schema.skills).where(eq(schema.skills.workstreamId, workstreamId));
  return row?.content ?? WORKSTREAMS.find((w) => w.id === workstreamId)?.skill ?? "";
}

/** A Learner rewrite (the default) becomes the revert point; `policyEdit` (Approve & always allow, REVOKE) changes the text but not "last rewrite" or what REVERT restores. */
export async function saveSkill(workstreamId: string, content: string, opts: { runId?: string; policyEdit?: boolean } = {}) {
  const db = await getDb();
  const [row] = await db.select().from(schema.skills).where(eq(schema.skills.workstreamId, workstreamId));
  if (!row) await db.insert(schema.skills).values({ workstreamId, content, version: 1, updatedRunId: opts.runId ?? null, updatedAt: Date.now() });
  else if (opts.policyEdit) await db.update(schema.skills).set({ content, previous: row.previous ? keepPolicy(row.previous, policySection(content)) : null, version: row.version + 1, updatedAt: Date.now() }).where(eq(schema.skills.workstreamId, workstreamId));
  else if (content === row.content) return; // a rewrite that changes nothing must not replace the revert point
  else await db.update(schema.skills).set({ content, previous: row.content, updatedRunId: opts.runId ?? null, version: row.version + 1, updatedAt: Date.now() }).where(eq(schema.skills.workstreamId, workstreamId));
}

/** `text` with exactly these policy lines; untouched when neither has any (so plain test text round-trips). */
function keepPolicy(text: string, lines: string[]): string {
  return !lines.length && !policySection(text).length ? text : withPolicy(text, lines);
}

const POLICY_HEAD = "## Policy";

export function policySection(skill: string): string[] {
  const i = skill.indexOf(POLICY_HEAD);
  if (i < 0) return [];
  return skill
    .slice(i + POLICY_HEAD.length)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && l !== "(none yet)");
}

export function withPolicy(skill: string, lines: string[]): string {
  const i = skill.indexOf(POLICY_HEAD);
  const head = (i < 0 ? skill.trimEnd() : skill.slice(0, i).trimEnd()) + `\n\n${POLICY_HEAD}\n`;
  return head + (lines.length ? lines.join("\n") : "(none yet)");
}

export async function appendPolicy(workstreamId: string, rule: string, runId?: string) {
  const skill = await loadSkill(workstreamId);
  const lines = policySection(skill);
  if (!lines.includes(rule)) lines.push(rule);
  await saveSkill(workstreamId, withPolicy(skill, lines), { policyEdit: true });
  const db = await getDb();
  await db.insert(schema.policies).values({ workstreamId, rule, sourceRunId: runId ?? null, createdAt: Date.now() }).onConflictDoNothing();
}

/** REVOKE: drop the `index`-th policy line (in SKILL.md order). Returns the removed rule, or null if there is none. */
export async function revokePolicy(workstreamId: string, index: number): Promise<string | null> {
  const skill = await loadSkill(workstreamId);
  const lines = policySection(skill);
  if (!Number.isInteger(index) || index < 0 || index >= lines.length) return null;
  const [rule] = lines.splice(index, 1);
  await saveSkill(workstreamId, withPolicy(skill, lines), { policyEdit: true });
  const db = await getDb();
  await db.delete(schema.policies).where(and(eq(schema.policies.workstreamId, workstreamId), eq(schema.policies.rule, rule)));
  return rule;
}

/**
 * Policy lines (written by Approve & always allow, one per kind of action):
 *   `allow: send_message to #growth for this workstream`   (scope = the channel)
 *   `allow: open_pr for branches fix/*`                     (scope = a branch glob)
 */
export type ParsedRule = { kind: string; scope?: string; branches?: string };
export function parseRule(line: string): ParsedRule | null {
  const b = line.match(/^allow:\s*(\w+)\s+for branches\s+(\S+)$/);
  if (b) return { kind: b[1], branches: b[2] };
  const m = line.match(/^allow:\s*(\w+)(?:\s+to\s+(\S+))?\s+for this workstream$/);
  return m ? { kind: m[1], scope: m[2] } : null;
}

/** The line "Approve & always allow" writes for this action. */
export function ruleFor(action: ProposedAction): string {
  const d = action.details as { channel?: string; branch?: string } | undefined;
  if (action.kind === "open_pr" && d?.branch) return `allow: open_pr for branches ${d.branch.split("/")[0]}/*`;
  return `allow: ${action.kind}${d?.channel ? ` to ${d.channel}` : ""} for this workstream`;
}

const globMatch = (glob: string, s: string) => new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`).test(s);

/** The policy line that lets this action through without asking, if any. */
export function matchingRule(skill: string, action: ProposedAction): string | undefined {
  const d = action.details as { channel?: string; branch?: string } | undefined;
  return policySection(skill).find((l) => {
    const r = parseRule(l);
    if (!r || r.kind !== action.kind) return false;
    if (r.branches) return !!d?.branch && globMatch(r.branches, d.branch);
    return !r.scope || r.scope === d?.channel;
  });
}

export const policyAllows = (skill: string, action: ProposedAction): boolean => matchingRule(skill, action) !== undefined;

/** A policy line let an action through without asking. */
export async function countPolicyUse(workstreamId: string, skill: string, action: ProposedAction) {
  const rule = matchingRule(skill, action);
  if (!rule) return;
  const db = await getDb();
  await db.update(schema.policies).set({ usedCount: sql`${schema.policies.usedCount} + 1` }).where(and(eq(schema.policies.workstreamId, workstreamId), eq(schema.policies.rule, rule)));
}

/** Line diff (LCS) for the run summary: " " context, "+" added, "-" removed. */
export function diffLines(a: string, b: string): { op: "+" | "-" | " "; text: string }[] {
  const x = a.split("\n");
  const y = b.split("\n");
  const dp = Array.from({ length: x.length + 1 }, () => new Array<number>(y.length + 1).fill(0));
  for (let i = x.length - 1; i >= 0; i--) for (let j = y.length - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: { op: "+" | "-" | " "; text: string }[] = [];
  let i = 0, j = 0;
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) (out.push({ op: " ", text: x[i] }), i++, j++);
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ op: "-", text: x[i++] });
    else out.push({ op: "+", text: y[j++] });
  }
  while (i < x.length) out.push({ op: "-", text: x[i++] });
  while (j < y.length) out.push({ op: "+", text: y[j++] });
  return out.filter((r) => r.text !== "" || r.op !== " ");
}

/** "Revert skill change": put back the SKILL.md from before the latest rewrite. Returns the restored text, or null if there is nothing to revert. */
export async function revertSkill(workstreamId: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db.select().from(schema.skills).where(eq(schema.skills.workstreamId, workstreamId));
  if (!row?.previous) return null;
  // Policy lines are not the Learner's to undo: keep today's, even if the revert point predates them.
  const content = keepPolicy(row.previous, policySection(row.content));
  await db.update(schema.skills).set({ content, previous: null, updatedRunId: null, version: row.version + 1, updatedAt: Date.now() }).where(eq(schema.skills.workstreamId, workstreamId));
  return content;
}
