// ---------- EDGES + CORNERS ----------
// Each map gets a planned border instead of random clutter: a row of themed set pieces lined up along every wall,
// facing into the arena at a steady rhythm, plus a bigger landmark in each corner. A piece is skipped if something
// is already standing there. Uses the seeded Math.random, so every multiplayer player gets the exact same border.
function edgeDecor(mapId) {
    const A = ARENA;
    // wall-local coordinates: side 0 = the -z wall, 1 = +x, 2 = +z, 3 = -x. u runs along the wall, v is the distance in from it.
    const W = (s, u, v) => s === 0 ? [u, -A + v] : s === 1 ? [A - v, u] : s === 2 ? [u, A - v] : [-A + v, u];
    const wb = (s, u, v, y, len, h, dep, key, solid = true) => { const [x, z] = W(s, u, v); if (s % 2 === 0) addBlock(x, y, z, len, h, dep, key, solid); else addBlock(x, y, z, dep, h, len, key, solid); };
    const free = (s, u, v, len, dep) => {
        const [x, z] = W(s, u, v), hw = (s % 2 === 0 ? len : dep) / 2, hd = (s % 2 === 0 ? dep : len) / 2;
        for (const b of solids) {
            if (b.max.x - b.min.x > A || b.max.z - b.min.z > A || b.min.y > 7) continue;
            if (b.max.x > x - hw && b.min.x < x + hw && b.max.z > z - hd && b.min.z < z + hd) return false;
        }
        for (const [bx, bz, bw, bd] of bridgeRects) if (x + hw > bx && x - hw < bx + bw && z + hd > bz && z - hd < bz + bd) return false;
        return Math.hypot(x - spawnPt[0], z - spawnPt[1]) > 18 && !(cageArea && Math.abs(x - cageArea.x) < cageArea.half + hw + 2 && Math.abs(z - cageArea.z) < cageArea.half + hd + 2);
    };
    // walk every wall at a fixed spacing; fn(side, u, index)
    const along = (sp, margin, fn) => { for (let s = 0; s < 4; s++) { let i = 0; for (let u = -A + margin; u <= A - margin + 0.01; u += sp) fn(s, u, i++); } };
    const corners = (fn) => { for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) fn(sx, sz); };
    const cfree = (x, z, r) => { for (const b of solids) { if (b.max.x - b.min.x > A || b.max.z - b.min.z > A || b.min.y > 7) continue; if (b.max.x > x - r && b.min.x < x + r && b.max.z > z - r && b.min.z < z + r) return false; } return !(cageArea && Math.hypot(x - cageArea.x, z - cageArea.z) < r + cageArea.half + 2); };
    const accents = ['accR', 'accB', 'accG', 'accY'];

    if (mapId === 'blockyard') {
        // loading bays built against the walls: back wall + side walls + roof you can climb onto via the crates
        along(24, 26, (s, u, i) => {
            if (!free(s, u, 5, 14, 11)) return;
            const acc = accents[i % 4];
            wb(s, u, 0.6, 0, 12.6, 6, 1.2, 'concreteDark'); wb(s, u, 1.25, 0.3, 6, 4.2, 0.1, 'steel', false); wb(s, u, 1.3, 4.7, 6.4, 0.3, 0.1, 'glowY', false);
            wb(s, u - 6, 4.4, 0, 0.8, 6, 7.6, 'concrete'); wb(s, u + 6, 4.4, 0, 0.8, 6, 7.6, 'concrete');
            wb(s, u, 4.6, 6, 13.4, 0.4, 8.6, acc);
            wb(s, u + 3.6, 7, 0, 2, 2, 2, 'wood'); wb(s, u + 3.6, 7, 2, 2, 2, 2, 'woodDark'); wb(s, u + 3.6, 9, 0, 2, 2, 2, 'woodDark');
            wb(s, u - 2.5, 9.4, 0, 2.4, 0.3, 2.4, 'wood'); wb(s, u - 2.5, 9.4, 0.3, 2, 1.6, 2, 'woodDark');
        });
        // fenced storage yards in the corners
        corners((sx, sz) => {
            const cx = sx * (A - 9), cz = sz * (A - 9);
            if (!cfree(cx, cz, 8)) return;
            for (let t = -7; t <= 7; t += 1.75) {
                if (Math.abs(t) > 1.8) { addBlock(cx + t, 0, cz - sz * 7, 0.15, 2.6, 0.15, 'post'); addBlock(cx - sx * 7, 0, cz + t, 0.15, 2.6, 0.15, 'post'); }
            }
            addBlock(cx - 4.5, 0, cz - sz * 7, 5.4, 2.4, 0.08, 'steel'); addBlock(cx + 4.5, 0, cz - sz * 7, 5.4, 2.4, 0.08, 'steel');
            addBlock(cx - sx * 7, 0, cz - 4.5, 0.08, 2.4, 5.4, 'steel'); addBlock(cx - sx * 7, 0, cz + 4.5, 0.08, 2.4, 5.4, 'steel');
            container(cx + sx * 2, cz + sz * 3.5, 0, true, 'accR'); container(cx + sx * 2, cz + sz * 3.5, 1, true, 'accB');
            addStructure('crates', cx - sx * 2.5, cz - sz * 1.5, 0);
        });
    } else if (mapId === 'downtown') {
        // a row of shops built along every wall, a sidewalk in front and cars parked at the curb
        along(11, 26, (s, u, i) => {
            if (!free(s, u, 4.5, 10.6, 8)) return;
            const [x, z] = W(s, u, 3.6), h = [4.2, 7, 4.2, 10, 5.6][i % 5];
            const key = ['brick', 'stone', 'concrete', 'brickDark', 'concreteDark'][(i * 3 + s) % 5];
            if (s % 2 === 0) building(x, z, 10, 6.4, h, key); else building(x, z, 6.4, 10, h, key);
            wb(s, u, 7.4, 3, 8.6, 0.2, 1.8, accents[(i + s) % 4], false);                       // awning
            wb(s, u, 9.6, 0, 11, 0.18, 3.4, 'concrete');                                           // sidewalk
            if (i % 2 === 0 && free(s, u + 2, 13, 5, 3)) { const [cx, cz] = W(s, u + 2, 13); car(cx, cz, s % 2 === 0); }
            if (i % 3 === 1) { const [lx, lz] = W(s, u + 5.5, 11); addLamp(lx, lz); }
        });
        corners((sx, sz) => {
            const cx = sx * (A - 10), cz = sz * (A - 10);
            if (!cfree(cx, cz, 9)) return;
            building(cx, cz, 16, 16, 13, 'concreteDark');
            fireEscape(cx, cz, 16, 16, 13.4, sz < 0 ? 2 : 0);
        });
    } else if (mapId === 'fortress') {
        // siege camp outside the walls: a wooden palisade along each wall with tents and campfires in front of it
        along(3, 6, (s, u) => { if (Math.abs(((u + A) % 24) - 12) > 2.4 && free(s, u, 2, 1, 1)) wb(s, u, 2, 0, 1, 3.4 + (Math.round(u) % 2 ? 0.5 : 0), 1, 'woodDark'); });
        along(16, 22, (s, u, i) => {
            if (!free(s, u, 9, 7, 6)) return;
            wb(s, u, 9, 0, 6, 2.6, 4.2, 'sand'); wb(s, u, 9, 2.6, 6.4, 0.5, 2.6, 'woodDark'); wb(s, u, 9, 3.1, 6.6, 0.4, 1.2, 'wood');
            wb(s, u + 3.4, 12, 0, 1.4, 1, 1.4, 'wood');
            if (i % 2 === 0 && free(s, u + 8, 13, 3, 3)) { wb(s, u + 8, 13, 0, 2.4, 0.3, 2.4, 'stone'); wb(s, u + 8, 13, 0.3, 1.2, 0.2, 1.2, 'glowY', false); }
        });
        // siege towers in the corners, with a catapult beside each
        corners((sx, sz) => {
            const cx = sx * (A - 10), cz = sz * (A - 10);
            if (!cfree(cx, cz, 7)) return;
            stairTower(cx, cz, 9, 5, 'wood', sx < 0 ? (sz < 0 ? 1 : 0) : (sz < 0 ? 2 : 3), 'woodDark');
            const kx = cx - sx * 8, kz = cz - sz * 2;
            if (cfree(kx, kz, 3)) { addBlock(kx, 0, kz, 4, 1, 3, 'woodDark'); addBlock(kx, 1, kz, 0.6, 2.6, 0.6, 'wood'); addBlock(kx, 3.4, kz, 5, 0.4, 0.5, 'wood'); addBlock(kx - 2.2, 3.1, kz, 1, 0.8, 1, 'stone'); }
        });
    } else if (mapId === 'plains') {
        // an orchard row of trees along every wall, a fence line in front with gates, and hay stacks
        along(9, 22, (s, u) => { if (free(s, u, 5, 4, 4)) { const [x, z] = W(s, u, 5); tree(x, z, 0.85 + ((u * 7) % 3) * 0.08); } });
        along(2.5, 22, (s, u) => {
            if (Math.abs(((u + A) % 30) - 15) < 2.2) return;                  // gates
            if (!free(s, u, 11, 2.6, 0.6)) return;
            wb(s, u, 11, 0, 0.3, 1.4, 0.3, 'woodDark', false); wb(s, u, 11, 0.5, 2.5, 0.2, 0.15, 'wood', false); wb(s, u, 11, 1.05, 2.5, 0.2, 0.15, 'wood', false);
            addSolid(...W(s, u, 11).flatMap((c, k) => k === 0 ? [c, 0] : [c]), s % 2 === 0 ? 2.5 : 0.3, 1.3, s % 2 === 0 ? 0.3 : 2.5);
        });
        along(30, 26, (s, u, i) => { if (free(s, u, 15, 5, 3.4)) { wb(s, u - 1.2, 15, 0, 2.2, 1.6, 3, 'sand'); wb(s, u + 1.2, 15, 0, 2.2, 1.6, 3, 'sand'); if (i % 2) wb(s, u, 15, 1.6, 2.2, 1.6, 3, 'sand'); } });
        // a barn and a silo in each corner
        corners((sx, sz) => {
            const cx = sx * (A - 11), cz = sz * (A - 11);
            if (!cfree(cx, cz, 9)) return;
            addBlock(cx, 0, cz + sz * 5, 14, 5, 0.8, 'wood'); addBlock(cx - sx * 6.6, 0, cz, 0.8, 5, 10, 'wood');
            addBlock(cx + sx * 6.6, 0, cz + sz * 3, 0.8, 5, 4, 'wood'); addBlock(cx, 5, cz, 14.8, 0.4, 10.8, 'woodDark'); addBlock(cx, 5.4, cz, 11, 1, 7, 'accR'); addBlock(cx, 6.4, cz, 7, 0.8, 4, 'accR');
            addBlock(cx - sx * 3, 0, cz - sz * 2, 2.2, 1.6, 3, 'sand'); addBlock(cx - sx * 3, 1.6, cz - sz * 2, 2.2, 1.6, 3, 'sand'); addBlock(cx - sx * 0.6, 0, cz - sz * 2, 2.2, 1.6, 3, 'sand');
            const tx = cx - sx * 10, tz = cz + sz * 4;
            if (cfree(tx, tz, 2.5)) { addBlock(tx, 0, tz, 3.4, 8, 3.4, 'concrete'); addBlock(tx, 8, tz, 3.8, 0.5, 3.8, 'steel'); }
        });
    } else if (mapId === 'skybridge') {
        // planters and benches in a steady rhythm along the walls, with street lamps
        along(8, 8, (s, u, i) => {
            if (!free(s, u, 3, 4.2, 2)) return;
            if (i % 2 === 0) { wb(s, u, 3, 0, 4, 0.9, 1.8, 'stone'); wb(s, u, 3, 0.9, 3.6, 0.3, 1.4, 'leafDark'); }
            else { wb(s, u, 3, 0, 3, 0.5, 0.9, 'wood'); wb(s, u, 2.4, 0, 3, 1.1, 0.2, 'wood'); }
            if (i % 4 === 1) { const [x, z] = W(s, u, 5.2); addLamp(x, z); }
        });
        corners((sx, sz) => {       // corner kiosks
            const cx = sx * (A - 4.5), cz = sz * (A - 4.5);
            if (!cfree(cx, cz, 3.5)) return;
            addBlock(cx, 0, cz, 4, 2.8, 4, 'concrete'); addBlock(cx, 2.8, cz, 5, 0.25, 5, accents[(sx + 2 * sz + 3) % 4]);
            addBlock(cx - sx * 2.6, 0, cz - sz * 0.5, 1, 1.1, 3, 'wood'); addBlock(cx - sx * 2.05, 1.6, cz, 0.06, 0.6, 3, 'glowW', false);
        });
    } else if (mapId === 'shipyard') {
        // container stacks lined up along the side walls, bollards along the quays
        along(7.5, 8, (s, u, i) => {
            if (s % 2 === 0) { if (free(s, u, 1.2, 1, 1)) wb(s, u, 1.2, 0, 0.7, 0.9, 0.7, 'accY'); return; }
            if (!free(s, u, 2.2, 6.8, 3)) return;
            const [x, z] = W(s, u, 2.2), keys = ['accR', 'accB', 'accG', 'accY', 'rust', 'steel'];
            const lv = [1, 2, 1, 0, 2, 1][i % 6];
            for (let l = 0; l <= lv; l++) container(x, z, l, false, keys[(i + l) % 6]);
        });
        corners((sx, sz) => {       // guard booths with a barrier
            const cx = sx * (A - 4), cz = sz * (A - 5);
            if (!cfree(cx, cz, 2.5)) return;
            addBlock(cx, 0, cz, 3, 2.6, 3, 'accY'); addBlock(cx, 2.6, cz, 3.6, 0.3, 3.6, 'steel'); addBlock(cx - sx * 1.53, 1.4, cz, 0.06, 0.8, 2.2, 'glowW', false);
            addBlock(cx - sx * 4, 0, cz, 0.4, 1.1, 0.4, 'steel'); addBlock(cx - sx * 6, 1, cz, 4, 0.18, 0.18, 'accR', false);
        });
    } else if (mapId === 'temple') {
        // an avenue of statues and jungle trees along the walls, and a small shrine in each corner
        along(8, 12, (s, u, i) => {
            if (!free(s, u, 3.2, 2.6, 2.6)) return;
            if (i % 2 === 0) { wb(s, u, 3.2, 0, 2, 1, 2, 'stone'); wb(s, u, 3.2, 1, 1.1, 2.2, 0.8, 'sand'); wb(s, u, 3.2, 3.2, 0.8, 0.8, 0.8, 'sand'); wb(s, u, 3.7, 3.4, 0.5, 0.12, 0.05, 'glowY', false); }
            else { const [x, z] = W(s, u, 3.2); tree(x, z, 0.75); }
        });
        corners((sx, sz) => {
            const cx = sx * (A - 5), cz = sz * (A - 5);
            if (!cfree(cx, cz, 4)) return;
            addBlock(cx, 0, cz, 7, 0.6, 7, 'stone'); addBlock(cx, 0.6, cz, 5.4, 0.6, 5.4, 'sand');
            for (const [ox, oz] of [[-2, -2], [2, -2], [2, 2], [-2, 2]]) addBlock(cx + ox, 1.2, cz + oz, 0.8, 3, 0.8, 'sand');
            addBlock(cx, 4.2, cz, 5.6, 0.5, 5.6, 'stone'); addBlock(cx, 1.2, cz, 1, 0.8, 1, 'stone'); addBlock(cx, 2, cz, 0.7, 0.1, 0.7, 'glowY', false);
        });
    } else if (mapId === 'mall') {
        // 4.0: hedges and lamp posts along the walls round the parking lots, billboards in the corners
        along(12, 12, (s, u, i) => {
            if (!free(s, u, 2.6, 8.4, 1.8)) return;
            wb(s, u, 2.6, 0, 8, 0.6, 1.6, 'stone'); wb(s, u, 2.6, 0.6, 7.6, 0.9, 1.2, 'leafDark');
            if (i % 2 === 1 && free(s, u + 6, 5.5, 1, 1)) { const [x, z] = W(s, u + 6, 5.5); addLamp(x, z); }
        });
        corners((sx, sz) => {
            const cx = sx * (A - 6), cz = sz * (A - 6);
            if (!cfree(cx, cz, 5)) return;
            for (const o of [-3, 3]) addBlock(cx + o, 0, cz, 0.5, 6, 0.5, 'steel');
            addBlock(cx, 6, cz, 9, 4, 0.3, 'plaster', false);
            addBlock(cx, 6.4, cz - sz * 0.17, 8.2, 3.2, 0.05, ['glowP', 'glowC', 'glowY', 'glowL'][(sx + 1) + (sz + 1) / 2], false);
        });
    } else if (mapId === 'military') {
        // 4.0: a chain-link fence all the way round, 6m in from the wall, with gates; jersey barriers and sandbags inside it
        for (let s = 0; s < 4; s++) { const [ax, az] = W(s, -A + 16, 6), [bx, bz] = W(s, A - 16, 6); fenceLine(ax, az, bx, bz, [[-45, 4], [0, 4], [45, 4]]); }
        along(30, 22, (s, u, i) => {
            if (!free(s, u, 10, 3.6, 2)) return;
            if (i % 2) wb(s, u, 10, 0, 3.2, 1.1, 0.8, 'concrete');
            else { wb(s, u, 10, 0, 3.6, 1.2, 0.9, 'sand'); wb(s, u - 1.4, 10.9, 0, 0.9, 1.2, 1.8, 'sand'); }
        });
        corners((sx, sz) => {       // guard towers with a floodlight
            const cx = sx * (A - 9), cz = sz * (A - 9);
            if (!cfree(cx, cz, 5)) return;
            stairTower(cx, cz, 9, 4, 'olive', 0, 'steel');
            towerTop(cx, cz, 9, 4, [-sx, 0]);
        });
    }
}


