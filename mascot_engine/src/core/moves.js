// Scripted moves (web engine): full-body actions an app can play on top of the
// states, e.g. to climb onto an element of its interface.
//
//   uko.climb({ onDone, behind })  — the mascot hangs from the ledge its feet stand on
//   (the feet line of its box, y = 1408), pulls itself up, swings a leg over and
//   stands up. Place the mascot box so that its feet line sits on the edge to climb.
//   behind: true = it climbs up the far side of the element: shoulder-width grip, and
//   the host hides what is below the edge (the element is in front of the body).
//
// Phases (u = 0..1 over MOVES.climb.dur):
//   .00–.16 hang     hands on the ledge, arms straight, body dangling and swaying
//   .16–.56 pull     elbows bend outwards, the chin comes over the edge, legs kick
//   .56–.80 mantle   arms push down, the right leg swings over (knee on the ledge)
//   .80–1.0 stand    the left leg follows, hands let go, standing pose
const MOVES = { climb: { dur: 3200 } };
const LEDGE = 1408;
let MOVE_FRONT_ARMS = false;   // read by renderRig

function climbPose(u, behind = false) {
  const base = DATA.poses.idle, p = cpy(base), S = SKELETON;
  const ease = smooth5;
  const arm = S.upperArm.L + S.foreArm.L, reach = arm * 0.97 + S.hand.L * 0.9;
  const A = .16, B = .56, C = .80;
  const pull = ease(clamp((u - A) / (B - A))), mantle = ease(clamp((u - B) / (C - B))), stand = ease(clamp((u - C) / (1 - C)));
  // A wide grip (arms beside the head, like a pull-up); hands come in to push down.
  const wide = behind ? 118 : 255;
  const half = lp(wide, behind ? 118 : 128, mantle), cx = (base.shoulder_L[0] + base.shoulder_R[0]) / 2;
  const grip = { L: [cx - half, LEDGE - 10], R: [cx + half, LEDGE - 10] };
  // Body offset (down +): fully hanging → chin over the edge → chest over → standing.
  const dxHang = wide - (base.shoulder_R[0] - base.shoulder_L[0]) / 2;
  const dyHang = LEDGE - 10 + Math.sqrt(reach * reach - dxHang * dxHang) - base.shoulder_L[1];
  const dyChin = LEDGE + 34 - base.shoulder_L[1];
  const dyChest = LEDGE - Math.sqrt(reach * reach - (behind ? 118 : 128) ** 2) * 0.9 - base.shoulder_L[1];
  const dy = u < B ? lp(dyHang, dyChin, pull) : u < C ? lp(dyChin, dyChest, mantle) : lp(dyChest, 0, stand);
  // Hanging bodies swing; the swing dies out as the pull starts.
  const sway = u < B ? Math.sin(u * 22) * 18 * (1 - pull) : 0;
  for (const k of ['head_center', 'neck', 'shoulder_L', 'shoulder_R', 'pelvis', 'hip_L', 'hip_R']) p[k] = [base[k][0] + sway * (k === 'pelvis' || k.startsWith('hip') ? 1 : .35), base[k][1] + dy];

  // Arms: hands on the ledge until they let go while standing up.
  const release = ease(clamp((u - .86) / .12));
  for (const [s, dir] of [['L', -1], ['R', 1]]) {
    const sh = p[`shoulder_${s}`], g = grip[s];
    const hand = [lp(g[0], base[`hand_${s}_center`][0], release), lp(g[1], base[`hand_${s}_center`][1] + dy, release)];
    const wrist = [hand[0], hand[1] + S.hand[s] * (1 - release) - S.hand[s] * .9 * release];
    // Elbow direction: straight up while hanging, out and down at the top of the pull,
    // slightly out while pushing down on the ledge.
    // From behind the elbows stay close to the body (arms mostly hidden below the edge).
    const out = (u < B ? pull : 1 - mantle * .6) * (behind ? .55 : 1);
    const mid = [(sh[0] + wrist[0]) / 2, (sh[1] + wrist[1]) / 2];
    const elbow = [mid[0] + dir * 150 * out, mid[1] + 70 * out];
    p[`elbow_${s}`] = [lp(elbow[0], base[`elbow_${s}`][0], release), lp(elbow[1], base[`elbow_${s}`][1] + dy, release)];
    p[`wrist_${s}`] = wrist;
    p[`hand_${s}_center`] = hand;
  }

  // Legs: dangle and kick while pulling; the right one swings over the edge, the left follows.
  const legLen = S.thigh.L + S.shin.L, t = u * MOVES.climb.dur / 1000;
  for (const [s, dir, phase] of [['L', -1, 0], ['R', 1, Math.PI]]) {
    const hip = p[`hip_${s}`];
    const kick = u < B ? Math.max(0, Math.sin(t * 7 + phase)) * pull : 0;
    const dangle = [hip[0] + dir * 30 + sway * .6, hip[1] + legLen * (0.97 - .38 * kick)];
    const knee = [hip[0] + dir * (40 + 90 * kick), hip[1] + S.thigh[s] * (1 - .5 * kick)];
    const stood = [base[`ankle_${s}`][0], base[`ankle_${s}`][1]];
    let ankle, kn;
    if (s === 'R') {
      // Over the edge during the mantle: knee on the ledge, then the foot plants.
      const onEdge = [hip[0] + 170, LEDGE - 26], knOnEdge = [hip[0] + 190, LEDGE - 18];
      const over = mantle;
      ankle = u < C ? [lp(dangle[0], onEdge[0], over), lp(dangle[1], onEdge[1], over)] : [lp(onEdge[0], stood[0], stand), lp(onEdge[1], stood[1], stand)];
      kn = u < C ? [lp(knee[0], knOnEdge[0], over), lp(knee[1], knOnEdge[1], over)] : [lp(knOnEdge[0], base.knee_R[0], stand), lp(knOnEdge[1], base.knee_R[1], stand)];
    } else {
      // Keeps dangling until the stand-up, then comes up over the edge.
      const up = ease(clamp((u - C) / (.95 - C)));
      const arc = [lp(dangle[0], stood[0], up), lp(dangle[1], stood[1], up) - Math.sin(Math.PI * up) * 160];
      ankle = u < C ? dangle : arc;
      kn = u < C ? knee : [lp(knee[0], base.knee_L[0], up) - Math.sin(Math.PI * up) * 90, lp(knee[1], base.knee_L[1], up) - Math.sin(Math.PI * up) * 160];
    }
    p[`ankle_${s}`] = ankle; p[`knee_${s}`] = kn;
    p[`foot_${s}_center`] = [ankle[0] + (base[`foot_${s}_center`][0] - base[`ankle_${s}`][0]), ankle[1] + (base[`foot_${s}_center`][1] - base[`ankle_${s}`][1])];
  }
  p.head_radius = base.head_radius;
  return p;
}

