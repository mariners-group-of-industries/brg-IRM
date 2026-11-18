import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CircleCheck,
  ClipboardList,
  Clock3,
  Landmark,
  MapPin,
} from "lucide-react";
import { requirePermission } from "@/lib/require-permission";
import { hasPermission } from "@/lib/permissions";
import { getCompany, getLiveState, getMeeting, listQuestions } from "@/lib/demo-store";
import { PageHeader } from "@/components/page-header";
import { MeetingModeLabel, MeetingStatusBadge, MeetingTypeBadge } from "@/components/status-badge";
import { MeetingControls } from "@/components/meeting-controls";
import { Headset } from "lucide-react";
import { formatDate, formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function MeetingOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requirePermission("meetings.view");
  const meeting = getMeeting(id);
  if (!meeting) notFound();

  const visible =
    session?.role === "Platform Super Admin" ||
    session?.companyIds.includes(meeting.companyId);
  if (!visible) notFound(); // cross-tenant ids are indistinguishable from missing ones

  const company = getCompany(meeting.companyId);
  const pendingCount = listQuestions(meeting.id).filter((q) => q.status === "pending").length;
  const registrationRate = meeting.eligibleShareholders
    ? (meeting.registered / meeting.eligibleShareholders) * 100
    : 0;
  const turnoutRate = meeting.eligibleShareholders
    ? (meeting.attended / meeting.eligibleShareholders) * 100
    : 0;

  return (
    <>
      <Link
        href="/governance/meetings"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to meetings
      </Link>

      <PageHeader
        title={meeting.title}
        description={`${company?.name ?? "—"} · ${meeting.financialYear} · Record date ${formatDate(meeting.recordDate)}`}
      >
        <MeetingTypeBadge type={meeting.type} />
        <MeetingStatusBadge status={meeting.status} />
      </PageHeader>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* Details + agenda */}
        <div className="space-y-5 xl:col-span-2">
          <section aria-labelledby="details-heading" className="rounded-lg border border-border bg-card shadow-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <h2 id="details-heading" className="text-[13px] font-semibold">Meeting details</h2>
              <Link
                href={`/governance/meetings/new`}
                className="text-[12px] font-medium text-brand hover:underline"
              >
                Edit
              </Link>
            </div>
            <dl className="grid gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-2">
              <DetailItem icon={CalendarDays} label="Date & time" value={formatDateTime(meeting.date)} />
              <DetailItem icon={Clock3} label="Timezone" value={meeting.timezone} />
              <DetailItem icon={MapPin} label="Venue" value={meeting.venue} className="sm:col-span-2" />
              <DetailItem icon={Landmark} label="Record date" value={formatDate(meeting.recordDate)} />
              <DetailItem
                icon={CircleCheck}
                label="Voting"
                value={`${meeting.votingMethod.replaceAll("_", " ")} · ${meeting.pollDemandRule}`}
                className="sm:col-span-2"
              />
              <DetailItem icon={Building2} label="Company" value={`${company?.name ?? "—"} · ${company?.registrationNo ?? ""}`} className="sm:col-span-2" />
            </dl>
          </section>

          <section aria-labelledby="agenda-heading" className="rounded-lg border border-border bg-card shadow-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <h2 id="agenda-heading" className="flex items-center gap-2 text-[13px] font-semibold">
                <ClipboardList className="h-4 w-4 text-muted-foreground" aria-hidden />
                Agenda & resolutions
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
                  {meeting.agenda.length}
                </span>
              </h2>
              <span className="text-[11.5px] text-muted-foreground">Approved by board resolution</span>
            </div>
            {meeting.agenda.length === 0 ? (
              <p className="px-5 py-6 text-center text-[13px] text-muted-foreground">
                Agenda is being finalised for this meeting.
              </p>
            ) : (
              <ol className="divide-y divide-border">
                {meeting.agenda.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 px-5 py-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-[11px] font-semibold text-muted-foreground">
                      {item.order}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium leading-snug">{item.title}</p>
                      {item.resolution && (
                        <p className="mt-0.5 text-[11.5px] text-muted-foreground">{item.resolution}</p>
                      )}
                    </div>
                    <span className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] font-medium capitalize",
                      item.kind === "special"
                        ? "border-warning/40 bg-warning-soft text-warning"
                        : "border-border bg-muted text-muted-foreground",
                    )}>
                      {item.kind}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {/* Registration & notices aside */}
        <div className="space-y-5">
          <section aria-labelledby="registration-heading" className="rounded-lg border border-border bg-card p-5 shadow-card">
            <h2 id="registration-heading" className="text-[13px] font-semibold">Registration & attendance</h2>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Eligible</p>
                <p className="mt-1 text-[20px] font-semibold leading-none">{formatNumber(meeting.eligibleShareholders)}</p>
              </div>
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Registered</p>
                <p className="mt-1 text-[20px] font-semibold leading-none">{formatNumber(meeting.registered)}</p>
              </div>
            </div>
            <Meter label="Registration rate" percent={registrationRate} />
            <Meter label="Turnout" percent={turnoutRate} muted />
            <p className="mt-3 text-[11px] text-muted-foreground">
              {meeting.registrationCloses ? `Registration closes ${formatDateTime(meeting.registrationCloses)} (${meeting.timezone}).` : "Registration closing time is not configured."} Attendance is captured when a registered holder joins a live meeting.
            </p>
            <Link
              href={`/portal/meetings/${meeting.id}`}
              className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-brand hover:underline"
            >
              View shareholder portal page
              <span aria-hidden>→</span>
            </Link>
          </section>

          {hasPermission(session.role, "meetings.control") && !["completed", "archived"].includes(meeting.status) && (
            <>
              <MeetingControls
                meetingId={meeting.id}
                meeting={meeting}
              />
              <Link
                href={`/governance/meetings/${meeting.id}/moderation`}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-3 shadow-card outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-center gap-2.5">
                  <Headset className="h-5 w-5 text-muted-foreground" aria-hidden />
                  <span>
                    <span className="block text-[13px] font-semibold">Moderation queue</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {pendingCount} pending question{pendingCount === 1 ? "" : "s"}
                    </span>
                  </span>
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">{pendingCount}</span>
              </Link>
            </>
          )}

          <section aria-labelledby="notice-heading" className="rounded-lg border border-border bg-card shadow-card">
            <h2 id="notice-heading" className="border-b border-border px-5 py-3.5 text-[13px] font-semibold">
              Notice & publication
            </h2>
            <div className="px-5 py-4">
              {meeting.noticePublished ? (
                <p className="flex items-start gap-2 text-[12.5px] leading-snug text-success">
                  <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  Notice published to the shareholder portal and recorded in the dispatch ledger.
                </p>
              ) : (
                <p className="flex items-start gap-2 text-[12.5px] leading-snug text-warning">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  Notice not published yet. Dispatch via Statutory Notices to open shareholder visibility.
                </p>
              )}
              <dl className="mt-3 space-y-1.5 text-[11.5px] text-muted-foreground">
                <div className="flex justify-between gap-3"><dt>Voting</dt><dd className="capitalize">{meeting.votingMethod.replaceAll("_", " ")}</dd></div>
                <div className="flex justify-between gap-3"><dt>Mode</dt><dd><MeetingModeLabel mode={meeting.mode} /></dd></div>
                <div className="flex justify-between gap-3"><dt>Company</dt><dd className="truncate">{company?.shortName}</dd></div>
              </dl>
              <Link
                href={`/governance/notices?meeting=${meeting.id}`}
                className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-brand hover:underline"
              >
                Manage & dispatch notice
                <span aria-hidden>→</span>
              </Link>
            </div>
          </section>

          <section aria-labelledby="scrutiny-heading" className="rounded-lg border border-border bg-card p-5 shadow-card">
            <h2 id="scrutiny-heading" className="text-[13px] font-semibold">
              Resolution Scrutiny & Statutory Pack
            </h2>
            <p className="mt-1.5 text-[12px] leading-5 text-muted-foreground">
              {meeting.agenda.length} tabled resolution{meeting.agenda.length === 1 ? "" : "s"} ·{" "}
              {formatNumber(getLiveState(meeting.id).agenda.reduce((s, a) => s + a.votes, 0))} votes recorded.
              Export scrutiny sheets, formal minutes and RJSC/BSEC packs.
            </p>
            <Link
              href={`/reports?meeting=${meeting.id}`}
              className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-brand hover:underline"
            >
              Open certified reports & minutes
              <span aria-hidden>→</span>
            </Link>
          </section>
        </div>
      </div>
    </>
  );
}

function DetailItem({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
      <div className="min-w-0">
        <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 text-[12.5px] leading-snug">{value}</dd>
      </div>
    </div>
  );
}

function Meter({ label, percent, muted }: { label: string; percent: number; muted?: boolean }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        <span className="text-[11px] tabular-nums text-muted-foreground">{formatPercent(clamped)}</span>
      </div>
      <div
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={cn("h-full rounded-full", muted ? "bg-slate-400" : "bg-brand")}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
