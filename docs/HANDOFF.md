# Handoff — read this first when resuming

Compact state of the project for a returning session. Keep it current at every stopping point;
it replaces re-reading the whole repo. **Checkpoint: 2026-11-04, end of the second session**
(phases 5–8 built, brand kit applied and approved by the owner). Last commit on
`feat/foundation` at the checkpoint is the one that contains this file; the tree is clean except
for the untracked `stashD-brand-kit/` folder.

## Start of next session
1. `git status && git log --oneline -5` (expect a clean tree apart from `stashD-brand-kit/`).
2. `export PATH="$HOME/.local/node/bin:$PATH" && npm run check` (expect 152 tests in 35 files, build OK).
3. Ask the owner the open questions under "Pending right now" before building anything new.

## What stashD is
Universal trading-card collection tracker (React 19 + TS 7 + Vite 8 + Tailwind 4 + React Router 8
+ TanStack Query 5 + Supabase + `@dnd-kit/react`). Rules: `CLAUDE.md`. Brief:
`prompts/IMPLEMENTATION_BRIEF.md`. Reference app analysis: `docs/REFERENCE_APPLICATION_ANALYSIS.md`.
Decisions D-001…D-023: `docs/DECISIONS.md`. Roadmap with per-phase status tables: `docs/ROADMAP.md`.
Brand and tokens: `docs/UI_UX_SPEC.md`.

## Status by phase
| Phase | State |
| --- | --- |
| 1 Foundation, auth, profiles, account deletion | ✅ verified in browser by owner |
| 2 Catalog schema, custom sets, cards, variants, printings | ✅ verified in browser |
| 3 Checklist import (paste, CSV/TSV/JSON, mapping, review, transactional RPC) | ✅ verified in browser; XLSX deferred (D-016) |
| 4 Collection items, requirement rules, computed completion, Collect mode | ✅ owner browser pass 2026-11-04 |
| 5 Bubble Check (pill grid, filters, selection + bulk ops, keyboard, undo, clipboard) | ✅ owner browser pass 2026-11-04 |
| 6 Binders (schema 0007, select→slot editing, page tools, autosave, undo, auto-layout, drag/drop via `@dnd-kit/react`, overview) | ✅ owner browser pass on desktop and phone 2026-11-04 |
| 7 Code splitting, Bubble Check large-set layout, dashboard, global search, bulk ops on the set page, manual card order, per-set notes | ✅ code + tests; migration 0008 applied; **owner browser pass not done; owner wants to "revisit phase 7"** |
| 8 Checklist Library (publish / browse / track / copy). Wishlist, trade and share links **parked by owner** | ✅ code + tests; migration 0009 applied; **owner browser pass not done (needs two accounts)** |
| Brand pass (kit applied: type, colours, logo, favicons, starfield, translucent boxes) | ✅ **approved by owner 2026-11-04** after three tuning rounds ("okay it works") |
| 9 Curated set catalog via bulk upload (owner request) | ⬜ design first |
| 10 Catalog adapters / images · 11 Export, backup, hardening, Playwright, deployment | ⬜ |

## Pending right now (in the order the owner gave)
1. **Revisit phase 7.** The owner said this comes right after the brand review but did not say what
   to revisit: ask. Likely candidates: the Bubble Check large-set layout (the grid was stuck one
   column wide in dev until the brand-pass fix, so the owner has never seen Compact density, the
   jump strip or heading rows working), dashboard, search, bulk ops, manual order, notes.
2. **Outstanding browser passes**: phase 7 (see ROADMAP table) and phase 8 (two accounts: A
   publishes a set; B previews, adds, copies; A unpublishes; B still has it; B removes it).
3. **Phase 9: curated set catalog via bulk upload** so collectors can pick from ready-made sets.
   Open questions to ask first: who may upload (owner/admin only?), bulk format (one file per set
   through the existing import pipeline, or a manifest), ownership model (a "stashD curated"
   provider row → `owner_id null`, readable by all, vs. published custom sets), where they surface
   (Checklist Library with a Curated filter), licensing of names/numbers/images per source.
