"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarCheck2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Copy,
  FileCheck2,
  History,
  Info,
  Radio,
  ShieldCheck,
  TicketCheck,
  TrendingUp,
  UserCheck,
  Users,
  Video,
  Vote,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RegisterButton } from "./register-button";
import { DemoDisclosure } from "./demo-disclosure";
import { portalMeetingDate, portalMeetingTime } from "@/lib/portal-format";
import type { getPortalDashboard, PortalMeetingSummary } from "@/lib/portal-dashboard";
import { usePortalLanguage } from "./language-provider";
import { cn } from "@/lib/utils";

type DashboardData = NonNullable<ReturnType<typeof getPortalDashboard>>;

const timelineIcons: Record<string, LucideIcon> = {
  registration: CalendarCheck2,
  attendance: Video,
  ballot: Vote,
  question: CheckCircle2,
  authorization: UserCheck,
};

const unavailableLabels: Record<string, string> = {
  not_open: "Registration has not opened",
  closed: "Registration window closed",
  ineligible: "No eligible holding / authorization",
  completed: "Meeting concluded",
};

export function ShareholderDashboard({
  data,
  today,
}: {
  data: DashboardData;
  today: string;
}) {
  const { t, number, locale } = usePortalLanguage();
  const { identity, company, featured } = data;
  const [copied, setCopied] = useState(false);

  const firstName = identity.name.split(" ")[0];

  const handleCopyBo = () => {
    navigator.clipboard.writeText(identity.maskedBoId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 4 KPI Summary Cards
  const stats = [
    {
      label: "Shares Held",
      value: number(data.totalShares),
      hint: "Across eligible balances",
      icon: Wallet,
      iconBg: "bg-[#DFF6F1] text-[#008F83]",
      href: "/portal/account#holdings",
      hasSparkline: true,
    },
    {
      label: "Upcoming Meetings",
      value: number(data.upcoming.length),
      hint: "Scheduled for your account",
      icon: CalendarDays,
      iconBg: "bg-[#EFF7FF] text-[#112B4E]",
      href: "/portal/meetings",
      watermarkIcon: CalendarDays,
    },
    {
      label: "Registered Meetings",
      value: number(data.registrationCount),
      hint: "Via BO / Folio account",
      icon: TicketCheck,
      iconBg: "bg-[#E8FAF5] text-[#0C9488]",
      href: "/portal/account#registrations",
      watermarkIcon: Users,
    },
    {
      label: "My Ballot Receipts",
      value: number(data.receiptCount),
      hint: "Your voting confirmations",
      icon: FileCheck2,
      iconBg: "bg-[#E8FAF5] text-[#008F83]",
      href: "/portal/account#receipts",
      watermarkIcon: CheckCircle2,
    },
  ];

  return (
    <div className="space-y-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      {/* ─────────────────────────────────────────────────────────────
          PHASE 4: DASHBOARD INTRO WITH CORPORATE ARCHITECTURE ARTWORK
      ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl border border-[#E3EBF2] bg-white p-6 shadow-[0_4px_16px_rgba(15,23,42,0.04)] sm:p-7">
        {/* Modern Corporate High-Rise Building Backdrop Graphic */}
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0 hidden w-[380px] select-none opacity-85 md:block"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 380 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-full w-full object-cover"
          >
            <defs>
              <linearGradient id="skyGrad" x1="0" y1="0" x2="380" y2="200" gradientUnits="userSpaceOnUse">
                <stop stopColor="#F4F8FC" stopOpacity="0" />
                <stop offset="60%" stopColor="#EFF7FF" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#DFF6F1" stopOpacity="0.9" />
              </linearGradient>
              <linearGradient id="towerGrad1" x1="160" y1="10" x2="260" y2="200" gradientUnits="userSpaceOnUse">
                <stop stopColor="#38BDF8" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#0284C7" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="towerGrad2" x1="220" y1="0" x2="360" y2="200" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0EA5E9" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#0369A1" stopOpacity="0.9" />
              </linearGradient>
              <linearGradient id="glassReflection" x1="180" y1="20" x2="340" y2="180" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FFFFFF" stopOpacity="0.6" />
                <stop offset="40%" stopColor="#E0F2FE" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#BAE6FD" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Ambient background wash */}
            <rect width="380" height="200" fill="url(#skyGrad)" />

            {/* Left Lower Tower Facet */}
            <path d="M150 200 L180 50 L240 70 L220 200 Z" fill="url(#towerGrad1)" />
            {/* Main High-Rise Glass Facet */}
            <path d="M220 200 L240 70 L290 10 L340 40 L300 200 Z" fill="url(#towerGrad2)" />
            {/* Right Tower Angle */}
            <path d="M300 200 L340 40 L370 70 L340 200 Z" fill="#0284C7" fillOpacity="0.75" />

            {/* Glass panel horizontal mullions */}
            <path d="M174 80 L236 98 M168 110 L232 126 M162 140 L228 154 M156 170 L224 182" stroke="#FFFFFF" strokeWidth="1" strokeOpacity="0.4" />
            <path d="M245 60 L295 25 M250 85 L305 45 M256 110 L315 65 M262 135 L325 85 M268 160 L335 105" stroke="#FFFFFF" strokeWidth="1" strokeOpacity="0.4" />

            {/* Architectural diagonal sun glare */}
            <polygon points="210,0 270,0 350,200 290,200" fill="url(#glassReflection)" />

            {/* Subtle greenery/foliage hedge at the base */}
            <path d="M120 200 Q150 180 180 200 Q210 182 240 200 Q270 178 300 200 Q330 180 360 200 Q380 185 390 200 Z" fill="#0C9488" fillOpacity="0.25" />
            <path d="M140 200 Q170 186 200 200 Q230 188 260 200 Q290 184 320 200 Q350 186 380 200 Z" fill="#059669" fillOpacity="0.35" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("Welcome back, {name}", { name: firstName })} 👋
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-[#12263F] sm:text-3xl">
              {t("Shareholder Dashboard")}
            </h1>
            <p className="text-sm text-slate-500">
              {t("Your meetings. Your participation. All in one place.")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:flex-col sm:items-end">
            {/* Live Bangladesh Time Badge */}
            <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-3.5 py-1 text-xs font-medium text-slate-600 shadow-2xs backdrop-blur-xs">
              <CalendarDays className="h-3.5 w-3.5 text-[#008F83]" aria-hidden />
              <span>{today}</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500">{t("Bangladesh time")}</span>
            </div>

            {/* Verified Shareholder Badge */}
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-semibold text-emerald-700 shadow-2xs">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
              <span>{t("Verified Shareholder")}</span>
            </div>

            <DemoDisclosure />
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          PHASE 5: 4 KPI SUMMARY CARDS
      ───────────────────────────────────────────────────────────── */}
      <section aria-label={t("Account overview")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(
            ({ label, value, hint, icon: Icon, iconBg, href, hasSparkline, watermarkIcon: Watermark }) => (
              <Link
                key={label}
                href={href}
                className="group relative overflow-hidden rounded-[14px] border border-[#E3EBF2] bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#008F83]/40 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] outline-none focus-visible:ring-2 focus-visible:ring-[#008F83]"
              >
                {/* Background Watermark Icon if available */}
                {Watermark && (
                  <Watermark
                    className="pointer-events-none absolute -bottom-3 -right-3 h-20 w-20 text-slate-100 opacity-60 transition-opacity group-hover:opacity-80"
                    aria-hidden
                  />
                )}

                <div className="relative z-10 flex items-center justify-between">
                  <div className={cn("flex size-10 items-center justify-center rounded-xl", iconBg)}>
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  {hasSparkline && (
                    <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      <TrendingUp className="h-3 w-3" />
                      <span>{t("Current")}</span>
                    </div>
                  )}
                </div>

                <div className="relative z-10 mt-3.5">
                  <p className="text-xs font-semibold text-slate-500">{t(label)}</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight text-[#112B4E] sm:text-3xl">
                    {value}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{t(hint)}</p>
                </div>
              </Link>
            )
          )}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          MAIN CONTENT AREA (Left 8 cols, Right 4 cols)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* ─── LEFT COLUMN (col-span-8) ─── */}
        <div className="space-y-6 lg:col-span-8">
          {/* ─────────────────────────────────────────────────────────
              PHASE 6: FEATURED NEXT MEETING CARD
          ───────────────────────────────────────────────────────── */}
          {featured ? (
            <FeaturedMeetingCard summary={featured} />
          ) : (
            <div className="rounded-[14px] border border-[#E3EBF2] bg-white p-8 text-center shadow-[0_4px_16px_rgba(15,23,42,0.04)]">
              <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-[#DFF6F1] text-[#008F83]">
                <CalendarDays className="h-6 w-6" aria-hidden />
              </span>
              <h2 className="mt-4 text-lg font-bold text-[#12263F]">{t("No upcoming meetings")}</h2>
              <p className="mt-1.5 text-xs text-slate-500">
                {t("Published meetings for {company} will appear here.", { company: company.shortName })}
              </p>
              <Button
                nativeButton={false}
                variant="outline"
                className="mt-5 rounded-[10px] border-[#008F83] text-[#008F83] hover:bg-[#DFF6F1]"
                render={<Link href="/portal/meetings" />}
              >
                {t("View my meetings")}
                <ArrowRight className="size-4" />
              </Button>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────
              PHASE 9: AGENDA AT A GLANCE & RECENT ACTIVITY (Split Row)
          ───────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Agenda at a Glance */}
            <div className="flex flex-col justify-between rounded-[14px] border border-[#E3EBF2] bg-white shadow-[0_4px_16px_rgba(15,23,42,0.04)]">
              <div>
                <div className="flex items-center justify-between border-b border-[#E3EBF2] px-5 py-4">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-[#008F83]" aria-hidden />
                    <h2 className="text-sm font-bold text-[#12263F]">{t("Agenda at a glance")}</h2>
                  </div>
                  {featured && (
                    <Link
                      href={`/portal/meetings/${featured.meeting.id}#agenda`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#008F83] hover:underline"
                    >
                      {t("Full Agenda →")}
                    </Link>
                  )}
                </div>

                {featured && featured.meeting.agenda.length > 0 ? (
                  <ol className="divide-y divide-[#E3EBF2]/70 px-5 py-2">
                    {featured.meeting.agenda.slice(0, 3).map((item) => (
                      <li key={item.id} className="flex items-start gap-3 py-3">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#DFF6F1] text-xs font-bold text-[#008F83]">
                          {item.order}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-[#12263F] leading-snug">
                            {t(item.title)}
                          </p>
                          <p className="mt-0.5 text-[11px] capitalize text-slate-400">
                            {t(item.kind)} {t("resolution")}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="p-5 text-xs text-slate-500">
                    {t("The agenda has not been published yet.")}
                  </p>
                )}
              </div>

              <div className="border-t border-[#E3EBF2] bg-[#F4F8FC]/60 px-5 py-3 text-[11px] leading-5 text-slate-500 rounded-b-[14px]">
                {t(
                  "Propose, second, demand a poll and vote from the meeting room. Available actions depend on the chair's controls."
                )}
              </div>
            </div>

            {/* Your Recent Activity */}
            <div className="flex flex-col justify-between rounded-[14px] border border-[#E3EBF2] bg-white shadow-[0_4px_16px_rgba(15,23,42,0.04)]">
              <div>
                <div className="flex items-center justify-between border-b border-[#E3EBF2] px-5 py-4">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-[#008F83]" aria-hidden />
                    <h2 className="text-sm font-bold text-[#12263F]">{t("Your recent activity")}</h2>
                  </div>
                  <Link
                    href="/portal/account"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#008F83] hover:underline"
                  >
                    {t("View More →")}
                  </Link>
                </div>

                {data.timeline.length > 0 ? (
                  <ol className="divide-y divide-[#E3EBF2]/70 px-5 py-2">
                    {data.timeline.slice(0, 3).map((item) => {
                      const Icon = timelineIcons[item.kind] ?? History;
                      return (
                        <li key={item.id} className="py-3">
                          <Link
                            href={item.href}
                            className="group flex items-start gap-3 outline-none"
                          >
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-[#DFF6F1] group-hover:text-[#008F83]">
                              <Icon className="h-3.5 w-3.5" aria-hidden />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-[#12263F] group-hover:text-[#008F83]">
                                {t(item.title)}
                              </p>
                              <p className="mt-0.5 truncate text-[11px] text-slate-400">
                                {t(item.detail)}
                              </p>
                            </div>
                            <time
                              dateTime={item.at}
                              className="shrink-0 text-right text-[10px] text-slate-400"
                            >
                              {portalMeetingDate(item.at, undefined, locale)}
                              <br />
                              {portalMeetingTime(item.at, undefined, locale)}
                            </time>
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <div className="p-8 text-center">
                    <History className="mx-auto size-7 text-slate-300" aria-hidden />
                    <p className="mt-2 text-xs font-semibold text-slate-600">
                      {t("Your participation starts here")}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {t("Register for a meeting to see your activity and confirmation history.")}
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t border-[#E3EBF2] bg-[#F4F8FC]/60 px-5 py-3 text-[11px] leading-5 text-slate-500 rounded-b-[14px]">
                {t("From registration to your voting confirmation.")}
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────
              PHASE 10: OTHER MEETINGS
          ───────────────────────────────────────────────────────── */}
          <div className="rounded-[14px] border border-[#E3EBF2] bg-white shadow-[0_4px_16px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between border-b border-[#E3EBF2] px-5 py-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-[#008F83]" aria-hidden />
                <h2 className="text-sm font-bold text-[#12263F]">{t("Other meetings")}</h2>
              </div>
              <Link
                href="/portal/meetings"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#008F83] hover:underline"
              >
                {t("All Meetings →")}
              </Link>
            </div>

            {data.meetings.filter((m) => m.meeting.id !== featured?.meeting.id).length > 0 ? (
              <ul className="divide-y divide-[#E3EBF2]/70">
                {data.meetings
                  .filter((m) => m.meeting.id !== featured?.meeting.id)
                  .slice(0, 4)
                  .map(({ meeting, registered }) => {
                    const meetingDate = new Date(meeting.date);
                    const day = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
                      day: "2-digit",
                      timeZone: meeting.timezone,
                    }).format(meetingDate);
                    const month = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
                      month: "short",
                      timeZone: meeting.timezone,
                    }).format(meetingDate);

                    return (
                      <li key={meeting.id}>
                        <Link
                          href={`/portal/meetings/${meeting.id}`}
                          className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50/80 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#008F83]"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            {/* Date Badge */}
                            <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-teal-200/60 bg-[#DFF6F1]/50 text-[#008F83]">
                              <span className="text-sm font-bold leading-tight">{day}</span>
                              <span className="text-[10px] font-semibold uppercase">{month}</span>
                            </div>

                            <div className="min-w-0 flex-1">
                              <h3 className="truncate text-xs font-semibold text-[#12263F]">
                                {t(meeting.title)}
                              </h3>
                              <p className="mt-0.5 text-[11px] text-slate-400">
                                📅 {portalMeetingDate(meeting.date, meeting.timezone, locale)} ·{" "}
                                {portalMeetingTime(meeting.date, meeting.timezone, locale)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {meeting.status === "completed" ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                                <Check className="h-3 w-3" />
                                {t("Completed")}
                              </span>
                            ) : registered ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-[#008F83]">
                                <Check className="h-3 w-3" />
                                {t("Registered")}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                                <Clock3 className="h-3 w-3" />
                                {t("Upcoming")}
                              </span>
                            )}
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          </div>
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            ) : (
              <p className="px-5 py-6 text-xs text-slate-400">
                {t("No other published meetings are available for your account.")}
              </p>
            )}
          </div>
        </div>

        {/* ─── RIGHT SIDEBAR (col-span-4) ─── */}
        <aside
          className="space-y-6 lg:col-span-4"
          aria-label={t("Your shareholder account summary")}
        >
          {/* ─────────────────────────────────────────────────────────
              PHASE 7: SHAREHOLDER ACCOUNT SIDEBAR CARD
          ───────────────────────────────────────────────────────── */}
          <div className="overflow-hidden rounded-[14px] border border-[#E3EBF2] bg-white shadow-[0_4px_16px_rgba(15,23,42,0.04)]">
            {/* Dark Navy Header with Geometric Grid Backdrop */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#112B4E] to-[#091F3B] p-5 text-white">
              {/* Subtle architectural wireframe in background */}
              <div
                className="pointer-events-none absolute -right-6 -bottom-6 h-32 w-32 opacity-15 select-none"
                aria-hidden="true"
              >
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="10" y="10" width="80" height="80" stroke="white" strokeWidth="2" />
                  <line x1="10" y1="50" x2="90" y2="50" stroke="white" strokeWidth="1" />
                  <line x1="50" y1="10" x2="50" y2="90" stroke="white" strokeWidth="1" />
                  <line x1="10" y1="10" x2="90" y2="90" stroke="white" strokeWidth="1" />
                </svg>
              </div>

              <div className="relative z-10">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/70">
                  <UserCheck className="h-3.5 w-3.5 text-[#008F83]" aria-hidden />
                  <span>{t("MY SHAREHOLDER ACCOUNT")}</span>
                </div>

                <h2 className="mt-3 text-lg font-bold tracking-tight text-white">
                  {identity.subjectName}
                </h2>
                <p className="text-xs font-medium text-teal-200/90">{company.shortName}</p>

                {/* Masked BO ID with Copy Button */}
                <div className="mt-4 flex items-center justify-between rounded-lg bg-white/10 px-3 py-2 backdrop-blur-xs">
                  <div className="text-xs">
                    <span className="text-white/60">BO / Folio: </span>
                    <span className="font-mono font-semibold text-white">
                      {identity.maskedBoId}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyBo}
                    title={t("Copy BO ID")}
                    className="rounded p-1 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* White Lower Status Area */}
            <div className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">{t("Account Status")}</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  <Check className="h-3 w-3" />
                  {t("Verified")}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-500">{t("Ordinary Shares")}</span>
                  <span className="font-bold text-[#112B4E] tabular-nums">
                    {number(data.totalShares)}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-[#008F83] w-full" />
                </div>
              </div>

              <div className="border-t border-[#E3EBF2] pt-3">
                <Link
                  href="/portal/account#holdings"
                  className="flex items-center justify-between text-xs font-semibold text-[#008F83] hover:underline"
                >
                  <span>{t("View Account Details →")}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────
              PHASE 8: PARTICIPATION PANEL
          ───────────────────────────────────────────────────────── */}
          <div className="rounded-[14px] border border-[#E3EBF2] bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-2 border-b border-[#E3EBF2] pb-3.5">
              <Vote className="h-4 w-4 text-[#008F83]" aria-hidden />
              <h2 className="text-sm font-bold text-[#12263F]">{t("My Participation")}</h2>
            </div>

            <div className="mt-3.5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">{t("Questions approved")}</span>
                <span className="flex size-6 items-center justify-center rounded-md bg-[#DFF6F1] font-bold text-[#008F83]">
                  {number(data.approvedQuestions)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">{t("Questions awaiting review")}</span>
                <span className="flex size-6 items-center justify-center rounded-md bg-slate-100 font-bold text-slate-700">
                  {number(data.pendingQuestions)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">{t("Approved appointments")}</span>
                <span className="flex size-6 items-center justify-center rounded-md bg-[#DFF6F1] font-bold text-[#008F83]">
                  {number(data.approvedAppointments)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">{t("Appointments awaiting review")}</span>
                <span className="flex size-6 items-center justify-center rounded-md bg-slate-100 font-bold text-slate-700">
                  {number(data.pendingAppointments)}
                </span>
              </div>

              <div className="border-t border-[#E3EBF2] pt-3">
                <Link
                  href="/portal/account#questions"
                  className="flex items-center justify-between text-xs font-semibold text-[#008F83] hover:underline"
                >
                  <span>{t("Questions, Receipts & Proxies →")}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────
              READY FOR YOUR AGM / EGM? MINT BANNER CARD
          ───────────────────────────────────────────────────────── */}
          <div className="relative overflow-hidden rounded-[14px] border border-[#C5EDE4] bg-gradient-to-br from-[#E6F7F4] to-[#F0FAF8] p-5 shadow-[0_4px_16px_rgba(15,23,42,0.03)]">
            {/* Watermark Book Graphic in Bottom Right */}
            <div
              className="pointer-events-none absolute -bottom-3 -right-3 opacity-25 select-none"
              aria-hidden="true"
            >
              <BookOpen className="h-28 w-28 text-[#008F83]" />
            </div>

            <div className="relative z-10">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-white/80 text-[#008F83] shadow-2xs">
                  <BookOpen className="h-4 w-4" aria-hidden />
                </div>
                <h2 className="text-sm font-bold text-[#12263F]">
                  {t("Ready for your AGM/EGM?")}
                </h2>
              </div>

              <p className="mt-2 text-xs leading-5 text-slate-600">
                {t("A simple guide to registration, voting and meeting participation.")}
              </p>

              <div className="mt-4">
                <a
                  href="#participation-guide"
                  className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#008F83] px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#00766D]"
                >
                  <span>{t("Read Participation Guide →")}</span>
                </a>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          PHASE 11: YOUR GUIDE TO MEETING PARTICIPATION (Bottom Process Bar)
      ───────────────────────────────────────────────────────────── */}
      <section
        id="participation-guide"
        aria-labelledby="guide-heading"
        className="rounded-[14px] border border-[#D5EBE6] bg-gradient-to-r from-[#DFF6F1]/70 via-[#EAF7F5]/70 to-[#EFF7FF]/70 p-6 shadow-[0_4px_16px_rgba(15,23,42,0.03)]"
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          {/* Section Heading */}
          <div className="lg:w-1/4 shrink-0">
            <h2 id="guide-heading" className="text-lg font-bold text-[#112B4E]">
              {t("Your Guide to Meeting Participation")}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {t("From registration to your voting confirmation.")}
            </p>
          </div>

          {/* 4 Steps with Chevrons */}
          <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-2">
            {[
              {
                icon: UserCheck,
                title: "1. Check & Register",
                text: "Review the notice, record date and register for the meeting.",
              },
              {
                icon: Video,
                title: "2. Join the Meeting",
                text: "Use the meeting link and follow the instructions.",
              },
              {
                icon: Vote,
                title: "3. Participate & Vote",
                text: "Raise questions, take part in discussions and cast your vote.",
              },
              {
                icon: CheckCircle2,
                title: "4. Get Confirmation",
                text: "Receive your voting confirmation and participation receipt.",
              },
            ].map(({ icon: StepIcon, title, text }, index) => (
              <div key={title} className="relative flex items-start gap-3 lg:pr-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#008F83] shadow-2xs">
                  <StepIcon className="h-4.5 w-4.5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs font-bold text-[#12263F]">{t(title)}</h3>
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">{t(text)}</p>
                </div>
                {index < 3 && (
                  <ChevronRight
                    className="hidden lg:block absolute -right-2 top-3 h-4 w-4 text-[#008F83]/40"
                    aria-hidden
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * Featured Next Meeting Card matching reference design mockup
 */
function FeaturedMeetingCard({ summary }: { summary: PortalMeetingSummary }) {
  const { t, locale, number } = usePortalLanguage();
  const { meeting, availability, canEnter, registered } = summary;

  const meetingDate = new Date(meeting.date);

  const dayStr = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
    day: "2-digit",
    timeZone: meeting.timezone,
  }).format(meetingDate);

  const monthYearStr = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
    month: "short",
    year: "numeric",
    timeZone: meeting.timezone,
  }).format(meetingDate).toUpperCase();

  const weekdayStr = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
    weekday: "short",
    timeZone: meeting.timezone,
  }).format(meetingDate).toUpperCase();

  const agendaCount = meeting.agenda.length;
  const votesCast = Math.min(summary.votesCast, agendaCount);
  const percent = agendaCount ? (votesCast / agendaCount) * 100 : 0;

  // Deadline dates
  const openDeadline = summary.deadlines.find((d) => d.kind === "registration_open");
  const closeDeadline = summary.deadlines.find((d) => d.kind === "registration_close");

  // Dynamic next action message
  const nextActionMessage =
    summary.phase === "ended"
      ? "This meeting has ended. Review the outcomes and published documents."
      : availability === "ineligible"
      ? "No eligible holding or approved representation was found for the record date."
      : availability === "not_open"
      ? "Registration has not opened. Check the opening time below."
      : availability === "closed"
      ? "Registration has closed. You can still read the notice and published documents."
      : !registered
      ? "Registration is open. Review the notice and register before the deadline."
      : summary.phase === "waiting"
      ? "You are registered. The chair has not started the meeting."
      : summary.phase === "voting_open"
      ? "Voting is open for the active agenda. Cast your ballot in the meeting room."
      : "The meeting is live. Join to follow the current agenda.";

  return (
    <article className="overflow-hidden rounded-[14px] border border-[#E3EBF2] bg-white shadow-[0_4px_16px_rgba(15,23,42,0.04)]">
      {/* Gradient Top Banner Ribbon */}
      <div className="flex items-center justify-between bg-gradient-to-r from-[#008F83] via-[#0C9488] to-[#112B4E] px-5 py-3 text-white">
        <div className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur-xs">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden />
          <span>{t("YOUR NEXT MEETING")}</span>
        </div>
        <span className="rounded-full bg-black/20 px-3 py-1 text-xs font-semibold backdrop-blur-xs">
          {meeting.financialYear}
        </span>
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* Left Details */}
          <div className="flex-1 space-y-4">
            <h2 className="text-xl font-bold tracking-tight text-[#12263F] sm:text-2xl">
              <Link
                href={`/portal/meetings/${meeting.id}`}
                className="hover:text-[#008F83] transition-colors"
              >
                {meeting.type} — {t(meeting.title)}
              </Link>
            </h2>

            {/* Date Box & Time Details */}
            <div className="flex items-center gap-4">
              {/* Date Box */}
              <div className="flex w-20 shrink-0 flex-col items-center justify-center rounded-xl border border-teal-200/80 bg-[#E8FAF5] py-2.5 px-2 text-[#008F83]">
                <span className="text-2xl font-extrabold leading-none">{dayStr}</span>
                <span className="mt-1 text-[9px] font-bold uppercase tracking-wider">
                  {monthYearStr}
                </span>
                <span className="text-[9px] font-semibold text-teal-700">{weekdayStr}</span>
              </div>

              {/* Time & Venue Info */}
              <div className="space-y-1 text-xs text-slate-600">
                <div className="flex items-center gap-2 font-medium">
                  <Clock3 className="h-4 w-4 text-[#008F83]" aria-hidden />
                  <span>
                    {portalMeetingTime(meeting.date, meeting.timezone, locale)} (
                    {meeting.timezone === "Asia/Dhaka" ? t("Bangladesh time") : meeting.timezone})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4 text-[#008F83]" aria-hidden />
                  <span className="capitalize">
                    {t(
                      meeting.mode === "virtual"
                        ? "Virtual Meeting"
                        : meeting.mode === "hybrid"
                        ? "Hybrid Meeting"
                        : "Physical Meeting"
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-500">
                  <Radio className="h-4 w-4 text-emerald-600 animate-pulse" aria-hidden />
                  <span>{t("Live Video Conference")}</span>
                </div>
              </div>
            </div>

            {/* Action CTA Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {canEnter ? (
                <Button
                  nativeButton={false}
                  className="h-11 rounded-[10px] bg-[#112B4E] px-6 text-sm font-semibold text-white shadow-xs hover:bg-[#091F3B]"
                  render={
                    <Link href={`/portal/meetings/${meeting.id}/room`}>
                      <Video className="size-4" />
                      {t(summary.phase === "waiting" ? "Join waiting room" : "Join meeting")}
                      <ArrowRight className="size-4 ml-1.5" />
                    </Link>
                  }
                />
              ) : availability === "available" ? (
                <div className="min-w-48">
                  <RegisterButton
                    meetingId={meeting.id}
                    initiallyRegistered={false}
                    closed={false}
                    className="h-11 rounded-[10px] bg-[#112B4E] px-6 text-sm font-semibold text-white shadow-xs hover:bg-[#091F3B]"
                  />
                </div>
              ) : registered ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  {t("Registered · room opens when ready")}
                </span>
              ) : (
                <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-500">
                  {t(unavailableLabels[availability])}
                </span>
              )}

              <Link
                href={`/portal/meetings/${meeting.id}`}
                className="inline-flex items-center gap-1 text-sm font-semibold text-[#008F83] hover:text-[#00766D] hover:underline px-2 py-2"
              >
                {meeting.status === "completed" ? t("View outcomes") : t("Notice & Agenda →")}
              </Link>
            </div>
          </div>

          {/* Right Gavel & Corporate Boardroom Illustration */}
          <div className="hidden lg:flex w-72 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-slate-50 to-[#EFF7FF] p-2 border border-slate-200/60 shadow-2xs">
            <svg
              viewBox="0 0 280 160"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-36 w-full"
            >
              <defs>
                <linearGradient id="tableWood" x1="0" y1="120" x2="280" y2="160" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#E2E8F0" />
                  <stop offset="50%" stopColor="#CBD5E1" />
                  <stop offset="100%" stopColor="#94A3B8" />
                </linearGradient>
                <linearGradient id="gavelWood" x1="100" y1="40" x2="180" y2="120" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#854D0E" />
                  <stop offset="50%" stopColor="#713F12" />
                  <stop offset="100%" stopColor="#451A03" />
                </linearGradient>
                <linearGradient id="gavelBrass" x1="120" y1="45" x2="160" y2="85" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FDE047" />
                  <stop offset="60%" stopColor="#EAB308" />
                  <stop offset="100%" stopColor="#CA8A04" />
                </linearGradient>
              </defs>

              {/* Conference table surface reflection */}
              <ellipse cx="140" cy="140" rx="130" ry="18" fill="url(#tableWood)" opacity="0.6" />

              {/* Wooden Sound Block Base */}
              <ellipse cx="170" cy="132" rx="35" ry="10" fill="#451A03" />
              <ellipse cx="170" cy="128" rx="35" ry="10" fill="url(#gavelWood)" />
              <ellipse cx="170" cy="128" rx="28" ry="7" stroke="url(#gavelBrass)" strokeWidth="1.5" />

              {/* Gavel Head */}
              <g transform="rotate(-28 140 70)">
                <rect x="110" y="55" width="60" height="26" rx="4" fill="url(#gavelWood)" />
                {/* Brass Center Ring */}
                <rect x="135" y="55" width="10" height="26" fill="url(#gavelBrass)" />
                {/* Left/Right Gavel Caps */}
                <path d="M110 57 C106 57 104 63 104 68 C104 73 106 79 110 79 Z" fill="#713F12" />
                <path d="M170 57 C174 57 176 63 176 68 C176 73 174 79 170 79 Z" fill="#713F12" />

                {/* Handle */}
                <path d="M140 81 L140 150 Q140 155 137 155 Q134 155 134 150 L134 81 Z" fill="url(#gavelWood)" />
                <rect x="133" y="140" width="8" height="12" rx="2" fill="url(#gavelBrass)" />
              </g>

              {/* Soft ambient lighting highlights */}
              <circle cx="90" cy="40" r="30" fill="#38BDF8" fillOpacity="0.12" filter="blur(10px)" />
            </svg>
          </div>
        </div>

        {/* Divider and Eligibility & Voting Progress */}
        <div className="mt-5 border-t border-[#E3EBF2] pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <ShieldCheck className="h-4 w-4 text-[#008F83]" aria-hidden />
              <span>{t("Record-date eligibility:")}</span>
              <span className="font-bold text-[#112B4E]">
                {number(summary.shares)} {t("shares")}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-500">
                {t("Voting progress:")}{" "}
                <strong className="text-[#112B4E]">
                  {number(votesCast)} / {number(agendaCount)}
                </strong>
              </span>
              <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100 sm:w-36">
                <div
                  className="h-full rounded-full bg-[#008F83] transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* "Your Next Action" Alert Box */}
        <div className="mt-4 rounded-xl border border-[#C5EDE4] bg-[#E8FAF5] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-[#008F83] shadow-2xs">
              <Info className="h-3.5 w-3.5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs font-bold text-[#12263F]">{t("Your next action")}</h3>
              <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                {t(nextActionMessage)}
              </p>
            </div>
          </div>

          {(openDeadline || closeDeadline) && (
            <div className="mt-3 grid grid-cols-1 gap-2.5 border-t border-[#C5EDE4]/70 pt-3 sm:grid-cols-2 text-xs">
              {openDeadline && (
                <div className="flex items-center gap-2 text-slate-600">
                  <CalendarDays className="h-3.5 w-3.5 text-[#008F83]" aria-hidden />
                  <span className="text-slate-500">{t("Registration opens:")}</span>
                  <span className="font-semibold text-[#12263F]">
                    {portalMeetingDate(openDeadline.at, meeting.timezone, locale)} ·{" "}
                    {portalMeetingTime(openDeadline.at, meeting.timezone, locale)}
                  </span>
                </div>
              )}
              {closeDeadline && (
                <div className="flex items-center gap-2 text-slate-600">
                  <CalendarDays className="h-3.5 w-3.5 text-[#008F83]" aria-hidden />
                  <span className="text-slate-500">{t("Registration closes:")}</span>
                  <span className="font-semibold text-[#12263F]">
                    {portalMeetingDate(closeDeadline.at, meeting.timezone, locale)} ·{" "}
                    {portalMeetingTime(closeDeadline.at, meeting.timezone, locale)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
