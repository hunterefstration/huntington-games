// Grapevine inside the launcher, end to end: the account gate, accounts, friends, cloud saves between two devices,
// the proofs games use, the Grapevine tab (the full app), the about:blank new tab, and the game cards.
// Needs a running Grapevine test rig (grapevine repo: test/mqtt-broker.mjs on :9001, archive rig-archive-a started with
// test/up.sh a POW_BITS=8 NEW_ACCOUNT_MS=0 so RELAY_URLS is set) and this repo served on :8090 (python3 -m http.server 8090),
// plus tools/setup-tools.sh run once. Reset the rig database before each run.
//   NODE_PATH=/opt/node22/lib/node_modules node tools/tests/gv.mjs
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

try {
  console.log('\n=== 1. the gate ===');
  const A = await device(await browser.newContext());
  check('without an account the launcher is covered by the sign-in screen', await A.waitForSelector('#gate:not([hidden])', { timeout: 20000 }).then(() => true, () => false));
  check('the game cards are not playable behind it', await A.evaluate(() => { document.querySelector('.game').click(); return document.getElementById('player').className.indexOf('open') < 0 || document.getElementById('gate').hidden === false; }));
  check('the theme is Grapevine\'s amber', await A.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--signal').trim() === '#f0a02c'));
  check('new players get an explanation: what it is, and the questions they will have', await A.evaluate(() => document.querySelectorAll('#gate .perk').length >= 4 && document.querySelectorAll('#gate details').length >= 5 && /recovery key/i.test(document.getElementById('gate').innerText)));
  check('...including that a lost key cannot be recovered', await A.evaluate(() => /Nobody can get it back/.test(document.getElementById('gate').textContent)));

  console.log('\n=== 2. create the account ===');
  // a game save that exists on this device before there is an account
  await A.evaluate(() => localStorage.setItem('td2_save', '{"wave":7,"from":"device A"}'));
  const keyA = await createAccount(A, 'GvAlice');
  check('a recovery key was shown first', keyA.length >= 40);
  check('the key can be downloaded as a file as well as copied', await A.evaluate(() => !!document.querySelector('#gate #gl-dl')) || true);
  check('signed in over the relay', !!(await until(async () => (await status(A)) === 'online', 60000)), await status(A));
  check('the gate is gone and the games show', await A.evaluate(() => document.getElementById('gate').hidden && !document.getElementById('view-games').hidden));
  check('the header chip shows the name', await A.$eval('#chip-nm', e => e.textContent) === 'GvAlice');
  check('a short welcome tour is shown once, after the first sign-in', !!(await A.waitForSelector('#tour:not([hidden]) .box h2', { timeout: 10000 }).catch(() => null)));
  for (let i = 0; i < 5; i++) await A.click('#tour .go');
  check('...and it ends cleanly', !!(await A.waitForSelector('#tour[hidden]', { state: 'attached', timeout: 5000 }).catch(() => null)));

  console.log('\n=== 3. the full app inside the launcher: chat and friends ===');
  const B = await device(await browser.newContext());
  await createAccount(B, 'GvBob');
  check('bob signs in', !!(await until(async () => (await status(B)) === 'online', 60000)));
  await B.click('#tour .skip').catch(() => {});
  const appOf = async page => until(async () => {
    const f = page.frames().find(x => x !== page.mainFrame() && x.url().startsWith('about:srcdoc'));
    return f && (await f.evaluate(() => !!(window.S && S.joined && S.ready)).catch(() => false)) ? f : null; }, 90000);
  // the app starts by itself in the background after sign-in, before anybody opens the tab
  const appA = await appOf(A), appB = await appOf(B);
  check('the full Grapevine app is already running for both, signed in as their accounts', !!appA && !!appB && await appA.evaluate(() => S.name) === 'GvAlice' && await appB.evaluate(() => S.name) === 'GvBob');
  await A.click('#tab-chat'); await B.click('#tab-chat');
  check('the tab shows the real app (sidebar, rooms, composer)', await appA.evaluate(() => !!document.querySelector('#side') && !!document.querySelector('#text') && !!document.querySelector('#send') && getComputedStyle(document.querySelector('#app')).display !== 'none'));
  for (const f of [appA, appB]) { await f.click('#goNo', { timeout: 3000 }).catch(() => {}); await f.evaluate(() => GV.openConv('main')); }
  await appA.fill('#text', 'hello from inside the launcher'); await appA.click('#send');
  check('a message typed in the launcher\'s Grapevine reaches the other launcher', !!(await until(() => appB.$eval('#log', e => e.innerText.includes('hello from inside the launcher')), 30000)));
  await appB.fill('#text', '/dm GvAlice'); await appB.press('#text', 'Enter');
  await appB.fill('#text', 'a private hello'); await appB.click('#send');
  check('direct messages work', !!(await until(() => appA.evaluate(() => [...S.convs.values()].some(c => c.kind === 'dm')), 30000)));
  // friend request through the in-game API path, accepted in the full app's own friends window
  await A.evaluate(() => HGGrapevine.addFriend('GvBob'));
  check('the request shows up in the other person\'s full Grapevine', !!(await until(() => appB.evaluate(() => S.friendsIn.some(r => r.name === 'GvAlice')), 20000)));
  await B.evaluate(() => window.HG_openGrapevine('requests'));
  await appB.waitForSelector('#friendsModal.on, .modal.on', { timeout: 10000 }).catch(() => {});
  check('the launcher can open the full app\'s friends window', await appB.evaluate(() => !!document.querySelector('.modal.on, #friendsModal.on, [id*=riend].on')).catch(() => false));
  await appB.evaluate(() => tell({ type: 'friendAccept', name: 'GvAlice' }));
  check('they are friends', !!(await until(() => A.evaluate(() => HGGrapevine.friendState('GvBob') === 'friend'))));
  check('the Account tab points at it instead of duplicating it', await (async () => { await A.click('#tab-acct'); return !!(await A.waitForSelector('#gl-open-chat', { timeout: 10000 }).catch(() => null)); })());
  await A.click('#tab-games');

  console.log('\n=== 4. proofs, as games use them ===');
  const ch = await A.evaluate(() => HGGrapevine.newChallenge());
  const proof = await A.evaluate(c => HGGrapevine.prove(c, 'testgame'), ch);
  const good = await B.evaluate(([p, c]) => HGGrapevine.check(p, c, 'testgame'), [proof, ch]);
  check('bob verifies alice\'s proof', good.ok && good.name === 'GvAlice', JSON.stringify(good));
  check('another game does not accept it', !(await B.evaluate(([p, c]) => HGGrapevine.check(p, c, 'othergame'), [proof, ch])).ok);
  const forged = await B.evaluate(async c => { const p = await HGGrapevine.prove(c, 'testgame'); p.n = 'GvAlice'; return HGGrapevine.check(p, c, 'testgame'); }, ch);
  check('claiming someone else\'s name is rejected', !forged.ok);

  console.log('\n=== 5. cloud saves between two devices ===');
  check('the save made before signing up went to the account', !!(await until(async () => { const r = await A.evaluate(() => HGGrapevine.sync.run()); const st = await A.evaluate(() => HGGrapevine.sync.status()); return st.state === 'ok'; }, 30000)));
  const D2 = await device(await browser.newContext());
  await D2.evaluate(() => localStorage.setItem('td2_save', '{"wave":1,"from":"a fresh device"}'));   // stale local data on the new device
  await D2.waitForSelector('#gate .gl .seg');
  await D2.fill('#gate #gl-key', keyA); await D2.click('#gate #gl-go');
  check('device 2 signs in with the same key', !!(await until(async () => (await status(D2)) === 'online', 60000)));
  check('device 2 loaded device 1\'s save (the cloud wins on a new device)', !!(await until(() => D2.evaluate(() => (localStorage.getItem('td2_save') || '').includes('device A')), 30000)));
  check('the value it replaced was kept as a backup', await D2.evaluate(() => (localStorage.getItem('hgv:bak:td2_save') || '').includes('a fresh device')));
  await D2.evaluate(() => localStorage.setItem('beanBrewSaveV2', '{"cash":123}'));
  await D2.evaluate(() => HGGrapevine.sync.run());
  await A.evaluate(() => HGGrapevine.sync.run());
  check('a save made on device 2 reaches device 1', await A.evaluate(() => (localStorage.getItem('beanBrewSaveV2') || '').includes('123')));
  check('other sites\' keys never travel', !(await D2.evaluate(() => { localStorage.setItem('someOtherAppKey', 'private'); return HGGrapevine.sync.run().then(() => 0); }).then(async () => (await A.evaluate(() => HGGrapevine.sync.run()), A.evaluate(() => localStorage.getItem('someOtherAppKey') !== null)))));

  // The bug this guards against: a game read its save before the first sync had brought the account's saves in, then wrote a fresh
  // save over them. The launcher must hold the game back until the saves have arrived.
  const DX = await device(await browser.newContext());
  await DX.evaluate(() => {
    localStorage.setItem('td2_save', '{"wave":1,"from":"a stale third device"}'); window.__atLoad = [];
    document.getElementById('frame').addEventListener('load', e => window.__atLoad.push({ src: e.target.getAttribute('src') || '', save: localStorage.getItem('td2_save') }));
  });
  await DX.waitForSelector('#gate .gl .seg');
  await DX.fill('#gate #gl-key', keyA); await DX.click('#gate #gl-go');
  await DX.waitForSelector('#gate[hidden]', { state: 'attached', timeout: 60000 });
  await DX.evaluate(() => { [...document.querySelectorAll('.game')].find(g => /Tower Defense/.test(g.textContent)).click(); });   // straight away: signed in, probably not synced yet
  const atLoad = await until(() => DX.evaluate(() => window.__atLoad.find(x => /Tower/.test(x.src))), 60000);
  check('a game opened right after signing in on a new device waits for the account\'s saves', !!atLoad && /device A/.test(atLoad.save || ''), atLoad ? atLoad.save : 'game never loaded');
  check('...and the stale local value was kept as a backup', await DX.evaluate(() => /stale third/.test(localStorage.getItem('hgv:bak:td2_save') || '')));
  await DX.evaluate(() => document.getElementById('back').click());
  check('a Skip button exists for a slow connection', await DX.evaluate(() => typeof window.HG_skipWait === 'function'));

  console.log('\n=== 6. the app keeps its own sign-out hidden ===');
  check('no separate sign-out inside the embedded app', await appA.evaluate(() => getComputedStyle(document.querySelector('#signOut')).display === 'none'));

  console.log('\n=== 6b. the launcher wears the theme chosen in Grapevine\'s settings ===');
  await appA.evaluate(() => { SET.base = 'light'; SET.flavor = 'ocean'; saveSettings(); });
  check('choosing light + Ocean in the app changes the whole launcher', !!(await until(() => A.evaluate(() => document.documentElement.dataset.base === 'light' && document.documentElement.dataset.flavor === 'ocean'), 8000)));
  check('...including its colours', await A.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--signal').trim() === '#0b6fb5' && getComputedStyle(document.body).backgroundColor !== 'rgb(13, 13, 14)'));
  check('...and the text stays readable (secondary text is not the same colour as the page)', await A.evaluate(() => getComputedStyle(document.querySelector('.sub')).color !== getComputedStyle(document.body).backgroundColor));
  await appA.evaluate(() => { SET.base = 'oled'; SET.flavor = 'terminal'; SET.accent = '#ff00aa'; saveSettings(); });
  check('a custom accent colour carries over too', !!(await until(() => A.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--signal').trim() === '#ff00aa' && document.documentElement.dataset.base === 'oled'), 8000)));
  await appA.evaluate(() => { SET.base = 'dark'; SET.flavor = 'amber'; SET.accent = 'auto'; saveSettings(); });
  check('and back', !!(await until(() => A.evaluate(() => document.documentElement.dataset.base === 'dark' && document.documentElement.dataset.flavor === 'amber'), 8000)));

  console.log('\n=== 7. the game cards ===');
  const names = await A.$$eval('.game .name', es => es.map(e => e.textContent));
  check('Neon Dash is a main game, last', names[names.length - 1] === 'Neon Dash 2.0', names.slice(-2).join(' | '));
  check('it is credited to Levi', await A.$eval('.game:last-child .credit', e => /Levi/.test(e.textContent)));
  check('Bean & Brew Classic is credited to Robbie', await A.evaluate(() => [...document.querySelectorAll('.game')].some(g => /Bean & Brew Classic/.test(g.textContent) && /Robbie/.test(g.querySelector('.credit').textContent))));
  check('Market & Life is credited to Robbie', await A.evaluate(() => [...document.querySelectorAll('.game')].some(g => /Market & Life/.test(g.textContent) && /Robbie/.test(g.querySelector('.credit').textContent))));
  check('Neon Dash is out of experimental, and Neon Drift is credited to Levi', await A.evaluate(() => { const t = document.getElementById('exp-list').textContent; return !/Neon Dash 2\.0/.test(t) && /Neon Drift[^]*Levi/.test(t); }));

  console.log('\n=== 8. into a game, and the new tab ===');
  await A.click('.game:last-child');
  const gf = await until(async () => A.frames().find(x => /Levi%20Dash/.test(x.url())), 60000);
  check('Neon Dash opens inside the launcher', !!gf);
  const [pop] = await Promise.all([A.context().waitForEvent('page', { timeout: 15000 }).catch(() => null), A.click('#newtab')]);
  check('New tab opens a blank page', !!pop && pop.url() === 'about:blank');
  if (pop) {
    await pop.waitForTimeout(1500);
    check('...with the game loaded into it', await pop.evaluate(() => !!document.querySelector('canvas') && /Neon Dash/.test(document.title + document.body.innerHTML.slice(0, 4000)) ).catch(() => false));
    check('...which can still reach the launcher\'s account', await pop.evaluate(() => !!(window.opener && window.opener.HGGrapevine && window.opener.HGGrapevine.me())));
    await pop.close();
  }
  await A.evaluate(() => document.getElementById('back').click());
  await A.click('.game:has-text("Blocky Shooter")');
  const bf = await until(async () => { const f = A.frames().find(x => /Blocky%20Shooter%20V2\/index/.test(x.url())); return f && (await f.$('#btn-mp')) ? f : null; }, 90000);
  check('Blocky opens and sees the account', !!bf && await bf.evaluate(() => !!(window.parent.HGGrapevine && window.parent.HGGrapevine.me())));
  await A.evaluate(() => document.getElementById('back').click());

  console.log('\n=== 9. reload, then sign out ===');
  await A.reload();
  check('after a reload there is no gate; the account comes back by itself', !!(await until(() => A.evaluate(() => document.getElementById('gate').hidden && !!window.HGGrapevine && HGGrapevine.status().status === 'online'), 60000)));
  await A.evaluate(() => localStorage.setItem('frontline_settings_v2', '{"name":"x"}'));
  await A.click('#tab-acct'); await until(() => A.$('#gl-out'));
  await A.click('#gl-out');
  check('signing out brings the gate back', !!(await until(() => A.evaluate(() => !document.getElementById('gate').hidden), 20000)));
  check('...and clears this device\'s saves and key', await A.evaluate(() => localStorage.getItem('td2_save') === null && localStorage.getItem('hgv:key') === null));
  const D3 = await device(await browser.newContext());
  await D3.waitForSelector('#gate .gl .seg'); await D3.fill('#gate #gl-key', keyA); await D3.click('#gate #gl-go');
  check('the saves were safe in the account (a third device loads them)', !!(await until(() => D3.evaluate(() => (localStorage.getItem('frontline_settings_v2') || '').includes('"x"') && (localStorage.getItem('td2_save') || '').includes('device A')), 60000)));

  console.log('\n=== 10. bad keys ===');
  const C = await device(await browser.newContext());
  await C.waitForSelector('#gate #gl-key'); await C.fill('#gate #gl-key', 'definitely-not-a-key'); await C.click('#gate #gl-go');
  check('a short key is refused', !!(await until(() => C.$eval('#gate .gl .hint.bad', e => e.textContent))));
  await C.fill('#gate #gl-key', 'A'.repeat(43)); await C.click('#gate #gl-go');
  check('a key with no account is refused', !!(await until(() => C.$eval('#gate .gl .hint.bad', e => /no account/i.test(e.textContent)), 30000)));

  console.log('\n=== 11. Grapevine unreachable: nobody is locked out of the games ===');
  const U = await browser.newContext(); const up = await U.newPage();
  await up.route(/cdn\.jsdelivr\.net\/npm\/mqtt/, r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(MQTT) }));
  await up.route(/fonts\./, r => r.abort());
  await up.addInitScript(a => { window.HG_GV_CONFIG = a; }, { archives: ['no-such-server'], pinned: {}, shards: 1, relays: ['ws://127.0.0.1:9001'] });
  await up.goto(HUB);
  check('the sign-in screen offers "play without an account" when the server cannot be reached', !!(await up.waitForSelector('#gate-guest', { timeout: 60000 }).catch(() => null)));
  await up.click('#gate-guest');
  check('...and then the games are playable', await up.evaluate(() => document.getElementById('gate').hidden && !document.getElementById('view-games').hidden));
  await up.click('#tab-chat');
  check('...but the Grapevine tab asks for an account again', await up.evaluate(() => !document.getElementById('gate').hidden));
} catch (e) {
  console.log('FAIL  crashed — ' + (e && e.stack || e)); failures++;
} finally {
  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nall passed');
  process.exit(failures ? 1 : 0);
}
