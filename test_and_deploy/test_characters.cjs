#!/usr/bin/env node
// Aituko and Meowuko: same skeleton as Uko, so every state must read as clearly.
//  - a raised hand that is not touching the head keeps its elbow and forearm
//    outside the head silhouette (robot box, cat ears), as on Uko
//  - no joint leaves the 1024×1536 frame, no NaN, no error, in any state
//  - the Starter edition has the three characters (4 states)
//   node mascot_engine/build_mascot_engine.js --debug && node test_and_deploy/test_characters.cjs
const path = require('path');
let puppeteer;
try { puppeteer = require('puppeteer'); } catch (e) { puppeteer = require(path.join(__dirname, '..', '..', 'node_modules', 'puppeteer')); }
const ROOT = path.join(__dirname, '..');
const ENGINE = path.join(ROOT, 'mascot_engine/dist/uko-mascot-engine.debug.js');
const STARTER = path.join(ROOT, 'mascot_engine/dist/starter/uko-mascot-engine.js');

(async () => {
  const b = await puppeteer.launch({ headless: 'new' });
  const p = await b.newPage();
  const pageErrors = [];
  p.on('pageerror', e => pageErrors.push(e.message));
  await p.goto('about:blank');
  await p.addScriptTag({ path: ENGINE });
  const res = await p.evaluate(() => {
    const out = {};
    const HOLD = { idle: 6000, thinking: 6000, loading: 6000, sleep: 5000 };
    for (const character of ['uko', 'aituko', 'meowuko']) {
      const row = out[character] = { frames: 0, hiddenElbow: {}, hiddenForearm: {}, outside: 0, bad: 0 };
      for (const state of UkoMascot.ORDER) {
        document.body.innerHTML = '<div id="m" style="width:240px;height:360px"></div>';
        const m = UkoMascot.create('#m', { character, hairStyle: 'original', interactive: false, oneShotMode: 'loop' });
        m.pause(); m.step(0);
        if (state !== 'idle') m.setState(state);
        const dur = HOLD[state] || UkoMascot.DUR[state];
        const dbg = m._debug();
        for (let t = 0; t < dur; t += 50) {
          m.step(50);
          const f = dbg.frame, q = f.pose, hc = q.head_center, s = q.head_radius / 185, a = -(f.rot || 0) * Math.PI / 180;
          const local = pt => { const dx = (pt[0] - hc[0]) / s, dy = (pt[1] - hc[1]) / s; return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)]; };
          const dist = pt => dbg.silhouette(...local(pt));
          row.frames++;
          for (const k of Object.keys(q)) if (Array.isArray(q[k])) {
            if (!Number.isFinite(q[k][0]) || !Number.isFinite(q[k][1])) row.bad++;
            else if (q[k][0] < -40 || q[k][0] > 1064 || q[k][1] < -40 || q[k][1] > 1440) row.outside++;
          }
          if (state === 'sleep' || state === 'wake') continue;
          for (const side of ['L', 'R']) {
            const h = q[`hand_${side}_center`], e = q[`elbow_${side}`], w = q[`wrist_${side}`];
            const raised = h[1] < q.neck[1] - 40;
            const onHead = Math.hypot(h[0] - hc[0], h[1] - hc[1]) < q.head_radius + 34;
            if (!raised || onHead) continue;
            if (dist(e) < 0) row.hiddenElbow[state] = (row.hiddenElbow[state] || 0) + 1;
            const mid = [(e[0] + w[0]) / 2, (e[1] + w[1]) / 2];
            if (dist(mid) < 0 && dist(w) < 0) row.hiddenForearm[state] = (row.hiddenForearm[state] || 0) + 1;
          }
        }
        m.destroy();
      }
    }
    return out;
  });
  await p.close();

  const sp = await b.newPage();
  await sp.goto('about:blank');
  await sp.addScriptTag({ path: STARTER });
  const starter = await sp.evaluate(() => {
    document.body.innerHTML = '<div id="m" style="width:240px;height:360px"></div>';
    const m = UkoMascot.create('#m', { character: 'aituko', interactive: false });
    return { list: UkoMascot.CHARACTERS, got: m.getCharacter() };
  });
  await b.close();

  let fail = 0;
  const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) fail++; };
  for (const [ch, r] of Object.entries(res)) {
    const he = Object.entries(r.hiddenElbow).map(([s, n]) => `${s} ${n}`).join(', ');
    const hf = Object.entries(r.hiddenForearm).map(([s, n]) => `${s} ${n}`).join(', ');
    if (ch === 'uko') { console.log(`info uko (reference, original hair) · ${r.frames} frames · hidden elbow: ${he || 'none'}`); continue; }
    check(!he, `${ch}: raised arms keep the elbow outside the head (${r.frames} frames)${he ? ' — ' + he : ''}`);
    check(!hf, `${ch}: raised forearms stay visible${hf ? ' — ' + hf : ''}`);
    check(!r.bad && !r.outside, `${ch}: every joint finite and inside the frame${r.bad || r.outside ? ` — ${r.bad} NaN, ${r.outside} outside` : ''}`);
  }
  check(!pageErrors.length, `no page error${pageErrors.length ? ' — ' + pageErrors[0] : ''}`);
  check(JSON.stringify(starter.list) === '["uko","aituko","meowuko"]' && starter.got === 'aituko', `Starter edition: the three characters (asked aituko → ${starter.got})`);
  console.log(fail ? `${fail} FAILED` : 'ALL PASS');
  process.exit(fail ? 1 : 0);
})();
