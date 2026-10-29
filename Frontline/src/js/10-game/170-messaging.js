// ---------- messaging ----------
function netMessage(m) {
  switch (m.t) {
    case 'ping': sendRel({ t: 'pong', ts: m.ts }); break;
    case 'pong': NET.rtt = performance.now() - m.ts; if (W && NET.role === 'host') { const g = W.players.find(p => p.kind === 'remote'); if (g) g.rtt = NET.rtt; } break;
    case 'full': NET.joinState = 'error'; NET.joinErr = 'That game is already full.'; netReset(); showScreen('mp'); break;
    case 'badver': NET.joinState = 'error'; NET.joinErr = 'That game uses a different version of Frontline. Ask your friend to reload the page.'; netReset(); showScreen('mp'); break;
    case 'hello': if (NET.role === 'host') { if ((m.ver && m.ver !== VERSION) || (m.nv | 0) !== NETV) { sendRel({ t: 'badver' }); const pp = NET.peer; setTimeout(() => { try { pp && pp.pc.close(); } catch (e) { } }, 300); NET.peer = null; return; } NET.guestName = String(m.name || 'Friend').slice(0, 14); if (NET.guestName === SET.name) NET.guestName += ' 2'; setGuestFac(m.fac); NET.guestGv = ''; if (GVL.on()) { NET.gvn = GVL.L.newChallenge(); sendRel({ t: 'gvq', n: NET.gvn }); } lobbyChanged(); if (SCREEN === 'mplobby') refreshLobby(); lobbyChat('System', NET.guestName + ' joined.'); } break;
    case 'gvq': { const L = GVL.L; if (L && L.online() && typeof m.n === 'string' && m.n.length <= 64) L.prove(m.n, 'frontline').then(pr => { if (pr) sendRel({ t: 'gva', p: pr }); }); break; }
    case 'gva': {
      const L = GVL.L, host = NET.role === 'host', n = host ? NET.gvn : NET.hostGvn; if (!L || !n) break;
      if (host) NET.gvn = null; else NET.hostGvn = null;
      L.check(m.p, n, 'frontline').then(r => {
        if (!r.ok || !NET.peer) return;
        L.noteMet(r.name, 'Frontline');
        if (host) { NET.guestGv = r.name; NET.guestName = r.name.slice(0, 14); lobbyChanged(); } else NET.hostGv = r.name;
        if (SCREEN === 'mplobby') refreshLobby();
      });
      break;
    }
    case 'ready': if (NET.role === 'host') { NET.guestReady = !!m.v; if (SCREEN === 'mplobby') refreshLobby(); lobbyChanged(); } break;
    case 'fac': if (NET.role === 'host') { setGuestFac(m.v); lobbyChanged(); if (SCREEN === 'mplobby') refreshLobby(); } break;   // 3.0: the guest picked an army
    case 'lobby': if (NET.role === 'guest') { NET.lobby = m.l; NET.hostName = m.l.hostName; if (SCREEN !== 'mplobby' && SCREEN !== 'results' && !inGame) showScreen('mplobby'); else refreshLobby(); } break;
    case 'lchat': lobbyChat(m.n, m.m); break;
    case 'start': if (NET.role === 'guest') guestStart(m); break;
    case 'cmd': if (NET.role === 'host') hostCmd(m.c); break;
    case 'meta': if (NET.role === 'guest') applyMeta(m); break;
    case 'ev': if (NET.role === 'guest' && W) for (const e of m.e) W.ev.push(e); break;
    case 'bye': if (NET.role === 'host') hostGuestGone(); else guestHostGone('The host left the game.'); break;
  }
}
function hostCmd(c) {
  if (!W || !W.o.mp || !c || typeof c.k !== 'string') return; const now = performance.now(); if (now - NET.cmdWinT > 1000) { NET.cmdWinT = now; NET.cmdWin = 0; } if (++NET.cmdWin > 80) return;
  const g = W.players.find(p => p.kind === 'remote'); if (!g) return; if (c.ids) { if (!Array.isArray(c.ids)) return; c.ids = c.ids.slice(0, 300).filter(x => Number.isInteger(x)); }
  NET.cmdRx++; if (c.k === 'surrender') { eliminate(g, 'Surrendered'); return; } if (c.k === 'chat') c.m = String(c.m || '').slice(0, 80);
  applyCmd(g.id, c); NET.dirty = true;
}
function netSendCmd(c) { sendRel({ t: 'cmd', c }); }
function setGuestFac(v) { NET.guestFac = v === 1 ? 1 : 0; if (SK && SK.slots[1] && SK.slots[1].kind === 'remote') SK.slots[1].fac = NET.guestFac; }
function netSurrender() { if (!W) return; if (NET.role === 'guest') { sendRel({ t: 'cmd', c: { k: 'surrender' } }); } else if (NET.role === 'host') { eliminate(P(ME), 'Surrendered'); netFlush(); } }
function netLeave() { NET.leaving = true; sendRel({ t: 'bye' }); const p = NET.peer; setTimeout(() => { try { p && p.pc.close(); } catch (e) { } }, 250); netReset(); }
// ---------- lobby ----------
function lobbyPayload() {
  const d = mapDef(SK.map); return { map: SK.map, mapName: d.name, maxP: d.maxP, slots: SK.slots.slice(0, d.maxP).map((s, i) => ({ kind: s.kind, team: s.team, pers: s.pers, diff: s.diff, fac: i === 0 ? SK.fac | 0 : s.kind === 'remote' ? NET.guestFac | 0 : aiFac(SK, s) })), tickets: SK.tickets, supplies: SK.supplies, fog: SK.fog, speed: SK.speed, maxPop: SK.maxPop, hostName: SET.name, guestName: NET.guestName, guestReady: NET.guestReady, connected: !!NET.peer };
}
function lobbyChanged() { if (NET.role === 'host' && NET.peer) sendRel({ t: 'lobby', l: lobbyPayload() }); }
function lobbyChat(n, m) { const c = $('#lchat'); if (!c) { NET.chatLog = (NET.chatLog || []).concat([[n, m]]).slice(-30); return; } const d = document.createElement('div'); d.innerHTML = '<b style="color:#ffe2a6">' + esc(n) + ':</b> ' + esc(m); c.appendChild(d); c.scrollTop = c.scrollHeight; }
function hostStartMatch() {
  if (NET.role !== 'host') return; const err = validSK(SK); if (!NET.peer) { toast('Waiting for a friend to join'); return; } if (!NET.guestReady) { toast('Your friend is not ready yet'); return; } if (err) { toast(err); return; }
  const cfg = skToCfg(SK); cfg.maxPop = Math.min(SK.maxPop, Math.max(60, SET.maxUnits)); { const wc = pickWx(mapDef(SK.map), 'map', 'map'); cfg.tod = wc.tod; cfg.weather = wc.weather; }   // 3.0: online battles use the map's own conditions (the same for both sides)
  const gi = cfg.players.findIndex(p => p.kind === 'remote'); cfg.players[gi].name = NET.guestName; cfg.players[gi].fac = NET.guestFac | 0;
  NET.matchGuest = gi; sendRel({ t: 'start', cfg, me: gi }); startGame(cfg, { mp: true, me: 0 });
}
function guestStart(m) { NET.matchGuest = m.me; const cfg = m.cfg; cfg.players[m.me].kind = 'human'; cfg.players[0].kind = 'remote'; startGame(cfg, { mp: true, mirror: true, me: m.me }); }
function netBackToLobby() {
  if (NET.role === 'host') { NET.guestReady = false; showScreen('mplobby'); lobbyChanged(); } else if (NET.role === 'guest') { NET.myReady = false; sendRel({ t: 'ready', v: 0 }); showScreen('mplobby'); } else showScreen('main');
}
// ---------- screens ----------
SCREENS.notice = (a) => `<div class="scr bg"><div class="panel" style="width:min(420px,96vw);text-align:center"><h2 style="color:#ffe2a6;margin:0 0 8px">${esc(a.title)}</h2><div class="note" style="font-size:14px">${esc(a.msg)}</div><button class="mbtn go" style="margin-top:14px" data-act="back">OK</button></div></div>`;
SCREENS.mp = () => `<div class="scr bg"><div class="panel" style="width:min(520px,98vw)"><div class="row" style="justify-content:space-between"><h2 style="margin:0;color:#ffe2a6">Play a Friend Online</h2><button class="tbtn" data-act="mpback">Back</button></div>
  <div class="note" style="margin:8px 0">Play 1 vs 1 against a friend. One of you picks "Host a game" and gets a 6-digit code. The other types that code in and presses Join. Works on different Wi-Fi networks and phone data too.</div>
  <button class="mbtn go" data-act="mphost">Host a game<small style="color:#3a2810">You get a 6-digit code to share</small></button>
  <div class="lbl">Join a game</div><div class="row"><input type="text" id="joincode" inputmode="numeric" maxlength="6" placeholder="000000" style="font-size:26px;letter-spacing:.3em;width:200px;text-align:center" value="${esc(NET.joinCode || '')}"><button class="mbtn" style="width:auto;margin:0;padding:12px 22px" data-act="mpjoin" ${NET.joinState === 'connecting' ? 'disabled' : ''}>Join</button></div>
  <div class="note" style="margin-top:8px;min-height:20px;color:${NET.joinState === 'error' ? '#ff9a8a' : '#8c9db1'}">${NET.joinState === 'connecting' ? 'Connecting to ' + esc(NET.joinCode) + '...' : esc(NET.joinErr || '')}</div></div></div>`;
