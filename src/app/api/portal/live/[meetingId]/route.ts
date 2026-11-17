import { NextResponse } from "next/server";
import { getPortalSession } from "@/lib/portal-session";
import { requirePermission } from "@/lib/require-permission";
import {
  approvedQuestions,
  getLiveState,
  getMeeting,
  myVotes,
  canViewRoom,
  myPollDemands,
} from "@/lib/demo-store";

/**
 * Live meeting state — polled by the portal room and the admin control view.
 * Portal callers see the meeting only for their own company; staff callers
 * need meetings.view. Vote tallies are weighted (voting rights), per agenda.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId } = await params;
  const meeting = getMeeting(meetingId);
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const portal = await getPortalSession();
  if (portal) {
    if (portal.companyId !== meeting.companyId || !canViewRoom(meetingId, portal.participantId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const live = getLiveState(meetingId);
    return NextResponse.json({
      ...live,
      turnoutPct: meeting.eligibleShareholders
        ? (meeting.registered / meeting.eligibleShareholders) * 100
        : 0,
      myVotes: myVotes(meetingId, portal.participantId),
      myDemands: myPollDemands(meetingId, portal.participantId),
      questions: approvedQuestions(meetingId),
      viewer: "shareholder",
    });
  }

  const staff = await requirePermission("meetings.view");
  if (
    staff.role !== "Platform Super Admin" &&
    !staff.companyIds.includes(meeting.companyId)
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const live = getLiveState(meetingId);
  return NextResponse.json({
    ...live,
    turnoutPct: meeting.eligibleShareholders
      ? (meeting.registered / meeting.eligibleShareholders) * 100
      : 0,
    myVotes: {},
    questions: approvedQuestions(meetingId),
    viewer: "staff",
  });
}
