"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { cookies } from "next/headers";
import { createSessionCookie, clearSessionCookie } from "./session";
import { listStaffUsers } from "./demo-users";

/**
 * Demo authentication (development mode).
 *
 * NOT production authentication: seeded users, SHA-256 password hashes, no
 * rate limiting, no lockout, no MFA. Phase 3 replaces this module with real
 * credential storage, MFA enrollment and session revocation. Responses are
 * identical whether or not the account exists.
 */

const sha256 = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export interface LoginResult {
  ok: boolean;
  error?: string;
}

export async function loginAction(input: {
  email: string;
  password: string;
}): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const user = listStaffUsers().find((u) => u.email === parsed.data.email);
  const candidate = sha256(parsed.data.password);
  const matches =
    user &&
    user.status !== "suspended" &&
    candidate.length === user.passwordSha256.length &&
    timingSafeEqual(Buffer.from(candidate), Buffer.from(user.passwordSha256));

  if (!matches || !user) {
    return { ok: false, error: "Invalid email or password" };
  }

  await createSessionCookie({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyIds: user.companyIds,
  });
  return { ok: true };
}

export async function logoutAction() {
  await clearSessionCookie();
}

export async function getActiveCompanyId(): Promise<string | null> {
  const store = await cookies();
  return store.get("irm_company")?.value ?? null;
}

export async function setActiveCompany(companyId: string) {
  const store = await cookies();
  store.set("irm_company", companyId, {
    httpOnly: false, // read by the client switcher; not a secret
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
