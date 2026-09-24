/**
 * Endless gallery of live combinations (character × state × hairstyle × hair colour × body colour).
 *
 * - The track drifts to the left; a card leaving one side is recycled on the other
 *   with a fresh random combination, so the gallery never repeats.
 * - Drag with the mouse, swipe on touch screens, or use the trackpad/wheel to scroll
 *   it by hand; a flick keeps going with inertia, then the drift resumes.
 * - Hover / keyboard focus: the drift eases to a stop and the card comes forward.
 * - Click / Enter / tap: a dialog opens with that combination, large, editable,
 *   with the matching code ready to copy.
 * - Cards off screen are paused; visible cards draw at 30 fps, the focused one at 60.
 * - prefers-reduced-motion: no drift, the row scrolls by hand.
 */
(function () {
  'use strict';
  const marquee = document.getElementById('marquee');
  const track = document.getElementById('track');
  const dialog = document.getElementById('comboDialog');
  if (!marquee || !track || typeof UkoMascot === 'undefined') return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const STATES = [
    ['welcome', 'coucou'], ['loading', 'chargement'], ['success', 'succès'], ['error', 'erreur'],
    ['thinking', 'réflexion'], ['empty', 'vide'], ['sleep', 'dodo'], ['idle', 'au repos']
  ];
  const HAIRS = Object.keys(UkoMascot.HAIR_STYLES);
  const HAIR_COLORS = ['#1B1B1F', '#3A2418', '#6B3F2A', '#B03A2E', '#D9962B', '#8B5CF6', '#FF7AAE', '#3B5BFF', '#E8E3DA'];
  // Fill colours (face, hands, feet). The engine adjusts them for contrast in each theme.
  const BODY_COLORS = ['#FFFFFF', '#FFC93C', '#FF7AAE', '#3DDC97', '#3B5BFF', '#8B5CF6', '#0EA5E9', '#FFE3C4'];
  // Aituko and Meowuko have no hair: state × body colour each.
  const CHARACTERS = (UkoMascot.CHARACTERS || ['uko']).slice();
  const NAMES = { uko: 'Uko', aituko: 'Aituko', meowuko: 'Meowuko' };
  const pick = list => list[Math.floor(Math.random() * list.length)];
  let lastHair = null;
  function randomCombo() {
    let hair = pick(HAIRS);
    if (hair === lastHair) hair = pick(HAIRS);
    lastHair = hair;
    const hairColor = hair === 'chauve' ? '#1B1B1F' : pick(HAIR_COLORS);
    // Half the cards are Uko (17 hairstyles), the other half the rest of the family.
    const character = Math.random() < .5 || CHARACTERS.length < 2 ? 'uko' : pick(CHARACTERS.slice(1));
    return { character, state: pick(STATES)[0], hair, hairColor, body: pick(BODY_COLORS) };
  }
  const label = s => (window.ukoStateLabel ? window.ukoStateLabel(s) : (STATES.find(x => x[0] === s) || [s, s])[1]);
  const hairLabel = h => (window.ukoHairLabel ? window.ukoHairLabel(h) : (UkoMascot.HAIR_STYLES[h] || [h])[0]);

  // ------------------------------------------------------------------ cards
  // Read once per resize, not every frame (innerWidth can force a layout on phones).
  let cardW = window.innerWidth < 640 ? 170 : 210;
  window.addEventListener('resize', () => { cardW = window.innerWidth < 640 ? 170 : 210; });
  const CARD_W = () => cardW;
  const GAP = 18;
  const cards = [];
  function makeCard(combo) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'combo-card';
    card.innerHTML = `<div class="combo-mini"></div><div class="combo-meta"><b></b><span></span><i class="dots"><em></em><em></em></i></div>`;
    track.appendChild(card);
    const m = UkoMascot.create(card.querySelector('.combo-mini'), {
      character: combo.character, state: combo.state, hairStyle: combo.hair, hairColor: combo.hairColor, brandColor: combo.body,
      interactive: false, oneShotMode: 'loop', maxFps: 30
    });
    const c = { card, m, combo };
    applyCombo(c, combo);
    card.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') focusCard(c); });
    card.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') blurCard(c); });
    card.addEventListener('focus', () => focusCard(c));
    card.addEventListener('blur', () => blurCard(c));
    card.addEventListener('click', () => openDialog(c.combo));
    return c;
  }
  function applyCombo(c, combo) {
    c.combo = combo;
    const uko = combo.character === 'uko';
    if (c.m.setCharacter) c.m.setCharacter(combo.character);
    c.m.setHairStyle(combo.hair); c.m.setHairColor(combo.hairColor); c.m.setBrandColor(combo.body);
    c.m.setState('idle'); c.m.setState(combo.state);
    const meta = c.card.querySelector('.combo-meta');
    meta.querySelector('b').textContent = label(combo.state);
    meta.querySelector('span').textContent = uko ? hairLabel(combo.hair) : NAMES[combo.character];
    const dots = meta.querySelectorAll('em');
    dots[0].style.display = uko ? '' : 'none';
    dots[0].style.background = combo.hairColor; dots[1].style.background = combo.body;
    const T = window.ukoT;
    c.card.setAttribute('aria-label', uko
      ? (T ? T('galleryCard', { state: label(combo.state), hair: hairLabel(combo.hair) }) : `Uko ${label(combo.state)}, coiffure ${hairLabel(combo.hair)}. Ouvrir pour personnaliser.`)
      : (T ? T('galleryCardChar', { name: NAMES[combo.character], state: label(combo.state) }) : `${NAMES[combo.character]} ${label(combo.state)}. Ouvrir pour personnaliser.`));
  }

  // Cards sit in numbered slots along the track (left = slot × step); the track itself
  // moves. A card leaving on one side takes the next free slot on the other, off screen,
  // so nothing that is visible ever jumps. Reduced motion: a plain row scrolled by hand.
  const place = c => { c.card.style.left = `${c.slot * (CARD_W() + GAP)}px`; c.card.style.width = `${CARD_W()}px`; };
  function layout() {
    const need = Math.ceil(marquee.clientWidth / (CARD_W() + GAP)) + 3;
    while (cards.length < need) {
      const c = makeCard(randomCombo());
      c.slot = cards.length ? cards[cards.length - 1].slot + 1 : Math.floor(-offset / (CARD_W() + GAP)) - 1;
      cards.push(c);
    }
    if (!reduced) { cards.forEach(place); track.style.height = `${(CARD_W() * 4.3 / 3).toFixed(1)}px`; }
  }

  // ------------------------------------------------------------------ drift
  // The drift runs on the compositor (Web Animations): it stays smooth even while the
  // mascots are drawing on the main thread. Speed changes (hover, fling) set its
  // playbackRate; a drag sets its time. offset = the track's translateX in px.
  const BASE_SPEED = reduced ? 0 : 60;
  let offset = 0, speed = BASE_SPEED, target = speed, focused = null, last = null, dialogOpen = false;
  let dragging = null, dragMoved = false;
  const PX_PER_MS = BASE_SPEED / 1000 || 0.06, SPAN = 200000;
  let anim = null;
  if (!reduced && typeof track.animate === 'function') {
    anim = track.animate([{ transform: 'translateX(0px)' }, { transform: `translateX(${-SPAN}px)` }], { duration: SPAN / PX_PER_MS, fill: 'both', easing: 'linear' });
    anim.currentTime = SPAN / 2 / PX_PER_MS;   // start in the middle: room in both directions
  }
  if (!reduced) offset = -SPAN / 2;
  const readOffset = () => (anim ? -anim.currentTime * PX_PER_MS : offset);
  function setOffset(o) {
    offset = o;
    if (anim) anim.currentTime = -o / PX_PER_MS;
    else track.style.transform = `translateX(${o.toFixed(2)}px)`;
  }
  const nudge = dx => setOffset(readOffset() + dx);
  function tick(now) {
    const dt = last === null ? 0 : Math.min(0.05, (now - last) / 1000);
    last = now;
    if (reduced) return;
    if (!dragging) {
      // A fling decays with friction; otherwise ease towards the drift speed.
      const k = Math.abs(speed - target) > 120 ? 2.4 : 6;
      speed += (target - speed) * (1 - Math.exp(-dt * k));
      if (target === 0 && Math.abs(speed) < 0.4) speed = 0;   // settle to a real stop
    }
    if (marqueeVisible && !document.hidden) {
      const rate = dragging ? 0 : speed / BASE_SPEED;
      if (anim) { if (Math.abs(anim.playbackRate - rate) > 1e-3) anim.playbackRate = rate; offset = readOffset(); }
      else if (!dragging) setOffset(offset - speed * dt);
      recycle();
    }
    requestAnimationFrame(tick);
  }

  // Endless in both directions: one spare slot on the left, the rest on the right.
  function recycle() {
    const step = CARD_W() + GAP, first = Math.floor(-offset / step) - 1;
    while (cards[0].slot < first) {
      const c = cards.shift(); c.slot = cards[cards.length - 1].slot + 1; place(c); cards.push(c);
      applyCombo(c, randomCombo());
    }
    while (cards[0].slot > first) {
      const c = cards.pop(); c.slot = cards[0].slot - 1; place(c); cards.unshift(c);
      applyCombo(c, randomCombo());
    }
    // After a long time (or a long fling), move everything back to the middle of the span.
    if (-offset < SPAN * 0.1 || -offset > SPAN * 0.9) {
      const k = Math.round((-offset - SPAN / 2) / step);
      cards.forEach(c => { c.slot -= k; place(c); });
      setOffset(offset + k * step);
    }
  }

  // Drag / swipe with inertia. Vertical page scrolling stays native (touch-action: pan-y).
  marquee.addEventListener('pointerdown', e => {
    if (reduced || (e.button !== undefined && e.button !== 0)) return;
    dragging = { id: e.pointerId, x: e.clientX, lastX: e.clientX, lastT: performance.now(), v: 0 };
    dragMoved = false;
  });
  window.addEventListener('pointermove', e => {
    if (!dragging || e.pointerId !== dragging.id) return;
    const now = performance.now(), dx = e.clientX - dragging.lastX, dt = Math.max(1, now - dragging.lastT);
    if (!dragMoved && Math.abs(e.clientX - dragging.x) > 6) {
      dragMoved = true;
      marquee.classList.add('is-dragging');
      try { marquee.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (focused) blurCard(focused);
    }
    if (!dragMoved) return;
    nudge(dx);
    dragging.v = dragging.v * 0.6 + (dx / dt) * 0.4;         // px per ms, smoothed
    dragging.lastX = e.clientX; dragging.lastT = now;
  });
  const endDrag = e => {
    if (!dragging || (e && e.pointerId !== dragging.id)) return;
    if (dragMoved) speed = Math.max(-2600, Math.min(2600, -dragging.v * 1000));   // fling
    dragging = null;
    marquee.classList.remove('is-dragging');
    if (!focused && !dialogOpen) target = BASE_SPEED;
  };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  // A drag is not a click.
  track.addEventListener('click', e => { if (dragMoved) { e.stopPropagation(); e.preventDefault(); dragMoved = false; } }, true);
  // Trackpad / shift+wheel horizontal scrolling.
  marquee.addEventListener('wheel', e => {
    if (reduced) return;
    const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
    if (!dx) return;
    e.preventDefault();
    nudge(-dx);
    speed = Math.max(-2600, Math.min(2600, dx * 22));
  }, { passive: false });

  function focusCard(c) {
    if (dragging && dragMoved) return;
    focused = c;
    target = 0;
    marquee.classList.add('has-focus');
    cards.forEach(x => x.card.classList.toggle('is-focus', x === c));
    c.m.setMaxFps(60);
  }
  function blurCard(c) {
    if (focused !== c) return;
    focused = null;
    if (!dialogOpen) target = BASE_SPEED;
    marquee.classList.remove('has-focus');
    c.card.classList.remove('is-focus');
    c.m.setMaxFps(30);
  }

  // Pause cards that are not visible.
  let marqueeVisible = true;
  new IntersectionObserver(es => es.forEach(e => {
    marqueeVisible = e.isIntersecting;
    if (anim) marqueeVisible ? anim.play() : anim.pause();
    cards.forEach(c => (marqueeVisible ? c.m.resume() : c.m.pause()));
  }), { threshold: 0 }).observe(marquee);
  const cardVis = new IntersectionObserver(es => es.forEach(e => {
    const c = cards.find(x => x.card === e.target);
    if (c) (e.isIntersecting && marqueeVisible) ? c.m.resume() : c.m.pause();
  }), { root: marquee, threshold: 0 });

  // ------------------------------------------------------------------ dialog
  let big = null, current = null;
  const code = dialog && dialog.querySelector('#comboCode');
  function renderCode() {
    if (!code) return;
    const who = current.character && current.character !== 'uko' ? `character="${current.character}" ` : '';
    const hair = who ? '' : ` hair="${current.hair}" hair-color="${current.hairColor}"`;
    code.textContent = `<uko-mascot ${who}state="${current.state}"${hair} brand="${current.body}"${current.theme === 'dark' ? ' theme="dark"' : ''}></uko-mascot>`;
  }
  function buildControls() {
    const chips = (id, items, key, fmt) => {
      const box = dialog.querySelector(id);
      box.innerHTML = items.map(v => `<button type="button" class="chip" data-v="${v}">${fmt(v)}</button>`).join('');
      box.addEventListener('click', e => {
        const b = e.target.closest('.chip'); if (!b) return;
        current[key] = b.dataset.v;
        if (key === 'state') { big.setState('idle'); big.setState(current.state); }
        if (key === 'character') { big.setCharacter(current.character); big.setState('idle'); big.setState(current.state); }
        if (key === 'hair') big.setHairStyle(current.hair);
        if (key === 'hairColor') big.setHairColor(current.hairColor);
        if (key === 'body') big.setBrandColor(current.body);
        if (key === 'theme') { big.setTheme(current.theme); dialog.querySelector('.combo-stage').classList.toggle('is-dark', current.theme === 'dark'); }
        syncControls(); renderCode();
      });
    };
    if (dialog.querySelector('#pickCharacter')) chips('#pickCharacter', CHARACTERS, 'character', v => NAMES[v]);
    chips('#pickState', STATES.map(s => s[0]), 'state', label);
    chips('#pickHair', HAIRS, 'hair', hairLabel);
    const swatch = v => `<span class="sw" style="background:${v}"></span>`;
    chips('#pickHairColor', HAIR_COLORS, 'hairColor', swatch);
    chips('#pickBody', BODY_COLORS, 'body', swatch);
    chips('#pickTheme', ['light', 'dark'], 'theme', v => (v === 'dark' ? '☾ sombre' : '☀ clair'));
    dialog.querySelectorAll('#pickHairColor .chip, #pickBody .chip').forEach(b => b.setAttribute('aria-label', b.dataset.v));
    dialog.querySelector('#comboCopy').addEventListener('click', e => {
      navigator.clipboard && navigator.clipboard.writeText(code.textContent).then(() => { e.target.textContent = (window.ukoT || (k => k))('copied'); setTimeout(() => (e.target.textContent = (window.ukoT || (k => k))('copy')), 1400); });
    });
    dialog.querySelector('#comboShuffle').addEventListener('click', () => {
      current = Object.assign(randomCombo(), { theme: current.theme });
      big.setCharacter(current.character);
      big.setHairStyle(current.hair); big.setHairColor(current.hairColor); big.setBrandColor(current.body);
      big.setState('idle'); big.setState(current.state);
      syncControls(); renderCode();
    });
    dialog.addEventListener('close', () => { dialogOpen = false; if (!focused) target = BASE_SPEED; });
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  }
  function syncControls() {
    const map = { '#pickCharacter': current.character || 'uko', '#pickState': current.state, '#pickHair': current.hair, '#pickHairColor': current.hairColor, '#pickBody': current.body, '#pickTheme': current.theme || 'light' };
    for (const id in map) dialog.querySelectorAll(`${id} .chip`).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === map[id])));
    // Hair rows only make sense for Uko.
    const hairy = (current.character || 'uko') === 'uko';
    dialog.querySelectorAll('.hair-row').forEach(el => { el.hidden = !hairy; });
  }
  function openDialog(combo) {
    if (!dialog || typeof dialog.showModal !== 'function') return;
    current = Object.assign({ theme: current && current.theme || 'light' }, combo);
    if (!big) {
      big = UkoMascot.create(dialog.querySelector('#comboBig'), { character: current.character, state: current.state, hairStyle: current.hair, hairColor: current.hairColor, brandColor: current.body, oneShotMode: 'loop', theme: current.theme, follow: 'page' });
      buildControls();
    } else {
      big.setCharacter(current.character);
      big.setHairStyle(current.hair); big.setHairColor(current.hairColor); big.setBrandColor(current.body);
      big.setState('idle'); big.setState(current.state);
    }
    syncControls(); renderCode();
    dialogOpen = true; target = 0;
    dialog.showModal();
  }

  // ------------------------------------------------------------------ start
  if (!reduced) track.classList.add('is-slots');
  layout();
  cards.forEach(c => cardVis.observe(c.card));
  const mo = new MutationObserver(() => cards.forEach(c => cardVis.observe(c.card)));
  mo.observe(track, { childList: true });
  window.addEventListener('resize', () => { layout(); cards.forEach(c => cardVis.observe(c.card)); });
  if (reduced) marquee.classList.add('is-manual');
  requestAnimationFrame(tick);
})();
