// Agent Chat (scene 12), written from the board's description: the prompt types into a
// compose field as the camera pushes in; the message becomes a bubble; an avatar and typing
// dots arrive; the reply streams a word at a time, each word grey for a moment before it
// sets. Only the typing rate is chosen; every later beat derives from it (`chatSchedule`).
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { C, CLOUD, MANROPE } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export type ChatMessage = { role: "user" | "assistant"; text: string };

type Scheduled = ChatMessage & {
  /** user: typing starts. assistant: typing dots start. */
  from: number;
  /** user: the bubble appears (sent). assistant: the first word appears. */
  at: number;
  /** assistant: the frame each word appears. */
  words: number[];
  end: number;
};

export const wordsOf = (text: string) => text.split(/\s+/).filter(Boolean);
export const lines = (text: string) => text.split("\n").map(wordsOf).filter((l) => l.length > 0);

/** Lays the transcript on one clock derived from `charFrames`. */
export function chatSchedule(messages: ChatMessage[], charFrames = 2, start = 20) {
  const send = 2 * charFrames; // a beat between the last key and the bubble
  const dots = 9 * charFrames; // typing dots before a reply
  const word = 1.5 * charFrames; // reply words stream faster than typing
  const between = 4 * charFrames;
  let t = start;
  const out: Scheduled[] = [];
  messages.forEach((m, i) => {
    if (m.role === "user") {
      const at = t + m.text.length * charFrames + send;
      out.push({ ...m, from: t, at, words: [], end: at });
      t = at + 3 * charFrames;
    } else {
      const follows = messages[i - 1]?.role === "assistant";
      const from = t;
      const at = from + (follows ? dots / 2 : dots);
      const n = wordsOf(m.text).length;
      const words = Array.from({ length: n }, (_, k) => Math.round(at + k * word));
      const end = Math.round(at + n * word);
      out.push({ ...m, from, at, words, end });
      t = end + between;
    }
  });
  return { messages: out, end: t };
}

/** The typing rate that makes the transcript end `hold` frames before the scene does. */
export function fitCharFrames(messages: ChatMessage[], frames: number, hold = 45) {
  const e1 = chatSchedule(messages, 1).end;
  const e2 = chatSchedule(messages, 2).end;
  return 1 + (frames - hold - e1) / (e2 - e1);
}

/** Sound cues inside the scene: key ticks, send, dots, a pop per streamed line, chime on ✓. */
export function chatCues(messages: ChatMessage[], charFrames = 2) {
  const s = chatSchedule(messages, charFrames);
  const keys: number[] = [];
  const sends: number[] = [];
  const dots: number[] = [];
  const pops: number[] = [];
  const chimes: number[] = [];
  for (const m of s.messages) {
    if (m.role === "user") {
      for (let f = m.from; f < m.at - 2 * charFrames; f += charFrames * 2) keys.push(Math.round(f));
      sends.push(m.at);
    } else {
      dots.push(m.from);
      let k = 0;
      for (const l of lines(m.text)) {
        const at = m.words[k];
        if (l.some((w) => w.includes("✓")) || /^(Approved|Sent)\b/.test(l[0])) chimes.push(at);
        else pops.push(at);
        k += l.length;
      }
    }
  }
  return { keys, sends, dots, pops, chimes };
}

function Avatar() {
  return (
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: 28,
        background: CLOUD.blue,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg width={36} height={36} viewBox="0 0 100 100">
        <path d="M27 74a17 17 0 0 1-3-34 25 25 0 0 1 48-5 20 20 0 0 1 3 39z" fill={C.ink} />
        <circle cx="42" cy="54" r="5" fill={CLOUD.blue} />
        <circle cx="60" cy="54" r="5" fill={CLOUD.blue} />
      </svg>
    </div>
  );
}

