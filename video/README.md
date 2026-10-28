# Nimbus demo video

A Remotion project for the approved script in `../docs/video/script.md` (rev 5;
board, music brief and SFX sheet rev C beside it): a real app walkthrough with
explainer callouts, two compositions on a 120 BPM grid, both 1920 × 1080 at 30 fps.

- `NimbusFull`: the hackathon cut, 87 bars (5220 frames, 2:54).
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
npx remotion render NimbusX out/nimbus-x.mp4 --codec h264 --crf 17
```

## Inputs

- The take: `public/demo` links to `../docs/demo/`. After a new take,
  `node scripts/sync-take.mjs demo/raw/<file>.webm` writes `src/take.ts` from its
  `beats.json` (beat windows, sub-beat clicks, callout target boxes); `src/beats.ts`
  turns those into the shots, fitted to their scenes at 0.5–1.5×.
- `../docs/video/chat-transcript.json`: real `/v1` replies for the phone scene,
  shown verbatim (the selection is in `src/compositions.tsx`).
- `src/numbers.ts` and the callouts marked "mock": numbers from the mock-mode run.
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
- `src/palette.ts`: the app's colours, each citing `globals.css` or the component it is from.
- `src/Footage.tsx`: a shot with a camera, click rings and callouts that ride the camera.
- `src/components/Callout.tsx`: the explainer callout and the chapter eyebrow (solid chip
  on a corner scrim); `TitleCard.tsx` the title. Rings stay 24 px inside the frame.
- `src/callout-layout.json`: where each callout card sits, measured by
  `python3 scripts/layout-callouts.py` (renders each callout's frames with only its ring,
  then keeps the nearest spot that covers no text cell). Re-run it after any camera or
  take change; `node scripts/callout-index.mjs full|x` lists the callouts at their frames.
- Rev D motion scenes (board rev D), each a pure function of the frame, our own builds
  unless noted: `Lockup.tsx` (title and end card, on the app's boot sky), `ChapterCards.tsx`
  (chapter 1 on snapcn `punch-lines`, chapter 2 on snapcn `text-highlight`), `MetricMorph.tsx`,
  `FocusPull.tsx`, `OrbitFlow.tsx`, `ScreenWall.tsx`, `ScatterBloom.tsx`.
  `src/components/CloudMark.tsx` is the app's `glow-cloud.tsx`, frame-pure.
- `src/datasets/`: real rows for the motion scenes, written by
  `python3 scripts/export-mock-calls.py` (read-only on `data/nimbus.db` and the take's
  `data/video-rev5/nimbus.db`): every mock model call (Scatter Bloom) and the take's run hop
  by hop (Metric Morph).
- `src/scenes/PhoneChat.tsx` (the chat on snapcn `phone-frame`), `Proof.tsx`
  (count-grid, adapted) and the end card. `PromptRoll`, `CommentStorm`,
  `ColumnCut` and `AgentChat` are from rev 4 and not in this cut.
- `src/components/snap-cn/`: snapcn scenes (MIT, ours to edit: `screen-recording`
  gained `footageRate`).

## QA and stills

`bash scripts/qa.sh <file.mp4>` prints duration, frozen and black spots, and
loudness; `python3 scripts/qa-frames.py <file.mp4> --cards 6-10` checks frame
density and the palette. `node scripts/stills.mjs out/check 0 600` renders any frames
(`COMP=NimbusX` for the clip); set `BROWSER_EXECUTABLE` to use another Chrome.
