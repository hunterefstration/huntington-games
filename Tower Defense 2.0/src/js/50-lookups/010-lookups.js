
'use strict';
// =====================================================================
//  LOOKUPS
// =====================================================================
const mouse = { in: false, sx: 0, sy: 0, wx: 0, wy: 0 };
const hover = { tower: null, enemy: null, troop: null };
const drag = { active: false, box: false, sx: 0, sy: 0, csx: 0, csy: 0, button: 0, alt: false };
let boxMode = 'auto', lastClick = { t: 0, g: null };
const curGM = () => (G && G.gm) || 'legacy';
const gmTabs = () => TABS_BY_MODE[curGM()] || TABS;
const shopList = (tab) => TOWERS.filter(t => t.tab === tab && inMode(t, curGM()));
const specHidden = (s) => !!(s && s.gm === 'troop' && curGM() === 'tower');
function towerAt(x, y, defId) { let best = null, bd = 19; for (const g of G.towers) { if (g.auto || (defId && g.def.id !== defId)) continue; const d = dist(g.x, g.y, x, y); if (d < bd) { bd = d; best = g; } } return best; }
function troopAt(x, y) { let best = null, bd = 13; for (const t of G.troops) { if (t.hp <= 0 || t.fixed) continue; const d = dist(t.x, t.y, x, y); if (d < bd + (t.kind === 'tank' ? 8 : 0)) { bd = d; best = t; } } return best; }
function enemyAt(x, y) { let best = null, bd = 1e9; for (const e of G.enemies) { if (!e.alive) continue; const d = dist(e.x, e.y, x, y); if (d < e.r + 5 && d < bd) { bd = d; best = e; } } return best; }
function countOf(def) {
  if (def.kind === 'tank') return G.troops.filter(t => t.kind === 'tank' && t.hp > 0).length;
  let n = 0; for (const g of G.towers) if (g.def === def && !g.auto) n += def.stack ? g.units.length : 1; return n;
}
function limitOf(def) { if (def.super) return 1; if (def.consumable) return def.limit; return Math.max(1, Math.floor(def.limit * G.diff.limits * (G.gm === 'troop' && def.kind === 'barracks' ? TM.barracksLimit : 1) * (G.mods.limits ? 0.5 : 1))); }
const hasSuper = () => G.towers.some(g => g.def.super);
const waveLocked = (def) => !!(def.wave && G.wave < def.wave && G.opts.mode !== 'sandbox');
function buyError(def) {
  if (!inMode(def, curGM())) return def.name + ' is not available in ' + GAME_MODES[curGM()].name;
  if (waveLocked(def)) return def.name + ' unlocks at wave ' + def.wave + (def.era === 'alien' ? ' (alien tech)' : '');
  if (G.money < def.cost) return "Can't afford another " + def.name;
  if (def.super && hasSuper()) return 'Only one super tower at a time';
  if (countOf(def) >= limitOf(def)) return def.name + ' limit reached (' + limitOf(def) + ')';
  return null;
}

