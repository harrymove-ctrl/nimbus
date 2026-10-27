// OpenAI-compatible POST /v1/chat/completions (SPEC §8, docs/CHAT-APPS.md). OpenClaw and Hermes point their custom provider here.
//   model "nimbus"          a conversation: the last message is routed to approve, deny, answer, status, ask, run or help
//   model "nimbus/<slug>"   always starts that workstream with the message as its goal
// Replies are short plain text for a phone, end with a link to the run, and stream as exact OpenAI SSE.
import { WORKSTREAMS } from "@/lib/workstreams";
import { apiError, authorized, collect, jsonCompletion, lastUserText, logRequest, sseResponse, type ChatBody } from "@/runtime/chat-api";
import { handleChat } from "@/runtime/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!authorized(req)) return apiError(401, "Invalid or missing bearer token");
  const body = (await req.json().catch(() => null)) as ChatBody | null;
  await logRequest(req, body);
  if (!body || lastUserText(body) === null) return apiError(400, "messages must include a user message");

  const slug = (body.model ?? "").split("/").pop();
  const ws = WORKSTREAMS.find((w) => w.slug === slug);
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const turn = await handleChat(body, { token, origin: new URL(req.url).origin, ws });
  if ("error" in turn) return apiError(turn.error.status, turn.error.message, turn.error.status === 429 ? "insufficient_quota" : "invalid_request_error", turn.error.code);

  const model = ws ? `nimbus/${ws.slug}` : "nimbus";
  const reply = { id: `chatcmpl-${turn.runId ?? crypto.randomUUID().slice(0, 12)}`, model, pieces: turn.pieces, usage: turn.usage, nimbus: { intent: turn.intent, ...(turn.runId ? { run_id: turn.runId, url: turn.link } : {}) } };
  if (!body.stream) return jsonCompletion(reply, await collect(reply.pieces));
  return sseResponse(reply, !!body.stream_options?.include_usage);
}
