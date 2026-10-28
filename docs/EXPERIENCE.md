# Nimbus experience plan

How the product feels, moves, reveals detail, connects, and why a judge will
remember it. Companion to `UI-SKETCH.html` (sheets 1–9, flows F1–F12),
`SPEC.md` and `UX-REVIEW.md`. Written 2026-10-27.

## 1. The one sentence and the three beats

**A glowing cloud that runs your ongoing work with a crew of Nemotron agents,
asks before it acts, and learns from every run.**

A judge watching the 3-minute video should remember three beats:

1. **The crew is visible.** Not a spinner. Lanes per agent, model badge per
   lane, cost ticking per lane, dotted connectors showing who spawned whom.
2. **It asks, and it learns from the answer.** The cloud turns orange, the
   tray slides in, and "Approve & always allow" writes a policy line into the
   workstream's skill file that you can read in the run summary.
3. **The second run is cheaper and better, and the numbers say so.** Router
   delta in the header, memories and a skill diff in the summary, eval table
   in the README.

## 2. What makes it distinctive (and what we deliberately do not do)

| Distinctive | Why it lands | Not doing |
|---|---|---|
| Timeline is the primary surface of a multi-agent run | Most agent apps show a chat log; ours shows time, concurrency, model tier and money | No "agent avatars talking to each other" theatre |
| Approval gate with policy learning | Trust is a feature; the learning loop is visible, not a claim | No "autonomous mode" toggle that hides what ran |
| Cost-aware router with a live baseline delta | Unit economics on screen, not in a blog post | No vanity token counters without a comparison |
| Composer whose primary button follows state | Enter is always predictable; steering a running crew feels safe | No free-text-only chat box |
| The cloud is an instrument | Blue means fine, orange means you are needed; it is the status light of the whole system | No mascot that only decorates |
| OpenAI-compatible endpoint | OpenClaw, Hermes and NemoClaw use Nimbus as a model with a ten-line config | No bespoke Telegram bot as the headline integration |
| Evals grade every hop | "Measure what actually breaks" | No single final-answer score |

## 3. Interaction model, surface by surface

### Rail (left)
- Click a workstream: selects it; the run view shows its last run frozen, or
  the composer in idle if it has none. Keyboard: ↑↓ move, Enter opens.
- Hover: shows last run time and cost in the meta line.
- Unread dot: a run finished while the person was elsewhere. Clears on open.
- Clock glyph: a schedule exists; hover shows the next run time.
- Drag: none in v1. Right-click: Run now · Edit schedule · Archive.

### Run header
- Title (click to rename), status pill, elapsed · tokens · cost (tabular
  numerals), and "−X % vs baseline" which hovers to a tooltip explaining the
  baseline (same hops priced at ceiling tiers).
- STOP lives in the composer, not here, so the header never has a destructive control.

### Timeline strip
- Hover a segment: tooltip with label and duration; the matching transcript
  row gets a faint highlight.
- Click a segment: selects it. The Inspector switches to Agent I/O for that
  hop; the transcript scrolls to the event; the lane legend shows that lane's
  tokens and cost bold.
- Click a spawn dot: selects the orchestrator turn that spawned the children.
- Drag the strip's bottom edge: resize between 56 (collapsed summary bar) and 480.
- Collapsed bar: one row per lane as a thin sparkline with the playhead; click to expand.
- Keyboard: ←→ move the selection along events of the selected lane; ↑↓ change lane; Esc clears.
- Scroll: horizontal only, with the legend column pinned.

### Transcript
- Plan card: Cancel for 3 s; "Save as workstream" on a first run; chips are
  read-only here (editable in the composer before the run).
- Message rows: agent chip + text; a route badge in the row when the hop was
  routed below ceiling; click the chip to select the lane.
- Handoff rows: two chips and an arrow; hover shows the handoff context.
- Question card: option chips send immediately; free text goes through the composer.
- Approval card: exact payload preview (3 lines, expandable), risk chip,
  Approve · Approve & always allow · Reject with a note. Resolved cards keep
  the stamp row (decision, who, when) and lose the stripe.
- Run summary card: stat tiles, memories list, SKILL.md diff with a
  "Revert skill change" ghost button that undoes the Learner's rewrite.

