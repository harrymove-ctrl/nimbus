# Workstream cases: what Nimbus runs in the demo and in the seed

Written 2026-10-27 night after the user's review: "checkout conversion" is a
generic analytics example and does not show what is special about Nimbus.
These cases do. Each is a real standing goal with stakes, uses several tools,
hits at least one approval, and leaves something the next run reuses.

Judging criteria to hit with the cases: Quality of the Idea (a crew that
maintains its own product), Technological Implementation (real tool runs,
router, evals), Potential Impact (personal ops people actually have), Design
(every case has a visible payoff on the timeline and in the Inspector).

## The hero: "Ship Nimbus" — the crew works on its own repository

**Goal.** "Keep Nimbus shipping: run the evals, find what fails, fix it, and
open a pull request for me to review."

**Why it is the hero.** An AI product whose crew maintains itself, with the
human gate exactly where it matters (before the PR), is a story in one
sentence. It also lands in two tracks at once (Personal AI and Coding &
Agentic Engineering) and shows every mechanism: concurrency, a failed tool
call and recovery, a real subprocess (`pnpm eval`), a code artifact with
versions, an approval that writes a policy, and a learned rule on run two.

**Tools.** `run_code` (really runs `pnpm eval --only <golden>` and
`pnpm typecheck`, even in mock mode), `read_repo` (new: read files and
`git diff`), `write_artifact` (kind: code, a unified diff), `open_pr` (new,
approval-gated: creates a branch, commits the patch, opens a PR through
`gh`; in mock mode it logs the PR body and returns a fake URL), `web_search`
only if a dependency changelog is needed.

**The run, beat by beat (fixture `fixtures/mock-model/ship-nimbus/`).**
1. Plan card: Researcher reads `evals/report.json` and the last CI run;
   Analyst reproduces the failing golden; Checker verifies the fix; Writer
   prepares the patch and the PR text. Estimate ≈ $0.09.
2. Researcher lane: finds golden `router-fallback-404` failing: "fallback
   skips the ceiling check". Handoff to the Analyst with the file and line.
3. Analyst lane: first `run_code` fails ✕ (wrong flag), retries, then
   `pnpm eval --only router-fallback-404` reproduces it; Agent I/O shows the
   real eval output.
4. Analyst asks: "Fix in the router (safer) or in the golden (faster)?"
   Chips: Router · Golden. Person picks Router.
5. Writer: artifact v1 `fix-router-fallback.patch` (CODE tab, diff view);
   Checker runs typecheck and the single golden: green.
6. Approval: "Open PR fix/router-fallback-ceiling → main" with the PR body
   preview, risk medium. Approve & always allow → policy
   `allow: open_pr for branches fix/*`.
7. Writer: artifact v2 adds the eval table to the PR body. Run summary:
   memories ("the fallback path needs the same ceiling check as routing",
   "run `--only` first, the full suite is 40 s"), skill diff, cost −X %.
8. Run two (next day, cron): a different failing golden; no approval card
   (policy), learned chip, cheaper.

**Real-model day.** This case can run for real against the actual repo on a
throwaway branch; the PR is opened by `gh` as harrymove-ctrl. Keep the
golden set with one deliberately failing fixture golden for the demo.

## "Hackathon radar" — always-on competitive intelligence

**Goal.** "Every morning: what changed on the Nebius × NVIDIA hackathon and
the Mezo buildathon pages, who else is building a personal agent, and what we
should say differently." Schedule: daily 09:00. Tools: `web_search` (Tavily),
`fetch_url`, `write_artifact` (doc). Approval: `send_message` to the team
channel with the three bullet digest. Payoff: a cron run waiting with an
unread dot when the person arrives; a doc that diffs against yesterday's;
memories like "Devpost lists submissions by track" that make run two faster.
Replaces the Mezo-only workstream.

## "Morning brief" — inbox, calendar and repo, one page, nothing sent

**Goal.** "At 08:00, read my inbox export, today's calendar and GitHub
notifications; give me one page: what needs me today, drafts for the three
replies that matter, and what can wait." Tools: `read_files` on
`fixtures/inbox/*.eml` and `calendar.ics`, `fetch_url` for the GitHub
notifications JSON (fixture in mock), `write_artifact`. Approval: each draft
reply is a `send_message` action; Mode "Ask each action" shows the tray with
three waiting and "Approve all low-risk" (none are low-risk, so it stays a
one-by-one decision). Payoff: the tray with a count, the policy "allow
send_message to calendar invites" after a week.

## "Token Factory cost audit" — the crew optimizes its own spend

**Goal.** "Weekly: read our usage log, find the five most expensive hops,
propose router rule changes, prove the saving with the evals." Tools:
`read_files` (the `llm_cache` and usage export), `run_code` (`pnpm eval:ab`),
`write_artifact` (a table + proposed rules). Approval: `write_file` to
`src/runtime/router-rules.json`. Payoff: the baseline pill goes from −34 % to
−4x % after approval; the unit-economics story told by the product itself.

## "Release watch" — dependencies that could break us

**Goal.** "Watch Next.js, the AI SDK and libsql releases; tell me what
breaks us and open an upgrade PR when it is safe." Tools: `fetch_url` on
release pages, `read_repo` for our versions, `run_code` for `pnpm typecheck`
after a trial bump, `open_pr`. Approval: the PR. Payoff: a second coding
case that reuses the Ship Nimbus policy, so run one of this workstream
already skips the PR approval if the person extends the rule to `chore/*`.

## Kept as a template, not the hero: "Checkout conversion drop"

Still the quickest run and the best CSV example; it stays as the fourth
template chip and the eval set's data case.

## Seed order (rail, top to bottom)

1. Ship Nimbus — on demand (hero)
2. Hackathon radar — daily 09:00 (arrives with an unread dot in the demo)
3. Morning brief — weekdays 08:00
4. Token Factory cost audit — Mondays 10:00
5. Release watch — on release
6. Checkout conversion drop — on demand (template)

## Fixtures the builder writes

- `fixtures/mock-model/<case>/<role>.json` per case, keyed by turn, with
  the beats above; the Analyst's `run_code` in Ship Nimbus and Cost audit
  runs the real commands.
- `fixtures/inbox/` (6 short .eml files), `fixtures/calendar.ics`,
  `fixtures/github-notifications.json`, `fixtures/usage-export.json`.
- One intentionally failing fixture golden `evals/trajectories/router-fallback-404.json`
  (a copy with a wrong assertion) that Ship Nimbus "fixes" by writing the patch
  artifact; the real suite stays green.
- `fixtures/search/` entries for the radar case (hackathon pages, two
  competitor project pages, one Nebius news item).

## Added in rev F: "Token Factory watch"

**Goal.** "Watch the Token Factory catalog and our own usage: tell me when a
price or a model changes for one of our roles, propose router rule changes,
and show the saving." Schedule: daily 07:00. Tools: `fetch_url` on
`https://tokenfactory.nebius.com/api/public/models_info` (fixture in mock),
`read_files` on the usage export, `write_artifact` (a proposal with a
before/after table), approval: `write_file` to `src/runtime/router-rules.json`.
Payoff: the overview's router gauge and the "if applied" stat move after
approval; the crew that optimizes its own bill, on the platform the judges run.
Seed order: after Token Factory cost audit (which it eventually replaces).
