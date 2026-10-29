# Nimbus on Telegram (your own bot)

Nimbus reads its own Telegram bot, so your phone talks to the crew with nothing else installed. Approvals and crew
questions arrive as cards with buttons, a run you start from the phone reports as one message edited in place, and every
decision shows up on the web timeline as `via telegram`. OpenClaw and Hermes keep working through `/v1`
(`docs/openclaw.md`); this is a second door, not a replacement. Design: `docs/ROADMAP.md` section 2.

## Setup (5 minutes)

1. **Create the bot.** In Telegram, open @BotFather, send `/newbot`, pick a name and a username. BotFather replies with
   the bot token. Keep it out of the repo, out of chat messages and out of screenshots.
2. **Give Nimbus the token.** Locally, in `.env.local` (gitignored):

   ```
   NIMBUS_TELEGRAM_BOT_TOKEN=<the token from BotFather>
   NIMBUS_PUBLIC_URL=https://<your deploy>   # links in messages must open on a phone, not localhost
   ```

   On Railway, set the same `NIMBUS_TELEGRAM_BOT_TOKEN` (and `NIMBUS_PUBLIC_URL`) as service variables and redeploy.
3. **Learn your chat id.** Start the server (`pnpm dev`, or the deploy), open your bot in Telegram and send `/start`.
   The bot answers that it is not paired yet, and the server log prints one line:

   ```
   [nimbus] telegram: /start from chat 123456789. Set NIMBUS_TELEGRAM_CHAT_ID=123456789 to pair the bot with this chat.
   ```

4. **Pair it.** Set `NIMBUS_TELEGRAM_CHAT_ID=123456789` next to the token (`.env.local`, or Railway), restart. Send
   `/status`: the bot answers with what is running or waiting.

## Using it

| You send | What happens |
|---|---|
| `/run morning brief` or `run morning brief` | Starts the workstream (trigger `telegram`). One progress message, edited every 3 s: the run state, the running cost and one line per lane. When it ends: the first six lines of the result and the link to the run. |
| `/status`, `what needs me?` | Waiting and running runs, one line each, with links |
| `what did the radar find today?` | Answered from the workstream's latest document and memories; no new run |
| `/help` | Example lines |
| Tap **Approve** | Approves; the card is edited to show the decision and its buttons go |
| Tap **Always allow** | Approves and saves the rule in the workstream's SKILL.md, so the next run does not ask |
| Tap **Reject** | The card asks for one line of note; send it, or `/skip` for none |
| Tap an option on a crew question | Posts that answer to the asking lane |
| `approve`, `deny: too long`, `2` | Typed replies still work, through the same intent router as `/v1` |

Cards also arrive without you sending anything: a scheduled run that needs your OK or asks a question pushes its card,
and its result arrives when it ends. A run you started in the web app stays quiet.

Replies follow the chat endpoint's rules: plain text, numbers first, at most 900 characters.

## Variables

| Variable | Meaning |
|---|---|
| `NIMBUS_TELEGRAM_BOT_TOKEN` | Your bot's token. Set alone, the bot runs but only pairs (step 3). |
| `NIMBUS_TELEGRAM_CHAT_ID` | The one chat Nimbus serves. Any other chat gets one line: "This Nimbus is private. Run your own: github.com/harrymove-ctrl/nimbus". |
| `NIMBUS_TELEGRAM_MODE` | `poll` (default): Nimbus reads the bot's updates, pushes carry buttons. `off`: another client (OpenClaw) owns the bot; Nimbus only sends plain-text pushes and replies arrive through `/v1`. |
| `NIMBUS_PUBLIC_URL` | Base of the run links in messages. |
| `NIMBUS_TELEGRAM_API_BASE` | Tests only: a local stub standing in for `https://api.telegram.org`. |

## How it works

- `src/runtime/telegram.ts` long-polls `getUpdates` (25 s) from the server process, started next to the scheduler in
  `src/instrumentation.ts`. Text goes through `handleChat` in `src/runtime/chat.ts` (rules first, then the Nano
  classifier); taps call `resolveApproval` and `postMessage` on the run, the same calls the API routes make.
- `src/runtime/notify.ts` pushes the cards and edits them when the decision lands, wherever it came from (a tap, a typed
  reply, the web app).
- **One poller per database.** The `telegram_poller` row holds the polling process, its heartbeat and the next update
  offset. A second dev server, or the old container during a deploy, sees a live heartbeat and stands by; it takes over
  about a minute after the holder stops. The offset is saved before each update is handled, so a crash skips an update
  rather than approving twice.
- The token only ever appears in the request path; log lines carry the HTTP status and Telegram's description, never the URL.
- Fetch only, no new dependency.

## Troubleshooting

- **The bot never answers.** Check the server log for `[nimbus] telegram: reading the bot's updates`. If you see
  `getUpdates failed: HTTP 409`, a webhook is set on the bot or another client (OpenClaw, a second deploy on another
  database) reads it. Remove the webhook with `deleteWebhook` from a terminal, or set `NIMBUS_TELEGRAM_MODE=off` where
  the other client should win.
- **`another server is reading this bot's updates; standing by`.** Two processes share the database; the first one
  polls. Normal during a deploy overlap.
- **A tap says "That run is no longer running".** Runs live in the server process; after a restart, cards from the
  old process cannot be resolved. Open the link on the card instead.
- **Links open localhost.** Set `NIMBUS_PUBLIC_URL`.

## Test

`pnpm check:telegram` runs the bot in mock mode against a local stub of the Bot API ($0, about 10 s): privacy and
pairing, `/run morning brief` with one edited progress message, the three-button cards, Approve, Always allow, Reject
with a note and with `/skip`, a crew question answered by button, a scheduled run that pushes its card unasked, `/status`,
the one-poller lock and that no log line carries the token.
