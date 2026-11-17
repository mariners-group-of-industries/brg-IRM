# AGENTS.md — BRG1 IRM (rebuilt 2026-11)

Single Next.js 16 app (App Router, Turbopack). TypeScript strict. Tailwind v4.
shadcn/ui on **Base UI** primitives — use `render={<Link…/>}`, never `asChild`.

## Commands
- `pnpm dev` / `pnpm start` — :3100
- `pnpm build` · `pnpm lint` (0 errors expected) · `pnpm typecheck` · `pnpm test`
- `DATABASE_URL=… pnpm exec prisma validate` — schema check (Prisma 6; v7 CLI is incompatible)

## Invariants
- **Authorization server-side, per route**: `await requirePermission("x.y")` from
  `src/lib/require-permission.ts`. UI only hides controls. Missing permission → **404** (not 403).
- Cross-tenant object access → **404**: filter by `session.companyIds` and call `notFound()`.
- Session: JWT cookie (`src/lib/session.ts`). Auth gate in `src/proxy.ts` (Next 16 name for middleware).
- Demo mode is intentional and labelled: in-memory store `src/lib/demo-store.ts` + `demo-data.ts`;
  meetings created via the wizard live in memory only. Do not quietly add persistence — the
  Phase 3 DB wiring is deliberate.
- Legally configurable rules (quorum, poll demand, proxy limits) are never code constants —
  they are configuration (`pollDemandRule`, wizard fields).
- Audit every state change (Phase 3+): same transaction. Never log secrets/OTPs/ballot choices.
- Design tokens live in `src/app/globals.css`; palette is the brief (navy #17243B, teal #0F8A80).
  Read `docs/PRODUCT_ARCHITECTURE.md` before new screens.
- Tests: vitest, `src/**/*.test.ts`. Run them before reporting work done.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
