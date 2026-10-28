import { loadFont } from "@remotion/google-fonts/Manrope";
import type { SnapCnTheme } from "@/lib/snap-cn-ui";
import { C } from "./palette";

// Manrope through @remotion/google-fonts so the studio and the mp4 get the same face.
const manrope = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});
export const MANROPE = manrope.fontFamily;
/** Resolves once every Manrope weight is in document.fonts (see FontGate). */
export const manropeReady = manrope.waitUntilDone;
export const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

export { BOOT_SKY, BOOT_SKY_FILL, C, CLOUD, DITHER, GROUND, N, RADIUS, ROLE, TIER } from "./palette";

export const SORBET: Partial<SnapCnTheme> = {
  background: C.bg,
  foreground: C.ink,
  card: C.card,
  cardForeground: C.ink,
  popover: C.card,
  popoverForeground: C.ink,
  primary: C.mint,
  primaryForeground: C.mintInk,
  secondary: C.raised,
  secondaryForeground: C.ink,
  muted: C.raised,
  mutedForeground: C.muted,
  accent: C.raised,
  accentForeground: C.ink,
  border: C.raised,
  input: C.raised,
  ring: C.mint,
  radius: 10,
  fontFamily: MANROPE,
};
