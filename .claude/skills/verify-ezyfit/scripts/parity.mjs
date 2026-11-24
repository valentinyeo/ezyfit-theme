#!/usr/bin/env node
/**
 * Live parity check: the Click Shades live theme vs the EZYFIT draft theme.
 *
 * Reads the live storefront (theme 149894070428, served at clickshades.com.au) and
 * the draft theme (158148984988, served through the store's myshopify domain with
 * ?preview_theme_id=), plain HTTP only, no browser. Every row in
 * features/parity.md is one row here, same id.
 *
 * A row PASSES when the map still tells the truth:
 *   KEPT / REPLACED-BY  the live marker exists on live AND the draft marker exists on draft
 *   MISSING             the live marker exists on live AND the draft marker is still absent
 *   NOT-NEEDED          the live marker exists on live, no draft assertion
 * A row FAILS when live lost the original feature, or the draft gained/lost a marker
 * that the map says it has. A FAIL on a MISSING row means the gap closed: move the
 * row in features/parity.md and here.
 *
 * Usage:
 *   node .claude/skills/verify-ezyfit/scripts/parity.mjs           # every row and URL
 *   node .claude/skills/verify-ezyfit/scripts/parity.mjs --rows    # rows only, no URL sweep
 *   node .claude/skills/verify-ezyfit/scripts/parity.mjs --id P54  # one row
 *   node .claude/skills/verify-ezyfit/scripts/parity.mjs --verbose # show every marker miss
 *   node .claude/skills/verify-ezyfit/scripts/parity.mjs --md      # the features/parity.md table
 *
 * This file is the source of truth for the table in features/parity.md. After changing a
 * row, regenerate the table with --md and paste it in, so the doc and the check cannot drift.
 *
 * Exit 1 on any FAIL. Never touches the live theme, never pushes anything.
 */

const LIVE_ORIGIN = 'https://clickshades.com.au';
const DRAFT_ORIGIN = 'https://easy-fit-store1.myshopify.com';
const DRAFT_THEME = '158148984988';
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
// Shopify answers 429 when it decides a crawler is too eager. Two in flight, plus a
// backoff retry below, keeps a full run under the limiter on this store.
const CONCURRENCY = 2;

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const value = (f) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : undefined;
};
if (has('--help') || has('-h')) {
  console.log(
    'parity.mjs [--rows] [--id P01] [--verbose] [--md]\n' +
      '  Compares live theme 149894070428 with draft theme ' +
      DRAFT_THEME +
      ' over plain HTTP.'
  );
  process.exit(0);
}
const VERBOSE = has('--verbose');
const ONLY_ID = value('--id');
const ROWS_ONLY = has('--rows');
const MD = has('--md');

if (!/^\d+$/.test(DRAFT_THEME)) throw new Error('bad draft theme id');

/* ---------------------------------------------------------------- cookies -- */

/*
 * Two separate jars. The draft preview answers on the store's myshopify domain and then
 * redirects to clickshades.com.au, where it sets cookies. Sharing one jar would send those
 * cookies to the live site and make live look like the draft.
 */
const jars = { live: [], draft: [] };

function cookiesFor(session, host) {
  return jars[session]
    .filter((c) => host === c.domain || host.endsWith('.' + c.domain))
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

function storeCookies(session, setCookies, fallbackHost) {
  const jar = jars[session];
  for (const raw of setCookies) {
    const parts = raw.split(';').map((s) => s.trim());
    const eq = parts[0].indexOf('=');
    if (eq < 0) continue;
    const name = parts[0].slice(0, eq);
    const val = parts[0].slice(eq + 1);
    const dom = parts.find((p) => /^domain=/i.test(p));
    const domain = (dom ? dom.split('=')[1] : fallbackHost).replace(/^\./, '').toLowerCase();
    const rec = { domain, name, value: val };
    const i = jar.findIndex((c) => c.domain === domain && c.name === name);
    if (i >= 0) jar[i] = rec;
    else jar.push(rec);
  }
}

/* --------------------------------------------------------------- fetching -- */

const cache = new Map();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 429 and 503 are the limiter, not an answer. Wait it out instead of reporting a FAIL
// the theme never caused. Everything else is returned as-is, including 404 and 406.
async function fetchWithBackoff(url, session, host) {
  const waits = [2000, 6000, 15000, 30000, 60000];
  for (let attempt = 0; ; attempt++) {
    const cookie = cookiesFor(session, host);
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(60000),
      headers: {
        'user-agent': UA,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-AU,en;q=0.9',
        ...(cookie ? { cookie } : {}),
      },
    });
    if (res.status !== 429 && res.status !== 503) return res;
    await res.arrayBuffer().catch(() => {});
    if (attempt >= waits.length) return res;
    const after = Number(res.headers.get('retry-after')) * 1000;
    await sleep(Number.isFinite(after) && after > 0 ? after : waits[attempt]);
  }
}

async function getPage(url, session) {
  const key = session + ' ' + url;
  if (cache.has(key)) return cache.get(key);
  const run = (async () => {
    let target = url;
    for (let hop = 0; hop < 8; hop++) {
      const host = new URL(target).host;
      const res = await fetchWithBackoff(target, session, host);
      if (typeof res.headers.getSetCookie === 'function') {
        storeCookies(session, res.headers.getSetCookie(), host);
      }
      const loc = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && loc) {
        target = new URL(loc, target).href;
        await res.arrayBuffer().catch(() => {});
        continue;
      }
      const body = await res.text();
      return { status: res.status, body, url: target };
    }
    return { status: 0, body: '', url: target, error: 'too many redirects' };
  })().catch((err) => ({ status: 0, body: '', url, error: String(err && err.message) }));
  cache.set(key, run);
  return run;
}

const liveUrl = (path) => LIVE_ORIGIN + path;
const draftUrl = (path) =>
  DRAFT_ORIGIN + path + (path.includes('?') ? '&' : '?') + 'preview_theme_id=' + DRAFT_THEME;

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    })
  );
  return out;
}

/* ------------------------------------------------------------------- rows -- */
/*
 * expect:
 *   'present'  the draft must still carry the feature (KEPT, REPLACED-BY)
 *   'absent'   the draft must NOT carry it yet (MISSING); a hit means the gap closed
 *   'none'     no draft assertion (NOT-NEEDED)
 */
