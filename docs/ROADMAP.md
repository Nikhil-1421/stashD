# Roadmap

Status legend: ✅ done · 🟡 in progress · ⬜ not started · ⛔ blocked (external)

Updated 2026-11-04.

## Phase 1 — Foundation, shell, auth 🟡 (milestone 1 delivered; blockers below)

Acceptance criteria and status:

| Criterion | Status | Evidence |
| --- | --- | --- |
| Responsive dark app shell + navigation | ✅ | `src/components/layout/*`, tokens in `src/styles/index.css` |
| Supabase env/config handling, no credentials committed | ✅ | `src/lib/env.ts` + tests, `.env.example`, `.gitignore` |
| Auth screens + protected routes | ✅ | register / login / verify / forgot / reset / callback; `guards.tsx` + tests |
| Profile migration + owner-only RLS | ✅ written · ⛔ unapplied | `supabase/migrations/20261104000000_profiles.sql`, pgTAP test |
| Dashboard empty state / onboarding | ✅ | `features/dashboard/DashboardPage.tsx` |
| README setup steps | ✅ | `README.md` |
| typecheck / lint / test / build passing | ✅ (2026-11-04: 25 tests, 0 lint errors, build OK) | `npm run check` |

**External blockers (precise):**
1. Docker daemon was not running, so `supabase start` could not run: the migration and the pgTAP RLS
   test have not been executed against a database. First step next session:
   `npm run db:start && npm run db:reset && npm run db:test`.
2. No Supabase project credentials were available, so the live auth flows (sign-up email, password
   reset email, session persistence across reload) are implemented but **unverified end-to-end**.
3. No browser automation in the build environment: responsive/keyboard behaviour was reviewed in
   code and component tests, not visually.

**Remaining phase-1 slices:**
- ⬜ Account deletion: `delete_own_account()` SECURITY DEFINER function + confirmation UI + docs on
  data handling (cascade). Needs approval before applying (changes auth behaviour).
- ⬜ Generate DB types from the live schema (`npm run db:types`) and drop the hand-written file.
- ⬜ Playwright scaffold with the register → login → dashboard smoke test (needs local Supabase).

## Phase 2 — Catalog / custom sets / cards / variants schema + CRUD ⬜
Migrations for games, providers, catalog_sets/cards (with `owner_id` for custom), variant
definitions, printings; Collections page with create/edit/duplicate custom set; card list with
pagination; tests for RLS and CRUD.

## Phase 3 — Checklist import / paste / manual ⬜
CSV/XLSX/JSON upload → preview → header mapping → validation → conflict report → commit; paste
parser; manual bulk add/reorder; import job records. Parser unit tests.

## Phase 4 — Collection tracking, requirements, progress ⬜
`collection_items`, `user_set_requirements`, `computeCompletion()` with tests; set detail with
variant columns, quantity/condition/notes; bulk operations.

## Phase 5 — Bubble Check ⬜
Virtualised pill grid, states (missing/owned/partial/complete/excluded), filters, bulk select,
keyboard navigation, optimistic updates with rollback, scroll preservation.

## Phase 6 — Binder engine ⬜
Binders/pages/placements migrations and triggers; layout presets + custom; drag/drop with keyboard
alternative; move/swap/remove/duplicate; resize preview; batched autosave with status; undo.

## Phase 7 — Dashboard, global search, bulk ops ⬜
## Phase 8 — Wishlist/trade, sharing, copy formats ⬜
## Phase 9 — Catalog adapters / image sources ⬜ (TCGdex, Scryfall, YGOPRODeck first)
## Phase 10 — Export/backup, hardening, accessibility, deployment ⬜
Known debt to address here: the production bundle is a single ~716 kB (207 kB gzip) chunk; split by
route (`lazy` route modules) and vendor once there is more than one real page.
