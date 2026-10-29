
// ===== The chat dock: chat while you play =====
// Replaces the old "press T" box that was pushed into each game's own page (it fought the game for the keyboard and
// the mouse, hid behind pointer lock, and picked conversations from a tiny dropdown). The dock lives in the launcher:
// press 💬 in the bar above the game (or T, as before) and it slides in beside the game, which keeps running and stays
// visible. Conversations are tabs, unread counts show on the 💬, quick phrases send in one press, Esc goes back.
// Games opened in a new tab still get the old box (the dock is part of this page).
var DOCK = { open: false, cur: '', hooked: false, timer: 0, quick: ['gg', 'nice!', 'wait for me', "let's go", 'brb', 'one more?', '😂', '🔥', '👍'] };
function dockEl() { return document.getElementById('chatdock'); }
function dockOpen(convId) {
  var d = dockEl(); if (!d) return;
  if (convId) DOCK.cur = convId;
  DOCK.open = true; document.getElementById('player').classList.add('docked'); d.classList.add('on');
  try { var gd = frame.contentDocument; gd && gd.exitPointerLock && gd.exitPointerLock(); } catch (e) {}
  if (!chatApi()) gvStartApp();
  dockPaint(true);
  setTimeout(function () { var i = document.getElementById('dk-in'); if (i) i.focus(); }, 60);
  clearInterval(DOCK.timer); DOCK.timer = setInterval(function () { if (DOCK.open) dockPaint(); }, 1500);
}
function dockClose() {
  DOCK.open = false; clearInterval(DOCK.timer);
  var d = dockEl(); if (d) d.classList.remove('on');
  document.getElementById('player').classList.remove('docked');
  try { frame.contentWindow.focus(); } catch (e) {}
}
function dockToggle() { DOCK.open ? dockClose() : dockOpen(''); }
function dockPaint(scroll) {
  var api = chatApi(), tabs = document.getElementById('dk-tabs'), ls = document.getElementById('dk-ls');
  if (!tabs) return;
  if (!api) { ls.innerHTML = '<div class="dk-none">Connecting to Grapevine...</div>'; return; }
  if (!DOCK.hooked) { DOCK.hooked = true; try { api.on(function () { if (DOCK.open) dockPaint(true); dockBadge(); }); } catch (e) {} }
  var cs = api.convs();
  if (!DOCK.cur || !cs.some(function (c) { return c.id === DOCK.cur; })) DOCK.cur = cs.length ? cs[0].id : '';
  var show = cs.slice(0, 7); if (DOCK.cur && !show.some(function (c) { return c.id === DOCK.cur; })) show.unshift(cs.filter(function (c) { return c.id === DOCK.cur; })[0]);
  tabs.innerHTML = show.map(function (c) { return '<button data-dk="' + profEsc(c.id) + '" class="' + (c.id === DOCK.cur ? 'on' : '') + '">' + (c.kind === 'dm' ? '@' : '') + profEsc(c.title.replace(/^#/, '#')) + (c.unread && c.id !== DOCK.cur ? '<i>' + c.unread + '</i>' : '') + '</button>'; }).join('');
  var ms = DOCK.cur ? api.msgs(DOCK.cur, 50) : [], L = window.HGGrapevine;
  var cos = L && L.eco ? L.eco.cos(ms.map(function (m) { return m.uid; }).filter(Boolean)) : {};
  var stick = ls.scrollTop + ls.clientHeight > ls.scrollHeight - 30;
  ls.innerHTML = ms.length ? ms.map(function (m) {
    var inv = INVITE_RE.exec(m.text || ''), g = inv && inviteGame(inv[1]), c = cos[m.uid] || {};
    var text = inv ? (m.text || '').replace(INVITE_RE, '').replace(/\s*-\s*$/, '') : m.text;
    return '<div class="dk-m' + (m.mine ? ' me' : '') + '">' + (typeof profPfp === 'function' && c.p ? profPfp(c.p, 18, c.img) : '') + '<b>' + profEsc(m.nick || m.from) + '</b> ' + profEsc(text) +
      (g && !m.mine ? ' <button data-dkjoin="' + profEsc(inv[1]) + '|' + profEsc(inv[2]) + '">Join</button>' : '') + '</div>';
  }).join('') : '<div class="dk-none">' + (DOCK.cur ? 'No messages yet. Say hi!' : 'You are not in any chats yet.') + '</div>';
  if (scroll || stick) ls.scrollTop = ls.scrollHeight;
  if (DOCK.cur) api.read(DOCK.cur);
  dockBadge();
}
function dockBadge() {
  var api = chatApi(), b = document.getElementById('dk-btn'); if (!b) return;
  var n = 0; if (api) api.convs().forEach(function (c) { if (!(DOCK.open && c.id === DOCK.cur)) n += c.unread || 0; });
  b.innerHTML = '💬 Chat' + (n ? '<i>' + (n > 99 ? '99+' : n) + '</i>' : '');
}
function dockSend(text) {
  var api = chatApi(), inp = document.getElementById('dk-in'); text = String(text == null ? inp.value : text).trim();
  if (!api || !DOCK.cur || !text) return;
  if (api.send(DOCK.cur, text)) { if (text === inp.value.trim()) inp.value = ''; setTimeout(function () { dockPaint(true); }, 60); }
}
(function () {
  var p = document.getElementById('player'), top = document.getElementById('ptop');
  var d = document.createElement('div'); d.id = 'chatdock';
  d.innerHTML = '<div class="dk-hd"><b>Chat</b><span class="dk-k">T or 💬 opens · Esc closes</span><button id="dk-full" title="open the full Grapevine">Full chat</button><button id="dk-x" title="close">✕</button></div>' +
    '<div id="dk-tabs"></div><div id="dk-ls"></div><div id="dk-q"></div><div class="dk-ft"><input id="dk-in" maxlength="500" autocomplete="off" placeholder="Say something"><button id="dk-go">Send</button></div>';
  p.appendChild(d);
  var b = document.createElement('button'); b.id = 'dk-btn'; b.title = 'Chat without leaving the game (T)'; b.textContent = '💬 Chat';
  top.insertBefore(b, document.getElementById('golive'));
  document.getElementById('dk-q').innerHTML = DOCK.quick.map(function (q) { return '<button data-dkq="' + profEsc(q) + '">' + profEsc(q) + '</button>'; }).join('');
  b.onclick = dockToggle;
  document.getElementById('dk-x').onclick = dockClose;
  document.getElementById('dk-full').onclick = function () { dockClose(); closePlayer(); showTab('chat'); };
  document.getElementById('dk-go').onclick = function () { dockSend(); };
  d.addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    if (t.dataset.dk) { DOCK.cur = t.dataset.dk; dockPaint(true); document.getElementById('dk-in').focus(); }
    else if (t.dataset.dkq) dockSend(t.dataset.dkq);
    else if (t.dataset.dkjoin) { var x = t.dataset.dkjoin.split('|'); dockClose(); joinInvite(x[0], x[1]); }
  });
  d.addEventListener('keydown', function (e) {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); dockClose(); }
    else if (e.key === 'Enter' && e.target.id === 'dk-in') { e.preventDefault(); dockSend(); }
  });
  setInterval(dockBadge, 3000);
})();
