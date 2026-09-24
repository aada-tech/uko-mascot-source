// Touch and gaze reactions (web engine).
//
// Touch: a tap on the mascot is hit-tested on the pose on screen (head, hand, foot,
// body) and plays a reaction of that zone (legacy TAP_REACTIONS, amplified), with a
// small effect drawn at the right place: stars on a boop, hearts on a giggle, a clap
// burst on a high five, dust on a hop… Taps in a row escalate: three on the head make
// it dizzy, three on the body make it laugh, five anywhere make it jump for joy.
// Asleep, a tap wakes it up. In the other states the tap only draws its effect.
//
// Gaze with the body: when what it looks at (lookAt() target, or the pointer with
// follow="page") is far to one side, the mascot turns its body towards it (¾), and
// turns round when it was facing the other way. A lookAt() target within reach makes
// the nearer hand reach out towards it. Idle only; walks, moves and turns win.

// Legacy reactions: longer and larger, so that they read at app size.
const TAP_AMP = 2.1;
for (const list of Object.values(TAP_REACTIONS)) for (const r of list) r.duration = Math.round(r.duration * 1.3);
// Escalations (taps in a row).
const TAP_COMBOS = {
  dizzy: { id: 'dizzy', label: 'Dizzy', duration: 1900, face: 'tapSquint' },
  laugh: { id: 'laugh', label: 'Laugh', duration: 2000, face: 'tapPlayful' },
  joy: { id: 'joy', label: 'Jump for joy', duration: 1500, face: 'success' }
};
const TOUCH = { fx: [], taps: [] };

// Hit test on the pose on screen; returns the reaction played (or null on a miss).
// poke(): the zone (and optionally the reaction) is given instead of hit-tested.
function touchTap(pt, pose, state, now, forcedZone, forcedReaction) {
  // A tap just off a limb that is moving still counts (as the body) inside the outline.
  const zone = forcedZone || hitTestMascot(pt[0], pt[1], pose) || (nearMascot(pt, pose) ? 'body' : null);
  if (!zone) return null;
  TOUCH.taps = TOUCH.taps.filter(t => now - t.at < 2600);
  TOUCH.taps.push({ at: now, zone });
  const family = tapFamily(zone);
  const hc = pose.head_center, hr = pose.head_radius || 95;
  if (state === 'sleep') { touchFx('exclaim', hc[0] + hr * 1.9, hc[1] - hr * 1.1, now, 900); return { zone, reaction: 'wake', wake: true }; }
  if (state !== 'idle' || !microAllowed()) { touchFx('stars', pt[0], pt[1], now, 650); return { zone, reaction: 'fx' }; }
  const inRow = f => TOUCH.taps.filter(t => now - t.at < 1500 && (!f || tapFamily(t.zone) === f)).length;
  let reaction = forcedReaction && TAP_COMBOS[forcedReaction] ? TAP_COMBOS[forcedReaction] : null;
  if (reaction) TOUCH.taps = [];
  else if (forcedReaction && TAP_REACTIONS[family].some(r => r.id === forcedReaction)) {
    if (!triggerTapReaction(zone, pt, now)) return null;
    const def = TAP_REACTIONS[family].find(r => r.id === forcedReaction);
    MICRO.tap.variant = def.id; MICRO.tap.duration = def.duration;
    spawnTapFx(def.id, zone, pt, pose, now);
    return { zone, reaction: def.id };
  }
  else if (TOUCH.taps.length >= 5) { reaction = TAP_COMBOS.joy; TOUCH.taps = []; }
  else if (family === 'head' && inRow('head') >= 3) { reaction = TAP_COMBOS.dizzy; TOUCH.taps = []; }
  else if (family === 'body' && inRow('body') >= 3) { reaction = TAP_COMBOS.laugh; TOUCH.taps = []; }
  if (reaction) {
    if (!triggerTapReaction(zone, pt, now)) return null;
    MICRO.tap.variant = reaction.id; MICRO.tap.duration = reaction.duration;
  } else {
    if (!triggerTapReaction(zone, pt, now)) return null;
    reaction = tapReactionDef();
  }
  spawnTapFx(reaction.id, zone, pt, pose, now);
  return { zone, reaction: reaction.id };
}

