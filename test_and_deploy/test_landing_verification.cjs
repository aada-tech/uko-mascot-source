#!/usr/bin/env node
// Smoke test of the landing page (landing_page/index.html).
//   python3 -m http.server 3333 --directory landing_page &
//   node test_and_deploy/test_landing_verification.cjs
// UKO_BASE_URL overrides the URL, UKO_QA_OUT the screenshot folder.
const fs = require('fs');
const path = require('path');
let puppeteer;
try { puppeteer = require('puppeteer'); } catch (e) { puppeteer = require(path.join(__dirname, '..', '..', 'node_modules', 'puppeteer')); }
const BASE_URL = process.env.UKO_BASE_URL || 'http://localhost:3333/index.html';
const OUT = process.env.UKO_QA_OUT || path.join(__dirname, 'output');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: 'new' });
  const failures = [];
  const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failures.push(msg); };

  for (const [w, h, label] of [[1280, 820, 'desktop'], [390, 844, 'mobile']]) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Permissions-Policy/.test(m.text())) errors.push(m.text()); });
    await page.setViewport({ width: w, height: h });
    await page.goto(BASE_URL, { waitUntil: 'load', timeout: 60000 });
    await new Promise(r => setTimeout(r, 1200));

    const info = await page.evaluate(() => ({
      mascots: document.querySelectorAll('.uko-mascot-svg').length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      buy: !!document.getElementById('buyPackBtn'),
      sale: document.getElementById('prix').dataset.sale,
      soonVisible: !!document.querySelector('#prix .soon') && getComputedStyle(document.querySelector('#prix .soon')).display !== 'none'
    }));
    check(info.mascots >= 7, `${label}: ${info.mascots} live mascots rendered`);
    check(info.overflow <= 0, `${label}: no horizontal overflow (${info.overflow}px)`);
    check(info.buy, `${label}: buy button present`);
    check(info.sale !== 'closed' || info.soonVisible, `${label}: sales closed → "Bientôt disponible" shown`);

    // Free first: the hero offers the free Starter (no price), the offers list it before the paid pack.
    const free = await page.evaluate(async () => {
      const cta = document.querySelector('.hero .cta-row .btn.primary');
      const offers = [...document.querySelectorAll('#prix .offer-name')].map(e => e.textContent.trim());
      const href = cta && cta.getAttribute('href');
      const zip = href ? await fetch(href, { method: 'HEAD' }).then(r => r.ok, () => false) : false;
      return { href, download: cta && cta.hasAttribute('download'), heroPrice: /€/.test(document.querySelector('.hero').textContent), offers, zip };
    });
    check(free.href === '/free/Uko-Starter.zip' && free.download, `${label}: hero button downloads the free Starter (${free.href})`);
    check(!free.heroPrice, `${label}: no price in the hero`);
    check(free.offers[0] === 'Starter' && free.offers.length === 2, `${label}: offers show the Starter first (${free.offers.join(' · ')})`);
    if (!/localhost:3333/.test(BASE_URL)) check(free.zip, `${label}: free Starter zip is served`);

    if (label === 'desktop') {
      const t1 = await page.evaluate(() => document.getElementById('film').ukoFilm.clock);
      await new Promise(r => setTimeout(r, 1500));
      const t2 = await page.evaluate(() => document.getElementById('film').ukoFilm.clock);
      check(t2 > t1, `desktop: hero film is playing (clock ${t1.toFixed(1)}s → ${t2.toFixed(1)}s)`);
      const cap = await page.$eval('.film-caption span', e => e.textContent);
      check(/uko/.test(cap), `desktop: film caption shows code (${cap})`);
      await page.click('.film-toggle');
      const t3 = await page.evaluate(() => document.getElementById('film').ukoFilm.clock);
      await new Promise(r => setTimeout(r, 600));
      const t4 = await page.evaluate(() => document.getElementById('film').ukoFilm.clock);
      check(t4 === t3, 'desktop: pause button stops the film');
      await page.click('.film-toggle');

      // One code section: Rive by default, the web engine behind the switch.
      const riveFirst = await page.$eval('.mode-switch .mode[aria-selected="true"]', e => e.dataset.mode);
      check(riveFirst === 'rive', `desktop: code section opens on Rive (${riveFirst})`);
      await page.click('.mode-switch .mode[data-mode="web"]');
      const before = await page.$eval('#moveCall', e => e.textContent);
      await page.click('#codeBox .val[data-key="state"]');
      const after = await page.$eval('#moveCall', e => e.textContent);
      check(before !== after, `desktop: code playground cycles state (${before} → ${after})`);
      await page.click('#engineTabs .tab[data-tab="react"]');
      const react = await page.$eval('#codeBox', e => e.innerText.includes('export default function'));
      check(react, 'desktop: React tab renders');

      // Endless gallery: drifts, stops on hover, opens the customisation dialog.
      await page.evaluate(() => document.getElementById('etats').scrollIntoView());
      await page.mouse.move(2, 2);   // not hovering a card (hover stops the drift)
      await new Promise(r => setTimeout(r, 900));
      const x1 = await page.$eval('#track', e => new DOMMatrix(getComputedStyle(e).transform).m41);
      await new Promise(r => setTimeout(r, 700));
      const x2 = await page.$eval('#track', e => new DOMMatrix(getComputedStyle(e).transform).m41);
      check(x1 !== x2, `desktop: gallery drifts (${x1} → ${x2})`);
      const cardsN = await page.$$eval('.combo-card', els => els.length);
      check(cardsN >= 7, `desktop: gallery has ${cardsN} live cards`);
      const box = await page.evaluate(() => { const m = document.getElementById('marquee').getBoundingClientRect(), cx = m.left + m.width / 2; const r = [...document.querySelectorAll('.combo-card')].map(e => e.getBoundingClientRect()).sort((a, b) => Math.abs(a.x + a.width / 2 - cx) - Math.abs(b.x + b.width / 2 - cx))[0]; return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
      await page.mouse.move(box.x, box.y);
      await new Promise(r => setTimeout(r, 900));
      const h1 = await page.$eval('#track', e => new DOMMatrix(getComputedStyle(e).transform).m41);
      await new Promise(r => setTimeout(r, 500));
      const h2 = await page.$eval('#track', e => new DOMMatrix(getComputedStyle(e).transform).m41);
      const focused = await page.$$eval('.combo-card.is-focus', els => els.length);
      // Stopped = moves less than half a pixel (the drift eases out, it does not snap).
      const tx = v => v;
      check(Math.abs(tx(h1) - tx(h2)) < 0.5 && focused === 1, `desktop: hover stops the drift and focuses one card (${h1} / ${h2}, focus=${focused})`);
      // Drag by hand: the track follows the pointer and a drag does not open the dialog.
      const tBefore = await page.$eval('#track', e => new DOMMatrix(getComputedStyle(e).transform).m41);
      await page.mouse.move(box.x, box.y);
      await page.mouse.down();
      for (let k = 1; k <= 12; k++) { await page.mouse.move(box.x - k * 25, box.y); await new Promise(r => setTimeout(r, 16)); }
      await page.mouse.up();
      await new Promise(r => setTimeout(r, 120));
      const afterDrag = await page.$eval('#track', e => new DOMMatrix(getComputedStyle(e).transform).m41);
      const opened = await page.$eval('#comboDialog', d => d.open);
      const cardW = await page.$eval('.combo-card', e => e.getBoundingClientRect().width + 18);
      const moved = Math.abs(((tBefore - afterDrag) % cardW + cardW) % cardW) > 1 || Math.abs(tBefore - afterDrag) > 1;
      check(moved && !opened, `desktop: dragging scrolls the gallery (${tBefore.toFixed(0)} → ${afterDrag.toFixed(0)}) without opening the dialog`);
      await new Promise(r => setTimeout(r, 1500));
      // The card nearest the middle of the gallery (cards sit in slots: DOM order ≠ screen order).
      const box2 = await page.evaluate(() => { const m = document.getElementById('marquee').getBoundingClientRect(), cx = m.left + m.width / 2; const r = [...document.querySelectorAll('.combo-card')].map(e => e.getBoundingClientRect()).sort((a, b) => Math.abs(a.x + a.width / 2 - cx) - Math.abs(b.x + b.width / 2 - cx))[0]; return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
      await page.mouse.move(box2.x, box2.y);
      await new Promise(r => setTimeout(r, 400));
      await page.mouse.click(box2.x, box2.y);
      await new Promise(r => setTimeout(r, 500));
      const dlg = await page.$eval('#comboDialog', d => ({ open: d.open, code: d.querySelector('#comboCode').textContent, mascot: !!d.querySelector('.uko-mascot-svg') }));
      check(dlg.open && dlg.mascot && /<uko-mascot (character="(aituko|meowuko)" state="[a-z]+"|state="[a-z]+" hair="[a-z_]+" hair-color="#[0-9A-Fa-f]{6}") brand="#[0-9A-Fa-f]{6}"( theme="dark")?>/.test(dlg.code), `desktop: click opens the dialog with live mascot and code (${dlg.code})`);
      await page.click('#pickTheme .chip[data-v="dark"]');
      const dark = await page.$eval('#comboBig .uko-mascot-svg', svg => ({ theme: svg.dataset.theme, line: svg.style.getPropertyValue('--bodyStrokeColor') }));
      check(dark.theme === 'dark' && dark.line.toUpperCase() === '#F4F4F8', `desktop: dark theme switches the mascot lines (${JSON.stringify(dark)})`);
      await page.click('#pickCharacter .chip[data-v="uko"]');
      await page.click('#pickHair .chip[data-v="afro"]');
      const code2 = await page.$eval('#comboCode', e => e.textContent);
      check(code2.includes('hair="afro"'), 'desktop: dialog controls update the code');
      await page.click('#pickCharacter .chip[data-v="aituko"]');
      await new Promise(r => setTimeout(r, 250));
      const robot = await page.evaluate(() => ({ code: document.getElementById('comboCode').textContent, hairHidden: document.getElementById('pickHair').hidden,
        screen: !!document.querySelector('#comboBig .robotScreen') }));
      check(robot.code.includes('character="aituko"') && !robot.code.includes('hair=') && robot.hairHidden && robot.screen, `desktop: the dialog switches to Aituko (${robot.code})`);
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 300));
      check(!(await page.$eval('#comboDialog', d => d.open)), 'desktop: Escape closes the dialog');

      // Rive: the runtime loads lazily, the state machine answers its inputs.
      await page.click('.mode-switch .mode[data-mode="rive"]');
      await page.evaluate(() => document.getElementById('code').scrollIntoView());
      const riveReady = await page.waitForFunction(() => document.getElementById('rive').classList.contains('rive-ready'), { timeout: 20000 }).then(() => true, () => false);
      check(riveReady, 'desktop: uko.riv loads in the Rive runtime');
      if (riveReady) {
        await page.click('[data-rstate="loading"]');
        await new Promise(r => setTimeout(r, 1400));
        await page.click('[data-rtrigger="success"]');
        await new Promise(r => setTimeout(r, 300));
        const call = await page.$eval('#riveCall', e => e.textContent);
        check(call === "input('success').fire()", `desktop: Rive controls drive the state machine (${call})`);
        // One file per character: switching loads it in place.
        const rivResp = page.waitForResponse(r => r.url().endsWith('/rive/meowuko.riv'), { timeout: 15000 }).then(r => r.status(), () => 0);
        await page.click('[data-rchar="meowuko"]');
        const st = await rivResp;
        await new Promise(r => setTimeout(r, 1200));
        const riveStatus = await page.$eval('#riveStatus', e => e.textContent);
        const code = await page.$eval('#riveCode', e => e.textContent);
        check(st === 200 && !riveStatus && code.includes("'/meowuko.riv'"), `desktop: the Rive demo switches to meowuko.riv (HTTP ${st}${riveStatus ? ', ' + riveStatus : ''})`);
      }
    }
    await page.screenshot({ path: path.join(OUT, `landing_${label}.png`), fullPage: true });
    check(errors.length === 0, `${label}: no console errors ${errors.length ? JSON.stringify(errors) : ''}`);
    await page.close();
  }
  await browser.close();
  if (failures.length) { console.log(`\nFAIL (${failures.length})`); process.exit(1); }
  console.log('\nPASS');
})().catch(e => { console.error(e); process.exit(2); });
