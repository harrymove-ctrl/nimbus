import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { TIERS, type Tier } from "./models";

// One switch for the whole build (zero-spend rule): NIMBUS_MODEL=mock | nebius.
// Default is mock when NEBIUS_API_KEY is empty. Every model call goes through getModel().
export type ModelMode = "mock" | "nebius";

export function modelMode(): ModelMode {
  const m = process.env.NIMBUS_MODEL;
  if (m === "mock" || m === "nebius") return m;
  return process.env.NEBIUS_API_KEY ? "nebius" : "mock";
}

// Real provider: Nebius Token Factory, OpenAI-compatible.
export const tokenFactory = createOpenAICompatible({
  name: "nebius",
  baseURL: process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1",
  apiKey: process.env.NEBIUS_API_KEY,
});

/** Nemotron may emit reasoning as <think>…</think>; never parse or display it. */
export function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/^[\s\S]*?<\/think>/, "").trim();
}

/* ---------------- scripted mock model ---------------- */

export type MockTurn = {
  label?: string;
  text?: string;
  toolCalls?: { name: string; input: unknown }[];
  usage: { in: number; out: number };
  /** 0 = nano is enough, 1 = super, 2 = the role's ceiling. Read by the mock router classifier. */
  complexity?: 0 | 1 | 2;
};
type Script = { role: string; turns: MockTurn[] };

const scripts = new Map<string, Script>();
/** fixtures/mock-model/<workstream>/<role>.json when it exists, else fixtures/mock-model/<role>.json (the Checkout crew). */
export function mockScript(role: string, ws?: string): Script {
  const key = `${ws ?? ""}/${role}`;
  let s = scripts.get(key);
  if (!s) {
    const specific = ws ? path.join(process.cwd(), "fixtures", "mock-model", ws, `${role}.json`) : "";
    const file = specific && existsSync(specific) ? specific : path.join(process.cwd(), "fixtures", "mock-model", `${role}.json`);
    s = JSON.parse(readFileSync(file, "utf8")) as Script;
    scripts.set(key, s);
  }
  return s;
}
export const mockTurn = (role: string, turn: number, ws?: string): MockTurn | undefined => mockScript(role, ws).turns[turn - 1];

const fast = () => process.env.NIMBUS_MOCK_FAST === "1";
/** Deterministic 300–900 ms so the timeline animates the same way every time. */
function mockDelayMs(role: string, turn: number) {
  if (fast()) return 0;
  let h = 0;
  for (const c of `${role}:${turn}`) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 300 + (h % 600);
}

// Forced failures for the fallback test: NIMBUS_MOCK_FAIL="researcher:3" (role:turn). The first two attempts at
// that hop throw a 429 (the call and its one retry); the router then falls one tier down and the next call succeeds.
const failCounts = new Map<string, number>();
export function resetMockFailures() {
  failCounts.clear();
}

export class MockHttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

function mockModel(tier: Tier, role: string, turn: number, runKey: string, ws?: string): LanguageModel {
  return new MockLanguageModelV4({
    provider: "mock",
    modelId: TIERS[tier],
    doGenerate: async () => {
      // NIMBUS_BAD_MODEL=super: that tier's model id is invalid (404 model not found), like a typo'd id on the real API.
      if (process.env.NIMBUS_BAD_MODEL === tier) throw new MockHttpError(404, `404 model not found: ${TIERS[tier]} (mock)`);
      const t = mockTurn(role, turn, ws) ?? { text: "Done.", usage: { in: 800, out: 40 } };
      const failKey = `${runKey}:${role}:${turn}`;
      if (process.env.NIMBUS_MOCK_FAIL === `${role}:${turn}` && (failCounts.get(failKey) ?? 0) < 2) {
        failCounts.set(failKey, (failCounts.get(failKey) ?? 0) + 1);
        throw new MockHttpError(429, "429 Too Many Requests (mock)");
      }
      await new Promise((r) => setTimeout(r, mockDelayMs(role, turn)));
      const content: ({ type: "text"; text: string } | { type: "tool-call"; toolCallId: string; toolName: string; input: string })[] = [];
      if (t.text) content.push({ type: "text", text: t.text });
      (t.toolCalls ?? []).forEach((c, i) => content.push({ type: "tool-call", toolCallId: `mock-${role}-${turn}-${i}`, toolName: c.name, input: JSON.stringify(c.input) }));
      return {
        content,
        finishReason: { unified: content.some((c) => c.type === "tool-call") ? "tool-calls" : "stop", raw: undefined },
        usage: {
          inputTokens: { total: t.usage.in, noCache: t.usage.in, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: t.usage.out, text: t.usage.out, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
}

export function hopLabel(role: string, turn: number, ws?: string): string {
  return modelMode() === "mock" ? (mockTurn(role, turn, ws)?.label ?? "Thinking") : "Thinking";
}

/** The one place a LanguageModel is made. `turn`/`role` only matter to the mock; `runKey` scopes forced failures. */
export function getModel(opts: { tier: Tier; role: string; turn: number; runKey?: string; script?: string }): LanguageModel {
  if (modelMode() === "mock") return mockModel(opts.tier, opts.role, opts.turn, opts.runKey ?? "", opts.script);
  return tokenFactory(process.env.NIMBUS_BAD_MODEL === opts.tier ? "nvidia/does-not-exist" : TIERS[opts.tier]);
}

/* ---------------- embeddings ---------------- */

export const EMBED_DIMS = 64;

/** Cheap deterministic hash vector: same text → same vector; shared words → positive cosine. */
export function hashEmbed(text: string): number[] {
  const v = new Array<number>(EMBED_DIMS).fill(0);
  for (const w of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    let h = 2166136261;
    for (const c of w) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
    v[h % EMBED_DIMS] += h & 0x100 ? 1 : -1;
  }
  const n = Math.sqrt(v.reduce((a, b) => a + b * b, 0)) || 1;
  return v.map((x) => x / n);
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (modelMode() === "mock") return texts.map(hashEmbed);
  const res = await fetch(`${process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1"}/embeddings`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.NEBIUS_API_KEY}` },
    body: JSON.stringify({ model: process.env.NIMBUS_EMBED_MODEL ?? "Qwen/Qwen3-Embedding-8B", input: texts }),
  });
  if (!res.ok) throw new Error(`embeddings ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { data: { embedding: number[] }[] };
  return j.data.map((d) => d.embedding);
}

export const cosine = (a: number[], b: number[]) => {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) (d += a[i] * b[i]), (na += a[i] * a[i]), (nb += b[i] * b[i]);
  return d / (Math.sqrt(na) * Math.sqrt(nb) || 1);
};
