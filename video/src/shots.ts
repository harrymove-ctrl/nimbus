// Every shot, scene layout and callout of both cuts, as plain data (no React, no fonts), so
// Node scripts can read it: scripts/callout-index.mjs prints the callout index that
// scripts/layout-callouts.py measures card spots from. compositions.tsx renders it.
import { MOMENTS, momentFrame, type ShotName, target } from "./beats";
import { type CalloutSpec, layoutKey } from "./callout-spec";
import type { SourceMove } from "./Footage";
import { bars, framesPerBeat, layout } from "./grid";
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

// ── Scene shots (board rev C) ─────────────────────────────────────────────────────────────

export const COLD: Shot = {
  shot: "cold",
  frames: b(3),
  camera: [
    cam(0, 1.35, { u: 0.62, v: 0.6 }, 1),
    cam(2, 1.55, { u: 0.7, v: 0.62 }, b(3) - 2),
  ],
  callouts: [
    call(
      "brief-doc",
      "Your morning, already read",
      "Inbox, calendar, GitHub → one page",
      "left",
      0,
      b(2),
      { inBeat: "brief1-doc" },
    ),
    call(
      "tray",
      "3 replies drafted",
      "Nothing is sent without your OK",
      "above",
      b(1),
      b(3),
    ),
  ],
};

/** The router gauge framed with room on its left: the empty right half of the Runs panel. */
const GAUGE_ROOM = { u: 0.708, v: 0.75 };
export const OVERVIEW: Shot = {
  shot: "overview",
  frames: b(6),
  camera: [
    cam(0, 1.5, fo("workstreams"), 1),
    cam(10, 1.7, { u: 0.22, v: 0.5 }, 60),
    cam(b(2), 1.55, fo("spend-chart", "overview"), 45),
    // the gauge sits right of centre so its card has the Runs panel's empty half (Gate 3:
    // no card over UI text); the move lands before the card is in
    cam(b(4) - 12, 2.0, GAUGE_ROOM, 30),
  ],
  callouts: [
    call(
      "workstreams",
      "Workstreams",
      "Chores that run on a schedule",
      "right",
      0,
      b(2),
      { inBeat: "overview" },
    ),
    call(
      "spend-chart",
      "Every call priced",
      "On Nebius Token Factory",
      "right",
      b(2),
      b(4),
      { inBeat: "overview" },
    ),
    call(
      "router-gauge",
      "Cost router",
      "Cheapest Nemotron that can do the step",
      "left",
      b(4),
      b(6),
      { inBeat: "overview" },
    ),
  ],
};

// the goal: 1 bar, a push from the whole page to the composer as the words type
export const GOAL: Shot = {
  shot: "goal",
  frames: b(1),
  camera: [
    cam(0, 1.6, { u: 0.46, v: 0.75 }, 1),
    cam(2, 2.4, { u: 0.46, v: 0.88 }, b(1) - 4),
  ],
};
// Approve plan: its button sits 41 px in from the plan card's right edge and 103 px below it
// (measured on the take at the click; beats.json has no box for the button itself).
const approvePlanBtn = (() => {
  const t = target("plan", "brief1-plan-arrives");
  return { u: (t.x + t.w - 41) / 1920, v: (t.y + t.h + 103) / 1080 };
})();
export const PLAN: Shot = {
  shot: "plan",
  frames: b(6),
  camera: [
    cam(0, 1.9, fo("plan", "brief1-plan-arrives"), 1),
    // the whole plan card with the dark band under it (above the composer) for the plan
    // and estimate cards, held still while they are up, its header clear of the eyebrow
    // (Gate 3: no card over UI text)
    cam(20, 1.9, { u: 0.463, v: 0.571 }, 40),
    cam(b(4), 2.4, { u: 0.46, v: 0.58 }, 40),
  ],
  rings: [{ at: momentFrame("plan", b(6), MOMENTS.approvePlan), ...approvePlanBtn }],
  callouts: [
    call(
      "plan",
      "The plan",
      "Who does what, before anything runs",
      "right",
      b(1),
      b(3),
      { inBeat: "brief1-plan-arrives" },
    ),
    call(
      "estimate",
      "≈ $0.03 · mock",
      "You see the cost first",
      "below",
      b(2),
      b(4),
    ),
    call(
      "tools",
      "Allowed tools",
      "It can't use anything else",
      "below",
      b(4),
      b(6),
    ),
  ],
};

