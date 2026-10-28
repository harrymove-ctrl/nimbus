status: approved · 2026-10-28 · "Approve rev 6" · rev 6
revision: rev 6 · rebuilt from the v3 opening the user liked, with the real app explained scene by scene and a designed motion scene at every turn. Supersedes rev 5 (approved 2026-10-27) and the rev D motion layer.
why: the user's words, 2026-10-28: "full planning to add and not write mock in video … i feel in demo app intro not good why u dont copy nimbus-demo-v3.mp4 version … Dont ask like Dana story for your story it could be neutral and for user … reuse all CSS global i design … Full cut (2:54) … not understanding at all"
track: Personal AI
cuts: full (2:56, 1920 × 1080, 88 bars + 1-bar audio tail) · X clip (0:44, 22 bars, cut from full)
grid: 120 BPM · 1 bar = 2.0 s = 60 frames at 30 fps
length rule: Devpost (confirmed by the user, 2026-10-28): "a 3-minute or shorter public YouTube video showing your project working — how you used Nebius Token Factory and NVIDIA Nemotron". The master is 2:56; the "+" column is not used for the submission (it stays for an optional longer cut on X or YouTube after the deadline).
captions / transcript: none. Words live in callouts, the opening sentence, the chapter cards and the end card.
on-screen words: about 240.
numbers: **no "mock" tag anywhere in the final.** The final render happens after one recorded real-model run of Morning brief on Oct 29 (see "Footage and numbers"); every number on screen comes from that run or from the dev database's real call log. Until then, preview renders carry one small corner watermark, "preview · fixture numbers · temp music", and nothing else.
story voice: neutral and addressed to you. No character names in any word we write; the people in the brief are roles (a client, a teammate, a reviewer).
remember this: Nimbus runs your standing work every morning with a crew of Nemotron agents, shows you what each one did and what it cost, asks before anything leaves, and gets better every run.

No voice.

## What changed and why

| Problem in the locked cut | Rev 6 |
|---|---|
| The opening is a dark, dense screen; nothing tells a stranger what this is | The v3 opening: one sentence told in beats with the orbs, then the name. The user liked v3's opening. |
| "mock" tags on every number | The real run comes first; the final shows measured numbers with no tag |
| The story is about Dana, Priya and Sam | The story is about you. The brief's people are roles |
| Motion scenes with invented colour fields (the green-blue blur) | Every motion scene sits on the app's own surfaces: neutral-950, the app's dither texture, mint, the role colours, and the boot sky. No colour field, no blur blob |
| The app footage is flat | Footage rides a tilted 3D camera (8–14°, soft edge focus), like the reference still the user sent |
| "not understanding at all" | Every chapter opens with a card that says the one idea in plain words, then the footage proves it, then a callout names each part |

## The two word components

- **Callout** (unchanged from rev 5): ring, leader line, card; line 1 what it is, line 2 why it helps you; one at a time, two at most.
- **Chapter card** (1 bar, new): a designed text scene that states the chapter's idea, on neutral-950 with the app's dither. It cuts hard to footage on the next downbeat, and the small chapter chip slides in at the same moment.

# Full cut

