// Uko × SubFlow — 9:16 ad, rendered frame by frame.
// renderAt(t) is a pure function of time (seconds) except the Uko engine
// instances, which are stepped forward (render frames in increasing order).
// Cue times come from the recorded clips (clips/<name>/events.json).
(function () {
  const W = 1080, H = 1920, CLIP_FPS = 30;
  const CLIPS = ['add', 'error', 'simulate', 'code', 'themes'];
  const PX = 640 / 390;                              // clip CSS px → screen px
  const SCREEN = { x: 206 + 14, y: 470 + 14 + 78 };   // clip origin on the stage (phone at rest)

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const back = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const env = (t, t0, t1, fade = .45) => clamp((t - t0) / fade) * clamp((t1 - t) / fade);

  const $ = id => document.getElementById(id);

  // ------------------------------------------------------------------ language
  // ?lang=fr|en|es — captions, end card and the app clips (clips-<lang>/, recorded in that language).
  const LANG = (new URLSearchParams(location.search).get('lang') || 'fr').slice(0, 2);
  const SITE = new URLSearchParams(location.search).get('site') || 'uko-mascot.pages.dev';
  const TXT = {
    fr: { name: 'Camille', hook: ['Ton app', 'est muette.'], hookNote: '(et un peu froide)', intro: ['Donne-lui', 'un visage.'], hand: 'voici Uko ✎',
      empty: ['Liste vide ?'], emptyNote: 'il hausse les épaules', adds: ['{name} ajoute', 'Netflix…'], added: ['Ajouté !', 'Il saute de joie.'],
      due: ['Prélèvement', 'aujourd’hui ?'], dueNote: 'il réfléchit…', zero: ['Montant', 'à 0 € ?'], scratch: ['Il se gratte', 'la tête.'],
      sim: ['Simulation', 'd’économies…'], party: ['Chaque économie ?', 'Il fait la fête.'], code1: ['Côté code :', 'une balise.'], code2: ['Change un attribut,', 'il suit en direct.'],
      dark: ['Mode sombre ?', 'Il s’adapte.'], brand: ['Ta marque,', 'ses couleurs.'],
      tag: 'Des mascottes vivantes<br>pour ton app.', pills: ['Web', 'React', 'Rive', '3 mascottes', '9 états'], cta: ['Essaie Uko', 'gratuit'] },
    en: { name: 'Emma', hook: ['Your app', 'is silent.'], hookNote: '(and a bit cold)', intro: ['Give it', 'a face.'], hand: 'meet Uko ✎',
      empty: ['Empty list?'], emptyNote: 'he shrugs', adds: ['{name} adds', 'Netflix…'], added: ['Added!', 'He jumps for joy.'],
      due: ['Payment', 'due today?'], dueNote: 'he’s thinking…', zero: ['Amount', 'set to €0?'], scratch: ['He scratches', 'his head.'],
      sim: ['Savings', 'simulation…'], party: ['Every saving?', 'He celebrates.'], code1: ['In your code:', 'one tag.'], code2: ['Change an attribute,', 'he follows live.'],
      dark: ['Dark mode?', 'He adapts.'], brand: ['Your brand,', 'his colours.'],
      tag: 'Living mascots<br>for your app.', pills: ['Web', 'React', 'Rive', '3 mascots', '9 states'], cta: ['Try Uko', 'free'] },
    es: { name: 'Lucía', hook: ['Tu app', 'está muda.'], hookNote: '(y un poco fría)', intro: ['Dale', 'una cara.'], hand: 'este es Uko ✎',
      empty: ['¿Lista vacía?'], emptyNote: 'se encoge de hombros', adds: ['{name} añade', 'Netflix…'], added: ['¡Añadido!', 'Salta de alegría.'],
      due: ['¿Cargo', 'para hoy?'], dueNote: 'está pensando…', zero: ['¿Importe', 'a 0 €?'], scratch: ['Se rasca', 'la cabeza.'],
      sim: ['Simulación', 'de ahorro…'], party: ['¿Cada ahorro?', 'Lo celebra.'], code1: ['En tu código:', 'una etiqueta.'], code2: ['Cambia un atributo,', 'te sigue en directo.'],
      dark: ['¿Modo oscuro?', 'Se adapta.'], brand: ['Tu marca,', 'sus colores.'],
      tag: 'Mascotas vivas<br>para tu app.', pills: ['Web', 'React', 'Rive', '3 mascotas', '9 estados'], cta: ['Prueba Uko', 'gratis'] }
  }[LANG] || null;
  const CLIP_DIR = `/marketing/subflow-ad/clips-${LANG}`;
  let EV = {}, S = {}, CAPS = [], ZOOMS = [], BURSTS = [], ARROWS = [], HOST_CUES = [], DURATION = 0;
  let host, minis = [], lastT = -1, hostCue = 0;

  // ------------------------------------------------------------------ timeline
  function build() {
    const ev = name => Object.fromEntries(EV[name].events.map(e => [e.label, e.t]));
    const e = Object.fromEntries(CLIPS.map(c => [c, ev(c)]));
    let cur = 0;
    const scene = (name, dur, extra = {}) => { S[name] = { name, start: cur, end: cur + dur, ...extra }; cur += dur; };
    scene('hook', 3.4);
    scene('intro', 3.6);
    scene('add', 14.4, { clip: 'add', from: 1.0 });
    scene('error', (e.error.error + 2.5) - (e.error['open-modal'] - .35), { clip: 'error', from: e.error['open-modal'] - .35 });
    scene('sim', (e.simulate['saving-2'] + 2.3) - (e.simulate.simulator - .9), { clip: 'simulate', from: e.simulate.simulator - .9 });
    scene('code', 12.2, { clip: 'code', from: .35 });
    scene('themes', (e.themes.pink + 2.5) - (e.themes.dark - 1.1), { clip: 'themes', from: e.themes.dark - 1.1 });
    scene('end', 5.4);
    DURATION = cur;
    const at = (s, label) => S[s].start + (e[S[s].clip][label] - S[s].from);
    window.adCue = at;

    const cap = (tIn, tOut, lines, o = {}) => CAPS.push({ tIn, tOut, lines, ...o });
    const T = TXT;
    cap(.15, 3.25, T.hook, { top: 250, size: 150, center: true, note: { text: T.hookNote, x: 560, y: 640, rot: -6, at: 1.4 } });
    cap(S.intro.start + .1, S.intro.end - .1, T.intro, { top: 130, size: 120, hand: T.hand, handAt: 1.1 });

    cap(S.add.start + .1, at('add', 'open-modal') - .1, T.empty, { chip: 'state="empty"', note: { text: T.emptyNote, x: 70, y: 330, rot: -3, at: .7 } });
    cap(at('add', 'open-modal') + .05, at('add', 'submit') - .15, T.adds.map(l => l.replace('{name}', T.name)));
    cap(at('add', 'success'), at('add', 'thinking') - .1, T.added, { chip: 'state="success"' });
    cap(at('add', 'thinking'), S.add.end - .05, T.due, { chip: 'state="thinking"', note: { text: T.dueNote, x: 600, y: 180, rot: 4, at: .5 } });

    cap(S.error.start + .05, at('error', 'error') - .1, T.zero);
    cap(at('error', 'error'), S.error.end - .05, T.scratch, { chip: 'state="error"' });

    cap(S.sim.start + .05, at('sim', 'saving-1') - .1, T.sim, { chip: 'state="thinking"' });
    cap(at('sim', 'saving-1'), S.sim.end - .05, T.party, { chip: 'state="success"' });

    cap(S.code.start + .1, at('code', 'state=success') - .1, T.code1, { top: 70, size: 88 });
    cap(at('code', 'state=success'), S.code.end - .05, T.code2, { top: 70, size: 80 });

    cap(S.themes.start + .05, at('themes', 'pink') - .1, T.dark, { chip: 'theme="auto"' });
    cap(at('themes', 'pink'), S.themes.end - .05, T.brand, { chip: 'brand="#FBCFE8"' });

    // Loupes: the phone never zooms (its whole screen, nav bar included, stays visible);
    // a magnifier bubble shows the box (clip CSS px) that always contains the whole mascot.
    ZOOMS.push({ t0: at('add', 'success') - .1, t1: S.add.end + .2, box: [190, 55, 385, 205], zMax: 1.7, uko: [292, 60, 372, 200] });
    ZOOMS.push({ t0: at('error', 'error') + .05, t1: S.error.end + .2, box: [30, 150, 360, 250], zMax: 1.5, uko: [48, 160, 92, 235] });
    ZOOMS.push({ t0: at('sim', 'saving-1') - .35, t1: S.sim.end + .2, box: [6, 664, 250, 758], zMax: 1.6, uko: [22, 680, 66, 745] });
    ZOOMS.push({ t0: S.code.start + .4, t1: S.code.end + .2, box: [190, 55, 385, 205], zMax: 1.8, uko: [298, 60, 372, 200] });
    window.adZooms = ZOOMS;

    BURSTS.push({ t: at('add', 'success') + .55, s: 'add', f: [332, 95], n: 70, seed: 3 });
    BURSTS.push({ t: at('sim', 'saving-1') + .45, s: 'sim', f: [26, 690], n: 45, seed: 7 });
    BURSTS.push({ t: at('sim', 'saving-2') + .45, s: 'sim', f: [26, 690], n: 45, seed: 11 });
    BURSTS.push({ t: S.end.start + 1.1, stage: [540, 1000], n: 110, seed: 19 });

    ARROWS.push({ t0: S.add.start + .8, t1: at('add', 'open-modal') - .1, s: 'add', from: [520, 395], to: [334, 110] });
    ARROWS.push({ t0: at('add', 'thinking') + .6, t1: S.add.end - .05, s: 'add', from: [770, 300], to: [352, 128] });

    HOST_CUES = [[0, 'idle'], [1.05, 'empty'], [S.intro.start + .05, 'welcome'], [S.end.start + .7, 'success']];

    // Sound cues for the soundtrack (audio.cjs): taps, reactions, transitions, text pops.
    const cues = [];
    const tapLabels = /^(open-modal|focus-name|focus-amount|preset-netflix|submit|simulator|exclude-|dark|pink)/;
    for (const n of ['add', 'error', 'sim', 'themes']) {
      const sc = S[n];
      for (const ev of EV[sc.clip].events) {
        const t = sc.start + (ev.t - sc.from);
        if (t < sc.start || t > sc.end) continue;
        if (tapLabels.test(ev.label)) cues.push({ t, type: 'tap' });
      }
    }
    cues.push({ t: at('add', 'success') + .12, type: 'success' }, { t: at('add', 'success') + .55, type: 'confetti' });
    cues.push({ t: at('add', 'thinking'), type: 'hmm' });
    cues.push({ t: at('error', 'error') + .05, type: 'error' });
    cues.push({ t: at('sim', 'saving-1') + .1, type: 'coin' }, { t: at('sim', 'saving-2') + .1, type: 'coin' });
    cues.push({ t: at('sim', 'saving-1') + .45, type: 'confetti' }, { t: at('sim', 'saving-2') + .45, type: 'confetti' });
    for (const k of ['state=loading', 'state=success', 'brand=#FFE08A', 'hair=boucles']) {
      const t1 = at('code', k);
      for (let x = t1 - .62; x < t1 - .05; x += .06) cues.push({ t: x, type: 'key' });
      cues.push({ t: t1, type: k === 'state=success' ? 'success' : 'pop' });
    }
    for (const n of ['intro', 'add', 'error', 'sim', 'code', 'themes', 'end']) cues.push({ t: S[n].start - .12, type: 'whoosh' });
    cues.push({ t: .2, type: 'slam' }, { t: .55, type: 'slam' }, { t: 1.1, type: 'boop' });
    cues.push({ t: S.end.start + .2, type: 'slam' }, { t: S.end.start + .7, type: 'success' }, { t: S.end.start + 1.1, type: 'confetti' });
    window.adAudioCues = cues.sort((a, b) => a.t - b.t);

    // progress segments
    $('progress').innerHTML = Object.keys(S).map(() => '<i><b></b></i>').join('');
  }

  // ------------------------------------------------------------------ captions
  function makeCaptions() {
    const root = $('caps');
    for (const c of CAPS) {
      const el = document.createElement('div');
      el.className = 'cap abs';
      el.style.top = (c.top || 110) + 'px';
      if (c.center) el.style.textAlign = 'center';
      const lines = [...c.lines, ...(c.hand ? [c.hand] : [])];
      el.innerHTML = lines.map((l, li) => `<div class="line${c.hand && li === lines.length - 1 ? ' hand' : ''}" style="${c.size && !(c.hand && li === lines.length - 1) ? `font-size:${c.size}px` : ''}">` +
        l.split(' ').map(w => `<span class="w">${w}</span>`).join(' ') + '</div>').join('') +
        (c.chip ? `<div class="chip"><span class="w">${c.chip.replace(/"([^"]+)"/, '"<em>$1</em>"')}</span></div>` : '');
      el.style.opacity = 0;
      root.appendChild(el);
      c.el = el;
      c.words = [...el.querySelectorAll('.w')];
      if (c.note) {
        const n = document.createElement('div');
        n.className = 'note abs';
        n.textContent = c.note.text;
        n.style.left = c.note.x + 'px'; n.style.top = c.note.y + 'px';
        root.appendChild(n);
        c.noteEl = n;
      }
    }
  }
  function renderCaptions(t) {
    for (const c of CAPS) {
      const on = t >= c.tIn - .01 && t <= c.tOut + .01;
      c.el.style.opacity = on ? 1 : 0;
      if (c.noteEl) c.noteEl.style.opacity = 0;
      if (!on) continue;
      const out = clamp((t - (c.tOut - .26)) / .26);
      const handIdx = c.hand ? c.words.length - (c.hand.split(' ').length + (c.chip ? 1 : 0)) : -1;
      c.words.forEach((w, i) => {
        const delay = i * .065 + (c.hand && i >= handIdx && handIdx >= 0 ? c.handAt : 0);
        const p = clamp((t - c.tIn - delay) / .38);
        const b = back(p);
        const s = .55 + .45 * b;
        w.style.opacity = clamp(p * 2.4) * (1 - out);
        w.style.transform = `translateY(${(1 - b) * 46 - out * 40}px) scale(${s}) rotate(${(1 - p) * (i % 2 ? 6 : -6)}deg)`;
      });
      if (c.noteEl) {
        const p = clamp((t - c.tIn - c.note.at) / .35);
        c.noteEl.style.opacity = easeOut(p) * (1 - out);
        c.noteEl.style.transform = `rotate(${c.note.rot}deg) translateY(${(1 - easeOut(p)) * 20}px)`;
      }
    }
  }

  // ------------------------------------------------------------------ phone
  function sceneAt(t) { for (const s of Object.values(S)) if (t >= s.start && t < s.end) return s; return S.end; }
  function phoneTransform(t) {
    // slide in during the intro, shrink below the editor during the code scene, leave at the end
    // At rest the whole phone fits with ~70 px of air below it (nav bar never cut).
    const REST_S = .9, REST_Y = -20;
    const inP = ease(clamp((t - (S.intro.start + 1.7)) / .9));
    let y = REST_Y + (1 - inP) * 1500, rot = (1 - inP) * -7, s = REST_S;
    const codeP = ease(clamp((t - (S.code.start - .05)) / .55)) * (1 - ease(clamp((t - (S.code.end - .45)) / .5)));
    s = lerp(REST_S, .68, codeP); y += lerp(0, 190, codeP);
    const outP = ease(clamp((t - S.end.start) / .6));
    y += outP * 1600; rot += outP * 8;
    // punch on each cut between app scenes
    for (const n of ['error', 'sim', 'code', 'themes']) { const d = t - S[n].start; if (d >= 0 && d < .3) s *= 1 - .025 * Math.sin(d / .3 * Math.PI); }
    return { y, rot, s };
  }
  const VW = 640, VH = 1385;                         // phone viewport (screen px)
  function frame(Z) {
    const [x0, y0, x1, y1] = Z.box;
    const z = Math.min(Z.zMax, VW * .92 / ((x1 - x0) * PX), VH * .92 / ((y1 - y0) * PX), 1e9);
    const zz = Math.max(1, z);
    const cx = (x0 + x1) / 2 * PX, cy = (y0 + y1) / 2 * PX;
    const tx = clamp(VW / 2 - cx * zz, VW - VW * zz, 0), ty = clamp(VH / 2 - cy * zz, VH - VH * zz, 0);
    return { z: zz, tx, ty };
  }
  function zoomAt() { return { z: 1, tx: 0, ty: 0 }; }   // the phone content is never zoomed (see loupes)

  // ------------------------------------------------------------------ loupe
  // Layout of a loupe: magnification m (stage px per clip px), window size and place,
  // below the mascot when there is room, otherwise above; always inside the safe area.
  const SAFE = { x0: 40, x1: 1040, y0: 470, y1: 1850 };
  function loupeLayout(Z) {
    const tm = (Z.t0 + Z.t1) / 2;
    const [x0, y0, x1, y1] = Z.box, bw = x1 - x0, bh = y1 - y0;
    const m = Math.min(Z.zMax * PX * .9 * 1.35, 860 / bw, 400 / bh);
    const w = bw * m + 20, h = bh * m + 20;
    const u = [toStage(tm, [Z.uko[0], Z.uko[1]]), toStage(tm, [Z.uko[2], Z.uko[3]])];
    const uTop = Math.min(u[0][1], u[1][1]), uBot = Math.max(u[0][1], u[1][1]), uCx = (u[0][0] + u[1][0]) / 2;
    let top = uBot + 70;
    if (top + h > SAFE.y1) top = uTop - 70 - h;
    top = clamp(top, SAFE.y0, SAFE.y1 - h);
    const left = clamp(uCx - w / 2, SAFE.x0, SAFE.x1 - w);
    return { m, w, h, left, top, target: [uCx, (uTop + uBot) / 2], ukoRect: [Math.min(u[0][0], u[1][0]), uTop, Math.max(u[0][0], u[1][0]), uBot] };
  }
  window.adLoupes = () => ZOOMS.map(Z => ({ ...loupeLayout(Z), box: Z.box, uko: Z.uko, t0: Z.t0, t1: Z.t1 }));
  function renderLoupe(t, url) {
    const el = $('loupe'), img = $('loupeImg'), tail = $('loupeTail');
    for (const Z of ZOOMS) {
      const w = ease(env(t, Z.t0, Z.t1, .4));
      if (w <= 0) continue;
      const L = Z.layout || (Z.layout = loupeLayout(Z));
      el.style.cssText = `left:${L.left}px;top:${L.top}px;width:${L.w}px;height:${L.h}px;opacity:${w};transform:scale(${.86 + .14 * back(clamp(w))})`;
      if (img.dataset.src !== url) { img.dataset.src = url; img.src = url; }
      img.style.width = 390 * L.m + 'px'; img.style.height = 844 * L.m + 'px';
      img.style.transform = `translate(${10 - Z.box[0] * L.m}px, ${10 - Z.box[1] * L.m}px)`;
      // A short tail from the loupe to the mascot on the phone.
      const [tx, ty] = L.target, cy = L.top > ty ? L.top : L.top + L.h, cx = clamp(tx, L.left + 60, L.left + L.w - 60);
      tail.style.opacity = w;
      $('loupeTailPath').setAttribute('d', `M ${cx - 26} ${cy} L ${tx} ${ty + (L.top > ty ? 40 : -40)} L ${cx + 26} ${cy} Z`);
      const [rx0, ry0, rx1, ry1] = L.ukoRect;
      $('loupeRing').setAttribute('x', rx0 - 14); $('loupeRing').setAttribute('y', ry0 - 14);
      $('loupeRing').setAttribute('width', rx1 - rx0 + 28); $('loupeRing').setAttribute('height', ry1 - ry0 + 28);
      return;
    }
    el.style.opacity = 0; tail.style.opacity = 0;
  }
  // clip CSS point → phone-viewport px (for checks)
  // Stage bottom of the phone body at time t (for the framing check).
  window.adPhoneBottom = t => {
    const ph = phoneTransform(t), ox = 206 + 668 / 2, oy = 470 + 1490 * .4, a = ph.rot * Math.PI / 180;
    return Math.max(...[[206, 470], [874, 470], [206, 1960], [874, 1960]].map(([X, Y]) => {
      const dx = (X - ox) * ph.s, dy = (Y - oy) * ph.s; return oy + dx * Math.sin(a) + dy * Math.cos(a) + ph.y;
    }));
  };
  window.adViewportPoint = (t, [cx, cy]) => { const zm = zoomAt(t); return [zm.tx + cx * PX * zm.z, zm.ty + cy * PX * zm.z]; };
  // clip CSS point → stage px (phone + zoom transforms)
  function toStage(t, [cx, cy]) {
    const ph = phoneTransform(t), zm = zoomAt(t);
    const x = zm.tx + cx * PX * zm.z, y = zm.ty + cy * PX * zm.z;
    // phone transform-origin: 50% 40% of the phone box
    const ox = 206 + 668 / 2, oy = 470 + 1490 * .4;   // (CSS box of #phone, before its transform)
    let X = SCREEN.x + x, Y = SCREEN.y + y;
    const a = ph.rot * Math.PI / 180;
    const dx = (X - ox) * ph.s, dy = (Y - oy) * ph.s;
    X = ox + dx * Math.cos(a) - dy * Math.sin(a); Y = oy + dx * Math.sin(a) + dy * Math.cos(a) + ph.y;
    return [X, Y];
  }

  async function renderPhone(t) {
    const ph = phoneTransform(t);
    $('phone').style.transform = `translateY(${ph.y}px) rotate(${ph.rot}deg) scale(${ph.s})`;
    const sc = sceneAt(t);
    const src = sc.clip ? sc : (t < S.add.start ? S.add : S.themes);
    const ct = clamp(src.from + (t - src.start), 0, EV[src.clip].frames / CLIP_FPS - .001);
    const frame = Math.min(EV[src.clip].frames - 1, Math.round(ct * CLIP_FPS));
    const url = `${CLIP_DIR}/${src.clip}/${String(frame).padStart(5, '0')}.jpg`;
    const img = $('clipImg');
    if (img.dataset.src !== url) { img.dataset.src = url; img.src = url; await img.decode().catch(() => {}); }
    const zm = zoomAt(t);
    img.style.transformOrigin = '0 0';
    img.style.transform = `translate(${zm.tx}px, ${zm.ty}px) scale(${zm.z})`;
    renderLoupe(t, url);
    let flash = 0;
    for (const n of ['error', 'sim', 'code', 'themes']) { const d = t - S[n].start; if (d >= 0 && d < .22) flash = .55 * (1 - d / .22); }
    $('flash').style.opacity = flash;
    $('live').style.opacity = env(t, S.code.start + .5, S.code.end - .2, .3);
  }

  // ------------------------------------------------------------------ code editor
  const CODE_BASE = { state: 'idle', hair: 'original', brand: '#C9D8C4' };
  function editsAt(t) {
    const at = window.adCue;
    return [
      { key: 'state', from: 'idle', to: 'loading', t: at('code', 'state=loading') },
      { key: 'state', from: 'loading', to: 'success', t: at('code', 'state=success') },
      { key: 'brand', from: '#C9D8C4', to: '#FFE08A', t: at('code', 'brand=#FFE08A') },
      { key: 'hair', from: 'original', to: 'boucles', t: at('code', 'hair=boucles') },
    ];
  }
  function valueAt(t, key) {
    let v = CODE_BASE[key], active = null;
    for (const e of editsAt(t)) {
      if (e.key !== key) continue;
      const del = e.from.length * .035, typ = e.to.length * .05, start = e.t - del - typ - .05;
      if (t >= e.t) v = e.to;
      else if (t >= start) {
        const k = t - start;
        v = k < del ? e.from.slice(0, Math.max(0, e.from.length - Math.floor(k / .035))) : e.to.slice(0, Math.floor((k - del) / .05));
        active = key;
      }
    }
    return { v, active };
  }
  function renderEditor(t) {
    const p = ease(clamp((t - (S.code.start - .05)) / .5)) * (1 - ease(clamp((t - (S.code.end - .4)) / .4)));
    const ed = $('editor');
    ed.style.opacity = p;
    ed.style.transform = `translateY(${(1 - p) * -120}px) rotate(${(1 - p) * -3}deg)`;
    if (p <= 0) return;
    const st = valueAt(t, 'state'), hr = valueAt(t, 'hair'), br = valueAt(t, 'brand');
    const blink = Math.floor(t * 2.2) % 2 === 0;
    const caret = key => ((st.active === key || hr.active === key || br.active === key) || (key === 'state' && !st.active && !hr.active && !br.active && blink)) ? '<span class="caret"></span>' : '';
    const recent = key => editsAt(t).some(e => e.key === key && t >= e.t && t < e.t + .9);
    const line = (n, html, key) => `<span class="ln">${n}</span>${key && recent(key) ? `<span class="hl">${html}</span>` : html}`;
    const attr = (name, val, key) => `  <span class="a">${name}</span>=<span class="s">"${val}${caret(key)}"</span>`;
    $('code').innerHTML = [
      line(1, '<span class="k">&lt;uko-mascot</span>'),
      line(2, attr('state', st.v, 'state'), 'state'),
      line(3, attr('hair', hr.v, 'hair'), 'hair'),
      line(4, attr('brand', br.v, 'brand') + ` <span class="k">/&gt;</span><span class="sw" style="background:${/^#[0-9A-F]{6}$/i.test(br.v) ? br.v : CODE_BASE.brand}"></span>`, 'brand'),
    ].join('\n');
  }

  // ------------------------------------------------------------------ confetti
  function rng(seed) { let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }
  const COLORS = ['#3B5BFF', '#FFC93C', '#FF7AAE', '#3DDC97', '#16161D'];
  function renderConfetti(t) {
    const cv = $('confetti'), g = cv.getContext('2d');
    g.clearRect(0, 0, W, H);
    for (const b of BURSTS) {
      const age0 = t - b.t;
      if (age0 < 0 || age0 > 1.8) continue;
      const origin = b.stage || toStage(b.t, b.f);
      const r = rng(b.seed);
      for (let i = 0; i < b.n; i++) {
        const ang = -Math.PI / 2 + (r() - .5) * Math.PI * 1.25, sp = 700 + r() * 1100, life = 1.1 + r() * .7;
        const age = age0; if (age > life) { r(); r(); continue; }
        const x = origin[0] + Math.cos(ang) * sp * age, y = origin[1] + Math.sin(ang) * sp * age + 1300 * age * age;
        g.save();
        g.globalAlpha = clamp((life - age) / .35);
        g.translate(x, y); g.rotate(r() * 6 + age * (4 + i % 5));
        g.fillStyle = COLORS[i % COLORS.length];
        const w = 14 + r() * 12;
        if (i % 3 === 0) { g.beginPath(); g.arc(0, 0, w / 2.4, 0, Math.PI * 2); g.fill(); } else g.fillRect(-w / 2, -w / 4, w, w / 2);
        g.restore();
      }
    }
  }

  // ------------------------------------------------------------------ arrows
  function renderArrow(t) {
    let d = '';
    for (const A of ARROWS) {
      const p = clamp((t - A.t0) / .45), out = clamp((t - (A.t1 - .25)) / .25);
      if (t < A.t0 || t > A.t1 || p <= 0) continue;
      const to = toStage(t, A.to), from = A.from;
      const to2 = [to[0] + (from[0] - to[0]) * .08, to[1] + (from[1] - to[1]) * .08];
      const mx = (from[0] + to2[0]) / 2 + 90, my = (from[1] + to2[1]) / 2 - 70;
      // head
      const ang = Math.atan2(to2[1] - my, to2[0] - mx);
      const h1 = [to2[0] - 34 * Math.cos(ang - .5), to2[1] - 34 * Math.sin(ang - .5)], h2 = [to2[0] - 34 * Math.cos(ang + .5), to2[1] - 34 * Math.sin(ang + .5)];
      d = `M ${from[0]} ${from[1]} Q ${mx} ${my} ${to2[0]} ${to2[1]} M ${h1[0]} ${h1[1]} L ${to2[0]} ${to2[1]} L ${h2[0]} ${h2[1]}`;
      const path = $('arrowPath');
      path.setAttribute('d', d);
      const len = path.getTotalLength();
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = len * (1 - easeOut(p));
      path.style.opacity = 1 - out;
      return;
    }
    $('arrowPath').setAttribute('d', '');
  }

  // ------------------------------------------------------------------ host + end card
  function renderHost(t) {
    const hostEl = $('host');
    // big in the hook/intro, then leaves; comes back on the end card
    const leave = ease(clamp((t - (S.intro.start + 1.5)) / .7));
    const back2 = ease(clamp((t - (S.end.start + .35)) / .6));
    const vis = t < S.add.start + .2 ? 1 : back2;
    let x = 280, y = 820, s = 1;
    if (t < S.add.start + .2) { x = lerp(280, -20, leave); y = lerp(820, 1260, leave); s = lerp(1, .5, leave); }
    else { x = 330; y = 700; s = .82; }
    hostEl.style.opacity = t < S.add.start + .2 ? 1 - clamp((t - (S.intro.end - .4)) / .4) : vis;
    hostEl.style.transform = `translate(${x - 280}px, ${y - 820}px) scale(${s})`;
    hostEl.style.transformOrigin = '50% 50%';
    // states, then step the engine
    while (hostCue < HOST_CUES.length && t >= HOST_CUES[hostCue][0]) { host.setState(HOST_CUES[hostCue][1]); hostCue++; }
    const dt = lastT < 0 ? 0 : Math.max(0, (t - lastT) * 1000);
    host.step(dt);
    minis.forEach((m, i) => {
      const p = clamp((t - (S.end.start + .55 + i * .12)) / .4);
      m.el.style.opacity = p > 0 ? 1 : 0;
      m.el.style.transform = `scale(${back(p)})`;
      if (p > 0) m.api.step(dt);
    });
    const end = clamp((t - (S.end.start + .15)) / .45);
    $('end').style.opacity = end;
    const logo = $('end').querySelector('.logo');
    logo.style.transform = `scale(${.6 + .4 * back(end)}) rotate(${(1 - end) * -8}deg)`;
    $('end').querySelector('.cta').style.transform = `translateY(${(1 - easeOut(clamp((t - S.end.start - .9) / .5))) * 260}px)`;
    $('watermark').style.opacity = 1 - end;
  }

  // ------------------------------------------------------------------ progress
  function renderProgress(t) {
    const bars = [...$('progress').querySelectorAll('b')];
    Object.values(S).forEach((s, i) => { bars[i].style.width = (clamp((t - s.start) / (s.end - s.start)) * 100) + '%'; });
  }

  // ------------------------------------------------------------------ boot
  async function init() {
    for (const c of CLIPS) EV[c] = await (await fetch(`${CLIP_DIR}/${c}/events.json`)).json();
    // End card and watermark in the page language; no price while sales are closed.
    document.documentElement.lang = LANG;
    $('end').querySelector('.tag').innerHTML = TXT.tag;
    $('end').querySelector('.pills').innerHTML = TXT.pills.map(p => `<span>${p}</span>`).join('');
    $('end').querySelector('.cta').innerHTML = `<b>${TXT.cta[0]}</b><span>${TXT.cta[1]}</span>`;
    $('end').querySelector('.url').textContent = SITE;
    $('watermark').textContent = SITE;
    build();
    makeCaptions();
    await document.fonts.ready;
    host = UkoMascot.create('#host', { hairStyle: 'original', brandColor: '#FFFFFF', interactive: false, theme: 'light', oneShotMode: 'loop' });
    host.pause(); host.step(0);
    // The family around the host: Uko in two looks, Aituko (robot) and Meowuko (cat).
    const looks = [['afro', '#FFD6E0', '#3A2A20', 60, 1030, 'uko'], ['original', '#DDE3FF', '#2B2B33', 250, 1150, 'aituko'], ['original', '#FFD9B3', '#2B2B33', 640, 1150, 'meowuko'], ['chignon', '#FFE8A3', '#7C4A1E', 830, 1030, 'uko']];
    for (const [hair, brand, hc, x, y, character] of looks) {
      const el = document.createElement('div');
      el.className = 'mini'; el.style.left = x + 'px'; el.style.top = y + 'px';
      $('stage').appendChild(el);
      const api = UkoMascot.create(el, { character, hairStyle: hair, brandColor: brand, hairColor: hc, accentColor: '#3B5BFF', interactive: false, theme: 'light', oneShotMode: 'loop' });
      api.pause(); api.step(0); api.setState(character === 'uko' && hair === 'chignon' ? 'welcome' : 'success');
      minis.push({ el, api });
    }
    return { duration: DURATION, scenes: S };
  }

  window.adReady = init();
  window.renderAt = async function (t) {
    await window.adReady;
    renderProgress(t);
    renderCaptions(t);
    await renderPhone(t);
    renderEditor(t);
    renderHost(t);
    renderConfetti(t);
    renderArrow(t);
    lastT = t;
  };
})();
