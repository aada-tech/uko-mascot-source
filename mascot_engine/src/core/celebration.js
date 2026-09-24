// Success: a real celebration jump, generated from the Idle pose.
//
// Beats (t = 0..1 over DUR.success = 3.6 s):
//   .06–.18  anticipation   crouch, knees out, arms swing down and out (from .05)
//   .18–.23  take-off       legs extend, arms swing up (.15–.29, leading the jump)
//   .23–.42  flight         ballistic arc (parabola), knees tucked, arms in a V
//   .42–.52  landing        knees absorb the impact, arms stay up
//   .50–.64  victory        two small fist pumps
//   .60–.88  settle         arms come down, tiny rebound, back to Idle
// Feet are planted whenever the mascot is on the ground; knees come from IK.

// Heights are in viewBox units; the whole jump stays inside the 1024×1536 frame.
const CELEBRATION = { HEIGHT: 115, CROUCH: 72, LAND: 58, T_OFF: 0.23, T_LAND: 0.42 };

function celebrationLift(t) {
  const { T_OFF, T_LAND, HEIGHT } = CELEBRATION;
  if (t <= T_OFF || t >= T_LAND) return 0;
  const u = (t - T_OFF) / (T_LAND - T_OFF);
  return 4 * HEIGHT * u * (1 - u);                     // constant gravity
}

function celebrationDrop(t) {
  // Pelvis lowering while on the ground (positive = down).
  const { CROUCH, LAND, T_OFF, T_LAND } = CELEBRATION;
  if (t < .06) return 0;
  if (t < .18) return CROUCH * smooth5((t - .06) / .12);
  if (t < T_OFF) return CROUCH * (1 - smooth3((t - .18) / (T_OFF - .18)));
  if (t < T_LAND) return 0;
  if (t < .5) return LAND * Math.sin(Math.PI / 2 * (t - T_LAND) / (.5 - T_LAND));      // absorb
  if (t < .62) return LAND * (1 - smooth5((t - .5) / .12)) - 10 * Math.sin(Math.PI * clamp((t - .56) / .12));
  if (t < .76) return 8 * Math.sin(Math.PI * (t - .62) / .14) * (1 - smooth5((t - .62) / .14));   // tiny rebound
  return 0;
}

function celebrationArms(t) {
  // -1 = swung down/out (anticipation), 0 = rest, 1 = raised V.
  if (t < .04) return 0;
  if (t < .13) return -smooth5((t - .04) / .09);
  if (t < .31) return lp(-1, 1, smooth3((t - .13) / .18));
  if (t < .62) return 1;
  if (t < .88) return 1 - smooth5((t - .62) / .26);
  return 0;
}

