"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/require-permission";
import { getCompany, saveCompanySettings } from "@/lib/demo-store";

const settingsSchema = z.object({
  companyId: z.string().min(1),
  quorumPercent: z.coerce.number().min(1).max(100),
  quorumMinMembers: z.coerce.number().int().min(1).max(100),
  pollDemandThresholdPercent: z.coerce.number().min(1).max(100),
  defaultProxyLimit: z.coerce.number().int().min(0).max(20),
  proxyDeadlineHoursBefore: z.coerce.number().int().min(0).max(168),
  noticeDaysRequired: z.coerce.number().int().min(1).max(60),
  signatoryName: z.string().trim().min(2, "Enter signatory name").max(120),
  signatoryTitle: z.string().trim().min(2, "Enter signatory title").max(120),
  sealReference: z.string().trim().min(2, "Enter seal reference").max(60),
  applyToUpcomingMeetings: z.boolean().optional().default(false),
});

export async function saveSettingsAction(input: unknown) {
  const session = await requirePermission("settings.manage");
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid settings values" };
  }
  const { companyId, applyToUpcomingMeetings, ...patch } = parsed.data;
  const company = getCompany(companyId);
  if (!company) notFound();
  if (session.role !== "Platform Super Admin" && !session.companyIds.includes(companyId)) {
    notFound();
  }

  const saved = saveCompanySettings(companyId, patch, session.email, applyToUpcomingMeetings);
  revalidatePath("/system/settings");
  revalidatePath("/governance/notices");
  revalidatePath("/governance/meetings", "layout");
  revalidatePath("/reports");
  revalidatePath("/reports/audit");
  revalidatePath("/activity");
  return { ok: true as const, updatedAt: saved.updatedAt };
}
