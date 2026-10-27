// The explainer callout (references/components.md, board.md rev C): a mint ring around a UI
// element, a thin leader line, and a small card — line 1 what it is, line 2 why it helps you.
// The rest of the frame dims 25 %. In on a downbeat (ring 8 f, then the card 6 f), out on
// beat 4 of its last bar. A pure function of the frame; the box is in frame pixels, already
// through the footage's camera, so the ring rides a push-in.
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { framesPerBeat } from "../grid";
import { C, MANROPE } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

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
  side: Side;
};
export type ScreenBox = { x: number; y: number; w: number; h: number };

const PAD = 8;
const RING = 8;
const CARD_IN = 6;
const FADE = 6;
const MARGIN = 48;
const GAP = 64;
const CARD_W = 600;
const CARD_H = 128;

/** How visible a callout is at `frame` (0–1), shared by the ring, the card and the dim. */
export function calloutLevel(frame: number, from: number, to: number) {
  const out = to - framesPerBeat;
  return Math.min(
    interpolate(frame, [from, from + RING], [0, 1], clamp),
    interpolate(frame, [out, out + FADE], [1, 0], clamp),
  );
}

export function Dim({ boxes, level }: { boxes: ScreenBox[]; level: number }) {
  const { width, height } = useVideoConfig();
  if (level <= 0) return null;
  // the frame dims everywhere but the targets: an even-odd path with a hole per box
  const holes = boxes
    .map((b) => {
      const x = b.x - PAD;
      const y = b.y - PAD;
      return `M${x},${y} h${b.w + 2 * PAD} v${b.h + 2 * PAD} h${-(b.w + 2 * PAD)} z`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
      <path d={`M0,0 H${width} V${height} H0 z ${holes}`} fill={C.bg} fillRule="evenodd" opacity={0.25 * level} />
    </svg>
  );
}

export function Callout({ spec, box }: { spec: CalloutSpec; box: ScreenBox }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const level = calloutLevel(frame, spec.from, spec.to);
  if (level <= 0) return null;
  const draw = interpolate(frame, [spec.from, spec.from + RING], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const cardIn = interpolate(frame, [spec.from + RING, spec.from + RING + CARD_IN], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });

  const rx = box.x - PAD;
  const ry = box.y - PAD;
  const rw = box.w + 2 * PAD;
  const rh = box.h + 2 * PAD;
  const perimeter = 2 * (rw + rh);

  // the card sits on `side`, clamped inside the frame
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;
  let x = spec.side === "left" ? rx - GAP - CARD_W : spec.side === "right" ? rx + rw + GAP : cx - CARD_W / 2;
  let y = spec.side === "above" ? ry - GAP - CARD_H : spec.side === "below" ? ry + rh + GAP : cy - CARD_H / 2;
  x = Math.min(Math.max(MARGIN, x), width - MARGIN - CARD_W);
  y = Math.min(Math.max(MARGIN, y), height - MARGIN - CARD_H);
  // the leader: from the ring's edge on that side to the card's facing edge
  const from =
    spec.side === "left" ? [rx, cy] : spec.side === "right" ? [rx + rw, cy] : spec.side === "above" ? [cx, ry] : [cx, ry + rh];
  const to =
    spec.side === "left"
      ? [x + CARD_W, y + CARD_H / 2]
      : spec.side === "right"
        ? [x, y + CARD_H / 2]
        : spec.side === "above"
          ? [Math.min(Math.max(cx, x + 24), x + CARD_W - 24), y + CARD_H]
          : [Math.min(Math.max(cx, x + 24), x + CARD_W - 24), y];

  return (
    <AbsoluteFill style={{ opacity: level, pointerEvents: "none" }}>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <rect
          x={rx}
          y={ry}
          width={rw}
          height={rh}
          rx={10}
          fill="none"
          stroke={C.mint}
          strokeWidth={2}
          strokeDasharray={perimeter}
          strokeDashoffset={(1 - draw) * perimeter}
        />
        <line
          x1={from[0]}
          y1={from[1]}
          x2={from[0] + (to[0] - from[0]) * draw}
          y2={from[1] + (to[1] - from[1]) * draw}
          stroke="oklch(1 0 0 / 40%)"
          strokeWidth={1.5}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: CARD_W,
          minHeight: CARD_H,
          boxSizing: "border-box",
          opacity: cardIn,
          transform: `translateY(${(1 - cardIn) * 12}px)`,
          background: C.card,
          border: `1px solid ${C.line}`,
          borderRadius: 14,
          padding: "18px 24px",
          fontFamily: MANROPE,
          boxShadow: "0 24px 60px oklch(0 0 0 / 45%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 34, fontWeight: 600, color: C.ink, lineHeight: 1.2 }}>
          {spec.role ? <span style={{ width: 12, height: 12, borderRadius: 6, background: spec.role, flexShrink: 0 }} /> : null}
          {spec.what}
        </div>
        <div style={{ marginTop: 6, fontSize: 28, fontWeight: 500, color: C.muted, lineHeight: 1.25 }}>{spec.why}</div>
      </div>
    </AbsoluteFill>
  );
}

/** The chapter eyebrow: a small chip top-left for the whole chapter. */
export function Eyebrow({ n, title }: { n: number; title: string }) {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, 8], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <div
      style={{
        position: "absolute",
        left: 48,
        top: 48,
        transform: `translateX(${(1 - p) * -40}px)`,
        opacity: p,
        background: `color-mix(in oklch, ${C.card} 90%, transparent)`,
        border: `1px solid ${C.line}`,
        borderRadius: 999,
        padding: "10px 24px",
        fontFamily: MANROPE,
        fontSize: 28,
        fontWeight: 600,
        color: C.ink,
      }}
    >
      <span style={{ color: C.mint }}>{n}</span> · {title}
    </div>
  );
}
