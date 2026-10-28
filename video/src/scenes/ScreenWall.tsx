// Screen Wall (board rev D, scene 12), our own build: four phones down a tunnel, each screen a
// real frame of the /v1 chat (docs/video/chat-transcript.json, verbatim, passed in by the
// composition). The camera backs out until they frame "Same crew, in your chat app", which
// builds a word at a time with a horizontal shove.
import { AbsoluteFill, Easing, useCurrentFrame, useVideoConfig } from "remotion";
import { CloudMark, ramp } from "../components/CloudMark";
import { C, MANROPE } from "../theme";

export type WallScreen = { user?: string; reply?: string[]; typing?: boolean };

const PHONE = { w: 380, h: 780 };
/** Tunnel positions (px at depth 0): the phones line both walls, receding. */
const SLOTS = [
  { x: -700, y: -60, z: 0 },
  { x: 700, y: -60, z: -620 },
  { x: -700, y: -60, z: -1240 },
  { x: 700, y: -60, z: -1860 },
];
const PERSPECTIVE = 1400;
const LINE = "Same crew, in your chat app";
const LINE_SIZE = 76;

function Screen({ s }: { s: WallScreen }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: C.bg, display: "flex", flexDirection: "column", fontFamily: MANROPE }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "46px 18px 12px", borderBottom: `1px solid ${C.line}` }}>
        <div style={{ width: 34, height: 34, borderRadius: 17, background: "#18b2ff", display: "grid", placeItems: "center" }}>
          <CloudMark size={30} onSky alive={false} />
        </div>
        <div>
          <div style={{ color: C.ink, fontSize: 19, fontWeight: 700 }}>Nimbus</div>
          <div style={{ color: C.muted, fontSize: 13, fontWeight: 500 }}>via OpenClaw</div>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 12, padding: "12px 14px 24px", overflow: "hidden" }}>
        {s.user ? (
          <div style={{ alignSelf: "flex-end", background: C.mint, color: C.bg, fontSize: 21, fontWeight: 600, padding: "10px 16px", borderRadius: "18px 18px 4px 18px" }}>{s.user}</div>
        ) : null}
        {s.reply ? (
          <div style={{ alignSelf: "flex-start", maxWidth: "92%", background: C.card, border: `1px solid ${C.line}`, color: C.ink, fontSize: 19, fontWeight: 600, lineHeight: 1.32, padding: "10px 14px", borderRadius: "18px 18px 18px 4px" }}>
            {s.reply.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        ) : null}
        {s.typing ? (
          <div style={{ alignSelf: "flex-start", background: C.card, border: `1px solid ${C.line}`, padding: "14px 16px", borderRadius: "18px 18px 18px 4px", display: "flex", gap: 6 }}>
            {[0, 1, 2].map((d) => (
              <span key={d} style={{ width: 8, height: 8, borderRadius: 4, background: C.muted }} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function wordWidths() {
  const ctx = document.createElement("canvas").getContext("2d");
  const words = LINE.split(" ");
  if (!ctx) return words.map((w) => w.length * LINE_SIZE * 0.55);
  ctx.font = `700 ${LINE_SIZE}px ${MANROPE}`;
  ctx.letterSpacing = "-0.02em";
  return words.map((w) => ctx.measureText(w).width);
}

/** `back`: frames the camera takes to back out; the line starts building at `lineAt`. */
export function ScreenWall({ screens, back, lineAt, every }: { screens: WallScreen[]; back: number; lineAt: number; every: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  // the camera starts inside the tunnel, just behind the first phone, and backs out: every
  // phone's depth is its slot plus `cam`, which falls from 1000 (close) to -390 (backed out)
  const cam = ramp(frame, 0, back, 1000, -330, Easing.inOut(Easing.cubic)) + ramp(frame, back, durationInFrames, 0, -60);
  const words = LINE.split(" ");
  const widths = wordWidths();
  const space = LINE_SIZE * 0.26;
  const ps = words.map((_, i) => ramp(frame, lineAt + i * every, lineAt + i * every + 9, 0, 1, Easing.out(Easing.back(1.4))));
  const lineW = ps.reduce((sum, p, i) => sum + p * (widths[i] + (i ? space : 0)), 0);
  let x = 960 - lineW / 2;
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: "hidden" }}>
      <AbsoluteFill style={{ perspective: PERSPECTIVE, perspectiveOrigin: "50% 45%" }}>
        {SLOTS.slice(0, screens.length)
          .map((slot, i) => ({ slot, i }))
          .reverse()
          .map(({ slot, i }) => {
            const z = slot.z + cam;
            const near = z > PERSPECTIVE - 200;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: 960 - PHONE.w / 2,
                  top: 486 - PHONE.h / 2,
                  width: PHONE.w,
                  height: PHONE.h,
                  transform: `translate3d(${slot.x}px, ${slot.y}px, ${z}px) rotateY(${slot.x < 0 ? 16 : -16}deg)`,
                  borderRadius: 56,
                  border: "12px solid #1c1c1f",
                  boxShadow: "0 0 0 2px rgba(255, 255, 255, 0.12), 0 40px 90px oklch(0 0 0 / 60%)",
                  overflow: "hidden",
                  background: C.bg,
                  opacity: near ? 0 : ramp(z, -2600, -2000, 0.25, 1),
                }}
              >
                <Screen s={screens[i]} />
              </div>
            );
          })}
      </AbsoluteFill>
      {words.map((w, i) => {
        const p = ps[i];
        const left = x;
        x += p * (widths[i] + space);
        return (
          <div key={i} style={{ position: "absolute", left, top: 900, fontFamily: MANROPE, fontSize: LINE_SIZE, fontWeight: 700, color: i >= 4 ? C.mint : C.ink, letterSpacing: "-0.02em", whiteSpace: "nowrap", opacity: p, transform: `translateX(${(1 - p) * 90}px)` }}>
            {w}
          </div>
        );
      })}
    </AbsoluteFill>
  );
}
