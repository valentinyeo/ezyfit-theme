# Wiper product page

Shoppers choose blades for their car, read fitting and delivery information, and add blades or a complete set to their cart. The long page adds customer photos, comparison, fit guarantee and shade suggestions.

## Sub-features

- `wiper-options` shows Standard or Spray, year navigation and optional rear blades. Spray uses `custom.spray_product`; Spray products can link back through `custom.standard_product`. Rear requires an available `custom.rear_product`.
- `wiper-fit` shows a fitment video from `custom.fit_video` or the section default, numbered pack contents and a car-named fit panel. Blade lengths depend on `custom.blade_*` metafields.
- `wiper-cart` provides quantity, individual add-ons and Add All. Desktop can open the drawer; phone stays on the product with a cart link.
- `wiper-trust` shows product or store review wording, Loox, delivery estimates, stock, pickup, warranty and FAQ schema.
- `wiper-long` shows photos, four comparison rows, a car-named guarantee and shade cross-sell before the FAQ. `custom.clip_photo` enables the clip block. `custom.customer_count` adds the driver count.

## How to get to it (user POV)

Use the homepage finder, popular-car tiles, collection cards or search. Gates use `/products/front-windscreen-wipers-for-toyota-hilux-2018`. The RAV4 example is `/products/front-windscreen-wipers-for-toyota-rav4-2018`.

## Driving it with Playwright (GitHub only)

Preconditions: follow the [index drive](README.md#preconditions-and-drive) against a healthy unpublished theme with the Hilux product available. Product source is `sections/ezy-product.liquid` and `snippets/ezy-pdp-more.liquid`.

- Open the Hilux page. G1 through G6 and G5d check option/video handles, EZYFIT rendering and broken object requests at phone and desktop widths.
- Click Add on desktop. G9 proves real `/cart.js` count growth and matching header badge.
- Use Add All at both widths. W1/W2 check cards, one add request containing the selected set, badge updates and desktop drawer opening. These cart responses are mocked.
- Inspect Loox and FAQ. W3a/W3b check product binding and mounted content. W4 checks one valid FAQPage block, matching question counts and nonempty questions/answers.
- Inspect delivery, stock, pickup and warranty with W5a through W5d. Increase quantity to two with W5e; its mocked request must contain quantity two. The displayed total is recorded, not asserted.
- Scroll to the pack and car fit panel. W8 requires at least three numbered items, a picture and Hilux in the fit heading. Length presence is recorded, not required.
- Scroll down the long page. W9 requires four visible blocks before FAQ, at least four photos, four comparison rows and Hilux in the guarantee. Inspect its desktop screenshot.
- Inspect C1b, C2a, C4a/C4b and C7b for brand metadata, honest rating copy, phone sticky visibility, desktop sticky absence and AWST cutoff wording. W7 proves only favicon presence.

## Gotchas

- Only titles containing case-sensitive `Wiper` use this page. `product.json`, `product.wiper-v2.json` and `product.wiper-v3.json` include it.
- Year options come from matching products in a batch of up to 250, not a deduplicated year registry. G3 proves presence only. RAV4 year ranges and actual year navigation remain ungated.
- Spray, rear selection, sticky-button clicks, individual add-ons, exact FAQ text parity and optional clip/customer-count conditions are not proven by this run.
- Loox loads late. W3b observes mounted content, not review accuracy or interaction.
- Previously reported Ranger price inconsistency is store data, not a verified current theme defect. Never change prices to satisfy a gate.
