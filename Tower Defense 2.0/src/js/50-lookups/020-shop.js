// =====================================================================
//  SHOP
// =====================================================================
let shopTab = 'Attack'; const iconCache = {};
function buildTabs() {
  const box = $('shop-tabs'); box.innerHTML = gmTabs().map(t => '<button class="tab" data-tab="' + t + '">' + TAB_NAMES[t] + '</button>').join('');
  box.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => { shopTab = b.dataset.tab; rebuildShop(true); }));
}
function rebuildShop(full) {
  if (!G) return;
  document.querySelectorAll('#shop-tabs .tab').forEach(b => b.classList.toggle('on', b.dataset.tab === shopTab));
  const shop = $('shop');
  if (full || shop.dataset.tab !== shopTab) {
    shop.dataset.tab = shopTab; shop.innerHTML = ''; mercBarKey = '';
    if (shopTab === 'Mercs') buildMercShop(shop);
    else shopList(shopTab).forEach((def, i) => {
      const b = document.createElement('button'); b.className = 'btn tcard'; b.dataset.id = def.id;
      const row = document.createElement('div'); row.className = 'row';
      row.appendChild(iconCache[def.id] || (iconCache[def.id] = towerIcon(def)));
      const nm = document.createElement('div'); nm.innerHTML = '<div class="tname">' + def.name + (def.super ? ' <span class="tag sup">SUPER</span>' : '') + '</div><span class="tcost">$' + def.cost + '</span> <span class="tcount"></span>';
      row.appendChild(nm); b.appendChild(row);
      const hk = document.createElement('span'); hk.className = 'hk'; hk.textContent = i < 9 ? (i + 1) : ''; b.appendChild(hk);
      const info = document.createElement('span'); info.className = 'info'; info.textContent = 'i'; info.title = 'Codex';
      info.addEventListener('click', (e) => { e.stopPropagation(); openCodex('towers', def.id); }); b.appendChild(info);
      b.addEventListener('click', () => beginPlace(def.id));
      b.addEventListener('mouseenter', () => showShopTip(b, def)); b.addEventListener('mouseleave', () => $('tooltip').classList.add('hidden'));
      shop.appendChild(b);
    });
  }
  refreshShopState();
}
function mercIcon(m) { return iconCache['m_' + m.id] || (iconCache['m_' + m.id] = troopIcon(m.look, m.color)); }
let mercBarKey = '';
function buildMercShop(shop) {
  const bar = document.createElement('div'); bar.className = 'mercbar'; bar.id = 'mercbar'; shop.appendChild(bar);
  MERCS.forEach((m, i) => {
    const b = document.createElement('button'); b.className = 'btn tcard merc'; b.dataset.merc = m.id;
    const row = document.createElement('div'); row.className = 'row'; row.appendChild(mercIcon(m));
    const nm = document.createElement('div'); nm.innerHTML = '<div class="tname">' + m.name + ' <span class="tag">x' + m.n + '</span></div><span class="tcost"></span> <span class="tcount"></span>';
    row.appendChild(nm); b.appendChild(row);
    const hk = document.createElement('span'); hk.className = 'hk'; hk.textContent = i < 9 ? (i + 1) : ''; b.appendChild(hk);
    const info = document.createElement('span'); info.className = 'info'; info.textContent = 'i'; info.title = 'Codex';
    info.addEventListener('click', (e) => { e.stopPropagation(); openCodex('mercs', m.id); }); b.appendChild(info);
    const cdb = document.createElement('div'); cdb.className = 'cdbar'; b.appendChild(cdb);
    b.addEventListener('click', () => beginMerc(m.id));
    b.addEventListener('mouseenter', () => showMercTip(b, m)); b.addEventListener('mouseleave', () => $('tooltip').classList.add('hidden'));
    shop.appendChild(b);
  });
}
function refreshMercShop() {
  const hq = getHQ(), squads = activeSquads(), cap = mercSquadCap(hq);
  const bar = $('mercbar');
  if (bar) {
    const html = '<b>Squads out: ' + squads + ' / ' + cap + '</b><br>' + (hq.group ? 'HQ level ' + hq.level + (hq.spec && specOf(hq.group.def, hq.spec) ? ' (' + specOf(hq.group.def, hq.spec).name + ')' : '') + ': prices -' + Math.round((1 - hq.costMul) * 100) + '%, cooldowns -' + Math.round((1 - hq.cdMul) * 100) + '%' : 'No Contractor HQ yet. Build one on the Troops tab for cheaper hires, shorter cooldowns, more squads and earlier unlocks.');
    if (html !== mercBarKey) { mercBarKey = html; bar.innerHTML = html; }
  }
  for (const b of $('shop').querySelectorAll('.merc')) {
    const m = MERC[b.dataset.merc], unlocked = mercUnlocked(m, hq), cd = G.mercCd[m.id] || 0, cost = mercCost(m, hq);
    b.querySelector('.tcost').textContent = '$' + cost;
    b.querySelector('.tcount').textContent = !unlocked ? 'Wave ' + m.wave + (m.hq ? ' / HQ' + m.hq : '') : cd > 0 ? Math.ceil(cd / TPS) + 's' : 'ready';
    b.classList.toggle('sel', G.placeMerc === m.id); b.classList.toggle('poor', G.money < cost && G.opts.mode !== 'sandbox'); b.classList.toggle('locked', !unlocked || cd > 0 || squads >= cap);
    b.querySelector('.cdbar').style.width = unlocked && cd > 0 ? (100 * cd / mercCdTicks(m, hq)).toFixed(0) + '%' : '0%';
  }
}
function refreshShopState() {
  if (!G) return;
  if (shopTab === 'Mercs') { refreshMercShop(); return; }
  for (const b of $('shop').children) {
    const def = TOWER[b.dataset.id]; if (!def) continue; const n = countOf(def), lim = limitOf(def), wl = waveLocked(def);
    b.querySelector('.tcount').textContent = wl ? 'Wave ' + def.wave : def.consumable ? '(' + n + '/' + lim + ' out)' : '(' + n + '/' + lim + ')';
    b.classList.toggle('sel', G.place === def.id);
    b.classList.toggle('poor', G.money < def.cost);
    b.classList.toggle('locked', wl || n >= lim || !!(def.super && hasSuper()));
  }
}
function placeTip(el, html) {
  const tt = $('tooltip'); tt.innerHTML = html; tt.classList.remove('hidden');
  const r = el.getBoundingClientRect(), sr = $('stage').getBoundingClientRect();
  const x = Math.max(8, Math.min(sr.width - 270, r.left - sr.left - 270)), y = Math.max(8, Math.min(sr.height - tt.offsetHeight - 8, r.top - sr.top));
  tt.style.left = x + 'px'; tt.style.top = y + 'px';
}
function showShopTip(el, def) {
  const st = levelStats(def, 1, 0), k = def.kind;
 let h = '<div class="tt-title">' + def.name + ' <span style="color:var(--gold)">$' + def.cost + '</span></div><div>' + eraTag(def.era) + (def.wave ? '<span class="tag">' + (waveLocked(def) ? 'Unlocks at wave ' + def.wave : 'Unlocked') + '</span>' : '') + '</div><div style="color:#c7cfda;margin:3px 0">' + def.desc + '</div>';
  if (isShooter(def) && st.damage) h += '<div>Damage <b>' + st.damage + '</b> &middot; Range <b>' + st.range + '</b> &middot; ' + (60 / st.rate).toFixed(1) + '/s</div>';
  if (k === 'barracks') { const T = TROOP_TYPES[def.troop] || TROOP_TYPES.soldier; h += '<div>Trains <b>' + T.name + '</b> (' + st.soldiers + ' at level 1, up to ' + def.b.n[4] + '): ' + st.troopHp + ' hp, ' + st.troopDmg + ' dmg</div>'; }
  if (isStructure(def)) h += '<div>Health <b>' + st.hp + '</b>' + (k === 'trap' ? ' (wears down)' : '') + '</div>';
  if (def.specs) h += '<div style="color:var(--gold);margin-top:3px">' + def.specs.length + ' specialties at level 5: ' + def.specs.map(s => s.name).join(', ') + '</div>';
  h += '<div>' + tagsHTML(def) + '</div>';
  placeTip(el, h);
}
function showMercTip(el, m) {
  const hq = getHQ(), sc = mercScale(G.wave);
  let h = '<div class="tt-title">' + m.name + ' <span style="color:var(--gold)">$' + mercCost(m, hq) + '</span></div><div style="color:#c7cfda;margin:3px 0">' + m.desc + '</div>';
  h += '<div>' + m.n + ' units &middot; ' + Math.round(m.hp * sc) + ' hp &middot; ' + Math.round(m.dmg * sc) + ' dmg each</div>';
  h += '<div>Stays <b>' + Math.round(m.life * (hq.vet ? 1.5 : 1)) + 's</b> &middot; cooldown <b>' + Math.round(m.cd * hq.cdMul) + 's</b></div>';
  h += '<div style="color:var(--dim)">Unlocks at wave ' + m.wave + (m.hq ? ' or HQ level ' + m.hq : '') + '. Stats and price grow with the wave.</div>';
  placeTip(el, h);
}
function tagsHTML(def) {
  const t = [];
  if (def.super) t.push('<span class="tag sup">SUPER</span>');
  if (def.air === 'yes') t.push('<span class="tag air">Hits air</span>'); else if (def.air === 'only') t.push('<span class="tag air">Air only</span>');
  else if (['bullet', 'snipe', 'shell', 'frost', 'zap', 'poison', 'lob', 'beam', 'gravity'].includes(def.kind) && def.air === 'no') t.push('<span class="tag">Ground only</span>');
  if (def.fx && def.fx.shieldMul) t.push('<span class="tag" style="color:#84ffff">Breaks barriers x' + def.fx.shieldMul + '</span>');
  if (def.kind === 'gravity' || def.warp) t.push('<span class="tag" style="color:#b388ff">Throws enemies back</span>');
  if (def.kind === 'mind') t.push('<span class="tag" style="color:#ea80fc">Mind control</span>');
  if (def.detect) t.push('<span class="tag det">Sees stealth</span>');
  if (def.aoe) t.push('<span class="tag aoe">Area damage</span>');
  if (def.onPath) t.push('<span class="tag path">Goes on the path</span>');
  if (def.stack) t.push('<span class="tag">Stacks</span>');
  if (def.manual) t.push('<span class="tag sup">Aim it yourself</span>');
  if (def.endless) t.push('<span class="tag">Endless upgrades</span>');
  if (def.kind === 'barracks') t.push('<span class="tag">Trains troops</span>');
  if (def.kind === 'fence') t.push('<span class="tag path">Blocks &amp; gets attacked</span>');
  if (def.kind === 'trap') t.push('<span class="tag path">Slows &amp; hurts</span>');
  if (def.specs) t.push('<span class="tag sup">' + def.specs.length + ' specialties</span>');
  return t.join('');
}

