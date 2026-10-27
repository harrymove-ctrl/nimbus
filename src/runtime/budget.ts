// Spend guards (docs/BUDGET.md): a per-run cap, a daily cap, and the numbers the UI shows. All of it is testable in mock mode.
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { modelMode } from "@/lib/tokenfactory";

const num = (v: string | undefined, d: number) => (v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : d);
export const runCapUsd = () => num(process.env.NIMBUS_RUN_CAP_USD, 0.25);
export const dayCapUsd = () => num(process.env.NIMBUS_DAY_CAP_USD, 5);

/** Thrown the moment a run's running cost passes the cap; live.ts turns it into run.error "spend cap". */
export class SpendCapError extends Error {
  constructor(
    public spentUsd: number,
    public capUsd: number,
  ) {
    super("spend cap");
  }
}

declare global {
  var __nimbusInflight: Map<string, number> | undefined;
}
/** Cost of runs that have not been written to SQLite yet (their row is updated when they end). */
export const inflight = (globalThis.__nimbusInflight ??= new Map<string, number>());

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * Total spend today: finished runs from SQLite plus runs still going. Only real-model runs count: the cap protects the
 * credit, and mock runs spend nothing. NIMBUS_COUNT_MOCK=1 counts them too (the guard's own test uses it).
 */
export async function daySpendUsd(): Promise<number> {
  const db = await getDb();
  const countMock = process.env.NIMBUS_COUNT_MOCK === "1";
  const where = countMock ? gte(schema.runs.startedAt, startOfToday()) : and(gte(schema.runs.startedAt, startOfToday()), eq(schema.runs.model, "nebius"));
  const [row] = await db.select({ total: sql<number>`coalesce(sum(${schema.runs.costUsd}), 0)` }).from(schema.runs).where(where);
  let live = 0;
  if (countMock || modelMode() === "nebius") for (const v of inflight.values()) live += v;
  return Number(row?.total ?? 0) + live;
}

export type DayBudget = { ok: boolean; spentUsd: number; capUsd: number; message?: string };

/** Call before starting any run (API, scheduler, job, chat). Past the cap every new run is refused. */
export async function checkDayBudget(): Promise<DayBudget> {
  const spentUsd = await daySpendUsd();
  const capUsd = dayCapUsd();
  if (spentUsd >= capUsd) return { ok: false, spentUsd, capUsd, message: `Daily spend cap reached: $${spentUsd.toFixed(2)} of $${capUsd.toFixed(2)} today. New runs resume tomorrow, or raise NIMBUS_DAY_CAP_USD.` };
  return { ok: true, spentUsd, capUsd };
}
