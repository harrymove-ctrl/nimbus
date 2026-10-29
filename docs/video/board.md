status: approved · 2026-10-29 · "Cut them, real scatter" · rev F (for script rev 7; rev E approved 2026-10-28, "Approve rev 6")
script: docs/video/script.md rev 7 (approved). Rev F cuts scenes 15 and 18 (the mock take 1258) and plots real calls in scene 19; the other rows are rev E's with their frames moved
captions: none. Words live in callouts, the opening sentence, the chapter cards and the end card.
grid: 120 BPM · 30 fps · beat = 15 f · bar = 60 f · full cut 80 bars (4800 f, 2:40) + 1-bar audio tail · X clip 22 bars (1320 f, 0:44)
supersedes: rev C/D (in git history: f54a32a, 6d4cffd). The rev C callout component and chapter chip are kept as built.

# Look · rev E (the app's look, nothing invented)

1. **Every colour is generated from the app's CSS.** `video/scripts/gen-palette.mjs` reads `src/app/globals.css` (the Sorbet tokens: `--color-neutral-50…950`, `--rb-accent`, `--rb-accent-fg`, `--rb-radius`) and `src/lib/run-view.ts` (`ROLE_COLOR`) and writes `video/src/palette.ts`. The file is generated, not edited: a colour that is not in the app cannot exist in the video. The only two values added by hand are the boot sky (`src/components/nimbus/boot.tsx:15`) and the cloud's blue/orange (`glow-cloud.tsx`), each with its source line.
2. **Surfaces.** Motion scenes sit on neutral-950 with the app's own dither texture (the dithercn field the Overview uses: `--dither-cell: 3px`, ink neutral-300 at 3 %). No colour fields, no blurred blobs, no glows under type. The Focus Pull scene is dropped for this reason.
3. **Type.** Manrope only: 700 for the hook and chapter lines, 600 for callout line 1 and tiles, 500 for callout line 2. Chapter lines 96 px, callout 34/28 px, tiles 40 px.
4. **Accent discipline.** Mint for the one emphasised span, the rings and the Approve tick. Role colours (checker blue, researcher purple, analyst amber, writer teal) only on things that belong to that role: the wordmark cards, lane badges, callout dots. Orange only on the cloud when it needs you. Blue only on the cloud and the boot sky.
5. **Footage camera.** Every app shot rides a tilted 3D camera like the user's reference still: perspective 1200 px, yaw 8–14°, pitch 2–4°, a slow drift of 3 % per bar, the far edge softened by 1.5 px of blur. The tilt relaxes to flat (over 1 bar) whenever a callout is open, so the ring sits square on its target; it returns when the callout closes. Lane names stay in frame on the timeline.
6. **Framing.** Footage fills ≥ 85 % of the frame; UI text a callout points at is ≥ 28 px at 1080p.
7. **No mock tag, no watermark.** Nothing is written on the frame that is not part of the story: no "preview" text, no corner labels (the user: "dont have text for full video i dont want watermark"). A preview is told apart by its filename and by `docs/video/QA.md`, which states which take and which numbers it carries. The final renders after the real take.
8. **Masters at 4K and 1080p.** The compositions stay 1920 × 1080; the 4K master is `npx remotion render … --scale=2` (3840 × 2160, crf 17). Motion scenes are vector and render sharp at 4K; footage is true 4K only when the take was recorded at device scale 2 (see "From the take"), otherwise it is upscaled 2×.

# Components

