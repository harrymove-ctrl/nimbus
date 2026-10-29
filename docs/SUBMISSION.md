# Submission kit

Deadline **Oct 30, 2026, 10:00 PDT** (00:00 Oct 31 ICT). Re-check on
https://nebiusglobalaihackathon.devpost.com/ before Phase 5 starts.

## Checklist (tick with a URL or a file path)

- [ ] Working project on Token Factory with Nemotron 3 (Ultra/Super/Nano)
- [ ] Track chosen: Personal AI (fallback: Best Apps & Agents)
- [ ] Project description (below, edited to what actually shipped)
- [x] Demo URL: https://nimbus-production-6f7b.up.railway.app (Railway, real Nemotron on Nebius Token Factory, day cap $1; /v1 needs the bearer token). Nebius Serverless Endpoint: not deployed yet
- [x] YouTube video, public, ≤ 3:00 (rule confirmed 2026-10-28: "3-minute or shorter"), shows Token Factory + Nemotron in use: https://www.youtube.com/watch?v=obMWKCewVTY (rev 7, 2:40, uploaded 2026-10-29). Title, description, chapters and tags below ("YouTube upload")
- [x] Public GitHub repo on `harrymove-ctrl`, MIT `LICENSE` at root, visible on the repo page: https://github.com/harrymove-ctrl/nimbus (pushed 2026-10-29 01:50 ICT on the user's "Push now"; GitHub detects MIT; topics set; the eval workflow runs green on push: typecheck + `pnpm eval --cheap` on the mock model)
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

## Video script v2 (2:40, record at 1440 × 900, dark, dither background on)

Rule for every shot: something moves that only Nimbus has (lanes, badges,
the gate, the learned chip). No shot of a static page longer than 2 s. The
ambient dither-glow drifts behind the run view the whole time; stat tiles
count up with DitherNumber; the empty state and loaders are dithered.

| Time | Screen | Voice |
|---|---|---|
| 0:00–0:08 | Boot: Glow Cloud blinks, follows the cursor, wink on click; cut to the shell, dither glow drifting, six workstreams, one with an unread dot | "Nimbus is a cloud that runs your standing work with a crew of Nemotron agents, and asks before it acts." |
| 0:08–0:20 | Ship Nimbus selected; goal already in the box; cost pill "≈ $0.09 · Ultra ×1 · Super ×3 · Nano ×4"; Enter; plan card with the countdown ring | "Its first job is itself: run the evals, find what fails, fix it, and open a pull request for me to review. Nemotron 3 Ultra plans; Super and Nano do the work." |
| 0:20–0:45 | Lanes fill: Researcher finds the failing golden; Analyst's first run_code fails ✕, retries; click the Analyst segment → Agent I/O shows the real `pnpm eval` output; route badges ↓ on two hops; header cost ticking with −X % vs baseline | "Every agent gets a lane, a model badge and a price. The Analyst runs the real eval suite. Two hops were routed below their ceiling by the cost router; that is the green number." |
| 0:45–0:55 | Question card: "Fix in the router or in the golden?" → click Router | "When the crew needs a decision, it asks, and only that lane waits." |
| 0:55–1:15 | Writer: artifact v1, CODE tab, the unified diff; Checker: typecheck green; cloud turns orange; tray "1 waiting · Open PR fix/router-fallback-ceiling"; card with the PR body; click Approve & always allow; policy line appears | "Nothing leaves the sandbox without you. Opening a pull request is an action, so it waits. Approve & always allow writes one rule into the workstream's skill file." |
| 1:15–1:30 | Artifact v2 with the eval table; run summary counts up: cost, tokens, −X %, routed hops; 5 memories; skill diff; Memory & skill tab: rule card, skill cards, memories | "After the run a Learner writes memories and rewrites the skill. You can read exactly what it learned, revoke a rule, forget a memory." |
| 1:30–1:50 | Rail: Hackathon radar with the unread dot (cron ran at 09:00) → open: frozen timeline, the digest doc, the approval it is waiting on; approve from the tray | "It is always on. The radar ran at nine, read the hackathon pages, drafted the digest, and waited for me on the one thing that sends." |
| 1:50–2:10 | Ship Nimbus again: learned chip ✦ 5 mem · 1 rule on the orchestrator lane; no approval card; header shows a lower cost than run one (real models) | "Run two knows what run one learned: it skips the question it already asked, opens the PR under the rule, and costs less." |
| 2:10–2:25 | Terminal: curl to `/v1/chat/completions` on the Nebius Serverless Endpoint with the OpenClaw config beside it; the same run appears in the web timeline with trigger "chat" | "It speaks OpenAI's API, so OpenClaw or Hermes can bring it into your chat apps with ten lines of config. Hosted on a Nebius Serverless Endpoint; nightly runs as Serverless Jobs." |
| 2:25–2:40 | README: model table, eval table, cost delta; end card: Nimbus · Nemotron 3 on Nebius Token Factory · MIT | "Three Nemotron tiers, routed by role and cost, graded hop by hop. Open source. Nimbus." |

