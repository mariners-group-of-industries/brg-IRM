import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_MEETINGS } from "./demo-data";
import { canParticipate, castVote, demoStore, demandPoll, getParticipantById, isRegistered, participantRights, recordAttendance, registerParticipant, submitTextQuestion, setMeetingLifecycle, setAgendaStage } from "./demo-store";
import { recordHolding, registry, seedRegistry } from "./shareholder-store";
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-17T06:00:00Z"));
  Object.assign(registry, seedRegistry()); demoStore.meetings = structuredClone(DEMO_MEETINGS); demoStore.activity = [];
  demoStore.portal = { registrations: [], attendance: [], votes: [], demands: [], proposals: [], seconds: [], questions: [], audio: new Map() };
});
afterEach(() => vi.useRealTimers());
describe("shareholder portal eligibility", () => {
  it("rejects cross-company access and unpublished meetings", () => {
    expect(participantRights("mtg_agm_2026", "p_chayan")).toBeNull();
    expect(participantRights("mtg_agm_delta_2026", "p_delta_corp")).toBeNull();
    expect(registerParticipant("mtg_egm_cement", "p_rashedul")).toHaveProperty("error");
  });
  it("requires active register status and approved meeting-specific proxy authority", () => {
    expect(participantRights("mtg_agm_2026", "p_mahirn")).toBeTruthy();
    expect(participantRights("mtg_egm_bonus", "p_mahirn")).toBeNull();
    registry.authorizations[0].status = "revoked"; expect(participantRights("mtg_agm_2026", "p_mahirn")).toBeNull();
    registry.holders[0].status = "suspended"; expect(getParticipantById("p_rashedul")).toBeUndefined();
  });
  it("deduplicates shareholder/proxy registration and attendance by legal account", () => {
    const meeting = demoStore.meetings[0]; const registered = meeting.registered;
    registerParticipant(meeting.id, "p_rashedul"); expect(registerParticipant(meeting.id, "p_mahirn")).toHaveProperty("already", true);
    expect(isRegistered(meeting.id, "p_mahirn")).toBe(true); expect(meeting.registered).toBe(registered + 1);
    setMeetingLifecycle(meeting.id, "start", "chair");
    recordAttendance(meeting.id, "p_rashedul"); recordAttendance(meeting.id, "p_mahirn"); expect(meeting.attended).toBe(1);
  });
  it("requires registration for ballots, polls and questions", () => {
    expect(canParticipate("mtg_agm_2026", "p_rashedul")).toBe(false);
    expect(castVote("mtg_agm_2026", "ag1", "p_rashedul", "for").ok).toBe(false);
    expect(demandPoll("mtg_agm_2026", "ag1", "p_rashedul").ok).toBe(false);
    expect(submitTextQuestion("mtg_agm_2026", "p_rashedul", "Question").ok).toBe(false);
  });
  it("freezes record-date entitlement at registration", () => {
    registerParticipant("mtg_agm_2026", "p_rashedul");
    recordHolding(registry, { companyId: "co_meghna", holderId: "sh_p_rashedul", shareClass: "Ordinary", kind: "allotment", shares: 500, effectiveDate: "2026-11-19", reference: "AFTER-REG" }, "registrar");
    expect(getParticipantById("p_rashedul")?.eligibleShares).toBe(1750); expect(participantRights("mtg_agm_2026", "p_rashedul")?.shares).toBe(1250);
    setMeetingLifecycle("mtg_agm_2026", "start", "chair"); setAgendaStage("mtg_agm_2026", "ag1", "voting", "chair");
    expect(castVote("mtg_agm_2026", "ag1", "p_rashedul", "for")).toHaveProperty("weight", 1250);
  });
  it("prevents shareholder and proxy from voting twice or logging ballot choices", () => {
    registerParticipant("mtg_agm_2026", "p_rashedul"); setMeetingLifecycle("mtg_agm_2026", "start", "chair"); setAgendaStage("mtg_agm_2026", "ag1", "voting", "chair"); expect(castVote("mtg_agm_2026", "ag1", "p_rashedul", "against").ok).toBe(true);
    expect(castVote("mtg_agm_2026", "ag1", "p_mahirn", "for")).toHaveProperty("error", "already_voted");
    expect(JSON.stringify(demoStore.activity)).not.toContain("AGAINST"); expect(JSON.stringify(demoStore.activity)).not.toContain('"choice"');
  });
  it("checks open windows, agenda ids and meeting lifecycle", () => {
    registerParticipant("mtg_agm_2026", "p_rashedul"); setMeetingLifecycle("mtg_agm_2026", "start", "chair"); setAgendaStage("mtg_agm_2026", "ag1", "closed", "chair");
    expect(castVote("mtg_agm_2026", "ag1", "p_rashedul", "for").ok).toBe(false);
    setAgendaStage("mtg_agm_2026", "ag1", "voting", "chair"); expect(castVote("mtg_agm_2026", "fake", "p_rashedul", "for").ok).toBe(false);
    demoStore.meetings[0].status = "completed"; expect(canParticipate("mtg_agm_2026", "p_rashedul")).toBe(false);
  });
  it("enforces configured registration windows", () => {
    demoStore.meetings[0].registrationOpens = "2026-12-01T00:00:00Z";
    expect(registerParticipant("mtg_agm_2026", "p_rashedul")).toHaveProperty("error", "registration_closed");
    demoStore.meetings[0].registrationOpens = "2026-01-01T00:00:00Z";
    demoStore.meetings[0].registrationCloses = "2026-11-01T00:00:00Z";
    expect(registerParticipant("mtg_agm_2026", "p_rashedul")).toHaveProperty("error", "registration_closed");
  });
});