// Face and head tilt along the climb: worried while hanging, straining while pulling
// and getting over, happy once standing.
function climbFace(u) { return u < .14 ? 'empty' : u < .84 ? 'tapOuch' : 'success'; }
function climbRot(u) { return u < .56 ? Math.sin(u * 22) * 4 * (1 - smooth5(clamp((u - .16) / .4))) : u < .84 ? -6 * Math.sin(Math.PI * clamp((u - .56) / .28)) : 0; }

// Climbing onto a low object (a box, a step, a bench): climb({ onto }), onto = height of
// its top above the feet line, as a fraction of the mascot box (0.1–0.45). The mascot
// stands behind it (the host draws the object in front): hands on the top, press up,
// right knee on it, the left leg follows, stand up. At the end the pose stands `onto`
// higher: the host moves the mascot box up by the same amount (in onDone).
//   .00–.20 reach    small dip, both hands on the top edge
//   .20–.50 press    arms push, the body rises, the right knee comes onto the top
//   .50–.78 crouch   the body comes over, the left leg follows (knee forward)
//   .78–1.0 stand    legs straighten, hands let go
MOVES.climbOnto = { dur: 2600 };
function climbOntoPose(u, h) {
  const base = DATA.poses.idle, p = cpy(base), ease = smooth5;
  const L = LEDGE - h, A = .2, B = .5, C = .78;
  const a = ease(clamp(u / A)), b = ease(clamp((u - A) / (B - A))), c = ease(clamp((u - B) / (C - B))), d = ease(clamp((u - C) / (1 - C)));
  const dip = 36, press = -h * .55, crouched = -h + 70;
  const dy = u < A ? dip * a : u < B ? lp(dip, press, b) : u < C ? lp(press, crouched, c) : lp(crouched, -h, d);
  for (const k of ['head_center', 'neck', 'shoulder_L', 'shoulder_R', 'pelvis', 'hip_L', 'hip_R']) p[k] = [base[k][0], base[k][1] + dy];

  // Hands: onto the top edge (shoulder width), kept there, then back to rest.
  const cx = (base.shoulder_L[0] + base.shoulder_R[0]) / 2;
  for (const [s, dir] of [['L', -1], ['R', 1]]) {
    const grip = [cx + dir * 100, L - 8];
    const rest = k => [base[k][0], base[k][1] + dy];
    const restH = rest(`hand_${s}_center`), restW = rest(`wrist_${s}`);
    const hand = u < A ? [lp(restH[0], grip[0], a), lp(restH[1], grip[1], a)] : u < C ? grip : [lp(grip[0], restH[0], d), lp(grip[1], restH[1], d)];
    const gripW = [grip[0], grip[1] - 30];
    const wrist = u < A ? [lp(restW[0], gripW[0], a), lp(restW[1], gripW[1], a)] : u < C ? gripW : [lp(gripW[0], restW[0], d), lp(gripW[1], restW[1], d)];
    const sh = p[`shoulder_${s}`];
    // Elbows out while the arms are bent (dip, press), close to the body at rest.
    const bentK = u < C ? 1 : 1 - d;
    p[`elbow_${s}`] = [(sh[0] + wrist[0]) / 2 + dir * 70 * bentK, (sh[1] + wrist[1]) / 2];
    p[`wrist_${s}`] = wrist; p[`hand_${s}_center`] = hand;
  }

  // Legs. Standing on the top = the rest pose raised by h.
  const top = s => [base[`ankle_${s}`][0], base[`ankle_${s}`][1] - h];
  const ground = s => base[`ankle_${s}`];
  // Right: knee up onto the top during the press, stays there.
  const r0 = ground('R'), r1 = top('R');
  const ankleR = u < A ? r0 : u < B ? [lp(r0[0], r1[0], b), lp(r0[1], r1[1], b) - Math.sin(Math.PI * b) * 60] : r1;
  // Left: planted, then brought up over the edge (knee forward, i.e. up in this view).
  const l0 = ground('L'), l1 = top('L');
  const ankleL = u < B ? l0 : u < C ? [lp(l0[0], l1[0], c), lp(l0[1], l1[1], c) - Math.sin(Math.PI * c) * 90] : l1;
  for (const [s, dir, ank] of [['R', 1, ankleR], ['L', -1, ankleL]]) {
    const hip = p[`hip_${s}`];
    p[`ankle_${s}`] = ank;
    // Knee hint: outwards and forward (up) while the leg is bent.
    p[`knee_${s}`] = [(hip[0] + ank[0]) / 2 + dir * 70, (hip[1] + ank[1]) / 2 - 20];
    p[`foot_${s}_center`] = [ank[0] + (base[`foot_${s}_center`][0] - base[`ankle_${s}`][0]), ank[1] + (base[`foot_${s}_center`][1] - base[`ankle_${s}`][1])];
  }
  p.head_radius = base.head_radius;
  return p;
}
function climbOntoFace(u) { return u < .18 ? 'idle' : u < .8 ? 'tapOuch' : 'success'; }
function climbOntoRot(u) { return u < .2 ? 3 * smooth5(u / .2) : u < .78 ? 3 - 8 * Math.sin(Math.PI * clamp((u - .2) / .58)) : 0; }
