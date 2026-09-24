// Instance runtime: state machine, transitions, layer order and rendering.
//
// Frame pipeline (one owner per concern):
//   clip sample (authored MainMotion) → idle life / micro-interactions → attention
//   → solveSkeleton (fixed lengths) → orientation / walk / foot planting
//   → transition blend → face, blink, hair physics → SVG.
//
// Every state change blends from the pose that is on screen, so no joint can
// jump between two frames, whatever the order of calls from the host app.

const options = Object.assign({
  state: 'idle',
  // Brand colour = fill of the face, hands and feet (lightened / darkened for contrast).
  brandColor: '#FFFFFF',
  hairColor: '#0B0B0B',
  // Line colour follows the theme: 'auto' = site theme (html.dark / [data-theme=dark]),
  // 'system' = OS preference, or force 'light' / 'dark'.
  theme: 'auto',
  lineColor: 'auto',
  hairStyle: 'dreadlocks',
  // 'uko' (default), 'aituko' (robot) or 'meowuko' (cat). Same animations.
  character: 'uko',
  // Aituko's antenna light.
  accentColor: '#FFC93C',
  // 'auto' (default) enforces WCAG contrast; 'direct' uses colours as given.
  brandContrast: 'auto',
  hairContrast: 'auto',
  contrastMode: 'auto',
  interactive: true,
  // 'return': one-shot states (welcome, success, error, empty, wake) play once and
  // settle back to idle. 'loop': they repeat (useful for galleries and demos).
  oneShotMode: 'return',
  // Eyes follow the pointer: 'hover' (over the mascot), 'page' (anywhere on the page,
  // and the finger on touch screens) or 'none'.
  follow: 'hover',
  // Kawaii pink cheeks (false to hide them).
  cheeks: true,
  // Cap the drawing rate (e.g. 30 for galleries with many mascots). Time stays exact.
  maxFps: 60,
  onStateChange: null,
  onComplete: null,
  onTap: null
}, userOptions);

const ONE_SHOTS = new Set(['welcome', 'success', 'error', 'empty', 'wake']);
const PERSISTENT_ENTRY = { loading: 1000, thinking: 1000 };
const TRIGGER_MAP = {
  welcome: 'welcome', startThinking: 'thinking', stopThinking: 'idle', startLoading: 'loading',
  stopLoading: 'idle', success: 'success', error: 'error', empty: 'empty', sleep: 'sleep', wake: 'wake'
};

let brandColor = options.brandColor;
let hairColorVal = options.hairColor;
let brandContrastMode = options.brandContrast || options.contrastMode || 'auto';
let hairContrastMode = options.hairContrast || options.contrastMode || 'auto';
let themeOpt = options.theme || 'auto', lineColorOpt = options.lineColor || 'auto';
const systemDarkQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
let interactive = options.interactive;
let oneShotMode = options.oneShotMode === 'loop' ? 'loop' : 'return';
// Capped frame rate: each instance starts at a random phase, so that several mascots on
// a page (30 fps each) don't all redraw on the same display frame.
let minFrameMs = 1000 / Math.max(1, Math.min(120, Number(options.maxFps) || 60)), sinceDraw = Math.random() * minFrameMs;
let destroyed = false, rafId = null, flowTimer = null;

let cur = ORDER.includes(options.state) ? options.state : 'idle';
let curStart = 0;
let curEntered = false;
let blend = null;            // { from, fromFace, fromRot, start, dur, fromThinking }
let shown = null;            // last pose drawn (after orientation / walk)
let lastGazeFrame = 0;
let shownFace = 'idle';
let shownRot = 0;
let wasGaitLive = false;
APPEARANCE.hairStyle = normalizeHairStyle(options.hairStyle);
APPEARANCE.cheeks = options.cheeks !== false;
CHARACTER.id = normalizeCharacter(options.character);
CHARACTER.accent = options.accentColor || CHARACTER.accent;

el.innerHTML = `
  <div class="uko-mascot-wrapper" style="position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
    <svg viewBox="0 0 1024 1536" class="uko-mascot-svg" style="width:100%;height:100%;max-height:100%;display:block;overflow:visible;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Uko mascot">
      <defs><style>${MASCOT_SVG_STYLES}</style>
        <filter id="${INSTANCE_ID}-hair-outline" x="-10%" y="-10%" width="120%" height="120%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="7" result="grown"/>
          <feFlood style="flood-color: var(--bodyStrokeColor, #F4F4F8)" result="ink"/>
          <feComposite in="ink" in2="grown" operator="in" result="outline"/>
          <feMerge><feMergeNode in="outline"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <g class="uko-rig"></g>
      <g class="uko-fx"></g>
    </svg>
  </div>`;
const svgEl = el.querySelector('.uko-mascot-svg');
const rigEl = el.querySelector('.uko-rig');
const fxEl = el.querySelector('.uko-fx');

