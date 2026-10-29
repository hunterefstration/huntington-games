// =====================================================================
//  RENDERING (three.js): terrain, instanced models, effects, camera, minimap
// =====================================================================
THREE.ColorManagement.enabled = false;
let renderer, scene, camera, sun, hemi, worldGroup, glc;
const cam = { x: 0, z: 0, tx: 0, tz: 0, vx: 0, vz: 0, gy: 0, lift: 0, dist: 92, tdist: 92, yaw: 0, tyaw: 0, shake: 0 };
const FOGU = { tFog: { value: null }, uFog: { value: new THREE.Vector4(0, 0, 1, 1) } };
const POOLS = {}, DEC = { trees: [], misc: [] };
let decorBlob = null, terrainMesh = null, waterMesh = null, fogTex = null, fogData = null, ptObjs = [], padPool = null, ringPool = null, barPool = null, blobPool = null, wallPools = [], wallPoolsL = [], beaconPool = null, flagPool = null;
let MYTEAM = 0, FXQ = [], vprojs = [], tracers = [], jets = [], crates = [], wrecks = [], markers = [], decals = [];
let pSmoke = null, pFire = null, vprojPool = null, vprojPoolL = null, scorchPool = null, markPool = null;
let hoverId = 0, selIds = new Set(), selBld = 0, vpW = 800, vpH = 600;
const ICONS = {};
const _c4 = new THREE.Color();
const SHDOME = new Map(); let SHGEO = null;   // 4.3 force field domes, one per Shield Generator
const _frustum = new THREE.Frustum(), _pm = new THREE.Matrix4(), _sph = new THREE.Sphere();
function inView(x, y, z, r) { _sph.center.set(x, y, z); _sph.radius = r; return _frustum.intersectsSphere(_sph); }

// ---------------- materials ----------------
function patchMat(m, opts) {
  m.onBeforeCompile = sh => {
    sh.uniforms.tFog = FOGU.tFog; sh.uniforms.uFog = FOGU.uFog;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 iCol; attribute float aAcc; varying vec4 vIc; varying float vAc; varying vec2 vFw;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + (opts.inst ? 'vIc = iCol; vAc = aAcc; vFw = (instanceMatrix * vec4(0.,0.,0.,1.)).xz;' : 'vIc = vec4(0.); vAc = 0.; vFw = position.xz;'));
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tFog; uniform vec4 uFog; varying vec4 vIc; varying float vAc; varying vec2 vFw;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + (opts.inst ? 'diffuseColor.rgb = mix(diffuseColor.rgb, vIc.rgb * vColor.r, vAc); ' + (opts.vary ? 'diffuseColor.rgb *= 0.94 + 0.12 * fract(sin(dot(floor(vFw * 2.), vec2(12.9898, 78.233))) * 43758.5453); ' : '') + 'diffuseColor.rgb += vIc.a >= 0. ? vec3(vIc.a * 0.55) : vec3(0.12, 0.5, 0.75) * -vIc.a;' : '') + (opts.fog ? '\n float fgv = texture2D(tFog, (vFw - uFog.xy) * uFog.zw).r; diffuseColor.rgb *= fgv;' : ''));
  };
  m.customProgramCacheKey = () => 'fl' + (opts.inst ? 'i' : 'n') + (opts.fog ? 'f' : '') + (opts.vary ? 'v' : '');
  return m;
}
let MAT_I = null, MAT_T = null, MAT_D = null;
function initMats() {
  MAT_I = patchMat(new THREE.MeshLambertMaterial({ vertexColors: true }), { inst: true, fog: false });
  MAT_T = patchMat(new THREE.MeshLambertMaterial({ vertexColors: true }), { inst: false, fog: true });
  MAT_D = patchMat(new THREE.MeshLambertMaterial({ vertexColors: true }), { inst: true, fog: true, vary: true });
}

// ---------------- geometry builder ----------------
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _eu = new THREE.Euler(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _sc = new THREE.Vector3(), _pa = new THREE.Vector3(), _pb = new THREE.Vector3(), _pc = new THREE.Vector3(), _cb = new THREE.Vector3(), _ab = new THREE.Vector3();
const PRIM = {};
function prim(key, mk, smooth) { if (PRIM[key]) return PRIM[key]; const g0 = mk(); const g = g0.index ? g0.toNonIndexed() : g0; g.userData.smooth = !!smooth; return PRIM[key] = g; }
class GB {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.acc = []; }
  _add(base, x, y, z, sx, sy, sz, color, o) {
    o = o || {}; _eu.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ'); _q.setFromEuler(_eu); _m.compose(_v1.set(x, y, z), _q, _sc.set(sx, sy, sz));
    const P = base.attributes.position, N = base.attributes.normal, n = P.count, sm = !!base.userData.smooth; let r, g, b; const isAcc = o.acc !== undefined;
    if (isAcc) { r = g = b = o.acc; } else { _c4.set(color); r = _c4.r; g = _c4.g; b = _c4.b; }
    for (let i = 0; i < n; i += 3) {
      _pa.fromBufferAttribute(P, i).applyMatrix4(_m); _pb.fromBufferAttribute(P, i + 1).applyMatrix4(_m); _pc.fromBufferAttribute(P, i + 2).applyMatrix4(_m);
      if (!sm) { _cb.subVectors(_pc, _pb); _ab.subVectors(_pa, _pb); _cb.cross(_ab).normalize(); }
      let k = 0;
      for (const q of [_pa, _pb, _pc]) { if (sm) { _cb.fromBufferAttribute(N, i + k).set(_cb.x / sx, _cb.y / sy, _cb.z / sz).applyQuaternion(_q).normalize(); } k++; this.pos.push(q.x, q.y, q.z); this.nor.push(_cb.x, _cb.y, _cb.z); this.col.push(r, g, b); this.acc.push(isAcc ? 1 : 0); }
    }
    return this;
  }
  box(w, h, d, x, y, z, c, o) { return this._add(prim('box', () => new THREE.BoxGeometry(1, 1, 1)), x, y, z, w, h, d, c, o); }
  cyl(rt, rb, h, seg, x, y, z, c, o) { const R = Math.max(rt, rb, .001), k = (rt / R).toFixed(2); return this._add(prim('cyl' + seg + '_' + k, () => new THREE.CylinderGeometry(rt / R, 1, 1, seg), true), x, y, z, R, h, R, c, o); }
  cone(r, h, seg, x, y, z, c, o) { return this._add(prim('cyl' + seg + '_0.00', () => new THREE.CylinderGeometry(0, 1, 1, seg), true), x, y, z, r, h, r, c, o); }
  sph(rx, ry, rz, x, y, z, c, o) { return this._add(prim('ico1', () => new THREE.IcosahedronGeometry(1, 1), true), x, y, z, rx, ry, rz, c, o); }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3)); g.setAttribute('aAcc', new THREE.Float32BufferAttribute(this.acc, 1)); return g;
  }
}
const part = (g, mode, ox, oy, oz, spd) => ({ geo: g.build(), mode: mode || 'body', ox: ox || 0, oy: oy || 0, oz: oz || 0, spd: spd || 0 });
const OLIVE = 0x5d6e46, DARK = 0x2c3128, TAN = 0xb6a275, STEEL = 0x79828b, BLACK = 0x1f2327, SKIN = 0xdeb287, WHITE = 0xe9edf0, RED = 0xc63a2d, WOOD = 0x7a5a3a, KHAKI = 0x8d8461, GLASS = 0x2b4254, CONC = 0x8c9097, CONC2 = 0x6d7279;

