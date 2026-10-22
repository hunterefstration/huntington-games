// Grapevine Lite end to end: the launcher tab, accounts, friends, and the proofs games use.
// Needs a running Grapevine test rig (grapevine repo: test/mqtt-broker.mjs, test/serve.mjs not needed,
// `test/up.sh a POW_BITS=8 NEW_ACCOUNT_MS=0` with RELAY_URLS=ws://127.0.0.1:9001) and this repo served on :8090:
//   python3 -m http.server 8090 &   (from the repo root)
//   NODE_PATH=/opt/node22/lib/node_modules node tools/tests/lite.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const HUB = process.env.HUB_URL || 'http://127.0.0.1:8090/index.html';
const ARCHIVE = process.env.RIG_ARCHIVE || 'rig-archive-a';
const MQTT = process.env.MQTT_JS || '/home/user/grapevine/relay/mqtt.min.js';
let failures = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); if (!ok) failures++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 20000, every = 250) {
  const t0 = Date.now();
  for (;;) { try { const v = await fn(); if (v) return v; } catch {} if (Date.now() - t0 > ms) return null; await sleep(every); }
}

const browser = await chromium.launch({ executablePath: process.env.RIG_CHROME || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
async function hub(ctx) {
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('    [pageerror]', e.message));
  await page.route(/cdn\.jsdelivr\.net\/npm\/mqtt|unpkg\.com\/mqtt/, r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(MQTT) }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const TOOLS = process.env.HG_TOOLS || '/tmp/hg-tools';
  await page.route(/cdn\.jsdelivr\.net\/npm\/three@0\.160\.0\/(.*)/, r => {
    const f = TOOLS + '/cdn/package/' + new URL(r.request().url()).pathname.replace(/^\/npm\/three@0\.160\.0\//, '');
    fs.existsSync(f) ? r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(f) }) : r.abort();
  });
  await page.route(/cdn\.tailwindcss\.com/, r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(TOOLS + '/node_modules/tailwindcss-cdn/tailwindcss.js') }));
  await page.addInitScript(a => { window.HG_LITE_CONFIG = a; },
    { archives: [ARCHIVE], pinned: {}, shards: 2, relays: ['ws://127.0.0.1:9001'] });
  await page.goto(HUB);
  return page;
}
const status = p => p.evaluate(() => HGLite.status().status).catch(() => '');

