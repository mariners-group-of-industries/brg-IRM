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
  },
  {
    id: "usr_secretary",
    email: "secretary@demo.local",
    name: "Nusrat Jahan",
    role: "Company Secretary",
    companyIds: ["co_meghna"],
    passwordSha256: DEMO_PASSWORD_SHA256,
  },
  {
    id: "usr_viewer",
    email: "viewer@demo.local",
    name: "Imran Kabir",
    role: "Restricted Viewer",
    companyIds: ["co_delta"],
    passwordSha256: DEMO_PASSWORD_SHA256,
  },
];
