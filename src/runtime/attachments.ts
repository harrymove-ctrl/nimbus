// The run's attached data files: the sample CSVs in fixtures/, any files the run was started with, and (for the cost
// audit and Token Factory watch) a 7 day export of the app's own model usage. They are copied into the run workspace
// at run start and named once in every agent's first prompt, so nobody searches the web for data.csv.
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { and, asc, eq, gte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { TIERS, costUsd, type Tier } from "@/lib/models";
import type { RunCtx } from "./context";

const fixturesDir = (...p: string[]) => path.join(process.cwd(), "fixtures", ...p);
export const USAGE_FILE = "usage-7d.csv";
const USAGE_MAX_ROWS = 5000;
const USAGE_HEADER = "startedAt,runId,workstreamId,agent,tier,model,tokensIn,tokensOut,costUsd";

/** The cost audit and the Token Factory watch read "our usage log": export it when the run can use run_code. */
export function wantsUsage(ctx: Pick<RunCtx, "workstreamId" | "goal" | "allowedTools">) {
  if (!ctx.allowedTools.includes("run_code")) return false;
  return ctx.workstreamId === "ws-audit" || ctx.workstreamId === "ws-watch" || /\busage\b/i.test(ctx.goal);
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One row per model call ("usage" event) in the last 7 days, oldest first, at most 5000 rows. Read-only. */
export async function exportUsage(file: string, now = Date.now()): Promise<number> {
  const rows: string[] = [];
  try {
    const db = await getDb();
    const since = now - 7 * 24 * 60 * 60_000;
    const events = await db
      .select({ runStartedAt: schema.runs.startedAt, runId: schema.runEvents.runId, workstreamId: schema.runs.workstreamId, agent: schema.runEvents.agentInstance, tMs: schema.runEvents.tMs, payload: schema.runEvents.payload })
      .from(schema.runEvents)
      .innerJoin(schema.runs, eq(schema.runs.id, schema.runEvents.runId))
      .where(and(eq(schema.runEvents.type, "usage"), gte(schema.runs.startedAt, since)))
      .orderBy(asc(schema.runs.startedAt), asc(schema.runEvents.seq));
    for (const e of events.slice(-USAGE_MAX_ROWS)) {
      const p = e.payload as { tier?: string; in?: number; out?: number; cached?: boolean };
      const tier = (p.tier && p.tier in TIERS ? p.tier : "super") as Tier;
      const tin = Number(p.in) || 0;
      const tout = Number(p.out) || 0;
      // a cache hit costs nothing (agent.ts adds cost only when the call was not cached)
      const cost = p.cached ? 0 : costUsd(tier, tin, tout);
      rows.push([new Date(e.runStartedAt + e.tMs).toISOString(), e.runId, e.workstreamId, e.agent, tier, TIERS[tier], tin, tout, cost.toFixed(6)].map(csvCell).join(","));
    }
  } catch (err) {
    console.warn("[nimbus] usage export failed, writing the header only:", err instanceof Error ? err.message : err);
  }
  writeFileSync(file, [USAGE_HEADER, ...rows].join("\n") + "\n");
  return rows.length;
}

/**
 * Copy the attached files into the run workspace and return their names: fixtures/*.csv, the run's input files that
 * exist in fixtures/ or the workspace, and usage-7d.csv when the workstream reads our usage.
 */
export async function prepareAttachments(ctx: RunCtx, inputFiles: string[] = []): Promise<string[]> {
  mkdirSync(ctx.workspace, { recursive: true });
  const names = new Set<string>();
  const attach = (name: string) => {
    const dest = path.join(ctx.workspace, name);
    if (!existsSync(dest) && existsSync(fixturesDir(name))) copyFileSync(fixturesDir(name), dest);
    if (existsSync(dest)) names.add(name);
  };
  for (const f of readdirSync(fixturesDir()).filter((n) => n.endsWith(".csv"))) attach(f);
  for (const f of inputFiles) {
    const base = path.basename(f).replace(/[^\w.-]/g, "_");
    if (base) attach(base);
  }
  if (wantsUsage(ctx)) {
    await exportUsage(path.join(ctx.workspace, USAGE_FILE));
    names.add(USAGE_FILE);
  }
  return [...names].sort();
}

/** The one sentence every agent sees. "In your workspace" reads true locally and in a Nebius Sandbox (/work). */
export function attachedSentence(files: string[]) {
  return files.length ? `Attached files in your workspace (read them with run_code, never search the web for them): ${files.join(", ")}` : "";
}
