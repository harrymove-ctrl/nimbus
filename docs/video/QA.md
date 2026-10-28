status: locked · 2026-10-28 · "Lock them" · rev 6; final render on the real-model take 1915 (2026-10-29)
approved: script rev 6, board rev E, music rev D · "Approve rev 6" · Gate 3 "Lock them"
cuts: NimbusFull 2:56 (88 bars, 5280 f) · NimbusX 0:44 (22 bars, 1320 f) · compositions 1920 × 1080, 30 fps; the 4K master is the same composition at `--scale=2`
footage, stated plainly:
- **real** (take 1915, `docs/demo/raw/nimbus-demo-20261028-1915.webm`, real Nemotron models on Token Factory, 885 s): scene 3 Overview, scenes 5–10 (goal, plan, timeline, Agent I/O, brief, the four approvals, summary), 12 Memory & skill, 13 run two, 17 the web run started from chat. X: plan, lanes, the gate, run two
- **mock** (take 1258, the scripted mock model): scene 15 radar + status pill (the real take never reached the pill's approval) and scene 18 Token Factory watch (no proposal on the real run)
- the phone stack (scene 16, X scene 6): the live Railway chat run on the real models (`docs/video/chat-transcript-real.json`, run_6b393ab6)
- the 4K master renders the 1080p takes upscaled 2×
numbers on screen, all from take 1915 (RELEASE.md "Measured on take 1915"): plan estimate $0.0216; "The whole morning $0.0216"; "Router savings: 24 %"; "Run two: $0.0209 · Cheaper and faster"; the learned chip as it reads in the take, "Uses 6 memories and 1 rule" (16 is the count after both runs); Metric Morph's bars = run one (run_724b8d9d) hop by hop, 23 calls, $0.0216; the proof line "One morning: $0.0216 · 24 % saved by the router". The footage now shows the same figures (summary tile $0.022, run two $0.021). Scatter Bloom still plots the dev database's mock call log, with no count shown
known: **the real Writer's draft ends with a placeholder signature** ("Best, [Your Name]"; the teammate's ends "Thanks. [Your Name]") on all four approval cards in scene 9, including the first Approve at 1:16. It is the last body line, directly above the buttons, so no framing can crop it with the buttons whole; left as the real model wrote it, product fix queued
music: the Suno track fitted by `video/scripts/fit-music.py`; the bed about −18 LUFS under footage, ducked 3 dB under every cue

# QA, final (checklist.md F, build-qa.md), on the 03:03 renders

