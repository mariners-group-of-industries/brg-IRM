import { requirePermission } from "@/lib/require-permission";
import { hasPermission } from "@/lib/permissions";
import {
  getCompanySettings,
  getLiveState,
  listCompanies,
  listMeetings,
} from "@/lib/demo-store";
import { PageHeader } from "@/components/page-header";
import { ReportsClient, type MeetingReportBundle } from "./reports-client";

export const metadata = { title: "Reports" };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ meeting?: string }>;
}) {
  const session = await requirePermission("reports.view");
  const { meeting: initialMeetingId } = await searchParams;
  const companies = listCompanies().filter(
    (c) => session.role === "Platform Super Admin" || session.companyIds.includes(c.id),
  );
  const companyMap = Object.fromEntries(companies.map((c) => [c.id, c]));
  const visibleIds = new Set(companies.map((c) => c.id));
  const meetings = listMeetings().filter((m) => visibleIds.has(m.companyId));

  const bundles: MeetingReportBundle[] = meetings.map((meeting) => {
    const live = getLiveState(meeting.id);
    return {
      meeting,
      company: companyMap[meeting.companyId],
      settings: getCompanySettings(meeting.companyId),
      liveAgenda: live.agenda,
      registeredCount: live.registered,
      attendedCount: live.attended,
    };
  });

  return (
    <>
      <PageHeader
        title="Certified Reports & Scrutiny"
        description="Downloadable meeting scrutiny reports, quorum & attendance registers, statutory minutes and RJSC/BSEC filing packs."
      />
      <ReportsClient
        bundles={bundles}
        canExportRegister={hasPermission(session.role, "shareholders.view")}
        initialMeetingId={initialMeetingId}
      />
    </>
  );
}
