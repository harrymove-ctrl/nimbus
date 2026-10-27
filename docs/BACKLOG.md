# Backlog and status

Honest state as of 2026-10-27, 15:00 ICT. Deadline Oct 30, 10:00 PDT
(00:00 Oct 31 ICT). "Done" means the exit test passed, not that code exists.

## Done

| Item | Evidence |
|---|---|
| Plan, spec, Nebius inventory, submission kit, UX review, experience plan | `docs/*.md` |
| UI sketch: 9 sheets, 12 flows, composer state tables, interaction map | `docs/UI-SKETCH.html`, published artifact v8 |
| Project scaffold, Sorbet theme, Manrope, Glow Cloud boot screen | `localhost:3218` shows the cloud (Phase 0 exit test, first half) |
| Claude Code setup: explorer, worker, researcher agents on Sonnet | `~/.claude/agents/*.md` |
| interface-bts skill installed | `.agents/skills/interface-bts` |
| Internal-disk worktree cleanup; Dev-volume-only rule | 51 GB free |
| GitHub auth as harrymove-ctrl | `gh auth status` |
| React Bits registry + blocks `ai-chat-2/5/6-sorbet` installed and verified (names exist; auth header works) | `components.json`, `src/components/blocks/`; Sorbet button/surface classes reused in `src/components/nimbus/ui.ts`. The blocks are demo pages, so the run view is hand-built around them. |
| Phase 2a: run view on a recorded run (rail, header, timeline strip, transcript, plan/question/approval/summary cards, approval tray, composer state machine, Inspector) | Driven in the browser pane at 1024x768 on 2026-10-27: planning → CANCEL 3 s → running → question answered by chip → approval approved from tray and via Approve & always allow → artifact v1 → v2 → run summary with SKILL.md diff → idle; cancel restores the draft. Commit `481b775`. |
| Replay API behind `RunHandle`: SSE events, approvals, messages, stop, estimate | `src/runtime/source.ts`, `src/runtime/replay.ts`, `src/app/api/**`; the live runtime replaces the replay with no UI change |
| Motion spec rows (EXPERIENCE §5), first pass | see "Motion gaps" below |
| Phase 3b evals: 15 goldens across the three workstreams, per-hop deterministic assertions + rubric-driven Nano judge, `pnpm eval [--cheap] [--router on|off] [--only] [--ab]`, `pnpm demo --record <name>`, `evals/report.json`, `.github/workflows/eval.yml` | `pnpm eval` → 113/113 (100 %), 15/15 goldens; a deliberately wrong golden fails with exit 1; `--ab`: spend −42.6 % with the router on, pass-rate +0.0 pp (mock mode cannot show a quality drop). The workflow itself has not run on GitHub. |
| Phase 4 prep: `Dockerfile` (multi-stage, node:22-alpine, python3 for run_code, `/data` volume), `.dockerignore`, `docs/deploy.md` with the endpoint and job commands | Written, **not built**: the Docker daemon is not running here. Run on the final day. |
| README per SUBMISSION.md (mock mode first, env, Nemotron / Token Factory / Nebius, router + eval numbers, architecture diagram, unverified list) | `README.md` |
| Cross-process persistence | A cron run created by one server process (3233) was listed and replayed from SQLite (101 events, `done` marker) by another (3232); unread flags set by cron showed in the rail, cleared on open |
| Timeline fixes per SPEC §15 (adaptive axis, labels clear of the cap, one legend badge with full model name, container-query header) + orphaned runs replay as stopped | Measured at 1024 px after a 3-minute wait at an approval: axis `0s · 1:00 · 2:00 · 3:00 · 4:00`, 148 px minimum gap, no truncated badge, baseline pill in view. Commit `3c0e071` |
| ✦ learned chip on the orchestrator lane (run.start reports memories and policy lines loaded) | `pnpm check:loop` asserts it; seen in the UI on run 2 |
| Demo video script `scripts/record-demo.ts` (`pnpm demo:video`) | Written and typechecked; **not run**: Chrome cannot start in this sandbox (crashpad and singleton socket blocked) and Playwright's browser download is blocked. Run it from a normal terminal. |
| interface-bts posters (approval card, timeline strip) | **Not built**: the skill needs headless Playwright to freeze, measure and verify the real component; also needs its step 2 sign-off on headline and moments |
| Spend guards (docs/BUDGET.md): `NIMBUS_RUN_CAP_USD` (default 0.25) stops a run with run.error "spend cap" and a "Cap hit" pill; `NIMBUS_DAY_CAP_USD` (default 5) refuses new runs from the API, cron, job and chat with a composer message; per-tier max_tokens (1200 / 1500 / 600); header spend meter; rail footer "Today $x of $y" | `pnpm check:budget` → PASS (cap 0.01 stops the demo at $0.011, concurrent agents stop, every call carries its tier's max_tokens, day cap refuses). Only real-model runs count toward the day cap (mock runs would otherwise block the free demo). Seen in the UI. |
| `NIMBUS_RECORD_REAL=1` / `NIMBUS_REPLAY=<path>`: record any run to `fixtures/real-runs/` and replay it through the existing replay source | `pnpm check:budget`: the recording marks the question and approval as gates, drops the person's own events, cuts their waiting time; the replayed run is identical to the recorded one (75,360 tokens, $0.023414, 15 transcript items). Run 3× green. Replay gate bug fixed (same synchronous-listener race as the live runtime). |
| SQLite shared by several processes: busy timeout, WAL, retries; init no longer marks young runs interrupted | the stray cron server had been locking the file |
| RUN button reachable at every width: the composer toolbar wraps instead of overflowing under the Inspector; the planning loader overlay is `pointer-events-none` | `elementFromPoint` at the RUN centre and corners returns the button at 1024, 1280 and 1440 px (in the browser pane). `scripts/check-ui.ts` repeats it with Playwright from a normal terminal (not run here). |
| dithercn installed with the shadcn CLI (`dither-core`, `skeleton`, `dither-glow`; no --overwrite, utils.ts untouched) and placed per docs/DITHER.md: ambient glow behind the run view and empty state (cell 3, 7 % opacity, paused when a run has 4+ lanes running, absent while the boot screen shows), sweep skeletons for the rail and the Inspector, a pulse skeleton for the plan area; 150 ms before any skeleton; boot screen capped at 3 s so a slow network shows the rail skeleton | Live: the glow runs (`data-state=running`, 740×652 canvas); sweep 1.2 s, pulse 1.6 s, cell 3 px read from the running animations; a run showed no skeleton for 255 ms, the pulse until the plan card arrived at 780 ms. **Not verified live:** the rail skeleton under a slow network (not throttled here) and reduced motion (the shipped CSS rule hides the sweep and stops the pulse; the OS setting was not toggled). Skeleton text widths are the library's (last line shorter), not the spec's 90/70/85/60/80/50. |
| Mock model provider `NIMBUS_MODEL=mock` (default with no key): scripted per role, 300–900 ms, fake usage, forced 429 | `src/lib/tokenfactory.ts`, `fixtures/mock-model/*.json` |
| Phase 1 runtime: bus + persistence, agent loop, orchestrator (`plan`, `spawn_agents`, `handoff`, `request_approval`, `ask_user`, `finish`), learner | `pnpm demo` → `EXIT TEST: PASS` (11.7 s, 6 lanes, 3 sub-agents at once, doc v1→v2, 1 approval, $0.023). Commit `0f03e27` |
| Tools: web_search (fixtures / Tavily), fetch_url, run_code subprocess, write_artifact, send_message (logs) | `src/runtime/tools.ts`; mock fixtures in `fixtures/search/` |
| SQLite (libsql + drizzle), auto-seed of the three workstreams, `pnpm seed`, sample CSV | `src/db/`, `fixtures/data.csv` |
| Router: rules, classifier (mock = script complexity), llm_cache, retry once then one tier down, `route` events | `pnpm demo:router` → PASS: 44.8 % cheaper with router on, forced 429 and a bad model id (404, immediate) both fall to Nano and complete, cache hits cost $0 |
| Live runtime wired to the Phase 2a routes; UI runs on it | Driven in the browser pane: composer cycled idle → planning → running → asked → running → idle; policy honored on run 2 |
| Memory (hash embeddings in mock), SKILL.md rewrite + diff, policy lines honored on run 2, dedupe, **Revert skill change** (API + button) | `pnpm check:loop` → 9/9 incl. revert; UI: button → "Reverted" on 3232 |
| Schedules (node-cron, `instrumentation.ts`) and headless `pnpm run:job` | `pnpm check:cron` → cron runs appear without a click and the unread flag is set (also when a run waits at an approval); rail showed 3 unread dots and the clock glyph on the two scheduled workstreams |
| `/v1/chat/completions` (stream + non-stream) and `/v1/models`, `docs/openclaw.md` | curl: plan line, auto-answered question, approval notice with `/?run=` deep link; second call returns the full doc once policy allows |

## In progress (build session)

| Item | Phase | Note |
|---|---|---|

## Not verified in Phase 2a

- Phone layout (tab bar, tray on the CHAT tab) is not built; below 1280 px the rail and Inspector are drawers.
- The three-column desktop layout was measured by script at 1440x900 (rail 280, main 740, Inspector 420, header 56, strip 240), not looked at: the browser pane crops screenshots.
- Slash-menu keyboard navigation, STOP confirm, Reject with a note, Attach chips and the plan card's Save as workstream were not exercised.
- Real model path: `NIMBUS_MODEL=nebius` has never run (no key); `pnpm smoke` and the Nano classifier call are deferred to the final day. Tavily real search and real embeddings are the same.
- `run_code` does not block the network (stripped env, temp workspace, 30 s timeout only); OpenShell is the production path.
- `/v1` bearer check (401) was read, not exercised; OpenClaw itself was never run against it.
- Docker image not built (daemon not running); `.github/workflows/eval.yml` has not run on GitHub.
- `docs/SUBMISSION.md`'s feedback draft claims function calling was reliable and the endpoint was created from the CLI: neither has happened yet; do not submit those lines until verified.
- `NIMBUS_ROUTER`, cache and mock complexity scores are scripted: the "−45 %" is from mock usage numbers, not measured spend.
- `next build` (production) was not completed: it ran for many minutes with no result and was stopped; dev + typecheck is the gate until Phase 4.

## Not started, in order

| Item | Phase | Exit test | Est. |
|---|---|---|---|
| `pnpm smoke` against real Token Factory | 0 | three tiers answer + one tool call | 0.3 h, final day |
| Motion gaps from EXPERIENCE §5: tray slide-up on exit, first-agent cloud collapse sequence, inspector first-run slide on desktop, Learned chip, selected-segment ring tween | 2 | remaining rows visible; reduced motion = cuts | 0.7 h |
| Dockerfile, registry push, Nebius Serverless Endpoint, one Serverless Job | 4 | public URL works; job shows completed | 2.5 h, needs Nebius account + keys |
| README with setup, Nemotron/Token Factory/Nebius sections, eval numbers, architecture figure | 5 | reviewer can run it from the README | 1.5 h |
| Public repo on harrymove-ctrl, MIT visible | 5 | repo page shows the license | 0.2 h |
| Video, 3 min, per the script | 5 | public YouTube link | 2 h |
| Devpost form, feedback text, track choice | 5 | submitted before the deadline | 0.5 h |

Total not started: about 28 hours of build. Three days remain; that fits if
the build session runs continuously and stretch items stay out.

## Stretch (only after Phase 4's exit test)

- Telegram bot via grammY as a second chat path.
- OpenShell sandbox adapter for `run_code`.
- Nemotron 3.5 Super VL for screenshot inputs.
- MemWal (Walrus Memory) adapter behind the memory interface.
- interface-bts spec poster of the approval card and the playhead for the README.
- Phone layout polish beyond "works".

## Cut, and why

- Editing the approval payload (rev A "Edit"): replaced by Approve & always allow / Reject with a note.
- Workstream creation form: replaced by the plan card's Save as workstream.
- Framework dependency on OpenClaw / NemoClaw / Hermes: replaced by the OpenAI-compatible endpoint.
- 100+ golden trajectories before the deadline: 12–20, with the generator.
- Mermaid in the sketch page: replaced by the page's own flow renderer.

## Open risks

- React Bits block names `-2/-5/-6-sorbet` still unverified on pro.reactbits.dev.
- Nemotron structured output and reasoning toggle unverified; the plan uses function calling only.
- Nebius Serverless Endpoint needs a container registry and ~5 min create time; Vercel is the fallback demo URL.
- Devpost page returned 403 to automated fetch; the deadline is from search snippets. Confirm it on the page.
- All phases are being built in mock mode; the first real-model run happens on the final day. Keep 4 hours for surprises.
