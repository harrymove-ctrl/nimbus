// Every footage cut, in source seconds of its take (generated from each take's beats.json by
// scripts/sync-take.mjs), so a new take only needs a sync and a look at the fit.
// Every shot plays the real-model take 1915 (src/take.ts, the live beats.json; RELEASE.md
// "Measured on take 1915"). Script rev 7 cut the two scenes the mock take 1258 played.
// Shots start inside their beats where the take waits; the composition plays each one
// fitted to its scene at MIN_RATE–MAX_RATE.
import * as REAL from "./take";
import type { Box } from "./take";

export type TakeId = "real";
const TAKES = { real: REAL } as const;
export const TAKE_FILES: Record<TakeId, string> = { real: REAL.TAKE_FILE };
export const TAKE_W = 1920;
export const TAKE_H = 1080;

const beat = (name: string, take: TakeId = "real") => {
  const b = TAKES[take].BEATS.find((x) => x.beat === name);
  if (!b) throw new Error(`beats.json (${take}) has no beat "${name}"`);
  return b;
};
/** When a beat starts (sub-beats mark a click or an arrival). */
export const at = (name: string, take: TakeId = "real") => beat(name, take).tStart;
export const end = (name: string, take: TakeId = "real") => beat(name, take).tEnd;

/** The approval sub-beats (take 1915: four clicks, the fourth with always-allow). */
export const SUB = { approve1: "approve-1", approve2: "approve-2", approve3: "approve-3" };

/** A callout target's box in take pixels: from `inBeat` if given, else the first beat that has it. */
export function target(name: string, inBeat?: string, take: TakeId = "real"): Box {
  const b = inBeat ? beat(inBeat, take) : TAKES[take].BEATS.find((x) => x.targets[name]);
  const box = b?.targets[name];
  if (!box) throw new Error(`beats.json (${take}) has no target "${name}"${inBeat ? ` in ${inBeat}` : ""}`);
  return box;
}

export type Cut = { from: number; to: number; take: TakeId };
const cut = (from: number, to: number, take: TakeId = "real"): Cut => ({ from, to, take });
/** A cut from before `t` to `to`, starting early enough that, fitted to a `sceneS` scene, `t`
 *  plays `atS` seconds in. */
const landOn = (t: number, to: number, sceneS: number, atS: number): Cut => {
  const rate = (to - t) / (sceneS - atS);
  return cut(t - atS * rate, to);
};

// Board rev E scenes → source windows. Comments say what each window shows (all take 1915).
export const SHOTS = {
  // 3 Overview: cards count up, the spend chart, the router gauge (also inside the laptop).
  // From 6 s in: the boot overlay and the list's loading placeholders are gone by then
  overview: cut(at("overview") + 6, end("overview")),
  // 5 the last 6 s of the goal typing and the send (typing runs ~29–45 s), then the plan
  // draft through Approve plan
  goal: cut(39, 45),
  plan: cut(at("brief1-plan-arrives") - 0.24, end("brief1-approve-plan")),
  // 6 the timeline beat runs 60 s: the plan card and the planning wait are cut, the lanes
  // filling (from ~75 s) and the Writer through Agent I/O are two shots cut on bar 6
  timelineA: cut(75, 90),
  timelineB: cut(end("brief1-agent-io") - 15, end("brief1-agent-io")),
  // 7 the brief doc (it opens in the right panel ~4.4 s into its beat)
  doc: cut(at("brief1-doc") + 4.4, end("brief1-doc")),
  // 9 four clicks, one card at a time, in four shots cut on downbeats. A: the first Approve
  // plays 2 bars in = frame 2280, the music's drop 2. B, C: the second and third Approve, a
  // second into each. D: Approve & always allow, then the rule line.
  gateA: landOn(at(SUB.approve1), at(SUB.approve1) + 2, 6, 4),
  gateB: cut(at(SUB.approve2) - 1, at(SUB.approve2) + 3),
  gateC: cut(at(SUB.approve3) - 1, at(SUB.approve3) + 3),
  gateD: cut(at("always-allow") - 1, at("always-allow") + 5),
  // 10 the run summary
  summary: cut(at("brief1-summary") + 0.5, end("brief1-summary")),
  // 12 Memory & skill (the panel is up ~1.2 s in)
  memory: cut(at("memory-skill") + 1.2, end("memory-skill")),
  // 13 the next morning: the plan with the learned chip, then the end of run two (91 s run)
  learned: cut(at("brief2-plan-arrives"), end("brief2-plan-arrives")),
  run2End: cut(end("brief2-run") - 6, end("brief2-run")),
  // 17 the run started from chat, in the web timeline (trigger "chat")
  chatRun: cut(end("chat-run") - 6, end("chat-run")),
  // X clip variants
  xPlan: cut(at("brief1-plan-arrives") - 0.4, end("brief1-approve-plan")),
  xLanes: cut(76, 82),
  // the X gate is 2 bars and its Approve lands 1.5 bars in (frame 690)
  xGate: landOn(at(SUB.approve1), at(SUB.approve1) + 1.5, 4, 3),
} satisfies Record<string, Cut>;
export type ShotName = keyof typeof SHOTS;

/** Clicks and arrivals the cut and the sound land on (the recorder's sub-beats). */
export const MOMENTS = {
  planArrives: at("brief1-plan-arrives"),
  approvePlan: at("brief1-approve-plan"),
  agentIo: at("brief1-agent-io"),
  approve1: at(SUB.approve1),
  approve2: at(SUB.approve2),
  approve3: at(SUB.approve3),
  alwaysAllow: at("always-allow"),
  learnedPlan: at("brief2-plan-arrives"),
};

export const MIN_RATE = 0.5;
export const MAX_RATE = 1.5;

/** A cut fitted to a scene: its playback rate, clamped; past the clamp the cut is shortened. */
export function fit(c: Cut, sceneSeconds: number): Cut & { rate: number } {
  const rate = Math.min(MAX_RATE, Math.max(MIN_RATE, (c.to - c.from) / sceneSeconds));
  return { ...c, to: c.from + rate * sceneSeconds, rate };
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
