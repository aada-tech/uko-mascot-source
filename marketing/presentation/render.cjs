#!/usr/bin/env node
// Renders the 16:9 presentation video (YouTube) and its thumbnail, per language.
//   npm run build:engine
//   node marketing/presentation/render.cjs [fr en es] [--site uko-mascot.pages.dev] [--stills 3,9,18,30,38]
// → marketing/presentation/out/uko-presentation-<lang>.mp4 (1920×1080, 30 fps, H.264 + AAC)
//   marketing/presentation/out/uko-thumbnail-<lang>.jpg (1280×720)
// Needs ffmpeg (FFMPEG=/path/to/ffmpeg if it is not on the PATH). The SubFlow clip
// comes from landing_page/media/uko-custom-<lang>.mp4 (filmed in the real app).
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, execFileSync } = require('child_process');
let puppeteer;
try { puppeteer = require('puppeteer'); } catch (e) { puppeteer = require(path.join(__dirname, '..', '..', 'node_modules', 'puppeteer')); }
const { soundtrack } = require('./audio.cjs');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(__dirname, 'out');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const FPS = 30;
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const LANGS = args.filter(a => /^(fr|en|es)$/.test(a));
const SITE = opt('--site') || (process.env.UKO_SITE_URL || 'https://uko-mascot.pages.dev').replace(/^https?:\/\//, '').replace(/\/$/, '');
const STILLS = opt('--stills');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.css': 'text/css' };
function serve(framesDir) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = url.startsWith('/frames/') ? path.join(framesDir, url.slice(8)) : path.join(ROOT, url);
    if (!file.startsWith(ROOT) && !file.startsWith(framesDir)) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  }).listen(0);
  return server;
}

async function renderLang(browser, lang) {
  const frames = fs.mkdtempSync(path.join(os.tmpdir(), `uko-pres-${lang}-`));
  const clip = path.join(ROOT, 'landing_page', 'media', `uko-custom-${lang}.mp4`);
  execFileSync(FFMPEG, ['-loglevel', 'error', '-i', clip, '-vf', `fps=${FPS}`, '-q:v', '3', path.join(frames, '%05d.jpg')]);
  const clipFrames = fs.readdirSync(frames).filter(f => f.endsWith('.jpg')).length;
  const server = serve(frames);
  const base = `http://localhost:${server.address().port}/marketing/presentation/compose/index.html?lang=${lang}&site=${encodeURIComponent(SITE)}`;
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

  // Thumbnail
  await page.goto(base + '&thumb=1', { waitUntil: 'load' });
  await page.evaluate(() => window.presReady);
  await page.evaluate(() => window.renderThumb());
  const thumbPng = path.join(frames, 'thumb.png');
  await page.screenshot({ path: thumbPng });
  const thumb = path.join(OUT, `uko-thumbnail-${lang}.jpg`);
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', thumbPng, '-vf', 'scale=1280:720:flags=lanczos', '-q:v', '2', thumb]);

  // Video
  await page.goto(`${base}&frames=${clipFrames}`, { waitUntil: 'load' });
  const { duration, cues } = await page.evaluate(() => window.presReady);
  if (STILLS) {
    const times = STILLS.split(',').map(Number).sort((a, b) => a - b);
    let t = 0;
    for (const target of times) {
      for (; t < target; t = Math.min(target, t + 1 / FPS)) await page.evaluate(x => window.renderAt(x), t);
      await page.evaluate(x => window.renderAt(x), target);
      await page.screenshot({ path: path.join(OUT, `still-${lang}-${target}.jpg`), type: 'jpeg', quality: 85 });
    }
    console.log(`${lang}: stills ${times.join(', ')}`);
  } else {
    const wav = path.join(frames, 'soundtrack.wav');
    fs.writeFileSync(wav, soundtrack(duration, cues));
    const file = path.join(OUT, `uko-presentation-${lang}.mp4`);
    const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-i', wav,
      '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS),
      '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`))));
    const total = Math.ceil(duration * FPS);
    for (let i = 0; i < total; i++) {
      await page.evaluate(x => window.renderAt(x), i / FPS);
      const jpg = await page.screenshot({ type: 'jpeg', quality: 94 });
      if (!ff.stdin.write(jpg)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 150 === 0) process.stdout.write(`${lang} ${(i / FPS).toFixed(0)}s `);
    }
    ff.stdin.end();
    await done;
    console.log(`\n${path.relative(ROOT, file)}  ${(fs.statSync(file).size / 1024 / 1024).toFixed(1)} MB · ${duration} s`);
  }
  console.log(`${path.relative(ROOT, thumb)}  ${(fs.statSync(thumb).size / 1024).toFixed(0)} KB`);
  if (errors.length) console.log(`${lang}: page errors: ${errors.join(' | ')}`);
  await page.close();
  server.close();
  fs.rmSync(frames, { recursive: true, force: true });
}

(async () => {
  if (!fs.existsSync(path.join(ROOT, 'mascot_engine', 'dist', 'uko-mascot-engine.min.js'))) { console.error('run npm run build:engine first'); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: 'new' });
  for (const lang of LANGS.length ? LANGS : ['fr', 'en', 'es']) await renderLang(browser, lang);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
