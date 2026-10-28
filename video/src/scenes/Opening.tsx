// Scenes 1–3 of board rev E: the v3 opening the user liked (Orb Swarm, free), the name (Block
// Wordmark, free, with the CloudMark landing beside it), and the laptop that opens and dives
// into the real Overview (Laptop Frame, free). Every ground is neutral-950 with the app's
// dither; the orbs are the cloud's blue, the wordmark cards the four role colours.
import type { ReactNode } from "react";
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { BlockWordmark } from "@/components/snap-cn/block-wordmark";
import { LaptopFrame } from "@/components/snap-cn/laptop-frame";
import { OrbSwarm } from "@/components/snap-cn/orb-swarm";
import { CloudMark, ramp } from "../components/CloudMark";
import { Footage } from "../Footage";
import { LAPTOP_FRAMES, OVERVIEW } from "../shots";
import { C, CLOUD, DITHER, MANROPE, ROLE, SORBET } from "../theme";

const out = Easing.out(Easing.cubic);

/** neutral-950 under, the app's dither over (the blocks paint their own solid page). */
export function Ground({ children }: { children?: ReactNode }) {
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {children}
      <AbsoluteFill style={{ background: DITHER, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
}

/** Orb Swarm's own length at speed 1, in frames at 30 fps (128 beats of its 24 fps clock). */
const ORB_FRAMES = 160;
/** Scene 1: the sentence in beats. Six cards; the third to fifth reveal word by word. */
export function Hook({ script, frames }: { script: string; frames: number }) {
  return (
    <Ground>
      <OrbSwarm
        script={script}
        background={C.bg}
        ink={C.ink}
        orbColor={CLOUD.blue}
        fontFamily={MANROPE}
        softness={0}
        speed={ORB_FRAMES / frames}
        theme={SORBET}
        mode="dark"
      />
    </Ground>
  );
}
export const HOOK_FULL = "Your standing work, | done every | morning | by a crew of | Nemotron agents | that asks before it acts.";
export const HOOK_X = "Your standing work, | done every | morning | by a crew | that asks | before it acts.";

const MARK = 168;
const GAP = 44;
/** The wordmark settles by about frame 92 at this speed; the cloud lands as the last letter does. */
export const NAME = { speed: 1.2, cloudIn: 84, blink: 104, line: 96 };
const WORD_W = 700; // "Nimbus" in Manrope 700 at 210 px, near enough to centre the pair

/** Scene 2: the name. A deck in the role colours builds "Nimbus"; the cloud lands left of it. */
export function Name() {
  const frame = useCurrentFrame();
  const land = ramp(frame, NAME.cloudIn, NAME.cloudIn + 14, 0, 1, out);
  const shift = ((MARK + GAP) / 2) * land;
  return (
    <Ground>
      <AbsoluteFill style={{ transform: `translateX(${shift}px)` }}>
        <BlockWordmark
          text="Nimbus"
          fontSize={210}
          fontFamily={MANROPE}
          fontWeight={700}
          color={C.ink}
          colors={[ROLE.checker, ROLE.researcher, ROLE.analyst, ROLE.writer]}
          background={C.bg}
          speed={NAME.speed}
          theme={SORBET}
          mode="dark"
        />
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 960 - WORD_W / 2 + shift - GAP - MARK - (1 - land) * 160,
          top: 540 - MARK / 2 - 12,
          opacity: land,
        }}
      >
        <CloudMark size={MARK} blinks={[NAME.blink]} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 690,
          textAlign: "center",
          fontFamily: MANROPE,
          fontSize: 40,
          fontWeight: 600,
          color: C.muted,
          opacity: ramp(frame, NAME.line, NAME.line + 8),
          transform: `translateY(${ramp(frame, NAME.line, NAME.line + 10, 14, 0, out)}px)`,
        }}
      >
        NVIDIA Nemotron · Nebius Token Factory
      </div>
    </Ground>
  );
}

/** Laptop Frame's dive ends at its frame 185 at speed 1. */
const LAPTOP_END = 185;
/** Scene 3's first 75 frames: the lid opens, the notch says the brief ran, the camera dives
 *  into the screen. The screen plays the same Overview shot the scene cuts to, so the dive
 *  ends on the footage the frame then shows full size (a 6-frame cross-fade covers the crop). */
export function LaptopDive() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity: ramp(frame, LAPTOP_FRAMES - 6, LAPTOP_FRAMES, 1, 0) }}>
      <Ground>
        <LaptopFrame
          entrance="open"
          finale="zoom-to-screen"
          notchLabel="Morning brief · ran 08:00"
          showNotch
          indicatorColor={C.mint}
          floatLoop={false}
          fontFamily={MANROPE}
          speed={LAPTOP_END / LAPTOP_FRAMES}
          screenColor={C.bg}
          theme={SORBET}
          mode="dark"
        >
          <Footage shot="overview" frames={OVERVIEW.frames} camera={OVERVIEW.camera} />
        </LaptopFrame>
      </Ground>
    </AbsoluteFill>
  );
}
export const LAPTOP = { lid: 0, notch: Math.round((120 * LAPTOP_FRAMES) / LAPTOP_END), dive: Math.round((140 * LAPTOP_FRAMES) / LAPTOP_END) };
