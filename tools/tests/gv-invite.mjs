// Game invites through Grapevine: host from the chat's + menu, the invite card, JOIN opens the game in the friend's room. Same rig and setup as gv.mjs.
//   NODE_PATH=/opt/node22/lib/node_modules node tools/tests/gv-invite.mjs   (reset the rig database first)
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

const gameFrame = P => P.frames().find(f => f !== P.mainFrame() && !f.url().startsWith('about:srcdoc') && /Frontline|Blocky/.test(f.url()));
try {
  const [A, appA] = await signedIn('InvAlice');
  const [B, appB] = await signedIn('InvBob');
  for (const app of [appA, appB]) await app.evaluate(() => { GV.openConv('main'); GV.dismissGuide && GV.dismissGuide(); });
  for (const P of [A, B]) { await P.evaluate(() => { window.HG_TEST_QUERY = '?debug'; }); await P.click('#tab-chat'); }

  console.log('\n=== 1. the + menu offers games ===');
  await appA.evaluate(() => actOpen());
  check('"Invite to a game" is in the + menu inside the launcher', await appA.evaluate(() => !!document.querySelector('#actions .acttile[data-act="game"]')));
  await appA.evaluate(() => document.querySelector('#actions .acttile[data-act="game"]').click());
  const games = await appA.evaluate(() => [...document.querySelectorAll('#actions .acttile[data-game]')].map(b => b.dataset.game));
  check('it lists the multiplayer games', games.includes('frontline') && games.includes('blocky'), games.join(','));

  console.log('\n=== 2. host Frontline from the chat ===');
  await appA.evaluate(() => document.querySelector('#actions .acttile[data-game="frontline"]').click());
  const fa = await until(() => gameFrame(A), 60000);
  check('Frontline opens', !!fa);
  check('...and starts hosting a party by itself', !!(await until(() => fa.evaluate(() => window.__fl && __fl.NET && __fl.NET.role === 'host'), 20000)));
  // the rig has no internet matchmaking: pretend the party code came back
  await fa.evaluate(() => { __fl.NET.code = '654321'; __fl.NET.codeState = 'ready'; });
  check('the invite is posted to the chat once the code is ready', !!(await until(() => appB.$eval('#log', e => /hg-invite|Frontline/.test(e.innerText) && !!e.querySelector('.rcard.invite')), 20000)));
  const card = await appB.evaluate(() => { const c = [...document.querySelectorAll('#log .rcard.invite')].pop(); return c && { text: c.innerText, btn: !!c.querySelector('button:not([disabled])') }; });
  check('the friend sees an invite card with a Join button', !!card && /Frontline/.test(card.text) && /654321/.test(card.text) && card.btn, card && card.text.replace(/\s+/g, ' '));

  console.log('\n=== 3. JOIN ===');
  await appB.evaluate(() => [...document.querySelectorAll('#log .rcard.invite button')].pop().click());
  const fb = await until(() => gameFrame(B), 60000);
  check('JOIN opens Frontline for the friend', !!fb);
  check('...straight into the host\'s room (it dials code 654321)', !!(await until(() => fb.evaluate(() => window.__fl && __fl.NET.role === 'guest' && __fl.NET.joinCode === '654321'), 20000)));

  console.log('\n=== 4. Blocky Shooter too ===');
  await A.evaluate(() => document.getElementById('back').click());
  await A.click('#tab-chat');
  await appA.evaluate(() => { actOpen(); document.querySelector('#actions .acttile[data-act="game"]').click(); });
  await appA.evaluate(() => document.querySelector('#actions .acttile[data-game="blocky"]').click());
  const ba = await until(() => gameFrame(A) && /Blocky/.test(gameFrame(A).url()) ? gameFrame(A) : null, 60000);
  check('Blocky opens', !!ba);
  check('...and starts hosting', !!(await until(() => ba.evaluate(() => window.__blocky && __blocky.NET && __blocky.NET.host), 40000)));
  await ba.evaluate(() => { __blocky.NET.code = '112233'; __blocky.NET.codeState = 'ready'; });
  check('the Blocky invite reaches the chat', !!(await until(() => appB.evaluate(() => [...document.querySelectorAll('#log .rcard.invite')].some(c => /Blocky/.test(c.innerText) && /112233/.test(c.innerText))), 20000)));

  console.log('\n=== 5. the in-game chat window shows a Join button ===');
  await B.evaluate(() => document.getElementById('back').click());
  const tf = await (async () => { await B.evaluate(() => { [...document.querySelectorAll('.game')].find(g => /Tetris Surge/.test(g.textContent)).click(); }); return until(() => B.frames().find(f => /Tetris/.test(f.url())), 60000); })();
  await B.waitForTimeout(1500);
  await B.evaluate(() => document.getElementById('frame').contentWindow.focus()); await B.keyboard.press('t');
  check('an invite in the chat dock has a Join button', !!(await until(() => B.evaluate(() => document.getElementById('chatdock').classList.contains('on') && [...document.querySelectorAll('#dk-ls button')].some(b => b.textContent === 'Join')), 15000)));
} catch (e) { console.log('ERROR', e && e.stack || e); failures++; }
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
