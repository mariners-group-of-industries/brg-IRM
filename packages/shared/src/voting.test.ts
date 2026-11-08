import { describe, expect, it } from 'vitest';
import { castVoteSchema, computeTally, openVotingSessionSchema, requestPrivilegedGrantSchema } from './voting.js';

describe('computeTally', () => {
  it('ordinary resolution uses strict > fraction so ties fail', () => {
    const tie = computeTally({
      ballots: [
        { choice: 'FOR', weight: 100n },
        { choice: 'AGAINST', weight: 100n },
      ],
      resolutionKind: 'ORDINARY',
      majority: { numerator: 1, denominator: 2 },
      abstainCountsInBase: false,
      eligibleVotes: 500n,
    });
    expect(tie.baseVotes).toBe(200n);
    expect(tie.passed).toBe(false);

    const win = computeTally({
      ballots: [
        { choice: 'FOR', weight: 101n },
        { choice: 'AGAINST', weight: 100n },
      ],
      resolutionKind: 'ORDINARY',
      majority: { numerator: 1, denominator: 2 },
      abstainCountsInBase: false,
      eligibleVotes: 500n,
    });
    expect(win.passed).toBe(true);
  });

  it('special resolution uses >= fraction so exact threshold passes', () => {
    const exact = computeTally({
      ballots: [
        { choice: 'FOR', weight: 750n },
        { choice: 'AGAINST', weight: 250n },
      ],
      resolutionKind: 'SPECIAL',
      majority: { numerator: 3, denominator: 4 },
      abstainCountsInBase: false,
      eligibleVotes: 1000n,
    });
    expect(exact.passed).toBe(true);

    const short = computeTally({
      ballots: [
        { choice: 'FOR', weight: 749n },
        { choice: 'AGAINST', weight: 251n },
      ],
      resolutionKind: 'SPECIAL',
      majority: { numerator: 3, denominator: 4 },
      abstainCountsInBase: false,
      eligibleVotes: 1000n,
    });
    expect(short.passed).toBe(false);
  });

  it('handles abstainCountsInBase correctly and preserves exact bigint precision above 2^53', () => {
    const big = 10_000_000_000_000_000n;
    const baseExcluded = computeTally({
      ballots: [
        { choice: 'FOR', weight: big + 1n },
        { choice: 'AGAINST', weight: big },
        { choice: 'ABSTAIN', weight: big },
      ],
      resolutionKind: 'ORDINARY',
      majority: { numerator: 1, denominator: 2 },
      abstainCountsInBase: false,
      eligibleVotes: big * 3n + 1n,
    });
    expect(baseExcluded.baseVotes).toBe(big * 2n + 1n);
    expect(baseExcluded.passed).toBe(true);

    const baseIncluded = computeTally({
      ballots: [
        { choice: 'FOR', weight: big + 1n },
        { choice: 'AGAINST', weight: big },
        { choice: 'ABSTAIN', weight: big },
      ],
      resolutionKind: 'ORDINARY',
      majority: { numerator: 1, denominator: 2 },
      abstainCountsInBase: true,
      eligibleVotes: big * 3n + 1n,
    });
    expect(baseIncluded.baseVotes).toBe(big * 3n + 1n);
    expect(baseIncluded.passed).toBe(false);
  });

  it('zero votes in base never passes', () => {
    const empty = computeTally({
      ballots: [{ choice: 'ABSTAIN', weight: 500n }],
      resolutionKind: 'SPECIAL',
      majority: { numerator: 3, denominator: 4 },
      abstainCountsInBase: false,
      eligibleVotes: 500n,
    });
    expect(empty.baseVotes).toBe(0n);
    expect(empty.passed).toBe(false);
  });
});

describe('voting input schemas', () => {
  const uuid1 = '01900000-0000-7000-8000-000000000001';
  const uuid2 = '01900000-0000-7000-8000-000000000002';

  it('accepts single choice or split votes, never both or duplicate entitlements', () => {
    expect(castVoteSchema.safeParse({ votingSessionId: uuid1, choice: 'FOR' }).success).toBe(true);
    expect(
      castVoteSchema.safeParse({
        votingSessionId: uuid1,
        votes: [
          { entitlementId: uuid1, choice: 'FOR' },
          { entitlementId: uuid2, choice: 'AGAINST' },
        ],
      }).success,
    ).toBe(true);
    expect(castVoteSchema.safeParse({ votingSessionId: uuid1 }).success).toBe(false);
    expect(
      castVoteSchema.safeParse({
        votingSessionId: uuid1,
        choice: 'FOR',
        votes: [{ entitlementId: uuid1, choice: 'FOR' }],
      }).success,
    ).toBe(false);
    expect(
      castVoteSchema.safeParse({
        votingSessionId: uuid1,
        votes: [
          { entitlementId: uuid1, choice: 'FOR' },
          { entitlementId: uuid1, choice: 'AGAINST' },
        ],
      }).success,
    ).toBe(false);
  });

  it('validates session open and grant inputs', () => {
    expect(openVotingSessionSchema.safeParse({ agendaItemId: uuid1, durationSeconds: 300 }).success).toBe(true);
    expect(
      openVotingSessionSchema.safeParse({
        agendaItemId: uuid1,
        durationSeconds: 300,
        closesAt: '2026-12-20T10:30:00+06:00',
      }).success,
    ).toBe(false);
    expect(
      requestPrivilegedGrantSchema.safeParse({
        meetingId: uuid1,
        granteeUserId: uuid2,
        durationMinutes: 60,
        reason: 'Scrutineer audit verification of resolution 3',
      }).success,
    ).toBe(true);
    expect(
      requestPrivilegedGrantSchema.safeParse({
        meetingId: uuid1,
        granteeUserId: uuid2,
        durationMinutes: 60,
        reason: 'short',
      }).success,
    ).toBe(false);
  });
});

