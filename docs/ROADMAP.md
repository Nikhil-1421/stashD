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
1. Docker daemon is not running, so the local stack and the pgTAP tests cannot run. Migrations
   0001–0005 were applied to the hosted project `stashD` by pasting them into the SQL editor and
   verified over REST. On 2026-11-04 the hosted migration history was repaired
   (`supabase migration repair --remote --status applied …`), and `supabase db push --remote` now
   reports up to date; the CLI connects with the login token alone (no Docker, no DB password).
   From here migrations are pushed with `npx supabase db push --remote --yes` after the owner's
   explicit go-ahead for each one (CLAUDE.md: production migrations need human approval).
2. A hosted Supabase project is configured in `.env.local` (anon key, role claim verified). Auth,
   set/card/variant CRUD and checklist import were each verified by the owner in the browser.
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

## Phase 3 — Checklist import / paste / manual ✅ (2026-11-04)

| Criterion | Status | Evidence |
| --- | --- | --- |
| CSV/TSV/JSON upload → preview → header mapping → validation → conflict report → commit | ✅ | `features/import/ImportPage.tsx`; `domain/delimited.ts`, `json.ts`, `mapping.ts`, `plan.ts` |
| XLSX upload | ⬜ deferred (D-016) | UI explains "save as CSV" |
| Paste parser with configurable pattern and live preview | ✅ | `domain/paste.ts`; 4 patterns incl. the reference clipboard export |
| Transactional commit + import job records | ✅ applied to hosted project (SQL editor, 2026-11-04); anon denied on function and table via REST | `20261104300000_checklist_import.sql`; pgTAP `import_checklist.test.sql` (unrun: Docker) |
| Browser pass of paste → review → commit | ⬜ | owner to verify against the hosted project |
| Manual bulk add | ✅ | paste = bulk add; single-card form from phase 2 |
| Manual reorder | ⬜ moved to phase 6 | needs the drag/drop library chosen for binders; `position` column already exists |
| Save a mapping per source | ⬜ later | |
| Tests | ✅ | 32 new Vitest tests (29 domain + 3 page flow) |

The Checklist Library nav item now points at phase 8 (shared/public checklists) rather than phase 3.

## Phase 4 — Collection tracking, requirements, progress ✅ (2026-11-04)

| Criterion | Status | Evidence |
| --- | --- | --- |
| `collection_items` + `user_set_requirements` with RLS and set-membership trigger | ✅ applied to hosted project by owner via `db push` (2026-11-04); anon denied via REST | `20261104400000_collection.sql`; pgTAP `collection.test.sql` (unrun: Docker) |
| `resolveRequired()` / `computeCompletion()` pure domain with tests | ✅ | `features/collection/domain/*` (8 tests) |
| Set detail: progress bar, Collect mode with per-printing owned toggles (optimistic + rollback) | ✅ | `CollectionProgress.tsx`, `CardsSection.tsx`, `useSetCollection.ts`; component test |
| Quantity / condition / notes per printing | ✅ | "Details" row per card |
| Requirement toggles: per variant ("Counts toward completion"), per printing (details row) | ✅ | variant/printing scopes; category/card scopes exist in the model, UI in phase 5 bulk ops |
| Dashboard owned copies / printings; set tiles show owned/printings | ✅ | overview view columns |
| Bulk operations | ⬜ phase 5/7 | selection model arrives with Bubble Check |



## Phase 5 — Bubble Check ✅ code + tests (2026-11-04); owner browser pass pending

