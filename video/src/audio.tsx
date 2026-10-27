// The sound: a click track standing in for the Suno music (same BPM, so nothing re-times
// when the track drops in) and the SFX cue sheet of docs/video/sfx.md. Every SFX file is
// peak-normalised to -1 dBFS (scripts/make-audio.sh); a cue's level in dB becomes a gain
// against REF, the short-term loudness a normalised file reads at its hit.
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

const REF = -10;
/** One trim for every SFX, set from the loudness check. */
export const SFX_TRIM_DB = 4;
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

/** The music stand-in, muted through the cue sheet's silences ([from, to) frames). */
export function ClickTrack({ silences, volume }: { silences: [number, number][]; volume: number }) {
  const v = (f: number) => (silences.some(([a, b]) => f >= a && f < b) ? 0 : volume);
  return <Audio src={staticFile("audio/click-120.wav")} volume={v} />;
}

