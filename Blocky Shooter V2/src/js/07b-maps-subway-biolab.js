// ---------- 5.0 SUBWAY (night station) and BIOLAB (campaign finale arena) ----------
// Built with the 4.0 map kit (addBlock / railLine / stairRun / addCeilingLight ...). Floor vents are registered in ventSpots:
// Vent Crawlers hide in them. Navigation and spawns come from the solids, as on every other map.
function ventGrate(x, z, y0 = 0) {
    addBlock(x, y0, z, 1.9, 0.05, 1.9, 'rubber', false);
    for (let i = -2; i <= 2; i++) addBlock(x, y0 + 0.05, z + i * 0.32, 1.5, 0.03, 0.09, 'glowY', false);
    ventSpots.push([x, z]);
}
// a train car lying along x: body, lit windows, dark doors, roof gear and head/tail lights
function trainCar(cx, cz, len, key, lit = true) {
    addBlock(cx, 0.3, cz, len, 3.35, 3.2, key);
    addBlock(cx, 3.65, cz, len - 0.5, 0.18, 2.7, 'steel', false);
    for (const s of [-1, 1]) {
        const z = cz + s * 1.63;
        if (lit) for (let k = -2; k <= 2; k++) if (k && Math.random() < 0.8) addBlock(cx + k * len / 6, 2.1, z, len / 8, 0.9, 0.06, 'glowW', false);
        for (const d of [-1, 1]) addBlock(cx + d * len * 0.28, 0.5, z, 1.5, 2.6, 0.07, 'rubber', false);
        addBlock(cx, 0.9, z, len - 0.4, 0.14, 0.08, 'accY', false);
    }
    for (let k = -1; k <= 1; k++) addBlock(cx + k * 4.2, 3.83, cz, 1.6, 0.35, 1.2, 'concreteDark', false);
}
function mapSubway() {
    const PH = 1.0;                       // platform height
    spawnPt = [-8, 36];
    // ---- ground: street asphalt, station floor under the canopy ----
    for (const z of [38, -38]) { addBlock(0, 0, z, 128, 0.012, 11, 'asphalt', false); for (let x = -60; x <= 60; x += 9) addBlock(x, 0, z, 4, 0.016, 0.25, 'paint', false); }
    // ---- tracks (two), rails and sleepers ----
    for (const tz of [-14, 14]) {
        addBlock(0, 0, tz, 128, 0.04, 4.4, 'asphalt', false);
        for (const s of [-1, 1]) addBlock(0, 0.04, tz + s * 0.75, 128, 0.14, 0.12, 'steel', false);
        for (let x = -62; x <= 62; x += 2.6) addBlock(x, 0.04, tz, 0.4, 0.07, 2.7, 'woodDark', false);
        for (const sx of [-1, 1]) {      // tunnel mouths in the end walls (dark, with red signal lamps)
            addBlock(sx * 62.6, 0, tz, 1.6, 6.5, 8, 'bound'); addBlock(sx * 61.7, 5.2, tz, 0.2, 0.3, 0.3, 'glowR', false); addBlock(sx * 61.7, 0.9, tz + 3, 0.2, 0.3, 0.3, 'glowL', false);
        }
    }
    // ---- trains: one stopped on each track, open at the far ends so you can walk round them ----
    const keys = ['accB', 'steel', 'accR'];
    [-44, -28, -12].forEach((x, i) => trainCar(x, -14, 15, keys[i % 3]));
    [12, 28, 44].forEach((x, i) => trainCar(x, 14, 15, keys[(i + 1) % 3]));
    // ---- island platform, safety lines, stairs at both ends, benches ----
    addBlock(0, 0, 0, 112, PH, 14, 'stone');
    for (const s of [-1, 1]) { addBlock(0, PH, s * 6.5, 112, 0.02, 0.5, 'accY', false); addBlock(0, PH - 0.4, s * 7.04, 112, 0.1, 0.08, 'glowY', false); }
    for (const sx of [-1, 1]) { stairRun(sx * 64, 0, sx * 56, 0, 0, PH, 5, ['stone', 'concreteDark']); }
    for (const x of [-42, -22, 22, 42]) for (const z of [-3, 3]) bench(x, z, true, PH);
    // canopy on steel columns with hanging lights and a station sign
    for (let x = -48; x <= 48; x += 16) for (const z of [-4.5, 4.5]) addBlock(x, PH, z, 0.9, 6.0, 0.9, 'steel');
    addBlock(0, PH + 6.0, 0, 108, 0.5, 15, 'concreteDark');
    for (let x = -48; x <= 48; x += 16) addCeilingLight(x, 0, PH, 5.9, 11, x % 32 === 0, 2.2);
    for (const [z, d] of [[-7.7, -1], [7.7, 1]]) { addBlock(0, PH + 4.4, z, 20, 1.5, 0.1, 'accB', false); pixelText('METRO', -7.5, PH + 4.55, z + d * 0.07, 0.24, 'x', 1, 'paint', 0.05); }
    // ---- footbridge over both tracks (x = 0) with stairs down to the street and up from the platform ----
    addBlock(0, 4.7, 0, 4, 0.3, 48, 'steel');
    railLine(-2, -24, -2, 24, 5.0, [], 'glass'); railLine(2, -24, 2, 24, 5.0, [[0, 2.2]], 'glass');
    for (const z of [-10, 10]) addBlock(0, 0, z, 1.0, 4.7, 1.0, 'steel');
    for (const s of [-1, 1]) { stairRun(0, s * 38, 0, s * 24, 0, 5, 3.6, ['concrete', 'concreteDark']); stairSides(0, s * 38, 0, s * 24, 0, 5, 3.6, [-1, 1], 'steel'); }
    stairRun(14, 0, 2.5, 0, PH, 5, 3, ['concrete', 'concreteDark']); stairSides(14, 0, 2.5, 0, PH, 5, 3, [-1, 1], 'steel');
    // ---- street level: ruined buildings with lit windows, entrance kiosks, cars, barriers ----
    [[-48, 56, 24, 12, 14], [-16, 56, 18, 12, 10], [18, 56, 22, 12, 16], [50, 56, 20, 12, 12], [-50, -56, 20, 12, 12], [-18, -56, 22, 12, 16], [16, -56, 18, 12, 10], [48, -56, 24, 12, 14]]
        .forEach(([x, z, w, d, h], i) => { building(x, z, w, d, h, i % 2 ? 'brick' : 'concreteDark'); });
    for (const [x, z] of [[-34, 28], [34, -28], [-34, -46], [34, 46]]) {          // entrance kiosks with a glowing M
        addBlock(x, 0, z, 5, 3.2, 4, 'plaster'); addBlock(x, 3.2, z, 5.6, 0.3, 4.6, 'accR'); addBlock(x, 3.5, z, 1.4, 1.4, 0.2, 'glowY', false);
        addBlock(x, 0, z + (z > 0 ? -2.05 : 2.05), 2.2, 2.6, 0.08, 'rubber', false);
    }
    for (const [x, z, ax] of [[-14, 30, true], [24, 44, true], [-26, -32, false], [10, -46, true], [-50, 40, false], [52, -40, false]]) parkedCar(x, z, ax, 1);
    for (const [x, z, ax] of [[-6, 24, true], [8, 24, true], [-8, -24, true], [6, -24, true], [-56, 32, false], [56, -32, false], [30, 30, true], [-30, -30, true]]) addBlock(x, 0, z, ax ? 3.2 : 0.8, 1.1, ax ? 0.8 : 3.2, 'concrete');
    for (const [x, z] of [[-22, 46], [44, 34], [-44, -34], [20, -34]]) { addBlock(x, 0, z, 2.2, 1.3, 1.1, 'accG'); }
    for (const [x, z] of [[-60, 30], [-30, 30], [0, 30], [30, 30], [60, 30], [-60, -30], [-30, -30], [0, -30], [30, -30], [60, -30], [-18, 46], [18, -46]]) if (!pointInSolid(new V3(x, 1, z), 1.6)) addLamp(x, z);
    // ---- floor vents: where the Vent Crawlers hide ----
    for (const [x, z, y] of [[-36, 2.5, PH], [-10, -2.5, PH], [16, 2.5, PH], [38, -2.5, PH], [-20, 0, 0], [20, 0, 0], [-52, 20, 0], [52, -20, 0], [-30, 34, 0], [30, -34, 0], [0, 44, 0], [0, -44, 0], [-52, -34, 0], [52, 34, 0]]) ventGrate(x, z, y);
}
// BIOLAB: a containment pit in a ring of catwalks, with quarantine pods in the corners, pillars with green lights and floor vents
function mapBiolab() {
    spawnPt = [0, 36];
    addBlock(0, 0, 0, 90, 0.02, 90, 'tile', false);
    for (const r of [4, 7.6]) for (const s of [-1, 1]) { addBlock(0, 0.02, s * r, r * 2 + 0.6, 0.02, 0.3, 'glowL', false); addBlock(s * r, 0.02, 0, 0.3, 0.02, r * 2 + 0.6, 'glowL', false); }
    addBlock(0, 0, 0, 5, 0.7, 5, 'steel'); addBlock(0, 0.7, 0, 3.2, 0.12, 3.2, 'glowL', false);              // central containment plinth
    // pillars with green strip lights, and cover walls
    for (const [x, z] of [[-18, -18], [18, -18], [-18, 18], [18, 18], [0, -24], [0, 24], [-26, 0], [26, 0]]) {
        addBlock(x, 0, z, 2.4, 9, 2.4, 'concrete'); addBlock(x, 0.6, z, 2.5, 0.25, 2.5, 'accY', false);
        for (const s of [-1, 1]) { addBlock(x + s * 1.22, 1, z, 0.06, 7.4, 0.5, 'glowL', false); addBlock(x, 1, z + s * 1.22, 0.5, 7.4, 0.06, 'glowL', false); }
        addCeilingLight(x, z, 0, 9, 9, false, 1.2);
    }
    for (const [x, z, ax] of [[-10, -9, true], [10, 9, true], [-9, 10, false], [9, -10, false], [-30, -26, true], [30, 26, true], [-30, 26, true], [30, -26, true]]) addBlock(x, 0, z, ax ? 5 : 1, 1.2, ax ? 1 : 5, 'concrete');
    for (const [x, z] of [[-34, -34], [34, -34], [-34, 34], [34, 34]]) {                 // quarantine pods: glass tubes with a sick green glow
        addBlock(x, 0, z, 6, 0.6, 6, 'steel'); addBlock(x, 0.6, z, 4.6, 4.4, 4.6, 'glass', false); addBlock(x, 0.6, z, 1.6, 4.0, 1.6, 'glowL', false); addBlock(x, 5, z, 6, 0.6, 6, 'steel');
        addBlock(x, 0.6, z, 4.8, 0.3, 4.8, 'steel', false);
    }
    // catwalk ring at y = 4 (decks 6 wide), stairs from the floor at two corners, steel rails on the inner edge
    addBlock(0, 3.6, -40, 86, 0.4, 6, 'steel'); addBlock(0, 3.6, 40, 86, 0.4, 6, 'steel'); addBlock(-40, 3.6, 0, 6, 0.4, 74, 'steel'); addBlock(40, 3.6, 0, 6, 0.4, 74, 'steel');
    railLine(-37, -37, 37, -37, 4.0, [[-24, 2.2]], 'steel'); railLine(-37, 37, 37, 37, 4.0, [[24, 2.2]], 'steel');
    railLine(-37, -37, -37, 37, 4.0, [], 'steel'); railLine(37, -37, 37, 37, 4.0, [], 'steel');
    stairRun(-24, -26, -24, -37, 0, 4, 3.4, ['steel', 'concreteDark']); stairSides(-24, -26, -24, -37, 0, 4, 3.4, [-1, 1], 'steel');
    stairRun(24, 26, 24, 37, 0, 4, 3.4, ['steel', 'concreteDark']); stairSides(24, 26, 24, 37, 0, 4, 3.4, [-1, 1], 'steel');
    for (let t = -32; t <= 32; t += 16) for (const [x, z] of [[t, -40], [t, 40], [-40, t], [40, t]]) addBlock(x, 0, z, 1, 3.6, 1, 'steel');
    for (let t = -40; t <= 40; t += 8) { addBlock(t, 4.0, -42.9, 3, 0.1, 0.1, 'glowR', false); addBlock(t, 4.0, 42.9, 3, 0.1, 0.1, 'glowR', false); }
    for (const [x, z] of [[-12, 0], [12, 0], [0, -14], [0, 14], [-22, -8], [22, 8], [-8, 22], [8, -22]]) ventGrate(x, z, 0);
    for (const [x, z] of [[-30, 36], [30, -36], [-36, -12], [36, 12]]) addLamp(x, z);
}
