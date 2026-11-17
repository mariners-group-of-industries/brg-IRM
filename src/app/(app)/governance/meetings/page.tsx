import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { requirePermission } from "@/lib/require-permission";
import { listCompanies, listMeetings } from "@/lib/demo-store";
import { PageHeader } from "@/components/page-header";
import { MeetingsTable } from "@/components/meetings-table";
import { Button } from "@/components/ui/button";

export const metadata = { title: "AGM / EGM" };

export default async function MeetingsPage() {
  const session = await requirePermission("meetings.view");
  const companies = listCompanies();
  const visibleIds = new Set(
    session?.role === "Platform Super Admin"
      ? companies.map((c) => c.id)
      : session?.companyIds ?? [],
  );
  const meetings = listMeetings().filter((m) => visibleIds.has(m.companyId));
  const companyNames = Object.fromEntries(
    companies.map((c) => [c.id, c.shortName]),
  );

  return (
    <>
      <PageHeader
        title="AGM / EGM"
        description="Annual and extraordinary general meetings across your companies — creation, eligibility, registration, notices, voting and results."
      >
        <Button render={<Link href="/governance/meetings/new" />} className="h-9">
          <CalendarPlus className="h-4 w-4" aria-hidden />
          Create AGM / EGM
        </Button>
      </PageHeader>
      <MeetingsTable meetings={meetings} companies={companyNames} />
    </>
  );
}
