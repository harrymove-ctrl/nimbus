// Seeded workstreams (PLAN §1, SPEC §5). Phase 1 moves these into fixtures/seed.ts + SQLite;
// the shape stays the same so GET /api/workstreams does not change for the UI.
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
    id: "ws-checkout",
    slug: "checkout-drop",
    title: "Checkout conversion drop on Oct 14",
    goal: "Why did checkout conversion drop on Oct 14? Use data.csv, find the cause, and tell #growth.",
    tools: ["web_search", "fetch_url", "run_code", "write_artifact", "send_message"],
    unread: true,
    skill: `## Checkout conversion workstream
1. Segment the funnel by platform and browser first.
2. Look for campaigns that changed traffic mix.

## Policy
(none yet)`,
  },
  {
    id: "ws-mezo",
    slug: "mezo-watch",
    title: "Watch Mezo buildathon competitors",
    goal: "Track new submissions to the Mezo buildathon and summarize what changed since last week.",
    scheduleCron: "0 9 * * 1",
    scheduleLabel: "Mondays 09:00",
    tools: ["web_search", "fetch_url", "write_artifact"],
    skill: `## Mezo watch
1. Search the buildathon page and Devpost for new projects.
2. Group by track; flag overlaps with our idea.

## Policy
(none yet)`,
  },
  {
    id: "ws-inbox",
    slug: "inbox-triage",
    title: "Weekly inbox triage",
    goal: "Triage this week's inbox export: group by urgency, draft replies, never send without approval.",
    scheduleCron: "0 8 * * 5",
    scheduleLabel: "Fridays 08:00",
    tools: ["fetch_url", "write_artifact", "send_message"],
    skill: `## Inbox triage
1. Urgent = a person waiting on us with a date.
2. Draft replies as artifacts; approval before any send.

## Policy
(none yet)`,
  },
];
