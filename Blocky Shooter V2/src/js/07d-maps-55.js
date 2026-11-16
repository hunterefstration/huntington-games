// ---------- 5.5 MAPS: FROSTBITE (snowed-in research outpost) and CARNIVAL (abandoned funfair at night) ----------
// Built with the same kit as every other map (addBlock / stairTower / ropeBridge / railLine / stairRun ...), so every block
// still merges into one mesh per material. Frostbite adds slippery lake ice (iceRects, read by the player physics) and light
// snowfall (one Points draw call, only on this map).
let iceRects = [];              // [x0, z0, x1, z1] patches of lake ice at ground level (you slide on them)
function onIce(x, z, feet) {
    if (!iceRects.length || feet > 0.3) return false;
    for (const r of iceRects) if (x > r[0] && x < r[2] && z > r[1] && z < r[3]) return true;
    return false;
}
// a snowy pine: trunk, three shrinking tiers of needles with snow on each
function snowPine(x, z, big = 1) {
    const h = (6 + Math.random() * 2) * big;
    addBlock(x, 0, z, 0.8 * big, h * 0.5, 0.8 * big, 'woodDark');
    for (let k = 0; k < 3; k++) {
        const s = (4.4 - k * 1.25) * big, y = h * (0.32 + k * 0.22);
        addBlock(x, y, z, s, 1.5 * big, s, 'leafDark');
        addBlock(x, y + 1.5 * big, z, s * 0.82, 0.25, s * 0.82, 'snow', false);
    }
}
// a research cabin: walls, a door, lit windows, a snow-covered roof
function cabin(x, z, w, d, alongX) {
    addBlock(x, 0, z, w, 3.6, d, 'plaster');
    addBlock(x, 3.6, z, w + 0.6, 0.4, d + 0.6, 'snow');
    addBlock(x, 0, z, w + 0.1, 0.4, d + 0.1, 'concreteDark', false);
    const fz = alongX ? z + d / 2 + 0.03 : z, fx = alongX ? x : x + w / 2 + 0.03;
    if (alongX) { addBlock(x - w * 0.25, 0.4, fz, 1.2, 2.2, 0.06, 'rubber', false); addBlock(x + w * 0.2, 1.5, fz, 1.6, 0.9, 0.06, 'glowW', false); }
    else { addBlock(fx, 0.4, z - d * 0.25, 0.06, 2.2, 1.2, 'rubber', false); addBlock(fx, 1.5, z + d * 0.2, 0.06, 0.9, 1.6, 'glowW', false); }
}
function mapFrostbite() {
    spawnPt = [6, 34];
    iceRects = [];
    // ---- the frozen lake (west): smooth ice you slide on, cracks that glow faintly, frozen boulders and a sunk boat ----
    const L = [-56, -22, -12, 22];
    addBlock((L[0] + L[2]) / 2, 0, (L[1] + L[3]) / 2, L[2] - L[0], 0.04, L[3] - L[1], 'ice', false);
    iceRects.push(L);
    for (let i = 0; i < 9; i++) {
        const x = L[0] + 4 + Math.random() * (L[2] - L[0] - 8), z = L[1] + 3 + Math.random() * (L[3] - L[1] - 6), ax = Math.random() < 0.5;
        addBlock(x, 0.04, z, ax ? 3 + Math.random() * 5 : 0.12, 0.01, ax ? 0.12 : 3 + Math.random() * 5, 'glowC', false);
    }
    for (const [x, z, s, h] of [[-44, -10, 3.2, 2.2], [-30, 12, 2.4, 1.4], [-20, -14, 4, 3], [-48, 14, 2.6, 1.6], [-26, -2, 1.6, 1]]) { addBlock(x, 0, z, s, h, s * 0.8, 'ice'); addBlock(x + 0.3, h, z - 0.2, s * 0.6, 0.3, s * 0.5, 'snow', false); }
    addBlock(-38, -0.4, 2, 7, 1.4, 2.6, 'woodDark'); addBlock(-38, 1.0, 2, 1.2, 1.2, 1.4, 'wood'); addBlock(-41, 1.0, 2, 0.12, 3.2, 0.12, 'post', false);    // a boat frozen into the lake
    // ice fishing huts on the lake edge
    for (const [x, z] of [[-14, -18], [-14, 16]]) { addBlock(x, 0, z, 3, 2.6, 3, 'accR'); addBlock(x, 2.6, z, 3.4, 0.3, 3.4, 'snow'); addBlock(x + 1.53, 0, z, 0.06, 2.1, 1, 'rubber', false); }
    // ---- ice caves (north): a tunnel of ice you can walk through, lit blue inside, with two side chambers ----
    const CZ = -52;
    addBlock(4, 0, CZ - 4.2, 44, 4.6, 1.6, 'ice');
    addBlock(4, 4.6, CZ, 46, 1.4, 10, 'ice'); addBlock(4, 6.0, CZ, 40, 0.5, 8, 'snow', false);
    for (let x = -14; x <= 22; x += 6) { addBlock(x, 4.2, CZ - 1.8, 0.3, 0.4, 0.3, 'glowC', false); addBlock(x + 3, 4.0, CZ + 1.6, 0.25, 0.6, 0.25, 'glowC', false); addCeilingLight(x, CZ, 0, 4.5, 5, false, 0.8); }
    // the south wall has three doorways, so you (and they) can get in
    for (const [x0, x1] of [[-18, -13], [-11, 4], [8, 18], [22, 26]]) addBlock((x0 + x1) / 2, 0, CZ + 4.2, x1 - x0, 4.6, 1.6, 'ice');
    for (const [x, z] of [[-24, CZ], [32, CZ]]) { addBlock(x, 0, z, 6, 3.2, 9, 'snow'); addBlock(x, 3.2, z, 4, 1.2, 7, 'snow'); }       // drifts plug the tunnel ends (climbable)
    // ---- radar dome (north-east): a stepped dome on a two-storey block, stairs up the side, a catwalk round the dome ----
    const RX = 40, RZ = -26;
    addBlock(RX, 0, RZ, 14, 6, 14, 'concrete'); addBlock(RX, 6, RZ, 15, 0.3, 15, 'snow', false);
    for (const [sz, y, h] of [[10, 6, 1.2], [9, 7.2, 1.2], [7.6, 8.4, 1.1], [5.6, 9.5, 1], [3.2, 10.5, 0.8]]) addBlock(RX, y, RZ, sz, h, sz, 'paint');
    addBlock(RX, 11.3, RZ, 0.3, 2, 0.3, 'post', false); addBlock(RX, 13.3, RZ, 0.4, 0.4, 0.4, 'glowR', false);
    stairRun(RX - 7 - 12, RZ + 5.5, RX - 7, RZ + 5.5, 0, 6, 3, ['concrete', 'concreteDark']); stairSides(RX - 7 - 12, RZ + 5.5, RX - 7, RZ + 5.5, 0, 6, 3, [-1, 1], 'steel');
    railLine(RX - 7.3, RZ - 7.3, RX + 7.3, RZ - 7.3, 6, [], 'steel'); railLine(RX + 7.3, RZ - 7.3, RX + 7.3, RZ + 7.3, 6, [], 'steel');
    addBlock(RX - 7.05, 1.4, RZ, 0.1, 1.2, 4, 'glowW', false);
    // ---- drilling rig (east): a tall stair tower with a derrick on top, bridged to the radio mast ----
    stairTower(44, 26, 12, 6, 'olive', 3, 'steel');
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) addBlock(44 + sx * 2.2, 12, 26 + sz * 2.2, 0.3, 9, 0.3, 'accY', false);
    for (const y of [15, 18, 21]) addBlock(44, y, 26, 4.8, 0.25, 4.8, 'accY', false);
    addBlock(44, 21, 26, 0.6, 1.4, 0.6, 'glowR', false);
    addBlock(52, 0, 26, 4, 3, 8, 'accY'); addBlock(52, 3, 26, 3, 1.2, 6, 'steel');            // pump house
    for (const z of [18, 34]) { addBlock(38, 0, z, 6, 2.2, 2.4, 'rust'); addBlock(38, 2.2, z, 6.2, 0.25, 2.6, 'snow', false); }    // fuel tanks
    stairTower(14, 30, 12, 4, 'concreteDark', 0, 'steel');
    ropeBridge(16, 30, 12, 41, 30, 12, { steel: true, width: 2.4 });
    for (let y = 12; y < 26; y += 2) addBlock(14, y, 30, 1.6 - (y - 12) * 0.08, 0.12, 1.6 - (y - 12) * 0.08, 'post', false);    // the radio mast's lattice
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) addBlock(14 + sx * 0.75, 12, 30 + sz * 0.75, 0.1, 13, 0.1, 'post', false);
    addBlock(14, 25, 30, 0.5, 0.5, 0.5, 'glowR', false);
    // ---- the outpost (south / middle): cabins, a garage, crates, snowmobiles, snowdrifts you can step onto ----
    cabin(-6, 46, 10, 6, true); cabin(18, 50, 8, 6, true); cabin(-30, 44, 6, 9, false);
    addBlock(30, 0, 48, 10, 4.6, 8, 'olive'); addBlock(30, 4.6, 48, 10.6, 0.4, 8.6, 'snow'); addBlock(30, 0, 43.96, 6, 3.6, 0.1, 'rubber', false);   // garage
    for (const [x, z, ax] of [[2, 28, true], [-18, 30, false], [26, 6, true]]) {           // snowmobiles
        addBlock(x, 0, z, ax ? 2.6 : 1.1, 0.7, ax ? 1.1 : 2.6, 'accY'); addBlock(x, 0.7, z, ax ? 1.2 : 0.9, 0.5, ax ? 0.9 : 1.2, 'rubber');
    }
    for (const [x, z] of [[8, 14], [-4, 20], [16, -8], [-2, -16], [24, -40], [-8, -34]]) addStructure('crates', x, z, Math.floor(Math.random() * 4));
    for (const [x, z, w, d] of [[0, 4, 9, 4], [10, -24, 6, 3], [-4, -40, 8, 4], [24, 14, 4, 7], [-36, 34, 8, 4], [52, -2, 5, 8]]) {
        addBlock(x, 0, z, w, 0.5, d, 'snow'); addBlock(x + 0.3, 0.5, z, w * 0.6, 0.5, d * 0.6, 'snow');
    }
    for (const [x, z, h] of [[6, -6, 2.6], [-6, 8, 1.4], [12, 4, 3.2], [-2, -26, 2], [20, -16, 1.2]]) { addBlock(x, 0, z, 1.4, h, 3.4, 'concrete'); addBlock(x, h, z, 1.6, 0.25, 3.6, 'snow', false); }   // concrete barriers
    // ---- pines all round the edge, a few in the middle ----
    for (const [x, z] of [[-60, -40], [-50, -58], [-62, 30], [-56, 52], [-44, 60], [60, -56], [62, 48], [56, 60], [-62, -8], [62, 8], [-6, 60], [8, 62], [-24, 58], [-58, -24], [26, 62]]) snowPine(x, z, 0.9 + Math.random() * 0.3);
    for (const [x, z] of [[-4, 16], [22, 24], [-8, -8]]) snowPine(x, z, 0.75);
    lampRing([[22, 6, 0.3], [46, 8, 0.6]]);
}

