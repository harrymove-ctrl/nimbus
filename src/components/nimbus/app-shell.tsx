"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanelLeft, PanelRight } from "lucide-react";
import { GlowCloud } from "@/components/glow-cloud";
import { useNow, useReducedMotion, useRunEvents } from "@/hooks/use-run";
import { buildView, type ApprovalItem, type QuestionItem, type Seg } from "@/lib/run-view";
import type { Workstream } from "@/lib/workstreams";
import { ApprovalTray } from "./approval-tray";
import { Boot } from "./boot";
import { Composer, type Mode, type TierChoice } from "./composer";
import { Inspector, type InspectorTab } from "./inspector";
import { Rail } from "./rail";
import { RunHeader } from "./run-header";
import { Timeline, type SegRef } from "./timeline";
import { Transcript } from "./transcript";
import { cx } from "./ui";

const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export function AppShell() {
  const reduced = useReducedMotion();
  const [workstreams, setWorkstreams] = useState<Workstream[]>([]);
  const [boot, setBoot] = useState<"boot" | "fading" | "gone">("boot");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runByWs, setRunByWs] = useState<Record<string, string>>({});
  const [drawer, setDrawer] = useState<"rail" | "inspector" | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<InspectorTab>("artifact");
  const [selSeg, setSelSeg] = useState<SegRef | null>(null);
  const [focusArtifact, setFocusArtifact] = useState<{ id: string; version: number; n: number }>();

  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [tools, setTools] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("ask");
  const [tier, setTier] = useState<TierChoice>("auto");
  const lastDraft = useRef("");
  const focusN = useRef(0);

  const ws = workstreams.find((w) => w.id === selectedId);
  const runId = selectedId ? (runByWs[selectedId] ?? null) : null;
  const { events } = useRunEvents(runId);
  const view = useMemo(() => buildView(events), [events]);
  const clock = view.active || view.status === "planning" || view.lanes.some((l) => l.status === "running");
  const now = useNow(clock);

  // Boot: first GET /api/workstreams resolves → cloud fades out (kept up at least 1.2 s so it reads as a preloader).
  useEffect(() => {
    let alive = true;
    const minWait = new Promise((r) => setTimeout(r, 1200));
    Promise.all([fetch("/api/workstreams").then((r) => r.json() as Promise<{ workstreams: Workstream[] }>), minWait]).then(([d]) => {
      if (!alive) return;
      setWorkstreams(d.workstreams);
      setBoot("fading");
      setTimeout(() => alive && setBoot("gone"), 420);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (ws) setTools(ws.tools);
  }, [ws]);

  // New doc version arrives → show it in the Artifact tab, LATEST selected.
  const docVersions = view.artifacts.filter((a) => a.kind === "doc").reduce((n, a) => n + a.versions.length, 0);
  useEffect(() => {
    if (docVersions > 0) setTab("artifact");
  }, [docVersions]);

  // Cancelled inside the plan window → restore the draft.
  useEffect(() => {
    if (view.status === "cancelled" && lastDraft.current) {
      setDraft(lastDraft.current);
      lastDraft.current = "";
    }
  }, [view.status]);

  const runBusy = view.status !== "idle" && view.active;

  const startRun = useCallback(
    async (opts?: { max?: boolean; saved?: boolean }, wsId = selectedId) => {
      const target = workstreams.find((w) => w.id === wsId);
      if (!target) return;
      const goal = opts?.saved ? target.goal : draft.trim() || target.goal;
      lastDraft.current = opts?.saved ? "" : draft;
      const res = await post("/api/runs", { workstreamId: target.id, goal, mode, tier: opts?.max ? "max" : tier, tools, files });
      if (!res.ok) return;
      const { runId: id } = (await res.json()) as { runId: string };
      setSelectedId(target.id);
      setRunByWs((m) => ({ ...m, [target.id]: id }));
      setSelSeg(null);
      setDraft("");
      setFiles([]);
      setDrawer(null);
    },
    [draft, files, mode, tier, tools, selectedId, workstreams],
  );

  const stop = (reason: "cancel" | "stop") => runId && post(`/api/runs/${runId}/stop`, { reason });
  const decide = (a: ApprovalItem, decision: "approve" | "approve_always" | "reject", note?: string) => runId && post(`/api/runs/${runId}/approvals/${a.approvalId}`, { decision, note });
  const answer = (q: QuestionItem, text: string) => {
    if (!runId) return;
    void post(`/api/runs/${runId}/messages`, { text, kind: "answer", questionId: q.questionId });
    setDraft("");
  };
  const steer = (text: string) => {
    if (!runId) return;
    void post(`/api/runs/${runId}/messages`, { text, kind: "steer" });
    setDraft("");
  };

  const selectSeg = (s: Seg) => {
    setSelSeg({ instance: s.instance, id: s.id });
    setTab("agent");
    const target = view.transcript.find((i) => i.tMs >= s.startMs) ?? view.transcript[view.transcript.length - 1];
    if (target) document.getElementById(`tr-${target.seq}`)?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
  };

  const pendingByWs = selectedId && view.pendingApprovals.length ? { [selectedId]: view.pendingApprovals.length } : {};
  const busyWs = selectedId && runBusy ? { [selectedId]: true } : {};
  const needsYou = view.pendingApprovals.length > 0 || view.status === "failed";

  return (
    <div className="flex h-dvh flex-col bg-neutral-950 text-neutral-100">
      {boot !== "gone" && <Boot fading={boot === "fading"} />}

      {/* Top bar H0 = 48, cloud Z7 = 40: blue while idle/running, orange while an approval is pending */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 px-3">
        <button type="button" aria-label="Workstreams" onClick={() => setDrawer(drawer === "rail" ? null : "rail")} className="grid size-8 place-items-center rounded-md text-neutral-300 hover:bg-white/10 xl:hidden">
          <PanelLeft className="size-4" />
        </button>
        <div className="size-10 shrink-0" title={needsYou ? "Needs you" : "Crew ready"}>
          <GlowCloud color={needsYou ? "orange" : "blue"} background={false} followPointer={false} label={needsYou ? "Nimbus needs your approval" : "Nimbus"} />
        </div>
        <span className="text-[16px] font-extrabold tracking-tight">Nimbus</span>
        <span className="ms-2 hidden text-[13px] font-semibold text-neutral-500 sm:inline" aria-live="polite">
          {needsYou ? <span className="text-orange-300">{view.pendingApprovals.length} waiting for you</span> : view.status === "asked" ? <span className="text-orange-300">the crew asked you a question</span> : view.status === "running" || view.status === "planning" ? "crew at work" : "crew idle"}
        </span>
        <button type="button" aria-label="Inspector" onClick={() => setDrawer(drawer === "inspector" ? null : "inspector")} className="ms-auto grid size-8 place-items-center rounded-md text-neutral-300 hover:bg-white/10 xl:hidden">
          <PanelRight className="size-4" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {drawer && <button aria-label="Close panel" className="fixed inset-0 z-30 bg-black/50 xl:hidden" onClick={() => setDrawer(null)} />}
        <Rail
          workstreams={workstreams}
          selectedId={selectedId}
          pendingByWs={pendingByWs}
          busyWs={busyWs}
          onSelect={(id) => (setSelectedId(id), setDrawer(null), setSelSeg(null), setWorkstreams((w) => w.map((x) => (x.id === id ? { ...x, unread: false } : x))))}
          onRun={(id) => void startRun({ saved: true }, id)}
          className={cx("z-40 xl:static xl:flex xl:w-[280px] xl:shrink-0", drawer === "rail" ? "fixed inset-y-12 left-0 flex w-[280px]" : "hidden")}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          {!ws ? (
            <PickWorkstream workstreams={workstreams} onPick={setSelectedId} />
          ) : (
            <>
              <RunHeader view={view} now={now} fallbackTitle={ws.title} />
              <Timeline view={view} now={now} selected={selSeg} onSelect={selectSeg} collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} reducedMotion={reduced} />
              <Transcript
                view={view}
                now={now}
                onCancelPlan={() => void stop("cancel")}
                onAnswer={answer}
                onDecide={(a, d, n) => void decide(a, d, n)}
                onOpenArtifact={(id, version) => {
                  setTab("artifact");
                  setFocusArtifact({ id, version, n: ++focusN.current });
                  setDrawer("inspector");
                }}
              />
              <div className="flex shrink-0 flex-col gap-2 px-4 pb-4 pt-2">
                <ApprovalTray
                  pending={view.pendingApprovals}
                  onApprove={(a) => void decide(a, "approve")}
                  onReject={(a) => void decide(a, "reject")}
                  onApproveAllLow={() => view.pendingApprovals.filter((a) => a.action.risk === "low").forEach((a) => void decide(a, "approve"))}
                />
                <Composer
                  view={view}
                  now={now}
                  workstream={ws}
                  draft={draft}
                  setDraft={setDraft}
                  files={files}
                  setFiles={setFiles}
                  tools={tools}
                  setTools={setTools}
                  mode={mode}
                  setMode={setMode}
                  tier={tier}
                  setTier={setTier}
                  onRun={(o) => void startRun(o)}
                  onCancel={() => void stop("cancel")}
                  onStop={() => void stop("stop")}
                  onSteer={steer}
                  onAnswer={(t) => view.openQuestion && answer(view.openQuestion, t)}
                  onApproveFirst={() => view.pendingApprovals[0] && void decide(view.pendingApprovals[0], "approve")}
                  onOpenTab={(t) => (setTab(t), setDrawer("inspector"))}
                />
              </div>
            </>
          )}
        </main>

        <Inspector
          view={view}
          workstream={ws}
          tab={tab}
          setTab={setTab}
          selected={selSeg}
          focusArtifact={focusArtifact}
          className={cx("z-40 xl:static xl:flex xl:w-[420px] xl:shrink-0", drawer === "inspector" ? "fixed inset-y-12 right-0 flex max-w-full sm:w-[420px]" : "hidden")}
        />
      </div>
    </div>
  );
}

function PickWorkstream({ workstreams, onPick }: { workstreams: Workstream[]; onPick: (id: string) => void }) {
  return (
    <div className="grid min-h-0 flex-1 place-items-center overflow-y-auto p-6">
      <div className="w-full max-w-xl">
        <h1 className="text-[22px] font-extrabold">Pick a workstream</h1>
        <p className="mt-1 text-[14px] text-neutral-400">A workstream is a standing goal. Each run is a crew of Nemotron agents working on it, with you approving anything that acts.</p>
        <ul className="mt-5 flex flex-col gap-2">
          {workstreams.map((w) => (
            <li key={w.id}>
              <button type="button" onClick={() => onPick(w.id)} className="flex w-full flex-col items-start gap-0.5 rounded-xl border border-white/10 px-4 py-3 text-left transition-colors hover:bg-white/5">
                <span className="text-[15px] font-bold">{w.title}</span>
                <span className="text-[13px] text-neutral-400">{w.goal}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
