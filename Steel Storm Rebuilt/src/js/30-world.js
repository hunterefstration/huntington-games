// ============================================================
// THE WORLD: an archipelago. West + centre + east islands form one long landmass (tanks), with open seas north and south
// (ships) and the sky above (jets). Terrain is one mesh with a height/slope texture blend (grass, sand, rock, snow, roads);
// trees, rocks and houses are instanced (trees in 16 chunks so far ones are culled). Height comes from H(x,z).
// Lighting (2.0): sun with soft shadows sized by the quality tier, hemisphere fill, sky dome + fog per weather preset,
// ACES tone mapping, flash lights for muzzle blasts / explosions, fresnel water with moving normals, rain and night flares.
// ============================================================
const EXT = 720;                                     // map half size; jets are turned back beyond the battle area (M.R)
// ============================================================
// THE REBUILD: several battlefields. Each is the same kind of world the old game had (round landmasses that run together,
// hills on top, towns, roads, three points, two bases with an airstrip), with its own layout and its own look. What every
// layout keeps, because spawning and the computer's crews count on it: side 0's base is at x = -340..-410 and side 1's at
// +340..+410 (|z| < 110, 3 to 22 m high); there is open land over |x| < 210, |z| < 120; the airstrips are at z = -78 and
// +78; and the sea is deep at |z| = 470..600 for the ships. tools/tests/ssx.mjs checks each one.
// ============================================================
const GROUNDS = {
    ridge: { name: 'IRON RIDGE', look: 'alpine', seed: 771, blurb: 'Green hills under two snow peaks. The road runs through the saddle between them.',
        isl: [{ x: -370, z: 0, r: 255, h: 17, c: 0 }, { x: 370, z: 0, r: 255, h: 17, c: 0 }, { x: -130, z: 0, r: 225, h: 19, c: 0 }, { x: 130, z: 0, r: 225, h: 19, c: 0 }, { x: 0, z: -150, r: 150, h: 14, c: 0 }, { x: 0, z: 150, r: 150, h: 14, c: 0 },
            { x: -330, z: -350, r: 50, h: 8, c: 1 }, { x: 330, z: -350, r: 50, h: 8, c: 2 }, { x: -330, z: 350, r: 50, h: 8, c: 3 }, { x: 330, z: 350, r: 50, h: 8, c: 4 }],
        hills: [[0, -190, 90, 26], [0, 190, 90, 26], [-150, -150, 60, 12], [150, -150, 60, 12], [-150, 150, 55, 11], [150, 150, 55, 11], [-270, 120, 45, 8], [270, 120, 45, 8], [-270, -130, 45, 9], [270, -130, 45, 9], [-80, 60, 35, 5], [80, -60, 35, 5]],
        towns: [{ x: -250, z: -10, n: 14, p: 0 }, { x: 0, z: 0, n: 10, p: 1 }, { x: 250, z: -10, n: 14, p: 2 }, { x: -465, z: 175, n: 8 }, { x: 465, z: 175, n: 8 }, { x: -130, z: -60, n: 5 }, { x: 130, z: 60, n: 5 }],
        pts: [{ x: -250, z: -10, name: 'A' }, { x: 0, z: 0, name: 'B' }, { x: 250, z: -10, name: 'C' }], flags: [{ x: -455, z: 10 }, { x: 455, z: 10 }],
        roads: [[[-600, 0], [-455, 5], [-370, 0], [-250, -10], [-120, -5], [0, 0], [120, -5], [250, -10], [370, 0], [455, 5], [600, 0]], [[-250, -10], [-340, 90], [-465, 175]], [[250, -10], [340, 90], [465, 175]], [[0, 0], [-60, -40], [-130, -60]], [[0, 0], [60, 40], [130, 60]]],
        strips: [[-600, -430, -78], [430, 600, 78]] },
    sands: { name: 'RED SANDS', look: 'desert', seed: 4409, blurb: 'Dunes and red rock around a wide bay. Little cover, long shots, and ships close inshore.',
        isl: [{ x: -370, z: 10, r: 255, h: 16, c: 0 }, { x: 370, z: 10, r: 255, h: 16, c: 0 }, { x: -170, z: -30, r: 235, h: 17, c: 0 }, { x: 170, z: -30, r: 235, h: 17, c: 0 }, { x: 0, z: -70, r: 215, h: 15, c: 0 },
            { x: 0, z: 345, r: 70, h: 9, c: 1 }, { x: -250, z: -385, r: 45, h: 7, c: 2 }, { x: 250, z: -385, r: 45, h: 7, c: 3 }],
        hills: [[-300, -70, 90, 6], [300, -70, 90, 6], [-210, 70, 70, 5], [210, 70, 70, 5], [-90, -180, 80, 8], [90, -180, 80, 8], [0, -250, 70, 10], [-430, 150, 60, 6], [430, 150, 60, 6], [-260, -200, 60, 9], [260, -200, 60, 9], [0, 40, 60, 5], [-120, -40, 50, 4], [120, -40, 50, 4]],
        towns: [{ x: -240, z: -30, n: 12, p: 0 }, { x: 0, z: -60, n: 11, p: 1 }, { x: 240, z: -30, n: 12, p: 2 }, { x: -455, z: 175, n: 7 }, { x: 455, z: 175, n: 7 }, { x: -110, z: -200, n: 5 }, { x: 110, z: -200, n: 5 }],
        pts: [{ x: -240, z: -30, name: 'A' }, { x: 0, z: -60, name: 'B' }, { x: 240, z: -30, name: 'C' }], flags: [{ x: -455, z: 10 }, { x: 455, z: 10 }],
        roads: [[[-600, 10], [-455, 10], [-370, 0], [-240, -30], [-120, -55], [0, -60], [120, -55], [240, -30], [370, 0], [455, 10], [600, 10]], [[-240, -30], [-340, 85], [-455, 175]], [[240, -30], [340, 85], [455, 175]], [[0, -60], [-60, -140], [-110, -200]], [[0, -60], [60, -140], [110, -200]]],
        strips: [[-600, -430, -78], [430, 600, 78]] },
    sound: { name: 'FROZEN SOUND', look: 'snow', seed: 90210, blurb: 'Snow and pine. Two shores joined by a neck of land, with the sea close on both sides of it.',
        isl: [{ x: -390, z: 0, r: 250, h: 17, c: 0 }, { x: 390, z: 0, r: 250, h: 17, c: 0 }, { x: -200, z: 0, r: 180, h: 15, c: 0 }, { x: 200, z: 0, r: 180, h: 15, c: 0 }, { x: 0, z: 0, r: 175, h: 13, c: 0 },
            { x: 0, z: -335, r: 85, h: 11, c: 1 }, { x: 0, z: 335, r: 85, h: 11, c: 2 }, { x: -280, z: -320, r: 45, h: 7, c: 3 }, { x: 280, z: 320, r: 45, h: 7, c: 4 }, { x: 280, z: -320, r: 45, h: 7, c: 5 }, { x: -280, z: 320, r: 45, h: 7, c: 6 }],
        hills: [[-430, -140, 60, 15], [430, 140, 60, 15], [-430, 150, 55, 12], [430, -150, 55, 12], [-200, 95, 50, 10], [200, -95, 50, 10], [-200, -100, 45, 8], [200, 100, 45, 8], [0, 110, 40, 7], [0, -110, 40, 7], [-95, 0, 30, 4], [95, 0, 30, 4]],
        towns: [{ x: -260, z: 0, n: 14, p: 0 }, { x: 0, z: 0, n: 12, p: 1 }, { x: 260, z: 0, n: 14, p: 2 }, { x: -480, z: 180, n: 8 }, { x: 480, z: -180, n: 8 }, { x: -130, z: 70, n: 4 }, { x: 130, z: -70, n: 4 }],
        pts: [{ x: -260, z: 0, name: 'A' }, { x: 0, z: 0, name: 'B' }, { x: 260, z: 0, name: 'C' }], flags: [{ x: -455, z: 10 }, { x: 455, z: -10 }],
        roads: [[[-600, -20], [-455, -10], [-390, 0], [-260, 0], [-130, 5], [0, 0], [130, -5], [260, 0], [390, 0], [455, 10], [600, 20]], [[-260, 0], [-350, 80], [-480, 180]], [[260, 0], [350, -80], [480, -180]]],
        strips: [[-600, -430, -78], [430, 600, 78]] },
    isles: { name: 'TWIN ISLES', look: 'green', seed: 20241031, blurb: 'The original battlefield: two green islands and the town between them.',
        isl: [{ x: -340, z: 0, r: 270, h: 24, c: 0 }, { x: 340, z: 0, r: 270, h: 24, c: 0 }, { x: 0, z: 0, r: 200, h: 17, c: 0 }, { x: 0, z: -400, r: 95, h: 12, c: 1 }, { x: 0, z: 400, r: 95, h: 12, c: 2 },
            { x: -440, z: -370, r: 55, h: 8, c: 3 }, { x: 440, z: 370, r: 55, h: 8, c: 4 }, { x: 440, z: -370, r: 55, h: 8, c: 5 }, { x: -440, z: 370, r: 55, h: 8, c: 6 }],
        hills: [[-420, -130, 55, 16], [-200, 150, 60, 14], [170, -150, 70, 18], [430, 120, 55, 16], [0, -95, 45, 12], [75, 100, 40, 9], [-60, -150, 50, 10], [250, 150, 40, 9], [-300, -170, 40, 10]],
        towns: [{ x: -250, z: -20, n: 15, p: 0 }, { x: 0, z: 10, n: 13, p: 1 }, { x: 250, z: 20, n: 15, p: 2 }, { x: -470, z: 185, n: 9 }, { x: 470, z: -185, n: 9 }, { x: -120, z: -135, n: 6 }, { x: 120, z: 135, n: 6 }],
        pts: [{ x: -250, z: -20, name: 'A' }, { x: 0, z: 10, name: 'B' }, { x: 250, z: 20, name: 'C' }], flags: [{ x: -455, z: 10 }, { x: 455, z: -10 }],
        roads: [[[-600, -40], [-470, -32], [-400, -30], [-250, -20], [-120, 0], [0, 10], [120, 15], [250, 20], [400, 30], [470, 34], [600, 40]], [[-250, -20], [-330, 60], [-470, 185]], [[250, 20], [330, -60], [470, -185]], [[0, 10], [-60, -60], [-120, -135]], [[0, 10], [60, 80], [120, 135]]],
        strips: [[-600, -430, -78], [430, 600, 78]] }
};
// a battlefield's look: the ground pictures' colours [r, g, b], the plain colours of the low setting (shore, steep rock, low
// grass, high grass, high ground, tops), the two trees' foliage, how many trees and how many of them are pines, house walls,
// the map's land colour [r, g, b, and how much r and g fall with height], and the water
const LOOKS = {
    green: { grass: [78, 122, 52], sand: [214, 196, 146], rock: [128, 122, 112], snow: [236, 240, 248], road: [92, 90, 88], lo: [0xd6c58a, 0x84806f, 0x6aa44a, 0x4d8a3c, 0x8a8f6c, 0xe8ecef], pine: [0x2f6e38, 0x3a8044], leaf: [0x4f8a3a, 0x5c9a42], trees: 900, pines: .35,
        walls: [0xe4d9bd, 0xc9b896, 0xd8a48a, 0xd9d4c7, 0xaab3bd, 0xcfae7a], mini: [100, 150, 70, 30, 40], water: 0x2f7fb0 },
    alpine: { grass: [66, 108, 50], sand: [196, 186, 150], rock: [118, 116, 112], snow: [238, 242, 250], road: [96, 92, 86], lo: [0xc8bd90, 0x7c7a70, 0x5c9644, 0x447c38, 0x868a70, 0xeaeef2], pine: [0x275c34, 0x34743f], leaf: [0x4a8238, 0x578f40], trees: 1100, pines: .7,
        walls: [0xe4d9bd, 0xd9d4c7, 0xb8a888, 0xc9b896, 0xa89878, 0xe8e0d0], mini: [88, 138, 66, 26, 36], water: 0x2c6f9c },
    desert: { grass: [188, 150, 96], sand: [228, 206, 156], rock: [158, 106, 78], snow: [216, 188, 146], road: [128, 108, 86], lo: [0xe4d09c, 0x9e6a4e, 0xbc9660, 0xaa8452, 0xb49068, 0xd8bc92], pine: [0x6c7838, 0x7c8842], leaf: [0x78883e, 0x88944a], trees: 240, pines: .08,
        walls: [0xe8dcc0, 0xd9c8a0, 0xf0e8d8, 0xcdb48a, 0xdcc6a0], mini: [198, 160, 104, 22, 26], water: 0x2a8fa8 },
    snow: { grass: [222, 228, 236], sand: [150, 154, 158], rock: [106, 108, 114], snow: [244, 247, 252], road: [118, 118, 122], lo: [0x9a9ea2, 0x6a6c72, 0xdee4ec, 0xd0d8e2, 0xb0b8c2, 0xf4f7fc], pine: [0x2a5638, 0xdce6ee], leaf: [0x5c5048, 0x6c6056], trees: 760, pines: .85,
        walls: [0x8a6a4c, 0x9c7a58, 0xb8b0a4, 0x7a5a40, 0xa8a094], mini: [212, 220, 232, 8, 8], water: 0x2a5878 }
};
const GROUND_IDS = Object.keys(GROUNDS);
const ISL = [], HILLS = [], TOWNS = [], PTS = [], FLAG_HOME = [], ROADS = [], STRIPS = [];
let GROUND = '';
function setGround(id) {
    GROUND = GROUNDS[id] ? id : 'ridge'; const G = GROUNDS[GROUND];
    const fill = (a, b) => { a.length = 0; for (const x of b) a.push(Array.isArray(x) ? x.slice() : typeof x === 'object' ? Object.assign({}, x) : x); };
    fill(ISL, G.isl); fill(HILLS, G.hills); fill(TOWNS, G.towns); fill(PTS, G.pts); fill(FLAG_HOME, G.flags); fill(ROADS, G.roads); fill(STRIPS, G.strips);
    return G;
}
setGround(new URLSearchParams(location.search).get('ground'));
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

