// =====================================================================
//  SETTINGS UI
// =====================================================================
let setTab = 'graphics';
function renderSettings() {
  const tabs = [['graphics', 'Graphics & Speed'], ['gameplay', 'Gameplay'], ['audio', 'Audio'], ['controls', 'Controls']];
  $('set-tabs').innerHTML = tabs.map(([k, n]) => '<button class="tab' + (k === setTab ? ' on' : '') + '" data-st="' + k + '">' + n + '</button>').join('');
  $('set-tabs').querySelectorAll('[data-st]').forEach(b => b.onclick = () => { setTab = b.dataset.st; renderSettings(); });
  const seg = (key, opts, title, sub) => '<div class="set-row"><div>' + title + (sub ? '<small>' + sub + '</small>' : '') + '</div><div class="seg" data-seg="' + key + '">' + opts.map(([v, n]) => '<button data-v="' + v + '"' + (String(S[key]) === String(v) ? ' class="on"' : '') + '>' + n + '</button>').join('') + '</div></div>';
  const sw = (key, title, sub) => '<div class="set-row"><div>' + title + (sub ? '<small>' + sub + '</small>' : '') + '</div><label class="switch"><input type="checkbox" data-sw="' + key + '"' + (S[key] ? ' checked' : '') + '><span></span></label></div>';
  let h = '';
  if (setTab === 'graphics') {
    h += seg('quality', [['auto', 'Auto'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['custom', 'Custom']], 'Quality preset', 'Auto lowers effects by itself if the game starts to lag. Changing any option below switches to Custom.');
    h += seg('particles', [[0, 'Off'], [1, 'Low'], [2, 'Normal'], [3, 'High']], 'Particles', 'Sparks, debris and smoke. Off is the biggest speed boost.');
    h += seg('res', [[0.5, '50%'], [0.75, '75%'], [1, '100%']], 'Render resolution', 'Lower = faster on weak computers, a little blurrier.');
    h += seg('fpsCap', [[0, 'Unlimited'], [60, '60'], [30, '30']], 'Frame rate limit', '30 saves battery on laptops and Chromebooks.');
    h += seg('healthBars', [['always', 'Always'], ['damaged', 'When hurt'], ['off', 'Off']], 'Enemy health bars');
    h += sw('damageNumbers', 'Damage numbers', 'Floating numbers when things are hit.');
    h += sw('trails', 'Projectile trails');
    h += sw('glow', 'Glow effects', 'Pretty, but the slowest effect on weak devices.');
    h += sw('shake', 'Screen shake');
    h += sw('pathAnim', 'Animated road markers');
    h += sw('scenery', 'Scenery (trees and rocks)', 'Hides decorations. They still block building.');
    h += sw('reducedMotion', 'Reduced motion', 'No shaking or moving road markers.');
    h += sw('showFps', 'Show FPS counter');
  } else if (setTab === 'gameplay') {
    h += sw('variance', 'Damage variation', 'Every hit rolls between 90% and 110% damage.');
    h += sw('enemyVariety', 'Enemy variety', 'Random size / health / speed and variants (Motorized, Heavy, Elite...). Takes effect next wave.');
    h += sw('confirmSell', 'Ask before selling', 'Only for towers worth $300 or more.');
    h += sw('hoverRange', 'Show range when hovering a tower');
    h += sw('autoWaveDefault', 'Auto wave on by default');
    h += sw('autoPauseHidden', 'Pause when you switch tabs');
    h += sw('showTips', 'Show tips');
  } else if (setTab === 'audio') {
    h += '<div class="set-row"><div>Volume</div><input type="range" min="0" max="100" value="' + Math.round(S.volume * 100) + '" data-range="volume"></div>';
    h += sw('sfx', 'Sound effects');
  } else {
    h += KEYLIST.map(([k, d]) => '<div class="set-row"><div>' + d + '</div><kbd>' + k + '</kbd></div>').join('');
  }
  $('set-body').innerHTML = h;
  $('set-body').querySelectorAll('[data-seg]').forEach(box => box.querySelectorAll('button').forEach(b => b.onclick = () => {
    const key = box.dataset.seg; let v = b.dataset.v; if (!isNaN(+v) && key !== 'quality' && key !== 'healthBars') v = +v;
    if (key === 'quality') applyQualityPreset(v); else { S[key] = v; if (['particles', 'res'].includes(key)) S.quality = 'custom'; }
    saveSettings(); resize(); renderSettings();
  }));
  $('set-body').querySelectorAll('[data-sw]').forEach(c => c.onchange = () => { const k = c.dataset.sw; S[k] = c.checked; if (['trails', 'glow', 'shake', 'pathAnim', 'scenery'].includes(k)) S.quality = 'custom'; if (k === 'scenery') markBgDirty(); $('fps').classList.toggle('hidden', !S.showFps); saveSettings(); renderSettings(); });
  $('set-body').querySelectorAll('[data-range]').forEach(r => r.oninput = () => { S[r.dataset.range] = r.value / 100; saveSettings(); });
}
$('set-reset').onclick = () => { S = Object.assign({}, DEFAULT_SETTINGS); saveSettings(); resize(); markBgDirty(); renderSettings(); };

// =====================================================================
//  MODALS
// =====================================================================
function openModal(name) {
  $('modal-' + name).classList.remove('hidden');
  if (name === 'settings') renderSettings();
  if (name === 'achievements') renderAchievements();
}
function closeModal(name) { $('modal-' + name).classList.add('hidden'); }
document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => { const n = b.dataset.open; if (n === 'codex') openCodex(); else openModal(n); }));
document.querySelectorAll('.modal').forEach(m => {
  m.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => m.classList.add('hidden')));
  m.addEventListener('pointerdown', (e) => { if (e.target === m && m.id !== 'modal-end' && m.id !== 'modal-pause') m.classList.add('hidden'); });
});
let confirmFn = null;
function confirmBox(title, body, fn) { $('confirm-title').textContent = title; $('confirm-body').textContent = body; confirmFn = fn; openModal('confirm'); }
$('confirm-yes').onclick = () => { closeModal('confirm'); if (confirmFn) confirmFn(); confirmFn = null; };
$('confirm-no').onclick = () => { closeModal('confirm'); confirmFn = null; };
function renderAchievements() {
  const got = getAch();
  $('ach-body').innerHTML = '<p style="color:var(--dim)">' + Object.keys(got).length + ' / ' + ACHIEVEMENTS.length + ' unlocked</p>' + ACHIEVEMENTS.map(a => '<div class="ach' + (got[a.id] ? ' got' : '') + '"><div class="ico">' + (got[a.id] ? '&#9733;' : '?') + '</div><div><b>' + a.name + '</b>' + (a.gm ? ' <span class="tag">' + GAME_MODES[a.gm].name + '</span>' : '') + '<div style="color:var(--dim);font-size:12px">' + a.desc + '</div></div></div>').join('');
}
function showEnd(won) {
  const mode = G.opts.mode, dr = mode === 'daily' ? G.dailyResult : null;
  $('end-title').textContent = dr ? (won ? 'DAILY CHALLENGE WON!' : 'DAILY CHALLENGE OVER') : won ? 'VICTORY!' : 'GAME OVER';
  $('end-title').style.color = won ? 'var(--gold)' : 'var(--red)';
  let h = '';
  if (won && G.stars) {
    h += '<div class="stars" style="font-size:32px;text-align:center">' + '&#9733;'.repeat(G.stars) + '&#9734;'.repeat(3 - G.stars) + '</div>';
    h += '<p style="text-align:center;margin:2px 0;color:var(--dim);font-size:12px">' + Math.round(100 * G.lives / G.maxLives) + '% base health left on ' + DIFFICULTIES[G.opts.diff].name + (G.stars > G.starsBefore ? ' &middot; <b style="color:var(--gold)">new best for this map!</b>' : G.starsBefore ? ' &middot; your best here: ' + G.starsBefore + ' stars' : '') + (G.opts.diff === 'easy' && G.stars === 2 ? ' &middot; Recruit tops out at 2 stars' : '') + '</p>';
  }
  if (dr) {
    const nf = (n) => Math.round(n).toLocaleString();
    h += '<div class="dscore">Score<b>' + nf(dr.score) + '</b>' + (dr.better ? '<span style="color:var(--gold);font-weight:800">New best today!</span>' : '<span style="color:var(--dim)">Today\'s best: ' + nf(dr.best) + '</span>') + '</div>';
    h += '<div class="drows"><span>Waves cleared (' + dr.cleared + ' x 1,000)</span><b>' + nf(dr.cleared * 1000) + '</b><span>Bosses defeated (' + dr.bosses + ' x 1,500)</span><b>' + nf(dr.bosses * 1500) + '</b><span>Kills (' + nf(dr.kills) + ' x 5)</span><b>' + nf(dr.kills * 5) + '</b>' + (dr.won ? '<span>Held all ' + MODES.daily.goal + ' waves</span><b>5,000</b><span>Base health left (' + dr.livesPct + '%)</span><b>' + nf(dr.lifeBonus) + '</b>' : '') + '</div>';
  }
  h += won ? '<p style="text-align:center">' + (dr ? 'You held today\'s front on ' + G.map.name + ' for all ' + MODES.daily.goal + ' waves!' : 'You held ' + G.map.name + ' through wave ' + G.wave + ' in ' + GAME_MODES[G.gm].name + (mode === 'campaign' ? ' (Campaign)' : '') + '!') + '</p>' : '<p style="text-align:center">The enemy broke through on wave <b>' + G.wave + '</b>.</p>';
  if (won && isCustomGame() && G.opts.mode !== 'sandbox') h += '<p style="text-align:center;color:var(--dim);font-size:12px;margin:2px 0">Custom map: the win is marked on its card in the Map Editor. Custom maps do not earn stars.</p>';
  h += statsHTML();
  const top = G.towers.filter(g => g.dealt > 0).sort((a, b) => b.dealt - a.dealt).slice(0, 3);
  if (top.length) h += '<div class="section-title">Top towers</div>' + top.map(g => '<div style="display:flex;justify-content:space-between;font-size:13px"><span>' + g.def.name + (g.units.length > 1 ? ' x' + g.units.length : '') + '</span><b>' + fmt(g.dealt) + ' dmg &middot; ' + g.kills + ' kills</b></div>').join('');
  $('end-body').innerHTML = h;
  $('b-end-endless').classList.toggle('hidden', !won || mode === 'daily');
  $('b-end-next').classList.toggle('hidden', !(won && mode === 'campaign' && !isCustomGame() && G.opts.map < MAPS.length - 1));
  $('b-end-menu').textContent = G.opts.test ? 'Back to Editor' : 'Main Menu';
  openModal('end');
}
$('b-end-menu').onclick = () => { closeModal('end'); leaveGame(); };
$('b-end-retry').onclick = () => { closeModal('end'); const o = Object.assign({}, G.opts); delete o.seed; startGame(o); };
$('b-end-next').onclick = () => { closeModal('end'); const o = Object.assign({}, G.opts); delete o.seed; o.map = Math.min(MAPS.length - 1, o.map + 1); startGame(o); };
$('b-end-endless').onclick = () => { closeModal('end'); G.over = false; G.won = false; G.endlessContinued = true; G.wave++; G.nextWave = buildWave(G.wave); saveGame(); updateHUD(true); toast('Endless mode: how far can you go?', '#ffd54f'); };
$('b-resume').onclick = () => setPaused(false);
$('b-quit').onclick = () => { saveGame(); setPaused(false); leaveGame(); };