function currentThemeMode() {
  if (themeOpt === 'light' || themeOpt === 'dark') return themeOpt;
  if (themeOpt === 'system') return systemDarkQuery && systemDarkQuery.matches ? 'dark' : 'light';
  const html = document.documentElement;
  return html.classList.contains('dark') || html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

// Colour model
//  - Lines (body, face features, effects): one neutral colour per theme.
//  - Fill (face, hands, feet): the brand colour, adjusted in OKLCH so the lines
//    and facial features drawn on it reach 4.5:1 (WCAG AA): lighter in the light
//    theme, darker in the dark theme.
//  - Hair: at least 3:1 against the face (WCAG 1.4.11, graphical objects).
function updateColors() {
  const mode = currentThemeMode();
  const surface = mode === 'dark' ? '#15161E' : '#FFFFFF';
  const line = lineColorOpt !== 'auto' ? lineColorOpt : (mode === 'dark' ? '#F4F4F8' : '#16161D');
  const fill = brandContrastMode === 'direct' ? brandColor : ensureContrast(brandColor, line, 4.5, mode === 'dark' ? 'darker' : 'lighter');
  // Hair keeps its chosen colour. Light theme: at least 3:1 against the face.
  // Dark theme: a contour in the line colour separates it (like face, hands, feet).
  let hair = hairColorVal;
  if (hairContrastMode !== 'direct' && mode === 'light') hair = ensureContrast(hair, fill, 3, 'darker');
  HAIR_OUTLINE_FILTER = mode === 'dark' ? `${INSTANCE_ID}-hair-outline` : null;
  const vars = {
    '--bodyStrokeColor': line, '--detailColor': line, '--accessoryColor': line, '--accentColor': line, '--artifactNeutralColor': line,
    '--headFillColor': fill, '--handFillColor': fill, '--footFillColor': fill,
    '--stageBackground': surface, '--surfaceColor': surface,
    '--hairColor': hair, '--hairDetailColor': adaptiveHairDetailColor(hair, fill),
    '--characterAccent': CHARACTER.accent
  };
  for (const k in vars) svgEl.style.setProperty(k, vars[k]);
  svgEl.dataset.theme = mode;
}
updateColors();

// Gaze. Priority: lookAt() target > pointer (hover or page) > nothing.
let followMode = ['hover', 'page', 'none'].includes(options.follow) ? options.follow : 'hover';
// Full pack only: movements (walk, turn, climb) and the extended gaze (page, lookAt).
// The Starter keeps the mascot where it is and says where to get them.
const paidOnly = (name) => { if (EDITION !== 'starter') return false; fullPackNotice(name); return true; };
if (followMode === 'page' && paidOnly('follow="page"')) followMode = 'hover';
const GAZE = { target: null, releaseAt: 0 };
// null while the mascot is not laid out (hidden tab, closed dialog, display:none).
const toSvg = (x, y) => { const r = svgEl.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? [(x - r.left) * 1024 / r.width, (y - r.top) * 1536 / r.height] : null; };
function onPointerMove(e) {
  if (!interactive) return;
  const pt = toSvg(e.clientX, e.clientY); if (!pt) return;
  // A hand cursor over the drawing says "touch me".
  const over = !!(shown && hitTestMascot(pt[0], pt[1], shown));
  if (over !== pointerOver) { pointerOver = over; svgEl.style.cursor = over ? 'pointer' : ''; }
  if (CLOCK.reduced || followMode === 'none') return;
  MICRO.eyeTracking.pointer = pt;
  MICRO.eyeTracking.pointerInside = true;
  MICRO.eyeTracking.hovering = true;
}
// Touch: the zone under the finger reacts (core/touch.js).
let pointerOver = false;
// Touchable: no blue tap flash, no text selection or callout on a long press (mobile).
el.style.webkitTapHighlightColor = 'transparent';
function onTapDown(e) {
  if (!interactive || CLOCK.reduced || destroyed || (e.button !== undefined && e.button > 0)) return;
  const pt = toSvg(e.clientX, e.clientY); if (!pt || !shown) return;
  const r = touchTap(pt, shown, cur, motionNow());
  if (!r) return;
  if (r.wake) go('wake', 'tap');
  if (options.onTap) options.onTap(r);
}
function onPointerLeave() { MICRO.eyeTracking.hovering = false; if (followMode !== 'page') MICRO.eyeTracking.pointerInside = false; }
// Page follow: the mouse anywhere on the page; on touch screens the finger, then a
// short moment after it lifts. After a few seconds without movement the mascot
// looks away and goes back to its own life.
function onPagePointer(e) {
  if (followMode !== 'page' || !interactive || CLOCK.reduced || GAZE.target) return;
  const pt = toSvg(e.clientX, e.clientY); if (!pt) return;
  MICRO.eyeTracking.pointer = pt;
  MICRO.eyeTracking.pointerInside = true;
  GAZE.releaseAt = performance.now() + (e.pointerType === 'touch' ? 2500 : 5000);
}
function onPageLeave() { if (followMode === 'page' && !GAZE.target) GAZE.releaseAt = performance.now() + 600; }
function updateGaze() {
  const a = MICRO.eyeTracking;
  if (GAZE.target) {
    const t = GAZE.target;
    let pt;
    if (t.getBoundingClientRect) { const r = t.getBoundingClientRect(); pt = toSvg(r.left + r.width / 2, r.top + r.height / 2); }
    else pt = t.viewBox ? [t.x, t.y] : toSvg(t.x, t.y);
    if (!pt || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) { a.pointerInside = false; return; }
    a.pointer = pt;
    a.pointerInside = true; a.reach = 'eyes'; a.headToo = true; a.gain = LIFE.gain || 1;
    return;
  }
  a.headToo = false; a.gain = LIFE.gain || 1;
  a.reach = followMode === 'page' ? 'eyes' : 'full';
  if (followMode === 'page' && a.pointerInside && !a.hovering && performance.now() > GAZE.releaseAt) a.pointerInside = false;
}
function onVisibility() { CLOCK.lastWall = null; }
el.addEventListener('pointermove', onPointerMove, { passive: true });
el.addEventListener('pointerleave', onPointerLeave, { passive: true });
el.addEventListener('pointerdown', onTapDown, { passive: true });
window.addEventListener('pointermove', onPagePointer, { passive: true });
window.addEventListener('pointerdown', onPagePointer, { passive: true });
document.addEventListener('pointerleave', onPageLeave, { passive: true });
document.addEventListener('visibilitychange', onVisibility);

function dominantFace(spec) {
  if (!spec || typeof spec === 'string') return spec || 'idle';
  return spec.u < 0.5 ? spec.from : spec.to;
}

function emit(name) { if (options.onStateChange) options.onStateChange(name); }
function fullPackNotice(state) {
  const seen = fullPackNotice.seen || (fullPackNotice.seen = new Set());
  if (seen.has(state)) return;
  seen.add(state);
  console.info(`[UkoMascot] "${state}" fait partie du pack complet (9 états, mouvements, regard) : ${FULL_PACK_URL}`);
}

// Core state change. Always blends from what is on screen.
function go(next, reason) {
  // Any state change interrupts a scripted move (e.g. the form closes mid-climb).
  if (MOVE.name) { MOVE.name = null; MOVE.done = null; }
  if (!ORDER.includes(next)) {
    // Starter edition: a full-pack state keeps Uko where he is instead of breaking the app.
    if (FULL_ORDER.includes(next)) { fullPackNotice(next); return; }
    throw new Error(`[UkoMascot] Unknown state "${next}". Expected one of: ${ORDER.join(', ')}`);
  }
  const now = motionNow();
  const prev = cur;
  if (next === 'wake' && prev !== 'sleep') next = 'idle';
  if (next === prev && !ONE_SHOTS.has(next)) return;

  const settledIdle = prev === 'idle' && !blend && !(WALK.active);
  let offset = 0, dur;
  if (next === 'idle') {
    dur = prev === 'thinking' ? 900 : prev === 'loading' ? 600 : prev === 'sleep' ? 800 : 420;
  } else if (PERSISTENT_ENTRY[next]) {
    // From Idle the authored entry plays; from anything else go straight to the loop.
    if (settledIdle) dur = 220; else { offset = PERSISTENT_ENTRY[next]; dur = 480; }
  } else if (next === 'wake') {
    // Wake replays Sleep backwards (sleepT = .94·(1 − smooth3(t))). If Sleep was
    // interrupted before lying down, start Wake from that same point.
    const sleepT = curEntered ? 0.94 : Math.min(0.94, (now - curStart) / DUR.sleep);
    const q0 = 1 - sleepT / 0.94;
    let lo = 0, hi = 1;
    for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (smooth3(mid) < q0) lo = mid; else hi = mid; }
    offset = lo * DUR.wake;
    dur = 200;
  } else if (next === 'sleep') {
    dur = settledIdle ? 220 : 420;
  } else {
    // One-shots: skip the idle-based anticipation when coming from another pose.
    if (settledIdle) dur = 220; else { offset = 0.12 * DUR[next]; dur = 380; }
  }

  if (WALK.active) stopWalk();
  GAZE_BODY.base = 0;
  if (Math.abs(ORIENTATION.value) > 0.001 || Math.abs(ORIENTATION.target) > 0.001) setOrientationTarget(0, Math.max(360, dur));

  // Physically plausible transition speed: stretch the blend so no joint's peak
  // speed exceeds MAX_BLEND_SPEED (smooth5 peaks at 1.875× the mean speed).
  if (shown && !CLOCK.reduced) {
    // Measure the path each joint will actually sweep (angle blends travel on arcs).
    const target = previewPose(next, now - offset);
    const walked = {};
    let prevP = shown, far = 0;
    for (let i = 1; i <= 16; i++) {
      const m = mixPoses(shown, target, i / 16);
      for (const k of POINTS) if (m[k] && prevP[k]) {
        walked[k] = (walked[k] || 0) + Math.hypot(m[k][0] - prevP[k][0], m[k][1] - prevP[k][1]);
        far = Math.max(far, walked[k]);
      }
      prevP = m;
    }
    dur = Math.max(dur, 1.875 * far / MAX_BLEND_SPEED * 1000);
  }

  // Leaving Loading: the laptop does not just vanish (pop on success, drop on error).
  LAPTOP_EXIT = prev === 'loading' && curEntered && !CLOCK.reduced
    ? { start: now, kind: next === 'success' ? 'pop' : next === 'error' ? 'drop' : 'fade', shift: LIFE.laptopShift.slice() }
    : null;

  if (shown && !CLOCK.reduced) {
    blend = { from: cpy(shown), fromFace: shownFace, fromRot: shownRot, start: now, dur, fromThinking: prev === 'thinking' };
  } else {
    blend = null;
  }
  cur = next;
  curStart = now - offset;
  curEntered = offset > 0 && Boolean(PERSISTENT_ENTRY[next]);
  resetBlink();
  resetMicroInteractions();
  emit(cur);
}