// CARNIVAL: Ferris wheel (north), carousel (middle), big-top tent (east), game stalls (west), roller-coaster track on stilts (south)
function stripeWall(x0, z0, x1, z1, y, h, gaps = []) {        // red and white vertical stripes, one solid wall for collision
    const alongX = Math.abs(z1 - z0) < 0.01, len = alongX ? x1 - x0 : z1 - z0, n = Math.max(1, Math.round(Math.abs(len) / 1.2)), st = len / n;
    for (let i = 0; i < n; i++) {
        const t = (i + 0.5) * st, c = alongX ? x0 + t : z0 + t;
        if (gaps.some(([g, w]) => Math.abs(c - g) < w / 2)) continue;
        addBlock(alongX ? c : x0, y, alongX ? z0 : c, alongX ? Math.abs(st) : 0.3, h, alongX ? 0.3 : Math.abs(st), i % 2 ? 'paint' : 'tentR');
    }
}
function stringLights(x0, y0, z0, x1, y1, z1, n, keys = ['glowY', 'glowP', 'glowC', 'glowL']) {
    for (let i = 0; i <= n; i++) { const t = i / n, sag = Math.sin(Math.PI * t) * 0.8; addBlock(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - sag, z0 + (z1 - z0) * t, 0.22, 0.22, 0.22, keys[i % keys.length], false); }
}
function mapCarnival() {
    spawnPt = [0, 18];
    // ---- ground: a dirt midway down the middle, paths of boards ----
    addBlock(0, 0, 0, 14, 0.015, 120, 'sand', false); addBlock(0, 0, -2, 110, 0.015, 10, 'sand', false);
    // ---- FERRIS WHEEL (north): A-frame legs, a hub, a dotted rim of lights, spokes and gondolas (scenery above head height) ----
    const FX = 0, FZ = -46, FY = 17, R = 13;
    for (const s of [-1, 1]) for (const dz of [-1.6, 1.6]) {
        for (let k = 0; k <= 16; k++) { const t = k / 16; addBlock(FX + s * (6 - 6 * t), t * FY, FZ + dz, 0.7, 1.15, 0.7, 'steel', k < 3); }
    }
    addBlock(FX, FY - 0.8, FZ, 1.6, 1.6, 4.2, 'steel', false); addBlock(FX, FY - 0.5, FZ - 2.2, 1, 1, 0.2, 'glowY', false);
    const NR = 44;
    for (let i = 0; i < NR; i++) { const a = i / NR * Math.PI * 2; addBlock(FX + Math.cos(a) * R, FY + Math.sin(a) * R - 0.3, FZ, 0.75, 0.6, 0.75, i % 2 ? 'glowY' : 'glowP', false); }
    for (let k = 0; k < 12; k++) {
        const a = k / 12 * Math.PI * 2;
        for (let r = 2; r < R; r += 1.7) addBlock(FX + Math.cos(a) * r, FY + Math.sin(a) * r - 0.15, FZ, 0.3, 0.3, 0.3, 'steel', false);
        const gx = FX + Math.cos(a) * R, gy = FY + Math.sin(a) * R;
        if (gy - 2.6 > 2.2) { addBlock(gx, gy - 2.6, FZ, 1.8, 1.6, 2.2, ['accR', 'accB', 'accG', 'accY'][k % 4], false); addBlock(gx, gy - 1.0, FZ, 0.1, 1, 0.1, 'post', false); }
    }
    addBlock(FX, 0, FZ + 6, 8, 0.6, 3, 'woodDark'); addBlock(FX, 0, FZ + 4, 6, 1.2, 1, 'accR'); addBlock(FX, 0, FZ + 8.4, 3, 0.3, 2, 'wood');   // boarding platform
    // ---- CAROUSEL (middle): a round-ish platform, poles with horses, a striped canopy you can't climb onto ----
    addBlock(0, 0, 0, 12, 0.5, 12, 'woodDark'); addBlock(0, 0, 0, 14.4, 0.5, 6, 'woodDark'); addBlock(0, 0, 0, 6, 0.5, 14.4, 'woodDark');
    addBlock(0, 0.5, 0, 2.4, 5.2, 2.4, 'accY');
    for (let k = 0; k < 10; k++) {
        const a = k / 10 * Math.PI * 2, x = Math.cos(a) * 4.6, z = Math.sin(a) * 4.6, h = 0.9 + (k % 2) * 0.5;
        addBlock(x, 0.5, z, 0.12, 4.8, 0.12, 'accY', false);
        addBlock(x, 0.5 + h, z, 0.5, 0.7, 1.4, k % 3 ? 'paint' : 'brickDark', true); addBlock(x, 1.2 + h, z - 0.6, 0.4, 0.6, 0.4, k % 3 ? 'paint' : 'brickDark', false);
    }
    for (const [s, y, key] of [[15, 5.7, 'tentR'], [12, 6.3, 'paint'], [9, 6.9, 'tentR'], [5.6, 7.5, 'paint'], [2, 8.1, 'tentY']]) addBlock(0, y, 0, s, 0.6, s, key);
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; addBlock(Math.cos(a) * 7.4, 5.5, Math.sin(a) * 7.4, 0.3, 0.3, 0.3, k % 2 ? 'glowY' : 'glowW', false); }
    // ---- BIG TOP (east): a striped tent with three doors, tiered roof, a circus ring and stands inside ----
    const TX = 42, TZ = 8, TW = 22;
    stripeWall(TX - TW / 2, TZ - TW / 2, TX + TW / 2, TZ - TW / 2, 0, 5, [[TX, 3]]);
    stripeWall(TX - TW / 2, TZ + TW / 2, TX + TW / 2, TZ + TW / 2, 0, 5, [[TX - 4, 3]]);
    stripeWall(TX - TW / 2, TZ - TW / 2, TX - TW / 2, TZ + TW / 2, 0, 5, [[TZ, 3.4]]);
    stripeWall(TX + TW / 2, TZ - TW / 2, TX + TW / 2, TZ + TW / 2, 0, 5, []);
    for (const [s, y, key] of [[TW + 1, 5, 'tentR'], [TW - 4, 6.2, 'paint'], [TW - 9, 7.4, 'tentR'], [TW - 14, 8.6, 'paint']]) addBlock(TX, y, TZ, s, 1.2, s, key);
    addBlock(TX, 9.8, TZ, 0.3, 3, 0.3, 'post', false); addBlock(TX + 0.8, 11.8, TZ, 1.4, 0.8, 0.06, 'tentY', false);
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; addBlock(TX + Math.cos(a) * 4, 0, TZ + Math.sin(a) * 4, 1.2, 0.5, 1.2, k % 2 ? 'tentR' : 'paint'); }
    for (const [x, z] of [[TX + 8, TZ - 6], [TX + 8, TZ + 6], [TX - 7, TZ + 7]]) { addBlock(x, 0, z, 3, 0.5, 4, 'wood'); addBlock(x + 0.5, 0.5, z, 2, 0.5, 4, 'wood'); addBlock(x + 1, 1, z, 1, 0.5, 4, 'wood'); }
    addCeilingLight(TX, TZ, 0, 4.9, 10, true, 1.4);
    // ---- GAME STALLS (west): two rows of booths with striped awnings, counters, prize shelves and glowing signs ----
    for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) {
        const x = -44 + sx * 7, z = -21 + i * 11, f = -sx;          // f: the way the counter faces (toward the aisle)
        addBlock(x - f * 1.8, 0, z, 0.4, 3.4, 6, 'wood'); addBlock(x, 0, z - 2.9, 4, 3.4, 0.3, 'wood'); addBlock(x, 0, z + 2.9, 4, 3.4, 0.3, 'wood');
        addBlock(x + f * 1.6, 0, z, 0.8, 1.1, 5.4, i % 2 ? 'accB' : 'accR');
        for (let k = 0; k < 4; k++) addBlock(x + f * 2.6, 3.4 - k * 0.12, z - 2.25 + k * 1.5, 1.8, 0.2, 1.5, k % 2 ? 'paint' : 'tentR', false);
        addBlock(x, 3.4, z, 4.2, 0.25, 6.2, 'woodDark');
        for (let k = 0; k < 5; k++) addBlock(x - f * 1.3, 1.6 + (k % 2) * 0.7, z - 2 + k, 0.4, 0.4, 0.4, ['glowP', 'glowY', 'glowC', 'glowL', 'glowR'][(k + i) % 5], false);
        addBlock(x + f * 0.4, 3.9, z, 0.08, 0.8, 3.4, ['glowY', 'glowP', 'glowC', 'glowL'][i], false);
    }
    stringLights(-51, 4.6, -26, -51, 4.6, 26, 26); stringLights(-37, 4.6, -26, -37, 4.6, 26, 26);
    // ---- ROLLER COASTER (south): a track deck 6m up on stilts, all round a loop, ramps at both ends, a parked train ----
    const Y = 6, Z0 = 32, Z1 = 56, X0 = -52, X1 = 52, D = 3.2;
    addBlock(0, Y - 0.35, Z0, X1 - X0 + D, 0.35, D, 'steel'); addBlock(0, Y - 0.35, Z1, X1 - X0 + D, 0.35, D, 'steel');
    addBlock(X0, Y - 0.35, (Z0 + Z1) / 2, D, 0.35, Z1 - Z0 - D, 'steel'); addBlock(X1, Y - 0.35, (Z0 + Z1) / 2, D, 0.35, Z1 - Z0 - D, 'steel');
    for (const z of [Z0, Z1]) for (const s of [-1, 1]) addBlock(0, Y, z + s * 0.6, X1 - X0 + D, 0.12, 0.14, 'accR', false);      // the rails
    for (const x of [X0, X1]) for (const s of [-1, 1]) addBlock(x + s * 0.6, Y, (Z0 + Z1) / 2, 0.14, 0.12, Z1 - Z0, 'accR', false);
    for (let x = X0; x <= X1; x += 8) for (const z of [Z0, Z1]) addBlock(x, 0, z, 0.6, Y - 0.35, 0.6, 'accY');
    for (let z = Z0 + 8; z < Z1; z += 8) for (const x of [X0, X1]) addBlock(x, 0, z, 0.6, Y - 0.35, 0.6, 'accY');
    railLine(X0 - D / 2, Z0 + D / 2, X1 + D / 2, Z0 + D / 2, Y, [[-30, 3.4], [30, 3.4]], 'steel'); railLine(X0 + D / 2, Z1 - D / 2, X1 - D / 2, Z1 - D / 2, Y, [], 'steel');
    railLine(X0 - D / 2, Z1 + D / 2, X1 + D / 2, Z1 + D / 2, Y, [], 'steel');
    stairRun(-30, Z0 - 13.5, -30, Z0 - D / 2, 0, Y, 3, ['wood', 'woodDark']); stairSides(-30, Z0 - 13.5, -30, Z0 - D / 2, 0, Y, 3, [-1, 1], 'steel');
    stairRun(30, Z0 - 13.5, 30, Z0 - D / 2, 0, Y, 3, ['wood', 'woodDark']); stairSides(30, Z0 - 13.5, 30, Z0 - D / 2, 0, Y, 3, [-1, 1], 'steel');
    // the lift hill: a higher hump in the middle of the far side, a short climb you can jump over
    for (let i = -3; i <= 3; i++) addBlock(i * 2.2, Y, Z1, 2.2, 0.5 * (4 - Math.abs(i)), D, 'steel');
    for (let k = 0; k < 4; k++) addBlock(-40 + k * 2.4, Y, Z0, 2.2, 1.1, 1.8, ['accB', 'accY', 'accG', 'accR'][k], false);    // the parked train
    stringLights(X0, Y + 2.2, Z0 - 1.8, X1, Y + 2.2, Z0 - 1.8, 40, ['glowY', 'glowW']);
    // ---- the midway: ticket booth, food carts, bumper cars, a test-your-strength tower, strings of lights ----
    addBlock(0, 0, 58, 4, 3, 3, 'tentR'); addBlock(0, 3, 58, 4.6, 0.4, 3.6, 'tentY'); addBlock(0, 1.4, 56.46, 1.6, 0.9, 0.06, 'glowW', false);
    for (const [x, z, k] of [[-14, 14, 'accR'], [14, -14, 'accB'], [-16, -18, 'accG'], [18, 20, 'tentY']]) { addBlock(x, 0, z, 3.4, 1.8, 2, k); addBlock(x, 1.8, z, 3.8, 0.12, 2.4, 'paint'); for (const s of [-1, 1]) addBlock(x + s * 1.6, 1.9, z, 0.1, 1.2, 0.1, 'post', false); addBlock(x, 3.1, z, 3.8, 0.3, 2.4, k); }
    addBlock(20, 0, -22, 14, 0.4, 10, 'rubber'); railLine(13, -27, 27, -27, 0.4, [[20, 3]], 'steel'); railLine(13, -17, 27, -17, 0.4, [], 'steel');      // bumper car floor
    for (const [x, z, k] of [[17, -24, 'accR'], [22, -20, 'accB'], [24, -25, 'accG'], [16, -19, 'accY']]) { addBlock(x, 0.4, z, 1.6, 0.7, 2, k); addBlock(x, 1.1, z + 0.4, 1, 0.4, 0.6, 'rubber'); }
    addBlock(-22, 0, 28, 1.2, 10, 1.2, 'paint'); addBlock(-22, 10, 28, 1.8, 1.4, 1.8, 'glowR', false); for (let y = 1; y < 10; y += 1.5) addBlock(-22, y, 28.62, 0.8, 0.12, 0.05, 'glowY', false);
    for (const [x, z] of [[-8, -24], [8, 24], [-26, 0], [26, -2], [-10, 30], [12, -32]]) addStructure('crates', x, z, Math.floor(Math.random() * 4));
    for (const [x0, z0, x1, z1] of [[-6, -30, -6, 26], [6, -30, 6, 26]]) { for (let z = z0; z <= z1; z += 14) addBlock(x0, 0, z, 0.25, 5.5, 0.25, 'post'); stringLights(x0, 5.4, z0, x1, 5.4, z1, 30); }
    lampRing([[30, 6, 0.4], [50, 8, 0.2]]);
}