// Where a poke lands on each zone.
function zonePoint(zone, pose) {
  if (zone === 'head') return pose.head_center.slice();
  if (zone.startsWith('hand_')) return (pose[`${zone}_center`] || pose[`wrist_${zone.slice(-1)}`]).slice();
  if (zone.startsWith('foot_')) return (pose[`${zone}_center`] || pose[`ankle_${zone.slice(-1)}`]).slice();
  return [(pose.neck[0] + pose.pelvis[0]) / 2, (pose.neck[1] + pose.pelvis[1]) / 2];
}
function nearMascot(pt, pose) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const v of Object.values(pose)) if (Array.isArray(v) && v.length === 2) { x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0]); y0 = Math.min(y0, v[1]); y1 = Math.max(y1, v[1]); }
  const r = pose.head_radius || 95;
  return pt[0] > x0 - 60 && pt[0] < x1 + 60 && pt[1] > y0 - r - 40 && pt[1] < y1 + 50;
}
function spawnTapFx(id, zone, pt, pose, now) {
  const hc = pose.head_center, hr = pose.head_radius || 95, d = MICRO.tap.direction || 1;
  const side = zone.endsWith('_L') ? 'L' : 'R';
  const hand = pose[`hand_${side}_center`] || pt, foot = pose[`foot_${side}_center`] || pt;
  const top = [hc[0] + d * hr * 1.9, hc[1] - hr * 1.1];   // beside the head, clear of the hair
  switch (id) {
    case 'boop': touchFx('stars', pt[0], pt[1], now, 700); break;
    case 'giggle': touchFx('hearts', hc[0] + d * hr * 1.9, hc[1] - hr * .5, now, 1300); break;
    case 'squint': touchFx('bonk', pt[0], pt[1], now, 520); break;
    case 'wave': touchFx('arcs', hand[0], hand[1] - 90, now, 950, { dir: side === 'L' ? -1 : 1 }); break;
    case 'highFive': touchFx('clap', hand[0], hand[1] - 150, now, 620); touchFx('stars', hand[0], hand[1] - 150, now + 60, 700); break;
    case 'recoil': touchFx('exclaim', top[0], top[1], now, 900); break;
    case 'hop': touchFx('dust', foot[0], LEDGE_FLOOR, now, 760); break;
    case 'kick': touchFx('dust', foot[0] + (side === 'L' ? -40 : 40), LEDGE_FLOOR, now, 620); touchFx('stars', foot[0] + (side === 'L' ? -90 : 90), foot[1] - 60, now + 120, 600); break;
    case 'ouch': touchFx('bonk', pt[0], pt[1], now, 520); touchFx('exclaim', top[0], top[1], now + 80, 800); break;
    case 'bounce': touchFx('ring', hc[0], LEDGE_FLOOR, now, 700); break;
    case 'shimmy': touchFx('notes', hc[0] + d * hr * 1.9, hc[1] - hr * .3, now, 1300); break;
    case 'surprise': touchFx('exclaim', top[0], top[1], now, 900); break;
    case 'dizzy': touchFx('orbit', 0, 0, now, 1900); break;
    case 'laugh': touchFx('notes', hc[0] + hr * 1.9, hc[1] - hr * .3, now, 1500); touchFx('hearts', hc[0] - hr * 1.9, hc[1] - hr * .4, now + 350, 1400); break;
    case 'joy': touchFx('confetti', hc[0], hc[1] - hr * 1.7, now + 380, 1500); touchFx('ring', hc[0], LEDGE_FLOOR, now + 1100, 650); break;
    default: touchFx('stars', pt[0], pt[1], now, 650);
  }
}
const LEDGE_FLOOR = 1408;
function touchFx(kind, x, y, now, dur, extra) {
  TOUCH.fx.push(Object.assign({ kind, x, y, start: now, dur, seed: Math.random() * 1000 }, extra || {}));
  if (TOUCH.fx.length > 16) TOUCH.fx.shift();
}

