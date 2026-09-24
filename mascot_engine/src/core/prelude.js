// Instance-local clock and the bindings the legacy layer expects to find.
// Everything here is re-created for each mascot, so two mascots on the same
// page never share time, state, hair simulation, walk or orientation.

const CLOCK = {
  time: 0,
  lastWall: null,
  paused: false,
  reduced: typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false
};
function motionNow() { return CLOCK.time; }

// Legacy motion globals. The runtime writes them before each frame; the legacy
// clip sampler, face and FX code only read them.
let current = 'idle', start = 0, entered = false;
let thinkExitStart = 0, thinkExitPose = null, lastPose = null;
// smMode=true makes Wake a finite clip; bridges are handled by the runtime blend.
let smMode = true, smLogical = 'Idle', smInternal = null, smBridge = null, smExit = null, smFaceHold = null;
let HOLD_THINKING_FRONT = false;
// Dark theme: hair gets a contour in the line colour (set by the runtime).
let HAIR_OUTLINE_FILTER = null;
const INSTANCE_ID = 'uko' + Math.random().toString(36).slice(2, 8);

// Inert stand-ins for the prototype's QA controls.
const freeze = { checked: false };
const slow = { checked: false };
const showP = { checked: false };
const showG = { checked: false };
const piv = { innerHTML: '' };
const ghost = { innerHTML: '' };
const walkPlay = { textContent: '' };
const microTapBtn = { textContent: '' };
const microVariationBtn = { textContent: '' };
const microStatus = { textContent: '' };
const smLog = { textContent: '' };
let smLogLines = [];
const thinkingExit = { classList: { add() {}, remove() {} } };
const badge = { textContent: '' };
const desc = { textContent: '' };
const durationEl = { textContent: '' };
const DESC = { idle: '' };
const DURATION_LABEL = { idle: '' };
function renderGhost() {}
function tabsRender() {}
function smWrite() {}
function smRefresh() {}
function smRefreshPersistentPhase() {}
function smToIdle() {}
function smSetVisual() {}
function stateName(s) {
  const map = { idle: 'Idle', welcome: 'Welcome', loading: 'LoadingLoop', thinking: 'ThinkingLoop', success: 'Success', error: 'Error', empty: 'Empty', sleep: 'SleepLoop', wake: 'Wake' };
  return map[s] || s;
}
