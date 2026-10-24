// ---------- WORLD / STRUCTURES ----------
// Blocks are collected as specs, then merged into ONE mesh per material (+ one mesh of edge lines).
// That turns ~600 draw calls into ~15, which is the single biggest speed-up on weak GPUs.


const WORLD_COLORS = { concrete: 0x6b7280, concreteDark: 0x4b5563, steel: 0x334155, wood: 0x92633a, woodDark: 0x6b4423, sand: 0xa8956b, bound: 0x151522, post: 0x2a2f38,
                       brick: 0x8a4b3a, brickDark: 0x5e3328, leaf: 0x3f7d3a, leafDark: 0x2e5f2c, stone: 0x7d7a73, asphalt: 0x34373e,
                       accR: 0xb91c1c, accB: 0x1d4ed8, accG: 0x15803d, accY: 0xca8a04, rope: 0xb8955a, rust: 0x8a4a2a, cloud: 0xeef3fa, cloudShade: 0xc3d0e2,
                       // 4.0 maps: mall floors / walls, military greens, painted lines, glass, chain-link and escalator steps
                       tile: 0xd6d0c2, plaster: 0xc9ced6, olive: 0x56613a, khaki: 0x9c8b62, paint: 0xe9e7df, rubber: 0x1b1d22,
                       glass: 0xa6dcf5, fence: 0xaab2bb, escF: 0x5b6270, escB: 0x5b6270 };
const WORLD_PROPS = { steel: [0.38, 0.65], post: [0.45, 0.6], accR: [0.5, 0.2], accB: [0.5, 0.2], accG: [0.5, 0.2], accY: [0.5, 0.2], bound: [0.9, 0], cloud: [1, 0], cloudShade: [1, 0],
                      tile: [0.32, 0.05], rubber: [0.9, 0], escF: [0.4, 0.6], escB: [0.4, 0.6] };
const GLOW_COLORS = { glowC: 0x22d3ee, glowP: 0xf472b6, glowL: 0xa3e635, glowY: 0xfbbf24, glowW: 0xffd9a0, glowR: 0xff3b3b, glowB: 0x60a5fa };
// 4.0: see-through world pieces (no shadows, no outlines). Glass is see-through, the fence is a chain-link pattern.
const SEE_THRU = { glass: 1, fence: 1 };


