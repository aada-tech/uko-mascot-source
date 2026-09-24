#!/usr/bin/env node
// Builds dist/uko.riv — the Uko mascot as a native Rive file, rigged with bones:
// a node hierarchy (body → upper arm → forearm → hand, body → thigh → shin → foot,
// body → head → gaze) whose animations key rotations and a few offsets, not the
// vertices of every stroke. Clips are baked from the engine (rive/build/frames.json);
// the life layer ships as short base loops plus gesture clips that the "Uko"
// state machine chains with varied waits, so the character never visibly loops.
// Binary format: Rive 7 (field/type ids from rive-app/rive-runtime, MIT),
// same serializer as tools/rive_compiler/build_doberman_rive.py.
//   node mascot_engine/rive/extract_frames.cjs && node mascot_engine/rive/build_uko_rive.cjs
//   … --starter → dist/starter/uko-starter.riv (free edition: idle, welcome, loading, success;
//                  same inputs and numbering, so moving to the full file is a drop-in swap)
//   … --character aituko|meowuko → dist/aituko.riv, dist/meowuko.riv (same skeleton, same
//                  state machine "Uko" and inputs: swapping characters is a drop-in too)
const fs = require('fs');
const path = require('path');

const argi = process.argv.indexOf('--character');
const CHARACTER = argi > 0 ? process.argv[argi + 1] : 'uko';
const ARTBOARD_NAME = { uko: 'Uko', aituko: 'Aituko', meowuko: 'Meowuko' }[CHARACTER];
if (!ARTBOARD_NAME) throw new Error(`unknown character ${CHARACTER}`);
const SRC = path.join(__dirname, 'build', CHARACTER === 'uko' ? 'frames.json' : `frames-${CHARACTER}.json`);
const STARTER = process.argv.includes('--starter');
const OUT = STARTER ? path.join(__dirname, '..', 'dist', 'starter', `${CHARACTER}-starter.riv`) : path.join(__dirname, '..', 'dist', `${CHARACTER}.riv`);
const DATA = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const STARTER_CLIPS = ['Idle', 'IdleGlance', 'IdleLookUp', 'IdleShrug', 'IdleTap', 'Welcome', 'Success',
  'LoadingEnter', 'Loading', 'LoadCheck', 'LoadLean', 'LoadPeek', 'LoadSigh', 'LoadTap', 'LoadingExit', 'LoadingToSuccess'];
if (STARTER) DATA.clips = DATA.clips.filter(c => STARTER_CLIPS.includes(c.name));
// Keys at 30 fps (the runtime interpolates at display rate); transitions out of Loading
// keep only their first part (laptop pop/drop + blend), then chain into Success / Error.
const FPS = 30, STEP = DATA.fps / FPS;
const TRIM = { LoadingToSuccess: 450, LoadingToError: 560,
  // One-shots: keep 350 ms of their return to rest; the state machine's mix does the rest.
  Welcome: 3200 + 350, Success: 3600 + 350, Error: 3800 + 350, Empty: 3400 + 350, Wake: 2200 + 350 };
for (const c of DATA.clips) {
  if (TRIM[c.name]) c.frames = c.frames.slice(0, Math.round(TRIM[c.name] / 1000 * DATA.fps) + 1);
  c.frames = c.frames.filter((_, i) => i % STEP === 0);
}
const BIND_COLORS = !process.argv.includes('--no-bind');

// ---------------------------------------------------------------- binary
const FLOAT = new Set([7, 8, 13, 14, 15, 16, 17, 18, 20, 21, 24, 25, 26, 47, 58, 63, 64, 65, 66, 70, 84, 85, 86, 87, 123, 124, 140, 157, 166]);
const STRING = new Set([4, 55, 138, 557]);
const COLOR = new Set([37, 555]);
const BYTES = new Set([588]);
const uint = v => { v = Math.max(0, Math.round(v)); const b = []; while (v > 127) { b.push((v & 127) | 128); v = Math.floor(v / 128); } b.push(v); return Buffer.from(b); };
function value(k, v) {
  if (BYTES.has(k)) return Buffer.concat([uint(v.length), Buffer.from(v)]);
  if (FLOAT.has(k)) { const b = Buffer.alloc(4); b.writeFloatLE(v); return b; }
  if (COLOR.has(k)) { const b = Buffer.alloc(4); b.writeUInt32LE(v >>> 0); return b; }
  if (STRING.has(k)) { const s = Buffer.from(String(v), 'utf8'); return Buffer.concat([uint(s.length), s]); }
  return uint(v);
}
const encode = (t, p) => Buffer.concat([uint(t), ...Object.entries(p).flatMap(([k, v]) => [uint(+k), value(+k, v)]), Buffer.from([0])]);
const argb = (hex, a = 1) => (Math.round(a * 255) << 24 | parseInt(hex.slice(1), 16)) >>> 0;

// ---------------------------------------------------------------- colours
const COLORS = { body: '#FFFFFF', line: '#16161D', hair: '#16161D', accent: '#FFC93C' };
const ROLE_OF = { body: 0, line: 1, hair: 2, accent: 3 };

const VM_PROPS = CHARACTER === 'aituko' ? ['bodyColor', 'lineColor', 'hairColor', 'accentColor'] : ['bodyColor', 'lineColor', 'hairColor'];

// ---------------------------------------------------------------- scene graph
const comps = [];          // [type, props]
const binds = new Map();   // component index -> view-model property index
const named = {};
function comp(t, p) { comps.push([t, p]); return comps.length - 1; }
const ARTBOARD = comp(1, { 4: ARTBOARD_NAME, 7: 1024, 8: 1536, 236: 0, 583: 0 });
function node(name, parent = ARTBOARD, x = 0, y = 0, extra = {}) { const i = comp(2, { 4: name, 5: parent, 13: x, 14: y, ...extra }); named[name] = i; return i; }
function shape(name, parent = ARTBOARD, x = 0, y = 0, extra = {}) { const i = comp(3, { 4: name, 5: parent, 13: x, 14: y, ...extra }); named[name] = i; return i; }
function paint(sh, kind, color, width) {
  const role = ROLE_OF[color] !== undefined && (ROLE_OF[color] < VM_PROPS.length) ? ROLE_OF[color] : -1;
  const hex = role >= 0 ? COLORS[color] : color;
  const alpha = typeof width === 'object' && width.alpha !== undefined ? width.alpha : 1;
  const pid = kind === 'fill' ? comp(20, { 5: sh }) : comp(24, { 5: sh, 47: width, 48: 1, 49: 1 });
  const cid = comp(18, { 5: pid, 37: argb(hex, alpha) });
  if (role >= 0 && BIND_COLORS) binds.set(cid, role);
  return pid;
}
function ellipseShape(name, parent, x, y, w, h, fill, stroke, width = 15, extra = {}) {
  const sh = shape(name, parent, x, y, extra);
  comp(4, { 5: sh, 20: w, 21: h });
  if (fill) paint(sh, 'fill', fill, fill === '#F6A7B7' ? { alpha: .55 } : undefined);
  if (stroke) paint(sh, 'stroke', stroke, width);
  return sh;
}
// Vertices: [[x,y]] straight, or [[x,y,inX,inY,outX,outY]] cubic.
function pathShape(name, parent, verts, closed, fill, stroke, width = 15, extra = {}) {
  const sh = shape(name, parent, 0, 0, extra);
  const pp = comp(16, { 5: sh, 32: closed ? 1 : 0 });
  const ids = verts.map((v, i) => {
    let id;
    if (v.length === 2) id = comp(5, { 5: pp, 24: v[0], 25: v[1] });
    else id = comp(6, { 5: pp, 24: v[0], 25: v[1], 84: Math.atan2(v[3] - v[1], v[2] - v[0]), 85: Math.hypot(v[2] - v[0], v[3] - v[1]), 86: Math.atan2(v[5] - v[1], v[4] - v[0]), 87: Math.hypot(v[4] - v[0], v[5] - v[1]) });
    named[`${name}.v${i}`] = id;
    return id;
  });
  if (fill) paint(sh, 'fill', fill);
  if (stroke) named[`${name}.stroke`] = paint(sh, 'stroke', stroke, width);
  return { sh, ids };
}

