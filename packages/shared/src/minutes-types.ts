import { z } from 'zod';

export const MEETING_MINUTES_STATUSES = ['DRAFT', 'FINAL', 'PUBLISHED'] as const;
export type MeetingMinutesStatus = (typeof MEETING_MINUTES_STATUSES)[number];

export const MEETING_MINUTES_STATUS_LABELS: Record<MeetingMinutesStatus, string> = {
  DRAFT: 'Draft',
  FINAL: 'Finalized',
  PUBLISHED: 'Published',
};

export const updateMinutesSchema = z.object({
  content: z.string().min(10, 'Minutes content must contain at least 10 characters'),
});
export type UpdateMinutesInput = z.infer<typeof updateMinutesSchema>;

export const finalizeMinutesSchema = z.object({
  signedBy: z.string().trim().min(3, 'Signee name/designation is required (at least 3 characters)'),
});
export type FinalizeMinutesInput = z.infer<typeof finalizeMinutesSchema>;

export interface MeetingMinutesDto {
  id: string;
  meetingId: string;
  content: string;
  status: MeetingMinutesStatus;
  signedBy: string | null;
  finalizedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MinutesSeedData {
  companyName: string;
  meetingTitle: string;
  meetingType: string;
  scheduledStart: string;
  mode: string;
  venue?: string | null;
  chairmanName?: string;
  boardMembers: string[];
  attendeeCount: number;
  representedVotes: string;
  resolutions: Array<{
    number: string;
    title: string;
    resolutionKind: string;
    resolutionText: string;
    proposerName?: string;
    seconderName?: string;
    forVotes: string;
    againstVotes: string;
    abstainVotes: string;
    outcome: string;
    majorityPct: string;
  }>;
}

/**
 * Builds a formal, standard minutes draft document from authoritative meeting data.
 */
export function generateMinutesDraft(data: MinutesSeedData): string {
  const dateStr = new Date(data.scheduledStart).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = new Date(data.scheduledStart).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Dhaka',
  });

  const lines: string[] = [];

  lines.push(`# MINUTES OF THE ${data.meetingTitle.toUpperCase()}`);
  lines.push(`**Company:** ${data.companyName}`);
  lines.push(`**Date & Time:** ${dateStr} at ${timeStr} (Dhaka Time)`);
  lines.push(`**Meeting Mode:** ${data.mode}${data.venue ? ` (${data.venue})` : ''}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  lines.push('## 1. PRESENT AT THE MEETING');
  if (data.boardMembers.length > 0) {
    lines.push('### Board of Directors & Officers:');
    for (const member of data.boardMembers) {
      lines.push(`- ${member}`);
    }
  } else {
    lines.push('- Members of the Board of Directors and Company Secretary');
  }
  lines.push('');
  lines.push('### Quorum & Shareholder Attendance:');
  lines.push(`- Total registered shareholders and authorized representatives present: **${data.attendeeCount}**`);
  lines.push(`- Aggregate shareholdings represented: **${data.representedVotes} shares/votes**`);
  lines.push('- The Chairman confirmed that the requisite quorum was present as per Articles of Association and Companies Act 1994, and called the meeting to order.');
  lines.push('');

  lines.push('## 2. NOTICE OF THE MEETING');
  lines.push('With the consent of the members present, the Notice convening the meeting, having previously been circulated in accordance with statutory requirements, was taken as read.');
  lines.push('');

  lines.push('## 3. PROCEEDINGS & RESOLUTIONS');
  if (data.resolutions.length === 0) {
    lines.push('No formal agenda resolutions were transacted.');
  } else {
    data.resolutions.forEach((res, idx) => {
      lines.push(`### Item ${res.number}: ${res.title}`);
      lines.push(`*Resolution Type: ${res.resolutionKind} Resolution*`);
      lines.push('');
      lines.push(`> "${res.resolutionText}"`);
      lines.push('');
      if (res.proposerName) {
        lines.push(`- **Proposed by:** ${res.proposerName}`);
      }
      if (res.seconderName) {
        lines.push(`- **Seconded by:** ${res.seconderName}`);
      }
      lines.push('- **Voting Results:**');
      lines.push(`  - For: ${res.forVotes}`);
      lines.push(`  - Against: ${res.againstVotes}`);
      lines.push(`  - Abstain: ${res.abstainVotes}`);
      lines.push(`- **Determination:** The Chairman declared that the resolution was duly **${res.outcome}** (${res.majorityPct}% approval).`);
      lines.push('');
    });
  }

  lines.push('## 4. CONCLUSION');
  lines.push('There being no other business to discuss, the Chairman thanked the shareholders and participants for their continued support and declared the meeting concluded.');
  lines.push('');
  lines.push('---');
  lines.push('**Signed by:**');
  lines.push(data.chairmanName ? `${data.chairmanName}, Chairman` : '_______________________, Chairman of the Meeting');

  return lines.join('\n');
}
