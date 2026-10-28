# Nimbus — the plan

> A glowing cloud that runs your ongoing work with a crew of Nemotron agents,
> asks before it acts, and learns from every run.

Written 2026-10-27 by Fable for Sonnet to execute. Facts below were checked
against the sources listed at the end; anything marked **(verify)** was not
confirmed from a primary page and must be checked at the moment it is used.

## Status · 2026-10-29 01:50 ICT (about 46 h to the deadline)

What is real, what is mock, and what is left. "Real" means run on Nemotron 3 through Nebius Token Factory with the user's key; every number is from the app's own cost log.

| Phase | State | Real or mock |
|---|---|---|
| 0 Scaffold, smoke | Done | Real: `pnpm smoke` passes on Ultra, Super, Nano plus a tool call ($0.0003) |
| 1 Headless run | Done | Real: Morning brief run one $0.0258–0.0276, 70–75K tokens (checks 5, 6, take 7) |
| 1b Cost router | Done | Real: 22–27 % under the all-ceiling baseline on the same mornings |
| 2 Timeline + composer UI | Done, live | Real on Railway (mock:false, $1 day cap); fixes of Oct 29: footer names the real model, long-run axis, cancelled state, translucent card, New workstream |
| 3 Memory, skills, schedules | Done | Real, on camera (take 1915): the Learner on Nano saves memories (16 after two runs) and rewrites SKILL.md; the always-allow rule sends run two's reply with no card; run two is 3 % cheaper than run one ($0.0209 vs $0.0216) |
| 3b Evals + CI gate | Done | Mock: 19/19 goldens, 27/27 cases, chat 62/62; the GitHub Actions eval workflow ran green on the first push (after a pnpm version fix) |
| 4 Chat apps | Built | Mock-tested; the real curl exchange against the live /v1 is queued (about $0.03); a real OpenClaw or Hermes client is the user's step (docs/openclaw.md "Against the live demo"); Telegram send-only path unverified |
| 4 Deploy | Done on Railway | Real: https://nimbus-production-6f7b.up.railway.app, volume at /data, bearer on /v1, day cap $1. Nebius Serverless Endpoint: not deployed (encouraged, not required by the rules; the feedback says so) |
| 5 Video | Rev 6, re-rendering on the real take | The recorded real take 1915 (Oct 29 02:15) covers the Overview, the whole Morning brief run one and run two and Memory & skill on the real models; radar/pill and watch stay on the role-named mock take 1258 (the real run never reached those beats); the chat scene replays the real Railway run. Numbers on screen: run one $0.0216 (24 % saved), run two $0.0209, 16 memories. Music: the user's Suno track |
| 5 README, LICENSE, repo | README in the user's voice with the measured numbers; MIT at root | Pushed 2026-10-29 01:50 on the user's "Push now": https://github.com/harrymove-ctrl/nimbus, public, MIT detected; the eval workflow is green on push (mock model, $0) |
| 5 Devpost, YouTube | Drafts ready in docs/SUBMISSION.md (description, story, form answers, feedback, thumbnail, gallery) | The user fills ratings and uploads on Oct 30 |

Real spend to date: about $0.485 across the laptop runs and Railway, of a $0.50 cap. Keys are in `.env.local` and Railway only; both were pasted in chat once and must be rotated after the hackathon.

Open items, in order: (1) the real chat run on Railway, (2) the last full take, (3) the video swap and re-render if the take lands, (4) the user's Hermes/OpenClaw run, (5) Oct 30: push, YouTube, Devpost, submit, rotate keys.

## 0. The clock and the approach check

**Deadline: Oct 30, 2026, 10:00 PDT = 17:00 UTC = 00:00 Oct 31 ICT.**
That is three working days. Every decision below is made for that clock.

Before the plan: is this the right approach?

The original idea stacks four things: Nebius-style agents for ongoing work,
personal tasks, living inside chat apps (OpenClaw), and an agent that keeps
learning (Hermes). Integrating OpenClaw, NemoClaw/OpenShell and Hermes Agent
as frameworks is not the right approach for three days: each is an alpha-stage
install with its own onboarding wizard, Podman/Docker needs on macOS, and
nothing we can show in a 3-minute video that is clearly *ours*.

The right approach is one product we own end to end, with the four ideas as
features of it, not dependencies:

