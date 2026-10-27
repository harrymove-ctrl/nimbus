import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  Sequence,
  Series,
} from "remotion";
import { AgentSteps } from "@/components/snap-cn/agent-steps";
import { AnnounceTitle } from "@/components/snap-cn/announce-title";
import {
  DOT_BLOOM_CUT,
  DOT_BLOOM_FRAMES,
  DotBloom,
} from "@/components/snap-cn/dot-bloom";
import { OrbSwarm } from "@/components/snap-cn/orb-swarm";
import { StatusCycle } from "@/components/snap-cn/status-cycle";
import { TerminalSimulator } from "@/components/snap-cn/terminal-simulator";
import { TextReveal } from "@/components/snap-cn/text-reveal";
import { TypeMorph } from "@/components/snap-cn/type-morph";
import { WordCaptions } from "@/components/snap-cn/word-captions";
import { WordmarkCut } from "@/components/snap-cn/wordmark-cut";
import { SnapCnUIProvider } from "@/lib/snap-cn-ui";
import type { Beat } from "./beats";
import { Footage, TakeContext } from "./Footage";
import { EndCard, ProviderPanel, TierGrid } from "./Panels";
import { C, MANROPE, manropeReady, SORBET } from "./theme";
import cap2 from "../captions/2.json";
import cap3 from "../captions/3.json";
import cap5 from "../captions/5.json";
import cap7 from "../captions/7.json";
import cap8 from "../captions/8.json";
import cap9 from "../captions/9.json";
import cap10 from "../captions/10.json";
import cap11 from "../captions/11.json";
import cap12 from "../captions/12.json";
import cap13 from "../captions/13.json";

export const FPS = 30;
const s = (sec: number) => Math.round(sec * FPS);

// The scene list of docs/VIDEO.md: [start, end] in seconds.
export const SCENES = {
  1: [0, 8],
  2: [8, 14],
  3: [14, 30],
  4: [30, 36],
  5: [36, 65],
  6: [65, 72],
  7: [72, 95],
  8: [95, 110],
  9: [110, 125],
  10: [125, 138],
  11: [138, 152],
  12: [152, 166],
  13: [166, 175],
} as const satisfies Record<number, readonly [number, number]>;

export const DURATION = s(SCENES[13][1]);

const CAPTIONS: Record<
  number,
  { text: string; startMs: number; endMs: number }[]
> = {
  2: cap2,
  3: cap3,
  5: cap5,
  7: cap7,
  8: cap8,
  9: cap9,
  10: cap10,
  11: cap11,
  12: cap12,
  13: cap13,
};

export type NimbusDemoProps = {
  beats: Beat[] | null;
  aspect: number;
  footage: string;
};

function Scene({
  n,
  children,
}: {
  n: keyof typeof SCENES;
  children: React.ReactNode;
}) {
  const [a, b] = SCENES[n];
  const caps = CAPTIONS[n];
  return (
    <Sequence from={s(a)} durationInFrames={s(b - a)} name={`${n}`}>
      <AbsoluteFill style={{ background: C.bg }}>{children}</AbsoluteFill>
      {caps ? (
        <WordCaptions
          captions={caps}
          preset="boxed"
          fontFamily={MANROPE}
          fontSize={40}
          fontWeight={600}
          maxWords={12}
          maxChars={64}
          maxWidth={1500}
          aspect="16:9"
          textColor={C.ink}
          mode="dark"
          theme={SORBET}
        />
      ) : null}
    </Sequence>
  );
}

// Scenes that measure their own type (orb-swarm's canvas, status-cycle's pill) measure it
// once; mount them only after Manrope is in, or they size for the fallback face.
function FontGate({ children }: { children: React.ReactNode }) {
  const [handle] = useState(() => delayRender("Manrope"));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    manropeReady().then(() => {
      setReady(true);
      continueRender(handle);
    });
  }, [handle]);
  return ready ? <>{children}</> : null;
}

const len = (n: keyof typeof SCENES) => s(SCENES[n][1] - SCENES[n][0]);

