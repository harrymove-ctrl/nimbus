// NimbusFull (87 bars) and NimbusX (22 bars): script rev 5 on board rev C (docs/video/), sound
// from sfx.md rev C and the music.md rev C map. A real app walkthrough: every part shown gets a
// callout (what it is · why it helps you); no captions, no sentence captions.
import { AbsoluteFill, Sequence, Series } from "remotion";
import { WordmarkCut } from "@/components/snap-cn/wordmark-cut";
import { SnapCnUIProvider } from "@/lib/snap-cn-ui";
import chat from "../../docs/video/chat-transcript.json";
import { type Cue, MusicBed, SfxTrack } from "./audio";
import { MOMENTS, momentFrame, type ShotName, target } from "./beats";
import { FontGate } from "./components/cards";
import { Callout, type CalloutSpec, Eyebrow } from "./components/Callout";
import { TitleCard } from "./components/TitleCard";
import { Footage, type SourceMove } from "./Footage";
import { bars, beats, framesPerBeat, layout } from "./grid";
import { type ChatMessage, chatCues, fitCharFrames } from "./scenes/AgentChat";
import { PHONE_SCALE, PhoneChat } from "./scenes/PhoneChat";
import { EndCard, PROOF, Proof } from "./scenes/Proof";
import { C, MANROPE, ROLE, SORBET } from "./theme";

