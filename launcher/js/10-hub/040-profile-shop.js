
// ===== Profile: your picture, banner and title; the Goon shop; global leaderboards =====
// Everything here talks to Grapevine (HGGrapevine.eco, see gv/core.js) and the server's catalog and prices
// (grapevine src/archive/074-catalog.js): this file only draws it. Goons can only be changed by the server.
var PROF = { tab: 'locker', cat: 'pfp', grp: '', lbGame: '', lbBoard: '', lbData: null, lbAsked: '' };
function profEsc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function profItem(id) { var L = window.HGGrapevine, c = L && L.eco.catalog(); if (!c) return null; if (!c.byId) { c.byId = {}; c.items.forEach(function (i) { c.byId[i.id] = i; }); } return c.byId[id] || null; }
// a picture as a round badge: its emoji (or a team's letters) on its two colours; a developer's own image
function profSvgUrl(svg) { return "url('data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg).replace(/'/g, '%27') + "')"; }      // (single quotes: this goes inside style="...")
// the shop's sections: one per game ('Games: Last Light') shown together under "Games"
function profSect(g) { return /^Games: /.test(g || '') ? 'Games' : (g || 'Other'); }
function profPfp(id, px, img) {
  var s = px || 40;
  if (img) return '<span class="ppfp" style="width:' + s + 'px;height:' + s + 'px"><img src="' + profEsc(img) + '" alt=""></span>';
  var it = profItem(id);
  if (!it) return '<span class="ppfp none" style="width:' + s + 'px;height:' + s + 'px;font-size:' + Math.round(s * .5) + 'px">?</span>';
  if (it.svg) return '<span class="ppfp art' + (it.r === 'legendary' ? ' leg' : '') + '" title="' + profEsc(it.n) + '" style="width:' + s + 'px;height:' + s + 'px">' + it.svg + '</span>';
  var inner = it.t ? '<b style="font-size:' + Math.round(s * (it.t.length > 2 ? .34 : .42)) + 'px">' + profEsc(it.t) + '</b>' : profEsc(it.e || '');
  return '<span class="ppfp' + (it.t ? ' team' : '') + '" title="' + profEsc(it.n) + '" style="width:' + s + 'px;height:' + s + 'px;font-size:' + Math.round(s * .6) + 'px;background:linear-gradient(135deg,' + it.c[0] + ',' + it.c[1] + ')">' + inner + '</span>';
}
function profBannerCss(id) { var it = profItem(id); if (!it) return ''; var g = 'linear-gradient(120deg,' + it.c.join(',') + ')'; return it.svg ? profSvgUrl(it.svg) + ' center/cover no-repeat, ' + g : g; }
var RAR = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', secret: 'Secret' };
function profFmt(v, f) {
  v = Number(v) || 0;
  if (f === 'time') { var m = Math.floor(v / 60), s = v - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); }
  if (f === 'dur') { var h = Math.floor(v / 3600), mm = Math.floor(v % 3600 / 60); return h ? h + 'h ' + mm + 'm' : mm + 'm'; }
  if (f === 'money') return '$' + Math.round(v).toLocaleString();
  if (f === 'big') return v >= 1e12 ? (v / 1e12).toFixed(2) + 'T' : v >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : Math.round(v).toLocaleString();
  return Math.round(v).toLocaleString();
}
function profOwns(e, it) { return !!(e && (it.free || e.dev || e.owned.indexOf(it.id) >= 0 || e.earned.indexOf(it.id) >= 0)); }
function profRender() {
  var box = document.getElementById('view-prof'); if (!box || box.hidden) return;
  var L = window.HGGrapevine, me = L && L.me(), e = L && L.eco.state(), c = L && L.eco.catalog();
  if (!me) { box.innerHTML = '<div class="pempty">Sign in to have a profile.</div>'; return; }
  if (!e || !c) { box.innerHTML = '<div class="pempty">Loading your profile...</div>'; if (L) L.eco.refresh(true); return; }
  var eq = e.equip || {}, title = profItem(eq.title);
  var mine = L.eco.cos([me.userId])[me.userId] || {}, ranks = Object.keys(mine.ranks || {}).sort(function (a, b) { return mine.ranks[a] - mine.ranks[b]; });
  var h = '<div class="phead" style="background:' + (profBannerCss(eq.banner) || 'linear-gradient(120deg,#1b2440,#2a1b40)') + '">' +
    profPfp(eq.pfp, 84) + '<div class="pwho"><div class="pnm">' + profEsc(me.name) + '</div>' +
    (title ? '<span class="ptag r-' + title.r + '">' + profEsc(title.n) + '</span>' : '<span class="ptag dim">no title yet</span>') +
    ((mine.rec || []).length ? '<span class="ptag rec">🏆 Record Holder</span>' : '') +
    ranks.slice(0, 4).map(function (g) { return '<span class="ptag rank t' + mine.ranks[g] + '">R' + mine.ranks[g] + ' · ' + profEsc(g) + '</span>'; }).join('') +
    '</div><div class="pgoons"><b>' + (e.dev ? '∞' : e.goons) + '</b><span>goons</span><small>' + profFmt(e.playSec, 'dur') + ' played</small></div></div>';
  h += '<div class="psub">' + [['locker', 'Locker'], ['shop', 'Goon Shop'], ['earn', 'Earn goons']].concat(e.dev ? [['admin', 'Admin tools']] : []).map(function (t) {
    return '<button data-ptab="' + t[0] + '" class="' + (PROF.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('') + '</div>';
  if (PROF.tab === 'shop' || PROF.tab === 'locker') h += profItems(e, c, PROF.tab === 'shop');
  else if (PROF.tab === 'lb') h += profBoards(c);
  else if (PROF.tab === 'admin' && e.dev) h += profAdmin(c);
  else h += profEarn(e);
  box.innerHTML = h;
  if (e.dev && PROF.tab === 'locker' && PROF.cat === 'pfp') profDevUpload(box);
}
var SLOTS = [['pfp', 'Pictures'], ['banner', 'Banners'], ['title', 'Titles'], ['skin', 'Blocky skins'], ['avatar', 'Blocky avatars'], ['music', 'Music']];
function profItems(e, c, shop) {
  var eq = e.equip || {}, buys = window.HGGrapevine.eco.buys();
  var list = c.items.filter(function (i) { return i.k === PROF.cat && (shop ? i.p > 0 && !profOwns(e, i) || (shop && i.p > 0 && e.dev) : profOwns(e, i) || i.x); });
  var groups = []; list.forEach(function (i) { var g = profSect(i.g); if (groups.indexOf(g) < 0) groups.push(g); });
  if (PROF.grp && groups.indexOf(PROF.grp) < 0) PROF.grp = '';
  var h = '<div class="pcats">' + SLOTS.map(function (s) { return '<button data-pcat="' + s[0] + '" class="' + (PROF.cat === s[0] ? 'on' : '') + '">' + s[1] + '</button>'; }).join('') + '</div>';
  if (groups.length > 1) h += '<div class="pgrps"><button data-pgrp="" class="' + (!PROF.grp ? 'on' : '') + '">All</button>' + groups.map(function (g) { return '<button data-pgrp="' + profEsc(g) + '" class="' + (PROF.grp === g ? 'on' : '') + '">' + profEsc(g || 'Other') + '</button>'; }).join('') + '</div>';
  if (PROF.grp) list = list.filter(function (i) { return profSect(i.g) === PROF.grp; });
  if (PROF.cat === 'music' && !shop) h += '<div class="pnote">The track you wear plays on the launcher (never over a game). <button class="pb" data-mtoggle="1">' + (window.HG_music && localStorage.getItem('hgv:music') === 'off' ? 'Music is off: turn on' : 'Music is on: turn off') + '</button></div>';
  if (!list.length) return h + '<div class="pempty">' + (shop ? 'You own everything here. Nice.' : 'Nothing here yet: the Goon Shop has plenty.') + '</div>';
  // one grid per group, with the game's name over its pictures ("Games: Last Light" -> "Last Light")
  var blocks = [], at = {};
  list.forEach(function (i) { var g = i.g || ''; if (!(g in at)) { at[g] = blocks.length; blocks.push({ g: g, items: [] }); } blocks[at[g]].items.push(i); });
  var card = function (i) {
    var own = profOwns(e, i), on = eq[i.k] === i.id, locked = !own && i.x;
    var prev = i.k === 'pfp' ? profPfp(i.id, 54) : i.k === 'banner' ? '<span class="pban" style="background:' + profBannerCss(i.id) + '"></span>'
      : i.k === 'title' ? '<span class="ptag big r-' + i.r + '">' + profEsc(i.n) + '</span>'
      : '<span class="ppfp" style="width:54px;height:54px;font-size:30px;background:linear-gradient(135deg,' + i.c[0] + ',' + i.c[1] + ')">' + profEsc(i.e || '🎨') + '</span>';
    var btn = locked ? '<span class="plock" title="' + profEsc(i.x) + '">🔒 ' + profEsc(String(i.x).replace(/^(ach|tag):/, '').replace(/^\w/, function (x) { return x.toUpperCase(); })) + '</span>'
      : own ? (on ? '<button data-unequip="' + i.k + '" class="pb on">Wearing</button>' : '<button data-equip="' + i.id + '" class="pb">Wear</button>')
      : '<button data-buy="' + i.id + '" class="pb buy">' + i.p + ' goon' + (i.p === 1 ? '' : 's') + '</button>';
    return '<div class="pcard r-' + i.r + (locked ? ' locked' : '') + '">' + prev + '<div class="pcn">' + (i.k === 'title' ? '' : profEsc(i.n)) + '</div><div class="pcr">' + RAR[i.r] +
      (buys[i.id] ? ' · ' + buys[i.id] + ' bought' : '') + '</div>' + btn + '</div>';
  };
  blocks.forEach(function (b) { h += (blocks.length > 1 && b.g ? '<h4 class="psec">' + profEsc(b.g.replace(/^Games: /, '')) + '</h4>' : '') + '<div class="pgrid">' + b.items.map(card).join('') + '</div>'; });
  return h;
}
function profBoards(c) {
  var games = []; Object.keys(c.boards).forEach(function (k) { var g = c.boards[k].g; if (games.indexOf(g) < 0) games.push(g); });
  if (!PROF.lbGame) PROF.lbGame = games[0];
  var keys = Object.keys(c.boards).filter(function (k) { return c.boards[k].g === PROF.lbGame; });
  if (keys.indexOf(PROF.lbBoard) < 0) PROF.lbBoard = keys[0];
  var h = '<div class="pcats">' + games.map(function (g) { return '<button data-lbg="' + profEsc(g) + '" class="' + (PROF.lbGame === g ? 'on' : '') + '">' + profEsc(g) + '</button>'; }).join('') + '</div>';
  if (keys.length > 1) h += '<div class="pgrps">' + keys.map(function (k) { return '<button data-lbb="' + k + '" class="' + (PROF.lbBoard === k ? 'on' : '') + '">' + profEsc(c.boards[k].n) + '</button>'; }).join('') + '</div>';
  var d = PROF.lbData && PROF.lbData.board === PROF.lbBoard ? PROF.lbData : null;
  if (!d) { if (PROF.lbAsked !== PROF.lbBoard) { PROF.lbAsked = PROF.lbBoard; profLoadBoard(PROF.lbBoard); } return h + '<div class="pempty">Loading...</div>'; }
  var def = d.def || c.boards[PROF.lbBoard];
  h += '<div class="pnote">' + d.n + ' on this board. Ranks: R1 = top 2%, R2 top 10%, R3 top 25%, R4 top half, R5 everyone else. First place is the Record Holder.' + (d.me ? ' You: #' + d.me.pos + ' (R' + d.me.tier + ').' : '') + '</div>';
  if (!d.rows.length) return h + '<div class="pempty">Nobody on this board yet. Be the first!</div>';
  window.HGGrapevine.eco.cos(d.rows.slice(0, 60).map(function (r) { return r.u; }));
  h += '<table class="plb"><tr><th>#</th><th>Player</th><th>' + profEsc(def.lo ? 'Time' : 'Score') + '</th><th>Rank</th><th>How</th><th>When</th></tr>' + d.rows.map(function (r) {
    var cs = window.HGGrapevine.eco.cos([])[r.u] || (window.HGGrapevine.eco.cos([r.u]))[r.u] || {};
    var how = r.d ? Object.keys(r.d).slice(0, 4).map(function (k) { return profEsc(k) + ': ' + profEsc(r.d[k]); }).join(', ') : '';
    return '<tr class="' + (r.me ? 'me' : '') + (r.pos === 1 ? ' first' : '') + '"><td>' + (r.pos === 1 ? '👑' : r.pos) + '</td><td>' + profPfp(cs.p, 22, cs.img) + ' ' + profEsc(r.n) + (r.pos === 1 ? ' <span class="ptag rec">Record Holder</span>' : '') +
      '</td><td><b>' + profFmt(r.s, def.f) + '</b></td><td><span class="ptag rank t' + r.tier + '">R' + r.tier + '</span></td><td class="how">' + how + '</td><td class="when">' + new Date(r.at).toLocaleDateString() + '</td></tr>';
  }).join('') + '</table>';
  return h;
}
function profLoadBoard(k) {
  window.HGGrapevine.eco.lbGet(k).then(function (m) { PROF.lbData = m; profRender(); lbRender(); }, function () { PROF.lbAsked = ''; });
}
// the Leaderboards tab: every game's boards (the same boards the Profile used to show)
function lbRender() {
  var box = document.getElementById('view-lb'); if (!box || box.hidden) return;
  var L = window.HGGrapevine, c = L && L.me() && L.eco && L.eco.catalog();
  if (!c) { box.innerHTML = '<div class="pempty">' + (L && L.me() ? 'Loading the leaderboards...' : 'Sign in to see the leaderboards.') + '</div>'; return; }
  box.innerHTML = '<div class="lbhead"><h2>Leaderboards</h2><span>Every game, everyone. Pick a game, then a board.</span></div>' + profBoards(c);
}
function profEarn(e) {
  var rows = [['🏆', 'Every achievement', '1 goon each (the Account tab lists them all)'], ['🌊', 'Clear 15 waves in Blocky Shooter', '1 goon'],
    ['⬆️', 'Rank up in Blocky Shooter', '1 goon per rank'], ['⏱️', '15 minutes of active play, any game', '1 goon'],
    ['🕯️', 'First in Last Light (full game) at the end of the day', '1 goon'], ['🥇', 'Top 3 in playtime for the day', '5 goons each'],
    ['⌛', 'First in daily playtime every day for a week', 'the Timeless Gooner title'], ['💰', 'The top of the goon leaderboard', 'Godly / Goated / Great Gooner titles']];
  return '<div class="pearn">' + rows.map(function (r) { return '<div><span>' + r[0] + '</span><b>' + profEsc(r[1]) + '</b><em>' + profEsc(r[2]) + '</em></div>'; }).join('') + '</div>' +
    '<div class="plog"><h4>Recent</h4>' + ((e.log || []).slice().reverse().map(function (l) { return '<div><b class="' + (l.n < 0 ? 'neg' : '') + '">' + (l.n > 0 ? '+' : '') + l.n + '</b> ' + profEsc(l.why) + ' <i>' + new Date(l.at).toLocaleString() + '</i></div>'; }).join('') || '<div class="pempty">Nothing yet.</div>') + '</div>';
}
// developers only: give someone an admin-only title (Tomato, VIP, Beta Tester...) or goons, or take a title back
function profAdmin(c) {
  var titles = c.items.filter(function (i) { return i.k === 'title' && i.x === 'Given by an admin'; });
  return '<div class="padmin"><h4>Give a special title</h4><p class="pnote">Only admins can hand these out. Type the person\'s exact name.</p>' +
    '<div class="prow"><input id="pa-name" maxlength="40" placeholder="Their exact name" autocomplete="off"><select id="pa-title">' +
    titles.map(function (t) { return '<option value="' + profEsc(t.id) + '">' + profEsc(t.n) + '</option>'; }).join('') + '</select>' +
    '<button class="pb" data-padm="give">Give title</button><button class="pb ghost" data-padm="take">Take it back</button></div>' +
    '<h4>Give goons</h4><div class="prow"><input id="pa-n" type="number" min="-100" max="500" value="5" style="width:90px"><button class="pb" data-padm="goons">Give goons</button></div></div>';
}
// developers only: a picture of their own (squeezed to 96 px)
function profDevUpload(box) {
  var d = document.createElement('div'); d.className = 'pnote';
  d.innerHTML = 'Developer: <label class="pb">Upload your own picture<input type="file" accept="image/*" hidden></label>';
  box.appendChild(d);
  d.querySelector('input').onchange = function (ev) {
    var f = ev.target.files[0]; if (!f) return; var img = new Image();
    img.onload = function () { var cv = document.createElement('canvas'); cv.width = cv.height = 96; var x = cv.getContext('2d'), s = Math.min(img.width, img.height);
      x.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 96, 96); var data = cv.toDataURL('image/webp', .8); if (data.length > 29000) data = cv.toDataURL('image/jpeg', .7);
      var e = window.HGGrapevine.eco.state(); window.HGGrapevine.eco.equip('pfp', (e.equip && e.equip.pfp) || 'pfp:free-smile', data); };
    img.src = URL.createObjectURL(f);
  };
}
document.addEventListener('click', function (ev) {
  var b = ev.target.closest && ev.target.closest('#view-prof button, #view-lb button'); if (!b) return;
  var L = window.HGGrapevine, d = b.dataset;
  if (d.ptab) { PROF.tab = d.ptab; PROF.grp = ''; }
  else if (d.pcat) { PROF.cat = d.pcat; PROF.grp = ''; }
  else if (d.pgrp !== undefined) PROF.grp = d.pgrp;
  else if (d.lbg) { PROF.lbGame = d.lbg; PROF.lbBoard = ''; PROF.lbData = null; }
  else if (d.lbb) { PROF.lbBoard = d.lbb; PROF.lbData = null; }
  else if (d.buy) { var it = profItem(d.buy); if (it && confirm('Buy ' + it.n + ' for ' + it.p + ' goon' + (it.p === 1 ? '' : 's') + '?')) L.eco.buy(d.buy); return; }
  else if (d.equip) { L.eco.equip(profItem(d.equip).k, d.equip); return; }
  else if (d.unequip) { L.eco.equip(d.unequip, null); return; }
  else if (d.mtoggle) { if (window.HG_music) HG_music.toggle(); }
  else if (d.padm) {
    var nm = (document.getElementById('pa-name').value || '').trim(); if (!nm) { hubToast('Type their name first.'); return; }
    if (d.padm === 'goons') { var n = Math.round(+document.getElementById('pa-n').value || 0); if (!n) return; L.eco.admin('goons', nm, null, n); hubToast('Sent ' + n + ' goons to ' + nm + '.'); return; }
    var t = document.getElementById('pa-title').value, it = profItem(t);
    L.eco.admin(d.padm, nm, t); hubToast((d.padm === 'give' ? 'Gave ' : 'Took back ') + (it ? it.n : t) + (d.padm === 'give' ? ' to ' : ' from ') + nm + '.'); return;
  }
  else return;
  profRender(); lbRender();
});
function profMount() {
  var L = window.HGGrapevine; if (!L || profMount.done) return; profMount.done = true;
  L.on('eco', function (m) { profRender(); lbRender(); paintChip(); if (m && m.bought) { var it = profItem(m.bought); if (it) hubToast('Bought ' + it.n + '!'); } });
  L.on('cos', function () { if (PROF.tab === 'lb') profRender(); });
  L.on('ecoError', function (m) { hubToast(m.text || 'That did not work.'); });
}
function hubToast(t) { var el = document.createElement('div'); el.className = 'htoast'; el.textContent = t; document.body.appendChild(el); setTimeout(function () { el.remove(); }, 3200); }
