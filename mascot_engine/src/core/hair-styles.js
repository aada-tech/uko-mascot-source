// Volume hairstyles built as 3D shells around the skull (head radius = 185 units,
// y up is negative, lon 0 = facing the camera, phi 0 = top of the head).
//
// A shell is a surface R(lon, phi) above the scalp. Above the equator it follows
// the skull (with its own width/height); below it, hair either keeps the sphere
// (afro) or falls vertically (long hair). Cells are split into back / front by
// depth like every other style, so the shell turns correctly at 3/4 and profile.
// Where the shell stops on the head (the face window), a ribbon closes the gap
// down to the scalp hairline: hair always grows *from* the scalp.

const EXTRA_HAIR = (function () {
  const HALF = Math.PI / 2;
  const angDist = lon => Math.acos(Math.cos(lon));   // 0 at the front, π at the back

  function shell(m, h, o) {
    const cols = o.cols || 56, rows = o.rows || 12;
    const P = (lon, phi) => {
      const R = o.R, lift = o.lift || 0;
      let x, y, z;
      if (phi <= HALF || o.sphere) {
        x = R * Math.sin(phi) * Math.sin(lon) * o.kx;
        y = -R * Math.cos(phi) * (phi <= HALF ? o.top : (o.bottom || 1)) - lift;
        z = R * Math.sin(phi) * Math.cos(lon) * (o.kz || 1);
      } else {
        // Falling part: a curtain that hangs from the widest line of the head.
        const d = (phi - HALF) / HALF;
        const shrink = 1 - (o.taper || 0) * d * d;
        x = R * Math.sin(lon) * o.kx * shrink;
        z = R * Math.cos(lon) * (o.kz || 1) * shrink * (o.flatBack && Math.cos(lon) < 0 ? 0.82 : 1);
        y = -lift + d * o.fall * R;
      }
      if (o.wave) x += o.wave(y, lon) * Math.sign(Math.sin(lon) || 1);
      if (z > 0 && o.kzFront) z *= o.kzFront;         // volume sits behind the face plane
      return [x, y, z + (o.zOff || 0)];
    };
    m.shell = { P, hem: o.hem };
    for (let i = 0; i < cols; i++) {
      const a = -Math.PI + i * 2 * Math.PI / cols, b = a + 2 * Math.PI / cols;
      const ha = o.hem(a), hb = o.hem(b);
      for (let j = 0; j < rows; j++) {
        m.cap.push([P(a, ha * j / rows), P(b, hb * j / rows), P(b, hb * (j + 1) / rows), P(a, ha * (j + 1) / rows)]);
      }
      // Face window: the shell edge rests on the head, close it down to the scalp.
      if (o.root && ha <= HALF + 0.25) {
        const ra = h.scalp(a, o.root(a), 1), rb = h.scalp(b, o.root(b), 1);
        const ea = P(a, ha), eb = P(b, hb);
        for (let k = 0; k < 3; k++) {
          const t0 = k / 3, t1 = (k + 1) / 3;
          m.cap.push([hMix(ea, ra, t0), hMix(eb, rb, t0), hMix(eb, rb, t1), hMix(ea, ra, t1)]);
        }
      }
    }
    return P;
  }

  // Strands drawn as light detail lines on a shell, following lon lines.
  function strands(m, P, list, from, to, width = 3, opacity = .22, n = 24) {
    for (const lon of list) {
      const pts = Array.from({ length: n }, (_, i) => P(lon, from(lon) + (to(lon) - from(lon)) * i / (n - 1)));
      m.ink.push({ points: pts, width, opacity });
    }
  }

  function curlsOn(m, P, hem, count, rMin, rMax, outward = 4) {
    for (let i = 0; i < count; i++) {
      const lon = i * 2.399963229728653;                       // golden angle
      const t = Math.sqrt((i + .5) / count);                   // denser towards the hem
      const p = P(lon, hem(lon) * t);
      const len = Math.hypot(...p) || 1;
      m.curls.push({ p: p.map(v => v * (1 + outward / len)), r: rMin + (rMax - rMin) * (0.5 + 0.5 * Math.sin(i * 2.71)), phase: i });
    }
  }

  // Ease a hem from the face window (front) to the back value.
  const hemFrom = (front, back, start = .4, span = .9) => lon => front + (back - front) * smooth5(clamp((angDist(lon) - start) / span));
  // Long hair: long at the sides, shorter at the back so it frames the face
  // instead of hanging as a block behind the neck of a stick-figure body.
  const longHem = (front, sides, back) => lon => {
    const d = angDist(lon);
    const toSides = front + (sides - front) * smooth5(clamp((d - .82) / .38));
    return toSides + (back - sides) * smooth5(clamp((d - 1.95) / .6));
  };

  return {
    afro(m, h) {
      // Big round volume: covers the whole skull, frames the face down to the jaw.
      const hem = hemFrom(0.92, 2.25, 0.35, 1.25);
      const P = shell(m, h, { R: 292, kx: 1.07, top: 1.0, bottom: 0.92, lift: 24, sphere: true, kzFront: 0.58, zOff: -22, hem, root: lon => 0.98 + 0.9 * smooth5(clamp((angDist(lon) - .35) / 1.2)) });
      curlsOn(m, P, hem, 300, 13, 19, 6);
      m.soft = { stiffness: 90, limit: 8 };
    },
    boucles(m, h) {
      // Curly, shoulder length: rounded curly mass, curls on the silhouette.
      const hem = hemFrom(0.95, 2.95, 0.62, 0.7);
      const P = shell(m, h, { R: 238, kx: 1.02, top: 1.0, lift: 8, fall: 0.95, taper: 0.55, kzFront: 0.6, zOff: -18, hem, root: lon => 1.0 + 0.8 * smooth5(clamp((angDist(lon) - .62) / .7)) });
      curlsOn(m, P, hem, 260, 12, 17, 5);
      m.sway = { k: 70 };
    },
    lisse(m, h) {
      // Long straight hair, centre parting, blunt ends at the chest.
      const hem = longHem(0.9, 3.3, 2.25);
      const P = shell(m, h, { R: 204, kx: 1.0, top: 1.02, lift: 6, fall: 1.6, taper: 0.1, kzFront: 0.9, flatBack: true, hem, root: lon => 0.98 + 0.7 * smooth5(clamp((angDist(lon) - .8) / .4)) });
      const top = () => 0.04;
      strands(m, P, [0], () => 0.02, () => 0.9, 3.4, .38, 16);                 // parting
      strands(m, P, [-2.6, -2.1, -1.6, -1.25, -1.0, 1.0, 1.25, 1.6, 2.1, 2.6], top, lon => hem(lon) * .97);
      m.sway = { k: 55 };
    },
    ondule(m, h) {
      // Long wavy hair: same fall as straight hair with soft S-waves.
      const hem = longHem(0.9, 3.25, 2.25);
      const wave = y => y > -40 ? 26 * Math.sin((y + 40) / 52) * smooth5(clamp((y + 40) / 80)) : 0;
      const P = shell(m, h, { R: 210, kx: 1.04, top: 1.02, lift: 6, fall: 1.55, taper: 0.08, kzFront: 0.9, flatBack: true, wave, hem, root: lon => 0.98 + 0.7 * smooth5(clamp((angDist(lon) - .8) / .4)) });
      strands(m, P, [0], () => 0.02, () => 0.9, 3.4, .38, 16);
      strands(m, P, [-2.5, -1.9, -1.4, -1.05, 1.05, 1.4, 1.9, 2.5], () => 0.05, lon => hem(lon) * .97, 3, .24, 40);
      m.sway = { k: 55 };
    },
    pixie(m, h) {
      // Short crop, side-swept fringe with soft points, tapered nape.
      const hem = lon => {
        const d = angDist(lon);
        const fringe = lon < 0.7 && lon > -1.25 ? 0.34 * smooth5(clamp((0.7 - lon) / 1.25)) * (1 - smooth5(clamp((-0.75 - lon) / 0.5))) : 0;
        const tips = (0.03 + fringe * 0.25) * Math.abs(Math.sin(lon * 13));
        return 0.98 + fringe + tips + 0.66 * smooth5(clamp((d - .45) / 1.0));
      };
      const P = shell(m, h, { R: 199, kx: 1.02, top: 1.07, lift: 4, sphere: true, hem, cols: 72, root: lon => hem(lon) + 0.02 });
      strands(m, P, [-0.2, 0.15, 0.5, 0.9, 1.4, -0.7], () => 0.1, lon => hem(lon) * .95, 3, .25, 18);
      m.soft = { stiffness: 190, limit: 2.5 };
    },
    queue_de_cheval(m, h) {
      // Hair pulled back to a tie at the back of the crown; the tail swings.
      const hem = lon => 0.98 + 0.78 * smooth5(clamp((angDist(lon) - .4) / 1.1));
      const P = shell(m, h, { R: 193, kx: 1.0, top: 1.03, lift: 2, sphere: true, hem, root: lon => hem(lon) + 0.02 });
      const tieLon = 2.55, tie = P(tieLon, 0.72);
      for (const lon of [-0.5, -0.2, 0.15, 0.45, 0.8, 1.2, 1.7, -1.1, -1.7]) {
        const start = P(lon, hem(lon) * .9);
        m.ink.push({ points: Array.from({ length: 20 }, (_, i) => hMix(start, tie, i / 19)), width: 2.6, opacity: .16 });
      }
      m.tie = { p: tie, r: 22 };
      const out = [tie[0] * 1.15, tie[1], tie[2] * 1.2];
      const tail = h.curve(tie, [out[0] + 60, tie[1] + 10, out[2] - 30], [out[0] + 95, tie[1] + 170, out[2] - 40], [out[0] + 70, tie[1] + 360, out[2] - 30], 22);
      h.lock(tail, 86, 18, 2, 'tail');
    },
    tresses_plaquees(m, h) {
      // Cornrows (reference sheet): chunky beaded rows that fan out from the
      // hairline like a sunburst and gather towards the nape. Each row is a
      // meridian around an axis running from the forehead (A) to the nape, so
      // rows never cross and stay evenly spread. The two outer rows stop behind
      // the ears and end in short loose tails.
      const Rr = 193, rows = 11, N = 27;
      const A = [0, -.24, .97], nA = Math.hypot(...A); A.forEach((v, i) => A[i] = v / nA);
      const up = [0, -1, 0], d = up[1] * A[1];
      const e1 = up.map((v, i) => v - d * A[i]), n1 = Math.hypot(...e1); e1.forEach((v, i) => e1[i] = v / n1);
      const e2 = [1, 0, 0];
      const at = (al, dd) => A.map((v, i) => Rr * (Math.cos(dd) * v + Math.sin(dd) * (Math.cos(al) * e1[i] + Math.sin(al) * e2[i])));
      const lines = [];
      for (let i = 0; i < rows; i++) {
        const u = -1 + 2 * i / (rows - 1), al = u * 1.745;          // ±100°
        // Hairline: well above the brows in the middle (clear of every
        // expression), down to the temples on the sides.
        const d0 = .54 + .58 * Math.pow(smooth3(Math.min(1, Math.abs(u) / .9)), 1.3);
        const d1 = Math.abs(u) > .95 ? 2.15 : Math.PI - .3;
        lines.push(Array.from({ length: N }, (_, j) => at(al, lp(d0, d1, j / (N - 1)))));
      }
      lines.forEach((pts, i) => {
        // Width follows the spacing to the neighbouring rows: a thin line of
        // scalp stays visible between the braids everywhere on the head.
        const widths = pts.map((p, j) => {
          const dd = [lines[i - 1], lines[i + 1]].filter(Boolean).map(l => hLen(p, l[j]));
          return clamp(0.96 * Math.min(...dd), 20, 56);
        });
        h.lock(pts, 36, 10, pts.length, 'cornrow', true);
        m.locks[m.locks.length - 1].widths = widths;
      });
      for (const i of [0, rows - 1]) {
        const E = lines[i][N - 1], sx = Math.sign(E[0]);
        const tail = Array.from({ length: 6 }, (_, k) => [E[0] + sx * 2 * k, E[1] + 22 * k, E[2] - 2 * k]);
        h.lock(tail, 17, 12, 2, 'tail');
      }
    },
    tresses(m, h) {
      // Long box braids: centre parting, braids fall to the chest, framing the face.
      const hem = lon => 0.95 + 0.85 * smooth5(clamp((angDist(lon) - .45) / 1.0));
      shell(m, h, { R: 192, kx: 1.0, top: 1.0, lift: 0, sphere: true, hem, root: lon => hem(lon) + .02 });
      const n = 30;
      for (let i = 0; i < n; i++) {
        const lon = -Math.PI + (i + .5) * 2 * Math.PI / n;
        if (angDist(lon) < 0.95) continue;                                // keep the face clear
        const root = h.scalp(lon, hem(lon) - .04, 4);
        const side = Math.sign(root[0]) || 1, back = Math.cos(lon) < 0;
        const len = (angDist(lon) > 2.2 ? 120 : 300) + 30 * Math.sin(i * 1.9);
        const pts = [h.scalp(lon, 0.12, 4), h.scalp(lon, (hem(lon) - .04) * .5, 4), root];
        for (let j = 1; j <= 14; j++) {
          const t = j / 14;
          pts.push([root[0] + side * (10 + 18 * Math.sin(t * Math.PI * .5)), root[1] + len * t, root[2] - (back ? 20 : 6) * t]);
        }
        h.lock(pts, 23, 12, 3, 'braid');
      }
    },
    barbe(m, h) {
      // Bald head with a full beard (reference sheet): sideburns from the ears,
      // beard along the jaw to a round chin. The face is drawn by a different
      // projection than the skull (the mouth slides onto the cheek in profile),
      // so the beard is rebuilt each frame in screen longitude: it opens under
      // the mouth actually drawn (recorded by beardMoustache) and rises to the
      // sideburns, which stay attached to the skull.
      m.noFaceGuard = true;
      const R = 197, cols = 64, rows = 10, bottom = 3.0, SIDE = 1.52, TOP = -14;
      const P = (lon, phi) => [R * Math.sin(phi) * Math.sin(lon), -R * Math.cos(phi), R * Math.sin(phi) * Math.cos(lon)];
      const phiAt = y => Math.acos(clamp(-y / R, -1, 1));
      let key = '', cells = [];
      m.beard = (yaw, mouth) => {
        const mo = mouth || { x0: -73, x1: 73, y0: 55, y1: 55, hole: 88 };
        const A = -yaw * HALF, dir = yaw < 0 ? 1 : -1, back = 1 - .15 * smooth5(Math.abs(yaw));
        const k = `${yaw.toFixed(3)}|${mo.x0.toFixed(1)}|${mo.x1.toFixed(1)}|${mo.hole.toFixed(1)}`;
        if (k === key) return cells;
        const lonOf = (x, y) => {
          if (x * dir < 0) x /= back;
          return Math.asin(clamp(x / Math.sqrt(Math.max(1, R * R - y * y)), -1, 1));
        };
        const sR = SIDE + A, sL = -SIDE + A;
        const lR = Math.min(lonOf(mo.x1, mo.y1), sR - .3), lL = Math.max(lonOf(mo.x0, mo.y0), sL + .3);
        const hb = mo.hole;
        // Cheek line: low and gentle first (cheeks stay clear), then up along
        // a narrow sideburn in front of the ear; behind it, the beard follows
        // the jaw down to the neck.
        const edge = (d, span) => {
          const rise = Math.max(.12, span - .1);
          return d <= rise
            ? hb + (TOP - hb) * Math.pow(Math.sin(HALF * clamp(d / rise)), 1.5)
            : TOP + (205 - TOP) * smooth3(clamp((d - span - .12) / .42));
        };
        const topY = lam => lam > lR ? edge(lam - lR, sR - lR) : lam < lL ? edge(lL - lam, lL - sL) : hb;
        cells = [];
        for (let i = 0; i < cols; i++) {
          const a = -2.4 + i * 4.8 / cols, b = a + 4.8 / cols;
          const ya = topY(a + A), yb = topY(b + A);
          if (ya > 185 && yb > 185) continue;
          const ta = phiAt(ya), tb = phiAt(yb);
          for (let j = 0; j < rows; j++) {
            const u0 = j / rows, u1 = (j + 1) / rows;
            cells.push([P(a, lp(ta, bottom, u0)), P(b, lp(tb, bottom, u0)), P(b, lp(tb, bottom, u1)), P(a, lp(ta, bottom, u1))]);
          }
        }
        key = k;
        return cells;
      };
      m.cap = m.beard(0, null);
    }
  };
})();