// =====================================================================
//  PLACING, SELECTING, MOVING
// =====================================================================
function beginPlace(id) {
  const def = TOWER[id]; if (!G || G.over) return;
  initAudio();
  if (G.place === id) { cancelPlace(); return; }
  const err = buyError(def); if (err) { toast(err, '#ff8a80'); sfx('deny'); return; }
  if (def.kind === 'tank') {        // tanks deploy straight from the base, no placement
    spend(def.cost); G.troops.push(makeTank()); toast('Tank deployed', '#8cc8ff'); sfx('build'); rebuildShop(); return;
  }
  clearSelection(); G.place = id; G.placeMerc = null; G.placeHero = null; G.aim = null; G.armed = null; G.moveMode = null;
  rebuildShop();
}
function cancelPlace(reason) { if (!G || !G.place) return; G.place = null; if (reason) toast(reason, '#ff8a80'); rebuildShop(); }
// mercenary placement: pick a squad, then click near the road
function beginMerc(id) {
  if (!G || G.over) return; initAudio();
  const m = MERC[id];
  if (G.placeMerc === id) { cancelMerc(); return; }
  const err = mercError(m); if (err) { toast(err, '#ff8a80'); sfx('deny'); return; }
  clearSelection(); G.place = null; G.armed = null; G.aim = null; G.moveMode = null; G.placeMerc = id;
  toast('Click near the road to drop ' + m.name + ' (right-click cancels)', '#ffd54f');
  rebuildShop(); updateHUD(true);
}
function cancelMerc(reason) { if (!G || !G.placeMerc) return; G.placeMerc = null; if (reason) toast(reason, '#ff8a80'); rebuildShop(); updateHUD(true); }
function spend(n) { if (G.opts.mode === 'sandbox') return; G.money -= n; G.stats.spent += n; }
function tryPlace(x, y) {
  const def = TOWER[G.place]; const err = buyError(def);
  if (err) { cancelPlace(err); sfx('deny'); return; }
  if (def.stack) {
    const on = towerAt(x, y, def.id);
    if (on) { spend(def.cost); on.units.push(new Unit(def)); on.builtWave = on.builtWave || G.wave; floatText(on.x, on.y - 20, 'x' + on.units.length, '#2ecc71', true); sfx('build'); if (on.units.length >= 10) unlock('stack10'); afterBuy(def); return; }
  }
  const pe = placementError(G, def, x, y);
  if (pe) { toast(pe, '#ff8a80'); sfx('deny'); return; }
  spend(def.cost);
  const g = new TowerGroup(def, x, y); g.builtWave = G.wave;
  if (def.onPath) { const np = nearestPathPoint(G, x, y); g.x = np.x; g.y = np.y; }
  if (isStructure(def)) syncStructure(g);
  G.towers.push(g); G.stats.built++; burst(g.x, g.y, '#ecf0f1', 8, 1.5); sfx('build');
  if (def.super) unlock('super');
  if (def.era === 'alien' && new Set(G.towers.filter(o => o.def.era === 'alien' && !o.auto).map(o => o.def.id)).size >= 5) unlock('alientech');
  afterBuy(def);
}
// Stay in build mode for quick multi-placing, but drop out the moment you can't buy another
function afterBuy(def) { const err = buyError(def); if (err) cancelPlace(err); else rebuildShop(); updateHUD(true); }
function clearSelection() { if (!G) return; G.sel.towers.clear(); G.sel.troops.clear(); G.moveMode = null; G.aim = null; specOpen = null; specScope = null; refreshSelection(); }
function deselectAll() { if (!G) return; G.place = null; G.placeMerc = null; G.placeHero = null; G.armed = null; clearSelection(); rebuildShop(); renderAbilities(); renderHeroBar(true); }
function selectTower(g, add) { if (!add) { G.sel.towers.clear(); G.sel.troops.clear(); } if (add && G.sel.towers.has(g)) G.sel.towers.delete(g); else G.sel.towers.add(g); G.moveMode = null; G.aim = null; refreshSelection(); sfx('click'); }
function selectAllOfType(g) {
  G.sel.troops.clear(); G.sel.towers.clear(); for (const o of G.towers) if (o.def === g.def && !o.auto) G.sel.towers.add(o);
  G.moveMode = null; G.aim = null; specOpen = null; refreshSelection(true); sfx('click'); toast('Selected all ' + g.def.name + ' (' + G.sel.towers.size + ')', '#2ecc71');
}
function selectTroop(t, add) {
  if (t.fixed) return;
  if (!add) { G.sel.towers.clear(); G.sel.troops.clear(); }
  // clicking one troop of a squad grabs the whole squad (barracks squad, mercenary squad or reinforcement team)
  for (const s of groupOf(t)) { if (add && G.sel.troops.has(s)) G.sel.troops.delete(s); else G.sel.troops.add(s); }
  G.moveMode = null; refreshSelection(); sfx('click');
}
// drag a box: mode 'auto' grabs troops if the box caught any (that's what you're usually commanding), else towers.
// 'towers' / 'troops' force one kind (Alt while dragging, or the Box button).
function boxSelect(x1, y1, x2, y2, add, mode) {
  const a = Math.min(x1, x2), b = Math.min(y1, y2), c = Math.max(x1, x2), d = Math.max(y1, y2);
  if (!add) { G.sel.towers.clear(); G.sel.troops.clear(); }
  const troops = G.troops.filter(t => t.hp > 0 && !t.fixed && t.x >= a && t.x <= c && t.y >= b && t.y <= d);
  const towers = G.towers.filter(g => !g.auto && g.x >= a && g.x <= c && g.y >= b && g.y <= d);
  if (mode === 'towers') towers.forEach(g => G.sel.towers.add(g));
  else if (mode === 'troops') troops.forEach(t => G.sel.troops.add(t));
  else if (G.gm === 'tower' && towers.length) towers.forEach(g => G.sel.towers.add(g));        // Tower Mode: the only troop is the hero, so towers win
  else if (troops.length) troops.forEach(t => G.sel.troops.add(t)); else towers.forEach(g => G.sel.towers.add(g));
  specOpen = null; refreshSelection();
}
function startMove() {
  const towers = [...G.sel.towers].filter(g => g.def.kind !== 'mine'), troops = [...G.sel.troops].filter(t => !t.fixed);
  if (!towers.length && !troops.length) return;
  let cx = 0, cy = 0; const all = [...towers, ...troops]; for (const o of all) { cx += o.x; cy += o.y; } cx /= all.length; cy /= all.length;
  for (const o of all) { o.ox = o.x - cx; o.oy = o.y - cy; }
  // troops close together get a tidy formation instead of keeping their messy spacing
  if (!towers.length) troops.forEach((t, i) => { const f = formationOffset(i, troops.length); t.ox = f.x; t.oy = f.y; });
  G.moveMode = { towers, troops }; G.place = null; G.placeMerc = null; G.placeHero = null; G.aim = null;
  toast(towers.length ? 'Click where to move them (Esc cancels)' : 'Click where the troops should go', '#2ecc71');
}
function commitMove(x, y) {
  const mm = G.moveMode;
  for (const g of mm.towers) { const err = placementError(G, g.def, x + g.ox, y + g.oy, g); if (err) { toast(g.def.name + ': ' + err, '#ff8a80'); sfx('deny'); return; } }
  for (const g of mm.towers) { g.x = x + g.ox; g.y = y + g.oy; if (g.def.onPath) { const np = nearestPathPoint(G, g.x, g.y); g.x = np.x; g.y = np.y; } g.redeploy = G.waveActive ? 90 : 0; if (g.def.kind === 'barracks') g.rally = null; if (g.squad && g.garrison) g.squad.forEach(t => { t.home = { x: g.x, y: g.y }; }); }
  orderTroops(x, y, mm.troops, true);
  G.moveMode = null; sfx('build'); refreshSelection();
}
function orderTroops(x, y, list, keepOffsets) {
  list = list || [...G.sel.troops]; list = list.filter(t => !t.fixed); if (!list.length) return;
  list.forEach((t, i) => {
    const off = keepOffsets && t.ox != null ? { x: t.ox, y: t.oy } : formationOffset(i, list.length);
    const tx = clamp(x + off.x, 6, W - 6), ty = clamp(y + off.y, 6, H - 6);
    t.order = { x: tx, y: ty }; t.target = null; t.holding = true;
    if (t.owner && t.owner.def.kind === 'barracks') { t.owner.rally = { x, y }; }
  });
  G.lines.push({ ring: true, x, y, r: 14, life: 16, ml: 16, color: '#2ecc71' }); sfx('click');
}

