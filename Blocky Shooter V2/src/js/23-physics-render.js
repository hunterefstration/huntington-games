// ==========================================
// 6. PHYSICS & RENDERING
// ==========================================


let mmStatic = null, mmTick = 0;
const mapSize = () => 2 * ARENA + 4;
function buildMinimapStatic() {
    const MAP_SIZE = mapSize(), w = ui.minimap.width, scale = w / MAP_SIZE, off = MAP_SIZE / 2;
    const [c, g] = makeCanvas(w);
    for (const b of worldBlocks) {
        if (!b.solid || b.key === 'bound' || b.key === 'post') continue;
        const top = b.y + b.h / 2;
        const v = Math.min(200, 70 + top * 16);
        g.fillStyle = `rgb(${v * 0.75 | 0},${v * 0.8 | 0},${v | 0})`;
        g.fillRect((b.x - b.w / 2 + off) * scale, (b.z - b.d / 2 + off) * scale, b.w * scale, b.d * scale);
    }
    g.fillStyle = 'rgba(214,170,110,0.85)';          // rope bridges
    for (const [x, z, bw, bd] of bridgeRects) g.fillRect((x + off) * scale, (z + off) * scale, Math.max(1.5, bw * scale), Math.max(1.5, bd * scale));
    g.fillStyle = 'rgba(255,200,120,0.6)';
    for (const l of lampSpots) g.fillRect((l[0] + off) * scale - 1, (l[1] + off) * scale - 1, 2, 2);
    mmStatic = c;
}
function drawMinimap(dt) {
    mmTick += dt; if (mmTick < 1 / 20) return; mmTick = 0;
    const MAP_SIZE = mapSize(), w = ui.minimap.width, scale = w / MAP_SIZE, off = MAP_SIZE / 2;
    const c = minimapCtx;
    c.clearRect(0, 0, w, ui.minimap.height);
    if (mmStatic) c.drawImage(mmStatic, 0, 0);
    for (const p of pickups) {
        c.fillStyle = p.kind === 'health' ? '#4ade80' : '#facc15';
        c.fillRect((p.mesh.position.x + off) * scale - 2, (p.mesh.position.z + off) * scale - 2, 4, 4);
    }
    for (const s of supplies) {
        const pulse = 4 + Math.sin(gameTime * 6) * 1.5;
        c.strokeStyle = hex(SUPPLY_KINDS[s.kind].color); c.lineWidth = 2;
        c.strokeRect((s.x + off) * scale - pulse, (s.z + off) * scale - pulse, pulse * 2, pulse * 2);
    }
    const markPulse = 5.5 + Math.sin(gameTime * 8) * 1.2;
    for (const enemy of enemies) {
        const u = enemy.userData, marked = u.markT > gameTime;       // 4.0 RECON marks show even cloaked zombies
        if (!enemy.visible && !marked) continue;
        const x = (enemy.position.x + off) * scale, y = (enemy.position.z + off) * scale;
        c.fillStyle = u.config.boss ? u.config.bar : hex(u.config.color === 0x3f4a5c ? 0x9fb1cc : u.config.color);
        c.beginPath(); c.arc(x, y, u.config.boss ? 5 : 3, 0, Math.PI * 2); c.fill();
        if (u.state === 'aim') { c.strokeStyle = '#ff2020'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, 6, 0, Math.PI * 2); c.stroke(); }
        if (marked) { c.strokeStyle = '#c4b5fd'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, markPulse + (u.config.boss ? 3 : 0), 0, Math.PI * 2); c.stroke(); }
    }
    for (const k of crates) { c.fillStyle = '#facc15'; c.fillRect((k.x + off) * scale - 2.5, (k.z + off) * scale - 2.5, 5, 5); }
    for (const f of healFields) { c.strokeStyle = 'rgba(74,222,128,0.85)'; c.lineWidth = 1.5; c.beginPath(); c.arc((f.x + off) * scale, (f.z + off) * scale, Math.max(3, f.r * scale), 0, Math.PI * 2); c.stroke(); }
    for (const t of turrets) { c.fillStyle = t.mini ? '#facc15' : '#38bdf8'; c.fillRect((t.g.position.x + off) * scale - 2.5, (t.g.position.z + off) * scale - 2.5, 5, 5); }
    if (NET.inGame) netDrawMinimap(c, scale, off);
    if (CAMP.on) campMinimap(c, scale, off);
    c.fillStyle = '#facc15';
    for (const m of mines) c.fillRect((m.x + off) * scale - 1.5, (m.z + off) * scale - 1.5, 3, 3);
    if (activeC4) { c.fillStyle = '#ff2020'; c.fillRect((activeC4.mesh.position.x + off) * scale - 2, (activeC4.mesh.position.z + off) * scale - 2, 4, 4); }


    const pPos = camera.position;
    const px = (pPos.x + off) * scale, py = (pPos.z + off) * scale;
    if (radarSweep > 0) {      // the radar pulse sweeping out across the map
        c.strokeStyle = `rgba(196,181,253,${(radarSweep * 0.9).toFixed(2)})`; c.lineWidth = 2.5;
        c.beginPath(); c.arc(px, py, (1 - radarSweep) * w * 0.75 + 4, 0, Math.PI * 2); c.stroke();
    }
    camera.getWorldDirection(_camDir);
    const ang = Math.atan2(_camDir.z, _camDir.x);
    c.fillStyle = 'rgba(59,130,246,0.25)';
    c.beginPath(); c.moveTo(px, py); c.arc(px, py, 26, ang - 0.6, ang + 0.6); c.closePath(); c.fill();
    c.fillStyle = '#3b82f6'; c.beginPath(); c.arc(px, py, 4, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#ffffff'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.cos(ang) * 10, py + Math.sin(ang) * 10); c.stroke();
}


