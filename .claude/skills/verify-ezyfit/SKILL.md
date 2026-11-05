---
name: verify-ezyfit
description: Prove the EZYFIT Version B Shopify theme works the way a shopper uses it, on the unpublished draft theme 158148984988 at easy-fit-store1.myshopify.com. Use after any change to this repo, before saying a theme change is done, or when something on the draft looks off. Drives the real storefront in headless Chromium (phone and desktop), checks header, cart, wiper product page, collection, search, footer, and that shade pages keep the old design.
---

# Verify the EZYFIT draft theme

The theme only runs on Shopify's servers. There is no local server. "Launch" means pushing your changed files to the draft theme; "drive" means opening the real storefront with `?preview_theme_id=158148984988` in headless Chromium.

Hard rules:

- Never push to theme 149894070428. That is the live ClickShades shop. `push-draft.sh` refuses it.
- Never publish the draft theme. Publishing is the owner's call.
- Never change store data (products, prices, metafields) to make a check pass. A failing journey is reported, not weakened.
- Never print the theme token. The scripts read it into memory.

## Launch

Push the files you changed (paths relative to the repo root), then wait about 5 seconds for Shopify's cache:

```bash
.claude/skills/verify-ezyfit/scripts/push-draft.sh sections/ezy-product.liquid assets/ezy.css
```

Ready means the script prints `success unpublished issues: 0` and exits 0. Any other output is a failed launch. It needs network outside the sandbox (in Claude Code run it with the sandbox disabled).

No teardown: the draft theme persists. Do not delete it.

## Doctor

Run first, and again whenever results look strange:

```bash
PLAYWRIGHT_PATH=$HOME/.npm-global/lib/node_modules/playwright node .claude/skills/verify-ezyfit/scripts/doctor.mjs
```

Each line must say `OK`: the store answers, `Shopify.theme.id` is 158148984988 (not the live theme), the EZYFIT header renders, and `/cart.js` answers. If the theme id is wrong, the preview cookie did not stick: rerun once. The first request sometimes redirects to clickshades.com.au.

## Drive

The whole journey set, phone (390x844) and desktop (1280x900), each page in a fresh browser context:

```bash
PLAYWRIGHT_PATH=$HOME/.npm-global/lib/node_modules/playwright node .claude/skills/verify-ezyfit/scripts/gates.mjs
```

It prints one `PASS` or `FAIL` line per gate with the observed value, ends with `N/M gates pass`, and exits 1 if any gate fails. It takes 3 to 5 minutes. Gate ids and what each proves are in [features/README.md](features/README.md).

One page as a picture (path, output file, width, full page 1 or 0):

```bash
PLAYWRIGHT_PATH=$HOME/.npm-global/lib/node_modules/playwright node .claude/skills/verify-ezyfit/scripts/shot.mjs /products/front-windscreen-wipers-for-toyota-hilux-2018 /tmp/pdp.png 390 1
```

Stable handles used by the gates (keep them when editing sections): `[data-ezy-head]`, `[data-ezy-menu]`, `[data-ezy-drawer]`, `[data-ezy-search]`, `[data-cart-count]`, `[data-ezy-pdp]`, `[data-ezy-type]`, `[data-ezy-position]`, `[data-ezy-year]`, `[data-ezy-fit-video]`, `[data-ezy-add]`, `[data-ezy-coll-q]`, `.ezy-coll__item`, `.ezy-coll__card`.

## Evidence

Every gates run writes `_preview/evidence/<timestamp>/`:

- `gates.json`: theme id, time, every gate with pass or fail and the observed value.
- `G7-phone-menu.png`, `G9-after-add-desktop.png`, `G13-collection.png`.

Proof standards: a change is proven only by a gates run after the push, read in full, plus a look at the screenshots of the pages you touched at both widths. Add-to-cart proof is the real `/cart.js` count going up and the header badge matching it, not the button changing text. Loox reviews load late in an iframe and lazy images can look blank in full-page shots; check those in a viewport shot after scrolling before calling them broken.

The add-to-cart gate leaves one item in that browser context's cart. Contexts are thrown away, so no real cart is touched.

## Cleanup

Nothing to stop. Delete scratch screenshots you wrote outside `_preview/evidence/`. Keep the evidence folder; it is git-ignored and Shopify-ignored.

## Design check

After visual changes, also run impeccable's detector on the rendered sections and expect no findings. See [features/design-quality.md](features/design-quality.md).