| Criterion | Status | Evidence |
| --- | --- | --- |
| Pill grid, one pill per printing or per card; states missing / owned / partly owned / complete / not required | ✅ | `features/bubble/domain/bubbles.ts` (tests), `BubbleGrid.tsx` |
| Virtualised for thousands of cards | ✅ fixed pill geometry, rows rendered against the window scroll position, no dependency | `BubbleGrid.tsx` |
| Filters: status, variant, rarity, debounced search; counts per status | ✅ | `BubbleCheckPage.tsx` |
| Selection (click, shift-range, Shift+Space, select all visible) → mark owned / not owned / exclude / include | ✅ chunked 500-row upsert; printing- or card-scope rules | `useSetCollection.setQuantities` / `replaceRules`, `collection/api.ts` |
| Keyboard navigation | ✅ roving tabindex, arrows, Home/End (Ctrl: whole grid), Space, Esc clears selection, ⌘Z undo | `BubbleGrid.test.tsx` |
| Optimistic updates with rollback and visible error | ✅ | `useSetCollection.ts`; page test |
| Undo: 5 s toast (pauses on hover/focus), multi-step stack, ⌘Z | ✅ inverse writes computed client-side | `useUndoStack.ts`, `UndoToast.tsx` |
| Clipboard copy of missing/owned in the reference's three formats, text-box fallback when blocked | ✅ | `domain/clipboard.ts` (tests) |
| Scroll preservation | ✅ grid height depends only on row count, toggles never relayout | |
| Routes `/bubble-check` (set picker) and `/sets/:id/bubble`; links from set page and dashboard | ✅ | `BubbleSetPickerPage.tsx`, `router.tsx` |
| Browser pass on the hosted project (bulk upsert path, touch targets, mobile toolbar) | ⬜ owner | |
| Per-set notes (reference feature) | ⬜ moved to phase 7 | |
| Large-set viewing | ✅ delivered in phase 7 (density, sticky bar + jump links, heading rows, remembered status); cards-by-default and collapsible rarity groups still open | |

No migration: bulk writes use PostgREST upsert on `collection_items` / `user_set_requirements` under the existing RLS (D-018).

## Phase 6 — Binder engine ✅ (2026-11-04; owner browser pass on desktop and mobile)

| Criterion | Status | Evidence |
| --- | --- | --- |
| Binders / pages / placements tables, RLS via parent, slot-fit trigger, overview view | ✅ applied to the hosted project 2026-11-04; anon denied on tables, view and RPCs (REST) | `20261104500000_binders.sql`; pgTAP `binders.test.sql` (unrun: Docker) |
| Layout presets (2×2 … 4×4) + custom rows/columns up to 6 | ✅ | `domain/layout.ts` (tests), `BinderForm.tsx`, `PageTools` |
| Resize preview: coordinate remap, list of what would drop, explicit confirm | ✅ client preview + `resize_binder_page` RPC | `remapPlacements` (tests); page test |
| Select card → select slot path; move / swap / remove / duplicate | ✅ | `BinderCanvas.tsx`, `BinderPage.tsx`; page test |
| Keyboard: arrows, Enter, Delete, Esc, ⌘Z | ✅ | `BinderCanvas.tsx` |
| Page add / duplicate / delete / reorder / label / clear | ✅ RPCs for duplicate + reorder | `useBinderEditor.pageOps` |
| Batched autosave (800 ms), Saving / Saved / Unsaved (n) / Failed + Retry; pending kept on failure; beforeunload guard | ✅ | `useBinderEditor.ts`; page test |
| Undo for placement operations (inverse ops, multi-step, toast) | ✅ shared `hooks/useUndoStack` | |
| Auto-layout: generate pages from a set in checklist order with page/empty-slot preview | ✅ `generate_binder_pages` RPC; appends, never overwrites | `GeneratePanel.tsx` |
| Drag and drop (pointer; long-press on touch): chip → slot/page, slot → slot (swap) / page tab (first empty slot), page tab → page tab (reorder) | ✅ `@dnd-kit/react` (D-020) | `dnd.ts`, `BinderDndProvider.tsx`, `domain/dnd.ts` (tests) |
| Card images / placeholders in slots | ⬜ phase 9 (no image source yet) | |
| Binder overview grid (thumbnails; click to open; drop targets) | ✅ | `BinderOverview.tsx` |
| Zoom | ⬜ not needed yet; pages scale with the column width | |
| Manual card reorder in checklists (deferred from phase 3) | ⬜ phase 7 — needs a per-set "manual order" mode first (D-020) | |
| Browser pass on the hosted project | ✅ slices 1 and 2 incl. touch drag on a phone (owner, 2026-11-04) | |

## Phase 7 — Dashboard, global search, bulk ops ✅ code + tests (2026-11-04); owner browser pass pending

