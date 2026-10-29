// Cloud saves when the database will not let the server change rows (42501): it must move saves elsewhere and keep working.
// PERM_MODE=midrun (default): updates on user_saves AND settings are refused mid-run.
// PERM_MODE=rls: row-level security is on for both tables when the server starts (the archive is restarted).
// Same rig and setup as gv.mjs.
//   NODE_PATH=/opt/node22/lib/node_modules node tools/tests/gv-saves-perm.mjs   (reset the rig database first)
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

import { execSync } from 'node:child_process';
const psql = sql => execSync(`PGPASSWORD=x psql -q -h 127.0.0.1 -p 55432 -U postgres -d grapevine_test -c "${sql}"`);
const MODE = process.env.PERM_MODE || 'midrun';
const restartArchive = () => execSync(`cd /home/user/grapevine && cat .archive-a.log >> /tmp/arch-hist.log 2>/dev/null; PGPASSWORD=x PGPORT=55432 test/up.sh stop a >/dev/null 2>&1; DATABASE_URL="postgres://grapevine_archive:rigpass123@127.0.0.1:55432/grapevine_test" PGPASSWORD=x PGPORT=55432 test/up.sh a POW_BITS=8 NEW_ACCOUNT_MS=0 GV_DIRECT_PORT=8787 GV_DIRECT_URL=ws://127.0.0.1:8787/gv >/dev/null; for i in $(seq 1 60); do grep -q "direct door reachable" .archive-a.log && break; sleep 0.5; done; sleep 2`);
const restore = () => { psql('GRANT SELECT, INSERT, UPDATE, DELETE ON grapevine.user_saves TO grapevine_archive'); psql('GRANT SELECT, INSERT, UPDATE ON grapevine.settings TO grapevine_archive');
  psql('ALTER TABLE grapevine.user_saves DISABLE ROW LEVEL SECURITY'); psql('ALTER TABLE grapevine.settings DISABLE ROW LEVEL SECURITY'); };
try {
  restore();
  if (MODE === 'rls') { psql('ALTER TABLE grapevine.user_saves ENABLE ROW LEVEL SECURITY'); psql('ALTER TABLE grapevine.settings ENABLE ROW LEVEL SECURITY'); restartArchive(); }
  const A = await device(await browser.newContext());
  await createAccount(A, 'Perm' + (Date.now() % 1e6));
  await until(async () => (await status(A)) === 'online', 60000);
  await A.evaluate(() => localStorage.setItem('td2_save', '{"wave":1}'));
  await A.evaluate(() => HGGrapevine.sync.run());
  check('first save stored', (await A.evaluate(() => HGGrapevine.sync.status().state)) === 'ok');
  if (MODE === 'midrun') { psql('REVOKE UPDATE ON grapevine.user_saves FROM grapevine_archive'); psql('REVOKE UPDATE ON grapevine.settings FROM grapevine_archive'); }   // the database now refuses changes
  await A.evaluate(() => localStorage.setItem('td2_save', '{"wave":9}'));
  const r = await A.evaluate(() => HGGrapevine.sync.run().then(x => ({ ok: true, x }), e => ({ ok: false, e: e.message })));
  check('a changed save still syncs after the database refuses updates', r.ok && (await A.evaluate(() => HGGrapevine.sync.status().state)) === 'ok', JSON.stringify(r) + ' ' + await A.evaluate(() => HGGrapevine.sync.status().text));
  const key = await A.evaluate(() => HGGrapevine.key());
  const B = await device(await browser.newContext());
  await B.waitForSelector('#gate .gl .seg'); await B.fill('#gate #gl-key', key); await B.click('#gate #gl-go');
  check('another device gets the newest save', !!(await until(() => B.evaluate(() => /"wave":9/.test(localStorage.getItem('td2_save') || '')), 40000)));
} catch (e) { console.log('ERROR', e && e.stack || e); failures++; }
restore(); if (MODE === 'rls') restartArchive();
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
