"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/require-permission";
import { triggerIntegrationSync, updateIntegration } from "@/lib/demo-store";

const updateSchema = z.object({
  id: z.string().min(1),
  provider: z.string().trim().min(2, "Enter provider name").max(120),
  endpoint: z.string().trim().min(4, "Enter endpoint URL").max(300),
  status: z.enum(["connected", "sandbox", "disconnected"]),
});

export async function updateIntegrationAction(input: unknown) {
  const session = await requirePermission("integrations.manage");
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid adapter config" };
  }
  const updated = updateIntegration(
    parsed.data.id,
    {
      provider: parsed.data.provider,
      endpoint: parsed.data.endpoint,
      status: parsed.data.status,
    },
    session.email,
  );
  if (!updated) notFound();
  revalidatePath("/system/integrations");
  revalidatePath("/reports/audit");
  revalidatePath("/activity");
  return { ok: true as const };
}

export async function syncIntegrationAction(id: string) {
  const session = await requirePermission("integrations.manage");
  const synced = triggerIntegrationSync(id, session.email);
  if (!synced) notFound();
  revalidatePath("/system/integrations");
  revalidatePath("/reports/audit");
  revalidatePath("/activity");
  return { ok: true as const, summary: synced.lastSyncSummary };
}