| Criterion | Status | Evidence |
| --- | --- | --- |
| Route-level code splitting + vendor chunks | ✅ initial app chunk ~23 kB; react / supabase / query / dnd / vendor chunks cached separately; pages lazy with a shell loading bar | `src/app/router.tsx`, `vite.config.ts`, `AppShell.tsx` |
| Bubble Check large-set viewing: Compact density (default on pointer devices, 44×30 px pills), sticky status/search bar with jump links per 100 pills and the current section highlighted, heading rows in the grid, status filter remembered per device | ✅ | `bubble-styles.ts` (`GEOMETRY`), `BubbleGrid.tsx` (sections, handle), `domain/bubbles.ts#sectionsOf` (tests) |
| Dashboard: stats incl. binders, recent sets with progress bars, "Keep checking" (most unowned → Bubble Check), recent binders, quick actions; onboarding only for empty accounts | ✅ | `DashboardPage.tsx`, `SetTile` |
| Global search: `/search?q=` over sets, binders (by name) and cards (name/number, server-side, across tracked sets); top-bar box with `/` shortcut, icon on mobile; card hits open the set with the table pre-filtered | ✅ | `features/search/*` (tests), `TopBar.tsx` |
| Bulk operations on the set page: row checkboxes + page select-all in Collect mode; Mark owned / not owned (required printings), Exclude / Include at card scope | ✅ | `CardsSection.tsx`; collect test |
| Per-set manual card order: owner toggles By number / Manual in Edit checklist; ↑/↓ move across the whole set via `reorder_catalog_cards`; Bubble Check and binder generation follow the set's order | ✅ migration 0008 applied 2026-11-04 | `cards/api.ts` (`applyOrder`), pgTAP `set_notes_and_card_order.test.sql` (unrun) |
| Per-set notes, newest first, deletable | ✅ migration 0008 | `SetNotesSection.tsx` (test) |
## Phase 8 — Checklist Library ✅ code + tests (2026-11-04); owner browser pass pending
Owner decision 2026-11-04: wishlist, trade and public share links are **parked**; the phase is the
Checklist Library (publish / browse / track / copy).

| Criterion | Status | Evidence |
| --- | --- | --- |
| Publish / unpublish a custom set's checklist (owner toggle on the set page; tracker count; unpublish keeps existing trackers) | ✅ migration 0009 applied 2026-11-04 | `PublishPanel.tsx` (test), `set_catalog_set_visibility` |
| Browse published checklists: search, game filter, publisher, counts; preview page with read-only card table | ✅ | `ChecklistLibraryPage.tsx` (tests), `ChecklistPreviewPage.tsx` |
| Add a published checklist to my collection (private progress) / open it when already tracked | ✅ `track_catalog_set` + trackable trigger | `LibraryActions.tsx` |
| Copy any readable checklist into a private editable set (also the "duplicate set" item deferred since phase 3) | ✅ `duplicate_catalog_set` | pgTAP `checklist_library.test.sql` (unrun) |
| Non-owner set page: library banner, Copy as my own, Remove from my collection (confirm) | ✅ | `SetDetailPage.tsx` |
| Owner deleting a published set warns about other collectors | ✅ | `SetDetailPage.tsx` |
| Wishlist / trade status | ⬜ parked by owner | |
| Public share links (`collection_shares`) | ⬜ parked by owner | |
## Brand pass ✅ approved by owner (2026-11-04)
Brand kit applied across the app (D-023): Space Grotesk variable font, Stash Ink + Metallic Gold
tokens, gold-gradient primary button, kit logo/lockup/D-card, favicons + manifest + share image,
starfield background, translucent surfaces. Verified with headless-Chrome screenshots of the
shell, components and login at desktop and phone widths. Owner tuned it over three rounds and
signed off on: star count = viewport area / 1350 (260–1400), surfaces at 44 / 54 / 66 % opacity,
type weights 350 (headings) / 500 (body). Also fixed here: Bubble Check grid stayed one column wide
in dev (StrictMode) because its measurement effect kept a stale frame handle.

## Phase 9 — Curated set catalog (bulk upload) ⬜ (owner request 2026-11-04)
Bulk-upload many sets so collectors can browse and pick from a ready-made catalog instead of
building each checklist. To design: who may upload (owner/admin only), the bulk format (reuse the
import pipeline: one file per set, or a manifest), how curated sets are owned (a "stashD curated"
provider row so they are `owner_id null` and readable by everyone, vs. published custom sets), how
they surface (Checklist Library with a Curated filter), licensing of names/numbers/images per source.

## Phase 10 — Catalog adapters / image sources ⬜ (TCGdex, Scryfall, YGOPRODeck first)
## Phase 11 — Export/backup, hardening, accessibility, deployment ⬜
