status: approved · 2026-10-27 · "Approve the rev 5 board, music brief and SFX sheet: build it." · rev C
frames: absolute in NimbusFull at 30 fps (X clip rows at the end)
levels: LUFS short-term at the hit, after mastering; SFX sit 3–6 dB above the bed at their moment; master −14 LUFS integrated, ≤ −1 dBTP
sources:
- **cuelume** = the app's own UI sound (cuelume 0.2.8, MIT), theme `default`, the emphasis the app uses (builder's map, docs/SOUND.md), rendered offline to WAV by `video/scripts/make-sound.mjs` through cuelume's own renderer. What the viewer hears is what the app plays.
- **designed** = a transition built in Tone.js (MIT) in the same headless page: layered filtered noise on a moving band-pass, reverb tail, pitch-falling sine under impacts, light saturation. Original, no license question.
- No metronome, no raw ffmpeg tones, no stock library in this sheet.

Rules: one cue per moment (a burst of three approvals gets one attention); no sound per streamed word, per tool call or on hover; a whoosh starts 6–10 f before its cut and peaks on it; a riser ends exactly on a downbeat; one beat of silence before the end card.

# Full cut

| # | Frame | Scene | Moment | Sound | Source | Level | File |
|---|---|---|---|---|---|---|---|
| 1 | 8 | 1 | The cloud is orange: replies are waiting | attention, normal | cuelume | −20 | `attention.wav` |
| 2 | 120–300 | 1→2 | Into the title: riser ending on the downbeat | riser, 1 bar | designed | −20 → −16 | `riser-1bar.wav` |
| 3 | 300 | 2→3 | Title lands into the Overview | impact, soft | designed | −16 | `impact-soft.wav` |
| 4 | 300 | 3 | Stat cards count up | count, 2000 ms | cuelume | −22 | `count-2s.wav` |
| 5 | ≈ 420 | 3 | Click a day on the spend chart | tap, normal | cuelume | −24 | `tap.wav` |
| 6 | 652 | 3→4 | Into chapter 1 | whoosh (mid) | designed | −20 | `whoosh-a.wav` |
| 7 | 660–780 | 4 | The goal types (one per keystroke, ≤ 1 per 3 f) | type | cuelume | −28 | `type.wav` |
| 8 | ≈ 780 | 4 | Send (composer RUN) | tap, normal | cuelume | −22 | `tap.wav` |
| 9 | `brief1-plan-arrives` (≈ 780) | 4 | The plan draft arrives | ready, subtle | cuelume | −22 | `ready-subtle.wav` |
| 10 | ≈ 900 | 4 | One step dragged | select, direction forward | cuelume | −24 | `select.wav` |
| 11 | ≈ 960 | 4 | Tools chip opens / closes | open / close, subtle | cuelume | −26 | `open-subtle.wav`, `close-subtle.wav` |
| 12 | `brief1-approve-plan` (≈ 1050) | 4 | APPROVE PLAN | tap, normal | cuelume | −22 | `tap.wav` |
| 13 | 1080 | 5 | Run started, lanes begin | loading, subtle | cuelume | −22 | `loading-subtle.wav` |
| 14 | `brief1-agent-io` (≈ 1560) | 5 | Click the Analyst segment, inspector tab | select | cuelume | −24 | `select.wav` |
| 15 | 1672 | 5→6 | Into the brief | whoosh (high) | designed | −20 | `whoosh-b.wav` |
| 16 | 1680 | 6 | The doc opens | ready, normal | cuelume | −20 | `ready.wav` |
| 17 | 1972 | 6→7 | Into chapter 2 | whoosh (low) | designed | −20 | `whoosh-c.wav` |
| 18 | 1980 | 7 | The cloud turns orange, the card needs you (one for the burst) | attention, normal | cuelume | −18 | `attention.wav` |
| 19 | **2160** | 7 | Approve, Dana (music drop 2 lands here) | success, normal + sub hit | cuelume + designed | −16 / −18 | `success.wav`, `sub-hit.wav` |
| 20 | ≈ 2280 | 7 | Approve, Priya | success, normal | cuelume | −20 | `success.wav` |
| 21 | ≈ 2370 | 7 | Approve & always allow, Sam | success, strong | cuelume | −16 | `success-strong.wav` |
| 22 | 2528 | 8 | Summary counts up (250 ms after it appears) | count, 700 ms | cuelume | −22 | `count-700.wav` |
| 23 | 2553 | 8 | 5 memories saved (1.1 s after the summary) | ready, normal | cuelume | −20 | `ready.wav` |
| 24 | 2812 | 8→9 | Into chapter 3 | whoosh (mid, new pitch) | designed | −20 | `whoosh-d.wav` |
| 25 | 2820 | 9 | Memory & skill tab | select | cuelume | −24 | `select.wav` |
| 26 | ≈ 3150 | 9 | Hover Forget (the menu opens) | open, subtle | cuelume | −26 | `open-subtle.wav` |
| 27 | `brief2-plan-arrives` (≈ 3300) | 10 | The next morning's plan, learned chip | ready, subtle | cuelume | −22 | `ready-subtle.wav` |
| 28 | ≈ 3540 | 10 | Run two done, reply sent under the rule | success, normal | cuelume | −20 | `success.wav` |
| 29 | 3592 | 10→11 | Into chapter 4 | whoosh (high, new pitch) | designed | −20 | `whoosh-e.wav` |
| 30 | 3600 | 11 | Rail click on Hackathon radar | navigate | cuelume | −24 | `navigate.wav` |
| 31 | ≈ 3780 | 11 | The status pill: radar needs you | attention, normal | cuelume | −20 | `attention.wav` |
| 32 | `pill-approve` (≈ 3900) | 11 | Approve from the pill | success, normal | cuelume | −20 | `success.wav` |
| 33 | 3952 | 11→12 | Into the phone | whoosh (slide) | designed | −20 | `whoosh-f.wav` |
| 34 | per message | 12 | Each message sent from the phone | tap, normal | cuelume | −24 | `tap.wav` |
| 35 | per reply | 12 | A reply arrives (once per reply, not per word) | ready, subtle | cuelume | −24 | `ready-subtle.wav` |
| 36 | at "Approved:" | 12 | "approve all" approved | success, strong | cuelume | −18 | `success-strong.wav` |
| 37 | 4320 | 12 | Cut to the web timeline | whoosh (short) | designed | −22 | `whoosh-g.wav` |
| 38 | 4440 | 13 | The crew proposes cheaper routing | attention, normal | cuelume | −20 | `attention.wav` |
| 39 | `watch-approve` (≈ 4560) | 13 | Approve the proposal | success, normal | cuelume | −20 | `success.wav` |
| 40 | ≈ 4620 | 13 | The router gauge moves | count, 700 ms | cuelume | −22 | `count-700.wav` |
| 41 | 4620–4740 | 13→14 | The lift into the proof tiles: riser ending on the downbeat | riser, 2 bars | designed | −20 → −16 | `riser-2bar.wav` |
| 42 | 4740, 4755, 4770 | 14 | A tile per beat | sub hit | designed | −16 | `sub-hit.wav` |
| 43 | 4860 | 14 | 19/19 counts up | count, 700 ms | cuelume | −22 | `count-700.wav` |
| 44 | 4965–4980 | 14→15 | One beat of silence | — | — | — | — |
| 45 | 4980 | 15 | Wordmark cut, end card | impact, deep | designed | −14 | `impact-deep.wav` |

