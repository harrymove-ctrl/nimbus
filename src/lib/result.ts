// The honest result (docs/CONVERSATION.md C5): what the crew did, what it did not, and what waits on a person.
// Built only from the run's events, never from model text, so a summary cannot claim a send that did not happen.
import type { AnyRunEvent, PlanStep } from "./events";

export type ResultItem = {
  label: string;
  /** the event this item comes from, so the UI can jump to it */
  eventId?: string;
  seq?: number;
};
export type ResultLists = { done: ResultItem[]; notDone: ResultItem[]; needsYou: ResultItem[] };

const SIDE_EFFECTS = new Set(["send_message", "open_pr"]);
/** the tools a side effect runs through: the Writer calls send_message / open_pr, the Orchestrator calls request_approval */
const SIDE_EFFECT_TOOLS = new Set(["send_message", "open_pr", "request_approval"]);
const NEEDS_PERSON: [RegExp, string][] = [
  [/needs_human/i, "needs a person"],
  [/captcha/i, "hit a CAPTCHA"],
  [/login required/i, "needs a login"],
];

const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
/** "analyst-2" → "Analyst 2"; the first instance of a role has no number */
export const whoIs = (instance: string) => {
  const m = instance.match(/^(.*?)(?:-(\d+))?$/);
  const base = (m?.[1] ?? instance).replace(/[-_]+/g, " ");
  const name = base.charAt(0).toUpperCase() + base.slice(1);
  return m?.[2] && m[2] !== "1" ? `${name} ${m[2]}` : name;
};

/** A tool call that did not work: the runtime marked it, or the tool itself reported an error. */
function failure(ok: boolean, output: unknown): string | null {
  if (isObj(output) && typeof output.error === "string") return output.error;
  if (ok) return null;
  if (typeof output === "string") return output;
  if (isObj(output)) return String(output.stderr ?? output.message ?? "failed");
  return "failed";
}

const approver = (by: string | undefined, always?: boolean) =>
  by === "policy" ? "always allowed by a saved rule" : by === "mode" ? "auto-approved (low risk)" : by === "chat" || by === "telegram" ? `approved via ${by}` : always ? "approved, always allowed from now on" : `approved by ${by && by !== "you" ? by : "you"}`;

/** where an item sorts when that differs from where it jumps to (plan steps sort just before the run's own end line) */
const order = new WeakMap<ResultItem, number>();
const ARTIFACTS_AFTER_SENDS = 1e9;

