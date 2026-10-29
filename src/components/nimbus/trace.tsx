"use client";

// The Trace view (docs/TRACE.md): every call of a run on one time axis. Flat and chronological, one row per model call,
// tool call and wait, with first-token time, speed and where the code ran. The data is src/lib/trace.ts; this file is
// the panel: headline, filter chips, rows with bars on a shared axis, hover cursor, drag zoom, keyboard, live growth,
// the comparison with the workstream's last run, the export and the detail card.
import { memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { ArrowUpRight, Box, Copy, Download, Ellipsis, FileText, FolderGit2, Globe, GitPullRequest, Hand, Link2, MessageSquare, Send, Sparkles, Terminal, Wrench, X, ZoomOut, CircleQuestionMark, type LucideIcon } from "lucide-react";
import { useTween } from "@/hooks/use-tween";
import type { AnyRunEvent } from "@/lib/events";
import { ROLE_COLOR, TIER_LABEL, TIER_SHORT } from "@/lib/run-view";
import {
  FILTERS,
  buildTrace,
  compareTraces,
  filterCounts,
  filterIds,
  fmtAxis,
  fmtDelta,
  fmtDur,
  fmtPct,
  fmtTok,
  headline,
  ioBytes,
  spanCopyText,
  spanDur,
  toOtel,
  type Comparison,
  type Span,
  type Trace as TraceData,
  type TraceFilter,
} from "@/lib/trace";
import { cue } from "./sound";
import type { SegRef } from "./timeline";
import { cx } from "./ui";

const RED = "oklch(0.68 0.21 25)";
// the model blue and the tool green the legend of the rows uses; orchestration calls and waits keep their own greys and amber
const MODEL_BLUE = "oklch(0.72 0.14 250)";
const TOOL_GREEN = "oklch(0.78 0.14 160)";
const WAIT = "oklch(0.78 0.15 60)";
const AXIS_H = 28;
const ROW_H = 36;
const MIN_ZOOM_MS = 50;
const TICKS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];

export type TraceProps = {
  events: AnyRunEvent[];
  /** the clock (epoch ms) while the run is live */
  now: number;
  workstreamId: string;
  runId: string | null;
  /** the pinned span (the deep link's `span`, or what the shell remembers) */
  selectedSpan: string | null;
  /** the lane timeline's selection: a span whose step matches it is pinned too */
  selSeg: SegRef | null;
  /** pin (or with null, unpin) a span; the shell selects the same step in Agent I/O */
  onPin: (id: string | null, ref: SegRef | null) => void;
  /** hover or keyboard focus on a span: the shell previews that step in the Inspector (not a selection) */
  onHover: (ref: SegRef | null) => void;
  onOpenAgentIO: (ref: SegRef) => void;
  /** a phone (under 768 px): the detail card is a bottom sheet above the tab bar */
  phone: boolean;
  filter: TraceFilter;
  onFilter: (f: TraceFilter) => void;
  reducedMotion: boolean;
};

const sameRef = (a: SegRef | null | undefined, b: SegRef | null | undefined) => !!a && !!b && a.instance === b.instance && a.id === b.id;
const spanName = (s: Span) => (s.kind === "tool" ? s.label : s.kind === "model" ? (s.note ?? s.label) : s.label);

