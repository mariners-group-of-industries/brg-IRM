import { describe, expect, it } from "vitest";
import { meetingDraftSchema, type MeetingDraft } from "./validations/meeting";

const validDraft: MeetingDraft = {
  companyId: "co_meghna",
  type: "AGM",
  title: "24th Annual General Meeting",
  financialYear: "FY 2025–26",
  date: "2026-12-12",
  time: "10:30",
  timezone: "Asia/Dhaka",
  mode: "hybrid",
  venue: "AGM Hall, Gulshan Club, Dhaka",
  recordDate: "2026-11-20",
  shareClassId: "Ordinary",
  eligibleShareholders: 12480,
  votingEntitlement: "one_share_one_vote",
  pollDemandRule: "Shares carrying at least 10% of voting rights",
  proxiesAllowed: true,
  corporateRepresentatives: true,
  agenda: [
    { title: "Adoption of audited financial statements", kind: "ordinary", resolution: "" },
  ],
  registrationOpens: "2026-12-01T09:00",
  registrationCloses: "2026-12-12T10:00",
  proxyDeadline: "2026-12-09T17:00",
  proxyLimitPerHolder: 1,
  verificationWorkflow: "scrutineer_certification",
  votingMethod: "hybrid",
  votingStarts: "2026-12-12T10:30",
  votingEnds: "2026-12-12T12:30",
  voteConfirmation: true,
  earlyVoting: false,
  streamingProvider: "irm_live",
  hostName: "Mahi Uddin",
  moderatorCount: 2,
  autoRecord: true,
  noticeLanguage: "both",
  deliveryChannels: ["sms", "email", "website"],
  documentsToAttach: "",
  publishToWebsite: true,
};

describe("meetingDraftSchema", () => {
  it("accepts a valid draft", () => {
    const result = meetingDraftSchema.safeParse(validDraft);
    expect(result.success).toBe(true);
  });

  it("rejects a malformed financial year", () => {
    const result = meetingDraftSchema.safeParse({ ...validDraft, financialYear: "2025-26" });
    expect(result.success).toBe(false);
  });

  it("rejects a record date after the meeting date", () => {
    const result = meetingDraftSchema.safeParse({ ...validDraft, recordDate: "2026-12-20" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("recordDate");
    }
  });

  it("rejects a voting window that ends before it starts", () => {
    const result = meetingDraftSchema.safeParse({ ...validDraft, votingEnds: "2026-12-12T09:00" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty agenda", () => {
    const result = meetingDraftSchema.safeParse({ ...validDraft, agenda: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a proxy limit above 10", () => {
    const result = meetingDraftSchema.safeParse({ ...validDraft, proxyLimitPerHolder: 11 });
    expect(result.success).toBe(false);
  });

  it("rejects when no delivery channel is chosen", () => {
    const result = meetingDraftSchema.safeParse({ ...validDraft, deliveryChannels: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a one-character title", () => {
    const result = meetingDraftSchema.safeParse({ ...validDraft, title: "A" });
    expect(result.success).toBe(false);
  });
});
