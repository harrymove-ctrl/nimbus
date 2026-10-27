import { WORKSTREAMS } from "@/lib/workstreams";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ workstreams: WORKSTREAMS });
}
