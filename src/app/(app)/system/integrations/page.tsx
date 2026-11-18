import { requirePermission } from "@/lib/require-permission";
import { listIntegrations } from "@/lib/demo-store";
import { PageHeader } from "@/components/page-header";
import { IntegrationsClient } from "./integrations-client";

export const metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  await requirePermission("integrations.manage");
  const adapters = listIntegrations();

  return (
    <>
      <PageHeader
        title="Integrations"
        description="Configure and test CDBL beneficial-owner sync, SMS OTP gateway, email relay, live video bridge and RJSC filing adapters."
      />
      <IntegrationsClient adapters={adapters} />
    </>
  );
}
