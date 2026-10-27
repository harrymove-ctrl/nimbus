"use client";

import { GlowCloud } from "@/components/glow-cloud";

// Boot screen (SPEC §10): full-bleed blue sky, 320 px cloud, fades out (400 ms) when the
// first GET /api/workstreams has resolved.
export function Boot({ fading }: { fading: boolean }) {
  return (
    <div
      aria-hidden={fading}
      className="fixed inset-0 z-50 grid place-items-center text-white transition-opacity duration-[400ms] ease-out motion-reduce:transition-none"
      style={{
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? "none" : "auto",
        background: "radial-gradient(60% 55% at 62% 42%, rgba(90, 205, 255, 0.45), transparent 70%), linear-gradient(180deg, #1659c8, #2aa6e6)",
      }}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="size-72 sm:size-80">
          <GlowCloud color="blue" background={false} label="Nimbus is waking up" />
        </div>
        <div className="nb-fade-late text-center" style={{ animationDuration: "400ms" }}>
          <h1 className="text-3xl font-semibold tracking-tight">Nimbus</h1>
          <p className="mt-1 text-sm text-white/75">waking the crew…</p>
        </div>
      </div>
    </div>
  );
}
