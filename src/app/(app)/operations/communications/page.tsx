import { ComingSoon } from "@/components/coming-soon";
import { requirePermission } from "@/lib/require-permission";
export const metadata = { title: "Communications" };
export default async function Page() {
  await requirePermission("communications.view");
  return (
    <ComingSoon
      title="Communications"
      phase="Phase 6"
      description="Notices, dividends, results and reminders — logged end to end."
      scope={["Template-driven SMS and email with per-meeting merge fields", "Delivery tracking and per-shareholder communication log", "Dividend payment advises and failed-dispatch handling", "Opt-out and consent management"]}
    />
  );
}
