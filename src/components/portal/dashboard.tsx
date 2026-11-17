"use client";
import { usePortalLanguage } from "@/components/portal/language-provider";
import Link from "next/link";
import { ArrowRight, BookOpen, CalendarCheck2, CalendarDays, ChevronRight, ClipboardList, FileCheck2, HelpCircle, History, Landmark, MessageSquare, Mic, TicketCheck, UserCheck, Video, Vote, Wallet, } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortalMeetingCard } from "./meeting-card";
import { DemoDisclosure } from "./demo-disclosure";
import type { getPortalDashboard } from "@/lib/portal-dashboard";
import { portalMeetingDate, portalMeetingTime } from "@/lib/portal-format";
type DashboardData = NonNullable<ReturnType<typeof getPortalDashboard>>;
const panel = "rounded-xl border border-border bg-card shadow-card transition-[border-color,box-shadow] duration-150";
const timelineIcons: Record<string, LucideIcon> = { registration: CalendarCheck2, attendance: Video, ballot: Vote, question: MessageSquare, authorization: UserCheck };
export function ShareholderDashboard({ data, today }: {
    data: DashboardData;
    today: string;
}) {
    const { t, number, locale } = usePortalLanguage();
    const { identity, company, featured } = data;
    const stats = [
        { label: t("Shares held"), value: data.totalShares, hint: t("Current register balance"), icon: Wallet, href: "/portal/account#holdings" },
        { label: t("Upcoming meetings"), value: data.upcoming.length, hint: t("Published for your account"), icon: CalendarDays, href: "/portal/meetings" },
        { label: t("Registered meetings"), value: data.registrationCount, hint: t("Your BO / folio account"), icon: TicketCheck, href: "/portal/account#registrations" },
        { label: t("My ballot receipts"), value: data.receiptCount, hint: t("Your voting confirmations"), icon: FileCheck2, href: "/portal/account#receipts" },
    ];
    return <div className="portal-dashboard space-y-5 sm:space-y-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
    <header>
      <div className="mb-2 flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{t("Welcome back, {name}", {name:identity.name.split(" ")[0]})}</p><div className="flex items-center gap-3"><span className="hidden text-xs text-muted-foreground md:inline">{today}{" ? "}{t("Bangladesh time")}</span><DemoDisclosure /></div></div>
      <h1 className="text-[26px] font-semibold leading-tight tracking-tight sm:text-[32px]">{t("Shareholder dashboard")}</h1>
      <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground sm:text-sm">{t("Your meetings. Your participation.")}</p>
    </header>

    <div className="grid items-start gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="next-meeting-heading" className="min-w-0 lg:col-start-1 lg:row-start-2">
          <h2 id="next-meeting-heading" className="sr-only">{t("Your next meeting")}</h2>
          {featured ? <PortalMeetingCard summary={featured} featured/> : <div className={`${panel} flex flex-col items-start p-6 sm:p-8`}><span className="mb-4 rounded-xl bg-brand-soft p-3 text-brand"><CalendarDays className="size-6" aria-hidden/></span><h3 className="text-lg font-semibold">{t("No upcoming meetings")}</h3><p className="mt-2 max-w-md text-[13px] leading-6 text-muted-foreground">{t("Published meetings for {company} will appear here.",{company:company.shortName})}</p><Button nativeButton={false} variant="outline" className="mt-5" render={<Link href="/portal/meetings"/>}>{t("View my meetings")}<ArrowRight /></Button></div>}
        </section>

      <div aria-label={t("Account overview")} className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:col-span-2 lg:row-start-1 lg:grid-cols-4">
        {stats.map(({ label, value, hint, icon: Icon, href }) => <Link key={t(label)} href={href} className={`${panel} group min-w-0 p-3 outline-none duration-150 hover:border-brand/35 hover:shadow-lift focus-visible:ring-2 focus-visible:ring-ring motion-safe:transition-[transform,box-shadow,border-color] motion-safe:hover:-translate-y-0.5 sm:p-4`}>
          <div className="flex items-center justify-between gap-2"><p className="text-xs leading-5 text-muted-foreground">{t(label)}</p><Icon className="size-4 shrink-0 text-brand" aria-hidden/></div>
          <p className="mt-1 text-[23px] font-semibold leading-8 tracking-tight tabular-nums sm:text-[26px]">{number(value)}</p>
          <p className="mt-0.5 hidden text-[11px] leading-4 text-muted-foreground sm:block">{t(hint)}</p>
        </Link>)}
      </div>

      <div className="min-w-0 space-y-5 lg:col-start-1 lg:row-start-3">
        {featured && <section className={panel} aria-labelledby="agenda-preview-heading">
          <SectionTitle id="agenda-preview-heading" icon={ClipboardList} title={t("Agenda at a glance")} href={`/portal/meetings/${featured.meeting.id}#agenda`} linkText="Full agenda"/>
          {featured.meeting.agenda.length ? <ol className="divide-y divide-border">{featured.meeting.agenda.slice(0, 3).map((item) => <li key={item.id} className="flex items-start gap-3 px-5 py-3.5"><span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-medium text-muted-foreground">{item.order}</span><div className="min-w-0"><p className="text-[13px] font-medium leading-6">{t(item.title)}</p><p className="mt-0.5 text-[11px] capitalize text-muted-foreground">{item.kind}{t("resolution")}</p></div></li>)}</ol> : <p className="p-5 text-[13px] text-muted-foreground">{t("The agenda has not been published yet.")}</p>}
          <div className="border-t border-border bg-muted/20 px-5 py-3 text-[11px] leading-5 text-muted-foreground">{t("Propose, second, demand a poll and vote from the meeting room. Available actions depend on the chair's controls.")}</div>
        </section>}

        <section className={panel} aria-labelledby="activity-heading">
          <SectionTitle id="activity-heading" icon={History} title={t("Your recent activity")} href="/portal/account" linkText="View account"/>
          {data.timeline.length ? <ol className="divide-y divide-border">{data.timeline.map((item) => {
                const Icon = timelineIcons[item.kind];
                return <li key={item.id}><Link href={item.href} className="flex items-start gap-3 px-5 py-4 outline-none transition-colors duration-150 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><span className="rounded-full bg-muted p-2 text-muted-foreground"><Icon className="size-3.5" aria-hidden/></span><div className="min-w-0 flex-1"><p className="text-[13px] font-medium leading-5">{t(item.title)}</p><p className="mt-1 truncate text-xs leading-5 text-muted-foreground">{t(item.detail)}</p></div><time dateTime={item.at} className="shrink-0 text-right text-[10px] leading-4 text-muted-foreground">{portalMeetingDate(item.at, undefined, locale)}<br />{portalMeetingTime(item.at, undefined, locale)}</time></Link></li>;
            })}</ol> : <div className="px-5 py-8 text-center"><History className="mx-auto mb-3 size-6 text-muted-foreground/60" aria-hidden/><p className="text-xs font-medium">{t("Your participation starts here")}</p><p className="mt-1 text-xs text-muted-foreground">{t("Register for a meeting to see your activity and confirmation history.")}</p></div>}
        </section>
      </div>

      <aside className="min-w-0 space-y-5 lg:col-start-2 lg:row-start-2 lg:row-span-2" aria-label={t("Your shareholder account summary")}>
        <section className={`${panel} overflow-hidden`} aria-labelledby="account-heading">
          <div className="bg-brand-navy px-5 py-5 text-white"><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-white/70"><Landmark className="size-4" aria-hidden/>{t("Your shareholder account")}</div><h2 id="account-heading" className="mt-3 text-base font-semibold leading-snug">{identity.subjectName}</h2><p className="mt-1 text-[13px] text-white/70">{company.shortName}</p><p className="mt-4 font-mono text-xs leading-5 text-white/80">{t("BO / Folio ?")}{" "}{identity.maskedBoId}</p></div>
          <div className="space-y-4 p-5"><div className="flex items-center justify-between gap-2"><p className="text-[11px] text-muted-foreground">{t("Signed in as")}</p><span className="rounded-full bg-brand-soft px-2 py-1 text-[10px] font-medium text-brand">{identity.kind === "proxy" ? t("Proxy") : identity.kind === "corporate" ? t("Corporate representative") : t("Individual holder")}</span></div>
            <div><p className="mb-3 text-[11px] font-semibold text-foreground">{t("Holdings by share class")}</p><ul className="space-y-3">{data.holdings.map((holding) => <li key={holding.shareClass}><div className="mb-1.5 flex justify-between text-xs"><span className="text-muted-foreground">{holding.shareClass}</span><span className="font-medium tabular-nums">{number(holding.shares)}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={t(`${holding.shareClass}: ${number(holding.shares)} shares`)}><div className="h-full rounded-full bg-brand" style={{ width: `${data.totalShares ? holding.shares / data.totalShares * 100 : 0}%` }}/></div></li>)}</ul></div>
            <Link href="/portal/account#holdings" className="flex items-center justify-between border-t border-border pt-3 text-xs font-medium text-brand hover:underline">{t("View account details")}<ArrowRight className="size-3.5" aria-hidden/></Link>
          </div>
        </section>

        <section className={panel} aria-labelledby="participation-heading"><SectionTitle id="participation-heading" icon={MessageSquare} title={t("My participation")}/><div className="space-y-3 p-5"><SummaryRow label={t("Questions awaiting review")} value={data.pendingQuestions}/><SummaryRow label={t("Questions approved")} value={data.approvedQuestions}/><SummaryRow label={t("Approved appointments")} value={data.approvedAppointments}/><SummaryRow label={t("Appointments awaiting review")} value={data.pendingAppointments}/><Link href="/portal/account#questions" className="mt-1 flex items-center justify-between border-t border-border pt-3 text-xs font-medium text-brand hover:underline">{t("Questions, receipts & proxies")}<ArrowRight className="size-3.5" aria-hidden/></Link></div></section>

        <section className="rounded-xl border border-brand/20 bg-brand-soft/60 p-5" aria-labelledby="help-heading"><div className="flex items-center gap-2 text-brand"><HelpCircle className="size-4" aria-hidden/><h2 id="help-heading" className="text-[13px] font-semibold">{t("Ready for your AGM?")}</h2></div><p className="mt-2 text-[13px] leading-6 text-muted-foreground">{t("Submit questions in Bangla or English. They appear after moderator approval.")}</p><a href="#participation-guide" className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">{t("Read participation guide")}<ChevronRight className="size-3.5" aria-hidden/></a></section>
      </aside>
    </div>

    <section aria-labelledby="more-meetings-heading" className={panel}>
      <SectionTitle id="more-meetings-heading" icon={CalendarDays} title={t("Other meetings")} href="/portal/meetings" linkText="All meetings"/>
      {data.meetings.filter((m) => m.meeting.id !== featured?.meeting.id).length ? <ul className="divide-y divide-border">{data.meetings.filter((m) => m.meeting.id !== featured?.meeting.id).slice(0, 4).map(({ meeting, registered }) => <li key={meeting.id}><Link href={`/portal/meetings/${meeting.id}`} className="flex flex-wrap items-center gap-3 px-5 py-4 outline-none hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><span className="rounded-md bg-muted px-2 py-1 font-mono text-[10px] font-semibold">{meeting.type}</span><div className="min-w-0 flex-1"><p className="text-xs font-medium">{t(meeting.title)}</p><p className="mt-1 text-[11px] text-muted-foreground">{portalMeetingDate(meeting.date, meeting.timezone, locale)} · {meeting.financialYear}</p></div><span className="text-[11px] text-muted-foreground">{meeting.status === "completed" ? t("Completed") : registered ? t("Registered") : t("View notice")}</span><ArrowRight className="size-4 text-muted-foreground" aria-hidden/></Link></li>)}</ul> : <p className="px-5 py-6 text-xs text-muted-foreground">{t("No other published meetings are available for your account.")}</p>}
    </section>

    <section id="participation-guide" aria-labelledby="guide-heading" className={`${panel} scroll-mt-32 p-5 sm:p-6`}>
      <div className="flex items-center gap-2"><BookOpen className="size-4 text-brand" aria-hidden/><h2 id="guide-heading" className="text-sm font-semibold">{t("Your guide to meeting participation")}</h2></div><p className="mt-1 text-xs text-muted-foreground">{t("From registration to your voting confirmation.")}</p>
      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{[
            { icon: UserCheck, title: t("1. Check & register"), text: t("Review the notice, record date and your eligibility, then register for the meeting.") },
            { icon: Video, title: t("2. Join the meeting"), text: t("Use Enter meeting room once registered and the room is available. The demo video stage is simulated.") },
            { icon: Vote, title: t("3. Participate & vote"), text: t("Read each agenda. Use proposal, seconding and poll controls when available. Confirm your vote and keep the receipt.") },
            { icon: Mic, title: t("4. Ask a question"), text: t("Send a Bangla or English comment, or record an audio question from the room. Moderators review submissions before sharing.") },
        ].map(({ icon: Icon, title, text }) => <div key={t(title)}><Icon className="mb-3 size-5 text-brand" aria-hidden/><h3 className="text-[13px] font-semibold">{t(title)}</h3><p className="mt-2 text-[13px] leading-6 text-muted-foreground">{t(text)}</p></div>)}</div>
    </section>
  </div>;
}
function SectionTitle({ id, icon: Icon, title, href, linkText }: {
    id: string;
    icon: LucideIcon;
    title: string;
    href?: string;
    linkText?: string;
}) {
    const { t } = usePortalLanguage();
    return <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4"><h2 id={id} className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-muted-foreground" aria-hidden/>{t(title)}</h2>{href && <Link href={href} className="inline-flex items-center gap-1 text-[11px] font-medium text-brand hover:underline">{linkText}<ArrowRight className="size-3" aria-hidden/></Link>}</div>;
}
function SummaryRow({ label, value }: {
    label: string;
    value: number;
}) {
    const { t } = usePortalLanguage();
    return <div className="flex items-center justify-between gap-3 text-[13px] leading-5"><span className="text-muted-foreground">{t(label)}</span><span className="flex min-w-6 items-center justify-center rounded-md bg-muted px-1.5 py-1 text-[11px] font-semibold tabular-nums">{value}</span></div>;
}
