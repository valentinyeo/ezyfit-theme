# Header and cart

Shoppers navigate from the shared header, open search, and see their cart count after adding blades. The cart page retains the EZYFIT header and shipping message.

## Sub-features

- `header-menu` opens a phone drawer with navigation, search and account links.
- `header-search` toggles a search panel and focuses the input.
- `header-count` refreshes the cart badge after fetch mutations, cart events and restored-page navigation.
- `header-cart` opens a desktop drawer when one with an `open()` method exists. Otherwise the cart link navigates to `/cart`, including on phones.
- `header-announcement` rotates messages and offers pause/play.
- `cart-copy` uses free standard shipping wording on the cart page and drawer.

## How to get to it (user POV)

Open any storefront page. On a phone, tap the menu icon. Tap the magnifier for search or cart pill for the cart. Add blades from a wiper product page.

## Driving it with Playwright (GitHub only)

Preconditions: follow the [index drive](README.md#preconditions-and-drive). The Hilux product must be available for G9.

- Open the product on phone and tap `.ezy-head__menu`. G7 requires at least three visible links in `[data-ezy-drawer]`.
- Inspect header search. G8 checks a search handle exists; it does not click or submit it.
- Click `[data-ezy-add]` at 1280px. G9 reads real `/cart.js` before and after, requires count growth, and compares the badge with the resulting count.
- Open `/cart`. G10 requires `.ezy-head`. C1e checks brand metadata and C5a checks free standard shipping copy.
- Open home. G11 rejects announcement anchors without `href`. C5b checks drawer shipping wording and rejects old wording in the section response.

## Gotchas

- G0 checks served theme identity on the initial product visit. It does not prove checkout files were uploaded.
- G8 does not prove the search toggle. G11 does not prove rotation, pause/play or that an announcement link exists.
- G9 covers add only, not change, update, clear or page restoration. W2c opens the drawer after Add All, not by clicking the header cart icon.
- The alternate cart layout includes the header but no cart drawer. Do not require drawer opening there.
- Desktop navigation is hidden on phones. Inspect the drawer instead.
- A form-post cart addition reloads the badge from Shopify instead of using the fetch wrapper.