### Approval tray
- Sticky above the composer while anything is pending; count, first summary,
  Approve · Reject · Approve all low-risk; click the summary to expand the list.
- Keyboard: A approves the first, R rejects it, Shift+A approves all low-risk.

### Composer
- As in the state and transition tables on the sketch page. Additionally:
  paste a URL and it becomes a fetch_url input chip; drop a file and it becomes
  an attachment chip; `@` opens lane mentions; `/` opens commands.
- Mode and Tier chips persist per workstream.

### Inspector
- Artifact: version tabs, DOC · CODE toggle, copy; Download later.
- Agent I/O: the hop's role prompt prefix (collapsed), the brief, every tool
  call with input and output, the result, tokens in/out, tier, route reason,
  cached-or-not, cost.
- Memory & skill: the workstream's SKILL.md (read-only in v1) and the memory
  list with "forget" per item.

### Phone
- Four tabs; the RUN tab shows a count badge while approvals wait; the tray
  renders at the top of the CHAT tab; lanes scroll horizontally; long press a
  segment for the tooltip, tap to select.

## 4. Progressive disclosure: how details appear

Level 0, always visible: lanes, status pill, cost line, cloud mood.
Level 1, hover: segment tooltip, route tooltip, baseline tooltip, handoff context.
Level 2, click: Agent I/O for a hop, expanded approval payload, expanded tray.
Level 3, explicit: SKILL.md and memories in the Inspector, the run summary diff.
Nothing is behind a settings page except API keys and the OpenClaw snippet.

## 5. Motion design

Principles: motion reports state, it never decorates. Timing is truthful:
segments grow in real time, the playhead moves with the clock, nothing is
eased to look faster than it is. One easing for enters
(`cubic-bezier(.2,.8,.2,1)`, 160–240 ms), one spring for pops (overshoot
≈ 1.05, 160 ms), linear for the 3 s countdown. Reduced motion: every
transition becomes a cut, the playhead jumps once per second, the cloud is still.

| Moment | Trigger | Motion | Duration · easing |
|---|---|---|---|
| Boot | app load | Cloud floats and breathes (component springs); title and subtitle fade in | 400 ms ease-out, 300 ms after mount |
| Boot exit | workstreams loaded | Boot screen fades out; minimum boot time 900 ms so it never flashes | 400 ms ease-out |
| Shell enter | after boot | Rail items slide in 8 px with a 30 ms stagger | 160 ms ease-out |
| Run start | POST /api/runs | Cloud Z6 scales in at the timeline header | 240 ms spring |
| Plan card | `plan` event | Card translates up 8 px and fades in; countdown ring around CANCEL | 200 ms ease-out · 3 s linear ring |
| First agent | first `agent.start` | Cloud Z6 collapses to 0 height; lane rows enter from 0 to P1 | 200 ms ease-in · 180 ms ease-out |
| Spawn | `agent.spawn` | Dot pops on the parent lane; connector draws top to bottom (stroke-dashoffset) | 160 ms spring · 220 ms linear |
| Segment | `segment.*` | Width bound to time, no easing; end cap rounds on end | real time |
| Waiting | `segment.wait` | Hatch pattern drifts slowly | 1.2 s linear loop (still under reduced motion) |
| Failed | `agent.error` | Outline flashes once, then ✕ fades in | 300 ms · 120 ms |
| Route badge | `route` with chosen ≠ ceiling or fallback | Badge pops at the segment start | 160 ms spring |
| Axis rescale | playhead > 80 % width | Scale steps +5 s; bars and ticks re-lay out together | 300 ms ease-in-out |
| Approval | `approval.request` | Tray slides down into place above the composer; cloud swaps to orange on the next frame; rail badge pops | 160 ms ease-out · instant · 160 ms spring |
| Approval resolved | `approval.resolve` | Buttons fade out, stamp row fades in, stripe fades; tray slides up when count reaches 0 | 120 ms · 200 ms · 160 ms |
| Composer state | state change | Primary button label crossfades; placeholder crossfades | 120 ms |
| Cost pill | estimate returns | Number counts up with tabular digits | 300 ms ease-out |
| Slash menu | `/` or `@` | Menu scales 0.98 → 1 and fades in above the box | 120 ms ease-out |
| Inspector | first run or segment click | Panel slides in from the right; tab crossfade; selected segment gets a 2 px ring | 240 ms ease-out · 120 ms · 150 ms |
| Artifact version | `artifact.version` | New version tab pops; body crossfades to the latest | 160 ms spring · 120 ms |
| Run summary | `run.end` | Card enters; stat tiles count up; diff lines stagger in 40 ms apart | 240 ms · 600 ms · 40 ms stagger |
| Learned chip | after Learner | Chip pops on the orchestrator lane of the next run | 160 ms spring |
| Cloud click | pointerdown | Squish and wink (component) | spring 220/9 · 340 ms |

