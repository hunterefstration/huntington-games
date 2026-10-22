// The living map: buildings, roads, people, cars, ships, planes, crowds, armies and effects.
// Everything here is decoration driven by the simulation: it never changes the numbers, it shows them.
// Speed rules: one InstancedMesh per kind (one draw call each), detail only near the camera, hard caps per quality level.
const KM = 1 / 6371; // one kilometre in globe units
function enu(lon, lat) { // local east / north / up directions at a point
  const lo = lon * DEG, la = lat * DEG;
  return { e: new THREE.Vector3(Math.cos(lo), 0, -Math.sin(lo)), n: new THREE.Vector3(-Math.sin(la) * Math.sin(lo), Math.cos(la), -Math.sin(la) * Math.cos(lo)), u: ll2v(lon, lat, 1) };
}
const LIMITS = { low: { bld: 900, ppl: 0, car: 0, ship: 40, plane: 20 }, medium: { bld: 2600, ppl: 500, car: 250, ship: 90, plane: 50 }, high: { bld: 5000, ppl: 1100, car: 500, ship: 140, plane: 80 } };

// Real shipping lanes (longitudes run past 180 where a lane crosses the Pacific)
const SEA_LANES = [
  [[122.5, 30.5], [119.5, 24], [114, 15], [109, 8], [104, 1.3], [98.5, 4.5], [95, 6], [81, 5.5], [65, 13], [50, 12.5], [43.4, 12.6], [38, 20], [34, 27.5], [32.5, 30], [30, 32.5], [20, 34], [11, 37.5], [5, 37.5], [-5.6, 36], [-10, 38], [-10, 44], [-6, 48.5], [0, 50.2], [4, 52]],
  [[122.5, 30.5], [130, 32], [140, 34], [160, 40], [180, 45], [200, 45], [220, 40], [241.7, 33.7]],
  [[-73.8, 40.4], [-60, 42], [-40, 46], [-20, 48], [-6, 48.5], [0, 50.2], [4, 52]],
  [[-73.8, 40.4], [-75, 30], [-74, 20], [-77, 15], [-79.5, 9.4], [-79.5, 8], [-85, 5], [-100, 12], [-118.3, 33.7]],
  [[50.5, 26.6], [56.5, 26.4], [58.5, 23], [65, 18], [75, 8], [81, 5.5], [95, 6], [98.5, 4.5], [104, 1.3], [109, 8], [114, 15], [120, 22], [130, 28], [139.8, 35]],
  [[-10, 44], [-18, 28], [-20, 10], [-5, -5], [5, -10], [12, -25], [18, -35], [30, -36], [50, -28], [60, -15], [75, -5], [81, 5.5]],
  [[-46, -24.5], [-30, -25], [0, -35], [18, -35]],
  [[151.5, -34], [155, -25], [154, -10], [150, 0], [135, 15], [125, 25], [122.5, 30.5]],
  [[-94.5, 29], [-88, 26], [-79.8, 25.5], [-79.5, 28], [-70, 35], [-40, 40], [-10, 38]],
  [[30.7, 46.4], [31, 43], [29, 41.1], [26.5, 40.2], [25, 37], [20, 34]],
  [[4, 52], [7.5, 57.5], [10.5, 57.8], [11.5, 56.5], [12.7, 55.6], [15, 55], [19, 56], [22, 59.5], [29.5, 60]],
  [[72.5, 18.5], [60, 10], [50, 0], [40, -4.5], [41, -15], [36, -25], [31.5, -30]],
  [[3.4, 6.2], [0, 4], [-10, 5], [-17, 14], [-18, 28], [-10, 38]],
  [[140.5, 35], [155, 42], [180, 48], [210, 50], [235, 48], [237, 48.2]]
];

