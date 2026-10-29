# Submission kit

Deadline **Oct 30, 2026, 10:00 PDT** (00:00 Oct 31 ICT).
Hackathon page: https://nebiusglobalaihackathon.devpost.com/

## Checklist

- [x] Working project on Nebius Token Factory with NVIDIA Nemotron 3 (Ultra, Super, Nano)
- [x] Track chosen: **Personal AI** (fallback: **Best apps and agents**)
- [x] Live Demo URL: https://nimbus-production-6f7b.up.railway.app (landing page with 9 real-run video loops at https://nimbus-production-6f7b.up.railway.app/welcome; runs live Nemotron 3 on Nebius Token Factory with a $1/day cap; includes finished Morning Brief `run_0c6cdb23` at $0.0224 and live `/v1/chat/completions` run `run_6b393ab6` at $0.0282)
- [x] Public YouTube video (2:40, under the 3:00 limit, 100% real-model footage from take 1915): https://www.youtube.com/watch?v=obMWKCewVTY
- [x] Public GitHub repository with MIT `LICENSE` at root: https://github.com/harrymove-ctrl/nimbus
- [x] README with setup, environment variables, run instructions, and "How I used Nemotron and Token Factory": [README.md](../README.md)
- [x] Devpost story ("About the project") synced with Oct 29 live numbers and zero dashes (below)
- [x] Devpost "Additional info" form answers and Nebius/NVIDIA feedback filled out with zero placeholders (below)
- [x] New project started Oct 27, 2026 after the Submission Period opened

---

## 1. Elevator pitch (max 200 characters)

Pick one of these clean, one-sentence lines:

**Option A (matches `/welcome` headline, 99 characters):**
```text
Your standing work, done every morning by a crew that asks before it acts and gets better every run.
```

**Option B (names Nemotron + the core loop, 118 characters):**
```text
A visual ops room where a crew of NVIDIA Nemotron agents runs your morning work, asks before sending, and learns daily.
```

**Option C (contrasts with blind chat agents, 128 characters):**
```text
See every agent, every step, and every cent on a live timeline while a crew of Nemotron agents runs your daily work and asks first.
```

---

## 2. Devpost "About the project" (Story Page Markdown)

Copy and paste the Markdown block below directly into the Devpost **About the project** editor:

```markdown
> **Quick Links:** [9-Clip Visual Tour (`/welcome`)](https://nimbus-production-6f7b.up.railway.app/welcome) · [Live App on Railway](https://nimbus-production-6f7b.up.railway.app) · [2:40 Video (YouTube)](https://www.youtube.com/watch?v=obMWKCewVTY) · [GitHub Repo (MIT)](https://github.com/harrymove-ctrl/nimbus)

## Inspiration

Every weekday starts the same way: inbox, calendar, GitHub notifications, half an hour of reading, and then writing the same kinds of replies as yesterday. Plenty of agents in 2026 can read an inbox or run on a schedule, so that chore alone is not the hard part anymore.

The hard part is what happens once you actually leave personal agents running every day. While building with the tools in this track, I kept hitting three walls:

1. **One big model for every step burns through your credits.** If a scheduled agent routes every file read, retry loop, verification check, and memory update through a single frontier model, a week of background jobs costs more than the chore is worth.
2. **Chat windows hide the work, while hosted clouds lock you in.** Tools like OpenClaw and Hermes Agent are great for talking to an agent from Telegram or Slack, and NemoClaw and OpenShell give an agent a sandbox. But when a run makes 20 tool calls across multiple roles, a single chat thread cannot show you which agent read which file, why a step retried, or what each hop cost. Hosted SaaS assistants go the other way and lock your data, memories, and learned rules inside a black box you do not own.
3. **Approvals rarely turn into rules you can read and revoke.** Most assistants either act without asking or ask you for the exact same permission every single morning because yesterday's approval never updates the agent's skill file.

The core idea of the Nebius and NVIDIA Global AI Hackathon and the Nebius AI Builder Program is to build on open infrastructure you own end to end, reach for `Nemotron 3 Ultra` only where serious reasoning matters, and let `Super` and `Nano` handle the fast everyday calls so your credits stretch further. I built **Nimbus** to be the operations room for that kind of agent crew.

---

## What it does

**Nimbus** is a self-hosted personal operations room that runs your standing jobs with a crew of NVIDIA Nemotron 3 agents on Nebius Token Factory, shows you every step and its live token cost on a timeline, waits for your yes before anything leaves the app, and rewrites its own `SKILL.md` file after every run.

### 1. Plan and price before anything runs
When you give Nimbus a standing job like *"Every weekday at 8, read my inbox, calendar, and GitHub, tell me what needs me, and draft the replies,"* an Orchestrator on `Nemotron 3 Ultra 550B` plans the run first. It shows you who does what, which tools are allowed, and the estimated cost before anything executes. You can edit, reorder, or add steps to the draft plan, then click **Approve plan**.

### 2. Watch the crew on a live timeline
As the run executes, the crew works in parallel on a live timeline with one row per agent, a model badge on every hop, and the price ticking in cents in the header. `Nemotron 3 Super 120B` runs the Researcher, the Analyst, and the Writer; `Nemotron 3 Nano 30B` runs the Checker and the Learner. Every step is open: click any bar on the timeline to inspect the exact email, calendar invite, file, or command output that agent read.

### 3. Approvals that turn into revocable rules
Nothing with an outside side effect leaves without you. When the Writer wants to send a reply or open a pull request, the cloud mascot turns orange and the action lands in your tray as an approval card. You can approve it once, reject it with a note, or click **Approve & always allow**, which writes a plain-text `allow:` rule into that workstream's `SKILL.md` file (for example, `allow: send_message to reviewer@example.com`) that you can read or revoke anytime.

### 4. Learning you can read and revert
After the run finishes, a Learner agent on `Nemotron 3 Nano 30B` extracts vector memories and rewrites the workstream's `SKILL.md` file with a side-by-side diff and a one-click **Revert** button. When the job runs again the next morning, it starts with what it learned, sends the pre-approved reply automatically under your rule without interrupting you, and costs less.

### 5. Same crew in your chat app (`/v1/chat/completions`)
Nimbus exposes an OpenAI-compatible `/v1/chat/completions` endpoint, so OpenClaw, Hermes Agent, or NemoClaw can point at it with ten lines of config. You can ask `"what needs me?"`, start a run, and approve pending cards straight from your phone while every step records into the exact same web timeline.

### Standing workstreams included
- **Morning Brief:** Reads your inbox export, calendar, and GitHub notifications at 08:00 into a ranked one-page brief and holds three drafted replies in the approval tray.
- **Ship Nimbus (Self-Maintaining Repo Crew):** Runs `pnpm eval` and `pnpm typecheck` on its own repository, reproduces a failing router test in a sandbox, asks you inline whether to fix the router or the test golden, drafts a unified diff patch, and waits for approval before opening a GitHub PR.
- **Token Factory Cost Audit & Watch:** Audits Nimbus's own SQLite call log, runs A/B trajectory evaluations (`pnpm eval:ab`), and proposes `router-rules.json` changes that cut run spend by an additional **15.3%**.
- **Hackathon Radar:** Scheduled research using **Tavily** web search that compares updates against yesterday's memories and queues a three-bullet digest for approval.

Every workstream on the live demo has at least one finished run on the real models (Oct 29, 2026, UTC), so a judge can open any of them and read the plan, the lanes, the approvals and the cost: Morning brief `run_782c6eff` (cron 08:00, $0.020) and `run_0c6cdb23` ($0.022); Hackathon radar `run_3066dc6c` (cron 09:00, $0.013); Ship Nimbus `run_ebcd619b` ($0.016, 15 model calls, 13 tool calls); Token Factory cost audit `run_876af0c5` ($0.005); Token Factory watch `run_fb68d365` ($0.046, 54 model calls); Release watch `run_85b5b8e6` ($0.027; its "open PR: Upgrade Next.js to v16.4.3" card was rejected with a note, so the gate is on record); Checkout conversion drop `run_bd1ee7a8` ($0.077, the reply to #growth approved). Nothing on the demo is mock: `/api/budget` reports `mock: false` and every run carries real Nemotron usage events.

### Measured numbers on live Nebius Token Factory runs

All numbers below come from real NVIDIA Nemotron 3 runs on Nebius Token Factory ([release notes](https://github.com/harrymove-ctrl/nimbus/blob/main/docs/video/RELEASE.md)):

| Run | Cost | Tokens | Calls (Model / Tool) | Ceiling Baseline | Router Saving | Outcome |
|---|---|---|---|---|---|---|
| **Morning Brief Run 1** (`run_724b8d9d`) | **$0.0216** | 58,950 | 23 / 21 | $0.0283 | **24%** | 1 plan, 1 brief page, 3 replies approved; saved 1 `allow:` rule |
| **Morning Brief Run 2** (`run_915dfc1d`) | **$0.0209** | 57,015 | 20 / 18 | $0.0287 | **27%** | **3% cheaper** than Run 1; reviewer reply sent under rule with no card; **16 memories** held |
| **Live Chat API Run** (`run_6b393ab6`) | **$0.0282** | 76,827 | 24 / 21 | N/A | N/A | Triggered and approved end to end via `/v1/chat/completions`; 8 memories saved |
| **Unapproved sends** | **$0.0000** | 0 | 0 / 0 | N/A | N/A | Every outgoing action waited for human approval or matched an active rule |

---

## How I built it

I built Nimbus solo in three days starting Oct 27, 2026 using **Next.js 15**, **React 19**, **TypeScript**, **Tailwind v4**, **React Bits Pro (Sorbet)**, **`dithercn`** for the Bayer-dithered shaders and charts, and **SQLite** (`libsql` with Drizzle ORM) for all local state, including SSE run events, versioned artifacts, vector embeddings, `SKILL.md` revisions, and an LLM response cache.

### Model routing on Nebius Token Factory
The entire model layer is a single Vercel AI SDK provider (`src/lib/tokenfactory.ts`) pointed at Nebius Token Factory's OpenAI-compatible API (`https://api.tokenfactory.nebius.com/v1`). Role system prompts keep a stable prefix so Token Factory's cached-input pricing applies automatically, and all structured outputs are enforced through Zod tool schemas.

