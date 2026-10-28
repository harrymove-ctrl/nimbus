# Story rules for Nimbus videos

Why these rules exist, then the rules, then the two cut structures.

## Why

- **Most viewers decide in the first seconds, muted.** On X a video
  autoplays without sound while people scroll. If nothing happens in the
  first three seconds, they are gone. So the first frame shows the result
  already happening, and the words on screen do the job a voice would do.
- **Strangers care about their problem, not our name.** Someone who has
  never heard of Nimbus stops for a problem they already have, a number
  that surprises them, or something they can see working. The product name
  comes after the problem.
- **Numbers beat adjectives.** "Fast" and "cheap" are ignored because anyone
  can type them. "$0.08 per run" or "−45 % vs running every hop on the top
  model" can be checked, argued with, and remembered. Anchor a comparison on
  one concrete workload, not "up to".
- **Short is a feature.** A 45 s clip holds about 100 spoken words; with no
  voice it holds far fewer on-screen words, because reading is slower than
  listening. Every word has to earn its place.

## Rules

00. **Talk in the user's own ideas.** If the user framed the product with
   founding ideas (for Nimbus: ongoing work like Nebius agents, personal
   tasks, inside your chat apps like OpenClaw, an agent that keeps learning
   like Hermes — `docs/PLAN.md` §0), make them the chapters, one card each,
   and map each chapter to the track points it proves. A script that only
   tours screens loses the "why"; chapters keep it.
0. **Build the story on the judges' criteria.** Read the chosen track's text
   (in `docs/SUBMISSION.md` or ask the user to paste it) and give each middle
   scene one of its points, named in plain words on that scene's first card.
   Claim only what the product really does; list what is not claimed.
1. **Frame 1 is the payoff, readable by a stranger.** Show the result in
   everyday terms (work done, time saved, one thing that needs you), not an
   internal screen. Test: would someone who has never seen the app understand
   frame 1 and its words in 3 seconds? Inside words (gate, policy, PR, lane,
   plan card, approval card) never appear before the picture has shown what
   they mean. A first draft that opened on "the PR gate card" with "Your
   agent fixed the bug. Now it asks." failed this test: it assumed the viewer
   already knew the product and shared a coding context.
2. **Line 1 is for a stranger.** Start from the problem or the capability:
   - the problem: "AI agents either wait for you or act without asking."
   - the capability: "Your agent fixed the bug. Now it asks before the PR."
   Never: "Introducing Nimbus, a …", version numbers, stack lists.
3. **One idea per card.** ≤ 8 words a line, ≤ 2 lines, one new line every
   ≥ 3 s. Plain words a non-native reader gets instantly.
4. **Show, then say.** The words confirm what the picture just showed;
   they never describe something off screen.
5. **Math over adjectives, and honest math.** Every number on screen is
   either measured on real models (with the run it came from noted in
   `docs/video/RELEASE.md`) or visibly labeled "mock". Placeholders in a
   draft look like `[real: cost per run]` so they cannot ship by accident.
6. **Mobile zoom.** Any UI text the viewer should read is at least ~28 px
   tall in the 1080p frame; otherwise zoom the shot or show it on a card.
7. **Cut the waiting.** No spinners, no mouse travel, no loading. If the
   real run waits, cut or speed-ramp it and say so only if it matters.
8. **End on the action.** The repo URL and the one command, held ≥ 3 s,
   never a lone logo.
9. **The real app is the star; explain every part you show.** This user
   liked the walkthrough cut (`nimbus-demo-v3.mp4`) more than a kinetic-type
   motion piece, but said of it: "we don't understand what it is". So: real
   footage carries the video, and each UI part that appears gets a callout
   pinned to it with two lines, **what it is** and **why it helps you**
   (spec in `components.md`). Motion-graphics scenes are the title, the end
   and the transitions between parts: one designed scene (1–2 bars) opens
   each chapter, in the app's font and palette, with the cloud as the mark.
   A cut with only a plain title and small chapter chips felt like "no
   animation" to this user ("các animation đâu").
10. **The hero flow is a chore every viewer has.** Pick the case a stranger
    recognises in one second (morning inbox and calendar, replies waiting
    for an OK) over an inside-baseball one (the crew fixing Nimbus's own
    router test, with words like "golden", "404 fallback", "ceiling"). Any
    on-screen text from the app that needs domain knowledge is either
    avoided, zoomed past, or explained by a callout.
11. **Never crop the label that explains a picture.** When zooming into the
    timeline, keep the lane names in frame; a coloured row without its name
    means nothing.
12. **No sentence captions.** A bottom line that narrates in full sentences
    reads as a transcript; this user rejected it. Words live in callouts and
    on the title and end cards only, unless the user turns captions on.
13. **Nothing invented on the surface.** Motion scenes sit on the app's own
    surfaces: its neutrals, its dither texture, its accent, its role colours,
    its boot sky. No colour fields, blur blobs or glows under type; the
    palette file is generated from `globals.css`, never typed. The user
    rejected a green-blue blur field: "tự chế làm xấu … UI UX trong web đẹp".
14. **The story is about the viewer.** No character names in any word we
    write; people in the footage are roles (a client, a teammate). The
    numbers shown in a submission are measured, with no "mock" tag: the real
    run comes before the final render.
## Full hackathon cut (≤ 3:00)

The full cut explains the flow; the judges watch it whole. Structure:

| Part | Purpose | Nimbus content |
|---|---|---|
| Payoff (≈ 4 s) | Stop the scroll | Morning Overview: "While you slept, your AI crew did 4 jobs. 1 needs your OK." |
| Problem (≈ 6 s) | Make the stranger nod | Assistants wait for you to type; the ones that act don't ask first |
| Name (≈ 6 s) | Who we are + the stack | Cloud logo sting · Nimbus · Nemotron on Nebius Token Factory |
| Flow (≈ 1:30) | One scene per track point | Always on → tools you choose → real work on the right model → asks first → memory and skills → your data and limits → in your chat apps → gets better |
| Reach (≈ 14 s) | Where it lives | /v1 endpoint, OpenClaw, Nebius Serverless |
| Proof (≈ 10 s) | Numbers | Three tiers with model ids; cost, saving, eval pass rate |
| End (≈ 6 s) | What to do next | Repo URL + `pnpm dev` (no keys needed) |

Hackathon requirements to show on screen: NVIDIA Nemotron model ids, the
words "Nebius Token Factory", and the app working.

## X clip (~45 s), cut from the full one

| Time | Part | Rule |
|---|---|---|
| 0:00–0:04 | Payoff | Same as the full cut's frame 1 |
| 0:04–0:08 | Problem | One line, one card |
| 0:08–0:32 | Fast demo | Plan approve → lanes + retry → the gate → run two; tight zooms |
| 0:32–0:38 | Math | Two numbers max |
| 0:38–0:44 | End | URL + command, held still |

The X post text itself follows the same rules (problem first, a number,
the link in the first reply); write it in `docs/video/RELEASE.md` when asked.
