#!/usr/bin/env node
// Builds UKO_MASTER_PACK/site/ — the folder deployed to Cloudflare Pages
// (with UKO_MASTER_PACK/functions/ for the API). Nothing else is ever published:
// the engine sources, the pack builder and the archives stay private.
//
//   node test_and_deploy/publish_site.cjs            # refuses while legal.config.json is incomplete
//   node test_and_deploy/publish_site.cjs --draft    # local preview only, placeholders kept
//   npx wrangler pages deploy site --project-name uko-mascot   (from UKO_MASTER_PACK/)
const fs = require('fs');
const path = require('path');

const PACK = path.join(__dirname, '..');
const SRC = path.join(PACK, 'landing_page');
const OUT = path.join(PACK, 'site');
const draft = process.argv.includes('--draft');
// legal.config.json holds the publisher's legal details: never committed (see .gitignore).
// Without it (fresh clone), drafts are built from the empty template.
const LEGAL = fs.existsSync(path.join(SRC, 'legal.config.json')) ? 'legal.config.json' : 'legal.config.example.json';
const cfg = JSON.parse(fs.readFileSync(path.join(SRC, LEGAL), 'utf8'));
const SITE_URL = (cfg.SITE_URL || 'https://uko-mascot.pages.dev').replace(/\/$/, '');

const PAGES = ['index.html', 'success.html', 'mentions-legales.html', 'cgv.html', 'confidentialite.html', 'licence.html'];
const DIRS = ['css', 'js', 'rive', 'fonts', 'media'];
const PACK_ZIP = path.join(PACK, 'mascot_engine', 'dist', `Uko-Mascot-Pack-${require('../mascot_engine/package.json').version}.zip`);
// Free download (Uko Starter): public, served as a plain static file.
const STARTER_ZIP = path.join(PACK, 'mascot_engine', 'dist', `Uko-Starter-${require('../mascot_engine/package.json').version}.zip`);

// Sizes shown on the landing are measured on the real files at each publish
// (never typed by hand): gzip size of the web engine, raw size of the largest .riv
// (one file per character: uko.riv, aituko.riv, meowuko.riv).
const zlib = require('zlib');
cfg.ENGINE_KB = String(Math.round(zlib.gzipSync(fs.readFileSync(path.join(SRC, 'js', 'uko-mascot-engine.js')), { level: 9 }).length / 1024));
const RIVS = ['uko', 'aituko', 'meowuko'].map(c => path.join(SRC, 'rive', `${c}.riv`));
for (const f of RIVS) if (!fs.existsSync(f)) { console.error(`missing ${path.relative(PACK, f)} — copy it from mascot_engine/dist`); process.exit(1); }
cfg.RIV_KB = String(Math.round(Math.max(...RIVS.map(f => fs.statSync(f).size)) / 1024));
// The light file: the largest Starter .riv (4 essential states), as shipped in the free zip.
const STARTER_RIVS = ['uko', 'aituko', 'meowuko'].map(c => path.join(PACK, 'mascot_engine', 'dist', 'starter', `${c}-starter.riv`));
for (const f of STARTER_RIVS) if (!fs.existsSync(f)) { console.error(`missing ${path.relative(PACK, f)} — run node mascot_engine/rive/build_uko_rive.cjs --starter`); process.exit(1); }
cfg.RIV_STARTER_KB = String(Math.round(Math.max(...STARTER_RIVS.map(f => fs.statSync(f).size)) / 1024));
if (!fs.existsSync(STARTER_ZIP)) { console.error(`missing ${path.relative(PACK, STARTER_ZIP)} — run node mascot_engine/build_pack.cjs --starter`); process.exit(1); }
cfg.STARTER_KB = String(Math.round(fs.statSync(STARTER_ZIP).size / 1024));

const missing = new Set();
const fill = html => html.replace(/\{\{([A-Z_]+)\}\}/g, (m, key) => {
  const v = cfg[key];
  if (typeof v === 'string' && v.trim()) return v.trim();
  missing.add(key);
  return m;
});
const SIZES = { engine: cfg.ENGINE_KB, riv: cfg.RIV_KB, rivStarter: cfg.RIV_STARTER_KB, starter: cfg.STARTER_KB };
const sizes = html => html.replace(/(<span data-size="(\w+)">)[^<]*(<\/span>)/g, (m, open, key, close) => (SIZES[key] ? open + SIZES[key] + close : m));
const pages = PAGES.map(p => [p, sizes(fill(fs.readFileSync(path.join(SRC, p), 'utf8')))]);
if (missing.size && !draft) {
  console.error(`Not published — fill these keys in landing_page/legal.config.json: ${[...missing].join(', ')}`);
  process.exit(1);
}
if (!fs.existsSync(PACK_ZIP)) { console.error(`missing ${path.relative(PACK, PACK_ZIP)} — run node mascot_engine/build_pack.cjs`); process.exit(1); }

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const [p, html] of pages) fs.writeFileSync(path.join(OUT, p), html);
for (const d of DIRS) fs.cpSync(path.join(SRC, d), path.join(OUT, d), { recursive: true });
fs.mkdirSync(path.join(OUT, 'private'));
fs.copyFileSync(PACK_ZIP, path.join(OUT, 'private', 'Uko-Mascot-Pack.zip'));
fs.mkdirSync(path.join(OUT, 'free'));
fs.copyFileSync(STARTER_ZIP, path.join(OUT, 'free', 'Uko-Starter.zip'));