export const LANES_U = { u: 0.45, v: 0.2 };
export const timelineAgentIo = momentFrame("timeline", b(10), MOMENTS.agentIo);
export const TIMELINE: Shot = {
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
    call(
      "lanes",
      "One row per agent",
      "They work at the same time",
      "below",
      b(1),
      b(3),
    ),
    call(
      "model-badge",
      "Model per step",
      "Ultra plans, Super reads and writes",
      "below",
      b(3),
      b(5),
      { role: ROLE.analyst },
    ),
    call("run-cost", "Live cost", "Stops at your budget", "below", b(5), b(7)),
    call(
      "agent-io",
      "What it read",
      "Every step is open to check",
      "left",
      b(8),
      b(10),
    ),
  ],
};

export const DOC: Shot = {
  shot: "doc",
  frames: b(5),
  camera: [
    cam(0, 2.0, fo("needs-you"), 1),
    cam(2, 2.2, fo("needs-you"), b(2)),
    cam(b(3), 2.2, fo("can-wait"), 40),
  ],
  callouts: [
    call("needs-you", "Ranked by who waits", "And by when", "left", 0, b(2)),
    call(
      "can-wait",
      "Noise moved aside",
      "No draft for it",
      "left",
      b(3),
      b(5),
    ),
  ],
};

export const gateDana = momentFrame("gate", b(9), MOMENTS.approveDana);
export const gatePriya = momentFrame("gate", b(9), MOMENTS.approvePriya);
export const gateAllow = momentFrame("gate", b(9), MOMENTS.alwaysAllow);
export const approveBtn = (() => {
  const t = target("approve-buttons");
  return { u: (t.x + t.w - 48) / 1920, v: (t.y + t.h / 2) / 1080 };
})();
export const GATE: Shot = {
  shot: "gate",
  frames: b(9),
  camera: [
    cam(0, 1.7, fo("approval-card"), 1),
    cam(2, 1.9, fo("approval-card"), b(3)),
    cam(b(6), 2.1, fo("rule-line"), 40),
  ],
  rings: [
    { at: gateDana, ...approveBtn },
    { at: gatePriya, ...approveBtn },
  ],
  callouts: [
    call(
      "approval-card",
      "Sending is an action",
      "So it waits for you",
      "above",
      0,
      b(3),
    ),
    call(
      "approve-buttons",
      "Approve, reject with a note",
      "Or allow from now on",
      "above",
      b(3),
      b(6),
    ),
    call(
      "rule-line",
      "One rule saved",
      "You can revoke it anytime",
      "above",
      b(7),
      b(9),
    ),
  ],
};

export const SUMMARY: Shot = {
  shot: "summary",
  frames: b(5),
  camera: [
    cam(0, 1.9, { u: 0.42, v: 0.62 }, 1),
    cam(2, 2.2, { u: 0.42, v: 0.62 }, b(5) - 2),
  ],
  callouts: [
    call(
      "summary-cost",
      "The whole morning",
      "$0.024 · mock",
      "above",
      b(1),
      b(3),
      { inBeat: "brief1-summary" },
    ),
    call(
      "vs-baseline",
      "Router savings",
      "Versus always using the biggest model",
      "above",
      b(3),
      b(5),
    ),
  ],
};

export const MEMORY: Shot = {
  shot: "memory",
  frames: b(7),
  camera: [
    cam(0, 2.0, fo("memories"), 1),
    cam(2, 2.2, fo("memories"), b(2)),
    cam(b(3), 2.3, fo("skill-file"), 40),
    cam(b(5), 2.6, fo("forget"), 40),
  ],
  callouts: [
    call(
      "memories",
      "Memories",
      "What it learned from your morning",
      "left",
      0,
      b(2),
    ),
    call(
      "skill-file",
      "Its own how-to",
      "Rewritten after each run",
      "left",
      b(3),
      b(5),
    ),
    call(
      "forget",
      "Forget or revoke",
      "You stay in charge",
      "left",
      b(5),
      b(7),
    ),
  ],
};

