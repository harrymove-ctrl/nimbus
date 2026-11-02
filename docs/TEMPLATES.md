# Crews and templates

A workstream is a goal, a schedule, the tools it may use, a SKILL.md it learns into, and since this change its own
**crew**: the roles the Orchestrator plans with. A **template** is all of that in one YAML file under `templates/`,
ready to start from the New workstream sheet, the API or the terminal.

## The crew

`roles` on a workstream is a list of roles. Each has:

| Field | What it does |
| :--- | :--- |
| `role` | The lane name, lowercase (`tutor`, `quiz-master`). The timeline shows it as "Tutor", "Quiz master". `orchestrator` is reserved: it leads every crew. |
| `brief` | What the role does. Its system prompt is "You are the Tutor. " followed by the brief (plus the sign-off line when it can `send_message`). |
| `tier` | The ceiling for its model: `ultra`, `super` or `nano` (Nemotron 3 Ultra, Super, Nano). The router may still pick a cheaper tier per hop, never a dearer one. |
| `tools` | Optional. The worker tools it may call: `web_search`, `fetch_url`, `run_code`, `write_artifact`, `send_message`, `read_repo`, `open_pr`, `ask_user`. Left out, it gets every tool the workstream allows. The workstream's own tool list still filters this. |

The Orchestrator gets the crew's names in its `plan`, `spawn_agents` and `handoff` tools, and a short list of the
roles and their briefs in its first message, so it plans with a tutor and a quizmaster instead of a researcher. The
**learner** is a role like the others: keep it and every finished run saves memories and rewrites SKILL.md; drop it and
nothing is learned. At most 8 roles, and at least one besides the learner.

Every workstream from before crews has the **default five** (researcher, analyst, writer, checker, learner). Their
briefs are the prompts Nimbus always used, rebuilt byte for byte, so runs, goldens and the response cache behave
exactly as before.

Change a crew in the New workstream sheet (the Crew chips), with `PATCH /api/workstreams/<id> { "roles": [...] }`, or
by importing a file.

## A template file

```yaml
# Nimbus template: Study coach.
title: Study coach
goal: "Every Monday evening: apply last week's grades from review-log.csv to flashcards.csv with spaced repetition (SM-2), ..."
schedule: mondays 19:00
tools:
  - run_code
  - write_artifact
roles:
  - role: tutor
    tier: super
    tools: [run_code, write_artifact]
    brief: >
      Use run_code on flashcards.csv and review-log.csv. Apply each grade with SM-2 ...
  - role: quizmaster
    tier: super
    tools: [write_artifact]
    brief: From the Tutor's weakest cards, write a 10-question quiz with write_artifact.
  - role: learner
    tier: nano
    brief: From the run summary, call save_learning once with at most 8 durable memories and the rewritten SKILL.md (keep its structure).
skill: |
  ## Study coach
  1. At most 15 reviews a day; Sunday is a rest day.

  ## Policy
  (none yet)
attachments:
  - ../fixtures/templates/study-coach/flashcards.csv
  - ../fixtures/templates/study-coach/review-log.csv
order: 2
```

| Key | Notes |
| :--- | :--- |
| `title`, `goal`, `tools` | Required. Same as `nimbus ws import`. |
| `schedule` | `daily HH:MM`, `weekdays HH:MM`, `mondays HH:MM`, or a five-field cron line. Leave it out to run by hand. |
| `roles` | The crew, as above. Left out: the default five. |
| `skill` | The SKILL.md the first run starts from. Write the person's rules here so run 1 already follows them. A `## Policy` section is added when missing (approved "always allow" rules land there). |
| `attachments` | Small text files (CSV, TXT), paths relative to the YAML file, at most 8 of 512 KB each. They are stored with the workstream and copied into every run's workspace, where `run_code` reads them. |
| `order` | Position in the gallery, lower first. |

The format is the one `nimbus ws export` writes and `nimbus ws import` reads: `key: value` lines, `- item` lists,
`[a, b]` lists, a list of maps for `roles`, and `|` (lines kept) or `>` (folded) blocks. No other nesting.

## The templates in this repo

| File | Crew | Schedule | Files |
| :--- | :--- | :--- | :--- |
| `job-hunt-radar.yaml` | scout, screener, writer, learner | daily 07:30 | none (criteria and the already-applied list live in SKILL.md) |
| `study-coach.yaml` | tutor, quizmaster, checker, learner | mondays 19:00 | `flashcards.csv`, `review-log.csv` |
| `household-ops.yaml` | planner, accountant, writer, learner | mondays 07:30 | `bills.csv`, `calendar.txt` |
| `morning-brief.yaml`, `hackathon-radar.yaml`, `ship-nimbus.yaml`, `cost-audit.yaml`, `release-watch.yaml`, `checkout-drop.yaml` | the default five | as seeded | `checkout-drop` names `data.csv` |

