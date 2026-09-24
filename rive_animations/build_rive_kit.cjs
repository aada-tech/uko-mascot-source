#!/usr/bin/env node
// Builds the Rive import kit: one clean, layered SVG per character, ready to be
// imported in the Rive editor, plus reference sheets for the animator.
//
//   rive_animations/import/<character>.svg     rest pose, pre-rigged hierarchy
//   rive_animations/reference/<character>-expressions.png
//   rive_animations/reference/uko-poses.png    every state sampled over time
//
// The artwork comes from the web engine (same drawing, same proportions), but the
// output is meant to be edited by hand in Rive from now on: the .riv made in the
// editor is the source of truth, this script only gives it a clean start.
//
// Hierarchy: every joint is a group whose origin sits ON the joint (translate
// only, no rotation), so after import rotating a group bends the limb at the
// right place. Shapes are plain paths/ellipses with explicit presentation
// attributes (what Rive's SVG import reads best), ids become layer names.
//
//   UKO_SITE_URL=https://uko-mascot.pages.dev node mascot_engine/build_mascot_engine.js --debug
//   node rive_animations/build_rive_kit.cjs
// Chromium: PUPPETEER_EXECUTABLE_PATH=/path/to/chrome if puppeteer has no browser of its own.
const fs = require('fs');
const path = require('path');
let puppeteer;
try { puppeteer = require('puppeteer'); } catch (e) { puppeteer = require(path.join(__dirname, '..', 'node_modules', 'puppeteer')); }

const ENGINE = path.join(__dirname, '..', 'mascot_engine', 'dist', 'uko-mascot-engine.debug.js');
const OUT_IMPORT = path.join(__dirname, 'import');
const OUT_REF = path.join(__dirname, 'reference');
const CHARACTERS = ['uko', 'aituko', 'meowuko'];
const EXPRESSIONS = ['idle', 'welcome', 'thinking', 'success', 'error', 'empty', 'sleep'];

// ---------------------------------------------------------------- style
// Default colours of the view model (see CONTRACT.json).
const C = { line: '#16161D', body: '#FFFFFF', hair: '#16161D', blush: '#F6A7B7', accent: '#FFC93C',
  screen: '#1C2033', led: '#6CF0E0', nose: '#F48FA2' };
const stroke = (color, w, extra = '') => `fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra}`;
const STYLE = {
  bone: stroke(C.line, 15),
  hand: `fill="${C.body}" stroke="${C.line}" stroke-width="15"`,
  foot: `fill="${C.body}" stroke="${C.line}" stroke-width="15"`,
  headCircle: `fill="${C.body}" stroke="${C.line}" stroke-width="15" stroke-linejoin="round"`,
  hairFill: `fill="${C.hair}"`,
  faceStroke: stroke(C.line, 11),
  faceOpenMouth: `fill="${C.body}" stroke="${C.line}" stroke-width="11" stroke-linejoin="round"`,
  eye: `fill="${C.line}"`,
  eyeShine: `fill="${C.body}"`,
  blush: `fill="${C.blush}" opacity="0.55"`,
  accessory: stroke(C.line, 12),
  robotScreen: `fill="${C.screen}"`,
  robotGlare: stroke('#FFFFFF', 10, ' opacity="0.35"'),
  robotMark: `fill="${C.accent}" stroke="${C.line}" stroke-width="12"`,
  led: stroke(C.led, 14),
  ledFill: `fill="${C.led}" stroke="${C.led}" stroke-width="6" stroke-linejoin="round"`,
  catInnerEar: `fill="${C.blush}"`,
  catNose: `fill="${C.nose}" stroke="${C.line}" stroke-width="5" stroke-linejoin="round"`,
  catWhisker: stroke(C.line, 7),
  catTail: stroke(C.line, 15)
};

// ---------------------------------------------------------------- geometry
const r1 = v => Math.round(v * 10) / 10;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const fmt = p => `${r1(p[0])} ${r1(p[1])}`;
// Maps every point of an absolute path (M L C Q S T Z only) through fn.
function mapPath(d, fn) {
  if (/[a-y]|[HVA]/.test(d.replace(/e-?\d/g, ''))) throw new Error(`relative/H/V/A commands not supported: ${d.slice(0, 60)}`);
  return d.replace(/([MLCQST])([^MLCQSTZ]*)/g, (_, cmd, args) => {
    const n = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    const pts = [];
    for (let i = 0; i < n.length; i += 2) pts.push(fmt(fn([n[i], n[i + 1]])));
    return `${cmd} ${pts.join(' ')} `;
  }).replace(/\s+/g, ' ').replace(/ Z/g, ' Z').trim();
}
const shiftPath = (d, dx, dy) => mapPath(d, p => [p[0] + dx, p[1] + dy]);
function rotateAbout(p, c, deg) {
  const a = deg * Math.PI / 180, x = p[0] - c[0], y = p[1] - c[1];
  return [c[0] + x * Math.cos(a) - y * Math.sin(a), c[1] + x * Math.sin(a) + y * Math.cos(a)];
}

