status: approved · 2026-10-27 · "Approve script rev 4 as written."
revision: rev 4 · rev 3's four chapters, now with signature motion scenes; paid snapcn scenes rebuilt by hand
track: Personal AI
cuts: full (2:16, 1920 × 1080) · X clip (0:44, cut from full)
grid: 120 BPM · 1 bar = 2.0 s = 60 frames at 30 fps
captions / transcript: none (user, 2026-10-27, repeated in rev 4 feedback)
on-screen words (full cut, cards only): 104 · plus the chat bubbles in scene 12
remember this: Nimbus is an always-on AI crew you talk to from your chat app: it works while you're away, asks before it acts, and learns from every run.

No voice. `[real: …]` = filled from the final-day real-model run.

## Signature scenes (how each is made)

| Scene style | Made with | Used in |
|---|---|---|
| **Prompt Roll** — a prompt card pushes in while "Let Nimbus handle …" types; the last words wrap into a pill that rolls through jobs, each in its own tint; the camera whips to a send button that draws itself in; a pointer presses it into a halo; the arrow flies off as the frame washes white | Hand-built (`video/src/scenes/PromptRoll.tsx`), original code inspired by the description | 1 |
| **Comment Storm** — one line types into a pill, then the morning pile lands: pills tossed in with overshoot and tilt, cards opening downward and typing their own lines, faster and faster while the camera pulls back, shakes, and folds the pile into its center → cut to black | Hand-built (`CommentStorm.tsx`) | 2 |
| **Orb Swarm** — the sentence told one beat at a time while glass orbs burst out, split into 8 and 16, wind into a vortex, chain, and loop around the last words | snapcn `orb-swarm` (installs free), tinted cloud blue and mint | 3 |
| **Text Highlight** — animated emphasis on one span: marker, color, underline, strikethrough, shimmer | snapcn `text-highlight` (installs free) | chapter cards 4, 7, 11, 15 and 9, 10, 17 |
| **Column Cut** — a four-line cascade with a square cursor by line 3, a highlight running across that line letter by letter as the type drifts up; hard cut to a column of pictures jumping one per beat, beats tightening, a sentence landing either side, the frame panning away left | Hand-built (`ColumnCut.tsx`) | 5 |
| **Agent Chat** — the prompt types into a compose field as the camera pushes in, the field scrolls under a soft left edge, the message becomes a bubble, an avatar and typing dots arrive, the reply streams a word at a time, each word grey for a moment before it sets | Hand-built (`AgentChat.tsx`); the bubbles replay real replies from Nimbus's `/v1` endpoint, word for word | 12 |
| Footage with a camera | snapcn `screen-recording` + `cursor-track` | 6, 8, 9, 13, 16, 17 |

The four hand-built scenes are our own implementations of the behaviors
described, written from scratch; no paid snapcn source is used.

# Full cut

