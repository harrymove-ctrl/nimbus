"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, MousePointerClick, Play, Square } from "lucide-react";
import { GlowCloud } from "@/components/glow-cloud";
import { ROLE_COLOR, TIER_LABEL, TIER_SHORT, fmtCost3, fmtTokens, laneName, type Lane, type RunView, type Seg } from "@/lib/run-view";
import { useTween } from "@/hooks/use-tween";
import { cue } from "./sound";
import { cx } from "./ui";

// Geometry from UI-SKETCH sheet 3: legend W2 240 · lane pitch P1 66 · segment H3 26 (pill R4 13)
// · axis H7 32 · playhead dot Z4 10 · spawn dot Z5 8 · route badge Z8 14 · axis tick AX 5 s.
const LEGEND_W = 240;
const LANE_H = 66;
const SEG_H = 26;
const SEG_TOP = 14;
const AXIS_H = 32;
const RED = "oklch(0.68 0.21 25)";

export type SegRef = { instance: string; id: string };
const segDomId = (s: { instance: string; id: string }) => `seg-${s.instance}-${s.id}`.replace(/[^\w-]/g, "_");

type Props = {
  view: RunView;
  now: number;
  selected: SegRef | null;
  onSelect: (s: Seg) => void;
  /** drop the selection (and with it the trace) */
  onClearSelection?: () => void;
  /** phone: take the whole height of the tab and scroll the lanes sideways (SPEC §7: lanes scroll sideways) */
  fill?: boolean;
  /** scrubbing a finished run: the playhead position in ms, or null for "at the end" (SPEC §17.5) */
  scrubMs?: number | null;
  onScrub?: (ms: number | null) => void;
  replay?: { playing: boolean; speed: 0.5 | 1 | 2; onToggle: () => void; onSpeed: (s: 0.5 | 1 | 2) => void };
  collapsed: boolean;
  onToggle: () => void;
  reducedMotion: boolean;
};

