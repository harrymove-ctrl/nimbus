import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TextHighlight, type TextHighlightPreset } from "@/components/snap-cn/text-highlight";
import { NUMBERS } from "../numbers";
import { C, GROUND, MANROPE, manropeReady, SORBET } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Scenes that measure their own type (orb-swarm's canvas, text-highlight's spans) measure it
// once; mount them only after Manrope is in, or they size for the fallback face.
export function FontGate({ children }: { children: React.ReactNode }) {
  const [handle] = useState(() => delayRender("Manrope"));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    manropeReady().then(() => {
      setReady(true);
      continueRender(handle);
    });
  }, [handle]);
  return ready ? <>{children}</> : null;
}

/** A slow push, so a settled card never sits as a frozen frame. */
export function Drift({ to = 1.05, children }: { to?: number; children: React.ReactNode }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [1, to], clamp);
  return <AbsoluteFill style={{ transform: `scale(${scale})` }}>{children}</AbsoluteFill>;
}

export type Emphasis = {
  before?: string;
  highlight: string;
  after?: string;
  preset: TextHighlightPreset;
  replaceWith?: string;
  /** Frame the effect starts, inside the card. */
  at?: number;
};

/** Words on neutral-950: an optional chapter number, one emphasised line, more lines under it. */
export function Card({
  chapter,
  line,
  more = [],
  size = 88,
  mock = false,
}: {
  chapter?: string;
  line: Emphasis;
  more?: string[];
  size?: number;
  mock?: boolean;
}) {
  const frame = useCurrentFrame();
  const rise = interpolate(frame, [0, 8], [12, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  const fade = interpolate(frame, [0, 8], [0, 1], clamp);
  const lineH = size * 1.25;
  return (
    <AbsoluteFill style={{ background: GROUND, fontFamily: MANROPE }}>
      <Drift to={1.1}>
        <AbsoluteFill style={{ opacity: fade, transform: `translateY(${rise}px)` }}>
          {chapter ? (
            <div
              style={{
                position: "absolute",
                top: `calc(50% - ${lineH / 2 + 64}px)`,
                width: "100%",
                textAlign: "center",
                color: C.mint,
                fontSize: 28,
                fontWeight: 600,
              }}
            >
              {chapter}
            </div>
          ) : null}
          <TextHighlight
            before={line.before}
            highlight={line.highlight}
            after={line.after}
            preset={line.preset}
            replaceWith={line.replaceWith}
            startAt={line.at ?? 16}
            drawDuration={18}
            fontSize={size}
            fontWeight={700}
            fontFamily={MANROPE}
            baseColor={C.ink}
            accentColor={C.mint}
            highlightedTextColor={line.preset === "marker" ? C.bg : undefined}
            theme={SORBET}
            mode="dark"
          />
          {more.map((m, i) => {
            const at = 40 + i * 15;
            return (
              <div
                key={m}
                style={{
                  position: "absolute",
                  top: `calc(50% + ${lineH / 2 + 24 + i * 56}px)`,
                  width: "100%",
                  textAlign: "center",
                  color: C.muted,
                  fontSize: 44,
                  fontWeight: 600,
                  opacity: interpolate(frame, [at, at + 8], [0, 1], clamp),
                  transform: `translateY(${interpolate(frame, [at, at + 8], [10, 0], clamp)}px)`,
                }}
              >
                {m}
              </div>
            );
          })}
        </AbsoluteFill>
      </Drift>
      {mock ? <MockTag /> : null}
    </AbsoluteFill>
  );
}

/** Marks numbers from the mock-mode run, until NUMBERS.measured is true. */
export function MockTag() {
  if (NUMBERS.measured) return null;
  return (
    <div
      style={{
        position: "absolute",
        right: 48,
        bottom: 40,
        fontFamily: MANROPE,
        fontSize: 22,
        fontWeight: 600,
        color: C.muted,
        border: `1px solid ${C.line}`,
        borderRadius: 999,
        padding: "6px 16px",
      }}
    >
      mock run · numbers from the demo fixtures
    </div>
  );
}

/**
 * A footage label: a soft card over a dimmed bottom-left corner (no caption band). In on
 * `from` with a 12 px rise over 8 frames, out by `to`.
 */
export function FootageLabel({ text, from, to }: { text: string; from: number; to: number }) {
  const frame = useCurrentFrame();
  const inP = interpolate(frame, [from, from + 8], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const outP = interpolate(frame, [to - 6, to], [1, 0], clamp);
  const o = Math.min(inP, outP);
  if (o <= 0) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          opacity: o,
          background:
            `radial-gradient(ellipse 70% 60% at 0% 100%, color-mix(in oklch, ${C.bg} 82%, transparent), transparent 70%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 72,
          bottom: 72,
          maxWidth: 860,
          opacity: o,
          transform: `translateY(${(1 - inP) * 12}px)`,
          background: `color-mix(in oklch, ${C.card} 90%, transparent)`,
          border: `1px solid ${C.line}`,
          borderRadius: 16,
          padding: "22px 30px",
          fontFamily: MANROPE,
          fontSize: 32,
          fontWeight: 600,
          lineHeight: 1.3,
          color: C.ink,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
}
