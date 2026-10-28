// Lockup Reveal (board rev D, scenes 2 and 15): our own build from the described behaviour.
// Bar 1: the cloud alone on the dark ground with dashed construction hairlines on every edge
// of the lockup; it slides aside while "Nimbus" slides out of a slot behind it, the lockup
// settles from 1.1×, and the boot sky rises inside the letterforms. Bar 2's downbeat cuts to
// the same sky full-frame with the lockup knocked out in white; the cloud blinks once and the
// two title lines build a word at a time. The end card is the same lockup on the sky, held
// still, with the repo and the one command under it.
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { CloudMark, ramp } from "../components/CloudMark";
import { bars, beats } from "../grid";
import { BOOT_SKY, BOOT_SKY_FILL, C, MANROPE } from "../theme";

const CLOUD = 210;
const GAP = 26;
const WORD = "Nimbus";
const WORD_SIZE = 168;
const out = Easing.out(Easing.cubic);
const inOut = Easing.inOut(Easing.cubic);

/** The wordmark's width at its size, measured once the face is in (FontGate). */
function wordWidth() {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return 560;
  ctx.font = `700 ${WORD_SIZE}px ${MANROPE}`;
  ctx.letterSpacing = "-0.03em";
  return ctx.measureText(WORD).width;
}

/** The lockup: cloud + word, centred as a whole at (960, cy). `slide` 0 = the cloud alone at
 *  the centre, the word hidden in its slot; 1 = the settled lockup. */
function Mark({ cy, slide, fill, white, cloud }: { cy: number; slide: number; fill: number; white: boolean; cloud: React.ReactNode }) {
  const w = wordWidth();
  const total = CLOUD + GAP + w;
  const left = 960 - total / 2;
  const cloudX = 960 - CLOUD / 2 + (left - (960 - CLOUD / 2)) * slide;
  const word = { x: left + CLOUD + GAP, y: cy - WORD_SIZE * 0.62 };
  const text = (style: React.CSSProperties) => (
    <div style={{ fontFamily: MANROPE, fontWeight: 700, fontSize: WORD_SIZE, letterSpacing: "-0.03em", lineHeight: 1.24, whiteSpace: "nowrap", ...style }}>{WORD}</div>
  );
  return (
    <>
      {/* the slot: the word lives in a box whose left edge is just behind the cloud */}
      <div style={{ position: "absolute", left: word.x, top: word.y, width: w + 20, height: WORD_SIZE * 1.3, overflow: "hidden", clipPath: `inset(0 0 0 ${Math.max(0, cloudX + CLOUD / 2 - word.x)}px)` }}>
        <div style={{ transform: `translateX(${-(1 - slide) * (w + GAP + 20)}px)`, position: "relative" }}>
          {text({ color: white ? "#ffffff" : C.ink })}
          {white ? null : (
            <div style={{ position: "absolute", inset: 0, clipPath: `inset(${(1 - fill) * 100}% 0 0 0)` }}>
              {text({ backgroundImage: BOOT_SKY_FILL, backgroundClip: "text", WebkitBackgroundClip: "text", color: "transparent" })}
            </div>
          )}
        </div>
      </div>
      <div style={{ position: "absolute", left: cloudX, top: cy - CLOUD / 2 - 8 }}>{cloud}</div>
    </>
  );
}

/** Dashed hairlines along every edge of the lockup's box, running the full frame. */
function Hairlines({ cy, draw }: { cy: number; draw: number }) {
  const total = CLOUD + GAP + wordWidth();
  const x0 = 960 - total / 2;
  const x1 = 960 + total / 2;
  const y0 = cy - CLOUD / 2;
  const y1 = cy + CLOUD / 2;
  const line = { stroke: "rgba(255, 255, 255, 0.2)", strokeWidth: 1.5, strokeDasharray: "8 10" };
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
      <line x1={0} y1={y0} x2={1920 * draw} y2={y0} {...line} />
      <line x1={1920} y1={y1} x2={1920 * (1 - draw)} y2={y1} {...line} />
      <line x1={x0} y1={0} x2={x0} y2={1080 * draw} {...line} />
      <line x1={x1} y1={1080} x2={x1} y2={1080 * (1 - draw)} {...line} />
      <line x1={x0 + CLOUD + GAP / 2} y1={0} x2={x0 + CLOUD + GAP / 2} y2={1080 * draw} {...line} opacity={0.6} />
    </svg>
  );
}

