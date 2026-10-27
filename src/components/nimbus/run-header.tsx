"use client";

import { fmtCost, fmtSecs, fmtTokens, type RunView, type ViewStatus } from "@/lib/run-view";
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

export function RunHeader({ view, now, fallbackTitle }: { view: RunView; now: number; fallbackTitle: string }) {
  const pill = PILL[view.status];
  const elapsed = view.endedMs ?? (view.active ? now - view.startedAt : view.lastTMs);
  const hasRun = view.status !== "idle";
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 px-4">
      <h1 className="min-w-0 truncate text-[16px] font-extrabold text-neutral-100">{view.title || fallbackTitle}</h1>
      <span className={cx("inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-bold", pill.cls)} role="status">
        {(view.status === "running" || view.status === "planning") && <span className="size-1.5 animate-pulse rounded-full bg-emerald-400 motion-reduce:animate-none" />}
        {pill.label}
      </span>
      {hasRun && (
        <p className="ms-auto flex min-w-0 items-center gap-x-3 truncate text-[13px] font-semibold tabular-nums text-neutral-300">
          <span>{fmtSecs(elapsed)}</span>
          <span className="hidden sm:inline">{fmtTokens(view.tokens)} tokens</span>
          <span>{fmtCost(view.costUsd)}</span>
          {view.savings !== null && view.savings > 0.005 && (
            <span className="rounded-full bg-[color-mix(in_oklab,var(--rb-accent)_22%,transparent)] px-2 py-0.5 text-[12px] font-bold text-[var(--rb-accent)]" title="Spend vs pricing every hop at its role's ceiling tier">
              −{Math.round(view.savings * 100)}% vs baseline
            </span>
          )}
        </p>
      )}
    </header>
  );
}