// =====================================================================
//  ABILITIES BAR
// =====================================================================
function renderAbilities() {
  const box = $('abilities'); if (!G) return;
  syncAimPanel();
  if (!box.children.length) ABILITIES.forEach(a => {
    const b = document.createElement('button'); b.className = 'btn ability'; b.dataset.id = a.id; b.title = a.desc;
    b.innerHTML = '<div>' + a.name + '</div><div style="color:var(--dim);font-size:10px" class="ab-sub"></div><div class="cd"></div>';
    b.addEventListener('click', () => armAbility(a.id)); box.appendChild(b);
  });
  for (const b of box.children) {
    const a = ABILITIES.find(x => x.id === b.dataset.id), cd = G.abilities[a.id], silent = !!G.mods.noabil, locked = silent || G.wave < a.wave;
    b.disabled = locked || cd > 0; b.classList.toggle('armed', G.armed === a.id);
    b.querySelector('.ab-sub').textContent = silent ? 'Radio silence' : locked ? 'Wave ' + a.wave : cd > 0 ? Math.ceil(cd / TPS) + 's' : '[' + a.key + '] ready';
    b.querySelector('.cd').style.width = (locked ? 0 : 100 * (1 - cd / (a.cd * TPS))) + '%';
  }
}
function armAbility(id) {
  const a = ABILITIES.find(x => x.id === id); if (!abilityReady(a)) { sfx('deny'); return; }
  if (id === 'freeze') { useAbility('freeze'); renderAbilities(); return; }
  G.armed = G.armed === id ? null : id; G.place = null; G.placeMerc = null; G.moveMode = null; rebuildShop();
  if (G.armed) toast(a.name + ': click the map (right-click cancels)', '#ffd54f');
  renderAbilities();
}

