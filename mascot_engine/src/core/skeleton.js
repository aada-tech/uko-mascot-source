// Canonical skeleton: fixed bone lengths measured on the Idle pose.
// Every frame, whatever the animation layers produced, is re-solved onto this
// skeleton. Hands and feet keep their animated targets (contacts stay exact),
// elbows and knees come from a soft two-bone IK, so no limb can stretch.
// The same bone set (root, spine, head, upper/fore arms, thighs, shins) is the
// one exported to Rive.

const SKELETON = (function buildSkeleton(idle) {
  const d = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const up = norm(sub(idle.neck, idle.pelvis));
  const right = [-up[1], up[0]];
  const local = (origin, p) => {
    const v = sub(p, origin);
    return [dot(v, right), dot(v, up)];
  };
  return {
    spine: d(idle.pelvis, idle.neck),
    neckToHead: d(idle.neck, idle.head_center),
    headRadius: idle.head_radius,
    shoulder: { L: local(idle.neck, idle.shoulder_L), R: local(idle.neck, idle.shoulder_R) },
    hip: { L: local(idle.pelvis, idle.hip_L), R: local(idle.pelvis, idle.hip_R) },
    upperArm: { L: d(idle.shoulder_L, idle.elbow_L), R: d(idle.shoulder_R, idle.elbow_R) },
    foreArm: { L: d(idle.elbow_L, idle.wrist_L), R: d(idle.elbow_R, idle.wrist_R) },
    hand: { L: d(idle.wrist_L, idle.hand_L_center), R: d(idle.wrist_R, idle.hand_R_center) },
    thigh: { L: d(idle.hip_L, idle.knee_L), R: d(idle.hip_R, idle.knee_R) },
    shin: { L: d(idle.knee_L, idle.ankle_L), R: d(idle.knee_R, idle.ankle_R) },
    foot: { L: d(idle.ankle_L, idle.foot_L_center), R: d(idle.ankle_R, idle.foot_R_center) }
  };
})(DATA.poses.idle);

function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1]; }
function cross(a, b) { return a[0] * b[1] - a[1] * b[0]; }
function norm(v, fallback = [0, -1]) {
  const l = Math.hypot(v[0], v[1]);
  return l > 1e-6 ? [v[0] / l, v[1] / l] : fallback.slice();
}
function along(origin, dir, len) { return [origin[0] + dir[0] * len, origin[1] + dir[1] * len]; }

// Soft two-bone IK solved in 3D, then projected orthographically.
// The joint (elbow/knee) lies on the circle allowed by the fixed bone lengths.
// Its screen-lateral offset follows the animation's hint (the authored drawing),
// clamped to what the lengths allow; the rest of the bend goes into depth
// (toward the camera). A limb can therefore look foreshortened, never stretched.
// Near full extension the reach is compressed exponentially (soft IK), which
// removes the classic snap when a limb straightens.
function solveTwoBone(root, target, l1, l2, hint, fallbackSide = 1) {
  const total = l1 + l2, soft = total * 0.05, hard = total - soft;
  const minReach = Math.abs(l1 - l2) + 1;
  const toTarget = sub(target, root);
  let dist = Math.hypot(toTarget[0], toTarget[1]);
  const dir = norm(toTarget, [0, 1]);
  if (dist > hard) dist = hard + soft * (1 - Math.exp(-(dist - hard) / soft));
  dist = Math.max(minReach, dist);

  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const perp = [-dir[1], dir[0]];
  let lateral = hint ? dot(sub(hint, root), perp) : h * fallbackSide;
  lateral = Math.max(-h, Math.min(h, lateral));
  const joint = [root[0] + dir[0] * a + perp[0] * lateral, root[1] + dir[1] * a + perp[1] * lateral];
  const end = along(root, dir, dist);
  return { joint, end, depth: Math.sqrt(Math.max(0, h * h - lateral * lateral)) };
}

// Re-solve a pose produced by the animation layers onto the canonical skeleton.
// The neck is the anchor: the head, the face and the hands keep the placement
// the animation gave them (so contacts with the head, the chin or a prop stay
// exact). The pelvis hangs from the spine at its fixed length and the legs reach
// their foot targets with the soft 3D IK: when the authored drawing had a shorter
// torso, the knees simply bend toward the camera instead of anything stretching.
function solveSkeleton(p) {
  const S = SKELETON;
  const q = Object.assign({}, p);
  const up = norm(sub(p.neck, p.pelvis));
  const right = [-up[1], up[0]];
  const fromFrame = (origin, off) => [origin[0] + right[0] * off[0] + up[0] * off[1], origin[1] + right[1] * off[0] + up[1] * off[1]];
  const neck = p.neck.slice();
  const pelvis = along(neck, up, -S.spine);

  q.pelvis = pelvis;
  q.neck = neck;
  q.head_center = along(neck, norm(sub(p.head_center, p.neck), up), S.neckToHead);
  q.head_radius = S.headRadius;

  for (const side of ['L', 'R']) {
    const shoulder = fromFrame(neck, S.shoulder[side]);
    // The drawing wins: upper arm along the drawn direction (length capped),
    // forearm straight to the drawn hand (length capped). Same silhouettes and
    // hand paths as the authored animation, without any stretching.
    const arm = drawnChain(shoulder, sub(p[`elbow_${side}`], p[`shoulder_${side}`] || shoulder), p[`wrist_${side}`], S.upperArm[side], S.foreArm[side]);
    q[`shoulder_${side}`] = shoulder;
    q[`elbow_${side}`] = arm.joint;
    q[`wrist_${side}`] = arm.end;
    const handDir = norm(sub(p[`hand_${side}_center`] || p[`wrist_${side}`], p[`wrist_${side}`]), norm(sub(arm.end, arm.joint)));
    q[`hand_${side}_center`] = along(arm.end, handDir, S.hand[side]);

    const hip = fromFrame(pelvis, S.hip[side]);
    const leg = solveTwoBone(hip, p[`ankle_${side}`], S.thigh[side], S.shin[side], p[`knee_${side}`]);
    q[`hip_${side}`] = hip;
    q[`knee_${side}`] = leg.joint;
    q[`ankle_${side}`] = leg.end;
    const footDir = norm(sub(p[`foot_${side}_center`] || p[`ankle_${side}`], p[`ankle_${side}`]), [0, 1]);
    q[`foot_${side}_center`] = along(leg.end, footDir, S.foot[side]);
  }
  return q;
}

