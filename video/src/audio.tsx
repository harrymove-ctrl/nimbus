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
 * The music bed: the Suno track once it exists (music-full.mp3 / music-x.mp3), until then the
 * Tone.js temp score. About 2 dB lower under footage than on title cards (sound.md: −18 under
 * footage, −14 on cards, after mastering). The click track is never rendered.
 */
export function MusicBed({ src, footage }: { src: string; footage: [number, number][] }) {
  const v = (f: number) => (footage.some(([a, b]) => f >= a && f < b) ? 0.8 : 1);
  return <Audio src={staticFile(src)} volume={v} />;
}
