"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { motion, useReducedMotion } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  ArrowDown02Icon,
  ArrowRight01Icon,
  ArrowUp02Icon,
  Copy01Icon,
  Download04Icon,
  FileScriptIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

const canvas = "bg-white dark:bg-neutral-950";
const text1 = "text-neutral-900 dark:text-neutral-100";
const text2 = "text-neutral-900/78 dark:text-neutral-100/78";
const text3 = "text-neutral-900/62 dark:text-neutral-100/62";
const typeHeadingXs = "text-[17px]/[22px] font-extrabold";
const typeBodySm = "text-[14px]/[20px] font-medium";
const typeCode = "font-mono text-[13px]/[20px] tabular-nums";
const typeCodeSm = "font-mono text-[12px]/[16px] tabular-nums";
const primaryButton =
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap select-none transition-[color,background-color,border-color,box-shadow,outline-color,scale,translate,filter] duration-[240ms] ease-[cubic-bezier(0.34,1.45,0.64,1)] active:duration-[90ms] motion-reduce:active:translate-y-0 disabled:cursor-not-allowed aria-busy:cursor-progress focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color-mix(in_oklab,var(--rb-accent,oklch(84%_0.15_165))_58%,black)] dark:focus-visible:outline-[var(--rb-accent,oklch(81%_0.16_163))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--rb-accent,oklch(84%_0.15_165))_68%,white),var(--rb-accent,oklch(84%_0.15_165)))] text-[var(--rb-accent-fg,oklch(26%_0.06_168))] shadow-[inset_0_1px_0_rgb(255_255_255/0.5),inset_0_-2px_0_color-mix(in_oklab,var(--rb-accent,oklch(84%_0.15_165))_70%,black),0_0_0_1px_color-mix(in_oklab,var(--rb-accent,oklch(84%_0.15_165))_70%,black),0_4px_10px_-4px_color-mix(in_oklab,var(--rb-accent,oklch(84%_0.15_165))_80%,transparent)] hover:not-disabled:-translate-y-px hover:not-disabled:brightness-[1.04] hover:not-disabled:shadow-[inset_0_1px_0_rgb(255_255_255/0.5),inset_0_-2px_0_color-mix(in_oklab,var(--rb-accent,oklch(84%_0.15_165))_70%,black),0_0_0_1px_color-mix(in_oklab,var(--rb-accent,oklch(84%_0.15_165))_70%,black),0_7px_16px_-6px_color-mix(in_oklab,var(--rb-accent,oklch(84%_0.15_165))_85%,transparent)] active:not-disabled:translate-y-px active:not-disabled:brightness-[0.98] active:not-disabled:shadow-[inset_0_2px_4px_color-mix(in_oklab,var(--rb-accent,oklch(84%_0.15_165))_55%,black),0_0_0_1px_color-mix(in_oklab,var(--rb-accent,oklch(84%_0.15_165))_70%,black)] motion-reduce:hover:translate-y-0 disabled:opacity-45 disabled:shadow-none dark:bg-[linear-gradient(180deg,color-mix(in_oklab,var(--rb-accent,oklch(81%_0.16_163))_78%,white),var(--rb-accent,oklch(81%_0.16_163)))] dark:text-[var(--rb-accent-fg,oklch(26%_0.06_168))] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.45),inset_0_-2px_0_color-mix(in_oklab,var(--rb-accent,oklch(81%_0.16_163))_58%,black),0_0_0_1px_color-mix(in_oklab,var(--rb-accent,oklch(81%_0.16_163))_55%,black),0_6px_16px_-6px_color-mix(in_oklab,var(--rb-accent,oklch(81%_0.16_163))_55%,transparent)] dark:hover:not-disabled:shadow-[inset_0_1px_0_rgb(255_255_255/0.45),inset_0_-2px_0_color-mix(in_oklab,var(--rb-accent,oklch(81%_0.16_163))_58%,black),0_0_0_1px_color-mix(in_oklab,var(--rb-accent,oklch(81%_0.16_163))_55%,black),0_9px_22px_-8px_color-mix(in_oklab,var(--rb-accent,oklch(81%_0.16_163))_60%,transparent)] dark:active:not-disabled:shadow-[inset_0_2px_4px_color-mix(in_oklab,var(--rb-accent,oklch(81%_0.16_163))_45%,black),0_0_0_1px_color-mix(in_oklab,var(--rb-accent,oklch(81%_0.16_163))_55%,black)] dark:disabled:shadow-none";
const secondaryButton =
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap select-none transition-[color,background-color,border-color,box-shadow,outline-color,scale,translate,filter] duration-[240ms] ease-[cubic-bezier(0.34,1.45,0.64,1)] active:duration-[90ms] motion-reduce:active:translate-y-0 disabled:cursor-not-allowed aria-busy:cursor-progress focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color-mix(in_oklab,var(--rb-accent,oklch(84%_0.15_165))_58%,black)] dark:focus-visible:outline-[var(--rb-accent,oklch(81%_0.16_163))] border border-transparent bg-[linear-gradient(180deg,#ffffff,var(--rb-n-100,oklch(97.7%_0.0055_80)))] dark:bg-[linear-gradient(180deg,color-mix(in_oklab,var(--color-neutral-700)_55%,var(--color-neutral-800)),var(--color-neutral-800))] shadow-[0_0_0_1px_rgb(84_62_32/0.10),0_1px_1px_rgb(84_62_32/0.07),0_2px_5px_-2px_rgb(84_62_32/0.14)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_0_0_1px_rgb(0_0_0/0.6),0_2px_4px_-1px_rgb(0_0_0/0.5)] text-neutral-900 dark:text-neutral-100 hover:not-disabled:bg-[linear-gradient(180deg,#ffffff,color-mix(in_oklab,var(--rb-n-200,oklch(92.8%_0.009_76))_74%,white))] dark:hover:not-disabled:bg-[linear-gradient(180deg,var(--color-neutral-700),color-mix(in_oklab,var(--color-neutral-700)_55%,var(--color-neutral-800)))] active:not-disabled:translate-y-px active:not-disabled:shadow-[inset_0_1px_3px_rgb(84_62_32/0.16),0_0_0_1px_rgb(84_62_32/0.10)] dark:active:not-disabled:shadow-[inset_0_1px_3px_rgb(0_0_0/0.6),0_0_0_1px_rgb(0_0_0/0.6)] aria-expanded:bg-none aria-expanded:bg-[var(--rb-n-200,oklch(92.8%_0.009_76))] aria-expanded:shadow-[inset_0_1px_3px_rgb(84_62_32/0.14),0_0_0_1px_rgb(84_62_32/0.10)] dark:aria-expanded:bg-neutral-800 dark:aria-expanded:shadow-[inset_0_1px_3px_rgb(0_0_0/0.6),0_0_0_1px_rgb(0_0_0/0.6)] disabled:bg-none disabled:bg-[color-mix(in_oklab,var(--rb-n-200,oklch(92.8%_0.009_76))_58%,white)] disabled:text-neutral-900/40 disabled:shadow-none dark:disabled:bg-neutral-800/60 dark:disabled:text-neutral-100/40";
const ghostButton =
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap select-none transition-[color,background-color,border-color,box-shadow,outline-color,scale,translate,filter] duration-[240ms] ease-[cubic-bezier(0.34,1.45,0.64,1)] active:duration-[90ms] motion-reduce:active:translate-y-0 disabled:cursor-not-allowed aria-busy:cursor-progress focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color-mix(in_oklab,var(--rb-accent,oklch(84%_0.15_165))_58%,black)] dark:focus-visible:outline-[var(--rb-accent,oklch(81%_0.16_163))] bg-transparent text-neutral-900 hover:not-disabled:bg-[color-mix(in_oklab,var(--rb-n-200,oklch(92.8%_0.009_76))_74%,white)] active:not-disabled:bg-[var(--rb-n-200,oklch(92.8%_0.009_76))] aria-pressed:bg-[color-mix(in_oklab,var(--rb-accent,oklch(84%_0.15_165))_22%,transparent)] disabled:text-neutral-900/40 dark:text-neutral-100 dark:hover:not-disabled:bg-neutral-100/8 dark:active:not-disabled:bg-neutral-100/12 dark:aria-pressed:bg-[color-mix(in_oklab,var(--rb-accent,oklch(81%_0.16_163))_18%,transparent)] dark:disabled:text-neutral-100/40";
const buttonSm =
  "h-8 gap-1.5 rounded-[calc(var(--rb-r-full,999px))] px-3.5 text-[14px]/[18px] font-bold";
const buttonMd =
  "h-10 gap-2 rounded-[calc(var(--rb-r-full,999px))] px-5 text-[15px]/[20px] font-bold";
const iconButtonXs = "size-7 rounded-[calc(var(--rb-r-full,999px))]";
const iconButtonSm = "size-8 rounded-[calc(var(--rb-r-full,999px))]";
const segmentedTrack =
  "inline-flex w-fit max-w-full items-stretch gap-1 rounded-[calc(var(--rb-r-full,999px)_+_min(4px,var(--rb-r-full,999px)))] bg-[color-mix(in_oklab,var(--rb-n-200,oklch(92.8%_0.009_76))_58%,white)] dark:bg-neutral-950 shadow-[inset_0_1px_2px_rgb(84_62_32/0.09),inset_0_0_0_1px_rgb(84_62_32/0.035)] dark:shadow-[inset_0_1px_2px_rgb(0_0_0/0.6),inset_0_0_0_1px_rgb(255_255_255/0.045)] p-1";
const segmentedSm = "h-9";
const segmentXs =
  "relative inline-flex min-w-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap [&_svg]:shrink-0 rounded-[calc(var(--rb-r-full,999px))] px-3 text-[13px]/[16px] font-bold tabular-nums text-neutral-900/78 dark:text-neutral-100/78 select-none transition-[background-color,color,box-shadow,outline-color,scale] duration-[240ms] ease-[cubic-bezier(0.34,1.45,0.64,1)] active:scale-[0.96] motion-reduce:active:scale-100 hover:not-aria-checked:text-neutral-900 aria-checked:bg-white aria-checked:text-neutral-900 aria-checked:shadow-[0_0_0_1px_rgb(84_62_32/0.10),0_1px_2px_rgb(84_62_32/0.10),0_3px_8px_-2px_rgb(84_62_32/0.20)] disabled:cursor-not-allowed disabled:text-neutral-900/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color-mix(in_oklab,var(--rb-accent,oklch(84%_0.15_165))_58%,black)] dark:focus-visible:outline-[var(--rb-accent,oklch(81%_0.16_163))] dark:hover:not-aria-checked:text-neutral-100 dark:aria-checked:bg-[color-mix(in_oklab,var(--color-neutral-700)_55%,var(--color-neutral-800))] dark:aria-checked:text-neutral-100 dark:aria-checked:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),0_0_0_1px_rgb(0_0_0/0.6),0_2px_5px_-1px_rgb(0_0_0/0.6)] dark:disabled:text-neutral-100/40";
const statusWord =
  "inline-flex items-start gap-1.5 text-[15px]/[20px] font-bold tabular-nums";
const statusIdle = "text-neutral-900/62 dark:text-neutral-100/62";
const panel =
  "relative flex min-w-0 flex-col overflow-hidden rounded-[calc(var(--rb-r-6xl,26px))] border border-transparent bg-[var(--rb-n-100,oklch(97.7%_0.0055_80))] dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-[inset_0_0_0_1px_rgb(84_62_32/0.05)] dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.05)]";
const panelHead =
  "flex min-h-12 min-w-0 shrink-0 items-center gap-2 px-4 has-[button]:pe-2.5";
const panelBody =
  "mx-1 mb-1 flex min-w-0 flex-col overflow-hidden rounded-[calc(var(--rb-r-5xl,22px))] border border-transparent bg-white dark:bg-neutral-950 shadow-[0_0_0_1px_rgb(84_62_32/0.10),0_1px_1px_rgb(84_62_32/0.07),0_2px_5px_-2px_rgb(84_62_32/0.14)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_0_0_1px_rgb(0_0_0/0.6),0_2px_4px_-1px_rgb(0_0_0/0.5)] [&:has(+*)]:mb-0";
const frameAction = "ms-auto flex shrink-0 items-center gap-1.5";
const userBubble =
  "w-fit max-w-full rounded-[calc(var(--rb-r-6xl,26px))] rounded-br-[var(--rb-r-xs,4px)] border border-transparent bg-[var(--rb-accent,oklch(84%_0.15_165))] px-4 py-2.5 text-[15px]/[22px] font-medium whitespace-pre-wrap text-[var(--rb-accent-fg,oklch(26%_0.06_168))] shadow-[inset_0_-1.5px_0_color-mix(in_oklab,var(--rb-accent,oklch(84%_0.15_165))_70%,black),0_2px_6px_-3px_color-mix(in_oklab,var(--rb-accent,oklch(84%_0.15_165))_70%,transparent)] [overflow-wrap:anywhere] dark:bg-[var(--rb-accent,oklch(81%_0.16_163))] dark:text-[var(--rb-accent-fg,oklch(26%_0.06_168))] dark:shadow-none";
const prose =
  "flex min-w-0 flex-col gap-4 text-[15px]/[24px] font-medium text-neutral-900 dark:text-neutral-100 [overflow-wrap:anywhere]";
const turnFooter =
  "-ms-2 flex min-h-9 min-w-0 items-center gap-0.5 text-[14px]/[20px] font-semibold text-neutral-900/78 dark:text-neutral-100/78 [@media(pointer:fine)]:*:data-reveal:opacity-0 [@media(pointer:fine)]:group-hover:*:data-reveal:opacity-100 *:data-reveal:focus-visible:opacity-100 *:data-reveal:transition-opacity";
const toolRow =
  "group -mx-2 flex min-h-9 max-w-[calc(100%+16px)] min-w-0 cursor-pointer items-center gap-2 self-start rounded-[calc(var(--rb-r-lg,10px))] px-2 text-left text-[14px]/[20px] font-semibold text-neutral-900/78 dark:text-neutral-100/78 transition-[background-color] duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[color-mix(in_oklab,var(--rb-n-200,oklch(92.8%_0.009_76))_74%,white)] active:bg-[var(--rb-n-200,oklch(92.8%_0.009_76))] dark:hover:bg-neutral-100/6 dark:active:bg-neutral-100/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color-mix(in_oklab,var(--rb-accent,oklch(84%_0.15_165))_58%,black)] dark:focus-visible:outline-[var(--rb-accent,oklch(81%_0.16_163))]";
const stepGlyph = "flex size-[18px] shrink-0 items-center justify-center";
const toolDetail =
  "min-w-[6ch] truncate font-bold text-neutral-900 dark:text-neutral-100";
const toolEnd =
  "ms-auto flex shrink-0 items-center gap-2 whitespace-nowrap tabular-nums text-neutral-900/62 dark:text-neutral-100/62";
const composer =
  "relative flex w-full min-w-0 flex-col rounded-[calc(min(var(--rb-r-6xl,26px),min(var(--rb-r-full,999px),16px)_+_8px))] border border-transparent bg-white text-neutral-900 dark:text-neutral-100 shadow-[0_0_0_1px_rgb(84_62_32/0.07),0_1px_2px_rgb(84_62_32/0.06),0_8px_22px_-10px_rgb(84_62_32/0.20)] transition-[box-shadow] duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] focus-within:shadow-[0_0_0_1.5px_color-mix(in_oklab,var(--rb-accent,oklch(84%_0.15_165))_58%,black),0_0_0_5px_color-mix(in_oklab,var(--rb-accent,oklch(84%_0.15_165))_22%,transparent),0_8px_22px_-10px_rgb(84_62_32/0.2)] dark:bg-[color-mix(in_oklab,var(--color-neutral-900)_74%,var(--color-neutral-800))] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_0_0_1px_rgb(0_0_0/0.6),0_10px_24px_-12px_rgb(0_0_0/0.8)] dark:focus-within:shadow-[0_0_0_1.5px_var(--rb-accent,oklch(81%_0.16_163)),0_0_0_5px_color-mix(in_oklab,var(--rb-accent,oklch(81%_0.16_163))_18%,transparent)]";
const composerInput =
  "max-h-40 min-h-6 min-w-0 flex-auto resize-none bg-transparent px-1.5 py-1.5 field-sizing-content text-[15px]/[22px] font-medium text-neutral-900 dark:text-neutral-100 outline-none placeholder:text-neutral-900/55 dark:placeholder:text-neutral-100/55";
const fadeTop =
  "bg-linear-to-b from-white to-transparent transition-opacity duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] dark:from-neutral-950";
const fadeBottom =
  "bg-linear-to-t from-white to-transparent transition-opacity duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] dark:from-neutral-950";

type Message =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; text: string; file?: string };

