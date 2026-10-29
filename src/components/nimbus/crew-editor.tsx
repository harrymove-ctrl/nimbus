"use client";

// "Crew" in the New workstream sheet: the roles the Orchestrator may plan with, as chips. A chip opens its name, tier
// and brief; add a role, remove one, or go back to the default five. The server checks the list again (parseRoles).
import { useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import type { Tier } from "@/lib/models";
import { DEFAULT_ROLES, MAX_ROLES, isDefaultCrew, roleSlug, roleTitle, type CrewRole } from "@/lib/roles";
import { ROLE_COLOR, TIER_SHORT } from "@/lib/run-view";
import { cx } from "./ui";

const field = "w-full rounded-lg border border-white/12 bg-neutral-950/60 px-3 text-[14px] text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-white/30";

/** What stops this crew from being saved, in a sentence, or null. */
export function crewProblem(roles: CrewRole[]): string | null {
  const names = roles.map((r) => roleSlug(r.role));
  if (!roles.some((r, i) => names[i] && names[i] !== "learner")) return "The crew needs at least one role besides the Learner.";
  const i = roles.findIndex((r, k) => !names[k] || !r.brief.trim());
  if (i >= 0) return `Role ${i + 1} needs a name and a brief.`;
  if (names.includes("orchestrator")) return "The Orchestrator leads every crew; give that role another name.";
  const dup = names.find((n, k) => names.indexOf(n) !== k);
  return dup ? `Two roles are named "${roleTitle(dup)}".` : null;
}

export function CrewEditor({ roles, onChange }: { roles: CrewRole[]; onChange: (roles: CrewRole[]) => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const set = (i: number, patch: Partial<CrewRole>) => onChange(roles.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => {
    onChange(roles.filter((_, k) => k !== i));
    setOpen(null);
  };
  const add = () => {
    onChange([...roles, { role: "", brief: "", tier: "super" }]);
    setOpen(roles.length);
  };
  const cur = open !== null ? roles[open] : undefined;

  return (
    <section className="flex shrink-0 flex-col gap-1.5" aria-label="Crew">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[12px] font-bold text-neutral-400">Crew</p>
        {!isDefaultCrew(roles) && (
          <button type="button" onClick={() => (onChange(DEFAULT_ROLES), setOpen(null))} className="text-[12px] font-bold text-neutral-400 underline-offset-2 hover:text-neutral-200 hover:underline">
            Default five
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Roles">
        {roles.map((r, i) => {
          const name = roleSlug(r.role);
          return (
            <button
              key={i}
              type="button"
              aria-expanded={open === i}
              aria-controls="crew-role-editor"
              aria-label={`${name ? roleTitle(name) : "New role"}, ${TIER_SHORT[r.tier]}: edit`}
              onClick={() => setOpen(open === i ? null : i)}
              className={cx("inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-bold transition-colors", open === i ? "border-white/40 bg-white/10 text-neutral-100" : "border-white/15 text-neutral-300 hover:bg-white/10")}
            >
              <span className="size-2 shrink-0 rounded-full" style={{ background: name ? ROLE_COLOR[name] : "var(--color-neutral-500)" }} aria-hidden="true" />
              <span className="truncate">{name ? roleTitle(name) : "New role"}</span>
              <span className="text-neutral-500">{TIER_SHORT[r.tier]}</span>
              <ChevronDown className={cx("size-3.5 shrink-0 text-neutral-500 transition-transform", open === i && "rotate-180")} aria-hidden="true" />
            </button>
          );
        })}
        <button type="button" disabled={roles.length >= MAX_ROLES} onClick={add} className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-white/20 px-2.5 text-[12px] font-bold text-neutral-300 hover:bg-white/10 disabled:opacity-40">
          <Plus className="size-3.5" aria-hidden="true" />
          Add role
        </button>
      </div>
      {cur && open !== null && (
        // keyed by the role: switching chips (or adding one) mounts a fresh editor, so a new role's name gets the focus
        <div key={open} id="crew-role-editor" className="flex flex-col gap-2 rounded-xl border border-white/10 bg-neutral-950/40 p-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-[12px] font-bold text-neutral-400">
              Name
              <input value={cur.role} onChange={(e) => set(open, { role: e.target.value })} onBlur={() => set(open, { role: roleSlug(cur.role) })} maxLength={24} placeholder="tutor" autoFocus={!cur.role} className={cx(field, "h-9")} />
            </label>
            <label className="flex flex-col gap-1 text-[12px] font-bold text-neutral-400">
              Model tier
              <span className="relative">
                <select value={cur.tier} onChange={(e) => set(open, { tier: e.target.value as Tier })} data-cuelume-select="" className={cx(field, "h-9 w-32 appearance-none pe-8")}>
                  <option value="ultra">Ultra</option>
                  <option value="super">Super</option>
                  <option value="nano">Nano</option>
                </select>
                <ChevronDown className="pointer-events-none absolute end-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
              </span>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-[12px] font-bold text-neutral-400">
            Brief
            <textarea value={cur.brief} onChange={(e) => set(open, { brief: e.target.value })} rows={3} maxLength={1200} placeholder="What this role does, which tool it uses and what it reports back." className={cx(field, "h-auto resize-none py-2 [field-sizing:content]")} />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] text-neutral-500">
              {roleSlug(cur.role) === "learner" ? "Without the Learner, runs stop updating SKILL.md and memories." : cur.tools ? `Tools: ${cur.tools.length ? cur.tools.join(", ") : "none"}` : "Tools: the ones this workstream may use"}
            </p>
            <button type="button" onClick={() => remove(open)} className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-[12px] font-bold text-red-300 hover:bg-red-500/10">
              <X className="size-3.5" aria-hidden="true" />
              Remove role
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