const ROWS = [
  /* ----------------------------------------------------------- homepage -- */
  {
    id: 'P01',
    area: 'Homepage',
    item: 'Make, Model, Year finder',
    live: '/',
    liveHas: ['car-selector'],
    draft: '/',
    draftHas: ['data-ezy-finder'],
    expect: 'present',
    status: 'REPLACED-BY ezy-hero finder',
    note: 'draft finder reads the wiper-blades collection for Wipers and the live brand collections for Sun shades, see P96',
  },
  {
    id: 'P02',
    area: 'Homepage',
    item: 'Featured shade product cards (4 products with price and add to cart)',
    live: '/',
    liveHas: ['product-cards'],
    draft: '/',
    draftHas: ['ezy-shade-picks', 'ezy-pick__add'],
    expect: 'present',
    status: 'KEPT',
    note: 'same top-picks collection as live, four cards with image, price and add to cart, rebuilt in the new look as the ezy-shade-picks section; a sold-out card says Sold out and still links to the product',
  },
  {
    id: 'P03',
    area: 'Homepage',
    item: 'Customer video carousel (5 videos, lightbox)',
    live: '/',
    liveHas: ['video-carousel'],
    draft: '/',
    draftHas: ['video-carousel'],
    expect: 'absent',
    status: 'REPLACED-BY ezy-hero single fit video',
    note: 'one hero video ("Watch a real fit"), no carousel',
  },
  {
    id: 'P04',
    area: 'Homepage',
    item: 'Shop by Popular Cars grid (7 cars plus View All)',
    live: '/',
    liveHas: ['popular-models-grid'],
    draft: '/',
    draftHas: ['ezy-cars'],
    expect: 'present',
    status: 'REPLACED-BY ezy-popular-cars',
    note: '4 cars, no View All link to /pages/shop-by-make',
  },
  {
    id: 'P05',
    area: 'Homepage',
    item: "Five 'Why Click Shades' shade benefit cards",
    live: '/',
    liveHas: ['Triple Laminate Technology'],
    draft: '/',
    draftHas: ['Triple Laminate Technology'],
    expect: 'absent',
    status: 'MISSING',
    note: 'shade benefits live on shade product pages, not on the homepage any more',
  },
  {
    id: 'P06',
    area: 'Homepage',
    item: 'Loox customer reviews',
    live: '/',
    liveHas: ['looxReviews'],
    draft: '/',
    draftHas: ['looxReviews'],
    expect: 'present',
    status: 'REPLACED-BY ezy-reviews (#looxReviews)',
    note: 'the Loox script must fill the empty div at runtime; not provable over HTTP',
  },
  {
    id: 'P07',
    area: 'Homepage',
    item: 'Comparison table',
    live: '/',
    liveHas: ['comparison-table'],
    draft: '/',
    draftHas: ['ezy-compare'],
    expect: 'present',
    status: 'REPLACED-BY ezy-comparison',
    note: 'now framed as "Why not cheap blades?"',
  },
  {
    id: 'P08',
    area: 'Homepage',
    item: 'Trust badges row (Perfect Fit, 87% UV Block, Easy Install, 30-Day Returns)',
    live: '/',
    liveHas: ['trust-grid'],
    draft: '/',
    draftHas: ['ezy-trust', '87% UV Block'],
    expect: 'present',
    status: 'REPLACED-BY ezy-trust row',
    note: 'four badges with the live wording, above the FAQ like live',
  },
  {
    id: 'P09',
    area: 'Homepage',
    item: 'FAQ accordion (15 questions)',
    live: '/',
    liveHas: ['faq-section'],
    draft: '/',
    draftHas: ['ezy-faq'],
    expect: 'present',
    status: 'REPLACED-BY ezy-faq',
    note: '5 questions instead of 15, so FAQPage rich results shrink',
  },
  {
    id: 'P10',
    area: 'Homepage',
    item: 'Instagram feed app section',
    live: '/',
    liveHas: ['__instagram-feed'],
    draft: '/',
    draftHas: [],
    expect: 'none',
    status: 'NOT-NEEDED',
    note: 'the live section carries no app blocks, it renders an empty div',
  },
  {
    id: 'P11',
    area: 'Every page',
    item: 'Rotating benefits bar (Perfect Fit, Same-Day Dispatch, Free Shipping, 30-Day Returns, 87% UV)',
    live: '/',
    liveHas: ['benefits-bar'],
    draft: '/',
    draftHas: ['ezy-bar'],
    expect: 'present',
    status: 'REPLACED-BY ezy-announcement',
    note: '3 rotating messages instead of 5, no icons',
  },
  {
    id: 'P12',
    area: 'Homepage',
    item: 'Homepage title and description written for car window shades',
    live: '/',
    liveHas: ['Click Shades Australia | Official Store'],
    draft: '/',
    draftHas: ['Wiper blades made for your exact car'],
    expect: 'present',
    status: 'REPLACED-BY ezy-seo wiper copy',
    note: 'SEO risk: the live homepage ranks as a shade page and the draft as a wiper page',
  },

  /* ----------------------------------------------------------- header -- */
  {
    id: 'P13',
    area: 'Header',
    item: 'Nav item "Shop by Make" opens /pages/shop-by-make',
    live: '/',
    liveHas: ['href="/pages/shop-by-make"'],
    draft: '/',
    draftHas: ['href="/pages/shop-by-make"'],
    expect: 'present',
    status: 'KEPT',
    note: 'the header remaps the main-menu title Shop by Make to the page; the linklist itself is store data and is untouched',
  },
  {
    id: 'P14',
    area: 'Header',
    item: 'Nav item "Shop Blades" opens the Click Blades landing page',
    live: '/',
    liveHas: ['href="/pages/click-blades"'],
    draft: '/',
    draftHas: ['href="/pages/click-blades"'],
    expect: 'present',
    status: 'KEPT',
    note: 'same remap as P13, desktop nav and phone drawer',
  },
  {
    id: 'P15',
    area: 'Header',
    item: 'Reviews page linked from the site',
    live: '/',
    liveHas: ['/pages/happy-customers'],
    draft: '/',
    draftHas: ['/pages/happy-customers'],
    expect: 'present',
    status: 'KEPT',
    note: 'dropped from the header nav, kept in the footer',
  },
  {
    id: 'P16',
    area: 'Header',
    item: 'Search, account, cart count, phone drawer',
    live: '/',
    liveHas: ['action="/search"'],
    draft: '/',
    draftHas: ['data-ezy-search', 'data-ezy-drawer', 'data-cart-count'],
    expect: 'present',
    status: 'KEPT',
    note: 'draft search is a plain GET form, live has no live predictive panel either',
  },
  {
    id: 'P17',
    area: 'Header',
    item: 'Click Blades logo on wiper products and Click Blades pages',
    live: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    liveHas: ['clickblades-logo'],
    draft: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    draftHas: ['clickblades-logo'],
    expect: 'present',
    status: 'KEPT',
    note: '',
  },

  /* ----------------------------------------------------------- footer -- */
  {
    id: 'P18',
    area: 'Footer',
    item: 'Newsletter signup form (footer on every page)',
    live: '/',
    liveHas: ['Subscribe to Our Newsletter'],
    draft: '/',
    draftHas: ['ezy-lead-email', 'Sign me up'],
    expect: 'present',
    status: 'REPLACED-BY ezy-lead-capture on the homepage',
    note: 'the draft captures email with a Shopify customer form tagged newsletter, but only on the homepage, not in the footer on every page like live',
  },
  {
    id: 'P19',
    area: 'Footer',
    item: 'Email address and phone (mailto and tel links)',
    live: '/',
    liveHas: ['mailto:sales@clickshades.com.au'],
    draft: '/',
    draftHas: ['mailto:sales@clickshades.com.au', 'tel:1300399348'],
    expect: 'present',
    status: 'KEPT',
    note: 'the email is the live footer address; live prints no phone in the footer, so the number is the one live shows in its header, 1300 399 348',
  },
  {
    id: 'P20',
    area: 'Footer',
    item: 'Policy links (privacy, terms, shipping, refund, payment, cancellation, legal, accessibility, cookie)',
    live: '/',
    liveHas: ['/policies/privacy-policy', '/policies/refund-policy'],
    draft: '/',
    draftHas: ['/policies/privacy-policy', '/policies/refund-policy'],
    expect: 'present',
    status: 'KEPT',
    note: '',
  },
  {
    id: 'P21',
    area: 'Footer',
    item: 'Payment icons',
    live: '/',
    liveHas: ['payment-icon'],
    draft: '/',
    draftHas: ['payment-icon'],
    expect: 'present',
    status: 'KEPT',
    note: 'same nine icons, Afterpay included',
  },
  {
    id: 'P22',
    area: 'Footer',
    item: 'Afterpay block (Buy now, pay later, 4 interest-free payments)',
    live: '/',
    liveHas: ['Buy now, pay later'],
    draft: '/',
    draftHas: ['Buy now, pay later'],
    expect: 'present',
    status: 'KEPT',
    note: 'same live wording under the payment icons',
  },
  {
    id: 'P23',
    area: 'Footer',
    item: 'Link to the Windscreen Sun Shade collection',
    live: '/',
    liveHas: ['/collections/windscreen-sun-shade'],
    draft: '/',
    draftHas: ['/collections/windscreen-sun-shade'],
    expect: 'present',
    status: 'KEPT',
    note: 'the collection answers too, see P51',
  },
  {
    id: 'P24',
    area: 'Footer',
    item: 'FAQs link opens /pages/faqs',
    live: '/',
    liveHas: ['href="/pages/faqs"'],
    draft: '/',
    draftHas: ['href="/pages/faqs"'],
    expect: 'absent',
    status: 'REPLACED-BY /#ezy-faq',
    note: 'the FAQ page still answers (P34); the link now jumps to the homepage accordion',
  },
  {
    id: 'P25',
    area: 'Footer',
    item: 'Find my car link opens /pages/find-my-car',
    live: '/',
    liveHas: ['href="/pages/find-my-car"'],
    draft: '/',
    draftHas: ['href="/pages/find-my-car"'],
    expect: 'absent',
    status: 'REPLACED-BY /#find',
    note: 'the page still answers (P33); the link now jumps to the homepage finder',
  },
  {
    id: 'P26',
    area: 'Footer',
    item: 'Business name, ABN, address, hours',
    live: '/',
    liveHas: ['24 127 742 441'],
    draft: '/',
    draftHas: ['24 127 742 441'],
    expect: 'present',
    status: 'KEPT',
    note: '',
  },
  {
    id: 'P27',
    area: 'Footer',
    item: 'Social links (Facebook, Instagram)',
    live: '/',
    liveHas: ['instagram.com/clickshades'],
    draft: '/',
    draftHas: ['instagram.com/clickshades'],
    expect: 'present',
    status: 'KEPT',
    note: 'the "Follow Us" heading and blurb are gone, the icons stay',
  },

  /* ------------------------------------------------------------ pages -- */
  {
    id: 'P28',
    area: 'Page',
    item: '/pages/click-blades (Click Blades ad landing)',
    live: '/pages/click-blades',
    liveHas: ['cb-hero', 'cb-trust-bar', 'cb-gallery', 'video-carousel'],
    draft: '/pages/click-blades',
    draftHas: ['cb-hero', 'cb-trust-bar', 'cb-gallery', 'video-carousel', 'product-carousel-card', 'Nissan Navara/NP300'],
    expect: 'present',
    status: 'KEPT',
    note: 'same template and same 14 sections; only header and footer changed. the blade carousel is still live product-cards: an earlier MACL-37 commit rebuilt that section for shades and took these eight blade cards away, fixed by moving the shade row into sections/ezy-shade-picks.liquid',
  },
  {
    id: 'P29',
    area: 'Page',
    item: '/pages/contact (contact form)',
    live: '/pages/contact',
    liveHas: ['contact-form'],
    draft: '/pages/contact',
    draftHas: ['contact-form'],
    expect: 'present',
    status: 'KEPT',
    note: '',
  },
  {
    id: 'P30',
    area: 'Page',
    item: '/pages/about-us',
    live: '/pages/about-us',
    liveHas: ['title:About Us'],
    draft: '/pages/about-us',
    draftHas: ['title:About Us'],
    expect: 'present',
    status: 'KEPT',
    note: '',
  },
  {
    id: 'P31',
    area: 'Page',
    item: '/pages/become-a-stockist',
    live: '/pages/become-a-stockist',
    liveHas: ['title:Become a Stockist', 'contact-form'],
    draft: '/pages/become-a-stockist',
    draftHas: ['title:Become a Stockist', 'contact-form'],
    expect: 'present',
    status: 'KEPT',
    note: '',
  },
  {
    id: 'P32',
    area: 'Page',
    item: '/pages/request-your-car',
    live: '/pages/request-your-car',
    liveHas: ['title:Request Your Car Shade', 'contact-form'],
    draft: '/pages/request-your-car',
    draftHas: ['title:Request Your Car Shade', 'contact-form'],
    expect: 'present',
    status: 'KEPT',
    note: '',
  },
  {
    id: 'P33',
    area: 'Page',
    item: '/pages/find-my-car',
    live: '/pages/find-my-car',
    liveHas: ['title:Find my car'],
    draft: '/pages/find-my-car',
    draftHas: ['title:Find my car'],
    expect: 'present',
    status: 'KEPT',
    note: 'no longer linked from the footer, see P25',
  },
  {
    id: 'P34',
    area: 'Page',
    item: '/pages/faqs',
    live: '/pages/faqs',
    liveHas: ['title:FAQs'],
    draft: '/pages/faqs',
    draftHas: ['title:FAQs'],
    expect: 'present',
    status: 'KEPT',
    note: 'the live page body is empty apart from its title and the Loox widget; the draft keeps the same URL. No longer linked from the footer, see P24',
  },
  {
    id: 'P35',
    area: 'Page',
    item: '/pages/happy-customers (Loox aggregated reviews)',
    live: '/pages/happy-customers',
    liveHas: ['title:Happy Customers', 'loox'],
    draft: '/pages/happy-customers',
    draftHas: ['title:Happy Customers', 'loox'],
    expect: 'present',
    status: 'KEPT',
    note: 'Loox aggregated app block is still in the template',
  },
  {
    id: 'P36',
    area: 'Page',
    item: '/pages/shop-by-make (shop by brand grid, 19 makes)',
    live: '/pages/shop-by-make',
    liveHas: ['title:Shop By Make', 'Mercedes-Benz'],
    draft: '/pages/shop-by-make',
    draftHas: ['title:Shop By Make', 'Mercedes-Benz'],
    expect: 'present',
    status: 'KEPT',
    note: '',
  },
  {
    id: 'P37',
    area: 'Page',
    item: '/pages/return-policy',
    live: '/pages/return-policy',
    liveHas: ['title:Check Refund &amp; Returns Policy'],
    draft: '/pages/return-policy',
    draftHas: ['title:Check Refund &amp; Returns Policy'],
    expect: 'present',
    status: 'KEPT',
    note: '',
  },
  {
    id: 'P38',
    area: 'Page',
    item: '/pages/order-cancellation-policy',
    live: '/pages/order-cancellation-policy',
    liveHas: ['title:Order Cancellation Policy'],
    draft: '/pages/order-cancellation-policy',
    draftHas: ['title:Order Cancellation Policy'],
    expect: 'present',
    status: 'KEPT',
    note: '',
  },
  {
    id: 'P39',
    area: 'Page',
    item: '/pages/payment-policy',
    live: '/pages/payment-policy',
    liveHas: ['title:Payment Policy'],
    draft: '/pages/payment-policy',
    draftHas: ['title:Payment Policy'],
    expect: 'present',
    status: 'KEPT',
    note: '',
  },
  {
    id: 'P40',
    area: 'Page',
    item: '/pages/legal-disclaimer',
    live: '/pages/legal-disclaimer',
    liveHas: ['title:Legal Disclaimer'],
    draft: '/pages/legal-disclaimer',
    draftHas: ['title:Legal Disclaimer'],
    expect: 'present',
    status: 'KEPT',
    note: '',
  },
  {
    id: 'P41',
    area: 'Page',
    item: '/pages/accessibility-statement',
    live: '/pages/accessibility-statement',
    liveHas: ['title:Accessibility Statement'],
    draft: '/pages/accessibility-statement',
    draftHas: ['title:Accessibility Statement'],
    expect: 'present',
    status: 'KEPT',
    note: '',
  },
  {
    id: 'P42',
    area: 'Page',
    item: '/pages/cookie-policy',
    live: '/pages/cookie-policy',
    liveHas: ['title:Cookie Policy'],
    draft: '/pages/cookie-policy',
    draftHas: ['title:Cookie Policy'],
    expect: 'present',
    status: 'KEPT',
    note: '',
  },
  {
    id: 'P43',
    area: 'Policy',
    item: '/policies/privacy-policy',
    live: '/policies/privacy-policy',
    liveHas: ['title:Privacy policy'],
    draft: '/policies/privacy-policy',
    draftHas: ['title:Privacy policy'],
    expect: 'present',
    status: 'KEPT',
    note: 'Shopify policy page, theme independent',
  },
  {
    id: 'P44',
    area: 'Policy',
    item: '/policies/refund-policy',
    live: '/policies/refund-policy',
    liveHas: ['title:Refund policy'],
    draft: '/policies/refund-policy',
    draftHas: ['title:Refund policy'],
    expect: 'present',
    status: 'KEPT',
    note: '',
  },
  {
    id: 'P45',
    area: 'Policy',
    item: '/policies/shipping-policy',
    live: '/policies/shipping-policy',
    liveHas: ['title:Shipping policy'],
    draft: '/policies/shipping-policy',
    draftHas: ['title:Shipping policy'],
    expect: 'present',
    status: 'KEPT',
    note: '',
  },
  {
    id: 'P46',
    area: 'Policy',
    item: '/policies/terms-of-service',
    live: '/policies/terms-of-service',
    liveHas: ['title:Terms of service'],
    draft: '/policies/terms-of-service',
    draftHas: ['title:Terms of service'],
    expect: 'present',
    status: 'KEPT',
    note: '',
  },
  {
    id: 'P47',
    area: 'Page',
    item: '404 page',
    live: '/this-page-does-not-exist-xyz',
    liveHas: [],
    draft: '/this-page-does-not-exist-xyz',
    draftHas: [],
    expectedStatus: 404,
    expect: 'none',
    status: 'KEPT',
    note: 'both answer 404 with the same Shopify sample content; the marker check is the status itself',
  },
  {
    id: 'P48',
    area: 'Page',
    item: '/blogs/news listing and its articles',
    live: '/blogs/news',
    liveHas: ['title:News', '/blogs/news/how-do-you-install-car-window-shades'],
    draft: '/blogs/news',
    draftHas: ['title:News', '/blogs/news/how-do-you-install-car-window-shades'],
    expect: 'present',
    status: 'KEPT',
    note: 'the article URL itself is in the URL sweep',
  },

  /* ------------------------------------------------------ collections -- */
  {
    id: 'P49',
    area: 'Collection',
    item: '/collections/all toolbar (car picker, In Stock, sort)',
    live: '/collections/all',
    liveHas: ['car-picker', 'In Stock'],
    draft: '/collections/all',
    draftHas: ['car-picker', 'In Stock'],
    expect: 'present',
    status: 'KEPT',
    note: '',
  },
  {
    id: 'P50',
    area: 'Collection',
    item: '/collections/car-window-shades toolbar',
    live: '/collections/car-window-shades',
    liveHas: ['car-picker', 'In Stock'],
    draft: '/collections/car-window-shades',
    draftHas: ['car-picker', 'In Stock'],
    expect: 'present',
    status: 'KEPT',
    note: 'non-wiper collections keep collection-product-grid-v7 untouched',
  },
  {
    id: 'P51',
    area: 'Collection',
    item: '/collections/windscreen-sun-shade',
    live: '/collections/windscreen-sun-shade',
    liveHas: ['car-picker'],
    draft: '/collections/windscreen-sun-shade',
    draftHas: ['car-picker'],
    expect: 'present',
    status: 'KEPT',
    note: 'non-wiper collections keep collection-product-grid-v7 untouched',
  },
  {
    id: 'P52',
    area: 'Collection',
    item: '/collections/wiper-blades car picker and sort control',
    live: '/collections/wiper-blades',
    liveHas: ['car-picker', 'Filter & Sort'],
    draft: '/collections/wiper-blades',
    draftHas: ['car-picker', 'sort_by', 'Filter & Sort'],
    expect: 'absent',
    status: 'MISSING',
    note: 'ezy-collection replaces the grid for any collection handle containing "wiper": a text box over the full list, no car picker and no price or best-selling sort. The In Stock toggle survives, see P97',
  },
  {
    id: 'P53',
    area: 'Collection',
    item: 'Brand collections, for example the Toyota shade and blade collection',
    live: '/collections/sun-shade-for-car-wiper-bladess-for-toyota',
    liveHas: ['car-picker'],
    draft: '/collections/sun-shade-for-car-wiper-bladess-for-toyota',
    draftHas: ['car-picker'],
    expect: 'absent',
    status: 'MISSING',
    note: 'same ezy-collection swap as P52: the draft answers the URL and links it from the header drawer, but the car picker is replaced by a text box and the sort control is gone. In Stock survives, see P97',
  },

  /* ----------------------------------------------------------- search -- */
  {
    id: 'P54',
    area: 'Search',
    item: '/search toolbar (car picker, In Stock toggle, sort)',
    live: '/search?q=Toyota',
    liveHas: ['car-picker', 'Filter & Sort'],
    draft: '/search?q=Toyota',
    draftHas: ['car-picker', 'Filter & Sort'],
    expect: 'absent',
    status: 'MISSING',
    note: 'ezy-search has a single text box and a result grid, nothing else',
  },
  {
    id: 'P55',
    area: 'Search',
    item: '/search product results',
    live: '/search?q=Toyota',
    liveHas: ['href="/products/'],
    draft: '/search?q=Toyota',
    draftHas: ['href="/products/'],
    expect: 'present',
    status: 'KEPT',
    note: 'same products, ranked blades first on the draft',
  },

  /* ------------------------------------------------ shade product page -- */
  {
    id: 'P56',
    area: 'Shade product',
    item: 'Add-ons and Add All to Cart',
    live: '/products/rear-side-windows-click-shades-for-toyota-rav4-2019-2025',
    liveHas: ['add-complete-set'],
    draft: '/products/rear-side-windows-click-shades-for-toyota-rav4-2019-2025',
    draftHas: ['add-complete-set'],
    expect: 'present',
    status: 'KEPT',
    note: 'shade products still render main-product-v2 unchanged',
  },
  {
    id: 'P57',
    area: 'Shade product',
    item: 'Loox product reviews',
    live: '/products/rear-side-windows-click-shades-for-toyota-rav4-2019-2025',
    liveHas: ['looxReviews'],
    draft: '/products/rear-side-windows-click-shades-for-toyota-rav4-2019-2025',
    draftHas: ['looxReviews'],
    expect: 'present',
    status: 'KEPT',
    note: '',
  },
  {
    id: 'P58',
    area: 'Shade product',
    item: 'FAQ accordion on the product page',
    live: '/products/rear-side-windows-click-shades-for-toyota-rav4-2019-2025',
    liveHas: ['faq-section'],
    draft: '/products/rear-side-windows-click-shades-for-toyota-rav4-2019-2025',
    draftHas: ['faq-section'],
    expect: 'present',
    status: 'KEPT',
    note: '14 questions, same as live',
  },
  {
    id: 'P59',
    area: 'Shade product',
    item: 'Video carousel under the product',
    live: '/products/rear-side-windows-click-shades-for-toyota-rav4-2019-2025',
    liveHas: ['video-carousel'],
    draft: '/products/rear-side-windows-click-shades-for-toyota-rav4-2019-2025',
    draftHas: ['video-carousel'],
    expect: 'present',
    status: 'KEPT',
    note: '',
  },
  {
    id: 'P60',
    area: 'Shade product',
    item: 'Afterpay message',
    live: '/products/rear-side-windows-click-shades-for-toyota-rav4-2019-2025',
    liveHas: ['Afterpay'],
    draft: '/products/rear-side-windows-click-shades-for-toyota-rav4-2019-2025',
    draftHas: ['Afterpay'],
    expect: 'present',
    status: 'KEPT',
    note: '',
  },
  {
    id: 'P61',
    area: 'Shade product',
    item: 'Cart drawer',
    live: '/products/rear-side-windows-click-shades-for-toyota-rav4-2019-2025',
    liveHas: ['cart-drawer'],
    draft: '/products/rear-side-windows-click-shades-for-toyota-rav4-2019-2025',
    draftHas: ['cart-drawer'],
    expect: 'present',
    status: 'KEPT',
    note: '',
  },

  /* ------------------------------------------------- wiper product page -- */
  {
    id: 'P62',
    area: 'Wiper product',
    item: 'Add-ons and Add All to Cart',
    live: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    liveHas: ['add-complete-set'],
    draft: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    draftHas: ['add-complete-set', 'data-ezy-pdp'],
    expect: 'present',
    status: 'KEPT',
    note: 'ezy-product rebuilds it; the section now adds a spray and rear blade when the metafields exist',
  },
  {
    id: 'P63',
    area: 'Wiper product',
    item: 'Loox product reviews',
    live: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    liveHas: ['looxReviews'],
    draft: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    draftHas: ['looxReviews'],
    expect: 'present',
    status: 'KEPT',
    note: '',
  },
  {
    id: 'P64',
    area: 'Wiper product',
    item: 'Afterpay message',
    live: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    liveHas: ['Afterpay'],
    draft: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    draftHas: ['Afterpay'],
    expect: 'present',
    status: 'KEPT',
    note: '',
  },
  {
    id: 'P65',
    area: 'Wiper product',
    item: '12-month warranty promise',
    live: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    liveHas: ['12-month warranty'],
    draft: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    draftHas: ['12-month warranty'],
    expect: 'present',
    status: 'KEPT',
    note: 'kept in the ezy-product tick list',
  },
  {
    id: 'P66',
    area: 'Wiper product',
    item: 'Trust badges and "Secure checkout with" payment row',
    live: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    liveHas: ['Secure checkout'],
    draft: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    draftHas: ['Secure checkout', 'Aussie Quality', 'ezy-pdp__secure', 'ezy-pdp__trust'],
    expect: 'present',
    status: 'KEPT',
    note: 'Free Shipping, 30-Day Returns and Aussie Quality with the live wording, then Secure checkout with the store payment icons, under the add to cart button',
  },
  {
    id: 'P67',
    area: 'Wiper product',
    item: 'Customer photo gallery (cb-gallery)',
    live: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    liveHas: ['cb-gallery'],
    draft: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    draftHas: ['cb-gallery'],
    expect: 'absent',
    status: 'MISSING',
    note: 'the new page shows one product gallery, not the customer photo section',
  },
  {
    id: 'P68',
    area: 'Wiper product',
    item: 'Video carousel (3 videos)',
    live: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    liveHas: ['video-carousel'],
    draft: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    draftHas: ['video-carousel'],
    expect: 'absent',
    status: 'MISSING',
    note: 'ezy-product renders one fitting video instead',
  },
  {
    id: 'P69',
    area: 'Wiper product',
    item: 'Perfect Fit Guarantee section (cb-guarantee)',
    live: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    liveHas: ['cb-guarantee'],
    draft: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    draftHas: ['cb-guarantee'],
    expect: 'absent',
    status: 'MISSING',
    note: 'ezy-product keeps a one line 30-day return promise, the guarantee section is gone',
  },
  {
    id: 'P70',
    area: 'Wiper product',
    item: '"What You\'ll Notice" benefits (cb-benefits)',
    live: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    liveHas: ['cb-benefits'],
    draft: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    draftHas: ['cb-benefits'],
    expect: 'absent',
    status: 'MISSING',
    note: '',
  },
  {
    id: 'P71',
    area: 'Wiper product',
    item: 'Comparison table (cb-comparison)',
    live: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    liveHas: ['cb-comparison'],
    draft: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    draftHas: ['cb-comparison'],
    expect: 'absent',
    status: 'MISSING',
    note: '',
  },
  {
    id: 'P72',
    area: 'Wiper product',
    item: 'FAQ accordion (8 questions)',
    live: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    liveHas: ['faq-section'],
    draft: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    draftHas: ['ezy-faq'],
    expect: 'present',
    status: 'REPLACED-BY ezy-faq',
    note: '5 questions instead of 8',
  },
  {
    id: 'P73',
    area: 'Wiper product',
    item: '"Trusted by 5,000+ customers Australia-wide" social proof',
    live: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    liveHas: ['Trusted by 5,000'],
    draft: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    draftHas: ['Trusted by 5,000'],
    expect: 'absent',
    status: 'MISSING',
    note: 'the draft shows a store review count instead, from Loox metafields',
  },
  {
    id: 'P74',
    area: 'Wiper product',
    item: '"What\'s Included" list',
    live: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    liveHas: ["What's Included"],
    draft: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    draftHas: ["What's Included"],
    expect: 'absent',
    status: 'REPLACED-BY ezy-product "What you get"',
    note: '',
  },

  /* ------------------------------------------------------------- cart -- */
  {
    id: 'P75',
    area: 'Cart',
    item: 'Cart page upsell carousel and trust rating',
    live: '/cart',
    liveHas: ['upsell'],
    draft: '/cart',
    draftHas: ['upsell', 'cart-v7'],
    expect: 'present',
    status: 'KEPT',
    note: '',
  },
  {
    id: 'P76',
    area: 'Cart',
    item: 'Green success banner ("Great choice!")',
    live: '/cart',
    liveHas: ['cart-v7__banner'],
    draft: '/cart',
    draftHas: ['cart-v7__banner'],
    expect: 'absent',
    status: 'MISSING',
    note: 'the cart drawer still says "Added to your cart"',
  },
  {
    id: 'P77',
    area: 'Cart',
    item: 'Shipping and tax note',
    live: '/cart',
    liveHas: ['disclaimer'],
    draft: '/cart',
    draftHas: ['Free standard shipping'],
    expect: 'present',
    status: 'REPLACED-BY ezy-cart-note',
    note: 'now "Free standard shipping. Taxes shown at checkout."',
  },

  /* --------------------------------------------------- SEO and tracking -- */
  {
    id: 'P78',
    area: 'SEO',
    item: 'Product structured data (Product, Offer, Brand, AggregateRating)',
    live: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    liveHas: ['"@type": "Product"', '"@type": "AggregateRating"'],
    draft: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    draftHas: ['"@type": "Product"', '"@type": "AggregateRating"'],
    expect: 'present',
    status: 'KEPT',
    note: '',
  },
  {
    id: 'P79',
    area: 'SEO',
    item: 'FAQPage structured data',
    live: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    liveHas: ['"@type": "FAQPage"'],
    draft: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    draftHas: ['"@type": "FAQPage"'],
    expect: 'present',
    status: 'KEPT',
    note: '5 questions instead of 8, so fewer rich results',
  },
  {
    id: 'P80',
    area: 'SEO',
    item: 'Organization and ContactPoint structured data',
    live: '/',
    liveHas: ['"@type": "Organization"', '"@type": "ContactPoint"'],
    draft: '/',
    draftHas: ['"@type": "Organization"', '"@type": "ContactPoint"'],
    expect: 'present',
    status: 'KEPT',
    note: '',
  },
  {
    id: 'P81',
    area: 'SEO',
    item: 'Canonical, Open Graph, Twitter tags',
    live: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    liveHas: ['rel="canonical"', 'property="og:type"', 'name="twitter:card"'],
    draft: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    draftHas: ['rel="canonical"', 'property="og:type"', 'name="twitter:card"'],
    expect: 'present',
    status: 'KEPT',
    note: 'rewritten in snippets/ezy-seo.liquid instead of snippets/meta-tags.liquid',
  },
  {
    id: 'P82',
    area: 'Tracking',
    item: 'Google Ads, GA4 and Google tags (gtag, AW-)',
    live: '/',
    liveHas: ['AW-'],
    draft: '/',
    draftHas: ['AW-'],
    expect: 'present',
    status: 'KEPT',
    note: 'layout/theme.liquid is unchanged for scripts; the tag ids come from Shopify',
  },
  {
    id: 'P83',
    area: 'Tracking',
    item: 'Klaviyo onsite embed',
    live: '/',
    liveHas: ['klaviyo'],
    draft: '/',
    draftHas: ['klaviyo'],
    expect: 'present',
    status: 'KEPT',
    note: 'app embed block in config/settings_data.json, identical in both',
  },
  {
    id: 'P84',
    area: 'Tracking',
    item: 'Microsoft Clarity',
    live: '/',
    liveHas: ['clarity'],
    draft: '/',
    draftHas: ['clarity'],
    expect: 'present',
    status: 'KEPT',
    note: '',
  },
  {
    id: 'P85',
    area: 'Tracking',
    item: 'Shopify web pixels (trekkie, web-pixels)',
    live: '/',
    liveHas: ['web-pixels', 'trekkie'],
    draft: '/',
    draftHas: ['web-pixels', 'trekkie'],
    expect: 'present',
    status: 'KEPT',
    note: '',
  },
  {
    id: 'P86',
    area: 'App embed',
    item: 'Avada SEO suite embed',
    live: '/',
    liveHas: ['avada'],
    draft: '/',
    draftHas: ['avada'],
    expect: 'present',
    status: 'KEPT',
    note: 'app block in config/settings_data.json, identical in both',
  },
  {
    id: 'P87',
    area: 'App embed',
    item: 'Loox widget script',
    live: '/',
    liveHas: ['loox.io'],
    draft: '/',
    draftHas: ['loox.io'],
    expect: 'present',
    status: 'KEPT',
    note: '',
  },
  {
    id: 'P88',
    area: 'URL',
    item: 'robots.txt',
    live: '/robots.txt',
    liveHas: ['Sitemap'],
    draft: '/robots.txt',
    draftHas: ['Sitemap'],
    expect: 'present',
    status: 'KEPT',
    note: '',
  },
  {
    id: 'P89',
    area: 'URL',
    item: 'sitemap.xml',
    live: '/sitemap.xml',
    liveHas: ['sitemapindex'],
    draft: '/sitemap.xml',
    draftHas: ['sitemapindex'],
    expect: 'present',
    status: 'KEPT',
    note: 'Shopify generates it per store, theme independent',
  },
  {
    id: 'P90',
    area: 'Template',
    item: 'page.clickblades-v2 / v3 alternate templates',
    live: '/pages/click-blades',
    liveHas: ['cb-hero'],
    draft: '/pages/click-blades',
    draftHas: [],
    expect: 'none',
    status: 'NOT-NEEDED',
    note: 'only one Click Blades page exists and it uses the clickblades suffix (P28); both files exist in the repo',
  },
  {
    id: 'P91',
    area: 'Collection',
    item: '/collections (all collections list)',
    live: '/collections',
    liveHas: ['title:Collections', '/collections/car-window-shades'],
    draft: '/collections',
    draftHas: ['title:Collections', '/collections/car-window-shades'],
    expect: 'present',
    status: 'KEPT',
    note: 'list-collections template, same collection set from the store',
  },
  {
    id: 'P93',
    area: 'Wiper product',
    item: 'Sticky mobile add-to-cart bar',
    live: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    liveHas: ['sticky-atc'],
    draft: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    draftHas: ['data-ezy-sticky'],
    expect: 'present',
    status: 'REPLACED-BY ezy-product sticky bar',
    note: 'same job, new markup: ezy-pdp__sticky carries the live price and the add button',
  },
  {
    id: 'P94',
    area: 'Wiper product',
    item: 'Quantity stepper',
    live: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    liveHas: ['quantity-input'],
    draft: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    draftHas: ['data-ezy-qty'],
    expect: 'present',
    status: 'REPLACED-BY ezy-qty minus and plus stepper',
    note: '1 to 10, same range as live',
  },
  {
    id: 'P95',
    area: 'Wiper product',
    item: 'Pickup availability (21 Discovery Drive, Bibra Lake)',
    live: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    liveHas: ['pickup-availability'],
    draft: '/products/front-windscreen-wipers-for-toyota-rav4-2018',
    draftHas: ['data-ezy-pickup'],
    expect: 'present',
    status: 'REPLACED-BY ezy-pdp__pickup details block',
    note: 'same address and opening hours, collapsed instead of expanded',
  },
  {
    id: 'P96',
    area: 'Homepage',
    item: 'Make, Model, Year finder that finds car window shades',
    live: '/',
    liveHas: ['ymm-form', 'ymm-dropdown'],
    draft: '/',
    draftHas: ['data-ezy-finder-type', 'value="wipers" checked', 'Sun shades', 'SHADE_BRANDS'],
    expect: 'present',
    status: 'REPLACED-BY ezy-hero finder with a Wipers / Sun shades choice',
    note: 'Wipers is the default, so the blade flow is unchanged; Sun shades reads the same 20 brand collections as live and routes like live car-selector: one match opens the product, several go to /search?type=product&q=Brand+Model',
  },
  {
    id: 'P97',
    area: 'Collection',
    item: 'In Stock toggle on the wiper collections',
    live: '/collections/wiper-blades',
    liveHas: ['In Stock'],
    draft: '/collections/wiper-blades',
    draftHas: ['In Stock'],
    expect: 'present',
    status: 'KEPT',
    note: 'rebuild inside ezy-collection, same shopper control as P49 and P50',
  },
  {
    id: 'P98',
    area: 'Shade product',
    item: '"87% UV block" claim in the Why Choose Click Shades list',
    live: '/products/rear-side-windows-click-shades-for-toyota-rav4-2019-2025',
    liveHas: ['87%'],
    draft: '/products/rear-side-windows-click-shades-for-toyota-rav4-2019-2025',
    draftHas: ['87%'],
    expect: 'absent',
    status: 'REPLACED-BY "UV protection" with no number',
    note: 'the draft tells shoppers to see product details for the UV information; the live number and the 87% UV Block badge are gone from the shade page and from the benefits bar',
  },
];

