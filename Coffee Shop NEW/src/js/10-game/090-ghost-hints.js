// ----- ghost / hints -----
function canBuild(loc, tool, x, y) {
  const t = TOOL_BY_ID[tool];
  if (!t || t.tile === undefined) return { ok: false, why: '' };
  const v = loc.grid[y][x];
  if (v === t.tile) return { ok: false, why: 'Already here' };
  if (t.rank && rankIdx() < t.rank) return { ok: false, why: 'Locked: reach ' + RANKS[t.rank].n };
  if (t.need && !t.need()) return { ok: false, why: 'Locked: ' + t.needWhy };
  const allowed = (tool === 'floor') ? (v === TILE.EMPTY) : (v === TILE.EMPTY || v === TILE.FLOOR);
  if (!allowed) return { ok: false, why: 'Tile is occupied (use Bulldoze first)' };
  const cost = toolCost(loc, tool);
  if (state.globalMoney < cost) return { ok: false, why: 'Need ' + money(cost), cost: cost, poor: true };
  return { ok: true, cost: cost };
}
function tileDesc(loc, x, y) {
  const v = loc.grid[y][x], key = x + ',' + y, cc = C(loc);
  switch (v) {
    case TILE.EMPTY: return 'Empty ground';
    case TILE.FLOOR: return 'Floor - people walk here';
    case TILE.DOOR: return 'Door - customers come in and leave here';
    case TILE.PARKING: return 'Parking spot - brings more customers';
    case TILE.COUNTER: {
      const c = stationOf(loc, key);
      if (!cc.reach[key]) return 'Counter - UNREACHABLE: connect a floor path from a door to a tile touching it';
      if (c) { const n = loc.customers.filter(q => q.counter === key && q.state === 'waiting').length; return 'Counter - ' + KINDS[c.kind].name + ' wants ' + orderName(c) + '. Click to serve!' + (n > 1 ? ' (' + (n - 1) + ' more in line)' : ''); }
      return 'Counter - waiting for customers';
    }
    case TILE.BREWER: {
      if (evm('power', loc, 1) <= 0) return 'Brewer - no power! Wait for the outage to end';
      const b = loc.activeBrews[key];
      if (b) return 'Brewer - brewing ' + (TIER_NAME[Math.max(0, BEANS.indexOf(b.type))]) + ' (' + Math.ceil(b.ticks / 5) + 's)';
      return 'Brewer - idle. Click to brew a coffee';
    }
  }
  if (TILE_AMB[v]) return TOOL_BY_ID[TILE_TOOL[v]].name + ' - decoration, +' + ambOf(v) + ' ambience' + (TILE_SEASON[v] >= 0 ? (TILE_SEASON[v] === seasonIdx() ? ' (in season!)' : ' (+' + SEASON_AMB + ' more in ' + SEASONS[TILE_SEASON[v]].name + ')') : '');
  return '';
}
function orderName(c) {
  if (c.want) { const r = RECIPE_BY_ID[c.want]; return r.name + (c.fav ? ' (loves ' + TAG_NAME[c.lt] + ': pays 40% more!)' : ''); }
  return TIER_NAME[c.tier] + ' coffee';
}
function drawArrow(c, tx, ty) {
  const x = tx * TS + 16, y = ty * TS - 4 + Math.sin(gfx.t * 6) * 3;
  c.fillStyle = '#fbbf24'; c.strokeStyle = '#78350f'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(x, y); c.lineTo(x - 7, y - 10); c.lineTo(x - 3, y - 10); c.lineTo(x - 3, y - 18); c.lineTo(x + 3, y - 18); c.lineTo(x + 3, y - 10); c.lineTo(x + 7, y - 10); c.closePath(); c.fill(); c.stroke();
}
function nightAmt() {
  const h = ((state.tick % DAY_TICKS) + clamp(acc / TICK_MS, 0, 1)) / DAY_TICKS * 24;
  if (h < 5) return 1; if (h < 7) return 1 - (h - 5) / 2;
  if (h < 19) return 0; if (h < 21) return (h - 19) / 2; return 1;
}

