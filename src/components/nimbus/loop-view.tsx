"use client";

// Agent loop (docs/SPEC.md §17.4): the hop as a circle of three stations, Gather context → Take action → Verify, with the
// model in the middle and a loop count. A failed tool call is a loop that ends at Verify and sends the agent back to Take
// action as a Retry; the Analyst's wrong-flag run_code in Ship Nimbus is exactly that. Under the circle: the card for the
// station, and a transport (Pause · Step · Replay at 0.5× 1× 2×). On the right, what the hop was given.
import { useEffect, useMemo, useState } from "react";
import { Pause, Play, StepForward } from "lucide-react";
import { ROLE_COLOR, TIER_LABEL, TIER_SHORT, fmtTokens, laneName, type Lane, type RunView, type Seg, type ToolCall } from "@/lib/run-view";
import { cx } from "./ui";

const STATIONS = [
  { key: "gather", label: "Gather context", angle: -90 },
  { key: "act", label: "Take action", angle: 30 },
  { key: "verify", label: "Verify", angle: 150 },
] as const;
const CONTROL = new Set(["plan", "spawn_agents", "handoff", "finish", "request_approval", "ask_user"]);
const RED = "oklch(0.68 0.21 25)";
const short = (v: unknown, n = 220) => {
  const t = typeof v === "string" ? v : JSON.stringify(v, null, 1);
  return t.length > n ? `${t.slice(0, n)}…` : t;
};
const errorOf = (c: ToolCall) => {
  const o = c.output as { stderr?: string; error?: string; stdout?: string } | string | undefined;
  if (typeof o === "string") return o.trim().split("\n")[0].slice(0, 140);
  // the exception is the last line of a traceback; for anything else the first line says it
  const text = (o?.stderr || o?.error || o?.stdout || "the tool reported a failure").trim().split("\n").filter(Boolean);
  return (o?.stderr ? text[text.length - 1] : text[0]).slice(0, 140);
};

type Loop = { n: number; call?: ToolCall; retryOf?: ToolCall };

export function buildLoops(view: RunView, lane: Lane): Loop[] {
  const calls = view.toolCalls.filter((c) => c.instance === lane.instance && !CONTROL.has(c.tool));
  if (!calls.length) return [{ n: 1 }];
  return calls.map((c, i) => ({ n: i + 1, call: c, retryOf: i > 0 && calls[i - 1].ok === false ? calls[i - 1] : undefined }));
}

/** Where a selected segment sits in the loops: the tool segment is its loop's Take action; a thinking hop leads into one. */
function startPos(loops: Loop[], seg: Seg | undefined) {
  if (!seg) return { loop: 0, station: 0 };
  const byTool = loops.findIndex((l) => l.call && seg.kind === "tool" && Math.abs(l.call.startMs - seg.startMs) < 120);
  if (byTool >= 0) return { loop: byTool, station: 1 };
  const next = loops.findIndex((l) => l.call && l.call.startMs >= (seg.endMs ?? seg.startMs) - 60);
  return { loop: Math.max(0, next), station: 0 };
}

