# Demo video

`nimbus-demo.webm` and `nimbus-demo.mp4` are generated, not committed (about 14 MB and 4 MB). To regenerate:

```bash
pnpm exec playwright install ffmpeg chromium   # once
pnpm dev                                       # mock mode, no keys; note the port
NIMBUS_URL=http://localhost:3000 pnpm demo:video
```

`scripts/record-demo.ts` drives the Checkout demo end to end at 1440×900 in the dark theme: boot cloud, pick the
workstream, run, plan card and countdown, the Analyst's hop in the Inspector, the question chip, Approve & always allow,
artifact v2 and the run summary with the SKILL.md diff, then a second run showing the ✦ learned chip. It writes the
`.webm`, plus the `.mp4` when ffmpeg is installed.

For the final video, record from a real run replayed at zero cost: see `docs/BUDGET.md` (`NIMBUS_RECORD_REAL`, `NIMBUS_REPLAY`).
