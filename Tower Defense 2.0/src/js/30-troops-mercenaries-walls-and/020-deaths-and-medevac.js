// ---- deaths and medevac ----
function onTroopDeath(b) {
  if (b.hp > 0 || b.revived || b.expired) return;
  for (const c of G.troops) {
    if (c === b || c.hp <= 0 || !c.revive || c.reviveCd > 0) continue;
    if (dist(c.x, c.y, b.x, b.y) > c.reviveR) continue;
    b.hp = b.maxHp * 0.6; b.revived = true; c.reviveCd = 1500;
    burst(b.x, b.y, '#fff59d', 14, 3, 3, 28); G.lines.push({ ring: true, x: b.x, y: b.y, r: 20, life: 20, ml: 20, color: '#fff59d' }); floatText(b.x, b.y - 16, 'medevac', '#fff59d');
    return;
  }
}

// =====================================================================
//  MERCENARIES
// =====================================================================
const MERC_FIELDS = ['role', 'color', 'look', 'hp', 'dmg', 'rate', 'range', 'speed', 'r', 'armor', 'leash', 'lifesteal', 'frenzy', 'medAura', 'medRad', 'guard', 'aoe', 'burn', 'hitsAir', 'hunt', 'crit', 'critMult', 'pierceArmor', 'dodge', 'backstab', 'cleave', 'stun', 'stunTicks', 'detect', 'shotColor', 'shieldMul'];
function getHQ() {
  let best = null;
  for (const g of G.towers) if (g.def.kind === 'hq' && (!best || g.level > best.level)) best = g;
  if (!best) return { level: 0, group: null, spec: 0, mods: {}, costMul: 1, cdMul: 1, cap: 0, vet: false };
  const u = best.units[0], L = u.level, m = u.stats.mods;
  return { level: L, group: best, spec: u.spec, mods: m, costMul: (1 - 0.04 * L) * (m.mcost || 1), cdMul: (1 - 0.05 * L) * (m.mcd || 1), cap: Math.floor(L / 2) + (m.mcap || 0), vet: !!m.mvet };
}
const mercUnlocked = (m, hq) => G.wave >= m.wave || (m.hq > 0 && hq.level >= m.hq);
const mercCost = (m, hq) => Math.max(1, Math.round(mercCostAt(m, G.wave) * hq.costMul * (G.mods.cheap ? 0.75 : 1)));
const mercCdTicks = (m, hq) => Math.round(m.cd * TPS * hq.cdMul);
const mercSquadCap = (hq) => BASE_MERC_CAP + hq.cap;
function activeSquads() { G.squads = G.squads.filter(sq => sq.members.some(t => t.hp > 0)); return G.squads.length; }
function mercError(m) {
  const hq = getHQ();
  if (!mercUnlocked(m, hq)) return m.name + ' unlock at wave ' + m.wave + (m.hq ? ' (or HQ level ' + m.hq + ')' : '');
  if (G.mercCd[m.id] > 0) return m.name + ' are recharging (' + Math.ceil(G.mercCd[m.id] / TPS) + 's)';
  if (activeSquads() >= mercSquadCap(hq)) return 'Squad limit reached (' + mercSquadCap(hq) + ')';
  if (G.opts.mode !== 'sandbox' && G.money < mercCost(m, hq)) return "Can't afford " + m.name + ' ($' + mercCost(m, hq) + ')';
  return null;
}
function mercPlaceError(x, y) {
  if (x < 6 || y < 6 || x > W - 6 || y > H - 6) return 'Outside the map';
  if (distToPaths(G, x, y) > 90) return 'Too far from the road';
  return null;
}
function hireMerc(id, x, y) {
  const m = MERC[id], err = (G.gm === 'tower' ? 'Contractors are not available in Tower Mode' : null) || mercError(m) || mercPlaceError(x, y);
  if (err) { toast(err, '#ff8a80'); sfx('deny'); return false; }
  const hq = getHQ(), cost = mercCost(m, hq); spend(cost);
  G.mercCd[id] = mercCdTicks(m, hq);
  const sc = mercScale(G.wave), vet = hq.vet;
  let life = m.life * TPS * (vet ? 1.5 : 1);
  for (const a of G.towers) if (a.def.aura === 'cpost') { const am = a.units[0].stats.mods; if (am.mercLife && dist(a.x, a.y, x, y) <= a.units[0].stats.range) life *= am.mercLife; }
  const members = [];
  for (let i = 0; i < m.n; i++) {
    const off = formationOffset(i, m.n), fx = clamp(x + off.x, 8, W - 8), fy = clamp(y + off.y, 8, H - 8);
    const o = { name: m.name, merc: true, mercId: m.id, life: Math.round(life), squadList: members };
    for (const k of MERC_FIELDS) if (m[k] != null) o[k] = m[k];
    o.hp = Math.round(m.hp * sc * (vet ? 1.4 : 1)); o.dmg = m.dmg * sc * (vet ? 1.25 : 1);
    const t = new Troop(own(TROOP_TYPES, m.id) ? m.id : 'soldier', fx, fy - 70, o);
    t.order = { x: fx, y: fy }; members.push(t); G.troops.push(t);
  }
  G.squads.push({ id, members });
  burst(x, y, m.color, 20, 3.5, 3, 28); G.lines.push({ ring: true, x, y, r: 36, life: 20, ml: 20, color: m.color });
  floatText(x, y - 26, m.name, '#ffd54f', true); sfx('build');
  unlock('hire'); if (activeSquads() >= 5) unlock('bigspender');
  return true;
}

