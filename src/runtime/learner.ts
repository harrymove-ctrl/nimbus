// After run.end: Nano extracts memories and rewrites the workstream's SKILL.md (SPEC §4). The diff goes in the run summary.
import type { z } from "zod";
import { runAgent, type Exec } from "./agent";
import type { RunCtx } from "./context";
import { saveMemories } from "./memory";
import { diffLines, loadSkill, policySection, saveSkill, withPolicy } from "./skills";
import type { SCHEMAS } from "./tools";

export async function runLearner(ctx: RunCtx, transcript: string) {
  const instance = "learner-1";
  ctx.instances.add(instance);
  const brief = `Run transcript summary:\n${transcript}\n\nExtract memories worth keeping and rewrite SKILL.md. Keep its "## Policy" section as is.`;
  ctx.emit("agent.spawn", "learner", instance, { by: "orchestrator", role: "learner", instance, brief: "Extract memories and rewrite this workstream's SKILL.md." });
  const exec: Exec = {
    save_learning: async (input: z.infer<typeof SCHEMAS.save_learning>) => {
      const memories = input.memories.slice(0, 8);
      const old = await loadSkill(ctx.workstreamId);
      // The learner never rewrites policy: those lines are written only by "Approve & always allow".
      const next = withPolicy(input.skill, policySection(old));
      await saveMemories(ctx.workstreamId, ctx.runId, memories);
      await saveSkill(ctx.workstreamId, next);
      ctx.emit("message", "learner", instance, {
        id: "m-summary",
        role: "agent",
        text: "Run summary",
        card: "summary",
        summary: { memories, skillDiff: diffLines(old, next), routedHops: ctx.routedHops },
      });
      return { ok: true, memories: memories.length };
    },
  } as Exec;
  await runAgent(ctx, { role: "learner", instance }, brief, exec);
}
