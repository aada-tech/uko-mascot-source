#!/usr/bin/env node
// Original soundtrack for the presentation video, synthesized from scratch (no samples,
// no licence to clear): a light 100 BPM groove + UI sounds on the composition's cues.
//   const wav = require('./audio.cjs').soundtrack(duration, cues)   → 16-bit stereo WAV buffer
const SR = 44100, TAU = Math.PI * 2;

function soundtrack(duration, cues) {
  const N = Math.ceil((duration + .5) * SR);
  const L = new Float32Array(N), R = new Float32Array(N), FX = new Float32Array(N);
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const noise = () => rand() * 2 - 1;
  const hz = midi => 440 * Math.pow(2, (midi - 69) / 12);
  const expd = (t, k) => Math.exp(-t * k);
  const att = (t, a) => Math.min(1, t / a);
  function add(t0, dur, fn, gain = 1, pan = 0, send = 0) {
    const i0 = Math.max(0, Math.floor(t0 * SR)), n = Math.floor(dur * SR);
    const gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
    for (let i = 0; i < n && i0 + i < N; i++) {
      const v = fn(i / SR);
      L[i0 + i] += v * gl; R[i0 + i] += v * gr;
      if (send) FX[i0 + i] += v * send * gain;
    }
  }
  // instruments
  const kick = t => Math.sin(TAU * (45 * t + 75 / 18 * (1 - Math.exp(-t * 18)))) * expd(t, 9);
  const snare = () => { let lp = 0; return t => { const n = noise(); lp += (n - lp) * .5; return ((n - lp) * .9 + Math.sin(TAU * 190 * t) * .3) * expd(t, 22); }; };
  const hat = () => { let lp = 0; return t => { const n = noise(); lp += (n - lp) * .35; return (n - lp) * expd(t, 70); }; };
  const bass = f => t => (Math.sin(TAU * f * t) + .3 * Math.sin(TAU * 2 * f * t)) * att(t, .008) * expd(t, 4);
  const pluck = f => t => (Math.sin(TAU * f * t) * .9 + Math.sin(TAU * 2 * f * t) * .25 + Math.sin(TAU * 3.01 * f * t) * .08) * att(t, .004) * expd(t, 7);
  const pad = f => t => { let v = 0; for (let h = 1; h <= 5; h++) v += Math.sin(TAU * f * h * t + h) / (h * h); return v * att(t, .6); };
  const bell = f => t => (Math.sin(TAU * f * t) + .5 * Math.sin(TAU * f * 2.76 * t) * expd(t, 9)) * att(t, .003) * expd(t, 5);
  const pop = t => Math.sin(TAU * (500 + 700 * expd(t, 30)) * t) * expd(t, 28);
  const tick = t => noise() * expd(t, 260) * .8 + Math.sin(TAU * 2400 * t) * expd(t, 200) * .3;

  // groove: C  Am  F  G, drums from 1 s to 3 s before the end
  const BPM = 100, beat = 60 / BPM, bar = beat * 4;
  const CHORDS = [[48, [60, 64, 67]], [45, [57, 60, 64]], [41, [53, 57, 60, 65]], [43, [55, 59, 62]]];
  const gIn = 1.0, gOut = duration - 3.2;
  for (let b = 0; b * bar < duration; b++) {
    const t0 = b * bar, [root, tones] = CHORDS[b % 4];
    add(t0, bar + .6, t => pad(hz(tones[0] - 12))(t) * .5 + pad(hz(tones[1] - 12))(t) * .4 + pad(hz(tones[2] - 12))(t) * .35, .05, 0, .2);
    for (let k = 0; k < 8; k++) {
      const t = t0 + k * beat / 2;
      if (t < gIn || t > gOut) continue;
      if (k % 4 === 0) add(t, .45, kick, .7);
      if (k % 4 === 2) add(t, .25, snare(), .22, .05, .12);
      add(t, .06, hat(), k % 2 ? .09 : .05, .3);
      if (k % 2 === 0) add(t, beat * .9, bass(hz(root - 12 + (k % 4 === 2 ? 12 : 0))), .32);
      // light arpeggio on the off-beats
      if (k % 2 === 1) add(t, .4, pluck(hz(tones[(k >> 1) % tones.length] + 12)), .07, (k % 4 === 1 ? -.35 : .35), .25);
    }
  }
  // end: a final chord
  add(duration - 3.1, 3.0, t => (pluck(hz(72))(t) + pluck(hz(76))(t) + pluck(hz(79))(t)) * expd(t, 1.2), .12, 0, .4);

  // UI sounds on the cues
  for (const c of cues) {
    if (c.type === 'pop') add(c.t, .2, pop, .22, rand() * .6 - .3);
    else if (c.type === 'bell') add(c.t, 1.2, bell(hz(84)), .12, .2, .4);
    else if (c.type === 'soft') add(c.t, 1.0, bell(hz(72)), .08, -.2, .4);
    else if (c.type === 'success') [0, 4, 7, 12].forEach((s, i) => add(c.t + i * .07, 1.0, bell(hz(79 + s)), .1, (i - 1.5) * .25, .4));
    else if (c.type === 'error') [0, -3].forEach((s, i) => add(c.t + i * .14, .5, pluck(hz(60 + s)), .16, 0, .2));
    else if (c.type === 'type') for (let t = c.t; t < c.until; t += .055 + rand() * .05) add(t, .03, tick, .05, rand() * .4 - .2);
  }

  // echo on the send bus, then master (soft clip, fade out)
  const d = Math.floor(beat * .75 * SR);
  for (let i = d; i < N; i++) { FX[i] += FX[i - d] * .35; L[i] += FX[i - d] * .5; R[i] += FX[i - d] * .5; }
  let peak = 0;
  for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const g = .85 / (peak || 1);
  const buf = Buffer.alloc(44 + N * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
  const fadeOut = Math.floor(.8 * SR);
  for (let i = 0; i < N; i++) {
    const f = Math.min(1, (N - i) / fadeOut) * Math.min(1, i / (.05 * SR));
    const s = v => Math.round(Math.tanh(v * g * 1.1) * f * 32767);
    buf.writeInt16LE(s(L[i]), 44 + i * 4); buf.writeInt16LE(s(R[i]), 46 + i * 4);
  }
  return buf;
}

module.exports = { soundtrack };
