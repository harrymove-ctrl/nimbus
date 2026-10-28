// Scene 20 "Run it": a terminal window that fills the frame from its first frame (88 % × 87 %),
// the clone and `pnpm dev` typing in, the output, then the URL line; the camera pins in on the
// URL only in the last bar. Our own build: snapcn `terminal-simulator` is a bare text station
// that its own camera flies to, which left the frame mostly empty (Gate 3 on rev 6). Type is
// the system monospace the app uses for code (font-mono); colours are the app's.
import { AbsoluteFill, Easing, useCurrentFrame, useVideoConfig } from "remotion";
import { ramp } from "../components/CloudMark";
import { bars } from "../grid";
import { C, MANROPE, MONO } from "../theme";
import { Ground } from "./Opening";

const WIN = { w: 1700, h: 940, pad: 72, size: 52, lead: 1.8 };
type Line = { text: string; kind: "cmd" | "out" | "ok"; at: number };
/** Frames at speed 1: commands type at 2 characters a frame, outputs arrive whole. */
export const LINES: Line[] = [
  { text: "git clone github.com/harrymove-ctrl/nimbus", kind: "cmd", at: 6 },
  { text: "cd nimbus && pnpm install && pnpm dev", kind: "cmd", at: 34 },
  { text: "Packages: +612 · done in 9.8s", kind: "out", at: 62 },
  { text: "▲ Next.js 15 · ready in 1.4s", kind: "out", at: 74 },
  { text: "Nimbus · http://localhost:3000", kind: "ok", at: 86 },
];
const CPF = 2;
/** The frames each command types over (for the key sounds). */
export const TYPING = LINES.filter((l) => l.kind === "cmd").map((l) => [l.at, l.at + Math.ceil(l.text.length / CPF)] as const);
export const URL_LINE_AT = LINES[LINES.length - 1].at;

export function RunIt({ speed = 1 }: { speed?: number }) {
  const frame = useCurrentFrame() * speed;
  const { durationInFrames } = useVideoConfig();
  const end = durationInFrames * speed;
  const left = (1920 - WIN.w) / 2;
  const top = (1080 - WIN.h) / 2;
  const lineH = WIN.size * WIN.lead;
  const bodyTop = top + 64 + WIN.pad;
  const urlY = bodyTop + (LINES.length - 1) * lineH + lineH / 2;
  // the pin: only in the last bar, onto the URL line
  const pin = ramp(frame, end - bars(1) * speed, end - bars(1) * speed + 24, 0, 1, Easing.inOut(Easing.cubic));
  const enter = ramp(frame, 0, 8, 0, 1, Easing.out(Easing.cubic));
  const typing = LINES.find((l) => l.kind === "cmd" && frame >= l.at && frame < l.at + l.text.length / CPF);
  const lastShown = [...LINES].reverse().find((l) => frame >= l.at);
  return (
    <Ground>
      <AbsoluteFill
        style={{
          // on screen from its first frame: a 3 % settle, no fade
          transform: `scale(${(0.97 + 0.03 * enter) * (1 + 0.3 * pin)})`,
          transformOrigin: `${left + WIN.pad + 480}px ${urlY}px`,
        }}
      >
        <div style={{ position: "absolute", left, top, width: WIN.w, height: WIN.h, borderRadius: 18, background: C.card, border: `1px solid ${C.line}`, boxShadow: "0 30px 80px oklch(0 0 0 / 50%)", overflow: "hidden" }}>
          <div style={{ height: 64, display: "flex", alignItems: "center", gap: 12, padding: "0 24px", borderBottom: `1px solid ${C.line}`, background: C.raised }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ width: 16, height: 16, borderRadius: 8, background: C.dim }} />
            ))}
            <span style={{ marginLeft: 16, fontFamily: MANROPE, fontSize: 24, fontWeight: 600, color: C.muted }}>nimbus — zsh</span>
          </div>
          <div style={{ position: "absolute", left: WIN.pad, top: 64 + WIN.pad, right: WIN.pad, fontFamily: MONO, fontSize: WIN.size, lineHeight: `${lineH}px`, whiteSpace: "pre" }}>
            {LINES.map((l, i) => {
              if (frame < l.at && !(i === 0 && frame >= 0)) return null;
              const shown = l.kind === "cmd" ? l.text.slice(0, Math.max(0, Math.floor((frame - l.at) * CPF))) : l.text;
              const color = l.kind === "ok" ? C.mint : l.kind === "out" ? C.muted : C.ink;
              const cursor = (typing === l || (!typing && lastShown === l && l.kind !== "ok") || (i === 0 && frame < l.at)) && Math.floor(frame / 8) % 2 === 0;
              return (
                <div key={i} style={{ color, height: lineH }}>
                  {l.kind === "cmd" ? <span style={{ color: C.mint }}>$ </span> : null}
                  {frame >= l.at ? shown : ""}
                  {cursor ? <span style={{ display: "inline-block", width: WIN.size * 0.6, height: WIN.size * 1.05, marginLeft: 4, verticalAlign: "-0.18em", background: C.mint }} /> : null}
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    </Ground>
  );
}