const MAX_BLEND_SPEED = 2600; // viewBox px per second (~3 m/s at Uko's scale)

// Per-joint weights of a transition at progress u (0 → 1).
function blendWeights(u) {
  const head = smooth5(clamp(u / 0.82)), legs = smooth5(clamp((u - 0.06) / 0.94)), arms = smooth5(clamp((u - 0.14) / 0.86));
  return k => (k === 'head_center' || k === 'neck' || k.startsWith('shoulder')) ? head
    : (k.startsWith('elbow') || k.startsWith('wrist') || k.startsWith('hand')) ? arms : legs;
}

let LAPTOP_EXIT = null;
function laptopExitMarkup(now) {
  if (!LAPTOP_EXIT) return '';
  const e = LAPTOP_EXIT, dur = e.kind === 'drop' ? 520 : e.kind === 'pop' ? 360 : 260;
  const u = clamp((now - e.start) / dur);
  if (u >= 1) { LAPTOP_EXIT = null; return ''; }
  const [dx, dy] = e.shift;
  let tf = `translate(${dx} ${dy})`, extra = '';
  if (e.kind === 'pop') {
    const k = 1 + 0.16 * smooth3(u);
    tf += ` translate(700 690) scale(${k}) translate(-700 -690)`;
    // Three short "poof" lines around the laptop.
    const r = 150 + 90 * u, o = (1 - u).toFixed(3);
    extra = [-0.9, -0.35, 0.25].map(a => `<line class="accessory" style="opacity:${o}" x1="${700 + Math.cos(a) * r}" y1="${640 + Math.sin(a) * r}" x2="${700 + Math.cos(a) * (r + 34)}" y2="${640 + Math.sin(a) * (r + 34)}"/>`).join('');
  } else if (e.kind === 'drop') {
    const g = u * u;
    tf += ` translate(0 ${130 * g}) rotate(${22 * g} 640 740)`;
  }
  const opacity = e.kind === 'drop' ? 1 - smooth3(clamp((u - 0.35) / 0.65)) : 1 - smooth3(u);
  return `<g class="fxLaptopExit" opacity="${opacity.toFixed(3)}"><g transform="${tf}">${loadingLaptopMarkup(true)}</g>${extra}</g>`;
}