// ---------- THE RAM CAGE ----------
// A barred cage near the spawn on every map. A Charger lives in it forever (see placeCageRam).
function buildRamCage() {
    const half = 4.2, H = 4.6, m = half + 1.8;
    const ok = (x, z) => {
        if (Math.abs(x) > ARENA - m - 2 || Math.abs(z) > ARENA - m - 2) return false;
        for (const b of solids) if (b.max.x > x - m && b.min.x < x + m && b.max.z > z - m && b.min.z < z + m && b.min.y < H + 2) return false;
        for (const [bx, bz, bw, bd] of bridgeRects) if (x + m > bx && x - m < bx + bw && z + m > bz && z - m < bz + bd) return false;
        return true;
    };
    let spot = cageOverride;
    for (let r = 15; r < ARENA * 1.3 && !spot; r += 3) for (let k = 0; k < 20 && !spot; k++) {
        const a = k / 20 * Math.PI * 2 + r * 0.37;
        const x = Math.round(spawnPt[0] + Math.cos(a) * r), z = Math.round(spawnPt[1] + Math.sin(a) * r);
        if (ok(x, z)) spot = [x, z];
    }
    if (!spot) return null;
    const [x, z] = spot;
    addBlock(x, 0, z, half * 2, 0.12, half * 2, 'concreteDark', false);               // floor
    for (const s of [-1, 1]) for (let t = -half; t <= half + 0.01; t += 1.05) {       // bars
        addBlock(x + t, 0, z + s * half, 0.16, H, 0.16, 'steel');
        addBlock(x + s * half, 0, z + t, 0.16, H, 0.16, 'steel');
    }
    for (const s of [-1, 1]) {                                                         // rails top + bottom
        addBlock(x, 0, z + s * half, half * 2 + 0.3, 0.35, 0.3, 'accR'); addBlock(x + s * half, 0, z, 0.3, 0.35, half * 2 + 0.3, 'accR');
        addBlock(x, H - 0.3, z + s * half, half * 2 + 0.3, 0.3, 0.3, 'steel'); addBlock(x + s * half, H - 0.3, z, 0.3, 0.3, half * 2 + 0.3, 'steel');
    }
    for (let t = -half + 1.4; t < half; t += 1.4) addBlock(x + t, H - 0.2, z, 0.16, 0.2, half * 2, 'steel');   // roof bars
    addBlock(x, H, z - half - 0.05, 3.2, 0.7, 0.12, 'accY', false);                   // warning sign
    addBlock(x, H + 0.2, z - half - 0.13, 2.6, 0.3, 0.04, 'glowY', false);
    return { x, z, half };
}


