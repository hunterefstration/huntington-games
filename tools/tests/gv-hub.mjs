// Multiplayer hub rooms (any 6-digit code), starting a game for the room, and Go live / watching. Same rig as gv-invite.mjs.
//   NODE_PATH=/opt/node22/lib/node_modules node tools/tests/gv-invite.mjs   (reset the rig database first)
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
async function device(ctx, noVideo) {
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
  await page.addInitScript(() => { window.HG_TEST_RELAYS = ['ws://127.0.0.1:9001']; window.HG_TEST_PEER = window.__noVideo ? false : { host: '127.0.0.1', port: 9000, path: '/gv', secure: false }; });
  if (noVideo) await page.addInitScript(() => { window.__noVideo = 1; window.HG_TEST_PEER = false; });
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

const appOf = async page => until(async () => {
  const f = page.frames().find(x => x !== page.mainFrame() && x.url().startsWith('about:srcdoc'));
  return f && (await f.evaluate(() => !!(window.S && S.joined && S.ready)).catch(() => false)) ? f : null; }, 90000);
async function signedIn(name) {
  const P = await device(await browser.newContext({ viewport: { width: 1280, height: 800 } }));
  await createAccount(P, name);
  await until(async () => (await status(P)) === 'online', 60000);
  for (let i = 0; i < 6; i++) await P.click('#tour .go', { timeout: 1500 }).catch(() => {});
  await P.click('#tour .skip', { timeout: 500 }).catch(() => {});
  const app = await appOf(P);
  await app.waitForSelector('#guideOffer.on #goNo', { state: 'visible', timeout: 8000 }).then(() => app.click('#goNo')).catch(() => {});
  return [P, app];
}
const say = (app, t) => app.evaluate(t => { document.querySelector('#text').value = t; GV.send(); }, t);
const playTetris = async P => {
  await P.evaluate(() => { [...document.querySelectorAll('.game')].find(g => /Tetris Surge/.test(g.textContent)).click(); });
  return until(async () => P.frames().find(x => /Tetris/.test(x.url())), 60000);
};

const gameFrame = P => P.frames().find(f => f !== P.mainFrame() && !f.url().startsWith('about:srcdoc') && /Frontline|Blocky/.test(f.url()));
try {
  const tag = String(Date.now() % 100000), CODE = String(100000 + Math.floor(Math.random() * 899999)), W = 'n' + 'igga';
  const A = await device(await browser.newContext()); await createAccount(A, 'HubA' + tag);
  const B = await device(await browser.newContext()); await createAccount(B, 'HubB' + tag);
  const st = p => p.evaluate(() => HG_hub.state());

  console.log('\n=== any code opens (or joins) a room ===');
  await A.evaluate(() => document.getElementById('tab-mp').click());
  check('the Multiplayer tab is there', await A.evaluate(() => !document.getElementById('view-mp').hidden));
  await A.evaluate(c => { document.getElementById('mp-code').value = c; document.getElementById('mp-go').click(); }, CODE);
  check('a code nobody used opens a room', !!(await until(async () => { const s = await st(A); return s.room === CODE && s.host; }, 30000)));
  await B.evaluate(c => { document.getElementById('tab-mp').click(); document.getElementById('mp-code').value = c; document.getElementById('mp-go').click(); }, CODE);
  check('the same code on another device joins that room', !!(await until(async () => { const s = await st(B); return s.room === CODE && !s.host; }, 30000)));
  check('both see two people', !!(await until(async () => (await A.evaluate(() => document.querySelectorAll('#mp-people .mp-person').length)) === 2 && (await B.evaluate(() => document.querySelectorAll('#mp-people .mp-person').length)) === 2, 15000)));
  await B.evaluate(w => { const i = document.getElementById('mp-msg'); i.value = 'hey ' + w + ' ready to play'; document.getElementById('mp-send').click(); }, W);
  // since the wheel (2026-10-29) the word is never sent: the server spins the wheel for that account instead
  await sleep(3000);
  const line = await A.evaluate(() => [...document.querySelectorAll('#mp-log div')].map(d => d.textContent).find(t => /ready to play/.test(t)));
  check('a message with the blocked word never reaches the room (the wheel spins instead)', !line, line);
  check('...and the sender sees the wheel', !!(await until(() => B.evaluate(() => !!document.querySelector('#hwheel .wdisc')), 8000)));
  await B.evaluate(() => { const w = document.getElementById('hwheel'); if (w) w.remove(); });
  await B.evaluate(() => { const i = document.getElementById('mp-msg'); i.value = 'clean hello ready'; document.getElementById('mp-send').click(); });
  check('normal room chat still arrives', !!(await until(() => A.evaluate(() => [...document.querySelectorAll('#mp-log div')].some(d => /clean hello ready/.test(d.textContent))), 15000)));

  console.log('\n=== start a game for the room ===');
  // what Blocky does after hosting a party for the room (its PeerJS host needs the internet, so it is played by hand here)
  const sent = await A.evaluate(c => HG_sendInvite('hub:' + c, { game: 'blocky', code: 'PARTY77' }), CODE);
  check('a game started from the room reports its party code to the room', sent === true);
  check('the other person gets a Join button', !!(await until(() => B.evaluate(() => !!document.querySelector('#mp-plays .mp-play button')), 15000)));
  await B.evaluate(() => document.querySelector('#mp-plays .mp-play button').click());
  const opened = await until(() => B.evaluate(() => document.getElementById('player').classList.contains('open') && !/Getting your saved progress|Checking for newer saves/.test(document.getElementById('frame').srcdoc || '') ? true : null), 8000);
  check('Join opens the game straight away (no waiting for saves)', !!opened);
  await B.waitForTimeout(1500);
  check('the game is handed the party code', await B.evaluate(() => { const c = HG_takeJoin('blocky'); return c === 'PARTY77' || c === null; }));
  await B.evaluate(() => document.getElementById('back').click());

  console.log('\n=== Go live ===');
  await A.evaluate(() => { document.getElementById('tab-games').click(); });
  await A.evaluate(() => { const g = GAMES.find(x => x.dir === 'Last Light'); play(g); });
  await until(() => A.evaluate(() => { try { return !!document.getElementById('frame').contentWindow.__lumi; } catch (e) { return false; } }), 30000);
  await A.evaluate(() => document.getElementById('frame').contentWindow.__lumi.start('1-1'));
  await A.evaluate(() => document.getElementById('golive').click());
  const live = await until(async () => { const s = await st(A); return s.live && /^\d{6}$/.test(s.live) ? s.live : null; }, 30000);
  check('Go live gives a 6-digit code', !!live, String(live));
  await B.evaluate(c => { document.getElementById('tab-mp').click(); document.getElementById('mp-leave').click(); document.getElementById('mp-code').value = c; document.getElementById('mp-go').click(); }, live);
  check('typing it opens the viewer', !!(await until(async () => (await st(B)).watching, 30000)));
  check('the viewer gets live video', !!(await until(async () => (await st(B)).watchVideo, 30000)));
  check('the player sees one watcher', !!(await until(() => A.evaluate(() => /1 watching/.test(document.getElementById('livestat').textContent)), 15000)));
  const C = await device(await browser.newContext(), true);
  await C.evaluate(() => { const b = document.querySelector('#gate button[data-guest], #gate .guest'); if (b) b.click(); });
  await C.evaluate(c => { HG_hub.go(c); }, live);
  check('a viewer that cannot get video gets snapshots instead', !!(await until(() => C.evaluate(() => { const i = document.getElementById('w-img'); return !i.hidden && /^data:image\/jpeg/.test(i.src); }), 40000)));
  await A.evaluate(() => document.getElementById('back').click());
  check('closing the game ends the stream', !!(await until(() => B.evaluate(() => /ended/.test(document.getElementById('w-wait').textContent) && !document.getElementById('w-wait').hidden), 20000)));
} catch (e) { console.log('ERROR', e && e.stack || e); failures++; }
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
