# Sound

Nimbus plays short interaction cues with [cuelume](https://cuelume.dev) 0.2.8 (MIT). It synthesizes them live with Web Audio, so there are no audio files and nothing goes over the network. The code is in `src/components/nimbus/sound.tsx`.

- **Theme:** `default` (glass, wood, soft mallets). `press` was the other candidate. It rings a deep note on every click, which is too heavy for a tool people click all day. cuelume recommends `default` or `mech` for everyday use and `bubble` for playful moments.
- **Volume:** global `setVolume(0.6)`. A per-cue volume multiplies on top of it, for example the retry `success` at 0.4.
- **Toggle:** the speaker switch in the top bar, next to the status pill. It is on by default, and the choice is saved in `localStorage["nimbus:sound"]` (`on`/`off`). Turning sound on calls `unlock()` inside the click and then plays `toggle`. Otherwise the first click or key anywhere on the page unlocks audio. Off is silent at once, including the declarative cues.
- **Never:** a cue per streamed token, per tool call, on hover, or for a live number that keeps changing, such as the composer's cost estimate.
- **Checking without listening:** set `localStorage["nimbus:cue-log"] = "1"` and each outcome cue is logged as `console.debug("[cue]", name, options)`. The declarative cues are not logged. Count `AudioBufferSourceNode.start` calls to see those.

## Outcome cues (from run state, `useRunCues`)

Each cue plays once per transition. If several of these land in the same batch of events, only the weightiest plays, and a cue does not repeat within 1.5 s: three approvals asked together give one `attention`. Opening a run that already happened replays its log, so cues stay silent for the first 700 ms of a run this tab did not start. Scrubbing and replay never play cues. A run you stop or cancel plays nothing after your click.

| Moment | Cue | Options |
|---|---|---|
| Run started (RUN, ⌘Enter, the rail's ▶, Run now) | `loading` | subtle |
| Draft plan arrives (the plan card asks for approval) | `ready` | subtle |
| Approval or question needs you (cloud turns orange, tray opens, pill says Needs you) | `attention` | |
| Approve (card, tray, status pill, `/approve`) | `success` | |
| Approve & always allow, or Approve all low-risk | `success` | strong |
| Reject (card, tray, status pill) | `close` | |
| A step, agent or tool call fails ✕ | `error` | |
| The same tool succeeds on retry | `success` | volume 0.4 |
| Run failed | `error` | |
| Run done | `success` | |
| Run summary appears (tiles count up for 700 ms) | `count` | duration 700, 250 ms after the summary |
| The run saved memories (the summary's "N memories saved") | `ready` | 1.1 s after the summary |

## Control cues (`data-cuelume-*`, played by `bind()`)

| Control | Cue |
|---|---|
| Rail: Overview, a workstream, Pick a workstream list | `navigate` |
| Rail: ▶ Run | `tap` |
| Rail: ⋯ menu | `open` subtle |
| Rail menu items (Run now, Edit schedule, Archive, schedule presets) | `select` |
| Rail: Archived list | `open` / `close` subtle, Restore `tap` subtle |
| Composer primary button (RUN, STEER, REPLY, APPROVE PLAN), also from Enter | `tap` |
| Composer CANCEL while planning, CANCEL on a plan | `close` |
| Composer STOP (opens the confirm) / Stop / Keep going | `open` subtle / `close` strong / `tap` subtle |
| Goal templates, slash-menu items | `select` |
| Tools, Mode, Tier chips | `open` / `close` subtle |
| Tools items (checkboxes) | `toggle` |
| Mode and Tier items | `select` |
| Attach chip | `tap` subtle |
| Remove an attached file | `close` subtle |
| Plan card: move a step (buttons or drag-and-drop) | `select`, direction back or forward |
| Plan card: Add step / Remove step | `tap` subtle / `close` subtle |
| Plan card: Approve plan, Revise | `tap` |
| Plan card: open / collapse / cancel | `open` subtle / `close` subtle / `close` |
| Question options | `select` |
| Approval card: Reject with a note / back | `open` subtle / `close` subtle |
| Artifact chip in the transcript | `open` subtle |
| Inspector tabs, artifact versions, doc/code, view modes | `select` |
| Inspector Copy | `success` subtle |
| Timeline segment, replay speed | `select` |
| Timeline scrub (once when the drag starts) | `select` subtle |
| Timeline replay | `tap` |
| Timeline expand / collapse, clear trace, back to live | `open` / `close` subtle |
| Status pill open / close | `open` / `close` subtle |
| Status pill: open a run | `navigate` |
| Status pill: pause | `toggle` |
| Status pill: stop | `close` strong |
| Memory tab: diff and raw switches | `toggle` |
| Memory tab: revert SKILL.md | `tap` |
| Memory tab: Revoke (first click) / confirm, Forget | `tap` subtle / `close` strong |
| Top bar: Workstreams and Inspector drawers | `open` / `close` |
| Phone tabs (RUN, CHAT, DOC, MEMORY) | `select` |
| Dismiss a notice | `close` subtle |