| Check | Result | Evidence |
|---|---|---|
| Duration | PASS · note | full 176.1 s, X 44.1 s; 3.9 s spare under 3:00 (the approved 2:56) |
| Scenes on downbeats | PASS | Whole-bar layout; the timeline (2 shots, cut on bar 6) and the gate (4 shots: 3 + 2 + 2 + 2 bars) cut on bar lines |
| First Approve on 2280 / 690 | PASS | Frame extract: the drawn tick is absent on 2279 and present on **2280** (full, the client's card), absent on 689 and present on **690** (X) |
| Four approvals | PASS | Ticks at 2280, 2370, ≈ 2490 and 2600 (always-allow, on "Approve & always allow"); the rule line ("Policy saved to SKILL.md · allow: send_message to reviewer@example.com") is ringed with "One rule saved" |
| Fit rates (≤ 1.5×) | PASS | timeline A/B 1.5×, Overview 0.9×, plan 1.3×, gate shots 1.0–1.5×, run two end 1.5×; the 60 s timeline and the 91 s run two are trimmed inside their beats |
| Lane names in frame | PASS | stills at 1250 / 1400 / 1500: Orchestrator, Researcher, Writer rows with their names |
| Cards clear of UI text | PASS | `layout-callouts.py`: 30 of 31 spots cover no text cell; `timelineB:agent-io` covers 1 |
| No watermark | PASS | as on the locked cut (the code is unchanged); nothing on the frame outside the story |
| Freeze and black | PASS | freeze only on the end card (full 166.5–, X 40.5–); black only on the designed dark motion openings |
| Loudness | PASS | full −13.8 LUFS, −1.8 dBTP; X −13.7 LUFS, −1.8 dBTP |
| No metronome | PASS | the Suno fit and the cue sheet only |
| 4K master | PENDING | re-rendering on take 1915 at `--concurrency=4` (the first try lost its Chrome target at 03:08) |
| Sound by ear | NOT VERIFIED | no listening in this environment |

# History: the take-1258 render (locked 2026-10-28 23:35, the shipping cut before take 1915)

status: locked · 2026-10-28 · "Lock them" · rev 6, commit 36922cb
approved: script rev 6 (hook line updated 2026-10-28), board rev E, music rev D · "Approve rev 6"
cuts: NimbusFull 2:56 (88 bars, 5280 f) · NimbusX 0:44 (22 bars, 1320 f) · compositions 1920 × 1080, 30 fps
footage: **mock take 1258** (`docs/demo/raw/nimbus-demo-20261028-1258.webm`, 1920 × 1080, role-named contacts, the scripted mock model). No real-model take was recorded (RELEASE.md, commit 9b22814). The 4K master renders the same composition at `--scale=2`, so the 1080p footage is **upscaled 2×** in it. If a real take lands, `scripts/sync-take.mjs` swaps it in (and halves its beats.json boxes if it was recorded at device scale 2)
numbers on screen: measured in the Oct 28 headless real runs on Nebius Token Factory (no recording; RELEASE.md), not the footage's fixture numbers, with no tag on the frame:
- plan estimate "≈ $0.0276" and "The whole morning $0.0276": check 6, run one after the Learner fix (75,291 tokens; run_7dae236f in `/tmp/claude-501/real-check`, 26 model calls, $0.02756 by src/lib/models.ts prices)
- "Router savings: 22 %": check 6, baseline $0.0356 (every hop at its role's ceiling tier)
- "Run two: $0.0288": check 5. It costs more than run one, so the line now says "Same brief, using what it learned" and no longer claims "cheaper"
- "8 memories": check 6 (8 memories saved, SKILL.md rewritten)
- Metric Morph's bars: run_7dae236f hop by hop (26 bars, $0.0276; `src/datasets/run-hops.json`)
- proof line "One morning: $0.0276 · 22 % saved by the router": check 6, held still
- **The footage underneath still shows the mock take's own figures** (its summary tile reads $0.024, the run-two header $0.016, the plan chip ≈ $0.03). The callout cards carry the measured numbers.
- Scatter Bloom plots the dev database's call log (`data/nimbus.db`, mock runs) with no count on screen ("Every model call in the log")
music: the Suno track (variant A, 122.09 BPM) stretched to 120 and fitted by `video/scripts/fit-music.py` (music.md "Fit"). Bed under footage: gain 0.8 → 0.4 (−6 dB). Before the change that put the bed at about −15.5 LUFS short-term before mastering; after, about −21.6 before mastering and **about −18 LUFS in the master** (the board's level for footage). It ducks 3 dB under every SFX cue and comes back +3 dB on the 1:16 drop and the finale; the master's loudnorm brought the mix (and so the SFX) up 3.5 dB
chat transcript: `docs/video/chat-transcript.json` (old fixtures) with the three addresses mapped to take 1258's role addresses
files (gitignored, `video/out/`): `nimbus-full.mp4` (1080p master, crf 17) · `nimbus-x.mp4` (X master) · `nimbus-full-4k.mp4` (3840 × 2160, crf 17, footage upscaled 2×)
previews (720p, mastered): `docs/demo/preview/nimbus-full-preview.mp4` (19.8 MB) · `docs/demo/preview/nimbus-x-preview.mp4` (4.3 MB)
stills: `docs/demo/preview/motion-frames.png` (12 motion scenes) · `docs/demo/gallery/gallery-1.png` … `gallery-5.png` (SUBMISSION.md "Devpost gallery"; frames 200, 1260, 2283, 4760, 4290)

# QA, rev E final (checklist.md F, build-qa.md), on the 23:35 renders

| Check | Result | Evidence |
|---|---|---|
| Duration | PASS · note | full 176.1 s, X 44.1 s (ffprobe). The full cut leaves 3.9 s of spare under 3:00, not the ≥ 5 s build-qa.md asks for; the approved script sets 2:56 |
| Scenes on downbeats | PASS | `shots.ts` lays out whole bars and `onTheBeat` refuses an off-beat scene; the gate's two shots and the timeline's trimmed start cut on bar lines |
| First Approve on 2280 / 690 | PASS | Frame extract: the drawn tick is absent on 2279 and present on **2280** (full), absent on 689 and present on **690** (X) |
| Rings on targets, cards clear of UI text | PASS · 3 small | `layout-callouts.py` on take 1258: 28 of 31 spots cover no text cell. `gateB:approve-buttons` covers 20 cells (the approval cards fill the frame and the take's Artifact panel is beside them, so it sits over the header of the card already approved). `chatRun` covers 4 and the X `lanes` card 1 |
| Overview callouts | PASS | The camera opens wide (1.15–1.22×) on the whole workstream list and spend chart; each of the three Overview cards covers 0 text cells |
| Chapter chips on empty space | PASS | Corner scrim, off over the motion scenes |
| Palette | PASS | Generated from globals.css / run-view.ts; the terminal now paints in the app's tokens |
| No watermark, nothing outside the story | PASS | Eight frames sampled (60, 735, 2130, 3030, 3750, 4250, 4900, 5100): the bottom-right corner is flat apart from the dither (max − min ≤ 11/255); `Watermark.tsx` is deleted |
| Freeze and black | PASS | Freeze: only the end card (full 166.5–, X 40.5–). Black ≥ 0.3 s only on the designed dark openings of motion scenes (the orbs, hook → name 7.1–9.2 s, Word Gather's lone word, Metric Morph, Check Cycle, Orbit Flow, Phone Stack, Scatter Bloom); the X phone hold is gone |
| Pacing (no footage hold > 2 bars without a callout or a UI change) | PASS · note | Still spans in each footage window were measured on the take (5 fps frame difference). The long ones (doc, summary, memory, learned plan, run-two end) sit under an open callout with the camera moving between targets. Changed: the Overview starts at the first clean frame, the timeline skips its 4.7 s plan-card wait, and the gate is two shots cut on bar 4 so the wait for the second card is gone |
| Loudness | PASS | full −13.8 LUFS, −1.8 dBTP, LRA 8.3; X −13.7 LUFS, −1.8 dBTP, LRA 7.1 |
| No metronome | PASS | The bed is the Suno fit; every cue is a cuelume render or a Tone.js design |
| Sound by ear | NOT VERIFIED | No listening in this environment |

# Changes after the 22:49 preview (timestamps in the full cut)

1. **0:12–0:14.5 laptop dive**: the screen showed the boot overlay; the Overview cut now starts 4.7 s into its beat (after the boot fade and the list's loading placeholders), and the laptop renders at 2× (85 % of the frame width) before it dives.
2. **0:14.5–0:24 Overview**: the camera opens wide on the workstream list and the spend chart (was 1.5–1.7× onto an empty card). All three Overview callout cards were re-measured and each covers 0 text cells.
3. **2:38 proof line**: "One morning: $0.0276 · 22 % saved by the router", held still (the count-up showed in-between figures like "9 calls · $0.0096").
4. **2:34–2:40 proof tiles**: rise into place, with no sideways rush under blur (that was the grey smudge).
5. **2:40–2:46 terminal**: our own window, 88 % × 87 % of the frame from its first frame; the pin onto the URL runs only in the last bar.
6. **Music**: the bed sits 6 dB lower under footage, ducks 3 dB under every SFX cue, and comes back +3 dB on the 1:16 drop and the 2:40 finale.
7. **0:38–0:58 timeline**: starts 4.7 s later (the plan card folding away is cut); its callouts move a bar earlier (lanes 0:40, model 0:44, cost 0:48).
8. **1:12–1:30 gate**: two shots cut at 1:18 (bar 4). The first Approve stays on 2280, the second moves to 2379 (1:19.3), always-allow to 2545 (1:24.8).
9. **Numbers**: the measured headless figures above replace the fixture ones in the callouts; "Run two" no longer says "cheaper".
10. **Hook (0:00–0:08)**: "Your standing work, · done every morning · by a crew · that asks before it acts · and gets better · every run."

# History: rev E QA on the 20:48 previews

status: Gate 3 · rev E QA on the 2026-10-28 20:48 previews, fixes in code; renders on hold (the builder records the real-model take) · 2026-10-28
approved: script rev 6, board rev E, music rev D · "Approve rev 6"
cuts: NimbusFull 2:56 (88 bars, 5280 f) · NimbusX 0:44 (22 bars, 1320 f) · 1920 × 1080, 30 fps; the 4K master is the same composition at `--scale=2`
take: `docs/demo/raw/nimbus-demo-20261028-1258.webm` (251.4 s, 1920 × 1080, role-named contacts) cut by its beats.json; the 4K master upscales it 2× (the real take will be checked for device scale 2 by `scripts/sync-take.mjs`)
numbers on screen (fixture take, `data/video-rev6`): estimate ≈ $0.03 · run one $0.024 (21 hops, run_0ccb7cb0) · run two $0.016 (run_f34484ad) · proof 1,492 calls / $2.25 from `data/nimbus.db` (83 runs, all model "mock"); the real-model take replaces every one, then `export-calls.py` and `layout-callouts.py` run again
chat transcript: `docs/video/chat-transcript.json` (old fixtures), with the three addresses mapped to take 1258's role addresses in `compositions.tsx`; the real run's transcript replaces it
music: the Suno track (variant A, 122.09 BPM) stretched to 120 and fitted by `video/scripts/fit-music.py` (music.md "Fit"); the 20:48 previews still carry the Tone.js temp score
previews (720p, mastered): `docs/demo/preview/nimbus-full-preview-temp-music.mp4` (19.3 MB, 2:56) · `docs/demo/preview/nimbus-x-preview-temp-music.mp4` (4.2 MB, 0:44) — rendered 20:48 / 20:51, before the fixes below
evidence: `docs/demo/preview/callouts-middle-frames.png` (every callout's middle frame, both cuts) · `docs/demo/preview/motion-frames.png` (one still per motion scene, 12) — both from the 20:48 previews, so they still show the corner label and the old Orbit Flow radius

## QA, rev E, on the 20:48 previews

| Check | Result | Evidence |
|---|---|---|
| Duration | PASS · note | ffprobe: full 176.1 s, X 44.1 s. The full cut is 3.9 s under 3:00, not the ≥ 5 s spare build-qa.md asks; script rev 6 sets 2:56 and the user approved it |
| Every scene on a downbeat | PASS | `shots.ts` lays both cuts out in whole bars and `onTheBeat` refuses to load an off-beat scene; the bundle loads |
| Both cuts share the scene components; X is a re-timing | PASS | `compositions.tsx`: `Hook`, `Name`, `ChapterHighlight`, `ChatStack`, `RunIt`, `LockupEnd`, `Footage` shots in both |
| First Approve on 2280 / 690 | PASS | Frame extract of the previews: the drawn tick is absent on 2279 and present on **2280** (full), absent on 689 and present on **690** (X); the take's cursor is on the Approve button on both |
| Rings on their targets | PASS | `callouts-middle-frames.png`: all 33 rings sit on their targets (the plan, estimate, tools, lanes, badges, cost, I/O, doc parts, approval card and buttons, rule line, summary tiles, memory parts, chips, rail dot, pill, phone, chat run, routing table, gauge) |
| Cards clear of UI text | PASS · 3 small | `layout-callouts.py` on take 1258: 29 of 32 spots cover no text cell; `timeline:run-cost` 7 cells, `chatRun:chat-run` 4, `xLanes:lanes` 1 (each the nearest corner of a busy frame) |
| Chapter chips on empty space | PASS | The chip sits on its corner scrim in every chapter span on the sheet; it is off over the motion scenes |
| Palette (ten frames, every hue traces to the app) | PASS | `qa-frames.py`: full and X, no foreign hue bin ≥ 2 %; saturated pixels at 205°/215° (cloud blue and the boot sky), 155–165° (mint) |
| Frame density | FAIL → fixed in code | Full: 27 s and 29 s (the goal typing into the composer of the empty run page, framed tight). X: none. Fix: the goal shot is framed wider (1.3–1.5×, rail and the run panel's prompt in shot). Not re-rendered yet |
| Freeze and black | PASS · note | Black ≥ 0.3 s only at the dark first beats of motion scenes (orb opening 0–0.6 s, hook → name 7.2–9.2 s, Word Gather's lone word 24–24.9 s, Metric Morph, Check Cycle, Orbit Flow, Phone Stack, Scatter Bloom, terminal). Freezes: full 141.9–143.5 s (the last phone held 1.6 s), 162.3–164.1 s (terminal before the URL pin, 1.8 s), the end card; X 32.9–38.0 s (**5.1 s**, the X phones) → fixed in code (phones a bar apart, a slow push under the stack) |
| Loudness | PASS | After `master.sh`: full −14.2 LUFS, −1.0 dBTP, LRA 7.3; X −14.3 LUFS, −1.6 dBTP, LRA 5.2 |
| No metronome | PASS | The temp score (`sound/page.ts` `score`) renders no click; no click file in `public/audio/sfx/`; every cue is a cuelume render or a Tone.js design (sfx.md rev E sheet) |
| No "mock" tag, no names in our words | PASS | `grep -rn mock src/scenes src/shots.ts` finds none on screen; callout texts are script rev 6's; the 1258 take shows roles (client, teammate, reviewer) |
| Nothing on the frame outside the story | FAIL → fixed in code | The 20:48 previews carry the "preview · fixture numbers · temp music" corner label; board rev E rule 7 (rewritten) removes it. `Watermark.tsx` deleted; take and numbers are stated here |
| Sound by ear | NOT VERIFIED | No listening in this environment: levels and placement only |

# Fixes after the QA (in code, 2026-10-28; renders on hold)

1. **Watermark removed** everywhere (`src/components/Watermark.tsx` deleted, `Shell` no longer draws it, README updated).
2. **Word Gather overlap** ("tgoal" at 0:25): the block's words slid in sideways from the reference's scatter offsets while the lead word was still travelling, so "the" and "goal." crossed. New `arrive="vertical"` mode in `snap-cn/word-gather.tsx`: each word drops straight onto its own place, only after the lead word is home (beat 29), so no two words ever share horizontal space; the last word lands at frame 58 of 60.
3. **Orbit Flow overlap** (found checking the other chapter cards): the inner orbit (520 px) ran through the title, so the pills crossed "wherever you are". Inner orbit 740 px on a 0.4 tilt: wherever a pill is level with the two lines it is ≥ 640 px from centre, past the text's 418 + the pill's 175. Text Highlight (a static line) and Check Cycle (the slot's words move as one strip with a constant gap) cannot overlap.
4. **Approve tick** read as a mint blob on the app's mint Approve button: now a dark disc (accent-fg) with a mint ring and check.
5. **X phones** held 5.1 s: the three phones land a bar apart, and a slow push (1 → 1.07) runs under the stack in both cuts; the phone ring follows the push.
6. **Phones show the newest three messages**, so "approve all" → "Approved" are on the visible top of each phone (they were below the fold).
7. **Goal shot** framed wider (density).
8. **4K**: `scripts/sync-take.mjs` reads the take's width and halves beats.json boxes when a device-scale-2 take has them in device pixels (`TAKE_SOURCE_W` in `take.ts`); the 4K master command is in the README and build-qa.md.

# History: the rev D lock (superseded by rev E)

status: locked · 2026-10-28 · "Lock them" · rev D, commit 6d4cffd
unlocked for rev D by the user (via the planner): "các animation đâu ui ux show như [Text Highlight, Punch Lines, Focus Pull, Lockup Reveal, Metric Morph, Orbit Flow, Scatter Bloom, Screen Wall] … kết hợp để transition và chọn font cũng như ui ux như bản web đang dùng"
cuts: NimbusFull 2:54 (87 bars) · NimbusX 0:44 (22 bars) · script rev 5 · board rev C + rev D motion layer · music map rev C (unchanged) · sfx rev D
take: docs/demo/raw/nimbus-demo-20261027-1633.webm (209.6 s) cut by its beats.json
previews (720p, h264 crf 23, AAC 192k, mastered): `docs/demo/preview/nimbus-full-preview-temp-music.mp4` (21.9 MB, 2:54) · `docs/demo/preview/nimbus-x-preview-temp-music.mp4` (5.4 MB, 0:44)
evidence sheets: `docs/demo/preview/motion-frames.png` (one still per motion scene) · `docs/demo/preview/callouts-middle-frames.png` (each callout's middle frame, rev D timings)
sound: Tone.js temp score (`video/sound/music-map.json` = music.md rev C) + 37 sheet sounds (14 cuelume renders, 23 Tone.js designs, 11 of them new for rev D), mastered with `video/scripts/master.sh`
remaining before the final render: the Suno tracks, the final-day real run (then `export-mock-calls.py` and `layout-callouts.py` again), Gate 3 on these previews

# Rev D motion layer (2026-10-28), frame times in the full cut

| Scene | Frames | Motion scene | Built from | Footage after it |
|---|---|---|---|---|
| 2 title | 180–300 | Lockup Reveal: the cloud alone on the dark with dashed construction hairlines, "Nimbus" slides out of a slot behind it and settles from 1.1×, the boot sky rises in the letters; bar 2 cuts to the boot sky, the cloud blinks, the two lines build a word at a time | ours (`scenes/Lockup.tsx`) + `CloudMark` | — |
| 4 Ch 1 | 660–720 | Punch Lines: "You ask." · "It plans." · "You approve the plan" (mint, from a third of its size) | snapcn `punch-lines` (free, installed) | Plan 6 bars, unchanged; the 1-bar goal close-up is gone (Punch Lines' "You ask." stands for it) |
| 7 Ch 2 | 1980–2040 | Text Highlight: "Nothing leaves without you." with a mint marker on "without you."; the cloud at the end of the line turns orange as it lands | snapcn `text-highlight` + `CloudMark` | Gate 8 bars; the cut is re-derived so Approve (Dana) still lands on **2160** (measured: 2160) |
| 8 summary | 2520–2580 | Metric Morph: the "Approve & always allow" pill dissolves, collapses into a square (neutral-900 → mint) and slams in as the tallest bar of the run's cost chart, the chart rising around it | ours; bars = the take's run hop by hop (`src/datasets/run-hops.json`, $0.02404 from data/video-rev5) | Summary 4 bars (0.64×) |
| 9 Ch 3 | 2820–2940 | Focus Pull: "It remembers." then "It gets better every run.", each pulled into focus a glyph at a time over the dither glow | ours | Memory 5 bars (1.07×); its three callouts hold 7, 7 and 6 beats |
| 11 Ch 4 | 3600–3720 | Orbit Flow (dark): three dashed orbits round "Always on, wherever you are", three pills on the inner orbit ("08:00 SCHEDULE", "CHAT APP", "STATUS PILL"), wind-up and whip | ours | Radar 6 beats + status pill 6 beats + approve 1 bar |
| 12 chat | 3960–4080 | Screen Wall: four phones down a tunnel with real `/v1` frames ("what needs me?", "run morning brief", "approve all", "Approved: …"), the camera backs out, "Same crew, in your chat app" builds with a shove | ours (transcript verbatim) | Phone 4 bars ("run morning brief" → "approve all"), web run 2 bars |
| 14 proof | 4740–4980 | Scatter Bloom: 1,492 model calls from 83 mock runs in `data/nimbus.db`, x = time of day, y = cost (log), tier colours, on a tilted plane; the tiles land on it from bar 3 | ours; `src/datasets/mock-calls.json` by `scripts/export-mock-calls.py` (read-only, every run model "mock") | — |
| 15 end | 4980–5220 | Lockup reprise on the boot sky, held still, with the repo URL and `pnpm dev` (8 s) | ours; replaces `wordmark-cut` | — |

X clip: Lockup on the title (180–300) and the end (1200–1320); a 1-bar Screen Wall at 960–1020, the phone 3 bars after it; Dana still on **690**.

Rules checked: Manrope only (500/600/700; the reference faces are not used); the app palette, and the boot sky (`boot.tsx:15`) only in the Lockup and the end card; `CloudMark` is `glow-cloud.tsx` with the same PUFFS, CORE, EYES, goo filter and gradients, driven by `useCurrentFrame()` (no requestAnimationFrame, no Math.random); no paid snapcn source used or copied; every motion scene enters on a downbeat with its own designed sound (sfx.md rows 46–56) and cuts hard to footage on a downbeat; the chapter eyebrow slides in as each motion scene cuts to footage and is off over the motion scenes inside a chapter.

# QA, rev D (build-qa.md)

| Check | Result | Evidence |
|---|---|---|
| Duration | PASS | Full 174.1 s (87 bars); X 44.1 s; scene lengths and the music map unchanged |
| No frozen spots | PASS | `freezedetect n=0.003 d=1.5`: only the end cards (full 166.5–174, X 40.5–44). Three motion scenes first read as frozen (the held Text Highlight line, Orbit Flow's small pills, Scatter Bloom's first beat); they got a slow push, a faster orbit and a camera swing |
| Black spots | PASS (by design) | `blackdetect d=0.3`: 6.0–6.8 (Lockup bar 1, the cloud alone on the dark), 84.6–85.2 (Metric Morph, the square on the dark), 120.0–120.4 (Orbit Flow drawing in), 158.0–159.5 (Scatter Bloom's first points). Each is a designed dark card with something moving on it; no footage goes black |
| Cuts on the beat | PASS | Every scene in bars (`grid.ts`); every motion scene a whole number of bars from its scene's start; Approve (Dana) on 2160 (bar 36, drop 2), X on 690 |
| Loudness | PASS | After `master.sh` (limiter ceiling lowered to ≈ −2 dBFS so the 720p AAC re-encode keeps ≤ −1 dBTP): full −14.3 LUFS, −1.0 dBTP, LRA 7.0; X −14.3 LUFS, −1.7 dBTP, LRA 6.2 (measured on the previews) |
| Palette matches the app | PASS | `qa-frames.py`: saturated hues sit on the boot sky blues (205°/215°, now in `palette.ts` with its source line), mint and the tier colours; no foreign bin ≥ 2 % in either cut |
| Frame density | PASS | A frame every 2 s with the motion cards exempt like the title and end: no flags in either cut (the 23 s goal close-up exception of rev 5 is gone with the goal shot) |
| Callout cards clear of UI text | PASS | `layout-callouts.py` re-run for the rev D timings: 31 of 33 cards on 0 text cells, chat-run and the X lanes on 4 (a bar corner, a panel corner); `callouts-middle-frames.png` regenerated and looked at |
| Rings in frame | PASS | ≥ 24 px from the edge (unchanged from the lock) |
| Honest numbers | PASS (labelled) | Metric Morph says "$0.024 · 21 model calls · mock" (sum of the take's hops: $0.02404); Scatter Bloom says "1,492 model calls from 83 mock runs" and the proof keeps its mock tag |
| Hackathon requirements | PASS | Title: "NVIDIA Nemotron · Nebius Token Factory"; proof tiles with the three model ids and "Nebius Token Factory" |
| Sound | not auditioned | Every new sound peaks at −1 dBFS with mean levels −27 to −15 dB; placement is checked against the sheet, but I cannot listen in this environment |

# History: the rev C lock (superseded by rev D)

status: locked · 2026-10-28 · "Fix the two overlaps and the three clipped rings, then lock both cuts and wait for the Suno music." · commit 54a0f38

# Gate 3 fixes (2026-10-28), frame times in the full cut (rev C)

| Fix | Result | Evidence |
|---|---|---|
| Eyebrow over the app header (0:44, "1 · You approve the plan" over "Nimbus · 3 waiting for you") | FIXED | Every eyebrow (4 chapters, full cut; the X clip has none) is a solid neutral-950 chip on a neutral-950 corner scrim, so no app text shows through or half-cut around it: 0:44 (f1320), 1:52 (f3360), 2:02 (f3660), 2:08 (f3840) checked by eye. The plan shot is framed so "Plan · 4 steps · Ultra" sits below the chip (0:26–0:32) |
| Estimate callout over the plan list (0:30) | FIXED | Card placement is measured, not guessed: `video/scripts/layout-callouts.py` renders each callout's frames with only its ring, maps text cells (8 px cells with edges both ways: glyphs, icons, charts) and keeps the nearest spot covering none, worst of three frames per callout. 31 of 33 spots cover 0 text cells; chat-run (2:24) and the X lanes (0:16) touch 4 cells each, a lane bar's corner and a panel corner, no text. The estimate card (0:28–0:32) sits in the plan card's empty lower right, the plan card (0:26–0:30) in its header strip between the title and the estimate chip. Two shots were reframed so a clear spot exists: the router gauge (0:18–0:22, 2:34–2:38) now sits right of centre with its card on the Runs panel's empty half, and the plan is held at 1.9× for its two cards |
| Rings clipped by the frame (brief-doc 0:00–0:04, workstreams 0:10–0:14, model-badge 0:42–0:46) | FIXED | Every ring's rect is kept 25 px inside the frame (`Callout.tsx` SAFE), so its stroke has a 24 px margin; measured on all 36 ring renders. model-badge was ringing a badge that had scrolled under the app header in the take; it now rings the three visible "Nemotron 3 Super" lane badges (measured on the take at 44–50 s, `video/src/beats.ts` MEASURED) |
| Approve plan ring (optional) | ADDED | At the click, full 0:34.1 (f1024) and X 0:15.1 (f452): the button's position is derived from the plan card's box in beats.json (its bottom-right, 41 px in and 103 px down, read off the take) and lands on the button on the render |
| Re-check of all 30 callouts | PASS | `callouts-middle-frames.png` regenerated; each of the 30 middle frames plus 0:18.7 and 0:26.7 looked at in full size: no card over UI text, every ring whole and on its element |

# QA, rev 5 locked (build-qa.md)

| Check | Result | Evidence |
|---|---|---|
| Duration | PASS | Full 174.1 s (87 bars, 5.9 s under 3:00); X 44.1 s |
| No frozen or black spots | PASS | `freezedetect n=0.003 d=1.5`: only the end cards (full 168.1–174, X 42.1–44), the intended hold. `blackdetect d=0.3`: none |
| Cuts on the beat | PASS | Scenes laid out in bars by `grid.ts`; the bundle throws if one starts off a 15-frame beat. Approve (Dana) lands at frame 2160 = bar 36 exactly (the drop 2), X at 690 = bar 11.5 |
| Frame 1 is the payoff | PASS | Frame 0: the finished brief beside the approval cards, the tray "3 waiting", the cloud orange |
| Captions safe | N/A | No captions, no sentence captions (story.md rule 12) |
| Phone readability | PASS | Callout line 1 is 34 px, line 2 28 px; eyebrows 28 px; phone chat 18 device px × 1.58 ≈ 28 px; footage pushed in 1.9–2.6× on the parts a callout names |
| Loudness | PASS | After `master.sh`: full −14.1 LUFS integrated, −1.2 dBTP, LRA 7.0; X −14.2 LUFS, −1.0 dBTP (measured on the locked previews) |
| Hackathon requirements | PASS | Model ids on the proof tiles, "Nebius Token Factory" under them and on the title, the spend callout and the Overview; the app works on screen throughout |
| Honest numbers | PASS (labelled) | Every number in a callout or tile is from the mock run and says "mock": ≈ $0.03, $0.024, $0.016; the proof card carries "mock run"; 19/19 kept under that tag until RELEASE.md traces it |
| End card | PASS | URL and `pnpm dev` held still 6 s (full) and 2 s after the wordmark (X, 4 s total card) |
| Palette matches the app | PASS | `video/src/palette.ts` values each cite `globals.css`, `run-view.ts` ROLE_COLOR, the Overview tiers or the timeline's NVIDIA badge; `scripts/qa-frames.py` on 10 frames per cut: saturated hues sit on mint (165°), writer/teal and checker/analyst, no foreign bin ≥ 2 % |
| Frame density | PASS with one exception | A frame every 2 s (87 full, 22 X; title and end cards exempt): X none; full flags only 23 s, the 2 s goal close-up (the composer is at the bottom edge of the app, the page above it is empty by design). The phone sits on the web app (lightly blurred) |
| No click track, no raw tones | PASS | No click track exists any more (`click-120.wav` deleted, no `ClickTrack` in the code); every SFX is a cuelume render or a Tone.js design (`scripts/make-sound.mjs`); the score is Tone.js; nothing from `anoisesrc`/`aevalsrc` |
| Callout rings on target | PASS | 30 callouts (33 with the X clip's own), middle frames in `callouts-middle-frames.png`: every ring sits on its element, whole, ≥ 24 px from the frame edge (Gate 3 fixes above) |
| Callout cards clear of UI text | PASS | Measured placement (`layout-callouts.py`, `video/src/callout-layout.json`): 0 text cells under 31 of 33 cards, 4 (a bar corner, a panel corner) under 2; checked by eye on every middle frame |
| Eyebrows clear of the app header | PASS | Solid chip on a corner scrim (Gate 3 fixes above) |
| Better than the last liked cut | PASS on picture; sound not auditioned | `compare-v3-rev4-rev5.png`, rows Overview/crew · approval gate · learning, columns v3 · rev 4 · rev 5: rev 5 shows readable everyday content (Dana's contract, the brief) with a callout naming each part, where v3 shows router jargon with sentence captions and rev 4 kinetic cards. I cannot listen in this environment: the temp score and the mix are checked by waveform, spectrum and loudness only |

# Rev 5 build notes (deviations from board rev C, all forced by the take)

- **Scene 4**: the goal is 1 bar (a push from the page to the composer while it types, 1.5×) and the plan draft 6 bars, so the plan, the estimate and the tools each hold 2 bars; the planning wait between them is cut.
- **Scene 6**: starts 3 s into `brief1-doc`; the draft to Sam shows first and the brief opens after it.
- **Scene 7**: the shot starts 5.24 s before `approve-dana`, so the click lands on bar 36.
- **Scene 9**: starts 1.5 s into `memory-skill`, after the panel has loaded.
- **Scene 12**: the phone sits on the web app (the `chat-run` beat, blurred 3 px, 50 % brightness) instead of a bare background; its callout starts a bar later, after the phone's entrance.
- **Scene 13**: second half is `overview-after` (the router gauge is not on screen during `watch`).
- **Approve plan** gets a click ring placed from the plan card's box (its button is not in `beats.json`).
- **Scene 4** (Gate 3): the plan is held at 1.9× while its two callouts are up; the router gauge (scene 3, scene 13) is framed right of centre. Both leave room for a card that covers no text.
- **Scene 5** (Gate 3): "Model per step" rings the Writers' three Super badges; the orchestrator's badge in `beats.json` has scrolled under the header by then.

# History

(rev 4 redo) status: unlocked · 2026-10-27 · full redo per user feedback ("music quá tệ … colors not matching … sound effect not good … do it all again full")

# History: the Gate 3 lock and table below are superseded by the redo

status: locked · 2026-10-27 · "Both cuts are right; lock them and wait for the music and the real run."
locked: NimbusFull 2:16 (68 bars) · NimbusX 0:44 (22 bars) · commits 04023a2, 803aa87
remaining before the final render: (1) Suno tracks music-full.mp3 and music-x.mp3 in video/public/audio/, (2) the final-day real run replayed as footage and its numbers replacing the "mock run" cards. No other changes.

status: Gate 3 · previews for review · 2026-10-27
cuts: NimbusFull (68 bars, 4080 f) · NimbusX (22 bars, 1320 f) · 1920 × 1080 · 30 fps
previews (720p, h264 crf 24, AAC): `docs/demo/preview/nimbus-full-preview.mp4` (11.7 MB) · `docs/demo/preview/nimbus-x-preview.mp4` (3.4 MB)
masters checked: `video/out/nimbus-full.mp4`, `video/out/nimbus-x.mp4` (1080p, crf 20; not finals)
footage: take of 2026-10-27 21:32 (`docs/demo/raw/nimbus-demo-20261027-1432.webm`) cut by its `beats.json`
sound: click track at 120 BPM in place of the Suno track, plus the 46 generated SFX of the cue sheet

# QA (build-qa.md)

| Check | Result | Evidence |
|---|---|---|
| Duration | PASS | Full 136.02 s (2:16, 44 s under 3:00); X 44.01 s (in 40–46 s) |
| No frozen or black spots | PASS | `freezedetect=n=0.003:d=1.5`: only the end card (full 132.1–136.0, X 38.1–44.0), the intended 2–3 bar hold. `blackdetect` at `pix_th=0.02`: none. At the default `pix_th=0.10` the dark scenes (neutral-950 cards, the chat, the storm's opener) read as black; they are the design, and each one moves (drift, typing, highlight) |
| Cuts on the beat | PASS | Every scene is laid out in whole bars by `grid.ts` `layout()`; the bundle throws if a scene starts off a 15-frame beat. Inside scenes: the gate card starts at beat 20, run two's card at bar 3 |
| Frame 1 is the payoff | PASS as approved | Frame 0 is the Prompt Roll card with the caret, "Let Nimbus handle" typing from frame 0 (board scene 1); the first job pill is on screen at 1.3 s |
| Captions safe | N/A | Captions off (user, Gate 1); no transcript anywhere |
| Phone readability | PASS with a note | One frame per scene at 30 % (576 px): every card line, footage label, chat bubble, tile and the end card read. App UI text inside footage does not read at that size; the labels carry the point |
| Loudness | FAIL (deferred to the music) | Full −21.9 LUFS integrated, −1.2 dBTP, LRA 14.5; X −20.8 LUFS, −1.2 dBTP. The click stand-in is sparse, so −14 is out of reach without clipping; with the Suno bed under it the mix gets re-levelled to −14 ± 1 at ≤ −1 dBTP |
| Hackathon requirements | PASS | Model ids `nvidia/Nemotron-3-Ultra-550b-a55b`, `nvidia/nemotron-3-super-120b-a12b`, `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` on the scene 18 tiles; "Nebius Token Factory" in scene 3 and under the tiles; the app working in scenes 6, 8, 9, 13, 16, 17 |
| Honest numbers | PASS (labelled mock) | $0.080 → $0.045, −45 %, 19/19 come from the mock-mode run; scene 17's card and scene 18 carry "mock run · numbers from the demo fixtures" until `video/src/numbers.ts` is filled from the real run |
| End card | PASS | URL and `pnpm dev` held still 4 s (full) and 6 s (X) |

# Deviations from the board, and why

- **Scene 14 (Hermes CLI) cut**: Phase D is not recorded; scene 12 takes its 2 bars, as the script allows.
- **Scene 13** uses 2 bars of the `status-pill` beat (Morning brief waiting, its reply approved from the panel): no chat-triggered run is in the take. The label "Same crew. Through OpenClaw." sits over that stand-in.
- **Scene 8** starts at `ship1-plan-draft`: the take's `ship1-goal` beat is mostly a planning wait, so the goal typing is not in the shot.
- **Scene 9**: the take is slow (machine load), so reaching Approve & always allow at ≤ 1.5× takes 10 s of footage, not 9; the "anything" card gets the scene's last 2 s. The approval lands at 65.6 s (board: 63.0 s, the Drop 2 downbeat); align the drop when the music arrives.
- **X scene 3**: orb-swarm is timed for six cards, so the X clip uses the full cut's six-card line ("Nimbus / an always-on crew / of NVIDIA / Nemotron agents / on Nebius / Token Factory") at 1.43× instead of two groups; with three cards "Nemotron agents" never appeared.
- **Scene 17**: footage starts at Approved by policy (334 s) through the summary to the learned chip (342 s).
- **Scene 10**: text-highlight's strikethrough replaces "their servers" with "your database" in mint; there is no second marker pass on the new words.
- **Chat (12)**: real `/v1` replies from `chat-transcript.json`, verbatim, minus the localhost link lines; "approve all" ends at item 1's first sentence with " …" (planner's selection). The typing rate is the one chosen value, fitted so the transcript ends 1.5 s before the cut.
- **Every footage shot** has a slow 1.00 → 1.06 push under its keyframed moves, so holds between moves never freeze.

# Still placeholder

- Music: the click track (`video/public/audio/click-120.wav`), muted for the cue sheet's two silences.
- SFX: all generated with ffmpeg (`video/scripts/make-audio.sh`), source "generated", no license; swap any file under the same name.
- Numbers: mock until the final-day real-model run.
