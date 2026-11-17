import "server-only";
import { notFound } from "next/navigation";
import { requirePermission } from "./require-permission";
import { listCompanies } from "./demo-store";
import { registry } from "./shareholder-store";
import type { Permission } from "./permissions";
import type { SessionUser } from "./session";

export function visibleCompanies(session: SessionUser) {
  return listCompanies().filter((c) => session.role === "Platform Super Admin" || session.companyIds.includes(c.id));
}
export async function requireRegistryCompany(companyId: string, permission: Permission) {
  const session = await requirePermission(permission);
  const company = visibleCompanies(session).find((c) => c.id === companyId);
  if (!company) notFound();
  return { session, company };
}
export async function requireHolder(id: string, permission: Permission = "shareholders.view") {
  const session = await requirePermission(permission);
  const holder = registry.holders.find((h) => h.id === id && visibleCompanies(session).some((c) => c.id === h.companyId));
  if (!holder) notFound();
  return { session, holder };
}
