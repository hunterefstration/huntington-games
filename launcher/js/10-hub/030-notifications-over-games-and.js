// ---- Notifications over games, and chat on T --------------------------------------------------------------------
// The full Grapevine app runs in the (hidden) Grapevine tab frame. While a game is open the launcher starts it in the
// background and: shows its notifications as small pop-ups over the game (HG_notify), and opens a small chat window on T
// (attachChat), both in the launcher's own page and in an about:blank "New tab" copy of the game.
var HGX_CSS = '.hgx{--panel:#16161a;--raise:#1f1f25;--line2:#34343c;--text:#e9e9ee;--dim:#9a9aa6;--signal:#7c5cff;--signal2:#a78bfa;--on-signal:#fff;--mono:ui-monospace,Menlo,Consolas,monospace;font-family:system-ui,"Segoe UI",sans-serif;color:var(--text);box-sizing:border-box}.hgx *{box-sizing:border-box}'
  + '.hgt-host{position:fixed;top:12px;right:12px;z-index:2147483000;display:flex;flex-direction:column;gap:8px;width:min(340px,calc(100vw - 24px));pointer-events:none}'
  + '.hgt{pointer-events:auto;background:var(--panel);border:1px solid var(--line2);border-left:3px solid var(--signal);border-radius:4px;padding:10px 12px;box-shadow:0 10px 30px rgba(0,0,0,.45);cursor:pointer;animation:hgtin .18s ease-out}'
  + '.hgt .tk{font:600 9.5px var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--signal)}.hgt .tt{font-weight:600;font-size:14px;margin:2px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
  + '.hgt .tx{font-size:12.5px;color:var(--dim);line-height:1.45;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.hgt .tb{display:flex;gap:8px;margin-top:8px}'
  + '.hgt .tb button,.hgc button{background:var(--raise);border:1px solid var(--line2);color:var(--text);border-radius:3px;padding:4px 10px;font:11px var(--mono);letter-spacing:.08em;text-transform:uppercase;cursor:pointer}'
  + '.hgt .tb button.go,.hgc button.go{background:linear-gradient(100deg,var(--signal),var(--signal2));color:var(--on-signal);border:0;font-weight:600}@keyframes hgtin{from{transform:translateY(-8px);opacity:0}to{transform:none;opacity:1}}'
  + '.hgc{position:fixed;left:12px;bottom:12px;z-index:2147483001;width:min(360px,calc(100vw - 24px));height:min(330px,calc(100vh - 24px));display:flex;flex-direction:column;background:var(--panel);border:1px solid var(--line2);border-radius:5px;box-shadow:0 14px 40px rgba(0,0,0,.55)}'
  + '.hgc .hd{display:flex;gap:6px;align-items:center;padding:7px 8px;border-bottom:1px solid var(--line2)}.hgc select{flex:1;min-width:0;background:var(--raise);color:var(--text);border:1px solid var(--line2);border-radius:3px;padding:5px;font:13px system-ui}'
  + '.hgc .ls{flex:1;overflow-y:auto;padding:8px 10px;font-size:13px;line-height:1.4;word-break:break-word}.hgc .ls div{margin:0 0 5px}.hgc .ls b{color:var(--signal2)}.hgc .ls .me b{color:var(--dim)}.hgc .ls .none{color:var(--dim);text-align:center;margin-top:30px}'
  + '.hgc .ft{display:flex;gap:6px;padding:7px 8px;border-top:1px solid var(--line2)}.hgc input{flex:1;min-width:0;background:var(--raise);color:var(--text);border:1px solid var(--line2);border-radius:3px;padding:7px 8px;font:14px system-ui;outline:0}.hgc input:focus{border-color:var(--signal)}'
  + '.hgc .tip{padding:0 10px 6px;color:var(--dim);font:10.5px var(--mono)}';
