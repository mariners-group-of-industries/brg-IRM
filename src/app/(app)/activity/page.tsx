import { format, parseISO } from "date-fns";
import { CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { listActivity } from "@/lib/demo-store";
import { requirePermission } from "@/lib/require-permission";
import { timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

export const metadata = { title: "Activity Center" };

const toneIcon = { info: Info, warning: TriangleAlert, success: CheckCircle2 } as const;
const toneClass = { info: "text-info bg-info-soft", warning: "text-warning bg-warning-soft", success: "text-success bg-success-soft" } as const;

export default async function ActivityPage() {
  await requirePermission("activity.view");
  const items = listActivity();
  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const day = format(parseISO(item.at), "EEEE, d MMMM yyyy");
    groups.set(day, [...(groups.get(day) ?? []), item]);
  }

  return (
    <>
      <PageHeader
        title="Activity Center"
        description="Everything that happened across your companies — imports, approvals, notices, snapshots and minutes. Demo data."
      />
      <div className="max-w-3xl space-y-5">
        {[...groups.entries()].map(([day, entries]) => (
          <section key={day} aria-label={day}>
            <h2 className="sticky top-14 z-10 -mx-1 bg-background/90 px-1 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground backdrop-blur-sm">
              {day}
            </h2>
            <ol className="mt-1 divide-y divide-border rounded-lg border border-border bg-card shadow-card">
              {entries.map((item) => {
                const Icon = toneIcon[item.tone];
                return (
                  <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                    <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md", toneClass[item.tone])}>
                      <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-snug">
                        <span className="font-medium">{item.actor}</span>{" "}
                        <span className="text-foreground/80">{item.action}</span>
                        {item.target && <span className="text-muted-foreground"> {item.target}</span>}
                      </p>
                      <time dateTime={item.at} className="mt-1 block text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground/80">
                        {format(parseISO(item.at), "h:mm a")} · {timeAgo(item.at)}
                      </time>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </>
  );
}