// English and Spanish versions of the home page (/en/, /es/), translated at build time.
const i18n = require('./i18n_site.cjs');
const i18nMissing = i18n.missing();
if (i18nMissing.length) { console.error(`Not published — ${i18nMissing.length} strings without translation (node test_and_deploy/i18n_site.cjs check)`); process.exit(1); }
const translated = (async () => {
  const fr = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
  for (const lang of i18n.LANGS) {
    let { html, miss } = await i18n.translate(fr, lang);
    if (miss.length) { console.error(`Not published — /${lang}/ has untranslated text: ${miss.slice(0, 5).join(' | ')}`); process.exit(1); }
    html = html
      .replace(`<link rel="canonical" href="${SITE_URL}/">`, `<link rel="canonical" href="${SITE_URL}/${lang}/">`)
      .replace(`<meta property="og:url" content="${SITE_URL}/">`, `<meta property="og:url" content="${SITE_URL}/${lang}/">`)
      .replace('<meta property="og:locale" content="fr_FR">', `<meta property="og:locale" content="${lang === 'en' ? 'en_US' : 'es_ES'}">`)
      .replace(/(<a href="\/" hreflang="fr"[^>]*?) aria-current="page"/, '$1')
      .replace(new RegExp(`(<a href="/${lang}/" hreflang="${lang}"[^>]*?data-lang="${lang}")`), '$1 aria-current="page"')
      .replace(/uko-(subflow-ad|custom)-(poster-)?fr\./g, `uko-$1-$2${lang}.`);
    fs.mkdirSync(path.join(OUT, lang), { recursive: true });
    fs.writeFileSync(path.join(OUT, lang, 'index.html'), html);
  }
})();

// robots + sitemap
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /private/\nDisallow: /success\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
const today = new Date().toISOString().slice(0, 10);
const urls = [['', '1.0', 'weekly'], ['en/', '0.9', 'weekly'], ['es/', '0.9', 'weekly'], ...['mentions-legales', 'cgv', 'confidentialite', 'licence'].map(p => [p, '0.3', 'yearly'])];
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, p, c]) => `  <url><loc>${SITE_URL}/${u}</loc><lastmod>${today}</lastmod><changefreq>${c}</changefreq><priority>${p}</priority></url>`).join('\n')}\n</urlset>\n`);

// Security headers (Cloudflare Pages _headers). 'wasm-unsafe-eval' is required
// by the Rive runtime; everything else is served from this origin only.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');
fs.writeFileSync(path.join(OUT, '_headers'), `/*
  Strict-Transport-Security: max-age=63072000; includeSubDomains
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Cross-Origin-Opener-Policy: same-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=()
  Content-Security-Policy: ${CSP}

/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/rive/rive.wasm
  Cache-Control: public, max-age=2592000

/success
  X-Robots-Tag: noindex
  Cache-Control: no-store

/free/*
  Content-Disposition: attachment; filename="Uko-Starter.zip"
  Cache-Control: public, max-age=3600
  X-Robots-Tag: noindex
`);
// Functions only run for the API and to lock /private/ (static assets stay free and unlimited).
fs.writeFileSync(path.join(OUT, '_routes.json'), JSON.stringify({ version: 1, include: ['/api/*', '/private/*'], exclude: [] }, null, 2));

const size = dir => fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? size(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);
translated.then(() => {
  console.log(`${draft && missing.size ? 'DRAFT (do not deploy) — ' : ''}site/ built: ${PAGES.length} pages, ${DIRS.join(', ')}, private pack, free starter (${cfg.STARTER_KB} KB) · ${(size(OUT) / 1024 / 1024).toFixed(2)} MB · ${SITE_URL}`);
if (missing.size) console.log(`placeholders left: ${[...missing].join(', ')}`);
  console.log('  + /en/ and /es/ (translated)');
});
