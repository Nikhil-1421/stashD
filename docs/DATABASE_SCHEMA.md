# Database Schema

Source of truth: `supabase/migrations/`. This document explains the model, constraints, RLS and
indexes. Updated 2026-11-04 (milestone 1: `profiles` only; the rest is the agreed target model).

## Implemented

### `public.profiles` — migration `20261104000000_profiles.sql`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK → `auth.users(id)` on delete cascade | one row per user |
| `display_name` | text, null or 1–80 chars | shown instead of email where sharing exists |
| `avatar_url` | text ≤ 2048, nullable | Storage URL later |
| `preferences` | jsonb object, default `{}` | UI prefs (clipboard format etc.) |
| `created_at`, `updated_at` | timestamptz | `updated_at` maintained by trigger |

- Trigger `on_auth_user_created` → `handle_new_user()` (SECURITY DEFINER, `search_path = ''`) inserts
  the row, copying `raw_user_meta_data.display_name` if present.
- Trigger `profiles_set_updated_at` → `set_updated_at()` (reused by all later tables).
- Grants: `authenticated` may select/insert/update; `anon` has none.

**RLS**

| Operation | Policy | Rule |
| --- | --- | --- |
| select | owner can select | `(select auth.uid()) = id` |
| insert | owner can insert | `with check (select auth.uid()) = id` |
| update | owner can update | using + with check as above |
| delete | — | none; cascades from `auth.users` only |

Tested by `supabase/tests/database/profiles_rls.test.sql` (pgTAP; **not yet executed**, see
`docs/ROADMAP.md` blockers).

### `public.delete_own_account()` — migration `20261104100000_account_deletion.sql`

SECURITY DEFINER function, `authenticated` only, no arguments. Deletes the caller's `auth.users`
row; `profiles` (and all future owned tables) cascade. Raises `42501` when called without a
session. Irreversible (D-012).

### Catalog layer + user_sets — migration `20261104200000_catalog_and_user_sets.sql`

| Table | Purpose | Ownership / RLS |
| --- | --- | --- |
| `games` | franchise reference data (seeded: Pokémon, Magic, Yu-Gi-Oh!, Lorcana, One Piece, F1, basketball, football, baseball, soccer, other) | public read, no user writes |
| `catalog_providers` | adapter registry with terms/attribution (seeded: tcgdex, scryfall, ygoprodeck as `planned`) | public read |
| `catalog_sets` | provider sets (`provider_id`+`provider_set_id`, `owner_id null`) or custom sets (`owner_id`) | read: shared or own; write: owner only |
| `catalog_cards` | card identity; `sort_key` generated from `number`; trigram index on `name` | mirrors set owner (trigger) |
| `variant_definitions` | per-set taxonomy (`slug` unique per set; `category`; `applies_by_default`) | mirrors set owner |
| `card_printings` | card × variant existence; unique pair; variant must belong to the card's set (trigger) | mirrors card owner |
| `user_sets` | user ↔ catalog set tracking; unique `(user_id, catalog_set_id)` | owner only |
| `user_set_overview` (view) | joined fields + `card_count`, `variant_count`; `security_invoker` | caller's RLS |

Functions: `card_number_sort_key(text)` (immutable), `create_custom_set(...)` (security invoker;
set + `base` variant + tracking row), triggers `catalog_child_sync_owner`,
`catalog_cards_create_default_printings`, `variant_definitions_create_default_printings`.

Indexes: provider keys (partial unique), `(catalog_set_id, sort_key, position)`, owner partial
indexes, `(user_id, status)`, trigram on card name.

## Target model (phases 2–8)

```mermaid
erDiagram
  profiles ||--o{ user_sets : owns
  profiles ||--o{ binders : owns
  profiles ||--o{ collection_shares : owns
  games ||--o{ catalog_sets : has
  catalog_providers ||--o{ catalog_sets : sources
  catalog_sets ||--o{ catalog_cards : contains
  catalog_cards ||--o{ card_printings : "printed as"
  variant_definitions ||--o{ card_printings : classifies
  catalog_sets ||--o{ user_sets : "tracked as"
  user_sets ||--o{ user_set_requirements : configures
  user_sets ||--o{ collection_items : holds
  card_printings ||--o{ collection_items : "owned as"
  card_printings ||--o{ wishlist_items : wanted
  card_printings ||--o{ trade_items : offered
  binders ||--o{ binder_pages : has
  binder_pages ||--o{ binder_placements : fills
  card_printings ||--o{ binder_placements : "placed as"
  user_sets ||--o{ checklist_import_jobs : receives
```

