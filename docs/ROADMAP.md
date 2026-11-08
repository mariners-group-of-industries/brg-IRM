# Roadmap

Phases are delivered in order. Each phase ends with working code, passing tests, browser verification and updated docs.

## Phase A: Foundation (complete, 2026-11-05)

Delivered: monorepo, PostgreSQL and Prisma, staff authentication, tenants and companies, RBAC, the design system, the application shell, the admin dashboard, and the audit log.

| Definition of done | Status | Evidence |
|---|---|---|
| Application launches locally | Done | API on :4000, web on :3100 |
| Frontend connects to backend | Done | Next.js rewrite to `/api/v1` |
| Database migrations work | Done | `init_foundation` applied to dev and test databases |
| Authentication operational | Done | Login, logout, session expiry, lockout, CSRF |
| Tenant and company isolation enforced | Done | 14 isolation tests |
| Roles and permissions implemented | Done | 9 roles, 36 permissions, grant rules |
| Admin layout works | Done | Desktop and mobile drawer |
| Dashboard uses real backend data | Done | Scoped `/dashboard/summary` |
| Automated tests pass | Done | 11 shared unit, 37 API integration and 22 Playwright tests |
| Basic Playwright checks pass | Done | Desktop 1440px and Pixel 7, including overflow checks |
| Setup documentation complete | Done | README, CLAUDE.md, docs/ |

Known limits:
- Staff MFA was delivered in Phase B.
- Users are created with an admin-set initial password, because email invitations need an email provider.
- "Add member" used two calls, so a failure could leave an account without a role. Phase B replaced it with one transactional endpoint.

## Phase B: Shareholder system (complete, 2026-11-05)

Delivered:
- Share classes, shareholders (individual and corporate), BO and folio accounts, register contacts, and versioned holdings.
- A register import pipeline for CSV and XLSX: upload, column mapping with suggestions, row validation, duplicate detection, preview, confirmed commit, cancel and history.
- Corporate representatives and proxies with documents, four-eyes approval, rejection and revocation.
- Shareholder, representative and proxy sign-in by one-time code, plus a participant portal.
- Staff two-step verification (TOTP) with recovery codes and optional enforcement for admins.
- PII masking, private file storage, and PostgreSQL row-level security on all shareholder tables.

| Acceptance criterion | Status | Evidence |
|---|---|---|
| 50,000-row register previews in under 30 s | Done | 9.5 s preview, 31.5 s commit. A re-import of the same file found 50,000 unchanged rows (`apps/api/scripts/perf-import.mjs`). |
| Per-row errors, nothing overwritten without confirmation, history kept | Done | `register.test.ts`: errors, duplicates, Excel precision loss, confirmation, versioning, immutable history trigger |
| OTP sign-in only to a verified contact; failed lookups reveal nothing | Done | `participants.test.ts`: identical responses, unverifiable decoy challenges, attempt and request limits |
| Proxy outside scope or past expiry cannot act | Done | Expired, pending and revoked proxies and representatives tested |
| RLS blocks cross-company reads even with hand-written SQL | Done | `register.test.ts`: raw SQL count and a cross-company insert under the restricted role |

Test totals: 18 shared unit tests, 71 API integration tests and 30 Playwright tests, on desktop and mobile.

Known limits:
- **Message delivery.** Sign-in codes go to a development outbox page. Real SMS and email providers are needed before production, and the API refuses to boot in production without one.
- **Storage.** Files use the local-disk storage driver. The S3-compatible driver is designed behind the same interface but not built, because no object store is available here.
- **Meeting link for proxies.** Proxies carry a free-text meeting reference. Phase C adds the meeting link and makes it mandatory.
- **RLS coverage.** RLS applies inside the API's company-scoped transactions, which switch to the restricted `irm_app` role. For defence in depth, production should also run the API under a non-owner database role. See DEPLOYMENT.md.
- **Approval needs two admins.** Four-eyes approval needs a second administrator with authorization rights. A company with a single admin cannot approve authorizations until a group admin or second admin is added.
- **Register contacts.** Contacts imported from the register count as verified. Manual contact editing is not built yet.

## Phase C: Meeting management (complete, 2026-11-05)

Delivered:
- AGM and EGM meetings: virtual or hybrid, schedule in Dhaka time, record date and notice text.
- A server-enforced state machine from Draft to Archived, with readiness checks, optimistic versioning, required reasons for withdrawal, and an immutable history.
- An agenda with ordinary and special resolutions, proposer and seconder requirements, reordering, and locking once registration opens.
- Governance rules (all configuration points in VOTING_RULES.md). They are validated, audited with before and after values, and locked once the meeting is live.
- Meeting documents (PDF only), published to shareholders separately, plus board member and moderator assignment.
- A record-date snapshot taken when registration opens. Voting entitlements are created from it, and both are immutable.
- Participant registration by shareholders, corporate representatives and proxies, with eligibility explained.
- Proxies are now linked to a real meeting. A proxy gives no rights at any other meeting.
- A control center for staff, and meetings in the shareholder portal with Bangla labels.

| Acceptance criterion | Status | Evidence |
|---|---|---|
| Invalid transitions are rejected; concurrent changes cannot both win | Done | `meetings.test.ts`: off-graph transitions, stale `expectedVersion` |
| Configuration and operation are separated | Done | Company Admin publishes and opens registration; only the Meeting Admin starts, pauses and ends |
| Agenda and notice locked after registration; rules locked when live | Done | `meetings.test.ts` |
| Snapshot uses holdings as of the record date and cannot change | Done | Totals checked against the seeded register; update and delete blocked by triggers; a record date before any register is refused |
| Only eligible people register, for exactly what they hold or represent | Done | Shareholder and proxy registration; a proxy for another meeting has no options |
| Participants see only published meetings and published documents | Done | `meetings.test.ts`, Playwright |