| # | Time | Bars | Part | Picture | On-screen words | Component | + |
|---|---|---|---|---|---|---|---|
| 1 | 0:00–0:08 | 4 | Hook | The v3 opening: glass orbs burst out of the line, split, wind into a vortex and loop around the last words. One line per bar. Dark, with the app's dither. | "Your standing work," · "done every morning" · "by a crew of Nemotron agents" · "that asks before it acts." | `orb-swarm` (free, installed) | — |
| 2 | 0:08–0:12 | 2 | Name | A square scales in, a deck of cards in the role colours fans out and winds back, the stack stretches into one block per letter, each flashes a role colour and swaps for its Manrope letterform: N I M B U S. The CloudMark lands left of the name and blinks. | "Nimbus" · "NVIDIA Nemotron · Nebius Token Factory" | `block-wordmark` (free) + CloudMark | — |
| 3 | 0:12–0:24 | 6 | Overview | A MacBook opens, a notch notification reads "Morning brief · ran 08:00", the camera dives into the screen until the real Overview fills the frame: stat cards count up, the spend chart draws, the workstream list with schedules. Tilted camera. | Callouts: "Workstreams · chores that run on a schedule" · "Every call through Nebius Token Factory · priced per token, routed by job" · "Cost router · the cheapest Nemotron that can do the step" | `laptop-frame` (free) → footage `overview` | +2 |
| 4 | 0:24–0:26 | 1 | Ch 1 card | The sentence arrives one word at a time, out of order, and gathers: the first word holds the frame, the rest drop in in mint and slide home. | "You set the goal. It plans." | `word-gather` (free) | — |
| 5 | 0:26–0:38 | 6 | Goal → plan | The goal types into the real composer (cursor ring on the field), send. The plan draft arrives: one agent reads, three draft. Drag one step; Approve plan with a drawn tick. | Goal text (the app's): "Every weekday at 8: read my inbox, calendar and GitHub. Tell me what needs me and draft the replies." Callouts: "The plan · who does what, before anything runs" · "$[real] · you see the cost first" · "Allowed tools · it can't use anything else" | footage `brief1-goal` → `brief1-plan-draft`; `cursor-track` ring; `button-press` tick drawn over the real Approve plan | +2 |
| 6 | 0:38–0:58 | 10 | Timeline | The lanes fill, names always in frame; three Writer lanes start at once; a model badge on each segment; the cost ticks in the header. Click one segment → Agent I/O shows the email it read. Tilted camera, pan along the lanes. | Callouts: "One row per agent · they work at the same time" · "Model per step · Ultra plans, Super reads and writes" · "Live cost · stops at your budget" · "What it read · every step is open to check" | footage `brief1-checklist` + `brief1-agent-io` | +3 |
| 7 | 0:58–1:10 | 6 | The brief | The finished brief: "Needs you today" ranked by deadline, the calendar table, "Can wait". | Callouts: "Your morning, already read · inbox, calendar, GitHub → one page" · "Ranked by who waits · and by when" · "Noise moved aside · no draft for it" | footage `brief1-doc` | +2 |
| 8 | 1:10–1:12 | 1 | Ch 2 card | The static line; a mint marker wipes across the last two words; a small CloudMark at the end turns orange on the last beat. | "Nothing leaves **without you**." | `text-highlight` (free, installed) + CloudMark | — |
| 9 | 1:12–1:30 | 9 | Approvals | The cloud is orange, the status pill says "Needs you", the approval card shows the first drafted reply in full. Approve (the **music drop at 1:16**, a drawn tick). Approve the second. On the third: Approve & always allow → the rule line appears. | Callouts: "Sending is an action · so it waits for you" · "Approve, reject with a note · or allow from now on" · "One rule saved · you can revoke it anytime" | footage `brief1-approvals` + sub-beats; `button-press` tick on each Approve | +3 |
| 10 | 1:30–1:40 | 5 | Summary | The Approve pill settles, its label dissolves, it collapses into a mint square that slams in as the tallest bar of the run's cost chart; the chart rises as one object; cut to the real summary tiles counting up. | Callouts: "The whole morning · $[real]" · "Router savings · versus always using the biggest model" | `MetricMorph` (ours) 1 bar → footage `brief1-summary` 4 bars | +1 |
| 11 | 1:40–1:42 | 1 | Ch 3 card | A sentence that finishes itself: the word beside a ticked box rolls up out of a slot four times, then the line steps back to 80 % and rests. | "It learns ☑ your priorities" → "your tone" → "your rules" → "your tools" → "every run." | `check-cycle` (free) | — |
| 12 | 1:42–1:54 | 6 | Memory & skill | The Memory & skill tab: memory cards, the skill file, the rule card; hover Forget. | Callouts: "Memories · what it learned from your morning" · "Its own how-to · rewritten after each run" · "Forget or revoke · you stay in charge" | footage `memory-skill` | +2 |
| 13 | 1:54–2:04 | 5 | Run two | The next morning's plan with the learned chip; the ruled reply goes out with no card; the header cost is lower than run one. | Callouts: "Uses what it learned · no repeat questions" · "Run two: $[real] · cheaper and faster" | footage `brief2-learned` → `brief2-summary` | +2 |
| 14 | 2:04–2:06 | 1 | Ch 4 card | Three dashed orbits round the line, three labelled stops riding the inner one; it winds up to a blur and whips into the footage. Dark. | "Always on, wherever you are" · stops "08:00 SCHEDULE" · "CHAT APP" · "STATUS PILL" | `OrbitFlow` (ours) | — |
| 15 | 2:06–2:16 | 5 | Radar + pill | The rail shows an unread dot "ran 09:00"; open the digest; switch workstream; the status pill shows "Radar · 1 waiting"; approve from the pill. | Callouts: "Ran on schedule · while you were away" · "Status pill · answer from anywhere in the app" | footage `radar` → `status-pill` | +2 |
| 16 | 2:16–2:24 | 4 | Chat app | Phone screens rise out of a blur one after another, each pushing the stack back: "what needs me?" → the reply · "run morning brief" → "Needs your OK · 2 more waiting" · "approve all" → "Approved". Every screen is the real `/v1` exchange from `docs/video/chat-transcript.json`. | Callout: "Same crew in your chat app · via OpenClaw or Hermes" | `phone-stack` (free) | +1 |
| 17 | 2:24–2:28 | 2 | Web run | Hard cut to the web timeline: the same run, trigger "chat". | Callout: "Same run, same approvals · one history" | footage `chat-run` | +1 |
| 18 | 2:28–2:34 | 3 | Its own bill | Token Factory watch: the crew's proposal table of which Nemotron tier each role uses; approve; the router gauge moves. | Callouts: "It watches its own bill · proposes cheaper routing" · "Approved · the saving shows up here" | footage `watch` | +1 |
| 19 | 2:34–2:40 | 3 | How we used Nebius | A scatter of every model call from the real call log blooms onto a tilted plane (x time of day, y cost, colour = tier); the three model-id tiles land on it one per beat, each with its job; under them the endpoint line. | Tiles: `Nemotron-3-Ultra-550b-a55b` "plans" · `nemotron-3-super-120b-a12b` "reads, writes, researches" · `NVIDIA-Nemotron-3-Nano-30B-A3B` "checks, learns" · line: "One endpoint · api.tokenfactory.nebius.com · [real] calls · $[real] this week" | `ScatterBloom` (ours) + `count-grid` tiles | — |
| 20 | 2:40–2:46 | 3 | Run it | A terminal types `git clone github.com/harrymove-ctrl/nimbus && pnpm dev`, the output scrolls, the last line reads "Nimbus · http://localhost:3000"; a cursor-pinned zoom on the URL. | (the terminal is the text) | `terminal-simulator` (free, installed) | — |
| 21 | 2:46–2:56 | 5 | End | The lockup on the boot sky, held still: the CloudMark, "Nimbus", the repo URL and `pnpm dev`, then "MIT · Nebius × NVIDIA Global AI Hackathon". | "github.com/harrymove-ctrl/nimbus" · "pnpm dev" | `Lockup` (ours) | — |

88 bars. The "+" column is the bars each scene may take if a longer master is allowed (sum +25 bars → 3:46).

# X clip (0:44, 22 bars)

| # | Time | Bars | From | Change |
|---|---|---|---|---|
| 1 | 0:00–0:04 | 2 | 1 | The orb sentence at double speed: two lines per bar ("Your standing work, done every morning" · "by a crew that asks before it acts.") |
| 2 | 0:04–0:08 | 2 | 2 | Block Wordmark, same |
| 3 | 0:08–0:14 | 3 | 5 | Goal sent → plan arrives → Approve plan; one callout (the cost) |
| 4 | 0:14–0:24 | 5 | 6 + 9 | Lanes 2 bars (lanes callout), the Ch 2 line 1 bar ("Nothing leaves without you."), the gate: Approve at **0:23** (the drop) |
| 5 | 0:24–0:30 | 3 | 13 | Run two with the learned chip; one callout |
| 6 | 0:30–0:38 | 4 | 16 | Phone Stack: "run morning brief" → "approve all" → "Approved" |
| 7 | 0:38–0:44 | 3 | 20 + 21 | Terminal 1 bar, end card 2 bars |

# Footage and numbers (the builder session's part)

1. **Role-named contacts.** In `fixtures/inbox/`, `fixtures/inbox.csv` and the `ws-brief` / `ws-brief~2` writer fixtures, the people become roles: "Client · contract review" (was Dana), "Teammate · demo link" (was Priya), "Reviewer · bug fix" (was Sam), with neutral example addresses (`client@example.com` …). No first names anywhere on screen.
2. **One recorded real run.** On Oct 29, after Phase 3 is green, record `pnpm demo:video` once with `NIMBUS_MODEL` set to the real tiers (the planned final-day run, moved a day earlier). The recorder writes `beats.json` with the sub-beats and callout targets as before. That take is the footage, and its costs are the `$[real]` numbers. Budget: one Morning brief run twice (run one and run two) plus the radar, watch and chat beats, about $0.50 at list prices; cap with `NIMBUS_DAY_CAP`.
3. **The call log** for the proof scene: `video/scripts/export-mock-calls.py` becomes `export-calls.py` and reads the dev database after the real run; the tile under it says the real count.
4. Until that take exists, the video session builds on take 1633 with the preview watermark, so the edit is final before the real footage drops in.
