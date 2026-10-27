// Prompt Roll (scene 1), written from the board's description: a prompt card pushes in while
// the lead types; its last words become a pill that rolls through jobs, one per beat, each
// in its own tint; a whip pan to a send button that draws itself in; a pointer presses it
// into a halo; the arrow flies off into a 6-frame mint flash (dark-first, board rev B).
// A pure function of the frame.
import {
  AbsoluteFill,
  Easing,
  interpolate,
  interpolateColors,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { beats } from "../grid";
import { C, DITHER_GLOW, MANROPE } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export type RollOption = { text: string; tint: string };

// Timing, on the beat grid (board: f 0–120).
const PUSH = 10; // card 92 % → 100 %
const ROLL_AT = 40; // first roll step; one per beat after
const ROLL_FRAMES = 7; // the slot roll
const WHIP_AT = 88;
const WHIP_FRAMES = 8;
const DRAW_AT = 92;
const DRAW_FRAMES = 8;
const PRESS_AT = 104;
const FLY_AT = 106;
const WASH_AT = 114; // the flash: 6 frames into the cut

const FONT = 64;
const CHAR_W = FONT * 0.56; // Manrope 600, average advance; keeps the layout a pure function
const pillWidth = (s: string) => s.length * CHAR_W + 56;

export function PromptRoll({
  lead,
  options,
  charFrames = 2,
}: {
  lead: string;
  options: RollOption[];
  charFrames?: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const typed = lead.slice(0, Math.floor(frame / charFrames));
  const typingDone = lead.length * charFrames;
  const push = interpolate(frame, [0, PUSH], [0.92, 1], { ...clamp, easing: Easing.out(Easing.cubic) });

  // Which option is up, and how far its roll has gone.
  const step = Math.max(0, Math.min(options.length - 1, Math.floor((frame - ROLL_AT) / beats(1))));
  const stepAt = ROLL_AT + step * beats(1);
  const roll = step === 0 ? 1 : interpolate(frame, [stepAt, stepAt + ROLL_FRAMES], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const prev = options[Math.max(0, step - 1)];
  const cur = options[step];
  const pillIn = spring({ frame: frame - typingDone, fps, config: { damping: 14, stiffness: 180 } });
  const tintP = step === 0 ? 1 : spring({ frame: frame - stepAt, fps, durationInFrames: 4, config: { damping: 200 } });
  const tint = interpolateColors(tintP, [0, 1], [prev.tint, cur.tint]);
  const width = interpolate(roll, [0, 1], [pillWidth(prev.text), pillWidth(cur.text)]);

  // Whip pan right to the send button, with a smear while it moves.
  const whip = interpolate(frame, [WHIP_AT, WHIP_AT + WHIP_FRAMES], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const panX = -whip * 620;
  const smear = Math.sin(whip * Math.PI) * 14;

  const draw = interpolate(frame, [DRAW_AT, DRAW_AT + DRAW_FRAMES], [0, 1], clamp);
  const pointer = interpolate(frame, [96, PRESS_AT], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const press = frame >= PRESS_AT && frame < PRESS_AT + 4 ? 0.9 : 1;
  const halo = interpolate(frame, [PRESS_AT, PRESS_AT + 12], [0, 1], clamp);
  const fly = interpolate(frame, [FLY_AT, FLY_AT + 8], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const wash = interpolate(frame, [WASH_AT, WASH_AT + 6], [0, 0.85], { ...clamp, easing: Easing.in(Easing.quad) });

  const cardW = 1700;
  const btn = 150;
  const btnX = 960 + cardW / 2 + 120; // send button, right of the card

  return (
    <AbsoluteFill style={{ background: C.bg, backgroundImage: DITHER_GLOW, fontFamily: MANROPE, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          transform: `translateX(${panX}px) scale(${push})`,
          filter: smear > 0.5 ? `blur(${smear}px)` : undefined,
        }}
      >
        {/* The prompt card */}
        <div
          style={{
            position: "absolute",
            left: 960 - cardW / 2,
            top: 540 - 140,
            width: cardW,
            height: 280,
            borderRadius: 32,
            background: C.card,
            boxShadow: "0 40px 90px oklch(0 0 0 / 45%)",
            border: `1px solid ${C.line}`,
            display: "flex",
            alignItems: "center",
            padding: "0 64px",
            fontSize: FONT,
            fontWeight: 600,
            color: C.ink,
            letterSpacing: "-0.01em",
            whiteSpace: "pre",
          }}
        >
          <span>{typed}</span>
          {frame < typingDone ? (
            <span style={{ display: "inline-block", width: 4, height: FONT * 0.9, background: C.mint, marginLeft: 4, opacity: frame % 16 < 9 ? 1 : 0 }} />
          ) : (
            <span
              style={{
                position: "relative",
                display: "inline-block",
                width,
                height: FONT * 1.35,
                marginLeft: 18,
                borderRadius: 999,
                background: tint,
                overflow: "hidden",
                transform: `scale(${0.6 + 0.4 * pillIn})`,
                transformOrigin: "left center",
                verticalAlign: "middle",
              }}
            >
              {[prev, cur].map((o, i) => {
                if (step === 0 && i === 0) return null;
                const y = i === 0 ? -roll * 100 : (1 - roll) * 100;
                return (
                  <span
                    key={i}
                    style={{
                      position: "absolute",
                      left: 28,
                      top: 0,
                      lineHeight: `${FONT * 1.35}px`,
                      transform: `translateY(${y}%)`,
                      color: C.bg,
                    }}
                  >
                    {o.text}
                  </span>
                );
              })}
            </span>
          )}
        </div>

        {/* The send button: its ring draws in, then the press, the halo, the arrow */}
        <svg
          width={btn * 3}
          height={btn * 3}
          viewBox={`${-btn * 1.5} ${-btn * 1.5} ${btn * 3} ${btn * 3}`}
          style={{ position: "absolute", left: btnX - btn * 1.5, top: 540 - btn * 1.5, overflow: "visible" }}
        >
          {frame >= PRESS_AT ? (
            <circle r={btn / 2 + halo * 90} fill="none" stroke={C.mint} strokeWidth={10 * (1 - halo)} opacity={1 - halo} />
          ) : null}
          <g transform={`scale(${press})`}>
            <circle r={btn / 2} fill={draw >= 1 ? C.mint : "none"} stroke={C.mint} strokeWidth={6} strokeDasharray={Math.PI * btn} strokeDashoffset={(1 - draw) * Math.PI * btn} transform="rotate(-90)" />
            <g
              transform={`translate(${fly * 420}, ${-fly * 420}) rotate(${-45 + 0})`}
              opacity={draw >= 1 ? 1 - fly * 0.6 : 0}
            >
              <path d="M -26 0 L 26 0 M 6 -20 L 26 0 L 6 20" stroke={draw >= 1 && fly === 0 ? C.mintInk : C.mint} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </g>
          </g>
        </svg>

        {/* The pointer, gliding in from the bottom right onto the button */}
        <svg
          width={48}
          height={60}
          viewBox="0 0 24 30"
          style={{
            position: "absolute",
            left: btnX + interpolate(pointer, [0, 1], [300, 6]),
            top: 540 + interpolate(pointer, [0, 1], [320, 8]),
            opacity: interpolate(frame, [96, 100], [0, 1], clamp),
            transform: `scale(${press})`,
          }}
        >
          <path d="M2 2 L2 24 L8 18 L12 28 L16 26 L12 17 L20 17 Z" fill={C.ink} stroke={C.bg} strokeWidth={1.6} strokeLinejoin="round" />
        </svg>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `color-mix(in oklch, ${C.mint} 35%, white)`, opacity: wash }} />
    </AbsoluteFill>
  );
}

/** The frames a roll tick sounds on, one per option after the first appears. */
export const rollTicks = (options: number) => Array.from({ length: options }, (_, i) => ROLL_AT + i * beats(1));
export const PROMPT_ROLL = { PRESS_AT, FLY_AT, WASH_AT };
