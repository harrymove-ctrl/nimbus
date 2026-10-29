# The landing page and the New workstream dialog fix

Written 2026-10-29 (about 12:10 ICT) by the planner. The user asked for two things in one message: "fix ui ux here" (two screenshots of the New workstream dialog spilling off the right edge of the window) and a landing page "like https://github.com/joelbqz/writer-computer/tree/master/apps/website, record gif some animation functions from app to the landing page".

Deadline: 2026-10-30 00:00 ICT. Keep both pieces small enough to land by about 18:00 ICT so the demo can be redeployed and checked.

## 1 · The dialog (`src/components/nimbus/new-workstream.tsx`, mounted in `src/components/nimbus/app-shell.tsx` around line 513)

What the screenshots show: the sheet starts at the left edge of the main column and runs off the right edge of the window. The last tool chip ("Open PR") and the Create button are cut. The dark veil covers only the main column, not the rail or the inspector.

Why: the overlay is `fixed inset-0` but rendered inside `<main>`, and an ancestor with a transform, filter or `contain` makes `fixed` resolve against that ancestor instead of the viewport. The sheet's `max-w-[720px]` is then wider than the column it is measured in, and `panel` has `overflow-hidden`, so the right side is clipped rather than wrapped.

Fix:
- Render the overlay through `createPortal(…, document.body)` so it covers the whole window; keep `z-50`, the click-outside close and Escape.
- Veil: `bg-neutral-950/60 backdrop-blur-[2px]` over everything, including the rail and the inspector.
- Sheet: `w-[min(560px,calc(100vw-32px))]`, `max-h-[calc(100dvh-32px)] overflow-y-auto`, centred. 20 px padding, the same `panelGlass` surface.
- Fields: full width inside the padding. Name and goal stay. Schedule and "At" sit in one row; the select gets a chevron that matches the app's other selects.
- Tool chips wrap on two lines at 560 px; the row uses `gap-2`. The default on set stays web_search, fetch_url, write_artifact.
- Buttons: Cancel and Create pinned at the bottom right, Create disabled until name and goal are filled (already so); on narrow screens the row stays visible (sticky bottom inside the scroll).
- Phone (390 px): the sheet fills the width minus 16 px gutters, chips wrap, nothing clips.
- Focus goes to Name on open (already), returns to the "New workstream" button on close.

Acceptance: at 1280 × 800 and 390 × 844 in the built-in browser, every chip and both buttons are visible, the veil covers the rail, Esc and click-outside close, and `pnpm typecheck` passes.

## 2 · The landing page

**Route.** `/welcome` (a static, server-rendered page in `src/app/welcome/page.tsx`, no database, no client state beyond the video loops). The app stays at `/` so the recorder, the tour, the video's end card ("localhost:3000") and the Devpost demo URL are unchanged. Link it from the app: the cloud mark in the header links to `/welcome`, and the README's first paragraph links to it. The Devpost "Demo URL" stays the app root; the submission text gets one line "Landing: …/welcome".

**Shape** (the reference is writer.computer: one headline, one button, then a column of captioned demo loops, then a short bulleted feature list, a three-link nav). Dark, on the app's own `globals.css` tokens (dither background, Manrope, mint accent); no new colours, no new fonts.

