// ----- save tools -----
function exportCode() {
  if (!running || !state) {                       // from the main menu: export whatever is stored
    const raw = store.get(SAVE_KEY) || store.get(PREV_KEY) || '';
    try { return raw ? 'BBT3:' + btoa(unescape(encodeURIComponent(raw))) : ''; } catch (e) { return raw; }
  }
  const json = JSON.stringify(buildSave()); try { return 'BBT3:' + btoa(unescape(encodeURIComponent(json))); } catch (e) { return json; } }
function parseCode(txt) {
  txt = String(txt || '').trim();
  if (!txt) throw new Error('empty');
  if (txt.indexOf('BBT3:') === 0) txt = decodeURIComponent(escape(atob(txt.slice(5).replace(/\s+/g, ''))));
  return normalizeState(JSON.parse(txt));
}
function saveMsg(t, good) { const m = $('save-msg'); if (m) { m.textContent = t; m.className = 'msg ' + (good ? 'good' : 'bad'); } }

// ----- menu / game flow -----
function showMenu() {
  running = false;
  $('menu').classList.remove('hidden');
  const raw = store.get(SAVE_KEY) || store.get(PREV_KEY);
  const cont = $('m-continue'), sum = $('m-sum');
  if (raw) {
    const sm = saveSummary(raw);
    cont.classList.remove('hidden'); sum.classList.remove('hidden');
    sum.textContent = sm ? money(sm.money) + ' - ' + sm.shops + ' shop' + (sm.shops > 1 ? 's' : '') + ' - ' + sm.rank + (sm.at ? ' - saved ' + ago(Date.now() - sm.at) : '') : 'Your save could not be read. You can try Settings > Backups or Import.';
    if (!sm) cont.classList.add('hidden');
  } else { cont.classList.add('hidden'); sum.classList.add('hidden'); }
  $('m-new').firstElementChild.nextElementSibling.textContent = raw ? 'New Game' : 'Start Game';
  if (!store.ok && !V.warnedStore) { V.warnedStore = true; }
  toggleCls($('m-news-n'), 'hidden', settings.seenVer === GAME_VER);
}
function startNew(force, mode) {
  const raw = store.get(SAVE_KEY);
  const go = () => {
    if (raw) store.set(STASH_KEY, raw);     // never lose the old game: it is kept as a restorable backup
    state = defaultState();
    state.mode = mode === 'free' ? 'free' : 'career';
    cur = 0;
    beginPlay(true);
  };
  const what = mode === 'free' ? 'Start a Free Play game (no story)?' : 'Start a new career?';
  if (raw && !force) ask(what, 'Your current game is saved as a backup. You can restore it later in Settings.', 'New game', go);
  else go();
}
function continueGame() {
  const res = loadFromStorage();
  if (!res) { toast('Could not read the save. Try Settings > Backups or Import.', 'bad', 'warn'); return; }
  if (res.from === PREV_KEY) toast('Your main save was damaged, so the backup was loaded.', 'info', 'warn');
  try {
    const parsed = JSON.parse(res.raw);
    if (!parsed.ver && !store.get(LEGACY_KEY)) store.set(LEGACY_KEY, res.raw);   // keep an untouched copy of the pre-update save
  } catch (e) { /* ignore */ }
  state = res.state; cur = 0;
  beginPlay(false);
}
function beginPlay(isNew, imported) {
  $('menu').classList.add('hidden');
  if ($('dlg') && !imported) { $('dlg').classList.add('hidden'); dlgKind = null; }
  rt.startTick = state.tick; rt.rank = rankIdx(); rt.inc.fill(0); rt.incIdx = Math.floor(state.tick / 25) % 12;
  rt.rankUp = null; rt.away = null; rt.latte = null; rt.careerJust = null; rt.careerPop = false;
  paused = false; speed = 1; acc = 0; tool = 'cursor';
  lastSim = performance.now();
  for (const k in V) delete V[k];
  fxClear(); gfx.staticDirty = true; gfx.hover = null;
  $('log').innerHTML = '';
  tabCur = 'build';
  state.locations.forEach(l => { l._d = true; });
  state.tutorial = state.tutorial === undefined ? 0 : state.tutorial;
  // away earnings
  let away = null;
  if (!isNew && state.savedAt) {
    const sec = (Date.now() - state.savedAt) / 1000;
    if (sec > 90) { away = applyAway(sec); if (away.money > 0) rt.away = away; }
  }
  state.recent = state.recent || [];
  if (state._legacy) {
    // an older save: mark goals it already satisfies as done (no payout, so nobody gets a flood of rewards)
    delete state._legacy;
    state.locations.forEach(l => { l._d = true; });
    GOALS.forEach(g => { if (g.m() >= g.t) state.goals[g.id] = true; });
  }
  if (state._upgraded) { delete state._upgraded; rt.upgradedMsg = true; }     // a save from before 2.0: introduce the new features once
  running = true;
  document.body.classList.toggle('lowfx', !!settings.lowfx);
  applyLayout();
  selectTool('cursor');
  renderTutorial();
  log(isNew ? 'Welcome to your new cafe!' : 'Welcome back, boss!', 'good');
  updateUI();
  writeSave('start'); updateSaveInd();
  if (rt.away) openDlg('away');
  if (rt.upgradedMsg && state.tutorial === -1 && careerOn()) rt.careerPop = true;    // the story intro opens once the welcome-back window is closed
  if (rt.upgradedMsg) { rt.upgradedMsg = false; toast('Bean & Brew ' + GAME_VER + ': seasons, a career story, latte art and championships! Your progress is safe.', 'goal', 'sparkle'); }
  if (!store.ok) toast('This page cannot save in your browser. Use Settings > Export save to keep your progress.', 'bad', 'warn');
}
function wakeUp(sec) {
  // the computer slept or the tab was frozen for a long time
  const a = applyAway(sec);
  if (a.money > 0) { rt.away = a; if (!dlgKind) openDlg('away'); }
  updateUI();
}