const Life = {
  ready: false, built: {}, activeKey: '', t: 0, crowds: [], effects: [], units: [], rails: [],
  init() {
    const s = Globe.scene;
    this.sunLight = new THREE.DirectionalLight(0xfff4e0, 2.2); this.amb = new THREE.HemisphereLight(0xdde8ff, 0x6b6250, 1.5);
    s.add(this.sunLight, this.amb);
    const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0, 0.5); // base at z = 0, grows along local up
    const mat = c => new THREE.MeshLambertMaterial({ color: c });
    const mk = (geo, m, max) => { const im = new THREE.InstancedMesh(geo, m, max); im.count = 0; im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); Globe.root.add(im); return im; };
    const L = LIMITS.high;
    this.bld = mk(box, mat(0xffffff), L.bld); this.bld.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(L.bld * 3), 3);
    this.ppl = mk(box, mat(0xffffff), L.ppl + 900); this.ppl.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array((L.ppl + 900) * 3), 3);
    this.car = mk(box, mat(0xffffff), L.car); this.car.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(L.car * 3), 3);
    const hull = new THREE.ConeGeometry(0.5, 1, 4); hull.rotateX(Math.PI / 2); hull.translate(0, 0, 0.2); hull.scale(0.35, 1, 0.3);
    const ship = new THREE.BoxGeometry(0.28, 1, 0.22); ship.translate(0, 0, 0.11);
    this.ship = mk(ship, mat(0xd8dde6), L.ship); this.ship.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(L.ship * 3), 3);
    const plane = new THREE.BufferGeometry(); // a flat arrow seen from above
    plane.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.6, 0, -0.5, -0.4, 0, 0, -0.15, 0, 0, 0.6, 0, 0, -0.15, 0, 0.5, -0.4, 0], 3)); plane.computeVertexNormals();
    this.plane = mk(plane, new THREE.MeshBasicMaterial({ color: 0xf4f6fb, side: THREE.DoubleSide }), L.plane);
    this.unit = mk(box, mat(0xffffff), 1500); this.unit.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(1500 * 3), 3);
    const fx = new THREE.SphereGeometry(1, 10, 8);
    this.fx = mk(fx, new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.85, depthWrite: false }), 200);
    this.fx.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(200 * 3), 3);
    this.buildRoads(); this.buildShips(); this.buildPlanes();
    this.ready = true;
  },
  // roads: each city to its two nearest neighbours in the same country
  buildRoads() {
    const pts = [], v = new THREE.Vector3(), byC = {};
    World.cities.forEach(c => (byC[c.c] = byC[c.c] || []).push(c));
    for (const k in byC) {
      const list = byC[k];
      for (const a of list) {
        const near = list.filter(b => b !== a).map(b => [b, Math.hypot((b.lon - a.lon) * Math.cos(a.lat * DEG), b.lat - a.lat)]).sort((x, y) => x[1] - y[1]).slice(0, 2);
        for (const [b, d] of near) {
          if (d > 6 || a.name > b.name && near.length > 1) continue;
          const n = Math.max(2, Math.ceil(d / 0.4));
          for (let i = 0; i < n; i++) {
            const t0 = i / n, t1 = (i + 1) / n, wob = (t) => Math.sin(t * Math.PI) * 0.04 * d;
            ll2v(lerp(a.lon, b.lon, t0) + wob(t0), lerp(a.lat, b.lat, t0), 1, v); pts.push(v.x, v.y, v.z);
            ll2v(lerp(a.lon, b.lon, t1) + wob(t1), lerp(a.lat, b.lat, t1), 1, v); pts.push(v.x, v.y, v.z);
          }
        }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.roads = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x3a3226, transparent: true, opacity: 0, depthWrite: false }));
    this.roads.renderOrder = 2; Globe.root.add(this.roads);
    this.railGeo = new THREE.BufferGeometry();
    this.rail = new THREE.LineSegments(this.railGeo, new THREE.LineBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.9, depthWrite: false }));
    this.rail.renderOrder = 2; Globe.root.add(this.rail);
  },
  setRails(list) { // [[cityA, cityB], ...] high-speed lines the player built
    const pts = [], v = new THREE.Vector3();
    for (const [a, b] of list) { const n = 40; for (let i = 0; i < n; i++) { ll2v(lerp(a.lon, b.lon, i / n), lerp(a.lat, b.lat, i / n), 1.00002, v); pts.push(v.x, v.y, v.z); ll2v(lerp(a.lon, b.lon, (i + 1) / n), lerp(a.lat, b.lat, (i + 1) / n), 1.00002, v); pts.push(v.x, v.y, v.z); } }
    this.railGeo.dispose(); this.railGeo = new THREE.BufferGeometry(); this.railGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); this.rail.geometry = this.railGeo;
    this.rails = list; Globe.dirty = true;
  },
  buildShips() {
    const r = makeRng(11), lanes = SEA_LANES.map(l => { const seg = []; let len = 0; for (let i = 1; i < l.length; i++) { const d = Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]); seg.push(d); len += d; } return { l, seg, len }; });
    this.ships = [];
    for (let i = 0; i < LIMITS.high.ship; i++) {
      const lane = lanes[i % lanes.length];
      this.ships.push({ lane, s: r() * lane.len, v: (0.6 + r() * 0.5) * (r() < 0.5 ? 1 : -1), side: (r() - 0.5) * 0.8, color: [[0.85, 0.3, 0.25], [0.2, 0.45, 0.8], [0.9, 0.9, 0.92], [0.95, 0.7, 0.2], [0.3, 0.65, 0.45]][Math.floor(r() * 5)] });
    }
  },
  buildPlanes() {
    const big = World.cities.slice().sort((a, b) => b.pop - a.pop).slice(0, 60), r = makeRng(5);
    this.planes = [];
    for (let i = 0; i < LIMITS.high.plane; i++) {
      let a, b, tries = 0;
      do { a = big[Math.floor(r() * big.length)]; b = big[Math.floor(r() * big.length)]; } while ((a === b || Math.abs(a.lon - b.lon) + Math.abs(a.lat - b.lat) < 15) && ++tries < 20);
      const A = ll2v(a.lon, a.lat), B = ll2v(b.lon, b.lat), ang = A.angleTo(B);
      this.planes.push({ A, B, ang, t: r(), v: 0.012 / Math.max(ang, 0.2) });
    }
  },
  // which cities get buildings: the closest big ones around the camera target
  activeCities() {
    const tgt = ll2v(Cam.lon, Cam.lat), lim = Math.cos(clamp(Cam.alt * 1.6, 0.004, 0.12)), out = [], v = new THREE.Vector3();
    for (const c of World.cities) if (ll2v(c.lon, c.lat, 1, v).dot(tgt) > lim) out.push(c);
    return out.sort((a, b) => b.pop - a.pop).slice(0, 24);
  },
  cityBuildings(c) {
    if (this.built[c.name + c.c]) return this.built[c.name + c.c];
    const r = makeRng(hashStr(c.name + c.c)), F = enu(c.lon, c.lat), rad = clamp(Math.sqrt(c.pop) / 170, 1.4, 24), n = Math.round(clamp(Math.pow(c.pop, 0.4) / 3.6, 10, 190));
    const list = [], dev = G ? G.nations[c.c].dev : World.nat0[c.c].dev;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = Math.pow(r(), 0.75) * rad, cx = Math.cos(a) * d, cy = Math.sin(a) * d;
      const blon = c.lon + cx / (111.32 * Math.cos(c.lat * DEG)), blat = c.lat + cy / 110.57;
      if (World.maps['50m'] && !pickLL(blon, blat, '50m')) continue; // no buildings in the sea or rivers
      const core = 1 - d / rad, h = (0.08 + core * core * (0.25 + dev * 1.1) * (0.4 + r())) * (c.cap ? 1.15 : 1);
      const w = 0.25 + r() * 0.35 + core * 0.2, tone = 0.7 + r() * 0.3;
      const col = r() < 0.25 ? [tone * 0.75, tone * 0.85, tone] : r() < 0.5 ? [tone, tone * 0.93, tone * 0.82] : [tone, tone, tone];
      list.push({ x: cx, y: cy, w, d: w * (0.7 + r() * 0.6), h, col, F });
    }
    // a park and a square in the middle, used by crowds
    return this.built[c.name + c.c] = { list, F, rad, c };
  },
  layoutBuildings() {
    const lim = LIMITS[Perf.level].bld, m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), basis = new THREE.Matrix4();
    let k = 0;
    if (Cam.alt < 0.07) for (const c of this.activeCities()) {
      const B = this.cityBuildings(c);
      basis.makeBasis(B.F.e, B.F.n, B.F.u); q.setFromRotationMatrix(basis);
      for (const b of B.list) {
        if (k >= lim) break;
        p.copy(B.F.u).addScaledVector(B.F.e, b.x * KM).addScaledVector(B.F.n, b.y * KM);
        s.set(b.w * KM, b.d * KM, b.h * KM); m.compose(p, q, s);
        this.bld.setMatrixAt(k, m); this.bld.instanceColor.setXYZ(k, ...b.col); k++;
      }
    }
    this.bld.count = k; this.bld.instanceMatrix.needsUpdate = true; this.bld.instanceColor.needsUpdate = true;
    this.cityNow = Cam.alt < 0.025 ? this.activeCities()[0] : null;
    this.spawnWalkers();
  },
  // people and cars in the nearest city, walking and driving on a street grid
  spawnWalkers() {
    const c = this.cityNow, L = LIMITS[Perf.level];
    this.walkers = []; this.cars = [];
    if (!c || !L.ppl) return;
    const B = this.cityBuildings(c), r = makeRng(hashStr(c.name) + 1), rad = B.rad * 0.8;
    const skins = FACE.skin.map(h => new THREE.Color(h)), shirts = ['#d94b4b', '#3b7dd8', '#f0c040', '#3fae6a', '#eeeeee', '#8a5cc8', '#e07b39'].map(h => new THREE.Color(h));
    for (let i = 0; i < L.ppl; i++) {
      const horiz = r() < 0.5, lane = Math.round((r() - 0.5) * rad * 2 / 0.6) * 0.6;
      this.walkers.push({ horiz, lane: lane + (r() - 0.5) * 0.08, pos: (r() - 0.5) * rad * 2, v: (r() < 0.5 ? -1 : 1) * (0.012 + r() * 0.01), col: shirts[Math.floor(r() * shirts.length)], skin: skins[Math.floor(r() * skins.length)], rad });
    }
    const carCols = ['#c0392b', '#2c3e50', '#ecf0f1', '#f1c40f', '#7f8c8d', '#2980b9'].map(h => new THREE.Color(h));
    for (let i = 0; i < L.car; i++) {
      const horiz = r() < 0.5, lane = Math.round((r() - 0.5) * rad * 2 / 1.2) * 1.2;
      this.cars.push({ horiz, lane: lane + (r() < 0.5 ? 0.05 : -0.05), pos: (r() - 0.5) * rad * 2, v: (r() < 0.5 ? -1 : 1) * (0.06 + r() * 0.05), col: carCols[Math.floor(r() * carCols.length)], rad });
    }
  },
  update(dt, t) {
    if (!this.ready) return false;
    const L = LIMITS[Perf.level], alt = Cam.alt;
    const key = Perf.level + ':' + (alt < 0.07 ? this.activeCities().map(c => c.name).join(',') : '') + ':' + (alt < 0.025);
    if (key !== this.activeKey) { this.activeKey = key; this.layoutBuildings(); }
    this.sunLight.position.copy(Globe.uni.sunDir.value).multiplyScalar(10);
    this.roads.material.opacity = 0.55 * smooth(0.35, 0.08, alt); this.roads.visible = alt < 0.35;
    if (this.mark) this.mark.visible = alt < 0.12; this.rail.visible = alt < 0.5;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), basis = new THREE.Matrix4(), fw = new THREE.Vector3(), side = new THREE.Vector3();
    // ships: sized to stay visible from space, true-ish size up close
    const shipLen = clamp(alt * 0.012, 0.00009, 0.03);
    let k = 0;
    for (let i = 0; i < Math.min(L.ship, this.ships.length); i++) {
      const sh = this.ships[i], ln = sh.lane;
      sh.s = (sh.s + sh.v * dt * 0.35 + ln.len) % ln.len;
      let d = sh.s, j = 0; while (j < ln.seg.length - 1 && d > ln.seg[j]) { d -= ln.seg[j]; j++; }
      const a = ln.l[j], b = ln.l[j + 1], f = clamp(d / ln.seg[j], 0, 1), lon = lerp(a[0], b[0], f), lat = lerp(a[1], b[1], f);
      const F = enu(lon, lat); fw.copy(F.e).multiplyScalar(b[0] - a[0]).addScaledVector(F.n, b[1] - a[1]).normalize(); if (sh.v < 0) fw.negate();
      side.crossVectors(fw, F.u);
      p.copy(F.u).multiplyScalar(1.00001).addScaledVector(side, sh.side * 0.004);
      basis.makeBasis(side, fw, F.u); q.setFromRotationMatrix(basis); s.set(shipLen, shipLen, shipLen);
      m.compose(p, q, s); this.ship.setMatrixAt(k, m); this.ship.instanceColor.setXYZ(k, ...sh.color); k++;
    }
    this.ship.count = k; this.ship.instanceMatrix.needsUpdate = true; if (this.ship.instanceColor) this.ship.instanceColor.needsUpdate = true;
    // planes on great circles, a little above the ground
    const pl = clamp(alt * 0.014, 0.0002, 0.035); k = 0;
    for (let i = 0; i < Math.min(L.plane, this.planes.length); i++) {
      const P = this.planes[i]; P.t += P.v * dt; if (P.t > 1) P.t -= 1;
      const pos = P.A.clone().lerp(P.B, P.t).normalize(), nxt = P.A.clone().lerp(P.B, Math.min(1, P.t + 0.01)).normalize();
      fw.copy(nxt).sub(pos).normalize(); side.crossVectors(fw, pos).normalize();
      p.copy(pos).multiplyScalar(1 + 0.0016 + Math.sin(P.t * Math.PI) * clamp(alt * 0.01, 0.0005, 0.01));
      basis.makeBasis(side.negate(), fw, pos); q.setFromRotationMatrix(basis); s.set(pl, pl, pl);
      m.compose(p, q, s); this.plane.setMatrixAt(k++, m);
    }
    this.plane.count = k; this.plane.instanceMatrix.needsUpdate = true;
    this.updateWalkers(dt, m, q, p, s, basis);
    this.updateUnits(dt, t, m, q, p, s, basis);
    this.updateEffects(dt, m, p, s);
    return true;
  },
  updateWalkers(dt, m, q, p, s, basis) {
    const c = this.cityNow; let k = 0, kc = 0;
    if (c && this.walkers) {
      const B = this.cityBuildings(c); basis.makeBasis(B.F.e, B.F.n, B.F.u); q.setFromRotationMatrix(basis);
      for (const w of this.walkers) {
        w.pos += w.v * dt; if (Math.abs(w.pos) > w.rad) w.v = -w.v;
        const x = w.horiz ? w.pos : w.lane, y = w.horiz ? w.lane : w.pos;
        p.copy(B.F.u).addScaledVector(B.F.e, x * KM).addScaledVector(B.F.n, y * KM); s.set(0.035 * KM, 0.035 * KM, 0.09 * KM);
        m.compose(p, q, s); this.ppl.setMatrixAt(k, m); this.ppl.instanceColor.setXYZ(k, w.col.r, w.col.g, w.col.b); k++;
      }
      for (const w of this.cars) {
        w.pos += w.v * dt; if (Math.abs(w.pos) > w.rad) w.pos = -Math.sign(w.pos) * w.rad;
        const x = w.horiz ? w.pos : w.lane, y = w.horiz ? w.lane : w.pos;
        p.copy(B.F.u).addScaledVector(B.F.e, x * KM).addScaledVector(B.F.n, y * KM);
        s.set((w.horiz ? 0.11 : 0.05) * KM, (w.horiz ? 0.05 : 0.11) * KM, 0.04 * KM);
        m.compose(p, q, s); this.car.setMatrixAt(kc, m); this.car.instanceColor.setXYZ(kc, w.col.r, w.col.g, w.col.b); kc++;
      }
    }
    // crowds (protests in red, rallies in gold) gather in the square of a city
    for (const cr of this.crowds) {
      const B = this.cityBuildings(cr.city); if (Cam.alt > 0.06) continue;
      basis.makeBasis(B.F.e, B.F.n, B.F.u); q.setFromRotationMatrix(basis);
      const r = makeRng(cr.seed), n = Math.min(cr.size, 900 - (k - (this.walkers ? this.walkers.length : 0)));
      for (let i = 0; i < n && k < this.ppl.instanceMatrix.count; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (0.25 + cr.size / 900), jig = Math.sin(this.t * 6 + i) * 0.006;
        p.copy(B.F.u).addScaledVector(B.F.e, (Math.cos(a) * d + jig) * KM).addScaledVector(B.F.n, Math.sin(a) * d * KM);
        s.set(0.035 * KM, 0.035 * KM, (0.09 + (i % 7 === 0 ? 0.05 : 0)) * KM);
        m.compose(p, q, s); this.ppl.setMatrixAt(k, m);
        const col = i % 7 === 0 ? cr.sign : cr.shirt; this.ppl.instanceColor.setXYZ(k, col[0], col[1], col[2]); k++;
      }
    }
    this.ppl.count = k; this.car.count = kc;
    this.ppl.instanceMatrix.needsUpdate = this.car.instanceMatrix.needsUpdate = true;
    this.ppl.instanceColor.needsUpdate = this.car.instanceColor.needsUpdate = true;
  },
  // soldiers, tanks and markers along war fronts (filled by the war module)
  updateUnits(dt, t, m, q, p, s, basis) {
    let k = 0; const sz = clamp(Cam.alt * 0.006, 0.00004, 0.012);
    for (const u of this.units) {
      if (k >= 1500) break;
      const F = enu(u.lon, u.lat); basis.makeBasis(F.e, F.n, F.u); q.setFromRotationMatrix(basis);
      const bob = u.moving ? Math.sin(t * 8 + k) * 0.15 : 0;
      p.copy(F.u).multiplyScalar(1.00002);
      s.set(sz * u.w, sz * u.d, sz * (u.h + bob)); m.compose(p, q, s);
      this.unit.setMatrixAt(k, m); this.unit.instanceColor.setXYZ(k, u.col[0], u.col[1], u.col[2]); k++;
    }
    this.unit.count = k; this.unit.instanceMatrix.needsUpdate = true; this.unit.instanceColor.needsUpdate = true;
  },
  // explosions, missile trails, disaster markers: {lon, lat, t, life, size, col}
  flash(lon, lat, size = 1, col = [1, 0.7, 0.28], life = 1.2) { this.effects.push({ lon, lat, t: 0, life, size, col }); if (this.effects.length > 200) this.effects.shift(); },
  updateEffects(dt, m, p, s) {
    let k = 0; const q = new THREE.Quaternion();
    this.effects = this.effects.filter(e => (e.t += dt) < e.life);
    for (const e of this.effects) {
      const f = e.t / e.life, r = clamp(Cam.alt * 0.012, 0.0003, 0.02) * e.size * (0.4 + f);
      p.copy(ll2v(e.lon, e.lat, 1.0002)); s.set(r, r, r); m.compose(p, q, s);
      this.fx.setMatrixAt(k, m); this.fx.instanceColor.setXYZ(k, e.col[0] * (1 - f * 0.6), e.col[1] * (1 - f), e.col[2] * (1 - f)); k++;
    }
    this.fx.count = k; this.fx.instanceMatrix.needsUpdate = true; this.fx.instanceColor.needsUpdate = true;
  }
};