// ---------- light snowfall on Frostbite: one Points cloud that follows the camera, flakes drift down in the shader ----------
let snowMesh = null;
function updateSnow(dt) {
    const want = currentMap === 'frostbite' && currentGameState === 'playing';
    if (!want) { if (snowMesh) snowMesh.visible = false; return; }
    if (!snowMesh) {
        const n = 900, pos = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 60; pos[i * 3 + 1] = Math.random() * 24; pos[i * 3 + 2] = (Math.random() - 0.5) * 60; }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const m = new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 }, uCam: { value: new V3() } }, transparent: true, depthWrite: false,
            vertexShader: `uniform float uTime; uniform vec3 uCam; void main() {
                vec3 p = position; p.y = mod(p.y - uTime * 1.6, 24.0); p.x += sin(uTime * 0.7 + position.z) * 0.8;
                p.xz = mod(p.xz - uCam.xz + 30.0, 60.0) - 30.0 + uCam.xz; p.y += uCam.y - 10.0;
                vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = clamp(60.0 / -mv.z, 1.5, 6.0); gl_Position = projectionMatrix * mv; }`,
            fragmentShader: `void main() { vec2 c = gl_PointCoord - 0.5; float a = 1.0 - smoothstep(0.2, 0.5, length(c)); gl_FragColor = vec4(0.95, 0.97, 1.0, a * 0.85); }`
        });
        snowMesh = new THREE.Points(g, m); snowMesh.frustumCulled = false; scene.add(snowMesh);
    }
    snowMesh.visible = true;
    snowMesh.geometry.setDrawRange(0, Q && Q.lite ? 450 : 900);
    snowMesh.material.uniforms.uTime.value += dt;
    snowMesh.material.uniforms.uCam.value.copy(camera.position);
}
