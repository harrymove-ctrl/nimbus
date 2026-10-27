# Nimbus demo video

A Remotion project for the approved script in `../docs/video/script.md` (board,
music brief and SFX sheet beside it): two compositions on a 120 BPM grid, both
1920 × 1080 at 30 fps.

- `NimbusFull`: the hackathon cut, 68 bars (4080 frames, 2:16).
- `NimbusX`: the X clip, 22 bars (1320 frames, 0:44), cut from the same scenes.

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

- The take: `public/demo` is a link to `../docs/demo/`. `src/beats.ts` names the
  take (a video and its `beats.json` from `pnpm demo:video`) and every shot; a
  shot is cut by beat and fitted to its scene at up to 1.5×.
- `../docs/video/chat-transcript.json`: real `/v1` replies for the chat scene,
  shown verbatim (the selection is in `src/compositions.tsx`).
- `src/numbers.ts`: every number on screen; mock until `measured: true`, and the
  cards that show them carry a "mock run" tag until then.
- `public/audio/click-120.wav` stands in for the Suno track (same BPM; drop the
  music in at `public/audio/music-full.mp3` and swap the `ClickTrack`).
  `public/audio/sfx/*.wav` are the cue-sheet sounds, generated with ffmpeg by
  `bash scripts/make-audio.sh` (original files, no license question; swap any
  for a better sound under the same name).
- `public/column/*.jpg`: the Column Cut stills, `bash scripts/make-column-stills.sh`
  after a new take.

## Layout

- `src/grid.ts`: `BPM`, `FPS`, `framesPerBeat`, `bars()`; scenes are laid out in
  bars and the bundle refuses to load if one starts off the beat.
- `src/compositions.tsx`: both cuts, their scene tables and SFX cues.
- `src/scenes/`: `PromptRoll`, `CommentStorm`, `ColumnCut`, `AgentChat` (written
  from the board's descriptions), `Proof` (count-grid, adapted) and the end card.
- `src/Footage.tsx`: a shot with a camera move and click rings; `src/components/cards.tsx`:
  chapter and highlight cards, footage labels, the mock tag.
- `src/components/snap-cn/`: snapcn scenes (MIT, copied in by the shadcn CLI and
  ours to edit: `screen-recording` gained `footageRate`).

## QA and stills

`bash scripts/qa.sh <file.mp4>` prints duration, frozen and black spots, and
loudness. `node scripts/stills.mjs out/check 0 600` renders any frames
(`COMP=NimbusX` for the clip); set `BROWSER_EXECUTABLE` to use another Chrome.
