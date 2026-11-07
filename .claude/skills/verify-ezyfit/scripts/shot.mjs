// Usage: node shot.mjs <path> <out.png> [width] [fullPage]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH);
const [path, out, w = '390', full = '1'] = process.argv.slice(2);
const b = await chromium.launch(process.env.PW_EXEC ? { executablePath: process.env.PW_EXEC } : {});
const p = await b.newPage({ viewport: { width: Number(w), height: Number(w) > 600 ? 900 : 844 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
const url = 'https://easy-fit-store1.myshopify.com' + path + (path.includes('?') ? '&' : '?') + 'preview_theme_id=158148984988';
await p.goto(url, { waitUntil: 'load', timeout: 90000 });
await p.waitForTimeout(3000);
await p.evaluate(() => document.querySelectorAll('#preview-bar-iframe, #PBarNextFrameWrapper').forEach((e) => e.remove()));
await p.screenshot({ path: out, fullPage: full === '1' });
console.log('errors:', errs.length ? errs.join(' | ').slice(0, 600) : 'none');
await b.close();
