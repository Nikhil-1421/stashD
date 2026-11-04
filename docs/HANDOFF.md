# Handoff — read this first when resuming

Compact state of the project for a returning session. Keep it current at every stopping point;
it replaces re-reading the whole repo. Updated 2026-11-04 (end of phase 4).

## What stashD is
Universal trading-card collection tracker (React 19 + TS 7 + Vite 8 + Tailwind 4 + React Router 8
+ TanStack Query 5 + Supabase). Rules: `CLAUDE.md`. Brief: `prompts/IMPLEMENTATION_BRIEF.md`.
Reference app analysis: `docs/REFERENCE_APPLICATION_ANALYSIS.md`. Decisions D-001…D-017:
`docs/DECISIONS.md`. Roadmap with per-phase status tables: `docs/ROADMAP.md`.

## Status by phase
| Phase | State |
| --- | --- |
| 1 Foundation, auth, profiles, account deletion | ✅ verified in browser by owner |
| 2 Catalog schema, custom sets, cards, variants, printings | ✅ verified in browser |
| 3 Checklist import (paste, CSV/TSV/JSON, mapping, review, transactional RPC) | ✅ verified in browser; XLSX deferred (D-016) |
| 4 Collection items, requirement rules, computed completion, Collect mode | ✅ code + tests; **migration 0006 not yet applied** (see below) |
| 5 Bubble Check | ⬜ next |
| 6 Binders · 7 Dashboard/search/bulk · 8 Wishlist/trade/sharing · 9 Catalog adapters/images · 10 Export/backup/hardening | ⬜ |

## Environment and workflow (the non-obvious parts)
- Node lives at `~/.local/node/bin`; every shell command needs `export PATH="$HOME/.local/node/bin:$PATH"`.
- Docker is not running → no local Supabase, no pgTAP. `supabase/tests/database/*.sql` (4 files) are written but unrun.
- Hosted Supabase project `stashD`, ref `bahyzyokimpgzjukljap`; `.env.local` holds URL + anon key (git-ignored).
- CLI 3.0 (`npx supabase`) talks to the hosted DB with the login token only; migration history was
  repaired on 2026-11-04 so `db push --remote` is clean. **Pushing to production is blocked by the
  Claude Code permission classifier in auto mode** (it denied `supabase db push --remote --yes`).
  Two unblock options: owner pastes the migration into the SQL editor
  (https://supabase.com/dashboard/project/bahyzyokimpgzjukljap/sql/new) and we then run
  `npx supabase migration repair --remote --yes --status applied <version>`; or owner adds a
  permission rule for `Bash(npx supabase db push:*)` / runs the push themselves. Either way,
  CLAUDE.md requires the owner's explicit yes before each production migration.
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
1. Apply `supabase/migrations/20261104400000_collection.sql` (collection_items,
   user_set_requirements, `set_collection_item()`, overview view gains `printing_count`,
   `owned_printings`, `owned_quantity`). Then repair history for `20261104400000`, probe REST
   (`/rest/v1/collection_items` as anon → 42501), and ask the owner to try Collect mode on a set.
2. Owner browser pass for phase 4: progress bar, cell toggles, Details row, variant "Counts toward
   completion", dashboard counts.

## Code map (where things are)
- `src/app/` router, providers, navigation (`NAV_ITEMS` with `status`/`phase`), `brand.ts`.
- `src/components/ui/` hand-rolled primitives (Button, ButtonLink, Input, Select, Textarea,
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
  quantity toggle with rollback, rule upsert), `CollectionProgress`, pure `domain/`
  (`requirements.ts` resolve rules, `completion.ts` compute).
- `src/features/catalog/domain` `cardNumberSortKey` (mirrors SQL), `slugify`.
- `src/lib/env.ts` validated env union; `lib/supabase/client.ts` `getSupabase()`/`requireSupabase()`;
  `lib/supabase/database.types.ts` **hand-written** (regenerate with `npm run db:types` once Docker works).
- `src/test/render.tsx` helpers (`renderWithProviders`, `renderRoutes`, `signedInAs`).
- Migrations 0001–0006 in `supabase/migrations/`; schema doc `docs/DATABASE_SCHEMA.md`.

## Conventions that bit us
- Vitest 5: mock modules with `vi.mock(path, importOriginal)` delegating to a plain `let impl`
  variable; never `vi.fn().mockRejectedValue` + `mockReset` (unhandled rejection).
- oxlint: no `set-state-in-effect`, no mutable reassignments in effects (use AbortController),
  components-only exports in `.tsx` (helpers go in `*-utils.ts` / `*-styles.ts`).
- React Query keys: `['user-sets'…]`, `['cards', setId…]`, `['variants', setId]`,
  `['printings', setId…]` (both the paged and the `all` query), `['collection', userSetId, …]`.
  Invalidate `['printings', setId]` after any checklist edit.
- Paste auto-detect needs ≥80 % of lines to match a pattern; tests select the pattern explicitly.
- plpgsql: prefix local variables (`v_slug`) — a bare `slug` was ambiguous with a column (fixed in 0005).

## Next milestone: phase 5 — Bubble Check
Reference behaviour to preserve (see REFERENCE_APPLICATION_ANALYSIS.md): pill grid of card numbers
per set, states missing/owned/partial/complete/excluded, filters (group/rarity, subset, variant),
bulk select → mark owned/not owned/exclude, keyboard navigation, 5-second undo, clipboard copy of
missing/owned (`001 - Name`, `Name (001) - Variant`, tab export). Build on `useSetCollection`
(already optimistic); add a selection model, category/card-scope rule actions, and a virtualised
grid for thousands of cards. Route `/bubble-check` (set picker) and `/sets/:id/bubble`.

## Checks
`export PATH="$HOME/.local/node/bin:$PATH" && npm run check` → typecheck, oxlint, Vitest (90 tests
in 21 files), Vite build (one ~770 kB chunk; splitting deferred).
