# Footer and shade pages

Files: `sections/ezy-footer.liquid`, `sections/footer-group.json`; shade guards in `sections/main-product-v2.liquid`, `video-carousel.liquid`, `reviews.liquid`, `faq.liquid`, `collection-product-grid-v7.liquid`.

## Sub-features

- Footer shows the Click Shades brand and logo, Shop and Help links, business details (ABN, address, hours) and payment icons. Phone and email stay hidden until filled in the section settings.
- Shade products and shade collections keep the old Click Shades layout under the new header and footer. The old sections skip themselves on wiper products and wiper collections.

## How to get to it (user POV)

Scroll to the bottom of any page. For shades: header "Shop Shades", then any product.

## Driving it with Playwright (GitHub only)

- Homepage footer text says "Click Shades" and never "EZYFIT" (G12). No shopper-visible "EZYFIT" on the home page, a shade product or a wiper product, and the header and footer carry the Click Shades logo (B1 to B5 in `gates-brand.mjs`).
- First product link on `/collections/car-window-shades` opens a page with `.product-page-v2`, no `.ezy-pdp`, and `.ezy-head` (G16).

## Gotchas

- The footer link "Car shades" is deliberately worded without the Click Shades name.
- The Click Shades logo is the shop CDN file `Horizontal_logo_black-blue.png`, not a theme asset, so a logo change in the Shopify admin reaches the theme with no code edit. Wiper products keep `assets/clickblades-logo.png`.
- `sections/faq.liquid`, `reviews.liquid` and `video-carousel.liquid` use Windows line endings. Keep them when editing, or the diff explodes.
