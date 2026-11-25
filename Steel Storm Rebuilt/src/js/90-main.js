// ============================================================
// INPUT, CAMERA, THE MAIN LOOP, BOOT, and the debug hook window.__steelstorm
// ============================================================
const IN = { keys: {}, mb: [0, 0, 0], camYaw: 0, camPitch: .2, zoom: 1 };
const Cam = {
    aimD: 0, aim: { x: 0, y: 0, z: 0 }, deadYaw: 0, specId: -1, solOk: true, mlock: null, mlId: -1, mlT: 0,
    reset() { if (!ME) return; IN.camYaw = ME.yaw; IN.camPitch = ME.def.ln === 'a' && !ME.def.heli ? 0.05 : 0.22; IN.zoom = 1; },
    lock() { try { const r = $('#gl').requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {} },
    locked() { return document.pointerLockElement === $('#gl'); }
};
// where to aim to hit a moving target o with a shot of speed v fired from `from` (the shooter's own speed adds to bullets/rockets in the air)
function leadPoint(e, o, v, from) {
    const air = o.def.ln === 'a', cy = o.y + (air ? 0 : 1.5), fixed = e.def.ln === 'a' && !e.def.heli, sp = Math.max(60, v * (fixed ? 1 : .97) + (fixed ? e.speed * .9 : 0));
    let px = o.x, py = cy, pz = o.z;
    for (let i = 0; i < 3; i++) { const tt = Math.hypot(px - from.x, py - from.y, pz - from.z) / sp; px = o.x + o.vx * tt; py = cy + (air ? o.vy * tt : 0); pz = o.z + o.vz * tt; }
    return { x: px, y: py, z: pz };
}
function aimRay(e) {
    camera.getWorldDirection(V3); const dx = V3.x, dy = V3.y, dz = V3.z, ox = camera.position.x, oy = camera.position.y, oz = camera.position.z;
    let t = 1500;
    for (let s = 20; s < 1500; s += 6) { if (oy + dy * s < GHS(ox + dx * s, oz + dz * s)) { let lo = s - 6, hi = s; for (let i = 0; i < 5; i++) { const m = (lo + hi) / 2; if (oy + dy * m < GHS(ox + dx * m, oz + dz * m)) hi = m; else lo = m; } t = hi; break; } }
    let best = null, bt = t;
    for (const o of EN.values()) {
        if (!o.alive || !foe(o, e) || hiddenSub(o)) continue;
        const cy = o.y + (o.def.ln === 'a' ? 0 : 1.5), vx = o.x - ox, vy = cy - oy, vz = o.z - oz, tt = vx * dx + vy * dy + vz * dz;
        if (tt < 8 || tt > bt) continue;
        const px = ox + dx * tt - o.x, py = oy + dy * tt - cy, pz = oz + dz * tt - o.z;
        if (Math.sqrt(px * px + py * py + pz * pz) < o.def.r * 1.8 + tt * .02) { best = o; bt = tt; }
    }
    Cam.lead = null;
    if (best && !e.def.w1.arty) { const lp = leadPoint(e, best, e.def.w1.v || 200, e.mdl ? muzzleWorld(e, 0) : e); Cam.lead = { x: lp.x, y: lp.y, z: lp.z, id: best.id, D: bt }; return lp; }
    return { x: ox + dx * t, y: oy + dy * t, z: oz + dz * t };
}
// missile lock: the enemy nearest the reticle (within ~14 degrees) that this missile can chase
const LOCK_T = .5;      // seconds a target must stay in the missile seeker's cone before it locks
function missileLock(e, w) {
    if (!w || w.k !== 'missile') return null;
    camera.getWorldDirection(V3); let best = null, ba = .25;
    for (const o of EN.values()) {
        if (!o.alive || !foe(o, e) || hiddenSub(o)) continue;
        if (w.air && o.def.ln !== 'a') continue; if (w.sea && o.def.ln !== 'n') continue; if (!w.air && !w.sea && o.def.ln === 'a' && !o.def.heli) continue;
        const vx = o.x - camera.position.x, vy = o.y - camera.position.y, vz = o.z - camera.position.z, L = Math.hypot(vx, vy, vz); if (L < 30 || L > 1100) continue;
        const a = Math.acos(clamp((vx * V3.x + vy * V3.y + vz * V3.z) / L, -1, 1)); if (a < ba) { ba = a; best = o; }
    }
    return best;
}
const PC = { thr: 0, steer: 0, side: 0, up: 0, aimYaw: 0, aimPitch: 0, f1: false, f2: false, f3: false, tgt: -1, bodyYaw: undefined };
function playerCtrl(e, dt) {
    const k = IN.keys, d = e.def, c = PC;
    c.thr = 0; c.steer = 0; c.side = 0; c.up = 0; c.aimYaw = e.tur; c.aimPitch = 0; c.f1 = !!IN.mb[0]; c.f2 = !!(IN.mb[2] || k.Space); c.f3 = !!(k.KeyB || k.ShiftLeft || k.ShiftRight); c.tgt = -1; c.bodyYaw = undefined;
    const W = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), A = (k.KeyA ? 1 : 0) - (k.KeyD ? 1 : 0);
    const mw = [d.w1, d.w2, d.w3].find(w => w && w.k === 'missile'), ml = missileLock(e, mw); Cam.mlock = ml;
    if (ml && Cam.mlId === ml.id) { const was = Cam.mlT < LOCK_T; Cam.mlT += dt; if (was && Cam.mlT >= LOCK_T) sfx('lock', e.x, e.y, e.z, .5); } else { Cam.mlId = ml ? ml.id : -1; Cam.mlT = 0; }
    if (d.ln === 'a' && !d.heli) {
        e.thr = clamp(e.thr + W * dt * .6, 0, 1); c.thr = e.thr;
        IN.camYaw += A * dt * 1.5; IN.camPitch = clamp(IN.camPitch + ((k.ArrowUp ? 1 : 0) - (k.ArrowDown ? 1 : 0)) * dt * .9, -1.3, 1.3);
        c.aimYaw = IN.camYaw; c.aimPitch = IN.camPitch;
        // soft aim assist: an enemy near the reticle pulls the nose onto its lead point, so the guns (which converge there) can hit
        Cam.lead = null; camera.getWorldDirection(V3);
        const dx = V3.x, dy = V3.y, dz = V3.z, ox = camera.position.x, oy = camera.position.y, oz = camera.position.z; let bestA = .07;
        for (const o of EN.values()) {
            if (!o.alive || !foe(o, e) || hiddenSub(o)) continue;
            const vx = o.x - ox, vy = o.y - oy, vz = o.z - oz, L = Math.hypot(vx, vy, vz); if (L < 40 || L > 800) continue;
            const ang = Math.acos(clamp((vx * dx + vy * dy + vz * dz) / L, -1, 1));
            if (ang < bestA) { bestA = ang; const lp = leadPoint(e, o, d.w1.v, e); Cam.lead = { x: lp.x, y: lp.y, z: lp.z, id: o.id, D: Math.hypot(o.x - e.x, o.y - e.y, o.z - e.z) }; }
        }
        if (Cam.lead) { const lx = Cam.lead.x - e.x, ly = Cam.lead.y - e.y, lz = Cam.lead.z - e.z; c.aimYaw = Math.atan2(lx, lz); c.aimPitch = Math.atan2(ly, Math.hypot(lx, lz)); }
    } else {
        if (d.heli) { c.thr = W; c.side = A; c.up = (k.KeyE ? 1 : 0) - (k.KeyQ ? 1 : 0); c.bodyYaw = IN.camYaw; }
        else if (d.ln === 'n') { e.thr = clamp(e.thr + W * dt * .45, -.45, 1); c.thr = e.thr; c.steer = -A; } else { c.thr = W; c.steer = -A; }
        const p = aimRay(e), m = muzzleWorld(e, 0), w = d.w1, far = Math.hypot(p.x - m.x, p.z - m.z);
        const b = w.k === 'missile' ? { yaw: Math.atan2(p.x - m.x, p.z - m.z), pitch: Math.atan2(p.y - m.y, far), ok: true } : ballistic(m.x, m.y, m.z, p.x, p.y, p.z, w.v, w.g, !!w.arty && far > 220);
        Cam.aimD = Math.hypot(p.x - m.x, p.y - m.y, p.z - m.z); Cam.aim.x = p.x; Cam.aim.y = p.y; Cam.aim.z = p.z; Cam.solOk = b.ok; c.aimYaw = b.yaw; c.aimPitch = b.pitch;
    }
    if (ml && Cam.mlT >= LOCK_T) c.tgt = ml.id; else if (Cam.lead && !mw) c.tgt = Cam.lead.id;      // missiles need a lock (LOCK_T seconds on target)
    return c;
}
function nextSpec(step) {
    const L = Array.from(EN.values()).filter(o => o.alive && o !== ME && (M.mode === 'ffa' || !foe(o, ME) || o.id === UIS.spec));
    const all = L.length ? L : Array.from(EN.values()).filter(o => o.alive && o !== ME); if (!all.length) { Cam.specId = -1; return; }
    const i = all.findIndex(o => o.id === Cam.specId); Cam.specId = all[(i + (step || 1) + all.length) % all.length].id;
}
function updateCamera(dt) {
    if (!ME) return;
    const e = ME; let yaw = IN.camYaw, pit = IN.camPitch;
    const d = e.def;
    if (!e.alive) {
        let t = EN.get(Cam.specId); if (UIS.spec >= 0 && Cam.specId !== UIS.spec && EN.get(UIS.spec) && EN.get(UIS.spec).alive && !t) { Cam.specId = UIS.spec; t = EN.get(UIS.spec); }
        if (!t || !t.alive) { if (simTime - (e.dieT || 0) > 2.5 || !e.dieT) { nextSpec(1); t = EN.get(Cam.specId); } }
        const f = t && t.alive ? t : e;
        Cam.deadYaw += dt * .3; yaw = Cam.deadYaw; pit = .4; const dist = f === e ? 40 : f.def.cd * 1.3, cx = f.x, cy = f.y + 4, cz = f.z;
        camera.position.set(cx - Math.sin(yaw) * Math.cos(pit) * dist, cy + Math.sin(pit) * dist, cz - Math.cos(yaw) * Math.cos(pit) * dist);
        if (TILE.on) tileBoom(cx, cy, cz, camera.position, dt);
        const gmin = Math.max(H(camera.position.x, camera.position.z), 0) + 2; if (camera.position.y < gmin) camera.position.y = gmin;
        camera.lookAt(cx, cy, cz);
    } else {
        Cam.deadYaw = yaw; Cam.specId = -1;
        const cp = Math.cos(pit), dist = d.cd * IN.zoom * (d.w1.arty ? 1.2 : 1), lift = d.ln === 'a' ? 3 : d.ln === 'n' ? 6 : 3.2;
        const cx = e.x, cy = e.y + lift - (d.sub ? e.dive * 3 : 0), cz = e.z;
        camera.position.set(cx - Math.sin(yaw) * cp * dist, cy - Math.sin(pit) * dist, cz - Math.cos(yaw) * cp * dist);
        if (TILE.on && d.ln !== 'a') tileBoom(cx, cy, cz, camera.position, dt, d.r * 1.4 + 5);      // among buildings: 29-tiles.js
        const gmin = Math.max(H(camera.position.x, camera.position.z), 0) + 2; if (camera.position.y < gmin) camera.position.y = gmin;
        camera.lookAt(cx + Math.sin(yaw) * cp * 30, cy + Math.sin(pit) * 30, cz + Math.cos(yaw) * cp * 30);
    }
    if (shakeAmt > .02) { camera.position.x += rnd(-1, 1) * shakeAmt * .15; camera.position.y += rnd(-1, 1) * shakeAmt * .15; shakeAmt *= Math.pow(.02, dt); } else shakeAmt = 0;
    const fov = d.ln === 'a' && !d.heli && e.alive ? 70 + (e.speed - d.minSp) / (d.sp - d.minSp) * 8 : 68; if (Math.abs(camera.fov - fov) > .1) { camera.fov = fov; camera.updateProjectionMatrix(); }
    listenerPos = camera.position;
}
// ---------- one simulation step (also driven by HGNet.every while the host's tab is hidden) ----------
function simStep(dt) {
    simTime += dt;
    if (!M) return;
    for (const e of EN.values()) if (e.prot > 0) e.prot -= dt;
    if (!M.host) M.t += dt;
    if (ME && ME.alive) {
        const c = playerCtrl(ME, dt); stepVehicle(ME, c, dt);
        if (ME.crashed) { ME.crashed = false; meDied(-1, 'crash'); }
    } else if (ME) { ME.respT -= dt; }
    for (const e of EN.values()) {
        if (e === ME) continue;
        if (e.ai) { if (e.alive) aiStep(e, dt); } else if (e.alive) stepRemote(e, dt);
    }
    separate();
    if (M.host && netOn()) recordHistory();
    updateProjectiles(dt);
    for (const e of EN.values()) if (e.alive) smokeDamaged(e, dt);
    if (M.host) hostStep(dt);
    sendT -= dt; if (sendT <= 0) { sendT = .06; sendState(); if (!M.host) flushHits(); }
    if (M.host) { bsT -= dt; if (bsT <= 0) { bsT = .1; sendBots(); } }
    else { hqT -= dt; if (hqT <= 0) { hqT = .12; flushHits(); } pgT -= dt; if (pgT <= 0 && netOn()) { pgT = 1; PARTY.net.send('host', { t: 'pg', c: performance.now() }, { fast: true }); } }
}
let lastAdv = performance.now();
function advance() {
    const now = performance.now(); const dt = Math.min(.1, (now - lastAdv) / 1000); lastAdv = now;
    if (M) simStep(dt);
    return dt;
}
// ---------- frame loop ----------
const FS = { n: 0, sum: 0, max: 0, over: 0, last: performance.now(), rsum: 0, sh: 0 };
const DBG = { noRender: false, autoQ: true };
let lastFrame = performance.now();
// alone (no party), the pause page and the settings page stop the battle: nothing moves, nothing shoots, the clock waits
const PAUSE = { on: false, a: null, b: null };
function simPaused() {
    if (!M || PARTY.net || M.over) return false;
    const a = PAUSE.a || (PAUSE.a = $('#s-pause')), b = PAUSE.b || (PAUSE.b = $('#s-settings'));
    return !a.classList.contains('hidden') || !b.classList.contains('hidden');
}
function frame(now) {
    requestAnimationFrame(frame);
    const rdt = Math.min(.1, (now - lastFrame) / 1000); lastFrame = now;
    if (M) {
        if (Lobby.hi) { Lobby.hi = 0; applyQuality(); }
        const held = PAUSE.on = simPaused(); if (held) lastAdv = performance.now();
        const dt = held ? 0 : advance(); if (!held) { updateParticles(dt); updateCamera(dt); updateWorld(dt); } updateFlagViz();
        if (Q.shEvery > 1 && ++FS.sh >= Q.shEvery) { FS.sh = 0; renderer.shadowMap.needsUpdate = true; }      // shadows redrawn every other frame on Medium
        if (!DBG.noRender) { const r0 = performance.now(); drawWorld(); FS.rsum += performance.now() - r0; hgCheck(); }
        UI.hud(rdt);
        if (held) engineStop(); else if (ME) { if (ME.alive) engineSet(ME.def.ln === 'a' && !ME.def.heli ? ME.thr : Math.abs(ME.speed) / ME.def.sp, ME.def.ln); else engineStop(); }
        if (DBG.autoQ && !DBG.noRender) autoQuality(now);
        const ft = now - FS.last; FS.last = now; if (ft < 1000) { FS.n++; FS.sum += ft; FS.max = Math.max(FS.max, ft); if (ft > 34) FS.over++; }
    } else {
        if (!DBG.noRender && !Show.frame(rdt)) Lobby.render(rdt); FS.last = now;      // the menu showcase, or the 3D lobby
    }
    saveT -= rdt; if (saveT <= 0) { saveT = 20; writeSave(); }
}
function updateFlagViz() {
    if (!M || M.mode !== 'ctf') return;
    M.flags.forEach((f, i) => { const v = flagViz[i]; if (!v) return; const c = f.st === 'carry' ? EN.get(f.by) : null; v.grp.position.set(f.x, c ? c.y + 3 : GH(f.x, f.z), f.z); v.cloth.rotation.y = Math.sin(simTime * 3 + i) * .3; });
}
// drop the graphics quality by itself when the machine cannot keep up
const AQ = { t: 0, n: 0, sum: 0, rt: 0, rn: 0, rsum: 0 };
function autoQuality(now) {
    const ft = now - FS.last; if (ft > 1000) return; AQ.n++; AQ.sum += ft; AQ.rn++; AQ.rsum += ft;
    // every 2 s: fewer pixels when slower than ~28 fps, more again when comfortably fast (never above the preset)
    if (now - AQ.rt > 2000) {
        if (AQ.rt && AQ.rn >= 4) {
            const avg = AQ.rsum / AQ.rn, k0 = DRES.k;
            if (avg > 36 && DRES.k > DRES.min) DRES.k = Math.max(DRES.min, DRES.k - .1);
            else if (avg < 20 && DRES.k < 1) DRES.k = Math.min(1, DRES.k + .05);
            if (DRES.k !== k0) { renderer.setPixelRatio(Q.pr * DRES.k * Math.min(window.devicePixelRatio || 1, 1.25)); renderer.setSize(window.innerWidth, window.innerHeight, false); }
        }
        AQ.rt = now; AQ.rn = AQ.rsum = 0;
    }
    // every 5 s: still slow at the lowest resolution, so the preset drops (it starts again at full resolution)
    if (now - AQ.t > 5000) {
        if (AQ.t && AQ.n >= 8 && AQ.sum / AQ.n > 40 && DRES.k <= DRES.min && save.settings.quality !== 'low') { DRES.k = 1; save.settings.quality = save.settings.quality === 'high' ? 'med' : 'low'; applyQuality(); writeSave(); toast('Graphics lowered to ' + save.settings.quality + ' for smoother play'); }
        AQ.t = now; AQ.n = AQ.sum = 0;
    }
}
// ---------- input ----------
function typing(e) { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA'); }
function bindInput() {
    addEventListener('keydown', e => {
        if (typing(e)) return;
        IN.keys[e.code] = true;
        if (e.code === 'Tab' && M) { e.preventDefault(); UIS.board = true; }
        if (M && !e.repeat && ME && !ME.alive && !M.over && !$('#s-dead').classList.contains('hidden')) {      // death screen: 1-5 pick, Space deploys
            const n = /^Digit([1-5])$/.exec(e.code); if (n && save.lineup[+n[1] - 1]) { UIS.selDead = save.lineup[+n[1] - 1]; UI.paintDead(); sfx('click'); }
            if (e.code === 'Space' || e.code === 'Enter' && !PARTY.net) { e.preventDefault(); UI.deploy(); return; }
        }
        if (M && !e.repeat) {
            if (e.code === 'Escape' && !Cam.locked() && ME && ME.alive && !M.over && $('#s-pause').classList.contains('hidden') && $('#s-settings').classList.contains('hidden')) $('#s-pause').classList.remove('hidden');
            if (e.code === 'KeyC' && ME && ME.alive && ME.def.sub) { ME.diveOn = !ME.diveOn; toast(ME.diveOn ? 'Diving: only torpedoes can hit you, guns are off' : 'Surfacing'); }
            if (e.code === 'KeyF' && ME && ME.alive) { if (!dropFlares(ME) && !ME.def.flares && ME.def.ln === 'a') toast('Research the Countermeasures module for flares'); }
            if (e.code === 'Enter' && PARTY.net) { e.preventDefault(); const i = $('#h-say'); i.classList.remove('hidden'); if (document.pointerLockElement) document.exitPointerLock(); setTimeout(() => i.focus(), 0); IN.keys = {}; }
        }
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && M) e.preventDefault();
    });
    addEventListener('keyup', e => { IN.keys[e.code] = false; if (e.code === 'Tab') UIS.board = false; });
    addEventListener('blur', () => { IN.keys = {}; IN.mb = [0, 0, 0]; });
    addEventListener('mousedown', e => {
        if (!M || !ME) return;
        if (e.target.closest && e.target.closest('.scr:not(#s-dead),.dead-box,#h-say')) { return; }
        if (!ME.alive && !M.over) { nextSpec(1); return; }
        if (!Cam.locked() && ME.alive && $('#s-pause').classList.contains('hidden')) { Cam.lock(); }
        IN.mb[e.button] = 1; ac();
    });
    addEventListener('mouseup', e => { IN.mb[e.button] = 0; });
    addEventListener('contextmenu', e => { if (M) e.preventDefault(); });
    addEventListener('wheel', e => { if (M) IN.zoom = clamp(IN.zoom + Math.sign(e.deltaY) * .1, .55, 2.2); }, { passive: true });
    addEventListener('mousemove', e => {
        if (!M || !ME || !ME.alive || !Cam.locked()) return;
        const s = .0022 * save.settings.sens, air = ME.def.ln === 'a' && !ME.def.heli;
        IN.camYaw -= e.movementX * s; IN.camPitch = clamp(IN.camPitch - e.movementY * s * (save.settings.invertY ? -1 : 1), air ? -1.3 : -.35, air ? 1.3 : (ME.def.heli ? 1.2 : .95));
    });
    document.addEventListener('pointerlockchange', () => {
        const l = Cam.locked(); $('#h-lock').classList.toggle('hidden', l || !M || !ME || !ME.alive);
        if (!l && M && !M.over && ME && ME.alive && $('#s-settings').classList.contains('hidden') && $('#h-say').classList.contains('hidden')) $('#s-pause').classList.remove('hidden');
    });
    addEventListener('resize', () => { applyQuality(); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
    addEventListener('beforeunload', () => { writeSave(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { IN.keys = {}; IN.mb = [0, 0, 0]; } });
}
// ---------- boot ----------
// A tile battlefield is a file: the menu (and the battle behind it) waits for the chosen one. One that cannot be had is
// marked bad and the next is tried; with none, the old game's own ground is built.
function boot() {
    try {
        save = loadSave(); applyQuality(); if (save.opts.ground !== 'random') save.opts.ground = groundOr(save.opts.ground);
        setGround(new URLSearchParams(location.search).get('ground') || (save.opts.ground === 'random' ? '' : save.opts.ground));
        const start = () => { setGround(GROUND); const G = GROUNDS[GROUND]; if (G.tile && TILE.id !== G.tile) { $('#boot-s').textContent = 'Loading ' + G.name + '...'; TILE.load(G.tile).then(start, start); } else boot2(); };
        start();
    } catch (e) { $('#boot-s').textContent = 'Could not start: ' + e.message; console.error(e); }
}
function boot2() {
    try {
        buildWorld(); loadKit(); applyWeather('noon'); applyQuality(); initFx(); Lobby.init(); bindUI(); bindInput();
        camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
        UI.showMenu(); Lobby.refresh();
        if (save.shipRefund && !save.shipRefund.told) { save.shipRefund.told = 1; writeSave(); setTimeout(() => toast('The Remaster has no ships. What you had spent on them is back: ' + save.shipRefund.cr.toLocaleString() + ' credits and ' + save.shipRefund.rp.toLocaleString() + ' research points.'), 1500); }
        hgLoad().then(HG => { if (HG && HG.every) HG.every(50, () => { if (document.hidden && M && M.host && !simPaused()) advance(); }); });
        setTimeout(launcherBoot, 300);
        $('#menu').classList.remove('hidden');
        Intro.run().then(() => {
        if (!save.seenHow) { save.seenHow = true; save.seenNew = VERSION; writeSave(); setTimeout(() => { if (!M && !trainOffer()) UI.open('s-how'); }, 400); }      // 2.3: a new player is offered Basic training once
        else if (save.seenNew !== VERSION) { save.seenNew = VERSION; writeSave(); setTimeout(() => { if (!M) UI.open('s-new'); }, 400); }
        });
        trainBadge();
        requestAnimationFrame(frame); boot.done = true;
    } catch (e) { $('#boot-s').textContent = 'Could not start: ' + e.message; console.error(e); }
}
// Settings > speed test: the same team battle every time, timed for 20 s with whichever engine is drawing now.
// Test once with each engine (switch, reopen the game, test again) and the card compares the two.
function speedTestRun() {
    const veh = myVeh(), cfg = makeConfig([{ id: 0, name: myName(), veh, mm: modMask(veh) }], { mode: 'tdm', wx: 'noon', ground: GROUND }); beginMatch(cfg, 0, true);
    const keep = DBG.autoQ; DBG.autoQ = false;
    HG3D.speedTest({ game: 'steelstorm', renderer: HGR ? 'hg' : 'three', gl: renderer.getContext(), seconds: 20, onDone: () => { DBG.autoQ = keep; UI.leaveMatch(true); afterMatch(); HG3D.benchCard('steelstorm', 'Steel Storm speed test'); } });
}
// ---------- debug hook for tests ----------
function renderStats(n) {      // render n frames now and report the cost and renderer.info
    const gl = renderer.getContext(), t0 = performance.now(); let calls = 0, tris = 0;
    for (let i = 0; i < (n || 1); i++) { if (M) { updateWorld(.016); drawWorld(); } else if (Show.on) { Show.acc = 1; Show.frame(.04); } else { Lobby.acc = 1; Lobby.render(.016); } calls = renderer.info.render.calls; tris = renderer.info.render.triangles; }
    const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return { calls, tris, ms: +((performance.now() - t0) / (n || 1)).toFixed(1), programs: renderer.info.programs.length, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
}
window.__steelstorm = {
    version: VERSION,
    get state() { return M ? (M.over ? 'result' : 'match') : UIS.lobby && PARTY.code ? 'lobby' : UIS.screen; },
    get save() { return save; }, get match() { return M; }, get me() { return ME; }, get party() { return PARTY; }, get net() { return PARTY.net; },
    get mode() { return M && M.mode; }, get tickets() { return M && M.tickets; }, get kills() { return M && M.kills; }, get points() { return M && M.pts; }, get flags() { return M && M.flags; }, get weather() { return WXK; },
    ents() { return Array.from(EN.values()).map(e => ({ id: e.id, name: e.name, team: e.team, veh: e.def.id, mask: e.def.mask | 0, x: +e.x.toFixed(1), y: +e.y.toFixed(1), z: +e.z.toFixed(1), hp: Math.round(e.hp), alive: e.alive, kills: e.kills, deaths: e.deaths, score: Math.round(e.score), bot: !!e.isBot, remote: !!e.remote, ai: !!e.ai, dive: e.dive, carry: e.carry, sb: e.sb.length, stale: !!e.stale })); },
    ent(id) { return EN.get(id); }, get projectiles() { return PR.length; }, clk() { const o = {}; for (const k in CLK) o[k] = { delay: Math.round(CLK[k].delay), jit: Math.round(CLK[k].jit), jv: Math.round(CLK[k].jv), iv: Math.round(CLK[k].iv) }; return o; },
    getParts, makeModel, MAT, TEX, THREE, GROUNDS, LOOKS, useGround, NEWM, KIT, LAMPS, skyU, loadKit, get trees() { return treeChunks; }, get ground() { return GROUND; }, get world() { return WORLD; },
    get simTime() { return simTime; }, simPaused, tileSolid, tileOpen, myName, Intro, GROUNDS,
    VEHS, VBY, MODS, MODBY, BRANCHES, H, GH, PTS, TILE, TILE_IDS, TILE_GROUNDS, withGround, tile: id => TILE.load(id), drawWorld, get booted() { return !!boot.done; }, draw: drawWorld, pushOut: pushOutOfBuildings, get flagHome() { return FLAG_HOME; }, pickSpawn, get MAPH() { return MAPH; }, QUAL, WX, Lobby, BLD, EXT, ISL, UI, updateCamera, updateParticles, vdef, brOf, modMask,
    startMatch(o) {
        o = o || {}; const veh = o.veh || myVeh();
        const cfg = makeConfig([{ id: 0, name: myName(), veh, mm: o.mm !== undefined ? o.mm : modMask(veh) }], o); beginMatch(cfg, 0, true); return cfg;      // a tile battlefield other than the one standing: `await S.tile(id)` first
    },
    grant(o) { if (o.cr) save.credits += o.cr; if (o.rp) addRp(o.rp); if (o.free) save.freeRp += o.free; writeSave(); UI.wallet(); },
    research: { target: setTarget, free: spendFreeRp, canResearch, isResearched }, buy: buyVeh, lineup: lineupToggle, addRp, setTarget, buyVeh,
    press(code, down) { IN.keys[code] = down !== false; }, mouse(btn, down) { IN.mb[btn] = down === false ? 0 : 1; }, look(yaw, pitch) { if (yaw !== undefined) IN.camYaw = yaw; if (pitch !== undefined) IN.camPitch = pitch; },
    get cam() { return IN; }, get camera() { return camera; }, get renderer() { return renderer; }, get scene() { return scene; }, get sun() { return sun; },
    teleport(x, y, z, yaw) { if (!ME) return; ME.x = x; ME.z = z; ME.y = y === null || y === undefined ? GH(x, z) : y; if (yaw !== undefined) { ME.yaw = yaw; ME.tur = yaw; IN.camYaw = yaw; } },
    setVeh(id, mm) { if (!ME) return; if (ME.alive) { ME.alive = false; } ME.respT = 0; const ok = respawnMe(id); if (ok && mm !== undefined) { setDef(ME, vdef(id, mm)); spawnEnt(ME); } return ok; },
    damage(id, n, by) { hostDamage(by === undefined ? (ME ? ME.id : 0) : by, id, n, 0, 'w1', true); },
    kill(id) { const e = EN.get(id); if (!e) return; if (M && M.host) hostKill(id, ME && id !== ME.id ? ME.id : -1, 'w1'); },
    end(win) { endMatch(win === undefined ? 0 : win); },
    step(n, dt) { for (let i = 0; i < n; i++) { simStep(dt || .033); updateParticles(dt || .033); } updateFlagViz(); },
    fire(slot) { if (!ME) return false; ME[slot === 'w1' ? 't1' : slot === 'w2' ? 't2' : 't3'] = 0; return weaponFire(ME, slot, PC); },
    aim() { return ME && ME.alive ? aimRay(ME) : null; },
    perf() { const r = { frames: FS.n, avg: FS.n ? +(FS.sum / FS.n).toFixed(1) : 0, max: +FS.max.toFixed(1), over34: FS.over, render: FS.n ? +(FS.rsum / FS.n).toFixed(1) : 0, res: DRES.k }; FS.n = FS.sum = FS.max = FS.over = FS.rsum = 0; return r; },
    noRender(v) { DBG.noRender = v !== false; }, autoQ(v) { DBG.autoQ = !!v; },
    setQuality(q) { save.settings.quality = q; applyQuality(); return Q; }, setWeather(k) { return applyWeather(k); },
    renderStats,
    buildAll() {      // every vehicle, both team paints, every module combination's kit: report problems
        const out = { n: 0, errors: [], parts: {} };
        for (const v of VEHS) for (const t of [0, 1]) {
            try { const m = makeModel(vdef(v.id, 31), t, 42); let meshes = 0, tris = 0; m.root.traverse(o => { if (o.isMesh) { meshes++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } }); if (t === 0) out.parts[v.id] = { meshes, tris: Math.round(tris) }; disposeModel(m); out.n++; if (!m.muzzles.length) out.errors.push(v.id + ': no muzzle'); }
            catch (er) { out.errors.push(v.id + ': ' + er.message); }
        }
        return out;
    },
    party_create: partyCreate, party_join: partyJoin, party_leave: partyLeave, play: startPlay, ready: partyReady, team: partyTeam, chat: sendChat, kick: partyKick, shuffle: partyShuffle, balance: partyBalance,
    impair(o) { if (PARTY.net) PARTY.net.setImpairment(o); },
    leave() { UI.leaveMatch(true); afterMatch(); },
    ui: { open: id => UI.open(id), close: id => UI.close(id), showMenu: () => UI.showMenu(), paintResearch: () => UI.paintResearch(), openLobby: () => UI.openLobby(), closeLobby: () => UI.closeLobby(), go: v => UI.go(v), select: i => selectSlot(i), get view() { return UIS.screen; }, get selDead() { return UIS.selDead; }, pickDead: id => { UIS.selDead = id; UI.paintDead(); }, deploy: () => UI.deploy(), mpFake(list, fr) { UIX.fake = list ? { list, fr } : null; mpRefresh(true); }, mpRefresh: () => mpRefresh(true), conn: () => connState() },
    // the menu showcase (87-showcase.js): info() = { on, run, id, n, frames, shot, kills, hero }, ents() above lists its vehicles while no match runs
    show: { info: () => Show.info(), stop: () => Show.stop(), sync: () => showSync(), request: (id, m) => Show.request(id, m), set off(v) { Show.off = !!v; showSync(); }, get obj() { return Show; } },
    tut: trainHook(),      // 2.3 training (89-training.js)
    T: { PR, weaponFire, updateProjectiles, stepVehicle, stepSurface, missileLock, playerCtrl, makeConfig, hasLOS, newEnt, aiNew, spawnEnt, removeEnt, setDef, EN, IN, ballistic, pickSpawn, aiPickTarget, hostDamage, syncState, applySync, CLK, get save() { return save; } },
    compOf, myName, rosterNow, dump() { return JSON.stringify({ n: EN.size, pr: PR.length, t: M && Math.round(M.t) }); }
};
boot();
