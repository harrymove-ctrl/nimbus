// The HTTP API the web app uses, from a terminal: JSON calls plus the run's SSE event stream.
import type { AnyRunEvent } from "../lib/events";
import type { CrewRole } from "../lib/roles";
import { baseUrl } from "./env";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown,
  ) {
    super(message);
  }
}

const headers = (json: boolean): Record<string, string> => {
  const h: Record<string, string> = {};
  if (json) h["content-type"] = "application/json";
  // the /api routes do not ask for it today; sending it costs nothing and keeps working if they start to
  if (process.env.NIMBUS_API_TOKEN) h.authorization = `Bearer ${process.env.NIMBUS_API_TOKEN}`;
  return h;
};

const unreachable = (e: unknown) => new Error(`cannot reach Nimbus at ${baseUrl()} (${e instanceof Error ? (e.cause instanceof Error ? e.cause.message : e.message) : String(e)}). Start it with \`pnpm dev\` or set NIMBUS_URL.`);

/** One JSON call. Throws ApiError with the route's own `error` text on a non-2xx answer. */
export async function api<T = Record<string, unknown>>(p: string, init: { method?: string; body?: unknown; timeoutMs?: number } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${p}`, { method: init.method ?? (init.body === undefined ? "GET" : "POST"), headers: headers(init.body !== undefined), body: init.body === undefined ? undefined : JSON.stringify(init.body), signal: AbortSignal.timeout(init.timeoutMs ?? 30_000) });
  } catch (e) {
    throw unreachable(e);
  }
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    /* an HTML error page */
  }
  if (!res.ok) {
    const b = body as { error?: string; message?: string };
    const msg = typeof body === "object" && body ? (b.message ?? b.error ?? JSON.stringify(body)) : text.slice(0, 200);
    throw new ApiError(`${res.status} ${msg}`, res.status, body);
  }
  if (typeof body !== "object" || body === null) throw new Error(`${baseUrl()}${p} answered ${res.headers.get("content-type") ?? "something"} instead of JSON: is NIMBUS_URL a Nimbus?`);
  return body as T;
}

/**
 * Follow GET /api/runs/[id]/events: the stored events, then live ones. Reconnects from the last seq when the
 * connection drops before the server says `done` (a proxy cutting a long stream). Resolves "done" when the run has
 * finished, "aborted" when the signal fired.
 */
export async function follow(runId: string, o: { since?: number; signal?: AbortSignal; onEvent: (e: AnyRunEvent) => void }): Promise<"done" | "aborted"> {
  let since = o.since ?? 0;
  let drops = 0;
  for (;;) {
    if (o.signal?.aborted) return "aborted";
    let res: Response;
    try {
      res = await fetch(`${baseUrl()}/api/runs/${encodeURIComponent(runId)}/events?since=${since}`, { headers: { ...headers(false), accept: "text/event-stream" }, signal: o.signal });
    } catch (e) {
      if (o.signal?.aborted) return "aborted";
      if (++drops > 5) throw unreachable(e);
      await new Promise((r) => setTimeout(r, 500 * drops));
      continue;
    }
    if (res.status === 404) throw new ApiError(`404 run ${runId} not found`, 404, null);
    if (!res.ok || !res.body) throw new ApiError(`${res.status} ${await res.text().catch(() => "")}`, res.status, null);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let cut: number;
        while ((cut = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, cut);
          buf = buf.slice(cut + 2);
          let event = "message";
          let data = "";
          for (const line of frame.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) data += line.slice(5).trim();
          }
          if (event === "done") {
            void reader.cancel().catch(() => {});
            return "done";
          }
          if (!data) continue; // a keep-alive comment
          const e = JSON.parse(data) as AnyRunEvent;
          if (e.seq < since) continue;
          since = e.seq + 1;
          drops = 0;
          o.onEvent(e);
        }
      }
    } catch (e) {
      if (o.signal?.aborted) return "aborted";
      if (++drops > 5) throw e;
    }
    // the stream ended without `done`: reconnect from where it stopped
    await new Promise((r) => setTimeout(r, 300));
  }
}

/** The run's events as they stand now: the replay, read until the stream goes quiet or says the run is done. */
export async function snapshot(runId: string, quietMs = 500): Promise<{ events: AnyRunEvent[]; finished: boolean }> {
  const ac = new AbortController();
  const events: AnyRunEvent[] = [];
  let timer = setTimeout(() => ac.abort(), 10_000);
  try {
    const r = await follow(runId, {
      signal: ac.signal,
      onEvent: (e) => {
        events.push(e);
        clearTimeout(timer);
        timer = setTimeout(() => ac.abort(), quietMs);
      },
    });
    return { events, finished: r === "done" };
  } finally {
    clearTimeout(timer);
  }
}

export type WorkstreamRow = { id: string; title: string; goal: string; scheduleCron?: string; scheduleLabel?: string; tools: string[]; archived?: boolean; skill?: string; roles?: CrewRole[]; files?: string[] };
export type ActiveRow = { id: string; workstreamId: string; title: string; status: string; startedAt: number; elapsedMs: number; activity: string; model: string; step: { index: number; total: number } | null; approval?: { approvalId: string; summary: string; risk: string }; question?: string; planAwaiting: boolean };
export type Budget = { todayUsd: number; dayCapUsd: number; runCapUsd: number; refusing: boolean; mock: boolean };

export const listWorkstreams = async () => (await api<{ workstreams: WorkstreamRow[] }>("/api/workstreams")).workstreams;

/** "checkout", "ws-checkout", "Checkout conversion drop" or "release watch" all find their workstream */
export async function findWorkstream(q: string): Promise<WorkstreamRow> {
  const all = await listWorkstreams();
  const n = q.trim().toLowerCase();
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const hit =
    all.find((w) => w.id === q || w.id === `ws-${n}`) ??
    all.find((w) => w.title.toLowerCase() === n || slug(w.title) === slug(n)) ??
    all.find((w) => !w.archived && (w.title.toLowerCase().includes(n) || w.id.includes(slug(n))));
  if (!hit) throw new Error(`no workstream matches "${q}". Known: ${all.filter((w) => !w.archived).map((w) => w.id.replace(/^ws-/, "")).join(", ")}`);
  return hit;
}

/** the schedule words a workstream file or a flag uses: "weekdays 08:00", "daily 7:30", "mondays 09:00" or a cron line */
export function parseSchedule(s: string | undefined): { kind: string; time: string } | { cron: string } | null {
  const v = s?.trim();
  if (!v || /^(none|off|manual|-)$/i.test(v)) return null;
  const m = /^(daily|weekdays|mondays)\s+(\d{1,2}:\d{2})$/i.exec(v);
  if (m) return { kind: m[1].toLowerCase(), time: m[2] };
  if (v.split(/\s+/).length === 5) return { cron: v };
  throw new Error(`schedule "${v}": use "daily HH:MM", "weekdays HH:MM", "mondays HH:MM" or a five-field cron line`);
}

/** POST /api/workstreams, then PATCH for a cron schedule the create form cannot express */
export async function createWorkstream(w: { title: string; goal: string; schedule?: string; scheduleLabel?: string; tools: string[]; roles?: unknown; skill?: string; files?: { name: string; content: string }[] }) {
  const sched = parseSchedule(w.schedule);
  const made = await api<{ id: string; title: string; scheduleLabel: string | null; tools: string[]; roles?: CrewRole[]; files?: string[] }>("/api/workstreams", {
    body: { title: w.title, goal: w.goal, tools: w.tools, schedule: sched && "kind" in sched ? sched : null, roles: w.roles, skill: w.skill, files: w.files?.length ? w.files : undefined },
  });
  if (sched && "cron" in sched) {
    await api(`/api/workstreams/${made.id}`, { method: "PATCH", body: { schedule: { cron: sched.cron, label: w.scheduleLabel ?? null } } });
    made.scheduleLabel = w.scheduleLabel ?? `Cron ${sched.cron}`;
  }
  return made;
}
