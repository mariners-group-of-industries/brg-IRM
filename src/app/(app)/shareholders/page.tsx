import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Upload } from "lucide-react";
import { requirePermission } from "@/lib/require-permission";
import { hasPermission } from "@/lib/permissions";
import { visibleCompanies } from "@/lib/registry-access";
import { registry } from "@/lib/shareholder-store";
import { holdingBalance, publicHolder } from "@/lib/shareholders";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Metrics, RegistryNav, RegistryNotice } from "@/components/registry/shared";
import { HoldersTable } from "@/components/registry/holders-table";

export const metadata = { title: "Shareholder register" };
export default async function ShareholdersPage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const session = await requirePermission("shareholders.view");
  const companies = visibleCompanies(session); const ids = new Set(companies.map((c) => c.id));
  const holders = registry.holders.filter((h) => ids.has(h.companyId));
  const { company } = await searchParams;
  if (company && !ids.has(company)) notFound();
  return <>
    <PageHeader title="Shareholder register" description="Manage the legal register of members, BO accounts and shareholder records.">
      {hasPermission(session.role, "shareholders.import") && <Button variant="outline" render={<Link href="/shareholders/import" />}><Upload />Import register</Button>}
      {hasPermission(session.role, "shareholders.manage") && <Button render={<Link href="/shareholders/new" />}><Plus />Add shareholder</Button>}
    </PageHeader>
    <RegistryNav shareholding={hasPermission(session.role, "shareholding.view")} /><RegistryNotice />
    <Metrics items={[{ label: "Sample accounts", value: holders.length, hint: `${companies.length} authorized companies` }, { label: "Active holders", value: holders.filter((h) => h.status === "active").length }, { label: "Shares in sample register", value: holders.reduce((s, h) => s + holdingBalance(registry.entries, h.id), 0) }, { label: "Pending authorizations", value: registry.authorizations.filter((a) => ids.has(a.companyId) && a.status === "pending").length }]} />
    <HoldersTable holders={holders.map((h) => ({ ...publicHolder(h), shares: holdingBalance(registry.entries, h.id) }))} companies={companies} initialCompany={company && ids.has(company) ? company : ""} />
  </>;
}
