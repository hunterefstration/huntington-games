// ---- enemy vehicles, soldiers and sci-fi machines (all drawn facing +x) ----
function treads(c, L, Wd, w) { c.fillStyle = '#1c1f22'; c.fillRect(-L, -Wd - w, L * 2, w); c.fillRect(-L, Wd, L * 2, w); c.fillStyle = '#3a3f44'; for (let i = -L + 3; i < L - 2; i += 6) { c.fillRect(i, -Wd - w, 2, w); c.fillRect(i, Wd, 2, w); } }
function wheels4(c, L, Wd, rr) { c.fillStyle = '#1c1f22'; for (const sx of [-0.62, 0.62]) for (const sy of [-1, 1]) { c.beginPath(); c.arc(L * sx, Wd * sy, rr, 0, 6.283); c.fill(); } }
function turretAt(c, x, rr, col, barrel, bw) { c.fillStyle = col; c.beginPath(); c.arc(x, 0, rr, 0, 6.283); c.fill(); c.fillStyle = '#22272b'; c.fillRect(x, -(bw || 2) / 2, barrel, bw || 2); }
function glowDot(c, x, y, rr, color) { c.fillStyle = color; c.beginPath(); c.arc(x, y, rr, 0, 6.283); c.fill(); c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.arc(x, y, rr * 0.4, 0, 6.283); c.fill(); }
// walking robot legs: n pairs along x, swinging with time
function botLegs(c, n, span, reach, base, t, color, lw) { c.strokeStyle = color; c.lineWidth = lw; for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * span, w = Math.sin(t / 3 + i * 2.1) * reach * 0.4; for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(x, sd * base); c.lineTo(x + w, sd * (base + reach)); c.stroke(); } } }
// a bipedal combat mech seen from above (the Colossus, the Titan, and the Mech Walker mercenary)
function mechArt(c, r, col, dk, titan, t, flash) {
  const step = Math.sin(t / 10) * r * 0.18;
  c.fillStyle = '#1c1f22'; c.fillRect(-r * 0.5 + step, -r * 1.0, r * 1.15, r * 0.5); c.fillRect(-r * 0.5 - step, r * 0.5, r * 1.15, r * 0.5);          // feet
  c.fillStyle = dk; c.fillRect(-r * 0.3 + step, -r * 0.75, r * 0.7, r * 0.35); c.fillRect(-r * 0.3 - step, r * 0.4, r * 0.7, r * 0.35);                 // legs
  c.fillStyle = col; roundRect(c, -r * 0.8, -r * 0.55, r * 1.4, r * 1.1, r * 0.2); c.fill();                                                           // torso
  c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(-r * 0.8, -r * 0.55, r * 0.45, r * 1.1);
  for (const sd of [-1, 1]) {                                                                                                                           // shoulder cannons
    c.fillStyle = dk; roundRect(c, -r * 0.35, sd * r * 0.82 - r * 0.28, r * 0.85, r * 0.56, r * 0.12); c.fill();
    c.fillStyle = '#22272b'; c.fillRect(r * 0.45, sd * r * 0.82 - r * 0.09, r * (titan ? 1.1 : 0.85), r * 0.18);
    if (titan) { c.fillStyle = '#b33'; c.fillRect(-r * 0.25, sd * r * 0.82 - r * 0.18, r * 0.35, r * 0.36); }
  }
  c.fillStyle = flash ? '#fff' : dk; c.beginPath(); c.arc(r * 0.35, 0, r * 0.34, 0, 6.283); c.fill();                                                    // head
  c.fillStyle = titan ? '#ff5252' : '#ffab40'; c.fillRect(r * 0.42, -r * 0.2, r * 0.18, r * 0.4);                                                      // visor
  glowDot(c, -r * 0.45, 0, r * 0.2 + Math.sin(t / 5) * r * 0.03, '#18ffff');                                                                            // reactor
}
function drawEnemyArt(c, def, x, y, r, angle, opts) {
  opts = opts || {}; const col = opts.flash ? '#ffffff' : def.color, id = def.id, t = opts.t || 0;
  const dk = shade(def.color[0] === '#' ? def.color : '#888888', 0.6);
  c.save(); c.translate(x, y);
  if (def.air) { c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(6, 14, r, r * 0.45, 0, 0, 6.283); c.fill(); }
  if (opts.burrowed) { c.fillStyle = '#6d4c41'; c.beginPath(); c.ellipse(0, 0, r, r * 0.55, 0, 0, 6.283); c.fill(); c.fillStyle = '#8d6e63'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(Math.cos(i * 1.6) * r * 0.6, Math.sin(i * 1.6) * r * 0.3, 2, 0, 6.283); c.fill(); } c.restore(); return; }
  c.rotate(angle || 0);
  if (opts.alpha != null) c.globalAlpha = opts.alpha;
  const plates = () => { if (def.armor) { c.fillStyle = 'rgba(255,255,255,0.28)'; c.fillRect(r * 0.55, -r * 0.5, r * 0.22, r * 1.0); } };
  if (id === 'drone') { c.strokeStyle = '#95a5a6'; c.lineWidth = 2; c.beginPath(); c.moveTo(-r, -r); c.lineTo(r, r); c.moveTo(r, -r); c.lineTo(-r, r); c.stroke(); c.fillStyle = col; c.beginPath(); c.arc(0, 0, r * 0.55, 0, 6.283); c.fill(); c.fillStyle = 'rgba(200,200,200,0.5)'; for (const [a, b] of [[-r, -r], [r, r], [r, -r], [-r, r]]) { c.beginPath(); c.arc(a, b, r * 0.45, 0, 6.283); c.fill(); } }
  else if (id === 'jet') { c.fillStyle = col; c.beginPath(); c.moveTo(r * 1.3, 0); c.lineTo(-r, -r); c.lineTo(-r * 0.5, 0); c.lineTo(-r, r); c.closePath(); c.fill(); c.fillStyle = '#85c1e9'; c.beginPath(); c.arc(r * 0.4, 0, r * 0.25, 0, 6.283); c.fill(); }
  else if (id === 'zeppelin') {
    c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, r * 1.4, r * 0.65, 0, 0, 6.283); c.fill();
    c.fillStyle = dk; c.beginPath(); c.moveTo(-r * 1.3, 0); c.lineTo(-r * 1.8, -r * 0.7); c.lineTo(-r * 1.0, -r * 0.2); c.moveTo(-r * 1.3, 0); c.lineTo(-r * 1.8, r * 0.7); c.lineTo(-r * 1.0, r * 0.2); c.fill();
    c.fillStyle = '#5d4037'; c.fillRect(-r * 0.3, -r * 0.18, r * 0.7, r * 0.36);
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * r * 0.5, -r * 0.6); c.lineTo(i * r * 0.5, r * 0.6); c.stroke(); }
  }
  else if (id === 'hive') {                                 // hive ship: a saucer-like carrier with launch bays
    c.fillStyle = dk; c.beginPath(); c.ellipse(0, 0, r * 1.25, r * 1.05, 0, 0, 6.283); c.fill();
    c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, r * 1.0, r * 0.86, 0, 0, 6.283); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.ellipse(-r * 0.25, 0, r * 0.7, r * 0.6, 0, 0, 6.283); c.fill();
    for (let i = 0; i < 6; i++) { const a = i * 1.047 + 0.52; c.fillStyle = '#2d3436'; c.beginPath(); c.arc(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.68, r * 0.17, 0, 6.283); c.fill(); }
    for (let i = 0; i < 10; i++) { const a = i * 0.628 + t / 18; c.fillStyle = i % 2 ? '#ffeaa7' : '#ff7675'; c.beginPath(); c.arc(Math.cos(a) * r * 1.13, Math.sin(a) * r * 0.95, r * 0.075, 0, 6.283); c.fill(); }
    c.fillStyle = '#74b9ff'; c.beginPath(); c.arc(r * 0.1, 0, r * 0.36, 0, 6.283); c.fill(); c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.arc(r * 0.02, -r * 0.1, r * 0.13, 0, 6.283); c.fill();
  }
  else if (id === 'fast') {                                // motorcycle scout
    c.fillStyle = '#1c1f22'; c.beginPath(); c.arc(r * 0.9, 0, r * 0.4, 0, 6.283); c.arc(-r * 0.9, 0, r * 0.4, 0, 6.283); c.fill();
    c.fillStyle = col; c.fillRect(-r * 0.9, -r * 0.2, r * 1.8, r * 0.4);
    c.fillStyle = '#cfd8dc'; c.fillRect(r * 0.5, -r * 0.55, r * 0.15, r * 1.1);
    c.fillStyle = dk; c.beginPath(); c.arc(-r * 0.1, 0, r * 0.5, 0, 6.283); c.fill(); c.fillStyle = '#d7b98e'; c.beginPath(); c.arc(0, 0, r * 0.28, 0, 6.283); c.fill();
  }
  else if (id === 'tank' || id === 'heavytank') {
    const L = r * 1.15, Wd = r * 0.62;
    treads(c, L, Wd, r * 0.3);
    c.fillStyle = col; c.fillRect(-L, -Wd, L * 2, Wd * 2);
    c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(-L, -Wd, L * 0.5, Wd * 2);
    if (id === 'heavytank') { turretAt(c, -r * 0.1, r * 0.5, dk, r * 1.3, 3.2); c.fillStyle = dk; c.beginPath(); c.arc(r * 0.55, r * 0.35, r * 0.18, 0, 6.283); c.fill(); }
    else turretAt(c, -r * 0.05, r * 0.45, dk, r * 1.0, 2.6);
    plates();
  }
  else if (id === 'armored') {
    const L = r * 1.2, Wd = r * 0.62;
    wheels4(c, L, Wd + 1, r * 0.26);
    c.fillStyle = col; roundRect(c, -L, -Wd, L * 2, Wd * 2, r * 0.2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.2)'; c.fillRect(L * 0.15, -Wd * 0.7, L * 0.5, Wd * 1.4);
    turretAt(c, -L * 0.15, r * 0.4, dk, r * 0.9, 2.4); plates();
  }
  else if (id === 'truck') {
    const L = r * 1.2, Wd = r * 0.6;
    wheels4(c, L, Wd + 1, r * 0.27);
    c.fillStyle = col; c.fillRect(L * 0.35, -Wd, L * 0.65, Wd * 2);            // cab
    c.fillStyle = '#cfd8dc'; c.fillRect(L * 0.75, -Wd * 0.7, L * 0.15, Wd * 1.4);
    c.fillStyle = '#b9c28a'; c.fillRect(-L, -Wd * 0.95, L * 1.3, Wd * 1.9);  // cargo bed
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1; for (let i = -3; i <= 1; i++) { c.beginPath(); c.moveTo(i * L * 0.3 - L * 0.1, -Wd * 0.9); c.lineTo(i * L * 0.3 - L * 0.1, Wd * 0.9); c.stroke(); }
  }
  else if (id === 'boss') {                                 // armored train
    const L = r * 1.5, Wd = r * 0.55;
    c.fillStyle = '#1c1f22'; for (let i = -3; i <= 3; i++) { c.fillRect(i * L * 0.3 - 3, -Wd - 3, 6, 4); c.fillRect(i * L * 0.3 - 3, Wd - 1, 6, 4); }
    c.fillStyle = col; c.fillRect(-L, -Wd, L * 2, Wd * 2);
    c.fillStyle = '#2b2b2b'; c.fillRect(L * 0.45, -Wd * 0.7, L * 0.55, Wd * 1.4);       // boiler / engine
    c.fillStyle = '#111'; c.beginPath(); c.arc(L * 0.8, 0, r * 0.18, 0, 6.283); c.fill();   // smokestack
    c.fillStyle = '#f1c40f'; c.fillRect(-L, -Wd * 0.1, L * 1.4, Wd * 0.2);               // stripe
    turretAt(c, -L * 0.35, r * 0.4, dk, r * 1.0, 3);
    c.strokeStyle = '#111'; c.lineWidth = 1; c.strokeRect(-L, -Wd, L * 2, Wd * 2);
    plates();
  }
  else if (id === 'railway') {                              // railway gun
    const L = r * 1.5, Wd = r * 0.5;
    c.fillStyle = '#1c1f22'; for (let i = -3; i <= 3; i++) { c.fillRect(i * L * 0.3 - 3, -Wd - 3, 6, 4); c.fillRect(i * L * 0.3 - 3, Wd - 1, 6, 4); }
    c.fillStyle = col; c.fillRect(-L, -Wd, L * 2, Wd * 2);
    c.fillStyle = '#37474f'; roundRect(c, -L * 0.5, -Wd * 0.9, L * 1.0, Wd * 1.8, 4); c.fill();
    c.fillStyle = '#10161b'; c.fillRect(-L * 0.3, -Wd * 0.28, L * 2.1, Wd * 0.56); c.fillRect(L * 1.7, -Wd * 0.4, r * 0.3, Wd * 0.8);
    c.fillStyle = '#f1c40f'; c.fillRect(-L, -Wd * 0.08, L * 0.5, Wd * 0.16);
    plates();
  }
  // ---------------- sci-fi enemies ----------------
  else if (id === 'swarm') {                                // swarm bot: a tiny skittering crawler
    botLegs(c, 3, r * 0.55, r * 0.55, r * 0.35, t, dk, 1.3);
    c.fillStyle = col; roundRect(c, -r * 0.8, -r * 0.5, r * 1.6, r * 1.0, r * 0.35); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.28)'; c.fillRect(-r * 0.5, -r * 0.34, r * 0.8, r * 0.2);
    glowDot(c, r * 0.5, 0, r * 0.22, '#ff1744');
  }
  else if (id === 'shredder') {                             // shredder: a tracked robot with a spinning buzz saw
    const L = r * 1.0, Wd = r * 0.6;
    treads(c, L * 0.85, Wd, r * 0.26);
    c.fillStyle = col; roundRect(c, -L, -Wd, L * 1.7, Wd * 2, r * 0.2); c.fill();
    c.fillStyle = dk; c.fillRect(-L * 0.75, -Wd * 0.5, L * 0.8, Wd);
    glowDot(c, -L * 0.3, 0, r * 0.17, '#ffca28');
    c.save(); c.translate(L * 0.95, 0); c.rotate(t * 0.55); c.fillStyle = opts.flash ? '#fff' : '#cfd8dc'; c.beginPath();
    for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283, rr = i % 2 ? r * 0.5 : r * 0.82; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    c.closePath(); c.fill(); c.fillStyle = '#455a64'; c.beginPath(); c.arc(0, 0, r * 0.2, 0, 6.283); c.fill(); c.restore();
  }
  else if (id === 'regen') {                                // regen bot: a walker wrapped in a cloud of repair nanites
    botLegs(c, 2, r * 0.7, r * 0.5, r * 0.5, t, dk, 1.8);
    c.fillStyle = col; c.beginPath(); for (let i = 0; i < 6; i++) { const a = i * 1.047; c.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85); } c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.9)'; c.fillRect(-r * 0.4, -r * 0.1, r * 0.8, r * 0.2); c.fillRect(-r * 0.1, -r * 0.4, r * 0.2, r * 0.8);
    glowDot(c, r * 0.55, 0, r * 0.15, '#00e5ff');
    for (let i = 0; i < 8; i++) { const a = i * 0.785 + t / 14, rr = r * (1.12 + Math.sin(t / 6 + i) * 0.1); c.fillStyle = 'rgba(180,255,230,0.85)'; c.beginPath(); c.arc(Math.cos(a) * rr, Math.sin(a) * rr, r * 0.09, 0, 6.283); c.fill(); }
  }
  else if (id === 'phasewalker') {                                // phase walker: a robot that flickers between positions
    for (let k = 3; k >= 1; k--) { c.globalAlpha = (opts.alpha != null ? opts.alpha : 1) * (0.14 + 0.04 * (4 - k)); c.fillStyle = '#9ecbff'; c.beginPath(); c.ellipse(-k * r * 0.45, Math.sin(t / 4 + k) * r * 0.1, r * 0.7, r * 0.95, 0, 0, 6.283); c.fill(); }
    c.globalAlpha = opts.alpha != null ? opts.alpha : 1;
    c.fillStyle = opts.flash ? '#fff' : 'rgba(200,228,255,0.85)'; c.beginPath(); c.ellipse(0, 0, r * 0.7, r * 0.95, 0, 0, 6.283); c.fill();
    c.strokeStyle = 'rgba(90,160,255,0.95)'; c.lineWidth = 1.3; c.stroke();
    c.fillStyle = 'rgba(120,180,255,0.9)'; c.beginPath(); c.arc(r * 0.05, 0, r * 0.45, 0, 6.283); c.fill();
    c.fillStyle = '#e3f2fd'; c.fillRect(r * 0.25, -r * 0.25, r * 0.2, r * 0.5);
    c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(-r * 0.6, i * r * 0.3 + Math.sin(t / 5 + i) * 1.5); c.lineTo(r * 0.5, i * r * 0.3 + Math.sin(t / 5 + i) * 1.5); c.stroke(); }
  }
  else if (id === 'shielded') {                             // shielded: a power-armored trooper (the energy bubble is drawn below)
    c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, r * 0.75, r * 1.0, 0, 0, 6.283); c.fill();
    c.fillStyle = dk; roundRect(c, -r * 0.35, -r * 1.05, r * 0.8, r * 0.5, r * 0.15); c.fill(); roundRect(c, -r * 0.35, r * 0.55, r * 0.8, r * 0.5, r * 0.15); c.fill();
    c.fillStyle = '#37474f'; c.beginPath(); c.arc(r * 0.05, 0, r * 0.5, 0, 6.283); c.fill();
    c.fillStyle = '#ffab40'; c.fillRect(r * 0.2, -r * 0.3, r * 0.28, r * 0.6);
    c.strokeStyle = '#263238'; c.lineWidth = Math.max(2, r * 0.22); c.beginPath(); c.moveTo(r * 0.3, r * 0.6); c.lineTo(r * 1.6, r * 0.6); c.stroke();
    glowDot(c, r * 1.6, r * 0.6, r * 0.15, '#ffab40');
  }
  else if (id === 'teleporter') {                           // teleporter: a hovering emitter wrapped in warp rings
    c.fillStyle = col; c.beginPath(); c.moveTo(r * 0.95, 0); c.lineTo(0, -r * 0.8); c.lineTo(-r * 0.8, 0); c.lineTo(0, r * 0.8); c.closePath(); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.moveTo(0, -r * 0.8); c.lineTo(-r * 0.8, 0); c.lineTo(0, r * 0.8); c.lineTo(-r * 0.2, 0); c.closePath(); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, r * 0.3 + Math.sin(t / 5) * 1.5, 0, 6.283); c.fill();
    c.strokeStyle = 'rgba(240,160,255,0.9)'; c.lineWidth = 1.6; for (let i = 0; i < 3; i++) { const a = t / 9 + i * 2.094; c.beginPath(); c.arc(0, 0, r * 1.2, a, a + 0.9); c.stroke(); }
  }
  else if (id === 'carrier') {                              // carrier: a four-legged walker with a deck full of swarm bots
    const L = r * 1.2, Wd = r * 0.62;
    c.fillStyle = '#1c1f22'; for (const sx of [-0.7, 0.7]) for (const sy of [-1, 1]) { const sw = Math.sin(t / 12 + sx * 3 + sy) * r * 0.12; c.fillRect(L * sx - r * 0.35 + sw, Wd * sy * 1.12 - r * 0.2, r * 0.7, r * 0.4); }
    c.fillStyle = col; roundRect(c, -L, -Wd, L * 2, Wd * 2, r * 0.25); c.fill();
    c.fillStyle = dk; roundRect(c, -L * 0.85, -Wd * 0.7, L * 1.1, Wd * 1.4, r * 0.1); c.fill();
    for (let i = 0; i < 6; i++) { c.fillStyle = '#00cec9'; c.beginPath(); c.arc(-L * 0.62 + (i % 3) * L * 0.34, (i < 3 ? -1 : 1) * Wd * 0.33, r * 0.14, 0, 6.283); c.fill(); }
    c.fillStyle = '#37474f'; c.beginPath(); c.arc(L * 0.55, 0, r * 0.33, 0, 6.283); c.fill(); c.fillStyle = '#ff9800'; c.fillRect(L * 0.62, -r * 0.2, r * 0.18, r * 0.4);
  }
  else if (id === 'phantom') {                              // phantom: a cloaked stealth operative with a shimmering suit
    c.fillStyle = col; c.beginPath(); c.moveTo(r * 1.1, 0); c.lineTo(-r * 0.7, -r * 0.95); c.lineTo(-r * 0.25, 0); c.lineTo(-r * 0.7, r * 0.95); c.closePath(); c.fill();
    c.fillStyle = dk; c.beginPath(); c.moveTo(r * 0.8, 0); c.lineTo(-r * 0.35, -r * 0.5); c.lineTo(-r * 0.1, 0); c.lineTo(-r * 0.35, r * 0.5); c.closePath(); c.fill();
    glowDot(c, r * 0.5, -r * 0.18, r * 0.1, '#18ffff'); glowDot(c, r * 0.5, r * 0.18, r * 0.1, '#18ffff');
    c.strokeStyle = 'rgba(200,190,255,0.6)'; c.lineWidth = 1; for (let i = -2; i <= 2; i++) { const o = ((t / 3 + i * 7) % 16) / 16; c.beginPath(); c.moveTo(-r * 0.8, (o - 0.5) * r * 2); c.lineTo(r * 0.6, (o - 0.5) * r * 2); c.stroke(); }
  }
  else if (id === 'dronecmd') {                             // drone commander: a command platform with orbiting repair drones
    c.fillStyle = col; c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * 0.785 + 0.39; c.lineTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95); } c.closePath(); c.fill();
    c.strokeStyle = dk; c.lineWidth = 2; c.stroke();
    c.fillStyle = dk; c.beginPath(); c.arc(0, 0, r * 0.55, 0, 6.283); c.fill();
    c.fillStyle = '#ecf0f1'; c.fillRect(-r * 0.3, -r * 0.08, r * 0.6, r * 0.16); c.fillRect(-r * 0.08, -r * 0.3, r * 0.16, r * 0.6);
    c.strokeStyle = '#cfd8dc'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-r * 0.7, -r * 0.5); c.lineTo(-r * 1.2, -r * 0.9); c.moveTo(-r * 0.7, r * 0.5); c.lineTo(-r * 1.2, r * 0.9); c.stroke();
    for (let i = 0; i < 3; i++) { const a = t / 16 + i * 2.094; const dx = Math.cos(a) * r * 1.35, dy = Math.sin(a) * r * 1.35; c.fillStyle = '#b2bec3'; c.beginPath(); c.arc(dx, dy, r * 0.2, 0, 6.283); c.fill(); glowDot(c, dx, dy, r * 0.09, '#00e676'); }
  }
  else if (id === 'burrower') {                             // burrower: a tunneling machine with a spinning drill
    const L = r * 1.0, Wd = r * 0.58;
    treads(c, L * 0.8, Wd, r * 0.24);
    c.fillStyle = col; roundRect(c, -L, -Wd, L * 1.5, Wd * 2, r * 0.2); c.fill();
    c.fillStyle = dk; c.fillRect(-L * 0.8, -Wd * 0.45, L * 0.7, Wd * 0.9);
    c.save(); c.beginPath(); c.moveTo(L * 0.5, -Wd * 1.05); c.lineTo(L * 1.55, 0); c.lineTo(L * 0.5, Wd * 1.05); c.closePath(); c.clip();
    c.fillStyle = opts.flash ? '#fff' : '#b0bec5'; c.fillRect(L * 0.5, -Wd * 1.1, L * 1.2, Wd * 2.2);
    c.strokeStyle = '#546e7a'; c.lineWidth = 2.4; for (let i = -3; i < 4; i++) { const o = ((t / 2 + i * 7) % 14) / 14; c.beginPath(); c.moveTo(L * (0.5 + o * 0.6) - 4, -Wd * 1.1); c.lineTo(L * (0.5 + o * 0.6) + 6, Wd * 1.1); c.stroke(); }
    c.restore();
    glowDot(c, -L * 0.35, 0, r * 0.14, '#ffca28');
  }
  // ---------------- alien invaders ----------------
  else if (id === 'greyscout') {                            // grey scout: a big-headed alien with a ray gun
    c.fillStyle = shade('#90a4ae', 0.7); c.beginPath(); c.ellipse(-r * 0.3, 0, r * 0.42, r * 0.55, 0, 0, 6.283); c.fill();
    c.strokeStyle = '#263238'; c.lineWidth = Math.max(1.5, r * 0.16); c.beginPath(); c.moveTo(r * 0.1, r * 0.55); c.lineTo(r * 1.25, r * 0.55); c.stroke(); glowDot(c, r * 1.25, r * 0.55, r * 0.14, '#76ff03');
    c.fillStyle = col; c.beginPath(); c.ellipse(r * 0.18, 0, r * 0.6, r * 0.72, 0, 0, 6.283); c.fill();
    c.fillStyle = '#0b0b0b'; c.beginPath(); c.ellipse(r * 0.48, -r * 0.27, r * 0.2, r * 0.11, 0.6, 0, 6.283); c.ellipse(r * 0.48, r * 0.27, r * 0.2, r * 0.11, -0.6, 0, 6.283); c.fill();
  }
  else if (id === 'stalker') {                              // warp stalker: an angular insectoid that glows before it jumps
    if (opts.charging) { c.fillStyle = 'rgba(234,128,252,' + (0.25 + 0.25 * Math.sin(t / 2)).toFixed(2) + ')'; c.beginPath(); c.arc(0, 0, r * 1.7, 0, 6.283); c.fill(); }
    botLegs(c, 3, r * 0.5, r * 0.6, r * 0.3, t, dk, 1.4);
    c.fillStyle = col; c.beginPath(); c.moveTo(r * 1.2, 0); c.lineTo(r * 0.2, -r * 0.6); c.lineTo(-r * 0.9, -r * 0.35); c.lineTo(-r * 0.6, 0); c.lineTo(-r * 0.9, r * 0.35); c.lineTo(r * 0.2, r * 0.6); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.moveTo(r * 1.2, 0); c.lineTo(r * 0.2, -r * 0.6); c.lineTo(r * 0.1, 0); c.closePath(); c.fill();
    glowDot(c, r * 0.7, -r * 0.18, r * 0.12, '#ff80ab'); glowDot(c, r * 0.7, r * 0.18, r * 0.12, '#ff80ab');
  }
  else if (id === 'splitter') {                             // splitter: a wobbling jelly blob with a nucleus
    c.fillStyle = opts.flash ? '#fff' : 'rgba(118,255,3,0.55)'; c.beginPath();
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283, rr = r * (0.92 + 0.1 * Math.sin(t / 5 + i * 1.7)); c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    c.closePath(); c.fill(); c.strokeStyle = 'rgba(51,105,30,0.9)'; c.lineWidth = 1.4; c.stroke();
    c.fillStyle = 'rgba(204,255,144,0.8)'; c.beginPath(); c.arc(-r * 0.15, -r * 0.1, r * 0.38, 0, 6.283); c.fill();
    c.fillStyle = '#33691e'; c.beginPath(); c.arc(-r * 0.1, -r * 0.05, r * 0.18, 0, 6.283); c.fill();
  }
  else if (id === 'saucer' || id === 'mothership') {       // flying saucers: a spinning disc with a glass dome
    const big = id === 'mothership';
    c.fillStyle = shade('#78909c', 0.6); c.beginPath(); c.ellipse(0, 0, r * 1.2, r * 0.95, 0, 0, 6.283); c.fill();
    c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, r * 1.1, r * 0.85, 0, 0, 6.283); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1; c.beginPath(); c.ellipse(0, 0, r * 0.78, r * 0.6, 0, 0, 6.283); c.stroke();
    const nL = big ? 16 : 8; for (let i = 0; i < nL; i++) { const a = i / nL * 6.283 + t / 14; c.fillStyle = i % 2 ? '#ffeb3b' : '#76ff03'; c.beginPath(); c.arc(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.74, r * (big ? 0.05 : 0.09), 0, 6.283); c.fill(); }
    if (big) { for (let i = 0; i < 4; i++) { const a = i * 1.571 + 0.785; c.fillStyle = '#263238'; c.beginPath(); c.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.42, r * 0.12, 0, 6.283); c.fill(); } }
    c.fillStyle = 'rgba(128,216,255,0.75)'; c.beginPath(); c.ellipse(0, 0, r * 0.42, r * 0.36, 0, 0, 6.283); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.arc(-r * 0.12, -r * 0.1, r * 0.12, 0, 6.283); c.fill();
  }
  else if (id === 'shielddrone') {                          // barrier drone: a floating orb with three emitter prongs
    c.save(); c.rotate(t / 20); c.strokeStyle = dk; c.lineWidth = 2; for (let i = 0; i < 3; i++) { const a = i * 2.094; c.beginPath(); c.moveTo(Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4); c.lineTo(Math.cos(a) * r * 1.1, Math.sin(a) * r * 1.1); c.stroke(); glowDot(c, Math.cos(a) * r * 1.1, Math.sin(a) * r * 1.1, r * 0.16, '#18ffff'); } c.restore();
    c.fillStyle = col; c.beginPath(); c.arc(0, 0, r * 0.65, 0, 6.283); c.fill();
    glowDot(c, 0, 0, r * 0.3 + Math.sin(t / 6) * r * 0.05, '#e0ffff');
  }
  else if (id === 'xbrute') {                               // xeno brute: a hulking armored alien
    c.fillStyle = dk; c.beginPath(); c.ellipse(r * 0.55, -r * 0.62, r * 0.42, r * 0.25, 0.4, 0, 6.283); c.ellipse(r * 0.55, r * 0.62, r * 0.42, r * 0.25, -0.4, 0, 6.283); c.fill();       // arms
    c.fillStyle = col; c.beginPath(); c.ellipse(-r * 0.05, 0, r * 0.8, r * 0.85, 0, 0, 6.283); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.22)'; for (let i = -1; i <= 1; i++) c.fillRect(-r * 0.6, i * r * 0.4 - r * 0.08, r * 0.9, r * 0.16);
    c.fillStyle = shade(def.color, 0.75); c.beginPath(); c.ellipse(r * 0.62, 0, r * 0.38, r * 0.32, 0, 0, 6.283); c.fill();
    const eye = opts.berserk ? '#ff1744' : '#ffeb3b'; glowDot(c, r * 0.82, -r * 0.13, r * 0.08, eye); glowDot(c, r * 0.82, r * 0.13, r * 0.08, eye);
    plates();
  }
  // ---------------- 2.6 boss-wave bosses ----------------
  else if (id === 'jammer') {                               // storm jammer: a tracked EW vehicle with a spinning dish and tesla coils
    const L = r * 1.2, Wd = r * 0.68;
    treads(c, L, Wd, r * 0.28);
    c.fillStyle = col; roundRect(c, -L, -Wd, L * 2, Wd * 2, r * 0.15); c.fill();
    c.fillStyle = dk; c.fillRect(-L * 0.95, -Wd * 0.8, L * 0.7, Wd * 1.6);
    c.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 4; i++) c.fillRect(-L * 0.9 + i * L * 0.16, -Wd * 0.7, L * 0.06, Wd * 1.4);
    const hot = opts.phase === 1 ? '#e1f5fe' : '#40c4ff';
    for (const sd of [-1, 1]) { c.fillStyle = '#263238'; c.beginPath(); c.arc(-L * 0.55, sd * Wd * 0.5, r * 0.2, 0, 6.283); c.fill(); glowDot(c, -L * 0.55, sd * Wd * 0.5, r * (opts.phase === 1 ? 0.17 : 0.12), hot); }
    c.save(); c.translate(r * 0.25, 0); c.rotate(t / 25);
    c.fillStyle = '#90a4ae'; c.fillRect(-r * 0.08, -r * 0.08, r * 0.5, r * 0.16);
    c.fillStyle = '#cfd8dc'; c.beginPath(); c.ellipse(r * 0.42, 0, r * 0.2, r * 0.62, 0, 0, 6.283); c.fill();
    c.fillStyle = '#78909c'; c.beginPath(); c.ellipse(r * 0.46, 0, r * 0.1, r * 0.42, 0, 0, 6.283); c.fill(); c.restore();
    c.fillStyle = '#263238'; c.beginPath(); c.arc(r * 0.25, 0, r * 0.18, 0, 6.283); c.fill();
    plates();
  }
  else if (id === 'factory') {                              // war factory: a long tracked factory with smokestacks and a front hatch
    const L = r * 1.6, Wd = r * 0.66;
    treads(c, L, Wd, r * 0.3);
    c.fillStyle = col; c.fillRect(-L, -Wd, L * 2, Wd * 2);
    c.fillStyle = 'rgba(0,0,0,0.2)'; for (let i = 0; i < 5; i++) c.fillRect(-L + i * L * 0.32, -Wd, L * 0.04, Wd * 2);
    c.fillStyle = dk; c.fillRect(-L * 0.2, -Wd * 0.9, L * 0.7, Wd * 1.8);
    for (const sd of [-1, 1]) { c.fillStyle = '#2b2b2b'; c.beginPath(); c.arc(-L * 0.6, sd * Wd * 0.45, r * 0.2, 0, 6.283); c.fill(); c.fillStyle = 'rgba(255,152,0,' + (0.45 + 0.3 * Math.sin(t / 6 + sd)).toFixed(2) + ')'; c.beginPath(); c.arc(-L * 0.6, sd * Wd * 0.45, r * 0.1, 0, 6.283); c.fill(); }
    const open = opts.phase > 0;
    c.fillStyle = open ? '#ffe082' : '#3e2f22'; c.fillRect(L * 0.62, -Wd * 0.55, L * 0.32, Wd * 1.1);
    c.fillStyle = '#f1c40f'; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(L * 0.96, -Wd + i * Wd * 0.5); c.lineTo(L, -Wd + i * Wd * 0.5 + Wd * 0.25); c.lineTo(L * 0.96, -Wd + i * Wd * 0.5 + Wd * 0.5); c.fill(); }
    c.fillStyle = '#212121'; c.fillRect(L * 0.06, -r * 0.1, L * 0.5, r * 0.2);
    c.strokeStyle = '#111'; c.lineWidth = 1; c.strokeRect(-L, -Wd, L * 2, Wd * 2);
    plates();
  }
  else if (id === 'aegis') {                                // aegis walker: a four-legged walker with an armored dome and a shield emitter
    botLegs(c, 2, r * 0.95, r * 0.55, r * 0.42, t, dk, Math.max(3, r * 0.16));
    c.fillStyle = dk; c.beginPath(); c.arc(0, 0, r * 0.82, 0, 6.283); c.fill();
    c.fillStyle = col; c.beginPath(); c.arc(0, 0, r * 0.68, 0, 6.283); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 1.2; hexPath(c, r * 0.48); c.stroke(); hexPath(c, r * 0.26); c.stroke();
    glowDot(c, 0, 0, r * 0.17 + Math.sin(t / 6) * r * 0.02, opts.phase === 9 ? '#ffd54f' : '#82b1ff');
    c.fillStyle = '#22272b'; c.fillRect(r * 0.5, -r * 0.1, r * 0.55, r * 0.2);
    plates();
  }
  else if (id === 'warlord') {                              // warlord: a heavy command tank flying a war banner
    const L = r * 1.25, Wd = r * 0.72;
    treads(c, L, Wd, r * 0.3);
    c.fillStyle = col; roundRect(c, -L, -Wd, L * 2, Wd * 2, r * 0.12); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(-L, -Wd, L * 0.45, Wd * 2);
    c.fillStyle = dk; c.beginPath(); c.arc(-r * 0.05, 0, r * 0.55, 0, 6.283); c.fill();
    c.fillStyle = '#22272b'; c.fillRect(r * 0.3, -r * 0.2, r * 1.15, r * 0.13); c.fillRect(r * 0.3, r * 0.07, r * 1.15, r * 0.13);
    c.fillStyle = '#ffd54f'; c.beginPath(); c.arc(-r * 0.05, 0, r * 0.16, 0, 6.283); c.fill();
    c.strokeStyle = '#cfd8dc'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-L * 0.55, Wd * 0.55); c.lineTo(-L * 0.95, Wd * 1.1); c.stroke();
    // banner on a pole at the back
    const wv = Math.sin(t / 7) * r * 0.12;
    c.fillStyle = '#5d4037'; c.fillRect(-L * 0.7, -Wd * 0.75, r * 0.1, r * 0.1);
    c.fillStyle = '#c62828'; c.beginPath(); c.moveTo(-L * 0.68, -Wd * 0.7); c.lineTo(-L * 1.35, -Wd * 0.95 + wv); c.lineTo(-L * 1.25, -Wd * 0.45 + wv); c.lineTo(-L * 1.4, -Wd * 0.05 + wv); c.lineTo(-L * 0.68, -Wd * 0.25); c.fill();
    c.fillStyle = '#ffd54f'; c.beginPath(); c.arc(-L * 1.0, -Wd * 0.55 + wv * 0.5, r * 0.09, 0, 6.283); c.fill();
    plates();
  }
  else if (id === 'colossus') { mechArt(c, r, col, dk, false, t, opts.flash); plates(); }       // Colossus Mech
  else if (id === 'titan') { mechArt(c, r, col, dk, true, t, opts.flash); }                   // Titan Mech
  else {
    // infantry
    const small = r < 9;
    c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, r * 0.7, r * 0.95, 0, 0, 6.283); c.fill();
    c.strokeStyle = dk; c.lineWidth = Math.max(1, r * 0.1); c.stroke();
    if (id === 'medic') { c.fillStyle = '#fff'; c.fillRect(-r * 0.5, -r * 0.14, r * 0.7, r * 0.28); c.fillRect(-r * 0.25, -r * 0.4, r * 0.28, r * 0.8); }
    c.fillStyle = id === 'commando' ? '#3a2f2a' : '#d7b98e'; c.beginPath(); c.arc(r * 0.05, 0, r * 0.42, 0, 6.283); c.fill();
    c.fillStyle = id === 'medic' ? '#ecf0f1' : id === 'commando' ? '#111' : dk; c.beginPath(); c.arc(0, 0, r * 0.48, 0, 6.283); c.fill();
    if (id === 'assault') { c.fillStyle = '#e74c3c'; c.fillRect(-r * 0.48, -r * 0.1, r * 0.96, r * 0.2); }
    if (id === 'commando') { c.fillStyle = '#e74c3c'; c.fillRect(r * 0.2, -r * 0.4, r * 0.15, r * 0.8); }
    if (id === 'medic') { c.fillStyle = '#e74c3c'; c.fillRect(-r * 0.2, -r * 0.07, r * 0.4, r * 0.14); c.fillRect(-r * 0.07, -r * 0.2, r * 0.14, r * 0.4); }
    if (id === 'assault' && opts.enraged) { c.strokeStyle = '#ff1744'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, r + 3, 0, 6.283); c.stroke(); }
    c.strokeStyle = '#1c1f22'; c.lineWidth = Math.max(1.5, r * 0.16); c.beginPath(); c.moveTo(r * 0.2, r * 0.55); c.lineTo(r * (small ? 1.5 : 1.7), r * 0.55); c.stroke();
  }
  // alien barrier: a hexagonal green-cyan shell
  const bf = opts.barrier != null ? opts.barrier : (def.barrier ? 1 : 0);
  if (bf > 0) {
    c.globalAlpha = 1; c.strokeStyle = 'rgba(132,255,255,' + (0.45 + 0.45 * bf).toFixed(2) + ')'; c.lineWidth = 1.8; hexPath(c, r * 1.45); c.stroke();
    c.fillStyle = 'rgba(100,255,218,' + (0.06 + 0.12 * bf).toFixed(2) + ')'; c.fill();
  }
  if (opts.charmed) { c.strokeStyle = 'rgba(234,128,252,0.9)'; c.lineWidth = 1.6; c.beginPath(); for (let i = 0; i < 3; i++) { const a = t / 6 + i * 2.094; c.moveTo(Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3); c.arc(0, 0, r * 1.3, a, a + 1.2); } c.stroke(); }
  // energy shield bubble (Shielded units, and anything carrying a shield from a variant)
  const shf = opts.shield != null ? opts.shield : (def.shield ? 1 : 0);
  if (shf > 0) {
    const pulse = 0.5 + 0.5 * Math.sin(t / 7);
    c.strokeStyle = 'rgba(110,205,255,' + (0.4 + 0.4 * shf + 0.1 * pulse).toFixed(2) + ')'; c.lineWidth = 1.6; c.beginPath(); c.arc(0, 0, r * 1.38, 0, 6.283); c.stroke();
    c.fillStyle = 'rgba(110,205,255,' + (0.05 + 0.1 * shf).toFixed(2) + ')'; c.fill();
  }
  c.restore();
}

