"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/require-permission";
import { decideApproval, listApprovals } from "@/lib/demo-store";

const decideSchema = z.object({
  id: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(300).optional(),
});

export async function decideApprovalAction(
  id: string,
  decision: "approved" | "rejected",
  note?: string,
) {
  const session = await requirePermission("approvals.act");
  const parsed = decideSchema.safeParse({ id, decision, note });
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid approval decision" };
  }
  const target = listApprovals().find((a) => a.id === parsed.data.id);
  if (!target) notFound();
  if (session.role !== "Platform Super Admin" && !session.companyIds.includes(target.companyId)) {
    notFound();
  }
  if (target.status && target.status !== "pending") {
    return { ok: false as const, error: "This item has already been decided" };
  }

  const updated = decideApproval(
    parsed.data.id,
    parsed.data.decision,
    session.email,
    parsed.data.note,
  );
  if (!updated) notFound();

  revalidatePath("/operations/approvals");
  revalidatePath("/dashboard");
  revalidatePath("/reports/audit");
  revalidatePath("/activity");
  return { ok: true as const };
}
