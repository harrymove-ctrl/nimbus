// Scatter Bloom (board rev D, scene 14), our own build: one point per model call from the
// dev database (src/datasets/calls.json, exported from data/nimbus.db by
// scripts/export-calls.py: real rows, nothing invented). x = the minute of the day it
// ran, y = its cost (log), colour = its tier (the Overview's). The points bloom onto a tilted
// plane in time order while the camera drifts; the proof tiles land on it from bar 3.
import { AbsoluteFill, Easing, useCurrentFrame, useVideoConfig } from "remotion";
import { ramp } from "../components/CloudMark";
import DATA from "../datasets/calls.json";
import { C, GROUND, MANROPE, TIER } from "../theme";

const PLANE = { w: 1800, h: 900 };
const DAY = { from: 6 * 60, to: 23 * 60 }; // 06:00–23:00, the hours the runs fall in
const COST = { lo: Math.log10(4e-5), hi: Math.log10(2e-2) };
const BLOOM = { from: 2, len: 64 };

type Call = { min: number; tier: string; usd: number };
const CALLS = (DATA.calls as Call[]).map((c, i) => {
  const u = (c.min - DAY.from) / (DAY.to - DAY.from);
  const v = (Math.log10(c.usd) - COST.lo) / (COST.hi - COST.lo);
  // a fixed sub-pixel spread from the row index (no randomness), so calls in the same minute
  // and at the same price do not sit exactly on top of each other
  const jitter = ((i * 7919) % 97) / 97 - 0.5;
  return { x: u * PLANE.w, y: (1 - v) * PLANE.h + jitter * 10, tier: c.tier as keyof typeof TIER, at: BLOOM.from + u * BLOOM.len };
});
const TICKS = [8, 12, 16, 20].map((h) => ({ label: `${String(h).padStart(2, "0")}:00`, x: ((h * 60 - DAY.from) / (DAY.to - DAY.from)) * PLANE.w }));

/** `dimFrom`: the frame the tiles start landing; the plane dims a little under them. */
export function ScatterBloom({ dimFrom }: { dimFrom: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  // the camera swings onto the plane over the first bar, then keeps drifting
  const swing = ramp(frame, 0, 60, 0, 1, Easing.out(Easing.cubic));
  const tilt = 68 - 14 * swing - ramp(frame, 60, durationInFrames, 0, 6);
  const spin = -16 + 14 * swing + ramp(frame, 60, durationInFrames, 0, 5);
  const zoom = 0.8 + 0.18 * swing + ramp(frame, 60, durationInFrames, 0, 0.08);
  const dim = 1 - 0.6 * ramp(frame, dimFrom, dimFrom + 20);
  return (
    <AbsoluteFill style={{ background: GROUND, perspective: 1600, perspectiveOrigin: "50% 20%" }}>
      <div
        style={{
          position: "absolute",
          left: 960 - PLANE.w / 2,
          top: 400 - PLANE.h / 2,
          width: PLANE.w,
          height: PLANE.h,
          transform: `scale(${zoom}) rotateX(${tilt}deg) rotateZ(${spin}deg)`,
          opacity: dim,
        }}
      >
        <svg width={PLANE.w} height={PLANE.h} style={{ overflow: "visible" }}>
          <rect x={0} y={0} width={PLANE.w} height={PLANE.h} fill="none" stroke="rgba(255, 255, 255, 0.1)" strokeDasharray="6 10" opacity={ramp(frame, 0, 12)} />
          {TICKS.map((t) => (
            <g key={t.label} opacity={ramp(frame, 0, 12)}>
              <line x1={t.x} y1={0} x2={t.x} y2={PLANE.h} stroke="rgba(255, 255, 255, 0.07)" />
              <text x={t.x} y={PLANE.h + 44} fill={C.muted} fontFamily={MANROPE} fontSize={30} fontWeight={600} textAnchor="middle">
                {t.label}
              </text>
            </g>
          ))}
          {CALLS.map((c, i) => {
            const p = ramp(frame, c.at, c.at + 8, 0, 1, Easing.out(Easing.back(2.2)));
            if (p <= 0) return null;
            return <circle key={i} cx={c.x} cy={c.y} r={7 * p} fill={TIER[c.tier]} opacity={0.85} />;
          })}
        </svg>
      </div>
      <div style={{ position: "absolute", left: 64, top: 56, fontFamily: MANROPE, fontSize: 30, fontWeight: 600, color: C.muted, opacity: ramp(frame, 20, 30) * dim }}>
        <span style={{ color: C.ink }}>{DATA.calls.length.toLocaleString("en-US")}</span> model calls from {DATA.runs} runs · time of day × cost
      </div>
    </AbsoluteFill>
  );
}
