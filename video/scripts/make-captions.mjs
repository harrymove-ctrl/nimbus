// Writes captions/<scene>.json from the voice lines in docs/VIDEO.md, word by word, in
// milliseconds from the start of each scene (the shape word-captions takes).
// Until the voice is recorded the words are paced at a speaking rate; once
// video/voice/<n>.wav exists, replace a file with that take's Whisper word timings.
//   node scripts/make-captions.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const WPS = 2.6; // words per second, an unhurried read
const PAUSE = { ".": 380, ";": 300, ",": 160 }; // ms after a word ending in this mark

// scene: [first word at (s), voice line]
const LINES = {
  2: [3.6, "This is Nimbus."],
  3: [2.6, "Every morning it shows what the crew did, what it cost, and what needs you."],
  5: [
    1.2,
    "The crew runs the evals on its own repository. Nemotron 3 Ultra plans; Super and Nano do the work. The Analyst fails once, retries, and finds the line. Two hops were routed below their ceiling by the cost router.",
  ],
  7: [
    0.8,
    "It asks where to fix it. Opening a pull request is an action, so it waits. Approve and always allow writes one rule into the workstream's skill file.",
  ],
  8: [
    0.8,
    "After the run a Learner writes memories and rewrites the skill. You can read what it learned, revoke a rule, forget a memory.",
  ],
  9: [
    0.8,
    "It is always on. Scheduled runs show up as a pill; you approve the one thing that sends without leaving the screen.",
  ],
  10: [0.8, "Run two knows what run one learned, opens the PR under the rule, and costs less."],
  11: [
    0.8,
    "It speaks OpenAI's API, so OpenClaw or Hermes bring it into your chat apps. Hosted on a Nebius Serverless Endpoint; nightly runs as Serverless Jobs.",
  ],
  12: [1.6, "Three Nemotron tiers, routed by role and cost, graded hop by hop."],
  13: [4.6, "Open source. Nimbus."],
};

mkdirSync(new URL("../captions/", import.meta.url), { recursive: true });
for (const [scene, [start, line]] of Object.entries(LINES)) {
  let t = start * 1000;
  const words = line.split(/\s+/).map((text) => {
    const dur = Math.max(220, (1000 / WPS) * Math.min(1.6, 0.55 + text.length / 9));
    const w = { text, startMs: Math.round(t), endMs: Math.round(t + dur) };
    t += dur + (PAUSE[text.at(-1)] ?? 0);
    return w;
  });
  writeFileSync(new URL(`../captions/${scene}.json`, import.meta.url), JSON.stringify(words, null, 1) + "\n");
  console.log(`captions/${scene}.json  ${words.length} words  ends ${(t / 1000).toFixed(1)}s`);
}
