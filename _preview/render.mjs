// Local preview for the EZYFIT theme. Renders a JSON template plus header and footer groups to static HTML.
// Not Shopify: Shopify-only filters and objects are mocked. Use for layout and visual QA only.
// Usage: node _preview/render.mjs [template=index]  ->  _preview/out/<template>.html
import { Liquid } from 'liquidjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outDir = path.join(here, 'out');
const tplName = process.argv[2] || 'index';
fs.mkdirSync(outDir, { recursive: true });

const stripJsonComments = (s) => s.replace(/^\s*\/\*[\s\S]*?\*\//, '');
const readJson = (p) => JSON.parse(stripJsonComments(fs.readFileSync(p, 'utf8')));
const locales = readJson(path.join(root, 'locales/en.default.json'));
const products = JSON.parse(fs.readFileSync(path.join(here, 'mock-products.json'), 'utf8')).map((p) => ({
  title: p.title, handle: p.handle, url: `/products/${p.handle}`, price: Math.round(parseFloat(p.price) * 100),
}));

const engine = new Liquid({ root: [path.join(root, 'snippets')], extname: '.liquid', strictFilters: false, strictVariables: false, jsTruthy: false });

// Tags Shopify adds.
engine.registerTag('schema', {
  parse(_t, remain) { this.tpls = []; const stream = this.liquid.parser.parseStream(remain); stream.on('tag:endschema', () => stream.stop()).on('template', () => {}).on('end', () => { throw new Error('schema not closed'); }); stream.start(); },
  * render() { return ''; },
});
for (const name of ['style', 'stylesheet', 'javascript']) {
  engine.registerTag(name, {
    parse(_t, remain) { this.tpls = []; const stream = this.liquid.parser.parseStream(remain); stream.on(`tag:end${name}`, () => stream.stop()).on('template', (tpl) => this.tpls.push(tpl)).on('end', () => { throw new Error(`${name} not closed`); }); stream.start(); },
    * render(ctx, emitter) { const html = yield this.liquid.renderer.renderTemplates(this.tpls, ctx); const tag = name === 'javascript' ? 'script' : 'style'; emitter.write(`<${tag}>${html}</${tag}>`); },
  });
}
engine.registerTag('form', {
  parse(token, remain) { this.args = token.args; this.tpls = []; const stream = this.liquid.parser.parseStream(remain); stream.on('tag:endform', () => stream.stop()).on('template', (tpl) => this.tpls.push(tpl)).on('end', () => { throw new Error('form not closed'); }); stream.start(); },
  * render(ctx, emitter) {
    ctx.push({ form: { posted_successfully: false, errors: null } });
    const html = yield this.liquid.renderer.renderTemplates(this.tpls, ctx);
    ctx.pop();
    const id = (this.args.match(/id:\s*'([^']+)'/) || [])[1] || '';
    emitter.write(`<form method="post" action="/contact" id="${id}">${html}</form>`);
  },
});

// Filters Shopify adds.
const assetUrl = (f) => `../../assets/${f}`;
engine.registerFilter('asset_url', assetUrl);
engine.registerFilter('asset_img_url', assetUrl);
engine.registerFilter('stylesheet_tag', (u) => `<link rel="stylesheet" href="${u}">`);
engine.registerFilter('script_tag', (u) => `<script src="${u}"></script>`);
engine.registerFilter('image_url', (img) => (img && img.src) || '');
engine.registerFilter('img_url', (img) => (img && img.src) || '');
engine.registerFilter('image_tag', (u, ...a) => `<img src="${u}" alt="">`);
engine.registerFilter('money', (c) => `$${(Number(c || 0) / 100).toFixed(2)}`);
engine.registerFilter('money_without_trailing_zeros', (c) => `$${(Number(c || 0) / 100).toFixed(2).replace(/\.00$/, '')}`);
engine.registerFilter('handleize', (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
engine.registerFilter('handle', (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'));
engine.registerFilter('payment_type_svg_tag', (t) => `<span class="pay-mock">${t}</span>`);
engine.registerFilter('t', (key) => key.split('.').reduce((o, k) => (o ? o[k] : undefined), locales) ?? key);
engine.registerFilter('within', (u) => u);

const settingsData = readJson(path.join(root, 'config/settings_data.json'));
const themeSettings = typeof settingsData.current === 'object' ? settingsData.current : {};

const globals = {
  shop: { name: '1300 EZYFIT', url: 'https://example.com', enabled_payment_types: ['visa', 'master', 'american_express', 'paypal', 'apple_pay', 'google_pay', 'afterpay'] },
  routes: { root_url: '/', cart_url: '/cart', search_url: '/search', account_url: '/account', collections_url: '/collections' },
  cart: { item_count: 0, items: [], total_price: 0 },
  settings: themeSettings,
  request: { page_type: tplName, path: '/' },
  template: { name: tplName },
  linklists: new Proxy({}, { get: (_o, k) => ({ title: String(k), links: [
    { title: 'Wiper blades', url: '#' }, { title: 'Car shades', url: '#' }, { title: 'Fitment videos', url: '#' }, { title: 'Help', url: '#' },
  ] }) }),
  collections: new Proxy({}, { get: (_o, k) => ({ handle: String(k), title: String(k), products, products_count: products.length }) }),
};

function schemaOf(src) {
  const m = src.match(/{%-?\s*schema\s*-?%}([\s\S]*?){%-?\s*endschema\s*-?%}/);
  return m ? JSON.parse(m[1]) : {};
}
const defaults = (list = []) => Object.fromEntries(list.filter((s) => s.id && 'default' in s).map((s) => [s.id, s.default]));

async function renderSection(id, data) {
  const file = path.join(root, 'sections', `${data.type}.liquid`);
  const src = fs.readFileSync(file, 'utf8');
  const schema = schemaOf(src);
  const blockDefs = Object.fromEntries((schema.blocks || []).map((b) => [b.type, b]));
  const order = data.block_order || Object.keys(data.blocks || {});
  const blocks = order.map((bid) => {
    const b = data.blocks[bid];
    return { id: bid, type: b.type, settings: { ...defaults(blockDefs[b.type]?.settings), ...b.settings }, shopify_attributes: '' };
  });
  const section = { id, settings: { ...defaults(schema.settings), ...data.settings }, blocks };
  const html = await engine.parseAndRender(src, { ...globals, section });
  return `<div id="shopify-section-${id}" class="shopify-section">${html}</div>`;
}

async function renderGroup(file) {
  const g = readJson(path.join(root, 'sections', file));
  const parts = [];
  for (const id of g.order) parts.push(await renderSection(id, g.sections[id]));
  return parts.join('\n');
}

const tpl = readJson(path.join(root, 'templates', `${tplName}.json`));
const body = [];
for (const id of tpl.order) {
  if (tpl.sections[id].disabled) continue;
  try { body.push(await renderSection(id, tpl.sections[id])); }
  catch (e) { console.error(`section ${id} (${tpl.sections[id].type}): ${e.message}`); process.exitCode = 1; }
}
let header = '', footer = '';
try { header = await renderGroup('header-group.json'); } catch (e) { console.error(`header: ${e.message}`); process.exitCode = 1; }
try { footer = await renderGroup('footer-group.json'); } catch (e) { console.error(`footer: ${e.message}`); process.exitCode = 1; }

const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>EZYFIT preview: ${tplName}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,800&display=swap" rel="stylesheet">
<style>body{margin:0;font-family:Poppins,sans-serif}</style></head>
<body>${header}<main>${body.join('\n')}</main>${footer}</body></html>`;
fs.writeFileSync(path.join(outDir, `${tplName}.html`), page);
console.log(`wrote ${path.relative(root, path.join(outDir, `${tplName}.html`))} (${tpl.order.length} sections)`);
