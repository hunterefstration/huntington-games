
// ===== The Admin menu (2026-11-17): everything an admin or the owner can do, in one place, from the top bar =====
// The 🛡️ Admin tab shows only for accounts with admin powers. Sections, left to right in the order you need them:
//   Overview (your powers, your tag, what needs you)  ·  Reports (answer them: act or dismiss, with a note to the reporter)
//   Players (one player: warnings, mutes, bans, then their progress, goons and titles)  ·  Muted & banned  ·  Admins  ·  Server
// Every power is still checked by the server; this only draws what you may use. The buttons reuse the admin tools in
// 098-admin.js (data-padm), so the profile click handler (040) serves them here too.
var ADM = { sec: 'home', reps: null, repFilter: 'open', info: null };
var ADM_SECS = [['home', '🏠', 'Overview'], ['reports', '🚩', 'Reports'], ['players', '🧑', 'Players'], ['bans', '🔇', 'Muted & banned'], ['admins', '🛡️', 'Admins'], ['server', '🖥️', 'Server']];
function admPerms() { var L = window.HGGrapevine, e = L && L.eco && L.eco.state(); return { e: e || {}, P: (e && e.perms) || [], owner: !!(e && e.owner) }; }
function admIs() { var p = admPerms(); return p.owner || p.P.length > 0; }
function admH(p) { return admPerms().P.indexOf(p) >= 0; }
function admTabShow() { var t = document.getElementById('tab-admin'); if (t) t.hidden = !admIs(); }
function admSecOk(k) {
  if (k === 'reports') return admH('reports');
  if (k === 'players') return admH('moderate') || admH('ban') || admH('accounts') || admH('progress') || admH('leaderboards') || admH('goons') || admH('titles') || admH('reports');
  if (k === 'bans') return admH('moderate') || admH('ban');
  if (k === 'admins') return admH('admins');
  if (k === 'server') return admH('dbuse');
  return true;
}
function admRender() {
  var box = document.getElementById('view-admin'); if (!box || box.hidden) return;
  var L = window.HGGrapevine, c = L && L.eco && L.eco.catalog();
  if (!L || !L.me || !L.me() || !admIs()) { box.innerHTML = '<div class="pempty">Only admins can open this.</div>'; return; }
  if (!c) { box.innerHTML = '<div class="pempty">Loading...</div>'; L.eco.refresh(true); return; }
  if (!admSecOk(ADM.sec)) ADM.sec = 'home';
  var nav = ADM_SECS.filter(function (s) { return admSecOk(s[0]); }).map(function (s) {
    var n = s[0] === 'reports' && REPORT.open ? ' <span class="rp-n">' + REPORT.open + '</span>' : '';
    return '<button class="adm-nav' + (ADM.sec === s[0] ? ' on' : '') + '" data-adm="' + s[0] + '"><span>' + s[1] + '</span>' + s[2] + n + '</button>';
  }).join('');
  box.innerHTML = '<div class="adm"><aside class="adm-side"><div class="adm-title">🛡️ Admin</div>' + nav + '</aside><section class="adm-main padmin" id="adm-main">' + admSection(ADM.sec, c) + '</section></div>';
  admAfter(ADM.sec);
}
function admHead(t, sub) { return '<div class="adm-h"><h2>' + t + '</h2>' + (sub ? '<p class="pnote">' + sub + '</p>' : '') + '</div>'; }
function admSection(k, c) {
  var p = admPerms(), e = p.e;
  if (k === 'home') {
    var names = { reports: 'reports', moderate: 'warn and mute', ban: 'bans', announce: 'announcements', inspect: 'console', peek: 'read any chat', rooms: 'rooms', titles: 'titles', goons: 'goons', accounts: 'accounts', progress: 'progress', leaderboards: 'leaderboards', shop: 'free shop', dbuse: 'database use', admins: 'manage admins' };
    var me = window.HGGrapevine.me(), mine = (window.HGGrapevine.eco.cos([me.userId]) || {})[me.userId] || {}, tg = mine.tg || [], tag = p.owner ? 'owner' : 'admin', on = tg.indexOf(tag) >= 0;
    var tiles = [];
    if (admH('reports')) tiles.push('<button class="adm-tile' + (REPORT.open ? ' hot' : '') + '" data-adm="reports"><b>' + (REPORT.open || 0) + '</b><span>open report' + (REPORT.open === 1 ? '' : 's') + '</span></button>');
    if (admSecOk('players')) tiles.push('<button class="adm-tile" data-adm="players"><b>🔎</b><span>look up a player</span></button>');
    if (admSecOk('bans')) tiles.push('<button class="adm-tile" data-adm="bans"><b>🔇</b><span>muted &amp; banned now</span></button>');
    tiles.push('<button class="adm-tile" data-adm-go="act"><b>📈</b><span>player activity</span></button>');
    return admHead('Overview', p.owner ? 'You are the owner: you have every power.' : 'Your powers: ' + (p.P.map(function (x) { return names[x] || x; }).join(', ') || 'none') + '. The owner decides these.') +
      '<div class="adm-tiles">' + tiles.join('') + '</div>' +
      '<h4>Your tag</h4><p class="pnote">An <b>' + (p.owner ? '★ OWNER' : 'ADMIN') + '</b> tag next to your name everywhere (chat, profile, leaderboards). Nobody can fake it. Wear it only when you want to.</p>' +
      '<div class="prow"><button class="pb' + (on ? ' on' : '') + '" data-padm="tag" data-tag="' + tag + '" data-on="' + (on ? 0 : 1) + '">' + (on ? 'Wearing it: take it off' : 'Wear the ' + (p.owner ? 'Owner' : 'Admin') + ' tag') + '</button></div>' +
      '<h4>How it works</h4><ul class="adm-how"><li><b>Reports</b>: read what was sent, then warn, mute, ban or dismiss. The person who reported it gets your note.</li>' +
      '<li><b>Warnings</b> are kept on the player\'s record. They see one the moment you send it, or the next time they sign in.</li>' +
      '<li>The <b>n-word</b> bans by itself: 1 day, then 3, then 7, then for good. Everyday swearing is allowed (see 📜 Rules).</li></ul>';
  }
  if (k === 'reports') {
    var f = ADM.repFilter;
    return admHead('Reports', 'Newest first. Pick what to do, write a note for the person who reported it (they see it), and press Send.') +
      '<div class="adm-seg">' + [['open', 'Open'], ['closed', 'Handled'], ['all', 'All']].map(function (x) { return '<button data-adm-rf="' + x[0] + '" class="' + (f === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') +
      '<button data-rp-new="1" class="ghost">Make a report myself</button></div><div id="adm-replist" class="rp-dim">Loading...</div>';
  }
  if (k === 'players') {
    var H = admH, mins = [[10, '10 minutes'], [60, '1 hour'], [360, '6 hours'], [1440, '1 day'], [4320, '3 days'], [10080, '7 days']];
    var h = admHead('Players', 'Type their exact account name and press Look up. Then use the tools below on them.') +
      '<div class="prow"><input id="pa-look" maxlength="40" placeholder="Their exact name" autocomplete="off" value="' + profEsc(PA.name || '') + '" style="flex:1;min-width:180px"><button class="pb" data-adm-look="1">Look up</button></div>' +
      '<div id="adm-card" class="adm-card">' + admCard() + '</div>';
    if (H('moderate') || H('ban')) {
      h += '<h4>Warn, mute or ban</h4><p class="pnote">The reason is shown to them (and in #main when you tick the box).</p>' +
        '<div class="prow"><select id="pa-mod-mins">' + mins.map(function (m) { return '<option value="' + m[0] + '"' + (m[0] === 60 ? ' selected' : '') + '>' + m[1] + '</option>'; }).join('') + '</select>' +
        '<input id="pa-mod-why" maxlength="200" placeholder="Reason (or the new name, for Rename)" autocomplete="off" style="flex:1;min-width:180px"><label class="pnote"><input type="checkbox" id="pa-mod-ann"> say it in #main</label></div>' +
        '<div class="prow">' + (H('moderate') ? '<button class="pb" data-padm="mod:warn">⚠️ Warn</button><button class="pb" data-padm="mod:mute">🔇 Mute</button><button class="pb" data-padm="mod:slow" title="One message every 30 seconds">🐢 Slow mode</button>' : '') +
        (H('ban') ? '<button class="pb" data-padm="mod:tempban">⏳ Ban for that long</button><button class="pb warn" data-padm="mod:ban">🔨 Ban for good</button><button class="pb ghost" data-padm="mod:unban">Unban</button>' : '') +
        (H('moderate') ? '<button class="pb ghost" data-padm="mod:clear">Lift effects</button><button class="pb ghost" data-padm="mod:clearwarns">Clear warnings</button>' : '') + '</div>' +
        (H('moderate') ? '<p class="pnote" style="margin-top:8px">For fun (they last as long as the time above):</p><div class="prow pafun">' + PA_MOD_FUN.map(function (fx) { return '<button class="pb" data-padm="mod:' + fx[0] + '" title="' + profEsc(fx[2]) + '">' + fx[1] + '</button>'; }).join('') + '</div>' : '') +
        '<div id="pa-modout" class="pnote" style="white-space:pre-wrap;margin:6px 0 0"></div>';
    }
    var pt = H('accounts') || H('progress') || H('leaderboards') || H('goons') || H('titles');
    if (pt) {
      h += '<h4>Account and progress</h4><div class="prow">' + (H('accounts') ? '<button class="pb" data-padm="look">Saves, goons and boards</button>' : '') +
        (H('progress') ? '<button class="pb" data-padm="edit">Edit progress</button>' : '') + (H('leaderboards') ? '<button class="pb" data-padm="lbtools">Leaderboards</button>' : '') + '</div>';
      if (H('goons')) h += '<div class="prow"><input id="pa-n" type="number" min="-100000" max="1000000" value="5" style="width:110px"><button class="pb" data-padm="goons">Give goons</button><button class="pb" data-padm="chips">Give casino chips</button></div>';
      if (H('titles')) {
        var titles = c.items.filter(function (i) { return i.k === 'title' && (i.x === 'Given by an admin' || i.ra); });
        h += '<div class="prow"><select id="pa-title">' + titles.map(function (t) { return '<option value="' + profEsc(t.id) + '">' + profEsc(t.n) + (t.ra ? ' (earned in a game)' : '') + '</option>'; }).join('') + '</select>' +
          '<button class="pb" data-padm="give">Give title</button><button class="pb ghost" data-padm="take">Take it back</button></div>' +
          '<div class="prow"><input id="pa-ctext" maxlength="24" placeholder="A custom title, e.g. Pizza Lord" autocomplete="off"><button class="pb" data-padm="custom">Give custom title</button></div>';
      }
      h += '<div id="pa-lookout" class="pnote" style="white-space:pre-wrap;margin:8px 0 0">' + (PA.out || '') + '</div>';
    }
    return h;
  }
  if (k === 'bans') return admHead('Muted & banned', 'Who is under an effect or banned right now. To change one, look them up under Players.') + '<div class="prow"><button class="pb ghost" data-padm="mod:list">Refresh</button></div><div id="pa-modout" class="pnote" style="white-space:pre-wrap;margin:6px 0 0">Loading...</div>';
  if (k === 'admins') return admHead('Admins', 'Give each admin only what they need. Changes work at once.') + '<div id="pa-admins">Loading...</div>';
  if (k === 'server') return admHead('Server', 'How much data the database has sent the server since it last started (the free plan allows about 5 GB a month).') + '<div class="prow"><button class="pb" data-padm="dbout">Check now</button><button class="pb ghost" data-adm-go="act">Player activity</button></div><pre id="pa-dbout" class="pnote" style="white-space:pre-wrap;margin:6px 0 0"></pre>';
  return '';
}
// the player card: warnings, effects, ban and reports, from the server (smod 'info')
function admCard() {
  var r = ADM.info; if (!r) return '<p class="pnote">Nobody looked up yet.</p>';
  if (!r.ok) return '<p class="pnote">' + profEsc(r.err || 'Could not look that up.') + '</p>';
  var fx = [], e = r.fx || {}; if (e.mute) fx.push('muted until ' + hgTime(e.mute)); if (e.slow) fx.push('slow mode'); if (e.nick) fx.push('renamed "' + profEsc(e.nick.text) + '"'); for (var k in (e.fx || {})) fx.push(k);
  return '<div class="adm-pc"><b class="adm-pn">' + profEsc(r.name) + '</b>' +
    '<span class="rp-tag' + (r.count ? ' hot' : '') + '">' + r.count + ' warning' + (r.count === 1 ? '' : 's') + '</span>' +
    '<span class="rp-tag">' + r.reports + ' report' + (r.reports === 1 ? '' : 's') + ' about them</span>' +
    (r.ban ? '<span class="rp-tag hot">' + (r.ban.until ? 'banned until ' + hgTime(r.ban.until) : 'banned for good') + '</span>' : '') +
    (fx.length ? '<span class="rp-tag">' + fx.join(', ') + '</span>' : '') + '</div>' +
    (r.warns && r.warns.length ? '<div class="adm-warns">' + r.warns.map(function (w) { return '<div>⚠️ <b>' + profEsc(w.why) + '</b> <span class="rp-dim">' + hgTime(w.at) + ' by ' + profEsc(w.by) + '</span></div>'; }).join('') + '</div>' : '');
}
function admLook() {
  var nm = paName(), L = window.HGGrapevine; PA.name = nm; if (!nm) return hubToast('Type their name first.');
  var card = document.getElementById('adm-card'); if (card) card.innerHTML = '<p class="pnote">Asking...</p>';
  L.eco.mod('info', nm).then(function (r) { ADM.info = r; var c2 = document.getElementById('adm-card'); if (c2) c2.innerHTML = admCard(); }, function (er) { ADM.info = { ok: false, err: String(er && er.message || er) }; var c2 = document.getElementById('adm-card'); if (c2) c2.innerHTML = admCard(); });
}
function admAfter(k) {
  var L = window.HGGrapevine;
  if (k === 'reports') admRepLoad();
  else if (k === 'bans') paMod('list');
  else if (k === 'admins') L.eco.permsAdmin('list').then(paAdmins);
}
// ----- reports, answered here -----
function admRepLoad() { window.HGGrapevine.eco.reports('list').then(function (m) { if (m && m.list) { ADM.reps = m; REPORT.open = m.open || 0; reportBadge(); } admRepPaint(); }, function () { var l = document.getElementById('adm-replist'); if (l) l.textContent = 'Could not load the reports.'; }); }
var ADM_ACTS = [['dismiss', 'Dismiss (no action)', ''], ['warn', '⚠️ Warn them', 'moderate'], ['mute60', '🔇 Mute 1 hour', 'moderate'], ['mute1440', '🔇 Mute 1 day', 'moderate'], ['tempban1440', '⏳ Ban 1 day', 'ban'], ['tempban4320', '⏳ Ban 3 days', 'ban'], ['tempban10080', '⏳ Ban 7 days', 'ban'], ['ban', '🔨 Ban for good', 'ban']];
function admRepPaint() {
  var l = document.getElementById('adm-replist'), m = ADM.reps; if (!l || !m) return;
  var KIND = { player: '🧑 Player', message: '💬 Message', bug: '🐞 Bug', other: '❓ Other' }, f = ADM.repFilter;
  var list = m.list.filter(function (r) { return f === 'all' || (f === 'open' ? r.state === 'open' : r.state !== 'open'); });
  l.className = '';
  l.innerHTML = list.length ? list.map(function (r) {
    var acts = ADM_ACTS.filter(function (a) { return (!a[2] || admH(a[2])) && (a[0] === 'dismiss' || (r.who && r.who.u)); });
    return '<div class="rp-item' + (r.state === 'open' ? '' : ' closed') + '" data-rid="' + r.id + '"><div class="rp-top"><b>' + (KIND[r.kind] || r.kind) + '</b> <span class="rp-tag">' + repEsc(r.whyText || r.why) + '</span>' +
      (r.who ? ' about <b>' + repEsc(r.who.n) + '</b>' + (r.who.u ? ' <button class="rp-link" data-adm-who="' + repEsc(r.who.n) + '">look up</button>' : ' <span class="rp-dim">(no such account)</span>') + (r.times > 1 ? ' <span class="rp-tag hot">' + r.times + ' reports</span>' : '') + (r.warns ? ' <span class="rp-tag hot">' + r.warns + ' warning' + (r.warns === 1 ? '' : 's') + '</span>' : '') : '') +
      (r.game ? ' in <i>' + repEsc(r.game) + '</i>' : '') + '<span class="rp-when">' + hgTime(r.at) + ' by ' + repEsc(r.by.n) + '</span></div>' +
      (r.msg ? '<div class="rp-quote">' + repEsc(r.msg.text) + '</div>' : '') + (r.text ? '<div class="rp-text">' + repEsc(r.text) + '</div>' : '') +
      (r.note ? '<div class="rp-note">Admin note: ' + repEsc(r.note) + '</div>' : '') +
      (r.state === 'open'
        ? '<div class="adm-resolve"><select class="adm-act">' + acts.map(function (a) { return '<option value="' + a[0] + '">' + a[1] + '</option>'; }).join('') + '</select>' +
          '<input class="adm-reason" maxlength="200" placeholder="Reason they see (default: ' + repEsc(r.whyText || 'breaking the rules') + ')">' +
          '<textarea class="adm-note" maxlength="300" rows="2" placeholder="Note to ' + repEsc(r.by.n) + ' (optional, they see it)"></textarea>' +
          '<div class="prow"><button class="pb" data-adm-send="' + r.id + '">Send</button><button class="pb ghost" data-rpa="note" data-id="' + r.id + '">Note for admins</button></div></div>'
        : '<div class="rp-acts"><span class="rp-dim">' + (r.did ? repEsc(r.did[0].toUpperCase() + r.did.slice(1)) : 'Handled') + (r.closedBy ? ' by ' + repEsc(r.closedBy) : '') + (r.closedAt ? ', ' + hgTime(r.closedAt) : '') + '</span>' +
          (r.reply ? ' <span class="rp-note">Told the reporter: ' + repEsc(r.reply) + '</span>' : '') + ' <button class="rp-btn small ghost" data-rpa="reopen" data-id="' + r.id + '">Reopen</button></div>') +
      '</div>';
  }).join('') : '<p class="rp-dim">' + (f === 'open' ? 'No open reports. Nice and quiet.' : 'Nothing here.') + '</p>';
}
function admSend(id) {
  var it = document.querySelector('.rp-item[data-rid="' + id + '"]'); if (!it) return;
  var v = it.querySelector('.adm-act').value, reason = it.querySelector('.adm-reason').value.trim(), note = it.querySelector('.adm-note').value.trim();
  var act = v.replace(/\d+$/, ''), mins = +(v.match(/\d+$/) || [0])[0] || undefined, r = (ADM.reps.list.filter(function (x) { return x.id === id; })[0]) || {};
  if ((act === 'ban' || act === 'tempban') && !confirm((act === 'ban' ? 'Ban ' + (r.who && r.who.n) + ' for good?' : 'Ban ' + (r.who && r.who.n) + ' for ' + it.querySelector('.adm-act').selectedOptions[0].text.replace(/^\W+Ban /, '') + '?'))) return;
  var b = it.querySelector('[data-adm-send]'); b.disabled = true; b.textContent = 'Sending...';
  window.HGGrapevine.eco.reportResolve(id, act, { mins: mins, reason: reason, note: note }).then(function (m) {
    if (m && m.ok === false) { b.disabled = false; b.textContent = 'Send'; return hubToast(m.err || 'That did not work.'); }
    hubToast(act === 'dismiss' ? 'Dismissed. ' + (r.by ? r.by.n : 'The reporter') + ' gets your note.' : 'Done. ' + (r.by ? r.by.n : 'The reporter') + ' is told.');
    admRepLoad();
  }, function (er) { b.disabled = false; b.textContent = 'Send'; hubToast(String(er && er.message || er)); });
}
// ----- wiring -----
document.addEventListener('click', function (ev) {
  var b = ev.target.closest && ev.target.closest('#view-admin [data-adm], #view-admin [data-adm-rf], #view-admin [data-adm-look], #view-admin [data-adm-who], #view-admin [data-adm-send], #view-admin [data-adm-go], #view-admin [data-rp-new], #view-admin [data-rpa]');
  if (!b) return; var d = b.dataset;
  if (d.adm) { ADM.sec = d.adm; admRender(); }
  else if (d.admRf) { ADM.repFilter = d.admRf; [].forEach.call(document.querySelectorAll('[data-adm-rf]'), function (x) { x.classList.toggle('on', x === b); }); admRepPaint(); }
  else if (d.admLook) admLook();
  else if (d.admWho) { PA.name = d.admWho; ADM.sec = 'players'; admRender(); admLook(); }
  else if (d.admSend) admSend(d.admSend);
  else if (d.admGo) showTab(d.admGo);
  else if (d.rpNew) reportOpen({});
  else if (d.rpa) { var note = null; if (d.rpa === 'note') { note = prompt('Note for the other admins (the reporter does not see this):'); if (note == null) return; } window.HGGrapevine.eco.reports(d.rpa, d.id, note).then(function () { admRepLoad(); }, function () {}); }
});
document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target && e.target.id === 'pa-look' && !document.getElementById('view-admin').hidden) admLook(); });
document.getElementById('tab-admin').addEventListener('click', function () { showTab('admin'); });
(function () {
  var st = showTab;
  showTab = function (which) {
    var r = st.apply(this, arguments), v = document.getElementById('view-admin'), t = document.getElementById('tab-admin');
    v.hidden = which !== 'admin'; t.className = 'tab' + (which === 'admin' ? ' on' : '');
    if (which === 'admin') { document.getElementById('view-games').hidden = true; loadGV().then(function () { profMount(); admRender(); }, function () {}); }
    return r;
  };
})();
// admins: the report flag opens the Reports section
reportInbox = function () { ADM.sec = 'reports'; showTab('admin'); };
(function wait() {
  var L = window.HGGrapevine; if (!L || !L.on) return setTimeout(wait, 2000);
  admTabShow();
  L.on('eco', function () { admTabShow(); });
  // (only a new-report ping: the list replies come through 'reports' too)
  L.on('reports', function (m) { if (m && m.ping && !document.getElementById('view-admin').hidden) { var n = document.querySelector('.adm-nav[data-adm="reports"]'); if (n) n.innerHTML = '<span>🚩</span>Reports' + (REPORT.open ? ' <span class="rp-n">' + REPORT.open + '</span>' : ''); if (ADM.sec === 'reports' && !document.querySelector('#adm-replist .adm-note:focus, #adm-replist .adm-reason:focus')) admRepLoad(); } });
})();
