// Life layer: keeps the persistent states (idle, thinking, loading, sleep) alive.
//
// What people read as "alive" in a character, and how it is built here:
//   1. A continuous base: breathing and weight drift on periods that never line up
//      (3.6 s, 5.3 s, 7.7 s), so the loop never visibly repeats.
//   2. Small gestures ("beats") every few seconds, drawn at random from a pool per
//      state, never the same twice in a row, each with anticipation → action → settle.
//      Duolingo builds its idle motion the same way: separate head and body
//      animations recombined at runtime so neutral loops never feel canned.
//   3. A story over time for waits. Loading types in bursts; after 10 s (the limit
//      of attention, Nielsen) it adds patience gestures. An occupied wait feels
//      shorter than an empty one (Maister).
//   4. Thinking looks away and up, like people do under cognitive load (gaze aversion).
// Everything is additive on top of the authored poses. Arm motion is expressed as
// targets or rotations that are re-solved on the fixed skeleton: bones never stretch.

const LIFE = {
  state: null, since: 0, beat: null, next: 0, last: null, side: 1,
  stanceFrom: 0, stanceTo: 0, stanceAt: -1e9,
  typing: { on: true, until: 0 },
  laptopShift: [0, 0],
  gain: 1, gainAt: -1e9,
  // Rive baking (debug builds): no random beats, loop-friendly periods, fixed typing rhythm.
  auto: true, bake: null
};
const LIFE_RATES = { breath: 3.6, sway: 7.7, drift: 5.3, type: 5.2, nod: 2.6, typeRot: 1.3, chinBurst: 2.6, chinTap: 3.1 };
const lifeRate = k => (LIFE.bake && LIFE.bake[k]) || LIFE_RATES[k];

// Starts a named beat now (Rive baking, tests).
function lifeForce(name, side, now) {
  LIFE.side = side || 1;
  LIFE.beat = { name, start: now, dur: BEAT_DUR[name], side: LIFE.side };
  LIFE.last = name;
}

// Readability at small sizes: a mascot drawn 90 px wide needs bigger gestures than
// one drawn 300 px wide (same principle as thumbnails in animation). Width in CSS px.
function lifeGainFor(width) { return 1 + 0.8 * clamp((220 - width) / 140); }

const LIFE_POOLS = {
  idle: { every: [4200, 8200], first: [1800, 3000], pool: ['glance', 'shift', 'tap', 'shrug', 'lookUp'] },
  thinking: { every: [2300, 4200], first: [700, 1200], pool: ['ponder', 'scratch', 'ponder', 'shift', 'nod'] },
  loading: { every: [2400, 4200], first: [1200, 2000], pool: ['check', 'lean', 'peek', 'shift'], patient: ['tap', 'sigh', 'check', 'peek', 'lean', 'shift'] },
  sleep: { every: [6500, 11000], first: [2600, 4000], pool: ['snuggle', 'twitch'] }
};
const BEAT_DUR = {
  glance: 1700, shift: 1300, tap: 1500, shrug: 1200, lookUp: 1900,
  ponder: 2300, scratch: 2200, nod: 1300,
  check: 1400, lean: 1800, sigh: 1700, peek: 1600,
  snuggle: 2400, twitch: 900
};
const lifeRand = (a, b) => a + Math.random() * (b - a);
// Anticipation → hold → settle, with zero velocity at both ends.
const lifeEnv = u => smooth5(clamp(u / 0.26)) * (1 - smooth5(clamp((u - 0.7) / 0.3)));

function lifeReset(state, now) {
  const cfg = LIFE_POOLS[state];
  LIFE.state = state; LIFE.since = now; LIFE.beat = null; LIFE.last = null;
  LIFE.stanceFrom = LIFE.stanceTo = 0; LIFE.stanceAt = -1e9;
  LIFE.typing = { on: true, until: now + lifeRand(1600, 2600) };
  LIFE.laptopShift = [0, 0];
  LIFE.next = cfg ? now + lifeRand(cfg.first[0], cfg.first[1]) : Infinity;
}

function lifeStance(now) {
  const u = smooth5(clamp((now - LIFE.stanceAt) / BEAT_DUR.shift));
  return LIFE.stanceFrom + (LIFE.stanceTo - LIFE.stanceFrom) * u;
}

