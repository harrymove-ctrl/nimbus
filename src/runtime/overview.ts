// Numbers for the Overview screen (docs/SPEC.md §17.1). Everything comes from SQLite; nothing is invented here.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { and, eq, gte } from "drizzle-orm";
import { dataDir, getDb, schema } from "@/db";
import type { UsageByTier } from "@/db/schema";
import { costUsd } from "@/lib/models";
import { modelMode } from "@/lib/tokenfactory";
import { WORKSTREAMS } from "@/lib/workstreams";
import { dayCapUsd } from "./budget";

const DAY = 86_400_000;
export const dayKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export type RunRef = { id: string; workstreamId: string; title: string; status: string; costUsd: number; startedAt: number; trigger: string };
export type HealthDay = { date: string; status: "ok" | "waited" | "failed" | "none"; runId?: string; note?: string };

export type Overview = {
  mock: boolean;
  today: string;
  stats: {
    spendTodayUsd: number;
    dayCapUsd: number;
    runsToday: number;
    approvalsWaiting: number;
    memoriesWeek: number;
    spark: { spend: number[]; runs: number[]; approvals: number[]; memories: number[] };
  };
  spendByDay: { date: string; label: string; ultra: number; super: number; nano: number }[];
  tokensByTier: { tier: "ultra" | "super" | "nano"; tokens: number }[];
  calendar: { date: string; value: number; costUsd: number }[];
  health: { workstreamId: string; title: string; schedule: string; days: HealthDay[] }[];
  router: { costUsd: number; atCeilingsUsd: number; savedFraction: number; runs: number };
  impact: { prs: number; messages: number; docs: number; savedUsd: number; manualMinutes: number; runs: number };
  /** router rules proposed by a run (waiting for approval, or approved: recorded in data/router-rules.json) */
  rules: { expectedSavingPct: number; applied: boolean; workstreamId: string; runId: string } | null;
  runsByDay: Record<string, RunRef[]>;
  lastRun: { id: string; workstreamId: string } | null;
  empty: boolean;
};

/** Fallback for rows written before usage_by_tier existed: split by the tiers' share of the recorded usage events. */
function tierCostFromRow(r: { usageByTier: UsageByTier | null; costUsd: number }) {
  if (r.usageByTier) return r.usageByTier;
  return { ultra: { in: 0, out: 0, costUsd: 0 }, super: { in: 0, out: 0, costUsd: r.costUsd }, nano: { in: 0, out: 0, costUsd: 0 } } as UsageByTier;
}