// World lighting extras, all inside the existing shaders (no extra passes, lights or shadows):
//  - "contact shadow": surfaces get darker as they approach the ground (blocks only)
//  - cool fill: the shaded side takes on the sky's color, so sunlit vs shadow reads warm vs cool
//  - a faint sky rim on edges facing away from you
//  - ground haze: fog is a little thicker low down, so distance and tall structures read better
function worldLighting(m, ao) {
    m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, { uRim: LIGHT_U.uRim, uCool: LIGHT_U.uCool, uHaze: LIGHT_U.uHaze });
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vWY;')
            .replace('#include <project_vertex>', '#include <project_vertex>\nvWY = (modelMatrix * vec4(transformed, 1.0)).y;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWY;\nuniform vec3 uRim; uniform vec3 uCool; uniform float uHaze;')
            .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n' + (ao ? 'float gAO = mix(0.42, 1.0, smoothstep(0.0, 1.5, vWY));\nreflectedLight.indirectDiffuse *= gAO; reflectedLight.indirectSpecular *= gAO; reflectedLight.directDiffuse *= mix(0.75, 1.0, gAO);\n' : '') + 'reflectedLight.indirectDiffuse *= uCool;')
            .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nfloat rimF = 1.0 - abs(dot(normal, normalize(vViewPosition)));\ntotalEmissiveRadiance += uRim * rimF * rimF * rimF;')
            .replace('#include <fog_fragment>', '#ifdef USE_FOG\nfloat fogF = smoothstep(fogNear, fogFar, vFogDepth);\nfogF = clamp(fogF * (1.0 + uHaze * exp(-max(vWY, 0.0) * 0.12)), 0.0, 1.0);\ngl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogF);\n#endif');
    };
    m.customProgramCacheKey = () => ao ? 'worldAO' : 'worldFlat';
}
const addGroundAO = (m) => worldLighting(m, true);
// 4.0 mall escalators: grooved steps whose texture scrolls the way the escalator moves (escF = toward +x, escB = toward -x)
let fenceTex = null;
const escTexs = {};
function escTex(key) {
    if (escTexs[key]) return escTexs[key];
    const [c, g] = makeCanvas(64);
    g.fillStyle = '#8b919c'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#3d424b'; for (let x = 0; x < 64; x += 8) g.fillRect(x, 0, 3, 64);
    g.fillStyle = '#facc15'; g.fillRect(0, 0, 64, 3); g.fillRect(0, 61, 64, 3);          // yellow edge lines
    return (escTexs[key] = canvasTex(c, 1));
}
function animEscalators(dt) {
    if (currentMap !== 'mall') return;
    if (escTexs.escF) escTexs.escF.offset.x = (escTexs.escF.offset.x - dt * ESC_SPEED * 0.5) % 1;
    if (escTexs.escB) escTexs.escB.offset.x = (escTexs.escB.offset.x + dt * ESC_SPEED * 0.5) % 1;
}
// Low quality swaps the PBR materials for the much cheaper Lambert lighting model
function worldMat(key) {
    if (GLOW_COLORS[key] !== undefined) return mats[key] || (mats[key] = new THREE.MeshBasicMaterial({ color: GLOW_COLORS[key], toneMapped: false }));
    if (key === 'lampHead') return mats[key] || (mats[key] = new THREE.MeshBasicMaterial({ color: theme.lamp, toneMapped: false }));
    const ck = Q.lite ? key + '_l' : key;
    if (mats[ck]) return mats[ck];
    if (key === 'glass') {      // 4.0 mall railings + skylight: faint blue glass
        const m = Q.lite ? new THREE.MeshLambertMaterial({ color: WORLD_COLORS.glass, transparent: true, opacity: 0.28, depthWrite: false })
                         : new THREE.MeshStandardMaterial({ color: WORLD_COLORS.glass, transparent: true, opacity: 0.24, roughness: 0.08, metalness: 0.4, depthWrite: false, envMapIntensity: theme.envInt * 1.5 });
        m.emissive = new THREE.Color(0x0c2a3a);
        return (mats[ck] = m);
    }
    if (key === 'fence') {      // 4.0 military base: chain-link (a see-through diamond pattern)
        if (!fenceTex) {
            const [c, g] = makeCanvas(64);
            g.clearRect(0, 0, 64, 64); g.strokeStyle = 'rgba(235,240,245,1)'; g.lineWidth = 2.2;
            for (let i = -64; i <= 64; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); g.beginPath(); g.moveTo(i + 64, 0); g.lineTo(i, 64); g.stroke(); }
            fenceTex = canvasTex(c, 1);
        }
        const o = { color: WORLD_COLORS.fence, map: fenceTex, alphaTest: 0.35, side: THREE.DoubleSide };
        return (mats[ck] = Q.lite ? new THREE.MeshLambertMaterial(o) : new THREE.MeshStandardMaterial(Object.assign(o, { roughness: 0.5, metalness: 0.6, envMapIntensity: theme.envInt })));
    }
    const p = WORLD_PROPS[key] || [0.85, 0.02], tex = key === 'cloud' || key === 'cloudShade' ? null : (key === 'escF' || key === 'escB') ? escTex(key) : detailTex;
    const m = Q.lite ? new THREE.MeshLambertMaterial({ color: WORLD_COLORS[key], map: tex })
                     : new THREE.MeshStandardMaterial({ color: WORLD_COLORS[key], map: tex, roughness: p[0], metalness: p[1], envMapIntensity: theme.envInt });
    // clouds glow softly and skip the ground contact-shadow (their tops sit at y = 0)
    if (key === 'cloud' || key === 'cloudShade') { worldLighting(m, false); m.emissive = new THREE.Color(WORLD_COLORS[key]).multiplyScalar(key === 'cloud' ? 0.28 : 0.16); }
    else addGroundAO(m);
    return (mats[ck] = m);
}
function floorMat() {
    const ck = Q.lite ? 'floor_l' : 'floor';
    if (mats[ck]) return mats[ck];
    const m = Q.lite ? new THREE.MeshLambertMaterial({ color: theme.floor, map: floorTex })
                     : new THREE.MeshStandardMaterial({ color: theme.floor, map: floorTex, roughness: 0.78, metalness: 0.0, envMapIntensity: theme.envInt });
    worldLighting(m, false);
    return (mats[ck] = m);
}
function refreshWorldMaterials() {
    if (!worldGroup) return;
    worldGroup.traverse(o => { const k = o.userData.matKey; if (k) o.material = k === 'floor' ? floorMat() : worldMat(k); });
    applyFloorTint(); updateCones();
}


function addBlock(x, y0, z, w, h, d, key, solid = true) {
    worldBlocks.push({ x, y: y0 + h / 2, z, w, h, d, key, solid });
    if (solid) solids.push(new THREE.Box3(new V3(x - w / 2, y0, z - d / 2), new V3(x + w / 2, y0 + h, z + d / 2)));
}
// collision only, nothing drawn (smooth walking surface under rope-bridge planks, invisible hand rails)
// thru (4.0): you walk into it but bullets and line of sight go straight through (glass railings, chain-link fences)
function addSolid(x, y0, z, w, h, d, thru = false) { const b = new THREE.Box3(new V3(x - w / 2, y0, z - d / 2), new V3(x + w / 2, y0 + h, z + d / 2)); if (thru) b.thru = true; solids.push(b); }


