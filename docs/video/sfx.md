status: approved · 2026-10-27 · "Approve the rev 5 board, music brief and SFX sheet: build it." · rev C
rev D (motion layer, board rev D, 2026-10-28): rows 46–56 added, the rows they replace or move are listed under "Rev D changes"; the rev C rows above stay as the record
rev E (script rev 6, board rev E, music rev D, 2026-10-28): the cut is rebuilt, so the cue sheet that plays is "Rev E cue sheet" below (rows E1–E37 and X1–X12); rows 1–56 above it stay as the record of the rev C/D cuts. New designed files: `orb-burst`, `block-flash`, `lid-open`, `word-drop`, `slot-roll`, `cut-dry`. The terminal's keys are the app's own cuelume `type`.
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

# Rev D changes (motion layer)

Each motion scene enters on a downbeat with its own designed sound (Tone.js, `make-sound.mjs`, rendered with `node scripts/make-sound.mjs new` so the rev C files stay byte for byte).

| # | Frame | Scene | Moment | Sound | Source | Level | File |
|---|---|---|---|---|---|---|---|
| 46 | 240 | 2 | Lockup Reveal: the cut to the boot sky | bells, E5 B5 E6 G♯6 | designed | −18 | `lockup-chime.wav` |
| 47 | 656 | 3→4 | Punch Lines: "You ask." flicks in (replaces 6; 7 and 8 go with the goal shot) | whoosh, falling 3.2 k → 700 | designed | −18 | `punch-whip.wav` |
| 48 | 690 | 4 | The hero line punches up | thud | designed | −18 | `punch-thud.wav` |
| 49 | 1988 | 7 | Text Highlight: the marker wipes "without you." (replaces 17) | scribble | designed | −20 | `marker.wav` |
| 50 | 2520 | 7→8 | Metric Morph: the pill collapses (suck into the slam) | suck | designed | −20 | `morph-suck.wav` |
| 51 | 2554 | 8 | The square slams in as the tallest bar | impact, short | designed | −16 | `morph-slam.wav` |
| 52 | 2820 | 8→9 | Focus Pull: the glyphs pull into focus (replaces 24) | shimmer | designed | −20 | `focus-shimmer.wav` |
| 53 | 3600 | 10→11 | Orbit Flow: the orbits draw in (replaces 29) | whoosh, low swell | designed | −20 | `orbit-swell.wav` |
| 54 | 3706 | 11 | The inner orbit winds up and whips into the radar | suck, high | designed | −18 | `orbit-suck.wav` |
| 55 | 3960 | 11→12 | Screen Wall: the camera backs out of the phones (replaces 33) | whoosh, falling 2.4 k → 300 | designed | −18 | `wall-tunnel.wav` |
| 56 | 4744 | 14 | Scatter Bloom: the calls bloom onto the plane | bells, C6–E7 run | designed | −22 | `bloom-sparkle.wav` |

Moved by the motion bars (same sounds): 18 attention → 2000 (the cloud turns orange in the Text Highlight); 19 Approve (Dana) stays on **2160**; 22 / 23 → 2588 / 2613; 25 → 2940; 26 → 3150; 30 → 3720; 31 → 3820; 32 → `pill-approve` ≈ 3900; 34–36 from 4080 (the phone plays "run morning brief" → "approve all"); 37 → 4314; 42 → 4860, 4875, 4890 (the tiles land on the plane); 43 → 4920; 45 → 4980 on the Lockup reprise. X clip: 46 at 240; row 8's whoosh is `wall-tunnel` at 960, the phone from 1020.

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

# Rev E cue sheet (plays in the rev E cuts)

Frames absolute in NimbusFull (scene starts: hook 0, name 240, overview 360, ch1 720, plan 780, timeline 1140, doc 1740, ch2 2100, gate 2160, summary 2700, ch3 3000, memory 3060, run2 3420, ch4 3720, radar 3780, chat 4080, web run 4320, watch 4440, proof 4620, terminal 4800, end 4980). Frames marked ≈ follow the take's sub-beats and move with the real-model take. The drop of the music lands on E17 (the fitted Suno track's S48 entry, measured +13 ms). With the Suno fit no cue moves: E2's riser still lands on the track's first entry at 360, and E37's impact lands under the finale.

