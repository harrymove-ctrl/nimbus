# Release notes for the video

**Demo URL:** https://nimbus-production-6f7b.up.railway.app (Railway, Oct 28). It runs on the real models: `NIMBUS_MODEL=nebius`, `NIMBUS_DEV_CHEAP=0`, a $1 day cap and a $0.25 run cap. SQLite is on a Railway volume at `/data`. `/v1/chat/completions` needs the bearer token in `NIMBUS_API_TOKEN`. A smoke run there (Morning brief, cancelled after its plan) cost $0.0032.

## Status on Oct 28

There is no recorded real-model take yet. The video ships on the role-named mock take `docs/demo/raw/nimbus-demo-20261028-1258.webm`. Its numbers are fixture numbers (the scripted mock model) and must be labelled that way on screen. The real run is kept for a later day.

Real spend: about **$0.35** on Nebius Token Factory (laptop runs, plus $0.007 on the Railway demo), from the runs' own cost logs. Tavily: 0 calls. The cleared budget was $0.50. Recording stopped after the last attempt on Oct 29 (see "Take attempts"). The video ships on mock take 1258.

On screen, the numbers come from the mock take and are labelled as fixture numbers. The measured numbers below come from headless runs (no recording) and are labelled "measured in a headless run".

## Measured on the real check (Oct 28, 21:50, Token Factory, no take)

