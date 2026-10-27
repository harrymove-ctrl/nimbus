// Comment Storm (scene 2), written from the board's description: one line types into a pill,
// then the morning pile lands — pills tossed in with overshoot and tilt, cards opening
// downward and typing their own lines — faster and faster while the camera pulls back,
// shakes, and folds the pile into its center; cut to black. Every position and time comes
// from the tables below, so renders are identical.
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, MANROPE } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export type StormItem = {
  kind: "pill" | "card";
  text: string;
  /** Position in world px from the frame centre (the world is wider than the frame). */
  x: number;
  y: number;
  /** Degrees. */
  tilt: number;
  /** Frame it lands, inside the scene. */
  at: number;
};

// A generic morning (docs/video/script.md honesty notes: not claims about anyone).
const TEXTS: [StormItem["kind"], string][] = [
  ["pill", "PR #31 failed"],
  ["card", "reply to Dana?"],
  ["pill", "Devpost: 2 days left"],
  ["card", "Token Factory: $3.20 today"],
  ["pill", "who else is building this?"],
  ["pill", "standup in 5"],
  ["card", "check the release notes"],
  ["pill", "CI: 2 checks red"],
  ["card", "invoice due Friday"],
  ["pill", "3 unread in #infra"],
  ["pill", "renew the domain"],
  ["card", "review: router fix"],
  ["pill", "flaky test again"],
  ["pill", "lunch?"],
];
// Where each lands, spread around the opener, and how it leans.
const SPOTS: [number, number, number][] = [
  [-560, -250, -5], [470, -300, 4], [-620, 170, 3], [560, 160, -4],
  [-150, -420, 6], [120, 330, -6], [-980, -60, -3], [980, -40, 5],
  [-470, 420, 4], [600, 470, -3], [-1050, 330, -5], [1020, -380, 3],
  [-900, -420, 5], [330, -170, -4],
];
// Gaps between landings, tightening from 24 to 3 frames.
const GAPS = [24, 22, 20, 18, 16, 14, 12, 10, 8, 7, 6, 5, 4];

/** The table the board asks for: the first `count` items, landing from frame 30. */
export function stormTable(count: number, firstAt = 30, gapScale = 1): StormItem[] {
  let at = firstAt;
  return TEXTS.slice(0, count).map(([kind, text], i) => {
    const [x, y, tilt] = SPOTS[i];
    const item = { kind, text, x, y, tilt, at };
    at += Math.round((GAPS[i] ?? 3) * gapScale);
    return item;
  });
}

function Pill({ text, ink, bg, size }: { text: string; ink: string; bg: string; size: number }) {
  return (
    <div
      style={{
        padding: `${size * 0.32}px ${size * 0.62}px`,
        borderRadius: 999,
        background: bg,
        color: ink,
        fontSize: size,
        fontWeight: 600,
        whiteSpace: "nowrap",
        boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
      }}
    >
      {text}
    </div>
  );
}

export function CommentStorm({
  opener,
  items,
  charFrames = 2,
}: {
  opener: string;
  items: StormItem[];
  charFrames?: number;
}) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const foldAt = durationInFrames - 20; // fold over 16 frames, then 4 frames of black
  const shakeAt = durationInFrames - 60;

  const pull = interpolate(frame, [0, durationInFrames], [1, 0.7], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const shakeAmt = interpolate(frame, [shakeAt, foldAt], [0, 6], clamp);
  const t = frame / fps;
  const shakeX = Math.sin(2 * Math.PI * 4 * t) * shakeAmt;
  const shakeY = Math.cos(2 * Math.PI * 4 * t + 1.3) * shakeAmt;
  const fold = interpolate(frame, [foldAt, foldAt + 16], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const black = frame >= foldAt + 16;

  const openerTyped = opener.slice(0, Math.floor(frame / charFrames));

  return (
    <AbsoluteFill style={{ background: "#0c0c0e", fontFamily: MANROPE, overflow: "hidden" }}>
      {black ? null : (
        <AbsoluteFill
          style={{
            transform: `translate(${shakeX}px, ${shakeY}px) scale(${pull * (1 - fold * 0.92)})`,
            opacity: 1 - fold * 0.4,
          }}
        >
          {items.map((it, i) => {
            if (frame < it.at) return null;
            const s = spring({ frame: frame - it.at, fps, config: { damping: 11, stiffness: 170, mass: 0.8 } });
            const x = it.x * (1 - fold);
            const y = it.y * (1 - fold);
            const common: React.CSSProperties = {
              position: "absolute",
              left: "50%",
              top: "50%",
              zIndex: i,
            };
            if (it.kind === "pill") {
              // Tossed in from further out, overshooting to ~1.15 before it settles.
              const from = 1.8;
              const px = interpolate(s, [0, 1], [it.x * from, x]);
              const py = interpolate(s, [0, 1], [it.y * from, y]);
              return (
                <div
                  key={i}
                  style={{
                    ...common,
                    transform: `translate(-50%, -50%) translate(${px}px, ${py}px) rotate(${it.tilt * s}deg) scale(${0.4 + 0.6 * s})`,
                  }}
                >
                  <Pill text={it.text} ink={C.paper} bg={C.card} size={34} />
                </div>
              );
            }
            // A card opens downward, then types its own line.
            const open = interpolate(frame, [it.at, it.at + 6], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
            const typed = it.text.slice(0, Math.max(0, Math.floor((frame - it.at - 6) / 1)));
            return (
              <div
                key={i}
                style={{
                  ...common,
                  transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${it.tilt}deg)`,
                }}
              >
                <div
                  style={{
                    width: 460,
                    transform: `scaleY(${open})`,
                    transformOrigin: "top center",
                    background: C.paper,
                    color: C.ink,
                    borderRadius: 18,
                    padding: "20px 26px",
                    boxShadow: "0 24px 50px rgba(0,0,0,0.4)",
                  }}
                >
                  <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                    <span style={{ width: 14, height: 14, borderRadius: 7, background: C.orange }} />
                    <span style={{ width: 120, height: 14, borderRadius: 7, background: C.soft }} />
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 600, minHeight: 40 }}>{typed}</div>
                </div>
              </div>
            );
          })}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 100,
            }}
          >
            <Pill text={openerTyped || " "} ink={C.ink} bg={C.paper} size={56} />
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}
