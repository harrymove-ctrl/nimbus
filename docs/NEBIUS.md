# Everything we can use from Nebius and NVIDIA — and what Nimbus uses

Inventory as of 2026-10-27. "Use" column: **core** = in the spine,
**stretch** = after Phase 4, **no** = not for this build. Judges want to see
Nemotron + Token Factory highlighted, plus any other Nebius service; the
"core" rows are what the README and video must show.

## 1. Nebius Token Factory (inference platform) — https://tokenfactory.nebius.com

| Capability | What it is | Nimbus use |
|---|---|---|
| Chat completions (OpenAI-compatible) | `POST /v1/chat/completions`, Bearer `NEBIUS_API_KEY` | **core** — every agent call |
| Responses API | `POST /v1/responses`, tagged on the Nemotron cards | no (AI SDK uses chat completions) |
| Function calling | Tagged on Ultra/Super/Nano | **core** — all structure via tools |
| JSON mode (`response_format`) | Documented generally; not tagged on Nemotron cards | no (unverified on Nemotron) |
| Reasoning models | Nemotron 3 tagged "reasoning" | **core** (Ultra for planning); toggle param unverified |
| Nemotron 3 Ultra 550B-A55B | 1M ctx, $1/$3 | **core** — Orchestrator |
| Nemotron 3 Super 120B-A12B | 256K ctx, $0.30/$0.90 | **core** — Researcher, Analyst, Writer |
| Nemotron 3 Nano 30B-A3B | 262K ctx, $0.06/$0.24 | **core** — Checker, Learner, dev mode |
| Nemotron 3.5 Super VL | image + video input, 1M ctx | stretch — screenshots in a run |
| Nemotron 3.5 Lightning | cheap fast model, 1M ctx | no (Nano already covers it) |
| Embeddings `/v1/embeddings` | Non-NVIDIA embedding models on the catalog | **core** — memory vectors |
| Prompt caching | Cached-input price on Ultra/Super | **core** by default — keep the role prompt as a stable prefix |
| Dedicated endpoints | Reserved capacity for a model | no |
| Fine-tuning (LoRA) | Llama/Qwen/GPT-OSS; no Nemotron in the list | no (mention in feedback: we'd fine-tune the Checker) |
| Data Lab / data processing | Dataset ops | no |
| Cookbook | https://github.com/nebius/token-factory-cookbook | reference |

## 2. Nebius Serverless AI — https://docs.nebius.com/serverless

| Capability | What it is | Nimbus use |
|---|---|---|
| Serverless Endpoints | Container hosting with a public URL, ~5 min create, token auth optional, billed while running | **core** — the demo URL |
| Serverless Jobs | One-off container jobs, 1–168h timeout, VM deleted at end | **core** — scheduled headless workstream runs |
| Preemptible GPU presets | Spot pricing | no |
| Volumes | Persist after jobs | **core** — SQLite DB + workspaces |
| Cookbook | https://github.com/nebius/serverless-ai-cookbook | reference |

## 3. Nebius AI Cloud (infrastructure) — https://docs.nebius.com

| Capability | Nimbus use |
|---|---|
| GPU VMs / clusters, Managed Kubernetes, Soperator (Slurm) | no |
| Object Storage (S3-compatible) | stretch — artifact exports |
| Managed PostgreSQL | no (SQLite) — would be the first upgrade |
| Nebius Echo (console AI agent, AI Cloud 3.6) | no, mention in feedback |
| Nebius Agents Blueprint (Token Factory + LangChain Deep Agents reference) | reference only; Nimbus has its own runtime |
| Tavily (acquired by Nebius, Feb 2026) | **core** — Researcher search; Best Use of Tavily prize |
| Builder Program | **core** — +$25 Token Factory, Tavily and Academy credits |
| Nebius Academy | no |

## 4. NVIDIA open-source tools named by the Personal AI track

| Tool | What it is | Nimbus use |
|---|---|---|
| Nemotron 3 (Ultra/Super/Nano) | Open-weight NVIDIA models | **core** |
| NemoClaw | Reference stack: OpenClaw/Hermes/Deep Agents inside OpenShell sandboxes, managed inference | documented path: point its provider at Nimbus's `/v1` or at Token Factory |
| OpenShell | Kernel-enforced sandbox runtime for agents (CLI + SDKs) | stretch — `run_code` adapter |
| Hermes Agent (Nous Research) | Self-improving agent with a learning loop, gateway to Telegram/Discord/Slack/WhatsApp | pattern borrowed (Learner + SKILL.md); can use Nimbus as "your own endpoint" |
| OpenClaw | Local-first personal assistant in chat apps (Telegram, WhatsApp, Slack, Discord, iMessage, Signal, Teams…) | **core** integration via custom provider config (SPEC §8) |
| GROOT / Cosmos / Sonic | Physical AI models | no |

## 5. What to say in the submission's "Nebius / NVIDIA usage" section

- Three Nemotron tiers, routed by role, all through Token Factory's
  OpenAI-compatible API with function calling; per-run token and cost
  accounting shown live in the UI.
- Prompt-cache-friendly prompts (stable role prefix) to use the cached-input price.
- Demo hosted on a Nebius Serverless Endpoint; nightly runs as Nebius Serverless Jobs on a shared volume.
- Researcher agent searches with Tavily.
- OpenClaw/Hermes/NemoClaw reach Nimbus through its OpenAI-compatible endpoint.
