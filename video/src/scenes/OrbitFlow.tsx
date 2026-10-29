// Orbit Flow (board rev D, chapter 4), our own build, dark: three dashed orbits round
// "Always on, wherever you are". Three stops ride the inner orbit as pills with a role-colour
// half-dot; on the last beat the inner orbit winds up to a blur and whips into the phone stack.
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { ramp } from "../components/CloudMark";
import { beats } from "../grid";
import { C, GROUND, MANROPE, ROLE } from "../theme";

// The inner orbit clears the title: wherever a pill (≈ 350 × 62) is level with the two lines
// (≈ 835 × 211), it is at least 640 px from centre, past the text's 418 + the pill's 175.
const ORBITS = [740, 920, 1100];
const TILT = 0.4; // ry / rx: the orbits lie on a tilted plane
const STOPS = [
  { label: "08:00 SCHEDULE", color: ROLE.researcher, at: 0 },
  { label: "CHAT APP", color: ROLE.writer, at: (2 * Math.PI) / 3 },
  { label: "ONE HISTORY", color: ROLE.checker, at: (4 * Math.PI) / 3 },
];
export const ORBIT = { windUp: beats(7), whip: beats(8) - 6 };

/** The inner orbit's angle: a steady drift, then the wind-up on the last beat. */
function angle(f: number) {
  const base = (f / 30) * 1.1;
  const w = Math.max(0, f - ORBIT.windUp);
  return base + 0.0045 * w * w * w * 0.1 + 0.02 * w * w;
}

function Pill({ label, color, x, y, depth, blur, show }: { label: string; color: string; x: number; y: number; depth: number; blur: number; show: number }) {
  const s = (0.82 + 0.18 * depth) * (0.7 + 0.3 * show);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${s})`,
        opacity: show * (0.55 + 0.45 * depth),
        filter: blur > 0.5 ? `blur(${blur}px)` : undefined,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 26px",
        borderRadius: 999,
        background: C.card,
        border: `1px solid ${C.line}`,
        boxShadow: "0 16px 40px oklch(0 0 0 / 45%)",
        fontFamily: MANROPE,
        fontSize: 28,
        fontWeight: 600,
        letterSpacing: "0.06em",
        color: C.ink,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 16, height: 16, borderRadius: 8, border: `2px solid ${color}`, background: `linear-gradient(90deg, ${color} 50%, transparent 50%)` }} />
      {label}
    </div>
  );
}

export function OrbitFlow() {
  const frame = useCurrentFrame();
  const a = angle(frame);
  const speed = angle(frame + 1) - a;
  const blur = Math.min(26, Math.max(0, (speed - 0.03) * 160));
  const whip = ramp(frame, ORBIT.whip, ORBIT.whip + 6, 0, 1, Easing.in(Easing.cubic));
  const draw = ramp(frame, 0, 20, 0, 1, Easing.out(Easing.cubic));
  const pills = STOPS.map((s, i) => {
    const th = a + s.at;
    const rx = ORBITS[0];
    return { ...s, th, x: 960 + Math.cos(th) * rx, y: 540 + Math.sin(th) * rx * TILT, depth: (Math.sin(th) + 1) / 2, show: ramp(frame, 8 + i * 4, 18 + i * 4) };
  });
  const back = pills.filter((p) => p.depth < 0.5);
  const front = pills.filter((p) => p.depth >= 0.5);
  return (
    <AbsoluteFill style={{ background: GROUND }}>
      <AbsoluteFill style={{ transform: `translateX(${-whip * 700}px) scale(${ramp(frame, 0, ORBIT.whip, 0.94, 1.02)}) rotate(${ramp(frame, 0, ORBIT.whip, -3, 2)}deg)`, filter: whip > 0 ? `blur(${whip * 30}px)` : undefined }}>
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          {ORBITS.map((rx, i) => (
            <ellipse
              key={rx}
              cx={960}
              cy={540}
              rx={rx * (0.92 + 0.08 * draw)}
              ry={rx * TILT * (0.92 + 0.08 * draw)}
              fill="none"
              stroke={i === 0 ? "rgba(255, 255, 255, 0.22)" : "rgba(255, 255, 255, 0.11)"}
              strokeWidth={i === 0 ? 2 : 1.5}
              strokeDasharray="6 12"
              strokeDashoffset={-frame * (i === 0 ? 1.2 + speed * 400 : 0.6 / (i + 1))}
              opacity={draw}
            />
          ))}
        </svg>
        {back.map((p) => (
          <Pill key={p.label} {...p} blur={blur} />
        ))}
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: MANROPE, opacity: ramp(frame, 4, 14), transform: `translateY(${ramp(frame, 4, 16, 16, 0, Easing.out(Easing.cubic))}px)` }}>
          <div style={{ fontSize: 96, fontWeight: 700, color: C.ink, letterSpacing: "-0.03em", lineHeight: 1.1 }}>Always on,</div>
          <div style={{ fontSize: 96, fontWeight: 700, color: C.muted, letterSpacing: "-0.03em", lineHeight: 1.1 }}>wherever you are</div>
        </div>
        {front.map((p) => (
          <Pill key={p.label} {...p} blur={blur} />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
