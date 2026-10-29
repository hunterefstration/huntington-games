// =====================================================================
//  TROOPS  (behaviour lives in troops.js; shared helpers here)
// =====================================================================
function moveTo(t, x, y, sp) {
  const dx = x - t.x, dy = y - t.y, dd = Math.hypot(dx, dy);
  if (dd <= sp) { t.x = x; t.y = y; return true; }
  t.x += dx / dd * sp; t.y += dy / dd * sp; t.angle = Math.atan2(dy, dx); return false;
}
function updateTank(t) {
  // by default it drives up the path from the base, shooting; with an order it goes there and holds
  if (t.order) { if (moveTo(t, t.order.x, t.order.y, t.speed)) { t.home = t.order; t.order = null; t.holding = true; } }
  else if (!t.holding) {
    const p = G.paths[t.path]; t.d = Math.max(0, t.d - t.speed);
    pathPos(p, t.d, _p); t.angle = Math.atan2(-_p.dy, -_p.dx); t.x = _p.x; t.y = _p.y;
    if (t.d <= 0) t.holding = true;
  }
  let best = null, bd = t.range;
  for (const e of G.enemies) { if (!e.alive || e.air || e.burrowed || e.charmT > 0) continue; const dd = dist(e.x, e.y, t.x, t.y); if (dd < bd) { bd = dd; best = e; } }
  if (best) {
    t.turret = Math.atan2(best.y - t.y, best.x - t.x);
    if (t.cd <= 0) { t.cd = t.rate; hurt(best, t.dmg, {}); G.lines.push({ x1: t.x, y1: t.y, x2: best.x, y2: best.y, life: 5, ml: 5, color: '#fff', w: 2 }); burst(best.x, best.y, '#f39c12', 5, 2); sfx('shoot'); }
    if (bd < t.r + best.r + 2) { if (!best.blocker || best.blocker.hp <= 0) best.blocker = t; hurt(best, 1.2, { noVar: true }); }
  }
}

