// The one interface the API routes and the UI depend on. Today it is backed by the
// fixture replay (src/runtime/replay.ts); Phase 1 adds the live orchestrator behind
// the same RunHandle and flips NIMBUS_RUN_SOURCE=live. No UI change is needed.
import type { AnyRunEvent, PlanStep } from "@/lib/events";
import { createLiveRun } from "./live";
import { createReplayRun } from "./replay";

export type StartRunInput = {
  workstreamId: string;
  title: string;
  goal: string;
  mode?: "ask" | "auto-low" | "dry";
  tier?: "auto" | "cheap" | "max";
  tools?: string[];
  files?: string[];
  trigger?: "manual" | "cron" | "chat" | "job";
  /** the plan is a draft until the person approves it (UI-started runs; scheduled, chat and CLI runs keep the 3 s window) */
  review?: boolean;
};

export type ApprovalDecision = { decision: "approved" | "rejected"; always?: boolean; note?: string; /** where the decision came from; "you" (the web app) when absent */ by?: "you" | "chat" };

export interface RunHandle {
  id: string;
  workstreamId: string;
  startedAt: number;
  readonly events: AnyRunEvent[];
  readonly finished: boolean;
  /** resolves when the run, including the learner, has fully ended and been persisted */
  readonly settled: Promise<void>;
  onEvent(fn: (e: AnyRunEvent) => void): () => void;
  onDone(fn: () => void): () => void;
  resolveApproval(approvalId: string, d: ApprovalDecision): boolean;
  setPaused(paused: boolean): boolean;
  planAction(a: { action: "approve" | "revise"; steps: PlanStep[] }): boolean;
  postMessage(m: { text: string; kind: "steer" | "answer"; questionId?: string; via?: "chat" | "auto" }): boolean;
  stop(reason: "stop" | "cancel"): void;
}

declare global {
  var __nimbusRuns: Map<string, RunHandle> | undefined;
}

// globalThis so the registry survives Next.js HMR (SPEC §4).
const runs = (globalThis.__nimbusRuns ??= new Map<string, RunHandle>());

export function startRun(input: StartRunInput): RunHandle {
  // Live runtime by default (mock model needs no keys); NIMBUS_RUN_SOURCE=replay plays the recorded fixture.
  // NIMBUS_REPLAY=<path> replays a recorded run (docs/BUDGET.md: the video is recorded from a real run at zero cost).
  const run = process.env.NIMBUS_REPLAY || process.env.NIMBUS_RUN_SOURCE === "replay" ? createReplayRun(input) : createLiveRun(input);
  runs.set(run.id, run);
  if (runs.size > 25) runs.delete(runs.keys().next().value as string);
  return run;
}

export const getRun = (id: string) => runs.get(id);
/** runs still going in this server process (the status pill and its panel read these) */
export const liveRuns = () => [...runs.values()].filter((r) => !r.finished);
