// Media of the public showcase repository (github.com/fnnktkygl-code/uko-mascot),
// rendered from the real engine: frames stepped on the engine's clock (deterministic
// timing), then encoded to GIF / PNG with ffmpeg.
//   npm run build:engine
//   node marketing/github/make_media.cjs <out dir> [only]
//   only: hero | states | touch | gaze | climb | family | hair | subflow
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..', '..');
const ENGINE = path.join(ROOT, 'mascot_engine', 'dist', 'uko-mascot-engine.js');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'marketing', 'github', 'out'));
const ONLY = process.argv[3];
const TMP = path.join(OUT, '.frames');
fs.mkdirSync(OUT, { recursive: true });

const PAPER = '#F4F7FF', INK = '#16161D';
const page = (w, h, body, css = '') => `<!doctype html><html><head><style>
  html,body{margin:0;background:${PAPER};width:${w}px;height:${h}px;overflow:hidden;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:${INK}}
  .m{position:absolute}
  .lab{position:absolute;font:600 14px ui-monospace,SFMono-Regular,Menlo,monospace;color:#4B4E63;text-align:center}
  .cap{position:absolute;left:0;right:0;bottom:14px;text-align:center;font:600 15px ui-monospace,SFMono-Regular,Menlo,monospace}
  .cap span{background:#fff;border:2px solid ${INK};border-radius:10px;padding:5px 10px;box-shadow:3px 3px 0 ${INK}}
  ${css}</style></head><body>${body}</body></html>`;