// =====================================================================
//  ENEMY UPDATE
// =====================================================================
function updateEnemy(e) {
  if (e.flash > 0) e.flash--;
  if (e.revealedT > 0) e.revealedT--; else e.radarMark = 0;
  if (e.markT > 0) e.markT--; else e.mark = 0;
  if (e.brittleT > 0) e.brittleT--; else e.brittle = 0;
  if (e.jam > 0) e.jam--;
  if (e.mireT > 0) e.mireT--;
  if (e.bountyT > 0) e.bountyT--;
  if (e.rallyT > 0) e.rallyT--;
  // alien barrier: snaps back 5 seconds after it breaks, and keeps poison and fire out while it is up
  if (e.maxBarrier > 0 && e.barrier <= 0 && --e.barrierDownT <= 0) restoreBarrier(e);
  const walled = e.barrier > 0;
  if (e.poison) { const ps = e.poison; if (!walled) { e.hp -= ps.dps; if (ps.src) ps.src.dealt += ps.dps; } if (--ps.t <= 0) e.poison = null; if (e.hp <= 0) { killEnemy(e, { src: ps.src, group: ps.group }); return; } }
  if (e.burn) { if (!walled) { e.hp -= e.burn.dps; if (e.burn.src) e.burn.src.dealt += e.burn.dps; } if (--e.burn.t <= 0) e.burn = null; if (e.hp <= 0) { killEnemy(e, {}); return; } }
  const regen = (e.def.regen || 0) + (e.affixRegen || 0);
  if (regen && !e.jam && !e.poison && !e.burn && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * regen / 60 * 3);
  if (e.def.heal && !e.jam) for (const o of G.enemies) if (o !== e && o.alive && o.hp < o.maxHp && dist(o.x, o.y, e.x, e.y) < e.def.healRange) o.hp = Math.min(o.maxHp, o.hp + e.def.heal * e.wave * 0.2 + 0.1);
  if (e.def.summon && !e.jam && --e.summonT <= 0) { e.summonT = e.def.summonEvery || (e.def.summon === 'drone' ? 240 : 120); spawnChild(e, e.def.summon, rand(-6, 6)); }
  if (e.def.projector && !e.jam && --e.projT <= 0) { e.projT = 300; projectBarrier(e); }
  if (e.def.abduct && !e.jam && e.stunT <= 0 && e.charmT <= 0 && --e.abductT <= 0) abductTower(e);
  if (e.def.boss) bossTick(e);
  if (e.charmT > 0) { charmStep(e); return; }
  if (e.def.burrow && !e.jam) {
    if (--e.burrowT <= 0) { e.burrowed = !e.burrowed; e.burrowT = e.burrowed ? 120 : 300; burst(e.x, e.y, '#8d6e63', 8, 2); if (e.burrowed && e.blocker) { e.blocker = null; } }
  }
  if (e.stunT > 0) { e.stunT--; if (e.def.warp && e.warpT <= 60) { e.warpT = 150; floatText(e.x, e.y - e.r - 8, 'warp cancelled', '#ea80fc'); } return; }
  // Warp Stalker: charges for a second (it glows), then jumps ahead, even past walls
  if (e.def.warp && !e.jam && !e.air && --e.warpT <= 0) warpJump(e);
  // blocked by a troop or a fence: stand and fight it
  let blocked = false;
  const ramming = e.def.steam && e.bossPh === 2;       // a Railway Gun at full steam cannot be held up
  if (!e.air && !e.burrowed && !ramming) {
    if (e.blocker && (e.blocker.hp <= 0 || dist(e.blocker.x, e.blocker.y, e.x, e.y) > e.r + e.blocker.r + 10)) e.blocker = null;
    if (e.blocker) {
      blocked = true; const b = e.blocker;
      b.hp -= e.dmg / 60 * (e.def.shred ? 3 : 1) * (b.armor ? 0.6 : 1) * 0.7 * b.guard * b.bg * (1 - (b.dodge || 0)); b.flash = 3;
      if (b.thorns && (G.tick + e.uid) % 6 === 0) hurt(e, b.thorns * 0.1 * (1 + G.wave * 0.08), { noVar: true, pierceArmor: true });
      if (b.hp <= 0) onTroopDeath(b);
    }
    else for (const f of G.walls) {
      if (f.hp <= 0) continue;
      if (dist(f.x, f.y, e.x, e.y) <= e.r + 14) {
        // the longer an enemy is stuck on a wall the harder it chews (+100% every 5 seconds), so no wall can hold the road forever
        blocked = true; e.chew = (e.chew || 0) + 1; f.hitT = 90;
        f.hp -= e.dmg / 60 * (e.def.shred ? 3 : 1) * f.guard * f.bgm * (1 + e.chew / 300);
        if (Math.random() < 0.08) burst(f.x, f.y, '#e67e22', 1, 1);
        if (f.thorns && (G.tick + e.uid) % 6 === 0) hurt(e, f.thorns * 0.1 * (1 + G.wave * 0.08), { noVar: true, pierceArmor: true, src: f.units[0], group: f });
        if (f.hp <= 0) destroyFence(f);
        break;
      }
    }
  }
  if (blocked) return;
  e.chew = 0;
  let sp = e.speed;
  if (e.def.enrage && e.hp < e.maxHp * 0.5) sp *= 2;
  if (e.def.berserk && e.maxBarrier > 0 && e.barrier <= 0) sp *= 1.5;
  if (ramming) sp *= 3;
  if (e.rallyT > 0) sp *= 1.25;
  if (!e.def.noSlow) {
    let slow = 0;
    if (e.slowT > 0) { e.slowT--; slow = e.slowP; if (e.slowT <= 0) e.slowP = 0; }
    if (e.slowAura) slow = Math.max(slow, e.slowAura);
    if (G.freezeSlowT > 0) slow = Math.max(slow, 0.5);
    sp *= 1 - slow;
  }
  if (e.burrowed) sp *= 0.8;
  if (!e.air && G.paths[e.path].zones) sp *= terrainMul(e);
  if (e.def.blink && !e.jam && --e.blinkT <= 0) { e.blinkT = 170; burst(e.x, e.y, '#e056fd', 10, 2.5); e.d += 45; }
  e.d += sp;
  const p = G.paths[e.path];
  if (e.air) {
    const end = p.pts[p.pts.length - 1], f = Math.min(1, e.d / p.air.len);
    e.x = p.air.ax + (end.x - p.air.ax) * f; e.y = p.air.ay + (end.y - p.air.ay) * f; e.angle = Math.atan2(end.y - p.air.ay, end.x - p.air.ax);
    if (f >= 1) leak(e);
  } else {
    if (e.d >= p.len) { leak(e); return; }
    pathPos(p, e.d, _p); e.x = _p.x; e.y = _p.y; e.angle = Math.atan2(_p.dy, _p.dx);
  }
}
function leak(e) {
  if (!e.alive) return;
  e.alive = false;
  const dmg = e.dmg; G.lives -= dmg; G.stats.leaked++; G.stats.lost += dmg;
  floatText(G.base.x, G.base.y - 30, '-' + dmg, '#ff5252', true); burst(G.base.x, G.base.y, '#e74c3c', 18, 3);
  shake(Math.min(10, 2 + dmg / 20)); sfx('leak');
  if (G.lives <= 0) { G.lives = 0; gameOver(false); }
}
function destroyFence(f) {
  if (f.hp <= 0 && f.dead) return;
  f.hp = 0; f.dead = true; burst(f.x, f.y, f.def.color, 20, 3); sfx('boom');
  if (f.boom) { aoeHurt(f.x, f.y, f.boomR, f.boom * (1 + G.wave * 0.15), { src: f.units[0], group: f }, false); burst(f.x, f.y, '#ff7043', 30, 5, 4, 28); G.lines.push({ ring: true, x: f.x, y: f.y, r: f.boomR, life: 16, ml: 16, color: '#ffb347' }); shake(4); }
  removeTower(f);
}
function removeTower(g) {
  const i = G.towers.indexOf(g); if (i >= 0) G.towers.splice(i, 1);
  G.sel.towers.delete(g);
  if (g.squad) for (const t of g.squad) { t.hp = 0; t.expired = true; }
  if (g.def.kind === 'fence') { const w = G.walls.indexOf(g); if (w >= 0) G.walls.splice(w, 1); }
  refreshSelection();
}

