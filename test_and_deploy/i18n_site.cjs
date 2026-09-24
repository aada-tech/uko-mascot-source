#!/usr/bin/env node
// Site translation (French source → English, Spanish), done at build time.
//
// The French page is the source. Every visible text node and every translatable
// attribute (aria-label, alt, title, placeholder, meta content) is looked up, by its
// exact French text, in landing_page/i18n/strings.json: { "<fr>": { "en": …, "es": … } }.
// Code (<code>, <pre>, .code), scripts, styles and SVG are never touched.
//
//   node test_and_deploy/i18n_site.cjs extract   → adds new French strings to strings.json (en/es empty)
//   node test_and_deploy/i18n_site.cjs check     → fails if a string has no translation
//   require('./i18n_site.cjs').translate(html, lang) → translated page (used by publish_site.cjs)
const fs = require('fs');
const path = require('path');
let puppeteer;
try { puppeteer = require('puppeteer'); } catch (e) { puppeteer = require(path.join(__dirname, '..', '..', 'node_modules', 'puppeteer')); }

const ROOT = path.join(__dirname, '..');
const DICT = path.join(ROOT, 'landing_page', 'i18n', 'strings.json');
const PAGES = ['index.html'];
const LANGS = ['en', 'es'];
const norm = s => s.replace(/\s+/g, ' ').trim();

// Runs in the browser on a DOMParser document (scripts never execute there).
function walk(doc, visit) {
  const SKIP = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'svg', 'SVG', 'NOSCRIPT']);
  const skip = el => { for (let e = el; e; e = e.parentElement) if (SKIP.has(e.tagName) || (e.classList && (e.classList.contains('code') || e.hasAttribute('data-no-i18n')))) return true; return false; };
  const tw = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_TEXT);
  const nodes = []; let n;
  while ((n = tw.nextNode())) nodes.push(n);
  for (const t of nodes) {
    if (skip(t.parentElement)) continue;
    const raw = t.nodeValue, text = raw.replace(/\s+/g, ' ').trim();
    if (!/\p{L}/u.test(text)) continue;
    const res = visit(text, 'text');
    if (res != null) t.nodeValue = raw.replace(/\S[\s\S]*\S|\S/, res);
  }
  for (const el of doc.querySelectorAll('[aria-label],[alt],[title],[placeholder],meta[name="description"],meta[property="og:description"],meta[property="og:title"],meta[name="twitter:description"],meta[name="twitter:title"]')) {
    if (skip(el) && !el.matches('meta')) continue;
    for (const a of ['aria-label', 'alt', 'title', 'placeholder', 'content']) {
      if (!el.hasAttribute(a) || (a === 'content' && !el.matches('meta'))) continue;
      const text = el.getAttribute(a).replace(/\s+/g, ' ').trim();
      if (!/\p{L}/u.test(text)) continue;
      const res = visit(text, a);
      if (res != null) el.setAttribute(a, res);
    }
  }
}

async function withPage(fn) {
  const browser = await puppeteer.launch({ headless: 'new' });
  try { const page = await browser.newPage(); await page.goto('about:blank'); return await fn(page); } finally { await browser.close(); }
}

// Strings that stay as they are in every language (names, code identifiers, units).
const SAME = s => /^(uko|Uko|Rive|Web|React|Flutter|iOS|Android|HTML|JS|Stripe|state|trigger|idle|thinking|loading|sleep|welcome|success|error|empty|wake|FR|EN|ES|Starter)$/.test(s) || /^[\w.-]+\.(js|riv|zip)$/.test(s);

async function extract() {
  const dict = fs.existsSync(DICT) ? JSON.parse(fs.readFileSync(DICT, 'utf8')) : {};
  const found = await withPage(page => page.evaluate((pages, walkSrc) => {
    const walk = eval('(' + walkSrc + ')'), out = [];
    for (const html of pages) walk(new DOMParser().parseFromString(html, 'text/html'), (text) => { out.push(text); return null; });
    return out;
  }, PAGES.map(p => fs.readFileSync(path.join(ROOT, 'landing_page', p), 'utf8')), walk.toString()));
  let added = 0;
  for (const s of found) if (!SAME(s) && !dict[s]) { dict[s] = { en: '', es: '' }; added++; }
  fs.mkdirSync(path.dirname(DICT), { recursive: true });
  fs.writeFileSync(DICT, JSON.stringify(dict, null, 2) + '\n');
  console.log(`${found.length} strings on the page · ${added} new · ${Object.keys(dict).length} in the dictionary`);
}

function missing() {
  const dict = JSON.parse(fs.readFileSync(DICT, 'utf8'));
  return Object.entries(dict).filter(([, v]) => LANGS.some(l => !v[l])).map(([k]) => k);
}

async function translate(html, lang) {
  const dict = JSON.parse(fs.readFileSync(DICT, 'utf8'));
  return withPage(page => page.evaluate((html, lang, dict, walkSrc, sameSrc) => {
    const walk = eval('(' + walkSrc + ')'), SAME = eval('(' + sameSrc + ')');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const miss = [];
    walk(doc, (text) => { const e = dict[text]; if (e && e[lang]) return e[lang]; if (!SAME(text)) miss.push(text); return null; });
    doc.documentElement.lang = lang;
    return { html: '<!doctype html>\n' + doc.documentElement.outerHTML, miss };
  }, html, lang, dict, walk.toString(), SAME.toString()));
}

module.exports = { translate, missing, LANGS };

if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === 'extract') extract();
  else if (cmd === 'check') { const m = missing(); if (m.length) { console.log(`${m.length} strings without translation:\n` + m.slice(0, 40).join('\n')); process.exit(1); } console.log('all strings translated'); }
  else console.log('usage: i18n_site.cjs extract|check');
}
