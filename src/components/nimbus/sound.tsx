"use client";

// Interaction sounds (cuelume, synthesized live with Web Audio; no audio files). The cue map is docs/SOUND.md:
// controls carry data-cuelume-* attributes that bind() picks up; outcomes of a run play from useRunCues, once
// per transition, never per streamed token or per tool call. A Sound toggle in the top bar turns all of it off.
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { bind, play, setEnabled, setTheme, setVolume, unlock, type PlayOptions, type SoundName } from "cuelume";
import type { RunView } from "@/lib/run-view";

/** "default" (glass, wood, soft mallets) sits under the Sorbet look; "press" rings a deep note on every click, too heavy for a tool clicked all day. */
export const SOUND_THEME = "default" as const;
export const SOUND_VOLUME = 0.6;
const KEY = "nimbus:sound";

let on = true;

/** Play an outcome cue. Silent while sound is off. `localStorage["nimbus:cue-log"] = "1"` logs each cue to the console (for checking the map without listening). */
export function cue(name: SoundName, o?: PlayOptions) {
  if (!on) return;
  play(name, o);
  try {
    if (window.localStorage.getItem("nimbus:cue-log") === "1") console.debug("[cue]", name, JSON.stringify(o ?? {}));
  } catch {
    /* no storage: no log */
  }
}

/** bind() once for the declarative attributes, restore the saved preference, unlock audio on the first gesture. */
export function useSound() {
  const [enabled, setOn] = useState(true);
  useEffect(() => {
    setTheme(SOUND_THEME);
    setVolume(SOUND_VOLUME);
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(KEY);
    } catch {
      /* private mode: default on */
    }
    on = saved !== "off";
    setEnabled(on);
    setOn(on);
    const unbind = bind();
    // browsers start audio only inside a gesture: the first click or key anywhere starts it
    const first = () => {
      window.removeEventListener("pointerdown", first, true);
      window.removeEventListener("keydown", first, true);
      if (on) void unlock();
    };
    window.addEventListener("pointerdown", first, true);
    window.addEventListener("keydown", first, true);
    return () => {
      unbind();
      window.removeEventListener("pointerdown", first, true);
      window.removeEventListener("keydown", first, true);
    };
  }, []);
  const toggle = () => {
    on = !on;
    setEnabled(on);
    setOn(on);
    try {
      window.localStorage.setItem(KEY, on ? "on" : "off");
    } catch {
      /* not remembered */
    }
    if (on) void unlock().then(() => cue("toggle"));
  };
  return { enabled, toggle };
}

export function SoundToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={enabled} aria-label="Sound" title={enabled ? "Sound on" : "Sound off"} onClick={onToggle} className="grid size-8 place-items-center rounded-md text-neutral-300 hover:bg-white/10">
      {enabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4 text-neutral-500" />}
    </button>
  );
}

type Snap = { plan?: number; waiting: Set<string>; failures: number; recovered: number; status: RunView["status"]; summary: boolean; memories: number };

function snap(v: RunView): Snap {
  const waiting = new Set(v.pendingApprovals.map((a) => `a:${a.approvalId}`));
  if (v.openQuestion) waiting.add(`q:${v.openQuestion.questionId}`);
  // a failed call followed by a good call of the same tool by the same agent is a retry that worked
  let recovered = 0;
  const lastOk = new Map<string, boolean | undefined>();
  for (const c of v.toolCalls) {
    const k = `${c.instance}:${c.tool}`;
    if (c.ok === true && lastOk.get(k) === false) recovered++;
    if (c.ok !== undefined) lastOk.set(k, c.ok);
  }
  const failures = v.toolCalls.filter((c) => c.ok === false).length + v.lanes.filter((l) => l.status === "error").length + Object.values(v.stepState).filter((s) => s.state === "failed").length;
  return { plan: v.planAwaiting ? v.plan?.seq : undefined, waiting, failures, recovered, status: v.status, summary: !!v.summary, memories: v.summary?.memories.length ?? 0 };
}

const SETTLE_MS = 700;
const COALESCE_MS = 1500;

/**
 * Outcome cues from the run's state. Opening a run that already happened replays its whole log at once, so for a run
 * this tab did not start the first SETTLE_MS of events only set the baseline; a run started here (`fresh`) plays from its
 * first event. Scrubbing and replay read their own view and never reach here.
 */
export function useRunCues(view: RunView, runId: string | null, fresh: MutableRefObject<string | null>) {
  const prev = useRef<{ runId: string | null; snap: Snap; armAt: number } | null>(null);
  const lastAt = useRef(new Map<SoundName, number>());
  useEffect(() => {
    // events land in 40 ms batches: three approvals asked together are one moment, not three cues
    const play1 = (name: SoundName, o?: PlayOptions) => {
      const t = Date.now();
      if (t - (lastAt.current.get(name) ?? 0) < COALESCE_MS) return;
      lastAt.current.set(name, t);
      cue(name, o);
    };
    if (view.runId && view.runId !== runId) return; // the previous run's events, one render before they reset
    const s = snap(view);
    if (prev.current?.runId !== runId) {
      const isFresh = !!runId && fresh.current === runId;
      prev.current = { runId, snap: isFresh ? snap(EMPTY) : s, armAt: isFresh ? 0 : -1 };
    }
    const cur = prev.current!;
    if (cur.armAt === -1) {
      // a run opened from elsewhere: its replay starts with the first event
      if (view.runId) cur.armAt = Date.now() + SETTLE_MS;
      cur.snap = s;
      return;
    }
    const before = cur.snap;
    cur.snap = s;
    if (Date.now() < cur.armAt) return;
    // you stopped or cancelled it (the button already said so): the lanes it cut short are not failures
    if (s.status === "stopped" || s.status === "cancelled") return;

    // one cue per change, the weightiest; the summary's count and memories follow on their own beat
    const newWaiting = [...s.waiting].some((k) => !before.waiting.has(k));
    if (s.status !== before.status && s.status === "failed") play1("error");
    else if (newWaiting) play1("attention");
    else if (s.failures > before.failures) play1("error");
    else if (s.status !== before.status && s.status === "done") play1("success");
    else if (s.recovered > before.recovered) play1("success", { volume: 0.4 });
    else if (s.plan !== undefined && s.plan !== before.plan) play1("ready", { emphasis: "subtle" });
    if (s.summary && !before.summary) {
      // the summary tiles count up for 700 ms (DitherNumber in transcript.tsx), then the memories it saved land
      setTimeout(() => play1("count", { duration: 700 }), 250);
      if (s.memories > 0) setTimeout(() => play1("ready"), 1100);
    }
  }, [view, runId, fresh]);
}

const EMPTY: RunView = { title: "", goal: "", startedAt: 0, status: "idle", active: false, lastTMs: 0, spawned: false, lanes: [], connectors: [], transcript: [], pendingApprovals: [], stepState: {}, planAwaiting: false, paused: false, artifacts: [], policies: [], toolCalls: [], usage: [], tokens: 0, costUsd: 0, baselineUsd: 0, savings: null, routedHops: 0, capHit: false };
