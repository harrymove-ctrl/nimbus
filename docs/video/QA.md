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
