# Wiper collection and search results

Shoppers narrow the wiper grid by car and browse shared product cards in search. Matching titles lead search results, with matching wipers before shades.

## Sub-features

- `collection-grid` uses the EZYFIT grid for handles containing `wiper`. Other collections keep the legacy grid.
- `collection-filter` narrows the rendered cards live. `?car=hilux` prefills it. No matches shows "No blades listed for that car yet" and a Request your car link.
- `search-results` labels cards Wiper blades or Car shades and offers a fallback when no products match.
- `search-order` groups title-matching wipers, title-matching shades, other wipers and other products.

## How to get to it (user POV)

Choose Shop Blades in the header, Wiper blades in the footer, or `/collections/wiper-blades`. Search through the header or homepage finder fallback. Gates open `/search?q=hilux&type=product` directly.

## Driving it with Playwright (GitHub only)

Preconditions: follow the [index drive](README.md#preconditions-and-drive). The collection needs at least one Hilux card; search needs at least two Hilux titles for C6.

- Open `/collections/wiper-blades`. G13 requires `main .ezy`.
- Type `hilux` in `[data-ezy-coll-q]`. G13b requires at least one visible `.ezy-coll__item` and `hilux` in every visible card's searchable text.
- Open the Hilux search URL. G17 requires the EZYFIT collection container and at least one card.
- Inspect C6. Hilux titles must precede other titles and the first card must be a wiper. C1c/C1d check brand metadata on both pages.

## Gotchas

- Filter prefill, empty state, Request your car navigation and clearing the filter are described by source but not exercised by gates.
- Collections paginate at 96. Filtering searches only the current page, not every product in the store. Do not assume an old product count remains true.
- Shopify search can be fuzzy. Use a collection filter for a deterministic empty-state recipe, not a nonsense search query.
