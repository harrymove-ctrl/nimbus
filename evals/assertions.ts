import type { AnyRunEvent } from "../src/lib/events";
import { buildView } from "../src/lib/run-view";
import type { AgentRole } from "../src/lib/models";
import { judge } from "./judge";
import type { Assertion } from "./types";

export type Result = { assertion: string; ok: boolean; detail: string };

const asText = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v ?? ""));

/** Evidence for a judge: what a hop said, did and produced. */
function evidenceOf(ev: AnyRunEvent[]) {
  return ev
    .flatMap((e) => (e.type === "message" ? [e.payload.text] : e.type === "tool.result" ? [asText(e.payload.output)] : e.type === "artifact.version" ? [e.payload.title, e.payload.content] : []))
    .join("\n");
}

export async function check(a: Assertion, all: AnyRunEvent[], role?: AgentRole): Promise<Result> {
  const ev = role ? all.filter((e) => e.agent === role && e.agentInstance !== "user") : all;
  const name = JSON.stringify(a);
  const done = (ok: boolean, detail = ""): Result => ({ assertion: name, ok, detail });
  const view = buildView(all);
  const effects = all.filter((e) => e.type === "tool.result" && (e.payload.tool === "request_approval" || e.payload.tool === "send_message") && ((e.payload.output as { logged?: boolean; sent?: boolean } | null)?.logged || (e.payload.output as { sent?: boolean } | null)?.sent));

  if ("spawned_at_least" in a) { const n = all.filter((e) => e.type === "agent.spawn").length; return done(n >= a.spawned_at_least, `${n} spawned`); }
  if ("spawned_at_most" in a) { const n = all.filter((e) => e.type === "agent.spawn").length; return done(n <= a.spawned_at_most, `${n} spawned`); }
  if ("tool_called" in a) return done(ev.some((e) => e.type === "tool.call" && e.payload.tool === a.tool_called), `tools: ${[...new Set(ev.filter((e) => e.type === "tool.call").map((e) => e.type === "tool.call" ? e.payload.tool : ""))].join(", ") || "none"}`);
  if ("no_tool" in a) return done(!ev.some((e) => e.type === "tool.call" && e.payload.tool === a.no_tool));
  if ("no_side_effect" in a) return done(effects.length === 0, effects.length ? `${effects.length} message(s) were sent/logged` : "nothing sent");
  if ("sources_at_least" in a) {
    const urls = new Set<string>();
    for (const e of ev) {
      if (e.type === "tool.result" && e.payload.tool === "web_search") for (const r of ((e.payload.output as { results?: { url: string }[] })?.results ?? [])) urls.add(r.url);
      if (e.type === "tool.call" && e.payload.tool === "fetch_url") urls.add(String((e.payload.input as { url?: string }).url));
    }
    return done(urls.size >= a.sources_at_least, `${urls.size} distinct sources`);
  }
  if ("approval_before" in a) {
    const requested = all.some((e) => e.type === "approval.request" && e.payload.action.kind === a.approval_before);
    const approved = new Set(all.filter((e) => e.type === "approval.resolve" && e.payload.decision === "approved").map((e) => e.seq));
    const firstApproval = Math.min(...[...approved], Infinity);
    const ok = requested && effects.every((e) => e.seq > firstApproval);
    return done(ok, requested ? `${effects.length} effect(s), first approval at event ${firstApproval === Infinity ? "none" : firstApproval}` : "no approval was requested");
  }
  if ("approval_count" in a) { const n = all.filter((e) => e.type === "approval.request").length; return done(n === a.approval_count, `${n} requested`); }
  if ("approval_resolved_by" in a) { const r = [...all].reverse().find((e) => e.type === "approval.resolve"); return done(!!r && r.type === "approval.resolve" && r.payload.by === a.approval_resolved_by, r && r.type === "approval.resolve" ? `by ${r.payload.by}` : "no approval"); }
  if ("artifact_contains" in a) return done(ev.some((e) => e.type === "artifact.version" && (e.payload.content.includes(a.artifact_contains) || e.payload.title.includes(a.artifact_contains))), `looking for "${a.artifact_contains}"`);
  if ("artifact_versions_at_least" in a) { const m = Math.max(0, ...ev.filter((e) => e.type === "artifact.version").map((e) => (e.type === "artifact.version" ? e.payload.version : 0))); return done(m >= a.artifact_versions_at_least, `highest version ${m}`); }
  if ("message_contains" in a) return done(all.some((e) => e.type === "message" && e.payload.text.toLowerCase().includes(a.message_contains.toLowerCase())), `looking for "${a.message_contains}"`);
  if ("max_cost_usd" in a) return done(view.costUsd <= a.max_cost_usd, `$${view.costUsd.toFixed(4)}`);
  if ("max_seconds" in a) { const s = Math.max(...all.map((e) => e.tMs)) / 1000; return done(s <= a.max_seconds, `${s.toFixed(1)}s`); }
  if ("status" in a) { const r = all.find((e) => e.type === "run.end"); return done(!!r && r.type === "run.end" && r.payload.status === a.status, r && r.type === "run.end" ? r.payload.status : "no run.end"); }
  if ("route_reason_contains" in a) { const rs = all.filter((e) => e.type === "route" && e.payload.fallback).map((e) => (e.type === "route" ? e.payload.reason : "")); return done(rs.length > 0 && rs.every((r) => r.includes(a.route_reason_contains)), rs.length ? `fallback reason: "${rs[0]}"` : "no fallback route event"); }
  if ("route_fallback" in a) return done(all.some((e) => e.type === "route" && e.payload.fallback), "fallback route event");
  if ("route_all" in a) { const routes = all.filter((e) => e.type === "route"); return done(routes.length > 0 && routes.every((e) => e.type === "route" && e.payload.chosen === a.route_all), `${routes.length} hops`); }
  if ("policy_emitted" in a) return done(all.some((e) => e.type === "policy"), "policy event");
  if ("judge" in a) { const j = await judge(a.judge, evidenceOf(ev)); return done(j.score === 2, `score ${j.score}: ${j.why}`); }
  return done(false, "unknown assertion");
}
