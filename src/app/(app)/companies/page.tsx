import Link from "next/link";
import { ArrowRight, Building2, Check, Plus } from "lucide-react";
import { requirePermission } from "@/lib/require-permission";
import { listCompanies } from "@/lib/demo-store";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Companies" };

export default async function CompaniesPage() {
  const session = await requirePermission("companies.view");
  const companies = listCompanies().filter(
    (company) =>
      session?.role === "Platform Super Admin" || session?.companyIds.includes(company.id),
  );

  return (
    <>
      <PageHeader
        title="Companies"
        description="Legal entities under this workspace. Tenancy is enforced per company — ids of companies you cannot see resolve to 404."
      >
        <Button className="h-9" variant="outline" disabled title="Company onboarding is completed with the registry import in Phase 3">
          <Plus className="h-4 w-4" aria-hidden />
          Add company
        </Button>
      </PageHeader>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-left text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <th scope="col" className="px-4 py-2.5">Company</th>
                <th scope="col" className="px-4 py-2.5">Sector</th>
                <th scope="col" className="px-4 py-2.5">Status</th>
                <th scope="col" className="px-4 py-2.5 text-right">Paid-up capital</th>
                <th scope="col" className="px-4 py-2.5 text-right">Shareholders</th>
                <th scope="col" className="px-4 py-2.5"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {companies.map((company) => (
                <tr key={company.id} className="transition-colors hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link href={`/companies/${company.id}`} className="group flex items-center gap-2.5 outline-none focus-visible:underline">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
                        <Building2 className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                      </span>
                      <span>
                        <span className="block font-medium group-hover:underline">{company.name}</span>
                        <span className="block text-[11px] text-muted-foreground">{company.registrationNo} · TIN {company.tin}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{company.sector}</td>
                  <td className="px-4 py-3">
                    {company.listed ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
                        <Check className="h-3 w-3" aria-hidden /> Listed
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        Private
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">৳{(company.paidUpCapital / 10_000_000).toFixed(1)} cr</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatNumber(company.totalShareholders)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/companies/${company.id}`} aria-label={`Open ${company.shortName}`} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