// ---------- CLIMBABLE PIECES ----------
// Stairs that wind around a solid tower. Every step is +0.5 (you just walk up, no jumping).
// Flights run along the faces with a landing at each corner; one lap climbs 3m.
// Faces: 0 = -z, 1 = +x, 2 = +z, 3 = -x. The first flight runs along face `rot`, the second along rot+1.
// Bridges should leave from those two faces - higher flights would be under the bridge deck.
function stairTower(cx, cz, h, size, key = 'concrete', rot = 0, stepKey = 'steel', stairs = true) {
    addBlock(cx, 0, cz, size, h, size, key);
    addBlock(cx, h, cz, size - 1.2, 0.08, size - 1.2, 'glowY', false);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) addBlock(cx + sx * (size / 2 - 0.25), h, cz + sz * (size / 2 - 0.25), 0.5, 1.1, 0.5, 'post');
    // a few accent bands so the tower doesn't look like a plain box
    for (let y = 3; y < h - 0.5; y += 3) addBlock(cx, y - 0.15, cz, size + 0.06, 0.3, size + 0.06, 'concreteDark', false);
    if (!stairs) return;
    const a = size / 2 + 1.2, rise = 0.5, nPer = Math.floor(size / 1.2), run = size / nPer;     // steps fill the whole face
    const C = [[-a, -a], [a, -a], [a, a], [-a, a]];
    let y = 0, k = 0;
    for (let side = 0; y < h - 0.01 && side < 40; side++) {
        const c0 = C[(side + rot) % 4], c1 = C[(side + rot + 1) % 4];
        y = Math.min(h, y + rise);
        addBlock(cx + c0[0], y - 0.5, cz + c0[1], 2.4, 0.5, 2.4, 'concreteDark');     // corner landing
        const dx = Math.sign(c1[0] - c0[0]), dz = Math.sign(c1[1] - c0[1]);
        for (let i = 0; i < nPer && y < h - 0.01; i++) {
            y = Math.min(h, y + rise);
            const t = 1.2 + (i + 0.5) * run;
            addBlock(cx + c0[0] + dx * t, y - 0.5, cz + c0[1] + dz * t, dx ? run : 2.4, 0.5, dz ? run : 2.4, (k++ % 2) ? stepKey : 'concrete');
        }
    }
}
// A sagging rope bridge (or a stiff steel catwalk) between two points along one axis.
// The walking surface is an invisible smooth deck; the planks, ropes and posts you see are decoration.
let bridgeRects = [];
// 4.0 mall escalators: standing on one carries you along it. { x0, x1, z0, z1, y0, y1, vx, vz }
let escalators = [];
const ESC_SPEED = 2.4;
function ropeBridge(x1, z1, y1, x2, z2, y2, opt = {}) {
    const width = opt.width || 3, steel = !!opt.steel, rails = opt.rails !== false;
    const alongX = Math.abs(z2 - z1) < 0.01;
    const len = alongX ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
    const n = Math.max(2, Math.round(len / 0.8)), seg = len / n;
    const sag = steel ? 0 : (opt.sag !== undefined ? opt.sag : Math.min(1.1, len * 0.03));
    const P = (t) => [lerp(x1, x2, t), lerp(z1, z2, t), lerp(y1, y2, t) - sag * 4 * t * (1 - t)];
    const box = (px, pz, y0, along, h, across, key, solid) => alongX ? (solid ? addSolid(px, y0, pz, along, h, across) : addBlock(px, y0, pz, along, h, across, key, false))
                                                                    : (solid ? addSolid(px, y0, pz, across, h, along) : addBlock(px, y0, pz, across, h, along, key, false));
    const side = (px, pz, s) => alongX ? [px, pz + s] : [px + s, pz];
    const ys = [];
    for (let i = 0; i < n; i++) {
        const [px, pz, py] = P((i + 0.5) / n); ys.push(py);
        box(px, pz, py - 0.3, seg + 0.02, 0.3, width, null, true);                                   // walking surface
        box(px, pz, py - 0.16, seg * (steel ? 0.98 : 0.8), 0.16, width, steel ? 'steel' : (i % 2 ? 'wood' : 'woodDark'), false);
        if (!steel && rails) for (const s of [-1, 1]) {
            const [rx, rz] = side(px, pz, s * (width / 2 - 0.05));
            box(rx, rz, py + 0.95, seg + 0.02, 0.07, 0.07, 'rope', false);                           // hand rope
            box(rx, rz, py + 0.45, seg + 0.02, 0.05, 0.05, 'rope', false);
            if (i % 4 === 0) box(rx, rz, py - 0.1, 0.14, 1.15, 0.14, 'woodDark', false);            // rope post
        }
        if (steel && rails) for (const s of [-1, 1]) {
            const [rx, rz] = side(px, pz, s * (width / 2 - 0.05));
            box(rx, rz, py + 0.95, seg + 0.02, 0.08, 0.08, 'accY', false);
            if (i % 3 === 0) box(rx, rz, py, 0.08, 1.0, 0.08, 'steel', false);
        }
    }
    // invisible hand rails (in chunks so they never hang far below the deck)
    if (rails) for (let i = 0; i < n; i += 4) {
        const j = Math.min(n, i + 4), lo = Math.min(...ys.slice(i, j)), hi = Math.max(...ys.slice(i, j));
        const [cx, cz] = P((i + j) / 2 / n);
        for (const s of [-1, 1]) { const [rx, rz] = side(cx, cz, s * (width / 2 - 0.05)); box(rx, rz, lo - 0.05, seg * (j - i), hi - lo + 1.05, 0.12, null, true); }
    }
    // tall posts at both ends
    if (!steel) for (const t of [0, 1]) { const [px, pz, py] = P(t); for (const s of [-1, 1]) { const [rx, rz] = side(px, pz, s * (width / 2 - 0.05)); box(rx, rz, py - 0.2, 0.22, 1.5, 0.22, 'woodDark', false); } }
    bridgeRects.push(alongX ? [Math.min(x1, x2), z1 - width / 2, len, width] : [x1 - width / 2, Math.min(z1, z2), width, len]);
}
// Stacked shipping container (2.6 tall) with door frames on the ends
function container(x, z, level, alongX, key) {
    const [w, d] = alongX ? [6.2, 2.5] : [2.5, 6.2];
    addBlock(x, level * 2.6, z, w, 2.6, d, key);
    const fx = alongX ? w / 2 + 0.03 : 0, fz = alongX ? 0 : d / 2 + 0.03;
    for (const s of [-1, 1]) addBlock(x + fx * s, level * 2.6 + 0.1, z + fz * s, alongX ? 0.06 : d - 0.2, 2.4, alongX ? d - 0.2 : 0.06, 'steel', false);
    addBlock(x, level * 2.6 + 2.6, z, w - 0.4, 0.04, d - 0.4, 'concreteDark', false);
}