// =====================================================================
//  WAVES
// =====================================================================
const WAVE_THEMES = [
  { id: 'swarm', label: 'SWARM', from: 6, pool: { swarm: 5, fast: 3, dismount: 0, commando: 1 } },
  { id: 'armored', label: 'ARMORED', from: 9, pool: { armored: 4, tank: 3, heavytank: 2, colossus: 1, shielded: 2 } },
  { id: 'air', label: 'AIR RAID', from: 10, pool: { drone: 5, jet: 3, zeppelin: 2, hive: 1 } },
  { id: 'rush', label: 'BLITZ', from: 8, pool: { fast: 4, commando: 3, assault: 2, swarm: 2 } },
  { id: 'stealth', label: 'STEALTH', from: 17, pool: { phantom: 5, phasewalker: 2, burrower: 2 } },
  { id: 'convoy', label: 'CONVOY', from: 12, pool: { basic: 3, truck: 2, dronecmd: 1, carrier: 1, medic: 1 } },
  { id: 'alien', label: 'ALIENS', from: 16, pool: { greyscout: 5, stalker: 3, splitter: 3, saucer: 2, shielddrone: 2, xbrute: 1 } }
];
// the boss of a boss wave (every 10th wave, every 5th with the Daily 'Boss Rush' modifier)
function bossAt(n) { const k = G.mods.bossx ? n / 5 - 1 : n / 10 - 1, L = BOSS_ROTATION.length; return BOSS_ROTATION[(((k + (G.bossShift || 0)) % L) + L) % L]; }
const isBossWave = (n) => n % 10 === 0 || (!!G.mods.bossx && n % 5 === 0);
const waveGoal = () => G.endlessContinued ? 0 : (own(MODES, G.opts.mode) ? MODES[G.opts.mode].goal : 0);
function buildWave(n) {
  const out = []; let label = 'MIXED', t = 30, boss = null;
  const add = (id, gap, affix, hpMul) => { out.push(hpMul ? { id, at: t, affix, hpMul } : { id, at: t, affix }); t += gap; };
  let affixChance = S.enemyVariety ? clamp((n - 6) * 0.008, 0, 0.45) : 0;
  if (G.mods.elite) affixChance = Math.max(affixChance, 0.34);
  const rollAffix = () => Math.random() < affixChance ? pick(AFFIXES).id : null;
  if (n === 1) { label = 'FIRST CONTACT'; for (let i = 0; i < 6; i++) add('basic', rand(36, 50)); return { list: out, label }; }
  if (n % 100 === 0 && G.opts.mode === 'classic') {
    label = 'FINALE';
    for (let i = 0; i < 12; i++) { add('titan', 40, null, 0.85); for (let j = 0; j < 12; j++) add('fast', 10, rollAffix()); }     // 2.6: finale titans stomp now, so they carry a little less health
    return { list: out, label };
  }
  let budget = n * 20, theme = null;
  const goal = waveGoal();
  if (isBossWave(n)) { boss = bossAt(n); label = ENEMY[boss].name.toUpperCase(); add(boss, 120, null, (n % 10 ? 0.5 : 1) * (n <= 10 ? BOSS_INTRO_HP : 1)); budget *= 0.5; if (goal && n === goal) { label = 'FINAL: ' + label; budget *= 1.6; } }     // Boss Rush: the in-between bosses have half health
  else if (n % 20 === 15 && n >= 35) { label = 'MOTHERSHIP'; boss = 'mothership'; add('mothership', 120); budget *= 0.5; }
  else if (n % 5 === 0) { label = 'BOSS'; add('boss', 100); budget *= 0.45; }
  else if (n === 16) { theme = WAVE_THEMES.find(x => x.id === 'alien'); label = theme.label; }      // first contact
  else if (n % 3 === 0 && n >= 6) { const opts = WAVE_THEMES.filter(x => n >= x.from); theme = pick(opts); label = theme.label; }
  const avail = ENEMIES.filter(e => e.wave <= n && !e.boss && e.id !== 'dismount');
  const pool = [];
  for (const e of avail) {
    let w = 1 + Math.min(3, (n - e.wave) * 0.15);
    if (theme) w = theme.pool[e.id] ? theme.pool[e.id] * 3 : w * 0.25;
    if (n < 12 && e.air) w *= 0.6;
    pool.push([e, w]);
  }
  const totalW = pool.reduce((s, p) => s + p[1], 0);
  let guard = 0;
  while (budget > 2 && guard++ < 500) {
    let r = Math.random() * totalW, e = pool[0][0];
    for (const [pe, w] of pool) { r -= w; if (r <= 0) { e = pe; break; } }
    if (e.reward > budget && budget >= 3) continue;
    // spawn in a little group: swarms come in clumps
    const groupN = e.id === 'swarm' ? (3 + Math.random() * 6) | 0 : e.reward <= 15 ? 1 + ((Math.random() * 3) | 0) : 1;
    for (let i = 0; i < groupN && budget > 0; i++) { add(e.id, e.id === 'swarm' ? rand(8, 14) : rand(16, 30), rollAffix()); budget -= e.reward; }
    t += rand(20, 60);
  }
  return { list: out, label, boss };
}
function startWave() {
  if (!G || G.over || G.waveActive) return;
  if (waveGoal() && G.wave > waveGoal()) return;
  initAudio();
  if (G.countdown > 0 && G.auto) {
    const bonus = Math.round((G.countdown / TPS) * (4 + G.wave * 0.6));
    if (bonus > 0) { G.money += bonus; floatText(G.base.x, G.base.y - 50, 'Early +' + money$(bonus), '#2ecc71', true); }
  }
  G.countdown = 0;
  const w = G.nextWave || buildWave(G.wave); G.nextWave = null;
  G.spawnQ = w.list.slice(); G.waveLabel = w.label; G.waveT = 0; G.waveActive = true;
  announce('WAVE ' + G.wave, w.label === 'ALIENS' ? 'ALIEN INVASION' : w.boss && w.boss !== 'mothership' ? (w.label.indexOf('FINAL') === 0 ? 'FINAL BOSS: ' : 'BOSS WAVE: ') + ENEMY[w.boss].name.toUpperCase() : w.label, w.boss || w.label === 'BOSS' || w.label === 'FINALE' ? '#ff6b6b' : w.label === 'ALIENS' ? '#b2ff59' : '#fff');
  if (w.label === 'ALIENS' && !G.hinted.aliens) { G.hinted.aliens = 1; setTimeout(() => G && toast('ALIENS! Their barriers block ALL damage until broken: burst them with big hits, Xeno Blasters, Ion Disruptors or EMP Blast.', '#b2ff59', 6500), 1200); }
  if (w.label === 'MOTHERSHIP') setTimeout(() => G && toast('A Mothership is coming: it flies, so only anti-air can touch it. Break its barrier, then burn it down.', '#ff8a80', 5000), 1200);
  sfx('wave');
  updateHUD(true);
}
function spawnTick() {
  G.waveT++;
  while (G.spawnQ.length && G.spawnQ[0].at <= G.waveT) {
    const s = G.spawnQ.shift();
    const e = makeEnemy(s.id, G.wave, { affix: s.affix, hpMul: s.hpMul });
    G.enemies.push(e);
    if (e.def.boss) bossArrives(e);
  }
}
function waveEnd() {
  G.waveActive = false;
  let income = 0, heal = 0;
  for (const g of G.towers) {
    if (g.def.kind === 'income') {
      let inc = 0;
      for (const u of g.units) {
        const st = u.stats, m = st.mods; let v = st.income * g.buff.eco;
        if (m.bonusWave && G.wave % m.bonusWave === 0) v *= m.bonusWave;
        if (m.interest) v += Math.min(120 + 40 * u.level, Math.max(0, G.money) * m.interest);
        inc += v;
        if (m.armory && G.wave % m.armory === 0) deployTank(true);
      }
      inc = Math.floor(inc); income += inc; floatText(g.x, g.y - 18, '+' + money$(inc), '#2ecc71', true);
    } else if (g.def.kind === 'heal') { const m = g.units[0].stats.mods; if (m.lifeline) heal += m.lifeline; }
    else if (g.def.aura === 'harvest') { const st = g.units[0].stats; if (st.mods.stockpile) { const v = st.mods.stockpile * st.power; income += v; floatText(g.x, g.y - 18, '+' + money$(v), '#aeea00', true); } }
  }
  const bonus = Math.round((50 + G.wave * 10) * (G.gm === 'troop' ? TM.wavePay : 1) * (G.mods.cash2 ? 2 : 1));
  G.money += income + bonus; G.stats.earned += income + bonus;
  if (heal > 0 && G.lives < G.maxLives) { const h = Math.min(12, heal); G.lives = Math.min(G.maxLives, G.lives + h); floatText(G.base.x, G.base.y - 44, '+' + h + ' base', '#55efc4', true); }
  if (income) sfx('income');
  if (G.wave === 1) unlock('first');
  if (G.wave >= 25) unlock('w25'); if (G.wave >= 50) { unlock('w50'); if (G.gm === 'tower') unlock('w50_tower'); if (G.gm === 'troop') unlock('w50_troop'); } if (G.wave >= 150) unlock('endless150');
  if (G.wave === 16) unlock('contact');
  if (isCustomGame()) { if (G.opts.mode !== 'sandbox') noteCustomBest(G.opts.custom, G.wave, false); if (G.wave === 10) unlock('fieldtest', true); }     // 3.0: custom maps keep their own best wave
  else if (G.opts.mode !== 'sandbox' && G.opts.mode !== 'daily') { const mb = getMapBest(), mk = G.opts.map + ''; if ((mb[mk] || 0) < G.wave) { mb[mk] = G.wave; store.set(KEYS.mapBest, mb); } }     // best wave CLEARED on this map
  if (waveGoal() && G.wave >= waveGoal()) { victory(); return; }
  G.wave++;
  G.nextWave = buildWave(G.wave);
  if (G.hero) heroRefresh(G.hero);
  if (G.wave === 10 && G.opts.mode !== 'sandbox') { announce('ALIEN TECH', 'Recovered from a crash site: the Alien tab is open', '#b2ff59'); toast('Alien tech unlocked! Open the Alien tab. The invaders themselves arrive at wave 16.', '#b2ff59', 6000); rebuildShop(true); }
  if (G.auto) G.countdown = 6 * TPS;
  if (G.wave === 3 && !G.hinted.merc && G.gm !== 'tower') { G.hinted.merc = 1; setTimeout(() => G && toast('Hire help: open the Mercs tab (key H), pick a squad, then click near the road', '#ffd54f'), 1800); }
  saveGame();
  updateHUD(true);
}

