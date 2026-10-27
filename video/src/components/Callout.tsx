// The explainer callout (references/components.md, board.md rev C): a mint ring around a UI
// element, a thin leader line, and a small card — line 1 what it is, line 2 why it helps you.
// The rest of the frame dims 25 %. In on a downbeat (ring 8 f, then the card 6 f), out on
// beat 4 of its last bar. A pure function of the frame; the box is in frame pixels, already
// through the footage's camera, so the ring rides a push-in.
//
// Where the card sits is measured, not guessed: scripts/layout-callouts.py renders each
// callout's frames with only its ring drawn (render mode "rings"), finds the spot near the
// ring that covers the least UI text, and writes it to src/callout-layout.json.
import {
  AbsoluteFill,
  Easing,
  getInputProps,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { framesPerBeat } from "../grid";
import { C, MANROPE } from "../theme";
import {
  CARD_W,
  type CalloutSpec,
  cardHeight,
  layoutKey,
} from "../callout-spec";
import LAYOUT from "../callout-layout.json";

export type { CalloutSpec, Side } from "../callout-spec";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export type ScreenBox = { x: number; y: number; w: number; h: number };

const PAD = 8;
const RING = 8;
const CARD_IN = 6;
const FADE = 6;
const MARGIN = 48;
/** The ring's rect stays this far inside the frame, so its 2 px stroke keeps a 24 px margin
 *  (Gate 3: never clipped by the edge). */
const SAFE = 25;
const GAP = 64;

/** "rings": draw only each ring, in pure green, for scripts/layout-callouts.py. */
const PROPS = getInputProps() as { calloutMode?: string; only?: string };
export const CALLOUT_MODE = PROPS.calloutMode ?? "normal";
const MEASURE = CALLOUT_MODE === "rings";

const placed = LAYOUT as Record<string, { x: number; y: number }>;

/** How visible a callout is at `frame` (0–1), shared by the ring, the card and the dim. */
export function calloutLevel(frame: number, from: number, to: number) {
  const out = to - framesPerBeat;
  return Math.min(
    interpolate(frame, [from, from + RING], [0, 1], clamp),
    interpolate(frame, [out, out + FADE], [1, 0], clamp),
  );
}

/** The ring's rectangle: the target plus padding, kept SAFE px inside the frame. */
export function ringRect(box: ScreenBox, width: number, height: number) {
  const x0 = Math.max(SAFE, box.x - PAD);
  const y0 = Math.max(SAFE, box.y - PAD);
  const x1 = Math.min(width - SAFE, box.x + box.w + PAD);
  const y1 = Math.min(height - SAFE, box.y + box.h + PAD);
  return { x: x0, y: y0, w: Math.max(8, x1 - x0), h: Math.max(8, y1 - y0) };
}

export function Dim({ boxes, level }: { boxes: ScreenBox[]; level: number }) {
  const { width, height } = useVideoConfig();
  if (level <= 0 || MEASURE) return null;
  // the frame dims everywhere but the targets: an even-odd path with a hole per ring
  const holes = boxes
    .map((b) => ringRect(b, width, height))
    .map((r) => `M${r.x},${r.y} h${r.w} v${r.h} h${-r.w} z`)
    .join(" ");
  return (
    <svg
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0 }}
    >
      <path
        d={`M0,0 H${width} V${height} H0 z ${holes}`}
        fill={C.bg}
        fillRule="evenodd"
        opacity={0.25 * level}
      />
    </svg>
  );
}

const nearest = (
  px: number,
  py: number,
  r: { x: number; y: number; w: number; h: number },
) => [
  Math.min(Math.max(px, r.x), r.x + r.w),
  Math.min(Math.max(py, r.y), r.y + r.h),
];

export function Callout({
  spec,
  box,
  scope,
}: {
  spec: CalloutSpec;
  box: ScreenBox;
  scope: string;
}) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const level = calloutLevel(frame, spec.from, spec.to);
  if (level <= 0) return null;
  const draw = interpolate(frame, [spec.from, spec.from + RING], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const cardIn = interpolate(
    frame,
    [spec.from + RING, spec.from + RING + CARD_IN],
    [0, 1],
    { ...clamp, easing: Easing.out(Easing.cubic) },
  );

  const ring = ringRect(box, width, height);
  const perimeter = 2 * (ring.w + ring.h);

  if (MEASURE) {
    if (PROPS.only && PROPS.only !== layoutKey(scope, spec)) return null;
    return (
      <svg
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0 }}
      >
        <rect
          x={ring.x}
          y={ring.y}
          width={ring.w}
          height={ring.h}
          fill="none"
          stroke="#00ff00"
          strokeWidth={3}
        />
      </svg>
    );
  }

  const cardH = cardHeight(spec.why);
  const cx = ring.x + ring.w / 2;
  const cy = ring.y + ring.h / 2;
  const spot = placed[layoutKey(scope, spec)];
  let x: number;
  let y: number;
  if (spot) {
    ({ x, y } = spot);
  } else {
    x =
      spec.side === "left"
        ? ring.x - GAP - CARD_W
        : spec.side === "right"
          ? ring.x + ring.w + GAP
          : cx - CARD_W / 2;
    y =
      spec.side === "above"
        ? ring.y - GAP - cardH
        : spec.side === "below"
          ? ring.y + ring.h + GAP
          : cy - cardH / 2;
  }
  x = Math.min(Math.max(MARGIN, x), width - MARGIN - CARD_W);
  y = Math.min(Math.max(MARGIN, y), height - MARGIN - cardH);
  // the leader joins the nearest points of the ring and the card
  const card = { x, y, w: CARD_W, h: cardH };
  const to = nearest(cx, cy, card);
  const from = nearest(to[0], to[1], ring);

  return (
    <AbsoluteFill style={{ opacity: level, pointerEvents: "none" }}>
      <svg
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        <rect
          x={ring.x}
          y={ring.y}
          width={ring.w}
          height={ring.h}
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
          minHeight: cardH,
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 34,
            fontWeight: 600,
            color: C.ink,
            lineHeight: 1.2,
          }}
        >
          {spec.role ? (
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                background: spec.role,
                flexShrink: 0,
              }}
            />
          ) : null}
          {spec.what}
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 28,
            fontWeight: 500,
            color: C.muted,
            lineHeight: 1.25,
          }}
        >
          {spec.why}
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** The chapter eyebrow: a small chip top-left for the whole chapter, on a solid backing and a
 *  corner scrim so the app's own header text never shows through or around it (Gate 3). */
export function Eyebrow({ n, title }: { n: number; title: string }) {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, 8], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  if (MEASURE) return null;
  return (
    <>
      {/* a neutral-950 scrim from the corner, so app text never shows half-cut around the chip */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 1100,
          height: 300,
          opacity: p,
          background: `radial-gradient(ellipse 100% 100% at 0% 0%, ${C.bg} 0%, ${C.bg} 42%, transparent 100%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 40,
          top: 40,
          transform: `translateX(${(1 - p) * -40}px)`,
          opacity: p,
          background: C.bg,
          border: `1px solid ${C.line}`,
          borderRadius: 999,
          padding: "12px 26px",
          fontFamily: MANROPE,
          fontSize: 28,
          fontWeight: 600,
          color: C.ink,
          boxShadow: `0 0 0 10px ${C.bg}, 0 12px 40px oklch(0 0 0 / 60%)`,
        }}
      >
        <span style={{ color: C.mint }}>{n}</span> · {title}
      </div>
    </>
  );
}

/** Where the eyebrow sits, so layout-callouts.py keeps cards off it. */
export const EYEBROW_BOX = { x: 20, y: 20, w: 560, h: 110 };
