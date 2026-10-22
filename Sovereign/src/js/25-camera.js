// Camera: looks at a point on the globe (lon, lat) from a height (alt, in Earth radii; 1 = 6371 km).
// Drag to move, wheel/pinch to zoom toward the cursor, the view tilts toward the horizon as you get close.
const Cam = {
  lon: 10, lat: 25, alt: 2.4, heading: 0,
  vlon: 0, vlat: 0,                // drag inertia (degrees per second)
  fly: null,                       // { from, to, t, dur }
  spin: 0,                         // idle spin speed for the title screen (degrees per second)
  MIN: 0.0009, MAX: 3.6,
  tilt() { return 62 * DEG * smooth(0.5, 0.004, this.alt); },
  frame: null
};

function updateCamera() {
  const c = Globe.camera, tgt = ll2v(Cam.lon, Cam.lat, 1), up = tgt.clone().normalize();
  // local frame at the target: north and east along the surface
  let north = new THREE.Vector3(0, 1, 0).addScaledVector(up, -up.y);
  if (north.lengthSq() < 1e-8) north.set(0, 0, -1);
  north.normalize();
  const tilt = Cam.tilt();
  c.position.copy(tgt).addScaledVector(up, Cam.alt * Math.cos(tilt)).addScaledVector(north, -Cam.alt * Math.sin(tilt));
  c.up.copy(north).multiplyScalar(Math.cos(tilt)).addScaledVector(up, Math.sin(tilt));
  c.lookAt(Cam.alt > 1.2 ? new THREE.Vector3(0, 0, 0).lerp(tgt, smooth(3.6, 1.2, Cam.alt)) : tgt);
  c.near = Math.max(Cam.alt * 0.04, 0.00002);
  c.far = Cam.alt + 2.2;
  c.updateProjectionMatrix(); c.updateMatrixWorld();
  applyLOD();
  Globe.dirty = true;
}

// lon/lat under a screen point (null if it misses the globe)
const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2(), _sph = new THREE.Sphere(new THREE.Vector3(), 1);
function screenToLL(x, y) {
  _ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
  _ray.setFromCamera(_ndc, Globe.camera);
  const hit = _ray.ray.intersectSphere(_sph, new THREE.Vector3());
  return hit ? v2ll(hit) : null;
}
function llToScreen(lon, lat, r = 1, out = {}) {
  const v = ll2v(lon, lat, r), cd = Globe.camera.position;
  out.front = v.dot(cd) / cd.length() > (1 / cd.length()) + 0.0001; // visible side of the globe (not behind the horizon)
  v.project(Globe.camera);
  out.x = (v.x + 1) / 2 * innerWidth; out.y = (1 - v.y) / 2 * innerHeight; out.z = v.z;
  return out;
}

function degPerPixel() { return (Cam.alt * Math.tan(20 * DEG) * 2 / innerHeight) / DEG; }

function camZoom(factor, sx, sy) {
  const before = sx != null ? screenToLL(sx, sy) : null;
  Cam.alt = clamp(Cam.alt * factor, Cam.MIN, Cam.MAX);
  updateCamera();
  if (before) { // keep the point under the cursor in place
    const after = screenToLL(sx, sy);
    if (after) { Cam.lon = wrapLon(Cam.lon + (before.lon - after.lon)); Cam.lat = clamp(Cam.lat + (before.lat - after.lat), -85, 85); updateCamera(); }
  }
}
const wrapLon = l => ((l + 540) % 360) - 180;

function flyTo(lon, lat, alt, dur = 1.6) {
  const from = { lon: Cam.lon, lat: Cam.lat, alt: Cam.alt };
  let dl = wrapLon(lon - from.lon);
  Cam.fly = { from, to: { lon: from.lon + dl, lat, alt: alt == null ? Cam.alt : alt }, t: 0, dur };
  Cam.vlon = Cam.vlat = 0;
}
function flyToCountry(c, dur) {
  const size = Math.sqrt(c.area || 1000) / 111; // rough width in degrees
  flyTo(c.label.lon, c.label.lat, clamp(size * 0.045 + 0.05, 0.06, 2.0), dur);
}

