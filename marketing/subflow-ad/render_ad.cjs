#!/usr/bin/env node
// Renders the ad composition frame by frame and encodes it with ffmpeg.
//   python3 -m http.server 3340   (from UKO_MASTER_PACK/)
//   node marketing/subflow-ad/render_ad.cjs --lang fr          → out/uko-subflow-ad-9x16-fr.mp4
//   node marketing/subflow-ad/render_ad.cjs --lang en --cues   → out/cues-en.json (for audio.cjs en)
//   node marketing/subflow-ad/render_ad.cjs --stills 1,8,17   → out/still-<t>.png
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
let puppeteer;
try { puppeteer = require('puppeteer'); } catch (e) { puppeteer = require(path.join(__dirname, '..', '..', '..', 'node_modules', 'puppeteer')); }

const argv0 = process.argv.slice(2);
const LANG = argv0.includes('--lang') ? argv0[argv0.indexOf('--lang') + 1] : 'fr';
const URL = (process.env.AD_URL || 'http://localhost:3340/marketing/subflow-ad/compose/index.html') + '?lang=' + LANG;
const OUT = path.join(__dirname, 'out');
const FPS = +(process.env.AD_FPS || 30);
const argv = process.argv.slice(2);
const stillsArg = argv.includes('--stills') ? argv[argv.indexOf('--stills') + 1] : null;
const audio = path.join(OUT, `soundtrack-${LANG}.wav`);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  await page.goto(URL, { waitUntil: 'load' });
  const info = await page.evaluate(() => window.adReady);
  fs.writeFileSync(path.join(OUT, `cues-${LANG}.json`), JSON.stringify({ duration: info.duration, cues: await page.evaluate(() => window.adAudioCues) }, null, 1));
  if (argv.includes('--cues')) { await browser.close(); console.log('cues written'); return; }
  console.log(`duration ${info.duration.toFixed(2)} s · scenes ${Object.values(info.scenes).map(s => `${s.name}@${s.start.toFixed(1)}`).join(' ')}`);

  if (stillsArg) {
    const times = stillsArg.split(',').map(Number).sort((a, b) => a - b);
    // Step through time so the Uko engines reach each still naturally.
    let t = 0;
    for (const target of times) {
      for (; t < target; t = Math.min(target, t + 1 / FPS)) await page.evaluate(x => window.renderAt(x), t);
      await page.evaluate(x => window.renderAt(x), target);
      await page.screenshot({ path: path.join(OUT, `still-${LANG}-${target.toFixed(1)}.png`) });
      console.log('still', target);
    }
  } else {
    const frames = Math.ceil(info.duration * FPS);
    const file = path.join(OUT, `uko-subflow-ad-9x16-${LANG}.mp4`);
    const args = ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-'];
    if (fs.existsSync(audio)) args.push('-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest');
    args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(FPS), file);
    const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'pipe'] });
    let ffErr = ''; ff.stderr.on('data', d => { ffErr = (ffErr + d).slice(-2000); });
    const t0 = Date.now();
    for (let i = 0; i < frames; i++) {
      await page.evaluate(x => window.renderAt(x), i / FPS);
      const buf = await page.screenshot({ type: 'jpeg', quality: 95, optimizeForSpeed: true });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 150 === 0) console.log(`frame ${i}/${frames} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
    ff.stdin.end();
    const code = await new Promise(r => ff.on('close', r));
    if (code !== 0) { console.error(ffErr); process.exit(1); }
    console.log(`wrote ${path.relative(process.cwd(), file)} (${(fs.statSync(file).size / 1048576).toFixed(1)} MB)`);
  }
  if (errors.length) console.log('page errors:', errors.slice(0, 5));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