// =====================================================================
//  HERO BAR + HERO PICKER (2.6)
//  The bar is rebuilt only when its layout changes (no hero / placing /
//  deployed); the 200 ms UI tick just updates texts and bars.
// =====================================================================
function eraTag(era) { const E = ERAS[era]; return E ? '<span class="era-tag" style="background:' + E.color + '">' + E.name.toUpperCase() + '</span>' : ''; }
function heroIcon(H, size) { return iconCache['h_' + H.id + size] || (iconCache['h_' + H.id + size] = troopIcon(H.look, H.color, size)); }
let heroBarKey = '';
function renderHeroBar(force) {
  const box = $('herobar'); if (!G || !box) return;
  syncAimPanel();
  const h = G.hero, key = h ? 'h:' + h.heroId : G.placeHero ? 'p:' + G.placeHero : 'none';
  if (force || key !== heroBarKey) {
    heroBarKey = key; box.innerHTML = '';
    if (!h) {
      const b = document.createElement('button'); b.className = 'btn btn-gold hb-pick'; b.dataset.act = 'hero-pick';
      b.innerHTML = G.placeHero ? 'Click near the road to deploy ' + HERO[G.placeHero].name + ' <span style="color:var(--dim);font-weight:500">(right-click cancels)</span>' : '&#9733; Choose your hero <span style="color:var(--dim);font-weight:500">(' + (G.opts.mode === 'sandbox' ? 'free in Sandbox' : money$(HERO_COST)) + ', one per game)</span>';
      b.onclick = () => { if (G.placeHero) { G.placeHero = null; renderHeroBar(true); } else openHeroPicker(); };
      box.appendChild(b); return;
    }
    const H = HERO[h.heroId];
    const port = document.createElement('button'); port.className = 'hb-port'; port.title = 'Select ' + H.name + ' (V)'; port.appendChild(heroIcon(H, 30)); port.onclick = selectHero; box.appendChild(port);
    const info = document.createElement('div'); info.className = 'hb-info'; info.title = 'Select ' + H.name + ' (V)'; info.innerHTML = '<b></b><span class="hb-sub"></span><div class="hb-xp"><i></i></div>'; info.onclick = selectHero; box.appendChild(info);
    H.abil.forEach((A, i) => {
      const b = document.createElement('button'); b.className = 'btn hb-ab'; b.dataset.hab = i; b.title = A.name + ': ' + A.desc;
      b.innerHTML = '<div>' + A.name + '</div><div style="color:var(--dim)" class="ab-sub"></div><div class="cd"></div>';
      b.onclick = () => armHero(i); box.appendChild(b);
    });
  }
  if (!h) return;
  const H = HERO[h.heroId], need = heroXpNeed(h.lvl);
  box.querySelector('.hb-info b').textContent = H.name;
  box.querySelector('.hb-sub').textContent = h.hp <= 0 ? 'Down: back in ' + Math.ceil(h.downT / TPS) + 's' : 'Lv ' + h.lvl + (h.lvl >= HERO_MAX ? ' (max)' : ' \u00b7 XP ' + Math.floor(h.xp) + '/' + need);
  box.querySelector('.hb-xp i').style.width = (h.lvl >= HERO_MAX ? 100 : Math.min(100, 100 * h.xp / need)).toFixed(0) + '%';
  for (const b of box.querySelectorAll('.hb-ab')) {
    const i = +b.dataset.hab, A = H.abil[i], locked = i === 1 && h.lvl < HERO_ABIL2_LV, cd = h.cdA[i], max = Math.round(A.cd * TPS * heroCdMul(h));
    b.disabled = locked || cd > 0 || h.hp <= 0; b.classList.toggle('armed', G.armed === 'hero' + i);
    b.querySelector('.ab-sub').textContent = locked ? 'Hero Lv ' + HERO_ABIL2_LV : h.hp <= 0 ? 'down' : cd > 0 ? Math.ceil(cd / TPS) + 's' : '[' + (i ? 'X' : 'Z') + '] ready';
    b.querySelector('.cd').style.width = (locked ? 0 : 100 * (1 - Math.min(1, cd / max))).toFixed(0) + '%';
  }
}
function selectHero() {
  if (!G) return;
  if (!G.hero) { openHeroPicker(); return; }
  if (G.hero.hp <= 0) { toast(G.hero.name + ' is down (back in ' + Math.ceil(G.hero.downT / TPS) + 's)', '#ff8a80'); return; }
  G.place = null; G.placeMerc = null; G.armed = null; G.sel.towers.clear(); G.sel.troops.clear(); G.sel.troops.add(G.hero); G.moveMode = null; refreshSelection(true); sfx('click');
}
function armHero(i) {
  if (!G || G.over) return;
  const err = heroAbilityError(i); if (err) { toast(err, '#ff8a80'); sfx('deny'); return; }
  const A = HERO[G.hero.heroId].abil[i];
  if (!A.aim) { useHeroAbility(i); renderHeroBar(true); refreshSelection(true); return; }
  const key = 'hero' + i;
  G.armed = G.armed === key ? null : key; G.place = null; G.placeMerc = null; G.placeHero = null; G.moveMode = null; G.aim = null; rebuildShop();
  if (G.armed) toast(A.name + ': ' + (A.aim === 'enemy' ? 'click an enemy' : A.aim === 'line' ? 'click where to fire' : A.id === 'barrage' ? 'click the road' : 'click the map') + ' (right-click cancels)', '#ffd54f');
  renderAbilities(); renderHeroBar(true);
}
function openHeroPicker() {
  if (!G) return;
  const grid = $('hero-grid'); grid.innerHTML = '';
  $('hero-note').innerHTML = G.heroId ? '<b style="color:var(--gold)">' + HERO[G.heroId].name + '</b> is your hero for this game (one hero per game).' : 'One hero per game, in both modes. A hero costs <b style="color:var(--gold)">' + money$(HERO_COST) + '</b>' + (G.opts.mode === 'sandbox' ? ' (free in Sandbox)' : '') + ': deploy it near the road, select it (V) and right-click to move it. It earns XP from kills (30% from kills near it), grows to level 10 and gets stronger every wave. <b>Z</b> and <b>X</b> fire its two abilities (the second unlocks at level ' + HERO_ABIL2_LV + '). If it falls it returns after ' + HERO_RESPAWN + ' seconds.';
  for (const H of HEROES) {
    const card = document.createElement('div'); card.className = 'hero-card' + (G.heroId === H.id ? ' cur' : ''); card.dataset.hero = H.id;
    const head = document.createElement('div'); head.className = 'hc-head'; head.appendChild(troopIcon(H.look, H.color, 46));
    const nm = document.createElement('div'); nm.innerHTML = '<div class="hc-name">' + H.name + '</div><div class="hc-title">' + H.title + '</div>' + eraTag(H.era); head.appendChild(nm); card.appendChild(head);
    const body = document.createElement('div');
    body.innerHTML = '<p>' + H.desc + '</p><p style="color:var(--dim)">' + heroRoleLine(H) + '</p>' + H.abil.map((A, i) => '<div class="hc-ab"><b>' + (i ? 'X' : 'Z') + ': ' + A.name + '</b> <span style="color:var(--dim)">(' + A.cd + 's' + (i ? ', hero level ' + HERO_ABIL2_LV : '') + ')</span><br>' + A.desc + '</div>').join('');
    card.appendChild(body);
    const b = document.createElement('button'); b.className = 'btn'; b.dataset.act = 'deploy'; b.dataset.hero = H.id;
    b.onclick = () => beginHero(H.id); card.appendChild(b);
    grid.appendChild(card);
  }
  heroPickKey = ''; heroPickerCash();
  openModal('heroes');
}
// the Deploy buttons and the money line follow G.money while the picker is open (the game runs on behind it);
// called from the 200 ms UI tick, and it only touches the DOM when something changed
let heroPickKey = '';
function heroPickerCash() {
  if (!G || $('modal-heroes').classList.contains('hidden') && heroPickKey) return;
  const err = G.heroId ? null : heroCostError(), key = (G.heroId || '') + '|' + (err ? Math.floor(G.money) : 'ok');
  if (key === heroPickKey) return;
  heroPickKey = key;
  const cash = $('hero-cash'); cash.classList.toggle('hidden', !err);
  if (err) cash.innerHTML = 'Not enough money yet: a hero costs ' + money$(HERO_COST) + ' and you have ' + money$(G.money) + '. Close this, earn ' + money$(HERO_COST - G.money) + ' more and come back (Z). The buttons light up as soon as you can pay.';
  for (const b of $('hero-grid').querySelectorAll('button[data-act=deploy]')) {
    const H = HERO[b.dataset.hero];
    b.className = 'btn' + (G.heroId || err ? '' : ' btn-gold'); b.disabled = !!(G.heroId || err);
    b.textContent = G.heroId === H.id ? 'Your hero' : G.heroId ? 'One hero per game' : err ? 'Need ' + money$(HERO_COST) + ' (you have ' + money$(G.money) + ')' : 'Deploy ' + H.name.split(' ').pop() + (G.opts.mode === 'sandbox' ? '' : ' (' + money$(HERO_COST) + ')');
  }
}
function heroRoleLine(H) { return (H.role === 'melee' ? 'Close combat, holds the road' : 'Ranged, range ' + H.range) + ' &middot; ' + (H.hitsAir || H.role === 'aoe' ? 'hits air' : 'ground only') + (H.armor ? ' &middot; armor ' + H.armor : '') + (H.detect ? ' &middot; sees cloaked' : '') + ' &middot; ' + H.hp + ' hp, ' + H.dmg + ' dmg at level 1'; }
const heroCostError = () => G.opts.mode !== 'sandbox' && G.money < HERO_COST ? 'A hero costs ' + money$(HERO_COST) + ' (you have ' + money$(G.money) + ')' : null;
function beginHero(id) {
  if (!G || G.over) return;
  if (G.heroId) { toast('One hero per game: ' + HERO[G.heroId].name + ' is already with you', '#ff8a80'); return; }
  const ce = heroCostError(); if (ce) { toast(ce, '#ff8a80'); sfx('deny'); heroPickKey = ''; heroPickerCash(); return; }
  clearSelection(); G.placeHero = id; G.place = null; G.placeMerc = null; G.armed = null; G.aim = null; G.moveMode = null;
  closeModal('heroes'); toast('Click near the road to deploy ' + HERO[id].name + ' (right-click cancels)', '#ffd54f');
  rebuildShop(); renderHeroBar(true);
}