// =====================================================================
//  ABILITIES
// =====================================================================
function abilityReady(a) { return !G.mods.noabil && G.wave >= a.wave && G.abilities[a.id] <= 0; }
function useAbility(id, x, y) {
  const a = ABILITIES.find(b => b.id === id);
  if (!abilityReady(a)) return false;
  if (id === 'strike') {
    const ang = Math.random() * Math.PI;
    for (let i = 0; i < 7; i++) G.strikes.push({ x: x + Math.cos(ang) * (i - 3) * 38, y: y + Math.sin(ang) * (i - 3) * 38, t: 40 + i * 7, dmg: 300 * (1 + G.wave * 0.12), r: 55 });
    toast('Airstrike inbound!', '#ff8a80');
  } else if (id === 'emp') {
    for (const e of G.enemies) if (e.alive) {
      e.shield = 0; if (e.barrier > 0) breakBarrier(e);
      if (e.def.aegis) e.bossLock = 480;                  // Aegis Walker: shield offline for 8 s
      if (e.def.jammer) { e.bossT = 420; e.bossPh = 0; }  // Storm Jammer: the pulse charge starts over
      if (!e.def.boss && (e.air || e.def.shred || e.def.regen || e.def.blink || e.def.summon || e.def.shield || e.def.heal || e.def.stealth || e.def.alien || isMachine(e))) e.stunT = Math.max(e.stunT, 120);
      hurt(e, e.maxHp * (e.def.boss ? 0.02 : 0.06), { noVar: true, pierceArmor: true });
    }
    G.lines.push({ ring: true, x: W / 2, y: H / 2, r: 420, life: 24, ml: 24, color: '#9ad7ff' }); burst(W / 2, H / 2, '#74b9ff', 50, 7, 3, 36); shake(5);
    toast('EMP Blast! Shields down, machines stunned!', '#9ad7ff');
  } else if (id === 'reinforce') {
    const sq = [];
    for (let i = 0; i < 4; i++) {
      const off = formationOffset(i, 4);
      const ps = 1 + G.wave * (G.gm === 'troop' ? TM.merc : 0.08);
      const t = new Troop('soldier', x + off.x, y + off.y - 60, { hp: 200 * ps, dmg: 12 * ps, life: 25 * TPS, color: '#2980b9', speed: 1.8, squadList: sq });
      t.order = { x: x + off.x, y: y + off.y }; G.troops.push(t); sq.push(t);
    }
    burst(x, y, '#3498db', 20, 3);
  } else if (id === 'freeze') {
    for (const e of G.enemies) if (e.alive && !e.def.noSlow) e.stunT = Math.max(e.stunT, 90);
    G.freezeSlowT = 330; burst(W / 2, H / 2, '#a5d8ff', 60, 8, 3, 40);
    toast('Cryo burst! Everything is frozen!', '#a5d8ff');
  }
  G.abilities[id] = a.cd * TPS; G.armed = null; sfx('upgrade');
  return true;
}
function updateStrikes() {
  for (let i = G.strikes.length - 1; i >= 0; i--) {
    const s = G.strikes[i];
    if (s.nuke) continue;
    if (--s.t <= 0) {
      aoeHurt(s.x, s.y, s.r, s.dmg, s.o || { noVar: false }, !!s.air);
      burst(s.x, s.y, '#f39c12', 18, 4, 3, 26); burst(s.x, s.y, '#e74c3c', 10, 3); G.lines.push({ ring: true, x: s.x, y: s.y, r: s.r, life: 14, ml: 14, color: '#ffb347' });
      sfx('boom'); shake(4); G.strikes.splice(i, 1);
    }
  }
}
function segDist(px, py, s) {
  const dx = s[2] - s[0], dy = s[3] - s[1], l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - s[0]) * dx + (py - s[1]) * dy) / l2, 0, 1);
  return dist(px, py, s[0] + dx * t, s[1] + dy * t);
}
// the line a railgun slug travels (one segment, or two when it ricochets off the map edge)
function railSegments(x, y, a, ricochet) {
  const dx = Math.cos(a), dy = Math.sin(a), L = 2000;
  if (!ricochet) return [[x, y, x + dx * L, y + dy * L]];
  const tx = dx > 0 ? (W - x) / dx : dx < 0 ? (0 - x) / dx : 1e9, ty = dy > 0 ? (H - y) / dy : dy < 0 ? (0 - y) / dy : 1e9;
  const t = Math.min(tx, ty), hx = x + dx * t, hy = y + dy * t;
  const ndx = tx <= ty ? -dx : dx, ndy = tx <= ty ? dy : -dy;
  return [[x, y, hx, hy], [hx, hy, hx + ndx * 1500, hy + ndy * 1500]];
}
function fireSuper(g, x, y) {
  const u = g.units[0], st = u.stats, m = st.mods;
  if (u.stock <= 0) return false;
  u.stock--; if (u.cd <= 0) u.cd = st.rate;
  const o = { src: u, group: g, pierceArmor: true, noVar: true };
  if (g.def.kind === 'rail') {
    const a = Math.atan2(y - g.y, x - g.x); g.angle = a; g.recoil = 10;
    const segs = railSegments(g.x, g.y, a, !!m.ricochet);
    for (const e of G.enemies) {
      if (!e.alive || e.burrowed) continue;
      let hit = false; for (const sg of segs) if (segDist(e.x, e.y, sg) < e.r + 8) { hit = true; break; }
      if (!hit) continue;
      hurt(e, st.damage * g.buff.dmg, o);
      if (m.shock && e.alive) { e.stunT = Math.max(e.stunT, e.def.boss ? 60 : 180); e.brittleT = 360; e.brittle = Math.max(e.brittle, 0.4); }
    }
    for (const sg of segs) G.lines.push({ x1: sg[0], y1: sg[1], x2: sg[2], y2: sg[3], life: 30, ml: 30, color: '#74b9ff', w: 7 });
    sfx('rail'); shake(6);
  } else if (g.def.kind === 'nuke') {
    const fuse = m.fuse || 90;
    G.strikes.push({ x, y, t: fuse, dmg: st.damage * g.buff.dmg, r: st.aoe * g.buff.range, nuke: true, o, mirv: m.mirv || 0, mirvDmg: m.mirvDmg || 0.5, fallout: !!m.fallout });
    toast('NUKE INBOUND - ' + (fuse / 60).toFixed(1) + ' seconds', '#ff5252');
  } else if (g.def.kind === 'hole') {
    openHole(x, y, st.aoe * g.buff.range, m.holeT || 240, st.damage * g.buff.dmg, o, { holdBoss: !!m.holdBoss, wormhole: m.wormhole || 0, boom: 4 });
    toast('Singularity open!', '#b388ff'); sfx('nuke'); shake(6);
  }
  return true;
}
