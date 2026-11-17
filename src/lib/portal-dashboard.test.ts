import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getPortalDashboard } from "./portal-dashboard";
import { portalMeetingDate, portalMeetingTime } from "./portal-format";
import { DEMO_MEETINGS } from "./demo-data";
import { castVote, demoStore, registerParticipant, submitTextQuestion, setMeetingLifecycle, setAgendaStage } from "./demo-store";
import { recordHolding, registry, seedRegistry } from "./shareholder-store";

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-17T06:00:00Z"));
  Object.assign(registry, seedRegistry());
  demoStore.meetings = structuredClone(DEMO_MEETINGS);
  demoStore.portal = { registrations: [], attendance: [], votes: [], demands: [], proposals: [], seconds: [], questions: [], audio: new Map() };
});
afterEach(() => vi.useRealTimers());

describe("shareholder dashboard", () => {
  it("returns only published meetings for the authenticated participant's company", () => {
    const data = getPortalDashboard("p_rashedul")!;
    expect(data.totalShares).toBe(1250);
    expect(data.upcoming).toHaveLength(2);
    expect(data.meetings.every((m) => m.meeting.companyId === "co_meghna")).toBe(true);
    expect(data.identity.maskedBoId).toBe("••••1234");
    const corporate = getPortalDashboard("p_delta_corp")!;
    expect(corporate.meetings).toEqual([]);
    expect(corporate.featured).toBeNull();
    expect(corporate.timeline).toEqual([]);
    expect(corporate.approvedAppointments).toBe(1);
  });
  it("limits proxy meetings to approved appointments and removes revoked access", () => {
    expect(getPortalDashboard("p_mahirn")?.meetings.map((m) => m.meeting.id)).toEqual(["mtg_agm_2026"]);
    registry.authorizations[0].status = "revoked";
    const data = getPortalDashboard("p_mahirn")!;
    expect(data.meetings).toEqual([]); expect(data.timeline).toEqual([]);
  });
  it("shares account registration/voting progress while keeping each actor's receipts and questions private", () => {
    registerParticipant("mtg_agm_2026", "p_rashedul");
    setMeetingLifecycle("mtg_agm_2026", "start", "chair"); setAgendaStage("mtg_agm_2026", "ag1", "voting", "chair");
    expect(castVote("mtg_agm_2026", "ag1", "p_rashedul", "against").ok).toBe(true);
    submitTextQuestion("mtg_agm_2026", "p_rashedul", "Private shareholder question");
    const owner = getPortalDashboard("p_rashedul")!;
    expect(owner.receiptCount).toBe(1); expect(owner.pendingQuestions).toBe(1);
    const proxy = getPortalDashboard("p_mahirn")!;
    expect(proxy.registrationCount).toBe(1); expect(proxy.featured?.votesCast).toBe(1);
    expect(proxy.receipts).toEqual([]); expect(proxy.questionCount).toBe(0);
    expect(proxy.timeline.some((item) => item.kind === "ballot" || item.kind === "question")).toBe(false);
    expect(JSON.stringify(owner)).not.toContain('"choice"');
    expect(JSON.stringify(owner)).not.toContain("482391");
    expect(JSON.stringify(owner)).not.toContain("12012345678901234");
  });
  it("excludes unrelated submissions even if a forged record claims the same participant id", () => {
    demoStore.portal.questions.push({ id: "cross-tenant", meetingId: "mtg_egm_cement", participantId: "p_rashedul", participantName: "Rashedul", boId: "…1234", kind: "text", body: "Hidden", status: "pending", at: new Date().toISOString() });
    expect(getPortalDashboard("p_rashedul")?.questionCount).toBe(0);
  });
  it("prioritizes an active meeting over a nearer scheduled meeting", () => {
    expect(getPortalDashboard("p_rashedul")?.featured?.meeting.id).toBe("mtg_egm_bonus");
    demoStore.meetings[0].status = "live";
    expect(getPortalDashboard("p_rashedul")?.featured?.meeting.id).toBe("mtg_agm_2026");
  });
  it("enables room entry only after eligible registration and follows configured registration windows", () => {
    let summary = getPortalDashboard("p_rashedul")!.meetings.find((m) => m.meeting.id === "mtg_agm_2026")!;
    expect(summary.availability).toBe("available"); expect(summary.canEnter).toBe(false);
    demoStore.meetings[0].registrationOpens = "2026-12-01T00:00:00Z";
    summary = getPortalDashboard("p_rashedul")!.meetings.find((m) => m.meeting.id === "mtg_agm_2026")!;
    expect(summary.availability).toBe("not_open");
    demoStore.meetings[0].registrationOpens = "2026-11-01T00:00:00Z";
    registerParticipant("mtg_agm_2026", "p_rashedul");
    summary = getPortalDashboard("p_rashedul")!.meetings.find((m) => m.meeting.id === "mtg_agm_2026")!;
    expect(summary.availability).toBe("registered"); expect(summary.canEnter).toBe(true);
  });
  it("calculates current holdings using the Bangladesh date without including future entries", () => {
    recordHolding(registry, { companyId: "co_meghna", holderId: "sh_p_rashedul", shareClass: "Ordinary", kind: "allotment", shares: 50, effectiveDate: "2026-11-17", reference: "DASH-CURRENT" }, "registrar");
    recordHolding(registry, { companyId: "co_meghna", holderId: "sh_p_rashedul", shareClass: "Ordinary", kind: "allotment", shares: 100, effectiveDate: "2026-12-01", reference: "DASH-FUTURE" }, "registrar");
    expect(getPortalDashboard("p_rashedul", new Date("2026-11-16T19:00:00Z"))?.totalShares).toBe(1300);
  });
  it("rejects unknown or inactive legal accounts", () => {
    expect(getPortalDashboard("unknown")).toBeNull();
    registry.holders[0].status = "suspended";
    expect(getPortalDashboard("p_rashedul")).toBeNull();
  });
  it("formats meeting times in their configured timezone", () => {
    expect(portalMeetingTime("2026-12-12T04:00:00Z", "Asia/Dhaka")).toBe("10:00 am");
    expect(portalMeetingDate("2026-11-16T20:00:00Z", "Asia/Dhaka")).toBe("17 Nov 2026");
  });
  it("timestamps reviewed questions from their audit event rather than the original submission", () => {
    registerParticipant("mtg_agm_2026", "p_rashedul");
    setMeetingLifecycle("mtg_agm_2026", "start", "chair");
    submitTextQuestion("mtg_agm_2026", "p_rashedul", "Please clarify the report");
    const question = demoStore.portal.questions[0]; question.status = "approved";
    registry.audit.unshift({ id: "review", actor: "moderator", action: "question.approve", entity: `question:${question.id}`, companyId: "co_meghna", at: "2026-11-17T07:00:00Z" });
    const activity = getPortalDashboard("p_rashedul")!.timeline[0];
    expect(activity.title).toBe("Question approved"); expect(activity.at).toBe("2026-11-17T07:00:00Z");
  });
});
