import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Landmark,
  Wallet,
} from "lucide-react";
import { requirePermission } from "@/lib/require-permission";
import { registry } from "@/lib/shareholder-store";
import { hasPermission } from "@/lib/permissions";
import { getCompany, listMeetings } from "@/lib/demo-store";
import { formatDate, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { MeetingModeLabel, MeetingStatusBadge, MeetingTypeBadge } from "@/components/status-badge";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requirePermission("companies.view");
  const company = getCompany(id);
  const visible =
    company &&
    (session?.role === "Platform Super Admin" || session?.companyIds.includes(company.id));
  if (!company || !visible) notFound();

  const meetings = listMeetings(company.id);
  const stats = [
    { label: "Shareholders", value: formatNumber(company.totalShareholders), icon: Landmark },
    { label: "Share classes", value: company.shareClasses.join(", "), icon: Wallet },
    { label: "Paid-up capital", value: `৳${(company.paidUpCapital / 10_000_000).toFixed(1)} crore`, icon: Building2 },
  ];

  return (
    <>
      <Link
        href="/companies"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to companies
      </Link>

      <PageHeader
        title={company.name}
        description={`${company.registrationNo} · TIN ${company.tin} · ${company.sector} · ${company.listed ? "Listed on DSE/CSE" : "Private limited"}`}
      >
        <span className="rounded-md border border-border bg-muted px-2 py-1 font-mono text-[11px] font-medium">
          {company.type}
        </span>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
              <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} aria-hidden />
            </div>
            <p className="mt-2 truncate text-[16px] font-semibold leading-snug">{value}</p>
          </div>
        ))}
      </div>

      <section aria-labelledby="meetings-heading" className="mt-5 rounded-lg border border-border bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 id="meetings-heading" className="text-[13px] font-semibold">AGM / EGM history</h2>
          <Link href="/governance/meetings" className="inline-flex items-center gap-1 text-[12px] font-medium text-brand hover:underline">
            All meetings
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
        {meetings.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">
            No meetings recorded for this company yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {meetings.map((meeting) => (
              <li key={meeting.id}>
                <Link
                  href={`/governance/meetings/${meeting.id}`}
                  className="flex flex-wrap items-center gap-3 px-5 py-3 outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40"
                >
                  <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <MeetingTypeBadge type={meeting.type} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{meeting.title}</span>
                  <span className="text-[11.5px] text-muted-foreground">{formatDate(meeting.date)}</span>
                  <span className="hidden text-[11.5px] text-muted-foreground sm:inline"><MeetingModeLabel mode={meeting.mode} /></span>
                  <MeetingStatusBadge status={meeting.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="registry-heading" className="mt-5 rounded-lg border border-dashed border-border p-5">
        <h2 id="registry-heading" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Registry management
        </h2>
        <p className="mt-1 max-w-xl text-[12px] leading-5 text-muted-foreground">
          {registry.holders.filter((h) => h.companyId === company.id).length} fictional sample accounts are available in the legal register. Review holder records, import CSV files and record allotments or transfers there. Portfolio headline totals above represent the larger demo company.
        </p>
        {hasPermission(session.role, "shareholders.view") && <Link href={`/shareholders?company=${company.id}`} className="mt-3 inline-block text-xs font-medium text-brand hover:underline">Open shareholder register →</Link>}
      </section>
    </>
  );
}
