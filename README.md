# Nimbus

A glowing cloud that runs your ongoing work with a crew of NVIDIA Nemotron agents,
asks before it acts, and learns from every run.

Built for the Nebius x NVIDIA Global AI Hackathon (Personal AI track). Started 2026-10-27 as a new project.

> **Status, stated plainly.** Everything below runs today with **no API keys** against a scripted
> *mock model*. The real Nemotron / Token Factory path is written but has **not been run yet**:
> `pnpm smoke` (the one command that needs `NEBIUS_API_KEY`) is scheduled for the final day.
> Numbers below marked *(mock)* come from scripted token counts, not measured spend.

## Run it in two minutes (no keys)

```bash
pnpm install
cp .env.example .env.local        # leave the keys empty: Nimbus falls back to the mock model
pnpm dev                          # http://localhost:3000
pnpm demo                         # headless run of the demo workstream, prints usage and cost
```

Open the app, pick **Checkout conversion drop on Oct 14**, type a goal, press **RUN**. You get a plan with a 3 s
cancel window, a timeline with one lane per agent, a question to answer, an approval card to accept, and a document
that goes v1 → v2. Afterwards the Learner writes memories and rewrites the workstream's `SKILL.md`.

| Command | What it checks |
|---|---|
| `pnpm demo` | Phase 1 exit test: ≥ 3 agents concurrently, a doc artifact, one approval, under 60 s, usage and cost |
| `pnpm demo:router` | Router: cost with it off vs on, forced 429 and bad model id fall one tier down, response cache |
| `pnpm eval [--cheap] [--router on\|off] [--only a,b] [--ab]` | 15 trajectory goldens, per-hop assertions, `evals/report.json`; exit 1 under 90 % or any failed final |
| `pnpm check:loop` | Run 2's prompt contains run 1's memories and SKILL.md; policy honored; revert works |
| `pnpm check:cron` | A cron-triggered run appears without a click and sets the unread dot |
| `pnpm run:job --workstream ws-mezo --yes` | Headless entrypoint for a Nebius Serverless Job |
| `pnpm demo --record <name>` | Drafts a golden from a run (empty `expect` arrays to fill in) |
| `pnpm demo:video` | Records `docs/demo/nimbus-demo.webm` (+ `.mp4` with ffmpeg) with Playwright against a running dev server: boot, run, question, approval, summary, second run with the ✦ learned chip. Needs a local Chrome; not runnable in the restricted dev sandbox |
| `pnpm smoke` | **Real** Token Factory: three tiers answer, Nano makes a function call. Needs `NEBIUS_API_KEY` |

## Environment

