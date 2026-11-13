// ============================================================
// UI: main menu, party lobby, research tree (branches + modules), garage, settings, HUD, minimap, death + result screens.
// ============================================================
const UIS = { rs: null, gs: null, rln: 'g', screen: 'menu', selDead: null, hudT: 0, msgT: 0, hitT: 0, board: false, lobby: false, spec: -1 };
const OPTS = [
    ['size', 'Team size', [[3, '3v3'], [5, '5v5'], [8, '8v8']]],
    ['len', 'Length', [[5, '5 min'], [10, '10 min'], [15, '15 min']]],
    ['map', 'Map size', [['small', 'Small'], ['normal', 'Normal'], ['large', 'Large']]],
    ['wx', 'Weather', [['noon', 'Noon'], ['evening', 'Evening'], ['overcast', 'Rain'], ['night', 'Night'], ['random', '?']]],
    ['bots', 'Bots', [['off', 'Off'], ['match', 'Match me'], ['mixed', 'Mixed']]],
    ['diff', 'Bot skill', [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']]],
    ['ff', 'Friendly fire', [[0, 'Off'], [1, 'On']]]
];
function optVal(k) { return k in save.opts ? save.opts[k] : save[k]; }
function setOpt(k, v) {
    if (k === 'size' || k === 'len' || k === 'ff') v = +v;
    if (k in save.opts) save.opts[k] = v; else save[k] = v;
    writeSave(); UI.paintMenu(); UI.paintLobby(); partySettingsChanged();
}
function optsHtml(dis) {
    return OPTS.map(([k, n, vals]) => '<div class="opt"><span>' + n + '</span><div class="seg">' + vals.map(([v, l]) => '<button data-opt="' + k + '" data-v="' + v + '"' + (String(optVal(k)) === String(v) ? ' class="on"' : '') + (dis ? ' disabled' : '') + '>' + l + '</button>').join('') + '</div></div>').join('');
}
const pingBars = (ms, st) => { const n = st && st !== 'connected' ? 0 : ms < 90 ? 4 : ms < 160 ? 3 : ms < 260 ? 2 : 1, c = n >= 3 ? '#6df07a' : n === 2 ? '#ffd21f' : '#ff6a5a'; let h = '<span class="bars">'; for (let i = 1; i <= 4; i++) h += '<i style="height:' + (i * 25) + '%;background:' + (i <= n ? c : '#fff3') + '"></i>'; return h + '</span>'; };
const UI = {
    showMenu() { UIS.screen = 'menu'; ovc.clearRect(0, 0, 4000, 4000); $('#menu').classList.remove('hidden'); $$('#s-research,#s-garage,#s-settings,#s-how,#hud,#s-dead,#s-pause,#s-result').forEach(e => e.classList.add('hidden')); UI.paintMenu(); UI.paintLobby(); },
    open(id) { $('#' + id).classList.remove('hidden'); if (id === 's-research') UI.paintResearch(); if (id === 's-garage') UI.paintGarage(); if (id === 's-settings') UI.paintSettings(); },
    close(id) { $('#' + id).classList.add('hidden'); UI.paintMenu(); },
    notice(t, h) { $('#nt-h').textContent = h || 'Party'; $('#nt-t').textContent = t; $('#s-notice').classList.remove('hidden'); toast(t); },
    banner(t) { UIS.banner = t; const b = $('#h-banner'); if (b) { b.textContent = t; b.classList.toggle('on', !!t); } if (t) toast(t); },
    wallet() {
        $('#w-cr').textContent = fmt(save.credits); $('#w-fr').textContent = fmt(save.freeRp);
        const t = save.target; $('#w-rp').textContent = t && (VBY[t] || MODBY[t]) ? fmt(rpOf(t)) + '/' + fmt(rpNeed(t)) : '-';
        $$('.v-cr').forEach(e => e.textContent = fmt(save.credits)); $$('.v-fr').forEach(e => e.textContent = fmt(save.freeRp));
    },
    paintMenu() {
        UI.wallet();
        const guest = PARTY.net && !PARTY.host;
        $$('#menu .mode').forEach(b => { b.classList.toggle('on', b.dataset.m === save.mode); b.disabled = !!guest; });
        $('#m-opts').innerHTML = optsHtml(guest);
        $('#m-lead-note').textContent = guest ? 'The party host picks the options.' : PARTY.net ? 'Teams are set in the party lobby.' : 'Solo: you and bots. Bots use vehicles near your battle rating.';
        $('#b-play').textContent = PARTY.net ? 'LOBBY' : 'PLAY'; $('#b-play').disabled = false;
        const nm = $('#m-name'); if (document.activeElement !== nm) nm.value = myName(); nm.disabled = !!LP() && !!(() => { try { return window.parent.HGGrapevine && window.parent.HGGrapevine.me && window.parent.HGGrapevine.me(); } catch (e) { return null; } })();
        const slots = []; for (let i = 0; i < 5; i++) { const id = save.lineup[i], v = id && VBY[id]; slots.push(v ? chipHtml(v, i === save.sel, 'data-i="' + i + '"') : '<div class="chip empty"><b>Empty</b><small>Garage</small></div>'); }
        $('#lineup').innerHTML = slots.join('');
        $('#m-br').textContent = 'Your battle rating: ' + lineupBr().toFixed(1);
        UI.paintParty();
    },
    paintMenuSel() { UI.paintMenu(); },
    paintParty() {
        const live = !!PARTY.code;
        $('#p-idle').classList.toggle('hidden', live); $('#p-live').classList.toggle('hidden', !live);
        $('#p-codev').textContent = PARTY.code || '------';
        $('#p-list').innerHTML = rosterNow().map(p => '<div class="pm"><span class="dot t' + (p.team | 0) + 'b"></span>' + (p.id === 0 ? '<span class="star">&#9733;</span>' : '') + esc(p.name) + '<small>' + esc((VBY[p.veh] || VBY.g1a).n) + '</small></div>').join('');
        const st = $('#p-status'); st.textContent = PARTY.status || ''; st.className = 'note' + (PARTY.bad ? ' bad' : '');
        $('#p-create').disabled = !!PARTY.busy; $('#p-join').disabled = !!PARTY.busy;
        UI.paintLobby();
    },
    refreshLobby() { if (typeof Lobby !== 'undefined') Lobby.refresh(); },
    openLobby() { if (!PARTY.code) return; UIS.lobby = true; UI.paintLobby(); },
    closeLobby() { UIS.lobby = false; $('#s-lobby').classList.add('hidden'); },
    paintLobby() {
        const el = $('#s-lobby'), show = UIS.lobby && !!PARTY.code && !M; el.classList.toggle('hidden', !show); $('#menu').classList.toggle('lobby-on', show);
        if (!show) return;
        const host = PARTY.host, o = PARTY.opts || lobbyOpts(), ffa = o.mode === 'ffa', R = rosterNow(), me = R.find(p => p.id === PARTY.myId);
        $('#lb-code').textContent = PARTY.code;
        $('#lb-mode').innerHTML = (host ? Object.keys(MODES).map(k => '<button class="mb' + (o.mode === k ? ' on' : '') + '" data-opt="mode" data-v="' + k + '">' + MODES[k].name + '</button>').join('') : '<b>' + MODES[o.mode].name + '</b>') + '<small>' + esc(MODES[o.mode].desc) + (PARTY.inMatch ? ' &middot; battle in progress: you can join it' : '') + '</small>';
        $('#lb-net').innerHTML = host ? '<b>HOST</b>' : pingBars(PARTY.rtt || 0, PARTY.recon ? 'r' : 'connected') + ' ' + Math.round(PARTY.rtt || 0) + ' ms';
        const row = p => {
            const v = VBY[p.veh] || VBY.g1a, br = brOf(vdef(p.veh, p.mm));
            return '<div class="lp' + (p.id === PARTY.myId ? ' me' : '') + '"><div class="lp-n">' + (p.id === 0 ? '<span class="star">&#9733;</span>' : '') + esc(p.name) + (p.st && p.st !== 'connected' ? ' <small class="bad">' + esc(p.st) + '</small>' : '') + '<span class="rdy' + (p.ready ? ' on' : '') + '">' + (p.id === 0 ? 'HOST' : p.ready ? 'READY' : 'not ready') + '</span>' + (p.id ? pingBars(p.ping || 0, p.st) : '') + '</div>' +
                '<div class="lp-v"><span class="ln ln-' + v.ln + '"></span>' + esc(v.n) + ' <small>' + CLS_NAME[v.cls] + ' &middot; BR ' + br.toFixed(1) + '</small></div>' +
                '<div class="lp-l">' + (p.line || []).map(x => VBY[x[0]] ? '<span class="mini ln-' + VBY[x[0]].ln + 'b" title="' + esc(VBY[x[0]].n) + '">' + esc(VBY[x[0]].n.split(' ')[0]) + ' ' + (+x[1]).toFixed(1) + '</span>' : '').join('') + '</div>' +
                (host && p.id !== 0 ? '<div class="lp-h">' + (!ffa ? '<button class="btn small" data-move="' + p.id + '" title="Move to the other team">&#8644;</button>' : '') + '<button class="btn small danger" data-kick="' + p.id + '" title="Remove from the party">&#10006;</button></div>' : '') + '</div>';
        };
        const size = o.size || 5;
        if (ffa) $('#lb-teams').innerHTML = '<div class="tcol ffa"><h3>Everyone <small>' + R.length + ' players' + (o.bots !== 'off' ? ', bots fill to ' + Math.min(12, size * 2) : '') + '</small></h3>' + R.map(row).join('') + '</div>';
        else $('#lb-teams').innerHTML = [0, 1].map(t => { const L = R.filter(p => (p.team | 0) === t); return '<div class="tcol t' + t + '"><h3 data-team="' + t + '">' + (t ? 'RED' : 'BLUE') + ' TEAM <small>' + L.length + ' / ' + size + (o.bots !== 'off' ? ' (+' + Math.max(0, size - L.length) + ' bots)' : '') + '</small>' + (me && (me.team | 0) !== t && !PARTY.inMatch ? '<button class="btn small" data-team="' + t + '">Join</button>' : '') + '</h3>' + L.map(row).join('') + '</div>'; }).join('');
        $('#lb-opts').innerHTML = optsHtml(!host); $('#lb-optnote').textContent = host ? '' : '(the host decides)';
        $('#lb-tools').classList.toggle('hidden', !host || ffa);
        $('#lb-mine').innerHTML = save.lineup.map((id, i) => chipHtml(VBY[id], i === save.sel, 'data-i="' + i + '"')).join('');
        const b = $('#lb-ready');
        if (host) { const nr = R.filter(p => p.id !== 0 && !p.ready).length; b.textContent = PARTY.inMatch ? 'IN BATTLE' : nr ? 'START (' + nr + ' not ready)' : 'START'; b.disabled = PARTY.inMatch; }
        else if (PARTY.inMatch) { b.textContent = 'JOIN BATTLE'; b.disabled = false; }
        else { b.textContent = me && me.ready ? 'READY!' : 'READY'; b.classList.toggle('on', !!(me && me.ready)); b.disabled = false; }
        UI.paintChat();
    },
    paintChat() {
        const L = $('#lb-log'); if (!L) return;
        L.innerHTML = PARTY.chat.slice(-40).map(c => c.sys || c.x.startsWith('* ') ? '<div class="sys">' + esc(c.x.replace(/^\* /, '')) + '</div>' : '<div><b' + (c.me ? ' class="me"' : '') + '>' + esc(c.n) + ':</b> ' + esc(c.x) + '</div>').join('');
        L.scrollTop = 1e6;
    },
    // ----- research tree -----
    paintResearch() {
        UI.wallet(); const ln = UIS.rln, br = BRANCHES[ln];
        $$('#rs-tabs button').forEach(b => b.classList.toggle('on', b.dataset.ln === ln));
        let h = '<div class="grid" style="grid-template-columns:28px repeat(' + br.length + ',minmax(110px,1fr))"><div></div>' + br.map(([k, n]) => '<div class="bh">' + n + '</div>').join('');
        for (let t = 1; t <= MAX_TIER; t++) {
            h += '<div class="th">' + TIER_ROMAN[t] + '</div>';
            for (const [k] of br) h += '<div class="cell">' + VEHS.filter(v => v.ln === ln && v.t === t && v.cls === k).map(researchCard).join('') + '</div>';
        }
        $('#tree').innerHTML = h + '</div>'; UI.paintInfo('rs');
    },
    paintInfo(which) {
        const id = which === 'rs' ? UIS.rs : UIS.gs, el = which === 'rs' ? $('#rs-info') : $('#g-info'), v = id && VBY[id];
        if (!v) { el.innerHTML = '<h3>Vehicle</h3><div class="note">Click a vehicle to see it.</div>'; return; }
        const d = isOwned(id) ? vdef(id, modMask(id)) : v;
        let h = '<h2>' + esc(v.n) + '</h2><div class="note">' + LINES[v.ln].tag + ' &middot; ' + CLS_NAME[v.cls] + ' &middot; Tier ' + TIER_ROMAN[v.t] + '</div><p>' + esc(v.desc || '') + '</p><div class="st">' + vStats(d).map(s => '<span>' + s[0] + '</span><b>' + s[1] + '</b>').join('') + '</div>';
        if (isOwned(id)) {
            h += '<div class="note">You own this vehicle.</div><button class="btn big" data-act="line" data-id="' + id + '">' + (save.lineup.includes(id) ? 'Remove from lineup' : 'Add to lineup') + '</button>';
            h += '<h3 style="margin-top:12px">Modules</h3>' + v.mods.map(m => {
                const done = !!save.mods[m.id], tgt = save.target === m.id;
                return '<div class="mod' + (done ? ' done' : '') + '"><b>' + esc(m.n) + '</b><small>' + esc(m.desc) + '</small>' + (done ? '<span class="tag ok">INSTALLED</span>' :
                    '<div class="bar"><i style="width:' + (100 * rpOf(m.id) / m.rp) + '%"></i></div><small>' + fmt(rpOf(m.id)) + ' / ' + fmt(m.rp) + ' RP</small><div class="row"><button class="btn small" data-act="target" data-id="' + m.id + '"' + (tgt ? ' disabled' : '') + '>' + (tgt ? 'Researching' : 'Research') + '</button><button class="btn small" data-act="free" data-id="' + m.id + '"' + (save.freeRp <= 0 ? ' disabled' : '') + '>Free RP</button></div>') + '</div>';
            }).join('');
        } else if (isResearched(id)) {
            h += '<button class="btn big" data-act="buy" data-id="' + id + '"' + (save.credits < v.cost ? ' disabled' : '') + '>Buy for ' + fmt(v.cost) + ' credits</button>';
        } else if (canResearch(id)) {
            h += '<div class="note">' + fmt(rpOf(id)) + ' / ' + fmt(v.rp) + ' research points</div><div class="bar"><i style="width:' + (100 * rpOf(id) / v.rp) + '%"></i></div>';
            h += '<button class="btn big" data-act="target" data-id="' + id + '"' + (save.target === id ? ' disabled' : '') + '>' + (save.target === id ? 'Researching now' : 'Research this (match RP go here)') + '</button>';
            h += '<button class="btn" data-act="free" data-id="' + id + '"' + (save.freeRp <= 0 ? ' disabled' : '') + '>Spend free RP (' + fmt(save.freeRp) + ')</button><div class="note">Then buy it for ' + fmt(v.cost) + ' credits.</div>';
        } else h += '<div class="note bad">Locked. Research ' + esc(VBY[v.req].n) + ' first.</div>';
        el.innerHTML = h;
    },
    paintGarage() {
        UI.wallet();
        $('#g-lineup').innerHTML = save.lineup.map((id, i) => chipHtml(VBY[id], i === save.sel, 'data-lid="' + id + '"')).join('');
        $('#g-owned').innerHTML = ['g', 'a', 'n'].map(ln => '<h4 class="gh" style="color:' + LINES[ln].col + '">' + LINES[ln].name + '</h4><div class="cards">' + VEHS.filter(v => v.ln === ln && isOwned(v.id)).map(v => '<div class="vc owned' + (save.lineup.includes(v.id) ? ' sel' : '') + '" data-gid="' + v.id + '"><span class="tag t">' + TIER_ROMAN[v.t] + '</span><b><span class="ln ln-' + v.ln + '"></span>' + esc(v.n) + '</b><small>' + CLS_NAME[v.cls] + ' &middot; BR ' + brOf(vdef(v.id, modMask(v.id))).toFixed(1) + ' &middot; ' + popc(modMask(v.id)) + '/5 mods</small></div>').join('') + '</div>').join('');
        UI.paintInfo('gs');
    },
    paintSettings() { $('#st-q').value = save.settings.quality; $('#st-sens').value = save.settings.sens; $('#st-vol').value = save.settings.vol; $('#st-inv').checked = !!save.settings.invertY; const q = save.settings.quality; $('#st-qnote').textContent = q === 'low' ? 'No shadows, fewer trees and particles, simple water and ground.' : q === 'med' ? 'Shadows, textured ground and water, 2 flash lights.' : 'Soft 2048 shadows, full trees and particles, 4 flash lights, longest view.'; },
    // ----- match HUD -----
    enterMatch() {
        $('#menu').classList.add('hidden'); UI.closeLobby(); UIS.lobby = !!PARTY.code; $$('#s-research,#s-garage,#s-settings,#s-how,#s-dead,#s-pause,#s-result,#s-new').forEach(e => e.classList.add('hidden'));
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
        UIS.spec = k && k !== ME ? k.id : -1;
        UIS.selDead = UIS.selDead && save.lineup.includes(UIS.selDead) ? UIS.selDead : myVeh();
        UI.paintDead();
    },
    paintDead() {
        $('#d-lineup').innerHTML = save.lineup.map(id => chipHtml(VBY[id], id === UIS.selDead, 'data-did="' + id + '"')).join('');
    },
    deployed() { $('#s-dead').classList.add('hidden'); $('#h-lock').classList.remove('hidden'); Cam.reset(); UI.hintFor(ME.def); },
    showResult() {
        if (document.pointerLockElement) document.exitPointerLock();
        $$('#s-dead,#s-pause').forEach(e => e.classList.add('hidden'));
        const r = M.reward, my = M.my, ents = Array.from(EN.values()), ffa = M.mode === 'ffa', mvp = EN.get(M.mvp);
        const sorted = ents.slice().sort((a, b) => b.score - a.score || b.kills - a.kills), rank = sorted.indexOf(ME) + 1;
        const row = e => '<tr' + (e === ME ? ' class="me"' : '') + '><td style="color:' + entHex(e) + '">' + (e === mvp ? '&#9733; ' : '') + esc(e.name) + (e === ME ? ' (you)' : '') + '</td><td>' + esc(e.def.n) + '</td><td>' + Math.round(e.score) + '</td><td>' + e.kills + '</td><td>' + e.deaths + '</td><td>' + (M.mode === 'ctf' ? e.flags : e.caps) + '</td></tr>';
        const head = t => '<tr><th style="color:' + (t < 0 ? '#fff' : teamHex(t)) + '">' + (t < 0 ? 'Players' : t ? 'Red team' : 'Blue team') + '</th><th>Vehicle</th><th>Score</th><th>K</th><th>D</th><th>' + (M.mode === 'ctf' ? 'Flags' : 'Caps') + '</th></tr>';
        const tgt = save.target && (VBY[save.target] || MODBY[save.target]);
        const title = ffa ? (rank === 1 ? 'WINNER!' : '#' + rank + ' of ' + ents.length) : r.win ? 'VICTORY' : r.draw ? 'DRAW' : 'DEFEAT';
        $('#r-card').innerHTML = '<p class="res-h ' + (r.win || (ffa && rank === 1) ? 'win' : r.draw ? '' : 'loss') + '">' + title + '</p>' +
            (mvp ? '<div class="mvp"><span>MVP</span><b style="color:' + entHex(mvp) + '">' + esc(mvp.name) + '</b><small>' + esc(mvp.def.n) + ' &middot; ' + mvp.kills + ' kills &middot; ' + Math.round(mvp.score) + ' pts</small>' + (r.mvp ? '<em>That is you! +25% rewards</em>' : '') + '</div>' : '') +
            '<div class="res-g"><span>Kills <b>' + my.kills + '</b></span><span>' + (M.mode === 'ctf' ? 'Flags' : 'Captures') + ' <b>' + (M.mode === 'ctf' ? my.flags : my.caps) + '</b></span><span>Damage <b>' + fmt(my.dmg) + '</b></span><span>Deaths <b>' + my.deaths + '</b></span>' +
            '<span>Credits earned <b>+' + fmt(r.cr) + '</b></span><span>Research points <b>+' + fmt(r.rp) + '</b></span></div>' +
            '<div class="note">' + (tgt ? 'Researching ' + esc(tgt.n) + (MODBY[save.target] ? ' (' + esc(VBY[MODBY[save.target].v].n) + ')' : '') + ': ' + fmt(rpOf(save.target)) + '/' + fmt(rpNeed(save.target)) : 'Nothing selected for research: points go to your free RP (' + fmt(save.freeRp) + '). Pick a vehicle or module in Research.') + '</div>' +
            '<table class="board">' + (ffa ? head(-1) + sorted.map(row).join('') : [0, 1].map(t => head(t) + sorted.filter(e => e.team === t).map(row).join('')).join('')) + '</table>' +
            '<button class="btn big" id="r-go">' + (PARTY.net ? 'Back to the lobby' : 'Back to menu') + '</button>';
        $('#s-result').classList.remove('hidden'); $('#r-go').onclick = () => { sfx('click'); UI.leaveMatch(true); afterMatch(); };
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
        const pr = $('#h-prot'); if (ME.alive && ME.prot > 0) { pr.textContent = 'SPAWN PROTECTION ' + ME.prot.toFixed(1) + ' s'; pr.classList.add('on'); } else pr.classList.remove('on');
        if (!ME.alive) { const sec = Math.max(0, ME.respT); $('#d-sub').textContent = sec > 0 ? 'You can deploy in ' + Math.ceil(sec) + ' s' : 'Choose a vehicle and deploy'; $('#d-go').disabled = sec > 0; $('#d-go').textContent = sec > 0 ? 'WAIT ' + Math.ceil(sec) : 'DEPLOY'; const s = EN.get(Cam.specId); $('#d-spec').textContent = s && s.alive ? 'Watching ' + s.name + ' (click the screen for the next)' : ''; }
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
function chipHtml(v, sel, attrs) { return '<div class="chip' + (sel ? ' sel' : '') + '" ' + attrs + '><span class="tier">' + TIER_ROMAN[v.t] + '</span><b><span class="ln ln-' + v.ln + '"></span>' + esc(v.n) + '</b><small>' + CLS_NAME[v.cls] + ' ' + brOf(vdef(v.id, modMask(v.id))).toFixed(1) + '</small></div>'; }
function researchCard(v) {
    let cls = 'lock', tag = '', sub = 'Locked', bar = '';
    if (isOwned(v.id)) { cls = 'owned'; tag = '<span class="tag ok">' + popc(modMask(v.id)) + '/5</span>'; sub = 'Owned'; }
    else if (isResearched(v.id)) { cls = 'res'; tag = '<span class="tag t">BUY</span>'; sub = fmt(v.cost) + ' cr'; }
    else if (canResearch(v.id)) { cls = 'can'; sub = fmt(rpOf(v.id)) + ' / ' + fmt(v.rp) + ' RP'; bar = '<div class="bar"><i style="width:' + (100 * rpOf(v.id) / v.rp) + '%"></i></div>'; if (save.target === v.id) tag = '<span class="tag t">&#9733;</span>'; }
    else sub = 'Needs ' + VBY[v.req].n;
    return '<div class="vc ' + cls + (UIS.rs === v.id ? ' sel' : '') + '" data-rid="' + v.id + '">' + tag + '<b>' + esc(v.n) + '</b><small>BR ' + v.br.toFixed(1) + ' &middot; ' + sub + '</small>' + bar + '</div>';
}
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
    const clickSfx = () => sfx('click');
    document.addEventListener('click', e => {
        const t = e.target.closest('button,.chip,.vc,.mode'); if (t) clickSfx();
        const cl = e.target.closest('[data-close]'); if (cl) { const s = cl.closest('.scr'); s.classList.add('hidden'); UI.paintMenu(); if (M && s.id === 's-settings') UI.open('s-pause'); return; }
        const op = e.target.closest('[data-opt]'); if (op && !op.disabled) { setOpt(op.dataset.opt, op.dataset.v); return; }
        const tm = e.target.closest('[data-team]'); if (tm && tm.tagName === 'BUTTON') { partyTeam(+tm.dataset.team); return; }
        const mv = e.target.closest('[data-move]'); if (mv) { partyMove(+mv.dataset.move); return; }
        const kk = e.target.closest('[data-kick]'); if (kk) { partyKick(+kk.dataset.kick); return; }
        const tb2 = e.target.closest('#rs-tabs button'); if (tb2) { UIS.rln = tb2.dataset.ln; UIS.rs = null; UI.paintResearch(); return; }
        const rc = e.target.closest('[data-rid]'); if (rc) { UIS.rs = rc.dataset.rid; UI.paintResearch(); return; }
        const gc = e.target.closest('[data-gid]'); if (gc) { UIS.gs = gc.dataset.gid; lineupToggle(gc.dataset.gid); UI.paintGarage(); partyVehChanged(); UI.refreshLobby(); return; }
        const gl = e.target.closest('[data-lid]'); if (gl) { UIS.gs = gl.dataset.lid; save.sel = save.lineup.indexOf(gl.dataset.lid); writeSave(); UI.paintGarage(); partyVehChanged(); UI.refreshLobby(); return; }
        const ac2 = e.target.closest('[data-act]');
        if (ac2) {
            const id = ac2.dataset.id, a = ac2.dataset.act;
            if (a === 'target') setTarget(id); else if (a === 'free') spendFreeRp(id); else if (a === 'buy') { if (buyVeh(id)) sfx('cap'); } else if (a === 'line') { lineupToggle(id); partyVehChanged(); UI.refreshLobby(); }
            if (MODBY[id]) partyVehChanged();
            if ($('#s-research').classList.contains('hidden')) { UI.paintGarage(); } else UI.paintResearch(); return;
        }
        const ch = e.target.closest('#lineup .chip[data-i],#lb-mine .chip[data-i]'); if (ch) { save.sel = +ch.dataset.i; writeSave(); UI.paintMenu(); UI.paintLobby(); UI.refreshLobby(); partyVehChanged(); return; }
        const dc = e.target.closest('[data-did]'); if (dc) { UIS.selDead = dc.dataset.did; UI.paintDead(); return; }
    });
    $$('#menu .mode').forEach(b => b.onclick = () => setOpt('mode', b.dataset.m));
    $('#b-play').onclick = () => { if (PARTY.net) { UI.openLobby(); return; } startPlay(); if (M) Cam.lock(); };
    $('#b-research').onclick = () => UI.open('s-research'); $('#b-garage').onclick = () => UI.open('s-garage'); $('#b-settings').onclick = () => UI.open('s-settings'); $('#b-how').onclick = () => UI.open('s-how');
    $('#b-new').onclick = e => { e.preventDefault(); UI.open('s-new'); };
    $('#p-create').onclick = () => { ac(); partyCreate(); };
    $('#p-join').onclick = () => { ac(); partyJoin($('#p-code').value); };
    $('#p-leave').onclick = () => partyLeave(); $('#p-open').onclick = () => UI.openLobby();
    $('#lb-leave').onclick = () => partyLeave(); $('#lb-menu').onclick = () => UI.closeLobby();
    $('#lb-copy').onclick = () => { const c = PARTY.code; const done = () => toast('Code ' + c + ' copied'); try { navigator.clipboard.writeText(c).then(done, () => { fallbackCopy(c); done(); }); } catch (er) { fallbackCopy(c); done(); } };
    $('#lb-ready').onclick = () => {
        ac();
        if (PARTY.host) { startPlay(); if (M) Cam.lock(); return; }
        if (PARTY.inMatch) { PARTY.net.send('host', Object.assign({ t: 'me', ready: true }, myInfo())); PARTY.net.send('host', { t: 'joinm' }); return; }
        const me = PARTY.roster.find(p => p.id === PARTY.myId); partyReady(!(me && me.ready));
    };
    $('#lb-shuffle').onclick = () => partyShuffle(); $('#lb-balance').onclick = () => partyBalance();
    const say = () => { const i = $('#lb-say'); sendChat(i.value); i.value = ''; };
    $('#lb-send').onclick = say; $('#lb-say').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') say(); });
    $('#h-say').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { sendChat(e.target.value); e.target.value = ''; e.target.classList.add('hidden'); e.target.blur(); if (ME && ME.alive) Cam.lock(); } else if (e.key === 'Escape') { e.target.classList.add('hidden'); e.target.blur(); } });
    $('#p-code').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') $('#p-join').click(); });
    $('#m-name').addEventListener('keydown', e => e.stopPropagation());
    $('#m-name').addEventListener('input', e => { save.name = e.target.value.slice(0, 16); try { localStorage.setItem('steelstorm_name', save.name); } catch (er) {} writeSave(); });
    $('#st-q').onchange = e => { save.settings.quality = e.target.value; writeSave(); applyQuality(); UI.paintSettings(); };
    $('#st-sens').oninput = e => { save.settings.sens = +e.target.value; writeSave(); };
    $('#st-vol').oninput = e => { save.settings.vol = +e.target.value; setVolume(save.settings.vol); writeSave(); };
    $('#st-inv').onchange = e => { save.settings.invertY = e.target.checked; writeSave(); };
    $('#d-go').onclick = () => { if (ME && ME.respT <= 0) { if (respawnMe(UIS.selDead || myVeh())) { Cam.lock(); } } };
    $('#ps-resume').onclick = () => { $('#s-pause').classList.add('hidden'); Cam.lock(); };
    $('#ps-settings').onclick = () => { $('#s-pause').classList.add('hidden'); UI.open('s-settings'); };
    $('#ps-leave').onclick = () => {      // a guest hands its vehicle to a bot; the host ends the battle for everyone (score so far decides)
        if (M && !M.over && netOn()) { if (M.host) { M.limit.time = 0; hostCheckEnd(); $('#s-pause').classList.add('hidden'); return; } toHost({ t: 'quit' }); }
        UI.leaveMatch(true); afterMatch();
    };
}
function fallbackCopy(t) { try { const i = document.createElement('textarea'); i.value = t; document.body.appendChild(i); i.select(); document.execCommand('copy'); i.remove(); } catch (e) {} }
