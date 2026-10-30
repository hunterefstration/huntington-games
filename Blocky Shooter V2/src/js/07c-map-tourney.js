// ---------- 5.2 TOURNAMENT ARENA: a colosseum for 1v1 duels (hidden map: only the Tournament mode uses it) ----------
// A round sand pit (radius 20) with four cover pillars, four low walls and a central dais, ringed by a 3.6m high stone terrace
// with banners, columns with torches and benches. Players who are not in the current duel stand up on the terrace and watch.
// Everything is symmetrical: the duelists start at (0, -16) and (0, 16), the audience seats run round the terrace at radius 26.
const TOURNEY = { pit: 20.5, deckY: 3.6, seatR: 26, spawns: [[0, -16], [0, 16]] };
const tourneySeat = (i, n) => { const a = ((i + 0.5) / Math.max(1, n)) * Math.PI * 2 + Math.PI / 8; return [Math.cos(a) * TOURNEY.seatR, Math.sin(a) * TOURNEY.seatR]; };
// collision for a ring (annulus): vertical slabs along both axes, so a round wall is a few dozen boxes (not drawn, collision only).
// Slabs never poke into the open middle or outside the ring; the two directions cover each other's notches.
function annulusSolids(r1, r2, y0, h, step, thru) {
    for (const swap of [false, true]) {
        for (let u = -r2 * 0.72 + step / 2; u < r2 * 0.72; u += step) {
            const near = Math.max(0, Math.abs(u) - step / 2), far = Math.abs(u) + step / 2;
            if (far >= r2) continue;
            const zo = Math.sqrt(r2 * r2 - far * far), zi = near < r1 ? Math.sqrt(r1 * r1 - near * near) : 0;
            const put = (v0, v1) => { const c = (v0 + v1) / 2, len = v1 - v0; if (len < 0.05) return; if (swap) addSolid(c, y0, u, len, h, step, thru); else addSolid(u, y0, c, step, h, len, thru); };
            if (zi > 0.01) { put(zi, zo); put(-zo, -zi); } else put(-zo, zo);
        }
    }
}
function tourneyStoneTex(base, line, rep) {
    const [c, g] = makeCanvas(128);
    g.fillStyle = base; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = line; g.lineWidth = 3;
    for (let y = 0; y < 128; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); for (let x = (y / 32 % 2) * 32; x < 128; x += 64) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); } }
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.1})`; g.fillRect(Math.random() * 128, Math.random() * 128, 3, 3); }
    const t = canvasTex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); return t;
}
function tourneyBanner(col, col2) {
    const [c, g] = makeCanvas(128);
    g.fillStyle = col; g.fillRect(0, 0, 128, 128); g.fillStyle = col2; g.fillRect(0, 0, 128, 12); g.fillRect(0, 116, 128, 12); g.fillRect(8, 0, 6, 128); g.fillRect(114, 0, 6, 128);
    g.fillStyle = '#fde68a'; g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 14 : 34, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(64 + Math.cos(a) * r, 58 + Math.sin(a) * r); } g.closePath(); g.fill();
    g.font = '900 15px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fde68a'; g.fillText('BLOCKY', 64, 108);
    return canvasTex(c);
}
function mapTourney() {
    const R = TOURNEY.pit, DY = TOURNEY.deckY, RO = 31, RW = 32.6, W = worldGroup;
    spawnPt = [TOURNEY.spawns[0][0], TOURNEY.spawns[0][1]];
    const stoneD = new THREE.MeshLambertMaterial({ map: tourneyStoneTex('#7c7263', '#564e41', [28, 2]), side: THREE.BackSide });
    const stoneO = new THREE.MeshLambertMaterial({ map: tourneyStoneTex('#9b8f7a', '#6f6554', [28, 6]), side: THREE.BackSide });
    const deckM = new THREE.MeshLambertMaterial({ map: tourneyStoneTex('#b3a88f', '#8b8068', [10, 10]) });
    const add = (geo, mat, x, y, z, shadow) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.receiveShadow = !!shadow; W.add(m); return m; };
    // the sand pit
    const [sc, sg] = makeCanvas(256);
    sg.fillStyle = '#d9c28f'; sg.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1800; i++) { sg.fillStyle = `rgba(${120 + Math.random() * 60 | 0},${95 + Math.random() * 50 | 0},60,0.18)`; sg.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
    sg.strokeStyle = 'rgba(120,90,40,0.5)'; sg.lineWidth = 3; for (const r of [124, 96, 30]) { sg.beginPath(); sg.arc(128, 128, r, 0, 6.3); sg.stroke(); }
    sg.strokeStyle = 'rgba(160,30,30,0.55)'; sg.lineWidth = 5; sg.beginPath(); sg.moveTo(128, 8); sg.lineTo(128, 248); sg.stroke();
    const pit = add(new THREE.CircleGeometry(R, 56), new THREE.MeshLambertMaterial({ map: canvasTex(sc) }), 0, 0.03, 0, true); pit.rotation.x = -Math.PI / 2;
    // terrace: top, outer wall, inner wall
    const top = add(new THREE.RingGeometry(R, RO, 56, 1), deckM, 0, DY, 0, true); top.rotation.x = -Math.PI / 2;
    add(new THREE.CylinderGeometry(R, R, DY, 56, 1, true), stoneD, 0, DY / 2, 0, true);
    add(new THREE.CylinderGeometry(RW, RW, 13, 56, 1, true), stoneO, 0, 6.5, 0, true);
    annulusSolids(R, RO, 0, DY, 1.4, false);                                      // the terrace (solid down to the sand: the pit wall)
    annulusSolids(RO, RW, 0, 14, 1.0, false);                                     // the outer wall
    // railing round the pit: stone parapet + glass, collision for it (bullets and eyes pass, feet do not)
    add(new THREE.CylinderGeometry(R + 0.35, R + 0.35, 1.1, 56, 1, true), new THREE.MeshLambertMaterial({ map: tourneyStoneTex('#8c8270', '#5d5546', [28, 1]), side: THREE.DoubleSide }), 0, DY + 0.55, 0);
    add(new THREE.CylinderGeometry(R + 0.35, R + 0.35, 1.5, 56, 1, true), new THREE.MeshLambertMaterial({ color: 0xa6dcf5, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }), 0, DY + 1.85, 0);
    annulusSolids(R, R + 0.8, DY, 3.2, 1.0, true);
    // benches: three low rings on the terrace (decoration only)
    for (const r of [23, 28.6]) { const bm = add(new THREE.CylinderGeometry(r + 0.4, r + 0.4, 0.45, 56, 1, false), new THREE.MeshLambertMaterial({ color: 0x8a6a45 }), 0, DY + 0.22, 0); bm.castShadow = false; }
    // arches in the pit wall, banners and torches on the outer wall
    for (const [x, z, w, d] of [[0, -R + 0.05, 3.4, 0.5], [0, R - 0.05, 3.4, 0.5], [-R + 0.05, 0, 0.5, 3.4], [R - 0.05, 0, 0.5, 3.4]]) {
        addBlock(x, 0, z, w, 2.7, d, 'rubber', false); addBlock(x, 2.7, z, w + 0.5, 0.35, d + 0.2, 'concreteDark', false);
    }
    const bgs = [[], [], [], []], cols = [['#b91c1c', '#7f1d1d'], ['#1d4ed8', '#1e3a8a'], ['#ca8a04', '#854d0e'], ['#6d28d9', '#4c1d95']];
    for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + Math.PI / 16, x = Math.cos(a) * (RO + 0.2), z = Math.sin(a) * (RO + 0.2);
        const g = new THREE.PlaneGeometry(3.2, 5.6); g.rotateY(-a - Math.PI / 2); g.translate(x, DY + 7.4, z); bgs[i % 4].push(g);
        // columns between the banners, torches on top
        const ca = a + Math.PI / 16, cx = Math.cos(ca) * (RO - 0.5), cz = Math.sin(ca) * (RO - 0.5);
        addBlock(cx, DY, cz, 1.0, 9.5, 1.0, 'concreteDark', false); addBlock(cx, DY + 9.5, cz, 1.3, 0.35, 1.3, 'concrete', false); addBlock(cx, DY + 9.85, cz, 0.55, 0.7, 0.55, 'glowY', false);
        if (i % 2 === 0) { addBlock(cx * 0.66, DY, cz * 0.66, 0.3, 2.4, 0.3, 'post', false); addBlock(cx * 0.66, DY + 2.4, cz * 0.66, 0.6, 0.5, 0.6, 'glowY', false); }
    }
    bgs.forEach((list, k) => { const m = add(mergeGeometries(list, false), new THREE.MeshLambertMaterial({ map: tourneyBanner(cols[k][0], cols[k][1]), side: THREE.DoubleSide }), 0, 0, 0); list.forEach(g => g.dispose()); });
    // cover in the pit (180 degree + mirror symmetric): 4 pillars, 4 low walls, a central dais, short fences in front of each spawn
    for (const [x, z] of [[-8.5, -8.5], [8.5, -8.5], [-8.5, 8.5], [8.5, 8.5]]) { addBlock(x, 0, z, 1.9, 5.4, 1.9, 'stone'); addBlock(x, 5.4, z, 2.4, 0.4, 2.4, 'concrete', false); addBlock(x, 0, z, 2.3, 0.5, 2.3, 'concreteDark', false); }
    for (const [x, z, w, d] of [[-13.5, 0, 1.0, 5], [13.5, 0, 1.0, 5], [0, -12.5, 5, 1.0], [0, 12.5, 5, 1.0]]) addBlock(x, 0, z, w, 1.25, d, 'concrete');
    addBlock(0, 0, 0, 5.2, 0.5, 5.2, 'sand'); addBlock(0, 0.5, 0, 1.2, 1.1, 1.2, 'accY'); addBlock(0, 1.6, 0, 1.5, 0.15, 1.5, 'glowY', false);
    for (const [x, z] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) addBlock(x, 0, z, 1.3, 0.9, 1.3, 'woodDark');
    for (const [x, z] of [[-3, -16.5], [3, -16.5], [-3, 16.5], [3, 16.5]]) addBlock(x, 0, z, 0.5, 1.1, 0.5, 'steel');
}
