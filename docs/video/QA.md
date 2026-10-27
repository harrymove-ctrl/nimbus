status: Gate 3 · rev 5 previews (temp music) for review · 2026-10-28
script: rev 5 (approved) · board, music, sfx: rev C (approved) · take: docs/demo/raw/nimbus-demo-20261027-1633.webm (209.6 s) cut by its beats.json
previews (720p, h264 crf 23, AAC 192k, mastered): `docs/demo/preview/nimbus-full-preview-temp-music.mp4` (23.4 MB, 2:54) · `docs/demo/preview/nimbus-x-preview-temp-music.mp4` (5.5 MB, 0:44)
evidence sheets: `docs/demo/preview/callouts-middle-frames.png` (each callout's middle frame) · `docs/demo/preview/compare-v3-rev4-rev5.png` (v3 · rev 4 preview · rev 5, three scenes)
sound: Tone.js temp score (`video/sound/music-map.json` = music.md rev C) + 26 sheet sounds (14 cuelume renders, 12 Tone.js designs), mastered with `video/scripts/master.sh`

# QA, rev 5 (build-qa.md)

| Check | Result | Evidence |
|---|---|---|
| Duration | PASS | Full 174.1 s (87 bars, 5.9 s under 3:00); X 44.1 s |
| No frozen or black spots | PASS | `freezedetect n=0.003 d=1.5`: only the end cards (full 168.1–174, X 42.1–44), the intended hold. `blackdetect d=0.3`: none |
| Cuts on the beat | PASS | Scenes laid out in bars by `grid.ts`; the bundle throws if one starts off a 15-frame beat. Approve (Dana) lands at frame 2160 = bar 36 exactly (the drop 2), X at 690 = bar 11.5 |
| Frame 1 is the payoff | PASS | Frame 0: the finished brief beside the approval cards, the tray "3 waiting", the cloud orange |
| Captions safe | N/A | No captions, no sentence captions (story.md rule 12) |
| Phone readability | PASS | Callout line 1 is 34 px, line 2 28 px; eyebrows 28 px; phone chat 18 device px × 1.58 ≈ 28 px; footage pushed in 1.9–2.6× on the parts a callout names |
| Loudness | PASS | After `master.sh`: full −14.1 LUFS integrated, −1.2 dBTP, LRA 7.0; X −14.2 LUFS, −1.0 dBTP (measured on the previews) |
| Hackathon requirements | PASS | Model ids on the proof tiles, "Nebius Token Factory" under them and on the title, the spend callout and the Overview; the app works on screen throughout |
| Honest numbers | PASS (labelled) | Every number in a callout or tile is from the mock run and says "mock": ≈ $0.03, $0.024, $0.016; the proof card carries "mock run"; 19/19 kept under that tag until RELEASE.md traces it |
| End card | PASS | URL and `pnpm dev` held still 6 s (full) and 2 s after the wordmark (X, 4 s total card) |
| Palette matches the app | PASS | `video/src/theme.ts` values each cite `globals.css`, `run-view.ts` ROLE_COLOR or the Overview tiers; `scripts/qa-frames.py` on 10 frames per cut: saturated hues sit on mint (165°), writer/teal and checker/analyst, no foreign bin ≥ 2 % |
| Frame density | PASS with one exception | A frame every 2 s (87 full, 22 X): X none; full flags only 23 s, the 2 s goal close-up (the composer is at the bottom edge of the app, the page above it is empty by design). Fixed on the way: the phone now sits on the web app (lightly blurred), the plan and estimate are framed tighter |
| No click track, no raw tones | PASS | No click track exists any more (`click-120.wav` deleted, no `ClickTrack` in the code); every SFX is a cuelume render or a Tone.js design (`scripts/make-sound.mjs`); the score is Tone.js; nothing from `anoisesrc`/`aevalsrc` |
| Callout rings on target | PASS (3 clipped) | 30 callouts, middle frames in `callouts-middle-frames.png`: 27 rings sit on their element; `brief-doc` and `workstreams` (panels that run to the frame edge) and `model-badge` (at the very top of the app) are clipped by the frame edge |
| Better than the last liked cut | PASS on picture; sound not auditioned | `compare-v3-rev4-rev5.png`, rows Overview/crew · approval gate · learning, columns v3 · rev 4 · rev 5: rev 5 shows readable everyday content (Dana's contract, the brief) with a callout naming each part, where v3 shows router jargon with sentence captions and rev 4 kinetic cards. I cannot listen in this environment: the temp score and the mix are checked by waveform, spectrum and loudness only |

# Rev 5 build notes (deviations from board rev C, all forced by the take)

- **Scene 4**: the goal is 1 bar (a push from the page to the composer while it types, 1.5×) and the plan draft 6 bars, so the plan, the estimate and the tools each hold 2 bars; the planning wait between them is cut.
- **Scene 6**: starts 3 s into `brief1-doc`; the draft to Sam shows first and the brief opens after it.
- **Scene 7**: the shot starts 5.24 s before `approve-dana`, so the click lands on bar 36.
- **Scene 9**: starts 1.5 s into `memory-skill`, after the panel has loaded.
- **Scene 12**: the phone sits on the web app (the `chat-run` beat, blurred 3 px, 50 % brightness) instead of a bare background; its callout starts a bar later, after the phone's entrance.
- **Scene 13**: second half is `overview-after` (the router gauge is not on screen during `watch`).
- **Approve plan** gets no click ring: its button's position is not in `beats.json`.

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
