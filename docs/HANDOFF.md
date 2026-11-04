# Handoff — read this first when resuming

Compact state of the project for a returning session. Keep it current at every stopping point;
it replaces re-reading the whole repo. Updated 2026-11-04 (phase 6 slice 2).

## What stashD is
Universal trading-card collection tracker (React 19 + TS 7 + Vite 8 + Tailwind 4 + React Router 8
+ TanStack Query 5 + Supabase). Rules: `CLAUDE.md`. Brief: `prompts/IMPLEMENTATION_BRIEF.md`.
Reference app analysis: `docs/REFERENCE_APPLICATION_ANALYSIS.md`. Decisions D-001…D-020:
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
| 7 Dashboard/search/bulk · 8 Wishlist/trade/sharing · 9 Catalog adapters/images · 10 Export/backup/hardening | ⬜ |

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
- Brand kit (logo, colours, fonts) is pending from the owner; placeholder lives in
  `src/app/brand.ts`, `src/styles/index.css` tokens, `public/favicon.svg`, `BrandMark.tsx`.

## Pending right now
1. Phase 7 in progress: code splitting ✅; next the Bubble Check large-set layout, then dashboard,
   global search, bulk ops on the set page, a per-set manual-order mode, per-set notes.
2. Dev server now listens on the LAN by default (`server.host = true`, owner request 2026-11-04);
   the owner tests on a phone via the Network URL Vite prints.
## Code map (where things are)
- `src/app/` router, providers, navigation (`NAV_ITEMS` with `status`/`phase`), `brand.ts`.
- `src/components/ui/` hand-rolled primitives (Button, ButtonLink, Chip, Input, Select, Textarea,
  FormField, Card*, Alert, Skeleton, Spinner, InlineConfirm, EmptyState). Layout in `components/layout/`.
- `src/features/auth` (AuthProvider, guards, pages, `describeAuthError`), `profile` (settings,
  deletion), `entitlements` (policy interface, free plan; `can('sets.import')` etc.).
- `src/features/sets` Collections list/tiles, set form, `SetDetailPage` (owner check via
  `set_owner_id === auth.user.id`; renders progress + variants + cards).
- `src/features/cards` `CardsSection` (two modes: Collect = owned toggles + Details row; Edit
  checklist = printing exists checkboxes + add/edit/delete), `VariantsSection`, `api.ts`, `schema.ts`.
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
- Migrations 0001–0007 in `supabase/migrations/`, all applied to the hosted project; schema doc `docs/DATABASE_SCHEMA.md`.

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
- Paste auto-detect needs ≥80 % of lines to match a pattern; tests select the pattern explicitly.
- plpgsql: prefix local variables (`v_slug`) — a bare `slug` was ambiguous with a column (fixed in 0005).

## Next milestone: phase 7 — dashboard, global search, bulk ops
Dashboard summary (sets, progress, missing quick access, recent binders), global search across
sets/cards, bulk operations on the set page (selection model exists in Bubble Check), the parked
Bubble Check large-set layout work (density setting, sticky toolbar + range jump links, remembered
status filter), a per-set "manual order" mode so checklist drag reorder becomes meaningful, and
per-set notes. Code splitting done 2026-11-04 (rolldown `codeSplitting` groups in `vite.config.ts`).

## Checks
`export PATH="$HOME/.local/node/bin:$PATH" && npm run check` → typecheck, oxlint, Vitest (137 tests
in 30 files), Vite build (lazy route
chunks + react/supabase/query/dnd/vendor chunks; first screen ≈ 210 kB gzip, mostly vendor).
