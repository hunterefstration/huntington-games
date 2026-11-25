// ============================================================
// THINGS THAT BLOW UP AND BREAK (the owner, 2026-11-24: "I do like exploding cars and barrels and props that break when shot").
// A map file is one baked mesh: nothing in it can change. So these are put ON the map by the game, on free ground beside
// what is already there, the same on every device of a party (a seeded pick):
//   barrel   a red drum. Shot, it catches fire, and two seconds later it goes up (a hard hit sets it off at once).
//   car      an abandoned car. Shot up enough it smokes, then burns, then explodes and is a black wreck that stays.
//   crate    a wooden crate: a few hits and it is planks. One in three had something in it.
//   box      cardboard boxes: one or two hits.
// They are SOLID: each marks its cells in World.blk (and World.nav, which the zombies' routes read), and gives them back
// when it is gone. A prop is only kept where it does not cut any walkable ground off. Bullets meet them through
// Props.trace (Game.shot), blasts through Props.blast (Game.explode), blades through Props.swing.
// In a party the one who destroys a prop tells the others (Net message 'prop'); each device hurts only its own player.
// ============================================================
const PROP = {
    barrel: { hp: 34, r: 0.3, h: 0.9, room: 0.75, blast: [4.6, 430], fuse: 2.0 },
    car:    { hp: 300, hw: 0.95, hd: 2.2, h: 1.42, room: 2.7, blast: [7.5, 720], fuse: 2.6 },
    crate:  { hp: 55, hw: 0.42, hd: 0.42, h: 0.84, room: 0.85 },
    box:    { hp: 10, hw: 0.31, hd: 0.25, h: 0.42, room: 0.7 } };