| Scene | Component | Source | Build note |
|---|---|---|---|
| 1 Hook | `orb-swarm` | free, installed | Four lines on the four bars; orbs in cloud blue (the glass look stays); the last line's loop ends on the downbeat of bar 4 |
| 2 Name | `block-wordmark` + `CloudMark` | free; ours | Cards in the four role colours; blocks flash the role colours then swap to Manrope 700 letterforms; the CloudMark slides in from the left as the last letter settles, blinks once |
| 3 Overview | `laptop-frame` → `Footage` | free, installed; ours | Notch notification text "Morning brief · ran 08:00"; the dive ends with the Overview footage exactly filling the frame (no scale jump) |
| 4 Ch 1 | `word-gather` | free | First word "You" holds alone; the rest drop in mint and settle to neutral-100 |
| 5 Goal → plan | `Footage` + `cursor-track` + `button-press` | ours; free, installed; free | The tick is drawn over the real Approve plan button in its real box (from `beats.json` targets) |
| 6 Timeline | `Footage` | ours | Pan along the lanes 2 bars, hold with motion inside, push on the badge; callouts per the script |
| 7 Brief | `Footage` | ours | Scroll inside the doc; the ring on "Needs you today" opens the scene |
| 8 Ch 2 | `text-highlight` (marker) + `CloudMark` | free, installed; ours | Marker in mint across "without you"; the cloud at the end of the line goes orange on beat 4 |
| 9 Approvals | `Footage` + `button-press` | ours; free | Three ticks on three real buttons; the first is the drop |
| 10 Summary | `MetricMorph` → `Footage` | ours | The pill is the real "Approve & always allow" box from the take; bars = the run's real hops |
| 11 Ch 3 | `check-cycle` | free | Five words through the slot, one per 3 beats; rests at 80 % on the last downbeat |
| 12 Memory | `Footage` | ours | — |
| 13 Run two | `Footage` | ours | The learned chip ring opens the scene |
| 14 Ch 4 | `OrbitFlow` | ours (built, rev D) | Dark; the three stops are pills with role half-dots; the wind-up whips into the phone stack (scene 16); the third stop reads "ONE HISTORY" |
| 16 Chat | `phone-stack` | free | Each phone screen is a rendered frame of the chat (our PhoneChat) at the message that lands; six phones, one per 2 beats, the last two hold |
| 17 Web run | `Footage` | ours | Hard cut |
| 19 Proof | `ScatterBloom` + `count-grid` | ours; free, installed | Points from the 198 real Token Factory calls (six real-take databases); tiles land per beat on the plane |
| 20 Run it | `terminal-simulator` | free, installed | Cursor-pinned zoom on the URL for the last bar |
| 21 End | `Lockup` | ours (built, rev D) | The reprise; held still (the one allowed hold) |