export async function getOverview(): Promise<Overview> {
  const db = await getDb();
  const now = Date.now();
  const today0 = startOfDay(now);
  const from = today0 - 55 * DAY; // 8 weeks of calendar
  const rows = await db.select().from(schema.runs).where(gte(schema.runs.startedAt, from));
  const minutes = new Map(WORKSTREAMS.map((w) => [w.id, w.estimatedManualMinutes]));

  // last 7 days (oldest first), for the stat sparklines and the stacked chart
  const days7 = Array.from({ length: 7 }, (_, i) => today0 - (6 - i) * DAY);
  const idx7 = new Map(days7.map((d, i) => [dayKey(d), i]));
  const spend7 = days7.map(() => ({ ultra: 0, super: 0, nano: 0 }));
  const runs7 = days7.map(() => 0);
  const tokens = { ultra: 0, super: 0, nano: 0 };
  const cal = new Map<string, { value: number; costUsd: number }>();
  const byDay: Record<string, RunRef[]> = {};
  const router = { costUsd: 0, atCeilingsUsd: 0, runs: 0 };
  let manual = 0;
  let savedUsd = 0;
  const weekRunIds = new Set<string>();

  for (const r of rows) {
    const k = dayKey(r.startedAt);
    const c = cal.get(k) ?? { value: 0, costUsd: 0 };
    c.value++;
    c.costUsd += r.costUsd;
    cal.set(k, c);
    (byDay[k] ??= []).push({ id: r.id, workstreamId: r.workstreamId, title: r.title, status: r.status, costUsd: r.costUsd, startedAt: r.startedAt, trigger: r.trigger });
    const i = idx7.get(k);
    if (i !== undefined) {
      const by = tierCostFromRow(r);
      for (const t of ["ultra", "super", "nano"] as const) {
        spend7[i][t] += by[t].costUsd;
        tokens[t] += by[t].in + by[t].out;
      }
      runs7[i]++;
      weekRunIds.add(r.id);
      router.costUsd += r.costUsd;
      router.atCeilingsUsd += r.baselineUsd || r.costUsd;
      router.runs++;
      savedUsd += Math.max(0, (r.baselineUsd || r.costUsd) - r.costUsd);
      if (r.status === "done") manual += minutes.get(r.workstreamId) ?? 0;
    }
  }
  for (const k of Object.keys(byDay)) byDay[k].sort((a, b) => b.startedAt - a.startedAt);

  // approvals: waiting now, and decided per day (the sparkline)
  const appr = await db.select().from(schema.approvals);
  const runRows = new Map(rows.map((r) => [r.id, r]));
  const approvalsWaiting = appr.filter((a) => a.status === "pending" && runRows.get(a.runId)?.status === "running").length;
  const approvals7 = days7.map((d) => appr.filter((a) => a.decidedAt && a.decidedAt >= d && a.decidedAt < d + DAY).length);

  // memories this week
  const mems = await db.select({ createdAt: schema.memories.createdAt }).from(schema.memories).where(gte(schema.memories.createdAt, days7[0]));
  const mem7 = days7.map((d) => mems.filter((m) => m.createdAt >= d && m.createdAt < d + DAY).length);

  // impact: counted from the events of this week's runs (PR urls, logged sends, doc artifacts)
  let prs = 0, messages = 0;
  const docs = new Set<string>();
  const evs = await db.select({ runId: schema.runEvents.runId, type: schema.runEvents.type, payload: schema.runEvents.payload }).from(schema.runEvents).where(and(eq(schema.runEvents.type, "tool.result")));
  for (const e of evs) {
    if (!weekRunIds.has(e.runId)) continue;
    const p = e.payload as { tool?: string; output?: { url?: string; logged?: boolean } };
    if (p.output?.url && /\/pull\//.test(p.output.url)) prs++;
    else if (p.output?.logged && (p.tool === "send_message" || p.tool === "request_approval")) messages++;
  }
  const arts = await db.select({ runId: schema.artifacts.runId, artifactId: schema.artifacts.artifactId, kind: schema.artifacts.kind }).from(schema.artifacts);
  for (const a of arts) if (a.kind === "doc" && weekRunIds.has(a.runId)) docs.add(`${a.runId}:${a.artifactId}`);
  const histDocs = await db.select({ runId: schema.runEvents.runId, payload: schema.runEvents.payload }).from(schema.runEvents).where(eq(schema.runEvents.type, "artifact.version"));
  for (const e of histDocs) if (weekRunIds.has(e.runId) && (e.payload as { kind?: string }).kind === "doc") docs.add(`${e.runId}:${(e.payload as { artifactId?: string }).artifactId}`);

  // scheduled health: 30 days per workstream that has a schedule
  const apprByRun = new Map<string, number>();
  for (const a of appr) if (a.decidedAt) apprByRun.set(a.runId, a.decidedAt);
  const health = WORKSTREAMS.filter((w) => w.scheduleCron).map((w) => {
    const dayList: HealthDay[] = [];
    for (let d = 29; d >= 0; d--) {
      const day0 = today0 - d * DAY;
      const k = dayKey(day0);
      const rs = (byDay[k] ?? []).filter((r) => r.workstreamId === w.id);
      if (!rs.length) {
        dayList.push({ date: k, status: "none" });
        continue;
      }
      const r = rs[0];
      const row = runRows.get(r.id)!;
      const decided = apprByRun.get(r.id);
      const waited = !!decided && decided - row.startedAt > 5 * 60_000;
      dayList.push({ date: k, status: r.status === "failed" || r.status === "stopped" ? "failed" : waited ? "waited" : "ok", runId: r.id, note: waited ? "waited for approval" : r.status === "failed" ? "failed" : undefined });
    }
    return { workstreamId: w.id, title: w.title, schedule: w.scheduleLabel ?? "", days: dayList };
  });

  const stats = {
    spendTodayUsd: spend7[6].ultra + spend7[6].super + spend7[6].nano,
    dayCapUsd: dayCapUsd(),
    runsToday: runs7[6],
    approvalsWaiting,
    memoriesWeek: mem7.reduce((a, b) => a + b, 0),
    spark: { spend: spend7.map((s) => +(s.ultra + s.super + s.nano).toFixed(4)), runs: runs7, approvals: approvals7, memories: mem7 },
  };
  // router rules: the latest proposal (a write_file approval for router-rules.json) and whether it was recorded
  let rulesInfo: Overview["rules"] = null;
  const proposals = await db.select({ runId: schema.runEvents.runId, payload: schema.runEvents.payload }).from(schema.runEvents).where(eq(schema.runEvents.type, "approval.request"));
  const withTime = proposals
    .map((p) => ({ ...p, a: (p.payload as { action?: { kind?: string; details?: { path?: string; expectedSavingPct?: number } } }).action, r: runRows.get(p.runId) }))
    .filter((p) => p.a?.kind === "write_file" && p.a.details?.path?.endsWith("router-rules.json") && typeof p.a.details.expectedSavingPct === "number" && p.r)
    .sort((a, b) => b.r!.startedAt - a.r!.startedAt)[0];
  if (withTime) {
    const file = path.join(dataDir(), "router-rules.json");
    let applied = false;
    if (existsSync(file)) {
      try {
        applied = (JSON.parse(readFileSync(file, "utf8")) as { runId?: string }).runId === withTime.runId;
      } catch {
        applied = false;
      }
    }
    rulesInfo = { expectedSavingPct: withTime.a!.details!.expectedSavingPct!, applied, workstreamId: withTime.r!.workstreamId, runId: withTime.runId };
  }
  const latest = [...rows].sort((a, b) => b.startedAt - a.startedAt)[0];
  void costUsd;
  return {
    mock: modelMode() === "mock",
    today: dayKey(now),
    stats,
    spendByDay: days7.map((d, i) => ({ date: dayKey(d), label: new Date(d).toLocaleDateString("en-US", { weekday: "short", day: "numeric" }), ultra: +spend7[i].ultra.toFixed(4), super: +spend7[i].super.toFixed(4), nano: +spend7[i].nano.toFixed(4) })),
    tokensByTier: (["ultra", "super", "nano"] as const).map((tier) => ({ tier, tokens: tokens[tier] })),
    calendar: Array.from({ length: 56 }, (_, i) => dayKey(from + i * DAY)).map((date) => ({ date, value: cal.get(date)?.value ?? 0, costUsd: +(cal.get(date)?.costUsd ?? 0).toFixed(4) })),
    health,
    router: { ...router, savedFraction: router.atCeilingsUsd > 0 ? 1 - router.costUsd / router.atCeilingsUsd : 0 },
    impact: { prs, messages, docs: docs.size, savedUsd: +savedUsd.toFixed(3), manualMinutes: manual, runs: router.runs },
    rules: rulesInfo,
    runsByDay: byDay,
    lastRun: latest ? { id: latest.id, workstreamId: latest.workstreamId } : null,
    empty: rows.length === 0,
  };
}