# X clip (frames absolute in NimbusX)

| # | Frame | Moment | Sound | Source | Level |
|---|---|---|---|---|---|
| 1 | 8 | Cloud orange | attention | cuelume | −20 |
| 2 | 120–300 | Into the title | riser, 1 bar → soft impact on 300 | designed | −20 → −16 |
| 3 | ≈ 330 / ≈ 400 / ≈ 450 | Send · plan arrives · Approve plan | tap · ready subtle · tap | cuelume | −22 |
| 4 | 480 | Lanes start | loading, subtle | cuelume | −22 |
| 5 | 592 / 600 | Into the gate · the card needs you | whoosh (low) · attention | designed · cuelume | −20 / −18 |
| 6 | **690** | Approve, Dana (the drop) | success + sub hit | cuelume + designed | −16 / −18 |
| 7 | 772 / ≈ 800 | Into run two · the learned plan | whoosh (mid) · ready subtle | designed · cuelume | −20 / −22 |
| 8 | 952 / per message / "Approved:" | Into the phone · sends · approve all | whoosh (slide) · tap · success strong | designed · cuelume | −20 / −24 / −18 |
| 9 | 1185–1200 | One beat of silence | — | — | — |
| 10 | 1200 | End card | impact, deep | designed | −14 |

# Files

Under `video/public/audio/sfx/`, rendered by `video/scripts/make-sound.mjs` (names above). cuelume: `attention`, `tap`, `type`, `select`, `open-subtle`, `close-subtle`, `navigate`, `loading-subtle`, `ready`, `ready-subtle`, `success`, `success-strong`, `count-2s`, `count-700`. Designed: `whoosh-a` … `whoosh-g`, `riser-1bar`, `riser-2bar`, `impact-soft`, `impact-deep`, `sub-hit`. Frames marked ≈ or with a sub-beat name are placed from the new take's `beats.json` marks.
