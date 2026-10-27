import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { TIERS, type Tier } from "./models";

// Every model call goes through Nebius Token Factory (OpenAI-compatible).
export const tokenFactory = createOpenAICompatible({
  name: "nebius",
  baseURL: process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1",
  apiKey: process.env.NEBIUS_API_KEY,
});

export const tierModel = (tier: Tier) => tokenFactory(TIERS[tier]);

/** Nemotron may emit reasoning as <think>…</think>; never parse or display it. */
export function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/^[\s\S]*?<\/think>/, "").trim();
}
