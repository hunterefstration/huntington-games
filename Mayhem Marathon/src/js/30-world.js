// ============================================================
// WORLD RENDERING: renderer + quality tiers, sky, stadium, level meshes (static boxes merged into one
// mesh, moving ones instanced), the instanced Tumbler model, particles and name tags.
// ============================================================
const V3 = new THREE.Vector3(), Q1 = new THREE.Quaternion(), M1 = new THREE.Matrix4(), M2 = new THREE.Matrix4(), M3 = new THREE.Matrix4(), E1 = new THREE.Euler(), S1 = new THREE.Vector3(), C1 = new THREE.Color();
const GFX = { renderer: null, scene: null, cam: null, sun: null, hemi: null, sky: null, stadium: null, level: null, sea: null, q: 'med', info: { calls: 0, tris: 0, ms: 0 } };
const QUALITY = {
    low: { shadows: false, map: 0, ratio: 0.75, crowd: 250, confetti: 160, clouds: 0, puffs: 120 },
    med: { shadows: true, map: 1024, ratio: 1, crowd: 900, confetti: 350, clouds: 1, puffs: 260 },
    high: { shadows: true, map: 2048, ratio: 1.5, crowd: 2000, confetti: 500, clouds: 1, puffs: 400 }
};
function initGfx() {
    const canvas = $('#gl'), q = save.settings.quality;
    const r = new THREE.WebGLRenderer({ canvas, antialias: q === 'high', powerPreference: 'high-performance' });
    r.outputColorSpace = THREE.SRGBColorSpace; r.shadowMap.type = THREE.PCFSoftShadowMap;
    GFX.renderer = r;
    const s = GFX.scene = new THREE.Scene();
    s.fog = new THREE.Fog(0xbfe6ff, 160, 520);
    GFX.cam = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
    GFX.hemi = new THREE.HemisphereLight(0xdff3ff, 0x9a7fb0, 1.25); s.add(GFX.hemi);
    const sun = GFX.sun = new THREE.DirectionalLight(0xfff2d9, 1.9); sun.position.set(30, 60, 20);
    sun.shadow.camera.left = -40; sun.shadow.camera.right = 40; sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40; sun.shadow.camera.far = 160; sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;
    s.add(sun); s.add(sun.target);
    buildSky(); buildSea(); buildStadium();
    initTumblers(); initParticles();
    applyQuality(); onResize(); addEventListener('resize', onResize);
}
function onResize() {
    const w = innerWidth, h = innerHeight, q = QUALITY[GFX.q];
    GFX.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.ratio)); GFX.renderer.setSize(w, h, false);
    GFX.cam.aspect = w / h; GFX.cam.updateProjectionMatrix();
}
function applyQuality() {
    const name = save.settings.quality, q = QUALITY[name], r = GFX.renderer; GFX.q = name;
    r.shadowMap.enabled = q.shadows; GFX.sun.castShadow = q.shadows;
    if (q.shadows) { GFX.sun.shadow.mapSize.set(q.map, q.map); if (GFX.sun.shadow.map) { GFX.sun.shadow.map.dispose(); GFX.sun.shadow.map = null; } }
    GFX.sky.material.uniforms.uClouds.value = q.clouds;
    if (GFX.crowd) GFX.crowd.count = Math.min(GFX.crowdMax, q.crowd);
    r.shadowMap.needsUpdate = true;
    // materials must recompile when shadows toggle
    GFX.scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); });
    TUM.blob.visible = !q.shadows;
    onResize();
}
// ---------- sky dome with soft procedural clouds ----------
function buildSky() {
    const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: { uTime: { value: 0 }, uClouds: { value: 1 }, uSun: { value: new THREE.Vector3(0.45, 0.6, 0.3).normalize() } },
        vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }',
        fragmentShader: `varying vec3 vDir; uniform float uTime; uniform float uClouds; uniform vec3 uSun;
            float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
            float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
            void main(){ vec3 d = normalize(vDir); float h = d.y;
              vec3 top = vec3(0.22,0.52,0.98), hor = vec3(0.78,0.92,1.0), low = vec3(0.98,0.78,0.92);
              vec3 c = h > 0.0 ? mix(hor, top, pow(h, 0.55)) : mix(hor, low, pow(-h, 0.5));
              float s = max(dot(d, uSun), 0.0); c += vec3(1.0,0.9,0.7) * (pow(s, 300.0) * 2.0 + pow(s, 12.0) * 0.25);
              if (uClouds > 0.5 && h > 0.02) { vec2 uv = d.xz / (h + 0.18) * 1.6 + vec2(uTime * 0.01, 0.0);
                float cl = n2(uv) * 0.55 + n2(uv * 2.3) * 0.3 + n2(uv * 5.1) * 0.15; cl = smoothstep(0.52, 0.8, cl) * smoothstep(0.02, 0.25, h);
                c = mix(c, vec3(1.0), cl * 0.85); }
              gl_FragColor = vec4(c, 1.0); }`
    });
    GFX.sky = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), mat); GFX.sky.frustumCulled = false; GFX.sky.renderOrder = -1; GFX.scene.add(GFX.sky);
}
function buildSea() {             // the bright candy sea everything floats above
    const g = new THREE.PlaneGeometry(1600, 1600, 1, 1); g.rotateX(-PI / 2);
    const m = new THREE.MeshLambertMaterial({ color: 0xff8fd8, emissive: 0x52183f });
    GFX.sea = new THREE.Mesh(g, m); GFX.sea.position.y = -34; GFX.sea.receiveShadow = false; GFX.scene.add(GFX.sea);
}
// ---------- vertex-coloured merged geometry helpers ----------
function colorGeo(g, hex, shade) {    // tops brighter, sides a touch darker: a chunky toy look
    g = g.index ? g.toNonIndexed() : g; const n = g.attributes.normal, cnt = n.count, col = new Float32Array(cnt * 3); C1.setHex(hex);
    for (let i = 0; i < cnt; i++) { const ny = n.getY(i), k = shade === false ? 1 : ny > 0.5 ? 1.07 : ny < -0.5 ? 0.62 : 0.86; col[i * 3] = Math.min(1, C1.r * k); col[i * 3 + 1] = Math.min(1, C1.g * k); col[i * 3 + 2] = Math.min(1, C1.b * k); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); if (g.attributes.uv) g.deleteAttribute('uv'); return g;
}
function placeGeo(g, x, y, z, rx, ry, rz, sx, sy, sz) { E1.set(rx || 0, ry || 0, rz || 0, 'YXZ'); Q1.setFromEuler(E1); M1.compose(V3.set(x, y, z), Q1, S1.set(sx || 1, sy || 1, sz || 1)); g.applyMatrix4(M1); return g; }
const VCMAT = new THREE.MeshLambertMaterial({ vertexColors: true });
function buildStadium() {
    const parts = [], crowd = [], R = 118;
    for (let i = 0; i < 48; i++) {
        const a = i / 48 * TAU, ca = Math.cos(a), sa = Math.sin(a);
        for (let tier = 0; tier < 4; tier++) {
            const rr = R + tier * 6, y = -14 + tier * 5;
            parts.push(colorGeo(placeGeo(new THREE.BoxGeometry(16.5, 5, 6), sa * rr, y, ca * rr, 0, a, 0), tier % 2 ? 0x6a5acd : 0x8a7bf0));
            if (crowd.length < 2600) for (let k = 0; k < 14; k++) crowd.push([a + (k / 14 - 0.5) * (TAU / 48), rr - 1.5, y + 3.0]);
        }
        if (i % 8 === 0) {                      // floodlight towers
            parts.push(colorGeo(placeGeo(new THREE.CylinderGeometry(0.8, 1.2, 46, 8), sa * (R + 30), 8, ca * (R + 30)), 0xdfe6f0));
            parts.push(colorGeo(placeGeo(new THREE.BoxGeometry(8, 4, 1.5), sa * (R + 29), 32, ca * (R + 29), 0.4, a, 0), 0xfff6c8, false));
        }
        if (i % 4 === 2) parts.push(colorGeo(placeGeo(new THREE.BoxGeometry(10, 3, 0.6), sa * (R - 3), -10, ca * (R - 3), 0, a, 0), [0xff5fa2, 0xffd23f, 0x3fb8ff, 0x7ee23a][(i / 4 | 0) % 4], false));
    }
    parts.push(colorGeo(placeGeo(new THREE.CylinderGeometry(R + 26, R + 26, 4, 48, 1, true), 0, -18, 0), 0x4b3fa8));
    const g = new THREE.Group(), mesh = new THREE.Mesh(mergeGeometries(parts), VCMAT); g.add(mesh);
    // the crowd: little coloured blocks, one instanced mesh, count depends on quality
    const cm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 1.3, 0.9), new THREE.MeshLambertMaterial(), crowd.length), rnd = mulberry(7);
    const pal = [0xff5fa2, 0xffd23f, 0x3fb8ff, 0x7ee23a, 0xff8a2b, 0xffffff, 0x9a5cff, 0x52f2c2];
    shuffle(crowd, rnd).forEach(([a, rr, y], i) => { M1.makeTranslation(Math.sin(a) * rr, y, Math.cos(a) * rr); cm.setMatrixAt(i, M1); cm.setColorAt(i, C1.setHex(pal[Math.floor(rnd() * pal.length)])); });
    GFX.crowd = cm; GFX.crowdMax = crowd.length; GFX.crowdBase = crowd; g.add(cm);
    // floating balloons
    const bm = new THREE.InstancedMesh(new THREE.SphereGeometry(3, 14, 10), new THREE.MeshLambertMaterial(), 10);
    for (let i = 0; i < 10; i++) bm.setColorAt(i, C1.setHex(pal[i % pal.length]));
    GFX.balloons = bm; g.add(bm);
    GFX.stadium = g; GFX.scene.add(g);
}
function animStadium(t) {
    const bm = GFX.balloons;
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + t * 0.03; M1.makeTranslation(Math.sin(a) * 95, 22 + Math.sin(t * 0.5 + i) * 3, Math.cos(a) * 95); bm.setMatrixAt(i, M1); }
    bm.instanceMatrix.needsUpdate = true;
    if (GFX.crowd && GFX.q !== 'low' && (Math.floor(t * 10) % 3 === 0)) {        // a few fans jump
        const cm = GFX.crowd, n = cm.count, base = GFX.crowdBase;
        for (let k = 0; k < 40; k++) { const i = Math.floor(Math.random() * n), [a, rr, y] = base[i]; M1.makeTranslation(Math.sin(a) * rr, y + (Math.random() < 0.5 ? 0.6 : 0), Math.cos(a) * rr); cm.setMatrixAt(i, M1); }
        cm.instanceMatrix.needsUpdate = true;
    }
}
// ---------- level meshes from the colliders ----------
const LV = { group: null, inst: [], dyn: [] };
const GEO = { box: new THREE.BoxGeometry(2, 2, 2), cyl: new THREE.CylinderGeometry(1, 1, 2, 24), sph: new THREE.SphereGeometry(1, 20, 14), hex: new THREE.CylinderGeometry(1, 1, 2, 6) };
function clearLevel() {
    if (LV.group) { GFX.scene.remove(LV.group); LV.group.traverse(o => { if (o.geometry && !Object.values(GEO).includes(o.geometry)) o.geometry.dispose(); }); }
    LV.group = null; LV.inst = []; LV.dyn = [];
}
// static colliders are merged into one mesh; colliders with a mover or marked dyn go into instanced meshes
function buildLevelMeshes(extra) {
    clearLevel(); const g = LV.group = new THREE.Group(); GFX.scene.add(g);
    const stat = [], dyn = { box: [], cyl: [], sph: [], hex: [] };
    for (const c of W.cs) {
        if (!c.vis) continue;
        const shape = c.k === K_BOX ? 'box' : c.k === K_SPH ? 'sph' : c.hex ? 'hex' : 'cyl';
        if (c.mv || c.dyn) { dyn[shape].push(c); continue; }
        const geo = GEO[shape].clone(), sx = c.k === K_BOX ? c.hx : c.r, sy = c.k === K_BOX ? c.hy : c.k === K_SPH ? c.r : c.hy, sz = c.k === K_BOX ? c.hz : c.r;
        stat.push(colorGeo(placeGeo(geo, c.p[0], c.p[1], c.p[2], c.rot[0], c.rot[1], c.rot[2], sx, sy, sz), c.col));
    }
    if (extra) for (const e of extra) stat.push(e);
    if (stat.length) { const m = new THREE.Mesh(mergeGeometries(stat), VCMAT); m.receiveShadow = true; m.castShadow = true; g.add(m); }
    for (const shape of Object.keys(dyn)) {
        const list = dyn[shape]; if (!list.length) continue;
        const im = new THREE.InstancedMesh(GEO[shape], new THREE.MeshLambertMaterial(), list.length); im.castShadow = true; im.receiveShadow = true;
        list.forEach((c, i) => { c.inst = im; c.ii = i; im.setColorAt(i, C1.setHex(c.col)); });
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        g.add(im); LV.inst.push({ im, list });
    }
    updateLevelMeshes(0);
}
function updateLevelMeshes(dt) {
    for (const { im, list } of LV.inst) {
        for (let i = 0; i < list.length; i++) {
            const c = list[i], m = c.m;
            let sx = c.k === K_BOX ? c.hx : c.r, sy = c.k === K_BOX ? c.hy : c.k === K_SPH ? c.r : c.hy, sz = c.k === K_BOX ? c.hz : c.r, y = c.p[1];
            if (!c.on) { c.fall = (c.fall || 0) + dt; y -= c.fall * c.fall * 9; if (c.fall > 2.5) sx = sy = sz = 0; } else c.fall = 0;
            if (c.shake) { y += Math.sin(performance.now() * 0.06 + i) * 0.05 * c.shake; }
            M1.set(m[0] * sx, m[1] * sy, m[2] * sz, c.p[0], m[3] * sx, m[4] * sy, m[5] * sz, y, m[6] * sx, m[7] * sy, m[8] * sz, c.p[2], 0, 0, 0, 1);
            im.setMatrixAt(i, M1);
            if (c.colDirty) { im.setColorAt(i, C1.setHex(c.col)); c.colDirty = false; im.instanceColor.needsUpdate = true; }
        }
        im.instanceMatrix.needsUpdate = true;
    }
}
function setColColor(c, hex) { if (c.col !== hex) { c.col = hex; c.colDirty = true; } }