// ----- main draw -----
function render(now) {
  const ctx = gfx.ctx;
  if (!state || !ctx) return;
  const loc = curLoc(), cc = C(loc);
  gfx.t = now / 1000;
  gfx.sea = seasonIdx(); gfx.hol = curHoliday();
  if (gfx.staticDirty || gfx.staticKey !== dayIdx() + '|' + cur) drawStatic();
  const dt = clamp((now - (gfx.lastNow || now)) / 1000, 0, 0.1); gfx.lastNow = now;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, gfx.cv.width, gfx.cv.height);
  ctx.drawImage(gfx.stat, 0, 0);
  ctx.setTransform(gfx.k, 0, 0, gfx.k, (FRAME - 1) * gfx.k, (FRAME - 1) * gfx.k);
  ctx.save();
  rrect(ctx, 0, 0, MAP_PX, MAP_PX, 6); ctx.clip();
  // brewers (live)
  const noPower = evm('power', loc, 1) <= 0;
  cc.brewers.forEach(b => {
    const px = b.x * TS, py = b.y * TS, br = loc.activeBrews[b.key];
    if (noPower) {
      ctx.fillStyle = '#0f172a'; ctx.fillRect(px + 7, py + 6, 18, 7);
      ctx.strokeStyle = '#f87171'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(px + 13, py + 7); ctx.lineTo(px + 19, py + 12); ctx.moveTo(px + 19, py + 7); ctx.lineTo(px + 13, py + 12); ctx.stroke();
      return;
    }
    if (br) {
      const pct = clamp(1 - br.ticks / (br.total || BREW_TICKS), 0, 1);
      ctx.fillStyle = '#0f172a'; ctx.fillRect(px + 7, py + 6, 18, 7);
      ctx.fillStyle = TIER_COLOR[Math.max(0, BEANS.indexOf(br.type))]; ctx.fillRect(px + 7, py + 6, 18 * pct, 7);
      ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.arc(px + 24, py + 17, 1.8, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#fff'; rrect(ctx, px + 12, py + 19, 8, 6, 1.5); ctx.fill();
      ctx.fillStyle = '#78350f'; ctx.fillRect(px + 13, py + 20, 6, 3);
      if (!settings.lowfx) {
        const dp = (gfx.t * 3) % 1;
        ctx.fillStyle = '#78350f'; ctx.fillRect(px + 15.3, py + 15 + dp * 5, 1.4, 2);
        if (Math.random() < 0.06) fxSteam(px + 16 + (Math.random() - 0.5) * 6, py + 16, 1);
      }
    } else {
      const inv = loc.inventory, ok = inv.milk > 0 && inv.cups > 0 && (inv.beans + inv.beans_premium + inv.beans_luxury) > 0;
      ctx.fillStyle = ok ? '#22c55e' : '#ef4444';
      ctx.beginPath(); ctx.arc(px + 24, py + 17, 1.8, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#334155'; ctx.fillRect(px + 7, py + 6, 18, 7);
    }
  });
  // counters: pulse when a customer is waiting AND coffee is ready; red mark if unreachable
  cc.counters.forEach(k => {
    const px = k.x * TS, py = k.y * TS;
    if (!cc.reach[k.key]) {
      ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(px + 25, py + 8, 6, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', px + 25, py + 8.5);
      return;
    }
    const c = stationOf(loc, k.key);
    const hasCashier = loc.staff.some(s => s.role === 'cashier' && s.counter === k.key);
    if (c && stockTotal(loc) > 0 && (!hasCashier || c.kind === 'critic')) {
      const a = 0.5 + Math.sin(gfx.t * 7) * 0.3;
      ctx.strokeStyle = 'rgba(74,222,128,' + a + ')'; ctx.lineWidth = 2.5; rrect(ctx, px + 1, py + 1, TS - 2, TS - 2, 5); ctx.stroke();
    }
  });
  // customers sharing a tile (a line at the counter) stand side by side
  const grp = {};
  loc.customers.forEach(e => { e._dx = 0; if (e.state === 'waiting') { const k = e.x + ',' + e.y; (grp[k] = grp[k] || []).push(e); } });
  for (const k in grp) { const a = grp[k]; if (a.length > 1) { a.sort((p, q) => (p.id < q.id ? -1 : 1)); a.forEach((e, i) => { e._dx = (i - (a.length - 1) / 2) * 11; }); } }
  // entities sorted by depth
  const ents = [];
  loc.customers.forEach(e => ents.push({ y: e.y + (e.oy - e.y) * 0.5, c: e, t: 0 }));
  loc.staff.forEach(e => { if (!e.train) ents.push({ y: e.y + (e.oy - e.y) * 0.5 + (e.role === 'cashier' ? -0.2 : 0), c: e, t: 1 }); });
  ents.sort((a, b) => a.y - b.y);
  ents.forEach(o => { if (o.t) drawStaff(ctx, o.c); else drawCustomer(ctx, o.c); });
  // particles
  for (let i = fx.parts.length - 1; i >= 0; i--) {
    const p = fx.parts[i];
    p.life += dt;
    if (p.life >= p.max) { fx.parts.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    const a = 1 - p.life / p.max;
    if (p.k === 'coin') {
      p.vy += 260 * dt;
      ctx.globalAlpha = Math.min(1, a * 1.6);
      ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 3 * Math.abs(Math.cos(p.life * 14)) + 0.6, 3, 0, 0, 6.3); ctx.fill();
      ctx.strokeStyle = '#a16207'; ctx.lineWidth = 0.8; ctx.stroke();
    } else if (p.k === 'steam') {
      ctx.globalAlpha = a * 0.45; ctx.fillStyle = '#f1f5f9';
      ctx.beginPath(); ctx.arc(p.x, p.y, 2 + p.life * 5, 0, 6.3); ctx.fill();
    } else if (p.k === 'heart') {
      ctx.globalAlpha = a; ctx.fillStyle = '#fb7185';
      const s = 3;
      ctx.beginPath(); ctx.arc(p.x - s * 0.5, p.y, s * 0.6, 0, 6.3); ctx.arc(p.x + s * 0.5, p.y, s * 0.6, 0, 6.3); ctx.moveTo(p.x - s * 1.05, p.y + 0.5); ctx.lineTo(p.x, p.y + s * 1.5); ctx.lineTo(p.x + s * 1.05, p.y + 0.5); ctx.fill();
    } else if (p.k === 'spark') {
      ctx.globalAlpha = a; ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }
  // snow, petals or leaves drifting down
  if (!settings.lowfx) drawFall(ctx, dt, gfx.sea);
  // power outage: the lights are out
  if (noPower) { ctx.fillStyle = 'rgba(8,10,30,0.32)'; ctx.fillRect(0, 0, MAP_PX, MAP_PX); }
  // night tint + warm lamps
  if (settings.daynight && !settings.lowfx && !noPower) {
    const n = nightAmt();
    if (n > 0.02) {
      ctx.fillStyle = 'rgba(12,18,64,' + (0.45 * n).toFixed(3) + ')';
      ctx.fillRect(0, 0, MAP_PX, MAP_PX);
      ctx.globalCompositeOperation = 'lighter';
      const lamps = cc.lights;
      for (let i = 0; i < lamps.length; i++) {
        const l = lamps[i], gx = l.x * TS + 16, gy = l.y * TS + 16;
        const gr = ctx.createRadialGradient(gx, gy, 2, gx, gy, 46);
        gr.addColorStop(0, 'rgba(255,190,90,' + (0.4 * n).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,190,90,0)');
        ctx.fillStyle = gr; ctx.fillRect(gx - 46, gy - 46, 92, 92);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  if (gfx.hol && gfx.hol.fireworks && !settings.lowfx && nightAmt() > 0.35) drawFireworks(ctx, dt);
  // hover / ghost
  const hv = gfx.hover;
  if (hv && hv.x >= 0 && hv.y >= 0 && hv.x < GRID_W && hv.y < GRID_H) {
    const px = hv.x * TS, py = hv.y * TS;
    if (tool === 'cursor') {
      const v = loc.grid[hv.y][hv.x];
      if (v === TILE.BREWER || v === TILE.COUNTER) { ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; rrect(ctx, px + 1, py + 1, TS - 2, TS - 2, 4); ctx.stroke(); }
    } else if (tool === 'erase') {
      const v = loc.grid[hv.y][hv.x];
      ctx.fillStyle = v === TILE.EMPTY ? 'rgba(255,255,255,0.08)' : 'rgba(239,68,68,0.35)'; ctx.fillRect(px, py, TS, TS);
      ctx.strokeStyle = '#f87171'; ctx.lineWidth = 2; ctx.strokeRect(px + 1, py + 1, TS - 2, TS - 2);
    } else {
      const cb = canBuild(loc, tool, hv.x, hv.y);
      ctx.fillStyle = cb.ok ? 'rgba(74,222,128,0.28)' : 'rgba(239,68,68,0.3)'; ctx.fillRect(px, py, TS, TS);
      ctx.strokeStyle = cb.ok ? '#4ade80' : '#f87171'; ctx.lineWidth = 2; ctx.strokeRect(px + 1, py + 1, TS - 2, TS - 2);
      if (cb.cost !== undefined) {
        const label = cb.cost ? money(cb.cost) : 'FREE';
        ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const ly = py < 20 ? py + TS + 8 : py - 7;
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(label, px + 16, ly);
        ctx.fillStyle = cb.ok ? '#bbf7d0' : '#fecaca'; ctx.fillText(label, px + 16, ly);
      }
    }
  }
  if (gfx.arrow) drawArrow(ctx, gfx.arrow.x, gfx.arrow.y);
  // floating texts
  for (let i = fx.texts.length - 1; i >= 0; i--) {
    const t = fx.texts[i];
    t.life += dt;
    if (t.life >= t.max) { fx.texts.splice(i, 1); continue; }
    const a = t.life < 0.7 ? 1 : 1 - (t.life - 0.7) / (t.max - 0.7);
    const yy = t.y - t.life * 26;
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.font = 'bold ' + t.size + 'px "Trebuchet MS",Arial,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineJoin = 'round';
    const xx = clamp(t.x, 30, MAP_PX - 30);
    ctx.strokeText(t.text, xx, yy); ctx.fillStyle = t.color; ctx.fillText(t.text, xx, yy);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ----- effects API -----
function fxText(x, y, text, color, size) {
  if (!settings.numbers) return;
  if (fx.texts.length > 30) fx.texts.shift();
  fx.texts.push({ x: x, y: y, text: text, color: color || '#fff', size: size || 13, life: 0, max: 1.2 });
}
function fxCoins(x, y, n) {
  if (settings.lowfx) return;
  for (let i = 0; i < n && fx.parts.length < 120; i++) fx.parts.push({ k: 'coin', x: x, y: y, vx: (Math.random() - 0.5) * 70, vy: -70 - Math.random() * 60, life: 0, max: 0.8 + Math.random() * 0.3 });
}
function fxSteam(x, y, n) {
  if (settings.lowfx) return;
  for (let i = 0; i < n && fx.parts.length < 120; i++) fx.parts.push({ k: 'steam', x: x + (Math.random() - 0.5) * 6, y: y, vx: (Math.random() - 0.5) * 8, vy: -16 - Math.random() * 10, life: 0, max: 0.9 });
}
function fxHeart(x, y) {
  if (settings.lowfx) return;
  fx.parts.push({ k: 'heart', x: x, y: y - 14, vx: 0, vy: -18, life: 0, max: 1 });
}
function fxClear() { fx.texts.length = 0; fx.parts.length = 0; }


// ======================================================================
// USER INTERFACE
// ======================================================================
let tool = 'cursor', running = false, dlgKind = null, tabCur = 'build', layoutMode = 'wide';
const E = {}, V = {};
const STASH_KEY = 'beanBrewSaveV2_stash';

function T(id, txt) { const el = E[id] || (E[id] = $(id)); if (el && el._t !== txt) { el._t = txt; el.textContent = txt; } }
function H(id, html) { const el = E[id] || (E[id] = $(id)); if (el && el._h !== html) { el._h = html; el.innerHTML = html; } }
function flash(el, cls) { el.classList.remove('flashup', 'flashdown'); void el.offsetWidth; el.classList.add(cls); }
function toggleCls(el, cls, on) { if (el) el.classList.toggle(cls, !!on); }

// ----- toasts and log -----
function toast(msg, kind, ic) {
  const box = $('toasts');
  for (let i = 0; i < box.children.length; i++) { if (box.children[i].lastChild.textContent === msg) { box.children[i].classList.remove('out'); return; } }
  while (box.children.length >= 3) box.removeChild(box.firstChild);
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || 'info');
  el.innerHTML = (ic ? icon(ic) : '') + '<span></span>';
  el.lastChild.textContent = msg;
  box.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 320); }, kind === 'goal' || kind === 'event' ? 5200 : 4000);
}
function log(msg, cls) {
  const box = $('log');
  if (!box) return;
  const d = new Date();
  const t = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  const el = document.createElement('div');
  if (cls) el.className = cls;
  el.innerHTML = '<span class="t">' + t + '</span>';
  el.appendChild(document.createTextNode(msg));
  box.appendChild(el);
  while (box.children.length > 60) box.removeChild(box.firstChild);
  box.scrollTop = box.scrollHeight;
}

// ----- confirm dialog (window.confirm is blocked in sandboxed iframes, so we use our own) -----
let askCb = null;
function ask(title, text, okLabel, cb, danger) {
  $('ask-title').textContent = title;
  $('ask-text').textContent = text;
  const yes = $('ask-yes');
  yes.textContent = okLabel || 'OK';
  yes.className = 'btn ' + (danger ? 'danger' : 'primary');
  askCb = cb;
  $('ask').classList.remove('hidden');
  yes.focus();
}
function closeAsk(ok) {
  $('ask').classList.add('hidden');
  const cb = askCb; askCb = null;
  if (ok && cb) cb();
}

// ----- panels / layout -----
function setTab(name) {
  tabCur = name;
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.dataset.tab === name));
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
}
function applyLayout() {
  const w = window.innerWidth, h = window.innerHeight;
  let m = 'wide';
  if (w < 1060 || h < 560) m = (w > h * 1.15 && w >= 640) ? 'tab-h' : 'tab-v';
  layoutMode = m;
  $('layout').className = m;
  setTab(tabCur);
  fitCanvas();
}
function selectTool(id) {
  const t = TOOL_BY_ID[id];
  if (!t) return;
  if (t.rank && rankIdx() < t.rank) { toast(t.name + ' unlocks at rank: ' + RANKS[t.rank].n, 'bad', 'lock'); Snd.play('error'); return; }
  if (t.need && !t.need()) { toast(t.name + ': ' + t.needWhy + '.', 'bad', 'lock'); Snd.play('error'); return; }
  tool = id;
  document.querySelectorAll('.tool').forEach(b => b.classList.toggle('sel', b.dataset.tool === id));
  $('tooltip').textContent = t.tip;
  $('game').style.cursor = id === 'cursor' ? 'pointer' : (id === 'erase' ? 'not-allowed' : 'crosshair');
  Snd.play('click');
  updateUI();
}
function setStatus(txt) { V.statusAt = performance.now(); T('status-text', txt); }
const TIPS = [
  'Tip: click the glowing counter to serve a waiting customer.',
  'Tip: brown cup = Basic, gold = Premium, purple = Luxury. Match the order for the best reward!',
  'Tip: plants and tables raise ambience, so customers wait longer and visit more.',
  'Tip: Rush Hour, Bean Sales and Critics appear from time to time. Stay sharp!',
  'Tip: a Restocker keeps milk, cups and beans from running out.',
  'Tip: more Counters means more customers at once. Add Brewers to keep up!',
  'Tip: open the Goals list (G) for bonus cash.',
  'Tip: morning, lunch and evening are the busiest times of day.'
];

