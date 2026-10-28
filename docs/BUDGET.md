# Real-model day: spend plan and guards

Written 2026-10-27 for the final day (Oct 30). Goal: switch the real
Nemotron path on, get real numbers and a real demo, and spend as little of the
credit as possible. Everything before that day stays in mock mode (PLAN §8).

## Credit and prices

- Credit: $25 Token Factory promo (code in PLAN §1, verify on the form) +
  $25 from the Builder Program. Tavily: free tier credits via the Builder Program.
- Prices per 1M tokens in/out: Ultra 1.00/3.00 (cached input 0.12), Super
  0.30/0.90 (cached 0.06), Nano 0.06/0.24.
- A demo run in mock mode is 60–80k tokens. With real models and the router
  on, expect 40–90k tokens, about 70 % of it Super and Nano, so
  **$0.04–0.12 per run**. Ultra is called 2–3 times per run with a stable
  prefix, so most of its input is at the cached price.

## What runs on real models, and how many times

| Step | Runs | Est. cost | Purpose |
|---|---|---|---|
| `pnpm smoke` | 1 | < $0.01 | Three tiers answer, one tool call. Proves the ids, the key and function calling |
| Checkout demo, router on | 3 | $0.30 | Shake out real-model prompt issues; the third clean run is **recorded** |
| Checkout demo, router off | 1 | $0.20 | Real baseline for the −X % claim |
| Mezo and Inbox workstreams | 1 each | $0.20 | Shows breadth in the video and the README |
| Eval pass, real, router on | 1 (15 goldens) | $1.00–1.50 | Real pass rate |
| Eval pass, real, router off | 1 | $1.50–2.00 | The "under 2 % quality drop" number |
| Video takes | 0 real | $0 | The video is recorded from the **recorded real run replayed** (below) |
| Deploy check on the Nebius endpoint | 2 runs | $0.20 | Proves the hosted URL |
| Reserve for surprises | — | $2.00 | Retries, a prompt fix, one more eval pass |
| **Total** | | **≈ $6–7** | Under a quarter of the credit |

## The trick that keeps the video free: record real runs, replay them

The Phase 2a replay source already streams a RunEvent[] fixture through the
same routes as the live runtime. On the real-model day:

1. Run Checkout once cleanly on real models with `NIMBUS_RECORD_REAL=1`. The
   runtime writes `fixtures/real-runs/checkout-<ts>.events.json` with every
   event, real usage numbers and real artifacts.
2. Re-record the demo video as many times as needed from that fixture with
   `NIMBUS_REPLAY=fixtures/real-runs/checkout-<ts>.events.json`. Zero spend,
   and the video still shows real Nemotron output and real costs. The README
   says so explicitly ("recorded from a real run on <date>, replayed for the video").
3. The same fixtures become eval goldens (`pnpm demo --record`), so the
   golden set grows at no extra cost.

## Spend guards (build these before the keys go in; mock mode can test them)

- `NIMBUS_RUN_CAP_USD` (default 0.25): the runtime stops a run with
  `run.error` "spend cap" when its running cost passes the cap; the header
  pill shows "Cap hit". Tested in mock by setting the cap to 0.01.
- `NIMBUS_DAY_CAP_USD` (default 5): a daily counter in SQLite; past the cap
  every new run is refused with a clear message in the composer and the
  cloud stays blue (it is not an approval).
- Per-role `max_tokens`: Ultra 1,200 out, Super 1,500, Nano 600. Ultra is
  never used for a hop whose brief is under 400 characters (router rule).
- `NIMBUS_DEV_CHEAP=1` for any debugging on real models: everything on Nano.
- Response cache on: identical hops never pay twice. The cost line shows
  "cached" hops.
- Tavily: `max_results` 5, no raw content, one search per Researcher hop
  unless the orchestrator asks for more.
- A visible spend meter in the run header and a day total in the rail
  footer ("Today $0.84 of $5.00").
- Kill switch: `NIMBUS_MODEL=mock` in `.env.local` returns everything to free
  in one restart.

## The day, hour by hour (ICT; deadline 00:00 Oct 31)

| Time | Step | Gate |
|---|---|---|
| 09:00 | Keys in `.env.local`; `pnpm smoke` | three answers + one tool call |
| 09:30 | Checkout on real models, router on, run 1–3; fix prompts between runs | run 3 clean: approval, artifact v2, summary |
| 10:30 | Record run 3 (`NIMBUS_RECORD_REAL=1`), router-off run for the baseline | real −X % in the header |
| 11:00 | Mezo and Inbox once each | artifacts look right |
| 11:30 | Real eval, router on then off | report.json with both deltas |
| 13:00 | Docker build (in CI or on a machine with Docker), push, `nebius ai endpoint create`, one job | public URL loads; job completed |
| 15:00 | README numbers, feedback text, repo public | README matches reality |
| 16:00 | Record the video from the real-run replay (3 takes), upload | public YouTube link |
| 18:00 | Devpost form submitted | confirmation email |
| 18:30–23:00 | Buffer. Nothing new starts after 21:00 | — |

## If something is wrong with the real models

- Function calling fails on a tier: pin that role to Super (ceiling) and
  note it in the feedback. Do not spend more than two runs diagnosing.
- Ultra is slow (> 60 s per plan): set the orchestrator ceiling to Super for
  the demo and say so; the router story still holds.
- Credits refused or key invalid: ship the video from the mock replay with a
  clear caption, and keep the real-model section of the README honest. A
  working mock demo beats a broken real one.
