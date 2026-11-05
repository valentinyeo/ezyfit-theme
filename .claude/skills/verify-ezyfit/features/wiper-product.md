# Wiper product page

Files: `sections/ezy-product.liquid`, `templates/product.json`, `templates/product.wiper-v2.json`, `templates/product.wiper-v3.json`.

## Sub-features

- Renders only when the product title contains "Wiper". Shade products keep `main-product-v2` (see footer-and-shades.md).
- Year dropdown: every product in the `wiper-blades` collection for the same car, one option per year range; choosing one opens that product.
- Blade type: Standard or Spray. Spray shows "Coming soon" until the product has metafield `custom.spray_product` (product reference).
- Which blades: Front pair, plus "Front and rear" once metafield `custom.rear_product` is set and that product is in stock.
- Fitment video: `custom.fit_video` (URL) on the product, else the section default mp4.
- Add to cart via `/cart/add.js` (front, plus rear when chosen). Desktop opens the cart drawer; phone shows "Added. View cart and check out".
- Loox reviews for that product, wiper FAQ, sticky add bar on phones.

## How to get to it (user POV)

Homepage finder, a popular car tile, the wiper collection, or search. Example: `/products/front-windscreen-wipers-for-toyota-hilux-2018`. A car with two year ranges: `/products/front-windscreen-wipers-for-toyota-rav4-2018`.

## Driving it with Playwright

- Presence: `[data-ezy-type]` (G1), `[data-ezy-position]` (G2), `[data-ezy-year]` (G3), `[data-ezy-fit-video]` (G4), `main .ezy` (G6).
- No failed request containing "object" (G5). This was an inherited `[object Object]` 404 on the old page.
- Year list: on the RAV4 page `[data-ezy-year] option` must list "2013 to 2018" and "2019 to 2026".
- Add to cart: see G9 in header-and-cart.md.

## Gotchas

- Many wiper products use the `wiper-v3` or `wiper-v2` template suffix. All three product templates must carry `ezy-product`, or some cars show the old page.
- `front-windscreen-wiper-ford-ranger-2021` is priced $149 with compare-at $79 in the store. That is store data, not a theme bug. Do not "fix" it in the theme.
- Loox iframe loads late; wait or scroll before judging the reviews block.
