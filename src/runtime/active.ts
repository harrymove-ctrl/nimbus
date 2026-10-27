// Runs that are going or waiting right now, summarised for the status pill and its panel (SPEC §17.3).
import { buildView, TIER_LABEL, type ViewStatus } from "@/lib/run-view";
import { WORKSTREAMS } from "@/lib/workstreams";
import { liveRuns } from "./source";

export type ActiveRun = {
  id: string;
  workstreamId: string;
  title: string;
  color: string;
  status: ViewStatus;
  paused: boolean;
  startedAt: number;
  elapsedMs: number;
  /** "Analyst · run_code": the segment that is open now */
  activity: string;
  model: string;
  step: { index: number; total: number } | null;
  recent: { text: string; ms: number | null; state: "done" | "running" | "failed" }[];
  approval?: { approvalId: string; summary: string; risk: string };
  question?: string;
  planAwaiting: boolean;
};

export function activeRuns(): ActiveRun[] {
  return liveRuns()
    .map((run) => {
      const v = buildView(run.events);
      const ws = WORKSTREAMS.find((w) => w.id === run.workstreamId);
      // the newest segment that has not ended
      let cur: { role: string; label: string; start: number; tier: keyof typeof TIER_LABEL } | null = null;
      for (const l of v.lanes) for (const s of l.segments) if (s.endMs === undefined && (!cur || s.startMs > cur.start)) cur = { role: l.role, label: s.label, start: s.startMs, tier: l.tier };
      const steps = v.plan?.steps ?? [];
      const doneN = steps.filter((s) => v.stepState[s.id]?.state === "done").length;
      const runningIdx = steps.findIndex((s) => v.stepState[s.id]?.state === "running");
      const recent = steps
        .map((s) => ({ s, st: v.stepState[s.id] }))
        .filter((x) => x.st && x.st.state !== "pending")
        .slice(-3)
        .map(({ s, st }) => ({ text: s.text, ms: st.endMs !== undefined && st.startMs !== undefined ? st.endMs - st.startMs : null, state: st.state as "done" | "running" | "failed" }));
      const ap = v.pendingApprovals[0];
      const role = cur?.role ? cur.role[0].toUpperCase() + cur.role.slice(1) : "";
      return {
        id: run.id,
        workstreamId: run.workstreamId,
        title: ws?.title ?? v.title,
        color: ws?.color ?? "#9ca3af",
        status: v.status,
        paused: v.paused,
        startedAt: v.startedAt || run.startedAt,
        elapsedMs: Date.now() - (v.startedAt || run.startedAt),
        activity: v.paused ? "Paused" : v.planAwaiting ? "Waiting for you to approve the plan" : ap ? `Waiting for you: ${ap.action.summary}` : v.openQuestion ? "Asked you a question" : cur ? `${role} · ${cur.label}` : "Planning",
        model: TIER_LABEL[cur?.tier ?? "ultra"],
        step: steps.length ? { index: Math.min(steps.length, (runningIdx >= 0 ? runningIdx : doneN) + 1), total: steps.length } : null,
        recent,
        approval: ap ? { approvalId: ap.approvalId, summary: ap.action.summary, risk: ap.action.risk } : undefined,
        question: v.openQuestion?.text,
        planAwaiting: v.planAwaiting,
      } satisfies ActiveRun;
    })
    .sort((a, b) => b.startedAt - a.startedAt);
}
