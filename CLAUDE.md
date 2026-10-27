# Nimbus — builder rules

Nimbus is a 3-day hackathon build for the Nebius x NVIDIA Global AI Hackathon
(Personal AI track). Deadline: **Oct 30, 2026, 10:00 PDT** (17:00 UTC, 00:00 Oct 31 ICT).
The plan lives in `docs/PLAN.md`; the architecture in `docs/SPEC.md`; the Nebius
inventory in `docs/NEBIUS.md`; the submission kit in `docs/SUBMISSION.md`.
Read `docs/PLAN.md` first in every session. Work the phases in order.

## Three checkpoints — apply them every time, out loud, in one or two lines

1. **Before a plan:** "Is this the right approach?" Name the simplest thing that
   would satisfy the phase's exit test. If the plan has more than one new
   dependency or more than one unproven integration, cut it down first.
2. **When an error repeats (same error twice):** "Am I digging in the wrong place?"
   Stop patching. Re-read the failing input and the docs for the API involved,
   write down the hypothesis, and test it in isolation (a one-file script) before
   touching the app again. Three repeats means change the approach, not the patch.
3. **Before saying "done":** "What did I miss?" Run the phase's exit test for
   real (not from memory), check the deadline clock, check the submission
   checklist in `docs/SUBMISSION.md`, and list anything unverified by name.

## Scope discipline

- Ship the spine first: Token Factory client → one headless run → timeline UI →
  approval composer → memory + skills loop → deploy. Stretch items are marked
  STRETCH in the plan and are not started until the spine's exit tests pass.
- Nemotron routing is fixed in `src/lib/models.ts`; do not add other model
  families. Every model call goes through Nebius Token Factory.
- Keep the demo path green at all times: `pnpm demo` must run end to end on
  every commit after phase 1.

## Conventions

- Next.js 15 App Router, React 19, TypeScript strict, Tailwind v4, shadcn CLI 3,
  React Bits Pro "Sorbet" blocks, Manrope. Package manager: pnpm.
- Secrets only in `.env.local` (gitignored). `.env.example` lists every variable.
- Commit messages: imperative subject, short body. No AI attribution lines of any kind.
- Public repo, MIT license at the root, README with setup + "How we used Nemotron / Token Factory".
- GitHub account for pushes and PRs: `harrymove-ctrl` (check `gh auth status` first).
