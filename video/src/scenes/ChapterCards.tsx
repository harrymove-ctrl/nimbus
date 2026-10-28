// The one-bar chapter cards of board rev E, each on neutral-950 with the app's dither, in
// Manrope 700: chapter 1 on Word Gather (free), chapter 2 on Text Highlight (free) with the
// CloudMark turning orange, chapter 3 on Check Cycle (free). Chapter 4 is Orbit Flow (ours).
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { CheckCycle } from "@/components/snap-cn/check-cycle";
import { TextHighlight } from "@/components/snap-cn/text-highlight";
import { WordGather } from "@/components/snap-cn/word-gather";
import { CloudMark, ramp } from "../components/CloudMark";
import { beats } from "../grid";
import { C, MANROPE, SORBET } from "../theme";
import { Ground } from "./Opening";

const ON_GROUND = { ...SORBET, background: C.bg };

/** Chapter 1: the first word holds the frame alone; the rest drop in mint and slide home. */
export function ChapterGather({ speed = 1 }: { speed?: number }) {
  return (
    <Ground>
      <WordGather text="You set the goal. It plans." maxWidth={560} accent={C.mint} fontWeight={700} fontFamily={MANROPE} tracking={-0.02} spaceTrim={0} arrive="vertical" speed={speed} theme={ON_GROUND} mode="dark" />
    </Ground>
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
/** The marker starts on beat 1's second half and lands by beat 2; the cloud turns orange on beat 4. */
export const HIGHLIGHT = { start: 8, draw: 16, orange: beats(3) };

function lineWidth() {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return 1300;
  ctx.font = `${LINE.weight} ${LINE.size}px ${MANROPE}`;
  ctx.letterSpacing = "-0.02em";
  return ctx.measureText(LINE.before + LINE.highlight).width;
}

/** Chapter 2: the static line; a mint marker wipes across "without you."; on beat 4 the small
 *  cloud at the end of the line turns orange (a reply is waiting for you). */
export function ChapterHighlight() {
  const frame = useCurrentFrame();
  const w = lineWidth();
  const shift = (MARK + MARK_GAP) / 2;
  const turn = ramp(frame, HIGHLIGHT.orange, HIGHLIGHT.orange + 8);
  const pop = 1 + 0.12 * Math.sin(Math.PI * ramp(frame, HIGHLIGHT.orange, HIGHLIGHT.orange + 10));
  const enter = ramp(frame, 0, 6, 0, 1, Easing.out(Easing.cubic));
  // a slow push for the whole bar, so the held line never sits still
  const push = ramp(frame, 0, 60, 1, 1.07);
  return (
    <Ground>
      <AbsoluteFill style={{ opacity: enter, transform: `scale(${push})` }}>
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
            theme={{ ...SORBET, background: "transparent" }}
            mode="dark"
          />
        </AbsoluteFill>
        <div style={{ position: "absolute", left: 960 - shift + w / 2 + MARK_GAP, top: 540 - MARK / 2 - 6, transform: `scale(${pop})` }}>
          <CloudMark size={MARK} orange={turn} blinks={[beats(2)]} />
        </div>
      </AbsoluteFill>
    </Ground>
  );
}

/** Check Cycle at 1.65× its fitted size reads at about 96 px; at 1.95× speed its four rolls,
 *  the hold and the step back fit one bar (3.84 s of its own clock). */
export const CHECK = { scale: 1.65, speed: 1.95 };
/** Chapter 3: "It learns ☑ …", the word rolling up out of the slot four times, then rest. */
export function ChapterCheck() {
  return (
    <Ground>
      <CheckCycle
        headline="It learns"
        words="your priorities, your tone, your rules, your tools, every run."
        fontFamily={MANROPE}
        fontWeight={700}
        scale={CHECK.scale}
        speed={CHECK.speed}
        theme={{ ...SORBET, background: "transparent" }}
        mode="dark"
      />
    </Ground>
  );
}
