// NimbusFull (88 bars) and NimbusX (22 bars): script rev 6 on board rev E (docs/video/), sound
// from sfx.md rev E on the music.md rev D map. The v3 opening, the name, a laptop dive into
// the real app, a one-bar card at each chapter, the footage on a tilted camera that flattens
// while a callout is open, Phone Stack for the chat, the proof, a terminal and the end card.
import { AbsoluteFill, interpolate, Sequence, Series, useCurrentFrame, useVideoConfig } from "remotion";
import { PhoneStack } from "@/components/snap-cn/phone-stack";
import { SnapCnUIProvider } from "@/lib/snap-cn-ui";
import chat from "../../docs/video/chat-transcript-real.json";
import { type Cue, MusicBed, SfxTrack } from "./audio";
import { MOMENTS, momentFrame } from "./beats";
import { Callout, type CalloutSpec, Eyebrow } from "./components/Callout";
import { FontGate } from "./components/cards";
import { Footage } from "./Footage";
import { beats } from "./grid";
import type { ChatMessage } from "./scenes/AgentChat";
import { CHECK, ChapterCheck, ChapterGather, ChapterHighlight, HIGHLIGHT } from "./scenes/ChapterCards";
import { LockupEnd } from "./scenes/Lockup";
import { MetricMorph, MORPH } from "./scenes/MetricMorph";
import { HOOK_FULL, HOOK_X, Hook, LAPTOP, LaptopDive, Name, NAME } from "./scenes/Opening";
import { ORBIT, OrbitFlow } from "./scenes/OrbitFlow";
import { ChatScreen } from "./scenes/PhoneChat";
import { PROOF, Proof } from "./scenes/Proof";
import { RunIt, TYPING, URL_LINE_AT } from "./scenes/RunIt";
import { ScatterBloom } from "./scenes/ScatterBloom";
import {
  after,
  b,
  CHAPTERS,
  F,
  FULL_MOTION,
  FULL_SCENE_SHOTS,
  gate1,
  gate2,
  gateAllow,
  LAPTOP_FRAMES,
  PHONE_CALLOUT,
  type Shot,
  timelineAgentIo,
  X,
  X_SCENE_SHOTS,
  xApprove,
} from "./shots";
import { C, GROUND, MANROPE, SORBET } from "./theme";

export { FULL_FRAMES, X_FRAMES } from "./shots";

