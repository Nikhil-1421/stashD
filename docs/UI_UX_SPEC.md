# UI/UX Specification

## Brand and feel
Minimal, premium, dark, calm, collector-focused. Dense enough for large checklists, spacious enough for binder visuals.

## Tokens
- `--bg: #0B0D10`
- `--surface-1: #12151A`
- `--surface-2: #191D24`
- `--surface-3: #20252D`
- `--text: #F1F3F5`
- `--text-muted: #929BA8`
- `--text-subtle: #68717D`
- `--border: #272D36`
- Accent: restrained blue/violet/teal with semantic success/warning/error colors.
Define tokens in one place and ensure accessible contrast.

## Layout
- Desktop collapsible sidebar + top utility/search bar + content.
- Mobile compact nav; avoid forcing desktop tables/canvas on small screens.
- Use consistent spacing, typography, card density, and page headings.
- Prefer inline actions and contextual panels over modal chains.

## Core components
- App shell, sidebar/nav, command/search palette.
- Set tile, card tile, card row, variant chip.
- Progress bar/ring, completion summary.
- Checklist table/grid with selection.
- Bubble Check cell and legend.
- Binder page/canvas, slot, page navigator, placement inspector.
- Import wizard, mapping table, validation summary.
- Empty/loading/error states, toast, confirmation dialog.
- Share preview/privacy controls.

## Interaction standards
- Every clickable item has hover/focus/pressed/disabled states.
- Keyboard support for selection, bulk actions, dialogs, navigation.
- Drag-and-drop must have keyboard/touch alternative.
- Respect `prefers-reduced-motion`.
- Use optimistic UI only with rollback and visible failure.
- Avoid layout shift; reserve image dimensions.
- Keep bulk actions discoverable without visual clutter.

## Dashboard
Show useful summary cards, recent sets, active binders, collection progress, missing-card quick access, and clear actions. Empty dashboard guides user to create/import a first set.

## Quality review
At each milestone, inspect desktop and mobile; verify focus order, contrast, touch target sizes, loading/error/empty states, and consistency.
