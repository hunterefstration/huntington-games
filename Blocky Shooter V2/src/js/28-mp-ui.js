// ---------- HUD ----------
Object.assign(ui, { netScore: $('net-score'), netFeed: $('net-feed'), netTeam: $('net-team'), netDown: $('net-down'), netBoard: $('net-board'), netBoardInner: $('net-board-inner'), netPing: $('net-ping'), mp: $('mp-overlay'), mpBody: $('mp-body') });
function netHud(on) {
    ui.netScore.classList.toggle('hidden', !on || !NET.pvp || NET.mode === 'tourney');
    ui.netFeed.innerHTML = ''; ui.netTeam.innerHTML = ''; ui.netPing.textContent = '';
    ui.netDown.classList.add('hidden'); ui.netBoard.classList.add('hidden');
    ui.txtMoney.classList.toggle('hidden', !!(on && NET.pvp));
}
function netHudDown() { ui.netDown.classList.remove('hidden'); if (!NET.pvp) ui.netDown.innerHTML = `<div class="text-4xl font-black text-red-400">YOU'RE DOWN</div><div class="text-lg font-bold text-gray-200">${lastHurtBy ? 'Killed by ' + escHtml(lastHurtBy) + ' - ' : ''}you'll be back next wave</div>`; }
function netHudUpdate() {
    const now = performance.now();
    if (NET.mode === 'tourney') {
        setText(ui.txtLevel, 'TOURNAMENT'); setText(ui.txtEnemies, NET.spec ? 'Spectating' : 'In the duel'); ui.txtEnemies.style.color = NET.spec ? '#9ca3af' : '#fca5a5';
    } else if (NET.pvp) {
        ui.netScore.innerHTML = `<span style="color:${hex(TEAM_COLORS[0])}">RED ${NET.score[0]}</span><span class="text-base text-gray-300">first to ${NET.target}</span><span style="color:${hex(TEAM_COLORS[1])}">${NET.score[1]} BLUE</span>`;
        setText(ui.txtLevel, netModeName()); setText(ui.txtEnemies, `Your team: ${TEAM_NAMES[NET.team]}`);
        ui.txtEnemies.style.color = hex(TEAM_COLORS[NET.team]);
    } else {
        // teammates' health
        ui.netTeam.innerHTML = [...netPlayers.values()].map(p => {
            const alive = !!(p.f & 1), pct = alive ? clamp(p.hp, 0, 100) : 0;
            return `<div class="bg-black/45 rounded px-2 py-1"><div class="flex justify-between text-xs font-black"><span style="color:${hex(p.color)}">${escHtml(p.name)}</span><span class="${alive ? 'text-gray-300' : 'text-red-400'}">${alive ? Math.round(pct) : 'DOWN'}</span></div><div class="h-1.5 bg-black/60 rounded overflow-hidden mt-0.5"><div class="h-full bg-green-500" style="width:${pct}%"></div></div></div>`;
        }).join('');
    }
    if (NET.feedDirty || (NET.feed.length && now - NET.feed[0].t > 7000)) {
        NET.feed = NET.feed.filter(f => now - f.t < 7000); NET.feedDirty = false;
        ui.netFeed.innerHTML = NET.feed.map(f => `<div class="bg-black/55 rounded px-2 py-0.5 hud-text">${f.html}</div>`).join('');
    }
    const quiet = !NET.host && NET.hostPeer && NET.hostPeer.lastMsg ? now - NET.hostPeer.lastMsg : 0;
    ui.netPing.textContent = NET.host ? `HOST - ${netPlayers.size + 1} players` : quiet > 1500 ? `connection hiccup... (${(quiet / 1000).toFixed(0)}s)` : `ping ${Math.round(NET.rtt)} ms`;
    ui.netPing.style.color = quiet > 1500 ? '#fca5a5' : '';
    if (!ui.netBoard.classList.contains('hidden')) renderBoard();
}
function renderBoard() {
    if (NET.mode === 'tourney') { ui.netBoardInner.innerHTML = tourneyBoardHtml(); return; }
    const rows = (list) => list.map(p => `<tr class="${p.id === NET.id ? 'bg-white/10' : ''}"><td class="py-1 pr-6 font-black" style="color:${hex(pcol(p))}">${tagHtml(p)}${escHtml(p.name)}${tagSub(p)}${p.id === 0 ? ' <span class="text-[10px] text-amber-300">HOST</span>' : ''}</td><td class="pr-6">${p.kills}</td><td class="pr-6">${p.deaths}</td><td class="text-gray-400">${p.id === NET.id ? (NET.host ? '-' : Math.round(NET.rtt)) : (p.id === 0 ? '-' : Math.round(p.rtt))}</td></tr>`).join('');
    const head = `<tr class="text-xs text-gray-400 tracking-widest"><td class="pr-6">PLAYER</td><td class="pr-6">${NET.pvp ? 'KILLS' : 'KILLS'}</td><td class="pr-6">${NET.pvp ? 'DEATHS' : 'DOWNS'}</td><td>PING</td></tr>`;
    const all = allPlayers();
    ui.netBoardInner.innerHTML = `<div class="text-2xl font-black mb-3">${escHtml(netModeName())} <span class="text-sm text-gray-400">${MAPS[run.map] ? MAPS[run.map].name : ''}</span></div>` +
        (NET.pvp ? [0, 1].map(t => `<div class="font-black mt-2" style="color:${hex(TEAM_COLORS[t])}">${TEAM_NAMES[t]} - ${NET.score[t]}</div><table class="w-full text-sm font-bold">${head}${rows(all.filter(p => p.team === t).sort((a, b) => b.kills - a.kills))}</table>`).join('')
                 : `<table class="w-full text-sm font-bold">${head}${rows(all)}</table>`);
}
document.addEventListener('keydown', (e) => { if (e.code === 'Tab' && NET.inGame) { e.preventDefault(); ui.netBoard.classList.remove('hidden'); renderBoard(); } });
document.addEventListener('keyup', (e) => { if (e.code === 'Tab') ui.netBoard.classList.add('hidden'); });
function netDrawMinimap(c, scale, off) {
    for (const p of netPlayers.values()) {
        if (!p.av || !p.av.g.visible) continue;
        if (NET.pvp && p.team !== NET.team) continue;          // don't give away where the other team is
        const P = p.av.g.position, x = (P.x + off) * scale, y = (P.z + off) * scale;
        c.fillStyle = (p.f & 1) ? hex(NET.pvp ? TEAM_COLORS[p.team] : p.color) : '#6b7280';
        c.strokeStyle = '#fff'; c.lineWidth = 1.5;
        c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2); c.fill(); c.stroke();
    }
}


