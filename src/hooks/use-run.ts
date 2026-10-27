"use client";

import { useEffect, useRef, useState } from "react";
import type { AnyRunEvent } from "@/lib/events";

/** Streams a run's events over SSE, resuming from the last seq on reconnect. */
export function useRunEvents(runId: string | null) {
  const [events, setEvents] = useState<AnyRunEvent[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setEvents([]);
    setDone(false);
    if (!runId) return;
    const buffer: AnyRunEvent[] = [];
    let count = 0;
    let es: EventSource | null = null;
    let finished = false;
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;

    // Batch bursts (a refresh replays the whole log) into one render. A timeout, not rAF:
    // rAF stops in background tabs and events would pile up unseen.
    const flush = () => {
      flushTimer = undefined;
      // Drain outside the updater: React may call updater functions twice in dev.
      const batch = buffer.splice(0);
      if (batch.length) setEvents((prev) => prev.concat(batch));
    };
    const open = () => {
      es = new EventSource(`/api/runs/${runId}/events?since=${count}`);
      es.onmessage = (m) => {
        const e = JSON.parse(m.data) as AnyRunEvent;
        if (e.seq !== count) return; // already have it (reconnect overlap)
        count++;
        buffer.push(e);
        flushTimer ??= setTimeout(flush, 40);
      };
      es.addEventListener("done", () => {
        finished = true;
        es?.close();
        flush();
        setDone(true);
      });
      es.onerror = () => {
        es?.close();
        if (!finished) retry = setTimeout(open, 800);
      };
    };
    open();
    return () => {
      finished = true;
      es?.close();
      clearTimeout(retry);
      clearTimeout(flushTimer);
    };
  }, [runId]);

  return { events, done };
}

/** Wall clock that ticks while `active` (drives the playhead, elapsed time and the cancel countdown). */
export function useNow(active: boolean, intervalMs = 100) {
  const [now, setNow] = useState(() => Date.now());
  const activeRef = useRef(active);
  activeRef.current = active;
  useEffect(() => {
    setNow(Date.now());
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [active, intervalMs]);
  return now;
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(q.matches);
    const f = () => setReduced(q.matches);
    q.addEventListener("change", f);
    return () => q.removeEventListener("change", f);
  }, []);
  return reduced;
}
