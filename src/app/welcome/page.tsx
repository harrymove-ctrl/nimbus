// The landing page (docs/LANDING.md §2): static, dark, on the app's own tokens. One headline, one button, nine captioned
// loops cut from the recorded real-model take, the three doors (web, phone, terminal), the feature list, how it uses
// Nebius, a footer. The app stays at /.
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Aurora } from "@/components/dithercn/aurora";
import { buttonMd, cx, primaryButton, secondaryButton } from "@/components/nimbus/ui";
import { TIERS } from "@/lib/models";
import { CopyChip, Loop } from "./loop";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Nimbus · your standing work, done every morning",
  description: "A crew of NVIDIA Nemotron 3 agents that runs your standing work, asks before it acts and learns from every run. Free and open source, on Nebius Token Factory.",
};

const REPO = "https://github.com/harrymove-ctrl/nimbus";
const VIDEO: string | null = "https://www.youtube.com/watch?v=obMWKCewVTY"; // the 2:40 submission video

// Every number here is from docs/video/RELEASE.md "Measured on take 1915": two real runs of the Morning brief
// (run_724b8d9d, then run_915dfc1d the next morning) on Nemotron 3 through Nebius Token Factory.
const NUMBERS = [
  { value: "$0.0216", label: "one morning, the first run" },
  { value: "$0.0209", label: "the next morning, 3\u00a0% cheaper" },
  { value: "24\u00a0%", label: "saved by the router, 27\u00a0% the next morning" },
  { value: "58,950", label: "tokens across the crew in run one" },
  { value: "23", label: "model calls in run one, with 21 tool calls" },
  { value: "3", label: "sends you approved, each with a card" },
  { value: "1", label: "rule you saved, used the next morning with no card" },
  { value: "16", label: "memories after two mornings" },
  { value: "0", label: "replies sent without your OK" },
];
const RELEASE = `${REPO}/blob/main/docs/video/RELEASE.md`;

// In the video's callout voice: what it is · why it helps you. The source beats are in scripts/cut-landing-loops.sh.
const LOOPS = [
  { what: "The plan, before anything runs", why: "who does what and the price first" },
  { what: "One row per agent", why: "they work at the same time" },
  { what: "Every step is open", why: "click one, read what it read" },
  { what: "Your morning, already read", why: "inbox, calendar, GitHub on one page" },
  { what: "Nothing leaves without you", why: "approve, reject with a note, or allow from now on" },
  { what: "One rule saved", why: "you can revoke it anytime" },
  { what: "What it learned", why: "its own how-to, rewritten after each run" },
  { what: "Run two, cheaper", why: "it starts with what it learned" },
  { what: "The 60-second tour", why: "blur, focus, one thing at a time" },
];

// Three doors to the same crew. Each proof line is what was checked, and nothing more: the web line is the production
// run run_668c7252 (its events: three run_code calls with where "nebius-sandbox", 0.63, 0.75 and 0.71 s inside the
// VM); the phone and MCP lines say "pending" until a real run exists, so each is one string to change.
const SANDBOX_RUN = "run_668c7252";
const TELEGRAM_PROOF = "Mock-tested 40/40 against a stub Bot API (pnpm check:telegram). Real run from a phone: pending.";
const MCP_PROOF = "nimbus mcp: mock-tested with the CLI, 36/36 (pnpm check:cli). Real run from Claude Code: pending.";
// docs/CLI.md "nimbus doctor", read only against production on Oct 29. The Telegram row is optional and was not set.
const DOCTOR = [
  { ok: true, name: "Nimbus", detail: "production answers · real Nemotron models" },
  { ok: true, name: "Token Factory models", detail: "the key works · Ultra, Super and Nano listed" },
  { ok: true, name: "Sandboxes whoami", detail: "key and project accepted · instance_max_timeout 3600" },
  { ok: true, name: "Sandbox images", detail: "python:3.12-slim and node:20-slim ready" },
  { ok: false, name: "Telegram", detail: "NIMBUS_TELEGRAM_BOT_TOKEN not set (optional)" },
  { ok: true, name: "Data", detail: "on the server · 7 workstreams, 7 with a SKILL.md" },
  { ok: true, name: "Day cap", detail: "today $0.31 of $1.00 · run cap $0.25" },
];
const DOC = (f: string) => `${REPO}/blob/main/docs/${f}`;

