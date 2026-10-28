# Checklist for a Nimbus video

Written from the user's review of the rev 5 / rev D cuts (2026-10-28). Tick
every line, out loud, at the gate named in its heading. A line you cannot
tick is reported by name, never skipped. Their words are quoted where a rule
came from a complaint, so the reason survives.

## A · Before planning (the planner, before Gate 1)

- [ ] Read every skill in `.claude/skills/` (today: `nimbus-video`,
      `interface-bts`) and `docs/PLAN.md`, `docs/SUBMISSION.md`.
      "Pls read all skill i prepare for u."
- [ ] Read the session history of every earlier cut and list what the user
      liked and rejected, by cut name. "read all history to me"
- [ ] Watch the last cut the user liked (`nimbus-demo-v3.mp4`) frame by
      frame and name what made it work (its opening sentence, the pace).
      "why u dont copy nimbus-demo-v3.mp4 version"
- [ ] Read the app's real look from the code: `src/app/globals.css` (Sorbet
      tokens, mint accent, dither), `src/lib/run-view.ts` (role colours),
      `src/components/nimbus/boot.tsx` (boot sky), `glow-cloud.tsx`.
- [ ] Check the hackathon rules for the video: length ("3-minute or
      shorter"), what it must show ("how you used Nebius Token Factory and
      NVIDIA Nemotron"), where it is hosted (public YouTube).
- [ ] Fetch the free snapcn catalogue (`https://snapcn.dev/llms.txt`) and
      mark each effect the user named as **free** (install) or **paid**
      (build our own from the description; never copy paid source).

## B · Story (Gate 1, the script)

- [ ] The opening is the one the user liked: a sentence told in beats
      (orb-swarm), then the name. Not a dense app screen. "demo app intro
      not good"
- [ ] The story is addressed to **you**; no character names in any word we
      write; people in the footage are roles. "Dont ask like Dana story …
      it could be neutral and for user"
- [ ] The hero flow is a chore every viewer has (the morning brief), and
      every screen part shown gets a callout: what it is, why it helps you.
      "we dont understand what it is"
- [ ] Each chapter opens with a one-bar card that states its idea in plain
      words, then the footage proves it. "not understanding at all"
- [ ] No sentence captions; no transcript.
- [ ] Length ≤ 3:00 for the submission master (2:56 planned); the X clip
      40–46 s; both on the 120 BPM grid, whole bars.
- [ ] The video shows, on screen: the three Nemotron model ids with their
      jobs, the words "Nebius Token Factory", the endpoint, and a real cost.
- [ ] **No "mock" tag anywhere in the final.** The real-model run is
      scheduled before the final render; every number is `$[real]` until
      then. "not write mock in video"
- [ ] It ends on the action: repo URL and `pnpm dev`, held ≥ 3 s.
- [ ] A designed motion scene at every turn (title, each chapter, summary,
      chat, proof, end), not only at the title and the end. "các animation đâu"

## C · Look (Gate 2, the board)

- [ ] `video/src/palette.ts` is **generated** from `globals.css` and
      `run-view.ts` by a script; nothing typed by hand except the boot sky
      and the cloud's two colours, each with its source line. "reuse all CSS
      global i design no use outside"
- [ ] Motion scenes sit on neutral-950 with the app's own dither texture.
      No colour fields, blur blobs or glows under type (the green-blue Focus
      Pull field was rejected: "tự chế làm xấu như mấy màu này").
- [ ] Manrope only, at the app's weights (500/600/700). Never the reference
      clips' faces (Archivo, Inter).
- [ ] Mint only for the one emphasised span, rings and the Approve tick;
      role colours only on things of that role; orange only on the cloud
      when it needs you; blue only on the cloud and the boot sky.
- [ ] The cloud is the app's `glow-cloud.tsx` ported frame-pure
      (`CloudMark`), not a redrawn shape.
- [ ] App footage rides a tilted 3D camera (yaw 8–14°, soft far edge) like
      the user's reference still, and flattens while a callout is open.
- [ ] Footage fills ≥ 85 % of the frame; UI text a callout points at is
      ≥ 28 px at 1080p; lane names stay in frame.
- [ ] Previews carry one small corner watermark ("preview · fixture numbers
      · temp music"); the final carries none.

## D · Motion catalogue (the user's list, with where each belongs)

Free = `npx shadcn@latest add @snapcn/<name>` (MIT, we own the file).
Build = not in the free catalogue; write our own in `video/src/scenes/`
from the described behaviour, as a pure function of the frame.

| Effect | Source | Use it for | In rev 6 |
|---|---|---|---|
| Orb Swarm | free `orb-swarm` | The opening sentence in beats | scene 1 |
| Block Wordmark | free `block-wordmark` | The name, cards in role colours | scene 2 |
| Laptop Frame | free `laptop-frame` | Into the app from a device | scene 3 |
| Word Gather | free `word-gather` | A chapter line, first word alone | scene 4 |
| Text Highlight | free `text-highlight` | A marker on the two words that matter | scene 8 |
| Check Cycle | free `check-cycle` | A sentence that finishes itself (what it learns) | scene 11 |
| Phone Stack | free `phone-stack` | The chat app, one screen per message | scene 16 |
| Terminal Simulator | free `terminal-simulator` | `git clone && pnpm dev` | scene 20 |
| Button Press | free `button-press` | A drawn tick on a real Approve button | scenes 5, 9 |
| Click Type | free `click-type` | A cursor into a composer, then typing | optional on scene 5 |
| Cursor Track | free `cursor-track` | A ring on clicks that matter | footage |
| Count Grid | free `count-grid` | Tiles with numbers | scene 19 |
| Status Cycle | free `status-cycle` | Running → Needs you → Done | spare |
| Dot Bloom | free `dot-bloom` | A halftone wash between parts | spare |
| Punch Lines | free `punch-lines` | Hard-cut title cards | spare (rev D used it) |
| Announce Title | free `announce-title` | A four-shot launch title | spare |
| Answer Highlight, Agent Steps, Channel Thread, Card Rail, Capture Reveal, Reel Wall | free | Chat answers, step lists, a work chat, a card rail, a screenshot toast, a clip wall | not used |
| Lockup Reveal | build (done, `Lockup.tsx`) | The name on the boot sky; the end card | scene 21 |
| Metric Morph | build (done, `MetricMorph.tsx`) | A control becoming its number | scene 10 |
| Orbit Flow | build (done, `OrbitFlow.tsx`, dark) | "Always on" with three stops | scene 14 |
| Scatter Bloom | build (done, `ScatterBloom.tsx`) | Every model call as a point | scene 19 |
| Screen Wall | build (done, `ScreenWall.tsx`) | Four phones in a tunnel | replaced by Phone Stack |
| Focus Pull | build (done, `FocusPull.tsx`) | — | **rejected**: colour field |
| Glow Pullback, Say It, Trend Type, Ember Reveal | build | Lines on light paper or with glows | not used: light look, glows |
| App Reveal, Brief Send, Build Out, Picker Commit, Prompt Roll, Agent Chat, Agent Run, Agent Compose | build | Another product's composer or app | not used: the real Nimbus composer is on screen |
| Ticker Climb | build | A live number on a curve | spare: cost per run over runs |
| Comment Storm, Column Cut, Library Flight, Render Wall, Wire Feed, Dot Dissolve | build | Crowds, walls, feeds | not used: no product reason |

Rule for a new cut: an effect is used because a scene needs it, never
because it is on this list. "it should be nice and make sense for product."

## E · Sound (Gate 2, music.md and sfx.md)

- [ ] Music brief rewritten for the new length with the section map on the
      scene times; the drop lands on the first Approve click.
- [ ] UI sounds are cuelume renders (what the app plays); transitions are
      designed in Tone.js; no metronome, no raw tones, no stock library.
- [ ] One cue per moment; a riser ends on a downbeat; one beat of silence
      before the end card; master −14 LUFS, ≤ −1 dBTP.

## F · Build and QA (Gate 3)

- [ ] Every scene starts on a downbeat (`bars()`), both compositions share
      the scene components, the X clip is a re-timing of the full cut.
- [ ] The first Approve lands on its frame in both cuts (full 2280, X 690
      for rev 6); check with a frame extract, not from memory.
- [ ] Rings sit on their targets, cards cover no UI text, chapter chips sit
      on empty space (the rev C/D fixes).
- [ ] Palette check: sample ten frames; every hue traces to the app.
- [ ] The QA table from `build-qa.md`, with evidence, plus a stills sheet of
      every motion scene (`docs/demo/preview/motion-frames.png`).
- [ ] Previews at 720p under 30 MB to `docs/demo/preview/`, same paths.
- [ ] Commit `video/` and `docs/video/` only; no attribution lines; no push.
- [ ] Say what was not verified by name (today, always: the sound by ear).

## G · The hand-off to the build session

The brief to the video session names: the script/board/music revisions and
their status lines, the user's exact approval words, the take and
`beats.json`, the installs, the scenes to build vs reuse, the frames the
clicks must land on, the watermark rule, the QA list and the outputs
(previews, stills, commit hash). The builder session's brief names the
fixture renames, the sub-beats and targets to mark, and the real run's
budget cap.
