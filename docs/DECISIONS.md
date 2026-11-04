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

## D-012 · Account deletion is a hard delete through one SECURITY DEFINER function (2026-11-04)
**Context.** The brief requires an account-deletion flow with confirmation and documented data
handling. The owner approved a hard delete with no grace period.
**Decision.** `public.delete_own_account()` (SECURITY DEFINER, empty `search_path`, no arguments)
deletes `auth.users where id = auth.uid()`; everything user-owned cascades. Executable by
`authenticated` only. The client requires the user to type their email, calls the RPC, then clears
the local session and shows a notice on the login page.
**Consequences.** Every future user-owned table must reference `auth.users`/`profiles` with
`on delete cascade` (checked in review). Storage objects (phase 9) need an explicit cleanup step in the
same function. Recovery after deletion is impossible by design.

## D-013 · Custom catalog rows live in the shared catalog tables with `owner_id` (2026-11-04)
**Context.** The blueprint left open whether user-created sets/cards are separate tables or
owner-scoped catalog rows.
**Decision.** One set of catalog tables. Provider rows have `owner_id null` (public read, no user
writes); custom rows carry `owner_id` and are visible only to the owner. Children (cards, variants,
printings) mirror the parent's `owner_id` via a BEFORE trigger that runs as the caller, so a user
cannot attach rows to a set they cannot see. A CHECK keeps provider/custom origins mutually exclusive.
**Consequences.** No per-user duplication of provider data; one query path for both origins; simple
indexable policies. Promoting a custom set to shared would be an explicit admin operation later.

## D-014 · Printings are materialised rows, auto-created by triggers (2026-11-04)
**Context.** The reference encodes "variant does not exist for this card" as `-1`. We need the same
sparse matrix without the client writing N×M rows by hand.
**Decision.** `card_printings` rows exist only where a card comes in a variant. Inserting a card
creates printings for every variant with `applies_by_default`; inserting such a variant creates
printings for every existing card. Users untick a cell to delete the printing. Creating a custom set
seeds one `base` variant through `create_custom_set()` so cards are ownable immediately.
**Consequences.** Ownership, wishlist, trade and binder placements (later) all reference a printing
id. Deleting a variant deletes its printings and, later, ownership rows that reference them, so the UI
confirms the action.

## D-015 · `user_set_overview` view with `security_invoker` for list screens (2026-11-04)
**Context.** The Collections list needs joined game fields and counts without aggregate-enabled
PostgREST or N+1 requests.
**Decision.** A view with `security_invoker = true` so the caller's RLS applies to every underlying
table; counts are correlated subqueries (fine at hundreds of sets; revisit with materialisation if
needed).

## D-016 · Import commits through one RPC; XLSX deferred (2026-11-04)
**Context.** The brief wants upload → preview → mapping → validation → conflict report → commit
with nothing written before commit, and XLSX among the formats. The npm `xlsx` package is frozen at
0.18.5 (2022) with open advisories; SheetJS now publishes only from its own CDN; `exceljs` is large
and last published in 2024.
**Decision.** Parsing, mapping and matching run in the browser as pure modules
(`features/import/domain`), so the review table is built from the exact payload that will be sent.
`import_checklist()` applies that payload in a single transaction under the caller's RLS and records
a `checklist_import_jobs` row. Paste, CSV, TSV and JSON ship now; XLSX waits for a zero-dependency
reader (zip central directory + `DecompressionStream('deflate-raw')` + `sharedStrings.xml`/sheet
XML, ~150 lines) rather than adopting an unmaintained dependency. The UI tells Excel users to save
as CSV.
**Consequences.** Large imports are chunk-free and atomic up to 5000 rows; above that the user
splits the file. Conflict matching is deterministic and testable without a database.

## D-017 · Requirements are scoped include/exclude rules; completion is computed client-side (2026-11-04)
**Context.** The brief wants completion driven by the user's own rules (variant categories, promos,
language/edition, custom selection) and forbids requirement changes from touching ownership.
**Decision.** `user_set_requirements` holds rules at four scopes (variant_category, variant, card,
printing) with include/exclude; resolution picks the most specific rule and defaults to include, so
a fresh set requires every printing. Ownership lives in `collection_items`; quantity 0 keeps the row
and its notes. Completion is derived in `features/collection/domain` from all printings + rules +
items and never persisted; the overview view only exposes rule-free counts (`owned_printings`,
`printing_count`) for list screens and the dashboard.
**Consequences.** One pure function is the single source of truth for "complete"; the UI exposes
variant-level toggles now and per-printing toggles in the details row; bulk card/printing rules
arrive with Bubble Check selection. Large sets load every printing id once (paged, ~12 requests for
12k printings) and compute in memory; a server-side summary RPC can be added later without
changing the rule model.

