"use client";

// Agent plan v2 (docs/SPEC.md §17.2). The orchestrator's plan is a draft the person edits before the crew acts: drag
// or nudge steps, reword, remove, add; Keep planning sends the edits back, Approve plan starts the crew. After approval
// the same card is the live checklist (a tick as each step's work ends, a running elapsed, a ✕ on a failure) and
// collapses to one line when the run is over. Runs nobody is watching (schedules, chat) keep the 3 s window.
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, GripVertical, Plus, Square, X } from "lucide-react";
import { ProgressBar } from "@/components/dithercn/progress-bar";
import type { PlanStep } from "@/lib/events";
import { ROLE_LABEL, ROLE_COLOR, TIER_SHORT, fmtSecs, type PlanItem, type RunView } from "@/lib/run-view";
import { cue } from "./sound";
import { Why } from "./why";
import { buttonSm, cx, panel, panelGlass, panelBody, panelFoot, panelHead, primaryButton, secondaryButton } from "./ui";

const ENDED = new Set(["done", "failed", "cancelled", "stopped"]);
const ROLES: PlanStep["role"][] = ["researcher", "analyst", "writer", "checker"];
const TIER_OF: Record<string, PlanStep["tier"]> = { researcher: "super", analyst: "super", writer: "super", checker: "nano", orchestrator: "ultra", learner: "nano" };

type Props = { item: PlanItem; view: RunView; now: number; onDraft?: (steps: PlanStep[]) => void; onCancel: () => void; onPlan: (action: "approve" | "revise", steps: PlanStep[]) => Promise<void> | void };

export function PlanCard(props: Props) {
  const { item, view } = props;
  const ended = ENDED.has(view.status);
  if (item.awaiting && !item.approved && !ended) return <DraftPlan key={`${item.seq}-${item.revision}`} {...props} />;
  return <LivePlan {...props} ended={ended} />;
}

function Header({ item, n, children }: { item: PlanItem; n: number; children?: React.ReactNode }) {
  return (
    <div className={panelHead}>
      <p className="text-[15px] font-extrabold">
        Plan · {n} {n === 1 ? "step" : "steps"} · Ultra
        {item.revision > 0 && <span className="ms-2 rounded bg-white/10 px-1.5 py-px text-[11px] font-extrabold text-neutral-300">revision {item.revision + 1}</span>}
        {item.edited && <span className="ms-2 rounded bg-[var(--rb-accent)]/20 px-1.5 py-px text-[11px] font-extrabold text-[var(--rb-accent)]">edited</span>}
      </p>
      {children}
      <Why what="The price, first" why="Measured from the plan, before anything runs" className="ms-auto">
        <span data-demo="estimate" className="rounded-full bg-white/10 px-2.5 py-0.5 text-[12px] font-bold tabular-nums text-neutral-100">{item.estimate.label}</span>
      </Why>
    </div>
  );
}

