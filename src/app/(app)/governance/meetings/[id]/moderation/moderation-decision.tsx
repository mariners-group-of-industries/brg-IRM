"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { moderateAction } from "./actions";

export function ModerationDecision({
  meetingId,
  questionId,
}: {
  meetingId: string;
  questionId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [decided, setDecided] = useState<"approved" | "dismissed" | null>(null);

  const decide = (action: "approve" | "dismiss") =>
    startTransition(async () => {
      const result = await moderateAction(meetingId, questionId, action);
      if (!result.ok) {
        toast.error(result.error ?? "Could not moderate");
        return;
      }
      setDecided(action === "approve" ? "approved" : "dismissed");
      toast.success(action === "approve" ? "Approved — visible in the room" : "Dismissed");
      router.refresh();
    });

  if (decided) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${decided === "approved" ? "border-success/30 bg-success-soft text-success" : "border-border bg-muted text-muted-foreground"}`}>
        {decided === "approved" ? <Check className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
        {decided}
      </span>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Button size="sm" variant="outline" onClick={() => decide("dismiss")} disabled={pending} className="h-8 text-muted-foreground">
        Dismiss
      </Button>
      <Button size="sm" onClick={() => decide("approve")} disabled={pending} className="h-8">
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        Approve
      </Button>
    </div>
  );
}
