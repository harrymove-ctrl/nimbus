// The honest result (docs/CONVERSATION.md C5) in mock mode ($0): done, not done and needs you, derived from events only.
// Recorded runs (the Checkout demo and every seed run), synthetic runs for each case the lists must get right, and the
// phone end text staying inside 900 characters.
//   pnpm check:result
process.env.NIMBUS_MODEL = "mock";
import { readFileSync, readdirSync } from "node:fs";
import { deepStrictEqual } from "node:assert";
import path from "node:path";
import type { AnyRunEvent, PayloadMap, RunEventType } from "../src/lib/events";
import { phoneLists, resultLists, type ResultLists } from "../src/lib/result";
import { buildView } from "../src/lib/run-view";
import { PHONE_MAX, phoneResultText } from "../src/runtime/chat-util";
import { endText } from "../src/runtime/notify";

const checks: [string, boolean][] = [];
const check = (n: string, ok: boolean, detail = "") => (checks.push([n, ok]), console.log(`${ok ? "✓" : "✗"} ${n}${!ok && detail ? `\n    ${detail.slice(0, 1500).replace(/\n/g, "\n    ")}` : ""}`));
const labels = (r: ResultLists) => ({ done: r.done.map((i) => i.label), notDone: r.notDone.map((i) => i.label), needsYou: r.needsYou.map((i) => i.label) });
function exact(name: string, events: AnyRunEvent[], want: ResultLists) {
  const got = labels(resultLists(events));
  try {
    deepStrictEqual(got, want);
    check(name, true);
  } catch {
    check(name, false, `got  ${JSON.stringify(got, null, 1)}\nwant ${JSON.stringify(want, null, 1)}`);
  }
}
const none = { done: [], notDone: [], needsYou: [] } satisfies ResultLists;

/** Recorded events (fixtures carry no run id or seq): number them the way the replay does. */
const load = (file: string): AnyRunEvent[] => {
  const j = JSON.parse(readFileSync(file, "utf8")) as unknown;
  const list = (Array.isArray(j) ? j : (j as { events: unknown[] }).events) as Record<string, unknown>[];
  return list.map((e, seq) => ({ runId: "r", seq, ...e })) as AnyRunEvent[];
};

/** A small event builder for the synthetic runs. */
function run() {
  const events: AnyRunEvent[] = [];
  let call = 0;
  const add = <T extends RunEventType>(type: T, payload: PayloadMap[T], instance = "orchestrator") => {
    const seq = events.length;
    events.push({ id: `s${seq}`, runId: "syn", seq, tMs: seq * 100, agent: instance.replace(/-\d+$/, ""), agentInstance: instance, type, payload } as AnyRunEvent);
  };
  const tool = (instance: string, name: string, ok: boolean, output: unknown, input: unknown = {}) => {
    const callId = `c${++call}`;
    add("tool.call", { callId, tool: name, input }, instance);
    add("tool.result", { callId, tool: name, ok, output }, instance);
  };
  add("run.start", { title: "Syn", workstreamId: "ws", goal: "g", startedAt: 0, trigger: "manual" });
  return { events, add, tool };
}
const ask = (r: ReturnType<typeof run>, id: string, kind: "send_message" | "open_pr", summary: string, details: unknown, instance = "writer-1") =>
  r.add("approval.request", { approvalId: id, action: { kind, summary, risk: "medium", details } }, instance);

/* ------------------------------------------------------------------ recorded runs */

const demo = load("fixtures/demo-run.events.json");
exact("Checkout demo run: one failed then recovered script, the draft waits, the question is open", demo, {
  done: ["Wrote “funnel.py” v1", "Wrote “Checkout conversion fell 6.1 pts on Oct 14 — it was iOS Saf…” v2", "2 scripts ran, 1 succeeded"],
  notDone: [],
  needsYou: ["Answer: Compare against Oct 7 or the 30-day average?", "Draft not sent: Send summary to #growth"],
});