export function resultLists(events: readonly AnyRunEvent[]): ResultLists {
  const done: ResultItem[] = [];
  const notDone: ResultItem[] = [];
  const needsYou: ResultItem[] = [];
  const at = (e: AnyRunEvent) => ({ eventId: e.id, seq: e.seq });

  let ended: Extract<AnyRunEvent, { type: "run.end" }> | undefined;
  let error: Extract<AnyRunEvent, { type: "run.error" }> | undefined;
  let plan: PlanStep[] | undefined;
  let hasSteps = false;
  const stepAt = new Map<string, { state: string; e: AnyRunEvent }>();
  const answered = new Set<string>();
  const questions: Extract<AnyRunEvent, { type: "question" }>[] = [];
  const requests = new Map<string, { e: Extract<AnyRunEvent, { type: "approval.request" }> }>();
  const resolves = new Map<string, { e: Extract<AnyRunEvent, { type: "approval.resolve" }>; i: number }>();
  const artifacts = new Map<string, Extract<AnyRunEvent, { type: "artifact.version" }>>();
  const results: { e: Extract<AnyRunEvent, { type: "tool.result" }>; i: number; fail: string | null }[] = [];
  const toolOf = new Map<string, string>();

  events.forEach((e, i) => {
    switch (e.type) {
      case "run.end":
        ended = e;
        break;
      case "run.error":
        error = e;
        break;
      case "plan":
        plan = e.payload.steps ?? plan;
        break;
      case "plan.approve":
        plan = e.payload.steps;
        break;
      case "step":
        hasSteps = true;
        stepAt.set(e.payload.stepId, { state: e.payload.state, e });
        break;
      case "question":
        questions.push(e);
        break;
      case "message":
        if (e.payload.answerTo) answered.add(e.payload.answerTo);
        break;
      case "approval.request":
        requests.set(e.payload.approvalId, { e });
        break;
      case "approval.resolve":
        resolves.set(e.payload.approvalId, { e, i });
        break;
      case "artifact.version":
        artifacts.set(e.payload.artifactId, e); // the newest version of each artifact
        break;
      case "tool.call":
        toolOf.set(e.payload.callId, e.payload.tool);
        break;
      case "tool.result":
        results.push({ e, i, fail: failure(e.payload.ok, e.payload.output) });
        break;
    }
  });
  const finished = !!ended;
  const consumed = new Set<string>(); // tool.result callIds already reported through their approval

  // Approvals: a side effect that happened, a rejection, a failed send, a draft still waiting.
  // They point at the approval card (a transcript row), not at the tool result, which has none.
  for (const [id, { e: req }] of requests) {
    const a = req.payload.action;
    const res = resolves.get(id);
    const what = clip(a.summary, 80);
    if (!res) {
      needsYou.push({ label: finished ? `Draft not sent: ${what}` : `Waiting for your OK: ${what}`, ...at(req) });
      continue;
    }
    const r = res.e.payload;
    if (r.decision === "rejected") {
      if (r.by === "system") needsYou.push({ label: `Draft not sent: ${what}`, ...at(req) });
      else notDone.push({ label: `Rejected: ${what}${r.note ? ` (“${clip(r.note, 80)}”)` : ""}`, ...at(req) });
      continue;
    }
    if (!SIDE_EFFECTS.has(a.kind)) continue;
    const out = results.find((x) => x.i > res.i && x.e.agentInstance === res.e.agentInstance && SIDE_EFFECT_TOOLS.has(x.e.payload.tool));
    const d = isObj(a.details) ? a.details : {};
    const target = a.kind === "send_message" ? String(d.channel ?? d.to ?? d.recipient ?? "") : String(d.title ?? d.branch ?? "");
    if (!out) {
      if (finished) notDone.push({ label: `Approved but no result was recorded: ${what}`, ...at(req) });
      continue; // still in flight otherwise
    }
    consumed.add(out.e.payload.callId);
    const o = isObj(out.e.payload.output) ? out.e.payload.output : {};
    const who = approver(r.by, r.always);
    if (out.fail) {
      notDone.push({ label: `${a.kind === "send_message" ? "Send" : "PR"} failed after approval: ${what} (${clip(out.fail, 80)})`, ...at(req) });
    } else if (a.kind === "send_message") {
      const real = o.sent === true;
      done.push({ label: `${real ? "Sent to" : "Message to"} ${target || "a channel"}${real ? "" : ", logged and not delivered (demo mode)"}, ${who}`, ...at(req) });
    } else {
      const opened = o.opened === true;
      done.push({ label: `${opened ? "Opened PR" : "PR logged, not opened (demo mode)"}: ${clip(target || what, 70)}, ${who}`, ...at(req) });
    }
  }

  // Artifacts the crew wrote
  for (const e of artifacts.values()) {
    const item: ResultItem = { label: `Wrote “${clip(e.payload.title, 60)}” v${e.payload.version}`, ...at(e) };
    order.set(item, ARTIFACTS_AFTER_SENDS + e.seq); // what went out comes first, then what was written
    done.push(item);
  }

  // run_code: one count line
  const code = results.filter((x) => x.e.payload.tool === "run_code");
  if (code.length) {
    const ok = code.filter((x) => !x.fail).length;
    const where = code.map((x) => (isObj(x.e.payload.output) ? x.e.payload.output.where : undefined));
    const sandbox = where.filter((w) => w === "nebius-sandbox").length;
    const known = where.filter((w) => w === "nebius-sandbox" || w === "local").length;
    const place = known === 0 ? "" : sandbox === code.length ? " in Nebius Sandbox" : ` (${sandbox} in Nebius Sandbox, ${known - sandbox} locally)`;
    const line: ResultItem = { label: `${code.length} script${code.length > 1 ? "s" : ""} ran${place}, ${ok} succeeded`, ...at(code[code.length - 1].e) };
    order.set(line, Number.MAX_SAFE_INTEGER); // the count is a footnote to the real outputs
    done.push(line);
  }

  // Failed tool calls the crew did not recover from: a later success of the same tool by the same agent recovers them
  const groups = new Map<string, { n: number; last: (typeof results)[number] }>();
  for (const x of results) {
    if (!x.fail || consumed.has(x.e.payload.callId)) continue;
    const key = `${x.e.agentInstance}:${x.e.payload.tool}`;
    const recovered = results.some((y) => y.i > x.i && !y.fail && y.e.agentInstance === x.e.agentInstance && y.e.payload.tool === x.e.payload.tool);
    if (recovered) continue;
    groups.set(key, { n: (groups.get(key)?.n ?? 0) + 1, last: x });
  }
  for (const { n, last } of groups.values()) {
    notDone.push({ label: `${whoIs(last.e.agentInstance)}: ${last.e.payload.tool} failed${n > 1 ? ` ${n} times` : ""}: ${clip(last.fail ?? "", 70)}`, ...at(last.e) });
  }

  // Plan steps that did not finish (only when the run reported steps; a run without step events cannot say)
  if (finished && hasSteps && plan) {
    plan.forEach((s, i) => {
      const st = stepAt.get(s.id);
      if (st?.state === "done") return;
      const item: ResultItem = { label: `${st?.state === "failed" ? "Step failed" : "Step not reached"}: ${clip(s.text, 80)}`, ...(st ? at(st.e) : {}) };
      order.set(item, (ended?.seq ?? 0) - 0.5 + i / 1000);
      notDone.push(item);
    });
  }

  // A run that stopped, was cancelled or failed
  if (ended && ended.payload.status !== "done") {
    const s = ended.payload.status;
    const why = error?.payload.kind === "spend_cap" && error.payload.spentUsd !== undefined && error.payload.capUsd !== undefined ? `hit the spend cap ($${error.payload.spentUsd.toFixed(2)} of $${error.payload.capUsd.toFixed(2)})` : error ? clip(error.payload.message, 90) : s === "cancelled" ? "cancelled by you" : s === "stopped" ? "stopped before it finished" : "failed";
    const item: ResultItem = { label: `Run ${s === "failed" ? "failed" : s === "cancelled" ? "cancelled" : "stopped"}: ${why}`, ...at(error ?? ended) };
    order.set(item, ended.seq + 1);
    notDone.push(item);
  } else if (error && !ended) {
    notDone.push({ label: `Run stopped: ${clip(error.payload.message, 90)}`, ...at(error) });
  }

  // Needs you: questions nobody answered, a login or a CAPTCHA the crew cannot do
  for (const q of questions) if (!answered.has(q.payload.questionId)) needsYou.push({ label: `Answer: ${clip(q.payload.text, 90)}`, ...at(q) });
  for (const x of results) {
    const text = typeof x.e.payload.output === "string" ? x.e.payload.output : JSON.stringify(x.e.payload.output ?? "");
    const hit = NEEDS_PERSON.find(([re]) => re.test(text));
    if (!hit) continue;
    const url = isObj(x.e.payload.output) && typeof x.e.payload.output.url === "string" ? x.e.payload.output.url : "";
    const host = url.match(/^https?:\/\/([^/]+)/)?.[1];
    needsYou.push({ label: `${whoIs(x.e.agentInstance)}: ${x.e.payload.tool}${host ? ` on ${host}` : ""} ${hit[1]}`, ...at(x.e) });
  }

  const key = (i: ResultItem) => order.get(i) ?? i.seq ?? 0;
  const bySeq = (a: ResultItem, b: ResultItem) => key(a) - key(b);
  return { done: done.sort(bySeq), notDone: notDone.sort(bySeq), needsYou: needsYou.sort(bySeq) };
}

