// `nimbus mcp`: a stdio MCP server over the same HTTP API, so Claude Code, Cursor, OpenClaw or Hermes can start a
// run, wait for its approval, decide it and read the artifact. Every tool answers with a short text block (phone
// length, numbers first) and the structured JSON as a second text item. stdout is the protocol: log to stderr only.
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { buildView, fmtCost, type RunView } from "../lib/run-view";
import { ApiError, api, createWorkstream, findWorkstream, follow, listWorkstreams, snapshot } from "./api";
import { baseUrl, runLink } from "./env";
import { mainArtifact, runJson, runLine, short, waitingOn } from "./format";

type Reply = { content: { type: "text"; text: string }[]; isError?: boolean };
const reply = (text: string, data: unknown): Reply => ({ content: [{ type: "text", text }, { type: "text", text: JSON.stringify(data, null, 2) }] });
const fail = (e: unknown): Reply => ({ content: [{ type: "text", text: `error: ${e instanceof Error ? e.message : String(e)}` }], isError: true });
const tool =
  <A>(fn: (a: A) => Promise<Reply>) =>
  async (a: A) => {
    try {
      return await fn(a);
    } catch (e) {
      return fail(e);
    }
  };

const viewOf = async (runId: string) => buildView((await snapshot(runId)).events);

/** what to do next, in the words a coding agent can act on */
function next(runId: string, v: RunView): string {
  const w = waitingOn(v);
  if (!w) return v.active ? `next: wait_for_run("${runId}", until: "end")` : "next: read_artifact";
  if (w.kind === "plan") return `next: approve("${runId}", "plan", "approve") starts the crew`;
  if (w.kind === "approval") return `next: approve("${runId}", "${w.id}", "approve" | "approve_always" | "reject", note?)`;
  return `next: answer("${runId}", "${w.id}", text)${w.options.length ? `; options: ${w.options.map((o, i) => `${i + 1}) ${o}`).join(", ")}` : ""}`;
}

/**
 * Follow the run until it reaches `until` or needs the person (a waiting plan, approval or question blocks every
 * later state, so waiting past it would only time out), the run ends, or the timeout passes. The state is judged
 * once the stream has been quiet for a moment, so a replayed history or a policy's instant approval does not count.
 */
async function waitFor(runId: string, until: "approval" | "question" | "end", timeoutS: number) {
  const events: Parameters<Parameters<typeof follow>[1]["onEvent"]>[0][] = [];
  const ac = new AbortController();
  const t0 = Date.now();
  let reason = "timeout" as "reached" | "needs_you" | "ended" | "timeout";
  let settle: ReturnType<typeof setTimeout> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  await new Promise<void>((resolve) => {
    const judge = () => {
      const v = buildView(events);
      const w = waitingOn(v);
      const hit = until === "end" ? !v.active : until === "approval" ? w?.kind === "approval" || w?.kind === "plan" : w?.kind === "question";
      if (hit) reason = "reached";
      else if (!v.active) reason = "ended";
      else if (w) reason = "needs_you";
      else return;
      resolve();
    };
    timer = setTimeout(resolve, timeoutS * 1000);
    follow(runId, {
      signal: ac.signal,
      onEvent: (e) => {
        events.push(e);
        clearTimeout(settle);
        settle = setTimeout(judge, 300);
      },
    }).then(
      () => (clearTimeout(settle), judge(), resolve()),
      () => resolve(),
    );
  });
  clearTimeout(settle);
  clearTimeout(timer);
  ac.abort();
  return { v: buildView(events), reason, waitedS: Math.round((Date.now() - t0) / 100) / 10 };
}

