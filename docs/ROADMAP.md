# Roadmap: Nimbus as an open personal agent platform on Nebius

Written 2026-10-29, 21:40 ICT by the planner. Deadline 2026-10-31 00:00 ICT (Oct 30, 10:00 PDT), about 26 hours.
Two lanes: **Lane 1** lands before the deadline with a real test and real footage. **Lane 2** is the open-source
future after the hackathon, written down now so judges and contributors see where this goes.

Checkpoint 1, out loud: the simplest thing that makes "Nimbus works from your phone and from your coding agent" true
is one Telegram poller that reuses the chat intents we already have, and one stdio MCP server that wraps the HTTP API
we already have. One new dependency each (none for Telegram, `@modelcontextprotocol/sdk` for MCP). Everything else
is Lane 2.

## 0 · Where it stands tonight

| Piece | State | Evidence |
|---|---|---|
| Nebius Token Factory models (Ultra, Super, Nano) | live on production | every workstream has a finished real run, `docs/SUBMISSION.md` |
| Nebius Token Factory Sandboxes for `run_code` | **live from deployment c2487102** | `pnpm sandbox:probe` passed: Python 3.12 and Node 20, about 3 s per run, uploaded CSV readable |
| OpenAI-compatible `/v1/chat/completions` with chat intents (run, approve, deny, status, ask) | built, verified with `pnpm check:chat` in mock | never driven by a real OpenClaw or Hermes |
| Telegram | send only (`src/runtime/notify.ts`), no token on Railway | mock stub only |
| CLI, MCP | nothing | |

## 1 · Nebius Sandboxes: how to turn it on (users and judges)

