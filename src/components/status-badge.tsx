import { cn } from "@/lib/utils";
import type { MeetingStatus, MeetingType, MeetingMode } from "@/lib/types";

const statusMap: Record<MeetingStatus, { label: string; className: string; dot: string }> = {
  draft: { label: "Draft", className: "border-border bg-muted text-muted-foreground", dot: "bg-slate-400" },
  notice_pending: { label: "Notice pending", className: "border-warning/40 bg-warning-soft text-warning", dot: "bg-amber-500" },
  notice_sent: { label: "Notice sent", className: "border-info/30 bg-info-soft text-info", dot: "bg-blue-600" },
  scheduled: { label: "Scheduled", className: "border-brand/30 bg-brand-soft text-brand", dot: "bg-brand" },
  live: { label: "Live", className: "border-destructive/30 bg-danger-soft text-destructive", dot: "bg-red-600" },
  voting_open: { label: "Voting open", className: "border-brand/30 bg-brand-soft text-brand", dot: "bg-brand" },
  completed: { label: "Completed", className: "border-success/30 bg-success-soft text-success", dot: "bg-green-600" },
  archived: { label: "Archived", className: "border-border bg-muted text-muted-foreground", dot: "bg-slate-300" },
};

export function MeetingStatusBadge({ status }: { status: MeetingStatus }) {
  const config = statusMap[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        config.className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} aria-hidden />
      {config.label}
    </span>
  );
}

export function MeetingTypeBadge({ type }: { type: MeetingType }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[10.5px] font-semibold tracking-wide",
        type === "AGM" ? "text-brand-navy" : "text-warning",
      )}
    >
      {type}
    </span>
  );
}

export function MeetingModeLabel({ mode }: { mode: MeetingMode }) {
  const label = { physical: "Physical", virtual: "Virtual", hybrid: "Hybrid" }[mode];
  return <span className="capitalize">{label}</span>;
}