/* ------------------------------------------------------------- URL sweep -- */

const URLS = [
  '/',
  '/collections/all',
  '/collections/car-window-shades',
  '/collections/windscreen-sun-shade',
  '/collections/wiper-blades',
  '/collections/find-your-car',
  '/collections/top-picks',
  '/collections/sun-shade-for-car-wiper-bladess-for-toyota',
  '/products/rear-side-windows-click-shades-for-toyota-rav4-2019-2025',
  '/products/rear-side-windows-click-shades-for-mazda-cx-5-2017-2025',
  '/products/front-windscreen-wipers-for-toyota-rav4-2018',
  '/products/front-windscreen-wipers-for-ford-ranger-2021',
  '/pages/click-blades',
  '/search?q=Toyota',
  '/search?q=Hilux',
  '/cart',
  '/pages/contact',
  '/pages/about-us',
  '/pages/become-a-stockist',
  '/pages/request-your-car',
  '/pages/return-policy',
  '/pages/happy-customers',
  '/pages/find-my-car',
  '/pages/order-cancellation-policy',
  '/pages/payment-policy',
  '/pages/legal-disclaimer',
  '/pages/accessibility-statement',
  '/pages/cookie-policy',
  '/pages/faqs',
  '/pages/shop-by-make',
  '/policies/privacy-policy',
  '/policies/refund-policy',
  '/policies/shipping-policy',
  '/policies/terms-of-service',
  '/blogs/news',
  '/blogs/news/how-do-you-install-car-window-shades',
  '/robots.txt',
  '/sitemap.xml',
];

