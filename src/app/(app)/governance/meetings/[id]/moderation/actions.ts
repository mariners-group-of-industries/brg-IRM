"use server";

import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { getMeeting, listQuestions, moderateQuestion } from "@/lib/demo-store";

/** Approve or dismiss a shareholder question. Company-scoped, meetings.control. */
export async function moderateAction(
  meetingId: string,
  questionId: string,
  action: "approve" | "dismiss",
) {
  const session = await requirePermission("meetings.control");
  const meeting = getMeeting(meetingId);
  if (!meeting) notFound();
  if (
    session.role !== "Platform Super Admin" &&
    !session.companyIds.includes(meeting.companyId)
  ) {
    notFound();
  }
  if (!["approve", "dismiss"].includes(action) || !listQuestions(meetingId).some((q) => q.id === questionId)) notFound();
  const done = moderateQuestion(questionId, action, meetingId, session.email);
  if (!done) return { ok: false as const, error: "Could not record the moderation decision" };
  revalidatePath("/portal", "layout");
  return { ok: true as const };
}
