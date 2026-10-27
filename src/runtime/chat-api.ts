// The OpenAI wire format for /v1/chat/completions: request log, message parsing, and exact SSE framing.
// OpenClaw and Hermes both talk to this; docs/CHAT-APPS.md Phase A1/A2.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "@/db";

export type ChatMessage = { role: string; content?: unknown; name?: string };
export type ChatBody = {
  model?: string;
  messages?: ChatMessage[];
  stream?: boolean;
  stream_options?: { include_usage?: boolean } | null;
  user?: string;
  // accepted and ignored: we always answer with text and finish_reason "stop"
  tools?: unknown;
  tool_choice?: unknown;
  response_format?: unknown;
};
export type Usage = { prompt_tokens: number; completion_tokens: number; total_tokens: number };

export function authorized(req: Request): boolean {
  const token = process.env.NIMBUS_API_TOKEN;
  if (!token) return process.env.NODE_ENV !== "production"; // no token set: open in dev, closed in production
  return req.headers.get("authorization") === `Bearer ${token}`;
}

/** Text of a message: a string, or an array of content parts (text parts only; images and the like are dropped). */
export function textOf(c: unknown): string {
  if (typeof c === "string") return c;
  if (!Array.isArray(c)) return "";
  return c.map((p) => (typeof p === "string" ? p : p && typeof p === "object" && "text" in p ? String((p as { text: unknown }).text ?? "") : "")).join("");
}

export const messagesOf = (body: ChatBody): ChatMessage[] => (Array.isArray(body.messages) ? body.messages.filter((m) => m && typeof m === "object" && typeof m.role === "string") : []);
/** The last message from the person (role "user"); `tool` and `assistant` turns before it are history. */
export const lastUserText = (body: ChatBody): string | null => {
  const m = [...messagesOf(body)].reverse().find((x) => x.role === "user");
  return m ? textOf(m.content).trim() : null;
};

/** NIMBUS_V1_LOG=1: each request body goes to data/v1-log/<ts>.json, with credentials removed. */
export async function logRequest(req: Request, body: unknown): Promise<void> {
  if (process.env.NIMBUS_V1_LOG !== "1") return;
  try {
    const headers: Record<string, string> = {};
    req.headers.forEach((v, k) => {
      if (!/^(authorization|cookie|proxy-authorization|x-api-key)$/i.test(k)) headers[k] = v;
    });
    const dir = path.join(dataDir(), "v1-log");
    await mkdir(dir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    await writeFile(path.join(dir, `${ts}-${Math.random().toString(36).slice(2, 6)}.json`), JSON.stringify({ at: new Date().toISOString(), method: req.method, url: new URL(req.url).pathname, headers, body }, null, 2));
  } catch (e) {
    console.error("[nimbus] v1 log failed:", e instanceof Error ? e.message : e);
  }
}

export const apiError = (status: number, message: string, type = "invalid_request_error", code?: string) => Response.json({ error: { message, type, ...(code ? { code } : {}) } }, { status });

const SSE_HEADERS = { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" };

export type Reply = {
  id: string;
  model: string;
  /** text pieces, in order; the first may be a one-line acknowledgment */
  pieces: AsyncGenerator<string>;
  usage: () => Usage;
  /** extra top-level field on the non-stream body (run id, link, intent) */
  nimbus?: Record<string, unknown>;
};

export async function collect(pieces: AsyncGenerator<string>): Promise<string> {
  let s = "";
  for await (const p of pieces) s += p;
  return s;
}

export function jsonCompletion(r: Reply, content: string): Response {
  return Response.json({
    id: r.id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: r.model,
    choices: [{ index: 0, message: { role: "assistant", content: content.trim() }, finish_reason: "stop" }],
    usage: r.usage(),
    ...(r.nimbus ? { nimbus: r.nimbus } : {}),
  });
}

/**
 * Server-sent events exactly as OpenAI frames them: `data: {json}\n\n` per chunk, ending `data: [DONE]\n\n`.
 * The role chunk goes out at once (first byte inside 2 s whatever the run is doing), and an SSE comment line
 * (`: keep-alive`) every `NIMBUS_V1_HEARTBEAT_MS` (10 s) so a minute-long run never trips a client or proxy timeout.
 */
export function sseResponse(r: Reply, includeUsage: boolean): Response {
  const enc = new TextEncoder();
  const created = Math.floor(Date.now() / 1000);
  const frame = (o: unknown) => enc.encode(`data: ${JSON.stringify(o)}\n\n`);
  const chunk = (delta: Record<string, unknown>, finish: string | null = null) =>
    frame({ id: r.id, object: "chat.completion.chunk", created, model: r.model, choices: [{ index: 0, delta, finish_reason: finish }], ...(includeUsage ? { usage: null } : {}) });
  const beat = Number(process.env.NIMBUS_V1_HEARTBEAT_MS) || 10_000;
  let closed = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (b: Uint8Array) => {
        if (!closed) controller.enqueue(b);
      };
      send(chunk({ role: "assistant", content: "" }));
      timer = setInterval(() => send(enc.encode(": keep-alive\n\n")), beat);
      try {
        for await (const p of r.pieces) {
          if (closed) break;
          for (let i = 0; i < p.length; i += 48) send(chunk({ content: p.slice(i, i + 48) }));
        }
      } catch (e) {
        send(chunk({ content: `\n[nimbus error: ${e instanceof Error ? e.message : String(e)}]` }));
      }
      clearInterval(timer);
      if (closed) return;
      send(chunk({}, "stop"));
      if (includeUsage) send(frame({ id: r.id, object: "chat.completion.chunk", created, model: r.model, choices: [], usage: r.usage() }));
      send(enc.encode("data: [DONE]\n\n"));
      closed = true;
      controller.close();
    },
    cancel() {
      closed = true;
      clearInterval(timer);
      void r.pieces.return(undefined); // client went away: stop following the run (the run itself keeps going)
    },
  });
  return new Response(stream, { headers: SSE_HEADERS });
}
