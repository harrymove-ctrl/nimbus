# Rev D checklist: what is built, verified, and still open

Status as of 2026-10-27, 16:10 ICT. Legend: ✅ built and verified on screen
or by a quoted test · 🟡 built, not verified or partial · ⬜ not built.
The builder updates this file with each commit; the planner reviews it
against the sketch (sheets 1–10) and the flows (F1–F12).

## Surfaces (sketch sheet in brackets)

| Surface | Spec item | Status | Note |
|---|---|---|---|
| Boot [2] | Glow Cloud 320, blue, title, fade after workstreams load | ✅ | Seen in the demo video |
| Rail [6] | 3 workstreams, unread dot, clock glyph, select vs Run buttons | ✅ | Rail row = select; icon button = run |
| Rail [6] | Right-click: Run now · Edit schedule · Archive | ✅ | Also a ⋯ button on each item (hover, focus, touch). Edit schedule: presets or a cron expression, validated by the server ("every tuesday" is refused with a message), saved on the workstream and kept when the seed runs again, the scheduler restarts. Archive hides it; "Archived · N" at the bottom of the rail restores it. Seen on 3241 with Release watch |
| Run header [1] | Title truncates, status pill, elapsed · tokens · cost, −X % pill never clipped | ✅ | Rev C measured at 1024 |
| Timeline [3] | Lanes, model badges, hatched wait, failed ✕, spawn connectors, playhead | ✅ | |
| Timeline [3] | Adaptive axis (rev C), labels after the cap, one full-name badge with ↓/↻ | ✅ | 60 s steps at 600 px |
| Timeline [3] | Click segment → Inspector Agent I/O; legend tokens · cost | ✅ | |
| Timeline [3] | Collapse to 56 px summary bar; drag resize 56–480 | ✅ | The bottom edge is a separator: drag (120–480 px; pulled under 96 it collapses to the 56 px bar), ↑↓ on it, double-click resets. Seen: 240 → 312 → 240 with the keys and the double-click; mouse drag not exercised |
| Timeline [3] | Keyboard ←→ ↑↓ Esc | ✅ | Seen: → → moves along the Orchestrator lane, ↓ lands on the nearest Researcher segment, ↑ and ← come back; each move selects (the Inspector follows); Esc clears the selection and the trace |
| Plan card [4] | Agents + tiers, tools, estimate, 3 s Cancel, Save as workstream | 🟡 | Cancel ✅; Save as workstream ⬜ |
| Question card [4] | Option chips, free text via composer | ✅ | |
| Approval card [4] | Payload preview, risk chip, Approve · Approve & always allow · Reject with a note | ✅ | Reject with a note: dialog text unverified |
| Approval tray [4] | Sticky above the composer, count, Approve all low-risk | 🟡 | Tray ✅; "Approve all low-risk" unverified |
| Composer [4] | Card, Attach · Tools · Mode · Tier chips, cost pill, state-driven button | ✅ | |
| Composer [4] | Slash menu `/run /schedule /stop /approve /skill /memory`, @mentions | 🟡 | Hint line shows them; menu UI unverified |
| Composer [4] | Attach: drop files → chips → tool inputs | 🟡 | Drop handler exists; chip and tool wiring unverified |
| Composer [4] | RUN button clickable at 1024/1280/1440 (fade overlay bug) | ✅ | c464227: toolbar wraps, loader overlay pointer-events none; elementFromPoint hits the button (centre and corners) at all three widths |
| Run summary [6] | Stat tiles, memories, SKILL.md diff, Revert | ✅ | Arrives ~8 s after Done |
| Inspector · Artifact [5] | Version tabs, DOC · CODE toggle, copy | ✅ | |
| Inspector · Agent I/O [5] | Brief, tool calls in/out, result, tokens, tier, route reason | ✅ | Seen in the video |
| Inspector · Memory & skill [10] | Rev D: header counts, rule cards with Revoke, skill as cards with diff/raw/revert, all memories with Forget | ✅ | `pnpm check:learning` 13/13 (mock, own DB). On screen at 1024 and 375: header strip, rule card, Revoke asks once, skill cards, Show diff +2 −1, View raw, Revert, Forget. Not toggled: reduced motion, the filter box above 8 rows, the NEW chip (mock run 2 saves no new memory) |
| Glow Cloud moods [7] | Blue idle/running, orange waiting/failed, count badge | ✅ | "1 waiting for you" seen |
| Learned chip [3] | ✦ learned · N mem · M rule on the orchestrator lane | ✅ | |
| Dither [DITHER.md] | Skeletons (rail, plan area, inspector, artifact) and ambient dither-glow | 🟡 | 2ca91c5: glow, sweep 1.2 s, pulse 1.6 s, cell 3 px seen live. Not seen: rail skeleton on a slow network, reduced-motion toggle |
| Spend guards [BUDGET.md] | Run cap pill, day cap refusal, meter in header, day total in rail | 🟡 | Built (3f245d7); exit test in mock not quoted yet |
| Record / replay [BUDGET.md] | NIMBUS_RECORD_REAL, NIMBUS_REPLAY | 🟡 | Built (2933368); replay identity unverified |
| Phone [8] | Four tabs, badge on RUN, tray on CHAT, lanes scroll | 🟡 | Built (< 768 px): RUN · CHAT · DOC · MEMORY tab bar (56 px + safe area), orange count on RUN while a plan or approval waits, the tray at the top of CHAT, the timeline fills the RUN tab and scrolls sideways, DOC and MEMORY show the Inspector. Seen at 541 px wide (the pane's width), not at 390 × 844; the badge and the tray on a phone were not seen with something actually waiting |

## Rev E (cases and dither), built 2026-10-27 night

| Item | Status | Note |
|---|---|---|
| Runtime: read_repo, open_pr, shell run_code | ✅ | `pnpm check:tools` 15/15. open_pr is mock-only so far: the real `gh` path (throwaway git worktree, push, `gh pr create`, refuses unless gh is harrymove-ctrl) is written and **never run** |
| Six workstreams in CASES.md order with schedules and tools | ✅ | On screen at 1280: rail order, clocks, unread dot on the radar |
| Radar: finished cron run + unread dot on first open | ✅ | `fixtures/seed-runs/radar.json`, stamped today 09:00. The digest was sent **under a standing rule** (`allow: send_message to #team`), so it has no pending approval: the run is finished, as asked |
| Fixtures per case, inbox, calendar, notifications, usage, search | ✅ | `pnpm check:cases` 24/24 |
| Failing fixture golden fixed by a patch artifact; suite stays green | ✅ | `evals/demo/` (two goldens, outside the suite); `pnpm eval` 17/17, 131/131 |
| Ship Nimbus run one and two on screen | ✅ | Run one $0.080, −45 % vs baseline, 64.7 s (waiting on me); run two $0.045, no question, no approval card |
| DitherNumber (summary tiles, header cost) | ✅ | Seen resolving in the summary; header cost seen at rest |
| EmptyState on "Pick a workstream" | ✅ | The Glow Cloud (160 px, Z6) via a `visual` slot added to our copy of the component. (merged into main) |
| Divider with a label at the top of the transcript | ✅ | Seen on the radar run: "Tue, Oct 27 · 09:00 · scheduled". Fixed on the way: the seeded run showed its recording time (16:47); the seed now stamps it. (merged into main) (the repair also fixes already-seeded databases at the next server start) |
| Skeletons held for a beat in the video | ✅ | `?loaders=1`: the rail sweep skeleton is on screen for about 840 ms after the boot cloud leaves (measured in the DOM, seen in a screenshot). (merged into main) |
| Glow behind the run view | ✅ | Back to the spec: pauses at 4 lanes. It holds its last frame (still visible) rather than vanishing. (merged into main) |
| Analyst's question changes the run (mock) | ✅ | "Golden" patches the golden (PR `fix/golden-fallback-reason`, says the check gets weaker, patch verified for real, $0.080); "Router" is unchanged. Seen on screen; `ship-nimbus-golden` golden 5/5. (merged into main) |
| Learner failure is visible (take 7 root cause) | ✅ | A Learner that cannot save now posts "Learning failed, nothing was saved from this run: <reason>" in the run instead of a silent "Done."; its loads and writes retry on a locked database; the final run-row update waits up to 40 retries. `pnpm check:learning` 16/16 (a forced failure: message shown, run still done, nothing saved) |
| record-demo.ts v2 | 🟡 | Rewritten to the v2 beats; **not run** (no Chrome in the sandbox) |

## Flows

| Flow | Status | Note |
|---|---|---|
| F1 Boot and first run | 🟡 | Empty state ✅; "first goal → Save as workstream" ⬜ |
| F2 Start a run | ✅ | |
| F3 Approval gate | ✅ | Chat-app branch via /v1 ✅ (curl) |
| F4 Artifact versions | ✅ | |
| F5 Learning loop | ✅ | Loop ✅; Forget / Revoke / Revert in the tab ✅ (rev D); run 3's prompt and the approval re-ask quoted by `check:learning` |
| F6 Inside chat apps | 🟡 | /v1 ✅ with curl; OpenClaw itself never run |
| F7 Always on | 🟡 | Cron ✅; Serverless Job ⬜ (final day) |
| F8 Router and fallback | ✅ | 44.8 % saving (mock), both fallbacks |
| F9 Eval gate | 🟡 | 15 goldens ✅; GitHub Actions run ⬜ (needs a push) |
| F10 Run status | ✅ | "running forever" after a dead process fixed |
| F11 Composer states | ✅ | All seven states seen in the video |
| F12 System map | 🟡 | Token Factory, Tavily, deploy ⬜ until the final day |

## Demo beats (SUBMISSION.md video script)

| Beat | Status |
|---|---|
| 1 Boot cloud | ✅ |
| 2 Goal typed, cost pill before Enter | ✅ |
| 3 Plan card with countdown; lanes; connectors | ✅ |
| 4 Analyst segment → Agent I/O code | ✅ |
| 5 Question chip | ✅ |
| 6 Orange cloud, tray, Approve & always allow, policy line | ✅ |
| 7 Artifact v1 → v2 after steering | 🟡 | v2 arrives from the crew; a typed steering note mid-run is not in the recording |
| 8 Run summary with −X % and skill diff | ✅ |
| 9 Second run cheaper with learned chip | 🟡 | Learned chip ✅; cheaper only on real models (BUDGET.md) |
| 10 curl to /v1 on the Nebius endpoint | ⬜ | Final day |

## Open bugs

- Stale `next dev` servers lock the SQLite file and load the machine; only the user can kill them.
- `next build` abnormally slow on this machine; production build deferred to the deploy step.

## Rev D work order for the builder

1. Memory & skill tab v2 (SPEC §16) with its two new API routes.
2. Fade overlay pointer-events fix + elementFromPoint check.
3. dithercn install and placement (DITHER.md).
4. Spend guard and replay exit tests quoted; BACKLOG rows updated.
5. Plan card "Save as workstream"; slash menu and attach chips verified; tray "Approve all low-risk" verified.
6. Keyboard on the timeline; rail right-click menu; phone pass.

## Rev F additions (SPEC §17)

**Arc components: hand-built to the Arc contract** (user decision: no Arc Pro token, and not Arc's free foundation either, to keep one design system). Agent plan = `plan-card.tsx`, agent status = `status-pill.tsx`, agent loop = `loop-view.tsx`, agent timeline trace and scrub = `timeline.tsx`, all under `src/components/nimbus/` with the Sorbet tokens; nothing from uiarc.dev is installed. The charts and backgrounds are dithercn.

| Surface | Item | Status |
|---|---|---|
| Overview [11] | Stat row, spend area chart, tokens donut, runs heatmap, uptime bars, router gauge, impact row; every click lands | ✅ | Built (0 8a535c2), seen on 3241: all seven regions from SQLite with 8 weeks of seeded history (`run_hist_*`, labelled; minimal event logs), contours behind. The dithercn charts expose no click callbacks, so clicks land through companion controls under each chart (day chips → run list, "Open latest run", "Open the last run's agents", stat cards → chart / list / Memory tab), not on the chart marks. Donut click opens the last run on Agent I/O, not a timeline legend filter. The day buttons under the charts are styled as a legend row (11 px, muted, "Open a day", the open day highlighted). Not yet checked: phone width, reduced motion |
| Plan v2 [12] | Draft steps editable, reorder, add; Keep planning · Approve plan; live checklist; collapsed line after Done | ✅ | Fix after review, seen on 3241: a draft waiting is counted ("1 plan waiting for you"), the cloud stays orange, the composer's primary button is APPROVE PLAN with CANCEL beside it and Enter approves it, sending the edits made in the card (verified: an edited step 1 arrived in the approved plan).  Seen on 3241: reordered one step and added one, Approve plan kept both ("edited"), checklist ticked in order, collapsed to "7 of 7 steps · 61.7s". UI-started runs now wait for approval; scheduled, chat and CLI runs keep the 3 s window. Ticks are positional (one per orchestrator action), so in mock mode a reordered list ticks in its new order while the scripted crew does its own order. Keep planning in mock re-shows the edited draft as "revision 2"; with a real model it makes the orchestrator plan again. Not built: drag handle works (HTML5) but was not exercised, only the ↑↓ buttons |
| Status pill [12] | Pill in the top bar for background runs; panel with steps, Pause · Stop · Open run; inline Approve · Deny | ✅ | Fix after review (F14), seen on 3241: a run that finishes while you are elsewhere leaves "‹title› finished" in the pill for 25 s with Open run, and puts the unread dot on its workstream in the rail (set by the server for any run nobody is watching; verified with Hackathon radar started over the API from the Overview).  Seen on 3241: pill "2 runs · 2 waiting", panel with step progress and last steps; inline Approve then Deny moved through three message approvals; Stop ended a run waiting on its plan; Pause held a run at step 1 for 4 s and Resume finished it. Pause is new in the runtime (no new hop starts while paused). Built to the contract, no Arc Pro token |
| Loop view [13] | Gather · Act · Verify loop per hop with retries; transport 0.5 · 1 · 2× | ✅ | Seen on 3241 (Checkout's Analyst): "Loop 1 of 2", Verify ✕ with the exception line, loop 2 starts with "Retry · …", Take action; Step, Play/Pause, Replay, 0.5× 1× 2×. Context column: ~ estimated from text length, the in-total is measured. Built to the contract, no Arc Pro token |
| Timeline [13] | Trace on click; scrub on finished runs; tool ticks | ✅ | Seen: Writer → "Tracing 2 lanes" (it and the Orchestrator; 18 segments dimmed, 3 legend rows), clear restores; slider on the axis moves the transcript back (2511 → 1205 chars at 11.2 s) and "back to the end" returns; Replay 0.5/1/2×; tick marks per tool call with a hover name. Not exercised: mouse drag of the playhead (keyboard and the buttons were) |
| Trace view | Lanes · Trace switch in the run header; every model call, tool call and wait on one time axis; headline sentence; filter chips with counts; hover cursor, drag zoom, keyboard; vs last run; OpenTelemetry export (docs/TRACE.md) | 🟡 | Built and driven in the browser on mock runs at 1440 and 390; see docs/ui-ux-qa/trace-*.png |
| Backgrounds | contours · dither-glow · aurora · ripples · noise-field, one per surface, reduced motion still | ✅ | Seen: ripples (rings around the tray, text untouched), noise-field (4 %, cleared in the middle: nearly invisible by design), aurora (raised to 10 % and cleared at the top where text sits, it was too faint); contours and glow seen earlier. The glow holds still while ripples run and at ≥ 4 lanes, and is not mounted on the Overview (one animated background per column). No `[dither-core]` console messages. Reduced motion relies on the library (no OS toggle here) |
| Impact line | Run summary impact row; weekly totals on the Overview | 🟡 | Built: run summary "Impact" (PRs, messages, documents, $ saved, "≈ N min of your time (estimate)" from `estimatedManualMinutes`) and the Overview impact row; the Overview row verified on screen, the summary row typechecks but is not yet seen |
| Composer templates | Three goal chips on an empty workstream | 🟡 | Built (Fix what's failing · Watch … · Brief me every morning); not yet seen on screen |
| Case | Token Factory watch seeded with fixtures | ✅ | `ws-watch`, daily 07:00; `pnpm check:cases --only watch` 3/3: catalog fetched, week priced by real python (price change −11.7 %, −19.4 % with the rule), write_file approval carries the saving, the Overview shows "Router rule recorded · expected −19.4 % more". The catalog page is a fixture with an invented price change; the usage export is generated from the scripted crews' own routed hops. `pnpm eval` 19/19 |
| Router reads `router-rules.json` | Approving the proposal changes routing | ✅ | `pnpm check:rules` 7/7 (mock, $0): with the rule "the Analyst's 3rd hop on runs on Nano" the same Ship Nimbus run costs **−15.3 %** ($0.0800 → $0.0678), route events say "rule: analyst after turn 2 → nano (router-rules.json)", the first two hops are untouched; Tier = Max and `NIMBUS_RULES=off` ignore it; rules with conditions the router cannot check (turnLabel, noToolCall) are ignored. The week estimate for the same rule is −8.7 % (it averages in workstreams with few Analyst hops), so the two numbers differ on purpose. An earlier Orchestrator rule changed nothing because the router already runs those hops below Ultra, which is why the proposal was changed |
| Video | 1920 × 1080 recording, crf 17; v3 beats | 🟡 | `scripts/record-demo.ts` rewritten (1920 × 1080, slow, crf 17, 30 fps; Overview → plan draft edit → Loop → Memory → radar → status pill → run two → Overview). **Not run** (no Chrome here). The pill beat uses Morning brief in the background because Ship Nimbus run two is auto-approved by the learned rule, so it has no PR to approve inline |

- **Chat apps:** OpenClaw and Hermes are integrated for real only after the Phase C and D exit tests in `docs/CHAT-APPS.md`; until then the video and README say "curl-tested".

## Chat apps (docs/CHAT-APPS.md)

| Phase | Item | Status |
|---|---|---|
| A | Request log, compatibility, intent router, chat threads, phone-length replies, questions in chat | ✅ mock-tested (`pnpm check:chat`) |
| B | Telegram push for approvals, questions, finished runs (stub-tested) | ✅ stub-tested (`pnpm check:chat`) |
| C | OpenClaw on the user's machine, Telegram bot, phone exit test | ⬜ user steps |
| D | Hermes CLI on the same endpoint | ⬜ user steps |
| E | Hosted endpoint with token | ⬜ final day |

## Sound (docs/SOUND.md)

| Item | Status |
|---|---|
| cuelume 0.2.8, theme `default`, volume 0.6, Sound switch in the top bar (saved in localStorage, default on) | ✅ |
| Outcome cues: run started `loading` subtle · plan draft `ready` subtle · needs you `attention` · approve `success` (always allow: strong) · reject `close` · failure `error` · retry worked `success` 0.4 · run done `success` · summary `count` 700 ms · memories saved `ready` | ✅ checked on 3241 with the `[cue]` log; not listened to |
| Control cues on rail, composer, plan card, inspector, timeline, status pill, memory tab (full map in docs/SOUND.md) | ✅ |
| Video renders the same cues (video session, inside `video/`) | ⬜ |
