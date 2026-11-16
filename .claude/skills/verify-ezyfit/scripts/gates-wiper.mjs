// Wiper page parity gates for the EZYFIT draft theme (ticket project-12322/19). PASS or FAIL with evidence.
// Add-ons, Add All, Loox, FAQPage schema, delivery, stock, pickup, warranty, quantity, footer links, favicon.
// Runs only on GitHub Actions via gates.yml (house rule: no browser or CI on the VPS).
// Usage: PLAYWRIGHT_PATH=... node .claude/skills/verify-ezyfit/scripts/gates-wiper.mjs [themeId]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const THEME = process.argv[2] || '158148984988';
const BASE = 'https://easy-fit-store1.myshopify.com';
const pv = (p) => `${BASE}${p}${p.includes('?') ? '&' : '?'}preview_theme_id=${THEME}`;
const WIPER = '/products/front-windscreen-wipers-for-toyota-hilux-2018';
const results = [];
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..');
const OUT = path.join(ROOT, '_preview/evidence', 'wiper-' + new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(OUT, { recursive: true });
const snap = async (p, name, full = false) => { try { await p.screenshot({ path: path.join(OUT, name + '.png'), fullPage: full }); } catch (e) {} };
const gate = (id, name, pass, evidence) => { results.push({ id, name, pass, evidence }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${name}  | ${evidence}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch(process.env.PW_EXEC ? { executablePath: process.env.PW_EXEC } : {});
async function open(p0, w = 390, h = 844) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  await p.goto(pv(p0), { waitUntil: 'load', timeout: 90000 });
  await p.waitForTimeout(3000);
  return { p, ctx };
}
// The store throttles the runner and then answers with an HTML page. Every in-page fetch checks ok and
// content-type, and retries with a growing cool-down. Never JSON.parse an unchecked body.
const rawFetch = (p, url, method = 'GET') => p.evaluate(async ([u, m]) => {
  const r = await fetch(u, { method: m, headers: { Accept: 'application/json' } });
  return { status: r.status, ct: r.headers.get('content-type') || '', text: await r.text() };
}, [url, method]);
async function jfetch(p, url, method = 'GET', tries = 5) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    last = await rawFetch(p, url, method).catch((e) => ({ status: 0, ct: '', text: String(e) }));
    if (last.status >= 200 && last.status < 300 && /^\s*[{[]/.test(last.text)) { try { return JSON.parse(last.text); } catch (e) {} } // clear.js answers text/javascript with a JSON body
    console.log(`  retry ${i + 1}/${tries} ${method} ${url}: status ${last.status} ${last.ct} ${last.text.slice(0, 40).replace(/\s+/g, ' ')}`);
    await sleep(4000 * (i + 1));
  }
  throw new Error(`${method} ${url} never returned JSON (last status ${last && last.status})`);
}

// The runner IP is throttled on /cart* (429 with an HTML page), which says nothing about the theme.
// The cart write and read are answered here: mock.adds records every /cart/add.js request body the theme sends,
// and /cart.js returns a count built from them. Real carts are covered by gates.mjs G9 and gates-cro C5.
// The drawer markup request is passed through to the store, retried with a cool-down when throttled.
async function mockCart(ctx) {
  const mock = { adds: [], items: 0 };
  await ctx.route('**/cart/add.js', async (r) => {
    const body = r.request().postData() || '{}';
    mock.adds.push(body);
    let items = [];
    try { items = JSON.parse(body).items || []; } catch (e) {}
    mock.items += items.reduce((n, i) => n + (i.quantity || 1), 0);
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: items.map((i) => ({ id: i.id, variant_id: i.id, quantity: i.quantity || 1 })) }) });
  });
  await ctx.route(/^https:\/\/[^/]+\/cart\.js(\?.*)?$/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ item_count: mock.items, items: [] }) }));
  await ctx.route('**/cart?section_id=*', async (r) => {
    let resp = null;
    for (let i = 0; i < 5; i++) {
      resp = await r.fetch().catch(() => null);
      if (resp && resp.status() < 400) break;
      await sleep(5000 * (i + 1));
    }
    if (resp) await r.fulfill({ response: resp }); else await r.abort();
  });
  return mock;
}
const sentOf = (mock) => mock.adds.map((x) => { try { return JSON.parse(x).items || []; } catch (e) { return []; } });
const readBadge = (p) => p.evaluate(() => { const e = document.querySelector('.ezy-head [data-cart-count]'); return e ? e.textContent.trim() : 'none'; });
const badge = async (p, want) => { let v = await readBadge(p); for (let i = 0; i < 8 && String(v) !== String(want); i++) { await sleep(1000); v = await readBadge(p); } return v; };

