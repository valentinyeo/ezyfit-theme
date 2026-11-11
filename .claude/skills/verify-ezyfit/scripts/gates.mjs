// Deep-work gates for the EZYFIT draft theme. Each gate prints PASS or FAIL with evidence.
// Usage: PLAYWRIGHT_PATH=$HOME/.npm-global/lib/node_modules/playwright node .claude/skills/verify-ezyfit/scripts/gates.mjs [themeId]
// Evidence: _preview/evidence/<timestamp>/ (gates.json plus screenshots). _preview/ is git- and shopify-ignored.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const THEME = process.argv[2] || '158148984988';
const BASE = 'https://easy-fit-store1.myshopify.com';
const pv = (path) => `${BASE}${path}${path.includes('?') ? '&' : '?'}preview_theme_id=${THEME}`;
const WIPER = '/products/front-windscreen-wipers-for-toyota-hilux-2018';
const results = [];
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..');
const OUT = path.join(ROOT, '_preview/evidence', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(OUT, { recursive: true });
const snap = async (p, name) => { try { await p.screenshot({ path: path.join(OUT, name + '.png') }); } catch (e) {} };
const gate = (id, name, pass, evidence) => { results.push({ id, name, pass, evidence }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${name}  | ${evidence}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.launch(process.env.PW_EXEC ? { executablePath: process.env.PW_EXEC } : {});
async function open(path, w = 390, h = 844) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  const bad = [];
  p.on('requestfailed', () => {});
  p.on('response', (r) => { if (r.status() >= 400 && r.url().includes('easy-fit-store1') ) bad.push(`${r.status()} ${r.url().replace(BASE, '').slice(0, 80)}`); });
  await p.goto(pv(path), { waitUntil: 'load', timeout: 90000 });
  await p.waitForTimeout(2500);
  return { p, ctx, bad };
}

try {
  // Product page gates (wiper).
  let { p, ctx, bad } = await open(WIPER);
  const themeId = await p.evaluate(() => window.Shopify && Shopify.theme && Shopify.theme.id);
  gate('G0', 'draft theme is served', String(themeId) === THEME, `Shopify.theme.id=${themeId}`);
  gate('G1', 'wiper page: Standard/Spray choice', !!(await p.$('[data-ezy-type]')), `selector [data-ezy-type] ${(await p.$('[data-ezy-type]')) ? 'found' : 'missing'}`);
  gate('G2', 'wiper page: front / front+rear choice', !!(await p.$('[data-ezy-position]')), `[data-ezy-position] ${(await p.$('[data-ezy-position]')) ? 'found' : 'missing'}`);
  gate('G3', 'wiper page: year dropdown', !!(await p.$('[data-ezy-year]')), `[data-ezy-year] ${(await p.$('[data-ezy-year]')) ? 'found' : 'missing'}`);
  gate('G4', 'wiper page: fitment video slot', !!(await p.$('[data-ezy-fit-video]')), `[data-ezy-fit-video] ${(await p.$('[data-ezy-fit-video]')) ? 'found' : 'missing'}`);
  await p.waitForTimeout(3000);
  const objObj = bad.filter((x) => x.includes('object'));
  gate('G5', 'wiper page: no broken [object Object] requests', objObj.length === 0, objObj.join(', ') || 'none');
  const ezyLook = await p.evaluate(() => !!document.querySelector('main .ezy'));
  gate('G6', 'wiper page uses EZYFIT design', ezyLook, `main .ezy ${ezyLook ? 'present' : 'absent'}`);
  // Mobile menu.
  const menu = await p.$('.ezy-head__menu');
  if (menu) { await menu.click(); await p.waitForTimeout(600); }
  const navLinks = await p.evaluate(() => { const n = document.querySelector('[data-ezy-drawer]'); if (!n || n.hidden || getComputedStyle(n).display === 'none') return 0; return [...n.querySelectorAll('a[href]')].filter((a) => a.getBoundingClientRect().height > 0).length; });
  await snap(p, 'G7-phone-menu');
  gate('G7', 'phone menu opens with links', navLinks >= 3, `visible drawer links after tap: ${navLinks}`);
  const search = await p.$('.ezy-head [type=search], .ezy-head a[href*="/search"], .ezy-head [data-ezy-search]');
  gate('G8', 'header has search', !!search, search ? 'found' : 'missing');
  await ctx.close(); await sleep(1500);

  // Cart count updates in header after add, desktop.
  ({ p, ctx, bad } = await open(WIPER, 1280, 900));
  // /cart.js answers 429 with an HTML page when the runner is throttled: retry with a cool-down, never parse an unchecked body.
  const cartCount = (pg) => pg.evaluate(async () => { for (let n = 0; n < 6; n++) { const r = await fetch('/cart.js'); const t = await r.text(); try { return JSON.parse(t).item_count; } catch (e) { await new Promise((x) => setTimeout(x, 5000 * (n + 1))); } } return -1; });
  const before = await cartCount(p);
  const addBtn = await p.$('[data-ezy-add], button[name="add"], #add-to-cart, .product-form__submit');
  if (addBtn) { await addBtn.click(); await p.waitForTimeout(4000); }
  const after = await cartCount(p);
  const badge = await p.evaluate(() => { const e = document.querySelector('.ezy-head [data-cart-count]'); return e ? e.textContent.trim() : 'none'; });
  await snap(p, 'G9-after-add-desktop');
  const objD = bad.filter((x) => x.includes('object'));
  gate('G5d', 'wiper page desktop: no broken [object Object] requests', objD.length === 0, objD.join(', ') || 'none');
  gate('G9', 'header cart count matches cart after add', String(after) === badge && after > before, `cart ${before}->${after}, badge=${badge}`);
  await ctx.close(); await sleep(1500);

  // Cart page chrome.
  ({ p, ctx, bad } = await open('/cart'));
  const cartHead = await p.evaluate(() => !!document.querySelector('.ezy-head'));
  gate('G10', 'cart page has EZYFIT header', cartHead, `ezy-head ${cartHead ? 'present' : 'absent'}`);
  await ctx.close(); await sleep(1500);

  // Homepage: announcement links, footer brand.
  ({ p, ctx, bad } = await open('/'));
  const emptyLinks = await p.$$eval('.ezy-bar a', (a) => a.filter((x) => !x.getAttribute('href')).length);
  gate('G11', 'announcement bar has no empty links', emptyLinks === 0, `${emptyLinks} empty`);
  const footer = await p.evaluate(() => { const f = document.querySelector('footer, .footer-v7, [class*=footer]'); return f ? f.innerText : ''; });
  const cs = (footer.match(/Click ?Shades/gi) || []).length;
  gate('G12', 'footer is EZYFIT, not Click Shades', cs === 0 && /ezyfit/i.test(footer), `Click Shades mentions: ${cs}, EZYFIT: ${/ezyfit/i.test(footer)}`);
  // MACL-10: nothing emails a video, so the signup form must not promise one.
  const lead = await p.evaluate(() => { const s = document.querySelector('#ezy-lead'); return s ? s.innerText : ''; });
  gate('G19', 'homepage email form promises no video it cannot send', !!lead && !/video/i.test(lead), lead.replace(/\s+/g, ' ').slice(0, 160) || 'form missing');
  const deadFoot = await p.evaluate(() => [...document.querySelectorAll('.ezy-foot a')].map(a => a.getAttribute('href')).filter(h => ['/pages/find-my-car', '/pages/faqs'].includes(h)));
  gate('G22', 'footer links skip the empty Find my car and FAQs pages', deadFoot.length === 0, deadFoot.join(', ') || 'none');
  await ctx.close(); await sleep(1500);

  // Old links to the empty Find my car page land on the homepage finder.
  ({ p, ctx, bad } = await open('/pages/find-my-car'));
  await p.waitForTimeout(2500);
  const fwd = await p.evaluate(() => ({ path: location.pathname, hash: location.hash, finder: !!document.querySelector('#find .ezy-finder') }));
  await snap(p, 'G23-find-my-car');
  gate('G23', 'old Find my car link lands on the homepage car finder', fwd.path === '/' && fwd.hash === '#find' && fwd.finder, JSON.stringify(fwd));
  await ctx.close(); await sleep(1500);

  // Collection page styled.
  ({ p, ctx, bad } = await open('/collections/wiper-blades'));
  const collEzy = await p.evaluate(() => !!document.querySelector('main .ezy'));
  await snap(p, 'G13-collection');
  gate('G13', 'wiper collection uses EZYFIT design', collEzy, `main .ezy ${collEzy ? 'present' : 'absent'}`);
  const typed = await p.$('[data-ezy-coll-q]');
  if (typed) { await typed.fill('hilux'); await p.waitForTimeout(300); }
  const shown = await p.$$eval('.ezy-coll__item', (li) => li.filter((x) => !x.hidden).map((x) => x.dataset.search));
  gate('G13b', 'collection car filter narrows to Hilux', shown.length >= 1 && shown.every((s) => s.includes('hilux')), `${shown.length} shown: ${shown.join(', ')}`);
  await ctx.close(); await sleep(1500);

  // Shade product page keeps the Click Shades design under the new header.
  ({ p, ctx, bad } = await open('/collections/car-window-shades'));
  const SHADE = await p.evaluate(() => { const a = document.querySelector('main a[href*="/products/"]'); return a ? new URL(a.href).pathname : null; });
  await ctx.close(); await sleep(1000);
  ({ p, ctx, bad } = await open(SHADE || '/'));
  const shade = await p.evaluate(() => ({ old: !!document.querySelector('.product-page-v2'), pdp: !!document.querySelector('.ezy-pdp'), head: !!document.querySelector('.ezy-head') }));
  await p.waitForTimeout(2000);
  const objS = bad.filter((x) => x.includes('object'));
  gate('G16b', 'shade page: no broken [object Object] requests', objS.length === 0, objS.join(', ') || 'none');
  gate('G16', 'shade product keeps old page, new header', shade.old && !shade.pdp && shade.head, JSON.stringify(shade));
  await ctx.close(); await sleep(1500);

  // Search results page.
  ({ p, ctx, bad } = await open('/search?q=hilux&type=product'));
  const srch = await p.evaluate(() => ({ ezy: !!document.querySelector('main .ezy-coll'), cards: document.querySelectorAll('.ezy-coll__card').length }));
  gate('G17', 'search page uses EZYFIT cards', srch.ezy && srch.cards > 0, JSON.stringify(srch));
  await ctx.close(); await sleep(1500);

  // Homepage finder: left-aligned dropdowns, Make search, Make > Model > Year lands on the product.
  ({ p, ctx, bad } = await open('/'));
  // Phone (390x844): the whole car finder, button included, sits above the fold; the video comes before the pack card.
  const fold = await p.evaluate(() => {
    const btn = document.querySelector('[data-ezy-finder] button[type=submit]');
    const v = document.querySelector('.ezy-hero .ezy-video'), k = document.querySelector('.ezy-hero .ezy-pack');
    return { btnBottom: btn ? Math.round(btn.getBoundingClientRect().bottom + scrollY) : -1, videoFirst: !!(v && k && (v.compareDocumentPosition(k) & Node.DOCUMENT_POSITION_FOLLOWING)) };
  });
  await snap(p, 'G21-home-phone-fold');
  gate('G21', 'phone homepage: car finder button above the fold (under 700px) and video above the pack card', fold.btnBottom > 0 && fold.btnBottom <= 700 && fold.videoFirst, JSON.stringify(fold));
  await p.click('[data-ezy-dd=make] .ezy-dd__btn');
  await p.keyboard.type('toyota'); await p.keyboard.press('Enter');
  await p.click('[data-ezy-dd=model] .ezy-dd__btn');
  await p.click('[data-ezy-dd=model] li:text-is("Hilux")');
  const fin = await p.evaluate(() => ({
    native: document.querySelectorAll('[data-ezy-finder] select, [data-ezy-finder] datalist').length,
    align: getComputedStyle(document.querySelector('.ezy-dd__btn')).textAlign,
    year: document.querySelector('[data-ezy-dd=year] .ezy-dd__val').textContent.trim(),
  }));
  await snap(p, 'G18-finder-filled');
  await Promise.all([p.waitForNavigation({ timeout: 30000 }), p.click('[data-ezy-finder] button[type=submit]')]);
  fin.landed = new URL(p.url()).pathname;
  gate('G18', 'homepage finder: normal dropdowns, Toyota > Hilux > year opens the product', fin.native === 0 && fin.align === 'left' && /\d{4}/.test(fin.year) && fin.landed === WIPER, JSON.stringify(fin));
  await ctx.close();
} catch (e) {
  console.log('ERROR', e.message);
}
await b.close();
const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} gates pass`);
fs.writeFileSync(path.join(OUT, 'gates.json'), JSON.stringify({ theme: THEME, at: new Date().toISOString(), passed, total: results.length, results }, null, 2));
console.log(`evidence: ${OUT}`);
process.exitCode = passed === results.length ? 0 : 1;
