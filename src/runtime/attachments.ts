// The run's attached data files: the sample CSVs in fixtures/, any files the run was started with, and (for the cost
// audit and Token Factory watch) a 7 day export of the app's own model usage. They are copied into the run workspace
// at run start and named once in every agent's first prompt, so nobody searches the web for data.csv.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { and, asc, eq, gte } from "drizzle-orm";
import { dataDir, getDb, schema } from "@/db";
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

/** A workstream's own files (a template's flashcards.csv, an imported bills.csv): attached to every run of it. */
export const workstreamFilesDir = (workstreamId: string) => path.join(dataDir(), "workstreams", workstreamId.replace(/[^\w.-]/g, "_"), "files");
export const MAX_FILE_BYTES = 512 * 1024;
export const MAX_FILES = 8;
/** "My Bills (2026).csv" → "My_Bills_2026_.csv": the name the crew sees in its workspace */
export const fileName = (name: string) => path.basename(name).replace(/[^\w.-]/g, "_").replace(/^\.+/, "").slice(0, 80);

/** Store files with a workstream (created from a template or `nimbus ws import`). Returns the stored names. */
export function saveWorkstreamFiles(workstreamId: string, files: { name: string; content: string }[]): string[] {
  const dir = workstreamFilesDir(workstreamId);
  mkdirSync(dir, { recursive: true });
  const names: string[] = [];
  for (const f of files.slice(0, MAX_FILES)) {
    const name = fileName(f.name);
    if (!name || Buffer.byteLength(f.content) > MAX_FILE_BYTES) continue;
    writeFileSync(path.join(dir, name), f.content);
    names.push(name);
  }
  return names;
}

export const workstreamFiles = (workstreamId: string) => {
  const dir = workstreamFilesDir(workstreamId);
  return existsSync(dir) ? readdirSync(dir).sort() : [];
};

export const removeWorkstreamFiles = (workstreamId: string) => rmSync(path.dirname(workstreamFilesDir(workstreamId)), { recursive: true, force: true });

/**
 * Copy the attached files into the run workspace and return their names: fixtures/*.csv, the workstream's own files,
 * the run's input files that exist in fixtures/ or the workspace, and usage-7d.csv when the workstream reads our usage.
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
  for (const f of workstreamFiles(ctx.workstreamId)) {
    copyFileSync(path.join(workstreamFilesDir(ctx.workstreamId), f), path.join(ctx.workspace, f));
    names.add(f);
  }
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

/** The header line of a CSV, so the crew uses the real column names instead of guessing (KeyError: 'card_id'). */
function csvColumns(file: string): string {
  try {
    const head = readFileSync(file, "utf8").split(/\r?\n/, 1)[0] ?? "";
    return head.length > 0 && head.length <= 200 ? head : "";
  } catch {
    return "";
  }
}

/**
 * The one sentence every agent sees. "In your workspace" reads true locally and in a Nebius Sandbox (/work). With the
 * workspace given, each CSV carries its columns, and the crew is told that every run_code call starts fresh.
 */
export function attachedSentence(files: string[], workspace?: string) {
  if (!files.length) return "";
  const named = files.map((f) => {
    const cols = workspace && f.toLowerCase().endsWith(".csv") ? csvColumns(path.join(workspace, f)) : "";
    return cols ? `${f} (columns: ${cols})` : f;
  });
  return `Attached files in your workspace (read them with run_code, never search the web for them): ${named.join("; ")}. Each run_code call starts in a fresh sandbox with these files only: print what the next step needs, or save results with write_artifact; a file you wrote in an earlier call is gone.`;
}
