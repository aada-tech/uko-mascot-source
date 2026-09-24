#!/usr/bin/env node
// Builds dist/uko-mascot-engine.js from src/. Self-contained: no path outside
// UKO_MASTER_PACK is read. Usage:
//   node mascot_engine/build_mascot_engine.js            → dist/ only
//   node mascot_engine/build_mascot_engine.js --publish  → also copies to landing_page/js/
//   node mascot_engine/build_mascot_engine.js --starter  → dist/starter/ (free edition: 4 states;
//     the other states' poses are not in the file, asking for them logs where to get them)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const here = __dirname;
const src = f => fs.readFileSync(path.join(here, 'src', f), 'utf8');
const indent = (code, n) => code.split('\n').map(l => (l ? ' '.repeat(n) + l : l)).join('\n');

const data = JSON.parse(src('data/poses.json'));
delete data.refs;
const css = src('styles.css').trim();
const version = JSON.parse(fs.readFileSync(path.join(here, 'package.json'), 'utf8')).version;
const DEBUG = process.argv.includes('--debug');
const STARTER = process.argv.includes('--starter');
const FULL_ORDER = ['idle', 'welcome', 'thinking', 'loading', 'success', 'error', 'empty', 'sleep', 'wake'];
const STARTER_ORDER = ['idle', 'welcome', 'loading', 'success'];
if (STARTER) for (const table of ['poses', 'keyframes', 'faceModes', 'headRot']) {
  for (const state of Object.keys(data[table])) if (!STARTER_ORDER.includes(state)) delete data[table][state];
}
const SITE = (process.env.UKO_SITE_URL || JSON.parse(fs.readFileSync(path.join(here, '..', 'landing_page', 'legal.config.json'), 'utf8')).SITE_URL || '').replace(/\/$/, '');

const MOVES_STUB = [
  'const MOVES = { climb: { dur: 1 }, climbOnto: { dur: 1 } };',
  'let MOVE_FRONT_ARMS = false;',
  'function climbPose() { return cpy(DATA.poses.idle); }',
  "function climbFace() { return 'idle'; }",
  'function climbRot() { return 0; }',
  'function climbOntoPose() { return cpy(DATA.poses.idle); }',
  "function climbOntoFace() { return 'idle'; }",
  'function climbOntoRot() { return 0; }'
].join('\n');

const instanceBody = [
  src('core/prelude.js'),
  src('legacy/rig.js'),
  src('core/hair-styles.js'),
  src('core/characters.js'),
  src('core/skeleton.js'),
  src('core/footwork.js'),
  src('core/celebration.js'),
  // Touch reactions (all editions) and the gaze with the body (lookAt / page follow).
  src('core/touch.js'),
  // The Starter does not ship the scripted moves (full pack only; the API says so).
  STARTER ? MOVES_STUB : src('core/moves.js'),
  src('core/life.js'),
  src('legacy/color.js'),
  src('core/runtime.js')
].join('\n');

const out = `/**
 * Uko Mascot Engine v${version} · vector runtime (SVG, 60 FPS)
 * Canonical fixed-length skeleton with soft IK, blended state transitions,
 * modular hairstyles with secondary motion, attention tracking, walk cycle,
 * WCAG contrast helpers. Each instance is fully isolated.
 *
 * Generated file — edit mascot_engine/src/ and run build_mascot_engine.js.
 * ${STARTER ? `Starter edition (free): idle, welcome, loading, success. Full pack: ${SITE}/#prix` : '(c) Uko UI — Commercial License'}
 */
(function (root) {
  'use strict';

  const DEBUG_BUILD = ${DEBUG};
  const DATA = ${JSON.stringify(data)};
  const EDITION = ${JSON.stringify(STARTER ? 'starter' : 'full')};
  const FULL_ORDER = ${JSON.stringify(FULL_ORDER)};
  const ORDER = ${JSON.stringify(STARTER ? STARTER_ORDER : FULL_ORDER)};
  // Characters sharing the skeleton (all three in both editions; the Starter has 4 states).
  const CHARACTER_LIST = ['uko', 'aituko', 'meowuko'];
  const FULL_PACK_URL = ${JSON.stringify(SITE + '/#prix')};
  const DUR = { idle: 4000, welcome: 3200, thinking: 1000, loading: 1000, success: 3600, error: 3800, empty: 3400, sleep: 2600, wake: 2200 };
  const MASCOT_SVG_STYLES = ${JSON.stringify(css)};

${indent(src('core/hair-catalog.js'), 2)}

  function createUkoMascot(target, userOptions) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) throw new Error('[UkoMascot] Container element not found.');

${indent(instanceBody, 4)}
  }

${indent(src('web-component.js'), 2)}

  root.UkoMascot = {
    version: ${JSON.stringify(version)},
    edition: EDITION,
    create: createUkoMascot,
    ORDER,
    DUR,
    HAIR_STYLES: HAIR_CATALOG,
    HAIR_ALIASES,
    CHARACTERS: CHARACTER_LIST,
  };
})(typeof window !== 'undefined' ? window : this);
`;

const distDir = path.join(here, 'dist', STARTER ? 'starter' : '');
fs.mkdirSync(distDir, { recursive: true });
const distFile = path.join(distDir, DEBUG ? 'uko-mascot-engine.debug.js' : 'uko-mascot-engine.js');
fs.writeFileSync(distFile, out, 'utf8');
const raw = Buffer.byteLength(out), gz = zlib.gzipSync(out, { level: 9 }).length;
console.log(`${path.relative(here, distFile)}  ${(raw / 1024).toFixed(1)} KB raw · ${(gz / 1024).toFixed(1)} KB gzip`);
if (!DEBUG && !STARTER) fs.writeFileSync(path.join(distDir, 'size.json'), JSON.stringify({ version, rawBytes: raw, gzipBytes: gz }, null, 2) + '\n');

if (process.argv.includes('--publish') && !DEBUG && !STARTER) {
  const target = path.join(here, '..', 'landing_page', 'js', 'uko-mascot-engine.js');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(distFile, target);
  console.log('published →', path.relative(path.join(here, '..'), target));
}
