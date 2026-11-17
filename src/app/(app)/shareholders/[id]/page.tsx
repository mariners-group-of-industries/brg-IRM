import { requireHolder } from "@/lib/registry-access";
import { hasPermission } from "@/lib/permissions";
import { getCompany, listMeetings } from "@/lib/demo-store";
import { registry } from "@/lib/shareholder-store";
import { holdingBalance, publicHolder } from "@/lib/shareholders";
import { PageHeader } from "@/components/page-header";
import { HolderPrivate } from "@/components/registry/holder-private";
import { HoldingForm } from "@/components/registry/holding-form";
import { AuthorizationForm } from "@/components/registry/authorization-controls";
import { Ledger } from "@/components/registry/ledger";
import { Metrics, RegistryNav, RegistryNotice, RegistryStatus, panelClass } from "@/components/registry/shared";
import Link from "next/link";
export const metadata = { title: "Shareholder profile" };
export default async function ShareholderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { holder, session } = await requireHolder(id);
  const company = getCompany(holder.companyId)!; const entries = registry.entries.filter((e) => e.holderId === id);
  const authorizations = registry.authorizations.filter((a) => a.holderId === id);
  return <><PageHeader title={holder.name} description={`${company.name} · ${holder.kind === "corporate" ? "Corporate holder" : "Individual holder"}`}><RegistryStatus status={holder.status} /></PageHeader><RegistryNav shareholding={hasPermission(session.role, "shareholding.view")} /><RegistryNotice />
    <Metrics items={[{ label: "Shares held", value: holdingBalance(entries, id) }, { label: "Share classes", value: new Set(entries.map((e) => e.shareClass)).size }, { label: "Ledger entries", value: entries.length }, { label: "Active appointments", value: authorizations.filter((a) => a.status === "approved").length }]} />
    <div className="space-y-5"><HolderPrivate key={holder.updatedAt} masked={publicHolder(holder)} canReveal={hasPermission(session.role, "shareholders.pii.read")} canEdit={hasPermission(session.role, "shareholders.manage")} companies={[company]} />
      <section className={panelClass}><h2 className="mb-3 text-sm font-semibold">Holdings by class</h2><div className="flex flex-wrap gap-8">{company.shareClasses.map((s) => <div key={s}><p className="text-xs text-muted-foreground">{s}</p><p className="mt-1 text-lg font-semibold tabular-nums">{holdingBalance(entries, id, s).toLocaleString("en-BD")}</p></div>)}</div></section>
      {holder.status === "active" && hasPermission(session.role, "shareholding.manage") && <HoldingForm holderId={id} companyId={company.id} shareClasses={company.shareClasses} recipients={registry.holders.filter((h) => h.companyId === company.id && h.id !== id && h.status === "active").map(({ id, name }) => ({ id, name }))} />}
      <Ledger entries={entries} holders={{ [id]: holder.name }} />
      {holder.status === "active" && hasPermission(session.role, "shareholders.authorizations.manage") && <AuthorizationForm holderId={id} kind={holder.kind} meetings={listMeetings(company.id).filter((m) => !["completed", "archived"].includes(m.status)).map(({ id, title }) => ({ id, title }))} />}
      <section className={panelClass}><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Meeting authorizations</h2><Link href="/shareholders/authorizations" className="text-xs text-brand hover:underline">Review appointments →</Link></div>{!authorizations.length && <p className="mt-3 text-xs text-muted-foreground">No proxy or representative appointments recorded.</p>}<ul className="divide-y divide-border">{authorizations.map((a) => <li key={a.id} className="mt-3 flex items-center justify-between gap-3 pt-3"><div><p className="text-xs font-medium">{a.name} · {a.kind}</p><p className="mt-1 text-xs text-muted-foreground">{listMeetings(company.id).find((m) => m.id === a.meetingId)?.title} · {a.reference}</p></div><RegistryStatus status={a.status} /></li>)}</ul></section>
    </div></>;
}
