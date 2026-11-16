# EZYFIT feature map

One file per shopper-facing feature. Gate ids refer to the `scripts/gates*.mjs` files, which run only on GitHub Actions (`.github/workflows/gates.yml`), never on the VPS.

| Feature | File | Gates |
|---|---|---|
| Homepage finder (Make, Model, Year) | in [collection-and-search.md](collection-and-search.md) | G18 |
| Header, phone menu, search, cart count | [header-and-cart.md](header-and-cart.md) | G0, G7, G8, G9, G10, G11 |
| Wiper product page | [wiper-product.md](wiper-product.md) | G1 to G6, G9 |
| Wiper collection and search results | [collection-and-search.md](collection-and-search.md) | G13, G13b, G17 |
| Footer and shade pages | [footer-and-shades.md](footer-and-shades.md) | G12, G16 |
| Shade box contents, UV figure and discount copy | [shade-product-data.md](shade-product-data.md) | SC0 to SC4 in `gates-shade-content.mjs` |
| ClickShades shade page parity with live | [shade-page-parity.md](shade-page-parity.md) | G16, G16b, `gates-shade.mjs` |
| Design quality (impeccable detector) | [design-quality.md](design-quality.md) | not wired into GitHub yet |

Covered since the last map: homepage finder routing (G18). CRO checks live in `gates-cro.mjs`.

Not yet covered by a gate: lead capture form submit, design-quality detector on GitHub, Spray and rear options switching on (needs products that do not exist yet).
