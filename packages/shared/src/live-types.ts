import type { AgendaItemDto } from './meeting-types.js';
import type { MeetingRules, MeetingState } from './meeting.js';
import type { AgendaStage, MotionKind, ParticipantCapabilities, QuestionStatus } from './live.js';
import type { ParticipantKind } from './shareholder.js';
import type { ShareCount } from './shareholder-types.js';

export interface VideoJoinInfo {
  provider: 'simulator' | 'zoom';
  /** True for the development simulator. The UI must label it clearly. */
  simulated: boolean;
  role: 'host' | 'board' | 'attendee';
  displayName: string;
  /** Zoom only. */
  meetingNumber?: string;
  sdkKey?: string;
  signature?: string;
  joinUrl?: string;
  message?: string;
}

export interface MotionDto {
  id: string;
  kind: MotionKind;
  status: 'SUBMITTED' | 'ACCEPTED' | 'REJECTED';
  /** Shown according to meeting rules: the shareholder's name, never contact details. */
  shareholderName: string;
  actingAs: ParticipantKind;
  createdAt: string;
}

export interface LiveAgendaItem extends AgendaItemDto {
  stages: Record<AgendaStage, boolean>;
  accepted: { PROPOSAL: MotionDto | null; SECONDING: MotionDto | null };
}

export interface PollDemandSummary {
  count: number;
  votes: ShareCount;
  thresholdMet: boolean;
}

export interface AnnouncementDto {
  id: string;
  body: string;
  createdAt: string;
  author: string | null;
}

export interface AttendanceSummary {
  participantsPresent: number;
  votesPresent: ShareCount;
  registered: number;
  totalVotes: ShareCount;
  staffPresent: number;
}

/** The meeting admin's live console. */
export interface LiveConsole {
  meetingId: string;
  videoRoomId: string | null;
  state: MeetingState;
  version: number;
  rules: MeetingRules;
  activeAgendaItemId: string | null;
  agenda: (LiveAgendaItem & { motions: MotionDto[]; pollDemands: PollDemandSummary })[];
  attendance: AttendanceSummary;
  announcements: AnnouncementDto[];
  questions: Record<QuestionStatus, number>;
}

export interface QuestionDto {
  id: string;
  kind: 'TEXT' | 'AUDIO';
  text: string | null;
  durationSeconds: number | null;
  bangla: boolean;
  status: QuestionStatus;
  agendaItem: { id: string; number: string; title: string } | null;
  createdAt: string;
  /** Visible to moderators and board; never to other participants. */
  submitter: { name: string; actingAs: ParticipantKind; shareholderName: string } | null;
  history: { action: string; note: string | null; actor: string | null; at: string }[];
}

export interface RoomRegistration {
  participantId: string;
  kind: ParticipantKind;
  label: string;
  shareholderName: string;
  votes: ShareCount;
  capabilities: ParticipantCapabilities;
}

/** What a registered participant sees in the meeting room. */
export interface MeetingRoom {
  meetingId: string;
  companyName: string;
  title: string;
  type: 'AGM' | 'EGM';
  state: MeetingState;
  scheduledStart: string;
  activeAgendaItemId: string | null;
  agenda: LiveAgendaItem[];
  registrations: RoomRegistration[];
  myMotions: { agendaItemId: string; kind: MotionKind; status: MotionDto['status'] }[];
  myPollDemands: string[];
  myQuestions: QuestionDto[];
  announcements: AnnouncementDto[];
  attendance: { participantsPresent: number };
  audioMaxSeconds: number;
}

export interface BoardRoom {
  meetingId: string;
  state: MeetingState;
  activeAgendaItemId: string | null;
  agenda: LiveAgendaItem[];
  forwardedQuestions: QuestionDto[];
  attendance: AttendanceSummary;
  announcements: AnnouncementDto[];
}
