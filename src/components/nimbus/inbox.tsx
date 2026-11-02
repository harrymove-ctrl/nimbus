"use client";

// The Conversations inbox (docs/CONVERSATION.md C0): every run across workstreams and doors in one list, newest first,
// the ones that need you on top. Filter chips with counts, a search box (`/` focuses it), ↑ ↓ Enter to open a row.
// Reads GET /api/conversations every 10 s while the tab is visible. An empty inbox offers five starter prompts.
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Clock, Globe, MessageSquare, Search, Send, Terminal, type LucideIcon } from "lucide-react";
import { fmtCost } from "@/lib/run-view";
import type { Conversation, ConversationFilter, Conversations, Door } from "@/runtime/conversations";
import { cx } from "./ui";

const POLL_MS = 10_000;

const DOOR: Record<Door, { icon: LucideIcon; label: string }> = {
  web: { icon: Globe, label: "Started on the web" },
  schedule: { icon: Clock, label: "Started by its schedule" },
  telegram: { icon: Send, label: "From Telegram" },
  chat: { icon: MessageSquare, label: "From a chat app" },
  terminal: { icon: Terminal, label: "From the terminal" },
  api: { icon: Terminal, label: "From the API" },
};

const CHIPS: { key: ConversationFilter; label: string }[] = [
  { key: "needs", label: "Needs you" },
  { key: "scheduled", label: "Scheduled" },
  { key: "phone", label: "From my phone" },
  { key: "all", label: "All" },
];

/** The "Starter prompts" table in docs/CONVERSATION.md; a card opens the New workstream sheet with these filled in. */
export const STARTERS: { title: string; goal: string; tools: string[] }[] = [
  { title: "School emails tonight", goal: "Every evening read the school emails and tell me what to pack, wear, sign or pay tomorrow, with deadlines.", tools: ["fetch_url", "write_artifact"] },
  { title: "Price watch", goal: "Check these pages every morning and only tell me if the price drops more than 10 %.", tools: ["fetch_url", "run_code"] },
  { title: "Renewals and subscriptions", goal: "Find renewal emails, list service, date and cost, and ask me before cancelling anything.", tools: ["write_artifact", "send_message"] },
  { title: "Contract check", goal: "Read this contract and flag auto-renewals, liability and anything unusual before I sign.", tools: ["run_code", "write_artifact"] },
  { title: "Refund claim", goal: "Gather the facts on my delayed flight, check the rules, and draft the claim for my OK.", tools: ["web_search", "fetch_url", "write_artifact"] },
];

/** "now", "4 min", "3 h", "2 d", then "Oct 29" */
function rel(ms: number, now: number) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86_400) return `${Math.round(s / 3600)} h`;
  if (s < 7 * 86_400) return `${Math.round(s / 86_400)} d`;
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** The needs count for the rail badge, read every 15 s while the tab is visible (the open inbox sets it sooner). */
export function useInboxNeeds(enabled = true) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/conversations?filter=needs", { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<Conversations>) : null))
        .then((d) => d && alive && setN(d.counts.needs))
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 15_000);
    document.addEventListener("visibilitychange", load);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", load);
    };
  }, [enabled]);
  return [n, setN] as const;
}