// Recoil that actually moves your aim, then settles back
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
function applyAimPunch(dt) {
    aimPunch = damp(aimPunch, 0, 9, dt); yawPunch = damp(yawPunch, 0, 9, dt);
    const dp = aimPunch - aimPunchApplied, dy = yawPunch - yawPunchApplied;
    if (Math.abs(dp) > 1e-6 || Math.abs(dy) > 1e-6) {
        _euler.setFromQuaternion(camera.quaternion);
        _euler.x = clamp(_euler.x + dp, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01); _euler.y += dy;
        camera.quaternion.setFromEuler(_euler);
    }
    aimPunchApplied = aimPunch; yawPunchApplied = yawPunch;
}


let headBob = 0;
function updatePlayer(delta) {
    const pos = camera.position;
    const w = W(playerStats.currentWeapon);
    if (slideCd > 0) slideCd -= delta;
    const sliding = slideT > 0;
    if (sliding) slideT -= delta;


    const damping = sliding ? 1.4 : 10;
    velocity.x -= velocity.x * Math.min(1, damping * delta);
    velocity.z -= velocity.z * Math.min(1, damping * delta);


    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.normalize();


    const sprinting = sprintHeld && moveForward && !aimHeld && !isMouseDown && !sliding;
    const speed = (sprinting ? 78.0 : 52.0) * (1 + 0.07 * perk('speed')) * (aimHeld && !w.noAds ? 0.6 : 1) * (onGround ? 1 : 0.85) * (w.moveMult || 1) * (sliding ? 0.12 : 1) * (adrenOn() ? 1.35 : 1);
    if (moveForward || moveBackward) velocity.z -= direction.z * speed * delta;
    if (moveLeft || moveRight) velocity.x -= direction.x * speed * delta;


    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);
    if (lungeT > 0) lungeStep(delta, pos, sliding ? 1.1 : PLAYER_BODY);      // 4.0 KATANA lunge
    if (push.lengthSq() > 0.01) { pos.x += push.x * delta; pos.z += push.z * delta; push.multiplyScalar(Math.max(0, 1 - 5 * delta)); }
    if (onGround) for (let i = 0; i < escalators.length; i++) {        // 4.0 mall: escalators carry you
        const e = escalators[i];
        if (pos.x > e.x0 && pos.x < e.x1 && pos.z > e.z0 && pos.z < e.z1 && feetY > e.y0 - 0.2 && feetY < e.y1 + 0.3) { pos.x += e.vx * delta; pos.z += e.vz * delta; break; }
    }


    const bodyH = sliding ? 1.1 : PLAYER_BODY;
    pushOut(pos, playerRadius, feetY, feetY + bodyH);
    pos.x = clamp(pos.x, -ARENA + 1, ARENA - 1); pos.z = clamp(pos.z, -ARENA + 1, ARENA - 1);


    // Jump (hold space to keep hopping). Coyote time makes edge jumps forgiving. Slide-jumps keep momentum.
    if (onGround) coyote = 0.12; else coyote -= delta;
    if (jumpHeld && coyote > 0 && velocity.y <= 0.01) { velocity.y = JUMP_V; coyote = 0; onGround = false; if (sliding) slideT = 0; }


    velocity.y -= GRAVITY * delta;
    let newFeet = feetY + velocity.y * delta;
    if (velocity.y > 0) {
        const ceil = ceilingAt(pos.x, pos.z, playerRadius * 0.6, feetY + bodyH);
        if (newFeet + bodyH > ceil) { newFeet = ceil - bodyH; velocity.y = 0; }
    }
    const groundY = groundAt(pos.x, pos.z, playerRadius * 0.5, feetY);
    if (newFeet <= groundY && velocity.y <= 0) {
        if (!onGround && velocity.y < -14) vm.land = Math.min(0.1, -velocity.y * 0.0035);
        newFeet = groundY; velocity.y = 0; onGround = true;
    } else if (newFeet < groundY) {
        newFeet = groundY; velocity.y = 0; onGround = true;   // stepping up onto a ledge mid-jump
    } else onGround = false;
    feetY = newFeet;
    if (VOID && feetY < FALL_DEATH_Y) { fellOff(); return; }
    eyeH = damp(eyeH, slideT > 0 ? EYE_SLIDE : EYE_STAND, 14, delta);
    pos.y = feetY + eyeH;


    // ADS / FOV
    if (aimHeld && vm.inspect > 0) vm.inspect = 0;
    const wantAds = aimHeld && !isReloading && vm.raise > 0.8 && !w.noAds;
    vm.adsT = clamp(vm.adsT + (wantAds ? 1 : -1) * delta * (w.scoped === 'sniper' ? 6 : 7.5), 0, 1);
    const a = ease(vm.adsT);
    const baseFov = settings.fov + (sprinting ? 6 : 0) + (slideT > 0 ? 5 : 0) + (adrenOn() ? 7 : 0);
    const targetFov = w.noAds ? baseFov : lerp(baseFov, Math.min(w.zoomFov, settings.fov - 5), a);
    if (Math.abs(targetFov - fovNow) > 0.05) { fovNow = damp(fovNow, targetFov, 16, delta); camera.fov = fovNow; camera.updateProjectionMatrix(); }
    controls.pointerSpeed = settings.sens * clamp(fovNow / settings.fov, 0.15, 1);
    const scopedIn = !!w.scoped && vm.adsT > 0.9;
    ui.scope.classList.toggle('hidden', !(scopedIn && w.scoped === 'sniper'));
    ui.optic.classList.toggle('hidden', !(scopedIn && w.scoped === 'optic'));
    setStyle(ui.crosshair, 'opacity', (scopedIn || (vm.adsT > 0.45 && !w.noAds && !w.akimbo)) ? '0' : '1');
    if (vmModel) vmModel.root.visible = !scopedIn;


    const moving = Math.hypot(velocity.x, velocity.z) > 1.5 && onGround;
    updateViewmodel(delta, sprinting, moving && slideT <= 0);
    if (muzzleLight) muzzleLight.intensity = Math.max(0, muzzleLight.intensity - delta * 500);
    updateFakeLights(delta);
    headBob = moving && slideT <= 0 ? Math.abs(Math.sin(vm.bob)) * (sprinting ? 0.05 : 0.028) * (1 - a * 0.85) : 0;


    // Crosshair gap follows real spread
    const gap = 4 + currentSpread(w) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (window.innerHeight / 2) + vm.kick * 60;
    setStyle(ui.crosshair, '--gap', gap.toFixed(0) + 'px');
}