1. Open [tokenfactory.nebius.com](https://tokenfactory.nebius.com), pick your project, go to **API keys**. The page
   shows the **Project id** (it looks like `aiproject-xxxxxxxxxxxxxxxxxxxx`) above the keys. Sandboxes is in beta:
   request access from the Sandboxes page once; the same API key then works for both models and sandboxes.
2. Put it next to your key in `.env.local`:
   ```
   NEBIUS_API_KEY=...
   NEBIUS_PROJECT_ID=aiproject-...
   ```
3. Check it in one command. It prints who the key is, the image catalog, and does one real run that reads an uploaded CSV:
   ```bash
   pnpm sandbox:probe
   ```
4. Hosted on Railway: `railway variables --service nimbus --set NEBIUS_PROJECT_ID=aiproject-...` and redeploy.
5. What changes: every `run_code` step the crew writes now runs in a disposable VM at Nebius with networking off.
   In Agent I/O the tool call carries a **Nebius Sandbox** chip with the image, the sandbox's own elapsed time and the
   operation id. Without the project id, or if the sandbox call fails, the same code runs as a local subprocess and
   the chip says so. `NIMBUS_SANDBOX=local` forces local.

Lane 2 for Sandboxes (after the deadline): a per-workstream image with pandas, numpy and duckdb imported once
(`POST /images/import`, then the UUID in `NIMBUS_SANDBOX_IMAGE_PYTHON`); files **out** of the sandbox (the crew's
charts and CSVs as artifacts, not only stdout); networking on for the Ship Nimbus crew so `pnpm eval` runs inside the
sandbox on a clone of the repo instead of on the server; one long-lived sandbox per run reused across steps so the
crew can build on earlier files.

## 2 · Lane 1 · A real Telegram bot (owned by Nimbus, no OpenClaw needed)

`docs/CHAT-APPS.md` said "a Nimbus-owned poller: not doing" because OpenClaw was going to own the bot. OpenClaw is not
installed on Railway and judges will not install it, so Nimbus polls its own bot. OpenClaw and Hermes keep working
through `/v1`; this is a second door, not a replacement.

**Files.** `src/runtime/telegram.ts` (poller and handlers), `src/instrumentation.ts` (start it with the scheduler),
`src/runtime/notify.ts` (pushes gain inline buttons), `scripts/check-telegram.mts` (mock test against the existing
stub server pattern from `check-chat`), `docs/TELEGRAM.md`.

**Behaviour.**
- Long-poll `getUpdates` (timeout 25 s) in the server process when `NIMBUS_TELEGRAM_BOT_TOKEN` is set and
  `NIMBUS_TELEGRAM_MODE` is not `off`. One poller per database: a `telegram_poller` row with a heartbeat so a second
  dev server or a deploy overlap does not double-handle updates. Webhook mode is Lane 2.
- **Private by default.** Only `NIMBUS_TELEGRAM_CHAT_ID` is served; anyone else gets one line, "This Nimbus is
  private. Run your own: github.com/harrymove-ctrl/nimbus". `/start` from the owner's chat when the id is unset
  prints the chat id to the server log so the owner can set it.
- Text goes through the existing intent router in `src/runtime/chat.ts` (`ruleIntent`, then the Nano classifier):
  `/run morning brief` or "run morning brief" starts a run and streams progress as **edited messages** (one message
  per run, edited every 3 s with the lane states and the running cost, never a flood); `/status` and "what needs me?"
  list waiting runs; "what did the radar find?" answers from the latest artifact; `/help`.
- **Approval card as inline keyboard:** the push "Morning brief needs your OK: send 3 replies" carries buttons
  **Approve · Always allow · Reject**. Reject asks for one line of note (or `/skip`). The web timeline shows
  `approved via telegram`. Buttons are disabled after the decision (edit the message, keep the record).
- **Crew questions** arrive with the options as buttons; the tap posts the answer to the asking lane.
- **Run end:** the first six lines of the artifact and the deep link `NIMBUS_PUBLIC_URL/?run=…`.
- Everything the chat endpoint already guarantees (900 characters, plain text, numbers first) through `toPhone`.

**Exit test, real:** on production with the real bot, from the user's phone: `/run morning brief` → progress edits →
approval card → tap Approve → final message with the link; the same run visible in the web app with the `telegram`
trigger badge; a scheduled run's push arrives without any message first. Mock: `pnpm check:telegram` green.

**Footage, real:** record Telegram Web (web.telegram.org) in a phone-sized viewport with Playwright from the
Terminal while the exit test runs (same method as the landing loops); 20 to 30 s, muted loop for `/welcome` row 10
("From your phone · approve on the bus") and a 45 s clip for X. Nothing staged, nothing mock.

**User's steps:** create the bot with @BotFather (name it, keep the token in `.env.local` and on Railway as
`NIMBUS_TELEGRAM_BOT_TOKEN`), send `/start` once to get the chat id, set `NIMBUS_TELEGRAM_CHAT_ID`. The token never
enters the repo or a chat message.

## 3 · Lane 1 · `nimbus` CLI and MCP server (Nimbus from Claude Code, Cursor, OpenClaw, Hermes)

One binary in this package (`bin/nimbus.mjs`, `pnpm nimbus …`, later `npx nimbus`), talking to a running Nimbus over
its HTTP API with `NIMBUS_URL` and `NIMBUS_API_TOKEN`. No second server, no new database.

| Command | Does |
|---|---|
| `nimbus init` | asks for the Token Factory key, project id, optional Tavily and Telegram values, writes `.env.local`, runs the smoke |
| `nimbus doctor` | models reachable, `whoami` for Sandboxes, image catalog, Telegram `getMe`, data dir, day cap |
| `nimbus run <workstream> [goal]` | starts a run, streams the timeline as text, prompts for approvals and questions in the terminal |
| `nimbus status` / `nimbus approve [id]` / `nimbus reject [id] "note"` | the same intents as chat |
| `nimbus ws list|create|export|import` | workstreams as YAML (goal, schedule, tools, roles) so people share them |
| `nimbus mcp` | stdio MCP server (see below) |
| `nimbus mcp install claude|cursor|openclaw` | prints or writes the config snippet for that client |