// Poses of the escalations (offsets before the skeleton solve, like the other reactions).
function comboPose(v, p, q, env, d, moveArm) {
  let rot = 0;
  if (v === 'dizzy') {
    // The head circles, the body wobbles, the arms float.
    const a = q * Math.PI * 5, s = Math.sin(Math.PI * q);
    addOffset(p, 'head_center', Math.cos(a) * 18 * s, Math.sin(a) * 9 * s - 6 * s);
    addOffset(p, 'neck', Math.cos(a) * 8 * s, Math.sin(a) * 3 * s);
    addOffset(p, 'pelvis', -Math.cos(a) * 7 * s, 0);
    moveArm(-1, -20 * s, -6 * s + Math.sin(a) * 8 * s, -34 * s, -14 * s);
    moveArm(1, 20 * s, -6 * s - Math.sin(a) * 8 * s, 34 * s, -14 * s);
    rot += Math.sin(a) * 10 * s;
  } else if (v === 'laugh') {
    // Holds its belly and shakes with laughter.
    const s = Math.pow(Math.sin(Math.PI * q), .6), shake = Math.sin(q * Math.PI * 22) * s;
    const bx = (p.pelvis[0] + p.neck[0]) / 2, by = p.pelvis[1] - 60;
    for (const [side, sx] of [['L', -1], ['R', 1]]) {
      const h = p[`hand_${side}_center`], tx = bx + sx * 70, ty = by;
      const dx = (tx - h[0]) * s, dy = (ty - h[1]) * s;
      addOffset(p, `wrist_${side}`, dx, dy); addOffset(p, `hand_${side}_center`, dx, dy);
      addOffset(p, `elbow_${side}`, dx * .45 + sx * 26 * s, dy * .45);
    }
    addOffset(p, 'head_center', shake * 7, -10 * s + Math.abs(shake) * 6);
    addOffset(p, 'neck', shake * 4, -4 * s);
    addOffset(p, 'shoulder_L', shake * 3, Math.abs(shake) * 4); addOffset(p, 'shoulder_R', shake * 3, Math.abs(shake) * 4);
    rot += shake * 6 - 5 * s * d;
  } else if (v === 'joy') {
    // Crouch, jump with both arms up in the celebration's V, land with a small squash.
    const crouch = q < .22 ? Math.sin(Math.PI * q / .22 * .5) : q < .3 ? Math.cos(Math.PI * (q - .22) / .08 * .5) : 0;
    const air = q >= .26 && q <= .74 ? Math.sin(Math.PI * (q - .26) / .48) : 0;
    const land = q > .74 ? Math.sin(Math.PI * clamp((q - .74) / .26)) : 0;
    const lift = -190 * air + 34 * crouch + 22 * land;
    const up = smooth5(clamp(q < .26 ? q / .26 : q > .86 ? 1 - (q - .86) / .14 : 1));
    for (const k of Object.keys(p)) if (Array.isArray(p[k]) && p[k].length === 2) addOffset(p, k, 0, lift);
    for (const k of ['knee_L', 'knee_R']) addOffset(p, k, (k.endsWith('L') ? -1 : 1) * 26 * (crouch + land), 0);
    joyArms(p, up);
    rot += Math.sin(q * Math.PI * 2) * 3;
  }
  return rot;
}
// The celebration's raised V (core/celebration.js): as steep as the hair / head allows,
// elbow outside the head, so arms and forearms stay visible. up: 0 = rest → 1 = raised.
function joyArms(p, up) {
  const hc = p.head_center, reach = hairReach() + 40, L = 395, R = (p.head_radius || 185) + 12;
  for (const [side, dir] of [['L', -1], ['R', 1]]) {
    const sh = p[`shoulder_${side}`];
    let th = 62 * Math.PI / 180;
    if (characterDef()) th = characterArmAngle(sh, hc, dir, L, p.head_radius || 185);
    else {
      for (; th > 22 * Math.PI / 180; th -= Math.PI / 90) if (Math.hypot(sh[0] + dir * L * Math.cos(th) - hc[0], sh[1] - L * Math.sin(th) - hc[1]) >= reach) break;
      const elbowIn = a => Math.hypot(sh[0] + dir * 170 * Math.cos(a - .45) - hc[0], sh[1] - 170 * Math.sin(a - .45) - hc[1]) < R;
      while (th > 22 * Math.PI / 180 && elbowIn(th)) th -= Math.PI / 90;
    }
    const upW = [sh[0] + dir * L * Math.cos(th), sh[1] - L * Math.sin(th)];
    const upE = [sh[0] + dir * 170 * Math.cos(th - .45), sh[1] - 170 * Math.sin(th - .45)];
    const upH = [upW[0] + dir * 10, upW[1] - 32];
    const swing = Math.sin(Math.PI * up) * 40 * dir;
    for (const [key, to, sw] of [[`elbow_${side}`, upE, .6], [`wrist_${side}`, upW, 1], [`hand_${side}_center`, upH, 1]]) {
      const v = p[key]; p[key] = [lp(v[0], to[0], up) + swing * sw, lp(v[1], to[1], up)];
    }
  }
}