// Pose the clip of `state` would show at `now` if it had started at `startAt`.
function previewPose(state, startAt) {
  const saved = [current, start, entered];
  current = state; start = startAt; entered = false;
  let p;
  try { p = solveSkeleton(resolveMainMotionFrame(motionNow(), 1).pose); }
  finally { [current, start, entered] = saved; }
  return p;
}

// Additive gesture layer on top of the authored clips. Rotations happen around
// the elbow, so bone lengths are untouched.
function rotateAround(p, pivot, keys, deg) {
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  for (const k of keys) {
    const dx = p[k][0] - pivot[0], dy = p[k][1] - pivot[1];
    p[k] = [pivot[0] + dx * c - dy * s, pivot[1] + dx * s + dy * c];
  }
}
// Same rule around a character head (robot box, cat ears): a raised hand that
// would hide behind it moves out of the silhouette; hands touching the head on
// purpose (scratching, chin) stay where they are.
function clearCharacterHead(q) {
  const hc = q.head_center;
  for (const s of ['L', 'R']) {
    const h = q[`hand_${s}_center`];
    const d = Math.hypot(h[0] - hc[0], h[1] - hc[1]);
    if (d < 1 || !characterCovers(q, h, 0, 44)) continue;
    const w = smooth5(clamp((q.neck[1] - 40 - h[1]) / 80)) * smooth5(clamp((d - (q.head_radius + 40)) / 60));
    if (w <= 0) continue;
    let k = 0;
    while (k < 1.2 && characterCovers(q, [h[0] + (h[0] - hc[0]) * k, h[1] + (h[1] - hc[1]) * k], 0, 44)) k += .02;
    k *= w;
    for (const key of [`wrist_${s}`, `hand_${s}_center`]) q[key] = [q[key][0] + (h[0] - hc[0]) * k, q[key][1] + (h[1] - hc[1]) * k];
    const arm = drawnChain(q[`shoulder_${s}`], sub(q[`elbow_${s}`], q[`shoulder_${s}`]), q[`wrist_${s}`], SKELETON.upperArm[s], SKELETON.foreArm[s]);
    const off = sub(q[`hand_${s}_center`], q[`wrist_${s}`]);
    q[`elbow_${s}`] = arm.joint; q[`wrist_${s}`] = arm.end;
    q[`hand_${s}_center`] = [arm.end[0] + off[0], arm.end[1] + off[1]];
  }
}
// Raised hands never get lost inside a big hairstyle: push the hand radially
// out of the hair silhouette when the arm is long enough, then re-cap lengths.
function clearHairForHands(q) {
  if (cur === 'sleep' || cur === 'wake') return;
  if (characterDef()) return clearCharacterHead(q);
  const hc = q.head_center, reach = hairReach() * q.head_radius / 185 + 30;
  if (reach < 260) return;
  for (const s of ['L', 'R']) {
    const h = q[`hand_${s}_center`];
    const d = Math.hypot(h[0] - hc[0], h[1] - hc[1]);
    if (d >= reach || d < 1) continue;
    // Continuous weights: fades in with height, and never moves a hand that
    // touches the head on purpose (scratching, chin).
    const w = smooth5(clamp((q.neck[1] - 40 - h[1]) / 80)) * smooth5(clamp((d - (q.head_radius + 40)) / 60));
    if (w <= 0) continue;
    const k = w * (reach - d) / d;
    for (const key of [`wrist_${s}`, `hand_${s}_center`]) q[key] = [q[key][0] + (h[0] - hc[0]) * k, q[key][1] + (h[1] - hc[1]) * k];
    const arm = drawnChain(q[`shoulder_${s}`], sub(q[`elbow_${s}`], q[`shoulder_${s}`]), q[`wrist_${s}`], SKELETON.upperArm[s], SKELETON.foreArm[s]);
    const off = sub(q[`hand_${s}_center`], q[`wrist_${s}`]);
    q[`elbow_${s}`] = arm.joint; q[`wrist_${s}`] = arm.end;
    q[`hand_${s}_center`] = [arm.end[0] + off[0], arm.end[1] + off[1]];
  }
}

