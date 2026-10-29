// ---- the spec chooser for one tower (scope = this unit / whole stack / whole selection) ----
function specBoxHTML(g, i, towers) {
  const def = g.def, cost = specCost(def);
  const stackR = eligibleUnits([g], def), selR = eligibleUnits(towers, def);
  const multiSel = towers.length > 1;
  const counts = { unit: 1, stack: stackR.elig.length, sel: selR.elig.length };
  let scope = specScope || (stackR.elig.length > 1 ? 'stack' : 'unit');
  if (scope === 'sel' && !multiSel) scope = 'unit';
  const R = scope === 'sel' ? selR : stackR, n = counts[scope];
  const afford = G.opts.mode === 'sandbox' ? n : Math.min(n, Math.floor(G.money / cost));
  let h = '<div class="spec-box"><div style="color:var(--gold);font-weight:800">Choose a specialty</div>';
  h += '<div class="seg spec-scope">' + [['unit', 'This unit'], ['stack', 'Whole stack (' + counts.stack + ')'], ['sel', 'Selection (' + counts.sel + ')']].map(([id, nm]) =>
    '<button data-act="scope" data-scope="' + id + '"' + (id === scope ? ' class="on"' : '') + (id === 'stack' && g.units.length < 2 ? ' disabled title="This is a single tower"' : id === 'sel' && !multiSel ? ' disabled title="Select more towers first: drag a box, Shift-click, or press Select all"' : '') + '>' + nm + '</button>').join('') + '</div>';
  if (scope === 'unit') h += '<div class="spec-note">Applies to unit ' + (i + 1) + ' only: ' + money$(cost) + '.</div>';
  else h += '<div class="spec-note">Applies to <b>' + n + '</b> unit' + (n === 1 ? '' : 's') + ' ready (level ' + MAX_LEVEL + '): ' + money$(n * cost) + (afford < n ? ' <span style="color:#ff8a80">(you can afford ' + afford + ')</span>' : '') + '. ' + skipNote(R) + '</div>';
  def.specs.forEach((s, si) => {
    if (specHidden(s)) return;
    h += '<button class="btn spec-opt" data-act="spec" data-i="' + i + '" data-s="' + (si + 1) + '" data-scope="' + scope + '"' + (afford < 1 && scope !== 'unit' || (scope === 'unit' && G.money < cost && G.opts.mode !== 'sandbox') ? ' disabled' : '') + '>' + String.fromCharCode(65 + si) + ': ' + s.name + '<small>' + s.desc + '</small></button>';
  });
  return h + '</div>';
}
function singleTowerHTML(g, towers) {
  const def = g.def, k = def.kind;
  let h = '<div class="sp-head"><h3>' + def.name + (g.units.length > 1 ? ' <span style="color:var(--dim)">x' + g.units.length + '</span>' : '') + '</h3><div><button class="btn btn-sm" data-act="info">Codex</button> <button class="btn btn-sm btn-red" data-act="close">&#10005;</button></div></div>';
  const attack = isShooter(def);
  let dps = 0; if (attack) for (const u of g.units) dps += u.stats.dps * g.buff.dmg * g.buff.rate;
  h += '<div class="sp-grid">';
  if (isStructure(def)) {
    h += '<div>Health</div><b>' + Math.ceil(g.hp) + ' / ' + g.maxHp + '</b>';
    if (g.guard < 0.999 || g.bgm < 0.999) h += '<div>Damage taken</div><b>' + Math.round(g.guard * g.bgm * 100) + '%</b>';
    if (g.thorns) h += '<div>Thorns</div><b>' + Math.round(g.thorns * (1 + G.wave * 0.08)) + '/s</b>';
    if (g.boom) h += '<div>Explodes for</div><b>' + fmt(g.boom * (1 + G.wave * 0.15)) + '</b>';
    if (g.shock) h += '<div>Arc damage</div><b>' + Math.round(g.shock * (1 + 0.1 * G.wave)) + '</b>';
    if (g.garrison) h += '<div>Riflemen</div><b>' + (g.squad ? g.squad.filter(t => t.hp > 0).length : 0) + ' / ' + g.garrison + '</b>';
  }
  if (attack) h += '<div>Total DPS</div><b>' + fmt(dps) + '</b><div>Damage dealt</div><b>' + fmt(g.dealt) + '</b><div>Kills</div><b>' + g.kills + '</b><div>Targets</div><b>' + (g.units[0].stats.air === 'only' ? 'Air only' : g.units[0].stats.air === 'yes' ? 'Air + ground' : 'Ground') + '</b>';
  else if (k === 'mine' || k === 'trap') { h += '<div>Damage dealt</div><b>' + fmt(g.dealt) + '</b><div>Kills</div><b>' + g.kills + '</b>'; }
  if (k === 'income') { let inc = 0; g.units.forEach(u => inc += u.stats.income * g.buff.eco); h += '<div>Next payout</div><b style="color:var(--green)">' + money$(inc) + '</b>'; }
  if (k === 'barracks') { const alive = g.squad ? g.squad.filter(t => t.hp > 0).length : 0; h += '<div>Troops</div><b>' + alive + ' / ' + g.units[0].stats.soldiers + '</b><div>Damage dealt</div><b>' + fmt(g.dealt) + '</b><div>Kills</div><b>' + g.kills + '</b>'; if (g.buff.resp > 1) h += '<div>Training speed</div><b style="color:var(--gold)">x' + g.buff.resp.toFixed(1) + '</b>'; }
  if (k === 'hq') { const gd = getHQ(); h += '<div>Squads out</div><b>' + activeSquads() + ' / ' + mercSquadCap(gd) + '</b>'; }
  if (g.buff.range > 1 || g.buff.dmg > 1) h += '<div>Commander</div><b style="color:var(--gold)">+' + Math.round((g.buff.range - 1) * 100) + '% rng, +' + Math.round((g.buff.dmg - 1) * 100) + '% dmg' + (g.buff.rate > 1 ? ', +' + Math.round((g.buff.rate - 1) * 100) + '% rate' : '') + '</b>';
  else if (g.buff.rate > 1) h += '<div>Fire rate bonus</div><b style="color:var(--gold)">+' + Math.round((g.buff.rate - 1) * 100) + '%</b>';
  if (g.buff.eco > 1) h += '<div>Power Plant</div><b style="color:var(--gold)">+' + Math.round((g.buff.eco - 1) * 100) + '% income</b>';
  h += '</div>';
  if (attack && !def.manual) {
    h += '<div style="display:flex;gap:6px;align-items:center;margin:4px 0"><select data-act="target" style="flex:1">' + TARGETING.map(t => '<option value="' + t.id + '"' + (t.id === g.targeting ? ' selected' : '') + (def.air === 'only' && (t.id === 'ground') ? ' disabled' : '') + '>' + t.name + '</option>').join('') + '</select>';
    h += '<label title="Keep shooting the same enemy until it leaves range" style="display:flex;align-items:center;gap:3px;color:var(--dim)"><input type="checkbox" data-act="sticky"' + (g.sticky ? ' checked' : '') + '>Lock</label></div>';
  }
  if (def.manual) { const u0 = g.units[0], mx = u0.stats.mods.charges || 1, ready = u0.stock > 0; h += '<button class="btn btn-gold" style="width:100%;margin:4px 0" data-act="fire"' + (!ready ? ' disabled' : '') + '>' + (ready ? 'FIRE - then click a target' + (mx > 1 ? ' (' + u0.stock + '/' + mx + ' charges)' : '') : 'Recharging ' + Math.ceil(u0.cd / TPS) + 's') + '</button>'; }
  g.units.forEach((u, i) => {
    h += '<div class="unit-row"><div class="ul"><div><b>' + (g.units.length > 1 ? 'Unit ' + (i + 1) : 'Level ' + u.level) + '</b> ';
    if (!def.endless) { h += '<span class="lv">'; for (let l = 1; l <= MAX_LEVEL; l++) h += '<span class="pip' + (l <= u.level ? ' on' : '') + '"></span>'; h += '</span>'; } else h += '<span style="color:var(--gold)">L' + u.level + '</span>';
    if (u.spec && specOf(def, u.spec)) h += ' <span style="color:var(--gold)">&#9733; ' + specOf(def, u.spec).name + '</span>';
    h += '</div><div style="color:var(--dim)">' + unitStatLine(g, u) + '</div></div>';
    const upOk = !(u.maxed || (u.canSpec && !def.endless));
    if (u.canSpec) h += '<button class="btn btn-sm btn-gold" data-act="specopen" data-i="' + i + '">Specialize</button>';
    if (upOk) { const c = u.nextCost; h += '<button class="btn btn-sm btn-green" data-act="up" data-i="' + i + '"' + (G.money < c && G.opts.mode !== 'sandbox' ? ' disabled' : '') + '>Up $' + fmt(c) + '</button>'; }
    else if (!u.canSpec) h += '<span style="color:var(--dim);font-size:11px">MAX</span>';
    h += '</div>';
    if (u.canSpec && specOpen === g.id + ':' + i) h += specBoxHTML(g, i, towers);
  });
  h += '<div class="sp-actions">';
  if (g.units.some(u => !u.maxed && !(u.canSpec && !def.endless))) h += '<button class="btn btn-green" data-act="upall" title="U">Upgrade all</button>';
  if (isStructure(def) && g.hp < g.maxHp) h += '<button class="btn btn-green" data-act="repair">Repair ($' + Math.ceil((g.maxHp - g.hp) / g.maxHp * def.cost * 0.6) + ')</button>';
  if (k !== 'mine') h += '<button class="btn btn-gold" data-act="move" title="M">Move</button>';
  if (k === 'barracks' || g.garrison) h += '<button class="btn btn-blue" data-act="squad">Select troops</button>';
  if (G.towers.filter(o => o.def === def && !o.auto).length > 1) h += '<button class="btn" data-act="selsame" title="Then pick specialties for all of them at once">Select all ' + def.name + '</button>';
  h += '<button class="btn btn-red" data-act="sell" title="S">Sell (+' + money$(g.sellValue) + ')</button></div>';
  return h;
}
function troopName(t) { return t.hero ? t.name + ' (hero, Lv ' + t.lvl + ')' : t.merc ? t.name : t.kind === 'tank' ? 'Tank' : t.owner ? (t.name || 'Troop') : 'Paratrooper'; }
function multiHTML(towers, troops) {
  let h = '<div class="sp-head"><h3>' + (towers.length ? towers.length + ' tower' + (towers.length > 1 ? 's' : '') : '') + (towers.length && troops.length ? ' + ' : '') + (troops.length ? troops.length + ' troop' + (troops.length > 1 ? 's' : '') : '') + '</h3><button class="btn btn-sm btn-red" data-act="close">&#10005;</button></div>';
  if (towers.length) {
    const byType = {}; for (const g of towers) { byType[g.def.name] = (byType[g.def.name] || 0) + g.units.length; }
    h += '<div style="color:var(--dim);margin-bottom:4px">' + Object.entries(byType).map(([n, c]) => c + 'x ' + n).join(', ') + '</div>';
    const attack = towers.filter(g => isShooter(g.def) && !g.def.manual);
    if (attack.length) h += '<select data-act="targetall" style="width:100%;margin:4px 0"><option value="">Set targeting for all...</option>' + TARGETING.map(t => '<option value="' + t.id + '">' + t.name + '</option>').join('') + '</select>';
    // specialties for everything in the selection, grouped by tower type
    const defs = []; for (const g of towers) if (g.def.specs && !defs.includes(g.def)) defs.push(g.def);
    for (const def of defs) {
      const R = eligibleUnits(towers, def), cost = specCost(def), n = R.elig.length;
      const afford = G.opts.mode === 'sandbox' ? n : Math.min(n, Math.floor(G.money / cost));
      h += '<div class="spec-box"><div style="font-weight:800"><span style="color:var(--gold)">&#9733;</span> ' + def.name + ' specialties <span style="color:var(--dim);font-weight:500">(' + R.total + ' unit' + (R.total === 1 ? '' : 's') + ')</span></div>';
      if (!n) h += '<div class="spec-note">None can specialize right now. ' + skipNote(R) + '</div>';
      else {
        h += '<div class="spec-note"><b>' + n + '</b> ready: ' + money$(n * cost) + ' for all' + (afford < n ? ' <span style="color:#ff8a80">(you can afford ' + afford + ')</span>' : '') + '. ' + skipNote(R) + '</div>';
        def.specs.forEach((s, si) => { if (specHidden(s)) return; h += '<button class="btn spec-opt" data-act="specsel" data-def="' + def.id + '" data-s="' + (si + 1) + '"' + (afford < 1 ? ' disabled' : '') + '>' + String.fromCharCode(65 + si) + ': ' + s.name + ' on ' + afford + '<small>' + s.desc + '</small></button>'; });
      }
      h += '</div>';
    }
  }
  if (troops.length) {
    let hp = 0, max = 0, minLife = 1e9; const names = {};
    for (const t of troops) { hp += t.hp; max += t.maxHp; const n = troopName(t); names[n] = (names[n] || 0) + 1; if (t.life > 0) minLife = Math.min(minLife, t.life); }
    h += '<div style="color:var(--dim);margin-bottom:4px">' + Object.entries(names).map(([n, c]) => c + 'x ' + n).join(', ') + '</div>';
    h += '<div class="sp-grid"><div>Troop health</div><b>' + Math.ceil(hp) + ' / ' + Math.ceil(max) + '</b>' + (minLife < 1e9 ? '<div>Time left</div><b>' + Math.ceil(minLife / TPS) + 's</b>' : '') + '</div><p style="color:var(--dim);margin:4px 0">Right-click the map to move them, or press Move. Mercenaries leave when their time runs out.</p>';
  }
  const value = towers.reduce((s, g) => s + g.sellValue, 0);
  h += '<div class="sp-actions">';
  if (towers.length) {
    let nxt = 0, cnt = 0; for (const g of towers) g.units.forEach(u => { if (!u.maxed && !(u.canSpec && !u.def.endless)) { nxt += u.nextCost; cnt++; } });
    h += '<button class="btn btn-green" data-act="upall" title="Spends your money on the cheapest upgrades first. Next level for all: ' + money$(nxt) + '">Upgrade all' + (cnt ? ' (' + cnt + ' ready, next level ' + money$(nxt) + ')' : '') + '</button>';
    if (towers.some(g => isStructure(g.def) && g.hp < g.maxHp)) h += '<button class="btn btn-green" data-act="repairall">Repair all</button>';
  }
  h += '<button class="btn btn-gold" data-act="move">Move' + (towers.length > 1 || troops.length > 1 ? ' group' : '') + '</button>';
  if (troops.some(t => t.owner && t.owner.def.kind === 'barracks')) h += '<button class="btn btn-blue" data-act="home">Back to barracks</button>';
  if (towers.length) h += '<button class="btn btn-red" data-act="sell">Sell all (+' + money$(value) + ')</button>';
  h += '</div>';
  return h;
}
function bindPanel(towers, troops) {
  const P = $('selpanel');
  P.querySelectorAll('[data-act]').forEach(el => {
    const act = el.dataset.act, i = +el.dataset.i;
    const handler = () => {
      const g = towers[0];
      if (act === 'close') deselectAll();
      else if (act === 'info') openCodex('towers', g.def.id);
      else if (act === 'repair') repairFence(g);
      else if (act === 'repairall') repairAll(towers);
      else if (act === 'up') { upgradeUnit(g, i); refreshSelection(true); updateHUD(true); }
      else if (act === 'upall') upgradeGroups(towers);
      else if (act === 'specopen') { specOpen = specOpen === g.id + ':' + i ? null : g.id + ':' + i; specScope = null; refreshSelection(true); }
      else if (act === 'scope') { specScope = el.dataset.scope; refreshSelection(true); }
      else if (act === 'spec') {
        const sc = el.dataset.scope, s = +el.dataset.s;
        const list = sc === 'unit' ? [[g, i]] : sc === 'stack' ? eligibleUnits([g], g.def).elig : eligibleUnits(towers, g.def).elig;
        applySpec(list, s);
      }
      else if (act === 'specsel') { applySpec(eligibleUnits(towers, TOWER[el.dataset.def]).elig, +el.dataset.s); }
      else if (act === 'selsame') selectAllOfType(g);
      else if (act === 'move') startMove();
      else if (act === 'sell') sellGroups(towers);
      else if (act === 'fire') { G.aim = g; syncAimPanel(); toast('Click where to fire (Esc cancels)', '#ff5252'); }
      else if (act === 'hab') armHero(i);
      else if (act === 'herocodex') openCodex('heroes', G.heroId);
      else if (act === 'squad') { G.sel.towers.clear(); (g.squad || []).filter(t => t.hp > 0).forEach(t => G.sel.troops.add(t)); refreshSelection(true); }
      else if (act === 'home') { for (const t of troops) if (t.owner && t.owner.def.kind === 'barracks') { const o = t.owner; o.rally = null; t.order = null; t.holding = false; } troops.forEach(t => { if (t.owner && t.owner.def.kind === 'barracks') { const st = t.owner.units[0].stats; const np = nearestPathPoint(G, t.owner.x, t.owner.y); t.owner.rally = np && np.d < st.range ? { x: np.x, y: np.y } : { x: t.owner.x, y: t.owner.y + 30 }; const idx = t.owner.squad.indexOf(t), f = formationOffset(idx, t.owner.squad.length); t.order = { x: t.owner.rally.x + f.x, y: t.owner.rally.y + f.y }; } }); }
    };
    if (el.tagName === 'SELECT') el.addEventListener('change', () => {
      if (act === 'target') { towers[0].targeting = el.value; towers[0].target = null; }
      if (act === 'targetall' && el.value) { towers.forEach(g => { if (!g.def.manual && isShooter(g.def)) g.targeting = el.value; }); toast('Targeting set for ' + towers.length + ' towers'); }
      el.blur(); refreshSelection(true);
    });
    else if (el.type === 'checkbox') el.addEventListener('change', () => { towers[0].sticky = el.checked; });
    else el.addEventListener('click', handler);
  });
}

