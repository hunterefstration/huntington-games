// ============================================================
// THE WORLD: an archipelago. West + centre + east islands form one long landmass (tanks), with open seas north and south
// (ships) and the sky above (jets). Terrain is one mesh; trees and houses are instanced. Height comes from H(x,z).
// ============================================================
const EXT = 720;                                     // map half size; jets are turned back beyond this
const ISL = [
    { x: -340, z: 0, r: 270, h: 24, c: 0 }, { x: 340, z: 0, r: 270, h: 24, c: 0 }, { x: 0, z: 0, r: 200, h: 17, c: 0 },
    { x: 0, z: -400, r: 95, h: 12, c: 1 }, { x: 0, z: 400, r: 95, h: 12, c: 2 },
    { x: -440, z: -370, r: 55, h: 8, c: 3 }, { x: 440, z: 370, r: 55, h: 8, c: 4 }, { x: 440, z: -370, r: 55, h: 8, c: 5 }, { x: -440, z: 370, r: 55, h: 8, c: 6 }
];
const HILLS = [[-420, -130, 55, 16], [-200, 150, 60, 14], [170, -150, 70, 18], [430, 120, 55, 16], [0, -95, 45, 12], [75, 100, 40, 9], [-60, -150, 50, 10], [250, 150, 40, 9], [-300, -170, 40, 10]];
const TOWNS = [{ x: -250, z: -20, n: 15, p: 0 }, { x: 0, z: 10, n: 13, p: 1 }, { x: 250, z: 20, n: 15, p: 2 }, { x: -440, z: 90, n: 9 }, { x: 440, z: -90, n: 9 }, { x: -120, z: -135, n: 6 }, { x: 120, z: 135, n: 6 }];
const PTS = [{ x: -250, z: -20, name: 'A' }, { x: 0, z: 10, name: 'B' }, { x: 250, z: 20, name: 'C' }];
const CAP_R = 48;
function wob(x, z) { return Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.037 + .7) * 0.5 + Math.sin(x * 0.11 + z * 0.09) * 0.25 + Math.sin(z * 0.2 - x * 0.13) * 0.12; }
function H(x, z) {
    let b = -24;
    for (let i = 0; i < ISL.length; i++) {
        const s = ISL[i], dx = x - s.x, dz = z - s.z, d = Math.sqrt(dx * dx + dz * dz);
        let vv; if (d < s.r) { const q = 1 - d / s.r; vv = s.h * (1 - (1 - q) * (1 - q)); } else vv = -Math.min(24, (d - s.r) * 0.35);
        if (vv > b) b = vv;
    }
    if (b > -0.5) {
        const k = clamp(b / 3, 0, 1);
        for (let i = 0; i < HILLS.length; i++) { const h = HILLS[i], dx = x - h[0], dz = z - h[1], q = (dx * dx + dz * dz) / (2 * (h[2] / 2) * (h[2] / 2)); if (q < 8) b += h[3] * Math.exp(-q) * k; }
        b += wob(x, z) * 2.2 * clamp(b / 6, 0, 1);
    }
    return b;
}
function compOf(x, z) {        // which landmass (0 = the big one tanks fight on); -1 = water
    let best = -1, bs = 0;
    for (const s of ISL) { const d = Math.hypot(x - s.x, z - s.z), q = 1 - d / s.r; if (q > bs) { bs = q; best = s.c; } }
    return best;
}
const BLD = [];                        // house boxes {x0,x1,z0,z1,top}
function GH(x, z) {                    // ground height including houses
    let h = H(x, z);
    for (let i = 0; i < BLD.length; i++) { const b = BLD[i]; if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && b.top > h) h = b.top; }
    return h;
}
function GHS(x, z) { const h = GH(x, z); return h > 0 ? h : 0; }   // surface a shell hits (water counts)
function pushOutOfBuildings(e, r) {
    for (let i = 0; i < BLD.length; i++) {
        const b = BLD[i]; if (e.x < b.x0 - r || e.x > b.x1 + r || e.z < b.z0 - r || e.z > b.z1 + r) continue;
        const l = e.x - (b.x0 - r), rr = (b.x1 + r) - e.x, t = e.z - (b.z0 - r), bt = (b.z1 + r) - e.z, m = Math.min(l, rr, t, bt);
        if (m === l) e.x = b.x0 - r; else if (m === rr) e.x = b.x1 + r; else if (m === t) e.z = b.z0 - r; else e.z = b.z1 + r;
        e.speed *= 0.6;
    }
}

const renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: false, powerPreference: 'high-performance' });
renderer.setClearColor(0x8fc8ee);
renderer.shadowMap.type = THREE.PCFShadowMap;
const QUAL = { low: { pr: 0.6, sh: false, far: 900, parts: 0.5, fogN: 250, fogF: 900 }, med: { pr: 0.85, sh: false, far: 1300, parts: 0.8, fogN: 350, fogF: 1300 }, high: { pr: 1, sh: true, far: 1700, parts: 1, fogN: 500, fogF: 1700 } };
let Q = QUAL.med;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fc8ee);
scene.fog = new THREE.Fog(0x8fc8ee, 350, 1300);
const camera = new THREE.PerspectiveCamera(70, 1, 0.5, 1300);
const hemi = new THREE.HemisphereLight(0xe6f2ff, 0x6a7a55, 0.95); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d0, 1.0); sun.position.set(180, 300, 110); scene.add(sun); scene.add(sun.target);
sun.shadow.mapSize.set(1024, 1024); const sc = sun.shadow.camera; sc.left = -120; sc.right = 120; sc.top = 120; sc.bottom = -120; sc.near = 50; sc.far = 700; sun.shadow.bias = -0.0008;
function applyQuality() {
    Q = QUAL[save.settings.quality] || QUAL.med;
    renderer.setPixelRatio(Q.pr * Math.min(window.devicePixelRatio || 1, 1.25));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    const on = Q.sh && renderer.shadowMap.enabled !== true;
    renderer.shadowMap.enabled = Q.sh; sun.castShadow = Q.sh;
    if (on) for (const m of [MAT.base, MAT.team[0], MAT.team[1], terrainMat]) m.needsUpdate = true;
    camera.far = Q.far; camera.updateProjectionMatrix(); scene.fog.near = Q.fogN; scene.fog.far = Q.fogF;
    $('#ov').width = Math.floor(window.innerWidth * 0.75); $('#ov').height = Math.floor(window.innerHeight * 0.75);
}
const terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
let terrain, waterMesh, waterTex, miniCv, ptViz = [];
function buildWorld() {
    const rng = mulberry(20241031);
    // terrain
    const N = 152, SZ = EXT * 2 + 120, g = new THREE.PlaneGeometry(SZ, SZ, N, N); g.rotateX(-PI / 2);
    const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) p.setY(i, H(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    const nrm = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
        const h = p.getY(i), ny = nrm.getY(i), j = (rng() - .5) * .06;
        if (h < -8) c.setHex(0x2c6a8f); else if (h < -1) c.setHex(0x5aa4b8); else if (h < 1.6) c.setHex(0xd6c58a);
        else if (ny < 0.8 && h > 6) c.setHex(0x84806f);
        else if (h < 20) c.setHex(0x6aa44a).lerp(new THREE.Color(0x4d8a3c), (h - 1.6) / 18);
        else if (h < 30) c.setHex(0x8a8f6c); else c.setHex(0xb9bcb4);
        c.offsetHSL(0, 0, j); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.deleteAttribute('uv');
    terrain = new THREE.Mesh(g, terrainMat); terrain.receiveShadow = true; scene.add(terrain);
    // water with a scrolling faint texture
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 70; i++) { x.fillStyle = 'rgba(170,205,235,' + (0.2 + rng() * .35) + ')'; x.beginPath(); x.ellipse(rng() * 128, rng() * 128, 3 + rng() * 9, 1 + rng() * 2.5, rng() * 3, 0, TAU); x.fill(); }
    waterTex = new THREE.CanvasTexture(cv); waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping; waterTex.repeat.set(70, 70);
    waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-PI / 2), new THREE.MeshLambertMaterial({ color: 0x3d93c8, map: waterTex, transparent: true, opacity: 0.82, depthWrite: false }));
    waterMesh.position.y = 0; waterMesh.renderOrder = 1; scene.add(waterMesh);
    // houses
    const places = [], palette = [0xe4d9bd, 0xc9b896, 0xb5654a, 0xd9d4c7, 0x9aa3ad, 0xcfae7a];
    const okSpot = (x0, z0, w, d) => {
        const hs = [H(x0, z0), H(x0 + w, z0), H(x0, z0 + d), H(x0 + w, z0 + d), H(x0 + w / 2, z0 + d / 2)];
        if (Math.min(...hs) < 2.5 || Math.max(...hs) - Math.min(...hs) > 2.2) return false;
        for (const q of PTS) if (x0 + w > q.x - 20 && x0 < q.x + 20 && z0 + d > q.z - 20 && z0 < q.z + 20) return false;
        for (const b of BLD) if (x0 < b.x1 + 4 && x0 + w > b.x0 - 4 && z0 < b.z1 + 4 && z0 + d > b.z0 - 4) return false;
        return true;
    };
    for (const t of TOWNS) for (let k = 0, n = 0; k < 160 && n < t.n; k++) {
        const a = rng() * TAU, r = 24 + rng() * 55, w = 7 + rng() * 8, d = 7 + rng() * 8, hh = 5 + rng() * 11;
        const x0 = t.x + Math.cos(a) * r - w / 2, z0 = t.z + Math.sin(a) * r - d / 2;
        if (!okSpot(x0, z0, w, d)) continue;
        const base = Math.max(H(x0, z0), H(x0 + w, z0 + d), H(x0 + w, z0), H(x0, z0 + d));
        BLD.push({ x0, x1: x0 + w, z0, z1: z0 + d, top: base + hh }); places.push({ x: x0 + w / 2, z: z0 + d / 2, w, d, h: hh + 1.5, base: base - 1.5, col: palette[Math.floor(rng() * palette.length)] }); n++;
    }
    const bg = new THREE.BoxGeometry(1, 1, 1); bg.translate(0, .5, 0);
    const bm = new THREE.InstancedMesh(bg, new THREE.MeshLambertMaterial({ flatShading: true }), places.length), rm = new THREE.InstancedMesh(bg, new THREE.MeshLambertMaterial({ color: 0x7a3d2c, flatShading: true }), places.length);
    const mt = new THREE.Matrix4(), q0 = new THREE.Quaternion(), cc = new THREE.Color();
    places.forEach((b, i) => {
        mt.compose(new THREE.Vector3(b.x, b.base, b.z), q0, new THREE.Vector3(b.w, b.h, b.d)); bm.setMatrixAt(i, mt); bm.setColorAt(i, cc.setHex(b.col));
        mt.compose(new THREE.Vector3(b.x, b.base + b.h, b.z), q0, new THREE.Vector3(b.w + 1, 1.2, b.d + 1)); rm.setMatrixAt(i, mt);
    });
    bm.castShadow = rm.castShadow = true; bm.receiveShadow = true; bm.matrixAutoUpdate = rm.matrixAutoUpdate = false; scene.add(bm, rm);
    // trees: one merged trunk+2 cones geometry, instanced
    const T = []; cy(T, .35, .45, 2.2, 5, 0, 1.1, 0, 0x6b4a2b); cy(T, 0, 2.2, 3.4, 6, 0, 3.4, 0, 0x2f7a3a); cy(T, 0, 1.6, 2.6, 6, 0, 5.2, 0, 0x3a8a44);
    const tg = merge(T), spots = [];
    for (let k = 0; k < 4000 && spots.length < 520; k++) {
        const x1 = (rng() * 2 - 1) * (EXT - 40), z1 = (rng() * 2 - 1) * (EXT - 40), h = H(x1, z1);
        if (h < 3 || h > 24) continue;
        let bad = false; for (const b of BLD) if (x1 > b.x0 - 3 && x1 < b.x1 + 3 && z1 > b.z0 - 3 && z1 < b.z1 + 3) { bad = true; break; }
        for (const q of PTS) if (Math.hypot(x1 - q.x, z1 - q.z) < 30) bad = true;
        if (Math.abs(x1) > 400 && Math.abs(z1) < 90) bad = true;      // keep the base areas open
        if (!bad) spots.push([x1, h, z1, 0.8 + rng() * 0.8]);
    }
    const tm = new THREE.InstancedMesh(tg, MAT.base, spots.length); spots.forEach((s, i) => { mt.compose(new THREE.Vector3(s[0], s[1] - .2, s[2]), q0, new THREE.Vector3(s[3], s[3] * (0.9 + rng() * .5), s[3])); tm.setMatrixAt(i, mt); });
    tm.matrixAutoUpdate = false; tm.castShadow = true; scene.add(tm);
    // clouds (flat blobs high above)
    const cg = new THREE.IcosahedronGeometry(1, 0), cm = new THREE.InstancedMesh(cg, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, emissive: 0x556677 }), 44);
    for (let i = 0; i < 44; i++) { mt.compose(new THREE.Vector3((rng() * 2 - 1) * 1000, 170 + rng() * 110, (rng() * 2 - 1) * 1000), q0, new THREE.Vector3(25 + rng() * 40, 5 + rng() * 6, 18 + rng() * 25)); cm.setMatrixAt(i, mt); }
    cm.matrixAutoUpdate = false; scene.add(cm);
    // capture points: ring on the ground, a flag and a tall light beam
    PTS.forEach((pt, i) => {
        pt.y = H(pt.x, pt.z);
        const m = new THREE.MeshBasicMaterial({ color: 0xcccccc }), grp = new THREE.Group();
        const ring = new THREE.Mesh(new THREE.TorusGeometry(CAP_R, 0.7, 4, 40).rotateX(PI / 2), m); ring.position.y = 0.6;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(.25, .25, 16, 5), new THREE.MeshLambertMaterial({ color: 0x444444 })); pole.position.y = 8;
        const flag = new THREE.Mesh(new THREE.BoxGeometry(7, 4, .2), m); flag.position.set(3.5, 14, 0);
        const bmat = new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: .22, depthWrite: false }), beam = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 260, 8, 1, true), bmat); beam.position.y = 130;
        grp.add(ring, pole, flag, beam); grp.position.set(pt.x, pt.y, pt.z); scene.add(grp);
        ptViz.push({ grp, m, bmat });
    });
    setPointsVisible(false);
    // minimap: baked once
    miniCv = document.createElement('canvas'); miniCv.width = miniCv.height = 180;
    const mx = miniCv.getContext('2d'), im = mx.createImageData(180, 180);
    for (let py = 0; py < 180; py++) for (let px = 0; px < 180; px++) {
        const h = H((px / 180 - .5) * EXT * 2, (py / 180 - .5) * EXT * 2), o = (py * 180 + px) * 4; let r, gg, b;
        if (h < -6) { r = 22; gg = 66; b = 104; } else if (h < 0) { r = 40; gg = 100; b = 140; } else if (h < 2) { r = 190; gg = 176; b = 120; } else if (h < 24) { const k = h / 24; r = 100 - k * 30; gg = 150 - k * 40; b = 70; } else { r = 150; gg = 150; b = 140; }
        im.data[o] = r; im.data[o + 1] = gg; im.data[o + 2] = b; im.data[o + 3] = 255;
    }
    mx.putImageData(im, 0, 0);
}
function setPointsVisible(v) { ptViz.forEach(p => p.grp.visible = v); }
function updatePointViz(pts) {
    ptViz.forEach((p, i) => { const o = pts && pts[i] ? pts[i].own : -1, c = o < 0 ? 0xcccccc : TEAM_COL[o]; p.m.color.setHex(c); p.bmat.color.setHex(c); });
}