export function AgentChat({
  transcript,
  charFrames = 2,
  greyFrames = 6,
}: {
  transcript: ChatMessage[];
  charFrames?: number;
  greyFrames?: number;
}) {
  const frame = useCurrentFrame();
  const { messages } = chatSchedule(transcript, charFrames);

  // The field: whatever the user is typing now.
  const typing = messages.find((m) => m.role === "user" && frame >= m.from && frame < m.at);
  const typed = typing
    ? typing.text.slice(0, Math.min(typing.text.length, Math.floor((frame - typing.from) / charFrames)))
    : "";

  // Push in on the field while typing, pull back while replies stream.
  let push = 0;
  for (const m of messages) {
    if (m.role !== "user") continue;
    const w = Math.min(
      interpolate(frame, [m.from - 10, m.from], [0, 1], clamp),
      interpolate(frame, [m.at, m.at + 14], [1, 0], clamp),
    );
    push = Math.max(push, w);
  }
  const ease = Easing.inOut(Easing.cubic)(push);
  const zoom = 1 + 0.16 * ease;

  const shown = messages.filter((m) => frame >= (m.role === "user" ? m.at : m.from));
  const W = 1600;

  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: MANROPE }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: "50% 86%" }}>
        <div
          style={{
            position: "absolute",
            left: 960 - W / 2,
            top: 40,
            width: W,
            height: 1000,
            borderRadius: 32,
            background: C.card,
            border: `1px solid ${C.line}`,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "26px 34px", borderBottom: `1px solid ${C.line}` }}>
            <Avatar />
            <div>
              <div style={{ color: C.ink, fontSize: 36, fontWeight: 700 }}>Nimbus</div>
              <div style={{ color: C.muted, fontSize: 28, fontWeight: 500 }}>your crew · always on</div>
            </div>
          </div>

          {/* Messages, anchored to the bottom so older ones scroll off the top. */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 22, padding: "24px 34px", overflow: "hidden" }}>
            {shown.map((m, i) => {
              if (m.role === "user") {
                const p = interpolate(frame, [m.at, m.at + 6], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.4)) });
                return (
                  <div key={i} style={{ alignSelf: "flex-end", transform: `scale(${0.85 + 0.15 * p})`, transformOrigin: "right bottom", opacity: p }}>
                    <div style={{ background: C.mint, color: C.bg, fontSize: 42, fontWeight: 600, padding: "16px 28px", borderRadius: "28px 28px 8px 28px" }}>
                      {m.text}
                    </div>
                  </div>
                );
              }
              const dotsOn = frame < m.at;
              const ls = lines(m.text);
              let k = -1;
              return (
                <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-end", alignSelf: "flex-start", maxWidth: 1380 }}>
                  <Avatar />
                  <div style={{ background: C.card, color: C.ink, fontSize: 38, fontWeight: 600, lineHeight: 1.4, padding: "16px 26px", borderRadius: "26px 26px 26px 8px", border: `1px solid ${C.line}` }}>
                    {dotsOn ? (
                      <span style={{ display: "inline-flex", gap: 10, padding: "10px 4px" }}>
                        {[0, 1, 2].map((d) => (
                          <span
                            key={d}
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: 6,
                              background: C.muted,
                              transform: `translateY(${-Math.max(0, Math.sin(((frame - m.from) / 8 - d * 0.35) * Math.PI)) * 8}px)`,
                            }}
                          />
                        ))}
                      </span>
                    ) : (
                      ls.map((l, li) => (
                        <div key={li}>
                          {l.map((w, wi) => {
                            k += 1;
                            const at = m.words[k];
                            if (frame < at) return null;
                            const set = frame >= at + greyFrames;
                            return (
                              <span key={wi} style={{ color: w === "✓" ? C.mint : set ? C.ink : C.dim }}>
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

          {/* The compose field. */}
          <div style={{ padding: "22px 30px 30px", borderTop: `1px solid ${C.line}`, display: "flex", gap: 18, alignItems: "center" }}>
            <div
              style={{
                flex: 1,
                height: 76,
                borderRadius: 38,
                background: C.card,
                border: `1px solid ${typing ? C.mint : C.line}`,
                display: "flex",
                alignItems: "center",
                padding: "0 30px",
                fontSize: 40,
                fontWeight: 600,
                color: typed ? C.ink : C.dim,
                overflow: "hidden",
                whiteSpace: "nowrap",
                maskImage: "linear-gradient(to right, transparent 0, black 28px)",
              }}
            >
              {typed || "Message Nimbus"}
              {typing ? <span style={{ width: 3, height: 38, background: C.mint, marginLeft: 3, opacity: frame % 16 < 9 ? 1 : 0 }} /> : null}
            </div>
            <div style={{ width: 76, height: 76, borderRadius: 38, background: typed ? C.mint : C.line, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width={34} height={34} viewBox="-20 -20 40 40">
                <path d="M -12 0 L 12 0 M 2 -10 L 12 0 L 2 10" stroke={typed ? C.bg : C.muted} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" transform="rotate(-90)" />
              </svg>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
