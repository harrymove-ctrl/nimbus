"use client";

// Agent status (docs/SPEC.md §17.3): a pill in the top bar for runs you are not looking at (a scheduled run, another
// workstream's run), and a 320 px panel to check on them without leaving the screen: what the crew is doing, which
// step, the last three steps, Pause · Stop · Open run, and a waiting approval answered inline with Approve · Deny.
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Pause, Play, Square, X } from "lucide-react";
import { ProgressBar } from "@/components/dithercn/progress-bar";
import type { ActiveRun } from "@/runtime/active";
import { cx } from "./ui";

const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

/** Polls the server's live runs: fast while something is going, slow when idle. */
export function useActiveRuns() {
  const [runs, setRuns] = useState<ActiveRun[]>([]);
  const [fetchedAt, setFetchedAt] = useState(0);
  const load = useCallback(async () => {
    try {
      const j = (await (await fetch("/api/runs/active", { cache: "no-store" })).json()) as { runs: ActiveRun[] };
      setRuns(j.runs);
      setFetchedAt(Date.now());
      return j.runs.length;
    } catch {
      return 0;
    }
  }, []);
  useEffect(() => {
    let alive = true;
    let t: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const n = document.hidden ? 0 : await load();
      if (alive) t = setTimeout(tick, n ? 1500 : 5000);
    };
    void tick();
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [load]);
  return { runs, fetchedAt, reload: load };
}

