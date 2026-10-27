// NimbusFull (68 bars) and NimbusX (22 bars): the approved script (docs/video/script.md rev 4)
// on the board's grid (docs/video/board.md), sound from docs/video/sfx.md. Both cuts share
// the scene components; the X clip re-times them. No captions (user, Gate 1).
import { AbsoluteFill, Sequence, Series } from "remotion";
import { OrbSwarm } from "@/components/snap-cn/orb-swarm";
import { WordmarkCut } from "@/components/snap-cn/wordmark-cut";
import { SnapCnUIProvider } from "@/lib/snap-cn-ui";
import chat from "../../docs/video/chat-transcript.json";
import { ClickTrack, type Cue, SfxTrack } from "./audio";
import { type Beat, MOMENTS, momentFrame } from "./beats";
import { Card, Drift, FontGate, FootageLabel } from "./components/cards";
import { Footage, TakeContext } from "./Footage";
import { beats, bars, framesPerBeat, layout } from "./grid";
import { AgentChat, type ChatMessage, chatCues, fitCharFrames } from "./scenes/AgentChat";
import { ColumnCut, columnJumps } from "./scenes/ColumnCut";
import { CommentStorm, stormTable } from "./scenes/CommentStorm";
import { EndCard, PROOF, Proof } from "./scenes/Proof";
import { PROMPT_ROLL, PromptRoll, type RollOption, rollTicks } from "./scenes/PromptRoll";
import { C, MANROPE, SORBET } from "./theme";

export type CutProps = { beats: Beat[] | null; aspect: number; footage: string };