SCREENS_AFTER.mp = () => { const i = $('#joincode'); if (i) { i.addEventListener('input', () => { i.value = i.value.replace(/\D/g, '').slice(0, 6); NET.joinCode = i.value; }); i.addEventListener('keydown', e => { if (e.key === 'Enter') netJoin(i.value); }); } };
const viaTag = () => NET.peer && NET.via ? '<span class="note" style="margin-left:8px" data-tip="' + (NET.via === 'relay' ? 'Relay connection|A direct link between your two networks was blocked, so the game is passed through a relay server. Works anywhere, slightly more delay.' : 'Direct connection|Your two computers are talking directly. Fastest possible.') + '">' + (NET.via === 'relay' ? 'Relay link' : 'Direct link') + '</span>' : '';
function lobbyMainHtml() {
  if (NET.role === 'host') {
    const d = mapDef(SK.map), n = d.maxP; let rows = ''; const colors = assignColors(SK);
    if (NET.codeState === 'loading') return '<div class="note" style="padding:30px;text-align:center">Creating your code...</div>';
    if (NET.codeState === 'error') return '<div class="note" style="padding:20px;color:#ff9a8a;text-align:center">' + esc(NET.codeErr) + '</div><button class="mbtn" data-act="mphost">Try again</button>';
    for (let i = 0; i < n; i++) {
      const s = SK.slots[i]; rows += `<div class="slot"><span class="cdot" style="background:${hex3(PCOL[colors[i]].c)}"></span>`;
      if (i === 0) rows += `<b style="min-width:130px">${esc(SET.name)} (Host)${GVL.on() ? ' <span style="color:#7be08a" data-tip="Verified|You are signed in to Grapevine.">&#10003;</span>' : ''}</b>` + sel('hfac', FACS.map(f => [f.id, f.n]), SK.fac | 0, 'hostfac', 'data-tip="Your army|Pick the army you lead."');
      else if (i === 1) rows += `<b style="min-width:130px">${NET.peer ? esc(NET.guestName) + GVL.tag(NET.guestGv) : '<span style="color:#8c9db1">Waiting for friend...</span>'}</b><span style="color:${NET.guestReady ? '#7be08a' : '#8c9db1'}">${NET.peer ? (NET.guestReady ? 'Ready' : 'Not ready') : ''}</span>${NET.peer ? '<span class="note" style="margin-left:8px">' + FACS[NET.guestFac | 0].n + '</span>' : ''}${viaTag()}`;
      else rows += sel('kind' + i, [['ai', 'AI Commander'], ['closed', 'Closed']], s.kind, 'slotkind', 'data-i="' + i + '"');
      if (s.kind === 'ai') rows += sel('pers' + i, Object.values(AIP).map(p => [p.id, p.name]), s.pers, 'slotpers', 'data-i="' + i + '"') + sel('diff' + i, Object.entries(AID).map(([k, v]) => [k, v.n]), s.diff, 'slotdiff', 'data-i="' + i + '"') + slotFacSel(s, i);
      if (s.kind !== 'closed') rows += sel('team' + i, [[0, 'Team A'], [1, 'Team B'], [2, 'Team C'], [3, 'Team D']], s.team, 'slotteam', 'data-i="' + i + '"');
      rows += '</div>';
    }
    const mc = MAPS.map(m => `<div class="mc ${m.id === SK.map ? 'on' : ''}" data-act="map" data-v="${m.id}"><img src="${mapPreview(m.id)}" style="width:100%;border-radius:4px;display:block;margin-bottom:3px"/>${m.name}${m.naval || m.tod || m.wx ? '<small>' + [m.naval ? 'ships' : '', m.tod === 'night' ? 'night' : '', m.wx ? WXD[m.wx].n.toLowerCase() : ''].filter(Boolean).join(', ') + '</small>' : ''}</div>`).join('');   // 3.0: online battles use the map's own conditions
    return `<div class="lbl" style="margin-top:0">Your code</div><div class="big" data-tip="Share this code with your friend">${NET.code}</div><div style="text-align:center"><button class="tbtn" data-act="copycode">Copy code</button></div>${hgiHtml()}
    <div class="lbl">Map</div><div class="mapcards">${mc}</div><div class="lbl">Players</div>${rows}
    <div class="row" style="gap:16px"><div><div class="lbl">Starting score</div>${seg('tickets', [[200, '200'], [400, '400'], [700, '700']], SK.tickets)}</div><div><div class="lbl">Starting money</div>${seg('supplies', [['low', 'Low'], ['normal', 'Normal'], ['high', 'High']], SK.supplies)}</div><div><div class="lbl">Fog of war</div>${seg('fog', [[1, 'On'], [0, 'Off']], SK.fog ? 1 : 0)}</div><div><div class="lbl">Army limit</div>${seg('maxPop', [[80, '80'], [120, '120'], [160, '160']], SK.maxPop)}</div></div>
    <button class="mbtn go" style="margin-top:12px" data-act="mpstart" ${NET.peer && NET.guestReady ? '' : 'disabled'}>${NET.peer ? (NET.guestReady ? 'Start Match' : 'Waiting for friend to be ready...') : 'Waiting for a friend to join...'}</button>`;
  }
  const L = NET.lobby; if (!L) return '<div class="note" style="padding:30px;text-align:center">Connected! Waiting for the host...</div>';
  const colors = assignColors({ slots: L.slots }); const pl = L.slots.map((s, i) => ({ s, i })).filter(x => x.s.kind !== 'closed');
  const rows = pl.map(({ s, i }) => `<div class="slot"><span class="cdot" style="background:${hex3(PCOL[colors[i]].c)}"></span><b style="min-width:130px">${s.kind === 'remote' ? esc(SET.name) + ' (You)' : i === 0 ? esc(L.hostName) + ' (Host)' + GVL.tag(NET.hostGv) : esc(AIP[s.pers] ? AIP[s.pers].name : 'AI')}</b><span class="note">${s.kind === 'ai' ? 'AI - ' + AID[s.diff].n : ''} Team ${'ABCD'[s.team]} - ${FACS[(s.kind === 'remote' ? NET.myFac : s.fac) | 0].n}</span></div>`).join('');
  return `<div class="row"><img src="${mapPreview(L.map)}" style="width:150px;border-radius:6px"><div><b style="color:#ffe2a6;font-size:18px">${esc(L.mapName)}</b><div class="note">Score ${L.tickets} | Money ${L.supplies} | Fog ${L.fog ? 'on' : 'off'} | Army limit ${L.maxPop} | ${esc(wxName({ tod: mapDef(L.map).tod, weather: mapDef(L.map).wx }))}${mapDef(L.map).naval ? ' | Ships' : ''}</div></div></div><div class="lbl">Players</div>${rows}
  <div class="lbl">Your army</div>${seg('gfac', FACS.map(f => [f.id, f.n]), NET.myFac | 0, 'gfac')}<div class="note">${esc(FACS[NET.myFac | 0].d)}</div>
  <div style="margin-top:8px">${viaTag()}</div>
  <button class="mbtn ${NET.myReady ? '' : 'go'}" style="margin-top:12px" data-act="mpready">${NET.myReady ? 'Ready! (click to cancel)' : 'I am ready'}</button><div class="note" style="text-align:center">The host starts the match once everyone is ready.</div>`;
}
SCREENS.mplobby = () => `<div class="scr bg"><div class="panel" style="width:min(820px,98vw);max-height:96vh;overflow:auto"><div class="row" style="justify-content:space-between"><h2 style="margin:0;color:#ffe2a6">${NET.role === 'host' ? 'Hosting a game' : 'Game lobby'}</h2><button class="tbtn" data-act="mpleave">Leave</button></div><div id="lobbyMain">${lobbyMainHtml()}</div>
  <div class="lbl">Chat</div><div id="lchat" style="height:84px;overflow:auto;background:#0b121a;border:1px solid #243245;border-radius:6px;padding:4px 8px;font-size:12px"></div><input type="text" id="lchatin" maxlength="80" placeholder="Type a message and press Enter" style="width:100%;margin-top:4px"></div></div>`;
