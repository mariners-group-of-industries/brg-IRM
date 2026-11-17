import { CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";

/**
 * Placeholder for routes whose module is scheduled in a later phase.
 * Always names the phase — never implies the feature exists today.
 */
export function ComingSoon({
  title,
  phase,
  description,
  scope,
}: {
  title: string;
  phase: string;
  description: string;
  scope: string[];
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="rounded-lg border border-dashed border-border bg-card p-6 shadow-card sm:p-8">
        <div className="max-w-lg">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-info/30 bg-info-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-info">
            {phase}
          </span>
          <h2 className="mt-3 text-[15px] font-semibold">Planned, not yet built</h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            This route is reserved in the information architecture so navigation is stable.
            It will ship with:
          </p>
          <ul className="mt-3 space-y-1.5">
            {scope.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[13px] text-foreground/85">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={1.75} aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <Link
            href="/governance/meetings"
            className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand hover:underline"
          >
            Go to AGM / EGM management
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </>
  );
}
