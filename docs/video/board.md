status: approved · 2026-10-27 · "Approve the rev 5 board, music brief and SFX sheet: build it." · rev C
script: docs/video/script.md rev 5 (approved 2026-10-27, "Approve script rev 5 as written.")
captions: none, and no sentence captions (story.md rule 12); words live in callouts, the title and the end card
grid: 120 BPM · 30 fps · beat = 15 f · bar = 60 f · full cut 87 bars (5220 f, 2:54) + 1-bar audio tail · X clip 22 bars (1320 f, 0:44)
supersedes: the rev A and rev B scene boards (in git history). PromptRoll, CommentStorm, ColumnCut and AgentChat are not in this cut; their files stay in `video/src/scenes/`.
rev D (motion layer, on top of rev C): requested 2026-10-28 · "các animation đâu ui ux show như [Text Highlight, Punch Lines, Focus Pull, Lockup Reveal, Metric Morph, Orbit Flow, Scatter Bloom, Screen Wall] … kết hợp để transition và chọn font cũng như ui ux như bản web đang dùng"

# Motion layer · rev D

Why: the locked rev C cut is a walkthrough with callouts, but it has no motion design.
The title is plain text on black, the cloud never appears, and each chapter starts with only a small chip.
The user wants the walkthrough kept, with real motion scenes as the transitions between parts, in the web app's font and look.

**Rules for every motion scene**
- Font: Manrope only, at the weights the app uses (500, 600, 700). Do not use the reference clips' faces (Archivo and others).
- Colour: the app's palette from `video/src/theme.ts`, dark-first.
  - The one bright surface allowed is the app's own boot sky, used in the Lockup and the end card.
  - Boot sky: `linear-gradient(180deg, #1659c8, #2aa6e6)` plus the radial `rgba(90, 205, 255, 0.45)`, both from `src/components/nimbus/boot.tsx:15`.
  - No light paper scenes: the Orbit Flow reference is light, and ours is dark.
- **The cloud is the mark.** Port `src/components/glow-cloud.tsx` as a frame-pure `video/src/components/CloudMark.tsx`.
  - Keep the same PUFFS, CORE, EYES, goo filter and gradients.
  - Drive the breathe, glance, blink and wink from `useCurrentFrame()`, not from requestAnimationFrame.
  - It looks like the boot screen (blue, eyes) and turns orange where the app turns it orange.
- **Sources:**
  - `punch-lines` is a free install: `npx shadcn@latest add @snapcn/punch-lines`.
  - `text-highlight` is already in `video/src/components/snap-cn/`.
  - Focus Pull, Lockup Reveal, Metric Morph, Orbit Flow, Scatter Bloom and Screen Wall are not in the free catalogue. Build our own from the described behaviour in `video/src/scenes/`, and never copy paid source (components.md "Signature scenes").
- Each motion scene enters on a downbeat with its designed transition sound, which gets a new sfx.md row. The cut out of it to footage is hard, on a downbeat.
- **Scene lengths and the music map do not change.** A motion scene takes bars from the start of its own scene, and the footage is refitted to what is left (see the Fit column). That keeps `music.md` valid for the Suno takes.
- The chapter eyebrow chip stays; it slides in as the motion scene cuts to footage.