// Box with world-scaled UVs so the detail texture tiles evenly no matter the block size
function blockGeo(b) {
    const g = new THREE.BoxGeometry(b.w, b.h, b.d);
    g.translate(b.x, b.y, b.z);
    const pos = g.attributes.position, nrm = g.attributes.normal, uv = g.attributes.uv;
    const T = 0.5;
    for (let i = 0; i < pos.count; i++) {
        const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i));
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        if (nx > 0.5) uv.setXY(i, z * T, y * T); else if (ny > 0.5) uv.setXY(i, x * T, z * T); else uv.setXY(i, x * T, y * T);
    }
    return g;
}


function disposeGroup(grp) {
    grp.traverse(o => { if (o.geometry && o.geometry !== sharedBox) o.geometry.dispose(); });
}


// tiny seeded random generator: multiplayer builds the exact same random map on every computer
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function buildWorld(mapId = currentMap, seed) {
    const realRandom = Math.random;
    if (seed !== undefined) Math.random = mulberry32(seed);
    try { buildWorldInner(mapId); } finally { Math.random = realRandom; }
}
function buildWorldInner(mapId) {
    currentMap = mapId;
    if (worldGroup) { scene.remove(worldGroup); disposeGroup(worldGroup); }
    worldGroup = new THREE.Group();
    scene.add(worldGroup);
    solids = []; worldBlocks = []; lampSpots = []; bridgeRects = []; escalators = [];
    ARENA = (MAPS[mapId] && MAPS[mapId].size) || 100; spawnPt = [0, 0];
    VOID = !!(MAPS[mapId] && MAPS[mapId].void); cageOverride = null;
    const A = ARENA;
    clearDecals();


    const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), floorMat());
    floorMesh.userData.matKey = 'floor';
    floorMesh.rotation.x = -Math.PI / 2; floorMesh.receiveShadow = true;
    floorMesh.visible = !VOID;
    worldGroup.add(floorMesh);


    // Arena walls
    if (VOID) {     // sky map: invisible walls (you fall long before you'd reach them anyway)
        addSolid(0, -40, -A - 1, 2 * A + 4, 70, 2); addSolid(0, -40, A + 1, 2 * A + 4, 70, 2); addSolid(A + 1, -40, 0, 2, 70, 2 * A + 4); addSolid(-A - 1, -40, 0, 2, 70, 2 * A + 4);
    } else {
    addBlock(0, 0, -A - 1, 2 * A + 4, 22, 2, 'bound'); addBlock(0, 0, A + 1, 2 * A + 4, 22, 2, 'bound');
    addBlock(A + 1, 0, 0, 2, 22, 2 * A + 4, 'bound');  addBlock(-A - 1, 0, 0, 2, 22, 2 * A + 4, 'bound');
    if (!mats.neon) mats.neon = new THREE.MeshBasicMaterial({ color: theme.neon, toneMapped: false });
    const neonGeos = [];
    [[0, -A + 0.1, 2 * A, 0.3], [0, A - 0.1, 2 * A, 0.3], [-A + 0.1, 0, 0.3, 2 * A], [A - 0.1, 0, 0.3, 2 * A]].forEach(([x, z, w, d]) => {
        for (const y of [6, 12]) { const g = new THREE.BoxGeometry(w, 0.4, d); g.translate(x, y, z); neonGeos.push(g); }
    });
    worldGroup.add(new THREE.Mesh(mergeGeometries(neonGeos), mats.neon));
    neonGeos.forEach(g => g.dispose());
    }


    ({ blockyard: mapBlockyard, downtown: mapDowntown, fortress: mapFortress, plains: mapPlains,
       skybridge: mapSkybridge, shipyard: mapShipyard, temple: mapTemple, sky: mapSky, mall: mapMall, military: mapMilitary }[mapId] || mapBlockyard)();
    const cage = buildRamCage(); cageArea = cage;
    if (!VOID) edgeDecor(mapId);


    finalizeWorld();
    buildSolidGrid();
    buildNav();
    placeCageRam(cage); cageArea = cage;
    buildMinimapStatic();
    applyFloorTint();
}
// Street lamps (glowing heads + fake light pools on the floor - no real lights needed)
function lampRing(rings) {
    for (const [R, n, off] of rings) {
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + off;
            const x = Math.cos(a) * R, z = Math.sin(a) * R;
            if (pointInSolid(new V3(x, 1, z), 1.6)) continue;
            addLamp(x, z);
        }
    }
}


