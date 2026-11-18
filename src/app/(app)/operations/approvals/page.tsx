import { requirePermission } from "@/lib/require-permission";
import { hasPermission } from "@/lib/permissions";
import { listApprovals, listCompanies } from "@/lib/demo-store";
import { PageHeader } from "@/components/page-header";
import { ApprovalsQueue } from "./approvals-queue";

export const metadata = { title: "Approvals" };

export default async function ApprovalsPage() {
  const session = await requirePermission("approvals.view");
  const companies = new Map(listCompanies().map((c) => [c.id, c.shortName]));
  const canAct = hasPermission(session.role, "approvals.act");
  const visibleIds = new Set(
    session?.role === "Platform Super Admin" ? [...companies.keys()] : session?.companyIds ?? [],
  );
  const approvals = listApprovals().filter((a) => visibleIds.has(a.companyId));

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Notice publications, resolutions, proofs and proxy batches waiting on a decision. Decisions are audit-logged."
      />
      <ApprovalsQueue
        approvals={approvals.map((approval) => ({
          ...approval,
          companyName: companies.get(approval.companyId) ?? approval.companyId,
        }))}
        canAct={canAct}
      />
    </>
  );
}
