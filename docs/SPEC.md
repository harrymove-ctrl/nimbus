# Nimbus — technical spec

Companion to `PLAN.md`. Shapes are normative; file names are suggestions.

## 1. Stack

- Next.js 15 (App Router, Node runtime for API routes), React 19, TypeScript strict.
- Tailwind v4, shadcn CLI ≥3, React Bits Pro Sorbet blocks, Manrope via `next/font/google`.
- Vercel AI SDK (`ai`, `@ai-sdk/openai-compatible`) for streaming + tool calling.
- libsql (`@libsql/client`) + drizzle-orm, SQLite file at `DATA_DIR/nimbus.db`.
- `node-cron` for schedules. `zod` for all tool and artifact schemas.
- Tavily (`@tavily/core`) for search. `pnpm` as package manager.

Env (`.env.example`):

```
NEBIUS_API_KEY=            # Token Factory key
NEBIUS_BASE_URL=https://api.tokenfactory.nebius.com/v1
TAVILY_API_KEY=
REACTBITS_LICENSE_KEY=     # only needed to install blocks, never at runtime
NIMBUS_DATA_DIR=./data
NIMBUS_DEV_CHEAP=0         # 1 = route every tier to Nano while developing
NIMBUS_API_TOKEN=          # bearer for /v1/chat/completions and job callbacks
```

## 2. Model routing — `src/lib/models.ts`

```ts
export const TIERS = {
  ultra: "nvidia/Nemotron-3-Ultra-550b-a55b",     // 1M ctx, $1.00/$3.00
  super: "nvidia/nemotron-3-super-120b-a12b",     // 256K ctx, $0.30/$0.90 (id is lowercase on the catalog)
  nano:  "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B", // 262K ctx, $0.06/$0.24
} as const;

export const ROLE_TIER = {
  orchestrator: "ultra", researcher: "super", analyst: "super",
  writer: "super", checker: "nano", learner: "nano",
} as const;

export const PRICE_PER_M = { ultra: [1, 3], super: [0.3, 0.9], nano: [0.06, 0.24] };
```

`modelFor(role)` returns Nano for every role when `NIMBUS_DEV_CHEAP=1`.
Cost per run = Σ usage × price. Verify the three ids against
`https://tokenfactory.nebius.com/api/public/models_info` in Phase 0 (ids are
case-sensitive and the catalog is inconsistent about case).

Client:

```ts
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
export const tokenFactory = createOpenAICompatible({
  name: "nebius", baseURL: process.env.NEBIUS_BASE_URL!,
  headers: { Authorization: `Bearer ${process.env.NEBIUS_API_KEY}` },
});
// tokenFactory(TIERS.super) → a LanguageModel for generateText / streamText
```

Structured output: use **tool calls** with zod schemas, not `response_format`
(JSON mode is not tagged on the Nemotron cards). If a model returns reasoning
text, strip `<think>…</think>` blocks before parsing or displaying.

## 3. Domain model

```ts
type Workstream = { id; title; goal; scheduleCron?: string; tools: ToolName[]; createdAt };
type Run = { id; workstreamId; title; status: "queued"|"running"|"waiting_approval"|"done"|"failed";
             trigger: "manual"|"cron"|"chat"|"job"; startedAt; endedAt?; tokensIn; tokensOut; costUsd };
type AgentRole = "orchestrator"|"researcher"|"analyst"|"writer"|"checker"|"learner";
type RunEvent = { id; runId; tMs: number; agent: AgentRole; agentInstance: string; type: RunEventType; payload: unknown };
type RunEventType =
  | "run.start" | "run.end" | "run.error"
  | "agent.spawn"      // payload: { by: agentInstance, role, brief }   → draws the dotted connector
  | "agent.start" | "agent.end" | "agent.error"
  | "segment.think" | "segment.tool" | "segment.wait" // payload: { label, startMs, endMs? }
  | "tool.call" | "tool.result"
  | "handoff"          // payload: { from, to, context }
  | "approval.request" // payload: { approvalId, action: ProposedAction }
  | "approval.resolve" // payload: { approvalId, decision, by }
  | "artifact.version" // payload: { artifactId, kind: "doc"|"code", title, version }
  | "message"          // payload: { role: "agent"|"user", text }   → composer transcript
  | "usage";           // payload: { tier, in, out }
type ProposedAction = { kind: "send_message"|"write_file"|"http_request"|"run_code"; summary: string; details: unknown; risk: "low"|"medium"|"high" };
type Artifact = { id; runId; kind; title; version; content; createdAt };
type Approval = { id; runId; action: ProposedAction; status: "pending"|"approved"|"rejected"; decidedAt? };
type Memory = { id; workstreamId; text; embedding: number[]; sourceRunId; createdAt };
```

