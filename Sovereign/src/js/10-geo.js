// World geography: countries, cities, decoded borders (TopoJSON from Natural Earth), picking and globe meshes.
// Coordinates: lon/lat in degrees. Sphere radius 1, y = north pole, lon 0 faces +z.

const World = {
  countries: [null], // index 0 = unowned land (Antarctica, disputed); countries[i].idx === i
  byId: {},
  maps: {},          // '110m' | '50m' -> { arcs, feats, polys, grid }
  cities: []         // { name, lon, lat, pop, cap, c (country idx) }
};

function ll2v(lon, lat, r = 1, out = new THREE.Vector3()) {
  const cl = Math.cos(lat * DEG);
  return out.set(r * cl * Math.sin(lon * DEG), r * Math.sin(lat * DEG), r * cl * Math.cos(lon * DEG));
}
function v2ll(v) { const r = v.length(); return { lon: Math.atan2(v.x, v.z) / DEG, lat: Math.asin(clamp(v.y / r, -1, 1)) / DEG }; }

function initCountries(list, cityData) {
  list.forEach(c => { c.idx = World.countries.length; World.countries.push(c); World.byId[c.id] = c; });
  for (const c of list) for (const [name, lon, lat, pop, cap] of cityData[c.id] || [])
    World.cities.push({ name, lon, lat, pop, cap: !!cap, c: c.idx });
}

