import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { cosine, embedTexts } from "@/lib/tokenfactory";

/** Top-k memories for a workstream by cosine similarity (JS over the workstream's rows; fine at this scale). */
export async function topMemories(workstreamId: string, query: string, k = 6): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select().from(schema.memories).where(eq(schema.memories.workstreamId, workstreamId));
  if (!rows.length) return [];
  const [q] = await embedTexts([query]);
  return rows
    .map((r) => ({ text: r.text, s: cosine(q, r.embedding) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map((r) => r.text);
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
