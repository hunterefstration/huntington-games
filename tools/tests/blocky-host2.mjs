// Blocky Shooter party: the host must stay visible to guests across matches (it used to drop out of its own party
// after the first match: an invisible host that could still shoot). NODE_PATH=/opt/node22/lib/node_modules node tools/tests/blocky-host2.mjs
// two Blocky pages joined with the copy-paste codes; two co-op matches in a row; can the guest see the host each time?
import { chromium } from 'playwright';
import fs from 'node:fs';
const T = '/tmp/hg-tools', URL0 = 'http://127.0.0.1:8090/Blocky%20Shooter%20V2/index.html';
const b = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 30000) { const t0 = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch {} if (Date.now() - t0 > ms) return null; await sleep(250); } }
async function page() {
  const p = await (await b.newContext({ viewport: { width: 1000, height: 640 } })).newPage();
  p.on('pageerror', e => console.log('  [pageerror]', e.message.slice(0, 160)));
  await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.160\.0\/(.*)/, r => { const f = T + '/cdn/package/' + new URL(r.request().url()).pathname.replace(/^\/npm\/three@0\.160\.0\//, ''); fs.existsSync(f) ? r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(f) }) : r.abort(); });
  await p.route(/cdn\.tailwindcss\.com/, r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(T + '/node_modules/tailwindcss-cdn/tailwindcss.js') }));
  await p.route(/fonts\.|peerjs|unpkg|mqtt/, r => r.abort());
  await p.goto(URL0); await until(() => p.evaluate(() => !!(window.__blocky && __blocky.NET)), 60000);
  return p;
}
const A = await page(), B = await page();
await A.evaluate(() => { __blocky.NET.lanOnly = true; document.getElementById('btn-mp').click(); }); await A.click('#mp-host');
await A.evaluate(() => { __blocky.NET.lanOnly = true; }); await A.click('#mp-long-toggle');
const code = await until(() => A.evaluate(() => __blocky.NET.invites[0] && __blocky.NET.invites[0].code), 20000);
await B.evaluate(() => { __blocky.NET.lanOnly = true; document.getElementById('btn-mp').click(); }); await B.click('#mp-join');
await B.evaluate(() => { const t = document.getElementById('mp-long-toggle'); if (t && !document.getElementById('mp-code')) t.click(); });
await B.waitForSelector('#mp-code', { timeout: 5000 }); await B.fill('#mp-code', code); await B.click('#mp-make-reply');
const reply = await until(() => B.evaluate(() => __blocky.NET.replyCode), 20000);
const key = await A.evaluate(() => __blocky.NET.invites[0].key);
await A.fill(`[data-invreply="${key}"]`, reply); await A.click(`[data-invgo="${key}"]`);
console.log('connected:', !!(await until(() => A.evaluate(() => __blocky.netPlayers.size === 1 && [...__blocky.netPlayers.values()][0].peer.rel.readyState === 'open'), 20000)));
const sees = () => B.evaluate(() => { const h = __blocky.netPlayers.get(0); return h ? `host in guest's list=yes avatar=${!!h.av} visible=${h.av && h.av.g.visible} y=${h.av && h.av.g.position.y.toFixed(1)}` : "host in guest's list=NO"; });
for (let match = 1; match <= 2; match++) {
  await until(() => A.evaluate(() => !!document.getElementById('mp-start')), 15000);
  console.log(`match ${match}: lobby the host sends includes the host:`, await A.evaluate(() => __blocky.NET.me ? 'yes' : 'no'));
  if (match > 1) { await A.evaluate(() => { const bt = [...document.querySelectorAll('[data-mpset="diff"]')].find(x => !x.className.includes('ring')) || document.querySelector('[data-mpset="diff"]'); bt && bt.click(); }); await sleep(800); }   // the host changes a lobby setting
  await A.evaluate(() => document.getElementById('mp-start').click());
  await until(() => B.evaluate(() => __blocky.NET.inGame), 15000); await sleep(2500);
  console.log(`match ${match}:`, await sees());
  await A.evaluate(() => __blocky.mpTest.endMatch());
  // the game goes back to the party lobby 7 s after the end screen
  await until(() => A.evaluate(() => !__blocky.NET.inGame && __blocky.state.currentGameState === 'main'), 20000);
  await until(() => B.evaluate(() => !__blocky.NET.inGame && __blocky.state.currentGameState === 'main'), 20000); await sleep(1500);
}
await b.close();
