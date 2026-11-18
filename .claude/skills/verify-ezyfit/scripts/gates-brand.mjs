// Brand gates for MACL-34: the theme shows Click Shades to shoppers again. PASS or FAIL with evidence.
// B1 to B3 fail when shopper-visible "EZYFIT" (or "EZY FIT") appears on the home page, a shade product or a wiper product.
// Shopper-visible means the rendered text, the alt/title/aria-label values, the <title> and the meta description.
// B4 and B5 check the logo files: Click Shades in the header and footer, Click Blades kept on wiper pages.
// Runs only on GitHub Actions via gates.yml (house rule: no browser or CI on the VPS).
// Usage: PLAYWRIGHT_PATH=... node .claude/skills/verify-ezyfit/scripts/gates-brand.mjs [themeId]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const THEME = process.argv[2] || '158148984988';
if (THEME === '149894070428') { console.error('Refusing the live theme.'); process.exit(2); }
const BASE = 'https://easy-fit-store1.myshopify.com';
const pv = (p) => `${BASE}${p}${p.includes('?') ? '&' : '?'}preview_theme_id=${THEME}`;
const HOME = '/';
const SHADE = '/products/rear-side-windows-click-shades-for-toyota-rav4-2013-2019';
const WIPER = '/products/front-windscreen-wipers-for-toyota-hilux-2018';
const SHADES_LOGO = 'Horizontal_logo_black-blue.png';
const BLADES_LOGO = 'clickblades-logo.png';
const results = [];
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..');
const OUT = path.join(ROOT, '_preview/evidence', 'brand-' + new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(OUT, { recursive: true });
const snap = async (p, name) => { try { await p.screenshot({ path: path.join(OUT, name + '.png') }); } catch (e) {} };
const gate = (id, name, pass, evidence) => { results.push({ id, name, pass, evidence }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${name}  | ${evidence}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OLD_BRAND = /ezy\s?fit/i;

const b = await chromium.launch(process.env.PW_EXEC ? { executablePath: process.env.PW_EXEC } : {});
async function open(p0, w = 1280, h = 900) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  await p.goto(pv(p0), { waitUntil: 'load', timeout: 90000 });
  await p.waitForTimeout(2500);
  return { p, ctx };
}

// Everything a shopper reads or a screen reader announces, with the place each hit came from.
const audit = (p) => p.evaluate(() => {
  const meta = (s) => (document.querySelector(s) || {}).content || '';
  const attrs = [];
  for (const el of document.querySelectorAll('[alt], [title], [aria-label]')) {
    for (const a of ['alt', 'title', 'aria-label']) {
      const v = el.getAttribute(a);
      if (v) attrs.push({ where: `${el.tagName.toLowerCase()}[${a}]`, text: v });
    }
  }
  return {
    title: document.title,
    desc: meta('meta[name="description"]'),
    text: document.body.innerText,
    attrs,
  };
});

// One string per hit, so the evidence names the source instead of a bare boolean.
function hits(a) {
  const found = [];
  if (OLD_BRAND.test(a.title)) found.push(`<title>: ${a.title}`);
  if (OLD_BRAND.test(a.desc)) found.push(`meta description: ${a.desc}`);
  for (const line of a.text.split('\n')) if (OLD_BRAND.test(line)) found.push(`text: ${line.trim().slice(0, 120)}`);
  for (const x of a.attrs) if (OLD_BRAND.test(x.text)) found.push(`${x.where}: ${x.text}`);
  return [...new Set(found)];
}

const logos = (p) => p.evaluate(() => {
  const src = (el) => (el ? el.getAttribute('src') || '' : '');
  const head = document.querySelector('.ezy-head__logo img');
  const foot = document.querySelector('.ezy-foot__brand img');
  const drawer = document.querySelector('.ezy-drawer__top img');
  return { head: src(head), foot: src(foot), drawer: src(drawer), oldAsset: [...document.images].filter((i) => /ezy-logo/.test(i.getAttribute('src') || '')).length };
});

try {
  const pages = [
    ['B1', 'home', HOME],
    ['B2', 'shade product', SHADE],
    ['B3', 'wiper product', WIPER],
  ];
  for (const [id, label, url] of pages) {
    const { p, ctx } = await open(url);
    const themeId = await p.evaluate(() => window.Shopify && Shopify.theme && Shopify.theme.id);
    if (id === 'B1') gate('B0', 'draft theme is served', String(themeId) === THEME, `Shopify.theme.id=${themeId}`);
    const a = await audit(p);
    const found = hits(a);
    await snap(p, `${id}-${label.replace(/\s+/g, '-')}`);
    gate(id, `${label}: no shopper-visible EZYFIT`, found.length === 0, found.length ? found.join(' ; ').slice(0, 400) : 'none');

    const l = await logos(p);
    if (label === 'wiper product') {
      gate('B5', 'wiper page keeps the Click Blades logo', l.head.includes(BLADES_LOGO), `header logo ${l.head}`);
    } else {
      const ok = l.head.includes(SHADES_LOGO) && l.foot.includes(SHADES_LOGO) && l.oldAsset === 0;
      const id = label === 'home' ? 'B4a' : 'B4b';
      gate(id, `${label}: header and footer use the Click Shades logo`, ok, JSON.stringify(l).slice(0, 300));
    }
    if (label === 'home') {
      const ok = l.drawer.includes(SHADES_LOGO) && l.oldAsset === 0;
      gate('B4c', 'phone menu uses the Click Shades logo', ok, `drawer logo ${l.drawer}`);
    }
    await ctx.close(); await sleep(1200);
  }
} catch (e) {
  console.log('ERROR', e.message);
}
await b.close();
const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} gates pass`);
fs.writeFileSync(path.join(OUT, 'gates.json'), JSON.stringify({ theme: THEME, at: new Date().toISOString(), passed, total: results.length, results }, null, 2));
console.log(`evidence: ${OUT}`);
process.exitCode = passed === results.length ? 0 : 1;
