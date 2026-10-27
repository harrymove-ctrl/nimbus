"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./use-run";

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Animates a number toward `target`. Reduced motion, or a hidden page (rAF is paused), cuts straight to it. */
export function useTween(target: number, ms = 300, ease: "inOut" | "out" = "inOut") {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const cur = useRef(target);
  cur.current = value;

  useEffect(() => {
    if (reduced || document.hidden || from.current === target) {
      from.current = target;
      setValue(target);
      return;
    }
    const start = performance.now();
    const a = cur.current;
    let raf = 0;
    const f = ease === "inOut" ? easeInOut : easeOut;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setValue(a + (target - a) * f(t));
      if (t < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    };
    raf = requestAnimationFrame(step);
    // If rAF never fires (background pane), settle on the target anyway.
    const guard = setTimeout(() => {
      cancelAnimationFrame(raf);
      from.current = target;
      setValue(target);
    }, ms + 250);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(guard);
    };
  }, [target, ms, ease, reduced]);

  return value;
}
