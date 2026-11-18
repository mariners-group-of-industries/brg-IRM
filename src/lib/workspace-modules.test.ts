import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { DEMO_APPROVALS, DEMO_COMPANIES, DEMO_MEETINGS } from "./demo-data";
import {
  createCompany,
  createSupportTicket,
  decideApproval,
  demoStore,
  dispatchStatutoryNotice,
  findParticipant,
  getCompanySettings,
  participantRights,
  saveCompanySettings,
  saveInvestor,
  sendCommunicationBroadcast,
  triggerIntegrationSync,
  updateInvestorKyc,
  updateSupportTicket,
} from "./demo-store";
import { createStaffUser, listStaffUsers, updateStaffUser } from "./demo-users";
import { recordHolding, registry, saveHolder, seedRegistry } from "./shareholder-store";

beforeEach(() => {
  Object.assign(registry, seedRegistry());
  demoStore.companies = structuredClone(DEMO_COMPANIES);
  demoStore.meetings = structuredClone(DEMO_MEETINGS);
  demoStore.approvals = DEMO_APPROVALS.map((a) => ({ ...a, status: "pending" as const }));
  demoStore.portalNotifications = [];
});

describe("dynamic portal login and register workflows", () => {
  it("allows newly registered and approved proxy holders to authenticate on the portal", () => {
    const holder = saveHolder(
      registry,
      {
        companyId: "co_meghna",
        name: "Karim Uddin",
        kind: "individual",
        boId: "12099887766554433",
        fatherName: "Rahim Uddin",
        email: "karim@example.com",
        mobile: "01712349988",
        tin: "",
        address: "Banani, Dhaka",
        status: "active",
      },
      "secretary@demo.local",
    );
    recordHolding(
      registry,
      {
        companyId: "co_meghna",
        holderId: holder.id,
        shareClass: "Ordinary",
        kind: "allotment",
        shares: 2500,
        effectiveDate: "2026-11-10",
        reference: "ALLOT-KARIM-01",
      },
      "secretary@demo.local",
    );

    const dynamicIndividual = findParticipant("individual", "12099887766554433", "Karim Uddin");
    expect(dynamicIndividual).toBeDefined();
    expect(dynamicIndividual?.eligibleShares).toBe(2500);
    expect(participantRights("mtg_agm_2026", dynamicIndividual!.id)?.shares).toBe(2500);

    registry.authorizations.push({
      id: "auth_dyn_1",
      holderId: holder.id,
      companyId: "co_meghna",
      meetingId: "mtg_agm_2026",
      kind: "proxy",
      name: "Sadia Proxy",
      reference: "PRX-DYN-001",
      status: "approved",
      reason: "Verified instrument",
      participantId: "p_auth_dyn1",
      at: new Date().toISOString(),
    });
    const dynamicProxy = findParticipant("proxy", "12099887766554433", "Sadia Proxy");
    expect(dynamicProxy).toBeDefined();
    expect(participantRights("mtg_agm_2026", dynamicProxy!.id)?.votingRights).toBe(2500);
  });
});

describe("end-to-end workspace modules", () => {
  it("onboards a company, configures legal settings, and syncs upcoming meetings", () => {
    const company = createCompany(
      {
        name: "Jamuna Maritime PLC",
        shortName: "Jamuna Maritime",
        registrationNo: "C-190001/2026",
        tin: "100999888-0201",
        sector: "Shipping",
        type: "Public Limited",
        listed: true,
        shareClasses: ["Ordinary"],
        paidUpCapital: 500_000_000,
        totalShareholders: 3200,
      },
      "admin@demo.local",
    );
    expect(company.id).toContain("co_jamuna");
    const settings = saveCompanySettings(
      "co_meghna",
      {
        quorumPercent: 30,
        quorumMinMembers: 7,
        pollDemandThresholdPercent: 5,
        defaultProxyLimit: 3,
        proxyDeadlineHoursBefore: 24,
        noticeDaysRequired: 21,
        signatoryName: "Nusrat Jahan",
        signatoryTitle: "Company Secretary",
        sealReference: "MTL-SEAL-V2",
      },
      "admin@demo.local",
      true,
    );
    expect(getCompanySettings("co_meghna").quorumPercent).toBe(30);
    expect(settings.defaultProxyLimit).toBe(3);
    expect(demoStore.meetings[0].proxyLimitPerHolder).toBe(3);
  });

  it("persists approval decisions, investors, notices, communications, tickets, integrations, and staff users", () => {
    const ap = decideApproval("ap1", "approved", "admin@demo.local", "Cleared for dispatch");
    expect(ap?.status).toBe("approved");

    const inv = saveInvestor(
      {
        companyId: "co_meghna",
        kind: "foreign",
        name: "Nordic Maritime Fund",
        tin: "FII-NO-99",
        email: "ops@nordicfund.no",
        phone: "+47221100",
        country: "Norway",
        kycStatus: "pending",
        relationshipManager: "Aditi",
        communicationPreference: "email",
        linkedBoIds: ["12012345678901234"],
        notes: "",
      },
      "admin@demo.local",
    );
    expect(updateInvestorKyc(inv.id, "verified", "admin@demo.local")?.kycStatus).toBe("verified");

    const dispatches = dispatchStatutoryNotice(
      {
        meetingId: "mtg_agm_delta_2026",
        channels: ["portal", "email"],
        language: "bilingual",
      },
      "admin@demo.local",
    );
    expect(dispatches).toHaveLength(2);
    expect(demoStore.meetings.find((m) => m.id === "mtg_agm_delta_2026")?.noticePublished).toBe(true);

    const broadcast = sendCommunicationBroadcast(
      {
        companyId: "co_meghna",
        meetingId: "mtg_agm_2026",
        category: "reminder",
        subject: "Reminder: 48h to proxy cutoff",
        body: "Submit proxy forms before deadline.",
        channels: ["portal", "sms"],
      },
      "secretary@demo.local",
    );
    expect(broadcast.status).toBe("delivered");
    expect(demoStore.portalNotifications.some((n) => n.title === "Reminder: 48h to proxy cutoff")).toBe(true);

    const tkt = createSupportTicket(
      {
        companyId: "co_meghna",
        boId: "12012345678901234",
        shareholderName: "Rashedul Islam",
        category: "meeting_access",
        priority: "high",
        subject: "Need OTP check",
        description: "Verify primary phone route.",
        assignedTo: "Aditi Rahman",
      },
      "admin@demo.local",
    );
    expect(updateSupportTicket(tkt.id, { status: "resolved", resolutionNote: "Verified" }, "admin@demo.local")?.status).toBe("resolved");

    const synced = triggerIntegrationSync("int_cdbl", "admin@demo.local");
    expect(synced?.status).toBe("connected");

    const newUser = createStaffUser({
      name: "New Scrutinizer",
      email: "scrutiny@company.bd",
      password: "Password123",
      role: "Scrutinizer",
      companyIds: ["co_meghna"],
    });
    expect(listStaffUsers().some((u) => u.email === newUser.email)).toBe(true);
    expect(updateStaffUser(newUser.id, { status: "suspended" }).status).toBe("suspended");
  });
});
