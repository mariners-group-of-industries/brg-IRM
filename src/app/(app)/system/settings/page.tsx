import { ComingSoon } from "@/components/coming-soon";
import { requirePermission } from "@/lib/require-permission";
export const metadata = { title: "Settings" };
export default async function Page() {
  await requirePermission("settings.manage");
  return (
    <ComingSoon
      title="Settings"
      phase="Phase 3"
      description="Workspace, company and legal-rule configuration."
      scope={["Company profile, seals and authorised signatories", "Legally configurable quorum, poll-demand and proxy limits — never hard-coded", "Numbering schemes (notices, minutes, certificates)", "Retention and backup policy controls"]}
    />
  );
}