export function Trace({ events, now, workstreamId, runId, selectedSpan, selSeg, onPin, onHover, onOpenAgentIO, phone, filter, onFilter, reducedMotion }: TraceProps) {
  const trace = useMemo(() => buildTrace(events), [events]);
  const rootRef = useRef<HTMLElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState(900);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const compact = box < 560;
  const lw = compact ? 152 : 260;
  const rw = compact ? 64 : 150;
  const plotW = Math.max(60, box - lw - rw);

  /* ---- time axis: the whole run, or the part the person dragged out ---- */
  const liveEnd = trace.live ? Math.max(trace.totalMs, now - trace.startedAt) : trace.totalMs;
  const openEnd = liveEnd;
  const full = Math.max(1000, liveEnd) * 1.02;
  const [zoom, setZoom] = useState<{ a: number; b: number } | null>(null);
  const target = zoom ?? { a: 0, b: full };
  const d0 = useTween(target.a, 200, "out");
  const d1 = useTween(target.b, 200, "out");
  const span = Math.max(1, d1 - d0);
  const pct = (ms: number) => ((ms - d0) / span) * 100;
  const setZoomTo = useCallback(
    (a: number, b: number) => {
      let lo = Math.max(0, a);
      let hi = Math.min(full, b);
      if (hi - lo < MIN_ZOOM_MS) {
        const mid = (lo + hi) / 2;
        lo = Math.max(0, mid - MIN_ZOOM_MS / 2);
        hi = lo + MIN_ZOOM_MS;
      }
      setZoom(hi - lo >= full * 0.98 ? null : { a: lo, b: hi });
    },
    [full],
  );

  /* ---- selection: pinned (click, Enter) and active (hover, arrow keys) ---- */
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeVia = useRef<"pointer" | "key">("pointer");
  const byId = useMemo(() => new Map(trace.spans.map((s) => [s.id, s])), [trace.spans]);
  const pinnedId = selectedSpan && byId.has(selectedSpan) ? selectedSpan : (trace.spans.find((s) => sameRef(s.ref, selSeg))?.id ?? null);
  const pinned = pinnedId ? byId.get(pinnedId) : undefined;
  const active = activeId ? byId.get(activeId) : undefined;
  const focusSpan = pinned ?? active;
  const setActive = useCallback(
    (id: string | null, via: "pointer" | "key") => {
      activeVia.current = via;
      setActiveId(id);
    },
    [],
  );
  useEffect(() => {
    onHover(active ? active.ref : null);
  }, [active?.ref.instance, active?.ref.id]); // eslint-disable-line react-hooks/exhaustive-deps -- the ref's two strings are the dependency
  useEffect(() => () => onHover(null), []); // eslint-disable-line react-hooks/exhaustive-deps -- leaving the view clears the preview
  const pin = useCallback(
    (id: string | null) => {
      const s = id ? byId.get(id) : undefined;
      onPin(s ? s.id : null, s ? s.ref : null);
      cue(s ? "select" : "close", s ? undefined : { emphasis: "subtle" });
    },
    [byId, onPin],
  );
  // the card shrinks the list, and a deep link opens with a span already pinned: keep the pinned row in view
  useEffect(() => {
    if (!pinnedId) return;
    const t = setTimeout(() => wrapRef.current?.querySelector<HTMLElement>(`[data-span="${CSS.escape(pinnedId)}"]`)?.scrollIntoView({ block: "nearest" }), 60);
    return () => clearTimeout(t);
  }, [pinnedId]);
  const firstCard = useRef(true);
  useEffect(() => {
    if (pinnedId && firstCard.current) cue("open", { emphasis: "subtle" });
    firstCard.current = !pinnedId;
  }, [pinnedId]);

  /* ---- filters ---- */
  const counts = useMemo(() => filterCounts(trace), [trace]);
  const effective: TraceFilter = counts[filter] > 0 ? filter : "all";
  const lit = useMemo(() => filterIds(trace, effective), [trace, effective]);

  /* ---- compare with the workstream's last finished run ---- */
  const [prevRun, setPrevRun] = useState<{ id: string; n: number | null } | null>(null);
  const [compareOn, setCompareOn] = useState(false);
  const [prevTrace, setPrevTrace] = useState<TraceData | null>(null);
  useEffect(() => {
    if (!runId) return;
    let alive = true;
    void fetch(`/api/runs?workstreamId=${encodeURIComponent(workstreamId)}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ runs: { id: string; status: string }[] }>) : null))
      .then((d) => {
        if (!alive || !d) return;
        const at = d.runs.findIndex((r) => r.id === runId);
        if (at < 0) return;
        const prev = d.runs.slice(at + 1).find((r) => r.status === "done");
        if (prev) setPrevRun({ id: prev.id, n: d.runs.length < 10 ? d.runs.length - d.runs.indexOf(prev) : null });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [workstreamId, runId]);
  useEffect(() => {
    if (!compareOn || !prevRun || prevTrace) return;
    let alive = true;
    void fetch(`/api/runs/${prevRun.id}/events?since=0`)
      .then((r) => r.text())
      .then((t) => {
        const evs: AnyRunEvent[] = [];
        for (const line of t.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const e = JSON.parse(line.slice(6)) as AnyRunEvent;
            if (e && typeof e.type === "string" && "payload" in e) evs.push(e);
          } catch {
            /* not an event (the done frame) */
          }
        }
        if (alive && evs.length) setPrevTrace(buildTrace(evs));
        else if (alive) setCompareOn(false);
      })
      .catch(() => alive && setCompareOn(false));
    return () => {
      alive = false;
    };
  }, [compareOn, prevRun, prevTrace]);
  const cmp: Comparison | null = useMemo(() => (compareOn && prevTrace && !trace.live ? compareTraces(trace, prevTrace) : null), [compareOn, prevTrace, trace]);

  /* ---- copy, export ---- */
  const [copied, setCopied] = useState("");
  const copyText = useCallback(async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
    } catch {
      // the async clipboard needs a secure context and focus; a hidden textarea and execCommand still work without them
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch {
        /* blocked */
      }
      ta.remove();
      setCopied(ok ? what : "Copy was blocked by the browser");
    }
    setTimeout(() => setCopied(""), 1600);
  }, []);
  const [menu, setMenu] = useState(false);
  const exportJson = () => JSON.stringify(toOtel(trace), null, 2);
  const download = () => {
    const url = URL.createObjectURL(new Blob([exportJson()], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "trace.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMenu(false);
  };

  /* ---- the detail card's tab ---- */
  const [tab, setTab] = useState<string | null>(null);
  useEffect(() => setTab(null), [pinnedId]);
  const tabsOf = pinned ? tabsFor(pinned) : null;
  const tabNow = tabsOf ? (tab && tabsOf.tabs.includes(tab) ? tab : tabsOf.initial) : null;

  /* ---- pointer: cursor, tooltip, drag to zoom, pinch ---- */
  const [cur, setCur] = useState<{ x: number; y: number; ms: number } | null>(null);
  const [drag, setDrag] = useState<{ x0: number; x1: number } | null>(null);
  const dragging = useRef<{ x0: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const pts = useRef(new Map<number, number>());
  const pinch = useRef<{ dist: number; a: number; b: number; f: number } | null>(null);
  const msAt = (clientX: number) => {
    const r = plotRef.current?.getBoundingClientRect();
    return r ? d0 + ((clientX - r.left) / r.width) * span : 0;
  };
  const inPlot = (clientX: number) => {
    const r = plotRef.current?.getBoundingClientRect();
    return !!r && clientX >= r.left && clientX <= r.right;
  };
  const onPointerDown = (e: RPointerEvent) => {
    if (e.button !== 0 || !inPlot(e.clientX)) return;
    pts.current.set(e.pointerId, e.clientX);
    if (pts.current.size === 2) {
      const [p, q] = [...pts.current.values()];
      const r = plotRef.current!.getBoundingClientRect();
      pinch.current = { dist: Math.max(1, Math.abs(p - q)), a: target.a, b: target.b, f: ((p + q) / 2 - r.left) / r.width };
      dragging.current = null;
      setDrag(null);
      return;
    }
    dragging.current = { x0: e.clientX, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: RPointerEvent) => {
    const r = plotRef.current?.getBoundingClientRect();
    const w = wrapRef.current?.getBoundingClientRect();
    if (pts.current.has(e.pointerId)) pts.current.set(e.pointerId, e.clientX);
    if (pinch.current && pts.current.size === 2) {
      const [p, q] = [...pts.current.values()];
      const nSpan = (pinch.current.b - pinch.current.a) * (pinch.current.dist / Math.max(1, Math.abs(p - q)));
      const centre = pinch.current.a + (pinch.current.b - pinch.current.a) * pinch.current.f;
      setZoomTo(centre - nSpan * pinch.current.f, centre + nSpan * (1 - pinch.current.f));
      return;
    }
    if (r && w && e.clientX >= r.left && e.clientX <= r.right) setCur({ x: e.clientX - r.left, y: e.clientY - w.top, ms: msAt(e.clientX) });
    else setCur(null);
    const d = dragging.current;
    if (d && r) {
      if (Math.abs(e.clientX - d.x0) > 5) d.moved = true;
      if (d.moved) setDrag({ x0: Math.min(Math.max(d.x0, r.left), r.right) - r.left, x1: Math.min(Math.max(e.clientX, r.left), r.right) - r.left });
    }
  };
  const endPointer = (e: RPointerEvent) => {
    pts.current.delete(e.pointerId);
    if (pts.current.size < 2) pinch.current = null;
    const d = dragging.current;
    dragging.current = null;
    if (d?.moved) {
      suppressClick.current = true;
      setTimeout(() => (suppressClick.current = false), 0);
      const a = msAt(d.x0);
      const b = msAt(e.clientX);
      if (Math.abs(b - a) > (span * 6) / plotW) setZoomTo(Math.min(a, b), Math.max(a, b));
    }
    setDrag(null);
  };
  // ctrl-wheel (and a trackpad pinch, which arrives the same way) zooms around the cursor; a listener of its own because React's is passive
  const zoomRef = useRef({ target, full, d0, span, setZoomTo });
  zoomRef.current = { target, full, d0, span, setZoomTo };
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      const r = plotRef.current?.getBoundingClientRect();
      if (!r || e.clientX < r.left || e.clientX > r.right) return;
      e.preventDefault();
      const z = zoomRef.current;
      const f = (e.clientX - r.left) / r.width;
      const at = z.d0 + f * z.span;
      const nSpan = (z.target.b - z.target.a) * Math.exp(e.deltaY * 0.01);
      z.setZoomTo(at - f * nSpan, at + (1 - f) * nSpan);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  /* ---- keyboard: ↑ ↓ Enter Esc C F [ ] L ---- */
  const shown = useMemo(() => trace.spans.filter((s) => lit.has(s.id)), [trace.spans, lit]);
  const scrollTo = (id: string) => requestAnimationFrame(() => wrapRef.current?.querySelector<HTMLElement>(`[data-span="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest" }));
  const jump = (s: Span | undefined) => {
    if (!s) return;
    pin(s.id);
    setActive(null, "key");
    scrollTo(s.id);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    const onButton = tag === "BUTTON" || tag === "A";
    const at = focusSpan ? trace.spans.findIndex((s) => s.id === focusSpan.id) : -1;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp": {
        if (!shown.length) return;
        e.preventDefault();
        const here = shown.findIndex((s) => s.id === (active ?? pinned)?.id);
        const next = e.key === "ArrowDown" ? (here < 0 ? 0 : Math.min(shown.length - 1, here + 1)) : here < 0 ? shown.length - 1 : Math.max(0, here - 1);
        setActive(shown[next].id, "key");
        scrollTo(shown[next].id);
        cue("select", { emphasis: "subtle" });
        break;
      }
      case "Enter":
        if (onButton || !active) return;
        e.preventDefault();
        pin(pinned?.id === active.id ? null : active.id);
        break;
      case "Escape":
        if (menu) setMenu(false);
        else if (pinned) pin(null);
        else if (zoom) setZoom(null);
        else setActive(null, "key");
        break;
      case "c":
      case "C":
        if (onButton || !focusSpan) return;
        void copyText(spanCopyText(focusSpan, pinned ? (tabNow ?? undefined) : undefined), "Copied the output");
        break;
      case "f":
      case "F": {
        const order = FILTERS.filter((f) => counts[f.key] > 0);
        if (!order.length) return;
        const i = order.findIndex((f) => f.key === effective);
        onFilter(order[(i + (e.shiftKey ? order.length - 1 : 1)) % order.length].key);
        break;
      }
      case "[":
      case "]": {
        const failed = trace.spans.filter((s) => s.failed);
        if (!failed.length) return;
        const next = e.key === "]" ? (failed.find((s) => trace.spans.indexOf(s) > at) ?? failed[0]) : ([...failed].reverse().find((s) => trace.spans.indexOf(s) < at) ?? failed[failed.length - 1]);
        jump(next);
        break;
      }
      case "l":
      case "L":
        if (onButton) return;
        jump(trace.longest ?? undefined);
        break;
    }
  };

  /* ---- ticks ---- */
  const seconds = span / 1000;
  // the smallest step whose ticks sit at least 64 px apart (every other tick is labelled on a phone, so 40 px there)
  const step = TICKS.find((t) => (t / seconds) * plotW >= (compact ? 40 : 64)) ?? 3600;
  const ticks: { sec: number; label: boolean }[] = [];
  for (let k = Math.ceil(d0 / 1000 / step); k * step * 1000 <= d1; k++) ticks.push({ sec: k * step, label: !compact || k % 2 === 0 });

  /* ---- rows that appear after the first paint rise in; the first paint does not animate ---- */
  const known = useRef<Set<string> | null>(null);
  if (known.current === null && trace.spans.length) known.current = new Set(trace.spans.map((s) => s.id));
  const fresh = (id: string) => known.current !== null && !known.current.has(id);
  useEffect(() => {
    if (known.current === null) return;
    const set = known.current;
    const t = setTimeout(() => trace.spans.forEach((s) => set.add(s.id)), 400);
    return () => clearTimeout(t);
  }, [trace.spans]);

  const hl = headline(trace);
  const total = Math.max(liveEnd, trace.totalMs);
  const tipSpan = cur && active && cur.ms >= active.startMs - (span * 5) / plotW && cur.ms <= (active.endMs ?? openEnd) + (span * 5) / plotW ? active : null;
  const selected = pinned ?? null;
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

  return (
    <section ref={rootRef} aria-label="Run trace" tabIndex={0} onKeyDown={onKeyDown} className="relative flex min-h-0 flex-1 flex-col outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--rb-accent)]">
      {/* headline */}
      <div className="shrink-0 px-4 pt-3">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="text-[22px]/[28px] font-extrabold tabular-nums text-neutral-50" data-demo="trace-total">
            {fmtDur(total)}
            <span className="ms-2 text-[15px] font-bold text-neutral-400">/ {fmtTok(trace.tokens)} tokens</span>
          </p>
          <p className="text-[13px] font-semibold tabular-nums text-neutral-300" data-demo="trace-counts">
            {plural(trace.modelCalls, "model call")} · {plural(trace.toolCalls, "tool call")} · {plural(trace.waits, "wait")}
          </p>
          <span className="flex-1" />
          <div className="relative flex items-center gap-1.5">
            {prevRun && (
              <button type="button" data-cuelume-select="" aria-pressed={compareOn} disabled={trace.live} onClick={() => setCompareOn((v) => !v)} title={trace.live ? "Available when this run ends" : "Show how each call compares with this workstream's last run"} className="h-7 rounded-full border border-white/12 px-3 text-[12px] font-bold text-neutral-200 hover:bg-white/10 disabled:opacity-40 aria-pressed:border-[var(--rb-accent)]/50 aria-pressed:bg-[var(--rb-accent)]/15 aria-pressed:text-[var(--rb-accent)]">
                vs last run
              </button>
            )}
            <button type="button" aria-label="Share the trace" aria-haspopup="menu" aria-expanded={menu} data-cuelume-open="" data-cuelume-emphasis="subtle" onClick={() => setMenu((v) => !v)} className="grid size-7 place-items-center rounded-full text-neutral-300 hover:bg-white/10 aria-expanded:bg-white/10">
              <Ellipsis className="size-4" aria-hidden="true" />
            </button>
            {menu && (
              <div role="menu" className="nb-scale-in absolute right-0 top-full z-30 mt-1 w-52 rounded-xl border border-white/10 bg-neutral-900 p-1 text-[13px] font-semibold shadow-xl">
                <button type="button" role="menuitem" onClick={() => (void copyText(exportJson(), "Copied the trace as JSON"), setMenu(false))} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-neutral-100 hover:bg-white/10">
                  <Copy className="size-4 text-neutral-400" aria-hidden="true" /> Copy as JSON
                </button>
                <button type="button" role="menuitem" onClick={download} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-neutral-100 hover:bg-white/10">
                  <Download className="size-4 text-neutral-400" aria-hidden="true" /> Download trace.json
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="mt-1 min-h-6 text-[14px]/[22px] font-semibold text-neutral-200" aria-live="polite">
          {trace.live ? (
            <span className="inline-flex items-center gap-2 text-neutral-400">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400 motion-reduce:animate-none" aria-hidden="true" /> Live: the headline appears when the run ends
            </span>
          ) : hl ? (
            <button key={hl.spanId} type="button" data-cuelume-select="" onClick={() => pin(hl.spanId)} className="nb-rise rounded-md text-left underline decoration-white/25 decoration-dotted underline-offset-4 hover:decoration-[var(--rb-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rb-accent)]">
              {hl.text}
            </button>
          ) : (
            <span className="text-neutral-500">Nothing to time yet.</span>
          )}
          {cmp && cmp.fasterPct !== null && (
            <span className="nb-rise ms-3 text-[13px] font-bold" style={{ color: cmp.fasterPct >= 0 ? "var(--rb-accent)" : RED }}>
              {prevRun?.n ? `run ${prevRun.n + 1} was ${Math.abs(Math.round(cmp.fasterPct * 100))} % ${cmp.fasterPct >= 0 ? "faster" : "slower"} than run ${prevRun.n}` : `${Math.abs(Math.round(cmp.fasterPct * 100))} % ${cmp.fasterPct >= 0 ? "faster" : "slower"} than the last run`}
              {cmp.excludesWaits && <span className="ms-1 font-semibold text-neutral-500">(waiting on you left out)</span>}
            </span>
          )}
        </div>
        {/* filters */}
        <div className="-mx-4 mt-2 flex items-center gap-1.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none]" role="group" aria-label="Filter the spans">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" data-cuelume-select="" disabled={counts[f.key] === 0} aria-pressed={effective === f.key} onClick={() => onFilter(f.key)} className={cx("flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-35", effective === f.key ? "bg-white text-neutral-950" : "bg-white/8 text-neutral-200 hover:bg-white/16")}>
              {f.label}
              <span className={cx("tabular-nums", effective === f.key ? "text-neutral-600" : "text-neutral-400")}>{counts[f.key]}</span>
            </button>
          ))}
          {zoom && (
            <button type="button" data-cuelume-close="" data-cuelume-emphasis="subtle" onClick={() => setZoom(null)} className="nb-rise-fast ms-auto flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-[var(--rb-accent)]/18 px-3 text-[12px] font-bold text-[var(--rb-accent)] hover:bg-[var(--rb-accent)]/28">
              <ZoomOut className="size-3.5" aria-hidden="true" /> Reset zoom
            </button>
          )}
        </div>
      </div>

      {/* rows */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden border-t border-white/10">
        {trace.spans.length === 0 ? (
          <div className="grid h-full min-h-40 place-items-center px-6 text-center text-[14px] text-neutral-500">The trace fills as soon as the crew makes its first call.</div>
        ) : (
          <div
            ref={wrapRef}
            role="grid"
            aria-label="Calls on one time axis"
            aria-rowcount={trace.spans.length}
            aria-activedescendant={active ? `trace-${rowKey(active.id)}` : undefined}
            className="relative select-none touch-pan-y"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
            onPointerLeave={() => (setCur(null), activeVia.current === "pointer" && setActive(null, "pointer"))}
            onDoubleClick={() => setZoom(null)}
          >
            {/* axis */}
            <div role="row" aria-hidden="true" className="sticky top-0 z-10 grid border-b border-white/10 bg-neutral-950/95 backdrop-blur-sm" style={{ height: AXIS_H, gridTemplateColumns: `${lw}px minmax(0,1fr) ${rw}px` }}>
              <span />
              <div className="relative overflow-hidden">
                {ticks.map((t) => {
                  const at = pct(t.sec * 1000);
                  // the label centres on its tick, except one at the very left or right edge, which would be cut off
                  return (
                    <span key={t.sec} className="absolute top-1/2 whitespace-nowrap text-[11px] font-semibold tabular-nums text-neutral-500" style={{ left: `${at}%`, transform: `translate(${at < 1.5 ? "3px" : at > 96 ? "calc(-100% - 3px)" : "-50%"}, -50%)`, opacity: t.label ? 1 : 0 }}>
                      {fmtAxis(t.sec)}
                    </span>
                  );
                })}
              </div>
              <span />
            </div>

            {/* the plot overlay: gridlines, the selected span's column, the hover cursor, the zoom selection */}
            <div ref={plotRef} className="pointer-events-none absolute inset-y-0 z-[5] overflow-hidden" style={{ left: lw, right: rw }} aria-hidden="true">
              {ticks.map((t) => (
                <span key={t.sec} className="absolute bottom-0 w-px bg-white/[0.07]" style={{ left: `${pct(t.sec * 1000)}%`, top: AXIS_H }} />
              ))}
              {selected && (
                <span className="absolute bottom-0 border-x border-white/10 bg-white/[0.06]" style={{ top: AXIS_H, left: `${pct(selected.startMs)}%`, width: `max(2px, ${(spanDur(selected, openEnd) / span) * 100}%)` }} />
              )}
              {drag && <span className="absolute inset-y-0 border-x border-[var(--rb-accent)]/70 bg-[var(--rb-accent)]/15" style={{ left: Math.min(drag.x0, drag.x1), width: Math.abs(drag.x1 - drag.x0) }} />}
              {cur && !drag && (
                <>
                  <span className="absolute inset-y-0 w-px bg-white/45" style={{ left: cur.x }} />
                  <span className="absolute top-1 -translate-x-1/2 rounded bg-neutral-100 px-1.5 text-[10px] font-extrabold tabular-nums leading-4 text-neutral-950" style={{ left: Math.min(Math.max(cur.x, 24), plotW - 24) }}>
                    {fmtDur(cur.ms)}
                  </span>
                </>
              )}
            </div>

            {trace.spans.map((s, i) => (
              <Row
                key={s.id}
                span={s}
                index={i}
                d0={d0}
                span_={span}
                end={s.endMs ?? openEnd}
                lw={lw}
                rw={rw}
                compact={compact}
                selected={pinnedId === s.id}
                active={activeId === s.id}
                dim={!lit.has(s.id)}
                delta={cmp?.deltas.get(s.id)}
                fresh={fresh(s.id)}
                onClick={(e) => {
                  if (suppressClick.current || e.detail >= 2) return;
                  pin(pinnedId === s.id ? null : s.id);
                }}
                onEnter={() => setActive(s.id, "pointer")}
              />
            ))}

            {tipSpan && cur && (
              <div role="tooltip" className="pointer-events-none absolute z-20 whitespace-nowrap rounded-lg border border-white/12 bg-neutral-900/95 px-2.5 py-1.5 text-[12px] font-semibold text-neutral-100 shadow-xl backdrop-blur-sm" style={{ top: cur.y + 16, ...(cur.x > plotW * 0.6 ? { right: box - (lw + cur.x) + 10 } : { left: lw + cur.x + 12 }) }}>
                {spanName(tipSpan)} · {fmtDur(spanDur(tipSpan, openEnd))}
                {tipSpan.model ? ` · ${fmtTok(tipSpan.model.in + tipSpan.model.out)} tokens` : ""}
              </div>
            )}
          </div>
        )}
      </div>

      <p className="sr-only" role="status">
        {copied}
      </p>
      {copied && (
        <div className="nb-rise-fast pointer-events-none absolute left-1/2 top-3 z-40 -translate-x-1/2 rounded-full border border-white/10 bg-neutral-900/95 px-3 py-1 text-[12px] font-bold text-neutral-100 shadow-lg" aria-hidden="true">
          {copied}
        </div>
      )}

      {/* the detail card: below the rows on a wide screen, a bottom sheet on a phone */}
      {pinned && (
        <Card
          span={pinned}
          openEnd={openEnd}
          sheet={phone}
          tab={tabNow!}
          tabs={tabsOf!.tabs}
          onTab={setTab}
          onClose={() => pin(null)}
          onCopy={() => void copyText(spanCopyText(pinned, tabNow ?? undefined), "Copied")}
          onOpen={() => onOpenAgentIO(pinned.ref)}
        />
      )}
      <span className="sr-only">{reducedMotion ? "Reduced motion is on." : ""}</span>
    </section>
  );
}