export function LoopView({ view, lane, seg }: { view: RunView; lane: Lane; seg?: Seg }) {
  const loops = useMemo(() => buildLoops(view, lane), [view, lane]);
  const start = useMemo(() => startPos(loops, seg), [loops, seg]);
  const [pos, setPos] = useState(start);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<0.5 | 1 | 2>(1);
  useEffect(() => {
    setPos(start);
    setPlaying(false);
  }, [start.loop, start.station, lane.instance, seg?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const advance = () =>
    setPos((p) => {
      if (p.station < 2) return { loop: p.loop, station: p.station + 1 };
      if (p.loop < loops.length - 1) return { loop: p.loop + 1, station: 0 };
      setPlaying(false);
      return p;
    });
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(advance, 1000 / speed);
    return () => clearInterval(t);
  }); // re-armed on every render: the interval always sees the current loops and speed

  const loop = loops[pos.loop] ?? loops[0];
  const failed = loop.call?.ok === false;
  const tier = seg?.route?.chosen ?? lane.tier;
  const usage = view.usage.filter((u) => u.instance === lane.instance);
  const inTokens = usage.reduce((n, u) => n + u.in, 0);
  const prior = loops.slice(0, pos.loop).reduce((n, l) => n + (l.call?.output === undefined ? 0 : short(l.call.output, 4000).length), 0);
  const ctx = [
    { label: "Role prompt", tokens: 120, est: true },
    { label: "Brief", tokens: Math.round((lane.brief?.length ?? 0) / 4), est: true },
    ...(view.learned && lane.instance === "orchestrator" ? [{ label: `Learned: ${view.learned.memories} memories · ${view.learned.policies} rules`, tokens: view.learned.memories * 30 + view.learned.policies * 15, est: true }] : []),
    ...(pos.loop > 0 ? [{ label: `Results of ${pos.loop} earlier call${pos.loop > 1 ? "s" : ""}`, tokens: Math.round(prior / 4), est: true }] : []),
  ];

  const R = 62;
  const C = { x: 100, y: 88 };
  const at = (deg: number, r = R) => ({ x: C.x + r * Math.cos((deg * Math.PI) / 180), y: C.y + r * Math.sin((deg * Math.PI) / 180) });
  const arc = (a: number, b: number) => {
    const p = at(a + 24), q = at(b - 24);
    return `M ${p.x} ${p.y} A ${R} ${R} 0 0 1 ${q.x} ${q.y}`;
  };

  const card = (() => {
    if (pos.station === 0)
      return loop.retryOf ? { title: `Retry · ${errorOf(loop.retryOf)}`, body: `Gathering what it needs to try again after ${loop.retryOf.tool} failed.`, bad: true } : { title: "Gather context", body: lane.brief ?? "The agent reads its brief, the workstream's SKILL.md and the memories it was given." };
    if (pos.station === 1)
      return loop.call ? { title: `Take action · ${loop.call.tool}`, body: short(loop.call.input) } : { title: "Take action", body: "No tool this time: the agent answered from what it had gathered." };
    return loop.call ? (failed ? { title: "Verify · ✗ failed", body: errorOf(loop.call), bad: true } : { title: "Verify · ✓ passed", body: short(loop.call.output ?? "ok") }) : { title: "Verify", body: "The agent checked its answer against the brief and reported." };
  })();

  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="flex items-center gap-2 text-[15px] font-extrabold">
        <span className="size-2.5 rounded-full" style={{ background: ROLE_COLOR[lane.role] }} />
        {laneName(lane.instance, lane.role)}
        <span className="rounded bg-white/10 px-1.5 text-[11px] font-extrabold text-neutral-200">{TIER_LABEL[tier]}</span>
        <span className="ms-auto text-[12px] font-bold tabular-nums text-neutral-400">
          Loop {pos.loop + 1} of {loops.length}
        </span>
      </p>

      <div className="grid grid-cols-[200px_minmax(0,1fr)] items-start gap-3">
        <svg viewBox="0 0 200 176" width="200" height="176" role="img" aria-label={`Loop ${pos.loop + 1} of ${loops.length}, station ${STATIONS[pos.station].label}`}>
          <defs>
            <marker id="loop-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
            </marker>
          </defs>
          {STATIONS.map((s, i) => (
            <path key={s.key} d={arc(s.angle, STATIONS[(i + 1) % 3].angle + (i === 2 ? 360 : 0))} fill="none" stroke="white" strokeOpacity={0.25} strokeWidth={1.5} markerEnd="url(#loop-arrow)" className="text-white/40" />
          ))}
          {loop.retryOf && <path d={`M ${at(150, R + 12).x} ${at(150, R + 12).y} Q ${C.x} ${C.y + 78} ${at(30, R + 12).x} ${at(30, R + 12).y}`} fill="none" stroke={RED} strokeWidth={1.25} strokeDasharray="3 3" opacity={0.7} />}
          {STATIONS.map((s, i) => {
            const p = at(s.angle);
            const active = pos.station === i;
            const bad = i === 2 && failed;
            return (
              <g key={s.key}>
                <circle cx={p.x} cy={p.y} r={active ? 17 : 14} fill={active ? (bad ? RED : ROLE_COLOR[lane.role]) : "var(--color-neutral-900)"} stroke={bad ? RED : "white"} strokeOpacity={active ? 1 : 0.35} strokeWidth={active ? 2 : 1.25} className="transition-all duration-200" />
                <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={11} fontWeight={800} fill={active ? "oklch(0.2 0.01 285)" : "white"} className="pointer-events-none select-none">
                  {bad ? "✕" : i + 1}
                </text>
                <text x={p.x} y={i === 0 ? p.y - 22 : p.y + 30} textAnchor="middle" fontSize={10} fontWeight={700} fill="white" opacity={active ? 0.95 : 0.55}>
                  {s.label}
                </text>
              </g>
            );
          })}
          <text x={C.x} y={C.y - 2} textAnchor="middle" fontSize={13} fontWeight={800} fill="white">
            {TIER_SHORT[tier]}
          </text>
          <text x={C.x} y={C.y + 12} textAnchor="middle" fontSize={9} fontWeight={600} fill="white" opacity={0.55}>
            Nemotron 3
          </text>
        </svg>

        <div className="min-w-0 text-[12px]" aria-label="Context given to this hop">
          <p className="mb-1 text-[11px] font-extrabold uppercase tracking-wider text-neutral-400">Context</p>
          <ul className="flex flex-col gap-1">
            {ctx.map((c) => (
              <li key={c.label} className="flex items-baseline gap-2 text-neutral-300">
                <span className="min-w-0 flex-1 truncate">{c.label}</span>
                <span className="shrink-0 tabular-nums text-neutral-500">~{fmtTokens(c.tokens)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 border-t border-white/10 pt-1.5 tabular-nums text-neutral-300">
            In total (measured) <b>{inTokens ? fmtTokens(inTokens) : "n/a"}</b> tokens
          </p>
          <p className="mt-1 text-[11px] text-neutral-500">~ is estimated from text length.</p>
        </div>
      </div>

      <section className={cx("rounded-xl border p-3", card.bad ? "border-red-400/40 bg-red-500/8" : "border-white/10")}>
        <h4 className={cx("mb-1 text-[11px] font-extrabold uppercase tracking-wider", card.bad ? "text-red-200" : "text-neutral-400")}>{card.title}</h4>
        <pre className="max-h-44 overflow-auto whitespace-pre-wrap font-mono text-[12px]/[18px] text-neutral-200">{card.body}</pre>
      </section>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Loop transport">
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex h-8 items-center gap-1.5 rounded-md border border-white/12 px-2.5 text-[12px] font-extrabold hover:bg-white/8">
          {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          {playing ? "Pause" : "Play"}
        </button>
        <button type="button" onClick={advance} className="flex h-8 items-center gap-1.5 rounded-md border border-white/12 px-2.5 text-[12px] font-extrabold hover:bg-white/8">
          <StepForward className="size-3.5" />
          Step
        </button>
        <button
          type="button"
          onClick={() => (setPos({ loop: 0, station: 0 }), setPlaying(true))}
          className="h-8 rounded-md border border-white/12 px-2.5 text-[12px] font-extrabold hover:bg-white/8"
        >
          Replay
        </button>
        <span className="ms-auto flex gap-1">
          {([0.5, 1, 2] as const).map((s) => (
            <button key={s} type="button" aria-pressed={speed === s} onClick={() => setSpeed(s)} className={cx("h-8 rounded-md px-2 text-[12px] font-extrabold tabular-nums", speed === s ? "bg-white text-neutral-950" : "border border-white/12 hover:bg-white/8")}>
              {s}×
            </button>
          ))}
        </span>
      </div>
    </div>
  );
}
