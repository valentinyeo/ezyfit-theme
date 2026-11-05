# Design quality

Checks that the EZYFIT sections stay free of the patterns impeccable flags (low contrast, cramped padding, skipped headings, text glyphs as icons and so on).

## Sub-features

- Headings render in Poppins ExtraBold Italic (weights 800 are loaded in `layout/theme.liquid`). Dawn's heading font must not win.
- Ticks, crosses and FAQ plus and minus are drawn with CSS masks, not text characters.

## How to get to it (user POV)

Homepage, a wiper product page and the wiper collection.

## Driving it with Playwright

Save the rendered `.ezy` sections with the theme CSS, then run the detector on the saved files:

```bash
PLAYWRIGHT_PATH=$HOME/.npm-global/lib/node_modules/playwright node .claude/skills/verify-ezyfit/scripts/dump-ezy.mjs
~/.claude/skills/impeccable/scripts/impeccable detect _preview/evidence/dom/home.html _preview/evidence/dom/pdp.html _preview/evidence/dom/coll.html
```

No output and exit 0 means clean. Font check in a page: `getComputedStyle(document.querySelector('.ezy h1')).fontFamily` must start with `Poppins`.

## Gotchas

- `impeccable detect <url>` times out on the Shopify preview. Use the saved-DOM route above.
- The detector judges only what was saved. Look at the screenshots too.