function applyGestures(q, state, t) {
  if (state === 'welcome' && t > .34 && t < .68) {
    // A real hello: the forearm swings from the elbow, ~2.5 times.
    const env = Math.sin(Math.PI * (t - .34) / .34);
    rotateAround(q, q.elbow_L, ['wrist_L', 'hand_L_center'], 16 * env * Math.sin(2 * Math.PI * (t * DUR.welcome) / 440));
  } else if (state === 'error' && t > .46 && t < .64) {
    // Head scratch: small quick rubs of the hand on the head.
    const env = Math.sin(Math.PI * (t - .46) / .18);
    rotateAround(q, q.elbow_R, ['wrist_R', 'hand_R_center'], 6 * env * Math.sin(2 * Math.PI * (t * DUR.error) / 180));
  }
}

function finishOneShot(now) {
  const done = cur;
  if (options.onComplete) options.onComplete(done);
  if (oneShotMode === 'loop' && done !== 'wake') {
    curStart = now;
    return;
  }
  go('idle', 'completed');
}

let debugFrame = null;
// Scripted move in progress (climb): it owns the whole body until it ends.
const MOVE = { name: null, start: 0, done: null, behind: false, onto: 0 };
function moveFrame(now) {
  const onto = MOVE.onto;
  const u = clamp((now - MOVE.start) / (onto ? MOVES.climbOnto.dur : MOVES[MOVE.name].dur));
  if (u >= 1) {
    const done = MOVE.done;
    MOVE.name = null; MOVE.done = null; MOVE.onto = 0;
    // Onto an object: it ends standing on it, the host raises the box (no blend down).
    // The last pose drawn moves into the new frame of reference, so the planted feet
    // stay on the top instead of where they were drawn inside the old box.
    if (onto && shown) { for (const k of Object.keys(shown)) if (Array.isArray(shown[k]) && shown[k].length === 2) shown[k] = [shown[k][0], shown[k][1] + onto]; resetFootwork(); }
    if (shown && !onto) blend = { from: cpy(shown), fromFace: shownFace, fromRot: shownRot, start: now, dur: 380, fromThinking: false };
    if (done) done();
    if (options.onComplete) options.onComplete('climb');
    return null;
  }
  if (onto) return { pose: climbOntoPose(u, onto), face: climbOntoFace(u), rot: climbOntoRot(u), frontArms: false };
  return { pose: climbPose(u, MOVE.behind), face: climbFace(u), rot: climbRot(u), frontArms: !MOVE.behind && u < .86 };
}