// ── The chat transcript (docs/video/chat-transcript-real.json: the live Railway run
// run_6b393ab6 on the real models, verbatim) ──────────────────────────────────────────────
// Selection rules as before: link lines dropped; the brief in the last reply cut after its
// first item with " …". No other word is changed.
type Exchange = { role: "user" | "nimbus"; text: string };
const keepLines = (text: string) => text.split("\n").filter((l) => !/^https?:\/\//.test(l.trim()));
/** The last reply carries the brief: keep its first line, the brief's heading and its first item. */
const cutBrief = (lines: string[]) => {
  const at = lines.findIndex((l) => l.trim() === "Needs you today");
  return at < 0 ? lines : [...lines.slice(0, at + 2).map((l, k, a) => (k === a.length - 1 ? `${l} …` : l))];
};
const TRANSCRIPT: ChatMessage[] = (chat.exchanges as Exchange[]).map((e, k, all) => {
  if (e.role === "user") return { role: "user", text: e.text };
  const ls = keepLines(e.text);
  return { role: "assistant", text: (k === all.length - 1 ? cutBrief(ls) : ls).join("\n") };
});
// ── Shared pieces ─────────────────────────────────────────────────────────────────────────
/** A scene of one or more footage shots played back to back. */
function Shots({ shots }: { shots: Shot[] }) {
  return (
    <Series>
      {shots.map((s, i) => (
        <Series.Sequence key={i} durationInFrames={s.frames}>
          <Footage shot={s.shot} frames={s.frames} camera={s.camera} callouts={s.callouts} rings={s.rings} ticks={s.ticks} tilt={s.tilt} />
        </Series.Sequence>
      ))}
    </Series>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SnapCnUIProvider theme={SORBET} mode="dark">
      <FontGate>
        <AbsoluteFill style={{ background: C.bg, fontFamily: MANROPE }}>
          {children}
        </AbsoluteFill>
      </FontGate>
    </SnapCnUIProvider>
  );
}

/** Scene 3: the laptop dive over the Overview's first 75 frames, then the footage. */
function Overview() {
  return (
    <AbsoluteFill>
      <Shots shots={FULL_SCENE_SHOTS.overview!} />
      <Sequence durationInFrames={LAPTOP_FRAMES}>
        <LaptopDive />
      </Sequence>
    </AbsoluteFill>
  );
}

/** Phone Stack: one screen per message, each the chat so far; a slow push under it so the
 *  last phone's hold never reads as a freeze. The X clip's three phones land a bar apart. */
const STACK_FROM = 6;
function ChatStack({ messages, callout, every = beats(2) }: { messages: ChatMessage[][]; callout?: CalloutSpec; every?: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const push = interpolate(frame, [0, durationInFrames], [1, 1.07], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // the front phone: Phone Stack's screen (240 of 716 reference px, top 74) at 1920 wide
  const u = 1920 / 716;
  const w = 240 * u;
  const top = (1080 - 398 * u) / 2 + 74 * u;
  // the front phone through the push (scaled about 50 % 30 %)
  const oy = 0.3 * 1080;
  const box = { x: 960 - (w / 2) * push, y: oy + (top - oy) * push, w: w * push, h: (1080 - 60 - top) * push };
  return (
    <AbsoluteFill style={{ background: GROUND }}>
      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: "50% 30%" }}>
      <Sequence from={STACK_FROM} layout="none">
        <PhoneStack
          screens={messages.map((m, i) => (
            <ChatScreen key={i} messages={m} arrive={i * every + 10} />
          ))}
          stagger={every}
          background={C.bg}
          glowColor="transparent"
          statusColor={C.ink}
          time="8:02"
        />
      </Sequence>
      </AbsoluteFill>
      {callout ? <Callout spec={callout} box={box} scope="phone" /> : null}
    </AbsoluteFill>
  );
}
/** The screens, each the chat so far (a phone shows its newest three messages). Full cut: seven
 *  phones two beats apart, from the first "Needs your OK" (message 4) to the last reply with the
 *  brief (message 10); the opening "what needs me?" exchange shows at the top of the first.
 *  X clip: three phones a bar apart: the first "Needs your OK", an "approve", the last reply. */
const upTo = (n: number) => TRANSCRIPT.slice(0, n);
const STACK_FULL = [4, 5, 6, 7, 8, 9, 10].map(upTo);
const STACK_X = [4, 9, 10].map(upTo);
/** Frames each phone lands on (Phone Stack's rise is 26 frames). */
const stackArrivals = (n: number, every = beats(2)) => Array.from({ length: n }, (_, i) => STACK_FROM + i * every + 13);
const X_STACK_EVERY = beats(4);

/** Scene 19: the call log blooms on the plane; the tiles land on it from bar 2. */
function ProofScene() {
  return (
    <AbsoluteFill>
      <ScatterBloom dimFrom={PROOF.tiles[0]} />
      <Proof />
    </AbsoluteFill>
  );
}

// The music bed: the Suno track fitted to each cut by scripts/fit-music.py (stretched to
// 120 BPM, segments on bar lines; music.md "Fit"). Both files are gitignored: run the script
// after placing public/audio/music-full.mp3. The temp score (scripts/make-sound.mjs,
// music-temp-*.mp3) follows the same map if the track is missing.
const MUSIC = { full: "audio/music-full-fit.mp3", x: "audio/music-x.mp3" };
/** Footage spans for the music bed (motion scenes count as cards). */
const span = (ids: (keyof typeof F)[]) => ids.map((id) => [after(id), F[id].from + F[id].frames] as [number, number]);

/** Shared sound moments of the opening (the same scenes open both cuts). */
function openingCues(add: (at: number, file: string, db: number, extra?: Partial<Cue>) => void, hook: { from: number; frames: number }, name: number) {
  for (let i = 0; i < 4; i++) add(hook.from + 2 + (i * hook.frames) / 4, "orb-burst", -24, { tone: [1, 1.12, 1.26, 1.5][i] });
  add(name + b(1), "riser-1bar", -20, { frames: b(1) });
  // the six letter flashes (Block Wordmark: from about frame 73 of the scene, 4 frames apart at speed 1.2)
  for (let i = 0; i < 6; i++) add(name + Math.round((70 + i * 4) / NAME.speed), "block-flash", -26, { tone: 1 + i * 0.06 });
  add(name + NAME.cloudIn + 8, "ready-subtle", -24);
}

function fullCues(): Cue[] {
  const c: Cue[] = [];
  const add = (at: number, file: string, db: number, extra: Partial<Cue> = {}) => c.push({ at: Math.round(at), file, db, ...extra });
  openingCues(add, F.hook, F.name.from);
  // 3 Overview: lid, the notch notification, the dive, the cards counting
  add(F.overview.from, "impact-soft", -18);
  add(F.overview.from + 2, "lid-open", -22);
  add(F.overview.from + LAPTOP.notch, "attention", -22);
  add(F.overview.from + LAPTOP.dive, "whoosh-a", -22);
  add(F.overview.from + LAPTOP_FRAMES, "count-2s", -24);
  // 4 Ch 1: the words drop in
  for (let i = 0; i < 5; i++) add(F.ch1.from + 18 + i * 5, "word-drop", -26);
  // 5 goal → plan
  for (let f = 14; f < 92; f += 6) add(F.plan.from + f, "type", -30);
  add(F.plan.from + 100, "tap", -22);
  const planShot = F.plan.from + b(2);
  add(planShot + momentFrame("plan", b(4), MOMENTS.planArrives), "ready-subtle", -22);
  add(planShot + momentFrame("plan", b(4), MOMENTS.approvePlan), "tap", -22);
  add(planShot + momentFrame("plan", b(4), MOMENTS.approvePlan) + 4, "select", -24);
  // 6 timeline, 7 brief
  add(F.timeline.from, "loading-subtle", -22);
  add(F.timeline.from + timelineAgentIo, "select", -24);
  add(F.doc.from - 8, "whoosh-b", -22);
  add(F.doc.from, "ready", -20);
  // 8 Ch 2: the marker, the cloud turns orange
  add(F.ch2.from + HIGHLIGHT.start, "marker", -20);
  add(F.ch2.from + HIGHLIGHT.orange, "attention", -18);
  // 9 approvals: the drop lands on the first Approve (frame 2280)
  add(F.gate.from + gate1, "success", -16);
  add(F.gate.from + gate1, "sub-hit", -18);
  add(F.gate.from + gate2, "success", -20);
  add(F.gate.from + gateAllow, "success-strong", -16);
  // 10 summary
  add(F.summary.from, "morph-suck", -20);
  add(F.summary.from + MORPH.slam, "morph-slam", -16);
  add(after("summary") + 8, "count-700", -22);
  add(after("summary") + 33, "ready", -20);
  // 11 Ch 3: four rolls, the tick
  add(F.ch3.from, "success", -28);
  for (let k = 0; k < 4; k++) add(F.ch3.from + Math.round(((0.0324 + k * 0.667) / CHECK.speed) * 30), "slot-roll", -26, { tone: 1 + k * 0.06 });
  // 12 memory, 13 run two
  add(F.memory.from, "select", -24);
  add(F.memory.from + b(4), "open-subtle", -26);
  add(F.run2.from + 10, "ready-subtle", -22);
  add(F.run2.from + b(3), "success", -20);
  // 14 Ch 4, 15 radar + pill
  add(F.ch4.from, "orbit-swell", -20);
  add(F.ch4.from + ORBIT.whip - 8, "orbit-suck", -18);
  add(F.radar.from, "navigate", -24);
  add(F.radar.from + b(2) + 10, "attention", -20);
  add(F.radar.from + b(4) + momentFrame("pillApprove", b(1), MOMENTS.pillApprove), "success", -20);
  // 16 chat: a tap per sent message, the reply's ready, success on "Approved"
  stackArrivals(STACK_FULL.length).forEach((f, i) => {
    const last = i === STACK_FULL.length - 1;
    const newest = STACK_FULL[i][STACK_FULL[i].length - 1];
    add(F.chat.from + f, last ? "success-strong" : newest.role === "user" ? "tap" : "ready-subtle", last ? -18 : -24);
  });
  // 17 web run (hard cut), 18 watch
  add(F.chatRun.from, "cut-dry", -20);
  add(F.watch.from, "attention", -20);
  add(F.watch.from + momentFrame("watch", b(2), MOMENTS.watchApprove), "success", -20);
  add(F.watch.from + b(2), "count-700", -22);
  // 19 proof
  add(F.proof.from + 4, "bloom-sparkle", -22);
  PROOF.tiles.forEach((f) => add(F.proof.from + f, "sub-hit", -16));
  add(F.proof.from + PROOF.count, "count-700", -22);
  // 20 terminal: a key every 3 frames while a command types; ready on the URL line
  for (const [a, z] of TYPING) for (let f = a; f < z; f += 3) add(F.terminal.from + f, "type", -32);
  add(F.terminal.from + URL_LINE_AT, "ready", -20);
  // 21 end
  add(F.end.from, "impact-deep", -14);
  return c;
}
export const FULL_CUES = fullCues();

export function NimbusFull() {
  const S = (id: keyof typeof F, node: React.ReactNode) => (
    <Sequence from={F[id].from} durationInFrames={F[id].frames} name={id}>
      {node}
    </Sequence>
  );
  return (
    <Shell>
      {S("hook", <Hook script={HOOK_FULL} frames={F.hook.frames} />)}
      {S("name", <Name />)}
      {S("overview", <Overview />)}
      {S("ch1", <ChapterGather />)}
      {S("plan", <Shots shots={FULL_SCENE_SHOTS.plan!} />)}
      {S("timeline", <Shots shots={FULL_SCENE_SHOTS.timeline!} />)}
      {S("doc", <Shots shots={FULL_SCENE_SHOTS.doc!} />)}
      {S("ch2", <ChapterHighlight />)}
      {S("gate", <Shots shots={FULL_SCENE_SHOTS.gate!} />)}
      {S(
        "summary",
        <Series>
          <Series.Sequence durationInFrames={FULL_MOTION.summary!}>
            <MetricMorph />
          </Series.Sequence>
          <Series.Sequence durationInFrames={F.summary.frames - FULL_MOTION.summary!}>
            <Shots shots={FULL_SCENE_SHOTS.summary!} />
          </Series.Sequence>
        </Series>,
      )}
      {S("ch3", <ChapterCheck />)}
      {S("memory", <Shots shots={FULL_SCENE_SHOTS.memory!} />)}
      {S("run2", <Shots shots={FULL_SCENE_SHOTS.run2!} />)}
      {S("ch4", <OrbitFlow />)}
      {S("radar", <Shots shots={FULL_SCENE_SHOTS.radar!} />)}
      {S("chat", <ChatStack messages={STACK_FULL} callout={PHONE_CALLOUT} />)}
      {S("chatRun", <Shots shots={FULL_SCENE_SHOTS.chatRun!} />)}
      {S("watch", <Shots shots={FULL_SCENE_SHOTS.watch!} />)}
      {S("proof", <ProofScene />)}
      {S("terminal", <RunIt />)}
      {S("end", <LockupEnd />)}
      {CHAPTERS.map((ch) => (
        <Sequence key={ch.from} from={ch.from} durationInFrames={ch.to - ch.from} name={`chapter ${ch.n}`}>
          <Eyebrow n={ch.n} title={ch.title} />
        </Sequence>
      ))}
      <MusicBed
        src={MUSIC.full}
        footage={span(["overview", "plan", "timeline", "doc", "gate", "summary", "memory", "run2", "radar", "chatRun", "watch"])}
        cues={FULL_CUES}
        lifts={[
          [F.gate.from + gate1, F.gate.from + gate1 + b(2)],
          [F.terminal.from, F.terminal.from + F.terminal.frames - beats(1)],
        ]}
      />
      <SfxTrack cues={FULL_CUES} />
    </Shell>
  );
}

// ── NimbusX ───────────────────────────────────────────────────────────────────────────────

function xCues(): Cue[] {
  const c: Cue[] = [];
  const add = (at: number, file: string, db: number, extra: Partial<Cue> = {}) => c.push({ at: Math.round(at), file, db, ...extra });
  openingCues(add, X.hook, X.name.from);
  add(X.plan.from, "impact-soft", -18);
  add(X.plan.from + momentFrame("xPlan", b(3), MOMENTS.planArrives), "ready-subtle", -22);
  add(X.plan.from + momentFrame("xPlan", b(3), MOMENTS.approvePlan), "tap", -22);
  add(X.lanes.from, "loading-subtle", -22);
  add(X.ch2.from + HIGHLIGHT.start, "marker", -20);
  add(X.ch2.from + HIGHLIGHT.orange, "attention", -18);
  // the drop lands on the Approve (frame 690)
  add(X.gate.from + xApprove, "success", -16);
  add(X.gate.from + xApprove, "sub-hit", -18);
  add(X.run2.from - 8, "whoosh-d", -22);
  add(X.run2.from + 10, "ready-subtle", -22);
  stackArrivals(STACK_X.length, X_STACK_EVERY).forEach((f, i) => {
    const last = i === STACK_X.length - 1;
    const newest = STACK_X[i][STACK_X[i].length - 1];
    add(X.chat.from + f, last ? "success-strong" : newest.role === "user" ? "tap" : "ready-subtle", last ? -18 : -24);
  });
  // the X terminal runs at 3× (one bar): a key per 3 frames over each command, ready on the URL
  for (const [a, z] of TYPING) for (let f = Math.round(a / 3); f < z / 3; f += 3) add(X.terminal.from + f, "type", -32);
  add(X.terminal.from + Math.round(URL_LINE_AT / 3), "ready", -22);
  add(X.end.from, "impact-deep", -14);
  return c;
}
export const X_CUES = xCues();

export function NimbusX() {
  const S = (id: keyof typeof X, node: React.ReactNode) => (
    <Sequence from={X[id].from} durationInFrames={X[id].frames} name={id}>
      {node}
    </Sequence>
  );
  return (
    <Shell>
      {S("hook", <Hook script={HOOK_X} frames={X.hook.frames} />)}
      {S("name", <Name />)}
      {S("plan", <Shots shots={X_SCENE_SHOTS.plan!} />)}
      {S("lanes", <Shots shots={X_SCENE_SHOTS.lanes!} />)}
      {S("ch2", <ChapterHighlight />)}
      {S("gate", <Shots shots={X_SCENE_SHOTS.gate!} />)}
      {S("run2", <Shots shots={X_SCENE_SHOTS.run2!} />)}
      {S("chat", <ChatStack messages={STACK_X} every={X_STACK_EVERY} />)}
      {S("terminal", <RunIt speed={3} />)}
      {S("end", <LockupEnd />)}
      <MusicBed
        src={MUSIC.x}
        footage={[
          [X.plan.from, X.ch2.from],
          [X.gate.from, X.chat.from],
        ]}
        cues={X_CUES}
        lifts={[
          [X.gate.from + xApprove, X.gate.from + xApprove + b(2)],
          [X.terminal.from, X.end.from + X.end.frames],
        ]}
      />
      <SfxTrack cues={X_CUES} />
    </Shell>
  );
}