// Picks and advances the current beat. `busy` pauses new beats (tap reactions,
// idle variation, pointer tracking) without cutting a beat that already started.
function lifeTick(state, now, busy) {
  if (LIFE.state !== state) lifeReset(state, now);
  const cfg = LIFE_POOLS[state];
  if (!cfg) return null;
  if (LIFE.beat && now - LIFE.beat.start >= LIFE.beat.dur) {
    LIFE.beat = null;
    LIFE.next = now + lifeRand(cfg.every[0], cfg.every[1]);
  }
  if (!LIFE.beat && now >= LIFE.next && LIFE.auto) {
    if (busy) { LIFE.next = now + 600; return null; }
    const pool = (state === 'loading' && now - LIFE.since > 10000) ? cfg.patient : cfg.pool;
    const choices = pool.filter(n => n !== LIFE.last);
    const name = choices[Math.floor(Math.random() * choices.length)] || pool[0];
    LIFE.side = name === 'ponder' ? -LIFE.side : (Math.random() < 0.5 ? -1 : 1);
    LIFE.beat = { name, start: now, dur: BEAT_DUR[name], side: LIFE.side };
    LIFE.last = name;
    if (name === 'shift') {
      const s = lifeStance(now);
      LIFE.stanceFrom = s;
      LIFE.stanceTo = Math.abs(s) > 0.5 ? (Math.random() < 0.4 ? 0 : -Math.sign(s)) : (Math.random() < 0.5 ? -1 : 1);
      LIFE.stanceAt = now;
    }
  }
  if (!LIFE.beat) return null;
  const u = clamp((now - LIFE.beat.start) / LIFE.beat.dur);
  return { name: LIFE.beat.name, u, e: lifeEnv(u), side: LIFE.beat.side };
}

function lifeMove(p, keys, dx, dy) { for (const k of keys) addOffset(p, k, dx, dy); }
const TORSO_KEYS = ['neck', 'shoulder_L', 'shoulder_R', 'elbow_L', 'elbow_R', 'wrist_L', 'wrist_R', 'hand_L_center', 'hand_R_center'];

