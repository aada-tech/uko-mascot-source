#!/usr/bin/env node
// Liveliness audit: how much does Uko actually move in each persistent state?
// Deterministic (paused clock, seeded random). For each state it reports, over a long hold:
//   - motion: mean joint speed (px/s at a 240×360 display, i.e. what a user sees in an app)
//   - still:  longest stretch where the whole body moves less than 0.5 px/s
//   - range:  largest travel of any joint
//   - beats:  distinct gestures (bursts of motion clearly above the base loop)
// and writes a filmstrip (1 frame/s) per state.
//   node test_and_deploy/audit_liveliness.cjs [engine.js] [--out dir] [--seconds 24]
const fs = require('fs');
const path = require('path');
let puppeteer;
try { puppeteer = require('puppeteer'); } catch (e) { puppeteer = require(path.join(__dirname, '..', '..', 'node_modules', 'puppeteer')); }

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const ENGINE = args.find(a => a.endsWith('.js')) || path.join(ROOT, 'mascot_engine/dist/uko-mascot-engine.js');
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : path.join(__dirname, 'output', 'liveliness');
const SECONDS = args.includes('--seconds') ? Number(args[args.indexOf('--seconds') + 1]) : 24;
const STATES = (process.env.STATES || 'idle,thinking,loading,sleep').split(',');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 240, height: 360, deviceScaleFactor: 1 });
  await page.goto('about:blank');
  await page.addScriptTag({ path: ENGINE });
  const report = {};
  for (const state of STATES) {
    const frames = [];
    const res = await page.evaluate(async (state, seconds) => {
      let seed = 7; Math.random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
      document.body.style.margin = 0;
      document.body.innerHTML = '<div id="m" style="width:240px;height:360px;background:#fff"></div>';
      const m = UkoMascot.create('#m', { hairStyle: 'original', interactive: false });
      m.pause(); m.step(0);
      if (state !== 'idle') m.setState(state);
      const svg = () => document.querySelector('#m svg');
      const scale = () => { const vb = svg().viewBox.baseVal; return 240 / vb.width; };
      const joints = [];
      const dt = 1000 / 30;
      for (let i = 0; i <= seconds * 30; i++) {
        m.step(i === 0 ? 0 : dt);
        const p = m.getPose();
        const flat = [];
        for (const [k, v] of Object.entries(p)) if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'number') flat.push(v[0], v[1]);
        joints.push(flat);
      }
      return { joints, scale: scale() };
    }, state, SECONDS);
    // Speed per frame, in display px/s, skipping the first 2.5 s (entry transition).
    const skip = 75, s = res.scale;
    const speed = [];
    for (let i = skip + 1; i < res.joints.length; i++) {
      const a = res.joints[i - 1], b = res.joints[i];
      let sum = 0, n = 0;
      for (let j = 0; j < a.length; j += 2) { sum += Math.hypot(b[j] - a[j], b[j + 1] - a[j + 1]); n++; }
      speed.push(sum / n * s * 30);
    }
    const mean = speed.reduce((x, y) => x + y, 0) / speed.length;
    let still = 0, run = 0;
    for (const v of speed) { run = v < 0.5 ? run + 1 : 0; still = Math.max(still, run); }
    let range = 0;
    const J = res.joints.slice(skip);
    for (let j = 0; j < J[0].length; j += 2) {
      const xs = J.map(f => f[j]), ys = J.map(f => f[j + 1]);
      range = Math.max(range, Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * s);
    }
    const sorted = [...speed].sort((a, b) => a - b), median = sorted[Math.floor(sorted.length / 2)];
    let beats = 0, inBeat = false;
    for (const v of speed) { if (!inBeat && v > Math.max(3, 3 * median)) { beats++; inBeat = true; } else if (inBeat && v < Math.max(1.5, 1.5 * median)) inBeat = false; }
    report[state] = { motion: +mean.toFixed(2), stillSeconds: +(still / 30).toFixed(1), rangePx: +range.toFixed(1), beats };
    // Filmstrip: one frame per second (fresh run, same seed).
    const shots = [];
    await page.evaluate((state) => {
      let seed = 7; Math.random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
      document.body.innerHTML = '<div id="m" style="width:240px;height:360px;background:#fff"></div>';
      window.m = UkoMascot.create('#m', { hairStyle: 'original', interactive: false });
      m.pause(); m.step(0); if (state !== 'idle') m.setState(state);
    }, state);
    for (let sec = 0; sec <= SECONDS; sec += 2) {
      if (sec) await page.evaluate(() => { for (let i = 0; i < 60; i++) m.step(1000 / 30); });
      shots.push(await page.screenshot({ type: 'png' }));
    }
    fs.writeFileSync(path.join(OUT, `${state}.json`), JSON.stringify(report[state]));
    frames.push(...shots);
    shots.forEach((b, i) => fs.writeFileSync(path.join(OUT, `${state}_${String(i * 2).padStart(2, '0')}s.png`), b));
  }
  console.table(report);
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
})();