// =====================================================================
//  MENUS
// =====================================================================
const menuPrefs = Object.assign({ gm: 'tower', diff: 'normal', mode: 'campaign', variant: 'normal' }, (() => { const o = store.get(KEYS.menu, {}); return isPlainObj(o) ? o : {}; })());     // new players start on Campaign; a length you picked before is kept
if (!PICKABLE_MODES.includes(menuPrefs.gm)) menuPrefs.gm = 'tower';
if (!own(DIFFICULTIES, menuPrefs.diff)) menuPrefs.diff = 'normal';
if (!own(MODES, menuPrefs.mode) || MODES[menuPrefs.mode].hidden) menuPrefs.mode = 'classic';
if (!PICKABLE_MODES.includes(menuPrefs.dailyGm)) menuPrefs.dailyGm = menuPrefs.gm;
if (!own(VARIANTS, menuPrefs.variant)) menuPrefs.variant = 'normal';
const SLOT_MODE_NAME = { tower: 'Tower', troop: 'Troop', legacy: 'Mixed' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtWhen(ts) {
  if (!ts) return 'before 2.5';
  try { const d = new Date(ts); if (isNaN(d.getTime())) return 'unknown'; const m = d.getMinutes(); return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getHours() + ':' + (m < 10 ? '0' : '') + m; } catch (e) { return 'unknown'; }
}
function slotLine(s) { return s.state === 'ok' ? SLOT_MODE_NAME[s.c.opts.gm] + ', ' + mapOf(s.c.opts).name + (s.c.opts.custom ? ' (custom)' : '') + ', wave ' + s.c.wave : s.state === 'bad' ? 'Damaged save' : 'Empty'; }
let slotArm = null;             // { n, kind: 'del' | 'new' }: a button waiting for its second tap
let slotArmTimer = 0;
let newSlot = 1, newOk = false, newPending = -1;   // New Game view: chosen slot, replace already confirmed, map waiting for a confirmation (-1 = none; a custom map is 'c:' + its id)
function armSlot(n, kind) { slotArm = n ? { n, kind } : null; clearTimeout(slotArmTimer); if (n) slotArmTimer = setTimeout(() => { slotArm = null; if (!$('menu-slots').classList.contains('hidden')) renderSlots(); }, 4000); }
function showMenu(which) {
  $('game-screen').classList.add('hidden'); $('editor-screen').classList.add('hidden'); $('menu-screen').classList.remove('hidden');
  for (const k of ['main', 'slots', 'new', 'daily', 'maps']) $('menu-' + k).classList.toggle('hidden', which !== k);
  if (which !== 'slots') armSlot(0);
  if (which === 'main') {
    const best = latestSlot();
    menuNote(migrationNote);
    $('btn-continue').classList.toggle('hidden', !best);
    const bad = allSlots().filter(s => s.state === 'bad').length;
    $('continue-info').textContent = best ? 'Continue: Slot ' + best.n + ' - ' + slotLine(best) + ', ' + DIFFICULTIES[best.c.opts.diff].name + ', ' + money$(best.c.money) : '';
    if (bad) menuNote((migrationNote ? migrationNote + ' ' : '') + (bad === 1 ? 'One save slot is damaged. A backup copy was kept.' : bad + ' save slots are damaged. Backup copies were kept.'));
    const r = getRecords();
    const stars = getStars(); const nStars = Object.values(stars).reduce((a, b) => a + b, 0);
    const dl = getDaily(), today = dl.days[dateKey()], drun = settleDailyRun(false);
    $('btn-daily').innerHTML = '&#9733; Daily Challenge' + (drun ? ' <small style="font-weight:600;font-size:12px">(resume wave ' + drun.wave + ')</small>' : today ? ' <small style="font-weight:600;font-size:12px">(best ' + fmt(today.s) + ')</small>' : '');
    $('records').innerHTML = 'Best wave: Tower <b>' + r.bestTower + '</b> &middot; Troop <b>' + r.bestTroop + '</b> &middot; Best endless: Tower <b>' + r.bestEndlessTower + '</b> &middot; Troop <b>' + r.bestEndlessTroop + '</b> &middot; Games: <b>' + r.games + '</b> &middot; Kills: <b>' + fmt(r.kills) + '</b> &middot; Stars: <b>' + nStars + ' / ' + MAPS.length * 3 + '</b> &middot; Daily best: <b>' + (dl.best.s ? fmt(dl.best.s) : '-') + '</b>' + (today ? ' (today <b>' + fmt(today.s) + '</b>)' : '');
  }
  if (which === 'slots') renderSlots();
  if (which === 'new') renderNewGame();
  if (which === 'daily') renderDaily();
  if (which === 'maps') renderMapsList();
}
function renderSlots() {
  const box = $('slot-list'); box.innerHTML = '';
  $('slot-note').textContent = migrationNote;
  allSlots().forEach(s => {
    const card = document.createElement('div'); card.className = 'slot-card' + (s.state === 'empty' ? ' empty' : '') + (s.n === activeSlot ? ' cur' : ''); card.dataset.slot = s.n;
    const mc = s.state === 'ok' ? GAME_MODES[s.c.opts.gm] : null;
    card.innerHTML = '<div class="slot-head"><span>SLOT ' + s.n + '</span>' + (mc ? '<span class="slot-tag" style="background:' + mc.color + '">' + SLOT_MODE_NAME[s.c.opts.gm].toUpperCase() + '</span>' : s.state === 'bad' ? '<span class="slot-tag" style="background:#c0392b">DAMAGED</span>' : '<span class="slot-tag">EMPTY</span>') + '</div>';
    if (s.state === 'ok') {
      const c = s.c, rows = [['Mode', SLOT_MODE_NAME[c.opts.gm]], ['Map', escHTML(mapOf(c.opts).name) + (c.opts.custom ? ' (custom)' : '')], ['Difficulty', DIFFICULTIES[c.opts.diff].name], ['Length', MODES[c.opts.mode].name + (c.endless ? ' (endless)' : '')], ['Wave', String(c.wave) + (MODES[c.opts.mode].goal && !c.endless ? ' / ' + MODES[c.opts.mode].goal : '')], ['Money', money$(c.money)], ['Lives', String(Math.floor(c.lives))], ['Last played', fmtWhen(s.ts)]];
      const d = document.createElement('div'); d.className = 'slot-rows'; d.innerHTML = rows.map(r => '<span>' + r[0] + '</span><b>' + r[1] + '</b>').join(''); card.appendChild(d);
    } else {
      const m = document.createElement('div'); m.className = 'slot-msg';
      m.textContent = s.state === 'bad' ? 'This save could not be read. A backup copy was kept.' + (s.hasBak ? ' A good older backup is available.' : '') : 'No saved game here.' + (s.hasBak ? ' A backup copy of an earlier game is available.' : '');
      card.appendChild(m);
    }
    const btns = document.createElement('div'); btns.className = 'slot-btns'; card.appendChild(btns);
    const mk = (txt, cls, fn, attr) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = txt; b.dataset.act = attr; b.onclick = fn; btns.appendChild(b); return b; };
    if (s.state === 'ok') mk('Continue', 'btn-green', () => { if (!loadSlot(s.n)) { toast('No saved game'); renderSlots(); } }, 'continue');
    if (s.state !== 'ok' && s.hasBak) mk('Restore backup', 'btn-blue', () => { restoreSlotBackup(s.n); renderSlots(); }, 'restore');
    const full = s.state !== 'empty';
    const armedNew = slotArm && slotArm.n === s.n && slotArm.kind === 'new';
    mk(armedNew ? 'Tap again: replace' : 'New Game here', 'btn-gold', () => {
      if (full && !armedNew) { armSlot(s.n, 'new'); renderSlots(); return; }
      armSlot(0); newSlot = s.n; newOk = true; newPending = -1; showMenu('new');
    }, 'new');
    if (full) { const armedDel = slotArm && slotArm.n === s.n && slotArm.kind === 'del';
      mk(armedDel ? 'Tap again: delete' : 'Delete', 'btn-red', () => { if (!armedDel) { armSlot(s.n, 'del'); renderSlots(); return; } armSlot(0); clearSlot(s.n); if (activeSlot === s.n) setActiveSlot(0); renderSlots(); }, 'delete'); }
    box.appendChild(card);
  });
}
function choiceRow(el, obj, key) {
  el.innerHTML = '';
  Object.entries(obj).forEach(([k, v]) => {
    if (v.hidden) return;
    const b = document.createElement('button'); b.className = 'btn choice ' + (v.color || '') + (menuPrefs[key] === k ? ' on' : '');
    b.innerHTML = v.name + '<small>' + v.desc + '</small>'; b.onclick = () => { menuPrefs[key] = k; store.set(KEYS.menu, menuPrefs); renderNewGame(); }; el.appendChild(b);
  });
}
function renderGmCards() {
  const box = $('gm-choices'); box.innerHTML = '';
  for (const k of PICKABLE_MODES) {
    const m = GAME_MODES[k], b = document.createElement('button'); b.className = 'btn gm-card' + (menuPrefs.gm === k ? ' on' : ''); b.style.setProperty('--gmc', m.color); b.dataset.gm = k;
    b.innerHTML = '<span class="gm-tag" style="background:' + m.color + '">' + m.tag + '</span><b class="gm-name">' + m.name + '</b><span class="gm-desc">' + m.desc + '</span><ul>' + m.bullets.map(x => '<li>' + x + '</li>').join('') + '</ul>' + (menuPrefs.gm === k ? '<span class="gm-sel">SELECTED</span>' : '');
    b.onclick = () => { menuPrefs.gm = k; store.set(KEYS.menu, menuPrefs); renderNewGame(); };
    box.appendChild(b);
  }
}
function renderSlotPick() {
  const box = $('slot-choices'); box.innerHTML = '';
  allSlots().forEach(s => {
    const b = document.createElement('button'); b.className = 'btn' + (newSlot === s.n ? ' on' : ''); b.dataset.slot = s.n;
    b.innerHTML = 'Slot ' + s.n + '<small>' + slotLine(s) + (s.state !== 'empty' ? ' (replaces it)' : '') + '</small>';
    b.onclick = () => { newSlot = s.n; newOk = false; newPending = -1; renderNewGame(); };
    box.appendChild(b);
  });
  const w = $('slot-warn'); w.classList.toggle('hidden', newPending === -1);
  if (newPending !== -1) {
    const s = slotInfo(newSlot); w.innerHTML = '';
    const t = document.createElement('span'); t.textContent = 'Slot ' + newSlot + ' already has a saved game (' + slotLine(s) + '). Starting here replaces it; a backup copy is kept.'; w.appendChild(t);
    const y = document.createElement('button'); y.className = 'btn btn-gold'; y.dataset.act = 'replace'; y.textContent = 'Replace Slot ' + newSlot; y.onclick = () => { newOk = true; const m = newPending; newPending = -1; beginNewGame(m); }; w.appendChild(y);
    const n = document.createElement('button'); n.className = 'btn'; n.dataset.act = 'cancel'; n.textContent = 'Cancel'; n.onclick = () => { newPending = -1; renderNewGame(); }; w.appendChild(n);
  }
}
// i = a built-in map index, or 'c:' + the id of a saved custom map
function beginNewGame(i) {
  const o = { gm: menuPrefs.gm, diff: menuPrefs.diff, mode: menuPrefs.mode, variant: menuPrefs.variant, map: typeof i === 'number' ? i : 0 };
  if (typeof i === 'string') { const e = getCustomMaps().find(x => 'c:' + x.id === i); if (!e) { newPending = -1; renderNewGame(); return; } o.custom = e.code; }
  setActiveSlot(newSlot);
  startGame(o);
}
function chooseMap(i) {
  if (slotInfo(newSlot).state !== 'empty' && !newOk) { newPending = i; renderNewGame(); const w = $('slot-warn'); if (w.scrollIntoView) try { w.scrollIntoView({ block: 'nearest' }); } catch (e) {} return; }
  beginNewGame(i);
}
function renderNewGame() {
  renderSlotPick();
  renderGmCards();
  choiceRow($('diff-choices'), DIFFICULTIES, 'diff'); choiceRow($('mode-choices'), MODES, 'mode'); choiceRow($('variant-choices'), VARIANTS, 'variant');
  // the map select: stars, difficulty, terrain and your best wave on every map (and, in Campaign, its four bosses)
  const grid = $('map-choices'); grid.innerHTML = ''; const stars = getStars(), best = getMapBest();
  const nStars = Object.values(stars).reduce((a, b) => a + b, 0), camp = menuPrefs.mode === 'campaign', starMode = camp || menuPrefs.mode === 'classic';
  $('map-head').innerHTML = '<span><span class="stars">&#9733;</span> <b>' + nStars + ' / ' + MAPS.length * 3 + '</b> stars</span><span>' + (starMode ? 'Win a map to earn stars: 3 stars for keeping 80% of your base health on Regular (60% on Veteran, 35% on Total War). Recruit tops out at 2 stars.' : 'Stars are earned by winning a map in Campaign or Classic.') + '</span>';
  MAPS.forEach((m, i) => {
    const b = document.createElement('button'); b.className = 'btn map-card'; b.dataset.map = i;
    const c = document.createElement('canvas'); c.width = 192; c.height = 120; drawMapPreview(c, m, menuPrefs.variant); b.appendChild(c);
    if (m.isNew) { const nw = document.createElement('span'); nw.className = 'mnew'; nw.textContent = 'NEW'; b.appendChild(nw); }
    const n = document.createElement('div'); n.className = 'mname'; const s = stars[i] || 0;
    n.innerHTML = (i + 1) + '. ' + m.name + ' <span class="stars">' + '&#9733;'.repeat(s) + '&#9734;'.repeat(3 - s) + '</span>';
    b.appendChild(n);
    const tg = document.createElement('div'); tg.className = 'mtags'; tg.innerHTML = mapTags(m).map(([cls, txt]) => '<span class="' + cls + '">' + txt + '</span>').join(''); b.appendChild(tg);
    if (m.note) { const nt = document.createElement('small'); nt.style.cssText = 'display:block;color:var(--dim);font-weight:500;font-size:11px;white-space:normal;margin-top:3px'; nt.textContent = m.note; b.appendChild(nt); }
    const bw = document.createElement('div'); bw.className = 'mbest'; bw.textContent = best[i] ? 'Best: wave ' + best[i] + ' cleared' : 'Not played yet'; b.appendChild(bw);
    if (camp) { const bb = document.createElement('div'); bb.className = 'mboss'; bb.textContent = 'Bosses: ' + bossLineup(i % BOSS_ROTATION.length, false, MODES.campaign.goal).map(id => ENEMY[id].name).join(', '); b.appendChild(bb); }
    b.onclick = () => chooseMap(i);
    grid.appendChild(b);
  });
  renderCustomChoices(camp);
}
// 3.0: your saved custom maps, under the built-in ones
function renderCustomChoices(camp) {
  const grid = $('custom-choices'); grid.innerHTML = '';
  const list = getCustomMaps();
  $('custom-title').innerHTML = 'Your custom maps <span style="letter-spacing:0;font-weight:600;text-transform:none">(' + list.length + ') &middot; no stars or achievements; each keeps its own best wave</span>';
  for (const e of list) {
    const m = e.m, b = document.createElement('button'); b.className = 'btn map-card'; b.dataset.cmap = e.id;
    const c = document.createElement('canvas'); c.width = 192; c.height = 120; drawMapPreview(c, m, menuPrefs.variant); b.appendChild(c);
    const n = document.createElement('div'); n.className = 'mname'; n.textContent = m.name; b.appendChild(n);
    const tg = document.createElement('div'); tg.className = 'mtags'; tg.innerHTML = mapTags(m).map(([cls, txt]) => '<span class="' + cls + '">' + txt + '</span>').join(''); b.appendChild(tg);
    const nt = document.createElement('small'); nt.style.cssText = 'display:block;color:var(--dim);font-weight:500;font-size:11px;white-space:normal;margin-top:3px'; nt.textContent = m.note; b.appendChild(nt);
    const bw = document.createElement('div'); bw.className = 'mbest'; bw.textContent = (e.won ? 'Won! ' : '') + (e.best ? 'Best: wave ' + e.best + ' cleared' : e.won ? '' : 'Not played yet'); b.appendChild(bw);
    if (camp) { const bb = document.createElement('div'); bb.className = 'mboss'; bb.textContent = 'Bosses: ' + bossLineup(hashStr(e.code) % BOSS_ROTATION.length, false, MODES.campaign.goal).map(id => ENEMY[id].name).join(', '); b.appendChild(bb); }
    b.onclick = () => chooseMap('c:' + e.id);
    grid.appendChild(b);
  }
  const mk = document.createElement('button'); mk.className = 'btn map-card newmap'; mk.dataset.act = 'editor';
  mk.innerHTML = '<b style="font-size:28px">&#9998;</b>' + (list.length ? 'Make another map' : 'Make your own map') + '<small style="color:var(--dim);font-weight:500;font-size:11px;margin-top:4px">Open the Map Editor</small>';
  mk.onclick = () => showMenu('maps'); grid.appendChild(mk);
}
// 'Hard', 'Ruined city', '3 entrances', 'Lava' ... for a map card
function mapTags(m) {
  const t = [['r' + (m.rank || 1), MAP_RANK[m.rank || 1] + (m.custom ? ' (est.)' : '')], ['', THEMES[m.theme].name]];
  const starts = new Set(m.paths.map(p => p[0][0] + ',' + p[0][1])).size;
  t.push(['', starts > 1 ? starts + ' entrances' : m.paths.length > 1 ? 'Branching road' : 'One road']);
  const kinds = new Set((m.water || []).map(f => f.poly ? 'Sea' : f.river ? 'River' : TERRAIN[own(TERRAIN, f.t) ? f.t : 'water'].name));
  for (const k of kinds) t.push(['', k === 'Water' ? 'Lakes' : k]);
  if (m.bonus) t.push(['r2', m.bonus + 'x bounty']);
  return t;
}
// the bosses of the boss waves up to 'goal' for a given rotation start (used by the map select and the Daily screen)
function bossLineup(shift, bossx, goal) { const out = [], L = BOSS_ROTATION.length; for (let n = bossx ? 5 : 10; n <= goal; n += bossx ? 5 : 10) out.push(BOSS_ROTATION[((n / (bossx ? 5 : 10) - 1 + shift) % L + L) % L]); return out; }
// ---- the Daily Challenge screen ----
let dailyArm = false, dailyArmT = 0;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function renderDaily() {
  const run = settleDailyRun(false), today = dateKey(), d = dailySetup(today), m = MAPS[d.map], dl = getDaily(), rec = dl.days[today];
  const now = new Date();
  $('daily-date').textContent = DAYS[now.getDay()] + ', ' + MONTHS[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear() + ' - the same front for everyone today. A new challenge every day at midnight.';
  drawMapPreview($('daily-canvas'), m, d.variant);
  const bosses = bossLineup(d.shift, d.mods.indexOf('bossx') >= 0, MODES.daily.goal);
  $('daily-mapinfo').innerHTML = '<b>' + m.name + '</b>' + (d.variant !== 'normal' ? ' <span class="tag">' + VARIANTS[d.variant].name + '</span>' : '') + mapTags(m).map(([c2, t]) => ' <span class="tag">' + t + '</span>').join('') +
    '<div style="margin-top:6px">' + MODES.daily.goal + ' waves on Regular. Boss waves: <span style="color:#ff8a80">' + bosses.map(id => ENEMY[id].name).join(', ') + '</span></div>';
  $('daily-mods').innerHTML = d.mods.map(id => { const md = DAILY_MOD[id]; return '<div class="dmod ' + (md.good ? 'good' : 'bad') + '"><span class="ico">' + (md.good ? '+' : '&minus;') + '</span><div><b>' + md.name + '</b>' + md.desc + '</div></div>'; }).join('');
  let week = '';
  for (let i = 6; i >= 0; i--) { const dd = new Date(); dd.setDate(dd.getDate() - i); const k = dateKey(dd), r = dl.days[k]; week += '<div class="' + (r ? 'on' : '') + (i === 0 ? ' today' : '') + '">' + DAYS[dd.getDay()].slice(0, 3) + '<b>' + (r ? fmt(r.s) : '-') + '</b></div>'; }
  $('daily-rec').innerHTML = '<div class="drec"><span>Today\'s best</span><b>' + (rec ? fmt(rec.s) + ' (' + (rec.won ? 'won' : rec.w + ' wave' + (rec.w === 1 ? '' : 's')) + ')' : 'not played yet') + '</b><span>Best ever</span><b>' + (dl.best.s ? fmt(dl.best.s) + ' (' + dl.best.d + ')' : '-') + '</b><span>Streak</span><b>' + dailyStreak(dl) + ' day' + (dailyStreak(dl) === 1 ? '' : 's') + '</b><span>Runs played</span><b>' + dl.plays + '</b></div><div class="dweek">' + week + '</div>';
  const gmBox = $('daily-gm'); gmBox.innerHTML = '';
  for (const k of PICKABLE_MODES) { const g = GAME_MODES[k], b = document.createElement('button'); b.className = 'btn choice' + (menuPrefs.dailyGm === k ? ' on' : ''); b.dataset.gm = k; b.innerHTML = g.name + '<small>' + g.desc + '</small>'; b.onclick = () => { menuPrefs.dailyGm = k; store.set(KEYS.menu, menuPrefs); renderDaily(); }; gmBox.appendChild(b); }
  const go = $('btn-daily-go'), rs = $('btn-daily-resume');
  rs.classList.toggle('hidden', !run);
  if (run) rs.innerHTML = '&#9654; Resume (' + SLOT_MODE_NAME[run.opts.gm] + ', wave ' + run.wave + ')';
  go.innerHTML = run ? (dailyArm ? 'Tap again: start over' : 'Start over') : '&#9654; Start today\'s challenge';
  go.className = 'btn btn-big ' + (run ? 'btn-red' : 'btn-gold');
  $('daily-note').textContent = 'Score: 1,000 per wave cleared, 1,500 per boss, 5 per kill; holding all ' + MODES.daily.goal + ' waves adds 5,000 plus up to 5,000 for base health left. Play as often as you like: your best run of the day counts. Daily runs save after every wave on their own and never touch your save slots.' + (run ? ' Starting over records your current run (wave ' + run.wave + ') first.' : '');
}
$('btn-daily').onclick = () => { dailyArm = false; showMenu('daily'); };
$('btn-daily-back').onclick = () => showMenu('main');
$('btn-daily-resume').onclick = () => { dailyArm = false; if (!resumeDaily()) renderDaily(); };
$('btn-daily-go').onclick = () => {
  if (dailyRunInfo() && !dailyArm) { dailyArm = true; clearTimeout(dailyArmT); dailyArmT = setTimeout(() => { dailyArm = false; if (!$('menu-daily').classList.contains('hidden')) renderDaily(); }, 4000); renderDaily(); return; }
  dailyArm = false; startDaily(menuPrefs.dailyGm);
};
function drawMapPreview(c, m, variant) {
  const x = c.getContext('2d'), sx = c.width, sy = c.height, th = THEMES[m.theme] || THEMES.grass;
  const fx = variant === 'mirror' || variant === 'both', fy = variant === 'flip' || variant === 'both';
  const tx = (a) => fx ? 1 - a : a, ty = (b) => fy ? 1 - b : b;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.fillStyle = th.ground; x.fillRect(0, 0, sx, sy); x.lineJoin = 'round'; x.lineCap = 'round';
  if (m.water) drawTerrain(x, terrainList(m, tx, ty), th, sx / W);
  if (m.deco && m.deco.length) { x.save(); x.scale(sx / W, sy / H); for (const o of m.deco) drawDeco(x, { x: tx(o.x) * W, y: ty(o.y) * H, r: 15, kind: o.k, s: o.s }); x.restore(); }
  for (const [w, col] of [[11, th.edge], [8, th.path]]) for (const p of m.paths) { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); p.forEach(([px, py], j) => j ? x.lineTo(tx(px) * sx, ty(py) * sy) : x.moveTo(tx(px) * sx, ty(py) * sy)); x.stroke(); }
  const e = m.paths[0][m.paths[0].length - 1]; x.fillStyle = '#795548'; x.fillRect(tx(e[0]) * sx - 7, ty(e[1]) * sy - 7, 14, 14);
}
$('btn-new').onclick = () => { const sl = allSlots(); const e = sl.find(s => s.state === 'empty'); newSlot = e ? e.n : (activeSlot || 1); newOk = false; newPending = -1; showMenu('new'); };
$('btn-slots').onclick = () => showMenu('slots');
$('btn-slots-back').onclick = () => showMenu('main');
$('btn-new-back').onclick = () => showMenu('main');
$('btn-continue').onclick = () => { const s = latestSlot(); if (!s || !loadSlot(s.n)) { toast('No saved game'); showMenu('main'); } };
function toMenu() { applyModeCosts('legacy'); G = null; activeSlot = 0; paused = false; parts.length = 0; showMenu('main'); }
// quitting a game: a Map Editor test run goes back to the editor, everything else to the main menu
function leaveGame() { const test = !!(G && G.opts.test); toMenu(); if (test) openEditor(); }

