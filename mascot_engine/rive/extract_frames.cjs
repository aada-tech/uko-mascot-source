#!/usr/bin/env node
// Bakes the Uko engine into per-frame data for the Rive file.
// Runs the DEBUG build in headless Chrome (deterministic clock, no randomness
// from the pointer), samples every clip at 60 fps and writes rive/build/frames.json
// (frames-aituko.json, frames-meowuko.json with --character).
//   node mascot_engine/build_mascot_engine.js --debug
//   node mascot_engine/rive/extract_frames.cjs [--character aituko|meowuko]
const fs = require('fs');
const path = require('path');
let puppeteer;
try { puppeteer = require('puppeteer'); } catch (e) { puppeteer = require(path.join(__dirname, '..', '..', '..', 'node_modules', 'puppeteer')); }

const ENGINE = path.join(__dirname, '..', 'dist', 'uko-mascot-engine.debug.js');
const argi = process.argv.indexOf('--character');
const CHARACTER = argi > 0 ? process.argv[argi + 1] : 'uko';
const OUT = path.join(__dirname, 'build', CHARACTER === 'uko' ? 'frames.json' : `frames-${CHARACTER}.json`);
const FPS = 60;

const { CLIPS, RATES } = require('./clips.cjs');

(async () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 400, height: 600 });
  await page.setContent('<div id="a" style="width:400px;height:600px"></div>');
  await page.addScriptTag({ content: fs.readFileSync(ENGINE, 'utf8') });

  // Static artwork (head-local face per expression, hair curls, laptop, FX parts).
  const statics = await page.evaluate((character) => {
    const m = UkoMascot.create('#a', { interactive: false, hairStyle: 'original', character });
    m.pause(); m.step(0);
    const faces = {};
    for (const mode of ['idle', 'welcome', 'thinking', 'success', 'error', 'empty', 'sleep']) faces[mode] = m._debug().face(mode, 0);
    for (let i = 0; i < 20; i++) m.step(16.7);
    const f = m._debug().frame;
    const hair = [...document.querySelectorAll('[data-hair-layer="front"] path')].map(p => ({ d: p.getAttribute('d'), cls: p.getAttribute('class') || '', fill: p.getAttribute('fill') || '', stroke: p.getAttribute('stroke') || '', sw: p.getAttribute('stroke-width') || p.style.strokeWidth || '' }));
    m.setState('loading');
    for (let i = 0; i < 120; i++) m.step(16.7);
    const lap = document.querySelector('.loadingLaptop');
    const laptop = lap ? [...lap.children].map(e => ({ tag: e.tagName, cls: e.getAttribute('class'), d: e.getAttribute('d'), x1: +e.getAttribute('x1'), y1: +e.getAttribute('y1'), x2: +e.getAttribute('x2'), y2: +e.getAttribute('y2'), opacity: e.getAttribute('opacity') })) : [];
    const art = m._debug().art();
    m.destroy();
    return { character, art, faces, hair, hairFrame: { head: f.pose.head_center, rot: f.rot }, laptop };
  }, CHARACTER);

  const clips = [];
  for (const clip of CLIPS) {
    const frames = await page.evaluate((clip, FPS, RATES, character) => {
      const dt = 1000 / FPS;
      document.getElementById('a').innerHTML = '';
      const m = UkoMascot.create('#a', { interactive: false, hairStyle: 'original', character });
      m.pause();
      // No random beats; rates of the clip's base state so its loop closes exactly.
      m._debug().life({ auto: false, bake: RATES[clip.base] || null });
      m.step(0);
      const dbg = () => m._debug().frame;
      const run = ms => { for (let t = 0; t < ms - 1e-6; t += dt) m.step(dt); };
      for (const [op, arg] of clip.pre) {
        if (op === 'wait') run(arg);
        else if (op === 'state') { m.setState(arg); }
        else if (op === 'wake') m.wake();
        else if (op === 'until') { let n = 0; while (!dbg().entered && n++ < 1200) m.step(dt); }
        else if (op === 'beat') { m._debug().beat(arg, clip.pre.find(x => x[0] === 'beat')[2]); }
      }
      const num = v => Math.round(v * 100) / 100;
      const P = p => [num(p[0]), num(p[1])];
      const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
      const rotOf = el => { const m = /rotate\(\s*(-?[\d.e-]+)/.exec(el.getAttribute('transform') || ''); return m ? +m[1] : 0; };
      const opacityOf = el => {
        let o = 1;
        for (let e = el; e && e.tagName !== 'svg' && e.id !== 'a'; e = e.parentElement) {
          const a = e.getAttribute && e.getAttribute('opacity');
          if (a !== null && a !== undefined && a !== '') o *= +a;
          const s = e.style && e.style.opacity; if (s !== '' && s !== undefined) o *= +s;
        }
        return num(o);
      };
      const sample = () => {
        const f = dbg(), q = f.pose;
        const rig = document.querySelector('.uko-rig');
        const bones = [['neck', 'pelvis'], ['shoulder_L', 'elbow_L'], ['elbow_L', 'wrist_L'], ['shoulder_R', 'elbow_R'], ['elbow_R', 'wrist_R'],
          ['hip_L', 'knee_L'], ['knee_L', 'ankle_L'], ['hip_R', 'knee_R'], ['knee_R', 'ankle_R']].map(([a, b]) => [...P(q[a]), ...P(q[b])]);
        const near = (els, c) => els.reduce((best, e) => { const d = Math.hypot(+e.getAttribute('cx') - c[0], +e.getAttribute('cy') - c[1]); return d < best[0] ? [d, e] : best; }, [1e9, null])[1];
        const hands = [...rig.querySelectorAll('ellipse.hand')];
        const feet = [...rig.querySelectorAll('ellipse.foot')];
        const hand = c => { const e = near(hands, c); return e ? [num(+e.getAttribute('cx')), num(+e.getAttribute('cy')), num(rotOf(e))] : [...P(c), 0]; };
        const foot = c => { const e = near(feet, c); return e ? [num(+e.getAttribute('cx')), num(+e.getAttribute('cy')), num(rotOf(e))] : [...P(c), 0]; };
        const fgEl = rig.querySelector('.thinkingForeground');
        let fg = null;
        if (fgEl) {
          const l = fgEl.querySelector('line.bone'), h = fgEl.querySelector('ellipse.hand');
          fg = { line: ['x1', 'y1', 'x2', 'y2'].map(k => num(+l.getAttribute(k))), hand: [num(+h.getAttribute('cx')), num(+h.getAttribute('cy')), num(rotOf(h))] };
        }
        let face = f.face, shut = 0;
        if (face && typeof face === 'object') { const u = Math.min(1, Math.max(0, face.u)); const x = Math.min(1, Math.max(0, 1 - Math.abs(u - .5) / .2)); shut = x * x * x * (x * (x * 6 - 15) + 10); face = u < .5 ? face.from : face.to; }
        // FX
        const fxRoot = document.createElement('div');
        fxRoot.innerHTML = '<svg>' + m._debug().fx() + '</svg>';
        document.body.appendChild(fxRoot);
        const fx = {};
        const arcs = [...fxRoot.querySelectorAll('.fxWelcome path')];
        if (arcs.length) fx.arcs = arcs.map(e => { const n = e.getAttribute('d').match(/-?[\d.]+(e-?\d+)?/g).map(Number); return { p: [n[0], n[1], n[2], n[7], n[8], n[5], n[6]].map(num), o: opacityOf(e) }; });
        const shadow = fxRoot.querySelector('.fxSuccess ellipse');
        if (shadow) fx.shadow = { p: ['cx', 'cy', 'rx', 'ry'].map(k => num(+shadow.getAttribute(k))), o: opacityOf(shadow) };
        const sparks = [...fxRoot.querySelectorAll('path.fxSpark')];
        if (sparks.length) fx.sparks = sparks.map(e => ({ p: e.getAttribute('d').match(/-?[\d.]+(e-?\d+)?/g).map(Number).slice(0, 16).map(num), o: opacityOf(e) }));
        const empty = [...fxRoot.querySelectorAll('.fxEmpty line')];
        if (empty.length) fx.empty = empty.map(e => ({ p: ['x1', 'y1', 'x2', 'y2'].map(k => num(+e.getAttribute(k))), o: opacityOf(e) }));
        const zs = [...fxRoot.querySelectorAll('.fxSleep path')];
        if (zs.length) fx.zs = zs.map(e => ({ p: e.getAttribute('d').match(/-?[\d.]+(e-?\d+)?/g).map(Number).map(num), o: opacityOf(e), w: num(parseFloat(e.style.strokeWidth) || 12) }));
        const bubble = fxRoot.querySelector('.fxThoughtBubble');
        if (bubble) { const t = bubble.getAttribute('transform'); const n = t.match(/-?[\d.]+(e-?\d+)?/g).map(Number); fx.bubble = { p: [n[0], n[1], n[2], n[3], n[4]].map(num), o: opacityOf(bubble) }; }
        const spin = fxRoot.querySelector('.loadingSpinner');
        if (spin) fx.spinner = { a: num(rotOf(spin)), o: opacityOf(spin) };
        fxRoot.remove();
        return { state: f.state, b: bones, h: [hand(q.hand_L_center), hand(q.hand_R_center)], f: [foot(q.foot_L_center), foot(q.foot_R_center)],
          head: [...P(q.head_center), num(f.rot)], face, shut: num(shut), lap: rig.querySelector('.loadingLaptop') ? 1 : 0, fg, fx,
          eye: P(f.eye || [0, 0]), ls: P(f.lapShift || [0, 0]), lx: f.lapExit ? { kind: f.lapExit.kind, since: num(f.lapExit.since), shift: P(f.lapExit.shift) } : null,
          ...(f.tail ? { tail: [num(f.tail.x), num(f.tail.y), num(f.tail.rot), f.tail.side, num(f.tail.k)] } : {}) };
      };
      const frames = [];
      if (clip.rec === 'entered') {
        frames.push(sample());
        let n = 0;
        while (!dbg().entered && n++ < 1200) { m.step(dt); frames.push(sample()); }
      } else {
        frames.push(sample());
        for (let t = dt; t <= clip.rec + 1e-6; t += dt) { m.step(dt); frames.push(sample()); }
      }
      // Static FX artwork (bubble, spinner) once, in their own coordinates.
      m.destroy();
      return frames;
    }, clip, FPS, RATES, CHARACTER);
    clips.push({ name: clip.name, loop: !!clip.loop, frames });
    console.log(`${clip.name.padEnd(17)} ${frames.length} frames${clip.loop ? ' (loop)' : ''}`);
  }

  // Thought bubble and spinner artwork.
  const fxArt = await page.evaluate((character) => {
    const m = UkoMascot.create('#a', { interactive: false, hairStyle: 'original', character });
    m.pause(); m.step(0);
    const grab = (state, ms, sel) => {
      m.setState(state);
      let d = document.createElement('div'), g = null;
      for (let t = 0; t < ms && !(g && +(g.getAttribute('opacity') || 1) > .9); t += 16.7) {
        m.step(16.7); d.innerHTML = '<svg>' + m._debug().fx() + '</svg>'; g = d.querySelector(sel);
      }
      return g ? [...g.querySelectorAll('*')].map(e => ({ tag: e.tagName, cls: e.getAttribute('class'), d: e.getAttribute('d'), cx: +e.getAttribute('cx'), cy: +e.getAttribute('cy'), r: +e.getAttribute('r'), x1: +e.getAttribute('x1'), y1: +e.getAttribute('y1'), x2: +e.getAttribute('x2'), y2: +e.getAttribute('y2'), rot: /rotate\(\s*(-?[\d.]+)/.test(e.getAttribute('transform') || '') ? +/rotate\(\s*(-?[\d.]+)/.exec(e.getAttribute('transform'))[1] : 0 })) : [];
    };
    const bubble = grab('error', 4000, '.fxThoughtBubble');
    const bubbleT = (() => { const d = document.createElement('div'); d.innerHTML = '<svg>' + m._debug().fx() + '</svg>'; const g = d.querySelector('.fxThoughtBubble'); return g ? g.getAttribute('transform') : ''; })();
    const spinner = grab('loading', 1500, '.loadingSpinner');
    m.destroy();
    return { bubble, bubbleT, spinner };
  }, CHARACTER);

  fs.writeFileSync(OUT, JSON.stringify({ fps: FPS, statics, fxArt, clips }));
  console.log(`wrote ${path.relative(process.cwd(), OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
