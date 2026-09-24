#!/usr/bin/env node
// Renders an SVG to PNG (and optional light/dark sheet) for visual review.
//   node inuko/render_svg.cjs art/inuko-neutral.svg out.png [size]
const fs = require('fs');
const path = require('path');
let puppeteer;
try { puppeteer = require('puppeteer'); } catch (e) { puppeteer = require(path.join(__dirname, '..', '..', 'node_modules', 'puppeteer')); }
const [,, src, out, size = '700'] = process.argv;
(async () => {
  const svg = fs.readFileSync(path.resolve(src), 'utf8');
  const b = await puppeteer.launch({ headless: 'new' });
  const p = await b.newPage();
  const S = +size;
  await p.setViewport({ width: S * 2 + 30, height: S, deviceScaleFactor: 1 });
  await p.setContent(`<body style="margin:0;display:flex;gap:30px;background:#fff">
    <div style="width:${S}px;height:${S}px;background:#F4F7FF">${svg}</div>
    <div style="width:${S}px;height:${S}px;background:#17153A">${svg}</div></body>`);
  await p.evaluate(() => document.querySelectorAll('svg').forEach(s => { s.setAttribute('width', '100%'); s.setAttribute('height', '100%'); }));
  await p.screenshot({ path: out });
  await b.close();
})();
