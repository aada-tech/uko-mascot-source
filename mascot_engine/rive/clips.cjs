// Clip recipes shared by extract_frames.cjs (baking) and test_rive_parity.cjs (checks).
// Each clip: how to reach its start, then how long to record (ms).
// "loop" clips are closed seamlessly later (drift correction). The life layer runs
// without random beats and with loop-friendly rates (every period divides its loop);
// its gestures are baked as separate clips that the state machine chains.
const RATES = {
  idle: { sway: 8, drift: 4 },
  thinking: { breath: 3.6, sway: 7.2, drift: 3.6, chinBurst: 2.4, chinTap: 10 / 3 },
  loading: { breath: 3.6, sway: 7.2, drift: 3.6, type: 5, nod: 2.5, typeRot: 1.25, typing: [2000, 400] },
  sleep: { breath: 3.9, sway: 7.8, drift: 7.8 }
};
const IN = s => [['wait', 1000], ['state', s], ['until', 'entered']];
const GESTURE = (name, base, beat, side, ms) => ({ name, base, pre: base === 'idle' ? [['wait', 1000], ['beat', beat, side]] : [...IN(base), ['beat', beat, side]], rec: ms });
const CLIPS = [
  { name: 'Idle',            loop: true, base: 'idle', pre: [['wait', 1000]],                                   rec: 8000 },
  { name: 'Welcome',         pre: [['wait', 1000], ['state', 'welcome']],                                   rec: 3200 + 700 },
  { name: 'Success',         pre: [['wait', 1000], ['state', 'success']],                                   rec: 3600 + 700 },
  { name: 'Error',           pre: [['wait', 1000], ['state', 'error']],                                     rec: 3800 + 700 },
  { name: 'Empty',           pre: [['wait', 1000], ['state', 'empty']],                                     rec: 3400 + 700 },
  { name: 'ThinkingEnter',   base: 'thinking', pre: [['wait', 1000], ['state', 'thinking']],                rec: 'entered' },
  { name: 'Thinking',        loop: true, base: 'thinking', pre: IN('thinking'),                             rec: 7200 },
  { name: 'ThinkingExit',    base: 'thinking', pre: [...IN('thinking'), ['state', 'idle']],                 rec: 900 },
  { name: 'LoadingEnter',    base: 'loading', pre: [['wait', 1000], ['state', 'loading']],                  rec: 'entered' },
  { name: 'Loading',         loop: true, base: 'loading', pre: IN('loading'),                              rec: 7200 },
  { name: 'LoadingExit',     base: 'loading', pre: [...IN('loading'), ['state', 'idle']],                   rec: 900 },
  { name: 'LoadingToSuccess', base: 'loading', pre: [...IN('loading'), ['state', 'success']],               rec: 3600 + 700 },
  { name: 'LoadingToError',  base: 'loading', pre: [...IN('loading'), ['state', 'error']],                  rec: 3800 + 700 },
  { name: 'SleepEnter',      base: 'sleep', pre: [['wait', 1000], ['state', 'sleep']],                      rec: 'entered' },
  { name: 'Sleep',           loop: true, base: 'sleep', pre: IN('sleep'),                                   rec: 7800 },
  { name: 'Wake',            pre: [...IN('sleep'), ['wake']],                                               rec: 2200 + 700 },
  // Gestures (life layer), each from the start of its base loop.
  GESTURE('IdleGlance', 'idle', 'glance', 1, 1700),
  GESTURE('IdleLookUp', 'idle', 'lookUp', -1, 1900),
  GESTURE('IdleShrug', 'idle', 'shrug', 1, 1200),
  GESTURE('IdleTap', 'idle', 'tap', 1, 1500),
  GESTURE('ThinkPonderL', 'thinking', 'ponder', -1, 2300),
  GESTURE('ThinkPonderR', 'thinking', 'ponder', 1, 2300),
  GESTURE('ThinkScratch', 'thinking', 'scratch', 1, 2200),
  GESTURE('ThinkNod', 'thinking', 'nod', 1, 1300),
  GESTURE('LoadCheck', 'loading', 'check', 1, 1400),
  GESTURE('LoadLean', 'loading', 'lean', 1, 1800),
  GESTURE('LoadPeek', 'loading', 'peek', 1, 1600),
  GESTURE('LoadSigh', 'loading', 'sigh', 1, 1700),
  GESTURE('LoadTap', 'loading', 'tap', 1, 1500),
  GESTURE('SleepSnuggle', 'sleep', 'snuggle', 1, 2400),
  GESTURE('SleepTwitch', 'sleep', 'twitch', 1, 900),
];

module.exports = { CLIPS, RATES };
