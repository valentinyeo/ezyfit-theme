# EZYFIT feature map

Read this index before driving a shopper journey. Every sibling feature file is indexed below. Browser recipes run only on GitHub-hosted Actions, never on this server.

## Preconditions and drive

Use an already-uploaded unpublished draft or QA theme. A maintenance pass never uploads theme files or changes store data. Run the read-only Doctor in [SKILL.md](../SKILL.md) first. Gates verify the deployed theme, not whether it matches the checkout.

```bash
gh workflow run gates.yml --ref main -f theme_id=158148984988
gh run list --workflow gates.yml --branch main --event workflow_dispatch --limit 1
gh run watch <run-id> --interval 300 --exit-status
gh run view <run-id> --log
gh run download <run-id> -n gates-evidence-<run-id> -D /tmp/ezyfit-evidence
```

For branch verification, replace both `main` arguments with the pushed branch name. For QA, pass `theme_id=158330912924`. Never pass the live theme. Each feature's recipe selects results from this one full run. Do not claim a skipped path was covered by another path.

## Features

| Feature | File | Gates |
|---|---|---|
| Homepage finder, newsletter copy, parts preview | [homepage-and-parts.md](homepage-and-parts.md) | G18, G19, G21, C1a, C1f, C2b, C3, C7a, P1, P1d, P2–P5 |
| Header, phone menu, search, cart | [header-and-cart.md](header-and-cart.md) | G0, G7–G11, C1e, C5a, C5b |
| Wiper product and long page | [wiper-product.md](wiper-product.md) | G1–G6, G5d, G9, C1b, C2a, C4a, C4b, C7b, W1–W5, W7–W9 |
| Wiper collection and search | [collection-and-search.md](collection-and-search.md) | G13, G13b, G17, C1c, C1d, C6 |
| Footer and legacy page forwarding | [footer-and-shades.md](footer-and-shades.md) | G12, G16, G16b, G22, G23, W6 |
| Shade page structure, brand and Add All | [shade-page-parity.md](shade-page-parity.md) | G16, G16b, S0–S8, S5b |
| Design quality | [design-quality.md](design-quality.md) | S4 covers shade styling only; broader detector not wired |

Gate ranges include suffixed IDs. There is no G14, G15 or G20 in source. W8 covers the numbered pack and car fit panel. W9 covers `snippets/ezy-pdp-more.liquid`. G22 rejects obsolete footer URLs. G23 covers the old Find my car URL.

## Coverage limits

Record PASS counts, failed gates, unreachable prerequisites and evidence links. A blocked Actions runner is not a shopper PASS.

- Lead capture submission, announcement rotation, search-toggle behaviour, year navigation, collection prefill and empty state have no behavioural gates.
- Spray and rear selection need suitable product data. Do not create that data during verification.
- Legacy FAQ forwarding exists in source but lacks a browser gate.
- W2 and W5e mock cart endpoints. S6 and S7 mock cart endpoints and may replay live recommendations. They prove requests and interface behaviour, not real cart persistence or checkout.
- W5e does not assert the displayed total. W4 checks FAQ schema shape and counts, not exact answer equality. W9 does not prove the optional blocks remain hidden without data.
- Shade headings are compared as membership, not pixel parity or ordering. Review, FAQ and video interactions remain untested.
- Design detector, rendered font checks on home/wiper/collection, and screenshot review still require runner work. See the design feature before claiming coverage.
