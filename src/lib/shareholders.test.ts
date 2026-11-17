import { beforeEach, describe, expect, it } from "vitest";
import { CSV_HEADERS, authorizationRuleError, csvCell, duplicateHolder, holdingBalance, parseCsv, previewImport, publicHolder, shareholderSchema } from "./shareholders";
import { DEMO_MEETINGS } from "./demo-data";
import { commitImport, recordHolding, saveHolder, seedRegistry, type RegistryState } from "./shareholder-store";

let state: RegistryState;
beforeEach(() => { state = seedRegistry(); });
const input = () => shareholderSchema.parse({ companyId: "co_meghna", name: "New Holder", kind: "individual", boId: "0000123456" });
const csv = (name = "New Holder", id = "0000123456", shares = "100") => `${CSV_HEADERS.join(",")}\r\n${name},individual,${id},Father Name,holder@example.com,01712345678,,"Dhaka, Bangladesh",Ordinary,${shares},2026-11-01`;
const txn = (overrides = {}) => ({ companyId: "co_meghna", holderId: "sh_p_rashedul", shareClass: "Ordinary", kind: "transfer", recipientId: "sh_p_farhana", shares: 250, effectiveDate: "2026-11-01", reference: "TRANSFER-TEST", ...overrides });

describe("legal register", () => {
  it("preserves leading-zero IDs and separates companies", () => {
    const holder = saveHolder(state, input(), "registrar"); expect(holder.boId).toBe("0000123456");
    expect(() => saveHolder(state, input(), "registrar")).toThrow(/already exists/);
    expect(() => saveHolder(state, { ...input(), companyId: "co_delta" }, "registrar")).not.toThrow();
  });
  it("finds duplicate TIN and normalized name + father", () => {
    const data = { ...input(), tin: "1234", fatherName: "Abdul Karim" }; saveHolder(state, data, "registrar");
    expect(duplicateHolder({ ...data, boId: "999999", name: "Another Name" }, state.holders)).toBeTruthy();
    expect(duplicateHolder({ ...data, tin: "", boId: "999999", name: " NEW   HOLDER " }, state.holders)).toBeTruthy();
  });
  it("keeps legal account IDs/types immutable and refuses a closed account with shares", () => {
    const holder = state.holders[0];
    expect(() => saveHolder(state, { ...holder, boId: "999999" }, "registrar", holder.id)).toThrow(/immutable/);
    expect(() => saveHolder(state, { ...holder, kind: "corporate" }, "registrar", holder.id)).toThrow(/immutable/);
    expect(() => saveHolder(state, { ...holder, status: "closed" }, "registrar", holder.id)).toThrow(/Transfer all shares/);
  });
  it("serializes masked personal fields without full values", () => {
    const holder = { ...state.holders[0], tin: "1234567890" }; const safe = publicHolder(holder);
    for (const key of ["boId", "mobile", "email", "address", "fatherName", "tin"] as const) expect(safe[key]).not.toBe(holder[key]);
    expect(safe.boId.endsWith(holder.boId.slice(-4))).toBe(true);
  });
  it("writes only entity metadata to audit on holder changes", () => {
    const holder = saveHolder(state, input(), "registrar"); const audit = state.audit[0];
    expect(audit.entity).toBe(`shareholder:${holder.id}`); expect(JSON.stringify(audit)).not.toContain(holder.boId);
  });
});
describe("register imports", () => {
  it("handles BOM, commas, escaped quotes and CRLF", () => {
    expect(parseCsv('\uFEFFname,address\r\n"A ""Quoted"" Name","Dhaka, BD"\r\n')).toEqual([["name", "address"], ['A "Quoted" Name', "Dhaka, BD"]]);
    expect(() => parseCsv('name\n"unfinished')).toThrow(/Unclosed/);
    expect(() => parseCsv('"name"oops')).toThrow(/Unexpected/);
  });
  it("validates and imports a row with its opening holding and audit", () => {
    const rows = previewImport(csv(), "co_meghna", ["Ordinary"], state.holders); expect(rows[0].errors).toEqual([]);
    commitImport(state, rows, "registrar"); const holder = state.holders.at(-1)!;
    expect(holder.boId).toBe("0000123456"); expect(holdingBalance(state.entries, holder.id)).toBe(100); expect(state.audit[0].action).toBe("register.import.commit");
  });
  it("rejects duplicates within a file and a stale preview without partial writes", () => {
    const row = csv().split("\r\n")[1]; const rows = previewImport(`${csv()}\r\n${row}`, "co_meghna", ["Ordinary"], state.holders);
    expect(rows[1].errors.join()).toMatch(/Duplicate/);
    const before = structuredClone(state); expect(() => commitImport(state, rows, "registrar")).toThrow(); expect(state).toEqual(before);
    const preview = previewImport(csv(), "co_meghna", ["Ordinary"], state.holders); saveHolder(state, input(), "other registrar");
    const after = structuredClone(state); expect(() => commitImport(state, preview, "registrar")).toThrow(); expect(state).toEqual(after);
  });
  it("rejects bad shares, dates, classes and mismatched columns", () => {
    expect(previewImport(csv("New Holder", "0000123456", "1.5"), "co_meghna", ["Ordinary"], []).at(0)?.errors.join()).toMatch(/whole number/);
    expect(previewImport(csv().replace("2026-11-01", "2026-02-30"), "co_meghna", ["Ordinary"], [])[0].errors.join()).toMatch(/effective date/);
    expect(previewImport(csv(), "co_meghna", ["Preference"], [])[0].errors.join()).toMatch(/Unknown share class/);
    expect(previewImport(`${csv()},extra`, "co_meghna", ["Ordinary"], [])[0].errors.join()).toMatch(/Column count/);
    expect(() => previewImport("name,boId\nA,123", "co_meghna", ["Ordinary"], [])).toThrow(/Missing/);
  });
  it("neutralizes spreadsheet formulas on export", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe('"\'=HYPERLINK(1)"'); expect(csvCell('A "quote"')).toBe('"A ""quote"""');
  });
});
describe("holding ledger", () => {
  it("records balanced transfers without changing total issued shares", () => {
    const issued = state.entries.reduce((s, e) => s + e.delta, 0); recordHolding(state, txn(), "registrar");
    expect(holdingBalance(state.entries, "sh_p_rashedul")).toBe(1000); expect(holdingBalance(state.entries, "sh_p_farhana")).toBe(8650);
    expect(state.entries.reduce((s, e) => s + e.delta, 0)).toBe(issued); expect(state.entries.slice(-2).map((e) => e.reference)).toEqual(["TRANSFER-TEST", "TRANSFER-TEST"]);
  });
  it("returns point-in-time balances", () => {
    recordHolding(state, txn(), "registrar"); expect(holdingBalance(state.entries, "sh_p_rashedul", "Ordinary", "2026-10-31")).toBe(1250);
    expect(holdingBalance(state.entries, "sh_p_rashedul", "Ordinary", "2026-11-01")).toBe(1000);
  });
  it.each([{ shares: 2000 }, { shares: -1 }, { shares: 0.1 }, { recipientId: "sh_p_chayan" }, { recipientId: "sh_p_rashedul" }, { effectiveDate: "2025-01-01" }])("rejects invalid transfers atomically: %j", (change) => {
    const before = structuredClone(state); expect(() => recordHolding(state, txn(change), "registrar")).toThrow(); expect(state).toEqual(before);
  });
  it("rejects duplicate references and transfers from suspended accounts", () => {
    recordHolding(state, txn(), "registrar"); expect(() => recordHolding(state, txn(), "registrar")).toThrow(/reference/);
    state.holders[0].status = "suspended"; expect(() => recordHolding(state, txn({ reference: "NEW-REF" }), "registrar")).toThrow(/active/);
  });
  it("records allotments without revising old entries", () => {
    const before = structuredClone(state.entries); recordHolding(state, txn({ kind: "allotment" }), "registrar");
    expect(state.entries.slice(0, before.length)).toEqual(before); expect(holdingBalance(state.entries, "sh_p_rashedul")).toBe(1500);
  });
});
describe("configurable proxy rules", () => {
  const now = new Date("2026-11-17T06:00:00Z");
  it("uses the meeting proxy limit and enabled flag", () => {
    const meeting = structuredClone(DEMO_MEETINGS[0]); const holder = state.holders[0];
    expect(authorizationRuleError(meeting, holder, "proxy", state.authorizations, now)).toMatch(/limit/);
    meeting.proxyLimitPerHolder = 2; expect(authorizationRuleError(meeting, holder, "proxy", state.authorizations, now)).toBeNull();
    meeting.proxiesAllowed = false; expect(authorizationRuleError(meeting, holder, "proxy", [], now)).toMatch(/not enabled/);
  });
  it("checks proxy deadline and corporate holder type", () => {
    const meeting = structuredClone(DEMO_MEETINGS[0]);
    expect(authorizationRuleError(meeting, state.holders[0], "proxy", [], new Date("2026-12-10"))).toMatch(/deadline/);
    expect(authorizationRuleError(meeting, state.holders[0], "corporate", [], now)).toMatch(/Corporate holders/);
  });
});
