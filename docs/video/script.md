status: approved · 2026-10-27 · "Approve script rev 5 as written."
revision: rev 5 · back to v3's real app walkthrough, per the user: "nimbus-demo-v3.mp4 is what i want but need details no text transcript and more flow useful real to submit" and "demo should show what is this and how it impacts". Supersedes rev 4 (kinetic-type scenes dropped).
track: Personal AI
cuts: full (2:54, 1920 × 1080, 87 bars + 1-bar audio tail) · X clip (0:44, 22 bars, cut from full)
grid: 120 BPM · 1 bar = 2.0 s = 60 frames at 30 fps
captions / transcript: none. No sentence captions at the bottom (v3 had them; the user does not want them).
on-screen words: about 230, almost all in callouts pinned to the UI (the user asked for details; this overrides the 120-word guide)
remember this: Nimbus is an AI crew that runs your standing chores every day, shows you what each agent does and what it costs, asks before anything leaves, and gets better every run.

No voice. `[real: …]` = filled from the final-day real-model run; until then the number shows a small "mock" tag.

## What changed from v3, and why

| v3 problem | Rev 5 fix |
|---|---|
| The hero run is the crew fixing Nimbus's own router test ("404 fallback", "ceiling", "golden"). A stranger can't follow it. | The hero is **Morning brief**: inbox, calendar and GitHub become one page and three draft replies. Everyone has this chore. Ship Nimbus only appears as a name in the workstream list. |
| Zoomed shots cut off the lane names, so the timeline is coloured blobs. | Every zoom keeps the lane names in frame, and a callout says what a row is. |
| Bottom sentence captions read like a transcript. | Removed. Words appear only as **callouts** pinned to the thing they explain. |
| It shows the UI but not what each part is for. | Each callout has two lines: **what it is** and **why it helps you**. |
| Only one real flow. | Five everyday flows: plan and approve, the brief, approvals, learning, always-on (schedule, status pill, chat app, its own bill). |

## The callout (the one new component)

A ring around the UI element, a thin leader line, and a small card (neutral-900, white/10 border, Manrope): line 1 bold, ≤ 6 words, **what it is**; line 2 neutral-400, ≤ 9 words, **why it helps you**. The rest of the frame dims 25 %. In on a downbeat (ring draws 8 f, card rises 6 f), holds at least 2 bars, out on beat 4. One callout at a time, two at most. Element positions come from the recorder (bounding boxes per beat), so rings sit exactly on the UI.

A chapter eyebrow slides in top-left at each chapter ("1 · You approve the plan") and stays small; no full-screen chapter cards.

# Full cut