let fpsAcc = 0, fpsFrames = 0;
function trackFps(raw) {
    fpsAcc += raw; fpsFrames++;
    if (fpsAcc < 1) return;
    const fps = fpsFrames / fpsAcc; fpsAcc = 0; fpsFrames = 0;
    ui.fps.classList.toggle('hidden', !settings.showFps || currentGameState !== 'playing');
    if (settings.showFps) setText(ui.fps, `${Math.round(fps)} FPS \u00b7 ${Math.round(dynScale * 100)}% res \u00b7 ${Q.shadows ? 'shadows on' : 'shadows off'} \u00b7 ${Q.name}`);
    if (!Q.dynamic || (document.hidden && !debugNoLock)) return;
    // AUTO picks its quality tier on the menu (the arena renders behind it), where a shader rebuild doesn't matter.
    if (currentGameState === 'main' && settings.quality === 'auto') {
        if (autoRes.warm > 0) { autoRes.warm--; return; }          // skip the first seconds (shaders still compiling)
        autoMenuFps.push(fps); if (autoMenuFps.length > 3) autoMenuFps.shift();
        if (autoMenuFps.length === 3) {
            const avg = autoMenuFps.reduce((a, b) => a + b, 0) / 3;
            if (avg < 50 && autoTier < AUTO_TIERS - 1) { autoTier++; saveAutoTier(); applyQuality(); }
            else saveAutoTier();
            autoMenuFps.length = 0;
        }
        return;
    }
    if (currentGameState !== 'playing') return;
    // in a fight: only gentle resolution steps (never a shader rebuild). Down fast-ish, up slowly.
    autoRes.t++;
    if (fps < 50) { autoRes.good = 0; if (autoRes.t >= 2 && dynScale > Q.minScale + 1e-3) { setRenderScale(Math.max(Q.minScale, dynScale - 0.06)); autoRes.t = 0; } }
    else if (fps >= 57.5) { if (++autoRes.good >= 4 && dynScale < Q.scale - 1e-3) { setRenderScale(Math.min(Q.scale, dynScale + 0.04)); autoRes.good = 0; autoRes.t = 0; } }
    else autoRes.good = 0;
    // still struggling at the lowest resolution for a while: drop a tier at the next break between waves
    if (settings.quality === 'auto' && fps < 45 && dynScale <= Q.minScale + 1e-3) { if (++autoRes.bad >= 8 && autoTier < AUTO_TIERS - 1) autoPending = true; }
    else autoRes.bad = Math.max(0, autoRes.bad - 1);
}
const autoMenuFps = [], autoRes = { t: 0, good: 0, bad: 0, warm: 4 };
let autoPending = false;
// called every frame; applies a pending tier drop only when no wave is running
function autoApplyPending() {
    if (!autoPending || waveActive || currentGameState !== 'playing') return;
    autoPending = false; autoRes.bad = 0;
    autoTier++; saveAutoTier(); applyQuality();
    toast('Auto graphics: lowered a notch for smoother play', '#9ca3af', 2);
}
let frameNo = 0;
// tiny frame profiler (off unless a test turns it on): ms spent per system, summed between marks
const PROF = { on: false, mem: false, last: 0, lastMem: 0, t: {}, m: {} };
function pfMark(k) {
    if (!PROF.on) return;
    const n = performance.now(); PROF.t[k] = (PROF.t[k] || 0) + (n - PROF.last); PROF.last = n;
    if (PROF.mem) { const h = performance.memory.usedJSHeapSize; if (h > PROF.lastMem) PROF.m[k] = (PROF.m[k] || 0) + (h - PROF.lastMem); PROF.lastMem = h; }
}


