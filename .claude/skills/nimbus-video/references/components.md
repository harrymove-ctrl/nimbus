# Animation components

Pick per scene on the board. snapcn components are MIT and install into
`video/components/snap-cn/` with `npx shadcn@latest add @snapcn/<name>`
(catalogue: https://snapcn.dev/llms.txt). Custom ones live in
`video/src/components/`.

## Color and framing come from the app, not from taste

The video must look like the product it shows. Before writing any scene:
- **Read the palette from the code**: `src/app/globals.css` (neutrals,
  `--rb-accent`), the app shell's background (`bg-neutral-950`), and the role
  colors in `src/lib/run-view.ts` (`ROLE_COLOR`: checker, researcher, analyst,
  writer…) and the tier colors on the Overview. Put exactly those values in
  `video/src/theme.ts` with a comment naming the source line. Do not add a
  hue the app does not use; the cloud's blue and orange only on the cloud.
- **Dark-first**, because the app is dark. No light paper scenes between
  dark footage; a white flash only as a 4–8 frame transition.
- **Pills, highlights and tints** use the role colors (one role per idea) or
  mint, never arbitrary blues or lilacs.
- **Texture**: type scenes sit on the same dither the app uses (a 3 % dithercn
  glow or noise field), so cards and footage feel like one surface.
- **Framing**: footage fills at least 85 % of the frame; push in so the UI
  text the viewer must read is ≥ 28 px at 1080p; no frame is more than a
  third empty for longer than 1 s; never shrink footage into a corner.

Typography: Manrope, the weights the app uses.

## Explainer callout (the default way to put words on footage)

- A ring around the UI element (mint, 2 px, 8 px padding, draws in 8 f), a
  thin leader line (white/40), and a small card: neutral-900, white/10
  border, radius 14, Manrope. Line 1: 600 weight, 34 px at 1080p, ≤ 6 words,
  **what it is**. Line 2: 500 weight, 28 px, neutral-400, ≤ 9 words, **why it
  helps you**. A role-colour dot before line 1 when the element belongs to
  one agent.
- The rest of the frame dims 25 % while the callout shows.
- In on a downbeat, hold ≥ 2 bars, out on beat 4; one at a time, two at most.
- The card never covers the element or its label; place it in the emptier
  side of the frame.
- Positions come from bounding boxes the recorder writes per beat into
  `docs/demo/raw/beats.json` (`targets: {name: {x, y, w, h}}`), scaled by the
  same camera transform as the footage, so the ring tracks a push-in.
- Component: `video/src/components/Callout.tsx`, a pure function of the
  frame.

## Titles and kinetic type

| Need | Component | Notes |
|---|---|---|
| Opening sentence told in beats | `orb-swarm` | One phrase per beat group; glass orbs tinted mint/blue |
| Product name + tagline | `announce-title` | Eyebrow = hackathon + track; name; tagline with "Nemotron · Nebius Token Factory" |
| One line between shots | `text-reveal`, `word-flip`, `punch-lines` | ≤ 8 words; in on a downbeat, out on the bar's last beat |
| A line that changes into another | `type-morph`, `text-swap` | Problem → answer, "Ship Nimbus" → "it ships itself" |
| Big number | `count-grid` (adapted), custom counter | Counts up over 1 bar, holds 2 bars |

## Captions (optional — the user decides at Gate 1 every time)

If on, the bottom band:
- The footage frame shrinks to the top 84 % of the canvas (centered), so
  captions never cover the product. The band is the bottom 16 % (≈ 172 px at
  1080p), background neutral-950 at 92 % opacity.
- Text: Manrope 600, 44 px at 1080p, neutral-100, centered, max 2 lines,
  max 42 characters per line, 8 px safe margin from the band's edges.
- The caption is the scene's on-screen line, shown for the whole shot; it
  changes on a downbeat, crossfades 6 frames.
- Component: `word-captions` restyled to this spec, or a 40-line custom one.
- On title cards the band is hidden; the card is the text.
If off: words appear only on title cards between shots and as one-word
labels inside device frames.

## Device frames and screen recordings

| Need | Component | Notes |
|---|---|---|
| App footage with a camera | `screen-recording` | Keyframe crop/zoom per beat; never a static full-frame paste |
| Laptop context shot | `laptop-frame` | Overview and the first shot of the run view |
| Phone shot | `phone-frame` | The phone layout, the pill on mobile |
| Cursor emphasis | `cursor-track` | Highlight ring on clicks that matter (Approve plan, Approve & always allow) |
| Terminal | `terminal-simulator` | curl to `/v1/chat/completions`, `pnpm dev` |

Camera moves on footage, by intent:
- **Push in** (100 % → 140 % over 1–2 bars) toward the thing that changes.
- **Pan along** a chart or the lanes as they fill.
- **Hold with motion inside** only when the UI itself animates (lanes, counters).
- **Snap zoom** (6 frames) onto an error ✕ or a click, paired with a sound.

## Logo stings

- **Cloud sting** (custom, from `src/components/glow-cloud.tsx` copied into
  `video/`): the cloud blinks, looks at the camera, winks; wordmark wipes in.
  2–3 s, on a riser into an impact on the downbeat.
- **Wordmark cut** (`wordmark-cut`) for the end card, then the URL and command.
- **Orange flash**: the cloud turning orange is the brand's "needs you"
  signal; use it as a sting at the gate scene (6-frame hue swap, soft chime).

## Signature scenes, hand-built

Several snapcn catalogue scenes are paid. When the user wants their look,
write our own scene from the behavior described, from scratch, in
`video/src/scenes/` — never copy paid source. Keep each scene a pure function
of the frame (no randomness: positions and timings come from a table in the
file, so renders are identical) and time every beat with `bars()`.

| Scene | Behavior to build | Good for |
|---|---|---|
| `PromptRoll` | Card pushes in; a phrase types; its last words become a pill that rolls through options, each tinted; whip pan to a send button that draws itself; pointer press with a halo; arrow flies off; wash to white | The hook: one-sentence capability with variants |
| `CommentStorm` | One line types into a pill; then pills (overshoot + tilt) and cards (open downward, type their lines) pile in, accelerating; camera pulls back, shakes, folds the pile into the center; cut to black | Showing the old, overloaded way without words |
| `ColumnCut` | Four-line cascade, square cursor by line 3, a highlight running across it letter by letter while the type drifts up; hard cut to a column of stills that jumps one per beat (beats tightening), a sentence either side, the frame panning left faster | A montage of many jobs or screens |
| `AgentChat` | Prompt types in a compose field (camera pushes in, field scrolls under a soft left edge), becomes a bubble, avatar + typing dots, reply streams word by word (each word grey for a moment before it sets); only the typing rate is chosen, every later beat derives from it | Chat-app features; replay real endpoint replies word for word |

Free snapcn pieces that pair with them: `orb-swarm` (the name, told in
beats), `text-highlight` (marker, color, underline, strikethrough, shimmer on
one span — chapter cards and numbers).

## Whole scenes and transitions

| Need | Component |
|---|---|
| Cards flowing past (the seven workstreams) | `card-rail` |
| Status rolling (Running → Needs you → Done) | `status-cycle` |
| Agent steps as a list (the plan checklist) | `agent-steps` |
| Halftone wash between parts (matches the dither look) | `dot-bloom` |
| Stats rushing in | `count-grid` |

Transition grammar: a hard cut on the downbeat inside a part; a
`dot-bloom` wash between parts; never cross-dissolves between UI shots (they
look like loading). Every transition has a sound (see `sound.md`).