export function NimbusDemo({ beats, aspect, footage }: NimbusDemoProps) {
  return (
    <TakeContext.Provider value={{ beats, aspect, footage }}>
      <SnapCnUIProvider theme={SORBET} mode="dark">
        <FontGate>
          <AbsoluteFill style={{ background: C.bg, fontFamily: MANROPE }}>
            {/* 1 · the sentence in four beats */}
            <Scene n={1}>
              <OrbSwarm
                script="A glowing cloud | runs your standing work | with a crew | of Nemotron agents | and asks | before it acts."
                background={C.bg}
                ink={C.ink}
                orbColor={C.blue}
                fontFamily={MANROPE}
                mode="dark"
                softness={0}
                speed={160 / len(1)}
              />
            </Scene>

            {/* 2 · the title */}
            <Scene n={2}>
              <AnnounceTitle
                eyebrow="Nebius × NVIDIA Global AI Hackathon · Personal AI"
                title="Nimbus"
                tagline="Nemotron 3 on Token Factory"
                fontFamily={MANROPE}
                voidColor={C.bg}
                fieldColor={C.blue}
                paperColor={C.ink}
                titleColor={C.bg}
                nightColor={C.bg}
                glowColor={C.blue}
                glowStrength={0.22}
                taglineColor={C.mint}
                inkColor={C.ink}
                symbolPath="M27 74a17 17 0 0 1-3-34 25 25 0 0 1 48-5 20 20 0 0 1 3 39z"
                symbolColors={[C.blue, C.mint]}
              />
            </Scene>

            {/* 3 · boot cloud, then the Overview */}
            <Scene n={3}>
              <Series>
                <Series.Sequence durationInFrames={60}>
                  <Footage
                    shot="boot"
                    frames={60}
                    camera={[
                      { at: 0, duration: 60, zoom: 1.3, u: 0.5, v: 0.47 },
                    ]}
                  />
                </Series.Sequence>
                <Series.Sequence durationInFrames={len(3) - 60}>
                  <Footage
                    shot="overview"
                    frames={len(3) - 60}
                    camera={[
                      { at: 0, duration: 1, zoom: 1.7, u: 0.45, v: 0.18 },
                      { at: 70, duration: 60, zoom: 1.55, u: 0.47, v: 0.45 },
                      { at: 150, duration: 50, zoom: 1.8, u: 0.74, v: 0.45 },
                      { at: 210, duration: 40, zoom: 1.8, u: 0.76, v: 0.76 },
                      { at: 290, duration: 70, zoom: 1.2, u: 0.52, v: 0.55 },
                    ]}
                  />
                </Series.Sequence>
              </Series>
            </Scene>

            {/* 4 · its first job is itself */}
            <Scene n={4}>
              <TypeMorph
                lead="Its first job is"
                emphasis="itself."
                morphTo="Ship Nimbus"
                finally_="Ship Nimbus"
                wordOnFlood={false}
                flood={false}
                background={C.bg}
                ink={C.ink}
                fontFamily={MANROPE}
                mode="dark"
              />
            </Scene>
            <Sequence
              from={s(SCENES[5][0]) - DOT_BLOOM_CUT}
              durationInFrames={DOT_BLOOM_FRAMES}
              name="dot-bloom 4→5"
            >
              <DotBloom />
            </Sequence>

            {/* 5 · plan draft, lanes, the Analyst fails and retries */}
            <Scene n={5}>
              <Series>
                <Series.Sequence durationInFrames={450}>
                  <Footage
                    shot="plan"
                    frames={450}
                    camera={[
                      { at: 0, duration: 1, zoom: 1.8, u: 0.46, v: 0.88 },
                      { at: 165, duration: 45, zoom: 1.55, u: 0.46, v: 0.55 },
                      { at: 270, duration: 40, zoom: 1.75, u: 0.5, v: 0.62 },
                      { at: 390, duration: 50, zoom: 1.4, u: 0.45, v: 0.2 },
                    ]}
                    rings={[{ at: 375, u: 0.607, v: 0.776 }]}
                  />
                </Series.Sequence>
                <Series.Sequence durationInFrames={len(5) - 450}>
                  <Footage
                    shot="lanes"
                    frames={len(5) - 450}
                    camera={[
                      { at: 0, duration: 1, zoom: 1.5, u: 0.42, v: 0.2 },
                      { at: 100, duration: 50, zoom: 2.1, u: 0.42, v: 0.25 },
                      { at: 230, duration: 50, zoom: 1.9, u: 0.85, v: 0.28 },
                      { at: 330, duration: 70, zoom: 1.6, u: 0.82, v: 0.4 },
                    ]}
                  />
                </Series.Sequence>
              </Series>
            </Scene>

            {/* 6 · the promise */}
            <Scene n={6}>
              <TextReveal
                text="Nothing leaves the sandbox without you."
                fontSize={96}
                color={C.ink}
                fontFamily={MANROPE}
                fontWeight={700}
                mode="dark"
              />
            </Scene>

            {/* 7 · the question, the patch, the PR gate */}
            <Scene n={7}>
              <Footage
                shot="gate"
                frames={len(7)}
                camera={[
                  { at: 0, duration: 1, zoom: 1.7, u: 0.46, v: 0.72 },
                  { at: 110, duration: 50, zoom: 1.6, u: 0.86, v: 0.3 },
                  { at: 400, duration: 45, zoom: 1.5, u: 0.46, v: 0.6 },
                  { at: 610, duration: 35, zoom: 1.7, u: 0.46, v: 0.8 },
                  { at: 655, duration: 35, zoom: 1.2, u: 0.5, v: 0.55 },
                ]}
                rings={[
                  { at: 54, u: 0.31, v: 0.76 },
                  { at: 595, u: 0.54, v: 0.77 },
                ]}
              />
            </Scene>

            {/* 8 · the Learner, then the run summary and Memory & skill */}
            <Scene n={8}>
              <Series>
                <Series.Sequence durationInFrames={120}>
                  <AgentSteps
                    query="Learner · after run one"
                    steps={[
                      {
                        running: "Reading the run…",
                        done: "Read 115 events",
                        hold: 0.55,
                      },
                      {
                        running: "Writing memories…",
                        done: "5 memories saved",
                        hold: 0.55,
                      },
                      {
                        running: "Rewriting SKILL.md…",
                        done: "Skill rewritten",
                        hold: 0.55,
                      },
                      {
                        running: "Saving the rule…",
                        done: "allow open_pr for fix/*",
                        hold: 0.55,
                      },
                    ]}
                    result="Run two starts with what run one learned"
                    queryHold={0.4}
                    finalHold={0.3}
                    paperColor={C.bg}
                    glowColor={C.mint}
                    mode="dark"
                    fontFamily={MANROPE}
                  />
                </Series.Sequence>
                <Series.Sequence durationInFrames={len(8) - 120}>
                  <Footage
                    shot="memory"
                    frames={len(8) - 120}
                    camera={[
                      { at: 0, duration: 1, zoom: 1.8, u: 0.42, v: 0.63 },
                      { at: 160, duration: 40, zoom: 1.6, u: 0.87, v: 0.3 },
                      { at: 240, duration: 70, zoom: 1.6, u: 0.87, v: 0.72 },
                    ]}
                    rings={[{ at: 150, u: 0.93, v: 0.06 }]}
                  />
                </Series.Sequence>
              </Series>
            </Scene>

            {/* 9 · always on: the status pill, a reply approved inline */}
            <Scene n={9}>
              <Footage
                shot="pill"
                frames={len(9)}
                camera={[
                  { at: 0, duration: 1, zoom: 1.4, u: 0.5, v: 0.4 },
                  { at: 40, duration: 50, zoom: 2.0, u: 0.88, v: 0.06 },
                  { at: 140, duration: 50, zoom: 1.9, u: 0.88, v: 0.2 },
                  { at: 300, duration: 50, zoom: 2.2, u: 0.88, v: 0.28 },
                  { at: 400, duration: 45, zoom: 1.25, u: 0.55, v: 0.45 },
                ]}
              />
            </Scene>

            {/* 10 · run two */}
            <Scene n={10}>
              <Series>
                <Series.Sequence durationInFrames={150}>
                  <StatusCycle
                    prefix="Run two"
                    statuses={["✦ learned", "no approval card", "−42 % cost"]}
                    chips={["memory", "rule", "skill"]}
                    fieldColor={C.bg}
                    pageColor={C.bg}
                    pillColor={C.mint}
                    pillLabelColor={C.mintInk}
                    prefixColor={C.ink}
                    chipFills={[C.card, C.line, C.mint]}
                    chipTextColor={C.ink}
                    statusHold={36}
                    fontFamily={MANROPE}
                    mode="dark"
                  />
                </Series.Sequence>
                <Series.Sequence durationInFrames={len(10) - 150}>
                  <Footage
                    shot="run2"
                    frames={len(10) - 150}
                    camera={[
                      { at: 0, duration: 1, zoom: 1.6, u: 0.46, v: 0.55 },
                      { at: 70, duration: 40, zoom: 1.8, u: 0.42, v: 0.63 },
                      { at: 180, duration: 45, zoom: 1.6, u: 0.45, v: 0.12 },
                    ]}
                  />
                </Series.Sequence>
              </Series>
            </Scene>

            {/* 11 · the OpenAI-compatible endpoint */}
            <Scene n={11}>
              <Series>
                <Series.Sequence durationInFrames={255}>
                  <TerminalSimulator
                    intro="It speaks *OpenAI's API*"
                    command={{
                      managers: ["curl", "OpenClaw", "Hermes"],
                      text: "curl $NIMBUS/v1/chat/completions",
                    }}
                    lines={[
                      {
                        text: `-d '{"model":"nimbus/ship-nimbus"}'`,
                        type: "command",
                        delay: 0,
                      },
                      {
                        text: "→ run started · trigger: chat",
                        type: "success",
                        delay: 8,
                      },
                      {
                        text: "⚠ Needs your approval: open PR",
                        type: "log",
                        delay: 10,
                      },
                    ]}
                    fontSize={12}
                    mode="dark"
                    theme={SORBET}
                    fontFamily={MANROPE}
                  />
                </Series.Sequence>
                <Series.Sequence durationInFrames={len(11) - 255}>
                  <ProviderPanel />
                </Series.Sequence>
              </Series>
            </Scene>

            {/* 12 · three tiers */}
            <Scene n={12}>
              <TierGrid />
            </Scene>

            {/* 13 · the wordmark and the end card */}
            <Scene n={13}>
              <Series>
                <Series.Sequence durationInFrames={120}>
                  <WordmarkCut
                    word="NIMBUS"
                    dotFrom={C.blue}
                    dotTo={C.mint}
                    mode="dark"
                    theme={SORBET}
                    fontFamily={MANROPE}
                  />
                </Series.Sequence>
                <Series.Sequence durationInFrames={len(13) - 120}>
                  <EndCard />
                </Series.Sequence>
              </Series>
            </Scene>
          </AbsoluteFill>
        </FontGate>
      </SnapCnUIProvider>
    </TakeContext.Provider>
  );
}
