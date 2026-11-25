// ============================================================
// WHAT THE SCREEN ITSELF TELLS YOU (the owner, 2026-11-24: "I meant more ui side for the interactivity. Red in the corners when
// hurt, stuff like that"). Nothing here changes the game: it only shows, at once and without reading, what just happened.
//   hurt      the four corners flash red, hardest on the side the blow came from (green for spit, orange for fire)
//   low       under a third of your health the edge of the screen beats like a pulse, faster the lower you are; you hear it,
//             and the colour drains from the picture
//   edge      one soft flash round the screen: green when you are healed, pale blue when your armour takes it, warm when a blast is close
//   kill      what the kill paid pops up by the cross (red and HEADSHOT for a headshot) and the money counter jumps
//   combo     a run of kills counts up under the cross, with the time left to keep it going
//   ammo      LOW AMMO, a blinking RELOAD when the magazine is empty, and a bar that fills while you reload
//   cross     turns red on a zombie
// Game calls Feel.hurt / Feel.kill / Feel.blast; everything else Feel.frame works out by watching the numbers change.
// ============================================================
const Feel = { hp: -1, ar: -1, beatT: 0, low: 0, combo: 0, edgeT: 0, cashT: 0, last: {} };
Feel.el = id => Feel.last['#' + id] || (Feel.last['#' + id] = $(id));
Feel.reset = function () { const F = Feel; F.hp = F.ar = -1; F.low = 0; F.combo = 0; for (const c of F.el('fx-hurt').children) { c.style.transition = 'none'; c.style.opacity = 0; } F.el('fx-low').className = ''; F.el('fx-low').style.opacity = 0; F.el('fx-edge').style.opacity = 0; F.el('fx-pop').innerHTML = ''; F.cls('fx-combo', ''); F.cls('fx-combo-bar', ''); F.cls('fx-ammo', ''); F.txt('fx-ammo', ''); F.el('cross').classList.remove('tgt'); if (R && World.sat0 !== undefined) R.gradeSaturation = World.sat0; };
Feel.cls = (id, c) => { const k = 'c' + id; if (Feel.last[k] !== c) { Feel.last[k] = c; Feel.el(id).className = c; } };
Feel.txt = (id, h) => { const k = 'h' + id; if (Feel.last[k] !== h) { Feel.last[k] = h; Feel.el(id).innerHTML = h; } };
// a blow: dx, dz = where it came from (from you), face = the way you look (as HUD.from takes it)
Feel.hurt = function (dmg, dx, dz, face, e) {
    const box = Feel.el('fx-hurt'), rel = -(Math.atan2(dx, dz) - face) + Math.PI, k = clamp(dmg / 22, 0.5, 1), T = e && e.T;
    box.className = T && (T.spit || T.pool) ? 'acid' : T && (T.blast || T.rain) ? 'fire' : '';
    const at = { tr: Math.PI / 4, br: Math.PI * 3 / 4, bl: -Math.PI * 3 / 4, tl: -Math.PI / 4 };
    for (const c of box.children) { const w = Math.max(0, Math.cos(rel - at[c.className])); c.style.transition = 'none'; c.style.opacity = Math.min(1, k * (0.3 + 0.7 * w)).toFixed(2); }
    void box.offsetWidth; for (const c of box.children) { c.style.transition = 'opacity ' + (0.7 + k * 0.5).toFixed(2) + 's ease-in'; c.style.opacity = 0; }
};
Feel.edge = function (kind, k) { const el = Feel.el('fx-edge'); el.className = kind || ''; el.style.transition = 'none'; el.style.opacity = clamp(k === undefined ? 0.8 : k, 0, 1); void el.offsetWidth; el.style.transition = 'opacity .6s ease-out'; el.style.opacity = 0; };
Feel.kill = function (cash, head) {
    const box = Feel.el('fx-pop'), b = document.createElement('b'); if (head) b.className = 'head'; b.innerHTML = '+$' + cash + (head ? '<small>HEADSHOT</small>' : ''); b.style.top = (-30 - box.children.length * 20) + 'px'; box.appendChild(b); while (box.children.length > 4) box.removeChild(box.firstChild);
    setTimeout(() => { if (b.parentNode) b.parentNode.removeChild(b); }, 900);
    const c = Feel.el('cash'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump');
};
Feel.blast = function (x, z, r) { const P = Game.P; if (!P) return; const d = Math.hypot(P.x - x, P.z - z); if (d < r * 2.2) Feel.edge('blast', clamp(1.25 - d / (r * 2.2), 0.25, 1)); };
Feel.frame = function (dt, G, P) {
    const F = Feel;
    // healed, or the armour took it
    if (F.hp >= 0) { if (P.hp > F.hp + 2.5 && !P.dead) F.edge('', clamp((P.hp - F.hp) / 40, 0.4, 0.9)); if (P.armor < F.ar - 0.5) { F.edge('armor', 0.6); if (P.armor <= 0.01 && F.ar > 0.01) { HUD.callout('ARMOUR GONE'); Snd.tone(900, 0.14, 0.25, 'square', 180); } } }
    F.hp = P.hp; F.ar = P.armor;
    // the pulse
    const low = P.dead || G.over ? 0 : clamp(1 - P.hp / (P.max * 0.33), 0, 1), el = F.el('fx-low');
    if ((low > 0) !== (F.low > 0)) { el.className = low > 0 ? 'on' : ''; el.style.opacity = low > 0 ? '' : 0; F.beatT = 0; }
    if (low > 0) { const beat = 1.05 - 0.5 * low; if (Math.abs(beat - (F.beat || 0)) > 0.04) { F.beat = beat; el.style.setProperty('--beat', beat.toFixed(2) + 's'); } F.beatT -= dt; if (F.beatT <= 0) { F.beatT = beat; Snd.tone(58, 0.2 + 0.15 * low, 0.11, 'sine', 40); setTimeout(() => Snd.tone(52, 0.14 + 0.1 * low, 0.1, 'sine', 38), beat * 240); } }
    if (R && World.sat0 !== undefined && (low > 0 || F.low > 0)) R.gradeSaturation = World.sat0 - 0.42 * low;
    F.low = low;
    // the run of kills
    const on = G.combo >= 2 && G.comboT > 0 && G.mode !== 'dm';
    if (on) { F.txt('fx-combo', 'x' + G.combo); if (G.combo !== F.combo) { const c = F.el('fx-combo'); F.last['cfx-combo'] = 'on bump'; c.className = 'on'; void c.offsetWidth; c.className = 'on bump'; } F.el('fx-combo-bar').firstChild.style.width = Math.round(clamp(G.comboT / 3.5, 0, 1) * 100) + '%'; F.cls('fx-combo-bar', 'on'); }
    else { F.cls('fx-combo', ''); F.cls('fx-combo-bar', ''); }
    F.combo = on ? G.combo : 0;
    // the magazine
    const W = Gun.W, S = Gun.S;
    if (!W || W.melee || P.dead || G.shopOpen) { F.cls('fx-ammo', ''); }
    else if (P.reload > 0) { F.cls('fx-ammo', 'load'); F.txt('fx-ammo', 'RELOADING<i><u style="width:' + Math.round(clamp(1 - P.reload / (P.reloadLen || 1), 0, 1) * 100) + '%"></u></i>'); }
    else if (S.ammo <= 0) { F.cls('fx-ammo', 'empty'); F.txt('fx-ammo', S.reserve > 0 ? 'RELOAD &nbsp;[R]' : 'NO AMMO'); }
    else if (S.ammo <= W.mag * 0.25) { F.cls('fx-ammo', 'low'); F.txt('fx-ammo', 'LOW AMMO'); }
    else F.cls('fx-ammo', '');
    // the cross on a zombie (every third frame: the nearest thing within the cone of its own width)
    if ((G.frame % 3) === 0) { const d = G.dir, ex = P.x, ey = World.eye, ez = P.z; let hit = false;
        for (const e of Foes.list) { if (e.state === 'die' || (Kinds.hidden && Kinds.hidden(e))) continue; const tx = e.x - ex, ty = 1.15 * e.size - ey, tz = e.z - ez, dist = Math.hypot(tx, ty, tz); if (dist > 60 || dist < 0.3) continue; const c = (tx * d[0] + ty * d[1] + tz * d[2]) / dist; if (c > 0 && Math.sqrt(Math.max(0, 1 - c * c)) * dist < 0.42 * e.size + 0.25 * Math.abs(ty / dist) && World.ray(ex, ey, ez, tx / dist, ty / dist, tz / dist, dist) >= dist - 0.5) { hit = true; break; } }
        if (hit !== F.tgt) { F.tgt = hit; F.el('cross').classList.toggle('tgt', hit); } }
};