// SVG path (M L C Q Z, one contour) -> cubic vertex list.
function svgToVerts(d, tf = p => p) {
  const t = d.match(/[MLCQZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi); let i = 0, cmd = '', cur = null, start = null;
  const V = []; let closed = false;
  const num = () => +t[i++];
  const pt = () => tf([num(), num()]);
  while (i < t.length) {
    if (/[MLCQZ]/i.test(t[i])) cmd = t[i++].toUpperCase();
    if (cmd === 'Z') { closed = true; continue; }
    if (cmd === 'M') { cur = pt(); start = cur; V.push({ p: cur, i: cur, o: cur }); cmd = 'L'; }
    else if (cmd === 'L') { const p = pt(); V.push({ p, i: p, o: p }); cur = p; }
    else if (cmd === 'C') { const a = pt(), b = pt(), p = pt(); V[V.length - 1].o = a; V.push({ p, i: b, o: p }); cur = p; }
    else if (cmd === 'Q') {
      const c = pt(), p = pt();
      V[V.length - 1].o = [cur[0] + 2 / 3 * (c[0] - cur[0]), cur[1] + 2 / 3 * (c[1] - cur[1])];
      V.push({ p, i: [p[0] + 2 / 3 * (c[0] - p[0]), p[1] + 2 / 3 * (c[1] - p[1])], o: p }); cur = p;
    }
  }
  // A closing segment back onto the first point merges into it.
  if (closed && V.length > 1) { const a = V[0].p, b = V[V.length - 1].p; if (Math.hypot(a[0] - b[0], a[1] - b[1]) < .01) { V[0].i = V[V.length - 1].i; V.pop(); } }
  return { verts: V.map(v => [v.p[0], v.p[1], v.i[0], v.i[1], v.o[0], v.o[1]]), closed };
}

// Character parts: explicit paints (LED colours with alpha, strokes of any width).
function paintX(sh, kind, color, width = 15, alpha = 1) {
  const role = ROLE_OF[color] !== undefined && ROLE_OF[color] < VM_PROPS.length ? ROLE_OF[color] : -1;
  const pid = kind === 'fill' ? comp(20, { 5: sh }) : comp(24, { 5: sh, 47: width, 48: 1, 49: 1 });
  const cid = comp(18, { 5: pid, 37: argb(role >= 0 ? COLORS[color] : color, alpha) });
  if (role >= 0 && BIND_COLORS) binds.set(cid, role);
  return pid;
}
function styled(sh, { fill, stroke, width = 15, alpha = 1 }) {
  if (fill) paintX(sh, 'fill', fill, 0, alpha);
  if (stroke) paintX(sh, 'stroke', stroke, width, alpha);
  return sh;
}
function artPath(name, parent, d, style = {}, dx = 0, dy = 0) {
  const { verts, closed } = svgToVerts(d, ([x, y]) => [x + dx, y + dy]);
  return styled(pathShape(name, parent, verts, closed, null, null).sh, style);
}
function roundRectVerts(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2); const k = .5523 * r, X = x + w, Y = y + h;
  return [[x + r, y, x + r - k, y, x + r, y], [X - r, y, X - r, y, X - r + k, y], [X, y + r, X, y + r - k, X, y + r], [X, Y - r, X, Y - r, X, Y - r + k],
    [X - r, Y, X - r + k, Y, X - r, Y], [x + r, Y, x + r, Y, x + r - k, Y], [x, Y - r, x, Y - r + k, x, Y - r], [x, y + r, x, y + r, x, y + r - k]];
}
function roundRect(name, parent, b, dy, style) { return styled(pathShape(name, parent, roundRectVerts(b.x, b.y + dy, b.w, b.h, b.r), true, null, null).sh, style); }
const LED = '#6CF0E0';

// ---------------------------------------------------------------- tracks
// tracks[clip][key] = [values per frame]; key = "<component name>|<property>"
const TRACK_DEFS = new Map();   // key -> { id, prop, hold }
function track(name, prop, hold = false) { const key = `${name}|${prop}`; if (!TRACK_DEFS.has(key)) TRACK_DEFS.set(key, { id: named[name], prop, hold }); return key; }

