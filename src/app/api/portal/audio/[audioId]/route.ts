import { NextResponse } from "next/server";
import { getPortalSession } from "@/lib/portal-session";
import { getSession as getStaffSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { findQuestionByAudio, getAudio, getMeeting, canParticipate } from "@/lib/demo-store";

/**
 * Serve audio to its author, registered attendees after moderator approval,
 * or staff holding meetings.control for the meeting's company.
 * Everyone else gets 404 — audio must not leak meeting-floor content.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ audioId: string }> },
) {
  const { audioId } = await params;
  const question = findQuestionByAudio(audioId);
  if (!question) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const meeting = getMeeting(question.meetingId);
  const portal = await getPortalSession();

  const portalAllowed = portal && meeting?.companyId === portal.companyId &&
    (portal.participantId === question.participantId || (question.status === "approved" && canParticipate(meeting.id, portal.participantId)));
  const staff = await getStaffSession();
  const staffAllowed =
    staff &&
    hasPermission(staff.role, "meetings.control") &&
    (staff.role === "Platform Super Admin" ||
      (meeting ? staff.companyIds.includes(meeting.companyId) : false));

  if (!portalAllowed && !staffAllowed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const blob = getAudio(audioId);
  if (!blob) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new Response(new Uint8Array(blob.buffer), {
    headers: {
      "Content-Type": blob.mimeType,
      "Content-Length": String(blob.buffer.length),
      "Content-Disposition": `inline; filename="question-${audioId}.bin"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
