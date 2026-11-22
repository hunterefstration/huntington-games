// ============================================================
// The skirmish: your tank against waves of others on the proving ground. Aiming is a line of sight you turn with the
// mouse (left/right and up/down); where it meets the ground or a tank is the aim point, the turret and gun follow at
// their own speed, and a ring shows where the gun as it points now would really land its shell.
// ============================================================
const HUD = { last: {},
    set(id, v, prop) { const k = id + (prop || ''); if (this.last[k] === v) return false; this.last[k] = v; const el = $(id); if (prop === 'w') el.style.width = v; else if (prop === 'o') el.style.opacity = v; else if (prop === 'c') el.className = v; else el.textContent = v; return true; },
    reset() { this.last = {}; $('feed').innerHTML = ''; $('banner').className = ''; $('callout').className = ''; this.set('msg', ''); this.set('prompt', ''); this.set('hurt', 0, 'o'); $('marks').innerHTML = ''; delete $('hud').dataset.sight; },
    banner(text, sub) { const b = $('banner'); b.innerHTML = esc(text) + (sub ? '<small>' + esc(sub) + '</small>' : ''); b.className = ''; void b.offsetWidth; b.className = 'show'; },
    callout(text) { const b = $('callout'); b.textContent = text; b.className = ''; void b.offsetWidth; b.className = 'show'; },
    feed(html) { const f = $('feed'), d = document.createElement('div'); d.innerHTML = html; f.appendChild(d); while (f.children.length > 5) f.removeChild(f.firstChild); setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 4000); },
    hit(kill) { const h = $('hit'); h.className = kill ? 'kill' : ''; h.style.transition = 'none'; h.style.opacity = 1; h.style.transform = 'rotate(45deg) scale(' + (kill ? 1.5 : 1) + ')'; void h.offsetWidth; h.style.transition = 'opacity .3s'; h.style.opacity = 0; },
    from(dx, dz, yaw) { const a = Math.atan2(dx, dz) - yaw, el = $('dmg-dir'); el.style.transition = 'none'; el.style.transform = 'rotate(' + (a).toFixed(2) + 'rad)'; el.style.opacity = 1; void el.offsetWidth; el.style.transition = 'opacity 1.2s'; el.style.opacity = 0; } };