// =====================================================================
//  FRAME RENDER
// =====================================================================
const enemyDrawOpts = {};      // reused every frame (no per-enemy allocations)
function render(now) {
  if (!G) return;
  if (bgDirty || !bg) renderBackground();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b0e12'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  let sx = 0, sy = 0;
  if (G.shake > 0.2) { sx = rand(-G.shake, G.shake); sy = rand(-G.shake, G.shake); G.shake *= 0.85; } else G.shake = 0;
  ctx.drawImage(bg, Math.round(view.dpr * (view.ox + sx * view.scale)), Math.round(view.dpr * (view.oy + sy * view.scale)));
  worldTransform(ctx); if (sx || sy) ctx.translate(sx, sy);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  const t = G.tick;
  // animated path flow
  if (S.pathAnim && !S.reducedMotion) {
    ctx.setLineDash([3, 27]); ctx.lineDashOffset = -(t * 0.6) % 30; ctx.lineCap = 'round';
    for (const p of G.paths) strokePath(ctx, p, 5, 'rgba(255,255,255,0.18)');
    ctx.setLineDash([]); ctx.lineDashOffset = 0;
  }
  // napalm
  for (const p of G.patches) { ctx.fillStyle = (p.rad ? 'rgba(118,255,3,' : p.acid ? 'rgba(198,255,0,' : 'rgba(255,87,34,') + (0.15 + 0.1 * Math.sin(t / 4)) + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill(); }
  // black holes
  for (const h of G.holes) {
    const f = Math.min(1, (h.T - h.t) / 12) * Math.min(1, h.t / 10 + 0.3);
    ctx.fillStyle = 'rgba(18,0,36,' + (0.38 * f).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, 6.283); ctx.fill();
    ctx.fillStyle = 'rgba(18,0,36,' + (0.35 * f).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(h.x, h.y, h.r * 0.45, 0, 6.283); ctx.fill();
    ctx.strokeStyle = 'rgba(179,136,255,' + (0.8 * f).toFixed(2) + ')'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { const a = -t / 8 + i * 1.571; ctx.beginPath(); ctx.arc(h.x, h.y, h.r * (0.35 + 0.15 * i), a, a + 1.6); ctx.stroke(); }
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(h.x, h.y, Math.min(16, h.r * 0.14), 0, 6.283); ctx.fill();
  }
  // aura circles (always faintly visible)
  for (const g of G.towers) if (g.def.kind === 'aura' || g.def.kind === 'heal') {
    const R = g.units[0].stats.range * (g.def.kind === 'heal' ? g.buff.range : 1);
    ctx.fillStyle = g.def.aura === 'cryo' ? 'rgba(129,236,236,0.10)' : g.def.aura === 'radar' ? 'rgba(162,155,254,0.07)' : g.def.aura === 'cpost' ? 'rgba(230,126,34,0.06)' : 'rgba(255,255,255,0.035)';
    ctx.beginPath(); ctx.arc(g.x, g.y, R, 0, 6.283); ctx.fill();
  }
  // ranges: selected, hovered, or all
  const showRange = (g, strong) => {
    if (!g.def.range || g.def.kind === 'income' || g.def.kind === 'mine' || g.def.kind === 'tank' || g.def.kind === 'hq') return;
    const R = g.range(); if (!R) return; ctx.fillStyle = strong ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.04)'; ctx.strokeStyle = strong ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(g.x, g.y, R, 0, 6.283); ctx.fill(); ctx.stroke();
    const mr = g.units[0].stats.minRange; if (mr) { ctx.fillStyle = 'rgba(231,76,60,0.15)'; ctx.beginPath(); ctx.arc(g.x, g.y, mr, 0, 6.283); ctx.fill(); }
  };
  if (G.showRanges) for (const g of G.towers) showRange(g, false);
  for (const g of G.sel.towers) if (!G.moveMode) showRange(g, true);
  if (S.hoverRange && hover.tower && !G.sel.towers.has(hover.tower)) showRange(hover.tower, false);
  // barracks rally flags
  for (const g of G.sel.towers) if (g.rally) { ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(g.rally.x, g.rally.y); ctx.stroke(); ctx.setLineDash([]); }
  // towers
  for (const g of G.towers) {
    if (G.moveMode && G.moveMode.towers.includes(g)) ctx.globalAlpha = 0.35;
    const lvl = g.level, spec = g.units[0].spec;
    drawTowerArt(ctx, g.def, g.x, g.y, 1, g.angle, g.recoil, lvl, spec, t);
    if (g.redeploy > 0) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.arc(g.x, g.y, 14, -1.57, -1.57 + 6.283 * (g.redeploy / 90)); ctx.fill(); }
    ctx.globalAlpha = 1;
    if (isStructure(g.def) && g.hp < g.maxHp) hpBar(g.x, g.y - 16, 30, g.hp / g.maxHp, '#2ecc71');
    if (g.auto) { ctx.globalAlpha = 1; if (g.life > 0) { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(g.x, g.y, 20, -1.57, -1.57 + 6.283 * g.life / (40 * TPS)); ctx.stroke(); } continue; }
    if (g.def.kind !== 'income' && !g.def.endless) { for (let i = 0; i < Math.min(5, lvl); i++) { ctx.fillStyle = '#ffd54f'; ctx.fillRect(g.x - 11 + i * 5, g.y + 11, 3.5, 3); } }
    else if (g.def.endless && lvl > 1) { ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd54f'; ctx.fillText('L' + lvl, g.x, g.y + 14); }
    if (spec) { ctx.fillStyle = '#ffd54f'; star(ctx, g.x + 12, g.y - 12, 5); }
    if (g.disabledT > 0) {        // knocked out by a Flying Saucer's tractor beam (green) or a Storm Jammer's pulse (blue)
      const jam = g.dsc === '#40c4ff';
      ctx.fillStyle = (jam ? 'rgba(64,196,255,' : 'rgba(178,255,89,') + (0.16 + 0.08 * Math.sin(t / 3)).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(g.x, g.y, 19, 0, 6.283); ctx.fill();
      ctx.strokeStyle = jam ? '#40c4ff' : '#b2ff59'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(g.x - 12, g.y - 6); ctx.lineTo(g.x - 4, g.y + 2); ctx.lineTo(g.x + 3, g.y - 5); ctx.lineTo(g.x + 11, g.y + 4); ctx.stroke();
    }
    if (g.def.manual && g.units[0].stats.mods.charges) { ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(g.units[0].stock + '/' + g.units[0].stats.mods.charges, g.x, g.y + 24); }
    if (g.units.length > 1) { ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText('x' + g.units.length, g.x + 15, g.y - 13); ctx.fillStyle = '#fff'; ctx.fillText('x' + g.units.length, g.x + 15, g.y - 13); }
    if (g.def.manual && g.units[0].stock > 0) { ctx.strokeStyle = 'rgba(255,215,0,' + (0.5 + 0.5 * Math.sin(t / 8)) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(g.x, g.y, 20, 0, 6.283); ctx.stroke(); }
    if (G.sel.towers.has(g)) { ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 2; roundRect(ctx, g.x - 19, g.y - 19, 38, 38, 7); ctx.stroke(); }
  }
  // Over the Top! (hero aura)
  if (G.hero && G.hero.hp > 0 && G.heroAura > 0) { ctx.strokeStyle = 'rgba(255,213,79,' + (0.35 + 0.2 * Math.sin(t / 6)).toFixed(2) + ')'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc(G.hero.x, G.hero.y, 220, 0, 6.283); ctx.stroke(); ctx.setLineDash([]); }
  // troops
  for (const tr of G.troops) {
    if (tr.hp <= 0) continue;
    if (G.moveMode && G.moveMode.troops.includes(tr)) ctx.globalAlpha = 0.6;
    if (tr.kind === 'tank') { ctx.save(); ctx.translate(tr.x, tr.y); ctx.rotate(tr.angle); drawTankBody(ctx, (tr.turret || tr.angle) - tr.angle); ctx.restore(); }
    else if (tr.hero) {
      const lift = tr.lift || 0;
      ctx.fillStyle = 'rgba(255,213,79,0.18)'; ctx.strokeStyle = 'rgba(255,213,79,0.95)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(tr.x, tr.y + tr.r * 0.7, tr.r + 5, (tr.r + 5) * 0.45, 0, 0, 6.283); ctx.fill(); ctx.stroke();
      if (tr.hullT > 0 || tr.overT > 0) { ctx.strokeStyle = tr.overT > 0 ? 'rgba(24,255,255,0.8)' : 'rgba(207,216,220,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(tr.x, tr.y - lift, tr.r + 6 + Math.sin(t / 4), 0, 6.283); ctx.stroke(); }
      drawTroopFigure(ctx, tr.look, tr.x, tr.y - lift, tr.r * 1.25, tr.angle, tr.color, tr.flash > 0, t);
      const bx = tr.x - tr.r - 7, by = tr.y + tr.r * 0.5 - lift;
      ctx.fillStyle = '#1a1206'; ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(bx, by, 6, 0, 6.283); ctx.fill(); ctx.stroke();
      ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffd54f'; ctx.fillText(tr.lvl, bx, by + 0.5); ctx.textBaseline = 'alphabetic';
      if (tr.pets) for (const p of tr.pets) drawTroopFigure(ctx, 'drone', p.x, p.y, 5, p.a + 1.57, '#b0bec5', false, t);
    }
    else {
      if (tr.merc) { ctx.strokeStyle = 'rgba(255,213,79,0.75)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.ellipse(tr.x, tr.y + tr.r * 0.7, tr.r + 3, (tr.r + 3) * 0.42, 0, 0, 6.283); ctx.stroke(); }
      drawTroopFigure(ctx, tr.look, tr.x, tr.y, tr.r, tr.angle, tr.color, tr.flash > 0, t);
      if (tr.life0) { ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(tr.x, tr.y, tr.r + 2.5, -1.57, -1.57 + 6.283 * Math.max(0, tr.life) / tr.life0); ctx.stroke(); }
      if (tr.bd > 1.001 || tr.bg < 0.999) { ctx.fillStyle = tr.bg < 0.999 ? '#74b9ff' : '#ffb74d'; ctx.fillRect(tr.x - 2, tr.y - tr.r - 12, 4, 2); }
    }
    ctx.globalAlpha = 1;
    if (tr.stunT > 0) { ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 1.5; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.arc(tr.x, tr.y - tr.r - 3, 5, t / 4, t / 4 + 5); ctx.stroke(); ctx.setLineDash([]); }
    if (G.sel.troops.has(tr)) { ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(tr.x, tr.y + 3, tr.r + 6, (tr.r + 6) * 0.6, 0, 0, 6.283); ctx.stroke(); }
    if (tr.hp < tr.maxHp || G.sel.troops.has(tr)) hpBar(tr.x, tr.y - tr.r - 6, tr.kind === 'tank' ? 28 : Math.max(16, tr.r * 2), tr.hp / tr.maxHp, '#2ecc71');
    if (tr.order && G.sel.troops.has(tr)) { ctx.strokeStyle = 'rgba(46,204,113,0.5)'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(tr.x, tr.y); ctx.lineTo(tr.order.x, tr.order.y); ctx.stroke(); ctx.setLineDash([]); }
  }
  // enemies (ground first, then air above everything)
  for (let pass = 0; pass < 2; pass++) for (const e of G.enemies) {
    if (!e.alive || (pass === 0) === e.air) continue;
    const hidden = e.def.stealth && e.revealedT <= 0;
    const eo = enemyDrawOpts; eo.flash = e.flash > 0; eo.t = t; eo.burrowed = e.burrowed; eo.enraged = e.def.enrage && e.hp < e.maxHp * 0.5; eo.alpha = hidden ? 0.3 : null;
    eo.shield = e.maxShield > 0 && e.shield > 0 ? e.shield / e.maxShield : 0; eo.barrier = e.maxBarrier > 0 && e.barrier > 0 ? Math.min(1, e.barrier / e.maxBarrier) : 0;
    eo.charging = !!e.def.warp && e.warpT <= 60 && !e.jam; eo.charmed = e.charmT > 0; eo.berserk = !!e.def.berserk && e.barrier <= 0;
    eo.phase = e.def.boss ? (e.def.aegis && e.stunT > 0 ? 9 : e.bossPh) : 0;
    if (e.def.boss) drawBossFx(e, t);
    drawEnemyArt(ctx, e.def, e.x, e.y, e.r, e.angle, eo);
    if (e.rallyT > 0) { ctx.fillStyle = '#ff7043'; ctx.beginPath(); ctx.moveTo(e.x - 4, e.y - e.r - 15); ctx.lineTo(e.x, e.y - e.r - 20); ctx.lineTo(e.x + 4, e.y - e.r - 15); ctx.closePath(); ctx.fill(); }
    if (e.affix) { ctx.strokeStyle = e.affix.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 3, 0, 6.283); ctx.stroke(); }
    if (e.stunT > 0) { ctx.fillStyle = 'rgba(165,216,255,0.45)'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 2, 0, 6.283); ctx.fill(); }
    else if ((e.slowT > 0 || e.slowAura > 0 || G.freezeSlowT > 0) && !e.def.noSlow) { ctx.strokeStyle = 'rgba(116,185,255,0.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 1, 0, 6.283); ctx.stroke(); }
    if (e.poison) { ctx.fillStyle = 'rgba(108,92,231,0.35)'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 6.283); ctx.fill(); }
    if (e.burn && Math.random() < 0.25) burst(e.x + rand(-e.r, e.r) * 0.5, e.y, '#ff7043', 1, 0.5, 2, 12);
    if (e.markT > 0 || e.brittleT > 0) { ctx.strokeStyle = '#d6a2ff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 5, 0, 6.283); ctx.stroke(); }
    if (S.healthBars !== 'off' && !e.burrowed && (S.healthBars === 'always' || e.hp < e.maxHp || e.shield < e.maxShield || e.barrier < e.maxBarrier || e.def.boss)) {
      const bw = Math.max(18, e.r * 2); hpBar(e.x, e.y - e.r - 7, bw, e.hp / e.maxHp, e.charmT > 0 ? '#ea80fc' : e.def.boss ? '#e74c3c' : '#2ecc71');
      if (e.maxShield > 0 && e.shield > 0) { ctx.fillStyle = '#74b9ff'; ctx.fillRect(e.x - bw / 2, e.y - e.r - 10, bw * e.shield / e.maxShield, 2); }
      if (e.maxBarrier > 0) { ctx.fillStyle = e.barrier > 0 ? '#84ffff' : 'rgba(132,255,255,0.3)'; ctx.fillRect(e.x - bw / 2, e.y - e.r - 12, e.barrier > 0 ? bw * Math.min(1, e.barrier / e.maxBarrier) : bw * (1 - e.barrierDownT / 300), 2); }
    }
  }
  // projectiles
  const glow = S.glow;
  for (const p of G.projectiles) {
    if (S.trails && p.trail && p.trail.length >= 4) { ctx.strokeStyle = p.color; ctx.globalAlpha = 0.35; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.trail[0], p.trail[1]); for (let i = 2; i < p.trail.length; i += 2) ctx.lineTo(p.trail[i], p.trail[i + 1]); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.globalAlpha = 1; }
    if (p.kind === 'lob') { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 6.283); ctx.fill(); ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.arc(p.x, p.y - p.h, 5, 0, 6.283); ctx.fill(); continue; }
    if (p.kind === 'missile' && p.bug) {     // Swarm Hive bio-drone: a little winged bug
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx)); ctx.fillStyle = 'rgba(220,237,200,0.7)'; const fl = Math.sin(t + p.life) * 2;
      ctx.beginPath(); ctx.ellipse(-1, -3, 3, 1.6 + fl * 0.3, -0.5, 0, 6.283); ctx.ellipse(-1, 3, 3, 1.6 - fl * 0.3, 0.5, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#558b2f'; ctx.beginPath(); ctx.ellipse(0, 0, 4.5, 2.2, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = '#eeff41'; ctx.fillRect(3, -1, 1.6, 2); ctx.restore(); continue; }
    if (p.kind === 'missile') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx)); ctx.fillStyle = '#ecf0f1'; ctx.fillRect(-6, -2, 10, 4); ctx.fillStyle = '#e74c3c'; ctx.fillRect(3, -2, 3, 4); ctx.restore(); continue; }
    if (p.shard) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.ty - p.y, p.tx - p.x)); ctx.fillStyle = '#64ffda'; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-2, -2.5); ctx.lineTo(-4, 0); ctx.lineTo(-2, 2.5); ctx.closePath(); ctx.fill(); ctx.restore(); continue; }
    if (glow) { ctx.shadowColor = p.color; ctx.shadowBlur = 8; }
    ctx.fillStyle = p.kind === 'poison' ? '#a29bfe' : p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.aoe ? 4.5 : 3, 0, 6.283); ctx.fill();
    if (glow) ctx.shadowBlur = 0;
  }
  // beams
  for (const b of G.beams) {
    let x2 = b.x2, y2 = b.y2; if (b.pierce) { x2 = b.x1 + Math.cos(b.a) * b.len; y2 = b.y1 + Math.sin(b.a) * b.len; }
    if (glow) { ctx.shadowColor = b.color; ctx.shadowBlur = 12; }
    ctx.strokeStyle = b.color; ctx.lineWidth = b.w + Math.sin(t / 2); ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(x2, y2); ctx.stroke();
    if (glow) ctx.shadowBlur = 0;
  }
  // lines, rings, lightning
  for (const l of G.lines) {
    const a = l.life / l.ml; ctx.globalAlpha = a;
    if (l.ring) { ctx.strokeStyle = l.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(l.x, l.y, l.r * (1.1 - a * 0.3), 0, 6.283); ctx.stroke(); }
    else { ctx.strokeStyle = l.color; ctx.lineWidth = l.w || 2; ctx.beginPath(); ctx.moveTo(l.x1, l.y1);
      if (l.zig) { const n = 4; for (let i = 1; i < n; i++) ctx.lineTo(l.x1 + (l.x2 - l.x1) * i / n + rand(-6, 6), l.y1 + (l.y2 - l.y1) * i / n + rand(-6, 6)); }
      ctx.lineTo(l.x2, l.y2); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  // airstrike / nuke markers
  for (const s of G.strikes) { ctx.strokeStyle = s.nuke ? (s.small ? 'rgba(255,138,101,0.8)' : 'rgba(255,82,82,0.9)') : 'rgba(255,152,0,0.7)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(s.x, s.y, s.r * (s.nuke ? 1 : 0.6), 0, 6.283); ctx.stroke(); ctx.setLineDash([]); }
  // particles
  for (const p of parts) { ctx.globalAlpha = Math.max(0, p.l / p.ml); ctx.fillStyle = p.c; ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); }
  ctx.globalAlpha = 1;
  // floating text
  ctx.textAlign = 'center';
  for (const f of G.texts) { ctx.globalAlpha = Math.min(1, f.life / 20); ctx.font = f.big ? 'bold 15px sans-serif' : 'bold 11px sans-serif'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); }
  ctx.globalAlpha = 1;
  drawCursorOverlays();
  ctx.restore();
  drawBossBar();
}
// ---- BOSS HEALTH BAR (2.6): the biggest boss on the field, drawn in screen space across the top of the board ----
let bossBarOn = false;
function drawBossBar() {
  let b = null, n = 0;
  for (const e of G.enemies) if (e.alive && e.def.boss) { n++; if (!b || e.maxHp > b.maxHp) b = e; }
  if (!!b !== bossBarOn) { bossBarOn = !!b; $('stage').classList.toggle('bossbar', bossBarOn); }
  if (!b) return;
  const d = b.def, cw = view.cw, w = Math.min(560, cw - 32), x = (cw - w) / 2, y = 8, h = 12;
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.fillStyle = 'rgba(10,12,16,0.78)'; roundRect(ctx, x - 10, y - 4, w + 20, 46, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,82,82,0.55)'; ctx.lineWidth = 1; ctx.stroke();
  // name, trick status, numbers
  let st = '';
  if (d.steam) st = b.bossPh === 2 ? 'FULL STEAM!' : b.bossPh === 1 ? 'Building steam...' : 'Charge in ' + Math.ceil(b.bossT / TPS) + 's';
  else if (d.stomp) st = b.bossK >= 2 ? 'Enraged' : 'Stomps at ' + (b.bossK ? '33%' : '66%');
  else if (d.jammer) st = b.jam > 0 ? 'Jammed' : b.bossPh === 1 ? 'EMP CHARGING!' : 'EMP pulse in ' + Math.ceil(b.bossT / TPS) + 's';
  else if (d.factory) st = 'Escorts in ' + Math.ceil(b.bossT / TPS) + 's';
  else if (d.aegis) st = b.shield > 0 ? 'Shield ' + Math.round(100 * b.shield / b.maxShield) + '%' : b.bossLock > 0 ? 'Shield offline' : b.stunT > 0 ? 'OVERLOADED' : 'Shield recharging';
  else if (d.warlord) st = 'Rallying ' + b.bossK + ' enem' + (b.bossK === 1 ? 'y' : 'ies');
  else if (b.maxBarrier > 0) st = b.barrier > 0 ? 'Barrier up' : 'Barrier DOWN';
  ctx.textBaseline = 'middle'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#ff8a80';
  ctx.fillText(d.name.toUpperCase() + (n > 1 ? '  x' + n : '') + (d.trick ? '  \u00b7  ' + d.trick : ''), x, y + 6);
  ctx.textAlign = 'right'; ctx.fillStyle = st.indexOf('!') >= 0 || st === 'OVERLOADED' || st === 'Barrier DOWN' ? '#ffd54f' : '#cfd8dc'; ctx.font = 'bold 11px sans-serif';
  ctx.fillText(st, x + w, y + 6);
  const by = y + 16, f = clamp(b.hp / b.maxHp, 0, 1);
  ctx.fillStyle = '#2a1214'; ctx.fillRect(x, by, w, h);
  ctx.fillStyle = b.charmT > 0 ? '#ea80fc' : '#e53935'; ctx.fillRect(x, by, w * f, h);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, by, w * f, 3);
  if (b.maxShield > 0 && b.shield > 0) { ctx.fillStyle = 'rgba(116,185,255,0.9)'; ctx.fillRect(x, by + h - 4, w * clamp(b.shield / b.maxShield, 0, 1), 4); }
  if (b.maxBarrier > 0 && b.barrier > 0) { ctx.fillStyle = 'rgba(132,255,255,0.9)'; ctx.fillRect(x, by, w * clamp(b.barrier / b.maxBarrier, 0, 1), 4); }
  // phase marks: Titan stomps, War Factory tank drops
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  if (d.stomp || d.factory) for (const m of d.stomp ? STOMP_AT : FACTORY_TANK_AT) ctx.fillRect(x + w * m - 1, by - 2, 2, h + 4);
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.strokeRect(x + 0.5, by + 0.5, w - 1, h - 1);
  const hpTxt = fmt(b.hp) + ' / ' + fmt(b.maxHp) + (b.shield > 0 ? '  +' + fmt(b.shield) + ' shield' : '') + (b.barrier > 0 ? '  +' + fmt(b.barrier) + ' barrier' : '');
  ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(hpTxt, x + w / 2, by + h / 2 + 0.5); ctx.fillStyle = '#fff'; ctx.fillText(hpTxt, x + w / 2, by + h / 2 + 0.5);
  ctx.textBaseline = 'alphabetic';
}
// boss tricks you can see coming: the jammer's danger zone and charge ring, the warlord's banner circle, a ramming train, an enraged titan
function drawBossFx(e, t) {
  const d = e.def;
  if (d.jammer) {
    ctx.strokeStyle = 'rgba(64,196,255,0.28)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.arc(e.x, e.y, 160, 0, 6.283); ctx.stroke(); ctx.setLineDash([]);
    if (e.bossPh === 1) { const f = clamp(1 - e.bossT / 60, 0, 1); ctx.fillStyle = 'rgba(64,196,255,' + (0.05 + 0.1 * f).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(e.x, e.y, 160 * f, 0, 6.283); ctx.fill(); ctx.strokeStyle = 'rgba(128,216,255,' + (0.5 + 0.5 * f).toFixed(2) + ')'; ctx.lineWidth = 3; ctx.stroke(); }
  } else if (d.warlord) {
    ctx.strokeStyle = 'rgba(255,112,67,0.35)'; ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 0.5; ctx.beginPath(); ctx.arc(e.x, e.y, 150, 0, 6.283); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
  } else if (d.steam && e.bossPh === 2) {
    const bx = -Math.cos(e.angle), by = -Math.sin(e.angle), nx = -by, ny = bx; ctx.strokeStyle = 'rgba(255,171,64,0.6)'; ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) { const o = i * 9, k = 20 + ((t * 3 + i * 7) % 18); ctx.beginPath(); ctx.moveTo(e.x + bx * e.r + nx * o, e.y + by * e.r + ny * o); ctx.lineTo(e.x + bx * (e.r + k) + nx * o, e.y + by * (e.r + k) + ny * o); ctx.stroke(); }
  } else if (d.stomp && e.bossK > 0) {
    ctx.strokeStyle = 'rgba(255,82,82,' + (0.35 + 0.25 * Math.sin(t / 5)).toFixed(2) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 8, 0, 6.283); ctx.stroke();
  } else if (d.aegis && e.bossLock > 0) {
    ctx.strokeStyle = 'rgba(255,213,79,0.6)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 1.38, 0, 6.283); ctx.stroke(); ctx.setLineDash([]);
  }
}
function hpBar(x, y, w, f, color) { f = clamp(f, 0, 1); ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 5); ctx.fillStyle = f > 0.5 ? color : f > 0.25 ? '#f39c12' : '#e74c3c'; ctx.fillRect(x - w / 2, y, w * f, 3); }
function star(c, x, y, r) { c.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill(); }
function drawCursorOverlays() {
  const m = mouse; if (!m.in) return;
  const x = m.wx, y = m.wy;
  if (G.place) {
    const def = TOWER[G.place];
    const stackOn = def.stack ? towerAt(x, y, def.id) : null;
    const px = stackOn ? stackOn.x : x, py = stackOn ? stackOn.y : y;
    const err = stackOn ? null : placementError(G, def, x, y);
    const st = levelStats(def, 1, 0);
    if (st.range && def.kind !== 'income') { ctx.fillStyle = err ? 'rgba(231,76,60,0.15)' : 'rgba(46,204,113,0.13)'; ctx.strokeStyle = err ? 'rgba(231,76,60,0.6)' : 'rgba(46,204,113,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(px, py, st.range, 0, 6.283); ctx.fill(); ctx.stroke(); }
    if (st.minRange) { ctx.fillStyle = 'rgba(231,76,60,0.2)'; ctx.beginPath(); ctx.arc(px, py, st.minRange, 0, 6.283); ctx.fill(); }
    ctx.globalAlpha = 0.6; drawTowerArt(ctx, def, px, py, 1, -Math.PI / 2, 0, 1, 0, G.tick); ctx.globalAlpha = 1;
    if (err) { ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px - 10, py - 10); ctx.lineTo(px + 10, py + 10); ctx.moveTo(px + 10, py - 10); ctx.lineTo(px - 10, py + 10); ctx.stroke(); }
    if (stackOn) { ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#2ecc71'; ctx.fillText('+ stack', px, py - 24); }
  }
  if (G.placeMerc) {
    const m = MERC[G.placeMerc], err = mercPlaceError(x, y) || mercError(m);
    ctx.strokeStyle = err ? 'rgba(231,76,60,0.8)' : 'rgba(255,213,79,0.9)'; ctx.fillStyle = err ? 'rgba(231,76,60,0.12)' : 'rgba(255,213,79,0.12)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.arc(x, y, 26 + m.n * 4, 0, 6.283); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 0.75; for (let i = 0; i < m.n; i++) { const off = formationOffset(i, m.n); drawTroopFigure(ctx, m.look, x + off.x, y + off.y, m.r, -0.5, m.color, false, G.tick); } ctx.globalAlpha = 1;
    ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; const msg = err ? err : 'Click to drop ' + m.name; ctx.strokeText(msg, x, y - 34 - m.n * 3); ctx.fillStyle = err ? '#ff8a80' : '#ffd54f'; ctx.fillText(msg, x, y - 34 - m.n * 3);
  }
  if (G.moveMode) {
    const mm = G.moveMode;
    for (const g of mm.towers) { const nx = x + g.ox, ny = y + g.oy, err = placementError(G, g.def, nx, ny, g); ctx.globalAlpha = 0.6; drawTowerArt(ctx, g.def, nx, ny, 1, g.angle, 0, 1, 0, G.tick); ctx.globalAlpha = 1; ctx.strokeStyle = err ? '#e74c3c' : '#2ecc71'; ctx.lineWidth = 2; roundRect(ctx, nx - 18, ny - 18, 36, 36, 6); ctx.stroke(); }
    for (const tr of mm.troops) { ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x + tr.ox, y + tr.oy, 6, 0, 6.283); ctx.stroke(); }
  }
  if (G.aim) { ctx.strokeStyle = '#ff5252'; ctx.lineWidth = 2; const g = G.aim; if (g.def.kind === 'rail') { ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(g.x, g.y); const a = Math.atan2(y - g.y, x - g.x); ctx.lineTo(g.x + Math.cos(a) * 2000, g.y + Math.sin(a) * 2000); ctx.stroke(); ctx.setLineDash([]); } else { ctx.beginPath(); ctx.arc(x, y, g.units[0].stats.aoe, 0, 6.283); ctx.stroke(); } }
  if (G.placeHero) {
    const Hd = HERO[G.placeHero], err = heroPlaceError(x, y);
    ctx.fillStyle = err ? 'rgba(231,76,60,0.12)' : 'rgba(255,213,79,0.10)'; ctx.strokeStyle = err ? 'rgba(231,76,60,0.7)' : 'rgba(255,213,79,0.75)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x, y, Hd.role === 'melee' ? (Hd.leash || 80) : Hd.range, 0, 6.283); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 0.8; drawTroopFigure(ctx, Hd.look, x, y, Hd.r, -0.5, Hd.color, false, G.tick); ctx.globalAlpha = 1;
    ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; const msg = err || 'Click to deploy ' + Hd.name; ctx.strokeText(msg, x, y - 28); ctx.fillStyle = err ? '#ff8a80' : '#ffd54f'; ctx.fillText(msg, x, y - 28);
  }
  if (G.armed && G.armed.startsWith('hero') && G.hero) {
    const h = G.hero, A = HERO[h.heroId].abil[+G.armed[4]];
    ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
    if (A.aim === 'line') { const a = Math.atan2(y - h.y, x - h.x); ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(h.x + Math.cos(a) * 500, h.y + Math.sin(a) * 500); ctx.stroke(); }
    else if (A.aim === 'enemy') { const e = enemyNear(x, y, 40); ctx.beginPath(); if (e) ctx.arc(e.x, e.y, e.r + 8, 0, 6.283); else ctx.arc(x, y, 12, 0, 6.283); ctx.stroke(); }
    else { if (A.id === 'jump') { ctx.strokeStyle = 'rgba(128,216,255,0.5)'; ctx.beginPath(); ctx.arc(h.x, h.y, 360, 0, 6.283); ctx.stroke(); ctx.strokeStyle = dist(x, y, h.x, h.y) > 360 ? '#ff5252' : '#ffd54f'; }
      ctx.beginPath(); ctx.arc(x, y, A.aim, 0, 6.283); ctx.stroke(); }
    ctx.setLineDash([]);
  } else if (G.armed) { ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(x, y, G.armed === 'strike' ? 120 : G.armed === 'reinforce' ? 30 : 60, 0, 6.283); ctx.stroke(); ctx.setLineDash([]); }
  if (drag.active && drag.box) { const a = drag.sx, b = drag.sy; ctx.fillStyle = 'rgba(46,204,113,0.1)'; ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = 1; ctx.fillRect(Math.min(a, x), Math.min(b, y), Math.abs(x - a), Math.abs(y - b)); ctx.strokeRect(Math.min(a, x), Math.min(b, y), Math.abs(x - a), Math.abs(y - b)); }
}
function stepVisuals() {
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx; p.y += p.vy; p.vx *= 0.94; p.vy *= 0.94; if (--p.l <= 0) { parts[i] = parts[parts.length - 1]; parts.pop(); partPool.push(p); } }
  for (let i = G.texts.length - 1; i >= 0; i--) { const f = G.texts[i]; f.y -= f.big ? 0.4 : 0.6; if (--f.life <= 0) G.texts.splice(i, 1); }
  for (let i = G.lines.length - 1; i >= 0; i--) if (--G.lines[i].life <= 0) G.lines.splice(i, 1);
}
// little standalone canvases for the shop / codex
function iconCanvas(drawFn, size) {
  const c = document.createElement('canvas'), k = Math.min(2, window.devicePixelRatio || 1);
  c.width = size * k; c.height = size * k; const x = c.getContext('2d'); x.scale(k, k); drawFn(x, size); return c;
}
function troopIcon(look, color, size = 26) { return iconCanvas((c, s) => { if (look === 'tank') { c.translate(s / 2, s / 2); c.scale(s / 44, s / 44); drawTankBody(c, 0); } else drawTroopFigure(c, look, s / 2, s / 2, s * 0.26, -0.5, color, false, 0); }, size); }
function towerIcon(def, size = 26) { return iconCanvas((c, s) => drawTowerArt(c, def, s / 2, s / 2, s / 36, -Math.PI / 4, 0, 1, 0, 0), size); }
function enemyIcon(def, size = 26) { return iconCanvas((c, s) => drawEnemyArt(c, def, s / 2, s / 2, Math.min(def.r, s * 0.38), 0, { t: 0 }), size); }