// =====================================================================
//  HEROES  (data in HEROES). A hero is a Troop with hero: true, so it is
//  selected, moved, healed and buffed like any troop. Its stats grow with
//  its level and with the wave (like contractors).
// =====================================================================
const heroWaveMul = () => 1 + G.wave * (isTroopMode() ? 0.45 : 0.12);
const heroXpNeed = (lv) => Math.round(40 * Math.pow(lv, 1.6));
const heroPow = (h) => (1 + 0.15 * (h.lvl - 1)) * heroWaveMul();
const heroCdMul = (h) => 1 - 0.03 * (h.lvl - 1);
function heroRefresh(h, heal) {
  const H = HERO[h.heroId], L = h.lvl - 1, wm = heroWaveMul();
  const frac = h.maxHp > 0 ? clamp(h.hp / h.maxHp, 0, 1) : 1;
  h.maxHp = Math.round(H.hp * (1 + 0.15 * L) * wm);
  h.hp = heal ? h.maxHp : h.hp <= 0 ? 0 : Math.max(1, h.maxHp * frac);
  h.dmg = H.dmg * (1 + 0.2 * L) * wm * (h.overT > 0 ? 2.5 : 1);
  h.rate = Math.max(4, Math.round(H.rate * (h.hullT > 0 ? 0.5 : 1)));
  h.guard = h.hullT > 0 ? 0.25 : 1; h.stun = h.hullT > 0 ? 1 : 0; h.stunTicks = 30;
}
function deployHero(id, x, y, silent) {
  const H = HERO[id]; if (!H || !G) return null;
  const t = new Troop('hero', x, y, { hero: true, heroId: id, name: H.name, look: H.look, color: H.color, role: H.role, r: H.r, speed: H.speed, rate: H.rate, range: H.range, leash: H.leash || 80,
    armor: H.armor || 0, cleave: H.cleave || 0, hitsAir: !!H.hitsAir, detect: !!H.detect, pierceArmor: !!H.pierceArmor, chain: H.chain || 0, aoe: H.aoe || 0, shieldMul: H.shieldMul || 1, shotColor: H.shotColor, hp: 1, dmg: 1 });
  t.ranged = RANGED_ROLES.has(t.role);
  t.lvl = 1; t.xp = 0; t.cdA = [0, 0]; t.dealt = 0; t.kills = 0; t.downT = 0; t.overT = 0; t.hullT = 0; t.petT = 0; t.pets = null; t.jump = null;
  heroRefresh(t, true);
  G.hero = t; G.heroId = id; G.placeHero = null; G.troops.push(t);
  if (!silent) {
    burst(x, y, '#ffd54f', 26, 3.5, 3, 30); G.lines.push({ ring: true, x, y, r: 34, life: 22, ml: 22, color: '#ffd54f' });
    floatText(x, y - 28, H.name + ' joins!', '#ffd54f', true); sfx('build');
    toast(H.name + ' deployed. Select the hero and right-click to move. Z / X fire abilities (the second unlocks at level ' + HERO_ABIL2_LV + ').', '#ffd54f', 5000);
  }
  return t;
}
// a hero saved while walking to a right-click order (or in the middle of a Jump Jets leap) is saved where it was going
function heroSaveData(h) {
  const p = h.jump ? { x: h.jump.tx, y: h.jump.ty } : h.order || h.home;
  return { id: G.heroId, lv: h.lvl, xp: Math.round(h.xp), x: Math.round(p.x), y: Math.round(p.y), cd: h.cdA.slice(), k: h.kills, d: Math.round(h.dealt) };
}
function heroPlaceError(x, y) {
  if (x < 10 || y < 10 || x > W - 10 || y > H - 10) return 'Outside the map';
  if (distToPaths(G, x, y) > 100) return 'Too far from the road';
  return null;
}
function heroKillXp(e, o) {
  const h = G.hero; if (!h || h.hp <= 0 || h.lvl >= HERO_MAX) return;
  const xp = Math.max(1, e.def.reward * (e.def.boss ? 2 : 1) * (e.gen ? 0.5 : 1));
  if (o && o.src === h) heroGainXp(h, xp);
  else if (dist(e.x, e.y, h.x, h.y) <= Math.max(h.range, h.leash || 0) + 40) heroGainXp(h, xp * 0.3);
}
function heroGainXp(h, xp) {
  if (h.lvl >= HERO_MAX) return;
  h.xp += xp;
  while (h.lvl < HERO_MAX && h.xp >= heroXpNeed(h.lvl)) {
    h.xp -= heroXpNeed(h.lvl); h.lvl++;
    heroRefresh(h); h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.3);
    burst(h.x, h.y, '#ffd54f', 22, 3, 3, 28); G.lines.push({ ring: true, x: h.x, y: h.y, r: 30, life: 20, ml: 20, color: '#ffd54f' });
    floatText(h.x, h.y - 26, 'LEVEL ' + h.lvl + '!', '#ffd54f', true); sfx('upgrade');
    if (h.lvl === HERO_ABIL2_LV) toast(h.name + ' reached level ' + HERO_ABIL2_LV + ': ' + HERO[h.heroId].abil[1].name + ' unlocked (X)!', '#ffd54f', 4000);
    if (h.lvl === HERO_MAX) unlock('hero10');
  }
  if (h.lvl >= HERO_MAX) h.xp = 0;
}
function heroRevive(h) {
  h.downT = 0; h.revived = false; h.lift = 0; heroRefresh(h, true);
  h.x = h.home.x; h.y = h.home.y; h.order = null; h.target = null; h.jump = null;
  if (!G.troops.includes(h)) G.troops.push(h);
  burst(h.x, h.y, '#ffd54f', 20, 3, 3, 26); G.lines.push({ ring: true, x: h.x, y: h.y, r: 30, life: 20, ml: 20, color: '#ffd54f' });
  toast(h.name + ' is back in the fight!', '#ffd54f');
}
// shared target finder for hero bolts and drones
function heroNearest(x, y, range) {
  let best = null, bd = range;
  for (const e of G.enemies) { if (!e.alive || e.burrowed || e.charmT > 0 || (e.def.stealth && e.revealedT <= 0)) continue; const d = dist(e.x, e.y, x, y); if (d < bd) { bd = d; best = e; } }
  return best;
}
function enemyNear(x, y, r) {
  let best = null, bd = 1e9;
  for (const e of G.enemies) { if (!e.alive || e.burrowed || e.charmT > 0) continue; const d = dist(e.x, e.y, x, y); if (d <= r + e.r && d < bd) { bd = d; best = e; } }
  return best;
}
function heroTick(h) {
  if (h.cdA[0] > 0) h.cdA[0]--; if (h.cdA[1] > 0) h.cdA[1]--;
  if (G.heroAura > 0) G.heroAura--;
  if (h.hp <= 0) {
    if (!h.downT) { h.downT = HERO_RESPAWN * TPS; h.overT = h.hullT = h.petT = 0; h.jump = null; h.lift = 0; h.pets = null; G.heroAura = 0; heroRefresh(h); toast(h.name + ' is down! Back in ' + HERO_RESPAWN + ' seconds.', '#ff8a80'); }
    if (--h.downT <= 0) heroRevive(h);
    return;
  }
  h.downT = 0;
  if (h.overT > 0 && --h.overT === 0) heroRefresh(h);
  if (h.hullT > 0 && --h.hullT === 0) heroRefresh(h);
  if (h.jump) heroJumpStep(h);
  if (h.overT > 0 && (G.tick + h.id) % 20 === 0) heroBolt(h, h.x, h.y, 160, h.dmg * 0.25, '#18ffff');
  if (h.petT > 0) {
    h.petT--;
    for (const p of h.pets) {
      p.a += 0.045; p.x = h.x + Math.cos(p.a) * 26; p.y = h.y + Math.sin(p.a) * 26 - 6;
      if (--p.cd <= 0) { p.cd = 20; heroBolt(h, p.x, p.y, 160, h.dmg * 0.5, '#80d8ff'); }
    }
    if (h.petT <= 0) { for (const p of h.pets) burst(p.x, p.y, '#b0bec5', 5, 1.5, 2, 14); h.pets = null; }
  }
}
function heroBolt(h, x, y, range, dmg, color) {
  const e = heroNearest(x, y, range); if (!e) return;
  hurt(e, dmg, troopOpts(h)); troopLine(x, y, e.x, e.y, color); burst(e.x, e.y, color, 2, 1.2, 2, 12);
}
function heroJumpStep(h) {
  const j = h.jump; j.t++;
  const f = j.t / j.T; h.x = j.sx + (j.tx - j.sx) * f; h.y = j.sy + (j.ty - j.sy) * f; h.lift = Math.sin(f * Math.PI) * 34;
  if (Math.random() < 0.6) burst(h.x, h.y + 4, '#80d8ff', 1, 0.6, 2.5, 14);
  if (j.t < j.T) return;
  h.jump = null; h.lift = 0; h.home = { x: h.x, y: h.y }; h.order = null; h.target = null;
  aoeHurt(h.x, h.y, 90, 250 * heroPow(h), Object.assign(troopOpts(h), { stunHit: 72, noVar: true }), false);
  burst(h.x, h.y, '#80d8ff', 26, 4, 3, 26); burst(h.x, h.y, '#ffffff', 10, 2.5, 2, 18);
  G.lines.push({ ring: true, x: h.x, y: h.y, r: 90, life: 20, ml: 20, color: '#80d8ff' }); sfx('boom'); shake(5);
}
function heroAbilityError(i) {
  const h = G && G.hero; if (!h) return 'Deploy a hero first (hero bar)';
  const A = HERO[h.heroId].abil[i];
  if (h.hp <= 0) return h.name + ' is down (back in ' + Math.ceil(h.downT / TPS) + 's)';
  if (i === 1 && h.lvl < HERO_ABIL2_LV) return A.name + ' unlocks at hero level ' + HERO_ABIL2_LV;
  if (h.cdA[i] > 0) return A.name + ' is recharging (' + Math.ceil(h.cdA[i] / TPS) + 's)';
  return null;
}
function useHeroAbility(i, x, y) {
  const h = G.hero; if (heroAbilityError(i)) { sfx('deny'); return false; }
  const H = HERO[h.heroId], A = H.abil[i], pow = heroPow(h), o = troopOpts(h);
  let ok = true;
  const fail = (msg) => { toast(msg, '#ff8a80'); ok = false; };
  switch (A.id) {
    case 'overtop':
      G.heroAura = 600; G.lines.push({ ring: true, x: h.x, y: h.y, r: 220, life: 26, ml: 26, color: '#ffd54f' }); burst(h.x, h.y, '#ffd54f', 16, 3, 2.5, 22);
      floatText(h.x, h.y - 26, 'OVER THE TOP!', '#ffd54f', true); computeAuras(); break;
    case 'barrage': {
      const np = nearestPathPoint(G, x, y); if (!np || np.d > 60) { fail('Click on the road'); break; }
      const p = G.paths[np.path];
      for (let k = 0; k < 10; k++) { pathPos(p, Math.max(0, np.along - k * 45), _p); G.strikes.push({ x: _p.x + rand(-6, 6), y: _p.y + rand(-6, 6), t: 24 + k * 10, dmg: 140 * pow, r: 55, o }); }
      toast('Creeping barrage!', '#ffcc80'); break;
    }
    case 'sabot': {
      const a = Math.atan2(y - h.y, x - h.x), seg = [h.x, h.y, h.x + Math.cos(a) * 500, h.y + Math.sin(a) * 500];
      const oo = Object.assign({}, o, { pierceArmor: true, heavyBonus: 2, noVar: true }); let n = 0;
      for (const e of G.enemies) if (e.alive && !e.burrowed && e.charmT <= 0 && segDist(e.x, e.y, seg) < e.r + 8) { hurt(e, 600 * pow, oo); burst(e.x, e.y, '#ffcc80', 6, 2.4, 2.4, 18); n++; }
      h.angle = a; G.lines.push({ x1: seg[0], y1: seg[1], x2: seg[2], y2: seg[3], life: 22, ml: 22, color: '#ffcc80', w: 5 }); sfx('rail'); shake(4);
      if (n > 2) floatText(h.x, h.y - 26, n + ' hits!', '#ffcc80', true); break;
    }
    case 'hulldown': h.hullT = 480; heroRefresh(h); G.lines.push({ ring: true, x: h.x, y: h.y, r: 28, life: 20, ml: 20, color: '#90a4ae' }); floatText(h.x, h.y - 26, 'HULL DOWN', '#cfd8dc', true); break;
    case 'mark': {
      const e = enemyNear(x, y, 40); if (!e) { fail('Click on an enemy'); break; }
      e.markT = 600; e.mark = Math.max(e.mark, e.def.boss ? 0.4 : 0.75); e.revealedT = Math.max(e.revealedT, 600); e.bountyT = 600;
      G.lines.push({ x1: h.x, y1: h.y, x2: e.x, y2: e.y, life: 14, ml: 14, color: '#ff5252', w: 1.5 }); floatText(e.x, e.y - e.r - 12, 'MARKED', '#ff5252', true); break;
    }
    case 'sleep': {
      const n = 6 + Math.floor((h.lvl - 1) / 2), list = [];
      for (const e of G.enemies) if (e.alive && !e.burrowed && e.charmT <= 0 && dist(e.x, e.y, h.x, h.y) <= 280) list.push(e);
      if (!list.length) { fail('No enemies within 280 of ' + h.name); break; }
      list.sort((a, b) => dist(a.x, a.y, h.x, h.y) - dist(b.x, b.y, h.x, h.y));
      for (const e of list.slice(0, n)) { hurt(e, 60 * pow, o); if (e.alive && !e.def.noSlow) e.stunT = Math.max(e.stunT, e.def.boss ? 60 : 180); troopLine(h.x, h.y, e.x, e.y, '#b2dfdb'); floatText(e.x, e.y - e.r - 8, 'zzz', '#b2dfdb'); }
      break;
    }
    case 'hellfire': G.strikes.push({ x, y, t: 48, dmg: 500 * pow, r: 80, o, air: true }); toast('Hellfire inbound!', '#ffd180'); break;
    case 'drones': h.petT = 900; h.pets = [0, 1, 2, 3].map(k => ({ a: k * 1.571, x: h.x, y: h.y, cd: 5 + k * 5 })); burst(h.x, h.y, '#b0bec5', 12, 2, 2, 18); break;
    case 'jump': {
      if (x < 10 || y < 10 || x > W - 10 || y > H - 10) { fail('Outside the map'); break; }
      if (dist(x, y, h.x, h.y) > 360) { fail('Too far: Jump Jets reach 360'); break; }
      h.jump = { sx: h.x, sy: h.y, tx: x, ty: y, t: 0, T: 26 }; h.order = null; h.target = null; burst(h.x, h.y, '#80d8ff', 12, 2.5, 2.5, 18); break;
    }
    case 'overcharge': h.overT = 480; heroRefresh(h); G.lines.push({ ring: true, x: h.x, y: h.y, r: 30, life: 20, ml: 20, color: '#18ffff' }); floatText(h.x, h.y - 26, 'OVERCHARGE', '#18ffff', true); break;
    case 'seize': {
      const e = enemyNear(x, y, 40); if (!e) { fail('Click on an enemy'); break; }
      if (e.def.boss) { fail('Bosses resist Mind Seize'); break; }
      charmEnemy(e, 480 + 30 * (h.lvl - 1), o); G.lines.push({ x1: h.x, y1: h.y, x2: e.x, y2: e.y, life: 16, ml: 16, color: '#e040fb', zig: true, w: 2 }); break;
    }
    case 'collapse': openHole(x, y, 80, 180, 200 * pow, o, { boom: 3 }); G.lines.push({ ring: true, x, y, r: 80, life: 16, ml: 16, color: '#b388ff' }); break;
  }
  if (!ok) { sfx('deny'); return false; }
  h.cdA[i] = Math.round(A.cd * TPS * heroCdMul(h)); G.armed = null; sfx('upgrade');
  return true;
}

