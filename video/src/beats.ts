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

/** A callout target's box in take pixels: from `inBeat` if given, else the first beat that has it. */
export function target(name: string, inBeat?: string): Box {
  const b = inBeat ? beat(inBeat) : BEATS.find((x) => x.targets[name]);
  const box = b?.targets[name];
  if (!box) throw new Error(`beats.json has no target "${name}"${inBeat ? ` in ${inBeat}` : ""}`);
  return box;
}

export type Cut = { from: number; to: number };
const cut = (from: number, to: number): Cut => ({ from, to });

// Board rev C scenes → source windows. Comments say what each window shows.
export const SHOTS = {
  // 1 cold open: the brief open beside the approval cards, the tray, the cloud orange
  cold: cut(at("brief1-approvals"), at("approve-dana")),
  // 3 Overview: cards count up, the spend chart, the router gauge
  overview: cut(at("overview"), end("overview")),
  // 4 the goal types (after the page opens), then the plan draft through Approve plan
  goal: cut(at("brief1-goal") + 3.7, at("brief1-goal") + 7.7),
  plan: cut(at("brief1-plan-arrives") - 1, end("brief1-approve-plan")),
  // 5 lanes fill, then Agent I/O on Dana's email
  timeline: cut(at("brief1-timeline"), end("brief1-agent-io")),
  // 6 the brief doc
  doc: cut(at("brief1-doc") + 3, end("brief1-doc")), // the draft to Sam shows first; the brief opens ~3 s in
  // 7 the cloud orange, the cards, Approve ×2, Approve & always allow, the rule line; the
  // start is set so Approve (Dana) lands on the scene's bar 3 (the music's drop 2)
  gate: cut(at("approve-dana") - 5.24, end("always-allow")),
  // 8 the run summary
  summary: cut(at("brief1-summary"), end("brief1-summary")),
  // 9 Memory & skill
  memory: cut(at("memory-skill") + 1.5, end("memory-skill")), // the panel is still loading for ~1.5 s
  // 10 the next morning: the plan with the learned chip, then the end of run two
  learned: cut(at("brief2-plan-arrives"), end("brief2-plan-arrives")),
  run2End: cut(end("brief2-run") - 9, end("brief2-run")),
  // 11 radar from the rail, the status pill, the approve from the pill (before the /v1 wait)
  radar: cut(at("radar"), at("radar") + 4),
  pill: cut(at("status-pill") + 1.5, end("status-pill")),
  pillApprove: cut(at("pill-approve"), at("pill-approve") + 3),
  // 12 behind the phone: the web app, blurred; then the same run in the web timeline, tagged chat
  phoneBg: cut(at("chat-run"), end("chat-run")),
  chatRun: cut(end("chat-run") - 6, end("chat-run")),
  // 13 Token Factory watch: the routing table and its approval, then the Overview after it
  // (the router gauge is not on screen during `watch`)
  watch: cut(at("watch-approve") - 8, at("watch-approve") + 1),
  overviewAfter: cut(at("overview-after"), at("overview-after") + 6),
  // X clip variants
  xPlan: cut(at("brief1-plan-arrives") - 1.2, end("brief1-approve-plan")),
  xLanes: cut(at("brief1-timeline"), at("brief1-timeline") + 6),
  xGate: cut(at("approve-dana") - 3, at("approve-dana") + 3),
} satisfies Record<string, Cut>;
export type ShotName = keyof typeof SHOTS;

/** Clicks and arrivals the cut and the sound land on (the recorder's sub-beats). */
export const MOMENTS = {
  planArrives: at("brief1-plan-arrives"),
  approvePlan: at("brief1-approve-plan"),
  agentIo: at("brief1-agent-io"),
  approveDana: at("approve-dana"),
  approvePriya: at("approve-priya"),
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
