"use client";

// The tour (docs/TOUR.md §1): a spotlight on the real UI, one element at a time. The rest of the page is blurred under
// a veil with a cut-out; the target keeps its real data, gets a mint ring and a small zoom; a two-line card (what it is
// · why it helps you, the video's words) sits on its emptier side. It never starts by itself, and Esc leaves it.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cue } from "./sound";
import { TwoLines } from "./why";
import { cx, primaryButton, secondaryButton, buttonSm } from "./ui";

export type TourStep = { target: string; what: string; why: string; zoom?: number; tab?: "memory" };

export const TOUR_STEPS: TourStep[] = [
  { target: "workstreams", what: "Workstreams", why: "Chores that run on a schedule", zoom: 1.02 },
  { target: "plan", what: "The plan", why: "Who does what, before anything runs" },
  { target: "estimate", what: "The price, first", why: "You see the cost before you approve" },
  { target: "lanes", what: "One row per agent", why: "They work at the same time", zoom: 1.02 },
  { target: "model-badge", what: "Model per step", why: "Ultra plans, Super writes, Nano checks" },
  { target: "approval-card", what: "Nothing leaves without you", why: "Approve, reject, or allow from now on" },
  { target: "rule-line", what: "One rule saved", why: "You can revoke it anytime" },
  { target: "memories", what: "What it learned", why: "The next run asks less", tab: "memory" },
  { target: "router-gauge", what: "It watches its own bill", why: "Cheaper routing, proposed, you approve" },
];

export const TOUR_SEEN = "nimbus.tour.seen";
const PAD = 12;
const find = (name: string) => [...document.querySelectorAll<HTMLElement>(`[data-demo="${name}"]`)].find((el) => el.getClientRects().length > 0) ?? null;

type Rect = { x: number; y: number; w: number; h: number };

