import { GlowCloud } from "@/components/glow-cloud";

// Boot screen (SPEC §10). Phase 2 swaps this for the app shell and fades the
// cloud out once the first GET /api/workstreams resolves.
// The sky is full-bleed: same gradient as the cloud's own dark-mode sky
// (see .ui-gc[data-bg] in glow-cloud.tsx), so the cloud itself renders
// without its square background.
export default function Home() {
  return (
    <main
      className="relative grid min-h-screen place-items-center overflow-hidden text-white"
      style={{
        background:
          "radial-gradient(60% 55% at 62% 42%, rgba(90, 205, 255, 0.45), transparent 70%), linear-gradient(180deg, #1659c8, #2aa6e6)",
      }}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="size-72 sm:size-96">
          <GlowCloud color="blue" background={false} label="Nimbus is waking up" />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Nimbus</h1>
          <p className="mt-1 text-sm text-white/75">waking the crew…</p>
        </div>
      </div>
    </main>
  );
}
