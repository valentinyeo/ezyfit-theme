# ClickShades shade page parity

Files: `sections/main-product-v2.liquid` (old shade product page, skips itself on wiper products), `video-carousel.liquid`, `reviews.liquid`, `faq.liquid`, `collection-product-grid-v7.liquid`, `assets/ezy-shade.css`.

## Sub-features

- A shade product on the draft or QA theme must look and behave like the same product on the live ClickShades shop. Only the new EZYFIT header and footer are allowed to differ.
- Shade add-to-cart, upsell add-ons, "Add All to Cart", reviews, FAQ and video carousel keep working.
- Wiper products must not pick up shade copy, and shade products must not pick up the EZYFIT wiper page (`.ezy-pdp`).

## How to get to it (user POV)

Header "Shop Shades", then any product. Example path: first product link on `/collections/car-window-shades`.

## Driving it with Playwright (GitHub only)

- Basic guard: `gates.mjs` G16 and G16b (old `.product-page-v2`, no `.ezy-pdp`, `.ezy-head` present, no broken `[object Object]` requests).
- Parity checks live in `scripts/gates-shade.mjs` (written by the shade agent; the workflow runs it automatically). Read its header for the gate ids.
- Live side of any comparison is read-only: open the same shade path on `https://clickshades.com.au` (or with `preview_theme_id=149894070428`) in a fresh context. Never push to it and never change its data.
- Add-to-cart proof: `/cart.js` count goes up and the header badge matches, as in G9.

## Gotchas

- A parity diff against live must ignore the header and footer, announcement bar content and anything driven by live-only settings. State what was masked in the gate output.
- `sections/faq.liquid`, `reviews.liquid` and `video-carousel.liquid` use Windows line endings. Keep them when editing, or the diff explodes.
- Lazy images and the Loox iframe load late; screenshot after scrolling before calling a section blank.
- Shopify cache can serve the previous push for a few seconds after `push-draft.sh`.