// =====================================================================
//  TOOLTIP ON THE BOARD
// =====================================================================
function updateHoverTooltip() {
  const tt = $('tooltip');
  if (!G || !mouse.in || drag.box || G.place || G.moveMode) { hover.tower = hover.enemy = hover.troop = null; if (!document.querySelector('#shop .tcard:hover')) tt.classList.add('hidden'); return; }
  const x = mouse.wx, y = mouse.wy;
  hover.enemy = enemyAt(x, y); hover.tower = hover.enemy ? null : towerAt(x, y); hover.troop = (hover.enemy || hover.tower) ? null : troopAt(x, y);
  let h = '';
  if (hover.enemy) {
    const e = hover.enemy, d = e.def;
    h = '<div class="tt-title">' + (e.affix ? '<span style="color:' + e.affix.color + '">' + e.affix.name + '</span> ' : '') + d.name + '</div>';
    h += '<div>Health <b>' + fmt(Math.max(0, e.hp)) + ' / ' + fmt(e.maxHp) + '</b>' + (e.maxShield ? ' &middot; Shield <b>' + fmt(e.shield) + '</b>' : '') + '</div>';
    if (e.maxBarrier > 0) h += '<div style="color:#84ffff">' + (e.barrier > 0 ? 'Barrier <b>' + fmt(e.barrier) + '</b> (blocks all damage until broken)' : 'Barrier DOWN: back in ' + Math.ceil(e.barrierDownT / TPS) + 's') + '</div>';
    if (e.charmT > 0) h += '<div style="color:#ea80fc">Mind-controlled for ' + Math.ceil(e.charmT / TPS) + 's</div>';
    if (e.rallyT > 0) h += '<div style="color:#ff8a65">Rallied by a Warlord: 25% faster, takes 30% less damage</div>';
    h += '<div>' + (e.armor ? 'Armor <b>' + e.armor.toFixed(1) + '</b> &middot; ' : '') + 'Speed <b>' + (e.speed * 60).toFixed(0) + '</b> &middot; Pays <b>$' + Math.round(e.reward) + '</b></div>';
    h += '<div style="color:var(--dim)">' + d.desc + (e.affix ? ' ' + e.affix.name + ': ' + e.affix.desc + '.' : '') + '</div>';
  } else if (hover.tower && !G.sel.towers.has(hover.tower)) {
    const g = hover.tower; let dps = 0; g.units.forEach(u => dps += u.stats.dps * g.buff.dmg);
    h = '<div class="tt-title">' + g.def.name + (g.units.length > 1 ? ' x' + g.units.length : '') + ' &middot; L' + g.level + '</div>';
    if (g.disabledT > 0) h += '<div style="color:' + (g.dsc === '#40c4ff' ? '#40c4ff">Jammed by an EMP pulse' : '#b2ff59">Knocked out by a saucer') + ' for ' + Math.ceil(g.disabledT / TPS) + 's</div>';
    if (isStructure(g.def)) h += '<div>Health ' + Math.ceil(g.hp) + ' / ' + g.maxHp + '</div>';
    else if (g.def.manual) h += '<div>' + (g.units[0].stock > 0 ? 'Ready to fire' : 'Recharging') + '</div>';
    else if (dps > 0 && g.def.kind !== 'heal') h += '<div>DPS <b>' + fmt(dps) + '</b> &middot; dealt <b>' + fmt(g.dealt) + '</b> &middot; ' + g.kills + ' kills</div>';
    h += '<div style="color:var(--dim)">Click to select</div>';
  } else if (hover.troop) {
    const t = hover.troop; h = '<div class="tt-title">' + troopName(t) + (t.merc ? ' <span class="tag sup">HIRED</span>' : '') + '</div><div>Health ' + Math.ceil(t.hp) + ' / ' + Math.ceil(t.maxHp) + ' &middot; Damage ' + Math.round(t.dmg * t.bd) + '</div>' + (t.life > 0 ? '<div>Time left ' + Math.ceil(t.life / TPS) + 's</div>' : '') + '<div style="color:var(--dim)">Click (or drag a box) to select, right-click to move</div>';
  }
  if (!h) { tt.classList.add('hidden'); return; }
  tt.innerHTML = h; tt.classList.remove('hidden');
  const sr = $('stage').getBoundingClientRect();
  tt.style.left = Math.min(sr.width - tt.offsetWidth - 6, mouse.sx + 16) + 'px'; tt.style.top = Math.min(sr.height - tt.offsetHeight - 6, mouse.sy + 16) + 'px';
}