| Tier | Token Factory Model ID | Assigned Roles | Price ($ / 1M in / out) | Why this size |
|---|---|---|---|---|
| **Ultra** | `nvidia/Nemotron-3-Ultra-550b-a55b` | Orchestrator | $1.00 / $3.00 | 1 to 2 calls per run where planning, routing, and approval framing matter |
| **Super** | `nvidia/nemotron-3-super-120b-a12b` | Researcher, Analyst, Writer | $0.30 / $0.90 | 256K context fits a full morning's inputs for search, code, and drafting |
| **Nano** | `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` | Checker, Learner, Router Classifier | $0.06 / $0.24 | 1/16th of Ultra's input cost for high-frequency verification and memory extraction |

Those role assignments act as ceilings rather than fixed tiers. Before each hop, the cost router (`src/runtime/router.ts`) checks deterministic rules and a cached Nano classifier to pick the cheapest tier that can handle the step. If a call hits a `429` rate limit, `5xx`, or timeout, the router falls one tier down (Ultra to Super to Nano) and never up, protecting both reliability and the hard per-run and per-day spend caps (`NIMBUS_RUN_CAP_USD` and `NIMBUS_DAY_CAP_USD`).

### Zero-key judge mode and evaluation suite
So judges can test the entire app in two minutes without API keys, `pnpm dev` runs out of the box against a deterministic scripted mock model whenever `NEBIUS_API_KEY` is unset, and switches to live Nebius Token Factory models as soon as a key is added. Every change is gated by **19 trajectory evaluation goldens (145 per-hop assertions)** and **27 end-to-end checks** (`pnpm eval`, `pnpm check:cases`, `pnpm check:rules`, `pnpm check:learning`, `pnpm check:budget`).

---

## Challenges I ran into

Building against a scripted mock model let me ship the UI and state machine fast, but it hid how real models behave in a multi-agent loop. When I pointed Nimbus at live Nemotron 3 models on Nebius Token Factory across six recording attempts (spending about **$0.49** across **198 real model calls**), seven real issues surfaced that the mock never hit:

1. **Missing source paths in the brief:** On the first live run, the Researcher immediately stopped and asked where my inbox lived because its prompt did not name the local file paths. I updated `SKILL.md` to declare exact sources (`fixtures/inbox/*.eml`, `fixtures/calendar.ics`, and `fixtures/github-notifications.json`) upfront.
2. **Burning all turns reading without reporting:** The Researcher read one file per turn, used up all 8 of its turns, and exited without writing a report. I fixed that by raising child agent budgets to 12 turns and making the final turn a tool-free synthesis step so every agent is guaranteed to return a report.
3. **Dropped reports during handoffs:** The Orchestrator literally wrote `"Researcher's report: … (include the report)"` instead of pasting the text, forcing the Writer to re-read every raw file from scratch. I changed the runtime bus so handoffs automatically attach prior crew reports.
4. **Drafting replies without calling the send tool:** The Writer drafted all three email replies inside a markdown document without ever calling `send_message`, because its system prompt focused on writing documents rather than taking actions. I updated the Writer prompt to call `send_message` once per reply and explained that `send_message` itself raises the approval gate.
5. **Ungrounded status claims:** In one live run, a drafted reply told a reviewer that a login fix `"has shipped"` when the GitHub notification only said the pull request was in review. I tightened both the Writer and Checker prompts to ground every status claim strictly in the latest source text.
6. **Thinking tokens starving tool calls on Nano 30B:** The Learner agent on `Nemotron 3 Nano 30B` spent its entire 600 to 1,500 token output budget inside `<think>` blocks and got cut off before calling `save_learning`. Turning thinking mode off (`chat_template_kwargs.enable_thinking = false`) and requiring the tool call dropped the Learner's output from over 690 tokens down to **102 tokens**, saving memories and rewriting `SKILL.md` cleanly on every run after.
7. **Mismatched tool parameter keys in Run 2:** In Run 2, the Orchestrator sometimes raised send actions itself using `{ to, body }` instead of the Writer's `{ channel, text }`, which prevented the saved `allow:` rule from matching until I normalized tool arguments across roles.

