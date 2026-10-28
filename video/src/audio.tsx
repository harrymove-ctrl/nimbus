// The sound: the music bed and the SFX cue sheet of docs/video/sfx.md. Every SFX file is a
// cuelume cue or a designed Tone.js sound, peak-normalised to -1 dBFS (scripts/make-sound.mjs);
// a cue's level in dB becomes a gain against REF. The master is levelled to −14 LUFS after
// the render (scripts/master.sh).
import { Audio, Sequence, staticFile } from "remotion";

export type Cue = {
  /** Absolute frame in the composition. */
  at: number;
  /** File under public/audio/sfx/, without .wav. */
  file: string;
  /** Target level from the cue sheet (LUFS short-term at the hit). */
  db: number;
  /** Pitch, as a ratio (roll ticks go up a semitone each). Render-only in Remotion. */
  tone?: number;
  /** Frames to skip at the head of the file, so a reverse whoosh ends on its cut. */
  trim?: number;
  /** Frames to let it play, when it must stop early (a riser before a silence). */
  frames?: number;
};

const REF = -16;
/** One trim for every SFX, set from the loudness check. */
export const SFX_TRIM_DB = 0;
export const gain = (db: number) => Math.min(1, 10 ** ((db + SFX_TRIM_DB - REF) / 20));

export function SfxTrack({ cues }: { cues: Cue[] }) {
  return (
    <>
      {cues.map((c, i) => (
        <Sequence key={i} from={c.at} durationInFrames={c.frames} name={`sfx ${c.file}`} layout="none">
          <Audio
            src={staticFile(`audio/sfx/${c.file}.wav`)}
            volume={gain(c.db)}
            toneFrequency={c.tone}
            trimBefore={c.trim}
          />
        </Sequence>
      ))}
    </>
  );
}

/**
 * The music bed: the fitted Suno track (music-full-fit.mp3 / music-x.mp3). Gate 3 on rev 6
 * ("music too loud"): under footage it sits 6 dB lower than before (0.8 → 0.4), on cards at
 * full level; it ducks 3 dB under every SFX cue (3-frame attack, 18-frame hold, 8-frame release),
 * chapter-card transitions included, and comes back up 3 dB over `lifts` (the drop on the
 * first Approve, the finale). The master is levelled to −14 LUFS after the render, so the SFX
 * come up and the bed does not. The click track is never rendered.
 */
const BED = { footage: 0.4, card: 1, duck: 10 ** (-3 / 20), lift: 10 ** (3 / 20) };
export function bedVolume(f: number, footage: [number, number][], cues: Cue[], lifts: [number, number][]) {
  let v = footage.some(([a, b]) => f >= a && f < b) ? BED.footage : BED.card;
  if (lifts.some(([a, b]) => f >= a && f < b)) v *= BED.lift;
  let duck = 0;
  for (const c of cues) {
    const d = f - c.at;
    if (d < -3 || d > 26) continue;
    duck = Math.max(duck, d < 0 ? (d + 3) / 3 : d <= 18 ? 1 : 1 - (d - 18) / 8);
  }
  return Math.min(1, v * (1 - (1 - BED.duck) * duck));
}
export function MusicBed({ src, footage, cues = [], lifts = [] }: { src: string; footage: [number, number][]; cues?: Cue[]; lifts?: [number, number][] }) {
  return <Audio src={staticFile(src)} volume={(f) => bedVolume(f, footage, cues, lifts)} />;
}
