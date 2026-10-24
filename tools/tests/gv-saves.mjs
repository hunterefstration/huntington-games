// Cloud saves with real games: play, close, sign in on a second device. Same rig and setup as gv.mjs.
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
      .replace("connect-src 'self' ", "connect-src 'self' ws://127.0.0.1:9001 ws://127.0.0.1:9999 ")
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


const GAMES = ['Brown E Clicker', 'Bean & Brew Tycoon 2.0', 'Tetris Surge', 'Frontline'];   // card names; each writes a save by itself within seconds
const plain = async (P, name, secs) => {
  await P.evaluate(n => { [...document.querySelectorAll('.game')].find(g => g.textContent.includes(n)).click(); }, name);
  await P.waitForSelector('#player.open', { timeout: 20000 });
  await P.waitForTimeout(secs * 1000);
  for (let i = 0; i < 5; i++) { await P.mouse.click(640, 300 + i * 30).catch(() => {}); await P.waitForTimeout(400); }
  await P.waitForTimeout(3000);
  await P.evaluate(() => document.getElementById('back').click());
  await P.waitForTimeout(800);
};
const snapshot = P => P.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^(spikes100_|blocky|huntington|brownEClicker|beanBrew|neon|tetrisHighScore|frontline_|lifeScorePB|marketLife|netWorthPB|td2_|td-|sov\.)/.test(k)) o[k] = localStorage.getItem(k).length; } return o; });

try {
  const A = await device(await browser.newContext({ viewport: { width: 1280, height: 800 } }));
  await createAccount(A, 'SvAlice');
  await until(async () => (await status(A)) === 'online', 60000);
  for (let i = 0; i < 6; i++) await A.click('#tour .go', { timeout: 1500 }).catch(() => {});
  await A.click('#tour .skip', { timeout: 500 }).catch(() => {});
  console.log('\n=== 1. play real games on device A ===');
  for (const g of GAMES) await plain(A, g, 6);
  const sa = await snapshot(A);
  console.log('    device A now holds:', JSON.stringify(sa));
  check('the games wrote saves on device A', Object.keys(sa).length >= 3, Object.keys(sa).join(','));
  await A.evaluate(() => HGGrapevine.sync.run());
  const st = await A.evaluate(() => HGGrapevine.sync.status());
  check('they were synced to the account', st.state === 'ok', JSON.stringify(st));
  console.log('\n=== 2. sign in on device B ===');
  const keyA = await A.evaluate(() => HGGrapevine.key());
  const B = await device(await browser.newContext({ viewport: { width: 1280, height: 800 } }));
  await B.waitForSelector('#gate .gl .seg');
  await B.fill('#gate #gl-key', keyA); await B.click('#gate #gl-go');
  await B.waitForSelector('#gate[hidden]', { state: 'attached', timeout: 60000 });
  const sb = await until(async () => { const s = await snapshot(B); return Object.keys(s).length >= Object.keys(sa).length ? s : null; }, 40000);
  check('every save from device A arrived on device B', !!sb, JSON.stringify(await snapshot(B)));
  if (sb) for (const k of Object.keys(sa)) check('  ' + k + ' has the same size', sb[k] === sa[k], `${sa[k]} vs ${sb[k]}`);
  await B.click('#tour .skip', { timeout: 3000 }).catch(() => {}); await B.evaluate(() => document.getElementById('chip').click()); await B.waitForSelector('#gl-saves-show', { timeout: 10000 });
  await B.evaluate(() => document.getElementById('gl-saves-show').click());
  const det = await until(() => B.$eval('#gl-saves-detail', e => /in account/.test(e.textContent) ? e.textContent : ''), 15000);
  check('the Saves tab can show what is saved, key by key', !!det && /brownEClickerSave/.test(det), (det || '').slice(0, 120));
} catch (e) { console.log('ERROR', e && e.stack || e); failures++; }
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
