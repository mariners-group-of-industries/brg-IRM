import { z } from "zod";
import type { Meeting } from "./types";

const text = (max = 160) => z.string().trim().max(max);
export const shareholderSchema = z.object({
  companyId: text().min(1, "Choose a company"),
  name: text().min(3, "Enter the legal holder name"),
  kind: z.enum(["individual", "corporate"]),
  boId: text(32).regex(/^[A-Za-z0-9-]{6,32}$/, "Use a BO / folio ID of 6–32 letters, digits or hyphens"),
  fatherName: text().default(""),
  email: z.union([z.email(), z.literal("")]).default(""),
  mobile: text(24).refine((v) => !v || /^\+?[0-9 ()-]{7,24}$/.test(v), "Enter a valid phone number").default(""),
  tin: text(32).default(""),
  address: text(300).default(""),
  status: z.enum(["active", "suspended", "closed"]).default("active"),
});
export type ShareholderInput = z.infer<typeof shareholderSchema>;
export interface Shareholder extends ShareholderInput { id: string; createdAt: string; updatedAt: string }
export interface HoldingEntry {
  id: string; companyId: string; holderId: string; shareClass: string;
  delta: number; effectiveDate: string; reference: string;
  kind: "opening" | "allotment" | "transfer_in" | "transfer_out";
  actor: string; at: string;
}
export interface Authorization {
  id: string; companyId: string; holderId: string; meetingId: string;
  kind: "proxy" | "corporate"; name: string; reference: string;
  status: "pending" | "approved" | "rejected" | "revoked";
  reason: string; at: string; participantId?: string;
}
export function authorizationRuleError(meeting: Meeting, holder: Shareholder, kind: Authorization["kind"], authorizations: Authorization[], now = new Date()) {
  if (["completed", "archived"].includes(meeting.status) || holder.status !== "active") return "Use an active holder and an open meeting";
  if ((kind === "corporate") !== (holder.kind === "corporate")) return "Corporate holders require a representative; individuals use a proxy";
  if (kind === "corporate" && !meeting.corporateRepresentatives) return "Corporate representatives are not enabled for this meeting";
  if (kind === "proxy") {
    if (!meeting.proxiesAllowed || !meeting.proxyLimitPerHolder) return "Proxy rules are not enabled/configured for this meeting";
    if (meeting.proxyDeadline && now > new Date(meeting.proxyDeadline)) return "The configured proxy deadline has passed";
    const active = authorizations.filter((a) => a.holderId === holder.id && a.meetingId === meeting.id && a.kind === "proxy" && ["pending", "approved"].includes(a.status));
    if (active.length >= meeting.proxyLimitPerHolder) return "The configured proxy limit for this holder and meeting has been reached";
  }
  return null;
}
export const dateSchema = z.iso.date();
export const holdingSchema = z.object({
  holderId: text().min(1), companyId: text().min(1),
  shareClass: text().min(1), kind: z.enum(["allotment", "transfer"]),
  recipientId: text().default(""),
  shares: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  effectiveDate: dateSchema, reference: text(100).min(3, "Enter the allotment or transfer reference"),
});
export const authorizationSchema = z.object({
  holderId: text().min(1), meetingId: text().min(1),
  kind: z.enum(["proxy", "corporate"]), name: text(120).min(3, "Enter a name of at least 3 characters"),
  reference: text(100).min(3, "Enter the signed instrument reference"),
});
export function normalized(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[.\s]+/g, " ").trim();
}
export function duplicateHolder(input: ShareholderInput, holders: Shareholder[], exceptId?: string) {
  return holders.find((h) => h.id !== exceptId && h.companyId === input.companyId && (
    normalized(h.boId) === normalized(input.boId) ||
    (!!input.tin && !!h.tin && normalized(h.tin) === normalized(input.tin)) ||
    (!!input.fatherName && !!h.fatherName && normalized(h.name) === normalized(input.name) && normalized(h.fatherName) === normalized(input.fatherName))
  ));
}
export function holdingBalance(entries: HoldingEntry[], holderId: string, shareClass?: string, asOf = "9999-12-31") {
  return entries.filter((e) => e.holderId === holderId && (!shareClass || e.shareClass === shareClass) && e.effectiveDate <= asOf)
    .reduce((sum, e) => sum + e.delta, 0);
}
export function maskValue(value: string) { return value ? `••••${value.slice(-4)}` : "—"; }
export function publicHolder(holder: Shareholder) {
  return { ...holder, boId: maskValue(holder.boId), fatherName: holder.fatherName ? "••••••" : "—", email: holder.email ? "••••@••••" : "—", mobile: maskValue(holder.mobile), tin: maskValue(holder.tin), address: holder.address ? "••••••" : "—" };
}

