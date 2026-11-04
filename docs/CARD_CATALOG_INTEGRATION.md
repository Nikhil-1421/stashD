# Card Catalog and Image Source Research

Claude Code: verify all current API details against official documentation before implementing. Do not assume endpoint stability, free tiers, image rights, or commercial use.

## Provider adapter contract
Define a provider-neutral interface with operations such as:
- list/search sets
- get set details
- search cards
- get card details
- obtain printing/variant metadata
- provide image references/URLs
- transform provider checklist to normalized import format

Adapters should return normalized metadata plus provider provenance and attribution/license notes. Keep provider-specific data in metadata JSON only when no stable normalized field exists.

## Research targets
- Pokémon TCG API and official/authorized data sources
- Scryfall for Magic: The Gathering
- YGOPRODeck for Yu-Gi-Oh!
- Lorcana catalog/API sources
- One Piece Card Game catalog/API sources
- sports card catalog providers (commercial restrictions likely differ)
- user-uploaded images/custom card records as universal fallback

## For each source, record
- Official docs URL and access date
- API key/auth requirements
- Rate limits and fair-use constraints
- Set/card/printing/variant coverage
- Image URL behavior and resolution
- Attribution requirements
- Terms, license, commercial use and redistribution restrictions
- Data refresh/update approach
- Failure/timeout handling
- Whether the source is suitable for hobby/personal and future paid application use

## Image policy
- Store source URL and attribution/provenance.
- Prefer lazy loading and responsive image sizes.
- Use user uploads in Supabase Storage with appropriate private/public policies.
- Do not mirror/cache artwork unless terms allow it.
- Provide missing-image placeholder and manual image URL/upload path.
- Avoid scraping pages or bypassing bot/access controls.
- Separate catalog metadata rights from image rights.
- Future monetization requires a fresh licensing review for each provider.

## Documentation output
Maintain `docs/CARD_DATA_SOURCES.md` with an honest comparison table and citations/links. Mark unknown licensing terms as unresolved; do not infer permission from public accessibility.
