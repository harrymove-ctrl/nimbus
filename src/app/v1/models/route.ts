import { WORKSTREAMS } from "@/lib/workstreams";

export const dynamic = "force-dynamic";

// GET /v1/models — one model per workstream, so a chat app's model picker chooses the workstream.
export async function GET() {
  return Response.json({ object: "list", data: WORKSTREAMS.map((w) => ({ id: `nimbus/${w.slug}`, object: "model", created: 0, owned_by: "nimbus" })) });
}