function hgEl(doc, tag, cls, text) { var e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function hgSkin(doc, e) {
  e.className += ' hgx';
  if (!doc.getElementById('hgx-css')) { var st = hgEl(doc, 'style'); st.id = 'hgx-css'; st.textContent = HGX_CSS; (doc.head || doc.documentElement).appendChild(st); }
  var cs = getComputedStyle(document.documentElement);
  ['--panel', '--raise', '--line2', '--text', '--dim', '--signal', '--signal2', '--on-signal'].forEach(function (v) { var x = cs.getPropertyValue(v).trim(); if (x) e.style.setProperty(v, x); });
  return e;
}
function hgDocs() { var a = [document]; if (popup && !popup.closed) { try { if (popup.document && popup.document.body) a.push(popup.document); } catch (e) {} } return a; }
function chatApi() { try { var w = document.getElementById('gvapp').contentWindow; return w && w.GVEmbed && w.GVEmbed.ready() ? w.GVEmbed : null; } catch (e) { return null; } }
function gvStartApp() { var L = window.HGGrapevine; if (L && L.me() && chatLoaded !== true) loadGV().then(startChat, function () {}); }
window.HG_chatHidden = function () { return document.body.className !== 'chat' || !!current; };

function toastHost(doc) {
  var h = doc.getElementById('hgt-host');
  if (!h) { h = hgSkin(doc, hgEl(doc, 'div', 'hgt-host')); h.id = 'hgt-host'; doc.body.appendChild(h); }
  if (doc === document) { var want = document.fullscreenElement || document.body; if (h.parentNode !== want) want.appendChild(h); }
  return h;
}
function toastIn(doc, n) {
  if (doc.__hgchatOpen && doc.__hgchatConv === n.convId && n.convId) return;
  var host = toastHost(doc), key = [n.kind, n.from, n.convId].join('|'), old = host.querySelector('[data-k="' + key.replace(/"/g, '') + '"]');
  if (old) old.remove();
  var t = hgEl(doc, 'div', 'hgt'), tm;
  t.setAttribute('data-k', key.replace(/"/g, ''));
  var label = { dm: 'Message', mention: 'Mention', msg: 'Grapevine', friendreq: 'Friend request', friendok: 'Friends', invite: 'Game invite', ach: 'Achievement unlocked' }[n.kind] || 'Grapevine';
  t.appendChild(hgEl(doc, 'div', 'tk', label));
  t.appendChild(hgEl(doc, 'div', 'tt', n.kind === 'dm' || n.kind === 'mention' ? (n.from || n.title) : (n.title || '')));
  var tx = n.kind === 'msg' || n.kind === 'mention' || n.kind === 'dm' ? ((n.kind !== 'dm' && n.title ? n.title + ' - ' : '') + (n.from && n.kind === 'msg' ? n.from + ': ' : '') + (n.text || '')) : (n.text || '');
  t.appendChild(hgEl(doc, 'div', 'tx', tx));
  function gone() { clearTimeout(tm); t.remove(); }
  if (n.kind === 'friendreq') {
    var b = hgEl(doc, 'div', 'tb'), ok = hgEl(doc, 'button', 'go', 'Accept'), no = hgEl(doc, 'button', '', 'Decline');
    ok.onclick = function (e) { e.stopPropagation(); var L = window.HGGrapevine; if (L) L.acceptFriend(n.from); gone(); };
    no.onclick = function (e) { e.stopPropagation(); var L = window.HGGrapevine; if (L) L.declineFriend(n.from); gone(); };
    b.appendChild(ok); b.appendChild(no); t.appendChild(b);
  }
  if (n.kind === 'invite') {
    var ib = hgEl(doc, 'div', 'tb'), join = hgEl(doc, 'button', 'go', 'Join'), skip = hgEl(doc, 'button', '', 'Ignore');
    join.onclick = function (e) { e.stopPropagation(); gone(); joinInvite(n.game, n.code); };
    skip.onclick = function (e) { e.stopPropagation(); gone(); };
    ib.appendChild(join); ib.appendChild(skip); t.appendChild(ib);
  }
  t.onclick = function () {
    gone();
    if (n.kind === 'invite') { joinInvite(n.game, n.code); return; }
    if (n.kind === 'friendreq' || n.kind === 'friendok') { if (!current && doc === document) HG_openGrapevine('friends'); return; }
    if (doc !== document || current) { var tg = doc === document ? frame.contentDocument : doc; if (tg) openChatBox(tg, n.convId); }
    else { showTab('chat'); try { document.getElementById('gvapp').contentWindow.GV.openConv(n.convId); } catch (e) {} }
  };
  host.appendChild(t);
  while (host.children.length > 4) host.firstChild.remove();
  tm = setTimeout(gone, n.kind === 'friendreq' || n.kind === 'invite' ? 20000 : 7000);
}
window.HG_notify = function (n) {
  var inv = n.text && (n.kind === 'dm' || n.kind === 'msg' || n.kind === 'mention') && INVITE_RE.exec(n.text), g = inv && inviteGame(inv[1]);
  if (g) n = { kind: 'invite', from: n.from, convId: n.convId, title: (n.from || 'A friend') + ' invited you', text: g.name.replace(/ [\d.]+$/, '') + ' - press to join', game: inv[1], code: inv[2] };
  hgDocs().forEach(function (d) { try { toastIn(d, n); } catch (e) {} });
};

// ---- Game invites through Grapevine chats -----------------------------------------------------------------------
// A game asks for the chats it can invite into (HG_inviteTargets) and sends an invite (HG_sendInvite): a normal chat
// message ending in "hg-invite:<game>:<party code>", so it reads fine in the Grapevine app too. When one arrives the
// pop-up shows a JOIN button: it opens the game (or tells the open one) and the game collects the code with HG_takeJoin.
var INVITE_GAMES = { blocky: 'Blocky Shooter V2', frontline: 'Frontline', imposter: 'Imposter', lumi: 'Last Light', spikes: '50 Levels Of Spikes 1.2', sovereign: 'Sovereign', warpvp: 'Steel Storm' }, INVITE_RE = /hg-invite:([a-z]+):([A-Za-z0-9-]{4,40})/, pendingJoin = null, pendingHost = null;
function inviteGame(id) { var d = INVITE_GAMES[id]; return d ? GAMES.filter(function (g) { return g.dir === d; })[0] || null : null; }
window.HG_inviteTargets = function () {
  var api = chatApi(); if (!api) return [];
  return api.convs().map(function (c) { return { id: c.id, title: c.title, kind: c.kind }; })
    .sort(function (a, b) { return (a.kind === 'dm' ? 0 : 1) - (b.kind === 'dm' ? 0 : 1); });
};
window.HG_sendInvite = function (convId, o) {
  var api = chatApi(), g = o && inviteGame(o.game), code = o && String(o.code || '');
  if (/^party:/.test(String(convId))) {        // Quick Match hosted it: list it as an open party
    if (!g || !/^[A-Za-z0-9-]{4,12}$/.test(code)) return false;
    return window.HG_partyOpen({ game: o.game, code: code, mode: o.mode, n: 1, max: o.max || 10 });
  }
  if (/^hub:/.test(String(convId))) {          // a game started from a hub room: tell the room
    if (!g || !/^[A-Za-z0-9-]{4,40}$/.test(code) || !MP.net || 'hub:' + MP.code !== convId) return false;
    MP.net.send('all', { t: 'play', game: o.game, code: code }); hubPlay(mpName(), o.game, code, true); return true;
  }
  if (!api || !g || !/^[A-Za-z0-9-]{4,40}$/.test(code)) return false;
  var what = g.name.replace(/ [\d.]+$/, '') + (o.mode ? ' (' + String(o.mode).replace(/[^\w -]/g, '').slice(0, 24) + ')' : '');
  return !!api.send(convId, 'Join my ' + what + ' game! Party code ' + code + ' - hg-invite:' + o.game + ':' + code);
};
window.HG_takeJoin = function (game) {
  var p = pendingJoin; if (!p || p.game !== game) return null;
  pendingJoin = null; return Date.now() - p.at < 5 * 60000 ? p.code : null;
};
// Grapevine's "Invite to a game" (its + menu): open the game, host a party there, and the game sends the code to that chat
window.HG_inviteGames = function () { return Object.keys(INVITE_GAMES).map(function (id) { var g = inviteGame(id); return g ? { id: id, name: g.name.replace(/ [\d.]+$/, '') } : null; }).filter(Boolean); };
window.HG_takeHost = function (game) {
  var p = pendingHost; if (!p || p.game !== game) return null;
  pendingHost = null; return Date.now() - p.at < 5 * 60000 ? { convId: p.convId } : null;
};
window.HG_hostInvite = function (game, convId) {
  var g = inviteGame(game); if (!g || !convId) return false;
  var wins = [];
  if (current && current.game === g) { try { wins.push(frame.contentWindow); } catch (e) {} }
  if (popup && !popup.closed && popupGame === g) wins.push(popup);
  for (var i = 0; i < wins.length; i++) { try { if (wins[i].__hgHost) { wins[i].__hgHost(convId); return true; } } catch (e) {} }
  pendingHost = { game: game, convId: convId, at: Date.now() };
  play(g, true); return true;
};
window.HG_joinInvite = function (game, code) { joinInvite(game, code); };
function joinInvite(game, code) {
  var g = inviteGame(game); if (!g) return;
  pendingJoin = { game: game, code: code, at: Date.now() };
  // the game is already open (here or in the New-tab copy): hand it the code now
  var wins = [];
  if (current && current.game === g) { try { wins.push(frame.contentWindow); } catch (e) {} }
  if (popup && !popup.closed && popupGame === g) wins.push(popup);
  for (var i = 0; i < wins.length; i++) { try { if (wins[i].__hgJoin) { pendingJoin = null; wins[i].__hgJoin(code); return; } } catch (e) {} }
  play(g, true);
}
document.addEventListener('fullscreenchange', function () { var h = document.getElementById('hgt-host'); if (h) toastHost(document); });

// The chat window. `gdoc` is the page the game is in (the launcher's game frame, or the New-tab copy). The window is a small frame of
// its own, so keys typed in it never reach the game (a game that listens to every key would otherwise react to what is being typed).
function openChatBox(gdoc, convId) {
  // a game in the launcher gets the chat dock beside it (070-chat-dock.js); this box is only for games in a new tab
  try { if (gdoc === frame.contentDocument && typeof dockOpen === 'function') { dockOpen(convId); return; } } catch (e) {}
  var fr = gdoc.getElementById('hgc-box');
  if (fr) { if (convId && fr.__pick) fr.__pick(convId); try { fr.contentWindow.focus(); fr.contentDocument.querySelector('input').focus(); } catch (e) {} return; }
  try { gdoc.exitPointerLock && gdoc.exitPointerLock(); } catch (e) {}
  fr = hgEl(gdoc, 'iframe'); fr.id = 'hgc-box';
  fr.style.cssText = 'position:fixed;left:12px;bottom:12px;width:min(360px,calc(100vw - 24px));height:min(330px,calc(100vh - 24px));border:0;z-index:2147483001;background:transparent';
  gdoc.body.appendChild(fr);
  var doc = fr.contentDocument; doc.open(); doc.write('<!DOCTYPE html><html><body style="margin:0;background:transparent"></body></html>'); doc.close();
  var box = hgSkin(doc, hgEl(doc, 'div', 'hgc')), hd = hgEl(doc, 'div', 'hd'), sel = hgEl(doc, 'select'), x = hgEl(doc, 'button', '', 'Close'),
      ls = hgEl(doc, 'div', 'ls'), ft = hgEl(doc, 'div', 'ft'), inp = hgEl(doc, 'input'), go = hgEl(doc, 'button', 'go', 'Send'), cur = convId || '';
  box.style.cssText += ';position:static;width:100%;height:100%;left:auto;bottom:auto';
  inp.placeholder = 'Say something'; inp.maxLength = 500; inp.setAttribute('autocomplete', 'off');
  hd.appendChild(sel); hd.appendChild(x); ft.appendChild(inp); ft.appendChild(go);
  box.appendChild(hd); box.appendChild(ls); box.appendChild(ft); box.appendChild(hgEl(doc, 'div', 'tip', 'Esc closes. Messages go to the same chats as the Grapevine tab.'));
  doc.body.appendChild(box);
  function close() { try { fr.remove(); } catch (e) {} gdoc.__hgchatOpen = false; try { gdoc.defaultView.focus(); } catch (e) {} }
  function paint() {
    var api = chatApi();
    if (!api) { ls.textContent = ''; ls.appendChild(hgEl(doc, 'div', 'none', 'Connecting to Grapevine...')); return; }
    var cs = api.convs();
    if (!sel.options.length || sel.__n !== cs.length) {
      sel.textContent = ''; sel.__n = cs.length;
      cs.forEach(function (c) { var o = hgEl(doc, 'option', '', (c.kind === 'dm' ? '@ ' : '') + c.title + (c.unread ? ' (' + c.unread + ')' : '')); o.value = c.id; sel.appendChild(o); });
      if (!cur || !cs.some(function (c) { return c.id === cur; })) cur = cs.length ? cs[0].id : '';
      sel.value = cur;
    }
    ls.textContent = '';
    var ms = cur ? api.msgs(cur, 40) : [];
    if (!ms.length) ls.appendChild(hgEl(doc, 'div', 'none', cur ? 'No messages yet.' : 'You are not in any chats yet.'));
    ms.forEach(function (m) {
      var d = hgEl(doc, 'div', m.mine ? 'me' : ''), inv = INVITE_RE.exec(m.text || ''), g = inv && inviteGame(inv[1]);
      d.appendChild(hgEl(doc, 'b', '', m.from + ': ')); d.appendChild(doc.createTextNode(inv ? (m.text || '').replace(INVITE_RE, '').replace(/\s*-\s*$/, '') : m.text));
      if (g && !m.mine) { var jb = hgEl(doc, 'button', 'go', 'Join'); jb.style.marginLeft = '6px'; jb.onclick = function () { joinInvite(inv[1], inv[2]); }; d.appendChild(jb); }
      ls.appendChild(d);
    });
    ls.scrollTop = ls.scrollHeight;
    gdoc.__hgchatConv = cur;
    if (cur) api.read(cur);
  }
  fr.__pick = function (id) { cur = id; sel.value = id; paint(); };
  function send() { var api = chatApi(); if (!api || !cur) return; if (api.send(cur, inp.value)) { inp.value = ''; setTimeout(paint, 50); } }
  sel.onchange = function () { cur = sel.value; paint(); inp.focus(); };
  x.onclick = close; go.onclick = send;
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); close(); } else if (e.key === 'Enter' && e.target === inp) { e.preventDefault(); send(); } });
  gdoc.__hgchatOpen = true;
  if (!chatApi()) gvStartApp();
  // live: refresh when a message arrives; while the app is still connecting, look again every second
  var iv = setInterval(function () { if (!fr.isConnected) { clearInterval(iv); return; } var api = chatApi(); if (!api) { paint(); return; } if (!fr.__live) { fr.__live = 1; api.on(function (c, m) { if (fr.isConnected && m.convId === cur) paint(); }); paint(); } }, 1000);
  paint(); try { fr.contentWindow.focus(); } catch (e) {} inp.focus();
}
// T opens the chat while a game is running. Games that need every key, and Frontline (which uses plain T for its tech tree), are handled by flags.
function attachChat(doc, g) {
  if (!doc || doc.__hgchat || !g || g.noChat) return;
  var L = window.HGGrapevine; if (!(L && L.me())) return;
  doc.__hgchat = 1;
  doc.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || String(e.key).toLowerCase() !== 't' || !!g.chatShift !== !!e.shiftKey) return;
    var t = e.target; if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
    e.preventDefault(); e.stopPropagation();
    openChatBox(doc, '');
  }, true);
}
frame.addEventListener('load', function () {
  try { if (current && current.html) attachChat(frame.contentDocument, current.game); else if (current && local) attachChat(frame.contentDocument, current.game); } catch (e) {}
});
document.getElementById('tab-games').onclick = function () { showTab('games'); };
document.getElementById('tab-chat').onclick = function () { showTab('chat'); };
document.getElementById('tab-acct').onclick = function () { showTab('acct'); };
document.getElementById('chip').onclick = function () { showTab('prof'); };
document.getElementById('tab-prof').onclick = function () { showTab('prof'); };
document.getElementById('tab-lb').onclick = function () { showTab('lb'); };
window.addEventListener('resize', function () { if (document.body.className === 'chat') document.getElementById('view-chat').style.setProperty('--topbar', Math.ceil(document.getElementById('topbar').getBoundingClientRect().bottom + 1) + 'px'); });
// ---- chat guard (identical in archive.js and client.html: keep the two in step) ----
// SLUR: the one word this server will not carry, the n-word in its usual spellings (n1gga, n i g g e r, Cyrillic
// look-alikes, ...). Nothing else is filtered: swearing stays. Names that contain it are refused; in text it is masked.
// SPAM: a slowdown that only touches spam-like messages (the same or nearly the same as one of your recent ones, or
// very short). Each one adds heat; past a little heat the next such message must wait, longer the hotter you are
// (under a second at first, growing to a minute). Trying again too early adds more heat; heat cools by one every 6 s.
// Typing different, real messages fast is never slowed.
const GUARD = (() => {
  const MAP = { '1': 'i', '!': 'i', '|': 'i', '¡': 'i', 'і': 'i', 'ı': 'i', 'ї': 'i', '3': 'e', 'е': 'e', 'є': 'e', 'ё': 'e', '4': 'a', '@': 'a', 'а': 'a',
    '9': 'g', '6': 'g', 'ɡ': 'g', 'ԍ': 'g', 'ġ': 'g', 'п': 'n', 'ո': 'n', 'η': 'n', 'г': 'r', 'ʀ': 'r', '$': 's', '5': 's', 'ѕ': 's', 'у': 'y', 'ү': 'y' };
  const INVIS = /[­͏؜ᅟᅠ឴឵᠎​-‏‪-‮⁠-⁯﻿]/;
  // one output character per UTF-16 unit, so a match's position is its position in the original text
  function fold(t) {
    let o = '';
    for (let i = 0; i < t.length;) {
      const cp = t.codePointAt(i), w = cp > 0xffff ? 2 : 1, ch = String.fromCodePoint(cp);
      let c = '\u0001';
      if (!INVIS.test(ch)) {
        const l = ch.toLowerCase();
        c = MAP[l] || l.normalize('NFKD').charAt(0) || l;
        c = MAP[c] || c;
        if (c.length !== 1 || c.charCodeAt(0) > 0xffff) c = '\u0001';
      }
      o += c + (w === 2 ? '\u0001' : ''); i += w;
    }
    return o;
  }
  const S = '[^a-z]{0,3}';
  const WORD = new RegExp(`(?<![a-z])n${S}[iy]+${S}(?:g${S}){2,}(?!l|ard)(?:e+${S}r+|a+h?|uh|r)?(?:${S}[sz])?`, 'g');
  const NAME = /(?<!s)n[iy]+g{2,}(?!l)/;
  const has = t => { WORD.lastIndex = 0; return WORD.test(fold(String(t || ''))); };
  const badName = n => { const f = fold(String(n || '')).replace(/[^a-z]/g, ''); return NAME.test(f) || has(n); };
  function mask(t) {
    t = String(t ?? ''); if (!t) return t;
    const f = fold(t); let out = '', at = 0, m; WORD.lastIndex = 0;
    while ((m = WORD.exec(f))) { out += t.slice(at, m.index) + '*'.repeat(m[0].length); at = m.index + m[0].length; if (!m[0].length) WORD.lastIndex++; }
    return at ? out + t.slice(at) : t;
  }
  // ---- spam heat ----
  const norm = t => String(t || '').toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').replace(/(.)\1{2,}/gu, '$1$1').trim();
  const bigrams = t => { const b = new Map(); for (let i = 0; i < t.length - 1; i++) { const k = t.slice(i, i + 2); b.set(k, (b.get(k) || 0) + 1); } return b; };
  function similar(a, b) {
    if (a === b) return true;
    if (a.length < 4 || b.length < 4) return false;
    const A = bigrams(a), B = bigrams(b); let n = 0;
    for (const [k, v] of A) n += Math.min(v, B.get(k) || 0);
    return 2 * n / (a.length - 1 + b.length - 1) >= 0.8;
  }
  const gap = h => h < 1.5 ? 0 : Math.min(60000, Math.round(700 * Math.pow(1.6, h - 1.5)));
  // st: per-account state, kept by the caller. Returns 0 (send it) or the milliseconds to wait. commit=false only asks.
  function spam(st, text, now, commit = true) {
    const heat = Math.max(0, (st.heat || 0) - (now - (st.at || now)) / 6000);
    const t = norm(text), last = (st.last || []).filter(x => x.at > now - 120000);
    const isSim = last.some(x => similar(x.t, t)), isShort = [...t.replace(/[\s\p{P}]/gu, '')].length <= 3;
    const spammy = isSim || isShort;
    let wait = 0, h = heat;
    if (spammy && now < (st.nextAt || 0)) { wait = st.nextAt - now; h = Math.min(heat + 0.5, 12); }
    else if (spammy) h = Math.min(heat + (isSim ? 1 : 0.6), 12);
    if (!commit) return wait;
    st.heat = h; st.at = now;
    if (wait) { st.nextAt = Math.max(st.nextAt, now + gap(h)); return st.nextAt - now; }
    if (spammy) st.nextAt = now + gap(h);
    last.push({ t, at: now }); if (last.length > 8) last.shift(); st.last = last;
    return 0;
  }
  return { has, badName, mask, spam, fold };
})();
// ---- end chat guard ----
// ---- Multiplayer hub + Go live (spectating) ----------------------------------------------------------------------
// Both run on HGNet, the relay network the games use (it comes with Grapevine's code, gv/account.js).
//   Hub rooms (HGNet game 'hghub'): type ANY 6-digit code - you join that room, or open it if nobody has. Chat, who is
//   here, and "start a game for everyone": the game hosts a party and its code goes to the room with a Join button.
//   Go live (HGNet game 'hgspec'): the game being played is captured (its canvas, or the tab for page-based games) and
//   sent as video over WebRTC; a viewer that gets no video asks for still frames through the relays instead.
//   The same code box finds both: a live game with that code opens the viewer, otherwise you get the room.
var MP = { net: null, code: '', plays: [], live: null, watch: null, spam: {}, tries: 0 };
var MP_GAMES = ['blocky', 'frontline'];
function mpName() { var L = window.HGGrapevine, me = null; try { me = L && L.me && L.me(); } catch (e) {} return String((me && me.name) || savedName() || 'Player ' + (100 + Math.floor(Math.random() * 900))).slice(0, 24); }
function mpOpts(game) { var o = { game: game }; if (window.HG_TEST_RELAYS) o.relays = window.HG_TEST_RELAYS; if (window.HG_TEST_PEER !== undefined) o.peer = window.HG_TEST_PEER; return o; }
function mpReady() { return loadGV().then(function () { if (!window.HGNet) throw new Error('Multiplayer could not load.'); return window.HGNet; }); }
function mpStatus(t) { document.getElementById('mp-status').textContent = t || ''; }
function mpEl(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function mpGo(code, again) {
  code = String(code || '').replace(/[\s.-]/g, '');
  if (!/^\d{6}$/.test(code)) { mpStatus('Codes are 6 digits.'); return; }
  if (!again) MP.tries = 0;
  if (MP.net && MP.code === code) return hubShow(true);
  hubLeave(true);
  mpStatus('Looking for ' + code + '...');
  mpReady().then(function (N) {
    var spec = N.create(mpOpts('hgspec')), hub = N.create(mpOpts('hghub')), settled = false, name = mpName();
    var wrap = function (p) { return p.then(function (r) { return { ok: true, r: r }; }, function (e) { return { ok: false, e: e }; }); };
    var ps = wrap(spec.join(code, { name: name, info: { watch: 1 } })), ph = wrap(hub.join(code, { name: name }));
    ps.then(function (x) { if (x.ok && !settled) { settled = true; hub.close(); mpStatus(''); watchStart(spec, x.r, code); } else if (!x.ok || settled) spec.close(); });
    ph.then(function (x) {
      if (x.ok && !settled) { settled = true; spec.close(); hubOpen(hub, code); return; }
      hub.close();
      if (x.ok) return;
      if (x.e && x.e.code !== 'not-found') { if (!settled) { settled = true; spec.close(); mpStatus(x.e.message); } return; }
      ps.then(function (y) { if (settled) return; settled = true; if (!y.ok) hubHost(N, code); });
    });
  }, function (e) { mpStatus(e.message); });
}
function hubHost(N, code) {
  var net = N.create(mpOpts('hghub'));
  mpStatus('Opening room ' + code + '...');
  net.host({ name: mpName(), maxPlayers: 24, code: code }).then(function (r) {
    if (r.code !== code) { net.close(); if (++MP.tries < 3) setTimeout(function () { mpGo(code, true); }, 400 + Math.random() * 600); else mpStatus('Could not open room ' + code + '. Try again.'); return; }
    hubOpen(net, code);
  }, function (e) { mpStatus(e.message); });
}
function hubOpen(net, code) {
  MP.net = net; MP.code = code; MP.plays = []; mpStatus('');
  document.getElementById('mp-roomcode').textContent = code;
  document.getElementById('mp-log').innerHTML = '';
  hubSys(net.isHost ? 'You opened room ' + code + '. Friends who type ' + code + ' come here.' : 'You joined room ' + code + '.');
  net.on('join', function (p) { if (p.id !== net.id && !p.isHost || net.isHost) hubSys(p.name + ' joined.'); hubPeople(); });
  net.on('leave', function (p) { hubSys(p.name + ' left.'); hubPeople(); });
  net.on('message', function (p, m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'chat') hubLine(p.name, String(m.text || '').slice(0, 200));
    else if (m.t === 'play' && INVITE_GAMES[m.game] && /^[A-Za-z0-9-]{4,40}$/.test(String(m.code))) hubPlay(p.name, m.game, String(m.code), false);
  });
  net.on('closed', function (reason) {
    if (MP.net !== net) return;
    MP.net = null;
    if (reason === 'closed') return;
    hubSys('The room lost its host - reconnecting...');
    setTimeout(function () { if (!MP.net && MP.code === code) mpGo(code, true); }, 300 + Math.random() * 1200);
  });
  hubPeople(); hubGames(); hubShow(true);
}
function hubShow(inRoom) { document.getElementById('mp-home').hidden = !!inRoom; document.getElementById('mp-room').hidden = !inRoom; if (inRoom) setTimeout(function () { document.getElementById('mp-msg').focus(); }, 30); }
function hubLeave(quiet) { var n = MP.net; MP.net = null; if (!quiet) MP.code = ''; if (n) try { n.close(); } catch (e) {} hubShow(false); }
function hubPeople() {
  var box = document.getElementById('mp-people'); box.innerHTML = ''; if (!MP.net) return;
  var me = { name: mpName() + ' (you)' }, list = [me].concat(MP.net.peers().filter(function (p) { return p.id !== MP.net.id; }));
  list.forEach(function (p) { var d = mpEl('div', 'mp-person'); d.appendChild(mpEl('span', 'dot')); d.appendChild(mpEl('span', '', p.name + (p.state === 'reconnecting' ? ' (reconnecting)' : ''))); box.appendChild(d); });
}
function hubGames() {
  var box = document.getElementById('mp-games'); box.innerHTML = '';
  MP_GAMES.forEach(function (id) { var g = inviteGame(id); if (!g) return; var b = mpEl('button', '', g.name.replace(/ [\d.]+$/, '')); b.onclick = function () { hubStart(id); }; box.appendChild(b); });
}
function hubLog(node) { var log = document.getElementById('mp-log'); log.appendChild(node); while (log.children.length > 200) log.removeChild(log.firstChild); log.scrollTop = log.scrollHeight; }
function hubSys(t) { hubLog(mpEl('div', 'sys', t)); }
function hubLine(who, text) { var d = mpEl('div'); d.appendChild(mpEl('b', '', who + ': ')); d.appendChild(document.createTextNode(GUARD.mask(text))); hubLog(d); }
function hubSay() {
  var inp = document.getElementById('mp-msg'), t = inp.value.trim(); if (!t || !MP.net) return;
  var w = GUARD.spam(MP.spam, t, Date.now()); if (w) { hubSys('Slow down: you can send that in ' + Math.ceil(w / 1000) + 's.'); return; }
  // the word is never sent: the server spins the wheel for your account (one slot in five is a permanent ban)
  if (GUARD.has(t)) { inp.value = ''; var GL = window.HGGrapevine; if (GL && GL.eco && GL.online()) GL.eco.slur(); else hubSys('That word is not allowed here.'); return; }
  t = GUARD.mask(t.slice(0, 200)); MP.net.send('all', { t: 'chat', text: t }); hubLine(mpName(), t); inp.value = '';
}
// start a game for the whole room: the game hosts a party and reports its code through HG_sendInvite('hub:<room>', ...)
function hubStart(id) { if (!MP.net) return; hubSys('Starting ' + inviteGame(id).name.replace(/ [\d.]+$/, '') + '...'); window.HG_hostInvite(id, 'hub:' + MP.code); }
function hubPlay(who, game, code, mine) {
  var g = inviteGame(game); if (!g) return;
  var d = mpEl('div', 'mp-play'); d.appendChild(document.createTextNode((mine ? 'You' : who) + ' started ' + g.name.replace(/ [\d.]+$/, '') + ' (party ' + code + ')'));
  if (!mine) { var b = mpEl('button', '', 'Join'); b.onclick = function () { joinInvite(game, code); }; d.appendChild(b); }
  var box = document.getElementById('mp-plays'); box.insertBefore(d, box.firstChild); while (box.children.length > 4) box.removeChild(box.lastChild);
  hubSys((mine ? 'You' : who) + ' started a game.');
  if (!mine && typeof window.HG_notify === 'function') window.HG_notify({ kind: 'invite', from: who, title: who + ' started a game in your room', text: g.name.replace(/ [\d.]+$/, '') + ' - press to join', game: game, code: code });
}