export const LEARNED: Shot = {
  shot: "learned",
  frames: b(3),
  camera: [
    cam(0, 2.0, fo("learned-chip", "brief2-plan-arrives"), 1),
    cam(2, 2.3, fo("learned-chip", "brief2-plan-arrives"), b(3) - 2),
  ],
  callouts: [
    call(
      "learned-chip",
      "Uses what it learned",
      "No repeat questions",
      "below",
      b(1),
      b(3),
      { inBeat: "brief2-plan-arrives" },
    ),
  ],
};
export const RUN2END: Shot = {
  shot: "run2End",
  frames: b(3),
  camera: [
    cam(0, 1.9, { u: 0.55, v: 0.2 }, 1),
    cam(b(1), 2.2, fo("run2-cost"), 40),
  ],
  callouts: [
    call(
      "run2-cost",
      "Run two: $0.016 · mock",
      "Cheaper and faster",
      "below",
      b(1),
      b(3),
    ),
  ],
};

export const RADAR: Shot = {
  shot: "radar",
  frames: b(2),
  camera: [
    cam(0, 2.2, fo("unread-dot"), 1),
    cam(2, 2.5, fo("unread-dot"), b(2) - 2),
  ],
  callouts: [
    call(
      "unread-dot",
      "Ran on schedule",
      "While you were away",
      "right",
      0,
      b(2),
    ),
  ],
};
export const PILL: Shot = {
  shot: "pill",
  frames: b(3),
  camera: [
    cam(0, 2.2, fo("status-pill"), 1),
    cam(2, 2.5, fo("status-pill"), b(3) - 2),
  ],
  callouts: [
    call(
      "status-pill",
      "Status pill",
      "Answer from anywhere in the app",
      "below",
      b(1),
      b(3),
    ),
  ],
};
export const PILL_APPROVE: Shot = {
  shot: "pillApprove",
  frames: b(1),
  camera: [
    cam(0, 2.4, { u: 0.86, v: 0.2 }, 1),
    cam(2, 2.6, { u: 0.86, v: 0.2 }, b(1) - 2),
  ],
};

export const CHAT_RUN: Shot = {
  shot: "chatRun",
  frames: b(2),
  camera: [
    cam(0, 1.9, fo("chat-run"), 1),
    cam(2, 2.2, fo("chat-run"), b(2) - 2),
  ],
  callouts: [
    call(
      "chat-run",
      "Same run, same approvals",
      "One history",
      "right",
      0,
      b(2),
    ),
  ],
};

export const WATCH: Shot = {
  shot: "watch",
  frames: b(3),
  camera: [
    cam(0, 2.0, fo("routing-table"), 1),
    cam(2, 2.3, fo("routing-table"), b(3) - 2),
  ],
  callouts: [
    call(
      "routing-table",
      "It watches its own bill",
      "Proposes cheaper routing",
      "left",
      0,
      b(2),
    ),
  ],
};
export const OVERVIEW_AFTER: Shot = {
  shot: "overviewAfter",
  frames: b(2),
  camera: [
    cam(0, 2.0, GAUGE_ROOM, 1),
    cam(2, 2.1, GAUGE_ROOM, b(2) - 2),
  ],
  callouts: [
    call("router-gauge", "Approved", "Saving shows up here", "left", 0, b(2), {
      inBeat: "overview-after",
    }),
  ],
};

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
export const FULL_FRAMES =
  FULL[FULL.length - 1].from + FULL[FULL.length - 1].frames;
onTheBeat("NimbusFull", FULL);
export const F = Object.fromEntries(FULL.map((s) => [s.id, s])) as Record<
  (typeof FULL)[number]["id"],
  (typeof FULL)[number]
>;

export const CHAPTERS = [
  { n: 1, title: "You approve the plan", from: F.plan.from, to: F.gate.from },
  {
    n: 2,
    title: "Nothing leaves without you",
    from: F.gate.from,
    to: F.memory.from,
  },
  {
    n: 3,
    title: "It gets better every run",
    from: F.memory.from,
    to: F.radar.from,
  },
  { n: 4, title: "Always on", from: F.radar.from, to: F.proof.from },
];

export const XCUT = layout([
  { id: "cold", bars: 3 },
  { id: "title", bars: 2 },
  { id: "plan", bars: 3 },
  { id: "gate", bars: 5 },
  { id: "run2", bars: 3 },
  { id: "chat", bars: 4 },
  { id: "end", bars: 2 },
] as const);
export const X_FRAMES =
  XCUT[XCUT.length - 1].from + XCUT[XCUT.length - 1].frames;
