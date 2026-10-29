// ----- camera input per frame (WASD / arrows glide with smooth acceleration) -----
function updInput(dt) {
  let fx = 0, fz = 0; const K = UI.keys;
  if (K['w'] || K['arrowup']) fz += 1; if (K['s'] || K['arrowdown']) fz -= 1; if (K['d'] || K['arrowright']) fx += 1; if (K['a'] || K['arrowleft']) fx -= 1;
  if (SET.edge && UI.inWin && !UI.touch && UI.ptrs.size === 0 && !SCREEN && document.hasFocus() && UI.overCanvas) { const m = 4; if (UI.mx < m) fx -= 1; if (UI.mx > vpW - m) fx += 1; if (UI.my < m) fz += 1; if (UI.my > vpH - m) fz -= 1; }
  const l = Math.hypot(fx, fz) || 1; const sp = cam.dist * .8 * SET.camSpd * (K['shift'] ? 1.9 : 1); const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
  const wvx = (fx || fz) ? (-s * fz + c * fx) / l * sp : 0, wvz = (fx || fz) ? (-c * fz - s * fx) / l * sp : 0;
  const ka = 1 - Math.exp(-dt * ((fx || fz) ? 9 : 12)); cam.vx += (wvx - cam.vx) * ka; cam.vz += (wvz - cam.vz) * ka;
  if (Math.abs(cam.vx) + Math.abs(cam.vz) > .05) { cam.tx += cam.vx * dt; cam.tz += cam.vz * dt; UI.camMoved += dt; }
  if (K['q']) { cam.tyaw -= 1.4 * dt; UI.camMoved += dt; } if (K['e']) { cam.tyaw += 1.4 * dt; UI.camMoved += dt; }
  const M = W.M; cam.tx = clamp(cam.tx, -M.hw + 4, M.hw - 4); cam.tz = clamp(cam.tz, -M.hd + 4, M.hd - 4);
  UI.hoverT = (UI.hoverT || 0) - dt;
  if (UI.hoverT <= 0 && !UI.touch) { UI.hoverT = .06; const e = UI.overCanvas && !UI.drag ? pickEntity(UI.mx, UI.my) : null; hoverId = e ? e.id : 0; glc.style.cursor = UI.mode ? 'crosshair' : (e && e.team !== MYTEAM && selIds.size ? 'crosshair' : 'default'); }
  if (UI.mode === 'call' && tgtRing && UI.overCanvas) { screenToGround(UI.mx, UI.my, _g); if (_g.ok) tgtRing.position.set(_g.x, W.M.H(_g.x, _g.z) + .5, _g.z); }
}