function animate(ts) {
    requestAnimationFrame(animate);
    frame(ts);
}
function frame(ts) {
    const time = (typeof ts === 'number') ? ts : performance.now();
    if (prevTime === null) prevTime = time;
    const raw = Math.max((time - prevTime) / 1000, 0);
    const delta = Math.min(raw, 0.05);
    prevTime = time;
    if (PROF.on) { PROF.last = performance.now(); if (PROF.mem) PROF.lastMem = performance.memory.usedJSHeapSize; }
    trackFps(raw);


    if (NET.on) netTick(delta);
    autoApplyPending();
    if (escalators.length) animEscalators(delta);
    // multiplayer: the world keeps going while you're in the pause menu or the armory
    const simOn = () => currentGameState === 'playing' || (NET.inGame && (currentGameState === 'paused' || currentGameState === 'shop' || currentGameState === 'settings'));
    if (simOn()) {
        gameTime += delta; runStats.time += delta;
        camera.position.sub(camOffset); camOffset.set(0, 0, 0);


        if (currentGameState === 'playing' && !NET.dead) {
            updatePlayer(delta);
            weaponTick(delta);
            applyAimPunch(delta);
        } else if (NET.dead) netSpectate(delta);


        pfMark('player');
        if (!NET.inGame || NET.host) {
            updateNavField(delta); pfMark('nav');
            if (!debugFreeze) updateEnemies(delta * (NET.slowT > 0 ? 0.5 : 1));
        } else netUpdateEnemies(delta);
        pfMark('enemyAI');
        if (simOn()) {
            updateProjectiles(delta);
            updatePickups(delta);
            updateSupplies(delta);
            updateRegen(delta);
            if (CAMP.on) campTick(delta);
        }
        pfMark('proj');
        updateCorpses(delta);
        updateCageRam(delta);
        tickBossIntro(delta);
        if (simOn()) { updateBossFx(delta); updateFires(delta); updateTurrets(delta); updateStrikes(delta); updateMines(delta); updateCornerPressure(delta); updateBossBar(); updateClass(delta); }
        pfMark('bossFx');
        ui.strike.classList.toggle('hidden', strikeCharges <= 0);
        if (strikeCharges > 0) setText(ui.strike, `\u2708 AIRSTRIKE x${strikeCharges}  \u2014  PRESS G`);
        setText(ui.streak, streak > 0 ? `STREAK ${streak} / ${STREAK_FOR_STRIKE}` : '');


        // timers
        if (secondaryCooldown > 0) secondaryCooldown = Math.max(0, secondaryCooldown - delta);
        if (turretCd > 0 && !mainTurret()) turretCd = Math.max(0, turretCd - delta);
        updateSecondaryHUD();
        if (comboTimer > 0) { comboTimer -= delta; if (comboTimer <= 0) combo = 0; }
        ui.combo.classList.toggle('hidden', combo < 2);
        if (combo >= 2) setText(ui.combo, `x${combo} COMBO  (+${Math.min(combo - 1, 10) * 10}% cash)`);
        if (toastTimer > 0) { toastTimer -= delta; if (toastTimer <= 0) ui.toast.style.opacity = '0'; }
        if (intelTimer > 0) { intelTimer -= delta; if (intelTimer <= 0) ui.intel.classList.add('hidden'); }


        if (intermission > 0 && simOn()) {
            intermission -= delta;
            if (run.mode === 'rush' || NET.inGame) {
                setText(ui.toast, `NEXT WAVE IN ${Math.ceil(intermission)}` + (NET.inGame ? '  (ESC > ARMORY to shop)' : '')); ui.toast.style.opacity = '1'; toastTimer = 0.3;
                if (intermission <= 0) { intermission = 0; if (!NET.inGame || NET.host) spawnWave(); }
            } else if (intermission <= 0) { intermission = 0; returnMenuState = 'nextwave'; changeGameState('shop'); }
        }


        if (currentGameState === 'playing') {
            if (shake > 0.002) {
                // tuned: capped, with a curve so small shakes (recoil, melee) stay subtle and blasts punch, and a frame-rate independent decay
                if (shake > 1.1) shake = 1.1;
                const amp = Math.pow(shake, 1.35) * 0.9;
                camOffset.set((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp * 0.85, (Math.random() - 0.5) * amp * 0.5);
                shake *= Math.exp(-delta * 6.5);
            } else shake = 0;
            camOffset.y += headBob;
            camera.position.add(camOffset);
            drawMinimap(delta);
        }
        pfMark('hud');
    }


    if (NET.inGame || (currentGameState !== 'paused' && currentGameState !== 'shop' && currentGameState !== 'settings')) {
        // purely visual stuff keeps animating on menus / game over
        updateParticles(delta); updateTracers(delta); updateExplosions(delta); updateCasings(delta);
    }
    // menus: slow cinematic orbit around the arena, with your gun + arms on show
    const inMenu = currentGameState === 'main' || (currentGameState === 'settings' && settingsReturn === 'main') || (currentGameState === 'shop' && returnMenuState === 'main');
    if (inMenu) {
        updateMenuScene(delta);      // 5.0: moving camera + shambling zombies (29-start-screen.js)
        if (camera.fov !== settings.fov) { camera.fov = fovNow = settings.fov; camera.updateProjectionMatrix(); }
        gameTime += delta;
        // the Customize tab shows off your arms on a rifle
        const show = currentGameState === 'main' && menuView === 'setup' && menuTab === 'customize';
        if (show && (!vmModel || vmModel.id !== 'ar')) showWeaponModel('ar');
        if (vmModel) { vmModel.root.visible = show; if (show) { vm.raise = 1; updateViewmodel(delta, false, false); } }
    }
    pfMark('fx');
    updateWeather(delta);
    updateBlobs();
    updateHpBars();
    updateSun();
    updateZombieInstances();
    // the sun's shadow map only re-renders every other frame (half the shadow cost, invisible at 60fps)
    pfMark('misc');
    renderer.info.autoReset = false; renderer.info.reset();
    frameNo++;
    renderer.shadowMap.autoUpdate = false;
    if (Q.shadows && (frameNo & 1)) renderer.shadowMap.needsUpdate = true;
    if (composer) {
        gradePass.uniforms.uTime.value = gameTime;
        gradePass.uniforms.uExposure.value = renderer.toneMappingExposure;
        composer.render(delta);
    } else {
        renderer.setRenderTarget(null);
        renderer.clear();
        renderer.render(scene, camera);
        if (vmModel && vmModel.root.visible && (currentGameState === 'playing' || currentGameState === 'paused' || currentGameState === 'main')) {
            renderer.clearDepth();
            renderer.render(viewScene, weaponCam);
        }
    }
    pfMark('render');
}
