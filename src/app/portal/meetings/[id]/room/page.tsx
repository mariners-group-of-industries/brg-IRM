import { notFound, redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-session";
import { getMeeting, getLiveState, isRegistered, myVotes, approvedQuestions, isPublishedMeeting, participantRights, myPollDemands } from "@/lib/demo-store";
import { RoomClient } from "./room-client";

export const metadata = { title: "Meeting room" };

export default async function PortalRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");

  const { id } = await params;
  const meeting = getMeeting(id);
  if (!meeting || meeting.companyId !== session.companyId || !isPublishedMeeting(meeting)) notFound();
  const rights = participantRights(meeting.id, session.participantId);
  if (!rights) notFound();

  const registered = isRegistered(meeting.id, session.participantId);
  if (!registered) redirect(`/portal/meetings/${meeting.id}`);
  const live = getLiveState(meeting.id);
  const initialQuestions = approvedQuestions(meeting.id);
  const initialMyVotes = myVotes(meeting.id, session.participantId);

  return (
    <RoomClient
      meeting={{
        id: meeting.id,
        companyId: meeting.companyId,
        type: meeting.type,
        title: meeting.title,
        financialYear: meeting.financialYear,
        date: meeting.date,
        mode: meeting.mode,
        venue: meeting.venue,
        status: meeting.status,
        votingMethod: meeting.votingMethod,
        pollDemandRule: meeting.pollDemandRule,
        votingOpen: meeting.votingOpen ?? false,
        pollDemandOpen: meeting.pollDemandOpen ?? false,
        eligibleShareholders: meeting.eligibleShareholders,
        registered: meeting.registered,
        streamingProvider: meeting.streamingProvider ?? "zoom",
        streamUrl: meeting.streamUrl ?? "",
        zoomMeetingId: meeting.zoomMeetingId ?? "",
        zoomPasscode: meeting.zoomPasscode ?? "",
        hostName: meeting.hostName ?? "",
        agenda: meeting.agenda,
      }}
      participant={{
        participantId: session.participantId,
        kind: session.kind,
        name: session.name,
        subjectName: session.subjectName,
        boId: `…${session.boId.slice(-4)}`,
        eligibleShares: rights.shares,
        votingRights: rights.votingRights,
      }}
      initialLive={{ ...live, myVotes: initialMyVotes, myDemands: myPollDemands(meeting.id,session.participantId), questions: initialQuestions }}
      registeredInitially={registered}
    />
  );
}