// ---------- the multiplayer menu ----------
function openMP(view) { NET.view = view || NET.view || 'home'; ui.mp.classList.remove('hidden'); renderMP(); }
function hideMP() { ui.mp.classList.add('hidden'); LAN.sync(); }
function chip(on, attrs, text, dot) { return `<button class="chip${on ? ' on' : ''}" ${attrs}>${dot ? `<span class="pdot" style="background:${dot};color:${dot}"></span>` : ''}${text}</button>`; }
function renderMP() {
    if (ui.mp.classList.contains('hidden')) return;
    const v = NET.view;
    let h = '';
    if (v === 'home') {
        const lname = GVL.name(); if (lname && NET.name !== lname) NET.name = lname;
        h += `<div class="mdesc text-sm mb-4">Play with friends straight from your browsers - no accounts. One person <b class="text-white">hosts</b> (their computer runs the game) and gets a <b class="text-white">6-digit party code</b>. Everyone else clicks <b class="text-white">JOIN</b> and types it in.</div>`;
        if (NET.homeMsg) h += `<div class="panel px-4 py-2 font-bold text-red-200 mb-4">${escHtml(NET.homeMsg)}</div>`;
        h += `<div class="mlabel">YOUR NAME</div><input id="mp-name" maxlength="16" value="${escHtml(NET.name)}"${GVL.name() ? ' readonly title="Your Grapevine name"' : ''} class="bg-gray-900 border-2 border-gray-700 rounded-lg px-3 py-2 font-black text-lg w-72 text-white focus:outline-none focus:border-blue-400">${GVL.name() ? '<div class="text-xs text-gray-400 mt-1">Playing as your Grapevine account.</div>' : (GVL.L ? '<div class="text-xs text-gray-400 mt-1">Tip: sign in to Grapevine in the launcher to keep one name and make friends from here.</div>' : '')}`;
        h += mpClassRow();
        h += `<label class="flex items-center gap-3 text-sm font-bold text-gray-300 mt-4"><input type="checkbox" id="mp-lan" class="w-4 h-4 accent-blue-500"${NET.lanOnly ? ' checked' : ''}> Same Wi-Fi only (skips the one-time "what's my address?" lookup - only works on the same network)</label>`;
        h += `<div class="grid grid-cols-2 gap-4 mt-6">
                <button id="mp-host" class="hbtn pri card">HOST A PARTY<div class="text-xs font-bold text-blue-100 mt-1">You pick the mode. Up to 10 players.</div></button>
                <button id="mp-join" class="hbtn card">JOIN A PARTY<div class="text-xs font-bold text-gray-400 mt-1">Type in the host's 6-digit code.</div></button>
              </div>`;
        h += `<div id="mp-lan-list" class="mt-6">${LAN.html()}</div>`;
        h += `<div class="mdesc mt-6">Modes: CO-OP waves (up to 10 players), or team deathmatch 1v1, 2v2, 3v3, 4v4 and 5v5. Tip: the host should keep the game window open - it's running the match for everyone.</div>`;
    } else if (v === 'host') {
        const cs = NET.codeState, codeTxt = cs === 'ready' ? NET.code.slice(0, 3) + ' ' + NET.code.slice(3) : '--- ---';
        h += `<div class="panel p-4 flex items-center gap-6 flex-wrap">
                <div><div class="text-xs font-black tracking-widest text-gray-400">PARTY CODE</div><div class="text-5xl font-black font-mono tracking-widest">${codeTxt}</div></div>
                <div class="flex-1 min-w-[220px] text-sm font-bold ${cs === 'error' ? 'text-red-300' : 'text-gray-200'}">${cs === 'ready' ? 'Tell your friends this number. They click <b>JOIN A PARTY</b> and type it in.' : cs === 'error' ? escHtml(NET.codeErr || 'Could not get a code.') + ' <button id="mp-code-retry" class="chip ml-2">TRY AGAIN</button><div class="text-xs text-gray-400 mt-1">You can still invite people with a long code below.</div>' : 'Getting a party code...'}</div>
              </div>`;
        h += `<label class="flex items-center gap-3 text-sm font-bold text-gray-300 mt-4"><input type="checkbox" id="mp-lanshow" class="w-4 h-4 accent-blue-500"${settings.lanShow !== false ? ' checked' : ''}> Show my game on this wifi</label>` + HGI.html();
        h += `<div id="mp-settings"></div>` + mpClassRow() + `<div class="mlabel">PLAYERS</div><div id="mp-players" class="flex flex-col gap-1.5"></div>`;
        h += `<button id="mp-long-toggle" class="chip mt-4">${NET.showLong ? 'HIDE LONG-CODE INVITES' : "CAN'T CONNECT? INVITE WITH A LONG CODE INSTEAD"}</button>`;
        if (NET.showLong) {
            h += `<div class="mdesc mb-2">Backup method that uses no matchmaking server at all: each friend gets their own invite code, and sends one back.</div><div id="mp-invites" class="flex flex-col gap-3"></div>`;
            h += `<button id="mp-invite" class="chip mt-3">+ INVITE A PLAYER</button>`;
        }
        h += `<div class="flex items-center gap-4 mt-6"><button id="mp-start" class="hbtn pri xl">START MATCH &#9654;</button><div id="mp-start-msg" class="text-sm font-bold text-amber-300">${escHtml(NET.hostMsg || '')}</div></div>`;
    } else if (v === 'join') {
        if (NET.joinState === 'connected') {
            const L = NET.lobby, mode = MP_MODES[L.mode] || MP_MODES.coop;
            h += `<div class="panel px-4 py-3 font-black text-green-300">CONNECTED! Waiting for the host to start...</div>`;
            h += `<div class="mt-4 text-lg font-black">${mode.name} <span class="text-gray-400 text-sm">on ${L.map === 'random' ? 'a random map' : (MAPS[L.map] ? MAPS[L.map].name : L.map)}${L.mode === 'coop' ? ' - ' + (DIFFICULTIES[L.diff] || DIFFICULTIES.normal).name : ''}</span></div>`;
            h += HGI.html() + mpClassRow();
            h += `<div class="mlabel">PLAYERS</div><div id="mp-players" class="flex flex-col gap-1.5"></div>`;
        } else if (!NET.showLong) {
            h += `<div class="mlabel">ENTER THE 6-DIGIT PARTY CODE</div>
                  <div class="flex items-center gap-3"><input id="mp-join-code" inputmode="numeric" autocomplete="off" maxlength="7" value="${escHtml(NET.joinCode || '')}" placeholder="000000" class="bg-gray-900 border-2 border-gray-700 rounded-lg px-4 py-2 font-black font-mono text-4xl tracking-widest w-64 text-center text-white focus:outline-none focus:border-blue-400">
                  <button id="mp-join-go" class="hbtn pri xl"${NET.joinState === 'connecting' ? ' disabled' : ''}>JOIN</button></div>`;
            if (NET.joinState === 'connecting') h += `<div class="mt-3 font-bold text-blue-200">Connecting to party ${escHtml(NET.joinCode)}...</div>`;
            h += `<div id="mp-lan-list" class="mt-4">${LAN.html()}</div>`;
            h += `<div class="mdesc mt-2">Dropped out of a match? Just type the code again - you'll jump back in.</div>`;
            if (NET.joinState === 'error') h += `<div class="mt-3 text-sm font-bold text-red-300">${escHtml(NET.joinErr || 'Something went wrong.')}</div>`;
            h += `<button id="mp-long-toggle" class="chip mt-6">CAN'T CONNECT? JOIN WITH A LONG CODE INSTEAD</button>`;
        } else {
            h += `<button id="mp-long-toggle" class="chip mb-2">BACK TO THE 6-DIGIT CODE</button>`;
            h += `<div class="mlabel">1. PASTE THE HOST'S INVITE CODE</div><textarea id="mp-code" rows="3" class="w-full bg-gray-900 border-2 border-gray-700 rounded-lg p-2 text-xs font-mono text-gray-200 focus:outline-none focus:border-blue-400" placeholder="BLKZ....">${escHtml(NET.inviteText || '')}</textarea>`;
            h += `<button id="mp-make-reply" class="chip mt-2"${NET.joinState === 'making' ? ' disabled' : ''}>MAKE MY REPLY CODE</button>`;
            if (NET.joinState === 'making') h += `<div class="mdesc">Making your reply code...</div>`;
            if (NET.joinState === 'error') h += `<div class="mt-2 text-sm font-bold text-red-300">${escHtml(NET.joinErr || 'Something went wrong.')}</div>`;
            if (NET.joinState === 'reply') {
                h += `<div class="mlabel">2. SEND THIS REPLY CODE BACK TO THE HOST</div><textarea id="mp-reply" rows="3" readonly class="w-full bg-gray-900 border-2 border-blue-500 rounded-lg p-2 text-xs font-mono text-gray-200">${NET.replyCode}</textarea>`;
                h += `<button id="mp-copy-reply" class="chip mt-2">COPY</button><div class="mdesc">Waiting for the host to paste it... (keep this screen open)</div>`;
            }
        }
    }
    ui.mpBody.innerHTML = h;
    LAN.sync();
    if (v === 'host') { renderMPSettings(); renderMPPlayers(); renderMPInvites(); }
    if (v === 'join' && NET.joinState === 'connected') renderMPPlayers();
}
// 4.0: your class for co-op (the same setting as the Play tab; PvP plays without classes)
function mpClassRow() {
    const cur = validClass(settings.cls), C = CLASSES[cur];
    return `<div class="mlabel">YOUR CLASS <span class="text-gray-500">- CO-OP ONLY, OFF IN PVP</span></div><div class="flex flex-wrap gap-2">${CLASS_ORDER.map(k => chip(k === cur, `data-mpcls="${k}"`, CLASSES[k].name, hex(CLASSES[k].color))).join('')}</div>
        <div class="mdesc"><b style="color:${hex(C.color)}">${C.ability} (X)</b> - ${C.abilityDesc} <b class="text-gray-300">Passive</b> - ${C.passive}</div>`;
}
function renderMPSettings() {
    const el = $('mp-settings'); if (!el) return;
    const L = NET.lobby;
    let h = `<div class="mlabel">MODE</div><div class="flex flex-wrap gap-2">${Object.entries(MP_MODES).map(([k, m]) => chip(L.mode === k, `data-mpset="mode" data-val="${k}"`, m.name)).join('')}</div>`;
    h += `<div class="mdesc">${L.mode === 'coop' ? MP_MODES.coop.desc : L.mode === 'tourney' ? MP_MODES.tourney.desc + ' Needs 4 to 8 players; the Tournament Arena is used whatever map is picked.' : `Team deathmatch, ${MP_MODES[L.mode].team} per team. First team to ${PVP_TARGET[L.mode]} kills wins. Everyone gets every gun; respawn after 3s.`}</div>`;
    h += `<div class="mlabel">MAP</div><div class="flex flex-wrap gap-2">${chip(L.map === 'random', 'data-mpset="map" data-val="random"', 'RANDOM')}${Object.entries(MAPS).filter(([, m]) => !m.hidden).map(([k, m]) => chip(L.map === k, `data-mpset="map" data-val="${k}"`, m.name)).join('')}</div>`;
    if (L.mode === 'coop') h += `<div class="mlabel">DIFFICULTY</div><div class="flex flex-wrap gap-2">${Object.entries(DIFFICULTIES).map(([k, d]) => chip(L.diff === k, `data-mpset="diff" data-val="${k}"`, d.name, d.color)).join('')}</div>`;
    el.innerHTML = h;
}
function renderMPPlayers() {
    const el = $('mp-players'); if (!el) return;
    const pvp = NET.lobby.mode !== 'coop' && NET.lobby.mode !== 'tourney';
    const list = [{ id: NET.id, name: NET.name, team: NET.host && NET.me ? NET.me.team : NET.team, color: NET.host ? COOP_COLORS[0] : (NET.color || 0x888888), rtt: 0, me: true, gv: GVL.on() }]
        .concat([...netPlayers.values()].map(p => ({ id: p.id, name: p.name, team: p.team, color: p.color, rtt: p.rtt, pending: p.pending, gv: p.gv, look: p.look })));
    el.innerHTML = list.sort((a, b) => a.id - b.id).map(p => {
        const col = pvp ? TEAM_COLORS[p.team] : p.color;
        return `<div class="bcard items-center${NET.host && pvp ? ' cursor-pointer hover:border-white/40' : ''}" ${NET.host && pvp ? `data-mpteam="${p.id}"` : ''}><span class="pdot" style="background:${hex(col)};color:${hex(col)}"></span><div class="flex-1 font-black">${tagHtml(p)}${escHtml(p.name)}${p.gv ? ' <span class="text-xs text-green-300" title="Verified Grapevine account">&#10003;</span>' : ''}${p.me ? ' <span class="text-xs text-gray-400">(you)</span>' : ''}${p.id === 0 ? ' <span class="text-[10px] text-amber-300">HOST</span>' : ''}${p.pending ? ' <span class="text-xs text-gray-400">joining...</span>' : ''}${tagSub(p)}</div>${pvp ? `<div class="text-xs font-black" style="color:${hex(col)}">${TEAM_NAMES[p.team]}${NET.host ? ' <span class="text-gray-400">(click to swap)</span>' : ''}</div>` : ''}<div class="text-xs text-gray-400 w-16 text-right">${p.me || p.id === 0 ? '' : Math.round(p.rtt) + ' ms'}</div>${p.gv && !p.me ? GVL.friendBtn(p.name) : ''}${NET.host && !p.me ? `<button class="chip" data-mpkick="${p.id}">KICK</button>` : ''}</div>`;
    }).join('');
}
function renderMPInvites() {
    const el = $('mp-invites'); if (!el) return;
    el.innerHTML = NET.invites.map((inv, i) => `<div class="bcard flex-col" data-inv="${inv.key}">
            <div class="text-xs font-black text-gray-400 tracking-widest">INVITE #${i + 1}</div>
            <textarea rows="2" readonly class="w-full bg-gray-900 border border-gray-700 rounded p-2 text-xs font-mono text-gray-200">${inv.code}</textarea>
            <div class="flex gap-2"><button class="chip" data-invcopy="${inv.key}"${inv.code ? '' : ' disabled'}>COPY INVITE CODE</button><button class="chip" data-invcancel="${inv.key}">CANCEL</button></div>
            <textarea rows="2" class="w-full bg-gray-900 border border-gray-700 rounded p-2 text-xs font-mono text-gray-200" placeholder="Paste their reply code here" data-invreply="${inv.key}">${escHtml(inv.reply || '')}</textarea>
            <div class="flex items-center gap-3"><button class="chip" data-invgo="${inv.key}">CONNECT</button><div class="text-xs font-bold text-gray-300">${escHtml(inv.status)}</div></div>
        </div>`).join('');
}
async function copyText(t) {
    try { await navigator.clipboard.writeText(t); toastMP('Copied!'); }
    catch (e) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toastMP('Copied!'); } catch (e2) { toastMP('Select the code and copy it by hand'); } ta.remove(); }
}
function toastMP(msg) { const d = document.createElement('div'); d.className = 'fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 border-2 border-blue-400 text-white font-black px-5 py-2 rounded-lg z-[60]'; d.textContent = msg; document.body.appendChild(d); setTimeout(() => d.remove(), 1400); }
ui.mp.addEventListener('click', (ev) => {
    const b = ev.target.closest('button, [data-mpteam]'); if (!b) return;
    const inv = (key) => NET.invites.find(i => i.key === key);
    if (b.dataset.lanjoin) { netReset(); NET.homeMsg = ''; openMP('join'); clientJoinCode(b.dataset.lanjoin); }
    else if (b.id === 'mp-hginvite') { HGI.open = !HGI.open; HGI.msg = ''; renderMP(); }
    else if (b.dataset.hgsend) HGI.send(b.dataset.hgsend);
    else if (b.id === 'mp-host') {
        netReset();
        NET.on = true; NET.host = true; NET.id = 0; NET.homeMsg = ''; NET.hostMsg = ''; NET.color = COOP_COLORS[0];
        NET.me = { id: 0, name: NET.name, team: 0, color: COOP_COLORS[0], kills: 0, deaths: 0, alive: true, rtt: 0 };
        openMP('host'); sfx('click');
        hostOpenCode(); startHiddenTicker();
    } else if (b.id === 'mp-join') { netReset(); NET.homeMsg = ''; openMP('join'); }
    else if (b.id === 'mp-join-go') clientJoinCode($('mp-join-code').value);
    else if (b.id === 'mp-code-retry') { if (NET.pj) { try { NET.pj.destroy(); } catch (e) {} NET.pj = null; } hostOpenCode(); }
    else if (b.id === 'mp-long-toggle') { NET.showLong = !NET.showLong; if (NET.showLong && NET.host && !NET.invites.length) hostCreateInvite(); else renderMP(); }
    else if (b.id === 'mp-make-reply') {
        const c = $('mp-code').value;
        if (!c.trim() || NET.joinState === 'making') return;
        NET.inviteText = c;
        // same invite again while its reply is still on screen: nothing new to make
        if (NET.joinState === 'reply' && NET.replyCode && c.replace(/\s+/g, '') === NET.replyFor) { toastMP('Your reply code is below - send it to the host'); return; }
        clientJoin(c);
    }
    else if (b.id === 'mp-copy-reply') copyText(NET.replyCode);
    else if (b.id === 'mp-invite') hostCreateInvite();
    else if (b.id === 'mp-start') { initAudio(); hostStartGame(); }
    else if (b.dataset.mpcls) { settings.cls = validClass(b.dataset.mpcls); saveSettings(); if (!NET.inGame) playerStats.cls = settings.cls; sfx('click'); renderMP(); if (currentGameState === 'main') renderMenu(); }
    else if (b.dataset.mpset) { NET.lobby[b.dataset.mpset] = b.dataset.val; if (b.dataset.mpset === 'mode') { for (const p of allPlayers()) p.team = 0; for (const p of allPlayers()) autoTeam(p); } NET.hostMsg = ''; hostLobbyUpdate(); }
    else if (b.dataset.mpteam !== undefined && NET.host) {
        const p = playerById(+b.dataset.mpteam); if (p) p.team = 1 - p.team;
        NET.hostMsg = ''; hostLobbyUpdate();
    }
    else if (b.dataset.gvfriend) { const L = GVL.L, who = b.dataset.gvfriend; if (L) { b.disabled = true; L.addFriend(who).then(renderMPPlayers, (e) => { b.disabled = false; netFeed(escHtml(e.message || 'Could not send that request')); }); } }
    else if (b.dataset.mpkick) { const id = +b.dataset.mpkick; const p = netPlayers.get(id); if (p) { sendRel(p.peer, { t: 'bye' }); netRemovePlayer(id, 'was kicked'); } }
    else if (b.dataset.invcopy) { const i = inv(b.dataset.invcopy); if (i && i.code) copyText(i.code); }
    else if (b.dataset.invcancel) { const i = inv(b.dataset.invcancel); if (i) { try { i.peer.pc.close(); } catch (e) {} NET.invites = NET.invites.filter(x => x !== i); renderMPInvites(); } }
    else if (b.dataset.invgo) { const i = inv(b.dataset.invgo); const ta = ui.mp.querySelector(`[data-invreply="${b.dataset.invgo}"]`); if (i && ta && ta.value.trim()) { i.reply = ta.value; hostAcceptReply(i, ta.value); } }
});
ui.mp.addEventListener('keydown', (ev) => { if (ev.target.id === 'mp-join-code' && ev.key === 'Enter') clientJoinCode(ev.target.value); });
ui.mp.addEventListener('input', (ev) => {
    if (ev.target.id === 'mp-join-code') { ev.target.value = ev.target.value.replace(/\D/g, '').slice(0, 6); NET.joinCode = ev.target.value; }
    if (ev.target.id === 'mp-name' && !GVL.name()) { NET.name = ev.target.value.replace(/[<>]/g, '').slice(0, 16) || 'Player'; if (NET.me) NET.me.name = NET.name; settings.mpName = NET.name; saveJSON('blocky21_settings', settings); }
    // pasted codes survive the menu redrawing (someone joining, a status update) instead of vanishing
    if (ev.target.id === 'mp-code') NET.inviteText = ev.target.value;
    if (ev.target.dataset && ev.target.dataset.invreply) { const i = NET.invites.find(x => x.key === ev.target.dataset.invreply); if (i) i.reply = ev.target.value; }
});
ui.mp.addEventListener('change', (ev) => {
    if (ev.target.id === 'mp-lanshow') { settings.lanShow = ev.target.checked; saveJSON('blocky21_settings', settings); LAN.sync(); }
    if (ev.target.id === 'mp-lan') { NET.lanOnly = ev.target.checked; settings.mpLan = NET.lanOnly; saveJSON('blocky21_settings', settings); }
});
$('mp-back').addEventListener('click', () => {
    if (NET.view === 'home') { hideMP(); return; }
    if (NET.on || NET.hostPeer) { netSend({ t: 'bye' }); const hp = NET.hostPeer; setTimeout(() => { try { hp && hp.pc.close(); } catch (e) {} for (const p of netPlayers.values()) try { p.peer && p.peer.pc.close(); } catch (e) {} }, 200); }
    netReset(); openMP('home');
});
$('btn-mp').addEventListener('click', () => { initAudio(); openMP('home'); });
$('btn-go-menu').addEventListener('click', () => { if (NET.on) { h2Reset(); netLeave(); } });
window.addEventListener('beforeunload', () => { if (NET.on) netSend({ t: 'bye' }); });
// test hooks
Object.assign(window.__blocky, {
    get NET() { return NET; }, get netPlayers() { return netPlayers; },
    netRevive: () => netRespawn(spawnPt, maxHp),
    netDead: () => NET.dead,
    // test hooks for the 5.0 enemies in co-op (a page can be both the host that writes a snapshot and the guest that reads it)
    mpTest: {
        netMessage: (m) => netMessage(NET.hostPeer || {}, m), netBinary: (b) => netBinary(NET.hostPeer, b), snapshot: (now) => hostEnemySnapshot(now),
        updateGuest: (dt) => netUpdateEnemies(dt), E_STATES, ENEMY_IDS, jamT: () => jamT, jamGun: (t) => jamGun(t), tickJam: (dt) => tickJam(dt),
        spawnPack: (x, z) => { const e = spawnEnemy(enemyTypes.hound, x, z, groundAt(x, z, 0, 50) + 0.1, 4, 10); spawnHoundPack(e, x, z, groundAt(x, z, 0, 50) + 0.1, 4, 10); return e; },
        endMatch: () => { if (!NET.host || !NET.inGame) return; NET.over = true; const m = { t: 'over', n: playerStats.level }; netBroadcast(m); netShowEnd(m); },   // as a squad wipe ends it
        emp: (c, r) => empBurst(c, r), canShoot: () => canShoot(), reloading: () => isReloading, reload: () => triggerReload(), setAmmo: (n) => { ammoState[playerStats.currentWeapon] = n; },
        life: () => life, mig: (x) => migEnemyIds(x), spawnWave: () => spawnWave(), waveInfo: () => ({ lvl: playerStats.level, bosses: waveBosses(playerStats.level) }),
        dropAll: () => { enemies.forEach(e => { scene.remove(e); disposeEnemy(e); }); enemies.length = 0; enemyById.clear(); },
        damage: (e, n) => damageEnemy(e, n, false, null), gameTime: () => gameTime, hold: () => { waveActive = true; intermission = 0; }, playFx: (m) => netPlayFx(m), enemyById: (id) => enemyById.get(id)
    }
});
