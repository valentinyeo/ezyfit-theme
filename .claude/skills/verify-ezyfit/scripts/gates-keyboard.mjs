import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const THEME = process.argv[2] || '158148984988';
if (THEME === '149894070428') { console.error('Refusing the live theme.'); process.exit(2); }
const BASE = 'https://easy-fit-store1.myshopify.com';
const WIPER = '/products/front-windscreen-wipers-for-toyota-hilux-2018';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..');
const OUT = path.join(ROOT, '_preview/evidence', new Date().toISOString().replace(/[:.]/g, '-') + '-keyboard');
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
      await page.goto(`${BASE}${WIPER}?preview_theme_id=${THEME}`, { waitUntil: 'load' });
      const served = await page.evaluate(() => String(window.Shopify?.theme?.id));
      gate(`K0-${width}`, 'requested theme is served', served === THEME, served);
      const links = page.locator('.ezy-pdp__other');
      const hrefs = await links.evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
      gate(`K1-${width}`, 'both return-to-finder links use /#find', hrefs.length === 2 && hrefs.every(href => href === '/#find'), JSON.stringify(hrefs));
      await links.first().click();
      await page.waitForURL(url => url.pathname === '/' && url.hash === '#find');
      const anchor = await page.locator('#find [data-ezy-finder]').isVisible();
      gate(`K2-${width}`, 'return link lands on the homepage finder', anchor, page.url());

      const make = page.locator('[data-ezy-dd=make]');
      await make.locator('button').focus();
      await page.keyboard.press('Enter');
      await page.keyboard.type('Toyota');
      await page.keyboard.press('Enter');
      const model = page.locator('[data-ezy-dd=model]');
      await model.locator('button').press('ArrowDown');
      const firstFocused = await model.locator('[role=option]').first().evaluate(node => node === document.activeElement);
      const models = await model.locator('[role=option]').allTextContents();
      const hilux = models.indexOf('Hilux');
      if (hilux < 0) throw new Error('Toyota Hilux is missing from the real finder catalog');
      for (let i = 0; i < hilux; i++) await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      gate(`K3-${width}`, 'keyboard selects Hilux from the real catalog', firstFocused && (await model.locator('.ezy-dd__val').innerText()) === 'Hilux', JSON.stringify({ firstFocused, models }));
      await page.screenshot({ path: path.join(OUT, `finder-${width}.png`) });
      await page.locator('[data-ezy-finder] button[type=submit]').press('Enter');
      await page.waitForURL(url => url.pathname === WIPER);
      gate(`K4-${width}`, 'keyboard finder opens the real wiper product', true, page.url());

      if (width === 390) {
        const menu = page.locator('[data-ezy-menu]');
        await menu.focus();
        await page.keyboard.press('Enter');
        const drawer = page.locator('[data-ezy-drawer]');
        const modal = await drawer.evaluate(node => node.matches(':modal'));
        const backgroundBlocked = await menu.evaluate(node => { node.focus(); return document.activeElement !== node; });
        let contained = true;
        const steps = await drawer.locator('a[href], button, input:not([type=hidden])').count() + 2;
        for (const key of ['Tab', 'Shift+Tab']) {
          for (let i = 0; i < steps; i++) {
            await page.keyboard.press(key);
            contained &&= await drawer.evaluate(node => document.activeElement === document.body || node.contains(document.activeElement));
          }
        }
        gate('K5', 'mobile menu contains Tab and blocks background focus', modal && backgroundBlocked && contained, JSON.stringify({ modal, backgroundBlocked, contained }));
        await page.screenshot({ path: path.join(OUT, 'mobile-menu.png') });
        await page.keyboard.press('Escape');
        await drawer.waitFor({ state: 'hidden' });
        const returned = await menu.evaluate(node => node === document.activeElement && node.getAttribute('aria-expanded') === 'false');
        gate('K6', 'Escape closes the menu and restores its opener', returned, String(returned));
        await menu.press('Enter');
        await drawer.locator('.ezy-drawer__close').click();
        await drawer.waitFor({ state: 'hidden' });
        gate('K7', 'close button restores the menu opener', await menu.evaluate(node => node === document.activeElement), 'close button');
      }

      await page.route('**/*', async route => {
        if (!route.request().isNavigationRequest() || new URL(route.request().url()).pathname !== '/') return route.continue();
        const response = await route.fetch();
        const html = await response.text();
        const fixture = [
          { t: 'Front Windscreen Wipers for Mazda 3 2018', u: '/products/keyboard-fixture-mazda' },
          { t: 'Front Windscreen Wipers for Toyota Corolla 2018', u: '/products/keyboard-fixture-corolla' },
          { t: 'Front Windscreen Wipers for Toyota Hilux 2018', u: WIPER },
          { t: 'Front Windscreen Wipers for Toyota Hilux 2020', u: '/products/keyboard-fixture-hilux-2020' }
        ];
        const body = html.replace(/(<script[^>]*data-ezy-products[^>]*>)[\s\S]*?(<\/script>)/, (_, start, end) => start + JSON.stringify(fixture) + end);
        await route.fulfill({ response, body });
      });
      await page.goto(`${BASE}/?preview_theme_id=${THEME}`, { waitUntil: 'load' });
      await make.locator('button').press('Enter');
      await page.keyboard.type('Toyota');
      await page.keyboard.press('Enter');
      await model.locator('button').press('Enter');
      const hiddenSearchFocus = await model.locator('[role=option]').first().evaluate(node => node === document.activeElement);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press(' ');
      const year = page.locator('[data-ezy-dd=year]');
      await year.locator('button').press('ArrowUp');
      const lastYearFocus = await year.locator('[role=option]').last().evaluate(node => node === document.activeElement);
      await page.keyboard.press('ArrowUp');
      await page.keyboard.press('ArrowUp');
      const buttonFocus = await year.locator('button').evaluate(node => node === document.activeElement);
      await page.keyboard.press('Escape');
      await page.keyboard.press('Enter');
      const firstYearFocus = await year.locator('[role=option]').first().evaluate(node => node === document.activeElement);
      await page.keyboard.press(' ');
      const chosen = await year.locator('.ezy-dd__val').innerText();
      gate(`K8-${width}`, 'multi-year fixture supports hidden-search focus, arrows and Space', hiddenSearchFocus && lastYearFocus && buttonFocus && firstYearFocus && chosen === '2018', JSON.stringify({ hiddenSearchFocus, lastYearFocus, buttonFocus, firstYearFocus, chosen }));
    } catch (error) {
      gate(`K-error-${width}`, 'keyboard journey completes', false, error.stack);
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
