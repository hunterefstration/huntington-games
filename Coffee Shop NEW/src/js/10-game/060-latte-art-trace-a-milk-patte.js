// ----- latte art: trace a milk pattern on a coffee to earn art cups (bonus tips). Also used in championships. -----
const ART_CAP_MAX = 12;
function artCap() { return 3 + U('steamer'); }
const PATTERNS = [
  { id: 'heart', n: 'Heart', mult: 1, tol: 0.085, rank: 0 },
  { id: 'tulip', n: 'Tulip', mult: 1.3, tol: 0.08, rank: 1 },
  { id: 'rosetta', n: 'Rosetta', mult: 1.6, tol: 0.075, rank: 2 },
  { id: 'swan', n: 'Swan', mult: 2, tol: 0.07, rank: 3 }
];
const PAT_BY_ID = {}; PATTERNS.forEach(p => { PAT_BY_ID[p.id] = p; });
// Pattern shapes: strokes of points in cup units (coffee surface radius = 1, y points down). Built once.
function arcPts(cx, cy, rx, ry, a0, a1, n) { const o = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return o; }
function bezPts(p0, p1, p2, p3, n) {
  const o = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; o.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); }
  return o;
}
function fitStrokes(st, size) {
  let x0 = 9, y0 = 9, x1 = -9, y1 = -9;
  st.forEach(s => s.forEach(p => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }));
  const k = size / Math.max(x1 - x0, y1 - y0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return st.map(s => s.map(p => [(p[0] - cx) * k, (p[1] - cy) * k]));
}
const PAT_GEO = {
  heart: fitStrokes([(() => { const o = []; for (let i = 0; i <= 72; i++) { const t = i / 72 * Math.PI * 2; o.push([16 * Math.pow(Math.sin(t), 3), -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]); } return o; })()], 1.15),
  tulip: fitStrokes([arcPts(0, 0.55, 0.5, 0.3, Math.PI, Math.PI * 2, 22), arcPts(0, 0.22, 0.4, 0.26, Math.PI, Math.PI * 2, 18), arcPts(0, -0.08, 0.29, 0.22, Math.PI, Math.PI * 2, 14), [[0, -0.42], [0, 0.72]]], 1.2),
  rosetta: fitStrokes([(() => { const o = []; for (let i = 0; i <= 10; i++) { const w = 0.56 - i * 0.042; o.push([i % 2 ? -w : w, 0.62 - i * 0.12]); } return o; })(), [[0, 0.72], [0, -0.66]]], 1.25),
  swan: fitStrokes([arcPts(-0.05, 0.18, 0.56, 0.36, Math.PI, 0, 22), (() => { const o = []; for (let i = 0; i <= 7; i++) o.push([-0.52 + i * 0.085, i % 2 ? 0.12 : -0.34 + i * 0.03]); return o; })(),
    bezPts([0.51, 0.18], [0.66, -0.16], [0.1, -0.26], [0.26, -0.62], 16), arcPts(0.33, -0.66, 0.08, 0.08, Math.PI, Math.PI * 3, 12)], 1.25)
};
const PAT_SAMPLES = {};          // evenly spaced points along each pattern, for scoring
(function () {
  const SP = 0.035;
  for (const id in PAT_GEO) {
    const out = [];
    let len = 0;
    PAT_GEO[id].forEach(s => {
      out.push(s[0][0], s[0][1]);
      let carry = 0;
      for (let i = 1; i < s.length; i++) {
        const ax = s[i - 1][0], ay = s[i - 1][1], dx = s[i][0] - ax, dy = s[i][1] - ay, d = Math.hypot(dx, dy);
        len += d;
        let t = SP - carry;
        while (t <= d) { out.push(ax + dx * t / d, ay + dy * t / d); t += SP; }
        carry = d - (t - SP);
      }
    });
    PAT_SAMPLES[id] = { pts: new Float32Array(out), n: out.length / 2, len: len };
  }
})();
const LATTE = { RB: 0.05, RMAX: 0.14, STEP: 0.03, GROW: 0.11, CS: 300, R: 108, CX: 160, CY: 150 };   // canvas size, coffee radius and center (px)
function artPatOk(p) { return rankIdx() >= p.rank; }
function champBonus() {
  let q = 0, perk = false;
  state.locations.forEach(l => l.staff.forEach(s => { if (s.role === 'barista') { q = Math.max(q, s.sk.qua); if (s.sk.qua >= 5) perk = true; } }));
  return q + (perk ? 3 : 0);
}
function artLabel(sc) { return sc >= 85 ? 'Perfect!' : sc >= 65 ? 'Great' : sc >= 40 ? 'Good' : 'Messy'; }
function artQ(sc) { return sc >= 85 ? 1 : sc >= 65 ? 0.75 : sc >= 40 ? 0.5 : 0; }
// Opens the pouring table. mode 'serve' = art cups for the shop on screen, 'contest' = a championship.
function openLatte(mode, champId) {
  const loc = curLoc(), C0 = champId ? CHAMP_BY_ID[champId] : null;
  if (mode === 'contest') {
    if (!C0 || !champOpen(C0)) return;
    if (champRested(C0)) { toast('You already competed there today. Come back tomorrow!', 'info', 'trophy'); return; }
    if (state.globalMoney < C0.fee) { toast('The entry fee is ' + money(C0.fee) + '.', 'bad', 'coin'); Snd.play('error'); return; }
    state.globalMoney -= C0.fee; state.stats.spent += C0.fee;
    const rec = state.champs[C0.id] || (state.champs[C0.id] = { won: false, best: 0, tries: 0 });
    rec.tries++; rec.day = dayIdx();
    log('You entered the ' + C0.n + ' (' + money(C0.fee) + ').', 'event');
    rt.latte = { mode: 'contest', champ: C0.id, round: 0, you: [], raw: [], rival: [], bonus: champBonus(), phase: 'intro', pat: C0.pats[0] };
    requestSave();
  } else {
    const prev = rt.latte && rt.latte.mode === 'serve' ? rt.latte.pat : 'heart';
    rt.latte = { mode: 'serve', pat: PAT_BY_ID[prev] && artPatOk(PAT_BY_ID[prev]) ? prev : 'heart', phase: 'pour', loc: loc };
  }
  latteReset();
  if (dlgKind === 'latte') renderDlg(); else openDlg('latte');
}
function latteReset() {
  const L = rt.latte, P = PAT_SAMPLES[L.pat];
  L.blobs = []; L.cov = new Uint8Array(P.n); L.covN = 0; L.area = 0; L.spill = 0; L.started = false; L.pouring = false; L.done = false;
  L.milk = 1; L.cur = null; L.score = 0; L.dirty = true; L.repaint = true; L.px = -9; L.py = -9;
  const C0 = L.champ ? CHAMP_BY_ID[L.champ] : null;
  L.tol = PAT_BY_ID[L.pat].tol * (1 + 0.06 * U('steamer')) * (C0 ? C0.tol : 1);
  L.budget = P.len / LATTE.STEP * 2;             // milk units: a careful pour uses about half of the pitcher
  L.practice = L.mode === 'serve' && (L.loc.art.length >= artCap() || L.loc.inventory.milk < 1);
}
function lattePatPick(id) {
  const L = rt.latte, p = PAT_BY_ID[id];
  if (!L || L.mode !== 'serve' || !p) return;
  if (!artPatOk(p)) { toast(p.n + ' unlocks at rank: ' + RANKS[p.rank].n, 'bad', 'lock'); Snd.play('error'); return; }
  if (L.started && !L.done) return;
  L.pat = id; L.phase = 'pour'; latteReset(); Snd.play('click'); renderDlg();
}
// a new blob of milk where the pitcher is
function latteBlob(u, v) {
  const L = rt.latte;
  if (L.blobs.length >= 700) return;
  latteSettle();
  const b = { x: u, y: v, r: LATTE.RB, sp: 0 };
  L.blobs.push(b); L.cur = b; L.still = 0;
  L.milk -= 1 / L.budget;
  latteCover(b);
  L.paint = b; L.dirty = true;
}
function latteCover(b) {
  const L = rt.latte, P = PAT_SAMPLES[L.pat], pts = P.pts, lim = b.r + 0.45 * L.tol, lim2 = lim * lim;
  for (let i = 0; i < P.n; i++) {
    if (L.cov[i]) continue;
    const dx = pts[i * 2] - b.x, dy = pts[i * 2 + 1] - b.y;
    if (dx * dx + dy * dy <= lim2) { L.cov[i] = 1; L.covN++; }
  }
}
// a blob is finished: work out how much of it landed off the pattern
function latteSettle() {
  const L = rt.latte, b = L.cur;
  if (!b) return;
  L.cur = null;
  const P = PAT_SAMPLES[L.pat], pts = P.pts;
  let dmin = 9;
  for (let i = 0; i < P.n; i++) { const dx = pts[i * 2] - b.x, dy = pts[i * 2 + 1] - b.y, d = dx * dx + dy * dy; if (d < dmin) dmin = d; }
  dmin = Math.sqrt(dmin);
  const a = b.r * b.r, off = clamp((dmin - L.tol * 0.55) / (L.tol * 0.9), 0, 1);
  const big = LATTE.RB * 1.7, over = b.r > big ? (a - big * big) / a : 0;
  L.area += a; L.spill += a * Math.min(1, off + over * (1 - off));
}
function latteLive() {
  const L = rt.latte, P = PAT_SAMPLES[L.pat];
  if (!L.blobs.length) return 0;
  const cov = L.covN / P.n, sp = L.area ? L.spill / L.area : 0;
  return Math.round(clamp(100 * Math.pow(cov, 1.15) * (1 - 0.95 * sp), 0, 100));
}
function latteDown(u, v) {
  const L = rt.latte;
  if (!L || L.phase !== 'pour' || L.done || L.milk <= 0) return;
  if (!L.started) {
    L.started = true;
    if (L.mode === 'serve' && !L.practice) { L.loc.inventory.milk--; rt.dirtyUI = true; }
  }
  L.pouring = true; L.px = u; L.py = v;
  latteBlob(u, v);
}
function latteMove(u, v) {
  const L = rt.latte;
  if (!L) return;
  L.px = u; L.py = v; L.dirty = true;
  if (!L.pouring || L.done) return;
  const b = L.cur;
  if (!b || Math.hypot(u - b.x, v - b.y) >= LATTE.STEP) {
    // fast moves skip ahead: fill the gap so a quick stroke still leaves a line
    if (b) { const d = Math.hypot(u - b.x, v - b.y), n = Math.min(8, Math.floor(d / LATTE.STEP)); for (let i = 1; i < n && L.milk > 0; i++) latteBlob(b.x + (u - b.x) * i / n, b.y + (v - b.y) * i / n); }
    if (L.milk > 0) latteBlob(u, v);
  }
  if (L.milk <= 0) latteFinish();
}
function latteUp() { const L = rt.latte; if (!L || !L.pouring) return; L.pouring = false; latteSettle(); L.dirty = true; }
// every frame while the dialog is open: holding still keeps pouring into the same spot (the blob grows)
function latteFrame(dt) {
  const L = rt.latte;
  if (!L || !L.cv) return;
  if (L.pouring && L.cur && !L.done && (L.still += dt) > 0.2) {       // only a pitcher held still keeps flooding one spot
    const b = L.cur, r0 = b.r;
    b.r = Math.min(LATTE.RMAX, b.r + LATTE.GROW * dt);
    if (b.r > r0) { L.milk -= (b.r * b.r - r0 * r0) / (LATTE.RB * LATTE.RB) / L.budget; latteCover(b); L.paint = b; L.dirty = true; }
    if (L.milk <= 0) latteFinish();
  }
  if (L.dirty) latteDraw();
}
function latteFinish(silent) {
  const L = rt.latte;
  if (!L || L.done || L.phase !== 'pour') return;
  if (!L.started) { if (!silent) toast('Hold the mouse button on the coffee and trace the pattern to pour.', 'info', 'drop'); return; }
  latteSettle();
  L.pouring = false; L.done = true; L.milk = Math.max(0, L.milk);
  const sc = latteLive(), st = state.stats;
  L.score = sc;
  if (sc > st.artBest) st.artBest = sc;
  if (L.mode === 'serve') {
    const q = artQ(sc);
    if (q > 0 && !L.practice && L.loc.art.length < artCap()) {
      L.loc.art.push({ q: q, m: PAT_BY_ID[L.pat].mult });
      st.art++; if (sc >= 85) st.artPerfect++;
      L.cup = true;
    } else L.cup = false;
    Snd.play(q >= 0.75 ? 'goal' : q > 0 ? 'coin' : 'error');
  } else {
    const C0 = CHAMP_BY_ID[L.champ], rb = C0.base + Math.floor(Math.random() * 15) - 6 + L.round * 2;
    L.raw[L.round] = sc;
    L.you[L.round] = Math.min(100, sc + (sc > 0 ? L.bonus : 0));
    L.rival[L.round] = clamp(rb, 30, 99);
    if (sc >= 85) st.artPerfect++;
    Snd.play(L.you[L.round] >= L.rival[L.round] ? 'goal' : 'angry');
  }
  L.phase = 'result';
  rt.goalsDirty = true; rt.dirtyUI = true;
  if (!silent) renderDlg(true);
  requestSave();
}
// the latte dialog is closing: keep a half-done art cup, but walking out of a championship forfeits it
function latteClose() {
  const L = rt.latte;
  if (!L) return;
  if (L.mode === 'serve') { if (L.phase === 'pour' && L.started && !L.done) latteFinish(true); }
  else if (L.phase !== 'final') { log('You left the ' + CHAMP_BY_ID[L.champ].n + '. The entry fee is lost.', 'bad'); toast('You left the championship.', 'bad', 'trophy'); }
  L.cv = null; L.ctx = null; L.pouring = false;
  if (L.mode === 'contest') rt.latte = null;
}
function latteNext() {
  const L = rt.latte;
  if (!L || L.mode !== 'contest') return;
  const C0 = CHAMP_BY_ID[L.champ];
  if (L.phase === 'intro') { L.phase = 'pour'; L.pat = C0.pats[0]; latteReset(); renderDlg(); return; }
  if (L.phase !== 'result') return;
  if (L.round < C0.pats.length - 1) { L.round++; L.pat = C0.pats[L.round]; L.phase = 'pour'; latteReset(); Snd.play('click'); renderDlg(); return; }
  // final verdict
  let you = 0, riv = 0; L.you.forEach(v => { you += v; }); L.rival.forEach(v => { riv += v; });
  const rec = state.champs[C0.id], first = !rec.won, win = you >= riv;
  rec.best = Math.max(rec.best, you);
  L.win = win; L.total = you; L.rtotal = riv; L.phase = 'final';
  if (win) {
    const prize = first ? C0.prize : Math.round(C0.prize * 0.25 / 50) * 50;
    L.prize = prize; rec.won = true;
    state.globalMoney += prize; modifyReputation(first ? C0.rep : Math.round(C0.rep / 3));
    if (first) state.stats.champs++;
    log((first ? 'You won the ' : 'You defended your title at the ') + C0.n + '! ' + you + ' to ' + riv + '. Prize: ' + money(prize) + '.', 'good');
    toast((first ? 'Champion! ' : 'Title defended! ') + C0.n + ': +' + money(prize), 'goal', 'trophy');
    Snd.play('rank');
  } else {
    log('You lost the ' + C0.n + ' to ' + C0.rival + ', ' + you + ' to ' + riv + '. Practice and try again!', 'bad');
    Snd.play('angry');
  }
  rt.goalsDirty = true; renderDlg(); updateUI(); requestSave();
}
// pointer position -> cup units
function latteUV(e) {
  const cv = rt.latte && rt.latte.cv;
  if (!cv) return null;
  const r = cv.getBoundingClientRect();
  if (!r.width) return null;
  const k = LATTE.CS / r.width;
  return { u: ((e.clientX - r.left) * k - LATTE.CX) / LATTE.R, v: ((e.clientY - r.top) * k - LATTE.CY) / LATTE.R };
}
// called after the dialog HTML is (re)built: hook up the canvas and repaint the milk already poured
function latteMount() {
  const L = rt.latte, cv = $('latte-cv');
  if (!L || !cv) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2), px = Math.round(LATTE.CS * dpr);
  cv.width = px; cv.height = px;
  L.cv = cv; L.ctx = cv.getContext('2d'); L.k = px / LATTE.CS;
  if (!L.base || L.base.width !== px) {
    L.base = document.createElement('canvas'); L.base.width = px; L.base.height = px;
    L.milkCv = document.createElement('canvas'); L.milkCv.width = px; L.milkCv.height = px;
    latteBase(L.base.getContext('2d'), L.k);
  }
  L.guide = new Path2D();
  PAT_GEO[L.pat].forEach(s => { s.forEach((p, i) => { const x = LATTE.CX + p[0] * LATTE.R, y = LATTE.CY + p[1] * LATTE.R; if (i) L.guide.lineTo(x, y); else L.guide.moveTo(x, y); }); });
  L.repaint = true; L.dirty = true;
  cv.addEventListener('pointerdown', e => { e.preventDefault(); Snd.init(); try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } const p = latteUV(e); if (p) latteDown(p.u, p.v); });
  cv.addEventListener('pointermove', e => { const p = latteUV(e); if (p) latteMove(p.u, p.v); });
  const up = () => latteUp();
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', () => { if (rt.latte) { rt.latte.px = -9; rt.latte.dirty = true; } });
  latteDraw();
}
function latteBase(c, k) {
  const S = LATTE.CS, x = LATTE.CX, y = LATTE.CY, R = LATTE.R;
  c.setTransform(k, 0, 0, k, 0, 0);
  c.fillStyle = '#2a1b12'; c.fillRect(0, 0, S, S);
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.arc(x + 4, y + 7, R + 22, 0, 6.3); c.fill();
  c.fillStyle = '#f3ede4'; c.beginPath(); c.arc(x + R + 14, y + 6, 17, 0, 6.3); c.fill();          // handle
  c.fillStyle = '#2a1b12'; c.beginPath(); c.arc(x + R + 16, y + 6, 8, 0, 6.3); c.fill();
  c.fillStyle = '#f8f4ee'; c.beginPath(); c.arc(x, y, R + 20, 0, 6.3); c.fill();
  c.strokeStyle = '#d6cbbb'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, R + 11, 0, 6.3); c.stroke();
  const g = c.createRadialGradient(x - 20, y - 25, 10, x, y, R + 4);
  g.addColorStop(0, '#c98a52'); g.addColorStop(0.65, '#9a5a2c'); g.addColorStop(1, '#6b3a1a');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, R + 4, 0, 6.3); c.fill();
  c.fillStyle = 'rgba(255,230,190,0.13)';
  for (let i = 0; i < 70; i++) { const a = hash2(i, 3, 7) * 6.28, d = Math.sqrt(hash2(i, 5, 9)) * R; c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 1 + hash2(i, 1, 2) * 2.2, 0, 6.3); c.fill(); }
}
function lattePaintBlob(c, b) {
  const x = LATTE.CX + b.x * LATTE.R, y = LATTE.CY + b.y * LATTE.R, r = b.r * LATTE.R;
  c.fillStyle = 'rgba(250,240,225,0.45)'; c.beginPath(); c.arc(x, y, r * 1.18, 0, 6.3); c.fill();
  c.fillStyle = '#fffaf2'; c.beginPath(); c.arc(x, y, r, 0, 6.3); c.fill();
}
function latteDraw() {
  const L = rt.latte, c = L.ctx;
  if (!c) return;
  L.dirty = false;
  const S = LATTE.CS, cx = LATTE.CX, cy = LATTE.CY;
  const mc = L.milkCv.getContext('2d');
  if (L.repaint) {
    L.repaint = false;
    mc.setTransform(1, 0, 0, 1, 0, 0); mc.clearRect(0, 0, L.milkCv.width, L.milkCv.height); mc.setTransform(L.k, 0, 0, L.k, 0, 0);
    mc.save(); mc.beginPath(); mc.arc(cx, cy, LATTE.R + 3, 0, 6.3); mc.clip();
    for (let i = 0; i < L.blobs.length; i++) lattePaintBlob(mc, L.blobs[i]);
    mc.restore(); L.paint = null;
  } else if (L.paint) {
    mc.save(); mc.beginPath(); mc.arc(cx, cy, LATTE.R + 3, 0, 6.3); mc.clip();
    lattePaintBlob(mc, L.paint); mc.restore(); L.paint = null;
  }
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.drawImage(L.base, 0, 0); c.drawImage(L.milkCv, 0, 0);
  c.setTransform(L.k, 0, 0, L.k, 0, 0);
  // the pattern guide: a soft band (how far off you may be) and a dashed center line
  if (!L.done || L.phase === 'pour') {
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = 'rgba(255,255,255,0.13)'; c.lineWidth = L.tol * 2 * LATTE.R; c.stroke(L.guide);
    c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1.6; c.setLineDash([5, 5]); c.stroke(L.guide); c.setLineDash([]);
  }
  // milk left in the pitcher
  const mh = 120, mx = 10, my = cy - mh / 2, left = clamp(L.milk, 0, 1);
  c.fillStyle = 'rgba(0,0,0,0.5)'; rrect(c, mx - 2, my - 2, 12, mh + 4, 5); c.fill();
  c.fillStyle = left > 0.25 ? '#f8fafc' : '#fca5a5'; rrect(c, mx, my + mh * (1 - left), 8, mh * left, 3); c.fill();
  c.fillStyle = '#e7d8c4'; c.font = 'bold 10px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('MILK', mx + 4, my + mh + 12);
  // live match score
  if (L.started) {
    const sc = L.done ? L.score : latteLive();
    c.font = 'bold 15px "Trebuchet MS",Arial'; c.textAlign = 'right'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.75)';
    const t = (L.done ? '' : 'Match ') + sc + '%'; c.strokeText(t, S - 10, 18); c.fillStyle = sc >= 65 ? '#bbf7d0' : sc >= 40 ? '#fde68a' : '#fecaca'; c.fillText(t, S - 10, 18);
  }
  // the pitcher spout follows the pointer
  if (L.px > -2 && !L.done) {
    const x = cx + L.px * LATTE.R, y = cy + L.py * LATTE.R;
    c.strokeStyle = L.pouring ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.6)'; c.lineWidth = 1.5;
    c.beginPath(); c.arc(x, y, LATTE.RB * LATTE.R, 0, 6.3); c.stroke();
    c.fillStyle = '#cbd5e1'; c.beginPath(); c.moveTo(x + 4, y - 4); c.lineTo(x + 18, y - 22); c.lineTo(x + 26, y - 14); c.lineTo(x + 8, y); c.closePath(); c.fill();
  }
}