// =====================================================================
//  UPGRADES / SPECIALTIES / SELL
// =====================================================================
function upgradeUnit(g, i) {
  const u = g.units[i]; if (!u || u.maxed || (u.canSpec && !u.def.endless)) return false;
  const c = u.nextCost; if (G.money < c && G.opts.mode !== 'sandbox') { sfx('deny'); return false; }
  spend(c); u.invested += c; u.level++; sfx('upgrade'); burst(g.x, g.y, '#ffd54f', 6, 1.5);
  if (isStructure(g.def)) syncStructure(g);
  if (u.level === MAX_LEVEL && g.def.specs && !G.hinted.spec) { G.hinted.spec = 1; toast('Level 5! Select it and choose a specialty: for one unit, the whole stack, or your whole selection.', '#ffd54f'); }
  return true;
}
function upgradeGroups(groups) {
  // cheapest first, round-robin, so money is spread evenly; endless towers go up at most one level per click
  let any = false; const once = new Set();
  for (let guard = 0; guard < 2000; guard++) {
    let best = null, bc = Infinity;
    for (const g of groups) g.units.forEach((u, i) => { if (u.maxed || (u.canSpec && !u.def.endless) || once.has(u)) return; const c = u.nextCost; if (c < bc) { bc = c; best = [g, i, u]; } });
    if (!best || (G.money < bc && G.opts.mode !== 'sandbox')) break;
    upgradeUnit(best[0], best[1]); any = true; if (best[2].def.endless) once.add(best[2]);
  }
  if (!any) { toast('Nothing you can afford to upgrade', '#ff8a80'); sfx('deny'); }
  refreshSelection(true); updateHUD(true);
}
// --- specialties: one unit, a whole stack, or every eligible unit in the selection ---
let specOpen = null, specScope = null;
// which units of this tower type can take a specialty right now (level 5, none chosen yet), and why the rest can't
function eligibleUnits(groups, def) {
  const elig = []; let low = 0, done = 0, total = 0;
  for (const g of groups) if (g.def === def) g.units.forEach((u, i) => { total++; if (u.spec) done++; else if (u.level < MAX_LEVEL) low++; else elig.push([g, i]); });
  return { elig, low, done, total };
}
function skipNote(r) {
  const p = []; if (r.low) p.push(r.low + ' below level ' + MAX_LEVEL + ' (upgrade them first)'); if (r.done) p.push(r.done + ' already specialized');
  return p.length ? 'Skipping ' + p.join(', ') + '.' : '';
}
function applySpec(list, spec) {
  if (!list.length) return 0;
  const def = list[0][0].def, c = specCost(def); let n = 0; const touched = new Set();
  if (specHidden(specOf(def, spec))) return 0;
  for (const [g, i] of list) {
    const u = g.units[i]; if (!u || !u.canSpec) continue;
    if (G.opts.mode !== 'sandbox' && G.money < c) break;
    spend(c); u.invested += c; u.spec = spec; n++; touched.add(g);
    if (def.manual) u.stock = u.stats.mods.charges || 1;
  }
  if (!n) { sfx('deny'); toast("Can't afford a specialty ($" + fmt(c) + ' each)', '#ff8a80'); return 0; }
  for (const g of touched) {
    burst(g.x, g.y, '#ffd54f', 20, 3);
    if (g.squad && (def.kind === 'barracks' || g.garrison !== undefined)) { g.squad.forEach(t => { t.hp = 0; t.expired = true; }); g.squad = []; g.everSpawned = false; g.respawnT = 0; }
    if (isStructure(def)) syncStructure(g);
  }
  sfx('upgrade'); unlock('spec'); if (n >= 5) unlock('drill');
  const left = list.length - n;
  toast(n === 1 ? def.name + ' specialized: ' + def.specs[spec - 1].name : 'Specialized ' + n + ' ' + def.name + ': ' + def.specs[spec - 1].name + ' (-' + money$(n * c) + ')' + (left > 0 ? ', ' + left + ' left (not enough money)' : ''), '#ffd54f');
  specOpen = null; refreshSelection(true); updateHUD(true);
  return n;
}
function sellGroups(groups, force) {
  if (!groups.length) return;
  const value = groups.reduce((s, g) => s + g.sellValue, 0);
  if (S.confirmSell && !force && value >= 300) { confirmBox('Sell ' + (groups.length > 1 ? groups.length + ' towers' : groups[0].def.name) + '?', 'You get back ' + money$(value) + '.', () => sellGroups(groups, true)); return; }
  for (const g of groups) { G.money += g.sellValue; burst(g.x, g.y, '#ffd54f', 10, 2); removeTower(g); }
  floatText(groups[0].x, groups[0].y - 20, '+' + money$(value), '#ffd54f', true); sfx('sell');
  G.sel.towers.clear(); refreshSelection(); rebuildShop(); updateHUD(true);
}
function repairFence(g) {
  const missing = g.maxHp - g.hp; if (missing <= 0) return;
  const c = Math.ceil(missing / g.maxHp * g.def.cost * 0.6);
  if (G.money < c && G.opts.mode !== 'sandbox') { sfx('deny'); return; }
  spend(c); g.hp = g.maxHp; sfx('upgrade'); refreshSelection(true);
}
function repairAll(groups) {
  let total = 0; const list = groups.filter(g => isStructure(g.def) && g.hp < g.maxHp);
  for (const g of list) { const c = Math.ceil((g.maxHp - g.hp) / g.maxHp * g.def.cost * 0.6); if (G.money < c && G.opts.mode !== 'sandbox') continue; spend(c); g.hp = g.maxHp; total += c; }
  if (total) { sfx('upgrade'); toast('Repaired for ' + money$(total), '#2ecc71'); } else sfx('deny');
  refreshSelection(true);
}

