import { requirePermission } from "@/lib/require-permission";
import { hasPermission } from "@/lib/permissions";
import { listCommunications, listCompanies, listMeetings } from "@/lib/demo-store";
import { PageHeader } from "@/components/page-header";
import { CommunicationsClient } from "./communications-client";

export const metadata = { title: "Communications" };

export default async function CommunicationsPage() {
  const session = await requirePermission("communications.view");
  const companies = listCompanies().filter(
    (c) => session.role === "Platform Super Admin" || session.companyIds.includes(c.id),
  );
  const visibleIds = new Set(companies.map((c) => c.id));
  const broadcasts = listCommunications().filter((c) => visibleIds.has(c.companyId));
  const meetings = listMeetings().filter((m) => visibleIds.has(m.companyId));
  const canSend =
    hasPermission(session.role, "notices.send") ||
    hasPermission(session.role, "meetings.control") ||
    hasPermission(session.role, "shareholders.manage");

  return (
    <>
      <PageHeader
        title="Communications"
        description="Compose and dispatch notices, meeting reminders, dividend advices and voting outcome broadcasts."
      />
      <CommunicationsClient
        broadcasts={broadcasts}
        companies={companies}
        meetings={meetings}
        canSend={canSend}
      />
    </>
  );
}
