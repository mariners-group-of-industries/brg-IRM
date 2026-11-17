"use client";
import { usePortalLanguage } from "@/components/portal/language-provider";
import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, MapPin, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MeetingTypeBadge } from "@/components/status-badge";
import { MeetingNextAction, PortalPhaseBadge } from "./meeting-state";
import { RegisterButton } from "./register-button";
import { portalMeetingDate, portalMeetingTime } from "@/lib/portal-format";
import type { PortalMeetingSummary } from "@/lib/portal-dashboard";
import { cn } from "@/lib/utils";
const unavailableLabels = {
    not_open: "Registration has not opened",
    closed: "Registration window closed",
    ineligible: "No eligible holding / authorization",
    completed: "Meeting concluded",
};
export function PortalMeetingCard({ summary, featured = false }: {
    summary: PortalMeetingSummary;
    featured?: boolean;
}) {
    const { t, locale, number } = usePortalLanguage();
    const { meeting, availability, canEnter, registered } = summary;
    const date = Object.fromEntries(new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
        day: "2-digit", month: "short", year: "numeric", timeZone: meeting.timezone,
    }).formatToParts(new Date(meeting.date)).map((part) => [part.type, part.value]));
    const agendaCount = meeting.agenda.length;
    const votesCast = Math.min(summary.votesCast, agendaCount);
    const percent = agendaCount ? votesCast / agendaCount * 100 : 0;
    return (<article className={cn("overflow-hidden rounded-xl border bg-card shadow-card transition-[border-color,box-shadow] duration-150", featured ? "border-brand/30" : "border-border hover:border-brand/25")}>
      {featured && <div className="flex items-center justify-between gap-3 border-b border-brand/15 bg-brand-soft/60 px-4 py-2.5 sm:px-6 sm:py-3">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand"><CalendarDays className="size-4" aria-hidden/>{["live", "voting_open"].includes(meeting.status) ? t("Happening now") : t("Your next meeting")}</p>
        <span className="text-[10px] text-muted-foreground sm:text-[11px]">{meeting.financialYear}</span>
      </div>}
      <div className={cn("p-4 sm:p-5", featured && "sm:p-6")}>
        <div className="flex flex-wrap items-center gap-2">
          <MeetingTypeBadge type={meeting.type}/><PortalPhaseBadge phase={summary.phase}/>
          {registered && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success"><CheckCircle2 className="size-3.5" aria-hidden/>{t("Registered")}</span>}
        </div>
        <h3 className={cn("mt-2.5 font-semibold leading-tight tracking-tight", featured ? "text-[23px] sm:text-[28px]" : "text-lg")}>
          <Link href={`/portal/meetings/${meeting.id}`} className="rounded-sm outline-none transition-colors duration-150 hover:text-brand focus-visible:ring-2 focus-visible:ring-ring">{t(meeting.title)}</Link>
        </h3>

        {featured ? <div className="mt-4 flex items-center gap-3.5 sm:gap-4">
          <time dateTime={meeting.date} aria-label={t(portalMeetingDate(meeting.date, meeting.timezone, locale))} className="flex w-[68px] shrink-0 flex-col items-center rounded-lg border border-brand/20 bg-brand-soft/50 px-2 py-2 text-brand">
            <span className="text-[28px] font-semibold leading-8 tabular-nums">{date.day}</span>
            <span className="mt-0.5 whitespace-nowrap text-[9px] font-semibold uppercase tracking-wider">{date.month} {date.year}</span>
          </time>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5"><span className="text-base font-semibold tabular-nums">{portalMeetingTime(meeting.date, meeting.timezone, locale)}</span><span className="text-[10px] text-muted-foreground">{meeting.timezone}</span></p>
            <p className="mt-1 flex items-center gap-1.5 text-[13px] capitalize text-muted-foreground"><Video className="size-3.5 shrink-0" aria-hidden/>{t(meeting.mode)}{" "}{t("Meeting")}</p>
            <p className="mt-1 flex items-start gap-1.5 text-xs leading-5 text-muted-foreground"><MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden/><span className="line-clamp-2" title={t(meeting.venue)}>{meeting.venue}</span></p>
          </div>
        </div> : <>
          <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-muted-foreground">
            <div className="flex items-center gap-1.5"><CalendarDays className="size-4" aria-hidden/><dt className="sr-only">{t("Date")}</dt><dd>{portalMeetingDate(meeting.date, meeting.timezone, locale)}</dd></div>
            <div className="flex items-center gap-1.5"><Clock3 className="size-4" aria-hidden/><dt className="sr-only">{t("Time")}</dt><dd>{portalMeetingTime(meeting.date, meeting.timezone, locale)} · {meeting.timezone}</dd></div>
            <div className="flex items-center gap-1.5"><Video className="size-4" aria-hidden/><dt className="sr-only">{t("Format")}</dt><dd className="capitalize">{t(meeting.mode)}{" "}{t("Meeting")}</dd></div>
          </dl>
          <p className="mt-2 flex items-start gap-1.5 text-[13px] leading-5 text-muted-foreground"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden/>{meeting.venue}</p>
        </>}

        <div className={cn("mt-4 flex flex-wrap items-center gap-2.5", featured && "sm:mt-5")}>
          {canEnter ? <Button nativeButton={false} aria-label={t(summary.phase === "waiting" ? "Join waiting room" : "Enter meeting room")} className={cn("bg-brand text-brand-foreground hover:bg-brand/90", featured ? "h-11 min-w-44 flex-1 text-sm sm:flex-none" : "h-10")} render={<Link href={`/portal/meetings/${meeting.id}/room`}/>}><Video />{t(summary.phase === "waiting" ? "Join waiting room" : "Join meeting")}<ArrowRight /></Button>
            : availability === "available" ? <div className={cn("min-w-44", featured && "flex-1 sm:flex-none")}><RegisterButton meetingId={meeting.id} initiallyRegistered={false} closed={false} className={featured ? "h-11 px-4 text-[13px] transition-shadow duration-150 hover:shadow-lift" : undefined}/></div>
                : availability === "registered" ? <span className="flex-1 text-xs leading-5 text-success">{t("Registered \u00B7 room opens when ready")}</span>
                    : <span className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{t(unavailableLabels[availability])}</span>}
          <Button nativeButton={false} variant={featured ? "ghost" : "outline"} className={cn("h-9 text-[13px]", featured && "px-1.5 text-brand hover:bg-brand-soft")} render={<Link href={`/portal/meetings/${meeting.id}`}/>}>{meeting.status === "completed" ? t("View outcomes") : t("Notice & agenda")}<ArrowRight /></Button>
        </div>

        {featured && <div className="mt-4 space-y-3 border-t border-border pt-3.5 sm:mt-5 sm:pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
            <p className="text-muted-foreground">{t("Record-date eligibility")}<span className="ml-1 font-semibold text-foreground tabular-nums">{number(summary.shares)}{" "}{t("shares")}</span></p>
            <p className="text-[11px] text-muted-foreground">{number(agendaCount)} {t(agendaCount === 1 ? "agenda item" : "agenda items")}</p>
          </div>
          {agendaCount > 0 ? <div>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><p className="font-medium">{votesCast === agendaCount ? t("All agenda ballots recorded") : votesCast ? t("{cast} of {total} agenda ballots recorded", {cast:votesCast,total:agendaCount}) : t("Voting progress")}</p><span className="shrink-0 font-semibold tabular-nums text-brand">{number(votesCast)}<span className="font-normal text-muted-foreground"> / {number(agendaCount)}</span></span></div>
            <div role="progressbar" aria-label={t("Account agenda voting progress")} aria-valuemin={0} aria-valuemax={agendaCount} aria-valuenow={votesCast} aria-valuetext={t("{cast} of {total} agenda ballots recorded",{cast:votesCast,total:agendaCount})} className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-brand transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${percent}%` }}/>
            </div>
          </div> : <p className="text-xs text-muted-foreground">{t("Voting progress appears when the agenda is published.")}</p>}
        </div>}
        {featured && <MeetingNextAction summary={summary}/>}
      </div>
    </article>);
}
