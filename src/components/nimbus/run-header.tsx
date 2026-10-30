"use client";

import { DitherNumber } from "@/components/dithercn/dither-number";
import { fmtCost, fmtSecs, fmtTokens, type RunView, type ViewStatus } from "@/lib/run-view";
import { RunPicker } from "./run-picker";
import { cx } from "./ui";

const PILL: Record<ViewStatus, { label: string; cls: string }> = {
  idle: { label: "Idle", cls: "bg-white/10 text-neutral-300" },
  planning: { label: "Planning", cls: "bg-white/10 text-neutral-100" },
  running: { label: "Running", cls: "bg-white/10 text-neutral-100" },
  asked: { label: "Needs you", cls: "bg-orange-500/15 text-orange-300" },
  waiting: { label: "Needs you", cls: "bg-orange-500/15 text-orange-300" },
  done: { label: "Done", cls: "bg-white/10 text-neutral-100" },
  failed: { label: "Failed", cls: "bg-red-500/15 text-red-300" },
  cancelled: { label: "Cancelled", cls: "bg-white/10 text-neutral-300" },
  stopped: { label: "Stopped", cls: "bg-white/10 text-neutral-300" },
};

export type RunMode = "lanes" | "trace";

export function RunHeader({ view, now, fallbackTitle, runCapUsd, mode, onMode, picker }: { view: RunView; now: number; fallbackTitle: string; runCapUsd?: number; mode?: RunMode; onMode?: (m: RunMode) => void; /** the run picker: this workstream's runs, and what to do when one is picked */ picker?: { workstreamId: string; runId: string | null; onPick: (id: string) => void } }) {
  const pill = view.capHit ? { label: "Cap hit", cls: "bg-red-500/15 text-red-300" } : PILL[view.status];
  const frac = runCapUsd ? Math.min(1, view.costUsd / runCapUsd) : 0;
  const elapsed = view.endedMs ?? (view.active ? now - view.startedAt : view.lastTMs);
  const hasRun = view.status !== "idle";
  return (
    // Container queries: under 900 px of header width drop tokens, under 640 px elapsed too; the status and baseline pills never go.
    <header className="@container flex h-14 shrink-0 items-center gap-3 border-b border-white/10 px-4 max-sm:h-auto max-sm:flex-wrap max-sm:gap-y-1.5 max-sm:py-2">
      <h1 className="min-w-0 flex-1 truncate text-[16px] font-extrabold text-neutral-100 max-sm:basis-full">{view.title || fallbackTitle}</h1>
      <span className={cx("inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-bold", pill.cls)} role="status">
        {(view.status === "running" || view.status === "planning") && <span className="size-1.5 animate-pulse rounded-full bg-emerald-400 motion-reduce:animate-none" />}
        {pill.label}
      </span>
      {picker && <RunPicker workstreamId={picker.workstreamId} runId={picker.runId} startedAt={hasRun ? view.startedAt : 0} onPick={picker.onPick} />}
      {hasRun && mode && onMode && (
        <div role="group" aria-label="Run view" className="flex h-7 shrink-0 items-center rounded-full bg-white/8 p-0.5 text-[12px] font-bold">
          {(["lanes", "trace"] as const).map((m) => (
            <button key={m} type="button" data-cuelume-select="" aria-pressed={mode === m} onClick={() => mode !== m && onMode(m)} className={cx("h-6 rounded-full px-2.5 capitalize transition-colors", mode === m ? "bg-white text-neutral-950" : "text-neutral-300 hover:text-neutral-50")}>
              {m}
            </button>
          ))}
        </div>
      )}
      {hasRun && (
        <p className="flex shrink-0 items-center gap-x-3 whitespace-nowrap text-[13px] font-semibold tabular-nums text-neutral-300">
          <span className="hidden @[640px]:inline">{fmtSecs(elapsed)}</span>
          <span className="hidden @[900px]:inline">{fmtTokens(view.tokens)} tokens</span>
          <span data-demo="run-cost" className="inline-flex items-center gap-1.5" title={runCapUsd ? `Spent ${fmtCost(view.costUsd)} of this run's $${runCapUsd.toFixed(2)} cap (NIMBUS_RUN_CAP_USD)` : undefined}>
            <DitherNumber value={view.costUsd} locales="en-US" format={{ style: "currency", currency: "USD", minimumFractionDigits: 3, maximumFractionDigits: 3 }} effect="resolve" trigger="mount" duration={380} stagger={20} aria-label={fmtCost(view.costUsd)} />
            {runCapUsd ? (
              <span className="relative hidden h-1 w-9 overflow-hidden rounded-full bg-white/12 sm:inline-block" aria-hidden="true">
                <span className={cx("absolute inset-y-0 left-0 rounded-full", frac > 0.9 ? "bg-red-400" : frac > 0.6 ? "bg-orange-400" : "bg-[var(--rb-accent)]")} style={{ width: `${Math.max(frac * 100, view.costUsd > 0 ? 6 : 0)}%` }} />
              </span>
            ) : null}
          </span>
          {view.savings !== null && view.savings > 0.005 && (
            <span className="shrink-0 rounded-full bg-[color-mix(in_oklab,var(--rb-accent)_22%,transparent)] px-2 py-0.5 text-[12px] font-bold text-[var(--rb-accent)]" title="Spend vs pricing every hop at its role's ceiling tier">
              −{Math.round(view.savings * 100)}% vs baseline
            </span>
          )}
        </p>
      )}
    </header>
  );
}