function mapBlockyard() {
    // two pairs of tall watchtowers, each pair joined by a rope bridge
    for (const z of [-58, 58]) {
        stairTower(-20, z, 12, 6, 'concrete', 1); stairTower(20, z, 12, 6, 'concrete', 3);
        ropeBridge(-17, z, 12, 17, z, 12);
    }
    const types = ['crates', 'stairs', 'fort', 'wall', 'arch', 'ziggurat', 'tower', 'pillars', 'containers', 'catwalk', 'rubble', 'bunker', 'scaffold', 'lookout'];
    let bag = [];
    for (let gx = -78; gx <= 78; gx += 26) {
        for (let gz = -78; gz <= 78; gz += 26) {
            if (Math.abs(gx) < 20 && Math.abs(gz) < 20) continue;   // keep the spawn clear
            if (Math.abs(Math.abs(gz) - 58) < 12 && Math.abs(gx) < 34) continue;   // watchtowers live here
            if (Math.random() < 0.22) continue;
            if (bag.length === 0) bag = types.slice().sort(() => Math.random() - 0.5);
            const jx = gx + (Math.random() * 6 - 3), jz = gz + (Math.random() * 6 - 3);
            addStructure(bag.pop(), jx, jz, Math.floor(Math.random() * 4));
        }
    }
    // a couple of crates near spawn for early cover
    addStructure('crates', 12, -10, 0);
    addStructure('wall', -13, 9, 1);
    lampRing([[34, 6, 0.3], [58, 10, 0]]);
}


