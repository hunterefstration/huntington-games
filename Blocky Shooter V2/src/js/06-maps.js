// ---------- COMPACT MAPS ----------
// SKYBRIDGE: a ring of towers 12m up, all joined by rope bridges. Stairs wind up the four corner towers.
function mapSkybridge() {
    const R = 24, H = 12;
    for (const [x, z, rot] of [[-R, -R, 1], [R, -R, 2], [R, R, 3], [-R, R, 0]]) stairTower(x, z, H, 7, 'concrete', rot, 'steel');
    for (const [x, z] of [[0, -R], [R, 0], [0, R], [-R, 0]]) stairTower(x, z, H, 5, 'concreteDark', 0, 'steel', false);
    for (const s of [-1, 1]) {
        ropeBridge(-R + 3.5, s * R, H, -2.5, s * R, H); ropeBridge(2.5, s * R, H, R - 3.5, s * R, H);
        ropeBridge(s * R, -R + 3.5, H, s * R, -2.5, H); ropeBridge(s * R, 2.5, H, s * R, R - 3.5, H);
    }
    // courtyard cover
    addStructure('wall', -9, -9, 0); addStructure('wall', 9, 9, 0); addStructure('crates', 10, -9, 1); addStructure('crates', -10, 9, 2);
    addBlock(0, 0, -12, 4, 1.2, 1.2, 'sand'); addBlock(0, 0, 12, 4, 1.2, 1.2, 'sand'); addBlock(-12, 0, 0, 1.2, 1.2, 4, 'sand'); addBlock(12, 0, 0, 1.2, 1.2, 4, 'sand');
    // the outer ring: low climbable blocks, crates and sandbags
    const spots = [[-44, -44], [44, -44], [44, 44], [-44, 44], [0, -44], [44, 0], [0, 44], [-44, 0], [-44, -22], [22, -44], [44, 22], [-22, 44]];
    const kinds = ['containers', 'scaffold', 'bunker', 'crates', 'rubble', 'fort'];
    spots.forEach(([x, z], i) => addStructure(kinds[i % kinds.length], x, z, Math.floor(Math.random() * 4)));
    lampRing([[15, 4, 0.8], [40, 8, 0.4]]);
}
// SHIPYARD: rows of stacked containers (each 2.6m - one jump), gangways between stacks, and a crane catwalk
function mapShipyard() {
    const cols = []; for (let x = -45; x <= 45.01; x += 7.5) cols.push(x);
    const pattern = [0, 1, 2, 3, 2, 1], phase = Math.floor(Math.random() * 6);
    const keys = ['accR', 'accB', 'accG', 'accY', 'rust', 'steel'];
    const rowH = {};
    for (const rz of [-40, -24, 24, 40]) {
        const hs = cols.map((x, ci) => pattern[(ci + phase) % 6]);
        rowH[rz] = hs;
        cols.forEach((x, ci) => {
            for (let l = 0; l < hs[ci]; l++) for (const dz of [-1.28, 1.28]) container(x, rz + dz, l, true, keys[(ci * 3 + l + (dz > 0 ? 1 : 0) + (rz > 0 ? 2 : 0) + (Math.abs(rz) > 30 ? 1 : 0)) % keys.length]);
            // gangway plate to the next stack so you can walk the row (and so can they)
            const h2 = hs[ci + 1];
            if (ci < cols.length - 1 && hs[ci] > 0 && h2 > 0) addBlock(x + 3.75, Math.min(hs[ci], h2) * 2.6 - 0.25, rz, 1.4, 0.25, 4.6, 'steel');
        });
    }
    // rope bridges across the aisles between the tallest stacks
    cols.forEach((x, ci) => {
        if (rowH[-40][ci] === 3 && rowH[-24][ci] === 3) ropeBridge(x, -37.44, 7.8, x, -26.56, 7.8, { sag: 0.5 });
        if (rowH[24][ci] === 3 && rowH[40][ci] === 3) ropeBridge(x, 26.56, 7.8, x, 37.44, 7.8, { sag: 0.5 });
    });
    // the crane: two stair legs and a steel catwalk 14m up
    stairTower(-30, 0, 14, 4, 'accY', 1, 'steel'); stairTower(30, 0, 14, 4, 'accY', 3, 'steel');
    ropeBridge(-28, 0, 14, 28, 0, 14, { steel: true, width: 2.4 });
    addBlock(0, 16.2, 0, 64, 1.1, 1.2, 'accY', false);                         // the jib above the catwalk
    for (const x of [-31.6, 31.6]) addBlock(x, 14, 0, 0.5, 2.2, 0.5, 'accY', false);   // jib supports at the back of the leg tops
    addBlock(8, 7.6, 0, 0.08, 8.6, 0.08, 'post', false); addBlock(8, 6.5, 0, 1.2, 1.1, 1.2, 'accR', false);   // hanging hook
    // courtyard: loose containers, crates, a couple of forklift-ish blocks
    container(-12, -10, 0, false, 'accB'); container(14, 9, 0, true, 'rust'); container(14, 11.6, 0, true, 'accG');
    addStructure('crates', -14, 10, 0); addStructure('crates', 10, -12, 1);
    for (const [x, z] of [[-4, 14], [5, -15]]) { addBlock(x, 0, z, 2, 1.4, 3, 'accY'); addBlock(x, 1.4, z + 0.8, 1.6, 1.2, 1, 'steel'); }
    for (const x of [-20, -6, 6, 20]) addBlock(x, 0, 18.5, 0.6, 1, 0.6, 'accY');
    for (const x of [-20, -6, 6, 20]) addBlock(x, 0, -18.5, 0.6, 1, 0.6, 'accY');
    // edge strip: single containers along the walls
    for (let x = -48; x <= 48; x += 12) { if (Math.random() < 0.7) container(x, -51, 0, true, keys[(x / 12 + 6) % 6 | 0]); if (Math.random() < 0.7) container(x, 51, 0, true, keys[(x / 12 + 9) % 6 | 0]); }
    lampRing([[16, 4, 0.4], [47, 8, 0.2]]);
}
// TEMPLE: a stepped pyramid, a raised stone walkway around it and four ruined towers bridged onto the walkway
function mapTemple() {
    spawnPt = [0, 24];
    const tiers = [30, 24, 18, 12, 6];
    tiers.forEach((s, k) => addBlock(0, 2 * k, 0, s, 2, s, k % 2 ? 'stone' : 'sand'));
    // grand stairs: three steps (0.5m each) up every tier face, on all four sides
    for (let k = 0; k < tiers.length; k++) {
        const e = tiers[k] / 2, y0 = 2 * k;
        for (let i = 0; i < 3; i++) {
            const o = e + 2.5 - i, h = 0.5 * (i + 1);
            addBlock(0, y0, o, 4, h, 1, 'stone'); addBlock(0, y0, -o, 4, h, 1, 'stone');
            addBlock(o, y0, 0, 1, h, 4, 'stone'); addBlock(-o, y0, 0, 1, h, 4, 'stone');
        }
    }
    // shrine on top
    // (the roof is too high to jump onto, so nobody can camp up there)
    for (const [x, z] of [[-2.2, -2.2], [2.2, -2.2], [2.2, 2.2], [-2.2, 2.2]]) addBlock(x, 10, z, 0.8, 5.6, 0.8, 'sand');
    addBlock(0, 15.6, 0, 7, 0.5, 7, 'stone'); addBlock(0, 16.1, 0, 4, 0.6, 4, 'sand'); addBlock(0, 10, 0, 3, 0.08, 3, 'glowY', false);
    // raised walkway ring, 6m up, on pillars
    const W = 40, D = 3.5, Y = 6;
    addBlock(0, Y - 0.4, -W, 2 * W + D, 0.4, D, 'stone'); addBlock(0, Y - 0.4, W, 2 * W + D, 0.4, D, 'stone');
    addBlock(-W, Y - 0.4, 0, D, 0.4, 2 * W - D, 'stone'); addBlock(W, Y - 0.4, 0, D, 0.4, 2 * W - D, 'stone');
    for (let t = -W; t <= W; t += 8) {
        for (const [x, z] of [[t, -W], [t, W], [-W, t], [W, t]]) if (Math.abs(t) > 3) addBlock(x, 0, z, 1.2, Y - 0.4, 1.2, 'sand');
    }
    // outer parapet with gaps
    for (let t = -W + 2; t < W - 2; t += 6) {
        addBlock(t + 1.5, Y, -W - D / 2 + 0.2, 3, 1, 0.4, 'stone'); addBlock(t + 1.5, Y, W + D / 2 - 0.2, 3, 1, 0.4, 'stone');
        addBlock(-W - D / 2 + 0.2, Y, t + 1.5, 0.4, 1, 3, 'stone'); addBlock(W + D / 2 - 0.2, Y, t + 1.5, 0.4, 1, 3, 'stone');
    }
    // straight stairs up to the walkway in the middle of each side
    for (let i = 0; i < 12; i++) {
        const h = 0.5 * (i + 1), o = W - D / 2 - 11.5 + i;
        addBlock(0, 0, -o, 3, h, 1, 'stone'); addBlock(0, 0, o, 3, h, 1, 'stone'); addBlock(-o, 0, 0, 1, h, 3, 'stone'); addBlock(o, 0, 0, 1, h, 3, 'stone');
    }
    // ruined towers, each with two bridges down onto the walkway
    for (const [sx, sz, rot] of [[1, 1, 1], [-1, 1, 2], [1, -1, 0], [-1, -1, 3]]) {
        const x = sx * 24, z = sz * 24;
        stairTower(x, z, 9, 5, 'sand', rot, 'stone');
        ropeBridge(x + sx * 2.5, z, 9, sx * (W - D / 2), z, Y, { sag: 0.25 });
        ropeBridge(x, z + sz * 2.5, 9, x, sz * (W - D / 2), Y, { sag: 0.25 });
    }
    // courtyard: broken columns, low walls, braziers
    for (const [x, z, h] of [[-8, 20, 2.5], [8, 20, 1.2], [20, -8, 3], [20, 8, 1.6], [-20, -8, 2], [-20, 8, 3.2], [-8, -20, 1.4], [8, -20, 2.8]]) addBlock(x, 0, z, 1.4, h, 1.4, 'sand');
    for (const [x, z, a] of [[-15, 30, 1], [15, 30, 1], [30, -15, 0], [-30, 15, 0], [15, -30, 1], [-30, -15, 0]]) addBlock(x, 0, z, a ? 6 : 1, 1.3, a ? 1 : 6, 'stone');
    for (const [x, z] of [[-6, 16], [6, 16], [-6, -16], [6, -16]]) { addBlock(x, 0, z, 1, 1, 1, 'stone'); addBlock(x, 1, z, 0.7, 0.1, 0.7, 'glowY', false); }
    // outside the ring: ruined colonnades and fallen blocks
    for (let t = -48; t <= 48; t += 6) {
        const ph = () => Math.random() < 0.3 ? 8 : 1 + Math.random() * 3.4;       // stumps you can climb, or tall ones you can't
        if (Math.random() < 0.7) addBlock(t, 0, -52, 1.4, ph(), 1.4, 'sand');
        if (Math.random() < 0.7) addBlock(t, 0, 52, 1.4, ph(), 1.4, 'sand');
        if (Math.random() < 0.7) addBlock(-52, 0, t, 1.4, ph(), 1.4, 'sand');
        if (Math.random() < 0.7) addBlock(52, 0, t, 1.4, ph(), 1.4, 'sand');
    }
    lampRing([[33, 8, 0.4], [50, 8, 0]]);
}


