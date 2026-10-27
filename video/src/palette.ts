// The app's colours, with no font loading, so Node scripts can import them too.
// Every color is the app's own (docs/video/board.md "Look · rev B"). Sources are in the
// repo root; the app is dark (`<html class="dark">`, src/app/layout.tsx:29).
export const C = {
  // src/app/globals.css:40  --color-neutral-950 (the app shell background)
  bg: "oklch(14.1% 0.005 285.823)",
  // src/app/globals.css:39  --color-neutral-900 (cards)
  card: "oklch(21% 0.006 285.885)",
  // src/app/globals.css:38  --color-neutral-800
  raised: "oklch(27.4% 0.006 286.033)",
  // src/app/globals.css:166 .dark --border: white at 10 %
  line: "oklch(1 0 0 / 10%)",
  // src/app/globals.css:36  --color-neutral-600
  dim: "oklch(44.2% 0.017 285.786)",
  // src/app/globals.css:33  --color-neutral-400
  muted: "oklch(70.5% 0.015 286.067)",
  // src/app/globals.css:30  --color-neutral-100
  ink: "oklch(96.7% 0.001 286.375)",
  // src/app/globals.css:53  .dark --rb-accent (mint)
  mint: "oklch(81% 0.16 163)",
  // src/app/globals.css:54  .dark --rb-accent-fg
  mintInk: "oklch(26% 0.06 168)",
  // src/app/globals.css:216 .dark --dither-color-red (failures)
  red: "oklch(0.68 0.2 25)",
} as const;

// src/lib/run-view.ts:125 ROLE_COLOR (lane and badge colors in the run view).
export const ROLE = {
  checker: "oklch(0.72 0.14 250)",
  researcher: "oklch(0.72 0.15 305)",
  analyst: "oklch(0.78 0.15 60)",
  writer: "oklch(0.78 0.11 190)",
  learner: C.mint,
} as const;

// src/components/nimbus/overview.tsx:20 TIER_COLOR { ultra: blue, super: purple, nano: green }
// → src/app/globals.css:211–213, the .dark --dither-color-* values the charts paint with.
export const TIER = {
  ultra: "oklch(0.72 0.14 240)",
  super: "oklch(0.7 0.18 304)",
  nano: "oklch(0.78 0.17 152)",
} as const;

// src/components/glow-cloud.tsx:302 and :326, the cloud's own blue and orange. Only where
// the cloud itself is drawn (the chat avatar).
export const CLOUD = { blue: "#18b2ff", orange: "#fa7342" } as const;

// src/components/nimbus/timeline.tsx:487, the "N" model badge on every lane. Footage only;
// listed so scripts/qa-frames.py counts it as the app's own.
export const NVIDIA_BADGE = "#76b900";

/** The app's dither texture as a 3 % glow: a 3 px cell grid (globals.css --dither-cell) over a mint wash. */
export const DITHER_GLOW = [
  `radial-gradient(ellipse 60% 50% at 50% 60%, color-mix(in oklch, ${C.mint} 7%, transparent), transparent 70%)`,
  `repeating-linear-gradient(0deg, oklch(1 0 0 / 3%) 0 1px, transparent 1px 3px)`,
  `repeating-linear-gradient(90deg, oklch(1 0 0 / 3%) 0 1px, transparent 1px 3px)`,
].join(", ");
