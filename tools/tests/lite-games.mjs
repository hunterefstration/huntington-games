// Grapevine Lite inside the games: Blocky Shooter and Frontline multiplayer lobbies with real Lite accounts.
// Two launcher-like pages (each loads the real lite/lite.js and signs in to the Grapevine test rig), each with the
// game in an iframe, so the games read window.parent.HGLite exactly as they do in the launcher.
// Needs: the Grapevine rig (mqtt broker :9001, archive rig-archive-a with RELAY_URLS), this repo served on :8090,
// a local PeerJS server on :9010 path / (for Frontline), tools/setup-tools.sh run once.
//   NODE_PATH=/opt/node22/lib/node_modules node tools/tests/lite-games.mjs [blocky|frontline|both]
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.HUB_BASE || 'http://127.0.0.1:8090';
const ARCHIVE = process.env.RIG_ARCHIVE || 'rig-archive-a';
const MQTT = process.env.MQTT_JS || '/home/user/grapevine/relay/mqtt.min.js';
const PEERJS = process.env.PEERJS_JS || '/home/user/grapevine/node_modules/peerjs/dist/peerjs.min.js';
const TOOLS = process.env.HG_TOOLS || '/tmp/hg-tools';
const which = process.argv[2] || 'both';
let failures = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); if (!ok) failures++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 20000, every = 250) {
  const t0 = Date.now();
  for (;;) { try { const v = await fn(); if (v) return v; } catch {} if (Date.now() - t0 > ms) return null; await sleep(every); }
}

const browser = await chromium.launch({ executablePath: process.env.RIG_CHROME || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

// A launcher stand-in: Lite signed in as `name`, the game below it in an iframe.
async function player(name, gameUrl) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log(`    [${name} pageerror] ${e.message}`));
  await page.route(/cdn\.jsdelivr\.net\/npm\/mqtt|unpkg\.com\/mqtt/, r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(MQTT) }));
  await page.route(/cdn\.jsdelivr\.net\/npm\/peerjs|unpkg\.com\/peerjs/, r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(PEERJS) }));
  await page.route(/cdn\.jsdelivr\.net\/npm\/three@0\.160\.0\/(.*)/, r => {
    const f = TOOLS + '/cdn/package/' + decodeURIComponent(new URL(r.request().url()).pathname.replace(/^\/npm\/three@0\.160\.0\//, ''));
    fs.existsSync(f) ? r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(f) }) : r.abort();
  });
  await page.route(/cdn\.tailwindcss\.com/, r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(TOOLS + '/node_modules/tailwindcss-cdn/tailwindcss.js') }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.route('**/__harness.html', r => r.fulfill({ contentType: 'text/html', body:
    `<!doctype html><meta charset=utf-8><body style="margin:0"><script>window.HG_LITE_CONFIG=${JSON.stringify({ archives: [ARCHIVE], pinned: {}, shards: 2, relays: ['ws://127.0.0.1:9001'] })}</script>` +
    `<script src="/lite/lite.js"></script><iframe id="g" name="g" style="border:0;width:1200px;height:780px" src="${gameUrl}"></iframe>` }));
  await page.goto(BASE + '/__harness.html');
  await page.evaluate(n => HGLite.signUp(HGLite.newKey(), n, ''), name);
  const ok = await until(() => page.evaluate(() => HGLite.online()), 60000);
  if (!ok) throw new Error(name + ' could not sign in to Lite');
  const frame = page.frame({ name: 'g' });
  return { name, ctx, page, frame };
}
const L = (p, fn, arg) => p.page.evaluate(fn, arg);

async function blocky() {
  console.log('\n=== Blocky Shooter ===');
  const url = '/Blocky%20Shooter%20V2/index.html';
  const H = await player('BlockyHost', url), G = await player('BlockyGuest', url);
  const hf = H.frame, gf = G.frame;
  await hf.waitForSelector('#btn-mp', { timeout: 60000 }); await gf.waitForSelector('#btn-mp', { timeout: 60000 });
  await hf.click('#btn-mp');
  check('host: name box is locked to the Lite name', await hf.$eval('#mp-name', e => e.readOnly && e.value === 'BlockyHost'));
  await hf.check('#mp-lan'); await hf.click('#mp-host'); await hf.click('#mp-long-toggle'); await hf.click('#mp-invite');
  const invite = await until(() => hf.$eval('[data-inv] textarea[readonly]', e => e.value.length > 40 && e.value), 30000);
  check('host made an invite code', !!invite);
  await gf.click('#btn-mp');
  check('guest: name is the Lite name too', await gf.$eval('#mp-name', e => e.value === 'BlockyGuest'));
  await gf.check('#mp-lan'); await gf.click('#mp-join'); await gf.click('#mp-long-toggle');
  await gf.fill('#mp-code', invite); await gf.click('#mp-make-reply');
  const reply = await until(() => gf.$eval('#mp-reply', e => e.value.length > 40 && e.value), 30000);
  check('guest made a reply code', !!reply);
  await hf.fill('[data-invreply]', reply); await hf.click('[data-invgo]');
  check('guest connected', !!(await until(() => gf.evaluate(() => __blocky.NET.joinState === 'connected'), 30000)));
  const hostSees = await until(() => hf.evaluate(() => [...__blocky.netPlayers.values()].some(p => p.gv && p.name === 'BlockyGuest')), 20000);
  check('host sees the guest as a verified account', !!hostSees);
  const guestSees = await until(() => gf.evaluate(() => { const h = __blocky.netPlayers.get(0); return !!(h && h.gv); }), 20000);
  check('guest sees the host as a verified account', !!guestSees);
  check('guest has a + FRIEND button for the host', !!(await until(() => gf.$('#mp-players [data-gvfriend=BlockyHost]'), 10000)));
  check('host has a + FRIEND button for the guest', !!(await until(() => hf.$('#mp-players [data-gvfriend=BlockyGuest]'), 10000)));
  await gf.click('#mp-players [data-gvfriend=BlockyHost]');
  check('guest sent a Grapevine friend request', !!(await until(() => L(G, () => HGLite.friendState('BlockyHost') === 'outgoing'), 15000)));
  check('host has the request in Lite', !!(await until(() => L(H, () => HGLite.friendState('BlockyGuest') === 'incoming'), 15000)));
  check('both were noted under "met in games"', (await L(H, () => HGLite.recent().some(r => r.name === 'BlockyGuest'))) && (await L(G, () => HGLite.recent().some(r => r.name === 'BlockyHost'))));
  await H.ctx.close(); await G.ctx.close();
}