// --- TopoJSON decoding (arcs are delta-encoded and quantized) ---
function decodeTopo(topo) {
  const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
  const arcs = topo.arcs.map(a => {
    const out = new Float32Array(a.length * 2); let x = 0, y = 0;
    for (let i = 0; i < a.length; i++) { x += a[i][0]; y += a[i][1]; out[i * 2] = x * sx + tx; out[i * 2 + 1] = y * sy + ty; }
    return out;
  });
  const ring = ids => {
    const pts = [];
    ids.forEach((id, k) => {
      const rev = id < 0, a = arcs[rev ? ~id : id], n = a.length / 2;
      for (let j = k ? 1 : 0; j < n; j++) { const i = rev ? n - 1 - j : j; pts.push(a[i * 2], a[i * 2 + 1]); }
    });
    if (pts.length > 2 && pts[0] === pts[pts.length - 2] && pts[1] === pts[pts.length - 1]) pts.length -= 2; // drop the closing point
    // rings cut at the date line (Russia's far east, Fiji): make longitudes continuous so they can run past 180
    for (let i = 2, shift = 0; i < pts.length; i += 2) {
      const d = pts[i] + shift - pts[i - 2];
      if (Math.abs(d) > 180 && Math.abs(pts[i + 1]) < 85) shift -= Math.sign(d) * 360;
      pts[i] += shift;
    }
    return new Float32Array(pts);
  };
  const feats = [], polys = [];
  for (const g of topo.geoms) {
    const c = g.c ? World.byId[g.c].idx : 0;
    const parts = g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : [];
    const f = { c, name: g.n || '', territory: !!g.n, polys: [], arcIds: [] };
    for (const p of parts) {
      const rings = p.map(ring).filter(r => r.length >= 6);
      if (!rings.length) continue;
      const poly = { c, f, rings, bbox: ringBox(rings[0]), area: ringArea(rings[0]) };
      f.polys.push(poly); polys.push(poly);
      p.forEach(r => r.forEach(id => f.arcIds.push(id < 0 ? ~id : id)));
    }
    feats.push(f);
  }
  return { arcs, feats, polys, grid: buildGrid(polys) };
}
function ringBox(r) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = 0; i < r.length; i += 2) { const x = r[i], y = r[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
}
function ringArea(r) { // in square degrees, scaled by cos(lat) so it is roughly proportional to real area
  let s = 0;
  for (let i = 0, n = r.length / 2; i < n; i++) { const j = (i + 1) % n; s += (r[j * 2] - r[i * 2]) * (r[j * 2 + 1] + r[i * 2 + 1]) / 2 * Math.cos((r[i * 2 + 1]) * DEG); }
  return Math.abs(s);
}
function inRing(r, x, y) {
  let ins = false;
  for (let i = 0, n = r.length / 2, j = n - 1; i < n; j = i++) {
    const xi = r[i * 2], yi = r[i * 2 + 1], xj = r[j * 2], yj = r[j * 2 + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
function inPoly(p, x, y) {
  const b = p.bbox;
  if (b[2] > 180 && x < 0 && inPoly(p, x + 360, y)) return true;
  if (b[0] < -180 && x > 0 && inPoly(p, x - 360, y)) return true;
  if (x < b[0] || x > b[2] || y < b[1] || y > b[3] || !inRing(p.rings[0], x, y)) return false;
  for (let k = 1; k < p.rings.length; k++) if (inRing(p.rings[k], x, y)) return false;
  return true;
}
function buildGrid(polys) { // 2x2 degree buckets of polygons, for fast picking
  const g = new Array(180 * 90);
  for (const p of polys) {
    const b = p.bbox, x0 = Math.floor((b[0] + 180) / 2), x1 = Math.min(x0 + 179, Math.floor((b[2] + 180) / 2));
    const y0 = Math.max(0, Math.floor((b[1] + 90) / 2)), y1 = Math.min(89, Math.floor((b[3] + 90) / 2));
    for (let y = y0; y <= y1; y++) for (let xx = x0; xx <= x1; xx++) { const x = (xx + 180) % 180; (g[y * 180 + x] = g[y * 180 + x] || []).push(p); }
  }
  return g;
}
// Country (and the map feature) under a lon/lat; null over the sea
function pickLL(lon, lat, res) {
  const m = World.maps[res] || World.maps['50m'] || World.maps['110m'];
  const x = clamp(Math.floor((lon + 180) / 2), 0, 179), y = clamp(Math.floor((lat + 90) / 2), 0, 89);
  for (const p of m.grid[y * 180 + x] || []) if (inPoly(p, lon, lat)) return { c: p.c, feat: p.f };
  return null;
}

// --- Label anchors: a point well inside the biggest home polygon (rough "pole of inaccessibility") ---
function edgeDist(r, x, y) {
  let best = 1e9;
  for (let i = 0, n = r.length / 2, j = n - 1; i < n; j = i++) {
    const ax = r[j * 2], ay = r[j * 2 + 1], bx = r[i * 2], by = r[i * 2 + 1], dx = bx - ax, dy = by - ay;
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1), ex = ax + t * dx - x, ey = ay + t * dy - y;
    const d = ex * ex + ey * ey; if (d < best) best = d;
  }
  return Math.sqrt(best);
}
function computeLabels(m) {
  const best = {};
  for (const p of m.polys) {
    if (!p.c) continue;
    const own = !p.f.territory, cur = best[p.c];
    if (!cur || (own && !cur.own) || (own === cur.own && p.area > cur.p.area)) best[p.c] = { p, own };
  }
  for (const c of World.countries) {
    if (!c) continue;
    const b = best[c.idx];
    if (!b) { c.label = { lon: c.ll[1], lat: c.ll[0], size: 0.3 }; continue; }
    const p = b.p, [x0, y0, x1, y1] = p.bbox;
    let bx = (x0 + x1) / 2, by = (y0 + y1) / 2, bd = -1;
    const N = 14;
    for (let pass = 0, w = x1 - x0, h = y1 - y0, cx = bx, cy = by; pass < 3; pass++, w /= 4, h /= 4, cx = bx, cy = by) {
      for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
        const x = cx - w / 2 + w * i / N, y = cy - h / 2 + h * j / N;
        if (!inPoly(p, x, y)) continue;
        const d = edgeDist(p.rings[0], x, y) * Math.cos(y * DEG) ** 0.5;
        if (d > bd) { bd = d; bx = x; by = y; }
      }
    }
    c.label = { lon: bx, lat: by, size: Math.max(0.3, bd), area: p.area };
  }
}

// --- Globe meshes ---
// Land: triangulated in lon/lat, long edges split so triangles hug the sphere, one merged geometry with a
// country index per vertex (colours come from a lookup texture, so map modes never rebuild geometry).
function* buildLand(m, maxEdge) {
  const pos = [], cid = [], v = new THREE.Vector3();
  const push = (x, y, c) => { ll2v(x, y, 1, v); pos.push(v.x, v.y, v.z); cid.push(c); };
  const tri = (ax, ay, bx, by, cx, cy, c, d) => {
    const ab = Math.hypot(ax - bx, ay - by), bc = Math.hypot(bx - cx, by - cy), ca = Math.hypot(cx - ax, cy - ay);
    const mx = Math.max(ab, bc, ca);
    if (mx <= maxEdge || d > 10) { push(ax, ay, c); push(bx, by, c); push(cx, cy, c); return; }
    if (mx === ab) { const x = (ax + bx) / 2, y = (ay + by) / 2; tri(ax, ay, x, y, cx, cy, c, d + 1); tri(x, y, bx, by, cx, cy, c, d + 1); }
    else if (mx === bc) { const x = (bx + cx) / 2, y = (by + cy) / 2; tri(ax, ay, bx, by, x, y, c, d + 1); tri(ax, ay, x, y, cx, cy, c, d + 1); }
    else { const x = (cx + ax) / 2, y = (cy + ay) / 2; tri(ax, ay, bx, by, x, y, c, d + 1); tri(x, y, bx, by, cx, cy, c, d + 1); }
  };
  let k = 0;
  for (const p of m.polys) {
    const toV2 = r => { const a = []; for (let i = 0; i < r.length; i += 2) a.push(new THREE.Vector2(r[i], r[i + 1])); return a; };
    const outer = toV2(p.rings[0]), holes = p.rings.slice(1).map(toV2), all = outer.concat(...holes);
    let faces;
    try { faces = THREE.ShapeUtils.triangulateShape(outer, holes); } catch (e) { faces = []; }
    for (const f of faces) {
      let [a, b, c] = f.map(i => all[i]);
      if ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) < 0) [b, c] = [c, b]; // counter-clockwise seen from outside
      tri(a.x, a.y, b.x, b.y, c.x, c.y, p.c, 0);
    }
    if (++k % 40 === 0) yield k / m.polys.length;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('cid', new THREE.Float32BufferAttribute(cid, 1));
  g.computeBoundingSphere();
  return g;
}
// Borders between states and coastlines, from the shared arcs (each arc drawn once).
function buildLines(m, r, maxSeg) {
  const users = new Map();
  m.feats.forEach(f => f.arcIds.forEach(a => { const u = users.get(a) || []; u.push(f); users.set(a, u); }));
  const border = [], coast = [], terr = [], v = new THREE.Vector3();
  users.forEach((u, id) => {
    let out;
    if (u.length === 1) out = coast;
    else if (u[0].c !== u[1].c) out = border;
    else if (u[0].territory !== u[1].territory) out = terr; // e.g. Hong Kong inside China: faint line
    else return;
    const a = m.arcs[id];
    for (let i = 0; i + 3 < a.length; i += 2) {
      const x0 = a[i], y0 = a[i + 1], x1 = a[i + 2], y1 = a[i + 3];
      if (Math.abs(x1 - x0) > 180 || (Math.abs(x0) > 179.99 && Math.abs(x1) > 179.99)) continue; // the date-line cut is not a real border
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / maxSeg));
      for (let s = 0; s < n; s++) {
        ll2v(lerp(x0, x1, s / n), lerp(y0, y1, s / n), r, v); out.push(v.x, v.y, v.z);
        ll2v(lerp(x0, x1, (s + 1) / n), lerp(y0, y1, (s + 1) / n), r, v); out.push(v.x, v.y, v.z);
      }
    }
  });
  const geo = a => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); return g; };
  return { border: geo(border), coast: geo(coast), terr: geo(terr) };
}
// Outline of one country (selection highlight)
function buildOutline(m, idx, r) {
  const pts = [], v = new THREE.Vector3();
  for (const f of m.feats) if (f.c === idx) for (const p of f.polys) for (const ring of p.rings) {
    const n = ring.length / 2;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, x0 = ring[i * 2], y0 = ring[i * 2 + 1], x1 = ring[j * 2], y1 = ring[j * 2 + 1];
      if (Math.abs(x1 - x0) > 180 || (Math.abs(((x0 + 540) % 360) - 180) > 179.99 && Math.abs(((x1 + 540) % 360) - 180) > 179.99)) continue;
      const s = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 1));
      for (let k = 0; k < s; k++) {
        ll2v(lerp(x0, x1, k / s), lerp(y0, y1, k / s), r, v); pts.push(v.x, v.y, v.z);
        ll2v(lerp(x0, x1, (k + 1) / s), lerp(y0, y1, (k + 1) / s), r, v); pts.push(v.x, v.y, v.z);
      }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); return g;
}

// Political colours: muted palette, neighbours get different colours (greedy graph colouring).
const PALETTE = ['#c9a66b', '#8fb07a', '#c98a73', '#7f9fc4', '#b391b8', '#d1c07a', '#76b2a8', '#c4927f', '#9aa66a', '#a79bd0', '#d0a35f', '#86a3a0'];
function assignColors() {
  const order = World.countries.filter(Boolean).sort((a, b) => b.borders.length - a.borders.length);
  for (const c of order) {
    const used = new Set(c.borders.map(id => World.byId[id].colorIdx).filter(x => x != null));
    let k = 0; const start = (c.idx * 7) % PALETTE.length;
    while (k < PALETTE.length && used.has((start + k) % PALETTE.length)) k++;
    c.colorIdx = (start + k) % PALETTE.length;
    c.color = PALETTE[c.colorIdx];
  }
}
