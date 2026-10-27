# Interface posters

Two A4 spec posters in the `interface-bts` style (grays and one accent, dimensions drawn in place, one headline, moments
under the figure, notes, figure 2 and a specification table).

| Poster | File | Headline | Accent |
|---|---|---|---|
| Approval card | `approval-card.html` | The gate asks once and remembers: Approve & always allow writes one policy line the next run reads. | green, oklch(0.78 0.15 150) |
| Timeline strip | `timeline-strip.html` | Time is the only easing: bars grow with the clock, the playhead follows it, and a spawn draws one dotted line down. | blue, oklch(0.72 0.14 250) |

Open either file in a browser: the 794 × 1123 artboard (A4 at 96 dpi) scales to fit, and prints as A4. `generate.py`
rebuilds both from one place (`python3 docs/posters/generate.py`).

## What is and is not verified

- **Read from source, not measured in a browser:** every duration, easing, size and rule on the posters is taken from
  `src/app/globals.css`, `src/components/nimbus/transcript.tsx`, `ui.ts`, `approval-tray.tsx` and `timeline.tsx`
  (for example 160 ms `ease-out` for the tray, 220 ms linear for the connector draw, 26 px segments, 66 px lane pitch).
- **The figures are drawings of the components, not the components frozen.** The skill freezes the real component with
  `getAnimations()` and reads computed values; that needs headless Chrome, which cannot start in the sandbox this build
  ran in.
- **Not run:** the skill's overlap check (`scripts/overlaps.js`) at 1280×800, 1000×760 and 1030×1044, and the A4 PNG
  export. Both are in `export.mjs`:

```bash
pnpm exec playwright install chromium
node docs/posters/export.mjs
```

It writes `approval-card.png` and `timeline-strip.png` (1588 × 2246) and prints the overlap result for each size.
The posters have no `data-subject-root` element yet, since they draw rather than embed the component: add one around
each figure if the check should treat the figure as the subject.

## Choices worth knowing

- One accent per poster, unique across the project; words in the accent use a lighter ink of the same hue because the
  app (and so the poster) is dark.
- The approval tray's real easing is the CSS keyword `ease-out`, not the `--m-ease` curve in `docs/EXPERIENCE.md`.
  The poster draws what the code does.
