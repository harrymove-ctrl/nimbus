# The demo video: a produced piece, not a screen capture

Written 2026-10-27 night by Fable; built by a separate Opus session in `video/`.
Constraints from the hackathon: public YouTube, 3:00 or shorter, must show
Nebius Token Factory and NVIDIA Nemotron in use. Ours: 1920 × 1080, 30 fps,
zero spend (footage comes from replayed runs), Manrope and the Sorbet palette,
no music under the voice.

## Two inputs, one Remotion composition

1. **Raw footage**: `docs/demo/raw/*.webm` from `pnpm demo:video` (Playwright,
   1920 × 1080, the v3 beats), plus `docs/demo/raw/beats.json` written by the
   same script: `[{ "beat": "overview", "tStart": 12.4, "tEnd": 18.9 }, …]`
   so the composition can cut by beat without hand-timing. On the final day
   the footage is re-captured from the recorded real run (`NIMBUS_REPLAY`)
   and the composition is re-rendered unchanged.
2. **Scenes**: snapcn components (MIT, `npx shadcn@latest add @snapcn/<name>`,
   source copied into `video/components/snap-cn/`, ours to edit) inside a
   Remotion project (`npx create-video@latest`, blank template) in `video/`.

Composition `NimbusDemo`: 1920 × 1080, 30 fps, ≈ 2:55. Render:
`npx remotion render NimbusDemo out/nimbus-demo-v3.mp4 --codec h264 --crf 17`.
Also render three stills (Overview, the PR gate, the run summary) at 1920 ×
1080 for the Devpost gallery.

## Scene list

| # | Time | Component | Content | Voice |
|---|---|---|---|---|
| 1 | 0:00–0:08 | `orb-swarm` | Sentence in four beats: "A glowing cloud" · "runs your standing work" · "with a crew of Nemotron agents" · "and asks before it acts." | — (text carries it) |
| 2 | 0:08–0:14 | `announce-title` | Eyebrow "Nebius × NVIDIA Global AI Hackathon · Personal AI"; name "Nimbus"; tagline "Nemotron 3 on Token Factory" | "This is Nimbus." |
| 3 | 0:14–0:30 | `screen-recording` + `word-captions` | Boot cloud (2 s), then the Overview: camera pushes into the stat cards, pans along the spend chart, settles on the gauge and the impact row | "Every morning it shows what the crew did, what it cost, and what needs you." |
| 4 | 0:30–0:36 | `type-morph` + `dot-bloom` | "Its first job is itself." morphs into "Ship Nimbus" | — |
| 5 | 0:36–1:05 | `screen-recording` + `cursor-track` | Plan draft: reorder a step, add one, Approve plan; lanes fill; camera zooms on the Analyst lane as the first run_code fails ✕ and retries; Agent I/O shows the real `pnpm eval` output and the model id `nvidia/nemotron-3-super-120b-a12b`; route badges | "The crew runs the evals on its own repository. Nemotron 3 Ultra plans; Super and Nano do the work. The Analyst fails once, retries, and finds the line. Two hops were routed below their ceiling by the cost router." |
| 6 | 1:05–1:12 | `text-reveal` | "Nothing leaves the sandbox without you." | — |
| 7 | 1:12–1:35 | `screen-recording` | Question chip (Router); the patch as a code artifact; cloud orange; the PR gate card with the PR body; Approve & always allow; the policy line | "It asks where to fix it. Opening a pull request is an action, so it waits. Approve and always allow writes one rule into the workstream's skill file." |
| 8 | 1:35–1:50 | `screen-recording` + `agent-steps` | Run summary tiles count up; Memory & skill tab: the rule, the skill cards, five memories | "After the run a Learner writes memories and rewrites the skill. You can read what it learned, revoke a rule, forget a memory." |
| 9 | 1:50–2:05 | `screen-recording` | Overview with Morning brief running in the background: the status pill, the panel, Approve inline | "It is always on. Scheduled runs show up as a pill; you approve the one thing that sends without leaving the screen." |
| 10 | 2:05–2:18 | `screen-recording` + `status-cycle` | Ship Nimbus run two: learned chip, no approval card, lower cost (real models on the final day) | "Run two knows what run one learned, opens the PR under the rule, and costs less." |
| 11 | 2:18–2:32 | `terminal-simulator` | Typed: `curl https://<nebius-endpoint>/v1/chat/completions -d '{"model":"nimbus/ship-nimbus", …}'` and the OpenClaw provider JSON beside it; cut to the run appearing with trigger "chat" | "It speaks OpenAI's API, so OpenClaw or Hermes bring it into your chat apps. Hosted on a Nebius Serverless Endpoint; nightly runs as Serverless Jobs." |
| 12 | 2:32–2:46 | `count-grid` (adapted) | Three tiles: Ultra · Super · Nano with their Token Factory ids; counters: "−45 % vs baseline", "19/19 goldens", "$0.08 per run" | "Three Nemotron tiers, routed by role and cost, graded hop by hop." |
| 13 | 2:46–2:55 | `wordmark-cut` | "NIMBUS" cools to ink and cuts closer; end card: github.com/harrymove-ctrl/nimbus · MIT · built on Nebius Token Factory | "Open source. Nimbus." |