/* ------------------------------------------------------------------- run -- */

const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);

function markerMiss(body, markers) {
  return markers.filter((m) => {
    // 'title:Foo' matches the text inside <title> after whitespace collapse. Page titles
    // are laid out over several lines, so a plain includes() cannot see them.
    if (m.startsWith('title:')) {
      const t = body.match(/<title>([\s\S]*?)<\/title>/i);
      if (!t) return true;
      return !t[1].replace(/\s+/g, ' ').trim().startsWith(m.slice(6));
    }
    return !body.includes(m);
  });
}

async function runRow(row) {
  const [livePage, draftPage] = await Promise.all([
    getPage(liveUrl(row.live), 'live'),
    getPage(draftUrl(row.draft), 'draft'),
  ]);
  const problems = [];
  // A row can expect a status other than 200: the 404 page, and the account pages that
  // Shopify answers with 406 to plain HTTP. Markers only mean something on a 200 body.
  const want = row.expectedStatus || 200;
  if (livePage.status !== want) problems.push(`live ${livePage.status} (want ${want}) ${livePage.error || ''}`.trim());
  else if (want === 200) {
    const miss = markerMiss(livePage.body, row.liveHas);
    if (miss.length) problems.push('live marker gone: ' + miss.join(', '));
  }
  if (row.expect === 'none') {
    // nothing to assert on the draft; the live marker proves the item exists
    if (draftPage.status !== want)
      problems.push(`draft ${draftPage.status} (want ${want}) ${draftPage.error || ''}`.trim());
  } else {
    if (draftPage.status !== want) problems.push(`draft ${draftPage.status} (want ${want}) ${draftPage.error || ''}`.trim());
    else {
      const miss = markerMiss(draftPage.body, row.draftHas);
      if (row.expect === 'present' && miss.length) problems.push('draft marker missing: ' + miss.join(', '));
      if (row.expect === 'absent' && miss.length !== row.draftHas.length) {
        problems.push('gap closed, draft now has: ' + row.draftHas.filter((m) => !miss.includes(m)).join(', '));
      }
    }
  }
  return { ...row, ok: problems.length === 0, problems, liveStatus: livePage.status, draftStatus: draftPage.status };
}

