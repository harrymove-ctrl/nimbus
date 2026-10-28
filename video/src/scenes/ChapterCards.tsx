// The two 1-bar chapter openers of board rev D: chapter 1 on snapcn Punch Lines (free) and
// chapter 2 on snapcn Text Highlight (installed), each in Manrope on the app's ground.
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { PunchLines } from "@/components/snap-cn/punch-lines";
import { TextHighlight } from "@/components/snap-cn/text-highlight";
import { CloudMark, ramp } from "../components/CloudMark";
import { beats } from "../grid";
import { C, DITHER_GLOW, MANROPE, SORBET } from "../theme";

/** Chapter 1: "You ask." and "It plans." flick in and rush past; the hero line punches up
 *  from a third of its size. One bar: 15 + 15 + 30 frames. */
export function ChapterPunch() {
  return (
    <AbsoluteFill style={{ background: C.bg, backgroundImage: DITHER_GLOW }}>
      <PunchLines
        script="You ask. | It plans. | You approve / the plan"
        styles="slide,slide,punch"
        sizes="1,1,1.08"
        holds="15,15,30"
        accentBeat={3}
        accentColor={C.mint}
        ground="transparent"
        ink={C.ink}
        fontFamily={MANROPE}
        fontWeight={700}
        fontSize={150}
        punchFrom={0.33}
        theme={SORBET}
        mode="dark"
      />
    </AbsoluteFill>
  );
}

const LINE = {
  before: "Nothing leaves ",
  highlight: "without you.",
  size: 104,
  weight: 700,
};
const MARK = 128;
const MARK_GAP = 34;
/** The marker starts on beat 1's second half and lands by beat 2. */
export const HIGHLIGHT = { start: 8, draw: 16, orange: 8 + 16 - 4 };

function lineWidth() {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return 1300;
  ctx.font = `${LINE.weight} ${LINE.size}px ${MANROPE}`;
  ctx.letterSpacing = "-0.02em";
  return ctx.measureText(LINE.before + LINE.highlight).width;
}

/** Chapter 2: the static line; a mint marker wipes across "without you."; as it lands the
 *  small cloud at the end of the line turns orange (replies waiting for you). */
export function ChapterHighlight() {
  const frame = useCurrentFrame();
  const w = lineWidth();
  const shift = (MARK + MARK_GAP) / 2;
  const turn = ramp(frame, HIGHLIGHT.orange, HIGHLIGHT.orange + 8);
  const pop =
    1 +
    0.12 *
      Math.sin(Math.PI * ramp(frame, HIGHLIGHT.orange, HIGHLIGHT.orange + 10));
  const enter = ramp(frame, 0, 6, 0, 1, Easing.out(Easing.cubic));
  // a slow push for the whole bar, so the held line never sits still
  const push = ramp(frame, 0, 60, 1, 1.07);
  return (
    <AbsoluteFill
      style={{ background: C.bg, backgroundImage: DITHER_GLOW, opacity: enter }}
    >
      <AbsoluteFill style={{ transform: `scale(${push})` }}>
        <AbsoluteFill style={{ transform: `translateX(${-shift}px)` }}>
          <TextHighlight
            before={LINE.before}
            highlight={LINE.highlight}
            preset="marker"
            baseColor={C.ink}
            accentColor={C.mint}
            highlightedTextColor={C.mint}
            fontFamily={MANROPE}
            fontSize={LINE.size}
            fontWeight={LINE.weight}
            startAt={HIGHLIGHT.start}
            drawDuration={HIGHLIGHT.draw}
            theme={SORBET}
            mode="dark"
          />
        </AbsoluteFill>
        <div
          style={{
            position: "absolute",
            left: 960 - shift + w / 2 + MARK_GAP,
            top: 540 - MARK / 2 - 6,
            transform: `scale(${pop})`,
          }}
        >
          <CloudMark size={MARK} orange={turn} blinks={[beats(3)]} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
