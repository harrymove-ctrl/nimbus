// Column Cut (scene 5), written from the board's description: a four-line cascade with a
// square cursor beside one line and a highlight running across that line letter by letter
// while the type drifts up; a hard cut to a column of pictures that jumps one per beat,
// the beats tightening, a sentence landing either side, the frame panning away left.
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { beats } from "../grid";
import { C, MANROPE } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Board, frames inside the scene (scene 5 = 600–840).
const CUT = 90;
const HL_FROM = 40;
const HL_TO = 80;
const LEFT_AT = 100;
const RIGHT_AT = 130;
const PAN_FROM = 160;
// Gaps between column jumps: 15 → 12 → 10 frames.
const JUMP_GAPS = [15, 15, 12, 12, 12, 10, 10, 10, 10];
const JUMP_FRAMES = 4;

const STILL_W = 1320;
const STILL_H = 743;
const GAP = 36;

/** Frames (inside the scene) the column jumps on: one shutter each. */
export function columnJumps(): number[] {
  const out: number[] = [];
  let at = CUT;
  for (const g of JUMP_GAPS) {
    at += g;
    out.push(at);
  }
  return out;
}

export const COLUMN_CUT = { CUT, HL_FROM, HL_TO, LEFT_AT, RIGHT_AT, PAN_FROM };

export function ColumnCut({
  lines,
  highlightLine = 2,
  stills,
  left,
  right,
}: {
  lines: string[];
  highlightLine?: number;
  stills: string[];
  left: string;
  right: string;
}) {
  const frame = useCurrentFrame();

  if (frame < CUT) {
    const drift = interpolate(frame, [0, CUT], [0, -24], clamp);
    const hl = lines[highlightLine];
    const lit = Math.round(interpolate(frame, [HL_FROM, HL_TO], [0, hl.length], clamp));
    return (
      <AbsoluteFill style={{ background: C.bg, fontFamily: MANROPE }}>
        <div style={{ position: "absolute", left: 300, top: 300, transform: `translateY(${drift}px)` }}>
          {lines.map((line, i) => {
            const at = i * beats(1);
            const p = interpolate(frame, [at, at + 8], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
            const isHl = i === highlightLine;
            return (
              <div
                key={line}
                style={{
                  height: 112,
                  fontSize: 72,
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  color: isHl ? C.ink : C.dim,
                  opacity: p,
                  transform: `translateY(${(1 - p) * 40}px)`,
                  display: "flex",
                  alignItems: "center",
                  whiteSpace: "pre",
                }}
              >
                {isHl ? (
                  <>
                    <span style={{ background: C.mint, color: C.bg, borderRadius: 6 }}>{line.slice(0, lit)}</span>
                    <span>{line.slice(lit)}</span>
                    <span
                      style={{
                        width: 40,
                        height: 40,
                        marginLeft: 24,
                        background: C.mint,
                        opacity: frame % 20 < 12 ? 1 : 0.25,
                      }}
                    />
                  </>
                ) : (
                  line
                )}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    );
  }

  // The column: one still per jump, each jump a quick slide up by one still.
  const jumps = columnJumps();
  let pos = 0;
  for (const j of jumps) {
    pos += interpolate(frame, [j - JUMP_FRAMES, j], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  }
  const colY = 540 - STILL_H / 2 - pos * (STILL_H + GAP);
  const pan = interpolate(frame, [PAN_FROM, 240], [0, -2400], { ...clamp, easing: Easing.in(Easing.cubic) });
  const word = (at: number) => {
    const p = interpolate(frame, [at, at + 8], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });
    return { opacity: Math.min(1, p * 2), transform: `translateY(${(1 - p) * 30}px) scale(${0.9 + 0.1 * p})` };
  };
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: MANROPE, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translateX(${pan}px)` }}>
        <div style={{ position: "absolute", left: 960 - STILL_W / 2, top: colY }}>
          {stills.map((s, i) => (
            <Img
              key={s}
              src={staticFile(s)}
              style={{
                display: "block",
                width: STILL_W,
                height: STILL_H,
                marginBottom: GAP,
                borderRadius: 18,
                border: `1px solid ${C.line}`,
                objectFit: "cover",
                opacity: Math.abs(i - pos) < 0.5 ? 1 : 0.45,
              }}
            />
          ))}
        </div>
        {[
          { text: left, at: LEFT_AT, side: "left" as const, color: C.ink },
          { text: right, at: RIGHT_AT, side: "right" as const, color: C.mint },
        ].map((w) => (
          <div
            key={w.text}
            style={{
              position: "absolute",
              [w.side]: 960 - STILL_W / 2 - 40,
              bottom: 150,
              fontSize: 54,
              fontWeight: 700,
              color: w.color,
              whiteSpace: "nowrap",
              background: `color-mix(in oklch, ${C.card} 92%, transparent)`,
              border: `1px solid ${C.line}`,
              borderRadius: 18,
              padding: "16px 30px",
              ...word(w.at),
            }}
          >
            {w.text}
          </div>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
