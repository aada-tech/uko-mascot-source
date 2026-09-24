// Characters of the Uko family: same skeleton, same animations, same face
// timing; only the head (and a few body accessories) change.
//   uko      the reference: round head, 17 hairstyles
//   aituko   robot: rounded screen head, LED face, antenna on a spring, side bolts
//   meowuko  cat: Uko's head and face + ears, nose, whiskers and a tail
//
// Each character describes its head silhouette (head-local units, radius 185,
// before head rotation). The pose code uses it so raised arms stay readable
// (elbow and forearm outside the head, as on Uko) and effects sit outside it.

const CHARACTER = { id: 'uko', accent: '#FFC93C' };
function normalizeCharacter(v) {
  const id = String(v || '').trim().toLowerCase();
  return CHARACTER_LIST.includes(id) ? id : 'uko';
}
function characterDef() { return CHARACTER.id === 'uko' ? null : CHARACTERS[CHARACTER.id]; }

// ---------------------------------------------------------------- geometry
// Signed distance to a rounded rectangle (centre c, half sizes h, corner radius r).
function sdRoundRect(x, y, c, h, r) {
  const qx = Math.abs(x - c[0]) - (h[0] - r), qy = Math.abs(y - c[1]) - (h[1] - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
// Signed distance to a convex polygon (negative inside).
function sdPolygon(x, y, pts) {
  let d = Infinity, inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, ay] = pts[j], [bx, by] = pts[i];
    const ex = bx - ax, ey = by - ay, wx = x - ax, wy = y - ay;
    const t = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey));
    d = Math.min(d, Math.hypot(wx - ex * t, wy - ey * t));
    if ((ay > y) !== (by > y) && x < ax + (bx - ax) * (y - ay) / (by - ay)) inside = !inside;
  }
  return inside ? -d : d;
}

const ROBOT = {
  box: { c: [0, -6], h: [192, 159], r: 86 },
  screen: { c: [0, -6], h: [150, 116], r: 56 },
  boltX: 206, eyeX: 61, eyeY: -23,
  lift: 14,             // the box sits a little higher than Uko's head: a bit of neck shows
  led: '#6CF0E0', screenFill: '#1C2033'
};
const CAT_EAR = [[160, -80], [170, -170], [128, -250], [40, -168]];

// ---------------------------------------------------------------- Aituko (robot)
function robotDistance(x, y) {
  const B = ROBOT.box;
  y += ROBOT.lift;
  let d = sdRoundRect(x, y, B.c, B.h, B.r);
  d = Math.min(d, sdRoundRect(Math.abs(x), y, [ROBOT.boltX, -13], [16, 39], 12));
  d = Math.min(d, Math.hypot(x - 8, y + 278) - 22);          // antenna ball
  return d;
}

// Antenna on a spring: it lags behind the head and wobbles a little.
// Decorative loops (antenna, ear flick, tail sway) are separate layers in the Rive
// file, so they stay still while the engine bakes clips (life auto off).
const decorOn = () => typeof LIFE === 'undefined' || LIFE.auto !== false;
function robotAntenna(now) {
  if (!decorOn()) return 0;
  const s = now / 1000;
  return 5 * Math.sin(s * 2.1) + 2 * Math.sin(s * 5.3 + 1);
}

// Artwork in head-local units (Uko's head radius = 185, before the lift). The SVG
// renderer and the Rive export (rive/extract_frames.cjs) both draw from it.
const ROBOT_ART = {
  antenna: 'M 0 -160 C -14 -190 16 -205 0 -228 C -12 -246 10 -256 8 -262', ball: [8, -278, 22], pivot: [0, -160],
  bolts: [-1, 1].map(side => ({ side, x: side * ROBOT.boltX - 16, y: -52, w: 32, h: 78, r: 12 })),
  box: { x: -192, y: -165, w: 384, h: 318, r: 86 },
  screen: { x: -150, y: -122, w: 300, h: 232, r: 56 },
  glare: 'M -118 -96 Q -128 -60 -118 -40',
  neck: [140, 200]      // y range, box bottom → the body's neck (head centre + 183, + lift)
};
const rectAttrs = b => `x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${b.r}"`;