// ---------- the Tumbler: instanced parts shared by every contestant ----------
const TUM = { cap: 24, n: 0, parts: {}, hats: {}, blob: null };
const PAT_GLSL = `
float patMask(vec3 p, float k){
  if (k < 0.5) return 0.0;
  if (k < 1.5) return step(0.5, fract(p.y * 4.2));
  if (k < 2.5) { vec3 q = normalize(p); vec2 g = vec2(atan(q.x, q.z) * 2.2, q.y * 3.6); vec2 f = fract(g) - 0.5; return step(length(f), 0.24); }
  if (k < 3.5) return step(0.0, p.x);
  if (k < 4.5) return step(length(vec2(p.x * 1.1, (p.y + 0.1) * 0.9)), 0.36) * step(0.15, p.z);
  if (k < 5.5) return step(abs(p.y - 0.12 * abs(fract(atan(p.x, p.z) * 1.6) * 2.0 - 1.0) * 1.6 + 0.05), 0.07);
  if (k < 6.5) { vec3 q = normalize(p); return mod(floor(atan(q.x, q.z) * 2.5) + floor(q.y * 4.0), 2.0); }
  if (k < 7.5) { vec3 q = p * 5.0; return step(0.62, fract(sin(dot(floor(q), vec3(12.9, 78.2, 37.7))) * 4375.5)) * 0.9; }
  if (k < 8.5) return smoothstep(-0.3, 0.45, p.y);
  vec3 q = normalize(p); vec2 g = vec2(atan(q.x, q.z) * 3.0, q.y * 5.0); vec2 f = fract(g) - 0.5; float a = atan(f.y, f.x);
  float r = 0.18 + 0.08 * cos(a * 5.0); return step(length(f), r) * step(0.5, fract(sin(dot(floor(g), vec2(3.1, 7.7))) * 91.3) + 0.4);
}`;
function tumMat(withPattern) {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 });
    if (withPattern) m.onBeforeCompile = sh => {
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 iCol2; attribute float iPat; varying vec3 vCol2; varying float vPat; varying vec3 vObj;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCol2 = iCol2; vPat = iPat; vObj = position;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vCol2; varying float vPat; varying vec3 vObj;' + PAT_GLSL)
            .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vCol2, patMask(vObj, vPat));');
    };
    return m;
}
function instPart(name, geo, mat, per, shadow) {
    const im = new THREE.InstancedMesh(geo, mat, TUM.cap * per); im.count = 0; im.frustumCulled = false; im.castShadow = shadow !== false; im.receiveShadow = false;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.setColorAt(0, C1.setHex(0xffffff));
    TUM.parts[name] = im; GFX.scene.add(im); return im;
}
function hatGeometry(id) {
    const P = [], add = (g, hex, x, y, z, rx, ry, rz) => P.push(colorGeo(placeGeo(g, x || 0, y || 0, z || 0, rx, ry, rz), hex, false));
    switch (id) {
        case 'h1': add(new THREE.SphereGeometry(0.42, 16, 8, 0, TAU, 0, PI / 2), 0xff4f6d, 0, -0.06); add(new THREE.BoxGeometry(0.5, 0.04, 0.4), 0xff4f6d, 0, -0.05, 0.42); break;
        case 'h2': add(new THREE.ConeGeometry(0.26, 0.62, 16), 0x9a5cff, 0, 0.27); add(new THREE.SphereGeometry(0.09, 8, 6), 0xffd23f, 0, 0.6); break;
        case 'h3': add(new THREE.CylinderGeometry(0.32, 0.32, 0.55, 18), 0x222233, 0, 0.25); add(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 20), 0x222233, 0, 0.0); add(new THREE.CylinderGeometry(0.33, 0.33, 0.1, 18), 0xe8324a, 0, 0.08); break;
        case 'h4': add(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), 0xcccccc, 0, 0.22); add(new THREE.SphereGeometry(0.1, 10, 8), 0xff4f6d, 0, 0.5); break;
        case 'h5': add(new THREE.SphereGeometry(0.44, 16, 8, 0, TAU, 0, PI / 2), 0x3fb8ff, 0, -0.08); add(new THREE.CylinderGeometry(0.45, 0.45, 0.1, 16), 0xf4f1ea, 0, -0.06); add(new THREE.SphereGeometry(0.14, 10, 8), 0xf4f1ea, 0, 0.38); break;
        case 'h6': add(new THREE.ConeGeometry(0.09, 0.42, 10), 0xf4f1ea, 0.34, 0.12, 0, 0, 0, -0.6); add(new THREE.ConeGeometry(0.09, 0.42, 10), 0xf4f1ea, -0.34, 0.12, 0, 0, 0, 0.6); break;
        case 'h7': add(new THREE.CylinderGeometry(0.3, 0.28, 0.32, 16), 0xffffff, 0, 0.12); add(new THREE.SphereGeometry(0.38, 16, 10), 0xffffff, 0, 0.38); break;
        case 'h8': add(new THREE.TorusGeometry(0.3, 0.05, 8, 24), 0xffe066, 0, 0.42, 0, PI / 2); break;
        case 'h9': add(new THREE.SphereGeometry(0.3, 14, 8, 0, TAU, 0, PI / 2), 0x3fb8ff, 0, -0.04); add(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 6), 0x888888, 0, 0.32); add(new THREE.BoxGeometry(0.9, 0.03, 0.12), 0xffd23f, 0, 0.44); add(new THREE.BoxGeometry(0.12, 0.03, 0.9), 0xff4f6d, 0, 0.45); break;
        case 'h10': add(new THREE.CapsuleGeometry(0.08, 0.42, 4, 8), 0xffffff, 0.16, 0.3, 0, 0, 0, -0.15); add(new THREE.CapsuleGeometry(0.08, 0.42, 4, 8), 0xffffff, -0.16, 0.3, 0, 0, 0, 0.15); add(new THREE.CapsuleGeometry(0.04, 0.3, 4, 6), 0xffb3c8, 0.16, 0.32, 0.05, 0, 0, -0.15); add(new THREE.CapsuleGeometry(0.04, 0.3, 4, 6), 0xffb3c8, -0.16, 0.32, 0.05, 0, 0, 0.15); break;
        case 'h11': for (let i = 0; i < 6; i++) add(new THREE.SphereGeometry(0.1, 8, 6), 0xffffff, Math.sin(i / 6 * TAU) * 0.14, 0.05, Math.cos(i / 6 * TAU) * 0.14 + 0.18); add(new THREE.SphereGeometry(0.08, 8, 6), 0xffd23f, 0, 0.08, 0.18); break;
        case 'h12': add(new THREE.ConeGeometry(0.3, 0.7, 16), 0xff7a1a, 0, 0.3); add(new THREE.CylinderGeometry(0.2, 0.24, 0.1, 16), 0xffffff, 0, 0.22); add(new THREE.BoxGeometry(0.62, 0.06, 0.62), 0xff7a1a, 0, -0.02); break;
        case 'h13': add(new THREE.ConeGeometry(0.33, 0.9, 16), 0x3550ff, 0, 0.42, -0.05, -0.2); add(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 20), 0x3550ff, 0, 0.0); add(new THREE.OctahedronGeometry(0.07), 0xffe066, 0.12, 0.35, 0.22); break;
        case 'h14': add(new THREE.TorusGeometry(0.5, 0.045, 6, 20, PI), 0x2f3247, 0, -0.15, 0); add(new THREE.CylinderGeometry(0.16, 0.16, 0.14, 14), 0xff4f6d, 0.52, -0.2, 0, 0, 0, PI / 2); add(new THREE.CylinderGeometry(0.16, 0.16, 0.14, 14), 0xff4f6d, -0.52, -0.2, 0, 0, 0, PI / 2); break;
        case 'h15': add(new THREE.SphereGeometry(0.46, 16, 8, 0, TAU, 0, PI / 2), 0x9aa3ad, 0, -0.1); add(new THREE.ConeGeometry(0.08, 0.4, 10), 0xf4f1ea, 0.42, 0.12, 0, 0, 0, -1.0); add(new THREE.ConeGeometry(0.08, 0.4, 10), 0xf4f1ea, -0.42, 0.12, 0, 0, 0, 1.0); add(new THREE.BoxGeometry(0.07, 0.42, 0.06), 0x9aa3ad, 0, 0.0, 0.45); break;
        case 'tail': add(new THREE.ConeGeometry(0.16, 0.7, 10), 0xffd23f, 0, 0, 0, PI / 2); add(new THREE.SphereGeometry(0.2, 10, 8), 0xff8a2b, 0, 0, -0.38); break;
        case 'crown': add(new THREE.CylinderGeometry(0.34, 0.3, 0.22, 16, 1, true), 0xffd23f); for (let i = 0; i < 5; i++) add(new THREE.ConeGeometry(0.08, 0.2, 6), 0xffd23f, Math.sin(i / 5 * TAU) * 0.3, 0.2, Math.cos(i / 5 * TAU) * 0.3); add(new THREE.SphereGeometry(0.06, 8, 6), 0xff4f6d, 0, 0, 0.33); break;
        default: return null;
    }
    return mergeGeometries(P);
}
function initTumblers() {
    const body = new THREE.SphereGeometry(0.58, 26, 18); body.scale(1, 0.94, 1);
    body.setAttribute('iCol2', new THREE.InstancedBufferAttribute(new Float32Array(TUM.cap * 3), 3));
    body.setAttribute('iPat', new THREE.InstancedBufferAttribute(new Float32Array(TUM.cap), 1));
    instPart('body', body, tumMat(true), 1);
    const visor = new THREE.SphereGeometry(0.6, 24, 12, PI / 2 - 1.0, 2.0, PI * 0.26, PI * 0.3); visor.scale(1, 0.94, 1);
    const vm = new THREE.MeshStandardMaterial({ roughness: 0.15, metalness: 0.6 }); instPart('visor', visor, vm, 1, false);
    const eye = new THREE.CapsuleGeometry(0.055, 0.1, 4, 8), e1 = eye.clone().translate(0.17, 0.12, 0.575), e2 = eye.clone().translate(-0.17, 0.12, 0.575);
    instPart('eyes', mergeGeometries([e1, e2]), new THREE.MeshBasicMaterial(), 1, false);
    const leg = mergeGeometries([new THREE.CylinderGeometry(0.11, 0.12, 0.3, 10).translate(0, -0.15, 0), new THREE.BoxGeometry(0.24, 0.13, 0.34).translate(0, -0.3, 0.05)]);
    instPart('legs', leg, new THREE.MeshStandardMaterial({ roughness: 0.6 }), 2);
    const arm = mergeGeometries([new THREE.CapsuleGeometry(0.08, 0.2, 4, 8).translate(0, -0.15, 0), new THREE.SphereGeometry(0.12, 10, 8).translate(0, -0.33, 0)]);
    instPart('arms', arm, new THREE.MeshStandardMaterial({ roughness: 0.6 }), 2);
    instPart('band', new THREE.TorusGeometry(0.6, 0.07, 8, 28).rotateX(PI / 2), new THREE.MeshStandardMaterial({ roughness: 0.4, emissive: 0x222222 }), 1, false);
    instPart('tail', hatGeometry('tail'), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), 1);
    instPart('crown', hatGeometry('crown'), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.7, emissive: 0x332200 }), 1, false);
    const blobGeo = new THREE.CircleGeometry(0.55, 16).rotateX(-PI / 2);
    TUM.blob = instPart('blob', blobGeo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }), 1, false);
    for (const it of ITEMS) if (it.cat === 'hat' && it.id !== 'h0') {
        const im = new THREE.InstancedMesh(hatGeometry(it.id), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }), TUM.cap);
        im.count = 0; im.frustumCulled = false; im.castShadow = true; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); TUM.hats[it.id] = im; GFX.scene.add(im);
    }
}
function tumBegin() { for (const k in TUM.parts) TUM.parts[k].count = 0; for (const k in TUM.hats) TUM.hats[k].count = 0; TUM.n = 0; }
function tumEnd() {
    for (const k in TUM.parts) { const im = TUM.parts[k]; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
    const b = TUM.parts.body.geometry.attributes; b.iCol2.needsUpdate = true; b.iPat.needsUpdate = true;
    for (const k in TUM.hats) TUM.hats[k].instanceMatrix.needsUpdate = true;
}
function pushInst(im, m, hex) { const i = im.count; if (i >= im.instanceMatrix.count) return -1; im.setMatrixAt(i, m); if (hex != null) im.setColorAt(i, C1.setHex(hex)); im.count = i + 1; return i; }
const ROOT = new THREE.Matrix4(), PART = new THREE.Matrix4(), QA = new THREE.Quaternion(), QB = new THREE.Quaternion(), XA = new THREE.Vector3(1, 0, 0), ZA = new THREE.Vector3(0, 0, 1), YA = new THREE.Vector3(0, 1, 0);
// vs: {x,y,z (lower sphere centre), yaw, st, ground, spd, grab, rx, rz, sq, anim, pose, t}
function drawTumbler(vs, look, opt) {
    if (TUM.n >= TUM.cap) return; TUM.n++;
    opt = opt || {};
    const t = vs.t || 0, feetY = vs.y - PR, st = vs.st;
    let pitch = 0, bob = 0, legA = 0, armA = 0, armOut = 0.25, armFwd = 0, spinY = 0, hop = 0;
    const run = Math.min(1, (vs.spd || 0) / 6), ph = vs.anim * 6;
    if (st === ST_DIVE) { pitch = 1.2; armFwd = -2.6; legA = 0.4; }
    else if (st === ST_SLIDE) { pitch = 1.45; armFwd = -2.8; }
    else if (st === ST_GETUP) { pitch = 1.2 * Math.max(0, 1 - vs.stT / 0.38); }
    else if (st === ST_TUMBLE) { legA = Math.sin(t * 25) * 0.9; armA = Math.cos(t * 23) * 1.2; armOut = 1.2; }
    else if (!vs.ground) { legA = 0.5; armOut = 1.6; armA = Math.sin(t * 18) * 0.3; }
    else { legA = Math.sin(ph) * 0.8 * run; armA = -Math.sin(ph) * 0.9 * run; bob = Math.abs(Math.sin(ph)) * 0.06 * run; }
    if (vs.grab && st === ST_RUN) { armFwd = -1.45; armOut = 0.1; armA = 0; }
    if (vs.pose) {
        const p = vs.pose, s = t * 4;
        if (p === 'e0') { armOut = 0.3; PART.identity(); armA = 0; armFwd = 0; hop = 0; }
        if (p === 'e1') { armOut = 1.5; armFwd = Math.sin(s) * 0.3; }
        if (p === 'e2') { spinY = t * 6; armOut = 1.4; }
        if (p === 'e3') { hop = Math.abs(Math.sin(s * 1.2)) * 0.5; armOut = 2.2; }
        if (p === 'e4') { armFwd = -1.57 * (Math.floor(s) % 2); legA = 0; armOut = 0.3; spinY = Math.floor(s / 2) % 2 ? 0.4 : -0.4; }
        if (p === 'e5') { armOut = 2.6 + Math.sin(s * 2) * 0.3; hop = Math.abs(Math.sin(s)) * 0.25; }
        if (p === 'e6') { legA = Math.sin(s * 1.5) * 0.6; spinY = PI * 0.5; armA = Math.sin(s * 1.5) * 0.5; }
    }
    const sq = vs.sq || 0, sy = 1 - sq, sxz = 1 + sq * 0.55, sc = opt.scale || 1;
    // ROOT = T(feet) * T(c) * Rtumble * Ry(yaw) * Rx(pitch) * T(-c) * S
    QA.setFromEuler(E1.set(vs.rx || 0, 0, vs.rz || 0, 'XYZ')); QB.setFromAxisAngle(YA, vs.yaw + spinY); QA.multiply(QB); QB.setFromAxisAngle(XA, pitch); QA.multiply(QB);
    M1.compose(V3.set(vs.x, feetY + 0.82 * sc + bob + hop, vs.z), QA, S1.set(sc, sc, sc)); M2.makeTranslation(0, -0.82, 0); ROOT.multiplyMatrices(M1, M2);
    M2.makeScale(sxz, sy, sxz); ROOT.multiply(M2);
    const L = look, col = ITEM[L.col].hex, col2 = ITEM[L.col2].hex, vis = ITEM[L.visor];
    const body = TUM.parts.body, bi = body.count;
    PART.makeTranslation(0, 0.85, 0); M3.multiplyMatrices(ROOT, PART);
    if (pushInst(body, M3, col) >= 0) { C1.setHex(col2); body.geometry.attributes.iCol2.setXYZ(bi, C1.r, C1.g, C1.b); body.geometry.attributes.iPat.setX(bi, ITEM[L.pat].k); }
    pushInst(TUM.parts.visor, M3, vis.glass);
    const blink = (Math.sin(t * 0.7 + (opt.seed || 0)) > 0.995) ? 0.15 : 1;
    if (blink < 1) { M2.makeScale(1, blink, 1); M2.setPosition(0, 0.12 * (1 - blink), 0); M3.multiply(M2); }
    pushInst(TUM.parts.eyes, M3, st === ST_TUMBLE ? 0xffffff : vis.eye);
    for (let s = -1; s <= 1; s += 2) {
        QA.setFromAxisAngle(XA, legA * s); M1.compose(V3.set(0.22 * s, 0.34, 0), QA, S1.set(1, 1, 1)); M3.multiplyMatrices(ROOT, M1); pushInst(TUM.parts.legs, M3, 0x3a3d52);
        QA.setFromAxisAngle(XA, armA * s + armFwd); QB.setFromAxisAngle(ZA, armOut * s); QB.multiply(QA); M1.compose(V3.set(0.55 * s, 0.98, 0), QB, S1.set(1, 1, 1)); M3.multiplyMatrices(ROOT, M1); pushInst(TUM.parts.arms, M3, col);
    }
    if (L.hat !== 'h0' && TUM.hats[L.hat]) { PART.makeTranslation(0, 1.36, 0); M3.multiplyMatrices(ROOT, PART); if (L.hat === 'h9') { M2.makeRotationY(t * 12); M3.multiply(M2); } pushInst(TUM.hats[L.hat], M3); }
    if (opt.team != null) { PART.makeTranslation(0, 0.72, 0); M3.multiplyMatrices(ROOT, PART); pushInst(TUM.parts.band, M3, TEAM_COLS[opt.team]); }
    if (opt.tail) { QA.setFromAxisAngle(XA, 0.5 + Math.sin(t * 10) * 0.15); M1.compose(V3.set(0, 0.55, -0.62), QA, S1.set(1, 1, 1)); M3.multiplyMatrices(ROOT, M1); pushInst(TUM.parts.tail, M3); }
    if (opt.crown) { PART.makeTranslation(0, 1.5, 0); M3.multiplyMatrices(ROOT, PART); pushInst(TUM.parts.crown, M3); }
    if (TUM.blob.visible && opt.blobY != null) { M1.makeTranslation(vs.x, opt.blobY + 0.03, vs.z); pushInst(TUM.blob, M1); }
}
// ---------- particles: confetti + puffs (trails, dust, splashes) ----------
const PFX = { conf: null, confP: [], puff: null, puffP: [] };
function initParticles() {
    const cg = new THREE.PlaneGeometry(0.22, 0.13);
    PFX.conf = new THREE.InstancedMesh(cg, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), 500); PFX.conf.count = 0; PFX.conf.frustumCulled = false; GFX.scene.add(PFX.conf);
    PFX.puff = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85 }), 400); PFX.puff.count = 0; PFX.puff.frustumCulled = false; GFX.scene.add(PFX.puff);
    PFX.conf.setColorAt(0, C1.setHex(0xffffff)); PFX.puff.setColorAt(0, C1.setHex(0xffffff));
}
const CONF_PAL = [0xff5fa2, 0xffd23f, 0x3fb8ff, 0x7ee23a, 0xff8a2b, 0x9a5cff, 0xffffff];
function confetti(x, y, z, n, spread) {
    const max = QUALITY[GFX.q].confetti;
    for (let i = 0; i < n && PFX.confP.length < max; i++) PFX.confP.push({ x: x + (Math.random() - 0.5) * (spread || 1), y, z: z + (Math.random() - 0.5) * (spread || 1), vx: (Math.random() - 0.5) * 8, vy: 4 + Math.random() * 9, vz: (Math.random() - 0.5) * 8, r: Math.random() * 6, rv: (Math.random() - 0.5) * 14, life: 3 + Math.random() * 2, c: CONF_PAL[Math.floor(Math.random() * CONF_PAL.length)] });
}
function puff(x, y, z, hex, n, sp, up, life, size) {
    const max = QUALITY[GFX.q].puffs;
    for (let i = 0; i < (n || 1) && PFX.puffP.length < max; i++) PFX.puffP.push({ x, y, z, vx: (Math.random() - 0.5) * (sp || 1), vy: (up || 0.5) + Math.random() * (up || 0.5), vz: (Math.random() - 0.5) * (sp || 1), life: life || 0.6, max: life || 0.6, s: size || 1, c: hex === -1 ? CONF_PAL[Math.floor(Math.random() * 6)] : hex });
}
function updateParticles(dt) {
    const cm = PFX.conf; let n = 0;
    for (let i = PFX.confP.length - 1; i >= 0; i--) {
        const p = PFX.confP[i]; p.life -= dt; if (p.life <= 0) { PFX.confP.splice(i, 1); continue; }
        p.vy -= 9 * dt; p.vx *= 0.985; p.vz *= 0.985; if (p.vy < -2.5) p.vy = -2.5; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.r += p.rv * dt;
        QA.setFromEuler(E1.set(p.r, p.r * 0.7, p.r * 0.3)); M1.compose(V3.set(p.x, p.y, p.z), QA, S1.set(1, 1, 1)); cm.setMatrixAt(n, M1); cm.setColorAt(n, C1.setHex(p.c)); n++;
    }
    cm.count = n; cm.instanceMatrix.needsUpdate = true; if (cm.instanceColor) cm.instanceColor.needsUpdate = true;
    const pm = PFX.puff; n = 0;
    for (let i = PFX.puffP.length - 1; i >= 0; i--) {
        const p = PFX.puffP[i]; p.life -= dt; if (p.life <= 0) { PFX.puffP.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; const k = p.life / p.max, s = p.s * (0.4 + k * 0.8);
        M1.makeScale(s, s, s); M1.setPosition(p.x, p.y, p.z); pm.setMatrixAt(n, M1); pm.setColorAt(n, C1.setHex(p.c)); n++;
    }
    pm.count = n; pm.instanceMatrix.needsUpdate = true; if (pm.instanceColor) pm.instanceColor.needsUpdate = true;
}
// ---------- name tags ----------
const TAGS = new Map();
function tagFor(id) { let e = TAGS.get(id); if (!e) { e = document.createElement('div'); e.className = 'tag'; $('#tags').appendChild(e); TAGS.set(id, e); } return e; }
function clearTags() { for (const e of TAGS.values()) e.remove(); TAGS.clear(); }
function placeTag(id, text, x, y, z, cls, show) {
    const e = tagFor(id);
    if (!show) { if (e.style.display !== 'none') e.style.display = 'none'; return; }
    V3.set(x, y, z).project(GFX.cam);
    if (V3.z > 1 || V3.x < -1.1 || V3.x > 1.1 || V3.y < -1.1 || V3.y > 1.1) { e.style.display = 'none'; return; }
    e.style.display = ''; if (e._t !== text) { e.textContent = text; e._t = text; } if (e._c !== cls) { e.className = 'tag ' + (cls || ''); e._c = cls; }
    e.style.transform = 'translate(' + ((V3.x + 1) * 0.5 * innerWidth).toFixed(0) + 'px,' + ((1 - V3.y) * 0.5 * innerHeight).toFixed(0) + 'px) translate(-50%,-100%)';
}
function render() {
    const r = GFX.renderer, t0 = performance.now();
    GFX.sky.position.copy(GFX.cam.position);
    r.render(GFX.scene, GFX.cam);
    GFX.info.calls = r.info.render.calls; GFX.info.tris = r.info.render.triangles; GFX.info.ms = performance.now() - t0;
}
