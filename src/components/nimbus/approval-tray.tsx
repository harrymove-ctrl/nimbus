"use client";

import { ShieldAlert } from "lucide-react";
import type { ApprovalItem } from "@/lib/run-view";
import { buttonSm, cx, ghostButton, primaryButton, secondaryButton } from "./ui";

// Sticky tray above the composer (H12 = 44), only while something is pending.
export function ApprovalTray({
  pending,
  onApprove,
  onReject,
  onApproveAllLow,
}: {
  pending: ApprovalItem[];
  onApprove: (a: ApprovalItem) => void;
  onReject: (a: ApprovalItem) => void;
  onApproveAllLow: () => void;
}) {
  if (pending.length === 0) return null;
  const first = pending[0];
  const lowCount = pending.filter((a) => a.action.risk === "low").length;
  return (
    <div role="region" aria-label="Pending approvals" className="nimbus-tray mx-auto flex min-h-11 w-full max-w-[720px] items-center gap-2 rounded-xl border border-orange-400/30 bg-orange-500/10 px-3 py-1.5">
      <ShieldAlert className="size-4 shrink-0 text-orange-300" aria-hidden="true" />
      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-orange-400 px-1.5 text-[11px] font-extrabold text-neutral-950 tabular-nums">{pending.length}</span>
      <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-neutral-100">
        {pending.length} waiting · {first.action.summary}
      </p>
      <button type="button" onClick={() => onReject(first)} className={cx(secondaryButton, buttonSm, "h-8")}>
        Reject
      </button>
      <button type="button" onClick={() => onApprove(first)} className={cx(primaryButton, buttonSm, "h-8")}>
        Approve
      </button>
      {lowCount > 0 && (
        <button type="button" onClick={onApproveAllLow} className={cx(ghostButton, buttonSm, "hidden h-8 sm:inline-flex")}>
          Approve all low-risk
        </button>
      )}
    </div>
  );
}