| Idea in the brief | How Nimbus delivers it in 3 days |
|---|---|
| Agents for ongoing work | **Workstreams**: standing goals that run as multi-agent **Runs** on a schedule or on demand, shown on a live per-agent timeline (the screenshot). |
| Personal tasks | A workstream is personal by construction: your goal, your tools, your memory namespace, your data in your own DB. |
| Inside your chat apps (OpenClaw) | Nimbus exposes an **OpenAI-compatible `/v1/chat/completions`** endpoint. OpenClaw (and Hermes) can point at it with a 10-line custom-provider config, so Nimbus answers from Telegram/WhatsApp/Slack through OpenClaw with zero bridge code. STRETCH: a direct Telegram bot. |
| An agent that keeps learning (Hermes) | A **Learner** agent (Nano) runs after every run: writes memories and rewrites the workstream's `SKILL.md` (what worked, sources, pitfalls). The next run loads it. The demo shows the skill file diff between run 1 and run 2. |

Track: **Personal AI** (always-on, private, persistent memory, reusable skills,
tools you choose, tasks across daily workflows, NVIDIA open model). The same
build also satisfies **Best Apps & Agents** (Ultra for reasoning, Nano/Super
for fast calls, Serverless Endpoints/Jobs). Decide at submission time: if the
memory/skills loop and the OpenClaw provider demo are solid, submit Personal AI;
otherwise Best Apps & Agents. Also target the **Best Use of Tavily** side prize
(the Researcher agent searches with Tavily; Nebius owns Tavily and Tavily
judges sit on the panel).

## 1. Product in one screen

**Nimbus** is a personal ops room.

- Left: your **workstreams** (e.g. "Watch Mezo buildathon competitors",
  "Weekly inbox triage", "Checkout conversion drop on Oct 14").
- Center: the **composer** — a chat with the orchestrator where every
  side-effecting action arrives as an **approval card** you accept or reject,
  with a side panel that previews the **artifact** (document or code) the run
  is producing, with versions.
- Right / bottom: the **run timeline** — one lane per agent with the model
  badge, segments for thinking / tool calls / waiting / failed, dotted spawn
  connectors from the orchestrator lane, a moving playhead, and a header with
  elapsed time, tokens and cost.
- The **Glow Cloud** mascot is the first preloader: it shows while the app
  boots and while a run starts. Blue = idle/running. Orange = a run is waiting
  for your approval or failed. It follows the pointer and winks when clicked.

Crew (fixed for the demo):

| Agent | Model (Token Factory id) | Job |
|---|---|---|
| Orchestrator | `nvidia/Nemotron-3-Ultra-550b-a55b` | Plans the run, spawns agents, decides handoffs, requests approvals, final judgment. Called at most 2–3 times per run. |
| Researcher | `nvidia/nemotron-3-super-120b-a12b` | Tavily search + fetch; returns sourced findings. |
| Analyst | `nvidia/nemotron-3-super-120b-a12b` | Reasons over data/findings; can run code in the sandbox. |
| Writer | `nvidia/nemotron-3-super-120b-a12b` | Produces the artifact (doc or code) with versions. |
| Checker | `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` | Fast verification of claims, schema checks, routing, summaries. |
| Learner | `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` | After the run: extracts memories, rewrites the workstream SKILL.md. |

All calls go to `https://api.tokenfactory.nebius.com/v1` with `NEBIUS_API_KEY`.
Prices (per 1M tokens in/out): Ultra $1.00/$3.00, Super $0.30/$0.90,
Nano $0.06/$0.24. A typical run is 30–80k tokens, so under $0.10. The $25
hackathon credit covers hundreds of runs. Credit code (verify on the promo form):
`NEBIUS-DEVPOST-GLOBAL26`, plus $25 more via the Nebius Builder Program.

## 2. Phases, exit tests, and the hour budget

Work in ICT (GMT+7). The deadline is **00:00 on Oct 31 ICT**. Leave the last
6 hours for video + form; nothing else matters then.

### Phase 0 — Scaffold and first light (Oct 27, ~4h)

1. `pnpm create next-app@latest . --ts --tailwind --app --eslint --src-dir --use-pnpm` (inside this folder).
2. Install shadcn CLI 3, add `components.json` registries for React Bits Pro
   (see SPEC §7), put `REACTBITS_LICENSE_KEY` in `.env.local`, then add the
   three Sorbet blocks: `ai-chat-6-sorbet`, `ai-chat-5-sorbet`, `ai-chat-2-sorbet`.
   Paste `docs/assets/reactbits-sorbet.css` into `src/app/globals.css` after the
   Tailwind import, load Manrope with `next/font`.
