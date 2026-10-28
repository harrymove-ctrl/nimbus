// NimbusFull (87 bars) and NimbusX (22 bars): script rev 5 on board rev C with the rev D
// motion layer (docs/video/), sound from sfx.md rev D and the music.md rev C map. A real app
// walkthrough: every part shown gets a callout (what it is · why it helps you); designed
// motion scenes open the title, each chapter, the summary, the chat, the proof and the end.
import { AbsoluteFill, Sequence, Series } from "remotion";
import { SnapCnUIProvider } from "@/lib/snap-cn-ui";
import chat from "../../docs/video/chat-transcript.json";
import { type Cue, MusicBed, SfxTrack } from "./audio";
import { MOMENTS, momentFrame } from "./beats";
import { FontGate } from "./components/cards";

export { FULL_FRAMES, X_FRAMES } from "./shots";
import { Callout, type CalloutSpec, Eyebrow } from "./components/Callout";
import {
  b,
  CHAPTERS,
  F,
  FULL_MOTION,
  FULL_SCENE_SHOTS,
  gateAllow,
  gateDana,
  gatePriya,
  PHONE_CALLOUT,
  type Shot,
  timelineAgentIo,
  X,
  X_MOTION,
  X_SCENE_SHOTS,
  xDana,
  cam,
  CHAT_RUN,
} from "./shots";
import { Footage } from "./Footage";
import { beats } from "./grid";
import { type ChatMessage, chatCues, fitCharFrames } from "./scenes/AgentChat";
import { ChapterHighlight, ChapterPunch, HIGHLIGHT } from "./scenes/ChapterCards";
import { FocusPull } from "./scenes/FocusPull";
import { LOCKUP, LockupEnd, LockupReveal } from "./scenes/Lockup";
import { MetricMorph, MORPH } from "./scenes/MetricMorph";
import { ORBIT, OrbitFlow } from "./scenes/OrbitFlow";
import { PHONE_SCALE, PhoneChat } from "./scenes/PhoneChat";
import { PROOF, Proof } from "./scenes/Proof";
import { ScatterBloom } from "./scenes/ScatterBloom";
import { ScreenWall, type WallScreen } from "./scenes/ScreenWall";
import { C, MANROPE, SORBET } from "./theme";

// ── The chat transcript (docs/video/chat-transcript.json, real /v1 replies, verbatim) ──────
// The agreed selection: localhost link lines dropped; "approve all" shows "Approved: …", the
// brief's two header lines and item 1 cut at its first sentence with " …".
type Exchange = { role: "user" | "nimbus"; text: string };
const EX = chat.exchanges as Exchange[];
const replyOf = (prompt: string) =>
  EX[EX.findIndex((e) => e.role === "user" && e.text === prompt) + 1].text;