const Props = { list: [], made: false, cars: {}, carIds: ['kite', 'anvil', 'pixel'], chips: [], seed: 1, blk0: null };
Props.rnd = () => { let t = Props.seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
// ---- what they are drawn with (made once; the car models come from files and may arrive later)
Props.make = function () {
    if (Props.made) return; Props.made = true; const scene = World.scene;
    const cv = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return HG3D.texture(c, {}); };
    const grime = (g, w, h, n, a) => { for (let i = 0; i < n; i++) { g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '20,14,10,' : '120,90,60,') + (Math.random() * a).toFixed(2) + ')'; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 14, 1 + Math.random() * 5); } };
    const drum = cv(256, 128, (g, w, h) => { g.fillStyle = '#9c1f14'; g.fillRect(0, 0, w, h); const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(0,0,0,.35)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(0,0,0,.4)'; for (const y of [4, 42, 84, 120]) g.fillRect(0, y, w, 4); g.fillStyle = '#e9c62b'; g.fillRect(88, 50, 80, 30); g.fillStyle = '#16120c'; g.font = 'bold 15px Arial'; g.textAlign = 'center'; g.fillText('FLAMMABLE', 128, 70); grime(g, w, h, 160, 0.5); });
    const wood = cv(128, 128, (g, w, h) => { g.fillStyle = '#5f5240'; g.fillRect(0, 0, w, h); for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? '#574a39' : '#695b47'; g.fillRect(0, i * 26, w, 24); g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, i * 26 + 24, w, 2); }
        g.fillStyle = '#463a2c'; g.fillRect(0, 0, 14, h); g.fillRect(w - 14, 0, 14, h); g.fillRect(0, 0, w, 12); g.fillRect(0, h - 12, w, 12); g.fillStyle = 'rgba(20,14,8,.7)'; for (const p of [[7, 7], [w - 7, 7], [7, h - 7], [w - 7, h - 7]]) { g.beginPath(); g.arc(p[0], p[1], 2.5, 0, 7); g.fill(); } grime(g, w, h, 120, 0.3); });
    const card = cv(128, 128, (g, w, h) => { g.fillStyle = '#a98456'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(214,190,150,.8)'; g.fillRect(0, 56, w, 14); g.strokeStyle = 'rgba(0,0,0,.3)'; g.strokeRect(1, 1, w - 2, h - 2); g.fillStyle = 'rgba(40,28,16,.6)'; g.font = 'bold 13px Arial'; g.fillText('THIS WAY UP', 18, 30); grime(g, w, h, 90, 0.3); });
    const inst = (geo, map, n, col) => { const m = HG3D.instanced(geo, HG3D.material(map ? { color: 0xffffff, map } : { color: 0xffffff }), n, col ? { colors: true } : undefined); m.frustumCulled = false; m.count = 0; scene.add(m); return m; };
    Props.mesh = { barrel: inst(HG3D.geo.cylinder(PROP.barrel.r, PROP.barrel.r, PROP.barrel.h, 14), drum, 16), crate: inst(HG3D.geo.box(PROP.crate.hw * 2, PROP.crate.h, PROP.crate.hd * 2), wood, 20), box: inst(HG3D.geo.box(PROP.box.hw * 2, PROP.box.h, PROP.box.hd * 2), card, 24) };
    Props.chipMesh = inst(HG3D.geo.box(1, 1, 1), null, 64, true);
    // a soft dark patch under each (the baked ground takes no real shadow)
    { const m = HG3D.instanced(HG3D.geo.plane(1, 1), HG3D.material({ lit: false, color: 0x000000, map: blobTexture(64, [[0, 'rgba(0,0,0,.62)'], [0.55, 'rgba(0,0,0,.42)'], [1, 'rgba(0,0,0,0)']], true), transparent: true, depthWrite: false, fog: false }), 72); m.frustumCulled = false; m.count = 0; m.renderOrder = -1; scene.add(m); Props.shade = m; }
    Props.carNode = HG3D.node(); scene.add(Props.carNode);
    Packs.ready.then(() => Promise.all(Props.carIds.map(id => HG3D.load(AST('car_' + id + '.hgm')).then(A => { Props.cars[id] = A; }, () => { })))).then(() => { if (App.game === Game) for (const p of Props.list) if (p.kind === 'car' && !p.node && !p.gone) Props.carShow(p); });
};
// ---- a run begins: everything back as it was, then a new lot
Props.begin = function (o) {
    Props.make(); const G = World.G; if (!G) return;
    if (Props.blk0 && Props.blkOf === World.id) World.blk.set(Props.blk0); else { Props.blk0 = World.blk.slice(); Props.blkOf = World.id; } Props.navAll();
    for (const p of Props.list) if (p.node) { Props.carNode.remove(p.node); R.release(p.node); } Props.list = []; Props.chips.length = 0;
    let h = 7; const key = World.id + (o && o.net ? '|' + (Net.code || '') : '|' + Math.random()); for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x45d9f3b); Props.seed = h | 0;
    const B = World.bounds, size = World.size, indoors = World.map && World.map.indoors, reach0 = World.reach, tmp = Props.flow || (Props.flow = World.newFlow());
    const want = [['car', indoors ? 0 : 3], ['barrel', clamp(Math.round(size / 8), 5, 9)], ['crate', clamp(Math.round(size / 7), 6, 10)], ['box', clamp(Math.round(size / 9), 4, 8)]];
    let prev = reach0;          // how many path cells can be walked to with what stands so far
    for (const [kind, n] of want) { const K = PROP[kind]; let made = 0;
        for (let t = 0; t < 420 && made < n; t++) {
            const x = B.min[0] + 3 + Props.rnd() * (B.max[0] - B.min[0] - 6), z = B.min[2] + 3 + Props.rnd() * (B.max[2] - B.min[2] - 6), yaw = kind === 'car' ? (Props.rnd() * 4 | 0) * Math.PI / 2 + (Props.rnd() - 0.5) * 0.5 : kind === 'barrel' ? Props.rnd() * 6.28 : (Props.rnd() - 0.5) * 0.5;
            if (World.blocked(x, z, K.room) || World.mainFlow.dist[World.cell(x, z)] < 0) continue;                                                // free ground that can be walked to
            if (kind !== 'car' && !World.blocked(x, z, K.room + 1.3)) continue;                                                                    // small things stand BESIDE something, not out in the open
            if (Math.hypot(x - World.home[0], z - World.home[1]) < (kind === 'car' ? 9 : 5) || World.spots.some(s => Math.hypot(x - s[0], z - s[1]) < K.room + 1.6)) continue;
            if (Props.list.some(q => Math.hypot(x - q.x, z - q.z) < K.room + PROP[q.kind].room + (kind === 'car' || q.kind === 'car' ? 2 : 0.2) && !(kind === 'box' && q.kind === 'crate'))) continue;
            const p = { i: Props.list.length, kind, x, z, y: 0, yaw, hp: K.hp, fuse: -1, hot: 0, gone: false, cy: Math.cos(yaw), sy: Math.sin(yaw) };
            const got = Props.block(p, true); World.flow(tmp, World.home[0], World.home[1]);
            if (tmp.reach < prev - got - 2) { Props.block(p, false); continue; }                                                                    // more ground is lost than it stands on: it would shut a way off
            prev = tmp.reach; Props.list.push(p); made++;
            if (kind === 'crate' && Props.rnd() < 0.45) { const b = { i: Props.list.length, kind: 'box', x: x + (Props.rnd() - 0.5) * 0.2, z: z + (Props.rnd() - 0.5) * 0.2, y: K.h, yaw: Props.rnd() * 1.2, hp: PROP.box.hp, fuse: -1, hot: 0, gone: false, on: p }; b.cy = Math.cos(b.yaw); b.sy = Math.sin(b.yaw); Props.list.push(b); }
            if (kind === 'car') { p.car = Props.carIds[(Props.rnd() * Props.carIds.length) | 0]; p.paint = [0x3f2420, 0x27303a, 0x55524a, 0x1f2720, 0x4a4638][(Props.rnd() * 5) | 0]; Props.carShow(p); }
        } }
    World.flow(World.mainFlow, World.home[0], World.home[1]); World.reach = World.mainFlow.reach; Props.draw();
};
// the cells a prop stands on: taken (on) or given back. Returns how many path cells changed.
Props.block = function (p, on) {
    const G = World.G, c = G.cell, K = PROP[p.kind], nx = G.nx, R0 = K.r ? K.r : Math.hypot(K.hw, K.hd), x0 = Math.floor((p.x - R0 - G.x0) / c), x1 = Math.floor((p.x + R0 - G.x0) / c), z0 = Math.floor((p.z - R0 - G.z0) / c), z1 = Math.floor((p.z + R0 - G.z0) / c); let n = 0;
    for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) { if (ix < 0 || iz < 0 || ix >= nx || iz >= G.nz) continue; const dx = G.x0 + (ix + 0.5) * c - p.x, dz = G.z0 + (iz + 0.5) * c - p.z;
        const inside = K.r ? dx * dx + dz * dz < (K.r + c * 0.4) * (K.r + c * 0.4) : Math.abs(dx * p.cy - dz * p.sy) < K.hw + c * 0.3 && Math.abs(dx * p.sy + dz * p.cy) < K.hd + c * 0.3; if (!inside) continue;
        const i = iz * nx + ix, c0 = World.nav[(iz >> 1) * World.NX + (ix >> 1)]; World.blk[i] = on ? 1 : Props.blk0[i]; Props.navCell(ix >> 1, iz >> 1); if (World.nav[(iz >> 1) * World.NX + (ix >> 1)] !== c0) n++; }
    return n;
};
Props.navCell = function (x, z) { const NX = World.NX, NZ = World.NZ, nx = World.G.nx, b = World.blk; if (x < 0 || z < 0 || x >= NX || z >= NZ) return; World.nav[z * NX + x] = (b[z * 2 * nx + x * 2] | b[z * 2 * nx + x * 2 + 1] | b[(z * 2 + 1) * nx + x * 2] | b[(z * 2 + 1) * nx + x * 2 + 1]) || x < 2 || z < 2 || x > NX - 3 || z > NZ - 3 ? 1 : 0; };
Props.navAll = function () { for (let z = 0; z < World.NZ; z++) for (let x = 0; x < World.NX; x++) Props.navCell(x, z); };
// ---- drawing
Props.draw = function () {
    for (const kind of ['barrel', 'crate', 'box']) { const m = Props.mesh[kind], e = m.instanceMatrix.array, K = PROP[kind]; let n = 0;
        for (const p of Props.list) { if (p.kind !== kind || p.gone || n >= e.length / 16) continue; const o = n++ * 16; e.fill(0, o, o + 16); e[o] = p.cy; e[o + 2] = -p.sy; e[o + 5] = 1; e[o + 8] = p.sy; e[o + 10] = p.cy; e[o + 12] = p.x; e[o + 13] = p.y + K.h / 2; e[o + 14] = p.z; e[o + 15] = 1; }
        m.count = n; m.instanceMatrix.needsUpdate = true; }
    { const m = Props.shade, e = m.instanceMatrix.array; let n = 0; for (const p of Props.list) { if (p.gone || p.y > 0.01 || n >= 72) continue; const K = PROP[p.kind], w = (K.r ? K.r * 2 : K.hw * 2) * 1.75, d = (K.r ? K.r * 2 : K.hd * 2) * (p.kind === 'car' ? 1.3 : 1.75), o = n++ * 16; e.fill(0, o, o + 16); e[o] = p.cy * w; e[o + 2] = -p.sy * w; e[o + 5] = 1; e[o + 8] = p.sy * d; e[o + 10] = p.cy * d; e[o + 12] = p.x; e[o + 13] = 0.035; e[o + 14] = p.z; e[o + 15] = 1; } m.count = n; m.instanceMatrix.needsUpdate = true; }
};
Props.carShow = function (p) {
    const A = Props.cars[p.car]; if (!A || p.node) return; const root = HG3D.node(), body = A.copy('body'), col = c => ({ r: (c >> 16 & 255) / 255, g: (c >> 8 & 255) / 255, b: (c & 255) / 255 });
    // a car standing in ash for years: dull paint, and lit so that it has a shape (what faces up is light, what faces down is dark)
    const hg = () => ({ key: 'ash-car', fFinal: String.fromCharCode(10), vMain: '#if !defined(UNLIT) && !defined(VFINAL)' + String.fromCharCode(10) + ' vLa *= 0.5 + 0.72 * max(N.y, 0.0) + 0.14 * (1.0 - abs(N.y));' + String.fromCharCode(10) + '#endif' });
    const paint = HG3D.material({ color: p.paint, roughness: 0.9, hg: hg() }), glass = HG3D.material({ color: 0x0b0d10, roughness: 0.5, hg: hg() }), made = {}; p.mats = [paint, glass];
    const swap = n => { for (const ch of n.children) { if (ch.isMesh) { const src = ch.material, nm = src.name || ''; ch.material = /paint/.test(nm) ? paint : /glass/.test(nm) ? glass : made[nm] || (made[nm] = (() => { const m = HG3D.material({ color: 0x5e5a52, map: src.map || null, roughness: 0.95, hg: hg() }); p.mats.push(m); return m; })()); } if (ch.children) swap(ch); } };
    swap(body); root.add(body); const e = new Float32Array(16); e[0] = p.cy; e[2] = -p.sy; e[5] = 1; e[8] = p.sy; e[10] = p.cy; e[12] = p.x; e[14] = p.z; e[15] = 1; HG3D.place(root, e);
    if (p.wreck) for (const m of p.mats) m.color = col(0x0c0b0a); p.node = root; Props.carNode.add(root);
};
// ---- shots, blasts, blades
// the nearest prop a ray meets before `max`: { p, t } or null (the direction is one unit long)
Props.trace = function (ox, oy, oz, ux, uy, uz, max) {
    let best = null, bt = max;
    for (const p of Props.list) { if (p.gone || (p.wreck && false)) continue; const K = PROP[p.kind], dx = p.x - ox, dz = p.z - oz, along = dx * ux + dz * uz; if (along < -3 || along > bt + 3) continue; let t = -1;
        if (K.r) { const a = ux * ux + uz * uz; if (a < 1e-6) continue; const b = -(dx * ux + dz * uz), c = dx * dx + dz * dz - K.r * K.r, disc = b * b - a * c; if (disc < 0) continue; t = (-b - Math.sqrt(disc)) / a; }
        else { const lx = -(dx * p.cy - dz * p.sy), lz = -(dx * p.sy + dz * p.cy), vx = ux * p.cy - uz * p.sy, vz = ux * p.sy + uz * p.cy; let t0 = 0, t1 = bt;      // the ray in the prop's own axes, against its box
            for (const [o1, v1, hh] of [[lx, vx, K.hw], [lz, vz, K.hd]]) { if (Math.abs(v1) < 1e-6) { if (Math.abs(o1) > hh) { t0 = 1; t1 = 0; break; } continue; } let a = (-hh - o1) / v1, b = (hh - o1) / v1; if (a > b) { const s = a; a = b; b = s; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
            if (t0 > t1) continue; t = t0; }
        if (t < 0.05 || t >= bt) continue; const y = oy + uy * t; if (y < p.y - 0.02 || y > p.y + K.h + 0.02) continue; best = p; bt = t; }
    return best ? { p: best, t: bt } : null;
};
Props.hit = function (p, dmg, x, y, z) {
    if (p.gone || p.wreck) return; const K = PROP[p.kind]; p.hp -= dmg;
    if (p.kind === 'crate' || p.kind === 'box') { Props.chip(x, y, z, 2, p.kind); Snd.noise(0.12, p.kind === 'box' ? 900 : 1600, 300, 0.07); if (p.hp <= 0) { Props.smash(p); Props.tell(p); } return; }
    Snd.tone(p.kind === 'car' ? 320 + Math.random() * 200 : 620 + Math.random() * 300, 0.07, 0.05, 'square', 180); World.spark(x, y, z, 0.35);
    if (p.fuse < 0 && (p.hp <= 0 || (p.kind === 'barrel' && p.hp < K.hp * 0.75))) { p.fuse = dmg > K.hp * 1.6 ? 0.12 : K.fuse * (p.hp <= -K.hp ? 0.3 : 1); p.mine = true; if (p.fuse > 0.5) Snd.noise(0.2, 2400, 700, 0.5); }
};
// a crate or a box goes to pieces
Props.smash = function (p) {
    if (p.gone) return; p.gone = true; const K = PROP[p.kind]; if (!p.on) Props.block(p, false); Props.chip(p.x, p.y + K.h * 0.5, p.z, p.kind === 'crate' ? 12 : 7, p.kind, true); World.dust(p.x, p.y + 0.4, p.z, 4, 0.5, 0.42, 0.3);
    Snd.noise(0.3, p.kind === 'crate' ? 1400 : 700, 180, 0.22); Snd.tone(p.kind === 'crate' ? 170 : 110, 0.16, 0.12, 'triangle', 60);
    for (const q of Props.list) if (q.on === p && !q.gone) { q.on = null; q.y = 0; Props.smash(q); }                                                    // what stood on it comes down with it
    if (p.kind === 'crate' && p.mine !== false && Props.rnd() < 0.34 && Game.pickups && !(Game.net && !Game.net.host)) Game.pickups.push({ kind: Props.rnd() < 0.4 ? 'hp' : 'ammo', x: p.x, z: p.z, t: 0 });
    Props.draw();
};
Props.explode = function (p, mine) {
    if (p.gone || p.wreck) return; const K = PROP[p.kind], G = Game, P = G.P; p.fuse = -1; p.hot = 0;
    if (p.kind === 'car') { p.wreck = true; p.burn = 14; if (p.mats) for (const m of p.mats) m.color = { r: 0.045, g: 0.04, b: 0.038 }; } else { p.gone = true; Props.block(p, false); Props.draw(); }
    Game.explode(p.x, p.kind === 'car' ? 0.9 : 0.5, p.z, K.blast[0], K.blast[1], !!mine); if (p.kind === 'car') { World.boom(p.x, 1.6, p.z, true); Props.chip(p.x, 1, p.z, 10, 'car', true); }
    if (P && !P.dead) { const d = Math.hypot(P.x - p.x, P.z - p.z); if (d < K.blast[0]) G.hurt(0, (p.kind === 'car' ? 70 : 48) * clamp(1.1 - d / K.blast[0], 0.15, 1), p.x, p.z, null); }
};
// a blast reaches other props: crates break, barrels and cars are set off a moment later (a chain)
Props.blast = function (x, z, r, dmg, mine) {
    for (const p of Props.list) { if (p.gone || p.wreck) continue; const d = Math.hypot(p.x - x, p.z - z); if (d > r + 0.6 || d < 0.01) continue; const k = clamp(1.15 - d / r, 0.2, 1);
        if (p.kind === 'crate' || p.kind === 'box') { p.hp -= dmg * k * 0.5; if (p.hp <= 0) Props.smash(p); }
        else { p.hp -= dmg * k * 0.6; if (p.hp <= 0 && p.fuse < 0) { p.fuse = 0.18 + Math.random() * 0.25; p.mine = !!mine; } } }
};
Props.swing = function (P, dmg) { const d = Game.dir, h = Props.trace(P.x, World.eye, P.z, d[0], d[1], d[2], 2.1); if (h && (h.p.kind === 'crate' || h.p.kind === 'box')) Props.hit(h.p, dmg, P.x + d[0] * h.t, World.eye + d[1] * h.t, P.z + d[2] * h.t); };
// a party: tell the others a prop is gone / what they told us
Props.tell = function (p) { const N = Game.net; if (!N) return; const m = { t: 'prop', i: p.i }; if (Net.host) Net.all(m); else if (Net.peers.H) Net.send(Net.peers.H, m); };
Props.remote = function (i) { const p = Props.list[i]; if (!p || p.gone || p.wreck) return; if (PROP[p.kind].blast) Props.explode(p, false); else { p.mine = false; Props.smash(p); } };
// ---- every frame: fuses, fire, smoke, the flying bits
Props.step = function (dt, G) {
    for (const p of Props.list) {
        if (p.gone) continue; const K = PROP[p.kind], top = p.y + K.h;
        if (p.fuse >= 0) { p.fuse -= dt; p.hot += dt;
            if (Math.random() < dt * 26) World.sparks.add(p.x + rand(-0.25, 0.25), top + rand(0, 0.3), p.z + rand(-0.25, 0.25), rand(-0.3, 0.3), rand(1.2, 2.6), rand(-0.3, 0.3), rand(0.35, 0.7), 1.2, rand(0.25, 0.45), 1, rand(0.45, 0.7), 0.12, 0.9);
            if (Math.random() < dt * 9) World.smoke.add(p.x, top + 0.4, p.z, rand(-0.2, 0.2), rand(1, 1.8), rand(-0.2, 0.2), 0.5, 1.4, rand(0.8, 1.3), 0.1, 0.1, 0.1, 0.55);
            if (p.fuse <= 0) { const mine = p.mine !== false; Props.explode(p, mine); if (mine) Props.tell(p); } }
        else if (p.kind === 'car' && !p.wreck && p.hp < K.hp * 0.5 && Math.random() < dt * 5) World.smoke.add(p.x + p.sy * 1.4, 1.1, p.z + p.cy * 1.4, rand(-0.2, 0.2), rand(0.8, 1.4), rand(-0.2, 0.2), 0.4, 1.1, rand(0.9, 1.4), 0.22, 0.22, 0.22, 0.45);
        if (p.wreck && p.burn > 0) { p.burn -= dt; if (Math.random() < dt * 14) World.sparks.add(p.x + rand(-0.7, 0.7), 0.9 + rand(0, 0.5), p.z + rand(-1.4, 1.4), rand(-0.3, 0.3), rand(1, 2.4), rand(-0.3, 0.3), rand(0.4, 0.9), 1.1, rand(0.3, 0.5), 1, rand(0.4, 0.65), 0.1, 0.85); if (Math.random() < dt * 6) World.smoke.add(p.x, 1.6, p.z, rand(-0.3, 0.3), rand(1.2, 2), rand(-0.3, 0.3), 0.7, 1.6, rand(1.2, 2), 0.07, 0.07, 0.07, 0.6); }
    }
    // the bits: they fly, fall, bounce once and lie there
    const L = Props.chips, m = Props.chipMesh, e = m.instanceMatrix.array, col = m.instanceColor.array; let n = 0;
    for (let i = L.length - 1; i >= 0; i--) { const c = L[i]; c.t += dt; if (c.t > c.life) { L.splice(i, 1); continue; } if (!c.rest) { c.vy -= 14 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; c.a += c.spin * dt; if (c.y < c.s * 0.3) { c.y = c.s * 0.3; if (Math.abs(c.vy) > 1.4) { c.vy *= -0.3; c.vx *= 0.5; c.vz *= 0.5; c.spin *= 0.4; } else c.rest = true; } } }
    for (const c of L) { if (n >= 64) break; const o = n * 16, k = c.t > c.life - 0.6 ? (c.life - c.t) / 0.6 : 1, ca = Math.cos(c.a) * k, sa = Math.sin(c.a) * k; e.fill(0, o, o + 16); e[o] = ca * c.s; e[o + 2] = -sa * c.s; e[o + 5] = c.s * 0.16 * k; e[o + 8] = sa * c.s * 0.34; e[o + 10] = ca * c.s * 0.34; e[o + 12] = c.x; e[o + 13] = c.y; e[o + 14] = c.z; e[o + 15] = 1; col[n * 3] = c.r; col[n * 3 + 1] = c.g; col[n * 3 + 2] = c.b; n++; }
    m.count = n; if (n || Props.hadChips) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; } Props.hadChips = n > 0;
};
Props.chip = function (x, y, z, n, kind, burst) {
    const C = kind === 'box' ? [0.66, 0.52, 0.34] : kind === 'car' ? [0.08, 0.07, 0.07] : [0.48, 0.35, 0.21];
    for (let i = 0; i < n && Props.chips.length < 64; i++) { const a = Math.random() * 6.28, sp = burst ? rand(1.5, 4.5) : rand(0.8, 2.2), k = rand(0.75, 1.1); Props.chips.push({ x: x + rand(-0.15, 0.15), y: y + rand(-0.1, 0.25), z: z + rand(-0.15, 0.15), vx: Math.cos(a) * sp, vy: rand(1.5, burst ? 5 : 3), vz: Math.sin(a) * sp, a, spin: rand(-12, 12), s: kind === 'car' ? rand(0.25, 0.5) : rand(0.16, 0.42), t: 0, life: rand(5, 8), rest: false, r: C[0] * k, g: C[1] * k, b: C[2] * k }); }
};
// blades break crates too
{ const mh = Game.meleeHit; Game.meleeHit = function (P, dmg) { const r = mh.apply(this, arguments); Props.swing(P, dmg || 40); return r; }; }
