# UI/UX Specification

## Brand and feel
Minimal, premium, dark, calm, collector-focused. Dense enough for large checklists, spacious enough for binder visuals.
The brand is **stashD** (always written that way). Source of truth: `stashD-brand-kit/` and its
`stashD-brand-guide.pdf` (v1, November 2026). Applied 2026-11-04 (D-023).

- **Logo.** Horizontal lockup on dark (fanned hand + gold wordmark) in the expanded sidebar and on
  auth pages, never under 160 px wide; the gold D card (the kit's favicon artwork) in the collapsed
  sidebar and the mobile top bar. Artwork files are used as-is: no stretching, rotating, retyping,
  glow or shadow. The logo always sits on an ink panel, never straight on the starfield.
- **Type.** Space Grotesk variable font, self-hosted (`src/assets/fonts`, OFL). The guide sets
  Light 300 for headings and Regular 400 for body, buttons and labels; the owner tuned these to
  **350 and 500** (2026-11-04) so text stays crisp over the starfield. Use only `font-light`
  (headings) and `font-normal` (everything else): both are remapped in `@theme`, so never use
  `font-medium`/`font-semibold`/`font-bold`. Captions are 11 px, uppercase, tracked
  (`text-caption`). Numbers use the same family with tabular figures.
- **Gold.** Flat `#D4AF37` for accents, borders on hover/active, progress and focus rings; the 135°
  gradient (`bg-gold-gradient`) only for the primary button. Ink text on gold (8.9:1). No gold text
  on light surfaces.
- **Background.** `Starfield` (`components/layout`): a fixed canvas behind every page, a slow
  forward flight through a black field of brand-gold points with slight sway and twinkle. ~16 depth
  units/s, 30 fps cap, paused when the tab is hidden, a single still frame under
  `prefers-reduced-motion`. Decorative only (`aria-hidden`, no pointer events).
- **Surfaces.** Stash Ink at 56–76 % opacity so stars read through boxes; sticky bars use
  the canvas colour at 80–85 % with a backdrop blur. Native select menus use opaque ink.

## Tokens (`src/styles/index.css`)
- `--color-canvas: #050609` (black ground under the starfield)
- `--color-surface-1: rgb(17 18 24 / 0.56)` (Stash Ink) · `surface-2: rgb(27 29 38 / 0.65)` · `surface-3: rgb(38 40 52 / 0.76)` · `surface-solid: #111218`
- `--font-weight-light: 350` (headings) · `--font-weight-normal: 500` (body, buttons, labels)
- `--color-fg: #FFFFFF` · `fg-muted: #8E92A0` (Mist, 6.0:1) · `fg-subtle: #767A89` (4.5:1)
- `--color-line: rgb(142 146 160 / 0.2)` · `line-strong: rgb(212 175 55 / 0.45)` (gold hairline on hover/active)
- `--color-accent: #D4AF37` · `accent-hover: #E3C86E` · `accent-fg: #111218` · `accent-soft: rgb(212 175 55 / 0.14)`
- Semantic: success `#4CC38A`, warning `#E8894A` (orange, kept apart from gold), danger `#E5616F`
- `--gradient-gold: linear-gradient(135deg, #BA972E 0%, #D4AF37 42%, #E3C86E 52%, #D4AF37 62%, #BA972E 100%)`
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
