// Every shot, scene layout and callout of both cuts, as plain data (no React, no fonts), so
// Node scripts can read it: scripts/callout-index.mjs prints the callout index that
// scripts/layout-callouts.py measures card spots from. compositions.tsx renders it.
import { MOMENTS, momentFrame, type ShotName, SUB, target } from "./beats";
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
export const fo = (name: string, inBeat?: string) => {
  const t = target(name, inBeat);
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
// Callout spans are frames inside the shot. Numbers are the fixture take's until the real-model
// take lands (the preview watermark says so); no "mock" tag (script rev 6).

/** The router gauge framed with room on its left: the empty right half of the Runs panel. */
const GAUGE_ROOM = { u: 0.708, v: 0.75 };
/** Scene 3: the laptop dives into the screen over the first 75 frames, then the callouts. */
export const LAPTOP_FRAMES = 75;
export const OVERVIEW: Shot = {
  shot: "overview",
  frames: b(6),
  tilt: 10,
  camera: [
    cam(0, 1.5, fo("workstreams"), 1),
    cam(10, 1.7, { u: 0.22, v: 0.5 }, 60),
    cam(beats(11) - 20, 1.55, fo("spend-chart", "overview"), 40),
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
    call("estimate", "≈ $0.03", "You see the cost first", "below", b(1), b(3)),
    call("tools", "Allowed tools", "It can't use anything else", "below", b(2), b(4)),
  ],
};

export const LANES_U = { u: 0.45, v: 0.2 };
export const timelineAgentIo = momentFrame("timeline", b(10), MOMENTS.agentIo);
export const TIMELINE: Shot = {
  shot: "timeline",
  frames: b(10),
  tilt: 12,
  camera: [
    cam(0, 1.3, LANES_U, 1),
    cam(2, 1.5, LANES_U, b(3)),
    cam(b(4) - 20, 2.2, { u: 0.25, v: 0.12 }, 40),
    cam(b(6) - 20, 1.85, { u: 0.44, v: 0.12 }, 40),
    cam(timelineAgentIo, 2.3, fo("agent-io"), 30),
  ],
  callouts: [
    // the lanes fill about 2 bars in (the run plans first)
    call("lanes", "One row per agent", "They work at the same time", "right", b(2), b(4)),
    call("model-badge", "Model per step", "Ultra plans, Super reads and writes", "below", b(4), b(6), { role: ROLE.analyst }),
    call("run-cost", "Live cost", "Stops at your budget", "below", b(6), b(8)),
    call("agent-io", "What it read", "Every step is open to check", "left", b(8), b(10)),
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

export const gate1 = momentFrame("gate", b(9), MOMENTS.approve1);
export const gate2 = momentFrame("gate", b(9), MOMENTS.approve2);
export const gateAllow = momentFrame("gate", b(9), MOMENTS.alwaysAllow);
/** The Approve button: 48 px in from the right of the approval's button row (each approval has
 *  its own row box); "Approve & always allow" sits 200 px in (read off the take at the click). */
export const approveBtn = (inBeat: string, fromRight = 48) => {
  const t = target("approve-buttons", inBeat);
  return { u: (t.x + t.w - fromRight) / 1920, v: (t.y + t.h / 2) / 1080 };
};
export const GATE: Shot = {
  shot: "gate",
  frames: b(9),
  tilt: 8,
  camera: [
    cam(0, 1.7, fo("approval-card"), 1),
    cam(2, 1.9, fo("approval-card"), b(2)),
    // to the rule line once "Approve & always allow" has landed
    cam(gateAllow + 12, 2.1, fo("rule-line"), 30),
  ],
  rings: [
    { at: gate1, ...approveBtn(SUB.approve1) },
    { at: gate2, ...approveBtn(SUB.approve2) },
    { at: gateAllow, ...approveBtn("always-allow", 200) },
  ],
  ticks: [
    { at: gate1, ...approveBtn(SUB.approve1) },
    { at: gate2, ...approveBtn(SUB.approve2) },
    { at: gateAllow, ...approveBtn("always-allow", 200) },
  ],
  callouts: [
    call("approval-card", "Sending is an action", "So it waits for you", "above", 0, b(2)),
    call("approve-buttons", "Approve, reject with a note", "Or allow from now on", "above", b(3), b(6)),
    call("rule-line", "One rule saved", "You can revoke it anytime", "above", b(7), b(9)),
  ],
};

export const SUMMARY: Shot = {
  shot: "summary",
  frames: b(4),
  camera: [cam(0, 1.9, { u: 0.42, v: 0.62 }, 1), cam(2, 2.2, { u: 0.42, v: 0.62 }, b(4) - 2)],
  callouts: [
    call("summary-cost", "The whole morning", "$0.024", "above", 0, b(2), { inBeat: "brief1-summary" }),
    call("vs-baseline", "Router savings", "Versus always using the biggest model", "above", b(2), b(4)),
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

export const LEARNED: Shot = {
  shot: "learned",
  frames: b(3),
  tilt: 10,
  camera: [
    cam(0, 2.0, fo("learned-chip", "brief2-plan-arrives"), 1),
    cam(2, 2.3, fo("learned-chip", "brief2-plan-arrives"), b(3) - 2),
  ],
  callouts: [call("learned-chip", "Uses what it learned", "No repeat questions", "below", 0, b(2), { inBeat: "brief2-plan-arrives" })],
};
export const RUN2END: Shot = {
  shot: "run2End",
  frames: b(2),
  tilt: 10,
  camera: [cam(0, 2.2, fo("run2-cost"), 1), cam(2, 2.35, fo("run2-cost"), b(2) - 2)],
  callouts: [call("run2-cost", "Run two: $0.016", "Cheaper and faster", "below", 0, b(2))],
};

export const RADAR: Shot = {
  shot: "radar",
  frames: b(2),
  tilt: 12,
  camera: [cam(0, 2.2, fo("unread-dot"), 1), cam(2, 2.5, fo("unread-dot"), b(2) - 2)],
  callouts: [call("unread-dot", "Ran on schedule", "While you were away", "right", 0, b(2))],
};
export const PILL: Shot = {
  shot: "pill",
  frames: b(2),
  tilt: 12,
  camera: [cam(0, 2.2, fo("status-pill"), 1), cam(2, 2.5, fo("status-pill"), b(2) - 2)],
  callouts: [call("status-pill", "Status pill", "Answer from anywhere in the app", "below", 0, b(2))],
};
export const PILL_APPROVE: Shot = {
  shot: "pillApprove",
  frames: b(1),
  tilt: 12,
  camera: [cam(0, 2.4, { u: 0.86, v: 0.2 }, 1), cam(2, 2.6, { u: 0.86, v: 0.2 }, b(1) - 2)],
};

export const CHAT_RUN: Shot = {
  shot: "chatRun",
  frames: b(2),
  camera: [cam(0, 1.9, fo("chat-run"), 1), cam(2, 2.2, fo("chat-run"), b(2) - 2)],
  callouts: [call("chat-run", "Same run, same approvals", "One history", "right", 0, b(2))],
};

export const WATCH: Shot = {
  shot: "watch",
  frames: b(2),
  tilt: 8,
  camera: [cam(0, 2.0, fo("routing-table"), 1), cam(2, 2.3, fo("routing-table"), b(2) - 2)],
  callouts: [call("routing-table", "It watches its own bill", "Proposes cheaper routing", "right", 0, b(2))],
};
export const OVERVIEW_AFTER: Shot = {
  shot: "overviewAfter",
  frames: b(1),
  camera: [cam(0, 2.0, GAUGE_ROOM, 1), cam(2, 2.1, GAUGE_ROOM, b(1) - 2)],
  callouts: [call("router-gauge", "Approved", "The saving shows up here", "left", 0, b(1), { inBeat: "overview-after" })],
};

// ── NimbusFull: 88 bars (script rev 6) ───────────────────────────────────────────────────

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
  { id: "radar", bars: 5 },
  { id: "chat", bars: 4 },
  { id: "chatRun", bars: 2 },
  { id: "watch", bars: 3 },
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
  { n: 4, title: CH[3], from: F.radar.from, to: F.chat.from },
  { n: 4, title: CH[3], from: F.chatRun.from, to: F.proof.from },
];

/** Shots per footage scene, in order. */
export const FULL_SCENE_SHOTS: Partial<Record<keyof typeof F, Shot[]>> = {
  overview: [OVERVIEW],
  plan: [GOAL, PLAN],
  timeline: [TIMELINE],
  doc: [DOC],
  gate: [GATE],
  summary: [SUMMARY],
  memory: [MEMORY],
  run2: [LEARNED, RUN2END],
  radar: [RADAR, PILL, PILL_APPROVE],
  chatRun: [CHAT_RUN],
  watch: [WATCH, OVERVIEW_AFTER],
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
  callouts: [call("estimate", "≈ $0.03", "You see the cost first", "below", 0, b(2))],
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
  camera: [cam(0, 1.7, fo("approval-card"), 1), cam(2, 1.95, fo("approval-card"), b(2) - 2)],
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
