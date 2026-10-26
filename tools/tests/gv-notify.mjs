// In-game notifications and chat (T), and the Grapevine tab menu buttons. Same rig and setup as gv.mjs.
//   NODE_PATH=/opt/node22/lib/node_modules node tools/tests/gv-notify.mjs   (reset the rig database first)
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

try {
  const [A, appA] = await signedIn('NtAlice');
  const [B, appB] = await signedIn('NtBob');
  await appA.evaluate(() => GV.openConv('main')); await appB.evaluate(() => GV.openConv('main'));

  console.log('\n=== 1. the Grapevine tab\'s top buttons ===');
  for (const w of [1280, 900, 600, 420]) {
    await A.setViewportSize({ width: w, height: 800 });
    await A.click('#tab-chat');
    await A.waitForTimeout(400);
    const res = await A.evaluate(() => {
      const fr = document.getElementById('gvapp'), r = fr.getBoundingClientRect(), d = fr.contentDocument, out = {};
      for (const id of ['mentionsBtn', 'starsBtn', 'friendsBtn', 'opsBtn']) {
        const b = d.getElementById(id), br = b && b.getBoundingClientRect();
        if (!br || !br.width || br.right < 0 || br.left > innerWidth) { out[id] = 'hidden'; continue; }
        const el = document.elementFromPoint(r.left + br.left + br.width / 2, r.top + br.top + br.height / 2);
        out[id] = el === fr ? 'ok' : 'covered by ' + (el && (el.id || el.tagName));
      }
      for (const id of ['tab-games', 'tab-chat', 'tab-acct', 'chip']) { const b = document.getElementById(id), br = b.getBoundingClientRect(), el = document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2); out[id] = br.right <= innerWidth && b.contains(el) ? 'ok' : 'blocked by ' + (el && (el.id || el.tagName)); }
      return out;
    });
    const bad = Object.entries(res).filter(([, v]) => v !== 'ok' && v !== 'hidden');
    check(`width ${w}: every top button of the app can be reached by the mouse`, bad.length === 0, JSON.stringify(res));
  }
  await A.setViewportSize({ width: 1280, height: 800 });
  await A.click('#tab-chat'); await appA.evaluate(() => GV.dismissGuide()); await A.waitForTimeout(700);
  const fb = await A.evaluate(() => { const r = document.getElementById('gvapp').getBoundingClientRect(), b = document.getElementById('gvapp').contentDocument.getElementById('friendsBtn').getBoundingClientRect(); return [r.left + b.left + b.width / 2, r.top + b.top + b.height / 2]; });
  await A.mouse.click(fb[0], fb[1]);
  check('a real click on Friends opens the friends window', !!(await until(() => appA.evaluate(() => !!document.querySelector('#friendsModal.on')), 5000)));
  await appA.evaluate(() => { closeModals(); });
  await A.click('#tab-games');

  console.log('\n=== 2. into a game: pop-ups and chat on T ===');
  const gfA = await playTetris(A), gfB = await playTetris(B);
  check('Tetris opens for both', !!gfA && !!gfB);
  await A.waitForTimeout(1500);
  // B says something with A inside a game: A should get a pop-up over the game
  await appB.evaluate(() => GV.openConv('main'));
  await say(appB, 'toast test hello @NtAlice');
  check('a mention shows up as a pop-up over the game', !!(await until(() => A.evaluate(() => !!document.querySelector('#hgt-host .hgt')), 20000)));
  const tt = await A.evaluate(() => (document.querySelector('#hgt-host .hgt') || {}).textContent || '');
  check('...with the sender and the text', /NtBob/.test(tt) && /toast test hello/.test(tt), tt.slice(0, 80));
  await A.evaluate(() => document.querySelector('#hgt-host .hgt')?.remove());
  // T opens the chat window inside the game
  await A.evaluate(() => document.getElementById('frame').contentWindow.focus());
  await A.evaluate(() => { const w = document.getElementById('frame').contentWindow; w.__keys = []; w.addEventListener('keydown', e => w.__keys.push(e.key), true); });
  await A.keyboard.press('t');
  check('pressing T opens the chat window over the game', !!(await until(() => A.evaluate(() => !!document.getElementById('frame').contentDocument.getElementById('hgc-box')), 8000)));
  check('...and the typed t did not land in the box', await A.evaluate(() => document.getElementById('frame').contentDocument.getElementById('hgc-box').contentDocument.querySelector('input').value === ''));
  check('...it lists the conversation and its messages', !!(await until(() => A.evaluate(() => /toast test hello/.test(document.getElementById('frame').contentDocument.getElementById('hgc-box').contentDocument.querySelector('.ls').textContent)), 10000)));
  await A.keyboard.type('sent from inside tetris'); await A.keyboard.press('Enter');
  check('a message sent from the game reaches the other player', !!(await until(() => appB.$eval('#log', e => e.innerText.includes('sent from inside tetris')), 30000)));
  check('the game never saw the keys typed into the chat', await A.evaluate(() => document.getElementById('frame').contentWindow.__keys.filter(k => k !== 't').length === 0), await A.evaluate(() => document.getElementById('frame').contentWindow.__keys.join('')));
  await A.keyboard.press('Escape'); await A.waitForTimeout(300);
  check('Escape closes it', await A.evaluate(() => !document.getElementById('frame').contentDocument.getElementById('hgc-box')));
  // a live message while the box is open appears in it, without a pop-up for that conversation
  await A.keyboard.press('t');
  await say(appB, 'live line');
  check('a message that arrives while the window is open shows up in it', !!(await until(() => A.evaluate(() => /live line/.test(document.getElementById('frame').contentDocument.getElementById('hgc-box').contentDocument.querySelector('.ls').textContent)), 20000)));
  await A.keyboard.press('Escape');

  const [pop] = await Promise.all([A.context().waitForEvent('page', { timeout: 15000 }).catch(() => null), A.click('#newtab')]);
  if (pop) {
    await pop.waitForTimeout(2500);
    await pop.keyboard.press('t');
    check('T opens the chat in the New tab copy of the game too', !!(await until(() => pop.evaluate(() => !!document.getElementById('hgc-box')), 8000)));
    await pop.keyboard.press('Escape');
    await say(appB, 'popup ping @NtAlice');
    check('pop-ups show in the New tab copy as well', !!(await until(() => pop.evaluate(() => !!document.querySelector('#hgt-host .hgt')), 20000)));
    await pop.close();
  } else check('the New tab copy opened', false);
  check('Shift+T (not plain T) is the key for games that use T themselves', await A.evaluate(() => {
    const f = document.createElement('iframe'); document.body.appendChild(f); const d = f.contentDocument;
    attachChat(d, { chatShift: true });
    d.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true, cancelable: true })); const plain = !!d.getElementById('hgc-box');
    d.dispatchEvent(new KeyboardEvent('keydown', { key: 'T', shiftKey: true, bubbles: true, cancelable: true })); const shifted = !!d.getElementById('hgc-box');
    f.remove(); return !plain && shifted; }));

  console.log('\n=== 3. friend requests as pop-ups; games that must keep T ===');
  await B.evaluate(() => HGGrapevine.addFriend('NtAlice'));
  check('a friend request pops up with Accept / Decline', !!(await until(() => A.evaluate(() => !![...document.querySelectorAll('#hgt-host .hgt')].find(t => /Friend request/.test(t.textContent) && t.querySelector('button.go'))), 30000)));
  await A.evaluate(() => [...document.querySelectorAll('#hgt-host .hgt button.go')][0].click());
  check('Accept in the pop-up makes them friends', !!(await until(() => A.evaluate(() => HGGrapevine.friendState('NtBob') === 'friend'), 20000)));
  await A.evaluate(() => document.getElementById('back').click());
  check('the launcher flags games that keep their own T', await A.evaluate(() => { const g = (window.GAMES || []).concat(window.EXPERIMENTAL || []); return g.some(x => x.dir === 'Frontline' && x.chatShift) && g.some(x => /Levi Dash/.test(x.dir) && x.noChat); }));
} catch (e) { console.log('ERROR', e && e.stack || e); failures++; }
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
