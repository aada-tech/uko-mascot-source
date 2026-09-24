#!/usr/bin/env node
// Films the REAL SubFlow app (with Uko integrated) on a phone-sized viewport.
// Each scene is scripted like a real user (visible finger, typing, taps) and
// captured with the Chrome screencast, then resampled to constant 30 fps JPEGs:
//   clips/<scene>/00000.jpg … + clips/<scene>/events.json (timed cues for the edit)
//
//   (SubFlow running on http://localhost:3000, production build)
//   node marketing/subflow-ad/record_clips.cjs [scene…]
const fs = require('fs');
const path = require('path');
let puppeteer;
try { puppeteer = require('puppeteer'); } catch (e) { puppeteer = require(path.join(__dirname, '..', '..', '..', 'node_modules', 'puppeteer')); }

const BASE = process.env.SUBFLOW_URL || 'http://localhost:3000';
const OUT = process.env.CLIPS_OUT || path.join(__dirname, 'clips');
// App language of the recording (fr, en, es): profile language, typed texts, targets.
const LANG = process.env.CLIP_LANG || 'fr';
const L = {
  fr: { name: 'Camille', gym: 'Salle de sport', simulator: 'Simulateur', assistant: /résiliation/i },
  en: { name: 'Emma', gym: 'Climbing club', simulator: 'What-If', assistant: /cancellation/i },
  es: { name: 'Lucía', gym: 'Gimnasio', simulator: 'Simulador', assistant: /baja/i }
}[LANG];
const FPS = 30, W = 390, H = 844, DPR = 2;
// Slow-motion capture: the app runs 4× slower (JS clocks + CSS animations) while
// screenshots are taken back to back, so every output frame is sharp (DPR 2).
const RATE = 0.25;

// Injected before any app script: scales performance.now, Date, rAF timestamps
// and timers by RATE. CSS animations are slowed through the Animation domain.
const SLOWMO = `
(() => {
  const R = ${RATE};
  const pn = performance.now.bind(performance), base = pn();
  const vnow = () => base + (pn() - base) * R;
  performance.now = vnow;
  const OD = Date, dn = OD.now, d0 = dn();
  const vdate = () => d0 + (dn() - d0) * R;
  function D(...a) { if (!new.target) return new OD(vdate()).toString(); return a.length ? new OD(...a) : new OD(vdate()); }
  D.prototype = OD.prototype; D.now = vdate; D.parse = OD.parse; D.UTC = OD.UTC;
  window.Date = D;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(() => cb(vnow()));
  const st = window.setTimeout.bind(window), si = window.setInterval.bind(window);
  window.setTimeout = (f, ms = 0, ...a) => st(f, (ms || 0) / R, ...a);
  window.setInterval = (f, ms = 0, ...a) => si(f, (ms || 0) / R, ...a);
})();`;

const iso = d => d.toISOString().slice(0, 10);
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return iso(d); };
const sub = (id, name, amount, category, startOffset, cycle = 'Monthly') => ({
  id, name, amount, category, cycle, startDate: day(startOffset), status: 'active', currency: 'EUR', currencySymbol: '€'
});
const profile = (extra = {}) => ({ id: 'usr-demo', name: L.name, language: LANG, email: '', currency: 'EUR', currencySymbol: '€', countryCode: 'FR', spendingGoal: 0, monthlyIncome: 0, isIncomeConfigured: false, themeMode: 'light', ...extra });
const seed = (subscriptions, prof = profile()) => ({ state: { subscriptions, profile: prof, isAmountBlurred: false, hasCompletedOnboarding: true, storageMode: 'local', googleClientId: null }, version: 0 });

const FAMILY = [
  sub('s-netflix', 'Netflix', 13.49, 'Entertainment', 12),
  sub('s-spotify', 'Spotify', 11.12, 'Entertainment', 5),
  sub('s-basicfit', 'Basic-Fit', 29.99, 'Health & Fitness', 9),
  sub('s-canal', 'Canal+', 27.99, 'Entertainment', 18),
  sub('s-icloud', 'iCloud+', 2.99, 'Utilities', 21),
];

