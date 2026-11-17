"use client";

import { useState, useTransition } from "react";
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
import { formatDate } from "@/lib/format";
import type { ApprovalItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
  const [decided, setDecided] = useState<Record<string, "approved" | "rejected">>({});
  const [pending, startTransition] = useTransition();

  const decide = (id: string, decision: "approved" | "rejected") => {
    startTransition(() => {
      // Demo mode: decision is recorded client-side only and reported as such.
      setDecided((current) => ({ ...current, [id]: decision }));
      toast.success(
        decision === "approved" ? "Approved (demo — not persisted)" : "Rejected (demo — not persisted)",
      );
    });
  };

  const open = approvals.filter((approval) => !decided[approval.id]);

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
        <span>{open.length} open · {approvals.length - open.length} decided (this session)</span>
        {!canAct && <span>Read-only — your role cannot approve</span>}
      </p>
      {approvals.map((approval) => {
        const Icon = kindIcon[approval.kind];
        const outcome = decided[approval.id];
        return (
          <article
            key={approval.id}
            className={cn(
              "rounded-lg border border-border bg-card p-4 shadow-card transition-opacity",
              outcome && "opacity-60",
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
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {outcome ? (
                  <span className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize",
                    outcome === "approved"
                      ? "border-success/30 bg-success-soft text-success"
                      : "border-destructive/30 bg-danger-soft text-destructive",
                  )}>
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
        Approvals are audit-logged with actor, timestamp and decision once the Phase 3 database is wired.
        In this demo build, decisions live only in this browser session.
      </p>
    </div>
  );
}
