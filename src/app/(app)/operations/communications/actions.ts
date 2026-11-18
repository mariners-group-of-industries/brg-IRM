"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/require-permission";
import { hasPermission } from "@/lib/permissions";
import { getMeeting, sendCommunicationBroadcast } from "@/lib/demo-store";

const broadcastSchema = z.object({
  companyId: z.string().min(1, "Select a company"),
  meetingId: z.string().optional(),
  category: z.enum(["notice", "reminder", "dividend", "results", "general"]),
  subject: z.string().trim().min(4, "Enter a subject of at least 4 characters").max(200),
  body: z.string().trim().min(10, "Enter a message of at least 10 characters").max(2000),
  channels: z
    .array(z.enum(["portal", "email", "sms"]))
    .min(1, "Choose at least one delivery channel"),
});

export async function sendBroadcastAction(input: unknown) {
  const session = await requirePermission("communications.view");
  const canSend =
    hasPermission(session.role, "notices.send") ||
    hasPermission(session.role, "meetings.control") ||
    hasPermission(session.role, "shareholders.manage");
  if (!canSend) notFound();

  const parsed = broadcastSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid broadcast payload" };
  }
  const data = parsed.data;
  if (session.role !== "Platform Super Admin" && !session.companyIds.includes(data.companyId)) {
    notFound();
  }
  if (data.meetingId) {
    const mtg = getMeeting(data.meetingId);
    if (!mtg || mtg.companyId !== data.companyId) notFound();
  }

  try {
    const broadcast = sendCommunicationBroadcast(data, session.email);
    revalidatePath("/operations/communications");
    revalidatePath("/portal", "layout");
    revalidatePath("/reports/audit");
    revalidatePath("/activity");
    return { ok: true as const, id: broadcast.id, recipients: broadcast.recipientCount };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Could not send broadcast" };
  }
}
