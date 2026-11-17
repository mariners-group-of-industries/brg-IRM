import { beforeEach, describe, expect, it, vi } from "vitest";
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => jar.has(name) ? { value: jar.get(name) } : undefined, set: (name: string, value: string) => jar.set(name, value), delete: (name: string) => jar.delete(name) }) }));
import { createSessionCookie, getSession, SESSION_COOKIE } from "./session";
import { createPortalSession, getPortalSession, PORTAL_COOKIE } from "./portal-session";
import { registry, seedRegistry } from "./shareholder-store";
import { setPortalLocaleAction } from "../app/portal/language-actions";
import { getPortalLocale } from "./portal-locale";
const staff = { id: "admin", email: "admin@demo.local", name: "Admin", role: "Platform Super Admin" as const, companyIds: ["co_meghna"] };
const participant = { participantId: "p_rashedul", kind: "individual" as const, companyId: "co_meghna", name: "Rashedul Islam", subjectName: "Rashedul Islam", boId: "12012345678901234", eligibleShares: 1250, votingRights: 1250 };
beforeEach(() => { jar.clear(); Object.assign(registry, seedRegistry()); });
describe("staff and portal session boundaries", () => {
  it("round-trips separate signed sessions", async () => {
    await createSessionCookie(staff); await createPortalSession(participant);
    expect(await getSession()).toEqual(staff); expect(await getPortalSession()).toEqual(participant);
  });
  it("rejects a portal token copied into the staff cookie", async () => {
    await createPortalSession(participant); jar.set(SESSION_COOKIE, jar.get(PORTAL_COOKIE)!); expect(await getSession()).toBeNull();
  });
  it("rejects a staff token copied into the portal cookie", async () => {
    await createSessionCookie(staff); jar.set(PORTAL_COOKIE, jar.get(SESSION_COOKIE)!); expect(await getPortalSession()).toBeNull();
  });
  it("refreshes register identity and rejects suspended/closed holders despite a valid JWT", async () => {
    await createPortalSession(participant); registry.holders[0].name = "Updated Holder";
    expect((await getPortalSession())?.name).toBe("Updated Holder"); registry.holders[0].status = "suspended";
    expect(await getPortalSession()).toBeNull(); registry.holders[0].status = "closed"; expect(await getPortalSession()).toBeNull();
  });
  it("persists only supported language preferences without granting a session",async()=>{
    expect(await getPortalLocale()).toBe("en");expect((await setPortalLocaleAction("bn")).ok).toBe(true);expect(await getPortalLocale()).toBe("bn");expect(await getPortalSession()).toBeNull();expect(await getSession()).toBeNull();expect((await setPortalLocaleAction("unexpected")).ok).toBe(false);expect(await getPortalLocale()).toBe("bn");
  });
});