Recording: `pnpm demo:video` drives this script against the replay of one
real run (BUDGET.md); takes are free. Voice is recorded separately and laid
over; no music under the voice, a low dither-texture ambience is fine.

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

## Video v3 beats (rev F) and a sharper recording

Insert between v2's 0:08 and 0:20: **the Overview** (6 s): stat cards count
up, the spend area chart draws in, the runs heatmap, the router gauge; cursor
clicks the spend chart → yesterday's runs. Replace the countdown beat with
**the plan draft**: drag one step up, add "Run the full suite before the PR",
click Approve plan; the checklist ticks as lanes fill. Add after the radar
beat: **the status pill**: with the radar open, Ship Nimbus runs in the
background; the pill shows "Analyst · run_code 0:12"; open the panel, approve
the PR inline. Add in the Analyst beat: switch Agent I/O to **Loop view** to
show the retry as loop 2. Total stays under 3:00.

Recording: Playwright at 1920 × 1080, `recordVideo` 1920 × 1080, then
`ffmpeg -c:v libx264 -preset slow -crf 17 -r 30 -pix_fmt yuv420p`. For the
submission take, record the replay with QuickTime (or `ffmpeg -f avfoundation`)
at the display's native 2× resolution while `NIMBUS_REPLAY` plays the real
run: sharper than Playwright's frame capture, still zero spend.

## Devpost form answers (draft, 2026-10-28)

The "Additional info" page asks the questions below. Draft answers, in the voice we use everywhere: plain, specific, no adjectives a number can replace. Numbers are from the recorded Oct 29 real-model take (1915: run_724b8d9d and run_915dfc1d, the runs the video is cut from); `[fill]` is the user's own choice. Everything stated here must be true of the shipped repo on Oct 30; strike any line whose feature did not ship.

| Field | Answer |
|---|---|
| Submitter type | [fill: Individual / Team] |
| Country | Vietnam [fill if different] |
| Track | Personal AI (fallback: Best apps and agents, decided at submission time per PLAN.md §0) |
| New or existing | New. Started 2026-10-27, after the Submission Period opened. |
| Repository | https://github.com/harrymove-ctrl/nimbus — MIT at the root, README with setup, env vars and "How we used Nemotron / Token Factory / other Nebius services" |
| Demo URL | https://nimbus-production-6f7b.up.railway.app (Railway; the Nebius Serverless Endpoint is not deployed yet, said so in the feedback) |
| Builders & Brews city | [fill: Da Nang, if attended; else leave blank] |
| Tavily | Yes — the Researcher agent's `web_search` tool is a runtime call to the Tavily API (`src/runtime/tools.ts`, `tavily().search`, 5 results per query) whenever `TAVILY_API_KEY` is set. |
| AI tools used while building | Claude Code (planning, build, video), Suno (music), Remotion and snapcn (video). |
| Learning derived | [fill: Significant] |
| AI value for your career | [fill: Yes] |

