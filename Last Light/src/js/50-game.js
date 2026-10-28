// ==========================================
// GAME: one level at a time. Fixed 120 Hz physics, camera, HUD, finishing and saving.
// ==========================================
const G = {
    state: 'title', L: null, p: null, world: 0, t: 0, time: 0, parts: [], ghosts: [], rings: [], shots: [], motes: [],
    cam: { x: 0, y: 0, snap: 0 }, shakeT: 0, shakeA: 0, flash: 0, white: 0, done: false, levelKey: '', boss: null, ambient: null,
    got: { sparks: 0, moths: [] }, stats: {}, checkpoint: null, idx: -1,
    maxHearts: () => settings.hard ? 1 : 3,
    shake(a) { if (!settings.shake) return; this.shakeA = Math.max(this.shakeA * (this.shakeT > 0 ? 1 : 0), a); this.shakeT = 0.25; },
    bossAlive() { return !!this.boss || !!(this.guard && this.guard.state !== 'free' && this.guard.state !== 'gone'); },
    start(idx) {
        const def = LEVELS[idx]; if (!def) return;
        this.idx = idx; this.L = parseLevel(def); this.world = def.world; this.levelKey = def.id + ':' + Date.now();
        this.p = makePlayer(this.L.start.x, this.L.start.y); this.p.hearts = this.maxHearts();
        this.checkpoint = { x: this.L.start.x, y: this.L.start.y };
        this.parts = []; this.ghosts = []; this.rings = []; this.shots = []; this.t = 0; this.time = 0; this.done = false; this.flash = 0; this.white = 0; this.ambient = null;
        this.got = { sparks: 0, moths: [false, false, false] }; this.deathShown = false; this.cause = ''; this.stats = { deaths: 0, hits: 0, jumps: 0, stomps: 0, dashes: 0 };
        let mi = 0; for (const e of this.L.ents) if (e.kind === 'moth') e.idx = mi++;
        for (const e of this.L.ents) if (e.kind === 'npc') { const tk = TALKS[def.id]; e.who = tk ? tk[0] : 'bram'; e.talked = !!SAVE.d.talks[def.id]; }
        // moths already found stay found (shown faint) so a replay is about what is still missing
        const rec = SAVE.d.levels[def.id];
        for (const e of this.L.ents) if (e.kind === 'moth' && rec && rec.moths && rec.moths[e.idx]) e.ghost = true;
        const be = this.L.ents.find(e => e.kind === 'boss'); this.boss = be ? makeBoss(be) : null;
        const ge = this.L.ents.find(e => e.kind === 'guard'); this.guard = ge ? makeGuard(this, ge) : null; UI.bossbar(null);
        if (this.boss || this.guard) { const gt = this.L.ents.find(e => e.kind === 'gate'); if (gt) { gt.gone = true; gt.hidden = true; } }
        this.iris = 0; this.outro = null; this.hitstop = 0; this.guardSpoke = false; this.gloomSpoke = false; this.p.spawnT = 0.75; Sound.play('lantern');
        const r = seeded(def.id.length * 977 + idx);
        this.motes = Array.from({ length: 40 }, () => ({ x: r() * 2000, y: r() * 1200, r: 0.8 + r() * 2.2, s: 0.3 + r() * 0.8, p: r() * 9, k: 0.3 + r() * 0.6 }));
        this.cam.x = this.p.x; this.cam.y = this.p.y - 40; this.cam.snap = 0; this.cam.look = 0;
        this.state = 'play';
        Sound.musicFor(this.world);
        UI.show(null); $('#hud').classList.remove('hidden');
        this.hud();
        UI.banner(def.world === 4 ? 'Final' : WORLDS[def.world].name + ' · ' + def.id, def.name);
    },
    update(dt) {
        if (this.state !== 'play') return;
        // a split-second freeze when a stomp lands: it makes the hit feel solid
        if (this.hitstop > 0) { this.hitstop -= dt; return; }
        this.t += dt; this.iris = Math.min(1, (this.iris ?? 1) + dt * 1.5); if (this.p.spawnT > 0) this.p.spawnT -= dt;
        if (!this.done) { this.time += dt; SAVE.d.playTime += dt; this._sv = (this._sv || 0) + dt; if (this._sv > 10) { this._sv = 0; SAVE.write(); } }
        updatePlayer(this, dt);
        updateWorld(this, dt);
        if (this.boss) bossUpdate(this, dt);
        if (this.guard) guardUpdate(this, dt);
        updateParts(this, dt);
        this.flash = Math.max(0, this.flash - dt * 1.5);
        if (this.white > 0 && !(this.boss && this.boss.state === 'dying')) this.white = Math.max(0, this.white - dt * 0.6);
        if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakeA = 0; }
        // camera: leads in the direction you are actually moving, eased in and out, so turning around (or tapping the
        // other way) barely moves it; standing still it drifts back to centre slowly
        const p = this.p, L = this.L, vw = R.W / R.z, vh = R.H / R.z, cam = this.cam;
        const want = Math.abs(p.vx) > 40 ? clamp(p.vx * 0.3, -80, 80) : (cam.look || 0) * 0.995;
        cam.look = approach(cam.look || 0, want, dt * (Math.abs(want) > Math.abs(cam.look || 0) ? 110 : 60));
        let tx = p.x + cam.look, ty = p.y - 30 + (p.vy > 300 ? p.vy * 0.12 : 0);
        if (this.boss) { tx = lerp(tx, this.boss.x, 0.35); }
        // a guardian fight frames the arena: floor near the bottom, the guardian and you both in view
        const B = this.guard;
        if (B && B.state !== 'wait' && B.state !== 'gone') { tx = clamp(lerp(p.x, B.x, 0.35), Math.min(B.x0 - TS + vw / 2, (B.x0 + B.x1) / 2), Math.max(B.x1 - vw / 2, (B.x0 + B.x1) / 2)); ty = B.floor - vh * 0.36; }
        tx = clamp(tx, vw / 2, Math.max(vw / 2, L.w * TS - vw / 2)); ty = clamp(ty, vh / 2, Math.max(vh / 2, L.h * TS - vh / 2));
        if (L.w * TS < vw) tx = L.w * TS / 2; if (L.h * TS < vh) ty = L.h * TS / 2;
        if (this.cam.snap > 0) { this.cam.snap -= dt; this.cam.x = tx; this.cam.y = ty; }
        else { this.cam.x = lerp(this.cam.x, tx, Math.min(1, dt * 6)); this.cam.y = lerp(this.cam.y, ty, Math.min(1, dt * 5)); }
        if (Input.hit('retry') && !p.dead && !this.done) { respawn(this); this.toast('Back to the last lantern'); }
    },
    revealGate() { const g = this.L.ents.find(e => e.kind === 'gate'); if (g) { g.gone = false; g.hidden = false; burst(this, g.x, g.y, '#fff2c4', 40, 260); } },
    shrine(e) {
        e.used = true;
        const what = { double: ['Double jump', 'Press jump again in the air'], wall: ['Wall jump', 'Slide down a wall and jump off it'], dash: ['Dash', 'Press Shift or X to dash (hold up to dash upward)'] }[this.L.def.gives];
        if (!what) return;
        const first = !SAVE.d.abilities[this.L.def.gives];
        SAVE.d.abilities[this.L.def.gives] = true; SAVE.write();
        Sound.play('shrine'); this.white = 0.6; burst(this, e.x, e.y - 30, '#bff7ff', 50, 300);
        UI.banner(first ? 'You learned' : 'Shrine', what[0], what[1]);
    },
    finish() {
        this.done = true; Sound.play('gate');
        // the gate takes you: you spin into it as the light closes in, then the results
        const gt = this.L.ents.find(e => e.kind === 'gate'); this.outro = { t: 0, x: gt ? gt.x : this.p.x, y: gt ? gt.y - 10 : this.p.y };
        burst(this, this.outro.x, this.outro.y, '#fff2c4', 40, 260, true);
        const def = this.L.def, rec = SAVE.d.levels[def.id] || { best: null, moths: [false, false, false], sparks: 0, clears: 0 };
        const best = rec.best == null || this.time < rec.best, mothsBefore = rec.moths.filter(Boolean).length;
        rec.moths = rec.moths.map((m, i) => m || !!this.got.moths[i]);
        rec.sparks = Math.max(rec.sparks || 0, this.got.sparks); rec.clears = (rec.clears || 0) + 1; if (best) rec.best = +this.time.toFixed(2);
        rec.deaths = (rec.deaths || 0) + this.stats.deaths; if (!this.stats.hits) rec.flawless = true;
        ST('clears'); if (!this.stats.hits) ST('flawless'); if (def.world === 4) ST('bossKills');
        SAVE.d.levels[def.id] = rec; SAVE.write();
        this.p.vx = 0;
        setTimeout(() => {
            this.state = 'done';
            (def.world === 4 ? UI.ending.bind(UI) : UI.results.bind(UI))({ def, time: this.time, best, sparks: this.got.sparks, sparksOf: this.L.sparks, moths: this.got.moths, hits: this.stats.hits, kills: this.stats.stomps, jumps: this.stats.jumps, mothsNew: rec.moths.filter(Boolean).length - mothsBefore, deaths: this.stats.deaths, rec });
        }, 1500);
    },
    hud() {
        if (!this.p) return;
        const H = this.maxHearts(), hs = [];
        for (let i = 0; i < H; i++) hs.push(`<div class="heart"><svg viewBox="0 0 26 24"><path d="M13 22 C2 14 1 8 4 4.5 C7 1 11 2 13 5.5 C15 2 19 1 22 4.5 C25 8 24 14 13 22Z" fill="${i < this.p.hearts ? '#ff6b8b' : 'rgba(255,255,255,.18)'}" stroke="rgba(0,0,0,.35)" stroke-width="1.5"/></svg></div>`);
        $('#hearts').innerHTML = hs.join('');
        $('#h-sparks').textContent = this.got.sparks; $('#h-sparks-of').textContent = '/' + this.L.sparks;
        $('#h-moths').innerHTML = this.got.moths.slice(0, this.L.moths).map(m => `<span class="${m ? 'moth-on' : 'moth-off'}">★</span>`).join(' ') || '<span class="moth-off">★</span>';
        $('#h-moths').style.display = this.L.moths ? '' : 'none';
        $('#h-level').textContent = this.L.def.id + ' · ' + this.L.def.name;
    },
    toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(this._tt); this._tt = setTimeout(() => el.classList.remove('on'), 2200); }
};