const CATCH_UP_MS = 180;
const FLOOR_CPS = 45;

function lastWordBoundary(source: string, cut: number) {
  if (cut >= source.length) return source.length;
  const i = source.lastIndexOf(" ", cut);
  return i === -1 ? 0 : i;
}

function useSmoothedText() {
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  const targetRef = useRef("");
  const shownRef = useRef(0);
  const endedRef = useRef(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, 64);
      last = now;
      const target = targetRef.current;
      const behind = target.length - shownRef.current;
      if (behind > 0) {
        shownRef.current = reduceMotion
          ? target.length
          : Math.min(
              target.length,
              shownRef.current +
                behind * (1 - Math.exp(-dt / CATCH_UP_MS)) +
                (FLOOR_CPS * dt) / 1000,
            );
        const cut = Math.floor(shownRef.current);
        const finished = endedRef.current && cut >= target.length;
        const safe = finished ? target.length : lastWordBoundary(target, cut);
        setText(target.slice(0, safe));
        if (finished) setDone(true);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduceMotion]);

  const push = useCallback((chunk: string) => {
    targetRef.current += chunk;
  }, []);
  const end = useCallback(() => {
    endedRef.current = true;
  }, []);
  const reset = useCallback(() => {
    targetRef.current = "";
    shownRef.current = 0;
    endedRef.current = false;
    setText("");
    setDone(false);
  }, []);
  return { text, done, push, end, reset };
}