// the HG3D engine draws the game where it can (address ?r=three keeps three.js' own renderer; so does a failed start)
const HGR = HG3D.pick('steelstorm') === 'hg' ? HG3D.createRenderer({ canvas: $('#gl'), antialias: false, powerPreference: 'high-performance' }) : null;
const renderer = HGR || new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: false, powerPreference: 'high-performance' });
function hgCheck() { if (HGR && HGR.failed && !hgCheck.done) { hgCheck.done = true; HG3D.bail('steelstorm', HGR.failed); } }
renderer.setClearColor(0x8fc8ee);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
// quality tiers really change the cost: pixel ratio, shadow map size / softness, draw distance, particle share, tree and
// rain counts, flash lights, terrain and water shaders, vehicle bump maps
const QUAL = {
    low: { pr: 0.6, sh: 0, far: 900, parts: 0.45, fogN: 250, fogF: 900, trees: .4, rain: 500, lights: 0, hi: false, shR: 0 },
    med: { pr: 0.8, sh: 1024, far: 1300, parts: 0.75, fogN: 350, fogF: 1300, trees: .7, rain: 1400, lights: 2, hi: true, shR: 110, shEvery: 2 },
    high: { pr: 1, sh: 2048, far: 1800, parts: 1, fogN: 520, fogF: 1800, trees: 1, rain: 2800, lights: 4, hi: true, shR: 160, soft: true }
};
let Q = QUAL.med;
// dynamic resolution: when frames run slow the picture is drawn at fewer pixels (down to 70% of the preset) before the preset itself drops
const DRES = { k: 1, min: .7 };
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fc8ee);
scene.fog = new THREE.Fog(0x8fc8ee, 350, 1300);
const camera = new THREE.PerspectiveCamera(70, 1, 0.5, 1300);
const hemi = new THREE.HemisphereLight(0xe6f2ff, 0x6a7a55, 1.1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d0, 2.6); sun.position.set(180, 300, 110); scene.add(sun); scene.add(sun.target);
sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.4;
// ---------- weather / time of day presets ----------
// THE REBUILD: the lighting of a battle, after Blocky Shooter's high setting: a strong sun against a coloured sky light, a
// film curve with its own exposure, and a tint of the finished picture (lo: what the dark parts are multiplied by, hi: the
// bright parts; con, sat: contrast and colour). glow: how far the sun's colour spreads along the horizon; stars; lamps:
// how brightly the towns' street lamps burn. The keys are the old game's (saves and party options keep working).
const WX = {
    noon: { name: 'Day', top: 0x2866cc, hor: 0xcfe4f6, fog: 0xb6d2ec, sun: 0xfff0d8, sunI: 3.3, dir: [.35, .82, .45], hs: 0xc4dcff, hg: 0x4f6046, hI: 1.25, exp: .98, water: 0x2f7fb0, cloud: 0xf6f9ff, cO: .92, fogK: 1,
        lo: [.93, .98, 1.08], hi: [1.05, 1.02, .95], con: .06, sat: .14, glow: .5, stars: 0, lamps: 0 },
    evening: { name: 'Sunset', top: 0x2a2478, hor: 0xff7a40, fog: 0xc98466, sun: 0xffb478, sunI: 4.4, dir: [.82, .33, -.46], hs: 0xffd4b8, hg: 0x8e6088, hI: 1.9, exp: 1.22, water: 0x3a4a7a, cloud: 0xff9c78, cO: .9, fogK: .9,
        lo: [.92, .90, 1.12], hi: [1.10, 1.0, .88], con: .04, sat: .16, glow: 1.6, stars: 0, lamps: .55 },
    overcast: { name: 'Rain', top: 0x77818c, hor: 0xa7aeb5, fog: 0x99a1a8, sun: 0xdfe4ea, sunI: .85, dir: [.2, .9, .3], hs: 0xc8d0d8, hg: 0x4c524a, hI: 1.45, exp: 1.05, water: 0x40606f, cloud: 0x8c949c, cO: .97, fogK: .55, rain: 1,
        lo: [.94, .98, 1.06], hi: [1.0, 1.0, 1.0], con: .06, sat: -.08, glow: 0, stars: 0, lamps: .5 },
    night: { name: 'Night', top: 0x03061c, hor: 0x2c3280, fog: 0x141a34, sun: 0xb4c4ff, sunI: 2.0, dir: [-.45, .62, -.64], hs: 0x94a6e6, hg: 0x44447e, hI: 1.45, exp: 1.45, water: 0x101c3c, cloud: 0x1c2448, cO: .8, fogK: .6, flares: 1,
        lo: [.80, .90, 1.22], hi: [1.04, 1.0, .92], con: .04, sat: -.22, glow: .35, stars: 1, lamps: 1 }
};
let WXK = 'noon', W0 = WX.noon;
const skyU = { top: { value: new THREE.Vector3() }, hor: { value: new THREE.Vector3() }, sunDir: { value: new THREE.Vector3(.35, .86, .25) }, sunCol: { value: new THREE.Vector3(1, 1, 1) }, fx: { value: new THREE.Vector3(.5, 0, 0) } };      // fx: x = the sun's glow along the horizon, y = stars
const sRGB3 = (h, v) => (v || new THREE.Vector3()).set((h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255);
const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false, userData: { hg: { sky: true } },      // HG3D draws it last: only the pixels nothing covered
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w * 0.9999; }',
    fragmentShader: 'uniform vec3 top, hor, sunDir, sunCol, fx; varying vec3 vD; float hsh(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }' +
        ' void main(){ vec3 d = normalize(vD), sd = normalize(sunDir); float h = clamp(d.y, -0.2, 1.0), up = max(h, 0.0); vec3 c = mix(hor, top, pow(up, 0.55)); float s = max(dot(d, sd), 0.0);' +
        ' float az = max(dot(normalize(vec3(d.x, 0.0001, d.z)), normalize(vec3(sd.x, 0.0001, sd.z))), 0.0); c += sunCol * fx.x * (pow(az, 3.0) * pow(1.0 - up, 6.0) * 0.5 + pow(s, 3.0) * 0.08);' +
        ' c += sunCol * (pow(s, 600.0) * 1.6 + pow(s, 14.0) * 0.22);' +
        ' if (fx.y > 0.0 && d.y > 0.0) { vec3 g = floor(d * 300.0); c += vec3(0.85, 0.9, 1.0) * step(0.9982, hsh(g)) * fx.y * (0.35 + 0.65 * hsh(g + 7.0)) * smoothstep(0.0, 0.3, d.y); }' +
        ' gl_FragColor = vec4(c, 1.0); }'
}));
sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
// ---------- flash lights (muzzle blasts, explosions) and night flares ----------
const FLASH = [];
function setFlashCount(n) {
    while (FLASH.length > n) { const f = FLASH.pop(); scene.remove(f.l); f.l.dispose(); }
    while (FLASH.length < n) { const l = new THREE.PointLight(0xffb060, 0, 46, 2); scene.add(l); FLASH.push({ l, t: 0, dur: 1, I: 0 }); }
}
function flash(x, y, z, hex, I, dur) {
    const n = Math.min(Q.lights, FLASH.length); if (!n) return; let f = FLASH[0];
    for (let i = 0; i < n; i++) { const o = FLASH[i]; if (o.t <= 0) { f = o; break; } else if (o.t < f.t) f = o; }
    f.l.position.set(x, y + 1.5, z); f.l.color.setHex(hex); f.I = I; f.t = f.dur = dur; f.l.intensity = I;
}
function updateFlash(dt) { for (const f of FLASH) if (f.t > 0) { f.t -= dt; const k = Math.max(0, f.t / f.dur); f.l.intensity = f.I * k * k; } }
const FLARES = [];
let flareMesh = null;
function updateFlares(dt) {
    const on = !!W0.flares && M && !M.over;
    if (!flareMesh) return;
    flareMesh.visible = on; if (!on) { for (const f of FLARES) if (f.l) f.l.intensity = 0; return; }
    const cx = camera.position.x, cz = camera.position.z;
    FLARES.forEach((f, i) => {
        f.y -= dt * 3.2; f.x += Math.sin(simTime * .3 + i) * dt * 2;
        if (f.y < 25) { const a = rnd(0, TAU), r = rnd(60, 260); f.x = cx + Math.cos(a) * r; f.z = cz + Math.sin(a) * r; f.y = rnd(170, 230); }
        flareMesh.setMatrixAt(i, MT.compose(V3.set(f.x, f.y, f.z), QT.identity(), SC.set(1.6, 1.6, 1.6)));
        if (f.l) { f.l.position.set(f.x, f.y, f.z); f.l.intensity = 30000 * (0.85 + Math.sin(simTime * 23 + i * 5) * .15); }
    });
    flareMesh.instanceMatrix.needsUpdate = true;
}
// ---------- rain: one line-segment cloud that follows the camera, animated in the vertex shader ----------
let rain = null;
function buildRain() {
    const N = 2800, pos = new Float32Array(N * 6), e = new Float32Array(N * 2), r = mulberry(5);
    for (let i = 0; i < N; i++) { const x = r() * 120 - 60, y = r() * 60, z = r() * 120 - 60; pos.set([x, y, z, x, y, z], i * 6); e[i * 2] = 0; e[i * 2 + 1] = 1; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aEnd', new THREE.BufferAttribute(e, 1));
    rain = new THREE.LineSegments(g, new THREE.ShaderMaterial({
        uniforms: { uT: { value: 0 } }, transparent: true, depthWrite: false, fog: false,
        vertexShader: 'attribute float aEnd; uniform float uT; void main(){ vec3 p = position; p.y = mod(p.y - uT * 30.0, 60.0) - 22.0 + aEnd * 1.4; p.x += aEnd * 0.25; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
        fragmentShader: 'void main(){ gl_FragColor = vec4(0.72, 0.78, 0.88, 0.38); }'
    }));
    rain.frustumCulled = false; rain.visible = false; scene.add(rain);
}
// ---------- terrain + water textures ----------
function terrainTex(seed, fn) { const n = fbm(seed, 4, 4), d = vnoise(seed + 7, 64); return cvTex(256, (x, S) => pixels(x, S, S, (u, v) => fn(n(u, v), d(u, v), u, v))); }
const TT = {};
function initTerrainTextures(L) {
    TT.grass = terrainTex(3, (n, d) => { const k = .75 + n * .5 + (d - .5) * .25; return [L.grass[0] * k, L.grass[1] * k, L.grass[2] * k]; });
    TT.sand = terrainTex(13, (n, d, u, v) => { const k = .9 + n * .18 + Math.sin((u + n * .2) * TAU * 12) * .03 + (d - .5) * .12; return [L.sand[0] * k, L.sand[1] * k, L.sand[2] * k]; });
    const rk = fbm(23, 4, 5);
    TT.rock = terrainTex(23, (n, d, u, v) => { const r = Math.abs(rk(u, v) - .5) * 2, k = .55 + r * .5 + (d - .5) * .2; return [L.rock[0] * k, L.rock[1] * k, L.rock[2] * k]; });
    TT.snow = terrainTex(33, (n, d) => { const k = .92 + n * .1 + (d - .5) * .06; return [L.snow[0] * k, L.snow[1] * k, L.snow[2] * k]; });
    TT.road = terrainTex(43, (n, d) => { const k = .8 + n * .25 + (d > .8 ? .25 : 0); return [L.road[0] * k, L.road[1] * k, L.road[2] * k]; });
    // road + airstrip mask over the whole map
    const cv = document.createElement('canvas'); cv.width = cv.height = 1024; const x = cv.getContext('2d'), S = 1024 / 1600, P = (a, b) => [(a + 800) * S, (b + 800) * S];
    x.fillStyle = '#000'; x.fillRect(0, 0, 1024, 1024); x.strokeStyle = '#fff'; x.lineCap = x.lineJoin = 'round'; x.lineWidth = 5.5; x.filter = 'blur(1px)';
    for (const r of ROADS) { x.beginPath(); r.forEach((p, i) => { const q = P(p[0], p[1]); i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]); }); x.stroke(); }
    x.fillStyle = '#fff'; for (const s of STRIPS) { const a = P(s[0], s[2] - 9), b = P(s[1], s[2] + 9); x.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); }
    for (const t of TOWNS) { const q = P(t.x, t.z); x.beginPath(); x.arc(q[0], q[1], 16 * S * 2, 0, TAU); x.fill(); }
    TT.mask = new THREE.CanvasTexture(cv); TT.mask.colorSpace = THREE.NoColorSpace;
    // water normals: sum of travelling sines + noise, tileable
    if (TT.waterN) return;
    const wn = fbm(61, 4, 4), wn2 = fbm(71, 16, 2);
    TT.waterN = cvTex(256, (x2, S2) => pixels(x2, S2, S2, (u, v) => {
        const h = (uu, vv) => Math.sin((uu * 3 + vv * 2) * TAU) * .06 + Math.sin((uu * 5 - vv * 7) * TAU) * .04 + wn(uu, vv) * .9 + wn2(uu, vv) * .35;
        const e = 1 / 256, dx = (h(u + e, v) - h(u - e, v)) * 26, dy = (h(u, v + e) - h(u, v - e)) * 26, l = Math.hypot(dx, dy, 1);
        return [(-dx / l * .5 + .5) * 255, (-dy / l * .5 + .5) * 255, (1 / l * .5 + .5) * 255];
    }), false);
}
const terrainLo = new THREE.MeshLambertMaterial({ vertexColors: true });
let terrainHi = null, waterHi = null, waterLo = null, waterU = { uTime: { value: 0 }, uSky: { value: new THREE.Color(0xbfdcf2) } };
// the same ground and water for the HG3D engine, written against its hook points (the three.js patches below stay for ?r=three)
const HG_TERRAIN = `
            vec2 wuv = vTW.xz; float hgt = vTW.y, slope = 1.0 - clamp(vTN.y, 0.0, 1.0);
            float det = texture(tRock, wuv * 0.55).r;
            vec3 grass = mix(texture(tGrass, wuv * 0.11).rgb, texture(tGrass, wuv * 0.017).rgb * vec3(1.1, 1.05, 0.8), 0.4);
            float wSand = 1.0 - smoothstep(1.3, 3.2, hgt + det * 0.8);
            float wRock = smoothstep(0.17, 0.32, slope + max(hgt - 24.0, 0.0) * 0.03);
            float wSnow = smoothstep(30.5, 34.0, hgt + det * 2.5) * (1.0 - smoothstep(0.4, 0.55, slope));
            vec3 col = grass;
            if (wSand > 0.002) col = mix(col, texture(tSand, wuv * 0.09).rgb, wSand);
            float wR = wRock * (1.0 - wSand * 0.6); if (wR > 0.002) col = mix(col, texture(tRock, wuv * 0.06).rgb, wR);
            if (wSnow > 0.002) col = mix(col, texture(tSnow, wuv * 0.05).rgb, wSnow);
            float road = texture(tMask, vTW.xz / 1600.0 + 0.5).r * step(0.6, hgt);
            if (road > 0.002) col = mix(col, texture(tRoad, wuv * 0.08).rgb, road * 0.92);
            col = mix(col, col * vec3(0.5, 0.72, 0.85), smoothstep(-0.3, -7.0, hgt));
            col *= 0.84 + det * 0.32;
            alb *= col;`;
