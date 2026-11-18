import { requirePermission } from "@/lib/require-permission";
import { listCompanies, listSupportTickets } from "@/lib/demo-store";
import { PageHeader } from "@/components/page-header";
import { SupportClient } from "./support-client";

export const metadata = { title: "Investor Support" };

export default async function SupportPage() {
  const session = await requirePermission("support.view");
  const companies = listCompanies().filter(
    (c) => session.role === "Platform Super Admin" || session.companyIds.includes(c.id),
  );
  const visibleIds = new Set(companies.map((c) => c.id));
  const tickets = listSupportTickets().filter((t) => visibleIds.has(t.companyId));

  return (
    <>
      <PageHeader
        title="Investor Support"
        description="Shareholder helpdesk — triage BO verification, OTP access, proxy queries and dividend routing cases."
      />
      <SupportClient tickets={tickets} companies={companies} />
    </>
  );
}
