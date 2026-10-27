// Phase 0 exit test: one call per Nemotron tier through Token Factory, plus a
// function call from Nano. Usage: pnpm smoke
import { generateText, isStepCount, tool } from "ai";
import { z } from "zod";
import { TIERS, costUsd, type Tier } from "../src/lib/models";
import { stripThink, tierModel } from "../src/lib/tokenfactory";

if (!process.env.NEBIUS_API_KEY) {
  console.error("NEBIUS_API_KEY is empty. Fill it in .env.local (https://tokenfactory.nebius.com) and rerun.");
  process.exit(2);
}

let failed = false;

for (const tier of ["ultra", "super", "nano"] as Tier[]) {
  const t0 = Date.now();
  try {
    const r = await generateText({
      model: tierModel(tier),
      prompt: "In one sentence, say which model you are and what you are good at.",
      maxOutputTokens: 600,
    });
    const i = r.usage.inputTokens ?? 0;
    const o = r.usage.outputTokens ?? 0;
    console.log(`\n[${tier}] ${TIERS[tier]}  ${Date.now() - t0}ms`);
    console.log(`  answer: ${stripThink(r.text).slice(0, 300) || "(empty)"}`);
    console.log(`  usage:  in=${i} out=${o} cost=$${costUsd(tier, i, o).toFixed(6)}`);
    if (!stripThink(r.text)) throw new Error("empty answer");
  } catch (e) {
    failed = true;
    console.error(`\n[${tier}] FAILED:`, e instanceof Error ? e.message : e);
  }
}

// Function call from Nano.
try {
  let executed: unknown = null;
  const r = await generateText({
    model: tierModel("nano"),
    prompt: "What is 17 times 23? You must use the multiply tool, then state the result.",
    tools: {
      multiply: tool({
        description: "Multiply two numbers",
        inputSchema: z.object({ a: z.number(), b: z.number() }),
        execute: async ({ a, b }) => (executed = { a, b, product: a * b }),
      }),
    },
    stopWhen: isStepCount(4),
    maxOutputTokens: 800,
  });
  const calls = r.steps.flatMap((s) => s.toolCalls);
  console.log(`\n[nano tool call] calls=${calls.length} executed=${JSON.stringify(executed)}`);
  console.log(`  final: ${stripThink(r.text).slice(0, 200)}`);
  console.log(`  usage: in=${r.totalUsage.inputTokens} out=${r.totalUsage.outputTokens}`);
  if (!executed) throw new Error("Nano did not produce a successful function call");
} catch (e) {
  failed = true;
  console.error("\n[nano tool call] FAILED:", e instanceof Error ? e.message : e);
}

console.log(failed ? "\nSMOKE: FAIL" : "\nSMOKE: PASS");
process.exit(failed ? 1 : 0);
