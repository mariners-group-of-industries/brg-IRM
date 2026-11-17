import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading shareholder dashboard" className="space-y-5 sm:space-y-6">
      <span className="sr-only">Loading your shareholder dashboard…</span>
      <div aria-hidden="true" className="space-y-3"><Skeleton className="h-3 w-36" /><Skeleton className="h-8 w-64 max-w-full" /><Skeleton className="h-4 w-48" /></div>
      <div aria-hidden="true" className="grid items-start gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="overflow-hidden rounded-xl border border-border bg-card lg:col-start-1 lg:row-start-2"><Skeleton className="h-10 w-full rounded-none" /><div className="space-y-4 p-4 sm:p-6"><Skeleton className="h-4 w-28" /><Skeleton className="h-7 w-3/4" /><div className="flex gap-4"><Skeleton className="h-20 w-[68px] shrink-0" /><div className="flex-1 space-y-3 py-1"><Skeleton className="h-5 w-32" /><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-4/5" /></div></div><Skeleton className="h-11 w-full sm:w-52" /><Skeleton className="h-px w-full" /><Skeleton className="h-3 w-2/3" /><Skeleton className="h-1.5 w-full" /></div></div>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:col-span-2 lg:row-start-1 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="space-y-3 rounded-xl border border-border bg-card p-3 sm:p-4"><Skeleton className="h-3 w-24 max-w-full" /><Skeleton className="h-7 w-16" /><Skeleton className="hidden h-3 w-32 max-w-full sm:block" /></div>)}</div>
        <div className="space-y-5 lg:col-start-1 lg:row-start-3"><Skeleton className="h-56 w-full rounded-xl" /><Skeleton className="h-52 w-full rounded-xl" /></div>
        <div className="space-y-5 lg:col-start-2 lg:row-start-2 lg:row-span-2"><Skeleton className="h-72 w-full rounded-xl" /><Skeleton className="h-56 w-full rounded-xl" /></div>
      </div>
    </div>
  );
}
