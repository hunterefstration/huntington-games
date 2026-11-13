// Reports: the always-there button, the three-step dialog, what the server keeps, and the admins' inbox.
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
const dlg = P => P.evaluate(() => { const d = document.getElementById('reportdlg'); return d.hidden ? '' : d.innerText.replace(/\s+/g, ' '); });
try {
  const D = await device(await browser.newContext({ viewport: { width: 1280, height: 800 } }));
  await createAccount(D, 'RepAdmin'); await until(async () => (await status(D)) === 'online', 60000);
  const A = await device(await browser.newContext({ viewport: { width: 1280, height: 800 } }));
  await createAccount(A, 'RepAnn'); await until(async () => (await status(A)) === 'online', 60000);
  const B = await device(await browser.newContext({ viewport: { width: 1280, height: 800 } }));
  await createAccount(B, 'RepBob'); await until(async () => (await status(B)) === 'online', 60000);
  for (const P of [D, A, B]) await P.click('#tour .skip', { timeout: 3000 }).catch(() => {});
  console.log('\n=== 1. the button is always there ===');
  check('a Report button sits in the top bar', await A.evaluate(() => { const b = document.getElementById('reportBtn'), r = b.getBoundingClientRect(); return /Report/.test(b.textContent) && r.width > 40 && r.top < 80; }));
  check('the top bar is still one line at 1280', await A.evaluate(() => { const t = [...document.querySelectorAll('#topbar > *')].filter(e => e.offsetParent).map(e => Math.round(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2)); return Math.max(...t) - Math.min(...t) < 24; }));
  await A.evaluate(() => { document.querySelector('.game[data-dir="Tetris"]').click(); }); await A.waitForSelector('#player.open', { timeout: 20000 });
  check('...and in the bar above a game', await A.evaluate(() => { const b = document.getElementById('preport'); return b.offsetParent !== null && /Report/.test(b.textContent); }));
  console.log('\n=== 2. reporting a player from inside a game ===');
  await A.click('#preport');
  check('it asks what the report is about', /What do you want to report/.test(await dlg(A)) && await A.evaluate(() => document.querySelectorAll('.rp-kind').length === 4));
  await A.click('[data-rpk="player"]');
  check('the game you are in is already filled in', await A.evaluate(() => /Tetris/.test(document.getElementById('rp-game').value)));
  await A.click('[data-rp="send"]');
  check('a name is asked for', /name/i.test(await A.evaluate(() => document.getElementById('rp-err').textContent)));
  await A.fill('#rp-who', 'RepBob'); await A.click('[data-rp="send"]');
  check('...and a reason', /reason/i.test(await A.evaluate(() => document.getElementById('rp-err').textContent)));
  await A.click('[data-rpw="cheat"]'); await A.fill('#rp-text', 'He flies through walls.'); await A.click('[data-rp="send"]');
  check('it is sent, with a thank you', !!(await until(async () => /Sent\. Thank you/.test(await dlg(A)), 8000)), await dlg(A));
  await A.click('[data-rp="x"]'); await A.evaluate(() => document.getElementById('back').click());
  console.log('\n=== 3. a bug, and the limits ===');
  await A.click('#reportBtn'); await A.click('[data-rpk="bug"]'); await A.click('[data-rp="send"]');
  check('a bug report needs a few words', /few words/.test(await A.evaluate(() => document.getElementById('rp-err').textContent)));
  await A.selectOption('#rp-game', { index: 2 }); await A.fill('#rp-text', 'The second level never ends.'); await A.click('[data-rp="send"]');
  check('the bug report is sent', !!(await until(async () => /Sent/.test(await dlg(A)), 8000)));
  await A.keyboard.press('Escape');
  check('Esc closes the dialog', (await dlg(A)) === '');
  const self = await A.evaluate(() => HGGrapevine.eco.report({ kind: 'player', who: 'RepAnn', why: 'cheat', text: 'me' }).then(() => 'ok', e => e.message));
  check('you cannot report yourself', /That is you/.test(self), self);
  const gone = await A.evaluate(() => HGGrapevine.eco.report({ kind: 'message', msgId: 'nope', why: 'spam' }).then(() => 'ok', e => e.message));
  check('a message that does not exist cannot be reported', /gone/.test(gone), gone);
  const flood = await A.evaluate(async () => { let last = ''; for (let i = 0; i < 6; i++) last = await HGGrapevine.eco.report({ kind: 'other', why: 'other', text: 'note number ' + i }).then(() => 'ok', e => e.message); return last; });
  check('reports are limited (5 in ten minutes)', /lot of reports|Slow down/.test(flood), flood);
  const peek = await A.evaluate(() => Promise.race([HGGrapevine.eco.reports('list').then(m => m.list ? 'LIST' : 'none', e => e.message), new Promise(r => setTimeout(() => r('nothing'), 3000))]));
  check('players cannot read the inbox', peek !== 'LIST', peek);
  console.log('\n=== 4. the admins\' inbox ===');
  check('the admin\'s button shows how many are waiting', !!(await until(() => D.evaluate(() => /Reports\s*\d/.test(document.getElementById('reportBtn').textContent)), 10000)), await D.evaluate(() => document.getElementById('reportBtn').textContent));
  await D.click('#reportBtn');
  const inbox = await until(async () => { const t = await dlg(D); return /RepBob/.test(t) ? t : null; }, 8000);
  check('the inbox lists the report: who, about whom, where, why, what', /Player/.test(inbox || '') && /Cheating/.test(inbox) && /RepBob/.test(inbox) && /Tetris/.test(inbox) && /flies through walls/.test(inbox) && /RepAnn/.test(inbox), (inbox || '').slice(0, 300));
  const n0 = await D.evaluate(() => document.querySelectorAll('.rp-item:not(.closed)').length);
  await D.evaluate(() => { [...document.querySelectorAll('.rp-item')].find(e => /flies through walls/.test(e.textContent)).querySelector('[data-rpa="close"]').click(); });
  check('marking one as handled takes it off the open pile', !!(await until(() => D.evaluate(n => document.querySelectorAll('.rp-item:not(.closed)').length === n - 1, n0), 8000)));
  await D.keyboard.press('Escape');
  await D.reload(); await until(async () => (await status(D)) === 'online', 60000);
  await until(() => D.evaluate(() => /Reports/.test(document.getElementById('reportBtn').textContent)), 15000); await D.click('#reportBtn');
  check('reports are kept on the server (still there after a reload)', !!(await until(async () => /flies through walls/.test(await dlg(D)), 8000)));
  if (process.env.SHOT) { await D.keyboard.press('Escape'); await A.click('#reportBtn'); await A.click('[data-rpk="player"]'); await A.screenshot({ path: process.env.SHOT }); }
} catch (e) { console.log('ERROR', e && e.stack || e); failures++; }
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
