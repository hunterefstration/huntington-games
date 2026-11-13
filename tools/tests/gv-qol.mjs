// Quality of life on the Games page: search, tags, favourites, sort, play time, the player buttons, the "What is new" card.
//   NODE_PATH=/opt/node22/lib/node_modules node tools/tests/gv-saves.mjs   (reset the rig database first)
import { chromium } from 'playwright';
import fs from 'node:fs';

const HUB = process.env.HUB_URL || 'http://127.0.0.1:8090/index.html';
const ARCHIVE = process.env.RIG_ARCHIVE || 'rig-archive-a';
const MQTT = process.env.MQTT_JS || '/home/user/grapevine/relay/mqtt.min.js';
const PEERJS = process.env.PEERJS_JS || '/home/user/grapevine/node_modules/peerjs/dist/peerjs.min.js';
const TOOLS = process.env.HG_TOOLS || '/tmp/hg-tools';
const ROOT = new URL('../../', import.meta.url).pathname;
let failures = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); if (!ok) failures++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 20000, every = 250) {
  const t0 = Date.now();
  for (;;) { try { const v = await fn(); if (v) return v; } catch {} if (Date.now() - t0 > ms) return null; await sleep(every); }
}

const browser = await chromium.launch({ executablePath: process.env.RIG_CHROME || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
// one "device": its own storage
async function device(ctx) {
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('    [pageerror]', e.message));
  await page.route(/cdn\.jsdelivr\.net\/npm\/mqtt|unpkg\.com\/mqtt/, r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(MQTT) }));
  await page.route(/cdn\.jsdelivr\.net\/npm\/peerjs/, r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(PEERJS) }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.route(/cdn\.jsdelivr\.net\/npm\/three@0\.160\.0\/(.*)/, r => {
    const f = TOOLS + '/cdn/package/' + new URL(r.request().url()).pathname.replace(/^\/npm\/three@0\.160\.0\//, '');
    fs.existsSync(f) ? r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(f) }) : r.abort();
  });
  await page.route(/cdn\.tailwindcss\.com/, r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(TOOLS + '/node_modules/tailwindcss-cdn/tailwindcss.js') }));
  // the embedded Grapevine app talks to the test rig instead of the real server
  await page.route('**/gv/app.html', async r => {
    let html = fs.readFileSync(ROOT + 'gv/app.html', 'utf8');
    html = html.replace(/archiveIds: \[[\s\S]*?\],/, `archiveIds: ['${ARCHIVE}'],`)
      .replace(/relay: \{ shards: 2 \}/, "relay: { shards: 2, relays: ['ws://127.0.0.1:9001'] }")
      .replace("connect-src 'self' ", "connect-src 'self' ws://127.0.0.1:9001 ws://127.0.0.1:9999 ws://127.0.0.1:8787 ")
      .replace(/peerOptions: \{\s*debug: [0-9],?/, "peerOptions: { debug: 0, host: '127.0.0.1', port: 9999, path: '/gv', secure: false,")
      .replace(/serverPubs: \{[^}]*\}/, 'serverPubs: {}');
    await r.fulfill({ contentType: 'text/html', body: html });
  });
  await page.addInitScript(a => { window.HG_GV_CONFIG = a; },
    { archives: [ARCHIVE], pinned: {}, shards: 2, relays: ['ws://127.0.0.1:9001'] });
  await page.goto(HUB);
  await page.evaluate(() => { try { localStorage.setItem('hgv:tour', '2'); } catch (e) {} });   // these tests are not about the tour (gv-tour.mjs is)
  return page;
}
const status = p => p.evaluate(() => HGGrapevine.status().status).catch(() => '');
async function createAccount(page, name) {
  await page.waitForSelector('#gate .gl .seg', { timeout: 20000 });
  await page.click('#gate .gl .seg button:nth-child(2)');
  await page.fill('#gate #gl-name', name);
  await page.click('#gate #gl-go');
  await page.waitForSelector('#gate #gl-newkey', { timeout: 5000 });
  const key = await page.$eval('#gate #gl-newkey', e => e.textContent);
  await page.check('#gate #gl-saved');
  await page.click('#gate #gl-fin');
  return key;
}
const vis = P => P.$$eval('#grid .game:not([hidden]) .name, #grid-mini .game:not([hidden]) .name', es => es.map(e => e.textContent));
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('t')) { sessionStorage.setItem('t', '1'); localStorage.setItem('hgv:booted', '1'); } } catch (e) {} });   // not a first visit: the What's new card shows
  const A = await device(ctx);
  await createAccount(A, 'Qol' + Date.now() % 100000);
  await until(async () => (await status(A)) === 'online', 60000);
  await A.click('#tour .skip', { timeout: 3000 }).catch(() => {});
  const all = await vis(A);
  console.log('\n=== 1. search and tags ===');
  check('the toolbar is there', await A.evaluate(() => !!document.getElementById('gq') && document.querySelectorAll('#gtags .gchip').length >= 4));
  await A.keyboard.press('/');
  check('"/" jumps to the search box', await A.evaluate(() => document.activeElement && document.activeElement.id === 'gq'));
  await A.keyboard.type('tetris');
  let v = await vis(A);
  check('typing filters the games', v.length >= 1 && v.length < 4 && v.every(n => /tetris/i.test(n)), v.join(' | '));
  await A.keyboard.press('Escape');
  check('Esc clears it', (await vis(A)).length === all.length);
  await A.fill('#gq', 'zzzzqq');
  check('nothing found says so', await A.evaluate(() => !document.getElementById('gnone').hidden) && (await vis(A)).length === 0);
  await A.click('#gnone button');
  check('...with a way back', (await vis(A)).length === all.length);
  await A.evaluate(() => { [...document.querySelectorAll('.gchip')].find(b => b.textContent === 'Multiplayer').click(); });
  v = await vis(A);
  check('a tag chip filters', v.length > 3 && v.length < all.length && v.includes('Reaction Duel'), v.length + ' games');
  await A.evaluate(() => { [...document.querySelectorAll('.gchip')].find(b => b.textContent === 'All').click(); });
  console.log('\n=== 2. favourites and order ===');
  await A.evaluate(() => { document.querySelector('.game[data-dir="Imposter"] .gfav').click(); });
  v = await vis(A);
  check('a starred game moves to the front', /^Imposter/.test(v[0]), v.slice(0, 3).join(' | '));
  check('the star does not open the game', await A.evaluate(() => !document.getElementById('player').classList.contains('open')));
  check('it is saved under a key the account carries', await A.evaluate(() => JSON.parse(localStorage.getItem('hgq:fav')).includes('Imposter')));
  await A.selectOption('#gsort', 'az');
  v = await A.$$eval('#grid .game:not([hidden]) .name', es => es.map(e => e.textContent));
  check('A to Z sorts', v.join('|') === v.slice().sort((a, b) => a.localeCompare(b)).join('|'), v.slice(0, 4).join(' | '));
  await A.selectOption('#gsort', 'default');
  await A.reload(); await until(() => A.evaluate(() => document.querySelectorAll('#grid .game').length > 5));
  await until(() => A.evaluate(() => !!document.querySelector('.game[data-dir="Imposter"] .gfav.on')));
  check('favourites survive a reload', /^Imposter/.test((await vis(A))[0]), (await vis(A))[0]);
  console.log('\n=== 3. the player ===');
  await A.evaluate(() => { document.querySelector('.game[data-dir="Tetris"]').click(); });
  await A.waitForSelector('#player.open', { timeout: 20000 });
  await until(async () => /Tetris/.test(await A.title()), 20000);      // (the game starts once the saves are in step)
  check('the browser tab shows the game', /Tetris/.test(await A.title()), await A.title());
  await A.evaluate(() => { FEED.lastInput = Date.now(); const l = JSON.parse(localStorage.getItem('hgq:play')); QOL.log.Tetris.sec = 3700; });
  await A.click('#pfav');
  check('the star in the player bar works', await A.evaluate(() => qolIsFav('Tetris')));
  A.once('dialog', d => d.accept());
  const n0 = await A.evaluate(() => { window.__fr = 0; document.getElementById('frame').addEventListener('load', () => window.__fr++); return 0; });
  await A.click('#prestart');
  check('Restart reloads the game (after asking)', !!(await until(() => A.evaluate(() => window.__fr > 0), 8000)));
  await A.evaluate(() => document.getElementById('back').click()); await A.waitForTimeout(600);
  check('the tab title is back', /Huntington/i.test(await A.title()) && !/Tetris/.test(await A.title()), await A.title());
  const st = await A.evaluate(() => document.querySelector('.game[data-dir="Tetris"] .gstat').textContent);
  check('the card shows how long you played and when', /Played 1h 1m/.test(st) && /just now/.test(st), st);
  check('one visit, even with a restart', await A.evaluate(() => JSON.parse(localStorage.getItem('hgq:play')).Tetris.n === 1));
  await A.evaluate(() => { const l = JSON.parse(localStorage.getItem('hgq:play')); l.Tetris.ver = 'Tetris Surge 0.1'; localStorage.setItem('hgq:play', JSON.stringify(l)); render(); });
  check('a game that changed since you played says Updated', await A.evaluate(() => !!document.querySelector('.game[data-dir="Tetris"] .gupd')));
  console.log('\n=== 4. what is new, small cards, Rebalanced ===');
  check('the What\'s new card shows once after an update', await A.evaluate(() => !document.getElementById('whatsnew').hidden && document.querySelectorAll('#whatsnew li').length >= 3));
  await A.click('#wn-x'); await A.reload(); await until(() => A.evaluate(() => document.querySelectorAll('#grid .game').length > 5));
  check('...and stays away after "Got it"', await A.evaluate(() => document.getElementById('whatsnew').hidden));
  check('small tiles are the normal look', await A.evaluate(() => document.documentElement.classList.contains('gdense') && getComputedStyle(document.querySelector('#grid .game .desc')).display === 'none'));
  await A.click('#gdense');
  check('...and big cards with descriptions are one press away', await A.evaluate(() => !document.documentElement.classList.contains('gdense') && getComputedStyle(document.querySelector('#grid .game .desc')).display !== 'none'));
  await A.click('#gdense');
  console.log('\n=== 5. the front page: banner, shelves, hover card ===');
  check('a featured banner with a Play button', await A.evaluate(() => !document.getElementById('ghero').hidden && !!document.querySelector('#ghero .gh-play') && document.querySelector('#ghero h2').textContent.length > 2));
  const sh = await A.evaluate(() => [...document.querySelectorAll('#gshelves .gshelf')].map(s => s.dataset.shelf + ':' + s.querySelectorAll('.stile').length));
  check('shelves by kind of game, each scrolling sideways', sh.length >= 4 && sh.some(x => /^mp:/.test(x)) && await A.evaluate(() => { const r = document.querySelector('#gshelves .gsrow'); return getComputedStyle(r).overflowX === 'auto' && getComputedStyle(r).display === 'flex'; }), sh.join(' '));
  check('every game is still listed below as a tile', await A.evaluate(() => document.querySelectorAll('#grid .game').length >= 15 && /All games/.test(document.getElementById('all-h').textContent)));
  check('more than one row of tiles fits a 1280 screen without scrolling the page sideways', await A.evaluate(() => { const g = [...document.querySelectorAll('#grid .game')]; return g.filter(x => x.getBoundingClientRect().top === g[0].getBoundingClientRect().top).length >= 6 && document.documentElement.scrollWidth <= innerWidth; }));
  await A.fill('#gq', 'tetris');
  check('searching hides the banner and shelves and shows the matches', await A.evaluate(() => document.getElementById('ghero').hidden && document.getElementById('gshelves').hidden && /game/.test(document.getElementById('all-h').textContent)));
  await A.fill('#gq', '');
  await A.evaluate(() => { const t = document.querySelector('#gshelves .stile'); t.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' })); });
  check('resting on a tile shows what the game is', !!(await until(() => A.evaluate(() => { const p = document.getElementById('gpeek'); return !p.hidden && p.querySelector('p').textContent.length > 20; }), 3000)));
  await A.evaluate(() => { document.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' })); });
  await A.evaluate(() => { document.querySelector('#gshelves .gshelf[data-shelf="mp"] .stile').click(); });
  await A.waitForSelector('#player.open', { timeout: 20000 });
  check('a shelf tile opens its game', true);
  await A.evaluate(() => document.getElementById('back').click()); await A.waitForTimeout(500);
  await A.evaluate(() => { document.querySelector('.game[data-dir="Brown E Clicker"] .galt').click(); });
  await A.waitForSelector('#player.open', { timeout: 20000 });
  await until(async () => /Brown E/.test(await A.title()), 20000);
  check('the Rebalanced beta button opens the game in that mode', await A.evaluate(() => localStorage.getItem('brownEClicker_variant') === 'rb'));
  await A.evaluate(() => document.getElementById('back').click());
  await A.setViewportSize({ width: 1280, height: 900 }); await A.waitForTimeout(500);
  if (process.env.SHOT) { await A.evaluate(() => scrollTo(0, 0)); await A.waitForTimeout(600); await A.screenshot({ path: process.env.SHOT }); }
} catch (e) { console.log('ERROR', e && e.stack || e); failures++; }
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
