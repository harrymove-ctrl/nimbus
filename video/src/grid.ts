// The beat grid every cut lands on: 120 BPM at 30 fps, so a beat is 15 frames and a bar
// (4/4) is 60. Scenes are whole bars; sounds and in-scene beats are whole beats.
export const BPM = 120;
export const FPS = 30;
export const framesPerBeat = (60 / BPM) * FPS; // 15
export const framesPerBar = framesPerBeat * 4; // 60

export const bars = (n: number) => Math.round(n * framesPerBar);
export const beats = (n: number) => Math.round(n * framesPerBeat);

export type Scene<Id extends string = string> = { id: Id; bars: number };

/** Lays scenes end to end; returns each one's first frame and length, both from bars(). */
export function layout<Id extends string>(scenes: readonly Scene<Id>[]) {
  let at = 0;
  return scenes.map((s) => {
    const from = bars(at);
    at += s.bars;
    return { ...s, from, frames: bars(s.bars) };
  });
}