// Finger overlay injected in every page: a translucent touch dot that glides
// to its target, presses, and fades out — reads like a screen recording.
const FINGER = `
(() => {
  const make = () => {
    if (document.getElementById('__finger')) return;
    const d = document.createElement('div');
    d.id = '__finger';
    d.style.cssText = 'position:fixed;left:195px;top:900px;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;' +
      'background:rgba(30,30,30,.22);border:2.5px solid rgba(255,255,255,.95);box-shadow:0 3px 14px rgba(0,0,0,.28);' +
      'pointer-events:none;z-index:2147483647;opacity:0;transform:scale(1);transition:opacity .2s ease, transform .14s ease;';
    document.body.appendChild(d);
    window.__finger = {
      moveTo(x, y, ms) {
        d.style.transition = 'left ' + ms + 'ms cubic-bezier(.25,.8,.25,1), top ' + ms + 'ms cubic-bezier(.25,.8,.25,1), opacity .2s ease, transform .14s ease';
        d.style.opacity = '1'; d.style.left = x + 'px'; d.style.top = y + 'px';
      },
      press() { d.style.transform = 'scale(.72)'; setTimeout(() => { d.style.transform = 'scale(1)'; }, 150); },
      hide() { d.style.opacity = '0'; }
    };
  };
  if (document.body) make(); else document.addEventListener('DOMContentLoaded', make);
})();`;

const wait = ms => new Promise(r => setTimeout(r, ms));

