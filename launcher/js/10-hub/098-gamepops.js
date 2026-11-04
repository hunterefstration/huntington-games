// ---- Grapevine pop-ups while a game is open: on or off, and which chats may pop up --------------------------------------
// Kept on this device ('hgv:gamepops'). Off = no chat pop-ups over games at all (game invites can still come through);
// a chat ticked off never pops up over a game. Outside games nothing changes. The Account tab has the settings, and the
// bar over a running game has a quick on/off.
var GPOPS = (function () { var d = { off: false, invites: true, mute: {} }; try { return Object.assign(d, JSON.parse(localStorage.getItem('hgv:gamepops') || '{}')); } catch (e) { return d; } })();
function gpopsSave() { try { localStorage.setItem('hgv:gamepops', JSON.stringify(GPOPS)); } catch (e) {} gpopsBtn(); }
(function () {
  var n0 = window.HG_notify;
  window.HG_notify = function (n) {
    if (current && n) {
      var invite = n.kind === 'invite' || (n.text && INVITE_RE.test(n.text));
      if (GPOPS.off && !(invite && GPOPS.invites)) return;
      if (n.convId && GPOPS.mute[n.convId] && !(invite && GPOPS.invites)) return;
    }
    return n0.apply(this, arguments);
  };
})();
function gpopsBtn() {
  var b = document.getElementById('gpop');
  if (!b) { b = document.createElement('button'); b.id = 'gpop'; var full = document.getElementById('full'); if (full) full.parentNode.insertBefore(b, full); b.onclick = function () { GPOPS.off = !GPOPS.off; gpopsSave(); hubToast(GPOPS.off ? 'Chat pop-ups off while playing' : 'Chat pop-ups on while playing'); }; }
  b.textContent = GPOPS.off ? '🔕 Pop-ups off' : '🔔 Pop-ups on'; b.title = 'Grapevine pop-ups over games (choose chats in the Account tab)';
  gpopsPaint();
}
function gpopsPaint() {
  var box = document.getElementById('view-gpops'); if (!box || box.hidden) return;
  var api = chatApi(), cs = api ? api.convs() : [];
  box.innerHTML = '<div class="gpops"><h3>Grapevine pop-ups while you play</h3>' +
    '<label class="gp-row"><input type="checkbox" id="gp-on"' + (GPOPS.off ? '' : ' checked') + '> Show chat pop-ups over games</label>' +
    '<label class="gp-row"><input type="checkbox" id="gp-inv"' + (GPOPS.invites ? ' checked' : '') + '> Always show game invites</label>' +
    '<div class="gp-sub">Chats that may pop up over a game:</div>' +
    (cs.length ? '<div class="gp-list">' + cs.map(function (c) { return '<label><input type="checkbox" data-gpc="' + profEsc(c.id) + '"' + (GPOPS.mute[c.id] ? '' : ' checked') + (GPOPS.off ? ' disabled' : '') + '> ' + (c.kind === 'dm' ? '@' : '') + profEsc(c.title) + '</label>'; }).join('') + '</div>'
      : '<div class="gp-sub">Your chats show up here once Grapevine is open (the Grapevine tab).</div>') + '</div>';
}
document.addEventListener('change', function (e) {
  var t = e.target; if (!t || !t.closest || !t.closest('#view-gpops')) return;
  if (t.id === 'gp-on') GPOPS.off = !t.checked;
  else if (t.id === 'gp-inv') GPOPS.invites = t.checked;
  else if (t.dataset.gpc) { if (t.checked) delete GPOPS.mute[t.dataset.gpc]; else GPOPS.mute[t.dataset.gpc] = 1; }
  gpopsSave();
});
(function () {
  var st0 = showTab;
  showTab = function (which) { var r = st0.apply(this, arguments); var b = document.getElementById('view-gpops'); if (b) { b.hidden = which !== 'acct' || !document.getElementById('view-acct') || document.getElementById('view-acct').hidden; gpopsPaint(); } return r; };
  gpopsBtn();
})();
