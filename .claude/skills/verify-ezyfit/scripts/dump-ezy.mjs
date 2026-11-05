// Usage: PLAYWRIGHT_PATH=... node .claude/skills/verify-ezyfit/scripts/dump-ezy.mjs
// Save rendered HTML of draft pages, with the theme CSS inlined, for the detector.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const OUTDIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../../_preview/evidence/dom');
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH);
const b = await chromium.launch();
const pages = { home: '/', pdp: '/products/front-windscreen-wipers-for-toyota-hilux-2018', coll: '/collections/wiper-blades' };
fs.mkdirSync(OUTDIR, { recursive: true });
for (const [k, route] of Object.entries(pages)) {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto('https://easy-fit-store1.myshopify.com' + route + '?preview_theme_id=158148984988', { waitUntil: 'load', timeout: 90000 });
  await p.waitForTimeout(2500);
  const css = await p.evaluate(async () => { const l = [...document.querySelectorAll('link[rel=stylesheet]')].find((x) => x.href.includes('ezy.css')); return l ? (await fetch(l.href)).text() : ''; });
  const html = await p.evaluate(() => { const m = document.querySelectorAll('.ezy'); return [...m].map((x) => x.outerHTML).join('\n'); });
  fs.writeFileSync(path.join(OUTDIR, k + '.html'), `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${html}</body></html>`);
  console.log(k, html.length);
  await p.close();
}
await b.close();