3. Drop `docs/assets/glow-cloud.tsx` in as `src/components/glow-cloud.tsx`
   and render it as the app preloader (blue) on `/`.
4. `src/lib/models.ts` with the routing table above; `src/lib/tokenfactory.ts`
   using the Vercel AI SDK `@ai-sdk/openai-compatible` provider with
   `baseURL = https://api.tokenfactory.nebius.com/v1`.
5. `scripts/smoke.ts`: one call per model tier, with a tool call, print usage.

**Exit test:** `pnpm smoke` prints three answers and usage from Ultra, Super,
Nano, and a successful function call from Nano. The app shows the cloud.

### Phase 1 — Headless run (Oct 27 night → Oct 28 morning, ~6h)

1. Run runtime in `src/runtime/`: `Run`, `RunEvent` bus, `spawnAgent`,
   `handoff`, `requestApproval`, `emitArtifact` (SPEC §3–4).
2. Tools: `web_search` (Tavily), `fetch_url`, `run_code` (sandboxed subprocess
   in a temp workspace), `write_artifact`, `send_message` (stubbed; always needs approval).
3. SQLite (libsql + drizzle) with the tables in SPEC §5.
4. `scripts/run.ts "<goal>"`: runs a workstream headless, prints the event
   stream as text, auto-approves in `--yes` mode.

**Exit test:** `pnpm demo` runs "Checkout conversion drop on Oct 14" against
the sample CSV in `fixtures/`, spawns ≥3 agents concurrently, produces a doc
artifact, requests one approval, and finishes under 60s with usage + cost printed.

### Phase 2 — Timeline + composer UI (Oct 28, ~10h)

1. SSE route `GET /api/runs/[id]/events`; `POST /api/runs` to start;
   `POST /api/runs/[id]/approvals/[aid]` to resolve.
2. Timeline component (SPEC §6): lanes, segments, connectors, playhead, header.
3. Composer from the three blocks (SPEC §7): `ai-chat-6` is the shell;
   `ai-chat-5`'s approval message component; `ai-chat-2`'s artifact panel.
4. Glow Cloud turns orange while an approval is pending; back to blue after.

**Exit test:** Start a run from the UI, watch the lanes fill live, approve the
action in the composer, see the artifact version bump in the side panel.
Refresh mid-run: the timeline rebuilds from stored events.

### Phase 3 — Memory, skills, schedules (Oct 29 morning, ~6h)

1. Memory: `memories` table with embeddings from Token Factory `/v1/embeddings`
   (pick the embedding model from the catalog at build time; it will not be an
   NVIDIA model, that is fine). Orchestrator gets top-k memories in its prompt.
2. Skills: `data/skills/<workstream>/SKILL.md`. Learner rewrites it after each
   run. Orchestrator loads it next run. Show the diff in the run summary.
3. Schedules: `node-cron` inside the app for "always-on"; plus a headless
   container entrypoint `pnpm run:job --workstream <id>` for **Nebius Serverless
   Jobs** (the scheduled heavy runs).

**Exit test:** Run the same workstream twice. Run 2's orchestrator prompt
contains memories and the SKILL.md from run 1, and the UI shows the skill diff.
A cron-triggered run appears in the list without a click.

### Phase 4 — Chat apps + deploy (Oct 29 afternoon/evening, ~6h)

1. `POST /v1/chat/completions` (OpenAI-compatible, streaming) that routes a
   message to a workstream run and streams the Writer's answer back.
   Approvals in this mode: the endpoint returns the approval card as text with a
   link to the web composer (keeps the gate real).
2. `docs/openclaw.md`: the custom-provider JSON for OpenClaw pointing at Nimbus
   and, separately, at Token Factory directly (SPEC §8). Test it with a local
   OpenClaw install if time allows; otherwise record the config and mark it
   "tested with curl" honestly.
3. Dockerfile (multi-stage, SQLite file on a volume) → push to a registry →
   `nebius ai endpoint create ... --public` (NEBIUS.md §2). Demo URL = that endpoint.
