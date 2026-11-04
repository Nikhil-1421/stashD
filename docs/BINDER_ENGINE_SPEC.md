# Binder Engine Specification

## Goal
A tactile, responsive virtual planner for physical trading-card binders. It must be a real editing tool and persist data—not a decorative mockup.

## Domain
- Binder: name, description, cover, associated game/sets, default layout.
- Page: ordered page with independent rows/columns, optional label.
- Slot: coordinate/index in page; may be empty.
- Placement: card/printing/variant placed in a slot; optional notes.
- A placement does not imply ownership. A binder can include cards not marked owned.
- A card/variant can be placed more than once if collector has multiple copies or wants a showcase.
- Slots may be empty; page dimensions can change with explicit placement-preservation behavior.

## Layout presets
2×2, 2×3, 3×4, 3×3, 4×3, 4×4, and custom rows/columns with configured maximums. Clarify orientation: rows × columns; 3×4 means 3 rows and 4 columns. Persist dimensions, not preset strings alone.

## Core interactions
- Create, rename, duplicate, archive/delete binder (confirm destructive actions).
- Add/delete/duplicate/reorder pages.
- Change page layout.
- Search/filter cards by set/name/number/variant/ownership.
- Select card then slot as accessible alternative.
- Drag card to slot, move, swap, remove, and duplicate placement.
- Highlight occupied/empty slots and selected target.
- Page navigation and binder overview.
- Preview card image, name, number, variant.
- Zoom/layout controls where helpful.
- Touch/mobile gestures with non-drag alternative.
- Undo last placement operations when feasible.

## Resize and data integrity
When changing rows/columns:
- Preserve placements whose indices remain valid.
- If placements would be removed, show a preview and require explicit confirmation.
- Never silently discard cards.
- Define deterministic mapping if rows/columns change; consider coordinate-based remapping.
- Validate slot index server-side/application-side.
- Unique page slot placement.
- Save batches and debounce; show Saving/Saved/Failed.
- On conflict/network failure, keep local pending changes and allow retry; do not claim saved.

## Suggested UX
Desktop: left card search/collection panel, center binder page canvas, right inspector or contextual controls. Use adjustable panel widths if useful.
Mobile: full-width page preview with page/slot selection and bottom-sheet-like card chooser; no drag-only workflow.
Use image placeholders and graceful missing image handling.

## Suggested auto-layout
Allow user to generate pages from selected checklist cards in a predictable order (set number, checklist order, or manual selection), then edit freely. Clearly preview number of pages and empty slots before generation. Do not automatically overwrite an existing binder without confirmation.

## Tests
- layout slot count and index math
- row/column limits
- page order changes
- placement move/swap/remove
- duplicate placement rules
- resize preservation and destructive preview
- persistence reload
- ownership-independent placements
- RLS for binder/page/placement children
