// ============================================================
// RACE ROUNDS (and the Crown Peak final). Courses run along +z from a start pad at z=0.
// Obstacle motion is a pure function of round time t.
// ============================================================
ROUNDS.spin = {
    build(rnd) {
        startPad();
        floorStrip(0, 4, 40, 14, 0, 0xf3e9ff, 0xd9c8ff);
        spinner(-3.5, 13, 0, 7, 1.6, 0); spinner(3.5, 22, 0, 7, -1.8, 1); spinner(0, 31, 0, 10, 1.3, 2);
        floorStrip(0, 40, 46, 4, 0, 0xffe27a, 0xfff2b3);
        floorStrip(0, 46, 84, 12, 0, 0xf3e9ff, 0xd9c8ff);
        [52, 60, 68, 76].forEach((z, i) => hammer(0, z, 0, i * 1.7, 0.95, 1.6 + i * 0.1));
        [88.6, 97.8, 107].forEach((z, i) => {
            const dir = i % 2 ? -1 : 1, w = 0.6 + i * 0.1;
            cyl(0, -0.4, z, 4, 0.8, { col: [BLU, PNK, YEL][i], mv: (t, c) => { setRot(c, 0, dir * w * t, 0); c.p[0] = 0; c.p[1] = -0.4; c.p[2] = z; } });
            for (let k = 0; k < 2; k++) cyl(0, 0.6, z, 0.45, 1.2, { col: WHT, mv: (t, c) => { const a = dir * w * t + k * PI; c.p[0] = Math.sin(a) * 2.6; c.p[1] = 0.6; c.p[2] = z + Math.cos(a) * 2.6; } });
        });
        floorStrip(0, 111.4, 128, 14, 0, 0xfff2b3, 0xffe27a);
        finishArch(120, 0, 14);
        cp(44, 0); cp(82, 0); cp(113, 0);
        L.center = [0, 60]; L.killY = -10;
        P(3.5, 0, 9, 1.2); P(3.5, 0, 16, 1.2); P(-3.5, 0, 19, 1.2); P(-3.5, 0, 26, 1.2); P(0, 0, 34, 2); P(0, 0, 39, 1); P(0, 0, 45, 1);
        P(0, 0, 49, 3); P(0, 0, 56, 3); P(0, 0, 64, 3); P(0, 0, 72, 3); P(0, 0, 80, 2); P(0, 0, 83.5, 1, true); P(0, 0, 88.6, 1.2); P(0, 0, 92.4, 0.8, true);
        P(0, 0, 97.8, 1.2); P(0, 0, 101.6, 0.8, true); P(0, 0, 107, 1.2); P(0, 0, 110.8, 0.8, true); P(0, 0, 116, 3); P(0, 0, 124, 3);
    }
};
ROUNDS.teeter = {
    build(rnd) {
        startPad();
        const plank = (x, z0, len, w, amp, rate, ph, col) => box(x, -0.3, z0 + len / 2, w, 0.6, len, { col, mv: (t, c) => setPivot(c, x, 0, z0 + len / 2, 0, -0.3, 0, amp * Math.sin(t * rate + ph), 0, 0) });
        const isl = [18, 36, 54, 72];
        [5, 23, 41, 59].forEach((z0, i) => {
            plank(-2.75, z0, 12, 5.4, 0.14, 1.2 + i * 0.1, i * 1.9, i % 2 ? BLU : PNK);
            plank(2.75, z0, 12, 5.4, 0.14, 1.35 + i * 0.1, i * 1.9 + 2.4, i % 2 ? PNK : BLU);
        });
        isl.forEach((z0, i) => { floorStrip(0, z0, z0 + 4, 12, 0, 0xfff2b3, 0xffe27a); pusher(-5, 5, z0 + 2, 0, 1.3 + i * 0.15, i, 2.2, 1.4); });
        plank(0, 77, 16, 10, 0.1, 0.9, 1, MOV);
        floorStrip(0, 94, 110, 14, 0, 0xf3e9ff, 0xd9c8ff);
        finishArch(100, 0, 14);
        cp(19, 0); cp(37, 0); cp(55, 0); cp(73, 0); cp(96, 0);
        L.center = [0, 50]; L.killY = -10;
        P(0, 0, 3.6, 1, true);
        [5, 23, 41, 59].forEach((z0, i) => { P(0, 0, z0 + 5, 4.2); P(0, 0, z0 + 11.4, 4.2, true); P(0, 0, isl[i] + 2, 3); P(0, 0, isl[i] + 3.6, 4, true); });
        P(0, 0, 85, 3); P(0, 0, 92.8, 3, true); P(0, 0, 102, 3);
    }
};
const gooY = t => -2.5 + Math.max(0, t) * 0.15;
ROUNDS.goo = {
    gooOut: true,
    killY: t => gooY(t),
    build(rnd) {
        startPad();
        ramp(0, 4, 16, 0, 3, 10, 0xd9c8ff);
        floorStrip(0, 16, 22, 10, 3, 0xf3e9ff, 0xd9c8ff); spinner(0, 19, 3, 9, 1.7, 0);
        ramp(0, 22, 34, 3, 6, 10, 0xd9c8ff);
        pusher(-4, 4, 26, 3 + 1.0 - 0.1, 1.4, 0, 2.2, 1.4); pusher(4, -4, 30.5, 3 + 2.1 - 0.1, 1.2, 1, 2.2, 1.4);
        floorStrip(0, 34, 40, 10, 6, 0xf3e9ff, 0xd9c8ff);
        [7.2, 8.4, 9.6, 10.8].forEach((h, i) => box(0, (6 + h) / 2 - 0.5, 41.5 + i * 3, 10, h - 6 + 1, 3, { col: i % 2 ? YEL : 0xffe27a }));
        floorStrip(0, 52, 58, 10, 10.8, 0xf3e9ff, 0xd9c8ff);
        ramp(0, 58, 72, 10.8, 14, 10, 0xd9c8ff);
        pusher(-4, 4, 62, 10.8 + 0.9 - 0.1, 1.5, 2, 2.2, 1.4); pusher(4, -4, 67, 10.8 + 2.05 - 0.1, 1.3, 0.5, 2.2, 1.4);
        floorStrip(0, 72, 80, 10, 14, 0xf3e9ff, 0xd9c8ff); spinner(0, 76, 14, 9, -1.6, 1);
        [83, 89].forEach((z, k) => box(0, 13.5, z, 8, 1, 4, { col: MOV, mv: (t, c) => { c.p[0] = 0; c.p[1] = 13.5 + 1.2 * Math.sin(t * 1.1 + k * 2); c.p[2] = z; } }));
        floorStrip(0, 92, 96, 10, 14, 0xfff2b3, 0xffe27a);
        ramp(0, 96, 106, 14, 17, 10, 0xd9c8ff);
        floorStrip(0, 106, 118, 12, 17, 0xfff2b3, 0xffe27a);
        finishArch(112, 17, 12);
        cp(18, 3); cp(37, 6); cp(55, 10.8); cp(76, 14); cp(94, 14);
        L.center = [0, 55]; L.killY = -30;
        P(0, 0, 3, 2); P(0, 1.5, 10, 3); P(0, 3, 17, 3); P(0, 3, 21.5, 3); P(0, 4.5, 28, 3); P(0, 6, 35, 3); P(0, 6, 39.5, 2, true);
        P(0, 7.2, 41.6, 2); P(0, 7.2, 42.5, 2, true); P(0, 8.4, 44.6, 2); P(0, 8.4, 45.5, 2, true); P(0, 9.6, 47.6, 2); P(0, 9.6, 48.5, 2, true); P(0, 10.8, 50.6, 2);
        P(0, 10.8, 57, 3); P(0, 12.4, 65, 3); P(0, 14, 73, 3); P(0, 14, 79.5, 2, true); P(0, 14, 83, 2); P(0, 14, 85.5, 2, true); P(0, 14, 89, 2); P(0, 14, 91.5, 2, true);
        P(0, 14, 94, 3); P(0, 15.5, 101, 3); P(0, 17, 108, 3); P(0, 17, 115, 3);
        // the rising goo (visual)
        const g = new THREE.Mesh(new THREE.BoxGeometry(60, 1, 200), new THREE.MeshLambertMaterial({ color: 0x7dff4a, emissive: 0x1d5a10, transparent: true, opacity: 0.88 }));
        g.position.set(0, -3, 50); L.group.add(g); L.goo = g;
    },
    tick(R, dt) { if (L.goo) L.goo.position.y = gooY(R.t) - 0.5; if (Math.random() < 0.3) puff((Math.random() - 0.5) * 30, gooY(R.t) + 0.1, R.focusZ + (Math.random() - 0.5) * 30, 0xb6ff8f, 1, 0.5, 1, 0.8, 1.2); }
};
ROUNDS.doors = {
    build(rnd, R) {
        startPad();
        const PAL = [PNK, BLU, YEL, MOV, 0x9a5cff, HAZ2];
        const conv = { 18: [0, -3.2], 34: [3.0, 0], 50: [0, -3.6], 66: [-3.0, 0], 82: [0, -4] };
        for (let z = 4; z < 100; z += 4) {
            const cz = conv[z] || conv[z - 4];
            if (cz) box(0, -0.5, z + 2, 20, 1, 4, { col: (z / 4) % 2 ? 0x4b4f6b : 0x5d6283, fx: { conv: cz } });
            else box(0, -0.5, z + 2, 20, 1, 4, { col: (z / 4) % 2 ? 0xf3e9ff : 0xd9c8ff });
        }
        box(-10.5, 0.6, 52, 1, 1.2, 96, { col: PNK }); box(10.5, 0.6, 52, 1, 1.2, 96, { col: PNK });
        R.rows = [];
        [14, 30, 46, 62, 78].forEach((z, ri) => {
            const nf = [2, 2, 3, 3, 4][ri], idx = shuffle([0, 1, 2, 3, 4], rnd), fake = new Set(idx.slice(0, nf));
            const row = { z, slots: [] };
            for (let k = -10; k <= 10; k += 4) box(k, 1.7, z, 0.4, 3.4, 0.6, { col: WHT });
            box(0, 3.8, z, 20.4, 0.8, 0.6, { col: 0x9a5cff });
            for (let s = 0; s < 5; s++) {
                const x = -8 + s * 4, col = PAL[Math.floor(rnd() * PAL.length)];
                const c = box(x, 1.7, z, 3.6, 3.4, 0.45, fake.has(s) ? { col } : { col, solid: false, dyn: true });
                if (!fake.has(s)) { c.dyn = true; }
                row.slots.push({ x, real: !fake.has(s), c, open: 0, known: 0 });
            }
            R.rows.push(row);
        });
        finishArch(94, 0, 18);
        R.rows.forEach(r => cp(r.z + 2, 0)); cp(95, 0);
        L.center = [0, 50]; L.killY = -10;
        P(0, 0, 6, 4); [14, 30, 46, 62, 78].forEach(z => { P(0, 0, z - 1.5, 6); P(0, 0, z + 3, 6); P(0, 0, z + 10, 6); }); P(0, 0, 97, 4);
    },
    tick(R, dt) {
        for (const row of R.rows) for (const s of row.slots) {
            if (s.real && !s.open) for (const c of R.cs) { const v = c.vs; if (c.hide) continue; if (Math.abs(v.z - row.z) < 0.9 && Math.abs(v.x - s.x) < 1.7 && v.y < 3) { s.open = 0.001; s.known = 1; sfx('whoosh', v, 0.6); break; } }
            if (!s.real && !s.known) for (const c of R.cs) { const v = c.vs; if (c.hide) continue; if (v.z < row.z && row.z - v.z < 0.95 && Math.abs(v.x - s.x) < 1.6 && v.y < 3) { s.known = -1; sfx('bonk', v, 0.5); break; } }
            if (s.open > 0 && s.open < 1) { s.open = Math.min(1, s.open + dt * 3); setPivot(s.c, s.x, 0, row.z, 0, 1.7, 0, s.open * 1.45, 0, 0); }
        }
    },
    bot(C, R, ai, inp) {           // pick a door per row: prefer ones seen to be real, avoid known fakes
        const p = C.b.p, row = R.rows.find(r => r.z > p.z - 0.4);
        if (!row || row.z - p.z > 7) return false;
        let s = ai.door && ai.door.row === row ? row.slots[ai.door.s] : null;
        if (s && s.known === -1) s = null;
        if (!s) {
            const knowP = [0.35, 0.7, 0.95][C.skill];
            const real = row.slots.map((x, i) => i).filter(i => row.slots[i].known === 1), unk = row.slots.map((x, i) => i).filter(i => row.slots[i].known === 0);
            const pickFrom = real.length && Math.random() < knowP ? real : unk.length ? unk : [0, 1, 2, 3, 4].filter(i => row.slots[i].known !== -1);
            const i = pickFrom.sort((a, b) => Math.abs(row.slots[a].x - p.x) - Math.abs(row.slots[b].x - p.x) + (Math.random() - 0.5) * 6)[0];
            ai.door = { row, s: i }; s = row.slots[i];
        }
        botSteer(C, inp, s.x, row.z + 2.5, 0.6); return true;
    }
};
const BH = { z0: 6.5, z1: 86.5, h: 17 }, bhY = z => z < BH.z0 ? 0 : z > BH.z1 ? BH.h : (z - BH.z0) / (BH.z1 - BH.z0) * BH.h;
ROUNDS.boulder = {
    build(rnd) {
        startPad();
        const a = Math.atan2(BH.h, BH.z1 - BH.z0);
        ramp(0, BH.z0, BH.z1, 0, BH.h, 22, 0xc9b28f);
        ramp(-11.5, BH.z0, BH.z1, 1.2, BH.h + 1.2, 1, 0xff8a2b, { th: 2.4 }); ramp(11.5, BH.z0, BH.z1, 1.2, BH.h + 1.2, 1, 0xff8a2b, { th: 2.4 });
        [[18, [-6, 0, 6]], [30, [-9, -3, 3, 9]], [42, [-6, 0, 6]], [54, [-9, -3, 3, 9]], [66, [-6, 0, 6]], [76, [-3, 3]]].forEach(([z, xs]) => xs.forEach(x => cyl(x, bhY(z) + 1.0, z, 0.8, 2.4, { col: 0x8a7bf0 })));
        const lanes = [-8.5, -5.5, -2.5, 0.5, 3.5, 6.5, 9];
        lanes.forEach((lx, i) => {
            const per = 9 + (i * 1.37) % 3;
            for (let k = 0; k < 2; k++) sph(lx, 0, 100, 1.5, { col: [0x9b8a7a, 0x7d6e62][k], fx: { knock: 9, always: true }, mv: (t, c) => {
                const s = (((t + i * 2.3 + k * per / 2) / per) % 1 + 1) % 1, z = 100 - s * 96;
                c.p[0] = lx + Math.sin(t * 1.3 + i) * 1.2; c.p[2] = z;
                c.p[1] = z < BH.z0 ? 1.5 - (BH.z0 - z) * 4 : bhY(z) + 1.5;
            } });
        });
        floorStrip(0, BH.z1, 102, 22, BH.h, 0xfff2b3, 0xffe27a);
        finishArch(94, BH.h, 20);
        cp(20, bhY(20)); cp(45, bhY(45)); cp(70, bhY(70)); cp(89, BH.h);
        L.center = [0, 50]; L.killY = -10;
        P(0, 0, 3.6, 1, true); for (let z = 12; z < 100; z += 8) P(0, bhY(z), z, 8);
    },
    bot(C, R, ai, inp) { return false; }
};
ROUNDS.crown = {
    build(rnd, R) {
        startPad();
        ramp(0, 4, 16, 0, 3, 10, 0xd9c8ff);
        floorStrip(0, 16, 24, 12, 3, 0xf3e9ff, 0xd9c8ff); spinner(0, 20, 3, 11, 1.7, 0);
        ramp(0, 24, 36, 3, 6, 8, 0x4b4f6b, { fx: { conv: [0, -2.2] } });
        floorStrip(0, 36, 42, 12, 6, 0xf3e9ff, 0xd9c8ff); hammer(0, 39, 6, 0.6, 0.85, 1.7);
        [45.9, 53.3].forEach((z, i) => { const dir = i ? -1 : 1; cyl(0, 5.6, z, 3.5, 0.8, { col: [BLU, PNK][i], mv: (t, c) => { setRot(c, 0, dir * 0.8 * t, 0); c.p[0] = 0; c.p[1] = 5.6; c.p[2] = z; } }); });
        floorStrip(0, 57.2, 63, 12, 6, 0xf3e9ff, 0xd9c8ff);
        [7, 8, 9, 10].forEach((h, i) => box(0, (6 + h) / 2 - 0.5, 64.5 + i * 3, 10, h - 6 + 1, 3, { col: i % 2 ? YEL : 0xffe27a }));
        floorStrip(0, 75, 81, 12, 10, 0xf3e9ff, 0xd9c8ff); pusher(-4.5, 4.5, 78, 10, 1.6, 0, 2.4, 1.4);
        ramp(0, 81, 93, 10, 13, 10, 0xd9c8ff);
        [-2.5, 2.5].forEach((lx, i) => sph(lx, 0, 93, 1.2, { col: 0x9b8a7a, fx: { knock: 8, always: true }, mv: (t, c) => {
            const s = (((t + i * 3) / 6) % 1 + 1) % 1, z = 93 - s * 13; c.p[0] = lx; c.p[2] = z; c.p[1] = z < 81.5 ? 11.2 - (81.5 - z) * 6 : 10 + (z - 81) / 12 * 3 + 1.2;
        } }));
        floorStrip(0, 93, 103, 12, 13, 0xfff2b3, 0xffe27a);
        cyl(0, 13.3, 99, 1.4, 0.6, { col: 0xffd23f });
        cp(18, 3); cp(38, 6); cp(59, 6); cp(77, 10); cp(95, 13);
        L.center = [0, 50]; L.killY = -10;
        R.crownPos = { x: 0, y: 15.9, z: 99 };
        P(0, 0, 3, 2); P(0, 1.5, 10, 3); P(0, 3, 17, 3); P(0, 3, 23, 3); P(0, 4.5, 30, 2.5); P(0, 6, 37, 3); P(0, 6, 41.8, 1, true); P(0, 6, 45.9, 1.2); P(0, 6, 49.2, 0.8, true);
        P(0, 6, 53.3, 1.2); P(0, 6, 56.6, 0.8, true); P(0, 6, 60, 3); P(0, 6, 62.4, 2, true); P(0, 7, 64.6, 2); P(0, 7, 65.5, 2, true); P(0, 8, 67.6, 2); P(0, 8, 68.5, 2, true);
        P(0, 9, 70.6, 2); P(0, 9, 71.5, 2, true); P(0, 10, 73.6, 2); P(0, 10, 80, 3); P(0, 11.5, 87, 3); P(0, 13, 94, 2); P(0, 13, 97.4, 0.6, true); P(0, 13.6, 99, 0.3, true);
        const cr = new THREE.Mesh(hatGeometry('crown'), new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.7, roughness: 0.25, emissive: 0x553300 }));
        cr.scale.setScalar(2.2); L.group.add(cr); L.crown = cr;
    },
    tick(R, dt) {
        if (!L.crown) return; const cp = R.crownPos; L.crown.visible = !R.crownBy;
        L.crown.position.set(cp.x, cp.y + Math.sin(R.t * 2) * 0.2, cp.z); L.crown.rotation.y = R.t * 1.5;
        if (Math.random() < 0.2) puff(cp.x + (Math.random() - 0.5), cp.y, cp.z + (Math.random() - 0.5), 0xffe066, 1, 0.6, 0.8, 0.8, 0.6);
    }
};