// ---- Go live ----
function gameWin() { try { if (popup && !popup.closed && current && popupGame === current.game) return popup; } catch (e) {} try { return frame.contentWindow; } catch (e) { return null; } }
function liveCapture(win) {
  // the game's main canvas if it has one (no prompt), otherwise the tab itself (the browser asks)
  var best = null, area = 0;
  try {
    var vw = win.innerWidth, vh = win.innerHeight;
    Array.prototype.forEach.call(win.document.querySelectorAll('canvas'), function (c) { var r = c.getBoundingClientRect(), a = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)); if (a > area) { area = a; best = c; } });
    if (best && area > vw * vh * 0.3 && best.captureStream) return Promise.resolve({ stream: best.captureStream(15), kind: 'canvas' });
  } catch (e) {}
  var md = navigator.mediaDevices;
  if (!md || !md.getDisplayMedia) return Promise.reject(new Error('This browser cannot share this game.'));
  return md.getDisplayMedia({ video: { frameRate: 15 }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include' }).then(function (s) { return { stream: s, kind: 'tab' }; },
    function () { throw new Error('Sharing was cancelled (or this page is not allowed to share the screen).'); });
}
function loadPeerJS() {
  if (window.Peer) return Promise.resolve(window.Peer);
  var urls = ((window.HGNet && HGNet.defaults && HGNet.defaults.libs && HGNet.defaults.libs.peerjs) || ['https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js']).slice();
  return new Promise(function (res, rej) {
    (function next() { var u = urls.shift(); if (!u) return rej(new Error('no PeerJS')); var s = document.createElement('script'); s.src = u; s.onload = function () { window.Peer ? res(window.Peer) : next(); }; s.onerror = next; document.head.appendChild(s); })();
  });
}
function peerOpts() {
  var o = { debug: 0, config: { iceServers: (window.HGNet && HGNet.defaults && HGNet.defaults.iceServers) || [] } }, t = window.HG_TEST_PEER;
  if (t && typeof t === 'object') { if (t.host) o.host = t.host; if (t.port) o.port = t.port; if (t.path) o.path = t.path; if (t.secure !== undefined) o.secure = t.secure; }
  return o;
}
function liveToggle() { if (MP.live) liveStop(); else liveStart(); }
function liveStat(t) { document.getElementById('livestat').innerHTML = t || ''; document.getElementById('golive').classList.toggle('on', !!MP.live); document.getElementById('golive').textContent = MP.live ? 'Stop live' : 'Go live'; }
function liveStart() {
  var g = current && current.game, win = gameWin(); if (!g || !win) return;
  var L = MP.live = { g: g, frames: [], net: null, peer: null, calls: [], timer: null, video: null, stream: null };
  liveStat('Starting...');
  liveCapture(win).then(function (cap) {
    if (MP.live !== L) { cap.stream.getTracks().forEach(function (t) { t.stop(); }); return; }
    L.stream = cap.stream; L.kind = cap.kind;
    cap.stream.getVideoTracks().forEach(function (t) { t.onended = function () { if (MP.live === L) liveStop(); }; });
    var v = L.video = document.createElement('video'); v.muted = true; v.playsInline = true; v.srcObject = cap.stream; v.play().catch(function () {});
    return mpReady().then(function (N) {
      var net = L.net = N.create(mpOpts('hgspec'));
      return net.host({ name: mpName(), maxPlayers: 40, info: { game: g.name, by: mpName() } }).then(function (r) {
        if (MP.live !== L) { net.close(); return; }
        L.code = r.code; liveCount();
        net.on('join', liveCount); net.on('leave', function (p) { L.frames = L.frames.filter(function (id) { return id !== p.id; }); liveCount(); });
        net.on('message', function (p, m) {
          if (!m) return;
          if (m.t === 'hi' && typeof m.pid === 'string' && L.peer) { try { var c = L.peer.call(m.pid, L.stream); if (c) L.calls.push(c); } catch (e) {} }
          if (m.t === 'frames' && L.frames.indexOf(p.id) < 0) L.frames.push(p.id);
        });
        // still frames for viewers whose video never arrives: about 3 a second, small JPEGs, through the relays
        var cv = document.createElement('canvas'); cv.width = 320; cv.height = 180; var cx = cv.getContext('2d');
        L.timer = setInterval(function () {
          if (!L.frames.length || !v.videoWidth) return;
          var k = Math.min(320 / v.videoWidth, 180 / v.videoHeight), w = Math.round(v.videoWidth * k), h = Math.round(v.videoHeight * k);
          if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
          try { cx.drawImage(v, 0, 0, w, h); var d = cv.toDataURL('image/jpeg', 0.45); if (d.length < 40000) net.send(L.frames, { t: 'f', d: d }, { fast: true }); } catch (e) {}
        }, 330);
        if (window.HG_TEST_PEER !== false) loadPeerJS().then(function (Peer) { if (MP.live !== L) return; try { L.peer = new Peer(peerOpts()); L.peer.on('error', function () {}); } catch (e) {} }, function () {});
      });
    });
  }).catch(function (e) { if (MP.live === L) { MP.live = null; liveStat(''); } alert(e.message || 'Could not go live.'); });
}
function liveCount() { var L = MP.live; if (!L || !L.net || !L.code) return; var n = L.net.peers().filter(function (p) { return p.id !== L.net.id; }).length; liveStat('<b>LIVE</b>' + L.code + ' &middot; ' + n + ' watching'); }
function liveStop() {
  var L = MP.live; MP.live = null; if (!L) return liveStat('');
  clearInterval(L.timer); L.calls.forEach(function (c) { try { c.close(); } catch (e) {} });
  try { if (L.peer) L.peer.destroy(); } catch (e) {} try { if (L.net) L.net.close(); } catch (e) {}
  if (L.stream && L.kind === 'tab') L.stream.getTracks().forEach(function (t) { t.stop(); });
  liveStat('');
}
// ---- watching ----
function watchStart(net, r, code) {
  watchStop();
  var W = MP.watch = { net: net, peer: null, got: false, frames: false }, info = (r.hostInfo && r.hostInfo.info) || {};
  var box = document.getElementById('watch'), vid = document.getElementById('w-video'), img = document.getElementById('w-img'), wait = document.getElementById('w-wait');
  document.getElementById('w-title').textContent = 'Watching ' + String(info.by || r.hostInfo.name || 'a friend').slice(0, 24) + ' play ' + String(info.game || 'a game').slice(0, 40);
  document.getElementById('w-stat').textContent = 'code ' + code;
  vid.srcObject = null; vid.hidden = true; img.hidden = true; img.removeAttribute('src'); wait.hidden = false; wait.textContent = 'Connecting to the game...';
  box.hidden = false;
  net.on('message', function (p, m) { if (m && m.t === 'f' && typeof m.d === 'string' && /^data:image\/jpeg;base64,/.test(m.d) && !W.got) { img.src = m.d; img.hidden = false; wait.hidden = true; document.getElementById('w-stat').textContent = 'code ' + code + ' · snapshots'; } });
  net.on('closed', function () { if (MP.watch !== W) return; wait.hidden = false; wait.textContent = 'The stream has ended.'; vid.hidden = true; img.hidden = true; });
  var askFrames = function () { if (MP.watch === W && !W.got && !W.frames) { W.frames = true; net.send('host', { t: 'frames' }); } };
  W.fallback = setTimeout(askFrames, 7000);
  if (window.HG_TEST_PEER === false) askFrames();
  else loadPeerJS().then(function (Peer) {
    if (MP.watch !== W) return;
    try { W.peer = new Peer(peerOpts()); } catch (e) { return askFrames(); }
    W.peer.on('open', function (id) { net.send('host', { t: 'hi', pid: id }); });
    W.peer.on('error', function () { askFrames(); });
    W.peer.on('call', function (c) {
      c.answer();
      c.on('stream', function (s) { if (MP.watch !== W) return; W.got = true; vid.srcObject = s; vid.hidden = false; img.hidden = true; wait.hidden = true; vid.play().catch(function () {}); document.getElementById('w-stat').textContent = 'code ' + code + ' · live video'; });
      c.on('close', function () { if (MP.watch === W) { W.got = false; askFrames(); } });
    });
  }, askFrames);
}
function watchStop() {
  var W = MP.watch; MP.watch = null; document.getElementById('watch').hidden = true; if (!W) return;
  clearTimeout(W.fallback); try { if (W.peer) W.peer.destroy(); } catch (e) {} try { W.net.close(); } catch (e) {}
  var v = document.getElementById('w-video'); v.srcObject = null;
}
document.getElementById('tab-mp').onclick = function () { showTab('mp'); };
document.getElementById('mp-go').onclick = function () { mpGo(document.getElementById('mp-code').value); };
document.getElementById('mp-code').addEventListener('keydown', function (e) { if (e.key === 'Enter') mpGo(this.value); });
document.getElementById('mp-new').onclick = function () { var c = String(100000 + Math.floor(Math.random() * 900000)); document.getElementById('mp-code').value = c; mpGo(c); };
document.getElementById('mp-leave').onclick = function () { hubLeave(false); };
document.getElementById('mp-send').onclick = hubSay;
document.getElementById('mp-msg').addEventListener('keydown', function (e) { if (e.key === 'Enter') hubSay(); });
document.getElementById('golive').onclick = liveToggle;
document.getElementById('w-close').onclick = watchStop;
window.HG_hub = { go: mpGo, leave: hubLeave, state: function () { return { room: MP.net ? MP.code : null, host: !!(MP.net && MP.net.isHost), people: MP.net ? MP.net.peers().length : 0, live: MP.live ? MP.live.code || 'starting' : null, watching: !!MP.watch, watchVideo: !!(MP.watch && MP.watch.got), plays: document.getElementById('mp-plays').children.length }; } };

