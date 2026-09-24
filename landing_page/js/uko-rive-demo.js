// Live demo of uko.riv, aituko.riv and meowuko.riv (official Rive web runtime,
// self-hosted in /rive/). Same state machine and inputs in the three files.
// The runtime (~450 KB + 1.9 MB wasm) is only loaded when the section comes
// into view, and the animation pauses while it is off screen.
(function () {
  const T = window.ukoT || (k => k);
  const section = document.getElementById('rive');
  if (!section) return;
  const canvas = document.getElementById('riveCanvas');
  const status = document.getElementById('riveStatus');
  const callEl = document.getElementById('riveCall');
  const codeEl = document.getElementById('riveCode');
  let uko = null, loading = false, visible = false, file = 'uko';

  // ---------- code samples ----------
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  // One pass, so a later rule never re-tokenizes an earlier span.
  const hl = s => esc(s).replace(/(\/\/[^\n]*)|('[^'\n]*'|"[^"\n]*")|\b(import|from|const|new|export|function|return|let|final)\b/g,
    (m, c, str, k) => c ? `<span class="c">${c}</span>` : str ? `<span class="s">${str}</span>` : `<span class="k">${k}</span>`);
  const samples = (f) => ({
    web: `import { Rive } from '@rive-app/canvas';

const uko = new Rive({
  src: '/${f}.riv',
  canvas: document.querySelector('#uko'),
  stateMachines: 'Uko',
  autoplay: true,
  autoBind: true,            // couleurs pilotables
  onLoad: () => uko.resizeDrawingSurfaceToCanvas(),
});

const input = (n) => uko.stateMachineInputs('Uko').find(i => i.name === n);
input('state').value = 2;    // 0 idle · 1 thinking · 2 loading · 3 sleep
input('success').fire();     // welcome · success · error · empty

uko.viewModelInstance.color('bodyColor').value = 0xFFFFD6E0; // ARGB`,
    react: `import { useEffect } from 'react';
import { useRive, useStateMachineInput } from '@rive-app/react-canvas';

export function Uko({ state = 0 }) {
  const { rive, RiveComponent } = useRive({
    src: '/${f}.riv', stateMachines: 'Uko', autoplay: true, autoBind: true,
  });
  const mode = useStateMachineInput(rive, 'Uko', 'state');
  const success = useStateMachineInput(rive, 'Uko', 'success');

  useEffect(() => { if (mode) mode.value = state; }, [mode, state]);
  return <RiveComponent style={{ width: 240, height: 360 }}
                        onClick={() => success?.fire()} />;
}`,
    flutter: `// pubspec.yaml : rive
RiveAnimation.asset(
  'assets/${f}.riv',
  stateMachines: const ['Uko'],
  onInit: (artboard) {
    final c = StateMachineController.fromArtboard(artboard, 'Uko')!;
    artboard.addController(c);
    final state = c.findInput<double>('state') as SMINumber;
    final success = c.findInput<bool>('success') as SMITrigger;
    state.value = 2;     // loading
    success.fire();      // ${T('celebration')}
  },
);`,
    swift: `import RiveRuntime

let uko = RiveViewModel(fileName: "${f}", stateMachineName: "Uko")

// SwiftUI : uko.view()
uko.setInput("state", value: 2.0)   // loading
uko.triggerInput("success")         // ${T('celebration')}`,
    android: `// res/raw/${f}.riv
riveView.setRiveResource(R.raw.${f}, stateMachineName = "Uko")

riveView.setNumberState("Uko", "state", 2f)   // loading
riveView.fireState("Uko", "success")          // ${T('celebration')}`
  });
  let tab = 'web';
  const renderCode = () => { codeEl.innerHTML = hl(samples(file)[tab]); };
  section.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    tab = t.dataset.rtab;
    section.querySelectorAll('.tab').forEach(x => x.setAttribute('aria-selected', String(x === t)));
    renderCode();
  }));
  renderCode();
  document.getElementById('riveCopy').addEventListener('click', e => {
    navigator.clipboard && navigator.clipboard.writeText(samples(file)[tab]).then(() => { e.target.textContent = (window.ukoT || (k => k))('copied'); setTimeout(() => { e.target.textContent = (window.ukoT || (k => k))('copy'); }, 1400); });
  });

  // ---------- what is playing ----------
  const NOW = {
    fr: { Idle: 'repos (boucle)', IdleGlance: 'geste : regarde autour', IdleLookUp: 'geste : lève les yeux', IdleShrug: 'geste : hausse les épaules', IdleTap: 'geste : tape du pied',
      Welcome: 'salut', Success: 'succès', Error: 'erreur', Empty: 'rien ici', ThinkingEnter: 'se met à réfléchir', Thinking: 'réflexion (boucle)',
      ThinkPonderL: 'geste : penche la tête', ThinkPonderR: 'geste : penche la tête', ThinkScratch: 'geste : se gratte la tête', ThinkNod: 'geste : hoche la tête',
      ThinkingExit: 'arrête de réfléchir', LoadingEnter: 'sort l’ordinateur', Loading: 'chargement (boucle)', LoadCheck: 'geste : regarde le chargement',
      LoadLean: 'geste : se penche', LoadPeek: 'geste : jette un œil', LoadSigh: 'geste : soupire', LoadTap: 'geste : tape du pied', LoadingExit: 'range l’ordinateur',
      LoadingToSuccess: 'chargement → succès', LoadingToError: 'chargement → erreur', SleepEnter: 's’endort', Sleep: 'sommeil (boucle)',
      SleepSnuggle: 'geste : se blottit', SleepTwitch: 'geste : remue le pied', Wake: 'se réveille' },
    en: { Idle: 'idle (loop)', IdleGlance: 'gesture: looks around', IdleLookUp: 'gesture: looks up', IdleShrug: 'gesture: shrugs', IdleTap: 'gesture: taps a foot',
      Welcome: 'hello', Success: 'success', Error: 'error', Empty: 'nothing here', ThinkingEnter: 'starts thinking', Thinking: 'thinking (loop)',
      ThinkPonderL: 'gesture: tilts the head', ThinkPonderR: 'gesture: tilts the head', ThinkScratch: 'gesture: scratches the head', ThinkNod: 'gesture: nods',
      ThinkingExit: 'stops thinking', LoadingEnter: 'takes out the laptop', Loading: 'loading (loop)', LoadCheck: 'gesture: checks the progress',
      LoadLean: 'gesture: leans in', LoadPeek: 'gesture: peeks over', LoadSigh: 'gesture: sighs', LoadTap: 'gesture: taps a foot', LoadingExit: 'puts the laptop away',
      LoadingToSuccess: 'loading → success', LoadingToError: 'loading → error', SleepEnter: 'falls asleep', Sleep: 'sleep (loop)',
      SleepSnuggle: 'gesture: snuggles', SleepTwitch: 'gesture: twitches a foot', Wake: 'wakes up' },
    es: { Idle: 'reposo (bucle)', IdleGlance: 'gesto: mira alrededor', IdleLookUp: 'gesto: levanta la vista', IdleShrug: 'gesto: se encoge de hombros', IdleTap: 'gesto: golpea el pie',
      Welcome: 'saludo', Success: 'éxito', Error: 'error', Empty: 'nada aquí', ThinkingEnter: 'se pone a pensar', Thinking: 'pensando (bucle)',
      ThinkPonderL: 'gesto: inclina la cabeza', ThinkPonderR: 'gesto: inclina la cabeza', ThinkScratch: 'gesto: se rasca la cabeza', ThinkNod: 'gesto: asiente',
      ThinkingExit: 'deja de pensar', LoadingEnter: 'saca el portátil', Loading: 'cargando (bucle)', LoadCheck: 'gesto: mira la carga',
      LoadLean: 'gesto: se inclina', LoadPeek: 'gesto: se asoma', LoadSigh: 'gesto: suspira', LoadTap: 'gesto: golpea el pie', LoadingExit: 'guarda el portátil',
      LoadingToSuccess: 'carga → éxito', LoadingToError: 'carga → error', SleepEnter: 'se duerme', Sleep: 'durmiendo (bucle)',
      SleepSnuggle: 'gesto: se acurruca', SleepTwitch: 'gesto: mueve el pie', Wake: 'se despierta' }
  };
  const nowEl = document.getElementById('riveNow'), nowLabel = document.getElementById('riveNowLabel');
  function showNow(name) {
    const lang = (document.documentElement.lang || 'fr').slice(0, 2), L = NOW[lang] || NOW.fr;
    if (!nowEl) return;
    nowEl.textContent = name;
    nowLabel.textContent = L[name] || '';
    nowLabel.classList.toggle('is-gesture', /^(Idle|Think|Load|Sleep)[A-Z]/.test(name) && !/(Enter|Exit|To)/.test(name));
  }

  // ---------- runtime ----------
  const input = n => uko && uko.stateMachineInputs('Uko').find(i => i.name === n);
  // Loops on their own layers (blink, antenna, ear flick, tail sway): not a state.
  const LAYER_LOOPS = ['Blink', 'Antenna', 'Ears', 'TailSway'];
  const STATES = { idle: 0, thinking: 1, loading: 2, sleep: 3 };
  const argb = hex => (0xFF000000 | parseInt(hex.slice(1), 16)) >>> 0;
  // After a (re)load: same state and same colours as the controls show.
  function restoreControls() {
    const on = section.querySelector('[data-rstate][aria-pressed="true"]');
    const st = input('state'); if (st && on) st.value = STATES[on.dataset.rstate];
    if (!uko.viewModelInstance) return;
    section.querySelectorAll('[data-rcolor][aria-pressed="true"]:not([hidden])').forEach(b => {
      const [prop, hex] = b.dataset.rcolor.split(':');
      try { uko.viewModelInstance.color(prop).value = argb(hex); } catch (e) { /* not in this file */ }
    });
  }
  function load() {
    uko = new rive.Rive({
        src: `/rive/${file}.riv`,
        canvas,
        stateMachines: 'Uko',
        autoplay: visible,
        autoBind: true,
        layout: new rive.Layout({ fit: rive.Fit.Contain, alignment: rive.Alignment.Center }),
        onLoad: () => { uko.resizeDrawingSurfaceToCanvas(); status.textContent = ''; section.classList.add('rive-ready'); restoreControls(); },
        // Shows which of the file's animations is playing: gestures play by themselves
        // inside the states (the inputs stay the same).
        onStateChange: e => { const s = (e.data || []).filter(n => !LAYER_LOOPS.includes(n)).pop(); if (s) showNow(s); },
        onLoadError: () => { status.textContent = (window.ukoT || (k => k))('riveFileErrorChar', { file: `${file}.riv` }); }
      });
  }
  function start() {
    if (loading) return;
    loading = true;
    status.textContent = (window.ukoT || (k => k))('riveLoading');
    const s = document.createElement('script');
    s.src = '/rive/rive.js';
    s.onload = () => {
      rive.RuntimeLoader.setWasmUrl('/rive/rive.wasm');
      load();
    };
    s.onerror = () => { status.textContent = (window.ukoT || (k => k))('riveRuntimeError'); };
    document.head.appendChild(s);
  }
  new IntersectionObserver(entries => entries.forEach(e => {
    visible = e.isIntersecting;
    if (visible) start();
    if (uko) visible ? uko.play() : uko.pause();
  }), { rootMargin: '300px 0px' }).observe(section);
  addEventListener('resize', () => uko && uko.resizeDrawingSurfaceToCanvas());

  // ---------- controls ----------
  // One file per character: swap the file, keep the state and the colours.
  section.querySelectorAll('[data-rchar]').forEach(b => b.addEventListener('click', () => {
    if (file === b.dataset.rchar) return;
    file = b.dataset.rchar;
    section.querySelectorAll('[data-rchar]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    section.querySelectorAll('[data-for]').forEach(x => { x.hidden = x.dataset.for !== file; });
    renderCode();
    callEl.textContent = `new Rive({ src: '/${file}.riv', stateMachines: 'Uko' })`;
    if (uko) { uko.cleanup(); load(); }
  }));
  section.querySelectorAll('[data-rstate]').forEach(b => b.addEventListener('click', () => {
    const i = input('state'); if (!i) return;
    i.value = STATES[b.dataset.rstate];
    section.querySelectorAll('[data-rstate]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    callEl.textContent = `input('state').value = ${STATES[b.dataset.rstate]}`;
  }));
  let triggerTimer = null;
  section.querySelectorAll('[data-rtrigger]').forEach(b => b.addEventListener('click', () => {
    const name = b.dataset.rtrigger;
    // One-shots play over the current state; after a loading, go back to idle first.
    const st = input('state');
    if (st && st.value === 2 && (name === 'success' || name === 'error')) {
      st.value = 0;
      section.querySelectorAll('[data-rstate]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.rstate === 'idle')));
    }
    const i = input(name); if (i) i.fire();
    callEl.textContent = `input('${name}').fire()`;
    // A trigger plays once: it stays lit while its animation plays, like the other chips.
    section.querySelectorAll('[data-rtrigger]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    clearTimeout(triggerTimer);
    triggerTimer = setTimeout(() => b.setAttribute('aria-pressed', 'false'), 3800);
  }));
  section.querySelectorAll('[data-rcolor]').forEach(b => b.addEventListener('click', () => {
    if (!uko || !uko.viewModelInstance) return;
    const [prop, hex] = b.dataset.rcolor.split(':');
    uko.viewModelInstance.color(prop).value = argb(hex);
    section.querySelectorAll(`[data-rcolor^="${prop}:"]`).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    callEl.textContent = `viewModelInstance.color('${prop}').value = 0xFF${hex.slice(1).toUpperCase()}`;
  }));
})();
