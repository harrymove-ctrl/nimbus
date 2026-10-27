"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { GlowCloud } from "@/components/glow-cloud";
import { ROLE_COLOR, TIER_LABEL, TIER_SHORT, fmtCost3, fmtTokens, laneName, type Lane, type RunView, type Seg } from "@/lib/run-view";
import { useTween } from "@/hooks/use-tween";
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

type Props = {
  view: RunView;
  now: number;
  selected: SegRef | null;
  onSelect: (s: Seg) => void;
  collapsed: boolean;
  onToggle: () => void;
  reducedMotion: boolean;
};

export function Timeline({ view, now, selected, onSelect, collapsed, onToggle, reducedMotion }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const followLanes = useRef(true);
  const [cw, setCw] = useState(640);
  const [tip, setTip] = useState<{ x: number; y: number; text: string; sub: string } | null>(null);

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
  const playT = view.endedMs ?? tNow;
  const laneIdx = useMemo(() => new Map(view.lanes.map((l, i) => [l.instance, i])), [view.lanes]);
  const firstSegStart = (l?: Lane) => (l && l.segments.length ? Math.min(...l.segments.map((s) => s.startMs)) : undefined);

  const planning = view.status === "planning";
  const bodyH = view.lanes.length * LANE_H;
  // Major tick step: the smallest of these with step × pxPerSec ≥ 80 px, so labels can never pile up (SPEC §15).
  const STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300];
  const step = STEPS.find((st) => st * ((plotW - 24) / targetWindowS) >= 80) ?? 300;
  const visibleS = (plotW - 12) / pxPerSec;
  const majors: number[] = [];
  for (let t = 0; t <= visibleS; t += step) majors.push(t);
  const minors: number[] = [];
  if (step >= 10) for (let t = step / 5; t <= visibleS; t += step / 5) if (t % step !== 0) minors.push(t);
  const fmtTick = (t: number) => (t < 60 ? `${t}s` : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`);

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
        <button type="button" onClick={onToggle} aria-label="Expand timeline" aria-expanded={false} className="grid size-8 place-items-center rounded-md text-neutral-300 hover:bg-white/10">
          <ChevronDown className="size-4" />
        </button>
      </section>
    );
  }

  return (
    <section aria-label="Run timeline" className="relative flex h-[240px] shrink-0 flex-col border-b border-white/10">
      <button type="button" onClick={onToggle} aria-label="Collapse timeline" aria-expanded className="absolute right-2 top-2 z-20 grid size-7 place-items-center rounded-md text-neutral-400 hover:bg-white/10 hover:text-neutral-100">
        <ChevronUp className="size-4" />
      </button>

      {view.lanes.length === 0 ? (
        <div className="grid flex-1 place-items-center text-[14px] text-neutral-500">The timeline fills as soon as a run starts.</div>
      ) : (
        <>
          <div
            ref={bodyRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              followLanes.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
            }}
            className="relative min-h-0 flex-1 overflow-y-auto"
          >
            {planning && (
              <div className="absolute inset-0 z-10 grid place-items-center bg-neutral-950/80 backdrop-blur-[2px]">
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
                  <LegendRow key={l.instance} lane={l} index={i} learned={l.instance === "orchestrator" ? view.learned : undefined} />
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
                      <g key={i}>
                        <line className="nb-draw" x1={cx0} x2={cx0} y1={y0} y2={y1} stroke={color} strokeWidth={1.5} strokeDasharray="2 3" />
                        {start !== undefined && x(start) > cx0 + 2 && <line x1={cx0} x2={x(start)} y1={y1} y2={y1} stroke={color} strokeWidth={1.5} strokeDasharray="2 3" />}
                        <circle className="nb-pop" cx={cx0} cy={y0} r={4} fill={color} />
                      </g>
                    );
                  })}

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
                      return (
                        <g
                          key={`${s.instance}:${s.id}`}
                          className="cursor-pointer outline-none"
                          tabIndex={0}
                          role="button"
                          aria-label={`${laneName(l.instance, l.role)}: ${s.label}${s.failed ? " (failed)" : ""}`}
                          onClick={() => onSelect(s)}
                          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(s)}
                          onMouseMove={(e) => {
                            const r = chartRef.current?.getBoundingClientRect();
                            if (r) setTip({ x: e.clientX - r.left, y: i * LANE_H, text: s.label, sub: `${((end - s.startMs) / 1000).toFixed(1)}s${s.route ? ` · ${TIER_LABEL[s.route.chosen]}` : ""}` });
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

                  <line x1={x(playT)} x2={x(playT)} y1={0} y2={bodyH} stroke="white" strokeWidth={1} />
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
            <svg width={cw} height={AXIS_H} className="block" aria-hidden="true">
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
              <circle cx={x(playT)} cy={6} r={5} fill="var(--color-neutral-950)" stroke="white" strokeWidth={1.75} />
            </svg>
          </div>
        </>
      )}
    </section>
  );
}

function LegendRow({ lane, index, learned }: { lane: Lane; index: number; learned?: { memories: number; policies: number } }) {
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
            className="nb-pop-slow ms-auto shrink-0 whitespace-nowrap rounded-full bg-[color-mix(in_oklab,var(--rb-accent)_22%,transparent)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--rb-accent)]"
            title={`This run started with what earlier runs taught it: ${learned.memories} memories in its prompt and ${learned.policies} policy line${learned.policies === 1 ? "" : "s"} from SKILL.md.`}
          >
            ✦ learned · {learned.memories} mem{learned.policies ? ` · ${learned.policies} rule` : ""}
          </span>
        )}
      </div>
      <div className="ps-4">
        <span title={hover} className="inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-md bg-white/8 py-0.5 pe-2 ps-0.5 text-[12px] font-semibold text-neutral-300">
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
      <p className="ps-4 text-[11px] font-semibold tabular-nums text-neutral-500">{lane.tokens ? `${fmtTokens(lane.tokens)} tok · ${fmtCost3(lane.costUsd)}` : "—"}</p>
    </div>
  );
}
