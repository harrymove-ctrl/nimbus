"use client";

import { useEffect, useState, type ReactNode } from "react";
import { DitherGlow } from "@/components/dithercn/dither-glow";
import { Skeleton } from "@/components/dithercn/skeleton";

// Dither placements (docs/DITHER.md). Sweep = waiting on the network, pulse = waiting on the crew: keep the mapping strict.
// The library's `delay` only offsets the first sweep, so the "never flash for a fast fetch" rule lives here: nothing shows
// before 150 ms of waiting. Reduced motion is handled by the library (no sweep, the pulse holds still).

/** True once `ms` have passed while `active`; false again as soon as the wait ends. */
export function useAfter(ms: number, active: boolean) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!active) return setDone(false);
    const t = setTimeout(() => setDone(true), ms);
    return () => clearTimeout(t);
  }, [ms, active]);
  return done && active;
}

function Delayed({ active, label, children }: { active: boolean; label: string; children: ReactNode }) {
  const show = useAfter(typeof window !== "undefined" && window.location.search.includes("loaders") ? 0 : 150, active);
  if (!show) return null;
  return (
    <div aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Rail while GET /api/workstreams is in flight: three items, a title line and a shorter meta line, sweep 1.2 s. */
export function RailSkeleton({ active }: { active: boolean }) {
  return (
    <Delayed active={active} label="Loading workstreams">
      <div className="flex flex-col gap-0.5 px-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex h-[52px] flex-col justify-center px-3">
            <Skeleton shape="text" lines={2} cell={3} duration={1.2} delay={i * 0.12} animation="sweep" />
          </div>
        ))}
      </div>
    </Delayed>
  );
}

/** Transcript before the plan card arrives: a plan-card-shaped block that pulses (waiting on the crew), 1.6 s. */
export function PlanSkeleton({ active }: { active: boolean }) {
  return (
    <Delayed active={active} label="The crew is planning">
      <Skeleton shape="block" animation="pulse" cell={3} duration={1.6} className="h-[156px] w-full rounded-[10px]" />
    </Delayed>
  );
}

/** Inspector body while the run's events load: six text lines (or a heading and five for the artifact), sweep 1.2 s. */
export function InspectorSkeleton({ active, doc }: { active: boolean; doc?: boolean }) {
  return (
    <Delayed active={active} label="Loading">
      <div className="flex flex-col gap-3 p-5">
        {doc && <Skeleton shape="block" animation="sweep" cell={3} duration={1.2} className="h-5 w-1/2 rounded-[4px]" />}
        <Skeleton shape="text" lines={doc ? 5 : 6} cell={3} duration={1.2} animation="sweep" />
      </div>
    </Delayed>
  );
}

/** Ambient background behind the run view and the empty state: one soft glow at the top left, at most 8 % ink, cell 3. */
export function AmbientGlow({ paused }: { paused: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
      <DitherGlow position="top-left" radius={0.7} intensity={0.6} cell={3} speed={0.5} animate={!paused} className="absolute inset-0 opacity-[0.07]" />
    </div>
  );
}