4. **Brand kit folder**: `stashD-brand-kit/` (13 MB source artwork) is untracked. Owner has been
   asked twice whether to commit it and has not answered; ask once more, do not commit unasked.
5. Small: Wishlist and Trade still show as "Planned" in the nav although parked. Ask whether to
   hide them.

## Environment and workflow (the non-obvious parts)
- Node lives at `~/.local/node/bin`; every shell command needs `export PATH="$HOME/.local/node/bin:$PATH"`.
- Dev server: `npm run dev` listens on the LAN (`server.host = true`); the owner tests on a phone
  via the Network URL. The owner stops and starts it themselves; check `lsof -iTCP:5173` before
  assuming it is up.
- Docker is not running → no local Supabase, no pgTAP. `supabase/tests/database/*.sql` (7 files)
  are written but unrun.
- Hosted Supabase project `stashD`, ref `bahyzyokimpgzjukljap`; `.env.local` holds URL + anon key
  (git-ignored). Migrations 0001–0009 are all applied.
- **Migration workflow:** I write the migration and run checks, ask the owner for approval in one
  question, then run `npx supabase db push --remote --yes --skip-vault` myself and verify over REST
  with curl + anon key (`set -a; source .env.local; set +a`). RPC checks must send exactly that
  function's argument names or PostgREST answers 404 instead of 401. Supabase default grants let
  `anon` address every table; RLS is the real boundary. If the permission layer denies the push,
  ask the owner to run the same command.
- Git: branch `feat/foundation`, remote SSH `git@github.com:Nikhil-1421/stashD.git`. Push with
  `GIT_SSH_COMMAND='ssh -o IdentitiesOnly=yes -i ~/.ssh/id_ed25519'` in a retry loop (auth flakes).
  Commit messages: use `-F -` with a heredoc; avoid double quotes inside `-m "..."` (zsh). Stage
  with `git add -A -- . ':!stashD-brand-kit'` while the kit decision is open.
- zsh: `status` is read-only (use `rc`); no `timeout` binary; `pipestatus` lowercase; quote any
  `echo` argument starting with `=`; `--include=*.ts` globs need quotes.
- Email confirmations are on; the built-in sender is rate-limited (few/hour). Owner chose to wait.
- **Visual checks without a login:** headless Chrome is installed (`/Applications/Google
  Chrome.app/Contents/MacOS/Google Chrome --headless=new --window-size=1440,1000
  --virtual-time-budget=6000 --user-data-dir=<scratch> --screenshot=out.png URL`). Minimum window
  width is 500 px, so a "390 px" shot is a crop, not a layout. `/login` is public. For signed-in
  screens, write a throwaway `preview.html` + `src/preview-harness.tsx` that mounts `AppShell` and
  real components with fake data inside `AuthContext`/`EntitlementsContext`/a data router, serve
  with `npx vite --port 5199 --strictPort --host 127.0.0.1` in the background, shoot, kill the port,
  delete both files. PDFs: no poppler; render with a small Swift/PDFKit script.

## Brand (approved values; D-023, `docs/UI_UX_SPEC.md`)
- Name is always written **stashD**. Tagline: "Track every set. Plan every binder."
- In use from the kit: `src/assets/fonts/SpaceGrotesk-Variable.woff2` (+ `OFL.txt`),
  `src/assets/brand/` (horizontal lockup on dark, gold D card), `public/` favicons + manifest +
  share image. `BrandMark` takes `variant` (`lockup` ≥160 px wide, or `icon`) and `width`.
- Type: only `font-light` (headings) and `font-normal` (everything else) are used; they are
  remapped in `@theme` to **350 and 500** (guide says 300/400; owner chose heavier). Never use
  `font-medium`/`font-semibold`/`font-bold`. `font-mono` is the same family with tabular figures.