Test totals: 26 shared unit tests, 86 API integration tests and 36 Playwright tests.

Fixed during Phase C:
- A full register import now writes a zero-share row when it closes a holding. Before this, a snapshot taken for a later record date could have reused the old balance.
- A wrong one-time code no longer sends a shareholder to the staff sign-in page. The web client now treats a 401 from a sign-in step as a normal error.

Known limits:
- Starting a meeting changes its state only. The live meeting room, video and attendance arrive in Phase D.
- Proxy lodgement deadlines and per-proxy limits are stored in the rules but not yet enforced. Enforcement comes with Phase D registration and attendance.
- Shareholders are not sent notice emails or SMS, because no provider is configured. They see published meetings in the portal.

## Phase D: Live AGM experience (complete, 2026-11-08)

Delivered:
- Video provider adapter: `ZoomProvider` (HS256 Zoom Meeting SDK JWT signing) and a clearly labelled `SimulatorProvider` for local development.
- Live attendance tracking: room join, heartbeat, explicit leave, SSE disconnect cleanup, stale-session cleanup on API startup, online headcounts and represented share-vote weights.
- Staff Live Console (`Live console` tab): attendance and vote-weight summary, Zoom meeting ID configuration, active agenda item selection, `Proposal` / `Seconding` / `Poll demand` stage toggles, chair acceptance in `COLLECT_ALL` mode, and live announcements.
- Atomic proposals and seconding: partial unique index `motions_one_accepted` prevents concurrent race conditions; enforces `minHolding`, `excludeProposer` and proxy speaking rules.
- Poll demand recording and configurable threshold evaluation (`ANY_MEMBER`, `MEMBERS_COUNT`, `VOTING_RIGHTS_PERCENT`), reported to the chair without hard-coded legal constants.
- Written (English and Bangla) and audio (1–180 s, magic-byte validated WebM/OGG/MP4/WAV in private storage) question submission.
- Moderator dashboard (`Moderation` tab): status and Bangla filters, inline audio playback, approve, reject (reason required), and forward to the board, with every action recorded in `moderation_actions` and the audit log.
- Board room view (`Board view` tab): board video stage, attendance summary, accepted proposers and seconders, announcements, and live feed of forwarded written and audio questions.
- Bilingual shareholder meeting room (`/portal/meetings/[mid]/room`): 16 px minimum body copy, 44 px primary buttons, capacity switcher for multi-entitlement holders/representatives, visible closed stages (`Not open yet`), written and `MediaRecorder` voice questions, and zero admin clutter.
- Real-time pointer events over authenticated, meeting-scoped Server-Sent Events (`/live/events`), with clients refetching authoritative PostgreSQL state over REST.
- Proxy governance rule enforcement (`proxy.lodgementDeadlineHours` and `proxy.maxPerProxy`).

| Acceptance criterion | Status | Evidence |
|---|---|---|
| Video simulator clearly labelled; Zoom SDK JWT signed and verified | Done | `live.test.ts`, `phase-d.spec.ts` (`Simulated video (development only)`) |
| Concurrent proposals cannot both win | Done | `motions_one_accepted` partial unique index; `Promise.all` race returns `[200, 409]` in `live.test.ts` |
| Poll demand threshold follows meeting configuration | Done | `live.test.ts` (`3%` voting-rights threshold crossed across two holders), `packages/shared/src/live.test.ts` |
| Text (Bangla/English) and audio questions moderated and forwarded to board | Done | `live.test.ts` (text, Bangla, magic-byte audio upload, reject reason, board visibility), `phase-d.spec.ts` |
| Cross-company and unregistered access blocked; RLS enforced on all Phase D tables | Done | `live.test.ts` (404 cross-tenant, 403 unregistered), `20261105150000_phase_d_live` RLS policies |
| Responsive layout on desktop and mobile with no horizontal overflow | Done | `phase-d.spec.ts` on Desktop 1440 px and Pixel 7 (`expectNoHorizontalOverflow`) |

Test totals: 34 shared unit tests, 97 API integration tests and 40 Playwright tests, on desktop and mobile.

Fixed during Phase D:
- Proxy lodgement deadlines (`proxy.lodgementDeadlineHours`) and per-proxy representation caps (`proxy.maxPerProxy`) from Phase C governance rules are now enforced during proxy creation/approval and meeting registration.
- Direct navigation or page reload on deep shareholder portal routes (`/portal/meetings/[mid]` and `/portal/meetings/[mid]/room`) now hydrates the CSRF token automatically before state-changing requests.

Known limits:
- **Live Zoom account.** `ZoomProvider` signs standard Zoom Meeting SDK JWTs, but has not been tested against a live Zoom account here because credentials are not provisioned in local development.
- **In-process event bus.** `MeetingEventsService` fans out SSE pointer events within one API process. Multi-instance deployments will need a Redis pub/sub bridge behind `MeetingEventsService` (PostgreSQL already holds all authoritative state).
- **Ballot casting.** Voting sessions, ballot casting and weighted tallying are delivered next in Phase E.

## Phase E: Secure voting (next)

Entitlements, voting sessions, ballot casting with idempotency, weighted tally, hash-chained vote audit, results release, and privileged access grants. The required test list is in `VOTING_RULES.md`.

## Phase F: Reports and hardening

PDF and Excel reports, minutes, accessibility audit, load test, security testing, a backup and restore drill, and deployment readiness.
