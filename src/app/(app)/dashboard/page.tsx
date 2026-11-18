import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  ArrowRight,
  ArrowUpRight,
  BellRing,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileSpreadsheet,
  Info,
  Sparkles,
  TriangleAlert,
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
import { MeetingModeLabel, MeetingStatusBadge, MeetingTypeBadge } from "@/components/status-badge";
import { TurnoutChart } from "@/components/charts/turnout-chart";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

const toneIcon = { info: Info, warning: TriangleAlert, success: CheckCircle2 } as const;
const toneClass = {
  info: "text-sky-500 bg-sky-500/10 dark:bg-sky-500/20",
  warning: "text-amber-500 bg-amber-500/10 dark:bg-amber-500/20",
  success: "text-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/20",
} as const;

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
  const featuredMeeting = upcoming[0] ?? null;

  const approvals = listApprovals().filter(
    (a) => visibleIds.has(a.companyId) && (!a.status || a.status === "pending"),
  );
  const activity = listActivity().slice(0, 6);
  const lastCompleted = myMeetings.find((m) => m.status === "completed");
  const lastTurnout = lastCompleted
    ? (lastCompleted.attended / lastCompleted.eligibleShareholders) * 100
    : 0;

  const firstName = session.name.split(" ")[0] ?? "there";
  // Bangladesh Standard Time (UTC+6)
  const bdHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", hour12: false }).format(new Date()),
  );
  const greeting = bdHour < 12 ? "Good morning" : bdHour < 17 ? "Good afternoon" : "Good evening";

  const kpis = [
    {
      label: "Eligible Shareholders",
      value: formatNumber(activeCompany?.totalShareholders ?? 0),
      trend: "+4.2% YoY",
      trendPositive: true,
      hint: activeCompany?.shortName ?? "All portfolios",
      icon: Users,
      gradient: "from-blue-500/20 to-sky-500/5 text-blue-600 dark:text-sky-400",
    },
    {
      label: "Upcoming Meetings",
      value: String(upcoming.length),
      trend: upcoming.length > 0 ? "Next scheduled" : "None scheduled",
      trendPositive: upcoming.length > 0,
      hint: upcoming[0] ? formatDate(upcoming[0].date) : "Nothing scheduled",
      icon: CalendarDays,
      gradient: "from-teal-500/20 to-emerald-500/5 text-teal-600 dark:text-teal-400",
      href: "/governance/meetings",
    },
    {
      label: "Pending Approvals",
      value: String(approvals.length),
      trend: approvals.length > 0 ? "Action needed" : "All clear",
      trendPositive: approvals.length === 0,
      hint: approvals.length ? `${approvals.length} proxy/rep review(s)` : "Zero backlog",
      icon: ClipboardCheck,
      gradient: "from-amber-500/20 to-orange-500/5 text-amber-600 dark:text-amber-400",
      href: "/operations/approvals",
    },
    {
      label: "Last Meeting Turnout",
      value: formatPercent(lastTurnout),
      trend: lastTurnout >= 50 ? "Quorum passed" : "Historical",
      trendPositive: lastTurnout >= 50,
      hint: lastCompleted ? lastCompleted.title : "No completed meeting",
      icon: BellRing,
      gradient: "from-indigo-500/20 to-purple-500/5 text-indigo-600 dark:text-indigo-400",
      href: "/reports/analytics",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Welcome Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {greeting}, {firstName}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-brand/20 bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand">
              <Sparkles className="h-3 w-3" />
              Live Workspace
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Governance, AGM proceedings, and shareholder registry for{" "}
            <span className="font-semibold text-foreground">{activeCompany?.name ?? "Mariners Group"}</span>.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            render={<Link href="/shareholders/import" />}
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 border-border/80 shadow-xs hover:bg-muted"
          >
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            <span>Import Register</span>
          </Button>
          <Button
            render={<Link href="/governance/meetings/new" />}
            size="sm"
            className="h-9 gap-1.5 bg-brand-navy text-white shadow-xs hover:bg-brand-navy-hover dark:bg-brand dark:text-brand-foreground"
          >
            <CalendarPlus className="h-4 w-4" />
            <span>Create AGM / EGM</span>
          </Button>
        </div>
      </div>

      {/* Featured Next Meeting Banner (if scheduled) */}
      {featuredMeeting && (
        <div className="relative overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-r from-card via-card to-brand-soft/40 p-5 shadow-sm dark:to-brand-soft/10">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-teal-500" />
                </span>
                <span className="text-xs font-semibold tracking-wider uppercase text-teal-600 dark:text-teal-400">
                  Featured Governance Spotlight
                </span>
                <MeetingTypeBadge type={featuredMeeting.type} />
                <MeetingStatusBadge status={featuredMeeting.status} />
              </div>
              <h2 className="text-lg font-bold text-foreground">
                {featuredMeeting.title}
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 font-medium text-foreground">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  {formatDate(featuredMeeting.date)}
                </span>
                <span>•</span>
                <MeetingModeLabel mode={featuredMeeting.mode} />
                <span>•</span>
                <span>
                  {formatNumber(featuredMeeting.registered)} registered of{" "}
                  {formatNumber(featuredMeeting.eligibleShareholders)} holders
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                render={<Link href={`/governance/meetings/${featuredMeeting.id}`} />}
                size="sm"
                className="gap-1.5 shadow-xs"
              >
                <span>Control Center</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Registration Progress Bar */}
          <div className="mt-4 pt-3 border-t border-border/40">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Registration Progress:</span>
              <span className="font-semibold text-foreground tabular-nums">
                {formatPercent((featuredMeeting.registered / (featuredMeeting.eligibleShareholders || 1)) * 100, 1)}
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-500 to-brand transition-all duration-500"
                style={{
                  width: `${Math.min(100, (featuredMeeting.registered / (featuredMeeting.eligibleShareholders || 1)) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* KPI 4-Card Strip with micro-hover lift */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          const content = (
            <div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-xl border border-border/70 bg-card p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md">
              <div className="flex items-start justify-between">
                <p className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                  {kpi.label}
                </p>
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ring-1 ring-border/50", kpi.gradient)}>
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </div>
              </div>

              <div className="mt-3">
                <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums sm:text-3xl">
                  {kpi.value}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="truncate text-muted-foreground">{kpi.hint}</span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                      kpi.trendPositive
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {kpi.trend}
                  </span>
                </div>
              </div>
            </div>
          );

          return kpi.href ? (
            <Link key={kpi.label} href={kpi.href} className="outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
              {content}
            </Link>
          ) : (
            <div key={kpi.label}>{content}</div>
          );
        })}
      </div>

      {/* Main Grid: Left 2 cols, Right 1 col */}
      <div className="grid gap-6 xl:grid-cols-3">
        {/* Main 2-column container */}
        <div className="space-y-6 xl:col-span-2">
          {/* Upcoming Meetings List */}
          <section aria-labelledby="upcoming-heading" className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-card">
            <div className="flex items-center justify-between border-b border-border/80 px-5 py-4">
              <div>
                <h2 id="upcoming-heading" className="text-sm font-bold text-foreground">
                  Upcoming General Meetings
                </h2>
                <p className="text-xs text-muted-foreground">
                  Statutory AGM and EGM schedules across active companies
                </p>
              </div>
              <Link
                href="/governance/meetings"
                className="group inline-flex items-center gap-1 text-xs font-semibold text-brand transition-colors hover:text-brand-navy hover:underline dark:hover:text-teal-300"
              >
                <span>View all</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            {agendaMeetings.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm font-medium text-foreground">No upcoming meetings</p>
                <p className="mt-1 text-xs text-muted-foreground">Create the next AGM or EGM to get started.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {agendaMeetings.map((meeting) => {
                  const date = parseISO(meeting.date);
                  const registrationRate = meeting.eligibleShareholders
                    ? (meeting.registered / meeting.eligibleShareholders) * 100
                    : 0;

                  return (
                    <li key={meeting.id} className="transition-colors hover:bg-muted/40">
                      <Link
                        href={`/governance/meetings/${meeting.id}`}
                        className="flex items-center gap-4 px-5 py-3.5 outline-none"
                      >
                        {/* Date badge */}
                        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-border/80 bg-muted/60 text-center font-bold">
                          <span className="text-base font-extrabold leading-none text-foreground">{format(date, "d")}</span>
                          <span className="mt-0.5 text-[10px] tracking-wider uppercase text-muted-foreground">
                            {format(date, "MMM")}
                          </span>
                        </div>

                        {/* Meeting Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <MeetingTypeBadge type={meeting.type} />
                            <p className="truncate text-sm font-semibold text-foreground">{meeting.title}</p>
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            <MeetingModeLabel mode={meeting.mode} /> · {formatDate(meeting.date)} ·{" "}
                            <span className="font-medium text-foreground tabular-nums">
                              {formatNumber(meeting.registered)}
                            </span>{" "}
                            registered ({formatPercent(registrationRate, 1)})
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-3">
                          <MeetingStatusBadge status={meeting.status} />
                          <ArrowRight className="h-4 w-4 text-muted-foreground/40 transition-transform group-hover:translate-x-1" />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Turnout Chart */}
          <section aria-labelledby="turnout-heading" className="overflow-hidden rounded-xl border border-border/80 bg-card p-5 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <h2 id="turnout-heading" className="text-sm font-bold text-foreground">
                  Shareholder Turnout & Quorum Trends
                </h2>
                <p className="text-xs text-muted-foreground">
                  Historical attendance percentage across the last six general meetings
                </p>
              </div>
              <Link
                href="/reports/analytics"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
              >
                <span>Analytics</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="mt-4">
              <TurnoutChart data={turnoverSeries()} />
            </div>
          </section>
        </div>

        {/* Right Sidebar Column */}
        <div className="space-y-6">
          {/* Statutory Action Required Banner */}
          <section
            aria-labelledby="actions-heading"
            className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4.5 dark:bg-amber-500/10"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-400">
              <TriangleAlert className="h-4 w-4 shrink-0" />
              <h2 id="actions-heading">Statutory Actions Due</h2>
            </div>
            <ul className="mt-3 space-y-2.5 text-xs text-foreground/90">
              <li className="rounded-lg border border-amber-500/20 bg-background/60 p-2.5 shadow-2xs">
                <Link href="/governance/meetings/mtg_agm_2026" className="block hover:underline">
                  <span className="font-semibold text-foreground">Record Date 20 Nov:</span> Eligibility snapshot must be certified before the notice publication cut-off.
                </Link>
              </li>
              <li className="rounded-lg border border-amber-500/20 bg-background/60 p-2.5 shadow-2xs">
                <Link href="/operations/approvals" className="block hover:underline">
                  <span className="font-semibold text-foreground">214 Proxy Instruments:</span> Await verification against the shareholder register.
                </Link>
              </li>
              <li className="rounded-lg border border-amber-500/20 bg-background/60 p-2.5 shadow-2xs">
                <Link href="/governance/meetings/mtg_egm_bonus" className="block hover:underline">
                  <span className="font-semibold text-foreground">EGM Special Resolution:</span> Confirm 75% majority threshold per Articles of Association.
                </Link>
              </li>
            </ul>
          </section>

          {/* Pending Approvals */}
          <section aria-labelledby="approvals-heading" className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-card">
            <div className="flex items-center justify-between border-b border-border/80 px-4 py-3.5">
              <h2 id="approvals-heading" className="text-xs font-bold uppercase tracking-wider text-foreground">
                Pending Approvals
              </h2>
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10.5px] font-bold text-brand">
                {approvals.length} Open
              </span>
            </div>
            <ul className="divide-y divide-border/60">
              {approvals.slice(0, 3).map((approval) => (
                <li key={approval.id} className="p-3.5 hover:bg-muted/30">
                  <p className="text-xs font-semibold text-foreground leading-snug">{approval.title}</p>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Due {formatDate(approval.dueDate)}</span>
                    <span className="font-medium text-foreground">{approval.requestedBy}</span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-border/80 bg-muted/20 px-4 py-2.5 text-center">
              <Link
                href="/operations/approvals"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
              >
                <span>Open Approvals Queue</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </section>

          {/* Recent Activity Feed */}
          <section aria-labelledby="activity-heading" className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-card">
            <div className="flex items-center justify-between border-b border-border/80 px-4 py-3.5">
              <h2 id="activity-heading" className="text-xs font-bold uppercase tracking-wider text-foreground">
                Recent Activity
              </h2>
              <Link href="/activity" className="text-xs font-semibold text-brand hover:underline">
                Activity Center
              </Link>
            </div>
            <ol className="divide-y divide-border/60">
              {activity.map((item) => {
                const Icon = toneIcon[item.tone];
                return (
                  <li key={item.id} className="flex items-start gap-3 p-3.5 hover:bg-muted/30">
                    <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full mt-0.5", toneClass[item.tone])}>
                      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs leading-snug text-foreground">
                        <span className="font-semibold">{item.actor.split(" (")[0]}</span>{" "}
                        {item.action}{" "}
                        {item.target && <span className="font-medium text-brand">{item.target}</span>}
                      </p>
                      <p className="mt-0.5 text-[10.5px] text-muted-foreground">
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
    </div>
  );
}