## 4. Runtime — `src/runtime/`

- `bus.ts`: per-run `EventEmitter`; every `emit` also inserts into `run_events`.
  Subscribers: SSE route, CLI printer.
- `registry.ts`: `globalThis.__nimbusRuns: Map<runId, RunHandle>` (survives
  Next.js HMR). `RunHandle = { run, bus, pendingApprovals: Map<id, Deferred> }`.
- `agent.ts`: `runAgent({ role, instance, brief, tools, memories, skill })` →
  `streamText` with the role prompt; emits `segment.think` while streaming
  text, `segment.tool` around each tool call, `usage` at the end.
- `orchestrator.ts`: an agent loop for the Ultra model whose tools are:
  - `spawn_agents({ agents: [{ role, brief }] })` → runs them **concurrently**
    (`Promise.all`), emits `agent.spawn` for each (connector), returns their reports.
  - `handoff({ to, context })` → sequential; emits `handoff`.
  - `request_approval({ action })` → emits `approval.request`, sets run status
    `waiting_approval`, awaits the Deferred, emits `approval.resolve`.
  - `finish({ summary })`.
  Orchestrator turns are capped at 6; wall clock cap 5 min.
- `learner.ts`: after `run.end`: Nano extracts ≤8 memories (`{text}`), embeds
  them, then rewrites `SKILL.md` given the old skill + the run transcript
  summary. Emits `message` with the diff summary.
- `tools/`: `web_search` (Tavily, returns `{title,url,snippet}[]`), `fetch_url`
  (readability-stripped text, 20k chars), `run_code` (Node/Python subprocess in
  `DATA_DIR/workspaces/<runId>`, 30s timeout, no network), `write_artifact`
  (bumps version), `send_message` (approval-gated; logs instead of sending in the demo).

Approval policy: `send_message`, `http_request` with a method other than GET,
and `write_file` outside the run workspace always require approval. `run_code`
requires approval only when `risk !== "low"` (orchestrator sets risk).

## 5. Storage — drizzle schema

