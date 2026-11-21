// Steel Storm 2.2: menus, showcase, respawn pick, and a two-page party over the rig's MQTT relay.
//   NODE_PATH=/opt/node22/lib/node_modules node tools/tests/ss-menus.mjs [base-url] [--solo]
// base-url defaults to the rig's http://127.0.0.1:8090 (this repo). The party part needs the rig's MQTT broker on :9001.
import { chromium } from 'playwright';
import fs from 'node:fs';
const T = '/tmp/hg-tools', BASE = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://127.0.0.1:8090').replace(/\/$/, '');
const SOLO = process.argv.includes('--solo');
const MQTT = process.env.MQTT_JS || '/home/user/grapevine/relay/mqtt.min.js';      // HGNet's relay library, served locally (no internet)
const URL0 = BASE + '/Steel%20Storm/index.html?hgrelays=ws://127.0.0.1:9001&hgpeer=off';
const b = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 20000) { const t0 = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch {} if (Date.now() - t0 > ms) return null; await sleep(200); } }
let fails = 0, passes = 0;
const ok = (c, name, extra) => { if (c) passes++; else fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : '')); };
const errors = [];
async function page(tag, vp) {
  const ctx = await b.newContext({ viewport: vp || { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => { errors.push(tag + ': ' + e.message); console.log('  [pageerror ' + tag + ']', e.message.slice(0, 200)); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_|net::|WebSocket|Failed to load resource/.test(m.text())) { errors.push(tag + ': ' + m.text()); console.log('  [console ' + tag + ']', m.text().slice(0, 200)); } });
  await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.160\.0\/(.*)/, r => { const f = T + '/cdn/package/' + new URL(r.request().url()).pathname.replace(/^\/npm\/three@0\.160\.0\//, ''); fs.existsSync(f) ? r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(f) }) : process.env.HG_LIVE_CDN ? r.continue() : r.abort(); });      // HG_LIVE_CDN=1: no local three.js copy (Windows), use the real CDN
  await p.route(/mqtt@[\d.]+\/dist\/mqtt\.min\.js/, r => fs.existsSync(MQTT) ? r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(MQTT) }) : r.abort());
  await p.route(/fonts\.|unpkg|peerjs/, r => r.abort());
  await p.addInitScript(() => { try { localStorage.setItem('steelstorm_save', JSON.stringify({ v: 2, seenHow: true, seenNew: '2.3', credits: 50000, stats: { matches: 3, wins: 2, kills: 9, deaths: 4, caps: 0 } })); } catch (e) {} });
  await p.goto(URL0); await until(() => p.evaluate(() => !!window.__steelstorm), 60000);
  return p;
}
const S = (p, f, a) => p.evaluate(f, a);
const info = p => S(p, () => __steelstorm.show.info());

// ---------- 1. one page: menus, showcase, respawn ----------
const A = await page('A');
ok(await S(A, () => __steelstorm.version) === '2.3', 'version 2.3');
ok(await S(A, () => __steelstorm.state) === 'menu', 'starts on the home menu');
const s0 = await until(async () => { const i = await info(A); return i.on && i.frames > 4 && i; }, 15000);
ok(!!s0, 'showcase runs on the home menu', s0 && { n: s0.n, shot: s0.shot, hero: s0.hero });
ok(s0 && s0.n >= 3 && s0.n <= 6 && s0.hero.elite && s0.hero.veh === (await S(A, () => __steelstorm.save.lineup[__steelstorm.save.sel])), 'showcase: 3-6 vehicles, elite hero in the selected vehicle');
ok(await S(A, () => __steelstorm.ents().every(e => e.id >= 900)), 'showcase vehicles only (ids 900+) while in the menu');
ok(await S(A, () => document.querySelector('#h-vcard .sbars .sb') && document.querySelectorAll('#h-vcard .sb').length === 4 && !!document.querySelector('#h-vcard .wps')), 'home card has 4 stat bars and weapons');
// switching the vehicle
await A.click('#lineup [data-slot="1"]');
const want1 = await S(A, () => __steelstorm.save.lineup[1]);
const t1 = Date.now(); const sw = await until(async () => { const i = await info(A); return i.id === want1 && i.hero && i.hero.veh === want1 && i.frames > 0 && i; }, 3000);
ok(!!sw && Date.now() - t1 < 1500, 'showcase switches vehicle within ~1 s', { ms: Date.now() - t1, id: sw && sw.id });
// every view and card opens without an error
for (const v of ['battle', 'mp', 'garage', 'research', 'menu']) { await A.click('#mnav [data-go="' + v + '"]'); await sleep(250); ok(await S(A, v => __steelstorm.ui.view === v && !document.getElementById({ menu: 'v-home', battle: 'v-battle', mp: 'v-mp', garage: 'v-garage', research: 'v-research' }[v]).classList.contains('hidden'), v), 'view ' + v + ' opens'); }
await A.click('#mnav [data-go="garage"]'); await sleep(200);
const other = await S(A, () => { const c = [...document.querySelectorAll('#g-owned [data-gid]')].find(x => !x.classList.contains('sel') && x.dataset.gid[0] === 'n'); return c && c.dataset.gid; });
await A.click('#g-owned [data-gid="' + other + '"]');
ok(!!(await until(async () => (await info(A)).id === other, 2500)), 'garage: inspecting a vehicle films it', other);
ok(await S(A, () => !!document.querySelector('#g-info .mod') && !!document.querySelector('#g-info [data-act="use"]')), 'garage card has modules and "Take into battle"');
await A.click('#g-info [data-act="use"]'); await sleep(200);
ok(await S(A, id => __steelstorm.save.lineup[__steelstorm.save.sel] === id, other), 'Take into battle selects it');
await A.click('#mnav [data-go="research"]'); await sleep(200);
await A.click('#rs-tabs [data-ln="a"]'); await A.click('#tree .vc.can'); await sleep(150);
ok(await S(A, () => !!document.querySelector('#rs-info .sbars') && !!document.querySelector('#rs-info [data-act="target"]')), 'research: card with bars and a Research button');
const fr0 = (await info(A)).frames; await sleep(600);
ok((await info(A)).frames === fr0 && !(await info(A)).run, 'showcase paused behind the research tree');
await A.click('#mnav [data-go="menu"]');
await A.click('#mnav [data-modal="s-settings"]'); await sleep(200);
const fr1 = (await info(A)).frames; await sleep(600);
ok((await info(A)).frames === fr1, 'showcase paused while Settings is open');
await A.click('#st-show [data-show="0"]'); await sleep(400);
ok(!(await info(A)).on && (await S(A, () => __steelstorm.ents().length)) === 0, 'Showcase Off: torn down (3D lobby instead)');
await A.click('#st-show [data-show="1"]'); await A.click('#s-settings [data-close].primary');
ok(!!(await until(async () => { const i = await info(A); return i.on && i.run && i.frames > fr1; }, 4000)), 'Showcase back on after closing Settings');
for (const m of ['s-how', 's-new']) { await S(A, m => __steelstorm.ui.open(m), m); await sleep(150); await A.click('#' + m + ' .x'); }
ok(await S(A, () => ['s-how', 's-new', 's-settings'].every(id => document.getElementById(id).classList.contains('hidden'))), 'How to play / What\'s new open and close');
// a match: the showcase is gone, the lobby pick is what you respawn in
await A.click('#lineup [data-slot="1"]');
const pick = await S(A, () => __steelstorm.save.lineup[1]);
await A.click('#b-play'); await until(() => S(A, () => __steelstorm.state === 'match'), 8000);
const m1 = await S(A, () => { const c = __steelstorm.match.cfg; return { n: __steelstorm.ents().length, want: c.players.length + c.bots.length, show: __steelstorm.ents().filter(e => e.id >= 900).length, on: __steelstorm.show.info().on, pick: __steelstorm.match.pick }; });
ok(m1.n === m1.want && m1.show === 0 && !m1.on, 'match: only the match\'s own vehicles, showcase off', m1);
ok(m1.pick === pick, 'match remembers the lobby pick', m1.pick);
const third = await S(A, () => __steelstorm.save.lineup.find((id, i) => i !== 1));
await S(A, () => { __steelstorm.kill(0); __steelstorm.me.respT = 0; });
await until(() => S(A, () => !document.getElementById('s-dead').classList.contains('hidden')), 3000);
ok(await S(A, () => __steelstorm.ui.selDead) === pick, 'death screen preselects the lobby pick');
await A.click('#d-lineup [data-did="' + third + '"]');
ok(await S(A, () => __steelstorm.ui.selDead) === third, 'switching on the death screen works');
await A.click('#d-go');
ok(await until(() => S(A, id => __steelstorm.me.alive && __steelstorm.me.def.id === id, third), 2000), 'one click on DEPLOY deploys the switched vehicle');
await S(A, () => { __steelstorm.kill(0); __steelstorm.me.respT = 0; }); await sleep(300);
ok(await S(A, () => __steelstorm.ui.selDead) === pick, 'next death: the lobby pick again');
await A.keyboard.press('Space');
ok(await until(() => S(A, id => __steelstorm.me.alive && __steelstorm.me.def.id === id, pick), 2000), 'Space deploys');
await S(A, () => { __steelstorm.kill(0); __steelstorm.me.respT = 2; }); await sleep(200);
await A.click('#d-go');
ok(await S(A, () => !__steelstorm.me.alive && document.getElementById('d-go').textContent.startsWith('READY')), 'DEPLOY during the wait arms it');
ok(await until(() => S(A, () => __steelstorm.me.alive), 4000), '...and it deploys when the timer ends');
await S(A, () => { if (document.pointerLockElement) document.exitPointerLock(); else document.getElementById('s-pause').classList.remove('hidden'); });      // Esc releases the mouse: the pause card opens
ok(await until(() => S(A, () => !document.getElementById('s-pause').classList.contains('hidden')), 2000), 'releasing the mouse opens the pause card');
ok(await until(() => S(A, () => document.getElementById('ps-info').textContent.length > 5), 2000), 'pause card shows the match info');
await A.click('#ps-resume');
await S(A, () => __steelstorm.end(0)); await until(() => S(A, () => __steelstorm.state === 'result'), 4000);
ok(await S(A, () => !!document.querySelector('#r-card .res-tiles') && !!document.getElementById('r-again')), 'result screen with tiles and Play again');
await A.click('#r-go'); await sleep(300);
ok(await S(A, () => __steelstorm.state === 'menu' && !__steelstorm.match), 'back to the menu');
ok(!!(await until(async () => { const i = await info(A); return i.on && i.frames > 2 && i.n >= 3; }, 4000)), 'showcase back after the match');
ok(await S(A, () => __steelstorm.save.stats.wins >= 2 && typeof __steelstorm.save.stats.kills === 'number'), 'save keeps stats.wins / stats.kills');
// the open-games list (fed by the launcher; faked here)
await A.click('#mnav [data-go="mp"]');
await S(A, () => __steelstorm.ui.mpFake({ near: [{ game: 'warpvp', code: '123456', host: 'Sam', n: 2, max: 8, mode: 'Conquest 5v5 · Large map', near: true, age: 30 }], pub: [{ game: 'warpvp', code: '654321', host: 'Alex', n: 8, max: 8, mode: 'Team Deathmatch 8v8', age: 400 }] }, [{ name: 'Kim', game: 'Steel Storm', code: '111222' }]));
ok(await S(A, () => document.querySelectorAll('#mp-games .mp-g').length === 2 && document.querySelector('#mp-games [data-pj="654321"]').disabled && !document.querySelector('#mp-games [data-pj="123456"]').disabled && !!document.querySelector('#mp-friends [data-pj="111222"]')), 'open games list: rows, full game disabled, friends row');
await S(A, () => __steelstorm.ui.mpFake(null));
// phone width
await A.setViewportSize({ width: 390, height: 780 }); await A.click('#mnav [data-go="menu"]'); await sleep(300);
ok(await S(A, () => { const n = document.getElementById('mnav').getBoundingClientRect(), p = document.getElementById('b-play').getBoundingClientRect(); return n.bottom >= innerHeight - 2 && n.height < 70 && p.width > 200 && document.documentElement.scrollWidth <= innerWidth; }), 'phone width: bottom navigation, full-width PLAY, no sideways scroll');
await A.screenshot({ path: '/tmp/ss-phone.png' });
await A.setViewportSize({ width: 1280, height: 720 }); await sleep(300);
await A.screenshot({ path: '/tmp/ss-home.png' });

// ---------- 2. two pages: host and join a party ----------
if (!SOLO) {
  const B = await page('B');
  await A.click('#mnav [data-go="mp"]');
  await A.click('#mp-modes [data-v="conq"]');
  await A.click('#p-create');
  const code = await until(() => S(A, () => __steelstorm.party.code), 25000);
  ok(/^\d{6}$/.test(code || ''), 'host: party open with a code', code);
  ok(await until(() => S(A, () => __steelstorm.state === 'lobby' && !document.getElementById('s-lobby').classList.contains('hidden')), 5000), 'host: party lobby shows');
  ok(await until(() => S(A, () => !__steelstorm.show.info().on && __steelstorm.ents().length === 0), 2000), 'host: no showcase in the party lobby (3D lobby instead)');
  const bMode0 = await S(B, () => __steelstorm.save.mode);
  await B.click('#mnav [data-go="mp"]'); await B.fill('#p-code', code); await B.click('#p-join');
  ok(await until(() => S(B, () => __steelstorm.state === 'lobby' && __steelstorm.party.myId > 0), 25000), 'guest: joined, lobby shows');
  ok(await until(() => S(A, () => __steelstorm.party.roster.length === 2) && S(B, () => __steelstorm.party.roster.length === 2), 10000), 'both see 2 players');
  ok(await until(() => S(B, () => /Connected/.test(document.getElementById('lb-net').textContent) && document.getElementById('lb-code').textContent.length === 6), 5000), 'guest: connection state and room code shown');
  ok(await until(() => S(B, () => document.querySelector('#lb-mode b') && document.querySelector('#lb-mode b').textContent === 'Conquest'), 5000), 'guest sees the host\'s mode');
  ok(await S(B, m => __steelstorm.save.mode === m, bMode0), 'guest\'s own solo mode is not overwritten by the party');
  await B.click('#lb-ready');
  ok(await until(() => S(A, () => { const g = __steelstorm.party.roster.find(p => p.id > 0); return g && g.ready && /READY/.test(document.querySelector('#lb-teams .lp:not(.me) .rdy').textContent); }), 8000), 'host sees the guest READY');
  const bTeam = await S(B, () => __steelstorm.party.roster.find(p => p.id === __steelstorm.party.myId).team);
  await B.click('#lb-teams button[data-team]');
  ok(await until(() => S(A, t => { const g = __steelstorm.party.roster.find(p => p.id > 0); return g && g.team === 1 - t; }, bTeam), 8000), 'guest switched team, host sees it');
  await B.click('#lb-mine [data-slot="2"]');
  const bVeh = await S(B, () => __steelstorm.save.lineup[2]);
  ok(await until(() => S(A, v => { const g = __steelstorm.party.roster.find(p => p.id > 0); return g && g.veh === v; }, bVeh), 8000), 'guest changed vehicle, host sees it', bVeh);
  await B.fill('#lb-say', 'hello from B'); await B.press('#lb-say', 'Enter');
  ok(await until(() => S(A, () => /hello from B/.test(document.getElementById('lb-log').textContent)), 8000), 'chat reaches the host');
  await A.click('#lb-mode [data-v="tdm"]');
  ok(await until(() => S(B, () => document.querySelector('#lb-mode b').textContent === 'Team Deathmatch'), 8000), 'host changes mode, guest lobby updates live');
  await A.click('#lb-shuffle'); await A.click('#lb-balance'); await sleep(300);
  await A.click('#lb-copy');
  await A.click('#lb-ready');      // the guest is not ready (switching team cleared it): START asks again
  ok(await until(() => S(A, () => __steelstorm.state === 'lobby' && document.getElementById('lb-ready').textContent === 'START ANYWAY'), 3000), 'START with a player not ready: START ANYWAY');
  await A.click('#lb-ready');
  ok(await until(() => S(A, () => __steelstorm.state === 'match') && S(B, () => __steelstorm.state === 'match'), 15000), 'host starts: both in the match');
  const ma = await until(async () => { const a = await S(A, () => __steelstorm.ents().length), bb = await S(B, () => __steelstorm.ents().length); return a === bb && a > 0 && [a, bb]; }, 6000);
  ok(!!ma && (await S(B, () => __steelstorm.ents().filter(e => e.id >= 900).length)) === 0, 'guest has the same vehicles as the host, no showcase', ma);
  ok(await S(B, v => __steelstorm.match.pick === v && __steelstorm.me.def.id === v, bVeh), 'guest plays its lobby pick');
  await S(A, () => __steelstorm.end(0));
  ok(await until(() => S(B, () => __steelstorm.state === 'result'), 8000), 'guest gets the result');
  await A.click('#r-go'); await B.click('#r-go');
  ok(await until(() => S(A, () => __steelstorm.state === 'lobby') && S(B, () => __steelstorm.state === 'lobby'), 8000), 'both back in the party lobby');
  // the host leaves: the guest (successor) takes over the room
  let sawMig = false;
  await S(A, () => document.getElementById('lb-leave').click());
  const mig = await until(async () => { const t = await S(B, () => document.getElementById('lb-net').textContent); if (/Host left|moving/i.test(t)) sawMig = true; return (await S(B, () => __steelstorm.party.host && /^\d{6}$/.test(__steelstorm.party.code))) && t; }, 40000);
  ok(!!mig, 'host left: the guest becomes the host', { sawMigratingState: sawMig, now: mig });
  ok(await S(B, () => __steelstorm.state === 'lobby'), 'guest is still in a lobby after the migration');
  ok(await until(() => S(B, () => /Hosting/.test(document.getElementById('lb-net').textContent) && !document.getElementById('lb-ready').disabled), 5000), 'new host: connection state back to Hosting, START enabled');
  // kick: A joins B's new room, B kicks A
  const code2 = await S(B, () => __steelstorm.party.code);
  await S(A, c => { __steelstorm.ui.go('mp'); document.getElementById('p-code').value = c; document.getElementById('p-join').click(); }, code2);
  ok(await until(() => S(B, () => __steelstorm.party.roster.length === 2), 25000), 'A joins the migrated room');
  await until(() => S(B, () => !!document.querySelector('#lb-teams [data-kick]')), 5000);
  await B.click('#lb-teams [data-kick]');
  ok(await until(() => S(A, () => !__steelstorm.party.code && !document.getElementById('s-notice').classList.contains('hidden') && __steelstorm.state !== 'lobby'), 10000), 'kicked player gets a notice and leaves the lobby');
  await S(B, () => __steelstorm.party_leave());
}
ok(errors.length === 0, 'no script errors', errors.slice(0, 5));
console.log(fails ? 'FAILED ' + fails + ' / ' + (passes + fails) : 'ALL ' + passes + ' PASSED');
await b.close(); process.exit(fails ? 1 : 0);
