// OpenAI-compatible POST /v1/chat/completions (SPEC §8). OpenClaw / Hermes point their custom provider at this.
// The last user message becomes the goal of a run on the workstream named by `model` (nimbus/<slug>); the reply
// streams progress and then the Writer's final text. Approvals never happen in chat: the reply carries a link to
// the web composer (the gate stays real) and the run waits there.
import { WORKSTREAMS } from "@/lib/workstreams";
import type { AnyRunEvent } from "@/lib/events";
import { checkDayBudget } from "@/runtime/budget";
import { startRun, type RunHandle } from "@/runtime/source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_SLUG = "ship-nimbus";

function authorized(req: Request): boolean {
  const token = process.env.NIMBUS_API_TOKEN;
  if (!token) return process.env.NODE_ENV !== "production"; // no token set: open in dev, closed in production
  return req.headers.get("authorization") === `Bearer ${token}`;
}

const textOf = (c: unknown): string => (typeof c === "string" ? c : Array.isArray(c) ? c.map((p) => (typeof p === "object" && p && "text" in p ? String((p as { text: unknown }).text) : "")).join("") : "");

/** Turns a run into text pieces: a short progress line, then either an approval/question notice or the final answer. */
async function* pieces(run: RunHandle, origin: string): AsyncGenerator<string> {
  const link = `${origin}/?run=${run.id}`;
  const queue: AnyRunEvent[] = [];
  let wake: (() => void) | undefined;
  const off = run.onEvent((e) => (queue.push(e), wake?.()));
  const seen = run.events.length;
  queue.push(...run.events.slice(0, seen));
  let doc = "";
  let last = "";
  try {
    for (;;) {
      while (!queue.length) await new Promise<void>((r) => ((wake = r), setTimeout(r, 2000)));
      const e = queue.shift()!;
      if (e.type === "plan") yield `Plan: ${e.payload.agents.map((a) => a.role).join(", ")}.\n\n`;
      else if (e.type === "approval.request") {
        // A saved "always allow" policy (or Auto low-risk) resolves in the same tick: keep going if so.
        const id = e.payload.approvalId;
        if (queue.some((q) => q.type === "approval.resolve" && q.payload.approvalId === id && q.payload.by !== "you")) continue;
        yield `⚠ Needs your approval: ${e.payload.action.summary} → ${link}\n`;
        return; // the run keeps waiting in the web composer
      } else if (e.type === "question") {
        // Chat cannot ask follow-ups: answer with the last option (or a default) and say so. Steer from the web composer.
        const answer = e.payload.options?.[e.payload.options.length - 1] ?? "Use your best judgment.";
        run.postMessage({ kind: "answer", text: answer, questionId: e.payload.questionId });
        yield `↳ ${e.agentInstance} asked "${e.payload.text}"; answered "${answer}" automatically (chat cannot ask follow-ups).\n\n`;
      } else if (e.type === "artifact.version" && e.payload.kind === "doc") doc = e.payload.content;
      else if (e.type === "message" && e.agentInstance === "orchestrator" && e.payload.role === "agent" && !e.payload.card) last = e.payload.text;
      else if (e.type === "run.end") {
        if (e.payload.status !== "done") yield `Run ${e.payload.status}.\n`;
        else yield doc ? `${doc}\n` : `${last}\n`;
        return;
      } else if (e.type === "run.error") {
        yield `Run failed: ${e.payload.message}\n`;
        return;
      }
    }
  } finally {
    off();
  }
}

export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ error: { message: "Invalid or missing bearer token", type: "invalid_request_error" } }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { model?: string; messages?: { role: string; content: unknown }[]; stream?: boolean } | null;
  const goal = [...(body?.messages ?? [])].reverse().find((m) => m.role === "user");
  if (!body || !goal) return Response.json({ error: { message: "messages must include a user message", type: "invalid_request_error" } }, { status: 400 });

  const budget = await checkDayBudget();
  if (!budget.ok) return Response.json({ error: { message: budget.message, type: "insufficient_quota", code: "day_cap" } }, { status: 429 });
  const slug = (body.model ?? "").split("/").pop();
  const ws = WORKSTREAMS.find((w) => w.slug === slug) ?? WORKSTREAMS.find((w) => w.slug === DEFAULT_SLUG)!;
  const run = startRun({ workstreamId: ws.id, title: ws.title, goal: textOf(goal.content) || ws.goal, trigger: "chat", mode: "ask", tools: ws.tools });
  const origin = new URL(req.url).origin;
  const id = `chatcmpl-${run.id}`;
  const model = `nimbus/${ws.slug}`;
  const created = Math.floor(Date.now() / 1000);

  if (!body.stream) {
    let content = "";
    for await (const p of pieces(run, origin)) content += p;
    const usage = run.events.filter((e) => e.type === "usage").reduce((a, e) => (e.type === "usage" ? { i: a.i + e.payload.in, o: a.o + e.payload.out } : a), { i: 0, o: 0 });
    return Response.json({ id, object: "chat.completion", created, model, choices: [{ index: 0, message: { role: "assistant", content: content.trim() }, finish_reason: "stop" }], usage: { prompt_tokens: usage.i, completion_tokens: usage.o, total_tokens: usage.i + usage.o }, nimbus: { run_id: run.id, url: `${origin}/?run=${run.id}` } });
  }

  const enc = new TextEncoder();
  const chunk = (delta: Record<string, unknown>, finish: string | null = null) => enc.encode(`data: ${JSON.stringify({ id, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`);
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(chunk({ role: "assistant", content: "" }));
      try {
        for await (const p of pieces(run, origin)) for (let i = 0; i < p.length; i += 48) controller.enqueue(chunk({ content: p.slice(i, i + 48) }));
      } catch (e) {
        controller.enqueue(chunk({ content: `\n[nimbus error: ${e instanceof Error ? e.message : String(e)}]` }));
      }
      controller.enqueue(chunk({}, "stop"));
      controller.enqueue(enc.encode("data: [DONE]\n\n"));
      controller.close();
    },
    cancel() {},
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
