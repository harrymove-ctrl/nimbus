// Every footage cut in the video, in one place, so a new take only changes this file.
//
// The footage is served from docs/demo/ (remotion.config.ts makes it the public dir).
// When docs/demo/raw/beats.json exists (scripts/record-demo.ts writes it with the take), a
// shot is cut from its `beat`'s tStart (+ `lead`) to the tEnd of `until` (or of `beat`)
// instead of the hand-timed `from`/`to` below, and its playback rate is refitted to the
// scene. Hand timings were read off docs/demo/nimbus-demo.webm, the 1920 × 1080 v3 take of
// 2026-10-27 19:29 (170 s), which was recorded before the script wrote beats.json.

export const FOOTAGE = "nimbus-demo.webm";
export const BEATS_JSON = "raw/beats.json";

/**
 * Width ÷ height of the take, used only if the browser cannot read it from the file
 * (Root.tsx measures it). The v2 take is 1440 × 900; the v3 take is 1920 × 1080.
 */
export const FOOTAGE_ASPECT = 1920 / 1080;

export type Beat = { beat: string; tStart: number; tEnd: number };

export type Shot = {
  /** The beat in beats.json this shot starts in (names from scripts/record-demo.ts). */
  beat: string;
  /** The beat it ends with, when the shot spans several. Defaults to `beat`. */
  until?: string;
  /** Hand-timed cut in source seconds, used while there is no beats.json entry. */
  from: number;
  to: number;
  /** Seconds into the beat to start, when cutting from beats.json. */
  lead?: number;
};

export const SHOTS = {
  // Scene 3: the boot cloud, then the Overview (cards count up, spend chart, gauges).
  boot: { beat: "boot", from: 0, to: 2 },
  overview: { beat: "overview", from: 2.5, to: 16.5 },
  // Scene 5: the goal typed, the plan as a draft (a step dragged, one added), Approve plan;
  // then the lanes and the Analyst's failed run_code in the Loop view.
  plan: { beat: "ship1-goal", until: "ship1-plan-draft", from: 17, to: 32 },
  lanes: {
    beat: "ship1-checklist",
    until: "ship1-loop-view",
    from: 32,
    to: 46,
  },
  // Scene 7: the question chip, the patch, the PR gate, Approve & always allow.
  gate: {
    beat: "ship1-question",
    until: "ship1-pr-approval",
    lead: 2,
    from: 63,
    to: 86,
  },
  // Scene 8: run summary tiles, then Memory & skill.
  memory: { beat: "ship1-summary", until: "memory-skill", from: 89, to: 102 },
  // Scene 9: the status pill over the radar; Morning brief's reply approved inline.
  pill: { beat: "status-pill", from: 113, to: 126 },
  // Scene 10: run two, approved by policy, the cheaper summary, the learned chip.
  run2: { beat: "ship2-learned", until: "ship2-summary", from: 155, to: 164 },
} satisfies Record<string, Shot>;

export type ShotName = keyof typeof SHOTS;

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
 * Playback rate that fits a cut to a scene. Clamped so footage never runs at a speed that
 * reads as fast-forward; past the clamp the cut is shortened instead (see `fitCut`).
 */
export const MIN_RATE = 0.25;
export const MAX_RATE = 1.5;

export function fitCut(cut: Cut, sceneSeconds: number): Cut & { rate: number } {
  const raw = (cut.to - cut.from) / sceneSeconds;
  const rate = Math.min(MAX_RATE, Math.max(MIN_RATE, raw));
  return { ...cut, to: cut.from + rate * sceneSeconds, rate };
}