| Scene | Frames | Motion scene | What it does on screen (our content) | Footage left · fit |
|---|---|---|---|---|
| 2 title | 180–300 (2 bars) | **Lockup Reveal** with the cloud | Beat 1: the CloudMark sits alone on a dark card with dashed construction hairlines on every edge. It slides aside while "Nimbus" slides out of a slot behind it, and the lockup settles from 1.1×. The boot-sky gradient rises inside the letterforms. On bar 2's downbeat, cut to the same gradient full-frame with the lockup knocked out in white. The cloud blinks once. "An AI crew that asks before it acts" and "NVIDIA Nemotron · Nebius Token Factory" build under it, a word per beat. | — |
| 4 Ch 1 | 660–720 (1 bar) | **Punch Lines** (free) | "You ask." and "It plans." flick in and rush past the camera. The hero line "You approve the plan" punches up from a third of its size. | 6 bars. The fit is 1.72×, over the cap, so cut the planning wait inside `brief1-goal` (rule 7). |
| 7 Ch 2 | 1980–2040 (1 bar) | **Text Highlight** (installed) | The static line "Nothing leaves without you." A mint marker wipes across "without you". As it lands, a small CloudMark at the end of the line turns orange. | 8 bars. Approve (Dana) must still land on **2160**, which needs about 1.5×. Check it; if it misses, trim the card wait before the click. |
| 8 summary | 2520–2580 (1 bar) | **Metric Morph** | The "Approve & always allow" pill from scene 7 settles and its label dissolves. It collapses into a square that runs neutral-900 → mint and slams in as the tallest bar of the run's cost chart. The chart rises around it as one object, then cut to the summary tiles. | 4 bars, 0.64× ✓ |
| 9 Ch 3 | 2820–2940 (2 bars) | **Focus Pull** | Over a slow field from the app's dither glow (mint and blue, low): "It remembers." then "It gets better every run." Each line arrives from the right, oversized and soft, and pulls into focus a glyph at a time. The next line resolves over the last. The ink is plain white. | 5 bars, 1.07× ✓ |
| 11 Ch 4 | 3600–3720 (2 bars) | **Orbit Flow** (dark) | Three dashed orbits round "Always on, wherever you are". Three stops ride the inner orbit as pills with a role-colour half-dot: "08:00 SCHEDULE", "CHAT APP", "STATUS PILL". The inner orbit winds up to a blur on the last beat, then whips into the radar footage. | 4 bars, inside the trims already planned ✓ |
| 12 chat | 3960–4080 (2 bars) | **Screen Wall** | Four phones down a tunnel. Each screen is a real frame of the `/v1` chat from `docs/video/chat-transcript.json`: "what needs me?", "run morning brief", "approve all", "Approved". The camera backs out until they frame "Same crew, in your chat app", which builds a word at a time with the horizontal shove. | Phone chat 4 bars (was 6): "run morning brief" → "approve all" → "Approved". Web run 2 bars. |
| 14 proof | 4740–4860 (2 bars) | **Scatter Bloom** under the tiles | One point per model call from the local mock runs (real rows from the dev database, never invented counts). x = time of day, y = cost, and the colour is the tier colour (Ultra, Super, Nano) from the Overview. The points bloom onto a tilted plane while the camera drifts. A "mock" tag stays in the corner until the real run. | The three model-id tiles land on the plane, b2–b4. |
| 15 end | 4980–5220 | **Lockup Reveal**, reprise | The same lockup on the boot sky, now held still. github.com/harrymove-ctrl/nimbus and `pnpm dev` sit under it for at least 3 s. It replaces `wordmark-cut`. | — |

The X clip uses the Lockup on the title (180–300) and on the end card (1200–1320), plus a 1-bar Screen Wall at 960–1020 before the phone. The drop on Dana stays at 690.

Note on length: the script header says "85 bars + 1-bar tail", but its scene table adds up to 87 bars = 2:54, which is the length it states. This board follows the table (87 bars, 6 s under 3:00).

# Look (rev B, unchanged)

- **Palette from the code**, every value in `video/src/theme.ts` with its source line: background `neutral-950`, cards `neutral-900`, lines white/10, text neutral-100 / neutral-400, accent `--rb-accent` mint, role colors from `src/lib/run-view.ts` `ROLE_COLOR` (checker, researcher, analyst, writer), tier colors from the Overview. Cloud blue and orange only where the cloud is drawn.
- **Dark-first**: every scene sits on neutral-950. The title and end card carry the app's 3 % dither glow.
- **Framing**: footage fills ≥ 85 % of the frame; push in until the UI text a callout points at is ≥ 28 px at 1080p; **lane names stay in frame** whenever the timeline is on screen (story.md rule 11); no frame more than a third empty for over 1 s (title and end card excepted).
- **Motion**: every footage shot moves (push, pan, or a slow 6 % creep under a hold); nothing still for more than 2 s except the end card.

# Components

## Callout (`video/src/components/Callout.tsx`, new)

