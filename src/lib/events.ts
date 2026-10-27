// RunEvent contract (SPEC §3, §12, §14). The UI renders only from these events,
// so the replay source (src/runtime/replay.ts) and the live runtime (Phase 1)
// are interchangeable behind src/runtime/source.ts.
import type { AgentRole, Tier } from "./models";

export type Risk = "low" | "medium" | "high";

export type ProposedAction = {
  kind: "send_message" | "write_file" | "http_request" | "run_code";
  summary: string;
  details: unknown;
  risk: Risk;
};

export type PlanAgent = { role: AgentRole; instance: string; tier: Tier; brief: string };

export type RunSummary = {
  memories: string[];
  /** SKILL.md diff rows: "+" added, "-" removed, " " context */
  skillDiff: { op: "+" | "-" | " "; text: string }[];
  routedHops: number;
};

export type RunEndStatus = "done" | "failed" | "cancelled" | "stopped";

export interface PayloadMap {
  "run.start": { title: string; workstreamId: string; goal: string; startedAt: number; trigger: "manual" | "cron" | "chat" | "job"; /** what this run loaded from earlier runs: memories in the prompt and policy lines from SKILL.md */ learned?: { memories: number; policies: number } };
  "run.end": { status: RunEndStatus; summary?: string };
  "run.error": { message: string };
  "agent.spawn": { by: string; role: AgentRole; instance: string; brief: string };
  "agent.start": Record<string, never>;
  "agent.end": { summary?: string };
  "agent.error": { message: string };
  /** A segment is opened by an event without endMs and closed by a later event with the same segId. */
  "segment.think": SegmentPayload;
  "segment.tool": SegmentPayload;
  "segment.wait": SegmentPayload;
  "tool.call": { callId: string; tool: string; input: unknown };
  "tool.result": { callId: string; tool: string; ok: boolean; output: unknown };
  handoff: { from: string; to: string; context: string };
  "approval.request": { approvalId: string; action: ProposedAction };
  "approval.resolve": { approvalId: string; decision: "approved" | "rejected"; by: string; always?: boolean; note?: string };
  "artifact.version": { artifactId: string; kind: "doc" | "code"; title: string; version: number; content: string; language?: string };
  message: {
    id: string;
    role: "agent" | "user";
    text: string;
    /** steering note waiting for the orchestrator's next turn */
    queued?: boolean;
    /** this message acknowledges the queued message with this id */
    ackOf?: string;
    /** this message answers the question with this id */
    answerTo?: string;
    card?: "summary";
    summary?: RunSummary;
  };
  usage: { tier: Tier; in: number; out: number; cached?: boolean };
  route: { hop: number; role: AgentRole; chosen: Tier; ceiling: Tier; reason: string; fallback?: boolean };
  plan: { agents: PlanAgent[]; tools: string[]; estimate: { costUsd: number; tokens: number; label: string } };
  question: { questionId: string; text: string; options?: string[] };
  policy: { rule: string };
}

export type SegmentPayload = {
  segId: string;
  label: string;
  startMs?: number;
  endMs?: number;
  failed?: boolean;
};

export type RunEventType = keyof PayloadMap;

export type RunEvent<T extends RunEventType = RunEventType> = {
  id: string;
  runId: string;
  /** position in the run's event log; clients resume with ?since=<seq> */
  seq: number;
  /** ms since run start */
  tMs: number;
  agent: AgentRole;
  agentInstance: string;
  type: T;
  payload: PayloadMap[T];
};

export type AnyRunEvent = { [K in RunEventType]: RunEvent<K> }[RunEventType];

/** What the replay fixture stores: no run id or seq; `gate` pauses the whole replay until a person acts. */
export type FixtureEvent = {
  [K in RunEventType]: Omit<RunEvent<K>, "runId" | "seq"> & { gate?: "question" | "approval" };
}[RunEventType];
