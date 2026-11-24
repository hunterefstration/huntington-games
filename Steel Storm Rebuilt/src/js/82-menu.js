// ============================================================
// MENUS (2.2): one frame (top bar + navigation) around the Home, Battle, Multiplayer, Garage and Research views, the party
// lobby, and the Settings / How to play / What's new cards. The selected vehicle is shown large behind the menu by the
// showcase (87-showcase.js) or, with that off, on the 3D lobby's pad (85-lobby3d.js). Everything works with the mouse alone.
// ============================================================
const VIEWS = ['menu', 'battle', 'mp', 'garage', 'research'], VIEW_EL = { menu: 'v-home', battle: 'v-battle', mp: 'v-mp', garage: 'v-garage', research: 'v-research' };
const UIX = { list: null, fr: [], mpAt: 0, mpState: '', fake: null, lbShown: false };
const SVGP = {
    tank: 'M2 15h20l-2.5 4.5h-15zM5 11h11l2 3.5H4zM9 8h5v3H9zM14 9h8v1.6h-8z',
    plane: 'M12 1.5l1.6 7.3 8.4 4v2.2l-8.5-2.1-.7 5.1 2.9 2.2v1.6L12 20.6l-3.7 1.2v-1.6l2.9-2.2-.7-5.1L2 15v-2.2l8.4-4z',
    ship: 'M1.5 14.5h21l-3.2 5.5H4.7zM6 10.5h9v4H6zM9 6.5h3v4H9zM15.5 11.5h5l-1 3h-4z',
    home: 'M3 11l9-8 9 8v10h-6v-6H9v6H3z',
    battle: 'M11 1h2v5h-2zM11 18h2v5h-2zM1 11h5v2H1zM18 11h5v2h-5zM12 6.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11zm0 2.2a3.3 3.3 0 1 1 0 6.6a3.3 3.3 0 1 1 0-6.6z',
    mp: 'M8 3.5a3.2 3.2 0 1 1 0 6.4a3.2 3.2 0 1 1 0-6.4zM16.5 5a2.7 2.7 0 1 1 0 5.4a2.7 2.7 0 1 1 0-5.4zM1.5 20c0-4.2 3-6.8 6.5-6.8s6.5 2.6 6.5 6.8zM15.5 20c0-2.3-.6-4-1.7-5.3 .9-.5 1.8-.7 2.7-.7 3.2 0 6 2.2 6 6z',
    garage: 'M2 9l10-6.5L22 9v12h-3v-9H5v9H2zM7 14h10v2H7zM7 18h10v2H7z',
    research: 'M9 2h6v2h-1v5.2l6 10c.9 1.5-.2 3.3-1.9 3.3H5.9c-1.7 0-2.8-1.8-1.9-3.3l6-10V4H9zM7.6 16h8.8l-2.6-4.5h-3.6z',
    gear: 'M10 1.5h4l.7 2.8 2.3 1.3 2.7-.9 2 3.5-2.1 2v2.6l2.1 2-2 3.5-2.7-.9-2.3 1.3-.7 2.8h-4l-.7-2.8-2.3-1.3-2.7.9-2-3.5 2.1-2v-2.6l-2.1-2 2-3.5 2.7.9 2.3-1.3zM12 8.6a3.4 3.4 0 1 0 0 6.8a3.4 3.4 0 1 0 0-6.8z',
    train: 'M12 2l10 4.5-10 4.5L2 6.5zM5.5 9.6l6.5 2.9 6.5-2.9v4.6c0 2.3-2.9 4.3-6.5 4.3s-6.5-2-6.5-4.3zM20.5 7.5h1.6v7.5h-1.6z',
    help: 'M12 1.5a10.5 10.5 0 1 0 0 21a10.5 10.5 0 1 0 0-21zm-1.2 15.5h2.4v2.4h-2.4zM12 5.5c2.4 0 4.2 1.6 4.2 3.7 0 2.7-3.1 2.9-3.1 5.3h-2.3c0-3.4 3.1-3.5 3.1-5.3 0-1-.8-1.6-1.9-1.6s-1.9.6-1.9 1.6H7.8c0-2.1 1.8-3.7 4.2-3.7z'
};
const setH = (el, h) => { if (el._h !== h) { el._h = h; el.innerHTML = h; } };      // repaint only what changed (a click on a replaced button is lost)
const svgI = k => '<svg class="i" viewBox="0 0 24 24"><path fill-rule="evenodd" d="' + SVGP[k] + '"/></svg>';
const lineIcon = ln => svgI(ln === 'g' ? 'tank' : ln === 'a' ? 'plane' : 'ship');
// the bars are a share of the best any fully upgraded vehicle of the same domain has (a jet's speed is not a tank's)
const STATMAX = {};
function statMax(ln) {
    if (STATMAX[ln]) return STATMAX[ln];
    const m = { hp: 1, ar: 1, sp: 1, fp: 1 }; for (const v of VEHS) if (v.ln === ln) { const d = vdef(v.id, 31); m.hp = Math.max(m.hp, d.hp); m.ar = Math.max(m.ar, d.ar); m.sp = Math.max(m.sp, d.sp); m.fp = Math.max(m.fp, d.maxDps); }
    return STATMAX[ln] = m;
}
function statBars(d) {      // blue = the vehicle, yellow = what its installed modules add
    const b = d.base || d, M0 = statMax(b.ln);
    const row = (n, v0, v, max, txt) => { const w0 = clamp(100 * v0 / max, 3, 100), w = clamp(100 * v / max, 3, 100); return '<div class="sb"><span>' + n + '</span><div class="sbar"><i style="width:' + w0.toFixed(1) + '%"></i>' + (w > w0 + .5 ? '<u style="width:' + (w - w0).toFixed(1) + '%"></u>' : '') + '</div><b>' + txt + '</b></div>'; };
    return '<div class="sbars">' + row('Hit points', b.hp, d.hp, M0.hp, fmt(d.hp)) + row('Armour', b.ar, d.ar, M0.ar, fmt(d.ar)) + row('Speed', b.sp, d.sp, M0.sp, Math.round(d.sp * 3.6) + ' km/h') + row('Firepower', b.maxDps, d.maxDps, M0.fp, fmt(d.maxDps) + ' dps') + '</div>';
}
function weapHtml(d) {
    const key = { w1: 'CLICK', w2: 'R-CLICK', w3: 'B' };
    return '<div class="wps">' + ['w1', 'w2', 'w3'].filter(k => d[k]).map(k => {
        const w = d[k], val = w.cnt ? w.cnt + ' x ' + fmt(w.dmg) : fmt(w.dmg) + (w.nn > 1 ? ' x' + w.nn : '') + ' dmg';
        const rl = k === 'w1' ? (w.k === 'bullet' ? Math.round(1 / w.rl) + '/s' : w.rl.toFixed(1) + ' s') : w.k === 'missile' ? 'guided' : '';
        return '<div class="wp-row"><kbd>' + key[k] + '</kbd><span>' + esc(w.n) + '</span><b>' + val + (rl ? '<small>' + rl + '</small>' : '') + '</b></div>';
    }).join('') + '</div>';
}
function modsHtml(v) {
    return v.mods.map(m => {
        const done = !!save.mods[m.id], tgt = save.target === m.id;
        return '<div class="mod' + (done ? ' done' : '') + '"><b>' + esc(m.n) + '</b><small>' + esc(m.desc) + '</small>' + (done ? '<span class="tag ok">INSTALLED</span>' :
            '<div class="bar"><i style="width:' + (100 * rpOf(m.id) / m.rp) + '%"></i></div><small>' + fmt(rpOf(m.id)) + ' / ' + fmt(m.rp) + ' RP</small><div class="row"><button class="btn small" data-act="target" data-id="' + m.id + '"' + (tgt ? ' disabled' : '') + '>' + (tgt ? 'Researching' : 'Research') + '</button><button class="btn small" data-act="free" data-id="' + m.id + '"' + (save.freeRp <= 0 ? ' disabled' : '') + '>Free RP</button></div>') + '</div>';
    }).join('');
}
// the big vehicle card: name, tier, BR, role, stat bars, weapons, modules; ctx = home | garage | research
function vehCard(id, ctx) {
    const v = VBY[id]; if (!v) return '<div class="vk-note">Click a vehicle to see it here.</div>';
    const own = isOwned(id), d = own ? vdef(id, modMask(id)) : v, L = LINES[v.ln], inL = save.lineup.includes(id), sel = myVeh() === id;
    let h = '<div class="vk-head" style="--lc:' + L.col + '"><span class="tierb">' + TIER_ROMAN[v.t] + '</span><div><small>' + L.name + ' &middot; ' + CLS_NAME[v.cls] + '</small><h2>' + esc(v.n) + '</h2></div><span class="brb"><small>BR</small>' + brOf(d).toFixed(1) + '</span></div>';
    h += '<div class="role"><b>Role</b>' + esc(v.role || '') + '</div>';
    if (ctx !== 'home' && v.desc) h += '<div class="desc">' + esc(v.desc) + '</div>';
    h += statBars(d) + weapHtml(d);
    if (own) h += '<div class="mdots" title="Modules installed">' + v.mods.map(m => '<i class="' + (save.mods[m.id] ? 'on' : '') + '" title="' + esc(m.n) + '"></i>').join('') + '<span>' + popc(modMask(id)) + ' / 5 modules</span></div>';
    if (ctx === 'home') h += '<div class="vk-act"><button class="btn" data-go="garage">Change vehicle</button><button class="btn" data-act="garage" data-id="' + id + '">Modules</button></div>';
    else if (own) {
        h += '<div class="vk-act">' + (sel ? '<button class="btn" disabled>Selected for battle</button>' : '<button class="btn primary" data-act="use" data-id="' + id + '">Take into battle</button>') +
            '<button class="btn" data-act="line" data-id="' + id + '"' + (inL && save.lineup.length <= 1 ? ' disabled' : '') + '>' + (inL ? 'Remove from lineup' : 'Add to lineup') + '</button></div>';
        h += '<div class="sheet-h" style="margin:14px 0 0"><h3 style="margin:0">Modules</h3></div>' + modsHtml(v);
    } else if (isResearched(id)) h += '<div class="vk-act"><button class="btn primary" data-act="buy" data-id="' + id + '"' + (save.credits < v.cost ? ' disabled' : '') + '>Buy for ' + fmt(v.cost) + ' credits</button></div>' + (save.credits < v.cost ? '<div class="vk-note">You need ' + fmt(v.cost - save.credits) + ' more credits.</div>' : '');
    else if (canResearch(id)) {
        h += '<div class="vk-note">' + fmt(rpOf(id)) + ' / ' + fmt(v.rp) + ' research points, then ' + fmt(v.cost) + ' credits</div><div class="bar"><i style="width:' + (100 * rpOf(id) / v.rp) + '%"></i></div>';
        h += '<div class="vk-act"><button class="btn primary" data-act="target" data-id="' + id + '"' + (save.target === id ? ' disabled' : '') + '>' + (save.target === id ? 'Researching now' : 'Research this') + '</button><button class="btn" data-act="free" data-id="' + id + '"' + (save.freeRp <= 0 ? ' disabled' : '') + '>Free RP (' + fmt(save.freeRp) + ')</button></div>';
    } else h += '<div class="vk-note bad">Locked. Research ' + esc(VBY[v.req].n) + ' first.</div>';
    return h;
}
function slotHtml(v, sel, attrs, extra) {
    const d = vdef(v.id, modMask(v.id));
    return '<div class="slot' + (sel ? ' sel' : '') + '" ' + attrs + ' style="--lc:' + LINES[v.ln].col + '"><span class="st"><span class="tierb">' + TIER_ROMAN[v.t] + '</span>' + lineIcon(v.ln) + '</span><b>' + esc(v.n) + '</b><small>' + CLS_NAME[v.cls] + ' &middot; BR ' + brOf(d).toFixed(1) + '</small>' + (extra || '') + '</div>';
}
function lineupHtml(kind) {      // home / garage: 5 slots (empty ones lead to the garage); lobby: just the lineup
    const out = [];
    for (let i = 0; i < (kind === 'lobby' ? save.lineup.length : 5); i++) {
        const id = save.lineup[i], v = id && VBY[id];
        if (v) out.push(slotHtml(v, i === save.sel, 'data-slot="' + i + '"', (kind === 'garage' && save.lineup.length > 1 ? '<button class="rm" data-rm="' + id + '" title="Remove from the lineup">&times;</button>' : '') + (i === save.sel && kind !== 'lobby' ? '<span class="pk">IN BATTLE</span>' : '')));
        else out.push('<div class="slot empty" data-go="garage"><b>+</b><small>' + (kind === 'garage' ? 'Pick a vehicle above' : 'Add in the Garage') + '</small></div>');
    }
    return out.join('');
}
function researchCard(v) {
    let cls = 'lock', tag = '', sub = 'Locked', bar = '';
    if (isOwned(v.id)) { cls = 'owned'; tag = '<span class="tag ok">' + popc(modMask(v.id)) + '/5</span>'; sub = 'Owned'; }
    else if (isResearched(v.id)) { cls = 'res'; tag = '<span class="tag t">BUY</span>'; sub = fmt(v.cost) + ' cr'; }
    else if (canResearch(v.id)) { cls = 'can'; sub = fmt(rpOf(v.id)) + ' / ' + fmt(v.rp) + ' RP'; bar = '<div class="bar"><i style="width:' + (100 * rpOf(v.id) / v.rp) + '%"></i></div>'; if (save.target === v.id) tag = '<span class="tag t">&#9733;</span>'; }
    else sub = 'Needs ' + VBY[v.req].n;
    return '<div class="vc ' + cls + (UIS.rs === v.id ? ' sel' : '') + '" data-rid="' + v.id + '">' + tag + '<b>' + esc(v.n) + '</b><small>BR ' + v.br.toFixed(1) + ' &middot; ' + sub + '</small>' + bar + '</div>';
}
function modeCards(dis, src) { const cur = optVal('mode', src); return Object.keys(MODES).map(k => '<button class="mcard' + (cur === k ? ' on' : '') + '" data-opt="mode" data-v="' + k + '"' + (dis ? ' disabled' : '') + '><span class="mi">' + MODES[k].short + '</span><b>' + MODES[k].name + '</b><small>' + esc(MODES[k].desc) + '</small></button>').join(''); }
function optSummary(src) {
    const g = k => optVal(k, src), s = g('size'), lab = (k, v) => { const o = OPTS.find(x => x[0] === k); const x = o && o[2].find(y => String(y[0]) === String(v)); return x ? x[1] : v; };
    return (g('mode') === 'ffa' ? Math.min(12, s * 2) + ' players' : s + 'v' + s) + ' &middot; ' + lab('map', g('map')) + ' map &middot; ' + g('len') + ' min &middot; ' + lab('wx', g('wx')) + ' &middot; bots ' + lab('bots', g('bots')).toLowerCase() + (+g('ff') ? ' &middot; friendly fire' : '');
}
// which vehicle the showcase films, and whether it runs
function focusVeh() { return UIS.screen === 'garage' && UIS.gs && isOwned(UIS.gs) ? UIS.gs : myVeh(); }
function modalOpen() { return ['s-settings', 's-how', 's-new', 's-notice'].some(id => !$('#' + id).classList.contains('hidden')); }
function showSync() {
    const inMenu = !M && !$('#menu').classList.contains('hidden') && !(UIS.lobby && (PARTY.code || PARTY.migrating));
    const id = inMenu ? focusVeh() : null;
    Show.request(id, id ? modMask(id) : 0);
    Show.run = inMenu && UIS.screen !== 'research' && !modalOpen();
    if (!M && !Show.want) Lobby.refresh();      // no showcase: the 3D lobby shows the vehicle (or the party) instead
    if (Show.want === null) { const c = $('#sc-cap'); if (c) c.classList.add('hidden'); }
}
function mpAge(s) { s = s | 0; return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min' : Math.round(s / 3600) + ' h'; }
// the launcher's list of open games (Grapevine 076-parties.js), refreshed while the Multiplayer screen shows
function mpRefresh(force) {
    const now = Date.now(); if (!force && now - UIX.mpAt < 9000) return; UIX.mpAt = now;
    if (UIX.fake) { UIX.list = UIX.fake.list; UIX.fr = UIX.fake.fr || []; UIX.mpState = 'ok'; UI.paintMpList(); return; }
    const p = LP(); let G = null; try { G = p && p.HGGrapevine; } catch (e) {}
    if (!G || !G.party) { UIX.mpState = 'nolauncher'; UI.paintMpList(); return; }
    if (G.online && !G.online()) { UIX.mpState = 'offline'; UI.paintMpList(); return; }
    if (!UIX.list) { UIX.mpState = 'loading'; UI.paintMpList(); }
    let netP; try { netP = typeof p.partyNet === 'function' ? p.partyNet() : null; } catch (e) { netP = null; }
    Promise.resolve(netP).then(net => G.party.list(net, GAME_ID)).then(m => { UIX.list = m || {}; UIX.mpState = 'ok'; UI.paintMpList(); }, () => { UIX.mpState = UIX.list ? 'ok' : 'err'; UI.paintMpList(); });
    if (G.party.friends) G.party.friends().then(m => {
        const nm = {}; try { (G.friends().friends || []).forEach(f => { nm[f.userId] = f.name; }); } catch (e) {}
        UIX.fr = ((m && m.list) || []).map(a => ({ name: nm[a.uid] || 'A friend', game: a.game || '', code: a.gid === GAME_ID && /^\d{6}$/.test(a.code || '') ? a.code : '' })); UI.paintMpList();
    }, () => {});
}
setInterval(() => { if (!M && !document.hidden && UIS.screen === 'mp' && !UIS.lobby && !$('#menu').classList.contains('hidden')) mpRefresh(); }, 10000);
function connState() {
    const n = rosterNow().length;
    if (PARTY.migrating) return ['warn', 'Host left: moving the party to a new host...'];
    if (PARTY.busy) return ['warn', PARTY.status || 'Connecting...'];
    if (PARTY.recon) return ['bad', 'Reconnecting...'];
    if (PARTY.lag) return ['warn', 'Connection unstable: waiting for the host...'];
    if (PARTY.host) return ['ok', 'Hosting &middot; ' + n + ' / ' + PARTY_MAX + ' players'];
    return ['ok', 'Connected &middot; ' + Math.round(PARTY.rtt || 0) + ' ms'];
}
function selectSlot(i) {
    if (!save.lineup[i]) return; save.sel = i; writeSave();
    if (UIS.screen === 'garage') UIS.gs = save.lineup[i];
    partyVehChanged(); UI.refreshLobby(); UI.paintMenu(); UI.paintLobby(); showSync();
}
function lineToggle(id) {      // add / remove, keeping the same vehicle selected for battle
    const cur = myVeh(); if (!lineupToggle(id)) { if (!save.lineup.includes(id) && save.lineup.length >= 5) toast('Your lineup is full: remove a vehicle first'); return false; }
    const i = save.lineup.indexOf(cur); if (i >= 0) save.sel = i; writeSave(); partyVehChanged(); UI.refreshLobby(); return true;
}
function useVeh(id) {
    if (!save.lineup.includes(id) && !lineToggle(id)) return;
    save.sel = save.lineup.indexOf(id); writeSave(); partyVehChanged(); UI.refreshLobby(); toast(VBY[id].n + ' goes into battle');
}
Object.assign(UI, {
    // ---- navigation ----
    go(v) {
        if (M || !VIEWS.includes(v)) return;
        if (v === 'mp' && (PARTY.code || PARTY.migrating)) { UI.openLobby(); return; }      // in a party, Multiplayer is the party lobby
        UIS.screen = v; UIS.lobby = false; UIX.lbShown = false; $('#s-lobby').classList.add('hidden');
        const m = $('#menu'); m.classList.remove('hidden'); m.dataset.view = v;
        for (const k of VIEWS) $('#' + VIEW_EL[k]).classList.toggle('hidden', k !== v);
        $$('#mnav [data-go]').forEach(b => b.classList.toggle('on', b.dataset.go === v));
        if (v === 'garage' && !(UIS.gs && isOwned(UIS.gs))) UIS.gs = myVeh();
        if (v === 'research' && !UIS.rs) { UIS.rs = save.target && VBY[save.target] ? save.target : myVeh(); UIS.rln = VBY[UIS.rs].ln; }
        UI.paintMenu(); showSync();
        if (v === 'mp') mpRefresh(true);
    },
    showMenu() {
        ovc.clearRect(0, 0, 4000, 4000); $$('#hud,#s-dead,#s-pause,#s-result').forEach(e => e.classList.add('hidden'));
        if (UIS.lobby && PARTY.code) { $('#menu').classList.add('hidden'); UI.paintLobby(); showSync(); return; }
        UI.go(VIEWS.includes(UIS.screen) ? UIS.screen : 'menu');
    },
    open(id) {
        if (id === 's-research') return UI.go('research'); if (id === 's-garage') return UI.go('garage');
        const el = $('#' + id); if (!el) return; el.classList.remove('hidden');
        if (id === 's-settings') UI.paintSettings();
        showSync();
    },
    close(id) { $('#' + id).classList.add('hidden'); if (!M) UI.paintMenu(); showSync(); },
    wallet() {
        $('#w-cr').textContent = fmt(save.credits); $('#w-fr').textContent = fmt(save.freeRp);
        const t = save.target; $('#w-rp').textContent = t && (VBY[t] || MODBY[t]) ? fmt(rpOf(t)) + '/' + fmt(rpNeed(t)) : '-';
        const nr = $('#nv-rs'); const can = VEHS.some(v => isResearched(v.id) && !isOwned(v.id) && save.credits >= v.cost); nr.textContent = 'BUY'; nr.classList.toggle('hidden', !can);
    },
    paintMenu() {      // the frame plus whichever view shows
        UI.wallet();
        const nm = $('#m-name'); if (document.activeElement !== nm) nm.value = myName(); nm.disabled = !!LP() && !!(() => { try { return window.parent.HGGrapevine && window.parent.HGGrapevine.me && window.parent.HGGrapevine.me(); } catch (e) { return null; } })();
        $('#nv-party').classList.toggle('hidden', !PARTY.code);
        const v = UIS.screen;
        if (v === 'menu') UI.paintHome(); else if (v === 'battle') UI.paintBattle(); else if (v === 'mp') UI.paintMp(); else if (v === 'garage') UI.paintGarage(); else if (v === 'research') UI.paintResearch();
    },
    paintMenuSel() { UI.paintMenu(); },
    paintHome() {
        $('#h-vcard').innerHTML = vehCard(myVeh(), 'home');
        $('#lineup').innerHTML = lineupHtml('home');
        const guest = PARTY.net && !PARTY.host;
        $('#b-mode').innerHTML = '<b>' + MODES[PARTY.opts && guest ? PARTY.opts.mode : save.mode].name + '</b><small>' + optSummary(guest ? PARTY.opts : null) + '</small>';
        $('#b-play').textContent = PARTY.code ? 'PARTY LOBBY' : 'PLAY';
        $('#m-lead-note').textContent = PARTY.code ? (guest ? 'In a party: the host starts the battle.' : 'In a party: start from the lobby.') : 'Solo: you and bots near your battle rating.';
    },
    paintBattle() {
        const guest = PARTY.net && !PARTY.host;
        const src = guest ? PARTY.opts : null; setH($('#bt-modes'), modeCards(guest, src)); setH($('#bt-opts'), optsHtml(guest, src));
        $('#bt-note').textContent = guest ? 'The party host picks the options.' : PARTY.code ? 'These are your party\'s options too.' : 'Solo battle: you and bots.';
        $('#m-br').textContent = 'Your battle rating: ' + lineupBr().toFixed(1) + '. Bots use vehicles near it.';
        $('#bt-go').textContent = PARTY.code ? 'PARTY LOBBY' : 'START BATTLE';
    },
    // ---- multiplayer ----
    paintMp() {
        const busy = !!PARTY.busy, inP = !!PARTY.code;
        setH($('#mp-modes'), modeCards(false)); setH($('#mp-opts'), optsHtml(false));
        const pub = save.opts.pub !== 0; $$('#mp-pub button').forEach(b => b.classList.toggle('on', (b.dataset.pub === '1') === pub));
        $('#mp-pubnote').textContent = pub ? 'Listed for everyone in the launcher. Anyone with the code can join.' : 'Only friends (and people on your Wi-Fi) see it in their list. Anyone with the code can still join.';
        $('#p-create').disabled = busy || inP; $('#p-join').disabled = busy || inP;
        $('#p-create').textContent = busy ? 'CONNECTING...' : 'HOST GAME';
        UI.paintMpStatus(); UI.paintMpList();
    },
    paintMpStatus() { const st = $('#p-status'); if (!st) return; st.textContent = PARTY.status || ''; st.className = 'mp-status' + (PARTY.bad ? ' bad' : PARTY.code ? ' ok' : ''); },
    paintMpList() {
        if (UIS.screen !== 'mp') return;
        const st = UIX.mpState, all = UIX.list ? (UIX.list.near || []).concat(UIX.list.pub || []).filter(p => !p.game || p.game === GAME_ID) : [], inP = !!PARTY.code || !!PARTY.busy;
        const row = p => { const full = p.n >= p.max, mine = p.code === PARTY.code;
            return '<div class="mp-g"><div><b>' + esc(p.host || 'Someone') + '\'s game' + (p.near ? '<span class="bd">SAME WI-FI</span>' : '') + (mine ? '<span class="bd you">YOURS</span>' : '') + '</b><small>' + esc(p.mode || 'Steel Storm') + ' &middot; open ' + mpAge(p.age) + '</small></div>' +
                '<div class="pc">' + (p.n | 0) + '/' + (p.max | 0) + '<small>PLAYERS</small></div><button class="btn primary" data-pj="' + esc(p.code) + '"' + (full || inP ? ' disabled' : '') + '>' + (mine ? 'Yours' : full ? 'Full' : 'Join') + '</button></div>'; };
        const empty = { loading: 'Looking for open games...', nolauncher: 'Open games are listed when you play from the Huntington Games launcher.<br>You can still join with a code or host a game.', offline: 'Sign in to the launcher to see open games.', err: 'Could not load the list. Try Refresh.' };
        setH($('#mp-games'), all.length ? all.map(row).join('') : '<div class="mp-empty">' + (empty[st] || 'No open games right now.<br>Host one and it shows up here for everyone.') + '</div>');
        const fr = UIX.fr || [];
        setH($('#mp-friends'), fr.length ? fr.map(f => '<div class="mp-g"><div><b>' + esc(f.name) + (f.code ? '<span class="bd fr">IN A PARTY</span>' : '') + '</b><small>playing ' + esc(f.game || 'a game') + '</small></div><div></div>' + (f.code ? '<button class="btn primary" data-pj="' + esc(f.code) + '"' + (inP ? ' disabled' : '') + '>Join</button>' : '<div></div>') + '</div>').join('') : '<div class="mp-empty">' + (st === 'ok' ? 'None of your friends are playing right now.' : 'Friends who are playing show up here.') + '</div>');
    },
    paintParty() { UI.paintMpStatus(); $('#nv-party').classList.toggle('hidden', !PARTY.code); if (UIS.screen === 'mp' && !$('#menu').classList.contains('hidden')) UI.paintMp(); else if (UIS.screen === 'menu' && !M) UI.paintHome(); UI.paintLobby(); },
    // ---- the party lobby ----
    refreshLobby() { if (typeof Lobby !== 'undefined') Lobby.refresh(); },
    openLobby() { if (!PARTY.code && !PARTY.migrating) return; UIS.lobby = true; UI.paintLobby(); showSync(); UI.refreshLobby(); },
    closeLobby() { UIS.lobby = false; UIX.lbShown = false; $('#s-lobby').classList.add('hidden'); if (!M) { UI.go(UIS.screen === 'mp' ? 'menu' : VIEWS.includes(UIS.screen) ? UIS.screen : 'menu'); } },
    paintLobby() {
        const el = $('#s-lobby'), show = UIS.lobby && !!(PARTY.code || PARTY.migrating) && !M;
        if (!show) { el.classList.add('hidden'); if (UIX.lbShown) { UIX.lbShown = false; UIS.lobby = false; if (!M) UI.go(UIS.screen === 'mp' || !VIEWS.includes(UIS.screen) ? 'menu' : UIS.screen); } return; }
        if (!UIX.lbShown) { UIX.lbShown = true; $('#menu').classList.add('hidden'); el.classList.remove('hidden'); }
        const host = PARTY.host, o = PARTY.opts || lobbyOpts(), ffa = o.mode === 'ffa', R = rosterNow(), me = R.find(p => p.id === PARTY.myId);
        $('#lb-code').textContent = PARTY.code || '------';
        setH($('#lb-mode'), (host ? Object.keys(MODES).map(k => '<button class="mb' + (o.mode === k ? ' on' : '') + '" data-opt="mode" data-v="' + k + '">' + MODES[k].name + '</button>').join('') : '<b>' + MODES[o.mode].name + '</b>') + '<small>' + optSummary(host ? null : o) + (PARTY.inMatch ? ' &middot; <b style="color:var(--ok)">battle in progress: you can join it</b>' : '') + '</small>');
        const cs = connState(), ne = $('#lb-net'); ne.className = 'lb-conn ' + cs[0]; ne.innerHTML = cs[1];
        const row = p => {
            const v = VBY[p.veh] || VBY.g1a, br = brOf(vdef(v.id, p.mm | 0)), mine = p.id === PARTY.myId;
            return '<div class="lp' + (mine ? ' me' : '') + '" style="--lc:' + LINES[v.ln].col + '"><div class="lp-n">' + (p.id === 0 ? '<span class="star" title="Host">&#9733;</span>' : '') + '<span class="nm">' + esc(p.name) + '</span>' + (mine ? '<small>(you)</small>' : '') + (p.st && p.st !== 'connected' ? ' <small class="bad">' + esc(p.st) + '</small>' : '') + (p.id ? pingBars(p.ping || 0, p.st) : '') +
                '<span class="rdy' + (p.id === 0 ? ' host' : p.ready ? ' on' : '') + '">' + (p.id === 0 ? 'HOST' : p.ready ? 'READY' : 'NOT READY') + '</span></div>' +
                '<div class="lp-v">' + lineIcon(v.ln) + esc(v.n) + ' <small>' + CLS_NAME[v.cls] + ' &middot; BR ' + br.toFixed(1) + '</small></div>' +
                '<div class="lp-l">' + (p.line || []).map(x => VBY[x[0]] ? '<span class="mini" title="' + esc(VBY[x[0]].n) + '">' + esc(VBY[x[0]].n.split(' ')[0]) + ' ' + (+x[1]).toFixed(1) + '</span>' : '').join('') + '</div>' +
                (host && p.id !== 0 ? '<div class="lp-h">' + (!ffa ? '<button class="btn small" data-move="' + p.id + '" title="Move to the other team">&#8644; Move</button>' : '') + '<button class="btn small danger" data-kick="' + p.id + '" title="Remove from the party">&#10006; Kick</button></div>' : '') + '</div>';
        };
        const size = o.size || 5, bots = o.bots !== 'off', ghost = n => { let h = ''; for (let i = 0; i < Math.min(n, 8); i++) h += '<div class="lp bot">' + (bots ? 'Bot fills this slot' : 'Open slot') + '</div>'; return h; };
        if (ffa) setH($('#lb-teams'), '<div class="tcol ffa"><h3>EVERYONE <small>' + R.length + ' players</small></h3>' + R.map(row).join('') + ghost(Math.min(12, size * 2) - R.length) + '</div>');
        else setH($('#lb-teams'), [0, 1].map(t => { const L = R.filter(p => (p.team | 0) === t); return '<div class="tcol t' + t + '"><h3>' + (t ? 'RED' : 'BLUE') + ' TEAM <small>' + L.length + ' / ' + size + '</small>' + (me && (me.team | 0) !== t && !PARTY.inMatch ? '<button class="btn small" data-team="' + t + '">Switch here</button>' : '') + '</h3>' + L.map(row).join('') + ghost(size - L.length) + '</div>'; }).join(''));
        setH($('#lb-opts'), optsHtml(!host, host ? null : o)); $('#lb-optnote').textContent = host ? '(you decide)' : '(the host decides)';
        $('#lb-tools').classList.toggle('hidden', !host || ffa);
        setH($('#lb-mine'), lineupHtml('lobby'));
        const b = $('#lb-ready'), hint = $('#lb-hint'); b.classList.remove('on');
        if (host) { const nr = R.filter(p => p.id !== 0 && !p.ready), force = PARTY.force && Date.now() - PARTY.force < 6000; b.textContent = PARTY.inMatch ? 'IN BATTLE' : nr.length && force ? 'START ANYWAY' : 'START'; b.disabled = PARTY.inMatch || !!PARTY.migrating; hint.textContent = PARTY.inMatch ? 'Players can join the running battle.' : R.length < 2 ? 'Share the code: friends join with it, or from the open games list.' : nr.length ? nr.length + ' not ready: ' + nr.map(p => p.name).join(', ') : 'Everyone is ready!'; }
        else if (PARTY.inMatch) { b.textContent = 'JOIN BATTLE'; b.disabled = false; hint.textContent = 'The battle is on: jump in.'; }
        else { const r = !!(me && me.ready); b.textContent = r ? 'READY ✓' : 'READY'; b.classList.toggle('on', r); b.disabled = !!PARTY.migrating || !!PARTY.recon; hint.textContent = r ? 'Waiting for the host to start.' : 'Press READY when your vehicle is set.'; }
        UI.paintChat();
    },
    paintChat() {
        const L = $('#lb-log'); if (!L) return;
        const h0 = L._h; setH(L, PARTY.chat.slice(-40).map(c => c.sys || c.x.startsWith('* ') ? '<div class="sys">' + esc(c.x.replace(/^\* /, '')) + '</div>' : '<div><b' + (c.me ? ' class="me"' : '') + '>' + esc(c.n) + ':</b> ' + esc(c.x) + '</div>').join('') || '<div class="sys">Say hi! Messages go to everyone in the party.</div>');
        if (L._h !== h0) L.scrollTop = 1e6;
    },
    // ---- garage ----
    paintGarage() {
        UI.wallet(); const gs = UIS.gs && isOwned(UIS.gs) ? UIS.gs : (UIS.gs = myVeh()), gt = UIS.gt;
        $$('#g-tabs button').forEach(b => b.classList.toggle('on', b.dataset.gt === gt));
        $('#g-owned').innerHTML = ['g', 'a'].filter(ln => gt === 'all' || gt === ln).map(ln => { const L = VEHS.filter(v => v.ln === ln && isOwned(v.id)); return '<h4 style="color:' + LINES[ln].col + '">' + LINES[ln].name + ' <small style="color:var(--mut)">' + L.length + '</small></h4><div class="cards">' + L.map(v => slotHtml(v, v.id === gs, 'data-gid="' + v.id + '"', save.lineup.includes(v.id) ? '<span class="inl">LINEUP</span>' : '')).join('') + '</div>'; }).join('');
        $('#g-info').innerHTML = vehCard(gs, 'garage');
        $('#g-lineup').innerHTML = lineupHtml('garage');
    },
    // ---- research ----
    paintResearch() {
        UI.wallet(); const ln = UIS.rln, br = BRANCHES[ln];
        $$('#rs-tabs button').forEach(b => b.classList.toggle('on', b.dataset.ln === ln));
        let h = '<div class="grid" style="grid-template-columns:30px repeat(' + br.length + ',minmax(104px,1fr))"><div></div>' + br.map(([k, n]) => '<div class="bh">' + n + '</div>').join('');
        for (let t = 1; t <= MAX_TIER; t++) {
            h += '<div class="th">' + TIER_ROMAN[t] + '</div>';
            for (const [k] of br) h += '<div class="cell">' + VEHS.filter(v => v.ln === ln && v.t === t && v.cls === k).map(researchCard).join('') + '</div>';
        }
        $('#tree').innerHTML = h + '</div>';
        const tg = save.target && (VBY[save.target] || MODBY[save.target]);
        $('#rs-now').innerHTML = tg ? 'Researching <b>' + esc(tg.n) + '</b> ' + fmt(rpOf(save.target)) + ' / ' + fmt(rpNeed(save.target)) + ' RP' : 'Pick something to research: match RP go to it';
        $('#rs-info').innerHTML = vehCard(UIS.rs, 'research');
    },
    paintInfo() { if (UIS.screen === 'garage') UI.paintGarage(); else UI.paintResearch(); },
    // ---- settings ----
    paintSettings() {
        const S = save.settings;
        $$('#st-q button').forEach(b => b.classList.toggle('on', b.dataset.q === S.quality));
        const on = S.show && !Show.off; $$('#st-show button').forEach(b => b.classList.toggle('on', (b.dataset.show === '1') === on));
        $$('#st-inv button').forEach(b => b.classList.toggle('on', (b.dataset.inv === '1') === !!S.invertY));
        $$('#st-eng button').forEach(b => b.classList.toggle('on', b.dataset.eng === HG3D.chosen('steelstorm')));
        $('#st-sens').value = S.sens; $('#st-vol').value = S.vol; $('#st-sensv').textContent = (+S.sens).toFixed(2); $('#st-volv').textContent = Math.round(S.vol * 100) + '%';
    }
});
function bindMenu() {
    $$('[data-ic]').forEach(i => { i.outerHTML = svgI(i.dataset.ic); });
    document.addEventListener('click', e => {
        const t = e.target.closest('button,.slot,.vc'); if (t && !t.disabled) sfx('click');
        const cl = e.target.closest('[data-close]');
        if (cl) { const s = cl.closest('.scr'); s.classList.add('hidden'); if (M && !M.over && (s.id === 's-settings' || s.id === 's-how')) $('#s-pause').classList.remove('hidden'); else if (!M) UI.paintMenu(); showSync(); return; }
        const rm = e.target.closest('[data-rm]'); if (rm) { lineToggle(rm.dataset.rm); UI.paintMenu(); showSync(); return; }
        const go = e.target.closest('[data-go]'); if (go) { UI.go(go.dataset.go); return; }
        const md = e.target.closest('[data-modal]'); if (md) { UI.open(md.dataset.modal); return; }
        const op = e.target.closest('[data-opt]'); if (op && !op.disabled) { setOpt(op.dataset.opt, op.dataset.v); return; }
        const tm = e.target.closest('button[data-team]'); if (tm) { partyTeam(+tm.dataset.team); return; }
        const mv = e.target.closest('[data-move]'); if (mv) { partyMove(+mv.dataset.move); return; }
        const kk = e.target.closest('[data-kick]'); if (kk) { partyKick(+kk.dataset.kick); return; }
        const pj = e.target.closest('[data-pj]'); if (pj) { if (pj.disabled) return; ac(); $('#p-code').value = pj.dataset.pj; partyJoin(pj.dataset.pj); return; }
        const pb = e.target.closest('[data-pub]'); if (pb) { save.opts.pub = +pb.dataset.pub; writeSave(); UI.paintMp(); advertiseSoon(); return; }
        const gt = e.target.closest('[data-gt]'); if (gt) { UIS.gt = gt.dataset.gt; UI.paintGarage(); return; }
        const rt = e.target.closest('#rs-tabs button'); if (rt) { UIS.rln = rt.dataset.ln; UI.paintResearch(); return; }
        const rc = e.target.closest('[data-rid]'); if (rc) { UIS.rs = rc.dataset.rid; UI.paintResearch(); return; }
        const gc = e.target.closest('[data-gid]'); if (gc) { UIS.gs = gc.dataset.gid; UI.paintGarage(); showSync(); return; }
        const sl = e.target.closest('[data-slot]'); if (sl) { selectSlot(+sl.dataset.slot); return; }
        const a2 = e.target.closest('[data-act]');
        if (a2 && !a2.disabled) {
            const id = a2.dataset.id, a = a2.dataset.act;
            if (a === 'garage') { UIS.gs = id; UI.go('garage'); return; }
            if (a === 'target') setTarget(id); else if (a === 'free') spendFreeRp(id); else if (a === 'line') lineToggle(id); else if (a === 'use') useVeh(id);
            else if (a === 'buy') { if (buyVeh(id)) { sfx('cap'); toast(VBY[id].n + ' is yours' + (save.lineup.includes(id) ? ' and in your lineup' : ': add it to your lineup in the Garage')); } }
            if (MODBY[id]) partyVehChanged();
            UI.paintMenu(); showSync(); return;
        }
        const q = e.target.closest('[data-q]'); if (q) { save.settings.quality = q.dataset.q; writeSave(); applyQuality(); UI.paintSettings(); return; }
        const sh = e.target.closest('[data-show]'); if (sh) { save.settings.show = sh.dataset.show === '1'; if (save.settings.show) { Show.off = false; Show.perf.t = 0; } writeSave(); UI.paintSettings(); showSync(); return; }
        const en = e.target.closest('[data-eng]'); if (en) { HG3D.choose('steelstorm', en.dataset.eng); UI.paintSettings(); return; }
        if (e.target.closest('[data-speed]')) { UI.close('s-settings'); speedTestRun(); return; }
        const iv = e.target.closest('[data-inv]'); if (iv) { save.settings.invertY = iv.dataset.inv === '1'; writeSave(); UI.paintSettings(); return; }
    });
    $('#b-play').onclick = () => { ac(); if (PARTY.code) { UI.openLobby(); return; } startPlay(); if (M) Cam.lock(); };
    $('#bt-go').onclick = () => $('#b-play').click();
    $('#b-mode').onclick = () => UI.go('battle');
    $('#b-new').onclick = e => { e.preventDefault(); UI.open('s-new'); };
    $('#mp-refresh').onclick = () => { UIX.mpState = UIX.list ? 'ok' : 'loading'; mpRefresh(true); };
    $('#p-create').onclick = () => { ac(); partyCreate(); };
    $('#p-join').onclick = () => { ac(); partyJoin($('#p-code').value); };
    $('#p-code').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') $('#p-join').click(); });
    $('#p-code').addEventListener('input', e => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); if (v !== e.target.value) e.target.value = v; });
    $('#lb-back').onclick = () => UI.closeLobby();
    $('#lb-leave').onclick = () => partyLeave();
    $('#lb-menu').onclick = () => { UIS.screen = 'garage'; UI.closeLobby(); };
    $('#lb-copy').onclick = () => { const c = PARTY.code; if (!c) return; const done = () => toast('Code ' + c + ' copied'); try { navigator.clipboard.writeText(c).then(done, () => { fallbackCopy(c); done(); }); } catch (er) { fallbackCopy(c); done(); } };
    $('#lb-ready').onclick = () => {
        ac();
        if (PARTY.host) { startPlay(); if (M) Cam.lock(); else UI.paintLobby(); return; }
        if (PARTY.inMatch) { PARTY.net.send('host', Object.assign({ t: 'me', ready: true }, myInfo())); PARTY.net.send('host', { t: 'joinm' }); return; }
        const me = PARTY.roster.find(p => p.id === PARTY.myId); partyReady(!(me && me.ready));
    };
    $('#lb-shuffle').onclick = () => partyShuffle(); $('#lb-balance').onclick = () => partyBalance();
    const say = () => { const i = $('#lb-say'); sendChat(i.value); i.value = ''; };
    $('#lb-send').onclick = say; $('#lb-say').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') say(); });
    $('#m-name').addEventListener('keydown', e => e.stopPropagation());
    $('#m-name').addEventListener('input', e => { save.name = e.target.value.slice(0, 16); try { localStorage.setItem('steelstorm_name', save.name); } catch (er) {} writeSave(); });
    $('#st-sens').oninput = e => { save.settings.sens = +e.target.value; writeSave(); UI.paintSettings(); };
    $('#st-vol').oninput = e => { save.settings.vol = +e.target.value; setVolume(save.settings.vol); writeSave(); UI.paintSettings(); };
    addEventListener('keydown', e => { if (e.code === 'Escape' && !M && !typing(e)) { const m = ['s-notice', 's-new', 's-how', 's-settings'].find(id => !$('#' + id).classList.contains('hidden')); if (m) UI.close(m); } });
}