## D-018 · Bubble Check: bulk writes via PostgREST upsert, hand-rolled row virtualisation, client-side undo (2026-11-04)
**Context.** Bubble Check needs "mark 500 owned" in one go, a grid that stays smooth with thousands
of pills, and the reference's 5-second undo. Options were a new bulk RPC (another migration the
owner must push), a virtualisation library, and a server-side action history.
**Decision.** Bulk ownership changes go through `collection_items` upsert with `on_conflict =
(user_set_id, printing_id)` in chunks of 500 rows, sending only the quantity column so condition
and notes survive; requirement changes replace the rules at one scope for the selected targets
(`deleteRules` + `upsertRules`). Both run under the existing RLS and the printing-membership
trigger, so no migration. The grid uses fixed pill geometry (56×40 px, 6 px gap) and renders only
the rows inside the window viewport (±6 rows), measured with a ResizeObserver and a passive scroll
listener; no dependency. Undo is a client-side stack of inverse writes (previous quantities /
previous rules) with a toast for 5 s and ⌘Z afterwards; nothing is stored server-side.
**Consequences.** A bulk write is not atomic across chunks (a failure mid-way leaves earlier chunks
applied; the optimistic cache rolls back and the next refetch shows the truth). Pills are uniform
width, so long labels truncate rather than reflow. Undo entries die with the page; a server-side
history can come with export/backup (phase 10) if wanted.

## D-019 · Binder persistence: sparse placements, upsert batches, transactional RPCs; drag/drop deferred (2026-11-04)
**Context.** The binder spec wants real persistence with batched debounced saves, honest save
status, coordinate-preserving resizes, and a non-drag path that always works. The drag library
choice is unsettled: `@dnd-kit/core` 6.3.1 is stable and touch-capable but unmaintained since
December 2024; `@dnd-kit/react` 0.5.x is maintained but pre-1.0; `@atlaskit/pragmatic-drag-and-drop`
4.0 is maintained and small but rides the native HTML drag API, which has no touch drag on Android.
**Decision.** Placements are sparse rows keyed `(page_id, slot_index)`. The editor keeps a local
overlay of edits, coalesces them per slot, and after 800 ms sends one PostgREST upsert for filled
slots plus one delete per page for cleared slots. A failed batch stays pending (status "Save
failed", Retry) and is merged under anything queued since; the page never claims "Saved" until the
server confirmed. Operations that need atomicity run as RPCs under the caller's RLS: create with
first pages, resize (delete + re-insert so the non-deferrable key never clashes), reorder (deferred
unique on page order), duplicate, generate. Slice 1 ships the select-card → select-slot path,
keyboard navigation and undo; drag and drop is slice 2, where the library is chosen with a
one-week spike on touch behaviour rather than guessed now. Page-structure changes flush pending
placements first and refuse to proceed if that flush fails.
**Consequences.** A batch is two statements, not one transaction: a failure between them leaves
upserts applied and deletes pending, which the retry completes. Undo is client-side and dies with
the page. Slots show number / name / variant text only until an image source exists (phase 9).

## D-020 · Drag and drop via `@dnd-kit/react` 0.5, confined to one adapter (2026-11-04)
**Context.** D-019 left the library open. Checked on npm 2026-11-04: `@dnd-kit/core` 6.3.1 last
published December 2024 (unmaintained, ~1 MB unpacked); `@atlaskit/pragmatic-drag-and-drop` 4.0
maintained but built on the native HTML drag API (no touch drag on Android Chrome);
`@dnd-kit/react` 0.5.3 published October 2026, peer `react ^18 || ^19`, ~240 kB unpacked, pointer
sensor with a 250 ms long-press on touch (scrolling still works) and 5 px distance on mouse.
**Decision.** Adopt `@dnd-kit/react`. All library calls live in `features/binders/dnd.ts`
(`useDragSource`, `useDropTarget`) and `BinderDndProvider.tsx`; sources carry a `DragData`
record and targets a `DropData` record, and a completed drag is resolved by the pure
`domain/dnd.ts#resolveDrop` (tested) into a placement op or a page reorder. The library's keyboard
sensor is disabled: slots already have a keyboard path (select → arrows → Enter) and the two would
fight over Space/Enter. Drop targets: every slot (accepts chips and slots), every page tab and
overview thumbnail (accepts chips, slots → first empty slot, pages → reorder).
**Consequences.** A pre-1.0 dependency: the API surface we use is three hooks and one component,
so a breaking release or a swap touches two files. jsdom cannot exercise pointer drags, so the
resolution logic is unit-tested and the gesture itself is verified in the browser pass. Manual
checklist reorder (phase 3 leftover) is *not* taken on here: cards are ordered by number first,
so a drag reorder would need an explicit "manual order" mode per set, which is a phase 7 design
question rather than a drag-library one.