// =====================================================================
//  HUD  (simple top bar + one bottom bar with context cards)
// =====================================================================
const ICO = {
  coin: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6.3" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="1.8"/>',
  army: '<circle cx="12" cy="7" r="3.6"/><path d="M4.5 21c0-5 3.3-8.5 7.5-8.5s7.5 3.5 7.5 8.5z"/>',
  flag: '<path d="M5 2.5h2.2V22H5z"/><path d="M8 4h12l-3.4 4.6L20 13H8z"/>',
  hq: '<path d="M2.5 12 12 3.5 21.5 12H19v8.5h-5.2v-5.5h-3.6v5.5H5V12z"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10.5" rx="2.2"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" fill="none" stroke="currentColor" stroke-width="2.4"/>',
  stop: '<rect x="5.5" y="5.5" width="13" height="13" rx="2.5"/>',
  back: '<path d="M10 4 3 11l7 7v-4.4c5.3 0 8.4 1.6 11 5.4-.7-7.6-4.6-11.4-11-12z"/>',
  fight: '<path d="M5 5l7 7-7 7M12 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.4 9.1 8 11 4.6-1.9 8-6 8-11V5z"/>',
  nest: '<path d="M2.5 17.5h19V21h-19zM5 12h14v4H5zM8.5 6.500h7v4h-7z"/>',
  up: '<path d="M12 3l8 9h-5v9H9v-9H4z"/>',
  build: '<path d="M13.5 2.500l8 8-3 3-1.500-1.500-9 9L5 18.500l9-9L12.500 8z"/>',
  plane: '<path d="M21.5 14.500v-2L13.500 8V3.500a1.500 1.500 0 0 0-3 0V8l-8 4.500v2L10.500 12v5l-2 1.500V21l3.500-1 3.500 1v-2.500l-2-1.500v-5z"/>',
  idle: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 6.500V12l4 2.500" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  help: '<circle cx="12" cy="12" r="10"/><text x="12" y="17.500" text-anchor="middle" font-size="15" font-weight="800" fill="#13202e" font-family="Arial,sans-serif">?</text>',
  star: '<path d="M12 2l3 6.500 7 .8-5.200 4.800 1.400 7L12 17.500 5.800 21.100l1.400-7L2 9.300l7-.8z"/>',
  x: '<path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/>',
  chat: '<path d="M3 4h18v12H9l-6 5z"/>',
  sel: '<rect x="3.500" y="3.500" width="17" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="2.600" stroke-dasharray="4 3"/>',
  hold: '<path d="M7 3h3v18H7zM14 3h3v18h-3z"/>',
  group: '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2 20c0-4 2.500-6.500 6-6.500s6 2.500 6 6.500zM12 20c0-3 1.500-5 4-5.500 3.500 0 6 2.400 6 5.500z"/>',
  sell: '<path d="M12 2v20M17 6.500C16 4.500 14.300 4 12 4S8 5 8 7.500s2 3.200 4 3.800 4 1.300 4 4S14.500 20 12 20s-4.200-.8-5-3" fill="none" stroke="currentColor" stroke-width="2.600" stroke-linecap="round"/>',
  bomb: '<circle cx="12" cy="14" r="7"/><path d="M12 7V3.500M15 4l-3 .3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
  crate: '<path d="M3 8l9-5 9 5v9l-9 5-9-5z" opacity=".95"/><path d="M12 12.500V22M3 8l9 5 9-5" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="1.500"/>',
  chute: '<path d="M2.500 11A9.500 9 0 0 1 21.500 11c-2-1.500-3.500-1.500-4.800 0-1.500-1.500-3-1.500-4.700 0-1.700-1.500-3.200-1.500-4.700 0-1.300-1.500-2.800-1.500-4.800 0z"/><path d="M4 12l8 8M20 12l-8 8M12 12v8" stroke="currentColor" stroke-width="1.500" fill="none"/>',
  guns: '<path d="M3 15h14l2-3h3v3l-2 3H3zM6 9h7v4H6z"/>',
  eye: '<path fill-rule="evenodd" d="M12 5C6.500 5 2.700 9 1.500 12c1.200 3 5 7 10.500 7s9.300-4 10.500-7C21.300 9 17.500 5 12 5zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/><circle cx="12" cy="12" r="2"/>',
  rocket: '<path d="M12 2c3 2.500 4.500 6 4.500 10v4l2.500 3h-4l-1.500-2h-3L9 19H5l2.500-3v-4C7.500 8 9 4.500 12 2z"/><circle cx="12" cy="10" r="1.800" fill="#13202e"/>',
  tank: '<path d="M3 15h18v4H3zM6 11h9l1.500 2.500H6zM15 12h6v1.800h-6z"/>'
};
const ic = (k, c) => '<svg class="ic' + (c ? ' ' + c : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICO[k] || '') + '</svg>';
function toast(msg) { let t = $('.toast'); if (t) t.remove(); t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2400); }
function addAlert(msg, col, x, z, ms) { const a = $('#alerts'); const d = document.createElement('div'); d.textContent = msg; if (col) d.style.borderColor = col; if (x !== undefined) { d.dataset.x = x; d.dataset.z = z; d.title = 'Click to look'; } a.appendChild(d); setTimeout(() => d.remove(), ms || 6000); while (a.children.length > 3) a.firstChild.remove(); }
function uiAlert(e) {
  const owner = e[1], code = e[2], name = e[6]; if (owner !== ME && owner !== -1) return;
  switch (code) {
    case 'attack': addAlert('Under attack: ' + name, '#ff5a4d', e[3], e[4]); ping(e[3], e[4], '#ff4030'); UI.lastAlert = [e[3], e[4]]; sfx('alert'); break;
    case 'massing': addAlert('Enemy forces massing near ' + name, '#ffb84d', e[3], e[4], 11000); ping(e[3], e[4], '#ffb84d'); sfx('alert'); break;
    case 'incoming': addAlert('Enemy attack heading for ' + name + '!', '#ff7a4d', e[3], e[4], 11000); ping(e[3], e[4], '#ff7a4d'); sfx('alert'); break;
    case 'bldlost': addAlert('Building lost: ' + name, '#ff5a4d', e[3], e[4]); sfx('lost'); break;
    case 'hqlost': addAlert('YOUR HQ WAS DESTROYED', '#ff3030'); break;
    case 'vet': if (e[5] >= 3) addAlert(name + ' became a Hero!', '#ffd24a'); break;
    case 'tech': addAlert('Upgrade done: ' + name, '#7be08a'); sfx('done'); break;
    case 'expire': addAlert('Mercenary contract ended', '#aaa'); break;
    case 'nonest': addAlert('Cannot build another nest right now', '#aaa'); break;
    case 'elim': addAlert(name + ' is out of the game', '#ff9a4a'); break;
    case 'msg': { const col = ['#c9d4e0', '#ffd24a', '#ffcf5a', '#ff6a50'][e[5]] || '#c9d4e0'; addAlert(name, col, e[3], e[4], 9000); if (e[3] || e[4]) ping(e[3], e[4], col); sfx(e[5] === 3 ? 'alert' : 'done'); break; }
  }
}
function uiPointEvent(e) {
  const pt = W.pts[e[1]]; if (!pt) return; const owner = e[2], prev = e[4];
  if (owner === ME) { addAlert('You captured ' + pt.name + '!', '#7be08a', pt.x, pt.z); sfx('cap'); PROF.captured++; UI.did.capture = 1; }
  else if (prev === ME) { addAlert('Enemy took ' + pt.name, '#ff5a4d', pt.x, pt.z); ping(pt.x, pt.z, '#ff4030'); sfx('lost'); UI.lastAlert = [pt.x, pt.z]; }
  else if (owner >= 0 && P(owner).team !== MYTEAM) addAlert(P(owner).name + ' took ' + pt.name, '#ff9a4a', pt.x, pt.z);
  else if (owner >= 0) addAlert(P(owner).name + ' took ' + pt.name, '#7bb0ff', pt.x, pt.z);
}
function uiChat(pid, msg) { const p = P(pid); if (!p) return; const c = $('#chatbox'); const d = document.createElement('div'); d.innerHTML = '<b style="color:' + hex3(p.color) + '">' + esc(p.name) + ':</b> ' + esc(msg); c.appendChild(d); setTimeout(() => d.remove(), 7000); while (c.children.length > 4) c.firstChild.remove(); if (pid !== ME) sfx('click'); }
let QUICKFN = {};
function lockMsg(what, lvl) { sfx('deny'); toast('Level up your HQ to Level ' + (lvl || 2) + ' to unlock ' + what + '. Click your HQ, then press Level up.'); const h = P(ME).hqB; if (h) { camGoto(h.x, h.z); selectBuilding(h); } }
function hqOk() { return playerHQLvl(P(ME)) >= 2 || !!W.o.sandbox; }
function hudInit() {
  $('#hud').classList.remove('tuton'); $('#alerts').innerHTML = ''; $('#chatbox').innerHTML = ''; $('#scoreRow').innerHTML = ''; $('#quick').innerHTML = ''; $('#panel').innerHTML = ''; $('#panel').dataset.h = ''; $('#goal').innerHTML = ''; $('#goal').dataset.s = ''; $('#panel').dataset.hs = '';
  UI.cardSig = ''; UI.selSig = ''; lastScore = ''; lastQuick = ''; UI.supOpen = false; UI.specOpen = false; UI.more = false; $('#sup').classList.add('hidden'); const sp = $('#specp'); if (sp) sp.remove();
  QUICKFN = {
    army: selAllArmy, idle: selIdle, home: () => { goHome(); sfx('click'); },
    upg: () => { if (!hqOk()) lockMsg('Upgrades'); else openTech(); },
    sup: () => { if (!hqOk()) lockMsg('Support powers'); else { UI.supOpen = !UI.supOpen; UI.specOpen = false; hudUpdate(true); } },
    help: () => ACT.help(),
    sel: () => { UI.boxTouch = !UI.boxTouch; toast(UI.boxTouch ? 'Drag to select troops' : 'Drag to move the map'); lastQuick = ''; hudUpdate(true); },
    chat: () => openChat()
  };
}
let lastScore = '', lastQuick = '';
// ----- 2.4: roster status on cards, the Army status strip, and the little badge over each production building -----
const WAITTXT = ['', '', 'army full', 'paused'];
function prodBlds() { return W.bld.filter(b => b.owner === ME && b.prog >= 1 && !b.dead && b.ros); }
function rosMissing(b) { let n = 0; for (const k in b.ros) n += Math.max(0, b.ros[k] - rosHave(b, k)); return n; }
function updStrip() {
  const el = $('#armystrip'); if (!el) return; if (!UI.known || W.t < 2.5) { UI.known = new Set(W.units.filter(u => u.owner === ME).map(u => u.id)); UI.deployLog = []; }
  const now = performance.now();
  for (const u of W.units) if (u.owner === ME && !UI.known.has(u.id)) { UI.known.add(u.id); UI.deployLog.push({ t: u.type, at: now }); if (u.home) { const pk = u.home + ':' + u.type, pend = UI.sqPend && UI.sqPend[pk]; if (pend && pend.length) squadJoin(pend.shift(), u); else if (UI.bsq && UI.bsq[u.home]) squadJoin(UI.bsq[u.home], u); } }
  while (UI.deployLog.length && (now - UI.deployLog[0].at > 12000 || UI.deployLog.length > 40)) UI.deployLog.shift();
  const pb = prodBlds().filter(b => b.type !== 'hq' || rosTotal(b)); let full = 0, trn = 0, money = 0, army = 0, empty = 0, miss = 0;
  for (const b of pb) { const m = rosMissing(b); miss += m; if (!rosTotal(b)) empty++; else if (b.tr && b.wait !== 2) trn++; else if (b.wait === 1) money++; else if (b.wait === 2) army++; else if (!m) full++; }
  const grp = {}; for (const d of UI.deployLog) if (UT[d.t]) grp[d.t] = (grp[d.t] || 0) + 1;
  const chips = Object.keys(grp).slice(-7).map(t => '<div class="ch" style="' + iconStyle(t) + '" data-tip="' + esc(UT[t].n + '|Deployed recently.') + '"><b>' + grp[t] + '</b></div>').join('');
  const sig = [pb.length, full, trn, money, army, empty, miss, chips].join('/');
  if (el.dataset.s === sig) return; el.dataset.s = sig;
  el.innerHTML = (pb.length ? (trn ? '<span class="cl">' + trn + ' training</span>' : '') + (full ? '<span class="rd">' + full + ' full</span>' : '') + (money ? '<span class="cl" style="color:#ff9a8c">' + money + ' waiting for money</span>' : '') + (army ? '<span class="cl" style="color:#ff9a8c">' + army + ' army full</span>' : '') + (empty ? '<span class="qd" style="color:#9fd0ff" data-tip="Empty buildings|Click a building with a Pick troops label and choose what it keeps.">' + empty + ' empty</span>' : '') + (miss ? '<span class="qd" style="color:#9fd0ff">' + miss + ' to train</span>' : '') : '') + (chips ? '<span class="as">New</span>' + chips : '');
  el.style.display = (pb.length && (trn || money || army || empty || miss)) || chips ? 'flex' : 'none';   // 2.0: only when there is something to say
}
const BADGES = new Map();
function updBadges() {
  const show = inGame && W && MODE === 'game' && !SCREEN; const seen = new Set();
  if (show) for (const b of prodBlds()) {
    if (b.type === 'hq' && !rosTotal(b)) continue;
    w2s(b.x, b.y + b.T.sz * .45 + 5, b.z, _sp); if (_sp.z >= 1 || _sp.x < -40 || _sp.x > vpW + 40 || _sp.y < 70 || _sp.y > vpH - hudDeckPx() + 20) continue;
    let d = BADGES.get(b.id); if (!d) { d = document.createElement('div'); d.className = 'bbadge'; document.body.appendChild(d); BADGES.set(b.id, d); }
    seen.add(b.id); let have = 0; for (const k in b.ros) have += Math.min(rosHave(b, k), b.ros[k]); const tot = rosTotal(b), cnt = have + '/' + tot; let txt, cls, bar = '';
    if (!tot) { txt = 'Pick troops (0/' + rosCap(b) + ')'; cls = 'cool que'; }
    else if (b.wait) { txt = cnt + ' - ' + WAITTXT[b.wait]; cls = 'cool que'; }
    else if (b.tr) { txt = cnt + ' - ' + (b.tr.re ? 'respawning ' : '') + UT[b.tr.u].n + ' ' + Math.max(0, b.tr.dur - b.tr.t).toFixed(1) + 's'; cls = 'cool'; bar = '<i style="width:' + Math.round(clamp(b.tr.t / b.tr.dur, 0, 1) * 100) + '%"></i>'; }
    else { txt = 'FULL ' + cnt; cls = 'rdy'; }
    const sig = cls + txt + bar; if (d.dataset.s !== sig) { d.dataset.s = sig; d.className = 'bbadge ' + cls; d.innerHTML = esc(txt) + bar; }
    d.style.display = 'block'; d.style.transform = 'translate(' + (_sp.x | 0) + 'px,' + (_sp.y | 0) + 'px) translate(-50%,-100%)';
  }
  for (const [id, d] of BADGES) if (!seen.has(id)) { d.remove(); BADGES.delete(id); }
}
function teamBleed() { const cnt = {}; for (const t of W.teamList) cnt[t.id] = 0; for (const pt of W.pts) if (pt.owner >= 0) cnt[P(pt.owner).team]++; let mx = 0; for (const t of W.teamList) if (t.alive) mx = Math.max(mx, cnt[t.id]); const r = {}; for (const t of W.teamList) r[t.id] = t.alive && mx > cnt[t.id] ? Math.ceil((mx - cnt[t.id]) / 2) : 0; return r; }
function ptsOfTeam(t) { let n = 0; for (const pt of W.pts) if (pt.owner >= 0 && P(pt.owner).team === t) n++; return n; }
function iconStyle(k) { return ICONS[k] ? 'background-image:url(' + ICONS[k] + ')' : ''; }
function strongWeak(w) { if (w.g === 'a') return 'Only attacks aircraft, and is very strong against them.'; const names = ['soldiers', 'vehicles', 'tanks', 'aircraft', 'buildings']; const s = [], wk = []; for (let c = 0; c < 5; c++) { let m = WTM[w.wt][c]; if (c === 3 && w.g === 'g') m = 0; if (c !== 3 && w.g === 'a') m = 0; if (m >= 1.15) s.push(names[c]); else if (m <= .3) wk.push(names[c]); } return (s.length ? 'Good against ' + s.join(', ') + '. ' : '') + (wk.length ? 'Weak against ' + wk.join(', ') + '.' : ''); }
function unitTip(type, b) { const T = UT[type], p = P(ME); return T.n + '|' + T.info + '|A slot costs ' + slotCost(p, type, b) + ', paid once. The building trains this troop and respawns it for free every time it dies (' + (b ? unitCd(b, type).toFixed(0) : unitCdBase(T).toFixed(0)) + 's to train, twice that to respawn). Takes ' + T.pop + ' army space. Click the minus (or right-click the card) to remove a slot and get half the price back.|' + (T.w ? strongWeak(T.w) : '') + (T.w2 && T.w2.g === 'a' && T.w.g !== 'a' ? ' Also fires missiles that are strong against aircraft.' : '') + unitExtra(T); }
// 3.0: Legion abilities in tooltips and the Field Guide; engN = what your builders are called
const engN = () => W && W.players[ME] && W.players[ME].fac === 1 ? 'Technician' : 'Engineer';
function unitExtra(T) { return (T.shp ? '|Energy shield: ' + T.shp + ' points. It soaks up hits first and recharges after a few seconds out of fire. Tesla lightning drains it twice as fast.' : '') + (T.jump ? '|Jump jets: leaps straight over walls and buildings.' : '') + (T.hover ? '|Hovers on anti-gravity pads: very fast.' : ''); }
function bldTip(type, fac) { const T = btx(type, fac); return T.n + '|' + T.info + '|Costs ' + T.cost[0] + '. You can level it up 3 times.'; }