**MCP server tools** (`@modelcontextprotocol/sdk`, stdio): `list_workstreams`, `start_run(workstream, goal?)`,
`run_status(run_id)`, `wait_for_run(run_id, until: approval|question|end)`, `approve(run_id, approval_id, decision,
note?)`, `answer(run_id, question_id, text)`, `read_artifact(run_id)`, `list_memories(workstream)`,
`create_workstream(title, goal, schedule?, tools[])`. Resources: `nimbus://runs/{id}/events`,
`nimbus://workstreams/{id}/skill`. Every tool returns phone-length text plus structured JSON.

**Exit test, real:** `pnpm nimbus doctor` against production prints green rows; `pnpm nimbus run checkout` drives a
real run from the terminal with an approval prompt; Claude Code with the MCP server configured starts the Release
watch run, waits for the approval, approves it, reads the artifact (one transcript saved under `docs/mcp/` as proof,
token redacted). Mock: `scripts/check-cli.mts` runs the commands against a mock server.

## 4 · Lane 1 · Open the crew (cheap, high value for a personal agent)

- **Roles per workstream.** Today the crew is researcher, analyst, writer, checker, learner. Add `roles` to the
  workstream (JSON: name, brief, tier ceiling, tools), editable in the New workstream sheet under "Crew", defaulting
  to today's five. The orchestrator spawns the roles it is given. This is the "not limited to anything" the user
  asked for: a tutor crew, a job-hunt crew and a home-lab crew are rows, not code.
- **Templates gallery** in the New workstream sheet: Morning brief, Hackathon radar, Ship a repo, Token Factory
  cost audit, Release watch, Checkout, plus three personal ones written tonight as YAML under `templates/`:
  **Job hunt radar** (web_search, fetch_url, write_artifact; daily), **Study coach** (run_code for flashcards and
  spaced repetition from an attached CSV; weekly), **Household ops** (bills CSV, calendar text, send_message to the
  family chat; approvals required). Each template ships with a SKILL.md seed so run 1 already knows the person's
  rules.
- **Attach any file.** Already works (`data.csv`, `inbox.csv`); document it with a screenshot.

## 5 · Lane 2 · Open-source future (after the deadline, in the README as "Where this goes")

1. **MCP both ways.** Nimbus as MCP client: the person lists their own MCP servers (Gmail, Calendar, GitHub, Notion,
   Linear) in settings and the crew gets their tools with the same approval cards and always-allow rules by recipient.
   This replaces the fixture `send_message` with real sends under the same gates.
2. **Sandbox-first execution.** Ship Nimbus runs its evals inside a Nebius Sandbox on a clone of the repo; images per
   workstream; files out as artifacts.
3. **Webhook Telegram, Discord and Slack doors** on the same intent router; group chats with per-person allowlists.
4. **Multi-user.** Accounts, per-user data dirs and day caps, so one deployment serves a household or a small team.
5. **Skill sharing.** `nimbus ws export` produces a folder (workstream YAML, SKILL.md, memories opt-in) that another
   Nimbus imports; a community index in the repo.
6. **Eval and release discipline.** `pnpm eval` in GitHub Actions on every PR, nightly real-model canary under a cap,
   semver releases with a changelog, `good first issue` labels on Lane 2 items, CONTRIBUTING.md.
7. **Local models.** The router gains an `ollama` provider for the Nano tier so the checker and learner can run on a
   laptop; Nebius stays the default for Ultra and Super.

## 6 · Order and owners for the next 26 hours

| When (ICT) | What | Who |
|---|---|---|
| 21:40 | Sandbox live on production, one real run checked, README how-to | planner (this session) |
| 22:00 to 02:00 | Telegram bot (section 2), mock test green, PR | builder session A (Opus, worktree) |
| 22:00 to 01:00 | `nimbus` CLI and MCP server (section 3), mock test green, PR | builder session B (Opus, worktree) |
| 22:00 to 23:00 | Templates and roles (section 4), PR | planner, or session C if A and B are busy |
| 02:00 to 03:00 | merge, deploy, real exit tests with the user's bot token, Telegram footage | planner + user |
| morning Oct 30 | README, `/welcome` row 10, Devpost text, X clip | planner |
| by 22:00 Oct 30 | freeze: final checklist in `docs/SUBMISSION.md`, keys stay valid until judging ends on Dec 15 (the demo must stay free and unrestricted), rotation after | user |