async function runUrl(path) {
  const [livePage, draftPage] = await Promise.all([
    getPage(liveUrl(path), 'live'),
    getPage(draftUrl(path), 'draft'),
  ]);
  const expected = path === '/this-page-does-not-exist-xyz' ? 404 : 200;
  const ok = livePage.status === expected && draftPage.status === expected;
  return { path, liveStatus: livePage.status, draftStatus: draftPage.status, expected, ok };
}

const selected = ROWS.filter((r) => !ONLY_ID || r.id === ONLY_ID);
if (ONLY_ID && !selected.length) {
  console.error(`no row with id ${ONLY_ID}`);
  process.exit(2);
}

const urlResults = ROWS_ONLY || MD ? [] : await mapLimit(URLS, CONCURRENCY, runUrl);
const rowResults = await mapLimit(selected, CONCURRENCY, runRow);

if (MD) {
  const cell = (s) => String(s).replace(/\|/g, '\\|');
  const marks = (ms) => ms.map((m) => '`' + m + '`').join(' + ');
  console.log('| ID | Area | Live item | Where on live | Status | Evidence in this check |');
  console.log('|---|---|---|---|---|---|');
  for (const r of rowResults) {
    const where = '`' + r.live + '`' + (r.liveHas.length ? ' ' + marks(r.liveHas) : '');
    const ev =
      r.expect === 'none'
        ? `live must answer ${r.expectedStatus || 200}`
        : `live has ${marks(r.liveHas)}; draft ${r.expect === 'absent' ? 'must not have' : 'has'} ${marks(r.draftHas)}`;
    console.log(
      `| ${r.id} | ${cell(r.area)} | ${cell(r.item)} | ${cell(where)} | ${cell(r.status)} | ${cell(ev)}${r.note ? '. ' + cell(r.note) : ''} |`
    );
  }
  process.exit(0);
}

