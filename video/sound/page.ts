// Runs in headless Chromium (scripts/make-sound.mjs bundles it with esbuild). Three kinds of
// sound, all rendered offline so a render is the same every time:
//   cue()      the app's own UI sounds: cuelume's recipes through its own renderer, into an
//              OfflineAudioContext instead of the speakers (same theme, same emphasis).
//   designed() transitions built in Tone.js: layered filtered noise on a moving band-pass,
//              reverb tails, a pitch-falling sine under impacts, light saturation.
//   score()    the temp music: a Tone.js bed on the docs/video/music.md section map.
import * as Tone from "tone";
// cuelume's package exports hide these modules; the files are the same ones `play()` uses.
import { renderRecipe } from "../node_modules/cuelume/dist/audio/render.js";
import { createOutput } from "../node_modules/cuelume/dist/audio/output.js";
import { contextFrom, resolveEmphasis, shapeFor } from "../node_modules/cuelume/dist/sounds/context.js";
import { THEMES } from "../node_modules/cuelume/dist/sounds/themes.js";

const SR = 48000;

type Stereo = [Float32Array, Float32Array];

function toInt16Base64([l, r]: Stereo): string {
  const n = l.length;
  const out = new Int16Array(n * 2);
  for (let i = 0; i < n; i++) {
    out[2 * i] = Math.max(-1, Math.min(1, l[i])) * 32767;
    out[2 * i + 1] = Math.max(-1, Math.min(1, r[i])) * 32767;
  }
  const bytes = new Uint8Array(out.buffer);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const stereoOf = (b: AudioBuffer): Stereo => [b.getChannelData(0), b.getChannelData(b.numberOfChannels > 1 ? 1 : 0)];

// ── cuelume ──────────────────────────────────────────────────────────────────────────────
export type CueSpec = {
  cue: string;
  theme?: string;
  emphasis?: "subtle" | "normal" | "strong";
  duration?: number;
  direction?: "forward" | "back";
  key?: string;
  step?: number;
  seconds?: number;
};

async function cue(spec: CueSpec) {
  const ctx = new OfflineAudioContext(2, Math.round(SR * (spec.seconds ?? 1.6)), SR);
  const theme = (THEMES as Record<string, Record<string, unknown>>)[spec.theme ?? "default"];
  const recipe = theme[spec.cue];
  if (!recipe) throw new Error(`no cue ${spec.cue}`);
  const emphasis = resolveEmphasis(spec.emphasis);
  const interaction = contextFrom({ duration: spec.duration, direction: spec.direction, key: spec.key } as never);
  const shape = shapeFor(spec.cue as never, interaction, emphasis, Infinity);
  const bus = createOutput(ctx as unknown as AudioContext);
  renderRecipe(ctx as unknown as AudioContext, () => bus, new Map(), spec.cue as never, { recipe, volume: 1, emphasis, shape, step: spec.step ?? 0 } as never, "both");
  return toInt16Base64(stereoOf(await ctx.startRendering()));
}

// ── Designed transitions (Tone.js) ───────────────────────────────────────────────────────
type Designed = { kind: string; seconds: number; [k: string]: number | string };

async function designed(d: Designed) {
  const buf = await Tone.Offline(async () => {
    const out = new Tone.Gain(1).toDestination();
    const verb = new Tone.Reverb({ decay: (d.decay as number) ?? 1.6, wet: (d.wet as number) ?? 0.28 }).connect(out);
    await verb.ready;
    const sat = new Tone.Distortion({ distortion: 0.12, wet: 0.35 }).connect(verb);
    const t = d.seconds;

    // A band of noise whose centre glides from f0 to f1, its level peaking at `peak` (0–1 of t).
    const band = (f0: number, f1: number, peak: number, level: number, color: "pink" | "white" | "brown", q = 1.4) => {
      const n = new Tone.Noise(color);
      const f = new Tone.Filter({ type: "bandpass", frequency: f0, Q: q });
      const g = new Tone.Gain(0);
      const pan = new Tone.Panner(0);
      n.chain(f, g, pan, sat);
      f.frequency.setValueAtTime(f0, 0);
      f.frequency.exponentialRampToValueAtTime(f1, t);
      g.gain.setValueAtTime(0.0001, 0);
      g.gain.exponentialRampToValueAtTime(level, Math.max(0.01, t * peak));
      g.gain.exponentialRampToValueAtTime(0.0001, t);
      pan.pan.setValueAtTime(-0.5, 0);
      pan.pan.linearRampToValueAtTime(0.5, t);
      n.start(0).stop(t);
    };
    const fallingSine = (f0: number, f1: number, len: number, level: number, at = 0) => {
      const o = new Tone.Oscillator(f0, "sine");
      const g = new Tone.Gain(0);
      o.chain(g, out);
      o.frequency.setValueAtTime(f0, at);
      o.frequency.exponentialRampToValueAtTime(f1, at + len * 0.6);
      g.gain.setValueAtTime(level, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      o.start(at).stop(at + len);
    };
    const bell = (notes: string[], spacing: number, level: number) => {
      const s = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.01,
        modulationIndex: 8,
        envelope: { attack: 0.002, decay: 1.4, sustain: 0, release: 1.2 },
        modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.5 },
      });
      s.volume.value = Tone.gainToDb(level);
      s.connect(verb);
      notes.forEach((n, i) => s.triggerAttackRelease(n, 0.6, i * spacing));
    };

    switch (d.kind) {
      case "whoosh": // f0 → f1, peaking on the cut at `peak`
        band(d.f0 as number, d.f1 as number, d.peak as number, 0.9, "pink");
        band((d.f0 as number) * 2, (d.f1 as number) * 2, d.peak as number, 0.35, "white", 2.5);
        break;
      case "suck": // rises into its end: a reverse whoosh into a hard cut
        band(d.f0 as number, d.f1 as number, 0.98, 1, "pink", 1.2);
        band((d.f0 as number) * 3, (d.f1 as number) * 3, 0.98, 0.3, "white", 2);
        fallingSine(90, 50, t, 0.25);
        break;
      case "riser": {
        band(200, 7000, 0.99, 0.8, "pink", 1.1);
        const o = new Tone.Oscillator(110, "sawtooth");
        const f = new Tone.Filter(800, "lowpass");
        const g = new Tone.Gain(0);
        const trem = new Tone.Tremolo({ frequency: 4, depth: 0.6 }).start();
        o.chain(f, trem, g, sat);
        o.frequency.exponentialRampToValueAtTime(440, t);
        f.frequency.exponentialRampToValueAtTime(5000, t);
        trem.frequency.linearRampToValueAtTime(18, t);
        g.gain.setValueAtTime(0.0001, 0);
        g.gain.exponentialRampToValueAtTime(0.18, t * 0.98);
        g.gain.linearRampToValueAtTime(0, t);
        o.start(0).stop(t);
        break;
      }
      case "impact": {
        fallingSine(d.f0 as number, d.f1 as number, t * 0.8, 0.9);
        const k = new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 5, envelope: { attack: 0.001, decay: 0.5, sustain: 0 } }).connect(sat);
        k.triggerAttackRelease("C1", 0.4, 0);
        const n = new Tone.NoiseSynth({ noise: { type: "brown" }, envelope: { attack: 0.002, decay: 0.35, sustain: 0 } });
        const f = new Tone.Filter(1800, "lowpass");
        n.chain(f, verb);
        n.volume.value = -6;
        n.triggerAttackRelease(0.3, 0);
        break;
      }
      case "sub": {
        fallingSine(95, 42, t, 0.95);
        const k = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 4, envelope: { attack: 0.001, decay: 0.35, sustain: 0 } }).connect(out);
        k.volume.value = -4;
        k.triggerAttackRelease("A0", 0.3, 0);
        break;
      }
      case "rumble": {
        const n = new Tone.Noise("brown");
        const f = new Tone.Filter(160, "lowpass");
        const g = new Tone.Gain(0);
        n.chain(f, g, verb);
        g.gain.setValueAtTime(0.0001, 0);
        g.gain.exponentialRampToValueAtTime(0.9, t * 0.92);
        g.gain.linearRampToValueAtTime(0, t);
        n.start(0).stop(t);
        fallingSine(48, 44, t, 0.3);
        break;
      }
      case "bells":
        bell(String(d.notes).split(" "), d.spacing as number, 0.5);
        break;
      case "scribble": { // a marker or pen: filtered noise scrubbed by a fast LFO
        const n = new Tone.Noise("white");
        const f = new Tone.Filter({ type: "bandpass", frequency: d.f0 as number, Q: 2.2 });
        const trem = new Tone.Tremolo({ frequency: d.rate as number, depth: 0.85 }).start();
        const g = new Tone.Gain(0);
        n.chain(f, trem, g, verb);
        f.frequency.linearRampToValueAtTime(d.f1 as number, t);
        g.gain.setValueAtTime(0.0001, 0);
        g.gain.exponentialRampToValueAtTime(0.7, 0.04);
        g.gain.setValueAtTime(0.7, t * 0.7);
        g.gain.exponentialRampToValueAtTime(0.0001, t);
        n.start(0).stop(t);
        break;
      }
      case "shimmer":
        bell(["E6", "G6", "B6", "D7", "E7"], 0.05, 0.35);
        band(3000, 9000, 0.5, 0.25, "white", 3);
        break;
      case "glitch": { // a stutter: hard-clipped square and noise chopped by a gate
        const o = new Tone.Oscillator(180, "square");
        const n = new Tone.Noise("white");
        // (BitCrusher is an AudioWorklet that does not run offline; a hard clip stands in)
        const crush = new Tone.Distortion({ distortion: 0.95, oversample: "none" });
        const gate = new Tone.Gain(0);
        o.connect(crush);
        n.connect(crush);
        crush.chain(gate, sat);
        for (let i = 0; i < 6; i++) {
          const at = i * 0.033;
          gate.gain.setValueAtTime(i % 2 ? 0.08 : 0.35, at);
        }
        gate.gain.setValueAtTime(0, t);
        o.frequency.setValueAtTime(180, 0);
        o.frequency.setValueAtTime(90, 0.1);
        o.start(0).stop(t);
        n.start(0).stop(t);
        break;
      }
      case "thud":
        fallingSine(140, 55, t, 0.9);
        band(300, 120, 0.05, 0.3, "brown", 1);
        break;
    }
  }, d.seconds + 1.2, 2, SR);
  return toInt16Base64(stereoOf(buf.get() as AudioBuffer));
}