// City grid: 20x20 blocks with 10-wide streets, a plaza in the middle
function building(x, z, w, d, h, key) {
    addBlock(x, 0, z, w, h, d, key);
    addBlock(x, h, z, w + 0.4, 0.4, d + 0.4, 'concreteDark');                  // roof trim
    // lit window bands on every floor (non-solid, merged into one glowing mesh)
    const lit = Math.random() < 0.75;
    for (let y = 1.6; y < h - 0.8; y += 3) {
        if (!lit || Math.random() < 0.25) continue;
        addBlock(x, y, z - d / 2 - 0.03, w * 0.8, 0.6, 0.06, 'glowW', false);
        addBlock(x, y, z + d / 2 + 0.03, w * 0.8, 0.6, 0.06, 'glowW', false);
        addBlock(x - w / 2 - 0.03, y, z, 0.06, 0.6, d * 0.8, 'glowW', false);
        addBlock(x + w / 2 + 0.03, y, z, 0.06, 0.6, d * 0.8, 'glowW', false);
    }
}
function car(x, z, alongX) {
    const acc = ['accR', 'accB', 'accG', 'accY', 'steel'][Math.floor(Math.random() * 5)];
    const [w, d] = alongX ? [4, 1.9] : [1.9, 4];
    addBlock(x, 0.3, z, w, 1.0, d, acc);
    addBlock(x, 1.3, z, alongX ? 2.2 : 1.7, 0.75, alongX ? 1.7 : 2.2, 'steel');
    addBlock(x, 0, z, w * 0.8, 0.3, d * 0.8, 'asphalt');
}
// Zig-zag fire escape up one face of a building. Flights alternate between two lanes so a flight
// is never right above another one (you'd bonk your head). The last flight always ends at the roof.
function fireEscape(cx, cz, w, d, top, face) {
    const alongX = face === 0 || face === 2, sgn = face === 1 || face === 2 ? 1 : -1;
    const half = (alongX ? w : d) / 2, out = (alongX ? d : w) / 2 + 0.2;
    let flights = Math.ceil(top / 5); if (flights % 2 === 0) flights++;
    const steps = 10, rise = top / (flights * steps), run = (2 * half - 4.8) / steps;
    const put = (u, lane, y, along, across, key) => {
        const o = sgn * (out + (lane + 0.5) * across);
        if (alongX) addBlock(cx + u, y - 0.5, cz + o, along, 0.5, across, key); else addBlock(cx + o, y - 0.5, cz + u, across, 0.5, along, key);
    };
    // railing: invisible collision + a visible steel bar (o = distance out from the wall)
    const rail = (u, o, y, along, alongU = true) => {
        const w = alongU ? along : 0.1, d = alongU ? 0.1 : along, px = alongX ? u : sgn * o, pz = alongX ? sgn * o : u;
        const [W, D] = alongX ? [w, d] : [d, w];
        addSolid(cx + px, y - 0.5, cz + pz, W, 1.5, D);
        addBlock(cx + px, y + 0.9, cz + pz, W, 0.07, D, 'post', false);
    };
    let y = 0;
    for (let k = 0; k < flights; k++) {
        const lane = k % 2, dir = k % 2 ? -1 : 1;
        for (let i = 0; i < steps; i++) {
            y += rise;
            const u = dir * (-half + 2.4 + (i + 0.5) * run);
            put(u, lane, y, run, 2.4, i % 2 ? 'steel' : 'post');
            rail(u, out + (lane + 1) * 2.4 - 0.06, y, run);                  // outer side of this flight
            if (lane === 1) rail(u, out + 2.4 + 0.06, y, run);                // between the lanes
            if (i % 3 === 0) { const o = out + (lane + 1) * 2.4 - 0.06; if (alongX) addBlock(cx + u, y, cz + sgn * o, 0.07, 0.9, 0.07, 'post', false); else addBlock(cx + sgn * o, y, cz + u, 0.07, 0.9, 0.07, 'post', false); }
        }
        if (k < flights - 1) {       // landing across both lanes
            const u = dir * (half - 1.2);
            if (alongX) addBlock(cx + u, y - 0.5, cz + sgn * (out + 2.4), 2.4, 0.5, 4.8, 'steel'); else addBlock(cx + sgn * (out + 2.4), y - 0.5, cz + u, 4.8, 0.5, 2.4, 'steel');
            rail(u, out + 4.8 - 0.06, y, 2.4);
            rail(dir * (half - 0.06), out + 2.4, y, 4.8, false);
        }
    }
}
function mapDowntown() {
    const centers = [-75, -45, -15, 15, 45, 75];
    // rooftop routes: buildings with fire escapes, joined across the street by rope bridges
    const hero = { '-45,-45': [12, 2], '-15,-45': [12, -1], '45,45': [15, 0], '15,45': [15, -1], '45,-15': [9, 1], '45,-45': [9, -1] };
    for (const cx of centers) for (const cz of centers) {
        if (Math.abs(cx) < 20 && Math.abs(cz) < 20) continue;       // central plaza
        const key = ['brick', 'concrete', 'brickDark', 'concreteDark', 'stone'][Math.floor(Math.random() * 5)];
        const hr = hero[cx + ',' + cz];
        if (hr) { building(cx, cz, 16, 16, hr[0], key); if (hr[1] >= 0) fireEscape(cx, cz, 16, 16, hr[0] + 0.4, hr[1]); continue; }
        const r = Math.random();
        if (r < 0.3) {
            const h = 10 + Math.floor(Math.random() * 4) * 3;
            building(cx, cz, 16, 16, h, key);
            if (Math.random() < 0.35) fireEscape(cx, cz, 16, 16, h + 0.4, Math.floor(Math.random() * 4));
        }
        else if (r < 0.55) { building(cx, cz - 4.5, 16, 7, 10 + Math.floor(Math.random() * 3) * 3, key); building(cx, cz + 4.5, 16, 7, [4, 10, 13][Math.floor(Math.random() * 3)], key === 'brick' ? 'stone' : 'brick'); }
        else if (r < 0.8) {
            // corner shops: low enough to climb onto
            for (const [ox, oz] of [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5]]) if (Math.random() < 0.8) building(cx + ox, cz + oz, 7, 7, 3 + Math.floor(Math.random() * 2) * 1.2, ['brick', 'stone', 'concrete'][Math.floor(Math.random() * 3)]);
        } else {
            // pocket park
            addBlock(cx, 0, cz, 17, 0.4, 17, 'leafDark');
            for (let t = 0; t < 3; t++) tree(cx + (Math.random() - 0.5) * 11, cz + (Math.random() - 0.5) * 11);
            addBlock(cx, 0.4, cz, 3, 0.6, 1, 'wood');
        }
    }
    ropeBridge(-36.8, -45, 12.4, -23.2, -45, 12.4);
    ropeBridge(23.2, 45, 15.4, 36.8, 45, 15.4);
    ropeBridge(45, -23.2, 9.4, 45, -36.8, 9.4);
    // parked cars along the streets
    for (const s of [-60, -30, 30, 60]) for (let i = 0; i < 4; i++) {
        const t = -85 + Math.random() * 170;
        if (Math.abs(t) < 24 && Math.abs(s) < 35) continue;
        const alongZ = Math.random() < 0.5, o = s + (Math.random() < 0.5 ? -3 : 3);
        const [x, z] = alongZ ? [o, t] : [t, o];
        if (pointInSolid(new V3(x, 1, z), 2.6)) continue;
        car(x, z, !alongZ);
    }
    // plaza: fountain + benches
    addBlock(0, 0, -15, 7, 0.9, 1, 'stone'); addBlock(0, 0, -9, 7, 0.9, 1, 'stone');
    addBlock(-3, 0, -12, 1, 0.9, 5, 'stone'); addBlock(3, 0, -12, 1, 0.9, 5, 'stone');
    addBlock(0, 0, -12, 1.2, 3, 1.2, 'stone'); addBlock(0, 0.1, -12, 5, 0.1, 5, 'glowC', false);
    addBlock(10, 0, 8, 3, 0.6, 1, 'wood'); addBlock(-10, 0, 8, 3, 0.6, 1, 'wood');
    const lamps = [];
    for (const a of [-60, -30, 0, 30, 60]) for (const b of [-60, -30, 0, 30, 60]) lamps.push([a + 3, b + 3]);
    lamps.forEach(([x, z]) => { if (!pointInSolid(new V3(x, 1, z), 1.6)) addLamp(x, z); });
}