function robotHeadMarkup(cx, cy, r, rot = 0, yaw = 0) {
  const s = r / 185, u = smooth5(Math.abs(yaw)), dir = screenFaceDirFromYaw(yaw), A = ROBOT_ART;
  const wob = robotAntenna(motionNow());
  // Profile: the box narrows, the far bolt goes behind it.
  const sx = 1 - .3 * u;
  const bolts = A.bolts.filter(b => b.side === dir || u < .35).map(b => `<rect class="headCircle" ${rectAttrs(b)} style="stroke-width:12"/>`).join('');
  const antenna = `<g transform="rotate(${wob.toFixed(2)} ${A.pivot[0]} ${A.pivot[1]})">`
    + `<path class="accessory" d="${A.antenna}"/><circle class="robotMark" cx="${A.ball[0]}" cy="${A.ball[1]}" r="${A.ball[2]}"/></g>`;
  const screen = `<g transform="${robotScreenTransform(u, dir)}"><rect class="robotScreen" ${rectAttrs(A.screen)}/><path class="robotGlare" d="${A.glare}"/></g>`;
  // Short neck from the box down to the body (the box sits `lift` higher than Uko's head).
  const neck = `<line class="bone" x1="0" y1="${A.neck[0]}" x2="0" y2="${A.neck[1]}"/>`;
  return `<g transform="translate(${cx} ${cy}) rotate(${rot}) scale(${s}) translate(0 ${-ROBOT.lift})">${neck}${antenna}<g transform="scale(${sx} 1)">${bolts}<rect class="headCircle" ${rectAttrs(A.box)}/>${screen}</g></g>`;
}
// In a turn the box narrows and the screen slides towards the facing side.
function robotScreenTransform(u, dir) { return `translate(${dir * 42 * u} 0) scale(${1 - .4 * u} 1)`; }

// LED face of one expression, as data: eyes (pills that blink and follow the gaze),
// strokes, filled shapes and ellipses. `dim` = the screen glows lower (sleep).
function robotFaceData(mode) {
  const ex = ROBOT.eyeX, ey = ROBOT.eyeY, out = [];
  const eye = (x, y, w, h) => out.push({ t: 'eye', x, y, w, h });
  const eyes = (w = 34, h = 58, dx = 0, dy = 0) => { eye(-ex + dx, ey + dy, w, h); eye(ex + dx, ey + dy, w, h); };
  const L = d => out.push({ t: 'led', d }), F = d => out.push({ t: 'ledFill', d });
  const O = (cx, cy, rx, ry) => out.push({ t: 'ledEllipse', cx, cy, rx, ry });
  const arc = (x, up) => `M ${x - (up ? 30 : 22)} ${up ? -18 : -16} Q ${x} ${up ? -62 : 0} ${x + (up ? 30 : 22)} ${up ? -18 : -16}`;
  switch (mode) {
    case 'welcome': eyes(); F('M -44 30 Q 0 88 44 30 Z'); break;
    case 'success': L(arc(-ex, true)); L(arc(ex, true)); F('M -46 28 Q 0 92 46 28 Z'); break;
    case 'thinking': eye(-ex + 8, ey - 14, 30, 46); eye(ex + 12, ey - 20, 30, 46);
      L(`M ${ex - 8} -84 Q ${ex + 14} -96 ${ex + 34} -84`); L('M -34 50 Q -12 38 10 50 Q 30 60 46 46'); break;
    case 'sleep': L(arc(-ex, false)); L(arc(ex, false)); L('M -18 52 Q 0 60 18 52'); out.dim = .7; break;
    case 'error': eyes(34, 50, 0, 4); L(`M ${-ex - 28} -66 L ${-ex + 22} -84`); L(`M ${ex - 22} -84 L ${ex + 28} -66`); L('M -40 62 Q 0 30 40 62'); break;
    case 'empty': eyes(30, 50, 0, 2); L(`M ${-ex - 22} -80 Q ${-ex} -92 ${-ex + 22} -80`); L(`M ${ex - 22} -80 Q ${ex} -92 ${ex + 22} -80`); L('M -16 56 Q 0 44 16 56'); break;
    case 'tapSurprised': eyes(34, 70); O(0, 50, 14, 18); break;
    case 'tapPlayful': L(arc(-ex, false)); eye(ex, ey, 34, 58); L('M -40 40 Q 0 76 44 36'); break;
    case 'tapOuch': L(`M ${-ex - 18} -44 L ${-ex + 16} -23 L ${-ex - 18} -2`); L(`M ${ex + 18} -44 L ${ex - 16} -23 L ${ex + 18} -2`); O(0, 52, 12, 15); break;
    case 'tapSquint': L(arc(-ex, false)); L(arc(ex, false)); L('M -40 42 Q 0 72 40 42'); break;
    default: eyes(); L('M -40 44 Q 0 72 40 44');
  }
  return out;
}
// Smallest open height of a blinking LED eye (viewBox units).
const ROBOT_EYE_MIN = 8;

