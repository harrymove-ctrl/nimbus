"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import type { Workstream } from "@/lib/workstreams";
import { ROLE_COLOR, TIER_LABEL, fmtTokens, laneName, type Artifact, type RunView } from "@/lib/run-view";
import { InspectorSkeleton } from "./loading";
import { MemoryTab } from "./learning";
import { LoopView } from "./loop-view";
import { cx } from "./ui";
import type { SegRef } from "./timeline";

export type InspectorTab = "artifact" | "agent" | "memory";

type Props = {
  view: RunView;
  workstream?: Workstream;
  tab: InspectorTab;
  setTab: (t: InspectorTab) => void;
  selected: SegRef | null;
  /** artifact id + version requested from the transcript; undefined = nothing requested */
  focusArtifact?: { id: string; version: number; n: number };
  /** the run's events have not arrived yet: a sweep skeleton instead of an empty hint */
  loading?: boolean;
  className?: string;
};

const TABS: { key: InspectorTab; label: string }[] = [
  { key: "artifact", label: "Artifact" },
  { key: "agent", label: "Agent I/O" },
  { key: "memory", label: "Memory & skill" },
];

export function Inspector({ view, workstream, tab, setTab, selected, focusArtifact, loading, className }: Props) {
  return (
    <aside aria-label="Inspector" className={cx("flex min-h-0 w-full flex-col border-l border-white/10 bg-neutral-950", className)}>
      <div role="tablist" className="flex h-10 shrink-0 items-end gap-1 border-b border-white/10 px-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            data-cuelume-select=""
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cx("-mb-px h-9 border-b-2 px-2.5 text-[12px] font-extrabold uppercase tracking-wider transition-colors", tab === t.key ? "border-[var(--rb-accent)] text-neutral-100" : "border-transparent text-neutral-500 hover:text-neutral-300")}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && tab !== "memory" ? (
          <InspectorSkeleton active doc={tab === "artifact"} />
        ) : (
          <>
            {tab === "artifact" && <ArtifactTab view={view} focus={focusArtifact} />}
            {tab === "agent" && <AgentTab view={view} selected={selected} />}
          </>
        )}
        {tab === "memory" && <MemoryTab view={view} workstream={workstream} />}
      </div>
    </aside>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="grid h-full min-h-48 place-items-center px-8 text-center text-[14px] text-neutral-500">{children}</div>;
}

/* ---------- Artifact: DOC · CODE toggle, version tabs V1 · V2 · LATEST ---------- */

