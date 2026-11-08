import { describe, it, expect } from 'vitest';
import { generateMinutesDraft, updateMinutesSchema, finalizeMinutesSchema } from './minutes-types.js';

describe('Phase F: Minutes logic & draft generation', () => {
  it('validates minutes update and finalize inputs', () => {
    expect(() => updateMinutesSchema.parse({ content: 'Too short' })).toThrow();
    expect(updateMinutesSchema.parse({ content: 'A valid detailed minutes draft content' })).toBeTruthy();

    expect(() => finalizeMinutesSchema.parse({ signedBy: ' ' })).toThrow();
    expect(finalizeMinutesSchema.parse({ signedBy: 'Mahmudul Hasan (Chairman)' })).toEqual({
      signedBy: 'Mahmudul Hasan (Chairman)',
    });
  });

  it('generates a complete standard minutes draft from meeting data', () => {
    const draft = generateMinutesDraft({
      companyName: 'Mariners Ventures PLC',
      meetingTitle: '36th Annual General Meeting',
      meetingType: 'AGM',
      scheduledStart: '2026-12-29T11:00:00+06:00',
      mode: 'HYBRID',
      venue: 'Grand Ball Room, Dhaka',
      chairmanName: 'Mahmudul Hasan',
      boardMembers: ['Mahmudul Hasan (Chairman)', 'Farhana Rahman (Director)'],
      attendeeCount: 142,
      representedVotes: '1,450,000',
      resolutions: [
        {
          number: '1',
          title: 'Adoption of audited financial statements for FY 2025-26',
          resolutionKind: 'ORDINARY',
          resolutionText: 'RESOLVED that audited financials be approved.',
          proposerName: 'Abdul Karim',
          seconderName: 'Shahidul Alam',
          forVotes: '1,400,000',
          againstVotes: '50,000',
          abstainVotes: '0',
          outcome: 'PASSED',
          majorityPct: '96.55',
        },
      ],
    });

    expect(draft).toContain('MINUTES OF THE 36TH ANNUAL GENERAL MEETING');
    expect(draft).toContain('Mariners Ventures PLC');
    expect(draft).toContain('HYBRID (Grand Ball Room, Dhaka)');
    expect(draft).toContain('142');
    expect(draft).toContain('1,450,000 shares/votes');
    expect(draft).toContain('Item 1: Adoption of audited financial statements for FY 2025-26');
    expect(draft).toContain('**Proposed by:** Abdul Karim');
    expect(draft).toContain('**Seconded by:** Shahidul Alam');
    expect(draft).toContain('PASSED');
    expect(draft).toContain('Mahmudul Hasan, Chairman');
  });
});
