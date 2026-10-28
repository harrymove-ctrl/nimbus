# Nimbus inside your chat apps: the real OpenClaw and Hermes integration

Written 2026-10-27 night by the planner (Fable/Opus); built by the Sonnet
builder; installs and the Telegram bot token are the user's steps.

## Is this the right approach?

The simplest thing that makes "talk to it from your chat app" true on camera:
**OpenClaw as the messenger, Nimbus as its model, one Telegram bot.** OpenClaw
already speaks Telegram; Nimbus already speaks the OpenAI API. What is missing
is not a bridge but behavior: the endpoint must understand a conversation
(ask, run, approve, deny, status) instead of starting a new run for every
message, and Nimbus must be able to message you first when a run needs you.
Hermes Agent points at the same endpoint as a second proof; no new code.

## Where it stands today

| Works | Missing |
|---|---|
| `POST /v1/chat/completions` (stream and non-stream), `GET /v1/models`, bearer auth, day-cap 429 | Never called by a real OpenClaw or Hermes; request shape unverified |
| A message starts a run on `nimbus/<workstream>` and streams the final doc | Every message starts a run, even "approve" or "what's running?" |
| Approval → a link to the web composer | Approving or denying from chat |
| Questions auto-answered | Answering the crew's question from chat |
| — | Nimbus messaging you first (a scheduled run needs you) |
| — | Answering questions about past work ("what did the radar find?") |

## Phase A · The endpoint understands a conversation (builder, mock mode, ~3 h)

1. **Request log.** `NIMBUS_V1_LOG=1` writes each incoming request body to
   `data/v1-log/<ts>.json` with the `authorization` header removed. The first
   real OpenClaw and Hermes requests tell us exactly what they send (system
   prompt, tools, `user` field, stream options); adapt to that, don't guess.
2. **Compatibility.** Accept `system`, `user`, `assistant`, `tool` roles and
   content as string or parts; accept and ignore `tools` / `tool_choice` /
   `response_format` (reply with text, `finish_reason: "stop"`); honor
   `stream_options.include_usage`; SSE chunks exactly `data: {…}\n\n` ending
   with `data: [DONE]\n\n`. First token within 2 s (a one-line acknowledgment),
   an SSE comment heartbeat every 10 s so a 60 s run never times out.
3. **One model, many intents.** Add model id `nimbus` (keep the per-workstream
   ids). The last user message goes through an intent router (rules first,
   then the Nano classifier, cached like the router):
   | Intent | Example | Action |
   |---|---|---|
   | approve | "approve", "yes", "ok send it" | Resolve the pending approval announced to this chat (latest first); reply with what was done |
   | deny | "no", "deny: too long" | Reject with the text after the colon as the note |
   | answer | reply to a crew question | Post the answer to the asking lane; "1", "2" pick options |
   | status | "what's running?", "what needs me?" | Running and waiting runs, one line each, with links |
   | ask | "what did the radar find today?" | Answer from the workstream's latest artifact and memories (Nano), no new run |
   | run | "run morning brief", "check the repo" | Start the matching workstream with the message as the goal; stream like today |
   | help | "help", "/start" | Four example lines |
4. **Conversation memory.** Table `chat_threads(key, last_run_id, pending_approval_id, pending_question_id, updated_at)`. Key = hash of the bearer token + the request's `user` field if present, else a hash of the system prompt + the first user message. With one person and one bot this resolves to one thread, which is what the demo needs; the log from step 1 tells us whether OpenClaw sends something better.
5. **Replies for a phone.** ≤ 900 characters, plain text, short bullets, numbers first, a link to the run (`NIMBUS_PUBLIC_URL/?run=…`) at the end. Long docs: the first 6 lines and the link.
6. **Questions in chat.** Instead of auto-answering, when the request came through chat, send the question with numbered options and wait (up to 10 min, then fall back to today's auto-answer and say so).

Exit test (curl, mock): send "run morning brief" → plan line and progress; the approval notice ends with "Reply approve or deny"; send "approve" → the run continues and the final text arrives; "what needs me?" lists waiting runs; "what did the radar find today?" answers without starting a run; every case in `pnpm check:chat` (new).

## Phase B · Nimbus messages you first (builder, mock mode, ~1.5 h)

1. **Notify adapter** `src/runtime/notify.ts`: when a run started by cron, a job or chat reaches `approval.request`, a `question`, or `run.end` while nobody watches the web app, send one Telegram message through the Bot API (`sendMessage`) if `NIMBUS_TELEGRAM_BOT_TOKEN` and `NIMBUS_TELEGRAM_CHAT_ID` are set: "Morning brief needs your OK: send 3 replies. Reply approve or deny." Record the approval as announced in `chat_threads`, so the reply "approve" that arrives through OpenClaw resolves it.
2. Sending only (no polling), so it never competes with OpenClaw, which owns the bot's incoming messages.
3. Mock test with a local stub server standing in for `api.telegram.org` (`NIMBUS_TELEGRAM_API_BASE`).

Exit test: a cron run of Morning brief hits its approval; the stub receives one message with the right text; a curl "approve" resolves it; the web timeline shows `approved via chat`.

## Phase C · OpenClaw for real (the user's steps, guided; mock mode, $0)

1. Install in your own terminal: `npm i -g openclaw@latest`. Run it in the
   foreground for the demo; skip `--install-daemon` (it adds a background
   service to your Mac) unless you want it always on.
2. Add the Nimbus provider from `docs/openclaw.md` with `baseUrl`
   `http://localhost:3241/v1` and model `nimbus` (the builder updates that doc
   to the single-model setup). Test in OpenClaw's local chat first.
3. Create a Telegram bot with @BotFather and connect it in OpenClaw's
   onboarding. You paste the bot token yourself; it never goes in the repo.
   Put the same token and your chat id in `.env.local` as
   `NIMBUS_TELEGRAM_BOT_TOKEN` / `NIMBUS_TELEGRAM_CHAT_ID` for Phase B.
4. With `NIMBUS_V1_LOG=1`, send one message; the builder reads the logged
   request and adjusts Phase A if OpenClaw sends something unexpected.

Exit test, on your phone: "what needs me?" → the list; "run morning brief"
→ progress and the approval request; "approve" → done message; "what did the
radar find today?" → an answer; the same runs appear in the web app tagged
"chat". Then a cron run messages you first and "approve" resolves it.

## Phase D · Hermes Agent, same endpoint (~1 h)

Install Hermes from its official instructions in your terminal; `hermes model`
→ custom OpenAI-compatible endpoint `http://localhost:3241/v1`, model
`nimbus`. Exit test: in the Hermes CLI, "what needs me?" and "run release
watch" work. Hermes on Telegram needs a second bot (one bot cannot be read
by two clients); optional.

## Phase E · Hosted (final day)

Same steps against the Nebius Serverless Endpoint URL with
`NIMBUS_API_TOKEN` set; never expose the endpoint without the token.

## For the video

Record the phone screen (iOS screen recording) during the Phase C exit test:
the morning push, "approve", the answer to "what did the radar find?". This
footage becomes frame 1 and the chat-apps chapter. Nothing in the video
claims more than these exit tests prove.

## Not doing

NemoClaw and OpenShell integration; a Nimbus-owned Telegram poller; group
chats; voice messages.
