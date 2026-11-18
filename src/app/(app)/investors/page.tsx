import { requirePermission } from "@/lib/require-permission";
import { hasPermission } from "@/lib/permissions";
import { listCompanies, listInvestors } from "@/lib/demo-store";
import { PageHeader } from "@/components/page-header";
import { InvestorsClient } from "./investors-client";

export const metadata = { title: "Investors" };

export default async function InvestorsPage() {
  const session = await requirePermission("investors.view");
  const allCompanies = listCompanies();
  const visibleCompanies = allCompanies.filter(
    (c) => session.role === "Platform Super Admin" || session.companyIds.includes(c.id),
  );
  const visibleIds = new Set(visibleCompanies.map((c) => c.id));
  const investors = listInvestors().filter((i) => visibleIds.has(i.companyId));
  const canManage = hasPermission(session.role, "shareholders.manage");

  return (
    <>
      <PageHeader
        title="Investors"
        description="Golden-record CRM profiles, KYC verification and communication preferences — deliberately separated from legal BO accounts."
      />
      <InvestorsClient
        investors={investors}
        companies={visibleCompanies}
        canManage={canManage}
      />
    </>
  );
}
