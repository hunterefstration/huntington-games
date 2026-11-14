// Rebuilding lost progress from the leaderboards and claimed achievements (Profile, Admin, "Rebuild from leaderboards"):
// a player with real progress loses it, an admin rebuilds it, and the rebuilt saves load in the games themselves.
//   bash tools/rig/test.sh gv-rebuild
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
const LV = []; for (let w = 1; w <= 2; w++) for (let n = 1; n <= 10; n++) LV.push(w + '-' + n); LV.push('3-1', '3-2');      // 22 levels done, both first guardians
try {
  const D = await device(await browser.newContext({ viewport: { width: 1280, height: 900 } }));
  await createAccount(D, 'RebBoss'); await until(async () => (await status(D)) === 'online', 60000);
  const U = await device(await browser.newContext({ viewport: { width: 1280, height: 900 } }));
  await createAccount(U, 'RebLost'); await until(async () => (await status(U)) === 'online', 60000);
  console.log('=== a player with real progress ===');
  await U.evaluate(lv => {
    const levels = {}; lv.forEach((id, i) => { levels[id] = { best: 20 + i, moths: [true, false, true], sparks: 3, clears: 2 }; });
    localStorage.setItem('lumi_save', JSON.stringify({ v: 3, levels, abilities: { double: true, wall: true, dash: false }, deaths: 9, sparks: 40, playTime: 3600, runs: { onelife: 7 } }));
    localStorage.setItem('blocky21_life', JSON.stringify({ xp: 5000, prestige: 2, kills: 4321, headshots: 300, best: { classic: 31 }, waves: 200 }));
    localStorage.setItem('brownEClickerSave', JSON.stringify({ state: { brownEs: 5e15 }, life: { earned: 8e20 }, run: { earned: 1e15 }, meta: { chips: 50, chipsTotal: 900000, ascensions: 12, bestRunChips: 1, tree: { root: true } } }));
    localStorage.setItem('spikes100_progress', JSON.stringify({ unlocked: 64, bestOneLife: 12 }));
    localStorage.setItem('hgach:v1', JSON.stringify({ lu_first: Date.now(), bl_w10: Date.now() }));
  }, LV);
  await U.evaluate(() => HGGrapevine.sync.run());
  await U.evaluate(() => feedNow()); await sleep(3000);
  const look0 = await D.evaluate(() => HGGrapevine.eco.acctLook('RebLost'));
  check('the leaderboards have their numbers', look0.boards.some(b => b.key === 'lumi:lv2-10') && look0.boards.some(b => b.key === 'blocky:xp') && look0.boards.some(b => b.key === 'clicker:total'), look0.boards.map(b => b.key).join(','));
  console.log('\n=== the progress is lost (every save replaced by an almost empty one) ===');
  await U.evaluate(() => {
    localStorage.setItem('lumi_save', JSON.stringify({ v: 3, levels: { '1-1': { best: 99, moths: [false, false, false], sparks: 0, clears: 1 } }, abilities: { double: false, wall: false, dash: false } }));
    localStorage.setItem('blocky21_life', JSON.stringify({ xp: 10, prestige: 0, kills: 3, best: {} }));
    localStorage.setItem('brownEClickerSave', JSON.stringify({ state: { brownEs: 10 }, life: { earned: 100 }, run: { earned: 100 }, meta: { chips: 0, chipsTotal: 0, ascensions: 0, bestRunChips: 0, tree: {} } }));
    localStorage.setItem('spikes100_progress', JSON.stringify({ unlocked: 1 }));
    localStorage.removeItem('hgach:v1');
    return HGGrapevine.sync.run();
  });
  console.log('\n=== the admin rebuilds it ===');
  D.on('dialog', d => d.accept());
  await D.evaluate(() => document.getElementById('tab-prof').click());
  await until(() => D.evaluate(() => !!document.querySelector('[data-ptab]')), 15000);
  await D.evaluate(() => { const b = document.querySelector('[data-ptab="admin"]'); if (b) b.click(); });
  await until(() => D.evaluate(() => !!document.getElementById('pa-look')), 15000);
  await D.fill('#pa-look', 'RebLost'); await D.click('[data-padm="look"]');
  await until(() => D.evaluate(() => !!document.querySelector('[data-padm="rebuild"]')), 15000);
  await D.click('[data-padm="rebuild"]');
  const preview = await until(() => D.evaluate(() => { const t = document.getElementById('pa-lookout').innerText; return /Rebuild for/.test(t) ? t : null; }), 15000);
  check('a preview says what comes back', /Last Light: 22 finished levels/.test(preview || '') && /Blocky/.test(preview || '') && /Brown E Clicker/.test(preview || '') && /achievements/.test(preview || ''), (preview || '').replace(/\s+/g, ' ').slice(0, 300));
  await D.click('[data-padm="rebuild-go"]');
  const done = await until(() => D.evaluate(() => { const t = document.getElementById('pa-lookout').innerText; return /Rebuilt \d+ save/.test(t) ? t : null; }), 15000);
  check('the rebuilt saves are written', !!done, String(done).slice(0, 120));
  await U.evaluate(() => HGGrapevine.sync.run());
  const got = await U.evaluate(() => ({ lumi: JSON.parse(localStorage.getItem('lumi_save')), bl: JSON.parse(localStorage.getItem('blocky21_life')), cl: JSON.parse(localStorage.getItem('brownEClickerSave')), sp: JSON.parse(localStorage.getItem('spikes100_progress')), ach: JSON.parse(localStorage.getItem('hgach:v1') || '{}') }));
  check('Last Light: every level finished, with its best time', LV.every((id, i) => got.lumi.levels[id] && got.lumi.levels[id].clears >= 1 && got.lumi.levels[id].best === 20 + i), JSON.stringify(got.lumi.levels['2-10']));
  check('...the two guardians\' abilities, and the one-life best', got.lumi.abilities.double && got.lumi.abilities.wall && !got.lumi.abilities.dash && got.lumi.runs && got.lumi.runs.onelife === 7);
  check('Blocky: prestige, XP and kills', got.bl.prestige === 2 && got.bl.xp === 5000 && got.bl.kills === 4321 && got.bl.best.classic === 31, JSON.stringify(got.bl));
  check('Brown E Clicker: Brown E\'s made, ascensions, and heavenly chips worth one run of the lifetime total', got.cl.life.earned === 8e20 && got.cl.meta.ascensions === 12 && got.cl.meta.chipsTotal === Math.floor(Math.cbrt(8e20 / 1e9)), JSON.stringify(got.cl.meta));
  check('Spikes: levels unlocked', got.sp.unlocked === 64 && got.sp.bestOneLife === 12);
  check('the achievements', !!got.ach.lu_first && !!got.ach.bl_w10, JSON.stringify(got.ach));
  console.log('\n=== the rebuilt Last Light save works in the game ===');
  await U.evaluate(() => { closePlayer && closePlayer(); playNow(GAMES.find(g => g.dir === 'Last Light')); });
  const F = await until(async () => { const f = U.frames().find(f => /Last%20Light\/index/.test(f.url())); return f && await f.evaluate(() => !!window.__lumi).catch(() => false) ? f : null; }, 40000);
  if (!F) console.log('    frames:', U.frames().map(f => f.url().slice(0, 90)).join(' | '));
  const inGame = F && await F.evaluate(() => ({ n: Object.keys(__lumi.SAVE.d.levels).length, dbl: __lumi.SAVE.d.abilities.double, best: __lumi.SAVE.d.levels['2-10'].best }));
  check('Last Light loads it: 22 levels, the abilities, the times', !!inGame && inGame.n === 22 && inGame.dbl && inGame.best === 39, JSON.stringify(inGame));
  await U.evaluate(() => { try { closePlayer(); } catch (e) {} }); await sleep(1500); await U.evaluate(() => { feedNow(); return HGGrapevine.sync.run(); }); await sleep(2000);      // (opening the game earned new achievements: let them all arrive)
  const dbg = await D.evaluate(() => HGGrapevine.eco.acctLook('RebLost').then(look => HGGrapevine.eco.savesAdminGet('RebLost', ['hgach:v1']).then(r => { const g = JSON.parse((r.values[0] || {}).v || '{}'); return { server: look.achIds.filter(i => !g[i]), local: Object.keys(g).length }; })));
  console.log('    achievements the saved list lacks:', JSON.stringify(dbg));
  const again = await D.evaluate(() => HGGrapevine.eco.acctLook('RebLost').then(look => rbBuild(look.boards, {}, []) && HGGrapevine.eco.savesAdminGet('RebLost', RB_KEYS).then(r => { const cur = {}; r.values.forEach(x => { cur[x.k] = x.v; }); const k = Object.keys(rbBuild(look.boards, cur, look.achIds).saves); return k.length ? k.join(',') : 0; })));
  check('a second rebuild changes no save (only achievements claimed in the meantime can be added)', again === 0 || again === 'hgach:v1', String(again));
} catch (e) { console.log('ERROR', e && e.stack || e); failures++; }
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