- Colour tokens in `src/styles/index.css`: canvas `#050609`; ink surfaces at **0.44 / 0.54 / 0.66**
  opacity; `surface-solid` opaque for select menus; gold `#D4AF37` accent, gold-gradient primary
  button (`bg-gold-gradient`), gold hairline `line-strong`; warning is orange on purpose.
- Starfield (`components/layout/Starfield.tsx` + `starfield-model.ts`): `SPEED = 16`, 30 fps cap,
  star count = viewport area / **1350**, clamped 260–1400 (960 at 1440 × 900), paused when hidden,
  still frame for reduced motion. Mounted once in `main.tsx`, outside the router.
- Logo rules honoured: artwork as-is, never on the starfield directly (always on an ink panel).

## Code map (where things are)
- `src/app/` router (every page is a lazy route), providers, navigation (`NAV_ITEMS` with
  `status`/`phase`), `brand.ts`.
- `src/components/ui/` hand-rolled primitives (Button, ButtonLink, Chip, Input, Select, Textarea,
  FormField, Card*, Alert, Skeleton, Spinner, InlineConfirm, EmptyState, UndoToast).
  `components/layout/` AppShell (loading bar), Sidebar, TopBar (search box, `/` shortcut),
  MobileNav, PageHeader, BrandMark, Starfield.
- `src/features/auth` (AuthProvider, guards, pages, `AuthLayout`, `describeAuthError`), `profile`
  (settings, deletion), `entitlements` (policy interface, free plan; `can('sets.import')` etc.).
- `src/features/dashboard` `DashboardPage` (stats, recent sets, Keep checking, binders, quick actions).
- `src/features/sets` Collections list/tiles, set form, `SetDetailPage` (owner check via
  `set_owner_id === auth.user.id`; progress + variants + cards + `SetNotesSection` + `PublishPanel`;
  non-owners get Copy as my own / Remove from my collection), `notes-api.ts`.
- `src/features/cards` `CardsSection` (Collect = owned toggles + Details row + row selection with
  bulk owned/exclude; Edit checklist = printing checkboxes + add/edit/delete + By number / Manual
  order with ↑/↓; reads `?q=`), `VariantsSection`, `api.ts` (`applyOrder`, `listAllCards`,
  `reorderCards`, `setCardOrder`), `schema.ts`.
- `src/features/import` wizard `ImportPage` (source → map → review), pure `domain/`
  (delimited, json, mapping, paste, plan), `api.ts` (`importChecklist` RPC, `listCardKeys`).
- `src/features/collection` `useSetCollection` (printings/items/rules queries, optimistic single +
  bulk quantity writes with rollback, `replaceRules`, exported `coarserExcludes`),
  `CollectionProgress`, pure `domain/` (`requirements.ts`, `completion.ts`).
- `src/features/bubble` `BubbleCheckPage` (`/sets/:id/bubble`: sticky status/search bar, jump strip,
  density, selection toolbar, copy, undo), `BubbleSetPickerPage` (`/bubble-check`), `BubbleGrid`
  (row-virtualised against window scroll, sections + heading rows, roving tabindex, imperative
  `scrollToSection`), `bubble-styles.ts` (`GEOMETRY`, pill classes), pure `domain/bubbles.ts` and
  `domain/clipboard.ts`.
- `src/features/binders` `BindersPage`, `BinderPage` (page strip, `BinderCanvas`, `CardSourcePanel`,
  `GeneratePanel`, `PageTools`, resize preview, save indicator, `BinderOverview`),
  `useBinderEditor` (overlay + pending batch + autosave + page ops), `usePrintingDetails`,
  `api.ts`, `dnd.ts` + `BinderDndProvider.tsx` (the only `@dnd-kit/react` imports), pure
  `domain/layout.ts`, `domain/placements.ts`, `domain/dnd.ts`.
