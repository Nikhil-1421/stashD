# Architecture

Status: milestone 1 (foundation). Updated 2026-11-04.

## Overview

A single-page React application talking directly to Supabase (Auth + PostgreSQL with Row Level
Security + Storage). There is no custom API server; authorization is enforced in the database, and
the browser holds only the public anon key. Netlify serves the static build.

```
Browser (React SPA) ──supabase-js──▶ Supabase Auth (GoTrue)
                    ──PostgREST───▶ PostgreSQL (RLS)  ◀── migrations (supabase/migrations)
                    ──Storage────▶ Object storage (user uploads, later)
External catalog providers ◀── adapters (phase 9), never from the service role
```

## Stack (verified versions, see docs/DECISIONS.md)

| Concern | Choice |
| --- | --- |
| Build / dev | Vite 8, TypeScript 7 (strict), oxlint |
| UI | React 19, Tailwind CSS 4 (tokens in `src/styles/index.css`), small in-repo primitives (`src/components/ui`) |
| Routing | React Router 8 (data router, library mode) |
| Server state | TanStack Query 5 |
| Client state | React state/context; Zustand only when a cross-page store is justified (not yet) |
| Validation | zod 4 (env, forms, later import parsers) |
| Backend | Supabase: Auth, Postgres 17, RLS, migrations via the Supabase CLI |
| Tests | Vitest 5 + Testing Library (unit/component), pgTAP (database/RLS), Playwright (E2E, phase 10) |
| Hosting | Netlify (`netlify.toml`) |

## Source layout

```
src/
  app/            router.tsx (route table), providers.tsx, navigation.ts
  components/
    ui/           Button, Input, FormField, Card, Alert, Spinner, Skeleton  — presentational only
    layout/       AppShell, Sidebar, MobileNav, TopBar, PageHeader
  features/       one folder per domain; each owns its api.ts, pages, hooks, tests
    auth/         session context, guards, auth pages, validation
    profile/      profile queries + Settings page
    entitlements/ capability policy (free plan today)
    dashboard/
    sets/         user_set_overview queries, custom set create/edit/delete, Collections pages
    cards/        card + variant + printing CRUD, checklist editor sections
    catalog/      domain/: pure helpers shared with SQL (card number sort key, slug)
  lib/            env.ts (validated env), supabase/ (client + DB types), utils.ts
  hooks/          generic React hooks
  pages/          non-feature pages (planned sections, 404, route error)
  styles/         Tailwind entry + design tokens
  test/           Vitest setup + render helpers
supabase/
  config.toml     local stack config (email confirmations ON, Vite dev URL)
  migrations/     ordered SQL migrations (the schema source of truth)
  tests/database/ pgTAP tests (RLS isolation)
docs/             living documentation (this folder)
```

## Layering rules

1. **UI** (`components`, feature pages) renders state and calls feature APIs. No direct `fetch`.
2. **Domain logic** (completion math, slot math, parsers, copy formatting) lives in pure TypeScript
   modules under the owning feature (`features/<x>/domain/`), unit-tested, with no React or Supabase
   imports. First examples: `features/catalog/domain/cardNumber.ts`, `slug.ts`.
3. **Persistence** goes through `features/<x>/api.ts` using the typed Supabase client. Query keys
   are declared next to the API (`profileKeys`).
4. **External providers** (phase 9) sit behind `features/catalog/providers/<name>.ts` implementing
   one `CatalogProvider` interface; failures degrade to manual/custom flows.
5. **Entitlements**: every feature gate asks `useEntitlements().can(...)`; no plan checks elsewhere.

## Cross-cutting behaviours

- **Environment**: `src/lib/env.ts` validates `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` /
  `VITE_APP_URL` without throwing. If Supabase is unconfigured, every auth-dependent route renders
  `SetupRequiredPage` with the exact problems. A key that looks like a service-role key is rejected.
- **Auth**: `AuthProvider` mirrors the supabase-js session (persisted in localStorage, auto-refreshed,
  PKCE flow) into a discriminated `AuthState`. `ProtectedRoute` / `PublicOnlyRoute` gate routes.
  Email verification and password recovery links land on `/auth/callback` and `/reset-password`,
  where supabase-js exchanges the code for a session.
- **Profiles**: created by a database trigger on sign-up; owner-only RLS; client only ever
  reads/updates its own row.
- **Security**: service-role key never in the client; RLS on every user table; no frontend-only
  filtering counts as security; share links (phase 8) will use dedicated token-scoped functions.
- **Accessibility**: semantic landmarks, skip link, one focus-ring style, `aria-invalid`/`describedby`
  wiring in forms, 44 px+ touch targets in mobile nav, `prefers-reduced-motion` respected.
- **Performance** (later phases): pagination/virtualisation for large sets, debounced search,
  batched writes for binders; indexes documented per table in `docs/DATABASE_SCHEMA.md`.

## Planned domain model (phase 2+)

See `docs/DATABASE_SCHEMA.md` for the ERD. The key separation (product invariants 1–7): catalog
(`games`, `catalog_sets`, `catalog_cards`, `card_printings`) vs. user layer (`user_sets`,
`user_set_requirements`, `collection_items`, `binders`, `binder_pages`, `binder_placements`,
`wishlist_items`, `trade_items`) vs. sharing (`collection_shares`).