// Pre-skeleton layer: body offsets, head rotation and gaze. Returns { rot, eye }.
function applyLife(p, state, now, entered, busy) {
  const out = { rot: 0, eye: [0, 0] };
  LIFE.laptopShift = [0, 0];
  if (!LIFE_POOLS[state] || !entered) { if (LIFE.state !== state) lifeReset(state, now); return out; }
  const beat = lifeTick(state, now, busy);
  // Thinking: the hand rests on the chin, so it must follow the head (offsets and tilt).
  const chin = state === 'thinking' ? { hc: p.head_center.slice(), hand: p.hand_R_center.slice(), wrist: p.wrist_R.slice(), elbow: p.elbow_R.slice() } : null;
  const s = now / 1000, TAU = Math.PI * 2, g = LIFE.gain;
  const breath = Math.sin(TAU * s / lifeRate('breath')), sway = Math.sin(TAU * s / lifeRate('sway') + 1.3), drift = Math.sin(TAU * s / lifeRate('drift') + 0.4);

  if (state === 'sleep') {
    // Lying on the back: the chest rises toward the ceiling, the head follows a little.
    lifeMove(p, ['neck', 'shoulder_L', 'shoulder_R'], 0, -5.5 * breath);
    addOffset(p, 'head_center', 0, -2.5 * breath);
    addOffset(p, 'elbow_R', 0, -3 * breath);
    out.rot += 1.2 * drift;
  } else {
    // Standing: breathing lifts the chest and the head, the weight drifts slowly.
    const bA = state === 'idle' ? 0 : 3.5, wA = state === 'loading' ? 3 : state === 'idle' ? 4 : 6;
    addOffset(p, 'head_center', 0, -bA * breath);
    lifeMove(p, ['neck', 'shoulder_L', 'shoulder_R'], 0, -bA * 0.7 * breath);
    lifeMove(p, ['head_center', ...TORSO_KEYS], wA * sway, 0);
    addOffset(p, 'pelvis', wA * 0.6 * sway, 0);
    out.rot += (state === 'idle' ? 1.6 : 2.4) * drift;
    // Weight shift held between beats (idle, thinking): hips over one foot.
    if (state === 'idle' || state === 'thinking' || state === 'loading') {
      const st = lifeStance(now);
      lifeMove(p, ['head_center', ...TORSO_KEYS], 9 * st, 0);
      addOffset(p, 'pelvis', 12 * st, 2 * Math.abs(st));
      out.rot += -1.5 * st;
    }
  }

  if (state === 'loading') {
    // Typing in bursts: fingers lift and strike, the head nods with the rhythm.
    if (LIFE.bake && LIFE.bake.typing) {
      const [on, off] = LIFE.bake.typing;
      LIFE.typing.on = (now - LIFE.since) % (on + off) < on;
    } else if (now >= LIFE.typing.until) {
      LIFE.typing.on = !LIFE.typing.on;
      LIFE.typing.until = now + (LIFE.typing.on ? lifeRand(1500, 2800) : lifeRand(420, 900));
    }
    const k = LIFE.typing.on ? 1 : 0;
    const tf = lifeRate('type'), tl = Math.max(0, Math.sin(TAU * tf * s)), tr = Math.max(0, Math.sin(TAU * tf * s + 2.6));
    lifeMove(p, ['wrist_L', 'hand_L_center'], 0, -17 * g * tl * k);
    lifeMove(p, ['wrist_R', 'hand_R_center'], 0, -17 * g * tr * k);
    addOffset(p, 'head_center', 0, 4 * g * Math.sin(TAU * lifeRate('nod') * s) * k);
    out.rot += 1.5 * g * Math.sin(TAU * lifeRate('typeRot') * s) * k;
    out.eye[1] += 4;   // eyes on the screen
  }

  if (beat) {
    // E = envelope × size gain (bigger gestures when Uko is drawn small). Gaze is not scaled.
    const { name, e, u, side } = beat, E = e * g;
    if (name === 'glance') { out.rot += side * 9 * E; out.eye[0] += side * 7 * e; out.eye[1] -= 1 * e; addOffset(p, 'head_center', side * 5 * E, 0); }
    else if (name === 'lookUp') { out.rot -= side * 3 * E; out.eye[0] += side * 3 * e; out.eye[1] -= 6 * e; addOffset(p, 'head_center', 0, -4 * E); }
    else if (name === 'shrug') {
      const up = Math.sin(Math.PI * clamp(u / 0.7)) * (u < 0.7 ? 1 : 0) * g;
      lifeMove(p, ['shoulder_L', 'shoulder_R', 'elbow_L', 'elbow_R', 'wrist_L', 'wrist_R', 'hand_L_center', 'hand_R_center'], 0, -16 * up);
      addOffset(p, 'head_center', 0, -5 * up); addOffset(p, 'neck', 0, -7 * up);
    }
    else if (name === 'tap') addOffset(p, 'pelvis', 0, 2 * Math.abs(Math.sin(Math.PI * 6 * u)) * E);
    else if (name === 'ponder') {
      // Head tilts, eyes look up and away, the chin hand stays put.
      out.rot += side * 10 * E; out.eye[0] += side * 6 * e; out.eye[1] -= 7 * e;
      addOffset(p, 'head_center', side * 5 * E, -3 * E);
    }
    else if (name === 'nod') { out.rot += 5 * Math.sin(TAU * 2 * u) * E; addOffset(p, 'head_center', 0, 5 * Math.abs(Math.sin(TAU * u)) * E); }
    else if (name === 'scratch') {
      // Free hand up to the head, a few rubs, back down (targets on the fixed skeleton).
      // Same geometry as the authored head scratch of Error, mirrored: the forearm
      // rises along the side of the head, the hand lands on the upper side of the skull.
      const hc = p.head_center;
      const tgt = { hand_L_center: [hc[0] - 167, hc[1] - 69], wrist_L: [hc[0] - 187, hc[1] - 41], elbow_L: [hc[0] - 286, hc[1] + 103] };
      for (const k of Object.keys(tgt)) p[k] = [p[k][0] + (tgt[k][0] - p[k][0]) * e, p[k][1] + (tgt[k][1] - p[k][1]) * e];
      out.rot += 4 * E; out.eye[1] -= 5 * e;
    }
    else if (name === 'check') { out.rot += 11 * E; out.eye[0] += 8 * e; out.eye[1] -= 11 * e; addOffset(p, 'head_center', 7 * E, -6 * E); addOffset(p, 'neck', 3 * E, -2 * E); }
    else if (name === 'peek') {
      // Peeks over the laptop screen toward the viewer, then back to work.
      out.rot += 13 * E; out.eye[0] -= 6 * e; out.eye[1] -= 2 * e;
      addOffset(p, 'head_center', 26 * E, -10 * E); addOffset(p, 'neck', 10 * E, -3 * E);
      lifeMove(p, ['shoulder_L', 'shoulder_R'], 5 * E, 0);
    }
    else if (name === 'lean') {
      lifeMove(p, ['head_center'], 12 * E, 20 * E); lifeMove(p, ['neck'], 8 * E, 13 * E);
      lifeMove(p, ['shoulder_L', 'shoulder_R'], 6 * E, 9 * E); out.eye[1] += 3 * e; out.rot += 4 * E;
      lifeMove(p, ['wrist_L', 'hand_L_center', 'wrist_R', 'hand_R_center'], 6 * E, 7 * E);
    }
    else if (name === 'sigh') {
      const up = u < 0.45 ? Math.sin(Math.PI / 2 * u / 0.45) : Math.cos(Math.PI / 2 * clamp((u - 0.45) / 0.55)) * 1.35 - 0.35;
      const k = up * E;
      lifeMove(p, ['neck', 'shoulder_L', 'shoulder_R'], 0, -12 * k); addOffset(p, 'head_center', 0, -8 * k);
      out.eye[1] -= 6 * Math.max(0, up * e);
    }
    else if (name === 'snuggle') { out.rot += side * 6 * E; lifeMove(p, ['head_center', 'neck'], 0, 4 * E); lifeMove(p, ['shoulder_L', 'shoulder_R'], 3 * side * E, 2 * E); }
    // tap (feet), twitch and the scratch rubs are rotations: see applyLifeGestures.
  }

  if (chin) {
    // Hand and wrist keep their place on the face: head offset + extra tilt around its centre.
    const hc = p.head_center, a = out.rot * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
    const pin = (from) => { const v = [from[0] - chin.hc[0], from[1] - chin.hc[1]]; return [hc[0] + v[0] * c - v[1] * sn, hc[1] + v[0] * sn + v[1] * c]; };
    const nh = pin(chin.hand), nw = pin(chin.wrist);
    const d = [nh[0] - chin.hand[0], nh[1] - chin.hand[1]];
    p.hand_R_center = nh; p.wrist_R = nw;
    p.elbow_R = [chin.elbow[0] + d[0] * 0.5 + (p.elbow_R[0] - chin.elbow[0]), chin.elbow[1] + d[1] * 0.5 + (p.elbow_R[1] - chin.elbow[1])];
  }

  // The laptop (loading) follows the body, not the typing hands.
  if (state === 'loading') {
    const lean = beat && beat.name === 'lean' ? beat.e * g : 0;
    LIFE.laptopShift = [3 * sway + 9 * lifeStance(now) + 6 * lean, 7 * lean];
  }
  return out;
}