function coachHint() {
  const p = P(ME), my = W.units.filter(u => u.owner === ME), blds = W.bld.filter(b => b.owner === ME), hql = playerHQLvl(p);
  const has = t => blds.some(b => b.type === t && b.prog >= 1), flags = W.pts.filter(q => q.owner === ME && q.hq < 0).length, neutral = W.pts.some(q => q.owner < 0 && q.hq < 0), soldiers = my.filter(u => !u.T.eng).length;
  const foeFlag = W.pts.some(q => q.owner >= 0 && P(q.owner).team !== MYTEAM);
  if (W.war) { const w = W.war, d = w.def; if (w.phase === 'prep') return ['Wave ' + w.wave + (d.boss ? ' (BOSS)' : '') + ': ' + d.name + ', ' + d.title + '.', 'Build up, then press Start Wave.']; if (w.phase === 'fight') return ['Wave ' + w.wave + ': ' + (w.left || 0) + ' enemy troops left', 'They land in drops and go for your buildings. Wipe them all out to win the wave.']; }
  if (!blds.some(b => b.type === 'barracks')) return ['Build a Barracks to train more soldiers.', p.sup >= BT.barracks.cost[0] ? 'Click your HQ flag, then pick Barracks.' : 'Save up ' + BT.barracks.cost[0] + ' money first.'];
  if (neutral && flags < 2) return ['Capture a gray flag. Flags give you money.', 'Select soldiers, then click the flag.'];
  { const eb = blds.find(b => b.ros && b.type !== 'hq' && b.prog >= 1 && rosTotal(b) < rosCap(b)); if (eb && soldiers < 14) return ['Your ' + eb.T.n + ' has room for ' + (rosCap(eb) - rosTotal(eb)) + ' more troops.', 'Click it, then click troop cards to fill its roster.']; }
  if (hql < 2 && p.sup >= BT.hq.cost[1] + 40 && flags >= 1) return ['Level up your HQ for more money and new things.', 'Click your HQ, then press Level up.'];
  if (W.M.naval && !has('shipyard') && soldiers >= 6) { const dk = W.pts.find(q => q.slots.some(x => x.sea && !x.b) && (q.owner === ME || q.owner < 0)); if (dk) return dk.owner === ME ? ['Build a Shipyard on the coastal spot at ' + dk.name + '.', 'Click the flag, then the anchor pad by the water.'] : ['Capture ' + dk.name + ': it has a coastal spot for a Shipyard.', 'Ships rule the water and carry soldiers to islands.']; }   // 3.0
  if (W.M.naval && my.some(u => u.T.carry) && !my.some(u => u.T.carry && u.cargo && u.cargo.length) && W.pts.some(q => q.coast && q.comp !== undefined && p.hqB && q.comp !== W.pts[p.hqB.pt].comp && q.owner !== ME)) return ['Take the island with your Landing Craft.', 'Select soldiers, click the Landing Craft, then click the island.'];
  if (neutral) return ['Send a group to capture the next gray flag.', 'Select soldiers, then click the flag.'];
  if (soldiers >= 12 && foeFlag) return ['Your army is big. Attack an enemy flag!', 'Press Army, then click an enemy flag.'];
  if (p.sup > 500) return ['You have lots of money. Build or train more!', 'Click a flag you own to build.'];
  return ['Hold more flags than the enemy to win.', 'Drag to select troops. Click to send them.'];
}

