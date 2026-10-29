// The landing page (docs/LANDING.md §2): static, dark, on the app's own tokens. One headline, one button, nine captioned
// loops cut from the recorded real-model take, the feature list, how it uses Nebius, a footer. The app stays at /.
import type { Metadata } from "next";
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

const FEATURES = [
  { label: "Asks first", text: "Every side effect is a card. An approved one can become a rule, and you can revoke it." },
  { label: "Learns", text: "Memories and a rewritten skill file after every run, so the next one asks less." },
  { label: "Priced per step", text: "Three Nemotron sizes, routed by job, with the bill on screen while it runs." },
  { label: "Yours", text: "Your database, your keys, the tools you list. Nothing runs that you did not allow." },
  { label: "Always on", text: "Schedules in the app, and an OpenAI-compatible endpoint for OpenClaw and Hermes." },
  { label: "Open source", text: "MIT. pnpm dev runs it with no keys at all, on a scripted mock model." },
];

const MODELS = [
  { id: TIERS.ultra, job: "plans the run, routes each hop and reviews the result (the Orchestrator)." },
  { id: TIERS.super, job: "does the work: the Researcher, the Analyst and the Writer." },
  { id: TIERS.nano, job: "checks the output and writes the memories (the Checker and the Learner)." },
];

const navLink = "text-[14px] font-bold text-neutral-300 transition-colors hover:text-neutral-50";

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