function useScrollFade<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    setEdges({
      start: scrollTop > 1,
      end: Math.ceil(scrollTop + clientHeight) < scrollHeight - 1,
    });
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    const view = el?.ownerDocument.defaultView;
    if (!el || !view?.ResizeObserver) return;
    const observer = new view.ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [update]);

  return { ref, edges, onScroll: update };
}

function useStickToBottom(scrollRef: RefObject<HTMLDivElement | null>) {
  const stickRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const sync = () => {
      const overflowing = el.scrollHeight - el.clientHeight > 1;
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      const atBottom = !overflowing || distance < 24;
      stickRef.current = atBottom;
      setShowJump(overflowing && !atBottom);
    };

    const onIntent = (e: WheelEvent | TouchEvent) => {
      const up = "deltaY" in e ? e.deltaY < 0 : true;
      if (!up) return;
      if (el.scrollHeight - el.clientHeight > 1 && el.scrollTop > 0) {
        stickRef.current = false;
      }
    };

    const observer = new ResizeObserver(() => {
      if (stickRef.current) el.scrollTop = el.scrollHeight;
      sync();
    });
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);

    el.addEventListener("wheel", onIntent, { passive: true });
    el.addEventListener("touchmove", onIntent, { passive: true });
    el.addEventListener("scroll", sync, { passive: true });

    el.scrollTop = el.scrollHeight;
    sync();
    return () => {
      observer.disconnect();
      el.removeEventListener("wheel", onIntent);
      el.removeEventListener("touchmove", onIntent);
      el.removeEventListener("scroll", sync);
    };
  }, [scrollRef]);

  const jumpToLatest = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = true;
    setShowJump(false);
    el.scrollTop = el.scrollHeight;
  }, [scrollRef]);

  return { showJump, jumpToLatest };
}

