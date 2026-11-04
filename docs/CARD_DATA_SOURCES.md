# Card Data Sources

Research date: 2026-11-04. Facts below were read from the cited pages on that date unless marked
*unverified*. Public accessibility is **not** permission: every row marked "unresolved" needs a
terms review before use, and all rows need a fresh review before any paid tier.

## Provider adapter contract (to implement in phase 9)

```ts
interface CatalogProvider {
  slug: string
  listSets(query): Promise<ProviderSetSummary[]>
  getSet(id): Promise<ProviderSet>
  searchCards(query): Promise<ProviderCardSummary[]>
  getCard(id): Promise<ProviderCard>           // includes printings/variants + image refs
  toChecklist(setId): Promise<NormalizedChecklist>  // feeds the import pipeline
  attribution: { text: string; url: string }   // rendered wherever provider data is shown
}
```
Adapters return normalized fields plus `provenance` (provider, id, fetched_at, terms_url). Failures
(timeout, 429, outage) surface as a typed error; manual/custom flows never depend on them.

## Comparison

| Source | Games | Auth | Rate limit | Images | Licence / terms | Commercial use | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Pokémon TCG API** (pokemontcg.io) | Pokémon | optional key | not quantified | yes | none stated; "not affiliated with Nintendo/TPC" | not stated | **Deprecated** — no new keys; existing keys until 2027-03-01; directs to Scrydex. Do not build on it. |
| **Scrydex** (scrydex.com) | Pokémon, MTG, Lorcana, Gundam, One Piece (beta), Riftbound (beta) | secret API key | not stated; ≈160–8,300 req/day by tier | yes ("for UI display") | not stated | not stated | **Paid only**: $29 / $99 / $399 per month (5k / 50k / 250k credits). Candidate for a future paid tier; needs terms review. |
| **TCGdex** (tcgdex.dev) | Pokémon (10 languages) | none | not stated | `assets.tcgdex.net/<lang>/<serie>/<set>/<id>/{high\|low}.{webp\|png\|jpg}` (600×825 / 245×337) | "freely available and open source"; licence text not found on the pages read | unresolved | **Primary Pokémon candidate**. Confirm licence in the GitHub repo and ask about hotlinking before shipping. |
| **Scryfall** (api.scryfall.com) | Magic | none; `User-Agent` + `Accept` headers required | hard limits per endpoint (exact numbers not captured; the docs ask for ~50–100 ms spacing — *unverified figure, re-check*) | yes, multiple sizes | WotC Fan Content Policy; may not paywall Scryfall data; may not repackage/proxy; image rules: no cropping of copyright/artist, no distortion, no watermarks; art crops need artist credit | allowed only within the Fan Content Policy; any paywalled access to the data is forbidden | **Use for MTG** with attribution and image rules enforced in the UI. |
| **YGOPRODeck** (db.ygoprodeck.com/api/v7) | Yu-Gi-Oh! | none | **20 req/s; exceeding blocks for 1 h** | `images.ygoprodeck.com/images/cards{,_small,_cropped}/{id}.jpg` | "completely free"; text/images © 4K Media/Konami; **do not hotlink — download once and self-host**; store API data locally | not stated | **Usable for YGO** only with a server-side mirror (phase 9+, Supabase Storage) — not a client-side hotlink. |
| **Lorcast** (lorcast.com) | Lorcana | none (per third-party wrappers) | has limits (not published) | yes | unresolved; Disney/Ravensburger IP | unresolved | Candidate; **verify docs directly** before use. |
| **lorcana-api.com** | Lorcana | key | 100 calls/month free; paid from €3.50/month | ? | unresolved | unresolved | Low priority. |
| **OPTCG API** (optcgapi.com) | One Piece (EN) | none | not stated | ? | unresolved; Bandai IP | unresolved | Candidate; verify. Bandai publishes no public API. |
| **Sports (Topps, Panini)** | F1, basketball, football… | — | — | — | manufacturer checklists are licensed league/PA content; no official developer API found | restricted | **Manual/custom sets + user uploads only.** Third-party aggregators (TCDB, Beckett, Zyla) have their own terms and no demonstrated right to redistribute. |

## Image policy (binding for every provider)
- Store `image_url`, `image_source` (provider slug), `attribution` and `fetched_at` with the card.
- Lazy-load, reserve dimensions, show a neutral placeholder when missing.
- Hotlink only where the provider explicitly permits (Scryfall, TCGdex pending confirmation);
  mirror into Supabase Storage only where terms allow (YGOPRODeck requires it).
- User uploads go to a private bucket scoped to `auth.uid()`; public only when a share is created.
- Never scrape publisher sites or bypass access controls.
- Separate metadata rights from image rights in `catalog_providers.attribution_policy`.

## Open questions
1. TCGdex licence and hotlinking policy (read repo LICENSE; ask on their Discord if unclear).
2. Scryfall exact rate limit and whether our free account model satisfies "no paywall".
3. Lorcast / OPTCG terms.
4. Whether any paid provider (Scrydex) is worth a future entitlement.

## Sources
- https://docs.pokemontcg.io/ (deprecation notice)
- https://scrydex.com/docs and https://scrydex.com/pricing
- https://tcgdex.dev/, https://tcgdex.dev/rest, https://tcgdex.dev/assets
- https://scryfall.com/docs/api (fetched with a browser user agent; the site blocks generic clients)
- https://ygoprodeck.com/api-guide/
- Lorcana / One Piece / sports: web search results 2026-11-04 (Apify Lorcast wrapper, oanor
  lorcana-api listing, optcgapi.com, parse.bot listings, Panini licensing whitepaper)
