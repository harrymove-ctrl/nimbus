// The cloud with eyes, ported from the app's src/components/glow-cloud.tsx as a pure function
// of the frame (board rev D: "the cloud is the mark"). Same PUFFS, CORE, EYES, goo filter and
// gradients; the breathe, the glances, the blinks and the wink run on useCurrentFrame() from
// tables, not requestAnimationFrame and Math.random, so every render is identical.
import { useId } from "react";
import { interpolate, interpolateColors, useCurrentFrame, useVideoConfig } from "remotion";

const PUFFS = [
  { cx: 115, cy: 93, r: 43 },
  { cx: 163, cy: 111, r: 39 },
  { cx: 156, cy: 155, r: 31 },
  { cx: 107, cy: 155, r: 35 },
  { cx: 72, cy: 126, r: 34 },
];
const CORE = { x: 80, y: 100, width: 80, height: 65 };
const EYES = { y: 106, w: 18, h: 31, left: 96.5, right: 127.5 };
const CX = 120;
const CY = 120;
const BOTTOM = 180;

/** glow-cloud.tsx's palette (blue, and data-color="orange"), as concrete colours. */
const BLUE = { rim: "#f4fcff", body1: "#06a3ff", body2: "#18b2ff", body3: "#58cdff", eye: "#cdeeff", shade: "rgba(30, 140, 230, 0.3)" };
const ORANGE = { rim: "#fff9f5", body1: "#f45434", body2: "#fa7342", body3: "#ffb175", eye: "#ffe8db", shade: "rgba(230, 90, 50, 0.3)" };

/** The app's own glances (glow-cloud.tsx GLANCES), played in this order, one every GLANCE_S. */
const GLANCES = [
  { x: 0, y: 0 },
  { x: -1, y: 0.05 },
  { x: 1, y: -0.05 },
  { x: 0, y: 0 },
  { x: 0.65, y: -0.55 },
  { x: -0.7, y: 0.35 },
];
const GLANCE_S = 1.9;
/** Idle blinks, in seconds (the app blinks every 2.4–5.4 s, a quarter of them twice). */
const BLINKS = [1.8, 4.6, 4.86, 8.1, 11.2, 13.9, 14.16, 17.3];

const about = (x: number, y: number, t: string) => `translate(${x} ${y}) ${t} translate(${-x} ${-y})`;
const blinkScale = (since: number, length = 0.16) =>
  since < 0 || since > length ? 1 : 1 - 0.9 * Math.sin((since / length) * Math.PI);
/** A critically damped settle from a to b over `len` seconds (stands in for the app's springs). */
const settle = (a: number, b: number, s: number, len = 0.45) => {
  const p = Math.min(1, Math.max(0, s / len));
  const e = 1 - (1 + 6 * p) * Math.exp(-6 * p);
  return a + (b - a) * e;
};

export type CloudMarkProps = {
  size: number;
  /** 0 = blue (the boot screen), 1 = orange (replies waiting); in between blends. */
  orange?: number;
  /** On the boot sky the halo and edge go white, as glow-cloud's data-bg does. */
  onSky?: boolean;
  /** Frames (of this sequence) to blink at, on top of the idle blinks. */
  blinks?: number[];
  /** Frame to wink the right eye at. */
  winkAt?: number;
  /** false: no idle motion (held still, e.g. the end card). */
  alive?: boolean;
};

