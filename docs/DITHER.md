# Dither: loading skeletons and the ambient background

Added 2026-10-27 night. Library: **dithercn** (the user's choice), a dither
engine with `DitherShader`, `Skeleton`, `DitherGradient`, `ditherMaskStyle`
and `DitherPattern`, sized by the `--dither-cell` CSS variable (3 px default)
and rendered one canvas pixel per cell with `image-rendering: pixelated`.
Its docs were pasted by the user; the site was not reachable from the planning
session, so:

- **Site:** https://dithercn.dev (docs index at /llms.txt, agent skill at
  /.well-known/agent-skills/dithercn/SKILL.md). Requires React 19 and Tailwind v4;
  the engine lives in `lib/dither` and is imported as `@/lib/dither`.
- **Install** (shadcn CLI, official):
  `npx shadcn@latest add https://dithercn.dev/r/dither-core.json` for the engine,
  `npx shadcn@latest add https://dithercn.dev/r/dithercn-skill.json` for the engine
  plus the agent skill, and any example from `https://dithercn.dev/r/<name>.json`
  (registry index at /r/registry.json). The install adds `dither-tokens`, which
  writes `--dither-ink`, `--dither-paper`, `--dither-cell`, `--dither-bloom` into
  the global CSS mapped to shadcn's `--primary` and `--background`. Never pass
  `--overwrite` (it replaces `lib/utils.ts`).
- **Pages to read before building:** interface/skeleton, backgrounds/dither-glow,
  engine/pixel-scale, engine/motion (reduced motion and `stillTime`),
  engine/performance, theming. Append `.md` to any docs URL for markdown.
- **Skill rules worth keeping:** a field returns tone 0–1 (0 paper, 1 ink) and
  leaves thresholds to the engine; multiply `uv.x` by `res.x / res.y`; keep
  motion to a few percent of the box per second; set `stillTime` so the
  reduced-motion frame looks finished; fade tone under text to ≤ 0.2 and keep
  4.5:1 contrast; no `[dither-core]` console errors.
- **Fallback** only if the registry is down: implement the same API in-house
  (Bayer threshold, field function, one canvas pixel per cell, pixelated
  scaling) with the same prop names.

## Where dither appears, and where it does not

| Surface | Use | Why |
|---|---|---|
| Boot screen | **No dither.** The Glow Cloud sky stays as designed | The cloud is the first impression |
| App background behind the run view and the empty state | `DitherShader`, a slow drifting glow field, `cell` 3, `animate` true, ink at 6–8 % opacity over the Sorbet background | Gives the dark surface life without competing with the lanes |
| Rail while `GET /api/workstreams` loads | `Skeleton` text lines ×3 with the **sweep** band | Replaces a blank column |
| Transcript before the first event of a run (planning) | `Skeleton` block (plan-card shape) with the **pulse** stepping through Bayer levels | Reads as "thinking", matches the planning state |
| Inspector body while an artifact or Agent I/O loads | `Skeleton` text lines, sweep | Same language as the rail |
| Timeline strip before the first `agent.start` | **No skeleton.** The cloud Z6 occupies the header | Two loaders at once is noise |
| Composer | Never | Controls must look like controls |
| Approval tray, cards, cloud | Never | State is reported by color and copy, not texture |

Rules:
- One loader per region at a time. Skeletons show after 150 ms of waiting, never for a fetch that resolves faster (avoid flashes).
- Sweep = waiting on the network. Pulse = waiting on the crew. Keep the mapping strict so the texture means something.
- `--dither-cell` is 3 px app-wide; 4 px on the empty-state hero only.
- Ink and paper follow the theme tokens: ink `--color-neutral-700` on dark, `--color-neutral-300` on light; the background field never exceeds 8 % opacity.
- `prefers-reduced-motion`: `animate={false}` on the background; skeletons use a static mid-level dither, no sweep, no pulse.
- Performance: the background canvas is one per page, paused when the tab is hidden (`visibilitychange`) and when a run is `running` on a lane count ≥ 4 (the timeline is already animating).

## Background field

A soft glow that drifts: two low-frequency sine terms over the glow from the
pasted example, period ≈ 40 s, amplitude small. Motion is ambient, not a
spotlight.

```glsl
float field(vec2 uv, vec2 res, float t) {
  float aspect = res.x / res.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 c = vec2(0.15 + 0.08 * sin(t * 0.05), 0.85 + 0.05 * cos(t * 0.04));
  return clamp(0.55 - length(p - c) * 0.7, 0.0, 1.0) * 0.5;
}
```

## Skeleton specs

| Skeleton | Shape | Rows | Motion |
|---|---|---|---|
| Rail | title line 60 % width, meta line 40 % | 3 items, 52 px pitch | sweep, 1.2 s, left to right |
| Plan card | block 720 × 156, radius R1 | 1 | pulse, 1.6 s, 4 Bayer steps |
| Inspector | 6 text lines, widths 90/70/85/60/80/50 % | 1 | sweep, 1.2 s |
| Artifact doc | heading 50 %, 5 lines | 1 | sweep |

Exit test: throttle the network to Slow 3G in devtools; the rail and
Inspector show sweep skeletons and never a blank area; start a run; the plan
area pulses until the plan card arrives; with reduced motion on, nothing moves.

## In the demo video (rev E)

- `DitherGlow` ambient background behind the run view for the whole video,
  cell 3, slow drift, ≤ 8 % ink; it must be visible in the frame but never
  behind text at more than 0.2 tone.
- `DitherNumber` for the five stat tiles in the run summary and the cost in
  the run header during the count-up.
- `EmptyState` from dithercn for the "Pick a workstream" screen, with the
  cloud as the illustration.
- `Skeleton` sweep on the rail and the Inspector during the first 400 ms of
  the recording, so the loaders are seen once.
- `Divider` with a label between transcript days in the Hackathon radar run.
- Nothing dithered on the cards, the composer, the cloud or the lanes.

## Rev F: one background per surface, and the charts

See SPEC §17.6 for the background map (contours on the Overview, dither-glow
on the run view, aurora on the empty state, ripples only while an approval
waits, noise-field behind Memory & skill, nothing elsewhere) and §17.1 for
the charts (StatCard, AreaChart stacked by tier, DonutChart, Heatmap calendar,
UptimeBar per scheduled workstream, Gauge for the router saving, Sparkline in
rail items, ProgressBar for the plan checklist and the day cap). Install each
from `https://dithercn.dev/r/<name>.json`; charts animate in once and are
still under reduced motion.
