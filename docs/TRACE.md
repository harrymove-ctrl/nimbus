# The Trace view: every call of a run on one time axis

Written 2026-10-30, 01:10 ICT by the planner for a Sonnet builder. Deadline 2026-10-31 00:00 ICT. Budget for this
piece: 4 hours of building, 1 hour of review and deploy.

The reference the user sent is a trace viewer: one row per model call or tool call, a bar on a shared time axis,
tokens and duration on the right, a headline that says what took the time ("Generate image took 6.4 s, 45 % of the
run"), filter tabs (Multimodal, Slow tool, Failed call), and a detail card for the selected call (Started, Duration,
First token, Input, Output, Speed, the output text, Copy). Nimbus has the lane timeline (one row per agent) and
Agent I/O (one step at a time). The Trace view is the third way to read a run: **flat, chronological, per call,
with the numbers**. It must be more interactive than the reference, not just as pretty.

## Where it lives

A segmented control in the run header next to the status: **Lanes · Trace**. Lanes is today's timeline strip.
Trace replaces the strip and the transcript area with the trace panel (full main-column width), the composer stays.
The Inspector stays and keeps working: selecting a span in the trace selects the same step in Agent I/O. The choice
persists per browser in `localStorage` (`nimbus.runView`). Deep link: `?run=…&view=trace&span=<id>`.

Files: new `src/lib/trace.ts` (pure: events in, spans out), new `src/components/nimbus/trace.tsx` (the panel), new
`scripts/check-trace.mts`. Wiring: the smallest possible edits in `src/components/nimbus/app-shell.tsx` (the control
and the swap) and `src/runtime/agent.ts` plus `src/lib/events.ts` (two new optional fields on `usage`). Do not touch
`timeline.tsx`, `plan-card.tsx`, `inspector.tsx` beyond reading their exports; another agent is editing them.

## Data: spans from events (`src/lib/trace.ts`)

`buildTrace(events): Trace` where

```ts
type Span = {
  id: string;                       // segId for model calls, callId for tools, approvalId or questionId for waits
  kind: "model" | "tool" | "wait" | "gate";   // gate = plan approval
  agent: string; role: string; instance: string;
  label: string;                    // "Nemotron 3 Super", "run_code · script.py", "Approval: send to #growth"
  startMs: number; endMs?: number;  // run-relative; endMs missing while live
  failed?: boolean;
  model?: { tier: Tier; model: string; in: number; out: number; cached?: boolean; ttftMs?: number; tokPerS?: number; route?: RouteInfo };
  tool?: { name: string; input: unknown; output?: unknown; ok?: boolean; where?: "nebius-sandbox" | "local"; sandbox?: { image: string; operation: string; elapsedS?: number }; exitCode?: number };
  wait?: { what: "approval" | "question"; decision?: string; by?: string; via?: string };
  depth: 0 | 1;                     // 1 for a tool call inside a model hop, drawn indented like the reference
  parentId?: string;
};
type Trace = { spans: Span[]; totalMs: number; longest: Span | null; longestShare: number; modelCalls: number; toolCalls: number; tokens: number; failed: number; waitingMs: number };
```

Sources: `segment.think` start and end make a model span; the `route` event before it gives tier, ceiling and reason;
the `usage` event after it gives tokens. `tool.call` and `tool.result` make a tool span (`output.where`,
`output.sandbox`, `output.exitCode` when the tool is run_code). `segment.wait`, `approval.request` and
`approval.resolve`, `question` and the answering `message` make wait spans. `plan` with `awaiting` and `plan.approve`
make the gate span. A tool span whose start falls inside a model span of the same instance gets `depth 1` and that
span's id as parent (the reference's indented "Read palette" under "Gemini 2.5 Pro").

**Two new optional fields on the `usage` event** (`src/lib/events.ts`, `src/runtime/agent.ts`): `ms` (wall time of
the model call) and `ttftMs` (time to first token when the call streamed; leave it out when it did not). Compute
`tokPerS = out / ((ms - (ttftMs ?? 0)) / 1000)` in `trace.ts`, never in the UI. Old events without `ms` fall back to
the segment's duration. The fixtures under `fixtures/seed-runs/` and `fixtures/demo-run.events.json` have no `ms`; that is fine.