// the exit test: the Checkout run with one rejected approval shows it under Not done with the note
{
  const at = demo.findIndex((e) => e.type === "approval.request");
  const req = demo[at] as Extract<AnyRunEvent, { type: "approval.request" }>;
  const rejected = [...demo.slice(0, at + 1), { id: "rej", runId: "r", seq: 0, tMs: req.tMs + 1, agent: "orchestrator", agentInstance: "orchestrator", type: "approval.resolve", payload: { approvalId: req.payload.approvalId, decision: "rejected", by: "you", note: "the number is wrong" } } as AnyRunEvent, ...demo.slice(at + 1)].map((e, seq) => ({ ...e, seq }) as AnyRunEvent);
  const r = labels(resultLists(rejected));
  check("Checkout run with a rejected approval: it is under Not done with the note", r.notDone.includes("Rejected: Send summary to #growth (“the number is wrong”)") && !r.needsYou.some((l) => l.startsWith("Draft not sent")) && !r.done.some((l) => /^(Sent to|Message to)/.test(l)), JSON.stringify(r, null, 1));
}

const radar = load("fixtures/seed-runs/radar.json");
exact("radar seed run: the rule-approved send is logged in demo mode, the digest is written, nothing is open", radar, {
  done: ["Message to #team, logged and not delivered (demo mode), always allowed by a saved rule", "Wrote “Hackathon radar · Tue Oct 27” v1"],
  notDone: [],
  needsYou: [],
});

for (const f of readdirSync("fixtures/seed-runs").filter((n) => n.endsWith(".json"))) {
  const ev = load(path.join("fixtures/seed-runs", f));
  const r = resultLists(ev);
  const sends = r.done.filter((i) => /^(Sent to|Message to|Opened PR|PR logged)/.test(i.label)).length;
  const approved = ev.filter((e) => e.type === "approval.resolve" && e.payload.decision === "approved").length;
  check(`seed run ${f}: no Done send without an approval behind it (${sends} sends, ${approved} approvals)`, sends <= approved);
  check(`seed run ${f}: buildView carries the same lists`, JSON.stringify(buildView(ev).result) === JSON.stringify(r));
}
check("the demo run's view carries the same lists", JSON.stringify(buildView(demo).result) === JSON.stringify(resultLists(demo)));

/* ------------------------------------------------------------------ synthetic runs */