// ---------------------------------------------------------------- markup
const esc = s => String(s).replace(/"/g, '&quot;');
const group = (id, at, children, extra = '') =>
  `<g id="${id}"${at ? ` transform="translate(${fmt(at)})"` : ''}${extra}>${children.join('')}</g>`;
const seg = (id, to) => `<path id="${id}" d="M 0 0 L ${fmt(to)}" ${STYLE.bone}/>`;

// Converts engine markup (class-styled, head-local) to explicit attributes and ids.
function restyle(markup, prefix) {
  let n = 0;
  return markup
    .replace(/<g transform="rotate\(0 0 0\)">/g, '<g>')
    .replace(/ data-feature="[^"]*"/g, '')
    .replace(/<(\w+)([^>]*?) class="([^"]+)"([^>]*?)(\/?)>/g, (m, tag, a, cls, b, close) => {
      const st = STYLE[cls];
      if (!st) throw new Error(`no style for class "${cls}"`);
      const attrs = (a + b).replace(/ opacity="1"/, '');
      return `<${tag} id="${prefix}_${cls}_${++n}"${attrs} ${st}${close}>`;
    });
}

// ---------------------------------------------------------------- one character
function characterSvg(c, D) {
  const P = D.pose;
  const pelvis = P.pelvis, neck = P.neck;
  const arm = side => {
    const sh = P[`shoulder_${side}`], el = P[`elbow_${side}`], wr = P[`wrist_${side}`], hc = P[`hand_${side}_center`];
    const h = sub(hc, wr), ang = Math.atan2(h[1], h[0]) * 180 / Math.PI;
    const hand = `<ellipse id="hand_${side}_shape" cx="${r1(h[0])}" cy="${r1(h[1])}" rx="46" ry="26" transform="rotate(${r1(ang)} ${r1(h[0])} ${r1(h[1])})" ${STYLE.hand}/>`;
    return group(`upperArm_${side}`, sub(sh, neck), [
      seg(`upperArm_${side}_line`, sub(el, sh)),
      group(`foreArm_${side}`, sub(el, sh), [seg(`foreArm_${side}_line`, sub(wr, el)), group(`hand_${side}`, sub(wr, el), [hand])])
    ]);
  };
  const leg = side => {
    const hp = P[`hip_${side}`], kn = P[`knee_${side}`], an = P[`ankle_${side}`], fc = P[`foot_${side}_center`];
    const f = sub(fc, an);
    const foot = `<ellipse id="foot_${side}_shape" cx="${r1(f[0])}" cy="${r1(f[1])}" rx="58" ry="22" ${STYLE.foot}/>`;
    return group(`thigh_${side}`, sub(hp, pelvis), [
      seg(`thigh_${side}_line`, sub(kn, hp)),
      group(`shin_${side}`, sub(kn, hp), [seg(`shin_${side}_line`, sub(an, kn)), group(`foot_${side}`, sub(an, kn), [foot])])
    ]);
  };

  // Head: origin on the head centre, drawn upright (the engine's rest pose tilts it ~1°).
  const hc = P.head_center, rot = D.rot;
  const toHead = p => rotateAbout(sub(p, hc), [0, 0], -rot);
  const head = [];
  const faces = D.character === 'aituko' ? D.robotFaces : D.faces;
  const faceGroups = EXPRESSIONS.map(m => `<g id="face_${m}"${m === 'idle' ? '' : ' opacity="0"'}>${restyle(faces[m], `face_${m}`)}</g>`);
  if (c === 'aituko') {
    const A = D.art.robot.art, lift = D.art.robot.lift;
    const rect = (id, b, st) => `<rect id="${id}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${b.r}" ${st}/>`;
    head.push(`<g id="robot" transform="translate(0 ${-lift})">`,
      `<path id="neck_line" d="M 0 ${A.neck[0]} L 0 ${A.neck[1]}" ${STYLE.bone}/>`,
      group('antenna', A.pivot, [`<path id="antenna_spring" d="${shiftPath(A.antenna, -A.pivot[0], -A.pivot[1])}" ${STYLE.accessory}/>`,
        `<circle id="antenna_ball" cx="${A.ball[0] - A.pivot[0]}" cy="${A.ball[1] - A.pivot[1]}" r="${A.ball[2]}" ${STYLE.robotMark}/>`]),
      ...A.bolts.map(b => rect(b.side < 0 ? 'bolt_L' : 'bolt_R', b, STYLE.headCircle.replace('stroke-width="15"', 'stroke-width="12"'))),
      rect('head_shape', A.box, STYLE.headCircle),
      `<g id="screen">`, rect('screen_shape', A.screen, STYLE.robotScreen), `<path id="screen_glare" d="${A.glare}" ${STYLE.robotGlare}/>`, `</g>`,
      `</g>`,
      // The LED faces already carry the lift (engine markup), keep them as siblings.
      `<g id="faces">${faceGroups.join('')}</g>`);
  } else {
    if (c === 'meowuko') {
      head.push(`<g id="ears">`, ...D.art.cat.ears.map((E, i) => {
        const side = i ? 'R' : 'L', [px, py] = E.pivot;
        return group(`ear_${side}`, E.pivot, [
          `<path id="ear_${side}_shape" d="${shiftPath(E.outer, -px, -py)}" ${STYLE.headCircle}/>`,
          `<path id="ear_${side}_inner" d="${shiftPath(E.inner, -px, -py)}" ${STYLE.catInnerEar}/>`]);
      }), `</g>`);
    }
    if (D.hairBack.length) head.push(`<g id="hair_back">${D.hairBack.map((h, i) => hairPath(h, `hair_back_${i + 1}`, toHead)).join('')}</g>`);
    head.push(`<circle id="head_shape" cx="0" cy="0" r="${r1(P.head_radius)}" ${STYLE.headCircle}/>`);
    if (D.hairFront.length) head.push(`<g id="hair">${D.hairFront.map((h, i) => hairPath(h, `hair_${i + 1}`, toHead)).join('')}</g>`);
    head.push(`<g id="faces">${faceGroups.join('')}</g>`);
    if (c === 'meowuko') {
      const K = D.art.cat;
      head.push(`<g id="muzzle"><path id="nose" d="${K.nose}" ${STYLE.catNose}/>`,
        ...[-1, 1].flatMap(s => K.whiskers.map(([y0, y1], i) =>
          `<path id="whisker_${s < 0 ? 'L' : 'R'}${i + 1}" d="M ${s * 98} ${y0} L ${s * 176} ${y1}" ${STYLE.catWhisker}/>`)), `</g>`);
    }
  }

  const tail = c === 'meowuko' ? [group('tail', [0, 0], [`<path id="tail_shape" d="${D.art.cat.tail}" ${STYLE.catTail}/>`])] : [];
  const root = group('root', pelvis, [
    ...tail,
    leg('L'), leg('R'),
    group('spine', [0, 0], [
      seg('spine_line', sub(neck, pelvis)),
      group('neck', sub(neck, pelvis), [arm('L'), arm('R'), group('head', sub(hc, neck), head)])
    ])
  ]);
  const name = { uko: 'Uko', aituko: 'Aituko', meowuko: 'Meowuko' }[c];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1536" width="1024" height="1536">\n`
    + `<!-- ${name} — rest pose for the Rive editor. Generated by rive_animations/build_rive_kit.cjs. -->\n`
    + root.replace(/></g, '>\n<') + '\n</svg>\n';
}
function hairPath(h, id, toHead) {
  const st = STYLE[h.cls] || (h.cls === 'hairStroke' ? stroke(C.hair, h.sw || 15) : null);
  if (!st) throw new Error(`no style for hair class "${h.cls}"`);
  return `<path id="${id}" d="${mapPath(h.d, toHead)}" ${st}/>`;
}

