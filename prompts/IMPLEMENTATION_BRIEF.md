# Claude Code — Collector Platform Implementation Brief

You are the senior product engineer implementing the application described in `CLAUDE.md`. Treat this file as the product brief and `CLAUDE.md` as persistent engineering rules.

## Reference and first steps
Reference application: https://timely-souffle-0c4e55.netlify.app

1. Inspect the repository, package scripts, current routes, components, dependencies, and git status.
2. Use available browser tooling to inspect the reference app's pages and interactions, with special attention to Bubble Check. Record screenshots/notes if supported.
3. Create `docs/REFERENCE_APPLICATION_ANALYSIS.md` distinguishing observed facts from inferred/unknown behavior.
4. Create/update `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, and `docs/DECISIONS.md`.
5. If repo is empty, scaffold the preferred stack. If an established compatible stack exists, preserve it and document deviations.
6. Continue implementation; do not stop at analysis or a proposal.

## Product goal
Build a universal trading-card collection platform with:
- account login and private per-user tracking; initially free, architecture ready for future subscription entitlements
- multiple games, sets, and user-created collections
- checklist import (CSV, XLSX, JSON) plus paste parsing and manual authoring
- card/printing/variant-aware ownership and configurable collection requirements
- interactive Bubble Check
- responsive, dark minimalist dashboard and set navigation
- visual binder designer with 2x2, 2x3, 3x4, 3x3, 4x3, 4x4 and custom row/column layouts
- copy/share missing-card, owned, wishlist, trade, and variant lists
- catalog/image-provider integrations behind adapters
- wishlist/trade tracking, search, export/backup, privacy controls

## Product principles
- Catalog cards and user-owned collection records are separate.
- Card identity, printing, variant, collection requirement, ownership, and binder slot are distinct entities.
- Completion is calculated from a user's requirements, not from hardcoded set assumptions.
- Changing requirements must not delete ownership.
- Binder placement is physical organization, independent of ownership.
- Manual/custom collection workflows work without third-party APIs.
- A user can track duplicates and multiple variants independently.
- Large sets remain performant (pagination/virtualization, indexes, batching, debounced search).
- Public sharing is opt-in and never leaks private data.
- External APIs/images are used only within their terms, rate limits, and license/attribution requirements.

## UX and navigation
Create a cohesive app shell with:
- Dashboard
- Collections / Sets
- Binders
- Bubble Check
- Wishlist
- Trade
- Checklist Library
- Settings

Use collapsible desktop sidebar and compact mobile navigation. Include global search, keyboard-friendly actions, empty states, onboarding, skeletons, clear errors, and responsive layouts.

Dark design direction:
- background `#0B0D10`
- primary surface `#12151A`
- secondary surface `#191D24`
- elevated surface `#20252D`
- primary text `#F1F3F5`
- secondary text `#929BA8`
- border `#272D36`
- restrained accent (blue/violet/teal)
Create tokens rather than scattering values. Avoid visual clutter, excessive gradients/neon, and generic admin-template styling.

## Auth, security, and accounts
Implement Supabase email/password registration, login, email verification, logout, password reset, session persistence, protected routes, profile/settings, and account deletion flow (with confirmation and documented data handling).
Use RLS for every user-private table. Test cross-user isolation. Never use service-role credentials in client code. Keep public catalog data separately permissioned.
No billing/payment implementation now. Create an isolated entitlement/capability service or policy interface, defaulting to free/full initial feature access. Do not scatter tier checks.

## Collection and checklist capabilities
A set supports game/franchise, series, set name/code, release date, language, description, artwork, provider/source, metadata, and checklist.
Cards support name, number, set, rarity, artist, image, language, external IDs, and extensible metadata/custom fields.
Variants/printings can include holo, reverse holo, non-holo, first edition, unlimited, alternate art, full art, promo, parallel, serialized, signed, stamped, etc. Do not universalize game-specific rules; model flexible variant taxonomies.
User set requirements allow include/exclude variant categories, promos, language/edition constraints, and custom selection. Track quantity, condition, notes, owned/wanted/for-trade at suitable card/printing level.
Checklist flows:
1. CSV/XLSX/JSON upload → preview → header detection/mapping → validation → duplicate/conflict report → review → commit.
2. Paste multiline text with configurable parser and preview.
3. Manual creation/edit, bulk add, reorder, variants, images, custom fields.
4. External provider import through adapters.
Never silently overwrite or merge ambiguous data. Provide reversible/clear conflict choices.

## Bubble Check
Recreate the observable useful behavior of the reference and improve it:
- efficient visual bubble/card grid with state legend
- missing, owned, partial, complete, excluded states (based on configured requirements)
- tap/click status update; card detail or accessible variant editing
- filters for ownership, rarity, variant, card number, and search
- bulk select/update, fast navigation, preserve scroll
- responsive touch targets, compact mode, keyboard navigation
- immediate progress feedback with optimistic update rollback
- large-set performance; virtualization when needed
Document any differences from the reference.

