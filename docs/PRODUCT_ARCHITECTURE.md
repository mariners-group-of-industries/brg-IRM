# BRG1 IRM — product architecture

BRG1 IRM is a multi-company Investor Relationship Management platform for
Bangladeshi companies. The first functional module is **AGM/EGM Management**;
the architecture is designed so the remaining modules
(Company Management, Investor Management, Shareholder Registry, Shareholding,
Dividends, Documents, Communications, Support, Reports, Compliance) land as
new route groups without restructuring.

> **Investors and legal shareholders are not the same entity.**
> `Investor` (KYC-grade, CRM view) and `Shareholder` (legal register) have
> separate models and lifecycles, joined only through `ShareholderInvestor`.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, RSC), TypeScript strict |
| UI | Tailwind CSS v4, shadcn/ui (Base UI primitives), Lucide icons |
| State | TanStack Query + TanStack Table, React Hook Form + Zod, Zustand (sparingly) |
| Auth (demo) | HMAC-signed JWT in httpOnly cookie, seeded users |
| Auth (target) | Database sessions + MFA, company-scoped memberships |
| Data (demo) | Isolated in-memory store (`src/lib/demo-store.ts`), resets on restart |
| Data (target) | PostgreSQL + Prisma 6 — see `prisma/schema.prisma` |
| Charts | Recharts |

## Route map

```
/                     → redirect (session-aware)
/login                → sign in (demo accounts listed on the page)
(app)                 → authenticated shell: collapsible sidebar, header with
                        breadcrumbs, company switcher, ⌘K palette, notifications
  /dashboard          → portfolio dashboard: KPIs, upcoming meetings, turnout,
                        approvals queue, activity feed
  /activity           → Activity Center (cross-company audit-style feed)
  /companies          → list + /companies/[id] detail (registry summary)
  /shareholders       → legal register: search, company/type/status filters,
                        sorting, pagination and masked CSV export
    /new              → create individual or corporate legal holder
    /import           → CSV validation, row diagnostics, atomic demo import
    /[id]             → masked profile, audited reveal/edit, share-class balances,
                        allotments, transfers, ledger and appointments
    /authorizations   → proxy / corporate instrument review and revocation
  /shareholding       → company-scoped and point-in-time holding balances + ledger
  /governance/meetings
    /                 → list: search, type/status filters, sortable columns,
                        pagination, column visibility, CSV export
    /new              → 8-step create-wizard (autosaved draft, per-step
                        validation, review screen)
    /[id]             → meeting overview (details, agenda, registration meters)
  /operations/approvals → approve/reject queue (demo: session-local decisions)
  /reports/analytics    → turnout chart, completed-meeting table
  /reports/audit        → append-only audit view
  /investors … /system/integrations → reserved routes (see below)
/portal/login         → separate shareholder identity + labelled demo OTP flow
/portal               → shareholder dashboard: holdings, next meeting, agenda preview,
                        participation, personal activity and meeting guide
/portal/dashboard     → alias redirect to /portal
/portal/meetings      → published meetings; upcoming/past, search and registered filter
/portal/account       → holdings, registrations, ballot references, question status,
                        proxy requests and withdrawal
/portal/meetings/[id]  → notice facts, eligibility, agenda and registration
  /room               → registered participation, ballots, polls, questions/audio
/portal/documents     → published meeting documents with private reader/download
/portal/notifications → personal in-app events, unread state and mark-read actions
/governance/documents → tenant-scoped draft upload, publication and withdrawal
```

Routes not yet built render an explicit **“Planned, not yet built — Phase N”**
page naming the scope. No dead links, no fake features.

## Roles and permissions (summary)

Permissions are dot-scoped strings in `src/lib/permissions.ts`; roles map to
permission sets and are checked **server-side**. The UI hides controls for
convenience only. Tenancy: Platform Super Admin sees all companies; every
other role is restricted to `session.companyIds`; cross-tenant object access
returns **404** (not 403) so ids cannot be probed.

