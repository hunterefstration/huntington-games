// ============================================================
// SURVIVAL, TEAM and the Hex Drop final: arena rounds centred on (0,0).
// ============================================================
const beamAng = t => t < 0 ? t * 0.3 : 0.9 * t + 0.012 * t * t, beamW = t => t < 0 ? 0.3 : 0.9 + 0.024 * t;
const highY = t => t < 25 ? 7 : Math.max(1.75, 7 - (t - 25) * 2.6), highAng = t => -0.7 * t + 1.3;
ROUNDS.beam = {
    build() {
        cyl(0, -0.5, 0, 11, 1, { col: 0x9fe8ff });
        for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; deco(placeGeo(new THREE.BoxGeometry(2.6, 0.3, 0.4), Math.sin(a) * 10.9, -0.05, Math.cos(a) * 10.9, 0, a + PI / 2, 0), i % 2 ? YEL : PNK); }
        cyl(0, 1.3, 0, 1.2, 2.6, { col: 0x8a8fb0 });
        for (let k = 0; k < 2; k++) box(0, 0, 0, 10.8, 0.6, 0.7, { col: HAZ, fx: { knock: 7, always: true }, mv: (t, c) => setPivot(c, 0, 0.5, 0, 6.6, 0, 0, 0, beamAng(t) + k * PI, 0) });
        box(0, 7, 0, 10.8, 0.6, 0.7, { col: HAZ2, fx: { knock: 7, always: true }, mv: (t, c) => setPivot(c, 0, highY(t), 0, 6.6, 0, 0, 0, highAng(t), 0) });
        spawnRing(7, 0); L.killY = -6; L.center = [0, 0];
    },
    bot(C, R, ai, inp) {
        const p = C.b.p, r = Math.hypot(p.x, p.z), phi = Math.atan2(-p.z, p.x), t = R.t, w = beamW(t);
        if (ai.rad == null) ai.rad = 4 + Math.random() * 3;
        let tt = 99; for (let k = 0; k < 2; k++) { let d = ((phi - beamAng(t) - k * PI) % TAU + TAU) % TAU; tt = Math.min(tt, d / w); }
        let th = 99; if (highY(t) < 2.2) { const d = ((highAng(t) - phi) % TAU + TAU) % TAU; th = d / 0.7; }
        const err = [0.16, 0.08, 0.03][C.skill], want = 0.2 + (ai.jerr || 0);
        if (tt < want && tt > want - 0.12 && !(th < 0.9 && th > 0.05)) { inp.jump = true; ai.jerr = (Math.random() - 0.5) * 2 * err; }
        const tx = Math.cos(phi) * ai.rad, tz = -Math.sin(phi) * ai.rad;
        if (Math.abs(r - ai.rad) > 0.6) botSteer(C, inp, tx, tz, 0.3); else { inp.mx = 0; inp.mz = 0; }
        if (r > 9.5) botSteer(C, inp, 0, 0, 0.3);
        return true;
    }
};
// ---------- tile floors (Vanishing Tiles, Hex Drop) ----------
function tileBot(C, R, ai, inp) {
    const p = C.b.p, feet = p.y - PR;
    const bad = c => !c || !c.on || c.ts;
    if (!ai.tile || bad(ai.tile) || ai.tt < 0 || (Math.hypot(ai.tile.p[0] - p.x, ai.tile.p[2] - p.z) < 0.5 && C.b.ground)) {
        const cand = L.tiles.filter(c => !bad(c) && Math.abs(c.p[1] + c.hy - feet) < 1.2);
        let best = null, bs = -1e9;
        for (const c of cand) { const d = Math.hypot(c.p[0] - p.x, c.p[2] - p.z); if (d < 1.5 || d > 7) continue; const s = -Math.abs(d - 3) - Math.hypot(c.p[0], c.p[2]) * 0.15 + Math.random() * 2; if (s > bs) { bs = s; best = c; } }
        ai.tile = best; ai.tt = [2.5, 1.6, 1.1][C.skill] + Math.random();
    }
    ai.tt -= 0.1;
    if (!ai.tile) { inp.mx = inp.mz = 0; return true; }
    botSteer(C, inp, ai.tile.p[0], ai.tile.p[2], 0.2);
    if (C.b.ground) { const fx = p.x + inp.mx * 1.2, fz = p.z + inp.mz * 1.2; if (!groundBelow(fx, p.y, fz, 1.0) && C.skill + Math.random() * 2 > 1) inp.jump = true; }
    return true;
}
ROUNDS.tiles = {
    tileDelay: 0.8,
    build() {
        const cols = [0x9fe8ff, 0xffd6f0, 0xfff2b3];
        [0, -7, -14].forEach((y, li) => { for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) { const c = box(-8.8 + i * 2.2, y - 0.25, -8.8 + j * 2.2, 2.08, 0.5, 2.08, { col: (i + j) % 2 ? cols[li] : 0xffffff, tag: 'tile' }); c.dyn = true; c.base = c.col; L.tiles.push(c); } });
        spawnRing(6, 0); L.killY = -20; L.center = [0, 0];
    },
    tick(R) { tilesTick(R); },
    bot: tileBot
};
ROUNDS.hex = {
    tileDelay: 0.55,
    build() {
        const s = 1.32, cols = [[0xffd23f, 0xffe27a], [0xff8fd8, 0xffb8e6], [0x7fe7ff, 0xb8f2ff]];
        [0, -8, -16].forEach((y, li) => { for (let q = -4; q <= 4; q++) for (let r = -4; r <= 4; r++) { if (Math.abs(q + r) > 4) continue; const c = cyl(s * Math.sqrt(3) * (q + r / 2), y - 0.25, s * 1.5 * r, 1.12, 0.5, { col: cols[li][(q - r + 99) % 2], tag: 'tile' }); c.hex = true; c.dyn = true; L.tiles.push(c); } });
        spawnRing(4.5, 0); L.killY = -24; L.center = [0, 0];
    },
    tick(R) { tilesTick(R); },
    bot: tileBot
};
const sqR = t => t < 0 ? 13 : Math.max(3.2, 13 - t * 0.13);
function sqWind(t) {
    if (t < 3) return { x: 0, z: 0 };
    const s = (2.0 + 1.8 * Math.max(0, Math.sin(t * 0.8))) * Math.min(1, (t - 3) / 15) + t * 0.015, a = t * 0.22 + Math.sin(t * 0.13) * 2;
    return { x: Math.sin(a) * s, z: Math.cos(a) * s };
}
ROUNDS.squeeze = {
    wind: sqWind,
    build() {
        cyl(0, -0.5, 0, 13, 1, { col: 0xffd6f0, mv: (t, c) => { c.r = sqR(t); colBound(c); } });
        cyl(0, -1.6, 0, 13.6, 1, { col: 0x9a5cff, vis: true, solid: false, mv: (t, c) => { c.r = sqR(t) + 0.5; colBound(c); } });
        for (let k = 0; k < 3; k++) cyl(0, 0.7, 0, 0.7, 1.4, { col: HAZ, fx: { knock: 5 }, mv: (t, c) => { const a = -0.5 * t + k * TAU / 3, rr = Math.min(6, sqR(t) - 1.2); c.p[0] = Math.sin(a) * rr; c.p[1] = 0.7; c.p[2] = Math.cos(a) * rr; } });
        spawnRing(8.5, 0); L.killY = -6; L.center = [0, 0];
    },
    tick(R) { const w = sqWind(R.t), s = Math.hypot(w.x, w.z); if (s > 0.5 && Math.random() < s * 0.25) { const a = Math.random() * TAU, r = Math.random() * 14; puff(Math.sin(a) * r, 0.5 + Math.random() * 2, Math.cos(a) * r, 0xffffff, 1, 0, 0, 0.7, 0.5); const pp = PFX.puffP[PFX.puffP.length - 1]; if (pp) { pp.vx = w.x * 2.5; pp.vz = w.z * 2.5; pp.vy = 0; } } },
    bot(C, R, ai, inp) {
        const w = sqWind(R.t), k = [0.15, 0.35, 0.5][C.skill];
        if (!ai.off || Math.random() < 0.01) ai.off = { x: (Math.random() - 0.5) * 3, z: (Math.random() - 0.5) * 3 };
        const lim = Math.max(0.5, sqR(R.t) * 0.35);
        botSteer(C, inp, clamp(ai.off.x, -lim, lim) - w.x * k, clamp(ai.off.z, -lim, lim) - w.z * k, 0.3);
        return true;
    }
};
// ---------- Fruit Memory: the schedule is a pure function of the round seed and time ----------
const FRUITS = ['Apple', 'Banana', 'Grapes', 'Cherry', 'Lemon', 'Melon'];
let fruitAtlas = null;
function drawFruit(g, k, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s / 100, s / 100);
    const circ = (cx, cy, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill(); };
    const leaf = (cx, cy, a) => { g.save(); g.translate(cx, cy); g.rotate(a); g.fillStyle = '#4caf50'; g.beginPath(); g.ellipse(0, 0, 14, 7, 0, 0, TAU); g.fill(); g.restore(); };
    if (k === 0) { circ(-12, 8, 30, '#e8324a'); circ(12, 8, 30, '#e8324a'); g.fillStyle = '#5a3a1a'; g.fillRect(-3, -40, 6, 20); leaf(14, -30, -0.5); circ(-18, -4, 8, '#ff8a9a'); }
    else if (k === 1) { g.strokeStyle = '#ffd23f'; g.lineWidth = 24; g.lineCap = 'round'; g.beginPath(); g.arc(0, -30, 55, 0.5, 2.6); g.stroke(); g.strokeStyle = '#6b4a10'; g.lineWidth = 8; g.beginPath(); g.moveTo(44, -4); g.lineTo(52, 0); g.stroke(); }
    else if (k === 2) { for (const [cx, cy] of [[-18, -18], [0, -20], [18, -18], [-10, 0], [10, 0], [0, 18], [-20, 2], [20, 2]]) circ(cx, cy + 6, 13, '#8e44ad'); leaf(10, -38, 0.4); }
    else if (k === 3) { g.strokeStyle = '#2e7d32'; g.lineWidth = 5; g.beginPath(); g.moveTo(-18, 14); g.quadraticCurveTo(-10, -30, 10, -40); g.moveTo(20, 18); g.quadraticCurveTo(16, -20, 10, -40); g.stroke(); circ(-20, 22, 18, '#c2185b'); circ(22, 26, 18, '#d81b60'); }
    else if (k === 4) { g.fillStyle = '#fff176'; g.beginPath(); g.ellipse(0, 4, 42, 32, 0, 0, TAU); g.fill(); circ(-42, 4, 7, '#fff176'); circ(42, 4, 7, '#fff176'); leaf(-6, -30, -0.3); }
    else if (k === 5) { g.fillStyle = '#43a047'; g.beginPath(); g.arc(0, -6, 46, 0, PI); g.fill(); g.fillStyle = '#ff5252'; g.beginPath(); g.arc(0, -6, 38, 0, PI); g.fill(); g.fillStyle = '#222'; for (const [cx, cy] of [[-18, 6], [0, 14], [18, 6], [-8, 24], [10, 24]]) { g.beginPath(); g.ellipse(cx, cy, 3, 5, 0, 0, TAU); g.fill(); } }
    else { g.fillStyle = '#9a5cff'; g.font = 'bold 110px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 0, 6); }
    g.restore();
}
function getFruitAtlas() {
    if (fruitAtlas) return fruitAtlas;
    const cv = document.createElement('canvas'); cv.width = 128 * 7; cv.height = 128; const g = cv.getContext('2d');
    for (let k = 0; k < 7; k++) { g.fillStyle = '#ffffff'; g.fillRect(k * 128 + 4, 4, 120, 120); drawFruit(g, k, k * 128 + 64, 66, 100); }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    fruitAtlas = { tex, cv }; return fruitAtlas;
}
function fruitIcon(k, size) { const cv = document.createElement('canvas'); cv.width = cv.height = size || 64; drawFruit(cv.getContext('2d'), k, cv.width / 2, cv.height / 2 + 2, cv.width * 0.75); return cv.toDataURL(); }
function fruitCycles(seed) {
    const rnd = mulberry(seed * 7 + 3), out = []; let T = 3;
    for (let k = 0; k < 30; k++) {
        const S = Math.max(2.5, 5 - 0.5 * k), H = 2.0, Cc = Math.max(2.2, 4 - 0.3 * k), D = 2.2, Rr = 1.3;
        const map = shuffle(Array.from({ length: 25 }, (_, i) => i % 6), rnd), call = map[Math.floor(rnd() * 25)];
        out.push({ T, S, H, C: Cc, D, R: Rr, map, call }); T += S + H + Cc + D + Rr;
    }
    return out;
}
function fruitPhase(R, t) {
    for (const c of R.cycles) {
        if (t < c.T) return { ph: 'wait', c };
        let u = t - c.T; if (u < c.S) return { ph: 'show', c, left: c.S - u }; u -= c.S;
        if (u < c.H) return { ph: 'hide', c, left: c.H - u }; u -= c.H;
        if (u < c.C) return { ph: 'call', c, left: c.C - u }; u -= c.C;
        if (u < c.D) return { ph: 'drop', c, left: c.D - u }; u -= c.D;
        if (u < c.R) return { ph: 'back', c, left: c.R - u };
    }
    return { ph: 'wait', c: R.cycles[0] };
}
ROUNDS.fruit = {
    build(rnd, R) {
        R.cycles = fruitCycles(R.seed);
        L.ftiles = [];
        for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { const c = box(-7.4 + i * 3.7, -0.3, -7.4 + j * 3.7, 3.4, 0.6, 3.4, { col: 0xfff2b3 }); c.dyn = true; L.ftiles.push(c); }
        const at = getFruitAtlas(), geo = new THREE.PlaneGeometry(2.8, 2.8).rotateX(-PI / 2);
        geo.setAttribute('iFr', new THREE.InstancedBufferAttribute(new Float32Array(25), 1));
        const mat = new THREE.MeshBasicMaterial({ map: at.tex });
        mat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float iFr;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv.x = (vMapUv.x + iFr) / 7.0;'); };
        const im = new THREE.InstancedMesh(geo, mat, 25); L.group.add(im); L.plates = im;
        spawnRing(5, 0); L.killY = -6; L.center = [0, 0];
    },
    tick(R) {
        const f = fruitPhase(R, R.t), im = L.plates, a = im.geometry.attributes.iFr; R.fph = f;
        L.ftiles.forEach((c, i) => {
            const fr = f.c.map[i], wrong = fr !== f.c.call;
            c.on = !(f.ph === 'drop' && wrong);
            setColColor(c, f.ph === 'call' || f.ph === 'drop' ? (f.ph === 'drop' && !wrong ? 0x7ee23a : 0xffd23f) : 0xfff2b3);
            a.setX(i, f.ph === 'show' || (f.ph === 'drop' && !wrong) || f.ph === 'back' ? fr : 6);
            M1.makeTranslation(c.p[0], c.on ? 0.02 : -50, c.p[2]); im.setMatrixAt(i, M1);
        });
        a.needsUpdate = true; im.instanceMatrix.needsUpdate = true;
        if (f.ph !== R.lastPh) { R.lastPh = f.ph; if (f.ph === 'call') { sfx('tick'); announce('Find the ' + FRUITS[f.c.call] + '!', 'small'); } }
    },
    hud(R) { const f = R.fph; if (!f) return ''; if (f.ph === 'call' || f.ph === 'drop') return '<img src="' + fruitIconCached(f.c.call) + '"><b>' + FRUITS[f.c.call] + '</b>' + (f.ph === 'call' ? ' <i>' + f.left.toFixed(1) + 's</i>' : ''); if (f.ph === 'show') return '<b>Remember the fruit!</b> <i>' + f.left.toFixed(1) + 's</i>'; if (f.ph === 'hide') return '<b>Get ready...</b>'; return ''; },
    bot(C, R, ai, inp) {
        const f = R.fph || fruitPhase(R, R.t), p = C.b.p;
        if (f.ph === 'show' && ai.memK !== f.c.T) { ai.memK = f.c.T; const rec = [0.45, 0.72, 0.93][C.skill]; ai.mem = f.c.map.map(fr => Math.random() < rec ? fr : Math.floor(Math.random() * 6)); ai.tgt = null; }
        if (f.ph === 'call' || f.ph === 'drop') {
            if (!ai.tgt || ai.tgtK !== f.c.T) {
                ai.tgtK = f.c.T; let best = -1, bd = 1e9;
                L.ftiles.forEach((c, i) => { if (ai.mem && ai.mem[i] === f.c.call) { const d = Math.hypot(c.p[0] - p.x, c.p[2] - p.z); if (d < bd) { bd = d; best = i; } } });
                if (best < 0) best = Math.floor(Math.random() * 25);
                ai.tgt = L.ftiles[best];
            }
            botSteer(C, inp, ai.tgt.p[0], ai.tgt.p[2], 0.5);
        } else {
            if (!ai.wan || Math.random() < 0.01) ai.wan = { x: (Math.random() - 0.5) * 8, z: (Math.random() - 0.5) * 8 };
            botSteer(C, inp, ai.wan.x, ai.wan.z, 1);
        }
        return true;
    }
};
const fruitIcons = {}; const fruitIconCached = k => fruitIcons[k] || (fruitIcons[k] = fruitIcon(k, 64));
// ---------- Tail Chase ----------
function arenaFloor(size, cA, cB, wallCol) { const n = size / 4; for (let i = 0; i < n; i++) box(0, -0.5, -size / 2 + 2 + i * 4, size, 1, 4, { col: i % 2 ? cB : cA }); walls(0, 0, size, size, 0, 1.6, wallCol || PNK); }
ROUNDS.tail = {
    build() {
        arenaFloor(36, 0xf3e9ff, 0xd9c8ff);
        box(0, 1, 0, 6, 2, 6, { col: YEL }); ramp(0, 3, 7.2, 2, 0, 6, 0xffe27a); ramp(0, -3, -7.2, 2, 0, 6, 0xffe27a);
        [[-10, -10], [10, -10], [-10, 10], [10, 10]].forEach(([x, z]) => cyl(x, 1.5, z, 1, 3, { col: BLU }));
        bouncePad(-12, 0, 5, 1.3, 14); bouncePad(12, 0, -5, 1.3, 14);
        box(-6, 0.5, 9, 4, 1, 1, { col: PNK }); box(6, 0.5, -9, 4, 1, 1, { col: PNK });
        spawnRing(14, 0); L.killY = -8; L.center = [0, 0];
    },
    onGrab(R, A, B) {
        if (!R.tails.has(B.id) || R.tails.has(A.id) || (R.imm[B.id] || 0) > R.t) return false;
        R.tails.delete(B.id); R.tails.add(A.id); R.imm[A.id] = R.t + 1.5;
        netEvent({ k: 'tail', from: B.id, to: A.id }); onTailEvent(B.id, A.id);
        return true;
    },
    bot(C, R, ai, inp) {
        const p = C.b.p, has = R.tails.has(C.id); let best = null, bd = 1e9;
        for (const o of R.cs) { if (o === C || o.out || o.hide || R.tails.has(o.id) === has) continue; const d = Math.hypot(o.vs.x - p.x, o.vs.z - p.z); if (d < bd) { bd = d; best = o; } }
        if (has) {
            if (best && bd < 9) { let dx = p.x - best.vs.x, dz = p.z - best.vs.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d; dx -= p.x / 30; dz -= p.z / 30; botSteer(C, inp, p.x + dx * 4, p.z + dz * 4, 0); if (bd < 2.5 && Math.random() < 0.08 * (C.skill + 1)) inp.jump = true; }
            else { if (!ai.wan || Math.random() < 0.02) ai.wan = { x: (Math.random() - 0.5) * 24, z: (Math.random() - 0.5) * 24 }; botSteer(C, inp, ai.wan.x, ai.wan.z, 1); }
        } else if (best) {
            const lead = [0.1, 0.3, 0.45][C.skill], ov = best.vv || { x: 0, z: 0 };
            botSteer(C, inp, best.vs.x + ov.x * lead, best.vs.z + ov.z * lead, 0);
            inp.grab = bd < 2.2;
            if (bd > 2.2 && bd < 3.6 && C.skill > 0 && Math.random() < 0.03 * C.skill) inp.dive = true;
        }
        return true;
    }
};
// ---------- Ball Hoard: balls are simulated by the host and streamed in snapshots ----------
const PENS = [[-14, -14], [14, 14], [14, -14], [-14, 14]];
const inPen = (x, z, k) => Math.abs(x - PENS[k][0]) < 5 && Math.abs(z - PENS[k][1]) < 5;
ROUNDS.hoard = {
    teams: true,
    build(rnd, R) {
        arenaFloor(40, 0xf3e9ff, 0xd9c8ff, 0x8a7bf0);
        for (let k = 0; k < R.nTeams; k++) { box(PENS[k][0], 0.03, PENS[k][1], 10, 0.06, 10, { col: TEAM_COLS[k], solid: false }); box(PENS[k][0] * 0.64, 0.4, PENS[k][1], 0.6, 0.8, 4, { col: TEAM_COLS[k] }); }
        box(0, 0.6, 0, 3, 1.2, 3, { col: YEL });
        const n = R.nTeams * 3 + 2; R.balls = [];
        for (let i = 0; i < n; i++) { const a = i / n * TAU, rr = 4 + (i % 3) * 2.2; const b = { x: Math.sin(a) * rr, y: 0.9, z: Math.cos(a) * rr, vx: 0, vy: 0, vz: 0 }; R.balls.push(b); sph(b.x, b.y, b.z, 0.9, { col: [0xffffff, 0xffd23f, 0x52f2c2][i % 3], tag: 'ball', mv: (t, c) => { const s = R.balls[i]; c.p[0] = s.x; c.p[1] = s.y; c.p[2] = s.z; } }); }
        spawnRing(9, 0); L.killY = -8; L.center = [0, 0];
    },
    hostTick(R, dt) {
        const balls = R.balls;
        for (const b of balls) {
            b.vy -= GRAV * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
            for (const c of W.cs) { if (!c.on || !c.solid || c.tag === 'ball') continue; if (sphCol(c, b.x, b.y, b.z, 0.9)) { b.x += HIT.nx * HIT.d; b.y += HIT.ny * HIT.d; b.z += HIT.nz * HIT.d; const vn = b.vx * HIT.nx + b.vy * HIT.ny + b.vz * HIT.nz; if (vn < 0) { const e = HIT.ny > 0.6 ? 0.1 : 0.6; b.vx -= (1 + e) * vn * HIT.nx; b.vy -= (1 + e) * vn * HIT.ny; b.vz -= (1 + e) * vn * HIT.nz; } if (HIT.ny > 0.6) { b.vx *= 1 - 1.6 * dt; b.vz *= 1 - 1.6 * dt; } } }
            for (const C of R.cs) {
                if (C.out || C.hide) continue; const v = C.vs, dx = b.x - v.x, dy = b.y - (v.y + 0.25), dz = b.z - v.z, d = Math.hypot(dx, dy, dz);
                if (d < 1.55 && d > 0.01) { const nx = dx / d, ny = dy / d, nz = dz / d, vv = C.vv || { x: 0, y: 0, z: 0 }; const ap = (vv.x - b.vx) * nx + (vv.z - b.vz) * nz; let k = Math.max(0, ap) * 1.15 + 1.0; if (v.st === ST_DIVE) k += 5; b.vx += nx * k; b.vz += nz * k; b.vy += Math.max(0, ny) * 1; b.x += nx * (1.55 - d) * 0.5; b.z += nz * (1.55 - d) * 0.5; }
            }
            const sp = Math.hypot(b.vx, b.vz); if (sp > 14) { b.vx *= 14 / sp; b.vz *= 14 / sp; }
            if (b.y < -10) { b.x = 0; b.y = 4; b.z = 0; b.vx = b.vy = b.vz = 0; }
        }
        for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) { const a = balls[i], b = balls[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz); if (d < 1.8 && d > 0.001) { const o = (1.8 - d) / 2, nx = dx / d, nz = dz / d; a.x -= nx * o; a.z -= nz * o; b.x += nx * o; b.z += nz * o; const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz; if (rv < 0) { a.vx += nx * rv * 0.5; a.vz += nz * rv * 0.5; b.vx -= nx * rv * 0.5; b.vz -= nz * rv * 0.5; } } }
        R.score = Array.from({ length: R.nTeams }, (_, k) => balls.filter(b => inPen(b.x, b.z, k)).length);
    },
    snap(R) { return R.balls.map(b => [Math.round(b.x * 50), Math.round(b.y * 50), Math.round(b.z * 50)]).concat([R.score || []]); },
    unsnap(R, s) { const sc = s[s.length - 1]; R.score = sc; for (let i = 0; i < R.balls.length && i < s.length - 1; i++) { const b = R.balls[i]; b.tx = s[i][0] / 50; b.ty = s[i][1] / 50; b.tz = s[i][2] / 50; } },
    tick(R, dt) { if (!G.host) for (const b of R.balls) if (b.tx != null) { const k = Math.min(1, dt * 12); b.x += (b.tx - b.x) * k; b.y += (b.ty - b.y) * k; b.z += (b.tz - b.z) * k; } },
    bot(C, R, ai, inp) {
        const p = C.b.p, k = C.team, pen = PENS[k];
        if (!ai.ball || Math.random() < 0.01 || inPen(ai.ball.x, ai.ball.z, k)) {
            let best = null, bs = 1e9; for (const b of R.balls) { if (inPen(b.x, b.z, k)) continue; const s = Math.hypot(b.x - p.x, b.z - p.z) + Math.random() * 6; if (s < bs) { bs = s; best = b; } }
            ai.ball = best;
        }
        const b = ai.ball; if (!b) { botSteer(C, inp, pen[0] * 0.5, pen[1] * 0.5, 1); return true; }
        let dx = pen[0] - b.x, dz = pen[1] - b.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
        const bx = b.x - dx * 1.7, bz = b.z - dz * 1.7, dBehind = Math.hypot(bx - p.x, bz - p.z);
        if (dBehind > 1.2) { const side = (p.x - b.x) * dx + (p.z - b.z) * dz; if (side > -0.5 && Math.hypot(p.x - b.x, p.z - b.z) < 2.4) { botSteer(C, inp, bx + dz * 2 * Math.sign(dz * (p.x - b.x) - dx * (p.z - b.z) || 1), bz - dx * 2, 0.2); } else botSteer(C, inp, bx, bz, 0.2); }
        else { botSteer(C, inp, b.x + dx * 2, b.z + dz * 2, 0); if (C.skill > 0 && Math.random() < 0.01 * C.skill) inp.dive = true; }
        return true;
    }
};
// ---------- Hoop Hop: the host places hoops and scores passes ----------
const HOOP_SPOTS = (() => {
    const s = [];
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; s.push({ x: Math.sin(a) * 11, y: 1.7, z: Math.cos(a) * 11, yaw: a + PI / 2 }); }
    for (const [x, z] of [[-11, -11], [11, 11], [11, -11], [-11, 11]]) s.push({ x, y: 2.5 + 1.8, z, yaw: Math.atan2(x, z), plat: [x, z] });
    for (const [x, z] of [[0, -5.5], [0, 5.5], [-5.5, 0], [5.5, 0]]) s.push({ x, y: 2.3, z, yaw: Math.atan2(x, z) + PI / 2 });
    s.push({ x: 0, y: 6.2, z: 0, yaw: 0, high: true });
    return s;
})();
ROUNDS.hoops = {
    teams: true,
    build(rnd, R) {
        arenaFloor(36, 0xf3e9ff, 0xd9c8ff, 0x3fb8ff);
        for (const [x, z] of [[-11, -11], [11, 11], [11, -11], [-11, 11]]) { box(x, 1.25, z, 6, 2.5, 6, { col: YEL }); ramp(x, z > 0 ? 3 : -3, z > 0 ? z - 3 : z + 3, 0, 2.5, 3.5, 0xffe27a); }
        bouncePad(0, 0, 0, 1.6, 17);
        R.hoopMeshes = [];
        for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.16, 8, 32), new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0x8a5a00 })); L.group.add(m); R.hoopMeshes.push(m); }
        spawnRing(7, 0); L.killY = -8; L.center = [0, 0];
    },
    setup(R, rnd) { R.hoops = shuffle(HOOP_SPOTS.map((s, i) => i), rnd).slice(0, 5); R.score = Array(R.nTeams).fill(0); },
    tick(R, dt) {
        (R.hoops || []).forEach((si, i) => { const s = HOOP_SPOTS[si], m = R.hoopMeshes[i]; m.position.set(s.x, s.y + Math.sin(R.t * 2 + i) * 0.1, s.z); m.rotation.y = s.yaw; m.material.color.setHex(s.high ? 0xff5fa2 : 0xffd23f); });
    },
    hostTick(R, dt) {
        for (const C of R.cs) {
            if (C.out || C.hide) continue; const v = C.vs, pv = C.hp || { x: v.x, y: v.y, z: v.z }; C.hp = { x: v.x, y: v.y, z: v.z };
            for (let i = 0; i < R.hoops.length; i++) {
                const s = HOOP_SPOTS[R.hoops[i]], nx = Math.sin(s.yaw), nz = Math.cos(s.yaw);
                const s0 = (pv.x - s.x) * nx + (pv.z - s.z) * nz, s1 = (v.x - s.x) * nx + (v.z - s.z) * nz;
                if (s0 * s1 >= 0 || Math.abs(s0 - s1) > 3) continue;
                const f = s0 / (s0 - s1), ix = pv.x + (v.x - pv.x) * f, iy = pv.y + (v.y - pv.y) * f + 0.27, iz = pv.z + (v.z - pv.z) * f;
                if (Math.hypot(ix - s.x, iy - s.y, iz - s.z) < 1.3) {
                    R.score[C.team] += s.high ? 3 : 1;
                    const used = new Set(R.hoops), free = HOOP_SPOTS.map((x, j) => j).filter(j => !used.has(j));
                    R.hoops[i] = free[Math.floor(Math.random() * free.length)];
                    netEvent({ k: 'hoops', h: R.hoops, sc: R.score, by: C.id }); onHoopEvent(C.id, R.score);
                    break;
                }
            }
        }
    },
    bot(C, R, ai, inp) {
        const p = C.b.p;
        if (ai.hoop == null || !R.hoops.includes(ai.hoop) || Math.random() < 0.004) {
            let best = null, bs = 1e9; for (const si of R.hoops) { const s = HOOP_SPOTS[si]; const d = Math.hypot(s.x - p.x, s.z - p.z) + (s.high ? 8 - C.skill * 3 : 0) + (s.plat ? 4 : 0) + Math.random() * 5; if (d < bs) { bs = d; best = si; } }
            ai.hoop = best; ai.side = 0;
        }
        const s = HOOP_SPOTS[ai.hoop]; if (!s) return true;
        const nx = Math.sin(s.yaw), nz = Math.cos(s.yaw), side = (p.x - s.x) * nx + (p.z - s.z) * nz;
        if (!ai.side) ai.side = side >= 0 ? 1 : -1;
        if (s.plat && p.y < 2.2) { const [x, z] = s.plat, rz = z > 0 ? z - 4.8 : z + 4.8; botSteer(C, inp, x, Math.abs(p.z - rz) < 1.2 ? z : rz, 0.4); return true; }
        if (s.high) { botSteer(C, inp, 0, 0, 0.3); return true; }
        const ax = s.x + nx * 2.5 * ai.side, az = s.z + nz * 2.5 * ai.side;
        if (Math.sign(side) === ai.side && Math.abs(side) > 1.2 && Math.hypot(ax - p.x, az - p.z) > 1.0 && !ai.going) botSteer(C, inp, ax, az, 0.3);
        else { ai.going = true; botSteer(C, inp, s.x - nx * 3 * ai.side, s.z - nz * 3 * ai.side, 0); if (Math.abs(side) < 2.0 && C.b.ground && s.y > 1.2) inp.jump = true; if (Math.sign(side) === -ai.side && Math.abs(side) > 2) { ai.going = false; ai.side = -ai.side; } }
        return true;
    }
};
