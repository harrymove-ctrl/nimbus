# Nebius Token Factory Sandboxes in Nimbus

Written 2026-10-29 (about 18:20 ICT, five and a half hours before the deadline) by the planner, after the beta access
mail arrived. Goal: the crew's `run_code` tool runs model-written code in an isolated Nebius VM instead of a temp
directory on the demo server, and the app shows it. One integration, no new dependency, demo path stays green.

## What ships

- `src/runtime/sandbox.ts`: a REST client for `https://api.tokenfactory.nebius.com/sandboxes/v1` (the official SDK is
  Python; Nimbus is Node). `POST /files` uploads the script and the attached CSVs (content-addressed, cached per
  process), `POST /instances` spawns one disposable instance from a public image (`python:3.12-slim` or
  `node:20-slim`, `NIMBUS_SANDBOX_IMAGE_*` to change) with **networking off**, cwd `/work`, a 60 s timeout; then
  `GET /operations/{uuid}` is polled (honouring `Retry-After`) until `SUCCESS`, `FAILED` or `CANCELLED`, and
  `metadata.result` gives stdout, stderr, the exit code and the elapsed time.
- `run_code` (`src/runtime/tools.ts`) uses it when `NEBIUS_API_KEY` and `NEBIUS_PROJECT_ID` are set, the model mode is
  not mock and `NIMBUS_SANDBOX` is not `local`. `shell` commands (the allow-listed `pnpm eval` family) stay local: they
  need this repository. Any sandbox error falls back to the local subprocess and the result says so.
- The result carries `where: "nebius-sandbox" | "local"` and a `sandbox` block (operation id, image, elapsed, status).
  Agent I/O shows a **Nebius Sandbox** chip under the tool call: "ran in an isolated VM at Nebius, networking off ·
  python:3.12-slim · 1.4 s · op 1234abcd", or the fallback note.
- `pnpm sandbox:probe` (`scripts/sandbox-probe.mts`): whoami and limits, the public Python and Node images, one real
  run with a `data.csv`. Run it once after setting `NEBIUS_PROJECT_ID` in `.env.local`.

## Why this shape

- Sandboxes are per-operation: fresh compute from an image, run one command, return the result. That is exactly one
  `run_code` call, so there is nothing to keep alive between hops.
- Networking off: the crew's inputs are the files it was given; a sandbox that cannot call out cannot leak a key or
  reach the demo server.
- Fallback, not failure: the beta API is new to us and the day cap and the demo matter more than purity. The UI never
  hides which path ran.

## What is not done (and would be next)

- Import the images once (`POST /images/import`) if the public tags are not present in the account, and pin their
  UUIDs; the probe prints what exists.
- Run the Ship Nimbus `pnpm eval` inside a sandbox built from this repository (a saved image), so even the shell
  path leaves the server.
- Stream the operation's SSE events into the timeline segment as it runs.

## Acceptance

`pnpm sandbox:probe` prints `ok <hostname>` and a `data.csv` line; a real Checkout run on the demo shows the Nebius
Sandbox chip in Agent I/O for the Analyst's `run_code`; `pnpm eval --cheap` (mock) stays 6/6; with the project id
unset the app behaves exactly as before.
