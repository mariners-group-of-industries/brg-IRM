"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock3, LifeBuoy, Plus, RotateCcw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect } from "@/components/registry/shared";
import { createSupportTicketAction, updateSupportTicketAction } from "./actions";
import type { Company, SupportTicket } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const statusStyle: Record<SupportTicket["status"], string> = {
  open: "border-warning/30 bg-warning-soft text-warning",
  in_progress: "border-info/30 bg-info-soft text-info",
  resolved: "border-success/30 bg-success-soft text-success",
};

const priorityStyle: Record<SupportTicket["priority"], string> = {
  high: "bg-danger-soft text-destructive border-destructive/30",
  medium: "bg-warning-soft text-warning border-warning/30",
  low: "bg-muted text-muted-foreground border-border",
};

export function SupportClient({
  tickets,
  companies,
}: {
  tickets: SupportTicket[];
  companies: Company[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");

  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [boId, setBoId] = useState("");
  const [shareholderName, setShareholderName] = useState("");
  const [category, setCategory] = useState<SupportTicket["category"]>("meeting_access");
  const [priority, setPriority] = useState<SupportTicket["priority"]>("medium");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  const companyNames = useMemo(
    () => Object.fromEntries(companies.map((c) => [c.id, c.shortName])),
    [companies],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        t.ticketNo.toLowerCase().includes(q) ||
        t.shareholderName.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.boId.includes(q)
      );
    });
  }, [tickets, statusFilter, search]);

  const counts = useMemo(
    () => ({
      open: tickets.filter((t) => t.status === "open").length,
      inProgress: tickets.filter((t) => t.status === "in_progress").length,
      resolved: tickets.filter((t) => t.status === "resolved").length,
      high: tickets.filter((t) => t.priority === "high" && t.status !== "resolved").length,
    }),
    [tickets],
  );

  function submitTicket(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createSupportTicketAction({
        companyId,
        boId,
        shareholderName,
        category,
        priority,
        subject,
        description,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Ticket ${res.ticketNo} created`);
      setShowForm(false);
      setBoId("");
      setShareholderName("");
      setSubject("");
      setDescription("");
      router.refresh();
    });
  }

  function changeStatus(id: string, next: SupportTicket["status"], note?: string) {
    startTransition(async () => {
      const res = await updateSupportTicketAction(id, next, note);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Ticket marked ${next.replaceAll("_", " ")}`);
      setResolvingId(null);
      setResolutionNote("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Open tickets", value: counts.open },
          { label: "In progress", value: counts.inProgress },
          { label: "Resolved", value: counts.resolved },
          { label: "High priority active", value: counts.high },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{m.label}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ticket #, holder, BO ID…"
              className="h-9 w-64 pl-8 text-xs"
            />
          </div>
          <NativeSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40">
            <option value="">All status</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
          </NativeSelect>
        </div>

        <Button onClick={() => setShowForm((v) => !v)} size="sm" className="h-9 gap-1.5">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Close form" : "Log support ticket"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={submitTicket} className="space-y-4 rounded-xl border border-brand/30 bg-card p-5 shadow-card">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <LifeBuoy className="h-4 w-4 text-brand" />
            New shareholder support case
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Company" htmlFor="tkt-company">
              <NativeSelect id="tkt-company" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Shareholder name" htmlFor="tkt-holder">
              <Input id="tkt-holder" value={shareholderName} onChange={(e) => setShareholderName(e.target.value)} required placeholder="Full name as on register" />
            </Field>
            <Field label="BO / Folio ID (optional)" htmlFor="tkt-bo">
              <Input id="tkt-bo" value={boId} onChange={(e) => setBoId(e.target.value)} placeholder="12012345678901234" className="font-mono text-xs" />
            </Field>
            <Field label="Category" htmlFor="tkt-cat">
              <NativeSelect id="tkt-cat" value={category} onChange={(e) => setCategory(e.target.value as SupportTicket["category"])}>
                <option value="meeting_access">Meeting access & OTP</option>
                <option value="bo_verification">BO verification</option>
                <option value="proxy_instrument">Proxy / corporate auth</option>
                <option value="dividend_claim">Dividend / BEFTN</option>
                <option value="register_update">Register correction</option>
              </NativeSelect>
            </Field>
            <Field label="Priority" htmlFor="tkt-prio">
              <NativeSelect id="tkt-prio" value={priority} onChange={(e) => setPriority(e.target.value as SupportTicket["priority"])}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </NativeSelect>
            </Field>
            <Field label="Subject" htmlFor="tkt-subj">
              <Input id="tkt-subj" value={subject} onChange={(e) => setSubject(e.target.value)} required placeholder="Short summary of query" />
            </Field>
          </div>
          <Field label="Call note / inquiry details" htmlFor="tkt-desc">
            <Textarea id="tkt-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} required placeholder="Details received from email, phone, or shareholder desk…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>Create ticket</Button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {filtered.map((t) => (
          <article key={t.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-brand">{t.ticketNo}</span>
                  <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase", priorityStyle[t.priority])}>
                    {t.priority}
                  </span>
                  <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize", statusStyle[t.status])}>
                    {t.status.replaceAll("_", " ")}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{companyNames[t.companyId]} · {t.category.replaceAll("_", " ")}</span>
                </div>
                <h3 className="mt-1.5 text-sm font-semibold">{t.subject}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.description}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Shareholder: <strong className="text-foreground">{t.shareholderName}</strong>
                  {t.boId ? ` (BO: ${t.boId})` : ""} · Assigned to {t.assignedTo} · Updated {formatDateTime(t.updatedAt)}
                </p>
                {t.resolutionNote && (
                  <p className="mt-2 rounded-md border border-success/20 bg-success-soft/50 px-3 py-1.5 text-xs text-success">
                    Resolution: {t.resolutionNote}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {t.status === "open" && (
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => changeStatus(t.id, "in_progress")}>
                    <Clock3 className="mr-1 h-3.5 w-3.5" /> Start triage
                  </Button>
                )}
                {t.status !== "resolved" && (
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => { setResolvingId(t.id); setResolutionNote(""); }}>
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-success" /> Resolve
                  </Button>
                )}
                {t.status === "resolved" && (
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => changeStatus(t.id, "open")}>
                    <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reopen
                  </Button>
                )}
              </div>
            </div>

            {resolvingId === t.id && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <Input
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Enter resolution summary recorded to audit trail…"
                  className="h-8 flex-1 text-xs"
                />
                <Button size="sm" disabled={pending} onClick={() => changeStatus(t.id, "resolved", resolutionNote)}>Confirm resolve</Button>
                <Button size="sm" variant="ghost" onClick={() => setResolvingId(null)}>Cancel</Button>
              </div>
            )}
          </article>
        ))}
        {filtered.length === 0 && (
          <p className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-xs text-muted-foreground">
            No support tickets match the selected filters.
          </p>
        )}
      </div>
    </div>
  );
}
