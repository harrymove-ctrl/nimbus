// The one interface the API routes and the UI depend on. Today it is backed by the
// fixture replay (src/runtime/replay.ts); Phase 1 adds the live orchestrator behind
// the same RunHandle and flips NIMBUS_RUN_SOURCE=live. No UI change is needed.
import type { AnyRunEvent } from "@/lib/events";
import { createReplayRun } from "./replay";

export type StartRunInput = {
  workstreamId: string;
  title: string;
  goal: string;
  mode?: "ask" | "auto-low" | "dry";
  tier?: "auto" | "cheap" | "max";
};

export type ApprovalDecision = { decision: "approved" | "rejected"; always?: boolean; note?: string };

export interface RunHandle {
  id: string;
  workstreamId: string;
  startedAt: number;
  readonly events: AnyRunEvent[];
  readonly finished: boolean;
  onEvent(fn: (e: AnyRunEvent) => void): () => void;
  onDone(fn: () => void): () => void;
  resolveApproval(approvalId: string, d: ApprovalDecision): boolean;
  postMessage(m: { text: string; kind: "steer" | "answer"; questionId?: string }): boolean;
  stop(reason: "stop" | "cancel"): void;
}

declare global {
  var __nimbusRuns: Map<string, RunHandle> | undefined;
}

// globalThis so the registry survives Next.js HMR (SPEC §4).
const runs = (globalThis.__nimbusRuns ??= new Map<string, RunHandle>());

export function startRun(input: StartRunInput): RunHandle {
  const run = createReplayRun(input);
  runs.set(run.id, run);
  if (runs.size > 25) runs.delete(runs.keys().next().value as string);
  return run;
}

export const getRun = (id: string) => runs.get(id);
