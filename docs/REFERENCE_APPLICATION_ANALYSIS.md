# Reference Application Analysis

Reference: https://timely-souffle-0c4e55.netlify.app ("Collection Tracker")
Analysed: 2026-11-04

## How this was inspected

No browser automation tools were available in the implementation environment, so the app was not
exercised interactively. Instead the deployed page was downloaded and its complete source was read:
it is a single `index.html` (≈332 KB) containing inline CSS, ≈240 lines of vanilla JavaScript, and
two gzip+base64 data blobs that the page decompresses at load time. Because the entire client logic
is in that file, the behaviour below is **read from source** rather than inferred from screenshots.
Anything that would only be visible at runtime (animation feel, exact layout on a given device) is
marked as inferred.

## Observed facts (from source)

### Architecture
- One static HTML file, no framework, no build step, no backend, no network calls other than Google
  Fonts (DM Sans, Space Mono).
- All catalog data is embedded: `D_B64` decodes to a JSON array of **30 sets / 6,165 cards**;
  `L_B64` decodes to 26 set logos as base64 PNG data URIs.
- Ownership state is persisted in `localStorage` under `mct-v3` (a nested array of per-card
  variant values), with variant visibility under `mct-v3-vis` and notes under `mct-v3-notes`.
- Single-user, device-local. No accounts, no sync, no sharing.
- The shipped data already contains the author's own ownership marks (many cards shipped as owned),
  which `expand()` merges with any saved state. New visitors therefore start from the author's
  collection, not an empty one.

### Data model
- Set: `{ n: name, vn: variant names[], c: cards[], cat: category }`.
- Card: `[number, name, values[]]` where `values[i]` corresponds to `vn[i]` and is
  `-1` = variant does not exist for this card, `0` = needed, `1` = owned. Ownership is boolean per
  (card, variant); there is **no quantity**, condition, or notes per card.
- Categories: Pokémon (26 sets), F1 (2), Basketball (1), Football (1).
- Variants are set-specific strings, e.g. `['base','rev holo']`, `['base','pokeball','masterballl']`
  (sic), `['Have']` for sports, and 30 parallel names for 2024 Topps Chrome F1.
- Two side tables keyed by set index and card index: `GROUPS` (rarity grouping such as `bulk`,
  `bulk-holo`, `ex`, `ir`, `sir`, `Full Art`, `Secret Rare`, …) and `SUBSETS` (insert names such as
  `F1 Drivers`, `Rookies`, `Top 100`). Not every set has these.
- Sets are grouped into "eras" by category with an accent color per era.

### Screens and interactions
1. **Home / Sets tab**: global progress ring (owned ÷ total visible variants), search across set
   names and card names, era-labelled list of set rows with logo/initials, `owned/total · N cards`,
   variant tags (struck through when hidden), progress bar and percent.
2. **Home / Needed tab**: every needed (card, variant) across all sets, grouped by set, with a
   check button to mark owned inline; count of "variants still needed".
3. **Set detail (list mode)**: sticky header with back button, logo, progress ring, gear button;
   search box; All / Needed / Have filter; toolbar with "⊙ Bubble" and "📝 Notes (n)"; a legend bar
   with abbreviated variant labels; one row per card with number, name and one checkbox per visible
   variant (`—` where the variant does not exist). Rows are grouped by rarity group or subset with
   headings. Fully-owned rows get a tinted background.
4. **Bubble mode ("Bubble Sort")**: black background; a wrapped flex grid of pill buttons, one per
   (card, visible variant). Label = card number, plus a one-letter suffix for a non-primary variant
   (e.g. `12r` for reverse holo) or a group abbreviation (`ex`, `ir`, `sir`, `FA`, `SR`…) for
   single-variant sets. Owned pills are dimmed and struck through. Tap toggles ownership. Filter chips
   for All / each group / each subset. Progress ring in the header.
5. **Settings sheet (gear)**: bottom sheet with a toggle per variant to hide it (hidden variants are
   excluded from totals and from the grids), bulk "✓ All / ✗ Clear" for the entire set, per variant,
   per rarity group and per subset, and "Copy Needed / Copy Collected" to clipboard. Changes to
   visibility apply on "Apply".
6. **Notes sheet**: free-text timestamped notes per set, newest first, deletable.
7. **Undo**: every single toggle pushes a one-item undo stack and shows a toast for 5 s.
8. **Reset Collection**: `confirm()` then clears all three localStorage keys and reloads.
9. **Clipboard export format**: header line `"<Set> - Needed (N)"`, a rule, then tab-separated
   `#\tName\tVariant` rows.

### Completion semantics
- Per set: total = count of `values[i] !== -1` for visible variants; owned = count `> 0`. Percent
  rounded. Hidden variants are excluded from both numerator and denominator. This is the reference
  app's (implicit) "requirements" concept: visibility toggles double as collection requirements.

### Visual design (from CSS)
- Background `#2a2a3d`, text `#e8e8f0`, accent `#e94560` (pink-red) plus 9 era colors; bubble mode
  uses pure black. Translucent white surfaces, 8–12 px radii, small type (10–13 px), monospace for
  numbers/labels. Scrollbars hidden. Mobile-first: `max-width: 500px` sheets, safe-area insets,
  `user-scalable=no`.

## Inferred / unknown
- Exact rendering and animation feel on devices (not executed).
- Whether the author intends the embedded ownership data to be visible to others (it is).
- Source and licence of the embedded set logos (unknown; likely publisher artwork). **We will not
  reuse them.**
- Why `Bubble Sort` is the header label of bubble mode (probably a naming quirk, not a sort).
- Performance with the 786-card football set is not measured; the grid is not virtualised, and
  every state change re-renders the entire page via `innerHTML`.

## What to preserve
- Bubble Check's core loop: dense tappable pills per (card, variant), instant progress feedback,
  dimmed/struck owned state, filter chips by group/subset, number-plus-suffix labels.
- Variant columns in the list view with `—` for non-existent variants.
- Variant visibility as a cheap way to express "what I collect", bulk mark/clear at set, variant,
  group and subset level, copy needed/collected, per-set notes, single-step undo, search and
  Needed/Have filters, grouping by rarity/subset, global "Needed" view.

## What to improve (and why)
- Accounts and server persistence with RLS instead of device-local state; no author data baked in.
- Quantity, condition and per-card notes; wishlist/trade status; separate ownership from
  requirements (invariant 4) instead of overloading visibility.
- A real requirements model (include/exclude variant categories, promos, language) feeding one tested
  completion function instead of the implicit visibility rule.
- Binder planning, which the reference does not have at all.
- Import/paste/manual checklist authoring; the reference has no way to add a set.
- Accessibility: the reference uses `onclick` on `div`s/`button`s without labels, hides scrollbars,
  blocks zoom, and has 7–10 px type in places; we must meet contrast, focus and touch-target rules.
- Performance: virtualised lists/grids for 500+ card sets; targeted re-renders.
- Keyboard navigation, multi-step undo, explicit save status.

## Differences we knowingly introduce
- Dark palette from `docs/UI_UX_SPEC.md` rather than the reference's indigo/pink.
- Desktop layout with sidebar (reference is phone-only).
- Set logos/images only from licensed providers or user uploads.
