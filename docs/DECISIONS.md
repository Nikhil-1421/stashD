# Decisions

Format: context → decision → consequences. Newest last. Keep entries short; link to code/docs.

## D-001 · Framework-free reference will be rebuilt, not ported (2026-11-04)
**Context.** The reference app is one HTML file with inline vanilla JS, embedded data and
localStorage persistence (see `docs/REFERENCE_APPLICATION_ANALYSIS.md`). Nothing in it can be reused
as application code; the embedded logos have unknown licensing.
**Decision.** Rebuild on the preferred stack. Preserve behaviours, not code or assets.
**Consequences.** No migration path for the author's localStorage data in milestone 1; an importer for
the `mct-v3` format can be a later convenience if wanted.

## D-002 · Vite 8 + React 19 + TypeScript 7 + oxlint (2026-11-04)
**Context.** `npm create vite@latest` (create-vite 9.3) now scaffolds TypeScript 7.0 with oxlint
instead of ESLint. `typescript-eslint` 8.72 declares `typescript: ">=4.8.4 <6.1.0"`, so ESLint's
TypeScript stack does not support TS 7.
**Decision.** Follow the scaffold: TypeScript ~7.0.2 with `strict`, `noUncheckedIndexedAccess`,
`erasableSyntaxOnly`; lint with oxlint (`react`, `typescript`, `oxc` plugins, correctness as errors).
**Consequences.** Fewer dev dependencies and fast lint; some type-aware ESLint rules are not
available. Revisit if typescript-eslint adds TS 7 support and a rule is genuinely missed.

## D-003 · React Router 8 in library ("data router") mode (2026-11-04)
**Context.** v8.0.0 (2026-06) dropped `react-router-dom`, requires React ≥ 19.2.7, Node ≥ 22.22, Vite
≥ 7 and is ESM-only. `RouterProvider` comes from `react-router/dom`, everything else from
`react-router`.
**Decision.** Use `createBrowserRouter` with route objects in `src/app/router.tsx`; no framework
mode / SSR (static Netlify hosting, auth is client-side).
**Consequences.** Simple deployment; loaders/actions can be adopted per route later if useful.

## D-004 · Tailwind 4 tokens + hand-rolled primitives instead of a shadcn install (2026-11-04)
**Context.** shadcn's CLI is interactive and pulls Radix dependencies; milestone 1 needs only a
handful of controls.
**Decision.** Define all tokens in `@theme` (`src/styles/index.css`) and write small primitives with
`class-variance-authority`. Add shadcn/Radix pieces (dialog, popover, sheet) individually when a
feature needs accessible overlays.
**Consequences.** Tiny bundle now; consistent naming (`bg-canvas`, `text-fg-muted`, `border-line`).

## D-005 · Supabase env is validated, never assumed (2026-11-04)
**Context.** Builds must not crash when credentials are absent (CI, previews, first checkout).
**Decision.** `parseEnv` returns a discriminated union; unconfigured state renders a setup page
listing exact problems; a value containing `service_role` is refused.
**Consequences.** Every data call handles a `null` client explicitly.

## D-006 · Profiles created by trigger, owner-only RLS, no delete policy (2026-11-04)
**Context.** The brief requires profile migration + RLS and a future account-deletion flow.
**Decision.** `handle_new_user()` (SECURITY DEFINER, empty `search_path`) inserts the profile; RLS
allows select/insert/update where `id = auth.uid()`; deletion happens only by cascading from
`auth.users`, which the planned `delete_own_account()` function will perform.
**Consequences.** No client can delete a profile directly; account deletion is a single audited path.

## D-007 · Email confirmation is on in local config (2026-11-04)
**Context.** The brief requires email verification; local Supabase defaults it off.
**Decision.** `supabase/config.toml` sets `[auth.email] enable_confirmations = true`, `site_url` and
redirect URLs to the Vite dev server. Local emails are captured by Inbucket/Mailpit at
http://localhost:54324.
**Consequences.** Dev flow matches production; developers verify via the local mail UI.

## D-008 · Entitlements behind one policy interface from day one (2026-11-04)
**Context.** No billing now; future tiers must not scatter checks.
**Decision.** `EntitlementPolicy { can(capability), limit(key), planName }`, resolved per user by
`resolvePolicy()` (always the free plan today) and exposed via `useEntitlements()`.
**Consequences.** Adding a paid tier means replacing the resolver and the data behind it.

## D-009 · Catalog providers: Pokémon TCG API is deprecated, Scrydex is paid (2026-11-04)
**Context.** docs.pokemontcg.io states the API is deprecated (keys work until 2027-03-01, no new
registrations) and points to Scrydex, which has no free tier ($29/month minimum).
**Decision.** Plan Pokémon catalog import around TCGdex (free, multilingual, open source) with custom
sets as the universal fallback; Scryfall for Magic; YGOPRODeck for Yu-Gi-Oh! (download-and-store
images, not hotlink). Paid providers are a future entitlement decision.
**Consequences.** See `docs/CARD_DATA_SOURCES.md`; licence review required before any monetisation.

## D-010 · Docker was not running during milestone 1 (2026-11-04)
**Context.** Supabase local needs Docker; the daemon was unavailable in the build environment.
**Decision.** Migrations and pgTAP tests were written and syntax-reviewed but **not executed**. This
is recorded as an external blocker in `docs/ROADMAP.md`; the first task of the next session is
`npm run db:start && npm run db:reset && npm run db:test`.
**Consequences.** Anything depending on the live schema (generated types, auth e-mails) is unverified
until then.
**Update (same day).** The owner created the hosted project `stashD` and applied the migration via the
SQL editor; `npx supabase link` works with only the login token, but `db push` was refused by the
CLI without Docker. Hosted project is now the primary environment; local stack remains optional.

## D-011 · Product name is "stashD"; brand kit pending (2026-11-04)
**Context.** The owner named the product stashD. Logo, colors and fonts are still being designed.
**Decision.** The name lives in `src/app/brand.ts` (`APP_NAME`) and the logo in
`components/layout/BrandMark.tsx`; nothing else hard-codes either. Current tokens and the placeholder
glyph/favicon stay until the kit arrives, then only `brand.ts`, `styles/index.css` and
`public/favicon.svg` change.
**Consequences.** Renaming or re-skinning is a three-file change.
