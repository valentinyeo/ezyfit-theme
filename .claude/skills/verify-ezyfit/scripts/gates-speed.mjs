import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const THEME = process.argv[2] || '158148984988';
if (THEME === '149894070428') throw new Error('Refusing the live theme');
const BASE = 'https://easy-fit-store1.myshopify.com';
const WIPER = '/products/front-windscreen-wipers-for-toyota-hilux-2018';
const SHADE = '/products/car-side-windows-sun-shades-for-toyota-land-cruiser-prado-150-2009-2023';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..');
const OUT = path.join(ROOT, '_preview/evidence', 'speed-' + new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const gate = (id, name, pass, evidence) => { results.push({ id, name, pass, evidence }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${name}  | ${evidence}`); };
const browser = await chromium.launch(process.env.PW_EXEC ? { executablePath: process.env.PW_EXEC } : {});
try {
  for (const width of [390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    for (const route of ['/', WIPER, SHADE, '/cart', '/collections/wiper-blades', '/search?q=hilux&type=product']) {
      await page.goto(`${BASE}${route}${route.includes('?') ? '&' : '?'}preview_theme_id=${THEME}`, { waitUntil: 'load', timeout: 90000 });
      const themeId = await page.evaluate(() => window.Shopify?.theme?.id);
      const links = await page.locator('link[rel="stylesheet"]').evaluateAll((nodes) => nodes.map((n) => n.href).filter((href) => /\/ezy\.css(?:\?|$)/.test(href)));
      gate(`S1-${width}-${route}`, 'requested theme loads ezy.css exactly once', String(themeId) === THEME && links.length === 1, JSON.stringify({ route, themeId, links }));
      if (route !== WIPER) continue;
      await page.locator('#ezy-pdp-photos').scrollIntoViewIfNeeded();
      await page.waitForFunction(() => [...document.querySelectorAll('#ezy-pdp-photos img')].length === 6 && [...document.querySelectorAll('#ezy-pdp-photos img')].every((img) => img.complete && img.naturalWidth > 0));
      const photos = await page.locator('#ezy-pdp-photos img').evaluateAll((nodes) => nodes.map((img) => ({ srcset: img.srcset, sizes: img.sizes, currentSrc: img.currentSrc, width: img.naturalWidth })));
      gate(`S2-${width}`, 'six customer photos load responsive candidates', photos.length === 6 && photos.every((img) => /160w/.test(img.srcset) && /320w/.test(img.srcset) && /640w/.test(img.srcset) && img.sizes && img.width > 0 && /cb-real-\d+-(160|320|640)\.jpg/.test(img.currentSrc)), JSON.stringify(photos));
      const compare = await page.locator('#ezy-pdp-compare').innerText();
      gate(`S3-${width}`, 'wiper benefits make no competitor comparisons or timed fitting promises', /EZYFIT/.test(compare) && !/cheap|dealer|universal|2 minutes/i.test(compare), compare.replace(/\s+/g, ' '));
      await page.screenshot({ path: path.join(OUT, `photos-${width}.png`) });
    }
    await context.close();
  }
} catch (error) {
  gate('S-error', 'speed gates complete', false, String(error.stack || error));
} finally {
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'gates.json'), JSON.stringify({ theme: THEME, results }, null, 2));
  console.log(`${results.filter((r) => r.pass).length}/${results.length} gates pass`);
  if (results.some((r) => !r.pass)) process.exitCode = 1;
}