## The panel (`src/components/nimbus/trace.tsx`)

Top row: the run's headline numbers as in the reference: **14.1 s / 23 K tokens** on the left, "5 model calls · 4
tool calls · 2 waits" on the right, then one sentence: **"run_code took 7.1 s, 48 % of the run."** (the longest
span; for a wait: "You took 3 m 20 s to approve, 71 % of the run."). The sentence is a button: clicking it selects
that span.

Filter chips, single select, under the headline: **All · Slow · Failed · Sandbox · Waiting on you · Models · Tools**.
Slow keeps the top three spans by duration and dims the rest to 25 % (they stay, so the axis does not jump). Failed
keeps failed tool calls and fallback-routed model calls. Sandbox keeps run_code spans with `where: nebius-sandbox`.
Each chip shows its count; a chip with 0 is disabled. The chip is in the URL (`&filter=slow`).

Rows: one per span, chronological, 36 px tall. Left 260 px: the provider or tool icon (the Nemotron mark for
models, the wrench for tools, the sandbox glyph for run_code in a sandbox, the hand for waits), the label, indented
16 px at depth 1. Middle: the bar on the shared axis. Model bars are two-tone like the reference: the light part is
time to first token (when known), the solid part the rest; tool bars are solid; wait bars are hatched; a live span's
bar grows every 250 ms and ends with a pulsing cap. Failed bars get the error colour and an ✗ at the end. Right 150
px: tokens for model spans (3.3 K), duration for every span (1.2 s, 480 ms), tabular numerals.

Axis: ticks every 1 s, 5 s, 10 s or 30 s depending on the span of the run, labels "0", "5s", "10s", drawn above the
rows and repeated as faint vertical lines. The selected span's extent is a shaded column across all rows (the grey
band in the reference). The **hover cursor**: a vertical line following the mouse with the time at its top, and a
tooltip on the hovered bar (label · duration · tokens).

### Interaction (this is the point)

- **Hover** a row: highlight it, draw the cursor, and highlight the matching segment in the lane timeline and the
  Inspector (use the existing `onSelectSeg` and `selected` plumbing in `app-shell.tsx`; hovering sets a `hoverSeg`,
  not the selection). **Click** pins the selection and opens the detail card. Clicking the selected row again
  unpins.
- **Keyboard**: ↑ ↓ move the selection, Enter pins, Esc clears, `C` copies the selected span's output, `F` cycles
  the filter chips, `[` and `]` jump to the previous or next failed span, `L` jumps to the longest span.
- **Zoom**: drag on the axis or on empty row space to select a time range; the axis rescales to it with a 200 ms
  ease; a "Reset zoom" chip appears; double-click anywhere resets; pinch or ctrl-wheel zooms around the cursor.
- **Live**: while the run is live the axis extends, new rows append at the bottom with a 160 ms rise, the selected
  span stays selected, the filter stays. When the run ends the headline sentence appears with the same rise.
- **Compare**: a "vs last run" toggle in the top row, available when the workstream has an earlier finished run:
  each span's duration gets a small delta ("+0.4 s" in the error colour, "−1.1 s" in the accent) matched by label and
  order; the headline gets "run 2 was 23 % faster than run 1".
- **Share**: "Copy as JSON" (the spans) and "Download trace.json" in the top row's overflow menu. The JSON is
  OpenTelemetry-shaped (`traceId`, `spans[{spanId, parentSpanId, name, startTimeUnixNano, endTimeUnixNano,
  attributes}]`) so it opens in any tracing tool.

### The detail card (below the rows, as in the reference)