// =====================================================================
//  INPUT
// =====================================================================
function canvasPos(ev) { const r = canvas.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; }
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', (ev) => {
  if (!G || G.over) return; initAudio();
  const p = canvasPos(ev), w = toWorld(p.x, p.y); mouse.wx = w.x; mouse.wy = w.y; mouse.in = true;
  try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
  if (ev.button === 2) {           // right click: order troops, otherwise cancel / deselect
    if (G.armed || G.placeHero) { G.armed = null; G.placeHero = null; renderAbilities(); renderHeroBar(true); return; }
    if (G.sel.troops.size && !G.place && !G.placeMerc) { orderTroops(w.x, w.y); return; }
    deselectAll(); return;
  }
  if (ev.button !== 0) return;
  if (G.placeHero) {
    const err = heroPlaceError(w.x, w.y) || heroCostError();
    if (err) { toast(err, '#ff8a80'); sfx('deny'); } else { spend(HERO_COST); deployHero(G.placeHero, w.x, w.y); renderHeroBar(true); updateHUD(true); }
    return;
  }
  if (G.armed && G.armed.startsWith('hero')) { if (useHeroAbility(+G.armed[4], w.x, w.y)) { renderHeroBar(true); refreshSelection(true); } return; }
  if (G.armed) { if (useAbility(G.armed, w.x, w.y)) renderAbilities(); return; }
  if (G.placeMerc) { const id = G.placeMerc; if (hireMerc(id, w.x, w.y)) { G.placeMerc = null; rebuildShop(); updateHUD(true); } else if (mercError(MERC[id])) cancelMerc(); return; }
  if (G.aim) { if (fireSuper(G.aim, w.x, w.y)) { G.aim = null; refreshSelection(true); } return; }
  if (G.moveMode) { commitMove(w.x, w.y); return; }
  if (G.place) { tryPlace(w.x, w.y); return; }
  drag.active = true; drag.box = false; drag.sx = w.x; drag.sy = w.y; drag.csx = p.x; drag.csy = p.y; drag.shift = ev.shiftKey; drag.alt = ev.altKey;
});
canvas.addEventListener('pointermove', (ev) => {
  if (!G) return;
  const p = canvasPos(ev), w = toWorld(p.x, p.y); mouse.sx = p.x; mouse.sy = p.y; mouse.wx = w.x; mouse.wy = w.y; mouse.in = true;
  if (drag.active && !drag.box && Math.hypot(p.x - drag.csx, p.y - drag.csy) > 6) drag.box = true;
});
canvas.addEventListener('pointerup', (ev) => {
  if (!G || !drag.active) return;
  drag.active = false;
  const p = canvasPos(ev), w = toWorld(p.x, p.y);
  if (drag.box) { boxSelect(drag.sx, drag.sy, w.x, w.y, drag.shift, drag.alt ? 'towers' : boxMode); drag.box = false; return; }
  const tr = troopAt(w.x, w.y), tw = towerAt(w.x, w.y);
  if (tr && (!tw || dist(tr.x, tr.y, w.x, w.y) < dist(tw.x, tw.y, w.x, w.y))) selectTroop(tr, drag.shift);
  else if (tw) {
    const now = performance.now();
    if (lastClick.g === tw && now - lastClick.t < 380 && !drag.shift) { selectAllOfType(tw); lastClick.g = null; }
    else { selectTower(tw, drag.shift); lastClick.g = tw; lastClick.t = now; }
  }
  else if (!drag.shift) clearSelection();
});
canvas.addEventListener('pointerleave', () => { mouse.in = false; $('tooltip').classList.add('hidden'); });
document.addEventListener('keydown', (ev) => {
  if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'SELECT' || ev.target.tagName === 'TEXTAREA') && !(ev.key === 'Escape' && ev.target.closest('.modal'))) return;
  const k = ev.key.toLowerCase();
  if (k === 'escape') { if (!$('modal-confirm').classList.contains('hidden')) { closeModal('confirm'); return; } const open = document.querySelector('.modal:not(.hidden)'); if (open && open.id !== 'modal-end') { if (open.id === 'modal-pause') setPaused(false); else open.classList.add('hidden'); return; } if (G) deselectAll(); return; }
  if (!G || G.over || !$('game-screen') || $('game-screen').classList.contains('hidden')) return;
  if (document.querySelector('.modal:not(.hidden)')) return;
  if (k === ' ') { ev.preventDefault(); startWave(); }
  else if (k === 'p') setPaused(!paused);
  else if (k === 'f') cycleSpeed();
  else if (k === 'r') toggleRanges();
  else if (k === 'u') { if (G.sel.towers.size) upgradeGroups([...G.sel.towers]); }
  else if (k === 's' || k === 'delete') { if (G.sel.towers.size) sellGroups([...G.sel.towers]); }
  else if (k === 'm') startMove();
  else if (k === 't' && G.sel.towers.size) { const g = [...G.sel.towers][0]; const i = TARGETING.findIndex(x => x.id === g.targeting); const nt = TARGETING[(i + 1) % TARGETING.length].id; G.sel.towers.forEach(x => x.targeting = nt); toast('Targeting: ' + TARGETING.find(x => x.id === nt).name); refreshSelection(true); }
  else if (k === 'tab') { ev.preventDefault(); const tb = gmTabs(); shopTab = tb[(tb.indexOf(shopTab) + 1) % tb.length]; rebuildShop(true); }
  else if (k === 'h') { if (gmTabs().includes('Mercs')) { shopTab = 'Mercs'; rebuildShop(true); } }
  else if (/^[1-9]$/.test(k)) { if (shopTab === 'Mercs') { const m = MERCS[+k - 1]; if (m) beginMerc(m.id); } else { const list = shopList(shopTab); const d = list[+k - 1]; if (d) beginPlace(d.id); } }
  else if (k === 'z' || k === 'x') { if (G.hero) armHero(k === 'z' ? 0 : 1); else openHeroPicker(); }
  else if (k === 'v') selectHero();
  else { const a = ABILITIES.find(x => x.key.toLowerCase() === k); if (a) armAbility(a.id); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && G && !G.over && S.autoPauseHidden && !paused && !$('game-screen').classList.contains('hidden')) setPaused(true); });