**Which model(s) did you use, and why that size?**
Three Nemotron 3 tiers on Nebius Token Factory, routed by job (`src/lib/models.ts`):
- `nvidia/Nemotron-3-Ultra-550b-a55b` for the Orchestrator only: it plans the run, decides who does what, and writes the approval requests. One or two calls per run, where reasoning matters.
- `nvidia/nemotron-3-super-120b-a12b` for the Researcher, Analyst and Writer: the many calls that read an inbox, run code and draft replies. 256K context fits a whole morning's inputs in one call.
- `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` for the Checker and the Learner: verification and memory-writing run after every step and every run, so they have to be cheap. Nano costs 1/16 of Ultra per input token.
A full Morning brief run costs $0.0216 (58,950 tokens, recorded run run_724b8d9d on Oct 29); pinning every hop to its ceiling tier would cost $0.0283, so the router saves 24 %. The next morning cost $0.0209.

**How would you rate Nemotron's output quality? (1–10)**
[fill after the real run]. What worked: function calling on all three tiers (the whole crew is tool calls), instruction-following on the plan format, long context on Super. What fell short: [fill from the real run: e.g. the Checker's false rejects, the Writer's tone drift, anything the Learner got wrong].

**Fine-tune, prompt-engineer, or out of the box?**
Out of the box, with prompt engineering only: one system prompt per role, a tool schema per tool, and the workstream's `SKILL.md` and memories prepended at run time (the Learner rewrites that file after every run, so the prompt improves without any training). No fine-tuning: three days did not allow a Nano fine-tune for the Checker, which is the first thing we would do with more time.

**How did Nemotron compare to other models for similar tasks?**
[fill honestly: e.g. "Comparable to the mid-size closed models we have used for tool-calling agents, at a fraction of the price per token; Ultra's plans were as good as the best we have seen for this task; Nano needed tighter prompts than a closed small model."]

**Which Nebius platform capabilities were most valuable, and how?**
- Token Factory's OpenAI-compatible API: the whole model layer is one Vercel AI SDK provider (`src/lib/tokenfactory.ts`, base URL `https://api.tokenfactory.nebius.com/v1`), so routing between three models is a string change per role.
- Per-token pricing we could read from the API: the app prices every call live (the cost in the run header, the day cap, the "Token Factory watch" workstream that proposes cheaper routing from its own bill).
- Embeddings on the same endpoint (`/embeddings`) for memory recall.
- Serverless Endpoints for the app and Serverless Jobs for scheduled workstreams [keep only if deployed].
No GPU instances were used; everything ran through the managed API.

**How likely to recommend Nemotron on Nebius? (1–10)** [fill] — because [fill: one sentence].

**Experience vs previous cloud or local environments? (1–10)** [fill] — [fill: e.g. "an OpenAI-compatible endpoint with three sizes of one model family behind it is the setup we wanted; no local GPU, no quantisation decisions"].

**What would have made it more effective?**
See the Feedback draft above: a documented reasoning on/off switch and JSON mode for Nemotron; consistent model-id casing between the catalog and `models_info`; a `--dockerfile` build step and a logs tail in the Serverless CLI; Nano fine-tuning.

**What do you most hope to see from the Nemotron team next?**
A Nano fine-tuning path on Token Factory (for cheap, specialised checkers), and a vision-capable tier in the same family and API so an agent can read screenshots in the same run.

## What the video must show (from the rules, 2026-10-28)

"A 3-minute or shorter public YouTube video showing your project working — how you used Nebius Token Factory and NVIDIA Nemotron." Script rev 6 covers it in four places: scene 3 (every call through Token Factory, priced per token, routed by job), scene 6 (the model badge on each step: Ultra plans, Super reads and writes), scene 18 (the crew proposing cheaper routing from its own Token Factory bill), scene 19 (the three model ids with their jobs, the endpoint, the real call count and cost).

## Spoken-voice drafts (2026-10-28)

The user's rule for everything public: "I don't want README github, description project so much AI. I want it to talk like this, even if not perfect: here I, me, you." First person, one builder, plain talk, no adjectives a number can replace, nothing that sounds generated. Keep the facts from the sections above; change only the voice. Numbers come from the recorded Oct 29 real-model take (1915).

