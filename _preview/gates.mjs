// Deep-work gates for the EZYFIT draft theme. Each gate prints PASS or FAIL with evidence.
// Usage: PLAYWRIGHT_PATH=... node _preview/gates.mjs [themeId]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const THEME = process.argv[2] || '158148984988';
const BASE = 'https://easy-fit-store1.myshopify.com';
const pv = (path) => `${BASE}${path}${path.includes('?') ? '&' : '?'}preview_theme_id=${THEME}`;
const WIPER = '/products/front-windscreen-wipers-for-toyota-hilux-2018';
const results = [];
const gate = (id, name, pass, evidence) => { results.push({ id, name, pass, evidence }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${name}  | ${evidence}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.launch();
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
  gate('G7', 'phone menu opens with links', navLinks >= 3, `visible drawer links after tap: ${navLinks}`);
  const search = await p.$('.ezy-head [type=search], .ezy-head a[href*="/search"], .ezy-head [data-ezy-search]');
  gate('G8', 'header has search', !!search, search ? 'found' : 'missing');
  await ctx.close(); await sleep(1500);

  // Cart count updates in header after add, desktop.
  ({ p, ctx, bad } = await open(WIPER, 1280, 900));
  const before = await p.evaluate(async () => (await (await fetch('/cart.js')).json()).item_count);
  const addBtn = await p.$('[data-ezy-add], button[name="add"], #add-to-cart, .product-form__submit');
  if (addBtn) { await addBtn.click(); await p.waitForTimeout(4000); }
  const after = await p.evaluate(async () => (await (await fetch('/cart.js')).json()).item_count);
  const badge = await p.evaluate(() => { const e = document.querySelector('.ezy-head [data-cart-count]'); return e ? e.textContent.trim() : 'none'; });
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
  await ctx.close(); await sleep(1500);

  // Collection page styled.
  ({ p, ctx, bad } = await open('/collections/wiper-blades'));
  const collEzy = await p.evaluate(() => !!document.querySelector('main .ezy'));
  gate('G13', 'wiper collection uses EZYFIT design', collEzy, `main .ezy ${collEzy ? 'present' : 'absent'}`);
  await ctx.close();
} catch (e) {
  console.log('ERROR', e.message);
}
await b.close();
const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} gates pass`);
