// Every shot, scene layout and callout of both cuts, as plain data (no React, no fonts), so
// Node scripts can read it: scripts/callout-index.mjs prints the callout index that
// scripts/layout-callouts.py measures card spots from. compositions.tsx renders it.
import { MOMENTS, momentFrame, type ShotName, SUB, type TakeId, target } from "./beats";
import { type CalloutSpec, layoutKey } from "./callout-spec";
import type { SourceMove } from "./Footage";
import { bars, beats, framesPerBeat, layout } from "./grid";
import { ROLE } from "./palette";

export const b = bars;
export const call = (
  target: string,
  what: string,
  why: string,
  side: CalloutSpec["side"],
  from: number,
  to: number,
  extra: Partial<CalloutSpec> = {},
): CalloutSpec => ({ target, what, why, side, from, to, ...extra });
export const fo = (name: string, inBeat?: string, take: TakeId = "real") => {
  const t = target(name, inBeat, take);
  return { u: (t.x + t.w / 2) / 1920, v: (t.y + t.h / 2) / 1080 };
};
export const cam = (
  at: number,
  zoom: number,
  p: { u: number; v: number },
  duration = 40,
): SourceMove => ({ at, zoom, duration, ...p });

export type Shot = {
  shot: ShotName;
  frames: number;
  camera: SourceMove[];
  callouts?: CalloutSpec[];
  rings?: { at: number; u: number; v: number }[];
  /** Approve clicks that get the drawn tick (board rev E: button-press). */
  ticks?: { at: number; u: number; v: number }[];
  /** The tilted camera's yaw in degrees (board rev E "Look" 5); 0 or absent is flat. */
  tilt?: number;
};

// QA "cuts on the beat": every scene starts on a beat, or the bundle refuses to load.
function onTheBeat(
  name: string,
  scenes: readonly { id: string; from: number }[],
) {
  const off = scenes.filter((s) => s.from % framesPerBeat !== 0);
  if (off.length)
    throw new Error(
      `${name}: scenes off the beat: ${off.map((s) => s.id).join(", ")}`,
    );
}

// ── Scene shots (board rev E) ─────────────────────────────────────────────────────────────
// Callout spans are frames inside the shot. Numbers are measured on Token Factory in the Oct 28
// headless real runs (docs/video/RELEASE.md, QA.md says which); no tag on the frame.

/** The router gauge framed with room on its left: the empty right half of the Runs panel. */
const GAUGE_ROOM = { u: 0.708, v: 0.75 };
/** Scene 3: the laptop dives into the screen over the first 75 frames, then the callouts. */
export const LAPTOP_FRAMES = 75;
/** The workstream list and the spend chart both whole (Gate 3 on rev 6: the tighter push
 *  landed on an empty card and the callout covered the chart). */
const OVERVIEW_WIDE = { u: 0.4, v: 0.42 };
export const OVERVIEW: Shot = {
  shot: "overview",
  frames: b(6),
  tilt: 10,
  camera: [
    cam(0, 1.15, OVERVIEW_WIDE, 1),
    cam(2, 1.22, OVERVIEW_WIDE, beats(11) - 24),
    cam(beats(11) - 20, 1.45, fo("spend-chart", "overview"), 40),
    // the gauge sits right of centre so its card has the Runs panel's empty half (no card
    // over UI text); the move lands before the card is in
    cam(beats(18) - 24, 2.0, GAUGE_ROOM, 30),
  ],
  callouts: [
    call("workstreams", "Workstreams", "Chores that run on a schedule", "right", LAPTOP_FRAMES, beats(11), { inBeat: "overview" }),
    call("spend-chart", "Every call priced", "On Nebius Token Factory", "right", beats(11), beats(18), { inBeat: "overview" }),
    call("router-gauge", "Cost router", "The cheapest Nemotron that can do the step", "left", beats(18), b(6), { inBeat: "overview" }),
  ],
};

/** The composer, read off the take while the goal types (beats.json has no box for it); framed
 *  wide enough to keep the rail and the empty run panel's prompt in shot (no empty frame). */
const COMPOSER = { u: 0.44, v: 0.7 };
export const GOAL: Shot = {
  shot: "goal",
  frames: b(2),
  camera: [cam(0, 1.3, COMPOSER, 1), cam(2, 1.5, { u: 0.46, v: 0.78 }, b(2) - 2)],
};

