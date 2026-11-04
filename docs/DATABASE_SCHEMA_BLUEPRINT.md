# Database Schema Blueprint (Design Guide)

This is a proposed model, not an instruction to apply a production migration blindly. Refine it against repository state and document final decisions.

## Core separation
- **Catalog layer**: reusable game/set/card/printing metadata.
- **User layer**: user's tracked sets, requirements, ownership, binders, wishlist/trade.
- **Sharing layer**: narrowly scoped public share tokens/settings.

## Suggested entities

### `games`
`id`, `slug` (unique), `name`, `description`, `metadata`, timestamps.
Catalog-level game/franchise (Pokémon, MTG, sports, etc.).

### `catalog_providers`
`id`, `slug` unique, `name`, `base metadata`, `terms_url`, `attribution_policy`, `status`.

### `catalog_sets`
`id`, nullable `game_id`, nullable `provider_id`, `provider_set_id`, `name`, `set_code`, `series`, `release_date`, `language`, `description`, `image_url`, `metadata`, timestamps.
Unique provider identity where provider IDs exist. Custom sets can have no provider.

### `catalog_cards`
`id`, nullable `catalog_set_id`, `provider_id`, `provider_card_id`, `name`, `number`, `rarity`, `artist`, `language`, `image_url`, `metadata`, timestamps.
Use provider-scoped unique IDs; support custom cards without provider IDs.

### `card_printings` / `card_variants`
Model physical printing and variant distinctions without assuming a single universal taxonomy. A printing can carry edition, finish, language, promo/stamp, parallel, serial metadata. Use structured columns for commonly queried dimensions and JSONB only for provider-specific extensions.
Potential tables:
- `variant_definitions` (game/set-specific category definitions)
- `card_printings` (concrete collectible printing)
- `printing_variant_values` only if flexible multi-valued taxonomies are required.
Do not over-normalize prematurely; explain tradeoffs.

### `user_sets`
`id`, `user_id`, nullable `catalog_set_id`, `custom_name`, `tracking_name`, `status`, `favorite`, `metadata`, timestamps.
Unique constraint prevents duplicate tracking of same catalog set per user, while custom sets remain allowed.

### Custom checklist ownership
For user-created cards/sets, decide whether custom catalog rows are owner-scoped or attached to user set. Never expose private custom content publicly by accident. Document the choice and RLS.

### `user_set_requirements`
`id`, `user_set_id`, scope (set/card/variant/category), inclusion/exclusion rule, structured criteria, timestamps.
Requirements are configuration, not ownership. Validate criteria and calculate completion consistently in domain code or carefully tested SQL.

### `collection_items`
`id`, `user_id`, `user_set_id`, printing/card reference, `quantity`, `condition`, `status` (owned/wanted/for_trade as suitable), `notes`, timestamps.
Use a clear model for quantity and status: avoid ambiguous combinations. Consider separate ownership quantity and wishlist/trade records. Unique keys should reflect a user's tracked printing and set.

### `wishlist_items` and `trade_items`
Use user/set/card/printing references, quantity/notes, timestamps; decide if trade quantity must not exceed owned quantity and enforce appropriately in application logic.

### `binders`
`id`, `user_id`, `name`, `description`, `cover_image`, `default_rows`, `default_columns`, `metadata`, timestamps.

### `binder_pages`
`id`, `binder_id`, `page_order`, `rows`, `columns`, `label`, timestamps.
Unique `(binder_id, page_order)`.

### `binder_slots` (or placements)
`id`, `page_id`, `slot_index`, nullable card/printing/variant reference, nullable collection item reference, `notes`, timestamps.
Unique `(page_id, slot_index)`. Validate `slot_index < rows * columns`. Empty slots may be represented by absence of placement rows or explicit empty slots; choose one approach and explain. Prefer sparse placement rows for empty slots unless UI needs slot identity.

### `collection_shares`
`id`, owner user, resource type/id, random token hash (never store raw secret if avoidable), scope, expiration, revoked_at, timestamps.
Share endpoints/views must return only explicitly allowed fields. Use unguessable tokens, revocation, and rate limiting where possible.

### `checklist_import_jobs`
`id`, `user_id`, target user_set, source filename/type, mapping config, status, validation summary, errors, timestamps. Avoid retaining raw uploads longer than needed; define storage/cleanup.

### `profiles`
`id` references `auth.users`, display name, avatar, preferences, timestamps. RLS owner-only.

## Security/RLS matrix
Document and test policies for every table:
- Catalog public read; writes restricted to trusted ingestion/admin paths.
- User tables: owner can CRUD only their rows.
- Child tables: authorization derives through parent ownership, not a user-supplied `user_id` alone.
- Public shares: read only through a validated share token/function/view, never broad anonymous SELECT on private tables.
- Storage: private user uploads scoped to authenticated user path; public images only if intentionally public and licensed.
- Never ship service-role key to browser.

## Index strategy
At minimum evaluate:
- provider IDs + provider slug
- set/game/search fields
- card set + number
- card name search (appropriate trigram/full text)
- user_sets by user
- collection_items by user/set and card/printing
- binder pages by binder/order
- placements by page/slot and card
- shares by token hash/revocation
- imports by user/status

## Completion calculations
Create one tested domain function that:
1. Resolves a user's active requirements.
2. Enumerates required card/printing/variant targets.
3. Determines owned quantities/status at the right granularity.
4. Calculates complete/partial/missing and percentage.
5. Handles exclusions and zero-required sets.
6. Avoids double-counting.
7. Is tested against game-specific and custom cases.
Do not store a single percentage as source of truth; cache only with invalidation strategy if performance needs it.
