// What a workstream has learned, shaped for the Memory & skill tab (SPEC §16).
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { diffLines, loadSkill, policySection } from "./skills";

export type LearnedMemory = { id: string; text: string; runId: string; runNumber: number; createdAt: number; usedCount: number };
export type LearnedRule = { index: number; rule: string; runId: string | null; runNumber: number | null; createdAt: number | null; usedCount: number };
export type LearnedSkill = {
  /** SKILL.md without its ## Policy section (that is the Rules section) */
  content: string;
  updatedAt: number | null;
  runId: string | null;
  runNumber: number | null;
  hasPrevious: boolean;
  added: number;
  removed: number;
  diff: { op: "+" | "-" | " "; text: string }[];
};
export type Learning = { memories: LearnedMemory[]; rules: LearnedRule[]; skill: LearnedSkill; lastLearned: { runNumber: number; at: number } | null };

/** Run numbers are per workstream, oldest = 1. */
async function runNumbers(workstreamId: string): Promise<Map<string, number>> {
  const db = await getDb();
  const rows = await db.select({ id: schema.runs.id }).from(schema.runs).where(eq(schema.runs.workstreamId, workstreamId)).orderBy(asc(schema.runs.startedAt));
  return new Map(rows.map((r, i) => [r.id, i + 1]));
}

export async function listMemories(workstreamId: string): Promise<LearnedMemory[]> {
  const db = await getDb();
  const [rows, nums] = await Promise.all([db.select().from(schema.memories).where(eq(schema.memories.workstreamId, workstreamId)).orderBy(desc(schema.memories.createdAt)), runNumbers(workstreamId)]);
  return rows.map((r) => ({ id: r.id, text: r.text, runId: r.sourceRunId, runNumber: nums.get(r.sourceRunId) ?? 0, createdAt: r.createdAt, usedCount: r.usedCount }));
}

export async function forgetMemory(workstreamId: string, id: string): Promise<boolean> {
  const db = await getDb();
  const gone = await db.delete(schema.memories).where(and(eq(schema.memories.workstreamId, workstreamId), eq(schema.memories.id, id))).returning({ id: schema.memories.id });
  return gone.length > 0;
}

export async function getLearning(workstreamId: string): Promise<Learning> {
  const db = await getDb();
  const [memories, nums, full, [srow], prow] = await Promise.all([
    listMemories(workstreamId),
    runNumbers(workstreamId),
    loadSkill(workstreamId),
    db.select().from(schema.skills).where(eq(schema.skills.workstreamId, workstreamId)),
    db.select().from(schema.policies).where(eq(schema.policies.workstreamId, workstreamId)),
  ]);
  const meta = new Map(prow.map((p) => [p.rule, p]));
  const rules: LearnedRule[] = policySection(full).map((rule, index) => {
    const m = meta.get(rule);
    return { index, rule, runId: m?.sourceRunId ?? null, runNumber: m?.sourceRunId ? (nums.get(m.sourceRunId) ?? null) : null, createdAt: m?.createdAt ?? null, usedCount: m?.usedCount ?? 0 };
  });
  const body = (s: string) => {
    const i = s.indexOf("## Policy");
    return (i < 0 ? s : s.slice(0, i)).trim();
  };
  const diff = srow?.previous ? diffLines(body(srow.previous), body(srow.content)) : [];
  const skill: LearnedSkill = {
    content: body(full),
    updatedAt: srow?.updatedRunId ? srow.updatedAt : null,
    runId: srow?.updatedRunId ?? null,
    runNumber: srow?.updatedRunId ? (nums.get(srow.updatedRunId) ?? null) : null,
    hasPrevious: !!srow?.previous,
    added: diff.filter((r) => r.op === "+").length,
    removed: diff.filter((r) => r.op === "-").length,
    diff,
  };
  const newest = memories[0];
  const lastLearned = skill.runNumber && skill.updatedAt ? { runNumber: skill.runNumber, at: skill.updatedAt } : newest ? { runNumber: newest.runNumber, at: newest.createdAt } : null;
  return { memories, rules, skill, lastLearned };
}
