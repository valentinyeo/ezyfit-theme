// Screenshot the rendered preview at phone and desktop width.
// Usage: node _preview/shot.mjs [template=index]  ->  _preview/out/<template>-390.png, -1280.png
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const tpl = process.argv[2] || 'index';
const types = { '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch();
const errors = [];
for (const [w, h] of [[390, 844], [1280, 900]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push(`${w}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${w}: ${m.text()}`); });
  await page.goto(`http://127.0.0.1:${port}/_preview/out/${tpl}.html`, { waitUntil: 'networkidle' });
  // Full-page shots never scroll, so load lazy images up front.
  await page.evaluate(() => document.querySelectorAll('img[loading=lazy]').forEach((i) => { i.loading = 'eager'; }));
  await page.waitForLoadState('networkidle');
  const out = path.join(here, 'out', `${tpl}-${w}.png`);
  await page.screenshot({ path: out, fullPage: true });
  const dims = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
  console.log(`${path.relative(root, out)} ${dims[0]}x${dims[1]}${dims[0] > w ? '  HORIZONTAL OVERFLOW' : ''}`);
  await page.close();
}
await browser.close();
server.close();
if (errors.length) { console.log('page errors:\n' + errors.join('\n')); process.exitCode = 1; }