| Role | Flavour |
| --- | --- |
| Platform Super Admin | Everything, including role management and settings |
| Company Admin | All company operations; cannot manage roles/integrations |
| Company Secretary | Meeting lifecycle, notices, approvals, audit read |
| Meeting Chair / Host | Live-room control, documents |
| Board Member | Read + approve resolutions/minutes |
| Moderator | Live-room moderation, support queue |
| Scrutinizer | Read results/reports/audit |
| Support Officer | Intake/support/communications read |
| Restricted Viewer | Read-only overview |

## Design system

- Light-first tokens (`src/app/globals.css`): navy `#17243B` text, `#F8FAFC`
  background, white surfaces, `#182B49` primary action, `#0F8A80` teal brand,
  `#E5EAF0` borders, `#64748B` secondary text; semantic success/warning/info
  pairs; dark-mode token set included for later.
- Inter Variable (Latin) + Noto Sans Bengali Variable, 4/8px spacing rhythm,
  restrained radius (6–8px), minimal elevation (3 shadow levels).
- The shell sidebar collapses to an icon rail (desktop) and becomes a drawer
  on mobile; tables degrade to horizontal scroll; nothing is decorative.

## Demo mode (current build)

Everything data-driven runs on a clearly-labelled in-memory demo dataset of
four fictional Bangladeshi companies. Meeting creation works end-to-end into
that store. Nothing is written to disk or a database; data resets on restart.
Approvals decide visually within the session.
`docs/PRODUCT_ARCHITECTURE.md` and the login screen label this explicitly.

### Shareholder registry and portal demo

`shareholder-store.ts` owns a separate in-memory legal register seeded from the
fictional dataset. Investor CRM records remain separate. Duplicate BO/folio,
TIN and normalized name + father checks are scoped to the issuing company;
legal account IDs and holder types are immutable. Personal fields are masked
before they reach a client; authorized operators explicitly reveal them with
an audit entry. CSV export remains masked and escapes spreadsheet formulas.

Imports validate every row, preserve leading-zero IDs and stage the entire
batch before committing. Allotments append an entry; transfers append balanced
debit/credit entries together, reject insufficient balances and cross-company
recipients, and never revise earlier holdings. Backdated entries preceding an
involved account's later entry are rejected. Transaction references identify
the supporting instrument; certificate documents are not generated.

Proxy rules, limits, deadlines and registration windows are meeting
configuration (preserved by the wizard). Signed instrument references can be
submitted by staff or the individual holder, then approved/rejected by
authorized staff. Holders can withdraw their own appointments. New identity
provisioning, instrument uploads and live CDBL synchronization are not wired.
Only the listed demo identities can sign in; an approved appointment for a
listed proxy/representative authorizes that identity for its specified meeting.

Portal and staff JWTs have separate audiences. Portal reads refresh active
register status; suspended/closed holders cannot keep using a stale cookie.
Unpublished meetings are private. Participation requires registration,
record-date eligibility and (for delegates) an approved meeting-specific
appointment. Registration, attendance, ballots and poll demands deduplicate
by the legal BO account, including its proxy identities. Record-date shares
are frozen at first registration in this demo; this is not a certified
record-date snapshot. Weighted/class-based voting is unavailable until its
explicit entitlement configuration is wired.

Mutations, reveals, exports and portal participation append audit metadata
in the same synchronous in-memory operation. No OTPs, ballot choices or
question contents enter audit/activity logs. This does not replace database
transactions, durable audit retention or production authorization hardening.

The shareholder dashboard at `/portal` uses the authenticated participant's
company and legal BO account. It shows current holdings by class, the next
published meeting, record-date eligibility, registration and ballot progress,
personal activity, appointment/question summaries and an AGM participation
guide. `/portal/meetings` separates upcoming/past meetings with search and a
registered-only filter. Delegate meeting access follows approved instruments;
personal ballot receipts and questions remain specific to the submitting actor.
The supplied IDLC 35th AGM shareholder manual informed the participation guide
and agenda/meeting-room entry points; its historical login rules do not replace
the portal's register checks and OTP step. Data remains an in-memory demo.