// =====================================================================
//  SELECTION PANEL
// =====================================================================
let selKey = '', panelBusy = false;
$('selpanel').addEventListener('pointerdown', () => { panelBusy = true; });
document.addEventListener('pointerup', () => { setTimeout(() => panelBusy = false, 0); });
function refreshSelection(force) { renderSelPanel(force); updateHUD(); }
// while an ability (hero Z / X, air strike...) or a super weapon is aiming, the panel fades and lets clicks through,
// so road under it can still be targeted
function syncAimPanel() { $('selpanel').classList.toggle('aiming', !!(G && (G.armed || G.aim))); }
function renderSelPanel(force) {
  const P = $('selpanel'); syncAimPanel();
  if (!G) { P.classList.add('hidden'); return; }
  const towers = [...G.sel.towers].filter(g => G.towers.includes(g)), troops = [...G.sel.troops].filter(t => t.hp > 0);
  if (!towers.length && !troops.length) { P.classList.add('hidden'); selKey = ''; return; }
  if (panelBusy && !force) return;
  if (document.activeElement && P.contains(document.activeElement) && document.activeElement.tagName === 'SELECT' && !force) return;
  let h = '';
  if (towers.length === 1 && !troops.length) h = singleTowerHTML(towers[0], towers);
  else if (!towers.length && troops.length === 1 && troops[0].hero) h = heroPanelHTML(troops[0]);
  else h = multiHTML(towers, troops);
  if (h === selKey && !force) return;
  const keepScroll = P.scrollTop;
  selKey = h; P.innerHTML = h; P.classList.remove('hidden'); P.scrollTop = keepScroll;
  bindPanel(towers, troops);
}
function heroPanelHTML(h) {
  const H = HERO[h.heroId], need = heroXpNeed(h.lvl);
  let x = '<div class="sp-head"><h3>' + H.name + ' <span style="color:var(--gold)">Lv ' + h.lvl + '</span></h3><div><button class="btn btn-sm" data-act="herocodex">Codex</button> <button class="btn btn-sm btn-red" data-act="close">&#10005;</button></div></div>';
  x += '<div style="color:var(--dim)">' + H.title + ' ' + eraTag(H.era) + '</div>';
  x += '<div class="sp-grid"><div>Health</div><b>' + Math.ceil(h.hp) + ' / ' + h.maxHp + '</b><div>Damage</div><b>' + fmt(h.dmg * h.bd) + (h.cleave ? ' (splash)' : h.chain ? ' (chains to ' + h.chain + ')' : '') + '</b><div>' + (h.ranged ? 'Range' : 'Reach') + '</div><b>' + (h.ranged ? h.range : h.leash) + '</b>' +
    '<div>XP</div><b>' + (h.lvl >= HERO_MAX ? 'MAX' : Math.floor(h.xp) + ' / ' + need) + '</b><div>Kills</div><b>' + h.kills + '</b><div>Damage dealt</div><b>' + fmt(h.dealt) + '</b></div>';
  H.abil.forEach((A, i) => {
    const locked = i === 1 && h.lvl < HERO_ABIL2_LV, cd = h.cdA[i];
    x += '<button class="btn spec-opt" data-act="hab" data-i="' + i + '"' + (locked || cd > 0 ? ' disabled' : '') + '>' + (i ? 'X' : 'Z') + ': ' + A.name + ' <span style="color:var(--dim)">' + (locked ? '(hero level ' + HERO_ABIL2_LV + ')' : cd > 0 ? '(' + Math.ceil(cd / TPS) + 's)' : '(ready)') + '</span><small>' + A.desc + '</small></button>';
  });
  x += '<p style="color:var(--dim);margin:6px 0 0">Right-click the map to move ' + H.name + '. Next level: +20% damage, +15% health, +15% ability power, 3% shorter cooldowns.</p>';
  return x;
}
function auraEffect(def, L, m) {
  m = m || {};
  if (def.aura === 'pylon') return '-' + Math.round(m.hardened ? 45 : 20 + 5 * (L - 1)) + '% damage taken, no saucer knockouts' + (m.hardened ? ', +10% tower range' : '') + (m.breaker ? ', barrier-breaking pulse' : '');
  if (def.aura === 'harvest') return '+' + Math.round(25 + 5 * (L - 1)) + '% bounty' + (m.alienMul ? ' (x' + m.alienMul + ' on aliens)' : '') + (m.stockpile ? ', +' + money$(m.stockpile * L) + '/wave' : '');
  if (def.aura === 'command') return '+' + Math.round(10 * L * (m.cmdRange || 1)) + '% range, +' + Math.round(5 * L * (m.cmdDmg || 1)) + '% dmg' + (m.cmdRate ? ', +' + Math.round(m.cmdRate * L * 100) + '% fire rate' : '') + (m.cmdDetect ? ', sees stealth' : '');
  if (def.aura === 'eco') return '+' + 20 * L + '% income' + (m.grid ? ', towers +' + Math.round(m.grid * L * 100) + '% fire rate' : '') + (m.field ? ', ' + m.field * L + ' dmg/s field' : '');
  if (def.aura === 'cryo') return Math.round(((L >= 5 ? 0.55 : 0.4) + (m.slowAdd || 0)) * 100) + '% slow' + (m.brittleField ? ', +' + Math.round(m.brittleField * 100) + '% dmg taken' : '');
  if (def.aura === 'radar') return 'Reveal' + (L >= 3 || m.mark ? ', +' + Math.round(Math.max(m.mark || 0, L >= 5 ? 0.2 : L >= 3 ? 0.1 : 0) * 100) + '% dmg taken' : '');
  if (def.aura === 'cpost') return '+' + Math.round(6 * L * (m.postDmg || 1)) + '% troop dmg, regen ' + ((0.4 * L + (m.regen || 0) * 100)).toFixed(1) + '%/s' + (m.postSpeed ? ', +' + Math.round(m.postSpeed * 100) + '% speed' : '') + (m.guard ? ', -' + Math.round((1 - m.guard) * 100) + '% dmg taken' : '');
  return '';
}
function unitStatLine(g, u) {
  const st = u.stats, k = g.def.kind, m = st.mods;
  if (k === 'income') return 'Pays <b>' + money$(st.income * g.buff.eco) + '</b>/wave';
  if (k === 'aura') return 'Range <b>' + st.range + '</b> &middot; ' + auraEffect(g.def, st.power, m);
  if (k === 'heal') return 'Heals <b>' + st.damage + '</b>/s &middot; range ' + st.range;
  if (k === 'barracks') { const T = TROOP_TYPES[g.def.troop] || TROOP_TYPES.soldier; return '<b>' + st.soldiers + '</b> ' + troopPlural(T.name, st.soldiers) + ' &middot; ' + Math.round(st.troopHp * (1 + G.wave * 0.03)) + ' hp &middot; ' + Math.round(st.troopDmg * (1 + G.wave * 0.05)) + ' dmg'; }
  if (k === 'hq') return 'Hires -' + Math.round((1 - (1 - 0.04 * st.power) * (m.mcost || 1)) * 100) + '% &middot; cooldown -' + Math.round((1 - (1 - 0.05 * st.power) * (m.mcd || 1)) * 100) + '% &middot; +' + (Math.floor(st.power / 2) + (m.mcap || 0)) + ' squads';
  if (k === 'fence') return 'HP <b>' + st.hp + '</b> &middot; ' + Math.round((1 - st.guard) * 100) + '% less damage taken' + (g.def.shoots ? ' &middot; Dmg ' + st.damage + (st.shots > 1 ? 'x' + st.shots : '') : '');
  if (k === 'trap' && g.def.trap === 'stasis') return 'Freezes <b>' + (1 + 0.15 * (u.level - 1)) * (m.stasisMul || 1) + 's</b> every ' + ((m.stasisEvery || 240) / 60) + 's &middot; radius ' + st.range;
  if (k === 'trap') return (g.def.trap === 'spikes' ? 'Dmg <b>' + st.damage + '</b> per hit &middot; ' : '') + 'Radius <b>' + st.range + '</b> &middot; slow ' + Math.round((m.slowTrap || g.def.slow) * 100) + '%';
  if (k === 'mind') return 'Seizes <b>' + (m.charmN || 1) + '</b> for <b>' + (((m.charm || 240) + 30 * (u.level - 1)) / 60).toFixed(1) + 's</b> every ' + (st.rate / 60 / g.buff.rate).toFixed(1) + 's &middot; Rng <b>' + Math.round(st.range * g.buff.range) + '</b>';
  if (k === 'mine' && g.def.warp) return 'Dmg <b>' + Math.round(st.damage * (1 + G.wave * 0.15)) + '</b> &middot; blast ' + st.aoe + ' &middot; warps ' + (m.warp || g.def.warp) + ' back';
  if (k === 'mine') return 'Dmg <b>' + Math.round(st.damage * (1 + G.wave * 0.15)) + '</b> &middot; blast ' + st.aoe;
  return 'Dmg <b>' + Math.round(st.damage * g.buff.dmg) + '</b>' + (st.shots > 1 ? 'x' + st.shots : '') + ' &middot; Rng <b>' + Math.round(st.range * g.buff.range) + '</b> &middot; ' + (60 / st.rate * g.buff.rate).toFixed(1) + '/s';
}
