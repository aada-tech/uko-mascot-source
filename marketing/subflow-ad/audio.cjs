#!/usr/bin/env node
// Original soundtrack for the ad, synthesized from scratch (no samples, no
// licence to clear): an upbeat 104 BPM groove + UI sounds placed on the cues
// exported by the composition (out/cues.json). Writes out/soundtrack.wav.
//   node marketing/subflow-ad/render_ad.cjs --cues && node marketing/subflow-ad/audio.cjs
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'out');
const LANG = process.argv[2] || 'fr';   // node audio.cjs fr|en|es (timings differ per language)
const { duration, cues } = JSON.parse(fs.readFileSync(path.join(OUT, `cues-${LANG}.json`), 'utf8'));
const SR = 44100, N = Math.ceil((duration + .4) * SR);
const L = new Float32Array(N), R = new Float32Array(N);
const FX = new Float32Array(N);                      // send bus for the echo
const TAU = Math.PI * 2;

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const noise = () => rand() * 2 - 1;
const hz = midi => 440 * Math.pow(2, (midi - 69) / 12);
function add(t0, dur, fn, gain = 1, pan = 0, send = 0) {
  const i0 = Math.max(0, Math.floor(t0 * SR)), n = Math.floor(dur * SR);
  const gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < n && i0 + i < N; i++) {
    const v = fn(i / SR);
    L[i0 + i] += v * gl; R[i0 + i] += v * gr;
    if (send) FX[i0 + i] += v * send * gain;
  }
}
const expd = (t, k) => Math.exp(-t * k);
const att = (t, a) => Math.min(1, t / a);

// ------------------------------------------------------------------ instruments
const kick = t => Math.sin(TAU * (45 * t + 75 / 18 * (1 - Math.exp(-t * 18)))) * expd(t, 9) * 1.1;
const snare = () => { let lp = 0; return t => { const n = noise(); lp += (n - lp) * .5; return ((n - lp) * .9 + Math.sin(TAU * 190 * t) * .35) * expd(t, 20); }; };
const hat = () => { let lp = 0; return t => { const n = noise(); lp += (n - lp) * .35; return (n - lp) * expd(t, 70); }; };
const bass = f => t => (Math.sin(TAU * f * t) + .35 * Math.sin(TAU * 2 * f * t) + .12 * Math.sin(TAU * 3 * f * t)) * att(t, .008) * expd(t, 4.5);
const pluck = f => t => (Math.sin(TAU * f * t) * .9 + Math.sin(TAU * 2 * f * t) * .25 + Math.sin(TAU * 3.01 * f * t) * .08) * att(t, .004) * expd(t, 7);
const pad = f => t => { let v = 0; for (let h = 1; h <= 5; h++) v += Math.sin(TAU * f * h * t + h) / (h * h); return v * att(t, .5); };
const bell = f => t => (Math.sin(TAU * f * t) + .5 * Math.sin(TAU * f * 2.76 * t) * expd(t, 9)) * att(t, .003) * expd(t, 5);

// ------------------------------------------------------------------ groove
const BPM = 104, beat = 60 / BPM, bar = beat * 4;
// F  Dm  Bb  C   (I vi IV V)
const CHORDS = [[53, [65, 69, 72]], [50, [62, 65, 69]], [46, [58, 62, 65, 70]], [48, [60, 64, 67]]];
const grooveStart = 3.25, grooveEnd = duration - 5.1;
const endStart = duration - 5.4;
for (let b = 0; b * bar < duration; b++) {
  const t0 = b * bar, [root, tones] = CHORDS[b % 4];
  const inGroove = t0 + bar > grooveStart && t0 < grooveEnd;
  // pad all along (quieter on the hook), fades on the end card
  add(t0, bar + .6, (t) => pad(hz(tones[0] - 12))(t) * .5 + pad(hz(tones[1] - 12))(t) * .4 + pad(hz(tones[2] - 12))(t) * .35, t0 < grooveStart ? .06 : .045, 0, .2);
  for (let k = 0; k < 8; k++) {
    const t = t0 + k * beat / 2;
    if (t < grooveStart || t > grooveEnd) continue;
    if (k % 4 === 0) add(t, .45, kick, .8);
    if (k === 6 && b % 2 === 1) add(t, .45, kick, .45);
    if (k % 4 === 2) add(t, .25, snare(), .32, .05, .15);
    add(t, .06, hat(), k % 2 ? .12 : .07, .3);
    // bass: root on the beat, octave on the "and" of 2 and 4
    const note = (k === 3 || k === 7) ? root + 12 : root;
    if (k !== 1 && k !== 5) add(t, beat * .5, bass(hz(note - 12)), .42);
    // pluck arpeggio
    const tone = tones[[0, 1, 2, 1, 0, 2, 1, 2][k] % tones.length] + (k > 4 ? 12 : 0);
    add(t, .6, pluck(hz(tone)), .11, k % 2 ? .35 : -.35, .35);
  }
  if (!inGroove && t0 >= grooveEnd && t0 < duration) {
    // end card: bright final chord
    for (const n of tones) add(t0, 2.6, bell(hz(n + 12)), .09, 0, .5);
  }
}

