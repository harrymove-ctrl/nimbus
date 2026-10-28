---
name: nimbus-video
description: Gated workflow for Nimbus demo and launch videos — the hackathon submission cut (≤ 3:00) and a ~45 s X clip cut from it. Starts with a short script the user must approve, then designs the animation components (titles, captions, device frames, logo stings, whole scenes), writes an instrumental music brief for Suno plus a sound-effects and transition-sound cue sheet, then builds and QA-checks the cut in Remotion. Use this skill whenever anyone asks to make, script, re-cut, re-render, polish, add music or sound to, caption, or re-record a Nimbus video, demo, trailer, launch clip or X post video, even if they only say "make the video" or "update the demo".
---

# Nimbus video

A video for Nimbus is a short story told with pictures, on-screen words and
music. There is **no voice**: the picture and the words carry the story, and
the music and sound effects carry the energy. The user writes music with Suno
from the brief this skill produces, so the brief has to be precise.

The workflow has three gates. A gate means: present the work, ask, and stop.
The user has said plainly that nothing moves to the next stage until they
approve, because a beautiful render of the wrong script is wasted hours.

```
1 Brief ─► 2 Script ─► GATE 1 ─► 3 Look & sound board ─► GATE 2 ─► 4 Build ─► 5 QA ─► GATE 3 ─► 6 Final
```

State lives in files, so a different session (or a later day) can pick up
exactly where the last one stopped:

| File | Written in | Holds |
|---|---|---|
| `docs/video/script.md` | Step 2 | The script, with `status: draft` or `status: approved · <date> · "<user's words>"` |
| `docs/video/board.md` | Step 3 | Components per scene, captions choice, the beat grid |
| `docs/video/music.md` | Step 3 | The Suno brief(s) |
| `docs/video/sfx.md` | Step 3 | The sound-effects and transition cue sheet |
| `video/` | Step 4 | The Remotion project (compositions `NimbusFull`, `NimbusX`) |

Before doing anything, read these files if they exist and resume from the
first step whose gate is not yet passed. Never skip ahead because the user
sounds in a hurry; ask the one question that unblocks the gate instead.

**The checklist.** `references/checklist.md` is the user's own list of what
a Nimbus video must and must not do, one section per gate (A before
planning, B at Gate 1, C–E at Gate 2, F at Gate 3, G for the hand-off), plus
the catalogue of effects they named with where each belongs. At each gate,
tick its section out loud in the message; a line that cannot be ticked is
reported by name. It came from their review of the rev 5 cut: read it
before the script, not after.

## Step 1 · Brief (a few lines, ask only what is missing)

Collect, from the conversation and the repo first, and ask only for gaps:
- **Cuts**: the full hackathon cut (≤ 3:00, 1920 × 1080) and the X clip
  (~45 s, cut from the full one; 16:9 by default, 4:5 if the user wants more
  feed space on phones). Other cuts only if asked.
- **The one thing a stranger should remember.** One sentence.
- **Proof available**: which numbers are measured on real models and which
  are mock. Mock numbers never appear unlabeled in a submission cut.
- **Footage**: which raw takes exist under `docs/demo/raw/` and their
  `beats.json`; whether new footage is needed.
- **Hard requirements**: for the hackathon, the cut must visibly show NVIDIA
  Nemotron and Nebius Token Factory in use (model ids on screen, the Token
  Factory name on a card) — see `docs/SUBMISSION.md`.

## Step 2 · Script

Read `references/story.md` before writing. The short version of why the
rules are there: people decide in the first seconds, usually with the sound
off; strangers care about their problem, not our product name; numbers they
can check beat adjectives they can't.

Write `docs/video/script.md` from `assets/script-template.md`:
- One table per cut. Columns: time · bars · picture · on-screen words · sound.
- Lay scenes on a **beat grid** (see `references/sound.md`): every scene is a
  whole number of bars, so cuts land on the music.
- On-screen words: at most 8 words per line, at most one new line every 3 s,
  plain language, no "introducing", no adjectives that a number can replace.
- Frame 1 is the payoff (the result already happening), never a logo.
- The last 4–6 s show where to go: the repo URL and the one command, held
  still long enough to read.
- The X clip reuses scenes from the full cut; mark which full-cut scene each
  X scene comes from, so it is a cut, not a second production.
- Total on-screen words for the full cut: about 120 at most. Count them and
  write the count at the top.

Set `status: draft`. Then **Gate 1**.

### Gate 1 · script approval

Show the user the script (the file, plus a compact scene list in the
message), and ask one question: approve as written, or what to change.
Also ask the captions question now, because it changes the layout:

> Captions band at the bottom (the on-screen line repeated under the footage),
> or no captions (words only on the title cards between shots)?

Ask it every time, even if a previous video had captions; the user wants to
decide per video. Stop and wait. When the user approves, write
`status: approved · <date> · "<their exact words>"` at the top of the file.
Edits requested → revise, keep `draft`, ask again.

## Step 3 · Look and sound board

Only after Gate 1. Read `references/components.md` and `references/sound.md`.

1. **Components, scene by scene** → `docs/video/board.md`. For each scene:
   the component (title, caption, device frame, logo sting, kinetic type,
   whole scene, screen recording with camera move), the snapcn component or
   the custom one to build, its motion (in, hold, out, with frame counts on
   the beat grid), and what moves on screen at every moment. The rule of the
   board: no shot holds still for more than 2 s, and every motion has a
   reason in the story.
2. **Captions**: apply the user's Gate 1 answer. If on, use the bottom band
   spec in `references/components.md` (the footage shrinks so captions
   never cover it).
3. **Music brief** → `docs/video/music.md`, from the template in
   `references/sound.md`: BPM, length, section map aligned to the scene
   timestamps, Suno "style" and "exclude" fields, the structure field with
   section tags and `[Instrumental]`, and a version for the X clip.
4. **SFX and transition cue sheet** → `docs/video/sfx.md`: one row per
   sound with its frame, type, intent, target loudness and source/license.
   Transition sounds get the most care (see `references/sound.md`).

Then **Gate 2**: present the board summary, the Suno prompt (ready to paste),
and the cue-sheet highlights. Ask: build it, or change what. Stop and wait.

## Step 4 · Build

Only after Gate 2. Read `references/build-qa.md`. In `video/` (Remotion):
compositions `NimbusFull` and `NimbusX` share scene components; the X
composition re-times the same scenes. Music file and SFX files go in
`video/public/audio/` exactly as named in the cue sheet; if the Suno track is
not ready, build on a click track at the same BPM so timing is final and the
music drops in later without re-editing. Footage comes from
`docs/demo/raw/` cut by `beats.json`.

## Step 5 · QA

Run every check in `references/build-qa.md` (duration, freeze and black
frames, beat alignment, caption safety, phone readability, loudness, the
hackathon requirements, honest numbers). Fix and re-render until all pass.

### Gate 3 · cut review

Send the user a small preview (720p, under 30 MB) of each cut and the QA
table. Ask: final, or what to change. Stop and wait. Final render only after.

## Step 6 · Final

Render masters (1080p, crf 17), a 720p share copy, three stills for the
Devpost gallery, and write `docs/video/RELEASE.md`: files, durations, the
music and SFX credits and licenses, and the numbers on screen with where
each was measured.

## Working with other sessions in this repo

- The app (`src/`) belongs to the builder session; never edit it from here.
  If footage needs a UI change, ask the planner.
- New footage is recorded with `pnpm demo:video` from the user's terminal
  during an agreed freeze; this skill does not record by itself.
- Commit `video/` and `docs/video/` only; no AI attribution lines.