| Variable | Purpose |
|---|---|
| `NIMBUS_MODEL` | `mock` or `nebius`. Default: `nebius` if `NEBIUS_API_KEY` is set, else `mock` |
| `NEBIUS_API_KEY`, `NEBIUS_BASE_URL` | Nebius Token Factory (OpenAI-compatible) |
| `TAVILY_API_KEY` | Researcher search; without it (or in mock mode) `fixtures/search/*.json` answers |
| `NIMBUS_API_TOKEN` | Bearer for `/v1/chat/completions`; empty = open in dev, closed in production |
| `NIMBUS_DATA_DIR` | SQLite file and run workspaces (default `./data`) |
| `NIMBUS_ROUTER` | `on` (default) or `off` (pin every hop to its role's ceiling tier) |
| `NIMBUS_DEV_CHEAP` | `1` forces every role to Nano while developing against real models |

## How it works

```mermaid
flowchart LR
  U([You]) -->|goal, steer, answer, approve| UI[Run view<br/>timeline · transcript · inspector]
  UI <-->|SSE events + POST| API[Next.js API routes]
  CHAT[OpenClaw / Hermes] -->|/v1/chat/completions| API
  CRON[node-cron · pnpm run:job] --> API
  API --> RT[Runtime<br/>bus · agent loop · orchestrator]
  RT --> R{Router<br/>rules → Nano classifier<br/>retry → one tier down}
  R -->|ceiling · super · nano| TF[(Nebius Token Factory<br/>Nemotron 3 Ultra / Super / Nano)]
  R -.->|no key| MOCK[Scripted mock model]
  RT --> T[Tools: web_search · fetch_url · run_code · write_artifact · send_message]
  RT --> DB[(SQLite · libsql + drizzle<br/>events · artifacts · memories · skills · llm_cache)]
```

**The crew.** An Orchestrator (Nemotron 3 Ultra) plans, spawns agents concurrently, hands off, asks you before any
action with side effects, and finishes. Researcher, Analyst and Writer run on Super; Checker and Learner on Nano. Those
tiers are *ceilings*: the router picks the cheapest tier each hop needs (deterministic rules first, then a cached Nano
classifier) and falls one tier down on 429, 5xx, timeout or a bad model id. It never falls up.

**Approvals are a real gate.** `send_message` (and anything risky) waits for you: *Approve*, *Approve & always allow*
(writes an `allow:` line into the workstream's `SKILL.md`, honored on the next run), or *Reject with a note*.

**It learns.** After each run the Learner (Nano) saves memories (embedded; top-k go into the next run's prompt) and
rewrites `SKILL.md`. The diff is in the run summary, with a **Revert skill change** button.

**Always on.** `node-cron` inside the app starts scheduled workstreams; `pnpm run:job` is the headless entrypoint for
Serverless Jobs. **In chat apps:** `POST /v1/chat/completions` ([docs/openclaw.md](docs/openclaw.md)).

## How we use NVIDIA Nemotron and Nebius

| Tier | Token Factory id (checked against the live catalog 2026-10-27) | Used by | $/1M in/out |
|---|---|---|---|
| Ultra | `nvidia/Nemotron-3-Ultra-550b-a55b` | Orchestrator (plan, approvals, final judgment) | 1.00 / 3.00 |
| Super | `nvidia/nemotron-3-super-120b-a12b` | Researcher, Analyst, Writer | 0.30 / 0.90 |
| Nano | `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` | Checker, Learner, router classifier, judge | 0.06 / 0.24 |

- **Token Factory:** one OpenAI-compatible provider through the Vercel AI SDK; structure comes from tool calls
  (zod schemas), not JSON mode; role prompts are a stable prefix so the cached-input price applies.
  *Not yet run against the real API.*
- **Tavily** for the Researcher's search (Tavily is a Nebius company). *Fixtures until a key is set.*
- **Serverless Endpoint and Jobs:** `Dockerfile` and [docs/deploy.md](docs/deploy.md) are written with the exact
  commands. *Not built or deployed yet* (no Docker daemon in the dev environment).

## Router and eval numbers

- `pnpm demo:router` *(mock)*: the demo run costs **44.8 % less** with the router on than pinned to ceilings
  ($0.023 vs $0.042); a forced 429 and a bad model id (404) both fall to Nano and complete; cache hits cost $0.
- `pnpm eval:ab` *(mock)*: over the 13 goldens both settings run, spend is **−42.6 %** with the router on and the pass
  rate is **+0.0 pp**. In mock mode outputs are scripted and do not depend on the tier, so this does **not** demonstrate
  "under 2 % quality drop". That claim needs `NIMBUS_MODEL=nebius`.
- 15 goldens across the three workstreams, 113 assertions, all passing; a deliberately wrong golden fails the gate.
  The target after the hackathon is 100+ goldens from recorded runs.

## What is not verified yet

Real Nemotron calls (`pnpm smoke`, real classifier, real embeddings, real Tavily) · the Docker image · the Nebius
deployment · the GitHub Actions workflow · OpenClaw against `/v1` · the phone layout · a production `next build`.
`run_code` is a temp-dir subprocess with a stripped environment and a 30 s timeout; it does not block the network
(OpenShell is the production path).

## Stack

Next.js 15, React 19, TypeScript, Tailwind v4, shadcn, React Bits Pro (Sorbet), Manrope, Vercel AI SDK v7, libsql +
drizzle, node-cron, pnpm. Planning docs: [docs/PLAN.md](docs/PLAN.md), [docs/SPEC.md](docs/SPEC.md).

## License

MIT, see [LICENSE](LICENSE).