function touchFxMarkup(now) {
  TOUCH.fx = TOUCH.fx.filter(f => now - f.start < f.dur);
  if (!TOUCH.fx.length) return '';
  let out = '';
  // Effects are drawn large (they must read on a 100 px mascot), around their origin.
  const k = 1.9 * Math.sqrt(LIFE.gain || 1);
  for (const f of TOUCH.fx) {
    const u = (now - f.start) / f.dur;
    if (u < 0 || !FX_DRAW[f.kind]) continue;
    const g = FX_DRAW[f.kind](f, u);
    out += f.kind === 'orbit' || f.kind === 'confetti' || f.kind === 'ring' ? g : `<g transform="translate(${n1(f.x)} ${n1(f.y)}) scale(${n1(k)}) translate(${n1(-f.x)} ${n1(-f.y)})">${g}</g>`;
  }
  return out ? `<g class="touchFx" pointer-events="none">${out}</g>` : '';
}
const easeOutBack = x => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const popIn = u => (u < .22 ? easeOutBack(u / .22) : 1);
const fadeOut = (u, from = .55) => (u < from ? 1 : Math.max(0, 1 - (u - from) / (1 - from)));
const n1 = v => v.toFixed(1);
function star4(x, y, r, cls = 'touchStar') {
  const q = r * .28;
  return `<path class="${cls}" d="M ${n1(x)} ${n1(y - r)} Q ${n1(x + q)} ${n1(y - q)} ${n1(x + r)} ${n1(y)} Q ${n1(x + q)} ${n1(y + q)} ${n1(x)} ${n1(y + r)} Q ${n1(x - q)} ${n1(y + q)} ${n1(x - r)} ${n1(y)} Q ${n1(x - q)} ${n1(y - q)} ${n1(x)} ${n1(y - r)} Z"/>`;
}
function heart(x, y, s) {
  return `<path class="touchHeart" d="M ${n1(x)} ${n1(y + s * .95)} C ${n1(x - s * 1.5)} ${n1(y + s * .05)} ${n1(x - s * .95)} ${n1(y - s * 1.05)} ${n1(x)} ${n1(y - s * .3)} C ${n1(x + s * .95)} ${n1(y - s * 1.05)} ${n1(x + s * 1.5)} ${n1(y + s * .05)} ${n1(x)} ${n1(y + s * .95)} Z"/>`;
}
const FX_DRAW = {
  stars(f, u) {
    let s = ''; const k = popIn(u), a = fadeOut(u, .45);
    for (let i = 0; i < 5; i++) {
      const ang = -Math.PI / 2 + (i - 2) * .62 + Math.sin(f.seed + i) * .15, rad = 40 + 95 * (1 - Math.pow(1 - u, 2));
      s += star4(f.x + Math.cos(ang) * rad, f.y + Math.sin(ang) * rad, (i % 2 ? 15 : 22) * k);
    }
    return `<g opacity="${n1(a)}">${s}</g>`;
  },
  hearts(f, u) {
    let s = '';
    for (let i = 0; i < 3; i++) {
      const v = clamp((u - i * .12) / .88); if (v <= 0) continue;
      s += `<g opacity="${n1(fadeOut(v, .5))}">${heart(f.x + Math.sin(v * 7 + i * 2) * 18 + (i - 1) * 34, f.y - 200 * v - i * 20, (18 + i * 5) * popIn(v))}</g>`;
    }
    return s;
  },
  bonk(f, u) {
    let s = ''; const a = fadeOut(u, .3);
    for (let i = 0; i < 7; i++) {
      const ang = i / 7 * Math.PI * 2 + f.seed, r0 = 34 + 40 * u, r1 = r0 + 26 * (1 - u) + 8;
      s += `<line class="touchInk" x1="${n1(f.x + Math.cos(ang) * r0)}" y1="${n1(f.y + Math.sin(ang) * r0)}" x2="${n1(f.x + Math.cos(ang) * r1)}" y2="${n1(f.y + Math.sin(ang) * r1)}"/>`;
    }
    return `<g opacity="${n1(a)}">${s}</g>`;
  },
  clap(f, u) {
    let s = ''; const a = fadeOut(u, .35);
    for (let i = 0; i < 8; i++) {
      const ang = i / 8 * Math.PI * 2, r0 = 36 + 60 * u, r1 = r0 + 34 * (1 - u) + 6;
      s += `<line class="touchInk" x1="${n1(f.x + Math.cos(ang) * r0)}" y1="${n1(f.y + Math.sin(ang) * r0)}" x2="${n1(f.x + Math.cos(ang) * r1)}" y2="${n1(f.y + Math.sin(ang) * r1)}"/>`;
    }
    return `<g opacity="${n1(a)}">${s}${star4(f.x, f.y, 26 * popIn(u))}</g>`;
  },
  arcs(f, u) {
    let s = '';
    for (let i = 0; i < 2; i++) {
      const v = clamp(u * 1.3 - i * .25); if (v <= 0 || v >= 1) continue;
      const r = 60 + 70 * v, a0 = (f.dir > 0 ? 0 : Math.PI) - .6, a1 = a0 + 1.2;
      s += `<path class="touchInk" opacity="${n1(Math.sin(Math.PI * v))}" d="M ${n1(f.x + Math.cos(a0) * r)} ${n1(f.y + Math.sin(a0) * r)} A ${n1(r)} ${n1(r)} 0 0 1 ${n1(f.x + Math.cos(a1) * r)} ${n1(f.y + Math.sin(a1) * r)}"/>`;
    }
    return s;
  },
  exclaim(f, u) {
    const k = popIn(u), a = fadeOut(u, .6), y = f.y - 20 * u;
    return `<g opacity="${n1(a)}" transform="translate(${n1(f.x)} ${n1(y)}) scale(${n1(k)})"><line class="touchInk touchBold" x1="0" y1="-70" x2="0" y2="-12"/><circle class="touchDot" cx="0" cy="18" r="11"/></g>`;
  },
  dust(f, u) {
    let s = ''; const a = fadeOut(u, .35);
    for (const [dx, sz] of [[-1, 1], [1, .85], [-.35, .7], [.4, .6]]) {
      const x = f.x + dx * (40 + 120 * (1 - Math.pow(1 - u, 2))), y = f.y - 10 - 40 * u * sz, r = (16 + 22 * u) * sz;
      s += `<circle class="touchPuff" cx="${n1(x)}" cy="${n1(y)}" r="${n1(r)}"/>`;
    }
    return `<g opacity="${n1(a)}">${s}</g>`;
  },
  ring(f, u) {
    const e = 1 - Math.pow(1 - u, 3);
    return `<ellipse class="touchInk" cx="${n1(f.x)}" cy="${n1(f.y)}" rx="${n1(70 + 170 * e)}" ry="${n1(12 + 26 * e)}" opacity="${n1(1 - u)}"/>`;
  },
  notes(f, u) {
    let s = '';
    for (let i = 0; i < 3; i++) {
      const v = clamp((u - i * .18) / .82); if (v <= 0) continue;
      const x = f.x + (i - 1) * 40 + Math.sin(v * 8 + i) * 16, y = f.y - 190 * v - i * 16, k = popIn(v);
      s += `<g opacity="${n1(fadeOut(v, .5))}" transform="translate(${n1(x)} ${n1(y)}) scale(${n1(k)}) rotate(${n1(Math.sin(v * 6 + i) * 12)})"><ellipse class="touchNote" cx="-10" cy="22" rx="14" ry="10" transform="rotate(-20 -10 22)"/><path class="touchInk" d="M 2 20 L 2 -30 Q 18 -24 22 -8"/></g>`;
    }
    return s;
  },
  orbit(f, u) {
    const p = shown; if (!p) return '';
    const hc = p.head_center, hr = p.head_radius || 95, a = Math.min(1, u * 6, (1 - u) * 5);
    let s = '';
    for (let i = 0; i < 3; i++) {
      const ang = u * Math.PI * 6 + i * Math.PI * 2 / 3;
      const k = Math.sqrt(LIFE.gain || 1);
      s += star4(hc[0] + Math.cos(ang) * hr * 1.9, hc[1] - hr * 1.15 + Math.sin(ang) * hr * .45, (44 + 12 * Math.sin(ang)) * k);
    }
    // The orbit itself, faint, so it reads as "seeing stars".
    const ring = `<ellipse class="touchInk" cx="${n1(hc[0])}" cy="${n1(hc[1] - hr * 1.15)}" rx="${n1(hr * 1.9)}" ry="${n1(hr * .45)}" opacity=".35" stroke-dasharray="18 22"/>`;
    return `<g opacity="${n1(a)}">${ring}${s}</g>`;
  },
  confetti(f, u) {
    let s = ''; const t = u * f.dur / 1000, a = fadeOut(u, .6);
    for (let i = 0; i < 26; i++) {
      const r = Math.sin(f.seed + i * 12.9898) * 43758.5453, rnd = r - Math.floor(r), rnd2 = (r * 7.1) - Math.floor(r * 7.1);
      const ang = -Math.PI / 2 + (rnd - .5) * 2.4, sp = 700 + 700 * rnd2;
      const x = f.x + Math.cos(ang) * sp * t, y = f.y + Math.sin(ang) * sp * t + 1400 * t * t;
      s += `<rect class="touchConfetti touchC${i % 4}" x="-9" y="-15" width="18" height="30" rx="4" transform="translate(${n1(x)} ${n1(y)}) rotate(${n1(rnd * 360 + t * 540 * (i % 2 ? 1 : -1))})"/>`;
    }
    return `<g opacity="${n1(a)}">${s}</g>`;
  }
};

