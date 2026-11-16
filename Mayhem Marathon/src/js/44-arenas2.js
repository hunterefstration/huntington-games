// ============================================================
// 1.1 ARENA ROUNDS: Meteor Mayhem and Lava Pillars (survival), Turf War (team), Bomb Tag (hunt) and the
// Summit Showdown final. Meteors and sinking pillars follow a plan made from the round seed, so every
// machine knows when and where they land without any network traffic.
// ============================================================
const hyp = (x, z) => Math.sqrt(x * x + z * z);
// ---------- Meteor Mayhem ----------
const MET = { warn: 2.0, fall: 1.4, pool: 6, keep: 14 };
function meteorPlan(seed, tiles) {
    const rnd = mulberry(seed * 13 + 5), alive = new Set(tiles.map((t, i) => i)), out = [];
    let T = 3.5, n = 0;
    while (T < 100) {
        const big = n % MET.pool === MET.pool - 1, arr = [...alive];
        let i = arr[Math.floor(rnd() * arr.length)];
        if (rnd() < 0.45) { const j = arr[Math.floor(rnd() * arr.length)]; if (hyp(tiles[j].x, tiles[j].z) < hyp(tiles[i].x, tiles[i].z)) i = j; }
        const t0 = tiles[i], kill = [];
        if (alive.size > MET.keep) {          // the last few tiles are never holed: someone can always survive
            kill.push(i);
            const nb = arr.filter(j => j !== i && hyp(tiles[j].x - t0.x, tiles[j].z - t0.z) < 2.5);
            if (big) kill.push(...nb.slice(0, Math.min(nb.length, alive.size - MET.keep - 1)));
            else if (nb.length && rnd() < 0.45) kill.push(nb[Math.floor(rnd() * nb.length)]);
            kill.forEach(j => alive.delete(j));
        }
        out.push({ T, x: t0.x, z: t0.z, big, kill, k: n % MET.pool, dx: (rnd() - 0.5) * 6, dz: (rnd() - 0.5) * 6 });
        n++; T += Math.max(0.6, 2.3 - T * 0.026) * (0.75 + rnd() * 0.5);
    }
    return out;
}
ROUNDS.meteor = {
    build(rnd, R) {
        const s = 1.32, cols = [0x8a7f9e, 0x9d93b0]; L.mtiles = [];
        for (let q = -6; q <= 6; q++) for (let r = -6; r <= 6; r++) {
            if (Math.abs(q + r) > 6) continue;
            const x = s * Math.sqrt(3) * (q + r / 2), z = s * 1.5 * r, c = cyl(x, -0.3, z, 1.12, 0.6, { col: cols[(q - r + 99) % 2] });
            c.hex = true; c.dyn = true; L.mtiles.push(c);
        }
        R.met = meteorPlan(R.seed, L.mtiles.map(c => ({ x: c.p[0], z: c.p[2] }))); R.mi = 0;
        const slots = Array.from({ length: MET.pool }, () => []); R.met.forEach(m => slots[m.k].push(m));
        slots.forEach((list, k) => {
            const r = k === MET.pool - 1 ? 1.7 : 1.15;
            const c = sph(0, -80, 0, r, { col: k === MET.pool - 1 ? 0x7a3b22 : 0x6b4a3a, fx: { knock: 11, always: true }, mv: (t, c) => {
                let i = c.mi || 0; while (i < list.length - 1 && t > list[i].T + 0.8) i++; while (i > 0 && t < list[i - 1].T + 0.8) i--; c.mi = i;
                const m = list[i];
                if (!m || t < m.T - MET.fall || t > m.T + 0.8) { c.p[0] = 0; c.p[1] = -80; c.p[2] = 0; return; }
                const u = Math.max(0, m.T - t) / MET.fall;
                c.p[0] = m.x + m.dx * u; c.p[2] = m.z + m.dz * u; c.p[1] = t < m.T ? r + 34 * u * u : r - (t - m.T) * (m.kill.length ? 9 : 1.5);
            } });
            c.slot = k;
        });
        const rg = new THREE.RingGeometry(0.72, 1, 28).rotateX(-PI / 2);
        L.rings = new THREE.InstancedMesh(rg, new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.85, depthWrite: false }), 12);
        L.rings.count = 0; L.rings.frustumCulled = false; L.group.add(L.rings);
        spawnRing(6.5, 0); L.killY = -6; L.center = [0, 0];
    },
    tick(R, dt) {
        // impacts: holes, a shockwave that throws you (each machine moves its own Tumbler), boom
        while (R.mi < R.met.length && R.met[R.mi].T <= R.t) {
            const m = R.met[R.mi++], fresh = R.t - m.T < 0.35;
            for (const j of m.kill) { const c = L.mtiles[j]; if (c.on) { c.on = false; c.shake = 0; } }
            if (!fresh || R.phase === 'over') continue;
            const rad = m.big ? 4.2 : 3.0;
            sfx('boom', { x: m.x, y: 0, z: m.z }, m.big ? 1 : 0.7); puff(m.x, 0.5, m.z, 0xffa040, m.big ? 16 : 10, 6, 3, 0.7, 1.6); puff(m.x, 0.3, m.z, 0x6b5a50, 8, 5, 2, 0.9, 1.2);
            for (const C of R.cs) {
                if (C.hide || C.done) continue; const v = C.vs, d = hyp(v.x - m.x, v.z - m.z);
                if (isMe(C) && d < 9) shake(m.big ? 0.6 : 0.35);
                if (!C.sim || !C.b || d > rad || v.y > 3) continue;
                const k = 3 + 8 * (1 - d / rad), nx = d > 0.05 ? (v.x - m.x) / d : 1, nz = d > 0.05 ? (v.z - m.z) / d : 0;
                knock(C.b, nx * k, 5 + 3 * (1 - d / rad), nz * k, 0.9);
            }
        }
        // warning rings under the meteors that are coming
        const rings = L.rings; let n = 0;
        for (let i = R.mi; i < R.met.length && n < 12; i++) {
            const m = R.met[i], left = m.T - R.t; if (left > MET.warn) break;
            const s = (m.big ? 2.3 : 1.5) * (1 + 0.08 * Math.sin(R.t * 18));
            M1.makeScale(s, 1, s); M1.setPosition(m.x, 0.04, m.z); rings.setMatrixAt(n++, M1);
            if (left < MET.fall && Math.random() < 0.6) { const u = left / MET.fall; puff(m.x + m.dx * u, (m.big ? 1.7 : 1.15) + 34 * u * u + 1, m.z + m.dz * u, Math.random() < 0.5 ? 0xff7a1f : 0xffd23f, 1, 0.6, 0.5, 0.45, 1.2); }
            if (left < MET.fall && left + dt >= MET.fall) sfx('meteor', { x: m.x, y: 0, z: m.z }, 0.6);
        }
        rings.count = n; rings.instanceMatrix.needsUpdate = true;
    },
    bot(C, R, ai, inp) {
        const b = C.b, p = b.p, look = [1.0, 1.6, 2.2][C.skill], danger = [];
        for (let i = R.mi; i < R.met.length && R.met[i].T < R.t + look; i++) danger.push(R.met[i]);
        const risk = (x, z) => { let s = 0; for (const m of danger) { const d = hyp(x - m.x, z - m.z), rad = m.big ? 4.4 : 3.2; if (d < rad) s += (rad - d) * 4 + (m.kill.length && d < 2.6 ? 20 : 0); } return s; };
        ai.mt = (ai.mt || 0) - 1 / 60;
        if (ai.mt <= 0 || !ai.tile || !ai.tile.on) {
            ai.mt = [0.45, 0.3, 0.2][C.skill];
            const here = risk(p.x, p.z);
            if (!(ai.tile && ai.tile.on && here < 1 && risk(ai.tile.p[0], ai.tile.p[2]) < 1 && Math.random() < 0.85)) {
                let best = null, bs = -1e9;
                for (const c of L.mtiles) {
                    if (!c.on) continue; const d = hyp(c.p[0] - p.x, c.p[2] - p.z); if (d > 8) continue;
                    let crowd = 0; for (const o of R.cs) if (o !== C && !o.hide && hyp(o.vs.x - c.p[0], o.vs.z - c.p[2]) < 1.5) crowd++;
                    const s = -d * 0.45 - hyp(c.p[0], c.p[2]) * 0.3 - crowd * 1.2 - risk(c.p[0], c.p[2]) + Math.random() * [3, 1.5, 0.6][C.skill];
                    if (s > bs) { bs = s; best = c; }
                }
                ai.tile = best;
            }
        }
        if (!ai.tile) { botSteer(C, inp, 0, 0, 0.5); return true; }
        const d = botSteer(C, inp, ai.tile.p[0], ai.tile.p[2], 0.35);
        if (b.ground && d > 0.9) { const h = Math.hypot(inp.mx, inp.mz) || 1, fx = p.x + inp.mx / h * 1.1, fz = p.z + inp.mz / h * 1.1; if (!solidAt(fx, p.y - 0.8, fz, 0.3) && Math.random() < [0.6, 0.9, 1][C.skill]) inp.jump = true; }
        return true;
    }
};
// ---------- Lava Pillars ----------
function pillarPlan(seed, pills, spawnSet) {
    const rnd = mulberry(seed * 31 + 7), left = pills.map((c, i) => i).filter(i => !pills[i].center), out = [];
    let T = 5, w = 0;
    while (left.length > 3 && T < 95) {
        const n = Math.min(left.length - 3, 2 + Math.floor(w / 4), 4), cs = [];
        for (let k = 0; k < n; k++) {
            // outer pillars tend to go first; never a spawn pillar in the first waves
            let bi = -1, bs = -1e9;
            for (let t = 0; t < 4; t++) { const j = Math.floor(rnd() * left.length), c = pills[left[j]]; if (T < 9 && spawnSet.has(left[j])) continue; const s = hyp(c.p[0], c.p[2]) + rnd() * 5; if (s > bs) { bs = s; bi = j; } }
            if (bi < 0) continue; cs.push(left[bi]); left.splice(bi, 1);
        }
        out.push({ T, cs }); w++; T += Math.max(1.6, 3.1 - T * 0.022) + rnd() * 0.6;
    }
    return out;
}
ROUNDS.pillars = {
    build(rnd, R) {
        const sp = 3.0, rr = 1.12, H = [0, 0.6, 1.2]; L.pills = [];
        for (let q = -4; q <= 4; q++) for (let r = -4; r <= 4; r++) {
            if (Math.abs(q + r) > 4) continue;
            const x = sp * (q + r / 2), z = sp * 0.866 * r, ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
            const h = ring === 0 ? 1.2 : H[Math.floor(rnd() * 3)], bob = ring >= 1 && ring <= 2 && rnd() < 0.25, ph = rnd() * TAU;
            const col = [0x8a6f9e, 0x9f84b3, 0xb39ac6][H.indexOf(h)];
            const o = { col, tag: 'tile' }; if (bob) o.mv = (t, c) => { c.p[0] = x; c.p[1] = (h - 3.6) / 2 + 0.45 * Math.sin(Math.max(0, t) * 1.7 + ph); c.p[2] = z; };
            const c = cyl(x, (h - 3.6) / 2, z, rr, h + 3.6, o); c.hex = true; c.dyn = true; c.top = h; c.ring = ring; c.center = ring === 0;     // pillar feet hide in the lava
            L.tiles.push(c); L.pills.push(c);
        }
        const ring3 = L.pills.map((c, i) => i).filter(i => L.pills[i].ring === 3 && !L.pills[i].mv);
        const pick = ring3.filter((i, k) => k % Math.max(1, Math.round(ring3.length / 16)) === 0).slice(0, 16);
        for (const i of L.pills.map((c, i) => i).filter(i => L.pills[i].ring === 2 && !L.pills[i].mv)) if (pick.length < 16) pick.push(i);
        for (const i of pick) { const c = L.pills[i]; L.spawns.push([c.p[0], c.top + PR + 0.05, c.p[2]]); }
        R.plan = pillarPlan(R.seed, L.pills, new Set(pick)); R.pi = 0;
        const lava = new THREE.Mesh(new THREE.BoxGeometry(70, 1, 70), new THREE.MeshLambertMaterial({ color: 0xff5a1f, emissive: 0xc02a00 }));
        lava.position.set(0, -2.7, 0); L.group.add(lava); L.lava = lava;
        L.killY = -2.4; L.center = [0, 0];
    },
    tick(R, dt) {
        for (; R.pi < R.plan.length && R.plan[R.pi].T - 2.2 <= R.t; R.pi++) {
            const w = R.plan[R.pi];
            for (const i of w.cs) { const c = L.pills[i]; if (!c.ts) { c.ts = 1; c.dropAt = w.T; c.shake = 1; setColColor(c, 0xff4f6d); } }
        }
        tilesTick(R);
        if (Math.random() < 0.35) puff((Math.random() - 0.5) * 30, -2.1, (Math.random() - 0.5) * 30, Math.random() < 0.5 ? 0xff8a2b : 0xffd23f, 1, 0.4, 1.5, 0.8, 1.3);
    },
    bot(C, R, ai, inp) {
        tileBot(C, R, ai, inp);
        const b = C.b, p = b.p, t = ai.tile;
        if (t && b.ground) { const top = t.p[1] + t.hy, d = hyp(t.p[0] - p.x, t.p[2] - p.z); if (top > p.y - PR + 0.25 && d < t.r + 1.3 && d > 0.5) inp.jump = true; }
        return true;
    }
};
// ---------- Turf War: the host paints, guests see the floor in snapshots ----------
const TURF = { n: 12, s: 3, h: 18 };
const turfIdx = (x, z) => { const i = Math.floor((x + TURF.h) / TURF.s), j = Math.floor((z + TURF.h) / TURF.s); return i < 0 || j < 0 || i >= TURF.n || j >= TURF.n ? -1 : i * TURF.n + j; };
const turfPos = k => [-TURF.h + TURF.s / 2 + Math.floor(k / TURF.n) * TURF.s, -TURF.h + TURF.s / 2 + (k % TURF.n) * TURF.s];
ROUNDS.turf = {
    teams: true,
    build(rnd, R) {
        R.paint = new Uint8Array(TURF.n * TURF.n); L.ttiles = [];
        for (let k = 0; k < R.paint.length; k++) { const [x, z] = turfPos(k), c = box(x, -0.5, z, 2.94, 1, 2.94, { col: (Math.floor(k / TURF.n) + k) % 2 ? 0xf3e9ff : 0xe2d6ff }); c.dyn = true; c.base = c.col; L.ttiles.push(c); }
        walls(0, 0, 36, 36, 0, 1.6, 0x8a7bf0);
        cyl(0, 0.9, 0, 0.6, 1.8, { col: 0x8a8fb0 });
        R.sweep = box(0, 0.6, 0, 15, 0.5, 0.55, { col: HAZ, fx: { knock: 7 }, mv: (t, c) => { setRot(c, 0, Math.max(0, t) * 0.9, 0); c.p[0] = 0; c.p[1] = 0.6; c.p[2] = 0; } });
        [[9.5, 0, 1, 5], [-9.5, 0, 1, 5], [0, 9.5, 5, 1], [0, -9.5, 5, 1]].forEach(([x, z, w, d]) => box(x, 0.5, z, w, 1, d, { col: YEL }));
        [[13.5, 13.5], [-13.5, 13.5], [13.5, -13.5], [-13.5, -13.5]].forEach(([x, z]) => bouncePad(x, 0, z, 1.3, 14));
        for (let i = 0; i < 16; i++) { const a = (i + 0.5) / 16 * TAU; L.spawns.push([Math.sin(a) * 13, PR + 0.05, Math.cos(a) * 13]); }
        L.killY = -8; L.center = [0, 0]; R.score = Array(R.nTeams).fill(0);
    },
    hostTick(R) {
        let ch = false;
        for (const C of R.cs) {
            if (C.hide || C.done || C.team == null) continue; const v = C.vs; if (!v.ground || v.y > 1.2) continue;
            const k = turfIdx(v.x, v.z); if (k >= 0 && R.paint[k] !== C.team + 1) { R.paint[k] = C.team + 1; ch = true; }
        }
        if (ch) { const sc = Array(R.nTeams).fill(0); for (const t of R.paint) if (t) sc[t - 1]++; R.score = sc; }
    },
    snap(R) { R.sn = (R.sn || 0) + 1; return R.sn % 3 ? null : [Array.from(R.paint).join(''), R.score]; },
    unsnap(R, s) { if (!s || typeof s[0] !== 'string') return; for (let k = 0; k < R.paint.length; k++) R.paint[k] = +s[0][k] || 0; if (Array.isArray(s[1])) R.score = s[1]; },
    syncOut(R) { return { paint: Array.from(R.paint).join('') }; },
    syncIn(R, x) { if (x && typeof x.paint === 'string') for (let k = 0; k < R.paint.length; k++) R.paint[k] = +x.paint[k] || 0; },
    tick(R) {
        for (let k = 0; k < L.ttiles.length; k++) { const c = L.ttiles[k], t = R.paint[k]; if (c.pt !== t) { c.pt = t; setColColor(c, t ? TEAM_COLS[t - 1] : c.base); if (t && R.phase === 'play' && Math.random() < 0.5) puff(c.p[0], 0.1, c.p[2], TEAM_COLS[t - 1], 2, 2, 0.6, 0.4, 0.9); } }
    },
    bot(C, R, ai, inp) {
        const b = C.b, p = b.p, mine = C.team + 1;
        if (ai.tt == null || R.paint[ai.tt] === mine || Math.random() < 0.006) {
            let best = -1, bs = -1e9;
            for (let k = 0; k < R.paint.length; k++) {
                if (R.paint[k] === mine) continue; const [x, z] = turfPos(k), d = hyp(x - p.x, z - p.z); if (d > 15) continue;
                let mates = 0; for (const o of R.cs) if (o !== C && o.team === C.team && !o.hide && hyp(o.vs.x - x, o.vs.z - z) < 4) mates++;
                const s = -d + (R.paint[k] ? 2 : 0) - mates * 2.5 + Math.random() * [6, 3, 1.5][C.skill];
                if (s > bs) { bs = s; best = k; }
            }
            ai.tt = best < 0 ? null : best;
        }
        if (ai.tt == null) { botSteer(C, inp, 0, 0, 2); return true; }
        const [tx, tz] = turfPos(ai.tt); botSteer(C, inp, tx, tz, 0.2);
        if (b.ground && Math.random() < BOT_AWARE[C.skill] * 0.5) for (const tau of [0.15, 0.3]) { if (sphCol(predictCol(R.sweep, R.t + tau), p.x + inp.mx * tau * 7, p.y + 0.27, p.z + inp.mz * tau * 7, 0.7)) { inp.jump = true; break; } }
        if (C.skill > 0 && b.ground && Math.random() < 0.012 * C.skill) for (const o of R.cs) { if (o.team === C.team || o.hide || o.done) continue; const dx = o.vs.x - p.x, dz = o.vs.z - p.z, d = hyp(dx, dz); if (d < 2.6 && d > 0.8) { botSteer(C, inp, o.vs.x, o.vs.z, 0); inp.dive = true; break; } }
        return true;
    }
};
// ---------- Bomb Tag: hand the bombs on by grabbing; holders when the fuse runs out are out ----------
function onBombPass(R, from, to) {
    const B = byId(to), A = byId(from); if (!B) return;
    sfx('pass', B.vs, 0.9); puff(B.vs.x, B.vs.y + 1.6, B.vs.z, 0xffd23f, 8, 3, 1, 0.5);
    if (isMe(B)) { announce('YOU GOT A BOMB! Pass it on!', 'bad'); shake(0.3); }
    if (A && isMe(A)) { announce('PASSED IT!', 'good'); if (G.show && G.show.tut) G.show.tutN.pass++; else save.stats.bombsPassed = (save.stats.bombsPassed || 0) + 1; }
}
ROUNDS.bomb = {
    passOnly: true,
    goal: (R, S, n) => R.bombs.size + (R.bombs.size > 1 ? ' bombs' : ' bomb') + ' - ' + (n - R.bombs.size) + ' of ' + n + ' go through. Do not hold one at the end!' + (R.bombs.has(G.me) ? ' YOU START WITH ONE!' : ''),
    status(R, me) { const left = Math.max(0, R.info.time - Math.max(0, R.t)); return 'Bombs: ' + R.bombs.size + ' · fuse ' + Math.ceil(left) + 's' + (me && R.bombs.has(me.id) ? ' · <b style="color:#ff4f6d">YOU HAVE A BOMB - grab someone (F)!</b>' : me && me.inRound && !me.hide ? ' · run from the bombs!' : ''); },
    startEx(S, alive, msg, rnd) { const n = alive.length, k = S.pts ? Math.max(1, Math.floor(n / 3)) : clamp(n - msg.q, 1, n - 1); return { bombs: shuffle(alive.map(c => c.id), rnd).slice(0, k) }; },
    build(rnd, R) {
        R.bombs = new Set(R.ex.bombs || []);
        const n = 8; for (let i = 0; i < n; i++) box(0, -0.5, -16 + 2 + i * 4, 32, 1, 4, { col: i % 2 ? 0x3b3350 : 0x463d5e });
        walls(0, 0, 32, 32, 0, 1.6, HAZ2);
        box(0, 0.75, 0, 8, 1.5, 8, { col: 0xff8a2b }); ramp(0, 4, 8, 1.5, 0, 3, 0xffb36b); ramp(0, -4, -8, 1.5, 0, 3, 0xffb36b);
        [[-9, -9], [9, -9], [-9, 9], [9, 9]].forEach(([x, z]) => cyl(x, 1.5, z, 1, 3, { col: 0x8a7bf0 }));
        [[-12.5, 0], [12.5, 0]].forEach(([x, z]) => bouncePad(x, 0, z, 1.3, 15));
        box(-6, 0.6, 7, 5, 1.2, 1, { col: YEL }); box(6, 0.6, -7, 5, 1.2, 1, { col: YEL });
        for (let i = 0; i < 16; i++) { const a = (i + 0.5) / 16 * TAU; L.spawns.push([Math.sin(a) * 12.5, PR + 0.05, Math.cos(a) * 12.5]); }
        L.killY = -8; L.center = [0, 0];
    },
    speedOf: (R, C) => R.bombs.has(C.id) ? 1.12 : 1,
    shouldEnd: () => false,
    onGrab(R, A, B) {
        if (!R.bombs.has(A.id) || R.bombs.has(B.id) || (R.imm[B.id] || 0) > R.t) return false;
        R.bombs.delete(A.id); R.bombs.add(B.id); R.imm[A.id] = R.t + 1.5;
        netEvent({ k: 'bomb', from: A.id, to: B.id }); onBombPass(R, A.id, B.id);
        return true;
    },
    onEvent(R, e) { if (e.k === 'bomb' && !G.host) { R.bombs.delete(e.from); R.bombs.add(e.to); onBombPass(R, e.from, e.to); } },
    syncOut: R => ({ bombs: [...R.bombs] }),
    syncIn(R, x) { if (x && Array.isArray(x.bombs)) R.bombs = new Set(x.bombs); },
    endOrder(R, all) { const safe = all.filter(id => !R.bombs.has(id)), boom = all.filter(id => R.bombs.has(id)); return { order: safe.concat(boom), qual: safe }; },
    endEx: R => ({ bombs: [...R.bombs] }),
    onEnd(R, msg) {
        if (msg.ex && Array.isArray(msg.ex.bombs)) R.bombs = new Set(msg.ex.bombs);
        for (const id of R.bombs) {
            const C = byId(id); if (!C || C.hide) continue; const v = C.vs;
            puff(v.x, v.y + 1, v.z, 0xff8a2b, 14, 7, 3, 0.8, 1.8); puff(v.x, v.y + 1, v.z, 0x3b3350, 10, 5, 2, 1.0, 1.4);
            if (C.sim && C.b) knock(C.b, (Math.random() - 0.5) * 8, 11, (Math.random() - 0.5) * 8, 2);
            if (isMe(C)) shake(0.8);
        }
        if (R.bombs.size) sfx('boom');
        R.bombs = new Set();
    },
    tick(R) {
        if (R.phase !== 'play') return; const left = R.info.time - R.t, s = Math.ceil(left);
        if (s !== R.lastFuse) { R.lastFuse = s; if (s <= 5 && s >= 1) sfx('tick'); }
        for (const id of R.bombs) { const C = byId(id); if (C && !C.hide && Math.random() < 0.25) { const v = C.vs; puff(v.x + 0.1, v.y + 2.45, v.z, Math.random() < 0.5 ? 0xffd23f : 0xff8a2b, 1, 0.8, 0.6, 0.3, 0.6); } }
        if (Math.random() < 0.05 && R.bombs.size) sfx('fuse', null, 0.4);
    },
    bot(C, R, ai, inp) {
        const p = C.b.p, has = R.bombs.has(C.id); let best = null, bd = 1e9;
        for (const o of R.cs) {
            if (o === C || o.hide || o.done || R.bombs.has(o.id) === has) continue;
            if (has && (R.imm[o.id] || 0) > R.t) continue;
            const d = hyp(o.vs.x - p.x, o.vs.z - p.z); if (d < bd) { bd = d; best = o; }
        }
        if (has) {
            if (!best) { botSteer(C, inp, 0, 0, 2); return true; }
            const lead = [0.1, 0.3, 0.45][C.skill], ov = best.vv || { x: 0, z: 0 };
            botSteer(C, inp, best.vs.x + ov.x * lead, best.vs.z + ov.z * lead, 0);
            inp.grab = bd < 2.0;
        } else if (best && bd < 10) {
            let dx = p.x - best.vs.x, dz = p.z - best.vs.z; const d = hyp(dx, dz) || 1; dx /= d; dz /= d; dx -= p.x / 22; dz -= p.z / 22;
            botSteer(C, inp, p.x + dx * 4, p.z + dz * 4, 0);
            if (bd < 2.4 && C.b.ground && Math.random() < 0.06 * (C.skill + 1)) inp.jump = true;
        } else { if (!ai.wan || Math.random() < 0.02) ai.wan = { x: (Math.random() - 0.5) * 22, z: (Math.random() - 0.5) * 22 }; botSteer(C, inp, ai.wan.x, ai.wan.z, 1); }
        return true;
    }
};
// ---------- Summit Showdown: fill your meter standing on the summit; the host keeps the meters ----------
const HILL = { target: 12, tiers: [[10, 1.2], [6.5, 2.4], [3.4, 3.6]] };
const hillAng = t => t < 0 ? 0 : 0.85 * t + 0.006 * t * t;
ROUNDS.hill = {
    crownText: ' TAKES THE SUMMIT!',
    goal: () => 'First to ' + HILL.target + ' seconds on the summit wins the crown! (Sharing the top fills it at half speed.)',
    status(R, me) { const m = me && me.inRound ? Math.min(100, (R.hold[me.id] || 0) / HILL.target * 100) : null; return 'Hold the summit!' + (m != null ? ' · your meter ' + m.toFixed(0) + '%' : ''); },
    build(rnd, R) {
        R.hold = {};
        cyl(0, -0.5, 0, 17, 1, { col: 0xc9e8c0 });
        for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; deco(placeGeo(new THREE.BoxGeometry(3.2, 0.3, 0.5), Math.sin(a) * 15.5, -0.05, Math.cos(a) * 15.5, 0, a + PI / 2, 0), i % 2 ? YEL : PNK); }
        cyl(0, 0.6, 0, 10, 1.2, { col: 0x9fd88f }); cyl(0, 1.2, 0, 6.5, 2.4, { col: 0x7cc46b }); cyl(0, 1.8, 0, 3.4, 3.6, { col: 0xffd23f });
        ramp(0, 13, 9.8, 0, 1.2, 3, 0xd9c8ff); ramp(0, -13, -9.8, 0, 1.2, 3, 0xd9c8ff);
        ramp(5, 8, 4.4, 1.2, 2.4, 2.6, 0xd9c8ff); ramp(-5, -8, -4.4, 1.2, 2.4, 2.6, 0xd9c8ff);
        ramp(0, 6.3, 3.2, 2.4, 3.6, 2.2, 0xffe27a); ramp(0, -6.3, -3.2, 2.4, 3.6, 2.2, 0xffe27a);
        cyl(0, 4.0, 0, 0.35, 0.8, { col: 0x8a8fb0 });
        R.sweep = box(0, 4.2, 0, 6.6, 0.5, 0.55, { col: HAZ, fx: { knock: 7, always: true }, mv: (t, c) => { setRot(c, 0, hillAng(t), 0); c.p[0] = 0; c.p[1] = 4.2; c.p[2] = 0; } });
        for (let k = 0; k < 2; k++) cyl(0, 3.1, 0, 0.7, 1.4, { col: HAZ2, fx: { knock: 6 }, mv: (t, c) => { const a = Math.max(0, t) * 0.55 + k * PI; c.p[0] = Math.sin(a) * 5.0; c.p[1] = 3.1; c.p[2] = Math.cos(a) * 5.0; } });
        for (let k = 0; k < 3; k++) cyl(0, 1.9, 0, 0.7, 1.4, { col: HAZ2, fx: { knock: 6 }, mv: (t, c) => { const a = -Math.max(0, t) * 0.4 + k * TAU / 3; c.p[0] = Math.sin(a) * 8.3; c.p[1] = 1.9; c.p[2] = Math.cos(a) * 8.3; } });
        bouncePad(12.5, 0, 0, 1.3, 16); bouncePad(-12.5, 0, 0, 1.3, 16);
        for (let i = 0; i < 16; i++) { const a = (i + 0.5) / 16 * TAU; L.spawns.push([Math.sin(a) * 14.5, PR + 0.05, Math.cos(a) * 14.5]); }
        L.killY = -8; L.center = [0, 0];
        const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 6), new THREE.MeshLambertMaterial({ color: 0xffffff })); fl.position.set(0, 5.1, 0); L.group.add(fl);
        const fg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), new THREE.MeshLambertMaterial({ color: 0xff5fa2, side: THREE.DoubleSide })); fg.position.set(0.62, 6.2, 0); L.group.add(fg); L.flag = fg;
    },
    shouldEnd: R => R.crownBy != null,
    hostTick(R, dt) {
        const on = R.cs.filter(C => !C.hide && !C.done && C.vs.y - PR > 3.3 && hyp(C.vs.x, C.vs.z) < 3.45 && C.vs.st !== ST_TUMBLE);
        const rate = on.length > 1 ? 0.5 : 1;
        for (const C of on) {
            const h = R.hold[C.id] = (R.hold[C.id] || 0) + dt * rate;
            if (h >= HILL.target && R.crownBy == null) hostCrown(C);
        }
    },
    snap(R) { R.sn = (R.sn || 0) + 1; if (R.sn % 2) return null; return Object.keys(R.hold).map(id => [+id, Math.round(R.hold[id] * 10)]); },
    unsnap(R, s) { if (!Array.isArray(s)) return; for (const e of s) if (Array.isArray(e)) R.hold[e[0]] = e[1] / 10; },
    syncOut: R => ({ hold: R.hold }),
    syncIn(R, x) { if (x && x.hold && typeof x.hold === 'object') R.hold = Object.assign({}, x.hold); },
    endOrder(R, all, live) {
        const h = id => R.hold[id] || 0, prog = id => { const C = byId(id); return C ? C.vs.y : 0; };
        const order = all.slice().sort((a, b) => (b === R.crownBy) - (a === R.crownBy) || h(b) - h(a) || prog(b) - prog(a));
        return { order, qual: [order[0]] };
    },
    tick(R) {
        if (L.flag) { L.flag.rotation.y = Math.sin(R.t * 3) * 0.3; const lead = Object.keys(R.hold).sort((a, b) => R.hold[b] - R.hold[a])[0], C = lead && byId(+lead); if (C) L.flag.material.color.setHex(ITEM[C.look.col].hex); }
    },
    hud(R) {
        const top = Object.keys(R.hold).map(id => [byId(+id), R.hold[id]]).filter(e => e[0]).sort((a, b) => b[1] - a[1]).slice(0, 3);
        const me = byId(G.me), mine = me ? R.hold[me.id] || 0 : 0;
        let h = '<b>Summit meter</b>';
        for (const [C, v] of top) h += ' <span class="mtr' + (isMe(C) ? ' me' : '') + '">' + esc(C.name) + ' <i style="width:' + Math.min(100, v / HILL.target * 100).toFixed(0) + '%"></i></span>';
        if (me && me.inRound && !top.some(e => e[0] === me)) h += ' <span class="mtr me">You <i style="width:' + Math.min(100, mine / HILL.target * 100).toFixed(0) + '%"></i></span>';
        return h;
    },
    bot(C, R, ai, inp) {
        const b = C.b, p = b.p, feet = p.y - PR, r = hyp(p.x, p.z), T = HILL.tiers;
        let lvl = 0; while (lvl < 3 && feet > T[lvl][1] - 0.35 && r < T[lvl][0] + 0.2) lvl++;
        if (!ai.spot || Math.random() < 0.01) { const a = Math.random() * TAU, rr = Math.random() * 1.6; ai.spot = { x: Math.sin(a) * rr, z: Math.cos(a) * rr }; }
        if (lvl < 3) {
            // head for the middle; jump each tier edge
            botSteer(C, inp, ai.spot.x, ai.spot.z, 0);
            const R2 = T[lvl][0]; if (b.ground && r < R2 + 1.1 && r > R2 - 0.4 && feet < T[lvl][1] - 0.2) inp.jump = true;
            if (b.ground && r > 15.5) botSteer(C, inp, 0, 0, 0);
        } else {
            botSteer(C, inp, ai.spot.x, ai.spot.z, 0.4);
            if (C.skill > 0 && b.ground) for (const o of R.cs) {        // shove rivals off the summit
                if (o === C || o.hide || o.done || o.vs.y < 3.6) continue; const dx = o.vs.x - p.x, dz = o.vs.z - p.z, d = hyp(dx, dz);
                if (d < 2.4 && d > 0.6 && Math.random() < 0.015 * C.skill) { botSteer(C, inp, o.vs.x, o.vs.z, 0); inp.dive = true; break; }
                if (d < 1.4 && Math.random() < 0.3) inp.grab = true;
            }
        }
        if (b.ground && feet > 3.2 && Math.random() < [0.4, 0.8, 0.97][C.skill]) for (const tau of [0.12, 0.25, 0.4]) { if (sphCol(predictCol(R.sweep, R.t + tau), p.x + inp.mx * tau * 6, p.y + 0.27, p.z + inp.mz * tau * 6, 0.62)) { inp.jump = true; break; } }
        return true;
    }
};
