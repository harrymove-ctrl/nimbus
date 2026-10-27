"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowUp, Gauge, Paperclip, ShieldCheck, Square, Wrench, X } from "lucide-react";
import { TOOL_LABELS, type Workstream } from "@/lib/workstreams";
import type { RunView } from "@/lib/run-view";
import { CountUp } from "./count-up";
import { cx, ghostButton, primaryButton, secondaryButton } from "./ui";

// The composer never changes shape; only placeholder, primary button, secondary button and
// what Enter does follow the state (UI-SKETCH F11, "Composer states, in full").
export type ComposerState = "idle" | "drafting" | "slash" | "planning" | "plan" | "running" | "asked" | "waiting";
export type Mode = "ask" | "auto-low" | "dry";
export type TierChoice = "auto" | "cheap" | "max";

const MODES: { key: Mode; label: string }[] = [
  { key: "ask", label: "Ask each action" },
  { key: "auto-low", label: "Auto low-risk" },
  { key: "dry", label: "Dry run" },
];
const TIERS: { key: TierChoice; label: string }[] = [
  { key: "auto", label: "Auto (router)" },
  { key: "cheap", label: "Cheap (Nano)" },
  { key: "max", label: "Max (ceilings)" },
];
const SLASH = [
  { cmd: "/run", hint: "Run the workstream's saved goal", act: "run" },
  { cmd: "/schedule", hint: "Schedule it: a cron or words, e.g. /schedule Mondays 9am", act: "fill" },
  { cmd: "/stop", hint: "Stop the run", act: "stop" },
  { cmd: "/approve", hint: "Approve the first pending action", act: "approve" },
  { cmd: "/skill", hint: "Open this workstream's SKILL.md", act: "skill" },
  { cmd: "/memory", hint: "Open memories", act: "memory" },
] as const;
const MENTIONS = ["researcher", "analyst", "checker", "writer"].map((r) => ({ cmd: `@${r}`, hint: `Send your next message to the ${r}'s next turn`, act: "fill" as const }));

export type ComposerProps = {
  view: RunView;
  now: number;
  workstream?: Workstream;
  draft: string;
  setDraft: (s: string) => void;
  /** approve the draft plan as it stands in the card (the edits live there) */
  onApprovePlan: () => void;
  files: string[];
  setFiles: (f: string[]) => void;
  tools: string[];
  setTools: (t: string[]) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  tier: TierChoice;
  setTier: (t: TierChoice) => void;
  onRun: (opts?: { max?: boolean; saved?: boolean }) => void;
  onCancel: () => void;
  onStop: () => void;
  onSteer: (text: string) => void;
  onAnswer: (text: string) => void;
  onApproveFirst: () => void;
  onOpenTab: (tab: "memory") => void;
};

export function deriveComposerState(view: RunView, draft: string, files: string[], menuClosed: boolean): ComposerState {
  if (view.planAwaiting) return "plan"; // the draft plan is a decision: APPROVE PLAN
  if (view.status === "planning") return "planning";
  if (view.status === "asked") return "asked";
  if (view.status === "waiting") return "waiting";
  if (view.status === "running") return "running";
  if (draft.trim() === "" && files.length === 0) return "idle";
  const slash = !menuClosed && (draft.startsWith("/") || /(^|\s)@\w*$/.test(draft));
  return slash ? "slash" : "drafting";
}

const PLACEHOLDER: Record<ComposerState, string> = {
  idle: "Give the crew a goal…",
  drafting: "Give the crew a goal…",
  slash: "Give the crew a goal…",
  planning: "Planning…",
  plan: "Review the plan above, then approve it…",
  running: "Steer the crew…",
  asked: "Answer the crew…",
  waiting: "Steer the crew…",
};

/** Three plain goals on an empty workstream (SPEC §17.7); the plan card does the rest. */
const TEMPLATES: { label: string; goal: string }[] = [
  { label: "Fix what's failing", goal: "Run the checks, find what fails, fix it, and open a pull request for me to review." },
  { label: "Watch …", goal: "Watch the pages I care about and tell me what changed since yesterday and what we should do about it." },
  { label: "Brief me every morning", goal: "Read my inbox, calendar and notifications and give me one page: what needs me today, drafts for the replies that matter, and what can wait." },
];

