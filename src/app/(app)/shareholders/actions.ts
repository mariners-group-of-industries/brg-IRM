"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getMeeting, notifyParticipant } from "@/lib/demo-store";
import { DEMO_PARTICIPANTS } from "@/lib/demo-data";
import { requireHolder, requireRegistryCompany } from "@/lib/registry-access";
import { auditRegistry, commitImport, recordHolding, registry, saveHolder } from "@/lib/shareholder-store";
import { authorizationRuleError, authorizationSchema, holdingSchema, previewImport, shareholderSchema } from "@/lib/shareholders";

function refresh() {
  revalidatePath("/shareholders", "layout");
  revalidatePath("/shareholding");
  revalidatePath("/reports/audit");
  revalidatePath("/portal", "layout");
}
function message(error: unknown) { return error instanceof Error ? error.message : "Could not save this change"; }

export async function saveShareholderAction(input: unknown, id?: string) {
  const parsed = shareholderSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const { session } = await requireRegistryCompany(parsed.data.companyId, "shareholders.manage");
  if (id) await requireHolder(id, "shareholders.manage");
  try { const holder = saveHolder(registry, parsed.data, session.email, id); refresh(); return { ok: true as const, id: holder.id }; }
  catch (error) { return { ok: false as const, error: message(error) }; }
}
export async function revealShareholderAction(id: string, reason: string) {
  const { holder, session } = await requireHolder(id, "shareholders.pii.read");
  if (typeof reason !== "string" || reason.trim().length < 5 || reason.length > 200) return { ok: false as const, error: "Give a reason of 5–200 characters for accessing personal data" };
  // Reasons are confirmed by the operator but never copied into the audit: they may contain PII.
  auditRegistry(registry, session.email, "shareholder.pii.read", `shareholder:${id}`, holder.companyId);
  revalidatePath("/reports/audit");
  return { ok: true as const, holder: structuredClone(holder) };
}
export async function previewImportAction(companyId: string, source: string) {
  const { company } = await requireRegistryCompany(companyId, "shareholders.import");
  try { const rows = previewImport(source, companyId, company.shareClasses, registry.holders); return { ok: true as const, rows: rows.map(({ row, errors }) => ({ row, errors })) }; }
  catch (error) { return { ok: false as const, error: message(error) }; }
}
export async function commitImportAction(companyId: string, source: string) {
  const { company, session } = await requireRegistryCompany(companyId, "shareholders.import");
  try {
    // Reparse and recheck duplicates on the server at commit; never trust a browser preview.
    const rows = previewImport(source, companyId, company.shareClasses, registry.holders);
    commitImport(registry, rows, session.email); refresh(); return { ok: true as const, count: rows.length };
  } catch (error) { return { ok: false as const, error: message(error) }; }
}
export async function recordHoldingAction(input: unknown) {
  const parsed = holdingSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const { company, session } = await requireRegistryCompany(parsed.data.companyId, "shareholding.manage");
  await requireHolder(parsed.data.holderId, "shareholding.manage");
  if (parsed.data.kind === "transfer") await requireHolder(parsed.data.recipientId, "shareholding.manage");
  if (!company.shareClasses.includes(parsed.data.shareClass)) return { ok: false as const, error: "Unknown share class" };
  try { recordHolding(registry, parsed.data, session.email); refresh(); return { ok: true as const }; }
  catch (error) { return { ok: false as const, error: message(error) }; }
}
export async function createAuthorizationAction(input: unknown) {
  const parsed = authorizationSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const data = parsed.data;
  const { holder, session } = await requireHolder(data.holderId, "shareholders.authorizations.manage");
  const meeting = getMeeting(data.meetingId);
  if (!meeting || meeting.companyId !== holder.companyId) notFound();
  const ruleError = authorizationRuleError(meeting, holder, data.kind, registry.authorizations);
  if (ruleError) return { ok: false as const, error: ruleError };
  if (registry.authorizations.some((a) => a.holderId === holder.id && a.meetingId === meeting.id && a.name === data.name && ["pending", "approved"].includes(a.status))) return { ok: false as const, error: "This person already has an active appointment for this meeting" };
  const participantId = DEMO_PARTICIPANTS.find((p) => p.companyId === holder.companyId && p.boId === holder.boId && p.kind === data.kind && p.name === data.name)?.id ?? `p_auth_${crypto.randomUUID().slice(0, 8)}`;
  const authorization = { ...data, participantId, id: crypto.randomUUID(), companyId: holder.companyId, status: "pending" as const, at: new Date().toISOString(), reason: "" };
  registry.authorizations.push(authorization);
  auditRegistry(registry, session.email, "authorization.submit", `authorization:${authorization.id}`, holder.companyId);
  refresh(); return { ok: true as const };
}
export async function decideAuthorizationAction(id: string, status: "approved" | "rejected" | "revoked", reason: string) {
  const parsed = z.object({ id: z.string(), status: z.enum(["approved", "rejected", "revoked"]), reason: z.string().trim().min(5).max(300) }).safeParse({ id, status, reason });
  if (!parsed.success) return { ok: false as const, error: "Enter a review note of 5–300 characters" };
  const authorization = registry.authorizations.find((a) => a.id === id);
  if (!authorization) notFound();
  const { session } = await requireHolder(authorization.holderId, "shareholders.authorizations.manage");
  if ((status === "revoked" && authorization.status !== "approved") || (status !== "revoked" && authorization.status !== "pending")) return { ok: false as const, error: "This authorization has already been reviewed" };
  if (status === "approved") {
    const meeting = getMeeting(authorization.meetingId); const holder = registry.holders.find((h) => h.id === authorization.holderId)!;
    if (!meeting) notFound();
    const ruleError = authorizationRuleError(meeting, holder, authorization.kind, registry.authorizations.filter((a) => a.id !== id));
    if (ruleError) return { ok: false as const, error: ruleError };
  }
  authorization.status = status; authorization.reason = parsed.data.reason;
  const holder=registry.holders.find(h=>h.id===authorization.holderId)!;
  const targets = new Set([
    ...DEMO_PARTICIPANTS.filter(p=>p.companyId===holder.companyId&&p.boId===holder.boId&&(p.kind==='individual'||p.id===authorization.participantId)).map(p=>p.id),
    ...(holder.kind==='individual' ? [holder.id] : []),
    ...(authorization.participantId ? [authorization.participantId] : []),
  ]);
  for (const pid of targets) notifyParticipant(pid,authorization.meetingId,"appointment","Appointment updated",`Appointment ${status}`);
  auditRegistry(registry, session.email, `authorization.${status}`, `authorization:${id}`, authorization.companyId);
  refresh(); return { ok: true as const };
}