function DraftPlan({ item, onPlan, onDraft }: Props) {
  const [steps, setSteps] = useState<PlanStep[]>(item.steps);
  const [busy, setBusy] = useState<null | "approve" | "revise">(null);
  const dragFrom = useRef<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const added = useRef(0);
  const ready = steps.length > 0 && steps.every((s) => s.text.trim());
  useEffect(() => {
    onDraft?.(steps.map((s) => ({ ...s, text: s.text.trim() })));
  }, [steps, onDraft]);

  const move = (from: number, to: number) => {
    if (from !== to && to >= 0 && to < steps.length) cue("select", { direction: to < from ? "back" : "forward" });
    setSteps((cur) => {
      if (from === to || to < 0 || to >= cur.length) return cur;
      const next = cur.slice();
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });
  };
  const send = async (action: "approve" | "revise") => {
    setBusy(action);
    await onPlan(action, steps.map((s) => ({ ...s, text: s.text.trim() })));
  };

  return (
    <div className={cx(panel, "ring-1 ring-orange-400/40")}>
      <Header item={item} n={steps.length} />
      <div className={cx(panelBody, "gap-1 p-3")}>
        <p className="pb-1 text-[13px] text-neutral-400">This is a draft. Reword, reorder or add steps; the crew does nothing until you approve.</p>
        <ol data-demo="plan" className="flex flex-col gap-1" aria-label="Plan steps">
          {steps.map((s, i) => (
            <li
              key={s.id}
              draggable
              onDragStart={() => (dragFrom.current = i)}
              onDragOver={(e) => (e.preventDefault(), setOver(i))}
              onDragEnd={() => (dragFrom.current = null, setOver(null))}
              onDrop={() => {
                if (dragFrom.current !== null) move(dragFrom.current, i);
                dragFrom.current = null;
                setOver(null);
              }}
              className={cx("group flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/4 px-1.5 py-1 transition-colors", over === i && "border-[var(--rb-accent)] bg-white/8")}
            >
              <span className="grid size-6 shrink-0 cursor-grab place-items-center text-neutral-500 active:cursor-grabbing" aria-hidden="true">
                <GripVertical className="size-4" />
              </span>
              <span className="w-5 shrink-0 text-center text-[12px] font-bold tabular-nums text-neutral-500">{i + 1}</span>
              <input
                value={s.text}
                onChange={(e) => setSteps((cur) => cur.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))}
                aria-label={`Step ${i + 1}`}
                placeholder="Describe the step"
                className="min-w-0 flex-1 bg-transparent px-1 py-1 text-[14px] text-neutral-100 outline-none placeholder:text-neutral-500 focus:bg-white/5"
              />
              <select
                value={s.role}
                aria-label={`Agent for step ${i + 1}`}
                onChange={(e) => setSteps((cur) => cur.map((x, k) => (k === i ? { ...x, role: e.target.value as PlanStep["role"], tier: TIER_OF[e.target.value] } : x)))}
                className="shrink-0 rounded-md border border-white/10 bg-neutral-900 px-1.5 py-1 text-[12px] font-bold text-neutral-200"
              >
                {[...new Set([...ROLES, s.role])].map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]} · {TIER_SHORT[TIER_OF[r]]}
                  </option>
                ))}
              </select>
              <button type="button" aria-label="Move step up" disabled={i === 0} onClick={() => move(i, i - 1)} className="grid size-6 shrink-0 place-items-center rounded text-neutral-400 hover:bg-white/10 disabled:opacity-25">
                <ArrowUp className="size-3.5" />
              </button>
              <button type="button" aria-label="Move step down" disabled={i === steps.length - 1} onClick={() => move(i, i + 1)} className="grid size-6 shrink-0 place-items-center rounded text-neutral-400 hover:bg-white/10 disabled:opacity-25">
                <ArrowDown className="size-3.5" />
              </button>
              <button type="button" aria-label="Remove step" data-cuelume-close="" data-cuelume-emphasis="subtle" disabled={steps.length === 1} onClick={() => setSteps((cur) => cur.filter((_, k) => k !== i))} className="grid size-6 shrink-0 place-items-center rounded text-neutral-400 hover:bg-red-500/15 hover:text-red-200 disabled:opacity-25">
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          data-cuelume-tap=""
          data-cuelume-emphasis="subtle"
          onClick={() => setSteps((cur) => [...cur, { id: `n${++added.current}`, text: "", role: "analyst", tier: "super" }])}
          className="mt-1 flex items-center gap-1.5 self-start rounded-md px-2 py-1 text-[13px] font-bold text-neutral-300 hover:bg-white/8"
        >
          <Plus className="size-3.5" /> Add step
        </button>
        <div data-demo="tools" className="mt-1 flex flex-wrap gap-1.5">
          {item.tools.map((t) => (
            <span key={t} className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[11px] text-neutral-300">
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className={cx(panelFoot, "justify-between")}>
        <span className="text-neutral-400">{ready ? "Waiting for you" : "Every step needs some text"}</span>
        <span className="flex gap-2">
          <button type="button" data-cuelume-tap="" disabled={!ready || !!busy} onClick={() => void send("revise")} className={cx(secondaryButton, buttonSm)}>
            {busy === "revise" ? "Planning again…" : "Keep planning"}
          </button>
          <button type="button" data-cuelume-tap="" disabled={!ready || !!busy} onClick={() => void send("approve")} className={cx(primaryButton, buttonSm)}>
            {busy === "approve" ? "Starting…" : "Approve plan"}
          </button>
        </span>
      </div>
    </div>
  );
}

function LivePlan({ item, view, now, onCancel, ended }: Props & { ended: boolean }) {
  const [open, setOpen] = useState(false);
  const total = item.steps.length;
  const done = item.steps.filter((s) => view.stepState[s.id]?.state === "done").length;
  const failed = item.steps.some((s) => view.stepState[s.id]?.state === "failed");
  const elapsedMs = view.endedMs ?? view.lastTMs;
  const remaining = Math.max(0, Math.ceil((item.tMs + 3000 - (now - view.startedAt)) / 1000));
  const countdown = !item.approved && !ended && view.status === "planning" && remaining > 0 && !item.awaiting;
  const cancelled = view.status === "cancelled";
  // a run you cancelled or stopped did not fail: no red cross for it
  const endedByYou = view.status === "cancelled" || view.status === "stopped";

  if (ended && !open)
    return (
      <button type="button" data-demo="plan" data-cuelume-open="" data-cuelume-emphasis="subtle" onClick={() => setOpen(true)} aria-expanded="false" className={cx(panelGlass, "flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-white/5")}>
        <span className={cx("grid size-5 place-items-center rounded-full", endedByYou ? "bg-white/10 text-neutral-300" : failed ? "bg-red-500/20 text-red-200" : "bg-emerald-500/20 text-emerald-200")}>
          {endedByYou ? <Square className="size-2.5 fill-current" /> : failed ? <X className="size-3" /> : <Check className="size-3" />}
        </span>
        <span className="text-[14px] font-bold tabular-nums">
          {endedByYou ? `${cancelled ? "Cancelled" : "Stopped"} · ` : ""}
          {done} of {total} steps · {fmtSecs(elapsedMs)}
        </span>
        {item.edited && <span className="rounded bg-[var(--rb-accent)]/20 px-1.5 py-px text-[11px] font-extrabold text-[var(--rb-accent)]">edited plan</span>}
        <span className="ms-auto text-[12px] text-neutral-400">Show plan</span>
      </button>
    );

  return (
    <div data-demo="plan" className={panel}>
      <Header item={item} n={total} />
      <div className={cx(panelBody, "gap-2 p-3")}>
        <ProgressBar value={done} max={Math.max(total, 1)} label="Plan progress" valueText={`${done} of ${total} steps`} hideLabel size="sm" color={failed ? "red" : "green"} segments={total > 1 ? total : undefined} />
        <ol className="flex flex-col gap-0.5" aria-label="Plan checklist">
          {item.steps.map((s, i) => {
            const st = view.stepState[s.id] ?? { state: "pending" as const };
            const secs = st.state === "running" ? Math.max(0, (now - view.startedAt - (st.startMs ?? 0)) / 1000) : st.endMs !== undefined && st.startMs !== undefined ? (st.endMs - st.startMs) / 1000 : null;
            return (
              <li key={s.id} className={cx("flex items-start gap-2.5 py-1", st.state === "pending" && "opacity-60")} aria-current={st.state === "running" ? "step" : undefined}>
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center">
                  {st.state === "done" ? (
                    <span key="d" className="nb-pop grid size-5 place-items-center rounded-full bg-emerald-500/25 text-emerald-200"><Check className="size-3" /></span>
                  ) : st.state === "failed" ? (
                    <span className="nb-pop grid size-5 place-items-center rounded-full bg-red-500/25 text-red-200"><X className="size-3" /></span>
                  ) : st.state === "running" ? (
                    <span className="size-3 animate-pulse rounded-full motion-reduce:animate-none" style={{ background: ROLE_COLOR[s.role] }} />
                  ) : (
                    <span className="size-3 rounded-full border border-white/25" />
                  )}
                </span>
                <p className="min-w-0 flex-1 text-[14px]/[20px]">
                  <span className={cx(st.state === "done" && "text-neutral-300", st.state === "failed" && "text-red-200 line-through")}>{s.text}</span>{" "}
                  <span className="rounded bg-white/10 px-1.5 py-px text-[11px] font-extrabold text-neutral-300">{ROLE_LABEL[s.role]} · {TIER_SHORT[s.tier]}</span>
                </p>
                <span className="mt-0.5 w-12 shrink-0 text-end text-[12px] tabular-nums text-neutral-400" aria-label={secs === null ? undefined : `${secs.toFixed(1)} seconds`}>
                  {secs === null ? "" : `${secs.toFixed(secs < 10 ? 1 : 0)}s`}
                </span>
                <span className="sr-only">{`step ${i + 1} ${st.state}`}</span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className={cx(panelFoot, "justify-between")}>
        <span className="tabular-nums">{cancelled ? "Cancelled" : countdown ? `Starting in ${remaining}s unless you cancel` : ended ? `${done} of ${total} steps · ${fmtSecs(elapsedMs)}` : `${done} of ${total} steps`}</span>
        {countdown ? (
          <button type="button" data-cuelume-close="" onClick={onCancel} className={cx(secondaryButton, buttonSm, "relative overflow-hidden")}>
            Cancel
            <span key={item.seq} aria-hidden="true" className="nb-countdown absolute inset-x-3 bottom-0.5 h-0.5 rounded-full bg-current opacity-50" />
          </button>
        ) : ended ? (
          <button type="button" data-cuelume-close="" data-cuelume-emphasis="subtle" onClick={() => setOpen(false)} className={cx(secondaryButton, buttonSm)}>
            Collapse
          </button>
        ) : null}
      </div>
    </div>
  );
}
