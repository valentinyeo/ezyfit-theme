# Footer and legacy pages

Shoppers find store details, help and policy links in the EZYFIT footer. Old links to empty Find my car and FAQ pages lead to the matching homepage section instead of a blank page.

## Sub-features

- `footer-details` shows the brand, Shop and Help links, ABN, address, opening hours and payment icons. Phone and email appear only when configured.
- `footer-links` sends Find my car to `/#find` and FAQs to `/#ezy-faq`. Cookie policy, legal disclaimer and configured Facebook/Instagram links are available.
- `page-forward` redirects empty `/pages/find-my-car` and `/pages/faqs` to those anchors, with a fallback link. Pages with content do not redirect.
- `shade-guard` retains the legacy shade layout under the new header/footer, with EZYFIT product styling. Wiper products skip legacy product sections. See [shade parity](shade-page-parity.md).

## How to get to it (user POV)

Scroll to the footer on any page. Choose Find my car, FAQs, policy or social links. An old bookmark can open `/pages/find-my-car` or `/pages/faqs`. Choose Shop Shades for shade products.

## Driving it with Playwright (GitHub only)

Preconditions: follow the [index drive](README.md#preconditions-and-drive). The legacy Find my car page must remain empty for G23. Policy pages and configured social links must exist for W6.

- Inspect the homepage footer. G12 requires EZYFIT text and no Click Shades branding.
- Inspect footer destinations with G22. It rejects `/pages/find-my-car` and `/pages/faqs`; it does not verify the correct anchors by clicking them.
- Open `/pages/find-my-car`. G23 requires `/`, `#find` and `#find .ezy-finder` after forwarding.
- Scroll to the phone product footer. W6 requires cookie/legal/social links and HTTP 200 for policy URLs.
- Open the first shade product from its collection. G16 requires `.product-page-v2`, no `.ezy-pdp`, and the new header. G16b rejects broken object requests.

## Gotchas

- FAQ forwarding is implemented in `sections/main-page.liquid` but has no equivalent browser gate. Do not count G23 as proof for both routes.
- G12 does not assert address, ABN, hours, payment icons or conditional contacts. W6 does not prove policy content or social destination correctness.
- Legacy shade layout preservation allows intentional colour/font changes through `assets/ezy-shade.css`.
- Some legacy sections use Windows line endings. Verification maintenance never edits them.
