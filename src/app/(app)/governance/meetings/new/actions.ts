"use server";

import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { meetingDraftSchema } from "@/lib/validations/meeting";
import { createMeeting } from "@/lib/demo-store";
import { meetingTimeToIso } from "@/lib/meeting-time";

/**
 * Publish a meeting created in demo mode.
 * Validates the full draft server-side, enforces the meetings.create
 * permission, and appends to the in-memory demo store. Persistent storage
 * arrives with the Phase 3 database wiring.
 */
export async function publishMeetingAction(input: unknown) {
  const session = await getSession();
  if (!session) return { ok: false as const, error: "Not signed in" };
  if (!hasPermission(session.role, "meetings.create")) {
    return { ok: false as const, error: "You do not have permission to create meetings" };
  }
  const parsed = meetingDraftSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid meeting data",
    };
  }
  const draft = parsed.data;
  // Tenancy: the caller must be able to act on the chosen company.
  if (
    session.role !== "Platform Super Admin" &&
    !session.companyIds.includes(draft.companyId)
  ) {
    return { ok: false as const, error: "Company not found" };
  }
  let times: { date: string; proxyDeadline: string; registrationOpens: string; registrationCloses: string };
  try {
    times = {
      date: meetingTimeToIso(`${draft.date}T${draft.time}`, draft.timezone),
      proxyDeadline: meetingTimeToIso(draft.proxyDeadline, draft.timezone),
      registrationOpens: meetingTimeToIso(draft.registrationOpens, draft.timezone),
      registrationCloses: meetingTimeToIso(draft.registrationCloses, draft.timezone),
    };
  } catch { return { ok: false as const, error: "Check meeting, registration and proxy dates and the selected timezone" }; }

  const meeting = createMeeting({
    companyId: draft.companyId,
    type: draft.type,
    title: draft.title,
    financialYear: draft.financialYear,
    date: times.date,
    timezone: draft.timezone,
    mode: draft.mode,
    venue: draft.venue,
    status: "notice_pending",
    recordDate: `${draft.recordDate}T00:00:00.000Z`,
    eligibleShareholders: draft.eligibleShareholders,
    votingMethod: draft.votingMethod,
    pollDemandRule: draft.pollDemandRule,
    proxiesAllowed: draft.proxiesAllowed,
    corporateRepresentatives: draft.corporateRepresentatives,
    proxyLimitPerHolder: draft.proxyLimitPerHolder,
    proxyDeadline: times.proxyDeadline,
    registrationOpens: times.registrationOpens,
    registrationCloses: times.registrationCloses,
    shareClassId: draft.shareClassId,
    votingEntitlement: draft.votingEntitlement,
    agenda: draft.agenda.map((item, index) => ({
      id: `ag_${index + 1}_${Date.now().toString(36)}`,
      order: index + 1,
      title: item.title,
      kind: item.kind,
      resolution: item.resolution || undefined,
      status: "pending" as const,
    })),
  });

  return { ok: true as const, id: meeting.id };
}
