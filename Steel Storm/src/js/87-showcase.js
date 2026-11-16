// ============================================================
// THE SHOWCASE: a tiny live battle behind the menus. The selected vehicle, driven by an elite bot (BOTD.elite), fights a few
// ordinary bots on a small patch of the real map with the match's own sim, AI and models, filmed by a cinematic camera
// (orbit, chase, tripod, over-the-shoulder, weapon and kill cams, with cuts). It never touches M, the save or the network:
// hits come here through reportHit (no match), sounds with a position are silent without a match, netFire needs a match.
// Cheap on purpose: 6 vehicles at most, a low resolution, ~30 frames a second, shadows every third frame. Paused while the menu
// is covered or the tab is hidden, gone (entities, shells, particles) the moment a match starts, and it switches off for the
// visit if this computer cannot keep up (the 3D lobby shows the vehicle instead).
// ============================================================
const SHOW_ID = 900, SHOW_FPS = 30;
const SHOW_TIPS = {
    lt: ['Never stop moving: speed is your armour', 'Flank wide and hit slower tanks in the side'],
    mt: ['Fire on the move, then duck behind cover to reload', 'Trade shots from cover, angle your hull'],
    ht: ['Lead the push: soak up the hits so your team can shoot', 'Face them head on: your front armour is thickest'],
    td: ['One huge shot from cover, then move', 'Let them come to you: the hardest-hitting gun on land'],
    spaa: ['Lead fast aircraft and keep firing', 'Stay near your tanks: you guard the sky above them'],
    arty: ['Lob shells over the hills from far behind the lines', 'Aim where they will be: shells take a while to land'],
    ftr: ['Keep your speed up and turn inside the enemy', 'Hold the target in your sights until the red LOCK, then fire'],
    atk: ['Dive in, rockets on the tanks, pull out before the flak', 'Come in from the side and keep moving'],
    bmb: ['Fly level over the target and release early: bombs fall forward', 'Go for groups: one bomb hurts them all'],
    heli: ['Hover low behind cover, pop up to fire, drop back down', 'Guided missiles from long range, then hide'],
    pb: ['Dart in fast, torpedoes away, get out', 'Zig-zag: big guns struggle to track a small boat'],
    dd: ['Turn broadside so every gun can fire', 'Keep moving and lead your torpedoes'],
    cl: ['Broadsides at mid range: more guns than a destroyer', 'Keep turning while you reload'],
    bb: ['Hit them before they get close: the biggest guns at sea', 'Broadside on, every turret firing together'],
    ss: ['Dive to hide, surface only to strike', 'Lead your torpedoes: aim where the ship will be']
};
const SHOTS = {
    g: [['chase', 3], ['target', 3], ['tripod', 2], ['orbit', 1.5]], arty: [['target', 2], ['chase', 2], ['orbit', 1.5], ['tripod', 1]],
    a: [['chase', 4], ['orbit', 2], ['tripod', 2], ['target', 2]], heli: [['chase', 2], ['target', 3], ['orbit', 2], ['tripod', 1]],
    n: [['orbit', 2.5], ['chase', 2], ['target', 2], ['tripod', 2]]
};
const SV = new THREE.Vector3(), SV2 = new THREE.Vector3(), SV3 = new THREE.Vector3(), SF = new THREE.Vector3();
function showLand(x, z) {      // a flat, open spot of land near (x, z)
    for (let r = 0; r < 320; r += 12) for (let k = 0; k < (r ? 12 : 1); k++) {
        const a = k * TAU / 12, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, h = H(px, pz);
        if (h > 3 && h < 22 && GH(px, pz) === h && Math.abs(H(px + 5, pz) - h) < 2.5 && Math.abs(H(px, pz + 5) - h) < 2.5) return { x: px, z: pz, y: h };
    }
    return { x, z, y: Math.max(0, H(x, z)) };
}
function showSea(x, z) {
    for (let r = 0; r < 400; r += 15) for (let k = 0; k < (r ? 12 : 1); k++) { const a = k * TAU / 12, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (H(px, pz) < -8) return { x: px, z: pz, y: 0 }; }
    return { x, z, y: 0 };
}
function showPick(ln, classes, t) {      // a vehicle of one of these classes, as close to tier t as there is
    for (const dt of [0, -1, 1, -2, 2]) { const L = VEHS.filter(v => v.ln === ln && classes.includes(v.cls) && v.t === t + dt); if (L.length) return L[Math.floor(Math.random() * L.length)]; }
    return VEHS.find(v => v.ln === ln);
}
const Show = {
    on: false, id: null, mask: 0, want: null, wantMask: 0, wantT: 0, run: false, ents: [], hero: null, P: null, acc: 0, frames: 0, kills: 0, deaths: 0,
    off: false, res: 0, sh: 0, strT: 1, tipN: 0, lk: 0, ovOn: false, seen: new WeakSet(), perf: { n: 0, sum: 0, t: 0 },
    cam: { k: '', t: 0, snap: true, ang: 0, side: 1, n: 0, p: new THREE.Vector3(), l: new THREE.Vector3(), tp: new THREE.Vector3(), kp: new THREE.Vector3(), pr: null, hold: 0, wcd: 0, kcd: 0 },
    // ask for a vehicle (null = no showcase). The switch happens on the next frame after a short pause, so a fast row of clicks builds once.
    request(id, mask) {
        if (this.off || !save.settings.show) id = null;
        if (id === this.want && (mask | 0) === this.wantMask) return;
        this.want = id; this.wantMask = mask | 0; this.wantT = performance.now() + (this.on && id ? 120 : 0);
    },
    // called every animation frame while there is no match. true = the showcase owns the canvas (the 3D lobby must not draw)
    frame(rdt) {
        if (this.want !== this.id || this.wantMask !== this.mask) { if (performance.now() >= this.wantT) { if (this.want) this.build(); else this.stop(); } }
        if (!this.on) return false;
        if (this.frames) gameReady();
        if (!this.run || document.hidden) return true;
        this.acc += rdt; if (this.acc < 1 / SHOW_FPS - .004) return true;
        const dt = Math.min(this.acc, .1); this.acc = 0;
        const t0 = performance.now();
        const n = Math.ceil(dt / .034); for (let i = 0; i < n; i++) this.step(dt / n);
        updateParticles(dt); this.direct(dt); updateWorld(dt);
        this.lowRes();
        if (Q.sh) { renderer.shadowMap.autoUpdate = false; if (++this.sh % 3 === 1) renderer.shadowMap.needsUpdate = true; }
        renderer.render(scene, camera); this.frames++;
        this.drawLock(dt);
        this.watch(performance.now() - t0);
        return true;
    },
    lowRes() {      // about half the pixels of the graphics preset: it sits behind the menu
        const pr = Math.max(.35, Q.pr * .7) * Math.min(window.devicePixelRatio || 1, 1.25);
        if (Math.abs(renderer.getPixelRatio() - pr) > .01) { renderer.setPixelRatio(pr); renderer.setSize(window.innerWidth, window.innerHeight, false); this.res = 1; }
    },
    restoreRes() { if (this.res) { this.res = 0; applyQuality(); } renderer.shadowMap.autoUpdate = !(Q.shEvery > 1); renderer.shadowMap.needsUpdate = true; },
    watch(ms) {      // a computer that needs more than ~40 ms for a showcase frame gets the light 3D lobby instead
        const P = this.perf, now = performance.now(); P.n++; P.sum += ms;
        if (now - P.t > 3000) { if (P.t && P.n >= 20 && P.sum / P.n > 40) { this.off = true; this.request(null); toast('Showcase footage paused to keep the menu smooth (Settings can turn it back on)'); if (typeof UI !== 'undefined' && UI.paintSettings) UI.paintSettings(); } P.t = now; P.n = P.sum = 0; }
    },
    // ---- the scene: who fights where, by the hero's class ----
    plan(def) {
        const b = def.base || def, cls = b.cls, ln = b.ln, t = b.t, G = showLand(-20, 25), S = showSea(0, 548), tanks = ['lt', 'mt', 'ht', 'td'];
        const E = PI / 2, Wd = -PI / 2, P = { A: G, r: 90, foes: [], allies: [] };
        const land = (dx, dz, yaw) => { const p = showLand(G.x + dx, G.z + dz); return { x: p.x, z: p.z, y: p.y, yaw }; };
        const sea = (dx, dz, yaw) => { const p = showSea(S.x + dx, S.z + dz); return { x: p.x, z: p.z, y: 0, yaw }; };
        const air = (dx, dz, alt, yaw) => ({ x: G.x + dx, z: G.z + dz, y: Math.max(0, H(G.x + dx, G.z + dz)) + alt, yaw });
        const g = (c, sp) => [showPick('g', c, t), sp], a = (c, sp) => [showPick('a', c, t), sp], n = (c, sp) => [showPick('n', c, t), sp];
        if (ln === 'n') {
            P.A = S; P.r = 170; P.hero = sea(-230, 0, E);
            const F = cls === 'ss' ? ['dd', 'cl', 'bb'] : cls === 'pb' ? ['pb', 'dd'] : ['dd', 'cl', 'bb'];
            P.foes = [n(F, sea(230, -70, Wd)), n(F, sea(270, 70, Wd)), n(['pb', 'dd'], sea(180, 10, Wd))];
            if (cls !== 'ss') P.allies = [n(['dd', 'cl'], sea(-270, 110, E))];
        } else if (cls === 'ftr') {
            P.r = 300; P.hero = air(-460, 0, 130, E);
            P.foes = [a(['ftr'], air(380, -90, 140, Wd)), a(['ftr'], air(420, 90, 155, Wd)), a(['bmb', 'atk'], air(480, 0, 120, Wd))];
            P.allies = [a(['ftr'], air(-520, 130, 145, E))];
        } else if (ln === 'a') {
            P.r = cls === 'heli' ? 140 : 280; P.hero = cls === 'heli' ? air(-330, 0, 28, E) : air(-470, 0, cls === 'bmb' ? 140 : 115, E);
            P.foes = [g(tanks, land(60, -30, Wd)), g(tanks, land(85, 35, Wd)), g(cls === 'heli' ? tanks : ['spaa'], land(130, 0, Wd))];
            P.allies = [g(['mt', 'ht'], land(-90, 25, E))];
        } else if (cls === 'spaa') {
            P.hero = land(-60, 0, E);
            P.foes = [a(['atk'], air(650, -50, 110, Wd)), a(['heli'], air(380, 60, 35, Wd)), g(tanks, land(150, 30, Wd))];
            P.allies = [g(['mt', 'ht'], land(-30, 45, E))];
        } else if (cls === 'arty') {
            P.hero = land(-330, 10, E); P.heroHome = 1;
            P.foes = [g(tanks, land(80, -30, Wd)), g(tanks, land(100, 35, Wd)), g(tanks, land(140, 0, Wd))];
            P.allies = [g(['mt', 'ht'], land(-40, 20, E))];
        } else {
            P.hero = land(-110, 0, E);
            P.foes = [g(tanks, land(110, -35, Wd)), g(tanks, land(130, 40, Wd)), g(tanks, land(170, 0, Wd))];
            P.allies = [g(['mt', 'ht', 'td'], land(-130, 50, E))];
        }
        return P;
    },
    mk(id, def, team, name, sp, elite, home) {
        const e = newEnt(id, def, team, name); e.isBot = true; e.carry = -1; aiNew(e);
        if (elite) { e.ai.elite = true; e.ai.skill = rnd(.96, 1); }
        e.ai.home = home || { x: this.P.A.x, z: this.P.A.z, r: this.P.r };
        e.sp0 = sp; spawnEnt(e, Object.assign({}, sp)); e.prot = 0; this.ents.push(e); return e;
    },
    build() {
        const id = this.want, mask = this.wantMask, v = VBY[id]; this.clear();
        if (!v) { this.stop(); return; }
        this.id = id; this.mask = mask; this.kills = this.deaths = 0;
        const def = vdef(id, mask), P = this.P = this.plan(def), bm = t => { let m = 0; for (let i = 0; i < 5; i++) if (Math.random() < (t - 1) * .2) m |= 1 << i; return m; };
        this.hero = this.mk(SHOW_ID, def, 0, 'You', P.hero, true, P.heroHome ? { x: P.hero.x, z: P.hero.z, r: 30 } : null);
        let i = 1; for (const [fv, sp] of P.allies) this.mk(SHOW_ID + i++, vdef(fv.id, bm(fv.t)), 0, 'Ally', sp);
        for (const [fv, sp] of P.foes) this.mk(SHOW_ID + i++, vdef(fv.id, bm(fv.t)), 1, 'Enemy', sp);
        this.on = true; this.acc = 1; this.tipN = 0; this.lk = 0; this.cam.wcd = 3; this.cam.kcd = 0;
        if (Math.abs(camera.fov - 50) > .1) { camera.fov = 50; camera.updateProjectionMatrix(); }
        this.cut('orbit', 4.5); this.caption();
    },
    clear() {      // remove the showcase's vehicles, shells and smoke (leaves the resolution alone)
        for (const e of this.ents) if (EN.get(e.id) === e) removeEnt(e);
        this.ents = []; this.hero = null; PR.length = 0; PA.life.fill(0); updateParticles(0); updateProjectiles(0);
        if (this.ovOn) { ovc.clearRect(0, 0, $('#ov').width, $('#ov').height); this.ovOn = false; }
    },
    stop() {
        if (!this.on && !this.ents.length) { this.id = null; return; }
        this.clear(); this.on = false; this.id = null; this.mask = 0; if (!M) this.want = null;
        this.restoreRes(); const c = $('#sc-cap'); if (c) c.classList.add('hidden');
    },
    // ---- the fight ----
    step(dt) {
        simTime += dt;
        for (const e of this.ents) {
            if (e.prot > 0) e.prot -= dt;
            if (e.alive) { aiStep(e, dt); if (e.crashed) { e.crashed = false; this.die(e, null); } }
            else if ((e.respT -= dt) <= 0) this.respawn(e);
        }
        separate(); updateProjectiles(dt);
        for (const e of this.ents) if (e.alive) smokeDamaged(e, dt);
        if ((this.strT -= dt) <= 0) { this.strT = 1; const A = this.P.A; for (const e of this.ents) if (e.alive && Math.hypot(e.x - A.x, e.z - A.z) > (e.def.ln === 'a' ? 1100 : e.def.ln === 'n' ? 600 : 480)) this.respawn(e); }
    },
    hit(p, tg, dmg) {
        const a = EN.get(p.own), h = this.hero; if (!a || !tg.alive || tg.prot > 0 || a.team === tg.team || this.ents.indexOf(tg) < 0) return;
        let eff = dmg / (1 + Math.max(0, tg.def.ar * (1 - (p.pk || 0))) / 100);
        eff *= a === h ? (a.def.ln === 'a' && !a.def.heli ? (p.k === 'bullet' ? 5 : 3) : 1.8) : tg === h ? .3 : 1;      // the hero is the star of the show
        eff = Math.min(eff, tg.def.hp * .5); tg.hp -= eff;
        if (tg.hp <= 0) this.die(tg, a);
    },
    die(e, k) {
        killVisual(e); e.hp = 0; e.kdone = true; e.respT = e === this.hero ? 2.6 : rnd(3, 5);
        const c = this.cam;
        if (e === this.hero) { this.deaths++; c.kp.set(e.x, e.y, e.z); this.cut('kill', 2.6); }
        else if (k === this.hero) { this.kills++; if (c.kcd <= 0 && c.k !== 'weapon' && Math.random() < .7) { c.kp.set(e.x, e.y, e.z); this.cut('kill', 2); c.kcd = 8; } }
    },
    respawn(e) {
        const sp = Object.assign({}, e.sp0); if (e.def.ln === 'a') { sp.x += rnd(-30, 30); sp.z += rnd(-30, 30); }
        e.kdone = false; e.hp = e.def.hp; spawnEnt(e, sp); e.prot = 1;
        if (e === this.hero) this.cut('orbit', 3.5);
    },
    // ---- the camera ----
    size() { const d = this.hero.def, P = getParts(d, 0); return d.ln === 'a' ? Math.max(P.len, P.span) * .9 : P.len; },
    dom() { const d = this.hero.def; return d.heli ? 'heli' : d.cls === 'arty' ? 'arty' : d.ln; },
    cut(k, dur) {
        const c = this.cam; c.k = k; c.t = dur || rnd(3.6, 5.6); c.snap = true; c.ang = rnd(0, TAU); c.side = Math.random() < .5 ? -1 : 1; c.hold = 0; c.n++;
        if (k === 'tripod' && this.hero) {      // a fixed camera ahead of where the hero is going, off to one side
            const h = this.hero, s = this.size(), air = h.def.ln === 'a' && !h.def.heli, f = this.fwd(h, SV), sd = SV2.set(f.z, 0, -f.x).normalize();
            const ah = air ? 230 : h.def.ln === 'n' ? s * 2.2 + 70 : 30 + s * 2.5, sw = air ? 55 : h.def.ln === 'n' ? s * 1.3 + 20 : 12 + s;
            c.tp.set(h.x + f.x * ah + sd.x * sw * c.side, 0, h.z + f.z * ah + sd.z * sw * c.side);
            c.tp.y = air ? h.y - 18 : Math.max(GH(c.tp.x, c.tp.z), 0) + (h.def.ln === 'n' ? 5 + s * .08 : 2.2 + s * .1);
        }
        if (c.n % 2 === 0) this.caption();
    },
    next() {
        const L = SHOTS[this.dom()].filter(s => s[0] !== this.cam.k), tot = L.reduce((s, x) => s + x[1], 0); let r = Math.random() * tot;
        for (const [k, w] of L) { r -= w; if (r <= 0) return this.cut(k); }
        this.cut(L[0][0]);
    },
    fwd(e, out) {
        if (e.def.ln === 'a' && !e.def.heli) { const cp = Math.cos(e.pitch); return out.set(Math.sin(e.yaw) * cp, Math.sin(e.pitch), Math.cos(e.yaw) * cp); }
        const sp = Math.hypot(e.vx || 0, e.vz || 0); return sp > 2 && e.def.ln !== 'a' ? out.set(e.vx / sp, 0, e.vz / sp) : out.set(Math.sin(e.yaw), 0, Math.cos(e.yaw));
    },
    direct(dt) {
        const c = this.cam, h = this.hero; if (!h) return;
        c.wcd -= dt; c.kcd -= dt; c.t -= dt;
        // the hero just fired something worth following: missile, bomb, torpedo (artillery: the shell)
        for (const p of PR) if (p.own === h.id && !this.seen.has(p)) {
            this.seen.add(p);
            if ((p.k === 'missile' || p.k === 'bomb' || p.k === 'torp' || (p.k === 'shell' && h.def.cls === 'arty')) && c.wcd <= 0 && c.k !== 'kill' && Math.random() < .6) { this.cut('weapon', 6); c.pr = p; c.wcd = 7; }
        }
        if (c.k === 'weapon' && c.pr && c.hold <= 0 && PR.indexOf(c.pr) < 0) { c.hold = 1.3; c.kp.set(c.pr.x, c.pr.y, c.pr.z); }
        if (c.hold > 0 && (c.hold -= dt) <= 0) { c.pr = null; this.next(); }
        else if (c.t <= 0 && c.hold <= 0) { if (c.k === 'kill' && !h.alive) c.t = .5; else this.next(); }
        const s = this.size(), air = h.def.ln === 'a' && !h.def.heli, P = SV, L = SV3, f = this.fwd(h, SF);
        const T = h.ai && h.ai.tgt && h.ai.tgt.alive ? h.ai.tgt : null; let k = 1 - Math.exp(-dt * (air ? 9 : 4.5));
        switch (c.k) {
            case 'orbit': { c.ang += dt * (air ? .45 : .32); const r = s * (air ? 1.5 : 1.25) + (air ? 9 : 6); P.set(h.x + Math.sin(c.ang) * r, h.y + s * .35 + 2.2, h.z + Math.cos(c.ang) * r); L.set(h.x, h.y + s * .12 + (h.def.ln === 'g' ? 1.2 : 0), h.z); if (air) k = 1; break; }
            case 'chase': { const b = s * 1.4 + 7, u = s * .38 + (air ? 2.4 : 3.2); P.set(h.x - f.x * b, h.y - f.y * b + u, h.z - f.z * b); L.set(h.x + f.x * 30, h.y + f.y * 30 + (air ? 1 : 1.5), h.z + f.z * 30); if (T && !air) { L.x += (T.x - L.x) * .35; L.y += (T.y + 1.5 - L.y) * .35; L.z += (T.z - L.z) * .35; } if (air) k = 1; break; }
            case 'target': {
                if (!T) { P.set(h.x - f.x * (s * 1.4 + 7), h.y + s * .38 + 3, h.z - f.z * (s * 1.4 + 7)); L.set(h.x + f.x * 30, h.y + 1.5, h.z + f.z * 30); break; }
                const dx = h.x - T.x, dy = h.y - T.y, dz = h.z - T.z, D = Math.hypot(dx, dy, dz) || 1, b = s * 1.3 + 8, sw = (s * .7 + 3) * c.side;
                P.set(h.x + dx / D * b + dz / D * sw, h.y + dy / D * b * .4 + s * .45 + 3.5, h.z + dz / D * b - dx / D * sw);
                L.set(h.x + (T.x - h.x) * .4, h.y + (T.y - h.y) * .4 + 1, h.z + (T.z - h.z) * .4); if (air) k = 1; break;
            }
            case 'tripod': { P.copy(c.tp); L.set(h.x, h.y + s * .1 + 1, h.z); if (h.alive && Math.hypot(h.x - c.tp.x, h.z - c.tp.z) > (air ? 600 : 260) && c.t > .5) c.t = .5; k = 1; break; }
            case 'weapon': {
                const p = c.pr; if (c.hold > 0 || !p) { L.copy(c.kp); P.copy(c.p); k = 1; break; }
                const v = Math.hypot(p.vx, p.vy, p.vz) || 1, vx = p.vx / v, vy = p.vy / v, vz = p.vz / v;
                if (p.k === 'bomb') { const hz = Math.hypot(vx, vz) || 1; P.set(p.x - vx / hz * 14, p.y + 9, p.z - vz / hz * 14); L.set(p.x + vx / hz * 8, p.y - 10, p.z + vz / hz * 8); }
                else if (p.k === 'torp') { P.set(p.x - vx * 10, 3.2, p.z - vz * 10); L.set(p.x + vx * 30, 0, p.z + vz * 30); }
                else { P.set(p.x - vx * 9, p.y - vy * 9 + 2.4, p.z - vz * 9); L.set(p.x + vx * 25, p.y + vy * 25, p.z + vz * 25); }
                k = 1; break;
            }
            case 'kill': { c.ang += dt * .4; const r = 16 + s * 1.2; P.set(c.kp.x + Math.sin(c.ang) * r, c.kp.y + 6 + s * .3, c.kp.z + Math.cos(c.ang) * r); L.copy(c.kp); k = 1; break; }
        }
        if (c.snap) { c.p.copy(P); c.l.copy(L); c.snap = false; } else { c.p.lerp(P, k); c.l.lerp(L, Math.min(1, k * 1.3)); }
        const gy = Math.max(GH(c.p.x, c.p.z), 0) + 1.4; if (c.p.y < gy) c.p.y = gy;
        camera.position.copy(c.p); camera.lookAt(c.l);
    },
    // yellow brackets close in on the hero's target, then a red LOCK (the same half second a player waits for)
    drawLock(dt) {
        const cv = $('#ov'), W = cv.width, Hh = cv.height, h = this.hero;
        if (this.ovOn) { ovc.clearRect(0, 0, W, Hh); this.ovOn = false; }
        const d = h && h.def, ms = d && ['w1', 'w2', 'w3'].some(s => d[s] && d[s].k === 'missile'), T = h && h.alive && h.ai && h.ai.tgt && h.ai.tgt.alive ? h.ai.tgt : null;
        if (!ms || !T || d3(h, T) > 900 || this.cam.k === 'weapon' || this.cam.k === 'kill') { this.lk = 0; return; }
        this.lk = Math.min(1, this.lk + dt / LOCK_T);
        const p = proj(T.x, T.y + (T.def.ln === 'a' ? 0 : 1.5), T.z); if (!p) return;
        const kq = this.lk, z = Math.max(10, (34 - 18 * kq) * W / 1000), col = kq >= 1 ? '#ff3b30' : '#ffd21f', x = p[0], y = p[1], q = z * .45;
        ovc.strokeStyle = col; ovc.lineWidth = 2; ovc.beginPath();
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ovc.moveTo(x + sx * z, y + sy * (z - q)); ovc.lineTo(x + sx * z, y + sy * z); ovc.lineTo(x + sx * (z - q), y + sy * z); }
        ovc.stroke(); if (kq >= 1) { ovc.fillStyle = col; ovc.font = 'bold ' + Math.round(11 * W / 900) + 'px Trebuchet MS,sans-serif'; ovc.textAlign = 'center'; ovc.fillText('LOCK', x, y - z - 5); }
        this.ovOn = true;
    },
    caption() {
        const el = $('#sc-cap'), h = this.hero; if (!el || !h) return;
        const b = h.def.base || h.def, tips = SHOW_TIPS[b.cls] || ['', ''];
        el.innerHTML = '<span class="sc-live">LIVE</span><b>' + esc(b.n) + '</b><small>' + esc(CLS_NAME[b.cls]) + ' &middot; elite play</small><em>' + esc(tips[this.tipN++ % tips.length]) + '</em>';
        el.classList.remove('hidden');
    },
    info() { return { on: this.on, run: this.run, id: this.id, want: this.want, n: this.ents.length, frames: this.frames, shot: this.cam.k, kills: this.kills, deaths: this.deaths, off: this.off, hero: this.hero ? { veh: this.hero.def.id, alive: this.hero.alive, elite: !!(this.hero.ai && this.hero.ai.elite), x: Math.round(this.hero.x), z: Math.round(this.hero.z) } : null }; }
};
function gameReady() { if (!window.__hgReady) { window.__hgReady = 1; try { if (parent !== window && parent.HG_gameReady) setTimeout(() => parent.HG_gameReady(), 80); } catch (e) {} } }      // the launcher's loading screen can go