function simplify(keys, tol) {
  // Ramer–Douglas–Peucker on (frame, value) with linear interpolation.
  if (keys.length <= 2) return keys;
  const keep = new Uint8Array(keys.length); keep[0] = keep[keys.length - 1] = 1;
  const stack = [[0, keys.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); let idx = -1, max = tol;
    for (let i = a + 1; i < b; i++) {
      const t = (keys[i][0] - keys[a][0]) / (keys[b][0] - keys[a][0]);
      const d = Math.abs(keys[a][1] + (keys[b][1] - keys[a][1]) * t - keys[i][1]);
      if (d > max) { max = d; idx = i; }
    }
    if (idx >= 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return keys.filter((_, i) => keep[i]);
}
// Tolerances in artboard units (1024 wide; a 300 px mascot shows ~0.3 px per unit).
// Tolerances in artboard units / radians: under half a pixel on a 300 px wide Uko.
const TOL = { 13: 1.2, 14: 1.2, 24: 1.2, 25: 1.2, 15: .006, 84: .012, 86: .012, 85: 1, 87: 1, 16: .01, 17: .01, 20: 1.5, 21: 1.5, 47: .3, 18: .03 };
// ×2 by default: checked with test_rive_parity (mean IoU ≈ 0.99 against the engine).
for (const k of Object.keys(TOL)) TOL[k] *= +(process.env.UKO_TOL || 2);

// ---------------------------------------------------------------- build the rig
const S = DATA.statics;
const first = DATA.clips[0].frames[0];
const deg = d => d * Math.PI / 180;
const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const noScaleStroke = sh => { for (const c of comps) if (c[0] === 24 && c[1][5] !== undefined && comps[c[1][5]] && c[1][5] === sh) c[1][50] = 0; };

// Painter's order (back to front) = creation order of shapes.
const shadow = ellipseShape('Shadow', ARTBOARD, 506, 1409, 160, 24, 'line', null, 0, { 18: 0 });
named['Shadow.ellipse'] = shadow + 1;
const ART = S.art || {};

// Skeleton nodes. World transforms per frame come from the baked joints; each node
// is keyed in its parent's space, so rigid parts cost almost nothing.
const RIG = {};   // name -> { parent }
function rigNode(name, parent) { node(name, parent ? named[parent] : ARTBOARD); RIG[name] = { parent }; }
rigNode('Body', null);
for (const s of ['L', 'R']) {
  rigNode(`Arm${s}_upper`, 'Body'); rigNode(`Arm${s}_lower`, `Arm${s}_upper`); rigNode(`Hand${s}`, `Arm${s}_lower`);
  rigNode(`Leg${s}_upper`, 'Body'); rigNode(`Leg${s}_lower`, `Leg${s}_upper`); rigNode(`Foot${s}`, `Leg${s}_lower`);
}
rigNode('Head', 'Body');

// Meowuko's tail and ears come first: behind the body and the arms, as in the engine.
if (CHARACTER === 'meowuko') {
  // Tail: TailBase is baked (pelvis, body axis, side), TailSway is a loop layer.
  node('TailBase', named.Body); node('TailSway', named.TailBase);
  artPath('Tail', named.TailSway, ART.cat.tail, { stroke: 'line', width: 15 });
  // Ears behind the head; the right one flicks (layer "Ears").
  ART.cat.ears.forEach((E, k) => {
    const n = `Ear${k ? 'R' : 'L'}`;
    node(n, named.Head, E.pivot[0], E.pivot[1]);
    artPath(`${n}_outer`, named[n], E.outer, { fill: 'body', stroke: 'line', width: 15 }, -E.pivot[0], -E.pivot[1]);
    artPath(`${n}_inner`, named[n], E.inner, { fill: '#F6A7B7' }, -E.pivot[0], -E.pivot[1]);
  });
}

// A bone is a straight stroke from the node origin along +x; its length is keyed on
// the end vertex (foreshortened limbs look shorter, never thicker).
const BONES = ['Torso', 'ArmL_upper', 'ArmL_lower', 'ArmR_upper', 'ArmR_lower', 'LegL_upper', 'LegL_lower', 'LegR_upper', 'LegR_lower'];
const BONE_NODE = { Torso: 'Body' };
const boneLine = (b) => { const v = first.b[BONES.indexOf(b)]; pathShape(`${b}_line`, named[BONE_NODE[b] || b], [[0, 0], [len([v[0], v[1]], [v[2], v[3]]), 0]], false, null, 'line', 15); };
for (const b of ['Torso', 'ArmL_upper', 'ArmR_upper', 'ArmR_lower', 'LegL_upper', 'LegL_lower', 'LegR_upper', 'LegR_lower']) boneLine(b);

// Laptop (loading): pivot at (700, 690) so it can pop (scale) or drop (rotate).
const LAP_C = [700, 690];
node('Laptop', ARTBOARD, LAP_C[0], LAP_C[1], { 18: 0 });
node('LaptopArt', named.Laptop, -LAP_C[0], -LAP_C[1]);
S.laptop.forEach((e, k) => {
  if (e.tag === 'path') { const { verts, closed } = svgToVerts(e.d); pathShape(`Laptop_${k}`, named.LaptopArt, verts, closed, '#FFFFFF', 'line', 9); }
  else pathShape(`Laptop_${k}`, named.LaptopArt, [[e.x1, e.y1], [e.x2, e.y2]], false, null, 'line', 5, e.opacity ? { 18: +e.opacity } : {});
});
boneLine('ArmL_lower');   // the typing forearm goes over the laptop

for (const s of ['L', 'R']) ellipseShape(`Hand${s}_shape`, named[`Hand${s}`], 0, 0, 92, 52, 'body', 'line', 15);
for (const s of ['L', 'R']) ellipseShape(`Foot${s}_shape`, named[`Foot${s}`], 0, 0, 116, 44, 'body', 'line', 15);

// Head: circle, hair, one face group per expression; the eyes of every expression
// live under one Gaze node (a single x/y track moves the pupils of whichever face shows).
if (CHARACTER === 'aituko') {
  // Antenna on a spring (layer "Antenna"), bolts, box, screen, glare. The box sits `lift` higher.
  const R = ART.robot, A = R.art, dy = -R.lift;
  pathShape('Neck', named.Head, [[0, A.neck[0] + dy], [0, A.neck[1] + dy]], false, null, 'line', 15);
  node('Antenna', named.Head, A.pivot[0], A.pivot[1] + dy);
  artPath('AntennaWire', named.Antenna, A.antenna, { stroke: 'line', width: 12 }, -A.pivot[0], -A.pivot[1]);
  styled(ellipseShape('AntennaBall', named.Antenna, A.ball[0] - A.pivot[0], A.ball[1] - A.pivot[1], 2 * A.ball[2], 2 * A.ball[2], null, null), { fill: 'accent', stroke: 'line', width: 12 });
  for (const b of A.bolts) roundRect(`Bolt${b.side > 0 ? 'R' : 'L'}`, named.Head, b, dy, { fill: 'body', stroke: 'line', width: 12 });
  roundRect('HeadBox', named.Head, A.box, dy, { fill: 'body', stroke: 'line', width: 15 });
  roundRect('Screen', named.Head, A.screen, dy, { fill: R.screenFill });
  artPath('Glare', named.Head, A.glare, { stroke: '#FFFFFF', width: 10, alpha: .35 }, 0, dy);
} else ellipseShape('HeadCircle', named.Head, 0, 0, 370, 370, 'body', 'line', 15);
{
  const [hx, hy] = S.hairFrame.head, r = -deg(S.hairFrame.rot), c = Math.cos(r), s = Math.sin(r);
  const local = ([x, y]) => [(x - hx) * c - (y - hy) * s, (x - hx) * s + (y - hy) * c];
  S.hair.forEach((h, k) => { const { verts, closed } = svgToVerts(h.d, local); pathShape(`Hair_${k}`, named.Head, verts, closed, 'hair', null); });
}
const FACES = Object.keys(S.faces);
const EYE_NODES = { shut: [], blink: [] };
const faceEls = markup => [...markup.matchAll(/<(ellipse|path|circle)\s([^>]*?)\/?>/g)].map(m => {
  const attrs = {}; for (const a of m[2].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[a[1]] = a[2];
  return { tag: m[1], ...attrs };
});
const FACE_EYES = {};
for (const mode of FACES) {
  const g = node(`Face_${mode}`, named.Head, 0, 0, { 18: mode === first.face ? 1 : 0 });
  if (CHARACTER === 'aituko') {
    const F = ART.robot.faces[mode], dy = -ART.robot.lift, a = F.dim;
    FACE_EYES[mode] = F.items.filter(e => e.t === 'eye');
    F.items.forEach((e, n) => {
      if (e.t === 'led') artPath(`Led_${mode}_${n}`, g, e.d, { stroke: LED, width: 14, alpha: a }, 0, dy);
      else if (e.t === 'ledFill') artPath(`Led_${mode}_${n}`, g, e.d, { fill: LED, stroke: LED, width: 6, alpha: a }, 0, dy);
      else if (e.t === 'ledEllipse') styled(ellipseShape(`Led_${mode}_${n}`, g, e.cx, e.cy + dy, 2 * e.rx, 2 * e.ry, null, null), { stroke: LED, width: 14, alpha: a });
    });
    continue;
  }
  const els = faceEls(S.faces[mode]).filter(e => !/^cat/.test(e.class || ''));
  FACE_EYES[mode] = els.filter(e => e.tag === 'ellipse' && e.class === 'eye');
  let n = 0;
  for (const e of els) {
    const id = `${mode}_${n++}`;
    if (e.tag === 'ellipse' && e.class === 'blush') ellipseShape(`Blush_${id}`, g, +e.cx, +e.cy, 2 * e.rx, 2 * e.ry, '#F6A7B7', null);
    else if (e.tag === 'path') {
      const { verts, closed } = svgToVerts(e.d);
      if (e.class === 'faceOpenMouth') pathShape(`Mouth_${id}`, g, verts, true, 'body', 'line', 11);
      else pathShape(`Stroke_${id}`, g, verts, closed, null, 'line', 11);
    }
  }
}
node('Gaze', named.Head);
for (const mode of FACES) {
  const eyes = FACE_EYES[mode];
  if (!eyes.length) continue;
  if (CHARACTER === 'aituko') {
    const R = ART.robot, g = node(`Eyes_${mode}`, named.Gaze, 0, 0, { 18: mode === first.face ? 1 : 0 });
    eyes.forEach((e, k) => {
      const shut = node(`EyeShut_${mode}_${k}`, g, e.x, e.y - R.lift), blink = node(`EyeBlink_${mode}_${k}`, shut);
      const closed = R.eyeMin / e.h;
      EYE_NODES.shut.push({ name: `EyeShut_${mode}_${k}`, ry: e.h / 2, mode, closed }); EYE_NODES.blink.push({ name: `EyeBlink_${mode}_${k}`, ry: e.h / 2, closed });
      styled(pathShape(`Eye_${mode}_${k}`, blink, roundRectVerts(-e.w / 2, -e.h / 2, e.w, e.h, Math.min(14, e.h / 2)), true, null, null).sh, { fill: LED, stroke: LED, width: 6, alpha: ART.robot.faces[mode].dim });
    });
    continue;
  }
  const g = node(`Eyes_${mode}`, named.Gaze, 0, 0, { 18: mode === first.face ? 1 : 0 });
  const shines = faceEls(S.faces[mode]).filter(e => e.tag === 'circle' && e.class === 'eyeShine');
  eyes.forEach((e, k) => {
    const shut = node(`EyeShut_${mode}_${k}`, g, +e.cx, +e.cy), blink = node(`EyeBlink_${mode}_${k}`, shut);
    EYE_NODES.shut.push({ name: `EyeShut_${mode}_${k}`, ry: +e.ry, mode }); EYE_NODES.blink.push({ name: `EyeBlink_${mode}_${k}`, ry: +e.ry });
    ellipseShape(`Eye_${mode}_${k}`, blink, 0, 0, 2 * e.rx, 2 * e.ry, 'line', null);
    const sh = shines.sort((a, b) => Math.hypot(a.cx - e.cx, a.cy - e.cy) - Math.hypot(b.cx - e.cx, b.cy - e.cy))[0];
    if (sh && Math.hypot(sh.cx - e.cx, sh.cy - e.cy) < 30) ellipseShape(`Shine_${mode}_${k}`, blink, sh.cx - e.cx, sh.cy - e.cy, 2 * sh.r, 2 * sh.r, 'body', null);
  });
}

if (CHARACTER === 'meowuko') {
  artPath('Nose', named.Head, ART.cat.nose, { fill: '#F48FA2', stroke: 'line', width: 5 });
  for (const side of [-1, 1]) ART.cat.whiskers.forEach(([y0, y1], k) => pathShape(`Whisker${side > 0 ? 'R' : 'L'}${k}`, named.Head, [[side * 98, y0], [side * 176, y1]], false, null, 'line', 7));
}

// Foreground forearm + hand (thinking, error): in front of the face. No halo here: the
// engine's halo takes the page background colour, which a Rive file cannot know (a halo
// in the body colour showed as a coloured sleeve around the arm).
node('Foreground', ARTBOARD, 0, 0, { 18: 0 });
node('FgArm', named.Foreground);
pathShape('FgForearm', named.FgArm, [[0, 0], [200, 0]], false, null, 'line', 15);
node('FgHand', named.FgArm);
ellipseShape('FgHand_shape', named.FgHand, 0, 0, 92, 52, 'body', 'line', 15);

// FX. Welcome ripples: one static unit arc per node (radius 100, ±0.55 rad), scaled.
node('FxWelcome', ARTBOARD);
const ARC_R = 100, ARC_HALF = .55;
function unitArc() {
  const a0 = -ARC_HALF, seg = ARC_HALF, k = 4 / 3 * Math.tan(seg / 4) * ARC_R;
  return [0, 1, 2].map(j => { const t = a0 + seg * j, px = ARC_R * Math.cos(t), py = ARC_R * Math.sin(t), tx = -Math.sin(t), ty = Math.cos(t); return [px, py, px - tx * k, py - ty * k, px + tx * k, py + ty * k]; });
}
for (let k = 0; k < 3; k++) { node(`Arc${k}`, named.FxWelcome, 0, 0, { 18: 0 }); const { sh } = pathShape(`Arc${k}_shape`, named[`Arc${k}`], unitArc(), false, null, 'line', 12); noScaleStroke(sh); }
// Success sparkles, parented where they belong (forearms, head) so they follow for free.
const STAR = 40, SK = .18 * STAR;
function starShape(name, parent) {
  const P = [[0, -STAR], [STAR, 0], [0, STAR], [-STAR, 0]], C = [[SK, -SK], [SK, SK], [-SK, SK], [-SK, -SK]];
  const V = P.map((p, i) => {
    const cin = C[(i + 3) % 4], cout = C[i];
    return [p[0], p[1], p[0] + 2 / 3 * (cin[0] - p[0]), p[1] + 2 / 3 * (cin[1] - p[1]), p[0] + 2 / 3 * (cout[0] - p[0]), p[1] + 2 / 3 * (cout[1] - p[1])];
  });
  return pathShape(name, parent, V, true, 'line', null);
}
const SPARK_PARENT = ['ArmL_lower', 'ArmL_lower', 'ArmL_lower', 'ArmR_lower', 'ArmR_lower', 'ArmR_lower', 'Head', 'Head'];
SPARK_PARENT.forEach((p, k) => { node(`Spark${k}`, named[p], 0, 0, { 18: 0 }); RIG[`Spark${k}`] = { parent: p, fx: true }; starShape(`Spark${k}_shape`, named[`Spark${k}`]); });
node('FxEmpty', ARTBOARD, 0, 0, { 18: 0 });
for (let k = 0; k < 4; k++) pathShape(`Motion${k}`, named.FxEmpty, [[0, 0], [0, 1]], false, null, 'line', 12);
// Sleep Zs: one static unit Z per node (side 100), moved and scaled.
for (let k = 0; k < 3; k++) { node(`Z${k}`, ARTBOARD, 0, 0, { 18: 0 }); const { sh } = pathShape(`Z${k}_shape`, named[`Z${k}`], [[-50, -50], [50, -50], [-50, 50], [50, 50]], false, null, 'line', 12); noScaleStroke(sh); named[`Z${k}.stroke`] = comps.findIndex((c, i) => c[0] === 24 && c[1][5] === sh); }
{
  const bubble = node('Bubble', ARTBOARD, 0, 0, { 18: 0 });
  const inner = node('BubbleArt', bubble, -832, -276);
  DATA.fxArt.bubble.forEach((e, k) => {
    if (e.tag === 'path') { const { verts, closed } = svgToVerts(e.d); pathShape(`Bubble_${k}`, inner, verts, closed, e.cls === 'bubble' ? '#FFFFFF' : null, 'line', 12); }
    else ellipseShape(`Bubble_${k}`, inner, e.cx, e.cy, 2 * e.r, 2 * e.r, e.cls === 'questionDot' ? 'line' : '#FFFFFF', e.cls === 'questionDot' ? null : 'line', 10);
  });
}
{
  const spin = node('Spinner', ARTBOARD, 810, 455, { 18: 0 });
  DATA.fxArt.spinner.forEach((e, k) => {
    const a = deg(e.rot), R = ([x, y]) => [(x - 810) * Math.cos(a) - (y - 455) * Math.sin(a), (x - 810) * Math.sin(a) + (y - 455) * Math.cos(a)];
    pathShape(`Spin_${k}`, spin, [R([e.x1, e.y1]), R([e.x2, e.y2])], false, null, 'line', 12);
  });
}

// ---------------------------------------------------------------- per-frame values
function arcCenter(a) {
  const [x0, y0, r, x1, y1, large, sweep] = a;
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1;
  const h = Math.sqrt(Math.max(0, r * r - d * d / 4)), sgn = (large === sweep) ? -1 : 1;
  const cx = mx - sgn * h * dy / d, cy = my + sgn * h * dx / d;
  let a0 = Math.atan2(y0 - cy, x0 - cx), a1 = Math.atan2(y1 - cy, x1 - cx);
  if (sweep) { while (a1 < a0) a1 += 2 * Math.PI; } else { while (a1 > a0) a1 -= 2 * Math.PI; }
  return { cx, cy, r, mid: (a0 + a1) / 2 };
}
const smooth3 = x => x * x * (3 - 2 * x);
const clamp01 = x => Math.max(0, Math.min(1, x));

// World transforms {x, y, a} of the rig for one frame.
function rigWorld(f) {
  const B = f.b, W = {};
  const seg = k => ({ s: [B[k][0], B[k][1]], e: [B[k][2], B[k][3]] });
  const torso = seg(0);
  W.Body = { x: torso.s[0], y: torso.s[1], a: ang(torso.s, torso.e) };
  [['ArmL', 1], ['ArmR', 3], ['LegL', 5], ['LegR', 7]].forEach(([n, k]) => {
    const u = seg(k), l = seg(k + 1);
    W[`${n}_upper`] = { x: u.s[0], y: u.s[1], a: ang(u.s, u.e) };
    W[`${n}_lower`] = { x: l.s[0], y: l.s[1], a: ang(l.s, l.e) };
  });
  f.h.forEach((h, k) => { W[`Hand${'LR'[k]}`] = { x: h[0], y: h[1], a: deg(h[2]) }; });
  f.f.forEach((h, k) => { W[`Foot${'LR'[k]}`] = { x: h[0], y: h[1], a: deg(h[2]) }; });
  W.Head = { x: f.head[0], y: f.head[1], a: deg(f.head[2]) };
  return W;
}
function toLocal(w, p) {
  if (!p) return w;
  const dx = w.x - p.x, dy = w.y - p.y, c = Math.cos(p.a), s = Math.sin(p.a);
  return { x: dx * c + dy * s, y: -dx * s + dy * c, a: w.a - p.a };
}
// Sparkles: group by nearest anchor (left hand, right hand, head), rank by distance.
function sparkSlots(sparks, W) {
  const slots = new Array(8).fill(null);
  const anchors = [[W.HandL, 0, 3], [W.HandR, 3, 3], [W.Head, 6, 2]];
  const groups = [[], [], []];
  for (const sp of sparks || []) {
    const p = sp.p, cx = p[0], R = (p[9] - p[1]) / 2, cy = p[1] + R;
    let bi = 0, bd = 1e9;
    anchors.forEach(([a], i) => { const d = Math.hypot(cx - a.x, cy - a.y) - (i === 2 ? 120 : 0); if (d < bd) { bd = d; bi = i; } });
    groups[bi].push({ cx, cy, R, o: sp.o, d: Math.hypot(cx - anchors[bi][0].x, cy - anchors[bi][0].y) });
  }
  groups.forEach((g, i) => {
    const [a, base, n] = anchors[i];
    g.sort(i === 2 ? (u, v) => u.cx - v.cx : (u, v) => u.d - v.d);
    g.slice(0, n).forEach((s, j) => { slots[base + j] = s; });
    void a;
  });
  return slots;
}

function frameValues(f, prev) {
  const out = {};
  const set = (name, prop, v, hold = false) => { out[track(name, prop, hold)] = v; };
  const W = rigWorld(f);
  for (const [name, def] of Object.entries(RIG)) {
    if (def.fx) continue;
    const l = toLocal(W[name], def.parent ? W[def.parent] : null);
    set(name, 13, l.x); set(name, 14, l.y); set(name, 15, l.a);
  }
  f.b.forEach((v, k) => set(`${BONES[k]}_line.v1`, 24, len([v[0], v[1]], [v[2], v[3]])));
  for (const mode of FACES) {
    set(`Face_${mode}`, 18, mode === f.face ? 1 : 0, true);
    if (FACE_EYES[mode].length) set(`Eyes_${mode}`, 18, mode === f.face ? 1 : 0, true);
  }
  // LED eyes move half as much as Uko's, inside the screen.
  const gz = CHARACTER === 'aituko' ? [Math.max(-16, Math.min(16, f.eye[0] * .5)), Math.max(-12, Math.min(12, f.eye[1] * .5))] : f.eye;
  set('Gaze', 13, gz[0]); set('Gaze', 14, gz[1]);
  // Expression swaps happen with the eyes shut (engine trick): only the visible face needs it.
  for (const e of EYE_NODES.shut) set(e.name, 17, e.mode === f.face ? 1 + ((e.closed || 2.2 / e.ry) - 1) * f.shut : 1);
  if (f.tail) {
    const [x, y, rot, side, k] = f.tail, l = toLocal({ x, y, a: deg(rot) }, W.Body);
    set('TailBase', 13, l.x); set('TailBase', 14, l.y); set('TailBase', 15, l.a); set('TailBase', 16, side * k); set('TailBase', 17, k);
  }

  // Laptop: follows the body while loading; pops (success), drops (error) or fades on exit.
  let lap = { x: LAP_C[0] + f.ls[0], y: LAP_C[1] + f.ls[1], a: 0, s: 1, o: f.lap };
  if (!f.lap && f.lx) {
    const { kind, since, shift } = f.lx;
    if (kind === 'pop') { const u = clamp01(since / 360); lap = { x: LAP_C[0] + shift[0], y: LAP_C[1] + shift[1], a: 0, s: 1 + .16 * smooth3(u), o: 1 - smooth3(u) }; }
    else if (kind === 'drop') {
      const u = clamp01(since / 520), g = u * u, a = deg(22 * g), Q = [640, 740], c = Math.cos(a), s = Math.sin(a);
      const d = [LAP_C[0] - Q[0], LAP_C[1] - Q[1]];
      lap = { x: shift[0] + Q[0] + d[0] * c - d[1] * s, y: shift[1] + 130 * g + Q[1] + d[0] * s + d[1] * c, a, s: 1, o: 1 - smooth3(clamp01((u - .35) / .65)) };
    } else { const u = clamp01(since / 260); lap = { x: LAP_C[0] + shift[0], y: LAP_C[1] + shift[1], a: 0, s: 1, o: 1 - smooth3(u) }; }
  } else if (!f.lap) lap = { ...(prev.lap || lap), o: 0 };
  set('Laptop', 13, lap.x); set('Laptop', 14, lap.y); set('Laptop', 15, lap.a); set('Laptop', 16, lap.s); set('Laptop', 17, lap.s); set('Laptop', 18, lap.o);
  out.__lap = lap;

  set('Foreground', 18, f.fg ? 1 : 0, true);
  const fgv = f.fg || prev.fg;
  if (fgv) {
    const [x1, y1, x2, y2] = fgv.line, a = ang([x1, y1], [x2, y2]);
    set('FgArm', 13, x1); set('FgArm', 14, y1); set('FgArm', 15, a);
    set('FgForearm.v1', 24, len([x1, y1], [x2, y2]));
    const h = toLocal({ x: fgv.hand[0], y: fgv.hand[1], a: deg(fgv.hand[2]) }, { x: x1, y: y1, a });
    set('FgHand', 13, h.x); set('FgHand', 14, h.y); set('FgHand', 15, h.a);
  }

  // FX
  const fx = f.fx, pfx = prev.fx || {};
  for (let k = 0; k < 3; k++) {
    const a = fx.arcs && fx.arcs[k], pa = a || (pfx.arcs && pfx.arcs[k]);
    set(`Arc${k}`, 18, a ? a.o : 0);
    if (pa) { const c = arcCenter(pa.p); set(`Arc${k}`, 13, c.cx); set(`Arc${k}`, 14, c.cy); set(`Arc${k}`, 15, c.mid); set(`Arc${k}`, 16, c.r / ARC_R); set(`Arc${k}`, 17, c.r / ARC_R); }
  }
  set('Shadow', 18, fx.shadow ? fx.shadow.o : 0);
  const sh = fx.shadow || pfx.shadow;
  if (sh) { set('Shadow', 13, sh.p[0]); set('Shadow', 14, sh.p[1]); set('Shadow.ellipse', 20, 2 * sh.p[2]); set('Shadow.ellipse', 21, 2 * sh.p[3]); }
  const slots = sparkSlots(fx.sparks, W), pslots = prev.slots || [];
  out.__slots = slots.map((s, k) => s || pslots[k] || null);
  for (let k = 0; k < 8; k++) {
    const s = slots[k], ps = s || pslots[k];
    set(`Spark${k}`, 18, s ? s.o : 0);
    if (ps) {
      const l = toLocal({ x: ps.cx, y: ps.cy, a: 0 }, W[SPARK_PARENT[k]]);
      set(`Spark${k}`, 13, l.x); set(`Spark${k}`, 14, l.y); set(`Spark${k}`, 15, l.a); set(`Spark${k}`, 16, ps.R / STAR); set(`Spark${k}`, 17, ps.R / STAR);
    }
  }
  set('FxEmpty', 18, fx.empty ? fx.empty[0].o : 0);
  const em = fx.empty || pfx.empty;
  if (em) em.forEach((l, k) => { set(`Motion${k}.v0`, 24, l.p[0]); set(`Motion${k}.v0`, 25, l.p[1]); set(`Motion${k}.v1`, 24, l.p[2]); set(`Motion${k}.v1`, 25, l.p[3]); });
  for (let k = 0; k < 3; k++) {
    const z = fx.zs && fx.zs[k], pz = z || (pfx.zs && pfx.zs[k]);
    set(`Z${k}`, 18, z ? z.o : 0);
    if (pz) { const p = pz.p; set(`Z${k}`, 13, (p[0] + p[2]) / 2); set(`Z${k}`, 14, (p[1] + p[5]) / 2); set(`Z${k}`, 16, (p[2] - p[0]) / 100); set(`Z${k}`, 17, (p[5] - p[1]) / 100); set(`Z${k}.stroke`, 47, pz.w); }
  }
  set('Bubble', 18, fx.bubble ? fx.bubble.o : 0);
  const bb = fx.bubble || pfx.bubble;
  if (bb) { set('Bubble', 13, bb.p[0]); set('Bubble', 14, bb.p[1]); set('Bubble', 16, bb.p[2]); set('Bubble', 17, bb.p[2]); }
  set('Spinner', 18, fx.spinner ? fx.spinner.o : 0);
  set('Spinner', 13, 810 + f.ls[0]); set('Spinner', 14, 455 + f.ls[1]);
  if (fx.spinner || pfx.spinner) set('Spinner', 15, deg((fx.spinner || pfx.spinner).a));
  return out;
}

// ---------------------------------------------------------------- clips -> key frames
const anims = [];
const animIndex = {};
const perClip = DATA.clips.map(clip => {
  let prev = {};
  return clip.frames.map(f => {
    const v = frameValues(f, prev);
    prev = { fg: f.fg || prev.fg, fx: { ...prev.fx, ...f.fx }, lap: v.__lap, slots: v.__slots };
    delete v.__lap; delete v.__slots;
    return v;
  });
});
const CLIP_TRACKS = [...TRACK_DEFS.keys()];
const ANGLE = new Set([15, 84, 86]);
// Rest value of every track = its first value in Idle.
const REST = {};
for (const key of CLIP_TRACKS) { const v = perClip[0].find(fr => fr[key] !== undefined); REST[key] = v ? v[key] : (TRACK_DEFS.get(key).prop === 18 ? 0 : (TRACK_DEFS.get(key).prop === 16 || TRACK_DEFS.get(key).prop === 17 ? 1 : 0)); }
// Static values = rest values: a track a clip does not key must still sit at rest.
for (const key of CLIP_TRACKS) {
  const def = TRACK_DEFS.get(key);
  if (def.id !== undefined && comps[def.id]) comps[def.id][1][def.prop] = REST[key];
}
const series = {};   // clip -> key -> values
DATA.clips.forEach((clip, ci) => {
  const keys = {};
  for (const key of CLIP_TRACKS) {
    const def = TRACK_DEFS.get(key);
    let s = perClip[ci].map(v => v[key]);
    const firstKnown = s.find(v => v !== undefined);
    if (firstKnown === undefined) s = [REST[key]];
    else { let last = firstKnown; s = s.map(v => (v === undefined ? last : (last = v))); }
    if (ANGLE.has(def.prop)) {
      // Keep angles in the same turn as the rest pose, then unwrap frame to frame.
      while (s[0] - REST[key] > Math.PI) s[0] -= 2 * Math.PI;
      while (s[0] - REST[key] < -Math.PI) s[0] += 2 * Math.PI;
      for (let i = 1; i < s.length; i++) {
        while (s[i] - s[i - 1] > Math.PI) s[i] -= 2 * Math.PI;
        while (s[i] - s[i - 1] < -Math.PI) s[i] += 2 * Math.PI;
      }
    }
    keys[key] = s;
  }
  if (clip.loop) {
    const N = clip.frames.length - 1;
    for (const [key, s] of Object.entries(keys)) {
      if (s.length < 2 || TRACK_DEFS.get(key).hold) continue;
      const prop = TRACK_DEFS.get(key).prop;
      let target = s[0];
      if (key === 'Spinner|15') { const step = Math.PI / 4; target = s[0] + Math.round((s[N] - s[0]) / step) * step; }
      const drift = target - s[N];
      for (let i = 1; i <= N; i++) s[i] += drift * i / N;
      if (prop === 18) for (let i = 0; i <= N; i++) s[i] = Math.min(1, Math.max(0, s[i]));
    }
  }
  series[clip.name] = keys;
});
// A clip keys a track when it moves it, holds it off its rest value, or when some
// clip ends with that track off rest (the state machine may come from there).
// Keyframe reduction with eased segments (how an animator keys): each segment between
// two keys is linear, ease-in, ease-out or ease-in-out, whichever fits; keys land on
// extremes of the motion instead of every few frames.
const EASES = { lin: null, io: [0.42, 0, 0.58, 1], in: [0.42, 0, 1, 1], out: [0, 0, 0.58, 1] };
const EASE_LUT = {};
for (const [n, c] of Object.entries(EASES)) {
  if (!c) continue;
  const bz = (t, a, b) => 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
  const xs = [], ys = [];
  for (let i = 0; i <= 256; i++) { const t = i / 256; xs.push(bz(t, c[0], c[2])); ys.push(bz(t, c[1], c[3])); }
  EASE_LUT[n] = x => { let lo = 0, hi = 256; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] < x) lo = m; else hi = m; } const u = (x - xs[lo]) / ((xs[hi] - xs[lo]) || 1); return ys[lo] + (ys[hi] - ys[lo]) * u; };
}
const easeAt = (m, t) => (m === 'lin' ? t : EASE_LUT[m](t));
function simplifyEased(keys, tol) {
  if (keys.length <= 2) return keys.map(k => [k[0], k[1], 'lin']);
  const model = new Array(keys.length).fill(null);
  const keep = new Uint8Array(keys.length); keep[0] = keep[keys.length - 1] = 1;
  const stack = [[0, keys.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let best = null;
    for (const m of Object.keys(EASES)) {
      let err = 0, at = -1;
      for (let i = a + 1; i < b; i++) {
        const t = (keys[i][0] - keys[a][0]) / (keys[b][0] - keys[a][0]);
        const d = Math.abs(keys[a][1] + (keys[b][1] - keys[a][1]) * easeAt(m, t) - keys[i][1]);
        if (d > err) { err = d; at = i; }
      }
      if (!best || err < best.err) best = { m, err, at };
    }
    if (best.err <= tol || b - a < 2) model[a] = best.m;
    else { keep[best.at] = 1; stack.push([a, best.at], [best.at, b]); }
  }
  return keys.map((k, i) => [k[0], k[1], model[i] || 'lin']).filter((_, i) => keep[i]);
}

// FX (sparkles, ripples, Zs, motion lines, bubble) are small and short-lived: coarser.
const tolFor = key => (TOL[TRACK_DEFS.get(key).prop] || .01) * (/^(Spark|Arc|Z\d|Motion|Bubble|Shadow)/.test(key) ? 4 : 1);
const near = (a, b, key) => Math.abs(a - b) <= tolFor(key) * .5;
const DIRTY = new Set();
for (const clip of DATA.clips) for (const key of CLIP_TRACKS) { const s = series[clip.name][key]; if (!near(s[s.length - 1], REST[key], key)) DIRTY.add(key); }
// Tracks of a node that can be hidden only matter while it is visible: they are
// keyed in the clips that show it, never in the others (their opacity track is).
function ownerOf(key) {
  const name = key.split('|')[0], prop = +key.split('|')[1];
  let m;
  if ((m = /^(Spark\d|Arc\d|Z\d|Bubble|Laptop|Spinner|Shadow)/.exec(name)) && !(prop === 18 && !name.includes('.'))) return `${m[1]}|18`;
  if (/^Motion\d/.test(name)) return 'FxEmpty|18';
  if (/^(FgArm|FgHalo|FgForearm|FgHand)/.test(name)) return 'Foreground|18';
  if ((m = /^EyeShut_(\w+)_\d/.exec(name))) return `Eyes_${m[1]}|18`;
  return null;
}
for (const key of CLIP_TRACKS) { const o = ownerOf(key); if (o && !TRACK_DEFS.has(o)) throw new Error(`no owner track ${o} for ${key}`); }
DATA.clips.forEach(clip => {
  const keys = {};
  for (const key of CLIP_TRACKS) {
    const s = series[clip.name][key];
    const owner = ownerOf(key);
    if (owner && series[clip.name][owner].every(v => v <= 0.001)) continue;
    const moves = s.some(v => !near(v, s[0], key));
    if (moves || (DIRTY.has(key) && !owner) || !near(s[0], REST[key], key) || owner) keys[key] = s;
  }
  animIndex[clip.name] = anims.length;
  anims.push({ name: clip.name, loop: clip.loop, duration: clip.frames.length - 1, keys });
});

// Blink layer: two blinks over 6.4 s (engine: occasional quick blinks).
{
  const dur = Math.round(6.4 * FPS), keys = {};
  const blinkAt = [Math.round(2.4 * FPS), Math.round(5.9 * FPS)];
  for (const e of EYE_NODES.blink) {
    const closed = e.closed || 2.2 / e.ry, k = [];
    k.push([0, 1]);
    for (const b of blinkAt) k.push([b - 5, 1], [b, closed], [b + 7, 1]);
    k.push([dur, 1]);
    keys[track(e.name, 17)] = k;
  }
  animIndex.Blink = anims.length;
  anims.push({ name: 'Blink', loop: true, duration: dur, keys, sparse: true });
}
// Character loops, each on its own layer: antenna spring, ear flick, tail sway.
const LOOP_LAYERS = [];
function loopLayer(name, target, prop, seconds, keys) {
  animIndex[name] = anims.length; LOOP_LAYERS.push(name);
  anims.push({ name, loop: true, duration: Math.round(seconds * FPS), keys: { [track(target, prop)]: keys.map(([t, v, m]) => [Math.round(t * FPS), v, m || 'io']) }, sparse: true });
}
if (CHARACTER === 'aituko') loopLayer('Antenna', 'Antenna', 15, 6,
  [[0, 0], [.75, deg(5)], [1.6, deg(-4)], [2.3, deg(3)], [3.1, deg(-5)], [3.9, deg(2)], [4.6, deg(-3)], [5.4, deg(4)], [6, 0]]);
if (CHARACTER === 'meowuko') {
  loopLayer('Ears', 'EarR', 15, 5.3, [[0, 0], [4.95, 0], [5.125, deg(9)], [5.3, 0]]);
  const T = 2 * Math.PI / 1.7;
  loopLayer('TailSway', 'TailSway', 15, T, [[0, 0, 'out'], [T / 4, deg(6), 'io'], [3 * T / 4, deg(-6), 'in'], [T, 0]]);
}

// ---------------------------------------------------------------- state machine
// Same inputs as before (state 0 idle, 1 thinking, 2 loading, 3 sleep; triggers).
// Persistent states are cycles: base loop (varied waits) → gesture → base loop → …
const sm = [];
const INPUTS = STARTER ? ['state', 'welcome', 'success'] : ['state', 'welcome', 'success', 'error', 'empty'];
sm.push([53, { 55: 'Uko' }]);
sm.push([56, { 138: 'state', 140: 0 }]);
for (const t of INPUTS.slice(1)) sm.push([58, { 138: t }]);
const inp = n => INPUTS.indexOf(n);
const ms = name => Math.round(anims[animIndex[name]].duration / FPS * 1000);
const EQ = v => [0, v], NE = v => [1, v];
// States: [id, animation, [transitions]] ; a transition: { to, mix, exit, trig, num }.
const STATES = [];
const has = name => animIndex[name] !== undefined;
function state(id, anim, trs) { STATES.push({ id, anim, trs }); }
const sid = id => 3 + STATES.findIndex(s => s.id === id);   // 0 entry, 1 exit, 2 any
const OS = ['welcome', 'success', 'error', 'empty'].filter(t => INPUTS.includes(t));
const ONE = { welcome: 'Welcome', success: 'Success', error: 'Error', empty: 'Empty' };
const oneShots = mix => OS.map(t => ({ to: ONE[t], trig: t, mix }));

// Idle cycle.
const IDLE = [['I0', 4600, 'IdleGlance'], ['I1', 6200, 'IdleShrug'], ['I2', 3900, 'IdleTap'], ['I3', 5300, 'IdleLookUp']];
const idleOut = mix => [...oneShots(mix),
  ...(STARTER ? [] : [{ to: 'ThinkingEnter', num: EQ(1), mix }]), { to: 'LoadingEnter', num: EQ(2), mix },
  ...(STARTER ? [] : [{ to: 'SleepEnter', num: EQ(3), mix }])];
IDLE.forEach(([id, wait, g], k) => {
  state(id, 'Idle', [...idleOut(160), { to: `G_${g}`, exit: wait, mix: 280 }]);
  state(`G_${g}`, g, [...idleOut(200), { to: IDLE[(k + 1) % IDLE.length][0], exit: ms(g), mix: 300 }]);
});
for (const [t, clip] of Object.entries(ONE)) if (OS.includes(t)) state(clip, clip, [{ to: 'I0', exit: ms(clip), mix: 240 }]);

// Thinking cycle.
if (!STARTER) {
  const T = [['T0', 2600, 'ThinkPonderL'], ['T1', 1800, 'ThinkScratch'], ['T2', 2400, 'ThinkPonderR'], ['T3', 2000, 'ThinkNod']];
  const tOut = mix => [...oneShots(mix), { to: 'ThinkingExit', num: NE(1), mix: 200 }];
  state('ThinkingEnter', 'ThinkingEnter', [{ to: 'T0', exit: ms('ThinkingEnter') }]);
  T.forEach(([id, wait, g], k) => {
    state(id, 'Thinking', [...tOut(300), { to: `G_${g}`, exit: wait, mix: 260 }]);
    state(`G_${g}`, g, [...tOut(300), { to: T[(k + 1) % T.length][0], exit: ms(g), mix: 280 }]);
  });
  state('ThinkingExit', 'ThinkingExit', [...oneShots(250), { to: 'ThinkingEnter', num: EQ(1), mix: 200 }, { to: 'I0', exit: ms('ThinkingExit'), mix: 120 }]);
}

// Loading cycle (patience gestures come after ~10 s).
{
  const L = STARTER
    ? [['L0', 2600, 'LoadCheck'], ['L1', 2000, 'LoadLean'], ['L2', 2800, 'LoadPeek'], ['L3', 2200, 'LoadSigh'], ['L4', 1800, 'LoadTap']]
    : [['L0', 2600, 'LoadCheck'], ['L1', 2000, 'LoadLean'], ['L2', 2800, 'LoadPeek'], ['L3', 2200, 'LoadSigh'], ['L4', 1800, 'LoadTap']];
  const lOut = [{ to: 'LoadingToSuccess', trig: 'success', mix: 200 }, ...(STARTER ? [] : [{ to: 'LoadingToError', trig: 'error', mix: 200 }, { to: 'Empty', trig: 'empty', mix: 300 }]),
    { to: 'Welcome', trig: 'welcome', mix: 300 }, { to: 'LoadingExit', num: NE(2), mix: 200 }];
  state('LoadingEnter', 'LoadingEnter', [{ to: 'L0', exit: ms('LoadingEnter') }]);
  L.forEach(([id, wait, g], k) => {
    state(id, 'Loading', [...lOut, { to: `G_${g}`, exit: wait, mix: 260 }]);
    state(`G_${g}`, g, [...lOut, { to: L[(k + 1) % L.length][0], exit: ms(g), mix: 280 }]);
  });
  // Hosts set state = 0 and fire success/error together: whichever transition Rive takes
  // first, the trigger still lands on the right reaction.
  state('LoadingExit', 'LoadingExit', [...lOut.filter(t => t.trig), { to: 'LoadingEnter', num: EQ(2), mix: 200 }, { to: 'I0', exit: ms('LoadingExit'), mix: 120 }]);
  state('LoadingToSuccess', 'LoadingToSuccess', [{ to: 'Success', exit: ms('LoadingToSuccess'), mix: 180 }]);
  if (!STARTER) state('LoadingToError', 'LoadingToError', [{ to: 'Error', exit: ms('LoadingToError'), mix: 180 }]);
}

// Sleep cycle.
if (!STARTER) {
  const Z = [['S0', 6500, 'SleepSnuggle'], ['S1', 7000, 'SleepTwitch']];
  state('SleepEnter', 'SleepEnter', [{ to: 'S0', exit: ms('SleepEnter') }]);
  Z.forEach(([id, wait, g], k) => {
    state(id, 'Sleep', [{ to: 'Wake', num: NE(3), mix: 200 }, { to: `G_${g}`, exit: wait, mix: 300 }]);
    state(`G_${g}`, g, [{ to: 'Wake', num: NE(3), mix: 200 }, { to: Z[(k + 1) % Z.length][0], exit: ms(g), mix: 300 }]);
  });
  state('Wake', 'Wake', [{ to: 'I0', exit: ms('Wake'), mix: 240 }]);
}

// Flags: 4 = exit time, 32 = early exit (the machine may leave during a mix: without it,
// Rive blocks every transition until the mix ends and a trigger fired then is lost).
function transition(tr) {
  const p = { 151: sid(tr.to), 158: tr.mix || 0, 152: 32 };
  if (tr.exit !== undefined && tr.exit !== null) { p[152] = 4 | 32; p[160] = tr.exit; }
  const recs = [[65, p]];
  if (tr.trig) recs.push([68, { 155: inp(tr.trig) }]);
  if (tr.num) recs.push([70, { 155: inp('state'), 156: tr.num[0], 157: tr.num[1] }]);
  return recs;
}
for (const s of STATES) for (const tr of s.trs) if (sid(tr.to) < 3) throw new Error(`unknown state ${tr.to} (from ${s.id})`);
sm.push([57, { 138: 'Body' }]);
sm.push([63, {}]); sm.push(...transition({ to: 'I0' }));
sm.push([64, {}]);
sm.push([62, {}]);
for (const s of STATES) { sm.push([61, { 149: animIndex[s.anim] }]); for (const tr of s.trs) sm.push(...transition(tr)); }
// Blink layer: always blinking (only visible on open eyes).
sm.push([57, { 138: 'Blink' }]);
sm.push([63, {}]); sm.push([65, { 151: 3, 158: 0 }]);
sm.push([64, {}]); sm.push([62, {}]);
sm.push([61, { 149: animIndex.Blink }]);
for (const name of LOOP_LAYERS) {
  sm.push([57, { 138: name }]);
  sm.push([63, {}]); sm.push([65, { 151: 3, 158: 0 }]);
  sm.push([64, {}]); sm.push([62, {}]);
  sm.push([61, { 149: animIndex[name] }]);
}

// ---------------------------------------------------------------- serialize
const STATS = {};
const EASED = process.env.UKO_EASED !== '0';
const INTERP_ID = {};
function save() {
  // Rive draws the first shape on top: nodes first, then shape blocks in reverse
  // of the painter's order used above (back-to-front).
  const nodes = [], blocks = [];
  comps.forEach((c, i) => {
    if ([1, 2].includes(c[0])) nodes.push(i);
    else if (c[0] === 3) blocks.push([i]);
    else blocks[blocks.length - 1].push(i);
  });
  const order = [...nodes, ...blocks.reverse().flat()];
  const remap = new Map(order.map((old, i) => [old, i]));
  const parts = [];
  const mapped = (t, p) => encode(t, Object.fromEntries(Object.entries(p).map(([k, v]) => [k, (+k === 5 || +k === 51) ? remap.get(v) : v])));
  if (BIND_COLORS) {
    parts.push(encode(435, { 557: 'Appearance' }));
    for (const n of VM_PROPS) parts.push(encode(440, { 557: n }));
    parts.push(encode(437, { 4: 'Default', 566: 0 }));
    VM_PROPS.forEach((n, k) => parts.push(encode(426, { 554: k, 555: argb(COLORS[['body', 'line', 'hair', 'accent'][k]]) })));
  }
  for (const old of order) {
    const [t, p] = comps[old];
    parts.push(mapped(t, p));
    if (binds.has(old)) parts.push(encode(447, { 586: 37, 587: 0, 588: bindPath(binds.get(old)) }));
  }
  // Cubic ease interpolators, shared by every eased key (artboard objects after the components).
  if (EASED) Object.entries(EASES).filter(([, c]) => c).forEach(([n, c], i) => { INTERP_ID[n] = order.length + i; parts.push(encode(28, { 63: c[0], 64: c[1], 65: c[2], 66: c[3] })); });
  const compBytes = parts.reduce((n, b) => n + b.length, 0);
  let keyCount = 0;
  for (const a of anims) {
    const before = keyCount;
    parts.push(encode(31, { 55: a.name, 56: FPS, 57: a.duration, 59: a.loop ? 1 : 0 }));
    for (const [key, s] of Object.entries(a.keys)) {
      const def = TRACK_DEFS.get(key);
      let keys = a.sparse ? s : s.map((v, i) => [i, v]);
      if (!a.sparse) {
        if (def.hold) keys = keys.filter((k, i) => i === 0 || k[1] !== keys[i - 1][1]);
        else keys = EASED ? simplifyEased(keys, tolFor(key)) : simplify(keys, tolFor(key));
        // A constant track needs a single key.
        if (keys.length === 2 && near(keys[0][1], keys[1][1], key)) keys = [keys[0]];
      }
      STATS[key.replace(/\d+/g, '#')] = (STATS[key.replace(/\d+/g, '#')] || 0) + keys.length;
      parts.push(encode(25, { 51: remap.get(def.id) }), encode(26, { 53: def.prop }));
      for (const [f, v, m] of keys) {
        const p = def.hold ? { 67: f, 68: 0, 70: v } : (m && m !== 'lin' ? { 67: f, 68: 2, 69: INTERP_ID[m], 70: v } : { 67: f, 68: 1, 70: v });
        parts.push(encode(30, p)); keyCount++;
      }
    }
    if (process.env.UKO_STATS) console.log(a.name.padEnd(17), keyCount - before);
  }
  const animBytes = parts.reduce((n, b) => n + b.length, 0) - compBytes;
  for (const [t, p] of sm) parts.push(encode(t, p));
  if (process.env.UKO_DIAG) console.log(`bytes: components ${(compBytes / 1024).toFixed(1)} KB · animations ${(animBytes / 1024).toFixed(1)} KB · state machine ${((parts.reduce((n, b) => n + b.length, 0) - compBytes - animBytes) / 1024).toFixed(1)} KB`);
  const header = Buffer.concat([Buffer.from('RIVE'), uint(7), uint(0), uint(0), uint(0)]);
  const bytes = Buffer.concat([header, encode(23, {}), ...parts]);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, bytes);
  return { bytes: bytes.length, keyCount };
}
const BIND_PATH = process.env.UKO_BIND_PATH || 'u8';
function bindPath(k) { return BIND_PATH === 'u16' ? [k & 255, k >> 8] : [0, k]; }