export function Inbox({ onOpen, onStarter, onNeeds, phone = false }: { onOpen: (workstreamId: string, runId: string) => void; onStarter: (s: (typeof STARTERS)[number]) => void; /** the needs count, each time it is read (the rail badge) */ onNeeds?: (n: number) => void; phone?: boolean }) {
  const [filter, setFilter] = useState<ConversationFilter>("all");
  const [q, setQ] = useState("");
  const [data, setData] = useState<Conversations | null>(null);
  const [failed, setFailed] = useState(false);
  const [at, setAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  const seq = useRef(0);

  const load = useCallback(() => {
    const n = ++seq.current;
    const p = new URLSearchParams({ filter });
    if (q.trim()) p.set("q", q.trim());
    fetch(`/api/conversations?${p}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Conversations>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (n !== seq.current) return; // a newer filter or search already asked
        setData(d);
        setFailed(false);
        setNow(Date.now());
        if (!q.trim()) onNeeds?.(d.counts.needs);
      })
      .catch(() => n === seq.current && setFailed(true));
  }, [filter, q, onNeeds]);

  // a search waits for a 200 ms pause in typing; a filter change loads at once
  useEffect(() => {
    const t = setTimeout(load, q ? 200 : 0);
    return () => clearTimeout(t);
  }, [load, q]);
  useEffect(() => {
    const tick = () => document.visibilityState === "visible" && load();
    const t = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => (clearInterval(t), document.removeEventListener("visibilitychange", tick));
  }, [load]);
  useEffect(() => setAt(0), [filter, q]);

  // `/` focuses the search from anywhere on the page, unless you are typing somewhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      search.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const rows = data?.rows ?? [];
  const move = (d: number) => {
    if (!rows.length) return;
    const next = Math.min(rows.length - 1, Math.max(0, at + d));
    setAt(next);
    list.current?.querySelectorAll("li")[next]?.scrollIntoView({ block: "nearest" });
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (e.currentTarget === search.current) list.current?.focus();
      move(e.key === "ArrowDown" ? (e.currentTarget === search.current ? 0 : 1) : -1);
    } else if (e.key === "Enter" && rows[at]) {
      e.preventDefault();
      onOpen(rows[at].workstreamId, rows[at].runId);
    } else if (e.key === "Escape" && e.currentTarget === search.current && q) {
      e.preventDefault();
      setQ("");
    }
  };

  const nothingYet = !!data && data.counts.all === 0 && !q.trim();

  return (
    <div className="relative isolate flex min-h-0 flex-1 flex-col">
      <div className={cx("mx-auto flex w-full max-w-[880px] shrink-0 flex-col gap-3 pt-5", phone ? "px-4" : "px-5")}>
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-[22px] font-extrabold">Inbox</h1>
          <p className="hidden text-[13px] text-neutral-400 sm:block">Every conversation, from every door</p>
          <span className="flex-1" />
          <label className="relative flex h-9 w-full items-center sm:w-[260px]">
            <Search className="pointer-events-none absolute start-2.5 size-4 text-neutral-500" aria-hidden="true" />
            <input
              ref={search}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              aria-label="Search conversations"
              aria-controls={listId}
              placeholder="Search goals, messages, docs"
              maxLength={200}
              className="h-9 w-full rounded-lg border border-white/12 bg-neutral-950/60 ps-8 pe-8 text-[14px] text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-white/30 [&::-webkit-search-cancel-button]:hidden"
            />
            {!q && <kbd className="pointer-events-none absolute end-2 hidden rounded border border-white/15 px-1.5 text-[11px] font-bold text-neutral-500 sm:block">/</kbd>}
          </label>
        </header>
        <div role="group" aria-label="Show" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {CHIPS.map((c) => {
            const on = filter === c.key;
            const n = data?.counts[c.key];
            return (
              <button key={c.key} type="button" aria-pressed={on} data-cuelume-select="" onClick={() => setFilter(c.key)} className={cx("flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rb-accent)]", on ? "border-transparent bg-white/14 text-neutral-50" : "border-white/12 text-neutral-300 hover:bg-white/8")}>
                {c.label}
                {n !== undefined && <span className={cx("min-w-5 rounded-full px-1.5 text-center text-[11px] font-extrabold tabular-nums", c.key === "needs" && n > 0 ? "bg-[var(--rb-accent)] text-[var(--rb-accent-fg)]" : "bg-white/10 text-neutral-300")}>{n}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={cx("mx-auto w-full max-w-[880px] pb-6 pt-1", phone ? "px-2" : "px-3")}>
          {!data ? (
            failed ? (
              <p role="alert" className="flex items-center gap-3 px-3 py-6 text-[14px] text-neutral-400">
                Could not load the inbox.
                <button type="button" onClick={load} className="rounded-md bg-white/10 px-2.5 py-1 text-[13px] font-bold text-neutral-100 hover:bg-white/16">
                  Try again
                </button>
              </p>
            ) : (
              <ul aria-label="Loading conversations" className="flex flex-col gap-1" role="status">
                {[0, 1, 2, 3, 4].map((i) => (
                  <li key={i} className="h-[68px] animate-pulse rounded-xl bg-white/[0.04] motion-reduce:animate-none" style={{ animationDelay: `${i * 90}ms` }} />
                ))}
              </ul>
            )
          ) : nothingYet ? (
            <Starters onStarter={onStarter} />
          ) : rows.length === 0 ? (
            <p className="px-3 py-8 text-center text-[14px] text-neutral-400">{q.trim() ? `No conversation mentions “${q.trim()}”.` : filter === "needs" ? "Nothing needs you right now." : filter === "scheduled" ? "No scheduled runs yet." : filter === "phone" ? "Nothing came in from your phone yet. Message the Nimbus bot on Telegram to start one." : "No conversations yet."}</p>
          ) : (
            <ul ref={list} id={listId} role="listbox" aria-label="Conversations, the ones that need you first, then newest" aria-activedescendant={`${listId}-${at}`} tabIndex={0} onKeyDown={onKeyDown} className="flex flex-col gap-0.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--rb-accent)]/60">
              {rows.map((r, i) => (
                <Row key={r.runId} id={`${listId}-${i}`} r={r} now={now} active={i === at} onPick={() => onOpen(r.workstreamId, r.runId)} onHover={() => setAt(i)} />
              ))}
            </ul>
          )}
          {data && data.scanned >= 300 && rows.length > 0 && <p className="px-3 pt-3 text-[12px] text-neutral-500">Showing the newest 300 runs.</p>}
          {failed && data && <p role="status" className="px-3 pt-3 text-[12px] text-neutral-500">Could not refresh; showing what was loaded.</p>}
        </div>
      </div>
    </div>
  );
}

function Row({ id, r, now, active, onPick, onHover }: { id: string; r: Conversation; now: number; active: boolean; onPick: () => void; onHover: () => void }) {
  const door = DOOR[r.door];
  const Icon = door.icon;
  return (
    <li id={id} role="option" aria-selected={active} onClick={onPick} onPointerEnter={onHover} data-state={r.state} className={cx("flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition-colors", active ? "bg-white/[0.08]" : "hover:bg-white/[0.05]", r.state === "needs" && "shadow-[inset_2px_0_0_var(--rb-accent)]")}>
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-neutral-300" title={door.label}>
        <Icon className="size-4" aria-label={door.label} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-bold text-neutral-500">{r.workstreamTitle}</span>
        <span className="block truncate text-[14px]/[20px] font-semibold text-neutral-100" title={r.asked}>
          {r.asked}
        </span>
        {r.last && (
          <span className="block truncate text-[13px]/[18px] text-neutral-400" title={r.last}>
            {r.last}
          </span>
        )}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="flex items-center gap-2 text-[12px] font-semibold tabular-nums text-neutral-500">
          <time dateTime={new Date(r.startedAt).toISOString()} title={new Date(r.startedAt).toLocaleString("en-US")}>
            {rel(r.startedAt, now)}
          </time>
          <span>{fmtCost(r.costUsd)}</span>
        </span>
        <StateChip state={r.state} waiting={r.waiting} />
      </span>
    </li>
  );
}

function StateChip({ state, waiting }: { state: Conversation["state"]; waiting: number }) {
  const base = "flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[11px] font-extrabold";
  if (state === "needs")
    return (
      <span className={cx(base, "bg-[var(--rb-accent)] text-[var(--rb-accent-fg)]")}>
        Needs you<span className="tabular-nums">{waiting > 1 ? ` · ${waiting}` : ""}</span>
      </span>
    );
  if (state === "running")
    return (
      <span className={cx(base, "bg-white/8 text-neutral-200")}>
        <span className="size-1.5 animate-pulse rounded-full bg-emerald-400 motion-reduce:animate-none" aria-hidden="true" />
        Running
      </span>
    );
  if (state === "failed") return <span className={cx(base, "bg-red-500/15 text-red-300")}>Failed</span>;
  if (state === "stopped") return <span className={cx(base, "bg-white/6 text-neutral-400")}>Stopped</span>;
  if (state === "quiet") return <span className={cx(base, "bg-white/6 text-neutral-400")}>Quiet</span>;
  return <span className={cx(base, "bg-white/8 text-neutral-300")}>Done</span>;
}

function Starters({ onStarter }: { onStarter: (s: (typeof STARTERS)[number]) => void }) {
  return (
    <div className="flex flex-col gap-3 px-2 py-4">
      <div>
        <p className="text-[16px] font-extrabold">No conversations yet</p>
        <p className="text-[13px] text-neutral-400">Start from something people already hand to their agents. Each card opens a new workstream with the goal filled in.</p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {STARTERS.map((s) => (
          <li key={s.title}>
            <button type="button" data-cuelume-open="" onClick={() => onStarter(s)} className="flex h-full w-full flex-col items-start gap-1 rounded-xl border border-white/10 bg-neutral-950/60 px-4 py-3 text-left transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rb-accent)]">
              <span className="text-[14px] font-bold text-neutral-100">{s.title}</span>
              <span className="text-[13px]/[18px] text-neutral-400">{s.goal}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
