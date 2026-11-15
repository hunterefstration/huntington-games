
// ===== Admin tools (2026-11-15): what you see is what the owner allowed you =====
// Every admin power is checked by the server (ADMIN_PERMS in Grapevine's 020); this only draws the parts you may use.
// Sections: your powers and tags; one player box (look up, rebuild, put back, edit progress, leaderboards, goons, titles);
// admins and their powers (owner); reports; database use.
var PA = { out: '', admins: null, edit: null };
var PA_GAME = {      // a save, its game, and the leaderboards its numbers feed (for "count on the leaderboards?")
  lumi_save: ['Last Light', ['lumi:']], blocky21_life: ['Blocky Shooter (rank, kills)', ['blocky:']], blocky21_settings: ['Blocky Shooter (settings)', []],
  brownEClickerSave: ['Brown E Clicker', ['clicker:total', 'clicker:asc']], brownEClickerSave_rb: ['Brown E Clicker Rebalanced', ['clicker:rb']],
  steelstorm_save: ['Steel Storm', ['steel:']], spikes100_progress: ['50 Levels of Spikes', ['spikes:']], td2_records: ['Tower Defense (records)', ['td:']],
  mayhem_save: ['Mayhem Marathon', ['mayhem:']], frontline_profile_v2: ['Frontline', ['frontline:']], huntingtonTetrisSurge1: ['Tetris', ['tetris:']],
  beanBrewSaveV2: ['Bean & Brew', ['coffee:']], netWorthPB: ['Market & Life (best net worth)', ['market:']], lifeScorePB: ['Market & Life (best score)', ['market:']],
  neonScores: ['Neon Dash', ['neon:']], imposter_save: ['Imposter', ['imposter:']], elementlab_challenges: ['Element Lab (challenges)', ['elementlab:']],
  'sov.hgach': ['Sovereign (records)', ['sov:']], 'hgach:v1': ['Achievements', []]
};
function paHas(p) { var e = window.HGGrapevine && window.HGGrapevine.eco.state(); return !!(e && e.perms && e.perms.indexOf(p) >= 0); }
function paName() { var i = document.getElementById('pa-look'); return i ? (i.value || '').trim() : ''; }
function paOut(html) { var o = document.getElementById('pa-lookout'); if (o) o.innerHTML = html; }
function paRender(c) {
  var e = window.HGGrapevine.eco.state() || {}, P = e.perms || [], H = function (p) { return P.indexOf(p) >= 0; };
  var names = { reports: 'reports', moderate: 'delete messages', ban: 'bans', announce: 'announcements', inspect: 'console', peek: 'read any chat', rooms: 'rooms', titles: 'titles', goons: 'goons', accounts: 'accounts', progress: 'progress', leaderboards: 'leaderboards', shop: 'free shop', dbuse: 'database use', admins: 'manage admins' };
  var h = '<div class="padmin"><p class="pnote">' + (e.owner ? 'You are the owner: you have every power.' : 'Your powers: ' + (P.map(function (p) { return names[p] || p; }).join(', ') || 'none')) + '</p>';
  // your tags
  var mine = (window.HGGrapevine.eco.cos([window.HGGrapevine.me().userId]) || {})[window.HGGrapevine.me().userId] || {}, tg = mine.tg || [];
  var tag = e.owner ? 'owner' : 'admin', on = tg.indexOf(tag) >= 0;
  h += '<h4>Your tag</h4><p class="pnote">An <b>' + (e.owner ? '★ OWNER' : 'ADMIN') + '</b> tag next to your name everywhere (chat, profile, leaderboards). Nobody can fake it, not even with a nickname. Wear it only when you want to.</p>' +
    '<div class="prow"><button class="pb' + (on ? ' on' : '') + '" data-padm="tag" data-tag="' + tag + '" data-on="' + (on ? 0 : 1) + '">' + (on ? 'Wearing it: take it off' : 'Wear the ' + (e.owner ? 'Owner' : 'Admin') + ' tag') + '</button></div>';
  // one player box
  var pt = H('accounts') || H('progress') || H('leaderboards') || H('goons') || H('titles');
  if (pt) {
    h += '<h4>A player</h4><p class="pnote">Type their exact account name (yours works too), then pick what to do.</p>' +
      '<div class="prow"><input id="pa-look" maxlength="40" placeholder="Their exact name" autocomplete="off" value="' + profEsc(PA.name || '') + '">' +
      (H('accounts') ? '<button class="pb" data-padm="look">Look up</button>' : '') +
      (H('progress') ? '<button class="pb" data-padm="edit">Edit progress</button>' : '') +
      (H('leaderboards') ? '<button class="pb" data-padm="lbtools">Leaderboards</button>' : '') + '</div>';
    if (H('goons')) h += '<div class="prow"><input id="pa-n" type="number" min="-100000" max="1000000" value="5" style="width:110px"><button class="pb" data-padm="goons">Give goons</button><button class="pb" data-padm="chips">Give casino chips</button></div>';
    if (H('titles')) {
      var titles = c.items.filter(function (i) { return i.k === 'title' && (i.x === 'Given by an admin' || i.ra); });
      h += '<div class="prow"><select id="pa-title">' + titles.map(function (t) { return '<option value="' + profEsc(t.id) + '">' + profEsc(t.n) + (t.ra ? ' (earned in a game)' : '') + '</option>'; }).join('') + '</select>' +
        '<button class="pb" data-padm="give">Give title</button><button class="pb ghost" data-padm="take">Take it back</button></div>' +
        '<div class="prow"><input id="pa-ctext" maxlength="24" placeholder="A custom title, e.g. Pizza Lord" autocomplete="off"><button class="pb" data-padm="custom">Give custom title</button></div>';
    }
    h += '<div id="pa-lookout" class="pnote" style="white-space:pre-wrap;margin:8px 0 0">' + (PA.out || '') + '</div>';
  }
  if (H('admins')) h += '<h4>Admins and their powers</h4><p class="pnote">Give each admin only what they need. Changes work at once.</p><div id="pa-admins"><button class="pb" data-padm="admins">Show admins</button></div>';
  if (H('reports')) h += '<h4>Reports</h4><div class="prow"><button class="pb" data-padm="reports">Open the reports inbox</button></div>';
  if (H('dbuse')) h += '<h4>Database use</h4><p class="pnote">How much data the database has sent the server since it last started.</p><div class="prow"><button class="pb" data-padm="dbout">Check now</button></div><pre id="pa-dbout" class="pnote" style="white-space:pre-wrap;margin:6px 0 0"></pre>';
  return h + '</div>';
}
// ---- admins and powers ----
function paAdmins(r) {
  var box = document.getElementById('pa-admins'); if (!box) return;
  if (!r.ok) { box.innerHTML = '<p class="pnote">' + profEsc(r.err || 'Could not load the admins.') + '</p>'; return; }
  PA.admins = r;
  var keys = Object.keys(r.all);
  box.innerHTML = r.list.map(function (a, i) {
    return '<div class="pacard"><b>' + profEsc(a.name) + '</b>' + (a.owner ? ' <span class="ptag role-owner">★ OWNER</span> <span class="pnote">has every power</span>' :
      '<div class="pagrid">' + keys.map(function (k) { return '<label title="' + profEsc(r.all[k]) + '"><input type="checkbox" data-pa-i="' + i + '" value="' + k + '"' + (a.perms.indexOf(k) >= 0 ? ' checked' : '') + '> ' + profEsc(r.all[k]) + '</label>'; }).join('') + '</div>' +
      '<div class="prow"><button class="pb" data-padm="psave" data-i="' + i + '">Save powers</button><button class="pb ghost" data-padm="premove" data-i="' + i + '">No longer an admin</button></div>') + '</div>';
  }).join('') + '<div class="prow"><input id="pa-newadmin" maxlength="40" placeholder="Make someone an admin: exact name" autocomplete="off"><button class="pb" data-padm="padd">Make admin (reports only, to start)</button></div>';
}
// ---- the progress editor: every number, switch and short text in a save, as fields ----
function paFlat(o, pre, out, depth) {
  if (out.length > 600 || depth > 5) return out;
  if (o && typeof o === 'object') { for (var k in o) paFlat(o[k], pre ? pre + '.' + k : k, out, depth + 1); return out; }
  if (typeof o === 'number' || typeof o === 'boolean' || (typeof o === 'string' && o.length <= 60)) out.push([pre, o]);
  return out;
}
function paSetPath(o, path, v) { var p = path.split('.'), t = o; for (var i = 0; i < p.length - 1; i++) { if (!t[p[i]] || typeof t[p[i]] !== 'object') t[p[i]] = {}; t = t[p[i]]; } t[p[p.length - 1]] = v; }
function paEditList(name) {
  paOut('Reading ' + profEsc(name) + '’s saves...');
  window.HGGrapevine.eco.savesAdminGet(name, []).then(function (r) {
    if (!r.ok) { paOut(profEsc(r.err || 'Could not read them.')); return; }
    var list = (r.list || []).filter(function (x) { return x.bytes > 0; });
    list.sort(function (a, b) { return (PA_GAME[a.k] ? 0 : 1) - (PA_GAME[b.k] ? 0 : 1) || (a.k < b.k ? -1 : 1); });
    paOut('<b>Edit ' + profEsc(r.name) + '’s progress</b><br>Pick a save:<div class="prow"><select id="pa-key">' + list.map(function (x) { return '<option value="' + profEsc(x.k) + '">' + profEsc(PA_GAME[x.k] ? PA_GAME[x.k][0] + ' — ' + x.k : x.k) + ' (' + x.bytes + ' bytes)</option>'; }).join('') +
      '</select><button class="pb" data-padm="editopen">Open</button></div>' + (list.length ? '' : '<p class="pnote">They have no saves yet.</p>'));
  }, function (e) { paOut(profEsc(e.message || String(e))); });
}
function paEditOpen(name, key) {
  window.HGGrapevine.eco.savesAdminGet(name, [key]).then(function (r) {
    var raw = ((r.values || [])[0] || {}).v || '', o = null; try { o = JSON.parse(raw); } catch (e) {}
    PA.edit = { name: r.name || name, key: key, raw: raw, obj: o };
    var fields = o !== null && typeof o === 'object' ? paFlat(o, '', [], 0) : [['(value)', raw]];
    var lb = (PA_GAME[key] || [0, []])[1];
    paOut('<b>' + profEsc(PA.edit.name) + ' — ' + profEsc(PA_GAME[key] ? PA_GAME[key][0] : key) + '</b> <span class="pnote">(' + fields.length + ' fields; set any number or switch, then Save)</span>' +
      '<div class="prow"><input id="pa-find" placeholder="Find a field (e.g. credits, earned, xp)" autocomplete="off" style="flex:1"></div>' +
      (key === 'lumi_save' ? '<div class="prow"><button class="pb ghost" data-padm="lumiall">Finish every level (with all stars)</button></div>' : '') +
      '<div id="pa-fields" class="pafields">' + fields.map(function (f, i) {
        var v = f[1], inp = typeof v === 'boolean' ? '<input type="checkbox" data-pf="' + i + '"' + (v ? ' checked' : '') + '>' : '<input data-pf="' + i + '" value="' + profEsc(String(v)) + '"' + (typeof v === 'number' ? ' inputmode="decimal"' : '') + '>';
        return '<label data-path="' + profEsc(f[0].toLowerCase()) + '"><span>' + profEsc(f[0]) + '</span>' + inp + '</label>';
      }).join('') + '</div>' +
      '<details><summary>Edit it as text instead</summary><textarea id="pa-raw" rows="8" style="width:100%">' + profEsc(raw) + '</textarea></details>' +
      (lb.length ? '<div class="prow"><label><input type="radio" name="pa-lb" value="freeze" checked> Do not count it on the leaderboards (they keep the places they have now)</label></div><div class="prow"><label><input type="radio" name="pa-lb" value="count"> Count it on the leaderboards</label></div>' : '') +
      '<div class="prow"><button class="pb" data-padm="editsave">Save it to their account</button><button class="pb ghost" data-padm="edit">Back</button></div>' +
      '<p class="pnote">Their launcher loads it within seconds (a game that is open gets it when they close it). The old copy is kept on the server.</p>');
    PA.edit.fields = fields;
    var find = document.getElementById('pa-find');
    if (find) find.oninput = function () { var q = find.value.trim().toLowerCase(); document.querySelectorAll('#pa-fields label').forEach(function (l) { l.hidden = q && l.getAttribute('data-path').indexOf(q) < 0; }); };
  }, function (e) { paOut(profEsc(e.message || String(e))); });
}
function paEditSave() {
  var E = PA.edit; if (!E) return;
  var rawBox = document.getElementById('pa-raw'), v;
  if (rawBox && rawBox.value !== E.raw) v = rawBox.value;          // edited as text: that wins
  else if (E.obj !== null && typeof E.obj === 'object') {
    var o = JSON.parse(JSON.stringify(E.obj));
    E.fields.forEach(function (f, i) {
      var inp = document.querySelector('[data-pf="' + i + '"]'); if (!inp) return;
      var old = f[1], nv = typeof old === 'boolean' ? inp.checked : typeof old === 'number' ? Number(inp.value) : inp.value;
      if (typeof old === 'number' && !isFinite(nv)) return;
      if (nv !== old) paSetPath(o, f[0], nv);
    });
    v = JSON.stringify(o);
  } else { var one = document.querySelector('[data-pf="0"]'); v = one ? one.value : E.raw; }
  if (v === E.raw) { hubToast('Nothing changed.'); return; }
  var r0 = document.querySelector('input[name="pa-lb"]:checked'), freeze = r0 && r0.value === 'freeze' ? (PA_GAME[E.key] || [0, []])[1] : null;
  window.HGGrapevine.eco.savesAdminPut(E.name, [{ k: E.key, v: v }], freeze).then(function (w) {
    hubToast(w.ok ? 'Saved to ' + E.name + '’s account' + (freeze && freeze.length ? ' (not on the leaderboards)' : '') + '.' : (w.err || 'Could not save it.'));
    if (w.ok) paEditOpen(E.name, E.key);
  }, function (e) { hubToast(e.message || String(e)); });
}
function paLumiAll() {
  var E = PA.edit; if (!E || E.key !== 'lumi_save') return;
  var o = E.obj && typeof E.obj === 'object' ? E.obj : { v: 3, levels: {}, abilities: {} }, lv = o.levels = o.levels || {};
  RB_LUMI.forEach(function (id) { var r = lv[id] || {}; r.best = r.best || 60; r.moths = [true, true, true]; r.sparks = Math.max(r.sparks || 0, 99); r.clears = Math.max(r.clears || 0, 1); lv[id] = r; });
  o.abilities = { double: true, wall: true, dash: true };
  E.raw2 = JSON.stringify(o); var t = document.getElementById('pa-raw'); if (t) { t.value = E.raw2; t.closest('details').open = true; }
  hubToast('Every level is finished in the text below. Press Save to write it.');
}
// ---- leaderboards for one player ----
function paLbTools(name) {
  var prefixes = {}; Object.keys(PA_GAME).forEach(function (k) { PA_GAME[k][1].forEach(function (p) { prefixes[p] = PA_GAME[k][0].replace(/ \(.*\)$/, ''); }); });
  paOut('<b>Leaderboards for ' + profEsc(name) + '</b><div class="prow"><select id="pa-lbp">' + Object.keys(prefixes).map(function (p) { return '<option value="' + p + '">' + profEsc(prefixes[p]) + ' (' + p + ')</option>'; }).join('') + '<option value="">every game</option></select></div>' +
    '<div class="prow"><button class="pb" data-padm="lb" data-op="freeze">Freeze (their game stops counting)</button><button class="pb" data-padm="lb" data-op="unfreeze">Let it count again</button><button class="pb ghost" data-padm="lb" data-op="remove">Remove their places</button></div>');
}
// ---- clicks ----
function paClick(d, t) {
  var L = window.HGGrapevine, nm = paName(); PA.name = nm;
  if (d.padm === 'tag') { L.eco.tagSet(d.tag, d.on === '1').then(function (r) { hubToast(r.ok ? (d.on === '1' ? 'You wear the tag now.' : 'Tag taken off.') : r.err); profRender(); }); return true; }
  if (d.padm === 'admins') { L.eco.permsAdmin('list').then(paAdmins); return true; }
  if (d.padm === 'psave' || d.padm === 'premove') {
    var a = PA.admins && PA.admins.list[+d.i]; if (!a) return true;
    if (d.padm === 'premove' && !confirm(a.name + ' will no longer be an admin. Sure?')) return true;
    var perms = [].slice.call(document.querySelectorAll('[data-pa-i="' + d.i + '"]:checked')).map(function (x) { return x.value; });
    L.eco.permsAdmin(d.padm === 'psave' ? 'set' : 'remove', a.name, perms).then(function (r) { hubToast(r.ok ? 'Done.' : r.err); paAdmins(r.ok ? r : PA.admins); });
    return true;
  }
  if (d.padm === 'padd') { var who = (document.getElementById('pa-newadmin').value || '').trim(); if (!who) return true; L.eco.permsAdmin('add', who, ['reports']).then(function (r) { hubToast(r.ok ? who + ' is an admin now (reports only: tick more below).' : r.err); if (r.ok) paAdmins(r); }); return true; }
  if (d.padm === 'reports') { if (typeof reportInbox === 'function') reportInbox(); return true; }
  if (!nm && ['edit', 'lbtools', 'chips', 'editopen', 'editsave', 'lb', 'lumiall'].indexOf(d.padm) >= 0) { hubToast('Type their name first.'); return true; }
  if (d.padm === 'edit') { paEditList(nm); return true; }
  if (d.padm === 'editopen') { paEditOpen(nm, document.getElementById('pa-key').value); return true; }
  if (d.padm === 'editsave') { paEditSave(); return true; }
  if (d.padm === 'lumiall') { paLumiAll(); return true; }
  if (d.padm === 'lbtools') { paLbTools(nm); return true; }
  if (d.padm === 'lb') {
    var pre = document.getElementById('pa-lbp').value;
    if (d.op === 'remove' && !confirm('Remove ' + nm + '’s places' + (pre ? ' in this game' : ' on every board') + '?')) return true;
    L.eco.lbAdmin(d.op, nm, pre).then(function (r) { hubToast(r.ok ? 'Done. Frozen for ' + r.name + ': ' + (r.frozen.join(', ') || 'nothing') : r.err); });
    return true;
  }
  if (d.padm === 'chips') { var n = Math.round(+document.getElementById('pa-n').value || 0); if (!n) return true; L.eco.admin('chips', nm, null, n); hubToast('Gave ' + n + ' casino chips to ' + nm + '.'); return true; }
  return false;
}