async function scene(browser, name, storage, url, script) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: DPR, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument((key, value) => { try { localStorage.setItem(key, value); } catch (e) {} }, 'subflow-storage-v2', JSON.stringify(storage));
  await page.evaluateOnNewDocument(SLOWMO);
  await page.evaluateOnNewDocument(FINGER);
  await page.goto(BASE + url, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('uko-mascot .uko-mascot-svg, uko-mascot svg'), { timeout: 20000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 400));

  const cdp = await page.createCDPSession();
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: RATE });
  const vnow = () => page.evaluate(() => performance.now());
  const frames = [];
  let recording = true;
  const v0 = await vnow();
  // Inputs never land in the middle of a capture (they would be dropped).
  let busy = Promise.resolve();
  const exclusive = (fn) => { const run = busy.then(fn); busy = run.catch(() => {}); return run; };
  const recorder = (async () => {
    while (recording) {
      await exclusive(async () => {
        const a = await vnow();
        const data = await page.screenshot({ type: 'jpeg', quality: 90, optimizeForSpeed: true, captureBeyondViewport: false, encoding: 'base64' });
        const b = await vnow();
        frames.push({ t: ((a + b) / 2 - v0) / 1000, data });
      });
    }
  })();
  const events = [];
  const mark = async (label) => events.push({ t: +(((await vnow()) - v0) / 1000).toFixed(3), label });

  // All waits are in app time (scaled to real time).
  const wait = ms => new Promise(r => setTimeout(r, ms / RATE));
  const box = async (finder) => page.evaluate(finder).then(r => r);
  const tap = async (finder, label, glide = 420) => {
    let r = await box(finder);
    for (let i = 0; !r && i < 20; i++) { await wait(150); r = await box(finder); }
    if (!r) { await page.screenshot({ path: path.join(OUT, `${name}-missing-${label}.png`) }); throw new Error(`${name}: target not found for ${label}`); }
    await page.evaluate((x, y, ms) => window.__finger.moveTo(x, y, ms), r.x, r.y, glide);
    await wait(glide + 120);
    await exclusive(async () => {
      await page.evaluate(() => window.__finger.press());
      await page.touchscreen.tap(r.x, r.y);
    });
    await mark(label);
  };
  const type = async (text, delay = 95) => { for (const ch of text) { await exclusive(() => page.keyboard.type(ch)); await wait(delay); } };
  const hideFinger = () => page.evaluate(() => window.__finger.hide());
  // Smooth scroll of the element's scrollable ancestor (or the page), driven by
  // requestAnimationFrame so it follows the slowed-down clock.
  const scrollTo = (finder, ms = 700) => page.evaluate((src, ms) => new Promise(res => {
    const el = new Function(src)();
    if (!el) return res(false);
    let box = el.parentElement;
    while (box && !(box.scrollHeight > box.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
    box = box || document.scrollingElement;
    const from = box.scrollTop, r = el.getBoundingClientRect(), br = box === document.scrollingElement ? { top: 0, height: innerHeight } : box.getBoundingClientRect();
    const to = Math.max(0, from + (r.top - br.top) - br.height * .45);
    const t0 = performance.now();
    const step = () => { const u = Math.min(1, (performance.now() - t0) / ms), e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; box.scrollTop = from + (to - from) * e; u < 1 ? requestAnimationFrame(step) : res(true); };
    requestAnimationFrame(step);
  }), finder, ms);

  await script({ page, tap, type, wait, mark, hideFinger, scrollTo });
  await wait(300);
  recording = false;
  await recorder;
  await ctx.close();

  // Resample to constant 30 fps (hold the last frame shown at each instant).
  const dir = path.join(OUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  frames.sort((a, b) => a.t - b.t);
  const start = 0, end = frames[frames.length - 1].t;
  const n = Math.floor((end - start) * FPS);
  let k = 0;
  for (let i = 0; i <= n; i++) {
    const t = start + i / FPS;
    while (k + 1 < frames.length && frames[k + 1].t <= t) k++;
    fs.writeFileSync(path.join(dir, String(i).padStart(5, '0') + '.jpg'), Buffer.from(frames[k].data, 'base64'));
  }
  fs.writeFileSync(path.join(dir, 'events.json'), JSON.stringify({ frames: n + 1, fps: FPS, events }, null, 2));
  console.log(`${name.padEnd(10)} ${n + 1} frames (${((n + 1) / FPS).toFixed(1)} s) · captured ${frames.length} · ${events.map(e => e.label).join(', ')}`);
}

// ---------------------------------------------------------------- targets
const dockAdd = () => { const b = [...document.querySelectorAll('nav[data-dock="main"] button, nav[aria-label="Navigation principale"] button')].find(x => /ajout|add|añad/i.test(x.getAttribute('aria-label') || '')); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
const byText = (text) => new Function(`const b=[...document.querySelectorAll('button,a')].filter(x=>x.offsetParent!==null).find(x=>(x.textContent||'').trim().replace(/\\s+/g,' ')===${JSON.stringify(text)}); if(!b) return null; const r=b.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};`);
const byTextStart = (text) => new Function(`const b=[...document.querySelectorAll('button,a,[role=button]')].filter(x=>x.offsetParent!==null).find(x=>(x.textContent||'').trim().replace(/\\s+/g,' ').startsWith(${JSON.stringify(text)})); if(!b) return null; const r=b.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};`);
const input = (i) => new Function(`const f=document.getElementById('sub-form'); const el=f&&f.querySelectorAll('input[type=text]')[${i}]; if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};`);
const submit = () => { const b = document.querySelector('button[type=submit][form="sub-form"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
const card = (name) => new Function(`const h=[...document.querySelectorAll('h3,h4,h5,span,p')].find(x=>(x.textContent||'').trim()===${JSON.stringify(name)}); if(!h) return null; let c=h; for(let i=0;i<6&&c;i++){ if(c.onclick||c.getAttribute('role')==='button'||c.tagName==='BUTTON'||getComputedStyle(c).cursor==='pointer') break; c=c.parentElement; } const r=(c||h).getBoundingClientRect(); return {x:r.x+r.width*0.35,y:r.y+r.height/2};`);
const themeBtn = () => { const b = document.querySelector('button[aria-label^="Cycle theme"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };

// ---------------------------------------------------------------- scenes
const bySel = (sel) => new Function(`const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};`);

const SCENES = {
  // Custom integration (not part of the pack): the companion looks at what matters, then
  // climbs onto the add form, naps on its edge, watches the fields, reacts to the verdict.
  custom: [seed([sub('s-netflix', 'Netflix', 13.49, 'Entertainment', 2), sub('s-spotify', 'Spotify', 11.12, 'Entertainment', 9)]), '/app', async ({ tap, type, wait, mark, hideFinger }) => {
    mark('gaze-pill'); await wait(3800);
    await tap(bySel('[data-uko-look="categories"]'), 'look-categories'); await hideFinger(); await wait(2000);
    await tap(dockAdd, 'open-modal'); await hideFinger(); mark('perch-walk'); await wait(8200);
    mark('perch-nap'); await wait(1900);
    await tap(input(0), 'focus-name'); await type(L.gym, 70); await wait(600);
    await tap(input(1), 'focus-amount'); await type('0', 120); await wait(300);
    await tap(submit, 'submit'); await hideFinger(); mark('error'); await wait(2600);
    await tap(input(1), 'fix-amount'); await type('29', 120); await wait(300);
    await tap(submit, 'submit-ok'); await hideFinger(); mark('success'); await wait(4400);
  }],
  // Empty list → Uko shrugs; add Netflix → Uko jumps; payment due today → Uko thinks.
  add: [seed([]), '/app', async ({ tap, type, wait, mark, hideFinger, page }) => {
    mark('empty'); await wait(3600);
    await tap(dockAdd, 'open-modal'); await wait(900);
    await tap(input(0), 'focus-name'); await type('Netf', 130); await wait(500);
    await tap(byText('Netflix'), 'preset-netflix'); await wait(900);
    await tap(submit, 'submit'); await hideFinger();
    mark('success'); await wait(4300);
    mark('thinking'); await wait(2200);
  }],
  // Invalid amount → Uko scratches its head inside the form.
  error: [seed([FAMILY[0]]), '/app', async ({ tap, type, wait, mark, hideFinger }) => {
    await wait(900);
    await tap(dockAdd, 'open-modal'); await wait(800);
    await tap(input(0), 'focus-name'); await type(L.gym, 70); await wait(300);
    await tap(input(1), 'focus-amount'); await type('0', 120); await wait(400);
    await tap(submit, 'submit'); await hideFinger();
    mark('error'); await wait(3600);
  }],
  // What-if: set subscriptions aside → the mini Uko celebrates each saving.
  simulate: [seed(FAMILY), '/subs', async ({ tap, wait, mark, hideFinger }) => {
    await wait(900);
    await tap(byTextStart(L.simulator), 'simulator'); mark('thinking'); await wait(1300);
    await tap(card('Basic-Fit'), 'exclude-basicfit'); mark('saving-1'); await wait(2300);
    await tap(card('Netflix'), 'exclude-netflix'); mark('saving-2'); await wait(2600);
    await hideFinger(); await wait(600);
  }],
  // Developer drives the mascot from code: attributes change → the app's Uko follows live.
  code: [seed(FAMILY.slice(0, 3)), '/app', async ({ page, wait, mark }) => {
    const set = (attrs) => page.evaluate((a) => { const el = document.querySelector('uko-mascot'); for (const [k, v] of Object.entries(a)) el.setAttribute(k, v); }, attrs);
    await wait(1200);
    await set({ state: 'loading' }); mark('state=loading'); await wait(3200);
    await set({ state: 'success' }); mark('state=success'); await wait(3400);
    await set({ brand: '#FFE08A', 'hair-color': '#B45309' }); mark('brand=#FFE08A'); await wait(1400);
    await set({ hair: 'boucles', state: 'welcome' }); mark('hair=boucles'); await wait(3400);
  }],
  // Calendar: every payment day at a glance; tap a day to see what leaves the account.
  calendar: [seed(FAMILY), '/schedule', async ({ tap, wait, mark, hideFinger }) => {
    await wait(1200);
    const busyDay = () => { const b = [...document.querySelectorAll('[data-day-count]')].find(x => +x.dataset.dayCount > 0); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
    await tap(busyDay, 'day'); mark('day'); await wait(2200);
    await tap(() => { const b = document.querySelector('button[data-nav="next-month"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, 'next-month'); await wait(1800);
    await hideFinger(); await wait(600);
  }],
  // Cancellation: open a subscription, the assistant prepares the letter.
  cancel: [seed(FAMILY), '/subs', async ({ tap, wait, mark, hideFinger, scrollTo }) => {
    await wait(1000);
    await tap(card('Canal+'), 'open-sub'); await wait(1100);
    const assistant = `return [...document.querySelectorAll('button')].find(b => ${L.assistant}.test(b.textContent || ''))`;
    await scrollTo(assistant, 900); await wait(400);
    await tap(new Function(`const b = [...document.querySelectorAll('button')].filter(x => x.offsetParent !== null).find(x => ${L.assistant}.test(x.textContent || '')); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };`), 'assistant'); mark('assistant'); await wait(1600);
    await hideFinger(); await wait(2600);
    await hideFinger(); await wait(500);
  }],
  // Theme: light → dark → pink, Uko adopts each palette.
  themes: [seed(FAMILY.slice(0, 3)), '/app', async ({ tap, wait, mark, hideFinger }) => {
    await wait(1400);
    await tap(themeBtn, 'dark'); mark('dark'); await wait(2300);
    await tap(themeBtn, 'pink'); mark('pink'); await wait(2300);
    await hideFinger(); await wait(700);
  }],
};

(async () => {
  const only = process.argv.slice(2);
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: 'new', args: ['--disable-gpu-vsync'] });
  for (const [name, [storage, url, script]] of Object.entries(SCENES)) {
    if (only.length && !only.includes(name)) continue;
    await scene(browser, name, storage, url, script);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
