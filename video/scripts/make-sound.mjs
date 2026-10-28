// Renders every sound the cuts use, offline in headless Chromium (sound/page.ts):
//   public/audio/sfx/<name>.wav   the cue sheet: cuelume UI cues (the app's own sounds) and
//                                 Tone.js-designed transitions, each peak-normalised to -1 dBFS
//   public/audio/music-temp-*.mp3 the Tone.js temp score on the music.md section map
//   node scripts/make-sound.mjs            (everything)
//   node scripts/make-sound.mjs sfx|score  (one half)
//   node scripts/make-sound.mjs new        (only the sounds whose file is missing)
// BROWSER_EXECUTABLE: a Chrome to use instead of Remotion's chrome-headless-shell.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright-core";

const root = path.resolve(import.meta.dirname, "..");
const SFX = path.join(root, "public/audio/sfx");
const only = process.argv[2];

// ── The cue sheet (docs/video/sfx.md rev E) ──────────────────────────────────────────
// UI moments are the app's cuelume cues with the app's emphasis (theme default; the app's
// setVolume(0.6) is a level, set in the mix). Transitions are designed in Tone.js.
const cue = (c, extra = {}) => ({ type: "cue", spec: { cue: c, ...extra } });
const des = (kind, seconds, extra = {}) => ({ type: "designed", spec: { kind, seconds, ...extra } });
const SOUNDS = {
  attention: cue("attention", { seconds: 2.5 }),
  tap: cue("tap"),
  type: cue("type"),
  select: cue("select", { direction: "forward" }),
  "open-subtle": cue("open", { emphasis: "subtle" }),
  "close-subtle": cue("close", { emphasis: "subtle" }),
  navigate: cue("navigate"),
  "loading-subtle": cue("loading", { emphasis: "subtle", seconds: 2 }),
  ready: cue("ready", { seconds: 2 }),
  "ready-subtle": cue("ready", { emphasis: "subtle", seconds: 2 }),
  success: cue("success", { seconds: 2 }),
  "success-strong": cue("success", { emphasis: "strong", seconds: 2.4 }),
  "count-2s": cue("count", { duration: 2000, seconds: 2.6 }),
  "count-700": cue("count", { duration: 700, seconds: 1.4 }),
  // designed transitions: each whoosh in its own band so no two in a row share a pitch
  "whoosh-a": des("whoosh", 0.42, { f0: 600, f1: 2600, peak: 0.66 }),
  "whoosh-b": des("whoosh", 0.42, { f0: 1200, f1: 5200, peak: 0.66 }),
  "whoosh-c": des("whoosh", 0.42, { f0: 250, f1: 1100, peak: 0.66 }),
  "whoosh-d": des("whoosh", 0.42, { f0: 900, f1: 3400, peak: 0.66 }),
  "whoosh-e": des("whoosh", 0.42, { f0: 1800, f1: 7000, peak: 0.66 }),
  "whoosh-f": des("whoosh", 0.42, { f0: 3000, f1: 800, peak: 0.66 }),
  "whoosh-g": des("whoosh", 0.3, { f0: 700, f1: 2400, peak: 0.75 }),
  "riser-1bar": des("riser", 2),
  "riser-2bar": des("riser", 4),
  "impact-soft": des("impact", 1.2, { f0: 120, f1: 48, decay: 2.2 }),
  "impact-deep": des("impact", 2.4, { f0: 100, f1: 38, decay: 4, wet: 0.4 }),
  "sub-hit": des("sub", 0.7),
  // rev D: one designed sound per motion scene (sfx.md rows 50–60)
  "lockup-chime": des("bells", 1.4, { notes: "E5 B5 E6 G#6", spacing: 0.06 }),
  "punch-whip": des("whoosh", 0.3, { f0: 3200, f1: 700, peak: 0.25 }),
  "punch-thud": des("thud", 0.6),
  marker: des("scribble", 0.55, { f0: 2200, f1: 3800, rate: 24 }),
  "morph-suck": des("suck", 1.1, { f0: 300, f1: 2400 }),
  "morph-slam": des("impact", 0.9, { f0: 150, f1: 55, decay: 1.2 }),
  "focus-shimmer": des("shimmer", 1.6),
  "orbit-swell": des("whoosh", 1.2, { f0: 180, f1: 900, peak: 0.7 }),
  "orbit-suck": des("suck", 0.45, { f0: 800, f1: 5200 }),
  "wall-tunnel": des("whoosh", 1.4, { f0: 2400, f1: 300, peak: 0.35 }),
  "bloom-sparkle": des("bells", 2.2, { notes: "C6 E6 G6 B6 D7 E7", spacing: 0.09 }),
  // rev E: the new motion scenes (sfx.md "Rev E changes")
  "orb-burst": des("bells", 0.9, { notes: "B5 F#6", spacing: 0.035 }),
  "block-flash": des("bells", 0.3, { notes: "E7", spacing: 0 }),
  "lid-open": des("whoosh", 0.7, { f0: 220, f1: 1100, peak: 0.7 }),
  "word-drop": des("thud", 0.32),
  "slot-roll": des("whoosh", 0.26, { f0: 1400, f1: 3600, peak: 0.6 }),
  "cut-dry": des("impact", 0.4, { f0: 190, f1: 90, decay: 0.25 }),
};

