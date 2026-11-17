/** Fictional register; synchronous mutations and their audit entries are atomic in this process. */
import { DEMO_PARTICIPANTS } from "./demo-data";
import type { AuditEntry } from "./types";
import { duplicateHolder, holdingBalance, holdingSchema, shareholderSchema, type Authorization, type HoldingEntry, type ImportRow, type Shareholder, type ShareholderInput } from "./shareholders";

export interface RegistryState { holders: Shareholder[]; entries: HoldingEntry[]; authorizations: Authorization[]; audit: AuditEntry[] }
export function seedRegistry(): RegistryState {
  const state: RegistryState = { holders: [], entries: [], authorizations: [], audit: [] };
  const now = "2026-10-01T00:00:00.000Z";
  for (const p of DEMO_PARTICIPANTS.filter((p) => p.kind !== "proxy")) {
    const id = `sh_${p.id}`;
    state.holders.push({ id, companyId: p.companyId, name: p.subjectName, kind: p.kind === "corporate" ? "corporate" : "individual", boId: p.boId, fatherName: p.kind === "individual" ? "Abdul Karim" : "", email: `${p.id.slice(2)}@example.com`, mobile: `0170000${p.mobile.slice(-2).padStart(4, "0")}`, tin: "", address: "Gulshan, Dhaka, Bangladesh", status: "active", createdAt: now, updatedAt: now });
    state.entries.push({ id: `he_${id}`, holderId: id, companyId: p.companyId, shareClass: "Ordinary", delta: p.eligibleShares, effectiveDate: "2026-01-01", reference: "DEMO-OPENING", kind: "opening", actor: "Demo seed", at: now });
  }
  const names = ["Ayesha Siddiqua", "Tanvir Ahmed", "Nabila Rahman", "Eastern Investments Limited", "Sadia Islam", "Hasan Mahmud", "Greenfield Holdings Limited", "Nafisa Khan", "Arif Hossain", "Ruma Akter", "Shahidul Alam", "Sultana Begum"];
  names.forEach((name, i) => {
    const companyId = ["co_meghna", "co_delta", "co_karnaphuli", "co_padma"][i % 4]; const id = `sh_demo_${i}`;
    state.holders.push({ id, companyId, name, kind: name.includes("Limited") ? "corporate" : "individual", boId: `1201234567891${String(i).padStart(4, "0")}`, fatherName: "", email: `holder${i}@example.com`, mobile: `0171000${String(i).padStart(4, "0")}`, tin: "", address: "Dhaka, Bangladesh", status: i === 9 ? "suspended" : "active", createdAt: now, updatedAt: now });
    state.entries.push({ id: `he_${id}`, companyId, holderId: id, shareClass: "Ordinary", delta: (i + 1) * 2500, effectiveDate: "2026-01-01", reference: "DEMO-OPENING", kind: "opening", actor: "Demo seed", at: now });
  });
  state.authorizations.push({ id: "auth_mahir", holderId: "sh_p_rashedul", companyId: "co_meghna", meetingId: "mtg_agm_2026", kind: "proxy", name: "Mahir Rahman", reference: "DEMO-PROXY-001", status: "approved", reason: "Demo instrument verified", participantId: "p_mahirn", at: now });
  state.authorizations.push({ id: "auth_imran", holderId: "sh_p_delta_corp", companyId: "co_delta", meetingId: "mtg_agm_delta_2026", kind: "corporate", name: "Imran Kabir", reference: "DEMO-BOARD-001", status: "approved", reason: "Demo board authority verified", participantId: "p_delta_corp", at: now });
  return state;
}
const shared = globalThis as unknown as { __irmRegistry?: RegistryState };
export const registry = shared.__irmRegistry ??= seedRegistry();
export function auditRegistry(state: RegistryState, actor: string, action: string, entity: string, companyId: string) {
  state.audit.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), actor, action, entity, companyId });
}
export function saveHolder(state: RegistryState, input: ShareholderInput, actor: string, id?: string) {
  const data = shareholderSchema.parse(input);
  const existing = id ? state.holders.find((h) => h.id === id && h.companyId === data.companyId) : undefined;
  if (id && !existing) throw new Error("Shareholder not found");
  if (duplicateHolder(data, state.holders, id)) throw new Error("A holder with this BO / folio, TIN, or name + father name already exists in this company");
  if (existing && existing.boId !== data.boId) throw new Error("BO / folio ID is immutable. Create a separate account for a different ID.");
  if (existing && existing.kind !== data.kind) throw new Error("Holder type is immutable. Create a separate legal account for a different holder type.");
  if (existing && data.status === "closed" && holdingBalance(state.entries, existing.id) !== 0) throw new Error("Transfer all shares before closing this account");
  const now = new Date().toISOString();
  const holder: Shareholder = { ...data, id: existing?.id ?? `sh_${crypto.randomUUID()}`, createdAt: existing?.createdAt ?? now, updatedAt: now };
  if (existing) state.holders[state.holders.indexOf(existing)] = holder; else state.holders.push(holder);
  auditRegistry(state, actor, existing ? "shareholder.update" : "shareholder.create", `shareholder:${holder.id}`, holder.companyId);
  return holder;
}
export function commitImport(state: RegistryState, rows: ImportRow[], actor: string) {
  if (!rows.length || rows.some((r) => r.errors.length || !r.data)) throw new Error("Resolve every row error before importing");
  const staged = structuredClone(state);
  for (const row of rows) {
    const holder = saveHolder(staged, row.data!, actor);
    if (row.shares) staged.entries.push({ id: crypto.randomUUID(), companyId: holder.companyId, holderId: holder.id, shareClass: row.shareClass, delta: row.shares, effectiveDate: row.effectiveDate, reference: "CSV-OPENING", kind: "opening", actor, at: new Date().toISOString() });
  }
  auditRegistry(staged, actor, "register.import.commit", `register:${rows.length} records`, rows[0].data!.companyId);
  Object.assign(state, staged);
}
export function recordHolding(state: RegistryState, input: unknown, actor: string) {
  const data = holdingSchema.parse(input);
  const source = state.holders.find((h) => h.id === data.holderId && h.companyId === data.companyId);
  if (!source || source.status !== "active") throw new Error("Choose an active shareholder");
  const involved = [data.holderId, ...(data.kind === "transfer" ? [data.recipientId] : [])];
  if (state.entries.some((e) => involved.includes(e.holderId) && e.shareClass === data.shareClass && e.effectiveDate > data.effectiveDate)) throw new Error("Effective date cannot precede an existing entry for these accounts");
  if (state.entries.some((e) => e.companyId === data.companyId && e.reference === data.reference)) throw new Error("This transaction reference has already been recorded");
  const balance = holdingBalance(state.entries, source.id, data.shareClass);
  if (data.kind === "transfer" && balance < data.shares) throw new Error("Insufficient shares for this transfer");
  const recipient = data.kind === "transfer" ? state.holders.find((h) => h.id === data.recipientId && h.companyId === data.companyId && h.status === "active") : undefined;
  if (data.kind === "transfer" && (!recipient || recipient.id === source.id)) throw new Error("Choose a different active holder in the same company");
  const targetBalance = data.kind === "transfer" ? holdingBalance(state.entries, recipient!.id, data.shareClass) : balance;
  if (!Number.isSafeInteger(targetBalance + data.shares)) throw new Error("Share balance exceeds the supported range");
  const base = { companyId: data.companyId, shareClass: data.shareClass, effectiveDate: data.effectiveDate, reference: data.reference, actor, at: new Date().toISOString() };
  const entries: HoldingEntry[] = [{ ...base, id: crypto.randomUUID(), holderId: source.id, delta: data.kind === "transfer" ? -data.shares : data.shares, kind: data.kind === "transfer" ? "transfer_out" : "allotment" }];
  if (recipient) entries.push({ ...base, id: crypto.randomUUID(), holderId: recipient.id, delta: data.shares, kind: "transfer_in" });
  state.entries.push(...entries);
  auditRegistry(state, actor, `holding.${data.kind}`, `reference:${data.reference}`, data.companyId);
}
