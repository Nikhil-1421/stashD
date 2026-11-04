# Handoff — read this first when resuming

Compact state of the project for a returning session. Keep it current at every stopping point;
it replaces re-reading the whole repo. Updated 2026-11-04 (phase 6 slice 2).

## What stashD is
Universal trading-card collection tracker (React 19 + TS 7 + Vite 8 + Tailwind 4 + React Router 8
+ TanStack Query 5 + Supabase). Rules: `CLAUDE.md`. Brief: `prompts/IMPLEMENTATION_BRIEF.md`.
Reference app analysis: `docs/REFERENCE_APPLICATION_ANALYSIS.md`. Decisions D-001…D-023:
`docs/DECISIONS.md`. Roadmap with per-phase status tables: `docs/ROADMAP.md`.

## Status by phase
| Phase | State |
| --- | --- |
| 1 Foundation, auth, profiles, account deletion | ✅ verified in browser by owner |
| 2 Catalog schema, custom sets, cards, variants, printings | ✅ verified in browser |
| 3 Checklist import (paste, CSV/TSV/JSON, mapping, review, transactional RPC) | ✅ verified in browser; XLSX deferred (D-016) |
| 4 Collection items, requirement rules, computed completion, Collect mode | ✅ code + tests; migration 0006 applied by owner via `db push` (2026-11-04); browser pass pending |
| 5 Bubble Check (pill grid, filters, selection + bulk ops, keyboard, undo, clipboard) | ✅ code + tests; owner browser pass done 2026-11-04 (all good; large-set layout ideas parked in phase 7) |
| 6 Binders (schema 0007, select→slot editing, page tools, autosave, undo, auto-layout, drag/drop via `@dnd-kit/react`, overview) | ✅ owner browser pass on desktop and phone 2026-11-04 |
| 7 Code splitting, Bubble Check large-set layout, dashboard, global search, bulk ops on the set page, manual card order, per-set notes | ✅ code + tests (2026-11-04); migration 0008 applied; owner browser pass pending |
| 8 Checklist Library (publish / browse / track / copy; wishlist, trade, share links parked by owner) | ✅ code + tests (2026-11-04); migration 0009 applied; owner browser pass pending |
| 9 Catalog adapters/images · 10 Export/backup/hardening | ⬜ |

## Environment and workflow (the non-obvious parts)
- Node lives at `~/.local/node/bin`; every shell command needs `export PATH="$HOME/.local/node/bin:$PATH"`.
- Docker is not running → no local Supabase, no pgTAP. `supabase/tests/database/*.sql` (4 files) are written but unrun.
- Hosted Supabase project `stashD`, ref `bahyzyokimpgzjukljap`; `.env.local` holds URL + anon key (git-ignored).
- CLI 3.0 (`npx supabase`) talks to the hosted DB with the login token only; migration history was
  repaired on 2026-11-04 so `db push --remote` is clean. **Migration workflow (re-agreed
  2026-11-04):** I write the migration and run checks, ask the owner for approval in one question,
  then run `npx supabase db push --remote --yes --skip-vault` myself and verify over REST. The
  permission classifier denied this once earlier in the day but allowed it for 0007; if it denies
  again, fall back to asking the owner to run the same command (SQL editor paste + `migration
  repair` is the last resort).
- Verify migrations afterwards over REST with curl + anon key (`set -a; source .env.local; set +a`).
  Supabase default grants let `anon` address every table; RLS is the real boundary.
- Git: branch `feat/foundation`, remote SSH `git@github.com:Nikhil-1421/stashD.git`. Push with
  `GIT_SSH_COMMAND='ssh -o IdentitiesOnly=yes -i ~/.ssh/id_ed25519'` in a retry loop (auth flakes).
  Commit messages: use `-F -` with a heredoc; avoid double quotes inside `-m "..."` (zsh).
