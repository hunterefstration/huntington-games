// ---- black holes (Singularity Engine, Gravity Collapse): hold everything inside, then collapse ----
function openHole(x, y, r, t, dps, o, opt) {
  if (G.holes.length >= 4) G.holes.shift();
  G.holes.push(Object.assign({ x, y, r, t, T: t, dps, o: Object.assign({}, o, { noVar: true }), holdBoss: false, wormhole: 0, boom: 3 }, opt || {}));
}
function updateHoles() {
  const dmgTick = G.tick % 6 === 0;
  for (let i = G.holes.length - 1; i >= 0; i--) {
    const h = G.holes[i]; h.t--;
    for (const e of G.enemies) {
      if (!e.alive || e.burrowed || e.charmT > 0 || dist(e.x, e.y, h.x, h.y) > h.r + e.r * 0.5) continue;
      if (!e.def.boss || h.holdBoss) e.stunT = Math.max(e.stunT, 2);
      else { e.slowT = Math.max(e.slowT, 10); e.slowP = Math.max(e.slowP, 0.7); }
      if (dmgTick) hurt(e, h.dps / 10, h.o);
    }
    if (Math.random() < 0.5) { const a = Math.random() * 6.283; burst(h.x + Math.cos(a) * h.r, h.y + Math.sin(a) * h.r, Math.random() < 0.5 ? '#b388ff' : '#651fff', 1, 0.4, 2.2, 16); }
    if (h.t > 0) continue;
    G.holes.splice(i, 1);
    aoeHurt(h.x, h.y, h.r * 1.15, h.dps * h.boom, h.o, true);
    if (h.wormhole) for (const e of G.enemies) if (e.alive && dist(e.x, e.y, h.x, h.y) <= h.r * 1.15 + e.r) pushBack(e, h.wormhole);
    burst(h.x, h.y, '#b388ff', 40, 6, 3.5, 34); burst(h.x, h.y, '#ffffff', 16, 4, 2.5, 24);
    G.lines.push({ ring: true, x: h.x, y: h.y, r: h.r * 1.15, life: 26, ml: 26, color: '#b388ff' }); sfx('boom'); shake(6);
  }
}
function updateNukes() {
  for (let i = G.strikes.length - 1; i >= 0; i--) {
    const s = G.strikes[i];
    if (!s.nuke || --s.t > 0) continue;
    G.strikes.splice(i, 1);
    aoeHurt(s.x, s.y, s.r, s.dmg, s.o, true);
    if (s.small) { burst(s.x, s.y, '#ff8a65', 26, 5, 4, 34); G.lines.push({ ring: true, x: s.x, y: s.y, r: s.r, life: 20, ml: 20, color: '#ffab91' }); sfx('boom'); shake(4); continue; }
    burst(s.x, s.y, '#ff5252', 80, 9, 5, 50); burst(s.x, s.y, '#ffd54f', 60, 6, 4, 40);
    G.lines.push({ ring: true, x: s.x, y: s.y, r: s.r, life: 40, ml: 40, color: '#ffcc80' }); sfx('nuke'); shake(14);
    for (let k = 0; k < s.mirv; k++) {
      const a = rand(0, 6.283), d = rand(0.35, 1.75) * s.r * 1.3;
      G.strikes.push({ x: clamp(s.x + Math.cos(a) * d, 10, W - 10), y: clamp(s.y + Math.sin(a) * d, 10, H - 10), t: 14 + k * 9, dmg: s.dmg * s.mirvDmg, r: s.r * 0.6, nuke: true, small: true, o: s.o });
    }
    if (s.fallout) G.patches.push({ x: s.x, y: s.y, r: s.r * 0.9, t: 900, dps: s.dmg * 0.35 / 900, o: s.o, slow: 0.45, rad: true });
  }
}