export function Tour({ onClose, onOpenRun, setTab, tab, reducedMotion, hasRun }: { onClose: () => void; onOpenRun: () => void; setTab: (t: "artifact" | "agent" | "memory") => void; tab: "artifact" | "agent" | "memory"; reducedMotion: boolean; hasRun: boolean }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const zoomed = useRef<{ el: HTMLElement; transform: string; transition: string; origin: string } | null>(null);
  const startTab = useRef(tab);

  // the steps whose targets are on this page (a step needing the Memory tab counts: the tour opens it)
  const [steps] = useState(() => TOUR_STEPS.filter((s) => (s.tab && hasRun) || find(s.target)));
  const step = steps[i];
  const last = i === steps.length - 1;

  const unzoom = () => {
    const z = zoomed.current;
    if (!z) return;
    z.el.style.transform = z.transform;
    z.el.style.transformOrigin = z.origin;
    setTimeout(() => (z.el.style.transition = z.transition), 220);
    zoomed.current = null;
  };

  const measure = useCallback(() => {
    if (!step) return;
    const el = find(step.target);
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    setRect({ x: r.left, y: r.top, w: r.width, h: r.height });
  }, [step]);

  // enter a step: show the UI state it needs, scroll the target into view, zoom it, measure
  useLayoutEffect(() => {
    if (!step) return;
    setTab(step.tab ?? startTab.current);
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      const el = find(step.target);
      if (!el) return setRect(null);
      el.scrollIntoView({ block: "center", inline: "nearest" });
      if (!reducedMotion) {
        zoomed.current = { el, transform: el.style.transform, transition: el.style.transition, origin: el.style.transformOrigin };
        el.style.transformOrigin = "center";
        el.style.transition = "transform 200ms ease-out";
        el.style.transform = `scale(${step.zoom ?? 1.04})`;
      }
      requestAnimationFrame(measure);
    }, step.tab ? 120 : 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
      unzoom();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => (window.removeEventListener("resize", measure), window.removeEventListener("scroll", measure, true));
  }, [measure]);

  const close = useCallback(() => {
    unzoom();
    setTab(startTab.current);
    try {
      window.localStorage.setItem(TOUR_SEEN, "1");
    } catch {
      /* not remembered */
    }
    cue("close", { emphasis: "subtle" });
    onClose();
  }, [onClose, setTab]);
  const go = useCallback(
    (d: 1 | -1) => {
      if (d === 1 && last) return close();
      setI((n) => Math.min(steps.length - 1, Math.max(0, n + d)));
      cue("select", { direction: d === 1 ? "forward" : "back" });
    },
    [last, close, steps.length],
  );

  useEffect(() => cue("open", { emphasis: "subtle" }), []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") return void (e.preventDefault(), close());
      if (e.key === "ArrowRight" || e.key === "Enter") return void (e.preventDefault(), go(1));
      if (e.key === "ArrowLeft") return void (e.preventDefault(), go(-1));
    };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [go, close]);

  if (!step) return null;
  const vw = typeof window === "undefined" ? 1440 : window.innerWidth;
  const vh = typeof window === "undefined" ? 900 : window.innerHeight;
  const hole = rect ? { x: rect.x - PAD, y: rect.y - PAD, w: rect.w + 2 * PAD, h: rect.h + 2 * PAD } : null;
  const r = 14;
  // the veil: the whole screen minus a rounded cut-out around the target (evenodd)
  const clip = hole
    ? `path(evenodd, "M0 0H${vw}V${vh}H0Z M${hole.x + r} ${hole.y}H${hole.x + hole.w - r}A${r} ${r} 0 0 1 ${hole.x + hole.w} ${hole.y + r}V${hole.y + hole.h - r}A${r} ${r} 0 0 1 ${hole.x + hole.w - r} ${hole.y + hole.h}H${hole.x + r}A${r} ${r} 0 0 1 ${hole.x} ${hole.y + hole.h - r}V${hole.y + r}A${r} ${r} 0 0 1 ${hole.x + r} ${hole.y}Z")`
    : undefined;

  // the card goes on the emptier side of the target, kept on screen
  const CW = 300;
  const CH = 132;
  let card = { left: vw / 2 - CW / 2, top: vh / 2 - CH / 2 };
  if (hole) {
    const space = { right: vw - (hole.x + hole.w), left: hole.x, below: vh - (hole.y + hole.h), above: hole.y };
    const best = (Object.entries(space) as [keyof typeof space, number][]).sort((a, b) => b[1] - a[1])[0][0];
    if (best === "right") card = { left: hole.x + hole.w + 16, top: hole.y };
    else if (best === "left") card = { left: hole.x - CW - 16, top: hole.y };
    else if (best === "below") card = { left: hole.x, top: hole.y + hole.h + 16 };
    else card = { left: hole.x, top: hole.y - CH - 16 };
    card = { left: Math.min(vw - CW - 16, Math.max(16, card.left)), top: Math.min(vh - CH - 16, Math.max(16, card.top)) };
  }
  const overviewOnly = !hasRun && last;

  // on document.body: inside <main> (an isolated stacking context) the rail and the Inspector would sit above the veil
  return createPortal(
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={`Tour, step ${i + 1} of ${steps.length}: ${step.what}`}>
      <div onClick={close} className={cx("absolute inset-0 bg-neutral-950/55 backdrop-blur-[6px]", !reducedMotion && "nb-fade")} style={{ clipPath: clip }} />
      {hole && (
        <div aria-hidden="true" key={i} className={cx("pointer-events-none absolute rounded-[14px] ring-2 ring-[var(--rb-accent)]", !reducedMotion && "nb-fade")} style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }} />
      )}
      <div key={`c${i}`} className={cx("absolute rounded-[var(--rb-r-xl,14px)] border border-white/10 bg-neutral-900/92 px-5 py-4 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.75)] backdrop-blur-md", !reducedMotion && "nb-rise-fast")} style={{ left: card.left, top: card.top, width: CW }}>
        <TwoLines what={overviewOnly ? step.what : step.what} why={step.why} />
        {overviewOnly && <p className="mt-2 text-[13px] text-neutral-300">Open a run to see the rest.</p>}
        <div className="mt-3 flex items-center gap-2">
          <span className="flex flex-1 gap-1" aria-hidden="true">
            {steps.map((_, k) => (
              <span key={k} className={cx("size-1.5 rounded-full", k === i ? "bg-[var(--rb-accent)]" : "bg-white/20")} />
            ))}
          </span>
          <button type="button" onClick={close} className={cx(secondaryButton, buttonSm)}>
            Skip
          </button>
          {overviewOnly ? (
            <button type="button" onClick={() => (close(), onOpenRun())} className={cx(primaryButton, buttonSm)}>
              Open a run
            </button>
          ) : (
            <button type="button" autoFocus onClick={() => go(1)} className={cx(primaryButton, buttonSm)}>
              {last ? "Done" : "Next"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
