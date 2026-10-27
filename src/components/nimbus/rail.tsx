"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, Clock, LayoutDashboard, MoreHorizontal, Pencil, Play, RotateCcw } from "lucide-react";
import type { Workstream } from "@/lib/workstreams";
import { RailSkeleton } from "./loading";
import { cx } from "./ui";

export function Rail({
  workstreams,
  selectedId,
  pendingByWs,
  busyWs,
  onSelect,
  onOverview,
  onRun,
  onArchive,
  onSchedule,
  budget,
  loading,
  className,
}: {
  workstreams: Workstream[];
  selectedId: string | null;
  pendingByWs: Record<string, number>;
  busyWs: Record<string, boolean>;
  onSelect: (id: string) => void;
  /** the Overview item at the top of the rail; selected when no workstream is */
  onOverview?: () => void;
  onRun: (id: string) => void;
  /** rail menu: hide a workstream, or bring it back */
  onArchive?: (id: string, archived: boolean) => void;
  /** rail menu: set the schedule; resolves to an error message, or null when it was saved */
  onSchedule?: (id: string, schedule: { cron: string | null; label: string | null }) => Promise<string | null>;
  budget?: { todayUsd: number; dayCapUsd: number };
  /** GET /api/workstreams is still in flight: a sweep skeleton instead of an empty column */
  loading?: boolean;
  className?: string;
}) {
  const [menu, setMenu] = useState<{ id: string; x: number; y: number; editing: boolean } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const live = workstreams.filter((w) => !w.archived);
  const archived = workstreams.filter((w) => w.archived);
  return (
    <nav aria-label="Workstreams" className={cx("flex min-h-0 w-full flex-col border-r border-white/10 bg-neutral-950", className)}>
      {onOverview && (
        <div className="px-2 pt-3">
          <button type="button" onClick={onOverview} aria-current={selectedId === null ? "page" : undefined} className={cx("flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-[14px] font-semibold text-neutral-100 transition-colors", selectedId === null ? "bg-white/10" : "hover:bg-white/5")}>
            <LayoutDashboard className="size-4 text-neutral-400" aria-hidden="true" />
            Overview
          </button>
        </div>
      )}
      <p className="px-4 pb-2 pt-4 text-[11px] font-extrabold uppercase tracking-wider text-neutral-500">Workstreams</p>
      <RailSkeleton active={!!loading && workstreams.length === 0} />
      {menu && <RailMenu menu={menu} ws={workstreams.find((w) => w.id === menu.id)} close={() => setMenu(null)} edit={() => setMenu((m) => (m ? { ...m, editing: true } : m))} onRun={onRun} onArchive={onArchive} onSchedule={onSchedule} />}
      <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2">
        {live.map((w, idx) => {
          const sel = w.id === selectedId;
          const pending = pendingByWs[w.id] ?? 0;
          return (
            <li key={w.id} style={{ animationDelay: `${idx * 30}ms` }} className="nb-slide-in group relative" onContextMenu={(e) => (e.preventDefault(), setMenu({ id: w.id, x: e.clientX, y: e.clientY, editing: false }))}>
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
                aria-label={`More for ${w.title}`}
                aria-haspopup="menu"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setMenu({ id: w.id, x: r.left, y: r.bottom + 4, editing: false });
                }}
                className="absolute right-11 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-neutral-400 opacity-0 transition-opacity hover:bg-white/10 hover:text-neutral-100 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                style={{ display: pending > 0 ? "none" : undefined }}
              >
                <MoreHorizontal className="size-4" />
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
      {archived.length > 0 && (
        <div className="px-2 pt-1">
          <button type="button" onClick={() => setShowArchived((v) => !v)} aria-expanded={showArchived} className="flex h-8 w-full items-center gap-2 rounded-md px-3 text-[12px] font-bold text-neutral-500 hover:bg-white/5 hover:text-neutral-300">
            <Archive className="size-3.5" aria-hidden="true" /> Archived · {archived.length}
          </button>
          {showArchived &&
            archived.map((w) => (
              <div key={w.id} className="flex items-center gap-2 px-3 py-1 text-[13px] text-neutral-400">
                <span className="min-w-0 flex-1 truncate">{w.title}</span>
                <button type="button" onClick={() => onArchive?.(w.id, false)} className="flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-bold text-neutral-300 hover:bg-white/10">
                  <RotateCcw className="size-3" aria-hidden="true" /> Restore
                </button>
              </div>
            ))}
        </div>
      )}
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

const PRESETS: { label: string; cron: string | null }[] = [
  { label: "Every hour", cron: "0 * * * *" },
  { label: "Daily 09:00", cron: "0 9 * * *" },
  { label: "Weekdays 08:00", cron: "0 8 * * 1-5" },
  { label: "Mondays 10:00", cron: "0 10 * * 1" },
  { label: "On demand", cron: null },
];

/** The rail's right-click (or ⋯) menu: Run now · Edit schedule · Archive. Esc and a click elsewhere close it. */
function RailMenu({ menu, ws, close, edit, onRun, onArchive, onSchedule }: { menu: { id: string; x: number; y: number; editing: boolean }; ws?: Workstream; close: () => void; edit: () => void; onRun: (id: string) => void; onArchive?: (id: string, archived: boolean) => void; onSchedule?: (id: string, s: { cron: string | null; label: string | null }) => Promise<string | null> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [custom, setCustom] = useState(ws?.scheduleCron ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const away = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    ref.current?.querySelector<HTMLElement>("button, input")?.focus();
    return () => (document.removeEventListener("mousedown", away), document.removeEventListener("keydown", esc));
  }, [close]);
  if (!ws) return null;
  const save = async (cron: string | null, label: string | null) => {
    setBusy(true);
    const e = await onSchedule?.(ws.id, { cron, label });
    setBusy(false);
    if (e) setErr(e);
    else close();
  };
  const item = "flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] font-semibold text-neutral-100 hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none";
  return (
    <div ref={ref} role="menu" aria-label={`${ws.title} actions`} style={{ left: Math.min(menu.x, 200), top: menu.y }} className="nb-scale-in fixed z-50 w-[248px] rounded-xl border border-white/12 bg-neutral-950 p-1.5 shadow-[0_18px_48px_-12px_rgba(0,0,0,0.8)]">
      {!menu.editing ? (
        <>
          <button role="menuitem" type="button" className={item} onClick={() => (close(), onRun(ws.id))}>
            <Play className="size-3.5" aria-hidden="true" /> Run now
          </button>
          <button role="menuitem" type="button" className={item} onClick={edit}>
            <Pencil className="size-3.5" aria-hidden="true" /> Edit schedule…
          </button>
          <button role="menuitem" type="button" className={item} onClick={() => (close(), onArchive?.(ws.id, true))}>
            <Archive className="size-3.5" aria-hidden="true" /> Archive
          </button>
        </>
      ) : (
        <div className="flex flex-col gap-1 p-1">
          <p className="px-1 pb-1 text-[11px] font-extrabold uppercase tracking-wider text-neutral-400">Schedule · {ws.title}</p>
          {PRESETS.map((p) => (
            <button key={p.label} type="button" disabled={busy} className={item} onClick={() => void save(p.cron, p.cron ? p.label : null)}>
              <Clock className="size-3.5 text-neutral-400" aria-hidden="true" /> {p.label}
            </button>
          ))}
          <form
            className="mt-1 flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (custom.trim()) void save(custom.trim(), null);
            }}
          >
            <input value={custom} onChange={(e) => (setCustom(e.target.value), setErr(null))} aria-label="Cron expression" placeholder="*/30 * * * *" className="h-9 min-w-0 flex-1 rounded-md border border-white/12 bg-neutral-900 px-2 font-mono text-[12px] text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-white/30" />
            <button type="submit" disabled={busy || !custom.trim()} className="h-9 rounded-md bg-white/12 px-2.5 text-[12px] font-extrabold hover:bg-white/20 disabled:opacity-40">
              Set
            </button>
          </form>
          {err && <p className="px-1 text-[12px]/[16px] text-red-300">{err}</p>}
        </div>
      )}
    </div>
  );
}
