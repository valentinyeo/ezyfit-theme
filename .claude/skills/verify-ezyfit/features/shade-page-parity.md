# Shade page structure and branding

Shade shoppers keep the legacy product sections and purchase flow under the EZYFIT header and footer. Product colours, buttons and typography intentionally adopt EZYFIT branding. This is structural parity, not an identical picture of the old storefront.

## Sub-features

- `shade-structure` retains main product, reviews, FAQ and video sections without the wiper product page.
- `shade-brand` uses EZYFIT blue, yellow buttons, Poppins and an 800 italic title. Wiper pages do not load shade overrides.
- `shade-add-all` adds the main item and displayed add-ons in one request, then reloads the same product with the drawer open.
- `shade-collection` retains products under the new header.

## How to get to it (user POV)

Choose Shop Shades, then a product on `/collections/car-window-shades`. S1 through S3 use RAV4 2013-2019, Prado 150 2009-2023 and Tesla Model Y 2020 shade product paths. Add All uses `/products/rear-side-windows-click-shades-for-toyota-rav4-2019-2025`, which needs add-ons.

## Driving it with Playwright (GitHub only)

Preconditions: follow the [index drive](README.md#preconditions-and-drive). The shade products and recommendations endpoint must be available. `gates-shade.mjs` reads public ClickShades pages for comparison only; it never submits a live cart mutation.

- Open shade products on the unpublished target. G16/G16b check legacy page presence, the wiper-page exclusion, new header and broken object requests. S0 verifies target identity.
- Compare heading membership against public ClickShades pages with S1/S2/S3, excluding EZYFIT elements and header/footer. Heading order and layout are not compared.
- Inspect S4 for computed brand styles. S5 requires `ezy-shade.css` on shades; S5b excludes it from wipers.
- Click Add All at desktop and phone widths. S6/S7 require one add request containing the draft's displayed variant set, the same item count as live, and same-product reload with the drawer open. Cart responses are mocked. The resulting badge is informational.
- Open the shade collection. S8 requires products and the EZYFIT header.

## Gotchas

- S6/S7 compare the live and target set sizes, not exact cross-theme variant identities. They do assert the target request matches its own displayed set.
- Recommendations can be throttled. The harness may replay a public live recommendations response to both pages. State that boundary when reporting results.
- G9 proves a real wiper cart addition, not a shade addition. No shade gate proves real cart persistence, individual add-ons or checkout.
- Review, FAQ and video interactions remain product expectations without browser gates. Heading checks alone do not prove them.
- Loox and lazy images load late. Screenshots require inspection after scrolling before calling content blank.
