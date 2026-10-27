status: approved · 2026-10-27 · "Approve the board, music brief and SFX sheet: build it."
script: docs/video/script.md rev 4 (approved 2026-10-27)
captions: none
grid: 120 BPM · 30 fps · beat = 15 frames · bar = 60 frames · full cut 68 bars (4080 frames) + 2-bar audio tail · X clip 22 bars (1320 frames)

# Look

- **Palette:** Sorbet neutrals (neutral-50 paper, neutral-950 ink), mint accent `--rb-accent`, cloud blue `#18b2ff`, cloud orange `#fa7342`, lilac `#b8a4ff` (Prompt Roll pill only). Nothing else.
- **Type:** Manrope. Cards: 88 px / 700, tracking −1 %; chapter number 28 px / 600 mint; footage labels 32 px / 600.
- **Light and dark rhythm:** the hook is light (neutral-50 paper) → wash to white → the old way is dark → black → the name on black → chapter cards on neutral-950 → app footage (dark). The light opener makes frame 1 pop in a dark feed.
- **Dither:** only inside app footage (where the app already has it) and as a 3 % `dither-glow` behind chapter cards. Scenes 1–3 have none.
- **Rule:** nothing holds still for more than 2 s, except the end card (held on purpose, 3 bars).

# Scene board (full cut)

Frames are absolute in `NimbusFull`; "beat" = 15 frames.

| # | Frames | Component | Motion (in · hold · out) | What moves, moment by moment |
|---|---|---|---|---|
| 1 | 0–120 | `PromptRoll` (hand-built) | in: card pushes from 92 % to 100 % over 10 f · hold while typing · out: whip pan right 8 f to the send button, press, white wash 12 f | "Let Nimbus handle" types at 2 frames per char (f 0–34); last words become a pill (f 34–40) that rolls one option per beat (f 40, 55, 70, 85), tints mint → blue → orange → lilac with a 4 f spring; send button stroke draws in (f 92–100); pointer glides in, press with halo (f 104); arrow flies up-right (f 106–114); white wash f 108–120 |
| 2 | 120–360 | `CommentStorm` (hand-built) | in: cut from white to near-black · hold · out: fold to center 10 f, cut to black on f 360 | f 120–150 "8:00 a.m." types into a pill; f 150–330 fourteen items land from a fixed table (pills toss in with 1.15 overshoot and ±6° tilt; cards open downward and type their line), intervals tightening from 12 f to 3 f; camera pulls back 100 % → 70 % over the whole scene; shake (±6 px, 4 Hz) from f 300; fold all items to center f 340–356; black f 356 |
| 3 | 360–540 | snapcn `orb-swarm` | in on the downbeat at 360 · out: orbs shrink 8 f before 540 | Four beat groups: "Nimbus" (360) · "an always-on crew" (390) · "of NVIDIA Nemotron agents" (450) · "on Nebius Token Factory" (480); orbs burst → 8 → 16 → vortex → chain loops "Nebius Token Factory"; orb tint cloud blue with mint rim |
| 4 | 540–600 | Chapter card + snapcn `text-highlight` (marker) | in: words rise 12 px, 8 f · marker sweeps "away" f 556–574 · out: cut | "1" in mint, the line in neutral-50 |
| 5 | 600–840 | `ColumnCut` (hand-built) | cascade f 600–690 · hard cut f 690 · column f 690–840 | Four lines cascade in (one per beat), square cursor beside line 3, highlight runs across line 3 letter by letter (f 640–680) while all lines drift up 24 px; hard cut to a column of 10 app stills that jumps one per beat (beats tightening 15 → 12 → 10 f), "on a schedule" lands left (f 700), "on Nebius Serverless" lands right (f 730), whole frame pans left accelerating (f 760–840) |
| 6 | 840–1380 | `screen-recording` of take `crew` + `cursor-track` | push in 100 → 125 % over 2 bars; pan along the lanes; snap zoom 6 f onto the ✕ at its frame; pull back for ✓ | Lanes filling with Nemotron badges; label "Nemotron 3 Ultra plans. Super and Nano do the work." enters bar 2 bottom-left (no band, a soft card over a dimmed corner, 3 s); "Something failed. It tried again." on the ✕ |
| 7 | 1380–1440 | Chapter card + `text-highlight` (underline "your OK") | as 4 | — |
| 8 | 1440–1680 | `screen-recording` take `plan` + `cursor-track` | push in on the Tools chip; pan down the plan list; follow the dragged step | Goal types; Tools chip opens; plan list; step dragged up; Approve plan pressed (cursor halo) |
| 9 | 1680–2040 | `screen-recording` take `gate` | hold with motion inside (the orange cloud and the card sliding in); snap zoom on the payload; pull back on approve; then a card with `text-highlight` color sweep on "anything" (f 1950–2040) | Cloud turns orange (f 1690); card slides in; cursor to Approve & always allow (f 1890, the Drop 2 downbeat); rule line appears |
| 10 | 2040–2220 | Card + `text-highlight` (strikethrough "their servers", marker "your database") | strike draws f 2060–2075; marker f 2090–2110 | Words on neutral-950 |
| 11 | 2220–2280 | Chapter card + `text-highlight` (shimmer "already talk") | as 4 | — |
| 12 | 2280–2760 | `AgentChat` (hand-built) | camera pushes in on the compose field; pulls back as replies stream | Three exchanges on one clock derived from a typing rate of 2 f per char: "what needs me?" → reply; "run morning brief" → plan line → "1 needs your OK: send 3 replies?"; "approve" → "Sent ✓". Replies stream word by word; each word grey for 6 f before it sets. Text taken verbatim from a real `/v1` transcript saved at `docs/video/chat-transcript.json` |
| 13 | 2760–2880 | `screen-recording` take `chat-run` (or the phone take if recorded) | slide in from right 8 f; hold with motion inside | The run tagged "chat" lighting up in the timeline |
| 14 | 2880–3000 | `terminal-simulator` (Hermes CLI) or extend 12 | types the prompt, prints the answer | Cut if Phase D not done |
| 15 | 3000–3060 | Chapter card + `text-highlight` (color fill "every run") | as 4 | — |
| 16 | 3060–3300 | `screen-recording` take `memory` | push in on "Next run uses 5 memories · 1 rule"; pan down the memories; hover Forget | Counts, cards, a memory row highlighting |
| 17 | 3300–3600 | `screen-recording` take `run-two` → card with `text-highlight` marker on the new cost | follow the learned badge; card at f 3480 | Learned badge pops; no approval card; the cost line |
| 18 | 3600–3900 | `count-grid` (adapted) | three tiles rush in one per beat; numbers count up over 1 bar each | Model ids on the tiles; "Nebius Token Factory" under them |
| 19 | 3900–4080 | `wordmark-cut` → end card | wordmark cools and cuts closer (f 3900–3960); end card held f 3960–4080 | URL and `pnpm dev` |

