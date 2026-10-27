// "Always on": node-cron inside the app. Every workstream with a scheduleCron starts a run (trigger "cron")
// and gets an unread dot when it finishes. NIMBUS_CRON_OVERRIDE replaces every expression (tests);
// NIMBUS_SCHEDULER=off disables it. The same runs can also be started headless: `pnpm run:job` (scripts/job.mts).
import cron, { type ScheduledTask } from "node-cron";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { checkDayBudget } from "./budget";
import { startRun, getRun } from "./source";

declare global {
  var __nimbusCron: ScheduledTask[] | undefined;
}

export async function startScheduler(): Promise<number> {
  if (process.env.NIMBUS_SCHEDULER === "off") return 0;
  if (globalThis.__nimbusCron) return globalThis.__nimbusCron.length;
  const tasks: ScheduledTask[] = (globalThis.__nimbusCron = []);
  const db = await getDb();
  const active = new Map<string, string>(); // workstream → run id
  for (const w of await db.select().from(schema.workstreams)) {
    const expr = process.env.NIMBUS_CRON_OVERRIDE || w.scheduleCron;
    if (!expr || !cron.validate(expr)) continue;
    tasks.push(
      cron.schedule(expr, async () => {
        const budget = await checkDayBudget();
        if (!budget.ok) return console.log(`[nimbus] cron skipped ${w.id}: ${budget.message}`);
        const prev = active.get(w.id) && getRun(active.get(w.id)!);
        if (prev && !prev.finished) return; // one run per workstream at a time
        // Headless: low-risk actions auto-approve, anything else waits in the web composer.
        const run = startRun({ workstreamId: w.id, title: w.title, goal: w.goal, trigger: "cron", mode: "auto-low", tools: w.tools });
        active.set(w.id, run.id);
        // Unread dot as soon as the run needs a person (approval or question) or ends, whichever is first.
        let marked = false;
        const mark = async () => {
          if (marked) return;
          marked = true;
          await (await getDb()).update(schema.workstreams).set({ unread: 1 }).where(eq(schema.workstreams.id, w.id));
        };
        run.onEvent((e) => e.type === "approval.request" || e.type === "question" || e.type === "run.end" ? void mark() : undefined);
        void run.settled.then(mark);
        console.log(`[nimbus] cron started ${run.id} for ${w.id}`);
      }),
    );
  }
  console.log(`[nimbus] scheduler: ${tasks.length} scheduled workstream(s)`);
  return tasks.length;
}
