# Conversation: what agentusecases.ai teaches Nimbus

Written 2026-11-02 by the planner after reading agentusecases.ai (1,793 real use cases, each with its source, the
prompt and a "how it went" note; read: the front page, Money and Bills, Life Admin and Home). The question was how
those use cases make talking to Nimbus better. This is a plan, not built yet.

**Timing.** The hackathon deadline passed on Oct 31 and judging runs Dec 1 to Dec 15. Production
(nimbus-production-6f7b.up.railway.app) should stay on the submitted build until judging ends, so everything here is
built on a branch and shown on a separate Railway environment, then promoted after Dec 15.

## What the use cases say about conversation

Five patterns repeat across the catalogue, and the "how it went" notes are as useful as the wins.

| Pattern | Evidence on the site | What it means for a conversation |
|---|---|---|
| **The chat is the door** | OpenClaw managing Gmail and Calendar from Telegram; Hermes checking in a flight and chasing a refund over Telegram; an eight-agent n8n assistant "controlled via Telegram by voice or text"; Lindy over iMessage | People do not open a dashboard for life admin. They send one line from their phone and expect the agent to know the rest. |
| **Interview first, then act** | "interview them on goals, and dispatch sub-agents" (Claude Code financial plan); a visa form filled "with a voice-call flow asking for needed details" | A vague request should become two or three questions, not a guessed plan and not a long form. |
| **Teach once, run forever** | a 4-minute memecoin check taught once and run 3,140 times overnight with 160 alerts; hotel prices "monitored daily, alert on drops"; school emails summarized nightly ("what to pack, wear, sign or pay") | The best conversation ends with "do this every morning and only tell me when X". |
| **Ask before the side effect** | "ask before unsubscribing" (ChatGPT Agent), "email sent for approval" (Grok Bot invites), "with user review before sending" (bill negotiation); and the failures: Dots "sometimes acted without approval", Lindy "unsent emails", Cowork "a rollback failed" | Nimbus's approval cards are the right core. The gap is saying clearly what was done, what was not, and what still needs the person. |
| **A second agent that can say no** | an 11-agent trading team where "a Red Team agent must approve a trade first"; Playwright filling forms "had it screenshot and verify fields"; a contract review that caught an auto-renewal clause | A checker that can block, and a "check this before I approve" move in the chat. |

## Where Nimbus's conversation stands

- **Composer:** goal text, three starter chips (Fix what's failing, Watch, Brief me every morning), slash commands
  (`/run`, `/new`, `/schedule`, `/stop`, `/approve`, `/skill`, `/memory`), steering while a run is live.
- **Chat endpoint and Telegram:** one intent per message (run, approve, deny, answer, status, ask, help), phone-length
  replies, approval and question cards with buttons on Telegram.
- **Memory:** the Learner saves memories and rewrites SKILL.md after each run; a mock check on Checkout showed run 2
  starting with run 1's memories.
- **Gaps:** a vague goal goes straight to a plan; once a run ends, a new message starts a new run instead of refining
  the result; nothing turns a good one-off run into a standing workstream from the chat; there is no "only tell me
  when"; the run summary does not say plainly what was not done; Telegram cannot take a voice note.

## C0 · A Conversations inbox (added after the user asked "where do I see more conversations?")

Today every conversation is the transcript of one run, in the centre column under the timeline. To see another you
pick a workstream in the rail, then a run in the header's runs picker. Production holds 27 runs (16 started by hand,
10 by schedule, 1 from chat), and Telegram and OpenClaw threads are stored in `chat_threads` but shown nowhere. There
is no single list of conversations, which is what every chat product on the use-case site gives its users.

**Build:** an **Inbox** entry at the top of the rail, above Overview. It lists every conversation across workstreams
and doors, newest first: one row per run (or per follow-up chain once C2 lands) with the door icon (web, Telegram,
chat API, terminal, schedule), the workstream, the first line of what was asked, the last message, the cost, and a
state chip: **Needs you** (open approval or question, pinned to the top), **Running**, **Done**, **Quiet** (a C4 run
with nothing to report). Filters: Needs you, Scheduled, From my phone, All. A search box over goals, messages and
artifact titles. Selecting a row opens that run's conversation in the centre column with the timeline collapsed, so
the chat gets the space. Empty state: the five starter prompts from the catalogue as cards.
Files: `GET /api/conversations` (runs joined with workstreams and the latest message, chat threads for the door),
`src/components/nimbus/inbox.tsx`, one rail entry in `app-shell.tsx`. Exit test: on staging the inbox shows all runs
with the right doors and states, a Telegram-started run carries the phone icon, and a run waiting on an approval sits
at the top until approved.

## The plan: seven changes, in order of value

Each change names its files and a real exit test. Mock mode (`NIMBUS_MODEL=mock`) for the build, one real run each
on the staging environment for proof.

### C1 · Intake: two or three questions before a vague plan

When a goal is short or misses one of **what**, **from where**, **how often**, **what counts as done**, **what needs
my OK**, the Orchestrator asks up to three numbered questions in one card before it plans (the existing `ask_user`
tool, given a new "intake" step in the orchestrator prompt and a Nano check of the goal for the five slots). Answers
are saved as memories, so the next run does not ask again. On Telegram the questions arrive as one message with
numbered options.
Files: `src/runtime/orchestrator.ts`, `src/runtime/chat.ts`, a slot-check prompt in `src/lib/models.ts` routing to
Nano. Exit test: "watch hotel prices for my Tokyo trip" asks dates, the hotel or area, and the drop that matters;
"run morning brief" asks nothing.

### C2 · Follow-ups on a finished run