SCREENS_AFTER.mplobby = () => {
  const i = $('#lchatin'); if (i) i.addEventListener('keydown', e => { if (e.key === 'Enter' && i.value.trim()) { const m = i.value.trim(); i.value = ''; lobbyChat(SET.name, m); sendRel({ t: 'lchat', n: SET.name, m }); } });
  for (const [n, m] of (NET.chatLog || [])) lobbyChat(n, m); NET.chatLog = [];
};
function refreshLobby() { const l = $('#lobbyMain'); if (l && SCREEN === 'mplobby') l.innerHTML = lobbyMainHtml(); }
ACT.mpback = () => { netReset(); showScreen('main'); };
ACT.mphost = () => { netReset(); showScreen('mplobby'); netHostStart(); };
// 3.1 Grapevine invites (same launcher API as Blocky Shooter): HG_inviteTargets() lists the chats, HG_sendInvite(chat,
// { game, code }) posts "... hg-invite:frontline:<code>", and a friend's JOIN opens this game with HG_takeJoin / __hgJoin.
// HG_takeHost: Grapevine's "Invite to a game" opens the game wanting a room hosted and the code sent to one chat.
const HGHUB = (() => { try { const h = window.parent !== window ? window.parent : window.opener; return h && typeof h.HG_inviteTargets === 'function' && typeof h.HG_sendInvite === 'function' ? h : null; } catch (e) { return null; } })();
const HGI = { open: false, msg: '' };
function hgiHtml() {
  if (!HGHUB || NET.codeState !== 'ready' || !NET.code) return '';
  let h = '<div style="margin-top:8px;text-align:center"><button class="tbtn" data-act="gvinvite">Invite a friend on Grapevine</button> <span class="note" style="display:inline">' + esc(HGI.msg) + '</span>';
  if (HGI.open) {
    let t = []; try { t = HGHUB.HG_inviteTargets() || []; } catch (e) { }
    h += '<div style="display:flex;flex-direction:column;gap:5px;margin-top:6px;max-height:220px;overflow:auto;text-align:left">' + (t.length ? t.slice(0, 40).map(x => '<div class="note" style="display:flex;align-items:center;gap:8px;margin:0"><span style="flex:1;font-weight:700">' + (x.kind === 'dm' ? '@ ' : '') + esc(String(x.title || x.id).slice(0, 30)) + '</span><button class="tbtn" data-act="gvsend" data-v="' + esc(x.id) + '">Send</button></div>').join('') : '<div class="note">Grapevine is still connecting, or you are not in any chats yet.</div>') + '</div>';
  }
  return h + '</div>';
}
function hgiSend(id) {
  let ok = false; try { ok = !!HGHUB.HG_sendInvite(id, { game: 'frontline', code: NET.code }); } catch (e) { }
  HGI.msg = ok ? 'Invite sent!' : 'Invite failed - try again.'; if (ok) HGI.open = false; refreshLobby();
}
ACT.gvinvite = () => { HGI.open = !HGI.open; HGI.msg = ''; refreshLobby(); };
ACT.gvsend = (t) => hgiSend(t.dataset.v);
function hgJoin(raw) {
  const c = String(raw || '').replace(/\D/g, ''); if (c.length !== 6) return false;
  if (W && !W.o.demo && !W.over) { toast('Finish or leave this battle first, then join from Play a Friend Online.'); return false; }
  netReset(); showScreen('mp'); netJoin(c); return true;
}
window.__hgJoin = hgJoin;
window.__hgHost = convId => hgHost(convId);
function hgHost(convId) {
  ACT.mphost();
  const t0 = Date.now(), iv = setInterval(() => {
    if (NET.role !== 'host' || Date.now() - t0 > 25000) { clearInterval(iv); return; }
    if (NET.codeState === 'ready' && NET.code) { clearInterval(iv); hgiSend(convId); }
  }, 300);
}
setTimeout(() => {
  try {
    if (!HGHUB) return;
    const c = HGHUB.HG_takeJoin && HGHUB.HG_takeJoin('frontline'); if (c) { hgJoin(c); return; }
    const h = HGHUB.HG_takeHost && HGHUB.HG_takeHost('frontline'); if (h) hgHost(h.convId);
  } catch (e) { }
}, 1200);
ACT.mpjoin = () => { const i = $('#joincode'); netJoin(i ? i.value : NET.joinCode); };
ACT.gvfriend = el => { const L = GVL.L, who = el.dataset.n; if (!L || !who) return; el.disabled = true; L.addFriend(who).then(() => { toast('Friend request sent to ' + who); if (SCREEN === 'mplobby') refreshLobby(); }, e => { el.disabled = false; toast(e.message || 'Could not send that request'); }); };
ACT.mpready = () => { NET.myReady = !NET.myReady; sendRel({ t: 'ready', v: NET.myReady ? 1 : 0 }); refreshLobby(); };
ACT.gfac = el => { NET.myFac = +el.dataset.v === 1 ? 1 : 0; SET.fac = NET.myFac; saveSet(); sendRel({ t: 'fac', v: NET.myFac }); refreshLobby(); };   // 3.0: guest picks an army
ACT.hostfac = el => { SK.fac = +el.value === 1 ? 1 : 0; SET.fac = SK.fac; saveSet(); refreshLobby(); };
ACT.mpstart = () => hostStartMatch();
ACT.copycode = () => { try { navigator.clipboard.writeText(NET.code).then(() => toast('Code copied'), () => toast('Select and copy the code manually')); } catch (e) { toast('Select and copy the code manually'); } };
ACT.mpleave = () => { netLeave(); showScreen('main'); };

