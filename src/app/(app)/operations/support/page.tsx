import { ComingSoon } from "@/components/coming-soon";
import { requirePermission } from "@/lib/require-permission";
export const metadata = { title: "Investor Support" };
export default async function Page() {
  await requirePermission("support.view");
  return (
    <ComingSoon
      title="Investor Support"
      phase="Phase 6"
      description="Helpdesk for shareholders — tickets, SLAs and portal deflection."
      scope={["Ticket intake from portal and email with triage", "SLA tracking and escalation matrix", "Knowledge base for common register queries", "Call-note capture linked to shareholder records"]}
    />
  );
}
