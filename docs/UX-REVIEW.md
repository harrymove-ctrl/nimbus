# UX review of rev A, and what rev B changes

Reviewed 2026-10-27 against the product goal: a personal ops room where a
crew of Nemotron agents runs standing work, asks before acting, and learns.
Judging criteria are Design, Technological Implementation, Potential Impact,
Quality of the Idea. Design is a quarter of the score, so this matters.

## Verdict on rev A

The timeline and the approval card were right. The composer and the overall
run view were wrong: they were a generic chatbot with a pill input, and
Nimbus is not a chatbot. Eight problems, in order of damage:

1. **The input did not express the product.** A pill that says "message the
   orchestrator" invites small talk. Nimbus needs the person to say *what to
   run, with which tools, how often, and what it may do without asking*. None
   of that had a control; it all had to be typed as prose and guessed by Ultra.
2. **Enter had no defined meaning while a run was live.** Is a message a new
   run, a steering note, or an answer to the crew? Undefined, so the person
   cannot predict what happens. That is the single worst UX bug in rev A.
3. **No attach affordance.** The demo workstream analyzes a CSV; the input
   had only a glyph. Files are a first-class input for an ops room.
4. **Approvals were buried in the transcript.** With three pending actions
   the person scrolls to find them. Approvals are the trust mechanism; they
   must be visible without scrolling, with a count, and a bulk action for
   low risk.
5. **No cost preview before spending.** A product that sells unit economics
   showed cost only after the run. The person should see the estimate while
   drafting and the plan (agents, tiers, tools) before the crew spends Ultra.
6. **The timeline was a dock under the chat.** It is the hero of the product
   (the reference screenshot) and had no click target: a segment could only
   show a tooltip. The transcript and the artifact had no link to the lanes.
7. **"Edit" on the approval card was unrealistic.** Editing a JSON payload in
   three days is not happening, and it is not what people want. They want
   "approve", "approve and stop asking for this kind", or "reject with a note".
8. **Workstream creation was a form.** Title, goal, tools, schedule as fields
   is admin work. The first run should start from the composer, and the plan
   card the orchestrator returns *is* the workstream once confirmed.

Smaller: the artifact panel appeared only after the first artifact, so the
right column was empty for most of a run; the legend showed no cost per
agent, which hides the router story; the phone layout had no answer for
approvals arriving while the person is on another tab.

## Rev B decisions

### Run view (sheet 1)
Center column, top to bottom: **run header** (title, status pill, time,
tokens, cost, −X % vs baseline) → **timeline strip** (240, collapsible to a
56 px summary bar) → **transcript** (plan card, messages, handoffs, resolved
approvals) → **approval tray** (sticky, only while something is pending) →
**composer card**. Right column is an **Inspector** with three tabs:
Artifact (doc/code with versions), Agent I/O (the selected lane segment's
prompt, tool calls, result, tokens, tier, route badge), Memory & skill.
Clicking a timeline segment selects it in the Inspector and scrolls the
transcript. The legend gets tokens and cost per lane.

### Composer v2 (sheet 4)
- A **card**, not a pill: textarea (1 to 6 lines) over a toolbar row.
- Toolbar left: **Attach** (files, CSV/PDF/images), **Tools** (which tools
  this run may use), **Mode** (Ask each action · Auto low-risk · Dry run),
  **Tier** (Auto router · Cheap · Max).
- Toolbar right: **cost estimate pill** (Nano, 400 ms debounce after typing
  stops, shows agents and tiers it expects) and the primary button.
- **The primary button and the placeholder change with state**, so Enter is
  always predictable: RUN when idle ("Give the crew a goal…"), STEER while
  running ("Steer the crew…", message queued for the orchestrator's next
  turn, STOP beside it), REPLY when the crew asked a question ("Answer the
  crew…").
- **Plan card** is the first transcript message of every run: agents and
  tiers, tools allowed, estimated cost, and a 3-second Cancel. No extra
  model call: the orchestrator's first turn produces it.
- **Approval tray** above the composer: count, first summary, Approve,
  Reject, Approve all low-risk; expands to the list. Cards in the transcript
  stay as the record.
- Approval card actions: **Approve**, **Approve & always allow** (writes a
  policy line into the workstream's SKILL.md, which is the learning loop
  made visible), **Reject with a note** (the note goes to the orchestrator).
- **Slash menu** when the text starts with `/`: run, schedule, stop,
  approve, skill, memory. `@` mentions a lane (the message goes to that
  agent's next turn).
- Keys: Enter sends, Shift+Enter newline, ⌘Enter runs on Max tier, Esc
  clears the draft or closes the menu.
- First run: the empty state is the composer with three template chips; the
  plan card's "Save as workstream" button creates the workstream with the
  goal, tools and schedule already filled in.

### Phone
Approvals arriving on another tab raise a count on the RUN tab and turn the
cloud orange in the top bar; the tray renders at the top of the CHAT tab.

### What stays
Timeline geometry (sheet 3), the Glow Cloud sizes and moods (sheet 7), the
artifact versions model, the rail, the Sorbet tokens and Manrope.

## Build impact
Phase 2 implements rev B. ai-chat-6 remains the transcript shell and
ai-chat-5 the approval card; the composer input from the blocks is replaced
by the card in sheet 4; ai-chat-2's panel becomes the Artifact tab of the
Inspector. Estimated extra cost over rev A: about 3 hours, mostly the
Inspector tabs and the state-driven button.
