// Round 11: the Admin menu, answering reports (act or dismiss, a note to the reporter, delivered later if they are away), stored warnings, Rules.
// (mute, funny effects, forced nickname, bonk, timed bans), and the n-word ladder. Same rig and setup as gv.mjs.
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
const boxText = page => page.evaluate(() => [...document.querySelectorAll('.hubmodbox')].map(b => b.innerText).join('\n'));
const closeBoxes = page => page.evaluate(() => document.querySelectorAll('.hubmodbox button').forEach(b => b.click()));
try {
  const O = await device(await browser.newContext({ viewport: { width: 1280, height: 900 } }));
  await createAccount(O, 'AdmBoss'); await until(async () => (await status(O)) === 'online', 60000);
  const Pctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); let P = await device(Pctx);
  await createAccount(P, 'AdmPat'); await until(async () => (await status(P)) === 'online', 60000);
  const Rctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); let R = await device(Rctx);
  await createAccount(R, 'AdmRita'); await until(async () => (await status(R)) === 'online', 60000);
  for (const pg of [O, P, R]) await pg.click('#tour .skip').catch(() => {});

  console.log('=== the Admin tab ===');
  check('the owner has an Admin tab in the top bar', !!(await until(() => O.evaluate(() => !document.getElementById('tab-admin').hidden), 15000)));
  check('a player does not', await P.evaluate(() => document.getElementById('tab-admin').hidden));
  await O.click('#tab-admin');
  const navs = await until(() => O.evaluate(() => { const n = [...document.querySelectorAll('.adm-nav')].map(b => b.textContent.trim()); return n.length >= 6 ? n : null; }), 15000);
  check('it has every section (Overview, Reports, Players, Muted & banned, Admins, Server)', !!navs && ['Overview', 'Reports', 'Players', 'Muted', 'Admins', 'Server'].every(w => navs.some(x => x.includes(w))), JSON.stringify(navs));
  check('the Overview says you are the owner', await O.evaluate(() => /You are the owner/.test(document.getElementById('adm-main').innerText)));

  console.log('\n=== Rules ===');
  await P.click('#rulesBtn');
  check('Rules opens on "what you can report"', !!(await until(() => P.evaluate(() => /Report these/.test((document.getElementById('rulesdlg') || {}).innerText || '') && /Everyday swearing/.test(document.getElementById('rulesdlg').innerText)), 5000)));
  await P.click('[data-rl-tab="tos"]');
  check('...and has the Terms of Service', await P.evaluate(() => /Terms of Service/.test(document.getElementById('rulesdlg').innerText) && /One account per person/.test(document.getElementById('rulesdlg').innerText) && /Everyday swearing is allowed/.test(document.getElementById('rulesdlg').innerText)));
  await P.keyboard.press('Escape');
  check('Esc closes it', await P.evaluate(() => document.getElementById('rulesdlg').hidden));
  await P.click('#reportBtn'); await P.click('[data-rpk="player"]');
  check('the report dialog offers slurs and sexual content, says swearing is allowed', await P.evaluate(() => { const t = document.getElementById('reportdlg').innerText; return /Slurs or hate/.test(t) && /Sexual content/.test(t) && /swearing is allowed/i.test(t) && !/Bad language/.test(t); }));
  await P.click('[data-rp="x"]');

  console.log('\n=== answering a report: warn, with a note to the reporter (both online) ===');
  const rep1 = await R.evaluate(() => HGGrapevine.eco.report({ kind: 'player', who: 'AdmPat', why: 'slur', text: 'said a slur in blocky' }));
  check('a player reports another', !!rep1.ok, JSON.stringify(rep1));
  await O.click('.adm-nav[data-adm="reports"]');
  const item = await until(() => O.evaluate(() => { const it = [...document.querySelectorAll('#adm-replist .rp-item')].find(x => /AdmPat/.test(x.innerText) && /Slurs or hate/.test(x.innerText)); return it ? it.dataset.rid : null; }), 15000);
  if (!item) console.log('    [replist]', await O.evaluate(() => ((document.getElementById('adm-replist') || {}).innerText || 'none').slice(0, 300)), JSON.stringify(await O.evaluate(() => HGGrapevine.eco.reports('list').then(m => m && (m.err || (m.list || []).map(r => r.whyText + '/' + (r.who && r.who.n))), e => String(e)))));
  check('the report is in the Reports section, with what to do', !!item && await O.evaluate(id => { const it = document.querySelector('.rp-item[data-rid="' + id + '"]'); return !!it.querySelector('.adm-act') && [...it.querySelectorAll('.adm-act option')].some(o => o.value === 'warn') && !!it.querySelector('.adm-note'); }, item));
  await O.evaluate(id => { const it = document.querySelector('.rp-item[data-rid="' + id + '"]'); it.querySelector('.adm-act').value = 'warn'; it.querySelector('.adm-reason').value = 'no slurs'; it.querySelector('.adm-note').value = 'Thanks, we warned them.'; }, item);
  await O.click('[data-adm-send="' + item + '"]');
  check('the reported player sees a warning (number 1)', !!(await until(async () => /A warning from the admins/.test(await boxText(P)) && /no slurs/.test(await boxText(P)), 12000)));
  check('the reporter sees the answer with the note', !!(await until(async () => /About your report/.test(await boxText(R)) && /Thanks, we warned them/.test(await boxText(R)), 12000)));
  check('the report moves to Handled, saying what was done', !!(await until(() => O.evaluate(id => { const it = document.querySelector('.rp-item[data-rid="' + id + '"]'); return !it || it.classList.contains('closed'); }, item), 10000)) &&
    !!(await until(async () => { const m = await O.evaluate(() => HGGrapevine.eco.reports('list')); const r = m.list && m.list.find(x => x.text === 'said a slur in blocky'); return r && r.state === 'closed' && r.outcome === 'warn' && /Thanks/.test(r.reply || '') ? r : null; }, 10000)));
  await closeBoxes(P); await closeBoxes(R);

  console.log('\n=== the reporter is away: the answer waits for them ===');
  const rep2 = await R.evaluate(() => HGGrapevine.eco.report({ kind: 'bug', text: 'the snake game freezes on level 2' }));
  await R.close(); await sleep(2500);
  const w1 = await O.evaluate(id => HGGrapevine.eco.reportResolve(id, 'warn', {}), rep2.id);
  check('a bug report cannot be "warned" (nobody to act on)', w1 && w1.ok === false && /nobody to act on/.test(w1.err || ''), JSON.stringify(w1 && (w1.err || w1.ok)));
  await O.evaluate(id => HGGrapevine.eco.reportResolve(id, 'dismiss', { note: 'Fixed in the next update!' }), rep2.id);
  R = await device(Rctx); await until(async () => (await status(R)) === 'online', 60000);
  check('when they sign in again they see it, marked as sent while away', !!(await until(async () => { const t = await boxText(R); return /Fixed in the next update/.test(t) && /while you were away/.test(t); }, 20000)));

  console.log('\n=== warnings are kept, and wait for players who are away ===');
  await P.close(); await sleep(2500);
  const w2 = await O.evaluate(() => HGGrapevine.eco.mod('warn', 'AdmPat', { text: 'second time' }));
  check('warning someone who is away works, and counts', w2.ok && w2.n === 2, JSON.stringify(w2));
  P = await device(Pctx); await until(async () => (await status(P)) === 'online', 60000);
  check('they see it at sign-in, as number 2', !!(await until(async () => { const t = await boxText(P); return /second time/.test(t) && /number 2/.test(t); }, 20000)));
  const info = await O.evaluate(() => HGGrapevine.eco.mod('info', 'AdmPat'));
  check('the player card has 2 warnings, newest first, and the report about them', info.ok && info.count === 2 && info.warns[0].why === 'second time' && info.reports >= 1, JSON.stringify(info));
  await O.click('.adm-nav[data-adm="players"]');
  await O.fill('#pa-look', 'AdmPat'); await O.click('[data-adm-look]');
  check('Players: Look up shows the card (2 warnings)', !!(await until(() => O.evaluate(() => /2 warnings/.test((document.getElementById('adm-card') || {}).innerText || '')), 10000)));
  await O.click('[data-padm="mod:clearwarns"]');
  check('Clear warnings empties the record', !!(await until(async () => { const r = await O.evaluate(() => HGGrapevine.eco.mod('info', 'AdmPat')); return r.ok && r.count === 0; }, 10000)));
  check('AFK: 30 minutes without input stops progress, any input starts it again', await P.evaluate(() => { const was = FEED.lastInput; FEED.lastInput = Date.now() - 31 * 60000; const away = hgIdle(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' })); const back = !hgIdle(); FEED.lastInput = was; return HG_IDLE_MS === 1800000 && away && back; }));
  check('times show in Eastern time', await O.evaluate(() => / ET$/.test(hgTime(Date.now()))));
  check('the profile Admin tools point to the new menu', await O.evaluate(() => /own menu now/.test(profAdmin({ items: [] }))));
} catch (e) { console.log('ERROR', e && e.stack || e); failures++; }
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
