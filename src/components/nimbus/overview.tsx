"use client";

// Overview (docs/SPEC.md §17.1): what the crew did this week, what it cost, what needs you. Every number is from
// GET /api/overview (SQLite). The dithercn charts keep their own hover and lock; the clicks that open things live in the
// companion controls under each chart (the charts expose no click callbacks), so every region lands somewhere.
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AreaChart } from "@/components/dithercn/area-chart";
import { Contours } from "@/components/dithercn/contours";
import { DonutChart } from "@/components/dithercn/donut-chart";
import { Gauge } from "@/components/dithercn/gauge";
import { Heatmap } from "@/components/dithercn/heatmap";
import { StatCard } from "@/components/dithercn/stat-card";
import { UptimeBar } from "@/components/dithercn/uptime-bar";
import type { Overview as Data, RunRef } from "@/runtime/overview";
import { Why } from "./why";
import { cx } from "./ui";

type Drill = { title: string; runs: RunRef[]; note?: string } | null;

const usd = (n: number, d = 3) => `$${n.toFixed(d)}`;
const TIER_COLOR = { ultra: "blue", super: "purple", nano: "green" } as const;
const TIER_LABEL = { ultra: "Ultra", super: "Super", nano: "Nano" } as const;
/** The day buttons under a chart read as part of its legend: small, muted, the open day highlighted. */
const legendBtn = (active: boolean) => cx("rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums transition-colors hover:bg-white/8 hover:text-neutral-100 disabled:pointer-events-none disabled:opacity-35", active ? "bg-white/12 text-neutral-100" : "text-neutral-400");
const card = "rounded-[10px] border border-white/10 bg-neutral-950/75 p-4 backdrop-blur-[2px]";
const eyebrow = "mb-2 text-[11px] font-extrabold uppercase tracking-wider text-neutral-400";

function clickable(onClick: () => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick,
    onKeyDown: (e: KeyboardEvent) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onClick()),
    className: "cursor-pointer rounded-[10px] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-[var(--rb-accent)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.18)]",
  };
}

