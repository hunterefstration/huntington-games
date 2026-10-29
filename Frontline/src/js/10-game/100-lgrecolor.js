// ---------------- 3.0 Iron Legion buildings: the same layout rebuilt in dark Vault steel lit with Embercore ----------------
function lgRecolor(geo) {   // concrete, canvas, olive and wood become gunmetal; glass and lamps glow cyan; team colour stays
  const col = geo.attributes.color, acc = geo.attributes.aAcc, n = col.count;
  for (let i = 0; i < n; i++) {
    if (acc.getX(i) > .5) continue; const r = col.getX(i), g = col.getY(i), b = col.getZ(i), mx = Math.max(r, g, b), mn = Math.min(r, g, b), L = (mx + mn) / 2, S = mx - mn;
    if (b > r + .12 && b >= g && L > .55) continue;                                                     // already glowing blue
    if (b > r + .05 && b > g - .02 && L < .4 && S > .05) { col.setXYZ(i, .3, .82, 1); continue; }         // glass: glowing windows
    if (r > .85 && g > .7 && b < .6) { col.setXYZ(i, .35, .85, 1); continue; }                            // lamps and hazard yellow
    if (r > .55 && g < .35 && b < .35 && S > .3) { col.setXYZ(i, .82, .2, .28); continue; }               // red markings: Legion crimson
    const k = .14 + .6 * Math.pow(L, 1.05); col.setXYZ(i, k * .92, k * .97, k * 1.1);
  }
  col.needsUpdate = true;
}
function geoMerge(a, b) {
  const out = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'color', 'aAcc']) { const A = a.attributes[k], B = b.attributes[k], arr = new Float32Array(A.array.length + B.array.length); arr.set(A.array, 0); arr.set(B.array, A.array.length); out.setAttribute(k, new THREE.Float32BufferAttribute(arr, A.itemSize)); }
  return out;
}
const lgPylon = (g, x, z, h, y0) => { y0 = y0 || 0; g.box(.6, .35, .6, x, y0 + .17, z, LGK); rod(g, .08, 6, x, y0 + .3, z, x, y0 + h, z, LGB); g.cyl(.22, .22, .08, 8, x, y0 + h * .6, z, CYN); ball(g, .2, .2, .2, x, y0 + h + .12, z, CYB); };
const lgPod = (g, x, z, h) => { g.cyl(.48, .55, h, 8, x, .3 + h / 2, z, LGB); g.cone(.48, .6, 8, x, .6 + h, z, LGA); for (const k of [.35, .7]) g.cyl(.52, .52, .07, 8, x, .3 + h * k, z, CYN); g.box(.3, .5, .04, x, .3 + h * .5, z + .53, CYB); };
function lgBModel(type, lvl, spec) {
  if (type === 'hq') return lgHQ(lvl, spec);
  const parts = bModel(type, lvl, spec); for (const p of parts) lgRecolor(p.geo);
  const g = new GB(), T = BT[type], sz = T.sz || 4, L = lvl;
  switch (type) {
    case 'barracks': lgPod(g, -2.35, -2.3, 1.9); if (L >= 2) lgPod(g, -1.3, -2.55, 1.5); lgPylon(g, 2.5, -2.5, 2.6 + L * .4); g.box(3.2, .06, .12, 0, .44, 2.6, CYN); break;
    case 'factory': for (const s of [-1, 1]) lgPylon(g, s * 3.55, -3.2, 3.6 + L * .5); g.box(4.4, .1, .1, 0, 3.1, 2.26, CYN); g.box(.1, 2.4, .1, -2.25, 1.6, 2.26, CYN); g.box(.1, 2.4, .1, 2.25, 1.6, 2.26, CYN); break;
    case 'airfield': g.cyl(2.3, 2.3, .05, 18, -1.2, .33, 1.8, CYN); g.cyl(2.05, 2.05, .06, 18, -1.2, .34, 1.8, 0x23272d); lgPylon(g, 3.9, 3.9, 2.4 + L * .4); if (L >= 2) lgPylon(g, -3.9, 3.9, 2.0); break;
    case 'depot': for (const x of [1.6, 2.15]) { g.cyl(.24, .24, 1.3, 8, x, .95, -2.05, CYN); g.cyl(.3, .3, .1, 8, x, .3, -2.05, LGK); g.cyl(.3, .3, .1, 8, x, 1.62, -2.05, LGK); } lgPylon(g, -2.1, -2.1, 1.6 + L * .3); break;
    case 'medical': lgPylon(g, 2.1, -2.1, 2.0 + L * .3); g.box(.6, .06, .16, -.4, 3.1, -.2, CYN); g.box(.16, .06, .6, -.4, 3.1, -.2, CYN); break;
    case 'radar': lgPylon(g, 1.5, 1.5, 1.6); break;
    case 'nest': g.cyl(1.05, 1.05, .05, 12, 0, .28, 0, CYN); break;
    case 'wall': for (let i = -2; i <= 2; i++) g.box(2.1, .06, .2, i * 2.2, .95, Math.abs(i) * -.5 + .3, CYN); break;
    default: if (T.def) { g.cyl(sz * .6, sz * .6, .06, 14, 0, .46, 0, CYN); lgPylon(g, sz * .55, -sz * .55, 1.4 + L * .3); }
  }
  if (g.pos.length) { const body = parts.find(p => p.mode === 'body') || parts[0]; body.geo = geoMerge(body.geo, g.build()); }
  return parts;
}
function lgHQ(L, spec) {   // the Legion Citadel: hexagonal keep with glowing seams, a beacon spire and a turning sensor ring
  const g = new GB(), parts = [], D = 0x2a2f36, M = 0x3d434d, H = 0x4a525e;
  g.box(11, .5, 11, 0, .25, 0, D); g.box(3.2, .04, 2.6, 0, .52, 4.1, 0x23272d); for (const s of [-1, 1]) g.box(.12, .03, 2.4, s * 1.4, .55, 4.1, CYN);
  fcyl(g, 6, .84, 4.9, 3.6, 4.9, 0, 2.3, -.3, M, { ry: PI / 6 }); fcyl(g, 6, 1, 4.25, .35, 4.25, 0, 4.25, -.3, 0, { acc: .92, ry: PI / 6 });
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, cx = Math.sin(a) * 4.1, cz = Math.cos(a) * 4.1 - .3; g.box(.14, 2.8, .14, cx, 2.1, cz, CYN); }
  g.box(2.0, 2.4, .3, 0, 1.45, 3.9, 0x1e2228); g.box(1.7, .14, .12, 0, 2.75, 4.06, CYN); g.box(2.4, .5, .6, 0, 2.95, 3.8, H);
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + PI / 12; if (Math.abs(Math.sin(a)) < .3 && Math.cos(a) > 0) continue; g.box(2.2, .6, .5, Math.sin(a) * 5.15, .75, Math.cos(a) * 5.15, D, { ry: a }); }
  fcyl(g, 6, .45, 1.7, 3.4, 1.7, 0, 6.15, -.3, H, { ry: PI / 6 }); fcyl(g, 6, 1, 1.0, .25, 1.0, 0, 7.95, -.3, 0, { acc: 1, ry: PI / 6 });
  rod(g, .14, 6, 0, 8.0, -.3, 0, 9.4, -.3, H); ball(g, .62, .62, .62, 0, 9.9, -.3, CYB); for (const a of [0, 2.1, 4.2]) rod(g, .05, 5, 0, 9.5, -.3, Math.cos(a) * 1.0, 10.3, -.3 + Math.sin(a) * 1.0, CYN);
  if (L >= 2) { for (const s of [-1, 1]) { fcyl(g, 6, .7, 1.2, 3.2, 1.2, s * 3.6, 2.1, -3.2, M, { ry: PI / 6 }); ball(g, .4, .4, .4, s * 3.6, 3.95, -3.2, CYB); fcyl(g, 6, 1, 1.0, .2, 1.0, s * 3.6, 3.55, -3.2, 0, { acc: .9, ry: PI / 6 }); } g.box(5.2, .3, .3, 0, 4.7, -.3, CYN, { ry: PI / 2 }); }
  if (L >= 3) { for (const sx of [-1, 1]) for (const sz of [-1, 1]) { g.box(1.1, 4.6, 1.1, sx * 4.7, 2.8, sz * 4.4, M); g.box(1.3, .3, 1.3, sx * 4.7, 5.2, sz * 4.4, 0, { acc: 1 }); ball(g, .3, .3, .3, sx * 4.7, 5.55, sz * 4.4, CYB); } g.cyl(.14, .2, 1.2, 6, 3.6, 4.4, -3.2, H); scyl(g, 12, 4, .26, .3, .26, 3.6, 5.15, -3.2, 0x9aa6b4, { rx: .6 }); }
  if (spec === 'fortress') { g.box(1.5, 3.0, 1.5, 4.4, 1.9, 4.4, M); g.box(1.7, .2, 1.7, 4.4, 3.45, 4.4, 0, { acc: 1 }); }
  const r = new GB(); for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; r.box(.9, .12, .3, Math.cos(a) * 1.25, 0, Math.sin(a) * 1.25, LGB, { ry: -a }); r.box(.5, .06, .32, Math.cos(a) * 1.25, .08, Math.sin(a) * 1.25, CYN, { ry: -a }); }
  parts.push(part(g), part(r, 'rotor', 0, 7.1, -.3, 1.2));
  if (spec === 'fortress') { const t = new GB(); t.cyl(.5, .6, .25, 8, 0, -.05, 0, LGB); t.box(.8, .45, .8, 0, .25, 0, LGA); t.box(.7, .04, .7, 0, .49, 0, 0, { acc: 1 }); rod(t, .07, 6, 0, .28, .4, 0, .28, 1.6, LGK); t.box(.05, .05, .5, 0, .36, 1.0, CYN); parts.push(part(t, 'turret', 4.4, 3.65, 4.4)); }
  return parts;
}
function buildBModels() { }
// ---------------- decor models ----------------
const DM = {};
function buildDecor() {
  const tree = (kind) => {
    const g = new GB();
    switch (kind) {
      case 0: g.cyl(.3, .4, 1.8, 7, 0, .9, 0, 0x7a5a3a); g.sph(1.9, 1.6, 1.9, 0, 3.0, 0, 0x5f9e4e); g.sph(1.2, 1.0, 1.2, .9, 3.7, .3, 0x6fae5a); break;
      case 1: g.cyl(.25, .35, 1.2, 7, 0, .6, 0, 0x6a4b2f); g.cone(1.9, 2.8, 9, 0, 2.5, 0, 0x3f7d55); g.cone(1.4, 2.4, 9, 0, 4.0, 0, 0x4a8d60); g.cone(.9, 1.8, 9, 0, 5.2, 0, 0x57a06c); break;
      case 2: g.cyl(.28, .36, 4.0, 7, 0, 2.0, 0, 0x7a6244); g.sph(2.4, .9, 2.4, 0, 4.4, 0, 0x4f9a48); g.sph(1.6, .8, 1.6, 1.1, 5.0, .6, 0x5fae55); break;
      case 3: g.cyl(.4, .45, 2.8, 8, 0, 1.4, 0, 0x6f9a52); g.cyl(.22, .22, 1.2, 7, .75, 1.5, 0, 0x6f9a52); g.cyl(.22, .26, 1.0, 7, 1.1, 2.0, 0, 0x6f9a52); g.cyl(.22, .22, 1.1, 7, -.7, 1.3, 0, 0x6f9a52); break;
      case 4: g.cyl(.2, .32, 2.6, 6, 0, 1.3, 0, 0x7a6a58); g.box(.14, 1.4, .14, .55, 2.5, 0, 0x7a6a58, { rz: -.7 }); g.box(.12, 1.1, .12, -.45, 2.2, .1, 0x7a6a58, { rz: .8 }); break;
      case 5: g.cyl(.25, .35, 1.2, 7, 0, .6, 0, 0x5a4a3a); g.cone(1.8, 2.8, 9, 0, 2.5, 0, 0x3f6e58); g.cone(1.3, 2.4, 9, 0, 4.0, 0, 0x4a7e66); g.cone(.9, 1.8, 9, 0, 5.2, 0, 0xf2f6fa); g.cone(1.35, .6, 9, 0, 3.1, 0, 0xf2f6fa); break;
    }
    return [part(g)];
  };
  for (let k = 0; k < 6; k++) DM['tree' + k] = tree(k);
  const g = new GB(); g.sph(1, .72, 1, 0, .45, 0, 0x9a9a94); g.sph(.55, .45, .55, .75, .25, .35, 0x8a8a84); DM.rock = [part(g)];
  const b = new GB(); b.box(1, 1, 1, 0, .5, 0, 0, { acc: 1 }); b.box(.9, .06, 1.02, 0, .55, 0, 0x1c2024); b.box(.9, .06, 1.02, 0, .25, 0, 0x1c2024); b.box(1.04, .07, 1.04, 0, 1.0, 0, 0, { acc: .55 }); DM.block = [part(b)];
}

