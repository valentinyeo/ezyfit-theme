# Design quality

Shoppers see Poppins headings and CSS-drawn tick, cross and FAQ icons across the homepage, wiper page and collection. The broad impeccable detector is not part of the Actions gates.

## Sub-features

- `design-headings` uses Poppins 800 italic for EZYFIT headings. The finder heading deliberately uses normal 700.
- `design-icons` uses CSS masks for ticks, crosses and FAQ plus/minus icons.
- `design-audit` inspects contrast, spacing and heading structure. This is a verification gap until a runner workflow provisions and runs the detector.

## How to get to it (user POV)

Open `/`, `/products/front-windscreen-wipers-for-toyota-hilux-2018` and `/collections/wiper-blades` at phone and desktop widths.

## Driving it with Playwright (GitHub only)

Preconditions: the [index drive](README.md#preconditions-and-drive) can run shade style gate S4, but does not exercise the broad design audit. Do not report this feature as fully live-covered from a green gates run.

The existing DOM helper is a runner-only draft/desktop capture. Its output lives at `_preview/evidence/dom/` relative to the repo root. A future runner job must install Playwright and provide the impeccable executable before using these commands:

```bash
PLAYWRIGHT_PATH=playwright node .claude/skills/verify-ezyfit/scripts/dump-ezy.mjs
~/.claude/skills/impeccable/scripts/impeccable detect _preview/evidence/dom/home.html _preview/evidence/dom/pdp.html _preview/evidence/dom/coll.html
```

Detector exit 0 with no findings covers the saved markup only. Rendered-page proof must also inspect heading computed family, weight and style with the finder exception, loaded fonts, icon masks and FAQ open/closed states. Capture screenshots at both widths. No current workflow performs these steps.

## Gotchas

- `dump-ezy.mjs` hardcodes the draft ID and a 1280px viewport. It cannot prove QA or phone behaviour as written.
- Saved markup includes EZYFIT CSS but excludes competing Dawn styles and Google font loading. It cannot prove the rendered font override.
- The impeccable executable path is a prerequisite, not something `gates.yml` installs. Do not run it or the DOM helper on this server.
- Keep intended design requirements separate from detector coverage. Missing coverage is not evidence of a product defect.