function stepCamera(dt) {
  let moved = false;
  if (Cam.fly) {
    const f = Cam.fly; f.t = Math.min(1, f.t + dt / f.dur);
    const e = f.t < 0.5 ? 4 * f.t ** 3 : 1 - (-2 * f.t + 2) ** 3 / 2;
    // arc out a little on long flights so the whole trip is visible
    const dist = Math.hypot(f.to.lon - f.from.lon, f.to.lat - f.from.lat);
    const peak = Math.max(f.from.alt, f.to.alt, Math.min(2.2, dist / 60));
    Cam.lon = wrapLon(lerp(f.from.lon, f.to.lon, e)); Cam.lat = lerp(f.from.lat, f.to.lat, e);
    const la = Math.log(f.from.alt), lb = Math.log(f.to.alt), lp = Math.log(peak);
    Cam.alt = Math.exp(lerp(lerp(la, lp, e), lerp(lp, lb, e), e));
    if (f.t >= 1) Cam.fly = null;
    moved = true;
  } else if (Math.abs(Cam.vlon) + Math.abs(Cam.vlat) > 0.001) {
    Cam.lon = wrapLon(Cam.lon + Cam.vlon * dt); Cam.lat = clamp(Cam.lat + Cam.vlat * dt, -85, 85);
    const k = Math.pow(0.02, dt); Cam.vlon *= k; Cam.vlat *= k;
    moved = true;
  } else if (Cam.spin) { Cam.lon = wrapLon(Cam.lon + Cam.spin * dt); moved = true; }
  // keyboard
  const K = Input.keys, kp = degPerPixel() * 500 * dt;
  if (K.ArrowLeft || K.a) { Cam.lon = wrapLon(Cam.lon - kp / Math.max(0.2, Math.cos(Cam.lat * DEG))); moved = true; }
  if (K.ArrowRight || K.d) { Cam.lon = wrapLon(Cam.lon + kp / Math.max(0.2, Math.cos(Cam.lat * DEG))); moved = true; }
  if (K.ArrowUp || K.w) { Cam.lat = clamp(Cam.lat + kp, -85, 85); moved = true; }
  if (K.ArrowDown || K.s) { Cam.lat = clamp(Cam.lat - kp, -85, 85); moved = true; }
  if (K['+'] || K['='] || K.e) { camZoom(Math.pow(0.25, dt)); moved = true; }
  if (K['-'] || K._ || K.q) { camZoom(Math.pow(4, dt)); moved = true; }
  if (moved) { Cam.alt = clamp(Cam.alt, Cam.MIN, Cam.MAX); updateCamera(); }
  return moved;
}

// --- Input: mouse, touch, keyboard ---
const Input = {
  keys: {}, down: null, pinch: null, moved: 0, lastMove: 0, hoverX: -1, hoverY: -1, enabled: true,
  init(el) {
    const pts = new Map();
    el.addEventListener('pointerdown', e => {
      el.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      Cam.fly = null; Cam.vlon = Cam.vlat = 0; Cam.spin = 0;
      if (pts.size === 1) this.down = { x: e.clientX, y: e.clientY, t: performance.now() }, this.moved = 0;
      if (pts.size === 2) { const [a, b] = [...pts.values()]; this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; this.moved = 99; }
    });
    el.addEventListener('pointermove', e => {
      this.hoverX = e.clientX; this.hoverY = e.clientY;
      const p = pts.get(e.pointerId);
      if (!p) { Bus.emit('hover', e.clientX, e.clientY); return; }
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 2 && this.pinch) {
        const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        camZoom(this.pinch.d / Math.max(d, 1), (a.x + b.x) / 2, (a.y + b.y) / 2); this.pinch.d = d; return;
      }
      if (!this.down) return;
      this.moved += Math.abs(dx) + Math.abs(dy);
      const dp = degPerPixel(), now = performance.now(), dtm = Math.max(8, now - this.lastMove) / 1000; this.lastMove = now;
      const cl = Math.max(0.15, Math.cos(Cam.lat * DEG));
      const tiltK = 1 / Math.max(0.35, Math.cos(Cam.tilt()));
      Cam.lon = wrapLon(Cam.lon - dx * dp / cl); Cam.lat = clamp(Cam.lat + dy * dp * tiltK, -85, 85);
      Cam.vlon = lerp(Cam.vlon, -dx * dp / cl / dtm, 0.5); Cam.vlat = lerp(Cam.vlat, dy * dp * tiltK / dtm, 0.5);
      updateCamera();
    });
    const up = e => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size < 2) this.pinch = null;
      if (pts.size === 0) {
        if (this.down && this.moved < 6) { Cam.vlon = Cam.vlat = 0; Bus.emit('click', e.clientX, e.clientY); }
        if (performance.now() - this.lastMove > 80) Cam.vlon = Cam.vlat = 0;
        this.down = null;
      }
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => { e.preventDefault(); Cam.fly = null; Cam.spin = 0; camZoom(Math.pow(1.0018, e.deltaY * (e.deltaMode ? 30 : 1)), e.clientX, e.clientY); }, { passive: false });
    el.addEventListener('dblclick', e => { const ll = screenToLL(e.clientX, e.clientY); if (ll) flyTo(ll.lon, ll.lat, Cam.alt * 0.35, 0.8); });
    addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys[k] = true; Bus.emit('key', k, e);
    });
    addEventListener('keyup', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; this.keys[k] = false; });
    addEventListener('blur', () => { this.keys = {}; });
  }
};
