"use server";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPortalSession } from "@/lib/portal-session";
import { getMeeting, isPublishedMeeting } from "@/lib/demo-store";
import { DEMO_PARTICIPANTS } from "@/lib/demo-data";
import { registry, auditRegistry } from "@/lib/shareholder-store";
import { authorizationRuleError, authorizationSchema } from "@/lib/shareholders";

export async function requestProxyAction(input: unknown) {
  const session = await getPortalSession(); if (!session || session.kind !== "individual") notFound();
  const holder = registry.holders.find((h) => h.companyId === session.companyId && h.boId === session.boId && h.status === "active"); if (!holder) notFound();
  const parsed = authorizationSchema.safeParse({ ...(typeof input === "object" && input ? input : {}), holderId: holder.id, kind: "proxy" });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const data = parsed.data; const meeting = getMeeting(data.meetingId);
  if (!meeting || meeting.companyId !== holder.companyId || !isPublishedMeeting(meeting)) notFound();
  const ruleError = authorizationRuleError(meeting, holder, "proxy", registry.authorizations);
  if (ruleError) return { ok: false as const, error: ruleError };
  if (registry.authorizations.some((a) => a.holderId === holder.id && a.meetingId === meeting.id && a.name === data.name && ["pending", "approved"].includes(a.status))) return { ok: false as const, error: "This person already has an active appointment for this meeting" };
  const participantId = DEMO_PARTICIPANTS.find((p) => p.companyId === holder.companyId && p.boId === holder.boId && p.kind === "proxy" && p.name === data.name)?.id ?? `p_auth_${crypto.randomUUID().slice(0, 8)}`;
  const id = crypto.randomUUID(); registry.authorizations.push({ ...data, id, companyId: holder.companyId, status: "pending", reason: "", at: new Date().toISOString(), participantId });
  auditRegistry(registry, `participant:${session.participantId}`, "authorization.submit", `authorization:${id}`, holder.companyId);
  revalidatePath("/portal/account"); revalidatePath("/shareholders", "layout"); return { ok: true as const };
}
export async function revokeOwnProxyAction(id: string) {
  const session = await getPortalSession(); if (!session || session.kind !== "individual") notFound();
  const holder = registry.holders.find((h) => h.companyId === session.companyId && h.boId === session.boId); if (!holder) notFound();
  const authorization = registry.authorizations.find((a) => a.id === id && a.holderId === holder.id); if (!authorization) notFound();
  if (!["pending", "approved"].includes(authorization.status)) return { ok: false as const, error: "This appointment is already closed" };
  authorization.status = "revoked"; authorization.reason = "Withdrawn by the legal holder";
  auditRegistry(registry, `participant:${session.participantId}`, "authorization.revoked", `authorization:${id}`, holder.companyId);
  revalidatePath("/portal", "layout"); revalidatePath("/shareholders", "layout"); return { ok: true as const };
}