export function Timeline({ view, now, selected, onSelect, onClearSelection, fill, scrubMs = null, onScrub, replay, collapsed, onToggle, reducedMotion }: Props) {
  const dragging = useRef(false);
  // Height of the expanded timeline: drag its bottom edge (120–480 px; pulled under 96 it collapses to the 56 px bar), ↑↓ on the handle, double-click resets.
  const [height, setHeight] = useState(240);
  const resizing = useRef<{ y: number; h: number } | null>(null);
  const clampH = (h: number) => Math.min(480, Math.max(120, Math.round(h)));
  const chartRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const followLanes = useRef(true);
  const [cw, setCw] = useState(640);
  const [tip, setTip] = useState<{ x: number; y: number; text: string; sub: string } | null>(null);
  // One-time hint that the pills open: shown until the first click on a segment (remembered per browser).
  const [hinted, setHinted] = useState(true);
  useEffect(() => {
    try {
      setHinted(localStorage.getItem("nimbus.seg-hint") === "1");
    } catch {
      setHinted(false);
    }
  }, []);
  const dismissHint = () => {
    setHinted(true);
    try {
      localStorage.setItem("nimbus.seg-hint", "1");
    } catch {}
  };

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setCw(Math.max(240, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [collapsed]);

  // New lanes (spawned agents, the Learner after run.end) scroll into view unless the person scrolled up.
  useEffect(() => {
    const el = bodyRef.current;
    if (el && followLanes.current) el.scrollTo({ top: el.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" });
  }, [view.lanes.length, reducedMotion, collapsed]);

  const running = view.lanes.some((l) => l.status === "running");
  const live = view.active || running;
  const tNow = live ? Math.max(0, now - view.startedAt) : view.lastTMs;
  const extent = Math.max(tNow, view.lastTMs);
  // SPEC §15 scale: pxPerSec = (plotWidth − 24) / max(25, elapsed × 1.25) while running, recomputed when the
  // playhead passes 80 % of the window and eased 300 ms; once the run is done, fit the whole run (× 1.04).
  const plotW = Math.max(120, cw);
  const windowRef = useRef({ run: "", s: 25 });
  if (windowRef.current.run !== (view.runId ?? "")) windowRef.current = { run: view.runId ?? "", s: 25 };
  let targetWindowS: number;
  if (live) {
    if (tNow / 1000 > 0.8 * windowRef.current.s) windowRef.current.s = Math.max(25, (tNow / 1000) * 1.25);
    targetWindowS = windowRef.current.s;
  } else {
    targetWindowS = Math.max(10, (extent / 1000) * 1.04);
    windowRef.current.s = targetWindowS;
  }
  const windowS = useTween(targetWindowS, 300, "inOut"); // bars and ticks re-lay out together
  const pxPerSec = (plotW - 24) / windowS;
  const x = (ms: number) => 12 + (ms / 1000) * pxPerSec;
  const playT = scrubMs ?? view.endedMs ?? tNow;
  const canScrub = !live && view.lanes.length > 0 && !!onScrub;
  const scrubFromPointer = (clientX: number) => {
    const r = chartRef.current?.getBoundingClientRect();
    if (!r || !onScrub) return;
    onScrub(Math.round(Math.min(extent, Math.max(0, ((clientX - r.left - 12) / pxPerSec) * 1000))));
  };
  // Trace (SPEC §17.5): the selected segment's lane, who spawned it (all the way up) and what it spawned (all the way down).
  const trace = useMemo(() => {
    if (!selected) return null;
    const by = new Map(view.lanes.map((l) => [l.instance, l.spawnedBy]));
    if (!by.has(selected.instance)) return null;
    const set = new Set<string>([selected.instance]);
    for (let p = by.get(selected.instance); p && !set.has(p); p = by.get(p)) set.add(p); // upstream: who spawned it, and who spawned them
    const down = new Set<string>([selected.instance]); // downstream: what it spawned, recursively (not its siblings)
    let grew = true;
    while (grew) {
      grew = false;
      for (const [inst, parent] of by) if (parent && down.has(parent) && !down.has(inst)) (down.add(inst), set.add(inst), (grew = true));
    }
    return set;
  }, [selected, view.lanes]);
  // Keyboard on the lanes: ←→ step through a lane's segments in time, ↑↓ jump to the nearest segment of the lane above or below.
  const byLane = useMemo(() => view.lanes.map((l) => [...l.segments].sort((a, b) => a.startMs - b.startMs)), [view.lanes]);
  const neighbour = (s: Seg, key: string): Seg | undefined => {
    const li = laneIdx.get(s.instance);
    if (li === undefined) return undefined;
    const idx = byLane[li].findIndex((x) => x.id === s.id);
    if (key === "ArrowRight") return byLane[li][idx + 1];
    if (key === "ArrowLeft") return byLane[li][idx - 1];
    const to = key === "ArrowDown" ? li + 1 : key === "ArrowUp" ? li - 1 : -1;
    if (to < 0 || to >= byLane.length || !byLane[to].length) return undefined;
    return byLane[to].reduce((best, x) => (Math.abs(x.startMs - s.startMs) < Math.abs(best.startMs - s.startMs) ? x : best));
  };
  const dim = (instance: string) => (trace && !trace.has(instance) ? 0.2 : 1);
  const laneIdx = useMemo(() => new Map(view.lanes.map((l, i) => [l.instance, i])), [view.lanes]);
  const firstSegStart = (l?: Lane) => (l && l.segments.length ? Math.min(...l.segments.map((s) => s.startMs)) : undefined);

  const planning = view.status === "planning";
  const bodyH = view.lanes.length * LANE_H;
  // waits for the person and "cancelled after …" are drawn on the Orchestrator's lane: it is the one that asked
  const waitLane = Math.max(0, view.lanes.findIndex((l) => l.instance === "orchestrator"));
  // Major tick step: the smallest of these whose gap fits the widest label plus 16 px and is at least 110 px (about 8
  // labels on a 1000 px lane), so labels
  // never pile up (SPEC §15); up to an hour, for a run that waited on you for most of a morning.
  const STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400];
  const pps = (plotW - 24) / targetWindowS;
  const step = STEPS.find((st) => st * pps >= Math.max(110, fmtTick(Math.ceil(targetWindowS / st) * st).length * 6.4 + 16)) ?? STEPS[STEPS.length - 1];
  const visibleS = (plotW - 12) / pxPerSec;
  const majors: number[] = [];
  for (let t = 0; t <= visibleS; t += step) majors.push(t);
  const minors: number[] = [];
  if (step >= 10) for (let t = step / 5; t <= visibleS; t += step / 5) if (t % step !== 0) minors.push(t);

  if (collapsed) {
    return (
      <section aria-label="Timeline (collapsed)" className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 px-4">
        <span className="text-[12px] font-bold uppercase tracking-wider text-neutral-400">Timeline</span>
        <span className="text-[13px] text-neutral-400 tabular-nums">
          {view.lanes.length} lane{view.lanes.length === 1 ? "" : "s"} · {view.routedHops} routed
        </span>
        <div ref={chartRef} className="relative h-6 min-w-0 flex-1">
          <svg width="100%" height="24" aria-hidden="true">
            {view.lanes.map((l, i) =>
              l.segments.map((s) => (
                <rect
                  key={`${s.instance}:${s.id}`}
                  x={x(s.startMs)}
                  y={2 + i * 4}
                  width={Math.max(2, x(s.endMs ?? tNow) - x(s.startMs))}
                  height={3}
                  rx={1.5}
                  fill={s.failed ? RED : ROLE_COLOR[l.role]}
                  opacity={s.kind === "wait" ? 0.35 : 0.9}
                />
              )),
            )}
            {view.lanes.length > 0 && <line x1={x(playT)} x2={x(playT)} y1={0} y2={24} stroke="white" strokeWidth={1} />}
          </svg>
        </div>
        <button type="button" data-cuelume-open="" data-cuelume-emphasis="subtle" onClick={onToggle} aria-label="Expand timeline" aria-expanded={false} className="grid size-8 place-items-center rounded-md text-neutral-300 hover:bg-white/10">
          <ChevronDown className="size-4" />
        </button>
      </section>
    );
  }

  return (
    <section aria-label="Run timeline" style={fill ? undefined : { height }} className={cx("relative flex flex-col border-b border-white/10", fill ? "min-h-0 flex-1" : "shrink-0")} onKeyDown={(e) => e.key === "Escape" && selected && onClearSelection?.()}>
      {!fill && (
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize the timeline"
        aria-valuemin={120}
        aria-valuemax={480}
        aria-valuenow={height}
        tabIndex={0}
        title="Drag to resize · double-click resets"
        onPointerDown={(e) => {
          resizing.current = { y: e.clientY, h: height };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const r = resizing.current;
          if (!r) return;
          const next = r.h + (e.clientY - r.y);
          if (next < 96) {
            resizing.current = null;
            onToggle();
          } else setHeight(clampH(next));
        }}
        onPointerUp={() => (resizing.current = null)}
        onDoubleClick={() => setHeight(240)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") (e.preventDefault(), setHeight((h) => clampH(h + 24)));
          if (e.key === "ArrowUp") (e.preventDefault(), setHeight((h) => clampH(h - 24)));
        }}
        className="group absolute inset-x-0 -bottom-1.5 z-30 flex h-3 cursor-row-resize items-center justify-center outline-none"
      >
        <span className="h-0.5 w-10 rounded-full bg-white/15 transition-colors group-hover:bg-white/40 group-focus-visible:bg-[var(--rb-accent)]" />
      </div>
      )}
      <button type="button" data-cuelume-close="" data-cuelume-emphasis="subtle" onClick={onToggle} aria-label="Collapse timeline" aria-expanded className={cx("absolute right-2 top-2 z-20 grid size-7 place-items-center rounded-md text-neutral-400 hover:bg-white/10 hover:text-neutral-100", fill && "hidden")}>
        <ChevronUp className="size-4" />
      </button>
      {(trace && trace.size > 1) || canScrub ? (
        <div className={cx("z-20 flex items-center gap-1.5 text-[12px] font-bold text-neutral-200", fill ? "flex-wrap justify-end border-b border-white/10 px-3 py-1.5" : "absolute right-11 top-2")}>
          {trace && trace.size > 1 && (
            <button type="button" data-cuelume-close="" data-cuelume-emphasis="subtle" onClick={onClearSelection} className="rounded-full bg-white/10 px-2.5 py-1 hover:bg-white/16" title="Esc clears the trace">
              Tracing {trace.size} lanes · clear
            </button>
          )}
          {canScrub && replay && (
            <>
              <button type="button" data-cuelume-tap="" onClick={replay.onToggle} aria-label={replay.playing ? "Stop replay" : "Replay the run"} className="flex h-7 items-center gap-1 rounded-full bg-white/10 px-2.5 hover:bg-white/16">
                {replay.playing ? <Square className="size-3" /> : <Play className="size-3" />}
                {replay.playing ? "Stop" : "Replay"}
              </button>
              {([0.5, 1, 2] as const).map((s) => (
                <button key={s} type="button" data-cuelume-select="" aria-pressed={replay.speed === s} onClick={() => replay.onSpeed(s)} className={cx("h-7 rounded-full px-2 tabular-nums", replay.speed === s ? "bg-white text-neutral-950" : "bg-white/8 hover:bg-white/16")}>
                  {s}×
                </button>
              ))}
            </>
          )}
          {scrubMs !== null && (
            <button type="button" data-cuelume-close="" data-cuelume-emphasis="subtle" onClick={() => onScrub?.(null)} className="rounded-full bg-[var(--rb-accent)]/25 px-2.5 py-1 text-[var(--rb-accent)] tabular-nums hover:bg-[var(--rb-accent)]/35">
              {(scrubMs / 1000).toFixed(1)}s · back to the end
            </button>
          )}
        </div>
      ) : null}

      {view.lanes.length === 0 ? (
        <div className="grid flex-1 place-items-center text-[14px] text-neutral-500">The timeline fills as soon as a run starts.</div>
      ) : (
        <div className={cx("flex min-h-0 flex-1 flex-col", fill && "overflow-x-auto")}>
        <div className={cx("flex min-h-0 flex-1 flex-col", fill && "min-w-[780px]")}>
          <div
            ref={bodyRef}
            data-demo="lanes"
            onScroll={(e) => {
              const el = e.currentTarget;
              followLanes.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
            }}
            className="relative min-h-0 flex-1 overflow-y-auto"
          >
            {!planning && !hinted && !selected && view.lanes.length < 4 && view.lanes.some((l) => l.segments.length > 0) && (
              <div className="nb-rise pointer-events-none absolute bottom-2 right-3 z-10 flex items-center gap-1.5 rounded-full border border-white/10 bg-neutral-900/90 px-2.5 py-1 text-[12px] font-bold text-neutral-200 shadow-lg backdrop-blur-md">
                <MousePointerClick className="size-3.5 text-[var(--rb-accent)]" aria-hidden="true" /> Click any step to read what it thought and did
              </div>
            )}
            {planning && (
              <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-neutral-950/80 backdrop-blur-[2px]">
                <div className="flex flex-col items-center gap-1">
                  {/* Z6: 160 px cloud in the timeline header until the crew is spawned */}
                  <div className="nb-pop-slow size-40">
                    <GlowCloud color="blue" background={false} label="Planning the run" />
                  </div>
                  <p className="text-[13px] font-semibold text-neutral-300">Planning the run…</p>
                </div>
              </div>
            )}
            <div className="flex" style={{ height: Math.max(bodyH, 1) }}>
              <div className="shrink-0" style={{ width: LEGEND_W }}>
                {view.lanes.map((l, i) => (
                  <div key={l.instance} style={{ opacity: dim(l.instance) }} className="transition-opacity duration-150">
                    <LegendRow lane={l} index={i} learned={l.instance === "orchestrator" ? view.learned : undefined} runStatus={view.status} />
                  </div>
                ))}
              </div>
              <div ref={chartRef} className="relative min-w-0 flex-1">
                <svg width={cw} height={bodyH} className="block" role="img" aria-label="Agent lanes over time">
                  <defs>
                    {Object.entries(ROLE_COLOR).map(([role, c]) => (
                      <pattern key={role} id={`hatch-${role}`} patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
                        <rect width="7" height="7" fill={c} opacity="0.16" />
                        <line x1="0" y1="0" x2="0" y2="7" stroke={c} strokeWidth="2.5" opacity="0.6" />
                        <animateTransform attributeName="patternTransform" type="translate" additive="sum" from="0 0" to="7 0" dur="1.2s" repeatCount="indefinite" />
                      </pattern>
                    ))}
                  </defs>
                  {view.lanes.map((_, i) => (
                    <rect key={i} x={0} y={i * LANE_H} width={cw} height={LANE_H} fill="white" opacity={i % 2 === 1 ? 0.035 : 0} />
                  ))}
                  {majors.map((t) => (
                    <line key={t} x1={x(t * 1000)} x2={x(t * 1000)} y1={0} y2={bodyH} stroke="white" strokeOpacity={0.09} strokeDasharray="3 4" />
                  ))}

                  {view.connectors.map((c, i) => {
                    const pi = laneIdx.get(c.from);
                    const ci = laneIdx.get(c.to);
                    if (pi === undefined || ci === undefined) return null;
                    const cx0 = x(c.tMs);
                    const y0 = pi * LANE_H + SEG_TOP + SEG_H + 8;
                    const y1 = ci * LANE_H + SEG_TOP + SEG_H / 2;
                    const start = firstSegStart(view.lanes[ci]);
                    const color = ROLE_COLOR[view.lanes[ci].role];
                    return (
                      <g key={i} opacity={trace ? (trace.has(c.from) && trace.has(c.to) ? 1 : 0.15) : 1} className="transition-opacity duration-150">
                        <line className="nb-draw" x1={cx0} x2={cx0} y1={y0} y2={y1} stroke={color} strokeWidth={1.5} strokeDasharray="2 3" />
                        {start !== undefined && x(start) > cx0 + 2 && <line x1={cx0} x2={x(start)} y1={y1} y2={y1} stroke={color} strokeWidth={1.5} strokeDasharray="2 3" />}
                        <circle className="nb-pop" cx={cx0} cy={y0} r={4} fill={color} />
                      </g>
                    );
                  })}

                  {/* the time the crew waited on you, so a long gap explains itself; and where a run you ended stopped */}
                  {waitsForYou(view, tNow).map((w) => {
                    const y = waitLane * LANE_H + SEG_TOP;
                    const x0 = x(w.startMs);
                    const width = Math.max(SEG_H, x(w.endMs) - x0);
                    const text = `waiting for you · ${fmtDur(w.endMs - w.startMs)}`;
                    return (
                      <g key={`wait-${w.startMs}`} aria-label={text}>
                        <rect x={x0} y={y} width={width} height={SEG_H} rx={SEG_H / 2} fill="rgb(251 146 60 / 0.08)" stroke="rgb(251 146 60 / 0.55)" strokeDasharray="4 4" />
                        {width >= text.length * 6.4 + 24 && (
                          <text x={x0 + width / 2} y={y + SEG_H / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill="rgb(253 186 116)">
                            {text}
                          </text>
                        )}
                      </g>
                    );
                  })}
                  {(view.status === "cancelled" || view.status === "stopped") && view.endedMs !== undefined && (
                    // under the lane's segments, ending at the moment it stopped: clear of the replay controls top right
                    <text x={x(view.endedMs)} y={waitLane * LANE_H + SEG_TOP + SEG_H + 14} textAnchor={x(view.endedMs) > 160 ? "end" : "start"} fontSize={11} fontWeight={600} fill="currentColor" opacity={0.6}>
                      {view.status} after {fmtDur(view.endedMs)}
                    </text>
                  )}
                  {view.lanes.map((l, i) =>
                    l.segments.map((s) => {
                      const x0 = x(s.startMs);
                      const end = s.endMs ?? tNow;
                      const w = Math.max(SEG_H, x(end) - x0);
                      const y = i * LANE_H + SEG_TOP;
                      const color = ROLE_COLOR[l.role];
                      const isSel = selected?.instance === s.instance && selected.id === s.id;
                      // SPEC §15: the label starts after the 14 px cap + 8, and is drawn only when it fits with 30 px to spare;
                      // waiting segments label themselves (centered) only at 160 px or wider. The tooltip always has the full text.
                      const labelW = s.label.length * 6.4;
                      const label = s.failed ? "" : s.kind === "wait" ? (w >= Math.max(160, labelW + 24) ? s.label : "") : w >= labelW + 30 ? s.label : "";
                      const routed = s.route && (s.route.chosen !== s.route.ceiling || s.route.fallback);
                      // a pill too short for its label names itself just after the pill, when the lane has room before the next step
                      const nextStart = l.segments.reduce<number | null>((m, o) => (o.startMs > s.startMs && (m === null || o.startMs < m) ? o.startMs : m), null);
                      const room = (nextStart === null ? cw : x(nextStart)) - (x0 + w);
                      const after = !label && !s.failed && s.kind !== "wait" && room >= labelW + 18 ? s.label : "";
                      return (
                        <g
                          key={`${s.instance}:${s.id}`}
                          id={segDomId(s)}
                          opacity={dim(s.instance)}
                          className="group cursor-pointer outline-none transition-opacity duration-150"
                          tabIndex={0}
                          role="button"
                          aria-label={`${laneName(l.instance, l.role)}: ${s.label}${s.failed ? " (failed)" : ""}`}
                          data-cuelume-select=""
                          onClick={() => (dismissHint(), onSelect(s))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") return void (e.preventDefault(), dismissHint(), onSelect(s));
                            const t = neighbour(s, e.key);
                            if (t) {
                              e.preventDefault();
                              onSelect(t);
                              setTimeout(() => document.getElementById(segDomId(t))?.focus(), 0);
                            }
                          }}
                          onMouseMove={(e) => {
                            const r = chartRef.current?.getBoundingClientRect();
                            if (r) setTip({ x: e.clientX - r.left, y: i * LANE_H, text: s.label, sub: `${((end - s.startMs) / 1000).toFixed(1)}s${s.route ? ` · ${TIER_LABEL[s.route.chosen]}` : ""} · click to open` });
                          }}
                          onMouseLeave={() => setTip(null)}
                        >
                          <rect x={x0} y={y} width={w} height={SEG_H} rx={SEG_H / 2} fill="transparent" />
                          <rect
                            x={x0}
                            y={y}
                            width={w}
                            height={SEG_H}
                            rx={SEG_H / 2}
                            fill={s.failed ? "transparent" : s.kind === "wait" ? `url(#hatch-${l.role})` : color}
                            fillOpacity={s.kind === "tool" ? 0.78 : 0.95}
                            stroke={s.failed ? RED : s.kind === "wait" ? color : "none"}
                            strokeWidth={s.failed ? 1.75 : 1}
                            className={cx(!reducedMotion && s.endMs === undefined && "nimbus-seg-live", s.failed && "nb-flash")}
                          />
                          {!isSel && <rect x={x0 - 2.5} y={y - 2.5} width={w + 5} height={SEG_H + 5} rx={(SEG_H + 5) / 2} fill="none" stroke="white" strokeOpacity={0.6} strokeWidth={1.5} className="opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100" />}
                          {isSel && <rect x={x0 - 2.5} y={y - 2.5} width={w + 5} height={SEG_H + 5} rx={(SEG_H + 5) / 2} fill="none" stroke="white" strokeWidth={1.5} />}
                          {s.failed && (
                            <text className="nb-fade-late" x={x0 + w / 2} y={y + SEG_H / 2 + 5} textAnchor="middle" fontSize={14} fontWeight={700} fill={RED}>
                              ✕
                            </text>
                          )}
                          {label && (
                            <text x={s.kind === "wait" ? x0 + w / 2 : x0 + 14 + 8} textAnchor={s.kind === "wait" ? "middle" : "start"} y={y + SEG_H / 2 + 4} fontSize={11} fontWeight={700} fill="oklch(0.2 0.01 285)" className="pointer-events-none select-none">
                              {label}
                            </text>
                          )}
                          {after && (
                            <text x={x0 + w + 8} y={y + SEG_H / 2 + 4} fontSize={11} fontWeight={600} fill="currentColor" opacity={0.7} className="pointer-events-none select-none">
                              {after}
                            </text>
                          )}
                          {routed && (
                            <g className="nb-pop">
                              <circle cx={x0 + 2} cy={y - 1} r={7} fill="var(--color-neutral-100)" stroke="oklch(0.2 0.01 285)" strokeWidth={0.75} />
                              <text x={x0 + 2} y={y + 3} textAnchor="middle" fontSize={10} fontWeight={800} fill="oklch(0.2 0.01 285)" className="pointer-events-none">
                                {s.route?.fallback ? "↻" : "↓"}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    }),
                  )}

                  {/* tool-call ticks: a mark on the lane where each tool was called; hover names it */}
                  {view.toolCalls.map((c) => {
                    const li = laneIdx.get(c.instance);
                    if (li === undefined || ["plan", "spawn_agents", "handoff", "finish"].includes(c.tool)) return null;
                    const tx = x(c.startMs);
                    const ty = li * LANE_H + SEG_TOP + SEG_H + 4;
                    return (
                      <g key={c.callId} opacity={dim(c.instance)} onMouseMove={(e) => { const r = chartRef.current?.getBoundingClientRect(); if (r) setTip({ x: e.clientX - r.left, y: li * LANE_H + SEG_H + 8, text: c.tool, sub: c.ok === false ? "failed" : c.endMs !== undefined ? `${((c.endMs - c.startMs) / 1000).toFixed(1)}s` : "running" }); }} onMouseLeave={() => setTip(null)}>
                        <rect x={tx - 4} y={ty - 2} width={8} height={14} fill="transparent" />
                        <line x1={tx} x2={tx} y1={ty} y2={ty + 8} stroke={c.ok === false ? RED : "white"} strokeOpacity={0.55} strokeWidth={1.5} strokeLinecap="round" />
                      </g>
                    );
                  })}

                  <line x1={x(playT)} x2={x(playT)} y1={0} y2={bodyH} stroke="white" strokeWidth={scrubMs !== null ? 1.75 : 1} />
                </svg>
                {tip && (
                  <div className="pointer-events-none absolute z-30 -translate-x-1/2 rounded-md bg-neutral-100 px-2 py-1 text-[12px] font-semibold text-neutral-900 shadow-lg" style={{ left: Math.min(Math.max(tip.x, 70), cw - 70), top: tip.y - 4 }}>
                    <div className="whitespace-nowrap">{tip.text}</div>
                    <div className="whitespace-nowrap font-medium text-neutral-600 tabular-nums">{tip.sub}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 border-t border-white/10" style={{ height: AXIS_H }}>
            <div className="shrink-0" style={{ width: LEGEND_W }} />
            <svg
              width={cw}
              height={AXIS_H}
              className={cx("block touch-none", canScrub && "cursor-ew-resize")}
              aria-hidden={!canScrub}
              role={canScrub ? "slider" : undefined}
              aria-label={canScrub ? "Scrub the run" : undefined}
              aria-valuemin={canScrub ? 0 : undefined}
              aria-valuemax={canScrub ? Math.round(extent) : undefined}
              aria-valuenow={canScrub ? Math.round(playT) : undefined}
              tabIndex={canScrub ? 0 : undefined}
              onPointerDown={(e) => {
                if (!canScrub) return;
                cue("select", { emphasis: "subtle" }); // once when the scrub starts, not per frame of the drag
                dragging.current = true;
                (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
                scrubFromPointer(e.clientX);
              }}
              onPointerMove={(e) => dragging.current && scrubFromPointer(e.clientX)}
              onPointerUp={() => (dragging.current = false)}
              onKeyDown={(e) => {
                if (!canScrub) return;
                const k = e.key === "ArrowRight" ? 1000 : e.key === "ArrowLeft" ? -1000 : e.key === "End" ? Infinity : e.key === "Home" ? -Infinity : 0;
                if (k) (e.preventDefault(), onScrub?.(Math.round(Math.min(extent, Math.max(0, playT + k)))));
              }}
            >
              {minors.map((t) => (
                <line key={`m${t}`} x1={x(t * 1000)} x2={x(t * 1000)} y1={0} y2={4} stroke="white" strokeOpacity={0.4} />
              ))}
              {majors.map((t, i) => {
                const text = fmtTick(t);
                const px = x(t * 1000);
                // always label 0; drop a label whose text would cross the plot's right edge
                if (i > 0 && px + (text.length * 6.4) / 2 > plotW - 2) return null;
                return (
                  <g key={t}>
                    <line x1={px} x2={px} y1={0} y2={6} stroke="white" strokeOpacity={0.5} />
                    <text x={px} y={20} textAnchor="middle" fontSize={11} fontWeight={600} fill="currentColor" opacity={0.6} style={{ fontVariantNumeric: "tabular-nums" }}>
                      {text}
                    </text>
                  </g>
                );
              })}
              <circle cx={x(playT)} cy={6} r={canScrub ? 6 : 5} fill="var(--color-neutral-950)" stroke="white" strokeWidth={1.75} />
            </svg>
          </div>
        </div>
        </div>
      )}
    </section>
  );
}

function LegendRow({ lane, index, learned, runStatus }: { lane: Lane; index: number; learned?: { memories: number; policies: number }; runStatus: RunView["status"] }) {
  // One badge with the full model name; a ↓ (routed below ceiling) or ↻ (fell back) glyph sits inside it. Hover has the story.
  const glyph = lane.routed ? (lane.fellBack ? "↻" : "↓") : null;
  const hover = lane.routed
    ? `${lane.fellBack ? "Fell back" : "Routed below ceiling"}: ${TIER_SHORT[lane.ceiling]} → ${TIER_SHORT[lane.tier]}${lane.routeReason ? ` · ${lane.routeReason}` : ""}`
    : `${TIER_LABEL[lane.tier]} (this role's ceiling)`;
  return (
    <div className={cx("flex flex-col justify-center gap-0.5 px-4", index % 2 === 1 && "bg-white/[0.035]")} style={{ height: LANE_H }}>
      <div className="flex items-center gap-2">
        <span className="size-2 shrink-0 rounded-full" style={{ background: ROLE_COLOR[lane.role] }} />
        <span className="min-w-0 truncate text-[14px] font-bold text-neutral-100">{laneName(lane.instance, lane.role)}</span>
        {lane.status === "running" && <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400 motion-reduce:animate-none" aria-label="running" />}
        {learned && (learned.memories > 0 || learned.policies > 0) && (
          <span
            data-demo="learned-chip"
            className="nb-pop-slow ms-auto shrink-0 whitespace-nowrap rounded-full bg-[color-mix(in_oklab,var(--rb-accent)_22%,transparent)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--rb-accent)]"
            title={`This run started with what earlier runs taught it: ${learned.memories} memories in its prompt and ${learned.policies} policy line${learned.policies === 1 ? "" : "s"} from SKILL.md.`}
          >
            ✦ learned · {learned.memories} mem{learned.policies ? ` · ${learned.policies} rule` : ""}
          </span>
        )}
      </div>
      <div className="ps-4">
        <span title={hover} data-demo="model-badge" className="inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-md bg-white/8 py-0.5 pe-2 ps-0.5 text-[12px] font-semibold text-neutral-300">
          <span className="grid size-4 shrink-0 place-items-center rounded-[4px] bg-[#76b900] text-[9px] font-black leading-none text-black" aria-hidden="true">
            N
          </span>
          {glyph && (
            <span className="font-extrabold text-neutral-50" aria-label={lane.fellBack ? "fell back" : "routed below ceiling"}>
              {glyph}
            </span>
          )}
          {TIER_LABEL[lane.tier]}
        </span>
      </div>
      <p className="ps-4 text-[11px] font-semibold tabular-nums text-neutral-500">{lane.tokens ? `${fmtTokens(lane.tokens)} tok · ${fmtCost3(lane.costUsd)}` : laneState(lane, runStatus)}</p>
    </div>
  );
}

/** "45s", "1m 30s", "1h 50m": axis labels and waits past a minute read as durations, not clock times. */
function fmtTick(t: number): string {
  if (t < 60) return `${t}s`;
  if (t < 3600) return t % 60 ? `${Math.floor(t / 60)}m ${t % 60}s` : `${t / 60}m`;
  const m = Math.floor((t % 3600) / 60);
  return m ? `${Math.floor(t / 3600)}h ${m}m` : `${t / 3600}h`;
}
function fmtDur(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)} s`;
  if (ms < 3_600_000) return fmtTick(Math.round(ms / 1000));
  return fmtTick(Math.round(ms / 60_000) * 60); // past an hour, to the minute
}

/** Stretches of at least 30 s when the run waited on the person (the draft plan, approvals), overlapping ones merged. */
function waitsForYou(view: RunView, tNow: number): { startMs: number; endMs: number }[] {
  const end = view.endedMs ?? tNow;
  const spans: [number, number][] = [];
  for (const i of view.transcript) {
    if (i.t === "plan" && (i.awaiting || i.approvedMs !== undefined)) spans.push([i.tMs, i.approvedMs ?? end]);
    if (i.t === "approval" && i.by !== "policy" && i.by !== "mode") spans.push([i.tMs, i.resolvedMs ?? end]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const sp of spans) {
    const last = merged[merged.length - 1];
    if (last && sp[0] <= last[1]) last[1] = Math.max(last[1], sp[1]);
    else merged.push([...sp]);
  }
  return merged.filter(([a, b]) => b - a >= 30_000).map(([startMs, endMs]) => ({ startMs, endMs }));
}

/** A lane with no model calls says what it is doing instead of a bare dash. */
function laneState(lane: Lane, runStatus: RunView["status"]): string {
  if (lane.status === "error") return "failed";
  if (runStatus === "cancelled" || runStatus === "stopped") return runStatus;
  if (runStatus === "waiting" || runStatus === "asked" || (runStatus === "planning" && lane.status !== "running")) return "waiting";
  if (lane.status === "pending") return "waiting";
  if (lane.status === "running") return "starting";
  return "no model calls";
}
