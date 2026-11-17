import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { RoleName } from "./permissions";

/**
 * Session handling — HMAC-signed JWT in an httpOnly cookie.
 *
 * Phase 3 wires real credential storage and MFA; for now the demo users are
 * seeded in demo-auth.ts and the cookie carries the same shape production
 * sessions will use. IRM_SESSION_SECRET must be set in every real
 * environment; the fallback exists only so `pnpm dev` works out of the box.
 */
export const SESSION_COOKIE = "irm_session";
const secretValue =
  process.env.IRM_SESSION_SECRET ?? "irm-dev-only-secret-change-me";
const secret = new TextEncoder().encode(secretValue);

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: RoleName;
  companyIds: string[];
}

export async function createSessionCookie(user: SessionUser) {
  const token = await new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
    companyIds: user.companyIds,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setAudience("irm-staff")
    .setIssuer("irm")
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret);

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { audience: "irm-staff", issuer: "irm" });
    return {
      id: String(payload.sub),
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      role: payload.role as SessionUser["role"],
      companyIds: (payload.companyIds as string[]) ?? [],
    };
  } catch {
    return null;
  }
}
