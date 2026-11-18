// CRO-audit fix gates for the EZYFIT draft theme (ticket project-12322/16). PASS or FAIL with evidence.
// Runs only on GitHub Actions via gates.yml (house rule: no browser or CI on the VPS).
// Usage: PLAYWRIGHT_PATH=... node .claude/skills/verify-ezyfit/scripts/gates-cro.mjs [themeId]
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
const OUT = path.join(ROOT, '_preview/evidence', 'cro-' + new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(OUT, { recursive: true });
const snap = async (p, name) => { try { await p.screenshot({ path: path.join(OUT, name + '.png') }); } catch (e) {} };
const gate = (id, name, pass, evidence) => { results.push({ id, name, pass, evidence }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${name}  | ${evidence}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch(process.env.PW_EXEC ? { executablePath: process.env.PW_EXEC } : {});
async function open(p0, w = 390, h = 844) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  await p.goto(pv(p0), { waitUntil: 'load', timeout: 90000 });
  await p.waitForTimeout(2500);
  return { p, ctx };
}
const seo = (p) => p.evaluate(() => {
  const m = (s) => (document.querySelector(s) || {}).content || '';
  return { title: document.title, site: m('meta[property="og:site_name"]'), ogt: m('meta[property="og:title"]'), twt: m('meta[name="twitter:title"]'), desc: m('meta[name="description"]'), ogd: m('meta[property="og:description"]') };
});

try {
  // 1. Titles and meta say Click Shades (MACL-34), not EZYFIT.
  for (const [id, url] of [['C1a', '/'], ['C1b', WIPER], ['C1c', '/collections/wiper-blades'], ['C1d', '/search?q=hilux&type=product'], ['C1e', '/cart']]) {
    const { p, ctx } = await open(url);
    const s = await seo(p);
    const all = Object.values(s).join(' | ');
    const ok = /Click Shades/.test(s.title) && s.site === 'Click Shades' && !/ezy\s?fit/i.test(all);
    gate(id, `title and meta are Click Shades: ${url}`, ok, JSON.stringify({ title: s.title, site: s.site, ogt: s.ogt }));
    if (url === '/') gate('C1f', 'home title is the wiper headline plus brand', s.title === 'Wiper blades made for your exact car | Click Shades', s.title);
    await ctx.close(); await sleep(1200);
  }

  // 2. Wiper page rating: never a product-level count the product does not have. Home hero says store reviews.
  let { p, ctx } = await open(WIPER);
  const rt = await p.evaluate(() => { const a = document.querySelector('.ezy-pdp__rating'); return a ? { kind: a.dataset.ezyRating, text: a.textContent.replace(/\s+/g, ' ').trim(), href: a.getAttribute('href') } : null; });
  const looxBe = await p.evaluate(() => document.body.innerText.includes('Be the first'));
  gate('C2a', 'wiper page: rating label never claims reviews the product lacks', !!rt && (rt.kind === 'store' ? /store reviews/.test(rt.text) && /#ezy-reviews/.test(rt.href) : /^\D*[\d.]+ from \d+ reviews?$/.test(rt.text.replace(/^\W+/, ''))), JSON.stringify({ rt, looxBe }));
  // 4. Sticky add bar visible on phone at page load (before any scroll).
  const st = await p.evaluate(() => {
    const s = document.querySelector('[data-ezy-sticky]');
    const add = document.querySelector('[data-ezy-add]');
    if (!s) return { found: false };
    const r = s.getBoundingClientRect();
    const a = add ? add.getBoundingClientRect() : null;
    return { found: true, hidden: s.hidden, display: getComputedStyle(s).display, scrollY: window.scrollY, top: Math.round(r.top), bottom: Math.round(r.bottom), vh: window.innerHeight, text: s.textContent.replace(/\s+/g, ' ').trim(), addInView: a ? a.top < window.innerHeight && a.bottom > 0 : null };
  });
  await snap(p, 'C4-phone-load');
  gate('C4a', 'phone: sticky add bar visible at load (or main Add button already in view)', st.found && ((!st.hidden && st.display !== 'none' && st.bottom <= st.vh + 1 && st.bottom > st.vh - 120 && /Add/.test(st.text)) || st.addInView === true), JSON.stringify(st));
  await ctx.close(); await sleep(1200);
  ({ p, ctx } = await open(WIPER, 1280, 900));
  const dsk = await p.evaluate(() => { const s = document.querySelector('[data-ezy-sticky]'); return s ? getComputedStyle(s).display : 'missing'; });
  gate('C4b', 'desktop: sticky bar stays off', dsk === 'none', dsk);
  await ctx.close(); await sleep(1200);

  ({ p, ctx } = await open('/'));
  const hr = await p.evaluate(() => { const a = document.querySelector('.ezy-hero__rating'); return a ? a.textContent.replace(/\s+/g, ' ').trim() : null; });
  gate('C2b', 'home hero rating says store reviews', !!hr && /store reviews/.test(hr), String(hr));

  // 3. Finder lists every wiper: served product list equals the collection.
  const fin = await p.evaluate(async () => {
    const served = JSON.parse(document.querySelector('[data-ezy-products]').textContent).map((x) => x.u.split('/products/').pop().split('?')[0]);
    const have = new Set(); let page = 1;
    for (;;) { const d = await (await fetch(`/collections/wiper-blades/products.json?limit=250&page=${page}`)).json(); if (!d.products.length) break; d.products.forEach((x) => have.add(x.handle)); page++; if (page > 5) break; }
    const missing = [...have].filter((h) => !served.includes(h));
    return { served: served.length, collection: have.size, missing };
  });
  gate('C3', 'finder product list holds every wiper in the collection', fin.served === fin.collection && fin.missing.length === 0 && fin.collection > 50, JSON.stringify(fin));
  // 7. Every 2pm on the home page carries AWST.
  const twopm = await p.evaluate(() => (document.body.innerText.match(/[^.\n]{0,40}2\s?pm[^.\n]{0,15}/gi) || []));
  gate('C7a', 'home: every 2pm cut-off says AWST', twopm.length > 0 && twopm.every((t) => /AWST/.test(t)), JSON.stringify(twopm));
  await ctx.close(); await sleep(1200);
  ({ p, ctx } = await open(WIPER));
  const twopm2 = await p.evaluate(() => (document.body.innerText.match(/[^.\n]{0,40}2\s?pm[^.\n]{0,15}/gi) || []));
  gate('C7b', 'wiper page: every 2pm cut-off says AWST', twopm2.length > 0 && twopm2.every((t) => /AWST/.test(t)), JSON.stringify(twopm2));
  await ctx.close(); await sleep(1200);

  // 5. Cart: one shipping message on the page and in the drawer.
  ({ p, ctx } = await open(WIPER, 1280, 900));
  await p.evaluate(async () => {
    const prod = await (await fetch(location.pathname + '.js')).json();
    await fetch('/cart/add.js', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ id: prod.variants[0].id, quantity: 1 }] }) });
  });
  await p.goto(pv('/cart'), { waitUntil: 'load', timeout: 90000 });
  await p.waitForTimeout(2500);
  const cartTxt = await p.evaluate(() => document.querySelector('.cart-v7__summary')?.innerText.replace(/\s+/g, ' ') || document.body.innerText.replace(/\s+/g, ' '));
  await snap(p, 'C5-cart');
  gate('C5a', 'cart page: free standard shipping, no "calculated at checkout"', /Free standard shipping/i.test(cartTxt) && !/calculated at checkout/i.test(cartTxt), cartTxt.slice(0, 200));
  await p.goto(pv('/'), { waitUntil: 'load', timeout: 90000 });
  const drawer = await p.evaluate(async () => { const h = await (await fetch('/?sections=cart-drawer')).text().catch(() => ''); const n = document.querySelector('.tax-note'); return { note: n ? n.textContent.replace(/\s+/g, ' ').trim() : null, ajaxHasOld: /calculated at checkout/i.test(h) }; });
  gate('C5b', 'cart drawer: same shipping message', !!drawer.note && /Free standard shipping/i.test(drawer.note) && !drawer.ajaxHasOld, JSON.stringify(drawer));
  await p.evaluate(async () => { await fetch('/cart/clear.js', { method: 'POST' }); });
  await ctx.close(); await sleep(1200);

  // 6. Search "hilux": products with the word in the title lead, wipers before shades.
  ({ p, ctx } = await open('/search?q=hilux&type=product', 1280, 900));
  const sr = await p.evaluate(() => [...document.querySelectorAll('.ezy-coll__item')].map((li) => ({ kind: li.querySelector('.ezy-coll__kind')?.textContent.trim(), name: li.querySelector('.ezy-coll__name')?.textContent.trim() })));
  const hits = sr.map((x) => /hilux/i.test(x.name));
  const firstMiss = hits.indexOf(false);
  const lead = firstMiss === -1 ? hits.length : firstMiss;
  const noLate = !hits.slice(lead).some(Boolean);
  const wiperFirst = sr[0] && sr[0].kind === 'Wiper blades';
  gate('C6', 'search hilux: Hilux titles first, wiper before shade', lead >= 2 && noLate && wiperFirst, JSON.stringify({ total: sr.length, leadingHilux: lead, top: sr.slice(0, 3) }));
  await ctx.close();
} catch (e) {
  console.log('ERROR', e.message);
  gate('CERR', 'gate script ran to the end', false, e.message);
}
await b.close();
const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} gates pass`);
fs.writeFileSync(path.join(OUT, 'gates-cro.json'), JSON.stringify({ theme: THEME, at: new Date().toISOString(), passed, total: results.length, results }, null, 2));
console.log(`evidence: ${OUT}`);
process.exitCode = passed === results.length ? 0 : 1;
