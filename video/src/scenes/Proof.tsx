// Scene 19 "How we used Nebius" (count-grid, adapted: its rush-and-settle on the three model
// tiles, then a counter). The tiles land on Scatter Bloom's plane one per beat from bar 2, so
// the scene is transparent. The count and cost are the call log's (src/datasets/calls.json).
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import DATA from "../datasets/calls.json";
import { beats, bars } from "../grid";
import { C, MANROPE, MONO, TIER } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const TIERS = [
  { id: "Nemotron-3-Ultra-550b-a55b", role: "plans", color: TIER.ultra },
  { id: "nemotron-3-super-120b-a12b", role: "reads, writes, researches", color: TIER.super },
  { id: "NVIDIA-Nemotron-3-Nano-30B-A3B", role: "checks, learns", color: TIER.nano },
];
const CALLS = DATA.calls.length;
const SPEND = DATA.calls.reduce((n, c) => n + c.usd, 0);

/** Tiles rush in one per beat from bar 2 (over the plane); the endpoint line and its numbers on bar 3. */
export const PROOF = { tiles: [bars(1), bars(1) + beats(1), bars(1) + beats(2)], line: bars(2), count: bars(2) + 4 };

export function Proof() {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const push = interpolate(frame, [0, durationInFrames], [1, 1.04], clamp);
  const n = interpolate(frame, [PROOF.count, PROOF.count + beats(3)], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const line = (at: number) => ({ opacity: interpolate(frame, [at, at + 8], [0, 1], clamp), transform: `translateY(${interpolate(frame, [at, at + 10], [14, 0], { ...clamp, easing: Easing.out(Easing.cubic) })}px)` });
  return (
    <AbsoluteFill style={{ fontFamily: MANROPE, color: C.ink }}>
      <AbsoluteFill style={{ transform: `scale(${push})`, alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", gap: 30 }}>
          {TIERS.map((t, i) => {
            const s = spring({ frame: frame - PROOF.tiles[i], fps, config: { damping: 15, stiffness: 130, mass: 0.8 } });
            const smear = Math.min(22, Math.abs(1 - s) * 50);
            return (
              <div
                key={t.id}
                style={{
                  width: 540,
                  height: 220,
                  padding: "32px 36px",
                  borderRadius: 22,
                  background: C.card,
                  border: `1px solid ${C.line}`,
                  boxShadow: `inset 0 3px 0 ${t.color}`,
                  transform: `translateX(${(1 - s) * 900}px)`,
                  filter: smear > 0.5 ? `blur(${smear}px)` : undefined,
                  opacity: frame < PROOF.tiles[i] ? 0 : 1,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-0.02em" }}>{t.role}</div>
                <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 600, color: t.color }}>{t.id}</div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 52, fontSize: 40, fontWeight: 700, ...line(PROOF.line) }}>
          Nebius Token Factory <span style={{ color: C.muted, fontWeight: 600 }}>· one endpoint ·</span> <span style={{ fontFamily: MONO, fontWeight: 600 }}>api.tokenfactory.nebius.com</span>
        </div>
        <div style={{ marginTop: 18, fontSize: 40, fontWeight: 600, color: C.muted, fontVariantNumeric: "tabular-nums", ...line(PROOF.count) }}>
          <span style={{ color: C.ink, fontWeight: 700 }}>{Math.round(CALLS * n).toLocaleString("en-US")}</span> calls ·{" "}
          <span style={{ color: C.ink, fontWeight: 700 }}>${(SPEND * n).toFixed(2)}</span> this week
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
