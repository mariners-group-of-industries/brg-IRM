"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/require-permission";
import { ROLES, type RoleName } from "@/lib/permissions";
import { createStaffUser, listStaffUsers, updateStaffUser } from "@/lib/demo-users";
import { auditRegistry, registry } from "@/lib/shareholder-store";

const createUserSchema = z.object({
  name: z.string().trim().min(2, "Enter full name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
  role: z.enum(ROLES as unknown as [RoleName, ...RoleName[]]),
  companyIds: z.array(z.string().min(1)).min(1, "Assign at least one company"),
});

export async function createStaffUserAction(input: unknown) {
  const session = await requirePermission("users.manage");
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid user details" };
  }
  const data = parsed.data;
  if (session.role !== "Platform Super Admin") {
    if (data.role === "Platform Super Admin") {
      return { ok: false as const, error: "Only Platform Super Admin can create another Super Admin" };
    }
    if (data.companyIds.some((id) => !session.companyIds.includes(id))) {
      notFound();
    }
  }

  try {
    const user = createStaffUser(data);
    auditRegistry(registry, session.email, "user.create", `user:${user.id}`, data.companyIds[0]);
    revalidatePath("/system/users");
    revalidatePath("/reports/audit");
    return { ok: true as const, id: user.id };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Could not create user" };
  }
}

export async function updateStaffUserAction(
  id: string,
  patch: {
    role?: RoleName;
    status?: "active" | "invited" | "suspended";
    companyIds?: string[];
  },
) {
  const session = await requirePermission("users.manage");
  const target = listStaffUsers().find((u) => u.id === id);
  if (!target) notFound();
  if (session.role !== "Platform Super Admin") {
    const inScope = target.companyIds.some((cid) => session.companyIds.includes(cid));
    if (!inScope || patch.role === "Platform Super Admin") notFound();
  }
  if (id === session.id && patch.status === "suspended") {
    return { ok: false as const, error: "You cannot suspend your own signed-in account" };
  }
  try {
    updateStaffUser(id, patch);
    auditRegistry(registry, session.email, "user.update", `user:${id}`, target.companyIds[0]);
    revalidatePath("/system/users");
    revalidatePath("/reports/audit");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Could not update user" };
  }
}