// ---------- ENEMY PATHFINDING ----------
// A 1m grid of every spot you can stand on (the floor, plus the top of anything with headroom above it).
// Enemies obey the same rules as you: they can step or jump UP at most NAV_CLIMB (your jump height),
// and drop down any distance. A breadth-first "flow field" spreading out from the player tells every
// enemy which way to walk - around walls, up stairs, over bridges - so they can't just hop onto anything.
const NAV_CLIMB = 5.1, NAV_HEAD = 3.3, NAV_PAD = 0.35;     // NAV_HEAD: enemies are taller than you (a grunt is 3.2m)
const DX4 = [1, -1, 0, 0], DZ4 = [0, 0, 1, -1], OPP4 = [1, 0, 3, 2];
let nav = null;
function buildNav() {
    const A = ARENA, N = 2 * A, cellYs = new Array(N * N), cellMask = new Array(N * N), cellCeil = new Array(N * N);
    let count = 0;
    const loc = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const x = -A + i + 0.5, z = -A + j + 0.5;
        const near = nearSolids(x, z, 0.9);
        loc.length = 0; for (let k = 0; k < near.length; k++) loc.push(near[k]);
        const tops = VOID ? [] : [0];
        // tops of blocks under (or right at the edge of) this cell - thin rails and posts don't count
        for (const b of loc) if (b.max.x - b.min.x >= 0.6 && b.max.z - b.min.z >= 0.6 && x > b.min.x - NAV_PAD && x < b.max.x + NAV_PAD && z > b.min.z - NAV_PAD && z < b.max.z + NAV_PAD) tops.push(b.max.y);
        tops.sort((a, b) => a - b);
        const ys = [], ms = [], cs = [];
        for (const y of tops) {
            if (ys.length && y - ys[ys.length - 1] < 0.05) continue;
            let ok = true;
            // blocked if we'd be inside a block, or a wall/overhang is within reach (low step-ups don't count)
            for (const b of loc) {
                if (b.min.y >= y + NAV_HEAD || b.max.y <= y + 0.05) continue;
                if (x > b.min.x && x < b.max.x && z > b.min.z && z < b.max.z) { ok = false; break; }
                if (b.max.y > y + 0.6 && x > b.min.x - NAV_PAD && x < b.max.x + NAV_PAD && z > b.min.z - NAV_PAD && z < b.max.z + NAV_PAD) { ok = false; break; }
            }
            if (!ok) continue;
            // which of the 4 cell edges have a wall (rail, window frame...) you'd walk into at this height
            let m = 0;
            for (let k = 0; k < 4; k++) {
                const mx = x + DX4[k] * 0.5, mz = z + DZ4[k] * 0.5;
                for (const b of loc) if (mx > b.min.x - 0.12 && mx < b.max.x + 0.12 && mz > b.min.z - 0.12 && mz < b.max.z + 0.12 && b.min.y < y + NAV_HEAD && b.max.y > y + 0.6) { m |= 1 << k; break; }
            }
            // lowest thing overhead (you can't jump up through a stair or bridge above you)
            let ceil = 999;
            for (const b of loc) if (b.min.y > y + 0.05 && b.min.y < ceil && x > b.min.x - 0.25 && x < b.max.x + 0.25 && z > b.min.z - 0.25 && z < b.max.z + 0.25) ceil = b.min.y;
            ys.push(y); ms.push(m); cs.push(ceil);
        }
        cellYs[j * N + i] = ys; cellMask[j * N + i] = ms; cellCeil[j * N + i] = cs; count += ys.length;
    }
    const start = new Int32Array(N * N + 1), Y = new Float32Array(count), cell = new Int32Array(count), mask = new Uint8Array(count), ceil = new Float32Array(count);
    let n = 0;
    for (let c = 0; c < N * N; c++) { start[c] = n; const ys = cellYs[c], ms = cellMask[c], cs = cellCeil[c]; for (let k = 0; k < ys.length; k++) { Y[n] = ys[k]; mask[n] = ms[k]; ceil[n] = cs[k]; cell[n] = c; n++; } }
    start[N * N] = n;
    nav = { A, N, start, Y, cell, mask, ceil, dist: new Int32Array(count).fill(-1), buckets: Array.from({ length: 16 }, () => []), target: -1, t: 0 };
}
// can something standing on node n walk/jump/drop to node m (next cell over, direction k)?
function navEdge(n, k, m) {
    const up = nav.Y[m] - nav.Y[n];
    if (up < -0.6) return !(nav.mask[n] & (1 << k)) && nav.ceil[m] >= nav.Y[n] + 2.5;          // drop: nothing in the way on the fall
    if (up <= 0.6) return !(nav.mask[n] & (1 << k));
    return up <= NAV_CLIMB && !(nav.mask[m] & (1 << OPP4[k])) && nav.ceil[n] >= nav.Y[m] + NAV_HEAD;  // climb: room to jump
}
// highest standable spot in this cell at or below `feet`
// Sky Islands: is (x, z) somewhere the pathfinding grid says you can stand (not thin air)? Dropping down onto it is fine.
function skyOK(x, z, feet) { const n = navNodeAt(x, z, feet); return n >= 0 && nav.Y[n] > feet - 12 && groundAt(x, z, 0.42, feet + 0.6) > feet - 12; }
function navNodeAt(x, z, feet) {
    const i = Math.floor(x + nav.A), j = Math.floor(z + nav.A);
    if (i < 0 || j < 0 || i >= nav.N || j >= nav.N) return -1;
    const c = j * nav.N + i; let best = -1;
    for (let n = nav.start[c]; n < nav.start[c + 1]; n++) if (nav.Y[n] <= feet + 0.7) best = n;
    return best;
}
function navNear(x, z, feet) {
    let best = navNodeAt(x, z, feet);
    if (best >= 0 && feet - nav.Y[best] < 1.5) return best;
    let bd = best >= 0 ? feet - nav.Y[best] : 1e9;
    for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
        if (!ox && !oz) continue;
        const m = navNodeAt(x + ox * 0.8, z + oz * 0.8, feet);
        if (m >= 0 && feet - nav.Y[m] < bd - 0.01) { bd = feet - nav.Y[m]; best = m; }
    }
    return best;
}
// re-spread the flow field whenever the player moves to a new spot (at most 4x a second)
function updateNavField(dt) {
    if (!nav) return;
    nav.t -= dt;
    if (nav.t > 0) return;
    // every living player is a goal (multiplayer): the field leads each enemy to its nearest player
    const T = aiTargets(), seeds = [];
    for (const t of T) { if (!t.alive) continue; const n = navNear(t.pos.x, t.pos.z, t.feet); if (n >= 0) seeds.push(n); }
    if (!seeds.length) return;
    const key = seeds.join(',');
    if (key === nav.key) return;
    nav.t = 0.25; nav.key = key; nav.target = seeds[0];
    // Dial's algorithm (a bucketed Dijkstra): walking costs 1 per cell, jumping up costs extra,
    // so enemies take the stairs instead of parkouring up the side of everything
    const { N, start, Y, cell, dist, buckets } = nav, INF = 0x3fffffff;
    dist.fill(INF);
    for (const s of seeds) { dist[s] = 0; buckets[0].push(s); }
    let d = 0, pending = seeds.length;
    while (pending > 0) {
        const bk = buckets[d & 15];
        while (bk.length) {
            const m = bk.pop(); pending--;
            if (dist[m] !== d) continue;
            const cm = cell[m], ci = cm % N, cj = (cm - ci) / N, ym = Y[m];
            for (let k = 0; k < 4; k++) {
                const ni = ci + DX4[k], nj = cj + DZ4[k];
                if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
                const cn = nj * N + ni;
                for (let n = start[cn]; n < start[cn + 1]; n++) {
                    const up = ym - Y[n];
                    const nd = d + (up > 0.6 ? 1 + Math.round(up * 1.5) : (up < -3 ? 3 : 1));
                    if (nd < dist[n] && navEdge(n, OPP4[k], m)) { dist[n] = nd; buckets[nd & 15].push(n); pending++; }
                }
            }
        }
        d++;
    }
    for (let n = 0; n < dist.length; n++) if (dist[n] === INF) dist[n] = -1;
}
// next spot downhill in the flow field (-1 if none)
function navNext(n) {
    const { N, start, cell, dist } = nav, c = cell[n], ci = c % N, cj = (c - ci) / N;
    let best = -1, bd = dist[n];
    for (let k = 0; k < 4; k++) {
        const ni = ci + DX4[k], nj = cj + DZ4[k];
        if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
        const cn = nj * N + ni;
        for (let m = start[cn]; m < start[cn + 1]; m++) if (dist[m] >= 0 && dist[m] < bd && navEdge(n, k, m)) { bd = dist[m]; best = m; }
    }
    return best;
}
// where should this enemy walk right now? Returns false when it should just head straight at you.
const navGoal = { x: 0, z: 0, y: 0 };
// 4.0: can something on node n0 at (x, z) walk in a straight line to (tx, tz)? Steps cell by cell along the line (at most
// maxCells) and needs a connected spot on about the same level in each cell. Reaching maxCells counts as clear.
function navLine(n0, x, z, tx, tz, maxCells) {
    const { N, A, start, Y, cell } = nav;
    let n = n0, ci = cell[n0] % N, cj = (cell[n0] - ci) / N, fx = x + A, fz = z + A;
    const ti = Math.floor(tx + A), tj = Math.floor(tz + A), dx = tx - x, dz = tz - z, L = Math.hypot(dx, dz);
    if (L < 1e-6) return true;
    const ux = dx / L, uz = dz / L;
    for (let s = 0; s < maxCells && (ci !== ti || cj !== tj); s++) {
        const ex = Math.abs(ux) > 1e-6 ? ((ux > 0 ? ci + 1 : ci) - fx) / ux : 1e9, ez = Math.abs(uz) > 1e-6 ? ((uz > 0 ? cj + 1 : cj) - fz) / uz : 1e9;
        let k;
        if (ex <= ez) { fx += ux * ex; fz += uz * ex; k = ux > 0 ? 0 : 1; ci += ux > 0 ? 1 : -1; }
        else { fx += ux * ez; fz += uz * ez; k = uz > 0 ? 2 : 3; cj += uz > 0 ? 1 : -1; }
        if (ci < 0 || cj < 0 || ci >= N || cj >= N) return false;
        const c = cj * N + ci; let m = -1;
        for (let q = start[c]; q < start[c + 1]; q++) if (Math.abs(Y[q] - Y[n]) <= 0.6 && navEdge(n, k, q)) { m = q; break; }
        if (m < 0) return false;
        n = m;
    }
    return true;
}
function navSteer(x, z, feet, px, pz, pfeet = 0) {
    if (!nav || nav.target < 0) return false;
    const n0 = navNear(x, z, feet);
    if (n0 < 0 || nav.dist[n0] <= 0) return false;
    // open ground on the same level: the straight line is as short as the path, so skip the grid
    const manhattan = Math.abs(Math.floor(px + nav.A) - Math.floor(x + nav.A)) + Math.abs(Math.floor(pz + nav.A) - Math.floor(z + nav.A));
    const high = nav.Y[n0] > 0.7;
    // (4.0: ...as long as the straight line really is walkable - round a walled building with a doorway, like the
    // Mall or a hangar, a path can be as short as the grid distance while the straight line runs into the wall)
    if (!high && nav.dist[n0] <= manhattan + 1 && pfeet < 0.7 && navLine(n0, x, z, px, pz, 16)) return false;
    // up high (roofs, bridges, stairs) look less far ahead so they don't cut corners off the edge
    // look a few cells ahead (never closer than ~1.6m, so the goal doesn't flip around right under their feet)
    let n = n0;
    for (let s = 0, S = high ? 3 : 5; s < 7; s++) {
        const m = navNext(n); if (m < 0) break;
        if (s > 0 && nav.Y[m] - nav.Y[n] > 0.6) break;       // get to the launch spot first, then jump
        if (s > 0) { const cm = nav.cell[m], mi = cm % nav.N; if (!navLine(n0, x, z, -nav.A + mi + 0.5, -nav.A + (cm - mi) / nav.N + 0.5, 8)) break; }   // 4.0: no cutting corners into walls / stair rails
        n = m;
        if (Math.abs(nav.Y[m] - nav.Y[n0]) > 0.6) break;     // head straight for the step/drop
        if (s + 1 >= S) { const c = nav.cell[n], ci = c % nav.N; if (Math.hypot(-nav.A + ci + 0.5 - x, -nav.A + (c - ci) / nav.N + 0.5 - z) > 1.6) break; }
    }
    const c = nav.cell[n], ci = c % nav.N;
    navGoal.x = -nav.A + ci + 0.5; navGoal.z = -nav.A + (c - ci) / nav.N + 0.5; navGoal.y = nav.Y[n];
    return true;
}