export function Overview({
  titles,
  onOpenRun,
  refreshKey,
  empty,
}: {
  /** workstream id → title, for the run lists */
  titles: Record<string, string>;
  /** open a run in its workstream, optionally on an Inspector tab */
  onOpenRun: (workstreamId: string, runId: string, tab?: "artifact" | "agent" | "memory") => void;
  refreshKey?: number;
  empty?: ReactNode;
}) {
  const [d, setD] = useState<Data | null>(null);
  const [drill, setDrill] = useState<Drill>(null);
  const [pulse, setPulse] = useState(false);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const spendRef = useRef<HTMLDivElement>(null);
  const drillRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setD((await (await fetch("/api/overview", { cache: "no-store" })).json()) as Data);
    } catch {
      /* keep what we have */
    }
  }, []);
  useEffect(() => {
    void load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load, refreshKey]);

  const open = useCallback(
    (title: string, runs: RunRef[], note?: string, day?: string) => {
      setActiveDay(day ?? null);
      setDrill({ title, runs, note });
      requestAnimationFrame(() => drillRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    },
    [],
  );

  const areaData = useMemo(() => d?.spendByDay ?? [], [d]);
  if (!d) return <div className="grid flex-1 place-items-center text-[14px] text-neutral-500">Loading the overview…</div>;
  if (d.empty && empty) return <>{empty}</>;

  const dayRuns = (iso: string) => d.runsByDay[iso] ?? [];
  const todayRuns = dayRuns(d.today);
  const totalTokens = d.tokensByTier.reduce((n, t) => n + t.tokens, 0);
  const hours = Math.floor(d.impact.manualMinutes / 60);
  const mins = d.impact.manualMinutes % 60;
  const saved = Math.round(d.router.savedFraction * 100);

  return (
    <div className="relative isolate min-h-0 flex-1 overflow-y-auto">
      {/* a map of your work: contours, ≤ 6 % ink, still under reduced motion (the library handles that) */}
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06]" aria-hidden="true">
        <Contours cell={3} className="absolute inset-0" />
      </div>
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-5 py-5">
        <header className="flex flex-wrap items-baseline gap-x-3">
          <h1 className="text-[22px] font-extrabold">Overview</h1>
          <p className="text-[13px] text-neutral-400">
            The last 7 days{d.mock ? " · scripted mock model, so the numbers are mock numbers" : ""}
          </p>
        </header>

        {/* 1 · stat row */}
        <section aria-label="Today" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div
            {...clickable(() => {
              setPulse(true);
              setTimeout(() => setPulse(false), 1400);
              spendRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            })}
            aria-label={`Spend today ${usd(d.stats.spendTodayUsd)} of ${usd(d.stats.dayCapUsd, 2)} cap. Open the spend chart`}
          >
            <StatCard label="Spend today" value={usd(d.stats.spendTodayUsd)} trend={d.stats.spark.spend} color="blue" className="pointer-events-none" />
            <p className="px-1 pt-1 text-[12px] text-neutral-400">of {usd(d.stats.dayCapUsd, 2)} day cap</p>
          </div>
          <div {...clickable(() => open("Runs today", todayRuns, todayRuns.length ? undefined : "No runs yet today."))} aria-label={`${d.stats.runsToday} runs today. List them`}>
            <StatCard label="Runs today" value={d.stats.runsToday} trend={d.stats.spark.runs} color="green" className="pointer-events-none" />
            <p className="px-1 pt-1 text-[12px] text-neutral-400">click to list</p>
          </div>
          <div
            {...clickable(() => open("Waiting for you", todayRuns.filter((r) => r.status === "running"), d.stats.approvalsWaiting ? "These runs are waiting on you. Open one to approve." : "Nothing is waiting for you."))}
            aria-label={`${d.stats.approvalsWaiting} approvals waiting. List the runs`}
          >
            <StatCard label="Approvals waiting" value={d.stats.approvalsWaiting} trend={d.stats.spark.approvals} color={d.stats.approvalsWaiting ? "orange" : "ink"} className="pointer-events-none" />
            <p className="px-1 pt-1 text-[12px] text-neutral-400">{d.stats.approvalsWaiting ? "needs a decision" : "nothing waits on you"}</p>
          </div>
          <div
            {...clickable(() => d.lastRun && onOpenRun(d.lastRun.workstreamId, d.lastRun.id, "memory"))}
            aria-label={`${d.stats.memoriesWeek} memories learned this week. Open the Memory and skill tab of the last run`}
          >
            <StatCard label="Memories this week" value={d.stats.memoriesWeek} trend={d.stats.spark.memories} color="purple" className="pointer-events-none" />
            <p className="px-1 pt-1 text-[12px] text-neutral-400">opens Memory &amp; skill</p>
          </div>
        </section>

        {/* 2 · spend by tier + tokens by tier */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section ref={spendRef} data-demo="spend-chart" className={cx(card, "transition-shadow", pulse && "shadow-[0_0_0_2px_var(--rb-accent)]")} aria-label="Spend by tier, 7 days">
            <h2 className={eyebrow}>Spend by tier · 7 days</h2>
            <AreaChart
              data={areaData}
              x="label"
              series={[
                { label: "Ultra", value: "ultra", color: TIER_COLOR.ultra },
                { label: "Super", value: "super", color: TIER_COLOR.super },
                { label: "Nano", value: "nano", color: TIER_COLOR.nano },
              ]}
              stack="stacked"
              height={210}
              format={{ style: "currency", currency: "USD", minimumFractionDigits: 3, maximumFractionDigits: 3 }}
            />
            <div className="mt-1.5 flex flex-wrap items-center gap-x-0.5 gap-y-1" role="group" aria-label="Open the runs of a day">
              <span className="me-1 text-[11px] text-neutral-500">Open a day</span>
              {d.spendByDay.map((s) => {
                const n = dayRuns(s.date).length;
                return (
                  <button key={s.date} type="button" disabled={!n} aria-pressed={activeDay === s.date} title={`${n} ${n === 1 ? "run" : "runs"}`} onClick={() => (activeDay === s.date ? (setDrill(null), setActiveDay(null)) : open(`Runs on ${s.label}`, dayRuns(s.date), undefined, s.date))} className={legendBtn(activeDay === s.date)}>
                    {s.label} · {usd(s.ultra + s.super + s.nano, 2)}
                  </button>
                );
              })}
            </div>
          </section>

          <section className={card} aria-label="Tokens by tier">
            <h2 className={eyebrow}>Tokens by tier · this week</h2>
            <div className="grid place-items-center">
              <DonutChart
                data={d.tokensByTier.map((t) => ({ label: TIER_LABEL[t.tier], value: t.tokens, color: TIER_COLOR[t.tier] }))}
                label="Tokens"
                size={190}
                format={{ notation: "compact", maximumFractionDigits: 1 }}
              />
            </div>
            <button type="button" disabled={!d.lastRun} onClick={() => d.lastRun && onOpenRun(d.lastRun.workstreamId, d.lastRun.id, "agent")} className="mt-2 w-full rounded-md border border-white/10 px-2 py-1.5 text-[12px] text-neutral-300 hover:bg-white/8 disabled:opacity-40">
              {totalTokens ? "Open the last run's agents" : "No tokens yet"} ›
            </button>
          </section>
        </div>

        {/* 3 · runs calendar + router saving */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section className={card} aria-label="Runs calendar">
            <h2 className={eyebrow}>Runs · 8 weeks</h2>
            <Heatmap data={d.calendar.map((c) => ({ date: c.date, value: c.value }))} weeks={8} weekStart={1} unit={{ one: "run", other: "runs" }} color="green" />
            <div className="mt-1.5 flex flex-wrap items-center gap-x-0.5 gap-y-1" role="group" aria-label="Open the runs of a recent day">
              <span className="me-1 text-[11px] text-neutral-500">Open a day</span>
              {d.calendar.slice(-7).map((c) => (
                <button key={c.date} type="button" disabled={!c.value} aria-pressed={activeDay === c.date} title={`${c.value} ${c.value === 1 ? "run" : "runs"}`} onClick={() => (activeDay === c.date ? (setDrill(null), setActiveDay(null)) : open(`Runs on ${c.date}`, dayRuns(c.date), undefined, c.date))} className={legendBtn(activeDay === c.date)}>
                  {c.date.slice(5)} · {c.value}
                </button>
              ))}
            </div>
          </section>

          <section className={card} aria-label="Router saving" data-demo="router-gauge">
            <Why what="Cost router" why="The cheapest Nemotron that can do each step">
              <h2 className={eyebrow}>Router saving · this week</h2>
            </Why>
            <div className="grid place-items-center">
              <Gauge value={saved} label="saved vs every hop at its ceiling" unit="%" size={210} color="green" />
            </div>
            <p className="mt-1 text-center text-[12px]/[18px] text-neutral-400" title="1 − spend with the router ÷ what the same hops cost at their ceiling tier">
              {usd(d.router.costUsd, 2)} spent · {usd(d.router.atCeilingsUsd, 2)} at the ceilings · {d.router.runs} runs
            </p>
            {d.rules && (
              <button type="button" onClick={() => onOpenRun(d.rules!.workstreamId, d.rules!.runId)} className="mt-2 w-full rounded-md border border-white/10 px-2 py-1.5 text-left text-[12px]/[17px] text-neutral-200 hover:bg-white/8">
                {d.rules.applied ? <>Router rule recorded · expected <b>−{d.rules.expectedSavingPct} %</b> more</> : <>Proposed rule · if applied <b>−{d.rules.expectedSavingPct} %</b></>}
                <span className="text-neutral-400"> · Token Factory watch ›</span>
              </button>
            )}
          </section>
        </div>

        {/* 4 · scheduled health */}
        <section className={card} aria-label="Scheduled health">
          <h2 className={eyebrow}>Scheduled workstreams · 30 days</h2>
          <div className="flex flex-col gap-3">
            {d.health.map((h) => {
              const last = [...h.days].reverse().find((x) => x.runId);
              return (
                <div key={h.workstreamId} className="flex flex-col gap-1">
                  <UptimeBar
                    label={`${h.title} · ${h.schedule}`}
                    days={h.days.map((x) => ({ date: x.date, uptime: x.status === "none" ? null : x.status === "failed" ? 0 : x.status === "waited" ? 0.6 : 1, note: x.note }))}
                  />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-neutral-400">
                    <span>
                      {h.days.filter((x) => x.status === "ok").length} ok · {h.days.filter((x) => x.status === "waited").length} waited for approval · {h.days.filter((x) => x.status === "failed").length} failed
                    </span>
                    <button type="button" disabled={!last} onClick={() => last?.runId && onOpenRun(h.workstreamId, last.runId)} className="rounded-md border border-white/10 px-2 py-0.5 text-neutral-300 hover:bg-white/8 disabled:opacity-40">
                      Open latest run ›
                    </button>
                    {h.days.filter((x) => x.status === "failed" && x.runId).slice(-1).map((x) => (
                      <button key={x.runId} type="button" onClick={() => x.runId && onOpenRun(h.workstreamId, x.runId)} className="rounded-md border border-red-400/30 px-2 py-0.5 text-red-200 hover:bg-red-500/10">
                        Last failure · {x.date.slice(5)} ›
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 5 · impact */}
        <section className={card} aria-label="Impact">
          <h2 className={eyebrow}>Impact · this week</h2>
          <p className="text-[15px]/[24px] text-neutral-100">
            <b>{d.impact.prs}</b> pull requests opened · <b>{d.impact.messages}</b> messages sent · <b>{d.impact.docs}</b> documents produced · <b>{usd(d.impact.savedUsd, 2)}</b> saved by the router · about <b>{hours ? `${hours} h ` : ""}{mins} min</b> of your time
          </p>
          <p className="mt-1 text-[12px]/[18px] text-neutral-400">
            The time is an estimate: a per-workstream figure for doing that work by hand, counted once per finished run ({d.impact.runs} runs). Everything else is counted from the run logs.
          </p>
        </section>

        {/* drill-down from the clicks above */}
        {drill && (
          <section ref={drillRef} className={cx(card, "nb-rise-fast")} aria-label={drill.title} aria-live="polite">
            <div className="mb-2 flex items-center">
              <h2 className="text-[13px] font-extrabold text-neutral-100">{drill.title}</h2>
              <button type="button" onClick={() => (setDrill(null), setActiveDay(null))} className="ms-auto rounded-md px-2 py-1 text-[12px] font-bold text-neutral-400 hover:bg-white/10">
                Close
              </button>
            </div>
            {drill.runs.length === 0 ? (
              <p className="text-[14px] text-neutral-400">{drill.note ?? "No runs."}</p>
            ) : (
              <>
                {drill.note && <p className="mb-2 text-[13px] text-neutral-400">{drill.note}</p>}
                <ul className="flex flex-col divide-y divide-white/8">
                  {drill.runs.slice(0, 12).map((r) => (
                    <li key={r.id}>
                      <button type="button" onClick={() => onOpenRun(r.workstreamId, r.id)} className="flex w-full items-center gap-3 px-1 py-2 text-left hover:bg-white/5">
                        <span className={cx("size-2 shrink-0 rounded-full", r.status === "done" ? "bg-emerald-400" : r.status === "running" ? "bg-orange-400" : "bg-red-400")} aria-label={r.status} />
                        <span className="min-w-0 flex-1 truncate text-[14px] text-neutral-100">{titles[r.workstreamId] ?? r.title}</span>
                        <span className="shrink-0 text-[12px] tabular-nums text-neutral-400">
                          {new Date(r.startedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })} · {r.trigger} · {usd(r.costUsd)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {drill.runs.length > 12 && <p className="pt-2 text-[12px] text-neutral-500">and {drill.runs.length - 12} more</p>}
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