// ---------------------------------------------------------------- engine
async function main() {
  if (!fs.existsSync(ENGINE)) throw new Error(`missing ${ENGINE}: run node mascot_engine/build_mascot_engine.js --debug first`);
  fs.mkdirSync(OUT_IMPORT, { recursive: true });
  fs.mkdirSync(OUT_REF, { recursive: true });
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 400, height: 600 });
  await page.setContent('<div id="a" style="width:400px;height:600px"></div>');
  await page.addScriptTag({ content: fs.readFileSync(ENGINE, 'utf8') });

  const svgs = {};
  for (const c of CHARACTERS) {
    const D = await page.evaluate((c, EXPRESSIONS) => {
      document.getElementById('a').innerHTML = '';
      const m = UkoMascot.create('#a', { interactive: false, hairStyle: 'original', character: c });
      m.pause(); m._debug().life({ auto: false }); m.step(0);
      const f = m._debug().frame, dbg = m._debug();
      const faces = {}, robotFaces = {};
      for (const e of EXPRESSIONS) faces[e] = dbg.face(e, 0);
      // Robot faces: the engine markup carries the head-level wrapper transforms; keep only the lift.
      for (const e of EXPRESSIONS) robotFaces[e] = faces[e].replace(/^<g transform="[^"]*">/, '<g transform="translate(0 -14)">');
      const hair = layer => [...document.querySelectorAll(`[data-hair-layer="${layer}"] path`)].map(p => ({
        d: p.getAttribute('d'), cls: p.getAttribute('class') || '', sw: p.getAttribute('stroke-width') || '' }));
      const out = { character: c, pose: f.pose, rot: f.rot, faces, robotFaces, art: dbg.art(), hairFront: hair('front'), hairBack: hair('back') };
      m.destroy();
      return out;
    }, c, EXPRESSIONS);
    svgs[c] = characterSvg(c, D);
    fs.writeFileSync(path.join(OUT_IMPORT, `${c}.svg`), svgs[c]);
    console.log(`import/${c}.svg  ${(svgs[c].length / 1024).toFixed(1)} KB`);
  }

  // Expressions sheet: each import SVG with one face group shown at a time.
  for (const c of CHARACTERS) {
    const cells = EXPRESSIONS.map(e => {
      const s = svgs[c].replace(/<g id="face_(\w+)"( opacity="0")?>/g, (m, id) => `<g id="face_${id}"${id === e ? '' : ' opacity="0"'}>`)
        .replace('viewBox="0 0 1024 1536"', 'viewBox="200 20 620 600"');   // head close-up
      return `<figure><div class="crop">${s}</div><figcaption>face_${e}</figcaption></figure>`;
    });
    await sheet(browser, cells, 7, path.join(OUT_REF, `${c}-expressions.png`), 'crop');
  }

  // Pose sheet (Uko): each state sampled over its duration, as the web engine plays it.
  const STATES = { idle: 8000, welcome: 3900, thinking: 4000, loading: 4000, success: 4300, error: 4500, empty: 4100, sleep: 4000 };
  const COLS = 7, rows = [];
  for (const [state, dur] of Object.entries(STATES)) {
    const frames = await page.evaluate((state, dur, COLS) => {
      document.getElementById('a').innerHTML = '';
      const m = UkoMascot.create('#a', { interactive: false, hairStyle: 'original', character: 'uko' });
      m.pause(); m._debug().life({ auto: false }); m.step(0);
      for (let t = 0; t < 1000; t += 1000 / 60) m.step(1000 / 60);
      if (state !== 'idle') m.setState(state);
      const out = [];
      let t = 0;
      for (let k = 0; k < COLS; k++) {
        const target = dur * k / (COLS - 1);
        while (t < target) { m.step(1000 / 60); t += 1000 / 60; }
        out.push({ t: Math.round(target), svg: document.querySelector('#a svg').outerHTML });
      }
      m.destroy();
      return out;
    }, state, dur, COLS);
    rows.push(...frames.map(f => `<figure><div class="pose">${f.svg}</div><figcaption>${state} · ${(f.t / 1000).toFixed(2)} s</figcaption></figure>`));
  }
  await sheet(browser, rows, COLS, path.join(OUT_REF, 'uko-poses.png'), 'pose');
  await browser.close();
}

async function sheet(browser, cells, cols, file, cls) {
  const page = await browser.newPage();
  await page.setViewport({ width: cols * 180 + 40, height: 400, deviceScaleFactor: 1 });
  await page.setContent(`<style>
    body{margin:0;padding:20px;background:#F4F5F9;font:13px system-ui,sans-serif;color:#16161D}
    .grid{display:grid;grid-template-columns:repeat(${cols},180px)}
    figure{margin:0 0 10px;text-align:center}
    .crop{width:180px;height:174px;overflow:hidden}
    .pose{width:180px;height:270px;overflow:hidden}
    .crop svg,.pose svg{width:100%;height:100%}
    figcaption{margin-top:4px}</style><div class="grid">${cells.join('')}</div>`);
  const h = await page.evaluate(() => document.body.scrollHeight);
  await page.setViewport({ width: cols * 180 + 40, height: h, deviceScaleFactor: 1 });
  await page.screenshot({ path: file, fullPage: true });
  await page.close();
  console.log(path.relative(path.join(__dirname, '..'), file));
}

main().catch(e => { console.error(e); process.exit(1); });
