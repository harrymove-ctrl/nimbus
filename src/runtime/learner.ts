// After run.end: Nano extracts memories and rewrites the workstream's SKILL.md (SPEC §4). The diff goes in the run summary.
import type { z } from "zod";
import { retryBusy } from "@/db";
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
  let saved = false;
  let failure: string | undefined;
  const exec: Exec = {
    save_learning: async (input: z.infer<typeof SCHEMAS.save_learning>) => {
      try {
        if (process.env.NIMBUS_TEST_LEARNER_FAIL === "1") throw new Error("SQLITE_BUSY: database is locked (forced by NIMBUS_TEST_LEARNER_FAIL)");
        const memories = input.memories.slice(0, 8);
        // Other processes may hold the SQLite file for a moment: retry the loads and writes instead of losing the lesson.
        const old = await retryBusy(() => loadSkill(ctx.workstreamId));
        // The learner never rewrites policy: those lines are written only by "Approve & always allow".
        const next = withPolicy(input.skill, policySection(old));
        await retryBusy(() => saveMemories(ctx.workstreamId, ctx.runId, memories));
        await retryBusy(() => saveSkill(ctx.workstreamId, next, { runId: ctx.runId }));
        saved = true;
        ctx.emit("message", "learner", instance, {
          id: "m-summary",
          role: "agent",
          text: "Run summary",
          card: "summary",
          summary: { memories, skillDiff: diffLines(old, next), routedHops: ctx.routedHops },
        });
        return { ok: true, memories: memories.length };
      } catch (e) {
        // Never a silent "Done.": say what was not learned and why. The run's own result is unaffected.
        failure = e instanceof Error ? e.message : String(e);
        ctx.emit("message", "learner", instance, { id: "m-learn-failed", role: "agent", text: `Learning failed, nothing was saved from this run: ${failure}` });
        throw e;
      }
    },
  } as Exec;
  await runAgent(ctx, { role: "learner", instance }, brief, exec);
  if (!saved && !failure) ctx.emit("message", "learner", instance, { id: "m-learn-failed", role: "agent", text: "Learning did not run: the Learner finished without saving anything from this run." });
}
