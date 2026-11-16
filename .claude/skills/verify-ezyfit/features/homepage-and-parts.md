# Homepage finder and parts preview

Shoppers find blades by make, model and year on the homepage. A separate parts preview adds wiper and sun-shade category tiles without replacing the current homepage. The homepage signup promises a newsletter, not an automated fitting video.

## Sub-features

- `home-finder` uses searchable custom dropdowns for make, model and year. A single match opens its product; multiple matches use search.
- `home-phone` keeps the finder button above 700px and the hero video before the pack card.
- `home-trust` labels store reviews honestly and gives the 2pm cutoff in AWST.
- `home-newsletter` offers a customer signup without promising video delivery.
- `parts-preview` offers a parts heading, finder and two category tiles at `/pages/find-my-car?view=ezy-parts-home`.

## How to get to it (user POV)

Open `/` or follow Find my car to `/#find`. Scroll to the newsletter section. Open the alternate parts-preview URL directly; it is not the current homepage.

## Driving it with Playwright (GitHub only)

Preconditions: follow the [index drive](README.md#preconditions-and-drive). The Toyota/Hilux finder option and its product must exist. The alternate page template must already be uploaded.

- Open home on phone. G21 requires the finder submit button at or above 700px and video before pack card in document order.
- Choose Toyota, Hilux and the supplied year through `[data-ezy-dd]`, then submit. G18 requires no native select/datalist, left-aligned dropdown text, a year and the Hilux product destination.
- Inspect the newsletter. G19 requires `#ezy-lead` text and rejects a video promise. It does not submit the form.
- Inspect C1a/C1f for title and brand metadata, C2b for store-review wording, C3 for finder inventory matching the wiper collection, and C7a for AWST copy.
- Open the parts preview at 390px and 1280px. P1/P1d require the parts heading, finder, both category links and no uppercase text transform in tiles. P2 checks both category URLs answer 200, P3 checks broken object requests, and P4 opens the make list and requires options.
- Return to `/`. P5 requires the existing hero/finder and no parts tiles.

## Gotchas

- `templates/page.ezy-parts-home.json` reuses `sections/ezy-hero.liquid` and adds `sections/ezy-shop-by-part.liquid`. The bare empty Find my car page forwards, but the alternate template renders its own content.
- C3 checks inventory completeness, not every car journey. G18 covers only Toyota/Hilux. Finder fallback search and keyboard edge cases remain ungated.
- Newsletter delivery/submission and review interactions are not covered. Never submit personal details during maintenance.
- P2 uses read-only HTTP requests. It does not prove a shopper clicked each tile.