### Token Factory Sandboxes Beta form · "Describe your case" (simple, neutral)

> Nimbus is a personal assistant that runs a user's recurring chores (a morning brief from inbox, calendar and GitHub; a competitor digest; a cost watch) with a crew of Nemotron 3 agents on Token Factory, and asks for approval before any action leaves the app.
>
> One agent runs code to parse those sources. Today it runs in a local subprocess. I'd like to run that step in Token Factory Sandboxes instead, so code execution is isolated and next to the models rather than on the user's machine. The project is aiproject-e00byjpgvzf0g3p5fa; it's my hackathon entry (NVIDIA x Nebius, Personal AI track), repo github.com/harrymove-ctrl/nimbus.

### Devpost project description (launch-post structure, first person)

Structure from the user's reference (lessons.sh #01): line 1 names the problem a stranger already has, line 2 names the tool, line 3 says how you use it in seven words; adjectives are replaced by numbers that can be checked; no "introducing", no stack list, no version numbers; the repo and the one command close it. Numbers from the recorded Oct 29 take (1915).

> Every morning I read my inbox, my calendar and GitHub before I've done any work, then write the same replies I wrote yesterday.
>
> Nimbus does that part for me, learns from each run, and asks before it sends anything.
>
> Give it the chore once; it runs it every morning at 8. What is different from an agent that just runs chores: it rewrites its own skill file after every run, every side effect waits for my yes and an approved one can become a rule I can revoke, and it routes each step across three Nemotron sizes while watching its own bill.
>
> What one morning costs, measured, not estimated:
> - 1 plan, 3 drafted replies, 1 page of what needs me: **$0.0216** (58,950 tokens) on NVIDIA Nemotron 3 via Nebius Token Factory
> - the same morning with every step on the biggest model: **$0.0283** — the router saves **24 %**
> - run two, after it learned from run one: **$0.0209**, the reviewer's reply sent under a rule I approved once, no card
> - replies sent without my OK: **0**
>
> How it works, in the order you see it in the video:
> 1. I type the job once. Nemotron 3 Ultra plans it and shows me the plan, who does what, and the price before anything runs.
> 2. The crew runs on a timeline, one row per agent, the model on each step. Super reads and writes, Nano checks. Every step is open: click it, read what it read.
> 3. Anything that leaves (a reply, a message) arrives as a card and waits for my yes. I can approve, reject with a note, or allow it from now on. That rule is mine to revoke.
> 4. After the run a Learner on Nano writes what it learned into memories and rewrites the job's skill file, so the next morning is cheaper and asks less.
> 5. It runs on a schedule, answers in my chat app through an OpenAI-compatible endpoint (OpenClaw or Hermes point at it), and watches its own Token Factory bill, proposing cheaper routing when it can.
>
> My data stays in my database with my keys; the tools it can use are the ones I list.
>
> Built alone in three days for the Personal AI track. github.com/harrymove-ctrl/nimbus (MIT) · `pnpm dev` runs it with no keys; add a Token Factory key and it is real.

### X launch post (same structure, for the X clip)

> Every morning I read my inbox, calendar and GitHub, then write the same replies I wrote yesterday.
>
> So I built a crew of Nemotron agents that does it at 8am and asks before anything is sent.
>
> One morning: $0.0216. Replies sent without my OK: 0.
>
> [the 44 s clip]

Reply, posted within a minute: "Repo (MIT): github.com/harrymove-ctrl/nimbus · `pnpm dev` runs it with no keys. Three Nemotron sizes on Nebius Token Factory, routed by job: Ultra plans, Super writes, Nano checks."

### YouTube upload · title and description (draft 2026-10-29)

Same voice as the launch post. YouTube shows about 70 characters of the title in search and the first two lines of the description before "more", so line 1 carries the problem and the price. Chapters need the first stamp at 0:00 and at least three, 10 s or longer, which the list below satisfies. Set the video to public (the rules ask for a public link), category Science & Technology, and upload the 4K master when it lands (`video/out/nimbus-full-4k.mp4`); the 1080p master is fine otherwise.