Not used, and why: Focus Pull (colour field), Screen Wall (Phone Stack says the same thing more clearly), Comment Storm, Library Flight, Reel Wall, Render Wall, Picker Commit, Build Out, Brief Send, App Reveal, Say It, Trend Type, Ember Reveal (they show another product's interface or a light paper look).

Installs: `npx shadcn@latest add @snapcn/block-wordmark @snapcn/word-gather @snapcn/check-cycle @snapcn/button-press @snapcn/phone-stack` (all in the free catalogue, MIT).

# Scene board (full cut)

Frames are absolute in `NimbusFull`. Callout `in → out` in scene bars. Targets are `beats.json` names.

| # | Frames | Bars | Footage beat | Camera | Callouts (target · what · why · side · bars) | Sound |
|---|---|---|---|---|---|---|
| 1 | 0–240 | 4 | — | — | — | music intro; orb burst (designed, soft) per line |
| 2 | 240–360 | 2 | — | — | — | riser 1 bar → impact-soft on 360; block flashes: 6 ticks (designed) |
| 3 | 360–720 | 6 | `overview` | laptop dive b0–b1, then tilt 10° drifting | `workstreams` · "Workstreams" · "Chores that run on a schedule" · right · b1 → b3. `spend-chart` · "Every call priced" · "On Nebius Token Factory" · right · b3 → b5. `router-gauge` · "Cost router" · "The cheapest Nemotron that can do the step" · left · b4 → b6 | lid open (designed), notification (cuelume attention), count on the cards |
| 4 | 720–780 | 1 | — | — | — | word drops (designed, 5 soft) |
| 5 | 780–1140 | 6 | `brief1-goal` → `brief1-plan-draft` | composer 2.2 flat while typing, tilt returns on the plan | `plan` · "The plan" · "Who does what, before anything runs" · right · b2 → b4. `estimate` · "$[real]" · "You see the cost first" · below · b3 → b5. `tools` · "Allowed tools" · "It can't use anything else" · above · b4 → b6 | type; tap; ready; select; button-press tick |
| 6 | 1140–1740 | 10 | `brief1-checklist` + `brief1-agent-io` | tilt 12°, pan along lanes b0–b3 | `lanes` · "One row per agent" · "They work at the same time" · right · b1 → b3. `model-badge` · "Model per step" · "Ultra plans, Super reads and writes" · below · b3 → b5. `run-cost` · "Live cost" · "Stops at your budget" · below · b5 → b7. `agent-io` · "What it read" · "Every step is open to check" · left · b8 → b10 | loading; select |
| 7 | 1740–2100 | 6 | `brief1-doc` | flat, scroll | `brief-doc` · "Your morning, already read" · "Inbox, calendar, GitHub → one page" · right · b0 → b2. `needs-you` · "Ranked by who waits" · "And by when" · right · b2 → b4. `can-wait` · "Noise moved aside" · "No draft for it" · right · b4 → b6 | ready |
| 8 | 2100–2160 | 1 | — | — | — | marker (designed); attention (cuelume) on beat 4 as the cloud turns orange |
| 9 | 2160–2700 | 9 | `brief1-approvals` + `approve-1` `approve-2` `always-allow` | tilt 8° b0–b2, flat on the card | `approval-card` · "Sending is an action" · "So it waits for you" · right · b0 → b2. `approve-buttons` · "Approve, reject with a note" · "Or allow from now on" · above · b3 → b6. `rule-line` · "One rule saved" · "You can revoke it anytime" · above · b7 → b9 | **drop 2 on 2280** with success + sub hit; success on the second; success strong on always-allow |
| 10 | 2700–3000 | 5 | `brief1-summary` | morph 1 bar, then 2.0 push on the tiles | `summary-cost` · "The whole morning" · "$[real]" · above · b1 → b3. `vs-baseline` · "Router savings" · "Versus always using the biggest model" · above · b3 → b5 | morph-suck → morph-slam; count |
| 11 | 3000–3060 | 1 | — | — | — | slot roll ×4 (designed, soft); tick (cuelume success subtle) |
| 12 | 3060–3420 | 6 | `memory-skill` | tilt 10° | `memories` · "Memories" · "What it learned from your morning" · left · b0 → b2. `skill-file` · "Its own how-to" · "Rewritten after each run" · left · b2 → b4. `forget` · "Forget or revoke" · "You stay in charge" · left · b4 → b6 | select; open |
| 13 | 3420–3720 | 5 | `brief2-learned` → `brief2-summary` | tilt 10° | `learned-chip` · "Uses what it learned" · "No repeat questions" · right · b0 → b2. `run2-cost` · "Run two: $[real]" · "Cheaper and faster" · below · b3 → b5 | ready; success |
| 14 | 3720–3780 | 1 | — | — | — | orbit swell → suck |
| 16 | 3780–4020 | 4 | — (phone stack) | — | `phone` · "Same crew in your chat app" · "Via OpenClaw or Hermes" · left · b1 → b4 | tap per sent message; success strong on "Approved" |
| 17 | 4020–4140 | 2 | `chat-run` | flat | `chat-run` · "Same run, same approvals" · "One history" · right · b0 → b2 | hard cut (designed, dry) |
| 19 | 4140–4320 | 3 | — (scatter) | plane drift | — (tiles are the text) | bloom-sparkle; sub hit per tile |
| 20 | 4320–4500 | 3 | — (terminal) | pinned zoom b2 | — | type (cuelume, ≤ 1 per 3 f); ready on the URL line |
| 21 | 4500–4800 | 5 | — (lockup) | still | — | silence 4485–4500; impact-deep 4500; the outro chord rings into the tail |

# X clip board (22 bars, 1320 f)

| # | Frames | From | What changes |
|---|---|---|---|
| 1 | 0–120 | 1 | Orb sentence, two lines per bar |
| 2 | 120–240 | 2 | Block Wordmark |
| 3 | 240–420 | 5 | Goal → plan → Approve plan; `estimate` callout b0 → b2 |
| 4 | 420–720 | 6 + 8 + 9 | Lanes 2 bars (`lanes`), the Ch 2 line 1 bar, the gate: **Approve at 690** (the drop), `approval-card` callout b3 → b5 |
| 5 | 720–900 | 13 | Run two, `learned-chip` |
| 6 | 900–1140 | 16 | Phone Stack: three phones |
| 7 | 1140–1320 | 20 + 21 | Terminal 1 bar, lockup 2 bars |

# From the take

Record at device scale 2 when the machine allows (Playwright viewport 1920 × 1080, `deviceScaleFactor: 2`, `recordVideo` 3840 × 2160): targets in `beats.json` stay in CSS pixels, so the edit maps them with the same transform and multiplies by 2 for the 4K master.

Sub-beats to mark: `brief1-plan-arrives`, `brief1-approve-plan`, `brief1-agent-io`, `approve-1`, `approve-2`, `always-allow`, `brief2-plan-arrives`, `pill-approve`, `watch-approve`. Targets as in rev C plus `approve-buttons` boxes per approval. Fit rule unchanged: footage plays at 0.5–1.5×, slid so each click lands on its frame; the first Approve must land on 2280 (full) and 690 (X).
