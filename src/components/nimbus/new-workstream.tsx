"use client";

// "+ New workstream" (rail, and /new in the composer): a standing goal of your own. Name, the goal, a schedule, the tools
// it may use; Create inserts it (POST /api/workstreams), selects it and puts the goal in the composer for the first run.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { TOOL_LABELS } from "@/lib/workstreams";
import { buttonSm, cx, panelGlass, primaryButton, secondaryButton } from "./ui";

const KINDS = [
  { key: "", label: "On demand" },
  { key: "daily", label: "Daily" },
  { key: "weekdays", label: "Weekdays" },
  { key: "mondays", label: "Mondays" },
] as const;

const field = "h-9 w-full rounded-lg border border-white/12 bg-neutral-950/60 px-3 text-[14px] text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-white/30";

export function NewWorkstream({ onCancel, onCreated }: { onCancel: () => void; onCreated: (ws: { id: string; goal: string }) => void }) {
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]["key"]>("");
  const [time, setTime] = useState("08:00");
  const [tools, setTools] = useState<string[]>(["web_search", "fetch_url", "write_artifact"]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => nameRef.current?.focus(), []);

  const create = async () => {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/workstreams", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, goal, tools, schedule: kind ? { kind, time } : null }),
    }).catch(() => null);
    setBusy(false);
    if (!r) return setError("Could not reach the server.");
    const j = (await r.json().catch(() => ({}))) as { id?: string; goal?: string; error?: string };
    if (!r.ok || !j.id) return setError(j.error ?? "Could not create it.");
    onCreated({ id: j.id, goal: j.goal ?? goal });
  };

  // Portalled to <body>: inside <main> a transformed ancestor pins `fixed` to the column, and the sheet runs off the
  // window (the chips and Create were clipped). The veil covers the rail and the inspector too.
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-neutral-950/60 p-4 backdrop-blur-[2px]" onClick={(e) => e.target === e.currentTarget && onCancel()}>
    <div role="dialog" aria-modal="true" aria-label="New workstream" onKeyDown={(e) => e.key === "Escape" && onCancel()} className={cx(panelGlass, "nb-rise-fast my-auto w-[min(560px,calc(100vw-32px))] max-h-[calc(100dvh-32px)] gap-3 overflow-y-auto p-5")}>
      <p className="text-[15px] font-extrabold">New workstream</p>
      <label className="flex flex-col gap-1 text-[12px] font-bold text-neutral-400">
        Name
        <input ref={nameRef} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Weekly invoices" maxLength={60} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-[12px] font-bold text-neutral-400">
        The standing goal
        <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} maxLength={600} placeholder="Every Monday: read the invoices folder, list what is due this week and draft the reminders." className={cx(field, "h-auto resize-none py-2 [field-sizing:content]")} />
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[12px] font-bold text-neutral-400">
          Schedule
          <span className="relative">
            <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} data-cuelume-select="" className={cx(field, "w-44 appearance-none pe-8")}>
            {KINDS.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </select>
            <ChevronDown className="pointer-events-none absolute end-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          </span>
        </label>
        {kind && (
          <label className="flex flex-col gap-1 text-[12px] font-bold text-neutral-400">
            At
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={cx(field, "w-32")} />
          </label>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-[12px] font-bold text-neutral-400">Tools it may use</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Tools it may use">
          {Object.entries(TOOL_LABELS).map(([k, l]) => {
            const on = tools.includes(k);
            return (
              <button key={k} type="button" aria-pressed={on} data-cuelume-toggle="" onClick={() => setTools(on ? tools.filter((t) => t !== k) : [...tools, k])} className={cx("h-7 rounded-full border px-3 text-[12px] font-bold transition-colors", on ? "border-transparent bg-[var(--rb-accent)] text-[var(--rb-accent-fg)]" : "border-white/15 text-neutral-300 hover:bg-white/10")}>
                {l}
              </button>
            );
          })}
        </div>
      </div>
      {error && <p className="text-[13px] text-red-300">{error}</p>}
      <div className="sticky -bottom-5 -mx-5 -mb-5 flex justify-end gap-2 rounded-b-[inherit] bg-neutral-900/92 px-5 pb-5 pt-3 backdrop-blur-md">
        <button type="button" data-cuelume-close="" onClick={onCancel} className={cx(secondaryButton, buttonSm)}>
          Cancel
        </button>
        <button type="button" data-cuelume-tap="" disabled={busy || !title.trim() || !goal.trim() || !tools.length} onClick={() => void create()} className={cx(primaryButton, buttonSm)}>
          Create
        </button>
      </div>
    </div>
    </div>,
    document.body,
  );
}