export async function serve() {
  const server = new McpServer({ name: "nimbus", version: "0.1.0" }, { instructions: "Nimbus runs a crew of NVIDIA Nemotron agents on a standing workstream. start_run, then wait_for_run: it returns when the run needs you (a plan, an approval or a question) or ends. Decide with approve or answer, then wait_for_run again until the end, then read_artifact. Never approve a side effect the user did not ask for." });

  server.registerTool(
    "list_workstreams",
    { title: "List workstreams", description: "The standing workstreams this Nimbus runs: id, title, goal, schedule and tools.", inputSchema: {} },
    tool(async () => {
      const all = (await listWorkstreams()).filter((w) => !w.archived);
      const data = all.map((w) => ({ id: w.id, title: w.title, goal: w.goal, schedule: w.scheduleLabel ?? null, tools: w.tools }));
      return reply(`${all.length} workstreams\n${all.map((w) => `• ${w.id.replace(/^ws-/, "")}: ${w.title}${w.scheduleLabel ? ` (${w.scheduleLabel})` : ""}`).join("\n")}`, data);
    }),
  );

  server.registerTool(
    "start_run",
    {
      title: "Start a run",
      description: "Start a run of a workstream (id like ws-release, or a name like 'release watch'). goal overrides the standing goal. review: true makes the crew wait for approve(run_id, 'plan'); by default the plan starts by itself after a 3 s window.",
      inputSchema: { workstream: z.string().describe("workstream id or name"), goal: z.string().optional(), review: z.boolean().optional() },
    },
    tool(async ({ workstream, goal, review }: { workstream: string; goal?: string; review?: boolean }) => {
      const ws = await findWorkstream(workstream);
      let runId: string;
      try {
        ({ runId } = await api<{ runId: string }>("/api/runs", { body: { workstreamId: ws.id, goal, review: review === true } }));
      } catch (e) {
        if (e instanceof ApiError && e.status === 429) throw new Error(`day cap reached: ${(e.body as { message?: string })?.message ?? e.message}`);
        throw e;
      }
      return reply(`started ${runId} · ${ws.title}\n${runLink(runId)}\nnext: wait_for_run("${runId}", until: "approval")`, { run_id: runId, workstream_id: ws.id, title: ws.title, goal: goal ?? ws.goal, url: runLink(runId) });
    }),
  );

  server.registerTool(
    "run_status",
    { title: "Run status", description: "Where a run stands now: status, spend, what it waits for, its agents and its artifact.", inputSchema: { run_id: z.string() } },
    tool(async ({ run_id }: { run_id: string }) => {
      const v = await viewOf(run_id);
      return reply(`${runLine(run_id, v)}\n${next(run_id, v)}`, runJson(run_id, v));
    }),
  );

  server.registerTool(
    "wait_for_run",
    {
      title: "Wait for a run",
      description: "Block until the run reaches `until` (approval: a plan or action waits for a decision; question: the crew asks; end: the run finished). Returns earlier when the run needs you for something else or ends, and at timeout_s (default 120, at most 600).",
      inputSchema: { run_id: z.string(), until: z.enum(["approval", "question", "end"]), timeout_s: z.number().min(1).max(600).optional() },
    },
    tool(async ({ run_id, until, timeout_s }: { run_id: string; until: "approval" | "question" | "end"; timeout_s?: number }) => {
      const { v, reason, waitedS } = await waitFor(run_id, until, timeout_s ?? 120);
      const head = reason === "reached" ? `reached ${until}` : reason === "needs_you" ? `stopped before ${until}: the run needs you` : reason === "ended" ? "the run ended" : `still going after ${waitedS}s`;
      return reply(`${head} · ${runLine(run_id, v)}\n${next(run_id, v)}`, { reason, waited_s: waitedS, ...runJson(run_id, v) });
    }),
  );

  server.registerTool(
    "approve",
    {
      title: "Decide an approval",
      description: "Decide what the run waits for: approval_id from wait_for_run or run_status (ap-1), or 'plan' for the draft plan. approve_always also writes a policy so the same action is approved from now on. reject needs a note the crew reads.",
      inputSchema: { run_id: z.string(), approval_id: z.string(), decision: z.enum(["approve", "approve_always", "reject"]), note: z.string().optional() },
    },
    tool(async ({ run_id, approval_id, decision, note }: { run_id: string; approval_id: string; decision: "approve" | "approve_always" | "reject"; note?: string }) => {
      if (approval_id === "plan") {
        if (decision === "reject") await api(`/api/runs/${run_id}/stop`, { body: { reason: "cancel" } });
        else await api(`/api/runs/${run_id}/plan`, { body: { approve: true } });
        return reply(`${decision === "reject" ? "plan rejected, run cancelled" : "plan approved, the crew starts"} · ${run_id}\nnext: ${decision === "reject" ? "nothing" : `wait_for_run("${run_id}", until: "approval")`}`, { run_id, approval_id, decision });
      }
      const v = await viewOf(run_id);
      const ap = v.pendingApprovals.find((a) => a.approvalId === approval_id);
      await api(`/api/runs/${run_id}/approvals/${approval_id}`, { body: { decision, note } });
      const what = ap ? short(ap.action.summary, 80) : approval_id;
      return reply(`${decision === "reject" ? "rejected" : decision === "approve_always" ? "approved always" : "approved"} ${approval_id}: ${what}\nnext: wait_for_run("${run_id}", until: "end")`, { run_id, approval_id, decision, note: note ?? null, action: ap?.action ?? null });
    }),
  );

  server.registerTool(
    "answer",
    { title: "Answer a question", description: "Answer the crew's open question. text is the answer; a number picks that option (1 is the first).", inputSchema: { run_id: z.string(), question_id: z.string(), text: z.string() } },
    tool(async ({ run_id, question_id, text }: { run_id: string; question_id: string; text: string }) => {
      const v = await viewOf(run_id);
      const opts = v.openQuestion?.questionId === question_id ? (v.openQuestion.options ?? []) : [];
      const answer = /^\d+$/.test(text.trim()) && opts[Number(text.trim()) - 1] ? opts[Number(text.trim()) - 1] : text.trim();
      await api(`/api/runs/${run_id}/messages`, { body: { text: answer, kind: "answer", questionId: question_id } });
      return reply(`answered ${question_id}: "${short(answer, 80)}"\nnext: wait_for_run("${run_id}", until: "end")`, { run_id, question_id, answer });
    }),
  );

  server.registerTool(
    "read_artifact",
    { title: "Read the artifact", description: "The run's deliverable: the newest version of its doc (or code), in full in the JSON.", inputSchema: { run_id: z.string() } },
    tool(async ({ run_id }: { run_id: string }) => {
      const v = await viewOf(run_id);
      const a = mainArtifact(v);
      if (!a) return reply(`${run_id} has no artifact yet · ${runLine(run_id, v)}`, { run_id, artifact: null, status: v.status });
      const lines = a.latest.content.split("\n").filter((l) => l.trim());
      const text = `${a.latest.title} (v${a.latest.version}, ${a.kind}) · ${fmtCost(v.costUsd)}\n${lines.slice(0, 10).join("\n")}${lines.length > 10 ? `\n… ${lines.length - 10} more lines in the JSON` : ""}\n${runLink(run_id)}`;
      return reply(text, { run_id, title: a.latest.title, kind: a.kind, language: a.language ?? null, version: a.latest.version, versions: a.versions.length, content: a.latest.content, url: runLink(run_id) });
    }),
  );

  server.registerTool(
    "list_memories",
    { title: "List memories", description: "What the workstream remembers from earlier runs, newest first.", inputSchema: { workstream: z.string().describe("workstream id or name") } },
    tool(async ({ workstream }: { workstream: string }) => {
      const ws = await findWorkstream(workstream);
      const { memories } = await api<{ memories: { id: string; text: string; runNumber: number; usedCount: number; createdAt: number }[] }>(`/api/workstreams/${ws.id}/memories`);
      return reply(`${memories.length} memories · ${ws.title}\n${memories.slice(0, 8).map((m) => `• ${short(m.text, 110)}`).join("\n")}${memories.length > 8 ? `\n… ${memories.length - 8} more in the JSON` : ""}`, { workstream_id: ws.id, memories });
    }),
  );

  server.registerTool(
    "create_workstream",
    {
      title: "Create a workstream",
      description: "A new standing goal with its own SKILL.md. schedule: 'daily HH:MM', 'weekdays HH:MM', 'mondays HH:MM' or a five-field cron line; leave it out to run by hand. tools from: web_search, fetch_url, run_code, write_artifact, send_message, read_repo, open_pr.",
      inputSchema: { title: z.string(), goal: z.string(), schedule: z.string().optional(), tools: z.array(z.string()).min(1) },
    },
    tool(async ({ title, goal, schedule, tools }: { title: string; goal: string; schedule?: string; tools: string[] }) => {
      const w = await createWorkstream({ title, goal, schedule, tools });
      return reply(`created ${w.id} · ${w.title}${w.scheduleLabel ? ` · ${w.scheduleLabel}` : ""} · ${w.tools.length} tools\nnext: start_run("${w.id}")`, w);
    }),
  );

  server.registerResource(
    "run-events",
    new ResourceTemplate("nimbus://runs/{id}/events", { list: undefined }),
    { title: "Run events", description: "Every event of a run so far, as JSON (the log the timeline is built from)", mimeType: "application/json" },
    async (uri, { id }) => {
      const { events, finished } = await snapshot(String(id));
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify({ run_id: id, finished, events }) }] };
    },
  );

  server.registerResource(
    "workstream-skill",
    new ResourceTemplate("nimbus://workstreams/{id}/skill", {
      list: async () => ({ resources: (await listWorkstreams()).filter((w) => !w.archived).map((w) => ({ uri: `nimbus://workstreams/${w.id}/skill`, name: `${w.title} SKILL.md`, mimeType: "text/markdown" })) }),
    }),
    { title: "Workstream SKILL.md", description: "The workstream's self-rewritten skill file: steps and the policy lines its approvals compiled into", mimeType: "text/markdown" },
    async (uri, { id }) => {
      const w = await findWorkstream(String(id));
      return { contents: [{ uri: uri.href, mimeType: "text/markdown", text: w.skill ?? "" }] };
    },
  );

  await server.connect(new StdioServerTransport());
  console.error(`nimbus mcp: serving on stdio for ${baseUrl()}`);
}