const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
console.log('Live parity: live theme 149894070428 vs draft theme ' + DRAFT_THEME);
console.log('Live origin ' + LIVE_ORIGIN + ', draft via ' + DRAFT_ORIGIN + '?preview_theme_id=' + DRAFT_THEME);
console.log('Run at ' + stamp + (ONLY_ID ? ', row ' + ONLY_ID : ''));
console.log('');

const width = { id: 5, area: 15, status: 40, page: 46 };
console.log(
  pad('ID', width.id) +
    pad('AREA', width.area) +
    pad('STATUS', width.status) +
    pad('RESULT', 7) +
    'PAGE'
);
console.log('-'.repeat(width.id + width.area + width.status + 7 + width.page));
for (const r of rowResults) {
  console.log(
    pad(r.id, width.id) +
      pad(r.area, width.area) +
      pad(r.status, width.status) +
      pad(r.ok ? 'PASS' : 'FAIL', 7) +
      r.live
  );
  if (!r.ok) {
    for (const p of r.problems) console.log(' '.repeat(width.id) + '  ! ' + p);
  } else if (VERBOSE) {
    console.log(' '.repeat(width.id) + '  live ' + r.liveStatus + ', draft ' + r.draftStatus);
  }
}

if (urlResults.length) {
  console.log('');
  console.log('URL health: live and draft must answer the same status');
  console.log(pad('STATUS', 8) + pad('LIVE', 6) + pad('DRAFT', 7) + 'PATH');
  console.log('-'.repeat(8 + 6 + 7 + 60));
  for (const u of urlResults) {
    console.log(
      pad(u.ok ? 'PASS' : 'FAIL', 8) + padL(u.liveStatus, 5) + ' ' + padL(u.draftStatus, 5) + '  ' + u.path
    );
    if (!u.ok) console.log('        expected ' + u.expected + ' on both');
  }
}

const rowFail = rowResults.filter((r) => !r.ok).length;
const urlFail = urlResults.filter((u) => !u.ok).length;
const byStatus = rowResults.reduce((acc, r) => {
  const key = r.status.startsWith('REPLACED') ? 'REPLACED-BY' : r.status.startsWith('NOT-NEEDED') ? 'NOT-NEEDED' : r.status;
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});

console.log('');
console.log(
  `Rows: ${rowResults.length - rowFail} PASS, ${rowFail} FAIL` +
    (urlResults.length ? ` | URLs: ${urlResults.length - urlFail} PASS, ${urlFail} FAIL` : '')
);
console.log(
  'Map counts: ' +
    ['KEPT', 'REPLACED-BY', 'MISSING', 'NOT-NEEDED'].map((k) => `${k} ${byStatus[k] || 0}`).join(', ')
);
console.log(
  'FAIL on a MISSING row means the gap closed: update features/parity.md and this file. ' +
    'FAIL on a KEPT row means the draft lost it.'
);

process.exitCode = rowFail + urlFail > 0 ? 1 : 0;