Tables: `workstreams`, `runs`, `run_events` (index on `run_id, t_ms`),
`artifacts`, `approvals`, `memories` (embedding stored as JSON float array;
cosine similarity in JS over the workstream's memories, which is fine at this scale),
`skills` (`workstream_id, content, version`). `fixtures/seed.ts` creates three
workstreams including "Checkout conversion drop on Oct 14" with a sample CSV.

## 6. Timeline component — `src/components/timeline/`

Reproduce the reference screenshot:

- Header: title; status line `Running · 5.7s · 11,916 tokens · $0.04` (live).
- Legend column: colored dot, agent name, model badge with provider icon
  (NVIDIA mark + "Nemotron 3 Ultra/Super/Nano").
- Lanes: one per `agentInstance`, ordered by first `agent.spawn`/`agent.start`.
  Segments are rounded bars: solid = `segment.think`/`segment.tool`,
  **hatched** = `segment.wait` (orchestrator waiting on children),
  **outlined red with ✕** = `agent.error`.
- Connectors: for each `agent.spawn`, a colored dot on the orchestrator lane
  at `tMs`, a dotted vertical line down to the child lane's first segment.
- Playhead: vertical line with a dot at the axis, moves with `now - startedAt`
  while running; frozen at `endedAt` when done. Axis labels every 5s; scale
  grows in 5s steps so the playhead stays at ~80% of width.
- Hover a segment → tooltip with the label and duration; click → scroll the
  composer transcript to that event.
- Colors: orchestrator neutral-300, checker blue, researcher purple, analyst
  orange, writer teal, learner mint (`--rb-accent`). Dark background by default.
- Implementation: SVG, `useRunEvents(runId)` hook over SSE with replay from
  `GET /api/runs/[id]/events?since=0`. Reduced motion: no playhead animation.

## 7. Composer — three React Bits blocks, one surface

Install (shadcn CLI ≥3). `components.json` gets:

```json
"registries": {
  "@reactbits-pro": {
    "url": "https://pro.reactbits.dev/api/r/pro/{name}.json",
    "headers": { "Authorization": "Bearer ${REACTBITS_LICENSE_KEY}" }
  }
}
```

(Copy the exact block from https://pro.reactbits.dev/docs/installation; the
URL above is from a search snippet — **verify**.) The key lives in `.env.local`
next to `components.json`. Then:

```
npx shadcn@latest add @reactbits-pro/ai-chat-6-sorbet
npx shadcn@latest add @reactbits-pro/ai-chat-5-sorbet
npx shadcn@latest add @reactbits-pro/ai-chat-2-sorbet
```

Assembly:

- **Shell = ai-chat-6** (multi-agent chat: per-agent identity, handoffs, live
  activity rail). Map each `agentInstance` to an identity; `handoff` events
  render as the block's handoff rows; the activity rail mirrors the timeline.
- **Approval card = ai-chat-5's inline approval request** rendered for every
  `approval.request`, with Approve/Reject calling `POST /api/runs/[id]/approvals/[aid]`.
  Disabled with a "resolved" state after `approval.resolve`.
- **Artifact panel = ai-chat-2's side panel** (code/document preview with version
  tabs) fed by `artifact.version` events; the latest version is selected on arrival.
- Composer input: sends `message` to the orchestrator of the active run (or
  starts a new run for the selected workstream when none is running).
- Sorbet theme: `docs/assets/reactbits-sorbet.css` in `globals.css`;
  `body { font-family: var(--rb-font-sans) }`; dark mode via `.dark` on `<html>`.

## 8. Chat-app integration — OpenAI-compatible endpoint

`POST /v1/chat/completions` (bearer `NIMBUS_API_TOKEN`): takes the last user
message, picks the workstream named in `model` (e.g. `model: "nimbus/inbox-triage"`,
default workstream when unknown), starts a run with `trigger: "chat"`, streams
the Writer's final text as OpenAI-style SSE chunks. Pending approvals are
streamed as a line: `⚠ Needs your approval: <summary> → <web composer URL>`.

OpenClaw config (`~/.openclaw/openclaw.json`), Nimbus as the provider:

```json
{ "models": { "mode": "merge", "providers": { "nimbus": {
  "baseUrl": "https://<endpoint>/v1", "apiKey": "${NIMBUS_API_TOKEN}",
  "api": "openai-completions",
  "models": [{ "id": "nimbus/inbox-triage", "name": "Nimbus · Inbox triage",
               "input": ["text"], "contextWindow": 256000, "maxTokens": 8192 }] } } } }
```

And the direct Token Factory provider for OpenClaw (shows judges the model path):

```json
"nebius": { "baseUrl": "https://api.tokenfactory.nebius.com/v1", "apiKey": "${NEBIUS_API_KEY}",
  "api": "openai-completions",
  "models": [{ "id": "nvidia/nemotron-3-super-120b-a12b", "name": "Nemotron 3 Super",
               "reasoning": true, "input": ["text"], "contextWindow": 256000, "maxTokens": 32768 }] }
```

Both from https://docs.openclaw.ai/gateway/config-tools/custom-providers
(the `${VAR}` form is documented as env substitution — **verify** on install).

## 9. Always-on: schedules, Serverless Jobs, deploy

- In-app: `node-cron` registers every workstream with `scheduleCron` at boot
  (`instrumentation.ts`), starting runs with `trigger: "cron"`.
- Headless entrypoint: `pnpm run:job --workstream <id> --yes` (auto-approves
  low-risk only; anything else is left pending for the web UI). This is the
  command the Serverless Job image runs.