function frame(now) {
  // Legacy layer reads these.
  current = cur; start = curStart; entered = curEntered;
  smMode = true; smInternal = null; smBridge = null; smFaceHold = null; thinkExitStart = 0;

  const elapsed = now - curStart;
  if (ONE_SHOTS.has(cur) && elapsed >= DUR[cur]) finishOneShot(now);
  current = cur; start = curStart; entered = curEntered;

  const main = resolveMainMotionFrame(now, 1);
  let p = main.pose, t = main.t, loop = main.loop;
  curEntered = entered = main.entered;
  const mv = MOVE.name && !CLOCK.reduced ? moveFrame(now) : null;
  if (mv) p = mv.pose;
  MOVE_FRONT_ARMS = !!mv && mv.frontArms;

  const walkActive = WALK.active;
  let rotOffset = 0;
  if (cur === 'idle' && !walkActive && !CLOCK.reduced && !mv) {
    rotOffset += applyIdleLife(p, loop);
    rotOffset += applyMicroInteractions(p, now);
  }

  // Life layer (core/life.js): breathing, weight shifts and small gestures in the
  // persistent states, paused while a tap reaction or the pointer owns Uko.
  let life = { rot: 0, eye: [0, 0] };
  if (now - LIFE.gainAt > 500 || now < LIFE.gainAt) { const w = el.clientWidth || 240; LIFE.gain = lifeGainFor(w); LIFE.lod = w * ((typeof window !== "undefined" && window.devicePixelRatio) || 1) < 200; LIFE.gainAt = now; }
  if (!walkActive && !CLOCK.reduced && !mv) {
    const busy = cur === 'idle' && (MICRO.tap.active || MICRO.idleVariation.active || MICRO.eyeTracking.hovering || !!GAZE.target);
    life = applyLife(p, cur, now, cur === 'idle' || curEntered, busy);
    rotOffset += life.rot;
  }

  let faceMode = CLOCK.reduced ? (cur === 'wake' ? 'idle' : DATA.faceModes[cur]) : faceSpecFor(cur, t, curEntered, now);
  faceMode = applyMicroFace(faceMode, now);
  if (mv) faceMode = mv.face;

  if (!CLOCK.reduced) updateGaze();
  const attention = CLOCK.reduced || mv ? { eye: [0, 0], head: [0, 0, 0] } : updateAttentionTracking(now, faceMode, p);
  const attentionRot = applyAttentionPose(p, attention);
  // Gaze with the body (core/touch.js): turn towards what it looks at, reach for it.
  const gazeDt = Math.min(50, Math.max(0, now - lastGazeFrame)); lastGazeFrame = now;
  const bodyFree = cur === 'idle' && !walkActive && !mv && !CLOCK.reduced && !MICRO.tap.active;
  const eyes = MICRO.eyeTracking;
  const gazePoint = !eyes.pointerInside ? null : GAZE.target ? eyes.pointer : followMode === 'page' && !eyes.hovering ? eyes.pointer : null;
  if (bodyFree) gazeBodyTurn(now, gazePoint, shown, !!GAZE.target);
  if (bodyFree || GAZE_BODY.reach > .01) gazeReach(p, bodyFree && GAZE.target ? gazePoint : null, gazeDt);
  attention.eye = [attention.eye[0] + life.eye[0], attention.eye[1] + life.eye[1]];

  let q = solveSkeleton(p);
  if (!CLOCK.reduced && !mv) applyGestures(q, cur, t);
  if (!CLOCK.reduced && !walkActive && !mv) applyLifeGestures(q, cur, now);
  if (!mv) clearHairForHands(q);
  let rot = (CLOCK.reduced ? (DATA.headRot[cur === 'wake' ? 'idle' : cur] || 0) : headRotationFor(cur, t, curEntered)) + rotOffset + attentionRot;
  if (mv) rot = mv.rot;

  const orient = orientationMotionFrame(now);
  const yaw = mv ? 0 : cur === 'idle' || walkActive ? orient.bodyYaw : 0;
  const headYaw = orient.headYaw;
  if (Math.abs(yaw) > 0.001) q = applyOrientationPose(q, yaw);
  if (Math.abs(orient.velocity) > 0.00001 && cur === 'idle') q = applyTurnDynamics(q, yaw, orient.velocity);
  // Feet stay planted while turning, including the turn that starts a walk;
  // the gait takes over once the body is in profile and the walk has begun.
  const gaitLive = walkActive && Math.abs(yaw) > 0.68 && now >= WALK.start;
  // First gait frame: ease from the planted stance into the stride.
  if (gaitLive && !wasGaitLive && shown && !blend && !CLOCK.reduced) blend = { from: cpy(shown), fromFace: shownFace, fromRot: shownRot, start: now, dur: 300, fromThinking: false };
  wasGaitLive = gaitLive;
  if (cur === 'idle' && !gaitLive && !blend && !mv) applyFootPlanting(q, now, shown, yaw); else resetFootwork();
  if (gaitLive) { q = applyWalkCycle(q, yaw, now); rot += WALK.rot; }
  resolveLimbs(q); reattachHead(q);

  // Transitions blend displayed poses: the pose on screen when the change was
  // requested → the fully composed pose of the new state.
  HOLD_THINKING_FRONT = false;
  if (blend) {
    const u = clamp((now - blend.start) / blend.dur);
    const w = smooth5(u);
    // Overlapping action: the head leads, the legs follow, the arms trail.
    q = mixPoses(blend.from, q, blendWeights(u));
    rot = lp(blend.fromRot, rot, w);
    const toFace = dominantFace(faceMode);
    if (u < 1 && blend.fromFace !== toFace) faceMode = faceBlendSpec(blend.fromFace, toFace, w);
    HOLD_THINKING_FRONT = blend.fromThinking && w < 0.7;
    if (u >= 1) blend = null;
  }

  lastPose = q;
  shown = q;
  shownFace = dominantFace(faceMode);
  shownRot = rot;

  const [hx, hy] = q.head_center;
  updateHairPhysics(now, hx, hy, q.head_radius, rot, headYaw);
  const blink = CLOCK.reduced ? 0 : blinkAmount(now, faceMode);
  const laptop = cur === 'loading';
  HAIR_LOD = !!LIFE.lod;
  rigEl.innerHTML = renderRig(q, faceMode, rot, blink, laptop, attention.eye, yaw, headYaw);
  fxEl.innerHTML = fxMarkup(cur, q, t, loop, laptop ? true : curEntered) + laptopExitMarkup(now) + microFxMarkup(now);
  // Debug builds expose the composed frame (used to bake the Rive file).
  if (DEBUG_BUILD) debugFrame = { state: cur, t, loop, entered: curEntered, pose: q, face: faceMode, rot, blink, yaw,
    eye: attention.eye.slice(), lapShift: LIFE.laptopShift.slice(),
    tail: CHARACTER.id === 'meowuko' ? catTailParams(q, yaw) : null,
    lapExit: LAPTOP_EXIT ? { kind: LAPTOP_EXIT.kind, since: now - LAPTOP_EXIT.start, shift: LAPTOP_EXIT.shift } : null };
}

function loopTick(wall) {
  if (destroyed) return;
  const delta = CLOCK.lastWall === null ? 0 : Math.min(50, Math.max(0, wall - CLOCK.lastWall));
  CLOCK.lastWall = wall;
  // Time runs under reduced motion too (one-shots still complete); only the visuals are static.
  if (!document.hidden && !CLOCK.paused) CLOCK.time += delta;
  sinceDraw += delta;
  if (sinceDraw + 1 >= (onScreen ? minFrameMs : OFFSCREEN_FRAME_MS) && !CLOCK.paused) { sinceDraw = 0; frame(motionNow()); }
  rafId = requestAnimationFrame(loopTick);
}

// Off screen (scrolled away, display: none), a mascot keeps its clock and logic
// (one-shots end, moves call onDone) but redraws only 4 times a second.
const OFFSCREEN_FRAME_MS = 250;
let onScreen = true;
const viewObserver = typeof IntersectionObserver === 'function'
  ? new IntersectionObserver(es => { const e = es[es.length - 1]; const was = onScreen; onScreen = e.isIntersecting; if (onScreen && !was) sinceDraw = Infinity; }, { rootMargin: '120px' })
  : null;
