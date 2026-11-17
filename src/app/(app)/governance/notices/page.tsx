import { ComingSoon } from "@/components/coming-soon";
import { requirePermission } from "@/lib/require-permission";
export const metadata = { title: "Notices" };
export default async function Page() {
  await requirePermission("notices.view");
  return (
    <ComingSoon
      title="Notices"
      phase="Phase 5"
      description="Statutory notice drafting, 21-day rule enforcement and multi-channel dispatch."
      scope={["Bilingual (Bangla/English) notice templates", "Automatic 21-day compliance check against meeting date", "SMS, email, newspaper and Gazette dispatch tracking", "Delivery receipts and reminder automation"]}
    />
  );
}