## Binder engine (core differentiator)
Build a dedicated domain model and UI, not a static mock.
- Binder metadata: name, description, cover, game, associated sets, default layout, notes.
- Page layouts: rows × columns; preset 2x2, 2x3, 3x4, 3x3, 4x3, 4x4 plus custom dimensions with sensible limits.
- Pages can be created, deleted, duplicated, reordered, and individually configured.
- Slots can be empty. Users can drag cards/variants into slots, move/swap/remove placements, assign from checklist/search, and add duplicates across slots.
- Provide slot selection/highlight, card preview, zoom, page navigation, responsive touch behavior, and binder overview.
- Persist binder/page/slot state with efficient batched/autosave writes, explicit save status, retry/error feedback, and no destructive silent overwrite.
- Keep physical layout independent of checklist order and ownership.
- Design a clean placement schema and constraints; validate slot indices against page layout.
- Include keyboard-accessible alternatives to drag/drop (select card then select slot, move controls).
- Add undo for common placement operations if practical.
- Future feature: generate suggested binder layouts from collection requirements. For initial implementation, support a reliable deterministic layout suggestion (e.g. checklist order, selected cards, set number) and let users edit it. Do not promise automatic optimal arrangement without defined criteria.

## Card catalog and images
Research and document sources in `docs/CARD_DATA_SOURCES.md`:
- Pokémon TCG API / legally accessible Pokémon catalog sources
- Scryfall (Magic)
- YGOPRODeck (Yu-Gi-Oh!)
- research viable Lorcana and One Piece catalog APIs
- sports card data sources, distinguishing commercial licensing limitations
For each, record API/auth, rate limits, data fields, images, terms/licensing, attribution, and commercial-use restrictions. Verify current facts via official documentation/web where available.
Implement a provider interface (search sets/cards, get set/card, variants, image URLs, checklist import) with independent adapters. External provider failures must degrade gracefully. Do not scrape prohibited sources or redistribute images without rights.
Image support: provider URL, user-upload to Supabase Storage, optional compliant caching, lazy loading, fallback placeholders, and image attribution/source metadata. Do not assume external images are permanent.

## Dashboard and management
Dashboard: sets tracked, unique cards, total quantity, overall completion, per-game progress, recent activity, favorites, active binders, recently added, missing cards, quick actions. Helpful onboarding for empty account.
Set library: search/filter by game, series, year, favorites/recent; add from catalog/import/custom/duplicate; set detail with progress, requirements, variants, missing/owned, checklist, Bubble Check, binder, import/export.
Bulk operations accessible in dashboard, checklist, and Bubble Check.
Global search across cards, sets, numbers, variants, binders. Index appropriately and debounce.

## Sharing and copy/paste
Clipboard formats should be configurable and include:
- `001 - Card Name`
- `Card Name (001) - Reverse Holo`
Offer copy missing/owned/wishlist/trade/selected cards/variants/checklist.
Public share links for collection summaries, missing lists, and binders are opt-in, revocable, and permission scoped. Avoid exposing profile/email/private notes. Include share preview and privacy controls.

## Wishlist, trade, backup
Wishlist/trade status integrates with collection and variant records, supports notes, filters, and copy/export.
Export CSV/JSON for collections/checklists and practical binder data. Backup/restore with schema version, validation, preview, duplicate handling, and transaction-safe import. Users retain control of their data.

## Data architecture and deliverables
Design normalized PostgreSQL schema and migrations. Candidate entities (refine after modeling):
- profiles
- games
- catalog_providers
- catalog_sets
- catalog_cards
- card_printings (or equivalent)
- variant_definitions / printing_variants
- user_sets
- user_set_requirements
- collection_items / ownership records
- binders
- binder_pages
- binder_slots / placements
- wishlist_items
- trade_items
- checklist_import_jobs
- collection_shares
- user_preferences
- activity_events (only if justified)
Use UUIDs, foreign keys, indexes, unique constraints, timestamps, integrity rules, and clear deletion behavior. Avoid duplicating catalog records per user; custom records must be supported cleanly.
Create SQL migrations and `docs/DATABASE_SCHEMA.md` with ERD (Mermaid is fine), key constraints, RLS matrix, and query/index rationale.
Use generated Supabase types if the project setup supports it.

## Testing and acceptance criteria
Unit tests:
- requirement-aware completion
- variant/printing ownership
- import parsers and mapping
- bulk updates
- binder slot math/validation
- copy formatting
- backup validation

Integration:
- auth/session
- user collection persistence
- RLS cross-user isolation
- checklist import
- binder persistence
- share visibility/revocation

E2E:
1. Register/login.
2. Create custom set and cards.
3. Import checklist and review.
4. Configure required variants.
5. Mark ownership/quantity and verify progress.
6. Use Bubble Check filters and bulk changes.
7. Create binder and choose layout.
8. Place, move, swap, and remove cards; reload and verify.
9. Copy missing list.
10. Export and restore safely.
11. Verify a second account cannot access first account's private data.

## Phased execution
Maintain roadmap and execute in vertical slices:
1. Repo/reference analysis + foundation + app shell + Supabase setup/auth.
2. Catalog/custom set/card/variant schema and CRUD.
3. Checklist import/manual/paste.
4. Collection tracking, requirements, progress.
5. Bubble Check.
6. Binder engine.
7. Dashboard, global search, bulk operations.
8. Wishlist/trade, sharing, copy formats.
9. Catalog adapters/image sources.
10. Export/backup, hardening, accessibility, deployment.

For each phase:
- define acceptance criteria
- implement
- run checks
- review security and UX
- update docs/roadmap
- report completion and next step

## Initial milestone: implement now
After inspection, deliver a working first slice:
- responsive dark application shell
- Supabase configuration and safe environment handling
- authentication screens and protected app routes
- initial profile migration/RLS
- dashboard empty state and navigation
- README setup instructions
- tests/build/typecheck passing

If Supabase credentials are not available, implement configuration and local-safe states without fabricating a successful connection. Continue with code and document required setup.

Do not stop at planning. Start inspecting and building now.
