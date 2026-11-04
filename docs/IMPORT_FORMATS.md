# Import Formats

Status: implemented for paste, CSV, TSV and JSON (phase 3, 2026-11-04). XLSX deferred (D-016).

Code: `src/features/import/domain/` (`delimited.ts`, `mapping.ts`, `paste.ts`, `json.ts`, `plan.ts`,
all pure and unit-tested), `src/features/import/ImportPage.tsx` (wizard at `/sets/:id/import`),
`import_checklist()` in `supabase/migrations/20261104300000_checklist_import.sql`.

## Pipeline
upload / paste → parse rows → detect headers → map columns → validate → duplicate & conflict
report → review → commit (transactional). Nothing is written before the user commits; ambiguous
rows are never auto-merged.

## File types
- **CSV / TSV** — RFC 4180 parsing, auto-detected delimiter (`,` `\t` `;` `|`), UTF-8 with BOM
  tolerance, quoted newlines. Files up to 5 MB.
- **XLSX** — not yet; the UI explains how to save as CSV. See D-016 for the reason and the planned
  zero-dependency approach.
- **JSON** — an array of flat row objects (keys become headers) or an object with a `cards` array
  (the future backup format).

## Column mapping
Recognised headers (case/space/punctuation-insensitive): `number | no | # | card number | collector
number | id`, `name | card | title | player | character`, `rarity`, `variant | finish | parallel |
printing | edition | foil | subset`, `quantity | qty | count | owned`, `condition | grade`, `notes`,
`language | lang`, `artist | illustrator`, `external_id | provider id`. Each field maps to one column;
the user can override every column. A header row is detected when any cell matches an alias and
can be toggled by hand. Written today: number, name, rarity, variant, artist, language, external id.
Quantity/condition/notes are recognised but not written until collection tracking (phase 4).
Not yet: saving a mapping per source, keeping unmapped columns as custom fields.

## Paste parser
Patterns are auto-detected (≥80 % of the first 20 lines must match) or chosen explicitly; the
page shows live counts of recognised / not-understood lines. Built-in patterns:
- `001 - Card Name` with an optional trailing ` - Variant`
- `Card Name (001) - Reverse Holo`
- `001\tCard Name\tVariant` (the reference app's clipboard export)
- one name per line
One line = one card; the variant segment, if present, becomes a printing. Lines that do not match
are listed with their line numbers on the review step and skipped.

## Validation and conflicts
- Required: name (≤200); number ≤30; rarity/variant truncated to 60. Rows are grouped by number
  (or by name when there is no number); extra lines for the same card add printings; exact repeats
  of `(number, variant)` are reported as duplicates and folded into the first line.
- Existing cards are matched by number first, then by name when the row has no number. The review
  step offers *skip* (default; new printings are still added), *update* (fill name/number/rarity/
  artist/language from the file where it has a value) or *create* (insert duplicates). Ownership
  rows are never touched by an import.
- Variants named in the file that do not exist in the set are created with
  `applies_by_default = false`, so existing cards gain nothing they were not listed for.
- Limit: 5000 rows per import (client and function). The commit is one transaction: if anything
  fails, nothing is written and the error is shown on the review step.

## Export / backup
CSV and JSON for checklists and collections; backup JSON with `schemaVersion`, validated and
previewed on restore, duplicate handling, transaction-safe import (phase 10).
