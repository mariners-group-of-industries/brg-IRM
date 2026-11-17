import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { ParticipantKind } from "./types";
import { getParticipantById } from "./demo-store";

/**
 * Shareholder-portal session (demo).
 *
 * Separate cookie from the staff session on purpose: the portal is public
 * surface and a shareholder session must never unlock the admin shell.
 * Uses the same dev secret with a distinct cookie name; production derives
 * audience/issuer claims and rotates keys.
 */
export const PORTAL_COOKIE = "irm_portal_session";
const secret = new TextEncoder().encode(
  process.env.IRM_SESSION_SECRET ?? "irm-dev-only-secret-change-me",
);

export interface PortalSession {
  participantId: string;
  kind: ParticipantKind;
  companyId: string;
  name: string;
  subjectName: string;
  boId: string;
  eligibleShares: number;
  votingRights: number;
}

export async function createPortalSession(session: PortalSession) {
  const token = await new SignJWT({
    kind: session.kind,
    companyId: session.companyId,
    name: session.name,
    subjectName: session.subjectName,
    boId: session.boId,
    eligibleShares: session.eligibleShares,
    votingRights: session.votingRights,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.participantId)
    .setAudience("irm-portal")
    .setIssuer("irm")
    .setIssuedAt()
    .setExpirationTime("4h") // meetings are short; portal sessions are short-lived
    .sign(secret);

  const store = await cookies();
  store.set(PORTAL_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 4,
  });
}

export async function clearPortalSession() {
  const store = await cookies();
  store.delete(PORTAL_COOKIE);
}

export async function getPortalSession(): Promise<PortalSession | null> {
  const store = await cookies();
  const token = store.get(PORTAL_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { audience: "irm-portal", issuer: "irm" });
    const participant = getParticipantById(String(payload.sub));
    if (!participant || participant.companyId !== payload.companyId) return null;
    return { participantId: participant.id, kind: participant.kind, companyId: participant.companyId, name: participant.name, subjectName: participant.subjectName, boId: participant.boId, eligibleShares: participant.eligibleShares, votingRights: participant.votingRights };
  } catch {
    return null;
  }
}
