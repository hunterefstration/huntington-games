// ============================================================
// 1.1 RACES: Log Jam and Gust Gauntlet. Courses run along +z from a start pad at z=0, like the others.
// Everything that moves is a pure function of round time, so every machine agrees on it.
// ============================================================
const LOG = 0xa8703f, LOG2 = 0x8a5a33;
// a log lying across the course (axis along x) spinning so its top moves toward the start: a treadmill
function rollerLog(z, y, r, len, w, col) {
    const c = cyl(0, y, z, r, len, { col, rz: PI / 2, mv: (t, c) => { setRot(c, -w * t, 0, PI / 2); c.p[0] = 0; c.p[1] = y; c.p[2] = z; } });
    c.oct = true; return c;
}
// a log lying along the course (axis z) spinning so its top moves sideways (dir +1 = toward +x)
function bridgeLog(x, z0, z1, r, w, dir, col) {
    const zc = (z0 + z1) / 2, y = -r;
    const c = cyl(x, y, zc, r, z1 - z0, { col, rz: PI / 2, ry: PI / 2, mv: (t, c) => { setRot(c, dir * w * t, PI / 2, PI / 2); c.p[0] = x; c.p[1] = y; c.p[2] = zc; } });
    c.oct = true; return c;
}
const LJ = { lane0: 31.8, lane1: 62, per: 30.1 / 4.2, logR: 0.55 };      // three logs, one every ~2.4 s at 4.2 m/s
ROUNDS.logs = {
    build(rnd) {
        startPad();
        floorStrip(0, 4, 12, 14, 0, 0xfff2b3, 0xffe27a);
        spinner(0, 8, 0, 12.5, 1.5, 0.4, HAZ2);
        // A: the treadmill - six rolling logs that carry you backwards
        for (let i = 0; i < 6; i++) rollerLog(13.05 + i * 2.05, -1.0, 1.0, 13, 2.6, i % 2 ? LOG : LOG2);
        box(-7.1, 0.0, 18.2, 0.8, 2.4, 12.6, { col: 0x6b4a2b }); box(7.1, 0.0, 18.2, 0.8, 2.4, 12.6, { col: 0x6b4a2b });
        floorStrip(0, 24.3, 30.2, 14, 0, 0xfff2b3, 0xffe27a);
        // B: the log chute - logs roll down the lane at you; jump them (gap to jump first)
        floorStrip(0, LJ.lane0, LJ.lane1, 14, 0, 0xe9d8b8, 0xd8c29a);
        box(-7.4, 0.6, (LJ.lane0 + LJ.lane1) / 2, 0.8, 1.2, LJ.lane1 - LJ.lane0, { col: PNK }); box(7.4, 0.6, (LJ.lane0 + LJ.lane1) / 2, 0.8, 1.2, LJ.lane1 - LJ.lane0, { col: PNK });
        box(0, 3.4, 59.5, 15.6, 1.6, 3.2, { col: 0x6b4a2b }); box(-7.4, 1.6, 59.5, 0.8, 3.2, 3.2, { col: 0x6b4a2b }); box(7.4, 1.6, 59.5, 0.8, 3.2, 3.2, { col: 0x6b4a2b });
        for (let k = 0; k < 3; k++) {
            const c = cyl(0, -20, 60, LJ.logR, 12.4, { col: k % 2 ? LOG : LOG2, rz: PI / 2, fx: { knock: 6, always: true }, mv: (t, c) => {
                const s = ((((Math.max(0, t) + k * LJ.per / 3) / LJ.per) % 1) + 1) % 1, z = 60.5 - s * (60.5 - LJ.lane0 + 1.2);
                let y = LJ.logR; if (z > 57) y += (z - 57) * 0.9; if (z < LJ.lane0 + 0.2) y -= (LJ.lane0 + 0.2 - z) * 5;
                setRot(c, (60.5 - z) / LJ.logR, 0, PI / 2); c.p[0] = 0; c.p[1] = y; c.p[2] = z;
            } });
            c.oct = true; c.low = true;
        }
        floorStrip(0, LJ.lane1, 66, 14, 0, 0xfff2b3, 0xffe27a);
        // C: two spinning log bridges over the water, each throws you outward
        bridgeLog(-2.6, 66, 84, 0.95, 2.1, -1, LOG); bridgeLog(2.6, 66, 84, 0.95, 2.1, 1, LOG2);
        floorStrip(0, 84, 88, 14, 0, 0xfff2b3, 0xffe27a);
        // D: the lumber yard - swinging logs and pushers, then the finish
        floorStrip(0, 88, 114, 14, 0, 0xe9d8b8, 0xd8c29a);
        hammer(0, 94, 0, 0.4, 0.95, 1.55); pusher(-5, 5, 98.5, 0, 1.5, 1.2, 2.4, 1.4); hammer(0, 103, 0, 2.2, 0.95, 1.7);
        finishArch(109, 0, 14);
        cp(28, 0); cp(33.5, 0); cp(64, 0); cp(86, 0); cp(98.5, 0);
        L.center = [0, 58]; L.killY = -8;
        P(0, 0, 8, 3); P(0, 0, 12, 3); P(0, 0, 16, 3); P(0, 0, 20, 3); P(0, 0, 24, 3); P(0, 0, 27.5, 3); P(0, 0, 29.6, 2, true);
        for (let z = 35; z <= 59; z += 4) P(0, 0, z, 3);
        P(0, 0, 63, 3); P(0, 0, 65.4, 1);
        P(0, 0, 86, 3); P(0, 0, 91, 3); P(0, 0, 96, 3); P(0, 0, 101, 3); P(0, 0, 106, 3); P(0, 0, 112, 3);
        // water under the bridges (visual)
        const wm = new THREE.Mesh(new THREE.BoxGeometry(16, 0.4, 20), new THREE.MeshLambertMaterial({ color: 0x3fb8ff, emissive: 0x0b3a66, transparent: true, opacity: 0.85 }));
        wm.position.set(0, -2.6, 75); L.group.add(wm);
    },
    bot(C, R, ai, inp) {            // on the bridge logs: pick a log, run along its top, lean against the spin
        const p = C.b.p;
        if (p.z < 62.5 || p.z > 84.2 || p.y < -1.5) { ai.log = null; return false; }
        if (ai.log == null) ai.log = Math.abs(p.x) > 0.8 ? Math.sign(p.x) * 2.6 : C.id % 2 ? 2.6 : -2.6;
        if (p.z < 66.1 && Math.abs(p.x - ai.log) > 0.35) { botSteer(C, inp, ai.log, Math.min(p.z + 0.4, 65.6), 0); return true; }   // line up on the island first
        const lean = [0.05, 0.18, 0.28][C.skill] * Math.sign(ai.log);
        botSteer(C, inp, ai.log - lean, p.z + 3, 0); return true;
    }
};
// ---------- Gust Gauntlet: windmills, then bridges in the path of giant fans ----------
const gustPulse = (t, ph) => t < 0 ? 0 : Math.pow(Math.max(0, Math.sin(t * 1.15 + ph)), 0.6);
function gustAt(t, p) {
    if (p.y < 3 && p.z > 34 && p.z < 50) return { x: 5.2 * gustPulse(t, 0), z: 0 };
    if (p.y < 3 && p.z > 54 && p.z < 72) return { x: -5.2 * gustPulse(t, 2.2), z: 0 };
    if (p.y > 3 && p.z > 89 && p.z < 106) return { x: 0, z: -2.6 * gustPulse(t * 0.8, 1) };
    return { x: 0, z: 0 };
}
function windmill(z, y, w, ph) {
    const py = y + 7.3;
    box(-5.6, y + 3.9, z + 0.9, 0.8, 7.8, 0.8, { col: WHT }); box(5.6, y + 3.9, z + 0.9, 0.8, 7.8, 0.8, { col: WHT });
    box(0, y + 7.95, z + 0.9, 12, 0.5, 0.6, { col: WHT, solid: false });
    deco(placeGeo(new THREE.CylinderGeometry(0.7, 0.7, 0.8, 16), 0, py, z + 0.4, PI / 2, 0, 0), YEL);
    for (let k = 0; k < 2; k++) box(0, py, z, 14.6, 0.7, 0.7, { col: k ? HAZ : HAZ2, fx: { knock: 8 }, mv: (t, c) => { setRot(c, 0, 0, ph + w * t + k * PI / 2); c.p[0] = 0; c.p[1] = py; c.p[2] = z; } });
    box(-6.1, y + 1.1, z, 3.8, 2.2, 6, { col: BLU }); box(6.1, y + 1.1, z, 3.8, 2.2, 6, { col: BLU });      // walls: the only way through is under the arms
}
function bigFan(x, z, dir) {                 // a fan housing on a stand with spinning blades (looks only)
    deco(placeGeo(new THREE.CylinderGeometry(3.2, 3.2, 1.2, 24, 1, true), x, 2.4, z, 0, 0, PI / 2), 0x8a8fb0);
    deco(placeGeo(new THREE.BoxGeometry(1.2, 2.6, 1.2), x - dir * 0.4, -1, z), 0x6b6f8f);
    for (let k = 0; k < 2; k++) box(x + dir * 0.2, 2.4, z, 0.25, 5.6, 0.9, { col: WHT, solid: false, mv: (t, c) => { setRot(c, t * 7 + k * PI / 2, 0, 0); c.p[0] = x + dir * 0.2; c.p[1] = 2.4; c.p[2] = z; } });
}
ROUNDS.gust = {
    windAt: gustAt,
    build(rnd) {
        startPad();
        floorStrip(0, 4, 30, 16, 0, 0xe3f1ff, 0xc9e3ff);
        windmill(12, 0, 0.85, 0); windmill(22, 0, -0.95, 0.6);
        floorStrip(0, 30, 34, 14, 0, 0xfff2b3, 0xffe27a);
        floorStrip(0, 34, 50, 3.2, 0, 0xe3f1ff, 0xc9e3ff);
        [37, 42, 47].forEach(z => bigFan(-9, z, 1));
        floorStrip(0, 50, 54, 14, 0, 0xfff2b3, 0xffe27a);
        floorStrip(-2.4, 54, 63, 3.2, 0, 0xe3f1ff, 0xc9e3ff); box(0, -0.5, 63, 8, 1, 2, { col: 0xc9e3ff }); floorStrip(2.4, 63, 72, 3.2, 0, 0xe3f1ff, 0xc9e3ff);
        [57, 63, 69].forEach(z => bigFan(10, z, -1));
        floorStrip(0, 72, 76, 14, 0, 0xfff2b3, 0xffe27a);
        ramp(0, 76, 88, 0, 4, 10, 0x4b4f6b, { fx: { conv: [0, -2.0] } });
        for (const s of [-1, 1]) ramp(s * 5.3, 76, 88, 1, 5, 0.6, PNK, { th: 2 });
        floorStrip(0, 88, 112, 14, 4, 0xe3f1ff, 0xc9e3ff);
        spinner(0, 94, 4, 12.5, 1.6, 0.3, HAZ2); windmill(101, 4, 0.9, 1.1);
        finishArch(107, 4, 14);
        cp(32, 0); cp(52, 0); cp(74, 0); cp(90, 4);
        L.center = [0, 56]; L.killY = -8;
        P(0, 0, 8, 3); P(0, 0, 10.5, 2.5); P(0, 0, 15, 2.5); P(0, 0, 20.5, 2.5); P(0, 0, 25, 2.5); P(0, 0, 31, 3);
        P(0, 0, 35, 0.2); P(0, 0, 40, 0.2); P(0, 0, 45, 0.2); P(0, 0, 49.6, 0.2); P(0, 0, 52.5, 1.5);
        P(-2.4, 0, 55, 0.2); P(-2.4, 0, 59, 0.2); P(-2.4, 0, 62.4, 0.2); P(2.4, 0, 63.6, 0.2); P(2.4, 0, 67, 0.2); P(2.4, 0, 71.6, 0.2); P(0, 0, 74, 2);
        P(0, 1.3, 80, 2.5); P(0, 4, 89, 3); P(0, 4, 92, 3); P(0, 4, 97, 2.5); P(0, 4, 103, 2.5); P(0, 4, 110, 3);
    },
    tick(R, dt) {                    // wind you can see: streaks fly with each gust
        for (const [z0, z1, y, xs] of [[34, 50, 0, -8], [54, 72, 0, 9]]) {
            const w = gustAt(R.t, { x: 0, y, z: (z0 + z1) / 2 }), s = Math.abs(w.x);
            if (s > 0.6 && Math.random() < s * 0.18) { puff(xs, 0.6 + Math.random() * 3, z0 + Math.random() * (z1 - z0), 0xffffff, 1, 0, 0, 1.1, 0.6); const pp = PFX.puffP[PFX.puffP.length - 1]; if (pp) { pp.vx = w.x * 3; pp.vy = 0; pp.vz = 0; } }
        }
        const h = gustAt(R.t, { x: 0, y: 5, z: 95 }); if (Math.abs(h.z) > 0.6 && Math.random() < 0.3) { puff((Math.random() - 0.5) * 12, 4.6 + Math.random() * 2, 106, 0xffffff, 1, 0, 0, 1.4, 0.6); const pp = PFX.puffP[PFX.puffP.length - 1]; if (pp) { pp.vx = 0; pp.vy = 0; pp.vz = h.z * 4; } }
    },
    botAfter(C, R, ai, inp) {        // lean into the wind (hard bots fully, easy bots barely)
        const w = gustAt(R.t, C.b.p); if (!w.x && !w.z) return;
        const k = [0.5, 0.85, 1.05][C.skill] / (RUN * BOT_SPEED[C.skill]);
        inp.mx -= w.x * k; inp.mz -= w.z * k;
    }
};
