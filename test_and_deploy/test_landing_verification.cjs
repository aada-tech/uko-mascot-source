#!/usr/bin/env node
// Smoke test of the landing page, on the built site (FR, EN, ES):
//   npm run build:site && npm run serve
//   UKO_BASE_URL=http://localhost:3350/ node test_and_deploy/test_landing_verification.cjs   (also /en/ and /es/)
// UKO_QA_OUT sets the screenshot folder.
const fs = require('fs');
const path = require('path');
let puppeteer;
try { puppeteer = require('puppeteer'); } catch (e) { puppeteer = require(path.join(__dirname, '..', '..', 'node_modules', 'puppeteer')); }
const BASE_URL = process.env.UKO_BASE_URL || 'http://localhost:3350/';
const OUT = process.env.UKO_QA_OUT || path.join(__dirname, 'output');
// What a visitor downloads before any video is played (scripts, styles, fonts, images),
// measured uncompressed: the host compresses text, so the real transfer is about half.
const BUDGET_KB = 450;
const PRICE = { fr: '6,99 €', en: '€6.99', es: '6,99 €' };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: 'new' });
  const failures = [];
  const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failures.push(msg); };

  for (const [w, h, label] of [[1280, 820, 'desktop'], [390, 844, 'mobile']]) {
    const ctx = await browser.createBrowserContext();   // empty cache: each viewport weighs a first visit
    const page = await ctx.newPage();
    const errors = [], requests = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Permissions-Policy/.test(m.text())) errors.push(m.text()); });
    const cdp = await page.target().createCDPSession();
    await cdp.send('Network.enable');
    const sizes = new Map();
    cdp.on('Network.responseReceived', e => sizes.set(e.requestId, { url: e.response.url, bytes: 0 }));
    cdp.on('Network.loadingFinished', e => { const r = sizes.get(e.requestId); if (r) r.bytes = e.encodedDataLength; });
    page.on('request', r => requests.push(r.url()));
    // Stay on the language asked for (no redirect to the browser's language).
    await page.evaluateOnNewDocument(() => { try { localStorage.setItem('uko-lang-set', '1'); } catch (e) {} });
    await page.setViewport({ width: w, height: h, isMobile: w < 600, hasTouch: w < 600 });
    await page.goto(BASE_URL, { waitUntil: 'load', timeout: 60000 });
    await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });   // clicks land where they aim
    await new Promise(r => setTimeout(r, 1200));
    const lang = await page.evaluate(() => document.documentElement.lang.slice(0, 2));

    const info = await page.evaluate(() => ({
      mascots: document.querySelectorAll('.uko-mascot-svg').length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      buy: !!document.getElementById('buyPackBtn'),
      sale: document.getElementById('prix').dataset.sale,
      soonVisible: !!document.querySelector('#prix .soon') && getComputedStyle(document.querySelector('#prix .soon')).display !== 'none',
      sections: [...document.querySelectorAll('main > section')].map(s => s.id || s.className),
      price: document.querySelector('#prix .offer:nth-child(2) .price').textContent.trim(),
      faq: document.querySelectorAll('#faq details').length,
      prompt: document.getElementById('promptText').textContent.replace(/\s+/g, ' ').trim()
    }));
    check(info.mascots >= 3, `${label}: ${info.mascots} live mascots rendered`);
    check(info.overflow <= 0, `${label}: no horizontal overflow (${info.overflow}px)`);
    check(info.sections.length <= 5, `${label}: a short page, ${info.sections.length} sections (${info.sections.join(' · ')})`);
    check(info.buy, `${label}: buy button present`);
    check(info.sale !== 'closed' || info.soonVisible, `${label}: sales closed → "coming soon" shown`);
    check(info.price === PRICE[lang], `${label}: full pack at ${info.price} (${lang})`);
    check(info.faq >= 4, `${label}: ${info.faq} FAQ entries`);
    check(/loading/.test(info.prompt) && /success/.test(info.prompt) && info.prompt.length > 150, `${label}: the AI prompt is on the page (${info.prompt.length} chars)`);

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
    check(free.zip, `${label}: free Starter zip is served`);

    // Demo: the chips drive the mascot and the code follows, in every tab.
    await page.evaluate(() => document.getElementById('code').scrollIntoView());
    await page.click('#pickState .chip[data-state="success"]');
    await page.click('#pickChar .chip[data-char="meowuko"]');
    await new Promise(r => setTimeout(r, 300));
    const html = await page.$eval('#codeBox', e => e.textContent);
    check(/character="meowuko"/.test(html) && /state="success"/.test(html) && /uko-mascot-engine\.min\.js/.test(html), `${label}: chips update the HTML code`);
    const drawn = await page.$eval('#codeUko', e => ({ cat: !!e.querySelector('.catNose') }));
    check(drawn.cat, `${label}: the demo mascot switches to Meowuko`);
    await page.click('#codeTabs .tab[data-tab="rive"]');
    const rive = await page.$eval('#codeBox', e => e.textContent);
    check(/@rive-app\/canvas-lite/.test(rive) && /'meowuko\.riv'/.test(rive) && /input\('success'\)\.fire\(\)/.test(rive), `${label}: the Rive tab shows the matching Rive code`);
    await page.click('#pickState .chip[data-state="loading"]');
    const riveLoading = await page.$eval('#codeBox', e => e.textContent);
    check(/input\('state'\)\.value = 2/.test(riveLoading), `${label}: Rive code for a background state uses the state input`);
    await page.click('#codeTabs .tab[data-tab="react"]');
    check(await page.$eval('#codeBox', e => e.textContent.includes('export default function')), `${label}: React tab renders`);

    if (label === 'desktop') {
      const t1 = await page.evaluate(() => document.getElementById('film').ukoFilm.clock);
      await page.evaluate(() => window.scrollTo(0, 0));
      await new Promise(r => setTimeout(r, 1500));
      const t2 = await page.evaluate(() => document.getElementById('film').ukoFilm.clock);
      check(t2 > t1, `desktop: hero film is playing (clock ${t1.toFixed(1)}s → ${t2.toFixed(1)}s)`);
      await page.click('.film-toggle');
      const t3 = await page.evaluate(() => document.getElementById('film').ukoFilm.clock);
      await new Promise(r => setTimeout(r, 600));
      const t4 = await page.evaluate(() => document.getElementById('film').ukoFilm.clock);
      check(t4 === t3, 'desktop: pause button stops the film');
      await page.click('.film-toggle');
    } else {
      // Phones: the mascot and its chips come before the code.
      const order = await page.evaluate(() => document.querySelector('#code .mini-stage').getBoundingClientRect().top < document.getElementById('codeBox').getBoundingClientRect().top);
      check(order, 'mobile: the demo mascot shows before its code');
    }

    // Scroll the whole page like a visitor, then weigh what was downloaded.
    const H = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < H; y += 500) { await page.evaluate(y => window.scrollTo(0, y), y); await new Promise(r => setTimeout(r, 120)); }
    await new Promise(r => setTimeout(r, 1500));
    const posters = await page.$$eval('.real-phone video', vs => vs.filter(v => v.poster).length);
    check(posters === 2, `${label}: video posters load when the videos come near (${posters}/2)`);
    check(!requests.some(u => /\/rive\/|rive\.wasm|rive\.js/.test(u)), `${label}: no Rive runtime downloaded by the landing`);
    const kb = [...sizes.values()].filter(r => !/\.(mp4|webm)(\?|$)/.test(r.url)).reduce((n, r) => n + r.bytes, 0) / 1024;
    check(kb < BUDGET_KB, `${label}: ${kb.toFixed(0)} KB downloaded before any video (budget ${BUDGET_KB} KB, uncompressed)`);

    await page.screenshot({ path: path.join(OUT, `landing_${label}.png`), fullPage: true });
    check(errors.length === 0, `${label}: no console errors ${errors.length ? JSON.stringify(errors) : ''}`);
    await ctx.close();
  }
  await browser.close();
  if (failures.length) { console.log(`\nFAIL (${failures.length})`); process.exit(1); }
  console.log('\nPASS');
})().catch(e => { console.error(e); process.exit(2); });
