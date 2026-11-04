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
| Profile migration + owner-only RLS | ✅ applied to hosted project (SQL editor, 2026-11-04); anon denied via REST | `supabase/migrations/20261104000000_profiles.sql`; pgTAP test still unrun (local only) |
| Dashboard empty state / onboarding | ✅ | `features/dashboard/DashboardPage.tsx` |
| README setup steps | ✅ | `README.md` |
| typecheck / lint / test / build passing | ✅ (2026-11-04: 25 tests, 0 lint errors, build OK) | `npm run check` |

**External blockers (precise):**
1. Docker daemon was not running, so the local stack and the pgTAP RLS test could not run. The
   migration was instead applied to the hosted project `stashD` by pasting it into the SQL editor;
   REST confirms the table exists and `anon` is denied. Because it was applied by hand, the CLI's
   migration history is empty; run `npx supabase migration repair --status applied 20261104000000`
   once (needs Docker per the CLI) or accept the gap until the next migration.
2. A hosted Supabase project is configured in `.env.local` (anon key, role claim verified). Live
   auth flows still need a manual browser pass (register → email → login → settings).
3. No browser automation in the build environment: responsive/keyboard behaviour was reviewed in
   code and component tests, not visually.

**Remaining phase-1 slices:**
- ✅ Account deletion: `delete_own_account()` + typed-email confirmation UI + D-012 (approved by owner
  2026-11-04). Migration `20261104100000_account_deletion.sql` applied via the SQL editor; deletion flow verified by owner.
- ⬜ Generate DB types from the live schema (`npm run db:types`) and drop the hand-written file.
- ⬜ Playwright scaffold with the register → login → dashboard smoke test (needs local Supabase).

## Phase 2 — Catalog / custom sets / cards / variants schema + CRUD ✅ (2026-11-04)

| Criterion | Status | Evidence |
| --- | --- | --- |
| Catalog schema: games, providers, sets, cards, variants, printings; user_sets | ✅ applied to hosted project (SQL editor, 2026-11-04) | `supabase/migrations/20261104200000_catalog_and_user_sets.sql`; REST: 11 games + 3 providers readable by anon, `create_custom_set` denied for anon, anon inserts rejected by RLS, `card_number_sort_key('SV012a')` = `sv0000000012a` |
| Custom rows owner-scoped by RLS; provider rows public read | ✅ | policies + `catalog_child_sync_owner()` trigger; pgTAP `catalog_rls.test.sql` (unrun: Docker) |
| Create / edit / delete custom set | ✅ | `/sets/new`, `/sets/:id/edit`, inline delete on detail |
| Card CRUD with pagination (100/page) and debounced search | ✅ | `features/cards/CardsSection.tsx` |
| Variant definitions per set; printings auto-created; per-cell exists toggle | ✅ | `VariantsSection.tsx`, DB triggers |
| Natural card-number ordering identical in SQL and TS | ✅ | `card_number_sort_key()` ↔ `cardNumber.ts` + tests |
| Dashboard shows real set/card counts and recent sets | ✅ | `DashboardPage.tsx` |
| Tests | ✅ | 48 Vitest tests; 2 pgTAP files pending a local stack |
| Browser pass of create set → variants → cards → printings | ⬜ | owner to verify against the hosted project |

Deferred to later phases: duplicating a set (phase 3 alongside import), optimistic toggles with
rollback (phase 5), image/artwork fields in the UI (phase 9), virtualised card table (phase 5).

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