export const CSV_HEADERS = ["name", "kind", "boId", "fatherName", "email", "mobile", "tin", "address", "shareClass", "shares", "effectiveDate"];
/** RFC-style quoted fields, escaped quotes, BOM and CRLF. IDs stay strings. */
export function parseCsv(source: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false; let closed = false;
  const input = source.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else cell += c;
    } else if (c === '"') {
      if (cell || closed) throw new Error("Unexpected quote in CSV field");
      quoted = true;
    } else if (c === ",") { row.push(cell); cell = ""; closed = false; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(cell); if (row.some((v) => v.trim())) rows.push(row);
      row = []; cell = ""; closed = false;
    } else {
      if (closed && c.trim()) throw new Error("Unexpected text after quoted CSV field");
      if (!closed) cell += c;
    }
  }
  if (quoted) throw new Error("Unclosed quote in CSV");
  row.push(cell); if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}
export function csvCell(value: string | number) {
  let s = String(value);
  if (/^[\s]*[=+@-]/.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
}
export interface ImportRow { row: number; data?: ShareholderInput; shareClass: string; shares: number; effectiveDate: string; errors: string[] }
export function previewImport(source: string, companyId: string, shareClasses: string[], existing: Shareholder[]): ImportRow[] {
  if (source.length > 1_000_000) throw new Error("CSV must be under 1 MB");
  const [header, ...rows] = parseCsv(source);
  if (!header || !["name", "kind", "boId", "shareClass", "shares", "effectiveDate"].every((h) => header.includes(h))) throw new Error("Missing required columns. Download the template first.");
  if (new Set(header).size !== header.length) throw new Error("Duplicate column names");
  if (!rows.length || rows.length > 1000) throw new Error("Import between 1 and 1,000 rows at a time");
  const accepted = [...existing];
  return rows.map((cells, index) => {
    const record = Object.fromEntries(header.map((key, i) => [key, cells[i]?.trim() ?? ""]));
    const parsed = shareholderSchema.safeParse({ ...record, companyId });
    const errors = parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    if (cells.length !== header.length) errors.push("Column count does not match header");
    const shares = Number(record.shares);
    if (!record.shares || !Number.isSafeInteger(shares) || shares < 0) errors.push("Shares must be a non-negative whole number");
    if (parsed.success && parsed.data.status === "closed" && shares > 0) errors.push("Closed accounts cannot have opening shares");
    if (!shareClasses.includes(record.shareClass)) errors.push("Unknown share class for this company");
    if (!dateSchema.safeParse(record.effectiveDate).success) errors.push("Use an effective date in YYYY-MM-DD format");
    if (parsed.success && duplicateHolder(parsed.data, accepted)) errors.push("Duplicate BO / folio, TIN, or name + father name in this company");
    if (parsed.success) accepted.push({ ...parsed.data, id: `row_${index}`, createdAt: "", updatedAt: "" });
    return { row: index + 2, data: parsed.success ? parsed.data : undefined, shareClass: record.shareClass, shares, effectiveDate: record.effectiveDate, errors };
  });
}
