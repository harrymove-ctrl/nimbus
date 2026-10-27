"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanelLeft, PanelRight } from "lucide-react";
import { GlowCloud } from "@/components/glow-cloud";
import { useNow, useReducedMotion, useRunEvents } from "@/hooks/use-run";
import { buildView, type ApprovalItem, type QuestionItem, type Seg } from "@/lib/run-view";
import type { Workstream } from "@/lib/workstreams";
import { ApprovalTray } from "./approval-tray";
import { Boot } from "./boot";
import { EmptyState } from "@/components/dithercn/empty-state";
import { AmbientGlow } from "./loading";
import { Composer, type Mode, type TierChoice } from "./composer";
import { Inspector, type InspectorTab } from "./inspector";
import { LEARNING_CHANGED } from "./learning";
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
  const [wsLoaded, setWsLoaded] = useState(false);
  const [budget, setBudget] = useState<{ todayUsd: number; dayCapUsd: number; runCapUsd: number }>();
  const [notice, setNotice] = useState<string | null>(null);
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
  const now = useNow(clock, reduced ? 1000 : 60);

  // Boot: first GET /api/workstreams resolves → cloud fades out (kept up at least 1.2 s so it reads as a preloader).
  useEffect(() => {
    let alive = true;
    const minWait = new Promise((r) => setTimeout(r, 900));
    const fetched = fetch("/api/workstreams").then((r) => r.json() as Promise<{ workstreams: Workstream[] }>);
    // The boot cloud leaves when the workstreams arrive (at least 900 ms in), but never later than 3 s: on a slow
    // network the shell shows and the rail has a skeleton instead of the person staring at the preloader.
    void Promise.race([Promise.all([fetched, minWait]), new Promise((r) => setTimeout(r, 3000))]).then(() => {
      if (!alive) return;
      setBoot("fading");
      setTimeout(() => alive && setBoot("gone"), 420);
    });
    void fetched.then(async (d) => {
      if (!alive) return;
      setWorkstreams(d.workstreams);
      // ?loaders=1 (the demo video): hold the rail skeleton for a visible beat instead of flashing it
      if (new URLSearchParams(window.location.search).has("loaders")) await new Promise((r) => setTimeout(r, 900));
      if (!alive) return;
      setWsLoaded(true);
      // Deep link from a chat reply: /?run=<id> opens that run in its workstream (the approval lives here).
      const rid = new URLSearchParams(window.location.search).get("run");
      if (rid) {
        const r = await fetch(`/api/runs/${rid}`).then((x) => (x.ok ? (x.json() as Promise<{ workstreamId: string }>) : null)).catch(() => null);
        if (r && alive) {
          setSelectedId(r.workstreamId);
          setRunByWs((m) => ({ ...m, [r.workstreamId]: rid }));
        }
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (ws) setTools(ws.tools);
  }, [ws]);

  const refreshBudget = useCallback(() => {
    fetch("/api/budget").then((r) => r.json() as Promise<{ todayUsd: number; dayCapUsd: number; runCapUsd: number }>).then(setBudget).catch(() => {});
  }, []);
  useEffect(() => {
    if (boot === "gone") refreshBudget();
  }, [boot, refreshBudget, view.status]);

  const refreshWorkstreams = useCallback(async () => {
    const d = await fetch("/api/workstreams").then((r) => r.json() as Promise<{ workstreams: Workstream[] }>).catch(() => null);
    if (d) setWorkstreams(d.workstreams.map((w) => (w.id === selectedId ? { ...w, unread: false } : w)));
  }, [selectedId]);

  // The Learner rewrites SKILL.md after run.end: show the new text in the Memory tab.
  const hasSummary = !!view.summary;
  useEffect(() => {
    if (hasSummary) void refreshWorkstreams();
  }, [hasSummary, refreshWorkstreams]);

  // Scheduled runs finish while you are away: refresh the rail's unread dots.
  useEffect(() => {
    if (boot !== "gone") return;
    const t = setInterval(() => {
      fetch("/api/workstreams")
        .then((r) => r.json() as Promise<{ workstreams: Workstream[] }>)
        .then((d) => setWorkstreams(d.workstreams.map((w) => (w.id === selectedId ? { ...w, unread: false } : w))))
        .catch(() => {});
    }, 10_000);
    return () => clearInterval(t);
  }, [boot, selectedId]);

  // Picking a workstream shows its latest run (frozen, or live if it is still going) and clears its unread dot.
  const openWorkstream = useCallback(
    async (id: string) => {
      setSelectedId(id);
      setDrawer(null);
      setSelSeg(null);
      setWorkstreams((w) => w.map((x) => (x.id === id ? { ...x, unread: false } : x)));
      void fetch(`/api/workstreams/${id}/read`, { method: "POST" });
      if (runByWs[id]) return;
      const d = await fetch(`/api/runs?workstreamId=${id}`).then((r) => r.json() as Promise<{ runs: { id: string }[] }>).catch(() => null);
      const latest = d?.runs[0];
      if (latest) setRunByWs((m) => (m[id] ? m : { ...m, [id]: latest.id }));
    },
    [runByWs],
  );

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
      if (res.status === 429) {
        // Past the daily cap: say so in the composer area; the cloud stays blue (this is not an approval).
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        setNotice(j.message ?? "Daily spend cap reached.");
        refreshBudget();
        return;
      }
      if (!res.ok) return;
      setNotice(null);
      const { runId: id } = (await res.json()) as { runId: string };
      setSelectedId(target.id);
      setRunByWs((m) => ({ ...m, [target.id]: id }));
      setSelSeg(null);
      setDraft("");
      setFiles([]);
      setDrawer(null);
    },
    [draft, files, mode, tier, tools, selectedId, workstreams, refreshBudget],
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
          onSelect={(id) => void openWorkstream(id)}
          onRun={(id) => void startRun({ saved: true }, id)}
          budget={budget}
          loading={!wsLoaded}
          className={cx("z-40 xl:static xl:flex xl:w-[280px] xl:shrink-0", drawer === "rail" ? "nb-drawer-left fixed inset-y-12 left-0 flex w-[280px]" : "hidden")}
        />

        <main className="relative isolate flex min-w-0 flex-1 flex-col">
          {/* ambient dither: behind the run view and the empty state only; never the boot screen, composer, cards or cloud */}
          {boot === "gone" && <AmbientGlow paused={view.lanes.length >= 7 && clock} />}
          {!ws ? (
            <PickWorkstream workstreams={workstreams} onPick={(id) => void openWorkstream(id)} />
          ) : (
            <>
              <RunHeader view={view} now={now} fallbackTitle={ws.title} runCapUsd={budget?.runCapUsd} />
              <Timeline view={view} now={now} selected={selSeg} onSelect={selectSeg} collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} reducedMotion={reduced} />
              <Transcript
                waitingForCrew={!!runId && (events.length === 0 || (view.status === "planning" && !view.plan))}
                view={view}
                now={now}
                onCancelPlan={() => void stop("cancel")}
                onAnswer={answer}
                onDecide={(a, d, n) => void decide(a, d, n)}
                onRevertSkill={async () => {
                  const r = await fetch(`/api/workstreams/${ws.id}/skill/revert`, { method: "POST" });
                  if (r.ok) {
                    void refreshWorkstreams();
                    window.dispatchEvent(new Event(LEARNING_CHANGED));
                  }
                  return r.ok;
                }}
                onOpenArtifact={(id, version) => {
                  setTab("artifact");
                  setFocusArtifact({ id, version, n: ++focusN.current });
                  setDrawer("inspector");
                }}
              />
              <div className="flex shrink-0 flex-col gap-2 px-4 pb-4 pt-2">
                {notice && (
                  <div role="alert" className="mx-auto flex w-full max-w-[720px] items-start gap-2 rounded-xl border border-orange-400/30 bg-orange-500/10 px-3 py-2 text-[13px]/[19px] text-orange-100">
                    <span className="flex-1">{notice}</span>
                    <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)} className="text-orange-200/80 hover:text-orange-100">
                      ×
                    </button>
                  </div>
                )}
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
          loading={!!runId && events.length === 0}
          className={cx("z-40 xl:static xl:flex xl:w-[420px] xl:shrink-0", drawer === "inspector" ? "nb-drawer-right fixed inset-y-12 right-0 flex max-w-full sm:w-[420px]" : "hidden")}
        />
      </div>
    </div>
  );
}

function PickWorkstream({ workstreams, onPick }: { workstreams: Workstream[]; onPick: (id: string) => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto p-6">
      <div className="my-auto w-full max-w-xl">
        <EmptyState illustration="planet" titleAs="h2" title="Pick a workstream" description="A workstream is a standing goal. Each run is a crew of Nemotron agents working on it, with you approving anything that acts." className="pb-4 pt-0" />
        <ul className="mt-2 flex flex-col gap-2">
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
