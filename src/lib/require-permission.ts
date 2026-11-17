import "server-only";
import { notFound } from "next/navigation";
import { getSession, type SessionUser } from "./session";
import { hasPermission, type Permission } from "./permissions";

/**
 * Server-side authorization gate for routes.
 *
 * Returns the session when the caller holds `permission`; otherwise 404s.
 * We deliberately do not 403 — an unauthorized caller must not be able to
 * distinguish "exists but forbidden" from "does not exist". Signed-out users
 * are redirected to /login by the proxy before they reach here.
 */
export async function requirePermission(
  permission: Permission,
): Promise<SessionUser> {
  const session = await getSession();
  if (!session || !hasPermission(session.role, permission)) {
    notFound();
  }
  return session;
}
