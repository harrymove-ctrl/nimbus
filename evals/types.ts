// Trajectory goldens (SPEC §13): a scenario to run, per-hop assertions, and assertions on the run as a whole.
import type { AgentRole } from "../src/lib/models";

export type Assertion =
  | { spawned_at_least: number }
  | { spawned_at_most: number }
  | { tool_called: string }
  | { no_tool: string }
  | { no_side_effect: "send_message" }
  | { sources_at_least: number }
  | { approval_before: "send_message" }
  | { approval_count: number }
  | { approval_resolved_by: "you" | "policy" | "mode" | "system" }
  | { artifact_contains: string }
  | { artifact_versions_at_least: number }
  | { message_contains: string }
  | { max_cost_usd: number }
  | { max_seconds: number }
  | { status: "done" | "cancelled" | "stopped" | "failed" }
  | { route_fallback: true }
  | { route_all: "nano" | "super" | "ultra" }
  | { policy_emitted: true }
  /** LLM-judged (Nano, 0–2 rubric; 2 = pass). Mock mode scores from evals/fixtures/rubric.json. */
  | { judge: string };

export type Scenario = {
  goal?: string;
  mode?: "ask" | "auto-low" | "dry";
  tier?: "auto" | "cheap" | "max";
  /** answers to ask_user questions, in order (default: the last option) */
  answers?: string[];
  /** decisions for approval requests, in order (default: approve) */
  approvals?: ("approve" | "approve_always" | "reject")[];
  note?: string;
  /** a steering note sent right after the plan */
  steer?: string;
  /** cancel this many ms after the run starts */
  cancel_after_ms?: number;
  /** extra env for this golden only (e.g. NIMBUS_MOCK_FAIL, NIMBUS_BAD_MODEL) */
  env?: Record<string, string>;
  /** a second run on the same workstream; assertions apply to the last run */
  then?: Scenario;
};

export type Golden = {
  name: string;
  workstream: "ws-checkout" | "ws-mezo" | "ws-inbox";
  description?: string;
  /** tests a router feature (Tier = Cheap): skipped when the router is off, since off pins every hop to its ceiling */
  requires_router?: boolean;
  /** part of the six-golden `--cheap` set the CI gate runs */
  cheap?: boolean;
  input: Scenario;
  hops: { agent: AgentRole; expect: Assertion[] }[];
  final: Assertion[];
};
