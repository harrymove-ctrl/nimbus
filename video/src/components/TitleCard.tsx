// Scene 2: the title on neutral-950 with the app's dither glow, three lines on the beat.
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, DITHER_GLOW, MANROPE } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export type TitleLine = { text: string; at: number; size: number; weight: number; color: string };

export function TitleCard({ lines }: { lines: TitleLine[] }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const drift = interpolate(frame, [0, durationInFrames], [1, 1.04], clamp);
  return (
    <AbsoluteFill style={{ background: C.bg, backgroundImage: DITHER_GLOW, fontFamily: MANROPE, alignItems: "center", justifyContent: "center" }}>
      <div style={{ transform: `scale(${drift})`, textAlign: "center", display: "flex", flexDirection: "column", gap: 22 }}>
        {lines.map((l) => {
          const p = interpolate(frame, [l.at, l.at + 8], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
          return (
            <div key={l.text} style={{ fontSize: l.size, fontWeight: l.weight, color: l.color, letterSpacing: "-0.02em", opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}>
              {l.text}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