// Approve plan: its button sits 41 px in from the plan card's right edge and 103 px below it
// (measured on the take at the click; beats.json has no box for the button itself).
const approvePlanBtn = (() => {
  const t = target("plan", "brief1-plan-arrives");
  return { u: (t.x + t.w - 41) / 1920, v: (t.y + t.h + 103) / 1080 };
})();
const planClick = (shot: ShotName, frames: number) => ({ at: momentFrame(shot, frames, MOMENTS.approvePlan), ...approvePlanBtn });
export const PLAN: Shot = {
  shot: "plan",
  frames: b(4),
  tilt: 10,
  camera: [
    cam(0, 1.9, fo("plan", "brief1-plan-arrives"), 1),
    // the whole plan card with the dark band under it (above the composer) for the plan
    // and estimate cards, its header clear of the eyebrow (no card over UI text)
    cam(12, 1.9, { u: 0.463, v: 0.571 }, 30),
    cam(b(2), 2.4, { u: 0.46, v: 0.58 }, 40),
  ],
  rings: [planClick("plan", b(4))],
  ticks: [planClick("plan", b(4))],
  callouts: [
    call("plan", "The plan", "Who does what, before anything runs", "right", 0, b(2), { inBeat: "brief1-plan-arrives" }),
    call("estimate", "$0.0216", "You see the cost first", "below", b(1), b(3)),
    call("tools", "Allowed tools", "It can't use anything else", "below", b(2), b(4)),
  ],
};

export const LANES_U = { u: 0.45, v: 0.2 };
const TIMELINE_OPEN = { u: 0.38, v: 0.2 };
/** The timeline in two shots cut on bar 6 (take 1915's beat runs 60 s): the lanes filling,
 *  then the Writer through Agent I/O. */
export const timelineAgentIo = b(5) + momentFrame("timelineB", b(5), MOMENTS.agentIo);
export const TIMELINE_A: Shot = {
  shot: "timelineA",
  frames: b(5),
  tilt: 12,
  camera: [
    // framed left of the lanes' centre, so the dark band beside the plan card can take the card
    cam(0, 1.3, TIMELINE_OPEN, 1),
    cam(2, 1.5, TIMELINE_OPEN, b(3) - 22),
    cam(b(3) - 20, 2.2, { u: 0.25, v: 0.12 }, 40),
  ],
  callouts: [
    call("lanes", "One row per agent", "They work at the same time", "right", b(1), b(3)),
    call("model-badge", "Model per step", "Ultra plans, Super reads and writes", "below", b(3), b(5), { role: ROLE.researcher }),
  ],
};
export const TIMELINE_B: Shot = {
  shot: "timelineB",
  frames: b(5),
  tilt: 12,
  camera: [
    cam(0, 1.85, { u: 0.44, v: 0.12 }, 1),
    cam(2, 1.95, { u: 0.44, v: 0.12 }, timelineAgentIo - b(5) - 4),
    cam(timelineAgentIo - b(5), 2.3, fo("agent-io"), 30),
  ],
  callouts: [
    call("run-cost", "Live cost", "Stops at your budget", "below", 0, b(2)),
    call("agent-io", "What it read", "Every step is open to check", "left", b(3), b(5)),
  ],
};

export const DOC: Shot = {
  shot: "doc",
  frames: b(6),
  camera: [
    cam(0, 1.6, fo("brief-doc", "brief1-doc"), 1),
    cam(2, 1.75, fo("brief-doc", "brief1-doc"), b(2) - 2),
    cam(b(2) - 10, 2.2, fo("needs-you"), 30),
    cam(b(4) - 10, 2.2, fo("can-wait"), 40),
  ],
  callouts: [
    call("brief-doc", "Your morning, already read", "Inbox, calendar, GitHub → one page", "right", 0, b(2), { inBeat: "brief1-doc" }),
    call("needs-you", "Ranked by who waits", "And by when", "right", b(2), b(4)),
    call("can-wait", "Noise moved aside", "No draft for it", "right", b(4), b(6)),
  ],
};

/** Scene-relative frames of the four approval clicks (take 1915 asks one card at a time): shot A
 *  is the scene's first 3 bars, B, C and D 2 bars each, cut on downbeats. */
