// Shop brand gate for MACL-29. Fails when home, a shade product, or a wiper product calls the shop Click Shades.
// Usage: node .claude/skills/verify-ezyfit/scripts/gates-brand.mjs [themeId]
// Runs on GitHub Actions only (gates.yml). Evidence: _preview/evidence/<timestamp>/gates.json
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const THEME = process.argv[2] || '158148984988';
if (THEME === '149894070428') { console.error('Refusing the live theme.'); process.exit(2); }
const BASE = 'https://easy-fit-store1.myshopify.com';
const pv = (p) => `${BASE}${p}${p.includes('?') ? '&' : '?'}preview_theme_id=${THEME}`;
const PAGES = [
  { id: 'home', path: '/' },
  { id: 'shade', path: '/products/car-side-windows-sun-shades-for-toyota-land-cruiser-prado-150-2009-2023' },
  { id: 'wiper', path: '/products/front-windscreen-wipers-for-toyota-hilux-2018' },
];
const productLine = [
  'click shades for\\b',
  'click shades fitted\\b',
  'windscreen click shades',
  'windows click shades',
];
const results = [];
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..');
const OUT = path.join(ROOT, '_preview/evidence', 'brand-' + new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(OUT, { recursive: true });
const gate = (id, name, pass, evidence) => { results.push({ id, name, pass, evidence }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${name}  | ${evidence}`); };

const b = await chromium.launch(process.env.PW_EXEC ? { executablePath: process.env.PW_EXEC } : {});
const hits = [];
try {
  for (const page of PAGES) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(pv(page.path), { waitUntil: 'load', timeout: 90000 });
    await p.waitForTimeout(2500);
    const found = await p.evaluate((patterns) => {
      const themeId = window.Shopify && Shopify.theme && String(Shopify.theme.id);
      let text = document.body ? document.body.innerText : '';
      for (const s of document.querySelectorAll('script[type="application/ld+json"]')) text += '\n' + (s.textContent || '');
      for (const source of patterns) text = text.replace(new RegExp(source, 'gi'), ' ');
      const seen = [];
      const re = /click shades/gi;
      let m;
      while ((m = re.exec(text))) {
        seen.push(text.slice(Math.max(0, m.index - 48), m.index + m[0].length + 48).replace(/\s+/g, ' ').trim());
        if (seen.length >= 4) break;
      }
      return { themeId, seen };
    }, productLine);
    await ctx.close();
    if (found.themeId !== THEME) {
      hits.push(`${page.id}: theme ${found.themeId || 'missing'}`);
    }
    for (const snip of found.seen) hits.push(`${page.id}: ${snip}`);
  }
} catch (e) {
  hits.push(`error: ${e.message}`);
}
await b.close();
gate('B1', 'home, shade product, and wiper product do not call the shop Click Shades', hits.length === 0, hits.join(' || ') || 'none');
const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} gates pass`);
fs.writeFileSync(path.join(OUT, 'gates.json'), JSON.stringify({ theme: THEME, at: new Date().toISOString(), passed, total: results.length, results }, null, 2));
console.log(`evidence: ${OUT}`);
process.exitCode = passed === results.length ? 0 : 1;
