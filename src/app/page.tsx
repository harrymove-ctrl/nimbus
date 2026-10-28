import { AppShell } from "@/components/nimbus/app-shell";
import { modelMode } from "@/lib/tokenfactory";
import { checkDayBudget, runCapUsd } from "@/runtime/budget";

// Rendered per request: the rail's footer says which model runs and today's spend in the HTML itself, from the
// server's own mode (a page prerendered at build time had no key and no budget, so it showed the mock line).
export const dynamic = "force-dynamic";

export default async function Home() {
  const b = await checkDayBudget().catch(() => null);
  const budget = b ? { todayUsd: b.spentUsd, dayCapUsd: b.capUsd, runCapUsd: runCapUsd(), mock: modelMode() === "mock" } : undefined;
  return <AppShell initialBudget={budget} />;
}