// ---------------------------------------------------------------- gaze with the body
const GAZE_BODY = { base: 0, lastAt: -1e9, awayAt: 0, reach: 0 };
// Turn without resetting the gaze (setOrientationTarget restarts the eyes).
function gazeTurnTo(target, dur) {
  const now = motionNow(), live = orientationEaseValue(now);
  ORIENTATION.demo = false; ORIENTATION.from = live; ORIENTATION.value = live;
  ORIENTATION.target = clamp(target, -1, 1); ORIENTATION.start = now; ORIENTATION.duration = CLOCK.reduced ? 1 : dur;
  ORIENTATION.faceSide = Math.abs(live) > .02 ? Math.sign(live) : (Math.abs(target) > .02 ? Math.sign(target) : 0);
  GAZE_BODY.lastAt = now;
}
// Called each idle frame with the point looked at (viewBox) or null.
function gazeBodyTurn(now, point, pose, object) {
  if (ORIENTATION.demo || !pose) return;
  const base = GAZE_BODY.base;
  if (!point) {
    if (now - GAZE_BODY.awayAt > 900 && Math.abs(ORIENTATION.target - base) > .05 && now - GAZE_BODY.lastAt > 400) gazeTurnTo(base, 620);
    return;
  }
  GAZE_BODY.awayAt = now;
  const dx = point[0] - pose.head_center[0], side = dx >= 0 ? 1 : -1;   // screen side of the target
  let want = ORIENTATION.target;
  if (Math.abs(base) > .05) {
    // Already turned (setOrientation): face the target's side, same angle.
    if (Math.abs(dx) > 150) want = -side * Math.abs(base);
  } else {
    // Facing front: turn ¾ towards a target far to the side (an object more readily than the mouse).
    const far = smooth5(clamp((Math.abs(dx) - (object ? 200 : 320)) / 520));
    want = -side * .55 * far;
  }
  if (Math.abs(want - ORIENTATION.target) > .15 && now - GAZE_BODY.lastAt > 450) gazeTurnTo(want, 560);
}
// A lookAt() target within reach: the nearer hand reaches out towards it.
function gazeReach(p, point, dt) {
  let want = 0, side = 'R', tip = null;
  if (point) {
    const sl = p.shoulder_L, sr = p.shoulder_R;
    const dl = Math.hypot(point[0] - sl[0], point[1] - sl[1]), dr = Math.hypot(point[0] - sr[0], point[1] - sr[1]);
    side = dl < dr ? 'L' : 'R';
    const sh = side === 'L' ? sl : sr, dist = Math.min(dl, dr);
    const arm = (SKELETON.upperArm[side] + SKELETON.foreArm[side]);
    if (dist < arm * 1.25 && point[1] < p.pelvis[1]) {
      want = 1;
      const k = Math.min(dist - 40, arm * .92) / (dist || 1);
      tip = [sh[0] + (point[0] - sh[0]) * k, sh[1] + (point[1] - sh[1]) * k];
    }
  }
  GAZE_BODY.reach += (want - GAZE_BODY.reach) * (1 - Math.exp(-dt / 180));
  // Letting go: the hand comes back from where it last reached.
  if (want) { GAZE_BODY.tip = tip; GAZE_BODY.side = side; } else { tip = GAZE_BODY.tip; side = GAZE_BODY.side || side; }
  if (GAZE_BODY.reach < .01 || !tip) return;
  const s = GAZE_BODY.reach, h = p[`hand_${side}_center`], sh = p[`shoulder_${side}`];
  const dx = (tip[0] - h[0]) * s, dy = (tip[1] - h[1]) * s;
  addOffset(p, `wrist_${side}`, dx, dy); addOffset(p, `hand_${side}_center`, dx, dy);
  const mid = [(sh[0] + tip[0]) / 2, (sh[1] + tip[1]) / 2], e = p[`elbow_${side}`];
  addOffset(p, `elbow_${side}`, (mid[0] + (side === 'L' ? -30 : 30) - e[0]) * s, (mid[1] + 40 - e[1]) * s);
}