**Title (76 characters):**

> Nimbus: a crew of Nemotron agents runs my morning and asks before it sends

Shorter alternative (58): "Nimbus: my morning, run by Nemotron agents for $0.02"

**Description** (chapter times are for rev 7, the 2:40 cut with no scripted footage; confirm against the final master):

> Every morning I read my inbox, my calendar and GitHub, then write the same replies I wrote yesterday. Nimbus does that for me, learns from each run, and asks before anything is sent.
>
> One morning, measured on the run in this video: $0.0216 (58,950 tokens) on NVIDIA Nemotron 3 via Nebius Token Factory. The same morning with every step on the biggest model would cost $0.0283, so the router saves 24 %. Run two, after it learned from run one: $0.0209. Replies sent without my OK: 0.
>
> What you see, in order:
> 0:00 Your standing work, done every morning
> 0:12 The Overview: workstreams on a schedule, the spend chart, the cost router
> 0:26 Set the goal once. Nemotron 3 Ultra plans it and shows the price first
> 0:38 The crew on a timeline, one row per agent, the model on each step
> 0:58 The brief: what needs me today, ranked by who waits
> 1:12 Nothing leaves without me: approve, reject with a note, or allow from now on
> 1:30 What the morning cost and what the router saved
> 1:42 Memory and skill: what it learned, its own how-to rewritten after each run
> 1:54 Run two, cheaper, and the ruled reply goes out with no card
> 2:04 Always on: the same crew in my chat app through an OpenAI-compatible endpoint, one history
> 2:18 How I used Nebius: Nemotron 3 Ultra plans, Super reads and writes, Nano checks and learns, every real call plotted, all on api.tokenfactory.nebius.com
> 2:24 Run it yourself
>
> Repo (MIT): https://github.com/harrymove-ctrl/nimbus
> Live demo: https://nimbus-production-6f7b.up.railway.app
> Run it with no keys: git clone https://github.com/harrymove-ctrl/nimbus && pnpm dev. Add a Token Factory key and it is real.
>
> Built alone in three days for the Nebius x NVIDIA Global AI Hackathon, Personal AI track. Models: Nemotron-3-Ultra-550b-a55b, nemotron-3-super-120b-a12b, NVIDIA-Nemotron-3-Nano-30B-A3B, every call through Nebius Token Factory. The numbers on screen come from one recorded take on the real models; the release notes in docs/video/RELEASE.md say where each was measured. One drafted reply in the video ends with a placeholder signature the model wrote; that is fixed in the app and left in the recording as it happened.
>
> Music: my own Suno generation. No voiceover. Every frame of the app in this video is from recorded runs on the real models.

**Tags:** Nemotron, Nebius, Token Factory, AI agents, personal AI, NVIDIA, Next.js, open source, hackathon

**Thumbnail:** `public/brand/devpost-thumbnail-1024.jpg` scaled to 1280 x 720 on the boot sky, or frame 2280 (the first Approve) from the master; both are in `docs/demo/gallery/`.

### README voice

Same voice as above for the README's opening and the "How I used Nemotron and Token Factory" section: "I", "my", short sentences, facts with the file paths. Setup steps stay as plain commands. Hand this to the builder session with the README task.

### Devpost thumbnail (the "logo") · the user's pixel mark (2026-10-28)

The user supplied three 1024 × 1024 marks in `public/`: `nimbus-logo-win95-paper.jpg` (light: the pixel cloud with eyes inside a NIMBUS.EXE window, on paper), `nimbus-logo-win95-dark.jpg` (the cloud in a bevelled frame, one blue pixel), `nimbus-logo-win95-dark-face.jpg` (the dark face, eyes recessed). Derived files in `public/brand/`:
- `devpost-thumbnail-1024.jpg` — upload as the Devpost thumbnail (the paper one, square, self-explanatory).
- `nimbus-icon-512.png`, `apple-touch-icon.png`, `favicon-64.png` — the NIMBUS.EXE window cropped, for the app icon and favicon.
- `og-paper-1200x630.jpg` — the social preview for the GitHub repo (Settings → Social preview) and link cards.
- `nimbus-window-paper.png` — the window crop for the README header.

