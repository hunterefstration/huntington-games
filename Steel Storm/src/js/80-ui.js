// ============================================================
// UI: main menu, research tree, garage, settings, HUD, minimap, death + result screens.
// ============================================================
const UIS = { rs: null, gs: null, screen: 'menu', selDead: null, hudT: 0, msgT: 0, hitT: 0, board: false };
const UI = {
    showMenu() { UIS.screen = 'menu'; ovc.clearRect(0, 0, 4000, 4000); $('#menu').classList.remove('hidden'); $$('#s-research,#s-garage,#s-settings,#s-how,#hud,#s-dead,#s-pause,#s-result').forEach(e => e.classList.add('hidden')); UI.paintMenu(); },
    open(id) { $('#' + id).classList.remove('hidden'); if (id === 's-research') UI.paintResearch(); if (id === 's-garage') UI.paintGarage(); if (id === 's-settings') UI.paintSettings(); },
    close(id) { $('#' + id).classList.add('hidden'); UI.paintMenu(); },
    wallet() {
        $('#w-cr').textContent = fmt(save.credits); $('#w-fr').textContent = fmt(save.freeRp);
        const t = save.target && VBY[save.target]; $('#w-rp').textContent = t ? fmt(rpOf(t.id)) + '/' + fmt(t.rp) : '-';
        $$('.v-cr').forEach(e => e.textContent = fmt(save.credits)); $$('.v-fr').forEach(e => e.textContent = fmt(save.freeRp));
    },
    paintMenu() {
        UI.wallet();
        $$('#menu .mode').forEach(b => b.classList.toggle('on', b.dataset.m === save.mode));
        $$('#m-size button').forEach(b => b.classList.toggle('on', +b.dataset.s === save.size));
        $$('#m-split button').forEach(b => b.classList.toggle('on', +b.dataset.p === save.split));
        const guest = PARTY.net && !PARTY.host;
        $$('#menu .mode,#m-size button,#m-split button').forEach(b => b.disabled = !!guest);
        $('#m-lead-note').textContent = guest ? 'The party leader picks the mode.' : (save.split ? 'Party members play against each other, bots fill the rest.' : 'Party members play together, bots fill the rest.');
        $('#b-play').textContent = guest ? 'WAITING...' : 'PLAY'; $('#b-play').disabled = !!guest;
        const nm = $('#m-name'); if (document.activeElement !== nm) nm.value = myName(); nm.disabled = !!LP() && !!(() => { try { return window.parent.HGGrapevine && window.parent.HGGrapevine.me && window.parent.HGGrapevine.me(); } catch (e) { return null; } })();
        const slots = []; for (let i = 0; i < 5; i++) { const id = save.lineup[i], v = id && VBY[id]; slots.push(v ? chipHtml(v, i === save.sel, 'data-i="' + i + '"') : '<div class="chip empty"><b>Empty</b><small>Garage</small></div>'); }
        $('#lineup').innerHTML = slots.join('');
        UI.paintParty();
    },
    paintMenuSel() { UI.paintMenu(); },
    paintParty() {
        const live = !!PARTY.code;
        $('#p-idle').classList.toggle('hidden', live); $('#p-live').classList.toggle('hidden', !live);
        $('#p-codev').textContent = PARTY.code || '------';
        $('#p-list').innerHTML = rosterNow().map((p, i) => '<div class="pm"><span class="dot"></span>' + (p.id === 0 ? '<span class="star">&#9733;</span>' : '') + esc(p.name) + '<small>' + esc((VBY[p.veh] || VBY.g1a).n) + '</small></div>').join('');
        const st = $('#p-status'); st.textContent = PARTY.status || ''; st.className = 'note' + (PARTY.bad ? ' bad' : '');
        $('#p-create').disabled = !!PARTY.busy; $('#p-join').disabled = !!PARTY.busy;
        const guest = PARTY.net && !PARTY.host; const b = $('#b-play'); if (b) { b.textContent = guest ? 'WAITING...' : 'PLAY'; b.disabled = !!guest; }
    },
    refreshLobby() { if (typeof Lobby !== 'undefined') Lobby.refresh(); },
    // ----- research tree -----
    paintResearch() {
        UI.wallet(); let h = '';
        for (const ln of ['g', 'a', 'n']) {
            h += '<div class="col"><h3 style="color:' + LINES[ln].col + '">' + LINES[ln].name + '</h3>';
            for (let t = 1; t <= 4; t++) {
                h += '<div class="tier"><i>' + TIER_ROMAN[t] + '</i><div class="cards">';
                for (const v of VEHS.filter(v => v.ln === ln && v.t === t)) h += researchCard(v);
                h += '</div></div>';
            }
            h += '</div>';
        }
        $('#tree').innerHTML = h; UI.paintInfo('rs');
    },
    paintInfo(which) {
        const id = which === 'rs' ? UIS.rs : UIS.gs, el = which === 'rs' ? $('#rs-info') : $('#g-info'), v = id && VBY[id];
        if (!v) { el.innerHTML = '<h3>Vehicle</h3><div class="note">Click a vehicle to see it.</div>'; return; }
        let h = '<h2>' + esc(v.n) + '</h2><div class="note">' + LINES[v.ln].tag + ' &middot; Tier ' + TIER_ROMAN[v.t] + '</div><p>' + esc(v.desc || '') + '</p><div class="st">' + vStats(v).map(s => '<span>' + s[0] + '</span><b>' + s[1] + '</b>').join('') + '</div>';
        if (isOwned(id)) {
            h += '<div class="note">You own this vehicle.</div><button class="btn big" data-act="line" data-id="' + id + '">' + (save.lineup.includes(id) ? 'Remove from lineup' : 'Add to lineup') + '</button>';
        } else if (isResearched(id)) {
            h += '<button class="btn big" data-act="buy" data-id="' + id + '"' + (save.credits < v.cost ? ' disabled' : '') + '>Buy for ' + fmt(v.cost) + ' credits</button>';
        } else if (canResearch(id)) {
            h += '<div class="note">' + fmt(rpOf(id)) + ' / ' + fmt(v.rp) + ' research points</div><div class="bar"><i style="width:' + (100 * rpOf(id) / v.rp) + '%"></i></div>';
            h += '<button class="btn big" data-act="target" data-id="' + id + '"' + (save.target === id ? ' disabled' : '') + '>' + (save.target === id ? 'Researching now' : 'Research this (match RP go here)') + '</button>';
            h += '<button class="btn" data-act="free" data-id="' + id + '"' + (save.freeRp <= 0 ? ' disabled' : '') + '>Spend free RP (' + fmt(save.freeRp) + ')</button>';
        } else h += '<div class="note bad">Locked. Research ' + esc(VBY[v.req].n) + ' first.</div>';
        el.innerHTML = h;
    },
    paintGarage() {
        UI.wallet();
        $('#g-lineup').innerHTML = save.lineup.map((id, i) => chipHtml(VBY[id], i === save.sel, 'data-lid="' + id + '"')).join('');
        $('#g-owned').innerHTML = VEHS.filter(v => isOwned(v.id)).map(v => '<div class="vc owned' + (save.lineup.includes(v.id) ? ' sel' : '') + '" data-gid="' + v.id + '"><span class="tag t">' + TIER_ROMAN[v.t] + '</span><b><span class="ln ln-' + v.ln + '"></span>' + esc(v.n) + '</b><small>' + (save.lineup.includes(v.id) ? 'In lineup' : 'Click to add') + '</small></div>').join('');
        UI.paintInfo('gs');
    },
    paintSettings() { $('#st-q').value = save.settings.quality; $('#st-sens').value = save.settings.sens; $('#st-vol').value = save.settings.vol; $('#st-inv').checked = !!save.settings.invertY; },
    // ----- match HUD -----
    enterMatch() {
        $('#menu').classList.add('hidden'); $$('#s-research,#s-garage,#s-settings,#s-how,#s-dead,#s-pause,#s-result').forEach(e => e.classList.add('hidden'));
        $('#hud').classList.remove('hidden'); UIS.screen = 'match'; $('#h-feed').innerHTML = ''; $('#h-msg').classList.remove('on');
        $('#h-lock').classList.remove('hidden'); UI.msg(MODES[M.mode].name + ': ' + (M.mode === 'tdm' ? 'first to ' + M.limit.kills + ' kills' : 'hold the flags'), -1);
        UIS.hudT = 0; UI.buildCap(); if (typeof Cam !== 'undefined') Cam.reset();
        const ln = ME.def.ln, h = $('#h-hint'); h.style.opacity = 1;
        h.innerHTML = ln === 'a' ? '<b>Mouse</b> steer &middot; <b>W / S</b> throttle &middot; <b>A / D</b> turn<br><b>Left click</b> cannons &middot; <b>Right click / Space</b> rockets &middot; <b>B</b> bomb' : ln === 'n' ? '<b>Mouse</b> aim turrets &middot; <b>W / S</b> throttle (stays set) &middot; <b>A / D</b> rudder<br><b>Left click</b> main guns &middot; <b>Right click</b> secondary &middot; <b>Wheel</b> zoom' : '<b>Mouse</b> aim turret &middot; <b>W / S</b> drive &middot; <b>A / D</b> turn<br><b>Left click</b> cannon (has a reload) &middot; <b>Right click</b> machine gun &middot; <b>Wheel</b> zoom';
        h.innerHTML += '<br><b>Tab</b> scoreboard &middot; <b>Esc</b> menu';
        clearTimeout(UIS.hintT); UIS.hintT = setTimeout(() => { h.style.opacity = 0; }, 14000);
    },
    buildCap() { $('#h-cap').innerHTML = M.mode === 'conq' ? PTS.map((p, i) => '<div class="cp" data-i="' + i + '"><i></i><span>' + p.name + '</span></div>').join('') : ''; },
    leaveMatch(silent) {
        if (document.pointerLockElement) document.exitPointerLock();
        const was = M && !M.over;
        engineStop(); clearMatch();
        if (was && !silent) partyReset();
        UI.showMenu(); UI.refreshLobby();
    },
    msg(t, team) {
        const e = $('#h-msg'); e.textContent = t; e.style.color = team === 0 ? '#7cc0ff' : team === 1 ? '#ff8080' : '#ffd21f'; e.classList.add('on'); clearTimeout(UIS.msgT); UIS.msgT = setTimeout(() => e.classList.remove('on'), 2200);
    },
    hitMarker(kill) {
        const e = $('#h-hit'); e.textContent = kill ? '✖' : '✕'; e.style.color = kill ? '#ff4d4d' : '#fff'; e.className = 'on'; clearTimeout(UIS.hitT); UIS.hitT = setTimeout(() => { e.className = 'off'; }, kill ? 350 : 120);
    },
    hurt() { const e = $('#h-dmg'); e.style.transition = 'none'; e.style.opacity = '.9'; requestAnimationFrame(() => { e.style.transition = 'opacity .5s'; e.style.opacity = '0'; }); sfx('hurt'); },
    feed(k, v, w) {
        const f = $('#h-feed'), d = document.createElement('div'), wn = k && w && k.def[w] ? k.def[w].n : '';
        const col = e => '<span class="t' + e.team + 'c">' + esc(e.name) + '</span>';
        d.innerHTML = k && k !== v ? col(k) + ' &#9658; ' + (wn ? '<small>' + esc(wn) + '</small> &#9658; ' : '') + col(v) : (v ? col(v) + (w === 'crash' ? ' crashed' : ' was destroyed') : '');
        f.appendChild(d); while (f.children.length > 5) f.removeChild(f.firstChild); setTimeout(() => d.remove(), 7000);
    },
    died(k, w) {
        if (!M || M.over) return;
        $('#s-dead').classList.remove('hidden'); $('#h-lock').classList.add('hidden'); if (document.pointerLockElement) document.exitPointerLock();
        $('#d-title').textContent = k && k !== ME ? 'Destroyed by ' + k.name : w === 'crash' ? 'You crashed' : 'Destroyed';
        UIS.selDead = UIS.selDead && save.lineup.includes(UIS.selDead) ? UIS.selDead : myVeh();
        UI.paintDead();
    },
    paintDead() {
        $('#d-lineup').innerHTML = save.lineup.map(id => chipHtml(VBY[id], id === UIS.selDead, 'data-did="' + id + '"')).join('');
    },
    deployed() { $('#s-dead').classList.add('hidden'); $('#h-lock').classList.remove('hidden'); Cam.reset(); },
    showResult() {
        if (document.pointerLockElement) document.exitPointerLock();
        $$('#s-dead,#s-pause').forEach(e => e.classList.add('hidden'));
        const r = M.reward, my = M.my, ents = Array.from(EN.values());
        const rows = t => ents.filter(e => e.team === t).sort((a, b) => b.score - a.score || b.kills - a.kills).map(e => '<tr><td class="t' + t + 'c">' + esc(e.name) + (e === ME ? ' (you)' : '') + '</td><td>' + esc(e.def.n) + '</td><td>' + e.kills + '</td><td>' + e.deaths + '</td></tr>').join('');
        const tgt = save.target && VBY[save.target];
        $('#r-card').innerHTML = '<p class="res-h ' + (r.win ? 'win' : r.draw ? '' : 'loss') + '">' + (r.win ? 'VICTORY' : r.draw ? 'DRAW' : 'DEFEAT') + '</p>' +
            '<div class="res-g"><span>Kills <b>' + my.kills + '</b></span><span>Captures <b>' + my.caps + '</b></span><span>Damage <b>' + fmt(my.dmg) + '</b></span><span>Deaths <b>' + my.deaths + '</b></span>' +
            '<span>Credits earned <b>+' + fmt(r.cr) + '</b></span><span>Research points <b>+' + fmt(r.rp) + '</b></span></div>' +
            '<div class="note">' + (tgt ? 'Researching ' + esc(tgt.n) + ': ' + fmt(rpOf(tgt.id)) + '/' + fmt(tgt.rp) : 'No vehicle selected for research: points go to your free RP (' + fmt(save.freeRp) + '). Pick one in the Research screen.') + '</div>' +
            '<table class="keys" style="width:100%;font-size:12px"><tr><td colspan=4 class="t0c">Blue team</td></tr>' + rows(0) + '<tr><td colspan=4 class="t1c">Red team</td></tr>' + rows(1) + '</table>' +
            '<button class="btn big" id="r-go">Back to lobby</button>';
        $('#s-result').classList.remove('hidden'); $('#r-go').onclick = () => { sfx('click'); UI.leaveMatch(true); afterMatch(); };
    },
    // per-frame HUD
    hud(dt) {
        if (!M || !ME) return;
        UIS.hudT -= dt;
        // minimap + overlay each frame
        drawMini(); drawOverlay();
        if (UIS.hudT > 0) return; UIS.hudT = .1;
        const t0 = M.mode === 'tdm' ? M.kills[0] : Math.ceil(M.tickets[0]), t1 = M.mode === 'tdm' ? M.kills[1] : Math.ceil(M.tickets[1]), left = Math.max(0, M.limit.time - M.t);
        $('#h-score').innerHTML = '<div class="tm t0">' + t0 + '<small>' + (M.mode === 'tdm' ? 'KILLS' : 'TICKETS') + '</small></div><div class="tt">' + Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0') + '</div><div class="tm t1">' + t1 + '<small>' + (M.mode === 'tdm' ? 'KILLS' : 'TICKETS') + '</small></div>';
        if (M.mode === 'conq') $$('#h-cap .cp').forEach(el => { const p = M.pts[+el.dataset.i], i = el.firstChild; const own = p.own; el.style.borderColor = own < 0 ? '#fff8' : '#' + TEAM_COL[own].toString(16).padStart(6, '0'); i.style.background = p.prog === 0 ? 'none' : '#' + TEAM_COL[p.prog > 0 ? 1 : 0].toString(16).padStart(6, '0'); i.style.height = Math.abs(p.prog) * 100 + '%'; });
        const d = ME.def, hpk = clamp(ME.hp / d.hp, 0, 1);
        let w = '';
        const rl = (name, t, max, extra) => '<div><span>' + name + (extra || '') + '</span><div class="rl' + (t <= 0 ? ' rdy' : '') + '"><i style="width:' + clamp(100 * (1 - t / max), 0, 100) + '%"></i></div></div>';
        w += rl(d.w1.n, ME.t1, d.w1.rl);
        if (d.w2) w += d.w2.cnt ? rl(d.w2.n, ME.t2, d.w2.rl, ' ' + ME.a2) : rl(d.w2.n, ME.t2, d.w2.rl);
        if (d.w3) w += rl(d.w3.n, ME.t3, d.w3.rl, ' ' + ME.a3);
        let fl = d.ln === 'a' ? 'Speed ' + Math.round(ME.speed * 3.6) + ' km/h &middot; Alt ' + Math.round(ME.y) + ' m &middot; Throttle ' + Math.round(ME.thr * 100) + '%' + (ME.warn ? ' <b style="color:#ff6a5a">RETURN TO BATTLE AREA</b>' : '') : 'Speed ' + Math.round(Math.abs(ME.speed) * 3.6) + ' km/h' + (d.ln === 'n' ? ' &middot; Throttle ' + Math.round(ME.thr * 100) + '%' : '');
        $('#h-veh').innerHTML = '<div class="nm">' + esc(d.n) + '</div><div class="hp' + (hpk < .3 ? ' low' : '') + '"><i style="width:' + hpk * 100 + '%"></i><b>' + Math.max(0, Math.ceil(ME.hp)) + ' / ' + d.hp + '</b></div><div class="wp">' + w + '</div><div class="fl">' + fl + '</div>';
        if (!ME.alive) { const sec = Math.max(0, ME.respT); $('#d-sub').textContent = sec > 0 ? 'You can deploy in ' + Math.ceil(sec) + ' s' : 'Choose a vehicle and deploy'; $('#d-go').disabled = sec > 0; $('#d-go').textContent = sec > 0 ? 'WAIT ' + Math.ceil(sec) : 'DEPLOY'; }
        const b = $('#h-board'); b.classList.toggle('hidden', !UIS.board);
        if (UIS.board) {
            const rows = t => Array.from(EN.values()).filter(e => e.team === t).sort((a, b) => b.kills - a.kills).map(e => '<tr><td>' + esc(e.name) + '</td><td>' + esc(e.def.n) + '</td><td>' + e.kills + '</td><td>' + e.deaths + '</td></tr>').join('');
            b.innerHTML = '<table><tr><th class="t0c">BLUE</th><th>Vehicle</th><th>K</th><th>D</th></tr>' + rows(0) + '<tr><th class="t1c">RED</th><th></th><th></th><th></th></tr>' + rows(1) + '</table>';
        }
    }
};
function chipHtml(v, sel, attrs) { return '<div class="chip' + (sel ? ' sel' : '') + '" ' + attrs + '><span class="tier">' + TIER_ROMAN[v.t] + '</span><b><span class="ln ln-' + v.ln + '"></span>' + esc(v.n) + '</b><small>' + LINES[v.ln].tag + '</small></div>'; }
function researchCard(v) {
    let cls = 'lock', tag = '', sub = 'Locked', bar = '';
    if (isOwned(v.id)) { cls = 'owned'; tag = '<span class="tag ok">OWNED</span>'; sub = 'Ready'; }
    else if (isResearched(v.id)) { cls = 'res'; tag = '<span class="tag t">BUY</span>'; sub = fmt(v.cost) + ' cr'; }
    else if (canResearch(v.id)) { cls = 'can'; sub = fmt(rpOf(v.id)) + ' / ' + fmt(v.rp) + ' RP'; bar = '<div class="bar"><i style="width:' + (100 * rpOf(v.id) / v.rp) + '%"></i></div>'; if (save.target === v.id) tag = '<span class="tag t">&#9733; TARGET</span>'; }
    else sub = 'Needs ' + VBY[v.req].n;
    return '<div class="vc ' + cls + (UIS.rs === v.id ? ' sel' : '') + '" data-rid="' + v.id + '">' + tag + '<b>' + esc(v.n) + '</b><small>' + sub + '</small>' + bar + '</div>';
}
// ---------- minimap + on-screen markers ----------
const miniC = $('#h-map').getContext('2d');
function drawMini() {
    const c = miniC, S = 180, k = S / (EXT * 2);
    c.drawImage(miniCv, 0, 0);
    if (M.mode === 'conq') PTS.forEach((p, i) => { const o = M.pts[i].own; c.fillStyle = o < 0 ? '#ddd' : '#' + TEAM_COL[o].toString(16).padStart(6, '0'); c.strokeStyle = '#000'; c.beginPath(); c.arc((p.x + EXT) * k, (p.z + EXT) * k, 6, 0, TAU); c.fill(); c.stroke(); });
    for (const e of EN.values()) {
        if (!e.alive) continue;
        const x = (e.x + EXT) * k, y = (e.z + EXT) * k;
        c.save(); c.translate(x, y); c.rotate(-e.yaw + PI); c.fillStyle = '#' + TEAM_COL[e.team].toString(16).padStart(6, '0'); c.strokeStyle = e === ME ? '#fff' : '#000'; c.lineWidth = e === ME ? 2 : 1;
        c.beginPath(); if (e.def.ln === 'a') { c.moveTo(0, 5); c.lineTo(4, -4); c.lineTo(0, -2); c.lineTo(-4, -4); } else if (e.def.ln === 'n') { c.moveTo(0, 6); c.lineTo(3, -4); c.lineTo(-3, -4); } else { c.rect(-3, -3, 6, 6); }
        c.closePath(); c.fill(); c.stroke(); c.restore();
    }
}
const ovc = $('#ov').getContext('2d'), PV = new THREE.Vector3();
function proj(x, y, z) { PV.set(x, y, z).project(camera); if (PV.z > 1 || PV.z < -1) return null; return [(PV.x * .5 + .5) * $('#ov').width, (-PV.y * .5 + .5) * $('#ov').height, PV.z]; }
function drawOverlay() {
    const W = $('#ov').width, Hh = $('#ov').height, c = ovc; c.clearRect(0, 0, W, Hh); c.font = 'bold 12px Trebuchet MS,sans-serif'; c.textAlign = 'center';
    for (const e of EN.values()) {
        if (e === ME || !e.alive) continue;
        const dx = e.x - camera.position.x, dy = e.y - camera.position.y, dz = e.z - camera.position.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const p = proj(e.x, e.y + (e.def.ln === 'a' ? 5 : 7), e.z); if (!p || d > 1100) continue;
        const col = e.team === ME.team ? '#7cc0ff' : '#ff6060', y = clamp(p[1], 14, Hh - 14), x = clamp(p[0], 10, W - 10);
        c.fillStyle = col; c.strokeStyle = '#000'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(x, y + 8); c.lineTo(x - 6, y - 2); c.lineTo(x + 6, y - 2); c.closePath(); c.fill(); c.stroke();
        if (d < 600 || e.team !== ME.team) { c.fillStyle = '#fff'; c.fillText(e.name + ' ' + Math.round(d) + 'm', x, y - 6); }
        if (d < 450) { const w = 40, hk = clamp(e.hp / e.def.hp, 0, 1); c.fillStyle = '#0009'; c.fillRect(x - w / 2, y + 11, w, 4); c.fillStyle = col; c.fillRect(x - w / 2, y + 11, w * hk, 4); }
    }
    if (M.mode === 'conq') PTS.forEach((pt, i) => {
        const p = proj(pt.x, pt.y + 16, pt.z); if (!p) return; const o = M.pts[i].own, d = Math.round(Math.hypot(pt.x - camera.position.x, pt.z - camera.position.z));
        c.fillStyle = o < 0 ? '#ddd' : '#' + TEAM_COL[o].toString(16).padStart(6, '0'); c.strokeStyle = '#000'; c.font = 'bold 16px Trebuchet MS'; c.strokeText(pt.name, p[0], p[1]); c.fillText(pt.name, p[0], p[1]); c.font = 'bold 11px Trebuchet MS'; c.fillText(d + 'm', p[0], p[1] + 13);
    });
    // where the gun really points (it lags behind the mouse)
    if (ME.alive && ME.def.ln !== 'a' && Cam.aimD) {
        const m = muzzleWorld(ME, 0), dd = Cam.aimD, fx = Math.sin(ME.tur) * Math.cos(ME.gun), fy = Math.sin(ME.gun), fz = Math.cos(ME.tur) * Math.cos(ME.gun);
        const p = proj(m.x + fx * dd, m.y + fy * dd - 0.5 * ME.def.w1.g * (dd / ME.def.w1.v) ** 2, m.z + fz * dd);
        if (p) { c.strokeStyle = '#ffd21f'; c.lineWidth = 2; c.beginPath(); c.arc(p[0], p[1], 7, 0, TAU); c.stroke(); }
    } else if (ME.alive && ME.def.ln === 'a') {
        const f = 400, p = proj(ME.x + Math.sin(ME.yaw) * Math.cos(ME.pitch) * f, ME.y + Math.sin(ME.pitch) * f, ME.z + Math.cos(ME.yaw) * Math.cos(ME.pitch) * f);
        if (p) { c.strokeStyle = '#ffd21f'; c.lineWidth = 2; c.beginPath(); c.arc(p[0], p[1], 8, 0, TAU); c.moveTo(p[0] - 14, p[1]); c.lineTo(p[0] - 8, p[1]); c.moveTo(p[0] + 14, p[1]); c.lineTo(p[0] + 8, p[1]); c.stroke(); }
    }
}
// ---------- wiring ----------
function bindUI() {
    const clickSfx = () => sfx('click');
    document.addEventListener('click', e => {
        const t = e.target.closest('button,.chip,.vc,.mode'); if (t) clickSfx();
        const cl = e.target.closest('[data-close]'); if (cl) { const s = cl.closest('.scr'); s.classList.add('hidden'); UI.paintMenu(); if (M && s.id === 's-settings') UI.open('s-pause'); return; }
        const rc = e.target.closest('[data-rid]'); if (rc) { UIS.rs = rc.dataset.rid; UI.paintResearch(); return; }
        const gc = e.target.closest('[data-gid]'); if (gc) { UIS.gs = gc.dataset.gid; lineupToggle(gc.dataset.gid); UI.paintGarage(); partyVehChanged(); UI.refreshLobby(); return; }
        const gl = e.target.closest('[data-lid]'); if (gl) { UIS.gs = gl.dataset.lid; save.sel = save.lineup.indexOf(gl.dataset.lid); writeSave(); UI.paintGarage(); partyVehChanged(); UI.refreshLobby(); return; }
        const ac2 = e.target.closest('[data-act]');
        if (ac2) {
            const id = ac2.dataset.id, a = ac2.dataset.act;
            if (a === 'target') setTarget(id); else if (a === 'free') spendFreeRp(id); else if (a === 'buy') { if (buyVeh(id)) sfx('cap'); } else if (a === 'line') { lineupToggle(id); partyVehChanged(); UI.refreshLobby(); }
            if ($('#s-research').classList.contains('hidden')) { UI.paintGarage(); } else UI.paintResearch(); return;
        }
        const ch = e.target.closest('#lineup .chip[data-i]'); if (ch) { save.sel = +ch.dataset.i; writeSave(); UI.paintMenu(); UI.refreshLobby(); partyVehChanged(); return; }
        const dc = e.target.closest('[data-did]'); if (dc) { UIS.selDead = dc.dataset.did; UI.paintDead(); return; }
    });
    $$('#menu .mode').forEach(b => b.onclick = () => { save.mode = b.dataset.m; writeSave(); UI.paintMenu(); partySettingsChanged(); });
    $$('#m-size button').forEach(b => b.onclick = () => { save.size = +b.dataset.s; writeSave(); UI.paintMenu(); partySettingsChanged(); });
    $$('#m-split button').forEach(b => b.onclick = () => { save.split = +b.dataset.p; writeSave(); UI.paintMenu(); partySettingsChanged(); });
    $('#b-play').onclick = () => { startPlay(); if (M) Cam.lock(); };
    $('#b-research').onclick = () => UI.open('s-research'); $('#b-garage').onclick = () => UI.open('s-garage'); $('#b-settings').onclick = () => UI.open('s-settings'); $('#b-how').onclick = () => UI.open('s-how');
    $('#p-create').onclick = () => { ac(); partyCreate(); };
    $('#p-join').onclick = () => { ac(); partyJoin($('#p-code').value); };
    $('#p-leave').onclick = () => partyLeave();
    $('#p-code').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') $('#p-join').click(); });
    $('#m-name').addEventListener('keydown', e => e.stopPropagation());
    $('#m-name').addEventListener('input', e => { save.name = e.target.value.slice(0, 16); try { localStorage.setItem('steelstorm_name', save.name); } catch (er) {} writeSave(); });
    $('#st-q').onchange = e => { save.settings.quality = e.target.value; writeSave(); applyQuality(); };
    $('#st-sens').oninput = e => { save.settings.sens = +e.target.value; writeSave(); };
    $('#st-vol').oninput = e => { save.settings.vol = +e.target.value; setVolume(save.settings.vol); writeSave(); };
    $('#st-inv').onchange = e => { save.settings.invertY = e.target.checked; writeSave(); };
    $('#d-go').onclick = () => { if (ME && ME.respT <= 0) { if (respawnMe(UIS.selDead || myVeh())) { Cam.lock(); } } };
    $('#ps-resume').onclick = () => { $('#s-pause').classList.add('hidden'); Cam.lock(); };
    $('#ps-settings').onclick = () => { $('#s-pause').classList.add('hidden'); UI.open('s-settings'); };
    $('#ps-leave').onclick = () => { UI.leaveMatch(); };
}