// ------------------------------------------------------------------ sound effects
const SFX = {
  tap: t0 => { add(t0, .03, t => Math.sin(TAU * 2100 * t) * expd(t, 160), .22, .1); add(t0, .02, () => noise() * .5, .05); },
  key: t0 => { const f = 2600 + rand() * 900; add(t0, .03, t => (Math.sin(TAU * f * t) * .4 + noise() * .6) * expd(t, 240), .09, .2); },
  whoosh: t0 => { let lp = 0; add(t0 - .18, .42, t => { const k = t / .42; const n = noise(); lp += (n - lp) * (.03 + .4 * k); return lp * Math.sin(Math.PI * k) * 2.2; }, .28, 0, .2); },
  success: t0 => [72, 76, 79, 84].forEach((n, i) => add(t0 + i * .075, .9, bell(hz(n + 12)), .12, (i - 1.5) * .3, .45)),
  confetti: t0 => { for (let i = 0; i < 9; i++) { const f = 3000 + rand() * 3500; add(t0 + rand() * .55, .06, t => Math.sin(TAU * f * t) * expd(t, 70), .06, rand() * 1.6 - .8, .4); } },
  error: t0 => { [67, 62].forEach((n, i) => add(t0 + i * .14, .22, t => Math.sign(Math.sin(TAU * hz(n - 12) * t)) * .5 * expd(t, 12) + Math.sin(TAU * hz(n - 12) * t) * .5 * expd(t, 10), .16, 0, .2)); },
  hmm: t0 => add(t0, .55, t => Math.sin(TAU * (230 + 12 * Math.sin(TAU * 5 * t)) * t) * Math.sin(Math.PI * t / .55), .12),
  coin: t0 => [83, 88].forEach((n, i) => add(t0 + i * .08, .5, bell(hz(n)), .1, .2, .3)),
  pop: t0 => add(t0, .09, t => Math.sin(TAU * (420 + 5200 * t) * t) * expd(t, 30), .18),
  slam: t0 => { add(t0, .4, kick, .9); let lp = 0; add(t0, .25, () => { const n = noise(); lp += (n - lp) * .2; return lp; }, .5); },
  boop: t0 => add(t0, .3, t => Math.sin(TAU * (620 - 900 * t) * t) * expd(t, 7), .16),
};
for (const c of cues) if (SFX[c.type]) SFX[c.type](c.t);

// ------------------------------------------------------------------ echo, master
const D = Math.floor(.231 * SR);
for (let i = D; i < N; i++) FX[i] += FX[i - D] * .38;
for (let i = 0; i < N; i++) { const e = FX[i] * .45; L[i] += e; R[i] += (i >= 300 ? FX[i - 300] : 0) * .45; }
let peak = 0;
for (let i = 0; i < N; i++) {
  const fadeIn = Math.min(1, i / (SR * .05)), fadeOut = Math.min(1, (N - i) / (SR * 1.2));
  L[i] = Math.tanh(L[i] * 1.2) * fadeIn * fadeOut; R[i] = Math.tanh(R[i] * 1.2) * fadeIn * fadeOut;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const gain = .89 / (peak || 1);
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * gain)) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * gain)) * 32767), 46 + i * 4);
}
fs.writeFileSync(path.join(OUT, `soundtrack-${LANG}.wav`), buf);
console.log(`out/soundtrack-${LANG}.wav  ${(N / SR).toFixed(1)} s · ${cues.length} sound cues · peak gain ${gain.toFixed(2)}`);