// =====================================================================
//  CODEX
// =====================================================================
let codexTab = 'towers', codexSel = null;
function openCodex(tab, id) { codexTab = tab || codexTab; codexSel = id || null; openModal('codex'); renderCodex(); }
function codexItem(list, icon, name, on, fn) { const b = document.createElement('button'); b.className = 'btn codex-item' + (on ? ' on' : ''); b.appendChild(icon); const s = document.createElement('span'); s.textContent = name; b.appendChild(s); b.onclick = fn; list.appendChild(b); }
function trainedAt(key) { return TOWERS.filter(t => t.troop === key); }
function renderCodex() {
  const tabs = [['towers', 'Towers & Structures'], ['heroes', 'Heroes'], ['troops', 'Troops'], ['mercs', 'Contractors'], ['enemies', 'Enemies'], ['affixes', 'Variants'], ['guide', 'How to play'], ['news', "What's new"]];
  $('codex-tabs').innerHTML = tabs.map(([k, n]) => '<button class="tab' + (k === codexTab ? ' on' : '') + '" data-ct="' + k + '">' + n + '</button>').join('');
  $('codex-tabs').querySelectorAll('[data-ct]').forEach(b => b.onclick = () => { codexTab = b.dataset.ct; codexSel = null; renderCodex(); });
  const list = $('codex-list'), det = $('codex-detail'); list.innerHTML = ''; det.innerHTML = '';
  list.parentElement.style.gridTemplateColumns = (codexTab === 'guide' || codexTab === 'affixes' || codexTab === 'news') ? '1fr' : '';
  setTimeout(() => { const on = list.querySelector('.codex-item.on'); if (on && on.scrollIntoView) { try { on.scrollIntoView({ block: 'nearest' }); } catch (e) {} } }, 0);
  if (codexTab === 'towers') {
    if (!codexSel || !TOWER[codexSel]) codexSel = TOWERS[0].id;
    for (const tab of ['Attack', 'Support', 'Troops', 'Defense', 'Alien']) {
      const gl = document.createElement('div'); gl.className = 'grp'; gl.textContent = (tab === 'Alien' ? 'ALIEN TECH' : tab.toUpperCase()) + (tab === 'Attack' ? '  (TOWER MODE)' : tab === 'Troops' ? '  (TROOP MODE)' : tab === 'Alien' ? '  (FROM WAVE 10)' : '  (BOTH MODES)'); list.appendChild(gl);
      TOWERS.filter(t => t.tab === tab).forEach(def => codexItem(list, towerIcon(def, 22), def.name, def.id === codexSel, () => { codexSel = def.id; renderCodex(); }));
    }
    det.innerHTML = towerDetailHTML(TOWER[codexSel]); const h3 = det.querySelector('h3'); if (h3) h3.prepend(towerIcon(TOWER[codexSel], 40));
  } else if (codexTab === 'heroes') {
    if (!codexSel || !HERO[codexSel]) codexSel = HEROES[0].id;
    for (const era of ERA_ORDER) { const H = HEROES.find(x => x.era === era); if (H) codexItem(list, troopIcon(H.look, H.color, 22), H.name, H.id === codexSel, () => { codexSel = H.id; renderCodex(); }); }
    det.innerHTML = heroDetailHTML(HERO[codexSel]); const h3 = det.querySelector('h3'); if (h3) h3.prepend(troopIcon(HERO[codexSel].look, HERO[codexSel].color, 40));
  } else if (codexTab === 'troops') {
    const keys = Object.keys(TROOP_TYPES);
    if (!codexSel || !TROOP_TYPES[codexSel]) codexSel = keys[0];
    keys.forEach(k => codexItem(list, troopIcon(TROOP_TYPES[k].look, TROOP_TYPES[k].color, 22), TROOP_TYPES[k].name, k === codexSel, () => { codexSel = k; renderCodex(); }));
    det.innerHTML = troopDetailHTML(codexSel); const h3 = det.querySelector('h3'); if (h3) h3.prepend(troopIcon(TROOP_TYPES[codexSel].look, TROOP_TYPES[codexSel].color, 40));
  } else if (codexTab === 'mercs') {
    if (!codexSel || !MERC[codexSel]) codexSel = MERCS[0].id;
    MERCS.forEach(m => codexItem(list, troopIcon(m.look, m.color, 22), m.name, m.id === codexSel, () => { codexSel = m.id; renderCodex(); }));
    det.innerHTML = mercDetailHTML(MERC[codexSel]); const h3 = det.querySelector('h3'); if (h3) h3.prepend(troopIcon(MERC[codexSel].look, MERC[codexSel].color, 40));
  } else if (codexTab === 'enemies') {
    if (!codexSel || !ENEMY[codexSel]) codexSel = ENEMIES[0].id;
    ENEMIES.forEach(def => codexItem(list, enemyIcon(def, 22), def.name, def.id === codexSel, () => { codexSel = def.id; renderCodex(); }));
    const d = ENEMY[codexSel];
    const abil = [];
    if (d.alien) abil.push('Alien'); if (d.barrier) abil.push('Alien barrier (blocks all damage until broken)'); if (d.warp) abil.push('Warps ahead'); if (d.splits) abil.push('Splits in two'); if (d.abduct) abil.push('Knocks out towers'); if (d.projector) abil.push('Gives barriers to allies'); if (d.berserk) abil.push('Berserk when its barrier breaks');
    if (d.air) abil.push('Flying'); if (d.armor) abil.push('Armor ' + d.armor + ' (grows with waves)'); if (d.shield) abil.push('Energy shield'); if (d.stealth) abil.push('Stealth (cloaked)'); if (d.noSlow) abil.push('Immune to slow and freeze'); if (d.dodge) abil.push('Takes cover from bullets'); if (d.split) abil.push('Unloads troops'); if (d.heal) abil.push('Heals allies'); if (d.regen) abil.push('Nanite repair'); if (d.summon) { const sn = ENEMY[d.summon] ? ENEMY[d.summon].name : 'drones'; abil.push('Launches ' + (/s$/.test(sn) ? sn : sn + 's')); } if (d.burrow) abil.push('Burrows'); if (d.enrage) abil.push('All-out charge'); if (d.blink) abil.push('Teleports'); if (d.shred) abil.push('Shreds walls');
    if (d.steam) abil.push('Full Steam: charges through walls and troops'); if (d.stomp) abil.push('War Stomp: stuns troops, wrecks walls'); if (d.jammer) abil.push('EMP pulse: knocks out towers'); if (d.factory) abil.push('Rolls out escorts and tanks'); if (d.aegis) abil.push('Regenerating shield'); if (d.warlord) abil.push('Buffs and heals nearby enemies');
    if (d.boss) abil.push(BOSS_ROTATION.includes(d.id) ? 'Boss wave boss' : 'Boss');
    const bi = BOSS_ROTATION.indexOf(d.id), bk = d.boss ? (getBossKills()[d.id] || 0) : 0;
    det.innerHTML = '<h3>' + d.name + '</h3><p>' + d.desc + '</p><div>' + abil.map(a => '<span class="tag">' + a + '</span>').join('') + '</div>' +
      '<table class="stats"><tr><th>Stat</th><th>Wave 1</th><th>Wave 25</th><th>Wave 50</th><th>Wave 100</th></tr>' +
      '<tr><td>Health</td>' + [1, 25, 50, 100].map(w => '<td>' + fmt(d.hp * Math.pow(waveMult(w), d.boss ? 1.3 : 1)) + '</td>').join('') + '</tr>' +
      '<tr><td>Speed</td><td colspan="4" style="text-align:left">' + (d.speed * 60).toFixed(0) + ' units/s (normal enemies speed up a little each wave)</td></tr>' +
      '<tr><td>Reward</td><td colspan="4" style="text-align:left">$' + d.reward + '</td></tr><tr><td>Damage to base</td><td colspan="4" style="text-align:left">' + d.dmg + '</td></tr>' +
      '<tr><td>First seen</td><td colspan="4" style="text-align:left">' + (d.wave >= 999 ? (d.id === 'boss' ? 'Every 5th wave' : bi >= 0 ? 'Boss waves ' + [1, 2, 3].map(k => (bi + 1) * 10 + (k - 1) * 60).join(', ') + '... in Classic and Endless (Campaign maps and the Daily Challenge shuffle the order)' : d.id === 'mothership' ? 'Waves 35, 55, 75...' : 'Unloaded by Troop Trucks') : 'Wave ' + d.wave) + '</td></tr>' + (d.boss ? '<tr><td>You defeated it</td><td colspan="4" style="text-align:left">' + (bk ? bk + ' time' + (bk === 1 ? '' : 's') : 'not yet') + '</td></tr>' : '') + (d.barrier ? '<tr><td>Barrier</td>' + [1, 25, 50, 100].map(w => '<td>' + fmt(d.barrier * Math.pow(waveMult(w), d.boss ? 1.3 : 1)) + '</td>').join('') + '</tr>' : '') + '</table><p style="color:var(--dim);font-size:12px">Health shown for Normal difficulty. Every enemy also rolls a little random size, health and speed, so no two are identical.</p>';
    const h3 = det.querySelector('h3'); if (h3) h3.prepend(enemyIcon(d, 40));
  } else if (codexTab === 'affixes') {
    det.innerHTML = '<p>From wave 7 onward some enemies spawn with a random <b>variant</b> (shown as a colored ring). The chance grows every wave, up to 45%. Hover an enemy to see its variant.</p>' + AFFIXES.map(a => '<div class="ach got"><div class="ico" style="color:' + a.color + ';border:2px solid ' + a.color + '">&#9679;</div><div><b style="color:' + a.color + '">' + a.name + '</b><div style="color:var(--dim)">' + a.desc + '</div></div></div>').join('');
  } else if (codexTab === 'news') {
    det.innerHTML = newsHTML();
  } else {
    det.innerHTML = guideHTML(); det.querySelectorAll('[data-gg]').forEach(b => b.onclick = () => { guideMode = b.dataset.gg; renderCodex(); });
  }
}
function specCards(def) {
  const k = def.kind; let h = '<div class="section-title" style="margin-top:10px">Specialties (level 5, ' + money$(specCost(def)) + ' each)</div><p style="color:var(--dim);font-size:12px;margin:2px 0">Pick one per unit. You can apply it to one unit, a whole stack, or every ready unit in your selection.</p>';
  def.specs.forEach((s, i) => {
    const st = levelStats(def, MAX_LEVEL, i + 1); let extra = '';
    if (k === 'barracks') { const T = TROOP_TYPES[def.troop]; const tx = s.mods.tx || {}, ts = s.mods.ts || {}; extra = 'At level 5: ' + st.soldiers + ' x ' + ((ts.role && ts.role !== T.role) ? ts.role : T.role) + ', ' + st.troopHp + ' hp, ' + st.troopDmg + ' dmg'; }
    else if (isStructure(def)) extra = 'At level 5: ' + st.hp + ' health';
    else if (isShooter(def) && st.dps) extra = 'Damage ' + fmt(st.damage) + (st.shots > 1 ? ' x' + st.shots : '') + ', range ' + st.range + ', ' + (60 / st.rate).toFixed(2) + ' shots/s';
    else if (k === 'aura') extra = 'At level 5: range ' + st.range + ', ' + auraEffect(def, 5, st.mods);
    else if (k === 'income') extra = 'At level 5: pays ' + money$(st.income);
    else if (k === 'heal') extra = 'At level 5: heals ' + st.damage + '/s, range ' + st.range;
    else if (k === 'hq') extra = 'At level 5: ' + auraHQ(5, s.mods);
    h += '<div class="spec-card"><b style="color:var(--gold)">' + String.fromCharCode(65 + i) + ': ' + s.name + '</b> &mdash; ' + s.desc + (extra ? '<div style="color:var(--dim)">' + extra + '</div>' : '') + '</div>';
  });
  return h;
}
function auraHQ(L, m) { m = m || {}; return 'prices -' + Math.round((1 - (1 - 0.04 * L) * (m.mcost || 1)) * 100) + '%, cooldowns -' + Math.round((1 - (1 - 0.05 * L) * (m.mcd || 1)) * 100) + '%, ' + (3 + Math.floor(L / 2) + (m.mcap || 0)) + ' squads'; }
function heroDetailHTML(H) {
  let h = '<h3>' + H.name + '</h3><div>' + eraTag(H.era) + '<span class="tag sup">HERO</span><span class="tag" style="background:#2c3e50;color:#fff">BOTH MODES</span></div><p><b>' + H.title + '.</b> ' + H.desc + '</p><p style="color:var(--dim)">' + heroRoleLine(H) + '</p>';
  H.abil.forEach((A, i) => { h += '<div class="spec-card"><b style="color:var(--gold)">' + (i ? 'X' : 'Z') + ': ' + A.name + '</b> (' + A.cd + 's cooldown' + (i ? ', unlocks at hero level ' + HERO_ABIL2_LV : '') + ') &mdash; ' + A.desc + '</div>'; });
  h += '<table class="stats"><tr><th>Level</th><th>XP to next</th><th>Health</th><th>Damage</th><th>Ability power</th></tr>' + [1, 2, 3, 5, 7, 10].map(L => '<tr><td>' + L + '</td><td>' + (L < HERO_MAX ? heroXpNeed(L) : '-') + '</td><td>' + Math.round(H.hp * (1 + 0.15 * (L - 1))) + '</td><td>' + Math.round(H.dmg * (1 + 0.2 * (L - 1))) + '</td><td>x' + (1 + 0.15 * (L - 1)).toFixed(2) + '</td></tr>').join('') + '</table>';
  h += '<p style="color:var(--dim);font-size:12px">One hero per game. Pick it from the hero bar under the shop and click near the road; it costs ' + money$(HERO_COST) + '. Select it (click it, or press V) and right-click to move it. It earns XP equal to the bounty of every enemy it kills (bosses double), and 30% of that for enemies that die near it. On top of its level, health, damage and ability power grow every wave (' + '12% per wave in Tower Mode, 45% in Troop Mode). If it falls, it returns after ' + HERO_RESPAWN + ' seconds.</p>';
  return h;
}
function modeBadge(gm) { return gm === 'tower' ? '<span class="tag" style="background:#1f4e79;color:#fff">TOWER MODE ONLY</span>' : gm === 'troop' ? '<span class="tag" style="background:#7b241c;color:#fff">TROOP MODE ONLY</span>' : '<span class="tag" style="background:#2c3e50;color:#fff">BOTH MODES</span>'; }
function towerDetailHTML(def) {
  const k = def.kind;
  let h = '<h3>' + def.name + '</h3><div>' + modeBadge(def.gm) + eraTag(def.era) + tagsHTML(def) + '</div><p>' + def.desc + '</p>' + (def.wave ? '<p style="color:#b2ff59;font-size:12px">Alien tech: unlocks at wave ' + def.wave + ' (always open in Sandbox).</p>' : '');
  h += '<div class="sp-grid" style="max-width:420px"><div>Cost</div><b>$' + def.cost + '</b><div>Limit</div><b>' + (def.super ? '1 (one super total)' : def.limit + ' (x difficulty)') + '</b>' + (def.hp ? '<div>Health</div><b>' + def.hp + '</b>' : '') + (def.minRange ? '<div>Dead zone</div><b>' + def.minRange + '</b>' : '') + '</div>';
  if (k === 'tank') { h += '<p>Health 1000 (+6% per wave), shoots for 40 damage (+10% per wave) twice a second, range 130. Not upgradeable: deploy more instead.</p>'; return h; }
  const rows = [];
  for (let L = 1; L <= MAX_LEVEL; L++) rows.push([L, levelStats(def, L, 0), L > 1 ? upgradeCost(def, L - 1) : def.cost]);
  const tbl = (head, body) => '<table class="stats"><tr><th>Level</th>' + head.map(x => '<th>' + x + '</th>').join('') + '<th>Cost</th></tr>' + body + '</table>';
  if (k === 'income') {
    h += '<table class="stats"><tr><th>Level</th><th>Pays / wave</th><th>Upgrade cost</th></tr>' + rows.map(([L, s, c]) => '<tr><td>' + L + '</td><td>$' + s.income + '</td><td>' + (L > 1 ? '$' + c : '-') + '</td></tr>').join('') + '<tr><td>6+</td><td colspan="2" style="text-align:left">+$' + Math.floor(def.income * 0.5) + ' per level, forever</td></tr></table>';
  } else if (k === 'aura') {
    h += tbl(['Range', 'Effect'], rows.map(([L, s, c]) => '<tr><td>' + L + '</td><td>' + s.range + '</td><td style="text-align:left">' + auraEffect(def, L) + '</td><td>$' + c + '</td></tr>').join(''));
  } else if (k === 'heal') {
    h += tbl(['Range', 'Heal/s'], rows.map(([L, s, c]) => '<tr><td>' + L + '</td><td>' + s.range + '</td><td>' + s.damage + '</td><td>$' + c + '</td></tr>').join(''));
  } else if (k === 'barracks') {
    const T = TROOP_TYPES[def.troop];
    h += '<p><b>Trains:</b> ' + T.name + ' (' + T.role + '). ' + T.desc + '</p>';
    h += tbl(['Rally range', 'Troops', 'Health', 'Damage', 'Replace'], rows.map(([L, s, c]) => '<tr><td>' + L + '</td><td>' + s.range + '</td><td>' + s.soldiers + '</td><td>' + s.troopHp + '</td><td>' + s.troopDmg + '</td><td>' + (s.respawn / 60).toFixed(0) + 's</td><td>$' + c + '</td></tr>').join(''));
    h += '<p style="color:var(--dim);font-size:12px">Troop health grows 3% and damage 5% for every wave, so a barracks keeps up. Right-click moves selected troops; they hold wherever you send them.</p>';
  } else if (k === 'hq') {
    h += tbl(['Hire price', 'Cooldown', 'Squads', 'Unlocks early'], rows.map(([L, s, c]) => '<tr><td>' + L + '</td><td>-' + 4 * L + '%</td><td>-' + 5 * L + '%</td><td>' + (3 + Math.floor(L / 2)) + '</td><td style="text-align:left">' + (MERCS.filter(m => m.hq === L).map(m => m.name).join(', ') || '-') + '</td><td>$' + c + '</td></tr>').join(''));
    h += '<p style="color:var(--dim);font-size:12px">Only one HQ can exist. It works anywhere on the map. Without an HQ you start with 3 squad slots and mercenaries unlock by wave.</p>';
  } else if (k === 'mind') {
    h += tbl(['Range', 'Control time', 'Every'], rows.map(([L, s, c]) => '<tr><td>' + L + '</td><td>' + s.range + '</td><td>' + ((240 + 30 * (L - 1)) / 60).toFixed(1) + 's</td><td>' + (s.rate / 60).toFixed(1) + 's</td><td>$' + c + '</td></tr>').join(''));
  } else if (k === 'fence' || k === 'trap') {
    h += tbl(['Health', 'Damage taken'].concat(k === 'trap' ? [def.trap === 'spikes' ? 'Dmg/hit' : def.trap === 'stasis' ? 'Stasis' : 'Slow', 'Radius'] : (def.shoots ? ['Damage', 'Range'] : [])), rows.map(([L, s, c]) => '<tr><td>' + L + '</td><td>' + s.hp + '</td><td>' + Math.round(s.guard * 100) + '%</td>' + (k === 'trap' ? '<td>' + (def.trap === 'spikes' ? s.damage : def.trap === 'stasis' ? (1 + 0.15 * (L - 1)).toFixed(2) + 's' : Math.round(def.slow * 100) + '%') + '</td><td>' + s.range + '</td>' : def.shoots ? '<td>' + s.damage + '</td><td>' + s.range + '</td>' : '') + '<td>$' + c + '</td></tr>').join(''));
    h += '<p style="color:var(--dim);font-size:12px">' + (k === 'fence' ? 'Walls only go on the road. Ground enemies stop and attack them until they fall (flyers ignore them). The longer an enemy is stuck, the harder it chews, so a wall can never hold the road forever. Mechanic Bays, Engineers and Medics repair them; you can also repair for gold.' : 'Traps go on the road but do not block. They wear out as enemies cross, so repair them (Mechanic Bay, Engineers, Medics, or gold).') + '</p>';
  } else if (k === 'mine') {
    h += tbl(['Damage (wave 1)', 'Blast'], rows.map(([L, s, c]) => '<tr><td>' + L + '</td><td>' + Math.round(s.damage * 1.15) + '</td><td>' + s.aoe + '</td><td>$' + c + '</td></tr>').join(''));
    h += '<p style="color:var(--dim);font-size:12px">Damage also grows 15% for every wave.</p>';
  } else {
    h += '<table class="stats"><tr><th>Level</th><th>Damage</th><th>Range</th><th>Shots/s</th>' + (def.aoe ? '<th>Blast</th>' : '') + '<th>DPS</th><th>Cost</th></tr>' +
      rows.map(([L, s, c]) => '<tr><td>' + L + '</td><td>' + fmt(s.damage) + '</td><td>' + s.range + '</td><td>' + (60 / s.rate).toFixed(2) + '</td>' + (def.aoe ? '<td>' + s.aoe + '</td>' : '') + '<td>' + fmt(s.dps) + '</td><td>$' + fmt(c) + '</td></tr>').join('') + '</table>';
    if (def.kind === 'beam' && def.ramp) h += '<p style="color:var(--dim);font-size:12px">DPS shown is the cold value. The beam heats up to 4x on one target.</p>';
  }
  if (def.specs) h += specCards(def);
  return h;
}
function troopDetailHTML(key) {
  const T = TROOP_TYPES[key], at = trainedAt(key);
  const roleText = { melee: 'Close combat: walks up to an enemy and holds it in place.', ranged: 'Ranged: shoots from where it stands.', aoe: 'Area fire: grenades, flames and EMP pulses that hit a whole group.', artillery: 'Artillery: lobbed or piercing shells from far away.', medic: 'Support: heals the most wounded ally, returns fire otherwise.', engineer: 'Builder: plants mines, repairs, builds defenses.', sentry: 'Sentry gun: stationary, short-lived.', tank: 'Vehicle: drives the road, shooting and ramming.' };
  let h = '<h3>' + T.name + '</h3><div>' + modeBadge('troop') + '<span class="tag">' + T.role + '</span>' + (T.hitsAir ? '<span class="tag air">Hits air</span>' : '') + (T.fixed ? '<span class="tag">Stationary</span>' : '') + '</div><p>' + T.desc + '</p><p>' + (roleText[T.role] || '') + '</p>';
  h += '<div class="sp-grid" style="max-width:420px"><div>Speed</div><b>' + (T.speed * 60).toFixed(0) + ' units/s</b>' + (T.role === 'melee' ? '<div>Search radius</div><b>' + T.leash + '</b>' : '<div>Range</div><b>' + T.range + '</b>') + '<div>Attack every</div><b>' + (T.rate / 60).toFixed(2) + 's</b>' + (T.armor ? '<div>Armor</div><b>' + T.armor + '</b>' : '') + (T.aoe ? '<div>Blast</div><b>' + T.aoe + '</b>' : '') + '</div>';
  if (at.length) {
    h += '<div class="section-title" style="margin-top:10px">Trained at</div>';
    for (const d of at) {
      h += '<p><b>' + d.name + '</b> ($' + d.cost + '): ' + [1, 3, 5].map(L => { const s = levelStats(d, L, 0); return 'L' + L + ' ' + s.soldiers + 'x ' + s.troopHp + 'hp/' + s.troopDmg + 'dmg'; }).join(' &middot; ') + '</p>';
      h += d.specs.map((s, i) => '<div class="spec-card"><b style="color:var(--gold)">' + String.fromCharCode(65 + i) + ': ' + s.name + '</b> &mdash; ' + s.desc + '</div>').join('');
    }
  } else h += '<p style="color:var(--dim)">' + (key === 'sentry' ? 'Built automatically by Engineers from the Sentry Gun Crews specialty.' : 'Deployed from the Troops tab.') + '</p>';
  return h;
}
function mercDetailHTML(m) {
  const tags = []; if (m.hitsAir) tags.push('Hits air'); if (m.aoe || m.cleave) tags.push('Area damage'); if (m.hunt) tags.push('Hunts the strongest'); if (m.lifesteal) tags.push('Lifesteal'); if (m.medAura) tags.push('Heals allies'); if (m.pierceArmor) tags.push('Ignores armor'); if (m.crit) tags.push('Crits'); if (m.dodge) tags.push('Dodges'); if (m.burn) tags.push('Burns'); if (m.frenzy) tags.push('Frenzy'); if (m.stun) tags.push('Stuns');
  let h = '<h3>' + m.name + '</h3><div>' + modeBadge('troop') + '<span class="tag">' + m.role + '</span>' + tags.map(x => '<span class="tag">' + x + '</span>').join('') + '</div><p>' + m.desc + '</p>';
  h += '<div class="sp-grid" style="max-width:440px"><div>Squad</div><b>' + m.n + ' unit' + (m.n > 1 ? 's' : '') + '</b><div>Stays for</div><b>' + m.life + 's</b><div>Cooldown</div><b>' + m.cd + 's</b><div>Unlocks</div><b>Wave ' + m.wave + (m.hq ? ' or HQ L' + m.hq : '') + '</b>' + (m.armor ? '<div>Armor</div><b>' + m.armor + '</b>' : '') + '<div>Range</div><b>' + (m.role === 'melee' ? 'Melee' : m.range) + '</b></div>';
  h += '<table class="stats"><tr><th>At wave</th><th>Price</th><th>Health each</th><th>Damage each</th></tr>' + [1, 25, 50, 100].map(w => '<tr><td>' + w + '</td><td>$' + fmt(mercCostAt(m, w)) + '</td><td>' + fmt(m.hp * mercScale(w)) + '</td><td>' + fmt(m.dmg * mercScale(w)) + '</td></tr>').join('') + '</table>';
  h += '<p style="color:var(--dim);font-size:12px">Hire from the Mercs tab, then click near the road (within about 90 units of it). Mercenaries can be selected and moved like troops. Prices and stats grow with the wave. A Contractor HQ lowers prices and cooldowns, adds squad slots, and unlocks this unit early (HQ level ' + (m.hq || 'none needed') + ').</p>';
  return h;
}
const tipList = () => curGM() === 'tower' ? TIPS_TOWER : curGM() === 'troop' ? TIPS_TROOP : TIPS;
let guideMode = null;
function guideHTML() {
  const gmx = guideMode || (G && G.gm !== 'legacy' ? G.gm : menuPrefs.gm) || 'tower';
  const sw = '<div class="seg" style="margin-bottom:10px">' + PICKABLE_MODES.map(k => '<button data-gg="' + k + '"' + (k === gmx ? ' class="on"' : '') + '>' + GAME_MODES[k].name + '</button>').join('') + '</div>';
  return sw + (gmx === 'troop' ? guideTroop() : guideTower());
}
function guideTower() {
  return '<p><b>Tower Mode.</b> You build the defense out of towers. There are no soldiers, barracks or contractors in this mode.</p>' +
  '<p><b>Goal.</b> Enemy columns advance along the road toward your base. Each one that gets through takes health off your base. Hold a map for 40 waves (Campaign), survive 100 waves (Classic) or go as long as you can (Endless). The war runs from 1900 onward: trench-era guns and tanks, modern armies, and near-future sci-fi (energy weapons, cryo, shields, robots and mechs).</p>' + GUIDE_CAMPAIGN +
  '<p><b>Building.</b> Pick something in the shop (or press 1 to 9) and click the map. The shop has three tabs: Attack, Support and Defense. Click an existing tower of the same type to <b>stack</b> another one onto it.</p>' +
  '<p><b>Selecting.</b> Click a tower, or drag a box to select a group. <kbd>Shift</kbd> adds to the selection, double-click grabs every tower of the same type. Esc, right-click empty ground, or the Deselect button clears it.</p>' +
  '<p><b>Upgrades and specialties.</b> Almost everything goes to level 5, then you <b>specialize</b> it into one of 2 to 4 paths. Choose for one unit, a whole stack, or your whole selection. Farms and Factories upgrade forever. Selling gives back 75% (100% if built this break).</p>' +
  '<p><b>Support and supers.</b> Farms and Factories pay out every wave, Power Plants boost them, Commanders boost nearby towers, Cryo-Emitters slow, Mechanic Bays repair walls, and Radar reveals cloaked enemies. Super towers (Howitzer, Doomsday, Railgun) are limited to one on the board and are aimed by hand.</p>' +
  '<p><b>Walls, traps and mines.</b> These go ON the road. Sandbags, concrete barriers and machine gun nests stop ground enemies, who must destroy them to pass. Tank Traps and Oil Slicks slow and hurt everything crossing them. Mines blow up when stepped on.</p>' +
  '<p><b>Abilities.</b> Airstrike (Q), EMP Blast (W: strips shields and alien barriers, stuns flyers, machines and aliens) and Cryo Burst (E: freezes everything).</p>' +
  '<p><b>Heroes.</b> Pick one hero per game from the hero bar under the shop, one for every era: Captain Ashford (Great War), Sgt. Kowalski (WWII tank ace), Agent Kane (Cold War), Cmdr. Reyes (Modern), Nova (Near Future) and Zyx\'ara (an alien defector). Drop it near the road, select it (V) and right-click to move it. It levels up to 10 from kills, and <kbd>Z</kbd> / <kbd>X</kbd> fire its two abilities.</p>' +
  '<p><b>The alien invasion.</b> At wave 10 alien tech unlocks in the Alien tab: Xeno Blasters, Graviton Projectors that throw enemies back, Disintegrators, Swarm Hives, Psi Spires that turn enemies against each other, Acid Spitters, Crystal Resonators, Shield Pylons, Biomass Reclaimers, Stasis Fields, Warp Mines and the Singularity Engine super. The aliens arrive at wave 16: barriers that block ALL damage until broken, Warp Stalkers that jump past walls, Splitters, Flying Saucers that knock out towers, and Motherships on waves 35, 55, 75...</p>' +
  '<p><b>Targeting.</b> Every attack tower has 15 targeting modes. "Lock" keeps it on one enemy until it dies or leaves range. Armor subtracts from every hit; cloaked enemies need Snipers, Tesla coils, supers or a Radar circle.</p>' +
  '<p><b>Keys.</b> ' + KEYLIST.filter(([k]) => !/Right-click|H$/.test(k)).map(([k, d]) => '<kbd>' + k + '</kbd> ' + d).join(' &middot; ') + '</p>';
}
function guideTroop() {
  return '<p><b>Troop Mode.</b> You are a field commander. Instead of attack towers you build barracks and send troops to hold the road. There are no attack towers in this mode.</p>' +
  '<p><b>Goal.</b> Enemy columns advance along the road toward your base. Hold them with your army for 40 waves (Campaign), 100 waves (Classic) or as long as you can (Endless).</p>' + GUIDE_CAMPAIGN +
  '<p><b>Your army.</b> The shop has four tabs: Troops, Mercs, Support and Defense. Eight barracks train different troops: Riflemen (hold the road), Marksmen (ranged, hit air), Heavy Infantry (armored), K9 dogs (fast), Grenadiers (area fire), Engineers (mines, repairs, sentries), Field Gun crews (long-range shells) and Combat Medics (healing). Build a barracks near the road and its troops gather at a rally point on it. Troops grow stronger every wave, and level 5 barracks pick a specialty.</p>' +
  '<p><b>Commanding troops.</b> Click a troop, or <b>drag a box</b> to select a group. Right-click (or press Move) to send the whole group somewhere; they keep a formation and hold their new post. Select a barracks and drag its rally flag to change where fresh troops gather.</p>' +
  '<p><b>Know your counters.</b> Flyers (Attack Drones, Fighter Jets, Zeppelins, Hive Ships): Marksmen, Grenadiers, Machine Gun Teams, Medics and Plasma troops can hit air. Armor (Armored Cars, Heavy Tanks, Colossus Mechs, bosses): Sniper Teams, Gauss Snipers, Dual-Purpose Guns, Rail Cannons, Special Forces and Heavy Infantry with Power Armor ignore or push through armor. Cloaked Phantoms: Spotter Teams, Gauss Snipers or a Radar circle.</p>' +
  '<p><b>Contractors.</b> Open the Mercs tab, pick a squad and click near the road to drop it in. They fight for a limited time and then leave. A Contractor HQ lowers prices and cooldowns and unlocks stronger squads early. Command Posts boost troops and contractors in their circle.</p>' +
  '<p><b>Economy and support.</b> Farms and Factories pay out every wave, Power Plants boost them, Mechanic Bays repair troops and walls, Cryo-Emitters slow enemies and Radar reveals cloaked ones. Barracks have higher limits in this mode.</p>' +
  '<p><b>Walls, traps and mines.</b> Sandbags, concrete barriers and machine gun nests make enemies stop so your troops can shoot them. Tank Traps, Oil Slicks and Mines hurt and slow whatever crosses them.</p>' +
  '<p><b>Abilities.</b> Airstrike (Q), Paratroopers (W) and Cryo Burst (E).</p>' +
  '<p><b>Heroes.</b> Pick one hero per game from the hero bar, one for every era. Drop it near the road, select it (V) and right-click to move it like a troop. It levels up to 10 from kills, and <kbd>Z</kbd> / <kbd>X</kbd> fire its two abilities. Tank Ace Kowalski and Nova hold the road like heavy infantry.</p>' +
  '<p><b>The alien invasion.</b> At wave 10 the Alien tab opens: a Xeno Hatchery (alien warriors), Shield Pylons, Biomass Reclaimers, Stasis Fields and Warp Mines, and Grey Defectors join the contractors at wave 16. The aliens arrive at wave 16 with barriers that block ALL damage until broken, Warp Stalkers that jump past walls, Splitters, and Flying Saucers your marksmen must shoot down.</p>' +
  '<p><b>Keys.</b> ' + KEYLIST.map(([k, d]) => '<kbd>' + k + '</kbd> ' + d).join(' &middot; ') + '</p>';
}
function guideHTML_unused() {
  return '<p><b>Goal.</b> Enemy columns advance along the road toward your base. Each one that gets through takes health off your base. Survive 100 waves (Classic) or as long as you can (Endless). The war runs from 1900 onward: trench-era guns and tanks, modern armies, and near-future sci-fi (energy weapons, cryo, shields, robots and mechs).</p>' +
  '<p><b>Building.</b> Pick something in the shop (or press 1 to 9) and click the map. You stay in build mode so you can place several; it drops you out automatically when you can no longer afford another one or hit its limit. Click an existing tower of the same type to <b>stack</b> another one onto it. The shop has five tabs: Attack, Support, Troops, Defense and Mercs.</p>' +
  '<p><b>Selecting.</b> Click a tower or a troop. <b>Drag a box</b> to select a group (troops if the box caught any, otherwise towers; hold <kbd>Alt</kbd> or use the Box button to force towers or troops). <kbd>Shift</kbd> adds to the selection, double-click grabs every tower of the same type, and the panel has a Select all button. Esc, right-click empty ground, or the Deselect button clears it.</p>' +
  '<p><b>Upgrades and specialties.</b> Almost everything (towers, supers, support, barracks, walls, traps, mines, command posts and the Contractor HQ) goes to level 5, then you <b>specialize</b> it into one of 2 to 4 paths that change how it plays. Choose for <b>one unit, a whole stack, or every ready unit in your selection</b> at once. The panel shows the total price, how many are ready, and which ones were skipped and why (below level 5, or already specialized). If you cannot afford all of them it specializes as many as you can. Farms and Factories upgrade forever. Selling gives back 75% (100% if built this break).</p>' +
  '<p><b>Barracks and troops.</b> Eight barracks train different troops: Riflemen (hold the road), Marksmen (ranged, hit air), Heavy Infantry (tanky), K9 dogs (very fast), Grenadiers (area fire), Engineers (mines, repairs, sentry turrets), Field Gun crews (long-range shells) and Combat Medics (healing). Their specialties go from machine gun teams to sci-fi: plasma rifles, power armor, drone swarms, cryo grenades, rail cannons and nanite medics. Troops grow stronger every wave. Select troops and right-click (or press Move) to send the whole group somewhere; they keep a formation and hold their new post. A Command Post boosts troops and contractors in its circle.</p>' +
  '<p><b>Contractors.</b> Open the Mercs tab, pick a squad, and click near the road to drop them in. They fight for a limited time and then leave. Each type has a cooldown, and you can only have a few squads out at once. Stats and prices grow with the wave. Some unlock at a wave; a Contractor HQ (Troops tab) unlocks them earlier, cuts prices and cooldowns, adds squad slots, and has its own specialties. Contractors can be selected and moved like troops. Besides soldiers and tanks, the roster has Combat Drones, Plasma Troopers, a Power Armor Squad and (with a level 5 HQ) a Mech Walker.</p>' +
  '<p><b>Walls, traps and mines.</b> These go ON the road. Sandbags, concrete barriers (with an energy Force Field specialty) and machine gun nests stop ground enemies, who must destroy them to pass, so you can never block the road for good (flyers ignore walls). Tank Traps and Oil Slicks do not block but hurt and slow everything crossing them; they wear out, so repair them. Mines blow up when stepped on. Each can be upgraded and specialized (barbed wire, demolition charges, guard posts, snare wire, frost mines, reusable mines...).</p>' +
  '<p><b>Moving towers.</b> Select one or many towers and press Move (M). The whole group keeps its shape. Moving during a wave makes towers spend 1.5 seconds setting back up.</p>' +
  '<p><b>Targeting.</b> Every attack tower has 15 targeting modes, including Random. "Lock" keeps it on one enemy until it dies or leaves range.</p>' +
  '<p><b>Armor, shields, stealth.</b> Armor subtracts from every hit (fast weak hits suffer most). Energy shields soak damage first. Cloaked and stealthed enemies need detection: Sniper, Tesla coils, supers, Spotter Teams, Overwatch Commanders, or any tower inside a Radar circle.</p>' +
  '<p><b>Variety.</b> Damage rolls +-10% per hit (turn it off in Settings), enemies vary a little in size, health and speed, and later waves bring random variants. Maps can be mirrored or flipped and the scenery changes every game.</p>' +
  '<p><b>Keys.</b> ' + KEYLIST.map(([k, d]) => '<kbd>' + k + '</kbd> ' + d).join(' &middot; ') + '</p>';
}
const GUIDE_CAMPAIGN = '<p><b>Maps, stars and the Daily Challenge.</b> There are ' + MAPS.length + ' maps, from farmland and jungle to a ruined city, a volcano, a frozen pass and the Moon. Some have rivers and lava (no building there; the road crosses on bridges), frozen lakes (enemies slide 25% faster on the ice) or mud bogs (25% slower). Win a map in Campaign or Classic to earn up to 3 stars: the more base health you keep, the more stars, and harder difficulties need less (Recruit tops out at 2). The <b>Daily Challenge</b> on the main menu gives everyone the same map and three modifiers each day; hold 30 waves for the best score you can.</p>' +
  '<p><b>Boss waves.</b> Every 10th wave a boss leads the attack, each with its own trick (a red health bar appears at the top): the Railway Gun charges at full steam, the Titan Mech stomps, the Storm Jammer knocks out towers with an EMP pulse, the War Factory rolls out escorts, the Aegis Walker regrows its shield and the Warlord makes the enemies around it faster and tougher. Campaign maps and the Daily Challenge start the boss order at different points. The Armored Train still comes every 5th wave and Motherships from wave 35.</p>' +
  '<p><b>Map Editor.</b> Make your own battlefield from the main menu: click out the roads on the tile grid (each one ends at your base by itself; start a new road on a corner of another one to branch off it), place the base, paint water, lava, ice, mud and craters, drop scenery to decide where towers can go, and pick the theme, starting money and base health. Test it right away, save it, and press <b>Share code</b> to get a short code a friend can paste under <b>Load a map from a share code</b>. Your maps appear under the built-in ones in New Game. Custom maps keep their own best wave; they do not earn stars or most achievements, since they can hand you lots of money.</p>';