// Saves follow the account: before a game opens (so it starts from the newest save), and again after it closes.
// A game reads its save the moment it starts, so the account's saves have to be on this device BEFORE that. The first time in a
// visit this waits (up to 25 s, with a button to skip) for the sign-in and the first sync; afterwards it only refreshes if the last
// sync is more than a minute old. Anything newer that arrives while a game is open waits until it closes.
function gvBeforePlay(g, go, fast) {
  var L = window.HGGrapevine;
  if (!(L && L.me())) return go();
  // multiplayer (an invite, a hub room): straight in. Saves still sync in the background, and anything newer from the
  // account waits until the game closes, the same as "Play without waiting".
  if (fast) { L.sync.setGameOpen(true); if (L.online()) L.sync.run().catch(function () {}); return go(); }
  var s0 = L.sync.status(), recent = L.online() && s0.synced && Date.now() - (s0.at || 0) < 60000;
  if (recent) { L.sync.setGameOpen(true); return go(); }
  var id = ++loadId, done = false;
  function start() { if (done) return; done = true; skipWait = null; if (id !== loadId) return; L.sync.setGameOpen(true); go(); }
  document.getElementById('ptitle').textContent = g.name;
  document.getElementById('chathint').textContent = '';
  document.getElementById('player').classList.add('open'); document.documentElement.classList.add('playing');
  current = { game: g, html: null };
  var first = !s0.synced;
  frame.srcdoc = message(first ? 'Getting your saved progress...' : 'Checking for newer saves...');
  var late = setTimeout(function () { if (!done && id === loadId) frame.srcdoc = message('Still getting your saved progress...<br><br><button onclick="parent.HG_skipWait()" style="font:inherit;padding:8px 16px;cursor:pointer">Play without waiting</button><br><br><small>(Your account\'s saves load when you leave the game.)</small>'); }, 5000);
  skipWait = start;
  var p = first ? L.sync.whenSynced(25000) : Promise.race([L.sync.run().catch(function () {}), new Promise(function (r) { setTimeout(r, 3000); })]);
  p.then(function () { clearTimeout(late); start(); });
}
function gvAfterPlay() { var L = window.HGGrapevine; if (L && L.me()) setTimeout(function () { L.sync.setGameOpen(false); }, 500); if (window.HGAch) setTimeout(function () { window.HGAch.check(); }, 800); }
document.addEventListener('visibilitychange', function () { var L = window.HGGrapevine; if (document.hidden && L && L.me() && L.online()) L.sync.run().catch(function () {}); });
if (!BUNDLE) {
  if (hasSavedKey()) { paintChip(); loadGV().then(function (L) { L.resume(); }, function () {}); }   // signed in before: bring the account up quietly
  else { closePlayer(); showGate(); }
}
if (start === 'chat') showTab('chat'); else if (start === 'account') showTab('acct');