export function CloudMark({ size, orange = 0, onSky = false, blinks = [], winkAt, alive = true }: CloudMarkProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (n: string) => `cm${uid}-${n}`;
  const t = frame / fps;
  const col = (k: keyof typeof BLUE) => interpolateColors(orange, [0, 1], [BLUE[k], ORANGE[k]]);

  const float = alive ? Math.sin(t * 1.1) * 5 : 0;
  const breathe = alive ? Math.sin(t * 1.1 + Math.PI / 2) * 0.012 : 0;
  const k = Math.floor(t / GLANCE_S);
  const g0 = alive ? GLANCES[(k + GLANCES.length - 1) % GLANCES.length] : GLANCES[0];
  const g1 = alive ? GLANCES[k % GLANCES.length] : GLANCES[0];
  const since = t - k * GLANCE_S;
  const look = { x: settle(g0.x, g1.x, since), y: settle(g0.y, g1.y, since) };
  const blinkTimes = [...(alive ? BLINKS : []), ...blinks.map((f) => f / fps)];
  const both = Math.min(1, ...blinkTimes.map((b) => blinkScale(t - b)));
  const wink = winkAt === undefined ? 1 : blinkScale(t - winkAt / fps, 0.34);
  const eyeY = EYES.y + EYES.h / 2;
  const lift = (float + 5) / 10;
  const halo = onSky ? "rgba(255, 255, 255, 0.55)" : "rgba(255, 255, 255, 0.35)";
  const edge = onSky ? "rgba(255, 255, 255, 0.3)" : "rgba(255, 255, 255, 0.25)";
  const shadow = onSky ? "rgba(5, 50, 140, 0.5)" : interpolateColors(orange, [0, 1], ["rgba(10, 90, 200, 0.55)", "rgba(170, 50, 20, 0.5)"]);
  const puffs = PUFFS.map((p, i) => <circle key={i} {...p} />);

  const eye = (x: number, side: string, scaleY: number) => {
    const pill = { x, y: EYES.y, width: EYES.w, height: EYES.h, rx: EYES.w / 2 };
    return (
      <g transform={about(x + EYES.w / 2, eyeY, `scale(1 ${scaleY.toFixed(3)})`)}>
        <rect {...pill} fill={`url(#${id("eye")})`} />
        <clipPath id={id(`clip-${side}`)}>
          <rect {...pill} />
        </clipPath>
        <rect {...pill} y={EYES.y + 2.5} fill="none" stroke={col("shade")} strokeWidth="5" filter={`url(#${id("edge")})`} clipPath={`url(#${id(`clip-${side}`)})`} />
      </g>
    );
  };

  return (
    <svg viewBox="0 0 240 240" width={size} height={size} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <filter id={id("goo")} x="0" y="0" width="240" height="240" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="3.5" />
          <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 28 -12" />
        </filter>
        <filter id={id("soft")} x="0" y="0" width="240" height="240" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <filter id={id("halo")} x="0" y="0" width="240" height="240" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id={id("edge")} x="0" y="0" width="240" height="240" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
        <filter id={id("shade")} x="0" y="0" width="240" height="240" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <g id={id("shape")} filter={`url(#${id("goo")})`}>
          {puffs}
          <rect {...CORE} />
        </g>
        <mask id={id("mask")} maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="240">
          <use href={`#${id("shape")}`} fill="#fff" />
        </mask>
        <linearGradient id={id("rim")} x1="0" y1="56" x2="0" y2="182" gradientUnits="userSpaceOnUse">
          <stop offset={0} stopColor={col("rim")} />
          <stop offset={1} stopColor="#ffffff" />
        </linearGradient>
        <radialGradient id={id("body")} cx="120" cy="108" r="78" gradientUnits="userSpaceOnUse">
          <stop offset={0} stopColor={col("body1")} />
          <stop offset={0.6} stopColor={col("body2")} />
          <stop offset={1} stopColor={col("body3")} />
        </radialGradient>
        <linearGradient id={id("eye")} x1="0" y1="0" x2="0" y2="1">
          <stop offset={0} stopColor="#ffffff" />
          <stop offset={1} stopColor={col("eye")} />
        </linearGradient>
      </defs>

      <ellipse cx={CX} cy="210" rx="54" ry="7" fill={shadow} filter={`url(#${id("shade")})`} transform={about(CX, 210, `scale(${(1 - lift * 0.12).toFixed(3)} 1)`)} opacity={0.34 - lift * 0.1} />
      <g transform={`translate(0 ${float.toFixed(2)}) ${about(CX, BOTTOM, `scale(${(1 - breathe).toFixed(4)} ${(1 + breathe).toFixed(4)})`)}`}>
        <g transform={`translate(${(look.x * 4).toFixed(2)} ${(look.y * 2).toFixed(2)}) ${about(CX, CY, `rotate(${(look.x * 2.5).toFixed(2)}) scale(${(1 - Math.abs(look.x) * 0.025).toFixed(4)} 1)`)}`}>
          <use href={`#${id("shape")}`} fill={halo} filter={`url(#${id("halo")})`} />
          <use href={`#${id("shape")}`} fill={edge} filter={`url(#${id("edge")})`} />
          <g mask={`url(#${id("mask")})`}>
            <rect width="240" height="240" fill={`url(#${id("rim")})`} />
            <g filter={`url(#${id("soft")})`} fill={`url(#${id("body")})`} transform={`translate(0 2) ${about(CX, CY, "scale(0.9 0.87)")}`}>
              {puffs}
              <rect {...CORE} />
            </g>
            <ellipse cx="104" cy="80" rx="30" ry="12" fill="#fff" opacity="0.32" filter={`url(#${id("shade")})`} transform={`translate(${(-look.x * 7).toFixed(2)} ${(-look.y * 3).toFixed(2)})`} />
          </g>
          <g transform={`translate(${(look.x * 12).toFixed(2)} ${(look.y * 7).toFixed(2)})`}>
            {eye(EYES.left, "l", both)}
            {eye(EYES.right, "r", Math.min(both, wink))}
          </g>
        </g>
      </g>
    </svg>
  );
}

/** Eases used by every motion scene. */
export const clampX = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const ramp = (f: number, a: number, b: number, from = 0, to = 1, easing?: (t: number) => number) =>
  interpolate(f, [a, b], [from, to], { ...clampX, easing });