| # | Time | Bars | Chapter | Picture (real app footage unless noted) | Callouts (what it is · why it helps you) | Sound |
|---|---|---|---|---|---|---|
| 1 | 0:00–0:06 | 3 | — | **Cold open, the payoff.** The finished morning brief open in the Artifact tab, "Needs you today" with Dana, Priya, Sam; below it the tray "3 waiting · Send reply to Dana"; the cloud orange. Slow push in. | On the brief: "Your morning, already read · inbox, calendar, GitHub → one page". On the tray: "3 replies drafted · nothing is sent without your OK" | cuelume attention on the cloud; music intro |
| 2 | 0:06–0:10 | 2 | — | Title on neutral-950 with dither glow: **Nimbus**, then "An AI crew that asks before it acts", then "NVIDIA Nemotron · Nebius Token Factory" | (the title is the text) | riser → soft impact |
| 3 | 0:10–0:22 | 6 | — | **Overview.** Stat cards count up, spend chart draws in, the workstream list with schedules (Morning brief 08:00 · Hackathon radar 09:00 · Token Factory watch 07:00 · Ship Nimbus). | On the list: "Workstreams · chores that run on a schedule". On spend: "Every call priced · on Nebius Token Factory". On the router gauge: "Cost router · cheapest Nemotron that can do the step" | count cue on the counters; tap on click |
| 4 | 0:22–0:36 | 7 | 1 · You approve the plan | The goal types into the composer: "Every weekday at 8: read my inbox, calendar and GitHub. Tell me what needs me and draft the replies." Send. The plan draft arrives: Analyst reads, three Writers draft. Drag one step; Approve plan. | On the plan: "The plan · who does what, before anything runs". On the estimate: "≈ $0.03 [real] · you see the cost first". On Tools: "Allowed tools · it can't use anything else" | type, tap, ready (plan arrives), select (drag), success |
| 5 | 0:36–0:56 | 10 | 1 | **Timeline fills** (lane names always in frame). The Analyst lane reads; three Writer lanes start at once; a model badge on each segment; the cost ticks in the header. Click the Analyst's segment → Agent I/O shows Dana's real email. | On the lanes: "One row per agent · they work at the same time". On a badge: "Model per step · Ultra plans, Super reads and writes". On the cost: "Live cost · stops at your budget". On Agent I/O: "What it read · every step is open to check" | loading on start; tap; select on the segment |
| 6 | 0:56–1:06 | 5 | 1 | **The brief.** Scroll "Needs you today" (by deadline), the calendar table, "Can wait" (invoice, digest). | On the list: "Ranked by who waits and by when". On "Can wait": "Noise moved aside · no draft for it" | ready when the doc opens |
| 7 | 1:06–1:24 | 9 | 2 · Nothing leaves without you | The cloud turns orange; status pill "Needs you"; the approval card shows the reply to Dana in full. Approve (Dana). Approve (Priya). On Sam's: Approve & always allow → the rule line appears. | On the card: "Sending is an action · so it waits for you". On the buttons: "Approve, reject with a note · or allow from now on". On the rule: "One rule saved · you can revoke it anytime" | attention; success ×2; success strong on the rule; music drop 2 on the first Approve |
| 8 | 1:24–1:34 | 5 | 2 | **Run summary** counts up: cost, tokens, time, vs baseline, "5 memories saved". | On cost: "The whole morning · $0.03 [real]". On vs baseline: "Router savings · versus always using the biggest model" | count; ready |
| 9 | 1:34–1:48 | 7 | 3 · It gets better every run | **Memory & skill tab.** Memory cards ("Replies that name a date come first"), the skill file, the rule card; hover Forget. | On memories: "Memories · what it learned from your morning". On the skill: "Its own how-to · rewritten after each run". On Forget: "Forget or revoke · you stay in charge" | select; open |
| 10 | 1:48–2:00 | 6 | 3 | **The next morning's run.** Learned chip "✦ 5 mem · 1 rule" on the plan; replies to Sam go out under the rule with no card; header cost lower than run one. | On the chip: "Uses what it learned · no repeat questions". On the cost: "Run two: $[real] · cheaper and faster" | ready; success |
| 11 | 2:00–2:12 | 6 | 4 · Always on | **Hackathon radar.** Rail shows an unread dot "ran 09:00"; open: the digest doc and what changed since yesterday. Switch to another workstream: the status pill shows "Radar · 1 waiting"; approve from the pill. | On the dot: "Ran on schedule · while you were away". On the pill: "Status pill · answer from anywhere in the app" | navigate; attention; success |
| 12 | 2:12–2:28 | 8 | 4 | **In your chat app.** Phone frame with the real `/v1` exchange: "what needs me?" → reply; "run morning brief" → "Needs your OK: Send message to dana@example.com · 2 more waiting"; "approve all" → "Approved: …" and the brief. Cut to the web timeline: the same run, trigger "chat". | On the phone: "Same crew in your chat app · via OpenClaw or Hermes". On the web run: "Same run, same approvals · one history" | tap per message; success on approve all |
| 13 | 2:28–2:38 | 5 | 4 | **Token Factory watch.** The crew's proposal: a before/after table of which Nemotron tier each role uses; approve; the router gauge moves. | On the table: "It watches its own bill · proposes cheaper routing". On the gauge: "Approved · saving shows up here" | attention; success; count |
| 14 | 2:38–2:46 | 4 | — | Proof tiles rush in one per beat: `Nemotron-3-Ultra-550b-a55b` · `nemotron-3-super-120b-a12b` · `NVIDIA-Nemotron-3-Nano-30B-A3B`, under them "Nebius Token Factory", then "19/19 trajectory evals pass · MIT" | (the tiles are the text) | sub hit per tile |
| 15 | 2:46–2:54 | 4 | — | End card: Nimbus, the repo URL, `pnpm dev`, held still | (the card is the text) | silence one beat, deep impact, chord rings |

# X clip (0:44, 22 bars)

| # | Time | Bars | From | Change |
|---|---|---|---|---|
| 1 | 0:00–0:06 | 3 | 1 | Same cold open, both callouts |
| 2 | 0:06–0:10 | 2 | 2 | Same title |
| 3 | 0:10–0:16 | 3 | 4 | Goal sent → plan arrives → Approve plan; one callout (the estimate) |
| 4 | 0:16–0:26 | 5 | 5 + 7 | Lanes fill 2 bars (lanes callout), then the gate: Approve on Dana's reply (the drop on the click) |
| 5 | 0:26–0:32 | 3 | 10 | Run two with the learned chip; one callout |
| 6 | 0:32–0:40 | 4 | 12 | Chat: "run morning brief" → "approve all" → approved |
| 7 | 0:40–0:44 | 2 | 15 | End card |

# Footage needed (new take)

The v3 take follows Ship Nimbus, so rev 5 needs a new recording, still zero
spend (mock or replay):
- `brief1-*` beats: goal, plan draft, timeline, Agent I/O on Dana's email, the brief doc, the three approvals with the rule, the summary.
- `memory-skill` on the Morning brief workstream.
- `brief2-*`: run two with the learned chip and no card for the ruled reply (needs a `ws-brief~2` fixture).
- `radar`, `status-pill` (radar waiting while another workstream is open), `chat-run`, `watch` (Token Factory watch proposal and approval), `overview`.
- The recorder writes each callout target's bounding box per beat into `beats.json`.
