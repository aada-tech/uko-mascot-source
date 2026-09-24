// Builds the six .riv files (full pack + Starter, for Uko, Aituko and Meowuko):
// frames are extracted from the web engine (dist/uko-mascot-engine.debug.js), then baked.
//   node mascot_engine/rive/build_all_rive.cjs      (after npm run build:engine)
const { execFileSync } = require('child_process');
const path = require('path');
const run = (file, args) => execFileSync(process.execPath, [path.join(__dirname, file), ...args], { stdio: 'inherit' });
for (const c of ['uko', 'aituko', 'meowuko']) {
  const ch = c === 'uko' ? [] : ['--character', c];
  run('extract_frames.cjs', ch);
  run('build_uko_rive.cjs', ch);
  run('build_uko_rive.cjs', [...ch, '--starter']);
}