export const gate1 = momentFrame("gateA", b(3), MOMENTS.approve1);
export const gate2 = b(3) + momentFrame("gateB", b(2), MOMENTS.approve2);
export const gate3 = b(5) + momentFrame("gateC", b(2), MOMENTS.approve3);
export const gateAllow = b(7) + momentFrame("gateD", b(2), MOMENTS.alwaysAllow);
/** The Approve button: 48 px in from the right of the approval's button row (each approval has
 *  its own row box); "Approve & always allow" sits 200 px in (read off the take at the click). */
export const approveBtn = (inBeat: string, fromRight = 48) => {
  const t = target("approve-buttons", inBeat);
  return { u: (t.x + t.w - fromRight) / 1920, v: (t.y + t.h / 2) / 1080 };
};
const click = (at: number, inBeat: string, fromRight = 48) => ({ at, ...approveBtn(inBeat, fromRight) });
export const GATE_A: Shot = {
  shot: "gateA",
  frames: b(3),
  tilt: 8,
  camera: [cam(0, 1.7, fo("approval-card", SUB.approve1), 1), cam(2, 1.9, fo("approval-card", SUB.approve1), b(3) - 2)],
  rings: [click(gate1, SUB.approve1)],
  ticks: [click(gate1, SUB.approve1)],
  callouts: [call("approval-card", "Sending is an action", "So it waits for you", "above", 0, b(2))],
};
export const GATE_B: Shot = {
  shot: "gateB",
  frames: b(2),
  tilt: 8,
  camera: [cam(0, 1.85, fo("approval-card", SUB.approve2), 1), cam(2, 1.95, fo("approval-card", SUB.approve2), b(2) - 2)],
  rings: [click(gate2 - b(3), SUB.approve2)],
  ticks: [click(gate2 - b(3), SUB.approve2)],
  callouts: [call("approve-buttons", "Approve, reject with a note", "Or allow from now on", "above", 0, b(2), { inBeat: SUB.approve2 })],
};
export const GATE_C: Shot = {
  shot: "gateC",
  frames: b(2),
  tilt: 8,
  camera: [cam(0, 1.85, fo("approval-card", SUB.approve3), 1), cam(2, 1.95, fo("approval-card", SUB.approve3), b(2) - 2)],
  rings: [click(gate3 - b(5), SUB.approve3)],
  ticks: [click(gate3 - b(5), SUB.approve3)],
};
export const GATE_D: Shot = {
  shot: "gateD",
  frames: b(2),
  tilt: 8,
  camera: [
    cam(0, 1.85, fo("approval-card", "always-allow"), 1),
    // to the rule line once "Approve & always allow" has landed
    cam(gateAllow - b(7) + 10, 2.1, fo("rule-line"), 24),
  ],
  rings: [click(gateAllow - b(7), "always-allow", 200)],
  ticks: [click(gateAllow - b(7), "always-allow", 200)],
  callouts: [call("rule-line", "One rule saved", "You can revoke it anytime", "above", gateAllow - b(7) + 24, b(2))],
};

export const SUMMARY: Shot = {
  shot: "summary",
  frames: b(4),
  camera: [cam(0, 1.9, { u: 0.42, v: 0.62 }, 1), cam(2, 2.2, { u: 0.42, v: 0.62 }, b(4) - 2)],
  callouts: [
    call("summary-cost", "The whole morning", "$0.0216", "above", 0, b(2), { inBeat: "brief1-summary" }),
    call("vs-baseline", "Router savings: 24 %", "Versus always using the biggest model", "above", b(2), b(4)),
  ],
};

export const MEMORY: Shot = {
  shot: "memory",
  frames: b(6),
  tilt: 10,
  camera: [
    cam(0, 2.0, fo("memories"), 1),
    cam(2, 2.2, fo("memories"), b(2) - 2),
    cam(b(2) - 10, 2.3, fo("skill-file"), 30),
    cam(b(4) - 10, 2.6, fo("forget"), 30),
  ],
  callouts: [
    call("memories", "Memories", "What it learned from your morning", "left", 0, b(2)),
    call("skill-file", "Its own how-to", "Rewritten after each run", "left", b(2), b(4)),
    call("forget", "Forget or revoke", "You stay in charge", "left", b(4), b(6)),
  ],
};