if (viewObserver) viewObserver.observe(el);

curStart = motionNow();
// No onStateChange during create(): the host already knows the initial state and
// its callback may reference bindings that are not initialised yet.
frame(motionNow());
rafId = requestAnimationFrame(loopTick);

const themeObserver = new MutationObserver(updateColors);
themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
if (systemDarkQuery && systemDarkQuery.addEventListener) systemDarkQuery.addEventListener('change', updateColors);

function flow(first, second, delay, onDone) {
  if (flowTimer) clearTimeout(flowTimer);
  go(first);
  flowTimer = setTimeout(() => { flowTimer = null; go(second); if (onDone) onDone(); }, delay);
}

return {
  setState(nextState) { if (flowTimer) { clearTimeout(flowTimer); flowTimer = null; } go(nextState); },
  trigger(name) {
    const target = TRIGGER_MAP[name];
    if (!target) throw new Error(`[UkoMascot] Unknown trigger "${name}". Expected one of: ${Object.keys(TRIGGER_MAP).join(', ')}`);
    go(target);
  },
  startLoading() { go('loading'); },
  resolveSuccess() { go('success'); },
  resolveError() { go('error'); },
  wake() { go('wake'); },

  // Walk in place. speed scales the cadence (1 = 1080 ms per cycle).
  // To walk *across* the screen, move the host element by getWalkVelocity():
  // the planted foot then stays fixed on the ground.
  startWalk(dir = 1, speed = 1) {
    if (paidOnly('walk')) return;
    if (cur !== 'idle') go('idle');
    blend = null;
    startWalk(dir);
    WALK.speed = Math.max(0.25, Math.min(3, Number(speed) || 1));
    emit('walk');
  },
  // Ground speed of the walk in viewBox units per second (signed, screen x).
  // Multiply by (element height / 1536) to get CSS px per second.
  getWalkVelocity() {
    if (!WALK.active || motionNow() < WALK.start) return 0;
    const blendIn = smooth5(clamp((Math.abs(ORIENTATION.value) - .68) / .32));
    const stance = 2 * WALK_GAIT.stride / (WALK_GAIT.stance * WALK.cycleMs / WALK.speed); // units per ms, see walkLegSample
    return WALK.screenDir * stance * 1000 * blendIn;
  },
  stopWalk() {
    // Settle from the last walking pose into the standing pose.
    if (WALK.active && shown && !CLOCK.reduced) blend = { from: cpy(shown), fromFace: shownFace, fromRot: shownRot, start: motionNow(), dur: 420, fromThinking: false };
    stopWalk();
    setOrientationTarget(0, 520);
    emit(cur);
  },
  isWalking() { return Boolean(WALK.active); },
  setOrientation(yaw, duration = 520) {
    if (paidOnly('setOrientation')) return;
    if (WALK.active) stopWalk();
    if (cur !== 'idle') go('idle');
    setOrientationTarget(yaw, duration);
    GAZE_BODY.base = clamp(Number(yaw) || 0, -1, 1);
  },
  playTurnDemo() {
    if (paidOnly('playTurnDemo')) return;
    if (WALK.active) stopWalk();
    if (cur !== 'idle') go('idle');
    GAZE_BODY.base = 0;
    playOrientationTurn();
  },

  flowThinkingToLoading(onComplete) { flow('thinking', 'loading', 1800, onComplete); },
  flowLoadingToSuccess(onComplete) { flow('loading', 'success', 1800, onComplete); },
  flowLoadingToError(onComplete) { flow('loading', 'error', 1800, onComplete); },
  flowSleepToWake(onComplete) { flow('sleep', 'wake', 2600, onComplete); },

  setBrandColor(hex) { brandColor = hex; updateColors(); },
  setHairColor(hex) { hairColorVal = hex; updateColors(); },
  setTheme(mode) { themeOpt = mode || 'auto'; updateColors(); },
  setLineColor(hex) { lineColorOpt = hex || 'auto'; updateColors(); },
  getTheme() { return currentThemeMode(); },
  setHairStyle(style) { APPEARANCE.hairStyle = normalizeHairStyle(style); },
  setCheeks(on) { APPEARANCE.cheeks = on !== false; },
  // Scripted move: climb onto the ledge the mascot stands on (see core/moves.js).
  // Idle afterwards; onDone when standing. Ignored under prefers-reduced-motion.
  // onto: climb onto a low object whose top is that high above the feet line (fraction
  // of the mascot box, 0.1–0.45); without it, climb up the ledge it hangs from.
  climb({ onDone, behind = false, onto = 0 } = {}) {
    if (paidOnly('climb')) { if (onDone) onDone(); return; }
    if (CLOCK.reduced) { if (onDone) onDone(); return; }
    if (WALK.active) stopWalk();
    if (cur !== 'idle') go('idle');
    blend = null;
    MOVE.name = 'climb'; MOVE.start = motionNow(); MOVE.done = onDone || null; MOVE.behind = Boolean(behind);
    MOVE.onto = onto ? clamp(Number(onto) || 0, .1, .45) * 1536 : 0;
  },
  isMoving() { return Boolean(MOVE.name); },
  // Play a touch reaction as if that zone were tapped: 'head', 'hand', 'foot', 'body'
  // (or 'hand_L'…). Optional reaction id (e.g. 'highFive', 'dizzy', 'laugh', 'joy').
  poke(zone = 'body', reaction) {
    if (!shown || CLOCK.reduced) return null;
    const z = ['head', 'hand_L', 'hand_R', 'foot_L', 'foot_R', 'body'].includes(zone) ? zone : zone === 'hand' ? 'hand_R' : zone === 'foot' ? 'foot_R' : 'body';
    const r = touchTap(zonePoint(z, shown), shown, cur, motionNow(), z, reaction);
    if (r && r.wake) go('wake', 'poke');
    return r ? r.reaction : null;
  },
  setCharacter(id) { CHARACTER.id = normalizeCharacter(id); },
  setAccentColor(hex) { CHARACTER.accent = hex || '#FFC93C'; updateColors(); },
  setBrandContrast(mode) { brandContrastMode = mode; updateColors(); },
  setHairContrast(mode) { hairContrastMode = mode; updateColors(); },
  setContrastMode(mode) { brandContrastMode = mode; hairContrastMode = mode; updateColors(); },
  setInteractive(val) { interactive = Boolean(val); if (!interactive) { MICRO.eyeTracking.pointerInside = false; MICRO.eyeTracking.hovering = false; } },
  // Eyes follow the pointer: 'hover', 'page' (whole page, finger on touch) or 'none'.
  setFollow(mode) { if (mode === 'page' && paidOnly('follow="page"')) mode = 'hover'; followMode = ['hover', 'page', 'none'].includes(mode) ? mode : 'hover'; if (followMode === 'none') MICRO.eyeTracking.pointerInside = false; },
  // Look at an element, a point on the page ({ x, y } in client px) or a point of the
  // mascot's own drawing ({ x, y, viewBox: true }); null gives the gaze back.
  lookAt(target) {
    if (target && paidOnly('lookAt')) return;
    GAZE.target = target || null;
    if (!target) { MICRO.eyeTracking.pointerInside = false; MICRO.eyeTracking.reach = followMode === 'page' ? 'eyes' : 'full'; }
  },
  setOneShotMode(mode) { oneShotMode = mode === 'loop' ? 'loop' : 'return'; },
  setMaxFps(fps) { minFrameMs = 1000 / Math.max(1, Math.min(120, Number(fps) || 60)); },
  pause() { CLOCK.paused = true; },
  resume() { CLOCK.paused = false; CLOCK.lastWall = null; },

  getState() { return WALK.active ? 'walk' : cur; },
  getBrandColor() { return brandColor; },
  getHairColor() { return hairColorVal; },
  getHairStyle() { return APPEARANCE.hairStyle; },
  getCharacter() { return CHARACTER.id; },
  getSvgElement() { return svgEl; },
  // Debug/QA: the pose that was last drawn (joint positions in the 1024×1536 viewBox).
  getPose() { return shown ? cpy(shown) : null; },
  // Canonical bone lengths (viewBox px) shared with the Rive export.
  getSkeleton() { return cpy(SKELETON); },
  // QA builds only (build_mascot_engine.js --debug): internal state for tests.
  ...(DEBUG_BUILD ? { _debug() {
    return {
      hair: HAIR_DYNAMICS, walk: WALK, orientation: ORIENTATION, frame: debugFrame,
      face: (spec, blink = 0) => orientedFaceSpec(spec, 0, 0, 185, 0, blink, [0, 0], 0),
      fx: () => fxEl.innerHTML,
      gaze: () => ({ ...MICRO.eyeTracking, follow: followMode, target: !!GAZE.target, idleVar: MICRO.idleVariation.active, tap: MICRO.tap.active }),
      // Head silhouette (head-local units): < 0 inside. Uko: the head circle.
      silhouette: (x, y) => characterDef() ? characterDef().distance(x, y) : Math.hypot(x, y) - 185,
      // Character artwork (head-local units) for the Rive export.
      art: () => ({
        character: CHARACTER.id, accent: CHARACTER.accent,
        robot: { ...ROBOT, art: ROBOT_ART, eyeMin: ROBOT_EYE_MIN,
          faces: Object.fromEntries(['idle', 'welcome', 'thinking', 'success', 'error', 'empty', 'sleep'].map(m => { const d = robotFaceData(m); return [m, { items: d.slice(), dim: d.dim || 1 }]; })) },
        cat: { ears: [-1, 1].map(CAT_ART.ear), nose: CAT_ART.nose, whiskers: CAT_ART.whiskers, tail: CAT_ART.tail }
      }),
      // Rive baking: life({ auto: false, bake: {...rates} }) and beat(name, side).
      life: (cfg) => { if ('auto' in cfg) LIFE.auto = cfg.auto; if ('bake' in cfg) LIFE.bake = cfg.bake; },
      beat: (name, side) => lifeForce(name, side, motionNow())
    };
  } } : {}),
  // QA: advance this instance's clock deterministically (ms) and draw one frame.
  step(ms) { CLOCK.time += Math.max(0, ms); frame(motionNow()); },
  destroy() {
    destroyed = true;
    if (rafId) cancelAnimationFrame(rafId);
    if (flowTimer) clearTimeout(flowTimer);
    el.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerleave', onPointerLeave);
    el.removeEventListener('pointerdown', onTapDown);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pointermove', onPagePointer);
    window.removeEventListener('pointerdown', onPagePointer);
    document.removeEventListener('pointerleave', onPageLeave);
    themeObserver.disconnect();
    if (viewObserver) viewObserver.disconnect();
    if (systemDarkQuery && systemDarkQuery.removeEventListener) systemDarkQuery.removeEventListener('change', updateColors);
    el.innerHTML = '';
  }
};
