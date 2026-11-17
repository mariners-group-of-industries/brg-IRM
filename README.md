# BRG1 IRM — Investor Relationship Management

Enterprise IRM for Bangladeshi companies. First module: **AGM/EGM Management**
(notices, eligibility, registration, voting, scrutiny, minutes). Multi-company
from day one, with server-enforced tenancy.

> See [docs/PRODUCT_ARCHITECTURE.md](docs/PRODUCT_ARCHITECTURE.md) for the
> route map, role matrix, design strategy and phase plan.

## Quick start

```bash
pnpm install
cp .env.example .env.local   # set IRM_SESSION_SECRET
pnpm dev                     # http://localhost:3100
```

Demo accounts (development mode — the login screen lists them too):

| Email | Role | Password |
| --- | --- | --- |
| `admin@demo.local` | Platform Super Admin | `Demo@1234` |
| `secretary@demo.local` | Company Secretary | `Demo@1234` |
| `viewer@demo.local` | Restricted Viewer | `Demo@1234` |

## What works today (demo build)

- Authenticated app shell: collapsible sidebar, company switcher, ⌘K palette,
  notifications, breadcrumbs, mobile drawer
- Dashboard with portfolio KPIs, upcoming meetings, turnout chart, approvals,
  activity feed
- Company list + detail
- AGM/EGM: searchable/filterable/exportable meeting list (TanStack Table),
  8-step create-wizard (drafts, per-step validation, review & publish),
  meeting overview
- Approvals queue, Activity Center, Analytics, Audit Logs
- Shareholder register: search, company/type/status filters, sorting, pagination,
  masked CSV export, create/edit and audited personal-data reveal
- Validated CSV register import with duplicate detection and all-or-nothing commit
- Holder profiles, share-class holdings, append-only allotment/transfer ledger,
  point-in-time balances and proxy/corporate representative review
- Shareholder portal (`/portal/login`): demo identity + OTP sign-in, published
  meetings, registration, live room, moderated text/audio questions and ballot receipts
- Portal account: holdings, registration/receipt/question history, proxy requests
  and withdrawal; approved demo proxies are scoped to their specific meeting
- Shareholder dashboard (`/portal`): current holdings, next meeting and agenda,
  registration/ballot metrics, personal activity and participation guide;
  `/portal/meetings` provides searchable upcoming/past and registered-only views
- Chair-controlled waiting/live/voting/ended states, with one open agenda stage
  at a time; configured deadlines and personal next-action guidance
- Private meeting documents: draft PDF/text upload, explicit publication,
  portal reader and real downloads; seeded extracts are labelled fictional
- English/Bangla portal navigation, instructions and errors, with a saved
  language preference; original document/user content keeps its source language
- Personal in-app notifications for registration, agenda voting, moderation,
  document publication and meeting changes, with unread and mark-read controls
- Investor / notices / reports / system routes are reserved and
  render explicit "Planned — Phase N" pages (no dead links)

**Demo mode**: all data is fictional and in-memory; it resets on restart.
Meeting creation works end-to-end; nothing is persisted yet. The Prisma
schema in [prisma/schema.prisma](prisma/schema.prisma) is the Phase 3 contract.

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` / `pnpm start` | Dev server / production server on :3100 |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest unit tests |
| `pnpm exec prisma validate` | Validate the target data model |

## Project layout

To validate a production build while the local dev server is running, use a
separate output directory (PowerShell):

```powershell
$env:IRM_BUILD_DIR = '.next-check'
pnpm build
Remove-Item Env:IRM_BUILD_DIR
```

The default development and production output remains `.next`.

```
src/app/(auth)…(app)   routes; (app)/ = authenticated shell
src/components/shell    sidebar, header, switcher, palette, notifications
src/components/ui       shadcn/ui primitives
src/lib                 session, permissions, demo store/data, format, zod
src/proxy.ts            auth gate (formerly "middleware", Next 16 naming)
prisma/schema.prisma    target data model (not wired yet)
docs/                   architecture
```

## Honest limitations of this build

- Authentication is a labelled demo (seeded users, SHA-256 hashes, no MFA).
  Do not deploy it as-is.
- Cross-tenant isolation is enforced in application code; Postgres RLS and
  composite-FK enforcement land with the Phase 3 migration.
- Shareholder workflows use a small fictional sample register, independent of
  the portfolio headline totals. Live CDBL synchronization, instrument uploads,
  certificate document generation, real OTP delivery and durable storage are not connected.
- Meeting eligibility uses configured share-class rules and freezes at first
  registration, rather than a certified immutable record-date snapshot. Weighted
  and class-based voting require further entitlement configuration and are disabled.
- Proxy limits/deadlines and registration windows come from meeting configuration;
  the wizard preserves those settings. Unpublished meetings remain private.
- Nothing is audit-logged to durable storage yet. Register mutations, imports,
  PII reveals and portal participation append in-memory audit metadata without
  secrets, OTPs, question content or ballot choices.
- Uploaded documents and notifications also reset on restart. PDF checks are
  bounded format checks, not full malware scanning. Notifications are in-app;
  email/SMS delivery and live video streaming are not connected.