### Entity intent (one line each)

- **games** — franchise (Pokémon, MTG, F1 Topps…). Public read.
- **catalog_providers** — adapter registry with terms/attribution text. Public read.
- **catalog_sets / catalog_cards** — shared metadata. Provider-sourced rows are public read;
  **custom rows carry `owner_id`** and are visible only to their owner (RLS `owner_id is null or
  owner_id = auth.uid()`), which resolves the "custom checklist ownership" question in the blueprint
  without duplicating provider data per user.
- **variant_definitions** — per game/set taxonomy (holo, reverse, 1st edition, parallel name,
  serial…). No universal enum.
- **card_printings** — a concrete collectible: card × variant definition (+ language, edition).
  Ownership, wishlist, trade and placements all reference printings so "duplicates" and "multiple
  variants" are independent rows.
- **user_sets** — a user tracking a catalog set or a custom set; unique `(user_id, catalog_set_id)`
  where not null.
- **user_set_requirements** — include/exclude rules (scope: set / variant category / printing /
  language) → input to the single `computeCompletion()` domain function. Changing rules never
  touches `collection_items` (invariant 4).
- **collection_items** — `(user_set_id, printing_id)` unique; `quantity ≥ 0`, `condition`, `notes`.
  Status (owned / wanted / for-trade) is **not** a column here; wishlist and trade are separate
  tables so quantities don't become ambiguous.
- **wishlist_items / trade_items** — per printing, quantity + notes; trade quantity ≤ owned is
  enforced in domain code with a DB check where feasible.
- **binders / binder_pages / binder_placements** — `pages (binder_id, page_order)` unique; `rows`,
  `columns` per page with limits; placements `(page_id, slot_index)` unique, `slot_index <
  rows*columns` enforced by a trigger that reads the page; placement optional
  `collection_item_id`; empty slots are *absent rows* (sparse) — the UI derives slot identity from
  index.
- **collection_shares** — `token_hash` (sha-256 of a random token), scope, expiry, `revoked_at`;
  read via a SECURITY DEFINER function returning only whitelisted fields.
- **checklist_import_jobs** — mapping config, validation summary, status; raw upload not retained
  after commit.

### RLS matrix (target)

| Table | anon | authenticated owner | other users |
| --- | --- | --- | --- |
| games, catalog_providers | read | read | read |
| catalog_sets/cards/printings (provider) | read | read | read |
| catalog_sets/cards/printings (custom, `owner_id`) | — | CRUD | — |
| user_sets, requirements, collection_items, wishlist, trade | — | CRUD | — |
| binders → pages → placements | — | CRUD via parent ownership | — |
| collection_shares | via token function only | CRUD | via token function only |
| profiles | — | select/insert/update | — |

Child tables derive authorization from the parent (`exists (select 1 from binders b where b.id =
binder_id and b.user_id = auth.uid())`), never from a user-supplied `user_id`.

### Index plan

- `catalog_sets (provider_id, provider_set_id)` unique where provider_id not null; `(game_id)`.
- `catalog_cards (catalog_set_id, number)`; trigram index on `name` for search.
- `card_printings (catalog_card_id)`, `(variant_definition_id)`.
- `user_sets (user_id)`, `collection_items (user_set_id)`, `(printing_id)`.
- `binder_pages (binder_id, page_order)` unique; `binder_placements (page_id, slot_index)` unique,
  `(printing_id)`.
- `collection_shares (token_hash)` unique; partial index on `revoked_at is null`.
- `checklist_import_jobs (user_id, status)`.

### Completion

One domain function (`features/collection/domain/completion.ts`, phase 4): resolve active
requirements → enumerate required printings → look up owned quantities → classify
complete / partial / missing / excluded → percentage. Never persisted as a source of truth.
