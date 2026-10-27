import { loadFont } from "@remotion/google-fonts/Manrope";
import type { SnapCnTheme } from "@/lib/snap-cn-ui";

// Manrope through @remotion/google-fonts so the studio and the mp4 get the same face.
const manrope = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});
export const MANROPE = manrope.fontFamily;
/** Resolves once every Manrope weight is in document.fonts (see FontGate). */
export const manropeReady = manrope.waitUntilDone;
export const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

// docs/video/board.md: Sorbet neutrals, the mint accent, cloud blue and orange; lilac only
// on the Prompt Roll pill. Nothing else.
export const C = {
  paper: "#fafafa", // neutral-50
  ink: "#09090b", // neutral-950
  card: "#18181b", // neutral-900
  line: "#27272a", // neutral-800
  dim: "#52525b", // neutral-600
  muted: "#a1a1aa", // neutral-400
  soft: "#e4e4e7", // neutral-200
  mint: "oklch(81% 0.16 163)", // --rb-accent (dark)
  mintInk: "oklch(26% 0.06 168)", // --rb-accent-fg
  blue: "#18b2ff",
  orange: "#fa7342",
  lilac: "#b8a4ff",
} as const;

export const SORBET: Partial<SnapCnTheme> = {
  background: C.ink,
  foreground: C.paper,
  card: C.card,
  cardForeground: C.paper,
  popover: C.card,
  popoverForeground: C.paper,
  primary: C.mint,
  primaryForeground: C.mintInk,
  secondary: C.line,
  secondaryForeground: C.paper,
  muted: C.line,
  mutedForeground: C.muted,
  accent: C.line,
  accentForeground: C.paper,
  border: C.line,
  input: C.line,
  ring: C.mint,
  radius: 10,
  fontFamily: MANROPE,
};
