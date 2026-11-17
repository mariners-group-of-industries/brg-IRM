import { ComingSoon } from "@/components/coming-soon";
import { requirePermission } from "@/lib/require-permission";
export const metadata = { title: "Users & Roles" };
export default async function Page() {
  await requirePermission("users.view");
  return (
    <ComingSoon
      title="Users & Roles"
      phase="Phase 3"
      description="People, memberships, roles and company scoping."
      scope={["Invite users, assign companies and roles without sharing credentials", "Twelve-role catalogue with granular, company-scoped permissions", "MFA enrollment and session revocation", "Access review exports for audit"]}
    />
  );
}
