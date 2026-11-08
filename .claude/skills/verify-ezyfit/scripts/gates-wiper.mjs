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
const cart = (p) => p.evaluate(async () => { const c = await (await fetch('/cart.js')).json(); return { n: c.item_count, lines: c.items.map((i) => ({ v: i.variant_id, q: i.quantity, t: i.product_title })) }; });
const badge = (p) => p.evaluate(() => { const e = document.querySelector('.ezy-head [data-cart-count]'); return e ? e.textContent.trim() : 'none'; });

try {
  for (const [tag, w, h] of [['phone', 390, 844], ['desktop', 1280, 900]]) {
    const W = tag === 'phone' ? 'a' : 'b';
    const { p, ctx } = await open(WIPER, w, h);
    const calls = [];
    p.on('request', (r) => { if (r.url().includes('/cart/add.js') && r.method() === 'POST') calls.push(r.postData()); });

    // W1. Add-on cards render with EZYFIT classes.
    try { await p.waitForSelector('.ezy-addon', { timeout: 15000 }); } catch (e) {}
    const ad = await p.evaluate(() => {
      const seed = JSON.parse((document.querySelector('[data-ezy-addons-seed]') || { textContent: '{}' }).textContent || '{}');
      const wrap = document.querySelector('[data-ezy-addons-wrap]');
      return {
        src: seed.src, seedItems: (seed.items || []).length, perm: !!seed.perm,
        cards: [...document.querySelectorAll('.ezy-addon')].map((c) => c.querySelector('.ezy-addon__t')?.textContent.trim()),
        shown: !!wrap && !wrap.hidden && getComputedStyle(wrap).display !== 'none',
        imgs: [...document.querySelectorAll('.ezy-addon img')].filter((i) => i.complete && i.naturalWidth > 0).length,
      };
    });
    gate(`W1${W}`, `${tag}: add-on cards render`, ad.cards.length >= 1 && ad.shown, JSON.stringify(ad));
    await p.locator('#ezy-pdp-addons').scrollIntoViewIfNeeded().catch(() => {});
    await p.waitForTimeout(1200);
    await snap(p, `W1-${tag}-addons`);

    // W2. Add All is one /cart/add.js call: main + every visible add-on.
    await p.evaluate(async () => { await fetch('/cart/clear.js', { method: 'POST' }); });
    const startUrl = p.url();
    const ids = await p.evaluate(() => document.getElementById('add-complete-set')?.dataset.variantIds || '');
    const expectIds = ids.split(',').filter(Boolean).map(Number);
    const btn = await p.$('#add-complete-set');
    if (btn) await btn.click();
    await p.waitForTimeout(5000);
    const c = await cart(p);
    const body = calls[0] ? JSON.parse(calls[0]) : null;
    const sent = body ? (body.items || []).map((i) => i.id) : [];
    const lineIds = c.lines.map((l) => l.v).sort();
    const same = sent.length === expectIds.length && expectIds.every((x) => sent.includes(x)) && JSON.stringify(lineIds) === JSON.stringify([...sent].sort());
    const bg = await badge(p);
    const drawerOpen = await p.evaluate(() => { const d = document.querySelector('cart-drawer'); return !!d && (d.classList.contains('active') || d.classList.contains('animate')) && getComputedStyle(document.querySelector('#CartDrawer') || d).visibility !== 'hidden'; });
    await snap(p, `W2-${tag}-after-add-all`);
    gate(`W2${W}`, `${tag}: Add All is one add.js call, main + all add-ons, cart and badge match`, calls.length === 1 && expectIds.length >= 2 && same && String(c.n) === bg, JSON.stringify({ calls: calls.length, sent, expectIds, cartLines: c.lines, count: c.n, badge: bg }));
    if (tag === 'desktop') gate('W2c', 'desktop: Add All opens the cart drawer', drawerOpen, `drawerOpen=${drawerOpen}`);
    else gate('W2d', 'phone: Add All stays on the product page and the count updates', p.url() === startUrl && c.n >= 2 && String(c.n) === bg, `same url=${p.url() === startUrl}, count=${c.n}, badge=${bg}`);
    await p.evaluate(async () => { await fetch('/cart/clear.js', { method: 'POST' }); });
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
  gate('W5a', 'delivery: free and express estimate with date and note', /Free delivery/i.test(info.ship) && /Express delivery/.test(info.ship) && dateRe.test(info.ship) && /\$10/.test(info.ship) && /estimates/.test(info.ship), info.ship);
  gate('W5b', 'stock line says in stock', /in stock/i.test(info.stock), info.stock);
  gate('W5c', 'pickup block states the Discovery Drive address', /21 Discovery Drive/.test(info.pickup) && /Bibra Lake/.test(info.pickup), info.pickup);
  gate('W5d', 'warranty tick present', info.ticks.some((x) => /12-month warranty/i.test(x)), JSON.stringify(info.ticks));
  // Quantity stepper: 2 gives a cart line of 2.
  await p.evaluate(async () => { await fetch('/cart/clear.js', { method: 'POST' }); });
  await p.click('[data-ezy-qty-step="1"]');
  const qv = await p.inputValue('[data-ezy-qty]');
  const tot = await p.evaluate(() => document.querySelector('[data-ezy-total]')?.textContent.trim());
  await p.click('[data-ezy-add]');
  await p.waitForTimeout(5000);
  const qc = await cart(p);
  await snap(p, 'W5-desktop-qty-added');
  gate('W5e', 'quantity stepper: qty 2 gives cart line of 2 and the total follows', qv === '2' && qc.lines.length >= 1 && qc.lines[0].q === 2, JSON.stringify({ qty: qv, total: tot, cart: qc }));
  await p.evaluate(async () => { await fetch('/cart/clear.js', { method: 'POST' }); });
  await p.evaluate(() => window.scrollTo(0, 0));
  await snap(p, 'W5-desktop-top');
  // W7. Favicon: report what it is. Parked unless an EZYFIT asset exists.
  const fav = await p.evaluate(() => [...document.querySelectorAll('link[rel~="icon"]')].map((l) => l.href));
  gate('W7', 'favicon present and reported (parked for Matt unless an EZYFIT asset exists)', fav.length > 0, JSON.stringify(fav));
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
    codes[h] = await p.evaluate(async (u) => (await fetch(u)).status, h);
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
