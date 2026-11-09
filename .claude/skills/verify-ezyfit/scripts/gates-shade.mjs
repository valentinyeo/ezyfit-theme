// Gates for tickets 17 (shade page parity) and 18 (parts homepage). Runs on GitHub only (gates.yml runs every gates*.mjs).
// Usage: PLAYWRIGHT_PATH=... node .claude/skills/verify-ezyfit/scripts/gates-shade.mjs [themeId]
// Gate ids: S0 theme, S1 to S3 headings live vs draft (3 shade products), S4 brand colours, S5 shade page loads ezy-shade.css and wiper page does not,
// S6 and S7 Add All to Cart (desktop, phone), S8 shade collection, P1 to P4 parts homepage, P5 current homepage keeps ezy-hero.
// Live side is read only: nothing is added to a live cart. INFO lines do not count as gates.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const THEME = process.argv[2] || '158148984988';
if (THEME === '149894070428') { console.error('Refusing the live theme.'); process.exit(2); }
const BASE = 'https://easy-fit-store1.myshopify.com';
const LIVE = 'https://clickshades.com.au';
const pv = (p) => `${BASE}${p}${p.includes('?') ? '&' : '?'}preview_theme_id=${THEME}`;
const SHADES = [
  { id: 'S1', label: 'side shade, Toyota RAV4', path: '/products/rear-side-windows-click-shades-for-toyota-rav4-2013-2019' },
  { id: 'S2', label: 'side shade, Prado older title style', path: '/products/car-side-windows-sun-shades-for-toyota-land-cruiser-prado-150-2009-2023' },
  { id: 'S3', label: 'side shade, Tesla Model Y', path: '/products/rear-side-windows-click-shades-for-tesla-model-y-2020' },
];
// The Add All button only shows when the product has add-ons. This RAV4 gets a matching wiper from the store recommendations (checked on live), the 2013-2019 RAV4 gets none.
const ADDALL = '/products/rear-side-windows-click-shades-for-toyota-rav4-2019-2025';
const ADDALL_ID = '8569631703196';
const WIPER = '/products/front-windscreen-wipers-for-toyota-hilux-2018';
const PARTS = '/pages/find-my-car?view=ezy-parts-home';
const results = [];
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..');
const OUT = path.join(ROOT, '_preview/evidence', 'shade-' + new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(OUT, { recursive: true });
const snap = async (p, name, full = false) => { try { await p.screenshot({ path: path.join(OUT, name + '.png'), fullPage: full }); } catch (e) {} };
const gate = (id, name, pass, evidence) => { results.push({ id, name, pass, evidence }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${name}  | ${evidence}`); };
const info = (id, name, evidence) => console.log(`INFO  ${id}  ${name}  | ${evidence}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.launch(process.env.PW_EXEC ? { executablePath: process.env.PW_EXEC } : {});
async function open(url, w = 1280, h = 900, pre = null) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  if (pre) await pre(ctx);
  const p = await ctx.newPage();
  const bad = [];
  p.on('response', (r) => { if (r.status() >= 400 && r.url().includes('easy-fit-store1')) bad.push(`${r.status()} ${r.url().replace(BASE, '').slice(0, 80)}`); });
  await p.goto(url, { waitUntil: 'load', timeout: 90000 });
  await p.waitForTimeout(3000);
  await p.evaluate(() => document.querySelectorAll('#preview-bar-iframe, #PBarNextFrameWrapper').forEach((e) => e.remove()));
  return { p, ctx, bad };
}
// The add-on set is filled by page script after the upsell cards render, so wait for it.
const setIds = async (p) => {
  try { await p.waitForFunction(() => { const e = document.querySelector('#add-complete-set'); return !!(e && e.dataset.variantIds); }, null, { timeout: 25000 }); } catch (e) {}
  return (await p.evaluate(() => { const e = document.querySelector('#add-complete-set'); return (e && e.dataset.variantIds) || ''; })) || '';
};
// Shade add-ons come only from the store's recommendations API, which answers 429 or empty to a busy GitHub runner IP.
// Same API answer for live and draft: read it once from live (slowly, with retries), and replay it when the page's own call came back empty.
let recStub = null;
async function recJson() {
  if (recStub) return recStub;
  for (let n = 0; n < 6; n++) {
    try {
      const r = await fetch(`${LIVE}/recommendations/products.json?product_id=${ADDALL_ID}&limit=3&intent=complementary`, { headers: { Accept: 'application/json' } });
      const t = await r.text();
      const j = JSON.parse(t);
      if (j.products && j.products.length) return (recStub = t);
    } catch (e) {}
    await sleep(20000);
  }
  return null;
}
const replayRecs = async (ctx) => { const body = await recJson(); if (body) await ctx.route('**/recommendations/products.json*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body })); return !!body; };
// Cart endpoints are answered here: the runner IP is throttled on /cart*, which says nothing about the theme.
// The gate asserts the request the theme sends (mock.adds) and the count it shows (built from that request).
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
  return mock;
}
// Headings inside main only, so the live ClickShades header and the EZYFIT header never enter the comparison.
const headings = (p) => p.evaluate(() => [...document.querySelectorAll('main h1, main h2, main h3')]
  .filter((h) => !h.closest('[class*="ezy-"]'))
  .map((h) => h.tagName + ' ' + h.textContent.replace(/\s+/g, ' ').trim())
  .filter((t) => t.length > 3 && !/[${}]/.test(t)));

try {
  // S0 and parity of headings, three shade products.
  for (const s of SHADES) {
    try {
    let live = await open(LIVE + s.path);
    const lh = await headings(live.p);
    if (s.id === 'S1') await snap(live.p, 'S1-live-shade-desktop');
    await live.ctx.close(); await sleep(1200);
    const dr = await open(pv(s.path));
    if (s.id === 'S1') {
      const themeId = await dr.p.evaluate(() => window.Shopify && Shopify.theme && Shopify.theme.id);
      gate('S0', 'draft theme is served', String(themeId) === THEME, `Shopify.theme.id=${themeId}`);
      await snap(dr.p, 'S1-draft-shade-desktop');
    }
    const dh = await headings(dr.p);
    const missing = lh.filter((x) => !dh.includes(x));
    const extra = dh.filter((x) => !lh.includes(x));
    gate(s.id, `${s.label}: same section headings live vs draft (header and footer masked)`, lh.length >= 8 && missing.length === 0 && extra.length === 0,
      `live ${lh.length}, draft ${dh.length}, missing in draft: ${missing.join(' / ') || 'none'}, extra in draft: ${extra.join(' / ') || 'none'}`);
    if (s.id === 'S1') {
      const css = await dr.p.evaluate(() => [...document.querySelectorAll('link[rel=stylesheet]')].some((l) => l.href.includes('ezy-shade.css')));
      const probe = await dr.p.evaluate(() => {
        const px = (sel, prop) => { const e = document.querySelector(sel); return e ? getComputedStyle(e)[prop] : 'missing'; };
        let leftover = 0;
        const sample = [];
        for (const e of document.querySelectorAll('main *')) {
          if (e.closest('iframe')) continue;
          const cs = getComputedStyle(e);
          for (const prop of ['color', 'backgroundColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor']) {
            if (cs[prop] === 'rgb(36, 99, 175)' && cs[prop.replace('Color', 'Style')] !== 'none') { leftover++; if (sample.length < 4) sample.push((e.className || e.tagName).toString().slice(0, 30) + ':' + prop); }
          }
        }
        return {
          setBtn: px('.addon-set-btn', 'backgroundColor'),
          atc: px('.add-to-cart-btn', 'backgroundColor'),
          atcText: px('.add-to-cart-btn', 'color'),
          title: px('.product-title', 'fontStyle') + '/' + px('.product-title', 'fontWeight') + '/' + px('.product-title', 'fontFamily').split(',')[0],
          body: px('.product-page-v2', 'fontFamily').split(',')[0],
          leftover, sample,
        };
      });
      gate('S5', 'shade page loads ezy-shade.css', css, `ezy-shade.css link ${css ? 'present' : 'missing'}`);
      gate('S4', 'shade page uses EZYFIT blue, yellow button, Poppins, 800 italic title, no ClickShades blue left',
        probe.setBtn === 'rgb(1, 53, 175)' && probe.atc === 'rgb(243, 225, 27)' && probe.atcText === 'rgb(1, 53, 175)' && /italic\/800\/"?Poppins/.test(probe.title) && /Poppins/.test(probe.body) && probe.leftover === 0,
        JSON.stringify(probe));
      await dr.p.evaluate(() => window.scrollTo(0, 0));
      await snap(dr.p, 'S4-draft-shade-top');
      await snap(dr.p, 'S4-draft-shade-full', true);
    }
    await dr.ctx.close(); await sleep(1200);
    } catch (e) { gate(s.id, 'step failed', false, String(e.message).split('\n')[0]); }
  }

  // The wiper page must not load the shade overrides.
  {
    try {
    const w = await open(pv(WIPER));
    const has = await w.p.evaluate(() => [...document.querySelectorAll('link[rel=stylesheet]')].some((l) => l.href.includes('ezy-shade.css')));
    gate('S5b', 'wiper page does not load ezy-shade.css', !has, `ezy-shade.css link ${has ? 'present' : 'absent'}`);
    await w.ctx.close(); await sleep(1200);
    } catch (e) { gate('S5b', 'step failed', false, String(e.message).split('\n')[0]); }
  }

  // Add All to Cart: main product plus every visible add-on lands in the cart.
  for (const [id, w, h, label] of [['S6', 1280, 900, 'desktop'], ['S7', 390, 844, 'phone']]) {
    try {
    // The store answers 429 to busy runner IPs on recommendations. Cart calls are answered by the test, so only that needs a cool-down.
    await sleep(20000);
    let live = await open(LIVE + ADDALL, w, h);
    let liveIds = await setIds(live.p);
    await live.ctx.close();
    if (!liveIds) { live = await open(LIVE + ADDALL, w, h, replayRecs); liveIds = await setIds(live.p); await live.ctx.close(); }
    const liveExpected = [...new Set(liveIds.split(',').map((x) => x.trim()).filter(Boolean))];
    let last = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      await sleep(attempt === 1 ? 5000 : 45000);
      let replay = false;
      const { p, ctx } = await open(pv(ADDALL), w, h, async (c) => { replay = await replayRecs(c); });
      const mock = await mockCart(ctx);
      const net = [];
      p.on('response', (r) => { if (/\/cart[/.]/.test(r.url()) || r.url().includes('/recommendations/')) net.push(`${r.request().method()} ${new URL(r.url()).pathname} ${r.status()}`); });
      const ids = await setIds(p);
      const expected = [...new Set(ids.split(',').map((x) => x.trim()).filter(Boolean))];
      const startPath = new URL(p.url()).pathname;
      const diag = await p.evaluate(() => { const e = document.querySelector('#add-complete-set'); if (!e) return 'button missing'; const r = e.getBoundingClientRect(); let hid = ''; for (let a = e; a; a = a.parentElement) { if (getComputedStyle(a).display === 'none') { hid = ` hidden by ${a.tagName.toLowerCase()}#${a.id}`; break; } } return `rect ${Math.round(r.width)}x${Math.round(r.height)}${hid || ', visible'}; ids ${(e.dataset.variantIds || '').split(',').filter(Boolean).length}`; });
      console.log(`INFO  ${id}  attempt ${attempt} add-all button  | ${diag}`);
      if (expected.length < 2) { last = { expected, net, note: `no add-on set (${diag}); network ${net.join(" | ")}` }; await ctx.close(); continue; }
      await p.evaluate(() => document.querySelector('#add-complete-set').scrollIntoView({ block: 'center' }));
      await p.waitForTimeout(800);
      await p.click('#add-complete-set', { timeout: 15000 });
      await p.waitForTimeout(1000);
      const count1 = await p.evaluate(() => [...document.querySelectorAll('[data-cart-count]')].map((e) => e.textContent.trim()).join('/'));
      await p.waitForTimeout(3000);
      const sent = mock.adds.map((x) => { try { return JSON.parse(x).items.map((i) => ({ id: String(i.id), q: i.quantity })); } catch (e) { return null; } });
      const sentIds = sent[0] ? sent[0].map((i) => i.id) : [];
      const drawer = await p.evaluate(() => { const d = document.querySelector('cart-drawer'); if (!d) return 'no cart-drawer'; const r = document.querySelector('#CartDrawer .drawer__inner')?.getBoundingClientRect(); return `class="${d.className}" panel ${r ? Math.round(r.width) + 'px wide, left ' + Math.round(r.left) : 'none'}`; });
      const count = await p.evaluate(() => (document.querySelector('[data-cart-count]')?.textContent || document.querySelector('#cart-icon-bubble .cart-count-bubble')?.textContent || '').replace(/\s+/g, ' ').trim());
      const stayed = new URL(p.url()).pathname === startPath;
      await snap(p, `${id}-after-add-all-${label}`);
      // The cart endpoints are answered by the test (mock.adds records the request body), so the runner throttle cannot hide a bug here.
      // Real carts are covered by gates.mjs G9 and gates-cro C5, which add to the store cart.
      const allIn = mock.adds.length === 1 && sentIds.length === expected.length && expected.every((x) => sentIds.includes(x)) && sent[0].every((i) => i.q === 1);
      gate(id, `Add All to Cart ${label}: one add.js call carries main plus every add-on, same set as live, page stays, count updates`,
        allIn && liveExpected.length === expected.length && stayed && String(count) === String(expected.length),
        `attempt ${attempt}${replay ? ' (recommendations replayed from live so a throttled runner cannot empty the set)' : ''}: button holds ${expected.length} variants (live ${liveExpected.length}), add.js calls ${mock.adds.length}, sent ${sentIds.length} ids [${sentIds.join(',')}], header count "${count}" (at 1s: "${count1}"), still on product page: ${stayed}; drawer: ${drawer}; network ${net.join(' | ')}`);
      if (expected.length < 4) info(id, 'fewer than 4 items in this set', `${expected.length} variants; this product has ${expected.length - 1} add-ons on live too`);
      await ctx.close();
      last = { done: true };
      break;
    }
    if (!last || !last.done) gate(id, `Add All to Cart ${label}`, false, `3 attempts failed: ${last ? last.note : 'none'}`);
    } catch (e) { gate(id, 'step failed', false, String(e.message).split('\n')[0]); }
  }

  // Shade collection (informational plus a render check).
  {
    try {
    const { p, ctx } = await open(pv('/collections/car-window-shades'));
    const c = await p.evaluate(() => {
      const cards = document.querySelectorAll('main a[href*="/products/"]').length;
      const blue = [...document.querySelectorAll('main *')].filter((e) => { const cs = getComputedStyle(e); return cs.color === 'rgb(36, 99, 175)' || cs.backgroundColor === 'rgb(36, 99, 175)'; }).length;
      return { cards, head: !!document.querySelector('.ezy-head'), blue };
    });
    await snap(p, 'S8-shade-collection');
    gate('S8', 'shade collection renders products under the EZYFIT header', c.cards > 0 && c.head, JSON.stringify(c));
    info('S8b', 'shade collection still shows ClickShades blue until ezy-shade.css is also loaded there', `${c.blue} elements use #2463af`);
    await ctx.close(); await sleep(1200);
    } catch (e) { gate('S8', 'step failed', false, String(e.message).split('\n')[0]); }
  }

  // Parts homepage, separate page, both viewports.
  for (const [id, w, h, label] of [['P1', 390, 844, 'phone'], ['P1d', 1280, 900, 'desktop']]) {
    try {
    const { p, ctx, bad } = await open(pv(PARTS), w, h);
    const d = await p.evaluate(() => ({
      h1: document.querySelector('main h1')?.textContent.trim(),
      hero: !!document.querySelector('main .ezy-hero [data-ezy-finder]'),
      links: [...document.querySelectorAll('.ezy-parts a.ezy-parts__tile')].map((a) => new URL(a.href).pathname),
      caps: [...document.querySelectorAll('.ezy-parts *')].filter((e) => getComputedStyle(e).textTransform === 'uppercase').length,
      title: document.title,
    }));
    await snap(p, `P1-parts-home-${label}`, true);
    gate(id, `parts homepage ${label}: heading, finder, tiles to wipers and sun shades, no all caps`,
      d.h1 === 'Parts made for your exact car' && d.hero && d.links.includes('/collections/wiper-blades') && d.links.includes('/collections/car-window-shades') && d.caps === 0,
      JSON.stringify(d));
    if (id === 'P1') {
      const codes = {};
      for (const l of d.links) codes[l] = (await p.request.get(BASE + l)).status();
      gate('P2', 'both category links resolve', Object.values(codes).length === 2 && Object.values(codes).every((c) => c === 200), JSON.stringify(codes));
      const objs = bad.filter((x) => x.includes('object'));
      gate('P3', 'parts homepage: no broken [object Object] requests', objs.length === 0, objs.join(', ') || 'none');
      await p.click('[data-ezy-dd=make] .ezy-dd__btn');
      const makes = await p.$$eval('[data-ezy-dd=make] .ezy-dd__list li', (l) => l.length);
      gate('P4', 'parts homepage finder lists makes', makes > 0, `${makes} makes`);
    }
    await ctx.close(); await sleep(1200);
    } catch (e) { gate(id, 'step failed', false, String(e.message).split('\n')[0]); }
  }

  // The current homepage is unchanged.
  {
    try {
    const { p, ctx } = await open(pv('/'));
    const d = await p.evaluate(() => ({ h1: document.querySelector('main h1')?.textContent.trim(), hero: !!document.querySelector('main .ezy-hero [data-ezy-finder]'), parts: !!document.querySelector('.ezy-parts') }));
    await snap(p, 'P5-current-homepage');
    gate('P5', 'current homepage still renders ezy-hero (not the parts heading) and has no parts tiles', d.hero && !!d.h1 && d.h1 !== 'Parts made for your exact car' && !d.parts, JSON.stringify(d));
    await ctx.close();
    } catch (e) { gate('P5', 'step failed', false, String(e.message).split('\n')[0]); }
  }
} catch (e) {
  console.log('ERROR', e.message);
  results.push({ id: 'ERR', name: 'script error', pass: false, evidence: e.message });
}
await b.close();
const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} gates pass`);
fs.writeFileSync(path.join(OUT, 'gates-shade.json'), JSON.stringify({ theme: THEME, at: new Date().toISOString(), passed, total: results.length, results }, null, 2));
console.log(`evidence: ${OUT}`);
process.exitCode = passed === results.length ? 0 : 1;