# X clip board

Same scene components, re-timed; frames absolute in `NimbusX` (1320 frames).

| # | Frames | From | Changes |
|---|---|---|---|
| 1 | 0–120 | 1 | Two roll steps (morning brief → failing tests) |
| 2 | 120–300 | 2 | Eight items instead of fourteen; same fold |
| 3 | 300–420 | 3 | Two beat groups ("Nimbus" · "NVIDIA Nemotron agents") |
| 4 | 420–660 | 9 | Starts at the orange; ends after the rule line |
| 5 | 660–900 | 12 | Only "run morning brief" … "approve" → "Sent ✓" |
| 6 | 900–1080 | 17 | Learned badge + the highlighted line |
| 7 | 1080–1320 | 19 | End card held 3 bars |

# Footage needed (one take, recorded in a freeze)

Takes `crew`, `plan`, `gate`, `chat-run`, `memory`, `run-two` = the beats of
`pnpm demo:video` (beat keys in `docs/demo/raw/beats.json`). Re-record after
the builder's fixture fix so no invented facts are on screen. The phone take
(scene 13) only after CHAT-APPS Phase C.

# Hand-built scenes: files and props

| File | Props |
|---|---|
| `video/src/scenes/PromptRoll.tsx` | `lead: string`, `options: {text, tint}[]`, `charFrames = 2` |
| `video/src/scenes/CommentStorm.tsx` | `opener: string`, `items: {kind: "pill" \| "card", text, x, y, tilt, at}[]` (fixed table) |
| `video/src/scenes/ColumnCut.tsx` | `lines: string[4]`, `highlightLine = 2`, `stills: string[]`, `left`, `right` |
| `video/src/scenes/AgentChat.tsx` | `transcript: {role, text}[]`, `charFrames = 2`, `greyFrames = 6` |
