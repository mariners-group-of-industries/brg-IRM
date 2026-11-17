"use client";
import { usePortalLanguage } from "@/components/portal/language-provider";
import { useState } from "react";
import { CalendarDays, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PortalMeetingCard } from "./meeting-card";
import type { PortalMeetingSummary } from "@/lib/portal-dashboard";
import { cn } from "@/lib/utils";
export function PortalMeetingsList({ meetings, initialView = "upcoming" }: {
    meetings: PortalMeetingSummary[];
    initialView?: "upcoming" | "past";
}) {
    const { t } = usePortalLanguage();
    const [view, setView] = useState(initialView);
    const [query, setQuery] = useState("");
    const [registeredOnly, setRegisteredOnly] = useState(false);
    const matches = meetings.filter((m) => (view === "past" ? m.meeting.status === "completed" : m.meeting.status !== "completed") && (!registeredOnly || m.registered) && `${m.meeting.title} ${m.meeting.financialYear} ${m.meeting.type}`.toLowerCase().includes(query.toLowerCase()));
    return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-card">
      <div className="inline-flex rounded-lg bg-muted p-1" aria-label={t("Meeting timeframe")}>{(["upcoming", "past"] as const).map((value) => <button key={value} aria-pressed={view === value} onClick={() => setView(value)} className={cn("rounded-md px-3 py-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring", view === value ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground")}>
        {value === "upcoming" ? t("Upcoming") : t("Past meetings")}<span className="ml-2 text-[10px] text-muted-foreground">{meetings.filter((m) => value === "past" ? m.meeting.status === "completed" : m.meeting.status !== "completed").length}</span>
      </button>)}</div>
      <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto"><label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={registeredOnly} onChange={(e) => setRegisteredOnly(e.target.checked)} className="accent-brand"/>{t("Registered only")}</label><div className="relative min-w-48 flex-1"><Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" aria-hidden/><Input value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 pl-8" placeholder={t("Search meetings\u2026")} aria-label={t("Search my meetings")}/></div></div>
    </div>
    <p className="text-xs text-muted-foreground" role="status">{t(registeredOnly ? "{count} meetings registered" : "{count} meetings available", {count: matches.length})}</p>
    {matches.length ? <div className="grid items-start gap-4 lg:grid-cols-2">{matches.map((summary) => <PortalMeetingCard key={summary.meeting.id} summary={summary}/>)}</div> : <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center"><CalendarDays className="mx-auto mb-4 size-8 text-muted-foreground/60" aria-hidden/><h2 className="text-base font-semibold">{t("No meetings to show")}</h2><p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-muted-foreground">{query || registeredOnly ? t("Try another search or clear the registered-only filter.") : view === "past" ? t("Completed, published meetings will appear here.") : t("There are no published upcoming meetings available for your account.")}</p>{(query || registeredOnly) && <Button variant="outline" className="mt-4" onClick={() => { setQuery(""); setRegisteredOnly(false); }}>{t("Clear filters")}</Button>}</div>}
  </div>;
}