const HG_WATER = `
            { vec2 nuv = vec2(vWW.x, -vWW.z) * 0.015 + uWOff;
              vec3 mN = normalize(texture(tWN, nuv).xyz * 2.0 - 1.0 + texture(tWN, nuv * 0.37 + vec2(uTime * 0.011, -uTime * 0.007)).xyz * 2.0 - 1.0); mN.xy *= 0.28;
              vec3 Nw = normalize(vec3(mN.x, mN.z, -mN.y)), V = normalize(uCamPos.xyz - vWW), H = normalize(V + uSunDir[0].xyz);
              float ndl = max(dot(Nw, uSunDir[0].xyz), 0.0);
              vec3 amb = mix(uHemiGround.rgb, uHemiSky.rgb, dot(Nw, uHemiDir.xyz) * 0.5 + 0.5) + uAmbient.rgb;
            #ifdef PIXEL_PL
              amb += hgPoint(Nw, vWW);
            #endif
              c = alb * (amb + uSunCol[0].rgb * ndl) + uSpecCol * (uSpec.y * pow(max(dot(Nw, H), 0.0), uSpec.x) * ndl) * uSunCol[0].rgb;
              float fres = pow(1.0 - clamp(dot(V, Nw), 0.0, 1.0), 3.0);
              c = mix(c, uSky, fres * 0.6); alpha = mix(alpha, 1.0, fres * 0.8); }`;
