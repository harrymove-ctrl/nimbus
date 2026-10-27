import type { PayloadMap, PlanStep, ProposedAction, RunEventType } from "@/lib/events";
import type { AgentRole } from "@/lib/models";

export type Emit = <T extends RunEventType>(type: T, agent: AgentRole, instance: string, payload: PayloadMap[T]) => void;

export type ApprovalResult = { decision: "approved" | "rejected"; always?: boolean; note?: string; by: string };

/** Everything a running crew shares. The live handle (live.ts) owns one per run. */
export type RunCtx = {
  runId: string;
  workstreamId: string;
  /** mock-model script directory: the workstream id, plus "~2" when the run started with memories (see mockScript) */
  script: string;
  goal: string;
  mode: "ask" | "auto-low" | "dry";
  /** tools the person allowed for this run (composer Tools chip); control tools are always available */
  allowedTools: string[];
  tierChoice: "auto" | "cheap" | "max";
  startedAt: number;
  /** started from the UI: the plan is a draft the person edits and approves before the crew acts (SPEC §17.2) */
  review: boolean;
  /** resolves when the person approves or sends back the draft plan */
  awaitPlan(): Promise<{ action: "approve" | "revise"; steps: PlanStep[] }>;
  workspace: string;
  /** resolves at once unless the person paused the run (agents call it before every hop) */
  untilResumed(): Promise<void>;
  signal: AbortSignal;
  emit: Emit;
  /** the workstream's SKILL.md and the top-k memories, loaded at run start (placed after the stable role prefix) */
  skill: string;
  memories: string[];
  /** global hop counter for route events */
  hop: number;
  routedHops: number;
  usage: { in: number; out: number; costUsd: number; baselineUsd: number };
  /** the same, split by the tier that answered (Overview charts) */
  usageByTier: Record<"ultra" | "super" | "nano", { in: number; out: number; costUsd: number }>;
  artifactVersions: Map<string, number>;
  /** latest content per artifact id (open_pr reads its patch from here) */
  artifactContent: Map<string, string>;
  instances: Set<string>;
  askUser(instance: string, role: AgentRole, text: string, options?: string[]): Promise<string>;
  requestApproval(action: ProposedAction, who: { role: AgentRole; instance: string }): Promise<ApprovalResult>;
  /** steering notes queued since the last orchestrator turn boundary */
  drainSteering(): { id: string; text: string }[];
  ackSteering(id: string, text: string): void;
  /** persist helpers (no-ops when the DB is unavailable) */
  saveArtifact(a: { artifactId: string; kind: string; title: string; version: number; content: string; language?: string }): Promise<void>;
};

export class RunAborted extends Error {
  constructor(public reason: "cancel" | "stop") {
    super(`run ${reason}`);
  }
}

export function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (ms <= 0) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(signal.reason instanceof RunAborted ? signal.reason : new RunAborted("stop"));
      },
      { once: true },
    );
  });
}

export function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
}

/** Wait for a promise but throw RunAborted the moment the run is stopped. */
export function untilAborted<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason instanceof RunAborted ? signal.reason : new RunAborted("stop"));
    if (signal.aborted) return onAbort();
    signal.addEventListener("abort", onAbort, { once: true });
    p.then(
      (v) => (signal.removeEventListener("abort", onAbort), resolve(v)),
      (e) => (signal.removeEventListener("abort", onAbort), reject(e)),
    );
  });
}
