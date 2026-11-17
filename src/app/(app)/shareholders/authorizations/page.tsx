import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/require-permission";
import { visibleCompanies } from "@/lib/registry-access";
import { registry } from "@/lib/shareholder-store";
import { hasPermission } from "@/lib/permissions";
import { getMeeting } from "@/lib/demo-store";
import { PageHeader } from "@/components/page-header";
import { AuthorizationDecision } from "@/components/registry/authorization-controls";
import { RegistryNav, RegistryNotice, RegistryStatus, NativeSelect, panelClass } from "@/components/registry/shared";
export const metadata = { title: "Proxies & representatives" };
export default async function AuthorizationsPage({ searchParams }: { searchParams: Promise<{ status?: string; company?: string }> }) {
  const session = await requirePermission("shareholders.view"); const companies = visibleCompanies(session);
  const filter = await searchParams;
  if (filter.company && !companies.some((c) => c.id === filter.company)) notFound();
  const authorizations = registry.authorizations.filter((a) => companies.some((c) => c.id === a.companyId) && (!filter.status || a.status === filter.status) && (!filter.company || a.companyId === filter.company));
  return <><PageHeader title="Proxies & representatives" description="Review meeting-specific signed instruments and track their approval or revocation." /><RegistryNav shareholding={hasPermission(session.role, "shareholding.view")} /><RegistryNotice />
    <form className="mb-4 flex flex-wrap items-end gap-2"><div><label htmlFor="auth-filter-company" className="text-xs">Company</label><NativeSelect id="auth-filter-company" name="company" defaultValue={filter.company ?? ""}><option value="">All authorized companies</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></div><div><label htmlFor="auth-filter-status" className="text-xs">Status</label><NativeSelect id="auth-filter-status" name="status" defaultValue={filter.status ?? ""}><option value="">All statuses</option>{["pending", "approved", "rejected", "revoked"].map((s) => <option key={s}>{s}</option>)}</NativeSelect></div><button className="h-9 rounded-md bg-primary px-3 text-xs text-primary-foreground" type="submit">Apply filters</button></form>
    <div className="grid gap-4 lg:grid-cols-2">{authorizations.map((a) => <article key={a.id} className={panelClass}><div className="flex justify-between gap-3"><div><h2 className="text-sm font-semibold">{a.name}</h2><p className="mt-1 text-xs capitalize text-muted-foreground">{a.kind === "corporate" ? "Corporate representative" : "Proxy"}</p></div><RegistryStatus status={a.status} /></div><p className="mt-3 text-xs">Holder: <Link className="text-brand hover:underline" href={`/shareholders/${a.holderId}`}>{registry.holders.find((h) => h.id === a.holderId)?.name}</Link></p><p className="mt-1 text-xs text-muted-foreground">{getMeeting(a.meetingId)?.title} · {companies.find((c) => c.id === a.companyId)?.shortName}</p><p className="mt-2 font-mono text-xs">Instrument: {a.reference}</p>{a.reason && <p className="mt-2 text-xs text-muted-foreground">Review: {a.reason}</p>}{hasPermission(session.role, "shareholders.authorizations.manage") && <AuthorizationDecision id={a.id} status={a.status} />}</article>)}</div>
    {!authorizations.length && <div className={`${panelClass} py-12 text-center`}><h2 className="text-sm font-medium">No authorizations match</h2><p className="mt-2 text-xs text-muted-foreground">Record an appointment from a shareholder profile to start the review workflow.</p></div>}
  </>;
}
