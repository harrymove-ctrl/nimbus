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
`send_message`, which always asks for approval first.

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

`pnpm check:templates` (mock, $0, about 3 s): an old database gets the default crew; the default crew's prompts and
tools are exactly the old ones; all nine templates start through the API and through `nimbus ws import` with their
crew, SKILL.md and files; bad crews are refused with a reason; a Study coach run from `nimbus run` has Tutor,
Quizmaster and Checker lanes, runs SM-2 on the attached deck and writes the quiz; Job hunt radar runs unscripted;
Checkout still has its five lanes; `ws export` then `import` carries the crew and the SKILL.md.
