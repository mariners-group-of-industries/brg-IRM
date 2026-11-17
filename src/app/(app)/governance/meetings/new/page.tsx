import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/require-permission";
import { getActiveCompanyId } from "@/lib/demo-auth";
import { listCompanies } from "@/lib/demo-store";
import { CreateWizard } from "./wizard";

export const metadata = { title: "Create AGM / EGM" };

export default async function NewMeetingPage() {
  const session = await requirePermission("meetings.create");
  const companies = listCompanies().filter(
    (company) =>
      session?.role === "Platform Super Admin" || session?.companyIds.includes(company.id),
  );
  const cookieCompany = await getActiveCompanyId();
  const defaultCompanyId =
    companies.find((c) => c.id === cookieCompany)?.id ?? companies[0]?.id ?? "";

  return (
    <>
      <Link
        href="/governance/meetings"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to meetings
      </Link>
      <CreateWizard companies={companies} defaultCompanyId={defaultCompanyId} />
    </>
  );
}
