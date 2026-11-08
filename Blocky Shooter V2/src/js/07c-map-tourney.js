// ---------- TOURNAMENT ARENA (5.3 rebuild): a floodlit duel stadium (hidden map: only the Tournament mode uses it) ----------
// A 30 x 44 sunken pit, mirror-symmetric both ways, so neither duelist gets a better side:
//   - each end: a raised spawn pad behind a low shield wall, two tall crates in the corners
//   - the middle: a plinth with a tall pillar that blocks the spawn-to-spawn sight line, low walls on the centre line
//   - both flanks: a 2.5 m catwalk with stairs at each end (the high ground), glass rails you can shoot through
//   - tall pillars and half walls in between, so cover comes at three heights (1.2, 2.5, 4+)
// Round it: stepped stands on both long sides, team-coloured glow strips along the pit walls, two lighting trusses
// over the pit (real lamp lights on High) and a big screen over each end. Spectators are invisible now, so the stands are scenery;
// they still give the free camera a nice place to start. Everything is plain blocks, merged into one mesh per material.
const TOURNEY = { pitX: 15, pitZ: 22, wallH: 4.2, deckY: 6.0, spawns: [[0, -19.2], [0, 19.2]] };
// spectator start spots: on the middle tier of the two stands, 4 a side
const tourneySeat = (i, n) => { const side = i % 2 ? 1 : -1, k = Math.floor((i % 8) / 2); return [side * 22.75, -12 + k * 8, TOURNEY.deckY]; };
function tourneyFloorTex() {
    const [c, g] = makeCanvas(512);
    const gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, '#3b1d24'); gr.addColorStop(0.32, '#262a35'); gr.addColorStop(0.68, '#262a35'); gr.addColorStop(1, '#1d2a44');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 2;
    for (let i = 0; i <= 512; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; g.fillRect(Math.random() * 512, Math.random() * 512, 3, 3); }
    g.strokeStyle = 'rgba(253,224,71,0.55)'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(0, 256); g.lineTo(512, 256); g.stroke();
    g.beginPath(); g.arc(256, 256, 70, 0, 6.3); g.stroke();
    g.strokeStyle = 'rgba(239,68,68,0.6)'; g.strokeRect(150, 6, 212, 92);
    g.strokeStyle = 'rgba(59,130,246,0.6)'; g.strokeRect(150, 414, 212, 92);
    g.font = '900 34px sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,0.13)';
    g.save(); g.translate(256, 160); g.fillText('BLOCKY CUP', 0, 0); g.restore();
    g.save(); g.translate(256, 352); g.rotate(Math.PI); g.fillText('BLOCKY CUP', 0, 0); g.restore();
    return canvasTex(c);
}
function tourneyBanner(col, col2) {
    const [c, g] = makeCanvas(128);
    g.fillStyle = col; g.fillRect(0, 0, 128, 128); g.fillStyle = col2; g.fillRect(0, 0, 128, 12); g.fillRect(0, 116, 128, 12); g.fillRect(8, 0, 6, 128); g.fillRect(114, 0, 6, 128);
    g.fillStyle = '#fde68a'; g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 14 : 34, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(64 + Math.cos(a) * r, 58 + Math.sin(a) * r); } g.closePath(); g.fill();
    g.font = '900 15px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fde68a'; g.fillText('BLOCKY', 64, 108);
    return canvasTex(c);
}
function tourneyScreenTex(col) {
    const [c, g] = makeCanvas(256);
    g.fillStyle = '#05070d'; g.fillRect(0, 0, 256, 256);
    const gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, col); gr.addColorStop(1, '#111827');
    g.fillStyle = gr; g.fillRect(10, 64, 236, 128);
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 64; y < 192; y += 4) g.fillRect(10, y, 236, 1);
    g.fillStyle = '#fde047'; g.font = '900 38px sans-serif'; g.textAlign = 'center'; g.fillText('BLOCKY', 128, 118); g.fillStyle = '#fff'; g.font = '900 30px sans-serif'; g.fillText('CUP', 128, 160);
    g.strokeStyle = col; g.lineWidth = 6; g.strokeRect(4, 58, 248, 140);
    return canvasTex(c);
}
function mapTourney() {
    const X = TOURNEY.pitX, Z = TOURNEY.pitZ, WH = TOURNEY.wallH, W = worldGroup;
    spawnPt = [TOURNEY.spawns[0][0], TOURNEY.spawns[0][1]];
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); W.add(m); return m; };
    // mirrored placement helpers: both sides of x = 0 and/or z = 0
    const mx = (fn) => { fn(1); fn(-1); };
    const m4 = (fn) => { for (const sx of [1, -1]) for (const sz of [1, -1]) fn(sx, sz); };
    // ---- the pit floor and walls ----
    const fl = add(new THREE.PlaneGeometry(2 * X, 2 * Z), new THREE.MeshLambertMaterial({ map: tourneyFloorTex() }), 0, 0.02, 0); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true;
    mx(s => { addBlock(0, 0, s * (Z + 0.5), 2 * X + 2, WH, 1, 'concreteDark'); addBlock(s * (X + 0.5), 0, 0, 1, WH, 2 * Z, 'concreteDark'); });
    // team glow strips along the top of the walls: red half (z < 0), blue half (z > 0)
    mx(s => {
        const g = s < 0 ? 'glowR' : 'glowB';
        addBlock(0, WH, s * (Z + 0.05), 2 * X, 0.14, 0.12, g, false); addBlock(0, 1.2, s * (Z - 0.03), 2 * X, 0.08, 0.06, g, false);
        mx(sx => { addBlock(sx * (X + 0.05), WH, s * Z / 2, 0.12, 0.14, Z, g, false); addBlock(sx * (X - 0.03), 1.2, s * Z / 2, 0.06, 0.08, Z, g, false); });
    });
    // tunnel mouths in the end walls (behind each spawn)
    mx(s => { addBlock(0, 0, s * (Z - 0.02), 4.4, 3.0, 0.06, 'rubber', false); addBlock(0, 3.0, s * (Z - 0.05), 5.0, 0.18, 0.1, s < 0 ? 'glowR' : 'glowB', false); });
    // ---- spawn ends ----
    mx(s => {
        addBlock(0, 0, s * 19.75, 8, 0.6, 4.5, 'concrete');                                 // spawn pad
        addBlock(0, 0.6, s * 21.7, 8, 0.06, 0.4, s < 0 ? 'accR' : 'accB', false);
        addBlock(0, 0, s * 15.6, 6, 1.3, 0.8, 'concreteDark');                               // shield wall
        addBlock(0, 1.3, s * 15.6 - s * 0.42, 6.0, 0.08, 0.1, s < 0 ? 'glowR' : 'glowB', false);
        mx(sx => {
            addBlock(sx * 9.5, 0, s * 19.2, 2.2, 2.4, 2.2, s < 0 ? 'accR' : 'accB');       // tall corner crates + a step crate
            addBlock(sx * 11.3, 0, s * 18.4, 1.3, 1.2, 1.3, 'woodDark');
            addBlock(sx * 4.6, 0, s * 13.2, 1.2, 1.2, 1.2, 'woodDark');                      // low crate covering the pad exits
        });
    });
    // ---- the middle: plinth + pillar, centre-line walls ----
    addBlock(0, 0, 0, 7, 0.9, 7, 'concrete');
    mx(s => { addBlock(s * 4.1, 0, 0, 1.2, 0.45, 3, 'concreteDark'); addBlock(0, 0, s * 4.1, 3, 0.45, 1.2, 'concreteDark'); });     // steps onto the plinth
    addBlock(0, 0.9, 0, 2.2, 3.6, 2.2, 'stone'); addBlock(0, 4.5, 0, 2.6, 0.25, 2.6, 'concrete', false); addBlock(0, 4.75, 0, 1.0, 0.12, 1.0, 'glowY', false);
    m4((sx, sz) => addBlock(sx * 2.85, 0.9, sz * 2.85, 1.2, 1.0, 1.2, 'concreteDark'));         // knee-high cover on the plinth corners
    mx(s => addBlock(s * 8.2, 0, 0, 0.9, 1.25, 3.4, 'concreteDark'));
    // ---- mid-field cover at three heights ----
    m4((sx, sz) => {
        addBlock(sx * 6.4, 0, sz * 9.2, 1.7, 4.6, 1.7, 'stone'); addBlock(sx * 6.4, 4.6, sz * 9.2, 2.1, 0.25, 2.1, 'concrete', false);   // tall pillars
        addBlock(sx * 5.2, 0, sz * 4.8, 3.2, 1.2, 0.8, 'concreteDark');                                                              // half walls
    });
    // ---- the flank catwalks: 2.5 m high, stairs down at both ends, glass rail on the inside ----
    const CY = 2.5, CW = 3, cx = X - CW / 2 - 0.05;
    mx(sx => {
        addBlock(sx * cx, CY - 0.3, 0, CW, 0.3, 14, 'steel');
        addBlock(sx * (cx - CW / 2 + 0.06), CY, 0, 0.12, 1.0, 14, 'glass'); addSolid(sx * (cx - CW / 2 + 0.06), CY, 0, 0.12, 1.0, 14, true);
        addBlock(sx * (cx - CW / 2 + 0.06), CY + 1.0, 0, 0.16, 0.08, 14, sx < 0 ? 'glowP' : 'glowC', false);
        for (const sz of [1, -1]) {
            addBlock(sx * (cx - CW / 2 + 0.25), 0, sz * 6.75, 0.5, CY - 0.3, 0.5, 'post');                            // supports
            addBlock(sx * (cx + CW / 2 - 0.25), 0, sz * 6.75, 0.5, CY - 0.3, 0.5, 'post');
            for (let i = 0; i < 4; i++) addBlock(sx * cx, 0, sz * (7.45 + i * 0.9), CW, CY - 0.5 - i * 0.5, 0.9, i % 2 ? 'concrete' : 'steel');   // 2.0, 1.5, 1.0, 0.5
        }
        addBlock(sx * cx, 0, 0, CW - 0.6, 0.9, 1.2, 'woodDark');                                                     // something to hide behind under it
    });
    // ---- stands on both long sides (scenery; spectators float) ----
    mx(sx => {
        const tiers = [[16, 20.5, 4.6], [20.5, 25, 6.0], [25, 29.5, 7.4]];
        for (const [a, b, top] of tiers) {
            addBlock(sx * (a + b) / 2, 0, 0, b - a, top, 42, 'concrete');
            addBlock(sx * (a + 0.9), top, 0, 0.9, 0.45, 40, sx < 0 ? 'accR' : 'accB', false);                       // bench row
            addBlock(sx * (a + 0.05), top - 0.12, 0, 0.1, 0.1, 42, 'glowW', false);
        }
        addBlock(sx * 30.6, 0, 0, 1.2, 13, 46, 'concreteDark');                                                        // back wall
        addBlock(sx * 29.9, 12.4, 0, 0.2, 0.2, 44, 'glowY', false);
        mx(sz => { addBlock(sx * 23, 0, sz * 21.6, 14, 9, 1.2, 'concreteDark'); addBlock(sx * 23, 9, sz * 21.6, 14.4, 0.3, 1.6, 'concrete', false); });   // stand end walls
    });
    // banners on the back walls (4 colours, one merged mesh each)
    const bgs = [[], [], [], []], cols = [['#b91c1c', '#7f1d1d'], ['#1d4ed8', '#1e3a8a'], ['#ca8a04', '#854d0e'], ['#6d28d9', '#4c1d95']];
    let bi = 0;
    mx(sx => { for (let z = -16; z <= 16; z += 8) { const g = new THREE.PlaneGeometry(3.4, 4.6); g.rotateY(sx > 0 ? -Math.PI / 2 : Math.PI / 2); g.translate(sx * 29.95, 10, z); bgs[bi++ % 4].push(g); } });
    bgs.forEach((list, k) => { if (!list.length) return; add(mergeGeometries(list, false), new THREE.MeshLambertMaterial({ map: tourneyBanner(cols[k][0], cols[k][1]), side: THREE.DoubleSide }), 0, 0, 0); list.forEach(g => g.dispose()); });
    // ---- big screens over each end ----
    mx(s => {
        const scr = add(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ map: tourneyScreenTex(s < 0 ? '#ef4444' : '#3b82f6'), toneMapped: false }), 0, 11, s * (ARENA - 0.2));
        if (s > 0) scr.rotation.y = Math.PI;
        addBlock(0, 6.6, s * (ARENA - 0.1), 17, 0.4, 0.4, 'steel', false); addBlock(0, 15.0, s * (ARENA - 0.1), 17, 0.4, 0.4, 'steel', false);
        addBlock(0, 0, s * 28, 30, 3, 1.5, 'concreteDark');                                                          // end terraces
        addBlock(0, 3, s * 27.2, 30.2, 0.1, 0.12, s < 0 ? 'glowR' : 'glowB', false);
    });
    // ---- lighting: two trusses across the pit with hanging floodlights ----
    mx(sz => {
        addBlock(0, 14, sz * 11, 2 * X + 4, 0.45, 0.45, 'steel', false);
        addBlock(0, 14.6, sz * 11, 2 * X + 4, 0.2, 0.2, 'steel', false);
        mx(sx => addBlock(sx * (X + 2.2), WH, sz * 11, 0.5, 14 - WH + 0.5, 0.5, 'steel', false));
        for (const x of [-10, -3.5, 3.5, 10]) addCeilingLight(x, sz * 11, 0, 13.9, 15, false, 1.2);
    });
    // floodlight masts in the four corners
    m4((sx, sz) => { addBlock(sx * 31, 0, sz * 31, 0.8, 18, 0.8, 'post', false); addBlock(sx * 31, 18, sz * 31, 3, 1.4, 0.5, 'lampHead', false); });
}