onTheBeat("NimbusX", XCUT);
export const X = Object.fromEntries(XCUT.map((s) => [s.id, s])) as Record<
  (typeof XCUT)[number]["id"],
  (typeof XCUT)[number]
>;

export const X_PLAN: Shot = {
  shot: "xPlan",
  frames: b(3),
  camera: [
    cam(0, 1.9, fo("plan", "brief1-plan-arrives"), 1),
    cam(2, 2.2, fo("plan", "brief1-plan-arrives"), b(3) - 2),
  ],
  rings: [{ at: momentFrame("xPlan", b(3), MOMENTS.approvePlan), ...approvePlanBtn }],
  callouts: [
    call(
      "estimate",
      "≈ $0.03 · mock",
      "You see the cost first",
      "below",
      0,
      b(2),
    ),
  ],
};
export const X_LANES: Shot = {
  shot: "xLanes",
  frames: b(2),
  camera: [cam(0, 1.3, LANES_U, 1), cam(2, 1.5, LANES_U, b(2) - 2)],
  callouts: [
    call(
      "lanes",
      "One row per agent",
      "They work at the same time",
      "below",
      0,
      b(2),
    ),
  ],
};
export const xDana = momentFrame("xGate", b(3), MOMENTS.approveDana);
export const X_GATE: Shot = {
  shot: "xGate",
  frames: b(3),
  camera: [
    cam(0, 1.7, fo("approval-card"), 1),
    cam(2, 1.95, fo("approval-card"), b(3) - 2),
  ],
  rings: [{ at: xDana, ...approveBtn }],
  callouts: [
    call(
      "approval-card",
      "Sending is an action",
      "So it waits for you",
      "above",
      0,
      b(2),
    ),
  ],
};

/** Scene 12's phone callout (the phone is not footage; its box is the phone frame). */
export const PHONE_CALLOUT: CalloutSpec = call(
  "phone",
  "Same crew in your chat app",
  "Via OpenClaw or Hermes",
  "left",
  b(2),
  b(4),
);

/** Shots per scene, in order (the phone part of the chat scene is not footage). */
export const FULL_SCENE_SHOTS: Partial<Record<keyof typeof F, Shot[]>> = {
  cold: [COLD],
  overview: [OVERVIEW],
  plan: [GOAL, PLAN],
  timeline: [TIMELINE],
  doc: [DOC],
  gate: [GATE],
  summary: [SUMMARY],
  memory: [MEMORY],
  run2: [LEARNED, RUN2END],
  radar: [RADAR, PILL, PILL_APPROVE],
  watch: [WATCH, OVERVIEW_AFTER],
};
export const X_SCENE_SHOTS: Partial<Record<keyof typeof X, Shot[]>> = {
  cold: [COLD],
  plan: [X_PLAN],
  gate: [X_LANES, X_GATE],
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
  const map = (cut === "full" ? FULL_SCENE_SHOTS : X_SCENE_SHOTS) as Record<
    string,
    Shot[] | undefined
  >;
  const out: CalloutAt[] = [];
  for (const s of scenes) {
    let at = s.from;
    for (const shot of map[s.id] ?? []) {
      for (const c of shot.callouts ?? [])
        out.push({
          key: layoutKey(shot.shot, c),
          target: c.target,
          from: at + c.from,
          to: at + c.to,
          why: c.why,
          what: c.what,
        });
      at += shot.frames;
    }
  }
  if (cut === "full") {
    const c = PHONE_CALLOUT;
    out.push({
      key: layoutKey("phone", c),
      target: c.target,
      from: F.chat.from + c.from,
      to: F.chat.from + c.to,
      why: c.why,
      what: c.what,
    });
    let at = F.chat.from + b(6);
    for (const c2 of CHAT_RUN.callouts ?? [])
      out.push({
        key: layoutKey(CHAT_RUN.shot, c2),
        target: c2.target,
        from: at + c2.from,
        to: at + c2.to,
        why: c2.why,
        what: c2.what,
      });
    at += 0;
  }
  return out.sort((p, q) => p.from - q.from);
}
