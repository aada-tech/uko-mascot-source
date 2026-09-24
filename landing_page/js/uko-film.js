/**
 * « La journée d'Uko » — a one-minute short film drawn in JavaScript.
 *
 * The scenery (sky, torn-paper hills, props, particles) is drawn on canvas.
 * Uko himself is the real engine the pack ships: every beat of the story is
 * one of its states, driven through the public API, and the caption shows the
 * line of code that produces it.
 *
 * Usage: <div id="film"></div> + uko-mascot-engine.js + this file.
 */
(function () {
  'use strict';
  const root = document.getElementById('film');
  if (!root || typeof UkoMascot === 'undefined') return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------- DOM
  root.innerHTML = `
    <div class="film-cam">
      <canvas class="film-bg" aria-hidden="true"></canvas>
      <canvas class="film-fg" aria-hidden="true"></canvas>
    </div>
    <div class="film-caption" aria-live="off"><span></span></div>
    <div class="film-title" aria-hidden="true"><b>uko.</b><span>${ukoT('filmTitle')}</span></div>
    <div class="film-fade"></div>
    <button class="film-toggle" type="button" aria-label="Mettre en pause">❚❚</button>`;
  const bg = root.querySelector('.film-bg'), fg = root.querySelector('.film-fg');
  const bgc = bg.getContext('2d'), fgc = fg.getContext('2d');
  const captionEl = root.querySelector('.film-caption span');
  const titleEl = root.querySelector('.film-title');
  const fadeEl = root.querySelector('.film-fade');
  const toggle = root.querySelector('.film-toggle');
  const camEl = root.querySelector('.film-cam');

  // ---------------------------------------------------------------- utils
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const R = rng(7);
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };
  const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => { const x = hex(a), y = hex(b); return `rgb(${x.map((v, i) => Math.round(lerp(v, y[i], t))).join(',')})`; };

  // ---------------------------------------------------------------- world
  // Distances are in units of the stage height (H). Ground and mascot scale
  // with the stage, so the film works from phone to desktop.
  const GROUND = 0.86;           // ground line (fraction of H from top)
  let UKO_H = 0.64;              // mascot box height (viewBox 1024×1536); smaller on narrow screens
  const FEET = 1408 / 1536;      // feet line inside the mascot box
  const X0 = 1.0;                // where Uko sleeps at the start (room on the left for Aituko)
  const X1 = X0 + 1.1;           // progress board
  const X2 = X1 + 1.45;          // box (far enough: nobody stops in front of the board)
  const WORLD = X2 + 1.6;
  const BOARD_Y = 0.36;          // top of the progress board

  let W = 0, H = 0, DPR = 1, GAP = 1;   // GAP scales the distances between the actors
  // Phones: a smaller board, closer to the actors, so the group and the board fit together.
  let NARROW = 1, BOARD_S = 1, BOARD_X = X1 + 0.36;
  function resize() {
    const r = root.getBoundingClientRect();
    W = r.width; H = r.height; DPR = Math.min(2, window.devicePixelRatio || 1);
    for (const c of [bg, fg]) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); }
    bgc.setTransform(DPR, 0, 0, DPR, 0, 0); fgc.setTransform(DPR, 0, 0, DPR, 0, 0);
    // Phones: the three must fit side by side, so they stand closer and a bit smaller.
    const narrow = clamp(((W / H) - 1.15) / 0.7);
    UKO_H = lerp(0.56, 0.64, narrow); GAP = lerp(0.68, 1, narrow);
    NARROW = narrow; BOARD_S = lerp(0.8, 1, narrow); BOARD_X = X1 + lerp(0.3, 0.36, narrow);
    if (typeof sizeCast === 'function') sizeCast();
  }

  // Paper grain, generated once.
  const grain = document.createElement('canvas');
  grain.width = grain.height = 160;
  (function () {
    const g = grain.getContext('2d'), img = g.createImageData(160, 160), n = rng(3);
    for (let i = 0; i < img.data.length; i += 4) { const v = 200 + n() * 55; img.data[i] = v; img.data[i + 1] = v * .96; img.data[i + 2] = v * .9; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0);
  })();
  let grainPattern = null;

  // Torn silhouettes: precomputed jitter so edges do not shimmer.
  function ridge(seed, count, base, amp, freq) {
    const r = rng(seed), phase = r() * 10, pts = [];
    for (let i = 0; i <= count; i++) {
      const x = i / count;
      const y = base - amp * (0.55 * Math.sin(x * freq + phase) + 0.3 * Math.sin(x * freq * 2.3 + phase * 1.7) + 0.15 * Math.sin(x * freq * 5.1));
      pts.push([x, y, (r() - .5) * 0.006]);
    }
    return pts;
  }
  const LAYERS = [
    { p: 0.18, pts: ridge(11, 260, 0.62, 0.07, 22), day: '#B9C6FF', night: '#35338A', fringe: '#EEF2FF' },
    { p: 0.42, pts: ridge(23, 260, 0.72, 0.06, 30), day: '#8FE0BF', night: '#1F5E6B', fringe: '#E6FBF2' },
    { p: 0.7, pts: ridge(37, 260, 0.8, 0.035, 44), day: '#FFB7D2', night: '#5A3A7A', fringe: '#FFEAF3' }
  ];
  const TREES = Array.from({ length: 16 }, (_, i) => ({ x: 0.3 + i * 0.42 + R() * 0.2, s: 0.7 + R() * 0.5, c: R() < .34 ? '#3DDC97' : R() < .5 ? '#FF7AAE' : '#6C8BFF' }));
  const CLOUDS = Array.from({ length: 7 }, () => ({ x: R() * 6, y: 0.12 + R() * 0.2, s: 0.6 + R() * 0.6, v: 0.004 + R() * 0.006 }));
  const STARS = Array.from({ length: 70 }, () => ({ x: R(), y: R() * 0.55, r: 0.6 + R() * 1.6, tw: R() * 6 }));
  const GRASS = Array.from({ length: 160 }, () => ({ x: R() * (WORLD + 2), h: 0.01 + R() * 0.018 }));
  // Life around Uko: birds by day, butterflies near the path, fireflies at night.
  const BIRDS = Array.from({ length: 5 }, (_, i) => ({ y: 0.14 + R() * 0.16, v: 0.07 + R() * 0.04, ph: R() * 10, off: i * 0.9, s: 0.7 + R() * 0.5 }));
  const BUTTERFLIES = Array.from({ length: 4 }, (_, i) => ({ x: 0.9 + i * 0.7 + R() * 0.3, y: 0.62 + R() * 0.12, ph: R() * 7, c: ['#FF7AAE', '#FFC93C', '#8B5CF6', '#3DDC97'][i] }));
  const FIREFLIES = Array.from({ length: 26 }, () => ({ x: R() * (WORLD + 1.5), y: 0.5 + R() * 0.34, ph: R() * 7, sp: 0.4 + R() * 0.8 }));

  function tornPath(ctx, pts, xOf, yOf, bottom) {
    ctx.beginPath();
    ctx.moveTo(xOf(pts[0][0]), bottom);
    for (const [x, y, j] of pts) ctx.lineTo(xOf(x), yOf(y + j));
    ctx.lineTo(xOf(pts[pts.length - 1][0]), bottom);
    ctx.closePath();
  }

  // ---------------------------------------------------------------- sky
  const SKY = {
    night: { top: '#1E1B4B', bottom: '#5B57B8', stars: 1, sun: -0.2, moon: 1, tint: 0.55 },
    dawn: { top: '#FFB6D2', bottom: '#FFE9A8', stars: 0.15, sun: 0.35, moon: 0.2, tint: 0.1 },
    day: { top: '#9FD4FF', bottom: '#EEF6FF', stars: 0, sun: 0.95, moon: 0, tint: 0 },
    sunset: { top: '#FF9EC7', bottom: '#FFD36E', stars: 0.05, sun: 0.3, moon: 0, tint: 0.15 }
  };
  const sky = { from: SKY.night, to: SKY.night, t0: 0, dur: 1 };
  function setSky(name, dur) { sky.from = skyNow(); sky.to = SKY[name]; sky.t0 = clock; sky.dur = dur; }
  function skyNow() {
    const u = ease((clock - sky.t0) / sky.dur), a = sky.from, b = sky.to;
    return { top: mix(toHex(a.top), toHex(b.top), u), bottom: mix(toHex(a.bottom), toHex(b.bottom), u), stars: lerp(a.stars, b.stars, u), sun: lerp(a.sun, b.sun, u), moon: lerp(a.moon, b.moon, u), tint: lerp(a.tint, b.tint, u) };
  }
  function toHex(c) {
    if (c[0] === '#') return c;
    const v = c.match(/\d+/g).map(Number);
    return '#' + v.map(x => x.toString(16).padStart(2, '0')).join('');
  }

  // ---------------------------------------------------------------- state
  let clock = 0;            // film time (s), advances only while playing
  let camX = 0;             // camera left edge (H units)
  let focusX = X0;          // what the camera looks at (H units)
  let playing = !reduced, visible = true;
  const props = {
    progress: 0, progressTo: 0, progressFrom: 0, progressT0: 0, progressDur: 1, barMood: 'load',
    bug: { on: false, x: 1, t0: 0, flyT0: -1 },
    bulb: { t0: -1, actor: null },
    box: { open: 0, t0: -1, close: -1 },
    confetti: [], dust: [], poi: null, ball: { t0: -1 }, finger: null, boxFront: false,
    rain: { on: false, level: 0, t0: -1, flash: -10, actor: null }, rainbow: { t0: -1 }, shoot: { t0: -1 }
  };
  // Camera: gentle push-ins on the big moments, a small shake on the thunder.
  const cam = { z: 1, zTo: 1, shakeT0: -10 };
  function push(z, hold) { cam.zTo = 1 + (z - 1) * lerp(0.3, 1, NARROW); cam.release = clock + hold; }

  // ---------------------------------------------------------------- cast
  // Three real engine instances, the ones the pack ships. Uko gets a new look at
  // every loop (hairstyle and colours from the whole catalogue); Aituko and Meowuko
  // keep their character and change colours.
  const HAIR_COLORS = ['#1B1B1F', '#3A2418', '#6B3F2A', '#7A4A2A', '#B03A2E', '#D9962B', '#8B5CF6', '#FF7AAE', '#3B5BFF', '#E8E3DA'];
  const FILLS = ['#FFFFFF', '#FFE3C4', '#FFC93C', '#FF7AAE', '#3DDC97', '#8B5CF6', '#0EA5E9'];
  const ROBOT_FILLS = ['#DDE3FF', '#FFFFFF', '#C9F2E1', '#FFE8A3'], CAT_FILLS = ['#FFD9B3', '#FFFFFF', '#FFE3C4', '#F4E1FF'];
  const ACCENTS = ['#FFC93C', '#3B5BFF', '#FF7AAE', '#3DDC97'];
  const randomOf = list => list[Math.floor(Math.random() * list.length)];
  let lastHair = null;
  const CAST = [
    { id: 'uko', character: 'uko', scale: 1 },
    { id: 'aituko', character: 'aituko', scale: .97 },
    { id: 'meowuko', character: 'meowuko', scale: .93 }
  ];
  const A = {};             // actors by id: { el, m, x, target, look, scale }
  const actors = () => CAST.map(c => A[c.id]);
  function looks() {
    let hair; do { hair = randomOf(Object.keys(UkoMascot.HAIR_STYLES)); } while (hair === lastHair);
    lastHair = hair;
    return {
      uko: { hairStyle: hair, hairColor: hair === 'chauve' ? '#1B1B1F' : randomOf(HAIR_COLORS), brandColor: randomOf(FILLS) },
      aituko: { brandColor: randomOf(ROBOT_FILLS), accentColor: randomOf(ACCENTS) },
      meowuko: { brandColor: randomOf(CAT_FILLS) }
    };
  }
  // Where each actor starts the story (H units): Uko and Meowuko asleep, Aituko off screen.
  // Left to right the order never changes (Aituko, Meowuko, Uko), except when Meowuko
  // runs behind Uko to the bug.
  const START = () => ({ uko: X0, meowuko: X0 - 0.34 * GAP, aituko: X0 - 1.5 });
  const DEPTH = { meowuko: 1, aituko: 2, uko: 3 };
  function createCast() {
    const L = looks();
    for (const c of CAST) {
      const el = document.createElement('div');
      el.className = 'film-uko'; el.setAttribute('aria-label', c.character === 'uko' ? 'Uko' : c.character === 'aituko' ? 'Aituko' : 'Meowuko');
      el.style.zIndex = DEPTH[c.id];
      camEl.insertBefore(el, fg);
      const m = UkoMascot.create(el, Object.assign({ character: c.character, state: c.id === 'aituko' ? 'idle' : 'sleep', interactive: true, follow: 'page' }, L[c.id]));
      A[c.id] = { id: c.id, el, m, x: START()[c.id], lift: 0, target: null, look: null, scale: c.scale };
    }
    sizeCast();
    // Open on the sleepers already lying down: fast-forward their clip.
    for (const a of actors()) { a.m.pause(); a.m.step(3200); if (playing && visible) a.m.resume(); }
  }
  function sizeCast() {
    for (const a of Object.values(A)) { a.el.style.height = `${UKO_H * a.scale * H}px`; a.el.style.width = `${UKO_H * a.scale * H * 1024 / 1536}px`; }
  }
  function destroyCast() { for (const a of actors()) { a.m.destroy(); a.el.remove(); } }
  function walkTo(id, x, speed = 1.35) { const a = A[id]; a.target = x; a.look = null; a.m.lookAt(null); a.m.startWalk(x > a.x ? 1 : -1, speed); }
  const arrived = (...ids) => ids.every(id => A[id].target === null);
  // Gaze: another actor's head, or a point of the world ([x, y] in H units).
  function look(id, what) { A[id].look = what; if (!what) A[id].m.lookAt(null); }
  function lookAll(what, except) { for (const a of actors()) if (a.id !== except) look(a.id, what); }
  function turn(id, yaw) { A[id].m.setOrientation(yaw, 480); }
  function state(id, s) { A[id].m.setState(s); }
  function everyone(s) { for (const a of actors()) a.m.setState(s); }

  // ---------------------------------------------------------------- script
  // Captions are typed like a terminal line.
  let capText = '', capT0 = 0;
  function caption(text) {
    captionEl.parentElement.classList.remove('show');
    void captionEl.parentElement.offsetWidth;
    capText = text; capT0 = clock;
    captionEl.textContent = '▍';
    captionEl.parentElement.classList.add('show');
  }
  function typeCaption() {
    const n = Math.min(capText.length, Math.floor((clock - capT0) * 42));
    const txt = capText.slice(0, n) + (n < capText.length || Math.floor(clock * 2.4) % 2 === 0 ? '▍' : ' ');
    if (captionEl.textContent !== txt) captionEl.textContent = txt;
  }
  function progressTo(v, dur) { props.progressFrom = props.progress; props.progressTo = v; props.progressT0 = clock; props.progressDur = dur; }
  function confetti(a) {
    const pose = a.m.getPose();
    if (!pose) return;
    for (const k of ['hand_L_center', 'hand_R_center']) {
      const [wx, wy] = toWorld(a, pose[k]);
      for (let i = 0; i < 16; i++) {
        const ang = -Math.PI / 2 + (R() - .5) * 1.9, sp = 0.55 + R() * 0.5;
        props.confetti.push({ x: wx, y: wy, vx: Math.cos(ang) * sp * 0.6, vy: Math.sin(ang) * sp, rot: R() * 6, vr: (R() - .5) * 12, c: ['#3B5BFF', '#FFC93C', '#3DDC97', '#FF7AAE', '#8B5CF6'][i % 5], s: 0.012 + R() * 0.01, life: 0 });
      }
    }
  }
  // The board and the ladybug on its bar, in world units.
  const bugWorld = () => [BOARD_X - 0.22 * BOARD_S + 0.44 * BOARD_S * (0.1 + 0.8 * props.bug.x), BOARD_Y + 0.078 * BOARD_S - 0.016];
  const boardSpan = () => [BOARD_X - 0.24 * BOARD_S, BOARD_X + 0.24 * BOARD_S];
  const BOX_X = X2 + 0.24, BOX_TOP = 0.14 + 0.043;   // box centre, top of the closed lid (H units)

  // A ball bounces across the scene from right to left: everybody follows it with their
  // eyes and their body (lookAt), Meowuko jumps as it flies over.
  function ballWorld() {
    const B = props.ball, u = clamp((clock - B.t0) / B.dur);
    return [lerp(B.x0, B.x1, u), GROUND - 0.03 - Math.abs(Math.sin(u * Math.PI * 3.5)) * 0.26 * (1 - u * 0.45)];
  }
  function drawBall(c) {
    const B = props.ball;
    if (B.t0 < 0 || clock > B.t0 + B.dur) return;
    const [wx, wy] = ballWorld(), r = H * 0.03;
    c.fillStyle = 'rgba(30,20,10,.18)'; c.beginPath(); c.ellipse(sx(wx), GROUND * H, r * (1.1 - (GROUND - wy) * 1.5), r * 0.25, 0, 0, 7); c.fill();
    c.save(); c.translate(sx(wx), wy * H); c.rotate(-clock * 9);
    c.fillStyle = '#FFC93C'; c.strokeStyle = '#16161D'; c.lineWidth = H * 0.006;
    c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-r, 0); c.quadraticCurveTo(0, r * .5, r, 0); c.stroke();
    c.restore();
    const M = A.meowuko;
    if (!B.pounced && Math.abs(wx - M.x) < 0.08) { B.pounced = true; M.m.setState('success'); }
  }

  // A finger taps an actor (what a visitor can do on every mascot of the page).
  function tapWith(id, zone, n = 1, reaction) { props.finger = { id, zone, n, reaction, t0: clock, done: 0 }; }
  function fingerTarget(F) {
    const a = A[F.id], pose = a.m.getPose(); if (!pose) return null;
    const pt = F.zone === 'head' ? pose.head_center : F.zone === 'hand' ? pose.hand_R_center : [(pose.neck[0] + pose.pelvis[0]) / 2, (pose.neck[1] + pose.pelvis[1]) / 2];
    return toWorld(a, pt);
  }
  function drawFinger(c) {
    const F = props.finger; if (!F) return;
    const t = clock - F.t0, T0 = 0.7, gap = 0.3, end = T0 + (F.n - 1) * gap + 0.9;
    if (t > end) { props.finger = null; return; }
    const w = fingerTarget(F); if (!w) return;
    // Taps: at T0, T0 + gap… (the last one plays the given reaction).
    while (F.done < F.n && t >= T0 + F.done * gap) { F.done++; A[F.id].m.poke(F.zone, F.done === F.n ? F.reaction : undefined); }
    const inU = easeOut(t / T0), outU = clamp((t - (end - 0.35)) / 0.35);
    const k = F.done ? clamp((t - (T0 + (F.done - 1) * gap)) / 0.18) : 1, press = Math.sin(Math.PI * Math.min(1, k)) * (F.done ? 1 : 0);
    const x = sx(w[0]) + (1 - inU) * H * 0.25, y = w[1] * H + (1 - inU) * H * 0.3 + press * H * 0.012;
    c.save(); c.globalAlpha = Math.min(inU * 1.5, 1) * (1 - outU);
    if (F.done && k < 1) { c.strokeStyle = 'rgba(22,22,29,.55)'; c.lineWidth = H * 0.005; c.beginPath(); c.arc(sx(w[0]), w[1] * H, H * (0.02 + 0.05 * k), 0, 7); c.stroke(); }
    drawHand(c, x, y, H * 0.085);
    c.restore();
  }

  // A pointing hand, fingertip at (x, y) (drawn: emoji fonts differ between devices).
  function drawHand(c, x, y, s) {
    c.save(); c.translate(x, y); c.rotate(-0.35);
    c.fillStyle = '#FFFFFF'; c.strokeStyle = '#16161D'; c.lineWidth = s * 0.07; c.lineJoin = 'round';
    roundRect(c, -s * 0.11, 0, s * 0.22, s * 0.62, s * 0.11); c.fill(); c.stroke();                       // index finger
    roundRect(c, -s * 0.2, s * 0.44, s * 0.62, s * 0.52, s * 0.16); c.fill(); c.stroke();                 // fist
    c.beginPath(); for (const k of [0.14, 0.3]) { c.moveTo(s * k, s * 0.5); c.lineTo(s * k, s * 0.66); } c.stroke();   // folded fingers
    c.beginPath(); c.moveTo(-s * 0.2, s * 0.7); c.quadraticCurveTo(-s * 0.36, s * 0.62, -s * 0.3, s * 0.5); c.stroke();  // thumb
    c.restore();
  }
  // Actor box on screen: feet on the ground line, or on what it stands on (lift).
  function placeActor(a) {
    const h = UKO_H * a.scale * H, boxW = h * 1024 / 1536;
    a.el.style.transform = `translate(${(sx(a.x) - boxW / 2).toFixed(1)}px, ${((GROUND - a.lift) * H - FEET * h).toFixed(1)}px)`;
  }
  // Meowuko climbs onto the gift box from behind it (the box is drawn in front meanwhile).
  function climbOntoBox(id) {
    const a = A[id]; a.look = null; a.m.lookAt(null);
    props.climbing = true;
    a.m.climb({ onto: BOX_TOP / (UKO_H * a.scale), onDone: () => { a.lift = BOX_TOP; placeActor(a); props.climbing = false; } });
  }

  // Each step: { wait } | { run } | { until: () => bool }
  const STEPS = [
    // Dawn: Uko and Meowuko asleep side by side.
    { run() { caption('<uko-mascot state="sleep">'); focusX = X0 - 0.17; } },
    { wait: 3.2 },
    { run() { setSky('dawn', 3.2); } },
    { wait: 1.2 },
    { run() { tapWith('uko', 'head'); caption(window.ukoT ? ukoT('filmTapWake') : '👆 un tap, il se réveille'); } },
    { wait: 1.7 },
    { run() { A.meowuko.m.wake(); } },
    { wait: 1.4 },
    // Aituko arrives and says hello; the others turn to look.
    { run() { setSky('day', 3); walkTo('aituko', X0 - 0.7 * GAP); caption('<uko-mascot character="aituko" walk="true">'); look('uko', 'aituko'); look('meowuko', 'aituko'); turn('uko', -0.25); turn('meowuko', -0.3); } },
    { until: () => arrived('aituko') },
    { run() { state('aituko', 'welcome'); look('aituko', 'uko'); caption("aituko.setState('welcome')"); push(1.06, 2.4); } },
    { wait: 1.0 },
    { run() { state('uko', 'welcome'); } },
    { wait: 2.4 },
    // A ball bounces through: all three follow it, eyes and body.
    { run() { const vw = W / H; Object.assign(props.ball, { t0: clock, dur: 3.4, x0: camX + vw + 0.1, x1: camX - 0.15, pounced: false }); for (const a of actors()) look(a.id, ballWorld); caption('uko.lookAt(ball)'); } },
    { wait: 3.6 },
    { run() { lookAll(null); } },
    // Off to work, together.
    { run() { walkTo('aituko', X1 - 0.62 * GAP, 1.5); walkTo('uko', X1, 1.5); walkTo('meowuko', X1 - 0.31 * GAP, 1.5); caption('uko.startWalk()'); props.poi = boardSpan(); } },
    { until: () => arrived('aituko', 'uko', 'meowuko') },
    { run() { state('uko', 'loading'); caption("uko.setState('loading')"); progressTo(0.62, 4.6); props.barMood = 'load'; look('aituko', bugWorld()); look('meowuko', bugWorld()); turn('aituko', 0.2); } },
    { wait: 4.2 },
    // A bug on the bar: error, rain on Uko; Meowuko has an idea.
    { run() { props.bug = { on: true, x: 1.15, t0: clock, flyT0: -1 }; } },
    { wait: 1.3 },
    { run() { state('uko', 'error'); caption("uko.setState('error')"); props.barMood = 'error'; props.rain = { on: true, level: props.rain.level, t0: clock, flash: clock + 0.9, actor: 'uko' }; push(1.08, 2.8); look('meowuko', bugWorld()); } },
    { wait: 3.0 },
    { run() { state('meowuko', 'thinking'); caption('<uko-mascot character="meowuko" state="thinking">'); props.bulb = { t0: clock + 0.6, actor: 'meowuko' }; look('aituko', 'meowuko'); } },
    { wait: 2.4 },
    { run() { walkTo('meowuko', bugWorld()[0] - 0.02, 1.6); caption('meowuko.startWalk()'); } },
    { until: () => arrived('meowuko') },
    { run() { state('meowuko', 'success'); caption("meowuko.setState('success')"); props.bug.flyT0 = clock + 0.55; props.rain.on = false; look('uko', 'meowuko'); look('aituko', 'meowuko'); } },
    { wait: 1.6 },
    { run() { props.barMood = 'load'; progressTo(1, 1.1); state('uko', 'loading'); } },
    { wait: 1.3 },
    // Done: everybody jumps.
    { run() { lookAll(null); everyone('success'); caption('<uko-mascot state="success"> ×3'); props.barMood = 'done'; props.rainbow.t0 = clock; push(1.1, 3.2); } },
    { wait: 1.4 },
    { run() { for (const a of actors()) confetti(a); } },
    { wait: 2.6 },
    // Three taps on Meowuko's head: dizzy.
    { run() { tapWith('meowuko', 'head', 3, 'dizzy'); caption(window.ukoT ? ukoT('filmTapDizzy') : '👆👆👆 tout étourdi'); } },
    { wait: 3.2 },
    // Sunset: a gift box… that Meowuko opens. Empty.
    { run() { setSky('sunset', 9); walkTo('meowuko', X2 + 0.02, 1.7); walkTo('uko', X2 - 0.3 * GAP, 1.7); walkTo('aituko', X2 - 0.6 * GAP, 1.7); caption('uko.startWalk()'); props.poi = [BOX_X - 0.14, BOX_X + 0.14]; props.boxFront = true; } },
    { until: () => arrived('aituko', 'uko', 'meowuko') },
    { wait: 0.3 },
    { run() { props.box.t0 = clock; look('uko', [X2 + 0.24, GROUND - 0.1]); look('aituko', [X2 + 0.24, GROUND - 0.1]); } },
    { wait: 0.7 },
    { run() { state('meowuko', 'empty'); caption('<uko-mascot character="meowuko" state="empty">'); push(1.06, 2.2); } },
    { wait: 3.2 },
    // The lid closes again; the cat goes behind the box and climbs onto it.
    { run() { props.box.close = clock; } },
    { wait: 0.5 },
    { run() { walkTo('meowuko', BOX_X, 1.1); } },
    { until: () => arrived('meowuko') },
    { run() { climbOntoBox('meowuko'); caption('meowuko.climb({ onto: box })'); } },
    { until: () => !props.climbing },
    { wait: 0.8 },
    // Night: the three fall asleep.
    { run() { lookAll(null); setSky('night', 4); everyone('sleep'); caption('<uko-mascot state="sleep"> ×3'); } },
    { wait: 3.6 },
    { run() { titleEl.classList.add('show'); props.shoot.t0 = clock + 0.6; } },
    { wait: 4.6 },
    { run() { fadeEl.classList.add('show'); } },
    { wait: 0.9 },
    { run() { restart(); } }
  ];
  let stepIndex = 0, stepT0 = 0;
  function runScript() {
    while (stepIndex < STEPS.length) {
      const st = STEPS[stepIndex];
      if (st.run) { st.run(); stepIndex++; stepT0 = clock; continue; }
      if (st.wait !== undefined && clock - stepT0 < st.wait) return;
      if (st.until && !st.until()) return;
      stepIndex++; stepT0 = clock;
    }
  }
  function restart() {
    stepIndex = 0; stepT0 = clock = 0;
    camX = 0; focusX = X0;
    Object.assign(props, { progress: 0, progressTo: 0, progressFrom: 0, progressDur: 1, barMood: 'load', bug: { on: false, x: 1, t0: 0, flyT0: -1 }, bulb: { t0: -1, actor: null }, box: { open: 0, t0: -1, close: -1 }, confetti: [], dust: [], poi: null, ball: { t0: -1 }, finger: null, boxFront: false, rain: { on: false, level: 0, t0: -1, flash: -10, actor: null }, rainbow: { t0: -1 }, shoot: { t0: -1 } });
    Object.assign(cam, { z: 1, zTo: 1, shakeT0: -10, release: 0 });
    sky.from = sky.to = SKY.night;
    titleEl.classList.remove('show');
    destroyCast(); createCast();
    setTimeout(() => fadeEl.classList.remove('show'), 80);
  }

  // ---------------------------------------------------------------- coords
  const sx = wx => (wx - camX) * H;               // world → screen x
  function toWorld(a, p) {                         // actor viewBox point → world
    const s = UKO_H * a.scale / 1536;
    return [a.x + (p[0] - 512) * s, GROUND - a.lift - (FEET * 1536 - p[1]) * s];
  }
  function toView(a, [wx, wy]) {                   // world → actor viewBox point
    const s = UKO_H * a.scale / 1536;
    return { x: 512 + (wx - a.x) / s, y: FEET * 1536 - (GROUND - a.lift - wy) / s, viewBox: true };
  }
  function updateGazes() {
    for (const a of actors()) {
      if (!a.look || a.target !== null) continue;
      let w = a.look;
      if (typeof w === 'function') w = w();
      if (typeof w === 'string') { const o = A[w], pose = o.m.getPose(); if (!pose) continue; w = toWorld(o, pose.head_center); }
      a.m.lookAt(toView(a, w));
    }
  }

  // ---------------------------------------------------------------- draw
  function drawSky(s) {
    const g = bgc.createLinearGradient(0, 0, 0, H * GROUND);
    g.addColorStop(0, s.top); g.addColorStop(1, s.bottom);
    bgc.fillStyle = g; bgc.fillRect(0, 0, W, H);
    if (s.stars > 0.01) {
      for (const st of STARS) {
        const a = s.stars * (0.55 + 0.45 * Math.sin(clock * 2 + st.tw));
        bgc.fillStyle = `rgba(255,248,225,${a})`;
        const x = ((st.x * W * 1.6 - camX * H * 0.05) % (W * 1.6) + W * 1.6) % (W * 1.6) - W * 0.3;
        star(bgc, x, st.y * H, st.r * (H / 500));
      }
    }
    // Moon (paper crescent) and sun (paper flower with a face).
    if (s.moon > 0.01) {
      const mx = W * 0.8, my = H * 0.2, r = H * 0.06;
      bgc.save(); bgc.globalAlpha = s.moon; bgc.drawImage(crescent(r), mx - r, my - r, r * 2, r * 2); bgc.restore();
    }
    const sunY = lerp(H * 0.9, H * 0.16, clamp(s.sun));
    if (s.sun > -0.1) sun(bgc, W * 0.22, sunY, H * 0.07, clock);
  }
  // Paper crescent, cut on its own small canvas (cutting on the scene would erase the sky).
  const moonCanvas = document.createElement('canvas');
  function crescent(r) {
    const size = Math.ceil(r * 2 * DPR);
    if (moonCanvas.width !== size) {
      moonCanvas.width = moonCanvas.height = size;
      const m = moonCanvas.getContext('2d'), k = size / 2;
      m.fillStyle = '#FFF4D6'; m.beginPath(); m.arc(k, k, k, 0, 7); m.fill();
      m.globalCompositeOperation = 'destination-out';
      m.beginPath(); m.arc(k + k * .45, k - k * .25, k * .9, 0, 7); m.fill();
    }
    return moonCanvas;
  }
  function star(c, x, y, r) {
    c.beginPath();
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * .45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.fill();
  }
  function sun(c, x, y, r, t) {
    // Round yellow sun: short rounded rays that breathe, kawaii face.
    c.save(); c.translate(x, y); c.rotate(t * 0.12);
    c.strokeStyle = '#FFC93C'; c.lineCap = 'round'; c.lineWidth = r * 0.16;
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6, k = 1 + 0.06 * Math.sin(t * 3 + i);
      c.beginPath(); c.moveTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95); c.lineTo(Math.cos(a) * r * 1.3 * k, Math.sin(a) * r * 1.3 * k); c.stroke();
    }
    c.restore();
    c.fillStyle = '#FFD84D'; c.strokeStyle = '#16161D'; c.lineWidth = r * 0.06;
    c.beginPath(); c.arc(x, y, r * 0.78, 0, 7); c.fill(); c.stroke();
    c.fillStyle = '#16161D';
    c.beginPath(); c.arc(x - r * .24, y - r * .08, r * .07, 0, 7); c.arc(x + r * .24, y - r * .08, r * .07, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,122,174,.65)';
    c.beginPath(); c.ellipse(x - r * .42, y + r * .12, r * .12, r * .07, 0, 0, 7); c.ellipse(x + r * .42, y + r * .12, r * .12, r * .07, 0, 0, 7); c.fill();
    c.strokeStyle = '#16161D'; c.lineWidth = r * .06;
    c.beginPath(); c.arc(x, y + r * .05, r * .16, 0.3, Math.PI - 0.3); c.stroke();
  }
  function drawClouds(s) {
    for (const cl of CLOUDS) {
      const x = (((cl.x + clock * cl.v) * H - camX * H * 0.1) % (W + H * 0.6) + (W + H * 0.6)) % (W + H * 0.6) - H * 0.3;
      const y = cl.y * H, r = H * 0.045 * cl.s;
      bgc.fillStyle = s.stars > 0.5 ? 'rgba(210,214,245,.35)' : 'rgba(255,255,255,.95)';
      bgc.beginPath();
      bgc.arc(x, y, r, 0, 7); bgc.arc(x + r * 1.1, y - r * .45, r * 1.2, 0, 7); bgc.arc(x + r * 2.3, y, r, 0, 7);
      bgc.rect(x, y - r * .2, r * 2.3, r); bgc.fill();
    }
  }
  function drawLayers(s) {
    const night = clamp(s.stars);
    for (const L of LAYERS) {
      const span = WORLD + W / H + 1;
      const xOf = x => (x * span - camX * L.p) * H - H * 0.5;
      const yOf = y => y * H;
      bgc.save();
      bgc.shadowColor = 'rgba(40,20,10,.18)'; bgc.shadowBlur = H * 0.02; bgc.shadowOffsetY = H * 0.006;
      bgc.fillStyle = mix(L.fringe, '#9A9CD8', night * .6);
      bgc.save(); bgc.translate(0, -H * 0.006); tornPath(bgc, L.pts, xOf, yOf, H); bgc.fill(); bgc.restore();
      bgc.shadowColor = 'transparent';
      bgc.fillStyle = mix(L.day, L.night, night);
      tornPath(bgc, L.pts, xOf, yOf, H); bgc.fill();
      bgc.restore();
      if (L.p === 0.42) for (const tr of TREES) {
        const x = xOf(tr.x / span), baseY = yOf(sampleRidge(L.pts, tr.x / span)) + H * 0.01;
        if (x < -50 || x > W + 50) continue;
        const h = H * 0.08 * tr.s, sway = Math.sin(clock * 1.3 + tr.x * 2.1) * h * 0.07;
        bgc.strokeStyle = mix('#16161D', '#2A2440', night); bgc.lineWidth = H * 0.006; bgc.lineCap = 'round';
        bgc.beginPath(); bgc.moveTo(x, baseY); bgc.quadraticCurveTo(x, baseY - h * .5, x + sway, baseY - h); bgc.stroke();
        bgc.fillStyle = mix(tr.c, '#3E4C7A', night * .8);
        bgc.beginPath(); bgc.arc(x + sway, baseY - h, h * 0.42, 0, 7); bgc.fill();
      }
    }
  }
  function sampleRidge(pts, x) {
    const i = clamp(Math.floor(x * (pts.length - 1)), 0, pts.length - 2), f = x * (pts.length - 1) - i;
    return lerp(pts[i][1], pts[i + 1][1], f);
  }
  function drawGround(s) {
    const night = clamp(s.stars), y = GROUND * H;
    bgc.fillStyle = mix('#F5F8FF', '#8C88C4', night * .7);
    bgc.beginPath(); bgc.moveTo(0, H);
    for (let x = 0; x <= W + 12; x += 12) bgc.lineTo(x, y - H * 0.006 * Math.sin((x + camX * H) * 0.05));
    bgc.lineTo(W, H); bgc.closePath(); bgc.fill();
    bgc.strokeStyle = mix('#16161D', '#2A2660', night); bgc.lineWidth = Math.max(1.5, H * 0.004); bgc.lineCap = 'round';
    bgc.beginPath(); bgc.moveTo(0, y); for (let x = 0; x <= W + 12; x += 12) bgc.lineTo(x, y - H * 0.006 * Math.sin((x + camX * H) * 0.05)); bgc.stroke();
    bgc.lineWidth = Math.max(1, H * 0.003);
    for (const gr of GRASS) {
      const x = sx(gr.x); if (x < -10 || x > W + 10) continue;
      const wind = Math.sin(clock * 2.2 + gr.x * 3) * H * 0.004;
      bgc.beginPath(); bgc.moveTo(x, y + H * 0.02); bgc.lineTo(x - H * 0.006 + wind, y + H * 0.02 - gr.h * H);
      bgc.moveTo(x, y + H * 0.02); bgc.lineTo(x + H * 0.006 + wind, y + H * 0.02 - gr.h * H * 0.8); bgc.stroke();
    }
  }
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function drawBoard() {
    // Planted on the hill behind the path: Uko walks in front of it.
    const bx = sx(BOARD_X), by = H * BOARD_Y, bw = H * 0.44 * BOARD_S, bh = H * 0.15 * BOARD_S, foot = H * (GROUND - 0.05);
    if (bx < -bw || bx > W + bw) return;
    const ink = '#1B1B1F';
    bgc.strokeStyle = ink; bgc.lineWidth = H * 0.007; bgc.lineCap = 'round';
    bgc.beginPath(); bgc.moveTo(bx - bw * .32, by + bh); bgc.lineTo(bx - bw * .32, foot); bgc.moveTo(bx + bw * .32, by + bh); bgc.lineTo(bx + bw * .32, foot); bgc.stroke();
    bgc.fillStyle = 'rgba(40,20,10,.15)'; bgc.beginPath(); bgc.ellipse(bx, foot + H * 0.004, bw * .42, H * 0.008, 0, 0, 7); bgc.fill();
    bgc.save(); bgc.translate(bx, by + bh / 2); bgc.rotate(-0.02);
    bgc.shadowColor = 'rgba(40,20,10,.2)'; bgc.shadowBlur = H * 0.02; bgc.shadowOffsetY = H * 0.008;
    bgc.fillStyle = '#FFFDF7'; roundRect(bgc, -bw / 2, -bh / 2, bw, bh, H * 0.01); bgc.fill();
    bgc.shadowColor = 'transparent';
    bgc.lineWidth = H * 0.006; bgc.stroke();
    const fx = -bw * .4, fy = bh * 0.02, fw = bw * .8, fh = bh * .3;
    const col = props.barMood === 'error' ? '#FF5A6E' : props.barMood === 'done' ? '#2FCB8A' : '#3B5BFF';
    bgc.fillStyle = col; roundRect(bgc, fx, fy, Math.max(fh, fw * props.progress), fh, fh / 2); bgc.fill();
    bgc.lineWidth = H * 0.005; roundRect(bgc, fx, fy, fw, fh, fh / 2); bgc.stroke();
    bgc.fillStyle = ink; bgc.font = `700 ${H * 0.055 * BOARD_S}px Caveat, cursive`; bgc.textBaseline = 'alphabetic';
    const t = window.ukoT || (k => ({ filmError: 'erreur 404 ?!', filmDone: 'terminé ✓', filmLoading: 'chargement…' })[k]);
    const label = props.barMood === 'error' ? t('filmError') : props.barMood === 'done' ? t('filmDone') : `${t('filmLoading')} ${Math.round(props.progress * 100)}%`;
    bgc.fillText(label, fx, -bh * .12);
    bgc.restore();
    // Ladybug on the bar.
    const b = props.bug;
    if (b.on && b.flyT0 < 0 || b.on && clock < b.flyT0) {
      const u = easeOut((clock - b.t0) / 1.2);
      b.x = lerp(1.15, 0.64, u);
      drawBug(bgc, bx - bw / 2 + bw * (0.1 + 0.8 * b.x), by + bh / 2 + bh * 0.02 - H * 0.012, H * 0.024 * BOARD_S, clock);
    }
  }
  function drawBug(c, x, y, r, t) {
    c.strokeStyle = '#1B1B1F'; c.lineWidth = r * .18; c.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      const w = Math.sin(t * 18 + i) * r * .15;
      c.beginPath(); c.moveTo(x + i * r * .5, y); c.lineTo(x + i * r * .7 + w, y + r * 1.05); c.stroke();
    }
    c.fillStyle = '#E4513B'; c.beginPath(); c.arc(x, y, r, Math.PI, 0); c.fill(); c.stroke();
    c.fillStyle = '#1B1B1F'; c.beginPath(); c.arc(x - r * .95, y - r * .15, r * .38, 0, 7); c.fill();
    c.beginPath(); c.arc(x + r * .35, y - r * .5, r * .16, 0, 7); c.arc(x - r * .2, y - r * .35, r * .14, 0, 7); c.fill();
    c.beginPath(); c.moveTo(x, y - r); c.lineTo(x, y); c.stroke();
  }
  function drawBox(c) {
    // Gift box with a ribbon; the lid pops open and it turns out to be empty.
    const x = sx(X2 + 0.24), y = GROUND * H, w = H * 0.2, h = H * 0.14;
    if (x < -w * 2 || x > W + w * 2) return;
    const open = props.box.t0 < 0 ? 0 : easeOut((clock - props.box.t0) / 0.8) * (props.box.close < 0 ? 1 : 1 - easeOut((clock - props.box.close) / 0.5));
    c.save(); c.translate(x, y);
    c.lineWidth = H * 0.006; c.strokeStyle = '#16161D'; c.lineJoin = 'round';
    // body
    c.fillStyle = '#6C8BFF'; c.fillRect(-w / 2, -h, w, h); c.strokeRect(-w / 2, -h, w, h);
    c.fillStyle = '#FF7AAE'; c.fillRect(-w * .07, -h, w * .14, h); c.strokeRect(-w * .07, -h, w * .14, h);
    // lid: lifts and tilts away
    c.save(); c.translate(w / 2, -h - H * 0.004); c.rotate(-open * 0.9); c.translate(-open * w * .15, -open * h * .6);
    c.fillStyle = '#8FA6FF'; c.fillRect(-w * 1.06, -h * .28, w * 1.12, h * .28); c.strokeRect(-w * 1.06, -h * .28, w * 1.12, h * .28);
    c.fillStyle = '#FF7AAE'; c.fillRect(-w * .57, -h * .28, w * .14, h * .28);
    c.beginPath(); c.ellipse(-w * .5 - w * .12, -h * .36, w * .12, h * .12, -0.5, 0, 7); c.ellipse(-w * .5 + w * .12, -h * .36, w * .12, h * .12, 0.5, 0, 7); c.fill(); c.stroke();
    c.restore();
    c.fillStyle = '#16161D'; c.font = `700 ${H * 0.04}px Caveat, cursive`; c.textAlign = 'center';
    c.fillText(window.ukoT ? ukoT('filmGift') : 'cadeau ?', 0, h * .45); c.textAlign = 'left';
    c.restore();
    if (open > 0.6 && props.dust.length === 0 && clock - props.box.t0 < 1) {
      for (let i = 0; i < 14; i++) props.dust.push({ x: X2 + 0.24 + (R() - .5) * 0.12, y: GROUND - 0.15, vx: (R() - .5) * 0.12, vy: -0.08 - R() * 0.1, life: 0 });
    }
  }
  // The ladybug takes off from the bar when Meowuko jumps, loops once and flies away.
  function drawFlyingBug(c) {
    const b = props.bug; if (!b.on || b.flyT0 < 0 || clock < b.flyT0) return;
    const u = (clock - b.flyT0) / 2.2; if (u > 1) return;
    const [bx, by] = bugWorld();
    const x = sx(bx) + (u * u * 1.4 * H) + Math.sin(u * 9) * H * 0.05, y = (by - u * 0.45 - Math.sin(u * Math.PI) * 0.08) * H;
    const r = H * 0.022, flap = Math.abs(Math.sin(clock * 30));
    c.save(); c.fillStyle = 'rgba(255,255,255,.85)'; c.strokeStyle = '#1B1B1F'; c.lineWidth = r * .12;
    for (const d of [-1, 1]) { c.beginPath(); c.ellipse(x + d * r * .6, y - r * .9, r * .45, r * (.3 + .5 * flap), d * .6, 0, 7); c.fill(); c.stroke(); }
    c.restore();
    drawBug(c, x, y, r, clock);
  }
  function drawBulb(c) {
    const B = props.bulb;
    if (B.t0 < 0 || !B.actor || clock < B.t0) return;
    const age = clock - B.t0;
    if (age > 3.2) { B.t0 = -1; return; }
    const a = A[B.actor], pose = a.m.getPose(); if (!pose) return;
    const [hx, hy] = toWorld(a, pose.head_center);
    const x = sx(hx) + H * 0.1, y = hy * H - H * 0.2, r = H * 0.035;
    const draw = clamp(age / 0.8), alpha = age > 2.7 ? 1 - (age - 2.7) / 0.5 : 1;
    c.save(); c.globalAlpha = clamp(alpha);
    c.strokeStyle = '#1B1B1F'; c.lineWidth = H * 0.005; c.lineCap = 'round';
    c.fillStyle = `rgba(246,196,83,${draw})`;
    c.beginPath(); c.arc(x, y, r, Math.PI * 0.8, Math.PI * 0.8 + Math.PI * 1.4 * draw); c.fill(); c.stroke();
    if (draw >= 1) {
      c.beginPath(); c.moveTo(x - r * .5, y + r * .95); c.lineTo(x + r * .5, y + r * .95); c.moveTo(x - r * .4, y + r * 1.25); c.lineTo(x + r * .4, y + r * 1.25); c.stroke();
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.55, p = 1 + 0.1 * Math.sin(clock * 10); c.beginPath(); c.moveTo(x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 1.5); c.lineTo(x + Math.cos(a) * r * 2 * p, y + Math.sin(a) * r * 2 * p); c.stroke(); }
    }
    c.restore();
  }
  function stepParticles(c, dt) {
    for (const p of props.confetti) {
      p.life += dt; p.vy += 1.1 * dt; p.vx *= Math.pow(0.35, dt); p.vy *= Math.pow(0.55, dt);
      p.x += (p.vx + Math.sin(p.life * 6 + p.rot) * 0.05) * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.y > GROUND) { p.y = GROUND; p.vx = 0; p.vy = 0; p.vr = 0; }
      c.save(); c.translate(sx(p.x), p.y * H); c.rotate(p.rot); c.scale(1, Math.cos(p.life * 8 + p.rot) || .1);
      c.globalAlpha = clamp(3.5 - p.life); c.fillStyle = p.c; c.fillRect(-p.s * H / 2, -p.s * H / 4, p.s * H, p.s * H / 2); c.restore();
    }
    props.confetti = props.confetti.filter(p => p.life < 3.5);
    for (const d of props.dust) {
      d.life += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy *= Math.pow(0.4, dt);
      c.fillStyle = `rgba(150,160,210,${clamp(0.6 - d.life * 0.4)})`;
      c.beginPath(); c.arc(sx(d.x), d.y * H, H * 0.01 * (1 + d.life), 0, 7); c.fill();
    }
    props.dust = props.dust.filter(d => d.life < 1.6);
  }

  // ---------------------------------------------------------------- weather & life
  function drawRainbow(s) {
    const t0 = props.rainbow.t0; if (t0 < 0) return;
    const age = clock - t0, grow = easeOut(age / 1.6), fade = clamp((22 - age) / 3) * clamp(1 - s.stars * 1.5);
    if (fade <= 0) return;
    const cx = sx(X1 + 0.36), cy = GROUND * H + H * 0.1, r0 = H * 0.62;
    const bands = ['#FF5A6E', '#FF9E3D', '#FFC93C', '#3DDC97', '#3B5BFF', '#8B5CF6'];
    bgc.save(); bgc.globalAlpha = 0.55 * fade; bgc.lineWidth = H * 0.022; bgc.lineCap = 'round';
    bands.forEach((c, i) => { bgc.strokeStyle = c; bgc.beginPath(); bgc.arc(cx, cy, r0 - i * H * 0.022, Math.PI, Math.PI + Math.PI * grow); bgc.stroke(); });
    bgc.restore();
  }
  function drawBirds(s) {
    const day = clamp(s.sun * 1.4) * (1 - clamp(s.stars * 2));
    if (day <= 0.02) return;
    bgc.save(); bgc.strokeStyle = `rgba(27,27,31,${0.75 * day})`; bgc.lineWidth = Math.max(1.2, H * 0.004); bgc.lineCap = 'round';
    for (const b of BIRDS) {
      const x = ((clock * b.v + b.off) % 1.6) * (W + H * 0.4) - H * 0.2, y = b.y * H + Math.sin(clock * 0.9 + b.ph) * H * 0.02;
      const f = Math.sin(clock * 9 + b.ph) * 0.6, w = H * 0.018 * b.s;
      bgc.beginPath(); bgc.moveTo(x - w, y - w * f * .6); bgc.quadraticCurveTo(x - w * .4, y - w * .5, x, y); bgc.quadraticCurveTo(x + w * .4, y - w * .5, x + w, y - w * f * .6); bgc.stroke();
    }
    bgc.restore();
  }
  function drawButterflies(c, s) {
    const day = clamp(s.sun * 1.6) * (1 - clamp(s.stars * 2));
    if (day <= 0.02) return;
    for (const b of BUTTERFLIES) {
      const wx = b.x + Math.sin(clock * 0.7 + b.ph) * 0.18, wy = b.y + Math.sin(clock * 1.9 + b.ph) * 0.05;
      const x = sx(wx), y = wy * H; if (x < -30 || x > W + 30) continue;
      const flap = Math.abs(Math.sin(clock * 14 + b.ph)), r = H * 0.014;
      c.save(); c.globalAlpha = day; c.translate(x, y); c.rotate(Math.sin(clock * 2 + b.ph) * .3);
      c.fillStyle = b.c; c.strokeStyle = '#1B1B1F'; c.lineWidth = Math.max(1, H * 0.0025);
      for (const d of [-1, 1]) { c.beginPath(); c.ellipse(d * r * .8 * (.3 + .7 * flap), -r * .2, r * (.3 + .7 * flap), r * .75, d * .5, 0, 7); c.fill(); c.stroke(); }
      c.beginPath(); c.moveTo(0, -r * .6); c.lineTo(0, r * .6); c.stroke();
      c.restore();
    }
  }
  function drawFireflies(c, s) {
    const night = clamp((s.stars - .25) * 1.6);
    if (night <= 0.02) return;
    for (const f of FIREFLIES) {
      const x = sx(f.x + Math.sin(clock * f.sp + f.ph) * 0.05), y = (f.y + Math.cos(clock * f.sp * 1.3 + f.ph) * 0.03) * H;
      if (x < -20 || x > W + 20) continue;
      const a = night * (0.35 + 0.65 * Math.pow(Math.max(0, Math.sin(clock * 2.3 + f.ph * 3)), 3));
      const g = c.createRadialGradient(x, y, 0, x, y, H * 0.022);
      g.addColorStop(0, `rgba(255,236,150,${a})`); g.addColorStop(1, 'rgba(255,236,150,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, H * 0.022, 0, 7); c.fill();
    }
  }
  function drawShootingStar(s) {
    const t0 = props.shoot.t0; if (t0 < 0 || s.stars < .4) return;
    const u = (clock - t0) / 1.1; if (u < 0 || u > 1) return;
    const x = lerp(W * .95, W * .45, u), y = lerp(H * .06, H * .3, u), len = H * .22 * Math.sin(Math.PI * u);
    const g = bgc.createLinearGradient(x, y, x + len, y - len * .5);
    g.addColorStop(0, 'rgba(255,248,225,.95)'); g.addColorStop(1, 'rgba(255,248,225,0)');
    bgc.save(); bgc.strokeStyle = g; bgc.lineWidth = H * 0.006; bgc.lineCap = 'round';
    bgc.beginPath(); bgc.moveTo(x, y); bgc.lineTo(x + len, y - len * .5); bgc.stroke(); bgc.restore();
  }
  // Grumpy paper cloud that follows Uko on the error, rains, then leaves.
  function drawRain(c, dt) {
    const rn = props.rain;
    rn.level += ((rn.on ? 1 : 0) - rn.level) * (1 - Math.exp(-dt * (rn.on ? 2.2 : 1.4)));
    if (rn.level < 0.01 || !rn.actor) return;
    const a = A[rn.actor], pose = a.m.getPose(); if (!pose) return;
    const [hx, hy] = toWorld(a, pose.head_center);
    const lv = rn.level, cx = sx(hx) + (rn.on ? 0 : (1 - lv) * W * .5), cy = (hy - 0.24) * H - (1 - lv) * H * .25, r = H * 0.06;
    // rain streaks
    c.save(); c.strokeStyle = `rgba(59,91,255,${0.55 * lv})`; c.lineWidth = Math.max(1.2, H * 0.004); c.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const k = (i * 0.618) % 1, fall = ((clock * 1.6 + k * 3.1) % 1);
      const x = cx - r * 1.9 + k * r * 3.8, y0 = cy + r * .6, y = y0 + fall * (GROUND * H - y0);
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - H * 0.006, y + H * 0.03); c.stroke();
    }
    c.restore();
    c.save(); c.globalAlpha = lv; c.translate(cx, cy);
    c.fillStyle = '#8E93B8'; c.strokeStyle = '#1B1B1F'; c.lineWidth = Math.max(1.5, H * 0.005);
    c.beginPath(); c.arc(-r * 1.1, r * .15, r * .75, Math.PI * .5, Math.PI * 1.5); c.arc(-r * .2, -r * .35, r, Math.PI, 0); c.arc(r * .95, r * .1, r * .8, Math.PI * 1.4, Math.PI * .5); c.closePath(); c.fill(); c.stroke();
    // little grumpy face
    c.fillStyle = '#1B1B1F';
    c.beginPath(); c.arc(-r * .45, r * .05, r * .09, 0, 7); c.arc(r * .35, r * .05, r * .09, 0, 7); c.fill();
    c.beginPath(); c.arc(-r * .05, r * .5, r * .22, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
    c.restore();
    // thunder: one flash + a small camera shake
    const fl = clock - rn.flash;
    if (fl >= 0 && fl < 0.35) { cam.shakeT0 = rn.flash; c.fillStyle = `rgba(255,255,255,${0.55 * (1 - fl / 0.35)})`; c.fillRect(0, 0, W, H); }
  }
  function applyCamera(dt) {
    if (cam.release && clock > cam.release) { cam.zTo = 1; cam.release = 0; }
    cam.z += (cam.zTo - cam.z) * (1 - Math.exp(-dt * 2.6));
    const sh = clamp(1 - (clock - cam.shakeT0) / 0.5), jx = sh * Math.sin(clock * 83) * H * 0.008, jy = sh * Math.cos(clock * 71) * H * 0.006;
    const ox = sx(focusX), oy = (GROUND - UKO_H * 0.45) * H;
    camEl.style.transformOrigin = `${ox}px ${oy}px`;
    camEl.style.transform = `translate(${jx.toFixed(2)}px, ${jy.toFixed(2)}px) scale(${cam.z.toFixed(4)})`;
  }

  // ---------------------------------------------------------------- loop
  let last = null;
  function frame(now) {
    const dt = last === null ? 0 : Math.min(0.05, (now - last) / 1000);
    last = now;
    if (playing && visible) {
      clock += dt;
      runScript();
      // Walk: move each actor by its engine's ground speed (the planted foot stays put),
      // and stop it on its mark.
      for (const a of actors()) {
        if (a.target === null) continue;
        const v = a.m.getWalkVelocity() * UKO_H * a.scale / 1536;   // H units per second
        const before = a.target - a.x;
        a.x += v * dt;
        if ((a.target - a.x) * before <= 0 && v !== 0) { a.x = a.target; a.target = null; a.m.stopWalk(); }
      }
      updateGazes();
      const pr = clamp((clock - props.progressT0) / props.progressDur);
      props.progress = lerp(props.progressFrom, props.progressTo, easeOut(pr));
      // The camera frames the group and the prop of the scene (board, box) when both fit,
      // and never lets an actor on screen slip out of the frame (the one walking ahead).
      const on = actors().filter(a => a.x > camX - 0.3 || a.target !== null);
      const half = UKO_H * 0.2, vw = W / H / cam.z, m = 0.03;
      if (on.length) {
        let lo = Math.min(...on.map(a => a.x - half)), hi = Math.max(...on.map(a => a.x + half));
        if (props.poi) { const l2 = Math.min(lo, props.poi[0]), h2 = Math.max(hi, props.poi[1]); if (h2 - l2 + 2 * m <= vw) { lo = l2; hi = h2; } }
        focusX += ((lo + hi) / 2 - focusX) * (1 - Math.exp(-dt * 3));
      }
      const target = clamp(focusX - vw * 0.5, 0, WORLD - W / H);
      camX += (target - camX) * (1 - Math.exp(-dt * 2.2));
      for (const a of on) {
        const over = a.x + half + m - (camX + vw), under = camX - (a.x - half - m);
        if (over > 0 && under < 0) camX += over * (1 - Math.exp(-dt * 10));
        else if (under > 0 && over < 0) camX -= under * (1 - Math.exp(-dt * 10));
      }
      camX = clamp(camX, 0, WORLD - W / H);
    }
    // Off screen the canvases keep their last picture: nothing to draw.
    if (visible) render(playing ? dt : 0);
    requestAnimationFrame(frame);
  }
  function render(dt) {
    if (!W || !H) return;
    const s = skyNow();
    drawSky(s); drawShootingStar(s); drawClouds(s); drawBirds(s); drawRainbow(s); drawLayers(s); drawGround(s); drawBoard(); if (!props.boxFront) drawBox(bgc);
    if (!grainPattern) grainPattern = bgc.createPattern(grain, 'repeat');
    bgc.save(); bgc.globalCompositeOperation = 'multiply'; bgc.globalAlpha = 0.22; bgc.fillStyle = grainPattern; bgc.fillRect(0, 0, W, H); bgc.restore();
    if (s.tint > 0.01) { bgc.fillStyle = `rgba(30,27,75,${s.tint * 0.35})`; bgc.fillRect(0, 0, W, H); }

    // Actors: feet on the ground line.
    for (const a of actors()) placeActor(a);

    fgc.clearRect(0, 0, W, H);
    drawFireflies(fgc, s); drawButterflies(fgc, s); drawRain(fgc, dt);
    drawFlyingBug(fgc); drawBulb(fgc); stepParticles(fgc, dt); if (props.boxFront) drawBox(fgc); drawBall(fgc); drawFinger(fgc);
    applyCamera(dt); typeCaption();
  }

  // ---------------------------------------------------------------- controls
  function setPlaying(v) {
    playing = v;
    toggle.textContent = v ? '❚❚' : '▶';
    toggle.setAttribute('aria-label', window.ukoT ? window.ukoT(v ? 'filmPause' : 'filmPlay') : (v ? 'Mettre en pause' : 'Lire le film'));
    for (const a of actors()) (v && visible) ? a.m.resume() : a.m.pause();
  }
  toggle.addEventListener('click', () => setPlaying(!playing));
  new IntersectionObserver(es => es.forEach(e => {
    visible = e.isIntersecting;
    for (const a of actors()) if (a) (playing && visible) ? a.m.resume() : a.m.pause();
  }), { threshold: 0.15 }).observe(root);

  // Read-only QA hook (film time, current step, mascot position).
  root.ukoFilm = { get clock() { return clock; }, get step() { return stepIndex; }, get actors() { return actors().map(a => ({ id: a.id, x: a.x, state: a.m.getState() })); }, get mascot() { return A.uko && A.uko.m; }, restart };

  resize();
  new ResizeObserver(resize).observe(root);
  createCast();
  if (reduced) {
    // Still frame: daylight, the three standing together in front of the board.
    sky.from = sky.to = SKY.day; stepIndex = STEPS.length;
    [['aituko', X1 - 0.62 * GAP], ['meowuko', X1 - 0.31 * GAP], ['uko', X1]].forEach(([id, x]) => { A[id].x = x; A[id].m.setState('idle'); });
    focusX = X1 - 0.3; camX = clamp(focusX - (W / H) * 0.5, 0, WORLD - W / H); setPlaying(false);
  }
  (document.fonts && document.fonts.load ? document.fonts.load('700 30px Caveat') : Promise.resolve()).finally(() => requestAnimationFrame(frame));
})();