// What's new in 3.0 (Codex tab, and the link under the main menu)
function newsHTML() {
  const sec = (title, items) => '<h4>' + title + '</h4><ul>' + items.map(x => '<li>' + x + '</li>').join('') + '</ul>';
  return '<div class="news"><p style="margin:0;color:var(--dim)">Tower Defense <b style="color:var(--text)">' + VERSION + '</b>: the biggest update yet. Every old save, star and record carries over.</p>' +
    sec('Map Editor and share codes', [
      '<b>Map Editor</b> on the main menu: click out up to ' + CM_LIMITS.roads + ' roads on a 24 x 15 tile grid (branches, crossings, entrances from the edge or from warp gates), place your base, paint water, lava, ice, mud and craters, drop ' + CM_DECO.length + ' kinds of scenery, and pick one of ' + CM_THEMES.length + ' themes, the starting money and the base health.',
      '<b>Test play</b> straight from the editor, with the map\'s own money or unlimited money. Undo and redo, and unsaved work is kept even if the page closes.',
      '<b>Save</b> up to ' + CM_LIMITS.maps + ' maps. They show up in New Game under the built-in maps, in any mode, difficulty, length and flip, and each keeps its best wave.',
      '<b>Share codes</b>: every map becomes a short line of text (usually about 100 characters) to send to friends. Paste one under Load a map from a share code to play it. Damaged or cut-off codes are caught and explained.']) +
    sec('Heroes', [
      '<b>Six heroes</b>, one for every era, in both modes: Captain Ashford (Great War), Sgt. Kowalski (WWII tank ace), Agent Kane (Cold War spy), Cmdr. Reyes (Modern), Nova (Near Future exo-pilot) and Zyx\'ara (an alien defector).',
      'Pick one from the hero bar ($250), drop it near the road and move it like a troop (V selects it). Heroes level up to 10 from kills and have two abilities each (Z and X), with cooldown bars, aim previews and toasts.']) +
    sec('New towers and the alien invasion', [
      '<b>18 new towers</b>: Trench Mortar, Anti-Tank Gun, SAM Site, CIWS and Ion Disruptor, plus a new <b>Alien tab</b> from wave 10 (Xeno Blaster, Graviton Projector, Disintegrator, Swarm Hive, Psi Spire, Acid Spitter, Crystal Resonator, Shield Pylon, Biomass Reclaimer, Stasis Field, Warp Mine, the Singularity Engine super and the Xeno Hatchery), all with upgrades and specialties.',
      '<b>7 alien enemies</b> from wave 16: barriers that block all damage until broken, Warp Stalkers, Splitters, Flying Saucers that knock out towers, Barrier Drones, Xeno Brutes and the Mothership boss.']) +
    sec('Maps, Campaign, bosses and the Daily Challenge', [
      '<b>12 new maps</b> (' + MAPS.length + ' in all) with 8 new themes and real terrain: rivers with bridges, lava, frozen lakes, mud bogs and craters.',
      '<b>Campaign</b>: hold a map for 40 waves to earn up to 3 stars (' + MAPS.length * 3 + ' in all). The map select shows stars, difficulty, terrain, your best wave and the bosses.',
      '<b>Boss waves</b> every 10 waves: the Railway Gun, Titan Mech, Storm Jammer, War Factory, Aegis Walker and Warlord, each with its own trick and a boss health bar.',
      '<b>Daily Challenge</b>: the same map, boss order and three modifiers for everyone each day, with a score, your best of the day and a streak.']) +
    sec('And more', [
      '<b>12 new achievements</b>, a Heroes tab and era tags in the Codex, and updated guides and tips.',
      'Old saves load unchanged: they simply let you pick a hero.']) + '</div>';
}
const KEYLIST = [['Z / X', 'hero abilities'], ['V', 'select your hero'], ['Space', 'start wave'], ['1-9', 'pick from the shop tab'], ['Tab', 'next shop tab'], ['H', 'open Mercs tab'], ['Esc', 'deselect / close'], ['Right-click', 'move troops / cancel'], ['Drag', 'box select'], ['Alt+drag', 'box select towers only'], ['Shift', 'add to selection'], ['Double-click', 'select all of one tower type'], ['U', 'upgrade selected'], ['S / Del', 'sell selected'], ['M', 'move selected'], ['T', 'cycle targeting'], ['R', 'show all ranges'], ['F', 'game speed'], ['P', 'pause'], ['Q W E', 'abilities']];

