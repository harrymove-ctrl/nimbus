// Metric Morph (board rev D, scene 8), our own build: the "Approve & always allow" pill from
// scene 7 settles, its label dissolves, it collapses into a square that runs neutral-900 →
// mint and slams in as the tallest bar of the run's cost chart; the chart rises around it as
// one object. The bars are the take's run, hop by hop (src/datasets/run-hops.json, the $0.024
// run on screen in scene 10), so the tallest bar is the real first hop (Ultra plans).
import { AbsoluteFill, Easing, interpolateColors, useCurrentFrame } from "remotion";
import { ramp } from "../components/CloudMark";
import RUN from "../datasets/run-hops.json";
import { C, GROUND, MANROPE, TIER } from "../theme";

const out = Easing.out(Easing.cubic);
const accel = Easing.in(Easing.cubic);
const BAR = { w: 56, gap: 16, base: 830, max: 540 };
const N = RUN.hops.length;
const LEFT = 960 - (N * (BAR.w + BAR.gap) - BAR.gap) / 2;
const TOP = Math.max(...RUN.hops.map((h) => h.usd));
const tallest = RUN.hops.findIndex((h) => h.usd === TOP);
const height = (usd: number) => Math.max(6, (usd / TOP) * BAR.max);

export const MORPH = { dissolve: 8, collapse: 12, slam: 34, rise: 30 };

export function MetricMorph() {
  const frame = useCurrentFrame();
  const settle = ramp(frame, 0, 8, 1.08, 1, out);
  const label = 1 - ramp(frame, MORPH.dissolve, MORPH.dissolve + 8);
  const collapse = ramp(frame, MORPH.collapse, MORPH.collapse + 14, 0, 1, Easing.inOut(Easing.cubic));
  const tint = ramp(frame, 16, 30);
  const slam = ramp(frame, 24, MORPH.slam, 0, 1, accel);
  const squash = frame >= MORPH.slam ? 1 - 0.08 * Math.exp(-(frame - MORPH.slam) / 3) * Math.cos((frame - MORPH.slam) * 0.9) : 1;
  // the pill (560 × 96, a capsule) → a 120 px square at the centre → the tallest bar
  const pill = { w: 560, h: 96 };
  const sq = 120;
  const barX = LEFT + tallest * (BAR.w + BAR.gap);
  const barH = height(TOP);
  const w0 = pill.w + (sq - pill.w) * collapse;
  const h0 = pill.h + (sq - pill.h) * collapse;
  const w = w0 + (BAR.w - w0) * slam;
  const h = (h0 + (barH - h0) * slam) * squash;
  const cx = 960 + (barX + BAR.w / 2 - 960) * slam;
  const bottom = 540 + h0 / 2 + (BAR.base - (540 + h0 / 2)) * slam;
  const radius = 999 * (1 - collapse) + 14 * collapse - 8 * slam;
  const push = ramp(frame, 0, 60, 1, 1.04);
  return (
    <AbsoluteFill style={{ background: GROUND, fontFamily: MANROPE }}>
      <AbsoluteFill style={{ transform: `scale(${push})` }}>
        {/* the chart rises around the slammed bar */}
        <div style={{ position: "absolute", left: LEFT - 30, width: N * (BAR.w + BAR.gap) + 44, top: BAR.base, height: 2, background: C.line, opacity: ramp(frame, MORPH.rise - 4, MORPH.rise + 4) }} />
        {RUN.hops.map((hop, i) => {
          if (i === tallest) return null;
          const grow = ramp(frame, MORPH.rise + Math.abs(i - tallest), MORPH.rise + Math.abs(i - tallest) + 10, 0, 1, out);
          const hh = height(hop.usd) * grow;
          return (
            <div key={i} style={{ position: "absolute", left: LEFT + i * (BAR.w + BAR.gap), width: BAR.w, top: BAR.base - hh, height: hh, borderRadius: 8, background: C.raised, boxShadow: `inset 0 3px 0 ${TIER[hop.tier as keyof typeof TIER]}` }} />
          );
        })}
        {/* the pill → square → bar */}
        <div
          style={{
            position: "absolute",
            left: cx - w / 2,
            width: w,
            top: bottom - h,
            height: h,
            borderRadius: Math.max(6, radius),
            background: interpolateColors(tint, [0, 1], [C.raised, C.mint]),
            border: `1px solid ${interpolateColors(tint, [0, 1], [C.line, C.mint])}`,
            transform: `scale(${settle})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <span style={{ fontSize: 40, fontWeight: 600, color: C.ink, whiteSpace: "nowrap", opacity: label, filter: `blur(${(1 - label) * 8}px)` }}>Approve &amp; always allow</span>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: BAR.base + 34, textAlign: "center", fontSize: 34, fontWeight: 600, color: C.muted, opacity: ramp(frame, MORPH.rise + 8, MORPH.rise + 16) }}>
          <span style={{ color: C.ink }}>${RUN.total.toFixed(3)}</span> · {N} model calls
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