// 2.2: one broken HUD part must not break the game (it is logged, the rest keeps working)
function hudSafe(f, a) { try { f(a); } catch (e) { const k = f.name + ':' + e.message; UI.hudErr = UI.hudErr || {}; if (!UI.hudErr[k]) { UI.hudErr[k] = 1; console.error('HUD', f.name, e); window.__errs.push('hud ' + f.name + ': ' + (e && e.stack || e)); } if (f === renderPanel) { selIds.clear(); selBld = 0; UI.selEnemy = null; } } }
function hudUpdate(force) {
  if (!W || !inGame) return; const p = P(ME); if (!p) return;
  $('#vSup').textContent = Math.floor(p.sup); $('#vInc').textContent = '+' + Math.round(p.inc) + '/s'; $('#vPop').textContent = p.pop + '/' + (isFinite(p.popCap) ? p.popCap : '\u221e'); $('#stArmy').classList.toggle('low', p.pop >= p.popCap);
  $('#timer').textContent = fmtTime(W.t);
  { const mt = W.teams[MYTEAM]; if (mt && !W.o.sandbox) { const lvl = mt.tickets <= 25 ? 3 : mt.tickets <= 50 ? 2 : mt.tickets <= 100 ? 1 : 0; if (lvl > (UI.tixWarn || 0)) { UI.tixWarn = lvl; addAlert('Careful: your score is only ' + Math.max(0, Math.round(mt.tickets)) + '!', '#ff3b30'); sfx('alert'); } } }
  // 2.0: while a mouse button / finger is down on the HUD, do not rebuild it: a button replaced between press and release
  // swallows the click (this lost most clicks on troop cards while a building was training)
  const hold = UI.hudDown && !force;
  if (!hold) { hudSafe(updScore); hudSafe(updGoal); }
  for (const id of [...selIds]) { const u = W.byId.get(id); if (!u || u.dead) selIds.delete(id); }
  if (selBld && !W.byId.get(selBld)) { selBld = 0; UI.selEnemy = null; UI.cardSig = ''; }
  hudSafe(updModeBar); if (!hold) { hudSafe(renderPanel, force); hudSafe(updStrip); hudSafe(updSquads, force); hudSafe(updQuick, force); hudSafe(updSup, force); }
  if (UI.tutorialTick) UI.tutorialTick();
  if (techOpen && !hold) hudSafe(updTech);
}
function updScore() {
  const bl = teamBleed(); let sig = ''; for (const t of W.teamList) sig += t.id + ':' + Math.max(0, Math.round(t.tickets)) + (t.alive ? '' : 'x') + (bl[t.id] || 0) + '|';
  for (const pt of W.pts) sig += pt.owner + ',' + Math.round(pt.ctrl * 8) + (pt.contested ? 'c' : '') + ';';
  if (sig === lastScore) return; lastScore = sig;
  const teams = W.teamList.slice().sort((a, b) => (b.id === MYTEAM) - (a.id === MYTEAM)); const two = teams.length === 2;
  const side = (t, cls) => {
    const pl = t.players.map(i => P(i)); const c = hex3(pl[0].color); const sc = W.o.sandbox || W.o.war ? '-' : Math.max(0, Math.round(t.tickets));
    const nm = t.id === MYTEAM ? (pl.length > 1 ? 'YOUR TEAM' : 'YOU') : (two ? 'ENEMY' : pl.map(q => q.name).join('+').slice(0, 10).toUpperCase());
    const drain = bl[t.id] > 0 && !W.o.sandbox ? '<span class="drain" data-tip="Losing score|You hold fewer flags than the leader, so your score is draining. Capture more flags!">&#9660;</span>' : '';
    return '<div class="side ' + cls + (t.alive ? '' : ' dead') + '" data-tip="' + esc((t.id === MYTEAM ? 'Your score' : 'Enemy score') + '|Each side starts with ' + W.o.tickets + '. You lose score when you hold fewer flags than the leader and when your units die. At 0 you lose.') + '"><span class="nm">' + esc(nm) + '</span><div class="bar"><i style="width:' + clamp(t.tickets / W.o.tickets * 100, 0, 100) + '%;background:' + c + '"></i></div><b style="color:' + c + '">' + sc + '</b>' + drain + '</div>';
  };
  let flags = ''; W.pts.forEach(pt => { if (W.o.war && pt.hq >= 0 && pt.owner < 0) return;
    const col = pt.owner >= 0 ? hex3(P(pt.owner).color) : (pt.capP >= 0 && pt.ctrl > 0 ? hex3(P(pt.capP).color) : '#8d97a3'); const who = pt.owner >= 0 ? (P(pt.owner).team === MYTEAM ? 'yours' : 'enemy') : 'nobody yet';
    flags += '<button class="fl' + (pt.hq >= 0 ? ' hq' : '') + (pt.contested ? ' ct' : '') + '" data-pt="' + pt.id + '" style="--c:' + col + '" data-tip="' + esc((pt.hq >= 0 ? 'Headquarters' : pt.name) + '|Held by: ' + who + (pt.contested ? '. Being fought over!' : '') + '|Click to look at it.') + '">' + ic(pt.hq >= 0 ? 'hq' : 'flag') + (pt.owner < 0 && pt.ctrl > 0 || pt.owner >= 0 && pt.ctrl < 1 ? '<i><s style="width:' + Math.round(pt.ctrl * 100) + '%"></s></i>' : '') + '</button>';
  });
  let h = side(teams[0], 'you') + '<div id="flags" data-tip="Flags|Each icon is a flag on the map. Blue is yours, red is the enemy, gray is empty. Click one to look at it.">' + flags + '</div>';
  if (two) h += side(teams[1], 'foe'); else for (let i = 1; i < teams.length; i++) h += side(teams[i], 'foe sm');
  $('#scoreRow').innerHTML = h;
}
function updGoal() {
  const el = $('#goal'), wxc = wxChip(); let mine = ptsOfTeam(MYTEAM), theirs = 0; for (const t of W.teamList) if (t.id !== MYTEAM) theirs = Math.max(theirs, ptsOfTeam(t.id));
  if (W.war) {   // 3.1 Endless War status
    const w = W.war, d = w.def; let lg, st;
    if (w.phase === 'prep') { lg = (d.boss ? 'BOSS WAVE. ' : '') + d.name + ' (' + d.title + ') lands in the ' + WDIRS[d.site] + (WMODS[d.mod] ? '. Twist: ' + WMODS[d.mod].n : '') + (d.wxm === 'night' ? '. At night!' : d.wxm === 'storm' ? '. Storm: ' + WXD[d.wxw].n : '') + '.'; st = (w.hold && (SCREEN === 'warwave' || W.t - (w.holdT || 0) <= 3)) || w.go ? '<span class="st t">Get ready...</span>' : '<button class="sm wgo" data-warnow="1" style="pointer-events:auto">Start Wave ' + w.wave + '</button>'; }
    else if (w.phase === 'fight') { const e = W.players[1], hq = e.hqB; lg = 'Wave ' + w.wave + ': destroy ' + d.name + "'s HQ in the " + WDIRS[d.site] + ', or hold out until time runs out.'; st = '<span class="st ' + (w.t < 60 ? 'w' : 't') + '">' + fmtTime(w.t) + ' left</span>' + (hq && !hq.dead ? '<span class="st l">Enemy HQ ' + Math.ceil(hq.hp / hq.maxHp * 100) + '%</span>' : ''); }
    else { lg = 'The Bastion has fallen.'; st = ''; }
    const sg = 'W' + lg + st + wxc; if (sg === el.dataset.s) return; el.dataset.s = sg; el.innerHTML = (w.phase === 'prep' ? '<b>WAVE ' + w.wave + '</b>' + st + '<span class="lg">' + esc(lg) + '</span><span class="sh">Prepare</span>' : '<b>WAVE ' + w.wave + '</b><span class="lg">' + esc(lg) + '</span><span class="sh">Wave ' + w.wave + '</span>' + st) + wxc;
    const bt = el.querySelector('[data-warnow]'); if (bt) bt.onclick = () => { initAudio(); ACT.warnow(); }; return;
  }
  const o = W.o.obj; if (o && !W.o.sandbox && o.type !== 'conquest' && o.type !== 'fortress' && o.type !== 'twofront') {
    const C = W.objC || {}, me = C[MYTEAM] || 0; let foe = 0; for (const t in C) if (+t !== MYTEAM) foe = Math.max(foe, C[t]); const left = Math.max(0, (o.dur || 0) - W.t);
    let lg, sh, st;
    if (o.type === 'blitz') { lg = 'Blitz: destroy the enemy HQ (or drain their score) before time runs out.'; sh = 'Win before time runs out'; st = '<span class="st ' + (left < 120 ? 'l' : 't') + '">' + fmtTime(left) + ' left</span>'; }
    else if (o.type === 'holdout') { lg = 'Hold Out: keep your HQ standing until the timer ends.'; sh = 'Survive'; st = '<span class="st w">' + fmtTime(left) + ' to go</span>'; }
    else if (o.type === 'koth') { const pt = W.pts[o.pt], wait = (o.open || 0) - W.t; lg = 'King of the Hill: hold ' + (pt ? pt.name : 'the center flag') + ' for ' + fmtTime(o.need) + ' in total. The clock stops while it is contested.'; sh = 'Hold the hill'; st = wait > 0 ? '<span class="st t">Hill opens in ' + fmtTime(wait) + '</span>' : '<span class="st ' + (me >= foe ? 'w' : 'l') + '">You ' + fmtTime(me) + ' - Enemy ' + fmtTime(foe) + '</span>'; }
    else { lg = 'Supply Run: claim ' + o.need + ' supply crates before the enemy does.'; sh = 'Claim ' + o.need + ' crates'; st = '<span class="st ' + (me >= foe ? 'w' : 'l') + '">You ' + me + ' - Enemy ' + foe + ' of ' + o.need + '</span>'; }
    const sg = 'O' + lg + st + wxc; if (sg === el.dataset.s) return; el.dataset.s = sg; el.innerHTML = '<b>GOAL</b><span class="lg">' + esc(lg) + '</span><span class="sh">' + esc(sh) + '</span>' + st + wxc; return;
  }
  const sig = W.o.sandbox ? 'S' : mine + '/' + theirs + '/' + W.pts.length + (W.o.tutorial ? 't' : '') + wxc; if (sig === el.dataset.s) return; el.dataset.s = sig;
  if (W.o.sandbox) { el.innerHTML = '<b>SANDBOX</b> Build anything. Spawn units from the box on the right.'; return; }
  const st = mine > theirs ? '<span class="st w">Winning ' + mine + ' - ' + theirs + '</span>' : mine < theirs ? '<span class="st l">Losing ' + mine + ' - ' + theirs + '</span>' : '<span class="st t">Tied ' + mine + ' - ' + theirs + '</span>';
  el.innerHTML = '<b>GOAL</b><span class="lg">Capture flags. Hold more than the enemy to win.</span><span class="sh">Hold more flags to win</span>' + st + wxc;
}
function wxChip() { const o = W.o; if (o.tod !== 'night' && !(WXD[o.weather] && o.weather !== 'clear')) return ''; return '<span class="st wx">' + esc(wxName(o)) + '</span>'; }
function updModeBar() {
  const el = $('#modebar'); let t = '';
  if (UI.mode === 'amove') t = 'Click where your troops should go. They will fight on the way.';
  else if (UI.mode === 'nest') t = 'Click where the ' + engN() + ' should build a Sandbag Nest.';
  else if (UI.mode === 'guard') t = 'Click a flag (or any spot) for your troops to guard.';
  else if (UI.mode === 'rally') t = 'Click where new troops from this building should gather.';
  else if (UI.mode === 'call' && CALL[UI.callId]) t = 'Click the map to use ' + callText(UI.callId, P(ME).fac).n + '.';
  else if (UI.mode === 'sbspawn' && UI.sb && UT[UI.sb.type]) t = 'Click the map to place ' + UT[UI.sb.type].n + '.';
  if (el.dataset.t === t) return; el.dataset.t = t; if (!t) { el.classList.add('hidden'); return; } el.classList.remove('hidden'); el.innerHTML = '<span>' + esc(t) + '</span><button class="sm" id="modex">Cancel</button>'; $('#modex').onclick = () => setMode(null);
}
function updQuick(force) {
  const p = P(ME), ok = hqOk(); const items = [['army', 'army', 'Army', 'Select all your troops (Ctrl+A)'], ['idle', 'idle', 'Idle', 'Select troops that are doing nothing (Tab)'], ['home', 'hq', 'Home', 'Jump the camera to your HQ (Space)']];
  const upAff = ok && !p.res && techLeft(p) > 0 && techList(p.fac).some(t => !p.techs[t.id] && playerHQLvl(p) >= Math.max(2, t.tier) && (t.tier === 1 || p.techs[techPrev(t, p.fac).id]) && p.sup >= t.cost + 80);
  const supRdy = ok && supIds().some(id => callAvail(p, id) && (p.cd[id] || 0) <= 0 && p.sup >= callCost(p, id) + 60);
  items.push(['upg', 'up', 'Upgrades', ok ? 'Research upgrades for your whole army (T)' : 'Level up your HQ to Level 2 to unlock'], ['sup', 'plane', 'Support', ok ? 'Call in airstrikes, supplies, mercenaries and more. Keyboard: hold F and press 1-8.' : 'Level up your HQ to Level 2 to unlock']);
  if (UI.touch && !W.o.mp && !W.mirror) items.push(['sel', 'sel', 'Select', 'Drag to select troops']); else if (W.o.mp || W.mirror) items.push(['chat', 'chat', 'Chat', 'Talk to your opponent (Enter)']); else items.push(['help', 'help', 'Help', 'How to play (?)']);
  const sig = items.map(i => i[0]).join() + ok + upAff + supRdy + UI.supOpen + UI.boxTouch + (UI.touch ? 1 : 0) + (techOpen ? 1 : 0);
  if (sig === lastQuick && !force) return; lastQuick = sig;
  $('#quick').innerHTML = items.map(i => {
    const lock = (i[0] === 'upg' || i[0] === 'sup') && !ok; const on = (i[0] === 'sup' && UI.supOpen) || (i[0] === 'sel' && UI.boxTouch) || (i[0] === 'upg' && techOpen); const bd = (i[0] === 'upg' && upAff) || (i[0] === 'sup' && supRdy);
    return '<button class="qb' + (lock ? ' lock' : '') + (on ? ' on' : '') + '" data-q2="' + i[0] + '" data-tip="' + esc(i[2] + '|' + i[3]) + '">' + ic(lock ? 'lock' : i[1]) + '<span>' + i[2] + '</span>' + (i[0] === 'sup' ? '<span class="qh">Hold F + 1</span>' : '') + (bd ? '<span class="bd"></span>' : '') + '</button>';
  }).join('');
}
function supIds() { return CALLORDER.filter(id => !(CALL[id].fogOnly && !W.o.fog)); }
function updSup(force) {
  const el = $('#sup'); if (!UI.supOpen) { el.classList.add('hidden'); return; } el.classList.remove('hidden'); const p = P(ME); const ids = supIds();
  const sig = ids.map(id => (callAvail(p, id) ? 1 : 0) + '' + Math.ceil(p.cd[id] || 0) + (p.sup >= callCost(p, id) ? 1 : 0)).join() + UI.mode; if (el.dataset.s === sig && !force) return; el.dataset.s = sig;
  el.innerHTML = '<div class="suph">Keyboard: <b>hold <kbd>F</kbd> and press a number</b> (Hold F + 1 is the first power). Or click a card, then click the map.</div>' + ids.map(id => {
    const C = callText(id, p.fac), av = callAvail(p, id) || W.o.sandbox, cd = p.cd[id] || 0, cost = callCost(p, id), afford = p.sup >= cost || W.o.sandbox;
    const ico = { recon: 'eye', air: 'bomb', supply: 'crate', merc: 'group', para: 'chute', barrage: 'guns', armor: 'tank', cruise: 'rocket' }[id];
    return '<div class="card' + (!av ? ' lock' : (cd > 0 || !afford ? ' off' : '')) + '" data-call="' + id + '" data-tip="' + esc(C.n + ' (' + C.key + ')|' + C.d + '|Costs ' + cost + '. Recharges in ' + C.cd + 's.') + '"><div class="cimg" style="color:' + C.col + ';display:flex;align-items:center;justify-content:center">' + ic(ico) + '</div><span class="hk">F + ' + C.num + '</span><div class="cn">' + C.n + '</div>' + (av ? '<div class="cc">' + (cd > 0 ? Math.ceil(cd) + 's' : ic('coin') + cost) + '</div>' : '<div class="cc">' + ic('lock') + ' ' + callReqText(C) + '</div>') + '<div class="cd">' + C.d + '</div></div>';
  }).join('');
}

