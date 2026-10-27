// Cost-aware router (SPEC §12): role tiers are ceilings; the router picks the cheapest tier each hop needs.
// Deterministic rules first (free), then a cached Nano classifier (mock: the script's `complexity`).
// 429 / 5xx / timeout: retry once with backoff, then fall one tier down. Never up.
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { generateText, type ModelMessage, type ToolSet } from "ai";
import { getDb, schema } from "@/db";
import { TIERS, type Tier } from "@/lib/models";
import { getModel, MockHttpError, mockTurn, modelMode } from "@/lib/tokenfactory";
import type { RunCtx } from "./context";
import { RunAborted, sleep } from "./context";
import type { AgentRole } from "@/lib/models";

const ORDER: Tier[] = ["nano", "super", "ultra"];
export const lowerTier = (t: Tier): Tier | null => ORDER[ORDER.indexOf(t) - 1] ?? null;
const minTier = (a: Tier, b: Tier): Tier => (ORDER.indexOf(a) <= ORDER.indexOf(b) ? a : b);

export const routerOn = () => process.env.NIMBUS_ROUTER !== "off";
const cacheOn = () => (process.env.NIMBUS_CACHE ? process.env.NIMBUS_CACHE === "on" : modelMode() === "nebius");
const TTL_MS = 24 * 3600 * 1000;

export type Hop = { role: AgentRole; turn: number; brief: string; hasTools: boolean; risk?: "low" | "medium" | "high" };

export async function pickTier(ctx: RunCtx, hop: Hop, ceiling: Tier): Promise<{ tier: Tier; reason: string }> {
  if (!routerOn()) return { tier: ceiling, reason: "router off → ceiling" };
  if (ctx.tierChoice === "max") return { tier: ceiling, reason: "tier = Max → ceiling" };
  if (ctx.tierChoice === "cheap") return { tier: "nano", reason: "tier = Cheap → nano" };
  if (hop.role === "checker" || hop.role === "learner") return { tier: "nano", reason: `${hop.role} → nano always` };
  if (hop.risk === "high") return { tier: ceiling, reason: "risk high → ceiling" };
  if (hop.role === "orchestrator" && hop.turn === 1) return { tier: ceiling, reason: "first orchestrator turn → ceiling" };
  if (!hop.hasTools && hop.brief.length < 400) return { tier: "nano", reason: "no tools, brief under 400 chars → nano" };
  const score = await classify(hop);
  const tier = score === 0 ? "nano" : score === 1 ? minTier("super", ceiling) : ceiling;
  return { tier, reason: `classifier: complexity ${score} → ${tier}` };
}

/** Nano classifier scoring 0–2. In mock mode the score comes from the script; real mode asks Nano (cached). */
async function classify(hop: Hop): Promise<0 | 1 | 2> {
  if (modelMode() === "mock") return mockTurn(hop.role, hop.turn)?.complexity ?? 1;
  const prompt = `Rate how hard this agent step is: 0 = routine, 1 = moderate, 2 = hard reasoning or high stakes. Reply with one digit.\nRole: ${hop.role}\nStep: ${hop.brief.slice(0, 600)}`;
  const key = sha(`classify|${prompt}`);
  const hit = await cacheGet(key);
  if (hit) return (Number((hit.response as { text: string }).text.trim()[0]) || 1) as 0 | 1 | 2;
  const r = await generateText({ model: getModel({ tier: "nano", role: "router", turn: 1 }), prompt, maxOutputTokens: 8, maxRetries: 0 });
  const d = Math.min(2, Math.max(0, Number(r.text.trim()[0]) || 1)) as 0 | 1 | 2;
  await cachePut(key, TIERS.nano, { text: String(d) }, { in: r.usage.inputTokens ?? 0, out: r.usage.outputTokens ?? 0 });
  return d;
}

/* ---------------- llm_cache ---------------- */

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

