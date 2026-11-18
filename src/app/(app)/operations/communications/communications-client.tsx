"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Globe, Mail, ScrollText, Send, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect } from "@/components/registry/shared";
import { sendBroadcastAction } from "./actions";
import type { CommunicationBroadcast, Company, Meeting } from "@/lib/types";
import { formatDateTime, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const CATEGORIES: { value: CommunicationBroadcast["category"]; label: string }[] = [
  { value: "reminder", label: "AGM / Registration Reminder" },
  { value: "notice", label: "Statutory Notice" },
  { value: "dividend", label: "Dividend Payment Advice" },
  { value: "results", label: "Voting Outcomes" },
  { value: "general", label: "General Shareholder Update" },
];

export function CommunicationsClient({
  broadcasts,
  companies,
  meetings,
  canSend,
}: {
  broadcasts: CommunicationBroadcast[];
  companies: Company[];
  meetings: Meeting[];
  canSend: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [meetingId, setMeetingId] = useState("");
  const [category, setCategory] = useState<CommunicationBroadcast["category"]>("reminder");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [channels, setChannels] = useState<CommunicationBroadcast["channels"]>(["portal", "email"]);

  const companyMap = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c])), [companies]);
  const companyMeetings = useMemo(
    () => meetings.filter((m) => m.companyId === companyId),
    [meetings, companyId],
  );

  function toggleChannel(ch: "portal" | "email" | "sms") {
    setChannels((prev) => (prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!channels.length) {
      toast.error("Select at least one channel");
      return;
    }
    startTransition(async () => {
      const res = await sendBroadcastAction({
        companyId,
        meetingId: meetingId || undefined,
        category,
        subject,
        body,
        channels,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Dispatched to ${formatNumber(res.recipients)} shareholder contact(s)`);
      setSubject("");
      setBody("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {canSend && (
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ScrollText className="h-4 w-4 text-brand" />
              Compose shareholder communication
            </h2>
            <span className="text-[11px] text-muted-foreground">
              Portal channel immediately pushes in-app notifications to active shareholder accounts
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Company" htmlFor="comm-company">
              <NativeSelect
                id="comm-company"
                value={companyId}
                onChange={(e) => {
                  setCompanyId(e.target.value);
                  setMeetingId("");
                }}
              >
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Linked meeting (optional)" htmlFor="comm-meeting">
              <NativeSelect id="comm-meeting" value={meetingId} onChange={(e) => setMeetingId(e.target.value)}>
                <option value="">All active holders (general)</option>
                {companyMeetings.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Category" htmlFor="comm-cat">
              <NativeSelect id="comm-cat" value={category} onChange={(e) => setCategory(e.target.value as CommunicationBroadcast["category"])}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </NativeSelect>
            </Field>
          </div>

          <Field label="Subject line" htmlFor="comm-subject">
            <Input
              id="comm-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              placeholder="e.g. Reminder: Registration closes 48 hours before 23rd AGM"
            />
          </Field>

          <Field label="Message content" htmlFor="comm-body">
            <Textarea
              id="comm-body"
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              placeholder="Write clear instructions for shareholders…"
            />
          </Field>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: "portal", label: "Shareholder Portal", icon: Globe },
                  { id: "email", label: "Email", icon: Mail },
                  { id: "sms", label: "SMS", icon: Smartphone },
                ] as const
              ).map(({ id, label, icon: Icon }) => {
                const active = channels.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleChannel(id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-all",
                      active
                        ? "border-brand bg-brand-soft/60 font-semibold text-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className={cn("h-3.5 w-3.5", active ? "text-brand" : "text-muted-foreground")} />
                    {label}
                  </button>
                );
              })}
            </div>
            <Button type="submit" disabled={pending}>
              <Send className="mr-1.5 h-4 w-4" />
              Send communication
            </Button>
          </div>
        </form>
      )}

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold">Dispatch history</h2>
        </div>
        <div className="divide-y divide-border">
          {broadcasts.map((b) => (
            <article key={b.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-muted px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {b.category}
                  </span>
                  <span className="text-xs font-semibold text-brand">{companyMap[b.companyId]?.shortName}</span>
                  <span className="text-[11px] text-muted-foreground">· {formatDateTime(b.sentAt)}</span>
                </div>
                <p className="mt-1.5 text-[13.5px] font-semibold text-foreground">{b.subject}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{b.body}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Channels: <span className="font-medium capitalize text-foreground">{b.channels.join(", ")}</span> · Sent by {b.sentBy}
                </p>
              </div>
              <div className="shrink-0 text-left sm:text-right">
                <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success-soft px-2.5 py-0.5 text-[10.5px] font-semibold capitalize text-success">
                  <CheckCircle2 className="h-3 w-3" /> {b.status}
                </span>
                <p className="mt-1 text-xs font-semibold tabular-nums">{formatNumber(b.recipientCount)} recipients</p>
              </div>
            </article>
          ))}
          {broadcasts.length === 0 && (
            <p className="p-8 text-center text-xs text-muted-foreground">No communications sent yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
