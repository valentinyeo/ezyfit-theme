# Header and cart

Files: `sections/ezy-header.liquid`, `sections/ezy-announcement.liquid`, `sections/header-group.json`, `layout/theme.cart.liquid`.

## Sub-features

- Announcement bar with rotating messages and links.
- Phone menu drawer with search, menu links and account.
- Search toggle under the header (desktop and phone).
- Cart badge that updates after any `/cart/add|change|update|clear` fetch, from any section.
- Desktop: cart icon opens the slide-out cart drawer. Phone: it goes to `/cart`.
- The cart page (alternate layout) shows the same header.

## How to get to it (user POV)

Any page. Tap the three-line icon on a phone. Tap the magnifier. Add a wiper to the cart and watch the number on the cart pill.

## Driving it with Playwright (GitHub only)

- Menu: click `.ezy-head__menu`, then `[data-ezy-drawer]` must not be `hidden` and must show at least 3 visible links (G7).
- Search: `[data-ezy-search]` toggles `#ezy-search` (G8).
- Cart count: on a wiper page at 1280 wide, read `/cart.js` `item_count`, click `[data-ezy-add]`, wait 4 s, read again; `.ezy-head [data-cart-count]` text must equal the new count (G9).
- Cart page: `/cart` must contain `.ezy-head` (G10).
- Announcement: no `.ezy-bar a` without an `href` (G11).

## Gotchas

- The header has both a desktop nav (`.ezy-head__nav`, hidden on phones) and the drawer. Check the drawer on phones, not the nav.
- The badge refresh relies on a wrapped `window.fetch`. Code that adds to cart with a form post reloads the page instead, which is also fine.