function ArtifactTab({ view, focus }: { view: RunView; focus?: { id: string; version: number; n: number } }) {
  const docs = view.artifacts.filter((a) => a.kind === "doc");
  const codes = view.artifacts.filter((a) => a.kind === "code");
  const [kind, setKind] = useState<"doc" | "code">("doc");
  const [ver, setVer] = useState<number | "latest">("latest");
  const [copied, setCopied] = useState(false);
  // the artifact a transcript chip opened: it stays on screen while other artifacts get new versions
  const [pinned, setPinned] = useState<string | null>(null);
  useEffect(() => setPinned(null), [view.runId]);

  const total = view.artifacts.reduce((n, a) => n + a.versions.length, 0);
  // A new version lands: show it (LATEST selected on arrival), unless it belongs to another artifact than the pinned one.
  useEffect(() => {
    const newest = [...view.transcript].reverse().find((i) => i.t === "artifact");
    if (pinned && newest?.t === "artifact" && newest.artifactId !== pinned) return;
    setVer("latest");
    // The newest version decides the view: a doc always takes focus; code only if there is no doc yet.
    if (!pinned && newest?.t === "artifact") setKind(newest.kind === "doc" ? "doc" : docs.length ? "doc" : "code");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);
  useEffect(() => {
    if (!focus) return;
    const a = view.artifacts.find((x) => x.id === focus.id);
    if (!a) return;
    const last = a.versions[a.versions.length - 1].version;
    if (a.id === pinned && (ver === "latest" ? last : ver) === focus.version) return; // already showing it
    setPinned(a.id);
    setKind(a.kind);
    setVer(focus.version === last ? "latest" : focus.version);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.n]);

  const list = kind === "doc" ? docs : codes;
  const art: Artifact | undefined = (pinned ? list.find((a) => a.id === pinned) : undefined) ?? list[list.length - 1] ?? (docs.length ? docs[docs.length - 1] : codes[codes.length - 1]);

  if (!art) return <Empty>Documents and code the crew writes appear here, with versions.</Empty>;
  const latest = art.versions[art.versions.length - 1];
  const shown = ver === "latest" ? latest : (art.versions.find((v) => v.version === ver) ?? latest);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 px-3">
        <div className="inline-flex rounded-lg bg-white/8 p-0.5" role="group" aria-label="Artifact kind">
          {(["doc", "code"] as const).map((k) => (
            <button key={k} data-cuelume-select="" disabled={(k === "doc" ? docs : codes).length === 0} aria-pressed={kind === k} onClick={() => (setKind(k), setPinned(null))} className={cx("h-7 rounded-md px-2.5 text-[11px] font-extrabold uppercase tracking-wider disabled:opacity-30", kind === k ? "bg-neutral-100 text-neutral-900" : "text-neutral-300")}>
              {k}
            </button>
          ))}
        </div>
        <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-neutral-200">{shown.title}</p>
        <button
          type="button"
          aria-label="Copy"
          data-cuelume-tap="success"
          data-cuelume-emphasis="subtle"
          onClick={() => {
            void navigator.clipboard?.writeText(shown.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          className="grid size-8 place-items-center rounded-md text-neutral-300 hover:bg-white/10"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-white/10 px-3" role="tablist" aria-label="Versions">
        {art.versions.map((v) => (
          <button key={v.version} role="tab" data-cuelume-select="" aria-selected={ver !== "latest" && shown.version === v.version} onClick={() => setVer(v.version)} className={cx("nb-pop-slow h-7 rounded-md px-2.5 text-[11px] font-extrabold", ver !== "latest" && shown.version === v.version ? "bg-white/15 text-neutral-100" : "text-neutral-400 hover:text-neutral-200")}>
            V{v.version}
          </button>
        ))}
        <button role="tab" data-cuelume-select="" aria-selected={ver === "latest"} onClick={() => setVer("latest")} className={cx("h-7 rounded-md px-2.5 text-[11px] font-extrabold", ver === "latest" ? "bg-[var(--rb-accent)] text-[var(--rb-accent-fg)]" : "text-neutral-400 hover:text-neutral-200")}>
          LATEST
        </button>
        <span className="ms-auto text-[11px] font-bold tabular-nums text-neutral-500">v{shown.version} of {latest.version}</span>
      </div>
      <div key={`${art.id}-${shown.version}`} data-demo={art.kind === "doc" ? "brief-doc" : undefined} className="nimbus-fade min-h-0 flex-1 overflow-auto">
        {art.kind === "doc" ? <Markdown text={shown.content} /> : <Code text={shown.content} />}
      </div>
    </div>
  );
}

function Code({ text }: { text: string }) {
  const lines = text.replace(/\n$/, "").split("\n");
  return (
    <pre className="min-w-max py-3 font-mono text-[13px]/[20px] text-neutral-200">
      {lines.map((l, i) => (
        <div key={i} className="flex">
          <span className="w-10 shrink-0 select-none pe-3 text-right text-neutral-600 tabular-nums">{i + 1}</span>
          <code className="whitespace-pre pe-4">{l || " "}</code>
        </div>
      ))}
    </pre>
  );
}

function inline(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) =>
    p.startsWith("**") ? (
      <strong key={i} className="font-extrabold text-neutral-50">
        {p.slice(2, -2)}
      </strong>
    ) : p.startsWith("`") ? (
      <code key={i} className="rounded bg-white/10 px-1 font-mono text-[0.9em]">
        {p.slice(1, -1)}
      </code>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    ),
  );
}

const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

function Markdown({ text }: { text: string }) {
  // consecutive "| a | b |" lines become one table (the second line, |---|---|, is the header rule)
  const blocks: (string | string[])[] = [];
  for (const l of text.split("\n")) {
    const last = blocks[blocks.length - 1];
    if (l.trim().startsWith("|")) Array.isArray(last) ? last.push(l) : blocks.push([l]);
    else blocks.push(l);
  }
  return (
    <div className="flex flex-col gap-2 px-5 py-4 text-[15px]/[24px] text-neutral-200">
      {blocks.map((l, i) => {
        if (Array.isArray(l)) {
          const [head, , ...rows] = l;
          return (
            <div key={i} className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-start text-[13px]/[19px]">
                <thead className="bg-white/5 text-neutral-300">
                  <tr>{cells(head).map((c, j) => <th key={j} className="px-2.5 py-1.5 text-start font-extrabold">{inline(c)}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((r, j) => (
                    <tr key={j} className="border-t border-white/8">{cells(r).map((c, k) => <td key={k} className="px-2.5 py-1.5 align-top">{inline(c)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (/^\d+\.\s/.test(l)) return <p key={i} className="ps-5 -indent-5">{inline(l)}</p>;
        if (l.startsWith("# ")) return <h2 key={i} className="text-[20px]/[26px] font-extrabold text-neutral-50">{inline(l.slice(2))}</h2>;
        if (l.startsWith("## ")) return <h3 key={i} className="mt-2 text-[13px] font-extrabold uppercase tracking-wider text-neutral-400">{inline(l.slice(3))}</h3>;
        if (l.startsWith("- ")) return <p key={i} className="ps-4 -indent-3">• {inline(l.slice(2))}</p>;
        if (l.trim() === "") return null;
        return <p key={i}>{inline(l)}</p>;
      })}
    </div>
  );
}

/* ---------- Agent I/O: the selected segment ---------- */

function AgentTab({ view, selected }: { view: RunView; selected: SegRef | null }) {
  const [mode, setMode] = useState<"calls" | "loop">("calls");
  const lane = view.lanes.find((l) => l.instance === selected?.instance);
  const seg = lane?.segments.find((s) => s.id === selected?.id);
  const data = useMemo(() => {
    if (!lane || !seg) return null;
    const end = seg.endMs ?? Infinity;
    return {
      calls: view.toolCalls.filter((c) => c.instance === lane.instance && c.startMs >= seg.startMs - 50 && c.startMs <= end + 50),
      usage: view.usage.filter((u) => u.instance === lane.instance && u.tMs >= seg.startMs && u.tMs <= end + 400),
    };
  }, [view.toolCalls, view.usage, lane, seg]);

  if (!lane || !seg || !data) return <Empty>Click a segment on the timeline to see that hop: its brief, tool calls, result, tokens and tier.</Empty>;
  const routed = seg.route && (seg.route.chosen !== seg.route.ceiling || seg.route.fallback);
  const tier = seg.route?.chosen ?? lane.tier;
  const toggle = (
    <div role="group" aria-label="Agent I/O view" className="flex gap-1 border-b border-white/10 px-4 py-2">
      {(["calls", "loop"] as const).map((m) => (
        <button key={m} type="button" data-cuelume-select="" aria-pressed={mode === m} onClick={() => setMode(m)} className={cx("h-7 rounded-md px-2.5 text-[11px] font-extrabold uppercase tracking-wider", mode === m ? "bg-white text-neutral-950" : "text-neutral-300 hover:bg-white/10")}>
          {m === "calls" ? "Calls" : "Loop"}
        </button>
      ))}
    </div>
  );
  if (mode === "loop")
    return (
      <>
        {toggle}
        <LoopView view={view} lane={lane} seg={seg} />
      </>
    );
  return (
    <>
      {toggle}
    <div data-demo="agent-io" className="flex flex-col gap-4 p-4">
      <div>
        <p className="flex items-center gap-2 text-[15px] font-extrabold">
          <span className="size-2.5 rounded-full" style={{ background: ROLE_COLOR[lane.role] }} />
          {laneName(lane.instance, lane.role)}
          <span className="rounded bg-white/10 px-1.5 text-[11px] font-extrabold text-neutral-200">{TIER_LABEL[tier]}</span>
        </p>
        <p className="mt-1 text-[14px] font-semibold text-neutral-300">
          {seg.label}
          {seg.failed && <span className="ms-2 text-red-300">failed</span>}
        </p>
        <p className="text-[12px] tabular-nums text-neutral-500">
          {(seg.startMs / 1000).toFixed(1)}s → {seg.endMs !== undefined ? `${(seg.endMs / 1000).toFixed(1)}s` : "running"} · {seg.kind}
        </p>
      </div>
      {seg.route && (
        <Block title={routed ? (seg.route.fallback ? "Route · fallback ↻" : "Route · below ceiling ↓") : "Route"}>
          <p className="text-[13px]/[19px] text-neutral-300">
            Chose <b>{TIER_LABEL[seg.route.chosen]}</b> (ceiling {TIER_LABEL[seg.route.ceiling]}). {seg.route.reason}.
          </p>
        </Block>
      )}
      {lane.brief && (
        <Block title="Brief">
          <p className="text-[13px]/[19px] text-neutral-300">{lane.brief}</p>
        </Block>
      )}
      {data.calls.map((c) => (
        <Block key={c.callId} title={`Tool call · ${c.tool}${c.ok === false ? " · failed" : ""}`}>
          <Pre>{typeof c.input === "string" ? c.input : JSON.stringify(c.input, null, 2)}</Pre>
          {c.output !== undefined && (
            <>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-neutral-500">Result</p>
              <Pre danger={c.ok === false}>{typeof c.output === "string" ? c.output : JSON.stringify(c.output, null, 2)}</Pre>
            </>
          )}
        </Block>
      ))}
      {data.usage.length > 0 && (
        <Block title="Tokens">
          {data.usage.map((u, i) => (
            <p key={i} className="text-[13px] tabular-nums text-neutral-300">
              {TIER_LABEL[u.tier]} · in {fmtTokens(u.in)} · out {fmtTokens(u.out)}
            </p>
          ))}
        </Block>
      )}
    </div>
    </>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 p-3">
      <h4 className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-neutral-400">{title}</h4>
      {children}
    </section>
  );
}
function Pre({ children, danger }: { children: ReactNode; danger?: boolean }) {
  return <pre className={cx("max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-neutral-900 p-2.5 font-mono text-[12px]/[18px]", danger ? "text-red-200" : "text-neutral-300")}>{children}</pre>;
}
