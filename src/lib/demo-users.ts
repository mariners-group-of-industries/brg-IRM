/**
 * Seeded demo accounts (development mode only).
 *
 * Imported by demo-auth.ts — never import this from client components:
 * it contains password hashes. Emails are listed on the login screen.
 */
import { createHash } from "node:crypto";
import type { RoleName } from "./permissions";

export interface DemoUser {
  id: string;
  email: string;
  name: string;
  role: RoleName;
  companyIds: string[];
  passwordSha256: string;
  status?: "active" | "invited" | "suspended";
  createdAt?: string;
}

const sha256 = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

// Password for every seeded account: Demo@1234
export const DEMO_PASSWORD = "Demo@1234";
export const DEMO_PASSWORD_SHA256 = sha256(DEMO_PASSWORD);

export const DEMO_USERS: DemoUser[] = [
  {
    id: "usr_admin",
    email: "admin@demo.local",
    name: "Aditi Rahman",
    role: "Platform Super Admin",
    companyIds: ["co_meghna", "co_delta", "co_karnaphuli", "co_padma"],
    passwordSha256: DEMO_PASSWORD_SHA256,
    status: "active",
    createdAt: "2026-01-10T00:00:00.000Z",
  },
  {
    id: "usr_secretary",
    email: "secretary@demo.local",
    name: "Nusrat Jahan",
    role: "Company Secretary",
    companyIds: ["co_meghna"],
    passwordSha256: DEMO_PASSWORD_SHA256,
    status: "active",
    createdAt: "2026-01-12T00:00:00.000Z",
  },
  {
    id: "usr_viewer",
    email: "viewer@demo.local",
    name: "Imran Kabir",
    role: "Restricted Viewer",
    companyIds: ["co_delta"],
    passwordSha256: DEMO_PASSWORD_SHA256,
    status: "active",
    createdAt: "2026-01-15T00:00:00.000Z",
  },
];

const globalUsers = globalThis as unknown as { __irmUsers?: DemoUser[] };

function userStore(): DemoUser[] {
  return (globalUsers.__irmUsers ??= structuredClone(DEMO_USERS));
}

export function listStaffUsers(): DemoUser[] {
  return userStore().map((u) => ({
    ...u,
    status: u.status ?? "active",
    createdAt: u.createdAt ?? "2026-01-15T00:00:00.000Z",
  }));
}

export function createStaffUser(input: {
  name: string;
  email: string;
  password: string;
  role: RoleName;
  companyIds: string[];
}): DemoUser {
  const users = userStore();
  const normalizedEmail = input.email.trim().toLowerCase();
  if (users.some((u) => u.email === normalizedEmail)) {
    throw new Error("A staff user with this email already exists");
  }
  const user: DemoUser = {
    id: `usr_${crypto.randomUUID().slice(0, 8)}`,
    email: normalizedEmail,
    name: input.name.trim(),
    role: input.role,
    companyIds: [...new Set(input.companyIds)],
    passwordSha256: sha256(input.password),
    status: "active",
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  return user;
}

export function updateStaffUser(
  id: string,
  patch: {
    role?: RoleName;
    companyIds?: string[];
    status?: "active" | "invited" | "suspended";
    password?: string;
  },
): DemoUser {
  const users = userStore();
  const user = users.find((u) => u.id === id);
  if (!user) {
    throw new Error("Staff user not found");
  }
  if (patch.role) user.role = patch.role;
  if (patch.companyIds) user.companyIds = [...new Set(patch.companyIds)];
  if (patch.status) user.status = patch.status;
  if (patch.password) user.passwordSha256 = sha256(patch.password);
  return user;
}

export function grantCompanyToAdmins(companyId: string) {
  const users = userStore();
  for (const user of users) {
    if (user.role === "Platform Super Admin" && !user.companyIds.includes(companyId)) {
      user.companyIds.push(companyId);
    }
  }
}
