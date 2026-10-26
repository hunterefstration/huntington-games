// ---------- SAVED RUN (AUTO-SAVE) ----------
// Single player auto-saves a checkpoint to this browser every time a wave is cleared (and again when you leave the
// between-wave armory, so purchases stick): the map (same layout), lighting, wave, money, weapons, upgrades, perks,
// health and armour. CONTINUE on the main menu picks it back up at the start of the next wave.
// 3.8: dying deletes it (permadeath). Never in sandbox or multiplayer.
const RUN_KEY = 'huntington.blockyshooter.run.v1';   // namespaced: every Huntington game shares one browser origin
const RUN_KEY_OLD = 'blocky_run_save';                  // 3.5 auto-save: still readable, replaced by the next save
const runSaveOK = () => !NET.on && run.mode !== 'sandbox' && !CAMP.on;
let storageGood = null, savedWave = -1, delArm = 0, badgeT = 0;
function storageOK() {                                  // false in sandboxed iframes / private windows / blocked site data
    if (storageGood === null) {
        try { const k = 'huntington.blockyshooter.probe'; localStorage.setItem(k, '1'); storageGood = localStorage.getItem(k) === '1'; localStorage.removeItem(k); }
        catch (e) { storageGood = false; }
    }
    return storageGood;
}
// 'none' (not a saveable run) / 'off' (storage blocked) / 'wait' (wave in progress) / 'ok' (wave break, not saved yet) / 'done' (wave break, saved)
function saveStatus() {
    if (NET.on || !run || run.mode === 'sandbox' || (currentGameState !== 'shop' && currentGameState !== 'paused' && currentGameState !== 'playing')) return 'none';
    if (!storageOK()) return 'off';
    if (waveActive || currentHp <= 0) return 'wait';
    const inBreak = (currentGameState === 'shop' && returnMenuState === 'nextwave') || intermission > 0;
    if (!inBreak) return 'wait';
    return savedWave === playerStats.level ? 'done' : 'ok';
}
function saveRun(phase = 'shop') {
    if (!runSaveOK() || currentHp <= 0 || !storageOK()) return false;
    try {
        const json = JSON.stringify({ v: 1, phase, run, theme: themeId, stats: playerStats, hp: currentHp, maxHp, armor: currentArmor,
                        strikes: strikeCharges, streak, runStats, runXP, seen: [...seenTypes], abil: Math.ceil(abilityCd), savedAt: Date.now() });   // 4.0: stats.cls / stats.clsUp = class + upgrades
        localStorage.setItem(RUN_KEY, json);
        if (localStorage.getItem(RUN_KEY) !== json) return false;
        localStorage.removeItem(RUN_KEY_OLD);
    } catch (e) { return false; }
    updateContinueBtn();
    return true;
}
function saveBadge(msg, bad) {
    const b = $('save-badge'); if (!b) return;
    b.textContent = msg;
    b.style.borderColor = bad ? '#f87171' : '#22c55e'; b.style.color = bad ? '#fecaca' : '#bbf7d0'; b.style.background = bad ? 'rgba(69,10,10,0.85)' : 'rgba(5,46,22,0.85)';
    b.style.opacity = '1';
    clearTimeout(badgeT); badgeT = setTimeout(() => { b.style.opacity = '0'; }, 3200);
}
// Called between waves only (the checkpoint is always "the start of wave playerStats.level")
function autoSaveRun(show) {
    if (!runSaveOK() || currentHp <= 0 || waveActive) return false;
    if (!storageOK()) { if (show && savedWave !== -2) { savedWave = -2; saveBadge('Auto-save unavailable - browser storage is blocked', true); } return false; }
    const ok = saveRun('shop');
    if (ok) { savedWave = playerStats.level; if (show) saveBadge(`\u2714 Progress saved (Wave ${playerStats.level - 1} cleared)`); }
    else if (show) saveBadge('Auto-save failed - browser storage is full or blocked', true);
    refreshSaveUI();
    return ok;
}
function saveIfInBreak() { const st = saveStatus(); if (st === 'ok' || st === 'done') autoSaveRun(false); }
function paintSaveNote(note, inShop) {
    const st = saveStatus();
    note.classList.toggle('hidden', st === 'none');
    if (st === 'none') return;
    if (st === 'off') { note.textContent = 'Auto-save unavailable here (browser storage is blocked)'; return; }
    const sv = loadRunSave();
    if (inShop) note.textContent = sv ? `Progress saved - quit any time and continue from Wave ${sv.stats.level}. If you die, the save is deleted.` : 'Progress auto-saves after every wave. If you die, the save is deleted.';
    else note.textContent = sv ? `Auto-saved: you can quit and continue from Wave ${sv.stats.level}. Dying deletes the save.` : 'Progress auto-saves after every wave you clear. Dying deletes the save.';
}
function refreshSaveUI() {
    paintSaveNote($('shop-save-note'), true);
    if (currentGameState === 'shop' && returnMenuState !== 'nextwave') $('shop-save-note').classList.add('hidden');
    paintSaveNote($('pause-save-note'), false);
}
// (no longer used since 3.8: death deletes the save) Death used to keep the checkpoint. Its stats were folded into the lifetime stats, so the save restarted the run
// stats from zero (no double counting when you continue and later die or start over).
function keepSaveAfterDeath(sv) {
    sv.runStats = Object.assign(freshRunStats(), { waveBase: Math.max(0, sv.stats.level - 1) });
    sv.runXP = 0; sv.deaths = (sv.deaths || 0) + 1;
    try { localStorage.setItem(RUN_KEY, JSON.stringify(sv)); localStorage.removeItem(RUN_KEY_OLD); } catch (e) {}
    updateContinueBtn();
}
function loadRunSave() {
    let s = loadJSON(RUN_KEY, null);
    if (!s) s = loadJSON(RUN_KEY_OLD, null);
    return s && s.v === 1 && s.run && MAPS[s.run.map] && s.stats ? s : null;
}
function clearRunSave() { try { localStorage.removeItem(RUN_KEY); localStorage.removeItem(RUN_KEY_OLD); } catch (e) {} updateContinueBtn(); }
function commitSavedRun() {
    const s = loadRunSave(); if (!s) return;
    const keep = { run, runStats, playerStats };
    run = s.run; runStats = Object.assign(freshRunStats(), s.runStats); playerStats = s.stats;
    commitLife();
    ({ run, runStats, playerStats } = keep);
}
function updateContinueBtn() {
    const b = $('btn-continue'); if (!b) return;
    const s = loadRunSave();
    b.classList.toggle('hidden', !s);
    const d = $('btn-delete-save'); if (d) { d.classList.toggle('hidden', !s); if (delArm) { clearTimeout(delArm); delArm = 0; } d.textContent = 'Delete save'; }
    if (s) b.innerHTML = `CONTINUE &middot; WAVE ${s.stats.level}<small>${MAPS[s.run.map].name}, ${(DIFFICULTIES[s.run.diff] || DIFFICULTIES.normal).name}, ${(MODES[s.run.mode] || MODES.classic).name} &middot; $${s.stats.money} &middot; ${Math.ceil(s.hp)} HP${CLASSES[s.stats.cls] ? ` &middot; ${CLASSES[s.stats.cls].name}` : ''}</small>`;
}
function continueRun() {
    const s = loadRunSave(); if (!s) { updateContinueBtn(); return; }
    resetRun();
    savedWave = s.phase === 'shop' ? s.stats.level : -1;   // restored at a break: that wave is already saved
    needsNewWorld = false;
    run = s.run;
    runStats = Object.assign(freshRunStats(), s.runStats); runXP = s.runXP || 0; runUnlocks = [];
    applyTheme(THEMES[s.theme] ? s.theme : 'night');
    buildWorld(run.map, run.seed);
    camera.position.set(spawnPt[0], EYE_STAND, spawnPt[1]); feetY = 0; eyeH = EYE_STAND;
    camera.quaternion.identity();
    velocity.set(0, 0, 0); push.set(0, 0, 0); slideT = 0;
    playerStats = Object.assign(JSON.parse(JSON.stringify(defaultStats)), s.stats);
    // 4.0 classes: saves from before classes get the class picked on the Play tab and an empty upgrade tree
    playerStats.cls = validClass(s.stats.cls || settings.cls);
    if (!playerStats.clsUp || typeof playerStats.clsUp !== 'object') playerStats.clsUp = {};
    for (const k in playerStats.clsUp) playerStats.clsUp[k] = CLASSES[k] ? clamp(playerStats.clsUp[k] | 0, 0, 3) : 0;
    // 4.0 weapons: older saves have no attachments; anything unknown (or a gun id this version doesn't have) is dropped
    if (!playerStats.atts || typeof playerStats.atts !== 'object') playerStats.atts = {};
    for (const k in playerStats.atts) { const a = playerStats.atts[k]; if (!weaponsDb[k] || !a || typeof a !== 'object') delete playerStats.atts[k]; }
    playerStats.weapons = (Array.isArray(playerStats.weapons) ? playerStats.weapons : []).filter(id => weaponsDb[id]);
    if (!playerStats.weapons.includes('pistol')) playerStats.weapons.unshift('pistol');
    if (!weaponsDb[playerStats.currentWeapon] || !playerStats.weapons.includes(playerStats.currentWeapon)) playerStats.currentWeapon = playerStats.weapons[0];
    abilityCd = clamp(+s.abil || 0, 0, 60); abilityT = 0; abilReadyWas = abilityCd <= 0;
    maxHp = s.maxHp || 100; currentHp = clamp(s.hp || maxHp, 1, maxHp); currentArmor = s.armor || 0;
    strikeCharges = s.strikes || 0; streak = s.streak || 0; seenTypes = new Set(migEnemyIds(s.seen || []));
    resetAmmo();
    updateGunModel();
    runStartBonus(false);               // 4.0: banked challenge rewards
    if (s.phase === 'shop' && run.mode !== 'rush') { returnMenuState = 'nextwave'; changeGameState('shop'); }
    else changeGameState('playing');
}
function startFreshRun() {
    needsNewWorld = false;
    runStats = freshRunStats();
    runXP = 0; runUnlocks = [];
    // anything still locked falls back to something you have
    run = CAMP.on ? { mode: 'classic', diff: CAMP.m.diff, map: CAMP.m.map, seed: (Math.random() * 2147483647) | 0, camp: CAMP.m.id } : {
        mode: MODES[settings.mode] && rankOK('mode', settings.mode) ? settings.mode : 'classic',
        diff: DIFFICULTIES[settings.diff] && rankOK('diff', settings.diff) ? settings.diff : 'normal',
        map: MAPS[settings.map] && rankOK('map', settings.map) ? settings.map : pickRandom(MAP_IDS().filter(k => rankOK('map', k))),
        seed: (Math.random() * 2147483647) | 0          // the saved run rebuilds the exact same arena from this
    };
    applyTheme(CAMP.on ? CAMP.m.light : THEMES[settings.light] && rankOK('light', settings.light) ? settings.light : pickRandom(Object.keys(THEMES).filter(k => rankOK('light', k))));
    buildWorld(run.map, run.seed);
    camera.position.set(spawnPt[0], EYE_STAND, spawnPt[1]); feetY = 0; eyeH = EYE_STAND;
    camera.quaternion.identity();
    velocity.set(0, 0, 0); push.set(0, 0, 0); slideT = 0;
    if (run.mode === 'sandbox') {
        playerStats.weapons = WEAPON_ORDER.slice();
        playerStats.secondaries = Object.keys(secondariesDb);
        playerStats.upgrades = {};
        playerStats.currentSecondary = 'grenade';
        playerStats.money = 999999; playerStats.armorTier = 'heavy'; currentArmor = armorDb.heavy.max;
        strikeCharges = 2;
    }
    if (run.mode === 'bossrush') playerStats.money = Math.max(playerStats.money, 2000);
    if (CAMP.on) campBegin(); else runStartBonus(true);                // 4.0: prestige starting cash + banked challenge rewards (5.0: campaign missions set their own start)
    updateGunModel();
}