export function Composer(p: ComposerProps) {
  const { view } = p;
  const [menuClosed, setMenuClosed] = useState(false);
  const [menuIdx, setMenuIdx] = useState(0);
  const [confirmStop, setConfirmStop] = useState(false);
  const [estimate, setEstimate] = useState<{ cost: number; rest: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const lastEsc = useRef(0);
  const cache = useRef(new Map<string, { cost: number; rest: string }>());

  const state = deriveComposerState(view, p.draft, p.files, menuClosed);
  const live = state === "running" || state === "asked" || state === "waiting" || state === "plan";
  const hasText = p.draft.trim().length > 0;
  const remaining = view.plan ? Math.max(0, Math.ceil((view.plan.tMs + 3000 - (p.now - view.startedAt)) / 1000)) : 0;

  useEffect(() => setMenuClosed(false), [p.draft]);
  useEffect(() => {
    if (!live) setConfirmStop(false);
  }, [live]);

  // Cost estimate: 400 ms debounce after typing stops, draft >= 12 chars, cached by draft + tier.
  useEffect(() => {
    if ((state !== "drafting" && state !== "slash") || p.draft.trim().length < 12) {
      setEstimate(null);
      return;
    }
    const key = `${p.tier}|${p.draft.trim()}`;
    const hit = cache.current.get(key);
    if (hit) {
      setEstimate(hit);
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch("/api/estimate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ draft: p.draft, tier: p.tier }), signal: ctl.signal });
        const j = (await r.json()) as { costUsd: number; label: string };
        const e = { cost: j.costUsd, rest: j.label.split(" · ").slice(1).join(" · ") };
        cache.current.set(key, e);
        setEstimate(e);
      } catch {}
    }, 400);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [p.draft, p.tier, state]);

  const menu = useMemo(() => {
    if (state !== "slash") return [];
    if (p.draft.startsWith("/")) {
      const head = p.draft.split(/\s/)[0];
      return SLASH.filter((s) => s.cmd.startsWith(head));
    }
    const m = p.draft.match(/@(\w*)$/);
    return MENTIONS.filter((s) => s.cmd.startsWith(`@${m?.[1] ?? ""}`));
  }, [state, p.draft]);

  useEffect(() => setMenuIdx(0), [menu.length]);

  const pick = (item: { cmd: string; act: string }) => {
    setMenuClosed(true);
    if (item.act === "run") {
      p.setDraft("");
      p.onRun({ saved: true });
    } else if (item.act === "stop") {
      p.setDraft("");
      if (live) setConfirmStop(true);
    } else if (item.act === "approve") {
      p.setDraft("");
      p.onApproveFirst();
    } else if (item.act === "skill" || item.act === "memory") {
      p.setDraft("");
      p.onOpenTab("memory");
    } else if (item.cmd.startsWith("@")) {
      p.setDraft(p.draft.replace(/@\w*$/, `${item.cmd} `));
    } else {
      p.setDraft(`${item.cmd} `);
    }
    areaRef.current?.focus();
  };

  const send = (max = false) => {
    if (state === "planning") return;
    if (state === "plan") return p.onApprovePlan();
    if (state === "asked") return hasText && p.onAnswer(p.draft.trim());
    if (state === "running" || state === "waiting") return hasText && p.onSteer(p.draft.trim());
    if (state === "idle") return;
    p.onRun({ max });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (state === "slash" && menu.length > 0) {
      if (e.key === "ArrowDown") return void (e.preventDefault(), setMenuIdx((i) => (i + 1) % menu.length));
      if (e.key === "ArrowUp") return void (e.preventDefault(), setMenuIdx((i) => (i - 1 + menu.length) % menu.length));
      if (e.key === "Enter" && !e.shiftKey) return void (e.preventDefault(), pick(menu[menuIdx]));
      if (e.key === "Escape") return void (e.preventDefault(), setMenuClosed(true));
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (e.metaKey || e.ctrlKey) {
        if (state === "drafting" || state === "slash") send(true);
      } else send(false);
      return;
    }
    if (e.key === "Escape") {
      if (state === "planning") return p.onCancel();
      const t = Date.now();
      if (t - lastEsc.current < 2000) {
        p.setDraft("");
        p.setFiles([]);
        lastEsc.current = 0;
      } else {
        lastEsc.current = t;
        areaRef.current?.select();
      }
    }
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    p.setFiles([...new Set([...p.files, ...Array.from(list).map((f) => f.name)])]);
  };

  const primary = (() => {
    switch (state) {
      case "plan":
        return { label: "APPROVE PLAN", disabled: false, onClick: p.onApprovePlan };
      case "planning":
        return { label: remaining > 0 ? `CANCEL · ${remaining}s` : "CANCEL", disabled: false, onClick: p.onCancel };
      case "running":
      case "waiting":
        return { label: "STEER", disabled: !hasText, onClick: () => send() };
      case "asked":
        return { label: "REPLY", disabled: !hasText, onClick: () => send() };
      case "idle":
        return { label: "RUN", disabled: true, onClick: () => {} };
      default:
        return { label: "RUN", disabled: false, onClick: () => send() };
    }
  })();

  return (
    <div className="mx-auto w-full max-w-[720px]">
      {state === "idle" && (
        <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Goal templates">
          {TEMPLATES.map((t, i) => (
            <button
              key={t.label}
              type="button"
              style={{ animationDelay: `${i * 50}ms` }}
              onClick={() => (p.setDraft(t.goal), areaRef.current?.focus())}
              className="nb-rise-fast rounded-full border border-white/12 bg-neutral-900 px-3 py-1.5 text-[13px] font-bold text-neutral-200 transition-colors hover:bg-white/10"
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cx("relative flex min-h-[100px] max-h-[220px] flex-col rounded-2xl border bg-neutral-900 shadow-[0_8px_30px_-12px_rgb(0_0_0/0.6)] transition-colors", dragOver ? "border-[var(--rb-accent)]" : "border-white/10 focus-within:border-white/25")}
      >
        {state === "slash" && menu.length > 0 && (
          <ul role="listbox" aria-label="Commands" className="nb-scale-in absolute inset-x-0 bottom-full z-30 mb-2 overflow-hidden rounded-xl border border-white/10 bg-neutral-900 p-1 shadow-xl">
            {menu.slice(0, 6).map((m, i) => (
              <li key={m.cmd} role="option" aria-selected={i === menuIdx}>
                <button type="button" onMouseEnter={() => setMenuIdx(i)} onClick={() => pick(m)} className={cx("flex w-full items-baseline gap-3 rounded-lg px-3 py-1.5 text-left", i === menuIdx && "bg-white/10")}>
                  <span className="font-mono text-[13px] font-bold text-neutral-100">{m.cmd}</span>
                  <span className="truncate text-[13px] text-neutral-400">{m.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {(p.files.length > 0 || state === "slash") && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-3">
            {p.files.map((f) => (
              <span key={f} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white/10 ps-2.5 pe-1 text-[12px] font-bold text-neutral-100">
                <Paperclip className="size-3" aria-hidden="true" />
                {f.split(".").pop()?.toUpperCase()} · {f}
                <button type="button" aria-label={`Remove ${f}`} onClick={() => p.setFiles(p.files.filter((x) => x !== f))} className="grid size-5 place-items-center rounded-full hover:bg-white/15">
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <textarea
          ref={areaRef}
          value={p.draft}
          onChange={(e) => p.setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          readOnly={state === "planning"}
          rows={1}
          aria-label="Message the crew"
          placeholder={PLACEHOLDER[state]}
          className="max-h-40 min-h-11 w-full flex-auto resize-none bg-transparent px-4 py-3 text-[15px]/[22px] font-medium text-neutral-100 outline-none [field-sizing:content] placeholder:text-neutral-500"
        />

        {confirmStop && (
          <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-1.5 text-[13px] font-semibold text-red-200">
            <span className="flex-1">Stop the run? Pending approvals are rejected.</span>
            <button type="button" onClick={() => (setConfirmStop(false), p.onStop())} className="h-7 rounded-md bg-red-500 px-3 text-[12px] font-extrabold text-white">
              Stop
            </button>
            <button type="button" onClick={() => setConfirmStop(false)} className={cx(ghostButton, "h-7 rounded-md px-3 text-[12px] font-bold")}>
              Keep going
            </button>
          </div>
        )}

        <div className="flex min-h-11 shrink-0 flex-wrap items-center gap-x-1 gap-y-1 px-2 pb-1">
          <input ref={fileRef} type="file" multiple accept=".csv,.pdf,.png,.jpg,.jpeg,.txt,.md,.json" className="hidden" onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} />
          <Chip label="Attach" icon={<Paperclip className="size-3.5" />} disabled={live || state === "planning"} onClick={() => fileRef.current?.click()} />
          <ChipMenu
            label="Tools"
            icon={<Wrench className="size-3.5" />}
            value={`${p.tools.length}`}
            disabled={live || state === "planning"}
            multi
            items={Object.entries(TOOL_LABELS).map(([k, l]) => ({ key: k, label: l, checked: p.tools.includes(k) }))}
            onPick={(k) => p.setTools(p.tools.includes(k) ? p.tools.filter((t) => t !== k) : [...p.tools, k])}
          />
          <ChipMenu label="Mode" icon={<ShieldCheck className="size-3.5" />} value={MODES.find((m) => m.key === p.mode)?.label} disabled={live || state === "planning"} items={MODES.map((m) => ({ key: m.key, label: m.label, checked: m.key === p.mode }))} onPick={(k) => p.setMode(k as Mode)} />
          <ChipMenu label="Tier" icon={<Gauge className="size-3.5" />} value={TIERS.find((t) => t.key === p.tier)?.label.split(" ")[0]} disabled={live || state === "planning"} items={TIERS.map((t) => ({ key: t.key, label: t.label, checked: t.key === p.tier }))} onPick={(k) => p.setTier(k as TierChoice)} />

          <div className="ms-auto flex flex-wrap items-center justify-end gap-2">
            {estimate && (state === "drafting" || state === "slash") && (
              <span className="hidden max-w-[260px] truncate rounded-full bg-white/8 px-2.5 py-1 text-[12px] font-bold tabular-nums text-neutral-300 sm:block" title="Estimated by Nano; cached per draft">
                <CountUp value={estimate.cost} format={(n) => `≈ $${n.toFixed(2)}`} ms={300} /> · {estimate.rest}
              </span>
            )}
            {live && !confirmStop && (
              <button type="button" onClick={() => (state === "plan" ? p.onCancel() : setConfirmStop(true))} className={cx(secondaryButton, "h-9 gap-1.5 rounded-[var(--rb-r-lg)] px-3.5 text-[13px] font-extrabold")}>
                <Square className="size-3 fill-current" aria-hidden="true" /> {state === "plan" ? "CANCEL" : "STOP"}
              </button>
            )}
            <button
              type="button"
              disabled={primary.disabled}
              onClick={primary.onClick}
              className={cx(state === "planning" ? secondaryButton : primaryButton, "relative h-9 gap-1.5 overflow-hidden rounded-[var(--rb-r-lg)] px-4 text-[13px] font-extrabold tabular-nums")}
            >
              <span key={primary.label.split(" ")[0]} className="nb-fade inline-flex items-center gap-1.5">
                {state !== "planning" && <ArrowUp className="size-3.5" aria-hidden="true" />}
                {primary.label}
              </span>
              {state === "planning" && view.plan && remaining > 0 && <span key={view.plan.seq} aria-hidden="true" className="nb-countdown absolute inset-x-3 bottom-1 h-0.5 rounded-full bg-current opacity-50" />}
            </button>
          </div>
        </div>
      </div>
      <p className="mt-1.5 hidden px-1 text-center text-[11px] font-medium text-neutral-500 sm:block">
        Enter {state === "plan" ? "approves the plan" : state === "running" || state === "waiting" ? "steers" : state === "asked" ? "replies" : "runs"} · Shift+Enter newline · ⌘Enter runs on Max · Esc clears · / commands · @ agents
      </p>
    </div>
  );
}

const chipCls = "inline-flex h-8 shrink-0 items-center whitespace-nowrap gap-1.5 rounded-lg px-2.5 text-[12px] font-bold text-neutral-300 transition-colors hover:bg-white/10 hover:text-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent";

function Chip({ label, icon, onClick, disabled }: { label: string; icon: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={chipCls}>
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function ChipMenu({ label, icon, value, items, onPick, disabled, multi }: { label: string; icon: ReactNode; value?: string; items: { key: string; label: string; checked: boolean }[]; onPick: (k: string) => void; disabled?: boolean; multi?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const f = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", f);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", f);
      document.removeEventListener("keydown", k);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" disabled={disabled} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={chipCls}>
        {icon}
        <span className="hidden sm:inline">{label}</span>
        {value && <span className="hidden rounded bg-white/10 px-1.5 text-[11px] text-neutral-100 lg:inline">{value}</span>}
      </button>
      {open && (
        <ul role="menu" className="absolute bottom-full left-0 z-30 mb-2 min-w-48 overflow-hidden rounded-xl border border-white/10 bg-neutral-900 p-1 shadow-xl">
          {items.map((it) => (
            <li key={it.key} role="none">
              <button
                type="button"
                role={multi ? "menuitemcheckbox" : "menuitemradio"}
                aria-checked={it.checked}
                onClick={() => (onPick(it.key), !multi && setOpen(false))}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[13px] font-semibold text-neutral-100 hover:bg-white/10"
              >
                <span className={cx("grid size-4 place-items-center rounded-full border text-[10px]", it.checked ? "border-transparent bg-[var(--rb-accent)] text-[var(--rb-accent-fg)]" : "border-white/25")}>{it.checked ? "✓" : ""}</span>
                {it.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