| # | Time | Bars | Chapter | Picture | On-screen words | Sound |
|---|---|---|---|---|---|---|
| 1 | 0:00–0:04 | 2 | Hook | **Prompt Roll.** "Let Nimbus handle" types; the pill rolls: *your morning brief* (mint) → *the hackathon radar* (blue) → *failing tests* (orange) → *your Token Factory bill* (lilac); send button draws in, pointer presses it, arrow flies, wash to white | Let Nimbus handle [your morning brief → the hackathon radar → failing tests → your Token Factory bill] | Key ticks · a soft tick per roll step · "send" swoosh into the white |
| 2 | 0:04–0:12 | 4 | The old way | **Comment Storm.** One pill types "8:00 a.m." then the pile lands: "PR #31 failed" · "reply to Dana?" · "Devpost: 2 days left" · "Token Factory: $3.20 today" · "who else is building this?" · "standup in 5" · "check the release notes" … faster, camera pulls back, shakes, folds into the center | 8:00 a.m. (the pile is the words) | Notification pops accelerating · low rumble with the shake · hard cut to silence |
| 3 | 0:12–0:18 | 3 | Name | **Orb Swarm.** Black → orbs burst from the words | Nimbus / an always-on crew / of NVIDIA Nemotron agents / on Nebius Token Factory | Riser under the orbs · impact as they loop the last words |
| 4 | 0:18–0:20 | 1 | Card 1 | Text Highlight: marker sweeps "away" | 1 · It works while you're **away** | Whoosh |
| 5 | 0:20–0:28 | 4 | 1 | **Column Cut.** Cascade: "Morning brief · 08:00 / Hackathon radar · 09:00 / Repo checks · nightly / Token Factory watch · 07:00", highlight runs across line 3; hard cut to a column of stills (Overview, timeline, doc, memory, pill…) jumping one per beat; "on a schedule" lands left, "on Nebius Serverless" lands right; pan left | On a schedule · on Nebius Serverless | Build starts · a tick per jump, tightening |
| 6 | 0:28–0:46 | 9 | 1 | Footage: the crew's timeline fills, one row per agent with its Nemotron badge; snap zoom on a red ✕; it retries; ✓; cost ticking in cents | Nemotron 3 Ultra plans. Super and Nano do the work. / Something failed. It tried again. | Drop: full beat · glitch on ✕ · chime on ✓ |
| 7 | 0:46–0:48 | 1 | Card 2 | Text Highlight: underline draws under "your OK" | 2 · Your tasks, your tools, **your OK** | Whoosh |
| 8 | 0:48–0:56 | 4 | 2 | Footage: goal typed; Tools chip; the plan as a numbered list; a step moved; Approve plan | You pick its tools. It shows its plan first. | Click · swish · ticks |
| 9 | 0:56–1:08 | 6 | 2 | Footage: cloud turns orange; the card shows exactly what will be sent; Approve & always allow; one rule line appears. Card after it, Text Highlight color sweep on "anything" | Before it sends **anything**, it asks. | Breakdown under the orange · Drop 2 on the click |
| 10 | 1:08–1:14 | 3 | 2 | Card: Text Highlight strikethrough on "their servers", marker on "your database" | Your data: ~~their servers~~ **your database**. Your keys. Your spend cap. | Calm pad · marker squeak |
| 11 | 1:14–1:16 | 1 | Card 3 | Text Highlight shimmer on "already talk" | 3 · Talk to it where you **already talk** | Message pop |
| 12 | 1:16–1:32 | 8 | 3 | **Agent Chat.** Three exchanges, real `/v1` replies: "what needs me?" → the answer; "run morning brief" → plan, then "1 needs your OK: send 3 replies?"; "approve" → "Sent ✓" | (the chat is the words) | Key ticks · send swoosh · typing dots · soft pop per streamed line · chime on "Sent ✓" |
| 13 | 1:32–1:36 | 2 | 3 | Footage: the same run in the web timeline, tagged "chat"; if Phase C is recorded, the real phone instead | Same crew. Through OpenClaw. | Whoosh |
| 14 | 1:36–1:40 | 2 | 3 | Footage: Hermes CLI, "what needs me?" → same answer (cut if Phase D not done; scene 12 takes the bars) | Hermes works too. | Key clicks |
| 15 | 1:40–1:42 | 1 | Card 4 | Text Highlight: color fill on "every run" | 4 · It learns from **every run** | Whoosh |
| 16 | 1:42–1:50 | 4 | 4 | Footage: Memory tab, "Next run uses 5 memories · 1 rule"; hover Forget | It writes down what it learned. You can delete it. | Ticks · page sound |
| 17 | 1:50–2:00 | 5 | 4 | Footage: the next day, "learned" badge, no approval; then a card with Text Highlight marker on the new number | The next day: [real: $0.08] → **[real: $0.05]** per run | Final lift · impact on the number |
| 18 | 2:00–2:10 | 5 | Proof | Three tiles with Token Factory model ids; two numbers count up | Nemotron 3 Ultra · Super · Nano / [real: −45 %] cost vs the top model on every step / [real: 19/19] checks pass | Sub hit per tile · riser |
| 19 | 2:10–2:16 | 3 | End | Wordmark; end card held still | github.com/harrymove-ctrl/nimbus · pnpm dev | 1 beat silence → final chord |

# X clip (from the full cut, 0:44)

| # | Time | Bars | From full # | Picture | Words | Sound |
|---|---|---|---|---|---|---|
| 1 | 0:00–0:04 | 2 | 1 | Prompt Roll (two roll steps) | Let Nimbus handle [your morning brief → failing tests] | Ticks · send swoosh |
| 2 | 0:04–0:10 | 3 | 2 | Comment Storm, shorter | 8:00 a.m. | Pops → cut to silence |
| 3 | 0:10–0:14 | 2 | 3 | Orb Swarm, two beats | Nimbus / NVIDIA Nemotron agents | Impact |
| 4 | 0:14–0:22 | 4 | 9 | Cloud orange, approve | Before it sends **anything**, it asks. | Half-time → hit |
| 5 | 0:22–0:30 | 4 | 12 | Agent Chat: "run morning brief" … "approve" → "Sent ✓" | (the chat) | Pops · chime |
| 6 | 0:30–0:36 | 3 | 17 | The next day, learned badge, cheaper | It learns from **every run**. | Lift |
| 7 | 0:36–0:44 | 4 | 19 | End card held | github.com/harrymove-ctrl/nimbus | Final chord |

# Honesty notes

- Comment Storm lines are a generic morning, not claims about anyone.
- Agent Chat bubbles replay real `/v1` output. The radar's mock fixture
  currently invents facts about real things (Devpost submission counts, a
  named competitor); those fixtures are rewritten to neutral content before
  any filming, and the final take uses real-model answers.
- Not claimed: NemoClaw, OpenShell.
