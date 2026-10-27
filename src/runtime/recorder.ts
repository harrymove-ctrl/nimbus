// NIMBUS_RECORD_REAL=1: write every event of a run to fixtures/real-runs/<workstream>-<timestamp>.events.json, in the format
// the replay source reads (docs/BUDGET.md: record a real run once, replay it for the video at zero cost).
// A recording keeps what the crew did and drops what the person did: answers, approvals and policy lines are regenerated
// when whoever watches the replay acts. The person's waiting time is cut out, and the question/approval requests that
// waited for them become `gate` events, so the replay pauses exactly where the original did.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { AnyRunEvent, FixtureEvent } from "@/lib/events";

const BAND_MS = 60; // the events that happened elsewhere while the person was thinking are squeezed into this window

export function toFixture(events: AnyRunEvent[]): FixtureEvent[] {
  const resolvedByPerson = new Map<string, number>();
  const answeredAt = new Map<string, number>();
  for (const e of events) {
    if (e.type === "approval.resolve" && (e.payload.by === "you" || e.payload.by === "system")) resolvedByPerson.set(e.payload.approvalId, e.tMs);
    if (e.type === "message" && e.payload.role === "user" && e.payload.answerTo) answeredAt.set(e.payload.answerTo, e.tMs);
  }
  const gates: { reqSeq: number; reqT: number; resT: number; kind: "question" | "approval" }[] = [];
  for (const e of events) {
    if (e.type === "approval.request" && resolvedByPerson.has(e.payload.approvalId) && e.payload.approvalId) gates.push({ reqSeq: e.seq, reqT: e.tMs, resT: resolvedByPerson.get(e.payload.approvalId)!, kind: "approval" });
    if (e.type === "question" && answeredAt.has(e.payload.questionId)) gates.push({ reqSeq: e.seq, reqT: e.tMs, resT: answeredAt.get(e.payload.questionId)!, kind: "question" });
  }
  gates.sort((a, b) => a.reqT - b.reqT);
  const gateBySeq = new Map(gates.map((g) => [g.reqSeq, g.kind]));

  // time map: remove each wait, keeping a short band so events that happened during it stay ordered
  const f = (t: number) => {
    let cut = 0;
    for (const g of gates) {
      const w = Math.max(1, g.resT - g.reqT);
      if (t <= g.reqT) break;
      if (t < g.resT) return Math.round(g.reqT - cut + ((t - g.reqT) / w) * BAND_MS);
      cut += w - BAND_MS;
    }
    return Math.round(t - cut);
  };

  const kept = events.filter((e) => {
    if (e.type === "approval.resolve") return e.payload.by !== "you" && e.payload.by !== "system";
    if (e.type === "policy") return false;
    if (e.type === "message" && (e.agentInstance === "user" || e.payload.role === "user" || e.payload.ackOf)) return false;
    return true;
  });

  const out = kept
    .map((e) => {
      const payload = structuredClone(e.payload) as unknown as Record<string, unknown>;
      if (e.type.startsWith("segment.")) for (const k of ["startMs", "endMs"]) if (typeof payload[k] === "number") payload[k] = f(payload[k] as number);
      return { e, tMs: f(e.tMs), payload };
    })
    .sort((a, b) => a.tMs - b.tMs || a.e.seq - b.e.seq);

  return out.map((x, i) => {
    const gate = gateBySeq.get(x.e.seq);
    return { id: `e${String(i + 1).padStart(4, "0")}`, tMs: x.tMs, agent: x.e.agent, agentInstance: x.e.agentInstance, type: x.e.type, payload: x.payload, ...(gate ? { gate } : {}) } as unknown as FixtureEvent;
  });
}

export function writeRecording(events: AnyRunEvent[], workstreamId: string): string {
  const dir = process.env.NIMBUS_RECORD_DIR || path.join(process.cwd(), "fixtures", "real-runs");
  mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  const file = path.join(dir, `${workstreamId.replace(/^ws-/, "")}-${ts}.events.json`);
  writeFileSync(file, JSON.stringify(toFixture(events), null, 1) + "\n");
  return file;
}
