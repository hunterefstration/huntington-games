// 2D overlay on top of the globe: country names, city names, markers for tiny states. Redrawn only when the view changes.
const Overlay = {
  cv: null, ctx: null, pr: 1, small: [], rects: [], citiesByPop: null,
  init(cv) { this.cv = cv; this.ctx = cv.getContext('2d'); },
  resize() {
    this.pr = Math.min(devicePixelRatio || 1, 1.5);
    this.cv.width = innerWidth * this.pr; this.cv.height = innerHeight * this.pr;
  },
  free(x, y, w, h) {
    for (const r of this.rects) if (x < r[0] + r[2] && x + w > r[0] && y < r[1] + r[3] && y + h > r[1]) return false;
    this.rects.push([x, y, w, h]); return true;
  },
  text(t, x, y, size, color, weight = 600, spacing = 0) {
    const c = this.ctx;
    c.font = weight + ' ' + size + 'px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
    if (spacing) c.letterSpacing = spacing + 'px'; else c.letterSpacing = '0px';
    const w = c.measureText(t).width;
    if (!this.free(x - w / 2 - 2, y - size / 2 - 1, w + 4, size + 2)) return false;
    c.lineJoin = 'round'; c.lineWidth = Math.max(2.5, size / 5); c.strokeStyle = 'rgba(8,12,20,.75)'; c.strokeText(t, x, y);
    c.fillStyle = color; c.fillText(t, x, y);
    return true;
  },
  draw() {
    const c = this.ctx, pr = this.pr;
    c.setTransform(pr, 0, 0, pr, 0, 0); c.clearRect(0, 0, innerWidth, innerHeight);
    this.rects = []; this.small = [];
    if (!Overlay.visible) return;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const dpp = degPerPixel(), alt = Cam.alt, density = { low: 0.6, normal: 1, high: 1.5 }[Settings.labels] || 1;
    const sel = UI.selected, home = UI.home, s = {};
    // reserve space for the selected country's name first
    const order = World.labelOrder;
    // tiny states: a ring marker so they can be found and clicked
    for (const ct of order) {
      if (!(ct.area < 2600 || !ct.onMap)) continue;
      const p = llToScreen(ct.label.lon, ct.label.lat, 1.0005, s);
      if (!p.front || p.x < -20 || p.y < -20 || p.x > innerWidth + 20 || p.y > innerHeight + 20) continue;
      if (alt > 1.6 && ct.idx !== sel) continue;
      const r = alt < 0.05 ? 0 : 4.5;
      if (r) {
        c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2);
        c.fillStyle = ct.idx === sel ? '#ffd98a' : 'rgba(255,255,255,.18)'; c.fill();
        c.lineWidth = 1.5; c.strokeStyle = ct.idx === sel ? '#ffd98a' : 'rgba(255,240,210,.85)'; c.stroke();
      }
      this.small.push({ x: p.x, y: p.y, idx: ct.idx });
    }
    // country names
    for (const ct of order) {
      const L = ct.label, p = llToScreen(L.lon, L.lat, 1.001, s);
      if (!p.front) continue;
      const rpx = L.size / dpp; // room inside the country, in pixels
      const tiny = ct.area < 2600 || !ct.onMap, focus = ct.idx === sel || ct.idx === UI.hover;
      if (!focus && (rpx < 16 / density || (tiny && alt > 0.25))) continue;
      if (rpx > 900 && !focus) continue; // zoomed right in: city names take over
      let size = clamp(rpx * 0.3, 10, 24), name = ct.name;
      if (size >= 15) name = name.toUpperCase();
      const col = ct.idx === sel ? '#ffe2a0' : ct.idx === home ? '#fff4d8' : 'rgba(240,244,250,.92)';
      this.text(name, p.x, tiny ? p.y - 12 : p.y, Math.round(size), col, size >= 15 ? 700 : 600, size >= 15 ? 1.5 : 0);
    }
    // cities when close enough
    if (alt < 0.42) {
      const tgt = ll2v(Cam.lon, Cam.lat), lim = Math.cos(Math.min(80, alt * 60 + 4) * DEG);
      const maxRank = alt < 0.03 ? 30 : alt < 0.08 ? 14 : alt < 0.16 ? 6 : alt < 0.28 ? 2 : 1;
      const v = new THREE.Vector3();
      for (const ci of this.citiesByPop) {
        if (ci.rank >= maxRank * density && !ci.cap) continue;
        if (ll2v(ci.lon, ci.lat, 1, v).dot(tgt) < lim) continue;
        const p = llToScreen(ci.lon, ci.lat, 1.0005, s);
        if (!p.front || p.x < 0 || p.y < 0 || p.x > innerWidth || p.y > innerHeight) continue;
        const size = ci.cap ? 13 : ci.pop > 2e6 ? 12 : 11;
        if (this.text(ci.name, p.x, p.y - 11, size, ci.cap ? '#ffe6b0' : 'rgba(235,240,248,.9)', ci.cap ? 700 : 500) && ci.cap) {
          star(c, p.x, p.y, 4.5, '#ffd98a');
        }
      }
    }
  },
  hitSmall(x, y) { for (const m of this.small) if (Math.hypot(m.x - x, m.y - y) < 11) return m.idx; return null; },
  visible: true
};
function star(c, x, y, r, col) {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); c.fillStyle = col; c.fill(); c.lineWidth = 1; c.strokeStyle = 'rgba(0,0,0,.6)'; c.stroke();
}
function prepareLabels() {
  World.labelOrder = World.countries.filter(Boolean).sort((a, b) => (b.label.area || 0) - (a.label.area || 0));
  const per = {};
  Overlay.citiesByPop = World.cities.slice().sort((a, b) => (b.cap - a.cap) || (b.pop - a.pop));
  for (const ci of Overlay.citiesByPop) { per[ci.c] = per[ci.c] || 0; ci.rank = ci.cap ? 0 : per[ci.c]++; }
}