// Landmarks for the player's projects (cranes while building) and new railway lines
const LOOKS = { tower: [0.6, 0.6, 2.6, [0.95, 0.82, 0.45]], dome: [1.6, 1.6, 0.6, [0.9, 0.9, 0.95]], factory: [1.6, 1.0, 0.5, [0.6, 0.65, 0.75]], flat: [3, 2, 0.04, [0.25, 0.35, 0.7]],
  dam: [2.4, 0.4, 0.8, [0.75, 0.75, 0.72]], port: [2.5, 1.2, 0.25, [0.55, 0.45, 0.35]], rocket: [0.3, 0.3, 3.2, [0.97, 0.97, 1]], campus: [2, 1.4, 0.45, [0.75, 0.45, 0.35]],
  wall: [6, 0.15, 0.4, [0.6, 0.6, 0.6]], blocks: [2.2, 2.2, 0.9, [0.85, 0.75, 0.6]], rail: [0.8, 0.8, 0.3, [0.95, 0.82, 0.45]], road: [0.5, 0.5, 0.2, [0.4, 0.4, 0.4]] };
Object.assign(Life, {
  refreshProjects() {
    if (!this.ready) return;
    if (!this.mark) {
      const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0, 0.5);
      this.mark = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial({ color: 0xffffff }), 120); this.mark.count = 0; this.mark.frustumCulled = false;
      this.mark.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(360), 3); Globe.root.add(this.mark);
    }
    const list = G ? (G.nations[G.player.idx].projects || []) : [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), basis = new THREE.Matrix4(), rails = [];
    let k = 0;
    list.forEach((p, i) => {
      const P = PROJECTS.find(x => x.id === p.id), c = World.cities[p.city], F = enu(c.lon, c.lat), r = makeRng(i * 77 + p.city);
      const [w, d, h, col] = LOOKS[P.look] || LOOKS.tower, ang = r() * Math.PI * 2, dist = 1.5 + r() * 3;
      const pos = F.u.clone().addScaledVector(F.e, Math.cos(ang) * dist * KM).addScaledVector(F.n, Math.sin(ang) * dist * KM);
      basis.makeBasis(F.e, F.n, F.u); q.setFromRotationMatrix(basis);
      const grow = p.done ? 1 : 0.15 + 0.85 * p.progress;
      m.compose(pos, q, new THREE.Vector3(w * KM, d * KM, h * grow * KM)); this.mark.setMatrixAt(k, m);
      const cc = p.done ? col : [0.55, 0.55, 0.55]; this.mark.instanceColor.setXYZ(k++, ...cc);
      if (!p.done) { // a crane
        const cp = pos.clone().addScaledVector(F.e, w * 0.7 * KM);
        m.compose(cp, q, new THREE.Vector3(0.08 * KM, 0.08 * KM, (h * 1.3 + 0.3) * KM)); this.mark.setMatrixAt(k, m); this.mark.instanceColor.setXYZ(k++, 1, 0.8, 0.1);
      }
      if ((P.look === 'rail') && p.done) {
        const other = World.cities.filter(x => x.c === c.c && x !== c).sort((a, b) => b.pop - a.pop)[0];
        if (other) rails.push([c, P.id === 'metro' ? { lon: c.lon + 0.15, lat: c.lat + 0.1 } : other]);
      }
    });
    this.mark.count = k; this.mark.instanceMatrix.needsUpdate = true; this.mark.instanceColor.needsUpdate = true;
    this.setRails(rails);
  }
});