try {
  console.log('\n=== 1. the launcher ===');
  const ctxA = await browser.newContext();
  const A = await hub(ctxA);
  check('games tab is showing, with the game cards', await A.evaluate(() => !document.getElementById('view-games').hidden && document.querySelectorAll('.game').length >= 8));
  check('there is a Grapevine Lite tab', await A.$('#tab-lite') !== null);
  check('the theme is Grapevine\'s (amber signal colour)', await A.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--signal').trim() === '#f0a02c'));
  check('page background follows the theme variable', await A.evaluate(() => getComputedStyle(document.body).backgroundColor !== 'rgb(13, 17, 23)'));

  console.log('\n=== 2. create an account in Lite ===');
  await A.click('#tab-lite');
  await A.waitForSelector('.gl .seg', { timeout: 15000 });
  check('lite loaded and shows sign-in / create', await A.evaluate(() => !!window.HGLite && !!window.HGLiteUI));
  await A.click('.gl .seg button:nth-child(2)');
  await A.fill('#gl-name', 'LiteAlice');
  await A.click('#gl-go');
  await A.waitForSelector('#gl-newkey', { timeout: 5000 });
  const keyA = await A.$eval('#gl-newkey', e => e.textContent);
  check('a recovery key is shown before anything is created', keyA.length >= 40);
  check('continue is locked until the box is ticked', await A.$eval('#gl-fin', e => e.disabled));
  await A.check('#gl-saved');
  await A.click('#gl-fin');
  check('signed in over the relay', !!(await until(async () => (await status(A)) === 'online', 60000)), await status(A));
  check('the account name is shown', (await A.$eval('#gl-me', e => e.textContent).catch(() => '')) === 'LiteAlice');
  check('the header chip shows the name', await A.$eval('#chip-nm', e => e.textContent) === 'LiteAlice');

  console.log('\n=== 3. a second person, friends ===');
  const ctxB = await browser.newContext();
  const B = await hub(ctxB);
  await B.click('#tab-lite'); await B.waitForSelector('.gl .seg', { timeout: 15000 });
  await B.click('.gl .seg button:nth-child(2)');
  await B.fill('#gl-name', 'LiteBob'); await B.click('#gl-go'); await B.waitForSelector('#gl-newkey');
  const keyB = await B.$eval('#gl-newkey', e => e.textContent);
  await B.check('#gl-saved'); await B.click('#gl-fin');
  check('bob signs in', !!(await until(async () => (await status(B)) === 'online', 60000)));
  await A.fill('#gl-add', 'LiteBob'); await A.click('#gl-add-go');
  check('alice sees a request sent', !!(await until(() => A.evaluate(() => HGLite.friendState('LiteBob') === 'outgoing'))));
  check('bob has a request from alice', !!(await until(() => B.evaluate(() => HGLite.friendState('LiteAlice') === 'incoming'))));
  await B.click('.gl .seg button[data-view=requests]');
  await B.waitForSelector('[data-incoming=LiteAlice]');
  await B.click('[data-incoming=LiteAlice] .mbtn');
  check('they are friends', !!(await until(() => A.evaluate(() => HGLite.friendState('LiteBob') === 'friend'))));
  await A.click('.gl .seg button[data-view=friends]');
  check('bob shows online in alice\'s list', !!(await until(() => A.evaluate(() => !!document.querySelector('[data-friend=LiteBob] .dot.on')))));
  const unknown = await A.evaluate(() => HGLite.addFriend('NobodyHere123').then(() => 'ok', e => e.message));
  check('an unknown name is refused with words', /no one|exact/i.test(unknown), unknown);

  console.log('\n=== 4. what games use: proofs ===');
  const ch = await A.evaluate(() => HGLite.newChallenge());
  const proof = await A.evaluate(c => HGLite.prove(c, 'testgame'), ch);
  const good = await B.evaluate(([p, c]) => HGLite.check(p, c, 'testgame'), [proof, ch]);
  check('bob verifies alice\'s proof', good.ok && good.name === 'LiteAlice', JSON.stringify(good));
  const wrongCtx = await B.evaluate(([p, c]) => HGLite.check(p, c, 'othergame'), [proof, ch]);
  check('the proof does not work for another game', !wrongCtx.ok);
  const wrongCh = await B.evaluate(([p]) => HGLite.check(p, 'some-other-challenge', 'testgame'), [proof]);
  check('the proof does not work for another challenge', !wrongCh.ok);
  const forged = await B.evaluate(async ([c]) => {   // bob signs a claim to be LiteAlice with his own key
    const L = HGLite; const me = L.me();
    const p = await L.prove(c, 'testgame'); p.n = 'LiteAlice';
    return L.check(p, c, 'testgame');
  }, [ch]);
  check('claiming someone else\'s name is rejected', !forged.ok, JSON.stringify(forged));
  const stale = await B.evaluate(([p, c]) => { const q = Object.assign({}, p, { t: p.t - 20 * 60000 }); return HGLite.check(q, c, 'testgame'); }, [proof, ch]);
  check('an old proof is rejected', !stale.ok && stale.reason !== undefined);

  console.log('\n=== 5. sign out, sign in again, reload ===');
  await A.reload();
  check('after a reload the account comes back by itself', !!(await until(() => A.evaluate(() => !!window.HGLite && HGLite.status().status === 'online'), 60000)));
  check('the chip shows the name straight away', await A.$eval('#chip-nm', e => e.textContent) === 'LiteAlice');
  await A.click('#tab-lite');
  await until(() => A.$('#gl-out'));
  A.on('dialog', d => d.accept());
  await A.click('#gl-out');
  check('signing out clears the account', await A.evaluate(() => !HGLite.me() && !localStorage.getItem('hglite:key')));
  await A.waitForSelector('#gl-key');
  await A.fill('#gl-key', keyA); await A.click('#gl-go');
  check('the same key signs in again', !!(await until(() => A.evaluate(() => HGLite.status().status === 'online'), 60000)));
  check('friends survive', !!(await until(() => A.evaluate(() => HGLite.friendState('LiteBob') === 'friend'))));
  await A.click('.gl .seg button[data-view=conn]'); await A.click('#gl-test');
  check('connection test lists the relay', !!(await until(() => A.$eval('#gl-diag', e => /OK|BLOCKED/.test(e.textContent)), 30000)));

  console.log('\n=== 6. from the launcher into a game ===');
  await A.click('#tab-games');
  await A.click('.game:has-text("Blocky Shooter")');
  const gf = await until(async () => { const f = A.frames().find(x => /Blocky%20Shooter%20V2\/index/.test(x.url())); return f && (await f.$('#btn-mp')) ? f : null; }, 90000);
  check('the game opens inside the launcher', !!gf);
  if (gf) {
    await gf.click('#btn-mp');
    check('the game sees the launcher\'s Lite account', await gf.evaluate(() => !!(window.parent.HGLite && window.parent.HGLite.me())));
    check('its multiplayer name is the account name, locked', await gf.$eval('#mp-name', e => e.readOnly && e.value === 'LiteAlice'));
  }
  await A.evaluate(() => document.getElementById('back').click());

  console.log('\n=== 7. bad keys ===');
  const ctxC = await browser.newContext(); const C = await hub(ctxC);
  await C.click('#tab-lite'); await C.waitForSelector('#gl-key');
  await C.fill('#gl-key', 'definitely-not-a-key'); await C.click('#gl-go');
  check('a short key is refused', !!(await until(() => C.$eval('.gl .hint.bad', e => e.textContent))));
  await C.fill('#gl-key', 'A'.repeat(43)); await C.click('#gl-go');
  check('a key with no account is refused', !!(await until(() => C.$eval('.gl .hint.bad', e => /no account/i.test(e.textContent)), 30000)));
} catch (e) {
  console.log('FAIL  crashed — ' + (e && e.stack || e)); failures++;
} finally {
  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nall passed');
  process.exit(failures ? 1 : 0);
}
