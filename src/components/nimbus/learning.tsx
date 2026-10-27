"use client";

// Memory & skill tab v2 (SPEC §16): what the next run will use, with the actions to change it.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Workstream } from "@/lib/workstreams";
import type { RunView } from "@/lib/run-view";
import type { Learning, LearnedMemory, LearnedRule } from "@/runtime/learning";
import { NoiseField } from "@/components/dithercn/noise-field";
import { SkillDiff } from "./transcript";
import { cx } from "./ui";

/** Anything that changes what was learned (a revert from the run summary, say) fires this so the tab reloads. */
export const LEARNING_CHANGED = "nimbus:learning";

const card = "rounded-[10px] border border-white/10 bg-white/4";
const eyebrow = "mb-2 mt-4 text-[11px] font-extrabold uppercase tracking-wider text-neutral-400";
const ghost = "rounded-md px-2 py-1 text-[11px] font-extrabold uppercase tracking-wide text-neutral-300 transition-colors hover:bg-white/10 hover:text-neutral-100 focus-visible:bg-white/10 focus-visible:text-neutral-100 disabled:pointer-events-none disabled:opacity-40";

const day = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
function ago(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-white/8 px-1 py-px font-mono text-[12px]">{children}</code>;
}

/** Collapses to nothing in 160 ms (the exit motion for a forgotten memory or a revoked rule). */
function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className={cx("grid transition-[grid-template-rows,opacity] duration-[160ms] ease-out motion-reduce:transition-none", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

export function MemoryTab({ view, workstream }: { view: RunView; workstream?: Workstream }) {
  const wsId = workstream?.id;
  const [data, setData] = useState<Learning | null>(null);
  const [failed, setFailed] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const known = useRef<{ ws?: string; ids: Set<string> }>({ ids: new Set() });
  const [showDiff, setShowDiff] = useState(false);
  const [raw, setRaw] = useState(false);
  const [reverting, setReverting] = useState(false);

  const load = useCallback(async () => {
    if (!wsId) return;
    try {
      const r = await fetch(`/api/workstreams/${wsId}/learning`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const next = (await r.json()) as Learning;
      // Rows that were not there on the last load animate in; the first load for a workstream does not.
      const prev = known.current;
      const ids = new Set(next.memories.map((m) => m.id));
      setFresh(prev.ws === wsId ? new Set([...ids].filter((id) => !prev.ids.has(id))) : new Set());
      known.current = { ws: wsId, ids };
      setData(next);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [wsId]);

  useEffect(() => {
    setData(null);
    setShowDiff(false);
    setRaw(false);
    void load();
  }, [wsId, load]);
  // The Learner finishes after run.end: reload when the summary arrives, a policy line is written, or a run ends.
  const settled = `${view.summary ? 1 : 0}|${view.policies.length}|${view.status}`;
  useEffect(() => {
    if (data) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);
  useEffect(() => {
    const on = () => void load();
    window.addEventListener(LEARNING_CHANGED, on);
    return () => window.removeEventListener(LEARNING_CHANGED, on);
  }, [load]);

  const remove = useCallback(
    async (key: string, url: string) => {
      setLeaving((s) => new Set(s).add(key));
      const [r] = await Promise.all([fetch(url, { method: "DELETE" }), new Promise((res) => setTimeout(res, 160))]);
      setLeaving((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
      if (r.ok || r.status === 404) await load();
    },
    [load],
  );

  if (!workstream) return <p className="p-4 text-[14px]/[21px] text-neutral-400">Pick a workstream to see what it has learned.</p>;
  if (failed && !data) return <p className="p-4 text-[14px]/[21px] text-neutral-400">Could not load what this workstream learned.</p>;
  if (!data) return <p className="p-4 text-[14px]/[21px] text-neutral-500">Loading…</p>;

  const { memories, rules, skill, lastLearned } = data;
  const empty = memories.length === 0 && rules.length === 0;

  return (
    <div className="relative isolate px-4 pb-6">
      {/* noise-field behind the tab: cell 2, at most 4 % ink, cleared in the middle where the text sits (SPEC §17.6) */}
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.04]" aria-hidden="true">
        <NoiseField cell={2} mask="center" maskSize={0.8} className="absolute inset-0" />
      </div>
      {/* Header strip */}
      <div className="flex h-14 items-center gap-3 border-b border-white/10">
        {empty ? (
          <p className="text-[14px]/[21px] text-neutral-300">Nothing learned yet. Run once.</p>
        ) : (
          <>
            <span aria-hidden className="text-[var(--rb-accent)]">✦</span>
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-400">Next run uses</p>
              <p className="text-[14px]/[20px] font-extrabold tabular-nums text-neutral-100">
                {plural(memories.length, "memory", "memories")} · {plural(rules.length, "rule")}
              </p>
            </div>
            {lastLearned && (
              <p className="ms-auto text-end text-[12px]/[16px] text-neutral-400">
                last learned · run {lastLearned.runNumber}
                <br />
                {ago(lastLearned.at)}
              </p>
            )}
          </>
        )}
      </div>

      {/* Rules */}
      <h4 className={eyebrow}>Rules</h4>
      {rules.length === 0 ? (
        <p className="text-[14px]/[21px] text-neutral-400">No rules. Approve &amp; always allow adds one.</p>
      ) : (
        <ul className="flex flex-col">
          {rules.map((r) => (
            <li key={r.rule}>
              <Collapse open={!leaving.has(`rule:${r.rule}`)}>
                <div className="pb-2">
                  <RuleCard rule={r} onRevoke={() => remove(`rule:${r.rule}`, `/api/workstreams/${wsId}/policies/${r.index}`)} />
                </div>
              </Collapse>
            </li>
          ))}
        </ul>
      )}

      {/* Skill */}
      <h4 className={eyebrow}>Skill</h4>
      <div className="mb-2 flex flex-wrap items-center gap-x-1 gap-y-1">
        <p className="me-auto text-[12px]/[16px] text-neutral-400">
          {skill.runNumber ? (
            <>
              Last rewrite · run {skill.runNumber} ·{" "}
              <span className="tabular-nums">
                <span className="text-emerald-300">+{skill.added}</span> <span className="text-red-300">−{skill.removed}</span>
              </span>
            </>
          ) : (
            "Not rewritten yet"
          )}
        </p>
        <button type="button" data-cuelume-toggle="" className={ghost} disabled={!skill.hasPrevious} aria-pressed={showDiff} onClick={() => setShowDiff((v) => !v)}>
          {showDiff ? "Hide diff" : "Show diff"}
        </button>
        <button type="button" data-cuelume-toggle="" className={ghost} aria-pressed={raw} onClick={() => setRaw((v) => !v)}>
          {raw ? "View cards" : "View raw"}
        </button>
        <button
          type="button"
          className={ghost}
          data-cuelume-tap=""
          disabled={!skill.hasPrevious || reverting}
          onClick={async () => {
            setReverting(true);
            const r = await fetch(`/api/workstreams/${wsId}/skill/revert`, { method: "POST" });
            setReverting(false);
            if (r.ok) {
              setShowDiff(false);
              window.dispatchEvent(new Event(LEARNING_CHANGED));
            }
          }}
        >
          {reverting ? "Reverting…" : "Revert"}
        </button>
      </div>
      {showDiff && skill.hasPrevious && (
        <div className="mb-2">
          <SkillDiff rows={skill.diff} />
        </div>
      )}
      {/* keyed by the text: a revert crossfades the cards in 120 ms */}
      <div key={skill.content} className="nb-fade">
        {raw ? <pre className={cx(card, "overflow-auto whitespace-pre-wrap p-3 font-mono text-[12px]/[18px] text-neutral-300")}>{skill.content}</pre> : <SkillCards md={skill.content} />}
      </div>

      {/* Memories */}
      <Memories memories={memories} currentRunId={view.runId} fresh={fresh} leaving={leaving} onForget={(m) => remove(`mem:${m.id}`, `/api/workstreams/${wsId}/memories/${m.id}`)} />
    </div>
  );
}

function RuleCard({ rule, onRevoke }: { rule: LearnedRule; onRevoke: () => void }) {
  const [sure, setSure] = useState(false);
  useEffect(() => {
    if (!sure) return;
    const t = setTimeout(() => setSure(false), 3000);
    return () => clearTimeout(t);
  }, [sure]);
  const m = rule.rule.match(/^allow:\s*(\w+)(?:\s+to\s+(\S+))?\s+for this workstream$/);
  const b = rule.rule.match(/^allow:\s*(\w+)\s+for branches\s+(\S+)$/);
  return (
    <div className={cx(card, "flex items-center gap-2 px-3 py-2.5")}>
      <div className="min-w-0 flex-1">
        <p className="text-[14px]/[21px] text-neutral-100">
          {b ? (
            <>
              Allow <Code>{b[1]}</Code> for branches <Code>{b[2]}</Code>
            </>
          ) : m ? (
            <>
              Allow <Code>{m[1]}</Code>
              {m[2] && (
                <>
                  {" "}
                  to <Code>{m[2]}</Code>
                </>
              )}
            </>
          ) : (
            rule.rule
          )}
        </p>
        <p className="text-[12px]/[16px] text-neutral-400">
          {rule.runNumber ? `from run ${rule.runNumber}` : "from an earlier run"}
          {rule.createdAt ? ` · ${day(rule.createdAt)}` : ""} · used {rule.usedCount}×
        </p>
      </div>
      <button
        type="button"
        className={cx(ghost, sure && "bg-red-500/15 text-red-200 hover:bg-red-500/25 hover:text-red-100")}
        {...(sure ? { "data-cuelume-close": "", "data-cuelume-emphasis": "strong" } : { "data-cuelume-tap": "", "data-cuelume-emphasis": "subtle" })}
        onClick={() => (sure ? onRevoke() : setSure(true))}
        onBlur={() => setSure(false)}
      >
        {sure ? "Revoke?" : "Revoke"}
      </button>
    </div>
  );
}

/* ---------- Skill as cards ---------- */

type Block = { kind: "p"; text: string } | { kind: "ul"; items: string[] };
type Section = { heading: string | null; blocks: Block[] };

function parseSkill(md: string): Section[] {
  const out: Section[] = [];
  let cur: Section = { heading: null, blocks: [] };
  let para: string[] = [];
  const flush = () => {
    if (para.length) cur.blocks.push({ kind: "p", text: para.join(" ") });
    para = [];
  };
  const push = () => {
    flush();
    if (cur.heading || cur.blocks.length) out.push(cur);
  };
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    const h = line.match(/^#{1,3}\s+(.*)$/);
    const li = line.match(/^(?:[-*]|\d+\.)\s+(.*)$/);
    if (h) {
      push();
      cur = { heading: h[1], blocks: [] };
    } else if (li) {
      flush();
      const last = cur.blocks[cur.blocks.length - 1];
      if (last?.kind === "ul") last.items.push(li[1]);
      else cur.blocks.push({ kind: "ul", items: [li[1]] });
    } else if (line) para.push(line);
    else flush();
  }
  push();
  return out;
}

/** `identifier` spans become monospace; nothing else in a card is. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/).map((part, i) => (part.startsWith("`") && part.endsWith("`") && part.length > 2 ? <Code key={i}>{part.slice(1, -1)}</Code> : <span key={i}>{part}</span>))}
    </>
  );
}

function SkillCards({ md }: { md: string }) {
  const sections = useMemo(() => parseSkill(md), [md]);
  if (!sections.length) return <p className="text-[14px]/[21px] text-neutral-400">This workstream has no skill text yet.</p>;
  return (
    <div className="flex flex-col gap-2">
      {sections.map((s, i) => (
        <section key={i} className={cx(card, "px-3 py-2.5")}>
          {s.heading && <h5 className="mb-1 text-[13px]/[18px] font-extrabold text-neutral-100">{s.heading}</h5>}
          {s.blocks.map((b, j) =>
            b.kind === "p" ? (
              <p key={j} className="text-[14px]/[21px] text-neutral-100 [&:not(:first-child)]:mt-1.5">
                <Inline text={b.text} />
              </p>
            ) : (
              <ul key={j} className="ms-4 list-disc text-[14px]/[21px] text-neutral-100 marker:text-neutral-500 [&:not(:first-child)]:mt-1.5">
                {b.items.map((it, k) => (
                  <li key={k}>
                    <Inline text={it} />
                  </li>
                ))}
              </ul>
            ),
          )}
        </section>
      ))}
    </div>
  );
}

/* ---------- Memories ---------- */

function Memories({ memories, currentRunId, fresh, leaving, onForget }: { memories: LearnedMemory[]; currentRunId?: string; fresh: Set<string>; leaving: Set<string>; onForget: (m: LearnedMemory) => void }) {
  const [q, setQ] = useState("");
  const shown = q.trim() ? memories.filter((m) => m.text.toLowerCase().includes(q.trim().toLowerCase())) : memories;
  return (
    <>
      <h4 className={eyebrow}>Memories · {memories.length}</h4>
      {memories.length > 8 && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter memories" aria-label="Filter memories" className="mb-2 h-9 w-full rounded-lg border border-white/10 bg-white/4 px-3 text-[14px] text-neutral-100 placeholder:text-neutral-500 focus:border-[var(--rb-accent)] focus:outline-none" />}
      {memories.length === 0 ? (
        <p className="text-[14px]/[21px] text-neutral-400">After each run the Learner saves what is worth keeping.</p>
      ) : shown.length === 0 ? (
        <p className="text-[14px]/[21px] text-neutral-400">No memory matches “{q}”.</p>
      ) : (
        <ul className="flex flex-col">
          {shown.map((m) => (
            <li key={m.id} className={fresh.has(m.id) ? "nb-rise-fast" : undefined}>
              <Collapse open={!leaving.has(`mem:${m.id}`)}>
                <div className="group flex items-start gap-2 border-b border-white/8 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px]/[20px] text-neutral-100 [overflow-wrap:anywhere]">
                      <Inline text={m.text} />
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[12px]/[16px] text-neutral-400">
                      <span>
                        run {m.runNumber || "?"} · {day(m.createdAt)} · used {m.usedCount}×
                      </span>
                      {currentRunId && m.runId === currentRunId && <span className="rounded bg-[var(--rb-accent)]/20 px-1.5 text-[10px] font-extrabold tracking-wider text-[var(--rb-accent)]">NEW</span>}
                    </p>
                  </div>
                  <button type="button" data-cuelume-close="" data-cuelume-emphasis="strong" onClick={() => onForget(m)} className={cx(ghost, "shrink-0 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100")}>
                    Forget
                  </button>
                </div>
              </Collapse>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
