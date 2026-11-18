import { requirePermission } from "@/lib/require-permission";
import { getCompanySettings, listCompanies } from "@/lib/demo-store";
import { PageHeader } from "@/components/page-header";
import { SettingsClient } from "./settings-client";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requirePermission("settings.manage");
  const companies = listCompanies().filter(
    (c) => session.role === "Platform Super Admin" || session.companyIds.includes(c.id),
  );
  const initialSettings = Object.fromEntries(
    companies.map((c) => [c.id, getCompanySettings(c.id)]),
  );

  return (
    <>
      <PageHeader
        title="Settings"
        description="Per-entity legal governance rules (quorum, poll demand thresholds, proxy deadlines) and authorised signatories."
      />
      <SettingsClient companies={companies} initialSettings={initialSettings} />
    </>
  );
}