// ----- 4.1: five squads (one click to select or command) and the War Map -----
const SQN = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'], SQC = ['#5aa9ff', '#7be08a', '#ffcf5a', '#ff8a5a', '#c99bff'];
function squadIds(n) { const g = (UI.groups[n] || []).filter(id => { const u = W.byId.get(id); if (u && !u.dead && u.owner === ME) return true; const h = UI.sqInfo && UI.sqInfo[id]; if (h) { const k = h[0] + ':' + h[1]; (UI.sqPend[k] = UI.sqPend[k] || []).push(n); delete UI.sqInfo[id]; } return false; }); UI.groups[n] = g; return g; }
function squadAdd(n, ids) { UI.sqInfo = UI.sqInfo || {}; for (const id of ids) { const u = W.byId.get(id); if (u && u.home) UI.sqInfo[id] = [u.home, u.type]; } squadAdd0(n, ids); }
function squadAdd0(n, ids) { const set = new Set(ids); for (let k = 1; k <= 5; k++) if (k !== n && UI.groups[k]) UI.groups[k] = UI.groups[k].filter(id => !set.has(id)); UI.groups[n] = [...new Set((UI.groups[n] || []).concat(ids))]; UI.sqSig = ''; }
function squadCenter(ids) { let x = 0, z = 0, n = 0; for (const id of ids) { const u = W.byId.get(id); if (u && !u.dead) { x += u.x; z += u.z; n++; } } return n ? [x / n, z / n, n] : null; }
function squadJoin(n, u) { const c = squadCenter(squadIds(n)); squadAdd(n, [u.id]); if (c && Math.hypot(c[0] - u.x, c[1] - u.z) > 18) issue({ k: 'am', ids: [u.id], x: c[0] + rr(-4, 4), z: c[1] + rr(-4, 4) }); }
function selIsSquad(n) { const g = squadIds(n); return g.length && g.length === selIds.size && g.every(id => selIds.has(id)); }
function updSquads(force) {
  const el = $('#squads'); if (!el) return; let sig = (UI.wmapOn ? 'M' : '') + selIds.size;
  const rows = []; for (let n = 1; n <= 5; n++) { const g = squadIds(n); let hp = 0; for (const id of g) { const u = W.byId.get(id); hp += u.hp / u.maxHp; } const f = g.length ? hp / g.length : 0; const on = selIsSquad(n); sig += '|' + g.length + (on ? '*' : '') + Math.round(f * 10); rows.push([n, g.length, f, on]); }
  if (!force && el.dataset.s === sig) return; el.dataset.s = sig;
  el.innerHTML = '<button class="sqb wm' + (UI.wmapOn ? ' on' : '') + '" data-wmap="1" data-tip="War Map (M)|See the whole map and every flag. Pick a squad or your whole army, then click a flag or a spot to attack it.">' + ic('flag') + '<span>War Map</span><kbd>M</kbd></button>'
    + rows.map(([n, c, f, on]) => '<div class="sqb' + (on ? ' on' : '') + (c ? '' : ' empty') + '" data-sq="' + n + '" style="--c:' + SQC[n - 1] + '" data-tip="' + esc('Squad ' + n + ': ' + SQN[n - 1] + '|' + (c ? c + ' troops. Click to select (click again to jump the camera there). Then click the ground to give orders.' : 'Empty. Select troops, then press + to put them in this squad.') + ' Keys: ' + n + ' selects, Ctrl+' + n + ' saves the selection as this squad. Right-click to clear it.') + '"><b>' + n + '</b><span class="nm">' + SQN[n - 1] + '</span><span class="ct">' + c + '</span><button class="sqadd" data-sqadd="' + n + '" data-tip="Add to squad ' + n + '|Put the troops you have selected into ' + SQN[n - 1] + '.">+</button><i style="width:' + Math.round(f * 100) + '%"></i></div>').join('');
}
function squadSelect(n) { const g = squadIds(n); if (!g.length) { toast('Squad ' + SQN[n - 1] + ' is empty. Select troops and press its + button.'); sfx('deny'); return; } if (selIsSquad(n)) { const c = squadCenter(g); if (c) camGoto(c[0], c[1]); } else selectUnits(g); sfx('click'); UI.sqSig = ''; }
// the War Map: the whole battlefield, every flag, and one-click orders for any squad
const WMIMG = {};
function wmapImage() {
  const M = W.M; if (WMIMG[M.id]) return WMIMG[M.id]; const S = 420, cw = M.w >= M.d ? S : Math.round(S * M.w / M.d), ch = M.d >= M.w ? S : Math.round(S * M.d / M.w);
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; const c = cv.getContext('2d'), im = c.createImageData(cw, ch), tmp = [0, 0, 0];
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const wx = (x + .5) / cw * M.w - M.hw, wz = (y + .5) / ch * M.d - M.hd, h = M.H(wx, wz); let r, g, b; if (h < M.wl - .05) { _c4.set(M.biome.water); r = _c4.r * .9; g = _c4.g * .95; b = _c4.b; } else { terrainColor(M, wx, wz, h, M.slope(wx, wz), tmp); r = tmp[0]; g = tmp[1]; b = tmp[2]; } const i = (y * cw + x) * 4; im.data[i] = r * 255; im.data[i + 1] = g * 255; im.data[i + 2] = b * 255; im.data[i + 3] = 255; }
  c.putImageData(im, 0, 0); for (const t of M.trees) { c.fillStyle = 'rgba(30,60,30,.45)'; c.fillRect((t.x + M.hw) / M.w * cw - 1, (t.z + M.hd) / M.d * ch - 1, 2, 2); }
  return WMIMG[M.id] = cv;
}
function toggleWarMap() { if (UI.wmapOn) closeWarMap(); else openWarMap(); }
function wmForceIds() { const f = UI.wm.force; if (f === 'sel') return selUnitsArr().map(u => u.id); if (f === 'army') return W.units.filter(u => u.owner === ME && !u.T.eng && !u.T.heal && (u.T.w || u.T.w2)).map(u => u.id); return squadIds(+f); }
function openWarMap() {
  if (!inGame || !W) return; UI.wmapOn = true; UI.wm = UI.wm || { force: selIds.size ? 'sel' : 'army', order: 'am' }; if (UI.wm.force === 'sel' && !selIds.size) UI.wm.force = 'army';
  let d = $('#wmap'); if (!d) { d = document.createElement('div'); d.id = 'wmap'; $('#hud').appendChild(d); d.addEventListener('click', wmClick); d.addEventListener('contextmenu', e => e.preventDefault()); }
  d.innerHTML = '<div class="wmside"><div class="row" style="justify-content:space-between"><b style="color:#ffe2a6;font-size:17px">War Map</b><button class="sm" data-wmx="1">Close (M)</button></div><div class="lbl">Who goes</div><div id="wmforce"></div><div class="lbl">Order</div><div id="wmorder"></div><div class="lbl">Flags (click one to send them)</div><div id="wmpts"></div></div><div class="wmmain"><canvas id="wmcv"></canvas><div class="note" style="text-align:center;margin-top:4px">Click a flag or anywhere on the map to send the troops picked on the left. The game keeps running.</div></div>';
  d.classList.remove('hidden'); wmDraw(true); clearInterval(UI.wmT); UI.wmT = setInterval(() => { if (!UI.wmapOn || !inGame) { clearInterval(UI.wmT); return; } wmDraw(false); }, 250); updSquads(true);
}
function closeWarMap() { UI.wmapOn = false; clearInterval(UI.wmT); const d = $('#wmap'); if (d) d.remove(); if (inGame) updSquads(true); }
function wmGeom() { const cv = $('#wmcv'), img = wmapImage(), HW = innerWidth / (UI.uis || 1), HH = innerHeight / (UI.uis || 1); const maxW = Math.max(240, Math.min(HW - 300, 980)), maxH = Math.max(220, HH - 120); const sc = Math.min(maxW / img.width, maxH / img.height); return { cv, img, sc, w: Math.round(img.width * sc), h: Math.round(img.height * sc) }; }
function wmXY(g, x, z) { const M = W.M; return [(x + M.hw) / M.w * g.w, (z + M.hd) / M.d * g.h]; }
function wmDraw(full) {
  const g = wmGeom(); if (!g.cv) return; const cv = g.cv; if (cv.width !== g.w || cv.height !== g.h) { cv.width = g.w; cv.height = g.h; } const c = cv.getContext('2d'); c.drawImage(g.img, 0, 0, g.w, g.h);
  // units
  for (const u of W.units) { if (!myVisible(u)) continue; const p = wmXY(g, u.x, u.z), mine = u.owner === ME; c.fillStyle = hex3(P(u.owner).color); const r = u.T.cls >= 1 ? 2.6 : 1.7; c.fillRect(p[0] - r, p[1] - r, r * 2, r * 2); }
  // flags
  for (const pt of W.pts) { if (W.o.war && pt.hq >= 0 && pt.owner < 0) continue; const p = wmXY(g, pt.x, pt.z), col = pt.owner >= 0 ? hex3(P(pt.owner).color) : '#c9ced6'; c.beginPath(); c.arc(p[0], p[1], pt.hq >= 0 ? 10 : 7, 0, TAU); c.fillStyle = col + 'cc'; c.fill(); c.lineWidth = 2; c.strokeStyle = pt.contested ? '#ff4030' : '#000a'; c.stroke(); if (pt.hq >= 0) { c.fillStyle = '#000c'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.fillText('HQ', p[0], p[1] + 3.5); } c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = '#000b'; const nm = pt.hq >= 0 ? (pt.owner >= 0 ? P(pt.owner).name : pt.name) : pt.name; c.strokeText(nm, p[0], p[1] - 12); c.fillStyle = '#fff'; c.fillText(nm, p[0], p[1] - 12); }
  // field events
  if (W.fev) for (const e of W.fev) { if (e.k === 'ace') continue; const p = wmXY(g, e.x, e.z); c.beginPath(); c.arc(p[0], p[1], e.k === 'strike' ? e.r / W.M.w * g.w : 6, 0, TAU); c.strokeStyle = e.k === 'strike' ? '#ff5a40' : '#ffd24a'; c.lineWidth = 2; c.stroke(); }
  // squads
  for (let n = 1; n <= 5; n++) { const ce = squadCenter(squadIds(n)); if (!ce) continue; const p = wmXY(g, ce[0], ce[1]); c.beginPath(); c.arc(p[0], p[1], 9, 0, TAU); c.fillStyle = SQC[n - 1]; c.fill(); c.lineWidth = 2; c.strokeStyle = (UI.wm.force === String(n)) ? '#fff' : '#000'; c.stroke(); c.fillStyle = '#000'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.fillText(String(n), p[0], p[1] + 4); }
  // camera view
  { const p = wmXY(g, cam.x, cam.z); c.strokeStyle = '#ffffffaa'; c.lineWidth = 1.5; const r = cam.dist / W.M.w * g.w * .8; c.strokeRect(p[0] - r, p[1] - r * .6, r * 2, r * 1.2); }
  // side panel (rebuilt only when something changes)
  const fl = [['army', 'Whole army'], ['sel', 'Selected (' + selIds.size + ')']].concat([1, 2, 3, 4, 5].map(n => [String(n), n + ' ' + SQN[n - 1] + ' (' + squadIds(n).length + ')']));
  const fs = fl.map(x => x[0] + x[1]).join() + UI.wm.force; const fe = $('#wmforce'); if (fe && fe.dataset.s !== fs) { fe.dataset.s = fs; fe.innerHTML = fl.map(x => '<button class="sm' + (UI.wm.force === x[0] ? ' on' : '') + '" data-wmf="' + x[0] + '">' + esc(x[1]) + '</button>').join(''); }
  const oe = $('#wmorder'), os = UI.wm.order; if (oe && oe.dataset.s !== os) { oe.dataset.s = os; oe.innerHTML = [['am', 'Attack (fight on the way)'], ['mv', 'Move (ignore enemies)'], ['guard', 'Guard (hold it)']].map(x => '<button class="sm' + (UI.wm.order === x[0] ? ' on' : '') + '" data-wmo="' + x[0] + '">' + x[1] + '</button>').join(''); }
  const pts = W.pts.filter(pt => !(W.o.war && pt.hq >= 0 && pt.owner < 0)); const ps = pts.map(pt => pt.owner + (pt.contested ? 'c' : '')).join(); const pe = $('#wmpts');
  if (pe && pe.dataset.s !== ps) { pe.dataset.s = ps; pe.innerHTML = pts.map(pt => { const who = pt.owner < 0 ? 'empty' : P(pt.owner).team === MYTEAM ? (pt.owner === ME ? 'yours' : 'ally') : 'enemy'; return '<div class="wmpt ' + who + '" data-wmpt="' + pt.id + '"><span class="cdot" style="background:' + (pt.owner >= 0 ? hex3(P(pt.owner).color) : '#8d97a3') + '"></span>' + esc(pt.hq >= 0 ? (pt.owner >= 0 ? P(pt.owner).name + "'s HQ" : pt.name) : pt.name) + '<i>' + who + (pt.contested ? ', fighting' : '') + '</i></div>'; }).join(''); }
}
function wmOrder(x, z, label) {
  const ids = wmForceIds(); if (!ids.length) { toast(UI.wm.force === 'army' ? 'You have no combat troops.' : 'Nobody in that group yet.'); sfx('deny'); return; }
  issue({ k: UI.wm.order, ids, x, z, f: UI.form, g: UI.gspd ? 1 : 0 }); orderMarker(x, z, UI.wm.order === 'am' ? [1, .5, .3] : UI.wm.order === 'guard' ? [.4, .85, 1] : [.4, 1, .5]); ping(x, z, '#ffd24a'); sfx('order');
  const who = UI.wm.force === 'army' ? 'Army' : UI.wm.force === 'sel' ? 'Selected troops' : 'Squad ' + SQN[+UI.wm.force - 1]; toast(who + (UI.wm.order === 'am' ? ' attacking ' : UI.wm.order === 'guard' ? ' guarding ' : ' moving to ') + label + ' (' + ids.length + ')');
}
function wmClick(e) {
  const t = e.target; if (t.closest('[data-wmx]')) { closeWarMap(); return; }
  const f = t.closest('[data-wmf]'); if (f) { UI.wm.force = f.dataset.wmf; sfx('click'); wmDraw(true); return; }
  const o = t.closest('[data-wmo]'); if (o) { UI.wm.order = o.dataset.wmo; sfx('click'); wmDraw(true); return; }
  const pr = t.closest('[data-wmpt]'); if (pr) { const pt = W.pts[+pr.dataset.wmpt]; if (pt) wmOrder(pt.x, pt.z, pt.hq >= 0 && pt.owner >= 0 ? P(pt.owner).name + "'s HQ" : pt.name); return; }
  if (t.id === 'wmcv') { const g = wmGeom(), r = t.getBoundingClientRect(), mx = (e.clientX - r.left) / r.width * g.w, my = (e.clientY - r.top) / r.height * g.h; let best = null, bd = 16; for (const pt of W.pts) { if (W.o.war && pt.hq >= 0 && pt.owner < 0) continue; const p = wmXY(g, pt.x, pt.z), d = Math.hypot(p[0] - mx, p[1] - my); if (d < bd) { bd = d; best = pt; } } const M = W.M; if (best) wmOrder(best.x, best.z, best.hq >= 0 && best.owner >= 0 ? P(best.owner).name + "'s HQ" : best.name); else wmOrder(mx / g.w * M.w - M.hw, my / g.h * M.d - M.hd, 'that spot'); }
}