Per components.md "Explainer callout":
- **Ring** around the target: mint, 2 px, 8 px padding, radius 10; draws in over 8 f (stroke-dashoffset).
- **Leader**: a 1.5 px line, white/40, from the ring's nearest edge to the card; draws with the ring.
- **Card**: neutral-900, white/10 border, radius 14, padding 18 × 24, Manrope. Line 1: 600, 34 px, neutral-100, ≤ 6 words, *what it is*. Line 2: 500, 28 px, neutral-400, ≤ 9 words, *why it helps you*. A role-color dot (12 px) before line 1 when the target belongs to one agent. Card rises 12 px and fades in over 6 f, starting as the ring finishes.
- **Dim**: the rest of the frame dims 25 % (a neutral-950 overlay at 25 % with the target's box cut out) while any callout shows; 6 f in, 6 f out.
- **Timing**: in on a downbeat, holds ≥ 2 bars, out on beat 4 of its last bar (fade 6 f). One at a time, two at most (the second's in-point is the first's last bar).
- **Placement**: the card goes on the emptier side of the target (left/right/above/below, chosen per callout in the scene table so it is deterministic), never over the target or its label; 48 px from the frame edge at least.
- **Tracking**: targets come from `docs/demo/raw/beats.json` (`targets: { name: { x, y, w, h } }` in take pixels, per beat), mapped through the same camera transform as the footage, so the ring rides a push-in. A target missing from beats.json falls back to a hand box in `video/src/callouts.ts` and is listed in QA.
- Pure function of the frame. Props: `target`, `what`, `why`, `role?`, `from`, `to`, `side`.
- Words are the script's, verbatim; a callout written as one phrase in the script is split at a natural break ("Ranked by who waits" / "and by when").

## Chapter eyebrow (`video/src/components/Eyebrow.tsx`, new)

A small chip top-left (48 px in from top and left): neutral-900 at 90 %, white/10 border, radius 999, Manrope 600 28 px; the chapter number in mint, then the title in neutral-100 ("**1** · You approve the plan"). Slides in from the left over 8 f on the chapter's first downbeat; stays for the whole chapter; never cut off by a push-in (it sits above the footage, not inside it). No full-screen chapter cards.

## Kept from the previous build

- `Footage` (screen-recording + ring-only cursor-track, slow creep) for every app shot.
- `Proof` (count-grid, adapted) for scene 14, re-texted per the script.
- `wordmark-cut` + `EndCard` for scene 15.
- **Title card** (new, small): `TitleCard.tsx` on neutral-950 + dither glow, three lines on the beat (see scene 2).
- **Phone frame**: snapcn `phone-frame` (free) with the chat drawn inside it, replaying `docs/video/chat-transcript.json` word for word (only the typing rate is chosen; reply words stream, grey 6 f before they set). The selection from the transcript is the one already agreed: link lines dropped; "approve all" shows "Approved: …", the brief's two header lines and item 1 cut at its first sentence with " …".

# Scene board (full cut)

Frames are absolute in `NimbusFull`. "b" = bar inside the scene (b0 = its first bar). Callout times are `in → out` in scene bars (in on the downbeat, out on beat 4 of the bar before `out`). Footage beats are the keys the new take's `beats.json` will carry; names marked * are sub-beats we ask the recorder to mark (see "From the new take").

| # | Frames | Bars | Footage beat | Camera | Callouts (target · what · why · side · bars) | Sound |
|---|---|---|---|---|---|---|
| 1 | 0–180 | 3 | `brief1-doc` end: the finished brief in the Artifact tab, tray "3 waiting", cloud orange | Push 1.5 → 1.9 over 3 bars toward the brief, tray in frame | `brief-doc` · "Your morning, already read" · "Inbox, calendar, GitHub → one page" · right · b0 → b2. `tray` · "3 replies drafted" · "Nothing is sent without your OK" · above · b1 → b3 | cuelume attention (cloud orange) on f 8; music intro |
| 2 | 180–300 | 2 | — (title card) | Title lines on the beat: "Nimbus" (b0 beat 1), "An AI crew that asks before it acts" (b0 beat 3), "NVIDIA Nemotron · Nebius Token Factory" (b1 beat 2); a 4 % drift | — | riser-1bar into the downbeat at 300, soft impact on 300 |
| 3 | 300–660 | 6 | `overview` | 1.6 on the stat cards (b0), pan down to the workstream list 2.1 (b0.5–b2), spend chart 2.0 (b2–b4), router gauge 2.2 (b4–b6) | `workstreams` · "Workstreams" · "Chores that run on a schedule" · right · b0 → b2. `spend-chart` · "Every call priced" · "On Nebius Token Factory" · right · b2 → b4. `router-gauge` · "Cost router" · "Cheapest Nemotron that can do the step" · left · b4 → b6 | count (2 s) as the cards count up at 300; tap on the day click |
| 4 | 660–1080 | 7 | `brief1-goal` → `brief1-plan-draft` | Composer at 2.2 while the goal types (b0–b2); plan card 2.2 (b2–b5); estimate chip 2.4 (b4–b6); Tools chip 2.4 (b5–b7); Approve plan ring at its click | `plan` · "The plan" · "Who does what, before anything runs" · right · b2 → b4. `estimate` · "≈ $0.03 · mock" · "You see the cost first" · below · b4 → b6. `tools` · "Allowed tools" · "It can't use anything else" · above · b5 → b7 | type (per keystroke, ≤ 1 per 3 f); tap on send; ready (subtle) as the plan arrives; select on the drag; tap + success on Approve plan |
| 5 | 1080–1680 | 10 | `brief1-checklist` (timeline) + `brief1-agent-io`* | Lanes at 1.8 with **lane names in frame** (b0–b3); pan to the badges 2.2 (b3–b5); header cost 2.4 (b5–b7); click the Analyst segment, inspector 2.3 (b7–b10) | `lanes` · "One row per agent" · "They work at the same time" · right · b1 → b3. `model-badge` · "Model per step" · "Ultra plans, Super reads and writes" · below · b3 → b5 (role dot: analyst). `run-cost` · "Live cost" · "Stops at your budget" · below · b5 → b7. `agent-io` · "What it read" · "Every step is open to check" · left · b8 → b10 | loading (subtle) on 1080; select on the segment click; designed whoosh into 6 |
| 6 | 1680–1980 | 5 | `brief1-doc` | The doc at 2.2, scroll "Needs you today" (b0–b2), calendar table, "Can wait" (b3–b5) | `needs-you` · "Ranked by who waits" · "And by when" · right · b0 → b2. `can-wait` · "Noise moved aside" · "No draft for it" · right · b3 → b5 | ready on 1680 (the doc opens) |
| 7 | 1980–2520 | 9 | `brief1-approvals` + sub-beats `approve-dana`*, `approve-priya`*, `always-allow`* | Cloud + card at 1.9 (b0–b3); Approve (Dana) ring at **b3 = 2160 = 1:12**; Priya at b5; Sam's Approve & always allow at b6.5; the rule line at 2.4 (b7–b9) | `approval-card` · "Sending is an action" · "So it waits for you" · right · b0 → b3. `approve-buttons` · "Approve, reject with a note" · "Or allow from now on" · above · b3 → b6. `rule-line` · "One rule saved" · "You can revoke it anytime" · above · b7 → b9 | attention on 1980 (one per burst); **music drop 2 on 2160**; success on Dana (2160) and Priya (2280); success **strong** on always-allow (2370) |
| 8 | 2520–2820 | 5 | `brief1-summary` | Summary tiles 2.0, push 2.3 on cost (b1–b3), baseline (b3–b5) | `summary-cost` · "The whole morning" · "$0.03 · mock" · above · b1 → b3. `vs-baseline` · "Router savings" · "Versus always using the biggest model" · above · b3 → b5 | count (700 ms) 8 f after 2520; ready 33 f after (memories saved) |
| 9 | 2820–3240 | 7 | `memory-skill` (Morning brief) | Memory cards 2.3 (b0–b2), skill file 2.2 (b2–b5), hover Forget 2.6 (b5–b7) | `memories` · "Memories" · "What it learned from your morning" · left · b0 → b2. `skill-file` · "Its own how-to" · "Rewritten after each run" · left · b3 → b5. `forget` · "Forget or revoke" · "You stay in charge" · left · b5 → b7 | select on the tab (2820); open (subtle) on the hover; music Calm |
| 10 | 3240–3600 | 6 | `brief2-learned` → `brief2-summary` | Plan with the learned chip 2.3 (b0–b3); header cost 2.4 (b3–b6) | `learned-chip` · "Uses what it learned" · "No repeat questions" · right · b1 → b3. `run2-cost` · "Run two: $[real] · mock" · "Cheaper and faster" · below · b4 → b6 | ready (subtle) as the plan arrives; success on run done |
| 11 | 3600–3960 | 6 | `radar` → `status-pill` | Rail with the unread dot 2.4 (b0–b2); digest doc 2.0 (b2–b3); another workstream, the pill 2.6 (b3–b6); approve from the pill | `unread-dot` · "Ran on schedule" · "While you were away" · right · b0 → b2. `status-pill` · "Status pill" · "Answer from anywhere in the app" · below · b3 → b5 | navigate on the rail click; attention (pill); success on approve |
| 12 | 3960–4440 | 8 | phone frame (b0–b6), then `chat-run` (b6–b8) | Phone frame tilts in (b0), holds with motion inside, push 1.0 → 1.08; hard cut to the web timeline 2.0 at b6 | `phone` · "Same crew in your chat app" · "Via OpenClaw or Hermes" · left of the phone · b1 → b3. `chat-run` · "Same run, same approvals" · "One history" · right · b6 → b8 | tap per sent message; ready (subtle) per reply; success **strong** on "approve all"'s "Approved" |
| 13 | 4440–4740 | 5 | `watch` | The proposal table 2.2 (b0–b2); approve; router gauge 2.4 (b3–b5) | `routing-table` · "It watches its own bill" · "Proposes cheaper routing" · right · b0 → b2. `router-gauge` · "Approved" · "Saving shows up here" · left · b3 → b5 | attention on 4440; success on approve; count on the gauge; riser-2bar 4620 → 4740 (the lift) |
| 14 | 4740–4980 | 4 | — (Proof) | Tiles rush in one per beat (4740, 4755, 4770); "Nebius Token Factory" under them at 4800; "19/19 trajectory evals pass · MIT" at 4860; 5 % push | — (the tiles are the text; "mock" tag until real) | sub-hit per tile; count on 19/19 |
| 15 | 4980–5220 | 4 | — (wordmark → end card) | wordmark-cut b0; end card held still b1–b4 (the one allowed hold): Nimbus, github.com/harrymove-ctrl/nimbus, `pnpm dev` | — | silence 4965–4980; impact-deep 4980; the outro chord rings into the tail |

# X clip board (22 bars, 1320 f)

| # | Frames | From | What changes |
|---|---|---|---|
| 1 | 0–180 | 1 | Same, both callouts |
| 2 | 180–300 | 2 | Same title |
| 3 | 300–480 | 4 | Goal sent → plan arrives → Approve plan (b2); one callout: `estimate` b0 → b2 |
| 4 | 480–780 | 5 + 7 | Lanes 2 bars (`lanes` callout b0 → b2); cut to the gate at 600 (orange, attention); **Approve on Dana at 690 = bar 11.5: music drop** (success); `approval-card` callout b2 → b4 |
| 5 | 780–960 | 10 | Run two, `learned-chip` callout b0 → b2 |
| 6 | 960–1200 | 12 | Phone: "run morning brief" → "approve all" → "Approved: …" (success strong) |
| 7 | 1200–1320 | 15 | Silence 1185–1200, impact-deep 1200, end card held |

# From the new take (what depends on its durations)

Board timings come from the script grid. The footage is fitted to them (speed up to 1.5×, trims inside a beat), so the take's lengths matter only here:
1. **Sub-beats we need marked in `beats.json`** (a beat with tStart = the moment): `brief1-plan-arrives`, `brief1-approve-plan`, `brief1-agent-io`, `approve-dana`, `approve-priya`, `always-allow`, `brief2-plan-arrives`, `pill-approve`, `watch-approve`. The approve clicks are the points the cut must land on (scene 7's b3 is the music's drop 2); with marks, the shot is slid and ramped so the click falls on the frame.
2. **Callout targets** in `beats.json` per beat, named as in the scene table (`brief-doc`, `tray`, `workstreams`, `spend-chart`, `router-gauge`, `plan`, `estimate`, `tools`, `lanes`, `model-badge`, `run-cost`, `agent-io`, `needs-you`, `can-wait`, `approval-card`, `approve-buttons`, `rule-line`, `summary-cost`, `vs-baseline`, `memories`, `skill-file`, `forget`, `learned-chip`, `run2-cost`, `unread-dot`, `status-pill`, `chat-run`, `routing-table`). Elements that scroll (the doc) need a box per beat at the moment the callout opens.
3. **Lengths that would force a change**: if a beat is longer than its scene × 1.5 (e.g. a slow plan draft or a long approval wait), the shot starts later inside the beat; if it is shorter than its scene × 0.5, the scene gets a longer creep or borrows from the neighbour. Scene 7 (9 bars for three approvals) and scene 5 (10 bars of timeline) are the ones to watch.
4. **Run two** needs the learned chip and the ruled reply going out with no card; **watch** needs the proposal table and its approval; **chat-run** needs a run tagged "chat" in the timeline.

# Fit against take 1624 (planning check, 2026-10-27)

`docs/demo/raw/nimbus-demo-20261027-1624.webm` (198.2 s), its `beats.json` (23 beats, all 28 target names). Rate = footage seconds ÷ scene seconds; the cut plays footage at 0.5–1.5×.

| # | Scene s | Footage (beats) | Footage s | Fit |
|---|---|---|---|---|
| 1 | 6 | `brief1-approvals` (brief + tray + orange cloud) | 5.35 | 0.89× ✓ |
| 3 | 12 | `overview` | 6.16 | 0.51×, at the floor. Plan: `overview` for b0–b3 (1.03×, the count-up), `overview-after` for b3–b6 (1.17×, spend and gauge) |
| 4 | 14 | `brief1-goal` + `plan-arrives` + `approve-plan` | 20.63 | 1.47× ✓ (the planning wait inside `brief1-goal` plays fast) |
| 5 | 20 | `brief1-timeline` + `brief1-agent-io` | 20.94 | 1.05× ✓; the `agent-io` box is clipped at the frame bottom, so its ring sits on the visible part and the camera pushes up |
| 6 | 10 | `brief1-doc` | 9.00 | 0.90× ✓ |
| 7 | 18 | `brief1-approvals` → `always-allow` | 15.89 | 0.88× ✓; Approve (Dana) lands 6.06 s in = b3 + 2 f, inside half a beat of the drop |
| 8 | 10 | `brief1-summary` | 5.10 | 0.51×, at the floor; the tiles count up slow, so the creep carries it |
| 9 | 14 | `memory-skill` | 10.66 | 0.76× ✓ |
| 10 | 12 | `brief2-plan` + `plan-arrives` + `brief2-run` | 24.93 | 2.1×, too fast. Two shots: `brief2-plan-arrives` b0–b3 (0.80×, the learned chip), the last 9 s of `brief2-run` b3–b6 (1.5×, cost and done) |
| 11 | 12 | `radar` + `status-pill` + `pill-approve` | 43.29 | Trims: `radar` from its start, 4 s at 1.0× (b0–b2); `status-pill` 6 s at 1.5× (b2–b5); the first 3 s of `pill-approve` (the click, before the /v1 wait) at 1.5× (b5–b6) |
| 12 | 4 (web part) | `chat-run` | 7.27 | 1.82×; play 6 s of it at 1.5× |
| 13 | 10 | end of `watch` + `watch-approve` | 22.71 | Start 11.3 s into `watch` (the table on screen): 15 s at 1.5× |
| X 4 | 10 | `brief1-timeline` (4 s) + `brief1-approvals` → `approve-dana` (6 s) | — | Dana lands at 0:23 if the gate part starts 3.6 s before `approve-dana` at 1.0× |

A re-take with the same flow and beat lengths within about 1 s changes none of this; the sub-beat marks place the clicks exactly.
