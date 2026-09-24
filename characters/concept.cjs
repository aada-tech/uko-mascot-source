#!/usr/bin/env node
// Boards for the Uko family, drawn by the engine itself (character option):
//   concept-board.png   every state, one row per character
//   celebration.png     the success jump frame by frame, Uko as the reference
//   node mascot_engine/build_mascot_engine.js --debug && node characters/concept.cjs
const path = require('path');
let puppeteer;
try { puppeteer = require('puppeteer'); } catch (e) { puppeteer = require(path.join(__dirname, '..', '..', 'node_modules', 'puppeteer')); }

const ENGINE = path.join(__dirname, '..', 'mascot_engine', 'dist', 'uko-mascot-engine.debug.js');
const ROWS = [
  ['Uko', { character: 'uko', hairStyle: 'original' }],
  ['Aituko', { character: 'aituko' }],
  ['Aituko · marque', { character: 'aituko', brandColor: '#DDE3FF', accentColor: '#3B5BFF' }],
  ['Meowuko', { character: 'meowuko' }],
  ['Meowuko · marque', { character: 'meowuko', brandColor: '#FFD9B3' }]
];
const STATES = [['idle', 1500], ['welcome', 1100], ['thinking', 4000], ['loading', 2500], ['success', 1250],
  ['error', 1600], ['empty', 1500], ['sleep', 2400]];
const JUMP = [300, 700, 1000, 1250, 1900, 2300, 2900];

async function board(page, file, rows, cols, W, H) {
  await page.setViewport({ width: 200 + W * cols.length, height: 40 + H * rows.length, deviceScaleFactor: 1.5 });
  await page.setContent(`<html><body style="margin:0;background:#F4F7FF;font:700 20px system-ui;color:#16161D">
    <div id="g" style="display:grid;grid-template-columns:200px repeat(${cols.length},${W}px)"></div></body></html>`);
  await page.addScriptTag({ path: ENGINE });
  await page.evaluate((rows, cols, W, H) => {
    const g = document.getElementById('g');
    const cell = (html, css) => { const d = document.createElement('div'); d.style.cssText = css; d.innerHTML = html; g.appendChild(d); return d; };
    cell('', 'height:40px');
    for (const [label] of cols) cell(label, `height:40px;display:flex;align-items:end;justify-content:center;font-weight:500;font-size:16px;color:#555`);
    for (const [name, o] of rows) {
      cell(name, `height:${H}px;display:flex;align-items:center;padding-left:20px`);
      for (const [, state, ms] of cols) {
        const c = cell('', `width:${W}px;height:${H}px`);
        const m = UkoMascot.create(c, Object.assign({ interactive: false, theme: 'light', oneShotMode: 'loop' }, o));
        m.pause(); m._debug().life({ auto: false }); m.step(0);
        if (state !== 'idle') m.setState(state);
        for (let t = 0; t < ms; t += 1000 / 60) m.step(1000 / 60);
      }
    }
  }, rows, cols, W, H);
  await page.screenshot({ path: path.join(__dirname, file), fullPage: true });
  console.log('wrote characters/' + file);
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await board(page, 'concept-board.png', ROWS, STATES.map(([s, ms]) => [s, s, ms]), 220, 330);
  await board(page, 'celebration.png', [ROWS[0], ROWS[1], ROWS[3]], JUMP.map(ms => [`${(ms / 1000).toFixed(2)} s`, 'success', ms]), 220, 330);
  await browser.close();
})();