// ── The chat transcript (docs/video/chat-transcript.json, real /v1 replies, verbatim) ──────
// The agreed selection: localhost link lines dropped; "approve all" shows "Approved: …", the
// brief's two header lines and item 1 cut at its first sentence with " …".
type Exchange = { role: "user" | "nimbus"; text: string };
const EX = chat.exchanges as Exchange[];
const replyOf = (prompt: string) => EX[EX.findIndex((e) => e.role === "user" && e.text === prompt) + 1].text;
const keepLines = (text: string, n?: number) =>
  text
    .split("\n")
    .filter((l) => !/^https?:\/\//.test(l.trim()))
    .slice(0, n);
const firstSentence = (line: string) => {
  const m = line.match(/^(\d+\.\s.*?\.)\s/);
  return m ? `${m[1]} …` : line;
};
const exchange = (prompt: string, n?: number, last?: (l: string) => string): ChatMessage[] => {
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
const b = bars;
const call = (
  target: string,
  what: string,
  why: string,
  side: CalloutSpec["side"],
  from: number,
  to: number,
  extra: Partial<CalloutSpec> = {},
): CalloutSpec => ({ target, what, why, side, from, to, ...extra });
const fo = (name: string, inBeat?: string) => {
  const t = target(name, inBeat);
  return { u: (t.x + t.w / 2) / 1920, v: (t.y + t.h / 2) / 1080 };
};
const cam = (at: number, zoom: number, p: { u: number; v: number }, duration = 40): SourceMove => ({ at, zoom, duration, ...p });

type Shot = {
  shot: ShotName;
  frames: number;
  camera: SourceMove[];
  callouts?: CalloutSpec[];
  rings?: { at: number; u: number; v: number }[];
};

/** A scene of one or more footage shots played back to back. */
function Shots({ shots }: { shots: Shot[] }) {
  return (
    <Series>
      {shots.map((s, i) => (
        <Series.Sequence key={i} durationInFrames={s.frames}>
          <Footage shot={s.shot} frames={s.frames} camera={s.camera} callouts={s.callouts} rings={s.rings} />
        </Series.Sequence>
      ))}
    </Series>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SnapCnUIProvider theme={SORBET} mode="dark">
      <FontGate>
        <AbsoluteFill style={{ background: C.bg, fontFamily: MANROPE }}>{children}</AbsoluteFill>
      </FontGate>
    </SnapCnUIProvider>
  );
}

// QA "cuts on the beat": every scene starts on a beat, or the bundle refuses to load.
function onTheBeat(name: string, scenes: readonly { id: string; from: number }[]) {
  const off = scenes.filter((s) => s.from % framesPerBeat !== 0);
  if (off.length) throw new Error(`${name}: scenes off the beat: ${off.map((s) => s.id).join(", ")}`);
}

const TITLE = [
  { text: "Nimbus", at: 0, size: 150, weight: 800, color: C.ink },
  { text: "An AI crew that asks before it acts", at: beats(2), size: 60, weight: 700, color: C.ink },
  { text: "NVIDIA Nemotron · Nebius Token Factory", at: beats(5), size: 40, weight: 600, color: C.mint },
];

function End({ frames }: { frames: number }) {
  return (
    <Series>
      <Series.Sequence durationInFrames={b(1)}>
        <WordmarkCut word="NIMBUS" dotFrom={ROLE.checker} dotTo={C.mint} mode="dark" theme={SORBET} fontFamily={MANROPE} speed={66 / 60} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={frames - b(1)}>
        <EndCard />
      </Series.Sequence>
    </Series>
  );
}

/** The phone part of scene 12, with its callout on the phone itself. */
function Phone({ transcript, frames, callout }: { transcript: ChatMessage[]; frames: number; callout?: CalloutSpec }) {
  const w = 320 * PHONE_SCALE;
  const h = 656 * PHONE_SCALE;
  const box = { x: 960 - w / 2, y: 540 - h / 2, w, h };
  return (
    <AbsoluteFill>
      <PhoneChat
        transcript={transcript}
        charFrames={fitCharFrames(transcript, frames, 30)}
        backdrop={<Footage shot="phoneBg" frames={frames} camera={[cam(0, 1.15, { u: 0.5, v: 0.5 }, 1), cam(2, 1.3, { u: 0.5, v: 0.45 }, frames - 2)]} />}
      />
      {callout ? <Callout spec={callout} box={box} /> : null}
    </AbsoluteFill>
  );
}

// ── Scene shots (board rev C) ─────────────────────────────────────────────────────────────

const COLD: Shot = {
  shot: "cold",
  frames: b(3),
  camera: [cam(0, 1.35, { u: 0.62, v: 0.6 }, 1), cam(2, 1.55, { u: 0.7, v: 0.62 }, b(3) - 2)],
  callouts: [
    call("brief-doc", "Your morning, already read", "Inbox, calendar, GitHub → one page", "left", 0, b(2), { inBeat: "brief1-doc" }),
    call("tray", "3 replies drafted", "Nothing is sent without your OK", "above", b(1), b(3)),
  ],
};

const OVERVIEW: Shot = {
  shot: "overview",
  frames: b(6),
  camera: [
    cam(0, 1.5, fo("workstreams"), 1),
    cam(10, 1.7, { u: 0.22, v: 0.5 }, 60),
    cam(b(2), 1.9, fo("spend-chart", "overview"), 45),
    cam(b(4), 2.2, fo("router-gauge", "overview"), 45),
  ],
  callouts: [
    call("workstreams", "Workstreams", "Chores that run on a schedule", "right", 0, b(2), { inBeat: "overview" }),
    call("spend-chart", "Every call priced", "On Nebius Token Factory", "right", b(2), b(4), { inBeat: "overview" }),
    call("router-gauge", "Cost router", "Cheapest Nemotron that can do the step", "left", b(4), b(6), { inBeat: "overview" }),
  ],
};

// the goal: 1 bar, a push from the whole page to the composer as the words type
const GOAL: Shot = { shot: "goal", frames: b(1), camera: [cam(0, 1.6, { u: 0.46, v: 0.75 }, 1), cam(2, 2.4, { u: 0.46, v: 0.88 }, b(1) - 4)] };
const PLAN: Shot = {
  shot: "plan",
  frames: b(6),
  camera: [
    cam(0, 1.9, fo("plan", "brief1-plan-arrives"), 1),
    cam(20, 2.2, fo("plan", "brief1-plan-arrives"), 40),
    cam(b(2), 2.6, { u: 0.52, v: 0.46 }, 40),
    cam(b(4), 2.4, { u: 0.46, v: 0.58 }, 40),
  ],
  callouts: [
    call("plan", "The plan", "Who does what, before anything runs", "right", b(1), b(3), { inBeat: "brief1-plan-arrives" }),
    call("estimate", "≈ $0.03 · mock", "You see the cost first", "below", b(2), b(4)),
    call("tools", "Allowed tools", "It can't use anything else", "below", b(4), b(6)),
  ],
};

const LANES_U = { u: 0.45, v: 0.2 };
const timelineAgentIo = momentFrame("timeline", b(10), MOMENTS.agentIo);
const TIMELINE: Shot = {
  shot: "timeline",
  frames: b(10),
  camera: [
    cam(0, 1.3, LANES_U, 1),
    cam(2, 1.5, LANES_U, b(3)),
    cam(b(3), 2.2, { u: 0.25, v: 0.12 }, 40),
    cam(b(5), 1.85, { u: 0.44, v: 0.12 }, 40),
    cam(timelineAgentIo, 2.3, fo("agent-io"), 30),
  ],
  callouts: [
    call("lanes", "One row per agent", "They work at the same time", "below", b(1), b(3)),
    call("model-badge", "Model per step", "Ultra plans, Super reads and writes", "below", b(3), b(5), { role: ROLE.analyst }),
    call("run-cost", "Live cost", "Stops at your budget", "below", b(5), b(7)),
    call("agent-io", "What it read", "Every step is open to check", "left", b(8), b(10)),
  ],
};

const DOC: Shot = {
  shot: "doc",
  frames: b(5),
  camera: [cam(0, 2.0, fo("needs-you"), 1), cam(2, 2.2, fo("needs-you"), b(2)), cam(b(3), 2.2, fo("can-wait"), 40)],
  callouts: [
    call("needs-you", "Ranked by who waits", "And by when", "left", 0, b(2)),
    call("can-wait", "Noise moved aside", "No draft for it", "left", b(3), b(5)),
  ],
};

const gateDana = momentFrame("gate", b(9), MOMENTS.approveDana);
const gatePriya = momentFrame("gate", b(9), MOMENTS.approvePriya);
const gateAllow = momentFrame("gate", b(9), MOMENTS.alwaysAllow);
const approveBtn = (() => {
  const t = target("approve-buttons");
  return { u: (t.x + t.w - 48) / 1920, v: (t.y + t.h / 2) / 1080 };
})();
const GATE: Shot = {
  shot: "gate",
  frames: b(9),
  camera: [cam(0, 1.7, fo("approval-card"), 1), cam(2, 1.9, fo("approval-card"), b(3)), cam(b(6), 2.1, fo("rule-line"), 40)],
  rings: [
    { at: gateDana, ...approveBtn },
    { at: gatePriya, ...approveBtn },
  ],
  callouts: [
    call("approval-card", "Sending is an action", "So it waits for you", "above", 0, b(3)),
    call("approve-buttons", "Approve, reject with a note", "Or allow from now on", "above", b(3), b(6)),
    call("rule-line", "One rule saved", "You can revoke it anytime", "above", b(7), b(9)),
  ],
};

const SUMMARY: Shot = {
  shot: "summary",
  frames: b(5),
  camera: [cam(0, 1.9, { u: 0.42, v: 0.62 }, 1), cam(2, 2.2, { u: 0.42, v: 0.62 }, b(5) - 2)],
  callouts: [
    call("summary-cost", "The whole morning", "$0.024 · mock", "above", b(1), b(3), { inBeat: "brief1-summary" }),
    call("vs-baseline", "Router savings", "Versus always using the biggest model", "above", b(3), b(5)),
  ],
};

const MEMORY: Shot = {
  shot: "memory",
  frames: b(7),
  camera: [cam(0, 2.0, fo("memories"), 1), cam(2, 2.2, fo("memories"), b(2)), cam(b(3), 2.3, fo("skill-file"), 40), cam(b(5), 2.6, fo("forget"), 40)],
  callouts: [
    call("memories", "Memories", "What it learned from your morning", "left", 0, b(2)),
    call("skill-file", "Its own how-to", "Rewritten after each run", "left", b(3), b(5)),
    call("forget", "Forget or revoke", "You stay in charge", "left", b(5), b(7)),
  ],
};

const LEARNED: Shot = {
  shot: "learned",
  frames: b(3),
  camera: [cam(0, 2.0, fo("learned-chip", "brief2-plan-arrives"), 1), cam(2, 2.3, fo("learned-chip", "brief2-plan-arrives"), b(3) - 2)],
  callouts: [call("learned-chip", "Uses what it learned", "No repeat questions", "below", b(1), b(3), { inBeat: "brief2-plan-arrives" })],
};
const RUN2END: Shot = {
  shot: "run2End",
  frames: b(3),
  camera: [cam(0, 1.9, { u: 0.55, v: 0.2 }, 1), cam(b(1), 2.2, fo("run2-cost"), 40)],
  callouts: [call("run2-cost", "Run two: $0.016 · mock", "Cheaper and faster", "below", b(1), b(3))],
};

const RADAR: Shot = {
  shot: "radar",
  frames: b(2),
  camera: [cam(0, 2.2, fo("unread-dot"), 1), cam(2, 2.5, fo("unread-dot"), b(2) - 2)],
  callouts: [call("unread-dot", "Ran on schedule", "While you were away", "right", 0, b(2))],
};
const PILL: Shot = {
  shot: "pill",
  frames: b(3),
  camera: [cam(0, 2.2, fo("status-pill"), 1), cam(2, 2.5, fo("status-pill"), b(3) - 2)],
  callouts: [call("status-pill", "Status pill", "Answer from anywhere in the app", "below", b(1), b(3))],
};
const PILL_APPROVE: Shot = {
  shot: "pillApprove",
  frames: b(1),
  camera: [cam(0, 2.4, { u: 0.86, v: 0.2 }, 1), cam(2, 2.6, { u: 0.86, v: 0.2 }, b(1) - 2)],
};

const CHAT_RUN: Shot = {
  shot: "chatRun",
  frames: b(2),
  camera: [cam(0, 1.9, fo("chat-run"), 1), cam(2, 2.2, fo("chat-run"), b(2) - 2)],
  callouts: [call("chat-run", "Same run, same approvals", "One history", "right", 0, b(2))],
};

const WATCH: Shot = {
  shot: "watch",
  frames: b(3),
  camera: [cam(0, 2.0, fo("routing-table"), 1), cam(2, 2.3, fo("routing-table"), b(3) - 2)],
  callouts: [call("routing-table", "It watches its own bill", "Proposes cheaper routing", "left", 0, b(2))],
};
const OVERVIEW_AFTER: Shot = {
  shot: "overviewAfter",
  frames: b(2),
  camera: [cam(0, 2.0, fo("router-gauge", "overview-after"), 1), cam(2, 2.3, fo("router-gauge", "overview-after"), b(2) - 2)],
  callouts: [call("router-gauge", "Approved", "Saving shows up here", "left", 0, b(2), { inBeat: "overview-after" })],
};

// ── NimbusFull ────────────────────────────────────────────────────────────────────────────

export const FULL = layout([
  { id: "cold", bars: 3 },
  { id: "title", bars: 2 },
  { id: "overview", bars: 6 },
  { id: "plan", bars: 7 },
  { id: "timeline", bars: 10 },
  { id: "doc", bars: 5 },
  { id: "gate", bars: 9 },
  { id: "summary", bars: 5 },
  { id: "memory", bars: 7 },
  { id: "run2", bars: 6 },
  { id: "radar", bars: 6 },
  { id: "chat", bars: 8 },
  { id: "watch", bars: 5 },
  { id: "proof", bars: 4 },
  { id: "end", bars: 4 },
] as const);
export const FULL_FRAMES = FULL[FULL.length - 1].from + FULL[FULL.length - 1].frames;
onTheBeat("NimbusFull", FULL);
const F = Object.fromEntries(FULL.map((s) => [s.id, s])) as Record<(typeof FULL)[number]["id"], (typeof FULL)[number]>;

const CHAPTERS = [
  { n: 1, title: "You approve the plan", from: F.plan.from, to: F.gate.from },
  { n: 2, title: "Nothing leaves without you", from: F.gate.from, to: F.memory.from },
  { n: 3, title: "It gets better every run", from: F.memory.from, to: F.radar.from },
  { n: 4, title: "Always on", from: F.radar.from, to: F.proof.from },
];

// The music bed. Swap for "audio/music-full.mp3" / "audio/music-x.mp3" when the Suno tracks
// land; the temp score (scripts/make-sound.mjs) follows the same map.
const MUSIC = { full: "audio/music-temp-full.mp3", x: "audio/music-temp-x.mp3" };
const span = (ids: (keyof typeof F)[]) => ids.map((id) => [F[id].from, F[id].from + F[id].frames] as [number, number]);

function fullCues(): Cue[] {
  const c: Cue[] = [];
  const add = (at: number, file: string, db: number, extra: Partial<Cue> = {}) => c.push({ at: Math.round(at), file, db, ...extra });
  add(8, "attention", -20);
  add(F.title.from, "riser-1bar", -18, { frames: b(2) });
  add(F.overview.from, "impact-soft", -16);
  add(F.overview.from, "count-2s", -22);
  add(F.plan.from - 8, "whoosh-a", -20);
  for (let f = 6; f < b(1) - 6; f += 4) add(F.plan.from + f, "type", -28);
  const planShot = F.plan.from + b(1);
  add(planShot + momentFrame("plan", b(6), MOMENTS.planArrives), "ready-subtle", -22);
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
  add(F.radar.from + b(5) + momentFrame("pillApprove", b(1), MOMENTS.pillApprove), "success", -20);
  add(F.chat.from - 8, "whoosh-f", -20);
  const cc = chatCues(TRANSCRIPT, fitCharFrames(TRANSCRIPT, b(6), 30));
  cc.sends.forEach((f) => add(F.chat.from + f, "tap", -24));
  cc.dots.forEach((f) => add(F.chat.from + f, "ready-subtle", -24));
  cc.chimes.forEach((f) => add(F.chat.from + f, "success-strong", -18));
  add(F.chat.from + b(6) - 6, "whoosh-g", -22);
  add(F.watch.from, "attention", -20);
  add(F.watch.from + momentFrame("watch", b(3), MOMENTS.watchApprove), "success", -20);
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
      {S("cold", <Shots shots={[COLD]} />)}
      {S("title", <TitleCard lines={TITLE} />)}
      {S("overview", <Shots shots={[OVERVIEW]} />)}
      {S("plan", <Shots shots={[GOAL, PLAN]} />)}
      {S("timeline", <Shots shots={[TIMELINE]} />)}
      {S("doc", <Shots shots={[DOC]} />)}
      {S("gate", <Shots shots={[GATE]} />)}
      {S("summary", <Shots shots={[SUMMARY]} />)}
      {S("memory", <Shots shots={[MEMORY]} />)}
      {S("run2", <Shots shots={[LEARNED, RUN2END]} />)}
      {S("radar", <Shots shots={[RADAR, PILL, PILL_APPROVE]} />)}
      {S(
        "chat",
        <Series>
          <Series.Sequence durationInFrames={b(6)}>
            <Phone transcript={TRANSCRIPT} frames={b(6)} callout={call("phone", "Same crew in your chat app", "Via OpenClaw or Hermes", "left", b(2), b(4))} />
          </Series.Sequence>
          <Series.Sequence durationInFrames={b(2)}>
            <Shots shots={[CHAT_RUN]} />
          </Series.Sequence>
        </Series>,
      )}
      {S("watch", <Shots shots={[WATCH, OVERVIEW_AFTER]} />)}
      {S("proof", <Proof />)}
      {S("end", <End frames={F.end.frames} />)}
      {CHAPTERS.map((ch) => (
        <Sequence key={ch.n} from={ch.from} durationInFrames={ch.to - ch.from} name={`chapter ${ch.n}`}>
          <Eyebrow n={ch.n} title={ch.title} />
        </Sequence>
      ))}
      <MusicBed src={MUSIC.full} footage={span(["cold", "overview", "plan", "timeline", "doc", "gate", "summary", "memory", "run2", "radar", "watch"])} />
      <SfxTrack cues={FULL_CUES} />
    </Shell>
  );
}

// ── NimbusX ───────────────────────────────────────────────────────────────────────────────

export const XCUT = layout([
  { id: "cold", bars: 3 },
  { id: "title", bars: 2 },
  { id: "plan", bars: 3 },
  { id: "gate", bars: 5 },
  { id: "run2", bars: 3 },
  { id: "chat", bars: 4 },
  { id: "end", bars: 2 },
] as const);
export const X_FRAMES = XCUT[XCUT.length - 1].from + XCUT[XCUT.length - 1].frames;
onTheBeat("NimbusX", XCUT);
const X = Object.fromEntries(XCUT.map((s) => [s.id, s])) as Record<(typeof XCUT)[number]["id"], (typeof XCUT)[number]>;
const CHAT_X = TRANSCRIPT.slice(2);

const X_PLAN: Shot = {
  shot: "xPlan",
  frames: b(3),
  camera: [cam(0, 1.9, fo("plan", "brief1-plan-arrives"), 1), cam(2, 2.2, fo("plan", "brief1-plan-arrives"), b(3) - 2)],
  callouts: [call("estimate", "≈ $0.03 · mock", "You see the cost first", "below", 0, b(2))],
};
const X_LANES: Shot = {
  shot: "xLanes",
  frames: b(2),
  camera: [cam(0, 1.3, LANES_U, 1), cam(2, 1.5, LANES_U, b(2) - 2)],
  callouts: [call("lanes", "One row per agent", "They work at the same time", "below", 0, b(2))],
};
const xDana = momentFrame("xGate", b(3), MOMENTS.approveDana);
const X_GATE: Shot = {
  shot: "xGate",
  frames: b(3),
  camera: [cam(0, 1.7, fo("approval-card"), 1), cam(2, 1.95, fo("approval-card"), b(3) - 2)],
  rings: [{ at: xDana, ...approveBtn }],
  callouts: [call("approval-card", "Sending is an action", "So it waits for you", "above", 0, b(2))],
};

function xCues(): Cue[] {
  const c: Cue[] = [];
  const add = (at: number, file: string, db: number, extra: Partial<Cue> = {}) => c.push({ at: Math.round(at), file, db, ...extra });
  add(8, "attention", -20);
  add(X.title.from, "riser-1bar", -18, { frames: b(2) });
  add(X.plan.from, "impact-soft", -16);
  add(X.plan.from + momentFrame("xPlan", b(3), MOMENTS.planArrives), "ready-subtle", -22);
  add(X.plan.from + momentFrame("xPlan", b(3), MOMENTS.approvePlan), "tap", -22);
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
      {S("cold", <Shots shots={[COLD]} />)}
      {S("title", <TitleCard lines={TITLE} />)}
      {S("plan", <Shots shots={[X_PLAN]} />)}
      {S("gate", <Shots shots={[X_LANES, X_GATE]} />)}
      {S("run2", <Shots shots={[LEARNED]} />)}
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
