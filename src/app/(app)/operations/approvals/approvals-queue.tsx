"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ClipboardCheck,
  FileText,
  Megaphone,
  ScrollText,
  UserCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatDateTime } from "@/lib/format";
import type { ApprovalItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { decideApprovalAction } from "./actions";

const kindIcon = {
  notice: Megaphone,
  resolution: ScrollText,
  document: FileText,
  proxy_batch: UserCheck,
} as const;

const kindLabel = {
  notice: "Notice",
  resolution: "Resolution",
  document: "Document",
  proxy_batch: "Proxy batch",
} as const;

export function ApprovalsQueue({
  approvals,
  canAct,
}: {
  approvals: (ApprovalItem & { companyName: string })[];
  canAct: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const decide = (id: string, decision: "approved" | "rejected") => {
    startTransition(async () => {
      const res = await decideApprovalAction(id, decision);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        decision === "approved"
          ? "Approval recorded and written to audit log"
          : "Rejection recorded and written to audit log",
      );
      router.refresh();
    });
  };

  const open = approvals.filter((approval) => !approval.status || approval.status === "pending");

  if (approvals.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center shadow-card">
        <ClipboardCheck className="mx-auto h-8 w-8 text-muted-foreground/60" strokeWidth={1.5} aria-hidden />
        <h2 className="mt-3 text-[14px] font-semibold">Nothing awaiting approval</h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          New approval requests from meetings, notices and documents will land here.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-3">
      <p className="flex items-center justify-between text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        <span>{open.length} pending · {approvals.length - open.length} decided</span>
        {!canAct && <span>Read-only — your role cannot approve</span>}
      </p>
      {approvals.map((approval) => {
        const Icon = kindIcon[approval.kind];
        const outcome = approval.status && approval.status !== "pending" ? approval.status : null;
        return (
          <article
            key={approval.id}
            className={cn(
              "rounded-lg border border-border bg-card p-4 shadow-card transition-opacity",
              outcome && "opacity-75",
            )}
          >
            <div className="flex flex-wrap items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium leading-snug">{approval.title}</p>
                <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {kindLabel[approval.kind]} · {approval.companyName} · requested by {approval.requestedBy} ·
                  due {formatDate(approval.dueDate)}
                </p>
                {outcome && approval.decidedBy && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Decided by {approval.decidedBy}{approval.decidedAt ? ` on ${formatDateTime(approval.decidedAt)}` : ""}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {outcome ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize",
                      outcome === "approved"
                        ? "border-success/30 bg-success-soft text-success"
                        : "border-destructive/30 bg-danger-soft text-destructive",
                    )}
                  >
                    {outcome === "approved" ? <Check className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
                    {outcome}
                  </span>
                ) : (
                  <>
                    <Button size="sm" variant="outline" disabled={!canAct || pending} onClick={() => decide(approval.id, "rejected")} className="text-destructive hover:text-destructive">
                      Reject
                    </Button>
                    <Button size="sm" disabled={!canAct || pending} onClick={() => decide(approval.id, "approved")}>
                      Approve
                    </Button>
                  </>
                )}
              </div>
            </div>
          </article>
        );
      })}
      <p className="text-[11px] text-muted-foreground">
        All approval and rejection decisions are recorded immediately to the append-only governance audit trail.
      </p>
    </div>
  );
}
