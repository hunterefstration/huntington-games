
// ===== Game chat over a running game (2026-11-16), Minecraft style =====
// While a game is open in the launcher you are in its temporary game chat: the people in your party (the code you host or
// joined), or else everyone playing the same game. Messages float up in the bottom-left corner over the game and fade
// after a few seconds. T opens the input line (with the recent lines showing); Enter sends and closes, Esc closes, Tab
// switches to your Grapevine chats in the dock. Nothing is stored (Grapevine 081-gamechat.js).
var GC = { room: '', label: '', n: 0, lines: [], open: false, el: null, inp: null, hooked: false, game: null };
function gcRoomFor(g) {
  if (!g) return { room: '', label: '' };
  var gid = Object.keys(INVITE_GAMES).filter(function (k) { return INVITE_GAMES[k] === g.dir; })[0];
  var nm = String(g.name || g.dir).replace(/ [\d.]+$/, '');
  if (gid && window.PARTY && PARTY.lastGame === gid && PARTY.lastCode) return { room: 'p:' + gid + ':' + PARTY.lastCode, label: 'Party ' + PARTY.lastCode };
  return { room: 'g:' + nm.replace(/[^A-Za-z0-9 .&'!:-]/g, '').slice(0, 40), label: 'Everyone in ' + nm };
}
function gcEl() {
  if (GC.el) return GC.el;
  var d = document.createElement('div'); d.id = 'gchat'; d.hidden = true;
  d.innerHTML = '<div class="gc-lines"></div><div class="gc-bar"><span class="gc-ch"></span><input maxlength="300" autocomplete="off" spellcheck="false" placeholder="Say something to the players here"><span class="gc-hint">Enter sends · Esc closes · Tab: your chats</span></div>';
  document.getElementById('player').appendChild(d);
  GC.el = d; GC.inp = d.querySelector('input');
  GC.inp.addEventListener('keydown', function (e) {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); gcClose(); }
    else if (e.key === 'Enter') { e.preventDefault(); var t = GC.inp.value.trim(); if (t && GC.room && window.HGGrapevine) window.HGGrapevine.party.chatSay(GC.room, t); GC.inp.value = ''; gcClose(); }
    else if (e.key === 'Tab') { e.preventDefault(); gcClose(); if (typeof dockOpen === 'function') dockOpen(''); }
  });
  GC.inp.addEventListener('keyup', function (e) { e.stopPropagation(); });
  return d;
}
function gcPaint() {
  var d = gcEl(), box = d.querySelector('.gc-lines'), now = Date.now();
  d.hidden = !GC.room;
  d.classList.toggle('open', GC.open);
  d.querySelector('.gc-ch').textContent = GC.label + (GC.n > 1 ? ' · ' + GC.n + ' here' : '');
  var show = GC.lines.filter(function (l) { return GC.open || now - l.at < 9000; }).slice(GC.open ? -12 : -6);
  box.textContent = '';
  show.forEach(function (l) {
    var r = document.createElement('div'); r.className = 'gc-line' + (l.sys ? ' sys' : '') + (l.err ? ' err' : '') + (!GC.open && now - l.at > 7000 ? ' fade' : '');
    if (l.from) { var b = document.createElement('b'); b.textContent = l.from; b.style.color = gcColor(l.uid || l.from); if (l.real && l.real !== l.from) b.title = l.real; r.appendChild(b); }
    r.appendChild(document.createTextNode(l.text));
    box.appendChild(r);
  });
}
function gcColor(k) { var h = 0; for (var i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) % 360; return 'hsl(' + h + ',85%,72%)'; }
function gcLine(l) { l.at = Date.now(); GC.lines.push(l); if (GC.lines.length > 60) GC.lines.shift(); gcPaint(); setTimeout(gcPaint, 9200); setTimeout(gcPaint, 7100); }
function gcOpen() {
  var L = window.HGGrapevine; if (!L || !L.me || !L.me() || !GC.room) return false;
  gcEl(); GC.open = true; gcPaint();
  try { var fd = frame.contentDocument; if (fd && fd.exitPointerLock) fd.exitPointerLock(); } catch (e) {}
  setTimeout(function () { GC.inp.focus(); }, 0);
  return true;
}
function gcClose() { GC.open = false; gcPaint(); try { frame.focus(); frame.contentWindow.focus(); } catch (e) {} }
// which room: follows the game that is open (and its party, once the launcher knows the code)
function gcSync() {
  var L = window.HGGrapevine; if (!L || !L.party || !L.party.chatRoom) return;
  if (!GC.hooked && L.on) {
    GC.hooked = true;
    L.on('gchat', function (m) {
      if (!m || m.room !== GC.room) return;
      if (m.n != null && m.text == null && !m.err) { var was = GC.n; GC.n = m.n; if (was && m.n > was) gcLine({ sys: 1, text: 'Someone joined the game chat.' }); else gcPaint(); return; }
      if (m.err) return gcLine({ err: 1, text: m.err });
      gcLine({ from: m.from, real: m.real, uid: m.uid, text: m.text });
    });
    L.on('status', function (s) { if (s.status === 'online' && GC.room) L.party.chatRoom(GC.room); });
  }
  var g = typeof current !== 'undefined' && current && current.game, want = g && !g.noChat && L.me && L.me() ? gcRoomFor(g) : { room: '', label: '' };
  if (want.room === GC.room) return;
  GC.room = want.room; GC.label = want.label; GC.n = 0; GC.lines = []; GC.open = false;
  L.party.chatRoom(GC.room || null);
  if (GC.room) gcLine({ sys: 1, text: 'Press T to chat with the people playing here.' });
  else gcPaint();
}
setInterval(gcSync, 3000);
(function () { var pn = playNow, cp = closePlayer;
  playNow = function () { var r = pn.apply(this, arguments); setTimeout(gcSync, 1500); return r; };
  closePlayer = function () { var r = cp.apply(this, arguments); setTimeout(gcSync, 50); return r; };
})();
