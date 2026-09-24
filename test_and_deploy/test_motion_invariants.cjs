#!/usr/bin/env node
// Motion invariants for the Uko engine. Deterministic: each instance is paused
// and advanced with step(ms), so results do not depend on machine speed.
//
//   node test_and_deploy/test_motion_invariants.cjs [--engine path/to/engine.js] [--json out.json]
//
// Checks
//  1. No stretch: every limb's screen length ≤ its canonical length (+tolerance);
//     the torso and the neck-to-head distance are exactly fixed.
//  2. Continuity: no joint moves more than MAX_STEP px between two 60 fps frames,
//     including across every state → state switch.
//  3. Isolation: two instances on one page keep independent state, walk and time.
//  4. One-shots return to idle; wake returns to idle.
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const argVal = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const enginePath = path.resolve(argVal('--engine') || path.join(__dirname, '..', 'mascot_engine', 'dist', 'uko-mascot-engine.js'));
const jsonOut = argVal('--json');

function loadPuppeteer() {
  const candidates = ['puppeteer', path.join(__dirname, '..', '..', 'node_modules', 'puppeteer')];
  for (const c of candidates) { try { return require(c); } catch (e) { /* next */ } }
  throw new Error('puppeteer not found. Run `npm i -D puppeteer`.');
}

const FRAME = 1000 / 60;
// Largest move allowed between two 60 fps frames (1024×1536 viewBox). Hands are
// the end of the chain and may move fast (≈4 m/s peak); everything else less.
const MAX_STEP = 45, MAX_STEP_HAND = 75;
const STRETCH_TOL = 1.0;      // px
const STATES = ['idle', 'welcome', 'thinking', 'loading', 'success', 'error', 'empty', 'sleep', 'wake'];

