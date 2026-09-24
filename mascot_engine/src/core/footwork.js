// Foot planting for turns (replaces the prototype's scripted turn footwork).
//
// Each foot is either planted (fixed on the floor, never slides) or stepping.
// The orientation layer says where each foot *should* be for the current yaw;
// when a planted foot drifts too far from that, it steps there on a lifted arc,
// one foot at a time. When the body stops turning, a small settle step removes
// any leftover offset. Knees are then solved by leg IK (resolveLimbs).

const FOOTWORK = { active: false, L: null, R: null, stepping: null, lastSide: 'R', still: 0, lastYaw: 0 };
const STEP_TRIGGER = 16, STEP_SETTLE = 3, STEP_MS = 240, STEP_SETTLE_MS = 180;

function resetFootwork() { FOOTWORK.active = false; FOOTWORK.stepping = null; }

function applyFootPlanting(p, now, prevShown, yaw) {
  const desired = side => ({ foot: p[`foot_${side}_center`].slice(), ankleOff: sub(p[`ankle_${side}`], p[`foot_${side}_center`]) });
  if (!FOOTWORK.active) {
    const src = prevShown || p;
    FOOTWORK.L = src.foot_L_center.slice();
    FOOTWORK.R = src.foot_R_center.slice();
    FOOTWORK.stepping = null;
    FOOTWORK.active = true;
    FOOTWORK.lastYaw = yaw;
    FOOTWORK.still = now;
  }
  if (Math.abs(yaw - FOOTWORK.lastYaw) > 1e-4) FOOTWORK.still = now;
  FOOTWORK.lastYaw = yaw;
  const settled = now - FOOTWORK.still > 120;

  const want = { L: desired('L'), R: desired('R') };
  const err = s => Math.hypot(want[s].foot[0] - FOOTWORK[s][0], want[s].foot[1] - FOOTWORK[s][1]);

  if (!FOOTWORK.stepping) {
    const eL = err('L'), eR = err('R');
    const limit = settled ? STEP_SETTLE : STEP_TRIGGER;
    let side = null;
    if (eL > limit || eR > limit) {
      side = eL === eR ? (FOOTWORK.lastSide === 'L' ? 'R' : 'L') : (eL > eR ? 'L' : 'R');
      // Alternate feet while turning, as a person does.
      if (!settled && side === FOOTWORK.lastSide && Math.max(eL, eR) - Math.min(eL, eR) < 10) side = side === 'L' ? 'R' : 'L';
    }
    if (side) {
      const dist = err(side);
      FOOTWORK.stepping = { side, from: FOOTWORK[side].slice(), start: now, dur: settled ? STEP_SETTLE_MS : STEP_MS, lift: Math.min(26, 6 + dist * 0.35) };
    }
  }

  p.walkFootAngle = p.walkFootAngle || {};
  for (const s of ['L', 'R']) {
    let pos = FOOTWORK[s], lift = 0, pitch = 0;
    const st = FOOTWORK.stepping;
    if (st && st.side === s) {
      const tau = clamp((now - st.start) / st.dur);
      const h = smooth3(tau);
      pos = [lp(st.from[0], want[s].foot[0], h), lp(st.from[1], want[s].foot[1], h)];
      lift = Math.sin(Math.PI * tau) * st.lift;
      pitch = Math.sin(Math.PI * tau) * (tau < 0.4 ? -8 : 7) * Math.sign(want[s].foot[0] - st.from[0] || 1);
      if (tau >= 1) { FOOTWORK[s] = want[s].foot.slice(); FOOTWORK.stepping = null; FOOTWORK.lastSide = s; pos = FOOTWORK[s]; lift = 0; pitch = 0; }
    }
    const foot = [pos[0], pos[1] - lift];
    p[`foot_${s}_center`] = foot;
    p[`ankle_${s}`] = [foot[0] + want[s].ankleOff[0], foot[1] + want[s].ankleOff[1]];
    p.walkFootAngle[s] = pitch;
  }
  return p;
}