const info = save();
const manifest = {
  file: path.basename(OUT), character: CHARACTER, edition: STARTER ? 'starter' : 'full', rig: 'bones', artboard: ARTBOARD_NAME, stateMachine: 'Uko', bytes: info.bytes, keyFrames: info.keyCount,
  inputs: STARTER ? { state: 'number: 0 idle, 2 loading', welcome: 'trigger', success: 'trigger' }
    : { state: 'number: 0 idle, 1 thinking, 2 loading, 3 sleep', welcome: 'trigger', success: 'trigger', error: 'trigger', empty: 'trigger' },
  viewModel: BIND_COLORS ? { name: 'Appearance', colors: VM_PROPS } : null,
  layers: ['Body', 'Blink', ...LOOP_LAYERS],
  states: STATES.map(s => s.id),
  animations: anims.map(a => ({ name: a.name, seconds: +(a.duration / FPS).toFixed(2), loop: a.loop })),
};
fs.writeFileSync(OUT + '.json', JSON.stringify(manifest, null, 2));
if (process.env.UKO_STATS) console.log(Object.entries(STATS).sort((a, b) => b[1] - a[1]).slice(0, 25));
console.log(`${path.relative(path.join(__dirname, '..'), OUT)}  ${(info.bytes / 1024).toFixed(1)} KB · ${info.keyCount} keys · ${anims.length} animations · ${STATES.length} states · ${comps.length} components${BIND_COLORS ? ' · colours bound (' + BIND_PATH + ')' : ''}`);
if (process.env.UKO_DIAG) {
  let pairs = 0;
  for (const a of anims) pairs += Object.keys(a.keys).length;
  console.log('tracks', CLIP_TRACKS.length, 'dirty', DIRTY.size, 'keyed (clip,track) pairs', pairs);
  console.log(anims.map(a => `${a.name}:${Object.keys(a.keys).length}`).join(' '));
  console.log('dirty', [...DIRTY].join(' '));
}
if (process.env.UKO_TRACKS) {
  const clip = anims[animIndex[process.env.UKO_TRACKS]];
  const rows = Object.entries(clip.keys).map(([k, s]) => [k, simplifyEased(s.map((v, i) => [i, v]), tolFor(k)).length, (Math.max(...s) - Math.min(...s)).toFixed(3)]).sort((a, b) => b[1] - a[1]).slice(0, 18);
  console.log(clip.name, clip.duration, 'frames'); for (const r of rows) console.log(r.join('  '));
}