// ----- save indicator and autosave -----
let saveTimer = null;
function requestSave() { if (saveTimer || !running) return; saveDirty = true; saveTimer = setTimeout(() => { saveTimer = null; if (running) writeSave('action'); updateSaveInd(); }, 1500); }
function updateSaveInd() {
  const el = $('saveind'); if (!el) return;
  if (!store.ok) { el.textContent = 'not saving - export in Settings'; el.className = 'saveind bad'; }
  else if (store.failed) { el.textContent = 'save failed (storage full?)'; el.className = 'saveind bad'; }
  else { const s = Math.max(0, Math.floor((Date.now() - lastSaveAt) / 1000)); el.textContent = lastSaveAt ? (s < 5 ? 'saved' : 'saved ' + s + 's ago') : 'not saved yet'; el.className = 'saveind'; }
  const ss = $('save-status');
  if (ss) ss.textContent = !store.ok ? 'This browser blocks storage for this page (common in embedded players). Your progress cannot be saved automatically - use Export to keep a copy.' : ('Autosaves every few seconds and after big actions. Last saved ' + (lastSaveAt ? ago(Date.now() - lastSaveAt) : 'never') + '.');
}

// ----- event wiring -----
function onAction(act, d, el) {
  Snd.init();
  switch (act) {
    case 'tool': selectTool(d.tool); break;
    case 'pause': togglePause(); break;
    case 'speed': cycleSpeed(); break;
    case 'dlg': openDlg(d.d); break;
    case 'close': closeDlg(); break;
    case 'tab': setTab(d.tab); Snd.play('click'); document.querySelectorAll('#tabs .pulse').forEach(x => x.classList.remove('pulse')); break;
    case 'shop': switchShop(parseInt(d.i, 10)); break;
    case 'expand': tryExpand(); break;
    case 'hire': hireStaff(d.role); break;
    case 'fire': fireStaff(d.id); break;
    case 'buy': buyPack(d.type, parseInt(d.n, 10) || 1); break;
    case 'brewall': brewAll(); break;
    case 'blend': curLoc().restockerTargetBean = d.v; Snd.play('click'); updateUI(); requestSave(); break;
    case 'brewpref': if (d.v === 'beans_luxury' && !unlocked('beans_luxury')) { toast('Luxury beans unlock at rank: ' + RANKS[1].n, 'bad', 'lock'); break; } curLoc().brewPref = d.v; Snd.play('click'); updateUI(); requestSave(); break;
    case 'upgrade': buyUpgrade(d.id); break;
    case 'staffdlg': rt.staffSel = d.id; openDlg('staff'); break;
    case 'train': trainStaff(d.id); break;
    case 'learn': learnSkill(d.id, d.b); break;
    case 'rtab': rt.recTab = d.v; Snd.play('click'); renderDlg(); break;
    case 'labbase': { const b = parseInt(d.v, 10); if (b === 2 && !unlocked('beans_luxury')) { toast('Luxury coffee unlocks at rank: ' + RANKS[1].n, 'bad', 'lock'); break; } rt.lab.base = b; rt.lab.msg = ''; Snd.play('click'); renderDlg(true); break; }
    case 'labing': rt.lab.msg = ''; labToggle(d.k); break;
    case 'labclear': rt.lab.ing = []; rt.lab.msg = ''; Snd.play('click'); renderDlg(true); break;
    case 'experiment': experiment(); updateUI(); break;
    case 'menutog': menuToggle(d.id); break;
    case 'hint': buyHint(d.id); break;
    case 'cityunlock': unlockCity(d.city); break;
    case 'cityopen': openShopIn(d.city); break;
    case 'fropen': openFranchise(d.city); break;
    case 'frup': franchiseAct('up', d.id); break;
    case 'frtrain': franchiseAct('train', d.id); break;
    case 'frsell': franchiseAct('sell', d.id); break;
    case 'goshop': closeDlg(); switchShop(parseInt(d.i, 10)); break;
    case 'evpick': if (resolveEvent(parseInt(d.i, 10))) closeDlg(); break;
    case 'latte': openLatte('serve'); break;
    case 'latpat': lattePatPick(d.id); break;
    case 'latdone': latteFinish(); break;
    case 'latagain': if (rt.latte && rt.latte.mode === 'serve') { rt.latte.phase = 'pour'; latteReset(); Snd.play('click'); renderDlg(); } break;
    case 'latnext': latteNext(); break;
    case 'champ': {
      const C0 = CHAMP_BY_ID[d.id]; if (!C0) break;
      if (state.globalMoney < C0.fee) { toast('The entry fee is ' + money(C0.fee) + '.', 'bad', 'coin'); Snd.play('error'); break; }
      if (settings.confirm) ask('Enter the ' + C0.n + '?', 'The entry fee is ' + money(C0.fee) + '. You will pour 3 latte art patterns against ' + C0.rival + '. Leaving before the end forfeits the fee.', 'Enter for ' + money(C0.fee), () => openLatte('contest', C0.id));
      else openLatte('contest', C0.id);
      break;
    }
    case 'careerclaim': claimChapter(); break;
    case 'careerstart': ask('Start the story?', 'Career mode adds ' + CAREER.length + ' story chapters with objectives and rewards. You keep everything you have.', 'Start the story', startCareer); break;
    case 'm-free': startNew(false, 'free'); break;
    case 'tutskip': ask('Skip the tutorial?', 'You can replay it any time from the How to play window.', 'Skip', () => { state.tutorial = -1; renderTutorial(); updateUI(); }); break;
    case 'tutreplay': state.tutorial = 0; closeDlg(); renderTutorial(); updateUI(); break;
    case 'm-continue': continueGame(); break;
    case 'm-new': startNew(false, 'career'); break;
    case 'ask-yes': closeAsk(true); break;
    case 'ask-no': closeAsk(false); break;
    case 'set': { const k = d.k; settings[k] = !settings[k]; saveSettings(); Snd.apply(); if (k === 'lowfx') document.body.classList.toggle('lowfx', settings.lowfx); if (k === 'numbers' && !settings.numbers) fx.texts.length = 0; Snd.play('click'); renderDlg(true); break; }
    case 'savenow': { if (!running) { saveMsg('Nothing to save yet - start or continue a game first.', false); break; } const ok = writeSave('manual'); updateSaveInd(); saveMsg(ok ? 'Saved!' : 'Could not save in this browser. Use Export.', ok); break; }
    case 'export': { const box = $('save-box'); box.value = exportCode(); if (!box.value) { saveMsg('There is no saved game to export yet.', false); break; } box.focus(); box.select(); saveMsg('Copy this code and keep it somewhere safe. Paste it here later to restore.', true); break; }
    case 'copysave': {
      const box = $('save-box'); if (!box.value) box.value = exportCode();
      if (!box.value) { saveMsg('There is no saved game to copy yet.', false); break; }
      box.focus(); box.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      if (!ok && navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(box.value).then(() => saveMsg('Copied!', true), () => saveMsg('Select the text and copy it by hand (Ctrl+C).', false)); }
      else saveMsg(ok ? 'Copied!' : 'Select the text and copy it by hand (Ctrl+C).', ok);
      break;
    }
    case 'import': {
      let s; try { s = parseCode($('save-box').value); } catch (e) { saveMsg('That is not a valid save code.', false); break; }
      const sm = { m: s.globalMoney, n: s.locations.length };
      ask('Load this save?', 'It has ' + money(sm.m) + ' and ' + sm.n + ' shop(s). Your current game will be kept as a backup.', 'Load save', () => {
        const cur0 = store.get(SAVE_KEY); if (cur0) store.set(STASH_KEY, running ? JSON.stringify(buildSave()) : cur0);
        state = s; cur = 0; writeSave('import'); closeDlg(); beginPlay(false, false); toast('Save loaded!', 'goal', 'check');
      });
      break;
    }
    case 'restore': {
      const raw = store.get(d.k), sm = raw && saveSummary(raw);
      if (!sm) { toast('That backup cannot be read.', 'bad', 'warn'); break; }
      ask('Restore this backup?', 'You will go back to ' + money(sm.money) + ' and ' + sm.shops + ' shop(s). Your current game is kept as a backup too.', 'Restore', () => {
        const cur0 = running ? JSON.stringify(buildSave()) : store.get(SAVE_KEY);
        let s; try { s = readSaveText(raw); } catch (e) { return; }
        if (cur0) store.set(STASH_KEY, cur0);
        state = s; cur = 0; writeSave('restore'); closeDlg(); beginPlay(false, false); toast('Backup restored!', 'goal', 'check');
      });
      break;
    }
    case 'tomenu': writeSave('menu'); closeDlg(); showMenu(); break;
    case 'reset': ask('Erase ALL progress?', 'This deletes your save, backups and settings for this game. This cannot be undone.', 'Erase everything', () => {
      [SAVE_KEY, PREV_KEY, STASH_KEY, LEGACY_KEY, SET_KEY].forEach(k => store.remove(k));
      running = false; state = null; settings = Object.assign({}, DEFAULT_SETTINGS); closeDlg(); showMenu();
    }, true); break;
  }
}
function lineTiles(x0, y0, x1, y1) {
  const out = [], dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0, guard = 0;
  while ((x !== x1 || y !== y1) && guard++ < 40) {
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
    out.push({ x: x, y: y });
  }
  return out;
}
function setupEvents() {
  document.addEventListener('click', e => {
    const t = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!t) return;
    if (t.disabled) return;
    onAction(t.dataset.act, t.dataset, t);
  });
  $('goalbar').addEventListener('click', () => { Snd.init(); openDlg($('goalbar').classList.contains('story') ? 'career' : 'goals'); });
  document.addEventListener('input', e => {
    if (e.target && e.target.id === 'vol') {
      settings.volume = clamp(e.target.value / 100, 0, 1); Snd.init(); Snd.apply(); saveSettings();
      const vt = $('vol-txt'); if (vt) vt.textContent = e.target.value + '%';
    }
  });
  document.addEventListener('change', e => { if (e.target && e.target.id === 'vol') Snd.play('coin'); });
  // canvas pointer input
  const cv = gfx.cv;
  const tileAt = e => {
    const r = cv.getBoundingClientRect();
    if (!r.width) return null;
    const lx = (e.clientX - r.left) * (CANVAS_PX / r.width) - (FRAME - 1), ly = (e.clientY - r.top) * (CANVAS_PX / r.height) - (FRAME - 1);
    const x = Math.floor(lx / TS), y = Math.floor(ly / TS);
    if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return null;
    return { x: x, y: y };
  };
  const hoverStatus = t => {
    if (!t || !state) return;
    const loc = curLoc();
    let txt = tileDesc(loc, t.x, t.y);
    const who = loc.staff.find(s => s.x === t.x && s.y === t.y), cu = loc.customers.find(c => c.x === t.x && c.y === t.y);
    if (who) txt = who.name + ' the ' + ROLES[who.role].name + ' - ' + (who.status || 'ready');
    else if (cu && tool === 'cursor') txt = KINDS[cu.kind].name + ' wants ' + TIER_NAME[cu.tier] + ' coffee' + (cu.state === 'waiting' ? ' (' + Math.max(0, Math.ceil((cu.maxWait - cu.wait) / 5)) + 's of patience left)' : '');
    if (tool !== 'cursor' && tool !== 'erase') { const cb = canBuild(loc, tool, t.x, t.y); txt = (cb.ok ? 'Click to build ' + TOOL_BY_ID[tool].name + ' (' + (cb.cost ? money(cb.cost) : 'free') + ')' : (cb.why || txt)); }
    else if (tool === 'erase' && loc.grid[t.y][t.x]) txt = 'Click to bulldoze: ' + tileDesc(loc, t.x, t.y);
    setStatus(txt);
  };
  cv.addEventListener('pointerdown', e => {
    if (!running || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault(); Snd.init();
    try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
    gfx.dragging = true; gfx.lastKey = '';
    const t = tileAt(e); gfx.hover = t; gfx.lastTile = t;
    if (t) { hoverStatus(t); clickTile(t.x, t.y, true); }
  });
  cv.addEventListener('pointermove', e => {
    if (!running) return;
    const t = tileAt(e); gfx.hover = t;
    if (!t) return;
    if (!gfx.dragging || e.pointerType === 'mouse') hoverStatus(t);
    if (gfx.dragging && tool !== 'cursor' && (t.x + ',' + t.y) !== gfx.lastKey) {
      // fast drags skip tiles, so fill in every tile on the straight line since the last one
      const a = gfx.lastTile || t;
      lineTiles(a.x, a.y, t.x, t.y).forEach(p => clickTile(p.x, p.y, false));
      gfx.lastTile = t;
    }
  });
  const up = e => { gfx.dragging = false; if (e.pointerType && e.pointerType !== 'mouse') setTimeout(() => { if (!gfx.dragging) gfx.hover = null; }, 700); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { gfx.hover = null; if (!gfx.dragging) setStatus(''); } });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  // keyboard
  document.addEventListener('keydown', e => {
    const tg = e.target, typing = tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA');
    if (e.key === 'Escape') {
      if (!$('ask').classList.contains('hidden')) closeAsk(false);
      else if (dlgKind) closeDlg();
      else if (running) selectTool('cursor');
      return;
    }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!running || !$('ask').classList.contains('hidden')) return;
    const k = e.key.toLowerCase();
    if (dlgKind && k !== 'g' && k !== 'u' && k !== 'h' && k !== 'r' && k !== 'c' && k !== 'k') return;
    if (dlgKind === 'event' || dlgKind === 'latte') return;
    if (k >= '1' && k <= '9') { const t = MAIN_TOOLS[+k - 1]; if (t) selectTool(t.id); }
    else if (k === ' ') { e.preventDefault(); if (document.activeElement && document.activeElement.blur && document.activeElement.tagName === 'BUTTON') document.activeElement.blur(); togglePause(); }
    else if (k === 'b') brewAll();
    else if (k === 'g') (dlgKind === 'goals' ? closeDlg() : openDlg('goals'));
    else if (k === 'u') (dlgKind === 'upgrades' ? closeDlg() : openDlg('upgrades'));
    else if (k === 'h') (dlgKind === 'help' ? closeDlg() : openDlg('help'));
    else if (k === 'r') (dlgKind === 'recipes' ? closeDlg() : openDlg('recipes'));
    else if (k === 'c') (dlgKind === 'chain' ? closeDlg() : openDlg('chain'));
    else if (k === 'k') (dlgKind === 'career' ? closeDlg() : openDlg('career'));
    else if (k === 'l') openLatte('serve');
    else if (k === 'm') { settings.sound = !settings.sound; saveSettings(); Snd.apply(); toast(settings.sound ? 'Sound on' : 'Sound off', 'info', settings.sound ? 'volume' : 'mute'); }
  });
  window.addEventListener('resize', applyLayout);
  window.addEventListener('orientationchange', () => setTimeout(applyLayout, 120));
  if (window.ResizeObserver) { try { new ResizeObserver(() => fitCanvas()).observe($('stage')); } catch (e) { /* ignore */ } }
  document.addEventListener('visibilitychange', () => { if (document.hidden && running) writeSave('hide'); else lastSim = performance.now(); });
  window.addEventListener('pagehide', () => { if (running) writeSave('leave'); });
  window.addEventListener('beforeunload', () => { if (running) writeSave('leave'); });
}

