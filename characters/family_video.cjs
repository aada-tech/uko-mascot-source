#!/usr/bin/env node
// Review video: Uko, Aituko and Meowuko play the same scenario side by side
// (deterministic: paused clock stepped at 30 fps, seeded random).
//   node characters/family_video.cjs [--out characters/family.mp4]
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
let puppeteer;
try { puppeteer = require('puppeteer'); } catch (e) { puppeteer = require(path.join(__dirname, '..', '..', 'node_modules', 'puppeteer')); }

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const ENGINE = path.join(__dirname, '..', 'mascot_engine', 'dist', 'uko-mascot-engine.js');
const OUT = arg('--out', path.join(__dirname, 'family.mp4'));
const CAST = [
  ['Uko', { character: 'uko', hairStyle: 'original' }],
  ['Aituko', { character: 'aituko' }],
  ['Meowuko', { character: 'meowuko' }]
];
const SCENARIO = [
  [0, 'idle', 'idle'], [3, 'welcome', 'welcome'], [6.5, 'success', 'success'], [10.3, 'success', 'success'],
  [14, 'thinking', 'thinking'], [20, 'loading', 'loading'], [26, 'success', 'loading → success'],
  [30, 'loading', 'loading'], [34, 'error', 'loading → error'], [38.5, 'empty', 'empty'], [42.5, 'sleep', 'sleep'], [50, null, '']
];
const FPS = 30, W = 300, H = 450;

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: W * CAST.length + 40, height: H + 70, deviceScaleFactor: 2 });
  await page.goto('about:blank');
  const engine = fs.readFileSync(ENGINE, 'utf8');
  await page.evaluate((engine, CAST, W, H) => {
    document.body.style.cssText = 'margin:0;background:#F4F7FF;font:600 16px system-ui;color:#333';
    document.body.innerHTML = `<div style="display:flex;gap:20px">${CAST.map(([name], i) => `<div><div style="height:34px;line-height:34px;text-align:center">${name}</div><iframe id="f${i}" style="width:${W}px;height:${H}px;border:0"></iframe></div>`).join('')}</div><div id="cap" style="height:34px;line-height:34px;text-align:center;font:500 17px ui-monospace,monospace"></div>`;
    CAST.forEach(([, o], i) => {
      const fr = document.getElementById('f' + i), doc = fr.contentDocument;
      doc.open(); doc.write('<!doctype html><body style="margin:0;background:#F4F7FF"><div id="m" style="width:100%;height:100vh"></div></body>'); doc.close();
      const w = fr.contentWindow;
      let seed = 11; w.Math.random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
      w.eval(engine);
      w.uko = w.UkoMascot.create(w.document.getElementById('m'), Object.assign({ interactive: false, theme: 'light' }, o));
      w.uko.pause(); w.uko.step(0);
    });
  }, engine, CAST, W, H);

  const total = SCENARIO[SCENARIO.length - 1][0];
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '21', '-preset', 'medium', '-movflags', '+faststart', OUT], { stdio: ['pipe', 'inherit', 'inherit'] });
  let si = -1;
  for (let f = 0; f <= total * FPS; f++) {
    const t = f / FPS;
    while (si + 1 < SCENARIO.length && SCENARIO[si + 1][0] <= t) {
      si++;
      const [, state, label] = SCENARIO[si];
      if (state) await page.evaluate((n, state, label) => {
        for (let i = 0; i < n; i++) document.getElementById('f' + i).contentWindow.uko.setState(state);
        document.getElementById('cap').textContent = label;
      }, CAST.length, state, label);
    }
    if (f) await page.evaluate(n => { for (let i = 0; i < n; i++) document.getElementById('f' + i).contentWindow.uko.step(1000 / 30); }, CAST.length);
    const buf = await page.screenshot({ type: 'jpeg', quality: 88 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  console.log(`wrote ${path.relative(process.cwd(), OUT)} (${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB)`);
})();
