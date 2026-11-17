import { requirePermission } from "@/lib/require-permission";
import { visibleCompanies } from "@/lib/registry-access";
import { registry } from "@/lib/shareholder-store";
import { dateSchema, holdingBalance } from "@/lib/shareholders";
import { PageHeader } from "@/components/page-header";
import { Ledger } from "@/components/registry/ledger";
import { Metrics, NativeSelect, RegistryNav, RegistryNotice } from "@/components/registry/shared";
import Link from "next/link";
import { notFound } from "next/navigation";
export const metadata = { title: "Shareholding" };
export default async function Page({ searchParams }: { searchParams: Promise<{ company?: string; date?: string }> }) {
  const session = await requirePermission("shareholding.view"); const companies = visibleCompanies(session);
  const filter = await searchParams; const asOf = dateSchema.safeParse(filter.date).success ? filter.date! : "9999-12-31";
  if (filter.company && !companies.some((c) => c.id === filter.company)) notFound();
  const holders = registry.holders.filter((h) => companies.some((c) => c.id === h.companyId) && (!filter.company || h.companyId === filter.company));
  const ids = new Set(holders.map((h) => h.id)); const entries = registry.entries.filter((e) => ids.has(e.holderId) && e.effectiveDate <= asOf);
  const total = entries.reduce((sum, e) => sum + e.delta, 0);
  return <><PageHeader title="Shareholding & ledger" description="View balances by company and share class, or inspect the register at an effective date." /><RegistryNav /><RegistryNotice />
    <form className="mb-5 flex flex-wrap items-end gap-3"><div><label htmlFor="holding-company" className="text-xs">Company</label><NativeSelect id="holding-company" name="company" defaultValue={filter.company ?? ""}><option value="">All authorized companies</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></div><div><label htmlFor="as-of" className="block text-xs">As of date (blank = all entries)</label><input id="as-of" name="date" type="date" defaultValue={asOf === "9999-12-31" ? "" : asOf} className="h-9 rounded-md border border-input bg-background px-2 text-xs" /></div><button type="submit" className="h-9 rounded-md bg-primary px-3 text-xs text-primary-foreground">View holdings</button></form>
    {filter.date && !dateSchema.safeParse(filter.date).success && <p role="alert" className="mb-4 text-xs text-destructive">Invalid date. Showing all entries; choose a valid date.</p>}
    <Metrics items={[{ label: "Registered shares", value: total }, { label: "Accounts with holdings", value: holders.filter((h) => holdingBalance(entries, h.id) > 0).length }, { label: "Allotments / opening", value: entries.filter((e) => ["opening", "allotment"].includes(e.kind)).length }, { label: "Transfers", value: entries.filter((e) => e.kind === "transfer_out").length }]} />
    <div className="mb-5 overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full min-w-[600px] text-left text-xs"><thead className="border-b border-border bg-muted/30"><tr>{["Holder / company", "Share class", "Balance", "Sample register %"].map((h) => <th scope="col" key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{holders.flatMap((h) => (companies.find((c) => c.id === h.companyId)?.shareClasses ?? []).map((s) => { const balance = holdingBalance(entries, h.id, s); return <tr key={`${h.id}_${s}`}><td className="px-4 py-3"><Link href={`/shareholders/${h.id}`} className="font-medium text-brand hover:underline">{h.name}</Link><p className="mt-1 text-[10px] text-muted-foreground">{companies.find((c) => c.id === h.companyId)?.shortName}</p></td><td className="px-4 py-3">{s}</td><td className="px-4 py-3 tabular-nums">{balance.toLocaleString("en-BD")}</td><td className="px-4 py-3 tabular-nums">{total ? ((balance / total) * 100).toFixed(2) : "0.00"}%</td></tr>; }))}</tbody></table>{!holders.length && <p className="p-8 text-center text-xs text-muted-foreground">No accounts match this company.</p>}</div>
    <Ledger entries={entries} holders={Object.fromEntries(holders.map((h) => [h.id, h.name]))} />
  </>;
}
