import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const THEME = process.argv[2] || '158148984988';
if (THEME === '149894070428') { console.error('Refusing the live theme.'); process.exit(2); }
const BASE = 'https://easy-fit-store1.myshopify.com';
const PRADO = '/products/car-side-windows-sun-shades-for-toyota-land-cruiser-prado-150-2009-2023';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..');
const OUT = path.join(ROOT, '_preview/evidence', new Date().toISOString().replace(/[:.]/g, '-') + '-shade-content');
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const gate = (id, name, pass, evidence) => {
  results.push({ id, name, pass, evidence });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${name}  | ${evidence}`);
};
const browser = await chromium.launch();
try {
  for (const width of [390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    try {
      await page.goto(`${BASE}${PRADO}?preview_theme_id=${THEME}`, { waitUntil: 'load' });
      const served = await page.evaluate(() => String(window.Shopify?.theme?.id));
      gate(`SC0-${width}`, 'requested theme is served', served === THEME, served);
      const response = await context.request.get(`${BASE}${PRADO}.js`);
      if (!response.ok()) throw new Error(`Product data returned ${response.status()}`);
      const product = await response.json();
      const observed = await page.evaluate(description => {
        const text = value => value.replace(/\s+/g, ' ').trim();
        const data = document.createElement('div');
        data.innerHTML = description;
        const lists = [...data.querySelectorAll('ul')];
        const included = lists.find(list => {
          let sibling = list.previousElementSibling;
          while (sibling) {
            if (/what you get|what's included|box contents/i.test(sibling.textContent)) return true;
            if (sibling.matches('ul, ol')) break;
            sibling = sibling.previousElementSibling;
          }
          return false;
        });
        const box = document.querySelector('[data-shade-box-contents]');
        const details = document.querySelector('.description-content');
        const uvFigures = value => [...value.matchAll(/\b(\d+(?:\.\d+)?)\s*%[^.!?\n]{0,70}\bUV\b|\bUV\b[^.!?\n]{0,70}?\b(\d+(?:\.\d+)?)\s*%/gi)].map(match => match[1] || match[2]);
        const descriptionFigures = uvFigures(data.textContent);
        const pageFigures = uvFigures(document.body.innerText);
        const schemaFigures = [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap(script => {
          const strings = value => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
          return strings(JSON.parse(script.textContent)).flatMap(uvFigures);
        });
        const badges = [...document.querySelectorAll('.price-badge')].map(badge => ({ text: text(badge.innerText), transform: getComputedStyle(badge).textTransform }));
        return {
          expectedContents: included ? text(included.textContent) : '',
          contents: box ? text(box.textContent) : '',
          descriptionUnchanged: !!details && text(details.textContent) === text(data.textContent),
          descriptionFigures, pageFigures, schemaFigures, badges
        };
      }, product.description);
      gate(`SC1-${width}`, 'Prado box contents match the product description', !!observed.expectedContents && observed.contents === observed.expectedContents && /rear passenger windows and rear port windows/i.test(observed.contents) && !/front windscreen/i.test(observed.contents), JSON.stringify({ expected: observed.expectedContents, actual: observed.contents }));
      gate(`SC2-${width}`, 'product description remains unchanged', observed.descriptionUnchanged, String(observed.descriptionUnchanged));
      const documented = [...new Set(observed.descriptionFigures)];
      const allFigures = [...observed.pageFigures, ...observed.schemaFigures];
      gate(`SC3-${width}`, 'page and schema use only the product description UV figure', documented.length === 1 && observed.pageFigures.length > 0 && allFigures.every(figure => figure === documented[0]), JSON.stringify({ documented, page: observed.pageFigures, schema: observed.schemaFigures }));
      gate(`SC4-${width}`, 'discount badges display sentence case', observed.badges.length > 0 && observed.badges.every(badge => /^Save\s/.test(badge.text) && badge.transform !== 'uppercase'), JSON.stringify(observed.badges));
      await page.locator('[data-shade-box-contents]').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(OUT, `box-contents-${width}.png`) });
      await page.locator('.price-badge').first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(OUT, `badge-${width}.png`) });
    } catch (error) {
      gate(`SC-error-${width}`, 'shade content journey completes', false, error.stack);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
const passed = results.filter(result => result.pass).length;
fs.writeFileSync(path.join(OUT, 'gates.json'), JSON.stringify({ theme: THEME, passed, total: results.length, results }, null, 2));
console.log(`${passed}/${results.length} gates pass`);
process.exitCode = passed === results.length ? 0 : 1;