function makeTerrainHi() {
    const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
    m.userData.hg = { vDecl: 'out vec3 vTW; out vec3 vTN;', vMain: 'vTW = wp; vTN = N;', fDecl: 'uniform sampler2D tGrass, tSand, tRock, tSnow, tRoad, tMask; in vec3 vTW; in vec3 vTN;', fAlbedo: HG_TERRAIN,
        uniforms: { tGrass: { value: TT.grass }, tSand: { value: TT.sand }, tRock: { value: TT.rock }, tSnow: { value: TT.snow }, tRoad: { value: TT.road }, tMask: { value: TT.mask } } };
    m.onBeforeCompile = sh => {
        Object.assign(sh.uniforms, { tGrass: { value: TT.grass }, tSand: { value: TT.sand }, tRock: { value: TT.rock }, tSnow: { value: TT.snow }, tRoad: { value: TT.road }, tMask: { value: TT.mask } });
        sh.vertexShader = 'varying vec3 vTW; varying vec3 vTN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vTW = (modelMatrix * vec4(transformed, 1.0)).xyz; vTN = normalize(mat3(modelMatrix) * objectNormal);');
        sh.fragmentShader = 'uniform sampler2D tGrass, tSand, tRock, tSnow, tRoad, tMask; varying vec3 vTW; varying vec3 vTN;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
            vec2 wuv = vTW.xz; float hgt = vTW.y, slope = 1.0 - clamp(vTN.y, 0.0, 1.0);
            float det = texture2D(tRock, wuv * 0.55).r;
            vec3 grass = mix(texture2D(tGrass, wuv * 0.11).rgb, texture2D(tGrass, wuv * 0.017).rgb * vec3(1.1, 1.05, 0.8), 0.4);
            float wSand = 1.0 - smoothstep(1.3, 3.2, hgt + det * 0.8);
            float wRock = smoothstep(0.17, 0.32, slope + max(hgt - 24.0, 0.0) * 0.03);
            float wSnow = smoothstep(30.5, 34.0, hgt + det * 2.5) * (1.0 - smoothstep(0.4, 0.55, slope));
            // a texture is read only where it shows (most of the ground is plain grass: 4 reads a pixel instead of 8)
            vec3 col = grass;
            if (wSand > 0.002) col = mix(col, texture2D(tSand, wuv * 0.09).rgb, wSand);
            float wR = wRock * (1.0 - wSand * 0.6); if (wR > 0.002) col = mix(col, texture2D(tRock, wuv * 0.06).rgb, wR);
            if (wSnow > 0.002) col = mix(col, texture2D(tSnow, wuv * 0.05).rgb, wSnow);
            float road = texture2D(tMask, vTW.xz / 1600.0 + 0.5).r * step(0.6, hgt);
            if (road > 0.002) col = mix(col, texture2D(tRoad, wuv * 0.08).rgb, road * 0.92);
            col = mix(col, col * vec3(0.5, 0.72, 0.85), smoothstep(-0.3, -7.0, hgt));
            col *= 0.84 + det * 0.32;
            diffuseColor.rgb *= col;`);
    };
    m.customProgramCacheKey = () => 'terrain3';
    return m;
}
function makeWaterHi(col) {
    const m = new THREE.MeshPhongMaterial({ color: col, normalMap: TT.waterN, normalScale: new THREE.Vector2(.28, .28), shininess: 90, specular: 0x9aa4ad, transparent: true, opacity: .82, depthWrite: false });
    TT.waterN.repeat.set(90, 90);
    m.userData.hg = { vDecl: 'out vec3 vWW;', vMain: 'vWW = wp;', fDecl: 'uniform sampler2D tWN; uniform float uTime; uniform vec3 uSky; uniform vec2 uWOff; in vec3 vWW;', fFinal: HG_WATER,
        uniforms: { tWN: { value: TT.waterN }, uWOff: { value: TT.waterN.offset }, uTime: waterU.uTime, uSky: waterU.uSky } };
    m.onBeforeCompile = sh => {
        Object.assign(sh.uniforms, waterU);
        sh.fragmentShader = 'uniform float uTime; uniform vec3 uSky;\n' + sh.fragmentShader
            .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;', 'vec3 mapN = normalize(texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0 + texture2D( normalMap, vNormalMapUv * 0.37 + vec2(uTime * 0.011, -uTime * 0.007) ).xyz * 2.0 - 1.0);'))
            .replace('#include <opaque_fragment>', 'float fres = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 3.0);\n outgoingLight = mix(outgoingLight, uSky, fres * 0.6);\n diffuseColor.a = mix(diffuseColor.a, 1.0, fres * 0.8);\n#include <opaque_fragment>');
    };
    m.customProgramCacheKey = () => 'water2';
    return m;
}
function applyQuality() {
    Q = QUAL[save.settings.quality] || QUAL.med;
    renderer.setPixelRatio(Q.pr * DRES.k * Math.min(window.devicePixelRatio || 1, 1.25));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    const changed = applyQuality.q !== Q || !applyQuality.t; applyQuality.q = Q; applyQuality.t = !!terrain;
    $('#ov').width = Math.floor(window.innerWidth * 0.75); $('#ov').height = Math.floor(window.innerHeight * 0.75);
    if (!changed) return;      // a window resize: nothing else to redo
    const on = !!Q.sh;
    renderer.shadowMap.autoUpdate = !(Q.shEvery > 1); renderer.shadowMap.needsUpdate = true;
    renderer.shadowMap.enabled = on; renderer.shadowMap.type = Q.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap; sun.castShadow = on;
    if (on && sun.shadow.mapSize.x !== Q.sh) { sun.shadow.mapSize.set(Q.sh, Q.sh); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    const sc = sun.shadow.camera; sc.left = sc.bottom = -(Q.shR || 100); sc.right = sc.top = Q.shR || 100; sc.near = 20; sc.far = 900; sc.updateProjectionMatrix();
    camera.far = Q.far; camera.updateProjectionMatrix(); applyFog();
    setFlashCount(Q.lights + (W0.flares && Q.lights ? 2 : 0)); assignFlareLights();
    if (terrain) { terrain.material = Q.hi ? terrainHi : terrainLo; waterMesh.material = Q.hi ? waterHi : waterLo; }
    for (const t of treeChunks) t.count = Math.round(t.userData.n * Q.trees);
    if (rain) rain.geometry.setDrawRange(0, Q.rain * 2);
    if (typeof setVehicleDetail === 'function') setVehicleDetail(save.settings.quality);
    scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); });
}
function applyFog() { scene.fog.near = Q.fogN * W0.fogK; scene.fog.far = Q.fogF * Math.max(.6, W0.fogK); }
function applyWeather(k) {
    if (k === 'random' || !WX[k]) k = Object.keys(WX)[Math.floor(Math.random() * 4)];
    WXK = k; W0 = WX[k];
    sRGB3(W0.top, skyU.top.value); sRGB3(W0.hor, skyU.hor.value); sRGB3(W0.sun, skyU.sunCol.value); skyU.sunCol.value.multiplyScalar(k === 'night' ? .4 : 1);
    skyU.sunDir.value.set(W0.dir[0], W0.dir[1], W0.dir[2]).normalize();
    scene.fog.color.setHex(W0.fog); scene.background.setHex(W0.fog); renderer.setClearColor(W0.fog);
    sun.color.setHex(W0.sun); sun.intensity = W0.sunI; hemi.color.setHex(W0.hs); hemi.groundColor.setHex(W0.hg); hemi.intensity = W0.hI;
    renderer.toneMappingExposure = W0.exp;
    skyU.fx.value.set(W0.glow || 0, W0.stars || 0, 0);
    renderer.gradeLo = W0.lo; renderer.gradeHi = W0.hi; renderer.gradeContrast = W0.con || 0; renderer.gradeSaturation = W0.sat || 0;      // HG3D's tint of the finished picture (three.js, the fallback, has none)
    lampLight();
    if (waterHi) { waterHi.color.setHex(W0.water); waterLo.color.setHex(W0.water); waterU.uSky.value.setHex(W0.hor); }
    if (cloudMesh) { cloudMesh.material.color.setHex(W0.cloud); cloudMesh.material.opacity = W0.cO; }
    if (rain) rain.visible = !!W0.rain;
    applyFog(); if (save) { setFlashCount(Q.lights + (W0.flares && Q.lights ? 2 : 0)); assignFlareLights(); }
    return k;
}
function assignFlareLights() { FLARES.forEach((f, i) => { f.l = W0.flares && FLASH.length > Q.lights + i ? FLASH[Q.lights + i].l : null; if (f.l) { f.l.color.setHex(0xffe6b0); f.l.distance = 320; } }); }
let terrain, waterMesh, miniCv, cloudMesh, ptViz = [], flagViz = [], treeChunks = [];
// ============================================================
// THE SCENERY KIT (assets/s_kit.hgm, made in Blender, checked by tools/ss-check-kit.mjs): houses by number of floors, two
// roofs, a pine, a broadleaf, a palm, rocks. What the game collides with does not change: a kit house is a unit box
// stretched over the same box (BLD) the code-made house filled, a tree stands where the code-made one stood. Without
// the file (or with ?old=1) the code-made shapes are used; when the file arrives the world is built once more.
// Materials by name: walls and roof take each house's colour, foliage the look's tree colours, the rest as painted.
// ============================================================
const KIT = { ready: false, parts: {}, mats: {}, look: null, tex: null };
function loadKit() {
    if (KIT.wait || /[?&]old=1/.test(location.search)) return KIT.wait;
    return KIT.wait = Packs.ready.then(() => fetch(AST('s_kit.hgm'))).then(r => { if (!r.ok) throw new Error('none'); return r.arrayBuffer(); }).then(buf => {
        const F = hgmOpen(buf); KIT.tris = {};
        for (const ob of F.J.objects) { KIT.parts[ob.name] = (ob.prims || []).map(p => ({ geo: F.geo(p), mat: F.J.materials[p.material].name })); KIT.tris[ob.name] = (ob.prims || []).reduce((n, p) => n + p.index.n / 3, 0); }
        KIT.tex = F.picture(); KIT.ready = true;
        if (terrain && !(typeof M !== 'undefined' && M)) useGround(GROUND, true);
    }).catch(e => { KIT.none = String(e && e.message || e); });
}
function kitMat(name, tintHex) {
    const key = name + (tintHex === undefined ? '' : ':' + tintHex);
    return KIT.mats[key] || (KIT.mats[key] = new THREE.MeshLambertMaterial({ map: KIT.tex, color: tintHex === undefined ? 0xffffff : tintHex }));
}
// one instanced mesh for each material of a kit part: list of things, their matrix, and (walls, roof) their colour
function kitPlace(name, list, matOf, colOf, tintOf) {
    const out = [], cc = new THREE.Color(); if (!list.length) return out;
    for (const pr of KIT.parts[name] || []) {
        const own = colOf && (pr.mat === 'walls' || pr.mat === 'roof'), im = new THREE.InstancedMesh(pr.geo, kitMat(pr.mat, tintOf ? tintOf(pr.mat) : undefined), list.length);
        list.forEach((b, i) => { im.setMatrixAt(i, matOf(b, i)); if (own) im.setColorAt(i, cc.setHex(colOf(b))); });
        im.castShadow = im.receiveShadow = true; im.computeBoundingSphere(); scene.add(im); out.push(im);
    }
    return out;
}
const kitFloors = b => clamp(Math.round((b.h - 1.5) / 3.3), 2, 5);
// foliage is painted light and neutral in the kit: the look's tree colour goes over it, lifted so the picture's shading shows
const kitLeaf = hex => { const c = new THREE.Color(hex).multiplyScalar(2.6); return c.setRGB(Math.min(1, c.r), Math.min(1, c.g), Math.min(1, c.b)).getHex(); };
// street lamps (made with each battlefield): how brightly they burn follows the lighting
const LAMPS = { head: null, pool: null, n: 0 };
function lampLight() {
    const k = W0.lamps || 0;
    if (LAMPS.head) { LAMPS.head.visible = k > 0; LAMPS.head.material.color.setRGB(1.6 * k + .2, 1.25 * k + .15, .7 * k + .1); }
    if (LAMPS.pool) { LAMPS.pool.visible = k > 0; LAMPS.pool.material.opacity = .17 * k; }
}
function buildLamps(places) {
    const spots = []; places.forEach((b, i) => { if (i % 2) return; const sx = i % 4 ? 1 : -1, x = b.x + sx * (b.w / 2 + 2.2), z = b.z + (b.d / 2 + 2.2), y = H(x, z); if (y > 1.5 && GH(x, z) === y) spots.push([x, y, z]); });
    LAMPS.n = spots.length; if (!spots.length) { LAMPS.head = LAMPS.pool = null; return; }
    const mt = new THREE.Matrix4(), q0 = new THREE.Quaternion(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(1, 1, 1);
    const post = new THREE.InstancedMesh(new THREE.CylinderGeometry(.09, .13, 5.2, 5).translate(0, 2.6, 0), new THREE.MeshLambertMaterial({ color: 0x2c2f34 }), spots.length);
    const head = new THREE.InstancedMesh(new THREE.SphereGeometry(.5, 8, 6).translate(0, 5.4, 0), new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false }), spots.length);
    // the light under a lamp: a soft cone from the head to the ground and a glow round the head (the ground mesh is too coarse to lay a flat pool of light on it)
    const cone = new THREE.ConeGeometry(4.6, 5.9, 14, 1, true).translate(0, 2.55, 0), glow = new THREE.SphereGeometry(1.5, 10, 8).translate(0, 5.4, 0), parts = [cone, glow].map(g0 => g0.index ? g0.toNonIndexed() : g0);
    const pg = mergeGeometries(parts, false);
    const pool = new THREE.InstancedMesh(pg, new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .16, side: THREE.DoubleSide, fog: false }), spots.length);
    spots.forEach((p, i) => { mt.compose(v1.set(p[0], p[1], p[2]), q0, v2); post.setMatrixAt(i, mt); head.setMatrixAt(i, mt); pool.setMatrixAt(i, mt); });
    post.castShadow = true; pool.renderOrder = 2; for (const m of [post, head, pool]) { m.computeBoundingSphere(); scene.add(m); }
    LAMPS.head = head; LAMPS.pool = pool; lampLight();
}
// everything buildWorld put in the scene, so another battlefield can take its place
const WORLD = [];
function clearWorld() {
    for (const o of WORLD) {
        scene.remove(o); if (HGR) HGR.release(o);
        o.traverse(c => { if (c.geometry) c.geometry.dispose(); for (const m of c.material ? (Array.isArray(c.material) ? c.material : [c.material]) : []) { if (m.map && m.map !== TT.waterN && m.map !== KIT.tex) m.map.dispose(); m.dispose(); } });
    }
    WORLD.length = 0; LAMPS.head = LAMPS.pool = null; KIT.mats = {}; BLD.length = 0; ptViz.length = 0; flagViz.length = 0; treeChunks.length = 0; FLARES.length = 0; rain = null; terrain = null;
    for (const k of ['grass', 'sand', 'rock', 'snow', 'road', 'mask']) if (TT[k]) { if (HGR) HGR.release(null, [TT[k]]); TT[k].dispose(); TT[k] = null; }
    if (terrainHi) terrainHi.dispose(); if (waterHi) waterHi.dispose();
}
// the battlefield a match asks for: built now if it is not the one standing (true when it was)
function useGround(id, again) {
    id = GROUNDS[id] ? id : 'ridge'; if (id === GROUND && terrain && !again && KIT.ready === KIT.built) return false;
    setGround(id); buildWorld(); applyQuality.q = null; applyQuality(); applyWeather(WXK); return true;
}
function buildWorld() {
    clearWorld(); const G = GROUNDS[GROUND], L = LOOKS[G.look] || LOOKS.green, had = new Set(scene.children), kit = KIT.ready; KIT.built = kit; KIT.look = L;
    initTerrainTextures(L); terrainHi = makeTerrainHi(); waterHi = makeWaterHi(L.water); waterLo = new THREE.MeshLambertMaterial({ color: L.water, transparent: true, opacity: .84, depthWrite: false });
    const rng = mulberry(G.seed);
    // terrain: smooth normals, vertex colours for the low tier
    const N = 150, SZ = EXT * 2 + 120, g = new THREE.PlaneGeometry(SZ, SZ, N, N); g.rotateX(-PI / 2);
    const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) p.setY(i, H(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    const nrm = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
        const h = p.getY(i), ny = nrm.getY(i), j = (rng() - .5) * .06;
        if (h < -8) c.setHex(0x2c6a8f); else if (h < -1) c.setHex(0x5aa4b8); else if (h < 1.6) c.setHex(L.lo[0]);
        else if (ny < 0.8 && h > 6) c.setHex(L.lo[1]);
        else if (h < 20) c.setHex(L.lo[2]).lerp(new THREE.Color(L.lo[3]), (h - 1.6) / 18);
        else if (h < 30) c.setHex(L.lo[4]); else c.setHex(L.lo[5]);
        c.offsetHSL(0, 0, j); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    terrain = new THREE.Mesh(g, Q.hi ? terrainHi : terrainLo); terrain.receiveShadow = true; terrain.matrixAutoUpdate = false; scene.add(terrain);
    waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-PI / 2), Q.hi ? waterHi : waterLo);
    waterMesh.renderOrder = 1; waterMesh.receiveShadow = false; scene.add(waterMesh);
    // houses: walls with a window texture, gable roofs, hangars by the airstrips
    const places = [], palette = L.walls;
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
    const wallTex = cvTex(64, (x, S) => { x.fillStyle = '#fff'; x.fillRect(0, 0, S, S); x.fillStyle = 'rgba(0,0,0,.06)'; for (let i = 0; i < 40; i++) x.fillRect(rng() * S, rng() * S, 3, 1); for (let r = 0; r < 2; r++) for (let q = 0; q < 2; q++) { x.fillStyle = '#3c4a58'; x.fillRect(8 + q * 32, 8 + r * 32, 16, 18); x.fillStyle = '#e8e4da'; x.fillRect(15 + q * 32, 8 + r * 32, 2, 18); x.fillRect(8 + q * 32, 16 + r * 32, 16, 2); } });
    wallTex.repeat.set(2, 2);
    const bg = new THREE.BoxGeometry(1, 1, 1); bg.translate(0, .5, 0);
    const roofG = new THREE.CylinderGeometry(.72, .72, 1, 3, 1); roofG.rotateZ(PI / 2); roofG.rotateY(PI / 2); roofG.scale(1, .6, 1.05); roofG.translate(0, .18, 0);
    const bm = new THREE.InstancedMesh(bg, new THREE.MeshLambertMaterial({ map: wallTex }), places.length), rm = new THREE.InstancedMesh(roofG, new THREE.MeshLambertMaterial({ color: 0x8a4a34 }), places.length);
    const mt = new THREE.Matrix4(), q0 = new THREE.Quaternion(), cc = new THREE.Color(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
    places.forEach((b, i) => {
        bm.setMatrixAt(i, mt.compose(v1.set(b.x, b.base, b.z), q0, v2.set(b.w, b.h, b.d))); bm.setColorAt(i, cc.setHex(b.col));
        rm.setMatrixAt(i, mt.compose(v1.set(b.x, b.base + b.h, b.z), q0, v2.set(b.w + .8, Math.min(b.w, b.d) * .5, b.d + .8))); rm.setColorAt(i, cc.setHex(i % 3 ? 0x8a4a34 : 0x5a5f66));
    });
    bm.castShadow = rm.castShadow = true; bm.receiveShadow = rm.receiveShadow = true; scene.add(bm, rm); buildLamps(places);
    if (kit && KIT.parts.house3 && KIT.parts.roof1) {
        bm.visible = rm.visible = false; places.forEach((b, i) => { b.i = i; });
        for (let f = 2; f <= 5; f++) kitPlace('house' + f, places.filter(b => kitFloors(b) === f), b => mt.compose(v1.set(b.x, b.base, b.z), q0, v2.set(b.w, b.h, b.d)).clone(), b => b.col);
        for (let r = 1; r <= 2; r++) kitPlace(KIT.parts['roof' + r] ? 'roof' + r : 'roof1', places.filter(b => (b.i % 4 === 3 ? 2 : 1) === r), b => mt.compose(v1.set(b.x, b.base + b.h, b.z), q0, v2.set(b.w + .8, Math.min(b.w, b.d) * .5, b.d + .8)).clone(), b => b.i % 3 ? 0x9a5a44 : 0x6a6f76);
    }
    const hg = new THREE.CylinderGeometry(1, 1, 1, 12, 1, false, 0, PI); hg.rotateZ(PI / 2); hg.rotateY(PI / 2);
    const hm = new THREE.InstancedMesh(hg, new THREE.MeshLambertMaterial({ color: 0x8c949c }), 4); let hi = 0;
    for (const s of STRIPS) for (let k = 0; k < 2; k++) { const x = s[0] + 30 + k * 34, z = s[2] + 24 * Math.sign(s[2]), y = H(x, z) - .5; hm.setMatrixAt(hi++, mt.compose(v1.set(x, y, z), q0, v2.set(14, 9, 22))); }
    hm.castShadow = hm.receiveShadow = true; scene.add(hm);
    // trees: two kinds (pine, broadleaf), instanced in a 4 x 4 grid of chunks so the frustum culls them
    const T1 = []; cy(T1, .3, .42, 2.4, 5, 0, 1.2, 0, 0x6b4a2b); cy(T1, 0, 2.3, 3.6, 7, 0, 3.6, 0, L.pine[0]); cy(T1, 0, 1.7, 2.8, 7, 0, 5.4, 0, L.pine[1]); cy(T1, 0, 1.1, 2, 6, 0, 6.9, 0, 0x46904e);
    const T2 = []; cy(T2, .32, .45, 2.6, 5, 0, 1.3, 0, 0x6b4a2b); sph(T2, 2.3, 0, 4.2, 0, L.leaf[0], 1, .85, 1); sph(T2, 1.6, .9, 5.2, .4, L.leaf[1], 1, .8, 1);
    const toRGB = gg => { const a = gg.attributes.color, n = a.count, o = new Float32Array(n * 3); for (let i = 0; i < n; i++) { o[i * 3] = a.getX(i); o[i * 3 + 1] = a.getY(i); o[i * 3 + 2] = a.getZ(i); } gg.setAttribute('color', new THREE.BufferAttribute(o, 3)); gg.deleteAttribute('uv'); return gg; };
    const tg = [toRGB(merge(T1)), toRGB(merge(T2))], spots = [[], []];
    for (let k = 0; k < 9000 && spots[0].length + spots[1].length < L.trees; k++) {
        const x1 = (rng() * 2 - 1) * (EXT - 40), z1 = (rng() * 2 - 1) * (EXT - 40), h = H(x1, z1);
        if (h < 3 || h > 28) continue;
        let bad = false; for (const b of BLD) if (x1 > b.x0 - 3 && x1 < b.x1 + 3 && z1 > b.z0 - 3 && z1 < b.z1 + 3) { bad = true; break; }
        for (const q of PTS) if (Math.hypot(x1 - q.x, z1 - q.z) < 30) bad = true;
        if (Math.abs(x1) > 400 && Math.abs(z1) < 90) bad = true;      // keep the base areas open
        if (Math.abs(x1) > 420 && Math.abs(z1 - Math.sign(x1) * 78) < 22) bad = true;      // airstrips
        if (!bad) spots[h > 14 || rng() < L.pines ? 0 : 1].push([x1, h, z1, 0.5 + rng() * 0.45, rng() * TAU]);
    }
    const tmat = new THREE.MeshLambertMaterial({ vertexColors: true });
    for (let kind = 0; kind < 2; kind++) for (let cx = 0; cx < 4; cx++) for (let cz = 0; cz < 4; cz++) {
        const L = spots[kind].filter(s => Math.floor((s[0] + EXT) / (EXT / 2)) === cx && Math.floor((s[2] + EXT) / (EXT / 2)) === cz); if (!L.length) continue;
        const im = new THREE.InstancedMesh(tg[kind], tmat, L.length);
        L.forEach((s, i) => { QT.setFromAxisAngle(V3.set(0, 1, 0), s[4]); im.setMatrixAt(i, mt.compose(v1.set(s[0], s[1] - .2, s[2]), QT, v2.set(s[3], s[3] * (0.9 + rng() * .5), s[3]))); });
        im.computeBoundingSphere(); im.castShadow = true; im.userData.n = L.length; im.count = Math.round(L.length * Q.trees); { const nm = kind === 0 ? 'pine' : G.look === 'desert' && KIT.parts.palm ? 'palm' : 'leaf';
            if (kit && KIT.parts[nm]) for (const k2 of kitPlace(nm, L, (s2, i) => { im.getMatrixAt(i, mt); return mt.clone(); }, null, m => m === 'foliage' ? kitLeaf(kind === 0 ? KIT.look.pine[0] : KIT.look.leaf[0]) : undefined)) { k2.userData.n = L.length; k2.count = Math.round(L.length * Q.trees); treeChunks.push(k2); }
            else { scene.add(im); treeChunks.push(im); } }
    }
    // rocks on slopes and shores
    const rg = new THREE.DodecahedronGeometry(1, 0), rk = new THREE.InstancedMesh(rg, new THREE.MeshLambertMaterial({ color: 0x8a867c, flatShading: true }), 160); let rn = 0;
    for (let k = 0; k < 4000 && rn < 160; k++) { const x1 = (rng() * 2 - 1) * (EXT - 20), z1 = (rng() * 2 - 1) * (EXT - 20), h = H(x1, z1); if (h < .5 || Math.abs(H(x1 + 4, z1) - h) < 1.2 && h > 2.5) continue; const s = 1 + rng() * 2.6; QT.setFromEuler(new THREE.Euler(rng() * 3, rng() * 3, 0)); rk.setMatrixAt(rn++, mt.compose(v1.set(x1, h, z1), QT, v2.set(s, s * .7, s * 1.2))); }
    rk.count = rn; rk.castShadow = rk.receiveShadow = true; if (kit && KIT.parts.rock1) { const list = []; for (let i = 0; i < rn; i++) list.push(i); for (const nm of ['rock1', 'rock2']) if (KIT.parts[nm]) kitPlace(nm, list.filter(i => (i % 2 ? 'rock2' : 'rock1') === nm || !KIT.parts.rock2), i => { rk.getMatrixAt(i, mt); return mt.clone(); }); } else scene.add(rk);
    // clouds (flat blobs high above)
    const cg = new THREE.IcosahedronGeometry(1, 1); cloudMesh = new THREE.InstancedMesh(cg, new THREE.MeshLambertMaterial({ color: 0xf4f8ff, transparent: true, opacity: .92, emissive: 0x666a70 }), 44);
    for (let i = 0; i < 44; i++) cloudMesh.setMatrixAt(i, mt.compose(v1.set((rng() * 2 - 1) * 1000, 190 + rng() * 110, (rng() * 2 - 1) * 1000), q0, v2.set(25 + rng() * 40, 5 + rng() * 6, 18 + rng() * 25)));
    scene.add(cloudMesh);
    // capture points: ring on the ground, a flag and a tall light beam
    PTS.forEach((pt) => {
        pt.y = H(pt.x, pt.z);
        const m = new THREE.MeshBasicMaterial({ color: 0xcccccc }), grp = new THREE.Group();
        const ring = new THREE.Mesh(new THREE.TorusGeometry(CAP_R, 0.7, 4, 40).rotateX(PI / 2), m); ring.position.y = 0.6;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(.25, .25, 16, 5), new THREE.MeshLambertMaterial({ color: 0x444444 })); pole.position.y = 8;
        const flag = new THREE.Mesh(new THREE.BoxGeometry(7, 4, .2), m); flag.position.set(3.5, 14, 0);
        const bmat = new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: .22, depthWrite: false }), beam = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 260, 8, 1, true), bmat); beam.position.y = 130;
        grp.add(ring, pole, flag, beam); grp.position.set(pt.x, pt.y, pt.z); scene.add(grp);
        ptViz.push({ grp, m, bmat });
    });
    // capture-the-flag flags + home pads
    FLAG_HOME.forEach((h, t) => {
        h.y = H(h.x, h.z);
        const m = new THREE.MeshBasicMaterial({ color: teamCol(t) }), grp = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, 9, 5), new THREE.MeshLambertMaterial({ color: 0xdddddd })); pole.position.y = 4.5;
        const cloth = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.6, .15), m); cloth.position.set(2.25, 7.6, 0);
        const bmat = new THREE.MeshBasicMaterial({ color: teamCol(t), transparent: true, opacity: .25, depthWrite: false }), beam = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 200, 8, 1, true), bmat); beam.position.y = 100;
        grp.add(pole, cloth, beam); scene.add(grp);
        const pad = new THREE.Mesh(new THREE.TorusGeometry(14, .6, 4, 32).rotateX(PI / 2), m); pad.position.set(h.x, h.y + .6, h.z); scene.add(pad);
        flagViz.push({ grp, pad, cloth });
    });
    // flare sprites for the night preset
    flareMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xfff1c0 }), 3);
    for (let i = 0; i < 3; i++) FLARES.push({ x: rnd(-300, 300), y: rnd(60, 220), z: rnd(-200, 200), l: null });
    flareMesh.frustumCulled = false; flareMesh.visible = false; scene.add(flareMesh);
    buildRain();
    setPointsVisible(false); setFlagsVisible(false);
    // minimap: baked once
    miniCv = document.createElement('canvas'); miniCv.width = miniCv.height = 180;
    const mx = miniCv.getContext('2d'), im = mx.createImageData(180, 180);
    for (let py = 0; py < 180; py++) for (let px = 0; px < 180; px++) {
        const h = H((px / 180 - .5) * EXT * 2, (py / 180 - .5) * EXT * 2), o = (py * 180 + px) * 4; let r, gg, b;
        if (h < -6) { r = 22; gg = 66; b = 104; } else if (h < 0) { r = 40; gg = 100; b = 140; } else if (h < 2) { r = 190; gg = 176; b = 120; } else if (h < 24) { const k = h / 24; r = L.mini[0] - k * L.mini[3]; gg = L.mini[1] - k * L.mini[4]; b = L.mini[2]; } else { r = 150; gg = 150; b = 140; }
        im.data[o] = r; im.data[o + 1] = gg; im.data[o + 2] = b; im.data[o + 3] = 255;
    }
    mx.putImageData(im, 0, 0);
    mx.strokeStyle = 'rgba(60,60,60,.7)'; mx.lineWidth = 1.5; const k = 180 / (EXT * 2);
    for (const r of ROADS) { mx.beginPath(); r.forEach((p2, i) => i ? mx.lineTo((p2[0] + EXT) * k, (p2[1] + EXT) * k) : mx.moveTo((p2[0] + EXT) * k, (p2[1] + EXT) * k)); mx.stroke(); }
    for (const o of scene.children) if (!had.has(o)) WORLD.push(o);
}
function setPointsVisible(v) { ptViz.forEach(p => p.grp.visible = v); }
function setFlagsVisible(v) { flagViz.forEach(f => { f.grp.visible = v; f.pad.visible = v; }); }
function updatePointViz(pts) {
    ptViz.forEach((p, i) => { const o = pts && pts[i] ? pts[i].own : -1, c = o < 0 ? 0xcccccc : teamCol(o); p.m.color.setHex(c); p.bmat.color.setHex(c); });
}
// per frame: sky dome, sun + shadow box follow the camera, water time, rain, flash lights, flares
function updateWorld(dt) {
    sky.position.copy(camera.position); sky.scale.setScalar(camera.far * .92);
    const d = skyU.sunDir.value;
    sun.position.set(camera.position.x + d.x * 400, camera.position.y + d.y * 400, camera.position.z + d.z * 400); sun.target.position.copy(camera.position);
    waterU.uTime.value += dt; if (TT.waterN) { TT.waterN.offset.x += dt * .006; TT.waterN.offset.y += dt * .003; }
    if (rain && rain.visible) { rain.position.copy(camera.position); rain.material.uniforms.uT.value += dt; }
    updateFlash(dt); updateFlares(dt);
}