// ── The temp score's section maps: sound/music-map.json (mirrors docs/video/music.md) ──
const MAP = JSON.parse(readFileSync(path.join(root, "sound/music-map.json"), "utf8"));
const sections = (m) => m.map(([name, from, to]) => ({ name, from, to }));

function wav(file, base64, sr, normalise) {
  const pcm = Buffer.from(base64, "base64");
  const samples = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.length / 2);
  if (normalise) {
    let peak = 1;
    for (const v of samples) peak = Math.max(peak, Math.abs(v));
    const g = (32767 * 10 ** (-1 / 20)) / peak;
    for (let i = 0; i < samples.length; i++) samples[i] = Math.round(samples[i] * g);
  }
  // trim trailing silence below -70 dBFS
  let end = samples.length;
  while (end > 2 && Math.abs(samples[end - 1]) < 10 && Math.abs(samples[end - 2]) < 10) end -= 2;
  const body = Buffer.from(samples.buffer, samples.byteOffset, end * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + body.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(2, 22);
  h.writeUInt32LE(sr, 24);
  h.writeUInt32LE(sr * 4, 28);
  h.writeUInt16LE(4, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(body.length, 40);
  writeFileSync(file, Buffer.concat([h, body]));
}

const bundle = await build({
  entryPoints: [path.join(root, "sound/page.ts")],
  bundle: true,
  format: "iife",
  platform: "browser",
  write: false,
  logLevel: "warning",
});
const headless = path.join(root, "node_modules/.remotion/chrome-headless-shell");
const shell = existsSync(headless)
  ? path.join(headless, readdirSync(headless)[0], `chrome-headless-shell-${readdirSync(headless)[0]}`, "chrome-headless-shell")
  : undefined;
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE ?? shell, headless: true });
const page = await browser.newPage();
await page.setContent("<!doctype html><title>sound</title>");
await page.addScriptTag({ content: bundle.outputFiles[0].text });
const SR = await page.evaluate(() => window.sound.SR);

if (only !== "score") {
  // `new`: render only the sounds whose file is missing (keeps the approved ones byte-for-byte)
  if (only !== "new") rmSync(SFX, { recursive: true, force: true });
  mkdirSync(SFX, { recursive: true });
  for (const [name, { type, spec }] of Object.entries(SOUNDS)) {
    if (only === "new" && existsSync(path.join(SFX, `${name}.wav`))) continue;
    const b64 = await page.evaluate(([t, s]) => window.sound[t](s), [type, spec]);
    wav(path.join(SFX, `${name}.wav`), b64, SR, true);
  }
  console.log(`sfx: ${Object.keys(SOUNDS).length} files`);
}
if (only !== "sfx" && only !== "new") {
  for (const [cut, { sections: map, seconds }] of Object.entries(MAP).filter(([k]) => k !== "note")) {
    const b64 = await page.evaluate(([s, sec]) => window.sound.score(s, sec), [sections(map), seconds]);
    const tmp = path.join(root, `out/music-temp-${cut}.wav`);
    mkdirSync(path.dirname(tmp), { recursive: true });
    wav(tmp, b64, SR, false);
    const mp3 = path.join(root, `public/audio/music-temp-${cut}.mp3`);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", tmp, "-c:a", "libmp3lame", "-b:a", "256k", mp3]);
    console.log(`score: ${path.relative(root, mp3)} (${seconds} s)`);
  }
}
await browser.close();