export function StatusPill({ runs, fetchedAt, reload, currentRunId, onOpenRun, className }: { runs: ActiveRun[]; fetchedAt: number; reload: () => Promise<number>; currentRunId: string | null; onOpenRun: (workstreamId: string, runId: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const box = useRef<HTMLDivElement>(null);
  const others = runs.filter((r) => r.id !== currentRunId);
  // Runs that finished while you were looking elsewhere stay in the pill for 25 s, with a way to open them (F14)
  const seen = useRef(new Map<string, ActiveRun>());
  const [done, setDone] = useState<{ r: ActiveRun; at: number }[]>([]);
  useEffect(() => {
    const ids = new Set(runs.map((r) => r.id));
    const gone = [...seen.current.values()].filter((r) => !ids.has(r.id) && r.id !== currentRunId);
    for (const g of [...seen.current.keys()]) if (!ids.has(g)) seen.current.delete(g);
    for (const r of runs) seen.current.set(r.id, r);
    if (gone.length) setDone((d) => [...d, ...gone.map((r) => ({ r, at: Date.now() }))]);
  }, [runs, currentRunId]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => (document.removeEventListener("mousedown", away), document.removeEventListener("keydown", esc));
  }, [open]);
  useEffect(() => {
    if (others.length === 0) setOpen(false);
  }, [others.length]);

  const finished = done.filter((d) => now - d.at < 25_000);
  if (others.length === 0 && finished.length === 0) return null;
  if (others.length === 0) {
    const last = finished[finished.length - 1].r;
    return (
      <div ref={box} className={cx("relative", className)}>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog" className="nb-pop-slow flex h-9 max-w-[min(420px,60vw)] items-center gap-2.5 rounded-full border border-white/12 bg-neutral-900 ps-2 pe-3.5 text-[13px] font-semibold text-neutral-100 transition-colors hover:bg-neutral-800">
          <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full" style={{ background: `${last.color}33`, color: last.color }}>
            <Check className="size-3.5" />
          </span>
          <span className="min-w-0 truncate">{finished.length > 1 ? `${finished.length} runs finished` : `${last.title} finished`}</span>
        </button>
        {open && (
          <div role="dialog" aria-label="Finished runs" className="nb-scale-in absolute right-0 top-11 z-50 flex w-[320px] max-w-[92vw] flex-col gap-2 rounded-xl border border-white/12 bg-neutral-950 p-3 shadow-[0_18px_48px_-12px_rgba(0,0,0,0.8)]">
            {finished.map(({ r }) => (
              <div key={r.id} className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/3 p-2.5">
                <span className="size-2 shrink-0 rounded-full" style={{ background: r.color }} />
                <p className="min-w-0 flex-1 truncate text-[14px] font-bold">{r.title}</p>
                <button type="button" onClick={() => (setOpen(false), setDone((d) => d.filter((x) => x.r.id !== r.id)), onOpenRun(r.workstreamId, r.id))} className="h-8 rounded-md bg-white/10 px-2.5 text-[12px] font-extrabold hover:bg-white/16">
                  Open run
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  const lead = others.find((r) => r.approval || r.planAwaiting || r.question) ?? others[0];
  const waiting = others.filter((r) => r.approval || r.planAwaiting || r.question).length;
  const elapsed = (r: ActiveRun) => r.elapsedMs + Math.max(0, now - fetchedAt);

  return (
    <div ref={box} className={cx("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex h-9 max-w-[min(420px,60vw)] items-center gap-2.5 rounded-full border border-white/12 bg-neutral-900 ps-2 pe-3.5 text-[13px] font-semibold text-neutral-100 transition-colors hover:bg-neutral-800"
      >
        <Ring color={lead.color} still={lead.paused || !!lead.approval || lead.planAwaiting} />
        <span className="min-w-0 truncate">{others.length > 1 ? `${others.length} runs${waiting ? ` · ${waiting} waiting` : ""}` : lead.activity}</span>
        <span className="shrink-0 tabular-nums text-neutral-400">{clock(elapsed(lead))}</span>
      </button>
      {open && (
        <div role="dialog" aria-label="Runs in the background" className="nb-scale-in absolute right-0 top-11 z-50 flex max-h-[70vh] w-[320px] max-w-[92vw] flex-col gap-3 overflow-y-auto rounded-xl border border-white/12 bg-neutral-950 p-3 shadow-[0_18px_48px_-12px_rgba(0,0,0,0.8)]">
          {others.map((r) => (
            <RunPanel key={r.id} r={r} elapsed={elapsed(r)} onOpenRun={onOpenRun} reload={reload} close={() => setOpen(false)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Ring({ color, still }: { color: string; still?: boolean }) {
  return (
    <span aria-hidden="true" className="relative grid size-6 shrink-0 place-items-center">
      <span className={cx("absolute inset-0 rounded-full border-2 border-transparent", !still && "animate-spin motion-reduce:animate-none")} style={{ borderTopColor: color, borderRightColor: `${color}66`, animationDuration: "1.1s" }} />
      <span className="size-2 rounded-full" style={{ background: color }} />
    </span>
  );
}

function RunPanel({ r, elapsed, onOpenRun, reload, close }: { r: ActiveRun; elapsed: number; onOpenRun: (workstreamId: string, runId: string) => void; reload: () => Promise<number>; close: () => void }) {
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await reload();
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="flex flex-col gap-2.5 rounded-lg border border-white/8 bg-white/3 p-2.5" aria-label={r.title}>
      <div className="flex items-center gap-2">
        <Ring color={r.color} still={r.paused || !!r.approval} />
        <p className="min-w-0 flex-1 truncate text-[14px] font-extrabold">{r.title}</p>
        <span className="text-[12px] tabular-nums text-neutral-400">{clock(elapsed)}</span>
      </div>
      <p className="text-[13px]/[18px] text-neutral-300">{r.activity}</p>
      <p className="text-[12px] text-neutral-400">{r.model}</p>
      {r.step && (
        <div>
          <p className="mb-1 text-[12px] font-bold tabular-nums text-neutral-300">
            Step {r.step.index} of {r.step.total}
          </p>
          <ProgressBar value={Math.max(0, r.step.index - 1)} max={r.step.total} label="Steps" hideLabel size="sm" color="green" segments={r.step.total > 1 ? r.step.total : undefined} />
        </div>
      )}
      {r.recent.length > 0 && (
        <ul className="flex flex-col gap-1" aria-label="Last steps">
          {r.recent.map((s, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[12px]/[17px] text-neutral-300">
              <span className="mt-0.5 shrink-0">{s.state === "done" ? <Check className="size-3.5 text-emerald-300" /> : s.state === "failed" ? <X className="size-3.5 text-red-300" /> : <span className="ms-1 mt-1 block size-2 animate-pulse rounded-full bg-neutral-300 motion-reduce:animate-none" />}</span>
              <span className="min-w-0 flex-1 truncate">{s.text}</span>
              <span className="shrink-0 tabular-nums text-neutral-500">{s.ms === null ? "" : `${(s.ms / 1000).toFixed(1)}s`}</span>
            </li>
          ))}
        </ul>
      )}
      {r.approval && (
        <div className="rounded-lg border border-orange-400/40 bg-orange-400/8 p-2">
          <p className="text-[13px]/[18px] font-bold text-neutral-100">{r.approval.summary}</p>
          <p className="mb-2 text-[12px] text-neutral-400">{r.approval.risk} risk · waiting for you</p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => void act(() => post(`/api/runs/${r.id}/approvals/${r.approval!.approvalId}`, { decision: "approve" }))} className="h-8 flex-1 rounded-md bg-emerald-400 text-[13px] font-extrabold text-neutral-950 hover:bg-emerald-300 disabled:opacity-50">
              Approve
            </button>
            <button type="button" disabled={busy} onClick={() => void act(() => post(`/api/runs/${r.id}/approvals/${r.approval!.approvalId}`, { decision: "reject" }))} className="h-8 flex-1 rounded-md border border-white/15 text-[13px] font-extrabold text-neutral-100 hover:bg-white/8 disabled:opacity-50">
              Deny
            </button>
          </div>
        </div>
      )}
      {r.question && <p className="rounded-lg border border-orange-400/40 bg-orange-400/8 p-2 text-[13px]/[18px] text-neutral-100">{r.question}</p>}
      {r.planAwaiting && <p className="rounded-lg border border-orange-400/40 bg-orange-400/8 p-2 text-[13px]/[18px] text-neutral-100">The plan is waiting for your approval. Open the run to edit it.</p>}
      <div className="flex gap-1.5">
        <button type="button" disabled={busy} onClick={() => void act(() => post(`/api/runs/${r.id}/pause`, { paused: !r.paused }))} className="flex h-8 items-center gap-1.5 rounded-md border border-white/12 px-2.5 text-[12px] font-extrabold text-neutral-100 hover:bg-white/8 disabled:opacity-50">
          {r.paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
          {r.paused ? "Resume" : "Pause"}
        </button>
        <button type="button" disabled={busy} onClick={() => void act(() => post(`/api/runs/${r.id}/stop`, { reason: "stop" }))} className="flex h-8 items-center gap-1.5 rounded-md border border-white/12 px-2.5 text-[12px] font-extrabold text-neutral-100 hover:bg-red-500/15 disabled:opacity-50">
          <Square className="size-3.5" />
          Stop
        </button>
        <button type="button" onClick={() => (close(), onOpenRun(r.workstreamId, r.id))} className="ms-auto h-8 rounded-md bg-white/10 px-2.5 text-[12px] font-extrabold text-neutral-100 hover:bg-white/16">
          Open run
        </button>
      </div>
    </section>
  );
}