const keepLines = (text: string, n?: number) =>
  text
    .split("\n")
    .filter((l) => !/^https?:\/\//.test(l.trim()))
    .slice(0, n);
const firstSentence = (line: string) => {
  const m = line.match(/^(\d+\.\s.*?\.)\s/);
  return m ? `${m[1]} …` : line;
};
const exchange = (
  prompt: string,
  n?: number,
  last?: (l: string) => string,
): ChatMessage[] => {
  const ls = keepLines(replyOf(prompt), n);
  if (last) ls[ls.length - 1] = last(ls[ls.length - 1]);
  return [
    { role: "user", text: prompt },
    { role: "assistant", text: ls.join("\n") },
  ];
};
const TRANSCRIPT: ChatMessage[] = [
  ...exchange("what needs me?"),
  ...exchange("run morning brief"),
  ...exchange("approve all", 4, firstSentence),
];
/** Rev D: the phone plays "run morning brief" → "approve all" → "Approved" (the first
 *  exchange is on the Screen Wall), in the full cut and the X clip alike. */
const CHAT_PHONE = TRANSCRIPT.slice(2);
/** Screen Wall: four real frames of the same chat, verbatim. */
const WALL: WallScreen[] = [
  { user: "what needs me?", reply: keepLines(replyOf("what needs me?")) },
  { user: "run morning brief", reply: keepLines(replyOf("run morning brief"), 3) },
  { user: "approve all", typing: true },
  { reply: keepLines(replyOf("approve all"), 2) },
];

// ── Shared pieces ─────────────────────────────────────────────────────────────────────────
/** A scene of one or more footage shots played back to back. */
function Shots({ shots }: { shots: Shot[] }) {
  return (
    <Series>
      {shots.map((s, i) => (
        <Series.Sequence key={i} durationInFrames={s.frames}>
          <Footage
            shot={s.shot}
            frames={s.frames}
            camera={s.camera}
            callouts={s.callouts}
            rings={s.rings}
          />
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

/** A scene that opens on a motion scene of `motion` frames, then plays its footage shots. */
function Opened({ motion, scene, shots }: { motion: number; scene: React.ReactNode; shots: Shot[] }) {
  return (
    <Series>
      <Series.Sequence durationInFrames={motion}>{scene}</Series.Sequence>
      <Series.Sequence durationInFrames={shots.reduce((n, s) => n + s.frames, 0)}>
        <Shots shots={shots} />
      </Series.Sequence>
    </Series>
  );
}

/** The phone part of scene 12, with its callout on the phone itself. */
function Phone({
  transcript,
  frames,
  callout,
}: {
  transcript: ChatMessage[];
  frames: number;
  callout?: CalloutSpec;
}) {
  const w = 320 * PHONE_SCALE;
  const h = 656 * PHONE_SCALE;
  const box = { x: 960 - w / 2, y: 540 - h / 2, w, h };
  return (
    <AbsoluteFill>
      <PhoneChat
        transcript={transcript}
        charFrames={fitCharFrames(transcript, frames, 30)}
        backdrop={
          <Footage
            shot="phoneBg"
            frames={frames}
            camera={[
              cam(0, 1.15, { u: 0.5, v: 0.5 }, 1),
              cam(2, 1.3, { u: 0.5, v: 0.45 }, frames - 2),
            ]}
          />
        }
      />
      {callout ? <Callout spec={callout} box={box} scope="phone" /> : null}
    </AbsoluteFill>
  );
}

// ── NimbusFull ────────────────────────────────────────────────────────────────────────────

// The music bed. Swap for "audio/music-full.mp3" / "audio/music-x.mp3" when the Suno tracks
// land; the temp score (scripts/make-sound.mjs) follows the same map.
const MUSIC = {
  full: "audio/music-temp-full.mp3",
  x: "audio/music-temp-x.mp3",
};
/** Footage spans for the music bed (the motion scenes count as cards). */
const span = (ids: (keyof typeof F)[]) =>
  ids.map((id) => [F[id].from + (FULL_MOTION[id] ?? 0), F[id].from + F[id].frames] as [number, number]);
const after = (id: keyof typeof F) => F[id].from + (FULL_MOTION[id] ?? 0);

function fullCues(): Cue[] {
  const c: Cue[] = [];
  const add = (
    at: number,
    file: string,
    db: number,
    extra: Partial<Cue> = {},
  ) => c.push({ at: Math.round(at), file, db, ...extra });
  add(8, "attention", -20);
  add(F.title.from, "riser-1bar", -18, { frames: b(2) });
  add(F.title.from + LOCKUP.sky, "lockup-chime", -18);
  add(F.overview.from, "impact-soft", -16);
  add(F.overview.from, "count-2s", -22);
  add(F.plan.from - 4, "punch-whip", -18);
  add(F.plan.from + 30, "punch-thud", -18);
  const planShot = after("plan");
  add(
    planShot + momentFrame("plan", b(6), MOMENTS.planArrives),
    "ready-subtle",
    -22,
  );
  add(planShot + momentFrame("plan", b(6), MOMENTS.approvePlan), "tap", -22);
  add(F.timeline.from, "loading-subtle", -22);
  add(F.timeline.from + timelineAgentIo, "select", -24);
  add(F.doc.from - 8, "whoosh-b", -20);
  add(F.doc.from, "ready", -20);
  add(F.gate.from + HIGHLIGHT.start, "marker", -20);
  add(F.gate.from + HIGHLIGHT.orange, "attention", -18);
  add(after("gate") + gateDana, "success", -16);
  add(after("gate") + gateDana, "sub-hit", -18);
  add(after("gate") + gatePriya, "success", -20);
  add(after("gate") + gateAllow, "success-strong", -16);
  add(F.summary.from, "morph-suck", -20);
  add(F.summary.from + MORPH.slam, "morph-slam", -16);
  add(after("summary") + 8, "count-700", -22);
  add(after("summary") + 33, "ready", -20);
  add(F.memory.from, "focus-shimmer", -20);
  add(after("memory"), "select", -24);
  add(after("memory") + beats(14), "open-subtle", -26);
  add(F.run2.from + 10, "ready-subtle", -22);
  add(F.run2.from + b(5), "success", -20);
  add(F.radar.from, "orbit-swell", -20);
  add(F.radar.from + ORBIT.whip - 8, "orbit-suck", -18);
  add(after("radar"), "navigate", -24);
  add(after("radar") + beats(6) + 10, "attention", -20);
  add(
    after("radar") + beats(12) + momentFrame("pillApprove", b(1), MOMENTS.pillApprove),
    "success",
    -20,
  );
  add(F.chat.from, "wall-tunnel", -18);
  const cc = chatCues(CHAT_PHONE, fitCharFrames(CHAT_PHONE, b(4), 30));
  cc.sends.forEach((f) => add(after("chat") + f, "tap", -24));
  cc.dots.forEach((f) => add(after("chat") + f, "ready-subtle", -24));
  cc.chimes.forEach((f) => add(after("chat") + f, "success-strong", -18));
  add(after("chat") + b(4) - 6, "whoosh-g", -22);
  add(F.watch.from, "attention", -20);
  add(
    F.watch.from + momentFrame("watch", b(3), MOMENTS.watchApprove),
    "success",
    -20,
  );
  add(F.watch.from + b(3), "count-700", -22);
  add(F.proof.from - b(2), "riser-2bar", -18);
  add(F.proof.from + 4, "bloom-sparkle", -22);
  PROOF.tiles.forEach((f) => add(F.proof.from + f, "sub-hit", -16));
  add(F.proof.from + PROOF.counts[0], "count-700", -22);
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
      {S("cold", <Shots shots={FULL_SCENE_SHOTS.cold!} />)}
      {S("title", <LockupReveal />)}
      {S("overview", <Shots shots={FULL_SCENE_SHOTS.overview!} />)}
      {S("plan", <Opened motion={FULL_MOTION.plan!} scene={<ChapterPunch />} shots={FULL_SCENE_SHOTS.plan!} />)}
      {S("timeline", <Shots shots={FULL_SCENE_SHOTS.timeline!} />)}
      {S("doc", <Shots shots={FULL_SCENE_SHOTS.doc!} />)}
      {S("gate", <Opened motion={FULL_MOTION.gate!} scene={<ChapterHighlight />} shots={FULL_SCENE_SHOTS.gate!} />)}
      {S("summary", <Opened motion={FULL_MOTION.summary!} scene={<MetricMorph />} shots={FULL_SCENE_SHOTS.summary!} />)}
      {S("memory", <Opened motion={FULL_MOTION.memory!} scene={<FocusPull />} shots={FULL_SCENE_SHOTS.memory!} />)}
      {S("run2", <Shots shots={FULL_SCENE_SHOTS.run2!} />)}
      {S("radar", <Opened motion={FULL_MOTION.radar!} scene={<OrbitFlow />} shots={FULL_SCENE_SHOTS.radar!} />)}
      {S(
        "chat",
        <Series>
          <Series.Sequence durationInFrames={FULL_MOTION.chat!}>
            <ScreenWall screens={WALL} back={70} lineAt={58} every={6} />
          </Series.Sequence>
          <Series.Sequence durationInFrames={b(4)}>
            <Phone transcript={CHAT_PHONE} frames={b(4)} callout={PHONE_CALLOUT} />
          </Series.Sequence>
          <Series.Sequence durationInFrames={b(2)}>
            <Shots shots={[CHAT_RUN]} />
          </Series.Sequence>
        </Series>,
      )}
      {S("watch", <Shots shots={FULL_SCENE_SHOTS.watch!} />)}
      {S(
        "proof",
        <AbsoluteFill>
          <ScatterBloom dimFrom={PROOF.tiles[0]} />
          <Proof />
        </AbsoluteFill>,
      )}
      {S("end", <LockupEnd />)}
      {CHAPTERS.map((ch) => (
        <Sequence
          key={ch.from}
          from={ch.from}
          durationInFrames={ch.to - ch.from}
          name={`chapter ${ch.n}`}
        >
          <Eyebrow n={ch.n} title={ch.title} />
        </Sequence>
      ))}
      <MusicBed
        src={MUSIC.full}
        footage={span([
          "cold",
          "overview",
          "plan",
          "timeline",
          "doc",
          "gate",
          "summary",
          "memory",
          "run2",
          "radar",
          "watch",
        ])}
      />
      <SfxTrack cues={FULL_CUES} />
    </Shell>
  );
}

// ── NimbusX ───────────────────────────────────────────────────────────────────────────────

const CHAT_X = CHAT_PHONE;

function xCues(): Cue[] {
  const c: Cue[] = [];
  const add = (
    at: number,
    file: string,
    db: number,
    extra: Partial<Cue> = {},
  ) => c.push({ at: Math.round(at), file, db, ...extra });
  add(8, "attention", -20);
  add(X.title.from, "riser-1bar", -18, { frames: b(2) });
  add(X.title.from + LOCKUP.sky, "lockup-chime", -18);
  add(X.plan.from, "impact-soft", -16);
  add(
    X.plan.from + momentFrame("xPlan", b(3), MOMENTS.planArrives),
    "ready-subtle",
    -22,
  );
  add(
    X.plan.from + momentFrame("xPlan", b(3), MOMENTS.approvePlan),
    "tap",
    -22,
  );
  add(X.gate.from, "loading-subtle", -22);
  add(X.gate.from + b(2) - 8, "whoosh-c", -20);
  add(X.gate.from + b(2), "attention", -18);
  add(X.gate.from + b(2) + xDana, "success", -16);
  add(X.gate.from + b(2) + xDana, "sub-hit", -18);
  add(X.run2.from - 8, "whoosh-d", -20);
  add(X.run2.from + 10, "ready-subtle", -22);
  add(X.chat.from, "wall-tunnel", -18);
  const phone = X.chat.from + X_MOTION.chat!;
  const cc = chatCues(CHAT_X, fitCharFrames(CHAT_X, X.chat.frames - X_MOTION.chat!, 30));
  cc.sends.forEach((f) => add(phone + f, "tap", -24));
  cc.dots.forEach((f) => add(phone + f, "ready-subtle", -24));
  cc.chimes.forEach((f) => add(phone + f, "success-strong", -18));
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
      {S("cold", <Shots shots={X_SCENE_SHOTS.cold!} />)}
      {S("title", <LockupReveal />)}
      {S("plan", <Shots shots={X_SCENE_SHOTS.plan!} />)}
      {S("gate", <Shots shots={X_SCENE_SHOTS.gate!} />)}
      {S("run2", <Shots shots={X_SCENE_SHOTS.run2!} />)}
      {S(
        "chat",
        <Series>
          <Series.Sequence durationInFrames={X_MOTION.chat!}>
            <ScreenWall screens={WALL} back={34} lineAt={26} every={4} />
          </Series.Sequence>
          <Series.Sequence durationInFrames={X.chat.frames - X_MOTION.chat!}>
            <Phone transcript={CHAT_X} frames={X.chat.frames - X_MOTION.chat!} />
          </Series.Sequence>
        </Series>,
      )}
      {S("end", <LockupEnd />)}
      <MusicBed
        src={MUSIC.x}
        footage={[
          [X.cold.from, X.cold.from + X.cold.frames],
          [X.plan.from, X.run2.from + X.run2.frames],
        ]}
      />
      <SfxTrack cues={X_CUES} />
    </Shell>
  );
}