(async () => {
  const puppeteer = loadPuppeteer();
  const browser = await puppeteer.launch({ headless: 'new', protocolTimeout: 600000 });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setContent(`<!doctype html><body style="margin:0"><div id="a" style="width:300px;height:450px"></div><div id="b" style="width:300px;height:450px"></div></body>`);
  await page.addScriptTag({ content: fs.readFileSync(enginePath, 'utf8') });

  const result = await page.evaluate(({ FRAME, MAX_STEP, MAX_STEP_HAND, STRETCH_TOL, STATES }) => {
    const failures = [];
    const stats = { frames: 0, maxStep: 0, maxStepAt: '', maxStretch: 0, maxStretchAt: '', torsoDev: 0, headDev: 0 };
    const m = UkoMascot.create('#a', { hairStyle: 'dreadlocks', interactive: false });
    m.pause();
    const SK = m.getSkeleton();
    m.step(0);
    const P0 = m.getPose();
    const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const LIMBS = [['shoulder_L', 'elbow_L'], ['elbow_L', 'wrist_L'], ['shoulder_R', 'elbow_R'], ['elbow_R', 'wrist_R'],
      ['hip_L', 'knee_L'], ['knee_L', 'ankle_L'], ['hip_R', 'knee_R'], ['knee_R', 'ankle_R']];
    const canon = [SK.upperArm.L, SK.foreArm.L, SK.upperArm.R, SK.foreArm.R, SK.thigh.L, SK.shin.L, SK.thigh.R, SK.shin.R];
    const spine = SK.spine, neckHead = SK.neckToHead;
    const JOINTS = Object.keys(P0).filter(k => Array.isArray(P0[k]) && P0[k].length === 2 && typeof P0[k][0] === 'number' && k !== 'upperShift');

    let prev = null;
    function check(label, frontal) {
      const p = m.getPose();
      stats.frames++;
      LIMBS.forEach(([a, b], i) => {
        const over = d(p[a], p[b]) - canon[i];
        if (over > stats.maxStretch) { stats.maxStretch = over; stats.maxStretchAt = `${label} ${a}-${b}`; }
      });
      if (frontal) {
        stats.torsoDev = Math.max(stats.torsoDev, Math.abs(d(p.neck, p.pelvis) - spine));
        stats.headDev = Math.max(stats.headDev, Math.abs(d(p.neck, p.head_center) - neckHead));
      }
      if (prev) for (const k of JOINTS) {
        if (!p[k] || !prev[k]) continue;
        const s = d(p[k], prev[k]) * (k.startsWith('hand_') || k.startsWith('wrist_') ? MAX_STEP / MAX_STEP_HAND : 1);
        if (s > stats.maxStep) { stats.maxStep = s; stats.maxStepAt = `${label} ${k}`; }
      }
      prev = p;
    }
    function run(ms, label, frontal = true) { for (let t = 0; t < ms; t += FRAME) { m.step(FRAME); check(label, frontal); } }

    // Every ordered pair of states, switched mid-animation.
    m.setState('idle'); run(600, 'idle');
    for (const a of STATES) for (const b of STATES) {
      if (a === b) continue;
      m.setState(a); run(700, `(…)→${a}`);
      m.setState(b); run(700, `${a}→${b}`);
    }
    // Complete clips back to idle.
    for (const s of ['welcome', 'success', 'error', 'empty']) {
      m.setState(s); run(4200, s);
      if (m.getState() !== 'idle') failures.push(`${s} did not return to idle (got ${m.getState()})`);
    }
    m.setState('sleep'); run(3500, 'sleep'); m.setState('wake'); run(2600, 'wake');
    if (m.getState() !== 'idle') failures.push(`wake did not return to idle (got ${m.getState()})`);

    // Walk and turn (projection may shorten limbs, never lengthen them).
    m.startWalk(1); run(3000, 'walk', false); m.stopWalk(); run(900, 'walk-stop', false);
    m.setOrientation(1); run(900, 'yaw90', false); m.setOrientation(-0.5); run(900, 'yaw-45', false);
    m.setState('success'); run(800, 'yaw→success', false);

    if (stats.maxStretch > STRETCH_TOL) failures.push(`limb stretched by ${stats.maxStretch.toFixed(2)} px (${stats.maxStretchAt})`);
    if (stats.torsoDev > 0.5) failures.push(`torso length drift ${stats.torsoDev.toFixed(2)} px`);
    if (stats.headDev > 0.5) failures.push(`head detached from neck by ${stats.headDev.toFixed(2)} px`);
    if (stats.maxStep > MAX_STEP) failures.push(`joint jumped ${stats.maxStep.toFixed(1)} px in one frame (${stats.maxStepAt})`);

    // Isolation
    const b = UkoMascot.create('#b', { hairStyle: 'afro_femme', interactive: false }); b.pause();
    m.setState('idle'); m.step(500);
    b.setState('sleep'); b.startWalk(1);
    for (let i = 0; i < 60; i++) { m.step(FRAME); b.step(FRAME); }
    if (m.isWalking()) failures.push('isolation: walking one instance made the other walk');
    if (m.getState() !== 'idle') failures.push(`isolation: instance A state changed to ${m.getState()}`);
    if (!b.isWalking()) failures.push('isolation: instance B is not walking');
    if (m.getHairStyle() === b.getHairStyle()) failures.push('isolation: hair style shared');
    b.destroy(); m.destroy();
    return { failures, stats };
  }, { FRAME, MAX_STEP, MAX_STEP_HAND, STRETCH_TOL, STATES });

  await browser.close();
  if (errors.length) result.failures.push(...errors.map(e => 'page error: ' + e));
  const s = result.stats;
  console.log(`frames checked: ${s.frames}`);
  console.log(`max limb overshoot: ${s.maxStretch.toFixed(2)} px  (${s.maxStretchAt || '-'})`);
  console.log(`torso drift: ${s.torsoDev.toFixed(3)} px · head/neck drift: ${s.headDev.toFixed(3)} px`);
  console.log(`max joint step: ${s.maxStep.toFixed(1)} px/frame, hands scaled ×${(MAX_STEP / MAX_STEP_HAND).toFixed(2)}  (${s.maxStepAt})`);
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(result, null, 2));
  if (result.failures.length) {
    console.log('\nFAIL');
    result.failures.forEach(f => console.log(' - ' + f));
    process.exit(1);
  }
  console.log('\nPASS');
})().catch(e => { console.error(e); process.exit(2); });