{
  const r = run();
  ask(r, "ap1", "send_message", "Send message to #growth", { channel: "#growth", text: "hi" });
  r.add("approval.resolve", { approvalId: "ap1", decision: "rejected", by: "you", note: "Not before legal reads it" }, "writer-1");
  r.tool("writer-1", "send_message", true, { sent: false, note: "Not before legal reads it" });
  r.add("run.end", { status: "done" });
  exact("a rejected approval with a note: Not done, with the note, and nothing is claimed as sent", r.events, { done: [], notDone: ["Rejected: Send message to #growth (“Not before legal reads it”)"], needsYou: [] });
}
{
  const r = run();
  ask(r, "ap1", "send_message", "Send message to #growth", { channel: "#growth", text: "hi" });
  r.add("approval.resolve", { approvalId: "ap1", decision: "approved", by: "you" }, "writer-1");
  r.tool("writer-1", "send_message", true, { sent: true });
  ask(r, "ap2", "open_pr", "Open PR chore/bump → main", { branch: "chore/bump", title: "Bump the SDK", body: "b", patchArtifactId: "p" });
  r.add("approval.resolve", { approvalId: "ap2", decision: "approved", by: "telegram" }, "writer-1");
  r.tool("writer-1", "open_pr", true, { opened: true, url: "https://github.com/x/y/pull/9" });
  ask(r, "ap3", "send_message", "Send message to #ops", { channel: "#ops", text: "hi" });
  r.add("approval.resolve", { approvalId: "ap3", decision: "approved", by: "policy" }, "writer-1");
  r.tool("writer-1", "send_message", true, { sent: true });
  r.add("run.end", { status: "done" });
  exact("approved sends and a PR that ran: Done, with who approved (you, telegram, a saved rule)", r.events, {
    done: ["Sent to #growth, approved by you", "Opened PR: Bump the SDK, approved via telegram", "Sent to #ops, always allowed by a saved rule"],
    notDone: [],
    needsYou: [],
  });
}
{
  const r = run();
  ask(r, "ap1", "send_message", "Send message to #growth", { channel: "#growth", text: "hi" });
  r.add("approval.resolve", { approvalId: "ap1", decision: "approved", by: "you" }, "writer-1");
  r.tool("writer-1", "send_message", false, { error: "channel not found" });
  r.add("run.end", { status: "done" });
  exact("an approved send whose tool failed is Not done, never Done", r.events, { done: [], notDone: ["Send failed after approval: Send message to #growth (channel not found)"], needsYou: [] });
}
{
  const r = run();
  r.tool("analyst-1", "run_code", false, { ok: false, exitCode: 1, where: "nebius-sandbox", stderr: "KeyError: 'device'" });
  r.tool("analyst-1", "run_code", true, { ok: true, exitCode: 0, where: "nebius-sandbox", stdout: "ok" });
  r.tool("researcher-1", "fetch_url", false, "HTTP 404");
  r.tool("researcher-1", "fetch_url", true, { text: "found" });
  r.add("run.end", { status: "done" });
  exact("a failure the crew recovered from (a later success, same agent and tool) is not listed; the count line says 2 ran, 1 succeeded", r.events, { done: ["2 scripts ran in Nebius Sandbox, 1 succeeded"], notDone: [], needsYou: [] });
}
{
  const r = run();
  r.tool("analyst-1", "run_code", false, { ok: false, exitCode: 1, where: "local", stderr: "boom" });
  r.tool("researcher-1", "fetch_url", false, "HTTP 404");
  r.tool("researcher-2", "fetch_url", true, { text: "another agent's success does not recover it" });
  r.add("run.end", { status: "done" });
  exact("an unrecovered failure is Not done (a success by another agent does not recover it)", r.events, {
    done: ["1 script ran (0 in Nebius Sandbox, 1 locally), 0 succeeded"],
    notDone: ["Analyst: run_code failed: boom", "Researcher: fetch_url failed: HTTP 404"],
    needsYou: [],
  });
}
{
  const r = run();
  r.add("plan", { agents: [], tools: [], estimate: { costUsd: 0, tokens: 0, label: "" }, steps: [{ id: "s1", text: "Pull the data", role: "analyst", tier: "super" }, { id: "s2", text: "Write the digest", role: "writer", tier: "nano" }, { id: "s3", text: "Send it to #team", role: "writer", tier: "nano" }] });
  r.add("step", { stepId: "s1", state: "running" });
  r.add("step", { stepId: "s1", state: "done" });
  r.add("step", { stepId: "s2", state: "running" });
  r.add("run.error", { message: "Stopped at the spend cap", kind: "spend_cap", spentUsd: 0.52, capUsd: 0.5 });
  r.add("run.end", { status: "stopped" });
  exact("a run capped by spend: the unfinished steps and the cap, with the reason", r.events, {
    done: [],
    notDone: ["Step not reached: Write the digest", "Step not reached: Send it to #team", "Run stopped: hit the spend cap ($0.52 of $0.50)"],
    needsYou: [],
  });
}
{
  const r = run();
  r.add("run.end", { status: "cancelled" });
  exact("a cancelled run says so", r.events, { done: [], notDone: ["Run cancelled: cancelled by you"], needsYou: [] });
}
{
  const r = run();
  r.add("question", { questionId: "q1", text: "Compare against Oct 7 or the 30-day average?", options: ["Oct 7", "30-day"] }, "analyst-1");
  r.add("question", { questionId: "q2", text: "Which channel?" }, "writer-1");
  r.add("message", { id: "u1", role: "user", text: "Oct 7", answerTo: "q1" });
  exact("an open question is Needs you; an answered one is not", r.events, { done: [], notDone: [], needsYou: ["Answer: Which channel?"] });
}
{
  const r = run();
  ask(r, "ap1", "send_message", "Send message to #growth", { channel: "#growth", text: "hi" });
  exact("an approval waiting on a live run is Needs you", r.events, { done: [], notDone: [], needsYou: ["Waiting for your OK: Send message to #growth"] });
  r.add("run.end", { status: "done" });
  exact("a draft whose approval was never answered before the run ended is an unsent draft", r.events, { done: [], notDone: [], needsYou: ["Draft not sent: Send message to #growth"] });
}
{
  const r = run();
  ask(r, "ap1", "send_message", "Send message to #growth", { channel: "#growth", text: "hi" });
  r.add("approval.resolve", { approvalId: "ap1", decision: "rejected", by: "system", note: "Run stopped" }, "writer-1");
  r.add("run.end", { status: "stopped" });
  exact("stopping a run with a draft waiting leaves the draft under Needs you, not as a rejection", r.events, { done: [], notDone: ["Run stopped: stopped before it finished"], needsYou: ["Draft not sent: Send message to #growth"] });
}
{
  const r = run();
  r.tool("researcher-1", "fetch_url", true, { url: "https://shop.example.com/cart", text: "Please solve the CAPTCHA to continue" });
  r.tool("researcher-1", "web_search", true, { results: [], status: "needs_human" });
  r.tool("researcher-2", "fetch_url", true, { text: "Login required to view this page" });
  r.add("run.end", { status: "done" });
  exact("a CAPTCHA, a login and a needs_human result are Needs you", r.events, {
    done: [],
    notDone: [],
    needsYou: ["Researcher: fetch_url on shop.example.com hit a CAPTCHA", "Researcher: web_search needs a person", "Researcher 2: fetch_url needs a login"],
  });
}
{
  const r = run();
  r.add("run.end", { status: "done" });
  exact("a run with nothing to report has three empty lists", r.events, none);
  check("an empty result draws no lines on a phone", phoneLists(none, 900) === "");
}
{
  const r = run();
  r.add("artifact.version", { artifactId: "d", kind: "doc", title: "Digest", version: 1, content: "x" }, "writer-1");
  r.add("artifact.version", { artifactId: "d", kind: "doc", title: "Digest", version: 2, content: "y" }, "writer-1");
  exact("an artifact written twice is one line at its newest version", r.events, { done: ["Wrote “Digest” v2"], notDone: [], needsYou: [] });
  const items = resultLists(r.events).done;
  check("each item carries the event it came from (id and seq) so the card can jump to it", items.every((i) => i.eventId === "s2" && i.seq === 2), JSON.stringify(items));
}

