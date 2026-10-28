# The tour and the quiet annotation

Written 2026-10-29 by the planner for the builder. The user asked for a guide
inside the app with three rules, quoted:

1. "Blur, focus in one frame only, can zoom for it."
2. "Less text, more show, to let people know what they are doing (if too
   complex, make it simple)."
3. "Annotation Playground: a quiet annotation component for explaining a
   meaningful decision without turning an interface into a tutorial. Can be
   better."

Two components, one vocabulary. Both reuse the video's callout words (what it
is · why it helps you), so the app, the video and the README say the same
thing about each part.

## 1 · The tour (`src/components/nimbus/tour.tsx`)

A spotlight walkthrough of the real UI, on the real data on screen. Not a
modal with screenshots.

**Entry.** A "Take the tour" item in the header's right side (next to the
sound toggle), and a one-time nudge on first visit (localStorage
`nimbus.tour.seen`): a small chip under the status pill, "New here? 60-second
tour", dismissed with ×. The tour never starts by itself.

**Spotlight.** One element at a time:
- Everything else: `backdrop-filter: blur(6px)` plus a neutral-950 veil at
  55 %. The veil is a full-screen fixed layer with a rectangular cut-out
  (CSS `mask-image` with a radial or rect mask, or an SVG mask), 12 px
  padding around the target, radius from `--rb-r-xl`.
- The target: untouched, above the veil, with a 2 px mint ring (`--rb-accent`)
  that draws in over 160 ms, and a **zoom**: `transform: scale(1.04)` on the
  target's own box (`transform-origin` at its centre) for the step's duration,
  reversed on exit. Wide targets (the timeline, the Overview) zoom 1.02.
- The page does not scroll under the user; the tour scrolls the target into
  view first (`scrollIntoView({block: "center"})`), then measures.
- Positions come from `getBoundingClientRect()` on the elements already
  marked `data-demo` (the recorder's anchors: `workstreams`, `plan`,
  `estimate`, `tools`, `lanes`, `model-badge`, `run-cost`, `approval-card`,
  `approve-buttons`, `rule-line`, `memories`, `skill-file`, `router-gauge`,
  `spend-chart`). Add `data-demo` where a step needs one that is missing.
  Re-measure on resize and on scroll.

**The card.** One per step, next to the target on its emptier side (same
placement rule as the video callout): neutral-900 at 92 %, white/10 border,
radius `--rb-r-xl`, 16 × 20 padding, Manrope. Two lines only:
- line 1, 600, 15 px: **what it is** (≤ 6 words)
- line 2, 500, 13 px, neutral-400: **why it helps you** (≤ 9 words)
Under them a row: step dots (filled mint for the current), "Skip", and a
mint "Next" (last step: "Done"). Keyboard: → or Enter next, ← back, Esc
skip. No paragraphs, no "click here to", no arrows drawn on the UI.

**Less text, more show.** Each step shows the thing happening, not a
description of it. Where the real state does not show it, the tour triggers
the UI's own state for the step and reverts it on leaving:
- "Approvals" opens the approval card's hover state so the three buttons are
  visible; nothing is sent.
- "Memory" switches the inspector to Memory & skill and back.
- "Plan" expands the plan card if a draft exists; if no run is open, the tour
  opens the most recent run of the selected workstream (read-only).

**The steps (default order, skip any whose target is absent on the page):**

| # | Target (`data-demo`) | What it is | Why it helps you |
|---|---|---|---|
| 1 | `workstreams` | Workstreams | Chores that run on a schedule |
| 2 | `plan` | The plan | Who does what, before anything runs |
| 3 | `estimate` | The price, first | You see the cost before you approve |
| 4 | `lanes` | One row per agent | They work at the same time |
| 5 | `model-badge` | Model per step | Ultra plans, Super writes, Nano checks |
| 6 | `approval-card` | Nothing leaves without you | Approve, reject, or allow from now on |
| 7 | `rule-line` | One rule saved | You can revoke it anytime |
| 8 | `memories` | What it learned | The next run asks less |
| 9 | `router-gauge` | It watches its own bill | Cheaper routing, proposed, you approve |

Nine steps, about 60 s at the user's pace. On the Overview page only steps
1, 3 and 9 have targets; the tour says "Open a run to see the rest" on its
last card there, with a button that opens the latest run and continues.

**Motion.** Veil 160 ms in/out, ring draw 160 ms, zoom 200 ms ease-out, card
rises 8 px and fades 160 ms; `motion` (already a dependency) or CSS. With
`prefers-reduced-motion`: no zoom, no rise, instant veil. cuelume: `open`
(subtle) on start, `select` on step change, `close` (subtle) on exit.

## 2 · The quiet annotation (`src/components/nimbus/why.tsx`)

For meaningful decisions, in place, without a tutorial. A small ⓘ dot
(10 px, neutral-500, mint on hover/focus) sitting at the top-right corner of
the decision's control. Hover or focus opens the same two-line card as the
tour (what · why), anchored to the dot, closing on blur/leave; click pins it
until clicked again or Esc. Nothing else on the page changes: no veil, no
blur, no zoom. Screen readers get the two lines as the control's
`aria-describedby`.

Props: `what`, `why`, `side` (auto), `children` (the control it decorates).
Rendered once per decision, not on every button:

| Where | What | Why |
|---|---|---|
| "Approve & always allow" | Allow it from now on | Saves one rule, by recipient, that you can revoke |
| The router gauge | Cost router | The cheapest Nemotron that can do each step |
| The Learner's diff / "Revert skill change" | Its own how-to, rewritten | Revert if it learned the wrong thing |
| The plan's estimate chip | The price, first | Measured from the plan, before anything runs |
| The day cap in the rail footer | Day cap | Runs stop here; raise it in settings |

The dot is the only persistent mark; a page with five dots still reads as
the product. If a sixth decision wants one, remove one first.

## What "better" means here

- The words are the video's words; the user has read them already.
- Two lines, never three. If a step needs three, the UI is unclear; fix the
  UI.
- The spotlight shows the real element with the real data, zoomed a little,
  never a picture of it.
- The tour can be left at any moment with Esc and never comes back unasked.

## Acceptance

- `pnpm dev` (mock): the tour runs through all nine steps on an open run,
  each target ringed and zoomed, the rest blurred; Esc exits cleanly with
  the UI state restored (inspector tab, hover states).
- The Overview-only path shows three steps and offers to open a run.
- Five `<Why>` dots present, each opening its card on hover and focus, and
  `aria-describedby` set.
- Reduced motion: no zoom or rise.
- The recorder is unaffected (the tour never auto-starts; the nudge chip is
  hidden when `NIMBUS_DEMO=1` or when `nimbus.tour.seen` is set, which the
  recorder sets).
- Lighthouse accessibility on the run page stays at its current score or
  better.
