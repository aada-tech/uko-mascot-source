// Uko — 16:9 presentation video (YouTube), rendered frame by frame.
// renderAt(t) draws the frame at time t (seconds). Everything is a function of t,
// except the Uko engine instances, which are stepped forward: call it with
// increasing times. Query: ?lang=fr|en|es&site=<domain>&frames=<clip frames>&thumb=1
(function () {
  const P = new URLSearchParams(location.search);
  const LANG = (P.get('lang') || 'fr').slice(0, 2);
  const SITE = P.get('site') || 'uko-mascot.pages.dev';
  const CLIP_FRAMES = +(P.get('frames') || 0);          // frames of the SubFlow clip (30 fps), served at /frames/
  const CLIP_FPS = 30, CLIP_FROM = 6, CLIP_SPEED = 1.5; // the clip starts at 6 s, played 1.5× faster
  const DURATION = 41;

  const T = {
    fr: {
      hook: ['Ton app a besoin', ['d’un ', 'petit bonhomme.']], hookSub: 'Une mascotte animée et légère, prête pour ton app.', hookNote: 'voici Uko ✎',
      states: 'Chaque moment a sa réaction.', labA: ['chargement…', 'succès !'], labB: ['réflexion…', 'oups, erreur'], labC: ['liste vide', 'dodo'],
      code: ['Une ligne de code. ', 'C’est vivant.'], pills: ['<b>58 Ko</b> compressé', 'zéro dépendance', 'Web · React · Flutter · iOS · Android'],
      ai: ['Ton IA l’adapte ', 'à ton app.'], promptTag: 'le prompt est fourni ✎',
      prompt: 'Intègre la mascotte Uko dans mon app. Branche ses états : loading pendant les requêtes, success après un enregistrement, error sur un formulaire invalide, empty sur une liste vide. Reprends les couleurs de ma marque.',
      res1: 'Exemple réel : SubFlow', res2: 'sur mesure, il grimpe sur le formulaire',
      end: 'Gratuit pour commencer.', price: 'Pack complet : 6,99 €',
      thumb: ['Une mascotte', 'pour ton app'], thumbPills: ['<b>58 Ko</b> · Web · Mobile', 'Adaptée par l’IA']
    },
    en: {
      hook: ['Your app needs', ['a ', 'little buddy.']], hookSub: 'A light animated mascot, ready for your app.', hookNote: 'meet Uko ✎',
      states: 'Every moment gets a reaction.', labA: ['loading…', 'success!'], labB: ['thinking…', 'oops, error'], labC: ['empty list', 'nap time'],
      code: ['One line of code. ', 'It comes alive.'], pills: ['<b>58 KB</b> compressed', 'zero dependencies', 'Web · React · Flutter · iOS · Android'],
      ai: ['Your AI fits it ', 'to your app.'], promptTag: 'the prompt is included ✎',
      prompt: 'Add the Uko mascot to my app. Wire its states: loading during requests, success after a save, error on an invalid form, empty on an empty list. Use my brand colors.',
      res1: 'Real example: SubFlow', res2: 'custom: it climbs onto the form',
      end: 'Free to start.', price: 'Full pack: €6.99',
      thumb: ['A mascot', 'for your app'], thumbPills: ['<b>58 KB</b> · Web · Mobile', 'Fitted by AI']
    },
    es: {
      hook: ['Tu app necesita', ['un ', 'muñequito.']], hookSub: 'Una mascota animada y ligera, lista para tu app.', hookNote: 'este es Uko ✎',
      states: 'Cada momento tiene su reacción.', labA: ['cargando…', '¡éxito!'], labB: ['pensando…', 'uy, error'], labC: ['lista vacía', 'siesta'],
      code: ['Una línea de código. ', 'Cobra vida.'], pills: ['<b>58 KB</b> comprimido', 'cero dependencias', 'Web · React · Flutter · iOS · Android'],
      ai: ['Tu IA la adapta ', 'a tu app.'], promptTag: 'el prompt está incluido ✎',
      prompt: 'Integra la mascota Uko en mi app. Conecta sus estados: loading durante las peticiones, success después de guardar, error en un formulario no válido, empty en una lista vacía. Usa los colores de mi marca.',
      res1: 'Ejemplo real: SubFlow', res2: 'a medida: trepa al formulario',
      end: 'Gratis para empezar.', price: 'Pack completo: 6,99 €',
      thumb: ['Una mascota', 'para tu app'], thumbPills: ['<b>58 KB</b> · Web · Móvil', 'Adaptada por IA']
    }
  }[LANG];

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const back = t => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const env = (t, t0, t1, fade = .35) => (t0 <= 0 ? 1 : clamp((t - t0) / fade)) * (t1 >= DURATION ? 1 : clamp((t1 - t) / fade));
  const $ = id => document.getElementById(id);
  const cache = new Map();
  const set = (el, key, v) => { const k = el.id + key; if (cache.get(k) !== v) { cache.set(k, v); if (key === 'html') el.innerHTML = v; else el.style[key] = v; } };
  // Appear: fade + rise (or pop with `pop`) from t0.
  function appear(el, t, t0, { rise = 40, pop = false, dur = .5, rot = 0 } = {}) {
    const k = clamp((t - t0) / dur);
    set(el, 'opacity', String(easeOut(k)));
    set(el, 'transform', pop ? `scale(${(.9 + .1 * back(k)).toFixed(4)}) rotate(${rot}deg)` : `translateY(${((1 - easeOut(k)) * rise).toFixed(2)}px) rotate(${rot}deg)`);
  }
  const typed = (str, t, t0, t1) => str.slice(0, Math.round(str.length * clamp((t - t0) / (t1 - t0))));

  // ------------------------------------------------------------------ scenes and mascots
  const SC = { hook: [0, 5], states: [5, 14.5], code: [14.5, 22.5], ai: [22.5, 35], end: [35, DURATION] };
  const SCENE_EL = { hook: 'sHook', states: 'sStates', code: 'sCode', ai: 'sAI', end: 'sEnd' };
  const mascots = [];
  const mk = (id, character, extra = {}) => {
    const m = UkoMascot.create('#' + id, { character, state: 'idle', hairStyle: 'original', interactive: false, oneShotMode: 'loop', follow: 'none', ...extra });
    m.pause(); mascots.push(m); return m;
  };
  let EVENTS = [];
  const at = (t, fn) => EVENTS.push([t, fn]);

  function build() {
    $('hook1').textContent = T.hook[0];
    $('hook2').innerHTML = `${T.hook[1][0]}<span class="hand">${T.hook[1][1]}</span>`;
    $('hookSub').textContent = T.hookSub;
    $('hookNote').textContent = T.hookNote;
    $('statesTitle').textContent = T.states;
    $('codeTitle').innerHTML = `${T.code[0]}<span class="hand">${T.code[1]}</span>`;
    $('pills').innerHTML = T.pills.map((p, i) => `<div class="pill" id="pill${i}">${p}</div>`).join('');
    $('aiTitle').innerHTML = `${T.ai[0]}<span class="hand">${T.ai[1]}</span>`;
    $('aiResult1').textContent = T.res1;
    $('aiResult2').textContent = '↳ ' + T.res2;
    $('endTitle').textContent = T.end;
    $('endPrice').textContent = T.price;
    $('endUrl').textContent = SITE;

    const hook = mk('mHook', 'uko');
    const A = mk('mA', 'uko'), B = mk('mB', 'aituko'), C = mk('mC', 'meowuko');
    const code = mk('mCode', 'uko');
    const E = [mk('mE1', 'aituko'), mk('mE2', 'uko'), mk('mE3', 'meowuko')];
    at(.9, () => hook.setState('welcome'));
    at(5.3, () => A.setState('loading')); at(9.3, () => A.setState('success'));
    at(5.5, () => B.setState('thinking')); at(10.0, () => B.setState('error'));
    at(5.7, () => C.setState('empty')); at(10.7, () => C.setState('sleep'));
    at(16.9, () => code.setState('loading')); at(18.6, () => code.setState('success'));
    E.forEach((m, i) => at(35.4 + i * .15, () => m.setState('success')));
    EVENTS.sort((a, b) => a[0] - b[0]);
  }

  // Audio cues for the soundtrack (audio.cjs): scene starts, reactions, typing.
  const CUES = [
    { t: .25, type: 'pop' }, { t: .9, type: 'bell' },
    { t: 5.25, type: 'pop' }, { t: 5.45, type: 'pop' }, { t: 5.65, type: 'pop' },
    { t: 9.3, type: 'success' }, { t: 10.0, type: 'error' }, { t: 10.7, type: 'soft' },
    { t: 14.7, type: 'pop' }, { t: 15.4, type: 'type', until: 16.9 }, { t: 18.6, type: 'success' },
    { t: 22.7, type: 'pop' }, { t: 23.6, type: 'type', until: 27.2 }, { t: 28.0, type: 'bell' },
    { t: 35.2, type: 'pop' }, { t: 35.4, type: 'success' }, { t: 36.0, type: 'bell' }
  ];

  // ------------------------------------------------------------------ code panel
  const CODE_LINE1 = [['&lt;', ''], ['script', 'k'], [' ', ''], ['src', 'a'], ['=', ''], ['"uko-mascot-engine.min.js"', 's'], ['&gt;&lt;/', ''], ['script', 'k'], ['&gt;', '']];
  const codeLine3 = st => [['&lt;', ''], ['uko-mascot', 'k'], [' ', ''], ['state', 'a'], ['=', ''], [`"${st}"`, 's hl-maybe'], ['&gt;&lt;/', ''], ['uko-mascot', 'k'], ['&gt;', '']];
  const plainLen = toks => toks.reduce((n, [s]) => n + s.replace(/&lt;|&gt;/g, '<').length, 0);
  function renderTokens(toks, n, hl) {
    let out = '', left = n;
    for (const [s, cls] of toks) {
      if (left <= 0) break;
      const plain = s.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      const part = plain.slice(0, left); left -= part.length;
      const html = part.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const c = cls.replace('hl-maybe', hl ? 'hl' : '').trim();
      out += c ? `<span class="${c}">${html}</span>` : html;
    }
    return out;
  }

  // ------------------------------------------------------------------ frame
  let lastT = null, nextEvent = 0, lastPhone = -1;
  async function renderAt(t) {
    const dt = lastT === null ? 0 : Math.max(0, (t - lastT) * 1000);
    lastT = t;
    while (nextEvent < EVENTS.length && EVENTS[nextEvent][0] <= t) EVENTS[nextEvent++][1]();
    for (const m of mascots) m.step(dt);

    for (const [k, [a, b]] of Object.entries(SC)) set($(SCENE_EL[k]), 'opacity', String(env(t, a, b)));

    // 1. hook
    appear($('hook1'), t, .2); appear($('hook2'), t, .55); appear($('hookSub'), t, 1.4, { rise: 20 });
    appear($('mHook'), t, .1, { rise: 60, dur: .7 }); appear($('hookNote'), t, 2.4, { rise: 10, rot: -5 });

    // 2. states
    [['cardA', 5.25, -1.5], ['cardB', 5.45, 1], ['cardC', 5.65, -.8]].forEach(([id, t0, rot]) => appear($(id), t, t0, { pop: true, rot }));
    appear($('statesTitle'), t, 5.05, { rise: 20 });
    const chip = (id, labId, t1, a, b, la, lb) => {
      const after = t >= t1;
      set($(id), 'html', `state="${after ? b : a}"`);
      $(id).classList.toggle('flash', after && t < t1 + .45);
      set($(labId), 'html', after ? lb : la);
    };
    chip('chipA', 'labA', 9.3, 'loading', 'success', T.labA[0], T.labA[1]);
    chip('chipB', 'labB', 10.0, 'thinking', 'error', T.labB[0], T.labB[1]);
    chip('chipC', 'labC', 10.7, 'empty', 'sleep', T.labC[0], T.labC[1]);

    // 3. code
    appear($('codeTitle'), t, 14.7, { rise: 20 });
    appear($('codeBox'), t, 14.9, { rise: 30 });
    appear($('codeCard'), t, 15.1, { pop: true, rot: 2 });
    const st = t >= 18.6 ? 'success' : 'loading', l3 = codeLine3(st);
    const n3 = Math.round(plainLen(l3) * clamp((t - 15.4) / 1.5));
    const typing = t >= 15.4 && t < 17.4;
    set($('codeBox'), 'html', renderTokens(CODE_LINE1, 999, false) + '\n\n' + renderTokens(l3, n3, t >= 18.6 && t < 19.6) + (typing ? '<span class="caret"></span>' : ''));
    T.pills.forEach((_, i) => { const el = $('pill' + i); if (el) appear(el, t, 17.2 + i * .3, { pop: true }); });

    // 4. AI
    appear($('aiTitle'), t, 22.7, { rise: 20 });
    ['ai1', 'ai2', 'ai3', 'ai4'].forEach((id, i) => appear($(id), t, 23.0 + i * .15, { pop: true }));
    appear($('promptBox'), t, 23.3, { rise: 30 });
    const pr = typed(T.prompt, t, 23.6, 27.2).replace(/\b(loading|success|error|empty)\b/g, '<code>$1</code>');
    set($('promptBox'), 'html', `<span class="tag">${T.promptTag}</span>${pr}${t >= 23.6 && t < 27.6 ? '<span class="caret"></span>' : ''}`);
    appear($('phone'), t, 22.9, { rise: 60, dur: .7, rot: 1.5 });
    appear($('aiResult'), t, 28.0, { rise: 20 });
    if (CLIP_FRAMES) {
      const f = Math.min(CLIP_FRAMES - 1, Math.round(CLIP_FROM * CLIP_FPS + Math.max(0, t - 23.0) * CLIP_SPEED * CLIP_FPS));
      if (f !== lastPhone) {
        lastPhone = f;
        const img = $('phoneImg');
        img.src = `/frames/${String(f + 1).padStart(5, '0')}.jpg`;
        await img.decode().catch(() => {});
      }
    }

    // 5. end
    appear($('endTitle'), t, 35.2, { rise: 20 }); appear($('endPrice'), t, 35.6, { rise: 20 });
    const u = clamp((t - 36.0) / .5);
    set($('endUrl'), 'opacity', String(easeOut(u)));
    set($('endUrl'), 'transform', `translateX(-50%) scale(${(.9 + .1 * back(u)).toFixed(4)})`);
    ['mE1', 'mE2', 'mE3'].forEach((id, i) => appear($(id), t, 35.3 + i * .15, { rise: 80, dur: .6 }));
  }

  // Thumbnail: big title, two badges, Uko mid-celebration.
  async function renderThumb() {
    document.body.classList.add('thumb');
    $('thumbTitle').innerHTML = `${T.thumb[0]}<br><span class="hand">${T.thumb[1]}</span>`;
    $('thumbPill1').innerHTML = T.thumbPills[0];
    $('thumbPill2').innerHTML = T.thumbPills[1];
    const m = UkoMascot.create('#mT1', { character: 'uko', state: 'idle', hairStyle: 'original', interactive: false, oneShotMode: 'loop', follow: 'none' });
    m.pause(); m.step(0); m.setState('success');
    for (let i = 0; i < 44; i++) m.step(1000 / 30);   // ≈ 1.5 s in: arms up, mid-jump
  }

  window.presReady = (async () => {
    await document.fonts.ready;
    if (!P.has('thumb')) { build(); await renderAt(0); }
    return { duration: DURATION, cues: CUES };
  })();
  window.renderAt = renderAt;
  window.renderThumb = renderThumb;
})();
