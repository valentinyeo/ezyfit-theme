# Live parity: Click Shades live theme vs the EZYFIT draft

The live shop runs theme `149894070428` at https://clickshades.com.au. The new theme is
theme `158148984988`, served through the store's myshopify domain with
`?preview_theme_id=158148984988`. This file answers one question before the switch is
allowed: does the draft offer everything the live shop offers today?

One row per live item. Status values:

- **KEPT**: the same thing is on the draft, with the same job.
- **REPLACED-BY x**: a different section or snippet does the same job on the draft.
- **MISSING**: the live shop has it, the draft does not. Every MISSING row is also listed
  with a severity in [Missing items](#missing-items).
- **NOT-NEEDED**: the live thing cannot matter after the switch, with the reason in the row.

`scripts/parity.mjs` checks every row over plain HTTP, no browser: it fetches the live URL
and the draft URL, asserts the status, and looks for the marker strings named in the row.
It also sweeps a list of URLs Google and ads hit and requires the same status on both.

```bash
node .claude/skills/verify-ezyfit/scripts/parity.mjs               # every row and URL
node .claude/skills/verify-ezyfit/scripts/parity.mjs --rows        # rows only, no URL sweep
node .claude/skills/verify-ezyfit/scripts/parity.mjs --id P54      # one row
node .claude/skills/verify-ezyfit/scripts/parity.mjs --verbose     # show the statuses too
node .claude/skills/verify-ezyfit/scripts/parity.mjs --md          # regenerate this table
```

Read a row's result like this:

- A **MISSING** row passes while the draft still lacks the item. If it starts failing, the
  gap closed: move the row to KEPT or REPLACED-BY here and in the script.
- A **KEPT** or **REPLACED-BY** row fails when the draft loses the marker, or when live
  loses it (that means the live inventory moved on and the row needs rewriting).
- A row that wants a status other than 200 says so: `expectedStatus` in the script. Only
  the 404 page uses it now.

A full run took about six minutes at two requests in flight. Shopify answers 429 when it
decides it is being crawled; the script backs off and retries, so a 429 never shows up as
a theme failure.

The last full run is saved in `features/parity-evidence-2026-11-24b.txt`:
97 rows, 97 PASS, 38 URLs, 38 PASS. Map counts: KEPT 64, REPLACED-BY 20, MISSING 11,
NOT-NEEDED 2. The run before the MACL-37 fixes is in
`features/parity-evidence-2026-11-24.txt` (MISSING 20).

## Table

| ID | Area | Live item | Where on live | Status | Evidence in this check |
|---|---|---|---|---|---|
| P01 | Homepage | Make, Model, Year finder | `/` `car-selector` | REPLACED-BY ezy-hero finder | live has `car-selector`; draft has `data-ezy-finder`. draft finder reads the wiper-blades collection for Wipers and the live brand collections for Sun shades, see P96 |
| P02 | Homepage | Featured shade product cards (4 products with price and add to cart) | `/` `product-cards` | KEPT | live has `product-cards`; draft has `product-cards` + `ezy-shade-picks`. same top-picks collection as live, four cards with image, price and add to cart, rebuilt as ezy-pick cards in the new look; a sold-out card says Sold out and still links to the product |
| P03 | Homepage | Customer video carousel (5 videos, lightbox) | `/` `video-carousel` | REPLACED-BY ezy-hero single fit video | live has `video-carousel`; draft must not have `video-carousel`. one hero video ("Watch a real fit"), no carousel |
| P04 | Homepage | Shop by Popular Cars grid (7 cars plus View All) | `/` `popular-models-grid` | REPLACED-BY ezy-popular-cars | live has `popular-models-grid`; draft has `ezy-cars`. 4 cars, no View All link to /pages/shop-by-make |
| P05 | Homepage | Five 'Why Click Shades' shade benefit cards | `/` `Triple Laminate Technology` | MISSING | live has `Triple Laminate Technology`; draft must not have `Triple Laminate Technology`. shade benefits live on shade product pages, not on the homepage any more |
| P06 | Homepage | Loox customer reviews | `/` `looxReviews` | REPLACED-BY ezy-reviews (#looxReviews) | live has `looxReviews`; draft has `looxReviews`. the Loox script must fill the empty div at runtime; not provable over HTTP |
| P07 | Homepage | Comparison table | `/` `comparison-table` | REPLACED-BY ezy-comparison | live has `comparison-table`; draft has `ezy-compare`. now framed as "Why not cheap blades?" |
| P08 | Homepage | Trust badges row (Perfect Fit, 87% UV Block, Easy Install, 30-Day Returns) | `/` `trust-grid` | REPLACED-BY ezy-trust row | live has `trust-grid`; draft has `ezy-trust` + `87% UV Block`. four badges with the live wording, above the FAQ like live |
| P09 | Homepage | FAQ accordion (15 questions) | `/` `faq-section` | REPLACED-BY ezy-faq | live has `faq-section`; draft has `ezy-faq`. 5 questions instead of 15, so FAQPage rich results shrink |
| P10 | Homepage | Instagram feed app section | `/` `__instagram-feed` | NOT-NEEDED | live must answer 200. the live section carries no app blocks, it renders an empty div |
| P11 | Every page | Rotating benefits bar (Perfect Fit, Same-Day Dispatch, Free Shipping, 30-Day Returns, 87% UV) | `/` `benefits-bar` | REPLACED-BY ezy-announcement | live has `benefits-bar`; draft has `ezy-bar`. 3 rotating messages instead of 5, no icons |
| P12 | Homepage | Homepage title and description written for car window shades | `/` `Click Shades Australia \| Official Store` | REPLACED-BY ezy-seo wiper copy | live has `Click Shades Australia \| Official Store`; draft has `Wiper blades made for your exact car`. SEO risk: the live homepage ranks as a shade page and the draft as a wiper page |
| P13 | Header | Nav item "Shop by Make" opens /pages/shop-by-make | `/` `href="/pages/shop-by-make"` | KEPT | live has `href="/pages/shop-by-make"`; draft has `href="/pages/shop-by-make"`. the header remaps the main-menu title Shop by Make to the page; the linklist itself is store data and is untouched |
| P14 | Header | Nav item "Shop Blades" opens the Click Blades landing page | `/` `href="/pages/click-blades"` | KEPT | live has `href="/pages/click-blades"`; draft has `href="/pages/click-blades"`. same remap as P13, desktop nav and phone drawer |
| P15 | Header | Reviews page linked from the site | `/` `/pages/happy-customers` | KEPT | live has `/pages/happy-customers`; draft has `/pages/happy-customers`. dropped from the header nav, kept in the footer |
| P16 | Header | Search, account, cart count, phone drawer | `/` `action="/search"` | KEPT | live has `action="/search"`; draft has `data-ezy-search` + `data-ezy-drawer` + `data-cart-count`. draft search is a plain GET form, live has no live predictive panel either |
| P17 | Header | Click Blades logo on wiper products and Click Blades pages | `/products/front-windscreen-wipers-for-toyota-rav4-2018` `clickblades-logo` | KEPT | live has `clickblades-logo`; draft has `clickblades-logo` |
| P18 | Footer | Newsletter signup form (footer on every page) | `/` `Subscribe to Our Newsletter` | REPLACED-BY ezy-lead-capture on the homepage | live has `Subscribe to Our Newsletter`; draft has `ezy-lead-email` + `Sign me up`. the draft captures email with a Shopify customer form tagged newsletter, but only on the homepage, not in the footer on every page like live |
| P19 | Footer | Email address and phone (mailto and tel links) | `/` `mailto:sales@clickshades.com.au` | KEPT | live has `mailto:sales@clickshades.com.au`; draft has `mailto:sales@clickshades.com.au` + `tel:1300399348`. the email is the live footer address; live prints no phone in the footer, so the number is the one live shows in its header, 1300 399 348 |
| P20 | Footer | Policy links (privacy, terms, shipping, refund, payment, cancellation, legal, accessibility, cookie) | `/` `/policies/privacy-policy` + `/policies/refund-policy` | KEPT | live has `/policies/privacy-policy` + `/policies/refund-policy`; draft has `/policies/privacy-policy` + `/policies/refund-policy` |
| P21 | Footer | Payment icons | `/` `payment-icon` | KEPT | live has `payment-icon`; draft has `payment-icon`. same nine icons, Afterpay included |
| P22 | Footer | Afterpay block (Buy now, pay later, 4 interest-free payments) | `/` `Buy now, pay later` | KEPT | live has `Buy now, pay later`; draft has `Buy now, pay later`. same live wording under the payment icons |
| P23 | Footer | Link to the Windscreen Sun Shade collection | `/` `/collections/windscreen-sun-shade` | KEPT | live has `/collections/windscreen-sun-shade`; draft has `/collections/windscreen-sun-shade`. the collection answers too, see P51 |
| P24 | Footer | FAQs link opens /pages/faqs | `/` `href="/pages/faqs"` | REPLACED-BY /#ezy-faq | live has `href="/pages/faqs"`; draft must not have `href="/pages/faqs"`. the FAQ page still answers (P34); the link now jumps to the homepage accordion |
| P25 | Footer | Find my car link opens /pages/find-my-car | `/` `href="/pages/find-my-car"` | REPLACED-BY /#find | live has `href="/pages/find-my-car"`; draft must not have `href="/pages/find-my-car"`. the page still answers (P33); the link now jumps to the homepage finder |
| P26 | Footer | Business name, ABN, address, hours | `/` `24 127 742 441` | KEPT | live has `24 127 742 441`; draft has `24 127 742 441` |
| P27 | Footer | Social links (Facebook, Instagram) | `/` `instagram.com/clickshades` | KEPT | live has `instagram.com/clickshades`; draft has `instagram.com/clickshades`. the "Follow Us" heading and blurb are gone, the icons stay |
| P28 | Page | /pages/click-blades (Click Blades ad landing) | `/pages/click-blades` `cb-hero` + `cb-trust-bar` + `cb-gallery` + `video-carousel` | KEPT | live has `cb-hero` + `cb-trust-bar` + `cb-gallery` + `video-carousel`; draft has `cb-hero` + `cb-trust-bar` + `cb-gallery` + `video-carousel`. same template and same 14 sections; only header and footer changed |
| P29 | Page | /pages/contact (contact form) | `/pages/contact` `contact-form` | KEPT | live has `contact-form`; draft has `contact-form` |
| P30 | Page | /pages/about-us | `/pages/about-us` `title:About Us` | KEPT | live has `title:About Us`; draft has `title:About Us` |
| P31 | Page | /pages/become-a-stockist | `/pages/become-a-stockist` `title:Become a Stockist` + `contact-form` | KEPT | live has `title:Become a Stockist` + `contact-form`; draft has `title:Become a Stockist` + `contact-form` |
| P32 | Page | /pages/request-your-car | `/pages/request-your-car` `title:Request Your Car Shade` + `contact-form` | KEPT | live has `title:Request Your Car Shade` + `contact-form`; draft has `title:Request Your Car Shade` + `contact-form` |
| P33 | Page | /pages/find-my-car | `/pages/find-my-car` `title:Find my car` | KEPT | live has `title:Find my car`; draft has `title:Find my car`. no longer linked from the footer, see P25 |
| P34 | Page | /pages/faqs | `/pages/faqs` `title:FAQs` | KEPT | live has `title:FAQs`; draft has `title:FAQs`. the live page body is empty apart from its title and the Loox widget; the draft keeps the same URL. No longer linked from the footer, see P24 |
| P35 | Page | /pages/happy-customers (Loox aggregated reviews) | `/pages/happy-customers` `title:Happy Customers` + `loox` | KEPT | live has `title:Happy Customers` + `loox`; draft has `title:Happy Customers` + `loox`. Loox aggregated app block is still in the template |
| P36 | Page | /pages/shop-by-make (shop by brand grid, 19 makes) | `/pages/shop-by-make` `title:Shop By Make` + `Mercedes-Benz` | KEPT | live has `title:Shop By Make` + `Mercedes-Benz`; draft has `title:Shop By Make` + `Mercedes-Benz` |
| P37 | Page | /pages/return-policy | `/pages/return-policy` `title:Check Refund &amp; Returns Policy` | KEPT | live has `title:Check Refund &amp; Returns Policy`; draft has `title:Check Refund &amp; Returns Policy` |
| P38 | Page | /pages/order-cancellation-policy | `/pages/order-cancellation-policy` `title:Order Cancellation Policy` | KEPT | live has `title:Order Cancellation Policy`; draft has `title:Order Cancellation Policy` |
| P39 | Page | /pages/payment-policy | `/pages/payment-policy` `title:Payment Policy` | KEPT | live has `title:Payment Policy`; draft has `title:Payment Policy` |
| P40 | Page | /pages/legal-disclaimer | `/pages/legal-disclaimer` `title:Legal Disclaimer` | KEPT | live has `title:Legal Disclaimer`; draft has `title:Legal Disclaimer` |
| P41 | Page | /pages/accessibility-statement | `/pages/accessibility-statement` `title:Accessibility Statement` | KEPT | live has `title:Accessibility Statement`; draft has `title:Accessibility Statement` |
| P42 | Page | /pages/cookie-policy | `/pages/cookie-policy` `title:Cookie Policy` | KEPT | live has `title:Cookie Policy`; draft has `title:Cookie Policy` |
| P43 | Policy | /policies/privacy-policy | `/policies/privacy-policy` `title:Privacy policy` | KEPT | live has `title:Privacy policy`; draft has `title:Privacy policy`. Shopify policy page, theme independent |
| P44 | Policy | /policies/refund-policy | `/policies/refund-policy` `title:Refund policy` | KEPT | live has `title:Refund policy`; draft has `title:Refund policy` |
| P45 | Policy | /policies/shipping-policy | `/policies/shipping-policy` `title:Shipping policy` | KEPT | live has `title:Shipping policy`; draft has `title:Shipping policy` |
| P46 | Policy | /policies/terms-of-service | `/policies/terms-of-service` `title:Terms of service` | KEPT | live has `title:Terms of service`; draft has `title:Terms of service` |
| P47 | Page | 404 page | `/this-page-does-not-exist-xyz` | KEPT | live must answer 404. both answer 404 with the same Shopify sample content; the marker check is the status itself |
| P48 | Page | /blogs/news listing and its articles | `/blogs/news` `title:News` + `/blogs/news/how-do-you-install-car-window-shades` | KEPT | live has `title:News` + `/blogs/news/how-do-you-install-car-window-shades`; draft has `title:News` + `/blogs/news/how-do-you-install-car-window-shades`. the article URL itself is in the URL sweep |
| P49 | Collection | /collections/all toolbar (car picker, In Stock, sort) | `/collections/all` `car-picker` + `In Stock` | KEPT | live has `car-picker` + `In Stock`; draft has `car-picker` + `In Stock` |
| P50 | Collection | /collections/car-window-shades toolbar | `/collections/car-window-shades` `car-picker` + `In Stock` | KEPT | live has `car-picker` + `In Stock`; draft has `car-picker` + `In Stock`. non-wiper collections keep collection-product-grid-v7 untouched |
| P51 | Collection | /collections/windscreen-sun-shade | `/collections/windscreen-sun-shade` `car-picker` | KEPT | live has `car-picker`; draft has `car-picker`. non-wiper collections keep collection-product-grid-v7 untouched |
| P52 | Collection | /collections/wiper-blades car picker and sort control | `/collections/wiper-blades` `car-picker` + `Filter & Sort` | MISSING | live has `car-picker` + `Filter & Sort`; draft must not have `car-picker` + `sort_by` + `Filter & Sort`. ezy-collection replaces the grid for any collection handle containing "wiper": a text box over the full list, no car picker and no price or best-selling sort. The In Stock toggle survives, see P97 |
| P53 | Collection | Brand collections, for example the Toyota shade and blade collection | `/collections/sun-shade-for-car-wiper-bladess-for-toyota` `car-picker` | MISSING | live has `car-picker`; draft must not have `car-picker`. same ezy-collection swap as P52: the draft answers the URL and links it from the header drawer, but the car picker is replaced by a text box and the sort control is gone. In Stock survives, see P97 |
| P54 | Search | /search toolbar (car picker, In Stock toggle, sort) | `/search?q=Toyota` `car-picker` + `Filter & Sort` | MISSING | live has `car-picker` + `Filter & Sort`; draft must not have `car-picker` + `Filter & Sort`. ezy-search has a single text box and a result grid, nothing else |
| P55 | Search | /search product results | `/search?q=Toyota` `href="/products/` | KEPT | live has `href="/products/`; draft has `href="/products/`. same products, ranked blades first on the draft |
| P56 | Shade product | Add-ons and Add All to Cart | `/products/rear-side-windows-click-shades-for-toyota-rav4-2019-2025` `add-complete-set` | KEPT | live has `add-complete-set`; draft has `add-complete-set`. shade products still render main-product-v2 unchanged |
| P57 | Shade product | Loox product reviews | `/products/rear-side-windows-click-shades-for-toyota-rav4-2019-2025` `looxReviews` | KEPT | live has `looxReviews`; draft has `looxReviews` |
| P58 | Shade product | FAQ accordion on the product page | `/products/rear-side-windows-click-shades-for-toyota-rav4-2019-2025` `faq-section` | KEPT | live has `faq-section`; draft has `faq-section`. 14 questions, same as live |
| P59 | Shade product | Video carousel under the product | `/products/rear-side-windows-click-shades-for-toyota-rav4-2019-2025` `video-carousel` | KEPT | live has `video-carousel`; draft has `video-carousel` |
| P60 | Shade product | Afterpay message | `/products/rear-side-windows-click-shades-for-toyota-rav4-2019-2025` `Afterpay` | KEPT | live has `Afterpay`; draft has `Afterpay` |
| P61 | Shade product | Cart drawer | `/products/rear-side-windows-click-shades-for-toyota-rav4-2019-2025` `cart-drawer` | KEPT | live has `cart-drawer`; draft has `cart-drawer` |
| P62 | Wiper product | Add-ons and Add All to Cart | `/products/front-windscreen-wipers-for-toyota-rav4-2018` `add-complete-set` | KEPT | live has `add-complete-set`; draft has `add-complete-set` + `data-ezy-pdp`. ezy-product rebuilds it; the section now adds a spray and rear blade when the metafields exist |
| P63 | Wiper product | Loox product reviews | `/products/front-windscreen-wipers-for-toyota-rav4-2018` `looxReviews` | KEPT | live has `looxReviews`; draft has `looxReviews` |
| P64 | Wiper product | Afterpay message | `/products/front-windscreen-wipers-for-toyota-rav4-2018` `Afterpay` | KEPT | live has `Afterpay`; draft has `Afterpay` |
| P65 | Wiper product | 12-month warranty promise | `/products/front-windscreen-wipers-for-toyota-rav4-2018` `12-month warranty` | KEPT | live has `12-month warranty`; draft has `12-month warranty`. kept in the ezy-product tick list |
| P66 | Wiper product | Trust badges and "Secure checkout with" payment row | `/products/front-windscreen-wipers-for-toyota-rav4-2018` `Secure checkout` | KEPT | live has `Secure checkout`; draft has `Secure checkout` + `Aussie Quality`. Free Shipping, 30-Day Returns and Aussie Quality with the live wording, then Secure checkout with the store payment icons, under the add to cart button |
| P67 | Wiper product | Customer photo gallery (cb-gallery) | `/products/front-windscreen-wipers-for-toyota-rav4-2018` `cb-gallery` | MISSING | live has `cb-gallery`; draft must not have `cb-gallery`. the new page shows one product gallery, not the customer photo section |
| P68 | Wiper product | Video carousel (3 videos) | `/products/front-windscreen-wipers-for-toyota-rav4-2018` `video-carousel` | MISSING | live has `video-carousel`; draft must not have `video-carousel`. ezy-product renders one fitting video instead |
| P69 | Wiper product | Perfect Fit Guarantee section (cb-guarantee) | `/products/front-windscreen-wipers-for-toyota-rav4-2018` `cb-guarantee` | MISSING | live has `cb-guarantee`; draft must not have `cb-guarantee`. ezy-product keeps a one line 30-day return promise, the guarantee section is gone |
| P70 | Wiper product | "What You'll Notice" benefits (cb-benefits) | `/products/front-windscreen-wipers-for-toyota-rav4-2018` `cb-benefits` | MISSING | live has `cb-benefits`; draft must not have `cb-benefits` |
| P71 | Wiper product | Comparison table (cb-comparison) | `/products/front-windscreen-wipers-for-toyota-rav4-2018` `cb-comparison` | MISSING | live has `cb-comparison`; draft must not have `cb-comparison` |
| P72 | Wiper product | FAQ accordion (8 questions) | `/products/front-windscreen-wipers-for-toyota-rav4-2018` `faq-section` | REPLACED-BY ezy-faq | live has `faq-section`; draft has `ezy-faq`. 5 questions instead of 8 |
| P73 | Wiper product | "Trusted by 5,000+ customers Australia-wide" social proof | `/products/front-windscreen-wipers-for-toyota-rav4-2018` `Trusted by 5,000` | MISSING | live has `Trusted by 5,000`; draft must not have `Trusted by 5,000`. the draft shows a store review count instead, from Loox metafields |
| P74 | Wiper product | "What's Included" list | `/products/front-windscreen-wipers-for-toyota-rav4-2018` `What's Included` | REPLACED-BY ezy-product "What you get" | live has `What's Included`; draft must not have `What's Included` |
| P75 | Cart | Cart page upsell carousel and trust rating | `/cart` `upsell` | KEPT | live has `upsell`; draft has `upsell` + `cart-v7` |
| P76 | Cart | Green success banner ("Great choice!") | `/cart` `cart-v7__banner` | MISSING | live has `cart-v7__banner`; draft must not have `cart-v7__banner`. the cart drawer still says "Added to your cart" |
| P77 | Cart | Shipping and tax note | `/cart` `disclaimer` | REPLACED-BY ezy-cart-note | live has `disclaimer`; draft has `Free standard shipping`. now "Free standard shipping. Taxes shown at checkout." |
| P78 | SEO | Product structured data (Product, Offer, Brand, AggregateRating) | `/products/front-windscreen-wipers-for-toyota-rav4-2018` `"@type": "Product"` + `"@type": "AggregateRating"` | KEPT | live has `"@type": "Product"` + `"@type": "AggregateRating"`; draft has `"@type": "Product"` + `"@type": "AggregateRating"` |
| P79 | SEO | FAQPage structured data | `/products/front-windscreen-wipers-for-toyota-rav4-2018` `"@type": "FAQPage"` | KEPT | live has `"@type": "FAQPage"`; draft has `"@type": "FAQPage"`. 5 questions instead of 8, so fewer rich results |
| P80 | SEO | Organization and ContactPoint structured data | `/` `"@type": "Organization"` + `"@type": "ContactPoint"` | KEPT | live has `"@type": "Organization"` + `"@type": "ContactPoint"`; draft has `"@type": "Organization"` + `"@type": "ContactPoint"` |
| P81 | SEO | Canonical, Open Graph, Twitter tags | `/products/front-windscreen-wipers-for-toyota-rav4-2018` `rel="canonical"` + `property="og:type"` + `name="twitter:card"` | KEPT | live has `rel="canonical"` + `property="og:type"` + `name="twitter:card"`; draft has `rel="canonical"` + `property="og:type"` + `name="twitter:card"`. rewritten in snippets/ezy-seo.liquid instead of snippets/meta-tags.liquid |
| P82 | Tracking | Google Ads, GA4 and Google tags (gtag, AW-) | `/` `AW-` | KEPT | live has `AW-`; draft has `AW-`. layout/theme.liquid is unchanged for scripts; the tag ids come from Shopify |
| P83 | Tracking | Klaviyo onsite embed | `/` `klaviyo` | KEPT | live has `klaviyo`; draft has `klaviyo`. app embed block in config/settings_data.json, identical in both |
| P84 | Tracking | Microsoft Clarity | `/` `clarity` | KEPT | live has `clarity`; draft has `clarity` |
| P85 | Tracking | Shopify web pixels (trekkie, web-pixels) | `/` `web-pixels` + `trekkie` | KEPT | live has `web-pixels` + `trekkie`; draft has `web-pixels` + `trekkie` |
| P86 | App embed | Avada SEO suite embed | `/` `avada` | KEPT | live has `avada`; draft has `avada`. app block in config/settings_data.json, identical in both |
| P87 | App embed | Loox widget script | `/` `loox.io` | KEPT | live has `loox.io`; draft has `loox.io` |
| P88 | URL | robots.txt | `/robots.txt` `Sitemap` | KEPT | live has `Sitemap`; draft has `Sitemap` |
| P89 | URL | sitemap.xml | `/sitemap.xml` `sitemapindex` | KEPT | live has `sitemapindex`; draft has `sitemapindex`. Shopify generates it per store, theme independent |
| P90 | Template | page.clickblades-v2 / v3 alternate templates | `/pages/click-blades` `cb-hero` | NOT-NEEDED | live must answer 200. only one Click Blades page exists and it uses the clickblades suffix (P28); both files exist in the repo |
| P91 | Collection | /collections (all collections list) | `/collections` `title:Collections` + `/collections/car-window-shades` | KEPT | live has `title:Collections` + `/collections/car-window-shades`; draft has `title:Collections` + `/collections/car-window-shades`. list-collections template, same collection set from the store |
| P93 | Wiper product | Sticky mobile add-to-cart bar | `/products/front-windscreen-wipers-for-toyota-rav4-2018` `sticky-atc` | REPLACED-BY ezy-product sticky bar | live has `sticky-atc`; draft has `data-ezy-sticky`. same job, new markup: ezy-pdp__sticky carries the live price and the add button |
| P94 | Wiper product | Quantity stepper | `/products/front-windscreen-wipers-for-toyota-rav4-2018` `quantity-input` | REPLACED-BY ezy-qty minus and plus stepper | live has `quantity-input`; draft has `data-ezy-qty`. 1 to 10, same range as live |
| P95 | Wiper product | Pickup availability (21 Discovery Drive, Bibra Lake) | `/products/front-windscreen-wipers-for-toyota-rav4-2018` `pickup-availability` | REPLACED-BY ezy-pdp__pickup details block | live has `pickup-availability`; draft has `data-ezy-pickup`. same address and opening hours, collapsed instead of expanded |
| P96 | Homepage | Make, Model, Year finder that finds car window shades | `/` `ymm-form` + `ymm-dropdown` | REPLACED-BY ezy-hero finder with a Wipers / Sun shades choice | live has `ymm-form` + `ymm-dropdown`; draft has `data-ezy-finder-type` + `Sun shades`. Wipers is the default, so the blade flow is unchanged; Sun shades reads the same 20 brand collections as live and routes like live car-selector: one match opens the product, several go to /search?type=product&q=Brand+Model |
| P97 | Collection | In Stock toggle on the wiper collections | `/collections/wiper-blades` `In Stock` | KEPT | live has `In Stock`; draft has `In Stock`. rebuild inside ezy-collection, same shopper control as P49 and P50 |
| P98 | Shade product | "87% UV block" claim in the Why Choose Click Shades list | `/products/rear-side-windows-click-shades-for-toyota-rav4-2019-2025` `87%` | REPLACED-BY "UV protection" with no number | live has `87%`; draft must not have `87%`. the draft tells shoppers to see product details for the UV information; the live number and the 87% UV Block badge are gone from the shade page and from the benefits bar |

## Missing items

11 rows are MISSING. Severity is from the shopper's side, not the code's:

- **blocks switch**: a shopper loses a way to see or buy the shop's main product, or a
  promise the business is built on disappears. Fix before the live switch. No row carries
  this severity any more: P02 and P96, the two blockers, closed in MACL-37.
- **nice to have**: the shopper can still reach the same outcome another way; the loss is
  convenience, reassurance or content depth. Can ship after the switch, in priority order.

| ID | What live offers | Severity | Why it matters | Smallest fix |
|---|---|---|---|---|
| P52 | Car picker and price/best-selling sort on `/collections/wiper-blades` | nice to have | The main blade collection became one long list with a text box; In Stock survives, sort does not | Add sort and car filter to `ezy-collection` |
| P53 | The same car picker and sort on the 24 collections whose handle contains "wiper" | nice to have | Same cause as P52, 24 more URLs that Google indexes, most of them brand pages | Same fix as P52 |
| P54 | Car picker, In Stock toggle and sort on `/search` | nice to have | Search results are a plain grid; a shopper searching "Toyota" cannot narrow by car or stock | Reuse the collection toolbar on `ezy-search` |
| P67 | Customer photo gallery on the wiper product page | nice to have | Real customer photos under the buy area; the new page shows the product gallery only | Add `cb-gallery` to `product.wiper-v3.json` |
| P68 | Three-video carousel on the wiper product page | nice to have | One fitting video remains, the carousel of three is gone | Add `video-carousel` back to the wiper templates |
| P69 | Perfect Fit Guarantee section on the wiper product page | nice to have | The guarantee section with its three points and CTA is replaced by one line of return copy | Add `cb-guarantee` back, or fold its three points into `ezy-product` |
| P70 | "What You'll Notice" benefit cards on the wiper product page | nice to have | Four benefit cards with proof copy are gone | Add `cb-benefits` back to the wiper templates |
| P71 | Click Blades comparison table on the wiper product page | nice to have | The "us vs cheap blades vs dealership" table is gone from the product page (it is still on `/pages/click-blades`) | Add `cb-comparison` back, or link to it |
| P73 | "Trusted by 5,000+ customers Australia-wide" on the wiper product page | nice to have | Social proof line is replaced by a Loox review count | Add the line back with the current Loox number |
| P05 | Five shade benefit cards on the homepage (triple laminate, 3D laser fit, UV, interior, install) | nice to have | The shade story left the homepage; it still lives on shade product pages | Add a shade benefits block to the homepage |
| P76 | Green "Great choice!" banner on the cart page | nice to have | Confirmation moment on the cart page is gone; the drawer still confirms | Re-add the banner in `main-cart-v7` |

The two switch blockers are closed. P02 came back as a shade products row built from the
same `top-picks` collection live uses, right after the blade type cards. P96 came back as a
Wipers / Sun shades choice in the homepage finder, Wipers by default so the blade flow did
not change, Sun shades reading the same 20 brand collections live's car-selector reads.

Eight cheap items closed with them: P08, P13, P14, P19, P22, P23 and P66.

One limit on P96 worth knowing: a brand whose collection carries no shade products yet
(BMW, Mercedes-Benz, Volkswagen, Lexus, Chevrolet, Geely, Infiniti, Chery at the last run)
shows no models under Sun shades. Live has the same dead end when a collection is empty.

## Checked by file diff, not by HTTP

Some theme files cannot be proven through the storefront, so they were compared in the
repo instead. Both repos are on this server:

- `config/settings_data.json` is byte identical, so the three app blocks in it are the same
  on both themes: Avada SEO suite, Microsoft Clarity, Klaviyo onsite embed (P83, P86, P87).
- `layout/theme.liquid` differs only in the `<head>`: the title, description and meta tags
  moved into `snippets/ezy-seo.liquid`, and `ezy.css` is added. Every tracking script, web
  pixel and app embed line is untouched (P82, P85).
- `locales/en.default.json` and the other 40 locale files are identical, so no shopper
  string was dropped.
- `templates/customers/*.json`, `templates/gift_card.liquid`, `templates/password.liquid`
  and `layout/password.liquid` are identical. `/account/login` answers 200 or 406 depending
  on Shopify's bot protection, so it is not in the HTTP sweep.
- Redirects live in Shopify admin, not in a theme, so a theme switch cannot change them.
  The URLs Google and ads hit are in the script's URL sweep and every one answers 200 on
  both (38 of 38 in the last run).
- Menus come from Shopify linklists and are shared by both themes. What differs is which
  links the header and footer render, and that is the P13 to P27 block.

## How to update this file

1. Change the row in `scripts/parity.mjs` (its `ROWS` array is the source of truth).
2. Run `node .claude/skills/verify-ezyfit/scripts/parity.mjs --md` and paste the table
   above, or copy the changed rows by hand.
3. Run the full check and save the output next to this file:
   `node .claude/skills/verify-ezyfit/scripts/parity.mjs > features/parity-evidence-<date>.txt`
4. Move any MISSING item that got fixed to KEPT or REPLACED-BY, and take it out of the
   severity table.
