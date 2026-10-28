# Build and QA

## Build (only after Gate 2)

- Project: `video/` (Remotion, its own `package.json` and `tsconfig.json`;
  the root tsconfig excludes it). Scenes in `video/src/scenes/`, shared
  components in `video/src/components/`, snapcn sources in
  `video/components/snap-cn/`.
- Compositions: `NimbusFull` (1920 × 1080, 30 fps) and `NimbusX` (1920 ×
  1080 or 1080 × 1350 per the brief). Both read the same `beats.ts`
  (beat keys from `docs/demo/raw/beats.json`) and the same scene components;
  the X one re-times them.
- Timing: `video/src/grid.ts` exports `BPM`, `FPS`, `framesPerBeat`,
  `bars(n)`; every `<Sequence>` uses `bars()`, never raw frame numbers.
- Audio: `<Audio src={staticFile("audio/music-full.mp3")} />` at the
  composition root; each SFX row is a `<Sequence from={frame}>` with an
  `<Audio>` at its level. Until the Suno track exists, render the Tone.js
  temp score (see `sound.md`) and label the preview "temp music". A click
  track may play in Remotion Studio for timing, but it is muted in every
  render.
- Captions: a `CaptionBand` component that, when enabled, wraps the footage
  in the top 84 % frame and renders the bottom band (spec in components.md);
  a single prop on each composition turns it on or off.

Commands:
```bash
cd video && pnpm install
npx remotion studio                       # preview
npx remotion render NimbusFull out/nimbus-full.mp4 --codec h264 --crf 17
npx remotion render NimbusX out/nimbus-x.mp4 --codec h264 --crf 17
npx remotion render NimbusFull out/nimbus-full-4k.mp4 --codec h264 --crf 17 --scale=2   # 3840 × 2160 master for YouTube
```

Nothing is drawn on the frame that is not part of the story: no preview
watermark, no corner labels. Which take and which numbers a render carries
is stated in `docs/video/QA.md` and `RELEASE.md`, not on the picture.

## QA (all must pass before Gate 3)

| Check | How |
|---|---|
| Duration | Full ≤ 3:00 with ≥ 5 s spare; X 40–46 s. `ffprobe -show_entries format=duration` |
| No frozen or black spots | `ffmpeg -i out.mp4 -vf "freezedetect=n=0.003:d=1.5,blackdetect=d=0.3" -f null -`; only intended holds (end card) may appear |
| Cuts on the beat | Every scene start in `beats.ts`/`grid.ts` is a multiple of `framesPerBeat` |
| Frame 1 is the payoff | Extract frame 0 and look at it |
| Captions safe | If on: no caption pixel overlaps the footage frame; ≤ 2 lines; ≤ 42 chars |
| Phone readability | Extract a frame per scene at 30 % size; the key text is still readable |
| Loudness | `ffmpeg -i out.mp4 -af loudnorm=print_format=summary -f null -` → integrated −14 ± 1 LUFS, true peak ≤ −1 dBTP |
| Hackathon requirements | Nemotron model ids and "Nebius Token Factory" are on screen; the app is shown working |
| Honest numbers | Every on-screen number traces to a real run in RELEASE.md, or is labeled "mock" |
| End card | URL and command readable for ≥ 3 s |
| Palette matches the app | Every hex/oklch in `video/src/theme.ts` traces to `globals.css` or `run-view.ts`; sample 10 frames and check no foreign hue |
| Frame density | Sample a frame every 2 s; none is more than a third empty or shows footage smaller than 85 % of the frame (title cards excepted) |
| No click track, no raw tones | The rendered audio contains no metronome; every SFX file is a cuelume render, a designed Tone.js sound, or a licensed file |
| Better than the last liked cut | Watch the same three scenes from the previous liked cut and the new one with sound; the new one wins on each |

Report the table with pass/fail and evidence at Gate 3.
