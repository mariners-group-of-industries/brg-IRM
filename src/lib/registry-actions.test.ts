import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "./session";
const mocks = vi.hoisted(() => ({ session: null as SessionUser | null }));
vi.mock("server-only", () => ({}));
vi.mock("./session", () => ({ getSession: async () => mocks.session }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./portal-session", () => ({ getPortalSession: async () => null }));
import { createAuthorizationAction, decideAuthorizationAction, previewImportAction, recordHoldingAction, revealShareholderAction, saveShareholderAction } from "../app/(app)/shareholders/actions";
import { registry, seedRegistry } from "./shareholder-store";
import { GET as exportRegister } from "../app/api/shareholders/export/route";
import { shareholderSchema } from "./shareholders";
import { demoStore } from "./demo-store";
import { moderateAction } from "../app/(app)/governance/meetings/[id]/moderation/actions";
import { setSwitchAction } from "../app/(app)/governance/meetings/[id]/controls-actions";
import { setAgendaStageAction, setMeetingLifecycleAction } from "../app/(app)/governance/meetings/[id]/controls-actions";
import { uploadMeetingDocumentAction, publishDocumentAction } from "../app/(app)/governance/documents/actions";
import { GET as downloadDocument } from "../app/api/documents/[id]/route";
import { GET as liveMeeting } from "../app/api/portal/live/[meetingId]/route";
const secretary: SessionUser = { id: "secretary", email: "secretary@demo.local", name: "Secretary", role: "Company Secretary", companyIds: ["co_meghna"] };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-17T06:00:00Z")); mocks.session = structuredClone(secretary); Object.assign(registry, seedRegistry()); });
afterEach(() => vi.useRealTimers());
describe("server-enforced registry authorization", () => {
  it("protects live state and document bytes from signed-out callers", async () => {
    mocks.session = null;
    await expect(liveMeeting(new Request("http://localhost/api/portal/live/mtg_agm_2026"), {params:Promise.resolve({meetingId:"mtg_agm_2026"})})).rejects.toThrow("NEXT_NOT_FOUND");
    const own = demoStore.documents.find(d=>d.companyId==="co_meghna")!;
    await expect(downloadDocument(new Request("http://localhost/api/documents/"+own.id), {params:Promise.resolve({id:own.id})})).rejects.toThrow("NEXT_NOT_FOUND");
    mocks.session = secretary;
    expect((await liveMeeting(new Request("http://localhost/api/portal/live/mtg_agm_delta_2026"), {params:Promise.resolve({meetingId:"mtg_agm_delta_2026"})})).status).toBe(404);
  });
  it("404s unauthenticated callers and roles without registry permission", async () => {
    mocks.session = null; await expect(revealShareholderAction("sh_p_rashedul", "Correction review")).rejects.toThrow("NEXT_NOT_FOUND");
    mocks.session = { ...secretary, role: "Restricted Viewer" }; await expect(exportRegister(new Request("http://localhost/api/shareholders/export"))).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it("404s cross-tenant reads, reveals, imports and writes", async () => {
    await expect(revealShareholderAction("sh_p_chayan", "Correction review")).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(previewImportAction("co_delta", "csv")).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(saveShareholderAction(shareholderSchema.parse({ companyId: "co_delta", name: "New Holder", boId: "000012345", kind: "individual" }))).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(recordHoldingAction({ companyId: "co_meghna", holderId: "sh_p_rashedul", recipientId: "sh_p_chayan", kind: "transfer", shares: 1, shareClass: "Ordinary", effectiveDate: "2026-11-01", reference: "XFER-TEST" })).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it("does not let view-only staff invoke mutation or PII reveal", async () => {
    mocks.session = { ...secretary, role: "Support Officer" };
    await expect(revealShareholderAction("sh_p_rashedul", "Correction review")).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(saveShareholderAction(registry.holders[0], "sh_p_rashedul")).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it("audits explicit personal-data reveal and excludes raw PII from audit", async () => {
    expect((await revealShareholderAction("sh_p_rashedul", "bad")).ok).toBe(false);
    const result = await revealShareholderAction("sh_p_rashedul", "Correction verification"); expect(result.ok).toBe(true);
    expect(registry.audit[0].action).toBe("shareholder.pii.read"); expect(JSON.stringify(registry.audit)).not.toContain(registry.holders[0].boId);
  });
  it("exports only authorized, masked register rows", async () => {
    const response = await exportRegister(new Request("http://localhost/api/shareholders/export")); const csv = await response.text();
    expect(csv).toContain("Rashedul Islam"); expect(csv).not.toContain("Chayan Chowdhury"); expect(csv).not.toContain(registry.holders[0].boId);
    expect(response.headers.get("Cache-Control")).toBe("no-store"); expect(registry.audit[0].action).toBe("shareholder.export.masked");
    await expect(exportRegister(new Request("http://localhost/api/shareholders/export?company=co_delta"))).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it("rejects unknown share classes even for an authorized writer", async () => {
    const result = await recordHoldingAction({ companyId: "co_meghna", holderId: "sh_p_rashedul", kind: "allotment", shares: 100, shareClass: "Preference", effectiveDate: "2026-11-01", reference: "ALLOT-TEST" });
    expect(result).toHaveProperty("ok", false); expect(result).toHaveProperty("error", "Unknown share class");
  });
  it("enforces authorization review transitions and tenant isolation", async () => {
    const result = await createAuthorizationAction({ holderId: "sh_p_farhana", meetingId: "mtg_egm_bonus", kind: "proxy", name: "Sample Proxy", reference: "SIGNED-PROXY" }); expect(result.ok).toBe(true);
    const authorization = registry.authorizations.at(-1)!; expect(authorization.status).toBe("pending");
    expect((await decideAuthorizationAction(authorization.id, "approved", "Instrument verified")).ok).toBe(true);
    expect((await decideAuthorizationAction(authorization.id, "rejected", "Duplicate decision")).ok).toBe(false);
    expect((await decideAuthorizationAction(authorization.id, "revoked", "Holder withdrew proxy")).ok).toBe(true);
    await expect(decideAuthorizationAction("auth_imran", "revoked", "Unauthorized tenant")).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it("rejects cross-company meetings and duplicate active appointments", async () => {
    await expect(createAuthorizationAction({ holderId: "sh_p_rashedul", meetingId: "mtg_agm_delta_2026", kind: "proxy", name: "Sample Proxy", reference: "SIGNED-PROXY" })).rejects.toThrow("NEXT_NOT_FOUND");
    const result = await createAuthorizationAction({ holderId: "sh_p_rashedul", meetingId: "mtg_agm_2026", kind: "proxy", name: "Sample Proxy", reference: "SIGNED-PROXY" }); expect(result.ok).toBe(false);
  });
  it("does not accept a question from another meeting through an authorized meeting id", async () => {
    mocks.session = { ...secretary, role: "Moderator" };
    demoStore.portal.questions.push({ id: "cross-meeting-question", meetingId: "mtg_egm_cement", participantId: "p_chayan", participantName: "Chayan", boId: "…3333", kind: "text", body: "Private company question", status: "pending", at: new Date().toISOString() });
    await expect(moderateAction("mtg_agm_2026", "cross-meeting-question", "approve")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(demoStore.portal.questions.at(-1)?.status).toBe("pending");
  });
  it("rejects forged meeting-control keys at runtime", async () => {
    mocks.session = { ...secretary, role: "Moderator" };
    const result = await setSwitchAction("mtg_agm_2026", "companyId" as "votingOpen", true);
    expect(result.ok).toBe(false); expect(demoStore.meetings[0].companyId).toBe("co_meghna");
  });
  it("guards lifecycle and agenda controls on the server for roles and companies", async () => {
    mocks.session={...secretary,role:"Support Officer"};
    await expect(setMeetingLifecycleAction("mtg_agm_2026","start")).rejects.toThrow("NEXT_NOT_FOUND");
    mocks.session={...secretary,role:"Moderator"};
    await expect(setMeetingLifecycleAction("mtg_agm_delta_2026","start")).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(setAgendaStageAction("mtg_agm_2026","foreign_agenda","voting")).rejects.toThrow("NEXT_NOT_FOUND");
    expect((await setAgendaStageAction("mtg_agm_2026","ag1","unrecognized")).ok).toBe(false);
  });
  it("protects document uploads, publication and downloads across companies",async()=>{
    const form=new FormData();form.set("meetingId","mtg_agm_delta_2026");form.set("title","Foreign notice");form.set("kind","notice");form.set("file",new File(["Sample"],"notice.txt",{type:"text/plain"}));
    await expect(uploadMeetingDocumentAction(form)).rejects.toThrow("NEXT_NOT_FOUND");
    const foreign=demoStore.documents.find(d=>d.companyId==="co_karnaphuli")!;
    await expect(publishDocumentAction(foreign.id,true)).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(downloadDocument(new Request("http://localhost/api/documents/"+foreign.id),{params:Promise.resolve({id:foreign.id})})).rejects.toThrow("NEXT_NOT_FOUND");
    const own=demoStore.documents.find(d=>d.companyId==="co_meghna")!;
    const response=await downloadDocument(new Request("http://localhost/api/documents/"+own.id+"?download=1"),{params:Promise.resolve({id:own.id})});
    expect(response.headers.get("Content-Disposition")).toContain("attachment");expect(response.headers.get("Cache-Control")).toContain("no-store");expect(await response.text()).toContain("DEMO");
    mocks.session={...secretary,role:"Board Member"};
    await expect(uploadMeetingDocumentAction(form)).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