| # | Frame | Scene | Moment | Sound | Source | Level | File |
|---|---|---|---|---|---|---|---|
| E1 | 2, 62, 122, 182 | 1 | An orb burst per line, a step higher each (×1, 1.12, 1.26, 1.5) | bells, two glassy notes | designed | −24 | `orb-burst.wav` **new** |
| E2 | 300–360 | 2→3 | Into the laptop | riser, 1 bar, lands on E5 | designed | −20 | `riser-1bar.wav` |
| E3 | 298–318 | 2 | The six block flashes, a step up each | bell tick | designed | −26 | `block-flash.wav` **new** |
| E4 | 332 | 2 | The cloud lands beside the name | ready, subtle | cuelume | −24 | `ready-subtle.wav` |
| E5 | 360 | 3 | Onto the laptop (the riser's landing) | impact, soft | designed | −18 | `impact-soft.wav` |
| E6 | 362 | 3 | The lid opens | whoosh, low rising | designed | −22 | `lid-open.wav` **new** |
| E7 | 409 | 3 | The notch: "Morning brief · ran 08:00" | attention | cuelume | −22 | `attention.wav` |
| E8 | 417 | 3 | The dive into the screen | whoosh (a) | designed | −22 | `whoosh-a.wav` |
| E9 | 435 | 3 | The stat cards count up | count 2 s | cuelume | −24 | `count-2s.wav` |
| E10 | 738–758 | 4 | The five words drop in | soft thud ×5 | designed | −26 | `word-drop.wav` **new** |
| E11 | 794–866 | 5 | The goal types into the composer (one key per 6 f) | type | cuelume | −30 | `type.wav` |
| E12 | 880 | 5 | Send | tap | cuelume | −22 | `tap.wav` |
| E13 | ≈ 907 / ≈ 1099 | 5 | The plan arrives · Approve plan (the drawn tick) | ready subtle · tap + select | cuelume | −22 / −24 | |
| E14 | 1140 / ≈ 1620 | 6 | The lanes start · Agent I/O opens | loading subtle · select | cuelume | −22 / −24 | |
| E15 | 1732 / 1740 | 7 | Into the brief | whoosh (b) · ready | designed · cuelume | −22 / −20 | |
| E16 | 2108 / 2145 | 8 | The marker wipes "without you." · the cloud turns orange on beat 4 | scribble · attention | designed · cuelume | −20 / −18 | `marker.wav` |
| E17 | **2280** | 9 | The first Approve (the drawn tick) = **music drop 2** | success + sub hit | cuelume + designed | −16 / −18 | |
| E18 | ≈ 2370 / ≈ 2490 / ≈ 2600 | 9 | Take 1915: the second and third Approve (shots B, C) · Approve & always allow (shot D), each card in its own shot cut on a downbeat | success · success · success strong | cuelume | −20 / −20 / −16 | |
| E19 | 2700 / 2734 | 10 | Metric Morph: the pill collapses · slams in as the tallest bar | suck · short impact | designed | −20 / −16 | |
| E20 | 2768 / 2793 | 10 | The summary tiles count · settle | count 700 · ready | cuelume | −22 / −20 | |
| E21 | 3000 | 11 | The ticked box | success, quiet | cuelume | −28 | `success.wav` |
| E22 | 3000, 3011, 3021, 3031 | 11 | The four slot rolls, a step up each | short high whoosh | designed | −26 | `slot-roll.wav` **new** |
| E23 | 3060 / 3300 | 12 | Memory opens · hover Forget | select · open subtle | cuelume | −24 / −26 | |
| E24 | 3430 / 3600 | 13 | The learned plan · run two ends cheaper | ready subtle · success | cuelume | −22 / −20 | |
| E25 | 3720 / ≈ 3826 | 14 | Orbit Flow draws in · winds up and whips into the radar | low swell · high suck | designed | −20 / −18 | |
| E26 | 3780 / 3910 / ≈ 4040 | 15 | The rail · the pill needs you · approve from the pill | navigate · attention · success | cuelume | −24 / −20 / −20 | |
| E27 | 4099, 4129, 4159, 4189, 4219 | 16 | A phone lands per message: tap for yours, ready for its replies | tap · ready subtle | cuelume | −24 | |
| E28 | 4249 | 16 | The last phone: "Approved" | success strong | cuelume | −18 | |
| E29 | 4320 | 17 | Hard cut to the web run | short dry impact | designed | −20 | `cut-dry.wav` **new** |
| E30 | 4440 / ≈ 4515 / 4560 | 18 | The routing proposal · approved · the gauge counts | attention · success · count 700 | cuelume | −20 / −20 / −22 | |
| E31 | 4624 | 19 | Scatter Bloom: the calls bloom | bells run | designed | −22 | `bloom-sparkle.wav` |
| E32 | 4680, 4695, 4710 | 19 | A model tile lands per beat | sub hit | designed | −16 | `sub-hit.wav` |
| E33 | 4744 | 19 | The call count and spend count up | count 700 | cuelume | −22 | `count-700.wav` |
| E34 | 4808–4904 | 20 | The terminal types (one key per 3 f) | type | cuelume | −32 | `type.wav` |
| E35 | 4910 | 20 | The URL line | ready | cuelume | −20 | `ready.wav` |
| E36 | 4965–4980 | — | One beat of silence (cut into the fitted Suno track by `fit-music.py`, music.md "Fit") | — | — | — | |
| E37 | 4980 | 21 | The end card | impact, deep | designed | −14 | `impact-deep.wav` |

## X clip, rev E (frames absolute in NimbusX; scenes: hook 0, name 120, plan 240, lanes 420, ch2 540, gate 600, run2 720, chat 900, terminal 1140, end 1200)

| # | Frame | Moment | Sound | Source | Level |
|---|---|---|---|---|---|
| X1 | 2, 32, 62, 92 | Orb bursts | bells | designed | −24 |
| X2 | 180–240 | Into the plan | riser, 1 bar, lands on X4 | designed | −20 |
| X3 | 178–198 / 212 | Block flashes · the cloud lands | bell tick · ready subtle | designed · cuelume | −26 / −24 |
| X4 | 240 | Into the plan | impact, soft | designed | −18 |
| X5 | ≈ 248 / ≈ 409 | Plan arrives · Approve plan | ready subtle · tap | cuelume | −22 |
| X6 | 420 | Lanes start | loading subtle | cuelume | −22 |
| X7 | 548 / 585 | Marker · the cloud turns orange | scribble · attention | designed · cuelume | −20 / −18 |
| X8 | **690** | Approve (the drop) | success + sub hit | cuelume + designed | −16 / −18 |
| X9 | 712 / 730 | Into run two · the learned plan | whoosh (d) · ready subtle | designed · cuelume | −22 / −22 |
| X10 | 919 / 979 / 1039 | Three phones: the reply · "approve all" · "Approved" | ready subtle · tap · success strong | cuelume | −24 / −24 / −18 |
| X11 | 1144–1180 | The terminal types | type | cuelume | −32 |
| X12 | 1125–1140 / 1200 | One beat of silence · the end card | — · impact, deep | designed | — / −14 |

# Files

Under `video/public/audio/sfx/`, rendered by `video/scripts/make-sound.mjs` (names above). cuelume: `attention`, `tap`, `type`, `select`, `open-subtle`, `close-subtle`, `navigate`, `loading-subtle`, `ready`, `ready-subtle`, `success`, `success-strong`, `count-2s`, `count-700`. Designed: `whoosh-a` … `whoosh-g`, `riser-1bar`, `riser-2bar`, `impact-soft`, `impact-deep`, `sub-hit`; rev D `lockup-chime`, `punch-whip`, `punch-thud`, `marker`, `morph-suck`, `morph-slam`, `focus-shimmer`, `orbit-swell`, `orbit-suck`, `wall-tunnel`, `bloom-sparkle`; rev E `orb-burst`, `block-flash`, `lid-open`, `word-drop`, `slot-roll`, `cut-dry`. Frames marked ≈ or with a sub-beat name are placed from the new take's `beats.json` marks.