1. Nav: the pixel cloud mark (`public/brand/nimbus-icon-512.png`) + "Nimbus" · right: "Open the app" (→ `/`), "GitHub" (→ github.com/harrymove-ctrl/nimbus), "Video" (→ the YouTube link once it exists; until then `#` with `aria-disabled`).
2. Hero: headline "Your standing work, done every morning by a crew that asks before it acts." (the video's opening line). Under it one line: "Free and open source. Runs on NVIDIA Nemotron 3 through Nebius Token Factory." Buttons: "Open the app" (primary, mint) and `git clone github.com/harrymove-ctrl/nimbus && pnpm dev` in a copyable mono chip. Then the three numbers from the recorded take, as three small tiles: "$0.0216 · one morning", "24 % · saved by the router", "0 · replies sent without your OK".
3. Demo loops, one per row, each a `<video autoplay muted loop playsinline preload="metadata">` with a poster, inside a rounded device-less frame on the dither, with a one-line caption under it in the video's callout voice (what it is · why it helps you). Nine loops, in this order:
   | # | Caption | Source |
   |---|---|---|
   | 1 | The plan, before anything runs · who does what and the price first | take 1915 `brief1-plan-arrives` → `brief1-approve-plan` (48.5 s to 58.6 s) |
   | 2 | One row per agent · they work at the same time | `brief1-timeline` (58.6 s, take 12 s) |
   | 3 | Every step is open · click one, read what it read | `brief1-agent-io` (118.9 s to 124.6 s) |
   | 4 | Your morning, already read · inbox, calendar, GitHub on one page | `brief1-doc` (124.6 s to 138.7 s) |
   | 5 | Nothing leaves without you · approve, reject with a note, or allow from now on | `brief1-approvals` → `approve-1` (138.7 s to 151.3 s) |
   | 6 | One rule saved · you can revoke it anytime | `always-allow` (168.4 s to 182.3 s) |
   | 7 | What it learned · its own how-to, rewritten after each run | `memory-skill` (189.3 s to 199.9 s) |
   | 8 | Run two, cheaper · it starts with what it learned | `brief2-plan-arrives` (208.1 s to 213.2 s) + the first 6 s of `brief2-run` |
   | 9 | The 60-second tour · blur, focus, one thing at a time | recorded fresh with Playwright on `pnpm dev` (mock) with the run page open, the tour stepping through three steps; no run numbers in frame (crop to the spotlight) |
   Source for 1 to 8: `docs/demo/raw/nimbus-demo-20261028-1915.webm` cut by `docs/demo/raw/beats-20261028-1915.json` (times above are `tStart`/`tEnd`). Cut with ffmpeg at 1280 wide, H.264 crf 24 plus a WebM VP9 fallback, 24 fps, 6 to 12 s each, no audio, into `public/landing/loop-N.mp4|webm` and `loop-N.jpg` posters. Keep every file under 2 MB; the page should load in under 3 s on Railway. Nothing from the mock take 1258 and nothing synthetic: these are real-model runs, and the page says so in one line under the loops ("Every clip is a recorded run on the real models.").
   GIF is the user's word; use looping video (a GIF of these sizes would be 20 MB plus). If the user asks for literal GIFs later, `ffmpeg -vf "fps=12,scale=960:-1" -loop 0` from the same cuts.
4. Feature list, six items, label plus one sentence, no icons: **Asks first** (every side effect is a card; an approved one can become a rule you can revoke) · **Learns** (memories and a rewritten skill file after every run) · **Priced per step** (three Nemotron sizes, routed by job, the bill on screen) · **Yours** (your database, your keys, the tools you list) · **Always on** (schedules in the app; an OpenAI-compatible endpoint for OpenClaw and Hermes) · **Open source** (MIT, `pnpm dev` with no keys).
5. "How it uses Nebius": the three model ids with their jobs, one line each, and the endpoint line `api.tokenfactory.nebius.com`.
6. Footer: "Built alone in three days for the Nebius x NVIDIA Global AI Hackathon, Personal AI track." · GitHub · "Open the app".

**Rules.** No dashes as punctuation in any copy (commas, colons, periods). Numbers over adjectives; every number traces to `docs/video/RELEASE.md` "Measured on take 1915". Page width 720 px column, 16 px gutters on phones, no horizontal scroll at 390 px. Reduced motion: loops do not autoplay, posters show with a play control. Lighthouse performance on `/welcome` at or above 85 on Railway.

**Acceptance.** `/welcome` renders on `pnpm dev` and on Railway after the redeploy; nine loops play; all links work; the header cloud links to it; `pnpm typecheck` and `pnpm lint` pass; the README links it; a screenshot of the full page at 1280 and 390 wide is attached to the report.

## Who does what

A separate session builds both pieces on a branch and opens a PR (the builder session is busy on the production prune and a real run). The planner merges the PR to main after checking it in the browser, and asks the builder to redeploy Railway, which deploys from the checkout with the Railway CLI, not from GitHub.