// extra shapes for the models, built on GB's cached primitives (no new geometry per instance)
const shade = (c, k) => _c4.set(c).multiplyScalar(k).getHex();
const xcyl = (g, sm, seg, k, rx, h, rz, x, y, z, c, o) => g._add(prim((sm ? 'xs' : 'xf') + seg + '_' + k, () => new THREE.CylinderGeometry(k, 1, 1, seg), sm), x, y, z, rx, h, rz, c, o);
const fcyl = (g, seg, k, rx, h, rz, x, y, z, c, o) => xcyl(g, false, seg, k, rx, h, rz, x, y, z, c, o);    // flat-shaded prism / frustum with separate x and z radii (k = top/bottom radius)
const scyl = (g, seg, k, rx, h, rz, x, y, z, c, o) => xcyl(g, true, seg, k, rx, h, rz, x, y, z, c, o);     // the same, smooth-shaded
const hcyl = (g, seg, r, len, x, y, z, c, o, rh) => g._add(prim('hc' + seg, () => new THREE.CylinderGeometry(1, 1, 1, seg, 1, false, -PI / 2, PI), true), x, y, z, r, len, rh || r, c, Object.assign({ rx: -PI / 2 }, o));   // half cylinder lying along z, dome up (huts, hangars); rh = dome height
const wedge = (g, w, h, d, x, y, z, c, o) => g._add(prim('wedge', () => { const v = [[-.5, -.5, -.5], [.5, -.5, -.5], [.5, -.5, .5], [-.5, -.5, .5], [-.5, .5, .5], [.5, .5, .5]], P = []; for (const i of [0, 1, 2, 0, 2, 3, 3, 2, 5, 3, 5, 4, 0, 4, 5, 0, 5, 1, 0, 3, 4, 1, 5, 2]) P.push(...v[i]); const b = new THREE.BufferGeometry(); b.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); return b; }), x, y, z, w, h, d, c, o);   // ramp: full height at +z, zero at -z (roofs, glacis plates)
const dome = (g, rx, ry, rz, x, y, z, c, o) => g._add(prim('dome8', () => new THREE.SphereGeometry(1, 8, 3, 0, TAU, 0, PI / 2), true), x, y, z, rx, ry, rz, c, o);   // low-poly half sphere (helmets, hats)
const ball = (g, rx, ry, rz, x, y, z, c, o) => g._add(prim('ico0', () => new THREE.IcosahedronGeometry(1, 0), true), x, y, z, rx, ry, rz, c, o);   // cheap 20-triangle ball
const strut = (g, x1, y1, z1, x2, y2, z2, w, h, c, o) => { const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1, L = Math.hypot(dx, dy, dz) || .001; return g.box(w, h, L, (x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2, c, Object.assign({ rx: -Math.asin(dy / L), ry: Math.atan2(dx, dz) }, o)); };   // box from point to point
const rod = (g, r, seg, x1, y1, z1, x2, y2, z2, c, o) => { const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1, L = Math.hypot(dx, dy, dz) || .001; return g.cyl(r, r, L, seg, (x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2, c, Object.assign({ rx: Math.acos(dy / L), ry: Math.atan2(dx, dz) }, o)); };   // cylinder from point to point
const TIRE = 0x24272b, TRK = 0x2b2e31, LAMP = 0xf2e6b0;

// ---------------- unit models ----------------
// Soldiers face +z. Helmet / headgear and shoulder pads carry the team colour; each type gets its own weapon, headgear and kit.
function infModel(o) {
  const g = new GB(), V = o.vest || OLIVE, Pn = o.pants || 0x3a4030, S = o.skin || SKIN, w = o.w || 1, gc = o.gc || BLACK, sl = o.sleeve || V, hc = o.helm;
  // boots, legs (a small stride), belt, torso, chest rig
  g.box(.25, .17, .36, -.15, .085, .08, 0x2a2622); g.box(.25, .17, .36, .15, .085, -.02, 0x2a2622);
  g.box(.24, .66, .27, -.15, .5, .04, Pn); g.box(.24, .66, .27, .15, .5, -.04, Pn);
  g.box(.62 * w, .14, .36, 0, .86, 0, 0x3b3426);
  g.box(.62 * w, .6, .34, 0, 1.2, 0, V);
  g.box(.66 * w, .3, .4, 0, 1.12, .01, o.rig || shade(V, .72));
  for (const s of [-1, 1]) g.box(.22, .13, .38, s * .36 * w, 1.45, 0, 0, { acc: .95 });   // team shoulder pads
  g.box(.27, .28, .27, 0, 1.68, .01, S);                                                   // head
  switch (o.hat || 'helmet') {
    case 'helmet': dome(g, .24, .25, .26, 0, 1.71, 0, hc || 0, hc ? undefined : { acc: 1 }); break;
    case 'hard': dome(g, .22, .21, .24, 0, 1.75, 0, hc); g.cyl(.28, .28, .03, 8, 0, 1.765, .03, hc); g.box(.06, .05, .42, 0, 1.94, 0, 0, { acc: 1 }); break;
    case 'cap': dome(g, .19, .14, .2, 0, 1.77, 0, 0, { acc: 1 }); g.box(.22, .03, .2, 0, 1.81, .2, 0, { acc: .8 }); break;
    case 'beret': dome(g, .26, .09, .25, -.06, 1.8, -.01, 0, { acc: 1, rz: .35 }); g.box(.07, .07, .03, -.1, 1.8, .22, 0xd8a52c); break;
    case 'boonie': g.cyl(.15, .18, .13, 8, 0, 1.88, 0, hc); g.cyl(.32, .32, .03, 10, 0, 1.82, 0, hc); break;
    case 'hood': dome(g, .25, .3, .27, 0, 1.6, -.04, hc); g.box(.34, .16, .3, .2, 1.56, -.08, shade(hc, .85), { ry: .5, rz: -.3 }); g.box(.34, .16, .3, -.2, 1.56, -.08, shade(hc, 1.15), { ry: -.5, rz: .3 }); break;
    case 'medic': dome(g, .24, .25, .26, 0, 1.71, 0, WHITE); g.box(.24, .03, .08, 0, 1.95, 0, RED); g.box(.08, .03, .24, 0, 1.95, 0, RED); break;
    // 3.0 Iron Legion: sealed angular helmet with a glowing visor and a team-coloured ridge (crest = Praetorian)
    case 'lg': g.box(.32, .3, .34, 0, 1.71, 0, hc || 0x3a414c); g.box(.34, .08, .36, 0, 1.86, -.01, shade(hc || 0x3a414c, .8)); g.box(.26, .07, .05, 0, 1.73, .175, 0x6fe6ff); g.box(.06, .06, .3, 0, 1.9, -.02, 0, { acc: 1 }); break;
    case 'lgcrest': g.box(.33, .31, .35, 0, 1.71, 0, hc || 0x2c323b); g.box(.27, .07, .05, 0, 1.73, .18, 0x6fe6ff); g.box(.07, .24, .46, 0, 1.96, -.03, 0, { acc: 1 }); break;
  }
  // weapon; R / Lh are where the right and left hands go
  let R, Lh;
  switch (o.gun) {
    case 'rocket':   // launcher tube over the right shoulder
      g.cyl(.12, .12, 1.7, 6, .27, 1.52, .25, 0x3e4a33, { rx: PI / 2 }); g.cyl(.12, .17, .24, 6, .27, 1.52, -.7, 0x2b3326, { rx: PI / 2 });
      g.cyl(.15, .15, .22, 6, .27, 1.52, 1.18, 0x8a4f2c, { rx: PI / 2 }); g.cone(.15, .32, 6, .27, 1.52, 1.45, 0x8a4f2c, { rx: PI / 2 });
      g.box(.07, .22, .1, .27, 1.36, .45, gc); g.box(.1, .12, .16, .15, 1.62, .55, gc);
      R = [.27, 1.32, .45]; Lh = [.22, 1.4, .82]; break;
    case 'lmg':      // belt-fed machine gun with an ammo box
      g.box(.13, .19, .62, .17, 1.14, .38, gc); g.cyl(.075, .075, .24, 6, .17, 1.17, .78, 0x3a3f44, { rx: PI / 2 }); g.cyl(.045, .045, .5, 6, .17, 1.17, 1.1, gc, { rx: PI / 2 });
      g.box(.22, .22, .24, .32, 1.02, .38, 0x4d5a3a); g.box(.08, .18, .28, .17, 1.07, .0, gc);
      R = [.17, 1.06, .22]; Lh = [.1, 1.12, .62]; break;
    case 'sniper':   // long rifle with a big scope
      g.box(.08, .13, .62, .16, 1.16, .38, 0x3c3a2e); g.cyl(.035, .035, .95, 6, .16, 1.2, 1.15, gc, { rx: PI / 2 }); g.cyl(.055, .055, .44, 6, .16, 1.33, .38, gc, { rx: PI / 2 });
      g.box(.08, .17, .3, .16, 1.1, -.02, 0x3c3a2e);
      R = [.16, 1.07, .22]; Lh = [.1, 1.13, .62]; break;
    case 'mortar':   // tube on a bipod and base plate, carried in front
      g.box(.5, .05, .5, .05, .04, .72, 0x3a3f44); rod(g, .1, 6, .05, .1, .62, .05, 1.08, 1.15, 0x3c4630); g.cyl(.12, .12, .08, 6, .05, 1.08, 1.15, 0x2b3326, { rx: .5 });
      strut(g, .05, .62, .9, -.16, .03, 1.18, .04, .04, 0x2b3326); strut(g, .05, .62, .9, .26, .03, 1.18, .04, .04, 0x2b3326);
      R = [.12, .98, .98]; Lh = [-.05, .7, .82]; break;
    case 'gren':     // stubby drum-fed grenade launcher
      g.box(.11, .16, .42, .17, 1.14, .3, gc); g.cyl(.1, .1, .42, 6, .17, 1.18, .72, 0x3a3f44, { rx: PI / 2 }); g.cyl(.15, .15, .22, 8, .17, 1.12, .36, 0x4d5a3a, { rx: PI / 2 });
      g.box(.08, .16, .26, .17, 1.07, -.02, gc);
      R = [.17, 1.05, .2]; Lh = [.1, 1.14, .62]; break;
    case 'smg':      // compact sub-machine gun
      g.box(.1, .15, .42, .17, 1.14, .36, gc); g.box(.05, .05, .25, .17, 1.17, .68, gc); g.box(.06, .2, .08, .17, 1.0, .4, gc);
      R = [.17, 1.06, .24]; Lh = [.08, 1.12, .55]; break;
    case 'pistol':
      g.box(.08, .12, .3, .2, 1.12, .44, gc);
      R = [.2, 1.06, .32]; Lh = [-.42 * w, .95, .06]; break;
    // 3.0 Iron Legion weapons (glowing parts are Embercore cyan)
    case 'pulse':    // pulse carbine: slab body with a glowing emitter rail
      g.box(.1, .15, .52, .16, 1.16, .38, gc); g.box(.04, .04, .4, .16, 1.245, .5, 0x59d8ff); g.box(.07, .09, .2, .16, 1.15, .74, gc); g.box(.05, .05, .06, .16, 1.15, .86, 0x9ff0ff); g.box(.07, .17, .1, .16, 1.04, .32, gc);
      R = [.16, 1.07, .24]; Lh = [.1, 1.13, .62]; break;
    case 'lance':    // plasma lance over the right shoulder, with glowing coils
      g.cyl(.11, .11, 1.6, 6, .27, 1.55, .3, 0x3a414c, { rx: PI / 2 }); for (const z of [-.2, .25, .7]) g.cyl(.14, .14, .08, 8, .27, 1.55, z, 0x59d8ff, { rx: PI / 2 }); g.cone(.12, .28, 6, .27, 1.55, 1.24, 0x9ff0ff, { rx: PI / 2 });
      g.box(.07, .22, .1, .27, 1.38, .45, gc); R = [.27, 1.34, .45]; Lh = [.22, 1.42, .82]; break;
    case 'rotary':   // rotary pulse cannon at the hip with a power pack
      g.box(.16, .22, .55, .2, 1.1, .32, gc); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.cyl(.03, .03, .55, 5, .2 + Math.cos(a) * .07, 1.12 + Math.sin(a) * .07, .82, 0x3a414c, { rx: PI / 2 }); }
      g.cyl(.1, .1, .05, 8, .2, 1.12, 1.08, 0x59d8ff, { rx: PI / 2 }); g.box(.24, .26, .26, .4, 1.0, .2, 0x2c323b); g.box(.04, .2, .02, .53, 1.0, .2, 0x59d8ff);
      R = [.2, 1.04, .2]; Lh = [.1, 1.12, .6]; break;
    case 'rail':     // rail rifle: two long rails with glowing coils
      g.box(.09, .14, .56, .16, 1.16, .34, gc); for (const y of [1.2, 1.28]) g.box(.05, .03, 1.0, .16, y, 1.05, 0x3a414c); for (const z of [.7, .95, 1.2]) g.box(.1, .13, .04, .16, 1.24, z, 0x59d8ff);
      g.box(.06, .06, .3, .16, 1.34, .3, gc); g.box(.08, .17, .28, .16, 1.08, -.02, gc);
      R = [.16, 1.07, .22]; Lh = [.1, 1.13, .62]; break;
    case 'arc':      // lightning projector: copper coil and a glowing orb
      g.box(.14, .18, .46, .17, 1.12, .34, gc); g.cyl(.07, .1, .3, 6, .17, 1.14, .68, 0xb0763a, { rx: PI / 2 }); ball(g, .12, .12, .12, .17, 1.14, .9, 0x9ff0ff);
      R = [.17, 1.05, .22]; Lh = [.1, 1.12, .55]; break;
    case 'pmortar':  // plasma mortar: short tube on a bipod with glowing coils, carried in front
      g.box(.44, .05, .44, .05, .04, .72, 0x22262c); rod(g, .11, 6, .05, .12, .64, .05, 1.1, 1.12, 0x3a414c); for (const k of [.38, .68]) g.cyl(.145, .145, .06, 8, .05, .12 + .98 * k, .64 + .48 * k, 0x59d8ff, { rx: .45 }); g.cyl(.12, .12, .08, 6, .05, 1.1, 1.12, 0x9ff0ff, { rx: .45 });
      strut(g, .05, .64, .9, -.16, .03, 1.18, .04, .04, 0x2c323b); strut(g, .05, .64, .9, .26, .03, 1.18, .04, .04, 0x2c323b);
      R = [.12, .98, .98]; Lh = [-.05, .7, .82]; break;
    case 'tool':     // pulse pistol (the other hand carries a tool, see the pack)
      g.box(.08, .12, .3, .2, 1.12, .44, gc); g.box(.03, .03, .1, .2, 1.15, .62, 0x59d8ff);
      R = [.2, 1.06, .32]; Lh = [-.42 * w, .95, .06]; break;
    default:         // assault rifle
      g.box(.09, .14, .5, .16, 1.16, .38, gc); g.box(.05, .05, .42, .16, 1.19, .82, gc); g.box(.08, .16, .28, .16, 1.08, .02, 0x4a3b2c); g.box(.06, .17, .08, .16, 1.02, .44, gc);
      R = [.16, 1.07, .24]; Lh = [.1, 1.13, .62];
  }
  if (o.lh) Lh = o.lh;
  strut(g, .34 * w, 1.4, 0, R[0], R[1], R[2], .15, .15, sl); strut(g, -.34 * w, 1.4, 0, Lh[0], Lh[1], Lh[2], .15, .15, sl);   // arms
  // back pack / kit
  switch (o.pack) {
    case 'none': break;
    case 'rocket': g.box(.4, .44, .2, 0, 1.18, -.27, 0x4d5a3a); for (const x of [-.1, .1]) { g.cyl(.07, .07, .4, 6, x, 1.5, -.29, 0x8a4f2c); } break;
    case 'tools': g.box(.5, .5, .26, 0, 1.18, -.3, 0x6a4a2a); g.box(.52, .08, .28, 0, 1.3, -.3, 0, { acc: .9 }); g.cyl(.09, .09, .62, 6, -.17, 1.3, -.47, RED);
      g.box(.06, .62, .06, .2, 1.6, -.42, STEEL, { rz: -.35 }); g.box(.2, .08, .06, .31, 1.88, -.42, STEEL, { rz: -.35 }); break;
    case 'radio': g.box(.34, .38, .18, 0, 1.2, -.26, 0x4a4f3a); g.box(.03, .95, .03, -.12, 1.8, -.31, BLACK); break;
    case 'ammo': g.box(.52, .55, .24, 0, 1.15, -.3, 0x3d4535); strut(g, .26, 1.0, -.2, .3, 1.02, .3, .07, .04, 0xb59a3a); break;
    case 'ghillie': g.box(.52, .5, .22, 0, 1.22, -.25, 0x4c5a33); g.box(.4, .2, .2, .1, 1.5, -.3, 0x5a6b3c, { ry: .4 }); break;
    case 'shells': g.box(.42, .46, .22, 0, 1.2, -.28, 0x5a4f36); for (const x of [-.12, 0, .12]) g.cyl(.055, .055, .3, 6, x, 1.52, -.28, 0x6b7350); break;
    case 'med': g.box(.42, .42, .22, 0, 1.2, -.28, WHITE); g.box(.24, .07, .02, 0, 1.22, -.395, RED); g.box(.07, .24, .02, 0, 1.22, -.395, RED); break;
    case 'demo': g.box(.42, .42, .2, 0, 1.2, -.27, 0x2e3236); for (const x of [-.1, .1]) g.box(.14, .1, .08, x, 1.26, -.4, 0xc4652a); break;
    case 'duffel': g.cyl(.16, .16, .52, 6, 0, 1.24, -.3, 0x6a5a3a, { rz: PI / 2 }); break;
    // 3.0 Iron Legion packs
    case 'jet': g.box(.4, .46, .2, 0, 1.22, -.27, 0x2c323b); for (const x of [-.13, .13]) { g.cyl(.09, .11, .42, 8, x, 1.12, -.4, 0x3a414c); g.cyl(.08, .08, .05, 8, x, .89, -.4, 0x59d8ff); } g.box(.44, .06, .22, 0, 1.46, -.27, 0, { acc: .9 }); break;
    case 'cell': g.box(.42, .44, .2, 0, 1.2, -.27, 0x2c323b); g.box(.28, .26, .02, 0, 1.22, -.375, 0x59d8ff); g.box(.44, .08, .22, 0, 1.43, -.27, 0, { acc: .9 }); break;
    case 'nano': g.box(.42, .42, .22, 0, 1.2, -.28, 0xd8dee6); g.box(.22, .06, .02, 0, 1.22, -.395, 0x59d8ff); g.box(.06, .22, .02, 0, 1.22, -.395, 0x59d8ff); ball(g, .1, .1, .1, .22, 1.58, -.3, 0x9ff0ff); break;
    case 'coil': g.box(.4, .44, .2, 0, 1.2, -.27, 0x2c323b); for (let i = 0; i < 3; i++) g.cyl(.12 - i * .02, .12 - i * .02, .05, 8, 0, 1.5 + i * .09, -.3, 0xb0763a); ball(g, .08, .08, .08, 0, 1.8, -.3, 0x9ff0ff); break;
    case 'tools2': g.box(.5, .5, .26, 0, 1.18, -.3, 0x2c323b); g.box(.52, .08, .28, 0, 1.3, -.3, 0, { acc: .9 }); g.box(.06, .62, .06, .2, 1.6, -.42, STEEL, { rz: -.35 }); g.box(.1, .1, .1, .31, 1.9, -.42, 0x59d8ff); break;
    default: g.box(.42, .42, .2, 0, 1.2, -.27, o.packc || KHAKI); g.box(.44, .12, .12, 0, 1.46, -.27, shade(o.packc || KHAKI, .8));
  }
  if (o.extra) o.extra(g);
  return [part(g, 'aim')];
}
const MDL = {};
function buildModels() {
  MDL.rifleman = infModel({ vest: OLIVE, pants: 0x3a4030 });
  MDL.rocket = infModel({ vest: 0x5a5f4a, gun: 'rocket', pants: 0x333a2c, pack: 'rocket' });
  MDL.mechanic = infModel({ vest: 0x2f5f8f, rig: 0x26405c, hat: 'hard', helm: 0xd94a2a, gun: 'pistol', pants: 0x2f5f8f, pack: 'tools', extra: g => { g.box(.09, .4, .09, .4, .8, .16, STEEL); g.box(.22, .09, .09, .4, 1.0, .16, STEEL); g.box(.5, .06, .3, 0, 1.25, .2, 0x1d3550); } });
  MDL.engineer = infModel({ vest: 0xc9922f, rig: 0x6a5a3a, hat: 'hard', helm: 0xe9c33a, gun: 'pistol', pants: 0x4a4636, pack: 'tools', extra: g => { g.box(.68, .05, .42, 0, 1.3, 0, 0xd8dcd0); g.box(.68, .05, .42, 0, 1.0, 0, 0xd8dcd0); g.box(.07, .3, .07, -.42, .84, .12, STEEL); g.box(.2, .07, .07, -.42, .7, .12, STEEL); } });
  MDL.scout = infModel({ vest: 0x6b7a50, rig: 0x55603f, hat: 'cap', gun: 'pistol', pack: 'radio', lh: [-.07, 1.6, .26], extra: g => { g.box(.22, .1, .14, -.02, 1.67, .22, BLACK); g.box(.24, .12, .3, -.2, .56, .1, 0x55603f); } });
  MDL.heavy = infModel({ vest: 0x4b5240, rig: 0x2e3328, gun: 'lmg', pants: 0x2c3128, w: 1.18, pack: 'ammo', extra: g => { g.box(.27, .07, .04, 0, 1.7, .15, 0x1f2327); g.box(.5, .3, .1, 0, .7, .17, 0x2e3328); } });
  MDL.sniper = infModel({ vest: 0x3d4f2e, rig: 0x33402a, gun: 'sniper', pants: 0x2e3b25, hat: 'hood', helm: 0x4c5c33, pack: 'ghillie', extra: g => { g.box(.18, .09, .22, -.4, 1.3, .04, 0, { acc: 1 }); } });
  MDL.mortar = infModel({ vest: 0x5f5438, gun: 'mortar', pants: 0x3a3626, pack: 'shells' });
  MDL.grenadier = infModel({ vest: 0x7a5a3a, rig: 0x5a4430, gun: 'gren', pants: 0x3a3626, extra: g => { strut(g, -.3, 1.46, .22, .28, .9, .22, .1, .05, 0x3b3426); for (let i = 0; i < 3; i++) g.box(.1, .12, .08, -.18 + i * .17, 1.31 - i * .16, .25, 0x4d5a3a); } });
  MDL.commando = infModel({ vest: 0x24282b, rig: 0x1a1d1f, gun: 'smg', pants: 0x1c1f21, skin: 0x2a2d30, hat: 'beret', w: 1.08, pack: 'demo', extra: g => { g.box(.2, .05, .03, 0, 1.71, .145, 0xdeb287); g.box(.06, .26, .08, -.27, .55, .14, 0x55595d); } });
  MDL.merc = infModel({ vest: 0x7a6a4a, rig: 0x5a4d36, pants: 0x3a352a, hat: 'boonie', helm: 0x8d8461, pack: 'duffel', extra: g => { g.box(.25, .06, .03, 0, 1.7, .145, BLACK); strut(g, -.3, 1.46, .22, .28, .9, .22, .1, .06, 0xd8a52c); g.box(.6, .05, .37, 0, .93, 0, 0xd8a52c); } });
  MDL.medic = infModel({ vest: 0xe5e8ea, rig: 0xc9cdd1, gun: 'pistol', pants: 0x7b8087, hat: 'medic', pack: 'med', extra: g => { g.box(.24, .08, .02, 0, 1.24, .215, RED); g.box(.08, .24, .02, 0, 1.24, .215, RED); g.box(.18, .1, .2, -.38, 1.3, .02, 0, { acc: 1 }); g.box(.24, .18, .14, -.43, .82, .1, WHITE); g.box(.12, .04, .02, -.43, .84, .175, RED); g.box(.04, .12, .02, -.43, .84, .175, RED); } });
  // vehicles face +z; tops of turrets, fenders and stripes carry the team colour
  const wheel = (g, x, y, z, r, w) => { g.cyl(r, r, w, 10, x, y, z, TIRE, { rz: PI / 2 }); g.cyl(r * .55, r * .55, w + .06, 6, x, y, z, STEEL, { rz: PI / 2 }); };
  const track = (g, x, L, h, w) => {   // track run with rounded ends and road wheels
    const r = h / 2, n = Math.max(4, Math.round(L / 1.05)); g.box(w, h, L - h, x, r, 0, TRK);
    for (const s of [-1, 1]) g.cyl(r, r, w, 8, x, r, s * (L / 2 - r), TRK, { rz: PI / 2 });
    for (let i = 0; i < n; i++) g.cyl(r * .66, r * .66, w + .1, 8, x, r * .85, (i - (n - 1) / 2) * (L - h * 1.2) / (n - 1), 0x4a5056, { rz: PI / 2 });
  };
  { // Scout Car: open-top 4x4 with a roll bar and a pintle machine gun
    const g = new GB(), c = 0x617248, c2 = shade(c, .78);
    for (const x of [-.95, .95]) for (const z of [-1.15, 1.2]) { wheel(g, x, .48, z, .48, .36); g.box(.5, .1, 1.05, x * 1.02, 1.0, z, c2); }
    g.box(1.62, .5, 3.4, 0, .82, 0, c); g.box(1.55, .26, 1.15, 0, 1.15, 1.1, c); g.box(1.1, .03, .8, 0, 1.29, 1.08, 0, { acc: .95 });
    g.box(1.5, .32, .1, 0, .9, 1.72, 0x2a2e26); for (const x of [-.55, .55]) g.box(.22, .14, .06, x, 1.02, 1.76, LAMP);
    g.box(1.5, .48, .05, 0, 1.5, .48, GLASS, { rx: -.25 }); g.box(1.58, .07, .1, 0, 1.74, .42, c2, { rx: -.25 });
    for (const x of [-.4, .4]) { g.box(.42, .12, .45, x, 1.12, .0, 0x2c2a26); g.box(.42, .45, .1, x, 1.33, -.22, 0x2c2a26); }
    for (const x of [-.75, .75]) g.box(.08, .78, .08, x, 1.45, -.7, c2); g.box(1.58, .08, .08, 0, 1.84, -.7, c2);
    g.cyl(.38, .38, .2, 10, 0, 1.02, -1.82, TIRE, { rx: PI / 2 }); g.cyl(.2, .2, .22, 6, 0, 1.02, -1.82, STEEL, { rx: PI / 2 });
    g.box(1.66, .14, .12, 0, .72, -1.72, 0, { acc: .9 }); g.box(.24, .32, .3, .6, 1.2, -1.35, 0x56603e); g.box(.03, 1.0, .03, -.7, 1.6, -1.5, BLACK);
    const t = new GB(); t.cyl(.06, .06, .22, 6, 0, -.08, 0, STEEL); t.box(.2, .2, .55, 0, .1, .1, BLACK); t.cyl(.04, .04, .7, 6, 0, .12, .7, BLACK, { rx: PI / 2 });
    t.box(.18, .2, .24, .2, .04, .05, 0x4d5a3a); t.box(.8, .42, .06, 0, .2, .42, 0, { acc: .9, rx: -.15 });
    MDL.jeep = [part(g), part(t, 'turret', 0, 1.95, -.7)];
  }
  { // APC: eight-wheeled armoured box with a small gun turret
    const g = new GB(), c = 0x5b6b45, c2 = shade(c, .78);
    for (const x of [-1.17, 1.17]) for (const z of [-1.65, -.55, .55, 1.65]) wheel(g, x, .52, z, .52, .4);
    g.box(2.0, .7, 4.5, 0, .85, 0, c2); g.box(2.36, .72, 3.9, 0, 1.4, -.25, c); strut(g, 0, 1.76, 1.7, 0, .72, 2.42, 2.3, .22, c);
    g.box(2.0, .1, 3.3, 0, 1.81, -.45, c2); for (const s of [-1, 1]) { g.box(.04, .2, 3.4, s * 1.19, 1.45, -.3, 0, { acc: .9 }); g.box(.1, .12, 2.2, s * 1.2, 1.74, -.6, 0x3a3a30); g.box(.22, .14, .08, s * .85, 1.35, 2.12, LAMP); for (let i = 0; i < 2; i++) g.cyl(.07, .07, .26, 6, s * (.8 + i * .16), 1.9, 1.3, DARK, { rx: .7 }); }
    g.box(1.3, .04, 1.1, 0, 1.87, -1.45, 0, { acc: .9 }); for (const x of [-.5, .5]) g.box(.5, .08, .55, x, 1.88, .25, c2);
    g.box(1.1, .82, .08, 0, 1.15, -2.23, c2); g.box(.62, .05, .5, .7, 1.79, 1.05, 0x2a2d30);
    const t = new GB(); t.cyl(.5, .55, .2, 8, 0, 0, 0, c2); t.box(.72, .4, .72, 0, .28, 0, c); t.box(.62, .04, .62, 0, .5, 0, 0, { acc: 1 });
    t.box(.18, .18, .5, 0, .3, .5, BLACK); t.cyl(.055, .055, 1.0, 6, 0, .3, 1.05, BLACK, { rx: PI / 2 }); t.box(.2, .26, .32, .47, .25, 0, 0x4d5a3a); t.box(.2, .18, .22, -.25, .6, .1, DARK); t.box(.12, .1, .02, -.25, .62, .22, GLASS);
    MDL.apc = [part(g), part(t, 'turret', 0, 1.92, -.3)];
  }
  { // Light Tank: narrow tracks, small wedge turret, thin gun
    const g = new GB(), c = 0x627349, c2 = shade(c, .78), L = 4.2;
    for (const s of [-1, 1]) { track(g, s * 1.13, L, .78, .66); g.box(.78, .08, L - .1, s * 1.13, .83, -.02, c); g.box(.06, .06, L - .5, s * 1.5, .86, 0, 0, { acc: .9 }); g.box(.32, .22, .7, s * 1.13, .98, -1.2, 0x3e4434); g.box(.18, .12, .08, s * .8, 1.12, 1.72, LAMP); g.cyl(.08, .08, .3, 6, s * .6, .95, -1.95, DARK, { rx: PI / 2 }); }
    g.box(1.6, .6, 3.9, 0, .7, 0, c2); g.box(2.2, .38, 3.0, 0, 1.08, -.35, c); strut(g, 0, 1.27, 1.15, 0, .7, 1.95, 2.1, .2, c); g.box(1.5, .06, 1.0, 0, 1.29, -1.25, 0x2a2d30);
    const t = new GB(); fcyl(t, 6, .74, .85, .5, 1.0, 0, .2, 0, c); fcyl(t, 6, 1, .56, .04, .67, 0, .46, 0, 0, { acc: 1 });
    t.box(.42, .32, .3, 0, .2, .95, c2); rod(t, .09, 8, 0, .22, 1.0, 0, .22, 3.0, c2); t.cyl(.12, .12, .3, 8, 0, .22, 2.95, DARK, { rx: PI / 2 });
    t.cyl(.2, .22, .14, 8, -.28, .52, -.25, c2); t.box(.03, 1.2, .03, .45, 1.0, -.55, BLACK); t.box(1.0, .26, .35, 0, .22, -1.05, shade(c, .7));
    MDL.lighttank = [part(g), part(t, 'turret', 0, 1.33, -.1)];
  }
  { // Main Battle Tank: wide tracks with armour skirts, big angular turret, long gun with a bore evacuator
    const g = new GB(), c = 0x55643f, c2 = shade(c, .78), L = 5.0;
    for (const s of [-1, 1]) { track(g, s * 1.42, L, .9, .8); g.box(.1, .55, L - .4, s * 1.86, .78, .05, c); g.box(.9, .08, L - .2, s * 1.42, .97, 0, c); g.box(.08, .06, L - .6, s * 1.89, 1.06, .05, 0, { acc: .9 }); g.box(1.0, .06, 1.2, s * .7, 1.41, -1.45, 0x2a2d30); g.box(.25, .14, .1, s * 1.05, 1.18, 2.08, LAMP); g.box(.3, .2, .1, s * .9, 1.15, -2.2, DARK); }
    g.box(2.0, .7, 4.7, 0, .75, 0, c2); g.box(2.9, .38, 3.6, 0, 1.2, -.35, c); strut(g, 0, 1.39, 1.45, 0, .7, 2.45, 2.7, .22, c);
    const t = new GB(); t.box(2.3, .64, 2.2, 0, .3, -.2, c); fcyl(t, 3, 1, 1.33, .64, .78, 0, .3, .95, c); t.box(1.9, .52, .8, 0, .32, -1.65, c2);
    t.box(2.0, .04, 1.9, 0, .63, -.25, 0, { acc: 1 }); fcyl(t, 3, 1, 1.05, .04, .6, 0, .63, .95, 0, { acc: 1 });
    t.box(.55, .42, .4, 0, .3, 1.55, c2); rod(t, .15, 8, 0, .32, 1.6, 0, .32, 4.4, c2); t.cyl(.22, .22, .5, 8, 0, .32, 2.9, c2, { rx: PI / 2 }); t.box(.36, .3, .4, 0, .32, 4.4, DARK);
    t.cyl(.28, .3, .22, 8, .5, .72, -.45, c2); t.box(.08, .08, .6, .5, .9, -.2, BLACK); t.box(.35, .3, .35, -.55, .78, .3, DARK); t.box(.25, .14, .02, -.55, .8, .48, GLASS);
    t.box(.03, 1.5, .03, -.85, 1.3, -1.6, BLACK); t.box(.03, 1.1, .03, .85, 1.1, -1.6, BLACK);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) t.cyl(.06, .06, .2, 6, s * 1.13, .5, .25 + i * .17, DARK, { rx: PI / 2 - .5 });
    MDL.tank = [part(g), part(t, 'turret', 0, 1.41, -.15)];
  }
  { // Self-Propelled Gun: big boxy turret at the back, very long raised barrel, recoil spade
    const g = new GB(), c = 0x8f8458, c2 = shade(c, .78), L = 4.8;
    for (const s of [-1, 1]) { track(g, s * 1.25, L, .82, .7); g.box(.8, .08, L - .1, s * 1.25, .86, 0, c); g.box(.06, .06, L - .5, s * 1.63, .9, 0, 0, { acc: .9 }); g.box(.2, .12, .08, s * .85, 1.14, 2.25, LAMP); g.box(.36, .26, .7, s * 1.05, 1.42, 1.5, 0x5e5a40); }
    g.box(1.8, .62, 4.5, 0, .72, 0, c2); g.box(2.5, .34, 4.3, 0, 1.12, -.1, c); strut(g, 0, 1.29, 2.05, 0, .72, 2.45, 2.4, .2, c); g.box(2.2, .55, .14, 0, .5, -2.5, DARK, { rx: .5 });
    const t = new GB(), e = .2, pz = 1.45, py = .62, BL = 4.4, ex = Math.sin(e), ez = Math.cos(e);
    t.box(2.2, 1.05, 2.7, 0, .52, 0, c); t.box(1.9, .8, .3, 0, .5, 1.42, c2); t.box(2.0, .04, 2.4, 0, 1.06, -.1, 0, { acc: 1 });
    rod(t, .18, 8, 0, py, pz, 0, py + BL * ex, pz + BL * ez, c2); t.cyl(.25, .25, .6, 8, 0, py + 2.2 * ex, pz + 2.2 * ez, c2, { rx: PI / 2 - e }); t.box(.44, .32, .42, 0, py + BL * ex, pz + BL * ez, DARK, { rx: -e });
    t.cyl(.26, .28, .18, 8, .6, 1.12, -.5, c2); t.box(.08, .08, .55, .6, 1.27, -.25, BLACK); t.box(.03, 1.3, .03, -.8, 1.7, -1.1, BLACK);
    for (const s of [-1, 1]) t.box(.12, .5, 1.6, s * 1.15, .5, -.3, shade(c, .7));
    MDL.artillery = [part(g), part(t, 'turret', 0, 1.29, -.7)];
  }
  { // Anti-Air Gun: six-wheeled carrier, twin raised autocannons, spinning radar on the cab
    const g = new GB(), c = 0x5f6e48, c2 = shade(c, .78);
    for (const x of [-1.15, 1.15]) for (const z of [-1.3, 0, 1.3]) wheel(g, x, .55, z, .55, .4);
    g.box(2.0, .6, 3.9, 0, .85, 0, c2); g.box(2.36, .5, 3.7, 0, 1.3, -.1, c); g.box(2.1, .85, 1.1, 0, 1.95, 1.25, c);
    g.box(1.9, .4, .06, 0, 2.02, 1.82, GLASS); for (const s of [-1, 1]) { g.box(.06, .36, .7, s * 1.06, 2.02, 1.3, GLASS); g.box(.04, .18, 3.0, s * 1.19, 1.3, -.4, 0, { acc: .9 }); g.box(.22, .14, .08, s * .8, 1.3, 1.87, LAMP); }
    g.box(2.14, .05, 1.14, 0, 2.4, 1.25, 0, { acc: .95 }); g.cyl(.06, .06, .5, 6, 0, 2.65, 1.25, STEEL);
    const t = new GB(), e = .75, ey = Math.sin(e), ez = Math.cos(e);
    t.cyl(.85, .95, .3, 10, 0, 0, 0, c2); t.box(1.3, .72, 1.2, 0, .46, -.1, c); t.box(1.2, .04, 1.1, 0, .83, -.1, 0, { acc: 1 }); t.box(.5, .3, .3, 0, .55, .55, DARK); t.box(.3, .12, .02, 0, .58, .71, GLASS);
    for (const s of [-1, 1]) { t.box(.34, .46, 1.0, s * .86, .55, .1, c2); rod(t, .075, 6, s * .86, .62, .5, s * .86, .62 + 2.0 * ey, .5 + 2.0 * ez, BLACK); t.cyl(.12, .12, .3, 6, s * .86, .62 + 1.95 * ey, .5 + 1.95 * ez, DARK, { rx: PI / 2 - e }); }
    const r = new GB(); scyl(r, 10, 4, .13, .12, .13, 0, .12, .04, WHITE, { rx: .8 }); r.box(.08, .2, .08, 0, -.02, 0, STEEL);
    MDL.aa = [part(g), part(t, 'turret', 0, 1.55, -.85), part(r, 'rotor', 0, 2.95, 1.25, 3)];
  }
  { // Rocket Battery: six-wheeled truck with a cab and a raised 8-tube launcher pod
    const g = new GB(), c = 0x8a8158, c2 = shade(c, .78), cab = 0x5d6e46;
    for (const x of [-1.2, 1.2]) for (const z of [-1.9, -.7, 1.75]) { wheel(g, x, .6, z, .6, .42); g.box(.55, .08, 1.1, x * 1.02, 1.28, z, 0x2c3128); }
    g.box(1.6, .45, 5.0, 0, .85, 0, 0x2c3128); g.box(2.5, .3, 3.3, 0, 1.2, -.85, c); g.box(2.4, 1.15, 1.45, 0, 1.6, 1.75, cab);
    g.box(2.2, .45, .06, 0, 1.88, 2.48, GLASS); for (const s of [-1, 1]) { g.box(.06, .4, .8, s * 1.2, 1.88, 1.75, GLASS); g.box(.04, .14, 3.2, s * 1.27, 1.2, -.85, 0, { acc: .9 }); g.box(.24, .14, .06, s * .85, 1.25, 2.5, LAMP); }
    g.box(2.44, .05, 1.5, 0, 2.2, 1.75, 0, { acc: .95 }); g.box(2.5, .25, .2, 0, .9, 2.55, DARK);
    const t = new GB(), e = .45, dy = Math.sin(e), dz = Math.cos(e), uy = Math.cos(e), uz = -Math.sin(e), cy = .95, cz = .15;
    t.cyl(.8, .9, .25, 10, 0, 0, 0, c2); t.box(.5, .7, .6, 0, .45, -.6, c2);
    t.box(1.9, .9, 2.8, 0, cy, cz, c, { rx: -e }); t.box(1.94, .2, 2.84, 0, cy, cz, 0, { acc: 1, rx: -e });
    for (const v of [-.2, .2]) for (const x of [-.66, -.22, .22, .66]) { const py = cy + dy * 1.41 + uy * v, pz = cz + dz * 1.41 + uz * v; t.cyl(.15, .15, .06, 8, x, py, pz, DARK, { rx: PI / 2 - e }); t.cone(.1, .12, 6, x, py + dy * .07, pz + dz * .07, RED, { rx: PI / 2 - e }); }
    MDL.mlrs = [part(g), part(t, 'turret', 0, 1.35, -1.1)];
  }
  { // Titan: a giant walking mech. Legs and hips stay put, the torso and arm guns turn to aim.
    const g = new GB(), col = 0x5a6470, dk = 0x2c3238;
    g.box(2.6, .9, 1.8, 0, 4.25, 0, dk);
    for (const sx of [-1, 1]) {
      const hx = sx * 1.55;
      g.sph(.6, .6, .6, hx, 4.25, 0, STEEL); strut(g, hx, 4.2, 0, hx, 2.45, .75, 1.0, 1.0, col); strut(g, hx, 4.0, .55, hx, 2.75, 1.1, 1.06, .2, 0, { acc: .9 });
      g.sph(.5, .5, .5, hx, 2.45, .75, STEEL); strut(g, hx, 2.45, .75, hx, .55, -.05, .85, .85, col); strut(g, hx, 2.55, 1.15, hx, 1.0, .5, .7, .2, 0, { acc: .9 });
      rod(g, .09, 6, hx + sx * .56, 3.9, .1, hx + sx * .5, 1.0, -.1, STEEL);
      g.box(1.25, .42, 1.9, hx, .21, .3, dk); strut(g, hx, .4, 1.15, hx, .06, 1.6, 1.2, .26, dk); g.box(.5, .3, .6, hx, .15, -.85, dk);
    }
    const t = new GB();
    t.box(3.6, 1.8, 2.6, 0, .9, -.1, col); strut(t, 0, 1.75, 1.18, 0, .25, 1.5, 3.2, .4, col); t.box(3.7, .3, 2.7, 0, 1.95, -.1, 0, { acc: 1 });
    t.box(1.6, .7, 1.2, 0, 2.3, .45, dk); t.box(1.3, .2, .06, 0, 2.4, 1.06, 0x8ad4ff);
    t.box(2.4, 1.2, .8, 0, 1.2, -1.75, dk); for (const s of [-1, 1]) t.cyl(.22, .22, .9, 8, s * .7, 2.1, -1.95, DARK);
    t.box(1.1, 1.1, 1.3, 2.4, 1.3, .1, dk); t.box(1.2, .25, 1.4, 2.4, 1.95, .1, 0, { acc: 1 }); t.box(1.0, 1.0, 2.2, 2.75, .7, 1.2, col);
    rod(t, .3, 8, 2.75, .7, 2.3, 2.75, .7, 5.0, STEEL); t.cyl(.45, .45, .6, 8, 2.75, .7, 5.1, dk, { rx: PI / 2 });
    t.box(1.0, 1.0, 1.2, -2.35, 1.3, .1, dk); t.box(1.1, .25, 1.3, -2.35, 1.95, .1, 0, { acc: 1 }); t.box(.9, .9, 1.6, -2.65, .7, .9, col);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; t.cyl(.09, .09, 2.0, 6, -2.65 + Math.cos(a) * .25, .7 + Math.sin(a) * .25, 2.6, BLACK, { rx: PI / 2 }); } t.cyl(.4, .4, .15, 8, -2.65, .7, 3.3, dk, { rx: PI / 2 });
    t.box(1.0, .6, 1.0, 1.05, 2.25, -.75, dk); for (const x of [.8, 1.3]) for (const y of [2.12, 2.38]) t.box(.16, .16, .04, x, y, -.24, RED);
    t.box(.04, 1.4, .04, -1.2, 2.8, -1.2, BLACK);
    MDL.titan = [part(g), part(t, 'turret', 0, 4.7, 0)];
  }
  // air
  { // Recon Drone: quadcopter with four spinning props and a camera ball
    const g = new GB(), c = 0x8a929a; g.box(.7, .26, 1.0, 0, 0, 0, c); fcyl(g, 8, .7, .42, .18, .52, 0, .21, 0, 0, { acc: .95 }); g.sph(.17, .17, .17, 0, -.2, .35, 0x14181c);
    for (const s of [-1, 1]) strut(g, s * .3, -.13, -.2, s * .35, -.45, .2, .06, .06, DARK);
    const parts = [];
    for (const x of [-1, 1]) for (const z of [-1, 1]) { strut(g, 0, .02, 0, x * .8, .08, z * .75, .1, .08, DARK); g.cyl(.1, .12, .22, 8, x * .8, .16, z * .75, DARK); const r = new GB(); r.box(1.0, .03, .1, 0, 0, 0, BLACK); r.cyl(.05, .05, .06, 6, 0, 0, 0, STEEL); parts.push(part(r, 'rotor', x * .8, .3, z * .75, x * z > 0 ? 32 : -32)); }
    MDL.drone = [part(g)].concat(parts);
  }
  { // Attack Drone: delta-wing loitering munition with a red warhead
    const g = new GB(); fcyl(g, 3, 1, 1.25, .1, 1.3, 0, 0, -.3, 0x9aa1a8); fcyl(g, 3, 1, .95, .02, 1.0, 0, .06, -.42, 0, { acc: .95 });
    g.cyl(.17, .17, 1.6, 8, 0, .05, -.1, 0x7a828a, { rx: PI / 2 }); g.cone(.17, .45, 8, 0, .05, .92, RED, { rx: PI / 2 });
    for (const s of [-1, 1]) g.box(.05, .35, .3, s * 1.03, .12, -.85, 0x7a828a);
    g.cyl(.08, .08, .15, 6, 0, .05, -.97, DARK, { rx: PI / 2 }); g.box(.06, .7, .05, 0, .05, -1.06, BLACK, { rz: .5 }); g.box(.06, .7, .05, 0, .05, -1.06, BLACK, { rz: -1.07 });
    MDL.strike = [part(g)];
  }
  { // Attack Helicopter: slim gunship with a tandem canopy, stub wings and rocket pods
    const g = new GB(), c = 0x4f5c3d, c2 = shade(c, .78);
    g.sph(.62, .7, 1.8, 0, 0, 0, c); g.sph(.42, .4, .9, 0, .42, .75, GLASS); g.box(.06, .3, 1.2, 0, .72, .7, c2);
    for (const s of [-1, 1]) { g.cyl(.26, .26, 1.3, 8, s * .55, .5, -.3, c2, { rx: PI / 2 }); g.cyl(.2, .2, .1, 8, s * .55, .5, -1.0, DARK, { rx: PI / 2 }); g.cyl(.2, .2, .95, 8, s * 1.1, -.38, .15, DARK, { rx: PI / 2 }); g.cyl(.16, .16, .04, 8, s * 1.1, -.38, .64, 0x8a4f2c, { rx: PI / 2 }); g.box(.12, .12, .8, s * .7, -.33, .1, 0x8a8f96); g.cyl(.14, .14, .1, 8, s * .55, -.78, .75, TIRE, { rz: PI / 2 }); g.box(.05, .4, .05, s * .5, -.58, .75, DARK); }
    g.cyl(.12, .15, .5, 6, 0, .78, 0, DARK); g.cyl(.14, .34, 3.0, 6, 0, .2, -3.0, c, { rx: -PI / 2 });
    g.box(.08, 1.1, .75, 0, .75, -4.35, 0, { acc: .95, rx: .25 }); g.box(1.3, .07, .4, 0, .25, -4.1, c2);
    g.box(.04, 1.0, .1, .12, .85, -4.45, BLACK, { rx: PI / 4 }); g.box(.04, 1.0, .1, .12, .85, -4.45, BLACK, { rx: -PI / 4 });
    g.box(2.5, .09, .65, 0, -.15, .05, c2); g.box(2.3, .02, .5, 0, -.095, .05, 0, { acc: .95 });
    g.box(.2, .18, .22, 0, -.56, 1.25, DARK); rod(g, .04, 6, 0, -.6, 1.3, 0, -.6, 1.9, BLACK);
    const r = new GB(); for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; r.box(.24, .04, 3.3, Math.sin(a) * 1.65, 0, Math.cos(a) * 1.65, BLACK, { ry: a }); } r.cyl(.2, .2, .25, 6, 0, 0, 0, STEEL);
    MDL.heli = [part(g), part(r, 'rotor', 0, 1.06, 0, 30)];
  }
  { // Gunship: heavy armoured flyer with stepped bubble canopies, big wings and four rocket pods
    const g = new GB(), c = 0x46523c, c2 = shade(c, .78);
    g.sph(1.05, 1.0, 2.7, 0, 0, -.2, c); g.box(1.7, 1.2, 2.0, 0, .05, -.5, c); g.sph(.5, .45, .7, 0, .02, 2.2, GLASS); g.sph(.55, .5, .8, 0, .62, 1.25, GLASS);
    g.box(1.5, .7, 2.4, 0, 1.05, -.6, c2); g.cyl(.18, .2, .45, 6, 0, 1.55, -.3, DARK); g.cyl(.18, .45, 4.0, 6, 0, .45, -4.5, c, { rx: -PI / 2 });
    g.box(.12, 1.6, 1.0, 0, 1.25, -6.3, 0, { acc: .95, rx: .3 }); g.box(1.8, .1, .6, 0, .5, -5.9, c2); g.box(.05, 1.4, .14, -.15, 1.35, -6.5, BLACK, { rx: PI / 4 }); g.box(.05, 1.4, .14, -.15, 1.35, -6.5, BLACK, { rx: -PI / 4 });
    for (const s of [-1, 1]) {
      g.cyl(.3, .3, .15, 8, s * .45, 1.05, .62, DARK, { rx: PI / 2 }); g.cyl(.24, .24, .4, 8, s * .55, 1.0, -1.9, DARK, { rx: PI / 2 + .3 });
      g.box(1.8, .12, 1.0, s * 1.65, -.15, -.3, c2, { rz: s * .18 }); g.box(1.6, .03, .8, s * 1.62, -.06, -.3, 0, { acc: .95, rz: s * .18 });
      g.cyl(.24, .24, 1.1, 8, s * 1.4, -.5, -.15, DARK, { rx: PI / 2 }); g.cyl(.24, .24, 1.1, 8, s * 2.15, -.64, -.15, DARK, { rx: PI / 2 }); g.box(.14, .14, 1.0, s * 2.55, -.42, -.3, 0x8a8f96);
      g.cyl(.18, .18, .14, 8, s * .8, -1.05, .6, TIRE, { rz: PI / 2 }); g.box(.06, .5, .06, s * .75, -.8, .6, DARK);
    }
    g.sph(.28, .28, .28, 0, -.48, 2.45, DARK); for (const s of [-1, 1]) rod(g, .06, 6, s * .08, -.52, 2.6, s * .08, -.52, 3.4, BLACK);
    const r = new GB(); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; r.box(.32, .05, 4.4, Math.sin(a) * 2.2, 0, Math.cos(a) * 2.2, BLACK, { ry: a }); } r.cyl(.3, .3, .3, 6, 0, 0, 0, STEEL);
    MDL.gunship = [part(g), part(r, 'rotor', 0, 1.8, -.3, 26)];
  }
  { // Sky Hunter: delta-wing jet fighter with twin tails and wing missiles
    const g = new GB(), c = 0xaab2ba, c2 = 0x8e969e;
    g.cyl(.4, .48, 3.6, 8, 0, 0, -.7, c, { rx: PI / 2 }); g.cone(.4, 1.9, 8, 0, 0, 2.05, c, { rx: PI / 2 }); g.sph(.27, .24, .75, 0, .33, 1.2, GLASS);
    fcyl(g, 3, 1, 2.4, .08, 2.1, 0, -.05, -.9, c); fcyl(g, 3, 1, 1.95, .02, 1.7, 0, .0, -1.1, 0, { acc: .95 });
    for (const s of [-1, 1]) {
      g.box(.4, .5, 1.6, s * .55, -.05, .2, c2); g.box(.34, .42, .04, s * .55, -.05, 1.01, DARK);
      g.box(.08, 1.0, 1.0, s * .62, .55, -2.0, 0, { acc: .95, rz: -s * .35 }); g.box(.9, .06, .6, s * .85, 0, -2.3, c2);
      rod(g, .07, 6, s * 1.25, -.15, -.9, s * 1.25, -.15, .3, WHITE); g.cone(.07, .18, 6, s * 1.25, -.15, .39, WHITE, { rx: PI / 2 });
    }
    g.cyl(.36, .42, .45, 8, 0, 0, -2.7, DARK, { rx: -PI / 2 });
    const r = new GB(); g.cyl(.3, .3, .05, 8, 0, 0, -2.93, 0xffa040, { rx: PI / 2 }); ball(r, .22, .22, .22, 0, 0, 0, 0xffc060);
    MDL.interceptor = [part(g), part(r, 'rotor', 0, 0, -3.0, 25)];
  }
  // jet for call-ins / crates
  { const g = new GB(); g.cone(.6, 5, 8, 0, 0, 1, 0x8e969e, { rx: PI / 2 }); g.cyl(.65, .65, 3.5, 8, 0, 0, -2.2, 0x7e868e, { rx: PI / 2 }); g.box(7, .12, 2.5, 0, 0, -1.5, 0x7e868e); g.box(.12, 1.2, 1.4, 0, .7, -3.6, 0x8e969e); g.box(2.6, .1, 1, 0, 0, -3.8, 0x7e868e); MDL.jet = [part(g)]; }
  { const g = new GB(); g.box(1.6, 1.2, 1.6, 0, .6, 0, 0, { acc: .9 }); g.box(1.7, .2, 1.7, 0, .7, 0, DARK); g.cone(2.0, 1.2, 8, 0, 2.6, 0, WHITE, { rx: PI }); MDL.crate = [part(g)]; }
  { const g = new GB(); g.box(1.6, 1.2, 1.6, 0, .6, 0, 0, { acc: .9 }); g.box(1.7, .2, 1.7, 0, .7, 0, DARK); g.box(.12, 3.2, .12, .7, 1.6, .7, DARK); g.box(1, .6, .06, 1.2, 2.85, .7, 0, { acc: .9 }); MDL.cratel = [part(g)]; }   // a landed field-event crate, with a little flag
  { const g = new GB(); g.box(1.4, .5, 1.4, 0, .25, 0, 0x2a2420); g.box(1.0, .5, 1.0, .2, .6, .1, 0x1c1814); MDL.wreck = [part(g)]; }
  { const g = new GB(); g.cyl(.7, .7, .6, 6, 0, .3, 0, 0xffc94a); g.cone(.8, 1.2, 4, 0, 1.0, 0, 0xffffff, { rx: PI }); MDL.beacon = [part(g)]; }
  { const g = new GB(); g.cyl(.1, .1, 9, 6, 0, 4.5, 0, 0xcfd3d8); g.box(2.8, 1.5, .08, 1.5, 7.9, 0, 0, { acc: 1 }); g.cyl(.3, .3, .3, 6, 0, 9.1, 0, 0xffc94a); g.box(1.8, .4, 1.8, 0, .2, 0, 0x5e5b55); MDL.flag = [part(g)]; }
  { const g = new GB(); g.box(1.0, .8, 2.1, 0, .4, 0, CONC); g.box(1.06, .16, 2.16, 0, .86, 0, 0, { acc: 1 }); g.box(.5, .5, .25, 0, .3, 1.05, CONC2); g.box(.5, .5, .25, 0, .3, -1.05, CONC2); MDL.wallseg = [part(g)]; }
  buildLegionModels(); buildNavalModels(); buildBModels(); buildDecor();
}
