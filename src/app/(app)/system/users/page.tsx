import { requirePermission } from "@/lib/require-permission";
import { hasPermission } from "@/lib/permissions";
import { listCompanies } from "@/lib/demo-store";
import { listStaffUsers } from "@/lib/demo-users";
import { PageHeader } from "@/components/page-header";
import { UsersClient, type PublicStaffUser } from "./users-client";

export const metadata = { title: "Users & Roles" };

export default async function UsersPage() {
  const session = await requirePermission("users.view");
  const isSuperAdmin = session.role === "Platform Super Admin";
  const companies = listCompanies().filter(
    (c) => isSuperAdmin || session.companyIds.includes(c.id),
  );
  const visibleIds = new Set(companies.map((c) => c.id));

  const users: PublicStaffUser[] = listStaffUsers()
    .filter(
      (u) => isSuperAdmin || u.companyIds.some((cid) => visibleIds.has(cid)),
    )
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      companyIds: u.companyIds,
      status: u.status ?? "active",
      createdAt: u.createdAt ?? "2026-01-15T00:00:00.000Z",
    }));

  return (
    <>
      <PageHeader
        title="Users & Roles"
        description="Manage staff accounts, company scoping, role assignments and review the RBAC permission catalogue."
      />
      <UsersClient
        users={users}
        companies={companies}
        canManage={hasPermission(session.role, "users.manage")}
        isSuperAdmin={isSuperAdmin}
        currentUserId={session.id}
      />
    </>
  );
}
