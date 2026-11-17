import { requirePermission } from "@/lib/require-permission";
import { visibleCompanies } from "@/lib/registry-access";
import { PageHeader } from "@/components/page-header";
import { HolderForm } from "@/components/registry/holder-form";
import { RegistryNav, RegistryNotice, panelClass } from "@/components/registry/shared";
export const metadata = { title: "Add shareholder" };
export default async function NewShareholderPage() {
  const session = await requirePermission("shareholders.manage");
  return <><PageHeader title="Add shareholder" description="Create a legal register entry for an individual or corporate holder." /><RegistryNav /><RegistryNotice /><div className={`${panelClass} max-w-3xl`}><HolderForm companies={visibleCompanies(session)} /></div></>;
}