// the chip in take 1915 reads "learned · 6 mem · 1 rule" at run two's plan (16 memories is the
// count after both runs)
export const LEARNED: Shot = {
  shot: "learned",
  frames: b(3),
  tilt: 10,
  camera: [
    cam(0, 2.0, fo("learned-chip", "brief2-plan-arrives"), 1),
    cam(2, 2.3, fo("learned-chip", "brief2-plan-arrives"), b(3) - 2),
  ],
  callouts: [call("learned-chip", "Uses 6 memories and 1 rule", "No repeat questions", "below", 0, b(2), { inBeat: "brief2-plan-arrives" })],
};
export const RUN2END: Shot = {
  shot: "run2End",
  frames: b(2),
  tilt: 10,
  camera: [cam(0, 2.2, fo("run2-cost"), 1), cam(2, 2.35, fo("run2-cost"), b(2) - 2)],
  // take 1915: run two $0.0209 against run one's $0.0216
  callouts: [call("run2-cost", "Run two: $0.0209", "Cheaper and faster", "below", 0, b(2))],
};

export const CHAT_RUN: Shot = {
  shot: "chatRun",
  frames: b(2),
  camera: [cam(0, 1.9, fo("chat-run"), 1), cam(2, 2.2, fo("chat-run"), b(2) - 2)],
  callouts: [call("chat-run", "Same run, same approvals", "One history", "right", 0, b(2))],
};

// ── NimbusFull: 80 bars (script rev 7) ───────────────────────────────────────────────────

export const FULL = layout([
  { id: "hook", bars: 4 },
  { id: "name", bars: 2 },
  { id: "overview", bars: 6 },
  { id: "ch1", bars: 1 },
  { id: "plan", bars: 6 },
  { id: "timeline", bars: 10 },
  { id: "doc", bars: 6 },
  { id: "ch2", bars: 1 },
  { id: "gate", bars: 9 },
  { id: "summary", bars: 5 },
  { id: "ch3", bars: 1 },
  { id: "memory", bars: 6 },
  { id: "run2", bars: 5 },
  { id: "ch4", bars: 1 },
  { id: "chat", bars: 4 },
  { id: "chatRun", bars: 2 },
  { id: "proof", bars: 3 },
  { id: "terminal", bars: 3 },
  { id: "end", bars: 5 },
] as const);
export const FULL_FRAMES = FULL[FULL.length - 1].from + FULL[FULL.length - 1].frames;
onTheBeat("NimbusFull", FULL);
export const F = Object.fromEntries(FULL.map((s) => [s.id, s])) as Record<
  (typeof FULL)[number]["id"],
  (typeof FULL)[number]
>;

/** A motion scene that opens a footage scene, in frames (Metric Morph before the summary). */
export const FULL_MOTION: Partial<Record<keyof typeof F, number>> = { summary: b(1) };
export const after = (id: keyof typeof F) => F[id].from + (FULL_MOTION[id] ?? 0);

/** The chapter chip's spans: it slides in as each chapter card cuts to footage, and is off
 *  over the motion scenes inside a chapter (Metric Morph, Phone Stack). */
const CH = ["You set the goal. It plans.", "Nothing leaves without you", "It learns every run", "Always on"];
export const CHAPTERS = [
  { n: 1, title: CH[0], from: F.plan.from, to: F.ch2.from },
  { n: 2, title: CH[1], from: F.gate.from, to: F.summary.from },
  { n: 2, title: CH[1], from: after("summary"), to: F.ch3.from },
  { n: 3, title: CH[2], from: F.memory.from, to: F.ch4.from },
  { n: 4, title: CH[3], from: F.chatRun.from, to: F.proof.from },
];

/** Shots per footage scene, in order. */
export const FULL_SCENE_SHOTS: Partial<Record<keyof typeof F, Shot[]>> = {
  overview: [OVERVIEW],
  plan: [GOAL, PLAN],
  timeline: [TIMELINE_A, TIMELINE_B],
  doc: [DOC],
  gate: [GATE_A, GATE_B, GATE_C, GATE_D],
  summary: [SUMMARY],
  memory: [MEMORY],
  run2: [LEARNED, RUN2END],
  chatRun: [CHAT_RUN],
};