// ---------- host: snapshots ----------
function buildSnapshot() {
  const us = W.units, n = us.length, buf = new ArrayBuffer(11 + n * 12), dv = new DataView(buf); dv.setUint8(0, 1); dv.setUint32(1, W.tick); dv.setFloat32(5, W.t); dv.setUint16(9, n);
  let o = 11; for (let i = 0; i < n; i++) {
    const u = us[i]; dv.setUint16(o, u.id); dv.setUint8(o + 2, UTK.indexOf(u.type)); dv.setUint8(o + 3, u.owner); dv.setInt16(o + 4, Math.round(clamp(u.x, -300, 300) * 100)); dv.setInt16(o + 6, Math.round(clamp(u.z, -300, 300) * 100));
    dv.setUint8(o + 8, ((u.rot % TAU + TAU) % TAU) / TAU * 255 | 0); dv.setUint8(o + 9, ((u.aim % TAU + TAU) % TAU) / TAU * 255 | 0); dv.setUint8(o + 10, clamp(u.hp / u.maxHp, 0, 1) * 255 | 0);
    dv.setUint8(o + 11, u.vet | (u.moving ? 4 : 0) | (u.firing > 0 ? 8 : 0) | (u.slow > 0 ? 16 : 0) | (u.shield > 0 ? 32 : 0) | ((u.o === 0 ? 0 : 1) << 6) | (u.shp > 0 ? 128 : 0)); o += 12;   // bit 7 (3.0): energy shield up
  } return buf;
}
function buildMeta() {
  const pl = W.players.map(p => ({ s: Math.floor(p.sup), i: +p.inc.toFixed(2), p: p.pop, c: p.popCap, a: p.alive ? 1 : 0, t: Object.keys(p.techs), tn: p.techN || 0, r: p.res ? [p.res.id, +p.res.t.toFixed(1), p.res.dur] : 0, cd: Object.fromEntries(Object.entries(p.cd).filter(e => e[1] > 0).map(e => [e[0], +e[1].toFixed(1)])), st: p.stats, o: p.out || '' }));
  const pts = W.pts.map(p => [p.owner, +p.ctrl.toFixed(3), p.capP, p.contested ? 1 : 0, p.hq]);
  const bs = W.bld.map(b => [b.id, b.type, b.pt, b.slot, b.lvl, b.spec, Math.round(b.hp), Math.round(b.maxHp), +b.prog.toFixed(3), b.owner, +b.aim.toFixed(2), b.upg ? [b.upg.kind, +b.upg.t.toFixed(1), b.upg.dur] : 0, b.hasRally ? [b.rx, b.rz] : 0, b.ros || 0, b.sb, +b.x.toFixed(1), +b.z.toFixed(1), +b.rot.toFixed(2), b.tr ? [b.tr.u, +b.tr.t.toFixed(1), +b.tr.dur.toFixed(1), b.tr.re | 0] : 0, b.wait || 0, b.have || 0, b.hold ? 1 : 0, b.type === 'shieldgen' && b.sp !== undefined ? [Math.round(b.sp), b.sOn ? 1 : 0, b.sR] : 0]);
  return { t: 'meta', tick: W.tick, time: W.t, tix: W.teamList.map(t => [t.id, Math.round(t.tickets), t.alive ? 1 : 0]), pl, pts, bs, over: W.over ? 1 : 0 };
}
function netHostAfterTick() { if (!NET.peer || !W.o.mp) return; if (W.tick % 2 === 0) { sendBin(buildSnapshot()); NET.snapsTx++; } if (W.tick % 4 === 0 || NET.dirty) { NET.dirty = false; sendRel(buildMeta()); } }
function netFlush() { if (NET.role === 'host' && NET.peer && W && W.ev.length) { sendRel({ t: 'ev', e: W.ev }); } }
// ---------- guest: apply ----------
function netBinary(buf) {
  if (NET.role !== 'guest' || !W || !W.mirror) return; const dv = new DataView(buf); if (dv.getUint8(0) !== 1) return; NET.snapsRx++; NET.gotSnap = performance.now();
  const tick = dv.getUint32(1); if (tick <= (W.lastSnap || 0)) return; W.lastSnap = tick; const n = dv.getUint16(9); const now = performance.now(); const seenIds = new Set(); let o = 11;
  for (let i = 0; i < n; i++, o += 12) {
    const id = dv.getUint16(o), type = UTK[dv.getUint8(o + 2)], owner = dv.getUint8(o + 3); if (!UT[type] || !W.players[owner]) continue; seenIds.add(id);
    let u = W.byId.get(id);
    if (!u) { u = { id, k: 'u', type, T: UT[type], owner, team: W.players[owner].team, x: 0, z: 0, y: 0, rot: 0, aim: 0, hp: 1, maxHp: 1, vet: 0, o: 0, dead: false, buf: [], moving: false, flash: 0, shield: 0, slow: 0, firing: 0, tgt: null, rx: 0, rz: 0, ry: 0, rrot: 0, raim: 0, hpf: 1, vx: 0, vz: 0, cov: 0, life: 0, born: now, hpB: 1, dmB: 1, spB: 1 }; W.byId.set(id, u); W.units.push(u); }
    const x = dv.getInt16(o + 4) / 100, z = dv.getInt16(o + 6) / 100, fl = dv.getUint8(o + 11); const hpn = dv.getUint8(o + 10) / 255;
    if (hpn < u.hpf - .004) u.flash = .1;
    u.x = x; u.z = z; u.rot = dv.getUint8(o + 8) / 255 * TAU; u.aim = dv.getUint8(o + 9) / 255 * TAU; u.hpf = hpn; u.vet = fl & 3; u.moving = !!(fl & 4); u.firing = fl & 8 ? .2 : 0; u.slow = fl & 16 ? 1 : 0; u.shield = fl & 32 ? 1 : 0; u.o = fl & 64 ? 1 : 0; u.shUp = !!(fl & 128);
    u.maxHp = uMaxHp(u); u.hp = u.hpf * u.maxHp;
    u.buf.push({ t: now, x, z, rot: u.rot, aim: u.aim }); if (u.buf.length > 5) u.buf.shift(); u.y = u.T.naval ? W.M.wl : W.M.H(x, z) + (u.T.air ? u.T.alt : 0);
  }
  if (W.units.length !== seenIds.size) { for (let i = W.units.length - 1; i >= 0; i--) { const u = W.units[i]; if (!seenIds.has(u.id) && now - u.born > 400) { u.dead = true; W.byId.delete(u.id); W.units[i] = W.units[W.units.length - 1]; W.units.pop(); } } }
}
function applyMeta(m) {
  if (!W || !W.mirror) return; W.tick = m.tick; W.t = m.time;
  for (const t of m.tix) { const T = W.teams[t[0]]; if (T) { T.tickets = t[1]; T.alive = !!t[2]; } }
  m.pl.forEach((d, i) => { const p = W.players[i]; if (!p) return; p.sup = d.s; p.inc = d.i; p.pop = d.p; p.popCap = d.c; p.alive = !!d.a; p.out = d.o; const nt = {}; for (const k of d.t) nt[k] = 1; const chg = d.t.length !== Object.keys(p.techs).length; p.techs = nt; p.techN = d.tn || 0; p.res = d.r ? { id: d.r[0], t: d.r[1], dur: d.r[2] } : null; p.cd = d.cd; p.stats = d.st; if (chg) recalcMods(p); });
  m.pts.forEach((d, i) => { const p = W.pts[i]; p.owner = d[0]; p.ctrl = d[1]; p.capP = d[2]; p.contested = !!d[3]; p.hq = d[4]; });
  const seenB = new Set();
  for (const d of m.bs) {
    const id = d[0]; seenB.add(id); let b = W.byId.get(id);
    if (!b) { const T = BT[d[1]]; b = { id, k: 'b', type: d[1], T, owner: d[9], team: W.players[d[9]].team, pt: d[2], slot: d[3], x: d[15], z: d[16], y: W.M.H(d[15], d[16]), lvl: 1, spec: '', hp: 1, maxHp: 1, prog: 0, upg: null, ros: null, have: null, tr: null, wait: 0, hold: false, hasRally: false, rx: 0, rz: 0, aim: 0, flash: 0, fire: 0, dead: false, sz: T.sz, w: null, sb: 0, rot: d[17], born: performance.now() }; W.byId.set(id, b); W.bld.push(b); if (b.type === 'hq') W.players[b.owner].hqB = b; if (b.type === 'wall') { const pt = W.pts[b.pt]; pt.wall = b; } else if (b.slot >= 0) W.pts[b.pt].slots[b.slot].b = b; }
    if (b.hp > d[6] + 1) b.flash = .1; const T0 = BT[b.type];
    if (b.type === 'hq' && b.spec !== d[5]) { b.spec = d[5]; recalcMods(W.players[b.owner]); }
    b.lvl = d[4]; b.spec = d[5]; b.hp = d[6]; b.maxHp = d[7]; b.prog = d[8]; b.aim = d[10]; b.upg = d[11] ? { kind: d[11][0], t: d[11][1], dur: d[11][2] } : null; b.hasRally = !!d[12]; if (d[12]) { b.rx = d[12][0]; b.rz = d[12][1]; } b.ros = d[13] || (T0.ros ? {} : null); b.tr = d[18] && UT[d[18][0]] ? { u: d[18][0], t: d[18][1], dur: d[18][2], re: d[18][3] | 0, c: 0 } : null; b.wait = d[19] | 0; b.have = d[20] || (T0.ros ? {} : null); b.hold = !!d[21]; if (d[22]) { b.sp = d[22][0]; b.sOn = !!d[22][1]; b.sR = d[22][2]; } b.sb = d[14]; b.w = bWeapon(b);
  }
  for (let i = W.bld.length - 1; i >= 0; i--) { const b = W.bld[i]; if (!seenB.has(b.id) && performance.now() - b.born > 600) { b.dead = true; W.byId.delete(b.id); if (b.type === 'wall') { const pt = W.pts[b.pt]; if (pt.wall === b) pt.wall = null; } else if (b.slot >= 0) { const pt = W.pts[b.pt]; if (pt.slots[b.slot].b === b) pt.slots[b.slot].b = null; } W.bld[i] = W.bld[W.bld.length - 1]; W.bld.pop(); } }
  if (m.over && !W.over) { W.over = true; }
}
const RDELAY = 130;
function interpGuest(nowMs) {
  const rt = nowMs - RDELAY; const M = W.M;
  for (const u of W.units) {
    const b = u.buf; if (!b.length) continue; let a = b[0], c = b[b.length - 1];
    if (b.length === 1 || rt >= c.t) { const ex = Math.min(.12, Math.max(0, (rt - c.t) / 1000)); a = c; u.rx = c.x; u.rz = c.z; u.rrot = c.rot; u.raim = c.aim; if (b.length > 1 && u.moving && ex > 0) { const p = b[b.length - 2], dt = Math.max(1, c.t - p.t); u.rx += (c.x - p.x) / dt * ex * 1000 * .5; u.rz += (c.z - p.z) / dt * ex * 1000 * .5; } }
    else if (rt <= b[0].t) { u.rx = b[0].x; u.rz = b[0].z; u.rrot = b[0].rot; u.raim = b[0].aim; }
    else { let i = 1; while (i < b.length - 1 && b[i].t < rt) i++; const p0 = b[i - 1], p1 = b[i]; const f = clamp((rt - p0.t) / Math.max(1, p1.t - p0.t), 0, 1); u.rx = lerp(p0.x, p1.x, f); u.rz = lerp(p0.z, p1.z, f); u.rrot = p0.rot + angDiff(p0.rot, p1.rot) * f; u.raim = p0.aim + angDiff(p0.aim, p1.aim) * f; }
    u.ry = u.T.air ? M.H(u.rx, u.rz) + u.T.alt : u.T.naval ? M.wl : M.H(u.rx, u.rz); u.vx = 0; u.vz = 0; if (u.flash > 0) u.flash -= .016;
  }
  for (const b of W.bld) { if (b.flash > 0) b.flash -= .016; if (b.tr && !b.wait) b.tr.t = Math.min(b.tr.dur, b.tr.t + .016); }
}
// ---------- per frame ----------
function netTick(now) {
  if (!NET.peer) return; if (now - NET.pingT > 1000) { NET.pingT = now; sendRel({ t: 'ping', ts: now }); }
  const silent = now - NET.lastRx;
  if (inGame && W && W.o.mp && !W.over) {
    const bar = $('#netbar'); if (silent > 2500) { bar.classList.remove('hidden'); bar.textContent = 'Connection unstable... (' + Math.floor(silent / 1000) + 's)'; } else if (NET.rtt > 0) { bar.classList.toggle('hidden', NET.rtt < 400); bar.textContent = 'High latency: ' + Math.round(NET.rtt) + ' ms'; } else bar.classList.add('hidden');
    if (silent > 9000) { if (NET.role === 'guest') guestHostGone('No response from the host for 9 seconds. The match ended.'); else hostGuestGone(); }
  } else if (silent > 15000 && NET.role) { if (NET.role === 'guest') guestHostGone('Lost contact with the host.'); else hostGuestGone(); }
}
// =====================================================================
//  MAIN LOOP / GAME FLOW
// =====================================================================
const DEBUG = /[?&]debug/.test(location.search);
let autoCap = 2, LASTCFG = null, LASTOPT = null, MODE = 'boot', lastTs = 0, simAcc = 0, hudAcc = 0, mmAcc = 0, afAcc = 0, afN = 0, autoLvl = GPU.weak ? 0 : 1, autoStable = 0, fpsNow = 60, resultsShown = false, guestVisT = 0, demoT = 0, ticker = null;
window.__errs = [];
window.addEventListener('error', e => { window.__errs.push(String(e.message) + ' @' + (e.filename || '').slice(-20) + ':' + e.lineno); });
window.addEventListener('unhandledrejection', e => { window.__errs.push('rejection: ' + (e.reason && e.reason.stack || e.reason)); });
function keepEv() { const k = W.ev.filter(e => e[0] === 12); W.ev.length = 0; for (const e of k) W.ev.push(e); }
function showLoading(on, txt) { const l = $('#loading'); if (!l) return; l.style.display = on ? 'flex' : 'none'; if (txt) l.firstChild.textContent = txt; }
function startGame(cfg, opt) {
  opt = opt || {}; LASTCFG = cfg; LASTOPT = opt.mp ? null : opt; showLoading(true, 'Tip: ' + LORE.tips[(Math.random() * LORE.tips.length) | 0]); closeScreen();
  setTimeout(() => { try { launch(cfg, opt); } catch (err) { console.error(err); window.__errs.push('launch: ' + (err && err.stack || err)); inGame = false; const at = String(err && err.stack || '').split('\n').slice(1, 3).map(l => l.trim().replace(/^at /, '').replace(/\(?https?:[^)]*?:(\d+):\d+\)?/, 'line $1')).join(' < '); showScreen('notice', { title: 'Could not start', msg: String(err && err.message || err) + (at ? ' [' + at + ']' : '') + ' - please send a screenshot of this.' }); } showLoading(false); }, 40);
}
function launch(cfg, opt) {
  // 2.2: forget everything about the last battle BEFORE the new world exists (ids from the old world must never be looked up in the new one)
  try { clearSel(); } catch (e) { } selIds.clear(); selBld = 0; UI.selEnemy = null; UI.mode = null; UI.callId = null; UI.groups = {}; UI.sqInfo = {}; UI.sqPend = {}; UI.known = null; UI.deployLog = []; UI.bsq = {}; UI.page = 0; UI.pageKey = ''; UI.supOpen = false; UI.specOpen = false; UI.more = false; UI.hudDown = false; try { closeTech(); } catch (e) { }
  cleanupGameUI(); const c = Object.assign({}, cfg, { mp: !!opt.mp, mirror: !!opt.mirror, debug: DEBUG }); if (opt.mp || c.tutorial) c.events = false;
  if (c.tutorial) c.bigStart = false; if (!c.mirror && !c.war) c.maxPop = Math.min(c.maxPop || 120, Math.max(60, SET.maxUnits)); createWorld(c); ME = opt.me || 0; W.o.mp = !!opt.mp;
  buildWorldVisuals(); inGame = true; resultsShown = false; MODE = 'game'; $('#hud').classList.remove('hidden');
  hudInit(); UI.tixWarn = 0; UI.known = null; UI.deployLog = []; clearSel(); UI.groups = {}; UI.sqInfo = {}; UI.sqPend = {}; UI.did = {}; UI.mode = null; hudScale(); UI.camMoved = 0; UI.lastAlert = null; UI.tutorialTick = null; UI.tutFrame = null; TUT = null; $('#tut').classList.add('hidden'); $('#tut').innerHTML = ''; $('#netbar').classList.add('hidden');
  if (UI.touch) showTouchBtns(true); simAcc = 0; applyGfx(); try { mmBuild(); } catch (e) { } hudUpdate(true); closeScreen(); startTicker();
  if (c.mirror) { W.lastSnap = 0; }
  if (c.war) warRestoreSquads();
  if (c.camp && c.obj) { const mk = CAMP && CAMP.cur && CAMP.cur.final ? 'final' : c.obj.type, br = LORE.missions[mk] ? LORE.missions[mk].brief : null; if (br) setTimeout(() => { if (inGame) addAlert('HQ: ' + br[(Math.random() * br.length) | 0], '#ffe2a6', undefined, undefined, 16000); }, 1500); }
  if (!c.tutorial && (W.o.tod === 'night' || (WXD[W.o.weather] && W.o.weather !== 'clear'))) setTimeout(() => { if (inGame && W) addAlert([W.o.tod === 'night' ? TODD.night.d : '', WXD[W.o.weather] ? WXD[W.o.weather].d : ''].filter(Boolean).join(' '), '#bcd8ff', undefined, undefined, 15000); }, 1200);   // 3.0 battle conditions
  if (opt.after) opt.after();
}
function cleanupGameUI() { closeWarMap(); UI.bsq = {}; for (const m of SHDOME.values()) { if (worldGroup) worldGroup.remove(m); m.material.dispose(); } SHDOME.clear(); for (const id of ['#sbx', '#specp', '#qchat']) { const e = $(id); if (e) e.remove(); } $('#sup').classList.add('hidden'); closeTech(); const ci = $('#chatin'); if (ci) ci.remove(); UI.chatOpen = false; hideTgtRing(); hideBox(); }
function endGame(keepNet) {
  cleanupGameUI(); inGame = false; $('#hud').classList.add('hidden'); $('#hud').classList.remove('tuton'); $('#tut').classList.add('hidden'); $('#tut').innerHTML = ''; UI.tutorialTick = null; UI.tutFrame = null; TUT = null;
  if (!keepNet && NET.role) netLeave();
  setTimeout(startDemo, 30);
}
function startDemo() {
  if (inGame) return; try {
    const mp = MAPS[(Math.random() * MAPS.length) | 0]; const pers = Object.keys(AIP); const a = pers[(Math.random() * pers.length) | 0]; let b = pers[(Math.random() * pers.length) | 0];
    const wc = Math.random() < .55 ? pickWx(mp, 'map', 'map') : pickWx(mp, 'random', 'random');   // 3.0: the menu battle shows off the weather too
    const cfg = { tod: wc.tod, weather: wc.weather, map: mp.id, players: [{ name: 'A', kind: 'ai', team: 0, color: PCOL[0].c, fac: AIP[a].fac | 0, ai: { pers: a, diff: 'normal' } }, { name: 'B', kind: 'ai', team: 1, color: PCOL[1].c, fac: AIP[b].fac | 0, ai: { pers: b, diff: 'normal' } }], tickets: 250, supplies: 900, fog: false, speed: 1.4, maxPop: 70, demo: true, bigStart: true };
    createWorld(cfg); ME = 0; W.o.mp = false; buildWorldVisuals(); MODE = 'demo'; demoT = 0; $('#hud').classList.add('hidden'); for (const l of document.querySelectorAll('body > div[style*="position:fixed"]')) { }
    for (const o of ptObjs) o.label.style.display = 'none';
  } catch (e) { console.error(e); }
}
function startTicker() {
  if (ticker) return;
  const tk = () => { if (document.hidden && MODE === 'game' && W && W.o.mp) step(performance.now(), true); };
  try { ticker = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 33);'], { type: 'text/javascript' }))); ticker.onmessage = tk; } catch (e) { ticker = setInterval(tk, 33); }
}
function applyLevel(name) { const g = GFX[name]; if (!g) return; SET.shadows = g.shadows; SET.shadowRes = g.shadowRes; SET.particles = g.particles; SET.scale = g.scale; SET.decor = g.decor; SET.pr = g.pr; applyGfx(); }
function autoAdjust(fps) {
  const L = ['low', 'medium', 'high'], top = Math.min(GPU.weak ? 1 : 2, autoCap);
  if (fps < 30 && autoLvl > 0) { autoLvl--; autoCap = autoLvl; autoStable = 0; applyLevel(L[autoLvl]); }
  else if (fps < 21 && autoLvl === 0 && SET.scale > 55) { SET.scale -= 10; resize(); }
  else if (fps > 56 && autoLvl < top) { if (++autoStable >= 3) { autoLvl++; autoStable = 0; applyLevel(L[autoLvl]); } } else autoStable = 0;
}
function uiGameOver(e) {
  if (!inGame || resultsShown) return; const win = e[1] === MYTEAM; if (W.o.sandbox) return;
  setTimeout(() => showResults(win, e[2]), 2300);
}
function showResults(win, reason) {
  if (resultsShown || !inGame) return; resultsShown = true; const me = P(ME);
  const rows = W.players.map(p => ({ name: p.name, color: p.color, kills: p.stats.kills, lost: p.stats.lost, built: p.stats.built, captured: p.stats.captured }));
  let xp = 0, newAch = [], rankUp = '', genUp = 0;
  if (!W.o.tutorial && !W.o.sandbox && !W.o.demo) {
    const dmul = Math.max(0.6, ...W.players.filter(p => p.ai).map(p => ({ easy: .6, normal: 1, hard: 1.3, brutal: 1.6 }[p.ai.diff] || 1)).concat([.6]));
    xp = Math.round(((win ? 70 : 25) + W.t / 60 * 3 + me.stats.kills * .5 + me.stats.captured * 4) * (W.o.mp ? 1.25 : dmul)); const gx = grantXp(xp); rankUp = gx.rankUp; genUp = gx.genUp;
    PROF.games++; win ? PROF.wins++ : PROF.losses++; PROF.kills += me.stats.kills; PROF.lost += me.stats.lost; PROF.built += me.stats.built; PROF.captured += me.stats.captured; PROF.time += Math.round(W.t); if (win && (!PROF.best || W.t < PROF.best)) PROF.best = Math.round(W.t); if (W.o.mp) { PROF.mp++; if (win) PROF.mpWins++; }
    const aiD = W.players.filter(p => p.ai).map(p => p.ai.diff); const give = k => { if (!PROF.ach[k]) { PROF.ach[k] = 1; newAch.push(ACH[k][0]); } };
    if (win) { give('win'); if (aiD.includes('hard') || aiD.includes('brutal')) give('hard'); if (aiD.includes('brutal')) give('brutal'); if (W.o.mp) give('online'); if (/HQ/.test(reason || '')) give('hq'); if (W.t < 480) give('rush'); if (me.fac === 1) give('legion'); if (W.o.tod === 'night') give('night'); if (WXD[W.o.weather] && W.o.weather !== 'clear') give('storm'); }
    if ((me.stats.ships || 0) >= 5) give('navy'); if (me.stats.isle) give('island'); if (genSpent(PROF.gen) >= 15) give('gen');
    if ((me.stats.aces || 0) >= 1) give('ace'); if ((me.stats.crates || 0) >= 3) give('crate'); if (me.stats.specs >= 3) give('spec3'); if (me.stats.air >= 10) give('air10'); if (me.stats.calls >= 5) give('calls5'); if (me.stats.hero >= 1) give('hero'); if (me.stats.peakPts >= W.pts.length) give('grab'); if (Object.keys(me.techs).length >= techList(me.fac).length) give('tech');
    saveProf();
  }
  if (!win && me.out === 'Surrendered') reason = 'You surrendered'; else if (!win && /score ran out/.test(W.reason || reason || '')) reason = 'Your score ran out'; else if (!win && (W.reason || reason) === 'Enemy HQ destroyed') reason = 'Your HQ was destroyed';
  const camp = W.o.camp ? campAfter(win) : null; if (camp && camp.ach) newAch.push(camp.ach);
  sfx(win ? 'win' : 'lose'); showScreen('results', { win, reason: reason || me.out || '', time: W.t, rows, xp, newAch, rankUp, genUp, mp: !!W.o.mp, sandbox: !!W.o.sandbox, camp });
}

