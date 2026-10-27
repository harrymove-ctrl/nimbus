// Tool definitions (zod) and executors. Structure comes from tool calls, never response_format (SPEC §2).
// Tools are given to the model WITHOUT execute: agent.ts runs them itself so every call can emit events.
import { spawn } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { dataDir } from "@/db";
import type { AgentRole } from "@/lib/models";
import { modelMode } from "@/lib/tokenfactory";
import type { RunCtx } from "./context";

const role = z.enum(["researcher", "analyst", "writer", "checker"]);
const agentBrief = z.object({ role, brief: z.string() });

export const SCHEMAS = {
  web_search: z.object({ query: z.string() }),
  fetch_url: z.object({ url: z.string() }),
  run_code: z.object({ language: z.enum(["python", "node"]), filename: z.string().optional(), code: z.string() }),
  write_artifact: z.object({ artifactId: z.string(), kind: z.enum(["doc", "code"]), title: z.string(), language: z.string().optional(), content: z.string() }),
  send_message: z.object({ channel: z.string(), text: z.string() }),
  ask_user: z.object({ text: z.string(), options: z.array(z.string()).optional() }),
  plan: z.object({ agents: z.array(agentBrief), tools: z.array(z.string()), estimate: z.object({ costUsd: z.number(), tokens: z.number(), label: z.string() }) }),
  spawn_agents: z.object({ agents: z.array(agentBrief) }),
  handoff: z.object({ to: role, context: z.string() }),
  request_approval: z.object({
    action: z.object({ kind: z.enum(["send_message", "write_file", "http_request", "run_code"]), summary: z.string(), risk: z.enum(["low", "medium", "high"]), details: z.unknown() }),
  }),
  finish: z.object({ summary: z.string() }),
  save_learning: z.object({ memories: z.array(z.string()), skill: z.string() }),
} as const;

export type ToolName = keyof typeof SCHEMAS;

const DESCRIPTIONS: Record<ToolName, string> = {
  web_search: "Search the web (Tavily). Returns title, url and snippet for each result.",
  fetch_url: "Fetch a page and return its readable text (first 20k characters).",
  run_code: "Run a short Python or Node script in a sandboxed temp workspace that already contains the attached data files (e.g. data.csv). 30 s timeout.",
  write_artifact: "Create or update a document or code artifact. Calling it again with the same artifactId creates the next version.",
  send_message: "Send a message to a channel. Always needs the person's approval.",
  ask_user: "Ask the person one short question when you cannot proceed. Offer options when you can.",
  plan: "Your first call: the agents, tiers and tools you will use and a cost estimate. The person has 3 seconds to cancel.",
  spawn_agents: "Run several agents concurrently and get their reports.",
  handoff: "Hand one piece of work to one agent and wait for its report.",
  request_approval: "Ask the person to approve a side-effecting action before it happens.",
  finish: "End the run with a one-paragraph summary.",
  save_learning: "Save up to 8 memories and the rewritten SKILL.md for this workstream.",
};

/** Control tools run inside the orchestrator and show as waits, not tool segments. */
export const CONTROL_TOOLS = new Set<ToolName>(["plan", "spawn_agents", "handoff", "request_approval", "ask_user", "finish"]);

export const ROLE_TOOLS: Record<AgentRole, ToolName[]> = {
  orchestrator: ["plan", "spawn_agents", "handoff", "request_approval", "ask_user", "finish"],
  researcher: ["web_search", "fetch_url", "ask_user"],
  analyst: ["run_code", "write_artifact", "ask_user"],
  checker: ["run_code", "fetch_url"],
  writer: ["write_artifact"],
  learner: ["save_learning"],
};

export function toolSet(names: ToolName[], allowed: string[]): ToolSet {
  const set: ToolSet = {};
  for (const n of names) if (CONTROL_TOOLS.has(n) || n === "save_learning" || allowed.includes(n)) set[n] = tool({ description: DESCRIPTIONS[n], inputSchema: SCHEMAS[n] as unknown as z.ZodType<unknown> });
  return set;
}

/** Short text for a tool segment label. */
export function toolLabel(name: string, input: Record<string, unknown>): string {
  const s = (v: unknown) => String(v ?? "").slice(0, 40);
  if (name === "web_search") return `web_search · ${s(input.query)}`;
  if (name === "fetch_url") return `fetch_url · ${s(String(input.url ?? "").replace(/^https?:\/\//, ""))}`;
  if (name === "run_code") return `run_code · ${s(input.filename ?? "script")}`;
  if (name === "write_artifact") return `write_artifact · ${s(input.title)}`;
  if (name === "send_message") return `send_message · ${s(input.channel)}`;
  if (name === "save_learning") return "save_learning · SKILL.md";
  return name;
}

/* ---------------- executors ---------------- */