const FEATURES = [
  { label: "Asks first", text: "Every side effect is a card. An approved one can become a rule, and you can revoke it." },
  { label: "Learns", text: "Memories and a rewritten skill file after every run, so the next one asks less." },
  { label: "Priced per step", text: "Three Nemotron sizes, routed by job, with the bill on screen while it runs." },
  {
    label: "Runs code in Nebius Sandboxes",
    text: "The code the crew writes runs in a disposable VM at Nebius, networking off, pandas and numpy ready: 3.5 to 4.9 s a call, under 0.8 s of it inside the VM.",
  },
  { label: "Yours", text: "Your database, your keys, the tools you list. Nothing runs that you did not allow." },
  { label: "Always on", text: "Schedules in the app, your own Telegram bot, a CLI with MCP, and an OpenAI-compatible endpoint for OpenClaw and Hermes." },
  { label: "Open source", text: "MIT. pnpm dev runs it with no keys at all, on a scripted mock model." },
];

const MODELS = [
  { id: TIERS.ultra, job: "plans the run, routes each hop and reviews the result (the Orchestrator)." },
  { id: TIERS.super, job: "does the work: the Researcher, the Analyst and the Writer." },
  { id: TIERS.nano, job: "checks the output and writes the memories (the Checker and the Learner)." },
];

const navLink = "text-[14px] font-bold text-neutral-300 transition-colors hover:text-neutral-50";
const proofLink = "underline decoration-white/25 underline-offset-2 hover:text-neutral-200";

/** One door: a typographic card on a static ordered-dither glow (public/landing/door-dither.svg, tinted mint by a mask). */
function Door({ label, where, what, why, children }: { label: string; where: string; what: string; why: string; children: ReactNode }) {
  return (
    <article className="relative overflow-hidden rounded-[calc(var(--rb-r-6xl,26px))] border border-white/10 bg-neutral-900 px-5 py-5 sm:px-7 sm:py-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-full bg-[var(--rb-accent)] opacity-[0.13] [mask-image:url(/landing/door-dither.svg)] [mask-size:100%_100%] sm:w-3/4"
      />
      <div className="relative flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <span className="shrink-0 whitespace-nowrap rounded-[calc(var(--rb-r-full,999px))] border border-white/15 bg-neutral-950/70 px-2.5 py-0.5 text-[12px] font-bold text-neutral-50">{label}</span>
          <code className="truncate font-mono text-[12px] text-neutral-500">{where}</code>
        </div>
        <p className="flex flex-col gap-0.5 text-[18px]/[26px] sm:text-[20px]/[28px]">
          <span className="font-extrabold tracking-tight text-neutral-50">{what}</span>
          <span className="font-medium text-neutral-400">{why}</span>
        </p>
        <div className="flex flex-col gap-2 text-[13px]/[20px] font-semibold text-neutral-400">{children}</div>
      </div>
    </article>
  );
}