// ---------------- pools ----------------
class Pool {
  constructor(parts, cap, mat, shadow) {
    this.parts = parts.map(p => Object.assign({}, p)); this.cap = cap; this.n = 0; this.meshes = [];   // own copies, so pools that share a model keep separate colour buffers
    for (const p of this.parts) {
      const geo = new THREE.InstancedBufferGeometry(); geo.index = p.geo.index; for (const k in p.geo.attributes) geo.setAttribute(k, p.geo.attributes[k]);
      const ic = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); ic.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('iCol', ic);
      const m = new THREE.InstancedMesh(geo, mat, cap); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; m.castShadow = !!shadow; m.visible = false;
      worldGroup.add(m); this.meshes.push(m); p.ic = ic;
    }
  }
  begin() { this.n = 0; }
  grow() {   // 4.3: no unit limit in Endless War, so a full pool doubles instead of dropping models
    const cap2 = this.cap * 2;
    this.meshes = this.meshes.map((m, k) => { const p = this.parts[k]; const geo = new THREE.InstancedBufferGeometry(); geo.index = p.geo.index; for (const a in p.geo.attributes) geo.setAttribute(a, p.geo.attributes[a]);
      const ic = new THREE.InstancedBufferAttribute(new Float32Array(cap2 * 4), 4); ic.setUsage(THREE.DynamicDrawUsage); ic.array.set(p.ic.array); geo.setAttribute('iCol', ic);
      const m2 = new THREE.InstancedMesh(geo, m.material, cap2); m2.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m2.instanceMatrix.array.set(m.instanceMatrix.array); m2.frustumCulled = false; m2.count = 0; m2.castShadow = m.castShadow; m2.visible = false;
      worldGroup.remove(m); m.geometry.dispose(); m.dispose && m.dispose(); worldGroup.add(m2); p.ic = ic; return m2; });
    this.cap = cap2;
  }
  add(x, y, z, rot, aim, sc, r, g, b, fl, t) {
    if (this.n >= this.cap) this.grow(); const i = this.n; this.n++;
    for (let k = 0; k < this.parts.length; k++) {
      const p = this.parts[k], m = this.meshes[k], a = m.instanceMatrix.array, o = i * 16;
      let ang = rot, px = x, py = y, pz = z;
      if (p.mode === 'aim') ang = aim; else if (p.mode === 'turret') { ang = aim; const c = Math.cos(rot), s = Math.sin(rot); px = x + (p.ox * c + p.oz * s) * sc; pz = z + (-p.ox * s + p.oz * c) * sc; py = y + p.oy * sc; }
      else if (p.mode === 'rotor') { ang = t * p.spd; const c = Math.cos(rot), s = Math.sin(rot); px = x + (p.ox * c + p.oz * s) * sc; pz = z + (-p.ox * s + p.oz * c) * sc; py = y + p.oy * sc; }
      const c = Math.cos(ang) * sc, s = Math.sin(ang) * sc;
      a[o] = c; a[o + 1] = 0; a[o + 2] = -s; a[o + 3] = 0; a[o + 4] = 0; a[o + 5] = sc; a[o + 6] = 0; a[o + 7] = 0; a[o + 8] = s; a[o + 9] = 0; a[o + 10] = c; a[o + 11] = 0; a[o + 12] = px; a[o + 13] = py; a[o + 14] = pz; a[o + 15] = 1;
      const q = p.ic.array, j = i * 4; q[j] = r; q[j + 1] = g; q[j + 2] = b; q[j + 3] = fl;
    }
  }
  end() { for (let k = 0; k < this.meshes.length; k++) { const m = this.meshes[k]; m.count = this.n; m.visible = this.n > 0; if (this.n > 0) { m.instanceMatrix.needsUpdate = true; this.parts[k].ic.needsUpdate = true; } } }
  setMatrix(i, x, y, z, rot, sx, sy, sz) { for (let k = 0; k < this.meshes.length; k++) { const a = this.meshes[k].instanceMatrix.array, o = i * 16, c = Math.cos(rot), s = Math.sin(rot); a[o] = c * sx; a[o + 1] = 0; a[o + 2] = -s * sx; a[o + 3] = 0; a[o + 4] = 0; a[o + 5] = sy; a[o + 6] = 0; a[o + 7] = 0; a[o + 8] = s * sz; a[o + 9] = 0; a[o + 10] = c * sz; a[o + 11] = 0; a[o + 12] = x; a[o + 13] = y; a[o + 14] = z; a[o + 15] = 1; } }
  dispose() { for (const m of this.meshes) { worldGroup.remove(m); m.geometry.dispose(); m.dispose && m.dispose(); } }
}
function poolFor(key, parts, cap) { return POOLS[key] || (POOLS[key] = new Pool(parts, cap, MAT_I, true)); }
const unitPools = {};
function uPool(type) { return unitPools[type] || (unitPools[type] = new Pool(MDL[type], type === 'rifleman' || type === 'legionary' ? 420 : 220, MAT_I, true)); }
const bPools = {};
function bPool(b) { const k = BPOOLKEY(b); if (!bPools[k]) bPools[k] = new Pool(bModelF(b.type, b.lvl, b.spec, bFac(b)), b.type === 'nest' ? 40 : 28, MAT_I, true); return bPools[k]; }

