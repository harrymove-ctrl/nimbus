# Track research and positioning (2026-10-29, 23:00 ICT)

Researched by the planner's researcher agent from third-party copies of the rules and the Nebius docs. Devpost
returned 403 to the agent, so **the Devpost Rules tab is the authority; re-read it once before submitting.** Sources:
tierones.io/opportunities/nebius-nvidia-ai-2026, lucaberton.com (Builders and Brews Amsterdam recap), a pasted copy
of the rules in github.com/JannetEkka/DSProjects/issues/53, docs.nebius.com/serverless, benchlm.ai/hosts/nebius.

## What the rules say (secondhand, consistent across three sources)

- Four tracks: Coding and Agentic Engineering, **Best Apps and Agents**, **Personal AI**, Physical AI. A project names
  **one** track. "Best Apps and Agents" is a track, not a bonus or a judging category; the text the user pasted is its
  description.
- Prizes: overall $20,000, $10,000, $6,000; each track winner a Jetson Orin Nano; **Best Use of Tavily $3,000** for "a
  functional runtime Tavily call"; 20 city awards ($500, in-person only); 10 Most Valuable Feedback awards ($100 plus
  swag). "A project can win one Overall or one Track award, plus one Bonus award."
- Stage 1 pass or fail: a runtime call to the Token Factory inference API, an NVIDIA open model, new or significantly
  updated after Aug 26, a working demo URL that stays **free and unrestricted until judging ends**, a public repo with
  the licence visible in its About section, a README that says how Nemotron is used and where Token Factory helped, a
  public YouTube video under 3 minutes with no copyrighted music, and the feedback field.
- Stage 2: four equal criteria, Technological Implementation, Design, Potential Impact, Quality of the Idea; ties break
  on implementation.
- Deadline Oct 30, 10:00 PT (17:00 UTC, 00:00 Oct 31 ICT). Judging Dec 1 to Dec 15; winners about Jan 11, 2027.
- No bonus exists for Serverless Endpoints, Serverless Jobs, Sandboxes or for using all three Nemotron sizes. The
  organisers' text says Serverless is "not required". Sandboxes are named only in the coding track's description.
- Credits: $25 Token Factory (code NEBIUS-DEVPOST-GLOBAL26) plus $25 from the Builders Program. Nothing found says
  they cover Serverless compute.

## Decision: stay in Personal AI

Personal AI is described as "a private, always-on assistant with memory, reusable skills, and user-controlled tools."
That is Nimbus sentence for sentence: workstreams on schedules (always on), memories and a self-rewritten SKILL.md
(memory, reusable skills), approval cards that become revocable rules and tool chips per workstream (user-controlled
tools). Best Apps and Agents is broader ("useful applications and agents powered by Nemotron") and will hold most of
the field. The judging criteria are identical in both tracks, so the track choice only changes who we are compared
with. We keep Personal AI and **borrow the Apps track's language** for the implementation criterion, because it names
exactly what the router does: "Reach for Nemotron 3 Ultra when you need serious reasoning, and let Nano or Super handle
the fast, everyday calls, so your app stays responsive and your credits stretch further."

## What changes in the last 24 hours (and what does not)

| Do | Why | Owner |
|---|---|---|
| Say **Tavily** explicitly: the Researcher's `web_search` makes a runtime Tavily call on production (`TAVILY_API_KEY` is set on Railway; Hackathon radar `run_3066dc6c` used it). One sentence in the Devpost text, one in the README, and tick the Tavily bonus box on the form. | $3,000 bonus, one allowed on top of a track award | landing session, user (form) |
| **Do not rotate the Nebius or Tavily keys before Dec 15.** The demo must stay free and unrestricted through judging. Rotate after Jan 11, or when the keys leak, whichever first. The pasted-in-chat keys are a leak risk already accepted for the hackathon. | stage 1 pass or fail | user |
| Keep the day cap at $1 (judges' runs cost $0.01 to $0.08; 15 judging days at the cap is at most $15 of the $50 credits). Make sure Railway keeps the service up through Dec 15 (billing, no auto-sleep). | demo must stay up | user |
| Write the model routing in the organisers' words in the README's "How we used Nemotron" section: Ultra plans and decides, Super researches and writes, Nano checks and learns; measured 24 % saving on the recorded take, 30 % on `run_668c7252`. | implementation criterion, tiebreaker | landing session |
| Check the GitHub About panel shows the MIT licence and the demo URL. | stage 1 | user (one click) |
| Keep the video under 3:00 (it is 2:40) with the Suno track (no copyrighted music). | stage 1 | done |
| Skip Serverless Endpoints and Jobs. No bonus, the `nebius` CLI is not installed here, the deploy doc was never executed, and Railway already satisfies "working demo URL". Mention Railway honestly in the README. | 25 hours left; zero score for it | planner |
| Do not spend more on Sandboxes. They are live and verified (`run_668c7252`); say so in one line and move on. | coding-track feature; no score here | planner |

## How Nimbus scores on the four criteria (what to make visible)

- **Technological implementation:** three Nemotron sizes routed by role with the bill on screen; prompt-cache-friendly
  role prefixes; a Token Factory cost audit workstream that proposes routing rules; run_code in Nebius Sandboxes;
  evals (`pnpm eval`, 19 goldens) gating every change; real runs listed by id. Say every one of these with a number.
- **Design:** the ops room (timeline per agent, Agent I/O, approval tray, the tour), the three doors (web, Telegram,
  CLI and MCP), phone layout, reduced motion. Show, do not describe: the video and the gallery do this.
- **Potential impact:** standing chores done every morning with the cost of a coffee per month; the approvals-become-rules
  loop is what makes it safe to leave running. Quote the measured numbers from the recorded take.
- **Quality of the idea:** approvals on semantic actions that compile into revocable rules in a skill file the person
  can read and revert; the crew learns per workstream; the same crew is reachable from chat and from a coding agent.

## Not verified by this research

Devpost pages read directly; per-track cash; whether several tracks can be entered; Serverless pricing, quotas and a
Next.js example; Token Factory rate limits; official "which Nemotron when" guidance beyond the track text; Sandboxes
docs or pricing; past winners or judge commentary.
