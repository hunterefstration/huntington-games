// ==========================================
// 3. STATE MACHINE
// ==========================================


function clearInputs() {
    moveForward = moveBackward = moveLeft = moveRight = false;
    sprintHeld = jumpHeld = aimHeld = false; isMouseDown = false; triggerFresh = false;
    if (railC > 0) railCancel();          // 4.0: a half-charged railgun shot is dropped, never fired, when a menu opens
}


function changeGameState(newState) {
    const prev = currentGameState;
    currentGameState = newState;
    clearInputs();
    for (const el of [ui.mainMenu, ui.pauseMenu, ui.shop, ui.gameOver, $('camp-result'), $('camp-arrow'), $('camp-brief'), ui.hud, ui.minimap, ui.crosshair, ui.scope, ui.optic, ui.settings]) el.classList.add('hidden');
    if (newState !== 'playing') setStyle(ui.clsFx, 'opacity', '0');      // the class screen-edge glow only shows in play
    if (newState !== 'main' && !(newState === 'shop' && returnMenuState === 'main') && !(newState === 'settings' && settingsReturn === 'main')) menuSceneOn(false);   // 5.0 start-screen zombies off
    if (vmModel) vmModel.root.visible = newState === 'playing' || newState === 'paused' || newState === 'main';


    switch (newState) {
        case 'main':
            ui.mainMenu.classList.remove('hidden');
            if (prev !== 'shop' && prev !== 'settings' && prev !== 'main') setMenuView('home');
            menuSceneOn(true);
            renderMenu(); updateContinueBtn();
            controls.unlock();
            break;
        case 'paused':
            ui.pauseMenu.classList.remove('hidden');
            ui.pauseStats.textContent = CAMP.on ? `CAMPAIGN \u00b7 ${CAMP.m.name} \u00b7 ${MAPS[run.map].name} \u00b7 ${theme.name}  \u2014  lives left ${campLives()}` : NET.inGame ? `MULTIPLAYER \u00b7 ${netModeName()} \u00b7 ${MAPS[run.map].name}  \u2014  the game keeps running while you're in here!`
                : `${MODES[run.mode].name} \u00b7 ${DIFF().name} \u00b7 ${MAPS[run.map].name} \u00b7 ${theme.name}  \u2014  Wave ${playerStats.level}, ${runStats.kills} kills`;
            if (myClass()) ui.pauseStats.textContent += `  \u00b7  ${CLASSES[myClass()].name}${clsLvl(myClass()) ? ' ' + '\u2605'.repeat(clsLvl(myClass())) : ''}`;   // 4.0: your class + upgrade stars
            ui.pauseCh.innerHTML = chPauseList(); ui.pauseCh.classList.toggle('hidden', !ui.pauseCh.innerHTML);    // 4.0 challenges
            ui.btnQuit.textContent = CAMP.on ? 'ABANDON MISSION' : NET.on ? 'LEAVE PARTY' : 'QUIT TO MENU';
            ui.btnPauseShop.classList.toggle('hidden', NET.pvp);
            refreshSaveUI();
            controls.unlock();
            break;
        case 'playing':
            if (needsNewWorld && !NET.on) startFreshRun();
            ui.hud.classList.remove('hidden');
            ui.minimap.classList.remove('hidden');
            ui.crosshair.classList.remove('hidden');
            initAudio();
            if (!debugNoLock) controls.lock();
            if (prev !== 'paused' || !vmModel || vmModel.id !== playerStats.currentWeapon) updateGunModel();
            if (vmModel) vmModel.root.visible = true;
            updateHUD(); updateRankHUD();
            if (!NET.on && !waveActive && intermission <= 0 && !(CAMP.on && !CAMP.waves)) spawnWave();
            break;
        case 'shop': {
            ui.shop.classList.remove('hidden');
            const next = returnMenuState === 'nextwave';
            const label = next ? `START WAVE ${playerStats.level} \u25b6` : 'BACK';
            ui.btnShopBack.innerText = label; ui.btnShopBackTop.innerText = label;
            ui.shopSubtitle.classList.toggle('hidden', !next);
            if (next) ui.shopSubtitle.innerText = `Wave ${playerStats.level - 1} cleared! Gear up for the next one.`;
            renderShopItems();
            refreshSaveUI();
            controls.unlock();
            break;
        }
        case 'settings':
            ui.settings.classList.remove('hidden');
            renderSettings();
            controls.unlock();
            break;
        case 'campend':
            $('camp-result').classList.remove('hidden');
            controls.unlock();
            break;
        case 'gameover':
            ui.gameOver.classList.remove('hidden');
            controls.unlock();
            break;
    }
}


function leaveShop() {
    if (returnMenuState === 'nextwave') { autoSaveRun(false); returnMenuState = 'paused'; changeGameState('playing'); }   // re-save so armory purchases are kept
    else changeGameState(returnMenuState);
}


ui.btnStart.addEventListener('click', startRun);
$('btn-continue').addEventListener('click', continueRun);
$('btn-go-continue').addEventListener('click', continueRun);
$('btn-delete-save').addEventListener('click', () => {      // two clicks, no confirm() dialog
    const d = $('btn-delete-save');
    if (!delArm) { d.textContent = 'Click again to delete your saved run'; delArm = setTimeout(() => { delArm = 0; d.textContent = 'Delete save'; }, 3500); return; }
    clearTimeout(delArm); delArm = 0;
    if (loadRunSave()) commitSavedRun();                     // like starting over: its stats still count
    clearRunSave();
});
// closing the tab during a wave break keeps what you just bought in the armory
window.addEventListener('pagehide', () => { if (!NET.on) saveIfInBreak(); });
ui.btnResume.addEventListener('click', () => changeGameState('playing'));
// quitting keeps your auto-save (continue it from the menu); it's only thrown away when you start a new run or delete it
ui.btnQuit.addEventListener('click', () => { if (CAMP.on) { campLeave(); return; } if (NET.on) { netLeave(); return; } saveIfInBreak(); if (!(runSaveOK() && loadRunSave())) commitLife(); resetRun(); changeGameState('main'); });
ui.btnRespawn.addEventListener('click', startRun);
$('btn-go-menu').addEventListener('click', () => changeGameState('main'));
ui.btnMainShop.addEventListener('click', () => { returnMenuState = 'main'; changeGameState('shop'); });
ui.btnPauseShop.addEventListener('click', () => { returnMenuState = 'paused'; changeGameState('shop'); });
ui.btnShopBack.addEventListener('click', leaveShop);
ui.btnShopBackTop.addEventListener('click', leaveShop);
$('btn-main-settings').addEventListener('click', () => { settingsReturn = 'main'; changeGameState('settings'); });
$('btn-pause-settings').addEventListener('click', () => { settingsReturn = 'paused'; changeGameState('settings'); });
$('btn-settings-back').addEventListener('click', () => changeGameState(settingsReturn));
