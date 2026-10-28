"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanelLeft, PanelRight, Brain, FileText, GanttChart, MessageSquare } from "lucide-react";
import { GlowCloud } from "@/components/glow-cloud";
import { useNow, useReducedMotion, useRunEvents } from "@/hooks/use-run";
import { buildView, type ApprovalItem, type QuestionItem, type Seg } from "@/lib/run-view";
import type { Workstream } from "@/lib/workstreams";
import { ApprovalTray } from "./approval-tray";
import { Boot } from "./boot";
import { EmptyState } from "@/components/dithercn/empty-state";
import { Aurora } from "@/components/dithercn/aurora";
import { Ripples } from "@/components/dithercn/ripples";
import { useMedia } from "@/hooks/use-media";
import { Overview } from "./overview";
import { StatusPill, useActiveRuns } from "./status-pill";
import { AmbientGlow } from "./loading";
import { Composer, type Mode, type TierChoice } from "./composer";
import { Inspector, type InspectorTab } from "./inspector";
import { LEARNING_CHANGED } from "./learning";
import { NewWorkstream } from "./new-workstream";
import { Rail } from "./rail";
import { RunHeader } from "./run-header";
import { cue, SoundToggle, useRunCues, useSound } from "./sound";
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
  const [budget, setBudget] = useState<{ todayUsd: number; dayCapUsd: number; runCapUsd: number; mock?: boolean }>();
  const [notice, setNotice] = useState<string | null>(null);
  const [focusArtifact, setFocusArtifact] = useState<{ id: string; version: number; n: number }>();
  const [creating, setCreating] = useState(false);

  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [tools, setTools] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("ask");
  const [tier, setTier] = useState<TierChoice>("auto");
  const lastDraft = useRef("");
  const focusN = useRef(0);

  const ws = workstreams.find((w) => w.id === selectedId);
  const runId = selectedId ? (runByWs[selectedId] ?? null) : null;
  const active = useActiveRuns();
  const draftRef = useRef<import("@/lib/events").PlanStep[] | null>(null);
  // Phone (< 768 px, SPEC §7): four tabs instead of the three columns; a pending approval badges RUN, the tray sits at the top of CHAT
  const isPhone = useMedia("(max-width: 767px)");
  const [phoneTab, setPhoneTab] = useState<"run" | "chat" | "doc" | "memory">("chat");
  useEffect(() => {
    if (phoneTab === "memory") setTab("memory");
    else if (phoneTab === "doc") setTab((t) => (t === "memory" ? "artifact" : t));
  }, [phoneTab]);
  const restored = useRef(false);
  const { events } = useRunEvents(runId);
  const view = useMemo(() => buildView(events), [events]);
  const sound = useSound();
  const freshRun = useRef<string | null>(null);
  useRunCues(view, runId, freshRun);
  // Scrubbing a finished run (SPEC §17.5): the transcript and the Inspector show the run as it was at `scrub` ms; the
  // timeline, header and composer keep the whole run. Replay walks `scrub` forward at 0.5×, 1× or 2×.
  const [scrub, setScrub] = useState<number | null>(null);
  const [replaying, setReplaying] = useState(false);
  const [speed, setSpeed] = useState<0.5 | 1 | 2>(1);
  const runEnd = view.endedMs ?? view.lastTMs;
  const shown = useMemo(() => (scrub === null ? view : buildView(events.filter((e) => e.tMs <= scrub))), [view, events, scrub]);
  useEffect(() => {
    setScrub(null);
    setReplaying(false);
  }, [runId]);
  useEffect(() => {
    if (!replaying) return;
    const t = setInterval(() => {
      setScrub((p) => {
        const next = (p ?? 0) + 60 * speed;
        if (next >= runEnd) {
          setReplaying(false);
          return null;
        }
        return next;
      });
    }, 60);
    return () => clearInterval(t);
  }, [replaying, speed, runEnd]);
  const clock = view.active || view.status === "planning" || view.lanes.some((l) => l.status === "running");
  const now = useNow(clock, reduced ? 1000 : 60);

  // Remember where you are for a reload (only after the saved place was restored, or boot would overwrite it)
  useEffect(() => {
    if (!restored.current) return;
    try {
      window.sessionStorage.setItem("nimbus:view", JSON.stringify({ selectedId, runByWs }));
    } catch {
      /* private mode: nothing to remember */
    }
  }, [selectedId, runByWs]);

  // Boot: first GET /api/workstreams resolves → cloud fades out (kept up at least 1.2 s so it reads as a preloader).
  useEffect(() => {
    let alive = true;
    const minWait = new Promise((r) => setTimeout(r, 900));
    let bootIsGone!: () => void;
    const bootGone = new Promise<void>((r) => (bootIsGone = r));
    const fetched = fetch("/api/workstreams").then((r) => r.json() as Promise<{ workstreams: Workstream[] }>);
    // The boot cloud leaves when the workstreams arrive (at least 900 ms in), but never later than 3 s: on a slow
    // network the shell shows and the rail has a skeleton instead of the person staring at the preloader.
    void Promise.race([Promise.all([fetched, minWait]), new Promise((r) => setTimeout(r, 3000))]).then(() => {
      if (!alive) return;
      setBoot("fading");
      setTimeout(() => {
        if (!alive) return;
        setBoot("gone");
        bootIsGone();
      }, 420);
    });
    void fetched.then(async (d) => {
      if (!alive) return;
      // ?loaders=1 (the demo video): once the boot cloud is gone, keep the rail on its sweep skeleton for 900 ms
      // instead of letting it flash past
      if (new URLSearchParams(window.location.search).has("loaders")) {
        await bootGone;
        await new Promise((r) => setTimeout(r, 900));
        // once, before the first run: a later reload must not repeat the hold
        const u = new URL(window.location.href);
        u.searchParams.delete("loaders");
        window.history.replaceState(null, "", u);
      }
      if (!alive) return;
      setWorkstreams(d.workstreams);
      // a reload (a dev refresh, F5) lands back on the workstream and run you were looking at
      try {
        const saved = JSON.parse(window.sessionStorage.getItem("nimbus:view") ?? "null") as { selectedId: string | null; runByWs: Record<string, string> } | null;
        if (saved && !new URLSearchParams(window.location.search).has("run")) {
          if (saved.selectedId && d.workstreams.some((w) => w.id === saved.selectedId)) setSelectedId(saved.selectedId);
          setRunByWs((m) => ({ ...saved.runByWs, ...m }));
        }
      } catch {
        /* no storage: start on the Overview */
      }
      restored.current = true;
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

  // A run that finishes while its workstream is open is read already: clear the dot the server just set (F14).
  const endedHere = view.status === "done" || view.status === "failed" || view.status === "stopped" || view.status === "cancelled";
  useEffect(() => {
    if (endedHere && selectedId) void fetch(`/api/workstreams/${selectedId}/read`, { method: "POST" });
  }, [endedHere, selectedId, runId]);
  // A run that finished out of view: refresh the rail at once so its dot shows (and not 10 s later).
  const activeIds = active.runs.map((r) => r.id).join(",");
  const prevActive = useRef("");
  useEffect(() => {
    const before = prevActive.current ? prevActive.current.split(",") : [];
    prevActive.current = activeIds;
    if (before.some((id) => !activeIds.split(",").includes(id))) setTimeout(() => void refreshWorkstreams(), 700);
  }, [activeIds, refreshWorkstreams]);
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

  /** open a finished or running run in its workstream (Overview clicks), optionally on an Inspector tab */
  const openRun = useCallback((wsId: string, runId: string, t?: InspectorTab) => {
    setSelectedId(wsId);
    setDrawer(t ? "inspector" : null);
    setSelSeg(null);
    setWorkstreams((w) => w.map((x) => (x.id === wsId ? { ...x, unread: false } : x)));
    void fetch(`/api/workstreams/${wsId}/read`, { method: "POST" });
    setRunByWs((m) => ({ ...m, [wsId]: runId }));
    if (t) setTab(t);
  }, []);

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
      freshRun.current = id;
      cue("loading", { emphasis: "subtle" });
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
  const decide = (a: ApprovalItem, decision: "approve" | "approve_always" | "reject", note?: string) => {
    if (!runId) return;
    if (decision === "reject") cue("close");
    else cue("success", decision === "approve_always" ? { emphasis: "strong" } : undefined);
    return post(`/api/runs/${runId}/approvals/${a.approvalId}`, { decision, note });
  };
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
  const needsYou = view.pendingApprovals.length > 0 || view.planAwaiting || view.status === "failed";
  const tray = (
    <ApprovalTray
      pending={view.pendingApprovals}
      onApprove={(a) => void decide(a, "approve")}
      onReject={(a) => void decide(a, "reject")}
      onApproveAllLow={() => {
        cue("success", { emphasis: "strong" });
        view.pendingApprovals.filter((a) => a.action.risk === "low").forEach((a) => void post(`/api/runs/${runId}/approvals/${a.approvalId}`, { decision: "approve" }));
      }}
    />
  );
  const waitingN = view.pendingApprovals.length + (view.planAwaiting ? 1 : 0);

  return (
    <div className="flex h-dvh flex-col bg-neutral-950 text-neutral-100">
      {boot !== "gone" && <Boot fading={boot === "fading"} />}

      {/* Top bar H0 = 48, cloud Z7 = 40: blue while idle/running, orange while an approval is pending */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 px-3">
        <button type="button" aria-label="Workstreams" data-cuelume-open={drawer === "rail" ? undefined : ""} data-cuelume-close={drawer === "rail" ? "" : undefined} onClick={() => setDrawer(drawer === "rail" ? null : "rail")} className="grid size-8 place-items-center rounded-md text-neutral-300 hover:bg-white/10 xl:hidden">
          <PanelLeft className="size-4" />
        </button>
        <div className="size-10 shrink-0" title={needsYou ? "Needs you" : "Crew ready"}>
          <GlowCloud color={needsYou ? "orange" : "blue"} background={false} followPointer={false} label={needsYou ? "Nimbus needs your approval" : "Nimbus"} />
        </div>
        <span className="text-[16px] font-extrabold tracking-tight">Nimbus</span>
        <span className="ms-2 hidden text-[13px] font-semibold text-neutral-500 sm:inline" aria-live="polite">
          {needsYou ? <span className="text-orange-300">{view.pendingApprovals.length > 0 ? `${view.pendingApprovals.length + (view.planAwaiting ? 1 : 0)} waiting for you` : view.planAwaiting ? "1 plan waiting for you" : "needs a look"}</span> : view.status === "asked" ? <span className="text-orange-300">the crew asked you a question</span> : view.status === "running" || view.status === "planning" ? "crew at work" : "crew idle"}
        </span>
        <span className="flex-1" />
        <StatusPill runs={active.runs} fetchedAt={active.fetchedAt} reload={active.reload} currentRunId={runId} onOpenRun={(wsId, rid) => openRun(wsId, rid)} />
        <SoundToggle enabled={sound.enabled} onToggle={sound.toggle} />
        <button type="button" aria-label="Inspector" data-cuelume-open={drawer === "inspector" ? undefined : ""} data-cuelume-close={drawer === "inspector" ? "" : undefined} onClick={() => setDrawer(drawer === "inspector" ? null : "inspector")} className={cx("size-8 place-items-center rounded-md text-neutral-300 hover:bg-white/10 xl:hidden", ws && isPhone ? "hidden" : "grid")}>
          <PanelRight className="size-4" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {drawer && <button aria-label="Close panel" data-cuelume-close="" className="fixed inset-0 z-30 bg-black/50 xl:hidden" onClick={() => setDrawer(null)} />}
        <Rail
          workstreams={workstreams}
          selectedId={selectedId}
          pendingByWs={pendingByWs}
          busyWs={busyWs}
          onSelect={(id) => void openWorkstream(id)}
          onOverview={() => (setSelectedId(null), setDrawer(null))}
          onRun={(id) => void startRun({ saved: true }, id)}
          onNew={() => (setCreating(true), setDrawer(null))}
          onArchive={async (id, archived) => {
            await fetch(`/api/workstreams/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ archived }) });
            if (archived && selectedId === id) setSelectedId(null);
            await refreshWorkstreams();
          }}
          onSchedule={async (id, schedule) => {
            const r = await fetch(`/api/workstreams/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ schedule }) });
            if (!r.ok) return ((await r.json().catch(() => ({}))) as { error?: string }).error ?? "could not save the schedule";
            await refreshWorkstreams();
            return null;
          }}
          budget={budget}
          loading={!wsLoaded}
          className={cx("z-40 xl:static xl:flex xl:w-[280px] xl:shrink-0", drawer === "rail" ? "nb-drawer-left fixed inset-y-12 left-0 flex w-[280px]" : "hidden")}
        />

        <main className={cx("relative isolate min-w-0 flex-1 flex-col", ws && isPhone && (phoneTab === "doc" || phoneTab === "memory") ? "hidden" : "flex")}>
          {/* ambient dither: behind the run view and the empty state only; never the boot screen, composer, cards or cloud */}
          {/* one animated background per column (SPEC §17.6): the run view has the glow, which holds still while ripples run at an approval and at four or more running lanes; the Overview has its contours; the empty state its aurora */}
          {boot === "gone" && ws && <AmbientGlow paused={(view.lanes.length >= 4 && clock) || view.pendingApprovals.length > 0} />}
          {!ws ? (
            <Overview titles={Object.fromEntries(workstreams.map((w) => [w.id, w.title]))} onOpenRun={openRun} refreshKey={view.status === "done" ? 1 : 0} empty={<PickWorkstream workstreams={workstreams} onPick={(id) => void openWorkstream(id)} />} />
          ) : (
            <>
              <RunHeader view={view} now={now} fallbackTitle={ws.title} runCapUsd={budget?.runCapUsd} />
              {(!isPhone || phoneTab === "run") && <Timeline fill={isPhone} view={view} now={now} selected={selSeg} onSelect={selectSeg} onClearSelection={() => setSelSeg(null)} scrubMs={scrub} onScrub={(ms) => (setReplaying(false), setScrub(ms))} replay={{ playing: replaying, speed, onSpeed: setSpeed, onToggle: () => (replaying ? setReplaying(false) : (setScrub(0), setReplaying(true))) }} collapsed={collapsed && !isPhone} onToggle={() => setCollapsed((c) => !c)} reducedMotion={reduced} />}
              {isPhone && phoneTab === "chat" && tray}
              {(!isPhone || phoneTab === "chat") && (
              <>
              <Transcript
                waitingForCrew={!!runId && (events.length === 0 || (view.status === "planning" && !view.plan))}
                view={shown}
                now={now}
                manualMinutes={ws.estimatedManualMinutes}
                onDraft={(steps) => (draftRef.current = steps)}
                onCancelPlan={() => void stop("cancel")}
                onPlan={async (action, steps) => {
                  if (runId) await post(`/api/runs/${runId}/plan`, { steps, [action]: true });
                }}
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
              <div className="relative isolate flex shrink-0 flex-col gap-2 px-4 pb-4 pt-2">
                {view.pendingApprovals.length > 0 && (
                  <div className="nb-fade pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 opacity-[0.1]" aria-hidden="true">
                    <Ripples sources={[[0.5, 0.6]]} rings={9} decay={1.1} intensity={0.55} cell={3} className="absolute inset-0" />
                  </div>
                )}
                {notice && (
                  <div role="alert" className="mx-auto flex w-full max-w-[720px] items-start gap-2 rounded-xl border border-orange-400/30 bg-orange-500/10 px-3 py-2 text-[13px]/[19px] text-orange-100">
                    <span className="flex-1">{notice}</span>
                    <button type="button" aria-label="Dismiss" data-cuelume-close="" data-cuelume-emphasis="subtle" onClick={() => setNotice(null)} className="text-orange-200/80 hover:text-orange-100">
                      ×
                    </button>
                  </div>
                )}
                {!isPhone && tray}
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
                  onApprovePlan={() => {
                    const steps = draftRef.current ?? view.plan?.steps;
                    if (runId && steps) void post(`/api/runs/${runId}/plan`, { steps, approve: true });
                  }}
                  onRun={(o) => void startRun(o)}
                  onCancel={() => void stop("cancel")}
                  onStop={() => void stop("stop")}
                  onSteer={steer}
                  onAnswer={(t) => view.openQuestion && answer(view.openQuestion, t)}
                  onApproveFirst={() => view.pendingApprovals[0] && void decide(view.pendingApprovals[0], "approve")}
                  onOpenTab={(t) => (setTab(t), setDrawer("inspector"))}
                  onNew={() => setCreating(true)}
                />
              </div>
              </>
              )}
            </>
          )}
          {creating && (
            <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && setCreating(false)}>
              <NewWorkstream
                onCancel={() => setCreating(false)}
                onCreated={async ({ id, goal }) => {
                  setCreating(false);
                  await refreshWorkstreams();
                  setSelectedId(id);
                  setDraft(goal);
                  // the goal is in the composer: one Enter starts the first run
                  setTimeout(() => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message the crew"]')?.focus(), 150);
                }}
              />
            </div>
          )}
        </main>

        <Inspector
          view={shown}
          workstream={ws}
          tab={tab}
          setTab={setTab}
          selected={selSeg}
          focusArtifact={focusArtifact}
          loading={!!runId && events.length === 0}
          className={cx(!ws && "!hidden", ws && isPhone && (phoneTab === "doc" || phoneTab === "memory") ? "!flex min-h-0 flex-1 !border-l-0" : cx("z-40 xl:static xl:flex xl:w-[420px] xl:shrink-0", drawer === "inspector" ? "nb-drawer-right fixed inset-y-12 right-0 flex max-w-full sm:w-[420px]" : "hidden"))}
        />
      </div>
      {ws && isPhone && (
        <nav aria-label="Run sections" className="flex shrink-0 border-t border-white/10 bg-neutral-950 pb-[env(safe-area-inset-bottom)]">
          {(
            [
              ["run", "RUN", GanttChart],
              ["chat", "CHAT", MessageSquare],
              ["doc", "DOC", FileText],
              ["memory", "MEMORY", Brain],
            ] as const
          ).map(([key, label, Icon]) => (
            <button key={key} type="button" data-cuelume-select="" aria-current={phoneTab === key ? "page" : undefined} onClick={() => setPhoneTab(key)} className={cx("relative flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-extrabold tracking-wider", phoneTab === key ? "text-neutral-50" : "text-neutral-500")}>
              <Icon className="size-5" aria-hidden="true" />
              {label}
              {key === "run" && waitingN > 0 && <span className="nb-pop-slow absolute right-[calc(50%-24px)] top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-orange-400 px-1 text-[10px] font-extrabold text-neutral-950">{waitingN}</span>}
              {phoneTab === key && <span aria-hidden="true" className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-[var(--rb-accent)]" />}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

function PickWorkstream({ workstreams, onPick }: { workstreams: Workstream[]; onPick: (id: string) => void }) {
  return (
    <div className="relative isolate flex min-h-0 flex-1 flex-col items-center overflow-y-auto p-6">
      {/* the empty state's background: aurora, cell 4, low (SPEC §17.6) */}
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.1]" aria-hidden="true">
        <Aurora cell={4} intensity={0.7} glow={0.8} mask="top" className="absolute inset-0" />
      </div>
      <div className="my-auto w-full max-w-xl">
        <EmptyState visual={<div className="size-40" aria-hidden={false}><GlowCloud color="blue" background={false} label="Nimbus" /></div>} titleAs="h2" title="Pick a workstream" description="A workstream is a standing goal. Each run is a crew of Nemotron agents working on it, with you approving anything that acts." className="pb-4 pt-0" />
        <ul className="mt-2 flex flex-col gap-2">
          {workstreams.map((w) => (
            <li key={w.id}>
              <button type="button" data-cuelume-navigate="" onClick={() => onPick(w.id)} className="flex w-full flex-col items-start gap-0.5 rounded-xl border border-white/10 px-4 py-3 text-left transition-colors hover:bg-white/5">
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