4. One **Serverless Job** that runs a scheduled workstream headless and writes
   results back to the same DB volume (or posts to the endpoint's API).

**Exit test:** The public endpoint URL loads, a run works there, `curl` to
`/v1/chat/completions` on it streams an answer, and one Serverless Job shows
"completed" in the Nebius console.

### Phase 5 — Submission (Oct 30, must finish by 22:00 ICT, ~6h)

1. README: setup, env vars, "How we used NVIDIA Nemotron", "Where Token Factory
   accelerated the workflow", "Nebius services used", architecture diagram.
2. LICENSE (MIT) visible at repo root. Public repo on `harrymove-ctrl`.
3. Record the 3-minute video (script in SUBMISSION.md). Upload public to YouTube.
4. Devpost form: track, description, demo URL, repo URL, video, feedback.
5. STRETCH if ≥2h remain: `/interface-bts` spec poster of the approval card
   and the timeline playhead; put the PNG in the README.

**Exit test:** Every line of the checklist in SUBMISSION.md is ticked with a URL.

## 3. STRETCH list (only after Phase 4's exit test)

- Direct Telegram bot (grammY) as a second "inside your chat app" path.
- OpenShell sandbox adapter for `run_code` (NVIDIA's sanctioned runtime);
  keep the subprocess sandbox as default, document OpenShell as production path.
- Vision: `nvidia/Nemotron-3.5-Super-VL` for screenshot inputs in a run.
- MemWal (Walrus Memory) adapter behind the memory interface: "your memory,
  encrypted, under your control" fits the track; only if the SDK drops in cleanly.
- `interface-bts` spec poster (Phase 5 item 5).

## 4. Risks and the planned response

| Risk | Response |
|---|---|
| Nemotron JSON mode / structured output unverified on Token Factory | Use function calling for structure (tagged "function calling" on all three). Validate with zod and retry once on parse failure. |
| Reasoning/thinking toggle unverified | Do not depend on it. Ultra is only called for plan + final judgment; keep prompts explicit. If the API returns reasoning content, strip it from the Writer's output. |
| React Bits block names `-2/-5/-6-sorbet` unconfirmed | Verify on pro.reactbits.dev before Phase 0 step 2; fall back to `ai-chat-1-sorbet` + custom approval card if a block is missing. |
| Serverless Endpoint takes ~5 min to create and needs a registry image | Build the image on Oct 29 morning; keep Vercel/Railway as a fallback demo URL and say so in the feedback. |
| Long-running runs inside Next.js | Runs live in a process-global registry; events are persisted, so the UI rebuilds from the DB after a restart. Single container only; that is fine for a demo. |
| Credits run out | Nano for everything in dev (`NIMBUS_DEV_CHEAP=1` forces Nano), Ultra only in demo recordings. |

## 5. Decision log

- 2026-10-27: Track = Personal AI (fallback Best Apps & Agents). Reason: our
  inspirations map 1:1 to the track's requirements and it is the less crowded track.
- 2026-10-27: No framework dependency on OpenClaw/NemoClaw/Hermes. Reason: 3 days.
  Integration is via an OpenAI-compatible endpoint instead.
- 2026-10-27: SQLite over Postgres. Reason: one container, one volume, zero setup.
- 2026-10-27: Own orchestration runtime (~400 lines) over LangChain/Deep Agents.
  Reason: the timeline needs our own event model; frameworks hide it.

## Sources

- Hackathon page: https://nebiusglobalaihackathon.devpost.com/ (details via search snippets; direct fetch returned 403 — re-check the deadline on the page itself)
- Token Factory models and prices: https://tokenfactory.nebius.com/model-catalog.md and https://tokenfactory.nebius.com/api/public/models_info
- Token Factory docs: https://docs.tokenfactory.nebius.com/ (function calling, JSON, embeddings, dedicated endpoints, fine-tuning)
- Serverless endpoints/jobs: https://docs.nebius.com/serverless/endpoints/manage, https://docs.nebius.com/serverless/jobs/manage
- OpenClaw custom providers: https://docs.openclaw.ai/gateway/config-tools/custom-providers
- NemoClaw / OpenShell / Hermes: https://github.com/NVIDIA/NemoClaw, https://github.com/NVIDIA/OpenShell, https://github.com/NousResearch/hermes-agent
- React Bits Pro install: https://pro.reactbits.dev/docs/installation
- Claude Code subagents: https://code.claude.com/docs/en/sub-agents

## 6. Added 2026-10-27 (after the first review): router and evals

Two capabilities added to the spine. Budget: ~5h, taken from the STRETCH
list, never from deploy or video. Specs in SPEC §12–13.

### Phase 1b — Cost-aware model router (inside Phase 1, ~1.5h)

`src/lib/router.ts`: role tiers become ceilings; deterministic rules then a
cached Nano classifier pick the cheapest tier per hop; exact-match response
cache in SQLite; retry-then-fall-one-tier-down on 429/5xx/timeout; `route`
events and a "−X% vs baseline" cost line in the run header.

**Exit test:** `pnpm demo` with `NIMBUS_ROUTER=on` costs at least 40% less
than with `NIMBUS_ROUTER=off` on the seeded workstream, and the event log
shows at least one `route` event with `chosen !== ceiling`. Kill one model id
on purpose: the run completes via fallback and the timeline shows the badge.

### Phase 3b — Trajectory eval harness + CI gate (Oct 29, ~3.5h)

`evals/`: golden trajectories with per-hop assertions (deterministic +
Nano-judged), `pnpm eval` with a pass/fail table and `report.json`,
`--record` to draft goldens from real runs, GitHub Actions gate on PRs.

**Exit test:** 12+ goldens, `pnpm eval` passes ≥90% of hops, `--router on`
vs `off` prints spend −≥50% and pass-rate drop ≤2 points (if not, lower the
router's aggressiveness until it does and report the real numbers), and one
PR on the public repo shows the eval check green.

### What this changes elsewhere
- Timeline (SPEC §6): route badge on segments; header gets the baseline delta.
- README: a "Unit economics" section with the eval report numbers, and an
  "Evals" section with the golden count and the CI gate.
- Video script (SUBMISSION.md) 2:40–3:00: show the cost delta line and the
  eval table instead of only the routing table.
- Decision log: 2026-10-27 — router + evals added; 100+ goldens is post-hackathon.

## 7. Reorder on 2026-10-27 afternoon: Phase 2a before Phase 1

Phase 0 passed (boot screen with the Glow Cloud at localhost:3218). Phase 1's
exit test needs `NEBIUS_API_KEY` and `TAVILY_API_KEY`, which were not yet in
`.env.local`. Rather than idle, the build moves to **Phase 2a**: the full rev B
run view driven by a recorded run (`fixtures/demo-run.events.json`) replayed
over the same SSE and API routes the live runtime will use. Phase 1 then plugs
in behind those routes with no UI change.

**Phase 2a exit test:** open `/`, pick the demo workstream, press RUN; lanes
fill from the fixture, the plan card shows its 3 s cancel, a question card is
answered by a chip, an approval is approved from the tray, the artifact goes
v1 → v2 in the Inspector, the run summary appears, and the composer cycles
idle → planning → running → asked → waiting → idle with the right button labels.

Decision log: 2026-10-27 — Phase 2a (fixture-driven UI) before Phase 1
because the keys were missing and the UI is the demo's hero; the replay
source doubles as the eval harness's mocked-run path later.

## 8. Zero-spend rule (2026-10-27): mock model mode for every phase

The user does not add API keys or spend credits during development. Every
phase runs and passes its exit test with no keys behind one switch:

- `NIMBUS_MODEL=mock` (default whenever `NEBIUS_API_KEY` is empty): a scripted
  model behind the same interface as Token Factory, reading
  `fixtures/mock-model/<role>.json` by role and turn, returning deterministic
  text and tool calls with fake usage, delayed 300–900 ms so the timeline moves.
  Embeddings are hash vectors; Tavily returns `fixtures/search/*.json`.
- `NIMBUS_MODEL=nebius`: real Nemotron via Token Factory. Used only on the
  final day for `pnpm smoke`, the eval baseline numbers, and the demo recording.

Order of work from here: Phase 2a (UI on the recorded run) → Phase 1 runtime in
mock mode → Phase 3 (memory, skills, schedules) → Phase 4 endpoint, all in mock
mode → Phase 3b evals in mock mode → final day: keys in, smoke, real-run
numbers, deploy, video. Expected real spend: under $5 of the free credit.

## 9. Rev E (2026-10-27 night): better cases, better video

The user rejected "checkout conversion" as the demo: generic and not
impressive. `docs/CASES.md` defines six workstreams with a hero, **Ship
Nimbus**, where the crew runs the evals on its own repository, fixes the
failing golden, and opens a pull request only after approval. `SUBMISSION.md`
has video script v2 (2:40) built on it, with the dither background and
numbers from `DITHER.md`. New runtime pieces: `read_repo` and `open_pr`
tools (approval-gated; mock logs the PR), case fixtures, a seed with six
workstreams, and `pnpm demo:video` updated to the v2 beats. Checkout stays as
a template and the eval data case.
