// Callout data, with no React or font loading, so Node scripts (layout-callouts) can use it.
export type Side = "left" | "right" | "above" | "below";
export type CalloutSpec = {
  target: string;
  /** Beat whose box to use when a target moves between beats. */
  inBeat?: string;
  what: string;
  why: string;
  /** A role color: the dot before line 1. */
  role?: string;
  /** Frames inside the shot: in on `from` (a downbeat), out on beat 4 of the bar before `to`. */
  from: number;
  to: number;
  /** Fallback side when the layout file has no measured spot for this callout. */
  side: Side;
};

export const CARD_W = 600;

/** The card's height for its text: two lines, the second wraps at about 36 characters. */
export function cardHeight(why: string) {
  const lines = Math.max(1, Math.ceil(why.length / 36));
  return 36 + 41 + 6 + 35 * lines;
}

/** The key a callout's measured spot is stored under in callout-layout.json. */
export const layoutKey = (
  scope: string,
  spec: Pick<CalloutSpec, "target" | "from">,
) => `${scope}:${spec.target}:${spec.from}`;
