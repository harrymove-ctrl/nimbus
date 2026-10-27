import { eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { cosine, embedTexts } from "@/lib/tokenfactory";

/** Top-k memories for a workstream by cosine similarity (JS over the workstream's rows; fine at this scale). */
export async function topMemories(workstreamId: string, query: string, k = 6): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select().from(schema.memories).where(eq(schema.memories.workstreamId, workstreamId));
  if (!rows.length) return [];
  const [q] = await embedTexts([query]);
  const top = rows
    .map((r) => ({ id: r.id, text: r.text, s: cosine(q, r.embedding) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, k);
  // Each memory that enters a prompt counts as used (SPEC §16 "used ×").
  await db.update(schema.memories).set({ usedCount: sql`${schema.memories.usedCount} + 1` }).where(inArray(schema.memories.id, top.map((r) => r.id)));
  return top.map((r) => r.text);
}

export async function saveMemories(workstreamId: string, runId: string, texts: string[]) {
  if (!texts.length) return;
  const db = await getDb();
  const have = new Set((await db.select({ text: schema.memories.text }).from(schema.memories).where(eq(schema.memories.workstreamId, workstreamId))).map((r) => r.text));
  const fresh = texts.filter((t) => !have.has(t)); // the same lesson learned twice is stored once
  if (!fresh.length) return;
  const vecs = await embedTexts(fresh);
  await db.insert(schema.memories).values(fresh.map((text, i) => ({ id: `${runId}-m${i}`, workstreamId, text, embedding: vecs[i], sourceRunId: runId, createdAt: Date.now() })));
}
