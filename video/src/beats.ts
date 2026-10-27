// Every footage cut in the video, in one place, so a new take only changes this file.
//
// A take is a video file and, optionally, the beats.json written with it by
// scripts/record-demo.ts ([{ beat, tStart, tEnd }] in seconds from the video start). With a
// beats file, a shot is cut from its `beat`'s tStart (+ `lead`) to the tEnd of `until` (or of
// `beat`); without one, the hand-timed `from`/`to` below are used. A beats file only ever
// applies to its own take.

export type Take = { footage: string; beatsJson: string | null };

// The take of 2026-10-27 21:32 (1920 × 1080, 351 s) and its beats. It runs slower than real
// time in places (machine load), so shots start inside their beats (`lead`) and play up to
// MAX_RATE. The hand timings below are the same cuts, so cues match with or without it.
export const TAKE: Take = {
  footage: "demo/raw/nimbus-demo-20261027-1432.webm",
  beatsJson: "demo/raw/beats.json",
};

/** Width ÷ height of the take, used only if the browser cannot read it from the file. */
export const FOOTAGE_ASPECT = 1920 / 1080;

export type Beat = { beat: string; tStart: number; tEnd: number };

export type Shot = {
  /** The beat this shot starts in (keys from scripts/record-demo.ts). */
  beat: string;
  /** The beat it ends with, when the shot spans several. Defaults to `beat`. */
  until?: string;
  /** The same cut in source seconds, used when the take has no beats file. */
  from: number;
  to: number;
  /** Seconds into the beat to start, when cutting from beats.json. */
  lead?: number;
};

// Board takes `crew`, `plan`, `gate`, `chat-run`, `memory`, `run-two`.
export const SHOTS = {
  // Scene 6: lanes fill with Nemotron badges; the Analyst's verify fails (✕) in the Loop
  // view and the retry passes.
  crew: { beat: "ship1-checklist", lead: 6.08, until: "ship1-loop-view", from: 56, to: 92.81 },
  // Scene 8: the plan as a draft (a step moved, one added), Approve plan. The goal typing in
  // ship1-goal is followed by a long planning wait, so the shot starts at the draft.
  plan: { beat: "ship1-plan-draft", from: 41.17, to: 49.92 },
  // Scene 9: the cloud turns orange, the PR card, Approve & always allow.
  gate: { beat: "ship1-pr-approval", lead: 48.09, from: 170, to: 184.56 },
  // Scene 13: the run in the web timeline. No chat-triggered run is filmed; two bars of the
  // status pill (Morning brief waiting, approved from the panel) stand in.
  chatRun: { beat: "status-pill", lead: 5, from: 247.79, to: 263.74 },
  // Scene 16: Memory & skill: the rule, the skill, the memories.
  memory: { beat: "memory-skill", lead: 7, from: 223.16, to: 233.35 },
  // Scene 17: run two: approved by policy, the cheaper summary, the learned chip.
  runTwo: { beat: "ship2-summary", lead: -4.66, from: 334, to: 344.16 },
  // The X clip's shorter run two: the summary and the learned chip.
  runTwoX: { beat: "ship2-summary", lead: -0.16, from: 338.5, to: 344.16 },
} satisfies Record<string, Shot>;

export type ShotName = keyof typeof SHOTS;

/** Moments inside the take that sounds, rings and snap zooms hit, in source seconds. */
export const MOMENTS = {
  /** Approve plan pressed. */
  planApprove: 49.6,
  /** The red ✕ on the Analyst's failed verify, in the Loop view. */
  crewFail: 71.5,
  /** The retry passing. */
  crewPass: 81,
  /** Approve & always allow pressed. */
  gateApprove: 184,
  /** Run two's learned chip in view. */
  runTwoLearned: 342,
};

export type Cut = { from: number; to: number };

/** The source window for a shot: beats.json when it names the beats, else the hand timing. */
export function cutFor(name: ShotName, beats: Beat[] | null): Cut {
  const shot: Shot = SHOTS[name];
  const first = beats?.find((x) => x.beat === shot.beat);
  const last = beats?.find((x) => x.beat === (shot.until ?? shot.beat));
  if (first && last && last.tEnd > first.tStart) {
    return { from: first.tStart + (shot.lead ?? 0), to: last.tEnd };
  }
  return { from: shot.from, to: shot.to };
}

/**
 * Playback rate that fits a cut to a scene, clamped so footage never reads as fast-forward
 * or slow motion; past the clamp the cut is shortened instead.
 */
export const MIN_RATE = 0.5;
export const MAX_RATE = 1.5;

export function fitCut(cut: Cut, sceneSeconds: number): Cut & { rate: number } {
  const raw = (cut.to - cut.from) / sceneSeconds;
  const rate = Math.min(MAX_RATE, Math.max(MIN_RATE, raw));
  return { ...cut, to: cut.from + rate * sceneSeconds, rate };
}

/** Scene frame of a source moment in a shot of `frames` (hand timings, as the cues use). */
export function momentFrame(name: ShotName, frames: number, t: number, fps = 30) {
  const cut = fitCut(cutFor(name, null), frames / fps);
  return Math.round(((t - cut.from) / cut.rate) * fps);
}