- Dockerfile: `node:22-alpine`, multi-stage, `pnpm build`, `next start`,
  `DATA_DIR=/data` on a volume. Same image serves the endpoint and the job
  (job overrides `--container-command`).
- Deploy: `nebius ai endpoint create --name nimbus --image <registry>/nimbus:<tag> --container-port 3000 --env NEBIUS_API_KEY=... --platform <cpu platform> --preset <small> --public` then
  `nebius ai job create --name nimbus-nightly --image <same> --container-command pnpm --args run:job --args --workstream --args <id> --timeout 1h`.
  Exact platform/preset ids come from `nebius ai platform list` (**verify**).

## 10. Glow Cloud preloader — `src/components/glow-cloud.tsx`

Use `docs/assets/glow-cloud.tsx` verbatim (React 19 `<style href precedence>`
works on Next 15). Props: `color="blue"` while idle/running, `color="orange"`
while `run.status === "waiting_approval"` or `"failed"`; `background={false}`
inside the app shell, `background` on the boot screen. Boot screen: cloud
centered, title "Nimbus", subtitle "waking the crew…", fades out when the first
`GET /api/workstreams` resolves. Run start: a 160px cloud in the timeline
header until the first `agent.start` event.

## 11. Definition of done per component

| Component | Done when |
|---|---|
| Token Factory client | `pnpm smoke` passes for all three tiers with usage printed |
| Runtime | `pnpm demo` passes (PLAN Phase 1 exit test) |
| Timeline | Matches §6 on the demo run; rebuilds after refresh |
| Composer | Approval card gates a real action; artifact panel shows version 2 after an edit |
| Memory + skills | Run 2 prompt contains run 1 memories and SKILL.md; diff visible |
| Endpoint `/v1` | `curl` streams a reply; OpenClaw config documented |
| Deploy | Public URL + one Serverless Job completed |

## 12. Cost-aware model router — `src/lib/router.ts`

Goal: **−50% spend vs an all-Super baseline with under 2% quality drop**,
measured by the eval harness (§13). Role tiers in §2 become the *ceiling*;
the router picks the cheapest tier that the hop needs.

- `pickTier({ role, brief, tools, risk })`:
  1. Deterministic rules first (free): Checker/Learner → nano always; a hop
     with no tools and a brief under 400 chars → nano; `risk === "high"` or
     role === orchestrator on the first turn → ceiling tier.
  2. Otherwise a Nano classifier (one call, cached) scores complexity 0–2
     → nano / super / ceiling.
- **Response cache**: SQLite table `llm_cache(key, model, response, usage, created_at)`,
  key = sha256(model + messages + tools). Exact-match hits skip the call
  (Checker and Learner repeat a lot in evals). TTL 24h. Emit `usage` with `cached: true`.
- **Prompt cache**: every role prompt is a stable prefix; per-run material goes
  after it, so Token Factory's cached-input price applies.
- **Fallbacks**: on 429 / 5xx / timeout (60s) → retry once with backoff, then
  fall **one tier down** (ultra→super→nano) and continue. Never fall up.
- **Events**: `route` event `{ hop, role, chosen, ceiling, reason, fallback?: true }`
  → the timeline shows a small badge on the segment when `chosen !== ceiling`
  or a fallback happened. The run header shows `cost · −X% vs baseline`
  where baseline = the same hops priced at the ceiling tier.
- Kill switch: `NIMBUS_ROUTER=off` pins every hop to its ceiling (for A/B in evals).

## 13. Trajectory eval harness — `evals/`

Goal: grade **every hop**, not just the final answer, and gate PRs on it.

- **Golden trajectory** = `evals/trajectories/<name>.json`:
  `{ workstream, fixtures, input, hops: [{ agent, expect: Assertion[] }], final: Assertion[] }`.
  Assertions are deterministic where possible (`spawned_at_least: 3`,
  `tool_called: web_search`, `sources_at_least: 2`, `approval_before: send_message`,
  `artifact_contains: "Oct 14"`, `no_tool: send_message`, `max_cost_usd: 0.10`,
  `max_seconds: 60`) and LLM-judged otherwise (`judge: "the analyst's numbers
  match the CSV"` → Nano judge with a 0–2 rubric; 2 = pass).