type SearchFixture = { match: string[]; results: { title: string; url: string; snippet: string }[] };
const fixturesDir = (...p: string[]) => path.join(process.cwd(), "fixtures", ...p);

export async function webSearch(query: string) {
  const useMock = modelMode() === "mock" || !process.env.TAVILY_API_KEY;
  if (!useMock) {
    const { tavily } = await import("@tavily/core");
    const r = await tavily({ apiKey: process.env.TAVILY_API_KEY! }).search(query, { maxResults: 5 });
    return { source: "tavily", results: r.results.map((x) => ({ title: x.title, url: x.url, snippet: x.content.slice(0, 280) })) };
  }
  const q = query.toLowerCase();
  const files = readdirSync(fixturesDir("search")).filter((f) => f.endsWith(".json") && f !== "pages.json");
  const all = files.map((f) => JSON.parse(readFileSync(fixturesDir("search", f), "utf8")) as SearchFixture);
  const hit = all.find((f) => f.match.length > 0 && f.match.every((k) => q.includes(k))) ?? all.find((f) => f.match.length === 0) ?? all[0];
  return { source: "fixture", results: hit.results };
}

export async function fetchUrl(url: string) {
  if (modelMode() === "mock" || !process.env.TAVILY_API_KEY) {
    const pages = JSON.parse(readFileSync(fixturesDir("search", "pages.json"), "utf8")) as Record<string, string>;
    return { url, text: pages[url] ?? `No fixture for ${url}.` };
  }
  const res = await fetch(url, { headers: { "user-agent": "NimbusBot/0.1" }, signal: AbortSignal.timeout(15_000) });
  const html = await res.text();
  const text = html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { url, text: text.slice(0, 20_000) };
}

/**
 * Sandboxed subprocess: a per-run temp workspace, stripped environment (no API keys), 30 s timeout,
 * output capped. It does NOT block the network: OpenShell is the production path for that (README).
 */
export function runCode(ctx: RunCtx, i: { language: "python" | "node"; filename?: string; code: string }): Promise<{ ok: boolean; exitCode: number | null; stdout: string; stderr: string; workspace: string }> {
  mkdirSync(ctx.workspace, { recursive: true });
  const data = fixturesDir("data.csv");
  if (existsSync(data) && !existsSync(path.join(ctx.workspace, "data.csv"))) copyFileSync(data, path.join(ctx.workspace, "data.csv"));
  const file = (i.filename ?? (i.language === "python" ? "script.py" : "script.js")).replace(/[^\w.-]/g, "_");
  writeFileSync(path.join(ctx.workspace, file), i.code);
  return new Promise((resolve) => {
    const child = spawn(i.language === "python" ? "python3" : process.execPath, [file], { cwd: ctx.workspace, env: { PATH: process.env.PATH ?? "", HOME: ctx.workspace, LANG: "en_US.UTF-8" } as unknown as NodeJS.ProcessEnv, timeout: 30_000 });
    let out = "", err = "";
    child.stdout.on("data", (d) => (out = (out + d).slice(0, 8000)));
    child.stderr.on("data", (d) => (err = (err + d).slice(-2000)));
    // macOS python3 shim noise (xcrun cache file) is not the script's error
    const clean = (e: string) => e.split("\n").filter((l) => !l.includes("xcrun_db")).join("\n").trim();
    child.on("error", (e) => resolve({ ok: false, exitCode: null, stdout: out, stderr: String(e), workspace: ctx.workspace }));
    child.on("close", (code) => resolve({ ok: code === 0, exitCode: code, stdout: out, stderr: clean(err), workspace: ctx.workspace }));
  });
}

export async function writeArtifact(ctx: RunCtx, who: { role: AgentRole; instance: string }, i: z.infer<typeof SCHEMAS.write_artifact>) {
  const version = (ctx.artifactVersions.get(i.artifactId) ?? 0) + 1;
  ctx.artifactVersions.set(i.artifactId, version);
  await ctx.saveArtifact({ ...i, version });
  ctx.emit("artifact.version", who.role, who.instance, { artifactId: i.artifactId, kind: i.kind, title: i.title, version, content: i.content, language: i.language });
  return { artifactId: i.artifactId, version };
}

/** Logs instead of sending: the demo never leaves the machine. Dry run logs nothing. */
export function sendMessage(ctx: RunCtx, i: { channel: string; text: string }) {
  if (ctx.mode === "dry") return { sent: false, logged: false, note: "dry run: nothing was sent" };
  mkdirSync(dataDir(), { recursive: true });
  appendFileSync(path.join(dataDir(), "outbox.log"), `${new Date().toISOString()} ${ctx.runId} ${i.channel}: ${i.text}\n`);
  return { sent: false, logged: true, note: "demo mode: logged to data/outbox.log instead of sending" };
}