Every one of these fixes is committed with a regression test and documented with run IDs in [`docs/video/RELEASE.md`](https://github.com/harrymove-ctrl/nimbus/blob/main/docs/video/RELEASE.md).

---

## Accomplishments that I'm proud of

I am proud that the product, the live deployment, and the 2:40 video are backed by real, verifiable runs on Nebius Token Factory rather than slides or mocked screenshots. You can open [`/welcome`](https://nimbus-production-6f7b.up.railway.app/welcome) and watch nine video loops cut directly from the recorded real-model take, where Run 1 costs **$0.0216**, the router saves **24%**, the approval gate writes a real rule into `SKILL.md`, and Run 2 finishes cheaper at **$0.0209** while sending the ruled reply automatically with no card.

I am also proud of the human control model: every external action waits as a card, every saved rule is a plain-text line you can revoke, every `SKILL.md` rewrite has a diff and a Revert button, and the entire repository still runs locally in two minutes with `pnpm dev` and zero API keys so anyone can inspect it.

---

## What I learned

First, I learned that Nemotron 3 tool calling is reliable across all three model tiers on Nebius Token Factory. Ultra, Super, and Nano all handled structured Zod tool schemas cleanly through the OpenAI-compatible API. Whenever a multi-agent run failed in practice, the culprit was almost always dropped context between agent handoffs, unnormalized tool parameters, or missing file paths in the brief rather than model tool syntax.

Second, I learned that small reasoning models need explicit thinking budgets. `Nemotron 3 Nano 30B` is fast and cheap at $0.06 per 1M input tokens, but leaving reasoning enabled on single-shot structured extraction tasks will eat through `max_tokens` before the tool call is emitted. Turning thinking off (`chat_template_kwargs.enable_thinking = false`) for the Learner made its output six times smaller (102 tokens instead of 690+) and completely reliable.

Finally, I learned that live per-token pricing from the API is a product feature in its own right. Once the runtime knows the exact price of Ultra, Super, and Nano on every hop, cost stops being a surprise bill at the end of the month. The app can estimate the price before a run starts, display cent-by-cent spend on the timeline, stop automatically at a daily cap, and audit its own Token Factory bill.

---

## What's next for Nimbus

Next, I plan to move the Analyst's `run_code` step from a restricted local subprocess into isolated **Nebius Token Factory Sandboxes** and **NVIDIA OpenShell** containers right next to the models (beta access requested). I also want to fine-tune `Nemotron 3 Nano 30B` on our trajectory evaluation dataset as a dedicated, ultra-cheap Checker, deploy the container image directly on a **Nebius Serverless Endpoint** alongside scheduled **Nebius Serverless Jobs**, and bring `Nemotron 3.5 Super VL` into the Researcher and Analyst lanes so workstreams can inspect screenshots, invoices, and PDFs on the same Token Factory endpoint.
```

---

## 3. Devpost "Additional Info" Form Answers (Ready to Paste)

| Field | Answer |
|---|---|
| Submitter type | Individual |
| Organization Name | N/A |
| Country | Vietnam |
| Canada Province | N/A |
| Track | Personal AI (or Best apps and agents) |
| New or existing | New. Started October 27, 2026, after the Submission Period opened. |
| If existing, explain updates | N/A (Brand-new project built from scratch during the hackathon starting October 27, 2026 around Nebius Token Factory and NVIDIA Nemotron 3). |
| Repository URL | https://github.com/harrymove-ctrl/nimbus |
| Demo URL | https://nimbus-production-6f7b.up.railway.app |
| Video URL | https://www.youtube.com/watch?v=obMWKCewVTY |
| Used Tavily? | Yes. The Researcher agent's `web_search` tool (`src/runtime/tools.ts`) calls the live Tavily API (`tavily().search`, 5 results per query) whenever `TAVILY_API_KEY` is configured. |
| AI tools used while building | Claude Code, Antigravity, Suno (custom background music), Remotion and snapcn (video production). |
| Learning derived | Significant |
| AI value for your career | Yes |

### Which model(s) did you use, and why did you choose that size/variant?
```text
I used all three NVIDIA Nemotron 3 tiers on Nebius Token Factory, routed by agent role (`src/lib/models.ts`) so each step uses the smallest model that can do the job reliably:

1. nvidia/Nemotron-3-Ultra-550b-a55b ($1.00 / $3.00 per 1M tokens) for the Orchestrator only. It runs once or twice per job to break the goal into a plan, coordinate handoffs, and write approval requests where deep reasoning matters most.

2. nvidia/nemotron-3-super-120b-a12b ($0.30 / $0.90 per 1M tokens, 256K context) for the Researcher, Analyst, and Writer. These agents make the bulk of the tool calls (reading multi-file sources, running code and tests, searching with Tavily, and drafting patches or replies), and Super's 256K context fits a full morning's inputs in one call at less than one third the price of Ultra.

3. nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B ($0.06 / $0.24 per 1M tokens) for the Checker, the Learner, and the cost router's step classifier. Verification and memory writing run after every step and every job, so they have to be fast and cheap. Nano costs 1/16th of Ultra per input token.

On our recorded live Morning Brief take on Nebius Token Factory (Oct 29, run_724b8d9d), Run 1 cost $0.0216 across 58,950 tokens compared to $0.0283 with every hop pinned to its ceiling tier, saving 24%. Run 2 (run_915dfc1d) cost $0.0209 (27% saved vs. ceiling).
```

### How would you rate Nemotron's output quality? (1 to 10)
**Rating:** `9`
```text
9/10. Function calling worked reliably across all three Nemotron 3 tiers (Ultra, Super, and Nano), which made it possible to run the entire multi-agent crew through structured Zod tool calls without custom parsers. Ultra produced clean, well-ordered execution plans on the first try, and Super handled multi-file inbox, calendar, and GitHub synthesis accurately within its 256K context window. The one quirk we had to engineer around was on Nano 30B: with thinking enabled by default, Nano spent its entire 600 to 1,500 output token budget inside <think> blocks before emitting the save_learning tool call. Passing chat_template_kwargs.enable_thinking = false solved it immediately and dropped output usage to 102 tokens.
```

### Did you fine-tune, prompt-engineer, or use the model out of the box?
```text
Out of the box with prompt engineering and self-updating skill files. Each agent role has a stable system prompt prefix (for cached-input pricing) and strict Zod tool schemas, and the runtime prepends the workstream's SKILL.md file and top-k recalled memories before each run. After every run, the Learner agent on Nemotron 3 Nano rewrites SKILL.md and extracts new memories, so the effective prompt improves from run to run without weight training. With more time, fine-tuning Nano 30B as a dedicated Checker is our first next step.
```

### How did Nemotron compare to other models you've tried for similar tasks?
```text
For multi-agent tool calling, the three-tier Nemotron 3 family on Nebius Token Factory matched the reliability we normally get from closed mid-tier frontier models at a fraction of the cost per token. Having Ultra, Super, and Nano share the same model family and OpenAI-compatible endpoint made cost routing trivial: Ultra planned as well as larger closed reasoning models, Super handled heavy read/write loops at $0.30/$0.90 per 1M tokens, and Nano gave us a $0.06/1M tier for verification and memory extraction once we disabled thinking tokens for single-shot calls.
```

### Which Nebius platform capabilities were most valuable, and how did they accelerate your workflow?
```text
1. Nebius Token Factory's OpenAI-compatible API (`https://api.tokenfactory.nebius.com/v1`): Our entire inference and embedding layer is a single Vercel AI SDK provider (`src/lib/tokenfactory.ts`), so routing across Nemotron 3 Ultra, Super, and Nano is a single string change per hop.
2. Transparent per-token pricing and cached-input discounts: Because Token Factory exposes clear per-tier pricing, Nimbus prices every agent call live in the UI header, enforces hard per-run and daily spend caps, and runs a Token Factory Watch workstream that audits its own call log to propose cheaper routing rules.
3. Tavily integration: Having Tavily web search in the same ecosystem made wiring grounded web research into the Researcher agent a 15-line tool definition.
```

### How likely are you to recommend Nemotron on Nebius? (1 to 10)
**Rating:** `10`
```text
10/10. Having three sizes of the Nemotron 3 family (Ultra 550B, Super 120B, and Nano 30B) behind a single fast OpenAI-compatible endpoint makes cost-routed multi-agent architectures practical in a weekend without managing GPUs or quantization.
```

### How would you rate your experience compared to previous cloud or local environments? (1 to 10)
**Rating:** `9`
```text
9/10. Compared to self-hosting open weights or juggling multiple model providers, pointing the Vercel AI SDK at a single Token Factory base URL and immediately getting reliable tool calling across 30B, 120B, and 550B Nemotron tiers saved at least a full day of infrastructure setup.
```

### Feedback on Nebius Token Factory, AI Cloud, and NVIDIA tools (Required Field & $100 Prize Entry)
```text
1. Nebius Token Factory (Model IDs & Reasoning Toggle): The OpenAI-compatible endpoint and function calling across all three Nemotron 3 tiers were rock-solid across 198 live calls. Two small friction points: (a) Model ID casing is inconsistent across the catalog (`nvidia/Nemotron-3-Ultra-550b-a55b` uses mixed case, `nvidia/nemotron-3-super-120b-a12b` is all lowercase, and `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` prefixes `NVIDIA-` in uppercase), which caused a 404 until we queried `/api/public/models_info` directly. (b) On `Nemotron-3-Nano-30B-A3B`, reasoning (`<think>`) is on by default and consumed our entire 600 to 1,500 `max_tokens` budget before emitting a required tool call. Documenting `chat_template_kwargs: { enable_thinking: false }` prominently on the model card (and exposing a first-class reasoning budget parameter) would save builders hours of debugging.

2. Nebius Token Factory Fine-Tuning & Sandboxes: LoRA fine-tuning currently lists Llama and Qwen models, but adding `Nemotron-3-Nano-30B-A3B` to the fine-tuning catalog would let agent builders distill cheap, specialized Checker and Router classifiers. We also requested beta access to Token Factory Sandboxes so our Analyst agent can run `pnpm eval` and Python scripts next to the models instead of in a local subprocess.

3. Nebius Serverless Endpoints: Creating endpoints from a pre-built container registry works well, but adding a direct `nebius serverless deploy --dockerfile ./Dockerfile` build-and-push flow (similar to `railway up`) plus `nebius serverless logs --tail` in the CLI would make deploying Next.js/Node agent apps much faster when a local Docker daemon is unavailable.

4. NVIDIA NemoClaw & OpenShell: NemoClaw's onboarding wizard should accept any custom OpenAI-compatible base URL and bearer token as a first-class option so pointing it at Nebius Token Factory or a self-hosted Nimbus `/v1` endpoint requires zero manual config editing. For OpenShell, a single-page macOS Podman quickstart for Node/TypeScript agent developers would lower the barrier to adopting sandboxed tool execution.
```

### What do you most hope to see from the Nemotron team next?
```text
First-class LoRA fine-tuning support for Nemotron 3 Nano 30B on Nebius Token Factory (ideal for training ultra-cheap verification and routing agents), documented per-call thinking token budgets, and a vision-capable tier (`Nemotron 3.5 Super VL`) on the same tool-calling endpoint so agents can inspect UI screenshots and PDFs in the same run.
```

---

## 4. Short Project Description (~220 words, for Quick Summary / README / Launch Post)

```text
Every morning I read my inbox, my calendar, and GitHub before I have done any real work, then write the same kinds of replies I wrote yesterday.

Nimbus does that part for me with a crew of NVIDIA Nemotron 3 agents on Nebius Token Factory, learns from each run, and asks before it sends anything.

Give it the job once and it runs every morning at 8:00. What makes it different from a blind chat agent:
1. Nemotron 3 Ultra plans the run and shows you who does what and the estimated price before anything executes.
2. The crew runs on a live visual timeline, one row per agent, with model badges and real-time cost. Super reads and writes; Nano checks. Click any step to read the exact source it read.
3. Every outgoing action arrives as an approval card. You can approve once, reject with a note, or click "Approve & always allow" to write a plain-text rule into the workstream's SKILL.md that you can revoke anytime.
4. After each run, a Learner agent on Nano saves vector memories and rewrites SKILL.md with a diff and a Revert button.

Measured on our recorded live take on Nebius Token Factory (Oct 29):
- Morning 1: $0.0216 (58,950 tokens), saving 24% vs. pinning every step to its ceiling model ($0.0283).
- Morning 2: $0.0209 (27% saved vs. ceiling), with the reviewer's reply sent automatically under Morning 1's saved rule.
- Replies sent without my OK: 0.

Live app & 9-clip visual tour: https://nimbus-production-6f7b.up.railway.app/welcome
Video (2:40): https://www.youtube.com/watch?v=obMWKCewVTY
Repo (MIT): https://github.com/harrymove-ctrl/nimbus
```

---

## 5. YouTube & X Copy (Synced with Rev 7 & Oct 29 Live Numbers)

### YouTube Title (76 characters)
```text
Nimbus: a crew of Nemotron agents runs my morning and asks before it sends
```

### YouTube Description
```text
Every morning I read my inbox, my calendar, and GitHub, then write the same replies I wrote yesterday. Nimbus does that for me, learns from each run, and asks before anything is sent.

One morning, measured on the live run in this video: $0.0216 (58,950 tokens) on NVIDIA Nemotron 3 via Nebius Token Factory. The same morning with every step pinned to its biggest model would cost $0.0283, so the router saves 24%. Run two, after it learned from run one: $0.0209 (27% saved). Replies sent without my OK: 0.

What you see, in order:
0:00 Your standing work, done every morning
0:12 The Overview: workstreams on a schedule, the spend chart, the cost router
0:26 Set the goal once. Nemotron 3 Ultra plans it and shows the price first
0:38 The crew on a timeline, one row per agent, the model on each step
0:58 The brief: what needs me today, ranked by who waits
1:12 Nothing leaves without me: approve, reject with a note, or allow from now on
1:30 What the morning cost and what the router saved
1:42 Memory and skill: what it learned, its own how-to rewritten after each run
1:54 Run two, cheaper, and the ruled reply goes out with no card
2:04 Always on: the same crew in my chat app through an OpenAI-compatible endpoint, one history
2:18 How I used Nebius: Nemotron 3 Ultra plans, Super reads and writes, Nano checks and learns, every real call plotted on api.tokenfactory.nebius.com
2:24 Run it yourself

Landing page (9 real-run loops): https://nimbus-production-6f7b.up.railway.app/welcome
Live demo: https://nimbus-production-6f7b.up.railway.app
Repo (MIT): https://github.com/harrymove-ctrl/nimbus
Run it with no keys: git clone https://github.com/harrymove-ctrl/nimbus && pnpm dev

Built alone in three days for the Nebius x NVIDIA Global AI Hackathon, Personal AI track. Models: nvidia/Nemotron-3-Ultra-550b-a55b, nvidia/nemotron-3-super-120b-a12b, nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B, every call through Nebius Token Factory.
```

### X Launch Post
```text
Every morning I read my inbox, calendar, and GitHub, then write the same replies I wrote yesterday.

So I built a crew of NVIDIA Nemotron 3 agents on Nebius Token Factory that does it at 8am, shows every step on a timeline, and asks before anything is sent.

Morning 1: $0.0216 (24% saved by the router).
Morning 2: $0.0209, with pre-approved replies sent under a rule I can revoke.
Replies sent without my OK: 0.
```
Reply with links:
```text
Live tour: https://nimbus-production-6f7b.up.railway.app/welcome
Repo (MIT): https://github.com/harrymove-ctrl/nimbus (`pnpm dev` runs with no keys)
Three Nemotron 3 tiers on Nebius Token Factory: Ultra plans, Super writes, Nano checks and learns.
```
