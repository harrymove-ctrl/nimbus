# `nimbus`: the CLI and the MCP server

One binary in this repo, `bin/nimbus.mjs`. It talks to a running Nimbus over the same HTTP API the web app uses
(`/api/workstreams`, `/api/runs`, the run's SSE event stream, approvals, messages, `/api/budget`). There is no
second server and no second database: a run you start from the terminal or from Claude Code shows up live in the web
app, and an approval you click in the web app ends the prompt in the terminal.

```bash
pnpm install
pnpm nimbus help
```

`npx nimbus …` works the same from the repo folder after `pnpm install`. From any other folder, call the file:
`node /path/to/nimbus/bin/nimbus.mjs …`. The TypeScript in `src/cli/` runs through `tsx` (already a dev
dependency), so there is no build step.

**Config.** `NIMBUS_URL` (default `http://localhost:3000`) and `NIMBUS_API_TOKEN`, read from the environment, then
`.env.local` in the current folder, then the repo's own `.env.local`. `NIMBUS_ENV_FILE=path` reads one named file
instead (`none` reads nothing). The token is sent as a bearer on every call; today only `/v1/chat/completions`
checks it. Behind an HTTP proxy, set `NODE_USE_ENV_PROXY=1` so Node's fetch uses `HTTPS_PROXY`.

## Commands

| Command | Does |
|---|---|
| `nimbus init` | asks for the Token Factory key, project id, Tavily key, Telegram bot token and chat id; writes `.env.local` (mode 600) without echoing a value; runs the smoke check |
| `nimbus doctor` | one row each: Nimbus answers, Token Factory models, Sandboxes `whoami`, image catalog, Telegram `getMe`, data, day cap |
| `nimbus run <workstream> [goal]` | starts a run, prints the timeline, asks you at the plan, each approval and each question |
| `nimbus status` | what is running, what waits for you, recent runs, today's spend |
| `nimbus approve [runId] [approvalId]` | approves the newest waiting plan or action; `--always` writes the policy too |
| `nimbus reject [runId] [approvalId] "note"` | rejects it with a note the crew reads (a waiting plan is cancelled) |
| `nimbus answer [runId] "text"` | answers the open question; a number picks that option |
| `nimbus ws list` / `create` / `export` / `import` | workstreams as YAML files people can share |
| `nimbus mcp` | the stdio MCP server (below) |
| `nimbus mcp install claude\|cursor\|openclaw [--write]` | prints the client config; `--write` adds it to `.mcp.json` here (Claude Code) |

A workstream is named by its id (`ws-checkout`), its short id (`checkout`) or its title (`"release watch"`).

### `nimbus init`

```bash
pnpm nimbus init
```

```
Nebius Token Factory API key (tokenfactory.nebius.com)
  NEBIUS_API_KEY: (hidden)
Token Factory project id, for Sandboxes (project/api-keys page) [optional, enter skips]
  NEBIUS_PROJECT_ID: …
saved 2 values to /path/to/nimbus/.env.local
smoke check: one call per Nemotron tier and one tool call (well under $0.01)
```

Values you skip keep what `.env.local` already has. `--no-smoke` skips the smoke check.

### `nimbus doctor`

```bash
NIMBUS_URL=https://nimbus-production-6f7b.up.railway.app pnpm nimbus doctor
```

```
✓ Nimbus                 https://nimbus-production-6f7b.up.railway.app answers · real Nemotron models
✓ Token Factory models   the key works · Ultra, Super and Nano listed (30 models)
✓ Sandboxes whoami       the key and project are accepted · 6 permissions · instance_max_timeout 3600, …
✓ Sandbox images         python:3.12-slim and node:20-slim ready
· Telegram               NIMBUS_TELEGRAM_BOT_TOKEN not set (optional)
✓ Data                   on the server · 7 workstreams, 7 with a SKILL.md
✓ Day cap                today $0.31 of $1.00 · run cap $0.25
```

`✓` passes, `✗` fails (exit 1), `·` is an optional part that is not set. The model, Sandboxes and Telegram rows use the
keys on this machine; the Nimbus, data and day cap rows ask the server. No key or token is ever printed.
`--json` prints the rows as JSON.

### `nimbus run`

```bash
pnpm nimbus run checkout
```

```
Nimbus · Checkout conversion drop on Oct 14
  run:  run_bbe6fed7 · http://localhost:3000/?run=run_bbe6fed7

   0.0s  Orchestrator   Ultra $0.005  plan: Researcher, Analyst, Checker, Writer · ≈ $0.07 · Ultra ×3 · Super ×5 · Nano ×6
         1. Researcher: Find releases, outages or campaigns around Oct 14 that touch checkout. (Super)
         …
  approve the plan? [Y/n] y
   0.4s  Researcher     Nano  $0.006  asks: Compare against Oct 7 or the 30-day average?
         1) Oct 7
         2) 30-day average
  answer (1-2 or text): 1
   0.8s  Orchestrator   Super $0.016  approval needed (medium risk): Send summary to #growth
  [a]pprove, approve a[l]ways, [r]eject? a
   1.4s  Orchestrator   Super $0.016  ap-3 approved by you
   1.4s  Orchestrator   Super $0.023  run done
   1.5s  Learner        Nano  $0.023  learned: 5 memories, SKILL.md +2 −1

── done · $0.023 · 74,520 tokens · 1.5s · 6 agents

Checkout conversion fell 4.5 pts on Oct 14, it was iOS Safari (v2)
  **62.8% → 58.3%.** iOS Safari fell 20.5 points (62.0% → 41.5%); every other platform moved less than 1.
  …
http://localhost:3000/?run=run_bbe6fed7
```

Each line is the time since the run started, the lane, the model tier that lane is on now, and the run's spend so far.
The run asks before every side effect: `a` approves, `l` approves and writes a policy so the same action is approved
from now on, `r` rejects and asks for a note. If input ends (a pipe, or Ctrl-D) while the run waits, the command exits
with code 2 and leaves the run waiting for `nimbus approve`, `reject` or `answer`, or the web app. `--yes` approves the
plan and every action and picks the first option of each question; `--goal`, `--mode ask|auto-low|dry` and
`--tier auto|cheap|max` pass through to `POST /api/runs`. Exit code 0 when the run ends `done`.

### `nimbus status`, `approve`, `reject`, `answer`

```bash
pnpm nimbus status
```

```
● Release watch  run_c98cef38  waiting · step 3/4 · 12s
    Waiting for you: Open the PR that bumps the AI SDK (ap-2, medium risk)
    nimbus approve run_c98cef38 ap-2   ·   nimbus reject run_c98cef38 "why"

today $0.05 of the $5.00 day cap
```

```bash
pnpm nimbus approve
pnpm nimbus approve run_c98cef38 ap-2 --always
pnpm nimbus reject "not today, the release notes are wrong"
pnpm nimbus answer run_bbe6fed7 2
```

With no ids, `approve` and `reject` act on the newest run that waits for a decision (its plan first, then its newest
action). `status --json` prints the active runs, recent runs and the budget.

### `nimbus ws`

```bash
pnpm nimbus ws list
pnpm nimbus ws export checkout checkout.yaml
pnpm nimbus ws import checkout.yaml
pnpm nimbus ws create --title "Inbox zero" --goal "Triage my inbox: three reply drafts" --tools web_search,write_artifact --schedule "weekdays 08:00"
```

A workstream file is flat YAML: `title`, `goal`, `schedule` and a `tools` list.

```yaml
# Nimbus workstream "Inbox zero". Import it with: nimbus ws import <this file>
title: Inbox zero
goal: "Triage my inbox: three reply drafts"
schedule: "weekdays 08:00"
tools:
  - web_search
  - write_artifact
```

`schedule` is `daily HH:MM`, `weekdays HH:MM`, `mondays HH:MM` or a five-field cron line (then `schedule_label` names
it). Leave it out to run by hand. Tools: `web_search`, `fetch_url`, `run_code`, `write_artifact`, `send_message`,
`read_repo`, `open_pr`. The parser reads `key: value` lines, `- item` and `[a, b]` lists, quoted strings, `|` and `>`
blocks and `#` comments; nothing nested (no dependency).

## MCP server

`nimbus mcp` serves the Model Context Protocol on stdio (`@modelcontextprotocol/sdk` 1.32.2), so a coding agent can
run a workstream, wait for its approval, decide it and read the result. Every tool answers with two text items: a
short block a phone can show (numbers first, then the next call to make) and the structured JSON.

| Tool | Arguments | Returns |
|---|---|---|
| `list_workstreams` | | id, title, goal, schedule, tools of each workstream |
| `start_run` | `workstream`, `goal?`, `review?` | `run_id` and the link. `review: true` waits for `approve(run_id, "plan")`; by default the plan starts after its 3 s window |
| `run_status` | `run_id` | status, spend, tokens, what it waits for (plan, approval, question), lanes, artifact |
| `wait_for_run` | `run_id`, `until: approval\|question\|end`, `timeout_s?` (120, at most 600) | the same as `run_status` plus `reason`: `reached`, `needs_you` (it waits for something else first), `ended` or `timeout` |
| `approve` | `run_id`, `approval_id` (`ap-1`, or `plan`), `decision: approve\|approve_always\|reject`, `note?` | what was decided |
| `answer` | `run_id`, `question_id`, `text` (a number picks that option) | the answer sent |
| `read_artifact` | `run_id` | title and first lines; the whole doc in the JSON |
| `list_memories` | `workstream` | what the workstream remembers, newest first |
| `create_workstream` | `title`, `goal`, `schedule?`, `tools[]` | the new workstream |

| Resource | Content |
|---|---|
| `nimbus://runs/{id}/events` | every event of the run so far, JSON |
| `nimbus://workstreams/{id}/skill` | the workstream's SKILL.md (listed for every workstream) |

A session reads like this: `start_run("release watch")` → `wait_for_run(run, "approval")` → `approve(run, "ap-1",
"approve")` → `wait_for_run(run, "end")` → `read_artifact(run)`.

### Claude Code

```bash
pnpm nimbus mcp install claude --write
```

adds this to `.mcp.json` in the current folder (or run without `--write` to print it):

```json
{
  "mcpServers": {
    "nimbus": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/nimbus/bin/nimbus.mjs", "mcp"],
      "env": { "NIMBUS_URL": "http://localhost:3000", "NIMBUS_API_TOKEN": "${NIMBUS_API_TOKEN:-}" }
    }
  }
}
```

or, from the shell: `claude mcp add nimbus --env NIMBUS_URL=http://localhost:3000 -- node /path/to/nimbus/bin/nimbus.mjs mcp`.

### Cursor

`.cursor/mcp.json` in the project, or `~/.cursor/mcp.json` for every project (`pnpm nimbus mcp install cursor`):

```json
{
  "mcpServers": {
    "nimbus": {
      "command": "node",
      "args": ["/path/to/nimbus/bin/nimbus.mjs", "mcp"],
      "env": { "NIMBUS_URL": "http://localhost:3000", "NIMBUS_API_TOKEN": "${env:NIMBUS_API_TOKEN}" }
    }
  }
}
```

### OpenClaw and Hermes

`pnpm nimbus mcp install openclaw` prints the same stdio server entry to add to the agent's MCP servers. Either can
also reach Nimbus with no MCP at all through `/v1/chat/completions` ([openclaw.md](openclaw.md)).

## Test

```bash
pnpm check:cli
```

Mock mode, $0, about 12 s. It serves the real route handlers over HTTP on a free port, with one local stub standing in
for Token Factory, Sandboxes and Telegram, then runs the binary: `doctor` (all green, then a rejected key), `ws list`,
`run checkout` answering the plan with `y`, the question with `1` and the approval with `a`, `status`, `approve` and
`reject "note"` with no ids, `ws export` then `import`, `ws create`. Then it drives `nimbus mcp` with the SDK's client:
`list_workstreams`, `start_run`, `wait_for_run(until: approval)`, `run_status`, `approve`, `wait_for_run(until: end)`,
`read_artifact`, `list_memories`, `create_workstream`, both resources. `--verbose` prints what the terminal run showed.
