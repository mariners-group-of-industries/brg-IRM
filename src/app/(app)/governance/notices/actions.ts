"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/require-permission";
import { dispatchStatutoryNotice, getMeeting } from "@/lib/demo-store";

const dispatchSchema = z.object({
  meetingId: z.string().min(1, "Select a meeting"),
  channels: z
    .array(z.enum(["portal", "email", "sms", "newspaper"]))
    .min(1, "Select at least one dispatch channel"),
  language: z.enum(["en", "bn", "bilingual"]),
  noticeText: z.string().max(15000).optional(),
});

export async function dispatchNoticeAction(input: unknown) {
  const session = await requirePermission("notices.send");
  const parsed = dispatchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid notice dispatch request" };
  }
  const data = parsed.data;
  const meeting = getMeeting(data.meetingId);
  if (!meeting) notFound();
  if (session.role !== "Platform Super Admin" && !session.companyIds.includes(meeting.companyId)) {
    notFound();
  }

  try {
    const records = dispatchStatutoryNotice(data, session.email);
    revalidatePath("/governance/notices");
    revalidatePath(`/governance/meetings/${meeting.id}`);
    revalidatePath("/governance/meetings");
    revalidatePath("/governance/documents");
    revalidatePath("/portal", "layout");
    revalidatePath("/reports/audit");
    revalidatePath("/activity");
    return { ok: true as const, count: records.length };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Could not dispatch notice" };
  }
}