const rowKey = (id: string) => id.replace(/[^\w-]/g, "_");

/* ---------------- one row ---------------- */

type RowProps = {
  span: Span;
  index: number;
  d0: number;
  span_: number;
  end: number;
  lw: number;
  rw: number;
  compact: boolean;
  selected: boolean;
  active: boolean;
  dim: boolean;
  delta?: number;
  fresh: boolean;
  onClick: (e: React.MouseEvent) => void;
  onEnter: () => void;
};

const Row = memo(function Row({ span: s, index, d0, span_, end, lw, rw, compact, selected, active, dim, delta, fresh, onClick, onEnter }: RowProps) {
  const live = s.endMs === undefined;
  const dur = Math.max(0, end - s.startMs);
  const left = ((s.startMs - d0) / span_) * 100;
  const width = (dur / span_) * 100;
  const color = s.failed ? RED : s.kind === "model" ? MODEL_BLUE : s.kind === "tool" ? (s.control ? "var(--color-neutral-400)" : TOOL_GREEN) : WAIT;
  const ttft = s.model?.ttftMs && dur > 0 ? Math.min(100, (s.model.ttftMs / dur) * 100) : 0;
  const tokens = s.model ? s.model.in + s.model.out : 0;
  const sub = s.kind === "model" ? `${s.agent} · ${TIER_SHORT[s.model!.tier]}${s.model?.route?.fallback ? " ↻" : s.model?.cached ? " · cached" : ""}` : s.agent;
  return (
    <div
      role="row"
      id={`trace-${rowKey(s.id)}`}
      data-span={s.id}
      aria-selected={selected}
      aria-rowindex={index + 1}
      onClick={onClick}
      onPointerEnter={onEnter}
      className={cx("relative grid cursor-pointer items-center border-b border-white/[0.04] transition-[opacity,background-color] duration-150", fresh && "nb-rise-fast", selected ? "bg-[var(--rb-accent)]/[0.07]" : active ? "bg-white/[0.05]" : "")}
      style={{ height: ROW_H, gridTemplateColumns: `${lw}px minmax(0,1fr) ${rw}px`, opacity: dim ? 0.25 : 1 }}
    >
      {selected && <span className="absolute inset-y-0 left-0 z-[6] w-0.5 bg-[var(--rb-accent)]" aria-hidden="true" />}
      <div role="gridcell" className={cx("flex min-w-0 items-center gap-2 pe-2", compact ? "ps-2" : "ps-4", s.depth === 1 && !compact && "ps-8")}>
        <span className="grid size-5 shrink-0 place-items-center" style={{ color: s.failed ? RED : s.kind === "model" ? "#76b900" : s.kind === "tool" ? (s.control ? "var(--color-neutral-400)" : TOOL_GREEN) : WAIT }}>
          {s.kind === "model" ? <NemotronMark /> : s.kind === "tool" ? <ToolIcon span={s} className="size-4" /> : <Hand className="size-4" aria-hidden="true" />}
        </span>
        <span className="min-w-0 leading-tight">
          <span className={cx("block truncate font-semibold text-neutral-100", compact ? "text-[12px]" : "text-[13px]")} title={spanName(s)}>
            {spanName(s)}
          </span>
          {!compact && (
            <span className="block truncate text-[11px] font-semibold text-neutral-500">
              <span className="me-1 inline-block size-1.5 rounded-full align-middle" style={{ background: ROLE_COLOR[s.role] }} aria-hidden="true" />
              {sub}
            </span>
          )}
        </span>
      </div>
      <div role="gridcell" className="relative h-full overflow-hidden">
        <span
          role="img"
          aria-label={`${spanName(s)}, started at ${fmtDur(s.startMs)}, took ${fmtDur(dur)}${tokens ? `, ${fmtTok(tokens)} tokens` : ""}${s.failed ? ", failed" : ""}${live ? ", still running" : ""}`}
          className={cx("absolute top-1/2 h-4 -translate-y-1/2 overflow-hidden rounded-[5px]", fresh && "nb-grow")}
          style={{
            left: `${left}%`,
            width: `max(3px, ${width}%)`,
            opacity: s.control ? 0.45 : 1,
            ...(s.kind === "wait" || s.kind === "gate"
              ? { background: `repeating-linear-gradient(135deg, color-mix(in oklab, ${color} 55%, transparent) 0 4px, color-mix(in oklab, ${color} 14%, transparent) 4px 8px)`, outline: `1px solid color-mix(in oklab, ${color} 55%, transparent)`, outlineOffset: -1 }
              : { background: color }),
          }}
        >
          {ttft > 0 && <span className="absolute inset-y-0 left-0 bg-white/40" style={{ width: `${ttft}%` }} />}
        </span>
        {live && <span className="absolute top-1/2 h-4 w-1 -translate-y-1/2 animate-pulse rounded-full bg-white motion-reduce:animate-none" style={{ left: `calc(${left + width}% + 1px)` }} aria-hidden="true" />}
        {s.failed && (
          <span className="absolute top-1/2 -translate-y-1/2 text-[12px] font-extrabold leading-none" style={{ left: `calc(${Math.min(left + width, 97)}% + 4px)`, color: RED }} aria-hidden="true">
            ✗
          </span>
        )}
      </div>
      <div role="gridcell" className="flex items-center justify-end gap-2 pe-3 text-right tabular-nums">
        {!compact && s.model && <span className="w-11 text-[12px] font-semibold text-neutral-400">{fmtTok(tokens)}</span>}
        {!compact && delta !== undefined && Math.abs(delta) >= 50 && (
          <span className="w-12 text-[11px] font-bold" style={{ color: delta > 0 ? RED : "var(--rb-accent)" }} title="Against this workstream's last run">
            {fmtDelta(delta)}
          </span>
        )}
        <span className={cx("min-w-[3.5rem] text-[13px] font-bold", live ? "text-emerald-300" : "text-neutral-100")}>{fmtDur(dur)}</span>
      </div>
    </div>
  );
});

