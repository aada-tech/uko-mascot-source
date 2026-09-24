#!/usr/bin/env node
// Visual regression guard: renders every hairstyle × 3 orientations × every state × 2
// moments with two engine builds (random numbers seeded, clock paused) and lists what
// changed in the drawing (rig + effects). The style sheet may only gain rules.
//   node test_and_deploy/compare_engines.cjs [old.js] [new.js]
// Defaults: the published landing build vs mascot_engine/dist. Exit 1 if an unexpected
// hairstyle changed (pass the expected ones with EXPECT=degrade,afro).
const path = require('path');
let puppeteer;
try { puppeteer = require('puppeteer'); } catch (e) { puppeteer = require(path.join(__dirname, '..', '..', 'node_modules', 'puppeteer')); }
const ROOT = path.join(__dirname, '..');
const A = process.argv[2] || path.join(ROOT, 'landing_page/js/uko-mascot-engine.js');
const B = process.argv[3] || path.join(ROOT, 'mascot_engine/dist/uko-mascot-engine.js');
const EXPECT = (process.env.EXPECT || '').split(',').filter(Boolean);
(async () => {
  const b = await puppeteer.launch({ headless: 'new' });
  const grab = async (engine) => {
    const p = await b.newPage(); await p.goto('about:blank'); await p.addScriptTag({ path: engine });
    const out = await p.evaluate(async () => {
      const res = {};
      for (const h of Object.keys(UkoMascot.HAIR_STYLES)) for (const yaw of [0, 0.6, -1]) for (const st of UkoMascot.ORDER) for (const ms of [700, 1600]) {
        document.body.innerHTML = '<div id="m" style="width:240px;height:360px"></div>';
        let seed = 12345; Math.random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
        const m = UkoMascot.create('#m', { hairStyle: h, interactive: false, state: st });
        m.pause(); if (yaw) { m.setOrientation(yaw, 0); }
        m.step(ms);
        res[`${h}|${yaw}|${st}|${ms}`] = document.querySelector('#m .uko-rig').innerHTML + document.querySelector('#m .uko-fx').innerHTML;
        res.css = document.querySelector('#m svg style').textContent;
        m.destroy();
      }
      return res;
    });
    await p.close(); return out;
  };
  const before = await grab(A);
  const after = await grab(B);
  const cssOk = after.css.startsWith(before.css);
  delete before.css; delete after.css;
  const changed = Object.keys(before).filter(k => before[k] !== after[k]);
  const byHair = {};
  for (const k of changed) byHair[k.split('|')[0]] = (byHair[k.split('|')[0]] || 0) + 1;
  console.log('compared', Object.keys(before).length, 'renders · changed:', JSON.stringify(byHair), '· style sheet', cssOk ? 'only extended' : 'MODIFIED');
  await b.close();
  const unexpected = Object.keys(byHair).filter(h => !EXPECT.includes(h));
  if (!cssOk && !EXPECT.includes('css')) unexpected.push('css');
  console.log(unexpected.length ? `UNEXPECTED CHANGES: ${unexpected.join(', ')}` : 'PASS');
  process.exit(unexpected.length ? 1 : 0);
})();
