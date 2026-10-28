// Focus Pull (board rev D, chapter 3), our own build: over a slow field from the app's dither
// glow (mint and the Ultra blue, low), "It remembers." then "It gets better every run." Each
// line arrives from the right, oversized and soft, and pulls into focus a glyph at a time;
// the second resolves over the first. Plain white ink.
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { ramp } from "../components/CloudMark";
import { bars } from "../grid";
import { C, MANROPE, TIER } from "../theme";

const LINES = [
  { text: "It remembers.", at: 0 },
  { text: "It gets better every run.", at: bars(1) },
];
const out = Easing.out(Easing.cubic);
const GLYPH = 1.6; // frames between one glyph starting to focus and the next
const FOCUS = 16; // frames a glyph takes from soft to sharp

function Line({ text, at, frame, leaveAt }: { text: string; at: number; frame: number; leaveAt?: number }) {
  const f = frame - at;
  const travel = ramp(f, 0, 30, 1, 0, out);
  const leave = leaveAt === undefined ? 0 : ramp(frame, leaveAt, leaveAt + 14);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `translateX(${travel * 320}px) scale(${1 + travel * 0.5 - leave * 0.06})`,
        opacity: 1 - leave,
        filter: leave > 0 ? `blur(${leave * 22}px)` : undefined,
      }}
    >
      <div style={{ fontFamily: MANROPE, fontSize: 124, fontWeight: 700, color: "#ffffff", letterSpacing: "-0.03em", whiteSpace: "pre" }}>
        {[...text].map((ch, i) => {
          const p = ramp(f, i * GLYPH, i * GLYPH + FOCUS, 0, 1, out);
          return (
            <span key={i} style={{ display: "inline-block", opacity: 0.15 + 0.85 * p, filter: p < 1 ? `blur(${(1 - p) * 26}px)` : undefined }}>
              {ch}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function FocusPull() {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const glow = (color: string, x: number, y: number, a: number) =>
    `radial-gradient(ellipse 38% 48% at ${x}% ${y}%, color-mix(in oklch, ${color} ${a}%, transparent), transparent 70%)`;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill
        style={{
          backgroundImage: [
            glow(C.mint, 30 + 8 * Math.sin(t * 0.7), 60 + 6 * Math.cos(t * 0.5), 16),
            glow(TIER.ultra, 70 - 8 * Math.sin(t * 0.6), 40 + 6 * Math.sin(t * 0.8), 14),
          ].join(", "),
        }}
      />
      {/* the app's 3 px dither cells over the field */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, oklch(1 0 0 / 3%) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, oklch(1 0 0 / 3%) 0 1px, transparent 1px 3px)",
        }}
      />
      <Line text={LINES[0].text} at={LINES[0].at} frame={frame} leaveAt={LINES[1].at} />
      {frame >= LINES[1].at ? <Line text={LINES[1].text} at={LINES[1].at} frame={frame} /> : null}
    </AbsoluteFill>
  );
}
