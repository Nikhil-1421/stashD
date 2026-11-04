# Binder System

Status: design agreed; implementation in phase 6. Spec input: `docs/BINDER_ENGINE_SPEC.md`.

## Model
- `binders(id, user_id, name, description, cover_image_url, game_id?, default_rows, default_columns, notes, created_at, updated_at)`
- `binder_pages(id, binder_id, page_order, rows, columns, label, created_at, updated_at)` —
  unique `(binder_id, page_order)`; `rows, columns between 1 and 6` (limits are a product setting).
- `binder_placements(id, page_id, slot_index, printing_id, collection_item_id?, notes, created_at, updated_at)` —
  unique `(page_id, slot_index)`; trigger validates `slot_index < rows * columns` of the page.
- Empty slots are the absence of a placement row (sparse). The UI derives `rows*columns` slots.
- Placement never implies ownership; `collection_item_id` is an optional link for "this physical copy".

## Slot math (pure module, tested)
- `slotIndex(row, col, columns) = row * columns + col`; inverse `toCoord(index, columns)`.
- Presets: 2×2, 2×3, 3×4, 3×3, 4×3, 4×4 (rows × columns). Persist dimensions, not preset names.
- Resize remap: keep placements whose `(row, col)` still fit; list the ones that would be dropped;
  require explicit confirmation; apply as one batched write.

## Interactions (target)
Desktop: card source panel · page canvas · inspector. Mobile: page view + bottom-sheet chooser.
Drag/drop (`@dnd-kit`, pointer + keyboard sensors) and an always-available select-card → select-slot
path. Move, swap, remove, duplicate, page add/duplicate/reorder/delete, overview grid, zoom.
Undo stack for placement operations (client-side, bounded).

## Persistence
Debounced batch upserts/deletes per page; explicit Saving / Saved / Failed indicator; pending local
changes retained and retried on failure; conflicts (updated_at mismatch) surface a reload prompt
rather than silently overwriting.

## Layout suggestion (deterministic)
Generate pages from selected printings in a chosen order (set number, checklist order, manual);
preview page count and empty slots; never overwrite an existing binder without confirmation.

## Tests
Slot math and limits; resize preservation/drop preview; move/swap/remove/duplicate; reload
persistence; ownership-independent placements; RLS on pages/placements via binder ownership.