// =====================================================================
//  MAIN TICK
// =====================================================================
function tick() {
  G.tick++;
  if (G.waveActive) spawnTick();
  if (G.countdown > 0 && !G.waveActive) { if (--G.countdown <= 0) startWave(); }
  for (const a of ABILITIES) if (G.abilities[a.id] > 0) G.abilities[a.id] = Math.max(0, G.abilities[a.id] - (G.mods.fastcd ? 2 : 1));
  for (const k in G.mercCd) if (G.mercCd[k] > 0) G.mercCd[k]--;
  if (G.freezeSlowT > 0) G.freezeSlowT--;
  // cache the wall list (enemies check it every tick)
  G.walls.length = 0; for (const g of G.towers) if (g.def.kind === 'fence') G.walls.push(g);
  // auras (recomputed every few ticks - cheap and plenty responsive)
  if (G.tick % 6 === 0) computeAuras();
  for (const e of G.enemies) if (e.alive) updateEnemy(e);
  for (const g of G.towers) updateTower(g);
  for (const t of G.troops) if (t.hp > 0) updateTroop(t);
  if (G.hero) heroTick(G.hero);
  if (G.holes.length) updateHoles();
  if (G.waveActive && G.waveT > 0 && G.waveT % 1200 === 0) midWavePay();
  updateMines();
  if (G.towers.some(g => g.used)) for (const g of G.towers.filter(g => g.used)) removeTower(g);
  for (let i = G.projectiles.length - 1; i >= 0; i--) if (!updateProjectile(G.projectiles[i])) G.projectiles.splice(i, 1);
  for (let i = G.patches.length - 1; i >= 0; i--) {
    const p = G.patches[i];
    if (G.tick % 6 === 0) for (const e of G.enemies) if (e.alive && !e.air && dist(e.x, e.y, p.x, p.y) < p.r) {
      hurt(e, p.dps * 6, Object.assign({}, p.o, { noVar: true }));
      if (p.slow && !e.def.noSlow) e.slowAura = Math.max(e.slowAura, p.slow);
    }
    if (Math.random() < 0.3) burst(p.x + rand(-p.r, p.r) * 0.7, p.y + rand(-p.r, p.r) * 0.7, p.rad ? (Math.random() < 0.5 ? '#76ff03' : '#ccff90') : (Math.random() < 0.5 ? '#ff7043' : '#ffca28'), 1, 0.6, 2.5, 20);
    if (--p.t <= 0) G.patches.splice(i, 1);
  }
  updateNukes();
  updateStrikes();
  // tidy up
  if (G.tick % 30 === 0 || G.enemies.length > 400) G.enemies = G.enemies.filter(e => e.alive);
  if (G.tick % 30 === 0) G.troops = G.troops.filter(t => { if (t.hp <= 0) { G.sel.troops.delete(t); burst(t.x, t.y, t.color, 6, 2); } return t.hp > 0; });
  if (G.waveActive && !G.spawnQ.length && !G.enemies.some(e => e.alive)) waveEnd();
  if (G.money >= 25000 && G.opts.mode !== 'sandbox') unlock('rich');
}
function computeAuras() {
  const T = G.towers;
  for (const g of T) { const b = g.buff; b.range = 1; b.dmg = 1; b.eco = 1; b.rate = 1; b.detect = false; b.resp = 1; g.bgm = 1; g.pylon = false; }
  for (const e of G.enemies) { e.slowAura = 0; e.harvest = 0; }
  for (const t of G.troops) { t.bd = 1; t.bs = 1; t.bg = 1; t.bregen = 0; }
  // Captain Ashford's Over the Top!: towers around him fire faster, troops hit harder
  const h = G.hero;
  if (h && h.hp > 0 && G.heroAura > 0) {
    for (const g of T) if (dist(g.x, g.y, h.x, h.y) <= 220 && isShooter(g.def)) g.buff.rate = Math.max(g.buff.rate, 1.4);
    for (const t of G.troops) if (t.hp > 0 && dist(t.x, t.y, h.x, h.y) <= 220) { t.bd = Math.max(t.bd, 1.4); t.bg = Math.min(t.bg, 0.75); }
  }
  for (const c of G.troops) if (c.hp > 0 && c.guardAura) for (const o of G.troops) if (o.hp > 0 && dist(o.x, o.y, c.x, c.y) <= c.guardR) o.bg = Math.min(o.bg, c.guardAura);   // Battlefield Triage medics
  for (const a of T) {
    if (a.redeploy > 0 || a.disabledT > 0) continue;
    const k = a.def.kind;
    if (k === 'trap') { trapTick(a); continue; }
    if (k === 'heal') { healAura(a); continue; }
    if (k !== 'aura') continue;
    const u = a.units[0], st = u.stats, m = st.mods, R = st.range, L = st.power, au = a.def.aura;
    if (au === 'command') {
      const rb = 0.1 * L * (m.cmdRange || 1), db = 0.05 * L * (m.cmdDmg || 1), rt = (m.cmdRate || 0) * L;
      for (const g of T) if (g !== a && g.def.kind !== 'aura' && g.def.kind !== 'income' && dist(g.x, g.y, a.x, a.y) <= R) {
        const b = g.buff; b.range = Math.max(b.range, 1 + rb); b.dmg = Math.max(b.dmg, 1 + db); b.rate = Math.max(b.rate, 1 + rt); if (m.cmdDetect) b.detect = true;
      }
    } else if (au === 'eco') {
      for (const g of T) {
        if (dist(g.x, g.y, a.x, a.y) > R) continue;
        if (g.def.kind === 'income') g.buff.eco = Math.max(g.buff.eco, 1 + 0.2 * L);
        else if (m.grid && isShooter(g.def)) g.buff.rate = Math.max(g.buff.rate, 1 + m.grid * L);
      }
      if (m.field) for (const e of G.enemies) if (e.alive && !e.burrowed && dist(e.x, e.y, a.x, a.y) <= R) {
        hurt(e, m.field * L * 0.1, { noVar: true, pierceArmor: true, src: u, group: a }); e.slowAura = Math.max(e.slowAura, 0.15);
        if (Math.random() < 0.04) G.lines.push({ x1: a.x, y1: a.y, x2: e.x, y2: e.y, life: 5, ml: 5, color: '#fff59d', zig: true, w: 1 });
      }
    } else if (au === 'cryo') {
      const p = Math.min(0.9, (L >= 5 ? 0.55 : 0.4) + (m.slowAdd || 0));
      let pulse = false;
      if (m.zero) { a.zeroT = (a.zeroT || 0) + 6; if (a.zeroT >= 360) { a.zeroT = 0; pulse = true; G.lines.push({ ring: true, x: a.x, y: a.y, r: R, life: 18, ml: 18, color: '#dff9fb' }); } }
      for (const e of G.enemies) if (e.alive && dist(e.x, e.y, a.x, a.y) <= R) {
        e.slowAura = Math.max(e.slowAura, p);
        if (m.linger) { e.slowT = Math.max(e.slowT, m.linger); e.slowP = Math.max(e.slowP, p); }
        if (m.brittleField) { e.brittleT = Math.max(e.brittleT, 14); e.brittle = Math.max(e.brittle, m.brittleField); }
        if (pulse && !e.def.noSlow && !e.def.boss) e.stunT = Math.max(e.stunT, 60);
      }
    } else if (au === 'radar') {
      const mark = Math.max(m.mark || 0, L >= 5 ? 0.2 : L >= 3 ? 0.1 : 0);
      for (const e of G.enemies) if (e.alive && dist(e.x, e.y, a.x, a.y) <= R) {
        e.revealedT = 8; e.radarMark = Math.max(e.radarMark, mark);
        if (m.jam) { e.jam = 14; e.slowAura = Math.max(e.slowAura, m.jamSlow); }
        if (m.airSlow && e.air) { e.slowAura = Math.max(e.slowAura, m.airSlow); e.radarMark = Math.max(e.radarMark, m.airMark || 0); }
      }
    } else if (au === 'cpost') {
      const dm = 1 + 0.06 * L * (m.postDmg || 1), sp = 1 + (m.postSpeed || 0), gd = m.guard || 1, rg = 0.004 * L + (m.regen || 0);
      for (const t of G.troops) if (t.hp > 0 && dist(t.x, t.y, a.x, a.y) <= R) { t.bd = Math.max(t.bd, dm); t.bs = Math.max(t.bs, sp); t.bg = Math.min(t.bg, gd); t.bregen = Math.max(t.bregen, rg); }
      if (m.resp) for (const g of T) if (g.def.kind === 'barracks' && dist(g.x, g.y, a.x, a.y) <= R) g.buff.resp = Math.max(g.buff.resp, m.resp);
    } else if (au === 'pylon') {
      // Shield Pylon: towers can't be knocked out, everything protected takes less damage
      const gd = m.hardened || (1 - (0.2 + 0.05 * (L - 1)));
      for (const g of T) if (dist(g.x, g.y, a.x, a.y) <= R) { g.pylon = true; if (isStructure(g.def)) g.bgm = Math.min(g.bgm, gd); if (m.hardened && g !== a) g.buff.range = Math.max(g.buff.range, 1.1); }
      for (const t of G.troops) if (t.hp > 0 && dist(t.x, t.y, a.x, a.y) <= R) t.bg = Math.min(t.bg, gd);
      if (m.breaker && (a.pulseT = (a.pulseT || 0) + 6) >= m.breaker) {
        let any = false;
        for (const e of G.enemies) if (e.alive && dist(e.x, e.y, a.x, a.y) <= R && (e.shield > 0 || e.barrier > 0)) { e.shield = 0; if (e.barrier > 0) breakBarrier(e); any = true; }
        if (any) { a.pulseT = 0; G.lines.push({ ring: true, x: a.x, y: a.y, r: R, life: 20, ml: 20, color: '#18ffff' }); sfx('zap'); } else a.pulseT = m.breaker;
      }
    } else if (au === 'harvest') {
      // Biomass Reclaimer: enemies dying in the circle pay a bounty
      const bonus = 0.25 + 0.05 * (L - 1);
      for (const e of G.enemies) if (e.alive && dist(e.x, e.y, a.x, a.y) <= R) e.harvest = Math.max(e.harvest, bonus * (m.alienMul && e.def.alien ? m.alienMul : 1));
    }
  }
}
// Mechanic Bay specialties that act as auras
function healAura(a) {
  const st = a.units[0].stats, m = st.mods; if (!m.ward && !m.medic) return;
  const R = st.range * a.buff.range;
  for (const t of G.troops) if (t.hp > 0 && dist(t.x, t.y, a.x, a.y) <= R) { if (m.ward) t.bg = Math.min(t.bg, 1 - m.ward); if (m.medic) t.bregen = Math.max(t.bregen, 0.03); }
  for (const g of G.towers) if (dist(g.x, g.y, a.x, a.y) <= R) {
    if (m.ward && (g.def.kind === 'fence' || g.def.kind === 'trap')) g.bgm = Math.min(g.bgm, 1 - m.ward);
    if (m.medic && g.def.kind === 'barracks') g.buff.resp = Math.max(g.buff.resp, m.medic);
  }
}

