// Achievements: worked out from game saves, announced, shown in Account and on the Grapevine profile card, shared into chats. Same rig and setup as gv.mjs.
//   NODE_PATH=/opt/node22/lib/node_modules node tools/tests/gv-ach.mjs   (reset the rig database first)
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
  const [A, appA] = await signedIn('AchAlice');
  const [B, appB] = await signedIn('AchBob');
  await A.waitForTimeout(5000);   // the first look on a device is quiet
  await A.evaluate(() => {
    localStorage.setItem('spikes100_progress', JSON.stringify({ unlocked: 30, beaten: false, bestOneLife: 2, bestEndless: 0 }));
    localStorage.setItem('huntingtonTetrisSurge1', JSON.stringify({ stats: { lines: 150, games: 3, tetrises: 1 } }));
    localStorage.setItem('frontline_profile_v2', JSON.stringify({ wins: 1, games: 2, kills: 40 }));
  });
  const fresh = await A.evaluate(() => HGAch.check().map(a => a.id));
  check('progress in game saves unlocks achievements', ['sp10', 'sp25', 'ts1', 'ts100', 'fl1'].every(x => fresh.includes(x)), fresh.join(','));
  check('nothing is unlocked that was not earned', !fresh.includes('sp50') && !fresh.includes('ts1000'));
  check('an unlock pops up a notification', !!(await until(() => A.evaluate(() => [...document.querySelectorAll('#hgt-host .hgt')].some(t => /Achievement unlocked/.test(t.textContent))), 5000)));
  check('checking again does not announce them twice', (await A.evaluate(() => HGAch.check().length)) === 0);
  check('they are kept in a key that cloud saves carry', await A.evaluate(() => /sp25/.test(localStorage.getItem('hgach:v1') || '')));

  console.log('\n=== the Account tab ===');
  await A.evaluate(() => document.getElementById('chip').click());
  await A.waitForSelector('[data-view="ach"]', { timeout: 10000 }); await A.evaluate(() => document.querySelector('[data-view="ach"]').click());
  const total = await until(() => A.$eval('#gl-ach-total', e => e.textContent), 8000);
  check('Account > Achievements lists them with points', !!total && /^5 of \d+ - \d+ points$/.test(total), total);

  console.log('\n=== on the Grapevine profile card ===');
  await B.click('#tab-chat');
  await appB.evaluate(() => { GV.dismissGuide && GV.dismissGuide(); openUser('AchAlice'); });
  const card = await until(() => appB.evaluate(() => { const p = document.getElementById('umProfile'); return p && /achievements/.test(p.textContent) ? p.textContent : ''; }), 15000);
  check('other people see the achievements on the profile card', !!card && /5 of \d+ achievements/.test(card), card && card.slice(0, 120));

  console.log('\n=== share one ===');
  await appB.evaluate(() => { closeModals(); GV.openConv('main'); });
  await A.evaluate(() => document.querySelector('[data-share="sp25"]').click());
  await A.waitForTimeout(300);
  const sent = await A.evaluate(() => { const b = [...document.querySelectorAll('[data-ach="sp25"] ~ .diag button, .diag button')].find(x => x.textContent === 'Send'); if (b) b.click(); return !!b; });
  check('Share offers the chats', sent);
  check('the friend sees an achievement card in the chat', !!(await until(() => appB.evaluate(() => [...document.querySelectorAll('#log .rcard.ach')].some(c => /Pointy Business/.test(c.textContent))), 15000)));
} catch (e) { console.log('ERROR', e && e.stack || e); failures++; }
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
