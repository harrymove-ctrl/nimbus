// The three pieces the catalogue has no scene for: the OpenClaw provider card (scene 11),
// the tier grid adapted from count-grid's rush-and-settle (scene 12) and the end card (13).
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { C, MANROPE } from "./theme";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const PROVIDER = `{ "models": { "providers": {
  "nimbus": {
    "baseUrl": "https://<nebius-endpoint>/v1",
    "api": "openai-completions",
    "models": [{
      "id": "nimbus/ship-nimbus",
      "name": "Nimbus · Ship Nimbus"
    }]
  }
} } }`;

export function ProviderPanel() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shown = Math.floor(
    interpolate(frame, [6, 70], [0, PROVIDER.length], clamp),
  );
  const rise = spring({ frame, fps, config: { damping: 200 } });
  const run = spring({
    frame: frame - 78,
    fps,
    config: { damping: 18, stiffness: 140 },
  });
  const push = interpolate(frame, [0, 165], [1, 1.06], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  return (
    <AbsoluteFill
      style={{ background: C.bg, fontFamily: MANROPE, color: C.ink }}
    >
      <AbsoluteFill
        style={{
          transform: `scale(${push})`,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 56,
            alignItems: "stretch",
            opacity: rise,
            transform: `translateY(${(1 - rise) * 40}px)`,
          }}
        >
          <div
            style={{
              width: 860,
              background: C.card,
              border: `1px solid ${C.line}`,
              borderRadius: 18,
              padding: "34px 40px",
            }}
          >
            <div
              style={{
                fontSize: 24,
                color: C.muted,
                marginBottom: 22,
                fontWeight: 600,
              }}
            >
              ~/.openclaw/openclaw.json
            </div>
            <pre
              style={{
                margin: 0,
                fontFamily: MONO,
                fontSize: 27,
                lineHeight: 1.5,
                color: C.ink,
                whiteSpace: "pre",
              }}
            >
              {PROVIDER.slice(0, shown)}
              <span style={{ color: C.mint, opacity: frame % 20 < 12 ? 1 : 0 }}>
                ▍
              </span>
            </pre>
          </div>
          <div
            style={{
              width: 640,
              display: "flex",
              flexDirection: "column",
              gap: 24,
              justifyContent: "center",
            }}
          >
            {[
              ["Endpoint", "Nebius Serverless Endpoint · /v1", C.blue],
              ["Nightly", "Nebius Serverless Jobs", C.blue],
            ].map(([k, v, color], i) => {
              const s = spring({
                frame: frame - 30 - i * 10,
                fps,
                config: { damping: 200 },
              });
              return (
                <div
                  key={k}
                  style={{
                    opacity: s,
                    transform: `translateX(${(1 - s) * 40}px)`,
                    background: C.card,
                    border: `1px solid ${C.line}`,
                    borderRadius: 16,
                    padding: "24px 30px",
                  }}
                >
                  <div
                    style={{ fontSize: 22, color: C.muted, fontWeight: 600 }}
                  >
                    {k}
                  </div>
                  <div style={{ fontSize: 34, fontWeight: 700, color }}>
                    {v}
                  </div>
                </div>
              );
            })}
            <div
              style={{
                opacity: run,
                transform: `scale(${0.9 + run * 0.1})`,
                background: C.card,
                border: `2px solid ${C.mint}`,
                borderRadius: 16,
                padding: "24px 30px",
              }}
            >
              <div style={{ fontSize: 22, color: C.muted, fontWeight: 600 }}>
                New run
              </div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>
                Ship Nimbus{" "}
                <span style={{ color: C.mint }}>· trigger: chat</span>
              </div>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

const TIERS = [
  {
    name: "Nemotron 3 Ultra",
    id: "nvidia/Nemotron-3-Ultra-550b-a55b",
    role: "plans",
    color: C.mint,
  },
  {
    name: "Nemotron 3 Super",
    id: "nvidia/nemotron-3-super-120b-a12b",
    role: "does the work",
    color: C.blue,
  },
  {
    name: "Nemotron 3 Nano",
    id: "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
    role: "checks",
    color: C.orange,
  },
];

const STATS = [
  { to: 45, fmt: (n: number) => `−${Math.round(n)} %`, label: "vs baseline" },
  { to: 19, fmt: (n: number) => `${Math.round(n)}/19`, label: "goldens" },
  { to: 0.08, fmt: (n: number) => `$${n.toFixed(2)}`, label: "per run" },
];

/**
 * count-grid, adapted: the same rush under a horizontal smear that settles, on three tiles
 * instead of a grid of images, then counters that count up the way its label jumps.
 */
export function TierGrid() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pull = interpolate(frame, [40, 420], [1.04, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  return (
    <AbsoluteFill
      style={{
        background: C.bg,
        fontFamily: MANROPE,
        color: C.ink,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          transform: `scale(${pull})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 70,
        }}
      >
        <div style={{ display: "flex", gap: 36 }}>
          {TIERS.map((t, i) => {
            const s = spring({
              frame: frame - i * 5,
              fps,
              config: { damping: 16, stiffness: 120, mass: 0.8 },
            });
            const x = (1 - s) * 900;
            const smear = Math.min(24, Math.abs(1 - s) * 60);
            return (
              <div
                key={t.name}
                style={{
                  width: 520,
                  height: 300,
                  padding: "38px 40px",
                  borderRadius: 22,
                  background: C.card,
                  border: `1px solid ${C.line}`,
                  boxShadow: `inset 0 3px 0 ${t.color}`,
                  transform: `translateX(${x}px)`,
                  filter: smear > 0.5 ? `blur(${smear}px)` : undefined,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 700,
                    color: t.color,
                    letterSpacing: "0.02em",
                    textTransform: "uppercase",
                  }}
                >
                  {t.role}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 46,
                      fontWeight: 800,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {t.name}
                  </div>
                  <div
                    style={{
                      fontFamily: MONO,
                      fontSize: 20,
                      color: C.muted,
                      marginTop: 10,
                    }}
                  >
                    {t.id}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 120 }}>
          {STATS.map((st, i) => {
            const start = 60 + i * 24;
            const p = interpolate(frame, [start, start + 40], [0, 1], {
              ...clamp,
              easing: Easing.out(Easing.cubic),
            });
            return (
              <div
                key={st.label}
                style={{
                  textAlign: "center",
                  opacity: interpolate(
                    frame,
                    [start - 6, start + 6],
                    [0, 1],
                    clamp,
                  ),
                }}
              >
                <div
                  style={{
                    fontSize: 96,
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {st.fmt(st.to * p)}
                </div>
                <div style={{ fontSize: 28, color: C.muted, fontWeight: 600 }}>
                  {st.label}
                </div>
              </div>
            );
          })}
        </div>
        <div
          style={{
            fontSize: 26,
            color: C.muted,
            fontWeight: 600,
            opacity: interpolate(frame, [150, 170], [0, 1], clamp),
          }}
        >
          Every call through{" "}
          <span style={{ color: C.blue }}>Nebius Token Factory</span>
        </div>
      </div>
    </AbsoluteFill>
  );
}

export function EndCard() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 200 } });
  const push = interpolate(frame, [0, 120], [1, 1.04], clamp);
  return (
    <AbsoluteFill
      style={{
        background: C.bg,
        fontFamily: MANROPE,
        color: C.ink,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{ transform: `scale(${push})`, opacity: s, textAlign: "center" }}
      >
        <div
          style={{ fontSize: 132, fontWeight: 800, letterSpacing: "-0.04em" }}
        >
          Nimbus<span style={{ color: C.mint }}>.</span>
        </div>
        <div style={{ fontSize: 40, fontWeight: 600, marginTop: 18 }}>
          github.com/harrymove-ctrl/nimbus
        </div>
        <div
          style={{
            fontSize: 28,
            color: C.muted,
            marginTop: 22,
            fontWeight: 600,
          }}
        >
          MIT · built on{" "}
          <span style={{ color: C.blue }}>Nebius Token Factory</span> with{" "}
          <span style={{ color: C.mint }}>NVIDIA Nemotron</span>
        </div>
      </div>
    </AbsoluteFill>
  );
}