// LED face, one expression at a time (a screen switches, it never cross-fades).
function robotFaceParts(mode, blink, gaze) {
  const [ox, oy] = [clamp(gaze[0] * .5, -16, 16), clamp(gaze[1] * .5, -12, 12)];
  const data = robotFaceData(mode);
  const svg = data.map(e => {
    if (e.t === 'eye') {
      const hh = Math.max(ROBOT_EYE_MIN, e.h * (1 - blink));
      return `<rect class="ledFill" x="${e.x + ox - e.w / 2}" y="${e.y + oy - hh / 2}" width="${e.w}" height="${hh}" rx="${Math.min(14, hh / 2)}"/>`;
    }
    if (e.t === 'ledEllipse') return `<ellipse class="led" cx="${e.cx}" cy="${e.cy}" rx="${e.rx}" ry="${e.ry}"/>`;
    return `<path class="${e.t}" d="${e.d}"/>`;
  }).join('');
  return data.dim ? `<g opacity="${data.dim}">${svg}</g>` : svg;
}

function robotFaceSpec(spec, cx, cy, r, rot = 0, blink = 0, eyeOffset = [0, 0], yaw = 0) {
  const s = r / 185, u = smooth5(Math.abs(yaw)), dir = screenFaceDirFromYaw(yaw);
  let mode = spec, b = blink;
  if (typeof spec !== 'string') {
    // Same trick as Uko: the expression changes while the eyes are shut.
    const k = clamp(spec.u);
    mode = k < .5 ? spec.from : spec.to;
    b = Math.max(blink, smooth5(clamp(1 - Math.abs(k - .5) / .2)));
  }
  return `<g transform="translate(${cx} ${cy}) rotate(${rot}) scale(${s}) translate(0 ${-ROBOT.lift}) scale(${1 - .3 * u} 1) ${robotScreenTransform(u, dir)}">${robotFaceParts(mode, b, eyeOffset)}</g>`;
}

// ---------------------------------------------------------------- Meowuko (cat)
function catDistance(x, y) {
  let d = Math.hypot(x, y) - 185;
  d = Math.min(d, sdPolygon(x, y, CAT_EAR), sdPolygon(-x, y, CAT_EAR));
  return d;
}

const CAT_ART = {
  ear: side => ({
    outer: `M ${side * 160} -80 C ${side * 170} -170 ${side * 150} -230 ${side * 128} -250 C ${side * 100} -232 ${side * 60} -200 ${side * 40} -168 Z`,
    inner: `M ${side * 132} -118 C ${side * 138} -168 ${side * 132} -200 ${side * 122} -214 C ${side * 104} -198 ${side * 82} -178 ${side * 70} -158 Z`,
    pivot: [side * 100, -120]
  }),
  nose: 'M -13 22 L 13 22 L 0 36 Z',
  whiskers: [[34, 22], [46, 50], [58, 78]],   // [y at the cheek, y at the tip], from x = ±98, 78 long
  tail: 'M 0 10 C 40 210 200 310 282 238 C 334 190 304 122 260 140 C 230 152 236 192 262 190'
};
// An ear flicks for 0.35 s every 5.3 s.
function catEarFlick(now) { if (!decorOn()) return 0; const ph = (now / 1000) % 5.3; return ph < .35 ? Math.sin(Math.PI * ph / .35) * 9 : 0; }

// Ears behind the head (their base is hidden by it). Now and then one ear flicks.
function catEarsMarkup(cx, cy, r, rot = 0, yaw = 0) {
  const s = r / 185, u = smooth5(Math.abs(yaw)), dir = screenFaceDirFromYaw(yaw);
  const flick = catEarFlick(motionNow());
  const ear = side => {
    const k = side === dir ? 1 : 1 - .45 * u;   // far ear shrinks behind the head in profile
    const E = CAT_ART.ear(side), tilt = side === 1 ? flick : 0;
    return `<g transform="rotate(${tilt.toFixed(2)} ${E.pivot[0]} ${E.pivot[1]}) translate(${side * 100 * (1 - k)} ${40 * (1 - k)}) scale(${k})">`
      + `<path class="headCircle" d="${E.outer}"/><path class="catInnerEar" d="${E.inner}"/></g>`;
  };
  return `<g transform="translate(${cx} ${cy}) rotate(${rot}) scale(${s}) translate(${dir * 40 * u} 0)">${ear(-1)}${ear(1)}</g>`;
}