// Re-constrain arms and legs (shoulders/hips stay where late layers put them).
// Used after orientation, turn footwork and walk. Arms keep their direction and
// are only shortened back to their length (never re-bent); legs use IK so feet
// keep their targets.
function resolveLimbs(p) {
  const S = SKELETON;
  for (const side of ['L', 'R']) {
    const arm = restoreChain(p[`shoulder_${side}`], p[`elbow_${side}`], p[`wrist_${side}`], S.upperArm[side], S.foreArm[side]);
    const handOff = sub(p[`hand_${side}_center`], p[`wrist_${side}`]);
    p[`elbow_${side}`] = arm.joint; p[`wrist_${side}`] = arm.end;
    p[`hand_${side}_center`] = [arm.end[0] + handOff[0], arm.end[1] + handOff[1]];
    const leg = solveTwoBone(p[`hip_${side}`], p[`ankle_${side}`], S.thigh[side], S.shin[side], p[`knee_${side}`]);
    const footOff = sub(p[`foot_${side}_center`], p[`ankle_${side}`]);
    p[`knee_${side}`] = leg.joint; p[`ankle_${side}`] = leg.end;
    p[`foot_${side}_center`] = [leg.end[0] + footOff[0], leg.end[1] + footOff[1]];
  }
  return p;
}

// Drawing-preserving two-bone chain: first bone along the drawn direction (length
// capped), second bone straight to the drawn end point (length capped).
function drawnChain(root, firstDir, end, maxA, maxB) {
  const la = Math.hypot(firstDir[0], firstDir[1]);
  const joint = along(root, norm(firstDir, [0, 1]), Math.min(la, maxA));
  const db = sub(end, joint), lb = Math.hypot(db[0], db[1]);
  return { joint, end: along(joint, norm(db, [0, 1]), Math.min(lb, maxB)) };
}

// Direction-preserving length restore for a two-bone chain: each bone keeps its
// current direction, its on-screen length is capped at maxA/maxB.
function restoreChain(root, joint, end, maxA, maxB) {
  const da = sub(joint, root), la = Math.hypot(da[0], da[1]);
  const j = along(root, norm(da, [0, 1]), Math.min(la, maxA));
  const db = sub(end, joint), lb = Math.hypot(db[0], db[1]);
  return { joint: j, end: along(j, norm(db, [0, 1]), Math.min(lb, maxB)) };
}

// Keep the head attached at the fixed neck distance after late layers
// (attention tracking, walk counter-motion) nudged it.
function reattachHead(p) {
  const dir = norm(sub(p.head_center, p.neck));
  p.head_center = along(p.neck, dir, SKELETON.neckToHead);
  p.head_radius = SKELETON.headRadius;
  return p;
}

// Transition blend between two displayed poses (after orientation / walk).
// Joints blend in position, like the authored animation, then the constraints
// are re-applied: fixed spine and neck, arms capped along their directions,
// legs by IK toward the blended foot targets (planted feet stay planted).
// `w` is a number, or a function of the joint name (per-joint weights, used for
// overlapping action in transitions).
function mixPoses(a, b, w) {
  const S = SKELETON;
  const W = typeof w === 'function' ? w : () => w;
  const L = (x, y, k) => { const ww = W(k); return [x[0] + (y[0] - x[0]) * ww, x[1] + (y[1] - x[1]) * ww]; };
  const r = Object.assign({}, b);
  for (const k of POINTS) if (a[k] && b[k]) r[k] = L(a[k], b[k], k);
  const up = norm(sub(r.neck, r.pelvis));
  r.pelvis = along(r.neck, up, -S.spine);
  const offsetFrom = (origin, key, base) => { const o = L(sub(a[key], a[base]), sub(b[key], b[base]), key); return [origin[0] + o[0], origin[1] + o[1]]; };
  for (const side of ['L', 'R']) {
    const sh = `shoulder_${side}`, hp = `hip_${side}`;
    r[sh] = offsetFrom(r.neck, sh, 'neck');
    r[hp] = offsetFrom(r.pelvis, hp, 'pelvis');
  }
  resolveLimbs(r);
  return reattachHead(r);
}