Where the mark is used: Devpost, the favicon, the README header, the repo social image. The in-app live character stays the glow cloud (it blinks and turns orange; the status pill and the boot screen depend on it), and the video's lockup keeps the glow cloud for the same reason; a pivot of both is a re-record and a re-render.

### Devpost gallery (up to 5 images, 1920 × 1080) · what each shows

Stills from the video's own frames, so the gallery is the product, with a little drama:
1. **The hook frame.** The orb-swarm sentence mid-flight: "by a crew of Nemotron agents" with the glass orbs, dark, the dither texture. (Full cut, about 0:05.)
2. **The timeline on the tilted camera.** Four agent rows filling at once, the model badges readable, the cost in the header, one callout open: "One row per agent · they work at the same time". (About 0:44.)
3. **The gate.** The approval card with the drafted reply, the cloud orange, the drawn tick landing on Approve, the callout "Sending is an action · so it waits for you". (About 1:16.)
4. **How I used Nebius.** The three model-id tiles with their jobs over the scatter of real calls, the endpoint line under them. (About 2:36.)
5. **The phone stack.** "run morning brief" → "approve all" → "Approved" in the chat app, with "Same crew in your chat app". (About 2:20.)

Export each from the final 1080p master with `ffmpeg -ss <t> -i nimbus-full.mp4 -frames:v 1 gallery-<n>.png`; the video session lists the exact frames in RELEASE.md.

## Devpost "About the project" (story page, Markdown) · draft 2026-10-28

