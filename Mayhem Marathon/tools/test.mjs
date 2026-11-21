// Mayhem Marathon self-test through the debug hook window.__mayhem. Needs no rig: serves the checkout and fakes the CDN.
//   NODE_PATH=/opt/node22/lib/node_modules node "Mayhem Marathon/tools/test.mjs"            everything
//   NODE_PATH=... node "Mayhem Marathon/tools/test.mjs" rounds logs gust                  only these rounds (also: show, perf, save, net)
//   NODE_PATH=... node "Mayhem Marathon/tools/test.mjs" mp      two real players over HGNet (needs the rig's MQTT broker on :9001:
//                                                               bash tools/rig/up.sh; MQTT_JS = path of mqtt.min.js)
// Checks: every round starts and ends with qualifiers/a winner with bots, every spawn point is safe (floor below,
// nothing solid inside), bots finish/survive at sensible rates, a full show runs to a crown, old saves load,
// frame time per map, and no script errors.
import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url)), TOOLS = process.env.HG_TOOLS || '/tmp/hg-tools';
const args = process.argv.slice(2), parts = new Set(args.filter(a => ['rounds', 'show', 'perf', 'save', 'net', 'mp'].includes(a)));
const only = args.filter(a => !parts.has(a)); if (!parts.size) ['rounds', 'show', 'perf', 'save', 'net'].forEach(p => parts.add(p));
const TYPES = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json' };
const server = http.createServer((q, r) => {
  let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end('no'); } r.writeHead(200, { 'content-type': TYPES[f.split('.').pop()] || 'application/octet-stream' }); r.end(b); });
});
await new Promise(res => server.listen(0, '127.0.0.1', res));
const URL0 = 'http://127.0.0.1:' + server.address().port + '/Mayhem%20Marathon/index.html';
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fails = 0; const errs = [];
const ok = (cond, what, info) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + what + (info ? '  ' + info : '')); if (!cond) fails++; };
const MQTT_JS = process.env.MQTT_JS || '/home/user/grapevine/relay/mqtt.min.js';
async function open(initSave, query) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  page.on('requestfailed', r => errs.push('request failed ' + r.url().slice(0, 140))); page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());            // routes added later win: this one first
  await page.route(/three@0\.160\.0\/(.*)$/, r => { const m = /three@0\.160\.0\/(.*)$/.exec(r.request().url()), f = TOOLS + '/cdn/package/' + m[1].split('?')[0]; fs.existsSync(f) ? r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(f) }) : process.env.HG_LIVE_CDN ? r.continue() : r.abort(); });      // HG_LIVE_CDN=1: no local three.js copy (Windows), use the real CDN
  if (initSave) await page.addInitScript(s => { if (!sessionStorage.getItem('planted')) { localStorage.setItem('mayhem_save', s); sessionStorage.setItem('planted', '1'); } }, JSON.stringify(initSave));
  if (query) await page.route(/mqtt(@[\d.]+)?\/dist\/mqtt\.min\.js/, r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(MQTT_JS) }));
  await page.goto(URL0 + (query || ''));
  await page.waitForFunction(() => window.__mayhem, null, { timeout: 30000 }).catch(e => { console.log('the game did not start:', errs.slice(0, 3).join(' | ')); throw e; });
  return page;
}
const page = await open();
const ALL = await page.evaluate(() => Object.keys(window.__mayhem.ROUND_INFO));
const NEW = ['logs', 'gust', 'meteor', 'turf', 'bomb', 'hill', 'pillars'].filter(r => ALL.includes(r));

