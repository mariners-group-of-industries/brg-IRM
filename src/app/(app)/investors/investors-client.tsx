"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Globe2, Link2, Plus, Search, ShieldAlert, ShieldCheck, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect } from "@/components/registry/shared";
import { saveInvestorAction, updateInvestorKycAction } from "./actions";
import type { Company, InvestorRecord } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const kycStyle: Record<InvestorRecord["kycStatus"], string> = {
  verified: "border-success/30 bg-success-soft text-success",
  pending: "border-warning/30 bg-warning-soft text-warning",
  expired: "border-border bg-muted text-muted-foreground",
  rejected: "border-destructive/30 bg-danger-soft text-destructive",
};

export function InvestorsClient({
  investors,
  companies,
  canManage,
}: {
  investors: InvestorRecord[];
  companies: Company[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [kycFilter, setKycFilter] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [kind, setKind] = useState<InvestorRecord["kind"]>("individual");
  const [name, setName] = useState("");
  const [tin, setTin] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("Bangladesh");
  const [kycStatus, setKycStatus] = useState<InvestorRecord["kycStatus"]>("verified");
  const [communicationPreference, setCommunicationPreference] = useState<InvestorRecord["communicationPreference"]>("email");
  const [linkedBoIds, setLinkedBoIds] = useState("");
  const [notes, setNotes] = useState("");

  const companyNames = useMemo(
    () => Object.fromEntries(companies.map((c) => [c.id, c.shortName])),
    [companies],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return investors.filter((inv) => {
      if (companyFilter && inv.companyId !== companyFilter) return false;
      if (kindFilter && inv.kind !== kindFilter) return false;
      if (kycFilter && inv.kycStatus !== kycFilter) return false;
      if (!q) return true;
      return (
        inv.name.toLowerCase().includes(q) ||
        inv.tin.toLowerCase().includes(q) ||
        inv.email.toLowerCase().includes(q) ||
        inv.linkedBoIds.some((bo) => bo.includes(q))
      );
    });
  }, [investors, search, companyFilter, kindFilter, kycFilter]);

  const metrics = useMemo(() => {
    const verified = investors.filter((i) => i.kycStatus === "verified").length;
    const institutional = investors.filter((i) => i.kind !== "individual").length;
    const linked = investors.reduce((sum, i) => sum + i.linkedBoIds.length, 0);
    return [
      { label: "Total Investors", value: investors.length, hint: "CRM golden profiles" },
      { label: "Verified KYC", value: verified, hint: `${investors.length - verified} pending / review` },
      { label: "Institutional & Foreign", value: institutional, hint: "Corporate & FII accounts" },
      { label: "Linked BO Accounts", value: linked, hint: "Mapped to legal register" },
    ];
  }, [investors]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveInvestorAction({
        companyId,
        kind,
        name,
        tin,
        email,
        phone,
        country,
        kycStatus,
        communicationPreference,
        linkedBoIds,
        notes,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Investor profile saved");
      setShowForm(false);
      setName("");
      setTin("");
      setEmail("");
      setPhone("");
      setLinkedBoIds("");
      setNotes("");
      router.refresh();
    });
  }

  function handleKyc(id: string, next: InvestorRecord["kycStatus"]) {
    startTransition(async () => {
      const res = await updateInvestorKycAction(id, next);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(`KYC status updated to ${next}`);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{m.label}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums">{m.value}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{m.hint}</p>
          </div>
        ))}
      </div>

      {canManage && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, TIN, email or BO ID…"
                className="h-9 w-64 pl-8 text-xs"
              />
            </div>
            <NativeSelect
              aria-label="Filter by company"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="w-44"
            >
              <option value="">All companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.shortName}</option>
              ))}
            </NativeSelect>
            <NativeSelect
              aria-label="Filter by kind"
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value)}
              className="w-36"
            >
              <option value="">All types</option>
              <option value="individual">Individual</option>
              <option value="corporate">Corporate</option>
              <option value="foreign">Foreign (FII)</option>
            </NativeSelect>
            <NativeSelect
              aria-label="Filter by KYC status"
              value={kycFilter}
              onChange={(e) => setKycFilter(e.target.value)}
              className="w-36"
            >
              <option value="">All KYC status</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
              <option value="expired">Expired</option>
              <option value="rejected">Rejected</option>
            </NativeSelect>
          </div>

          <Button onClick={() => setShowForm((v) => !v)} size="sm" className="h-9 gap-1.5">
            {showForm ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {showForm ? "Close form" : "Add investor"}
          </Button>
        </div>
      )}

      {!canManage && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, TIN, email or BO ID…"
              className="h-9 w-64 pl-8 text-xs"
            />
          </div>
          <NativeSelect value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="w-44">
            <option value="">All companies</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.shortName}</option>)}
          </NativeSelect>
        </div>
      )}

      {showForm && canManage && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-brand/30 bg-card p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">New golden-record investor profile</h2>
            <span className="text-[11px] text-muted-foreground">Separate CRM entity — links to one or more legal BO accounts</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Company" htmlFor="inv-company">
              <NativeSelect id="inv-company" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Investor category" htmlFor="inv-kind">
              <NativeSelect id="inv-kind" value={kind} onChange={(e) => setKind(e.target.value as InvestorRecord["kind"])}>
                <option value="individual">Individual</option>
                <option value="corporate">Corporate / Institutional</option>
                <option value="foreign">Foreign Institutional (FII)</option>
              </NativeSelect>
            </Field>
            <Field label="Full / Entity name" htmlFor="inv-name">
              <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Dhaka Equity Partners Ltd" />
            </Field>
            <Field label="TIN / Registration ID" htmlFor="inv-tin">
              <Input id="inv-tin" value={tin} onChange={(e) => setTin(e.target.value)} placeholder="12-digit e-TIN or FII ref" />
            </Field>
            <Field label="Email" htmlFor="inv-email">
              <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="investor@domain.com" />
            </Field>
            <Field label="Phone" htmlFor="inv-phone">
              <Input id="inv-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+88017..." />
            </Field>
            <Field label="Jurisdiction / Country" htmlFor="inv-country">
              <Input id="inv-country" value={country} onChange={(e) => setCountry(e.target.value)} required />
            </Field>
            <Field label="KYC status" htmlFor="inv-kyc">
              <NativeSelect id="inv-kyc" value={kycStatus} onChange={(e) => setKycStatus(e.target.value as InvestorRecord["kycStatus"])}>
                <option value="verified">Verified</option>
                <option value="pending">Pending review</option>
                <option value="expired">Expired</option>
              </NativeSelect>
            </Field>
            <Field label="Communication preference" htmlFor="inv-pref">
              <NativeSelect id="inv-pref" value={communicationPreference} onChange={(e) => setCommunicationPreference(e.target.value as InvestorRecord["communicationPreference"])}>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="both">Email & SMS</option>
              </NativeSelect>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Linked legal BO / Folio IDs (comma-separated)" htmlFor="inv-bos">
              <Input id="inv-bos" value={linkedBoIds} onChange={(e) => setLinkedBoIds(e.target.value)} placeholder="12012345678901234, 12012345678902345" className="font-mono text-xs" />
            </Field>
            <Field label="Relationship notes" htmlFor="inv-notes">
              <Textarea id="inv-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Custodian details, mandate preferences…" />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              <Plus className="mr-1.5 h-4 w-4" /> Save investor profile
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[54rem] text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <th scope="col" className="px-4 py-3">Investor & Contact</th>
                <th scope="col" className="px-4 py-3">Company / Type</th>
                <th scope="col" className="px-4 py-3">Linked BO Accounts</th>
                <th scope="col" className="px-4 py-3">KYC Status</th>
                <th scope="col" className="px-4 py-3">Updated</th>
                {canManage && <th scope="col" className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground">{inv.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {inv.email || "No email"} · {inv.phone || "No phone"}
                    </p>
                    {inv.tin && <p className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">TIN: {inv.tin}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{companyNames[inv.companyId] ?? inv.companyId}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] capitalize text-muted-foreground">
                      <Globe2 className="h-3 w-3" /> {inv.kind} · {inv.country}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {inv.linkedBoIds.length === 0 ? (
                      <span className="text-muted-foreground">None linked</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {inv.linkedBoIds.map((bo) => (
                          <span key={bo} className="inline-flex items-center gap-1 rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[10.5px]">
                            <Link2 className="h-3 w-3 text-brand" /> {bo}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold capitalize", kycStyle[inv.kycStatus])}>
                      {inv.kycStatus === "verified" ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                      {inv.kycStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-muted-foreground">
                    {formatDateTime(inv.updatedAt)}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {inv.kycStatus !== "verified" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() => handleKyc(inv.id, "verified")}
                            className="h-7 px-2 text-[11px] text-success hover:bg-success-soft"
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Verify KYC
                          </Button>
                        )}
                        {inv.kycStatus === "verified" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => handleKyc(inv.id, "pending")}
                            className="h-7 px-2 text-[11px]"
                          >
                            Re-open review
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="p-8 text-center text-xs text-muted-foreground">No investor profiles match the selected filters.</p>
          )}
        </div>
      </div>
    </div>
  );
}
