# Footer and shade pages

Files: `sections/ezy-footer.liquid`, `sections/footer-group.json`; shade guards in `sections/main-product-v2.liquid`, `video-carousel.liquid`, `reviews.liquid`, `faq.liquid`, `collection-product-grid-v7.liquid`.

## Sub-features

- Footer shows the EZYFIT brand, Shop and Help links, business details (ABN, address, hours) and payment icons. Phone and email stay hidden until filled in the section settings.
- Shade products and shade collections keep the old Click Shades layout under the new header and footer. The old sections skip themselves on wiper products and wiper collections.

## How to get to it (user POV)

Scroll to the bottom of any page. For shades: header "Shop Shades", then any product.

## Driving it with Playwright

- Homepage footer text has no "Click Shades" and does contain "EZYFIT" (G12).
- First product link on `/collections/car-window-shades` opens a page with `.product-page-v2`, no `.ezy-pdp`, and `.ezy-head` (G16).

## Gotchas

- The footer link "Car shades" is deliberately worded without the Click Shades name.
- `sections/faq.liquid`, `reviews.liquid` and `video-carousel.liquid` use Windows line endings. Keep them when editing, or the diff explodes.