const TOOL_ICON: Record<string, LucideIcon> = { web_search: Globe, fetch_url: Link2, write_artifact: FileText, send_message: MessageSquare, read_repo: FolderGit2, open_pr: GitPullRequest, save_learning: Sparkles, ask_user: CircleQuestionMark };

/** One icon per tool: a globe for a search, a link for a page, the sandbox glyph for run_code at Nebius and a terminal when it ran locally */
function ToolIcon({ span: s, className }: { span: Span; className?: string }) {
  const t = s.tool;
  if (!t) return <Wrench className={className} aria-hidden="true" />;
  if (t.name === "run_code") return t.where === "nebius-sandbox" ? <Box className={className} aria-label="Nebius Sandbox" /> : <Terminal className={className} aria-label="Ran locally" />;
  const telegram = t.name === "send_message" && /telegram/i.test(String((t.input as { channel?: unknown } | null)?.channel ?? ""));
  const Icon = telegram ? Send : (TOOL_ICON[t.name] ?? Wrench);
  return <Icon className={className} aria-hidden="true" />;
}

/** The pretty-printed JSON with keys blue, numbers and literals orange, strings plain and the braces dim; newlines inside a string are shown as lines */
function JsonView({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)|([{}\[\],:])/g;
  let last = 0;
  let i = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      const shown = m[2] ? m[1] : m[1].replace(/\\n/g, "\n");
      out.push(
        <span key={i++} className={m[2] ? "text-sky-300" : "text-neutral-200"}>
          {shown}
        </span>,
      );
      if (m[2]) out.push(<span key={i++} className="text-neutral-500">{m[2]}</span>);
    } else if (m[3] !== undefined) out.push(<span key={i++} className="text-orange-300">{m[3]}</span>);
    else out.push(<span key={i++} className="text-neutral-500">{m[4]}</span>);
    last = m.index + m[0].length;
  }
  out.push(text.slice(last));
  return <>{out}</>;
}