// ---------- COLLISION (pure box math, no raycasts) ----------


// Spatial grid: collision queries only look at blocks in nearby 8x8 cells instead of all ~300
const GC = 8, GO = -112, GN = 28;
let solidGrid = null, gridMark = null, gridStamp = 0, gridSolids = null;
const _cand = [];
const cellOf = (v) => Math.max(0, Math.min(GN - 1, Math.floor((v - GO) / GC)));
function buildSolidGrid() {
    solidGrid = Array.from({ length: GN * GN }, () => []);
    gridMark = new Uint32Array(solids.length); gridSolids = solids;
    solids.forEach((b, i) => {
        for (let cx = cellOf(b.min.x); cx <= cellOf(b.max.x); cx++) for (let cz = cellOf(b.min.z); cz <= cellOf(b.max.z); cz++) solidGrid[cz * GN + cx].push(i);
    });
}
function nearSolids(x, z, r) {
    if (!solidGrid || gridSolids !== solids || gridMark.length !== solids.length) return solids;
    _cand.length = 0; gridStamp++;
    const x1 = cellOf(x + r), z0 = cellOf(z - r), z1 = cellOf(z + r);
    for (let cx = cellOf(x - r); cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
        const cell = solidGrid[cz * GN + cx];
        for (let k = 0; k < cell.length; k++) { const i = cell[k]; if (gridMark[i] !== gridStamp) { gridMark[i] = gridStamp; _cand.push(solids[i]); } }
    }
    return _cand;
}
// Highest surface under (x,z) that we can stand on / step up to from feetY
function groundAt(x, z, margin, fY) {
    let g = VOID ? VOID_Y : 0;
    const list = nearSolids(x, z, margin);
    for (let i = 0; i < list.length; i++) {
        const b = list[i];
        if (x > b.min.x - margin && x < b.max.x + margin && z > b.min.z - margin && z < b.max.z + margin) {
            if (b.max.y <= fY + STEP && b.max.y > g) g = b.max.y;
        }
    }
    return g;
}
// Lowest ceiling above topY
function ceilingAt(x, z, margin, topY) {
    let c = Infinity;
    const list = nearSolids(x, z, margin);
    for (let i = 0; i < list.length; i++) {
        const b = list[i];
        if (x > b.min.x - margin && x < b.max.x + margin && z > b.min.z - margin && z < b.max.z + margin) {
            if (b.min.y >= topY - 0.05 && b.min.y < c) c = b.min.y;
        }
    }
    return c;
}
// Slide a vertical cylinder (fY..topY) out of walls. Boxes we can step onto are ignored.
function pushOut(pos, radius, fY, topY) {
    const list = nearSolids(pos.x, pos.z, radius);
    for (let i = 0; i < list.length; i++) {
        const b = list[i];
        if (fY + STEP >= b.max.y || topY <= b.min.y) continue;
        const cx = Math.max(b.min.x, Math.min(pos.x, b.max.x));
        const cz = Math.max(b.min.z, Math.min(pos.z, b.max.z));
        const dx = pos.x - cx, dz = pos.z - cz;
        const distSq = dx * dx + dz * dz;
        if (distSq >= radius * radius) continue;
        if (distSq > 1e-8) {
            const dist = Math.sqrt(distSq), overlap = radius - dist;
            pos.x += (dx / dist) * overlap; pos.z += (dz / dist) * overlap;
        } else {
            // center is inside the box: exit through the nearest face
            const l = pos.x - b.min.x, r = b.max.x - pos.x, n = pos.z - b.min.z, f = b.max.z - pos.z;
            const m = Math.min(l, r, n, f);
            if (m === l) pos.x = b.min.x - radius; else if (m === r) pos.x = b.max.x + radius;
            else if (m === n) pos.z = b.min.z - radius; else pos.z = b.max.z + radius;
        }
    }
}
function pointInSolid(p, pad = 0) {
    const list = nearSolids(p.x, p.z, pad);
    for (let i = 0; i < list.length; i++) {
        const b = list[i];
        if (p.x > b.min.x - pad && p.x < b.max.x + pad && p.y > b.min.y - pad && p.y < b.max.y + pad && p.z > b.min.z - pad && p.z < b.max.z + pad) return b;
    }
    return null;
}
// Is the straight line a->b free of blocks? (slab test against every box)
function losClear(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    for (let i = 0; i < solids.length; i++) {
        const b = solids[i];
        if (b.thru) continue;           // 4.0: you can see (and shoot) through glass railings and chain-link
        let t0 = 0, t1 = 1;
        if (Math.abs(dx) < 1e-9) { if (ax < b.min.x || ax > b.max.x) continue; }
        else { let n = (b.min.x - ax) / dx, f = (b.max.x - ax) / dx; if (n > f) { const t = n; n = f; f = t; } if (n > t0) t0 = n; if (f < t1) t1 = f; if (t0 > t1) continue; }
        if (Math.abs(dy) < 1e-9) { if (ay < b.min.y || ay > b.max.y) continue; }
        else { let n = (b.min.y - ay) / dy, f = (b.max.y - ay) / dy; if (n > f) { const t = n; n = f; f = t; } if (n > t0) t0 = n; if (f < t1) t1 = f; if (t0 > t1) continue; }
        if (Math.abs(dz) < 1e-9) { if (az < b.min.z || az > b.max.z) continue; }
        else { let n = (b.min.z - az) / dz, f = (b.max.z - az) / dz; if (n > f) { const t = n; n = f; f = t; } if (n > t0) t0 = n; if (f < t1) t1 = f; if (t0 > t1) continue; }
        return false;
    }
    return true;
}
// Nearest block (or floor) hit along a ray. Returns the hit distance, point and face normal.
const envHit = { t: 0, point: new V3(), normal: new V3() };
function raySolids(o, d, maxT) {
    let best = maxT, nAxis = -1, nSign = 0;
    for (let i = 0; i < solids.length; i++) {
        const b = solids[i];
        if (b.thru) continue;           // 4.0: glass railings / chain-link fences don't stop bullets
        let tmin = 0, tmax = best, ax = -1, sg = 0;
        if (Math.abs(d.x) < 1e-9) { if (o.x < b.min.x || o.x > b.max.x) continue; }
        else { let t1 = (b.min.x - o.x) / d.x, t2 = (b.max.x - o.x) / d.x, s = -1; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; s = 1; } if (t1 > tmin) { tmin = t1; ax = 0; sg = s; } if (t2 < tmax) tmax = t2; if (tmin > tmax) continue; }
        if (Math.abs(d.y) < 1e-9) { if (o.y < b.min.y || o.y > b.max.y) continue; }
        else { let t1 = (b.min.y - o.y) / d.y, t2 = (b.max.y - o.y) / d.y, s = -1; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; s = 1; } if (t1 > tmin) { tmin = t1; ax = 1; sg = s; } if (t2 < tmax) tmax = t2; if (tmin > tmax) continue; }
        if (Math.abs(d.z) < 1e-9) { if (o.z < b.min.z || o.z > b.max.z) continue; }
        else { let t1 = (b.min.z - o.z) / d.z, t2 = (b.max.z - o.z) / d.z, s = -1; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; s = 1; } if (t1 > tmin) { tmin = t1; ax = 2; sg = s; } if (t2 < tmax) tmax = t2; if (tmin > tmax) continue; }
        if (ax >= 0 && tmin < best) { best = tmin; nAxis = ax; nSign = sg; }
    }
    if (d.y < -1e-6) { const t = -o.y / d.y; if (t > 0 && t < best) { best = t; nAxis = 1; nSign = 1; } }
    if (nAxis < 0) return null;
    envHit.t = best;
    envHit.point.copy(o).addScaledVector(d, best);
    envHit.normal.set(nAxis === 0 ? nSign : 0, nAxis === 1 ? nSign : 0, nAxis === 2 ? nSign : 0);
    return envHit;
}