/** Words that build one at a time, each rising 14 px into place. */
function Build({ text, from, every, size, weight, color, frame }: { text: string; from: number; every: number; size: number; weight: number; color: string; frame: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: size * 0.26, fontFamily: MANROPE, fontSize: size, fontWeight: weight, color, letterSpacing: "-0.01em" }}>
      {text.split(" ").map((w, i) => {
        const p = ramp(frame, from + i * every, from + i * every + 7, 0, 1, out);
        return (
          <span key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * 14}px)`, display: "inline-block" }}>
            {w}
          </span>
        );
      })}
    </div>
  );
}

export const LOCKUP = { sky: bars(1), blink: bars(1) + beats(1) - 3 };

/** Scene 2 (2 bars). */
export function LockupReveal() {
  const frame = useCurrentFrame();
  if (frame < LOCKUP.sky) {
    const slide = ramp(frame, 12, 34, 0, 1, inOut);
    const scale = ramp(frame, 12, 52, 1.1, 1, out);
    const pop = ramp(frame, 0, 10, 0.86, 1, out);
    return (
      <AbsoluteFill style={{ background: C.bg }}>
        <Hairlines cy={540} draw={ramp(frame, 0, 14, 0, 1, out)} />
        <AbsoluteFill style={{ transform: `scale(${scale * pop})` }}>
          <Mark cy={540} slide={slide} fill={ramp(frame, 30, 56, 0, 1, inOut)} white={false} cloud={<CloudMark size={CLOUD} />} />
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }
  const f = frame - LOCKUP.sky;
  const drift = ramp(f, 0, bars(1), 1, 1.025);
  return (
    <AbsoluteFill style={{ background: BOOT_SKY }}>
      <AbsoluteFill style={{ transform: `scale(${drift})` }}>
        <Mark cy={430} slide={1} fill={1} white cloud={<CloudMark size={CLOUD} onSky blinks={[LOCKUP.blink]} />} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 600 }}>
          <Build text="An AI crew that asks before it acts" from={LOCKUP.sky + 2} every={3} size={60} weight={700} color="#ffffff" frame={frame} />
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 700 }}>
          <Build text="NVIDIA Nemotron · Nebius Token Factory" from={LOCKUP.sky + beats(2)} every={3} size={38} weight={600} color="rgba(255, 255, 255, 0.82)" frame={frame} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** The end card (rev E scene 21): the lockup reprise on the sky, held still, with the repo,
 *  the command and the licence line. */
export function LockupEnd() {
  const frame = useCurrentFrame();
  const settle = ramp(frame, 0, 12, 1.04, 1, out);
  const show = (at: number) => ({ opacity: ramp(frame, at, at + 8), transform: `translateY(${ramp(frame, at, at + 8, 12, 0, out)}px)` });
  return (
    <AbsoluteFill style={{ background: BOOT_SKY }}>
      <AbsoluteFill style={{ transform: `scale(${settle})`, opacity: ramp(frame, 0, 6) }}>
        <Mark cy={400} slide={1} fill={1} white cloud={<CloudMark size={CLOUD} onSky alive={false} />} />
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: 590, textAlign: "center", fontFamily: MANROPE, color: "#ffffff" }}>
        <div style={{ fontSize: 54, fontWeight: 700, letterSpacing: "-0.01em", ...show(8) }}>github.com/harrymove-ctrl/nimbus</div>
        <div style={{ marginTop: 34, ...show(14) }}>
          <span style={{ display: "inline-block", fontSize: 42, fontWeight: 600, padding: "12px 30px", borderRadius: 16, background: "rgba(5, 40, 110, 0.35)", border: "1px solid rgba(255, 255, 255, 0.28)" }}>pnpm dev</span>
        </div>
        <div style={{ marginTop: 44, fontSize: 30, fontWeight: 600, color: "rgba(255, 255, 255, 0.78)", ...show(26) }}>MIT · Nebius × NVIDIA Global AI Hackathon</div>
      </div>
    </AbsoluteFill>
  );
}