// =====================================================================
//  WALLS, TRAPS, MINES
// =====================================================================
// recompute what a wall / trap gets from its level and specialty
function syncStructure(g) {
  if (!isStructure(g.def)) return;
  const u = g.units[0], st = u.stats, m = st.mods, lv = u.level - 1;
  const missing = Math.max(0, g.maxHp - g.hp);
  g.maxHp = st.hp; g.hp = Math.max(1, g.maxHp - missing);
  g.guard = st.guard; g.regen = m.regen || 0;
  g.thorns = (m.thorns || 0) * (1 + 0.25 * lv); g.boom = (m.boom || 0) * (1 + 0.3 * lv); g.boomR = m.boomR || 0;
  g.shock = (m.shock || 0) * (1 + 0.25 * lv); g.garrison = m.garrison || 0;
}
function structureTick(g) {
  if (g.life > 0 && --g.life <= 0) { g.used = true; return; }      // temporary barricades expire
  if (g.hitT > 0) g.hitT--;
  else if (g.regen && g.hp < g.maxHp) g.hp = Math.min(g.maxHp, g.hp + g.maxHp * g.regen / 60);    // walls only rebuild while nobody is chewing on them
  if (g.shock && (G.tick + g.id) % 30 === 0) {
    for (const e of G.enemies) if (e.alive && !e.air && !e.burrowed && dist(e.x, e.y, g.x, g.y) < 45 + e.r) {
      hurt(e, g.shock * (1 + 0.1 * G.wave), { noVar: true, pierceArmor: true, src: g.units[0], group: g });
      if (G.lines.length < 160) G.lines.push({ x1: g.x, y1: g.y, x2: e.x, y2: e.y, life: 6, ml: 6, color: '#fff59d', zig: true, w: 2 });
    }
  }
  if (g.garrison) updateGarrison(g);
}
function updateGarrison(g) {
  if (!g.squad) g.squad = [];
  if (g.squad.some(t => t.hp <= 0)) g.squad = g.squad.filter(t => t.hp > 0);
  if (g.squad.length >= g.garrison) { g.respawnT = 0; g.everSpawned = true; return; }
  g.respawnT = (g.respawnT || 0) + 1;
  if (g.respawnT < (!g.everSpawned ? 25 : 900)) return;
  g.respawnT = 0;
  const L = g.units[0].level - 1, off = formationOffset(g.squad.length, g.garrison);
  const t = new Troop('soldier', g.x, g.y, { hp: Math.round(180 * (1 + 0.35 * L) * (1 + G.wave * 0.03)), dmg: 10 * (1 + 0.3 * L) * (1 + G.wave * 0.05), owner: g, color: '#7d8c6b', leash: 60, armor: 2, look: 'assault' });
  t.home = { x: g.x + off.x, y: g.y + off.y }; g.squad.push(t); G.troops.push(t);
}
// traps are evaluated every 6 ticks (called from computeAuras)
function trapTick(g) {
  if (g.hp <= 0 || g.used) return;
  const st = g.units[0].stats, m = st.mods, def = g.def, R = st.range;
  if (def.trap === 'stasis') { stasisTick(g, st, m, R); return; }
  if (g.snareT > 0) g.snareT -= 6;
  let touched = false;
  for (const e of G.enemies) {
    if (!e.alive || e.air || e.burrowed) continue;
    if (dist(e.x, e.y, g.x, g.y) > R + e.r * 0.5) continue;
    touched = true;
    if (def.trap === 'spikes') spikeHit(g, e, st, m); else slickHit(g, e, st, m);
  }
  if (touched) { g.hp -= def.trap === 'spikes' ? 1 : 0.5; if (g.hp <= 0) { g.used = true; burst(g.x, g.y, def.color, 14, 2.5); floatText(g.x, g.y - 12, 'worn out', '#bbb'); } }
}
// Stasis Field: a periodic pulse that freezes every ground enemy on it
function stasisTick(g, st, m, R) {
  const every = m.stasisEvery || 240;
  g.stT = (g.stT || 0) + 6;
  if (g.stT < every) return;
  const L = g.units[0].level - 1, ticks = Math.round(60 * (1 + 0.15 * L) * (m.stasisMul || 1));
  let n = 0;
  for (const e of G.enemies) {
    if (!e.alive || e.air || e.burrowed || e.charmT > 0 || dist(e.x, e.y, g.x, g.y) > R + e.r * 0.5) continue;
    if (e.def.boss || e.def.noSlow) { if (!e.def.noSlow) { e.slowT = Math.max(e.slowT, ticks * 2); e.slowP = Math.max(e.slowP, 0.6); } }
    else e.stunT = Math.max(e.stunT, ticks);
    if (m.rift) { e.brittleT = Math.max(e.brittleT, 180); e.brittle = Math.max(e.brittle, m.rift); }
    n++;
  }
  if (!n) { g.stT = every; return; }          // stays charged until something steps on it
  g.stT = 0; g.hp -= 20 + 4 * n;
  G.lines.push({ ring: true, x: g.x, y: g.y, r: R + 6, life: 18, ml: 18, color: '#84ffff' }); burst(g.x, g.y, '#e0ffff', 10, 2, 2, 20);
  if (g.hp <= 0) { g.used = true; burst(g.x, g.y, g.def.color, 14, 2.5); floatText(g.x, g.y - 12, 'burned out', '#bbb'); }
}
function spikeHit(g, e, st, m) {
  const d = st.damage, src = g.units[0];
  if (!e.def.noSlow) e.slowAura = Math.max(e.slowAura, m.slowTrap || g.def.slow);
  if (m.snare && !(g.snareT > 0) && !e.def.noSlow) {
    g.snareT = m.snareCd; e.stunT = Math.max(e.stunT, e.def.boss ? 60 : m.snare);
    hurt(e, d * m.snareDmg * (1 + G.wave * 0.1), { noVar: true, src, group: g }); floatText(e.x, e.y - e.r - 10, 'snared!', '#ffd54f'); burst(e.x, e.y, '#bdc3c7', 8, 2, 2, 18);
  }
  if (m.venom) { e.poison = { dps: d / 6 * 1.8, t: 180, src, group: g, plague: true }; return; }
  hurt(e, d, { noVar: true, src, group: g });
  if (m.bleed && e.alive) e.poison = { dps: d / 6 * 0.6, t: 60 * m.bleed, src, group: g };
}
function slickHit(g, e, st, m) {
  const src = g.units[0], lv = g.units[0].level - 1;
  if (!e.def.noSlow) e.slowAura = Math.max(e.slowAura, m.slowTrap || g.def.slow);
  if (m.burnTar) e.burn = { dps: m.burnTar * (1 + 0.3 * lv) / 60, t: 20, src, group: g };
  if (m.mire && !(e.mireT > 0) && !e.def.noSlow && !e.def.boss) { e.stunT = Math.max(e.stunT, m.mire); e.mireT = 300; floatText(e.x, e.y - e.r - 8, 'stuck', '#bbb'); }
  if (m.acid) e.armor = Math.max(0, e.armor - m.acid * 0.1);
  if (m.brittleTrap) { e.brittleT = Math.max(e.brittleT, 14); e.brittle = Math.max(e.brittle, m.brittleTrap); }
}
function updateMines() {
  for (const g of G.towers) {
    if (g.def.kind !== 'mine' || g.used || g.redeploy > 0 || g.disabledT > 0) continue;
    if (g.rearm > 0) { g.rearm--; continue; }
    for (const e of G.enemies) if (e.alive && !e.air && !e.burrowed && dist(e.x, e.y, g.x, g.y) < e.r + 10) { detonateMine(g); break; }
  }
}
function detonateMine(g) {
  const st = g.units[0].stats, m = st.mods, mul = g.mineMul || 1;
  const dmg = st.damage * (1 + G.wave * 0.15) * mul, o = { src: g.units[0], group: g, noVar: false };
  if (g.def.warp) {             // Warp Mine: hurt and teleport everything in the blast back toward the spawn
    const back = m.warp || g.def.warp;
    for (const e of G.enemies) {
      if (!e.alive || e.air || e.burrowed || e.charmT > 0 || dist(e.x, e.y, g.x, g.y) > st.aoe + e.r) continue;
      const fx = e.x, fy = e.y;
      hurt(e, dmg, o); if (!e.alive) continue;
      if (m.freezeMine && !e.def.boss) e.stunT = Math.max(e.stunT, m.freezeMine);
      if (pushBack(e, back)) { burst(fx, fy, '#b388ff', 6, 2, 2, 16); burst(e.x, e.y, '#ea80fc', 8, 2.2, 2.2, 18); }
    }
    burst(g.x, g.y, '#b388ff', 22, 4, 3); G.lines.push({ ring: true, x: g.x, y: g.y, r: st.aoe, life: 16, ml: 16, color: '#b388ff' }); sfx('zap'); shake(3);
    if (m.rearm) g.rearm = m.rearm; else g.used = true;
    return;
  }
  if (m.freezeMine) { o.stunAll = m.freezeMine; o.slow = m.slowMine; o.slowTicks = 240; }
  aoeHurt(g.x, g.y, st.aoe, dmg, o, false);
  if (m.cluster) for (let i = 0; i < m.cluster; i++) { const a = (i / m.cluster) * 6.283 + rand(-0.3, 0.3), d = st.aoe * rand(0.8, 1.3), cx = g.x + Math.cos(a) * d, cy = g.y + Math.sin(a) * d; aoeHurt(cx, cy, st.aoe * 0.6, dmg * 0.4, Object.assign({}, o, { stunAll: 0 }), false); burst(cx, cy, '#f39c12', 6, 2, 2, 16); }
  burst(g.x, g.y, m.freezeMine ? '#a5d8ff' : '#f39c12', 22, 4, 3);
  G.lines.push({ ring: true, x: g.x, y: g.y, r: st.aoe, life: 14, ml: 14, color: m.freezeMine ? '#a5d8ff' : '#ffb347' });
  sfx('boom'); shake(4);
  if (m.rearm) g.rearm = m.rearm; else g.used = true;
}
// Factory: Assembly Line pays out during the wave
function midWavePay() {
  for (const g of G.towers) if (g.def.kind === 'income') for (const u of g.units) {
    const st = u.stats; if (!st.mods.mid) continue;
    const v = Math.floor(st.income * g.buff.eco * st.mods.mid); G.money += v; G.stats.earned += v; floatText(g.x, g.y - 18, '+' + money$(v), '#2ecc71');
  }
}