// docs/video/chat-transcript.json, real /v1 replies (mock mode, example data), shown verbatim.
// Per the planner's selection for the approved script: localhost link lines are dropped, and
// "approve all" shows "Approved: …", the brief's two header lines and item 1 cut at its first
// sentence with an ellipsis (a prefix of the endpoint's own words), then the scene ends.
type Exchange = { role: "user" | "nimbus"; text: string };
const EX = chat.exchanges as Exchange[];
const replyOf = (prompt: string) => EX[EX.findIndex((e) => e.role === "user" && e.text === prompt) + 1].text;
const keepLines = (text: string, n?: number) =>
  text
    .split("\n")
    .filter((l) => !/^https?:\/\//.test(l.trim()))
    .slice(0, n)
    .join("\n");
const exchange = (prompt: string, n?: number): ChatMessage[] => [
  { role: "user", text: prompt },
  { role: "assistant", text: keepLines(replyOf(prompt), n) },
];
const firstSentence = (line: string) => {
  const m = line.match(/^(\d+\.\s.*?\.)\s/);
  return m ? `${m[1]} …` : line;
};
const approveAll = exchange("approve all", 4);
approveAll[1] = {
  role: "assistant",
  text: approveAll[1].text
    .split("\n")
    .map((l, i) => (i === 3 ? firstSentence(l) : l))
    .join("\n"),
};
const TRANSCRIPT: ChatMessage[] = [...exchange("what needs me?"), ...exchange("run morning brief"), ...approveAll];
const semis = (k: number) => 2 ** (k / 12);

const ROLL_FULL: RollOption[] = [
  { text: "your morning brief", tint: C.mint },
  { text: "the hackathon radar", tint: C.blue },
  { text: "failing tests", tint: C.orange },
  { text: "your Token Factory bill", tint: C.lilac },
];
const ROLL_X = [ROLL_FULL[0], ROLL_FULL[2]];

const COLUMN_STILLS = Array.from({ length: 10 }, (_, i) => `column/${String(i + 1).padStart(2, "0")}.jpg`);

// ── Shared scene pieces ───────────────────────────────────────────────────────────────────

function Shell({ props, children }: { props: CutProps; children: React.ReactNode }) {
  return (
    <TakeContext.Provider value={props}>
      <SnapCnUIProvider theme={SORBET} mode="dark">
        <FontGate>
          <AbsoluteFill style={{ background: C.ink, fontFamily: MANROPE }}>{children}</AbsoluteFill>
        </FontGate>
      </SnapCnUIProvider>
    </TakeContext.Provider>
  );
}

function Crew({ frames }: { frames: number }) {
  const fail = momentFrame("crew", frames, MOMENTS.crewFail);
  const pass = momentFrame("crew", frames, MOMENTS.crewPass);
  return (
    <AbsoluteFill>
      <Footage
        shot="crew"
        frames={frames}
        camera={[
          { at: 0, duration: 1, zoom: 1.05, u: 0.42, v: 0.3 },
          { at: 2, duration: bars(2) - 2, zoom: 1.3, u: 0.42, v: 0.18 },
          { at: bars(2) + 10, duration: 60, zoom: 1.6, u: 0.5, v: 0.18 },
          { at: fail - 70, duration: 40, zoom: 1.6, u: 0.85, v: 0.3 },
          { at: fail - 6, duration: 6, zoom: 2.4, u: 0.86, v: 0.42 },
          { at: fail + 60, duration: 30, zoom: 1.4, u: 0.62, v: 0.32 },
          { at: pass - 12, duration: 24, zoom: 1.7, u: 0.85, v: 0.3 },
        ]}
      />
      <FootageLabel text="Nemotron 3 Ultra plans. Super and Nano do the work." from={bars(1)} to={bars(1) + 90} />
      <FootageLabel text="Something failed. It tried again." from={fail} to={fail + 120} />
    </AbsoluteFill>
  );
}

function Plan({ frames }: { frames: number }) {
  const approve = momentFrame("plan", frames, MOMENTS.planApprove);
  return (
    <AbsoluteFill>
      <Footage
        shot="plan"
        frames={frames}
        camera={[
          { at: 0, duration: 1, zoom: 1.4, u: 0.46, v: 0.55 },
          { at: 10, duration: 80, zoom: 1.6, u: 0.46, v: 0.55 },
          { at: 110, duration: 30, zoom: 1.8, u: 0.5, v: 0.62 },
          { at: approve - 40, duration: 25, zoom: 1.6, u: 0.58, v: 0.74 },
        ]}
        rings={[{ at: approve, u: 0.607, v: 0.776 }]}
      />
      <FootageLabel text="You pick its tools. It shows its plan first." from={20} to={200} />
    </AbsoluteFill>
  );
}

/** The PR gate on the take: approve lands on `approve` frames into the shot. */
function Gate({ frames, label }: { frames: number; label?: string }) {
  const approve = momentFrame("gate", frames, MOMENTS.gateApprove);
  return (
    <AbsoluteFill>
      <Footage
        shot="gate"
        frames={frames}
        camera={[
          { at: 0, duration: 1, zoom: 1.3, u: 0.46, v: 0.55 },
          { at: 20, duration: 40, zoom: 1.55, u: 0.46, v: 0.58 },
          { at: 120, duration: 6, zoom: 2.0, u: 0.42, v: 0.6 },
          { at: approve - 25, duration: 20, zoom: 1.6, u: 0.52, v: 0.75 },
          { at: approve + 5, duration: 30, zoom: 1.25, u: 0.5, v: 0.55 },
        ]}
        rings={[{ at: approve, u: 0.54, v: 0.77 }]}
      />
      {label ? <FootageLabel text={label} from={20} to={frames - 10} /> : null}
    </AbsoluteFill>
  );
}
const gateApprove = (frames: number) => momentFrame("gate", frames, MOMENTS.gateApprove);

function ChatRun({ frames }: { frames: number }) {
  return (
    <AbsoluteFill>
      <Footage
        shot="chatRun"
        frames={frames}
        camera={[
          { at: 0, duration: 1, zoom: 1.5, u: 0.86, v: 0.15 },
          { at: 10, duration: frames - 10, zoom: 1.75, u: 0.85, v: 0.2 },
        ]}
      />
      <FootageLabel text="Same crew. Through OpenClaw." from={10} to={frames - 5} />
    </AbsoluteFill>
  );
}

function Memory({ frames }: { frames: number }) {
  return (
    <AbsoluteFill>
      <Footage
        shot="memory"
        frames={frames}
        camera={[
          { at: 0, duration: 1, zoom: 1.5, u: 0.85, v: 0.2 },
          { at: 50, duration: 40, zoom: 1.85, u: 0.87, v: 0.12 },
          { at: 130, duration: 70, zoom: 1.6, u: 0.87, v: 0.7 },
        ]}
      />
      <FootageLabel text="It writes down what it learned. You can delete it." from={20} to={frames - 15} />
    </AbsoluteFill>
  );
}

function RunTwo({ frames, shot = "runTwo" }: { frames: number; shot?: "runTwo" | "runTwoX" }) {
  const learned = momentFrame(shot, frames, MOMENTS.runTwoLearned);
  return (
    <Footage
      shot={shot}
      frames={frames}
      camera={[
        { at: 0, duration: 1, zoom: 1.6, u: 0.46, v: 0.55 },
        { at: Math.max(2, learned - 130), duration: 30, zoom: 1.8, u: 0.42, v: 0.63 },
        { at: learned - 20, duration: 25, zoom: 1.7, u: 0.3, v: 0.1 },
      ]}
    />
  );
}
const learnedAt = (frames: number, shot: "runTwo" | "runTwoX" = "runTwo") => momentFrame(shot, frames, MOMENTS.runTwoLearned);

const nameScript = "Nimbus | an always-on crew | of NVIDIA | Nemotron agents | on Nebius | Token Factory";

// QA "cuts on the beat": every scene starts on a beat, or the bundle refuses to load.
function onTheBeat(name: string, scenes: readonly { id: string; from: number }[]) {
  const off = scenes.filter((s) => s.from % framesPerBeat !== 0);
  if (off.length) throw new Error(`${name}: scenes off the beat: ${off.map((s) => s.id).join(", ")}`);
}

// ── NimbusFull ────────────────────────────────────────────────────────────────────────────

export const FULL = layout([
  { id: "roll", bars: 2 },
  { id: "storm", bars: 4 },
  { id: "name", bars: 3 },
  { id: "ch1", bars: 1 },
  { id: "column", bars: 4 },
  { id: "crew", bars: 9 },
  { id: "ch2", bars: 1 },
  { id: "plan", bars: 4 },
  { id: "gate", bars: 6 },
  { id: "data", bars: 3 },
  { id: "ch3", bars: 1 },
  { id: "chat", bars: 10 }, // 8 + scene 14's 2 bars (Hermes, Phase D not recorded)
  { id: "chatRun", bars: 2 },
  { id: "ch4", bars: 1 },
  { id: "memory", bars: 4 },
  { id: "runTwo", bars: 5 },
  { id: "proof", bars: 5 },
  { id: "end", bars: 3 },
] as const);
export const FULL_FRAMES = FULL[FULL.length - 1].from + FULL[FULL.length - 1].frames;
onTheBeat("NimbusFull", FULL);
const F = Object.fromEntries(FULL.map((s) => [s.id, s])) as Record<(typeof FULL)[number]["id"], (typeof FULL)[number]>;

// The board's 9 s of gate footage can't reach the approval at ≤ 1.5× on this slow take: 10 s,
// then the "anything" card for the scene's last 2 s. Still on the beat.
const GATE_FOOTAGE = beats(20);
const RUN_TWO_FOOTAGE = bars(3);
// The one chosen rate in Agent Chat: whatever makes the transcript end 1.5 s before the cut.
const CHAT_CHARS = fitCharFrames(TRANSCRIPT, bars(10));
const STORM_FULL = stormTable(14);

export const FULL_SILENCES: [number, number][] = [
  [F.storm.from + F.storm.frames - 4, F.name.from],
  [F.end.from - beats(1), F.end.from],
];

function fullCues(): Cue[] {
  const c: Cue[] = [];
  const add = (at: number, file: string, db: number, extra: Partial<Cue> = {}) => c.push({ at, file, db, ...extra });
  // 1 · Prompt Roll
  for (let f = 0; f < 34; f += 2) add(f, "type-soft", -26);
  rollTicks(ROLL_FULL.length).forEach((f, k) => add(f, "roll-tick", -24, { tone: semis(k) }));
  add(PROMPT_ROLL.PRESS_AT, "click-press", -22);
  add(PROMPT_ROLL.FLY_AT, "swoosh-up", -18);
  add(112, "whoosh-rev-a", -16, { trim: 6 });
  // 2 · Comment Storm
  STORM_FULL.forEach((it, i) => add(F.storm.from + it.at, `pop-${(i % 5) + 1}`, -24 + (4 * i) / (STORM_FULL.length - 1)));
  add(F.storm.from + 180, "rumble", -20);
  add(F.storm.from + 220, "whoosh-in", -16);
  // 3 · the name
  add(F.name.from, "glass-1", -24);
  add(F.name.from + 30, "glass-2", -24);
  add(F.name.from + 90, "glass-3", -24);
  add(F.name.from + 120, "riser-1bar", -20);
  add(F.ch1.from, "impact-soft", -16);
  add(F.ch1.from - 8, "whoosh-b", -18);
  // 4 · chapter 1
  add(F.ch1.from + 16, "marker", -26);
  add(F.column.from - 8, "whoosh-c", -18);
  // 5 · Column Cut
  for (let f = 40; f <= 80; f += 3) add(F.column.from + f, "tick-tiny", -30);
  add(F.column.from + 90, "thud", -18);
  columnJumps().forEach((f) => add(F.column.from + f, "shutter", -24));
  add(F.crew.from - 7, "whoosh-pan", -16);
  // 6 · the crew
  add(F.crew.from + momentFrame("crew", F.crew.frames, MOMENTS.crewFail) - 6, "glitch", -18);
  add(F.crew.from + momentFrame("crew", F.crew.frames, MOMENTS.crewPass), "chime-ok", -20);
  add(F.ch2.from - 8, "whoosh-d", -18);
  // 7 · chapter 2
  add(F.ch2.from + 16, "pen", -26);
  // 8 · the plan
  add(F.plan.from + 10, "click", -24);
  [120, 132, 144].forEach((f, k) => add(F.plan.from + f, "tick", -24, { tone: semis(k) }));
  add(F.plan.from + 170, "drag", -24);
  add(F.plan.from + momentFrame("plan", F.plan.frames, MOMENTS.planApprove), "click-press", -22);
  // 9 · the gate
  add(F.gate.from + 10, "alert-soft", -22);
  add(F.gate.from + gateApprove(GATE_FOOTAGE), "click-press", -16);
  add(F.gate.from + gateApprove(GATE_FOOTAGE), "sub-hit", -16);
  add(F.gate.from + GATE_FOOTAGE + 16, "shimmer", -24);
  // 10 · your data
  add(F.data.from + 16, "strike", -26);
  add(F.data.from + 50, "marker", -26);
  add(F.ch3.from - 8, "pop-whoosh", -18);
  // 12 · the chat
  const cc = chatCues(TRANSCRIPT, CHAT_CHARS);
  cc.keys.forEach((f) => add(F.chat.from + f, "type-soft", -26));
  cc.sends.forEach((f) => add(F.chat.from + f, "send", -20));
  cc.dots.forEach((f) => add(F.chat.from + f, "dots", -26));
  cc.pops.forEach((f) => add(F.chat.from + f, "pop-1", -20));
  cc.chimes.forEach((f) => add(F.chat.from + f, "chime-ok", -20));
  add(F.chatRun.from - 8, "whoosh-e", -18);
  add(F.ch4.from - 8, "whoosh-f", -18);
  // 15 · chapter 4
  add(F.ch4.from + 16, "sweep", -26);
  // 16 · memory
  add(F.memory.from + 60, "tick", -24);
  add(F.memory.from + 75, "tick", -24, { tone: semis(1) });
  add(F.memory.from + 130, "page", -24);
  // 17 · run two
  add(F.runTwo.from + learnedAt(RUN_TWO_FOOTAGE), "pop-bright", -20);
  add(F.runTwo.from + RUN_TWO_FOOTAGE, "impact-soft", -16);
  // 18 · proof
  PROOF.tiles.forEach((f) => add(F.proof.from + f, "sub-hit", -16));
  add(F.end.from - bars(2), "riser-2bar", -18, { frames: bars(2) - beats(1) });
  // 19 · end
  add(F.end.from, "impact-deep", -14);
  return c;
}
export const FULL_CUES = fullCues();

export function NimbusFull(props: CutProps) {
  const S = (id: keyof typeof F, node: React.ReactNode) => (
    <Sequence from={F[id].from} durationInFrames={F[id].frames} name={id}>
      {node}
    </Sequence>
  );
  return (
    <Shell props={props}>
      {S("roll", <PromptRoll lead="Let Nimbus handle" options={ROLL_FULL} />)}
      {S("storm", <CommentStorm opener="8:00 a.m." items={STORM_FULL} />)}
      {S(
        "name",
        <OrbSwarm script={nameScript} background={C.ink} ink={C.paper} orbColor={C.blue} fontFamily={MANROPE} mode="dark" softness={0} speed={160 / 172} />,
      )}
      {S("ch1", <Card chapter="1" line={{ before: "It works while you're ", highlight: "away", preset: "marker" }} size={84} />)}
      {S(
        "column",
        <ColumnCut
          lines={["Morning brief · 08:00", "Hackathon radar · 09:00", "Repo checks · nightly", "Token Factory watch · 07:00"]}
          highlightLine={2}
          stills={COLUMN_STILLS}
          left="On a schedule"
          right="on Nebius Serverless"
        />,
      )}
      {S("crew", <Crew frames={F.crew.frames} />)}
      {S("ch2", <Card chapter="2" line={{ before: "Your tasks, your tools, ", highlight: "your OK", preset: "underline" }} size={84} />)}
      {S("plan", <Plan frames={F.plan.frames} />)}
      {S(
        "gate",
        <Series>
          <Series.Sequence durationInFrames={GATE_FOOTAGE}>
            <Gate frames={GATE_FOOTAGE} />
          </Series.Sequence>
          <Series.Sequence durationInFrames={F.gate.frames - GATE_FOOTAGE}>
            <Card line={{ before: "Before it sends ", highlight: "anything", after: ", it asks.", preset: "color" }} size={84} />
          </Series.Sequence>
        </Series>,
      )}
      {S(
        "data",
        <Card
          line={{ before: "Your data: ", highlight: "their servers", replaceWith: "your database", after: ".", preset: "strikethrough" }}
          more={["Your keys. Your spend cap."]}
          size={84}
        />,
      )}
      {S("ch3", <Card chapter="3" line={{ before: "Talk to it where you ", highlight: "already talk", preset: "shimmer" }} size={84} />)}
      {S(
        "chat",
        <Drift to={1.1}>
          <AgentChat transcript={TRANSCRIPT} charFrames={CHAT_CHARS} />
        </Drift>,
      )}
      {S("chatRun", <ChatRun frames={F.chatRun.frames} />)}
      {S("ch4", <Card chapter="4" line={{ before: "It learns from ", highlight: "every run", preset: "color" }} size={84} />)}
      {S("memory", <Memory frames={F.memory.frames} />)}
      {S(
        "runTwo",
        <Series>
          <Series.Sequence durationInFrames={RUN_TWO_FOOTAGE}>
            <RunTwo frames={RUN_TWO_FOOTAGE} />
          </Series.Sequence>
          <Series.Sequence durationInFrames={F.runTwo.frames - RUN_TWO_FOOTAGE}>
            <Card line={{ before: "The next day: $0.080 → ", highlight: "$0.045", after: " per run", preset: "marker" }} size={72} mock />
          </Series.Sequence>
        </Series>,
      )}
      {S("proof", <Proof />)}
      {S(
        "end",
        <Series>
          <Series.Sequence durationInFrames={bars(1)}>
            <WordmarkCut word="NIMBUS" dotFrom={C.blue} dotTo={C.mint} mode="dark" theme={SORBET} fontFamily={MANROPE} speed={66 / 60} />
          </Series.Sequence>
          <Series.Sequence durationInFrames={F.end.frames - bars(1)}>
            <EndCard />
          </Series.Sequence>
        </Series>,
      )}
      <ClickTrack silences={FULL_SILENCES} volume={0.7} />
      <SfxTrack cues={FULL_CUES} />
    </Shell>
  );
}

// ── NimbusX ───────────────────────────────────────────────────────────────────────────────

export const XCUT = layout([
  { id: "roll", bars: 2 },
  { id: "storm", bars: 3 },
  { id: "name", bars: 2 },
  { id: "gate", bars: 4 },
  { id: "chat", bars: 4 },
  { id: "runTwo", bars: 3 },
  { id: "end", bars: 4 },
] as const);
export const X_FRAMES = XCUT[XCUT.length - 1].from + XCUT[XCUT.length - 1].frames;
onTheBeat("NimbusX", XCUT);
const X = Object.fromEntries(XCUT.map((s) => [s.id, s])) as Record<(typeof XCUT)[number]["id"], (typeof XCUT)[number]>;

const STORM_X = stormTable(8, 30, 0.8);
const CHAT_X = TRANSCRIPT.slice(2);
const CHAT_X_CHARS = fitCharFrames(CHAT_X, bars(4), 30);
const X_RUN_TWO_FOOTAGE = bars(1.5);

export const X_SILENCES: [number, number][] = [
  [X.storm.from + X.storm.frames - 4, X.name.from],
  [X.end.from - beats(1), X.end.from],
];

function xCues(): Cue[] {
  const c: Cue[] = [];
  const add = (at: number, file: string, db: number, extra: Partial<Cue> = {}) => c.push({ at, file, db, ...extra });
  for (let f = 0; f < 34; f += 2) add(f, "type-soft", -26);
  rollTicks(ROLL_X.length).forEach((f, k) => add(f, "roll-tick", -24, { tone: semis(k) }));
  add(PROMPT_ROLL.PRESS_AT, "click-press", -22);
  add(PROMPT_ROLL.FLY_AT, "swoosh-up", -18);
  add(112, "whoosh-rev-a", -16, { trim: 6 });
  STORM_X.forEach((it, i) => add(X.storm.from + it.at, `pop-${(i % 5) + 1}`, -24 + (4 * i) / (STORM_X.length - 1)));
  add(X.storm.from + X.storm.frames - 60, "rumble", -20, { frames: 56 });
  add(X.storm.from + X.storm.frames - 20, "whoosh-in", -16);
  add(X.name.from, "glass-1", -24);
  add(X.name.from + 45, "glass-3", -24);
  add(X.gate.from, "impact-soft", -16);
  add(X.gate.from + 10, "alert-soft", -22);
  add(X.gate.from + gateApprove(X.gate.frames), "click-press", -16);
  add(X.gate.from + gateApprove(X.gate.frames), "sub-hit", -16);
  add(X.chat.from - 8, "pop-whoosh", -18);
  const cc = chatCues(CHAT_X, CHAT_X_CHARS);
  cc.keys.forEach((f) => add(X.chat.from + f, "type-soft", -26));
  cc.sends.forEach((f) => add(X.chat.from + f, "send", -20));
  cc.dots.forEach((f) => add(X.chat.from + f, "dots", -26));
  cc.pops.forEach((f) => add(X.chat.from + f, "pop-1", -20));
  cc.chimes.forEach((f) => add(X.chat.from + f, "chime-ok", -20));
  add(X.runTwo.from - 8, "whoosh-e", -18);
  add(X.runTwo.from + learnedAt(X_RUN_TWO_FOOTAGE, "runTwoX"), "pop-bright", -20);
  add(X.runTwo.from + X_RUN_TWO_FOOTAGE + 16, "shimmer", -24);
  add(X.end.from, "impact-deep", -14);
  return c;
}
export const X_CUES = xCues();

export function NimbusX(props: CutProps) {
  const S = (id: keyof typeof X, node: React.ReactNode) => (
    <Sequence from={X[id].from} durationInFrames={X[id].frames} name={id}>
      {node}
    </Sequence>
  );
  return (
    <Shell props={props}>
      {S("roll", <PromptRoll lead="Let Nimbus handle" options={ROLL_X} />)}
      {S("storm", <CommentStorm opener="8:00 a.m." items={STORM_X} />)}
      {S(
        "name",
        <OrbSwarm script={nameScript} background={C.ink} ink={C.paper} orbColor={C.blue} fontFamily={MANROPE} mode="dark" softness={0} speed={160 / 112} />,
      )}
      {S("gate", <Gate frames={X.gate.frames} label="Before it sends anything, it asks." />)}
      {S(
        "chat",
        <Drift to={1.06}>
          <AgentChat transcript={CHAT_X} charFrames={CHAT_X_CHARS} />
        </Drift>,
      )}
      {S(
        "runTwo",
        <Series>
          <Series.Sequence durationInFrames={X_RUN_TWO_FOOTAGE}>
            <RunTwo frames={X_RUN_TWO_FOOTAGE} shot="runTwoX" />
          </Series.Sequence>
          <Series.Sequence durationInFrames={X.runTwo.frames - X_RUN_TWO_FOOTAGE}>
            <Card line={{ before: "It learns from ", highlight: "every run", after: ".", preset: "color" }} size={84} />
          </Series.Sequence>
        </Series>,
      )}
      {S(
        "end",
        <Series>
          <Series.Sequence durationInFrames={bars(1)}>
            <WordmarkCut word="NIMBUS" dotFrom={C.blue} dotTo={C.mint} mode="dark" theme={SORBET} fontFamily={MANROPE} speed={66 / 60} />
          </Series.Sequence>
          <Series.Sequence durationInFrames={X.end.frames - bars(1)}>
            <EndCard />
          </Series.Sequence>
        </Series>,
      )}
      <ClickTrack silences={X_SILENCES} volume={0.7} />
      <SfxTrack cues={X_CUES} />
    </Shell>
  );
}