async function cacheGet(key: string) {
  if (!cacheOn()) return null;
  const db = await getDb();
  const [row] = await db.select().from(schema.llmCache).where(eq(schema.llmCache.key, key));
  if (!row || Date.now() - row.createdAt > TTL_MS) return null;
  return { response: row.response as Record<string, unknown>, usage: row.usage as { in: number; out: number } };
}
async function cachePut(key: string, model: string, response: unknown, usage: { in: number; out: number }) {
  if (!cacheOn()) return;
  const db = await getDb();
  await db.insert(schema.llmCache).values({ key, model, response, usage, createdAt: Date.now() }).onConflictDoUpdate({ target: schema.llmCache.key, set: { response, usage, createdAt: Date.now() } });
}

/* ---------------- one hop, with retry + fallback ---------------- */

export type ModelCall = { text: string; toolCalls: { toolCallId: string; toolName: string; input: unknown }[]; usage: { in: number; out: number }; cached: boolean; tier: Tier; fellBack: boolean };

const statusOf = (e: unknown): number | undefined => (e as { statusCode?: number })?.statusCode ?? (e instanceof MockHttpError ? e.statusCode : undefined);
const retryable = (e: unknown) => {
  const s = statusOf(e);
  return s === 429 || (s !== undefined && s >= 500) || (e as { name?: string })?.name === "TimeoutError" || (e as { name?: string })?.name === "AbortError";
};

export async function callHop(
  ctx: RunCtx,
  o: { role: AgentRole; instance: string; turn: number; hopNo: number; ceiling: Tier; tier: Tier; system: string; messages: ModelMessage[]; tools: ToolSet; onFallback: (to: Tier, why: string) => void },
): Promise<ModelCall> {
  let tier = o.tier;
  let fellBack = false;
  for (;;) {
    const key = sha([TIERS[tier], o.system, JSON.stringify(o.messages), Object.keys(o.tools).join(","), modelMode() === "mock" ? `${o.role}:${o.turn}` : ""].join("|"));
    const hit = await cacheGet(key);
    if (hit) {
      const r = hit.response as { text: string; toolCalls: ModelCall["toolCalls"] };
      return { text: r.text, toolCalls: r.toolCalls, usage: hit.usage, cached: true, tier, fellBack };
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      if (ctx.signal.aborted) throw ctx.signal.reason instanceof RunAborted ? ctx.signal.reason : new RunAborted("stop");
      try {
        const res = await generateText({
          model: getModel({ tier, role: o.role, turn: o.turn, runKey: ctx.runId }),
          system: o.system,
          messages: o.messages,
          tools: o.tools,
          maxRetries: 0,
          abortSignal: AbortSignal.any([ctx.signal, AbortSignal.timeout(60_000)]),
        });
        const out: ModelCall = {
          text: res.text,
          toolCalls: res.toolCalls.map((c) => ({ toolCallId: c.toolCallId, toolName: c.toolName, input: c.input })),
          usage: { in: res.usage.inputTokens ?? 0, out: res.usage.outputTokens ?? 0 },
          cached: false,
          tier,
          fellBack,
        };
        await cachePut(key, TIERS[tier], { text: out.text, toolCalls: out.toolCalls }, out.usage);
        return out;
      } catch (e) {
        if (ctx.signal.aborted) throw ctx.signal.reason instanceof RunAborted ? ctx.signal.reason : new RunAborted("stop");
        if (!retryable(e)) throw e;
        if (attempt === 0) await sleep(process.env.NIMBUS_MOCK_FAST === "1" ? 0 : 400, ctx.signal); // backoff, then one retry
      }
    }
    const lower = lowerTier(tier);
    if (!lower) throw new Error(`${TIERS[tier]} kept failing and there is no lower tier`);
    o.onFallback(lower, `${tier} failed twice (429/5xx/timeout) → fell back to ${lower}`);
    tier = lower;
    fellBack = true;
  }
}
