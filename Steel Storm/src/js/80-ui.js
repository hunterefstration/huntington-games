// ============================================================
// UI: the match HUD, minimap and markers, the death / respawn, pause and result screens. The menus are in 82-menu.js.
// ============================================================
const UIS = { rs: null, gs: null, rln: 'g', gt: 'all', screen: 'menu', selDead: null, autoDep: false, hudT: 0, msgT: 0, hitT: 0, board: false, lobby: false, spec: -1 };
const OPTS = [
    ['size', 'Team size', [[3, '3v3'], [5, '5v5'], [8, '8v8']]],
    ['len', 'Length', [[5, '5 min'], [10, '10 min'], [15, '15 min']]],
    ['map', 'Map size', [['small', 'Small'], ['normal', 'Normal'], ['large', 'Large']]],
    ['wx', 'Weather', [['noon', 'Noon'], ['evening', 'Evening'], ['overcast', 'Rain'], ['night', 'Night'], ['random', '?']]],
    ['bots', 'Bots', [['off', 'Off'], ['match', 'Match me'], ['mixed', 'Mixed']]],
    ['diff', 'Bot skill', [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']]],
    ['ff', 'Friendly fire', [[0, 'Off'], [1, 'On']]]
];
function optVal(k, src) { return src && k in src ? src[k] : k in save.opts ? save.opts[k] : save[k]; }      // src: the host's options (a guest's lobby)
function setOpt(k, v) {
    if (k === 'size' || k === 'len' || k === 'ff') v = +v;
    if (k in save.opts) save.opts[k] = v; else save[k] = v;
    writeSave(); UI.paintMenu(); UI.paintLobby(); partySettingsChanged();
    if (k === 'mode' || k === 'size' || k === 'map') advertiseSoon();
}
function optsHtml(dis, src) {
    return OPTS.map(([k, n, vals]) => '<div class="opt"><span>' + n + '</span><div class="seg">' + vals.map(([v, l]) => '<button data-opt="' + k + '" data-v="' + v + '"' + (String(optVal(k, src)) === String(v) ? ' class="on"' : '') + (dis ? ' disabled' : '') + '>' + l + '</button>').join('') + '</div></div>').join('');
}
const pingBars = (ms, st) => { const n = st && st !== 'connected' ? 0 : ms < 90 ? 4 : ms < 160 ? 3 : ms < 260 ? 2 : 1, c = n >= 3 ? '#6df07a' : n === 2 ? '#ffd21f' : '#ff6a5a'; let h = '<span class="bars">'; for (let i = 1; i <= 4; i++) h += '<i style="height:' + (i * 25) + '%;background:' + (i <= n ? c : '#fff3') + '"></i>'; return h + '</span>'; };
const UI = {
    notice(t, h) { $('#nt-h').textContent = h || 'Party'; $('#nt-t').textContent = t; $('#s-notice').classList.remove('hidden'); toast(t); if (typeof showSync === 'function') showSync(); },
    banner(t) { UIS.banner = t; const b = $('#h-banner'); if (b) { b.textContent = t; b.classList.toggle('on', !!t); } if (t) toast(t); if (typeof UI.paintLobby === 'function') UI.paintLobby(); },
    // ----- match HUD -----
    enterMatch() {
        $('#menu').classList.add('hidden'); UI.closeLobby(); UIS.lobby = !!PARTY.code; UIS.autoDep = false; $$('#s-settings,#s-how,#s-dead,#s-pause,#s-result,#s-new,#s-notice').forEach(e => e.classList.add('hidden'));
        $('#s-lobby').classList.add('hidden');
        $('#hud').classList.remove('hidden'); UIS.screen = 'match'; $('#h-feed').innerHTML = ''; $('#h-msg').classList.remove('on');
        $('#h-lock').classList.remove('hidden');
        const L = M.limit; UI.msg(MODES[M.mode].name + ': ' + (M.mode === 'tdm' ? 'first to ' + L.kills + ' kills' : M.mode === 'ffa' ? 'first to ' + L.kills + ' kills wins' : M.mode === 'ctf' ? 'capture ' + L.caps + ' flags' : 'hold the points'), -1);
        UIS.hudT = 0; UI.buildCap(); if (typeof Cam !== 'undefined') Cam.reset();
        UI.hintFor(ME.def);
    },
    hintFor(d) {
        const h = $('#h-hint'); h.style.opacity = 1;
        h.innerHTML = d.heli ? '<b>Mouse</b> aim (nose follows) &middot; <b>W / S</b> fly &middot; <b>A / D</b> strafe &middot; <b>E / Q</b> up / down<br><b>Left click</b> chin gun &middot; <b>Right click</b> rockets &middot; <b>B</b> guided missile' + (d.flares ? ' &middot; <b>F</b> flares' : '')
            : d.ln === 'a' ? '<b>Mouse</b> steer &middot; <b>W / S</b> throttle &middot; <b>A / D</b> turn<br><b>Left click</b> cannons &middot; <b>Right click / Space</b> ' + (d.w2 ? d.w2.n.toLowerCase() : 'rockets') + ' &middot; <b>B</b> bomb' + (d.flares ? ' &middot; <b>F</b> flares' : '')
                : d.ln === 'n' ? '<b>Mouse</b> aim turrets &middot; <b>W / S</b> throttle (stays set) &middot; <b>A / D</b> rudder<br><b>Left click</b> ' + d.w1.n.toLowerCase() + (d.w2 ? ' &middot; <b>Right click</b> ' + d.w2.n.toLowerCase() : '') + (d.w3 ? ' &middot; <b>B</b> ' + d.w3.n.toLowerCase() : '') + (d.sub ? ' &middot; <b>C</b> dive / surface' : '')
                    : '<b>Mouse</b> aim turret &middot; <b>W / S</b> drive &middot; <b>A / D</b> turn<br><b>Left click</b> ' + d.w1.n.toLowerCase() + (d.cls === 'arty' ? ' (aim at the ground far away)' : '') + ' &middot; <b>Right click</b> machine gun' + (d.w3 ? ' &middot; <b>B</b> ' + d.w3.n : '');
        h.innerHTML += '<br><b>Tab</b> scoreboard &middot; <b>Esc</b> menu' + (PARTY.net ? ' &middot; <b>Enter</b> chat' : '');
        clearTimeout(UIS.hintT); UIS.hintT = setTimeout(() => { h.style.opacity = 0; }, 14000);
    },
    buildCap() { $('#h-cap').innerHTML = M.mode === 'conq' ? PTS.map((p, i) => '<div class="cp" data-i="' + i + '"><i></i><span>' + p.name + '</span></div>').join('') : ''; $('#h-flags').innerHTML = ''; },
    leaveMatch(silent) {
        if (document.pointerLockElement) document.exitPointerLock();
        const was = M && !M.over;
        engineStop(); clearMatch();
        if (was && !silent) partyReset();
        UI.showMenu(); UI.refreshLobby();
    },
    msg(t, team) {
        const e = $('#h-msg'); e.textContent = t; e.style.color = team === -1 || team === undefined ? '#ffd21f' : ME && team === ME.team ? '#7cc0ff' : '#ff8080'; e.classList.add('on'); clearTimeout(UIS.msgT); UIS.msgT = setTimeout(() => e.classList.remove('on'), 2200);
    },
    hitMarker(kill, pred) {
        const e = $('#h-hit'); e.textContent = kill ? '✖' : '✕'; e.style.color = kill ? '#ff4d4d' : pred ? '#ffffffaa' : '#fff'; e.className = 'on'; clearTimeout(UIS.hitT); UIS.hitT = setTimeout(() => { e.className = 'off'; }, kill ? 350 : 120);
    },
    dmgNum(v, n, k) {      // floating damage number over what I hit (bigger and orange for a heavy hit)
        const L = UIS.dn || (UIS.dn = []); if (L.length > 24) L.shift();
        L.push({ x: v.x + rnd(-1, 1), y: v.y + (v.def.ln === 'a' ? 3 : 4), z: v.z + rnd(-1, 1), n: Math.max(1, Math.round(n)), big: k >= .12 || n >= 120, t0: performance.now() });
    },
    hurt() { const e = $('#h-dmg'); e.style.transition = 'none'; e.style.opacity = '.9'; requestAnimationFrame(() => { e.style.transition = 'opacity .5s'; e.style.opacity = '0'; }); sfx('hurt'); },
    feed(k, v, w) {
        const wn = k && w && k.def[w] ? k.def[w].n : '';
        const col = e => '<span style="color:' + entHex(e) + '">' + esc(e.name) + '</span>';
        UI.feedHtml(k && k !== v ? col(k) + ' &#9658; ' + (wn ? '<small>' + esc(wn) + '</small> &#9658; ' : '') + col(v) : (v ? col(v) + (w === 'crash' ? ' crashed' : ' was destroyed') : ''));
    },
    feedText(t, team) { if (t) UI.feedHtml('<span style="color:' + (team === -2 ? '#dfe6ff' : team >= 0 ? teamHex(team) : '#ffd21f') + '">' + esc(t) + '</span>'); },
    feedHtml(h) { if (!h) return; const f = $('#h-feed'), d = document.createElement('div'); d.innerHTML = h; f.appendChild(d); while (f.children.length > 6) f.removeChild(f.firstChild); setTimeout(() => d.remove(), 8000); },
    died(k, w) {
        if (!M || M.over) return;
        $('#s-dead').classList.remove('hidden'); $('#h-lock').classList.add('hidden'); if (document.pointerLockElement) document.exitPointerLock();
        $('#d-title').textContent = w === 'late' ? 'Battle in progress' : w === 'sync' ? 'Back in the battle' : k && k !== ME ? 'Destroyed by ' + k.name : w === 'crash' ? 'You crashed' : 'Destroyed';
        UIS.spec = k && k !== ME ? k.id : -1; UIS.autoDep = false;
        UIS.selDead = M.pick && save.lineup.includes(M.pick) ? M.pick : myVeh();      // the vehicle picked before the battle, not the last one used
        UI.paintDead();
    },
    paintDead() {
        const pick = M && M.pick;
        $('#d-lineup').innerHTML = save.lineup.map((id, i) => {
            const v = VBY[id]; if (!v) return ''; const d = vdef(id, modMask(id));
            return '<button class="dv' + (id === UIS.selDead ? ' sel' : '') + '" data-did="' + id + '" style="--lc:' + LINES[v.ln].col + '"><kbd>' + (i + 1) + '</kbd>' + (id === pick ? '<em>LOBBY PICK</em>' : '') +
                '<span class="st"><span class="tierb">' + TIER_ROMAN[v.t] + '</span>' + lineIcon(v.ln) + '</span><b>' + esc(v.n) + '</b><small>' + CLS_NAME[v.cls] + ' &middot; BR ' + brOf(d).toFixed(1) + '</small></button>';
        }).join('');
        const v = VBY[UIS.selDead]; $('#d-veh').textContent = v ? v.n + ' \u00b7 Space' : '';
    },
    // Deploy: one click or Space. Pressed while the timer still runs, it deploys the moment it can.
    deploy() {
        if (!M || M.over || !ME || ME.alive) return false;
        if (ME.respT > 0) { UIS.autoDep = true; return false; }
        UIS.autoDep = false;
        const id = save.lineup.includes(UIS.selDead) ? UIS.selDead : M.pick && save.lineup.includes(M.pick) ? M.pick : myVeh();
        if (respawnMe(id)) { Cam.lock(); return true; }
        return false;
    },
    deployed() { $('#s-dead').classList.add('hidden'); UIS.autoDep = false; $('#h-lock').classList.remove('hidden'); Cam.reset(); UI.hintFor(ME.def); },
    showResult() {
        if (document.pointerLockElement) document.exitPointerLock();
        $$('#s-dead,#s-pause').forEach(e => e.classList.add('hidden'));
        const r = M.reward, my = M.my, ents = Array.from(EN.values()), ffa = M.mode === 'ffa', mvp = EN.get(M.mvp);
        const sorted = ents.slice().sort((a, b) => b.score - a.score || b.kills - a.kills), rank = sorted.indexOf(ME) + 1;
        const row = e => '<tr' + (e === ME ? ' class="me"' : '') + '><td style="color:' + entHex(e) + '">' + (e === mvp ? '&#9733; ' : '') + esc(e.name) + (e === ME ? ' (you)' : '') + '</td><td>' + esc(e.def.n) + '</td><td>' + Math.round(e.score) + '</td><td>' + e.kills + '</td><td>' + e.deaths + '</td><td>' + (M.mode === 'ctf' ? e.flags : e.caps) + '</td></tr>';
        const head = t => '<tr><th style="color:' + (t < 0 ? '#fff' : teamHex(t)) + '">' + (t < 0 ? 'Players' : t ? 'Red team' : 'Blue team') + '</th><th>Vehicle</th><th>Score</th><th>K</th><th>D</th><th>' + (M.mode === 'ctf' ? 'Flags' : 'Caps') + '</th></tr>';
        const tgt = save.target && (VBY[save.target] || MODBY[save.target]);
        const title = ffa ? (rank === 1 ? 'WINNER!' : '#' + rank + ' of ' + ents.length) : r.win ? 'VICTORY' : r.draw ? 'DRAW' : 'DEFEAT';
        const sc = ffa ? '' : M.mode === 'tdm' ? [M.kills[0], M.kills[1]] : M.mode === 'ctf' ? [M.caps[0], M.caps[1]] : [Math.ceil(M.tickets[0]), Math.ceil(M.tickets[1])];
        const tile = (n, l) => '<div><b>' + n + '</b><small>' + l + '</small></div>';
        $('#r-card').innerHTML = '<div class="res-banner"><small>' + esc(MODES[M.mode].name.toUpperCase()) + '</small><p class="res-h ' + (r.win || (ffa && rank === 1) ? 'win' : r.draw ? 'draw' : 'loss') + '">' + title + '</p>' +
            (sc ? '<div class="res-sc"><span class="t0">BLUE ' + sc[0] + '</span> &ndash; <span class="t1">' + sc[1] + ' RED</span></div>' : '') + '</div>' +
            (mvp ? '<div class="mvp"><span>MVP</span><b style="color:' + entHex(mvp) + '">' + esc(mvp.name) + '</b><small>' + esc(mvp.def.n) + ' &middot; ' + mvp.kills + ' kills &middot; ' + Math.round(mvp.score) + ' pts</small>' + (r.mvp ? '<em>That is you! +25% rewards</em>' : '') + '</div>' : '') +
            '<div class="res-tiles">' + tile(my.kills, 'Kills') + tile(M.mode === 'ctf' ? my.flags : my.caps, M.mode === 'ctf' ? 'Flags' : 'Captures') + tile(fmt(my.dmg), 'Damage') + tile(my.deaths, 'Deaths') + '</div>' +
            '<div class="res-rew"><span><i class="ic cr"></i>+' + fmt(r.cr) + '</span><span><i class="ic rp"></i>+' + fmt(r.rp) + ' RP</span></div>' +
            '<div class="res-rp">' + (tgt ? 'Researching ' + esc(tgt.n) + (MODBY[save.target] ? ' (' + esc(VBY[MODBY[save.target].v].n) + ')' : '') + ': ' + fmt(rpOf(save.target)) + ' / ' + fmt(rpNeed(save.target)) + '<div class="bar"><i style="width:' + Math.min(100, 100 * rpOf(save.target) / rpNeed(save.target)) + '%"></i></div>' : 'Nothing selected for research: points go to your free RP (' + fmt(save.freeRp) + '). Pick a vehicle or module in Research.') + '</div>' +
            '<table class="board">' + (ffa ? head(-1) + sorted.map(row).join('') : [0, 1].map(t => head(t) + sorted.filter(e => e.team === t).map(row).join('')).join('')) + '</table>' +
            '<div class="res-btns">' + (PARTY.net ? '' : '<button class="btn" id="r-again">Play again</button>') + '<button class="btn big primary" id="r-go">' + (PARTY.net ? 'Back to the lobby' : 'Back to menu') + '</button></div>';
        $('#s-result').classList.remove('hidden'); $('#r-go').onclick = () => { sfx('click'); UI.leaveMatch(true); afterMatch(); };
        const ag = $('#r-again'); if (ag) ag.onclick = () => { sfx('click'); UI.leaveMatch(true); afterMatch(); startPlay(); if (M) Cam.lock(); };
    },
    paintPause() {
        if (!M) return; const left = Math.max(0, M.limit.time - M.t), clock = Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0');
        const v = t => M.mode === 'tdm' ? M.kills[t] : M.mode === 'ctf' ? M.caps[t] : M.mode === 'conq' ? Math.ceil(M.tickets[t]) : 0;
        $('#ps-info').innerHTML = '<span>' + esc(MODES[M.mode].name) + '</span><span>' + clock + ' left</span>' + (M.mode === 'ffa' ? '<span>' + (ME ? ME.kills : 0) + ' kills</span>' : '<span><b class="t0">' + v(0) + '</b> : <b class="t1">' + v(1) + '</b></span>');
    },
    // per-frame HUD
    hud(dt) {
        if (!M || !ME) return;
        UIS.hudT -= dt;
        drawMini(); drawOverlay();
        if (UIS.hudT > 0) return; UIS.hudT = .1;
        const left = Math.max(0, M.limit.time - M.t), clock = Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0');
        if (M.mode === 'ffa') {
            const top = Array.from(EN.values()).sort((a, b) => b.kills - a.kills)[0], rank = Array.from(EN.values()).filter(e => e.kills > ME.kills).length + 1;
            $('#h-score').innerHTML = '<div class="tm t0">' + ME.kills + '<small>YOU (#' + rank + ')</small></div><div class="tt">' + clock + '<small>to ' + M.limit.kills + '</small></div><div class="tm t1">' + (top ? top.kills : 0) + '<small>LEADER</small></div>';
        } else {
            const v = t => M.mode === 'tdm' ? M.kills[t] : M.mode === 'ctf' ? M.caps[t] : Math.ceil(M.tickets[t]), lab = M.mode === 'tdm' ? 'KILLS' : M.mode === 'ctf' ? 'FLAGS' : 'TICKETS';
            $('#h-score').innerHTML = '<div class="tm t0">' + v(0) + '<small>' + lab + '</small></div><div class="tt">' + clock + '</div><div class="tm t1">' + v(1) + '<small>' + lab + '</small></div>';
        }
        if (M.mode === 'conq') $$('#h-cap .cp').forEach(el => { const p = M.pts[+el.dataset.i], i = el.firstChild; const own = p.own; el.style.borderColor = own < 0 ? '#fff8' : teamHex(own); i.style.background = p.prog === 0 ? 'none' : teamHex(p.prog > 0 ? 1 : 0); i.style.height = Math.abs(p.prog) * 100 + '%'; });
        if (M.mode === 'ctf') $('#h-flags').innerHTML = M.flags.map(f => { const c = f.st === 'carry' ? EN.get(f.by) : null; return '<div class="fg" style="border-color:' + teamHex(f.t) + '"><i style="background:' + teamHex(f.t) + '"></i>' + (f.st === 'home' ? 'home' : f.st === 'drop' ? 'dropped' : 'taken' + (c ? ': ' + esc(c.name) : '')) + '</div>'; }).join('');
        const d = ME.def, hpk = clamp(ME.hp / d.hp, 0, 1);
        let w = '';
        const rl = (name, t, max, extra) => '<div><span>' + name + (extra || '') + '</span><div class="rl' + (t <= 0 ? ' rdy' : '') + '"><i style="width:' + clamp(100 * (1 - t / max), 0, 100) + '%"></i></div></div>';
        w += rl(d.w1.n, ME.t1, d.w1.rl);
        if (d.w2) w += d.w2.cnt ? rl(d.w2.n, ME.t2, d.w2.rl, ' ' + ME.a2) : rl(d.w2.n, ME.t2, d.w2.rl);
        if (d.w3) w += rl(d.w3.n, ME.t3, d.w3.rl, ' ' + ME.a3);
        let fl = d.heli ? 'Speed ' + Math.round(Math.abs(ME.speed) * 3.6) + ' km/h &middot; Alt ' + Math.round(ME.y - Math.max(0, GH(ME.x, ME.z))) + ' m' : d.ln === 'a' ? 'Speed ' + Math.round(ME.speed * 3.6) + ' km/h &middot; Alt ' + Math.round(ME.y) + ' m &middot; Throttle ' + Math.round(ME.thr * 100) + '%' : 'Speed ' + Math.round(Math.abs(ME.speed) * 3.6) + ' km/h' + (d.ln === 'n' ? ' &middot; Throttle ' + Math.round(ME.thr * 100) + '%' : '');
        if (ME.warn) fl += ' <b style="color:#ff6a5a">RETURN TO BATTLE AREA</b>';
        if (d.sub) fl += ' &middot; ' + (ME.dive > .5 ? '<b style="color:#7fe3ff">DIVED</b>' : 'surfaced');
        if (d.flares) fl += ' &middot; Flares ' + ME.nFl;
        if (ME.carry >= 0) fl += ' &middot; <b style="color:#ffd21f">CARRYING FLAG: go home!</b>';
        let warnMs = false; for (const p of PR) if (p.k === 'missile' && p.tg === ME.id) { warnMs = true; break; }
        if (warnMs) fl += ' <b style="color:#ff6a5a">MISSILE!</b>';
        $('#h-veh').innerHTML = '<div class="nm">' + esc(d.n) + ' <small>BR ' + brOf(d).toFixed(1) + '</small></div><div class="hp' + (hpk < .3 ? ' low' : '') + '"><i style="width:' + hpk * 100 + '%"></i><b>' + Math.max(0, Math.ceil(ME.hp)) + ' / ' + d.hp + '</b></div><div class="wp">' + w + '</div><div class="fl">' + fl + '</div>';
        if (!$('#s-pause').classList.contains('hidden')) UI.paintPause();
        const pr = $('#h-prot'); if (ME.alive && ME.prot > 0) { pr.textContent = 'SPAWN PROTECTION ' + ME.prot.toFixed(1) + ' s'; pr.classList.add('on'); } else pr.classList.remove('on');
        if (!ME.alive) { const sec = Math.max(0, ME.respT); if (sec <= 0 && UIS.autoDep) UI.deploy(); $('#d-sub').textContent = sec > 0 ? (UIS.autoDep ? 'Deploying in ' : 'You can deploy in ') + Math.ceil(sec) + ' s' : 'Pick a vehicle, then DEPLOY or Space'; const g = $('#d-go'); g.classList.toggle('wait', sec > 0); g.firstChild.textContent = sec > 0 ? (UIS.autoDep ? 'READY ' : 'DEPLOY IN ') + Math.ceil(sec) : 'DEPLOY'; const s = EN.get(Cam.specId); $('#d-spec').textContent = s && s.alive ? 'Watching ' + s.name + ' (click the screen for the next)' : ''; }
        // network: ping + reconnect banner
        const net = $('#h-net');
        if (PARTY.net && !PARTY.solo) {
            let jit = 0, n = 0; for (const k in CLK) { jit += CLK[k].jv; n++; } jit = n ? jit / n : 0;
            net.innerHTML = PARTY.host ? '<b>HOST</b> ' + EN.size + ' vehicles' : pingBars((PARTY.rtt || 0) + jit * 2, PARTY.recon ? 'r' : 'connected') + ' ' + Math.round(PARTY.rtt || 0) + ' ms' + (jit > 25 ? ' <small>jitter ' + Math.round(jit) + '</small>' : '');
            net.style.display = '';
            const stale = !PARTY.host && M.lastM && performance.now() - M.lastM > 3000;
            const t = UIS.banner || (PARTY.recon ? 'Reconnecting...' : stale || PARTY.lag ? 'Connection unstable: waiting for the host...' : '');
            const b = $('#h-banner'); b.textContent = t; b.classList.toggle('on', !!t);
        } else net.style.display = 'none';
        const b = $('#h-board'); b.classList.toggle('hidden', !UIS.board);
        if (UIS.board) {
            const ents = Array.from(EN.values()).sort((a, b) => b.score - a.score || b.kills - a.kills);
            const rows = L => L.map(e => '<tr' + (e === ME ? ' class="me"' : '') + '><td style="color:' + entHex(e) + '">' + (e.carry >= 0 ? '&#9873; ' : '') + esc(e.name) + (e.recon || e.stale ? ' <small class="bad">reconnecting</small>' : '') + '</td><td>' + esc(e.def.n) + '</td><td>' + brOf(e.def).toFixed(1) + '</td><td>' + Math.round(e.score) + '</td><td>' + e.kills + '</td><td>' + e.deaths + '</td><td>' + (M.mode === 'ctf' ? e.flags : e.caps) + '</td><td>' + (e.isBot ? 'BOT' : e === ME && M.host ? 'host' : Math.round(e === ME ? PARTY.rtt || 0 : e.q || 0) + ' ms') + '</td></tr>').join('');
            const hd = (t, n) => '<tr><th style="color:' + (t < 0 ? '#fff' : teamHex(t)) + '">' + n + '</th><th>Vehicle</th><th>BR</th><th>Score</th><th>K</th><th>D</th><th>' + (M.mode === 'ctf' ? 'Flags' : 'Caps') + '</th><th>Ping</th></tr>';
            b.innerHTML = '<div class="bt">' + MODES[M.mode].name + ' &middot; ' + WX[WXK].name + '</div><table>' + (M.mode === 'ffa' ? hd(-1, 'PLAYERS') + rows(ents) : hd(0, 'BLUE') + rows(ents.filter(e => e.team === 0)) + hd(1, 'RED') + rows(ents.filter(e => e.team === 1))) + '</table>';
        }
    }
};
function entHex(e) { return M && M.mode === 'ffa' ? (e === ME ? teamHex(0) : teamHex(1)) : teamHex(e.team); }
// ---------- minimap + on-screen markers ----------
const miniC = $('#h-map').getContext('2d');
const hiddenSub = e => e.dive > .5 && ME && foe(e, ME) && !(ME.def.radar && d3(ME, e) < 250) && d3(ME, e) > 90;
function drawMini() {
    const c = miniC, S = 180, k = S / (EXT * 2);
    c.drawImage(miniCv, 0, 0);
    if (M.R < EXT) { c.strokeStyle = '#ff6a5a88'; c.lineWidth = 1; c.strokeRect((EXT - M.R) * k, 0, M.R * 2 * k, S); }
    if (M.mode === 'conq') PTS.forEach((p, i) => { const o = M.pts[i].own; c.fillStyle = o < 0 ? '#ddd' : teamHex(o); c.strokeStyle = '#000'; c.beginPath(); c.arc((p.x + EXT) * k, (p.z + EXT) * k, 6, 0, TAU); c.fill(); c.stroke(); });
    if (M.mode === 'ctf') M.flags.forEach(f => { c.fillStyle = teamHex(f.t); c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.moveTo((f.x + EXT) * k, (f.z + EXT) * k); c.lineTo((f.x + EXT) * k, (f.z + EXT) * k - 10); c.lineTo((f.x + EXT) * k + 7, (f.z + EXT) * k - 7); c.lineTo((f.x + EXT) * k, (f.z + EXT) * k - 4); c.fill(); c.stroke(); });
    for (const e of EN.values()) {
        if (!e.alive || hiddenSub(e)) continue;
        const x = (e.x + EXT) * k, y = (e.z + EXT) * k;
        c.save(); c.translate(x, y); c.rotate(-e.yaw + PI); c.fillStyle = entHex(e); c.strokeStyle = e === ME ? '#fff' : '#000'; c.lineWidth = e === ME ? 2 : 1;
        c.beginPath(); if (e.def.ln === 'a') { c.moveTo(0, 5); c.lineTo(4, -4); c.lineTo(0, -2); c.lineTo(-4, -4); } else if (e.def.ln === 'n') { c.moveTo(0, 6); c.lineTo(3, -4); c.lineTo(-3, -4); } else { c.rect(-3, -3, 6, 6); }
        c.closePath(); c.fill(); c.stroke(); c.restore();
    }
}
const ovc = $('#ov').getContext('2d'), PV = new THREE.Vector3();
function proj(x, y, z) { PV.set(x, y, z).project(camera); if (PV.z > 1 || PV.z < -1) return null; return [(PV.x * .5 + .5) * $('#ov').width, (-PV.y * .5 + .5) * $('#ov').height, PV.z]; }
function drawOverlay() {
    const W = $('#ov').width, Hh = $('#ov').height, c = ovc; c.clearRect(0, 0, W, Hh); c.font = 'bold 12px Trebuchet MS,sans-serif'; c.textAlign = 'center';
    for (const e of EN.values()) {
        if (e === ME || !e.alive || hiddenSub(e)) continue;
        const dx = e.x - camera.position.x, dy = e.y - camera.position.y, dz = e.z - camera.position.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const p = proj(e.x, e.y + (e.def.ln === 'a' ? 5 : 7), e.z); if (!p || d > 1100) continue;
        const friend = !foe(e, ME), col = friend ? '#7cc0ff' : '#ff6060', y = clamp(p[1], 14, Hh - 14), x = clamp(p[0], 10, W - 10);
        c.fillStyle = col; c.strokeStyle = '#000'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(x, y + 8); c.lineTo(x - 6, y - 2); c.lineTo(x + 6, y - 2); c.closePath(); c.fill(); c.stroke();
        if (d < 600 || !friend) { c.fillStyle = '#fff'; c.fillText((e.carry >= 0 ? '⚑ ' : '') + (d < 420 || e.carry >= 0 ? e.name + ' ' : '') + Math.round(d) + 'm', x, y - 6); }      // far away: just the distance, so a distant group is not a pile of names
        if (e.stale || e.recon) { c.fillStyle = '#ffd21f'; c.fillText('reconnecting...', x, y - 19); }
        if (d < 450) { const w = 40, hk = clamp(e.hp / e.def.hp, 0, 1); c.fillStyle = '#0009'; c.fillRect(x - w / 2, y + 11, w, 4); c.fillStyle = col; c.fillRect(x - w / 2, y + 11, w * hk, 4); }
    }
    if (M.mode === 'conq') PTS.forEach((pt, i) => {
        const p = proj(pt.x, pt.y + 16, pt.z); if (!p) return; const o = M.pts[i].own, d = Math.round(Math.hypot(pt.x - camera.position.x, pt.z - camera.position.z));
        c.fillStyle = o < 0 ? '#ddd' : teamHex(o); c.strokeStyle = '#000'; c.font = 'bold 16px Trebuchet MS'; c.strokeText(pt.name, p[0], p[1]); c.fillText(pt.name, p[0], p[1]); c.font = 'bold 11px Trebuchet MS'; c.fillText(d + 'm', p[0], p[1] + 13);
    });
    if (M.mode === 'ctf') M.flags.forEach(f => {
        const p = proj(f.x, GH(f.x, f.z) + 12, f.z); if (!p) return; c.font = 'bold 13px Trebuchet MS'; c.fillStyle = teamHex(f.t); c.strokeStyle = '#000';
        const t = (f.t === ME.team ? 'YOUR FLAG' : 'ENEMY FLAG') + (f.st === 'drop' ? ' (dropped)' : f.st === 'carry' ? ' (taken)' : ''); c.strokeText(t, p[0], p[1]); c.fillText(t, p[0], p[1]);
    });
    if (UIS.dn && UIS.dn.length) {
        const now = performance.now(); UIS.dn = UIS.dn.filter(d => now - d.t0 < 1100);
        for (const d of UIS.dn) {
            const a = (now - d.t0) / 1100, p = proj(d.x, d.y, d.z); if (!p) continue;
            c.globalAlpha = 1 - a * a; c.font = '900 ' + Math.round(d.big ? 22 + Math.min(10, d.n / 40) : 15) + 'px Trebuchet MS,sans-serif';
            c.lineWidth = 3; c.strokeStyle = '#000'; c.fillStyle = d.big ? '#ffb020' : '#fff'; const y = p[1] - a * 36;
            c.strokeText(d.n, p[0], y); c.fillText(d.n, p[0], y);
        }
        c.globalAlpha = 1; c.lineWidth = 1;
    }
    if (ME.alive && Cam.mlock && Cam.mlock.alive) {      // missile seeker: yellow brackets close in while locking, red LOCK when ready
        const o = Cam.mlock, p = proj(o.x, o.y + (o.def.ln === 'a' ? 0 : 1.5), o.z);
        if (p) {
            const k = clamp(Cam.mlT / LOCK_T, 0, 1), lk = k >= 1, s = 30 - 14 * k, L = 8, x = p[0], y = p[1];
            c.strokeStyle = lk ? '#ff3b30' : '#ffd21f'; c.lineWidth = lk ? 3 : 2; c.beginPath();
            for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { c.moveTo(x + sx * s, y + sy * (s - L)); c.lineTo(x + sx * s, y + sy * s); c.lineTo(x + sx * (s - L), y + sy * s); }
            c.stroke(); c.font = 'bold 11px Trebuchet MS,sans-serif'; c.fillStyle = c.strokeStyle; c.fillText(lk ? 'LOCK' : 'LOCKING', x, y + s + 13);
        }
    }
    if (ME.alive && Cam.lead) {
        const p = proj(Cam.lead.x, Cam.lead.y, Cam.lead.z);
        if (p) { c.strokeStyle = '#ff5a4a'; c.lineWidth = 2; c.beginPath(); c.moveTo(p[0], p[1] - 9); c.lineTo(p[0] + 9, p[1]); c.lineTo(p[0], p[1] + 9); c.lineTo(p[0] - 9, p[1]); c.closePath(); c.stroke(); }
    }
    if (ME.alive && (ME.def.ln !== 'a' || ME.def.heli) && Cam.aimD) {
        const m = muzzleWorld(ME, 0), dd = Cam.aimD, fx = Math.sin(ME.tur) * Math.cos(ME.gun), fy = Math.sin(ME.gun), fz = Math.cos(ME.tur) * Math.cos(ME.gun);
        const w = ME.def.w1, tt = dd / (w.v || 200), drop = w.k === 'missile' ? 0 : 0.5 * w.g * tt * tt;
        const p = ME.def.w1.arty ? null : proj(m.x + fx * dd, m.y + fy * dd - drop, m.z + fz * dd);
        if (p) { c.strokeStyle = '#ffd21f'; c.lineWidth = 2; c.beginPath(); c.arc(p[0], p[1], 7, 0, TAU); c.stroke(); }
        if (ME.def.w1.arty && Cam.aim) { const q = proj(Cam.aim.x, Cam.aim.y, Cam.aim.z); if (q) { c.strokeStyle = Cam.solOk ? '#ffd21f' : '#ff5a4a'; c.lineWidth = 2; c.beginPath(); c.arc(q[0], q[1], 14, 0, TAU); c.moveTo(q[0] - 20, q[1]); c.lineTo(q[0] + 20, q[1]); c.moveTo(q[0], q[1] - 20); c.lineTo(q[0], q[1] + 20); c.stroke(); c.fillStyle = '#fff'; c.fillText(Cam.solOk ? Math.round(Cam.aimD) + ' m' : 'OUT OF RANGE', q[0], q[1] + 32); } }
    } else if (ME.alive && ME.def.ln === 'a') {
        const f = 400, p = proj(ME.x + Math.sin(ME.yaw) * Math.cos(ME.pitch) * f, ME.y + Math.sin(ME.pitch) * f, ME.z + Math.cos(ME.yaw) * Math.cos(ME.pitch) * f);
        if (p) { c.strokeStyle = '#ffd21f'; c.lineWidth = 2; c.beginPath(); c.arc(p[0], p[1], 8, 0, TAU); c.moveTo(p[0] - 14, p[1]); c.lineTo(p[0] - 8, p[1]); c.moveTo(p[0] + 14, p[1]); c.lineTo(p[0] + 8, p[1]); c.stroke(); }
    }
}
// ---------- wiring ----------
function bindUI() {
    bindMenu();
    $('#h-say').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { sendChat(e.target.value); e.target.value = ''; e.target.classList.add('hidden'); e.target.blur(); if (ME && ME.alive) Cam.lock(); } else if (e.key === 'Escape') { e.target.classList.add('hidden'); e.target.blur(); } });
    $('#d-go').onclick = () => UI.deploy();
    $('#d-lineup').addEventListener('click', e => { const dc = e.target.closest('[data-did]'); if (dc) { UIS.selDead = dc.dataset.did; UI.paintDead(); } });
    $('#ps-resume').onclick = () => { $('#s-pause').classList.add('hidden'); Cam.lock(); };
    $('#ps-settings').onclick = () => { $('#s-pause').classList.add('hidden'); UI.open('s-settings'); };
    $('#ps-how').onclick = () => { $('#s-pause').classList.add('hidden'); UI.open('s-how'); };
    $('#ps-leave').onclick = () => {      // a guest hands its vehicle to a bot; the host ends the battle for everyone (score so far decides)
        if (M && !M.over && netOn()) { if (M.host) { M.limit.time = 0; hostCheckEnd(); $('#s-pause').classList.add('hidden'); return; } toHost({ t: 'quit' }); }
        UI.leaveMatch(true); afterMatch();
    };
}
function fallbackCopy(t) { try { const i = document.createElement('textarea'); i.value = t; document.body.appendChild(i); i.select(); document.execCommand('copy'); i.remove(); } catch (e) {} }
