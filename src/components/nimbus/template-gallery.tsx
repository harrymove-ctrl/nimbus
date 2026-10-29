"use client";

// "Start from a template" at the top of the New workstream sheet: one card per templates/*.yaml (GET /api/templates).
// Picking one fills the form below; the template's SKILL.md seed and sample files come along when the workstream is made.
import { useEffect, useState } from "react";
import type { CrewRole } from "@/lib/roles";
import { roleTitle } from "@/lib/roles";
import { ROLE_COLOR } from "@/lib/run-view";
import { cx } from "./ui";

export type TemplateCard = {
  slug: string;
  title: string;
  goal: string;
  schedule?: string;
  scheduleLabel: string;
  tools: string[];
  roles: CrewRole[];
  attachments: string[];
};

type Load = { state: "loading" } | { state: "error" } | { state: "ready"; templates: TemplateCard[] };

export function TemplateGallery({ picked, onPick }: { picked: string | null; onPick: (t: TemplateCard | null) => void }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  useEffect(() => {
    let live = true;
    fetch("/api/templates")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { templates: TemplateCard[] }) => live && setLoad({ state: "ready", templates: j.templates }))
      .catch(() => live && setLoad({ state: "error" }));
    return () => {
      live = false;
    };
  }, []);

  if (load.state === "error") return <p className="text-[12px] text-neutral-500">Templates did not load. Fill the form below instead.</p>;
  if (load.state === "ready" && !load.templates.length) return null;
  return (
    <section className="flex min-w-0 shrink-0 flex-col gap-1.5" aria-label="Start from a template">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[12px] font-bold text-neutral-400">Start from a template</p>
        {picked && (
          <button type="button" onClick={() => onPick(null)} className="text-[12px] font-bold text-neutral-400 underline-offset-2 hover:text-neutral-200 hover:underline">
            Start blank
          </button>
        )}
      </div>
      {/* one row that scrolls sideways: nine cards fit a phone without pushing the form off the sheet */}
      <div className="-mx-5 flex shrink-0 snap-x snap-mandatory scroll-px-5 gap-2 overflow-x-auto px-5 pb-2 [scrollbar-color:rgb(255_255_255/0.18)_transparent] [scrollbar-width:thin]" role="list">
        {load.state === "loading"
          ? [0, 1, 2].map((i) => <div key={i} role="listitem" aria-hidden="true" className="h-[148px] w-[208px] shrink-0 animate-pulse rounded-xl border border-white/10 bg-white/5 motion-reduce:animate-none" />)
          : load.templates.map((t) => {
              const on = picked === t.slug;
              const crew = t.roles.filter((r) => r.role !== "learner");
              return (
                <div key={t.slug} role="listitem" className="flex shrink-0 snap-start">
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-label={`${t.title}: ${t.scheduleLabel}, crew ${crew.map((r) => roleTitle(r.role)).join(", ")}`}
                    aria-describedby={`tpl-goal-${t.slug}`}
                    data-cuelume-toggle=""
                    onClick={() => onPick(on ? null : t)}
                    className={cx(
                      "flex min-h-[148px] w-[208px] flex-col gap-1.5 rounded-xl border p-3 text-start transition-colors [&>*]:shrink-0",
                      on ? "border-[var(--rb-accent)] bg-[color-mix(in_oklab,var(--rb-accent)_12%,transparent)]" : "border-white/12 bg-neutral-950/40 hover:border-white/25 hover:bg-white/5",
                    )}
                  >
                    <span className="truncate text-[14px] font-extrabold text-neutral-100">{t.title}</span>
                    <span id={`tpl-goal-${t.slug}`} className="line-clamp-2 text-[12px]/[16px] text-neutral-400">{t.goal}</span>
                    <span className="mt-auto flex flex-wrap gap-1" aria-hidden="true">
                      {crew.slice(0, 4).map((r) => (
                        <span key={r.role} className="inline-flex h-5 max-w-[92px] items-center gap-1 rounded-full bg-white/8 px-1.5 text-[11px] font-bold text-neutral-200">
                          <span className="size-1.5 shrink-0 rounded-full" style={{ background: ROLE_COLOR[r.role] }} aria-hidden="true" />
                          <span className="truncate">{roleTitle(r.role)}</span>
                        </span>
                      ))}
                      {crew.length > 4 && <span className="text-[11px] font-bold text-neutral-500">+{crew.length - 4}</span>}
                    </span>
                    <span className="text-[11px] font-bold text-neutral-500">{t.scheduleLabel}</span>
                  </button>
                </div>
              );
            })}
      </div>
    </section>
  );
}
