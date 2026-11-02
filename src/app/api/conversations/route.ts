import { FILTERS, listConversations, type ConversationFilter } from "@/runtime/conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/conversations?filter=needs|scheduled|phone|all&q= : the Conversations inbox (docs/CONVERSATION.md C0).
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const f = params.get("filter") ?? "all";
  if (!FILTERS.includes(f as ConversationFilter)) return Response.json({ error: `filter must be one of ${FILTERS.join(", ")}` }, { status: 400 });
  return Response.json(await listConversations({ filter: f as ConversationFilter, q: params.get("q")?.slice(0, 200) ?? "" }));
}