// one round with 15 bots (the player is on autopilot): spawns, then run to the end
async function runRound(rid, skill) {
  return page.evaluate(([rid, skill]) => {
    const M = window.__mayhem; M.manual(true); M.noRender(true); M.autopilot(true); M.startRound(rid, { bots: 15, skill });
    const R = M.R, L = M.L, info = M.ROUND_INFO[rid];
    const badSpawns = L.spawns.map((s, i) => [i, s]).filter(([i, s]) => !M.spawnOk(s)).map(([i]) => i);
    const startBad = R.cs.filter(c => !M.spawnOk([c.b.p.x, c.b.p.y, c.b.p.z])).map(c => c.name);
    const ext = M.levelExtent();
    let under = 0, oob = 0, minY = 1e9;
    for (let k = 0; k < 9 * 10; k++) {          // intro + countdown + 1 s of play: nobody may drop
      M.step(0.1);
      for (const c of R.cs) { if (c.hide) continue; minY = Math.min(minY, c.b.p.y); if (c.b.p.y < (c.spawnY || 0) - 1.5) under++; if (c.b.p.x < ext.x0 - 1 || c.b.p.x > ext.x1 + 1 || c.b.p.z < ext.z0 - 1 || c.b.p.z > ext.z1 + 1) oob++; }
    }
    let guard = 0; while (R.phase !== 'over' && guard++ < (info.time + 20) * 2) M.step(0.5);
    const res = R.results || {};
    const bots = R.cs.filter(c => c.bot), done = R.cs.filter(c => c.done === 'q').length;
    return { rid, kind: info.kind, n: R.cs.length, q: R.q, ended: R.phase === 'over', t: +R.t.toFixed(1), qual: (res.q || []).length, order: (res.order || []).length, winner: res.winner,
      finished: R.finished.length, outs: R.outs.length, doneQ: done, badSpawns, startBad, under, oob, minY: +minY.toFixed(2), crownBy: R.crownBy, score: R.score && R.score.slice ? R.score.slice() : null, spawns: L.spawns.length };
  }, [rid, skill]);
}
if (parts.has('rounds')) {
  const list = only.length ? only : ALL;
  for (const rid of list) {
    for (const skill of [1, 0, 2]) {
      if (skill !== 1 && !NEW.includes(rid) && !only.length) continue;
      const r = await runRound(rid, skill);
      const finalOk = r.kind !== 'final' || r.winner != null;
      const rate = r.kind === 'race' ? r.finished / r.n : r.kind === 'survive' ? (r.n - r.outs) / r.n : null;
      const sensible = r.kind === 'race' ? r.finished >= Math.min(r.q, Math.ceil(r.n * (skill === 0 ? 0.25 : 0.4))) : r.kind === 'survive' ? r.qual >= 1 && r.outs >= 1 : true;
      ok(r.ended && r.qual >= 1 && r.order === r.n && finalOk && !r.badSpawns.length && !r.startBad.length && !r.under && !r.oob && sensible,
        `${rid} (${r.kind}, skill ${skill})`, `t=${r.t} q=${r.q} qualified=${r.qual}/${r.n} finished=${r.finished} outs=${r.outs}` + (rate != null ? ` rate=${(rate * 100).toFixed(0)}%` : '') +
        (r.winner != null ? ' winner=' + r.winner : '') + (r.score ? ' score=' + JSON.stringify(r.score) : '') + ` spawns=${r.spawns}` +
        (r.badSpawns.length ? ' BADSPAWNS=' + r.badSpawns : '') + (r.startBad.length ? ' STARTBAD=' + r.startBad.length : '') + (r.under ? ' UNDER=' + r.under : '') + (r.oob ? ' OOB=' + r.oob : ''));
    }
  }
}
if (parts.has('show')) {
  for (const o of [{ length: 5, skill: 1 }, { length: 4, skill: 3 }]) {
    const s = await page.evaluate(o => {
      const M = window.__mayhem; M.manual(true); M.noRender(true); M.autopilot(true); M.startShow(o);
      let g = 0; while (!(M.state().show && M.state().show.over) && g++ < 1200) M.step(1);
      const st = M.state(); return { over: st.show.over, winner: st.show.winner, used: st.show.used, rounds: st.show.results.map(r => r.rid + ':' + r.q + '/' + r.n) };
    }, o);
    ok(s.over && s.winner != null, `full show (${o.length} rounds, skill ${o.skill}) runs to a crown`, s.rounds.join(' '));
  }
  const pick = NEW.length ? NEW : ALL.slice(0, 6);
  const s = await page.evaluate(pick => {
    const M = window.__mayhem; M.manual(true); M.noRender(true); M.autopilot(true); M.startShow({ length: 5, skill: 1, pick });
    let g = 0; while (!(M.state().show && M.state().show.over) && g++ < 1200) M.step(1);
    const st = M.state(); return { over: st.show.over, winner: st.show.winner, used: st.show.used };
  }, pick);
  ok(s.over && s.winner != null && s.used.every(r => pick.includes(r)), 'custom show plays only the picked rounds', s.used.join(','));
}
if (parts.has('perf')) {
  const list = only.length ? only : ALL;
  const out = [];
  for (const rid of list) {
    const ms = await page.evaluate(rid => {
      const M = window.__mayhem; M.manual(true); M.noRender(false); M.autopilot(true); M.quality('med'); M.startRound(rid, { bots: 15, skill: 1 }); M.step(10.5);
      for (let i = 0; i < 5; i++) M.renderInfo(true);
      const t0 = performance.now(); for (let i = 0; i < 20; i++) { M.step(1 / 60); M.renderInfo(true); }
      const info = M.renderInfo(true); return { ms: (performance.now() - t0) / 20, calls: info.calls, tris: info.tris };
    }, rid);
    out.push([rid, ms]);
  }
  const old = out.filter(([r]) => !NEW.includes(r)), nw = out.filter(([r]) => NEW.includes(r)), avg = a => a.reduce((s, [, m]) => s + m.ms, 0) / Math.max(1, a.length);
  for (const [r, m] of out) console.log(`      ${r.padEnd(8)} ${m.ms.toFixed(1)} ms/frame  ${m.calls} calls  ${(m.tris / 1000).toFixed(0)}k tris`);
  const worstOld = Math.max(...old.map(([, m]) => m.ms), 0);
  if (nw.length && old.length) ok(Math.max(...nw.map(([, m]) => m.ms)) <= worstOld * 1.15, 'new maps render no slower than the old ones', `old avg ${avg(old).toFixed(1)} ms (worst ${worstOld.toFixed(1)}), new avg ${avg(nw).toFixed(1)} ms`);
  await page.evaluate(() => window.__mayhem.noRender(true));
}
if (parts.has('save')) {
  const old = { v: 1, name: 'Old Timer', kudos: 321, fame: 900, owned: { h3: true, c6: true }, look: { col: 'c6', col2: 'c5', pat: 'p0', hat: 'h3', visor: 'v0', trail: 't0', pose: 'e1' },
    stats: { crowns: 3, shows: 11, qualified: 29, rounds: 40, eliminations: 8, finals: 4, kudosEarned: 900 }, settings: { quality: 'low', music: 0.3, sfx: 0.8, mute: false, sens: 1, invertY: false, names: true }, opts: { bots: 8, skill: 2, length: 5, scoring: 'auto' }, seenHow: true };
  const p2 = await open(old);
  const s = await p2.evaluate(() => { const s = window.__mayhem.save; return { v: s.v, name: s.name, kudos: s.kudos, crowns: s.stats.crowns, qualified: s.stats.qualified, shows: s.stats.shows, hat: s.look.hat, col: s.look.col, owned: Object.keys(s.owned), q: s.settings.quality, rp: typeof s.rp, ls: JSON.parse(localStorage.getItem('mayhem_save')).stats.crowns }; });
  ok(s.name === 'Old Timer' && s.kudos === 321 && s.crowns === 3 && s.qualified === 29 && s.shows === 11 && s.hat === 'h3' && s.col === 'c6' && s.q === 'low' && s.ls === 3, 'an old v1 save loads with everything kept', JSON.stringify(s));
  const pre = await open({ crowns: 2, shows: 5, qualified: 7, unlocked: ['h1'], coins: 99 });
  const s2 = await pre.evaluate(() => { const s = window.__mayhem.save; return { crowns: s.stats.crowns, q: s.stats.qualified, kudos: s.kudos, h1: !!s.owned.h1 }; });
  ok(s2.crowns === 2 && s2.q === 7 && s2.kudos === 99 && s2.h1, 'a pre-release test save still migrates', JSON.stringify(s2));
  await p2.close(); await pre.close();
}
if (parts.has('net')) {
  const r = await page.evaluate(() => { const M = window.__mayhem; return M.protoCheck ? M.protoCheck() : null; });
  ok(r && r.same === true && r.older !== true && r.none !== true && typeof r.msg === 'string', 'different versions refuse each other with a message', JSON.stringify(r));
}
if (parts.has('mp')) {
  // a host and a guest over the rig's MQTT broker; a 1.0-style guest (no protocol number) must be refused with a message
  const Q = '?hgrelays=ws://127.0.0.1:9001&hgpeer=off';
  const A = await open(null, Q), B = await open(null, Q), C = await open(null, Q);
  const until = async (p, fn, arg, ms = 30000) => { const t0 = Date.now(); for (;;) { const v = await p.evaluate(fn, arg).catch(() => null); if (v) return v; if (Date.now() - t0 > ms) return null; await new Promise(r => setTimeout(r, 300)); } };
  for (const p of [A, B]) await p.evaluate(() => { const M = window.__mayhem; M.noRender(true); M.autopilot(true); });
  await A.evaluate(() => { const M = window.__mayhem; Object.assign(M.save.opts, { bots: 4, skill: 1, length: 3, scoring: 'auto', pick: ['bomb', 'turf', 'hill'] }); M.ui.showLobby(); M.host(); });
  const code = await until(A, () => /^\d{6}$/.test(window.__mayhem.NET.code) && window.__mayhem.NET.code);
  ok(!!code, 'host opens a room on the rig broker', code || '');
  await B.evaluate(c => { window.__mayhem.ui.showLobby(); window.__mayhem.join(c); }, code);
  const joined = await until(B, () => window.__mayhem.NET.myId > 0 && window.__mayhem.NET.roster.length >= 2 && window.__mayhem.NET.roster.length);
  ok(!!joined, 'a 1.1 guest joins a 1.1 host', 'roster ' + joined);
  const old = await C.evaluate(async c => {
    await new Promise(r => { const s = document.createElement('script'); s.src = '../gv/vendor/hgnet.js'; s.onload = r; document.head.appendChild(s); });
    const net = window.HGNet.create({ game: 'mayhem' });
    try { await net.join(c, { name: 'Old timer', info: { look: {} } }); return 'joined (bad)'; } catch (e) { return 'refused: ' + e.message; }
  }, code);
  ok(/older version/.test(old), 'a 1.0 guest (no protocol number) is refused with a clear message', old);
  await A.evaluate(() => window.__mayhem.start());
  const seen = [];
  for (let k = 0; k < 3; k++) {
    const ra = await until(A, n => { const s = window.__mayhem.state(); return s.round && s.show.idx === n && s.round.phase === 'play' && s.round.rid; }, k, 60000);
    const rb = await until(B, n => { const s = window.__mayhem.state(); return s.round && s.show.idx === n && s.round.rid; }, k, 20000);
    await new Promise(r => setTimeout(r, 12000));
    const sync = await Promise.all([A, B].map(p => p.evaluate(() => { const R = window.__mayhem.R; if (!R) return {}; return { rid: R.rid, bombs: R.bombs ? [...R.bombs].sort().join() : null, paint: R.paint ? Array.from(R.paint).join('') : null, hold: R.hold ? Object.keys(R.hold).length : null, n: R.cs.filter(c => !c.hide).length }; })));
    const same = sync[0].rid === sync[1].rid && sync[0].bombs === sync[1].bombs && (!sync[0].paint || sync[0].paint.split('').filter((c, i) => c === sync[1].paint[i]).length >= 130);
    ok(ra && ra === rb && same, `round ${k + 1} (${ra}) runs on both machines in step`, JSON.stringify(sync.map(x => ({ rid: x.rid, bombs: x.bombs, hold: x.hold, n: x.n, paint: x.paint ? x.paint.slice(0, 24) : undefined }))));
    const ea = await until(A, () => window.__mayhem.R && window.__mayhem.R.results && window.__mayhem.R.results.order.join(), null, 150000);
    const eb = await until(B, () => window.__mayhem.R && window.__mayhem.R.results && window.__mayhem.R.results.order.join(), null, 20000);
    ok(ea && ea === eb, `round ${k + 1} ends with the same results on both`, (ea || '').slice(0, 60));
    seen.push(ra);
  }
  const win = await Promise.all([A, B].map(p => until(p, () => { const s = window.__mayhem.state(); return s.show && s.show.over && String(s.show.winner); }, null, 30000)));
  ok(win[0] && win[0] === win[1], 'the show ends with the same winner on both', win.join(' / ') + '  rounds ' + seen.join(','));
  for (const p of [A, B, C]) await p.close();
}
const real = errs.filter(e => !/ResizeObserver|Failed to load resource|net::ERR/.test(e));
ok(!real.length, 'no script errors', real.slice(0, 3).join(' | '));
await browser.close(); server.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
