// Seeded workstreams (docs/CASES.md): the rail shows them in this order. seedWorkstreams() (src/db/index.ts) writes
// them to SQLite and keeps title, goal, schedule and tools in step with this file.
export type Workstream = {
  id: string;
  /** model name after `nimbus/` on the OpenAI-compatible endpoint */
  slug?: string;
  title: string;
  goal: string;
  scheduleCron?: string;
  scheduleLabel?: string;
  tools: string[];
  /** current SKILL.md content, shown in the Inspector's Memory tab */
  skill: string;
  unread?: boolean;
  /** what the same work costs a person by hand, in minutes: an estimate, shown labelled as one (impact line, Overview) */
  estimatedManualMinutes: number;
};

export const TOOL_LABELS: Record<string, string> = {
  web_search: "Web search",
  fetch_url: "Fetch page",
  run_code: "Run code",
  write_artifact: "Write doc/code",
  send_message: "Send message",
  read_repo: "Read repo",
  open_pr: "Open PR",
};

export const WORKSTREAMS: Workstream[] = [
  {
    id: "ws-ship-nimbus",
    estimatedManualMinutes: 45,
    slug: "ship-nimbus",
    title: "Ship Nimbus",
    goal: "Keep Nimbus shipping: run the evals, find what fails, fix it, and open a pull request for me to review.",
    tools: ["read_repo", "run_code", "write_artifact", "open_pr", "fetch_url"],
    skill: `## Ship Nimbus
1. Run the evals and find what fails.
2. Fix it in a patch artifact; never push to main.

## Policy
(none yet)`,
  },
  {
    id: "ws-radar",
    estimatedManualMinutes: 25,
    slug: "hackathon-radar",
    title: "Hackathon radar",
    goal: "Every morning: what changed on the Nebius × NVIDIA hackathon and the Mezo buildathon pages, who else is building a personal agent, and what we should say differently.",
    scheduleCron: "0 9 * * *",
    scheduleLabel: "Daily 09:00",
    tools: ["web_search", "fetch_url", "write_artifact", "send_message"],
    unread: true,
    skill: `## Hackathon radar
1. Search the hackathon and buildathon pages for what changed.
2. Write a short digest and send it to #team.

## Policy
allow: send_message to #team for this workstream`,
  },
  {
    id: "ws-brief",
    estimatedManualMinutes: 20,
    slug: "morning-brief",
    title: "Morning brief",
    goal: "At 08:00, read my inbox export, today's calendar and GitHub notifications; give me one page: what needs me today, drafts for the three replies that matter, and what can wait.",
    scheduleCron: "0 8 * * 1-5",
    scheduleLabel: "Weekdays 08:00",
    tools: ["read_repo", "fetch_url", "write_artifact", "send_message"],
    skill: `## Morning brief
1. Urgent = a person waiting on us with a date.
2. Draft replies as artifacts; approval before any send.

## Policy
(none yet)`,
  },
  {
    id: "ws-audit",
    estimatedManualMinutes: 60,
    slug: "cost-audit",
    title: "Token Factory cost audit",
    goal: "Weekly: read our usage log, find the five most expensive hops, propose router rule changes, prove the saving with the evals.",
    scheduleCron: "0 10 * * 1",
    scheduleLabel: "Mondays 10:00",
    tools: ["read_repo", "run_code", "write_artifact"],
    skill: `## Token Factory cost audit
1. Rank the week's hops by cost.
2. Propose router rule changes; writing them needs approval.

## Policy
(none yet)`,
  },
  {
    id: "ws-release",
    estimatedManualMinutes: 30,
    slug: "release-watch",
    title: "Release watch",
    goal: "Watch Next.js, the AI SDK and libsql releases; tell me what breaks us and open an upgrade PR when it is safe.",
    tools: ["fetch_url", "read_repo", "run_code", "write_artifact", "open_pr"],
    skill: `## Release watch
1. Read the release notes against our versions.
2. Open an upgrade PR only when it is safe.

## Policy
(none yet)`,
  },
  {
    id: "ws-checkout",
    estimatedManualMinutes: 40,
    slug: "checkout-drop",
    title: "Checkout conversion drop on Oct 14",
    goal: "Why did checkout conversion drop on Oct 14? Use data.csv, find the cause, and tell #growth.",
    tools: ["web_search", "fetch_url", "run_code", "write_artifact", "send_message"],
    skill: `## Checkout conversion workstream
1. Segment the funnel by platform and browser first.
2. Look for campaigns that changed traffic mix.

## Policy
(none yet)`,
  },
];

/** Workstream ids the seed used before docs/CASES.md; seedWorkstreams() removes them from the database. */
export const LEGACY_WORKSTREAM_IDS = ["ws-mezo", "ws-inbox"];
