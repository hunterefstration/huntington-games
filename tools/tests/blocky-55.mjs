// Blocky Shooter 5.5: the new maps (Frostbite, Carnival), the four new weapons, the new zombies and boss, the new rewards,
// an old 5.4 save loading untouched, HUNTED mode with bots, the party version check, and frame time on the new maps.
// Serve the repo (python3 -m http.server 8090, or HG_BASE=http://127.0.0.1:<port>/) and run:
//   NODE_PATH=/opt/node22/lib/node_modules node tools/tests/blocky-55.mjs
import { newPage, launch, check } from './blocky-classes-lib.mjs';
let b = await launch();
const settingsFor = (map) => `localStorage.setItem('blocky21_settings', JSON.stringify({ map: '${map}', mode: 'classic', light: 'night', diff: 'normal', cls: 'assault', quality: 'low' })); localStorage.setItem('hgdev_blocky_quality', 'low');`;

// ---------- 1. Frostbite run + weapons + enemies ----------
{
  const errs = [];
  const { page, ctx } = await newPage(b, { init: settingsFor('frostbite'), errors: errs });
  const r = await page.evaluate(async () => {
    const B = window.__blocky, C = B.c55, S = () => B.state, out = {};
    const keep = () => { B.mpTest.hold(); if (B.state.currentGameState !== 'playing') B.start(); };
    B.debug(true); B.god(true); B.fresh();
    await new Promise(r => setTimeout(r, 1500));
    out.map = B.runInfo.map; out.solids = S().solids.length; out.ice = C.ice().length;
    B.mpTest.hold(); B.mpTest.dropAll();
    // stand at a known spot and look down -z
    const cam = S().camera; B.tpy(0, 0, 10); B.look(0, 0);
    const res = {};
    const tryGun = (id, enemyId, dist, frames, setup) => {
      keep(); B.mpTest.dropAll(); B.giveAll(); B.equip(id); B.mpTest.setAmmo(60);
      B.tpy(0, 0, 10); B.look(0, 0);
      const e = C.spawn(enemyId, 0, 10 - dist); const hp0 = e.userData.hp;
      if (setup) setup(e);
      B.modes.step(20, 33);       // raise the gun
      B.fire(true); B.modes.step(frames, 33); B.fire(false); B.modes.step(30, 33);
      return { hp0: Math.round(hp0), hp: Math.round(e.userData.hp), dead: !!e.userData.dead, frozen: e.userData.freezeT > 0 };
    };
    res.drum = tryGun('drum', 'tank', 6, 10);
    res.plasma = tryGun('plasma', 'shielder', 12, 12);
    // cryo: freeze a grunt
    keep(); B.mpTest.dropAll(); B.equip('cryo'); B.mpTest.setAmmo(120); B.tpy(0, 0, 10); B.look(0, 0);
    { const e = C.spawn('tank', 0, 4); B.modes.step(20, 33); B.fire(true); let frozen = false; for (let i = 0; i < 90 && !frozen; i++) { B.modes.step(1, 33); frozen = e.userData.freezeT > 0; } B.fire(false);
      res.cryo = { frozen, hp: Math.round(e.userData.hp), max: Math.round(e.userData.maxHp), lifeFrozen: C.life().frozen | 0 };
      // frozen takes +50%
      const before = e.userData.hp; B.mpTest.damage(e, 10); res.cryo.vuln = +(before - e.userData.hp).toFixed(1); }
    // plasma recharge
    keep(); B.mpTest.dropAll(); B.equip('plasma'); B.mpTest.setAmmo(10); B.modes.step(40, 33); res.plasmaRecharge = C.ammo('plasma');
    // seeker: fire to the side of a tank, rockets should home in
    keep(); B.mpTest.dropAll(); B.equip('seeker'); B.mpTest.setAmmo(9); B.tpy(0, 0, 10); B.look(0, 0);
    { const e = C.spawn('tank', 6, -14); const hp0 = e.userData.hp; B.modes.step(20, 33); const a0 = C.ammo('seeker'); B.fire(true); B.modes.step(2, 33); B.fire(false); B.modes.step(12, 33);
      const rk = C.rockets(); const fired = a0 - C.ammo('seeker'); B.modes.step(60, 33); res.seeker = { fired, rockets: rk.length, locked: rk.filter(r => r.tgt).length, dmg: Math.round(hp0 - e.userData.hp), dead: !!e.userData.dead }; }
    // enemies: bloater cloud, lobber bombs, the Winter King
    keep(); B.mpTest.dropAll(); B.tpy(0, 0, 10);
    { const e = C.spawn('bloater', 0, 4); B.mpTest.damage(e, 99999); B.modes.step(2, 33); res.bloater = { hazards: C.hazards().length }; }
    keep(); B.mpTest.dropAll();
    { const e = C.spawn('lobber', 0, -10); let shots = 0; for (let i = 0; i < 120 && !shots; i++) { B.modes.step(1, 33); shots = C.shots(); } res.lobber = { shots, state: e.userData.state }; }
    keep(); B.mpTest.dropAll();
    { const e = C.spawn('frost', 0, -14); let shots = 0; for (let i = 0; i < 200 && !shots; i++) { B.modes.step(1, 33); shots = C.shots(); }
      res.boss = { shots, hp: Math.round(e.userData.hp) }; B.mpTest.damage(e, e.userData.hp * 0.6); B.modes.step(5, 33); res.boss.phase2 = !!e.userData.phase2;
      B.mpTest.damage(e, 1e7); B.modes.step(3, 33); res.boss.killed = !!e.userData.dead; res.boss.reward = C.rewards()['camo:glacier']; res.boss.unlocked = C.unlocked('camo', 'glacier'); }
    out.res = res; out.waveBosses = B.waveBosses(5);
    out.wn = C.whatsNew().includes('5.5');
    return out;
  });
  console.log(JSON.stringify(r));
  const R = r.res;
  check('frostbite run starts', r.map === 'frostbite' && r.solids > 300 && r.ice === 1);
  check('drum shotgun damages', R.drum.hp < R.drum.hp0, JSON.stringify(R.drum));
  check('plasma rifle damages a shielder through its shield', R.plasma.hp < R.plasma.hp0, JSON.stringify(R.plasma));
  check('cryo blaster freezes', R.cryo.frozen && R.cryo.lifeFrozen >= 1, JSON.stringify(R.cryo));
  check('frozen zombies take +50%', R.cryo.vuln > 14, String(R.cryo.vuln));
  check('plasma cell recharges', R.plasmaRecharge > 10, String(R.plasmaRecharge));
  check('seeker rockets home in', R.seeker.fired === 3 && R.seeker.locked >= 1 && R.seeker.dmg > 0, JSON.stringify(R.seeker));
  check('bloater leaves a poison cloud', R.bloater.hazards >= 1);
  check('lobber lobs', R.lobber.shots >= 1, JSON.stringify(R.lobber));
  check('winter king attacks, enrages, dies, unlocks glacier', R.boss.shots >= 1 && R.boss.phase2 && R.boss.killed && R.boss.reward && R.boss.unlocked, JSON.stringify(R.boss));
  check('whats new mentions 5.5', r.wn);
  check('no script errors (frostbite)', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close(); await b.close(); b = await launch();
}

// ---------- 2. Carnival run ----------
{
  const errs = [];
  const { page, ctx } = await newPage(b, { init: settingsFor('carnival'), errors: errs });
  const r = await page.evaluate(async () => {
    const B = window.__blocky; B.debug(true); B.god(true); B.fresh();
    await new Promise(r => setTimeout(r, 1500));
    B.modes.step(60, 33);
    return { map: B.runInfo.map, playing: B.state.currentGameState, enemies: B.state.enemies.length, solids: B.state.solids.length };
  });
  console.log(JSON.stringify(r));
  check('carnival run starts and the wave spawns', r.map === 'carnival' && r.playing === 'playing' && r.solids > 300);
  check('no script errors (carnival)', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close(); await b.close(); b = await launch();
}

// ---------- 3. an old 5.4 save loads and keeps everything ----------
{
  const errs = [];
  const old = { xp: 12345, prestige: 2, runs: 40, kills: 5000, headshots: 900, bosses: 12, shots: 1, hits: 1, damage: 1, time: 100, waves: 300, best: { normal: 22, hard_rush: 15 },
    weaponKills: { ar: 100 }, cls: { assault: { runs: 3, kills: 50, best: 9, xp: 4000, tree: { a1: 2 }, spec: ['berserk', ''] } }, clsV: 1, clsTotal: 20, maps: { mall: { runs: 2, waves: 10, best: 8 } }, bossKills: { titan: 2 }, tourneyWins: 1 };
  const init = `localStorage.setItem('blocky21_life', ${JSON.stringify(JSON.stringify(old))}); localStorage.setItem('blocky21_settings', JSON.stringify({ map: 'mall', camo: 'glacier', quality: 'low' }));`;
  const { page, ctx } = await newPage(b, { init, errors: errs });
  const r = await page.evaluate(() => { const L = window.__blocky.c55.life(); return { xp: L.xp, prestige: L.prestige, kills: L.kills, best: L.best, cls: L.cls.assault, clsTotal: L.clsTotal, maps: L.maps, bossKills: L.bossKills, glacier: window.__blocky.c55.unlocked('camo', 'glacier'), stored: JSON.parse(localStorage.getItem('blocky21_life')).kills }; });
  console.log(JSON.stringify(r));
  check('old save keeps xp/prestige/kills/best/classes', r.xp === 12345 && r.prestige === 2 && r.kills === 5000 && r.best.normal === 22 && r.cls.xp >= 4000 && r.maps.mall.best === 8 && r.stored === 5000);
  check('new rewards stay locked on an old save', r.glacier === false);
  check('no script errors (old save)', errs.length === 0, errs.slice(0, 3).join(' | '));
}
await b.close();

const sleep = ms => new Promise(r => setTimeout(r, ms));
const lowQ = `localStorage.setItem('blocky21_settings', JSON.stringify({ quality: 'low', light: 'night' })); localStorage.setItem('hgdev_blocky_quality', 'low');`;

// ---------- 1. HUNTED with 3 bots ----------
{
  const b = await launch(); const errs = [];
  const { page } = await newPage(b, { init: lowQ, errors: errs });
  await page.evaluate(() => { __blocky.NET.lanOnly = true; document.getElementById('btn-mp').click(); });
  await page.click('#mp-host');
  const r = await page.evaluate(async () => {
    const B = window.__blocky, M = B.modes, out = {};
    B.debug(true);
    M.setMode('hunted'); B.NET.lobby.map = 'frostbite'; out.bots = M.addBots(3); M.start();
    await new Promise(r => setTimeout(r, 2500));
    M.step(10, 50);
    const bots = M.players().filter(p => p.bot).map(p => p.id);
    out.start = { on: M.state().on, mode: M.state().mode, hunted: M.state().hunted, map: B.runInfo.map };
    M.kill(bots[0], 0); M.step(2, 50);
    out.afterFirst = { hunted: M.state().hunted, w: M.weapons(), hp: B.state.currentHp };
    M.kill(bots[1], 0); M.step(2, 50);
    out.myPts = M.players().find(p => p.id === 0).pts;
    M.kill(0, bots[2]); M.step(2, 50);
    out.botHunted = { hunted: M.state().hunted === bots[2], bot: M.botState(bots[2]) };
    M.kill(bots[2], 0); M.step(2, 50);
    out.retake = { hunted: M.state().hunted, pts: M.players().find(p => p.id === 0).pts };
    await new Promise(r => setTimeout(r, 500)); M.step(90, 50);
    out.respawn = { dead: B.netDead(), w: M.weapons() };
    M.step(90, 50); B.NET.me.pts = 11; const alive = M.players().filter(p => p.bot && p.alive).map(p => p.id); M.kill(alive[0], 0); M.step(2, 50);
    out.over = M.state().over;
    await new Promise(r => setTimeout(r, 2500));
    out.huntWins = B.c55.life().huntWins | 0;
    return out;
  });
  console.log(JSON.stringify(r));
  check('hunted match starts with bots', r.bots === 3 && r.start.on && r.start.mode === 'hunted' && r.start.hunted === -1 && r.start.map === 'frostbite');
  check('first kill makes you the Hunted (minigun, 300 hp)', r.afterFirst.hunted === 0 && r.afterFirst.w.list.join() === 'minigun' && r.afterFirst.w.maxHp === 300 && r.afterFirst.hp === 300, JSON.stringify(r.afterFirst));
  check('kills as the Hunted score', r.myPts === 1);
  check('a bot that kills the Hunted takes over (300 hp, minigun)', r.botHunted.hunted && r.botHunted.bot.hp === 300 && r.botHunted.bot.w === 'minigun', JSON.stringify(r.botHunted));
  check('killing the Hunted scores 2', r.retake.hunted === 0 && r.retake.pts === 3, JSON.stringify(r.retake));
  check('respawning as the Hunted gives the kit', !r.respawn.dead && r.respawn.w.list.join() === 'minigun', JSON.stringify(r.respawn));
  check('12 points wins and is counted', r.over && r.huntWins === 1, JSON.stringify({ over: r.over, w: r.huntWins }));
  check('no script errors (hunted)', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
}

// ---------- 2. party version check (both directions) ----------
{
  const b = await launch(); const errs = [];
  const { page } = await newPage(b, { init: lowQ, errors: errs });
  await page.evaluate(() => { __blocky.NET.lanOnly = true; document.getElementById('btn-mp').click(); });
  await page.click('#mp-host');
  const r = await page.evaluate(async () => {
    const B = window.__blocky, M = B.modes, out = {};
    const mk = (name) => { M.addBots(1); const p = [...B.netPlayers.values()].find(q => q.bot && !q.fake); delete p.bot; p.fake = true; p.pending = true; p.name = 'Player'; const sent = []; p.peer = { rel: { readyState: 'open', send: (s) => sent.push(JSON.parse(s)) }, fast: { readyState: 'closed' }, pc: { close() {} }, player: p }; return { p, sent }; };
    const A = mk(), C = mk();
    B.c55.netMsg(A.p.peer, { t: 'hi', name: 'OldGuy', look: null });            // a 5.4 guest (no version)
    B.c55.netMsg(C.p.peer, { t: 'hi', name: 'NewGuy', look: null, v: B.c55.proto });
    await new Promise(r => setTimeout(r, 700));
    out.oldRefused = A.sent.some(m => m.t === 'full' && /5\.4 or older/.test(m.why)) && !B.netPlayers.has(A.p.id);
    out.newOk = B.netPlayers.has(C.p.id) && C.p.name === 'NewGuy' && C.sent.some(m => m.t === 'lobby' && m.v === B.c55.proto);
    out.hostMsg = B.NET.hostMsg;
    return out;
  });
  // guest side: a lobby from an old host
  const g = await page.evaluate(() => {
    const B = window.__blocky; document.getElementById('btn-mp').click();
    B.NET.host = false; B.NET.on = true; B.NET.joinState = 'connected'; B.NET.hostPeer = { rel: { readyState: 'open', send() {} }, fast: { readyState: 'closed' }, pc: { close() {} } };
    B.c55.netMsg(B.NET.hostPeer, { t: 'lobby', you: 3, mode: 'coop', map: 'random', diff: 'normal', players: [] });
    return { err: B.NET.joinErr, state: B.NET.joinState, on: B.NET.on };
  });
  console.log(JSON.stringify(r), JSON.stringify(g));
  check('host refuses a 5.4 guest with a version message', r.oldRefused && /5\.4 or older/.test(r.hostMsg));
  check('host accepts a 5.5 guest', r.newOk);
  check('guest refuses a 5.4 host with a version message', g.state === 'error' && !g.on && /The host is on Blocky Shooter 5\.4 or older/.test(g.err), g.err);
  check('no script errors (version check)', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
}

// ---------- 3. frame time: new maps vs old maps (low quality, a wave of zombies) ----------
{
  const b = await launch(); const errs = [];
  const { page } = await newPage(b, { init: `localStorage.setItem('blocky21_settings', JSON.stringify({ quality: 'low', light: 'night', map: 'blockyard' })); localStorage.setItem('hgdev_blocky_quality', 'low');`, errors: errs });
  const r = await page.evaluate(async () => {
    const B = window.__blocky, out = {};
    B.debug(true); B.god(true); B.fresh();
    await new Promise(r => setTimeout(r, 1500));
    for (const m of ['blockyard', 'military', 'mall', 'frostbite', 'carnival', 'blockyard']) {
      B.map(m); B.tpy(B.spawnPt[0], 0, B.spawnPt[1]); B.look(0.7, -0.05);
      B.modes.step(15, 33);
      const T = []; for (let k = 0; k < 3; k++) { const t0 = performance.now(); B.modes.step(20, 33); T.push((performance.now() - t0) / 20); }
      T.sort((a, b) => a - b);
      out[m + (out[m] ? '2' : '')] = { ms: +T[1].toFixed(2), calls: B.info.calls, tris: B.info.tris };
    }
    return out;
  });
  console.log(JSON.stringify(r));
  const base = Math.max(r.blockyard.ms, r.blockyard2.ms, r.military.ms);
  check('frostbite frame time not above the old maps', r.frostbite.ms <= base * 1.1, `${r.frostbite.ms} vs ${base}`);
  check('carnival frame time not above the old maps', r.carnival.ms <= base * 1.1, `${r.carnival.ms} vs ${base}`);
  check('no script errors (frame time)', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
}
