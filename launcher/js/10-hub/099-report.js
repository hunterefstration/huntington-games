// ===== Report: one obvious button, three small steps =====
// The red flag is always on screen: in the top bar, and in the bar above a game. It opens one dialog:
//   1. what is it about (a player / a chat message / a bug / something else)   2. a reason and a few words   3. sent.
// Chat messages are reported from the message itself in Grapevine (it calls HG_report with the message's id, so the
// admins read what was really sent). Admins see the same button with a count, and it opens their inbox (also under
// Profile, Admin tools). Reports go to the server (grapevine 078-reports.js); nothing is sent anywhere else.
var REPORT = { kind: '', pre: null, open: 0, why: '' };
var REPORT_WHY = { player: [['cheat', 'Cheating'], ['bully', 'Bullying or harassment'], ['language', 'Bad language'], ['name', 'Bad name or picture'], ['spam', 'Spam'], ['threat', 'Threats or scary stuff'], ['other', 'Something else']],
  message: [['bully', 'Bullying or harassment'], ['language', 'Bad language'], ['spam', 'Spam'], ['threat', 'Threats or scary stuff'], ['other', 'Something else']] };
function repEsc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function reportClose() { var d = document.getElementById('reportdlg'); d.hidden = true; d.innerHTML = ''; try { if (document.documentElement.classList.contains('playing')) frame.contentWindow.focus(); } catch (e) {} }
function reportOpen(pre) {
  var L = window.HGGrapevine, d = document.getElementById('reportdlg');
  REPORT.pre = pre || {}; REPORT.kind = REPORT.pre.kind || ''; REPORT.why = '';
  if (!REPORT.pre.game && typeof current !== 'undefined' && current && current.game && document.documentElement.classList.contains('playing')) REPORT.pre.game = current.game.name;
  d.hidden = false;
  if (!(L && L.me())) { d.innerHTML = '<div class="rp-card"><h2>&#128681; Report</h2><p>Sign in first (the Account tab), so the admins know who is telling them.</p><div class="rp-row"><button class="rp-btn" data-rp="x">OK</button></div></div>'; return; }
  reportPaint();
}
function reportPaint(done) {
  var d = document.getElementById('reportdlg'), k = REPORT.kind, pre = REPORT.pre, h = '<div class="rp-card" role="dialog" aria-modal="true" aria-label="Report"><button class="rp-x" data-rp="x" title="Close">&times;</button>';
  if (done) {
    h += '<h2>&#9989; Sent. Thank you.</h2><p>An admin will look at it. You will not get in trouble for reporting something honestly.</p>' +
      (k === 'player' || k === 'message' ? '<p class="rp-dim">Tip: you can also block someone in Grapevine (press their name) so you stop seeing them.</p>' : '') + '<div class="rp-row"><button class="rp-btn" data-rp="x">Done</button></div>';
  } else if (!k) {
    h += '<h2>&#128681; What do you want to report?</h2><p class="rp-dim">It goes to the admins. Only they see it.</p><div class="rp-kinds">' +
      [['player', '&#129489;', 'A player', 'Cheating, being mean, a bad name...'], ['message', '&#128172;', 'A chat message', 'Something someone wrote'], ['bug', '&#128030;', 'A bug or problem', 'A game is broken, stuck or unfair'], ['other', '&#10067;', 'Something else', 'Anything the admins should know']].map(function (x) {
        return '<button class="rp-kind" data-rpk="' + x[0] + '"><span>' + x[1] + '</span><b>' + x[2] + '</b><small>' + x[3] + '</small></button>'; }).join('') + '</div>';
  } else if (k === 'message' && !pre.msgId) {
    h += '<h2>&#128172; Report a chat message</h2><p>Open <b>Grapevine</b>, point at the message (or press and hold it on a touch screen) and choose <b>&#128681; Report</b>. That sends the admins the exact message.</p>' +
      '<div class="rp-row"><button class="rp-btn ghost" data-rpk="">Back</button><button class="rp-btn" data-rp="chat">Open Grapevine</button></div>';
  } else {
    var title = { player: '&#129489; Report a player', message: '&#128172; Report this message', bug: '&#128030; Report a bug or problem', other: '&#10067; Tell the admins' }[k];
    h += '<h2>' + title + '</h2>';
    if (k === 'message') h += '<div class="rp-quote"><b>' + repEsc(pre.who || 'Someone') + '</b> ' + repEsc(String(pre.snip || '').slice(0, 200)) + '</div>';
    if (k === 'player') h += '<label>Who? <span class="rp-dim">(their exact name)</span><input id="rp-who" maxlength="64" autocomplete="off" spellcheck="false" list="rp-names" value="' + repEsc(pre.who || '') + '"></label><datalist id="rp-names">' + reportNames().map(function (n) { return '<option value="' + repEsc(n) + '">'; }).join('') + '</datalist>';
    if (k === 'bug' || k === 'player') h += '<label>Which game? <span class="rp-dim">(if it was in one)</span><select id="rp-game"><option value="">Not in a game / the launcher itself</option>' + GAMES.map(function (g) { return '<option' + (pre.game === g.name ? ' selected' : '') + '>' + repEsc(g.name) + '</option>'; }).join('') + '</select></label>';
    if (REPORT_WHY[k]) h += '<div class="rp-lbl">Why?</div><div class="rp-whys">' + REPORT_WHY[k].map(function (w) { return '<button class="rp-why' + (REPORT.why === w[0] ? ' on' : '') + '" data-rpw="' + w[0] + '">' + w[1] + '</button>'; }).join('') + '</div>';
    h += '<label>' + (k === 'bug' ? 'What went wrong? What were you doing?' : k === 'other' ? 'What should the admins know?' : 'What happened? <span class="rp-dim">(optional, but it helps)</span>') + '<textarea id="rp-text" maxlength="800" rows="4" placeholder="' + (k === 'bug' ? 'e.g. On level 3 I fell through the floor after jumping on the spring.' : 'A few words is enough.') + '">' + repEsc(REPORT.text || '') + '</textarea></label>' +
      '<div id="rp-err" class="rp-err"></div><div class="rp-row"><button class="rp-btn ghost" data-rpk="">Back</button><button class="rp-btn send" data-rp="send">Send report</button></div>';
  }
  d.innerHTML = h + '</div>';
  var f = d.querySelector('#rp-who') || d.querySelector('#rp-text'); if (f && !done) { try { f.focus(); } catch (e) {} }
}
// names to suggest: friends, and the people seen in the hub room
function reportNames() {
  var out = [], L = window.HGGrapevine;
  try { (L.friends().friends || []).forEach(function (f) { if (out.indexOf(f.name) < 0) out.push(f.name); }); } catch (e) {}
  try { [].forEach.call(document.querySelectorAll('#mp-people [data-name], #mp-people b'), function (e) { var n = e.dataset.name || e.textContent; if (n && out.indexOf(n) < 0) out.push(n); }); } catch (e) {}
  return out.slice(0, 40);
}
function reportSend() {
  var L = window.HGGrapevine, d = document.getElementById('reportdlg'), k = REPORT.kind, pre = REPORT.pre, err = d.querySelector('#rp-err');
  var who = d.querySelector('#rp-who'), game = d.querySelector('#rp-game'), text = d.querySelector('#rp-text');
  var r = { kind: k, why: REPORT.why || (k === 'bug' ? 'broken' : 'other'), text: text ? text.value.trim() : '', who: k === 'message' ? null : (who ? who.value.trim() : null) || null, game: (game && game.value) || (k === 'message' ? null : pre.game) || null, msgId: pre.msgId || null, convId: pre.convId || null };
  if (k === 'player' && !r.who) { err.textContent = 'Type the player\'s name.'; return; }
  if ((k === 'player' || k === 'message') && !REPORT.why) { err.textContent = 'Pick a reason.'; return; }
  if ((k === 'bug' || k === 'other') && r.text.length < 5) { err.textContent = 'Say what happened in a few words.'; return; }
  var b = d.querySelector('[data-rp="send"]'); b.disabled = true; b.textContent = 'Sending...';
  L.eco.report(r).then(function () { REPORT.text = ''; reportPaint(true); }, function (e) { b.disabled = false; b.textContent = 'Send report'; err.textContent = (e && e.message) || 'That did not send. Try again.'; });
}
document.getElementById('reportdlg').addEventListener('click', function (e) {
  var t = e.target, d = this;
  if (t === d) return reportClose();
  var b = t.closest && t.closest('[data-rp],[data-rpk],[data-rpw],[data-rpa]'); if (!b) return;
  var tx = d.querySelector('#rp-text'); if (tx) REPORT.text = tx.value;
  if (b.dataset.rp === 'x') return reportClose();
  if (b.dataset.rp === 'chat') { reportClose(); if (document.documentElement.classList.contains('playing')) return; showTab('chat'); return; }
  if (b.dataset.rp === 'send') return reportSend();
  if (b.dataset.rp === 'new') { REPORT.kind = ''; return reportPaint(); }
  if (b.dataset.rpk !== undefined) { REPORT.kind = b.dataset.rpk; REPORT.why = ''; var w = d.querySelector('#rp-who'); if (w) REPORT.pre.who = w.value; return reportPaint(); }
  if (b.dataset.rpw) { REPORT.why = b.dataset.rpw; [].forEach.call(d.querySelectorAll('.rp-why'), function (x) { x.classList.toggle('on', x === b); }); var er = d.querySelector('#rp-err'); if (er) er.textContent = ''; return; }
  if (b.dataset.rpa) return reportAdminAct(b.dataset.rpa, b.dataset.id);
});
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !document.getElementById('reportdlg').hidden) { e.preventDefault(); reportClose(); } });
window.HG_report = function (pre) { reportOpen(pre || {}); };
// ----- admins: the inbox -----
function reportInbox() {
  var d = document.getElementById('reportdlg'), L = window.HGGrapevine; d.hidden = false;
  d.innerHTML = '<div class="rp-card wide"><button class="rp-x" data-rp="x">&times;</button><h2>&#128681; Reports</h2><div id="rp-list" class="rp-dim">Loading...</div><div class="rp-row"><button class="rp-btn ghost" data-rp="new">Make a report myself</button></div></div>';
  L.eco.reports('list').then(reportInboxPaint, function () { var l = document.getElementById('rp-list'); if (l) l.textContent = 'Could not load the reports.'; });
}
function reportInboxPaint(m) {
  var l = document.getElementById('rp-list'); if (!l || !m || !m.list) return;
  REPORT.open = m.open || 0; reportBadge();
  var KIND = { player: '&#129489; Player', message: '&#128172; Message', bug: '&#128030; Bug', other: '&#10067; Other' };
  l.className = ''; l.innerHTML = m.list.length ? m.list.map(function (r) {
    return '<div class="rp-item' + (r.state === 'open' ? '' : ' closed') + '"><div class="rp-top"><b>' + (KIND[r.kind] || r.kind) + '</b> <span class="rp-tag">' + repEsc(r.whyText || r.why) + '</span>' +
      (r.who ? ' about <b>' + repEsc(r.who.n) + '</b>' + (r.who.u ? '' : ' <span class="rp-dim">(no such account)</span>') + (r.times > 1 ? ' <span class="rp-tag hot">' + r.times + ' reports</span>' : '') : '') +
      (r.game ? ' in <i>' + repEsc(r.game) + '</i>' : '') + '<span class="rp-when">' + new Date(r.at).toLocaleString() + ' by ' + repEsc(r.by.n) + '</span></div>' +
      (r.msg ? '<div class="rp-quote">' + repEsc(r.msg.text) + '</div>' : '') + (r.text ? '<div class="rp-text">' + repEsc(r.text) + '</div>' : '') +
      (r.note ? '<div class="rp-note">Note: ' + repEsc(r.note) + '</div>' : '') +
      '<div class="rp-acts">' + (r.state === 'open' ? '<button class="rp-btn small" data-rpa="close" data-id="' + r.id + '">Mark as handled</button>' : '<span class="rp-dim">Handled' + (r.closedBy ? ' by ' + repEsc(r.closedBy) : '') + '</span> <button class="rp-btn small ghost" data-rpa="reopen" data-id="' + r.id + '">Reopen</button>') +
      '<button class="rp-btn small ghost" data-rpa="note" data-id="' + r.id + '">Add a note</button></div></div>';
  }).join('') : '<p class="rp-dim">No reports. Nice and quiet.</p>';
}
function reportAdminAct(op, id) {
  var note = null; if (op === 'note') { note = prompt('Note for the other admins:'); if (note == null) return; }
  window.HGGrapevine.eco.reports(op, id, note).then(reportInboxPaint, function () {});
}
function reportBadge() {
  var L = window.HGGrapevine, e = L && L.eco && L.eco.state(), admin = !!(e && e.dev), n = REPORT.open;
  [document.getElementById('reportBtn'), document.getElementById('preport')].forEach(function (b, i) {
    if (!b) return; b.innerHTML = '&#128681; ' + (admin && !i ? 'Reports' + (n ? ' <span class="rp-n">' + n + '</span>' : '') : 'Report'); b.classList.toggle('hot', admin && n > 0 && !i);
  });
}
document.getElementById('reportBtn').onclick = function () { var L = window.HGGrapevine, e = L && L.eco && L.eco.state(); if (e && e.dev) reportInbox(); else reportOpen({}); };
document.getElementById('preport').onclick = function () { reportOpen({}); };
(function wait() {
  var L = window.HGGrapevine; if (!L || !L.on) return setTimeout(wait, 2500);
  var asked = false;
  L.on('reports', function (m) { REPORT.open = m.open || 0; reportBadge(); if (m.open && typeof window.HG_notify === 'function' && !REPORT.said) { REPORT.said = 1; setTimeout(function () { REPORT.said = 0; }, 60000); window.HG_notify({ kind: 'report', title: 'New report', text: 'Someone sent the admins a report. Press Reports to read it.' }); } });
  L.on('eco', function () { var e = L.eco.state(); reportBadge(); if (e && e.dev && !asked && L.online()) { asked = true; L.eco.reports('list').then(function (m) { REPORT.open = (m && m.open) || 0; reportBadge(); }, function () { asked = false; }); } });
})();
