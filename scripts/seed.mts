// Fresh clone → `pnpm seed` → the rail shows three workstreams. Idempotent. (The DB also seeds itself on first use.)
import { getDb, schema } from "../src/db";

const db = await getDb();
const rows = await db.select().from(schema.workstreams);
console.log(`seeded ${rows.length} workstreams in ${process.env.NIMBUS_DATA_DIR || "./data"}/nimbus.db:`);
for (const w of rows) console.log(`  ${w.id}  ${w.title}${w.scheduleLabel ? `  (${w.scheduleLabel})` : ""}`);
process.exit(0);