export const resultEmpty = (r: ResultLists) => !r.done.length && !r.notDone.length && !r.needsYou.length;

/**
 * The lists in phone form: at most `perList` items each, then "and N more". Fits `maxChars` by showing fewer items and
 * shorter labels before cutting anything; an empty list is left out.
 */
export function phoneLists(r: ResultLists, maxChars: number, perList = 3): string {
  const heads: [string, ResultItem[]][] = [["Done", r.done], ["Not done", r.notDone], ["Needs you", r.needsYou]];
  const draw = (per: number, width: number) =>
    heads
      .filter(([, items]) => items.length)
      .map(([h, items]) => {
        const shown = items.slice(0, per);
        const rest = items.length - shown.length;
        return [`${h} (${items.length})`, ...shown.map((i) => `• ${clip(i.label, width)}`), ...(rest ? [`• and ${rest} more`] : [])].join("\n");
      })
      .join("\n");
  for (const [per, width] of [[perList, 90], [perList, 60], [2, 60], [1, 50], [1, 36]] as const) {
    const text = draw(per, width);
    if (text.length <= maxChars) return text;
  }
  return draw(1, 36).slice(0, Math.max(0, maxChars - 1)).replace(/\s+\S*$/, "") + (maxChars > 0 ? "…" : "");
}
