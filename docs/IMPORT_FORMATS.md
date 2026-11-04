# Import Formats

Status: design; implementation in phase 3.

## Pipeline
upload / paste → parse rows → detect headers → map columns → validate → duplicate & conflict
report → review → commit (transactional). Nothing is written before the user commits; ambiguous
rows are never auto-merged.

## File types
- **CSV / TSV** — RFC 4180 parsing, auto-detected delimiter, UTF-8 with BOM tolerance.
- **XLSX** — first sheet by default, sheet picker; parsed with a maintained library chosen in phase 3.
- **JSON** — either an array of row objects or our own backup format (`schemaVersion` required).

## Column mapping
Recognised headers (case/space-insensitive): `number | no | #`, `name | card`, `rarity`,
`variant | finish | parallel`, `quantity | qty`, `condition`, `notes`, `language`, `artist`,
`external_id`. Unmapped columns can be kept as custom fields. Users can save a mapping per source.

## Paste parser
Configurable patterns, previewed live. Built-in patterns:
- `001 - Card Name`
- `Card Name (001) - Reverse Holo`
- `001\tCard Name\tVariant` (the reference app's clipboard export)
One line = one card; the variant segment, if present, becomes a printing.

## Validation and conflicts
- Required: name; number recommended. Duplicate `(number, variant)` within the file is flagged.
- Existing cards in the target set: offer *skip*, *update metadata*, or *create new*; never
  silently overwrite ownership. Ownership columns (quantity) are imported only when the user opts in.

## Export / backup
CSV and JSON for checklists and collections; backup JSON with `schemaVersion`, validated and
previewed on restore, duplicate handling, transaction-safe import (phase 10).
