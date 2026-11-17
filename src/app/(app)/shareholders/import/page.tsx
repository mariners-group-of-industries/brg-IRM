import { requirePermission } from "@/lib/require-permission";
import { visibleCompanies } from "@/lib/registry-access";
import { PageHeader } from "@/components/page-header";
import { ImportRegister } from "@/components/registry/import-register";
import { RegistryNav, RegistryNotice } from "@/components/registry/shared";
export const metadata = { title: "Import shareholder register" };
export default async function ImportPage() {
  const session = await requirePermission("shareholders.import");
  return <><PageHeader title="Import shareholder register" description="Validate and review every row before adding it to the legal register." /><RegistryNav /><RegistryNotice /><ImportRegister companies={visibleCompanies(session)} /></>;
}
