// Nemotron routing (SPEC §2). Ids verified 2026-10-27 against
// https://tokenfactory.nebius.com/api/public/models_info and model-catalog.md.
export const TIERS = {
  ultra: "nvidia/Nemotron-3-Ultra-550b-a55b", // 1M ctx, $1.00/$3.00
  super: "nvidia/nemotron-3-super-120b-a12b", // 256K ctx, $0.30/$0.90 (id is lowercase on the catalog)
  nano: "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B", // 262K ctx, $0.06/$0.24
} as const;

export type Tier = keyof typeof TIERS;

export const ROLE_TIER = {
  orchestrator: "ultra",
  researcher: "super",
  analyst: "super",
  writer: "super",
  checker: "nano",
  learner: "nano",
} as const satisfies Record<string, Tier>;

export type AgentRole = keyof typeof ROLE_TIER;

// USD per 1M tokens: [input, output]
export const PRICE_PER_M: Record<Tier, readonly [number, number]> = {
  ultra: [1, 3],
  super: [0.3, 0.9],
  nano: [0.06, 0.24],
};

/** Output token ceiling per hop (docs/BUDGET.md): keeps one runaway hop from spending the credit. */
export const MAX_OUT_TOKENS: Record<Tier, number> = { ultra: 1200, super: 1500, nano: 600 };

export function tierFor(role: AgentRole): Tier {
  return process.env.NIMBUS_DEV_CHEAP === "1" ? "nano" : ROLE_TIER[role];
}

export function modelFor(role: AgentRole): string {
  return TIERS[tierFor(role)];
}

export function costUsd(tier: Tier, tokensIn: number, tokensOut: number): number {
  const [pin, pout] = PRICE_PER_M[tier];
  return (tokensIn * pin + tokensOut * pout) / 1_000_000;
}