// ── Temp score (Tone.js) on the music.md section map ────────────────────────────────────
// Sections in bars (120 BPM, 1 bar = 2 s). `drop` may start mid-bar (the approve click).
export type Section = { name: "intro" | "build" | "silence" | "swell" | "groove" | "drop" | "verse" | "breakdown" | "calm" | "playful" | "lift" | "outro"; from: number; to: number };

const PROG = [
  ["A2", "A3", "C4", "E4", "G4"], // Am7
  ["F2", "F3", "A3", "C4", "E4"], // Fmaj7
  ["C3", "C4", "E4", "G4", "B4"], // Cmaj7
  ["G2", "G3", "B3", "D4", "F#4"], // G6-ish lift
];

async function score(sections: Section[], seconds: number) {
  const buf = await Tone.Offline(async ({ transport }) => {
    transport.bpm.value = 120;
    const master = new Tone.Limiter(-1.5).toDestination();
    const glue = new Tone.Compressor({ threshold: -18, ratio: 2.5, attack: 0.02, release: 0.25 }).connect(master);
    const verb = new Tone.Reverb({ decay: 5.5, wet: 0.35 }).connect(glue);
    await verb.ready;
    const delay = new Tone.FeedbackDelay({ delayTime: "8n.", feedback: 0.28, wet: 0.22 }).connect(verb);

    // sidechain: the pad and bass duck on every kick
    const duck = new Tone.Gain(1).connect(glue);
    const padFilter = new Tone.Filter(900, "lowpass").connect(new Tone.Chorus(0.6, 3, 0.4).start().connect(duck));
    padFilter.connect(verb);
    const pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "fatsawtooth", count: 3, spread: 24 },
      envelope: { attack: 1.2, decay: 0.5, sustain: 0.8, release: 2.5 },
    }).connect(padFilter);
    pad.volume.value = -22;

    const pluck = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.003, decay: 0.22, sustain: 0, release: 0.25 },
    }).connect(delay);
    pluck.connect(glue);
    pluck.volume.value = -16;

    const bass = new Tone.MonoSynth({
      oscillator: { type: "sine" },
      filter: { Q: 1, type: "lowpass" },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.7, release: 0.3 },
      filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.5, baseFrequency: 120, octaves: 2 },
    }).connect(duck);
    bass.volume.value = -12;

    const kick = new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 6, envelope: { attack: 0.001, decay: 0.32, sustain: 0 } }).connect(glue);
    kick.volume.value = -9;
    const hatF = new Tone.Filter(7500, "highpass").connect(glue);
    const hat = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.045, sustain: 0 } }).connect(hatF);
    hat.volume.value = -26;
    const clapF = new Tone.Filter({ type: "bandpass", frequency: 1800, Q: 0.8 }).connect(verb);
    const clap = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.002, decay: 0.12, sustain: 0 } }).connect(clapF);
    clap.volume.value = -14;
    const bells = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3.01,
      modulationIndex: 6,
      envelope: { attack: 0.002, decay: 1.2, sustain: 0, release: 1 },
    }).connect(verb);
    bells.volume.value = -24;

    const bar = 2;
    const sec = (b: number) => b * bar;
    const sectionAt = (b: number) => sections.find((s) => b >= s.from && b < s.to);
    const totalBars = Math.ceil(seconds / bar);

    // Walk the grid in 16ths and play what each section asks for.
    for (let i = 0; i < totalBars * 16; i++) {
      const b = i / 16; // bar position
      const s = sectionAt(b);
      if (!s || s.name === "silence") continue;
      const t = sec(b);
      const inBar = i % 16;
      const chord = PROG[Math.floor(b) % 4];
      const progress = (b - s.from) / Math.max(0.001, s.to - s.from);
      const full = s.name === "drop" || s.name === "lift";
      const beatStart = inBar % 4 === 0;

      // pad: one chord per bar
      const padVel = { intro: 0.3, swell: 0.3, verse: 0.4, breakdown: 0.45, calm: 0.35 }[s.name as string] ?? 0.55;
      if (inBar === 0 && s.name !== "outro") pad.triggerAttackRelease(chord.slice(1), bar * 0.95, t, padVel);

      // pluck: arpeggio density by section
      const arp = chord.slice(2).concat([Tone.Frequency(chord[2]).transpose(12).toNote()]);
      const arpEvery = { intro: 8, build: 2, swell: 0, groove: 2, drop: 2, verse: 4, breakdown: 8, calm: 8, playful: 2, lift: 2, outro: 0 }[s.name] ?? 0;
      if (arpEvery && inBar % arpEvery === 0) {
        const note = arp[(i / arpEvery) % arp.length | 0];
        const vel = s.name === "playful" ? (inBar % 4 === 0 ? 0.7 : 0.45) : 0.55;
        pluck.triggerAttackRelease(s.name === "intro" || s.name === "calm" ? Tone.Frequency(note).transpose(12).toNote() : note, "16n", t, vel);
      }

      // bass
      if ((full || s.name === "groove") && inBar % 2 === 0) bass.triggerAttackRelease(chord[0], "8n", t, inBar % 4 === 0 ? 0.9 : 0.6);
      if ((s.name === "swell" || s.name === "breakdown" || s.name === "verse") && inBar === 0) bass.triggerAttackRelease(chord[0], bar * 0.9, t, 0.35);

      // drums
      const kickOn =
        (full && beatStart) ||
        ((s.name === "groove" || s.name === "verse") && beatStart) ||
        (s.name === "build" && beatStart && b >= s.from + 2) ||
        (s.name === "breakdown" && (inBar === 0 || inBar === 8)) ||
        (s.name === "playful" && (inBar === 0 || inBar === 6 || inBar === 8));
      if (kickOn) {
        kick.triggerAttackRelease("C1", "8n", t, full ? 1 : 0.75);
        duck.gain.setValueAtTime(0.45, t);
        duck.gain.linearRampToValueAtTime(1, t + 0.18);
      }
      const hatOn =
        (full && inBar % 2 === 1) ||
        ((s.name === "groove" || s.name === "playful") && inBar % 4 === 2) ||
        (s.name === "verse" && inBar % 4 === 2) ||
        (s.name === "build" && inBar % Math.max(1, 4 - Math.floor(progress * 4)) === 0);
      // the last bar of a build or lift: a roll of claps and 16th hats rising into the next section
      const lastBar = (s.name === "build" || s.name === "lift") && b >= s.to - 1;
      const roll = lastBar ? b - (s.to - 1) : 0;
      if (hatOn || lastBar) hat.triggerAttackRelease("32n", t, lastBar ? 0.5 + 0.4 * roll : s.name === "build" ? 0.3 + 0.6 * progress : 0.7);
      const clapOn = (full && (inBar === 4 || inBar === 12)) || (s.name === "playful" && inBar === 12);
      const rollOn = lastBar && inBar % (roll < 0.5 ? 2 : 1) === 0;
      if (clapOn || rollOn) clap.triggerAttackRelease(rollOn ? "32n" : "16n", t, rollOn ? 0.3 + 0.6 * roll : 0.8);

      // bells on the swell and the calm
      if ((s.name === "swell" || s.name === "calm") && inBar === 0) bells.triggerAttackRelease([Tone.Frequency(chord[3]).transpose(12).toNote()], "2n", t, 0.6);
    }

    // filter automation per section, and the outro chord
    for (const s of sections) {
      const t0 = sec(s.from);
      const t1 = sec(s.to);
      const cut = { intro: 900, build: 900, silence: 900, swell: 1800, groove: 2400, drop: 5200, verse: 2600, breakdown: 600, calm: 1600, playful: 3000, lift: 3600, outro: 2200 }[s.name];
      padFilter.frequency.setValueAtTime(cut, t0);
      if (s.name === "build" || s.name === "lift") padFilter.frequency.exponentialRampToValueAtTime(6000, t1 - 0.05);
      if (s.name === "outro") pad.triggerAttackRelease(["C3", "G3", "C4", "E4", "G4", "D5"], t1 - t0 - 1, t0, 0.8);
    }
  }, seconds, 2, SR);

  // Apply the hard stops after the fact: zero the silences (tails included).
  const l = buf.getChannelData(0);
  const r = buf.getChannelData(1);
  for (const s of sections.filter((x) => x.name === "silence")) {
    const a = Math.round(s.from * 2 * SR);
    const b = Math.round(s.to * 2 * SR);
    for (let i = a; i < b && i < l.length; i++) {
      const fade = Math.min(1, (i - a) / (SR * 0.01));
      l[i] *= 1 - fade;
      r[i] *= 1 - fade;
    }
  }
  // fade out over the last 2 s
  const fadeFrom = l.length - 2 * SR;
  for (let i = Math.max(0, fadeFrom); i < l.length; i++) {
    const g = 1 - (i - fadeFrom) / (2 * SR);
    l[i] *= g;
    r[i] *= g;
  }
  return toInt16Base64([l, r]);
}

declare global {
  interface Window {
    sound: { cue: typeof cue; designed: typeof designed; score: typeof score; SR: number };
  }
}
window.sound = { cue, designed, score, SR };
