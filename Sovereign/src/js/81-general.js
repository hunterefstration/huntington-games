// ==========================================
// GENERAL WAR: lead one battle on a front yourself. You are a general with your own unit (move with WASD, aim with
// the mouse, click or Space to fire), four friendly units that take your orders, and artillery on call.
// Take the town (stand in the circle until it is yours) or wipe out the enemy. Win and the front moves your way and
// the enemy's will to fight drops; lose and it goes the other way. One battle per war every 30 days.
// ==========================================
const General = {
  B: null,
  can(w) { return !w.genT || G.day >= w.genT; },
  start(w) {
    if (!w || !this.can(w)) { toast('Your army needs time to regroup (one battle every 30 days).'); return; }
    const me = G.player.idx, mine = w.a.includes(me), enemy = mine ? w.d[0] : w.a[0];
    const pw = landPower(G.nations[me]), pe = landPower(G.nations[enemy]), ratio = clamp(pe / Math.max(0.01, pw), 0.4, 2.5);
    const city = (frontCity(w) || capitalOf(enemy)).name || 'the town';
    Clock.pause();
    const W = 1400, H = 820, r = makeRng(G.seed + G.day + w.id * 7);
    const B = this.B = { w, me, enemy, mine, city, W, H, t: 0, over: false, cap: 0, keys: {}, mouse: { x: W * 0.5, y: H * 0.5, down: false }, art: 0, order: 'follow',
      units: [], shots: [], fx: [], trees: [], msg: '', msgT: 0 };
    // terrain: a river with two bridges, forests, the town on the enemy side
    B.river = W * 0.5 + (r() - 0.5) * 120; B.bridges = [H * (0.22 + r() * 0.15), H * (0.62 + r() * 0.15)];
    B.town = { x: W * (0.78 + r() * 0.08), y: H * (0.3 + r() * 0.4), r: 90 };
    for (let i = 0; i < 26; i++) B.trees.push({ x: r() * W, y: r() * H, r: 26 + r() * 40 });
    B.trees = B.trees.filter(t => Math.abs(t.x - B.river) > t.r + 30 && Math.hypot(t.x - B.town.x, t.y - B.town.y) > B.town.r + t.r);
    const unit = (side, kind, x, y, you) => ({ side, kind, x, y, you: !!you, hp: kind === 'tank' ? 140 : kind === 'art' ? 70 : 90, max: kind === 'tank' ? 140 : kind === 'art' ? 70 : 90,
      sp: kind === 'tank' ? 70 : kind === 'art' ? 32 : 46, range: kind === 'tank' ? 190 : kind === 'art' ? 420 : 150, rof: kind === 'tank' ? 1.6 : kind === 'art' ? 4 : 0.7, dmg: kind === 'tank' ? 26 : kind === 'art' ? 30 : 7, cd: r() * 1.5, ang: 0 });
    const you = unit('us', 'tank', W * 0.1, H * 0.5, true); you.hp = you.max = 280; you.dmg = 34; B.units.push(you);       // the general's own unit is tougher
    ['inf', 'inf', 'tank', 'art'].forEach((k, i) => B.units.push(unit('us', k, W * (0.06 + r() * 0.08), H * (0.18 + i * 0.2))));
    const nEnemy = Math.round(3 + ratio * 1.6);
    for (let i = 0; i < nEnemy; i++) { const k = i % 4 === 3 ? 'tank' : i === 5 ? 'art' : 'inf'; const a = r() * 6.28, d = 40 + r() * 140; B.units.push(unit('them', k, clamp(B.town.x + Math.cos(a) * d, B.river + 60, W - 20), clamp(B.town.y + Math.sin(a) * d, 20, H - 20))); }
    for (const u of B.units) if (u.side === 'them') { u.hp *= 0.85 + ratio * 0.1; u.max = u.hp; }
    this.mount();
    this.say('Battle of ' + city + ': take the town or destroy the enemy. 1 Hold · 2 Follow me · 3 Attack · Q artillery');
  },
  mount() {
    const B = this.B;
    const el = document.createElement('div'); el.id = 'genwar';
    el.innerHTML = `<canvas id="gw-cv"></canvas><div id="gw-top"><b>⚔ Battle of ${esc(B.city)}</b><span id="gw-info"></span><button class="btn small" id="gw-quit">Retreat</button></div><div id="gw-msg"></div>`;
    document.body.appendChild(el);
    const cv = $('#gw-cv'), x = cv.getContext('2d'); B.cv = cv; B.x = x;
    const fit = () => { cv.width = innerWidth; cv.height = innerHeight; B.k = Math.min(cv.width / B.W, (cv.height - 40) / B.H); B.ox = (cv.width - B.W * B.k) / 2; B.oy = 40 + (cv.height - 40 - B.H * B.k) / 2; };
    fit(); B.onResize = fit; addEventListener('resize', fit);
    const toWorld = e => ({ x: (e.clientX - B.ox) / B.k, y: (e.clientY - B.oy) / B.k });
    cv.addEventListener('pointermove', e => Object.assign(B.mouse, toWorld(e)));
    cv.addEventListener('pointerdown', e => { Object.assign(B.mouse, toWorld(e)); B.mouse.down = true; });
    addEventListener('pointerup', B.onUp = () => { B.mouse.down = false; });
    B.onKey = e => { if (!this.B) return; const k = e.code; if (e.type === 'keydown') { B.keys[k] = true; if (k === 'Digit1') this.orderAll('hold'); if (k === 'Digit2') this.orderAll('follow'); if (k === 'Digit3') this.orderAll('attack'); if (k === 'KeyQ') this.artillery(); if (k === 'Escape') this.end(false, 'You pulled your forces back.'); } else B.keys[k] = false; e.stopPropagation(); if (/^(Space|Arrow|Key[WASDQ]|Digit)/.test(k)) e.preventDefault(); };
    addEventListener('keydown', B.onKey, true); addEventListener('keyup', B.onKey, true);
    $('#gw-quit').onclick = () => this.end(false, 'You pulled your forces back.');
    B.last = performance.now();
    const loop = now => { if (this.B !== B) return; const dt = Math.min(0.05, (now - B.last) / 1000); B.last = now; if (!B.over) this.step(dt); this.draw(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  },
  say(t) { const B = this.B; B.msg = t; B.msgT = 4; const m = $('#gw-msg'); if (m) { m.textContent = t; m.classList.add('on'); } },
  orderAll(o) { this.B.order = o; this.say({ hold: 'Hold your positions!', follow: 'On me! Follow the general!', attack: 'All units: attack the town!' }[o]); },
  artillery() {
    const B = this.B; if (B.art > 0) { this.say('Artillery reloading: ' + Math.ceil(B.art) + ' s'); return; }
    B.art = 14; const tx = B.mouse.x, ty = B.mouse.y;
    for (let i = 0; i < 6; i++) setTimeout(() => { if (this.B !== B) return; const x = tx + (Math.random() - 0.5) * 90, y = ty + (Math.random() - 0.5) * 90; this.boom(x, y, 46, 34, 'us'); }, 600 + i * 220);
    this.say('Artillery on the way!');
  },
  boom(x, y, rad, dmg, by) {
    const B = this.B;
    for (const u of B.units) if (u.hp > 0 && u.side !== by) { const d = Math.hypot(u.x - x, u.y - y); if (d < rad) u.hp -= dmg * (1 - d / rad * 0.6); }
    for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, s = 30 + Math.random() * 120; B.fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6 + Math.random() * 0.4, c: i % 3 ? '#ffb347' : '#555' }); }
    B.fx.push({ ring: true, x, y, r: 4, life: 0.35 }); Sfx.boom();
  },
  inForest(u) { return this.B.trees.some(t => Math.hypot(u.x - t.x, u.y - t.y) < t.r); },
  passable(x, y) { const B = this.B; if (x < 8 || y < 8 || x > B.W - 8 || y > B.H - 8) return false; if (Math.abs(x - B.river) < 26) return B.bridges.some(b => Math.abs(y - b) < 34); return true; },
  move(u, tx, ty, dt) {
    const d = Math.hypot(tx - u.x, ty - u.y); if (d < 4) return;
    let sp = u.sp * (this.inForest(u) ? 0.6 : 1) * dt, nx = u.x + (tx - u.x) / d * sp, ny = u.y + (ty - u.y) / d * sp;
    if (!this.passable(nx, ny)) {          // head for the nearest bridge first
      const br = this.B.bridges.reduce((a, b) => Math.abs(b - u.y) < Math.abs(a - u.y) ? b : a), bx = this.B.river + (tx > u.x ? 40 : -40);
      const side = Math.sign(u.x - this.B.river), d2 = Math.hypot(this.B.river - side * 40 - u.x, br - u.y) || 1;
      nx = u.x + ((Math.abs(u.y - br) < 20 ? bx : this.B.river - side * 40) - u.x) / d2 * sp; ny = u.y + (br - u.y) / d2 * sp;
      if (!this.passable(nx, ny)) return;
    }
    u.x = nx; u.y = ny;
  },
  nearestFoe(u) { let best = null, bd = 1e9; for (const o of this.B.units) if (o.hp > 0 && o.side !== u.side) { let d = Math.hypot(o.x - u.x, o.y - u.y); if (this.inForest(o)) d *= 1.5; if (d < bd) { bd = d; best = o; } } return [best, bd]; },
  fire(u, tx, ty) {
    const B = this.B; u.cd = u.rof; u.ang = Math.atan2(ty - u.y, tx - u.x);
    if (u.kind === 'art') { setTimeout(() => this.B === B && this.boom(tx + (Math.random() - 0.5) * 60, ty + (Math.random() - 0.5) * 60, 40, u.dmg, u.side), 900); B.shots.push({ x: u.x, y: u.y, tx, ty, life: 0.15, c: '#fff6' }); Sfx.shot(0.3); return; }
    const spread = u.kind === 'tank' ? 0.05 : 0.12, a = u.ang + (Math.random() - 0.5) * spread, d = Math.min(u.range, Math.hypot(tx - u.x, ty - u.y) + 10);
    const ex = u.x + Math.cos(a) * d, ey = u.y + Math.sin(a) * d;
    B.shots.push({ x: u.x, y: u.y, tx: ex, ty: ey, life: u.kind === 'tank' ? 0.12 : 0.06, c: u.side === 'us' ? '#bfe3ff' : '#ffb0a0', w: u.kind === 'tank' ? 3 : 1.3 });
    for (const o of B.units) if (o.hp > 0 && o.side !== u.side) {        // the first enemy along the line takes the hit
      const t = ((o.x - u.x) * Math.cos(a) + (o.y - u.y) * Math.sin(a)); if (t < 0 || t > d) continue;
      const px = u.x + Math.cos(a) * t, py = u.y + Math.sin(a) * t;
      if (Math.hypot(o.x - px, o.y - py) < (o.kind === 'tank' ? 16 : 12)) { o.hp -= u.dmg * (this.inForest(o) ? 0.6 : 1) * (u.you ? 1.5 : 1) * (o.you ? 0.6 : 1); o.hitT = B.t; if (u.kind === 'tank') this.boom(o.x, o.y, 18, 4, u.side); break; }
    }
    Sfx.shot(u.kind === 'tank' ? 0.6 : 0.15);
  },
  step(dt) {
    const B = this.B; B.t += dt; B.art = Math.max(0, B.art - dt);
    if (B.msgT > 0 && (B.msgT -= dt) <= 0) $('#gw-msg').classList.remove('on');
    const you = B.units[0];
    for (const u of B.units) {
      if (u.hp <= 0) { if (!u.dead) { u.dead = true; this.boom(u.x, u.y, 10, 0, u.side); } continue; }
      u.cd -= dt;
      if (u.you) {
        if (B.t - (u.hitT || 0) > 3) u.hp = Math.min(u.max, u.hp + 6 * dt);       // patches up when out of fire
        const k = B.keys; let dx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0), dy = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0);
        if (dx || dy) { const l = Math.hypot(dx, dy); this.move(u, u.x + dx / l * 30, u.y + dy / l * 30, dt); }
        u.ang = Math.atan2(B.mouse.y - u.y, B.mouse.x - u.x);
        if ((B.mouse.down || k.Space) && u.cd <= 0) this.fire(u, B.mouse.x, B.mouse.y);
        continue;
      }
      const [foe, fd] = this.nearestFoe(u);
      if (foe && fd < u.range && u.cd <= 0) this.fire(u, foe.x, foe.y);
      if (u.side === 'us') {
        if (B.order === 'follow' && Math.hypot(you.x - u.x, you.y - u.y) > 70) this.move(u, you.x - 40 + (B.units.indexOf(u) % 3) * 30, you.y - 30 + (B.units.indexOf(u) % 2) * 60, dt);
        else if (B.order === 'attack') { if (!(foe && fd < u.range * 0.8)) this.move(u, B.town.x - 30 + (B.units.indexOf(u) * 17) % 60, B.town.y - 30 + (B.units.indexOf(u) * 29) % 60, dt); }
      } else {
        // the enemy defends the town, and pushes out once they think they are stronger
        const alive = s => B.units.filter(o => o.side === s && o.hp > 0).length, push = alive('them') > alive('us') * 1.3 || B.t > 150;
        if (foe && (fd < u.range * 1.6 || push)) { if (fd > u.range * 0.7) this.move(u, foe.x, foe.y, dt); }
        else if (Math.hypot(u.x - B.town.x, u.y - B.town.y) > B.town.r * 0.9) this.move(u, B.town.x, B.town.y, dt);
      }
    }
    // the town: ours fills up while we hold it and nobody contests it
    const inTown = s => B.units.some(u => u.hp > 0 && u.side === s && Math.hypot(u.x - B.town.x, u.y - B.town.y) < B.town.r);
    if (inTown('us') && !inTown('them')) B.cap = Math.min(100, B.cap + dt * 9); else if (inTown('them') && !inTown('us')) B.cap = Math.max(0, B.cap - dt * 6);
    for (const s of B.shots) s.life -= dt; B.shots = B.shots.filter(s => s.life > 0);
    for (const f of B.fx) { f.life -= dt; if (f.ring) f.r += 160 * dt; else { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.92; f.vy *= 0.92; } } B.fx = B.fx.filter(f => f.life > 0);
    const them = B.units.filter(u => u.side === 'them' && u.hp > 0).length, us = B.units.filter(u => u.side === 'us' && u.hp > 0).length;
    $('#gw-info').textContent = `Town ${Math.round(B.cap)}% · our units ${us} · theirs ${them} · artillery ${B.art > 0 ? Math.ceil(B.art) + 's' : 'ready (Q)'} · orders: ${B.order} · ${Math.max(0, Math.ceil(240 - B.t))}s`;
    if (B.cap >= 100) this.end(true, 'You took ' + B.city + '!');
    else if (!them) this.end(true, 'The enemy force is destroyed!');
    else if (you.hp <= 0) this.end(false, 'Your unit was knocked out. The attack falls apart.');
    else if (!us) this.end(false, 'All our units are lost.');
    else if (B.t > 240) this.end(B.cap >= 50, B.cap >= 50 ? 'Time is up, and we hold most of the town.' : 'Time is up. The attack has stalled.');
  },
  draw() {
    const B = this.B, x = B.x, cv = B.cv; if (!x) return;
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#10140f'; x.fillRect(0, 0, cv.width, cv.height);
    x.setTransform(B.k, 0, 0, B.k, B.ox, B.oy);
    x.fillStyle = '#4f6b3a'; x.fillRect(0, 0, B.W, B.H);
    x.fillStyle = '#5a7742'; for (let i = 0; i < 40; i++) x.fillRect((i * 337) % B.W, (i * 211) % B.H, 60, 40);
    x.fillStyle = '#3d6f99'; x.fillRect(B.river - 24, 0, 48, B.H);
    x.fillStyle = '#8a7350'; for (const b of B.bridges) x.fillRect(B.river - 34, b - 22, 68, 44);
    x.fillStyle = 'rgba(214,190,140,.35)'; for (const b of B.bridges) { x.fillRect(0, b - 8, B.W, 16); }
    // the town
    x.fillStyle = B.cap > 0 ? `rgba(80,140,255,${0.08 + B.cap / 500})` : 'rgba(255,90,70,.12)'; x.beginPath(); x.arc(B.town.x, B.town.y, B.town.r, 0, 6.28); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.35)'; x.setLineDash([8, 8]); x.stroke(); x.setLineDash([]);
    x.fillStyle = '#b9a88a'; for (let i = 0; i < 9; i++) { const a = i * 0.7, d = 20 + (i * 13) % 50; x.fillRect(B.town.x + Math.cos(a) * d - 9, B.town.y + Math.sin(a) * d - 9, 18, 18); }
    x.fillStyle = '#fff'; x.font = 'bold 15px system-ui'; x.textAlign = 'center'; x.fillText(B.city + (B.cap > 0 ? ' · ' + Math.round(B.cap) + '%' : ''), B.town.x, B.town.y - B.town.r - 8);
    x.fillStyle = '#2f4a25'; for (const t of B.trees) { x.beginPath(); x.arc(t.x, t.y, t.r, 0, 6.28); x.fill(); }
    // units
    for (const u of B.units) {
      if (u.hp <= 0) { x.fillStyle = 'rgba(30,30,30,.6)'; x.fillRect(u.x - 8, u.y - 6, 16, 12); continue; }
      const col = u.side === 'us' ? (u.you ? '#ffd65a' : '#6fb3ff') : '#ff6b5a';
      x.save(); x.translate(u.x, u.y);
      x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(-15, -11, 32, 26);
      x.fillStyle = col; x.strokeStyle = '#111'; x.lineWidth = 2; x.fillRect(-15, -12, 30, 24); x.strokeRect(-15, -12, 30, 24);
      x.strokeStyle = '#111'; x.beginPath();
      if (u.kind === 'inf') { x.moveTo(-15, -12); x.lineTo(15, 12); x.moveTo(15, -12); x.lineTo(-15, 12); }
      else if (u.kind === 'tank') { x.ellipse(0, 0, 10, 6, 0, 0, 6.28); }
      else { x.arc(0, 0, 4, 0, 6.28); }
      x.stroke();
      x.rotate(u.ang); x.fillStyle = '#222'; x.fillRect(8, -2, u.kind === 'tank' ? 18 : 10, 4);
      x.restore();
      x.fillStyle = '#000a'; x.fillRect(u.x - 15, u.y - 20, 30, 4); x.fillStyle = u.hp / u.max > 0.4 ? '#7CFC6A' : '#ff5a4a'; x.fillRect(u.x - 15, u.y - 20, 30 * Math.max(0, u.hp / u.max), 4);
      if (u.you) { x.fillStyle = '#ffd65a'; x.font = 'bold 12px system-ui'; x.fillText('★ YOU', u.x, u.y - 26); }
    }
    for (const s of B.shots) { x.strokeStyle = s.c; x.lineWidth = s.w || 1.5; x.beginPath(); x.moveTo(s.x, s.y); x.lineTo(s.tx, s.ty); x.stroke(); }
    for (const f of B.fx) { if (f.ring) { x.strokeStyle = `rgba(255,220,150,${f.life * 2})`; x.lineWidth = 3; x.beginPath(); x.arc(f.x, f.y, f.r, 0, 6.28); x.stroke(); } else { x.globalAlpha = Math.min(1, f.life * 2); x.fillStyle = f.c; x.fillRect(f.x - 2, f.y - 2, 4, 4); x.globalAlpha = 1; } }
    if (!B.over) { x.strokeStyle = '#ffd65a'; x.lineWidth = 1.5; x.beginPath(); x.arc(B.mouse.x, B.mouse.y, 9, 0, 6.28); x.moveTo(B.mouse.x - 14, B.mouse.y); x.lineTo(B.mouse.x + 14, B.mouse.y); x.moveTo(B.mouse.x, B.mouse.y - 14); x.lineTo(B.mouse.x, B.mouse.y + 14); x.stroke(); }
  },
  end(won, why) {
    const B = this.B; if (!B || B.over) return;
    B.over = true;
    const w = B.w, me = B.me, enemy = B.enemy, kills = B.units.filter(u => u.side === 'them' && u.hp <= 0).length, lost = B.units.filter(u => u.side === 'us' && u.hp <= 0).length;
    if (G.wars.includes(w)) {
      w.genT = G.day + 30;
      const k = won ? 0.1 + kills * 0.008 : -0.06, dir = B.mine ? 1 : -1;
      for (const f of w.fronts) f.prog = clamp(f.prog + k * dir, -0.6, 1);
      if (w.will[enemy] != null) w.will[enemy] = clamp(w.will[enemy] - (won ? 10 + kills : -4), 0, 100);
      if (w.will[me] != null) w.will[me] = clamp(w.will[me] + (won ? 5 : -6), 0, 100);
      w.dead[me] = (w.dead[me] || 0) + lost * 220; w.dead[enemy] = (w.dead[enemy] || 0) + kills * 260;
      const n = G.nations[me]; n.genWins = (n.genWins || 0) + (won ? 1 : 0); sovAch();
      newsWorld((won ? 'Victory at ' : 'Defeat at ') + B.city + ': ' + G.player.title + ' ' + G.player.name + ' led the battle personally');
      inbox(won ? 'good' : 'bad', (won ? 'We won' : 'We lost') + ' the battle of ' + B.city, why + ' Enemy units destroyed: ' + kills + ', ours lost: ' + lost + '. ' + (won ? 'The front moves our way and their will to fight drops.' : 'The front slips back.'));
      try { react(n, { title: (won ? 'Victory at ' : 'Defeat at ') + B.city, stance: { military: won ? 5 : -4 }, size: 0.8, mood: won ? 0.4 : -0.3 }); } catch (e) {}
    }
    const el = $('#genwar');
    const card = document.createElement('div'); card.id = 'gw-end';
    card.innerHTML = `<h2>${won ? '🏆 Victory' : '💀 Defeat'}</h2><p>${esc(why)}</p><p class="sub">Enemy units destroyed: ${kills} · ours lost: ${lost}</p><button class="btn gold" id="gw-done">Back to the war room</button>`;
    el.appendChild(card);
    $('#gw-done').onclick = () => this.close();
    Sfx[won ? 'win' : 'lose']();
  },
  close() {
    const B = this.B; this.B = null;
    if (B) { removeEventListener('keydown', B.onKey, true); removeEventListener('keyup', B.onKey, true); removeEventListener('resize', B.onResize); removeEventListener('pointerup', B.onUp); }
    const el = $('#genwar'); if (el) el.remove();
    try { Bus.emit('changed'); Game.refresh(); } catch (e) {}
  }
};
// tiny sounds for the battle (WebAudio, made on the fly)
const Sfx = (() => {
  let ac = null; const ctx = () => { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) {} return ac; };
  const noise = (len, vol, f) => { const c = ctx(); if (!c) return; const b = c.createBuffer(1, c.sampleRate * len, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(), g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = f; s.buffer = b; g.gain.value = vol; s.connect(lp); lp.connect(g); g.connect(c.destination); s.start(); };
  const tone = (fr, len, vol) => { const c = ctx(); if (!c) return; const o = c.createOscillator(), g = c.createGain(); o.frequency.value = fr; g.gain.setValueAtTime(vol, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + len); o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + len); };
  let last = 0;
  return { shot: v => { const n = performance.now(); if (n - last < 40) return; last = n; noise(0.08, 0.08 * v + 0.02, 2500); }, boom: () => noise(0.5, 0.25, 500),
    win: () => [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.4, 0.15), i * 140)), lose: () => [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.5, 0.15), i * 180)) };
})();
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-gen]'); if (b && G) General.start(G.wars.find(w => w.id === +b.dataset.gen)); });