After a run ends, a message in its composer is a **follow-up**, not a new run: "make it shorter", "add the calendar
for Thursday", "why did you skip the third email?". The Orchestrator answers from the run's events and artifacts, and
if the request needs work, starts a small continuation run linked to the first (`parentRunId`), which writes
version 2 of the same artifact. The composer shows "Follow up on this run" with a "Start fresh" link.
Files: `src/app/api/runs/[id]/messages/route.ts` (accept after end), `src/runtime/live.ts` (continuation),
`src/db/schema.ts` (`parent_run_id`), composer copy. Exit test: on a finished Morning brief, "shorter, top three
only" produces artifact v2 within one run of under $0.01, and the runs picker shows it under the first run.

### C3 · "Do this every morning", from the chat

At the end of any one-off run started from chat or Telegram, Nimbus offers one line: "Run this every weekday at 08:00?"
with Yes, a time, or No. Yes saves the goal, the crew, the attachments and the schedule as a workstream (the template
code path). From the composer, `/every weekday 8am` does the same.
Files: `src/runtime/chat.ts` (new intent "schedule"), `src/runtime/telegram.ts` (buttons), the summary card.
Exit test: from Telegram, "check the price of the Sony WH-1000XM6 on these two shops" then "every day at 9" creates a
scheduled workstream that appears in the rail with its clock.

### C4 · "Only tell me when": conditions on a standing workstream

A workstream can carry a **condition** in plain words ("only if the price drops more than 10 %", "only if something
needs me today"). The Checker evaluates it against the run's result; when it is false the run ends quietly, records
"nothing to report" and sends no push; when true, the push leads with why. Conditions are lines in SKILL.md under
`## Tell me when`, so the person can read and edit them, and the Learner may propose one ("You approved nothing on
the last five quiet days. Only message you when something needs you?").
Files: `src/runtime/orchestrator.ts` (end gate), `src/runtime/notify.ts` and `telegram.ts` (quiet runs), SKILL.md
parsing in `src/runtime/skills.ts`. Exit test: a price watch with a 10 % condition sends nothing on an unchanged
price and one push with the delta when the fixture price drops.

### C5 · An honest result: done, not done, needs you

The summary card and the Telegram end message gain three short lists before the artifact: **Done** (each side effect,
with its approval), **Not done** (anything planned that failed, was rejected or skipped, with the reason), **Needs
you** (open questions, drafts waiting, a CAPTCHA or a login the crew cannot do). Built from the run's events, not
from the model's words, so it cannot claim a send that did not happen.
Files: `src/lib/run-view.ts` (derive the lists), `src/components/nimbus/transcript.tsx` summary card (coordinate: that
file had uncommitted edits by another agent), `src/runtime/chat-util.ts`. Exit test: the Checkout run with one
rejected approval shows it under Not done with the note; Telegram's end message carries the same three lists.

### C6 · "Check this first": a second opinion before approving

On any approval card, a third button **Check first** asks the Checker (Nano, then Super if it finds a problem) to review
the proposed action against the workstream's rules, the attached data and the goal, and answers in the card in two
lines before the person decides. A workstream can make the check mandatory for a tool (`send_message`, `open_pr`),
which is the Red Team pattern.
Files: `src/runtime/live.ts` (check request on an approval), `src/runtime/agent.ts` (checker hop), the approval card and
Telegram buttons. Exit test: "Check first" on the Checkout #growth message flags a number that does not match
`data.csv` in a seeded mismatch fixture and passes on the real one.

### C7 · Voice notes on Telegram

A voice note is transcribed and goes through the same intents. Transcription runs on a Nebius-hosted Whisper-class
model if Token Factory serves one; otherwise this item waits (no other providers, per the model rule in CLAUDE.md).
Files: `src/runtime/telegram.ts` (`voice` updates, `getFile`). Exit test: a 5 second "what needs me" voice note gets
the status reply.

## Starter prompts from the catalogue

The composer's three chips and the template gallery should speak the way people on the site do. Proposed set, each
mapped to tools Nimbus has today (Lane 2 items need the person's own MCP servers for real sends):

| Chip | Goal text | Tools | From the site |
|---|---|---|---|
| School emails tonight | "Every evening read the school emails and tell me what to pack, wear, sign or pay tomorrow, with deadlines." | fetch_url, write_artifact | Grok Bot school email summary |
| Price watch | "Check these pages every morning and only tell me if the price drops more than 10 %." | fetch_url, run_code | hotel price drops, apartment watcher |
| Renewals and subscriptions | "Find renewal emails, list service, date and cost, and ask me before cancelling anything." | read files, write_artifact, send_message | ChatGPT Agent subscriptions |
| Contract check | "Read this contract and flag auto-renewals, liability and anything unusual before I sign." | run_code, write_artifact | the 50-page contract review |
| Refund claim | "Gather the facts on my delayed flight, check the rules, and draft the claim for my OK." | web_search, fetch_url, write_artifact | flight refund and EU261 disputes |

## Order, owners, effort

| # | Change | Effort | Builder |
|---|---|---|---|
| 0 | C0 conversations inbox | 4 h | Opus session, worktree |
| 1 | C5 honest result | 3 h | Sonnet session, worktree |
| 2 | C2 follow-ups | 4 h | Opus session, worktree |
| 3 | C1 intake | 3 h | Opus session (same as C2, shares the orchestrator) |
| 4 | C3 every morning from chat | 2 h | Sonnet session (Telegram code) |
| 5 | C4 only tell me when | 4 h | Opus session |
| 6 | C6 check first | 3 h | Sonnet session |
| 7 | Starter chips and two templates | 1 h | planner |
| 8 | C7 voice | blocked until a Nebius speech model is confirmed | planner checks the catalogue |

Each lands on a branch with `pnpm demo`, `pnpm eval` and its own check green, is merged into an integration branch,
and is deployed to the Railway **staging** environment. Production is promoted after judging ends on Dec 15.