export default function Welcome() {
  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100">
      {/* a thin dithered aurora hangs under the nav, above the headline, and fades out before the text (the app's own shader) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[130px] overflow-hidden opacity-70 [mask-image:linear-gradient(to_bottom,black_45%,transparent)]">
        <Aurora cell={4} intensity={0.5} glow={0.6} curtains={2} direction="down" className="absolute inset-0" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[720px] flex-col px-4 pb-16">
        <nav className="flex h-16 items-center gap-4" aria-label="Landing">
          <Link href="/welcome" className="flex items-center gap-2.5">
            <Image src="/brand/nimbus-icon-512.png" alt="" width={32} height={32} className="size-8 rounded-md" priority />
            <span className="text-[16px] font-extrabold tracking-tight text-neutral-50">Nimbus</span>
          </Link>
          <span className="flex-1" />
          <Link href="/" className={navLink}>
            Open the app
          </Link>
          <a href={REPO} className={navLink}>
            GitHub
          </a>
          {VIDEO ? (
            <a href={VIDEO} className={navLink}>
              Video
            </a>
          ) : (
            <a href="#" aria-disabled="true" title="The video is on its way" className={cx(navLink, "cursor-default text-neutral-600 hover:text-neutral-600")}>
              Video
            </a>
          )}
        </nav>

        <header className="flex flex-col gap-6 pt-14 pb-14 sm:pt-20">
          <h1 className="text-[34px]/[1.12] font-extrabold tracking-tight text-neutral-50 sm:text-[46px]/[1.1]">Your standing work, done every morning by a crew that asks before it acts.</h1>
          <p className="text-[17px]/[26px] font-medium text-neutral-400">Free and open source. Runs on NVIDIA Nemotron 3 through Nebius Token Factory.</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/" className={cx(primaryButton, buttonMd)}>
              Open the app
            </Link>
            {VIDEO && (
              <a href={VIDEO} className={cx(secondaryButton, buttonMd)}>
                Watch the video · 2:40
              </a>
            )}
            <CopyChip text="git clone github.com/harrymove-ctrl/nimbus && pnpm dev" />
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {NUMBERS.map((n) => (
              <div key={n.label} className="flex flex-col gap-1 rounded-[calc(var(--rb-r-xl,12px))] border border-white/10 bg-neutral-900/70 px-4 py-3">
                <dd className="order-first text-[22px]/[26px] font-extrabold tabular-nums tracking-tight text-neutral-50 sm:text-[26px]/[30px]">{n.value}</dd>
                <dt className="text-[12px]/[16px] font-semibold text-neutral-400">{n.label}</dt>
              </div>
            ))}
          </dl>
          <p className="text-[12px]/[18px] font-semibold text-neutral-500">
            Measured on the recorded take of Oct 29: two real runs of the Morning brief, the second one starting from what the first one learned. Every number is in the{" "}
            <a href={RELEASE} className="underline decoration-white/25 underline-offset-2 hover:text-neutral-300">
              release notes
            </a>
            .
          </p>
        </header>

        <section className="flex flex-col gap-10" aria-label="What it looks like">
          {LOOPS.map((l, i) => (
            <Loop key={l.what} n={i + 1} what={l.what} why={l.why} first={i === 0} />
          ))}
          <p className="text-center text-[13px] font-semibold text-neutral-500">Every clip is a recorded run on the real models.</p>
        </section>

        <section className="mt-20 flex flex-col gap-6" aria-labelledby="doors">
          <div className="flex flex-col gap-2">
            <h2 id="doors" className="text-[22px] font-extrabold tracking-tight text-neutral-50">
              Three doors to the same crew
            </h2>
            <p className="text-[15px]/[23px] font-medium text-neutral-400">One crew, one timeline, one set of rules. Start a run, approve it and read it from whichever door is closest.</p>
          </div>

          <Door label="Web" where="/" what="The ops room" why="every agent, every step and every cent on one timeline">
            <p>
              <span className="text-neutral-200">Proof:</span> the Checkout run{" "}
              <Link href={`/?run=${SANDBOX_RUN}`} className={cx(proofLink, "font-mono text-[12px]")}>
                {SANDBOX_RUN}
              </Link>{" "}
              on production. Its three run_code calls each ran in a Nebius Sandbox VM (0.63, 0.75 and 0.71 s inside the VM), and the timeline marks each one with the Nebius Sandbox chip.
            </p>
          </Door>

          <Door label="Phone" where="Telegram" what="Approvals as buttons" why="Approve, Always allow or Reject from your phone, and the web timeline records it">
            <p>
              <span className="text-neutral-200">Proof:</span> {TELEGRAM_PROOF}{" "}
              <a href={DOC("TELEGRAM.md")} className={proofLink}>
                Setup
              </a>
            </p>
          </Door>

          <Door label="Terminal and coding agent" where="nimbus · nimbus mcp" what="The crew from your shell" why="run, approve and read it in the terminal, or let Claude Code or Cursor do it over MCP">
            <div className="rounded-[calc(var(--rb-r-xl,12px))] border border-white/10 bg-neutral-950/80 px-3.5 py-3 font-mono text-[11.5px]/[18px] font-normal sm:text-[12px]/[19px]">
              <p className="text-neutral-500">$ NIMBUS_URL=…railway.app pnpm nimbus doctor</p>
              <ul className="mt-1.5 flex flex-col gap-0.5">
                {DOCTOR.map((r) => (
                  <li key={r.name} className="grid grid-cols-[1.25rem_1fr] sm:grid-cols-[1.25rem_11.5rem_1fr]">
                    <span className={r.ok ? "text-[var(--rb-accent)]" : "text-neutral-500"}>{r.ok ? "✓" : "·"}</span>
                    <span className="text-neutral-200">{r.name}</span>
                    <span className="col-start-2 text-neutral-400 sm:col-start-3">{r.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p>
              <span className="text-neutral-200">Proof:</span> the rows above are nimbus doctor against production on Oct 29. {MCP_PROOF}{" "}
              <a href={DOC("CLI.md")} className={proofLink}>
                Commands
              </a>
            </p>
          </Door>
        </section>

        <section className="mt-20 flex flex-col gap-6" aria-labelledby="features">
          <h2 id="features" className="text-[22px] font-extrabold tracking-tight text-neutral-50">
            What it does
          </h2>
          <ul className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f.label} className="flex flex-col gap-1">
                <span className="text-[15px] font-bold text-neutral-50">{f.label}</span>
                <span className="text-[14px]/[21px] font-medium text-neutral-400">{f.text}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-20 flex flex-col gap-5" aria-labelledby="nebius">
          <h2 id="nebius" className="text-[22px] font-extrabold tracking-tight text-neutral-50">
            How it uses Nebius
          </h2>
          <ul className="flex flex-col gap-3">
            {MODELS.map((m) => (
              <li key={m.id} className="flex flex-col gap-0.5 text-[14px]/[21px] font-medium text-neutral-400 sm:flex-row sm:gap-3">
                <code className="shrink-0 font-mono text-[13px] text-[var(--rb-accent)]">{m.id}</code>
                <span>{m.job}</span>
              </li>
            ))}
          </ul>
          <p className="text-[14px]/[21px] font-medium text-neutral-400">
            Every model call goes to <code className="font-mono text-[13px] text-neutral-200">api.tokenfactory.nebius.com</code>, the OpenAI-compatible endpoint of Nebius Token Factory. The router picks the tier per hop, and the saving against
            running every hop on its ceiling tier is on the run summary.
          </p>
          <p className="text-[14px]/[21px] font-medium text-neutral-400">
            Every run_code call goes to <code className="font-mono text-[13px] text-neutral-200">api.tokenfactory.nebius.com/sandboxes/v1</code>, Nebius Token Factory Sandboxes: one disposable instance per call, from an
            image with pandas 3.0 and numpy, networking off, with the operation id on the timeline. The same key works for the models and the sandboxes.
          </p>
        </section>

        <footer className="mt-24 flex flex-col gap-4 border-t border-white/10 pt-8 text-[13px] font-semibold text-neutral-500 sm:flex-row sm:items-center">
          <p className="flex-1">Built alone in three days for the Nebius x NVIDIA Global AI Hackathon, Personal AI track.</p>
          <div className="flex items-center gap-3">
            <a href={REPO} className={cx(secondaryButton, "h-8 rounded-[calc(var(--rb-r-full,999px))] px-3.5 text-[13px] font-bold")}>
              GitHub
            </a>
            <Link href="/" className={cx(primaryButton, "h-8 rounded-[calc(var(--rb-r-full,999px))] px-3.5 text-[13px] font-bold")}>
              Open the app
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
