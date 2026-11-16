// Moderation (2026-11-16): official rooms everyone is in, read-only #announcements, the Server account, the admin tools
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
const appOf = async page => until(async () => {
  const f = page.frames().find(x => x !== page.mainFrame() && x.url().startsWith('about:srcdoc'));
  return f && (await f.evaluate(() => !!(window.S && S.joined && S.ready)).catch(() => false)) ? f : null; }, 90000);
const logHas = (f, re) => f.evaluate(src => new RegExp(src, 'i').test(document.getElementById('log').innerText), re.source);
const say = async (f, conv, text) => { await f.evaluate(c => GV.openConv(c), conv); await f.fill('#text', text); await f.click('#send'); };
const W = 'n1' + 'gga';      // a spelling the guard catches
try {
  const O = await device(await browser.newContext({ viewport: { width: 1280, height: 900 } }));
  await createAccount(O, 'ModBoss'); await until(async () => (await status(O)) === 'online', 60000);
  const P = await device(await browser.newContext({ viewport: { width: 1280, height: 900 } }));
  await createAccount(P, 'ModPat'); await until(async () => (await status(P)) === 'online', 60000);
  const appO = await appOf(O), appP = await appOf(P);
  await O.click('#tour .skip').catch(() => {}); await P.click('#tour .skip').catch(() => {});
  await O.click('#tab-chat'); await P.click('#tab-chat');
  for (const f of [appO, appP]) await f.click('#goNo', { timeout: 3000 }).catch(() => {});

  console.log('=== official rooms ===');
  const offic = await appP.evaluate(() => ['main', 'announcements', 'mp-codes', 'music', 'bugs'].filter(id => S.convs.has(id)));
  check('a new player is in every official room from the start', offic.length === 5, JSON.stringify(offic));
  await say(appP, 'announcements', 'can i post here');
  await sleep(2500);
  check('#announcements is read-only for players', !(await appO.evaluate(() => { GV.openConv('announcements'); return document.getElementById('log').innerText.includes('can i post here'); })));
  await say(appO, 'announcements', 'Big update tonight');
  check('...the owner posts there', !!(await until(() => appP.evaluate(() => { GV.openConv('announcements'); return document.getElementById('log').innerText.includes('Big update tonight'); }), 15000)));

  console.log('\n=== fun tools, and the Server account ===');
  const r1 = await O.evaluate(() => HGGrapevine.eco.mod('uwu', 'ModPat', { mins: 5 }));
  check('the owner turns on UwU for a player', r1.ok, JSON.stringify(r1));
  check('the Server says so in #main, with a SERVER tag', !!(await until(() => appO.evaluate(() => { GV.openConv('main'); const r = [...document.querySelectorAll('#log .msg')].find(x => /UwU-ified/.test(x.textContent)); return !!r && !!r.querySelector('.gtag.role-server'); }), 15000)));
  await say(appP, 'main', 'hello my friend');
  check('...and their messages come out uwu', !!(await until(() => logHas(appO, /hewwo my fwiend/), 15000)));
  check('the player is told', !!(await until(() => P.evaluate(() => /UwU mode/.test(document.body.innerText)), 8000)));
  await O.evaluate(() => HGGrapevine.eco.mod('nick', 'ModPat', { mins: 5, text: 'Certified Goober' }));
  const nn = await until(() => logHas(appO, /shall be known as "Certified Goober"/), 15000);
  check('a forced nickname is announced', !!nn);
  await O.evaluate(() => HGGrapevine.eco.mod('bonk', 'ModPat', {}));
  check('a bonk lands on the player\'s screen', !!(await until(() => P.evaluate(() => !!document.querySelector('.hubmodfx.bonk')), 8000)));
  await O.evaluate(() => HGGrapevine.eco.mod('clear', 'ModPat', {}));
  await sleep(800);
  await say(appP, 'main', 'back to normal now');
  check('lifting the effects puts things back', !!(await until(() => logHas(appO, /back to normal now/), 15000)) && !(await logHas(appO, /back to nowmaw/)));

  console.log('\n=== mute ===');
  await O.evaluate(() => HGGrapevine.eco.mod('mute', 'ModPat', { mins: 10, text: 'cool it' }));
  check('a muted player sees a box saying so', !!(await until(() => P.evaluate(() => /You are muted/.test((document.querySelector('.hubmodbox') || {}).innerText || '')), 8000)));
  await P.evaluate(() => document.querySelector('.hubmodbox button').click());
  await say(appP, 'main', 'am i muted');
  await sleep(2500);
  check('...and cannot chat', !(await logHas(appO, /am i muted/)));
  const list = await O.evaluate(() => HGGrapevine.eco.mod('list'));
  check('the list shows who is muted', list.ok && list.fx.some(x => x.name === 'ModPat' && x.e.mute), JSON.stringify(list.fx));
  await O.evaluate(() => HGGrapevine.eco.mod('clear', 'ModPat', {}));

  console.log('\n=== timed ban ===');
  const rb = await O.evaluate(() => HGGrapevine.eco.mod('tempban', 'ModPat', { mins: 60, text: 'testing bans', announce: true }));
  check('the owner bans a player for an hour', rb.ok, JSON.stringify(rb));
  check('...they are thrown out and told for how long', !!(await until(() => P.evaluate(() => /banned for 1 hour/i.test(document.body.innerText)), 10000)));
  check('...and the Server tells #main', !!(await until(() => logHas(appO, /ModPat is banned for 1 hour: testing bans/), 10000)));
  const l2 = await O.evaluate(() => HGGrapevine.eco.mod('list'));
  check('the list shows the ban and when it ends', l2.bans.some(b => b.name === 'ModPat' && b.until > Date.now() + 50 * 60000), JSON.stringify(l2.bans));
  await O.evaluate(() => HGGrapevine.eco.mod('unban', 'ModPat', {}));

  console.log('\n=== the n-word ladder ===');
  const S2 = await device(await browser.newContext({ viewport: { width: 1280, height: 900 } }));
  await createAccount(S2, 'ModSam'); await until(async () => (await status(S2)) === 'online', 60000);
  let appS = await appOf(S2); await S2.click('#tour .skip').catch(() => {}); await S2.click('#tab-chat'); await appS.click('#goNo', { timeout: 3000 }).catch(() => {});
  await say(appS, 'main', 'hey ' + W);
  check('the first time: banned for a day', !!(await until(() => S2.evaluate(() => /banned for 1 day/i.test(document.body.innerText)), 10000)));
  await sleep(1500);
  check('...not announced, and the word never reached the room', !(await logHas(appO, /ModSam is banned/)) && !(await logHas(appO, /n1gg/)));
  for (const [n, span, re] of [[2, '3 days', /ModSam is banned for 3 days for saying the n-word \(second time\)/], [3, '7 days', /ModSam is banned for 7 days/], [4, 'for good', /ModSam is banned for good/]]) {
    await O.evaluate(() => HGGrapevine.eco.mod('unban', 'ModSam', {}));
    await S2.reload(); await until(async () => (await status(S2)) === 'online', 60000);
    appS = await appOf(S2); await S2.click('#tab-chat').catch(() => {}); await appS.click('#goNo', { timeout: 3000 }).catch(() => {});
    await sleep(6000);      // (one strike per burst)
    await say(appS, 'main', 'hey ' + W + ' ' + n);
    check(`time ${n}: banned ${span}, and the Server says so in #main`, !!(await until(() => logHas(appO, re), 12000)));
  }
  const l3 = await O.evaluate(() => HGGrapevine.eco.mod('list'));
  check('the fourth time is for good', l3.bans.some(b => b.name === 'ModSam' && !b.until), JSON.stringify(l3.bans.filter(b => b.name === 'ModSam')));
} catch (e) { console.log('ERROR', e && e.stack || e); failures++; }
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