// Post-skeleton layer: rotations around joints (lengths are preserved).
function applyLifeGestures(q, state, now) {
  const b = LIFE.beat;
  if (state === 'thinking' && LIFE.state === 'thinking') {
    // Index taps on the chin, in short bursts.
    const s = now / 1000, burst = Math.max(0, Math.sin(Math.PI * 2 * s / lifeRate('chinBurst')));
    const onScratch = b && b.name === 'scratch';
    if (!onScratch) rotateAround(q, q.elbow_R, ['wrist_R', 'hand_R_center'], 3.5 * Math.sin(Math.PI * 2 * lifeRate('chinTap') * s) * smooth5(clamp(burst * 2 - 0.6)));
  }
  if (!b || LIFE.state !== state) return;
  const u = clamp((now - b.start) / b.dur), e = lifeEnv(u);
  if (b.name === 'tap') {
    // Toes lift and tap three times, heel planted.
    const side = b.side > 0 ? 'R' : 'L', dir = side === 'R' ? -1 : 1;
    const lift = Math.pow(Math.abs(Math.sin(Math.PI * 3 * u)), 0.7) * e;
    rotateAround(q, q[`ankle_${side}`], [`foot_${side}_center`], dir * 16 * lift);
  } else if (b.name === 'twitch') {
    rotateAround(q, q.ankle_R, ['foot_R_center'], 14 * Math.sin(Math.PI * 2 * u) * Math.sin(Math.PI * u));
  } else if (b.name === 'scratch' && u > 0.3 && u < 0.72) {
    const env = Math.sin(Math.PI * (u - 0.3) / 0.42);
    rotateAround(q, q.elbow_L, ['wrist_L', 'hand_L_center'], 7 * env * Math.sin(Math.PI * 2 * (u * b.dur) / 190));
  }
}
