import { requirePermission } from "@/lib/require-permission";
import { hasPermission } from "@/lib/permissions";
import {
  getCompanySettings,
  listCompanies,
  listMeetings,
  listNoticeDispatches,
} from "@/lib/demo-store";
import { PageHeader } from "@/components/page-header";
import { NoticesClient } from "./notices-client";

export const metadata = { title: "Notices" };

export default async function NoticesPage({
  searchParams,
}: {
  searchParams: Promise<{ meeting?: string }>;
}) {
  const session = await requirePermission("notices.view");
  const { meeting: initialMeetingId } = await searchParams;
  const companies = listCompanies().filter(
    (c) => session.role === "Platform Super Admin" || session.companyIds.includes(c.id),
  );
  const visibleIds = new Set(companies.map((c) => c.id));
  const meetings = listMeetings().filter((m) => visibleIds.has(m.companyId));
  const dispatches = listNoticeDispatches().filter((d) => visibleIds.has(d.companyId));
  const settingsByCompany = Object.fromEntries(
    companies.map((c) => [c.id, getCompanySettings(c.id)]),
  );

  return (
    <>
      <PageHeader
        title="Notices"
        description="Statutory notice compliance (Companies Act / BSEC), bilingual preview and multi-channel dispatch ledger."
      />
      <NoticesClient
        meetings={meetings}
        companies={companies}
        settingsByCompany={settingsByCompany}
        dispatches={dispatches}
        canSend={hasPermission(session.role, "notices.send")}
        initialMeetingId={initialMeetingId}
      />
    </>
  );
}
