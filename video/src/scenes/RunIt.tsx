// Scene 20 "Run it" (terminal-simulator, free): the clone and `pnpm dev` type in, the output
// scrolls, the last line is the local URL; the camera pins in on it for the last bar. The
// terminal's type is the system monospace the app uses for code (font-mono).
import { AbsoluteFill, Easing, useCurrentFrame, useVideoConfig } from "remotion";
import { TerminalSimulator, type TerminalLine } from "@/components/snap-cn/terminal-simulator";
import { ramp } from "../components/CloudMark";
import { bars } from "../grid";
import { MONO, SORBET } from "../theme";
import { Ground } from "./Opening";

const LINES: TerminalLine[] = [
  { text: "git clone github.com/harrymove-ctrl/nimbus", type: "command", delay: 4 },
  { text: "cd nimbus && pnpm install && pnpm dev", type: "command", delay: 6 },
  { text: "Packages: +612 · done in 9.8s", type: "log", delay: 4 },
  { text: "▲ Next.js 15 · ready in 1.4s", type: "log", delay: 3 },
  { text: "Nimbus · http://localhost:3000", type: "success", delay: 4 },
];

/** The block sits left of centre at this size (the component's world is laid out for 720p);
 *  the last bar pins in on the URL line. */
const SHIFT = -420;
const URL_AT = { x: 700, y: 760 };
export function RunIt({ speed = 1 }: { speed?: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const pin = ramp(frame, durationInFrames - bars(1), durationInFrames - bars(1) + 24, 1, 1.3, Easing.inOut(Easing.cubic));
  return (
    <Ground>
      <AbsoluteFill style={{ transform: `scale(${pin})`, transformOrigin: `${URL_AT.x}px ${URL_AT.y}px` }}>
      <AbsoluteFill style={{ transform: `translateX(${SHIFT}px)` }}>
      <TerminalSimulator
        lines={LINES}
        intro={null}
        command={null}
        fontFamily={MONO}
        fontSize={11}
        charsPerFrame={3}
        zoom={false}
        speed={speed}
        theme={{ ...SORBET, background: "transparent" }}
        mode="dark"
      />
      </AbsoluteFill>
      </AbsoluteFill>
    </Ground>
  );
}