/** Scene 16's callout (the phones are not footage; its box is the front phone). */
export const PHONE_CALLOUT: CalloutSpec = call("phone", "Same crew in your chat app", "Via OpenClaw or Hermes", "left", b(1), b(4));

// ── NimbusX: 22 bars ─────────────────────────────────────────────────────────────────────

export const XCUT = layout([
  { id: "hook", bars: 2 },
  { id: "name", bars: 2 },
  { id: "plan", bars: 3 },
  { id: "lanes", bars: 2 },
  { id: "ch2", bars: 1 },
  { id: "gate", bars: 2 },
  { id: "run2", bars: 3 },
  { id: "chat", bars: 4 },
  { id: "terminal", bars: 1 },
  { id: "end", bars: 2 },
] as const);
export const X_FRAMES = XCUT[XCUT.length - 1].from + XCUT[XCUT.length - 1].frames;
onTheBeat("NimbusX", XCUT);
export const X = Object.fromEntries(XCUT.map((s) => [s.id, s])) as Record<
  (typeof XCUT)[number]["id"],
  (typeof XCUT)[number]
>;
export const X_MOTION: Partial<Record<keyof typeof X, number>> = {};

export const X_PLAN: Shot = {
  shot: "xPlan",
  frames: b(3),
  tilt: 10,
  camera: [cam(0, 1.9, fo("plan", "brief1-plan-arrives"), 1), cam(2, 2.2, fo("plan", "brief1-plan-arrives"), b(3) - 2)],
  rings: [planClick("xPlan", b(3))],
  ticks: [planClick("xPlan", b(3))],
  callouts: [call("estimate", "$0.0216", "You see the cost first", "below", 0, b(2))],
};
export const X_LANES: Shot = {
  shot: "xLanes",
  frames: b(2),
  tilt: 12,
  camera: [cam(0, 1.3, LANES_U, 1), cam(2, 1.5, LANES_U, b(2) - 2)],
  callouts: [call("lanes", "One row per agent", "They work at the same time", "right", 0, b(2))],
};
export const xApprove = momentFrame("xGate", b(2), MOMENTS.approve1);
export const X_GATE: Shot = {
  shot: "xGate",
  frames: b(2),
  tilt: 8,
  camera: [cam(0, 1.7, fo("approval-card", SUB.approve1), 1), cam(2, 1.95, fo("approval-card", SUB.approve1), b(2) - 2)],
  rings: [{ at: xApprove, ...approveBtn(SUB.approve1) }],
  ticks: [{ at: xApprove, ...approveBtn(SUB.approve1) }],
  callouts: [call("approval-card", "Sending is an action", "So it waits for you", "above", 0, b(2))],
};

export const X_SCENE_SHOTS: Partial<Record<keyof typeof X, Shot[]>> = {
  plan: [X_PLAN],
  lanes: [X_LANES],
  gate: [X_GATE],
  run2: [LEARNED],
};

export type CalloutAt = {
  key: string;
  target: string;
  from: number;
  to: number;
  why: string;
  what: string;
};

/** Every callout of a cut at its absolute frames, keyed as in callout-layout.json. */
export function calloutIndex(cut: "full" | "x"): CalloutAt[] {
  const scenes = cut === "full" ? FULL : XCUT;
  const map = (cut === "full" ? FULL_SCENE_SHOTS : X_SCENE_SHOTS) as Record<string, Shot[] | undefined>;
  const motion = (cut === "full" ? FULL_MOTION : X_MOTION) as Record<string, number | undefined>;
  const out: CalloutAt[] = [];
  const push = (scope: string, c: CalloutSpec, at: number) =>
    out.push({ key: layoutKey(scope, c), target: c.target, from: at + c.from, to: at + c.to, why: c.why, what: c.what });
  for (const s of scenes) {
    let at = s.from + (motion[s.id] ?? 0);
    for (const shot of map[s.id] ?? []) {
      for (const c of shot.callouts ?? []) push(shot.shot, c, at);
      at += shot.frames;
    }
  }
  if (cut === "full") push("phone", PHONE_CALLOUT, F.chat.from);
  return out.sort((p, q) => p.from - q.from);
}