const CODE = `type Plan = {
  name: string
  price: string
  period: string
  cta: string
}

export function PricingTable({
  plans,
}: {
  plans: Plan[]
}) {
  return (
    <div className="grid gap-4">
      {plans.map((plan) => (
        <article key={plan.name}>
          <h3>{plan.name}</h3>
          <p>{plan.price}</p>
          <span>{plan.period}</span>
          <button>{plan.cta}</button>
        </article>
      ))}
    </div>
  )
}`;

const DOC = [
  "Three tiers, billed monthly or annually. Annual saves two months.",
  "Starter covers a single project and one editor seat.",
  "Growth adds unlimited projects, five seats, and priority review.",
  "Scale adds SSO, audit logs, and a named contact.",
  "Every tier includes the component library and future updates.",
];

const VERSIONS = ["v3", "v2", "v1"];

const STREAM_TARGET =
  "I marked Growth as the recommended plan without leaning on colour: it now " +
  "carries a small “Recommended” label, a slightly heavier border, and a touch " +
  "more vertical padding so it reads as primary.";

const LIVE_ID = "a3";

const INITIAL_MESSAGES: Message[] = [
  {
    id: "u1",
    role: "user",
    text: "Build a three-tier pricing table component for the marketing site.",
  },
  {
    id: "a1",
    role: "assistant",
    text: "Here is a responsive pricing table with Starter, Growth, and Scale. It maps over a plans array so you can edit copy without touching markup.",
    file: "pricing-table.tsx",
  },
  {
    id: "u2",
    role: "user",
    text: "Add a short plan description under each price.",
  },
  {
    id: "a2",
    role: "assistant",
    text: "Done. I added a description line beneath each price and wrote the copy for all three tiers. This is version 3, so compare it against the earlier versions from the panel.",
  },
  {
    id: "u3",
    role: "user",
    text: "Can you make the middle plan stand out?",
  },
  {
    id: LIVE_ID,
    role: "assistant",
    text: STREAM_TARGET,
  },
];

