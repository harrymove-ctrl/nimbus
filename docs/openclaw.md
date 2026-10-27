# Nimbus inside your chat apps (OpenClaw, Hermes)

Nimbus exposes an OpenAI-compatible endpoint, so any chat gateway with a custom-provider setting can use it.
There is no bridge code: the gateway sends chat completions and Nimbus works out what each message means.
The plan and the phases are in `docs/CHAT-APPS.md`; this page is the setup.

| | |
|---|---|
| Endpoint | `POST /v1/chat/completions` (streaming and non-streaming), `GET /v1/models` |
| Auth | `Authorization: Bearer $NIMBUS_API_TOKEN`. If the variable is empty the endpoint is open in dev and closed in production. |
| Model | **`nimbus`**: one model, a conversation. The last user message is routed to one of seven intents (below). The per-workstream ids `nimbus/<slug>` still exist and always start that workstream with the message as its goal. |
| Reply | Plain text for a phone: at most 900 characters, numbers first, ending with a link to the run (`NIMBUS_PUBLIC_URL/?run=…`). |
| Conversation | `chat_threads` keeps the pending approval or question per conversation (key: the token plus the request's `user` field, else a hash of the system prompt plus the first user message). |

## What you can say

| Intent | Examples | What happens |
|---|---|---|
| run | "run morning brief", "check the repo" | Starts the matching workstream with your message as the goal; the reply streams a plan line and stops at the first approval or question |
| approve | "approve", "yes", "ok send it", "approve all" | Resolves the approval Nimbus announced to you; the run continues and the reply carries what happens next |
| deny | "no", "deny: too long" | Rejects it; the text after the colon is the note the crew sees |
| answer | "1", "Router", any text while a question waits | Answers the crew's question (numbered options come with it). Unanswered for 10 minutes, the crew picks the last option as before and the run says so |
| status | "what's running?", "what needs me?" | Waiting and running runs, one line each, with links |
| ask | "what did the radar find today?" | Answers from that workstream's latest document and its memories. No new run |
| help | "help", "/start" | Four example lines |

Rules decide first; only a message no rule recognises goes to the cached Nano classifier. In mock mode there is no
model to call: the classifier step falls back to "ask" (or "run" when the message names a workstream).

## Nimbus messages you first (Telegram, send only)

When a run started by cron, a job or chat reaches an approval, asks a question, or ends while nobody has it open in the web
app, Nimbus sends one Telegram message through the Bot API (`sendMessage`). It never polls, so it does not compete with
OpenClaw, which owns the bot's incoming messages. Several approvals that arrive together (Morning brief: three replies) go
out as one message. The pushed approval or question is recorded in `chat_threads`, so a plain "approve" or "2" that arrives
through OpenClaw resolves it, and the web timeline shows "Approved via chat".

Set `NIMBUS_TELEGRAM_BOT_TOKEN` and `NIMBUS_TELEGRAM_CHAT_ID` in `.env.local` (never in the repo). Without them nothing is sent.

## Status: what has and has not been tested

- **Tested in mock mode** (`pnpm check:chat`, 62 checks, no server, no network, a local stub for `api.telegram.org`): every
  intent, roles and content parts, ignored `tools` / `tool_choice` / `response_format`, the SSE framing with `include_usage`,
  the 10 s heartbeat, the request log without credentials, questions in chat with the timeout fallback, the Telegram push
  and the "approve" that resolves it.
- **Not tested** against a real OpenClaw or Hermes install, a real Telegram bot, or the real Token Factory models (the mock
  model is the default until `NEBIUS_API_KEY` is set). Run once with `NIMBUS_V1_LOG=1`: it writes each request body to
  `data/v1-log/<time>.json` (authorization header removed) so we see exactly what a client sends before trusting this.
- The `${NIMBUS_API_TOKEN}` substitution and the config keys below are from OpenClaw's docs and have not been checked on an install.

## OpenClaw (`~/.openclaw/openclaw.json`)

One model:

```json
{ "models": { "mode": "merge", "providers": { "nimbus": {
  "baseUrl": "http://localhost:3241/v1", "apiKey": "${NIMBUS_API_TOKEN}",
  "api": "openai-completions",
  "models": [
    { "id": "nimbus", "name": "Nimbus", "input": ["text"], "contextWindow": 256000, "maxTokens": 8192 }
  ] } } } }
```

Use the Nimbus host instead of `localhost:3241` once it is deployed, and keep `NIMBUS_API_TOKEN` set there. Select the
model `nimbus/nimbus` (provider/model) in OpenClaw and try it in its local chat first, then connect the Telegram bot in
OpenClaw's onboarding. Run OpenClaw in the foreground for the demo; it needs no background service for this.

## Hermes Agent

Install Hermes from its official instructions, then:

```bash
hermes model
```

Choose the custom OpenAI-compatible endpoint, base URL `http://localhost:3241/v1`, model `nimbus`, and the key from
`NIMBUS_API_TOKEN` (any non-empty value when the token is unset in dev). Then "what needs me?" and "run release watch"
work in the Hermes CLI. One Telegram bot cannot be read by two clients: Hermes on Telegram needs its own bot.

## Try it with curl

```bash
pnpm dev                      # mock model, no keys
curl -s localhost:3241/v1/chat/completions -H 'content-type: application/json' \
  -d '{"model":"nimbus","user":"me","messages":[{"role":"user","content":"run morning brief"}]}'
curl -s localhost:3241/v1/chat/completions -H 'content-type: application/json' \
  -d '{"model":"nimbus","user":"me","messages":[{"role":"user","content":"approve all"}]}'
```

Add `"stream":true,"stream_options":{"include_usage":true}` to see the SSE stream. Use the same `user` value on every
call: it is what ties "approve" to the approval the first call announced.
