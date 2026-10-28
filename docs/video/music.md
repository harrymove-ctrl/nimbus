status: approved · 2026-10-28 · "Approve rev 6" · rev D (for script rev 6; the rev C map for the built rev 5 cut is in git history: f54a32a)
bpm: 120 · 4/4 · key: pick by ear; keep the take whose second drop lands nearest 1:16
length: full cut 2:56 (88 bars) + a 1-bar tail = 2:58; X clip 0:44 (22 bars) + tail

# How to use this in Suno

1. Create → Custom. Turn **Instrumental** on.
2. Paste one variant's **Style**, the shared **Exclude**, and the **Structure** into the lyrics box.
3. Generate 2–4 takes per variant. Keep the take whose sections land nearest the map below. Extend until it covers 3:00.
4. Do the same with the X-clip structure (0:46).
5. Save as `video/public/audio/music-full.mp3` and `music-x.mp3` (320 kbps MP3 or WAV). If your plan exports stems, also drop `music-full-stems/` (drums, bass, other) so the sub can duck under the impacts.

Start with **A**. If it feels too cold, try **B**. If it needs more drama, try **C**.
Never name an artist or a song in any field.

## Variant A · glassy minimal electronic (closest to the app's look)

```
instrumental minimal electronic, 120 bpm, four on the floor, glassy plucked synth arpeggio, warm analog pad, deep round sub bass, soft felt kick, crisp closed hi-hats, light rim clicks, subtle sidechain pump, wide stereo, clean low end, modern tech launch, curious to hopeful to confident, bright final drop, no vocals
```

## Variant B · warm melodic house (friendlier)

```
instrumental melodic house, 120 bpm, warm rhodes chords, bright marimba-like plucks, rolling bassline, round soft kick, shuffled open hats, gentle claps on 2 and 4, airy pads, tape warmth, wide stereo, sunny morning mood, uplifting, clean mix, no vocals
```

## Variant C · cinematic synth score (more drama)

```
instrumental cinematic electronic score, 120 bpm, pulsing arpeggiated analog synths, evolving warm pads, deep sub swells, tight electronic drums, clean risers and soft impacts, tension and release, modern product film, optimistic, ends on a sustained major chord, no vocals
```

## Exclude (all variants)

```
vocals, singing, voice, spoken word, choir, rap, humming, lyrics, vocal chops, vocal samples, crowd, laughter, lo-fi hiss, distorted guitar
```

## Structure for the full cut (lyrics box, all variants)

```
[Instrumental]
[Intro: soft keys, single glassy pluck, no drums, calm morning]
[Build-up: rising filter, a short riser, lands on a soft hit]
[Groove: pluck arpeggio, light kick and hats, curious]
[Verse: steady, lighter, a few layers]
[Drop: full beat, bright and warm, busy and confident]
[Verse: lighter, fewer layers]
[Breakdown: filtered, low, tense, waiting]
[Drop: full beat returns hard]
[Groove: steady, satisfied]
[Calm: pad only, quiet, gentle, thoughtful]
[Groove: friendly, light drums back]
[Playful: bouncy plucks, soft percussion, conversational]
[Build-up: warm, rising, hopeful]
[Lift: riser, drums building]
[Finale: biggest section, full and bright]
[Break: one beat of silence]
[Outro: one sustained warm chord, ring out]
[End]
```

## Structure for the X clip (0:46)

```
[Instrumental]
[Intro: soft keys, single glassy pluck]
[Build-up: short riser, lands on a soft hit]
[Verse: steady, light]
[Breakdown: filtered, tense, waiting]
[Drop: full beat, bright, confident]
[Break: one beat of silence]
[Outro: one sustained chord, ring out]
[End]
```

# Section map, full cut (where each section must sit)

| Section | Time | Bars | Scenes it scores | Why |
|---|---|---|---|---|
| Intro | 0:00–0:08 | 0–4 | 1 the orb sentence | Calm, curious: one line per bar |
| Build-up | 0:08–0:12 | 4–6 | 2 the name | A short riser into a soft hit on 0:12 |
| Groove | 0:12–0:24 | 6–12 | 3 Overview | Steady while the numbers count up |
| Verse | 0:24–0:38 | 12–19 | 4–5 the goal and the plan | Light: you are deciding |
| Drop | 0:38–0:58 | 19–29 | 6 the timeline fills | Energy while the crew works |
| Verse | 0:58–1:10 | 29–35 | 7 the brief | Lighter: reading |
| Breakdown | 1:10–1:16 | 35–38 | 8 "Nothing leaves without you", the cloud turns orange | Tension: it is waiting for you |
| **Drop 2** | **1:16**–1:30 | 38–45 | 9 the first Approve and the rest | The release lands on the click |
| Groove | 1:30–1:40 | 45–50 | 10 the summary | Satisfied |
| **Calm** | 1:40–1:54 | 50–57 | 11–12 "It learns", Memory & skill | Quiet, thoughtful |
| Groove | 1:54–2:04 | 57–62 | 13 run two | Friendly, back on its feet |
| Playful | 2:04–2:28 | 62–74 | 14–17 always on, chat app | Conversational |
| Build-up | 2:28–2:34 | 74–77 | 18 its own bill | Rising |
| **Lift** | 2:34–2:40 | 77–80 | 19 the proof | Riser into the terminal |
| Finale | 2:40–2:45.5 | 80–82¾ | 20 run it | Biggest |
| Break | 2:45.5 | ¼ | — | One beat of silence before the end card |
| Outro | 2:46–2:58 | 83–89 | 21 end card + 1-bar tail | One chord rings while the URL holds |

# Section map, X clip

| Section | Time | Bars | Scenes |
|---|---|---|---|
| Intro | 0:00–0:06 | 0–3 | 1 cold open |
| Build-up | 0:06–0:10 | 3–5 | 2 title |
| Verse | 0:10–0:16 | 5–8 | 3 the plan |
| Groove | 0:16–0:20 | 8–10 | 4 lanes fill |
| Breakdown | 0:20–0:23 | 10–11½ | 4 the cloud turns orange |
| **Drop** | **0:23**–0:37.5 | 11½–18¾ | 4 the first Approve → 5 run two → 6 chat |
| Break | 0:37.5 | ¼ | — |
| Outro | 0:38–0:46 | 19–23 | 7 terminal, end card + tail |

The edit nudges each drop onto its click by at most half a beat. The click times come from the take's sub-beats (`approve-1`); see board.md "From the new take".

# Until the Suno track exists

Previews use a temp score composed in Tone.js on this same map (`video/sound/music-map.json`, rendered by `video/scripts/make-sound.mjs`) and are labelled "temp music". The metronome is never rendered.
