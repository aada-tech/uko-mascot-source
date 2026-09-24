#!/usr/bin/env node
// Plays uko.riv's "Uko" state machine in the official Rive web runtime, in real time,
// and checks what a developer would see: the inputs exist, idle / thinking / loading /
// sleep keep chaining gestures, and success / error / wake come back to idle.
//   node test_and_deploy/test_rive_state_machine.cjs [--riv path] [--starter]
const fs = require('fs');
const path = require('path');
const http = require('http');
let puppeteer;
try { puppeteer = require('puppeteer'); } catch (e) { puppeteer = require(path.join(__dirname, '..', '..', 'node_modules', 'puppeteer')); }

const ROOT = path.join(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const STARTER = process.argv.includes('--starter');
const RIV = arg('--riv', path.join(ROOT, STARTER ? 'mascot_engine/dist/starter/uko-starter.riv' : 'mascot_engine/dist/uko.riv'));
const failures = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failures.push(msg); };

(async () => {
  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    const map = { '/uko.riv': RIV, '/rive.js': path.join(ROOT, 'landing_page/rive/rive.js'), '/rive.wasm': path.join(ROOT, 'landing_page/rive/rive.wasm') };
    if (url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<!doctype html><body style="margin:0"><canvas id="c" width="300" height="450"></canvas></body>'); }
    if (!map[url]) { res.writeHead(url === '/favicon.ico' ? 204 : 404); return res.end(); }
    res.writeHead(200, { 'content-type': url.endsWith('.wasm') ? 'application/wasm' : url.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' });
    fs.createReadStream(map[url]).pipe(res);
  }).listen(0);
  const base = `http://localhost:${server.address().port}`;
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base + '/');
  await page.addScriptTag({ url: base + '/rive.js' });
  const inputs = await page.evaluate(() => new Promise(resolve => {
    rive.RuntimeLoader.setWasmUrl('/rive.wasm');
    window.seen = [];
    window.r = new rive.Rive({
      src: '/uko.riv', canvas: document.getElementById('c'), stateMachines: 'Uko', autoplay: true, autoBind: true,
      onStateChange: e => { for (const s of e.data) window.seen.push([performance.now(), s]); },
      onLoad: () => resolve(r.stateMachineInputs('Uko').map(i => i.name)),
      onLoadError: e => resolve({ error: String(e) })
    });
  }));
  check(Array.isArray(inputs), `loads in the Rive runtime${inputs.error ? ' (' + inputs.error + ')' : ''}`);
  const want = STARTER ? ['state', 'welcome', 'success'] : ['state', 'welcome', 'success', 'error', 'empty'];
  check(JSON.stringify(inputs) === JSON.stringify(want), `inputs = ${inputs}`);

  const since = async (ms, fn) => { const t0 = await page.evaluate(() => performance.now()); if (fn) await page.evaluate(fn); await new Promise(r => setTimeout(r, ms)); return page.evaluate(t0 => window.seen.filter(([t]) => t >= t0).map(([, s]) => s), t0); };
  const set = v => `() => r.stateMachineInputs('Uko').find(i => i.name === 'state').value = ${v}`;
  const fire = n => `() => r.stateMachineInputs('Uko').find(i => i.name === '${n}').fire()`;

  let s = await since(7000);
  check(s.some(x => /^Idle[A-Z]/.test(x)), `idle chains a gesture within 7 s (${s.join(' → ')})`);
  if (!STARTER) {
    s = await since(6500, new Function(`return (${set(1)})()`));
    check(s.includes('ThinkingEnter') && s.some(x => /^Think[A-Z]/.test(x) && x !== 'ThinkingEnter'), `thinking enters then gestures (${s.join(' → ')})`);
    s = await since(1500, new Function(`return (${set(0)})()`));
    check(s.includes('ThinkingExit'), `thinking exits to idle (${s.join(' → ')})`);
  }
  s = await since(7000, new Function(`return (${set(2)})()`));
  check(s.includes('LoadingEnter') && s.some(x => /^Load[A-Z]/.test(x)), `loading enters then gestures (${s.join(' → ')})`);
  s = await since(5000, new Function(`r.stateMachineInputs('Uko').find(i => i.name === 'state').value = 0; r.stateMachineInputs('Uko').find(i => i.name === 'success').fire();`));
  check(s[0] === 'LoadingToSuccess' && s.includes('Success') && s.includes('Idle'), `loading → success → idle (${s.join(' → ')})`);
  if (!STARTER) {
    await since(2500, new Function(`return (${set(2)})()`));
    s = await since(5500, new Function(`r.stateMachineInputs('Uko').find(i => i.name === 'state').value = 0; r.stateMachineInputs('Uko').find(i => i.name === 'error').fire();`));
    check(s[0] === 'LoadingToError' && s.includes('Error') && s.includes('Idle'), `loading → error → idle (${s.join(' → ')})`);
    s = await since(10000, new Function(`return (${set(3)})()`));
    check(s.includes('SleepEnter') && s.includes('Sleep'), `sleep enters and loops (${s.join(' → ')})`);
    s = await since(3500, new Function(`return (${set(0)})()`));
    check(s.includes('Wake') && s.includes('Idle'), `wake returns to idle (${s.join(' → ')})`);
  }
  s = await since(4500, new Function(`return (${fire('welcome')})()`));
  check(s.includes('Welcome') && s.includes('Idle'), `welcome plays and returns (${s.join(' → ')})`);
  if (process.argv.includes('--stress')) {
    // Success fired at random moments of loading (including mid-mix): always caught.
    let ok = 0;
    for (let i = 0; i < 10; i++) {
      await since(1200 + Math.random() * 5000, new Function(`return (${set(2)})()`));
      s = await since(700, new Function(`r.stateMachineInputs('Uko').find(i => i.name === 'state').value = 0; r.stateMachineInputs('Uko').find(i => i.name === 'success').fire();`));
      if (s[0] === 'LoadingToSuccess') ok++; else console.log('   missed:', s.join(' → '));
      await since(4200);
    }
    check(ok === 10, `stress: success caught ${ok}/10 times at random moments`);
  }
  const drawn = await page.evaluate(() => { const c = document.getElementById('c'), x = document.createElement('canvas'); x.width = c.width; x.height = c.height; const g = x.getContext('2d'); g.drawImage(c, 0, 0); const d = g.getImageData(0, 0, x.width, x.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; });
  check(drawn > 10000, `draws Uko (${drawn} px)`);
  check(errors.length === 0, `no runtime error${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close(); server.close();
  console.log(failures.length ? `\n${failures.length} FAIL` : '\nALL PASS');
  process.exit(failures.length ? 1 : 0);
})();
