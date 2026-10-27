// NimbusFull (87 bars) and NimbusX (22 bars): script rev 5 on board rev C (docs/video/), sound
// from sfx.md rev C and the music.md rev C map. A real app walkthrough: every part shown gets a
// callout (what it is · why it helps you); no captions, no sentence captions.
import { AbsoluteFill, Sequence, Series } from "remotion";
import { WordmarkCut } from "@/components/snap-cn/wordmark-cut";
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
  FULL_SCENE_SHOTS,
  gateAllow,
  gateDana,
  gatePriya,
  PHONE_CALLOUT,
  type Shot,
  timelineAgentIo,
  X,
  X_SCENE_SHOTS,
  xDana,
  cam,
  CHAT_RUN,
} from "./shots";
import { TitleCard } from "./components/TitleCard";
import { Footage } from "./Footage";
import { beats } from "./grid";
import { type ChatMessage, chatCues, fitCharFrames } from "./scenes/AgentChat";
import { PHONE_SCALE, PhoneChat } from "./scenes/PhoneChat";
import { EndCard, PROOF, Proof } from "./scenes/Proof";
import { C, MANROPE, ROLE, SORBET } from "./theme";

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

const TITLE = [
  { text: "Nimbus", at: 0, size: 150, weight: 800, color: C.ink },
  {
    text: "An AI crew that asks before it acts",
    at: beats(2),
    size: 60,
    weight: 700,
    color: C.ink,
  },
  {
    text: "NVIDIA Nemotron · Nebius Token Factory",
    at: beats(5),
    size: 40,
    weight: 600,
    color: C.mint,
  },
];

function End({ frames }: { frames: number }) {
  return (
    <Series>
      <Series.Sequence durationInFrames={b(1)}>
        <WordmarkCut
          word="NIMBUS"
          dotFrom={ROLE.checker}
          dotTo={C.mint}
          mode="dark"
          theme={SORBET}
          fontFamily={MANROPE}
          speed={66 / 60}
        />
      </Series.Sequence>
      <Series.Sequence durationInFrames={frames - b(1)}>
        <EndCard />
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
const span = (ids: (keyof typeof F)[]) =>
  ids.map((id) => [F[id].from, F[id].from + F[id].frames] as [number, number]);

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
  add(F.overview.from, "impact-soft", -16);
  add(F.overview.from, "count-2s", -22);
  add(F.plan.from - 8, "whoosh-a", -20);
  for (let f = 6; f < b(1) - 6; f += 4) add(F.plan.from + f, "type", -28);
  const planShot = F.plan.from + b(1);
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
  add(F.gate.from - 8, "whoosh-c", -20);
  add(F.gate.from, "attention", -18);
  add(F.gate.from + gateDana, "success", -16);
  add(F.gate.from + gateDana, "sub-hit", -18);
  add(F.gate.from + gatePriya, "success", -20);
  add(F.gate.from + gateAllow, "success-strong", -16);
  add(F.summary.from + 8, "count-700", -22);
  add(F.summary.from + 33, "ready", -20);
  add(F.memory.from - 8, "whoosh-d", -20);
  add(F.memory.from, "select", -24);
  add(F.memory.from + b(5), "open-subtle", -26);
  add(F.run2.from + 10, "ready-subtle", -22);
  add(F.run2.from + b(5), "success", -20);
  add(F.radar.from - 8, "whoosh-e", -20);
  add(F.radar.from, "navigate", -24);
  add(F.radar.from + b(2) + 10, "attention", -20);
  add(
    F.radar.from + b(5) + momentFrame("pillApprove", b(1), MOMENTS.pillApprove),
    "success",
    -20,
  );
  add(F.chat.from - 8, "whoosh-f", -20);
  const cc = chatCues(TRANSCRIPT, fitCharFrames(TRANSCRIPT, b(6), 30));
  cc.sends.forEach((f) => add(F.chat.from + f, "tap", -24));
  cc.dots.forEach((f) => add(F.chat.from + f, "ready-subtle", -24));
  cc.chimes.forEach((f) => add(F.chat.from + f, "success-strong", -18));
  add(F.chat.from + b(6) - 6, "whoosh-g", -22);
  add(F.watch.from, "attention", -20);
  add(
    F.watch.from + momentFrame("watch", b(3), MOMENTS.watchApprove),
    "success",
    -20,
  );
  add(F.watch.from + b(3), "count-700", -22);
  add(F.proof.from - b(2), "riser-2bar", -18);
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
      {S("title", <TitleCard lines={TITLE} />)}
      {S("overview", <Shots shots={FULL_SCENE_SHOTS.overview!} />)}
      {S("plan", <Shots shots={FULL_SCENE_SHOTS.plan!} />)}
      {S("timeline", <Shots shots={FULL_SCENE_SHOTS.timeline!} />)}
      {S("doc", <Shots shots={FULL_SCENE_SHOTS.doc!} />)}
      {S("gate", <Shots shots={FULL_SCENE_SHOTS.gate!} />)}
      {S("summary", <Shots shots={FULL_SCENE_SHOTS.summary!} />)}
      {S("memory", <Shots shots={FULL_SCENE_SHOTS.memory!} />)}
      {S("run2", <Shots shots={FULL_SCENE_SHOTS.run2!} />)}
      {S("radar", <Shots shots={FULL_SCENE_SHOTS.radar!} />)}
      {S(
        "chat",
        <Series>
          <Series.Sequence durationInFrames={b(6)}>
            <Phone
              transcript={TRANSCRIPT}
              frames={b(6)}
              callout={PHONE_CALLOUT}
            />
          </Series.Sequence>
          <Series.Sequence durationInFrames={b(2)}>
            <Shots shots={[CHAT_RUN]} />
          </Series.Sequence>
        </Series>,
      )}
      {S("watch", <Shots shots={FULL_SCENE_SHOTS.watch!} />)}
      {S("proof", <Proof />)}
      {S("end", <End frames={F.end.frames} />)}
      {CHAPTERS.map((ch) => (
        <Sequence
          key={ch.n}
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

const CHAT_X = TRANSCRIPT.slice(2);

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
  add(X.chat.from - 8, "whoosh-f", -20);
  const cc = chatCues(CHAT_X, fitCharFrames(CHAT_X, b(4), 30));
  cc.sends.forEach((f) => add(X.chat.from + f, "tap", -24));
  cc.dots.forEach((f) => add(X.chat.from + f, "ready-subtle", -24));
  cc.chimes.forEach((f) => add(X.chat.from + f, "success-strong", -18));
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
      {S("title", <TitleCard lines={TITLE} />)}
      {S("plan", <Shots shots={X_SCENE_SHOTS.plan!} />)}
      {S("gate", <Shots shots={X_SCENE_SHOTS.gate!} />)}
      {S("run2", <Shots shots={X_SCENE_SHOTS.run2!} />)}
      {S("chat", <Phone transcript={CHAT_X} frames={b(4)} />)}
      {S("end", <End frames={X.end.frames} />)}
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
