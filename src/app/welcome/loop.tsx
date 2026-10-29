"use client";

// One captioned demo loop on /welcome: a muted video cut from the recorded real-model take (public/landing/loop-N.*,
// scripts/cut-landing-loops.sh). It plays only while it is on screen, so nine loops do not all stream at once, and
// under prefers-reduced-motion it never autoplays: the poster shows with the browser's play control.
import { useEffect, useRef, useState } from "react";

export function Loop({ n, what, why, first = false }: { n: number; what: string; why: string; first?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      v.pause();
      setStill(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) void v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.25 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
    <figure className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-[calc(var(--rb-r-6xl,26px))] border border-white/10 bg-neutral-900 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]">
        <video
          ref={ref}
          muted
          loop
          playsInline
          preload={first ? "metadata" : "none"}
          poster={`/landing/loop-${n}.jpg`}
          controls={still}
          width={1280}
          height={720}
          className="block aspect-video w-full"
          aria-label={`${what}: ${why}`}
        >
          <source src={`/landing/loop-${n}.webm`} type="video/webm" />
          <source src={`/landing/loop-${n}.mp4`} type="video/mp4" />
        </video>
      </div>
      <figcaption className="px-1 text-[15px]/[22px]">
        <span className="font-semibold text-neutral-50">{what}</span>
        <span className="text-neutral-500"> · </span>
        <span className="font-medium text-neutral-400">{why}</span>
      </figcaption>
    </figure>
  );
}

/** The install line as a chip: one click copies it. */
export function CopyChip({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        });
      }}
      title="Copy"
      className="inline-flex h-10 max-w-full items-center gap-2 rounded-[calc(var(--rb-r-full,999px))] border border-white/12 bg-neutral-900/70 px-4 font-mono text-[13px] text-neutral-300 transition-colors hover:border-white/25 hover:text-neutral-100"
    >
      <span className="truncate">{text}</span>
      <span className="shrink-0 text-[11px] font-sans font-bold text-neutral-500" aria-live="polite">
        {done ? "copied" : "copy"}
      </span>
    </button>
  );
}
