#!/usr/bin/env node
// Rive vs engine parity: renders the same instants of every clip with the official
// Rive web runtime (uko.riv) and with the engine (debug build, same recipe as the
// baking), then compares the drawings (IoU of the ink = dark pixels, after a 1 px
// tolerance dilation). Writes a side-by-side sheet per clip.
//   node test_and_deploy/test_rive_parity.cjs [--character aituko|meowuko] [--riv path] [--clips Idle,Success] [--step 0.5]
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
let puppeteer;
try { puppeteer = require('puppeteer'); } catch (e) { puppeteer = require(path.join(__dirname, '..', '..', 'node_modules', 'puppeteer')); }

const ROOT = path.join(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const CHARACTER = arg('--character', 'uko');
const RIV = arg('--riv', path.join(ROOT, `mascot_engine/dist/${CHARACTER}.riv`));
const ENGINE = path.join(ROOT, 'mascot_engine/dist/uko-mascot-engine.debug.js');
const OUT = arg('--out', path.join(__dirname, 'output', CHARACTER === 'uko' ? 'rive-parity' : `rive-parity-${CHARACTER}`));
const STEP = +arg('--step', 0.5);
const { CLIPS, RATES } = require(path.join(ROOT, 'mascot_engine/rive/clips.cjs'));
const manifest = JSON.parse(fs.readFileSync(RIV + '.json', 'utf8'));
const inFile = new Set(manifest.animations.map(a => a.name));
const ONLY = arg('--clips', '').split(',').filter(Boolean);
const clips = CLIPS.filter(c => inFile.has(c.name) && (!ONLY.length || ONLY.includes(c.name)));
const W = 256, H = 384;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const map = { '/uko.riv': RIV, '/rive.js': path.join(ROOT, 'landing_page/rive/rive.js'), '/rive.wasm': path.join(ROOT, 'landing_page/rive/rive.wasm'), '/engine.js': ENGINE };
    if (url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><body style="margin:0;background:#fff;display:flex"><div id="a" style="width:${W}px;height:${H}px"></div><canvas id="c" width="${W}" height="${H}" style="width:${W}px;height:${H}px"></canvas></body>`); }
    if (!map[url]) { res.writeHead(url === '/favicon.ico' ? 204 : 404); return res.end(); }
    res.writeHead(200, { 'content-type': url.endsWith('.wasm') ? 'application/wasm' : url.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' });
    fs.createReadStream(map[url]).pipe(res);
  }).listen(0);
  const base = `http://localhost:${server.address().port}`;
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewport({ width: W * 2, height: H, deviceScaleFactor: 1 });
  await page.goto(base + '/');
  await page.addScriptTag({ url: base + '/engine.js' });
  await page.addScriptTag({ url: base + '/rive.js' });
  const loaded = await page.evaluate((ARTBOARD) => new Promise(resolve => {
    rive.RuntimeLoader.setWasmUrl('/rive.wasm');
    window.r = new rive.Rive({ src: '/uko.riv', canvas: document.getElementById('c'), autoplay: false, artboard: ARTBOARD, onLoad: () => resolve(true), onLoadError: e => resolve(String(e)) });
  }), manifest.artboard || 'Uko');
  if (loaded !== true) { console.error('Rive load failed:', loaded); process.exit(1); }

  const results = [];
  for (const clip of clips) {
    const dur = manifest.animations.find(a => a.name === clip.name).seconds;
    const times = []; for (let t = 0; t <= dur + 1e-6; t += STEP) times.push(+t.toFixed(3));
    // Engine: same recipe as the baking, snapshots at the sample times.
    await page.evaluate((clip, RATES, character) => {
      document.getElementById('a').innerHTML = '';
      const m = UkoMascot.create('#a', { interactive: false, hairStyle: 'original', character });
      window.m = m; m.pause(); m._debug().life({ auto: false, bake: RATES[clip.base] || null }); m.step(0);
      const dt = 1000 / 60, dbg = () => m._debug().frame, run = ms => { for (let t = 0; t < ms - 1e-6; t += dt) m.step(dt); };
      for (const [op, a] of clip.pre) {
        if (op === 'wait') run(a); else if (op === 'state') m.setState(a); else if (op === 'wake') m.wake();
        else if (op === 'until') { let n = 0; while (!dbg().entered && n++ < 1200) m.step(dt); }
        else if (op === 'beat') m._debug().beat(a, clip.pre.find(x => x[0] === 'beat')[2]);
      }
      window.engineT = 0;
    }, clip, RATES, CHARACTER);
    const scores = [];
    for (const t of times) {
      await page.evaluate((t, name) => {
        const dt = 1000 / 60; while (window.engineT < t * 1000 - 1e-6) { m.step(dt); window.engineT += dt; }
        r.stop(); r.play(name); r.pause(name); r.scrub(name, t);
      }, t, clip.name);
      await new Promise(res => setTimeout(res, 30));
      const png = await page.screenshot({ type: 'png' });
      const f = path.join(OUT, `${clip.name}_${String(Math.round(t * 1000)).padStart(5, '0')}.png`);
      fs.writeFileSync(f, png);
      scores.push(f);
    }
    results.push({ clip: clip.name, files: scores });
  }
  await browser.close(); server.close();
  // Compare in Python (PIL): IoU of dark pixels with 1 px tolerance.
  const py = `
import json,sys
from PIL import Image, ImageFilter
res=json.loads(sys.argv[1]); out={}
for r in res:
  ious=[]
  for f in r['files']:
    im=Image.open(f).convert('L'); w,h=im.size; a=im.crop((0,0,w//2,h)); b=im.crop((w//2,0,w,h))
    ma=a.point(lambda v:255 if v<110 else 0); mb=b.point(lambda v:255 if v<110 else 0)
    da=ma.filter(ImageFilter.MaxFilter(3)); db=mb.filter(ImageFilter.MaxFilter(3))
    A=list(ma.getdata()); B=list(mb.getdata()); DA=list(da.getdata()); DB=list(db.getdata())
    inter=sum(1 for x,y in zip(A,DB) if x and y)+sum(1 for x,y in zip(B,DA) if x and y)
    tot=sum(1 for x in A if x)+sum(1 for x in B if x)
    ious.append(inter/tot if tot else 1)
  out[r['clip']]=[round(min(ious),3),round(sum(ious)/len(ious),3)]
  sheet=Image.new('RGB',(len(r['files'])*${W},${H}),'white')
  for i,f in enumerate(r['files']):
    im=Image.open(f).convert('RGB'); w,h=im.size
    a=im.crop((0,0,w//2,h)); b=im.crop((w//2,0,w,h))
    # overlay: engine in red, rive in blue
    ov=Image.new('RGB',(w//2,h),'white'); pa=a.load(); pb=b.load(); po=ov.load()
    for y in range(h):
      for x in range(w//2):
        ea=sum(pa[x,y])<330; eb=sum(pb[x,y])<330
        po[x,y]=(40,40,40) if ea and eb else (230,60,60) if ea else (60,90,230) if eb else (255,255,255)
    sheet.paste(ov,(i*${W},0))
  sheet.save('${OUT}/sheet_'+r['clip']+'.png')
print(json.dumps(out))`;
  const scores = JSON.parse(execFileSync('python3', ['-c', py, JSON.stringify(results)]).toString());
  let worst = 1, sum = 0, n = 0;
  for (const [c, [min, mean]] of Object.entries(scores)) { console.log(`${c.padEnd(17)} IoU min ${min.toFixed(3)} · mean ${mean.toFixed(3)}`); worst = Math.min(worst, min); sum += mean; n++; }
  console.log(`\nall clips: mean IoU ${(sum / n).toFixed(3)}, worst frame ${worst.toFixed(3)}${errors.length ? ' · page errors: ' + errors.join(' | ') : ''}`);
  fs.writeFileSync(path.join(OUT, 'scores.json'), JSON.stringify(scores, null, 2));
})();