// ----- main loops -----
let lastSim = performance.now(), lastUI = 0;
function simStep() {
  const now = performance.now();
  let dt = now - lastSim; lastSim = now;
  if (!running || !state) return;
  if (dt > 45000 && !paused) { acc = 0; wakeUp(dt / 1000); return; }
  if (!paused) {
    acc += Math.min(dt, 15000) * speed;
    let n = 0;
    while (acc >= TICK_MS && n < 1500) { tick(); acc -= TICK_MS; n++; }
    if (n >= 1500) acc = 0;
  }
  if (now - lastUI > 200 || (rt.dirtyUI && now - lastUI > 100)) { lastUI = now; updateUI(); }
}
let fpsT = 0, fpsN = 0, fpsLow = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (!running || !state) return;
  fpsN++;
  if (now - fpsT >= 5000) {
    const fps = fpsN * 1000 / (now - fpsT);
    if (fpsT && fps < 22 && !document.hidden && !paused) fpsLow++; else fpsLow = 0;
    if (fpsLow >= 2 && !settings.lowfx && !V.fpsTip) { V.fpsTip = true; toast('Game running slowly? Turn on "Reduce effects" in Settings.', 'info', 'settings'); }
    fpsT = now; fpsN = 0;
  }
  try { render(now); } catch (e) { if (!V.renderErr) { V.renderErr = true; console.error(e); } }
  if (dlgKind === 'latte' && rt.latte) { const dt = clamp((now - (rt.latteT || now)) / 1000, 0, 0.1); rt.latteT = now; latteFrame(dt); } else rt.latteT = 0;
}
function boot() {
  store.probe();
  loadSettings();
  document.body.classList.toggle('lowfx', !!settings.lowfx);
  buildStaticUI();
  gfx.cv = $('game'); gfx.ctx = gfx.cv.getContext('2d');
  gfx.stat = document.createElement('canvas'); gfx.sctx = gfx.stat.getContext('2d');
  setupEvents();
  applyLayout();
  showMenu();
  setInterval(simStep, 50);
  setInterval(() => { if (running) { writeSave('auto'); } updateSaveInd(); }, 8000);
  setInterval(() => { if (running) updateSaveInd(); }, 1000);
  requestAnimationFrame(frame);
}
// Small debug/test hook (used by automated play tests; harmless for players).
window.__coffee = {
  get state() { return state; }, get cur() { return cur; }, get dlg() { return dlgKind; },
  tick(n) { for (let i = 0; i < (n || 1); i++) tick(); updateUI(); },
  event(type) { return triggerEvent(type); },
  money(m) { state.globalMoney = m; updateUI(); },
  rating: l => rating(l || curLoc()), priceMult: l => priceMult(l || curLoc()), frNet: frNet, canMake: canMake,
  spawn(kind, i) { return spawnCustomer(state.locations[i === undefined ? cur : i], kind); },
  save() { return writeSave('test'); },
  // 2.0: jump the calendar, read the season, look at latte art / career state
  setDay(d, hour) { state.tick = d * DAY_TICKS + Math.floor(DAY_TICKS * (hour === undefined ? 8 : hour) / 24); state.locations.forEach(l => { l._d = true; }); gfx.staticDirty = true; V.dayKey = null; updateUI(); },
  season: () => ({ idx: seasonIdx(), name: curSeason().name, day: seasonDay(), year: yearNum(), holiday: curHoliday() ? curHoliday().id : null, spawn: seasonSpawn(curLoc()) }),
  pattern: id => PAT_GEO[id], latte: () => rt.latte, latteScore: () => (rt.latte ? latteLive() : null), career: () => state.career
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