async function impostor() {
  console.log('\n=== an impostor is not verified ===');
  const url = '/Blocky%20Shooter%20V2/index.html';
  const H = await player('RealHost', url), G = await player('RealGuest', url);
  await G.page.evaluate(() => {   // the guest's Lite lies: every proof it gives names somebody else
    const real = HGLite.prove; HGLite.prove = async (c, x) => { const p = await real(c, x); p.n = 'RealHost'; return p; };
  });
  const hf = H.frame, gf = G.frame;
  await hf.waitForSelector('#btn-mp', { timeout: 60000 }); await gf.waitForSelector('#btn-mp', { timeout: 60000 });
  await hf.click('#btn-mp'); await hf.check('#mp-lan'); await hf.click('#mp-host'); await hf.click('#mp-long-toggle'); await hf.click('#mp-invite');
  const invite = await until(() => hf.$eval('[data-inv] textarea[readonly]', e => e.value.length > 40 && e.value), 30000);
  await gf.click('#btn-mp'); await gf.check('#mp-lan'); await gf.click('#mp-join'); await gf.click('#mp-long-toggle');
  await gf.fill('#mp-code', invite); await gf.click('#mp-make-reply');
  const reply = await until(() => gf.$eval('#mp-reply', e => e.value.length > 40 && e.value), 30000);
  await hf.fill('[data-invreply]', reply); await hf.click('[data-invgo]');
  await until(() => gf.evaluate(() => __blocky.NET.joinState === 'connected'), 30000);
  await sleep(6000);
  check('host does NOT mark a forged identity as verified', !(await hf.evaluate(() => [...__blocky.netPlayers.values()].some(p => p.gv))));
  await H.ctx.close(); await G.ctx.close();
}

async function frontline() {
  console.log('\n=== Frontline ===');
  const url = '/Frontline/index.html?pjhost=127.0.0.1:9010&relay=ws://127.0.0.1:9001&debug';
  const H = await player('FrontHost', url), G = await player('FrontGuest', url);
  const hf = H.frame, gf = G.frame;
  for (const f of [hf, gf]) { await f.waitForSelector('[data-act=skiptut], [data-act=mp]', { timeout: 90000 }); await f.click('[data-act=skiptut]', { timeout: 3000 }).catch(() => {}); }   // first-run tutorial offer
  await hf.waitForSelector('[data-act=mp]', { timeout: 30000 }); await gf.waitForSelector('[data-act=mp]', { timeout: 30000 });
  await hf.click('[data-act=mp]'); await hf.click('[data-act=mphost]');
  const code = await until(() => hf.evaluate(() => (__fl.NET || {}).code), 40000);
  check('host has a 6-digit code', /^\d{6}$/.test(code || ''), String(code));
  await gf.click('[data-act=mp]'); await gf.fill('#joincode', code); await gf.click('[data-act=mpjoin]');
  check('guest joined the lobby', !!(await until(() => gf.evaluate(() => (__fl.NET || {}).joinState === 'connected'), 40000)));
  check('host sees the guest verified', !!(await until(() => hf.evaluate(() => !!(__fl.NET || {}).guestGv), 20000)));
  check('guest sees the host verified', !!(await until(() => gf.evaluate(() => !!(__fl.NET || {}).hostGv), 20000)));
  check('guest has a Friend button', !!(await until(() => gf.$('[data-act=gvfriend]'), 10000)));
  await gf.click('[data-act=gvfriend]');
  check('guest sent a Grapevine friend request', !!(await until(() => L(G, () => HGLite.friendState('FrontHost') === 'outgoing'), 15000)));
  check('host has the request in Lite', !!(await until(() => L(H, () => HGLite.friendState('FrontGuest') === 'incoming'), 15000)));
  await H.ctx.close(); await G.ctx.close();
}

try {
  if (which === 'blocky' || which === 'both') { await blocky(); await impostor(); }
  if (which === 'frontline' || which === 'both') await frontline();
} catch (e) {
  console.log('FAIL  crashed — ' + (e && e.stack || e)); failures++;
} finally {
  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nall passed');
  process.exit(failures ? 1 : 0);
}
