# Wiper collection and search results

Files: `sections/ezy-collection.liquid`, `sections/ezy-search.liquid`, `snippets/ezy-product-card.liquid`, `templates/collection.json`, `templates/search.json`.

## Sub-features

- Collections whose handle contains "wiper" render the EZYFIT grid; other collections keep `collection-product-grid-v7`.
- Type-your-car filter narrows the grid live and shows "No blades listed for that car yet" plus a Request your car button when nothing matches. `?car=hilux` prefills it.
- Search results use the same cards, labelled Wiper blades or Car shades, with a fallback when no products match.

## How to get to it (user POV)

Header menu "Shop Blades", footer "Wiper blades", `/collections/wiper-blades`. Search from the header magnifier or the homepage finder when several cars match.

## Driving it with Playwright

- `/collections/wiper-blades`: `main .ezy` present (G13). Fill `[data-ezy-coll-q]` with `hilux`; every visible `.ezy-coll__item` must have `hilux` in `data-search`, and at least one is visible (G13b).
- `/search?q=hilux&type=product`: `main .ezy-coll` present with at least one `.ezy-coll__card` (G17).

## Gotchas

- The store's search is fuzzy: a nonsense query still returns some shade products. Do not assert an empty state from search; assert it from the collection filter instead.
- Collection pages paginate at 96, so all 65 wipers fit on one page today.