- `src/features/library` `ChecklistLibraryPage` (`/checklists`), `ChecklistPreviewPage`
  (`/checklists/:catalogSetId`), `LibraryActions`, `PublishPanel`, `api.ts` (`listLibrary`,
  `trackSet`, `duplicateSet`, `setVisibility`, `untrackSet`).
- `src/features/search` `SearchPage` (`/search?q=`), `api.ts` (`searchCards` across tracked sets).
- Shared: `hooks/useUndoStack.ts`, `useDebouncedValue`, `useLocalStorageState`, `useDocumentTitle`.
- `src/features/catalog/domain` `cardNumberSortKey` (mirrors SQL), `slugify`.
- `src/lib/env.ts` validated env union; `lib/supabase/client.ts`; `lib/supabase/database.types.ts`
  **hand-written**: when a migration changes a table or view, patch Row/Insert/Update here and the
  `UserSetOverview` test fixtures (5 test files build one). Views are listed binder_overview first.
- `src/test/render.tsx` helpers (`renderWithProviders`, `renderRoutes`, `signedInAs`).
- Migrations in `supabase/migrations/` (9 files, 0001–0009); schema doc `docs/DATABASE_SCHEMA.md`.

## Conventions that bit us
- Vitest 5: mock modules with `vi.mock(path, importOriginal)` delegating to a plain `let impl`
  variable; never `vi.fn().mockRejectedValue` + `mockReset` (unhandled rejection). A mock replaces
  early returns in the real function, so mirror them (e.g. skip empty `upsertRules` calls).
- oxlint: no `set-state-in-effect`, no mutable reassignments in effects (hold handles in a ref),
  components-only exports in `.tsx` (helpers go in `*-utils.ts` / `*-styles.ts`), no shadowed names.
- **StrictMode double-mount:** an effect cleanup that cancels a rAF/timer held in a ref must also
  reset the ref, or the second mount thinks work is still scheduled. This left the Bubble grid one
  column wide in dev only, from phase 5 until the brand pass; production was fine. Jsdom tests do
  not catch it, a headless-Chrome screenshot does.
- Components that read the URL (`useSearchParams`) need `renderRoutes`, not `renderWithProviders`.
- The drag library adds its own `role="status"` live region; query by text, not by that role.
- React Query keys: `['user-sets'…]`, `['cards', setId, 'list' | 'all', order, …]`,
  `['variants', setId]`, `['printings', setId…]`, `['collection', userSetId, …]`,
  `['binders', …]`, `['library', …]`, `['set-notes', userSetId]`, `['printing-details', …]`.
  Invalidate `['printings', setId]` after any checklist edit.
- Bulk writes: PostgREST upsert sends only the columns in the payload, so a quantity-only upsert
  keeps condition/notes. The grid in jsdom measures 0 px wide → 1 column; End = same pill, use
  Ctrl+End in tests.
- Postgres: `ON CONFLICT` cannot use a deferrable unique constraint; a single UPDATE that swaps
  unique values needs a deferrable constraint or delete + re-insert; views can only gain columns
  at the end with `create or replace`. plpgsql: prefix local variables (`v_slug`).
- Paste auto-detect needs ≥80 % of lines to match a pattern; tests select the pattern explicitly.

## Next milestone
Owner's order from 2026-11-04: brand pass (done and approved) → **revisit phase 7** (ask what) →
**phase 9 curated catalog** (bulk upload of sets for collectors to choose from; design questions
above) → phase 10 catalog adapters (TCGdex / Scryfall / YGOPRODeck behind
`features/catalog/providers/<name>.ts`, provider sets as `owner_id null` rows, images with
attribution) → phase 11 export/backup/hardening/Playwright/deployment.

## Checks
`export PATH="$HOME/.local/node/bin:$PATH" && npm run check` → typecheck, oxlint, Vitest (152 tests
in 35 files), Vite build (lazy route chunks + react/supabase/query/dnd/vendor chunks; first screen
≈ 210 kB gzip, mostly vendor).