// =====================================================================
//  HUD
// =====================================================================
let hudKey = '';
function troopPlural(name, n) { return n === 1 ? name : name === 'Rifleman' ? 'Riflemen' : name === 'Heavy Infantry' ? name : name + 's'; }
function updateHUD(force) {
  if (!G) return;
  $('h-money').textContent = G.opts.mode === 'sandbox' ? 'INF' : fmt(G.money);
  $('h-lives').textContent = Math.max(0, Math.ceil(G.lives));
  $('h-wave').textContent = G.wave;
  $('h-wavemax').textContent = waveGoal() ? '/ ' + waveGoal() : G.opts.test ? '(test)' : G.opts.mode === 'sandbox' ? '' : '(endless)';
  const daily = G.opts.mode === 'daily'; $('hs-score').classList.toggle('hidden', !daily); if (daily) $('h-score').textContent = fmt(dailyLive());
  { const wt = $('h-wavetype'), s = G.waveActive ? G.waveLabel : (G.nextWave ? 'NEXT: ' + G.nextWave.label : 'READY'); if (wt.textContent !== s) { wt.textContent = s; $('hs-type').title = s; } }   // the title shows it whole when a narrow HUD cuts it short
  const wb = $('b-wave'), wbs = G.waveActive ? 'a' : G.countdown > 0 ? 'c' : 'r'; wb.disabled = G.waveActive;
  if (wb.dataset.s !== wbs) { wb.dataset.s = wbs; wb.innerHTML = wbs === 'a' ? 'Wave in progress' : wbs === 'c' ? '&#9654; Start now<span class="hud-wide"> (+bonus)</span>' : '&#9654; Start Wave'; }   // only when it changes: a press on a replaced child would be lost
  $('b-auto').textContent = 'Auto: ' + (G.auto ? 'On' : 'Off'); $('b-auto').classList.toggle('on', G.auto);
  $('b-speed').textContent = G.speed + 'x';
  $('b-sellmode').classList.toggle('on', G.showRanges);
  $('b-deselect').disabled = !(G.place || G.placeMerc || G.placeHero || G.sel.towers.size || G.sel.troops.size || G.armed || G.aim || G.moveMode);
  const cd = $('countdown');
  if (G.countdown > 0 && !G.waveActive) { cd.classList.remove('hidden'); cd.textContent = 'Next wave in ' + Math.ceil(G.countdown / TPS) + 's'; } else cd.classList.add('hidden');
  // next wave preview chips
  const nw = G.waveActive ? null : G.nextWave;
  const key = nw ? G.wave + '|' + nw.label : 'none';
  if (force || key !== hudKey) {
    hudKey = key; const box = $('wave-preview'); box.innerHTML = '';
    if (nw) {
      const counts = {}; for (const s of nw.list) counts[s.id] = (counts[s.id] || 0) + 1;
      Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 7).forEach(([id, n]) => { const d = ENEMY[id]; if (!d) return; const ch = document.createElement('span'); ch.className = 'wp-chip'; ch.title = d.name; ch.innerHTML = '<span class="wp-dot" style="background:' + d.color + '"></span>' + n + 'x ' + d.name; box.appendChild(ch); });
    }
  }
}
function cycleSpeed() { G.speed = G.speed >= 3 ? 1 : G.speed + 1; updateHUD(); }
function toggleRanges() { G.showRanges = !G.showRanges; updateHUD(); }
function setPaused(p) {
  paused = p; $('modal-pause').classList.toggle('hidden', !p);
  if (p && G) {
    const mode = G.opts.mode, st = (mode === 'campaign' || mode === 'classic') && !G.endlessContinued && !isCustomGame() ? starsFor(G.lives, G.maxLives, G.opts.diff) : 0;
    $('b-quit').innerHTML = G.opts.test ? '&#9998; Back to Editor' : 'Save &amp; Quit';
    $('pause-body').innerHTML = '<p style="color:var(--dim);font-size:13px;margin:0 0 8px">' + (G.opts.test ? 'Map Editor test run on <b style="color:var(--text)">' + escHTML(G.map.name) + '</b> &middot; nothing is saved' : mode === 'daily' ? 'Daily Challenge ' + G.opts.daily.date + ' &middot; score so far <b style="color:var(--gold)">' + fmt(dailyLive()) + '</b> &middot; saves after every wave (resume it from the Daily Challenge screen)' : 'Save slot: <b style="color:var(--text)">' + (activeSlot ? 'Slot ' + activeSlot : 'none (not saving)') + '</b> &middot; autosaves after every wave') + '</p>' +
      (st ? '<p style="color:var(--dim);font-size:13px;margin:0 0 8px">If you win with this much base health: <span class="stars" style="font-size:15px">' + '&#9733;'.repeat(st) + '&#9734;'.repeat(3 - st) + '</span></p>' : '') +
      (mode === 'daily' ? '<div style="margin:0 0 8px">' + G.opts.daily.mods.map(id => { const md = DAILY_MOD[id]; return '<span class="tag" style="color:' + (md.good ? '#6ee7a0' : '#ff8a80') + '" title="' + md.desc + '">' + md.name + '</span>'; }).join('') + '</div>' : '') +
      statsHTML() + '<p style="color:var(--dim);font-size:12px">Tip: ' + pick(tipList()) + '</p>';
  }
  if (!p) initAudio();
}
function statsHTML() {
  const s = G.stats;
  return '<div class="endstats"><div><b>' + G.wave + '</b>Wave</div><div><b>' + fmt(s.kills) + '</b>Kills</div><div><b>' + fmt(s.damage) + '</b>Damage</div><div><b>' + s.built + '</b>Towers built</div><div><b>' + s.leaked + '</b>Leaked</div><div><b>' + fmt(s.earned) + '</b>Earned</div></div>';
}