Checkpoint 3 before "done": each Lane 1 item has a **real** exit test on production and a recording, or it is
listed in `docs/SUBMISSION.md` under "unverified" by name.

## 7 · The next wave (added 22:40 ICT, Oct 29, after sections 2 and 3 shipped)

Sandboxes, the Telegram bot and the CLI with MCP are live on deployment fa28ae1a (main 8967f20). What remains before
the deadline, in the order it lands, each with an owner and a real exit test:

| # | Piece | Owner | Real exit test |
|---|---|---|---|
| 7.1 | **Crew roles per workstream.** `roles` on the workstream (name, brief, tier ceiling, tools); the orchestrator plans with the roles it is given instead of the fixed five; the New workstream sheet gets a "Crew" section with role chips. | Opus session C | A Study coach workstream with roles tutor, quizmaster and checker runs on production and the timeline shows those three lanes |
| 7.2 | **Templates gallery.** `templates/*.yaml` (the six existing workstreams plus Job hunt radar, Study coach, Household ops), `GET /api/templates`, a gallery in the New workstream sheet, the same YAML `nimbus ws import` reads. Each ships a SKILL.md seed. | Opus session C | `nimbus ws import templates/study-coach.yaml` creates the workstream on production; one real run finishes |
| 7.3 | **Landing, README, Devpost.** `/welcome` gets three rows for the three doors (web, phone, terminal and coding agent) and a "Runs code in Nebius Sandboxes" feature; README gets "Three doors" and the Sandboxes paragraph with the measured numbers; `docs/SUBMISSION.md` gets the Devpost text for Sandboxes, Telegram and CLI with run ids and the unverified list. | Opus session D | `/welcome` renders on Railway at 1280 and 390 wide; every number traces to a run id |
| 7.4 | **Real MCP run.** A Claude-driven client over `nimbus mcp` against production: list, start Release watch, wait for the approval, decide, read the artifact; transcript under `docs/mcp/`. | planner | the run id in the transcript exists on production with trigger from the API |
| 7.5 | **Real Telegram run.** Token on Railway, pairing, `/run morning brief` from the phone, Approve tapped, screen recording. | user + planner | the run shows "from Telegram" and "Approved via telegram" on the web timeline |
| 7.6 | **Footage.** Telegram phone recording (user) and a terminal recording of `nimbus run checkout` (planner, from the Terminal panel), cut into `/welcome` rows and a 45 s X clip. | planner | the clips are of the runs above, nothing staged |
| 7.7 | **Freeze.** `pnpm demo`, `check:chat`, `check:telegram`, `check:cli` green on main; Devpost form filled; keys stay valid until Dec 15, rotated after judging ends. | user | the checklist in `docs/SUBMISSION.md` |

### Lane 2 additions (after the deadline)

- **Voice from Telegram.** Voice notes transcribed and routed through the same intents, so "run the brief" works hands free.
- **Discord and Slack doors** on the same handlers as Telegram (slash commands, buttons), one file each.
- **MCP client in the crew.** The person lists their MCP servers in settings (Gmail, Calendar, GitHub, Notion, Linear); every tool arrives with the same approval card and the same always-allow rule by recipient. This retires the fixture `send_message`.
- **One-line self-host.** `docker compose up` with the volume, `nimbus init` for the keys, a GitHub Action that runs a workstream on a schedule for people without a server.
- **Run replay export.** A run as a single `.nimbus.json` anyone can open in a hosted viewer (no account), for sharing what a crew did.
- **Crew marketplace in the repo.** `templates/` with a `community/` folder and a CI check that every template runs in mock mode.
- **Per-workstream sandbox images.** `image:` in the template; Nimbus imports it once and pins the UUID.
- **Multi-user and a hosted free tier** under a per-user day cap, so a household or a class shares one deployment.

## 8 · What production showed on the night of Oct 29 (added Oct 30, 00:30 ICT)