- zsh: `status` is read-only (use `rc`); no `timeout` binary; `pipestatus` lowercase.
- Email confirmations are on; the built-in sender is rate-limited (few/hour). Owner chose to wait.
- Brand kit applied 2026-11-04 (D-023, `docs/UI_UX_SPEC.md`): source in `stashD-brand-kit/`
  (untracked, 13 MB — owner to decide whether to commit it); in use: `src/assets/fonts` (Space
  Grotesk variable; only `font-light` and `font-normal` are used and are remapped to 350 / 500 in
  `@theme` → never `font-medium`/`font-semibold`), `src/assets/brand` (lockup,
  D card), `public/` favicons + manifest + share image, tokens in `src/styles/index.css`,
  `components/layout/Starfield.tsx` + `starfield-model.ts`, `BrandMark.tsx` (`variant`, `width`).
- Visual checks without a login: headless Chrome is installed
  (`/Applications/Google Chrome.app`); `--headless=new --window-size=1440,1000
  --virtual-time-budget=6000 --screenshot=out.png URL`. Minimum window width is 500 px, so a
  "390 px" shot is a crop, not a layout. For signed-in screens, write a throwaway `preview.html` +
  harness that mounts real components with fake data, shoot it, delete it.

## Pending right now
1. **Owner review of the brand pass** (colours, type, logo placement, starfield speed/density,
   box translucency). Knobs: `SPEED` and twinkle in `Starfield.tsx`, `starCount()` and `FIELD` in
   `starfield-model.ts`, surface alphas and golds in `src/styles/index.css`.
2. After that review the owner wants to **revisit phase 7** (ask what specifically; the phase 7 and
   8 browser passes are also still outstanding — phase 8 needs two accounts).
3. New **phase 9: curated set catalog via bulk upload** (see ROADMAP) — design first, ask the
   open questions listed there. Catalog adapters are now phase 10, export/hardening phase 11.
4. Decide whether to commit `stashD-brand-kit/` (13 MB of source artwork) to the repo.
## Code map (where things are)
- `src/app/` router, providers, navigation (`NAV_ITEMS` with `status`/`phase`), `brand.ts`.
- `src/components/ui/` hand-rolled primitives (Button, ButtonLink, Chip, Input, Select, Textarea,
  FormField, Card*, Alert, Skeleton, Spinner, InlineConfirm, EmptyState). Layout in `components/layout/`.
- `src/features/auth` (AuthProvider, guards, pages, `describeAuthError`), `profile` (settings,
  deletion), `entitlements` (policy interface, free plan; `can('sets.import')` etc.).
- `src/features/library` `ChecklistLibraryPage` (`/checklists`), `ChecklistPreviewPage`
  (`/checklists/:catalogSetId`), `LibraryActions` (add / copy), `PublishPanel` (owner toggle on the
  set page), `api.ts` (`listLibrary`, `trackSet`, `duplicateSet`, `setVisibility`, `untrackSet`).
- `src/features/search` `SearchPage` (`/search?q=`), `api.ts` (`searchCards` across tracked sets). Top-bar
  search form lives in `components/layout/TopBar.tsx` (`/` shortcut). `CardsSection` and the set page
  accept `?q=` to pre-filter the table.
- `src/features/sets` Collections list/tiles, set form, `SetDetailPage` (owner check via
  `set_owner_id === auth.user.id`; renders progress + variants + cards + `SetNotesSection`),
  `notes-api.ts`.
- `src/features/cards` `CardsSection` (two modes: Collect = owned toggles + Details row + row
  selection with bulk owned/exclude; Edit checklist = printing exists checkboxes + add/edit/delete +
  By number / Manual order toggle with ↑/↓), `VariantsSection`, `api.ts` (`applyOrder`,
  `reorderCards`, `setCardOrder`), `schema.ts`.
- `src/features/import` wizard `ImportPage` (source → map → review), pure `domain/`
  (delimited, json, mapping, paste, plan), `api.ts` (`importChecklist` RPC, `listCardKeys`).
- `src/features/collection` `useSetCollection` hook (printings/items/rules queries, optimistic
  single + bulk quantity writes with rollback, `replaceRules` for bulk include/exclude, exported
  `coarserExcludes`), `CollectionProgress`, pure `domain/` (`requirements.ts`, `completion.ts`).
