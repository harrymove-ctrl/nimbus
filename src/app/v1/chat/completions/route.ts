// OpenAI-compatible POST /v1/chat/completions (SPEC §8). OpenClaw / Hermes point their custom provider at this.
// The last user message becomes the goal of a run on the workstream named by `model` (nimbus/<slug>); the reply
// streams progress and then the Writer's final text. Approvals never happen in chat: the reply carries a link to
// the web composer (the gate stays real) and the run waits there.
import { WORKSTREAMS } from "@/lib/workstreams";
import type { AnyRunEvent } from "@/lib/events";
import { checkDayBudget } from "@/runtime/budget";
import { apiError, authorized, collect, jsonCompletion, lastUserText, logRequest, sseResponse, type ChatBody, type Reply } from "@/runtime/chat-api";
import { startRun, type RunHandle } from "@/runtime/source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_SLUG = "ship-nimbus";

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

const usageOf = (run: RunHandle) => {
  const u = run.events.reduce((a, e) => (e.type === "usage" ? { i: a.i + e.payload.in, o: a.o + e.payload.out } : a), { i: 0, o: 0 });
  return { prompt_tokens: u.i, completion_tokens: u.o, total_tokens: u.i + u.o };
};

export async function POST(req: Request) {
  if (!authorized(req)) return apiError(401, "Invalid or missing bearer token");
  const body = (await req.json().catch(() => null)) as ChatBody | null;
  await logRequest(req, body);
  const goal = body ? lastUserText(body) : null;
  if (!body || goal === null) return apiError(400, "messages must include a user message");

  const budget = await checkDayBudget();
  if (!budget.ok) return apiError(429, budget.message ?? "Daily spend cap reached", "insufficient_quota", "day_cap");
  const slug = (body.model ?? "").split("/").pop();
  const ws = WORKSTREAMS.find((w) => w.slug === slug) ?? WORKSTREAMS.find((w) => w.slug === DEFAULT_SLUG)!;
  const run = startRun({ workstreamId: ws.id, title: ws.title, goal: goal || ws.goal, trigger: "chat", mode: "ask", tools: ws.tools });
  const origin = new URL(req.url).origin;
  const link = `${origin}/?run=${run.id}`;
  async function* all() {
    yield `On it: ${ws.title}.\n`; // first token at once; the run takes a while
    yield* pieces(run, origin);
  }
  const reply: Reply = { id: `chatcmpl-${run.id}`, model: `nimbus/${ws.slug}`, pieces: all(), usage: () => usageOf(run), nimbus: { run_id: run.id, url: link } };
  if (!body.stream) return jsonCompletion(reply, await collect(reply.pieces));
  return sseResponse(reply, !!body.stream_options?.include_usage);
}
