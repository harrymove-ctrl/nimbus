// Workstream SKILL.md: what the crew learned, plus the "allow:" policy lines written by Approve & always allow.
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { ProposedAction } from "@/lib/events";
import { WORKSTREAMS } from "@/lib/workstreams";

export async function loadSkill(workstreamId: string): Promise<string> {
  const db = await getDb();
  const [row] = await db.select().from(schema.skills).where(eq(schema.skills.workstreamId, workstreamId));
  return row?.content ?? WORKSTREAMS.find((w) => w.id === workstreamId)?.skill ?? "";
}

export async function saveSkill(workstreamId: string, content: string) {
  const db = await getDb();
  const [row] = await db.select().from(schema.skills).where(eq(schema.skills.workstreamId, workstreamId));
  if (row) await db.update(schema.skills).set({ content, previous: row.content, version: row.version + 1, updatedAt: Date.now() }).where(eq(schema.skills.workstreamId, workstreamId));
  else await db.insert(schema.skills).values({ workstreamId, content, version: 1, updatedAt: Date.now() });
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

export async function appendPolicy(workstreamId: string, rule: string) {
  const skill = await loadSkill(workstreamId);
  const lines = policySection(skill);
  if (!lines.includes(rule)) lines.push(rule);
  await saveSkill(workstreamId, withPolicy(skill, lines));
}

/** `allow: send_message to #growth for this workstream` allows a send_message to #growth without asking. */
export function policyAllows(skill: string, action: ProposedAction): boolean {
  const scope = (action.details as { channel?: string } | undefined)?.channel;
  return policySection(skill).some((l) => {
    const m = l.match(/^allow:\s*(\w+)(?:\s+to\s+(\S+))?\s+for this workstream$/);
    return !!m && m[1] === action.kind && (!m[2] || m[2] === scope);
  });
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
  await db.update(schema.skills).set({ content: row.previous, previous: null, version: row.version + 1, updatedAt: Date.now() }).where(eq(schema.skills.workstreamId, workstreamId));
  return row.previous;
}
