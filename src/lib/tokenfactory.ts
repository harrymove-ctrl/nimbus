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
/** Workstreams with a crew of their own (set at run start by live.ts): what the mock plays when no fixture scripts them. */
const mockCrews = new Map<string, { roles: string[]; skill: string }>();
export const setMockCrew = (workstreamId: string, roles: string[], skill = "") => mockCrews.set(workstreamId, { roles, skill });
/**
 * Which script plays this agent. `ws` is the workstream id, plus "~2" once the run starts with memories (the second
 * run of a workstream behaves differently: it skips what it already learned), plus "+<answer>" once the person has
 * answered the run's first question (the choice changes what the crew does next: "+golden" patches the golden).
 * Directories tried, first hit wins, each as <instance>.json (writer-2: the second Writer of a run) then <role>.json:
 *   <ws>, <ws without +answer>, <ws without ~2>, <ws without either>; a workstream made from a template
 *   (ws-u-<template>-<hex>) then tries the same under tpl-<template>; then fixtures/mock-model/<role>.json (Checkout).
 * A crew of its own with no fixture plays crewScript(): plan with its roles, spawn them, finish.
 */
export function mockScript(role: string, ws?: string, instance?: string): Script {
  const parts = ws?.match(/^([^~+]+)(~\d+)?(\+.+)?$/);
  const crew = parts ? mockCrews.get(parts[1]) : undefined;
  const key = `${ws ?? ""}/${instance ?? role}${crew ? `/${crew.roles.join()}` : ""}`;
  let s = scripts.get(key);
  if (!s) {
    const root = path.join(process.cwd(), "fixtures", "mock-model");
    const own = parts ? [parts[1] + (parts[2] ?? "") + (parts[3] ?? ""), parts[1] + (parts[2] ?? ""), parts[1] + (parts[3] ?? ""), parts[1]].filter((d, i, a) => a.indexOf(d) === i) : [];
    const tpl = parts?.[1].match(/^ws-u-(.+)-[0-9a-f]{4}$/)?.[1];
    const dirs = tpl ? [...own, ...own.map((d) => d.replace(parts![1], `tpl-${tpl}`))] : own;
    const names = [...(instance ? [instance] : []), role];
    const hit = dirs.flatMap((d) => names.map((n) => path.join(root, d, `${n}.json`))).find((f) => existsSync(f));
    if (!hit && crew) s = crewScript(role, crew);
    else s = JSON.parse(readFileSync(hit ?? path.join(root, `${role}.json`), "utf8")) as Script;
    scripts.set(key, s);
  }
  return s;
}

/** The mock for a crew nobody scripted: the Orchestrator plans its roles, runs them side by side and finishes; each role reports one line. */
function crewScript(role: string, crew: { roles: string[]; skill: string }): Script {
  const title = (r: string) => r.replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase());
  const brief = (r: string) => ({ role: r, brief: `${title(r)}: your part of the goal, reported back in a few lines.` });
  if (role === "orchestrator")
    return {
      role,
      turns: [
        { label: "Planning the run", complexity: 2, usage: { in: 2400, out: 420 }, toolCalls: [{ name: "plan", input: { agents: crew.roles.map(brief), tools: [], estimate: { costUsd: 0.02, tokens: 12000, label: `≈ $0.02 · ${crew.roles.length} roles` } } }] },
        { label: "Spawning the crew", complexity: 0, usage: { in: 1200, out: 160 }, toolCalls: [{ name: "spawn_agents", input: { agents: crew.roles.map(brief) } }] },
        { label: "Wrapping up", complexity: 0, usage: { in: 1600, out: 120 }, toolCalls: [{ name: "finish", input: { summary: `The crew (${crew.roles.map(title).join(", ")}) finished its parts.` } }] },
      ],
    };
  if (role === "learner" && crew.skill)
    return { role, turns: [{ label: "Extracting memories", complexity: 0, usage: { in: 1800, out: 200 }, toolCalls: [{ name: "save_learning", input: { memories: [`A crew of ${crew.roles.map(title).join(", ")} ran this goal end to end.`], skill: crew.skill } }] }] };
  return { role, turns: [{ label: `${title(role)} at work`, complexity: 1, usage: { in: 1500, out: 220 }, text: `${title(role)}: my part is done (scripted mock run).` }] };
}
export const mockTurn = (role: string, turn: number, ws?: string, instance?: string): MockTurn | undefined => mockScript(role, ws, instance).turns[turn - 1];

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

/** Tests only: what the router asked each mock call for (max tokens per tier). */
export const mockCallLog: { role: string; tier: Tier; maxOutputTokens?: number }[] = [];

function mockModel(tier: Tier, role: string, turn: number, runKey: string, ws?: string, instance?: string): LanguageModel {
  return new MockLanguageModelV4({
    provider: "mock",
    modelId: TIERS[tier],
    doGenerate: async (options) => {
      if (process.env.NIMBUS_MOCK_LOG === "1") mockCallLog.push({ role, tier, maxOutputTokens: options.maxOutputTokens });
      // NIMBUS_BAD_MODEL=super: that tier's model id is invalid (404 model not found), like a typo'd id on the real API.
      if (process.env.NIMBUS_BAD_MODEL === tier) throw new MockHttpError(404, `404 model not found: ${TIERS[tier]} (mock)`);
      const t = mockTurn(role, turn, ws, instance) ?? { text: "Done.", usage: { in: 800, out: 40 } };
      const failKey = `${runKey}:${role}:${turn}`;
      if (process.env.NIMBUS_MOCK_FAIL === `${role}:${turn}` && (failCounts.get(failKey) ?? 0) < 2) {
        failCounts.set(failKey, (failCounts.get(failKey) ?? 0) + 1);
        throw new MockHttpError(429, "429 Too Many Requests (mock)");
      }
      await new Promise((r) => setTimeout(r, mockDelayMs(role, turn)));
      const content: ({ type: "text"; text: string } | { type: "tool-call"; toolCallId: string; toolName: string; input: string })[] = [];
      if (t.text) content.push({ type: "text", text: t.text });
      // ids per instance: three Writers in one run must not share them (React keys, the tool.result match)
      (t.toolCalls ?? []).forEach((c, i) => content.push({ type: "tool-call", toolCallId: `mock-${instance ?? role}-${turn}-${i}`, toolName: c.name, input: JSON.stringify(c.input) }));
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

export function hopLabel(role: string, turn: number, ws?: string, instance?: string): string {
  return modelMode() === "mock" ? (mockTurn(role, turn, ws, instance)?.label ?? "Thinking") : "Thinking";
}

/** The one place a LanguageModel is made. `turn`/`role` only matter to the mock; `runKey` scopes forced failures. */
export function getModel(opts: { tier: Tier; role: string; turn: number; runKey?: string; script?: string; instance?: string }): LanguageModel {
  if (modelMode() === "mock") return mockModel(opts.tier, opts.role, opts.turn, opts.runKey ?? "", opts.script, opts.instance);
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
