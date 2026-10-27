"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, FileText, Shield, X } from "lucide-react";
import {
  ROLE_COLOR,
  ROLE_LABEL,
  TIER_SHORT,
  fmtCost,
  fmtSecs,
  fmtTokens,
  laneName,
  type ApprovalItem,
  type PlanItem,
  type QuestionItem,
  type RunView,
  type TItem,
} from "@/lib/run-view";
import { CountUp } from "./count-up";
import { buttonSm, cx, ghostButton, panel, panelBody, panelFoot, panelHead, primaryButton, secondaryButton, toolOutput, toolWell, userBubble } from "./ui";
import type { AgentRole } from "@/lib/models";

type Props = {
  view: RunView;
  now: number;
  onCancelPlan: () => void;
  onAnswer: (q: QuestionItem, text: string) => void;
  onDecide: (a: ApprovalItem, decision: "approve" | "approve_always" | "reject", note?: string) => void;
  onOpenArtifact: (artifactId: string, version: number) => void;
  onRevertSkill?: () => Promise<boolean>;
  onTemplate?: (goal: string) => void;
};

export function Transcript({ view, now, onCancelPlan, onAnswer, onDecide, onOpenArtifact, onRevertSkill }: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const scroller = useRef<HTMLDivElement>(null);

  // Keep the newest item in view unless the person scrolled up.
  useEffect(() => {
    if (stick.current) endRef.current?.scrollIntoView({ block: "end" });
  }, [view.transcript.length, view.pendingApprovals.length]);

  return (
    <div
      ref={scroller}
      className="min-h-0 flex-1 overflow-y-auto"
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
      aria-live="polite"
    >
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 px-4 py-5">
        {view.transcript.length === 0 && <EmptyState />}
        {view.transcript.map((item) => (
          <div key={item.seq} id={`tr-${item.seq}`} className={cx("scroll-mt-4", item.t === "plan" ? "nb-rise" : "nb-rise-fast")}>
            <Item item={item} view={view} now={now} onCancelPlan={onCancelPlan} onAnswer={onAnswer} onDecide={onDecide} onOpenArtifact={onOpenArtifact} onRevertSkill={onRevertSkill} />
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid place-items-center py-16 text-center">
      <p className="text-[17px] font-extrabold text-neutral-100">Give the crew a goal.</p>
      <p className="mt-1 max-w-sm text-[14px] text-neutral-400">The plan, every agent message, approvals and artifacts appear here. Press RUN to replay the demo run.</p>
    </div>
  );
}

function Dot({ role }: { role: AgentRole }) {
  return <span className="mt-[7px] size-2 shrink-0 rounded-full" style={{ background: ROLE_COLOR[role] }} />;
}

function Item({ item, view, now, onCancelPlan, onAnswer, onDecide, onOpenArtifact, onRevertSkill }: { item: TItem; view: RunView } & Omit<Props, "view" | "onTemplate" | "now"> & { now: number }) {
  switch (item.t) {
    case "user":
      return (
        <div className="flex flex-col items-end gap-1">
          <p className={userBubble}>{item.text}</p>
          {item.queued && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-neutral-300">queued · delivered at the next turn</span>}
        </div>
      );
    case "agent":
      return (
        <div className="flex gap-2.5">
          <Dot role={item.role} />
          <div className="min-w-0">
            <p className="text-[12px] font-bold uppercase tracking-wide text-neutral-400">{laneName(item.instance, item.role)}</p>
            <p className="text-[15px]/[24px] font-medium text-neutral-100 [overflow-wrap:anywhere]">{item.text}</p>
          </div>
        </div>
      );
    case "plan":
      return <PlanCard item={item} view={view} now={now} onCancel={onCancelPlan} />;
    case "handoff": {
      const from = view.lanes.find((l) => l.instance === item.from);
      const to = view.lanes.find((l) => l.instance === item.to);
      return (
        <div className="flex flex-col gap-1 rounded-xl border border-white/10 px-3 py-2">
          <p className="flex items-center gap-1.5 text-[13px] font-bold text-neutral-200">
            <span style={{ color: from ? ROLE_COLOR[from.role] : undefined }}>{from ? laneName(from.instance, from.role) : item.from}</span>
            <ArrowRight className="size-3.5 text-neutral-500" aria-hidden="true" />
            <span style={{ color: to ? ROLE_COLOR[to.role] : undefined }}>{to ? laneName(to.instance, to.role) : item.to}</span>
            <span className="ms-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">handoff</span>
          </p>
          <p className="text-[13px]/[19px] text-neutral-400">{item.context}</p>
        </div>
      );
    }
    case "question":
      return <QuestionCard item={item} onAnswer={onAnswer} />;
    case "approval":
      return <ApprovalCard item={item} onDecide={onDecide} />;
    case "policy":
      return (
        <p className="flex items-center gap-2 text-[13px] font-semibold text-[var(--rb-accent)]">
          <Shield className="size-4" aria-hidden="true" /> Policy saved to SKILL.md: <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[12px] text-neutral-100">{item.rule}</code>
        </p>
      );
    case "artifact":
      return (
        <button type="button" onClick={() => onOpenArtifact(item.artifactId, item.version)} className="flex w-full items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-left hover:bg-white/5">
          <FileText className="size-4 shrink-0 text-teal-300" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-neutral-100">{item.title}</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-extrabold text-neutral-200">v{item.version}</span>
          <span className="text-[12px] font-semibold text-neutral-400">{item.kind === "code" ? "code" : "doc"} · open</span>
        </button>
      );
    case "summary":
      return <SummaryCard item={item} view={view} onRevert={onRevertSkill} />;
    case "end":
      return <p className="text-center text-[13px] font-semibold text-neutral-400">Run {item.status}.</p>;
  }
}

function PlanCard({ item, view, now, onCancel }: { item: PlanItem; view: RunView; now: number; onCancel: () => void }) {
  const remaining = Math.max(0, Math.ceil((item.tMs + 3000 - (now - view.startedAt)) / 1000));
  const cancelled = view.status === "cancelled";
  const open = view.status === "planning" && remaining > 0;
  return (
    <div className={panel}>
      <div className={panelHead}>
        <p className="text-[15px] font-extrabold">Plan</p>
        <span className="ms-auto rounded-full bg-white/10 px-2.5 py-0.5 text-[12px] font-bold tabular-nums text-neutral-100">{item.estimate.label}</span>
      </div>
      <div className={cx(panelBody, "gap-1 p-3")}>
        {item.agents.map((a) => (
          <div key={a.instance} className="flex items-start gap-2.5 py-1">
            <Dot role={a.role} />
            <p className="min-w-0 flex-1 text-[14px]/[20px]">
              <span className="font-bold">{ROLE_LABEL[a.role]}</span> <span className="rounded bg-white/10 px-1.5 py-px text-[11px] font-extrabold text-neutral-300">{TIER_SHORT[a.tier]}</span>
              <span className="text-neutral-400"> · {a.brief}</span>
            </p>
          </div>
        ))}
        <div className="mt-1 flex flex-wrap gap-1.5">
          {item.tools.map((t) => (
            <span key={t} className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[11px] text-neutral-300">
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className={cx(panelFoot, "justify-between")}>
        <span className="tabular-nums">{cancelled ? "Cancelled" : open ? `Starting in ${remaining}s unless you cancel` : "Started"}</span>
        {open && (
          <button type="button" onClick={onCancel} className={cx(secondaryButton, buttonSm, "relative overflow-hidden")}>
            Cancel
            <span key={item.seq} aria-hidden="true" className="nb-countdown absolute inset-x-3 bottom-0.5 h-0.5 rounded-full bg-current opacity-50" />
          </button>
        )}
      </div>
    </div>
  );
}

function QuestionCard({ item, onAnswer }: { item: QuestionItem; onAnswer: (q: QuestionItem, text: string) => void }) {
  const answered = item.answer !== undefined;
  return (
    <div className={cx(panel, !answered && "ring-1 ring-orange-400/40")}>
      <div className={panelHead}>
        <Dot role={item.role} />
        <p className="text-[12px] font-bold uppercase tracking-wide text-neutral-400">{laneName(item.instance, item.role)} asks</p>
      </div>
      <div className={cx(panelBody, "p-3")}>
        <p className="text-[15px]/[22px] font-bold">{item.text}</p>
        {item.options && (
          <div className="mt-3 flex flex-wrap gap-2">
            {item.options.map((o) => {
              const chosen = item.answer === o;
              return (
                <button
                  key={o}
                  type="button"
                  disabled={answered}
                  onClick={() => onAnswer(item, o)}
                  aria-pressed={chosen}
                  className={cx(
                    "h-7 rounded-full border px-3.5 text-[13px] font-bold transition-colors",
                    chosen ? "border-transparent bg-[var(--rb-accent)] text-[var(--rb-accent-fg)]" : "border-white/15 text-neutral-100 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent",
                  )}
                >
                  {o}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className={panelFoot}>{answered ? `Answered: ${item.answer}` : "Type an answer below or pick a chip. Only this lane waits."}</div>
    </div>
  );
}

const RISK_STRIPE = { low: "bg-emerald-400", medium: "bg-orange-400", high: "bg-red-500" } as const;

function ApprovalCard({ item, onDecide }: { item: ApprovalItem; onDecide: Props["onDecide"] }) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const pending = item.status === "pending";
  const d = item.action.details as { channel?: string; text?: string } | undefined;
  return (
    <div className={cx(panel, "relative")}>
      <span className={cx("absolute inset-y-0 left-0 z-10 w-[3px]", RISK_STRIPE[item.action.risk])} aria-hidden="true" />
      <div className={panelHead}>
        <p className="text-[15px] font-extrabold">{pending ? "Needs approval" : item.status === "approved" ? "Approved" : "Rejected"}</p>
        <span className="ms-auto rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-extrabold uppercase text-neutral-300">{item.action.risk} risk</span>
      </div>
      <div className={cx(panelBody, "gap-2 p-3")}>
        <p className="text-[15px]/[22px] font-bold">{item.action.summary}</p>
        <div className={toolWell}>
          {d?.channel ? (
            <>
              <p className="text-[12px] font-bold text-neutral-400">
                To <span className="text-neutral-100">{d.channel}</span> · {item.action.kind}
              </p>
              <p className="text-[14px]/[21px] text-neutral-200">{d.text}</p>
            </>
          ) : (
            <pre className={toolOutput}>{JSON.stringify(item.action.details, null, 2)}</pre>
          )}
        </div>
        {rejecting && pending && (
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Tell the orchestrator why (it reads this next turn)…"
            rows={2}
            className="w-full resize-none rounded-lg border border-white/15 bg-neutral-950 p-2 text-[14px] text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-white/30"
          />
        )}
      </div>
      {pending ? (
        <div className={cx(panelFoot, "flex-wrap justify-end gap-2")}>
          {rejecting ? (
            <>
              <button type="button" onClick={() => setRejecting(false)} className={cx(ghostButton, buttonSm)}>
                Back
              </button>
              <button type="button" onClick={() => onDecide(item, "reject", note)} className={cx(secondaryButton, buttonSm)}>
                Reject
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setRejecting(true)} className={cx(ghostButton, buttonSm)}>
                Reject with a note
              </button>
              <button type="button" onClick={() => onDecide(item, "approve_always")} className={cx(secondaryButton, buttonSm)}>
                Approve &amp; always allow
              </button>
              <button type="button" onClick={() => onDecide(item, "approve")} className={cx(primaryButton, buttonSm)}>
                Approve
              </button>
            </>
          )}
        </div>
      ) : (
        <div className={cx(panelFoot, "nb-fade gap-2")}>
          {item.status === "approved" ? <Check className="size-4 text-emerald-400" aria-hidden="true" /> : <X className="size-4 text-red-400" aria-hidden="true" />}
          <span>
            {item.status === "approved" ? "Approved" : "Rejected"} by {item.by ?? "you"}
            {item.resolvedMs !== undefined && ` · ${fmtSecs(item.resolvedMs - item.tMs)} after the request`}
            {item.always && " · always allow saved"}
            {item.note && ` · “${item.note}”`}
          </span>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ item, view, onRevert }: { item: Extract<TItem, { t: "summary" }>; view: RunView; onRevert?: () => Promise<boolean> }) {
  const [reverted, setReverted] = useState<"no" | "busy" | "yes" | "none">("no");
  const secs = view.endedMs ?? view.lastTMs;
  const tiles: [string, number, (n: number) => string][] = [
    ["Cost", view.costUsd, fmtCost],
    ["Tokens", view.tokens, (n) => fmtTokens(Math.round(n))],
    ["Time", secs, fmtSecs],
    ["vs baseline", (view.savings ?? 0) * 100, (n) => (view.savings !== null ? `−${Math.round(n)}%` : "n/a")],
    ["Routed hops", item.summary.routedHops, (n) => String(Math.round(n))],
  ];
  return (
    <div className={panel}>
      <div className={panelHead}>
        <p className="text-[15px] font-extrabold">Run summary</p>
      </div>
      <div className={cx(panelBody, "gap-4 p-3")}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {tiles.map(([k, val, fmt]) => (
            <div key={k} className="rounded-lg bg-white/5 px-3 py-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">{k}</p>
              <p className="text-[18px] font-extrabold">
                <CountUp value={val} format={fmt} ms={600} />
              </p>
            </div>
          ))}
        </div>
        <div>
          <p className="mb-1 text-[12px] font-bold uppercase tracking-wide text-neutral-400">{item.summary.memories.length} memories saved</p>
          <ul className="flex flex-col gap-1">
            {item.summary.memories.map((m) => (
              <li key={m} className="text-[13px]/[19px] text-neutral-200">
                <span className="me-1.5 text-[var(--rb-accent)]">•</span>
                {m}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 flex items-center text-[12px] font-bold uppercase tracking-wide text-neutral-400">
            SKILL.md diff
            {onRevert && (
              <button
                type="button"
                disabled={reverted === "busy" || reverted === "yes"}
                onClick={async () => {
                  setReverted("busy");
                  setReverted((await onRevert()) ? "yes" : "none");
                }}
                className="ms-auto rounded-md px-2 py-1 text-[11px] font-extrabold normal-case tracking-normal text-neutral-200 hover:bg-white/10 disabled:opacity-60"
              >
                {reverted === "yes" ? "Reverted" : reverted === "none" ? "Nothing to revert" : reverted === "busy" ? "Reverting…" : "Revert skill change"}
              </button>
            )}
          </p>
          <SkillDiff rows={item.summary.skillDiff} />
        </div>
      </div>
    </div>
  );
}

export function SkillDiff({ rows }: { rows: { op: "+" | "-" | " "; text: string }[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/10 font-mono text-[12px]/[22px]">
      {rows.map((r, i) => (
        <div key={i} style={{ animationDelay: `${i * 40}ms` }} className={cx("nb-rise-fast flex gap-2 px-2", r.op === "+" && "bg-emerald-500/12 text-emerald-200", r.op === "-" && "bg-red-500/12 text-red-200 line-through decoration-red-300/40", r.op === " " && "text-neutral-400")}>
          <span className="w-3 shrink-0 select-none">{r.op === " " ? "" : r.op}</span>
          <span className="min-w-0 [overflow-wrap:anywhere]">{r.text}</span>
        </div>
      ))}
    </div>
  );
}
