"use client";

// The run picker in the run header: the workstream's runs, newest first, so history is one click from any run
// (before this, a past run opened only from the Overview's "Open latest run"). A listbox popover: Enter or a click
// opens it, ↑ ↓ move, Enter picks, Esc closes. The list is fetched on open and kept for 30 s per workstream.
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { fmtCost } from "@/lib/run-view";
import { fmtDur } from "@/lib/trace";
import { cx } from "./ui";

type RunRow = { id: string; title: string; status: string; trigger: string; startedAt: number; endedAt: number | null; costUsd: number };

const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; runs: RunRow[] }>();

/** "Oct 29, 22:10" */
const when = (ms: number) => new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

const DOT: Record<string, string> = { done: "bg-emerald-400", running: "animate-pulse bg-emerald-400 motion-reduce:animate-none", failed: "bg-red-400", cancelled: "bg-neutral-500", stopped: "bg-neutral-500" };

export function RunPicker({ workstreamId, runId, startedAt, onPick }: { workstreamId: string; runId: string | null; /** when the open run started (epoch ms), 0 while unknown */ startedAt: number; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<RunRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [at, setAt] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();

  const load = useCallback(() => {
    const hit = cache.get(workstreamId);
    if (hit && Date.now() - hit.at < CACHE_MS) {
      setRuns(hit.runs);
      return;
    }
    setFailed(false);
    void fetch(`/api/runs?workstreamId=${encodeURIComponent(workstreamId)}&limit=20`)
      .then((r) => (r.ok ? (r.json() as Promise<{ runs: RunRow[] }>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        cache.set(workstreamId, { at: Date.now(), runs: d.runs });
        setRuns(d.runs);
      })
      .catch(() => setFailed(true));
  }, [workstreamId]);

  useEffect(() => {
    if (!open) return;
    setRuns(null);
    load();
  }, [open, load]);
  // the first row to land on: the open run, else the newest
  useEffect(() => {
    if (!runs) return;
    const i = runs.findIndex((r) => r.id === runId);
    setAt(i >= 0 ? i : 0);
  }, [runs, runId]);
  useEffect(() => {
    if (open && runs) list.current?.focus();
  }, [open, runs]);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  const pick = (r: RunRow) => {
    setOpen(false);
    button.current?.focus();
    if (r.id !== runId) onPick(r.id);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (!runs?.length) return;
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(runs.length - 1, Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)));
      setAt(next);
      list.current?.querySelectorAll("li")[next]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(runs[at]);
    }
  };

  return (
    <div ref={root} className="relative shrink-0">
      <button ref={button} type="button" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} data-cuelume-open="" data-cuelume-emphasis="subtle" onClick={() => setOpen((v) => !v)} className="flex h-7 max-w-[15rem] items-center gap-1.5 rounded-full bg-white/8 px-2.5 text-[12px] font-bold text-neutral-200 hover:bg-white/14 aria-expanded:bg-white/14 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rb-accent)]" title="Open an earlier run of this workstream">
        <span className="truncate tabular-nums">
          {runId ?? "Pick a run"}
          {/* the start time only when the header has room (it is a container query on the run header) */}
          {runId && startedAt ? <span className="hidden @[900px]:inline"> · {when(startedAt)}</span> : null}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
      </button>
      {open && (
        <div className="nb-scale-in absolute left-0 top-full z-40 mt-1.5 w-[min(92vw,26rem)] overflow-hidden rounded-xl border border-white/10 bg-neutral-900 shadow-2xl max-sm:fixed max-sm:inset-x-3 max-sm:top-auto max-sm:w-auto">
          {runs === null ? (
            <p className="px-3 py-3 text-[13px] font-semibold text-neutral-400" role="status">
              {failed ? "Could not load the runs." : "Loading the runs…"}
            </p>
          ) : runs.length === 0 ? (
            <p className="px-3 py-3 text-[13px] font-semibold text-neutral-400">No runs yet. Press RUN to start the first one.</p>
          ) : (
            <ul ref={list} id={listId} role="listbox" aria-label="Runs of this workstream, newest first" aria-activedescendant={`${listId}-${at}`} tabIndex={0} onKeyDown={onKeyDown} className="max-h-[22rem] overflow-y-auto p-1 outline-none">
              {runs.map((r, i) => {
                const dur = r.endedAt ? fmtDur(r.endedAt - r.startedAt) : r.status === "running" ? "running" : "";
                return (
                  <li key={r.id} id={`${listId}-${i}`} role="option" aria-selected={r.id === runId} onClick={() => pick(r)} onPointerEnter={() => setAt(i)} className={cx("flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2", i === at && "bg-white/10", r.id === runId && "shadow-[inset_2px_0_0_var(--rb-accent)]")}>
                    <span className={cx("size-2 shrink-0 rounded-full", DOT[r.status] ?? "bg-neutral-500")} title={r.status} aria-label={r.status} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold text-neutral-100">
                        {when(r.startedAt)}
                        {r.id === runId && <span className="ms-2 text-[11px] font-extrabold text-[var(--rb-accent)]">open</span>}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-neutral-500" title={r.title}>
                        {r.id}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-[12px] font-semibold tabular-nums text-neutral-300">
                      <span className="block">{dur || " "}</span>
                      <span className="block text-neutral-500">{fmtCost(r.costUsd)}</span>
                    </span>
                    <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-bold text-neutral-300">{r.trigger}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