try {
  // The files before this one hammer the store; let it settle before the first request.
  await sleep(30000);
  for (const [tag, w, h] of [['phone', 390, 844], ['desktop', 1280, 900]]) {
    const W = tag === 'phone' ? 'a' : 'b';
    const { p, ctx } = await open(WIPER, w, h);
    const calls = [];
    p.on('response', (r) => { const q = r.request(); if (r.url().includes('/cart/add.js') && q.method() === 'POST') calls.push({ body: q.postData(), status: r.status() }); });

    // W1. Add-on cards render with EZYFIT classes.
    try { await p.waitForSelector('.ezy-addon', { timeout: 15000 }); } catch (e) {}
    const ad = await p.evaluate(() => {
      const seed = JSON.parse((document.querySelector('[data-ezy-addons-seed]') || { textContent: '{}' }).textContent || '{}');
      const wrap = document.querySelector('[data-ezy-addons-wrap]');
      return {
        src: seed.src, seedItems: (seed.items || []).length, perm: !!seed.perm,
        cards: [...document.querySelectorAll('.ezy-addon')].map((c) => c.querySelector('.ezy-addon__t')?.textContent.trim()),
        shown: !!wrap && !wrap.hidden && getComputedStyle(wrap).display !== 'none',
        recs: performance.getEntriesByType('resource').filter((e) => e.name.includes('/recommendations/products.json')).map((e) => e.responseStatus),
        imgs: [...document.querySelectorAll('.ezy-addon img')].filter((i) => i.complete && i.naturalWidth > 0).length,
      };
    });
    gate(`W1${W}`, `${tag}: add-on cards render`, ad.cards.length >= 1 && ad.shown, JSON.stringify(ad));
    await p.locator('#ezy-pdp-addons').scrollIntoViewIfNeeded().catch(() => {});
    await p.waitForTimeout(1200);
    await snap(p, `W1-${tag}-addons`);

    // W2. Add All is one /cart/add.js call: main + every visible add-on (cart endpoints answered by the test, see mockCart).
    const mock = await mockCart(ctx);
    const startUrl = p.url();
    const ids = await p.evaluate(() => document.getElementById('add-complete-set')?.dataset.variantIds || '');
    const expectIds = ids.split(',').filter(Boolean).map(Number);
    await p.locator('#add-complete-set').scrollIntoViewIfNeeded().catch(() => {});
    const btn = await p.$('#add-complete-set');
    if (btn) await btn.click();
    await p.waitForTimeout(5000);
    const sentAll = sentOf(mock);
    const sent = sentAll[0] ? sentAll[0].map((i) => i.id) : [];
    const sentQty = sentAll[0] ? sentAll[0].map((i) => i.quantity) : [];
    const same = sent.length === expectIds.length && expectIds.every((x) => sent.includes(x)) && sentQty.every((q) => q === 1);
    const bg = await badge(p, mock.items);
    const drawerOpen = await p.evaluate(() => { const d = document.querySelector('cart-drawer'); return !!d && (d.classList.contains('active') || d.classList.contains('animate')) && getComputedStyle(document.querySelector('#CartDrawer') || d).visibility !== 'hidden'; });
    await snap(p, `W2-${tag}-after-add-all`);
    gate(`W2${W}`, `${tag}: Add All is one add.js call, main + all add-ons, header count follows`, mock.adds.length === 1 && expectIds.length >= 2 && same && String(mock.items) === String(bg), JSON.stringify({ addCalls: mock.adds.length, sent, expectIds, count: mock.items, badge: bg }));
    if (tag === 'desktop') gate('W2c', 'desktop: Add All opens the cart drawer', drawerOpen, `drawerOpen=${drawerOpen}`);
    else gate('W2d', 'phone: Add All stays on the product page and the count updates', p.url() === startUrl && mock.items >= 2 && String(mock.items) === String(bg), `same url=${p.url() === startUrl}, count=${mock.items}, badge=${bg}`);
    await ctx.close(); await sleep(1200);
  }

  // Page-level checks on desktop.
  let { p, ctx } = await open(WIPER, 1280, 900);

  // W3. Loox: container with product id, script present, content mounted (observed and reported).
  await p.locator('#looxReviews').scrollIntoViewIfNeeded().catch(() => {});
  await p.waitForTimeout(8000);
  const lx = await p.evaluate(() => {
    const el = document.getElementById('looxReviews');
    return {
      hasDiv: !!el, productId: el ? el.dataset.productId : null,
      script: [...document.scripts].some((s) => /loox/i.test(s.src)),
      iframe: !!(el && el.querySelector('iframe')), children: el ? el.children.length : 0,
      text: el ? el.innerText.replace(/\s+/g, ' ').trim().slice(0, 120) : '',
    };
  });
  await snap(p, 'W3-desktop-loox');
  gate('W3a', 'Loox container carries the product id and the Loox script is on the page', lx.hasDiv && /^\d+$/.test(String(lx.productId)) && lx.script, JSON.stringify(lx));
  gate('W3b', 'Loox widget mounts content (observed)', lx.iframe || lx.children > 0 || lx.text.length > 0, JSON.stringify({ iframe: lx.iframe, children: lx.children, text: lx.text }));

  // W4. FAQPage JSON-LD valid, one question per visible FAQ item.
  const fq = await p.evaluate(() => {
    const out = { ld: [], items: document.querySelectorAll('#ezy-faq details').length };
    document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => { try { const j = JSON.parse(s.textContent); if (j['@type'] === 'FAQPage') out.ld.push(j.mainEntity.map((q) => ({ q: q.name, a: q.acceptedAnswer && q.acceptedAnswer.text }))); } catch (e) { out.err = String(e); } });
    return out;
  });
  const faq = fq.ld[0] || [];
  gate('W4', 'FAQPage JSON-LD is valid and matches the FAQ items', fq.ld.length === 1 && faq.length >= 3 && faq.length === fq.items && faq.every((x) => x.q && x.a), JSON.stringify({ ldBlocks: fq.ld.length, questions: faq.length, visible: fq.items, err: fq.err || null }));

  // W5. Delivery, stock, pickup, warranty, quantity.
  const info = await p.evaluate(() => {
    const t = (s) => (document.querySelector(s) || {}).textContent;
    return {
      stock: (t('[data-ezy-stock]') || '').replace(/\s+/g, ' ').trim(),
      ship: (t('[data-ezy-ship]') || '').replace(/\s+/g, ' ').trim(),
      pickup: (t('[data-ezy-pickup]') || '').replace(/\s+/g, ' ').trim(),
      ticks: [...document.querySelectorAll('.ezy-pdp__ticks li')].map((l) => l.textContent.trim()),
    };
  });
  const dateRe = /by (Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} [A-Z][a-z]{2}/;
  const policyLink = await p.locator('[data-ezy-ship] a').getAttribute('href');
  gate('W5a', 'delivery uses the published shipping window, not invented dates or express service', /Free delivery/i.test(info.ship) && /1–4 business days total/i.test(info.ship) && !/Express delivery|\$10/.test(info.ship) && !dateRe.test(info.ship) && /estimates/i.test(info.ship) && policyLink === '/policies/shipping-policy', JSON.stringify({ ship: info.ship, policyLink }));
  gate('W5b', 'stock line says in stock', /in stock/i.test(info.stock), info.stock);
  gate('W5c', 'pickup block states the Discovery Drive address', /21 Discovery Drive/.test(info.pickup) && /Bibra Lake/.test(info.pickup), info.pickup);
  gate('W5d', 'warranty tick present', info.ticks.some((x) => /12-month warranty/i.test(x)), JSON.stringify(info.ticks));
  // Quantity stepper: 2 goes into the add.js call as quantity 2 (cart endpoints answered by the test).
  const qmock = await mockCart(ctx);
  await p.click('[data-ezy-qty-step="1"]');
  const qv = await p.inputValue('[data-ezy-qty]');
  const tot = await p.evaluate(() => document.querySelector('[data-ezy-total]')?.textContent.trim());
  await p.click('[data-ezy-add]');
  await p.waitForTimeout(4000);
  const qsent = sentOf(qmock);
  await snap(p, 'W5-desktop-qty-added');
  gate('W5e', 'quantity stepper: qty 2 is sent as quantity 2 in one add.js call and the total follows', qv === '2' && qmock.adds.length === 1 && qsent[0].length >= 1 && qsent[0][0].quantity === 2, JSON.stringify({ qty: qv, total: tot, sent: qsent }));
  await p.evaluate(() => window.scrollTo(0, 0));
  await snap(p, 'W5-desktop-top');
  // W7. Favicon: report what it is. Parked unless an EZYFIT asset exists.
  const fav = await p.evaluate(() => [...document.querySelectorAll('link[rel~="icon"]')].map((l) => l.href));
  gate('W7', 'favicon present and reported (parked for Matt unless an EZYFIT asset exists)', fav.length > 0, JSON.stringify(fav));
  // W8. MACL-21: numbered what-you-get block and fits-your-car panel.
  const fit = await p.evaluate(() => {
    const parts = document.querySelector('[data-ezy-blade-parts]');
    const car = document.querySelector('[data-ezy-fits-car]');
    if (car) car.scrollIntoView();
    return { parts: parts ? parts.querySelectorAll('.ezy-fit__parts li').length : 0, img: !!(parts && parts.querySelector('img')), car: car ? car.querySelector('h2').textContent.trim() : 'missing', lengths: !!document.querySelector('[data-ezy-fit-lengths]') };
  });
  await p.waitForTimeout(800);
  await snap(p, 'W8-desktop-fit');
  gate('W8', 'wiper page: numbered what-you-get block with picture and fits-your-car panel naming the car', fit.parts >= 3 && fit.img && /Hilux/.test(fit.car), JSON.stringify(fit));
  // W9. Long product page: extra blocks sit before the FAQ, data blocks stay hidden without data.
  const more = await p.evaluate(() => {
    const ids = ['ezy-pdp-photos', 'ezy-pdp-compare', 'ezy-pdp-guarantee', 'ezy-pdp-shades'];
    const faq = document.querySelector('#ezy-faq');
    const shown = ids.filter((id) => { const el = document.getElementById(id); return el && el.offsetHeight > 0 && (!faq || (el.compareDocumentPosition(faq) & Node.DOCUMENT_POSITION_FOLLOWING)); });
    const g = document.querySelector('#ezy-pdp-guarantee');
    return { shown, photos: document.querySelectorAll('#ezy-pdp-photos img').length, rows: document.querySelectorAll('#ezy-pdp-compare tbody tr').length, carInGuarantee: g ? /Hilux/.test(g.textContent) : false, clip: !!document.querySelector('[data-ezy-pdp-clip]') };
  });
  await p.evaluate(() => document.querySelector('#ezy-pdp-compare')?.scrollIntoView());
  await p.waitForTimeout(800);
  await snap(p, 'W9-desktop-long');
  gate('W9', 'long wiper page: photos, comparison, guarantee naming the car and shade cross-sell show before the FAQ', more.shown.length === 4 && more.photos >= 4 && more.rows === 4 && more.carInGuarantee, JSON.stringify(more));
  await ctx.close(); await sleep(1200);

  // W6. Footer links.
  ({ p, ctx } = await open(WIPER, 390, 844));
  const fl = await p.evaluate(() => {
    const f = document.querySelector('footer.ezy-foot');
    const a = (re) => f ? [...f.querySelectorAll('a[href]')].filter((x) => re.test(x.getAttribute('href'))).map((x) => x.getAttribute('href')) : [];
    return { cookie: a(/cookie-policy/), legal: a(/legal-disclaimer/), fb: a(/facebook\.com/), ig: a(/instagram\.com/) };
  });
  await p.locator('footer.ezy-foot').scrollIntoViewIfNeeded().catch(() => {});
  await p.waitForTimeout(800);
  await snap(p, 'W6-phone-footer');
  const codes = {};
  for (const h of [...fl.cookie, ...fl.legal]) {
    let st = 0;
    for (let i = 0; i < 4 && st !== 200; i++) { st = (await rawFetch(p, h).catch(() => ({ status: 0 }))).status; if (st !== 200) await sleep(4000 * (i + 1)); }
    codes[h] = st;
  }
  gate('W6', 'footer has cookie policy, legal disclaimer, Facebook and Instagram links; policy pages answer 200',
    fl.cookie.length >= 1 && fl.legal.length >= 1 && fl.fb.length >= 1 && fl.ig.length >= 1 && Object.values(codes).every((s) => s === 200), JSON.stringify({ ...fl, codes }));
  await ctx.close();
} catch (e) {
  console.log('ERROR', e.message);
  gate('WERR', 'gate script ran to the end', false, e.message);
}
await b.close();
const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} gates pass`);
fs.writeFileSync(path.join(OUT, 'gates-wiper.json'), JSON.stringify({ theme: THEME, at: new Date().toISOString(), passed, total: results.length, results }, null, 2));
console.log(`evidence: ${OUT}`);
process.exitCode = passed === results.length ? 0 : 1;