function gif(dir, fps, out, width, colors = 128) {
  const pal = path.join(dir, 'palette.png');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(dir, 'f_%04d.png'),
    '-vf', `scale=${width}:-1:flags=lanczos,palettegen=max_colors=${colors}:stats_mode=diff`, pal]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(dir, 'f_%04d.png'), '-i', pal,
    '-lavfi', `scale=${width}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`, '-loop', '0', out]);
  console.log(path.relative(process.cwd(), out), (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
}

// Renders a scene: setup(page) once, then tick(t) before each frame (t in s).
async function scene(browser, name, { w, h, html, fps = 20, dur, setup, tick, width, colors }) {
  if (ONLY && ONLY !== name) return;
  const dir = path.join(TMP, name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
  await p.setContent(html);
  await p.addScriptTag({ path: ENGINE });
  await p.evaluate(setup);
  const n = Math.round(dur * fps);
  for (let i = 0; i < n; i++) {
    await p.evaluate(tick, i / fps, 1000 / fps);
    await p.screenshot({ path: path.join(dir, `f_${String(i).padStart(4, '0')}.png`) });
  }
  await p.close();
  gif(dir, fps, path.join(OUT, `${name}.gif`), width || w, colors);
}

// Shared page helpers (inside the page): M = mascots, step all of them.
const HELPERS = `
  window.M = [];
  window.make = (sel, o) => { const u = UkoMascot.create(sel, Object.assign({ interactive: false }, o)); u.pause(); M.push(u); return u; };
  window.stepAll = ms => M.forEach(u => u.step(ms));
  window.at = (t, s, f) => { const k = '_' + s; if (t >= s && !window[k]) { window[k] = 1; f(); } };
`;

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });

  // Hero: the three wave, then celebrate together.
  await scene(browser, 'hero', {
    w: 720, h: 330, dur: 8.4, width: 720,
    html: page(720, 330, `<div id=a class=m style="left:40px;top:10px;width:210px;height:315px"></div><div id=b class=m style="left:255px;top:10px;width:210px;height:315px"></div><div id=c class=m style="left:470px;top:10px;width:210px;height:315px"></div>`),
    setup: new Function(HELPERS + `
      make('#a', { character: 'aituko', brandColor: '#DDE3FF', accentColor: '#FFC93C' });
      make('#b', { hairStyle: 'boucles', hairColor: '#3A2418', brandColor: '#FFE3C4' });
      make('#c', { character: 'meowuko', brandColor: '#FFD9B3' });
      stepAll(600);`),
    tick: new Function('t', 'dt', `
      at(t, .5, () => M[1].setState('welcome')); at(t, .8, () => M[0].setState('welcome')); at(t, 1.1, () => M[2].setState('welcome'));
      at(t, 4.6, () => M.forEach(u => u.setState('success')));
      stepAll(dt);`)
  });

  // The nine states, Uko.
  const S = ['idle', 'welcome', 'thinking', 'loading', 'success', 'error', 'empty', 'sleep', 'wake'];
  await scene(browser, 'states', {
    w: 720, h: 520, dur: 4, fps: 15, width: 720, colors: 96,
    html: page(720, 520, S.map((s, i) => `<div id=s${i} class=m style="left:${(i % 5) * 144 + (i >= 5 ? 72 : 0)}px;top:${Math.floor(i / 5) * 258 + 6}px;width:144px;height:216px"></div><div class=lab style="left:${(i % 5) * 144 + (i >= 5 ? 72 : 0)}px;width:144px;top:${Math.floor(i / 5) * 258 + 224}px">${s}</div>`).join('')),
    setup: new Function(HELPERS + `
      const S = ${JSON.stringify(S)};
      S.forEach((s, i) => { const u = make('#s' + i, { hairStyle: ['original', 'afro', 'ondule', 'dreadlocks', 'chignon', 'tresses', 'degrade', 'queue_de_cheval', 'boucles'][i], hairColor: ['#1B1B1F', '#3A2418', '#B03A2E', '#1B1B1F', '#6B3F2A', '#1B1B1F', '#3A2418', '#D9962B', '#1B1B1F'][i], brandColor: ['#FFFFFF', '#FFE3C4', '#C9F2E1', '#FFE8A3', '#FFD6E0', '#FFFFFF', '#DDE3FF', '#FFE3C4', '#FFFFFF'][i], oneShotMode: 'loop' }); if (s === 'wake') { u.setState('sleep'); u.step(2600); } u.setState(s); });
      stepAll(400);`),
    tick: new Function('t', 'dt', `stepAll(dt);`)
  });

  // Touch: each zone reacts; taps in a row escalate.
  const POKES = [[.4, 'head', 'giggle', "uko.poke('head')"], [2.1, 'hand', 'highFive', "uko.poke('hand')"], [3.8, 'foot', 'hop', "uko.poke('foot')"],
    [5.4, 'body', 'shimmy', "uko.poke('body')"], [7.2, 'head', 'dizzy', '3 taps on the head'], [9.5, 'body', 'joy', '5 taps: jump for joy']];
  await scene(browser, 'touch', {
    w: 420, h: 440, dur: 11.4, width: 420,
    html: page(420, 440, `<div id=m class=m style="left:105px;top:40px;width:210px;height:315px"></div><div id=f style="position:absolute;width:40px;height:40px;border-radius:50%;border:3px solid ${INK};background:rgba(255,201,60,.55);margin:-20px 0 0 -20px;opacity:0;transition:none"></div><div class=cap><span id=cap>tap it</span></div>`),
    setup: new Function(HELPERS + `window.u = make('#m', { hairStyle: 'afro', hairColor: '#1B1B1F', brandColor: '#FFC93C' }); stepAll(500);
      window.P = ${JSON.stringify(POKES)};`),
    tick: new Function('t', 'dt', `
      for (const [s, zone, r, label] of P) at(t, s, () => { u.poke(zone, r); document.getElementById('cap').textContent = label; window.tap = { t0: t, zone }; });
      stepAll(dt);
      const f = document.getElementById('f'), T = window.tap;
      if (T && t - T.t0 < .45) {
        const pose = u.getPose(), svg = document.querySelector('#m svg').getBoundingClientRect();
        const pt = T.zone === 'head' ? pose.head_center : T.zone === 'hand' ? pose.hand_R_center : T.zone === 'foot' ? pose.foot_R_center : [(pose.neck[0] + pose.pelvis[0]) / 2, (pose.neck[1] + pose.pelvis[1]) / 2];
        f.style.left = (svg.left + pt[0] * svg.width / 1024) + 'px'; f.style.top = (svg.top + pt[1] * svg.height / 1536) + 'px';
        const k = (t - T.t0) / .45; f.style.opacity = String(1 - k); f.style.transform = 'scale(' + (0.6 + k) + ')';
      } else f.style.opacity = '0';`)
  });

  // Gaze: a ball travels all around; the body turns towards it, turns round, a hand reaches out.
  await scene(browser, 'gaze', {
    w: 560, h: 400, dur: 8, width: 560,
    html: page(560, 400, `<div id=m class=m style="left:190px;top:50px;width:180px;height:270px"></div><div id=ball style="position:absolute;width:30px;height:30px;border-radius:50%;background:#FFC93C;border:3px solid ${INK};margin:-15px 0 0 -15px;box-shadow:2px 2px 0 ${INK}"></div><div class=cap><span>uko.lookAt(ball)</span></div>`),
    setup: new Function(HELPERS + `window.u = make('#m', { character: 'meowuko', brandColor: '#FFD9B3' }); stepAll(400); u.lookAt(document.getElementById('ball'));`),
    tick: new Function('t', 'dt', `
      // Right → up → left → low right → near the right hand → rest.
      const K = [[0, 520, 150], [1.4, 470, 60], [2.6, 280, 30], [3.8, 60, 120], [5, 120, 330], [6.2, 470, 300], [7, 355, 150], [8, 520, 150]];
      let i = 0; while (i < K.length - 2 && t > K[i + 1][0]) i++;
      const a = K[i], b = K[i + 1], k = Math.min(1, (t - a[0]) / (b[0] - a[0])), e = k * k * (3 - 2 * k);
      const ball = document.getElementById('ball'); ball.style.left = (a[1] + (b[1] - a[1]) * e) + 'px'; ball.style.top = (a[2] + (b[2] - a[2]) * e) + 'px';
      stepAll(dt);`)
  });

  // Climbing onto a box (climb({ onto })) — the box is drawn in front of the mascot.
  await scene(browser, 'climb', {
    w: 380, h: 440, dur: 5.2, width: 380,
    html: page(380, 440, `<div id=m class=m style="left:95px;top:118px;width:190px;height:285px"></div>
      <div style="position:absolute;z-index:2;left:112px;width:156px;top:${118 + 261 - 96}px;height:96px;background:#6C8BFF;border:3px solid ${INK};border-radius:4px;box-sizing:border-box"><div style="position:absolute;left:64px;top:0;bottom:0;width:22px;background:#FF7AAE;border-left:3px solid ${INK};border-right:3px solid ${INK}"></div></div>
      <div style="position:absolute;left:0;right:0;top:${118 + 261}px;height:3px;background:${INK}"></div><div class=cap style="bottom:10px"><span>uko.climb({ onto: box })</span></div>`),
    setup: new Function(HELPERS + `window.u = make('#m', { hairStyle: 'queue_de_cheval', hairColor: '#B03A2E', brandColor: '#FFE8A3' }); stepAll(400);`),
    tick: new Function('t', 'dt', `
      at(t, .5, () => u.climb({ onto: 96 / 285, onDone: () => { document.getElementById('m').style.top = (118 - 96) + 'px'; } }));
      at(t, 3.6, () => u.setState('success'));
      stepAll(dt);`)
  });

  // Static boards: the family (3 characters × states) and the hairstyles.
  if (!ONLY || ONLY === 'family') {
    const p = await browser.newPage(); await p.setViewport({ width: 1200, height: 700, deviceScaleFactor: 2 });
    const cols = ['idle', 'welcome', 'thinking', 'loading', 'success', 'error', 'empty', 'sleep'], rows = [['uko', { hairStyle: 'ondule', hairColor: '#3A2418', brandColor: '#FFFFFF' }], ['aituko', { character: 'aituko', brandColor: '#DDE3FF', accentColor: '#3B5BFF' }], ['meowuko', { character: 'meowuko', brandColor: '#FFD9B3' }]];
    await p.setContent(page(1200, 700, cols.map((c, i) => `<div class=lab style="left:${110 + i * 136}px;width:136px;top:10px">${c}</div>`).join('') + rows.map(([n], r) => `<div class=lab style="left:0;width:100px;top:${36 + r * 220 + 95}px;text-align:right;color:${INK};font-weight:700">${n}</div>` + cols.map((c, i) => `<div id=${n}${i} class=m style="left:${110 + i * 136}px;top:${36 + r * 220}px;width:136px;height:204px"></div>`).join('')).join('')));
    await p.addScriptTag({ path: ENGINE });
    await p.evaluate((cols, rows) => {
      const T = { idle: 400, welcome: 900, thinking: 700, loading: 800, success: 1500, error: 1300, empty: 1300, sleep: 2600 };
      for (const [n, o] of rows) cols.forEach((c, i) => { const u = UkoMascot.create('#' + n + i, Object.assign({ interactive: false, oneShotMode: 'loop' }, o)); u.pause(); u.setState(c); u.step(T[c]); });
    }, cols, rows);
    await p.screenshot({ path: path.join(OUT, 'family.png') }); await p.close();
    console.log('family.png');
  }
  if (!ONLY || ONLY === 'hair') {
    const p = await browser.newPage(); await p.setViewport({ width: 1200, height: 560, deviceScaleFactor: 2 });
    await p.setContent(page(1200, 560, '<div id=g></div>'));
    await p.addScriptTag({ path: ENGINE });
    await p.evaluate(() => {
      const EN = { original: 'original', classique: 'classic', tres_court: 'very short', degrade: 'fade', pixie: 'pixie', mi_long: 'medium', lisse: 'straight', ondule: 'wavy', boucles: 'curls', afro: 'afro', dreadlocks: 'dreadlocks', tresses: 'braids', tresses_plaquees: 'cornrows', chignon: 'bun', queue_de_cheval: 'ponytail', chauve: 'bald', barbe: 'beard' };
      const H = Object.keys(UkoMascot.HAIR_STYLES), cols = ['#1B1B1F', '#3A2418', '#6B3F2A', '#B03A2E', '#D9962B', '#8B5CF6', '#FF7AAE', '#3B5BFF'];
      const fills = ['#FFFFFF', '#FFE3C4', '#FFE8A3', '#C9F2E1', '#FFD6E0', '#DDE3FF'];
      H.forEach((h, i) => {
        const x = (i % 9) * 132 + 6, y = Math.floor(i / 9) * 272 + 6;
        const d = document.createElement('div'); d.className = 'm'; d.style.cssText = `left:${x}px;top:${y}px;width:132px;height:198px`; document.body.appendChild(d);
        const l = document.createElement('div'); l.className = 'lab'; l.style.cssText = `left:${x}px;width:132px;top:${y + 204}px`; l.textContent = EN[h] || h; document.body.appendChild(l);
        const u = UkoMascot.create(d, { interactive: false, hairStyle: h, hairColor: h === 'chauve' ? '#1B1B1F' : cols[i % cols.length], brandColor: fills[i % fills.length] }); u.pause(); u.step(400);
      });
    });
    await p.screenshot({ path: path.join(OUT, 'hairstyles.png') }); await p.close();
    console.log('hairstyles.png');
  }
  await browser.close();

  // In a real app: SubFlow, the companion climbs onto the form (recorded clip frames).
  if (!ONLY || ONLY === 'subflow') {
    const src = path.join(ROOT, 'marketing', 'subflow-ad', 'clips-en', 'custom');
    if (fs.existsSync(src)) {
      const dir = path.join(TMP, 'subflow'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
      const frames = fs.readdirSync(src).filter(f => f.endsWith('.jpg')).sort().slice(170, 470).filter((_, i) => i % 2 === 0);
      frames.forEach((f, i) => fs.copyFileSync(path.join(src, f), path.join(dir, `f_${String(i).padStart(4, '0')}.jpg`)));
      for (const f of fs.readdirSync(dir)) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(dir, f), path.join(dir, f.replace('.jpg', '.png'))]);
      gif(dir, 15, path.join(OUT, 'subflow.gif'), 300, 128);
    } else console.log('subflow: no recorded clip (marketing/subflow-ad/clips-en/custom), skipped');
  }
  fs.rmSync(TMP, { recursive: true, force: true });
})();