/* ------------------------------------------------------------------ the phone text */

{
  const r = run();
  for (let i = 1; i <= 7; i++) {
    ask(r, `a${i}`, "send_message", `Send message to #channel-${i}`, { channel: `#channel-${i}`, text: "x" });
    r.add("approval.resolve", { approvalId: `a${i}`, decision: "approved", by: "you" }, "writer-1");
    r.tool("writer-1", "send_message", true, { sent: true });
  }
  for (let i = 1; i <= 6; i++) r.tool(`researcher-${i}`, "fetch_url", false, `HTTP 50${i}: ${"the upstream server answered with a very long explanation of why it is down ".repeat(3)}`);
  for (let i = 1; i <= 5; i++) r.add("question", { questionId: `q${i}`, text: `Question number ${i}: ${"which of the many options should the crew use for this one? ".repeat(3)}` }, "analyst-1");
  r.add("artifact.version", { artifactId: "d", kind: "doc", title: "Long digest", version: 1, content: Array.from({ length: 12 }, (_, i) => `Line ${i + 1} of the digest ${"with plenty of words ".repeat(6)}`).join("\n") }, "writer-1");
  r.add("run.end", { status: "done" });
  const link = "https://nimbus.example.com/?run=syn-123456789012345678901234567890";
  const text = endText("Morning brief · Tue Oct 27", r.events, "done", link);
  check(`Telegram end text with long lists is ${text.length} characters (under ${PHONE_MAX + 1})`, text.length <= PHONE_MAX, text);
  check("the end text leads with Done, Not done and Needs you, then the link last", text.indexOf("Done (") < text.indexOf("Not done (") && text.indexOf("Not done (") < text.indexOf("Needs you (") && text.endsWith(link), text);
  check("at most three items per list, then 'and N more'", /Done \(8\)(\n• [^\n]+){3}\n• and 5 more/.test(text) && /Not done \(6\)(\n• [^\n]+){3}\n• and 3 more/.test(text), text);
  check("the lists come before the document lines", text.indexOf("Needs you (") < text.indexOf("Line 1") || !text.includes("Line 1"), text);
  const stopped = endText("Morning brief", r.events, "stopped", link);
  check("a stopped run's end text carries the lists too, inside the budget", stopped.length <= PHONE_MAX && stopped.includes("Not done ("), stopped);
  for (const max of [900, 600, 400, 250, 120, 40, 0]) {
    const t = phoneLists(resultLists(r.events), max);
    check(`phoneLists fits ${max} characters (${t.length})`, t.length <= max);
  }
  check("phoneResultText never goes negative", phoneResultText(r.events, -50) === "");
}

const failed = checks.filter(([, ok]) => !ok).length;
console.log(`\n${failed ? "FAIL" : "PASS"}: ${checks.length - failed}/${checks.length} checks`);
process.exit(failed ? 1 : 0);
