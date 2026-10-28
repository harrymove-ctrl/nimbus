# Nimbus demo video

A Remotion project for the approved script in `../docs/video/script.md` (rev 6;
board rev E, music brief rev D and the SFX sheet's rev E cue sheet beside it): the v3
orb opening, the name, a real app walkthrough with explainer callouts on a tilted camera, a
designed card at each chapter, and the end card. Two compositions on a 120 BPM grid, both
1920 × 1080 at 30 fps.

- `NimbusFull`: the hackathon cut, 88 bars (5280 frames, 2:56).
- `NimbusX`: the X clip, 22 bars (1320 frames, 0:44), cut from the same shots.

```bash
npm install
```

```bash
npx remotion studio
```

```bash
npx remotion render NimbusFull out/nimbus-full.mp4 --codec h264 --crf 17
```

```bash
npx remotion render NimbusFull out/nimbus-full-4k.mp4 --codec h264 --crf 17 --scale=2
```

```bash
npx remotion render NimbusX out/nimbus-x.mp4 --codec h264 --crf 17
```

The compositions stay 1920 × 1080; the 4K master is the same composition at `--scale=2`
(3840 × 2160). Nothing on the frame says which take, numbers or music a render carries
(board rev E "Look" 7): that goes in `docs/video/QA.md` and `RELEASE.md`. Render the final
only after the real-model take and the Suno tracks are in.

## Inputs

- The take: `public/demo` links to `../docs/demo/`. After a new take,
  `node scripts/sync-take.mjs demo/raw/<file>.webm` writes `src/take.ts` from its
  `beats.json` (beat windows, sub-beat clicks, callout target boxes); `src/beats.ts`
  turns those into the shots, fitted to their scenes at 0.5–1.5×.
- `../docs/video/chat-transcript.json`: real `/v1` replies for the phone scene,
  shown verbatim (the selection is in `src/compositions.tsx`).
- Numbers on screen are the fixture take's until the real-model take lands; no "mock" tag
  (script rev 6). The callout figures are in `src/shots.ts`.
- Sound: `node scripts/make-sound.mjs` renders, offline in headless Chromium,
  every cue-sheet sound into `public/audio/sfx/` (the app's own cuelume cues,
  Tone.js-designed transitions) and the Tone.js temp score
  `public/audio/music-temp-*.mp3` from `sound/music-map.json`. `node scripts/make-sound.mjs new`
  renders only the sounds whose file is missing. Swap in the Suno
  tracks at `MUSIC` in `src/compositions.tsx`. No click track is ever rendered.
- Master: `bash scripts/master.sh out/nimbus-full.mp4 out/nimbus-full-master.mp4`
  levels a render to −14 LUFS, ≤ −1 dBTP (picture copied).

## Layout

- `src/grid.ts`: `BPM`, `FPS`, `framesPerBeat`, `bars()`; scenes are laid out in
  bars and the bundle refuses to load if one starts off the beat.
- `src/shots.ts`: every shot (camera moves, callouts, click rings) and both cuts' layouts;
  `src/compositions.tsx` renders them with the SFX cues.
- `src/palette.ts`: **generated** by `node scripts/gen-palette.mjs` from `src/app/globals.css`,
  `src/lib/run-view.ts` and the timeline's model badge; only the boot sky and the cloud's two
  colours are hand-added, and the script checks their source lines. Re-run it after the app's
  CSS changes; never edit the file.
- `src/Footage.tsx`: a shot with a camera, click rings, the drawn Approve tick and callouts
  that ride the camera, on the tilted 3D camera (yaw per shot, soft far edge) that relaxes to
  flat while a callout is open; callout boxes are projected through the tilt.
- `src/components/Callout.tsx`: the explainer callout and the chapter eyebrow (solid chip
  on a corner scrim); `TitleCard.tsx` the title. Rings stay 24 px inside the frame.
- `src/callout-layout.json`: where each callout card sits, measured by
  `python3 scripts/layout-callouts.py` (renders each callout's frames with only its ring,
  then keeps the nearest spot that covers no text cell). Re-run it after any camera or
  take change; `node scripts/callout-index.mjs full|x` lists the callouts at their frames.
- Rev E motion scenes (board rev E), on neutral-950 with the app's dither: `Opening.tsx`
  (snapcn `orb-swarm`, `block-wordmark` with the CloudMark, `laptop-frame` diving into the
  Overview), `ChapterCards.tsx` (snapcn `word-gather`, `text-highlight`, `check-cycle`),
  `OrbitFlow.tsx`, `MetricMorph.tsx`, `ScatterBloom.tsx` + `Proof.tsx`, `RunIt.tsx` (snapcn
  `terminal-simulator`), `Lockup.tsx` (the end card on the boot sky), and the chat on snapcn
  `phone-stack` with `PhoneChat.tsx`'s `ChatScreen`. `src/components/CloudMark.tsx` is the
  app's `glow-cloud.tsx`, frame-pure. `FocusPull.tsx` (rejected) and `ScreenWall.tsx`
  (replaced by Phone Stack) are not in the cut.
- `src/datasets/`: real rows for the motion scenes, written by
  `python3 scripts/export-calls.py` (read-only on `data/nimbus.db` and the take's database,
  `TAKE_DB` / `TAKE_RUN` in the script): every model call (Scatter Bloom, the proof's count
  and spend) and the take's run hop by hop (Metric Morph). Re-run after the real-model run.
- `PromptRoll`, `CommentStorm`, `ColumnCut` and `AgentChat` are from rev 4 and not in this cut.
- `src/components/snap-cn/`: snapcn scenes (MIT, ours to edit: `screen-recording` gained
  `footageRate`; `check-cycle` gained `speed`, `scale`, `fontWeight`; `word-gather` gained
  `tracking`, `spaceTrim`; `phone-stack` gained `screens`; `terminal-simulator` paints in
  the app's tokens).

## QA and stills

`bash scripts/qa.sh <file.mp4>` prints duration, frozen and black spots, and
loudness; `python3 scripts/qa-frames.py <file.mp4> --cards 6-10` checks frame
density and the palette. `node scripts/stills.mjs out/check 0 600` renders any frames
(`COMP=NimbusX` for the clip); set `BROWSER_EXECUTABLE` to use another Chrome.
