# Music and sound

No voice. Music carries the arc; sound effects make the edits and the UI
feel physical. X autoplays muted, so the picture must work without any of
this; the sound is for the viewers who tap for audio and for the judges.

## Beat grid

Pick the BPM first; the script's bar column depends on it. At 30 fps these
give whole frames per beat:

| BPM | Frames / beat | Frames / bar (4/4) | Seconds / bar |
|---|---|---|---|
| 90 | 20 | 80 | 2.67 |
| 120 | 15 | 60 | 2.0 |

Default 120 (energetic, simple math). Every scene is a whole number of bars;
cuts land on downbeats; title text enters on beat 1 and leaves on beat 4.

## Suno brief (`docs/video/music.md`)

Give the user three style variants to try (A/B/C), each a complete paste,
not one guess: a minimal glassy electronic, a warm melodic house, and a
cinematic synth score. Each style field names: genre and sub-genre, BPM and
feel, key or mode mood, three to five lead instruments with adjectives,
drums described concretely (kick character, hat pattern, claps or not),
production words (wide stereo, sidechain pump, tape warmth, clean low end),
and the arc in five words. Use section tags with short descriptors in
brackets in the lyrics field, `[Instrumental]` first, `[Break]` for the
silences, `[Fade Out]` or a clean `[End]`. Tell the user which settings to
use (instrumental on, length, extend until the map is covered, keep the take
whose drop lands nearest the hero moment).

Write it ready to paste. Suno makes vocals by default, so instrumental is
stated three ways. Never name an artist or a song (Suno refuses them, and
it is a rights risk); describe instruments, mood and arrangement instead.

```
Title: Nimbus — full cut (2:52)

Style of music (paste as is):
instrumental, minimal electronic, 120 bpm, warm analog synth pads, soft plucked
arpeggio, deep clean sub bass, crisp light percussion, airy textures, optimistic,
cinematic build, clean modern tech launch, no vocals

Exclude styles:
vocals, singing, voice, spoken word, choir, rap, humming, lyrics

Lyrics / structure (paste as is):
[Instrumental]
[Intro: soft pad, no drums, 8 bars]
[Build: pluck arpeggio enters, light hats, 16 bars]
[Drop: full beat, warm and bright, 16 bars]
[Breakdown: half-time, tension, filtered, 8 bars]
[Drop 2: full beat, bigger, 16 bars]
[Bridge: calm pad, 8 bars]
[Final lift: riser into last chorus, 8 bars]
[Outro: one sustained chord, 6 bars, clean ending]
[End]
```

Then add the **section map**: each Suno section's start time next to the
scenes it scores (the Breakdown must sit under the approval gate, where the
cloud turns orange; the Drop 2 lands on "Approve"). Settings to note: length
(extend in Suno until it covers the cut plus 4 s), generate several, keep the
one whose drop lands nearest the gate; if stems are available, export them so
the sub can be lowered under dense SFX.

X clip: a second short brief (44 s at 120 BPM = 22 bars): intro 2, build 4,
drop 12, outro 4, same style text. Or cut it from the full track at section
boundaries; note which.

## SFX and transition cue sheet (`docs/video/sfx.md`)

One row per sound:

| # | Frame | Scene | Type | Intent | Level (LUFS short-term) | File | Source · license |
|---|---|---|---|---|---|---|---|

Types and how to use them:

| Type | Where | Rule |
|---|---|---|
| Whoosh | Every transition between parts | Starts 6–10 frames before the cut, peaks on the cut; vary pitch so no two in a row sound the same |
| Riser | Into a title or the logo sting | 1–2 bars long, ends exactly on the downbeat |
| Impact / sub hit | Logo sting, the big numbers | On the downbeat, short tail, duck the music 3 dB under it |
| UI click | Each on-screen click that matters | Quiet (−24), crisp, on the frame the button presses |
| Tick | Checklist ticks, counters | Pitch up a semitone per tick in a sequence |
| Glitch | The ✕ failure in the crew scene | 4–8 frames, paired with the snap zoom |
| Soft chime | Approval, success, the cloud turning blue again | Bright, short, one per moment |
| Swish / drag | Reordering a plan step | Follows the drag duration |
| Silence | One beat before the logo and before the end card | Drop the music for 1 beat for punch |

Sources: use only sounds with a license that allows a published video
(CC0 preferred). Record source and license in the sheet; the release notes
list them. If the user generates SFX themselves, the sheet is their shot list.

## Where sounds come from (quality bar)

A metronome or raw sine beeps make a video sound cheaper than silence. A
cut with no audio at all beat a cut with a click track and synthesized
tones in front of this user. So:

1. **Never render the click track.** It is an editing guide only; it lives in
   Remotion Studio, muted in every render. Until real music exists, render a
   temp score (below) or no music.
2. **UI and app moments use the app's own sounds.** Nimbus uses cuelume
   (MIT, 14 cues synthesized with Web Audio: tap, type, select, toggle, open,
   close, navigate, success, warning, error, loading, ready, attention,
   count). Render each cue the video needs to WAV in headless Chromium
   (an OfflineAudioContext, or a MediaStreamDestination recorder) with the same
   theme and emphasis the app uses, so what the viewer hears in the video is
   what the app actually sounds like. Map: clicks → tap; typing → type; plan
   ticks and roll steps → select; approve → success (strong on the hero
   approve); the cloud turning orange → attention; ✕ → error; run start →
   loading; run done / doc ready → ready; counters → count with the counter's
   duration.
3. **Transitions are designed, not generated from raw tones.** Whooshes,
   risers, impacts and sub hits are built in Tone.js in the same headless page
   (layered filtered noise with a moving band-pass, a short convolution or
   freeverb tail, a pitch-falling sine under impacts, saturation), or taken
   from a licensed library. Each one is auditioned against the music before
   it ships. No bare `sine` or `anoisesrc` from ffmpeg in a final mix.
4. **A temp score is better than nothing.** If the Suno track is not ready
   for a preview, compose a short temp bed in Tone.js that follows the
   section map (pad + pluck arpeggio + soft kick/hat at 120 BPM, drops and
   breaks where the map says) and label the preview "temp music". It is
   replaced by the user's Suno track before the final.
5. **Compare with the last cut the user liked** before Gate 3: same scene,
   both cuts, sound on. If the new one is worse anywhere, fix it first.

## Mix targets

- Master: −14 LUFS integrated, true peak ≤ −1 dBTP (YouTube and X).
- Music bed sits about −18 LUFS short-term under footage, −14 on title cards.
- SFX peaks above the music by 3–6 dB at their moment, never clipping.
- No sound for sound's sake: if a moment has no story reason, it stays quiet.
