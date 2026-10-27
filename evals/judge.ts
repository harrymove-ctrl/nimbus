import { readFileSync } from "node:fs";
import path from "node:path";
import { generateText } from "ai";
import { getModel, modelMode } from "../src/lib/tokenfactory";

type Rubric = { entries: { claim: string; requires: string[]; partial?: string[] }[] };
let rubric: Rubric | undefined;

/** Scores a claim against the evidence 0–2 (2 = pass). Mock: from the rubric fixture. Real: one cached-friendly Nano call. */
export async function judge(claim: string, evidence: string): Promise<{ score: 0 | 1 | 2; why: string }> {
  if (modelMode() === "mock") {
    rubric ??= JSON.parse(readFileSync(path.join(process.cwd(), "evals", "fixtures", "rubric.json"), "utf8")) as Rubric;
    const e = rubric.entries.find((r) => r.claim === claim);
    if (!e) return { score: 0, why: `no rubric entry for "${claim}" (add one to evals/fixtures/rubric.json)` };
    const missing = e.requires.filter((s) => !evidence.includes(s));
    if (!missing.length) return { score: 2, why: "all required evidence present" };
    if ((e.partial ?? []).some((s) => evidence.includes(s))) return { score: 1, why: `partly supported; missing ${missing.join(", ")}` };
    return { score: 0, why: `missing ${missing.join(", ")}` };
  }
  const r = await generateText({
    model: getModel({ tier: "nano", role: "judge", turn: 1 }),
    prompt: `Score 0, 1 or 2 how well the evidence supports the claim (2 = fully, 1 = partly, 0 = not). Reply with one digit.\n\nClaim: ${claim}\n\nEvidence:\n${evidence.slice(0, 6000)}`,
    maxOutputTokens: 8,
    maxRetries: 0,
  });
  const d = Number(r.text.trim()[0]);
  const score = (d === 2 || d === 1 ? d : 0) as 0 | 1 | 2;
  return { score, why: `Nano scored ${score}` };
}
