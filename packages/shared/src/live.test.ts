import { describe, expect, it } from 'vitest';
import { DEFAULT_MEETING_RULES } from './meeting.js';
import { moderationSchema, participantCapabilities, pollThresholdMet } from './live.js';

const rules = { ...DEFAULT_MEETING_RULES, pollDemand: { enabled: true, threshold: 'ANY_MEMBER' as const, thresholdValue: null } };

describe('participant capabilities', () => {
  it('members and corporate representatives have full participation rights', () => {
    for (const kind of ['SHAREHOLDER', 'CORPORATE_REPRESENTATIVE'] as const) {
      expect(participantCapabilities({ kind }, rules)).toEqual({ propose: true, second: true, demandPoll: true, ask: true, vote: true });
    }
  });

  it('proxies cannot speak unless the rules allow it', () => {
    const c = participantCapabilities({ kind: 'PROXY_REPRESENTATIVE', proxyScope: 'ATTEND_AND_VOTE' }, rules);
    expect(c).toEqual({ propose: false, second: false, demandPoll: true, ask: false, vote: true });
    const speaking = participantCapabilities({ kind: 'PROXY_REPRESENTATIVE', proxyScope: 'ATTEND_AND_VOTE' }, { ...rules, proxy: { ...rules.proxy, canSpeak: true } });
    expect(speaking.propose && speaking.ask).toBe(true);
  });

  it('attend-only proxies can neither vote nor demand a poll', () => {
    const c = participantCapabilities({ kind: 'PROXY_REPRESENTATIVE', proxyScope: 'ATTEND' }, rules);
    expect(c.vote).toBe(false);
    expect(c.demandPoll).toBe(false);
  });

  it('nobody can demand a poll when poll demand is disabled', () => {
    expect(participantCapabilities({ kind: 'SHAREHOLDER' }, DEFAULT_MEETING_RULES).demandPoll).toBe(false);
  });
});

describe('poll demand threshold', () => {
  const base = DEFAULT_MEETING_RULES.pollDemand;
  it('any member', () => {
    expect(pollThresholdMet({ pollDemand: { ...base, enabled: true, threshold: 'ANY_MEMBER' } }, { count: 1, votes: 1n }, 100n)).toBe(true);
    expect(pollThresholdMet({ pollDemand: { ...base, enabled: true, threshold: 'ANY_MEMBER' } }, { count: 0, votes: 0n }, 100n)).toBe(false);
  });
  it('member count', () => {
    const r = { pollDemand: { ...base, enabled: true, threshold: 'MEMBERS_COUNT' as const, thresholdValue: 5 } };
    expect(pollThresholdMet(r, { count: 4, votes: 1000n }, 1000n)).toBe(false);
    expect(pollThresholdMet(r, { count: 5, votes: 5n }, 1000n)).toBe(true);
  });
  it('voting-rights percentage uses exact integer arithmetic', () => {
    const r = { pollDemand: { ...base, enabled: true, threshold: 'VOTING_RIGHTS_PERCENT' as const, thresholdValue: 10 } };
    expect(pollThresholdMet(r, { count: 1, votes: 39_609n }, 396_100n)).toBe(false);
    expect(pollThresholdMet(r, { count: 1, votes: 39_610n }, 396_100n)).toBe(true);
  });
});

describe('moderation input', () => {
  it('rejecting needs a reason', () => {
    expect(moderationSchema.safeParse({ action: 'REJECT' }).success).toBe(false);
    expect(moderationSchema.safeParse({ action: 'REJECT', note: 'Off topic' }).success).toBe(true);
    expect(moderationSchema.safeParse({ action: 'FORWARD' }).success).toBe(true);
  });
});
