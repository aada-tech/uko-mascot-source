#!/usr/bin/env node
// Side-by-side review video of two engine builds playing the same scenario
// (deterministic: paused clock stepped at 30 fps, seeded random).
//   node test_and_deploy/render_states_video.cjs --before old.js --after new.js --out review.mp4
// Scenario (seconds): idle → thinking → loading → success → loading → error → sleep.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
let puppeteer;
try { puppeteer = require('puppeteer'); } catch (e) { puppeteer = require(path.join(__dirname, '..', '..', 'node_modules', 'puppeteer')); }

const ROOT = path.join(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BEFORE = arg('--before', path.join(ROOT, 'landing_page/js/uko-mascot-engine.js'));
const AFTER = arg('--after', path.join(ROOT, 'mascot_engine/dist/uko-mascot-engine.js'));
const OUT = arg('--out', path.join(__dirname, 'output', 'states-review.mp4'));
const HAIR = arg('--hair', 'original');
const SCENARIO = JSON.parse(arg('--scenario', JSON.stringify([
  [0, 'idle', 'repos'], [12, 'thinking', 'réflexion'], [26, 'loading', 'chargement'], [38, 'success', 'chargement → succès'],
  [42.5, 'loading', 'chargement'], [49, 'error', 'chargement → erreur'], [54, 'sleep', 'sommeil'], [66, null, '']
])));
const FPS = 30, W = +arg('--w', 300), H = +arg('--h', 450);

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: W * 2 + 20, height: H + 60, deviceScaleFactor: 2 });
  await page.goto('about:blank');
  const engines = [fs.readFileSync(BEFORE, 'utf8'), fs.readFileSync(AFTER, 'utf8')];
  await page.evaluate((engines, W, H, HAIR) => {
    document.body.style.cssText = 'margin:0;background:#fff;font:600 15px system-ui;color:#333';
    document.body.innerHTML = `<div style="display:flex;gap:20px"><div><div style="height:30px;line-height:30px;text-align:center">Avant</div><iframe id="a" style="width:${W}px;height:${H}px;border:0"></iframe></div><div><div style="height:30px;line-height:30px;text-align:center">Après</div><iframe id="b" style="width:${W}px;height:${H}px;border:0"></iframe></div></div><div id="cap" style="height:30px;line-height:30px;text-align:center;font-size:17px"></div>`;
    for (const [i, id] of ['a', 'b'].entries()) {
      const doc = document.getElementById(id).contentDocument;
      doc.open(); doc.write('<!doctype html><body style="margin:0;background:#fff"><div id="m" style="width:100%;height:100vh"></div></body>'); doc.close();
      const w = document.getElementById(id).contentWindow;
      let seed = 11; w.Math.random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
      w.eval(engines[i]);
      w.uko = w.UkoMascot.create(w.document.getElementById('m'), { hairStyle: HAIR, interactive: false });
      w.uko.pause(); w.uko.step(0);
    }
  }, engines, W, H, HAIR);

  const total = SCENARIO[SCENARIO.length - 1][0];
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', '-movflags', '+faststart', OUT], { stdio: ['pipe', 'inherit', 'inherit'] });
  let si = -1;
  for (let f = 0; f <= total * FPS; f++) {
    const t = f / FPS;
    while (si + 1 < SCENARIO.length && SCENARIO[si + 1][0] <= t) {
      si++;
      const [, state, label] = SCENARIO[si];
      if (state) await page.evaluate((state, label) => {
        for (const id of ['a', 'b']) document.getElementById(id).contentWindow.uko.setState(state);
        document.getElementById('cap').textContent = label;
      }, state, label);
    }
    if (f) await page.evaluate(() => { for (const id of ['a', 'b']) document.getElementById(id).contentWindow.uko.step(1000 / 30); });
    const buf = await page.screenshot({ type: 'jpeg', quality: 88 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 300 === 0) process.stdout.write(`\r${t.toFixed(0)}/${total} s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  console.log(`\nwrote ${path.relative(process.cwd(), OUT)} (${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB)`);
})();
