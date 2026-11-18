"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/require-permission";
import { saveInvestor, updateInvestorKyc } from "@/lib/demo-store";
import { demoStore } from "@/lib/demo-store";

const investorSchema = z.object({
  companyId: z.string().min(1, "Select a company"),
  kind: z.enum(["individual", "corporate", "foreign"]),
  name: z.string().trim().min(2, "Enter investor name").max(160),
  tin: z.string().trim().max(64).optional().default(""),
  email: z.string().trim().email("Enter a valid email").or(z.literal("")).optional().default(""),
  phone: z.string().trim().max(32).optional().default(""),
  country: z.string().trim().min(2, "Enter country").max(80),
  kycStatus: z.enum(["verified", "pending", "expired", "rejected"]),
  relationshipManager: z.string().trim().max(100).optional().default(""),
  communicationPreference: z.enum(["email", "sms", "both"]),
  linkedBoIds: z.string().optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
});

export async function saveInvestorAction(input: unknown, id?: string) {
  const session = await requirePermission("shareholders.manage");
  const parsed = investorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid investor data" };
  }
  const data = parsed.data;
  if (session.role !== "Platform Super Admin" && !session.companyIds.includes(data.companyId)) {
    notFound();
  }
  if (id) {
    const existing = demoStore.investors.find((i) => i.id === id);
    if (!existing) notFound();
    if (session.role !== "Platform Super Admin" && !session.companyIds.includes(existing.companyId)) {
      notFound();
    }
  }
  const boList = data.linkedBoIds
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    const record = saveInvestor(
      {
        companyId: data.companyId,
        kind: data.kind,
        name: data.name,
        tin: data.tin,
        email: data.email,
        phone: data.phone,
        country: data.country,
        kycStatus: data.kycStatus,
        relationshipManager: data.relationshipManager || session.name,
        communicationPreference: data.communicationPreference,
        linkedBoIds: boList,
        notes: data.notes,
      },
      session.email,
      id,
    );
    revalidatePath("/investors");
    revalidatePath("/reports/audit");
    revalidatePath("/activity");
    return { ok: true as const, id: record.id };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Could not save investor" };
  }
}

export async function updateInvestorKycAction(
  id: string,
  kycStatus: "verified" | "pending" | "expired" | "rejected",
) {
  const session = await requirePermission("shareholders.manage");
  const existing = demoStore.investors.find((i) => i.id === id);
  if (!existing) notFound();
  if (session.role !== "Platform Super Admin" && !session.companyIds.includes(existing.companyId)) {
    notFound();
  }
  const updated = updateInvestorKyc(id, kycStatus, session.email);
  if (!updated) return { ok: false as const, error: "Investor not found" };
  revalidatePath("/investors");
  revalidatePath("/reports/audit");
  revalidatePath("/activity");
  return { ok: true as const };
}