function tree(x, z, big = 1) {
    const h = (5 + Math.random() * 3) * big;          // tall enough that nobody can camp in the leaves
    addBlock(x, 0, z, 0.9 * big, h, 0.9 * big, 'woodDark');
    addBlock(x, h - 1, z, 4.2 * big, 2.6 * big, 4.2 * big, 'leaf');
    addBlock(x, h + 1.6 * big - 1, z, 2.6 * big, 1.6 * big, 2.6 * big, 'leafDark');
}
function mapFortress() {
    const R = 22, T = 2, H = 4.5, gate = 7;
    // four walls, each with a gate in the middle and a walkway on top (reachable by stairs)
    for (const side of [0, 1, 2, 3]) {
        const seg = (a, b) => {
            const len = b - a, mid = (a + b) / 2;
            if (side === 0) addBlock(mid, 0, -R, len, H, T, 'stone'); if (side === 1) addBlock(mid, 0, R, len, H, T, 'stone');
            if (side === 2) addBlock(-R, 0, mid, T, H, len, 'stone'); if (side === 3) addBlock(R, 0, mid, T, H, len, 'stone');
        };
        seg(-R - T / 2, -gate / 2); seg(gate / 2, R + T / 2);
        // battlements
        for (let t = -R + 1; t < R; t += 3) {
            if (Math.abs(t) < gate / 2 + 1) continue;
            if (side === 0) addBlock(t, H, -R - 0.6, 1.4, 1, 0.8, 'stone'); if (side === 1) addBlock(t, H, R + 0.6, 1.4, 1, 0.8, 'stone');
            if (side === 2) addBlock(-R - 0.6, H, t, 0.8, 1, 1.4, 'stone'); if (side === 3) addBlock(R + 0.6, H, t, 0.8, 1, 1.4, 'stone');
        }
    }
    // corner towers
    for (const [x, z] of [[-R, -R], [R, -R], [-R, R], [R, R]]) {
        addBlock(x, 0, z, 7, 8, 7, 'concreteDark');
        addBlock(x, 8, z, 7.6, 0.5, 7.6, 'steel');
        addBlock(x, 8.5, z, 5, 0.1, 5, 'glowY', false);
    }
    // stairs up to the walls from inside
    for (const [x, z, rx] of [[-14, -R + 2.6, 1], [14, R - 2.6, -1]]) for (let i = 0; i < 3; i++) addBlock(x + rx * i * 2, 0, z, 2, 1.5 * (i + 1), 3, 'sand');
    for (const [x, z, rz] of [[-R + 2.6, 14, -1], [R - 2.6, -14, 1]]) for (let i = 0; i < 3; i++) addBlock(x, 0, z + rz * i * 2, 3, 1.5 * (i + 1), 2, 'sand');
    // keep in the middle-back, some crates for cover
    addBlock(0, 0, -11, 9, 5, 6, 'concrete'); addBlock(0, 5, -11, 9.4, 0.4, 6.4, 'accR');
    for (let i = 0; i < 3; i++) addBlock(-6.5 + i * 1.5 - 0.5, 0, -11, 1.5, 1.4 * (i + 1), 3, 'sand');
    addBlock(0, 5.4, -11, 6, 0.1, 3, 'glowP', false);
    // watchtower in the yard: a bridge up from the keep roof, and one down to the east wall
    stairTower(0, 9, 8.5, 5, 'stone', 0, 'steel', false);
    ropeBridge(0, 6.5, 8.5, 0, -7.8, 5.4);
    ropeBridge(2.5, 9, 8.5, R - T / 2, 9, H, { sag: 0.2 });
    addStructure('crates', 12, -4, 0); addStructure('crates', -10, 7, 1);
    // outer battlefield: sparse cover and a few lookouts
    const types = ['wall', 'rubble', 'crates', 'pillars', 'bunker', 'containers', 'lookout', 'scaffold'];
    for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2, r = 45 + Math.random() * 42;
        addStructure(types[i % types.length], Math.cos(a) * r, Math.sin(a) * r, Math.floor(Math.random() * 4));
    }
    lampRing([[31, 8, 0.4], [64, 10, 0.1]]);
    for (const [x, z] of [[-6, -R + 4], [6, -R + 4], [-6, R - 4], [6, R - 4]]) addLamp(x, z);
}


