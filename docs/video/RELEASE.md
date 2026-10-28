# Release notes for the video

## Status on Oct 28

There is no recorded real-model take yet. The video ships on the role-named mock take `docs/demo/raw/nimbus-demo-20261028-1258.webm`. Its numbers are fixture numbers (the scripted mock model) and must be labelled that way on screen. The real run is kept for a later day.

Real spend so far: about **$0.22** on Nebius Token Factory, from the runs' own cost logs. Tavily: 0 calls. The cleared budget was $0.50.

## Measured on the real check (Oct 28, 21:50, Token Factory, no take)

This was one headless run of Morning brief, then its next morning, with every hop on its real routed tier (`NIMBUS_DEV_CHEAP=0`). The data is in `/tmp/claude-501/real-check` (scratch; not the app's history).

| | Cost | Tokens | Baseline (every hop at its role's ceiling tier) | Saving |
|---|---|---|---|---|
| Run one | $0.0225 | 60,933 | $0.0308 | 27 % |
| Run two | $0.0288 | 81,156 | $0.0366 | 21 % |

- Model calls across both runs: 48 agent hops, plus the router's Nano classifier calls, which are not counted in the run costs.
- Run one: the Researcher reads, one Writer writes the brief and the three replies, and three sends are approved by you. Approve & always allow on the reviewer's reply saved `allow: send_message to reviewer@example.com for this workstream`.
- Run two: the reviewer's reply went out under that rule with no card (resolved by policy); the client's and the teammate's were approved by you.
- **Run two cost more than run one, not less**, because the Learner saved no memories in run one (see 6 below). The mock's "run two is cheaper" does not hold on the real models yet.
- Week cost: not measured. The app's call log for a week only exists in the dev database.

## What the real models did differently from the mock scripts, and the fix

| # | What happened on the real models | Fix | Commit |
|---|---|---|---|
| 1 | The Researcher did not know where the inbox was and asked "I don't have direct access to your email, calendar, or GitHub" | The Morning brief skill names its sources (`fixtures/inbox/*.eml`, `fixtures/calendar.ics`, `fixtures/github-notifications.json`, read with `read_repo`) | be3ddc0 |
| 2 | A Researcher that read one file per turn used all 8 turns and reported nothing, so the Orchestrator thought nothing was read | Child agents get 12 turns; the last one has no tools and asks for the report | be3ddc0 |
| 3 | Duplicate briefs (the Writer's and the Analyst's), the Analyst asking whether to send, and the Orchestrator raising its own approvals, keyed by "recipient", which a rule cannot match | The skill names the crew (Researcher reads, one Writer writes and sends) and says send_message asks for approval itself | be3ddc0 |
| 4 | The Orchestrator handed the Writer "Researcher's report: … (include the report)", so the Writer read every file again; in another run it handed off three times | Every handoff carries the crew's reports so far, for any workstream | 3e117e6 |
| 5 | The Writer drafted all three replies but never sent them (its role prompt only said to write documents), and the reviewer's draft said the fix "has shipped", which no source said | The Writer's role prompt says to call send_message once per message (it asks for approval itself) and to say only what the latest sources and reports say. The GitHub fixture says the login fix is in review, not merged | 3e117e6, be3ddc0 |
| 6 | The Learner (always Nano, thinking on) used its whole output budget thinking: at 600 tokens and at 1500 it never called save_learning; at 4000 it either ran out again or wrote the call as JSON text and was cut off mid-way | **Not fixed.** Its cap is now 4000 (3e117e6), and that is still not enough with thinking on. The options are thinking off for the Learner, or the Learner on Super | open |

The mock checks are green after every fix: eval 19/19, check:cases 27/27, budget guards, loop and learning.

## Real runs and what each was for

| Run | Cost | Purpose and result |
|---|---|---|
| Take attempt 1 (`data/real-20261028`) | $0.0042 | Stopped: the Researcher asked where the inbox was (1) |
| `pnpm smoke` | $0.0003 | One call per tier plus a Nano tool call: PASS |
| Check 1 | $0.0240 | Three drafts, no brief, no sends |
| Check 2 | $0.0102 | Empty Researcher report (2) |
| Check 3 | $0.0361 | Works, but messy (3) |
| Check 4 | $0.0692 | Run one clean; run two had duplicate handoffs (4); no memories (6) |
| Take attempt 2 (`data/real-take-20261028`) | $0.0276 | The Writer never sent (5); the recorder timed out at the first approval |
| Check 5 | $0.0513 | Runs one and two follow the flow; no memories (6) |
