// Eight weeks of seeded history, so the Overview has something to chart on first open (docs/SPEC.md §17.1).
// Deterministic (hash-seeded): the same database every time. These are labelled history rows with a minimal event
// log (start, one message, the artifacts and sends they made, end), not full recordings; the rail's runs for today
// are real ones.
import * as schema from "./schema";
import type { UsageByTier } from "./schema";
import { costUsd } from "@/lib/models";
import { WORKSTREAMS } from "@/lib/workstreams";

type Db = import("./index").Db;

const rnd = (key: string) => {
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  // murmur3 finaliser: without it, ids that differ only in the last digit (consecutive days) hash to similar numbers
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

type Tpl = { tier: Record<"ultra" | "super" | "nano", [number, number]>; secs: number; saving: number; docs: number; sends: number; prs: number };
const TPL: Record<string, Tpl> = {
  "ws-ship-nimbus": { tier: { ultra: [20000, 2400], super: [68000, 5200], nano: [31000, 2400] }, secs: 70, saving: 0.43, docs: 1, sends: 0, prs: 1 },
  "ws-radar": { tier: { ultra: [9000, 1000], super: [17000, 1800], nano: [5000, 400] }, secs: 40, saving: 0.3, docs: 1, sends: 1, prs: 0 },
  "ws-brief": { tier: { ultra: [7000, 800], super: [20000, 1900], nano: [6000, 500] }, secs: 35, saving: 0.38, docs: 1, sends: 3, prs: 0 },
  "ws-audit": { tier: { ultra: [8000, 900], super: [28000, 2500], nano: [9000, 800] }, secs: 90, saving: 0.4, docs: 1, sends: 0, prs: 0 },
  "ws-release": { tier: { ultra: [8500, 900], super: [18000, 1500], nano: [6000, 400] }, secs: 50, saving: 0.35, docs: 1, sends: 0, prs: 1 },
  "ws-checkout": { tier: { ultra: [8000, 700], super: [16000, 1500], nano: [13000, 1400] }, secs: 45, saving: 0.45, docs: 1, sends: 1, prs: 0 },
};

type Plan = { ws: string; at: Date; trigger: "cron" | "manual" };

function plan(): Plan[] {
  const out: Plan[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let d = 56; d >= 1; d--) {
    const day = new Date(today);
    day.setDate(day.getDate() - d);
    const at = (h: number, m = 0) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
    const key = `${day.getFullYear()}${day.getMonth()}${day.getDate()}`;
    const dow = day.getDay();
    out.push({ ws: "ws-radar", at: at(9), trigger: "cron" });
    if (dow >= 1 && dow <= 5) out.push({ ws: "ws-brief", at: at(8), trigger: "cron" });
    if (dow === 1) out.push({ ws: "ws-audit", at: at(10), trigger: "cron" });
    if (rnd(`ship${key}`) < 0.4) out.push({ ws: "ws-ship-nimbus", at: at(14, Math.floor(rnd(`m${key}`) * 50)), trigger: "manual" });
    if (dow === 3 && rnd(`rel${key}`) < 0.6) out.push({ ws: "ws-release", at: at(11), trigger: "manual" });
    if (rnd(`co${key}`) < 0.07) out.push({ ws: "ws-checkout", at: at(16), trigger: "manual" });
  }
  return out;
}

export async function seedHistory(db: Db) {
  const existing = await db.select({ id: schema.runs.id }).from(schema.runs);
  if (existing.some((r) => r.id.startsWith("run_hist_"))) return; // seeded once
  const runs: (typeof schema.runs.$inferInsert)[] = [];
  const events: (typeof schema.runEvents.$inferInsert)[] = [];
  const approvals: (typeof schema.approvals.$inferInsert)[] = [];
  for (const p of plan()) {
    const w = WORKSTREAMS.find((x) => x.id === p.ws)!;
    const t = TPL[p.ws];
    const id = `run_hist_${p.ws.slice(3)}_${p.at.getFullYear()}${String(p.at.getMonth() + 1).padStart(2, "0")}${String(p.at.getDate()).padStart(2, "0")}`;
    const r = rnd(id);
    const status = r < 0.05 ? "failed" : "done";
    const waited = status === "done" && p.trigger === "cron" && p.ws !== "ws-audit" && rnd(`w${id}`) < 0.09; // a scheduled run that had to wait for a person
    const jitter = 0.78 + rnd(`j${id}`) * 0.5;
    const by = {} as UsageByTier;
    let cost = 0, base = 0, tin = 0, tout = 0;
    for (const tier of ["ultra", "super", "nano"] as const) {
      const [i, o] = [Math.round(t.tier[tier][0] * jitter), Math.round(t.tier[tier][1] * jitter)];
      const c = costUsd(tier, i, o);
      by[tier] = { in: i, out: o, costUsd: c };
      cost += c;
      tin += i;
      tout += o;
    }
    base = cost / (1 - t.saving * (0.9 + rnd(`s${id}`) * 0.2));
    const ms = Math.round(t.secs * jitter * 1000) + (waited ? (40 + Math.round(rnd(`wm${id}`) * 140)) * 60_000 : 0);
    const startedAt = p.at.getTime();
    runs.push({ id, workstreamId: p.ws, title: w.title, goal: w.goal, status, trigger: p.trigger, startedAt, endedAt: startedAt + ms, tokensIn: tin, tokensOut: tout, costUsd: cost, baselineUsd: base, model: "mock", usageByTier: by });
    let n = 0;
    const ev = (tMs: number, type: string, payload: unknown, agent = "orchestrator") => events.push({ id: `${id}-${n}`, runId: id, seq: n++, tMs, agent, agentInstance: agent, type, payload: payload as never });
    ev(0, "run.start", { title: w.title, workstreamId: p.ws, goal: w.goal, startedAt, trigger: p.trigger });
    if (status === "done") {
      for (let k = 0; k < t.docs; k++) ev(ms - 900, "artifact.version", { artifactId: "history-doc", kind: "doc", title: `${w.title}: result`, version: 1, content: `Result of an earlier run (seeded history). ${w.title}.` }, "writer");
      for (let k = 0; k < t.sends; k++) ev(ms - 700, "tool.result", { callId: `h${k}`, tool: "send_message", ok: true, output: { sent: false, logged: true } }, "writer");
      for (let k = 0; k < t.prs; k++) ev(ms - 600, "tool.result", { callId: `p${k}`, tool: "request_approval", ok: true, output: { decision: "approved", opened: false, logged: true, url: `https://github.com/harrymove-ctrl/nimbus/pull/${100 + (Math.floor(rnd(id) * 800) % 900)}` } });
      ev(ms - 300, "message", { id: "hist", role: "agent", text: `Done. (An earlier run, kept in the seeded history.)` });
    } else ev(ms - 300, "run.error", { message: "The model call timed out twice and no lower tier was left." });
    ev(ms, "run.end", { status });
    if (waited) approvals.push({ id: `${id}:ap-1`, runId: id, action: { kind: "send_message", summary: "Send the digest", risk: "medium", details: {} } as never, status: "approved", always: 0, decidedAt: startedAt + ms - 5000 });
  }
  const chunk = async <T,>(rows: T[], size: number, fn: (c: T[]) => Promise<unknown>) => {
    for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
  };
  await chunk(runs, 40, (c) => db.insert(schema.runs).values(c).onConflictDoNothing());
  await chunk(events, 100, (c) => db.insert(schema.runEvents).values(c).onConflictDoNothing());
  await chunk(approvals, 40, (c) => db.insert(schema.approvals).values(c).onConflictDoNothing());
}
