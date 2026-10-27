"use client";

import { Clock, Play } from "lucide-react";
import type { Workstream } from "@/lib/workstreams";
import { cx } from "./ui";

export function Rail({
  workstreams,
  selectedId,
  pendingByWs,
  busyWs,
  onSelect,
  onRun,
  budget,
  className,
}: {
  workstreams: Workstream[];
  selectedId: string | null;
  pendingByWs: Record<string, number>;
  busyWs: Record<string, boolean>;
  onSelect: (id: string) => void;
  onRun: (id: string) => void;
  budget?: { todayUsd: number; dayCapUsd: number };
  className?: string;
}) {
  return (
    <nav aria-label="Workstreams" className={cx("flex min-h-0 w-full flex-col border-r border-white/10 bg-neutral-950", className)}>
      <p className="px-4 pb-2 pt-4 text-[11px] font-extrabold uppercase tracking-wider text-neutral-500">Workstreams</p>
      <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2">
        {workstreams.map((w, idx) => {
          const sel = w.id === selectedId;
          const pending = pendingByWs[w.id] ?? 0;
          return (
            <li key={w.id} style={{ animationDelay: `${idx * 30}ms` }} className="nb-slide-in group relative">
              <button type="button" onClick={() => onSelect(w.id)} aria-current={sel ? "true" : undefined} className={cx("flex h-[52px] w-full items-center gap-2.5 rounded-lg px-3 text-left transition-colors", sel ? "bg-white/10" : "hover:bg-white/5")}>
                <span className={cx("size-1.5 shrink-0 rounded-full", w.unread && !sel ? "bg-[var(--rb-accent)]" : "bg-transparent")} aria-label={w.unread && !sel ? "Unread result" : undefined} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-neutral-100">{w.title}</span>
                  <span className="flex items-center gap-1 truncate text-[12px] text-neutral-500">
                    {w.scheduleLabel ? (
                      <>
                        <Clock className="size-3" aria-hidden="true" /> {w.scheduleLabel}
                      </>
                    ) : (
                      "On demand"
                    )}
                  </span>
                </span>
                {pending > 0 && <span key={pending} className="nb-pop-slow grid h-5 min-w-5 place-items-center rounded-full bg-orange-400 px-1.5 text-[11px] font-extrabold text-neutral-950">{pending}</span>}
              </button>
              <button
                type="button"
                aria-label={`Run ${w.title}`}
                disabled={busyWs[w.id]}
                onClick={() => onRun(w.id)}
                className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md bg-neutral-800 text-neutral-100 opacity-0 transition-opacity hover:bg-neutral-700 focus-visible:opacity-100 disabled:hidden group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                style={{ display: pending > 0 ? "none" : undefined }}
              >
                <Play className="size-3.5 fill-current" />
              </button>
            </li>
          );
        })}
      </ul>
      {budget && (
        <p className="border-t border-white/10 px-4 pt-3 text-[12px] font-bold tabular-nums text-neutral-300" title="Daily spend across all runs (NIMBUS_DAY_CAP_USD)">
          Today ${budget.todayUsd.toFixed(2)} of ${budget.dayCapUsd.toFixed(2)}
        </p>
      )}
      <p className="p-4 pt-1.5 text-[12px]/[18px] text-neutral-500">
        Runs use the scripted mock model (no keys, $0) until NEBIUS_API_KEY is set.
      </p>
    </nav>
  );
}
