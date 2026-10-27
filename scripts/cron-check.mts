// "A cron-triggered run appears in the list without a click" — mock mode, scheduler forced to every second.
process.env.NIMBUS_CRON_OVERRIDE = "* * * * * *";
process.env.NIMBUS_MOCK_FAST = "1";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../src/db";
import { startScheduler } from "../src/runtime/scheduler";

const db = await getDb();
await db.update(schema.workstreams).set({ unread: 0 });
const n = await startScheduler();
console.log(`scheduler registered ${n} workstream(s) (the override applies to every workstream)`);
const t0 = Date.now();
let rows: { id: string; trigger: string; workstreamId: string }[] = [];
while (Date.now() - t0 < 12_000) {
  await new Promise((r) => setTimeout(r, 500));
  rows = await db.select({ id: schema.runs.id, trigger: schema.runs.trigger, workstreamId: schema.runs.workstreamId }).from(schema.runs).where(eq(schema.runs.trigger, "cron"));
  if (rows.length) break;
}
const ok = rows.length > 0;
console.log(`${ok ? "✓" : "✗"} a run with trigger=cron appeared in the runs table without a click: ${rows.map((r) => `${r.id} (${r.workstreamId})`).join(", ") || "none"}`);
console.log("  (it waits at its medium-risk approval: headless runs only auto-approve low risk, so the unread dot appears once it finishes)");
process.exit(ok ? 0 : 1);
