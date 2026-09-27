#!/usr/bin/env node
// Checks the free download (dist/Uko-Starter-<version>.zip) the way a user would use it:
// unzip it, run its engine in a browser and its uko.riv in the official Rive runtime.
//   node test_and_deploy/test_starter_pack.cjs
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
let puppeteer;
try { puppeteer = require('puppeteer'); } catch (e) { puppeteer = require(path.join(__dirname, '..', '..', 'node_modules', 'puppeteer')); }

const ROOT = path.join(__dirname, '..');
const { version } = require(path.join(ROOT, 'mascot_engine', 'package.json'));
const ZIP = path.join(ROOT, 'mascot_engine', 'dist', `Uko-Starter-${version}.zip`);
const FREE = ['idle', 'welcome', 'loading', 'success'];
const PAID = ['thinking', 'error', 'empty', 'sleep', 'wake'];

const failures = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failures.push(msg); };

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'uko-starter-'));
  execFileSync('unzip', ['-q', ZIP, '-d', tmp]);
  const pack = path.join(tmp, `Uko-Starter-${version}`);
  for (const f of ['uko-mascot-engine.js', 'uko-mascot-engine.min.js', 'rive/uko.riv', 'README.md', 'LICENSE.md', 'AI-PROMPT.md', 'examples/web-component.html'])
    check(fs.existsSync(path.join(pack, f)), `zip contains ${f}`);
  check(!/\{\{[A-Z_]+\}\}/.test(fs.readFileSync(path.join(pack, 'README.md'), 'utf8')), 'README has no placeholder left');

  // /pack/* → the unzipped pack, /rive/* → the self-hosted Rive runtime of the site.
  const TYPES = { '.js': 'text/javascript', '.html': 'text/html', '.wasm': 'application/wasm', '.riv': 'application/octet-stream' };
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = url.startsWith('/pack/') ? path.join(pack, url.slice(6)) : url.startsWith('/rive/') ? path.join(ROOT, 'landing_page', url) : null;
    if (url === '/favicon.ico') { res.writeHead(204); return res.end(); }
    if (url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<!doctype html><meta charset="utf-8"><body></body>'); }
    if (!file || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  }).listen(0);
  const base = `http://localhost:${server.address().port}`;

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const errors = [], infos = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'info') infos.push(m.text()); });
  await page.goto(base + '/');
  // The minified engine: the file the README tells people to ship.
  await page.addScriptTag({ url: base + '/pack/uko-mascot-engine.min.js' });

  // ---- engine
  const api = await page.evaluate(() => ({ edition: UkoMascot.edition, order: UkoMascot.ORDER, hairs: Object.keys(UkoMascot.HAIR_STYLES) }));
  check(api.edition === 'starter', `engine edition = ${api.edition}`);
  check(JSON.stringify(api.order) === JSON.stringify(FREE), `engine states = ${api.order.join(', ')}`);
  check(api.hairs.length === 17, `all ${api.hairs.length} hairstyles available`);

  await page.evaluate(() => {
    document.body.innerHTML = '<div id="m" style="width:240px;height:360px"></div>';
    window.uko = UkoMascot.create('#m', { hairStyle: 'afro', brandColor: '#FFD6E0' });
  });
  for (const s of FREE) {
    const got = await page.evaluate(async s => { uko.setState(s); await new Promise(r => setTimeout(r, 700)); return uko.getState(); }, s);
    check(got === s, `plays ${s}`);
  }
  const flow = await page.evaluate(async () => {
    uko.setState('idle'); await new Promise(r => setTimeout(r, 500));
    uko.startLoading(); await new Promise(r => setTimeout(r, 600)); const a = uko.getState();
    uko.resolveSuccess(); await new Promise(r => setTimeout(r, 600)); return [a, uko.getState()];
  });
  check(flow[0] === 'loading' && flow[1] === 'success', `loading → success (${flow.join(' → ')})`);
  for (const s of PAID) {
    const r = await page.evaluate(async s => {
      const before = uko.getState();
      try { uko.setState(s); } catch (e) { return { threw: e.message }; }
      await new Promise(r => setTimeout(r, 100));
      return { before, after: uko.getState() };
    }, s);
    check(!r.threw && r.after === r.before, `full-pack state "${s}" is ignored without breaking (${r.threw || r.before + ' → ' + r.after})`);
  }
  check(PAID.every(s => infos.some(t => t.includes(`"${s}"`) && t.includes('pack complet'))), 'console says where to find full-pack states');
  const unknown = await page.evaluate(() => { try { uko.setState('dance'); return 'no error'; } catch (e) { return 'throws'; } });
  check(unknown === 'throws', 'a truly unknown state still throws (typos are caught)');

  const hairFail = await page.evaluate(async hairs => {
    const bad = [];
    for (const h of hairs) {
      uko.setHairStyle(h);
      await new Promise(r => setTimeout(r, 120));
      const svg = document.querySelector('#m svg');
      if (!svg || svg.querySelectorAll('path,ellipse,circle').length < 10) bad.push(h);
    }
    return bad;
  }, api.hairs);
  check(hairFail.length === 0, `every hairstyle renders${hairFail.length ? ' (bad: ' + hairFail.join(', ') + ')' : ''}`);
  await page.evaluate(() => uko.setHairStyle('tresses_plaquees'));
  await page.screenshot({ path: path.join(__dirname, 'output', 'starter-engine.png'), clip: { x: 0, y: 0, width: 260, height: 380 } }).catch(() => {});

  // ---- Rive
  await page.goto(base + '/');
  await page.evaluate(() => { document.body.innerHTML = '<canvas id="c" width="480" height="720" style="width:240px;height:360px"></canvas>'; });
  await page.addScriptTag({ url: base + '/rive/rive.js' });
  const rive = await page.evaluate(async () => {
    rive.RuntimeLoader.setWasmUrl('/rive/rive.wasm');
    return await new Promise((resolve) => {
      const r = new rive.Rive({
        src: '/pack/rive/uko.riv', canvas: document.getElementById('c'), stateMachines: 'Uko', autoplay: true, autoBind: true,
        onLoad: async () => {
          window.r = r;
          const inputs = r.stateMachineInputs('Uko').map(i => i.name);
          const get = n => r.stateMachineInputs('Uko').find(i => i.name === n);
          get('state').value = 2; await new Promise(res => setTimeout(res, 800));
          get('state').value = 0; get('success').fire(); await new Promise(res => setTimeout(res, 800));
          get('welcome').fire(); await new Promise(res => setTimeout(res, 800));
          r.viewModelInstance.color('bodyColor').value = 0xFFFFD6E0;
          await new Promise(res => setTimeout(res, 300));
          const ctx = document.createElement('canvas').getContext('2d');
          ctx.canvas.width = 480; ctx.canvas.height = 720; ctx.drawImage(document.getElementById('c'), 0, 0);
          const px = ctx.getImageData(0, 0, 480, 720).data;
          let ink = 0; for (let i = 3; i < px.length; i += 4) if (px[i] > 0) ink++;
          resolve({ inputs, ink, playing: r.playingStateMachineNames });
        },
        onLoadError: e => resolve({ error: String(e) })
      });
    });
  });
  check(!rive.error, `uko.riv loads in the official Rive runtime${rive.error ? ' (' + rive.error + ')' : ''}`);
  check(JSON.stringify(rive.inputs) === JSON.stringify(['state', 'welcome', 'success']), `Rive inputs = ${rive.inputs}`);
  check(rive.ink > 20000, `Rive draws Uko (${rive.ink} px)`);
  check((rive.playing || []).includes('Uko'), 'state machine "Uko" is playing');
  await page.screenshot({ path: path.join(__dirname, 'output', 'starter-rive.png'), clip: { x: 0, y: 0, width: 260, height: 380 } }).catch(() => {});

  check(errors.length === 0, `no page error${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close();
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(failures.length ? `\n${failures.length} FAIL` : '\nALL PASS');
  process.exit(failures.length ? 1 : 0);
})();