Model span: the model mark and the tier name, the model id in mono on the right (`nvidia/nemotron-3-super-120b-a12b`),
then the stat row **Started · Duration · First token · Input · Output · Speed** ("3.0 s · 1.6 s · 450 ms · 3.6 K ·
238 · 214 tok/s"; First token shows "n/a" when unknown), the route line ("Chose Super, ceiling Ultra: classifier
complexity 1"), then tabs **Output · Prompt** with the text (Output = the model's text or its tool calls rendered as
`name(args)`; Prompt = the last user message of the hop, from Agent I/O's data) and a **Copy** button. Tool span:
the tool name and, for run_code, the **Nebius Sandbox** chip (image, elapsed, operation id) or "ran locally", the
stat row **Started · Duration · Exit code · Stdout · Stderr** (byte counts), tabs **Input · Stdout · Stderr**, Copy.
Wait span: who was asked, what, how long it waited, the decision and how it arrived ("Approved via telegram").
Every card has "Open in Agent I/O" (switches the Inspector tab and selects the step).

### Phone (390 px)

The left column shrinks to the icon and a 120 px label with ellipsis, the right column to duration only, the axis
labels every other tick; the detail card becomes a bottom sheet; the chips scroll sideways. No horizontal page
scroll.

### Motion and accessibility

Rises 160 ms, zoom 200 ms ease-out, bars grow with `transform: scaleX` from the left; `prefers-reduced-motion` makes
all of it instant. Rows are `role="row"` inside `role="grid"` with `aria-selected`; the bar has `aria-label` with
label, start, duration and tokens. Contrast at least 4.5:1 for the numbers on the right. cuelume: `select` on
selection change, `open` (subtle) when the card opens, `close` on Esc.

## Tests (`scripts/check-trace.mts`, `pnpm check:trace`, mock mode, under 60 s)

1. `buildTrace` on `fixtures/demo-run.events.json` and every file under `fixtures/seed-runs/` (recorded runs): span count equals model calls plus tool
   calls plus waits plus the gate; every tool span has a parent model span of the same instance; `longest` is the
   maximum `endMs - startMs`; `longestShare` matches; the OpenTelemetry export round-trips (parse, same count).
2. A live mock run (`startRun` as in `check-chat.mts`): spans appear as events arrive; the last span of each agent
   ends when the agent ends; `ms` and `tokPerS` are present on new `usage` events; `ttftMs` is present only if the
   client streamed (assert "present or absent, never 0").
3. Filters: Slow returns three; Failed matches `failed` count; Sandbox matches `where === "nebius-sandbox"` (in mock
   that is zero, assert the chip is disabled).
4. A Playwright check is not required here (it cannot run in the sandbox); the planner checks the UI by hand.

## Acceptance

`pnpm typecheck`, `pnpm lint` (0 errors in your files), `pnpm check:trace`, `pnpm demo`, `pnpm eval`,
`pnpm check:cli`, `pnpm check:telegram`, `pnpm check:templates` all green. On `pnpm dev` (mock) at 1440 and 390 wide:
the Lanes · Trace control switches views, the headline sentence names the longest span, hover highlights the lane
timeline and Agent I/O, click opens the card with the numbers, ↑ ↓ Enter Esc C work, drag zooms and double-click
resets, the live run grows, the filter chips count correctly, Copy as JSON yields valid JSON. Report every item with
"seen" or "not verified" by name.

## Addendum (01:40 ICT): tools shown like the reference's second screen

- **One icon per tool** in the rows: web_search a globe, fetch_url a link, run_code the Nebius sandbox glyph when it
  ran at Nebius and a terminal icon when local, write_artifact a document, send_message a message bubble (a send
  icon when it went out via Telegram), read_repo the GitHub mark, open_pr the pull-request icon, save_learning a
  sparkle, ask_user a question mark. Model rows carry the Nemotron badge and the tier name. Tool bars use the lane
  timeline's tool green, model bars the model blue.
- **Row labels** are human titles ("Search the web", "Run code · script.py", "Write doc · Checkout report", "Send to
  #growth"); the card shows the raw tool id in mono on the right (`web_search`), as the reference shows "Search logs"
  and `search_logs`.
- **Tool card**: Started · Duration (plus Where and Exit code for run_code), an **Input · Output** toggle (Output
  default) with the JSON pretty-printed and syntax highlighted (keys blue, numbers orange, strings plain, braces dim),
  monospace 13 px, scrollable past 20 lines, Copy copies the shown tab. run_code's Output is the result object (ok,
  exitCode, stdout, stderr).
