// Router rules approved from a proposal (the Token Factory watch case): data/router-rules.json, read on every routing decision.
// Supported rule: { role, afterTurn?, maxTier }: from the turn after `afterTurn` on, that role never runs above `maxTier`
// ("keep the Orchestrator's plan turn on Ultra, run its later turns on Super"). Rules with conditions the router cannot
// check (turnLabel, noToolCall) are ignored, not guessed at. NIMBUS_RULES=off ignores the file.
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { dataDir } from "@/db";
import type { AgentRole, Tier } from "@/lib/models";

export type RouterRule = { role: AgentRole; afterTurn?: number; maxTier: Tier; note?: string };

const TIERS: Tier[] = ["nano", "super", "ultra"];
const ROLES = ["orchestrator", "researcher", "analyst", "writer", "checker", "learner"];
let cache: { file: string; mtime: number; rules: RouterRule[] } | null = null;

export function routerRules(): RouterRule[] {
  if (process.env.NIMBUS_RULES === "off") return [];
  const file = path.join(dataDir(), "router-rules.json");
  if (!existsSync(file)) return [];
  const mtime = statSync(file).mtimeMs;
  if (cache && cache.file === file && cache.mtime === mtime) return cache.rules;
  let rules: RouterRule[] = [];
  try {
    const raw = (JSON.parse(readFileSync(file, "utf8")) as { rules?: Record<string, unknown>[] }).rules ?? [];
    rules = raw
      .filter((r) => ROLES.includes(String(r.role)) && TIERS.includes(r.maxTier as Tier) && !("turnLabel" in r) && !("noToolCall" in r) && (r.afterTurn === undefined || typeof r.afterTurn === "number"))
      .map((r) => ({ role: r.role as AgentRole, maxTier: r.maxTier as Tier, afterTurn: r.afterTurn as number | undefined, note: r.note as string | undefined }));
  } catch {
    rules = [];
  }
  cache = { file, mtime, rules };
  return rules;
}

/** The rule that caps this hop's tier, if one applies. */
export function ruleFor(role: AgentRole, turn: number, tier: Tier): RouterRule | undefined {
  return routerRules().find((r) => r.role === role && turn > (r.afterTurn ?? 0) && TIERS.indexOf(tier) > TIERS.indexOf(r.maxTier));
}