Implementation notes: CSS transitions for enters and crossfades; `requestAnimationFrame` for the playhead and segment widths; SVG `stroke-dasharray` for the connector draw; `prefers-reduced-motion` checked once and exposed as a React context; all durations as CSS variables in `globals.css` (`--m-fast: 120ms; --m-base: 160ms; --m-slow: 240ms; --m-ease: cubic-bezier(.2,.8,.2,1)`).

## 6. How Nimbus connects

| Connection | Direction | What flows | Where it shows in the UI |
|---|---|---|---|
| Nebius Token Factory | app → API | Every agent call: Nemotron 3 Ultra / Super / Nano via the OpenAI-compatible chat API with function calling; embeddings for memory | Model badge on each lane, tokens and cost per lane, route badge, cached chip |
| Tavily | Researcher → API | Web search results with sources | Source list in the Researcher's Agent I/O; citations in the artifact |
| SQLite on a volume | app ↔ disk | Workstreams, runs, events, artifacts, approvals, memories, skills, llm_cache | Timeline rebuilds from events after refresh; Memory tab |
| Nebius Serverless Endpoint | internet → container | The hosted app (demo URL) | The URL in the README and video |
| Nebius Serverless Job | scheduler → container | Headless workstream runs (`pnpm run:job`), writing to the same volume | Runs with trigger "job" appear in the rail with an unread dot |
| OpenClaw / Hermes / NemoClaw | chat app → Nimbus `/v1` | A message becomes a run; the Writer's text streams back; approvals come back as a link | The same run visible in the web timeline with trigger "chat" |
| Browser ↔ app | SSE | Run events in real time; approvals and messages via POST | Everything live |
| GitHub Actions | PR → eval | `pnpm eval --cheap` on mocked runs; blocks the PR under 90 % | Check on the repo; table in the README |
| Mock mode (`NIMBUS_MODEL=mock`) | app → fixtures | Scripted model, hash embeddings, fixture search | Identical UI, zero spend; used for all development and the eval harness |

Stretch connections, only after Phase 4's exit test: Telegram bot via grammY;
OpenShell sandbox adapter for `run_code`; Nemotron 3.5 Super VL for screenshots;
MemWal (Walrus Memory) as a memory adapter.

## 7. Showcase: the moments to film

Already scripted in `SUBMISSION.md`; the beats that must be on screen:

1. Cloud boot, then the empty composer with three template chips.
2. Type the goal, drop the CSV, watch the cost pill appear before pressing Enter.
3. Plan card with the countdown; lanes appear; connectors draw.
4. Click the Analyst segment: Agent I/O shows the code it ran on the CSV.
5. Question card answered with a chip; the lane resumes.
6. Cloud turns orange; tray; "Approve & always allow"; the policy line.
7. Artifact v1 → v2 after a steering note.
8. Run summary: cost −46 % vs baseline, memories, skill diff.
9. Run it again: faster, cheaper, "learned" chip.
10. Terminal: curl to `/v1/chat/completions` on the Nebius endpoint; the same run appears in the web timeline.

## 8. Accessibility and copy

- Every lane and segment has an accessible name ("Researcher, Super, web
  search, 2.1 s"); the timeline is also a list for screen readers.
- Color is never the only signal: orange comes with the word "Needs you".
- Copy: verbs on buttons (Run, Steer, Reply, Approve), no "Submit"; errors say
  what happened and what to do ("Token Factory refused the key. Check
  NEBIUS_API_KEY in .env.local.").