function NemotronMark() {
  return (
    <svg viewBox="0 0 20 20" className="size-[18px]" aria-label="Nemotron">
      <rect x="1" y="1" width="18" height="18" rx="5" fill="currentColor" opacity="0.22" />
      <path d="M6 14V6l8 8V6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------------- the detail card ---------------- */

function tabsFor(s: Span): { tabs: string[]; initial: string } {
  if (s.model) return { tabs: ["output", "prompt"], initial: "output" };
  if (s.tool) return { tabs: ["input", "output"], initial: "output" };
  return { tabs: [], initial: "" };
}

function Card({ span: s, openEnd, sheet, tab, tabs, onTab, onClose, onCopy, onOpen }: { span: Span; openEnd: number; sheet: boolean; tab: string; tabs: string[]; onTab: (t: string) => void; onClose: () => void; onCopy: () => void; onOpen: () => void }) {
  const dur = spanDur(s, openEnd);
  const text = s.wait ? "" : spanCopyText(s, tab);
  const io = s.tool ? ioBytes(s) : null;
  const sb = s.tool?.sandbox;
  return (
    <div
      role="region"
      aria-label={`Details of ${spanName(s)}`}
      className={cx("nb-rise-fast flex shrink-0 flex-col gap-3 overflow-y-auto border-white/10 bg-neutral-950 p-4", sheet ? "fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 max-h-[62dvh] rounded-t-2xl border-x border-t shadow-[0_-12px_40px_rgb(0_0_0/0.6)]" : "max-h-[42%] border-t")}
    >
      <div className="flex min-w-0 items-center gap-2">
        {s.model ? (
          <>
            <span className="text-[#76b900]">
              <NemotronMark />
            </span>
            <h3 className="min-w-0 truncate text-[15px] font-extrabold text-neutral-50">{TIER_LABEL[s.model.tier]}</h3>
            <span className="hidden min-w-0 truncate font-mono text-[11px] text-neutral-500 sm:inline" title={s.model.model}>
              {s.model.model}
            </span>
          </>
        ) : s.tool ? (
          <>
            <span className="shrink-0" style={{ color: s.control ? "var(--color-neutral-400)" : TOOL_GREEN }}>
              <ToolIcon span={s} className="size-4" />
            </span>
            <h3 className="min-w-0 truncate text-[15px] font-extrabold text-neutral-50">{s.label}</h3>
            <span className="hidden min-w-0 shrink-0 truncate font-mono text-[11px] text-neutral-500 sm:inline" title="The tool's id">
              {s.tool.name}
            </span>
            {s.tool.name === "run_code" && s.tool.where === "nebius-sandbox" && (
              <span className="shrink-0 rounded-md border border-[var(--rb-accent)]/40 bg-[var(--rb-accent)]/10 px-1.5 py-0.5 text-[11px] font-bold text-[var(--rb-accent)]" title={sb ? `${sb.image}${sb.operation ? ` · op ${sb.operation}` : ""}` : undefined}>
                Nebius Sandbox
              </span>
            )}
            {s.tool.name === "run_code" && s.tool.where === "local" && <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-bold text-neutral-300">ran locally</span>}
          </>
        ) : (
          <>
            <Hand className="size-4 shrink-0" style={{ color: WAIT }} aria-hidden="true" />
            <h3 className="min-w-0 truncate text-[15px] font-extrabold text-neutral-50">{s.label}</h3>
          </>
        )}
        <span className="flex-1" />
        <button type="button" onClick={onOpen} data-cuelume-navigate="" className="flex h-7 shrink-0 items-center gap-1 rounded-full bg-white/10 px-2.5 text-[12px] font-bold text-neutral-100 hover:bg-white/16">
          <span className="max-sm:hidden">Open in</span> Agent I/O <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </button>
        <button type="button" onClick={onClose} aria-label="Close the details" data-cuelume-close="" data-cuelume-emphasis="subtle" className="grid size-7 shrink-0 place-items-center rounded-full text-neutral-400 hover:bg-white/10 hover:text-neutral-100">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {s.model && (
        <>
          <Stats
            items={[
              ["Started", fmtDur(s.startMs)],
              ["Duration", fmtDur(dur)],
              ["First token", s.model.ttftMs ? fmtDur(s.model.ttftMs) : "n/a"],
              ["Input", fmtTok(s.model.in)],
              ["Output", fmtTok(s.model.out)],
              ["Speed", s.model.tokPerS ? `${Math.round(s.model.tokPerS)} tok/s` : "n/a"],
            ]}
          />
          {s.model.route && (
            <p className="text-[13px]/[19px] text-neutral-300">
              {s.model.route.fallback ? "Fell back to " : "Chose "}
              <b>{TIER_SHORT[s.model.route.chosen]}</b>, ceiling {TIER_SHORT[s.model.route.ceiling]}. {s.model.route.reason}.{s.model.cached ? " Answered from the cache: nothing was billed." : ""}
            </p>
          )}
        </>
      )}
      {s.tool && (
        <Stats
          items={
            s.tool.name === "run_code" && io
              ? [
                  ["Started", fmtDur(s.startMs)],
                  ["Duration", fmtDur(dur)],
                  ["Where", s.tool.where === "nebius-sandbox" ? "Nebius Sandbox" : s.tool.where === "local" ? "Local" : "n/a"],
                  ["Exit code", s.tool.exitCode !== undefined ? String(s.tool.exitCode) : "n/a"],
                  ["Stdout", `${io.stdout.toLocaleString("en-US")} B`],
                  ["Stderr", `${io.stderr.toLocaleString("en-US")} B`],
                  ...(sb?.elapsedS !== undefined ? ([["In the sandbox", `${sb.elapsedS.toFixed(1)} s`]] as [string, string][]) : []),
                ]
              : [
                  ["Started", fmtDur(s.startMs)],
                  ["Duration", fmtDur(dur)],
                  ["Result", s.endMs === undefined ? "running" : s.tool.ok === false ? "failed" : "ok"],
                ]
          }
        />
      )}
      {s.wait && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]/[20px]">
          <dt className="text-neutral-500">Asked</dt>
          <dd className="text-neutral-100">{s.agent}</dd>
          <dt className="text-neutral-500">{s.wait.what === "question" ? "Question" : "Action"}</dt>
          <dd className="min-w-0 text-neutral-100 [overflow-wrap:anywhere]">{s.wait.text}</dd>
          <dt className="text-neutral-500">Waited</dt>
          <dd className="tabular-nums text-neutral-100">{fmtDur(dur)}{s.endMs === undefined ? " and counting" : ""}</dd>
          <dt className="text-neutral-500">Decision</dt>
          <dd className="text-neutral-100">{waitDecision(s)}</dd>
        </dl>
      )}

      {tabs.length > 0 && (
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-1">
            <div role="tablist" aria-label="What the call carried" className="flex gap-1">
              {tabs.map((t) => (
                <button key={t} role="tab" type="button" data-cuelume-select="" aria-selected={tab === t} onClick={() => onTab(t)} className={cx("h-7 rounded-md px-2.5 text-[11px] font-extrabold uppercase tracking-wider", tab === t ? "bg-white text-neutral-950" : "text-neutral-300 hover:bg-white/10")}>
                  {t}
                </button>
              ))}
            </div>
            <span className="flex-1" />
            <button type="button" onClick={onCopy} data-cuelume-tap="" className="flex h-7 items-center gap-1.5 rounded-md bg-white/10 px-2.5 text-[12px] font-bold text-neutral-100 hover:bg-white/16">
              <Copy className="size-3.5" aria-hidden="true" /> Copy
            </button>
          </div>
          <pre role="tabpanel" className={cx("overflow-auto whitespace-pre-wrap rounded-lg bg-neutral-900 p-2.5 font-mono [overflow-wrap:anywhere]", s.tool ? "max-h-[400px] text-[13px]/[20px]" : "max-h-36 text-[12px]/[18px]", s.model && s.failed ? "text-red-200" : "text-neutral-300")}>
            {text ? (s.tool && /^\s*[\[{]/.test(text) ? <JsonView text={text} /> : text) : s.endMs === undefined ? "Still running…" : tab === "prompt" ? "No prompt was recorded for this call." : tab === "output" && s.model ? "No text: this hop only asked for tools." : "(empty)"}
          </pre>
        </div>
      )}
    </div>
  );
}

function waitDecision(s: Span): ReactNode {
  const w = s.wait!;
  if (s.endMs === undefined || !w.decision) return <span style={{ color: WAIT }}>Still waiting for you</span>;
  const via = w.via === "telegram" ? " via Telegram" : w.via === "chat" ? " via a chat app" : w.via === "auto" ? " (nobody answered in time, so the crew picked an option)" : w.by === "system" ? " (the run stopped)" : "";
  if (w.what === "question") return `Answered "${w.decision}"${via}`;
  const word = w.decision === "approved" ? "Approved" : w.decision === "rejected" ? "Rejected" : w.decision;
  return `${word}${via}${w.by && w.by !== "you" && !w.via && w.by !== "system" ? ` by ${w.by}` : ""}`;
}

function Stats({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid grid-cols-3 gap-x-4 gap-y-2 sm:grid-cols-6">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-500">{k}</dt>
          <dd className="truncate text-[14px] font-bold tabular-nums text-neutral-50">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
