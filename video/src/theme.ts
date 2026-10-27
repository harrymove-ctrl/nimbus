import { loadFont } from "@remotion/google-fonts/Manrope";
import type { SnapCnTheme } from "@/lib/snap-cn-ui";

// Manrope through @remotion/google-fonts so the studio and the mp4 get the same face.
const manrope = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});
export const MANROPE = manrope.fontFamily;
/** Resolves once every Manrope weight is in document.fonts (see FontGate in NimbusDemo). */
export const manropeReady = manrope.waitUntilDone;

// Sorbet (docs/assets/reactbits-sorbet.css): the Zinc ramp and the mint accent, dark end.
// Cloud blue and orange are the app's dither colours (src/app/globals.css, dark) and the
// only other colours the video uses.
export const C = {
  bg: "#09090b", // neutral-950
  card: "#18181b", // neutral-900
  line: "#27272a", // neutral-800
  dim: "#52525b", // neutral-600
  muted: "#a1a1aa", // neutral-400
  ink: "#fafafa", // neutral-50
  mint: "oklch(81% 0.16 163)",
  mintInk: "oklch(26% 0.06 168)",
  blue: "oklch(72% 0.14 240)",
  orange: "oklch(79% 0.15 62)",
} as const;

export const SORBET: Partial<SnapCnTheme> = {
  background: C.bg,
  foreground: C.ink,
  card: C.card,
  cardForeground: C.ink,
  popover: C.card,
  popoverForeground: C.ink,
  primary: C.mint,
  primaryForeground: C.mintInk,
  secondary: C.line,
  secondaryForeground: C.ink,
  muted: C.line,
  mutedForeground: C.muted,
  accent: C.line,
  accentForeground: C.ink,
  border: C.line,
  input: C.line,
  ring: C.mint,
  radius: 10,
  fontFamily: MANROPE,
};