Three screens the user sent, read against the run logs. Nothing here is a mock; everything is on
nimbus-production-6f7b.up.railway.app.

### Is it real? Yes, with one wording fix

- **Study coach run_b42b8b80.** Real crew from the template (Tutor, Quizmaster, Checker, Learner), 94 s, $0.031, seven
  `run_code` calls, every one in a Nebius sandbox (the Agent I/O chip shows the image and operation id). The three red
  marks on the Tutor lane are the model's own errors, not sandbox failures: `KeyError: 'card_id'` (it guessed a column
  name), a pandas dtype error, and `FileNotFoundError: flashcards_updated.csv` (it expected a file from an earlier call
  to survive; every call is a fresh VM). The Tutor recovered on its own and finished.
- **Overview, Impact this week.** Counted from the run events of the last 7 days, archived workstreams included: 19
  finished runs, 19 documents, $0.18 saved by the router, 0 pull requests. "14 messages sent" was the wrong word:
  `send_message` records an approved send in the log, it does not deliver to Slack or email yet (Lane 2, MCP client).
  The row now says **messages approved**. The time saved is an estimate and says so under the row.
- **Scheduled workstreams, 30 days.** The dotted history is the dither background; only the green cells are runs. Four
  schedules, 100 % of their runs finished. Real.
- **New workstream sheet.** Nine templates with their crews, the Crew chips, the default five. Real; the third card is
  cut at the right edge because the gallery scrolls sideways (cosmetic, see below).

### Fixed on Oct 30 (deployment after main d933d67)

1. Every agent's first prompt now lists each attached CSV with its **columns** and says that **every run_code call
   starts fresh**; the tool description says the same. Expected effect: fewer failed calls, cheaper runs.
2. Overview impact row: "messages approved".
3. The timeline's trace and replay toolbar sits in a backed pill, so it no longer collides with the Orchestrator lane.

### Sandboxes today, in numbers

| Item | Value |
|---|---|
| Image for Python | imported `amancevice/pandas:slim` pinned by UUID (pandas 3.0.5, numpy 2.5.2) |
| Image for Node | `node:20-slim` |
| Round trip per call | about 3.6 s (0.6 to 0.8 s inside the VM) |
| Beta limits | 50 concurrent instances, 3600 s max timeout, 12 GB image layer |
| Production proof | run_668c7252 (3 calls), run_b42b8b80 (7 calls), run_e8b4dff2 via MCP |

### Develop it more (ordered by value for a person, not for a demo)

1. **Workspace that persists across calls within one run.** Keep one sandbox instance alive for the run (the API allows
   non-disposable instances) or upload the previous call's outputs with the next call. Removes the "file is gone" class
   of errors entirely. Lane 1 if the API's instance reuse is confirmed in an hour; else Lane 2.
2. **Files out of the sandbox.** Charts and CSVs the crew writes become artifacts (base64 on stdout as a stopgap, a
   proper files endpoint when Nebius adds one).
3. **A data card per attachment.** Row count, columns with types, three sample rows, computed once at run start in a
   sandbox call and fed to the crew. Cuts the exploratory calls (the Tutor spent three of seven on that).
4. **Real delivery behind the same approvals.** `send_message` to Telegram first (the bot exists now), then Slack and
   email through the person's own MCP servers. Then "messages sent" becomes true.
5. **Template gallery polish.** Scroll affordance for the card row, a "Use" button on hover, and a preview of the
   SKILL.md seed. Plan card: show the tier for custom roles (blank today).
6. **A run cost forecast per template** from the last three runs, shown on the card before you create the workstream.
7. **Learner quality.** It wrote 8 memories and left SKILL.md unchanged on the Study coach run; a rule for "when the
   deck's columns differ from the seed, record them" would have saved the next run its first failed call.

### GitHub state

Main carries all of it (docs, templates, CLI, MCP, Telegram, Sandboxes). The main checkout on the laptop still holds
uncommitted edits to the plan card and timeline from another agent; they are not on GitHub and not deployed.