// =====================================================================
//  GAME FLOW
// =====================================================================
function gameOver(won) {
  if (G.over) return;
  G.over = true; G.won = won;
  if (G.opts.mode !== 'sandbox' && !G.opts.test) store.del(KEYS.save);
  if (G.opts.mode === 'daily') G.dailyResult = finishDaily(won);
  recordRun();
  showEnd(won);
}
// Classic and Campaign wins earn map stars: more base health left = more stars (see DIFFICULTIES s2 / s3)
function victory() {
  G.stars = 0; G.starsBefore = 0;
  const mode = G.opts.mode;
  if (isCustomGame()) { if (mode !== 'sandbox') noteCustomBest(G.opts.custom, G.wave, true); gameOver(true); return; }     // custom maps: no stars, records or achievements (they can set their own money)
  if (mode === 'classic' || mode === 'campaign') {
    const stars = starsFor(G.lives, G.maxLives, G.opts.diff);
    const all = getStars(); const key = G.opts.map + '';
    G.starsBefore = all[key] || 0;
    if (G.starsBefore < stars) { all[key] = stars; store.set(KEYS.stars, all); }
    G.stars = stars;
    const got = getStars(), total = Object.values(got).reduce((a, b) => a + b, 0);
    if (total >= 30) unlock('stars30');
    if (MAPS.every((m, i) => (got[i] || 0) >= 3)) unlock('allstars');
    if (MAPS.every((m, i) => (got[i] || 0) > 0)) unlock('allmaps');
  }
  if (mode === 'classic') { unlock('win'); if (G.gm === 'tower') unlock('win_tower'); if (G.gm === 'troop') unlock('win_troop'); if (G.lives >= G.maxLives) unlock('flawless'); if (G.opts.diff === 'nightmare') unlock('nightmare'); }
  if (mode === 'campaign') unlock('campaign');
  if (mode === 'daily') unlock('dailywin');
  gameOver(true);
}
function recordRun() {
  if (G.opts.mode === 'sandbox' || isCustomGame()) return;
  const r = getRecords();
  r.games++; r.kills += G.stats.kills;
  store.set(KEYS.records, r);
  if (G.opts.mode === 'daily') return;          // the Daily Challenge keeps its own score table
  const endless = G.opts.mode === 'endless' || G.endlessContinued, sfx2 = G.gm === 'tower' ? 'Tower' : G.gm === 'troop' ? 'Troop' : null;
  if (endless) { r.bestEndless = Math.max(r.bestEndless, G.wave); if (sfx2) r['bestEndless' + sfx2] = Math.max(r['bestEndless' + sfx2], G.wave); }
  else { r.best = Math.max(r.best, G.wave); if (sfx2) r['best' + sfx2] = Math.max(r['best' + sfx2], G.wave); }
  store.set(KEYS.records, r);
}
// anyMap = true: may also be earned on a custom map (the others need a built-in map, since a custom map can start you with lots of money)
function unlock(id, anyMap) {
  if (!G || G.opts.mode === 'sandbox' || (isCustomGame() && !anyMap)) return;
  const got = store.get(KEYS.ach, {}); if (got[id]) return;
  got[id] = Date.now(); store.set(KEYS.ach, got);
  const a = ACHIEVEMENTS.find(x => x.id === id); if (a) toast('Achievement: ' + a.name, '#ffd54f');
}