```markdown
## Inspiration

In 2026, personal agents can already run on a schedule and ask for confirmation, but leaving them running every day across your inbox, codebase, and research still hits three walls:

1. **One flagship model for every step burns your budget:** Routing every file read, retry, test check, and memory update through a single large model makes daily background chores too expensive to leave on.
2. **Chat apps hide the work, while hosted clouds lock you in:** Tools like OpenClaw and Hermes are great in Telegram or Slack, but a chat bubble cannot show you 40 tool calls, failed retries, or per-step cost, while SaaS agents lock your data and memories inside a black box.
3. **Static prompts repeat yesterday's questions:** Most agents either act without asking or ask the exact same permission every morning because approvals never become rules and runs never rewrite the skill file.

I built **Nimbus** for the Nebius and NVIDIA Global AI Hackathon to solve all three on open infrastructure you own: use `Nemotron 3 Ultra` only where planning matters, route everyday work to `Super` and `Nano` on Nebius Token Factory, and give your agents a visual operations room that learns from every run.

## What it does

Nimbus is a self-hosted personal operations room that runs your standing jobs with a crew of NVIDIA Nemotron 3 agents on Nebius Token Factory, asks before any action leaves your machine, and rewrites its own `SKILL.md` file after every run.

When you give Nimbus a standing job, `Nemotron 3 Ultra 550B` plans the run and shows you the steps, who does what, the allowed tools, and the estimated price before anything starts. You can edit or reorder the plan, then watch the crew work in parallel on a live timeline with one row per agent, model badges on every step, and token cost ticking in real time. Clicking any step opens the Loop Inspector so you can read the exact files, emails, or command outputs that agent saw.

Whenever an agent wants to take an outside action like sending a reply or opening a pull request, the run pauses and drops an approval card into your tray. You can approve it once, reject it with feedback, or click **Approve & always allow**, which writes a plain-text `allow:` rule straight into that job's `SKILL.md` file that you can revoke anytime. After each run finishes, a Learner agent on `Nemotron 3 Nano 30B` saves embedded memories and rewrites `SKILL.md` with a visual diff and a **Revert** button so the next run asks fewer questions. And because Nimbus exposes an OpenAI-compatible `/v1/chat/completions` endpoint, you can point OpenClaw, Hermes Agent, or NemoClaw at it in ten lines of config to trigger runs and approve cards from Telegram, WhatsApp, or Slack while keeping the full visual timeline on the web.

I built four real standing workstreams to put this loop to work. In **Ship Nimbus**, the crew maintains its own repository: it runs `pnpm eval` and `pnpm typecheck` in a sandbox, reproduces a failing router test, asks me inline whether to fix the router or the test golden, drafts a unified diff patch, and waits for my approval before opening a GitHub pull request. In **Token Factory Cost Audit & Watch**, Nimbus audits its own SQLite call log, runs A/B trajectory evaluations (`pnpm eval:ab`), and proposes `router-rules.json` changes that cut run spend by an additional **15.3%**. In **Hackathon Radar**, it runs at 09:00 using live **Tavily** web search to compare hackathon updates against yesterday's memories and queues a three-bullet digest for approval. And in **Morning Brief**, it reads my inbox, calendar, and GitHub notifications at 08:00 into a ranked one-page brief and holds three drafted replies in the approval tray.

On a live Morning Brief run measured on Oct 28 on Nebius Token Factory, Nimbus produced 1 plan, 1 prioritized brief page, and 3 drafted replies across 60,933 tokens for **$0.0225** (**$0.0276** with the post-run Learner pass). Running that same morning with every step pinned to its role's ceiling model cost **$0.0308**, meaning the cost router saved **22% to 27%** on live calls while saving **8 memories** and rewriting `SKILL.md`. Across the 19-golden A/B evaluation suite (`pnpm eval:ab`), the router cuts spend by **47.9%** (`$0.864` down to `$0.451`), and the number of actions executed without my approval is **0**.

## How I built it

I built Nimbus solo in three days starting Oct 27, 2026 using Next.js 15, React 19, TypeScript, and SQLite (`libsql` with Drizzle ORM) for all local state, including live SSE run events, versioned artifacts, vector memories, `SKILL.md` revisions, and an LLM response cache.

Every model call and embedding request runs through a single Vercel AI SDK provider pointed at Nebius Token Factory's OpenAI-compatible API (`https://api.tokenfactory.nebius.com/v1`). I kept role prompts on a stable prefix so Token Factory's cached-input pricing applies automatically, and enforced all structured outputs through Zod tool schemas.

