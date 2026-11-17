import { ComingSoon } from "@/components/coming-soon";
import { requirePermission } from "@/lib/require-permission";
export const metadata = { title: "Investors" };
export default async function Page() {
  await requirePermission("investors.view");
  return (
    <ComingSoon
      title="Investors"
      phase="Phase 4"
      description="Golden-record investor management, deliberately separate from legal shareholders."
      scope={["Individual and institutional investor profiles with KYC status", "Investor-to-shareholder linking without conflating the two models", "Interest tracking and communication preferences", "Portfolio view across companies in the workspace"]}
    />
  );
}