// Nose and whiskers, on top of Uko's face (they follow the head turn).
function catFaceExtras(cx, cy, r, rot = 0, yaw = 0) {
  const s = r / 185, u = smooth5(Math.abs(yaw)), dir = screenFaceDirFromYaw(yaw);
  const nx = dir * lp(0, 150, Math.pow(u, .7));
  let out = `<path class="catNose" d="${CAT_ART.nose}" transform="translate(${nx} 0)"/>`;
  for (const side of [-1, 1]) {
    const far = side !== dir && u > .01;
    if (far && u > .45) continue;
    const k = far ? 1 - u / .45 : 1;
    const x0 = nx + side * 98 * k * (1 - .5 * u), len = 78 * k;
    for (const [y0, y1] of CAT_ART.whiskers) out += `<path class="catWhisker" d="M ${x0} ${y0} L ${x0 + side * len} ${y1}"/>`;
  }
  return `<g transform="translate(${cx} ${cy}) rotate(${rot}) scale(${s})">${out}</g>`;
}

// Tail: from the pelvis, out behind the leg, then a curl. It follows the body
// axis (lying down in sleep) and points backwards in a turn.
function catTailParams(p, yaw = 0) {
  const [px, py] = p.pelvis;
  const axis = Math.atan2(p.pelvis[1] - p.neck[1], p.pelvis[0] - p.neck[0]) * 180 / Math.PI - 90;
  // Side of the curl: behind the body in a turn; never into the floor when lying down.
  let side = Math.abs(yaw) > .3 ? -screenFaceDirFromYaw(yaw) : 1;
  if (Math.sin(axis * Math.PI / 180) * side > .3) side = -side;
  // Lying down, the tail is smaller and tilted towards the ground (curl kept round).
  const lying = Math.abs(Math.sin(axis * Math.PI / 180));
  return { x: px, y: py, rot: axis + 24 * lying * side, side, k: 1 - .3 * lying, lying };
}
// Gentle sway on top (degrees, towards the curl side).
function catTailSway(now, lying) { if (!decorOn()) return 0; return 6 * Math.sin(now / 1000 * 1.7) * (1 - .7 * lying); }
function catTailMarkup(p, yaw = 0) {
  if (!p.pelvis || !p.neck) return '';
  const t = catTailParams(p, yaw), rot = t.rot + catTailSway(motionNow(), t.lying) * t.side;
  return `<g transform="translate(${t.x} ${t.y}) rotate(${rot.toFixed(2)}) scale(${(t.side * t.k).toFixed(3)} ${t.k.toFixed(3)})"><path class="catTail" d="${CAT_ART.tail}"/></g>`;
}

// ---------------------------------------------------------------- registry
const CHARACTERS = {
  aituko: {
    reach: 290, cheeks: false, distance: robotDistance,
    head: robotHeadMarkup, face: robotFaceSpec, hair: () => '', body: () => ''
  },
  meowuko: {
    reach: 272, cheeks: true, distance: catDistance,
    face: (spec, cx, cy, r, rot, blink, eye, yaw) => ukoOrientedFaceSpec(spec, cx, cy, r, rot, blink, eye, yaw) + catFaceExtras(cx, cy, r, rot, yaw),
    hair: (cx, cy, r, rot, yaw, layer) => layer === 'back' ? catEarsMarkup(cx, cy, r, rot, yaw) : '',
    body: catTailMarkup
  }
};

// Is a point (viewBox) within `margin` of the character's head silhouette?
function characterCovers(q, pt, rot, margin) {
  const ch = characterDef();
  if (!ch) return false;
  const s = q.head_radius / 185, a = -(rot || 0) * Math.PI / 180;
  const dx = (pt[0] - q.head_center[0]) / s, dy = (pt[1] - q.head_center[1]) / s;
  const x = dx * Math.cos(a) - dy * Math.sin(a), y = dx * Math.sin(a) + dy * Math.cos(a);
  return ch.distance(x, y) < margin / s;
}

// Raised arms around a character head: the steepest V where the elbow, the
// forearm and the hand all clear the silhouette, like Uko's reference pose.
function characterArmAngle(sh, hc, dir, L, radius) {
  const ch = characterDef(), s = radius / 185;
  const out = (pt, m) => ch.distance((pt[0] - hc[0]) / s, (pt[1] - hc[1]) / s) >= m / s;
  let th = 62 * Math.PI / 180;
  for (; th > 12 * Math.PI / 180; th -= Math.PI / 90) {
    const w = [sh[0] + dir * L * Math.cos(th), sh[1] - L * Math.sin(th)];
    const e = [sh[0] + dir * 170 * Math.cos(th - .45), sh[1] - 170 * Math.sin(th - .45)];
    const h = [w[0] + dir * 10, w[1] - 32];
    const along = [.33, .66].map(k => [lp(e[0], w[0], k), lp(e[1], w[1], k)]);
    if (out(e, 24) && along.every(pt => out(pt, 24)) && out(w, 24) && out(h, 44)) break;
  }
  return th;
}
