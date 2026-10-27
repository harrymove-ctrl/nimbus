import { GlowCloud } from "@/components/glow-cloud";

// Boot screen (SPEC §10). Phase 2 swaps this for the app shell and fades the
// cloud out once the first GET /api/workstreams resolves.
export default function Home() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background text-foreground">
      <div className="flex flex-col items-center gap-6">
        <div className="size-72 overflow-hidden rounded-[var(--rb-r-5xl)] sm:size-96">
          <GlowCloud color="blue" background label="Nimbus is waking up" />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Nimbus</h1>
          <p className="mt-1 text-sm text-muted-foreground">waking the crew…</p>
        </div>
      </div>
    </main>
  );
}