// ---------------- init ----------------
function initRenderer() {
  glc = $('#gl');
  renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: !GPU.weak, powerPreference: 'high-performance', alpha: false });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(42, 1, 3, 700);
  hemi = new THREE.HemisphereLight(0xd8ecff, 0x6e7f58, 2.0); scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff4e0, 1.25); sun.position.set(60, 100, 40); scene.add(sun); scene.add(sun.target);
  worldGroup = new THREE.Group(); scene.add(worldGroup);
  initMats(); buildModels();
  fogData = new Uint8Array(4); fogTex = new THREE.DataTexture(fogData, 1, 1, THREE.RedFormat, THREE.UnsignedByteType); fogTex.needsUpdate = true; FOGU.tFog.value = fogTex;
  window.addEventListener('resize', resize); resize();
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight; vpW = w; vpH = h;
  const pr = Math.min(window.devicePixelRatio || 1, SET.pr || 1.25) * (SET.scale / 100);
  renderer.setPixelRatio(pr); renderer.setSize(w, h, false); glc.style.width = w + 'px'; glc.style.height = h + 'px';
  camera.aspect = w / h; camera.updateProjectionMatrix();
  if (pSmoke) { const sc = h * pr / (2 * Math.tan(camera.fov * PI / 360)); pSmoke.material.uniforms.uScale.value = sc; pFire.material.uniforms.uScale.value = sc; }
}
function applyGfx() {
  if (!renderer) return; resize();
  renderer.shadowMap.enabled = !!SET.shadows; sun.castShadow = !!SET.shadows;
  if (SET.shadows) { const r = SET.shadowRes || 1024; sun.shadow.mapSize.set(r, r); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } sun.shadow.camera.near = 20; sun.shadow.camera.far = 300; sun.shadow.bias = -.0006; sun.shadow.normalBias = .4; }
  if (terrainMesh) terrainMesh.receiveShadow = !!SET.shadows;
  scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
  for (const d of DEC.trees) for (const m of d.multi) m.count = Math.max(0, Math.floor(d.total * SET.decor / 100));
  if (decorBlob) { decorBlob.visible = !SET.shadows; const L = decorBlob.userData.list, cnt = {}; for (const e of L) cnt[e.k] = (cnt[e.k] || 0) + 1; L.forEach((e, i) => { const on = e.r < Math.floor(cnt[e.k] * SET.decor / 100), s = on ? e.t.s * 1.7 : 0; _m.makeScale(s, 1, s); _m.setPosition(e.t.x + .4, e.t.y + .1, e.t.z + .3); decorBlob.setMatrixAt(i, _m); }); decorBlob.instanceMatrix.needsUpdate = true; }
}

