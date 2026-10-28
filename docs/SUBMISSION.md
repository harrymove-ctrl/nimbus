# Submission kit

Deadline **Oct 30, 2026, 10:00 PDT** (00:00 Oct 31 ICT). Re-check on
https://nebiusglobalaihackathon.devpost.com/ before Phase 5 starts.

## Checklist (tick with a URL or a file path)

- [ ] Working project on Token Factory with Nemotron 3 (Ultra/Super/Nano)
- [ ] Track chosen: Personal AI (fallback: Best Apps & Agents)
- [ ] Project description (below, edited to what actually shipped)
- [x] Demo URL: https://nimbus-production-6f7b.up.railway.app (Railway, real Nemotron on Nebius Token Factory, day cap $1; /v1 needs the bearer token). Nebius Serverless Endpoint: not deployed yet
- [ ] YouTube video, public, ≤ 3:00, shows Token Factory + Nemotron in use
- [ ] Public GitHub repo on `harrymove-ctrl`, MIT `LICENSE` at root, visible on the repo page
- [ ] README: setup, env vars, run instructions, "How we used Nemotron / Token Factory / other Nebius services"
- [ ] Feedback on Token Factory, Serverless, and NVIDIA tools (below)
- [ ] Not a pre-existing project (started 2026-10-27), state that
- [ ] Team members added on Devpost; `gh auth status` shows `harrymove-ctrl` before pushing

## Project description (draft, ~250 words)

**Nimbus** is a personal ops room: a glowing cloud that runs your ongoing work
with a crew of NVIDIA Nemotron agents, asks before it acts, and learns from
every run.

You give Nimbus a standing goal ("watch my competitors", "triage my inbox every
morning", "find out why checkout conversion dropped on Oct 14"). Each run, a
Nemotron 3 Ultra orchestrator plans the work and spawns a crew on Nemotron 3
Super and Nano: a Researcher that searches with Tavily, an Analyst that runs
code in a sandbox, a Writer that produces a document or code with versions,
and a Checker that verifies. You watch it on a live timeline, one lane per
agent, with the model badge, handoffs, and the cost ticking in cents. Every
side-effecting action arrives in the composer as an approval card; nothing is
sent, written or executed outside the sandbox until you say yes.

After each run a Learner agent writes memories and rewrites the workstream's
skill file, so run two is better than run one, and you can read exactly what
it learned. Everything is yours: your own database, your own keys, your own
tools, on your own endpoint.

Nimbus is always on: workstreams run on a schedule inside the app and as
Nebius Serverless Jobs, and the app is served from a Nebius Serverless
Endpoint. It exposes an OpenAI-compatible endpoint, so OpenClaw, Hermes Agent
or NemoClaw can use Nimbus as their model and bring it into Telegram, WhatsApp
or Slack with a ten-line config.

Built in three days on Nebius Token Factory with Nemotron 3 Ultra, Super and
Nano, routed by role so reasoning goes to Ultra and the fast calls stay cheap.

## Video script (3:00, record at 1080p, dark theme)

| Time | Screen | Voice |
|---|---|---|
| 0:00–0:15 | Boot screen, Glow Cloud blinking, follows the cursor, wink on click | "This is Nimbus. A cloud that runs your ongoing work with a crew of Nemotron agents." |
| 0:15–0:40 | Workstream list → open "Checkout conversion drop on Oct 14" → press Run | "You give it a standing goal. Each run, a Nemotron 3 Ultra orchestrator plans, then spawns a crew on Super and Nano." |
| 0:40–1:20 | Timeline fills live: lanes, model badges, dotted spawn connectors, playhead, cost counter | "Every agent gets its own lane and model badge. Researcher searches with Tavily, Analyst runs code in a sandbox, the Checker verifies on Nano for cents. All of it through Nebius Token Factory." |
| 1:20–1:50 | Cloud turns orange; approval card in the composer; Approve; artifact panel bumps to v2 | "When it wants to act, it asks. Nothing is sent or written until you approve. The result lands as a versioned document." |
| 1:50–2:15 | Run summary shows memories + SKILL.md diff; run again, faster | "After every run a Learner writes memories and rewrites the skill file. Run two already knows what run one learned." |
| 2:15–2:40 | Terminal: curl to `/v1/chat/completions` on the Nebius endpoint; OpenClaw config; message from Telegram answered | "It is always on: served from a Nebius Serverless Endpoint, scheduled runs as Serverless Jobs, and an OpenAI-compatible endpoint so OpenClaw brings it into your chat apps." |
| 2:40–3:00 | Repo README, model routing table, cost line | "Three Nemotron tiers, routed by role. Open source, MIT. Nimbus." |

## Feedback draft (required field)

- Token Factory: the OpenAI-compatible API made the AI SDK integration a
  one-liner; function calling on all three Nemotron tiers was reliable. We
  could not find a documented reasoning on/off parameter or a JSON-mode tag
  for Nemotron; both would save prompt engineering. Model id casing differs
  between the catalog and the models_info JSON. Fine-tuning Nemotron Nano
  (for a cheap Checker) is the feature we wanted most.
- Serverless: endpoint creation worked from the CLI; a `--dockerfile`/build
  step and a logs tail in the CLI would shorten the loop. Jobs + volumes fit
  "always-on personal agents" well.
- NVIDIA tools: NemoClaw's onboarding wizard should accept any OpenAI-compatible
  base URL explicitly (Token Factory); OpenShell's macOS/Podman path needs a
  clear install page for app developers.
- (Fill in what actually happened; keep it specific; the "Most Valuable Feedback" prize is $100.)
