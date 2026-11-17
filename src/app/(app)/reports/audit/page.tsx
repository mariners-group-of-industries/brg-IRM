import { ShieldCheck } from "lucide-react";
import { requirePermission } from "@/lib/require-permission";
import { listAudit } from "@/lib/demo-store";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Audit Logs" };

/**
 * Append-only audit trail. In the production build every entry here is
 * written inside the same transaction as the change it records, and a
 * database trigger blocks UPDATE/DELETE.
 */
export default async function AuditPage() {
  const session = await requirePermission("audit.view");
  const entries = listAudit().filter((entry) => session.role === "Platform Super Admin" || (!!entry.companyId && session.companyIds.includes(entry.companyId)));

  return (
    <>
      <PageHeader
        title="Audit Logs"
        description="Privileged actions including register changes, imports and personal-data access. Demo entries reset on restart; durable retention arrives with database wiring."
      />
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2 text-[11px] font-medium text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-brand" aria-hidden />
          Append-only in-memory demo · database enforcement is planned
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-[12px]">
            <thead>
              <tr className="text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
                <th scope="col" className="px-4 py-2 font-semibold">Time (BST)</th>
                <th scope="col" className="px-4 py-2 font-semibold">Actor</th>
                <th scope="col" className="px-4 py-2 font-semibold">Action</th>
                <th scope="col" className="px-4 py-2 font-semibold">Entity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono text-[11.5px]">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{formatDateTime(entry.at)}</td>
                  <td className="px-4 py-2.5">{entry.actor}</td>
                  <td className="px-4 py-2.5 text-brand-navy">{entry.action}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{entry.entity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
