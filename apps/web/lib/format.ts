import { COMPANY_TYPE_LABELS, type CompanyType } from '@irm/shared';

const TZ = 'Asia/Dhaka';

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  }).format(new Date(iso));
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ }).format(
    new Date(iso),
  );
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  return formatDate(iso);
}

export const formatNumber = (n: number) => new Intl.NumberFormat('en-IN').format(n);

export function companyTypeLabel(t: string): string {
  return COMPANY_TYPE_LABELS[t as CompanyType] ?? t;
}

/** Human labels for audit actions. Unknown actions fall back to the raw key. */
const AUDIT_LABELS: Record<string, string> = {
  'auth.login': 'Sign-in',
  'auth.logout': 'Sign-out',
  'access.denied': 'Access denied',
  'tenant.create': 'Tenant created',
  'tenant.update': 'Tenant updated',
  'company.create': 'Company created',
  'company.update': 'Company updated',
  'user.create': 'User created',
  'user.disable': 'User disabled',
  'role.assign': 'Role granted',
  'role.revoke': 'Role revoked',
  'share_class.create': 'Share class created',
  'shareholder.pii_view': 'Shareholder details viewed',
  'register_import.upload': 'Register uploaded',
  'register_import.validate': 'Register validated',
  'register_import.commit': 'Register import committed',
  'register_import.cancel': 'Register import cancelled',
  'corporate_rep.create': 'Representative added',
  'corporate_rep.approve': 'Representative approved',
  'corporate_rep.reject': 'Representative rejected',
  'corporate_rep.revoke': 'Representative revoked',
  'proxy.create': 'Proxy added',
  'proxy.approve': 'Proxy approved',
  'proxy.reject': 'Proxy rejected',
  'proxy.revoke': 'Proxy revoked',
  'authorization.document_download': 'Authorization document downloaded',
  'participant.otp_request': 'Sign-in code requested',
  'participant.otp_verify': 'Sign-in code rejected',
  'participant.login': 'Shareholder sign-in',
  'participant.access_revoked': 'Participant access removed',
  'auth.login_password': 'Password accepted',
  'auth.mfa_verify': 'Two-step code checked',
  'auth.mfa_setup_started': 'Two-step setup started',
  'auth.mfa_enabled': 'Two-step verification on',
  'auth.mfa_disabled': 'Two-step verification off',
  'auth.mfa_disable': 'Two-step disable failed',
  'meeting.create': 'Meeting created',
  'meeting.update': 'Meeting details changed',
  'meeting.rules_update': 'Governance rules changed',
  'meeting.transition': 'Meeting status changed',
  'meeting.staff_update': 'Meeting staff changed',
  'meeting.register': 'Participant registered',
  'agenda.create': 'Agenda item added',
  'agenda.update': 'Agenda item edited',
  'agenda.delete': 'Agenda item removed',
  'agenda.reorder': 'Agenda reordered',
  'meeting_document.upload': 'Meeting document uploaded',
  'meeting_document.publish': 'Meeting document published',
  'meeting_document.unpublish': 'Meeting document unpublished',
  'meeting_document.remove': 'Meeting document removed',
  'meeting.video_room_set': 'Video room updated',
  'agenda.set_active': 'Active agenda item changed',
  'agenda.stage_toggle': 'Agenda stage toggled',
  'motion.accept': 'Motion accepted',
  'motion.submit': 'Motion submitted',
  'motion.accept_staff': 'Motion accepted by chair',
  'poll.demand': 'Poll demanded',
  'question.submit': 'Written question submitted',
  'question.submit_audio': 'Audio question submitted',
  'question.moderate': 'Question moderated',
  'meeting.announcement_create': 'Announcement published',
  'meeting.announcement_retract': 'Announcement withdrawn',
  'voting.session_open': 'Voting session opened',
  'voting.session_close': 'Voting session closed and sealed',
  'voting.results_release': 'Voting results released',
  'vote.cast': 'Ballot cast',
  'vote.rejected': 'Ballot rejected',
  'proxy.precedence_superseded': 'Proxy ballot superseded by shareholder attendance or direct vote',
  'privileged_grant.request': 'Scrutineer access requested',
  'privileged_grant.approve': 'Scrutineer access approved',
  'privileged_grant.reject': 'Scrutineer access rejected',
  'privileged_grant.revoke': 'Scrutineer access revoked',
  'voting.individual_inspection': 'Individual ballots inspected',
};
export const auditLabel = (a: string) => AUDIT_LABELS[a] ?? a;

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

/** Share counts arrive as strings (they can exceed 2^53). Formatted with South Asian grouping. */
export function formatShares(s: string | null | undefined): string {
  if (s === null || s === undefined || s === '') return '—';
  try {
    return new Intl.NumberFormat('en-IN').format(BigInt(s));
  } catch {
    return s;
  }
}

/** Exact bigint-safe percentage string (1 decimal place) relative to voting base. */
export function formatVotePct(votes: string | null | undefined, base: string | null | undefined): string {
  if (!votes || !base) return '0.0%';
  try {
    const v = BigInt(votes);
    const b = BigInt(base);
    if (b <= 0n) return '0.0%';
    const tenths = (v * 1000n) / b;
    return `${(Number(tenths) / 10).toFixed(1)}%`;
  } catch {
    return '0.0%';
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** <input type="datetime-local"> value in Dhaka time to an ISO string with offset. */
export const dhakaLocalToIso = (local: string) => (local ? `${local}:00+06:00` : '');

/** ISO string to a <input type="datetime-local"> value in Dhaka time. */
export function isoToDhakaLocal(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 6 * 3600_000);
  return d.toISOString().slice(0, 16);
}