To keep daily runs cheap, I assigned model tiers by job. `Nemotron 3 Ultra 550B` ($1.00 / $3.00 per 1M tokens) runs the Orchestrator and is called only once or twice per run where planning and judgment matter. `Nemotron 3 Super 120B` ($0.30 / $0.90 per 1M tokens, 256K context) runs the Researcher, Analyst, and Writer for Tavily web search, sandboxed code execution, and drafting. `Nemotron 3 Nano 30B` ($0.06 / $0.24 per 1M tokens, one sixteenth of Ultra's input price) runs the Checker, the Learner, and the router classifier. Those assignments act as ceilings rather than fixed tiers: before each hop, a cost router picks the cheapest tier that can handle the step, and if a call hits a `429` rate limit or timeout, it falls one tier down (Ultra to Super to Nano) and never up.

So judges can try the entire app in two minutes without API keys, `pnpm dev` runs out of the box using a deterministic scripted mock model whenever `NEBIUS_API_KEY` is empty, and switches to live Nebius Token Factory models as soon as a key is added. I gated every code change with 19 trajectory evaluation goldens (145 per-hop assertions) and 27 end-to-end verification checks, and packaged the app with a `Dockerfile` and headless job runner for Nebius Serverless Endpoints and Nebius Serverless Jobs.

## Challenges I ran into

Building against a scripted mock model let me ship the UI and state machine fast, but it hid real multi-agent failure modes. When I pointed Nimbus at live Nemotron 3 models on Nebius Token Factory for the first time, six real problems showed up in a single afternoon, costing about $0.28 in total to diagnose and fix.

On the first live run, the Researcher immediately stopped and asked where my inbox lived because its prompt did not name the local file paths. Once I updated `SKILL.md` to declare the exact sources (`fixtures/inbox/*.eml`, `fixtures/calendar.ics`, and `fixtures/github-notifications.json`) upfront, the Researcher started reading them, but then it read one file per turn, used up all 8 of its turns, and exited without writing a report. I fixed that by raising child agent budgets to 12 turns and making the final turn a tool-free synthesis step so every agent is guaranteed to return a report.

The next bugs showed up in how agents talked to each other. During handoffs, the Orchestrator literally wrote `"Researcher's report: … (include the report)"` instead of pasting the text, which forced the Writer to re-read every raw file from scratch. I changed the runtime bus so handoffs automatically attach prior crew reports. Then the Writer drafted all three email replies inside a markdown document without ever calling `send_message`, because its system prompt focused on writing documents rather than taking actions. I updated the Writer prompt to call `send_message` once per reply and explained that `send_message` itself raises the approval gate. In another live run, a drafted reply told a reviewer that a login fix `"has shipped"` when the GitHub notification only said the pull request was in review, so I tightened both the Writer and Checker prompts to ground every status claim strictly in the latest source text.

Finally, the Learner agent on `Nemotron 3 Nano 30B` spent its entire 600 to 1,500 token output budget inside `<think>` blocks and got cut off before calling `save_learning`. Turning thinking mode off (`chat_template_kwargs.enable_thinking = false`) and requiring the tool call dropped the Learner's output from over 690 tokens down to 102 tokens, saving 8 memories and rewriting `SKILL.md` cleanly on the very next run. Every one of these six fixes is locked in as a commit with an automated test.

## Accomplishments that I'm proud of

I am proud of bringing three core Nebius Builder patterns together inside a single cohesive app: grounded multi-step research with Tavily and Token Factory, live multi-tier cost benchmarking across Nemotron 3 Ultra, Super, and Nano, and confidence-gated human approvals that compile into plain-text rules you can read, diff, revert, or revoke in one click.

I am also proud that Nimbus can maintain and optimize itself, running `pnpm eval` on its own repository to patch a failing router test and auditing its own Token Factory spend log to propose cheaper routing rules. And because the entire stack runs locally with `pnpm dev` and zero API keys before switching to live Nebius Token Factory models with a single environment variable, anyone can test the full experience in two minutes.

## What I learned

First, I learned that Nemotron 3 tool calling is reliable across all three model tiers on Nebius Token Factory. Ultra, Super, and Nano all handled structured Zod tool schemas cleanly through the OpenAI-compatible API. Whenever a multi-agent run failed in practice, the culprit was almost always dropped context between agent handoffs or missing file paths in the brief rather than model tool syntax.

Second, I learned that small reasoning models need explicit thinking budgets. `Nemotron 3 Nano 30B` is fast and cheap at $0.06 per 1M input tokens, but leaving reasoning enabled on single-shot structured extraction tasks will eat through `max_tokens` before the tool call is emitted. Turning thinking off (`chat_template_kwargs.enable_thinking = false`) for the Learner made its output six times smaller (102 tokens instead of 690+) and completely reliable.

Finally, I learned that live per-token pricing from the API is a product feature in its own right. Once the runtime knows the exact price of Ultra, Super, and Nano on every hop, cost stops being a surprise bill at the end of the month. The app can estimate the price before a run starts, display cent-by-cent spend on the timeline, stop automatically at a daily cap, and even run an agent workstream that audits and optimizes its own Token Factory bill.

## What's next for Nimbus

Next, I plan to move the Analyst's `run_code` step from a restricted local subprocess into isolated Nebius Token Factory Sandboxes and NVIDIA OpenShell containers right next to the models (beta access requested). I also want to fine-tune `Nemotron 3 Nano 30B` on our trajectory evaluation dataset as a dedicated, ultra-cheap Checker, and bring `Nemotron 3.5 Super VL` into the Researcher and Analyst lanes so workstreams can inspect screenshots, invoices, and PDFs on the same Token Factory endpoint.
```