function celebrationPose(t) {
  const base = DATA.poses.idle, p = cpy(base);
  const lift = celebrationLift(t), drop = celebrationDrop(t);
  const air = clamp(lift / 40);
  const crouch = clamp(drop / CELEBRATION.CROUCH);
  const dy = drop - lift;                              // body vertical offset (down +)

  // Upper body rides on the pelvis; slight forward curl in the crouch.
  for (const k of ['head_center', 'neck', 'shoulder_L', 'shoulder_R', 'pelvis', 'hip_L', 'hip_R']) p[k] = [base[k][0], base[k][1] + dy];
  p.head_center[1] += 10 * crouch;

  // Legs: feet planted on the ground, tucked up in the air. Knees splay outwards
  // so the bend reads clearly from the front.
  const tuck = 150 * Math.sin(Math.PI * clamp((t - CELEBRATION.T_OFF) / (CELEBRATION.T_LAND - CELEBRATION.T_OFF))) * (lift > 0 ? 1 : 0);
  for (const [side, dir] of [['L', -1], ['R', 1]]) {
    const ay = base[`ankle_${side}`][1] - lift - tuck * .55;
    const ax = base[`ankle_${side}`][0] + dir * 12 * air;
    p[`ankle_${side}`] = [ax, ay];
    p[`foot_${side}_center`] = [base[`foot_${side}_center`][0] + dir * 12 * air, base[`foot_${side}_center`][1] - lift - tuck * .55];
    const bend = Math.max(crouch, air * .8, clamp(drop / CELEBRATION.LAND) * .8);
    p[`knee_${side}`] = [base[`knee_${side}`][0] + dir * 85 * bend, base[`knee_${side}`][1] + dy * .5 - 45 * bend];
  }

  // Arms: rest → swung down/out → raised V, with two fist pumps at the top.
  const a = celebrationArms(t);
  const pump = t > .5 && t < .64 ? Math.sin(Math.PI * 2 * (t - .5) / .07) * Math.sin(Math.PI * (t - .5) / .14) : 0;
  for (const [side, dir] of [['L', -1], ['R', 1]]) {
    const sh = p[`shoulder_${side}`];
    const restE = [base[`elbow_${side}`][0], base[`elbow_${side}`][1] + dy];
    const restW = [base[`wrist_${side}`][0], base[`wrist_${side}`][1] + dy];
    const restH = [base[`hand_${side}_center`][0], base[`hand_${side}_center`][1] + dy];
    let e, w, h;
    if (a >= 0) {
      // V angle adapts to the hairstyle: as steep as possible while the hand
      // still clears the hair silhouette (a wider Y for big volumes).
      // Other characters: the V clears their head silhouette (robot box, cat ears)
      // so the elbow and the forearm read as clearly as on Uko.
      const hc = p.head_center, reach = hairReach() + 40, L = 395;
      let th = 62 * Math.PI / 180;
      if (characterDef()) th = characterArmAngle(sh, hc, dir, L, p.head_radius || 185);
      else {
        for (; th > 22 * Math.PI / 180; th -= Math.PI / 90) {
          const hx = sh[0] + dir * L * Math.cos(th), hy = sh[1] - L * Math.sin(th);
          if (Math.hypot(hx - hc[0], hy - hc[1]) >= reach) break;
        }
        // The elbow stays outside the head too (bald and short hair): otherwise the
        // arm hides behind the head and only the hands show. Decided on the upright
        // pose, so hairstyles whose V already shows the elbow keep their V untouched.
        const R = (p.head_radius || 185) + 12, hu = [base.head_center[0], base.head_center[1] + dy];
        const elbowIn = a => Math.hypot(sh[0] + dir * 170 * Math.cos(a - .45) - hu[0], sh[1] - 170 * Math.sin(a - .45) - hu[1]) < R;
        let tu = 62 * Math.PI / 180;
        for (; tu > 22 * Math.PI / 180; tu -= Math.PI / 90) if (Math.hypot(sh[0] + dir * L * Math.cos(tu) - hu[0], sh[1] - L * Math.sin(tu) - hu[1]) >= reach) break;
        if (elbowIn(tu)) while (th > 22 * Math.PI / 180 && elbowIn(th)) th -= Math.PI / 90;
      }
      const upW = [sh[0] + dir * L * Math.cos(th), sh[1] - L * Math.sin(th) + 40 * pump];
      const upE = [sh[0] + dir * 170 * Math.cos(th - .45), sh[1] - 170 * Math.sin(th - .45) + 18 * pump];
      const upH = [upW[0] + dir * 10, upW[1] - 32];
      const k = a;
      // Arc through the side so the hand never cuts through the body.
      const swing = Math.sin(Math.PI * k) * 40 * dir;
      e = [lp(restE[0], upE[0], k) + swing * .6, lp(restE[1], upE[1], k)];
      w = [lp(restW[0], upW[0], k) + swing, lp(restW[1], upW[1], k)];
      h = [lp(restH[0], upH[0], k) + swing, lp(restH[1], upH[1], k)];
    } else {
      const k = -a;
      e = [restE[0] + dir * 30 * k, restE[1] - 6 * k];
      w = [restW[0] + dir * 70 * k, restW[1] - 18 * k];
      h = [restH[0] + dir * 76 * k, restH[1] - 18 * k];
    }
    p[`elbow_${side}`] = e; p[`wrist_${side}`] = w; p[`hand_${side}_center`] = h;
  }
  p.celebrationLift = lift;
  return p;
}
