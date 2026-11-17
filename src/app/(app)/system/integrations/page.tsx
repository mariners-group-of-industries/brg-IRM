import { ComingSoon } from "@/components/coming-soon";
import { requirePermission } from "@/lib/require-permission";
export const metadata = { title: "Integrations" };
export default async function Page() {
  await requirePermission("integrations.manage");
  return (
    <ComingSoon
      title="Integrations"
      phase="Phase 7"
      description="External systems — adapters, never implicit dependencies."
      scope={["CDBL / BO-account sync for beneficial ownership", "Video providers (Zoom, Webex) behind explicit adapters", "SMS and email gateways with delivery webhooks", "E-signature and RJSC filing connectors"]}
    />
  );
}