export default function AiChat2() {
  const reduced = useReducedMotion();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [stopped, setStopped] = useState(false);
  const [tab, setTab] = useState<"code" | "doc">("code");
  const [version, setVersion] = useState("v3");
  const [copied, setCopied] = useState(false);
  const [value, setValue] = useState("");
  const [runId, setRunId] = useState(0);

  const { text: streamText, done, push, end, reset } = useSmoothedText();
  const {
    ref: transcriptRef,
    edges: transcriptEdges,
    onScroll: onTranscriptScroll,
  } = useScrollFade<HTMLDivElement>();
  const {
    ref: artifactRef,
    edges: artifactEdges,
    onScroll: onArtifactScroll,
  } = useScrollFade<HTMLDivElement>();
  const { showJump, jumpToLatest } = useStickToBottom(transcriptRef);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const transportRef = useRef<number | null>(null);

  const streaming = !done && !stopped;

  useEffect(() => {
    if (reduced) {
      push(STREAM_TARGET);
      end();
      return;
    }
    const chunks = STREAM_TARGET.match(/\S+\s*/g) ?? [];
    let i = 0;
    transportRef.current = window.setInterval(() => {
      const n = 1 + Math.floor(Math.random() * 3);
      push(chunks.slice(i, i + n).join(""));
      i += n;
      if (i >= chunks.length) {
        end();
        if (transportRef.current) window.clearInterval(transportRef.current);
        transportRef.current = null;
      }
    }, 130);
    return () => {
      if (transportRef.current) window.clearInterval(transportRef.current);
    };
  }, [reduced, push, end, runId]);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);

  const autosize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const handleSend = useCallback((text: string) => {
    const t = text.trim();
    if (!t) return;
    setMessages((m) => [
      ...m,
      { id: `u-${Date.now()}`, role: "user", text: t },
    ]);
    setValue("");
  }, []);

  const handleStop = useCallback(() => {
    if (transportRef.current) {
      window.clearInterval(transportRef.current);
      transportRef.current = null;
    }
    end();
    setStopped(true);
  }, [end]);

  const handleRegenerate = useCallback(() => {
    reset();
    setStopped(false);
    setRunId((n) => n + 1);
  }, [reset]);

  return (
    <div
      className={cx(
        canvas,
        text1,
        "relative flex h-full min-h-[660px] w-full min-w-0 flex-col overflow-hidden lg:flex-row",
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="shrink-0">
          <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
            <h1 className={typeHeadingXs}>Build assistant</h1>
            <span className={cx(statusWord, statusIdle)}>Draft</span>
          </div>
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            ref={transcriptRef}
            onScroll={onTranscriptScroll}
            className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-y-auto overscroll-contain [overflow-anchor:none]"
          >
            <div className="mt-auto flex w-full flex-col gap-6 px-4 py-6 sm:px-6">
              {messages.map((message) => {
                if (message.role === "user") {
                  return (
                    <div key={message.id} className="flex">
                      <div className="ml-auto max-w-[85%]">
                        <div className={userBubble}>{message.text}</div>
                      </div>
                    </div>
                  );
                }

                const live = message.id === LIVE_ID && streaming;
                const settled = message.id === LIVE_ID && !streaming;

                return (
                  <div key={message.id} className="group space-y-3">
                    <p className={cx(prose, "max-w-prose")}>
                      {live ? streamText : message.text}
                    </p>

                    {message.file && (
                      <button
                        type="button"
                        onClick={() => setTab("code")}
                        className={cx(toolRow, "w-[calc(100%+16px)]")}
                      >
                        <span className={stepGlyph}>
                          <HugeiconsIcon
                            icon={FileScriptIcon}
                            size={16}
                            strokeWidth={2.0}
                            aria-hidden="true"
                            className={text3}
                          />
                        </span>
                        <span className={cx(toolDetail, typeCodeSm)}>
                          {message.file}
                        </span>
                        <span className={toolEnd}>Open in panel</span>
                        <HugeiconsIcon
                          icon={ArrowRight01Icon}
                          size={16}
                          strokeWidth={2.0}
                          aria-hidden="true"
                          className={cx(text3, "shrink-0")}
                        />
                      </button>
                    )}

                    {settled && (
                      <div className={turnFooter}>
                        <button
                          type="button"
                          data-reveal
                          onClick={handleRegenerate}
                          className={cx(ghostButton, buttonSm)}
                        >
                          Regenerate
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div
            aria-hidden="true"
            className={cx(
              fadeTop,
              "pointer-events-none absolute inset-x-0 top-0 h-8",
              transcriptEdges.start ? "opacity-100" : "opacity-0",
            )}
          />
          <div
            aria-hidden="true"
            className={cx(
              fadeBottom,
              "pointer-events-none absolute inset-x-0 bottom-0 h-8",
              transcriptEdges.end ? "opacity-100" : "opacity-0",
            )}
          />

          {showJump && (
            <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2">
              <motion.button
                type="button"
                onClick={jumpToLatest}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
                className={cx(secondaryButton, buttonMd)}
              >
                <HugeiconsIcon
                  icon={ArrowDown02Icon}
                  size={18}
                  strokeWidth={2.0}
                  aria-hidden="true"
                />
                Jump to latest
              </motion.button>
            </div>
          )}
        </div>

        <div className="shrink-0">
          <div className="mx-auto w-full max-w-3xl px-4 pb-4 sm:px-6">
            <div className={cx(composer, "p-2")}>
              <textarea
                ref={textareaRef}
                rows={1}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  autosize();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(value);
                  }
                }}
                placeholder="Ask anything"
                className={composerInput}
              />
              <div className="flex items-center gap-1 pt-1">
                <button
                  type="button"
                  aria-label="Add attachment"
                  className={cx(ghostButton, iconButtonSm)}
                >
                  <HugeiconsIcon
                    icon={Add01Icon}
                    size={18}
                    strokeWidth={2.0}
                    aria-hidden="true"
                  />
                </button>
                <div className="ml-auto flex items-center gap-1">
                  {streaming ? (
                    <button
                      type="button"
                      onClick={handleStop}
                      key="stop"
                      aria-label="Stop generating"
                      className={cx(primaryButton, iconButtonSm)}
                    >
                      <span
                        aria-hidden="true"
                        className="size-2.5 rounded-[1px] bg-current"
                      />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSend(value)}
                      key="send"
                      aria-label="Send"
                      disabled={value.trim().length === 0}
                      className={cx(primaryButton, iconButtonSm)}
                    >
                      <HugeiconsIcon
                        icon={ArrowUp02Icon}
                        size={18}
                        strokeWidth={2.0}
                        aria-hidden="true"
                      />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <aside className="hidden min-h-0 shrink-0 flex-col p-4 lg:flex lg:w-96">
        <div className={cx(panel, "min-h-0 flex-1")}>
          <div className={panelHead}>
            <span className={cx(typeCodeSm, text2, "truncate")}>
              {tab === "code" ? "pricing-table.tsx" : "pricing-copy.md"}
            </span>
            <div className={frameAction}>
              <button
                type="button"
                aria-label="Copy artifact"
                onClick={() => setCopied(true)}
                className={cx(ghostButton, iconButtonXs)}
              >
                <HugeiconsIcon
                  icon={copied ? Tick02Icon : Copy01Icon}
                  size={18}
                  strokeWidth={2.0}
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                aria-label="Download artifact"
                className={cx(ghostButton, iconButtonXs)}
              >
                <HugeiconsIcon
                  icon={Download04Icon}
                  size={18}
                  strokeWidth={2.0}
                  aria-hidden="true"
                />
              </button>
            </div>
            <span role="status" className="sr-only">
              {copied ? "Copied" : ""}
            </span>
          </div>

          <div className="flex min-w-0 shrink-0 items-center gap-2 px-4 pb-2">
            <div
              role="radiogroup"
              aria-label="Artifact view"
              className={cx(segmentedTrack, segmentedSm)}
            >
              {(["code", "doc"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={tab === t}
                  onClick={() => setTab(t)}
                  className={segmentXs}
                >
                  {t === "code" ? "Code" : "Document"}
                </button>
              ))}
            </div>
            <div
              role="radiogroup"
              aria-label="Version"
              className={cx(segmentedTrack, segmentedSm, "ml-auto")}
            >
              {VERSIONS.map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={version === v}
                  onClick={() => setVersion(v)}
                  className={segmentXs}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className={cx(panelBody, "relative min-h-0 flex-1")}>
            <div
              ref={artifactRef}
              onScroll={onArtifactScroll}
              className="h-full overflow-y-auto p-3"
            >
              {tab === "code" ? (
                <pre className={cx(typeCode, text2, "overflow-x-auto")}>
                  {CODE}
                </pre>
              ) : (
                <div className="space-y-3">
                  <h3 className={typeHeadingXs}>Plans and pricing</h3>
                  {DOC.map((line) => (
                    <p key={line} className={cx(typeBodySm, text2)}>
                      {line}
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div
              aria-hidden="true"
              className={cx(
                fadeTop,
                "pointer-events-none absolute inset-x-0 top-0 h-8",
                artifactEdges.start ? "opacity-100" : "opacity-0",
              )}
            />
            <div
              aria-hidden="true"
              className={cx(
                fadeBottom,
                "pointer-events-none absolute inset-x-0 bottom-0 h-8",
                artifactEdges.end ? "opacity-100" : "opacity-0",
              )}
            />
          </div>
        </div>
      </aside>
    </div>
  );
}
