// Every footage cut, in source seconds of the take in take.ts (generated from its beats.json),
// so a new take only needs `node scripts/sync-take.mjs <file>` and a look at the fit.
// Shots start inside their beats where the take waits (board.md "Fit against the take");
// the composition plays each one fitted to its scene at MIN_RATE–MAX_RATE.
import { BEATS, type Box, TAKE_FILE } from "./take";

export const TAKE = TAKE_FILE;
export const TAKE_W = 1920;
export const TAKE_H = 1080;

const beat = (name: string) => {
  const b = BEATS.find((x) => x.beat === name);
  if (!b) throw new Error(`beats.json has no beat "${name}"`);
  return b;
};
/** When a beat starts (sub-beats mark a click or an arrival). */
export const at = (name: string) => beat(name).tStart;
export const end = (name: string) => beat(name).tEnd;

/** Board rev E renames the approval sub-beats (the real-model take has role-named contacts);
 *  take 1633 still has the old names, so each new name falls back to its old one. */
const RENAMED: Record<string, string> = { "approve-1": "approve-dana", "approve-2": "approve-priya" };
const sub = (name: string) => (BEATS.some((x) => x.beat === name) ? name : (RENAMED[name] ?? name));
/** The approval sub-beats under the take's own names. */
export const SUB = { approve1: sub("approve-1"), approve2: sub("approve-2") };

/** Targets measured by eye on the take where beats.json's box has scrolled away by the time
 *  the callout shows: the lanes panel scrolls while the run plays, so "model-badge" (y 6, the
 *  orchestrator's badge, already under the header) becomes the Writers' three "Nemotron 3
 *  Super" badges, read off the take at 44–50 s. */
const MEASURED: Record<string, Box> = {
  "model-badge": { x: 310, y: 137, w: 138, h: 156 },
};

/** A callout target's box in take pixels: from `inBeat` if given, else the first beat that has it. */
export function target(name: string, inBeat?: string): Box {
  if (MEASURED[name] && !inBeat) return MEASURED[name];
  const b = inBeat ? beat(inBeat) : BEATS.find((x) => x.targets[name]);
  const box = b?.targets[name];
  if (!box) throw new Error(`beats.json has no target "${name}"${inBeat ? ` in ${inBeat}` : ""}`);
  return box;
}

export type Cut = { from: number; to: number };
const cut = (from: number, to: number): Cut => ({ from, to });
/** A cut from before `t` to `to`, starting early enough that, fitted to a `sceneS` scene, `t`
 *  plays `atS` seconds in. */
const landOn = (t: number, to: number, sceneS: number, atS: number): Cut => {
  const rate = (to - t) / (sceneS - atS);
  return cut(t - atS * rate, to);
};

// Board rev E scenes → source windows. Comments say what each window shows.
export const SHOTS = {
  // 3 Overview: cards count up, the spend chart, the router gauge (also inside the laptop)
  overview: cut(at("overview"), end("overview")),
  // 5 the goal typing into the composer and sent (the composer is empty for ~4.5 s; the plan
  // wait after the send is cut), then the plan draft through Approve plan
  goal: cut(at("brief1-goal") + 4.6, at("brief1-goal") + 10.6),
  plan: cut(at("brief1-plan-arrives") - 0.24, end("brief1-approve-plan")),
  // 6 lanes fill, then Agent I/O on the first email
  timeline: cut(at("brief1-timeline"), end("brief1-agent-io")),
  // 7 the brief doc (a drafted reply shows first; the brief opens ~3 s in)
  doc: cut(at("brief1-doc") + 3, end("brief1-doc")),
  // 9 the card, Approve ×2, Approve & always allow, the rule line. It starts so the first
  // Approve plays 2 bars in: the scene's bar 3 = frame 2280, the music's drop 2
  gate: landOn(at(sub("approve-1")), end("always-allow"), 18, 4),
  // 10 the run summary
  summary: cut(at("brief1-summary"), end("brief1-summary")),
  // 12 Memory & skill (the panel is still loading for ~3.5 s)
  memory: cut(at("memory-skill") + 3.5, end("memory-skill")),
  // 13 the next morning: the plan with the learned chip, then the end of run two
  learned: cut(at("brief2-plan-arrives"), end("brief2-plan-arrives")),
  run2End: cut(end("brief2-run") - 6, end("brief2-run")),
  // 15 radar from the rail, the status pill, the approve from the pill (before the /v1 wait)
  radar: cut(at("radar"), at("radar") + 4),
  pill: cut(at("status-pill") + 1.5, at("status-pill") + 7.5),
  pillApprove: cut(at("pill-approve"), at("pill-approve") + 3),
  // 17 the same run in the web timeline, tagged chat
  chatRun: cut(end("chat-run") - 6, end("chat-run")),
  // 18 Token Factory watch: the routing table and its approval, then the Overview after it
  // (the router gauge is not on screen during `watch`)
  watch: cut(at("watch-approve") - 5, at("watch-approve") + 1),
  overviewAfter: cut(at("overview-after"), at("overview-after") + 3),
  // X clip variants
  xPlan: cut(at("brief1-plan-arrives") - 0.4, end("brief1-approve-plan")),
  xLanes: cut(at("brief1-timeline") + 4, at("brief1-timeline") + 10), // the lanes fill ~4 s in
  // the X gate is 2 bars and its Approve lands 1.5 bars in (frame 690)
  xGate: landOn(at(sub("approve-1")), at(sub("approve-1")) + 1.5, 4, 3),
} satisfies Record<string, Cut>;
export type ShotName = keyof typeof SHOTS;

/** Clicks and arrivals the cut and the sound land on (the recorder's sub-beats). */
export const MOMENTS = {
  planArrives: at("brief1-plan-arrives"),
  approvePlan: at("brief1-approve-plan"),
  agentIo: at("brief1-agent-io"),
  approve1: at(sub("approve-1")),
  approve2: at(sub("approve-2")),
  alwaysAllow: at("always-allow"),
  learnedPlan: at("brief2-plan-arrives"),
  pillApprove: at("pill-approve") + 0.6,
  watchApprove: at("watch-approve"),
};

export const MIN_RATE = 0.5;
export const MAX_RATE = 1.5;

/** A cut fitted to a scene: its playback rate, clamped; past the clamp the cut is shortened. */
export function fit(c: Cut, sceneSeconds: number): Cut & { rate: number } {
  const rate = Math.min(MAX_RATE, Math.max(MIN_RATE, (c.to - c.from) / sceneSeconds));
  return { from: c.from, to: c.from + rate * sceneSeconds, rate };
}

/** Frame inside a shot of `frames` where source second `t` plays. */
export function momentFrame(shot: ShotName, frames: number, t: number, fps = 30) {
  const c = fit(SHOTS[shot], frames / fps);
  return Math.round(((t - c.from) / c.rate) * fps);
}

/** A target's centre as a camera focus point (0–1 of the take). */
export const focus = (name: string, inBeat?: string) => {
  const b = target(name, inBeat);
  return { u: (b.x + b.w / 2) / TAKE_W, v: (b.y + b.h / 2) / TAKE_H };
};
