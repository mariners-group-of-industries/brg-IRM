"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Save, Scale, ShieldCheck, Stamp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, NativeSelect } from "@/components/registry/shared";
import { saveSettingsAction } from "./actions";
import type { Company, CompanySettings } from "@/lib/types";
import { formatDateTime } from "@/lib/format";

export function SettingsClient({
  companies,
  initialSettings,
}: {
  companies: Company[];
  initialSettings: Record<string, CompanySettings>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");

  const active = initialSettings[companyId];

  const [quorumPercent, setQuorumPercent] = useState(String(active?.quorumPercent ?? 25));
  const [quorumMinMembers, setQuorumMinMembers] = useState(String(active?.quorumMinMembers ?? 5));
  const [pollDemandThresholdPercent, setPollDemandThresholdPercent] = useState(String(active?.pollDemandThresholdPercent ?? 10));
  const [defaultProxyLimit, setDefaultProxyLimit] = useState(String(active?.defaultProxyLimit ?? 1));
  const [proxyDeadlineHoursBefore, setProxyDeadlineHoursBefore] = useState(String(active?.proxyDeadlineHoursBefore ?? 48));
  const [noticeDaysRequired, setNoticeDaysRequired] = useState(String(active?.noticeDaysRequired ?? 21));
  const [signatoryName, setSignatoryName] = useState(active?.signatoryName ?? "");
  const [signatoryTitle, setSignatoryTitle] = useState(active?.signatoryTitle ?? "");
  const [sealReference, setSealReference] = useState(active?.sealReference ?? "");
  const [applyToUpcoming, setApplyToUpcoming] = useState(true);

  function selectCompany(nextId: string) {
    setCompanyId(nextId);
    const s = initialSettings[nextId];
    if (!s) return;
    setQuorumPercent(String(s.quorumPercent));
    setQuorumMinMembers(String(s.quorumMinMembers));
    setPollDemandThresholdPercent(String(s.pollDemandThresholdPercent));
    setDefaultProxyLimit(String(s.defaultProxyLimit));
    setProxyDeadlineHoursBefore(String(s.proxyDeadlineHoursBefore));
    setNoticeDaysRequired(String(s.noticeDaysRequired));
    setSignatoryName(s.signatoryName);
    setSignatoryTitle(s.signatoryTitle);
    setSealReference(s.sealReference);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveSettingsAction({
        companyId,
        quorumPercent,
        quorumMinMembers,
        pollDemandThresholdPercent,
        defaultProxyLimit,
        proxyDeadlineHoursBefore,
        noticeDaysRequired,
        signatoryName,
        signatoryTitle,
        sealReference,
        applyToUpcomingMeetings: applyToUpcoming,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Legal rules and signatory settings saved");
      router.refresh();
    });
  }

  if (!companies.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-xs text-muted-foreground">
        No companies assigned to this account.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-4xl space-y-5">
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-[260px] flex-1">
            <Field label="Select company entity to configure" htmlFor="set-company">
              <NativeSelect
                id="set-company"
                value={companyId}
                onChange={(e) => selectCompany(e.target.value)}
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          {active && (
            <p className="text-[11px] text-muted-foreground">
              Last saved: {formatDateTime(active.updatedAt)}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-card">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Scale className="h-4 w-4 text-brand" />
            Quorum & poll demand rules
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Configured per company Articles of Association — never hard-coded.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Quorum threshold (% voting rights)" htmlFor="set-quorum-pct">
              <Input id="set-quorum-pct" type="number" min={1} max={100} value={quorumPercent} onChange={(e) => setQuorumPercent(e.target.value)} required />
            </Field>
            <Field label="Minimum members in person/online" htmlFor="set-quorum-mem">
              <Input id="set-quorum-mem" type="number" min={1} max={100} value={quorumMinMembers} onChange={(e) => setQuorumMinMembers(e.target.value)} required />
            </Field>
            <Field label="Poll demand rule (% voting rights)" htmlFor="set-poll-pct">
              <Input id="set-poll-pct" type="number" min={1} max={100} value={pollDemandThresholdPercent} onChange={(e) => setPollDemandThresholdPercent(e.target.value)} required />
            </Field>
            <Field label="Statutory notice days required" htmlFor="set-notice-days">
              <Input id="set-notice-days" type="number" min={1} max={60} value={noticeDaysRequired} onChange={(e) => setNoticeDaysRequired(e.target.value)} required />
            </Field>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-card">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-brand" />
            Proxy & delegation limits
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Applied automatically during proxy approval and portal verification.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Max proxies per shareholder" htmlFor="set-proxy-limit">
              <Input id="set-proxy-limit" type="number" min={0} max={20} value={defaultProxyLimit} onChange={(e) => setDefaultProxyLimit(e.target.value)} required />
            </Field>
            <Field label="Proxy cutoff (hours before meeting)" htmlFor="set-proxy-hrs">
              <Input id="set-proxy-hrs" type="number" min={0} max={168} value={proxyDeadlineHoursBefore} onChange={(e) => setProxyDeadlineHoursBefore(e.target.value)} required />
            </Field>
          </div>
          <label className="flex items-center gap-2 pt-2 text-xs text-foreground">
            <Checkbox checked={applyToUpcoming} onCheckedChange={(v) => setApplyToUpcoming(Boolean(v))} />
            <span>Sync updated proxy limit & poll demand rule to upcoming scheduled meetings</span>
          </label>
        </section>
      </div>

      <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-card">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Stamp className="h-4 w-4 text-brand" />
          Authorised signatory & statutory seal
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Authorised signatory name" htmlFor="set-sig-name">
            <Input id="set-sig-name" value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} required />
          </Field>
          <Field label="Signatory designation" htmlFor="set-sig-title">
            <Input id="set-sig-title" value={signatoryTitle} onChange={(e) => setSignatoryTitle(e.target.value)} required />
          </Field>
          <Field label="Common seal reference" htmlFor="set-seal">
            <Input id="set-seal" value={sealReference} onChange={(e) => setSealReference(e.target.value)} required className="font-mono text-xs" />
          </Field>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={pending}>
            <Save className="mr-1.5 h-4 w-4" />
            Save legal & workspace settings
          </Button>
        </div>
      </section>
    </form>
  );
}