// ---------------- world visuals ----------------
function clearWorldVisuals() {
  for (const k in unitPools) delete unitPools[k]; for (const k in bPools) delete bPools[k]; for (const k in POOLS) delete POOLS[k];
  while (worldGroup.children.length) { const c = worldGroup.children[0]; worldGroup.remove(c); if (c.geometry) c.geometry.dispose(); }
  DEC.trees = []; ptObjs.forEach(o => o.label && o.label.remove()); ptObjs = []; wxFx = null; lightPool = null; beamPool = null; vprojs = []; tracers = []; jets = []; crates = []; wrecks = []; markers = []; decals = []; FXQ = [];
}
function buildWorldVisuals() {
  clearWorldVisuals(); const M = W.M, B = M.biome; MYTEAM = P(ME).team;
  scene.background = new THREE.Color(B.sky); scene.fog = new THREE.Fog(B.fog, 240, 560);
  hemi.color.set(B.hemi); hemi.groundColor.set(B.grd); sun.color.set(B.sun);
  // terrain
  const step = 2, nx = M.w / step + 1, nz = M.d / step + 1; const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), tmp = [0, 0, 0];
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    const x = -M.hw + ix * step, z = -M.hd + iz * step, h = M.H(x, z), i = (iz * nx + ix) * 3; pos[i] = x; pos[i + 1] = h; pos[i + 2] = z;
    terrainColor(M, x, z, h, M.slope(x, z), tmp); col[i] = tmp[0]; col[i + 1] = tmp[1]; col[i + 2] = tmp[2];
  }
  const idx = []; for (let iz = 0; iz < nz - 1; iz++) for (let ix = 0; ix < nx - 1; ix++) { const a = iz * nx + ix, b = a + 1, c = a + nx, d = c + 1; if ((ix + iz) & 1) idx.push(a, c, b, b, c, d); else idx.push(a, c, d, a, d, b); }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); tg.setAttribute('color', new THREE.BufferAttribute(col, 3)); tg.setIndex(idx); tg.computeVertexNormals();
  terrainMesh = new THREE.Mesh(tg, MAT_T); terrainMesh.receiveShadow = !!SET.shadows; worldGroup.add(terrainMesh);
  // surround + water
  const sk = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshBasicMaterial({ color: new THREE.Color(B.water).multiplyScalar(.78) })); sk.rotation.x = -PI / 2; sk.position.y = -9; worldGroup.add(sk); surroundMesh = sk;
  const wtex = null; const wm = patchMat(new THREE.MeshLambertMaterial({ color: B.water, transparent: true, opacity: .82, depthWrite: false }), { inst: false, fog: true });   // 3.0: water darkens under fog of war like the ground (big seas on the water maps)
  const wgeo = new THREE.PlaneGeometry(M.w + 8, M.d + 8); wgeo.rotateX(-PI / 2); waterMesh = new THREE.Mesh(wgeo, wm); waterMesh.position.y = M.wl - .05; waterMesh.renderOrder = 1; worldGroup.add(waterMesh); waterMesh.userData.tex = wtex;
  // fog texture
  fogData = new Uint8Array(W.vw * W.vd).fill(255); fogTex = new THREE.DataTexture(fogData, W.vw, W.vd, THREE.RedFormat, THREE.UnsignedByteType); fogTex.magFilter = THREE.LinearFilter; fogTex.minFilter = THREE.LinearFilter; fogTex.needsUpdate = true; FOGU.tFog.value = fogTex; FOGU.uFog.value.set(-M.hw, -M.hd, 1 / M.w, 1 / M.d);
  // decor
  const trees = {}; for (const t of M.trees) (trees[t.k] = trees[t.k] || []).push(t);
  for (const k in trees) {
    const list = trees[k], p = new Pool(DM['tree' + k], list.length, MAT_D, false); const tint = 1; p.begin();
    for (const t of list) p.add(t.x, t.y, t.z, t.rot, t.rot, t.s, 1, 1, 1, 0, 0); p.end(); DEC.trees.push({ mesh: p.meshes[0], pool: p, total: list.length }); for (const m of p.meshes) { m.castShadow = true; m.instanceMatrix.setUsage(THREE.StaticDrawUsage); }
    for (const m of p.meshes) DEC.trees[DEC.trees.length - 1].mesh = p.meshes[0];
    DEC.trees[DEC.trees.length - 1].multi = p.meshes;
  }
  if (M.rocks.length) {
    const g = new GB(); const rc = B.cliff; g.sph(1, .75, 1, 0, .5, 0, rc); g.sph(.6, .5, .6, .7, .3, .3, new THREE.Color(rc).multiplyScalar(.85).getHex()); const p = new Pool([part(g)], M.rocks.length, MAT_D, true); p.begin();
    for (const r of M.rocks) p.add(r.x, r.y - .1, r.z, r.rot, r.rot, r.r, 1, 1, 1, 0, 0); p.end(); p.meshes[0].instanceMatrix.setUsage(THREE.StaticDrawUsage);
  }
  if (M.blocks.length) {
    const p = new Pool(DM.block, M.blocks.length, MAT_D, true); p.begin();
    for (const b of M.blocks) { _c4.set(b.col); const y = M.H(b.x, b.z) - .3; const a = p.n; p.add(b.x, y, b.z, b.rot, b.rot, 1, _c4.r, _c4.g, _c4.b, 0, 0); p.setMatrix(a, b.x, y, b.z, b.rot, b.w, b.h, b.d); }
    p.end(); p.meshes[0].instanceMatrix.setUsage(THREE.StaticDrawUsage);
  }
  // bridges
  for (const d of M.decks) if (d.h > M.wl + .5) { const g = new GB(); g.box(d.wid, .4, d.len, 0, .2, 0, 0x7a6448); for (let i = -d.len / 2 + 1; i < d.len / 2; i += 2.2) g.box(d.wid + .6, .08, .5, 0, .44, i, 0x5f4c36); g.box(.25, .9, d.len, -d.wid / 2, 1.0, 0, 0x4a3b2b); g.box(.25, .9, d.len, d.wid / 2, 1.0, 0, 0x4a3b2b); const wrap = new Pool([part(g)], 1, MAT_D, true); wrap.begin(); wrap.add(d.x, d.h - .35, d.z, d.rot, d.rot, 1, 1, 1, 1, 0, 0); wrap.end(); }
  // effects pools
  buildFxObjects();
  // soft blob shadows under trees (used when real shadows are off)
  { const g = new THREE.CircleGeometry(1, 10); g.rotateX(-PI / 2); decorBlob = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), Math.max(1, M.trees.length)); const rk = {}; decorBlob.userData.list = M.trees.map(t => ({ t, k: t.k, r: rk[t.k] = (rk[t.k] === undefined ? 0 : rk[t.k] + 1) })); decorBlob.count = M.trees.length; decorBlob.frustumCulled = false; decorBlob.renderOrder = 1; worldGroup.add(decorBlob); }
  // control points
  ptObjs = W.pts.map(pt => makePtObj(pt));
  flagPool = new Pool(MDL.flag, 20, MAT_I, true); beaconPool = new Pool(MDL.beacon, 60, MAT_I, false); wallPools = [1, 2, 3].map(() => new Pool(MDL.wallseg, 900, MAT_I, true)); wallPoolsL = [];   // 3.0: Legion wall rings are made when first needed
  // camera start
  const hq = P(ME).hqB; const c = hq || W.pts[M.spawnPts[P(ME).spawn]];
  cam.x = cam.tx = c.x * .92; cam.z = cam.tz = c.z * .92; cam.yaw = cam.tyaw = Math.atan2(c.x, c.z); cam.dist = cam.tdist = 92; cam.vx = cam.vz = 0; cam.lift = 0; cam.gy = M.H(cam.x, cam.z);
  applyAtmos(); applyGfx(); mmBuild();
}
// ---------------- 3.0 weather and night: sky, light, fog distance, rain / snow, lights in the dark ----------------
let wxFx = null, lightPool = null, beamPool = null, glowTex = null, atmosVer = -1, surroundMesh = null;
const ATM = { hi: 2, si: 1.25, fk: 0, flash: 0, bolt: 8, boltT: 0 }, _wxc = new THREE.Color(), _UP = new THREE.Vector3(0, 1, 0);
const NFL = []; for (let i = 0; i < 40; i++) NFL.push({ x: 0, z: 0, t: -9, lg: 0 }); let nflHead = 0;   // night muzzle-flash glows (a fixed ring, nothing allocated per shot)
function applyAtmos() {
  const B = W.M.biome, wx = W.wx || wxOf({}), w = wx.w; atmosVer = W.wxVer | 0;
  const sky = new THREE.Color(B.sky), fc = new THREE.Color(B.fog), hc = new THREE.Color(B.hemi), gc = new THREE.Color(B.grd), sc = new THREE.Color(B.sun);
  let hi = 2, si = 1.25, fk = 0;   // fk: fog distance mode (0 normal, 1 hazy, 2 thick fog), scaled with the camera distance each frame
  if (w === 'rain') { sky.lerp(_wxc.set(0x6c7a87), .78); fc.lerp(_wxc.set(0x84919c), .75); hc.lerp(_wxc.set(0xb4c0cc), .5); sc.lerp(_wxc.set(0xc8d0d8), .6); hi = 1.6; si = .55; fk = 1; }
  else if (w === 'fog') { sky.lerp(_wxc.set(0xc2cad0), .85); fc.lerp(_wxc.set(0xc6cdd2), .9); hc.lerp(_wxc.set(0xdfe4e8), .5); hi = 1.75; si = .55; fk = 2; }
  else if (w === 'snow') { sky.lerp(_wxc.set(0xd5dee6), .8); fc.lerp(_wxc.set(0xdce4ea), .85); hc.lerp(_wxc.set(0xf0f4f8), .6); sc.lerp(_wxc.set(0xe8eef6), .6); hi = 1.95; si = .8; fk = 1; }
  if (wx.night) { sky.lerp(_wxc.set(0x0c1a2e), w === 'fog' ? .82 : .9); fc.lerp(_wxc.set(w === 'fog' ? 0x26324a : 0x101c30), .88); hc.set(0x86a0d8); gc.set(0x2c3850); sc.set(0xb0c4ff); hi = w === 'fog' ? 1.45 : 1.35; si = .7; fk = Math.max(fk, 1); }
  const frost = w === 'snow' && W.M.bname !== 'snow' ? (wx.night ? 0x10141a : 0x262a30) : 0; MAT_T.emissive.set(frost); MAT_D.emissive.set(frost);   // fresh snow lightens the ground
  scene.background = sky; if (scene.fog) scene.fog.color.copy(fc); hemi.color.copy(hc); hemi.groundColor.copy(gc); sun.color.copy(sc); hemi.intensity = hi; sun.intensity = si;
  ATM.hi = hi; ATM.si = si; ATM.fk = fk; ATM.flash = 0; ATM.bolt = 6 + Math.random() * 10;
  const wk = wx.night ? .5 : w === 'rain' ? .75 : 1; if (waterMesh) waterMesh.material.color.set(B.water).multiplyScalar(wk); if (surroundMesh) surroundMesh.material.color.set(B.water).multiplyScalar(.78 * (wx.night ? .3 : wk));
  makeWxFx();
}
function makeWxFx() {
  if (wxFx) { worldGroup.remove(wxFx.obj); wxFx.obj.geometry.dispose(); wxFx.obj.material.dispose(); wxFx = null; }
  const w = W.wx.w; if (w !== 'rain' && w !== 'snow') return; const rain = w === 'rain';
  const n = Math.round((rain ? 560 : 520) * clamp(SET.particles / 100, .4, 1.3)), pos = new Float32Array(n * (rain ? 6 : 3)), g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  const obj = rain ? new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: W.wx.night ? 0x8496b4 : 0xc2cedb, transparent: true, opacity: W.wx.night ? .55 : .5, depthWrite: false, fog: false }))
    : new THREE.Points(g, new THREE.PointsMaterial({ color: W.wx.night ? 0xb8c4dc : 0xffffff, map: glowTex, size: 1.7, sizeAttenuation: true, transparent: true, opacity: .95, depthWrite: false, fog: false }));
  obj.frustumCulled = false; obj.renderOrder = 6; worldGroup.add(obj);
  wxFx = { obj, pos, d: new Float32Array(n * 4), n, rain, fresh: true };
}
// rain streaks / snowflakes live in a box around the camera target; each one falls to the ground and is put back on top
function updWxFx(dt, t) {
  const F = wxFx; if (!F) return; const M = W.M, R = clamp(cam.dist * .95, 30, 92), top = cam.gy + clamp(cam.dist * .5, 22, 60), d = F.d, P = F.pos, rain = F.rain;
  for (let i = 0; i < F.n; i++) {
    const j = i * 4; let x = d[j], y = d[j + 1], z = d[j + 2];
    if (F.fresh || y < d[j + 3] || Math.abs(x - cam.x) > R || Math.abs(z - cam.z) > R) {
      x = cam.x + (Math.random() * 2 - 1) * R; z = cam.z + (Math.random() * 2 - 1) * R; d[j + 3] = Math.max(M.H(x, z), M.wl); y = F.fresh ? d[j + 3] + Math.random() * (top - d[j + 3]) : top + Math.random() * 6;
    }
    if (rain) { y -= (34 + (i % 7) * 2) * dt; x += 2.5 * dt; } else { y -= (2.4 + (i % 5) * .3) * dt; x += Math.sin(t * .9 + i) * .9 * dt + .6 * dt; z += Math.cos(t * .7 + i * 1.3) * .5 * dt; }
    d[j] = x; d[j + 1] = y; d[j + 2] = z;
    if (rain) { const k = i * 6; P[k] = x; P[k + 1] = y; P[k + 2] = z; P[k + 3] = x - .12; P[k + 4] = y + 1.5; P[k + 5] = z; } else { const k = i * 3; P[k] = x; P[k + 1] = y; P[k + 2] = z; }
  }
  F.fresh = false; F.obj.geometry.attributes.position.needsUpdate = true;
}
// per frame: fog distance follows the camera zoom, lightning in the rain, searchlights / headlights / lamp glows at night
function updAtmos(dt, t) {
  if ((W.wxVer | 0) !== atmosVer) applyAtmos();
  const wx = W.wx, d = cam.dist; if (scene.fog) { if (ATM.fk === 2) { scene.fog.near = d * .5; scene.fog.far = d * 2.4; } else if (ATM.fk === 1) { scene.fog.near = d * (wx.night ? 1.0 : 1.3); scene.fog.far = d * (wx.night ? 3.2 : 4.2); } else { scene.fog.near = 240; scene.fog.far = 560; } }
  if (wx.w === 'rain') { ATM.bolt -= dt; if (ATM.bolt <= 0) { ATM.bolt = 9 + Math.random() * 16; ATM.flash = 1; ATM.boltT = .9 + Math.random() * 1.6; } if (ATM.boltT > 0) { ATM.boltT -= dt; if (ATM.boltT <= 0 && MODE === 'game') sfx('thunder'); } }
  if (ATM.flash > 0) { ATM.flash = Math.max(0, ATM.flash - dt * 4.5); const f = ATM.flash * (ATM.flash > .55 || ATM.flash < .3 ? 1 : .3); hemi.intensity = ATM.hi + f * (wx.night ? 2.6 : 1.4); sun.intensity = ATM.si + f; } else { hemi.intensity = ATM.hi; sun.intensity = ATM.si; }
  updWxFx(dt, t); nightLights(t);
}
function nightLights(t) {
  if (!lightPool) return; if (!W.wx.night) { if (lightPool.count) { lightPool.count = 0; beamPool.count = 0; } return; }
  const M = W.M, col = lightPool.instanceColor.array, cap = lightPool.instanceMatrix.count; let n = 0, nb = 0;
  const glow = (x, z, r, cr, cg, cb) => { if (n >= cap) return; _m.makeScale(r, 1, r); _m.setPosition(x, Math.max(M.H(x, z), M.wl) + .32, z); lightPool.setMatrixAt(n, _m); col[n * 3] = cr; col[n * 3 + 1] = cg; col[n * 3 + 2] = cb; n++; };
  for (const b of W.bld) {
    if (b.type === 'wall' || !inView(b.x, b.y, b.z, b.T.sz + 30)) continue; if (b.team !== MYTEAM && W.o.fog && !(b.sb >> MYTEAM & 1) && !seen(MYTEAM, b.x, b.z)) continue;
    glow(b.x, b.z, b.T.sz * 1.25 + 1.5, .55, .38, .16);
    if (SLT[b.type] && b.prog >= 1) { const a = slAng(b), dd = slDist(b), sx = b.x + Math.sin(a) * dd, sz = b.z + Math.cos(a) * dd, gy = Math.max(M.H(sx, sz), M.wl);
      glow(sx, sz, 8, .5, .56, .66);
      if (nb < 28) { const hy = b.y + b.T.sz * .7 + 2.2; _v1.set(b.x - sx, hy - gy, b.z - sz); const L = _v1.length(); _v1.multiplyScalar(1 / L); _q.setFromUnitVectors(_UP, _v1); _m.compose(_v2.set((b.x + sx) / 2, (hy + gy) / 2, (b.z + sz) / 2), _q, _sc.set(4.2, L, 4.2)); beamPool.setMatrixAt(nb++, _m); } }
  }
  for (const u of W.units) { const T = u.T; if (T.cls === 0 || T.air || !myVisible(u) || !inView(u.rx, u.ry, u.rz, 8)) continue; const a = u.rrot; glow(u.rx + Math.sin(a) * (T.r + 3.2), u.rz + Math.cos(a) * (T.r + 3.2), 3 + T.r * .5, .5, .45, .3); }
  const now = performance.now() / 1000; for (const f of NFL) { const age = now - f.t; if (age < .12) { const k = 1 - age / .12; glow(f.x, f.z, 4.5, (f.lg ? .3 : 1) * k, (f.lg ? .8 : .62) * k, (f.lg ? 1 : .25) * k); } }
  lightPool.count = n; lightPool.instanceMatrix.needsUpdate = true; lightPool.instanceColor.needsUpdate = true; beamPool.count = nb; beamPool.instanceMatrix.needsUpdate = true;
}
function makeNightPools() {
  if (!glowTex) { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'), gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.45, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64); glowTex = new THREE.CanvasTexture(cv); }
  { const g = new THREE.PlaneGeometry(2, 2); g.rotateX(-PI / 2); lightPool = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), 260); lightPool.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(260 * 3), 3); lightPool.count = 0; lightPool.frustumCulled = false; lightPool.renderOrder = 3; worldGroup.add(lightPool); }
  { const g = new THREE.ConeGeometry(1, 1, 12, 1, true); beamPool = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0x3c4a5e, transparent: true, opacity: .42, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }), 28); beamPool.count = 0; beamPool.frustumCulled = false; beamPool.renderOrder = 7; worldGroup.add(beamPool); }
}
function nightFlash(x, z, lg) { if (!W.wx.night) return; const f = NFL[nflHead]; nflHead = (nflHead + 1) % NFL.length; f.x = x; f.z = z; f.t = performance.now() / 1000; f.lg = lg ? 1 : 0; }
function makeWaterTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, 128, 128);
  c.strokeStyle = 'rgba(255,255,255,0)'; for (let i = 0; i < 26; i++) { c.fillStyle = 'rgba(190,225,255,' + (.25 + Math.random() * .4) + ')'; const x = Math.random() * 128, y = Math.random() * 128; c.fillRect(x, y, 10 + Math.random() * 18, 2); c.fillRect((x + 64) % 128, (y + 40) % 128, 10, 2); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(26, 17); return t;
}
function makePtObj(pt) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uCol: { value: new THREE.Color(0x888888) }, uCol2: { value: new THREE.Color(0xffffff) }, uProg: { value: 0 }, uCont: { value: 0 }, uT: { value: 0 }, uMine: { value: 0 } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec2 vP; uniform vec3 uCol; uniform vec3 uCol2; uniform float uProg; uniform float uCont; uniform float uT; uniform float uMine; void main(){ float d = length(vP); float a = 0.; vec3 c = uCol; if(d>0.94 && d<=1.0) a = 0.9; else if(d<0.94) a = 0.11 + 0.03*sin(uT*2.); if(d>0.8 && d<0.92){ float ang = atan(vP.y, vP.x)/6.2831853 + 0.5; if(ang < uProg){ c = uCol2; a = 0.92; } else a = max(a,0.22); } if(uCont>0.5 && d>0.9) { c = vec3(1.,0.25,0.2); a = 0.6+0.4*sin(uT*10.); } if(d>1.0) discard; gl_FragColor = vec4(c, a); }'
  });
  const g = new THREE.CircleGeometry(pt.r, 48); g.rotateX(-PI / 2); // geometry in XZ; shader uses position.xz
  mat.vertexShader = 'varying vec2 vP; void main(){ vP = position.xz / ' + pt.r.toFixed(1) + '; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }';
  const mesh = new THREE.Mesh(g, mat); mesh.position.set(pt.x, pt.y + .25, pt.z); mesh.renderOrder = 2; worldGroup.add(mesh);
  const lbl = document.createElement('div'); lbl.className = 'plbl'; lbl.dataset.pt = pt.id; lbl.style.display = 'none'; document.body.appendChild(lbl);
  return { pt, mesh, mat, label: lbl, flagY: 0 };
}
function buildFxObjects() {
  // particles
  const mk = (n, add) => {
    const g = new THREE.BufferGeometry(); const pos = new Float32Array(n * 3), colr = new Float32Array(n * 4), sz = new Float32Array(n);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('aCol', new THREE.BufferAttribute(colr, 4).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { uScale: { value: 600 } }, vertexShader: 'attribute vec4 aCol; attribute float aSize; uniform float uScale; varying vec4 vC; void main(){ vC = aCol; vec4 mv = modelViewMatrix*vec4(position,1.); gl_PointSize = aSize*uScale/-mv.z; gl_Position = projectionMatrix*mv; }', fragmentShader: 'varying vec4 vC; void main(){ vec2 p = gl_PointCoord-0.5; float d = length(p); if(d>0.5) discard; float a = smoothstep(0.5,0.1,d)*vC.a; gl_FragColor = vec4(vC.rgb, a); }' });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 5; worldGroup.add(pts);
    pts.userData = { n, pos, colr, sz, p: new Array(n).fill(null).map(() => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s0: 1, s1: 1, c0: [1, 1, 1, 1], c1: [1, 1, 1, 0], drag: 1, grav: 0 })), head: 0, alive: 0 };
    return pts;
  };
  const cap = Math.max(120, Math.floor(700 * SET.particles / 100));
  pSmoke = mk(cap, false); pFire = mk(Math.floor(cap * .7), true);
  resize();
  vprojPool = new Pool([part(new GB().box(.25, .25, 1.2, 0, 0, 0, 0xffe9a0))], 120, MAT_I, false); vprojPoolL = null;
  scorchPool = null;
  { const g = new THREE.CircleGeometry(1, 14); g.rotateX(-PI / 2); scorchPool = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0x15130f, transparent: true, opacity: .45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 70); scorchPool.count = 0; scorchPool.frustumCulled = false; scorchPool.renderOrder = 1; worldGroup.add(scorchPool); }
  { const g = new THREE.RingGeometry(.82, 1, 20); g.rotateX(-PI / 2); ringPool = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), 3000); ringPool.count = 0; ringPool.frustumCulled = false; ringPool.renderOrder = 3; ringPool.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(3000 * 3), 3); worldGroup.add(ringPool); }
  { const g = new THREE.CircleGeometry(1, 12); g.rotateX(-PI / 2); blobPool = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .26, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 400); blobPool.count = 0; blobPool.frustumCulled = false; blobPool.renderOrder = 1; worldGroup.add(blobPool); }
  { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-PI / 2); const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'); c.clearRect(0, 0, 64, 64); c.strokeStyle = '#fff'; c.lineWidth = 3; c.strokeRect(6, 6, 52, 52); c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(6, 6, 52, 52); c.lineWidth = 6; c.beginPath(); c.moveTo(32, 18); c.lineTo(32, 46); c.moveTo(18, 32); c.lineTo(46, 32); c.stroke(); const t = new THREE.CanvasTexture(cv);
    padPool = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, color: 0xffffff, opacity: .75, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 120); padPool.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(120 * 3), 3); padPool.count = 0; padPool.frustumCulled = false; padPool.renderOrder = 2; worldGroup.add(padPool); }
  { const g = new THREE.PlaneGeometry(1, 1); barPool = new THREE.InstancedMesh(g, null, 300); barPool.frustumCulled = false; barPool.renderOrder = 8;
    const geo = new THREE.InstancedBufferGeometry(); geo.index = g.index; geo.setAttribute('position', g.attributes.position); geo.setAttribute('uv', g.attributes.uv);
    const ip = new THREE.InstancedBufferAttribute(new Float32Array(300 * 4), 4).setUsage(THREE.DynamicDrawUsage), id = new THREE.InstancedBufferAttribute(new Float32Array(300 * 4), 4).setUsage(THREE.DynamicDrawUsage); geo.setAttribute('iPos', ip); geo.setAttribute('iData', id);
    const mat = new THREE.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false, vertexShader: 'attribute vec4 iPos; attribute vec4 iData; varying vec2 vUv; varying vec4 vD; void main(){ vUv = uv; vD = iData; vec3 r = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]); vec3 u = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]); vec3 wp = iPos.xyz + r*position.x*iPos.w + u*position.y*iPos.w*0.27; gl_Position = projectionMatrix*viewMatrix*vec4(wp,1.); }',
      fragmentShader: 'varying vec2 vUv; varying vec4 vD; void main(){ float hp = vD.x; float v = vUv.y; if(v>0.42){ float u = vUv.x; vec3 bg = vec3(0.04,0.05,0.07); vec3 fg = vD.z>1.5 ? vec3(0.35,0.7,1.0) : (hp>0.6? vec3(0.25,0.85,0.4) : (hp>0.3? vec3(0.95,0.8,0.2) : vec3(0.95,0.25,0.2))); float edge = step(u,0.03)+step(0.97,u)+step(v,0.46)+step(0.98,v); vec3 c = (u<hp ? fg : bg*2.); if(vD.w>0.001 && v>0.79 && u<vD.w) c = vec3(0.35,0.9,1.0); if(edge>0.) c = vec3(0.0); gl_FragColor = vec4(c,0.95);} else { float n = vD.y; float cell = floor(vUv.x*5.); float within = fract(vUv.x*5.); if(cell < n && within>0.15 && within<0.85 && v>0.05 && v<0.38) gl_FragColor = vec4(1.0,0.82,0.25,1.0); else discard; } }' });
    barPool = new THREE.Mesh(geo, mat); barPool.frustumCulled = false; barPool.renderOrder = 8; barPool.userData = { ip, id, n: 0 }; geo.instanceCount = 0; worldGroup.add(barPool); }
  makeNightPools();
  { const g = new THREE.RingGeometry(.7, 1, 24); g.rotateX(-PI / 2); markPool = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0x6fe28c, transparent: true, opacity: .8, depthWrite: false }), 16); markPool.count = 0; markPool.frustumCulled = false; markPool.renderOrder = 3; worldGroup.add(markPool); }
}