// ---------- SKY ISLANDS (no floor!) ----------
// Puffy cloud islands with their tops at y = 0 (so everything that assumes "ground is 0" still works on them),
// joined by cloud paths and rope bridges, over a sea of clouds far below. Walk off an edge and you fall to your death.
function cloudIsland(cx, cz, r, y = 0, opts = {}) {
    const cs = 3;
    skyIslands.push([cx, cz, r, y]);
    for (let gx = -r; gx <= r + 0.01; gx += cs) for (let gz = -r; gz <= r + 0.01; gz += cs) {
        const d = Math.hypot(gx, gz);
        if (d > r - Math.random() * 1.2) continue;
        const t = 1 - d / r;
        addBlock(cx + gx, y - 1.4, cz + gz, cs + 0.2, 1.4, cs + 0.2, 'cloud');
        addBlock(cx + gx, y - 1.4 - (1.5 + t * 4 + Math.random() * 1.5), cz + gz, cs * (0.7 + t * 0.4), 1.5 + t * 4 + Math.random() * 1.5, cs * (0.7 + t * 0.4), 'cloudShade', false);
    }
    // soft puffy rim: slightly lower, still walkable (so the edge you see is the edge you stand on)
    const n = Math.max(8, Math.round(r * 1.4));
    for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2 + Math.random() * 0.3, rr = r + 0.4;
        const s = 2 + Math.random() * 1.6;
        addBlock(cx + Math.cos(a) * rr, y - 1.2 - Math.random() * 0.6, cz + Math.sin(a) * rr, s, 1.0, s, 'cloud');
    }
    if (opts.hill) { addBlock(cx + opts.hill[0], y, cz + opts.hill[1], 7, 1.2, 7, 'cloud'); addBlock(cx + opts.hill[0] + 0.5, y + 1.2, cz + opts.hill[1] - 0.5, 4, 1.2, 4, 'cloud'); }
}
// cloud walkway: overlapping square puffs so it works at any angle; height changes in 0.5m steps (walkable)
function cloudPath(x1, z1, y1, x2, z2, y2, w = 3.4) {
    const len = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.ceil(len / 1.6));
    for (let i = 0; i <= n; i++) {
        const t = i / n, x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t, y = Math.round((y1 + (y2 - y1) * t) * 2) / 2;
        addBlock(x, y - 1, z, w, 1, w, 'cloud');
        if (i % 2 === 0) addBlock(x, y - 2.6 - Math.random(), z, w * 0.7, 1.6 + Math.random(), w * 0.7, 'cloudShade', false);
    }
}
function mapSky() {
    spawnPt = [0, 5];
    // the big middle island with a little cloud hill and some ruins for cover
    cloudIsland(0, 0, 14, 0, { hill: [-6, -6] });
    for (const [x, z, h] of [[6, -4, 2.4], [8, 2, 1.2], [-3, 8, 3.2], [4, 9, 1.6]]) addBlock(x, 0, z, 1.4, h, 1.4, 'stone');
    addBlock(-8, 0, 4, 5, 1.3, 1.2, 'stone'); addBlock(7, 0, -9, 1.2, 1.3, 4, 'stone');
    addStructure('crates', 9, 6, 0);
    // six islands around it, each joined to the middle by a cloud path (and a few side bridges)
    const R = 36, ring = [];
    for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + Math.PI / 6, x = Math.cos(a) * R, z = Math.sin(a) * R, y = [0, 2.5, 0, 4, 0, 2.5][k];
        if (Math.abs(x) < 26 && z < -20) continue;          // leave room for the ram's island
        ring.push({ a, x, z, y });
        cloudIsland(x, z, 8, y);
        cloudPath(Math.cos(a) * 12.5, Math.sin(a) * 12.5, 0, Math.cos(a) * (R - 7.5), Math.sin(a) * (R - 7.5), y);
    }
    // things on the islands: a sky tower you can climb, ruined arches, pillars, crates
    const kinds = ['tower', 'arch', 'pillars', 'crates', 'bunker'];
    ring.forEach((I, i) => {
        if (i === 0) { stairTower(I.x, I.z, 10, 5, 'stone', 0, 'steel'); I.tower = true; }
        else if (kinds[i % kinds.length] === 'arch') { addBlock(I.x - 3, I.y, I.z, 1.4, 4, 1.4, 'stone'); addBlock(I.x + 3, I.y, I.z, 1.4, 4, 1.4, 'stone'); addBlock(I.x, I.y + 4, I.z, 7.4, 1, 1.6, 'accY'); }
        else if (kinds[i % kinds.length] === 'pillars') { for (const [ox, oz, h] of [[-3, -2, 3], [2, -3, 1.6], [3, 2, 2.4], [-2, 3, 1.2]]) addBlock(I.x + ox, I.y, I.z + oz, 1.4, h, 1.4, 'stone'); }
        else { for (let q = 0; q < 3; q++) addBlock(I.x + (q - 1) * 2, I.y, I.z + 2, 2, 1.2 * (q + 1), 2, q % 2 ? 'wood' : 'woodDark'); }
    });
    // narrow cloud bridges between neighbouring islands (a way round without going through the middle)
    for (let i = 0; i < ring.length; i++) {
        const A = ring[i], B = ring[(i + 1) % ring.length];
        const da = Math.abs(A.a - B.a); if (da > 1.2 && da < 5.1) continue;
        const d = Math.hypot(B.x - A.x, B.z - A.z), ux = (B.x - A.x) / d, uz = (B.z - A.z) / d;
        cloudPath(A.x + ux * 7.5, A.z + uz * 7.5, A.y, B.x - ux * 7.5, B.z - uz * 7.5, B.y, 2.6);
    }
    // the ram's island, just south of the middle
    cloudIsland(0, -27, 8, 0);
    cloudPath(0, -12.5, 0, 0, -19.5, 0);
    cageOverride = [0, -27];
    // high corner islands up a staircase of cloud puffs
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const near = ring.reduce((b, I) => (!b || Math.hypot(I.x - sx * 50, I.z - sz * 50) < Math.hypot(b.x - sx * 50, b.z - sz * 50)) ? I : b, null);
        if (!near) continue;
        const cx = sx * 51, cz = sz * 51, top = near.y + 4.8;
        cloudIsland(cx, cz, 6, top);
        const d = Math.hypot(cx - near.x, cz - near.z), ux = (cx - near.x) / d, uz = (cz - near.z) / d;
        cloudPath(near.x + ux * 7.5, near.z + uz * 7.5, near.y, cx - ux * 5.5, cz - uz * 5.5, top, 3);
        addBlock(cx, top, cz, 2, 2.4, 2, 'stone'); addBlock(cx, top + 2.4, cz, 2.6, 0.3, 2.6, 'accY');
    }
    // the sea of clouds far below (just scenery)
    for (let i = 0; i < 70; i++) {
        const x = (Math.random() * 2 - 1) * 150, z = (Math.random() * 2 - 1) * 150, s = 14 + Math.random() * 26;
        addBlock(x, -58 - Math.random() * 10, z, s, 4 + Math.random() * 5, s * (0.6 + Math.random() * 0.8), Math.random() < 0.6 ? 'cloud' : 'cloudShade', false);
    }
    // a few drifting clouds around the arena at eye level
    for (let i = 0; i < 16; i++) {
        const a = Math.random() * Math.PI * 2, r = 80 + Math.random() * 60, s = 8 + Math.random() * 14;
        addBlock(Math.cos(a) * r, -6 + Math.random() * 20, Math.sin(a) * r, s, 3 + Math.random() * 3, s * 0.7, 'cloud', false);
    }
}
