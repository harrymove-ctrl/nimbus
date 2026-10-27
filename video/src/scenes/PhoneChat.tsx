// Scene 12: the chat app on a phone (snapcn phone-frame), replaying the real /v1 transcript
// word for word on Agent Chat's clock: only the typing rate is chosen; every later beat
// derives from it. Type sizes are device px; the phone is scaled to frame height, so 18 px
// on the device reads at ≈ 29 px in the 1080p frame.
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { PhoneFrame } from "@/components/snap-cn/phone-frame";
import { C, CLOUD, MANROPE, SORBET } from "../theme";
import { type ChatMessage, chatSchedule, lines } from "./AgentChat";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const PHONE_SCALE = 1.58;

function Avatar() {
  return (
    <div style={{ width: 28, height: 28, borderRadius: 14, background: CLOUD.blue, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width={18} height={18} viewBox="0 0 100 100">
        <path d="M27 74a17 17 0 0 1-3-34 25 25 0 0 1 48-5 20 20 0 0 1 3 39z" fill={C.ink} />
      </svg>
    </div>
  );
}

function Screen({ transcript, charFrames, greyFrames }: { transcript: ChatMessage[]; charFrames: number; greyFrames: number }) {
  const frame = useCurrentFrame();
  const { messages } = chatSchedule(transcript, charFrames);
  const typing = messages.find((m) => m.role === "user" && frame >= m.from && frame < m.at);
  const typed = typing ? typing.text.slice(0, Math.floor((frame - typing.from) / charFrames)) : "";
  const shown = messages.filter((m) => frame >= (m.role === "user" ? m.at : m.from));
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: MANROPE, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "44px 16px 10px", borderBottom: `1px solid ${C.line}` }}>
        <Avatar />
        <div>
          <div style={{ color: C.ink, fontSize: 17, fontWeight: 700 }}>Nimbus</div>
          <div style={{ color: C.muted, fontSize: 12, fontWeight: 500 }}>via OpenClaw</div>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 10, padding: "10px 12px", overflow: "hidden" }}>
        {shown.map((m, i) => {
          if (m.role === "user") {
            const p = interpolate(frame, [m.at, m.at + 6], [0, 1], clamp);
            return (
              <div key={i} style={{ alignSelf: "flex-end", opacity: p, transform: `scale(${0.85 + 0.15 * p})`, transformOrigin: "right bottom", background: C.mint, color: C.bg, fontSize: 18, fontWeight: 600, padding: "8px 14px", borderRadius: "16px 16px 4px 16px" }}>
                {m.text}
              </div>
            );
          }
          let k = -1;
          return (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-end", alignSelf: "flex-start", maxWidth: "94%" }}>
              <Avatar />
              <div style={{ background: C.card, border: `1px solid ${C.line}`, color: C.ink, fontSize: 18, fontWeight: 600, lineHeight: 1.3, padding: "8px 12px", borderRadius: "16px 16px 16px 4px" }}>
                {frame < m.at ? (
                  <span style={{ display: "inline-flex", gap: 5, padding: "6px 2px" }}>
                    {[0, 1, 2].map((d) => (
                      <span key={d} style={{ width: 7, height: 7, borderRadius: 4, background: C.muted, transform: `translateY(${-Math.max(0, Math.sin(((frame - m.from) / 8 - d * 0.35) * Math.PI)) * 4}px)` }} />
                    ))}
                  </span>
                ) : (
                  lines(m.text).map((l, li) => (
                    <div key={li}>
                      {l.map((w, wi) => {
                        k += 1;
                        const at = m.words[k];
                        if (frame < at) return null;
                        return (
                          <span key={wi} style={{ color: frame >= at + greyFrames ? C.ink : C.dim }}>
                            {w}
                            {wi < l.length - 1 ? " " : ""}
                          </span>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ padding: "8px 12px 22px", display: "flex", gap: 8 }}>
        <div style={{ flex: 1, height: 40, borderRadius: 20, background: C.card, border: `1px solid ${typing ? C.mint : C.line}`, display: "flex", alignItems: "center", padding: "0 14px", fontSize: 17, fontWeight: 600, color: typed ? C.ink : C.dim, whiteSpace: "nowrap", overflow: "hidden" }}>
          {typed || "Message"}
        </div>
      </div>
    </AbsoluteFill>
  );
}

export function PhoneChat({
  transcript,
  charFrames,
  greyFrames = 6,
  backdrop,
}: {
  transcript: ChatMessage[];
  charFrames: number;
  greyFrames?: number;
  /** What the phone sits on: the web app, blurred and dimmed, so the frame is never empty. */
  backdrop?: React.ReactNode;
}) {
  const frame = useCurrentFrame();
  const push = interpolate(frame, [0, 360], [1, 1.08], clamp);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {backdrop ? <AbsoluteFill style={{ filter: "blur(3px) brightness(0.5)", transform: "scale(1.08)" }}>{backdrop}</AbsoluteFill> : null}
      <AbsoluteFill style={{ transform: `scale(${push})` }}>
      <PhoneFrame variant="flat" entrance="rise" scale={PHONE_SCALE} floatLoop={false} theme={SORBET} mode="dark" screenColor={C.bg}>
        <Screen transcript={transcript} charFrames={charFrames} greyFrames={greyFrames} />
      </PhoneFrame>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