const Game = { over: false, shopOpen: false }, TV = { e: [0, 0, 0], d: [0, 0, 1] }, GF = [0, 0, 0];
Game.start = function () {
    const G = Game; Units.clear(); World.smoke.clear(); World.fire.clear(); HUD.reset();
    // a clear place to start: spiral out from the middle
    let sx = World.mid[0], sz = World.mid[1]; const ok = (x, z) => !World.solid(x, z) && !World.solid(x + 3, z) && !World.solid(x - 3, z) && !World.solid(x, z + 3) && !World.solid(x, z - 3);
    out: for (let r = 0; r < World.size * 0.4; r += 4) for (let a = 0; a < 6.28; a += 0.5) { const x = World.mid[0] + Math.cos(a) * r, z = World.mid[1] + Math.sin(a) * r; if (ok(x, z)) { sx = x; sz = z; break out; } }
    const P = G.P = Units.make(0, sx, sz, 0); P.reload = 0;
    Object.assign(G, { wave: 0, phase: 'break', phaseT: 4, score: 0, kills: 0, shots: 0, hits: 0, kits: 2, time: 0, over: false, overT: 0, shown: false, aimYaw: 0, aimPitch: -0.04, sight: 0, aimHit: false, ax: 0, ay: 0, az: 0, shakeK: 0, hurt: 0, frame: 0 });
    Units.place(P); Game.eye(); Game.aim(); Input.aimOn = false;
    $('hud').dataset.mode = 'tank'; Game.hud(); Game.hint(); Music.set('fight'); Save.data.stats.games++; Save.store();
};
Game.stop = function () { HUD.reset(); delete $('hud').dataset.mode; Units.clear(); Music.set('menu'); };
Game.hint = function () { if (App.game !== Game) return; HUD.set('msg', Game.over ? '' : (!App.locked && !App.paused ? 'CLICK TO FIGHT' : '')); };
Game.statLine = () => Units.list.length + ' tanks, ' + Units.shells.length + ' shells';
Game.enemies = () => Units.list.filter(U => U.team === 1 && !U.dead);
// the eye and the way it looks: behind and above the tank, or (sight) the gunner's sight over the gun
Game.eye = function () {
    const G = Game, P = G.P, cp = Math.cos(G.aimPitch), d = TV.d, e = TV.e, s = G.sight; d[0] = Math.sin(G.aimYaw) * cp; d[1] = Math.sin(G.aimPitch); d[2] = Math.cos(G.aimYaw) * cp;
    const back = TD.camDist * (1 - s) - 1.6 * s; e[0] = P.x - d[0] * back; e[2] = P.z - d[2] * back; e[1] = P.y + 4.2 * (1 - s) + 3.1 * s - d[1] * back * (1 - s);
    e[1] = Math.max(e[1], World.top(e[0], e[2]) + 1.2);
};
// the first ground, thing standing on it, or enemy tank along the line of sight (none: the sky)
Game.aim = function () {
    const G = Game, e = TV.e, d = TV.d, under = t => e[1] + d[1] * t < World.top(e[0] + d[0] * t, e[2] + d[2] * t); let t = TD.camDist * (1 - G.sight) + 4, pt = t, best = 1e9; G.aimAt = null;
    for (const U of Units.list) { if (U.team !== 1 || U.dead) continue; const rx = U.x - e[0], ry = U.y + 1.4 - e[1], rz = U.z - e[2], along = rx * d[0] + ry * d[1] + rz * d[2]; if (along > t && along < best && rx * rx + ry * ry + rz * rz - along * along < 5.5) { best = along; G.aimAt = U; } }
    for (; t < 900 && t < best; pt = t, t += 1.5 + t * 0.03) if (under(t)) break;
    if (t >= best) t = best; else { G.aimAt = null; if (t >= 900) { G.aimHit = false; G.ax = e[0] + d[0] * 900; G.ay = e[1] + d[1] * 900; G.az = e[2] + d[2] * 900; return; } for (let i = 0; i < 6; i++) { const m = (pt + t) / 2; if (under(m)) t = m; else pt = m; } }
    G.aimHit = true; G.ax = e[0] + d[0] * t; G.ay = e[1] + d[1] * t; G.az = e[2] + d[2] * t;
};
// a sound out in the field, quieter with distance
Game.heard = function (x, z, vol, low, dur) { const P = Game.P, k = clamp(1.15 - Math.hypot(x - P.x, z - P.z) / 160, 0.06, 1); Snd.noise(vol * k, low * 6, low, dur); Snd.tone(low * 0.6, vol * k * 0.8, dur * 0.6, 'sine', low * 0.25); };
Game.landed = function () { };
// a shell struck tank U for dmg (0 = it glanced off); by = who fired
Game.struck = function (U, dmg, by, word) {
    const G = Game, P = G.P;
    if (U === P) { G.hurt = 1; G.shakeK = Math.max(G.shakeK, dmg > 0 ? 0.9 : 0.4); if (by && by !== P) HUD.from(by.x - P.x, by.z - P.z, G.aimYaw); HUD.callout(dmg > 0 ? word + '  -' + Math.round(dmg) : 'RICOCHET: ARMOUR HELD'); if (P.dead) { HUD.banner('TANK DESTROYED', 'wave ' + G.wave); Game.finish(); } return; }
    if (by !== P) return; if (word !== 'BLAST') G.hits++;
    if (U.dead) { G.kills++; const pts = 100 * G.wave; G.score += pts; HUD.hit(true); HUD.callout('DESTROYED  +' + pts); HUD.feed('<b>KILL</b> ' + word.toLowerCase() + ' <b>+' + pts + '</b>'); Snd.tone(440, 0.2, 0.5, 'triangle', 880); Save.data.stats.kills++; }
    else { HUD.hit(false); HUD.callout(dmg > 0 ? word + '  ' + Math.round(dmg) : 'RICOCHET'); Snd.tone(dmg > 0 ? 620 : 1400, 0.1, 0.08, 'square'); }
};
Game.nextWave = function () {
    const G = Game, P = G.P, w = ++G.wave, n = Math.min(5, 1 + Math.ceil(w / 1.5)), skill = clamp(0.12 + w * 0.09, 0, 0.9), base = Math.atan2(P.x - World.mid[0], P.z - World.mid[1]) + Math.PI;
    for (let i = 0; i < n; i++) { let x = 0, z = 0; for (let tries = 0; tries < 30; tries++) { const a = base + rand(-1.3, 1.3), r = World.size * rand(0.36, 0.44); x = World.mid[0] + Math.sin(a) * r; z = World.mid[1] + Math.cos(a) * r; if (World.inside(x, z) && !World.solid(x, z) && !World.solid(x + 3, z) && !World.solid(x, z + 3) && Math.hypot(x - P.x, z - P.z) > 45 && !Units.list.some(U => Math.hypot(U.x - x, U.z - z) < 9)) break; }
        const U = Units.make(1, x, z, Math.atan2(World.mid[0] - x, World.mid[1] - z)); U.max = U.hp = TD.hp * (0.8 + 0.08 * w); Units.brain(U, skill); }
    G.phase = 'fight'; HUD.banner('WAVE ' + w, n + ' hostile tank' + (n > 1 ? 's' : '') + ' inbound'); Snd.boom(0.5); Snd.tone(90, 0.4, 1.2, 'sawtooth', 60);
};
Game.finish = function () {
    const G = Game, st = Save.data.stats; if (G.over) return; G.over = true; G.overT = 2.6;
    G.result = { wave: G.wave, kills: G.kills, score: G.score, acc: G.shots ? Math.round(G.hits / G.shots * 100) : 0, time: G.time, record: G.score > st.bestScore && G.score > 0 };
    st.bestWave = Math.max(st.bestWave, G.wave); st.bestScore = Math.max(st.bestScore, G.score); st.shots += G.shots; st.hits += G.hits; Save.store(); Music.set('menu');
};
Game.hud = function () {
    const G = Game, P = G.P, left = Game.enemies().length;
    HUD.set('hp', Math.max(0, P.hp / P.max * 100).toFixed(0) + '%', 'w'); HUD.set('hp-n', Math.max(0, Math.ceil(P.hp / 10))); HUD.set('hp-n', P.hp < P.max * 0.3 ? 'low' : '', 'c');
    HUD.set('wname', SHELLS[P.shellType].full + '   [1] AP  [2] HE'); HUD.set('ammo', SHELLS[P.shellType].name); HUD.set('reserve', P.reload > 0 ? '  LOADING ' + P.reload.toFixed(1) : '  READY'); HUD.set('nades', 'REPAIR KITS ' + G.kits + (G.kits ? '  [R]' : ''));
    HUD.set('cash', String(G.score));
    HUD.set('hud-top', 'WAVE ' + G.wave + (G.phase === 'fight' ? '     ' + left + ' LEFT' : '') + '     RANGE ' + (G.aimHit ? Math.round(P.range) + ' m' : '---') + '     GUN ' + (P.elev >= 0 ? '+' : '') + (P.elev * 57.3).toFixed(1) + '°');
    HUD.set('prompt', G.over ? '' : G.phase === 'break' && G.wave > 0 ? 'NEXT WAVE IN ' + Math.ceil(G.phaseT) + '   [ENTER]' : G.time < 14 ? 'W A S D drive   MOUSE aims the gun, up and down too   CLICK or SPACE fires   E: gun sight' : '');
};
Game.update = function (dt0) {
    const G = Game, P = G.P; let dt = dt0; G.frame++; G.time += dt;
    if (G.over) { G.overT -= dt0; if (G.overT <= 0 && !G.shown) { G.shown = true; UI.results(G.result); } }
    let thr = 0, steer = 0, fire = false;
    if (!P.dead) {
        // the gunner's sight: E (press or hold, a setting), the right button or Shift
        const st = Save.data.settings; G.sight = lerp(G.sight, Input.aim() || keys.ShiftLeft || keys.ShiftRight ? 1 : 0, Math.min(1, dt * 9)); if (G.sight < 0.002) G.sight = 0;
        const sens = 0.0022 * st.sens * lerp(1, TD.sightFov / TD.fov * st.adsSens, G.sight);
        G.aimYaw -= mouse.dx * sens; G.aimPitch = clamp(G.aimPitch - mouse.dy * sens, -0.5, 0.55);
        thr = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0); steer = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0);
        fire = (mouse.fired || !!hit.Space) && App.locked;
        if (hit.Digit1) { P.shellType = 'ap'; Snd.ui('click'); } if (hit.Digit2) { P.shellType = 'he'; Snd.ui('click'); }
        if (hit.KeyR && G.kits > 0 && P.hp < P.max) { G.kits--; P.hp = Math.min(P.max, P.hp + 450); HUD.callout('REPAIRED'); Snd.ui('buy'); }
        if (hit.Enter && G.phase === 'break' && G.wave > 0) G.phaseT = Math.min(G.phaseT, 0.01);
        Units.drive(P, thr, steer, dt); Game.eye(); Game.aim(); Units.lay(P, G.ax, G.ay, G.az, G.aimHit, dt);
        Units.place(P); Units.fall(P, GF);
        if (fire && P.reload <= 0) { Units.fire(P, G); G.shots++; G.shakeK = Math.max(G.shakeK, 0.5); }
    }
    for (const U of Units.list.slice()) { if (U.team === 1) { if (U.dead) { if (U.deadT > 26) Units.retire(U); } else Units.ai(U, dt, G); } }
    Units.step(dt, G);
    if (!G.over) {
        if (G.phase === 'break') { G.phaseT -= dt; if (G.phaseT <= 0) Game.nextWave(); }
        else if (!Game.enemies().length) { const pts = 250 * G.wave; G.phase = 'break'; G.phaseT = 9; G.score += pts; G.kits = Math.min(3, G.kits + 1); P.hp = Math.min(P.max, P.hp + P.max * 0.35); HUD.banner('WAVE ' + G.wave + ' CLEAR', '+' + pts + '    hull patched, one repair kit'); Snd.ui('buy'); }
    }
    G.hurt = Math.max(0, G.hurt - dt * 1.4); G.shakeK = Math.max(0, G.shakeK - dt * 2.4);
    HUD.set('hurt', P.dead ? 0.8 : (G.hurt * 0.7 + (P.hp < P.max * 0.3 ? 0.22 : 0)).toFixed(2), 'o');
    Game.hud();
};
Game.render = function () {
    const G = Game, P = G.P, cam = World.camera, sh = Save.data.settings.shake ? G.shakeK * G.shakeK * 0.25 * (1 - G.sight * 0.7) : 0, jx = (Math.random() - 0.5) * sh, jy = (Math.random() - 0.5) * sh;
    const fov = lerp(Save.data.settings.fov, TD.sightFov, G.sight); if (cam.fov !== fov) { cam.fov = fov; cam.updateProjection(); }
    Game.eye(); const e = TV.e, d = TV.d; cam.lookFrom(e[0] + jx, e[1] + jy, e[2], e[0] + d[0] * 50, e[1] + d[1] * 50, e[2] + d[2] * 50);
    const w = cam.matrixWorld.elements, tf = Math.tan(fov * Math.PI / 360), toScreen = (x, y, z, out) => { const rx = x - w[12], ry = y - w[13], rz = z - w[14], vz = -(rx * w[8] + ry * w[9] + rz * w[10]); if (vz < 1) return false; out[0] = (0.5 + (rx * w[0] + ry * w[1] + rz * w[2]) / (vz * tf * cam.aspect) / 2) * innerWidth; out[1] = (0.5 - (rx * w[4] + ry * w[5] + rz * w[6]) / (vz * tf) / 2) * innerHeight; return true; };
    Units.render(w[12], w[13], w[14]); World.step(1 / 60, w); draw(World.scene, cam, true);
    // the gun ring: where the shell would land, on the screen
    const gm = $('gunmark'), s2 = Game.s2 || (Game.s2 = [0, 0]);
    if (P.dead || !toScreen(GF[0], GF[1], GF[2], s2)) gm.style.opacity = 0; else { gm.style.opacity = ''; gm.style.transform = 'translate(' + s2[0].toFixed(1) + 'px,' + s2[1].toFixed(1) + 'px)'; const cls = P.stop ? 'stop' : P.laid ? 'on' : ''; if (gm.className !== cls) gm.className = cls; }
    // a mark over every hostile tank, with how far it is
    const box = $('marks'), E = Units.list.filter(U => U.team === 1 && !U.dead); while (box.children.length < E.length) { const m = document.createElement('div'); m.className = 'mark'; m.innerHTML = '<b></b>'; box.appendChild(m); }
    for (let i = 0; i < box.children.length; i++) { const m = box.children[i], U = E[i]; if (!U || !toScreen(U.x, U.y + 3.6, U.z, s2)) { m.style.display = 'none'; continue; } m.style.display = ''; m.style.transform = 'translate(' + s2[0].toFixed(0) + 'px,' + s2[1].toFixed(0) + 'px) rotate(45deg)'; const t = Math.round(Math.hypot(U.x - P.x, U.z - P.z)) + ' m'; if (m.firstChild.textContent !== t) m.firstChild.textContent = t; }
    const sg = G.sight > 0.5 ? '1' : ''; if (($('hud').dataset.sight || '') !== sg) { if (sg) $('hud').dataset.sight = sg; else delete $('hud').dataset.sight; }
};
