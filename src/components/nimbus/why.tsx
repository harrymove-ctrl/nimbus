"use client";

// The quiet annotation (docs/TOUR.md §2): a small dot on one meaningful decision that opens the same two-line card as
// the tour (what it is · why it helps you) on hover or focus, pinned by a click. Nothing else on the page changes.
import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from "react";
import { cx } from "./ui";

export function TwoLines({ what, why, className }: { what: string; why: string; className?: string }) {
  return (
    <span className={cx("block", className)}>
      <span className="block text-[15px]/[20px] font-semibold text-neutral-50">{what}</span>
      <span className="mt-0.5 block text-[13px]/[18px] font-medium text-neutral-400">{why}</span>
    </span>
  );
}

export function Why({ what, why, children, side = "auto", className }: { what: string; why: string; children: ReactNode; side?: "auto" | "above" | "below"; className?: string }) {
  const id = useId();
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [below, setBelow] = useState(true);
  const dot = useRef<HTMLButtonElement>(null);
  const open = hover || pinned;
  useEffect(() => {
    if (!open || side !== "auto" || !dot.current) return;
    setBelow(dot.current.getBoundingClientRect().top < window.innerHeight / 2);
  }, [open, side]);
  useEffect(() => {
    if (!pinned) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setPinned(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [pinned]);
  const showBelow = side === "below" || (side === "auto" && below);
  // the control itself gets the two lines as its description
  const control = isValidElement(children) ? cloneElement(children as ReactElement<{ "aria-describedby"?: string }>, { "aria-describedby": id }) : children;
  return (
    <span className={cx("relative inline-flex", className)} onMouseLeave={() => setHover(false)}>
      {control}
      <span id={id} className="sr-only">
        {what}. {why}.
      </span>
      <button
        ref={dot}
        type="button"
        aria-label={`Why: ${what}`}
        aria-expanded={open}
        onMouseEnter={() => setHover(true)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        onClick={() => setPinned((p) => !p)}
        className="absolute -right-1.5 -top-1.5 z-10 grid size-4 place-items-center rounded-full outline-none"
      >
        <span className={cx("size-2.5 rounded-full border transition-colors", open ? "border-[var(--rb-accent)] bg-[var(--rb-accent)]" : "border-neutral-500 bg-neutral-900")} aria-hidden="true" />
      </button>
      {open && (
        <span role="tooltip" className={cx("nb-fade pointer-events-none absolute right-0 z-50 w-64 rounded-[var(--rb-r-xl,14px)] border border-white/10 bg-neutral-900/92 px-5 py-4 text-left shadow-[0_12px_32px_-12px_rgba(0,0,0,0.7)] backdrop-blur-md", showBelow ? "top-full mt-2" : "bottom-full mb-2")}>
          <TwoLines what={what} why={why} />
        </span>
      )}
    </span>
  );
}
