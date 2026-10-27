import type { PlanStep } from "@/lib/events";
import { ROLE_TIER, type AgentRole } from "@/lib/models";
import { getRun } from "@/runtime/source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES = Object.keys(ROLE_TIER) as AgentRole[];

// POST /api/runs/[id]/plan { steps, approve: true } | { steps, revise: true }: the person's edited draft (SPEC §17.2).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = getRun(id);
  if (!run) return Response.json({ error: "run not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { steps?: Partial<PlanStep>[]; approve?: boolean; revise?: boolean };
  // `{ approve: true }` alone approves the draft as it stands (API clients that do not edit plans)
  if (body.approve && body.steps === undefined) {
    const draft = [...run.events].reverse().find((e) => e.type === "plan");
    const steps = draft?.type === "plan" ? draft.payload.steps : undefined;
    if (!steps?.length) return Response.json({ error: "no draft plan to approve" }, { status: 409 });
    return run.planAction({ action: "approve", steps }) ? Response.json({ ok: true }) : Response.json({ error: "no plan is waiting for you" }, { status: 409 });
  }
  if (!Array.isArray(body.steps) || body.steps.length === 0 || body.steps.length > 20) return Response.json({ error: "steps: 1 to 20 steps" }, { status: 400 });
  const steps: PlanStep[] = [];
  for (const [i, s] of body.steps.entries()) {
    const text = typeof s.text === "string" ? s.text.trim().slice(0, 300) : "";
    if (!text || !ROLES.includes(s.role as AgentRole)) return Response.json({ error: `step ${i + 1}: needs text and a known role` }, { status: 400 });
    steps.push({ id: typeof s.id === "string" && s.id ? s.id.slice(0, 24) : `s${i + 1}`, text, role: s.role as AgentRole, tier: ROLE_TIER[s.role as AgentRole] });
  }
  if (!body.approve && !body.revise) return Response.json({ error: "approve or revise" }, { status: 400 });
  const ok = run.planAction({ action: body.approve ? "approve" : "revise", steps });
  return ok ? Response.json({ ok: true }) : Response.json({ error: "no plan is waiting for you" }, { status: 409 });
}
