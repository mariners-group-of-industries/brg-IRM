import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  ArrowRight,
  BellRing,
  CalendarDays,
  CalendarPlus,
  ClipboardCheck,
  Info,
  TriangleAlert,
  CheckCircle2,
  Users,
} from "lucide-react";
import { requirePermission } from "@/lib/require-permission";
import { getActiveCompanyId } from "@/lib/demo-auth";
import {
  listActivity,
  listApprovals,
  listCompanies,
  listMeetings,
  turnoverSeries,
} from "@/lib/demo-store";
import { formatDate, formatNumber, formatPercent, timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { MeetingModeLabel, MeetingStatusBadge, MeetingTypeBadge } from "@/components/status-badge";
import { TurnoutChart } from "@/components/charts/turnout-chart";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

const toneIcon = { info: Info, warning: TriangleAlert, success: CheckCircle2 } as const;
const toneClass = { info: "text-info", warning: "text-warning", success: "text-success" } as const;

export default async function DashboardPage() {
  const session = await requirePermission("dashboard.view");
  const companies = listCompanies();
  const visibleIds = new Set(
    session?.role === "Platform Super Admin"
      ? companies.map((c) => c.id)
      : session?.companyIds ?? [],
  );
  const visibleCompanies = companies.filter((c) => visibleIds.has(c.id));
  const cookieCompany = await getActiveCompanyId();
  const activeCompany =
    visibleCompanies.find((c) => c.id === cookieCompany) ?? visibleCompanies[0];

  const myMeetings = listMeetings().filter((m) => visibleIds.has(m.companyId));
  const upcoming = myMeetings
    .filter((m) => !["completed", "archived"].includes(m.status))
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const agendaMeetings = upcoming.slice(0, 4);
  const approvals = listApprovals().filter((a) => visibleIds.has(a.companyId));
  const activity = listActivity().slice(0, 6);
  const lastCompleted = myMeetings.find((m) => m.status === "completed");
  const lastTurnout = lastCompleted
    ? (lastCompleted.attended / lastCompleted.eligibleShareholders) * 100
    : 0;

  const firstName = session.name.split(" ")[0] ?? "there";
  // Bangladesh Standard Time (UTC+6) — the product locale
  const bdHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", hour12: false }).format(new Date()),
  );
  const greeting = bdHour < 12 ? "Good morning" : bdHour < 17 ? "Good afternoon" : "Good evening";

  const kpis = [
    {
      label: "Eligible shareholders",
      value: formatNumber(activeCompany?.totalShareholders ?? 0),
      hint: activeCompany?.shortName ?? "—",
      icon: Users,
    },
    {
      label: "Upcoming meetings",
      value: String(upcoming.length),
      hint: upcoming[0] ? `Next: ${formatDate(upcoming[0].date)}` : "Nothing scheduled",
      icon: CalendarDays,
    },
    {
      label: "Pending approvals",
      value: String(approvals.length),
      hint: approvals.length ? "Action needed" : "All clear",
      icon: ClipboardCheck,
      href: "/operations/approvals",
    },
    {
      label: "Last meeting turnout",
      value: formatPercent(lastTurnout),
      hint: lastCompleted ? lastCompleted.title : "No completed meeting",
      icon: BellRing,
    },
  ];

  return (
    <>
      <PageHeader
        title={`${greeting}, ${firstName}`}
        description={`Here is the state of your governance calendar for ${activeCompany?.shortName ?? "your companies"}. Demo data — resets on restart.`}
      >
        <Button render={<Link href="/governance/meetings/new" />} className="h-9">
          <CalendarPlus className="h-4 w-4" aria-hidden />
          Create AGM / EGM
        </Button>
      </PageHeader>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          const inner = (
            <div className="group h-full rounded-lg border border-border bg-card p-3.5 shadow-card transition-shadow hover:shadow-lift">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {kpi.label}
                </p>
                <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} aria-hidden />
              </div>
              <p className="mt-2 text-[22px] font-semibold leading-none tracking-tight">
                {kpi.value}
              </p>
              <p className="mt-1.5 truncate text-[11px] text-muted-foreground">{kpi.hint}</p>
            </div>
          );
          return kpi.href ? (
            <Link key={kpi.label} href={kpi.href} className="outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
              {inner}
            </Link>
          ) : (
            <div key={kpi.label}>{inner}</div>
          );
        })}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        {/* Main column */}
        <div className="space-y-5 xl:col-span-2">
          {/* Upcoming meetings */}
          <section aria-labelledby="upcoming-heading" className="rounded-lg border border-border bg-card shadow-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 id="upcoming-heading" className="text-[13px] font-semibold">
                Upcoming meetings
              </h2>
              <Link
                href="/governance/meetings"
                className="inline-flex items-center gap-1 text-[12px] font-medium text-brand hover:underline"
              >
                View all
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
            {agendaMeetings.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">
                No meetings scheduled. Create the next AGM or EGM to get started.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {agendaMeetings.map((meeting) => {
                  const date = parseISO(meeting.date);
                  const registrationRate = meeting.eligibleShareholders
                    ? (meeting.registered / meeting.eligibleShareholders) * 100
                    : 0;
                  return (
                    <li key={meeting.id}>
                      <Link
                        href={`/governance/meetings/${meeting.id}`}
                        className="flex items-center gap-4 px-4 py-3 outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40"
                      >
                        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md border border-border bg-muted/40">
                          <span className="text-[15px] font-semibold leading-none">{format(date, "d")}</span>
                          <span className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {format(date, "MMM")}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <MeetingTypeBadge type={meeting.type} />
                            <p className="truncate text-[13px] font-medium">{meeting.title}</p>
                          </div>
                          <p className="mt-1 truncate text-[11.5px] text-muted-foreground">
                            <MeetingModeLabel mode={meeting.mode} /> · {formatDate(meeting.date)} ·{" "}
                            {formatNumber(meeting.registered)} registered
                            {meeting.eligibleShareholders > 0 &&
                              ` (${formatPercent(registrationRate, 1)})`}
                          </p>
                        </div>
                        <MeetingStatusBadge status={meeting.status} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Turnout chart */}
          <section aria-labelledby="turnout-heading" className="rounded-lg border border-border bg-card p-4 shadow-card">
            <div className="flex items-center justify-between">
              <h2 id="turnout-heading" className="text-[13px] font-semibold">
                Turnout — last six meetings
              </h2>
              <Link href="/reports/analytics" className="text-[12px] font-medium text-brand hover:underline">
                Open analytics
              </Link>
            </div>
            <div className="mt-3">
              <TurnoutChart data={turnoverSeries()} />
            </div>
          </section>
        </div>

        {/* Aside */}
        <div className="space-y-5">
          {/* Action required */}
          <section aria-labelledby="actions-heading" className="rounded-lg border border-warning/40 bg-warning-soft/60 p-4">
            <h2 id="actions-heading" className="flex items-center gap-2 text-[13px] font-semibold text-warning">
              <TriangleAlert className="h-4 w-4" aria-hidden />
              Action required
            </h2>
            <ul className="mt-2.5 space-y-2 text-[12px] leading-snug text-foreground/85">
              <li>
                <Link href="/governance/meetings/mtg_agm_2026" className="hover:underline">
                  <strong>Record date 20 Nov</strong> — eligibility snapshot must be filed before the
                  AGM notice cut-off.
                </Link>
              </li>
              <li>
                <Link href="/operations/approvals" className="hover:underline">
                  <strong>214 proxy authorizations</strong> await certification against the register.
                </Link>
              </li>
              <li>
                <Link href="/governance/meetings/mtg_egm_bonus" className="hover:underline">
                  <strong>EGM bonus issue</strong> — poll demand threshold still set to 5%; confirm
                  Articles 44 applies.
                </Link>
              </li>
            </ul>
          </section>

          {/* Pending approvals */}
          <section aria-labelledby="approvals-heading" className="rounded-lg border border-border bg-card shadow-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 id="approvals-heading" className="text-[13px] font-semibold">
                Pending approvals
              </h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
                {approvals.length} open
              </span>
            </div>
            <ul className="divide-y divide-border">
              {approvals.slice(0, 3).map((approval) => (
                <li key={approval.id} className="px-4 py-2.5">
                  <p className="text-[12px] font-medium leading-snug">{approval.title}</p>
                  <p className="mt-1 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                    Due {formatDate(approval.dueDate)} · {approval.requestedBy}
                  </p>
                </li>
              ))}
            </ul>
            <div className="border-t border-border px-4 py-2.5">
              <Link href="/operations/approvals" className="inline-flex items-center gap-1 text-[12px] font-medium text-brand hover:underline">
                Review all approvals
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </section>

          {/* Recent activity */}
          <section aria-labelledby="activity-heading" className="rounded-lg border border-border bg-card shadow-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 id="activity-heading" className="text-[13px] font-semibold">
                Recent activity
              </h2>
              <Link href="/activity" className="text-[12px] font-medium text-brand hover:underline">
                Activity center
              </Link>
            </div>
            <ol className="divide-y divide-border">
              {activity.map((item) => {
                const Icon = toneIcon[item.tone];
                return (
                  <li key={item.id} className="flex items-start gap-2.5 px-4 py-2.5">
                    <Icon
                      className={cn("mt-0.5 h-4 w-4 shrink-0", toneClass[item.tone])}
                      strokeWidth={1.75}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="text-[12px] leading-snug text-foreground/90">
                        <span className="font-medium">{item.actor.split(" (")[0]}</span>{" "}
                        {item.action}{" "}
                        {item.target && <span className="text-muted-foreground">{item.target}</span>}
                      </p>
                      <p className="mt-0.5 text-[10.5px] uppercase tracking-wide text-muted-foreground/80">
                        {timeAgo(item.at)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}
