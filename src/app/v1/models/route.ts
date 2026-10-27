import { WORKSTREAMS } from "@/lib/workstreams";

export const dynamic = "force-dynamic";

// GET /v1/models — `nimbus` (a conversation: it works out what each message means) first, then one model per workstream
// for a chat app's model picker to start a specific one.
export async function GET() {
  const ids = ["nimbus", ...WORKSTREAMS.map((w) => `nimbus/${w.slug}`)];
  return Response.json({ object: "list", data: ids.map((id) => ({ id, object: "model", created: 0, owned_by: "nimbus" })) });
}
