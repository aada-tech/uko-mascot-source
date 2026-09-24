#!/usr/bin/env node
// Framing checks of the 9:16 ad, per language:
//  - the phone body never leaves the frame: at least 40 px of air below it while on screen;
//  - every loupe shows the whole mascot, stays in the safe area and never covers the mascot on the phone;
//  - no caption line is wider than the frame.
//   (server on :3340 from UKO_MASTER_PACK/)  node marketing/subflow-ad/check_framing.cjs [fr|en|es]
const path = require('path');
let puppeteer;
try { puppeteer = require('puppeteer'); } catch (e) { puppeteer = require(path.join(__dirname, '..', '..', '..', 'node_modules', 'puppeteer')); }
const LANG = process.argv[2] || 'fr';
(async () => {
  const b = await puppeteer.launch({ headless: 'new' });
  const p = await b.newPage();
  await p.setViewport({ width: 1080, height: 1920 });
  await p.goto((process.env.AD_URL || 'http://localhost:3340/marketing/subflow-ad/compose/index.html') + '?lang=' + LANG, { waitUntil: 'load' });
  const info = await p.evaluate(() => window.adReady);
  const res = await p.evaluate((scenes) => {
    const out = [];
    // 1. phone bottom, sampled while the phone is on screen (after it slid in, before it leaves)
    let worst = Infinity, at = 0;
    for (let t = scenes.add.start; t < scenes.end.start; t += 1 / 15) { const m = 1920 - window.adPhoneBottom(t); if (m < worst) { worst = m; at = t; } }
    out.push({ ok: worst >= 40, msg: `phone bottom: smallest margin ${worst.toFixed(1)} px (t=${at.toFixed(2)} s)` });
    // 2. loupes
    for (const L of window.adLoupes()) {
      const [bx0, by0] = L.box, M = 12;
      const ux0 = 10 + (L.uko[0] - bx0) * L.m, uy0 = 10 + (L.uko[1] - by0) * L.m, ux1 = 10 + (L.uko[2] - bx0) * L.m, uy1 = 10 + (L.uko[3] - by0) * L.m;
      const inside = Math.min(ux0 - M, uy0 - M, L.w - M - ux1, L.h - M - uy1);
      const safe = L.left >= 40 && L.left + L.w <= 1040 && L.top >= 470 && L.top + L.h <= 1850;
      const [rx0, ry0, rx1, ry1] = L.ukoRect;
      const covers = !(rx1 < L.left || rx0 > L.left + L.w || ry1 < L.top || ry0 > L.top + L.h);
      out.push({ ok: inside >= 0 && safe && !covers, msg: `loupe ×${(L.m / (640 / 390 * .9)).toFixed(1)} ${Math.round(L.w)}×${Math.round(L.h)} at (${Math.round(L.left)}, ${Math.round(L.top)}): mascot margin ${inside.toFixed(1)} px, ${safe ? 'in safe area' : 'OUT of safe area'}, ${covers ? 'COVERS the mascot' : 'mascot visible'}` });
    }
    // 3. captions
    const wide = [...document.querySelectorAll('.cap .line')].map(l => [l.textContent.trim(), l.scrollWidth]).filter(([, w]) => w > 940);
    out.push({ ok: wide.length === 0, msg: `captions fit${wide.length ? ': too wide ' + JSON.stringify(wide) : ''}` });
    return out;
  }, info.scenes);
  res.forEach(r => console.log(`${r.ok ? 'ok  ' : 'FAIL'} [${LANG}] ${r.msg}`));
  await b.close();
  process.exit(res.every(r => r.ok) ? 0 : 1);
})();