This was one headless run of Morning brief, then its next morning, with every hop on its real routed tier (`NIMBUS_DEV_CHEAP=0`). The data is in `/tmp/claude-501/real-check` (scratch; not the app's history).

| | Cost | Tokens | Baseline (every hop at its role's ceiling tier) | Saving |
|---|---|---|---|---|
| Run one | $0.0225 | 60,933 | $0.0308 | 27 % |
| Run two | $0.0288 | 81,156 | $0.0366 | 21 % |

- Model calls across both runs: 48 agent hops, plus the router's Nano classifier calls, which are not counted in the run costs.
- Run one: the Researcher reads, one Writer writes the brief and the three replies, and three sends are approved by you. Approve & always allow on the reviewer's reply saved `allow: send_message to reviewer@example.com for this workstream`.
- Run two: the reviewer's reply went out under that rule with no card (resolved by policy); the client's and the teammate's were approved by you.
- **Run two cost more than run one, not less**, because the Learner saved no memories in run one (see 6 below). The mock's "run two is cheaper" does not hold on the real models yet.
- Week cost: not measured. The app's call log for a week only exists in the dev database.

## What the real models did differently from the mock scripts, and the fix

| # | What happened on the real models | Fix | Commit |
|---|---|---|---|
| 1 | The Researcher did not know where the inbox was and asked "I don't have direct access to your email, calendar, or GitHub" | The Morning brief skill names its sources (`fixtures/inbox/*.eml`, `fixtures/calendar.ics`, `fixtures/github-notifications.json`, read with `read_repo`) | be3ddc0 |
| 2 | A Researcher that read one file per turn used all 8 turns and reported nothing, so the Orchestrator thought nothing was read | Child agents get 12 turns; the last one has no tools and asks for the report | be3ddc0 |
| 3 | Duplicate briefs (the Writer's and the Analyst's), the Analyst asking whether to send, and the Orchestrator raising its own approvals, keyed by "recipient", which a rule cannot match | The skill names the crew (Researcher reads, one Writer writes and sends) and says send_message asks for approval itself | be3ddc0 |
| 4 | The Orchestrator handed the Writer "Researcher's report: … (include the report)", so the Writer read every file again; in another run it handed off three times | Every handoff carries the crew's reports so far, for any workstream | 3e117e6 |
| 5 | The Writer drafted all three replies but never sent them (its role prompt only said to write documents), and the reviewer's draft said the fix "has shipped", which no source said | The Writer's role prompt says to call send_message once per message (it asks for approval itself) and to say only what the latest sources and reports say. The GitHub fixture says the login fix is in review, not merged | 3e117e6, be3ddc0 |
| 6 | The Learner (always Nano, thinking on) used its whole output budget thinking: at 600 tokens and at 1500 it never called save_learning; at 4000 it either ran out again or wrote the call as JSON text and was cut off mid-way | The Learner runs with thinking off (`chat_template_kwargs.enable_thinking = false`) and a required tool call. Its brief spells out the save_learning shape, and its run ends after that call. A probe call used 102 output tokens instead of 690. In headless run one (check 6), 8 memories were saved and SKILL.md was rewritten. It stays on Nano | 23f32be |
| 8 | In run two the Orchestrator raised the sends itself with `{ to, … }` instead of the Writer's `{ channel, text }`, so a saved rule could not match and the send had no address | The Orchestrator's sends are normalised (`to` or `recipient` becomes `channel`; `body` or `message` becomes `text`). The recorder approves run two's cards as they arrive until the summary shows | this commit |
| 7 | The real Writer asks for approval one reply at a time (the next card appears only after the previous one is approved); the mock asks for all three at once | Not a product bug. The recorder expected three cards at once, so its "Approve & always allow" landed on the teammate's card before the reviewer's existed, and the reviewer's reply then waited unapproved (take attempt 5). The recorder needs to approve each card as it arrives, and to put always-allow on the reviewer's card by address | open (recorder) |

The mock checks are green after every fix: eval 19/19, check:cases 27/27, budget guards, loop and learning.

## Real runs and what each was for

| Run | Cost | Purpose and result |
|---|---|---|
| Take attempt 1 (`data/real-20261028`) | $0.0042 | Stopped: the Researcher asked where the inbox was (1) |
| `pnpm smoke` | $0.0003 | One call per tier plus a Nano tool call: PASS |
| Check 1 | $0.0240 | Three drafts, no brief, no sends |
| Check 2 | $0.0102 | Empty Researcher report (2) |
| Check 3 | $0.0361 | Works, but messy (3) |
| Check 4 | $0.0692 | Run one clean; run two had duplicate handoffs (4); no memories (6) |
| Take attempt 2 (`data/real-take-20261028`) | $0.0276 | The Writer never sent (5); the recorder timed out at the first approval |
| Check 5 | $0.0513 | Runs one and two follow the flow; no memories (6) |
| Nano probe | about $0.0005 | Thinking on vs off vs /no_think, each with a required tool call: thinking off used 102 output tokens |
| Check 6 (headless run one) | $0.0276 | 75,291 tokens, baseline $0.0356 (22 % saving); three sends approved by you; the reviewer rule saved; **8 memories saved, SKILL.md rewritten** |
| Take attempt 3 (`data/real-take-20261028b`) | $0.0190 | Recorder bug: its Agent I/O fallback looked for an Analyst segment; the real crew is a Researcher and a Writer |
| Take attempt 4 (`data/real-take-20261028c`) | $0.0035 | Recorder bug: the real plan had fewer than 4 steps and the recorder dragged step 4 |
| Take attempt 5 (`data/real-take-20261028d`) | $0.0208 | The recorder expected three approval cards at once (7); the run waited on the reviewer's reply and timed out before its summary |
| Take attempt 6, the last (`data/real-take-20261029`, Oct 29) | $0.0455 | **Run one completed on camera**: $0.0258, 70,163 tokens, baseline $0.0355 (27 % saving), 8 memories saved. Run two stopped at the recorder's 300 s timeout: its sends came from the Orchestrator one at a time, and the recorder approved only the first (8) |

## Take attempts

None of the six recording attempts produced a full take. Attempts 1 and 2 stopped on real-model behaviour (1, 5). Attempts 3 to 5 stopped on recorder assumptions taken from the mock scripts. Attempt 6 recorded run one in full and stopped in run two (8). Every product bug found along the way is fixed and committed (1 to 6). The one thing left is in the recorder (7). The data directories of all five attempts are kept under `data/`.

## Video (locked 2026-10-28, "Lock them", rev 6, commit 36922cb)

Script rev 6, board rev E, music rev D. Two compositions at 1920 × 1080, 30 fps, 120 BPM: NimbusFull (88 bars) and NimbusX (22 bars).

### Files

| File | Duration | Size | Picture | Audio |
|---|---|---|---|---|
| `video/out/nimbus-full.mp4` | 2:56.1 | 82.5 MB | 1920 × 1080, h264 crf 17 | AAC 256k, −13.8 LUFS, −1.8 dBTP, LRA 8.3 |
| `video/out/nimbus-full-4k.mp4` | 2:56.1 | 188.8 MB | 3840 × 2160, h264 crf 17 (`--scale=2`) | AAC 256k, −13.8 LUFS, −1.8 dBTP, LRA 8.3 |
| `video/out/nimbus-x.mp4` | 0:44.1 | 16.3 MB | 1920 × 1080, h264 crf 17 | AAC 256k, −13.7 LUFS, −1.8 dBTP, LRA 7.1 |
| `docs/demo/preview/nimbus-full-preview.mp4` | 2:56.1 | 19.8 MB | 1280 × 720 | as the master |
| `docs/demo/preview/nimbus-x-preview.mp4` | 0:44.1 | 4.3 MB | 1280 × 720 | as the master |
| `docs/demo/gallery/gallery-1.png` … `gallery-5.png` | — | 0.3–1.0 MB | 1920 × 1080, from `nimbus-full.mp4` | — |
| `docs/demo/preview/motion-frames.png` | — | — | one still per motion scene (12) | — |

`video/out/` is gitignored, so the masters live on the Dev volume only. Loudness is measured on each file with ffmpeg `loudnorm` (integrated, true peak, LRA), after `video/scripts/master.sh` (two-pass loudnorm to −14 LUFS, then a true-peak limiter).

Gallery frames (SUBMISSION.md "Devpost gallery"):
1. Frame 200 (0:06.7): the hook, "every run." in the orb loop.
2. Frame 1260 (0:42): the timeline, "One row per agent".
3. Frame 2283 (1:16.1): the gate, the drawn tick on Approve. The "Sending is an action" card closes a beat before the click, so they never share a frame.
4. Frame 4760 (2:38.7): the three Nemotron tiles over the call scatter, the Token Factory endpoint line, and "One morning: $0.0276 · 22 % saved by the router".
5. Frame 4290 (2:23): the phone stack, "approve all" → "Approved".

### Take and numbers

- **Footage:** the mock take `docs/demo/raw/nimbus-demo-20261028-1258.webm` (1920 × 1080, role-named contacts, the scripted mock model) in every file. The 4K master upscales it 2×, because the composition renders at scale 2. No real-model take exists (see "Take attempts"). If one lands, `video/scripts/sync-take.mjs` swaps it in.
- **Numbers in the callouts and motion scenes,** measured in the Oct 28 headless real runs on Nebius Token Factory (above), with no tag on the frame (the planner's instruction of 22:30):
  - Plan estimate ≈ $0.0276 and "The whole morning" $0.0276: check 6, run one.
  - Router savings 22 %: check 6, against a baseline of $0.0356.
  - Run two $0.0288: check 5. It costs more than run one, so the callout says "Same brief, using what it learned", not "cheaper".
  - 8 memories: check 6.
  - Metric Morph's 26 bars: check 6's run one, hop by hop.
  - The proof line "One morning: $0.0276 · 22 % saved by the router": check 6.
- **The footage itself still shows the mock take's own figures** ($0.024 summary tile, $0.016 run-two header, ≈ $0.03 plan chip). Scatter Bloom plots the dev database's mock call log, with no count shown.
- **The chat phones** show the old-fixture `/v1` transcript (`docs/video/chat-transcript.json`), with the three addresses mapped to take 1258's role addresses.
- **Same in every file:** the full, 4K and X renders all carry this footage and these numbers.

### Music

The user's own Suno generation, variant A "Glassy Arpeggio" (`video/public/audio/music-full.mp3`, 208 s, not redistributed: gitignored, and not in the public repo).

`video/scripts/fit-music.py` stretches it from its measured 122.09 BPM to 120 (pitch kept) and cuts it onto the bar lines:
- Full cut, four segments: entries on 0:12, 0:38, 1:16 (the first Approve, frame 2280), 2:04 and 2:40; the track's own ending on 2:56.
- X clip, three segments: entries on 0:08 and 0:23 (frame 690).

In the mix the bed sits about −18 LUFS under footage. It ducks 3 dB under every sound cue and comes back +3 dB on the drop and the finale. Details are in `docs/video/music.md`, "Fit".

### Sound effects

Every cue is in `docs/video/sfx.md` (the rev E cue sheet), rendered offline by `video/scripts/make-sound.mjs`:
- **UI sounds:** the app's own [cuelume](https://www.npmjs.com/package/cuelume) cues (0.2.8, MIT): attention, tap, type, select, open, navigate, loading, ready, success, count.
- **Transitions:** designed in Tone.js (MIT) for this video: whooshes, risers, impacts, sub hits, bells, the marker scribble, morph, orbit, orb bursts, block flashes, lid, word drops, slot rolls, dry cut. These are original sounds, so no third-party licence applies.

No stock library, no metronome.

### Not verified

The sound has not been checked by ear in the video session.