- `src/features/bubble` `BubbleCheckPage` (`/sets/:id/bubble`: filters, selection toolbar, copy,
  undo), `BubbleSetPickerPage` (`/bubble-check`), `BubbleGrid` (row-virtualised against window
  scroll, roving tabindex), `bubble-styles.ts` (pill geometry and state classes), pure
  `domain/bubbles.ts` (build/filter/range/toggle writes) and `domain/clipboard.ts` (three formats).
- `src/features/binders` `BindersPage` (`/binders`, list + inline create), `BinderPage`
  (`/binders/:id`: page strip, `BinderCanvas` slot grid, `CardSourcePanel`, `GeneratePanel`,
  `PageTools`, resize preview, save indicator), `useBinderEditor` (overlay + pending batch +
  autosave + page ops, flushes before structure changes), `usePrintingDetails` (cache-accumulating
  lookup), `api.ts` (RPCs + `savePlacements` upsert/delete), `dnd.ts` + `BinderDndProvider.tsx`
  (the only `@dnd-kit/react` imports), `BinderOverview.tsx`, pure `domain/layout.ts` (slot math,
  presets, `remapPlacements`, `planPages`), `domain/placements.ts` (`applyOp` with inverses) and
  `domain/dnd.ts` (`resolveDrop`: drag source + drop target → op / reorder / reject).
- Shared: `hooks/useUndoStack.ts` + `components/ui/UndoToast.tsx` (used by Bubble Check and binders).
- `src/features/catalog/domain` `cardNumberSortKey` (mirrors SQL), `slugify`.
- `src/lib/env.ts` validated env union; `lib/supabase/client.ts` `getSupabase()`/`requireSupabase()`;
  `lib/supabase/database.types.ts` **hand-written** (regenerate with `npm run db:types` once Docker works).
- `src/test/render.tsx` helpers (`renderWithProviders`, `renderRoutes`, `signedInAs`).
- Migrations 0001–0009 in `supabase/migrations/`, all applied to the hosted project; schema doc `docs/DATABASE_SCHEMA.md`.

## Conventions that bit us
- Vitest 5: mock modules with `vi.mock(path, importOriginal)` delegating to a plain `let impl`
  variable; never `vi.fn().mockRejectedValue` + `mockReset` (unhandled rejection).
- oxlint: no `set-state-in-effect`, no mutable reassignments in effects (use AbortController),
  components-only exports in `.tsx` (helpers go in `*-utils.ts` / `*-styles.ts`).
- React Query keys: `['user-sets'…]`, `['cards', setId…]` (paged list and `['cards', setId, 'all']`),
  `['variants', setId]`, `['printings', setId…]` (both the paged and the `all` query),
  `['collection', userSetId, …]`. Invalidate `['printings', setId]` after any checklist edit.
- Bulk writes: PostgREST upsert sends only the columns in the payload, so a quantity-only upsert
  keeps condition/notes. The grid in jsdom measures 0 px wide → 1 column; End = same pill, use
  Ctrl+End in tests.
- StrictMode double-mount: an effect cleanup that cancels a rAF/timer held in a ref must also reset
  the ref, or the second mount thinks work is still scheduled (this left the Bubble grid one column
  wide in dev only; production was fine).
- Paste auto-detect needs ≥80 % of lines to match a pattern; tests select the pattern explicitly.
- plpgsql: prefix local variables (`v_slug`) — a bare `slug` was ambiguous with a column (fixed in 0005).

## Next milestone: owner's call after the brand review
Order the owner gave on 2026-11-04: brand pass (done, awaiting review) → revisit phase 7 → then the
new phase 9 curated catalog (bulk upload of sets for collectors to choose from). Phase 10 catalog
adapters (TCGdex / Scryfall / YGOPRODeck behind `features/catalog/providers/<name>.ts`, provider
sets as `owner_id null` rows, images with attribution) and phase 11 export/backup/hardening follow.

## Checks
`export PATH="$HOME/.local/node/bin:$PATH" && npm run check` → typecheck, oxlint, Vitest (152 tests
in 35 files), Vite build (lazy route
chunks + react/supabase/query/dnd/vendor chunks; first screen ≈ 210 kB gzip, mostly vendor).