// =====================================================================
//  SAVE / LOAD (between waves)
//  Everything read back from storage is checked against the current data.
//  Retired items (like the old Wizard tower) are removed and refunded; a
//  save that cannot be repaired is backed up and replaced by a fresh game.
// =====================================================================
const REFUND_RATE = 1;     // retired items give back everything that was invested
function rawGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function rawSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function rawDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
function saveGame() {
  if (!G || G.opts.mode === 'sandbox' || G.over) return;
  const key = G.opts.mode === 'daily' ? KEYS.dailyRun : activeSlot ? slotKey(activeSlot) : null;     // a Daily Challenge run has its own key and never touches the slots
  if (!key) return;
  store.set(key, {
    v: 3, ver: VERSION, ts: Date.now(), gm: G.gm, opts: G.opts, seed: G.seed, wave: G.wave, money: G.money, lives: G.lives, stats: G.stats, endless: G.endlessContinued,
    abilities: G.abilities, auto: G.auto,
    hero: G.hero ? heroSaveData(G.hero) : null,
    towers: G.towers.filter(g => !g.auto && !(g.def.kind === 'mine' && g.used)).map(g => ({ d: g.def.id, x: g.x, y: g.y, t: g.targeting, s: g.sticky, hp: g.hp, rally: g.rally, u: g.units.map(u => [u.level, u.spec, Math.round(u.invested), Math.round(u.dealt), u.kills]) }))
  });
}
function parseSave(raw) { try { return cleanSave(JSON.parse(raw)); } catch (err) { warnTD('save check failed: ' + err); return null; } }
// Keeps a copy of a slot's save in its backup key. A damaged save never replaces a backup that is still readable.
function backupSlot(n, why) {
  const raw = rawGet(slotKey(n)); if (raw == null) return;
  const bak = rawGet(slotBakKey(n));
  if (bak != null && bak !== raw && !parseSave(raw) && parseSave(bak)) { warnTD('slot ' + n + ': damaged save, good backup kept (' + why + ')'); return; }
  rawSet(slotBakKey(n), raw);
  warnTD('slot ' + n + ' backed up (' + why + ')');
}
// Moves the pre-2.5 single save into the first empty slot (Slot 1) once. The old keys are left exactly as they were.
function migrateSaves() {
  if (rawGet(KEYS.slotsMigrated) != null) return;
  const legacy = rawGet(KEYS.save), legacyBak = rawGet(KEYS.saveBackup);
  if (legacy != null || legacyBak != null) {
    let n = 0; for (let i = 1; i <= SLOT_COUNT && !n; i++) if (rawGet(slotKey(i)) == null) n = i;
    if (n) {
      let ok = true;
      if (legacy != null) ok = rawSet(slotKey(n), legacy) && rawGet(slotKey(n)) === legacy;
      if (ok && legacyBak != null && rawGet(slotBakKey(n)) == null) rawSet(slotBakKey(n), legacyBak);
      if (!ok) return;       // could not write: try again next time, nothing was changed
      if (legacy != null) migrationNote = 'Your saved game was moved to Slot ' + n + '.';
    }
  }
  rawSet(KEYS.slotsMigrated, '1');
}
// state: 'empty' | 'ok' (c = repaired save) | 'bad' (unreadable). Reading never changes anything except a safety backup of a damaged save.
function slotInfo(n) {
  const raw = rawGet(slotKey(n));
  if (raw == null) return { n, state: 'empty', hasBak: !!(rawGet(slotBakKey(n)) != null && parseSave(rawGet(slotBakKey(n)))) };
  let ts = 0; try { const j = JSON.parse(raw); if (isPlainObj(j) && isNum(j.ts)) ts = j.ts; } catch (e) {}
  const c = parseSave(raw);
  if (c) return { n, state: 'ok', c, ts };
  backupSlot(n, 'unusable save');
  const b = rawGet(slotBakKey(n));
  return { n, state: 'bad', hasBak: !!(b != null && b !== raw && parseSave(b)) };
}
function allSlots() { const a = []; for (let i = 1; i <= SLOT_COUNT; i++) a.push(slotInfo(i)); return a; }
function setActiveSlot(n) { activeSlot = n; if (n) rawSet(KEYS.slotActive, String(n)); }
// Empties a slot (a copy of what was there is kept in its backup key).
function clearSlot(n) { backupSlot(n, 'cleared'); rawDel(slotKey(n)); }
// Puts a slot's backup copy back. If the slot has something unreadable in it, that is kept in the backup key instead.
function restoreSlotBackup(n) {
  const bak = rawGet(slotBakKey(n)); if (bak == null || !parseSave(bak)) return false;
  const cur = rawGet(slotKey(n));
  if (!rawSet(slotKey(n), bak)) return false;
  if (cur != null && cur !== bak) rawSet(slotBakKey(n), cur);
  return true;
}
// a saved Daily Challenge: the date and its modifiers (the map seed always comes from the date)
function cleanDaily(d) {
  if (!isPlainObj(d) || typeof d.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return null;
  const mods = Array.isArray(d.mods) ? d.mods.filter(m => typeof m === 'string' && own(DAILY_MOD, m)).slice(0, 4) : [];
  return { date: d.date, mods, shift: Math.round(numOr(d.shift, 0, 0, BOSS_ROTATION.length - 1)), seed: hashStr('td-map-' + d.date) };
}
// Returns a repaired copy of a saved game, or null when nothing can be salvaged.
function cleanSave(s) {
  if (!isPlainObj(s) || (s.v !== 2 && s.v !== 3) || !isPlainObj(s.opts)) return null;
  const o = s.opts;
  const mapN = typeof o.map === 'string' && /^\d+$/.test(o.map) ? +o.map : o.map;
  if (!Number.isInteger(mapN) || !MAPS[mapN]) return null;
  // saves from before 2.4 have no mode: they load as a mixed game so their troops and barracks keep working
  const gm = own(GAME_MODES, s.gm) ? s.gm : own(GAME_MODES, o.gm) ? o.gm : 'legacy';
  const opts = { gm, diff: own(DIFFICULTIES, o.diff) ? o.diff : 'normal', mode: own(MODES, o.mode) && o.mode !== 'sandbox' && o.mode !== 'test' ? o.mode : 'classic', variant: own(VARIANTS, o.variant) ? o.variant : 'normal', map: mapN };
  if (opts.mode === 'daily') { const dd = cleanDaily(o.daily); if (dd) opts.daily = dd; else opts.mode = 'classic'; }
  // 3.0: a game on a custom map carries the map's share code, so it still loads after the map is edited or deleted
  if (o.custom != null) { const cm = customMap(o.custom); if (!cm || opts.mode === 'daily') return null; opts.custom = o.custom; }
  const d = DIFFICULTIES[opts.diff], cmap = opts.custom ? customMap(opts.custom) : null, maxLives = Math.round((cmap && cmap.lives ? cmap.lives : d.lives) * 1.5);
  const out = { opts, seed: isNum(s.seed) ? Math.floor(s.seed) : ((Math.random() * 1e9) | 0), wave: Math.floor(numOr(s.wave, 1, 1, 100000)),
    money: numOr(s.money, d.money, 0, 1e12), lives: numOr(s.lives, d.lives, 1, maxLives), endless: !!s.endless, auto: !!s.auto,
    stats: {}, abilities: {}, towers: [], retired: {}, unknown: 0, refund: 0, skipped: 0, fixed: 0, hero: null };
  // 2.6: the hero (older saves have none, and simply let you pick one)
  if (isPlainObj(s.hero) && typeof s.hero.id === 'string' && own(HERO, s.hero.id)) {
    const hh = s.hero, cd = Array.isArray(hh.cd) ? hh.cd : [];
    out.hero = { id: hh.id, lv: Math.round(numOr(hh.lv, 1, 1, HERO_MAX)), xp: numOr(hh.xp, 0, 0, 1e7), x: numOr(hh.x, W / 2, 12, W - 12), y: numOr(hh.y, H / 2, 12, H - 12),
      cd: [0, 1].map(i => Math.round(numOr(cd[i], 0, 0, 120 * TPS))), k: Math.round(numOr(hh.k, 0, 0, 1e9)), d: numOr(hh.d, 0, 0, 1e15) };
  }
  if (isPlainObj(s.stats)) for (const k of ['kills', 'damage', 'leaked', 'built', 'spent', 'earned', 'lost', 'bosses']) if (own(s.stats, k)) out.stats[k] = numOr(s.stats[k], 0, 0, 1e15);
  if (isPlainObj(s.abilities)) for (const a of ALL_ABILITIES) {
    const legacy = Object.keys(LEGACY_ABILITY_IDS).find(k => LEGACY_ABILITY_IDS[k] === a.id);
    const src = own(s.abilities, a.id) ? a.id : (legacy && own(s.abilities, legacy) ? legacy : null);
    if (src) out.abilities[a.id] = numOr(s.abilities[src], 0, 0, a.cd * TPS);
  }
  const list = Array.isArray(s.towers) ? s.towers.slice(0, 600) : [];
  if (s.towers != null && !Array.isArray(s.towers)) { out.fixed++; warnTD('towers list was not an array'); }
  let superSeen = false;
  for (const t of list) {
    if (!isPlainObj(t)) { out.skipped++; warnTD('skipped a broken tower entry'); continue; }
    let id = typeof t.d === 'string' ? t.d : '';
    const rows = Array.isArray(t.u) ? t.u.filter(a => Array.isArray(a)).slice(0, 60) : [];
    const invested = rows.reduce((n, a) => n + (isNum(a[2]) && a[2] > 0 ? Math.min(a[2], 1e7) : 0), 0);
    const refund = () => { out.refund += Math.floor(invested * REFUND_RATE); };
    if (own(RETIRED_TOWERS, id)) { const nm = RETIRED_TOWERS[id]; out.retired[nm] = (out.retired[nm] || 0) + Math.max(1, rows.length); refund(); warnTD('retired tower ' + id + ' removed'); continue; }
    if (own(LEGACY_TOWER_IDS, id)) id = LEGACY_TOWER_IDS[id];
    if (!own(TOWER, id)) { out.unknown++; refund(); warnTD('unknown tower "' + String(t.d).slice(0, 30) + '" removed'); continue; }
    const def = TOWER[id];
    if (!inMode(def, gm)) { out.skipped++; refund(); warnTD('tower ' + id + ' does not belong to ' + gm + ' mode: removed'); continue; }
    if (def.kind === 'tank' || !isNum(t.x) || !isNum(t.y)) { out.skipped++; refund(); warnTD('tower ' + id + ' had no usable position'); continue; }
    if (def.super) { if (superSeen) { out.skipped++; refund(); warnTD('extra super tower removed'); continue; } superSeen = true; }
    let units = rows.map(a => {
      const maxLv = def.endless ? 999 : MAX_LEVEL;
      const lv = Math.round(numOr(a[0], 1, 1, maxLv));
      let sp = Math.round(numOr(a[1], 0, 0, 99));
      if (sp && !specOf(def, sp)) { sp = 0; out.fixed++; warnTD('spec no longer exists on ' + id + ': reset'); }
      if (sp && lv < MAX_LEVEL) sp = 0;
      return [lv, sp, numOr(a[2], def.cost, 0, 1e9), numOr(a[3], 0, 0, 1e15), numOr(a[4], 0, 0, 1e9)];
    });
    if (!units.length) units = [[1, 0, def.cost, 0, 0]];
    if (!def.stack || def.super) units = units.slice(0, 1);
    const x = clamp(t.x, 12, W - 12), y = clamp(t.y, 12, H - 12);
    if (x !== t.x || y !== t.y) out.fixed++;
    const tg = typeof t.t === 'string' && TARGETING.some(z => z.id === t.t) && !(def.air === 'only' && t.t === 'ground') ? t.t : null;
    const rally = isPlainObj(t.rally) && isNum(t.rally.x) && isNum(t.rally.y) ? { x: clamp(t.rally.x, 0, W), y: clamp(t.rally.y, 0, H) } : null;
    out.towers.push({ id, x, y, tg, sticky: t.s === true, hp: numOr(t.hp, 0, 0, 1e9), rally, units });
  }
  return out;
}
function applySave(c) {
  startGame(Object.assign({}, c.opts, { seed: c.seed }), true);
  G.wave = c.wave; G.money = c.money; G.lives = Math.min(c.lives, G.maxLives); Object.assign(G.stats, c.stats); G.endlessContinued = c.endless; G.auto = c.auto;
  for (const k of Object.keys(c.abilities)) if (own(G.abilities, k)) G.abilities[k] = c.abilities[k];
  let refund = c.refund, skipped = c.skipped;
  for (const t of c.towers) {
    try {
      const def = TOWER[t.id];
      const g = new TowerGroup(def, t.x, t.y); if (t.tg) g.targeting = t.tg; g.sticky = t.sticky; if (t.rally) g.rally = t.rally;
      g.units = t.units.map(a => {
        const u = new Unit(def); u.level = a[0]; u.spec = a[1]; u.invested = a[2]; u.dealt = a[3]; u.kills = a[4];
        if (def.manual) u.stock = u.stats.mods.charges || 1;
        return u;
      });
      if (def.onPath) { const np = nearestPathPoint(G, g.x, g.y); if (np) { g.x = np.x; g.y = np.y; } }
      if (def.kind === 'fence' || def.kind === 'trap') { syncStructure(g); if (t.hp > 0) g.hp = Math.min(g.maxHp, t.hp); }
      g.units.forEach(u => u.stats);       // touch the stats now so a bad entry fails here, not mid-wave
      G.towers.push(g);
    } catch (err) {
      skipped++; refund += Math.floor(t.units.reduce((n, a) => n + a[2], 0) * REFUND_RATE); warnTD('could not rebuild ' + t.id + ': ' + err);
    }
  }
  G.money += refund;
  if (c.hero) {
    try {
      const hh = c.hero, h = deployHero(hh.id, hh.x, hh.y, true);
      h.lvl = hh.lv; h.xp = hh.lv >= HERO_MAX ? 0 : Math.min(hh.xp, heroXpNeed(hh.lv) - 1); h.cdA = hh.cd.slice(); h.kills = hh.k; h.dealt = hh.d;
      heroRefresh(h, true);
    } catch (err) { warnTD('could not bring the hero back: ' + err); G.hero = null; G.heroId = null; G.troops = G.troops.filter(t => !t.hero); }
  }
  G.nextWave = buildWave(G.wave);
  updateHUD(true); rebuildShop();
  const names = Object.keys(c.retired).map(n => n + ' towers');
  if (c.unknown) names.push('some unrecognized items');
  let msg = 'Welcome back - wave ' + G.wave + (G.gm === 'legacy' ? ' (old save: towers and troops together)' : ' (' + GAME_MODES[G.gm].name + ')'), color = '#2ecc71', ms = 2200;
  if (names.length) { msg = names.join(' and ') + ' were retired.' + (refund > 0 ? ' You got ' + money$(refund) + ' back.' : ''); color = '#ffd54f'; ms = 5000; }
  else if (refund > 0 || skipped + c.fixed > 0) { msg = 'Welcome back - wave ' + G.wave + ' (some damaged entries were repaired' + (refund > 0 ? ', ' + money$(refund) + ' refunded' : '') + ')'; color = '#ffd54f'; ms = 4500; }
  toast(msg, color, ms);
  return msg;
}
// true = handled (a game started, or a message was shown); false = that slot has no usable saved game
function loadSlot(n) {
  const info = slotInfo(n);
  if (info.state !== 'ok') return false;
  const c = info.c;
  setActiveSlot(n);
  try { applySave(c); return true; }
  catch (err) {
    console.error('[TD] loading the save failed', err);
    backupSlot(n, 'load failed'); rawDel(slotKey(n));
    try { startGame(Object.assign({}, c.opts)); } catch (e2) { console.error('[TD] fresh start failed', e2); showMenu('slots'); }
    toast('Your saved game could not be loaded, so a fresh game was started. A backup copy was kept.', '#ff8a80', 6000);
    return true;
  }
}
// The slot Continue should open: the most recently played one.
function latestSlot() {
  const list = allSlots().filter(s => s.state === 'ok'); if (!list.length) return null;
  let best = list[0]; for (const s of list) if (s.ts > best.ts) best = s;
  if (list.every(s => !s.ts)) { const a = +rawGet(KEYS.slotActive); const m = list.find(s => s.n === a); if (m) best = m; }
  return best;
}

// =====================================================================
//  DAILY CHALLENGE (2.6)
//  The date picks the map, its flip, the boss order and three modifiers
//  (one boon, two twists), so everyone gets the same front on the same day.
//  30 waves on Regular; the best score of each day is kept (last 60 days).
//  A run in progress saves to its own key (td2_daily_run), never a slot.
// =====================================================================
function dailySetup(date) {
  const rng = mulberry32(hashStr('td-daily-' + date));
  const map = (rng() * MAPS.length) | 0, variant = ['normal', 'mirror', 'flip'][(rng() * 3) | 0];
  const boons = DAILY_MODS.filter(m => m.good), twists = DAILY_MODS.filter(m => !m.good);
  const boon = boons[(rng() * boons.length) | 0].id, tw = [];
  for (let g = 0; tw.length < 2 && g < 60; g++) { const t = twists[(rng() * twists.length) | 0].id; if (!tw.includes(t) && DAILY_CLASH[boon] !== t) tw.push(t); }
  return { date, map, variant, mods: [boon].concat(tw), shift: (rng() * BOSS_ROTATION.length) | 0, seed: hashStr('td-map-' + date) };
}
function dailyOpts(gm, d) { return { gm, diff: 'normal', mode: 'daily', variant: d.variant, map: d.map, daily: { date: d.date, mods: d.mods.slice(), shift: d.shift, seed: d.seed } }; }
// 1,000 per wave cleared, 1,500 per boss, 5 per kill; holding all 30 waves adds 5,000 plus up to 5,000 for base health left
function dailyScore(cleared, kills, bosses, won, lives, maxLives) { return Math.max(0, cleared) * 1000 + Math.round(kills || 0) * 5 + Math.round(bosses || 0) * 1500 + (won ? 5000 + Math.round(5000 * clamp(maxLives > 0 ? lives / maxLives : 0, 0, 1)) : 0); }
const dailyLive = () => G.dailyFinal != null ? G.dailyFinal : dailyScore(G.wave - 1, G.stats.kills, G.stats.bosses, false, 0, 1);   // dailyFinal: the run is over (win bonus included)
function getDaily() {
  const o = store.get(KEYS.daily, {}), out = { days: {}, best: { s: 0, d: '' }, plays: 0 };
  if (!isPlainObj(o)) return out;
  if (isPlainObj(o.days)) for (const k of Object.keys(o.days)) { const v = o.days[k]; if (/^\d{4}-\d{2}-\d{2}$/.test(k) && isPlainObj(v) && isNum(v.s)) out.days[k] = { s: Math.max(0, Math.floor(v.s)), w: Math.floor(numOr(v.w, 0, 0, 1e6)), won: !!v.won, gm: v.gm === 'troop' ? 'troop' : 'tower' }; }
  if (isPlainObj(o.best) && isNum(o.best.s)) out.best = { s: Math.max(0, Math.floor(o.best.s)), d: typeof o.best.d === 'string' ? o.best.d.slice(0, 10) : '' };
  out.plays = Math.floor(numOr(o.plays, 0, 0, 1e9));
  return out;
}
function dailyStreak(o) { let n = 0; const d = new Date(); if (!o.days[dateKey(d)]) d.setDate(d.getDate() - 1); while (o.days[dateKey(d)] && n < 999) { n++; d.setDate(d.getDate() - 1); } return n; }
function recordDaily(date, score, wave, won, gm) {
  const o = getDaily(), prev = o.days[date], better = !prev || score > prev.s;
  if (better) o.days[date] = { s: score, w: wave, won: won || !!(prev && prev.won), gm };
  else if (won) prev.won = true;
  o.plays++;
  if (score > o.best.s) o.best = { s: score, d: date };
  const keys = Object.keys(o.days).sort(); while (keys.length > 60) delete o.days[keys.shift()];
  store.set(KEYS.daily, o);
  if (dailyStreak(o) >= 3) unlock('streak3');
  return { best: o.days[date].s, better, prev: prev ? prev.s : 0 };
}
// the end of a daily run (called from gameOver): score it, keep the best, and clear the saved run
function finishDaily(won) {
  const goal = MODES.daily.goal, cleared = won ? goal : Math.max(0, G.wave - 1);
  const score = dailyScore(cleared, G.stats.kills, G.stats.bosses, won, G.lives, G.maxLives);
  G.dailyFinal = score; rawDel(KEYS.dailyRun);
  const r = recordDaily(G.opts.daily.date, score, cleared, won, G.gm);
  return { score, cleared, won, best: r.best, better: r.better, prev: r.prev, kills: G.stats.kills, bosses: G.stats.bosses || 0, livesPct: Math.round(100 * clamp(G.lives / G.maxLives, 0, 1)), lifeBonus: won ? Math.round(5000 * clamp(G.lives / G.maxLives, 0, 1)) : 0 };
}
// the saved, unfinished daily run (or null). A run from an earlier day (or any run when force is set) is scored as it stands and cleared.
function dailyRunInfo() { const raw = rawGet(KEYS.dailyRun); if (raw == null) return null; const c = parseSave(raw); return c && c.opts.mode === 'daily' && c.opts.daily ? c : { bad: true }; }
function settleDailyRun(force) {
  const c = dailyRunInfo(); if (!c) return null;
  if (c.bad) { rawDel(KEYS.dailyRun); return null; }
  if (!force && c.opts.daily.date === dateKey()) return c;
  recordDaily(c.opts.daily.date, dailyScore(c.wave - 1, c.stats.kills, c.stats.bosses, false, 0, 1), c.wave - 1, false, c.opts.gm === 'troop' ? 'troop' : 'tower');
  rawDel(KEYS.dailyRun);
  return null;
}
function startDaily(gm) {
  settleDailyRun(true);
  activeSlot = 0;
  startGame(dailyOpts(gm, dailySetup(dateKey())));
}
function resumeDaily() {
  const c = settleDailyRun(false); if (!c) { toast('No daily run to resume'); return false; }
  activeSlot = 0;
  try { applySave(c); return true; } catch (err) { console.error('[TD] loading the daily run failed', err); rawDel(KEYS.dailyRun); toast('That daily run could not be loaded.', '#ff8a80'); showMenu('daily'); return false; }
}
