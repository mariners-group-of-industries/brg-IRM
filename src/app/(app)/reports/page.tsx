import { ComingSoon } from "@/components/coming-soon";
import { requirePermission } from "@/lib/require-permission";
export const metadata = { title: "Reports" };
export default async function Page() {
  await requirePermission("reports.view");
  return (
    <ComingSoon
      title="Reports"
      phase="Phase 6"
      description="Certified, regulator-ready meeting and register reports."
      scope={["Meeting packs: notice, attendance, voting results, certified minutes", "Register of members — PDF and machine-readable export", "Dividend and TDS reports per shareholder", "Regulator (RJSC/BSEC/DSE) filing packs"]}
    />
  );
}
