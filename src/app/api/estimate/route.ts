export const dynamic = "force-dynamic";

// POST /api/estimate { draft, tier? } — cost preview while drafting. A heuristic for now;
// Phase 1 swaps in a cached Nano call with the same response shape.
export async function POST(req: Request) {
  const { draft = "", tier = "auto" } = (await req.json().catch(() => ({}))) as { draft?: string; tier?: string };
  const len = String(draft).length;
  const big = len > 160;
  const counts = tier === "cheap" ? { ultra: 0, super: 0, nano: 6 } : tier === "max" ? { ultra: 2, super: 4, nano: 3 } : { ultra: 2, super: 3, nano: 3 };
  const costUsd = tier === "cheap" ? 0.01 : tier === "max" ? (big ? 0.14 : 0.11) : big ? 0.08 : 0.07;
  const tokens = tier === "cheap" ? 22000 : 38000 + Math.min(len, 400) * 20;
  const parts = [
    counts.ultra ? `Ultra ×${counts.ultra}` : null,
    counts.super ? `Super ×${counts.super}` : null,
    counts.nano ? `Nano ×${counts.nano}` : null,
  ].filter(Boolean);
  return Response.json({ costUsd, tokens, counts, label: `≈ $${costUsd.toFixed(2)} · ${parts.join(" · ")}` });
}
