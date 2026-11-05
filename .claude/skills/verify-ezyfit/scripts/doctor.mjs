// Read-only: is the draft theme worth driving? Prints one line per check, exits 1 on any failure.
// Usage: PLAYWRIGHT_PATH=$HOME/.npm-global/lib/node_modules/playwright node .claude/skills/verify-ezyfit/scripts/doctor.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const THEME = process.argv[2] || '158148984988';
const b = await chromium.launch();
const p = await b.newPage();
let ok = true;
const res = await p.goto(`https://easy-fit-store1.myshopify.com/?preview_theme_id=${THEME}`, { waitUntil: 'load', timeout: 90000 });
const info = await p.evaluate(() => ({ id: window.Shopify && Shopify.theme && Shopify.theme.id, role: window.Shopify && Shopify.theme && Shopify.theme.role, head: !!document.querySelector('.ezy-head'), cart: typeof fetch }));
const line = (pass, msg) => { console.log(`${pass ? 'OK  ' : 'FAIL'} ${msg}`); if (!pass) ok = false; };
line(res && res.status() < 400, `store answers: HTTP ${res && res.status()}`);
line(String(info.id) === THEME, `draft theme served: Shopify.theme.id=${info.id}`);
line(info.role !== 'main', `theme is not the live one: role=${info.role}`);
line(info.head, 'EZYFIT header present');
const cart = await p.evaluate(async () => (await fetch('/cart.js')).ok);
line(cart, 'cart API answers');
await b.close();
process.exit(ok ? 0 : 1);