- `pnpm eval [--cheap] [--router off|on] [--only name]`: replays each golden
  against fixtures (network tools mocked from `evals/fixtures/`), grades every
  hop, prints a table (golden × hop → pass/fail, cost, seconds), writes
  `evals/report.json`. Exit code 1 if pass rate < 90% or any `final` fails.
- Baseline comparison: `pnpm eval --router off` then `--router on`; the report
  prints spend delta and pass-rate delta. That is the −50% / <2% claim, with numbers.
- **Recording**: `pnpm demo --record <name>` turns a real run into a golden
  skeleton with every hop listed and empty `expect`; fill the assertions by hand.
  Honest target for 3 days: **12–20 goldens** across the three seeded
  workstreams; 100+ is the post-hackathon target and the README says so.
- **CI gate**: `.github/workflows/eval.yml` on pull_request runs
  `pnpm typecheck && pnpm eval --cheap` (Nano-only judge, 6 goldens, mocked tools)
  with `NEBIUS_API_KEY` as a repo secret. Branch protection on `main` requires it.

## 14. Rev B (2026-10-27): run view and composer v2 — supersedes §7's composer input

Full reasoning in `docs/UX-REVIEW.md`; drawings in `docs/UI-SKETCH.html`
(sheets 1, 4, 5; flow F11). Summary of what changes for the build:

- **Run view layout** (center column): run header 56 → timeline strip 240
  (collapsible to a 56 px summary bar) → transcript (flex) → approval tray 44
  (only while pending) → composer card (100 → 220). The timeline is no longer
  a bottom dock.
- **Inspector** (right, 420): tabs Artifact · Agent I/O · Memory & skill.
  Clicking a timeline segment selects it: Agent I/O shows that hop's prompt
  prefix, tool calls, result, tokens, tier and route badge. ai-chat-2's panel
  is the Artifact tab. Legend rows show tokens and cost per lane.
- **Composer card**: textarea (1–6 lines) + toolbar: Attach (files become
  tool inputs; chips in the row), Tools (allowed tools for this run), Mode
  (Ask each action · Auto low-risk · Dry run), Tier (Auto · Cheap · Max),
  cost estimate pill (Nano, 400 ms debounce; cached), primary button.
- **State-driven primary button and placeholder**: idle RUN "Give the crew a
  goal…"; running STEER "Steer the crew…" (+ STOP), a steering note is queued
  for the orchestrator's next turn as a `message` event; asked REPLY "Answer
  the crew…" (orchestrator tool `ask_user` emits `question`, run status stays
  `running`). Enter sends; Shift+Enter newline; ⌘Enter runs on Max; Esc clears.
- **Plan card**: the orchestrator's first turn must call `plan({agents, tools,
  estimate})` before `spawn_agents`; the UI renders it as the first transcript
  message with a 3 s Cancel (cancels the run) and, on a first run with no
  workstream, Save as workstream (creates it from the plan).
- **Approval tray** above the composer: count, first summary, Approve, Reject,
  Approve all low-risk. Card actions: Approve · Approve & always allow (appends
  `allow: <kind> for <scope>` to the workstream SKILL.md policy section; the
  router/orchestrator reads it next run) · Reject with a note (note goes back
  to the orchestrator as a `message`). "Edit" is removed.
- **Slash menu**: `/run`, `/schedule <cron or words>`, `/stop`, `/approve`,
  `/skill`, `/memory`; `@agent` targets a lane.
- **Phone**: a pending approval raises a count on the RUN tab and turns Z7
  orange; the tray renders at the top of the CHAT tab.

New event types: `plan` (payload: agents, tools, estimate), `question`
(payload: text, options?), and `policy` (payload: rule) emitted when Always
allow is used. New composer-related API: `POST /api/runs/[id]/messages`
(steer or answer), `POST /api/estimate` (Nano cost estimate for a draft).