The last six are the seeded workstreams written out (same title, goal, schedule, tools and SKILL.md); `pnpm
check:templates` fails if they drift from `src/lib/workstreams.ts`. Household ops sends to `family-chat` with
`send_message`, which always asks for approval first. The twelve below sit between the personal three and the seeded
six in the gallery (`order: 3.01` to `3.12`).

## From real use cases

Twelve templates come from [agentusecases.ai](https://agentusecases.ai), a catalogue of things people actually do with
agents, each with the prompt they used and how it went. Each file's first line names its source (`# Source: "<title>",
<url>`), its goal is the person's prompt in the first person with the blanks filled in, and its SKILL.md seed holds
the person's rules ("ask before cancelling", "Sunday is family day"). Every one runs with Nimbus's own tools and the
sample files next to it: no inbox, bank or store logins. Inbox-like inputs are attached CSV or text files, invented and
under 15 KB each. Anything that leaves Nimbus (a message, a claim, a cancellation, a cold email) goes through
`send_message`, which waits for approval.

| Template | Source use case | What a run produces | Tools | Schedule | Sample files |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `school-email-digest` | [Summarize school emails for parents](https://agentusecases.ai/use-case/summarize-school-emails-for-parents) | What to pack, wear, sign or pay per kid for tomorrow and the week, deadlines on top, drafts for emails missing information, an 8 line note to `parents-chat` | run_code, write_artifact, send_message | daily 19:30 | `school-emails.csv` (15 emails, two schools, one fee correction, one blank "form attached") |
| `price-drop-watch` | [Watch item prices and email on drops](https://agentusecases.ai/use-case/watch-item-prices-and-email-on-drops) | Today's price at two real product pages (Raspberry Pi 5 8GB at Adafruit and PiShop.us), the change against the history, the updated history CSV, a message only on a drop over 10% | fetch_url, run_code, write_artifact, send_message | daily 08:00 | `price-history.csv` (8 weeks, invented) |
| `subscription-renewals` | [Track subscriptions and renewals from Gmail](https://agentusecases.ai/use-case/track-subscriptions-and-renewals-from-gmail) | Every subscription with next renewal date, cost, monthly and yearly totals and flags (unused, price rise, trial turned paid); asks which to cancel and sends cancellation emails only for the ones picked | run_code, write_artifact, send_message (plus ask_user on the Writer) | mondays 08:00 | `renewal-emails.csv` (22 emails over 12 months) |
| `lease-review` | [Flag risks in a 50-page contract before signing](https://agentusecases.ai/use-case/flag-risks-in-a-50-page-contract-before-signing) | Every risky clause with its number, quote, plain English and what to ask instead; the three points to push back on hardest; notice deadlines; not legal advice | run_code, web_search, write_artifact | on demand | `lease.txt` (5 pages, 27 sections; auto-renewal near the end, one-sided liability and indemnity, relocation) |
| `flight-delay-claim` | [Claim refunds for delayed or cancelled flights with Claude](https://agentusecases.ai/use-case/claim-refunds-for-delayed-or-cancelled-flights-with-claude) | The EU261 rule with article numbers and primary source links, the distance band and amount for two passengers, a claim email with a 14 day deadline and the documents to attach, sent after approval | run_code, web_search, fetch_url, write_artifact, send_message | on demand | `flight.txt` (Lisbon to Amsterdam, 4 h 12 min late, technical fault) |
| `spending-summary` | [Consolidate bank statements into a spending dashboard with Claude](https://agentusecases.ai/use-case/consolidate-bank-statements-into-a-spending-dashboard-with-c) | Every transaction categorized (card payments not double counted), spending by category and month, savings rate, three observations, three ways to cut with dollars a month | run_code, write_artifact | mondays 07:00 | `transactions.csv` (187 rows, August to October 2026) |
| `macro-morning-brief` | [Monitor investing news and produce morning macro summaries](https://agentusecases.ai/use-case/monitor-investing-news-and-produce-morning-macro-summaries) | One brief: what matters today, watchlist news by ticker, the macro numbers and the 7 day calendar, every item with a link and date; no trades or advice | run_code, web_search, fetch_url, write_artifact | weekdays 07:00 | `watchlist.txt` (9 tickers, macro items) |
| `fridge-meal-plan` | [Order family groceries from fridge contents](https://agentusecases.ai/use-case/order-family-groceries-from-fridge-contents) | Seven dinners for four that use what expires first, within the family's rules, and a shopping list by store section with quantities | run_code, write_artifact | mondays 17:30 | `pantry.csv` (36 items with use-by dates) |
| `home-maintenance` | [Track home maintenance from receipts and inspection reports](https://agentusecases.ai/use-case/track-home-maintenance-from-receipts-and-inspection-reports) | What is overdue and due this month by system, with timing and the source line; quote requests to vendors for the top 2 tasks, sent after approval | run_code, write_artifact, send_message | mondays 08:30 | `home-log.csv` (22 jobs, receipts, inspection notes, warranties) |
| `local-leads` | [Find local business leads and send personalized cold emails](https://agentusecases.ai/use-case/find-local-business-leads-and-send-personalized-cold-emails) | A 1 to 10 score and reasoning per business against the ideal customer profile, three openers (intro, follow-up, final) per qualified lead, intros to the top 3 sent after approval | run_code, write_artifact, send_message | mondays 09:00 | `leads.csv` (14 local businesses) |
| `tax-deductions` | [Compile deductions and Schedule C with Claude Code](https://agentusecases.ai/use-case/compile-deductions-and-schedule-c-with-claude-code) | Every receipt in a Schedule C or itemized category with a confidence, totals, the receipts missing proof, the IRS rules used with links, open questions; not tax advice | run_code, web_search, fetch_url, write_artifact | mondays 10:00 | `receipts.csv` (107 receipts, 2026 so far) |
| `arxiv-triage` | [Automate a weekly arXiv paper triage](https://agentusecases.ai/use-case/automate-a-weekly-arxiv-paper-triage) | New cs.AI and cs.CL papers on my topics labelled keep, skim, drop, duplicate, outside scope or weak method, the log updated without losing a row, and the keep list | fetch_url, web_search, run_code, write_artifact | mondays 08:00 | `papers-log.csv` (12 earlier entries) |

What had to change from the original, and why:

1. **Inboxes, banks and stores become files.** Gmail searches (school emails, renewals, receipts), bank exports, a
   fridge camera, Google Maps scraping and Apollo enrichment have no Nimbus tool, so their output arrives as an
   attached CSV or text file with the columns those sources give.
2. **Sending waits for approval.** Where the person sent the email themselves, or an n8n flow sent it, Nimbus drafts it
   and `send_message` asks first. Nothing is bought, paid, filed or traded.
3. **The flight claim is EU261.** The source was a US flight under US DOT refund rules; the sample flight leaves Lisbon,
   so EU Regulation 261/2004 sets a fixed compensation and the researcher must cite the regulation and the case law.
4. **The macro brief has no X or podcasts.** It reads the news and official sources through `web_search` and
   `fetch_url` instead.
5. **Weekly instead of monthly.** The template schedule takes `daily`, `weekdays` or `mondays HH:MM` through the API and
   the New workstream sheet (a cron line is dropped there today), so the spending summary and home maintenance run on
   Mondays. A contract review and a flight claim run on demand.
6. **Prices from two real pages.** The price watch uses two pages that serve their price to a plain fetch; the history
   file is invented, with the PiShop.us line last at $199.95, so a first run at today's price shows the alert path.
7. **Text, not PDF.** The lease is a text file because `run_code` reads text; it is about 14,000 characters, and the
   Reviewer prints it in three parts because a run's output is cut at 8,000 characters.

Replace a sample file with your own (same columns) before the first real run; the SKILL.md seed is where the
person's names, rules and limits go.

## Start one

- **The app:** "+ New workstream", pick a card under "Start from a template", change anything, Create.
- **The API:** `POST /api/workstreams { "template": "study-coach" }`. Fields sent beside `template` (title, goal,
  schedule, tools, roles) override the file. `GET /api/templates` lists them.
- **The terminal:** `pnpm nimbus ws import templates/study-coach.yaml`. The CLI reads the attachments next to the file
  and sends their contents, so this works against a deployed Nimbus too.

## Share one

1. `pnpm nimbus ws export "study coach" my-coach.yaml` writes the workstream as it stands today: its crew and its
   current SKILL.md (what it learned travels with it). Files stay on the server; add an `attachments:` list pointing
   at copies next to the YAML if the other person needs them.
2. Send the YAML (and the files). Anyone with a Nimbus imports it with `nimbus ws import my-coach.yaml`.
3. To add it to this repo's gallery, put it under `templates/`, sample files under `fixtures/templates/<slug>/`, and
   run `pnpm check:templates`: every template must import through the API and through `nimbus ws import`.

## Mock mode

`NIMBUS_MODEL=mock` plays scripted turns. A workstream made from a template gets the id `ws-u-<template>-<hex>`, so the
mock finds `fixtures/mock-model/tpl-<template>/` (Study coach has one: SM-2 really runs on the sample deck). A crew with
no script still runs: the Orchestrator plans its roles, runs them side by side and finishes, and each role reports one
line.

## Test

`pnpm check:templates` (mock, $0, about 12 s): an old database gets the default crew; the default crew's prompts and
tools are exactly the old ones; all twenty-one templates start through the API and through `nimbus ws import` with
their crew, SKILL.md and files; the twelve from real use cases each name their source on the first line, keep the goal
under the API's 600 characters, have 3 or 4 roles with no Ultra and files under 100 KB, and each runs unscripted with a
lane per role; bad crews are refused with a reason; a Study coach run from `nimbus run` has Tutor, Quizmaster and
Checker lanes, runs SM-2 on the attached deck and writes the quiz; Job hunt radar runs unscripted; Checkout still has
its five lanes; `ws export` then `import` carries the crew and the SKILL.md.
