#!/usr/bin/env node
// Packages what customers get:
//   node build_mascot_engine.js && node rive/build_uko_rive.cjs && node build_pack.cjs
//     → dist/Uko-Mascot-Pack-<version>.zip (sold)
//   node build_mascot_engine.js --starter && node rive/build_uko_rive.cjs --starter && node build_pack.cjs --starter
//     → dist/Uko-Starter-<version>.zip (free download). Same file names as the full pack,
//       so upgrading is a drop-in replacement of the engine and the .riv files.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const STARTER = process.argv.includes('--starter');
const { version } = require('./package.json');
const NAME = STARTER ? `Uko-Starter-${version}` : `Uko-Mascot-Pack-${version}`;
const WORK = path.join(ROOT, 'dist', STARTER ? 'pack-starter' : 'pack');
const STAGE = path.join(WORK, NAME);
const ZIP = path.join(ROOT, 'dist', `${NAME}.zip`);
const DOCS = STARTER ? 'pack-starter' : 'pack';
const SITE = (process.env.UKO_SITE_URL || JSON.parse(fs.readFileSync(path.join(ROOT, '..', 'landing_page', 'legal.config.json'), 'utf8')).SITE_URL || '').replace(/\/$/, '');

// One Rive file per character (same state machine and inputs in each).
const CHARACTERS = ['uko', 'aituko', 'meowuko'];
const files = { [STARTER ? 'dist/starter/uko-mascot-engine.js' : 'dist/uko-mascot-engine.js']: 'uko-mascot-engine.js' };
for (const c of CHARACTERS) {
  const src = STARTER ? `dist/starter/${c}-starter.riv` : `dist/${c}.riv`;
  files[src] = `rive/${c}.riv`; files[`${src}.json`] = `rive/${c}.riv.json`;
}
for (const f of Object.keys(files)) if (!fs.existsSync(path.join(ROOT, f))) { console.error(`missing ${f} — build it first`); process.exit(1); }
if (STARTER && !fs.readFileSync(path.join(ROOT, 'dist/starter/uko-mascot-engine.js'), 'utf8').includes('const EDITION = "starter"')) {
  console.error('dist/starter/uko-mascot-engine.js is not a starter build'); process.exit(1);
}

fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(path.join(STAGE, 'rive'), { recursive: true });
const copy = (from, to) => { fs.mkdirSync(path.dirname(path.join(STAGE, to)), { recursive: true }); fs.copyFileSync(path.join(ROOT, from), path.join(STAGE, to)); };
for (const [from, to] of Object.entries(files)) copy(from, to);
// README.md (French) plus its translations (README.en.md, README.es.md) when the edition has them
const READMES = fs.readdirSync(path.join(ROOT, DOCS)).filter(f => /^README(\.[a-z]{2})?\.md$/.test(f));
for (const f of [...READMES, 'LICENSE.md']) copy(`${DOCS}/${f}`, f);
copy('pack/CHANGELOG.md', 'CHANGELOG.md');
for (const f of fs.readdirSync(path.join(ROOT, DOCS, 'examples'))) copy(`${DOCS}/examples/${f}`, `examples/${f}`);
for (const f of READMES) {
  const readme = path.join(STAGE, f);
  fs.writeFileSync(readme, fs.readFileSync(readme, 'utf8').replaceAll('{{SITE_URL}}', SITE));
}

fs.rmSync(ZIP, { force: true });
execFileSync('zip', ['-qrX', ZIP, NAME], { cwd: WORK });
const list = execFileSync('unzip', ['-l', ZIP]).toString().trim().split('\n');
console.log(list.slice(3, -2).map(l => l.trim().split(/\s+/).slice(3).join(' ')).join('\n'));
console.log(`${path.relative(process.cwd(), ZIP)}  ${(fs.statSync(ZIP).size / 1024).toFixed(0)} KB`);