Dashboard presentation puts the meeting and its registration/join action before
compact account metrics on mobile. The featured meeting includes a date/time
block and an accessible progress bar driven by recorded account ballots.
Demo explanations use native expandable disclosures, and motion respects
`prefers-reduced-motion`. The `(dashboard)` route group supplies a loading
skeleton only for `/portal`, keeping meeting detail authorization outside that
streaming boundary.

## Portal meeting workflow

The chair explicitly starts and ends a meeting; scheduled time does not silently
open participation. Registered shareholders can enter a waiting room. The live
chair selects one agenda stage (proposal, seconding, poll demand or voting),
closing every other agenda. Server actions enforce lifecycle, stage, eligibility,
registration and legal-account duplicate checks. Ending closes all controls and
cannot be reversed. The portal polls state; the video panel is labelled simulated.

The dashboard and detail page show only configured registration/proxy deadlines
and explain the participant's next action or why an action is unavailable.
Seconding requires a proposal from a different legal BO account. Private ballot
choices and references remain scoped to the submitting actor, including when
another identity represents the same legal account.

Documents use `documents.upload` and `documents.publish` permissions. Drafts stay
private until explicit publication. Publishing the first notice for an unpublished
meeting additionally requires `meetings.publish`. Portal readers and byte-download
routes check company, publication and delegate authorization; unauthorized IDs
return 404. PDF/text uploads are bounded to 5 MB with content checks, not full
malware scanning. Files remain in memory. Seed notices and the annual-report
extract are explicitly fictional plain text, not statutory or audited documents.

English/Bangla navigation, instructions, controls and errors share a dictionary.
A validated language cookie preserves the preference across login and navigation;
it grants no authorization. Original names, agenda titles and document content
keep their source language unless translated content is provided.

In-app notifications cover publication, registration, configured reminders,
meeting changes, voting stages and question review. Reads and mark-read actions
are restricted to the current participant and approved meeting appointments;
client query caches include the participant ID. Events and read-state changes
append audit metadata synchronously. There is no outbound email/SMS delivery.
All meeting, document and notification state resets with the demo process.

## Security posture (target vs demo)

| Area | Demo build | Target (Phase 3+) |
| --- | --- | --- |
| Auth | seeded users, SHA-256 passwords, JWT cookie | DB credentials + MFA + revocation |
| Audit | seed feed + append-only in-memory registry/portal metadata | same-transaction audit writes, append-only trigger |
| Tenancy | session `companyIds` + 404 | same + Postgres RLS via composite FKs |
| Voting | BO-account duplicate checks, frozen demo weight, receipt refs | transactional, duplicate-proof, receipt refs |
| PII | masked registry fields; audited explicit reveal | masked by default; unmasking is audited |
| Files | in-memory audio/PDF/text with content checks and scoped access | malware scanning, private object storage, signed URLs |
| Legal rules | wizard configuration fields | same + per-company overrides in `settings` |

## Phases

1. ✅ Setup & design foundations (this build)
2. ✅ Application shell + dashboard
3. ⏳ Auth, company foundation, RBAC wiring (Postgres + Prisma)
4. ⏳ AGM/EGM administrative foundation (list, wizard, overview — UI done now)
5. ⏳ Shareholder portal, proxies, registration, attendance, live room
6. ⏳ Voting engine, poll demands, scrutiny, results, reports, minutes
7. ⏳ Hardening: tests, accessibility, security review, deployment

## Legally sensitive configuration

Quorum, poll-demand thresholds, vote changes and proxy limits are **never**
code constants. They live in wizard configuration today and will move to
per-company legal settings in Phase 3.