Catalogue scenes "Trend Type" and "Prompt Roll" are not in the free set;
`type-morph` and `announce-title` take their places.

## Rules for the edit

- Every screen-recording shot has a camera move (push, pan or hold with a
  cursor), never a static full-frame paste; keyframes in `screen-recording`.
- Captions are the voice line, two lines max, `word-captions` timed to a
  transcript JSON in `video/captions/`.
- Cuts land on run events: a lane starting, a card arriving, a tick.
- Dither texture only inside the app footage; scenes use the Sorbet neutrals
  and the mint accent; the cloud blue and orange are the only other colors.
- Reduced-motion is irrelevant for a rendered video; keep motion continuous.
- Under 3:00 with 5 s of safety. Check with `remotion compositions`.

## Voice

Record the voice lines above as one take per scene (`video/voice/<n>.wav`);
if no recording is available by the final day, render with captions only and
a low dither-ambience bed; no synthetic voice.

## Hand-off between sessions

- The builder (Sonnet) owns `scripts/record-demo.ts`; it adds the
  `beats.json` output and keeps the v3 beats.
- The video session (Opus) owns `video/`, `docs/demo/raw/` and this file. It
  never edits `src/`.
- The planner records takes from the user's terminal during a frozen window
  and places them under `docs/demo/raw/`.

## Build notes (video session, 2026-10-27)

Built in `video/` (see `video/README.md` for install, studio and render).
Render: `video/out/nimbus-demo-v3.mp4`, 5250 frames, 2:55.00 at 30 fps.
Stills: `docs/demo/stills/{overview,pr-gate,run-summary}.png`.

**Scene substitutions.** All thirteen snapcn names resolved; none swapped.
Adaptations:

- `count-grid` (scene 12) is installed but drawn as `TierGrid` in
  `video/src/Panels.tsx`: its rush under a horizontal smear and settle, on
  three tier tiles, then counters that count up. The stock component wants a
  grid of images and a "5 → 500" label, which do not fit three tiers.
- `cursor-track` runs ring-only (transparent pointer, mint click ring): the
  take already draws its own cursor, and two pointers is worse than one.
- Scene 8 opens with `agent-steps` (4 s, the Learner's log) before 11 s of
  footage; scene 10 opens with `status-cycle` (5 s, "Run two" + learned / no
  approval card / −42 % cost) before 8 s of footage.
- Scene 11: `terminal-simulator` (8.5 s), then a drawn OpenClaw provider card
  with "Ship Nimbus · trigger: chat" (5.5 s) in place of footage of a
  chat-triggered run, which no take has yet.

**Footage cuts** (`video/src/beats.ts`, hand-timed on the 1920 × 1080 v3 take
of 19:29, 170 s, which was recorded before the script wrote `beats.json`):
boot 0–2, overview 2.5–16.5, plan 17–32, lanes and Loop view 32–46, question
to PR approval 63–86, summary and Memory & skill 89–102 (1.18×), status pill
113–126 (0.87×), run two 155–164 (1.13×). With `docs/demo/raw/beats.json`
present the shots cut from these beats instead: `boot`, `overview`,
`ship1-goal`→`ship1-plan-draft`, `ship1-checklist`→`ship1-loop-view`,
`ship1-question` (+2 s)→`ship1-pr-approval`, `ship1-summary`→`memory-skill`,
`status-pill`, `ship2-learned`→`ship2-summary`. The camera keyframes are in
scene frames and were placed on this take; re-check them in the studio after a
re-capture whose pacing differs.

**Still placeholder.**

- Voice: no recording. Captions (`video/captions/*.json`) are the voice lines
  paced at 2.6 words/s; swap in Whisper word timings when `video/voice/<n>.wav`
  exists. No ambience bed is mixed in yet.
- Final-day footage: everything is the mock-mode take; re-capture from
  `NIMBUS_REPLAY` and re-render unchanged.
- Scene 11: `$NIMBUS` stands in for the real endpoint URL in the typed curl.
- Scene 12 numbers (−45 %, 19/19 goldens, $0.08 per run) are this plan's,
  matched to the mock run summary; check them against the real run.

**For the next take.** The Next.js dev "N issues" badge shows bottom-left in
the raw take (every camera pose in this edit keeps it out of frame, but a pull-back to
zoom 1 would show it); and the first seconds of `ship1-goal` show the previous
run's "Rejected by system · Run stopped" card above the composer.