// ---------------- frame ----------------
function frame(ts) { requestAnimationFrame(frame); step(ts, false); }
let stepErrs = 0;
function step(ts, hidden) { try { stepInner(ts, hidden); } catch (e) { if (stepErrs++ < 20) { console.error(e); window.__errs.push('step: ' + (e && e.stack || e)); } if (stepErrs === 3) toast('Something went wrong - the game may behave oddly'); } }
function stepInner(ts, hidden) {
  const dt = Math.min(.1, Math.max(0, (ts - lastTs) / 1000)); lastTs = ts; if (!W) return; sfxBudget = 0;
  if (MODE !== 'game' && MODE !== 'demo') return;
  if (NET.role) netTick(ts); if (!hidden) musicTick(dt);
  if (!W.mirror) {
    if (!W.paused && (!W.over || W.o.sandbox) && !(MODE === 'demo' && W.over)) {
      simAcc += dt * W.speed; let n = 0; const s0 = performance.now(); while (simAcc >= TICK && n < 6) { simTick(); simAcc -= TICK; n++; if (NET.role === 'host') netHostAfterTick(); if (performance.now() - s0 > 45) break; } if (n >= 6 || simAcc > TICK * 2) simAcc = Math.min(simAcc, TICK);   // 4.3: a slow computer falls a little behind instead of freezing
    }
    interpHost(W.paused ? 1 : simAcc / TICK);
    if (MODE === 'demo' && W.over) { demoT += dt; if (demoT > 5) startDemo(); }
  } else {
    interpGuest(ts); if (ts - guestVisT > 200) { guestVisT = ts; updateVision(); } for (let i = W.reveals.length - 1; i >= 0; i--) { W.reveals[i].t -= dt; if (W.reveals[i].t <= 0) W.reveals.splice(i, 1); }
    if (NET.gotSnap && ts - NET.gotSnap > 100000) { }
  }
  if (W.ev.length) {
    for (const e of W.ev) { if (!hidden || e[0] === 3 || e[0] === 7 || e[0] === 11 || e[0] === 12) { try { fxEvent(e); } catch (er) { window.__errs.push('fx ' + er.message); } } }
    if (NET.role === 'host') netFlush(); W.ev.length = 0;
  }
  if (MODE === 'game') {
    updInput(dt); hudAcc += dt; if (hudAcc > .1) { hudAcc = 0; hudUpdate(); if (!W.o.sandbox && !resultsShown && !P(ME).alive && !W.over && !W.mirror) showResults(false, P(ME).out || 'Eliminated'); else if (!resultsShown && W.mirror && !P(ME).alive && P(ME).out && !W.over) showResults(false, P(ME).out); }
    mmAcc += dt; if (mmAcc > .12) { mmAcc = 0; mmDraw(); }
  } else if (MODE === 'demo') {
    demoT += dt; let cx = 0, cz = 0, n = 0; for (const u of W.units) { cx += u.x; cz += u.z; n++; } if (n) { cx /= n; cz /= n; } cam.tx = cx; cam.tz = cz; cam.tyaw += dt * .02; cam.tdist = 100;
  }
  if (!hidden) {
    renderFrame(dt, ts); updBadges(); if (UI.tutFrame) UI.tutFrame();
    afAcc += dt; afN++; if (afAcc >= 4) { fpsNow = afN / afAcc; afAcc = 0; afN = 0; if (SET.gfx === 'auto' && !W.paused) autoAdjust(fpsNow); }
    if (SET.fps) { const f = $('#fps'); f.textContent = Math.round(fpsNow) + ' fps | ' + W.units.length + ' units'; }
  }
}
function warSafeSave() { try { if (inGame && W && W.o.war && W.war && W.war.phase === 'prep' && !W.over) warSave(); } catch (e) { } }
document.addEventListener('visibilitychange', () => { if (document.hidden) warSafeSave(); if (document.hidden && inGame && W && !W.o.mp && !W.paused && !W.over && !SCREEN) openPause(); });
window.addEventListener('pagehide', () => { warSafeSave(); try { if (NET.role && NET.peer) sendRel({ t: 'bye' }); } catch (e) { } });
window.addEventListener('resize', () => { if (inGame && W) { try { mmBuild(); } catch (e) { } } });
// ---------------- debug hook ----------------
if (DEBUG) {
  window.__fl = {
    get renderer() { return renderer; }, get scene() { return scene; }, get W() { return W; }, get ME() { return ME; }, UI, NET, cam, SET, PROF, UT, BT, TECH, CALL, MAPS, AIP, AID, WTM, GPU, selectBuilding, selectPoint, pickEntity, onClickWorld, prof(n) { const t0 = performance.now(); for (let i = 0; i < n; i++) { simTick(); } const t1 = performance.now(); for (let i = 0; i < n; i++) { interpHost(.5); renderFrame(.016, performance.now()); } const t2 = performance.now(); renderer.getContext().finish(); const t3 = performance.now(); const inf = renderer.info; return { simMs: (t1 - t0) / n, renderCpuMs: (t2 - t1) / n, finishMs: (t3 - t2) / n, calls: inf.render.calls, tris: inf.render.triangles, geos: inf.memory.geometries, tex: inf.memory.textures, units: W.units.length, pr: renderer.getPixelRatio() }; }, __camPos() { const c = camera.position; return { x: c.x, y: c.y, z: c.z, fy: cam.gy }; }, get TUT() { return TUT; }, tutAdvance, tutExit, startTutorial, camGoto, setMode, selAllArmy, selIdle, goHome, renderPanel, coachHint, cleanupGameUI, openPause, ACT, applySimple, defaultSK, get SK() { return SK; }, set SK(v) { SK = v; },  get inGame() { return inGame; }, get mode() { return MODE; }, get fps() { return fpsNow; },
    makeAI, getField, killBuilding, squadAdd, squadIds, renderFrame: (dt, t) => renderFrame(dt, t), interpHost: a => interpHost(a), refreshB, selectPad, warNew, warCfg, warSave, warSpawn, warDef, get WAR() { return WAR; }, set WAR(v) { WAR = v; }, rosCap, rosTotal, campNew, campCfg, campAfter, campChoices, get CAMP() { return CAMP; }, DOCS, MISSIONS, fevSpawn, fevTick, CALLORDER, BUILDABLE, TBR, canTrainAt, unitCost, bestLvl, playerHQLvl, pickWall, UTK, startGame, startTutorial, startSandbox, applyCmd, issue, selectUnits, clearSel, hudUpdate, fxEvent, showScreen, openTech, makeIcons, ICONS, genMap, createWorld, simTick, spawnUnit, placeBuilding, unitsForB, callAvail, killUnit, eliminate, w2s, screenToGround,
    step(n) { for (let i = 0; i < n; i++) simTick(); }, fast(sec, nofx) { const fx = W.fx; W.fx = false; const n = Math.round(sec / TICK); for (let i = 0; i < n && !(W.over && !W.o.sandbox); i++) { simTick(); if (NET.role === 'host') netHostAfterTick(); if (i % 40 === 0) keepEv(); } keepEv(); W.fx = fx; interpHost(1); hudUpdate(true); return W.tick; },
    spawn(type, owner, x, z, vet) { const u = spawnUnit(type, owner, x, z, { vet: vet || 0 }); return u.id; },
    build(owner, ptId, slot, type, instant) { const p = P(owner), pt = W.pts[ptId]; const b = placeBuilding(type, owner, pt, slot, !!instant); return b; },
    state() { return { tick: W.tick, t: W.t, over: W.over, winner: W.winner, reason: W.reason, units: W.units.length, bld: W.bld.length, tix: W.teamList.map(t => Math.round(t.tickets)), pts: W.pts.map(p => p.owner), sup: W.players.map(p => Math.round(p.sup)), pop: W.players.map(p => p.pop) }; },
    navAscii(x0, z0, x1, z1, tx, tz) { const M = W.M, n = M.nav; FIELD_BUDGET = Math.max(FIELD_BUDGET, 1); FIELD_BANK = Math.max(FIELD_BANK, 1); const f = getField(M, tx, tz); let out = ''; const arrows = ['>', '\\', 'v', '/', '<', '\\', '^', '/']; for (let z = z1; z >= z0; z -= 2) { let row = ''; for (let x = x0; x <= x1; x += 2) { const i = n.idx(x, z); let c = (n.blk[i] | n.dyn[i]) ? '#' : (f.dir[i] >= 0 ? arrows[f.dir[i]] : '?'); for (const u of W.units) if (u.owner === ME && Math.abs(u.x - x) < 1 && Math.abs(u.z - z) < 1) c = 'U'; row += c; } out += row + '\n'; } return out; },
    snapshot() { return { fps: fpsNow, mode: MODE, errs: window.__errs.slice() }; }, setME(i) { ME = i; MYTEAM = P(ME).team; },
    setWeather, wxOf, pickWx, WXD, TODD, get scene3() { return scene; }, updateVision, seen,
    FACS, LEG_OF, fu, techList, techPrev, cmdTech, techLeft, btx, callText, bIcon, bFac, MDL, hurt, recalcMods, refreshUnit, uRange, get CODEXFAC() { return CODEXFAC; }, aiFac, warSpawnNow() { if (W && W.war) { W.war.go = true; warTick(); } }, warDrop, warTick, lgBModel, bModel, get NETV() { return NETV; }, buildSnapshot, netBinary, buildMeta, applyMeta,
    // offline online-match tests: a page becomes a lobby host without the matchmaking service, and a test link (any object shaped like a peer) joins it
    netFakeHost() { netReset(); NET.role = 'host'; NET.codeState = 'ready'; NET.code = '123456'; SK = SK || defaultSK(); SK.speed = 1; SK.slots[1] = Object.assign(SK.slots[1], { kind: 'remote', team: 1 }); showScreen('mplobby'); },
    netAttach(role, peer) { if (role === 'host') { hostCandidate(peer); return; } netReset(); NET.role = 'guest'; NET.peer = peer; NET.via = 'direct'; wirePeer(peer, () => guestHostGone()); NET.joinState = 'connected'; NET.myFac = SET.fac | 0; sendRel({ t: 'hello', name: SET.name, ver: VERSION, nv: NETV, fac: NET.myFac }); if (GVL.on()) { NET.hostGvn = GVL.L.newChallenge(); sendRel({ t: 'gvq', n: NET.hostGvn }); } showScreen('mplobby'); }
  };
}
// ---------------- boot ----------------
function boot() {
  try {
    initRenderer(); setupInput(); bindMenus(); if (SET.gfx === 'auto') applyLevel(['low', 'medium', 'high'][autoLvl]);
    makeIcons(); applyGfx(); setTimeout(() => { startDemo(); showScreen(!PROF.seenIntro && !PROF.tutDone ? 'welcome' : 'main'); if (!PROF.seenIntro) { PROF.seenIntro = 1; saveProf(); } showLoading(false); lastTs = performance.now(); requestAnimationFrame(frame); startTicker(); }, 30);
  } catch (e) { console.error(e); window.__errs.push('boot: ' + (e && e.stack || e)); showLoading(true, 'Failed to start: ' + (e && e.message)); }
}
boot();