// is this ground spot free (nothing solid nearby, not under a bridge)?
function freeSpot(x, z, r) {
    if (pointInSolid(new V3(x, 1, z), r)) return false;
    for (const [bx, bz, bw, bd] of bridgeRects) if (x > bx - r - 2 && x < bx + bw + r + 2 && z > bz - r - 2 && z < bz + bd + r + 2) return false;
    return Math.hypot(x - spawnPt[0], z - spawnPt[1]) > r + 3;
}
function mapPlains() {
    // lookout towers: a pair joined by a long rope bridge, plus two loners
    stairTower(-30, -50, 11, 5, 'wood', 1, 'woodDark'); stairTower(30, -50, 11, 5, 'wood', 3, 'woodDark');
    ropeBridge(-27.5, -50, 11, 27.5, -50, 11);
    stairTower(55, 42, 13, 5, 'stone', 0); stairTower(-58, 38, 9, 5, 'wood', 2, 'woodDark');
    for (let i = 0; i < 34; i++) {
        const a = Math.random() * Math.PI * 2, r = 14 + Math.random() * 78;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (freeSpot(x, z, 6)) tree(x, z, 0.9 + Math.random() * 0.5);
    }
    for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2, r = 12 + Math.random() * 80;
        const x = Math.cos(a) * r, z = Math.sin(a) * r, n = 2 + Math.floor(Math.random() * 3);
        if (!freeSpot(x, z, 3)) continue;
        for (let k = 0; k < n; k++) { const sz = 1 + Math.random() * 2; addBlock(x + (Math.random() - 0.5) * 3, 0, z + (Math.random() - 0.5) * 3, sz * 1.3, sz * (0.6 + Math.random() * 0.8), sz, Math.random() < 0.5 ? 'stone' : 'concreteDark'); }
    }
    for (let i = 0; i < 14; i++) {     // hay bales (stacked ones are a quick way up high)
        const a = Math.random() * Math.PI * 2, r = 16 + Math.random() * 70;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (!freeSpot(x, z, 3)) continue;
        addBlock(x, 0, z, 2.2, 1.6, 3, 'sand');
        if (i % 3 === 0) { addBlock(x + 2.3, 0, z, 2.2, 1.6, 3, 'sand'); addBlock(x + 2.3, 1.6, z, 2.2, 1.6, 3, 'sand'); }
    }
    // ruined farmhouses
    for (const [x, z] of [[40, -25], [-45, 18]]) {
        addBlock(x, 0, z - 5, 12, 4, 1, 'wood'); addBlock(x - 5.5, 0, z, 1, 4, 9, 'wood'); addBlock(x + 5.5, 0, z + 1, 1, 2.5, 7, 'woodDark');
        addBlock(x + 2, 0, z + 5, 5, 3, 1, 'wood'); addBlock(x - 2, 4, z - 2, 8, 0.4, 5, 'woodDark');
        addStructure('crates', x, z + 1, 0);
    }
    addStructure('tower', 0, 62, 0); addStructure('ziggurat', -62, -62, 0); addStructure('scaffold', 60, -10, 1);
    lampRing([[26, 5, 0.2]]);
}
