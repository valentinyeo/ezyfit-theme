# Shade product data

Goal. Shade shoppers see the product's actual included pieces and one documented UV figure.

The shade template uses `product.metafields.custom.box_contents` first. This optional Shopify text or rich-text metafield describes the complete box, including accessories. No metafield definition or store data was created by this change.

Without that metafield, the template reuses the first unordered product-description list introduced by "What you get", "What's included" or "Box contents". The Prado description already supplies this list, including the rear passenger and rear port windows and storage bag.

If neither source exists, a case-insensitive title fallback distinguishes full sets, side windows, rear windows and front windscreens. It does not invent quantities or accessories. Unclassified products receive generic window-shade copy and a direction to read the product details.

The benefits card no longer supplies a UV percentage. The product description remains the source of the number and its qualifiers, including "almost". The discount badge says "Save". Product description HTML, including Matt's ALL CAPS heading, remains unchanged.

`gates-shade-content.mjs` runs through `gates.yml` on GitHub-hosted runners only and refuses the live theme. At 390 and 1280 pixels it checks:

- SC0 requires the requested theme.
- SC1 compares the rendered Prado box contents with its product JSON description list and requires rear passenger and rear port windows, not a front windscreen.
- SC2 compares the full rendered description with product JSON.
- SC3 requires one UV figure in the description and rejects different figures in visible page text or JSON-LD.
- SC4 requires visible sentence-case discount badges without uppercase text transformation.

The older shade parity gate normalizes only the approved "87% UV Block" to "UV protection" heading change. SC3 checks the actual UV figures separately.

Evidence includes box-content and badge screenshots at both widths and `gates.json`. This gate covers the existing Prado description path. Metafield precedence and title fallback still need hosted fixture coverage or suitable catalog products.

Execution is pending. No theme upload, browser session or local test was run for MACL-28. Before merge, an authorized operator must arrange an unpublished preview containing the PR, run the hosted gates and obtain an independent pstack verifier verdict.
