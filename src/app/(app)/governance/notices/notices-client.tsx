"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Globe, Mail, Megaphone, Newspaper, Send, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect } from "@/components/registry/shared";
import { dispatchNoticeAction } from "./actions";
import type { Company, CompanySettings, Meeting, NoticeDispatchRecord } from "@/lib/types";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const CHANNEL_OPTIONS: { value: NoticeDispatchRecord["channel"]; label: string; icon: typeof Globe }[] = [
  { value: "portal", label: "Shareholder Portal", icon: Globe },
  { value: "email", label: "Registered Email", icon: Mail },
  { value: "sms", label: "SMS Alert", icon: Smartphone },
  { value: "newspaper", label: "Daily Newspapers / Gazette", icon: Newspaper },
];

export function NoticesClient({
  meetings,
  companies,
  settingsByCompany,
  dispatches,
  canSend,
  initialMeetingId,
}: {
  meetings: Meeting[];
  companies: Company[];
  settingsByCompany: Record<string, CompanySettings>;
  dispatches: NoticeDispatchRecord[];
  canSend: boolean;
  initialMeetingId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const defaultMtg = meetings.find((m) => m.id === initialMeetingId) ?? meetings[0];
  const [selectedMeetingId, setSelectedMeetingId] = useState(defaultMtg?.id ?? "");
  const [language, setLanguage] = useState<NoticeDispatchRecord["language"]>("bilingual");
  const [channels, setChannels] = useState<NoticeDispatchRecord["channel"][]>(["portal", "email", "sms"]);
  const [customNote, setCustomNote] = useState("");

  const companyMap = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c])), [companies]);
  const selectedMeeting = meetings.find((m) => m.id === selectedMeetingId) ?? meetings[0];
  const selectedCompany = selectedMeeting ? companyMap[selectedMeeting.companyId] : undefined;
  const requiredDays = selectedMeeting
    ? (settingsByCompany[selectedMeeting.companyId]?.noticeDaysRequired ?? 21)
    : 21;

  const daysUntilMeeting = useMemo(() => {
    if (!selectedMeeting) return 0;
    const refDate = selectedMeeting.noticePublishedAt ? new Date(selectedMeeting.noticePublishedAt) : new Date();
    const diff = new Date(selectedMeeting.date).getTime() - refDate.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }, [selectedMeeting]);

  const generatedPreview = useMemo(() => {
    if (!selectedMeeting || !selectedCompany) return "";
    const header =
      language === "bn"
        ? `বিধিবদ্ধ সভার বিজ্ঞপ্তি — ${selectedCompany.name}\n${selectedMeeting.title}`
        : language === "bilingual"
          ? `${selectedCompany.name}\nSTATUTORY NOTICE / বিধিবদ্ধ সভার বিজ্ঞপ্তি\n${selectedMeeting.title} (${selectedMeeting.financialYear})`
          : `${selectedCompany.name}\nSTATUTORY NOTICE OF ${selectedMeeting.type}\n${selectedMeeting.title} (${selectedMeeting.financialYear})`;
    const details = [
      `Date & Time: ${formatDateTime(selectedMeeting.date)} (${selectedMeeting.timezone})`,
      `Record Date: ${formatDate(selectedMeeting.recordDate)}`,
      `Venue / Mode: ${selectedMeeting.venue} [${selectedMeeting.mode.toUpperCase()}]`,
      `Voting Method: ${selectedMeeting.votingMethod.replaceAll("_", " ")} · ${selectedMeeting.pollDemandRule}`,
    ].join("\n");
    const agendaLines = selectedMeeting.agenda.length
      ? selectedMeeting.agenda
          .map(
            (a) =>
              `${a.order}. ${a.title}${language !== "en" && a.titleBn ? `\n   বাংলা: ${a.titleBn}` : ""}`,
          )
          .join("\n")
      : "1. Adoption of agenda items as tabled.";
    return `${header}\n\n${details}\n\nAGENDA\n${agendaLines}${customNote.trim() ? `\n\nSPECIAL INSTRUCTIONS\n${customNote.trim()}` : ""}`;
  }, [selectedMeeting, selectedCompany, language, customNote]);

  function toggleChannel(value: NoticeDispatchRecord["channel"]) {
    setChannels((prev) => (prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]));
  }

  function handleDispatch(e: FormEvent) {
    e.preventDefault();
    if (!selectedMeeting) return;
    if (!channels.length) {
      toast.error("Select at least one dispatch channel");
      return;
    }
    startTransition(async () => {
      const res = await dispatchNoticeAction({
        meetingId: selectedMeeting.id,
        channels,
        language,
        noticeText: generatedPreview,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Statutory notice published & dispatched across ${res.count} channel(s)`);
      setCustomNote("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-5 xl:grid-cols-5">
        {/* Composer & Statutory Check */}
        <form onSubmit={handleDispatch} className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-card xl:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Megaphone className="h-4 w-4 text-brand" />
              Draft & dispatch statutory notice
            </h2>
            {selectedMeeting && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                  selectedMeeting.noticePublished
                    ? "border-success/30 bg-success-soft text-success"
                    : "border-warning/30 bg-warning-soft text-warning",
                )}
              >
                {selectedMeeting.noticePublished ? "Published" : "Pending publication"}
              </span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Target AGM / EGM" htmlFor="notice-meeting">
              <NativeSelect
                id="notice-meeting"
                value={selectedMeetingId}
                onChange={(e) => setSelectedMeetingId(e.target.value)}
              >
                {meetings.map((m) => (
                  <option key={m.id} value={m.id}>
                    {companyMap[m.companyId]?.shortName} — {m.title} ({formatDate(m.date)})
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Notice language format" htmlFor="notice-lang">
              <NativeSelect
                id="notice-lang"
                value={language}
                onChange={(e) => setLanguage(e.target.value as NoticeDispatchRecord["language"])}
              >
                <option value="bilingual">Bilingual (English + Bangla)</option>
                <option value="en">English only</option>
                <option value="bn">Bangla only</option>
              </NativeSelect>
            </Field>
          </div>

          {selectedMeeting && (
            <div
              className={cn(
                "flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-xs",
                daysUntilMeeting >= requiredDays
                  ? "border-success/30 bg-success-soft/60 text-success"
                  : "border-warning/30 bg-warning-soft/60 text-warning",
              )}
            >
              {daysUntilMeeting >= requiredDays ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <div>
                <p className="font-semibold">
                  {daysUntilMeeting >= requiredDays
                    ? `${requiredDays}-day statutory notice requirement satisfied (${daysUntilMeeting} days notice)`
                    : `Short notice warning: ${daysUntilMeeting} day(s) before meeting (configured rule requires ${requiredDays} days)`}
                </p>
                <p className="mt-0.5 text-[11px] opacity-90">
                  Eligible shareholders: {formatNumber(selectedMeeting.eligibleShareholders)} · Companies Act 1994 / BSEC notice rule
                </p>
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-medium">Dispatch channels</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {CHANNEL_OPTIONS.map(({ value, label, icon: Icon }) => {
                const active = channels.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={!canSend}
                    onClick={() => toggleChannel(value)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-xs transition-all",
                      active
                        ? "border-brand bg-brand-soft/60 font-semibold text-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", active ? "text-brand" : "text-muted-foreground")} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <Field label="Additional proxy / venue note (appended to notice)" htmlFor="notice-extra">
            <Textarea
              id="notice-extra"
              rows={2}
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              disabled={!canSend}
              placeholder="e.g. Form of Proxy must reach the registered office at least 48 hours before the meeting."
            />
          </Field>

          {canSend ? (
            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-muted-foreground">
                Publishes notice document, opens portal visibility, and logs channel receipts.
              </p>
              <Button type="submit" disabled={pending || !selectedMeeting}>
                <Send className="mr-1.5 h-4 w-4" />
                {selectedMeeting?.noticePublished ? "Dispatch update" : "Publish & dispatch notice"}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Read-only view — requires notices.send permission to dispatch.</p>
          )}
        </form>

        {/* Live Bilingual Preview */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-card xl:col-span-2">
          <h2 className="text-sm font-semibold">Statutory notice preview</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">Exact text written to meeting documents & shareholder portal</p>
          <pre className="mt-3 max-h-[26rem] overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3.5 font-sans text-xs leading-relaxed text-foreground">
            {generatedPreview || "Select a meeting to preview its statutory notice."}
          </pre>
        </section>
      </div>

      {/* Dispatch Log */}
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold">Statutory dispatch ledger</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <th scope="col" className="px-4 py-2.5">Reference</th>
                <th scope="col" className="px-4 py-2.5">Company & Meeting</th>
                <th scope="col" className="px-4 py-2.5">Channel / Language</th>
                <th scope="col" className="px-4 py-2.5 text-right">Recipients</th>
                <th scope="col" className="px-4 py-2.5">Dispatched</th>
                <th scope="col" className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dispatches.map((d) => {
                const mtg = meetings.find((m) => m.id === d.meetingId);
                return (
                  <tr key={d.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-[11px]">{d.reference}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{mtg?.title ?? d.meetingId}</p>
                      <p className="text-[11px] text-muted-foreground">{companyMap[d.companyId]?.shortName}</p>
                    </td>
                    <td className="px-4 py-2.5 capitalize">{d.channel} · {d.language}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(d.recipientCount)}</td>
                    <td className="px-4 py-2.5 text-[11px] text-muted-foreground">
                      {formatDateTime(d.dispatchedAt)} · {d.dispatchedBy}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex rounded-full border border-success/30 bg-success-soft px-2 py-0.5 text-[10.5px] font-semibold capitalize text-success">
                        {d.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {dispatches.length === 0 && (
            <p className="p-8 text-center text-xs text-muted-foreground">No notice dispatches recorded yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
