// Scene 14 (count-grid, adapted: its rush-and-settle on three tier tiles, then counters) and
// the old end card. Rev D: the tiles land on Scatter Bloom's plane from bar 3, so the scene
// is transparent and its clock starts two bars in.
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { MockTag } from "../components/cards";
import { beats, bars } from "../grid";
import { NUMBERS } from "../numbers";
import { C, MANROPE, MONO, TIER } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const TIERS = [
  { name: "Nemotron 3 Ultra", id: "nvidia/Nemotron-3-Ultra-550b-a55b", role: "plans", color: TIER.ultra },
  { name: "Nemotron 3 Super", id: "nvidia/nemotron-3-super-120b-a12b", role: "does the work", color: TIER.super },
  { name: "Nemotron 3 Nano", id: "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B", role: "checks", color: TIER.nano },
];

/** Tiles rush in one per beat from bar 3 (over the plane); the number counts up over 2 beats. */
export const PROOF = { tiles: [bars(2), bars(2) + beats(1), bars(2) + beats(2)], factory: bars(2) + beats(3), counts: [bars(3)] };

export function Proof() {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const push = interpolate(frame, [0, durationInFrames], [1, 1.05], clamp);
  const stats = [
    {
      at: PROOF.counts[0],
      to: NUMBERS.checksPassed,
      fmt: (n: number) => `${Math.round(n)}/${NUMBERS.checksTotal}`,
      label: "trajectory evals pass · MIT",
    },
  ];
  return (
    <AbsoluteFill style={{ fontFamily: MANROPE, color: C.ink }}>
      <AbsoluteFill style={{ transform: `scale(${push})`, alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", gap: 32 }}>
          {TIERS.map((t, i) => {
            const s = spring({ frame: frame - PROOF.tiles[i], fps, config: { damping: 15, stiffness: 130, mass: 0.8 } });
            const smear = Math.min(22, Math.abs(1 - s) * 50);
            return (
              <div
                key={t.name}
                style={{
                  width: 520,
                  height: 250,
                  padding: "34px 38px",
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
                <div style={{ fontSize: 24, fontWeight: 700, color: t.color, textTransform: "uppercase", letterSpacing: "0.03em" }}>{t.role}</div>
                <div>
                  <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.02em" }}>{t.name}</div>
                  <div style={{ fontFamily: MONO, fontSize: 19, color: C.muted, marginTop: 8 }}>{t.id}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 30, fontSize: 40, fontWeight: 700, color: C.mint, opacity: interpolate(frame, [PROOF.factory, PROOF.factory + 8], [0, 1], clamp) }}>
          Nebius Token Factory
        </div>
        <div style={{ display: "flex", gap: 140, marginTop: 64 }}>
          {stats.map((st) => {
            const p = interpolate(frame, [st.at, st.at + beats(2)], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
            return (
              <div key={st.label} style={{ textAlign: "center", opacity: interpolate(frame, [st.at - 4, st.at + 4], [0, 1], clamp) }}>
                <div style={{ fontSize: 110, fontWeight: 800, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{st.fmt(st.to * p)}</div>
                <div style={{ fontSize: 30, color: C.muted, fontWeight: 600 }}>{st.label}</div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <MockTag />
    </AbsoluteFill>
  );
}

/** The end card: held still on purpose (board: 3 bars, the only allowed hold). */
export function EndCard() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, durationInFrames: 10, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: MANROPE, color: C.ink, alignItems: "center", justifyContent: "center" }}>
      <div style={{ opacity: s, textAlign: "center" }}>
        <div style={{ fontSize: 128, fontWeight: 800, letterSpacing: "-0.04em" }}>
          Nimbus<span style={{ color: C.mint }}>.</span>
        </div>
        <div style={{ fontSize: 50, fontWeight: 700, marginTop: 20 }}>github.com/harrymove-ctrl/nimbus</div>
        <div
          style={{
            display: "inline-block",
            marginTop: 30,
            fontFamily: MONO,
            fontSize: 40,
            color: C.mint,
            background: C.card,
            border: `1px solid ${C.line}`,
            borderRadius: 14,
            padding: "12px 28px",
          }}
        >
          pnpm dev
        </div>
      </div>
    </AbsoluteFill>
  );
}
