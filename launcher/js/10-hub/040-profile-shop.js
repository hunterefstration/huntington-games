
// ===== Profile: your picture, banner and title; the Goon shop; global leaderboards =====
// Everything here talks to Grapevine (HGGrapevine.eco, see gv/core.js) and the server's catalog and prices
// (grapevine src/archive/074-catalog.js): this file only draws it. Goons can only be changed by the server.
var PROF = { tab: 'locker', cat: 'pfp', grp: '', lbGame: '', lbBoard: '', lbData: null, lbAsked: '' };
function profEsc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function profItem(id) {
  // a developer-given custom title is not in the catalog: it lives in the wallet's ctitles
  var e0 = window.HGGrapevine && window.HGGrapevine.eco.state();
  if (id && /^title:c-/.test(id) && e0 && e0.ctitles && e0.ctitles[id]) return { id: id, k: 'title', n: e0.ctitles[id], r: 'secret', p: 0, x: 'Given by an admin', custom: true };
  return profItem0(id);
}
function profItem0(id) { var L = window.HGGrapevine, c = L && L.eco.catalog(); if (!c) return null; if (!c.byId) { c.byId = {}; c.items.forEach(function (i) { c.byId[i.id] = i; }); } return c.byId[id] || null; }
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
// a title tag: one that is won by playing (ra: an achievement, a record, a rank) is written in a moving colour of its own
function cosTitle(it, big) { return '<span class="ptag' + (big ? ' big' : '') + ' r-' + it.r + (it.ra ? ' ra' : '') + '">' + (it.ra ? '<i>' + profEsc(it.n) + '</i>' : profEsc(it.n)) + '</span>'; }
// shop items other people see on you: a frame round your picture, a sidekick on its corner, a tint behind your chat messages
function cosPet(html, id, px) {
  var it = id && profItem0(id); if (!it || it.k !== 'pet') return html;
  return '<span class="pface">' + html + '<span class="pet' + (it.an ? ' anim' : '') + '" style="font-size:' + Math.max(12, Math.round(px * 0.5)) + 'px">' + profEsc(it.e) + '</span></span>';
}
function cosBubble(it, text) {
  var a = it.c.map(function (x) { return x + '30'; });
  return '<span class="pbub' + (it.an ? ' anim' : '') + '" style="--bub:' + (a.length === 1 ? 'linear-gradient(90deg,' + a[0] + ',' + it.c[0] + '14)' : 'linear-gradient(90deg,' + a.join(',') + ')') + ';--bubc:' + it.c[0] + '">' + profEsc(text) + '</span>';
}
function cosFrame(html, id) {
  var it = id && profItem0(id); if (!it || it.k !== 'frame') return html;
  var f = it.st === 'spin' ? 'conic-gradient(' + it.c.concat(it.c[0]).join(',') + ')' : it.st === 'double' ? 'linear-gradient(135deg,' + it.c.join(',') + ')' : it.c[0];
  return '<span class="pfr st-' + it.st + '" style="--f:' + f + ';--g:' + (it.c[1] || it.c[0]) + '">' + html + '</span>';
}
function profBannerCss(id) { var it = profItem(id); if (!it) return ''; var g = 'linear-gradient(120deg,' + it.c.join(',') + ')'; return it.svg ? profSvgUrl(it.svg) + ' center/cover no-repeat, ' + g : g; }
var RAR = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', secret: 'Secret' };
function profFmt(v, f) {
  v = Number(v) || 0;
  if (f === 'time') { var m = Math.floor(v / 60), s = v - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); }
  if (f === 'dur') { var h = Math.floor(v / 3600), mm = Math.floor(v % 3600 / 60); return h ? h + 'h ' + mm + 'm' : mm + 'm'; }
  if (f === 'money') return '$' + Math.round(v).toLocaleString();
  if (f === 'big') {      // a million and up: 12.34 M / B / T / Qa / Qi / Sx / Sp / Oc / No / Dc, then 1.23e45
    if (v < 1e6) return Math.round(v).toLocaleString();
    var names = ['M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'], i = Math.floor(Math.log10(v) / 3) - 2;
    if (i >= names.length) return v.toExponential(2).replace('e+', 'e');
    return (v / Math.pow(10, (i + 2) * 3)).toFixed(2) + ' ' + names[i];
  }
  return Math.round(v).toLocaleString();
}
// (an admin has everything, except the titles that are won by playing: everyone earns those)
function profOwns(e, it) { return !!(e && (it.custom || it.free || (e.dev && !it.ra) || e.owned.indexOf(it.id) >= 0 || e.earned.indexOf(it.id) >= 0)); }
function profRender() {
  var box = document.getElementById('view-prof'); if (!box || box.hidden) return;
  var L = window.HGGrapevine, me = L && L.me(), e = L && L.eco.state(), c = L && L.eco.catalog();
  if (!me) { box.innerHTML = '<div class="pempty">Sign in to have a profile.</div>'; return; }
  if (!e || !c) { box.innerHTML = '<div class="pempty">Loading your profile...</div>'; if (L) L.eco.refresh(true); return; }
  var eq = e.equip || {}, title = profItem(eq.title);
  var mine = L.eco.cos([me.userId])[me.userId] || {}, ranks = Object.keys(mine.ranks || {}).sort(function (a, b) { return mine.ranks[a] - mine.ranks[b]; });
  var h = '<div class="phead" style="background:' + (profBannerCss(eq.banner) || 'linear-gradient(120deg,#1b2440,#2a1b40)') + '">' +
    cosPet(cosFrame(profPfp(eq.pfp, 84), eq.frame), eq.pet, 84) + '<div class="pwho"><div class="pnm">' + profEsc(me.name) + '</div>' +
    (title ? cosTitle(title) : '<span class="ptag dim">no title yet</span>') +
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
var SLOTS = [['pfp', 'Pictures'], ['frame', 'Picture frames'], ['pet', 'Sidekicks'], ['bubble', 'Chat bubbles'], ['banner', 'Banners'], ['title', 'Titles'], ['skin', 'Blocky skins'], ['avatar', 'Blocky avatars'], ['music', 'Music'], ['perk', 'Extras']];
function profItems(e, c, shop) {
  var eq = e.equip || {}, buys = window.HGGrapevine.eco.buys();
  var list = c.items.filter(function (i) { return i.k === PROF.cat && (shop ? i.p > 0 && !profOwns(e, i) || (shop && i.p > 0 && e.dev) : profOwns(e, i) || i.x); });
  if (!shop && PROF.cat === 'title') Object.keys(e.ctitles || {}).forEach(function (id) { list.unshift(profItem(id)); });      // custom titles from a developer
  var groups = []; list.forEach(function (i) { var g = profSect(i.g); if (groups.indexOf(g) < 0) groups.push(g); });
  if (PROF.grp && groups.indexOf(PROF.grp) < 0) PROF.grp = '';
  var h = '<div class="pcats">' + SLOTS.map(function (s) { return '<button data-pcat="' + s[0] + '" class="' + (PROF.cat === s[0] ? 'on' : '') + '">' + s[1] + '</button>'; }).join('') + '</div>';
  if (groups.length > 1) h += '<div class="pgrps"><button data-pgrp="" class="' + (!PROF.grp ? 'on' : '') + '">All</button>' + groups.map(function (g) { return '<button data-pgrp="' + profEsc(g) + '" class="' + (PROF.grp === g ? 'on' : '') + '">' + profEsc(g || 'Other') + '</button>'; }).join('') + '</div>';
  if (PROF.grp) list = list.filter(function (i) { return profSect(i.g) === PROF.grp; });
  if (PROF.cat === 'music' && !shop) h += '<div class="pnote">The track you wear plays on the launcher (never over a game). <button class="pb" data-mtoggle="1">' + (window.HG_music && localStorage.getItem('hgv:music') === 'off' ? 'Music is off: turn on' : 'Music is on: turn off') + '</button></div>';
  if (PROF.cat === 'perk') return h + profExtras(e, c, shop);
  if (!list.length) return h + '<div class="pempty">' + (shop ? 'You own everything here. Nice.' : 'Nothing here yet: the Goon Shop has plenty.') + '</div>';
  // one grid per group, with the game's name over its pictures ("Games: Last Light" -> "Last Light")
  var blocks = [], at = {};
  list.forEach(function (i) { var g = i.g || ''; if (!(g in at)) { at[g] = blocks.length; blocks.push({ g: g, items: [] }); } blocks[at[g]].items.push(i); });
  var card = function (i) {
    var own = profOwns(e, i), on = eq[i.k] === i.id, locked = !own && i.x;
    var prev = i.k === 'pfp' ? profPfp(i.id, 54) : i.k === 'banner' ? '<span class="pban" style="background:' + profBannerCss(i.id) + '"></span>'
      : i.k === 'title' ? cosTitle(i, true)
      : i.k === 'bubble' ? '<span class="pncs">' + cosBubble(i, 'Hello there!') + '</span>'
      : i.k === 'pet' ? cosPet(profPfp(eq.pfp, 46), i.id, 46)
      : i.k === 'frame' ? cosFrame(profPfp(eq.pfp, 46), i.id)
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
// Extras: things to do with goons that are not something to wear
function profExtras(e, c, shop) {
  var P = c.prices || { crate: 6, giftMax: 20 }, L = window.HGGrapevine, friends = []; try { friends = (L.friends().friends || []).map(function (f) { return f.name; }); } catch (x) {}
  var left = c.items.filter(function (i) { return i.p > 0 && i.k !== 'perk' && !profOwns(e, i); }).length;
  return '<div class="pextras">' +
    '<div class="pex"><span class="pexi">&#127873;</span><div><b>Mystery crate</b><p>One random thing from the shop that you do not own yet. Rare things are rarer: about 1 in 30 is legendary. ' + left + ' thing' + (left === 1 ? '' : 's') + ' left for you to find.</p>' +
      '<button class="pb buy" data-pex="crate"' + (left ? '' : ' disabled') + '>Open a crate (' + P.crate + ' goons)</button></div></div>' +
    '<div class="pex"><span class="pexi">&#128157;</span><div><b>Give goons to a friend</b><p>A present for a friend, up to ' + P.giftMax + ' goons a day.</p>' +
      (friends.length ? '<div class="prow"><select id="px-friend">' + friends.map(function (n) { return '<option>' + profEsc(n) + '</option>'; }).join('') + '</select><input id="px-n" type="number" min="1" max="' + P.giftMax + '" value="1" style="width:76px"><button class="pb" data-pex="gift">Give</button></div>' : '<p class="pnote">Add a friend in Grapevine first.</p>') + '</div></div>' +
    '<div class="pex"><span class="pexi">&#127920;</span><div><b>The casino</b><p>Swap goons for chips (1 goon = 100 chips) and play slots, blackjack, roulette and more, or sit at a live table with everyone. Goons are play money: they are not worth anything outside Huntington Games.</p>' +
      '<button class="pb" data-pex="casino">Open the casino</button></div></div></div>';
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
function profLoadBoard(k, quiet) {
  PROF.lbAt = Date.now();
  window.HGGrapevine.eco.lbGet(k).then(function (m) {
    if (m.board !== PROF.lbBoard) return;
    var same = quiet && PROF.lbData && JSON.stringify(PROF.lbData.rows) === JSON.stringify(m.rows);
    PROF.lbData = m; PROF.lbErr = ''; if (!same) { profRender(); lbRender(); }
  }, function (e) { if (!quiet) { PROF.lbErr = k; lbRender(); profRender(); } });
}
// keep an open board fresh: when the server took new scores of ours, when the tab is opened, and every 45 s while it shows
function lbRefresh(boards) {
  if (!PROF.lbBoard || !window.HGGrapevine || !window.HGGrapevine.online()) return;
  var box = document.getElementById('view-lb'), showing = (box && !box.hidden) || (document.getElementById('view-prof') && !document.getElementById('view-prof').hidden && PROF.tab === 'lb');
  if (!showing) { if (!boards || boards.indexOf(PROF.lbBoard) >= 0) PROF.lbData = null, PROF.lbAsked = ''; return; }
  if (boards && boards.indexOf(PROF.lbBoard) < 0) return;
  profLoadBoard(PROF.lbBoard, true);
}
setInterval(function () { if (!document.hidden && Date.now() - (PROF.lbAt || 0) > 44000) lbRefresh(); }, 15000);
// the Leaderboards tab, laid out: games down the side, the game's main boards as tabs (single levels tucked in a picker),
// a podium for the top three, your own place, then everyone else
function lbView(c) {
  var games = [], count = {};
  Object.keys(c.boards).forEach(function (k) { var g = c.boards[k].g; if (/^hub:/.test(k)) g = 'Huntington Games'; if (games.indexOf(g) < 0) games.push(g); count[g] = (count[g] || 0) + 1; });
  games.sort(function (a, b) { return a === 'Huntington Games' ? -1 : b === 'Huntington Games' ? 1 : a.localeCompare(b); });
  if (games.indexOf(PROF.lbGame) < 0) PROF.lbGame = games[0];
  var gOf = function (k) { return /^hub:/.test(k) ? 'Huntington Games' : c.boards[k].g; };
  var keys = Object.keys(c.boards).filter(function (k) { return gOf(k) === PROF.lbGame; });
  var main = keys.filter(function (k) { return !/^lumi:lv/.test(k); }), levels = keys.filter(function (k) { return /^lumi:lv/.test(k); });
  if (keys.indexOf(PROF.lbBoard) < 0) PROF.lbBoard = main[0] || keys[0];
  var side = '<div class="lbside">' + games.map(function (g) { return '<button data-lbg="' + profEsc(g) + '" class="' + (PROF.lbGame === g ? 'on' : '') + '"><b>' + profEsc(g) + '</b><span>' + count[g] + ' board' + (count[g] === 1 ? '' : 's') + '</span></button>'; }).join('') + '</div>';
  var h = '<div class="lbmain"><div class="lbtitle"><h2>' + profEsc(PROF.lbGame) + '</h2><span class="pnote">R1 = top 2% · R2 top 10% · R3 top 25% · R4 top half · R5 everyone else. First place is the Record Holder.</span></div>';
  h += '<div class="lbtabs">' + main.map(function (k) { return '<button data-lbb="' + k + '" class="' + (PROF.lbBoard === k ? 'on' : '') + '">' + profEsc(c.boards[k].n) + '</button>'; }).join('') +
    (levels.length ? '<select id="lb-level" class="' + (/^lumi:lv/.test(PROF.lbBoard) ? 'on' : '') + '"><option value="">Single level...</option>' + levels.map(function (k) { return '<option value="' + k + '"' + (PROF.lbBoard === k ? ' selected' : '') + '>' + profEsc(c.boards[k].n) + '</option>'; }).join('') + '</select>' : '') + '</div>';
  if (/^lumi:lv/.test(PROF.lbBoard)) h += '<div class="pnote">Single-level boards are just for fun: they give no tag or rank.</div>';
  var d = PROF.lbData && PROF.lbData.board === PROF.lbBoard ? PROF.lbData : null;
  if (!d) {
    if (PROF.lbErr === PROF.lbBoard) return '<div class="lbwrap">' + side + h + '<div class="pempty">Could not load this board (no answer from the server). <button class="mbtn" data-lbretry="1">Try again</button></div></div></div>';
    if (PROF.lbAsked !== PROF.lbBoard) { PROF.lbAsked = PROF.lbBoard; profLoadBoard(PROF.lbBoard); }
    return '<div class="lbwrap">' + side + h + '<div class="pempty">Loading...</div></div></div>';
  }
  var def = d.def || c.boards[PROF.lbBoard], L = window.HGGrapevine;
  if (!d.rows.length) return '<div class="lbwrap">' + side + h + '<div class="pempty">Nobody on this board yet. Be the first!</div></div></div>';
  L.eco.cos(d.rows.slice(0, 60).map(function (r) { return r.u; }));
  var cosOfU = function (u) { return L.eco.cos([])[u] || {}; };
  var how = function (r) { return r.d ? Object.keys(r.d).slice(0, 4).map(function (k) { var v = r.d[k]; return profEsc(k) + ': ' + profEsc(typeof v === 'number' ? profFmt(v, v >= 1e6 ? 'big' : 'int') : v); }).join(', ') : ''; };
  var top = d.rows.slice(0, 3), order = [1, 0, 2];
  h += '<div class="lbpod">' + order.filter(function (i) { return top[i]; }).map(function (i) { var r = top[i], cs = cosOfU(r.u);
    return '<div class="lbp p' + (i + 1) + (r.me ? ' me' : '') + '"><div class="lbm">' + ['👑', '🥈', '🥉'][i] + '</div>' + cosPet(cosFrame(profPfp(cs.p, i ? 46 : 60, cs.img), cs.fr), cs.pt, i ? 46 : 60) + '<b>' + profEsc(r.n) + '</b><span class="lbs">' + profFmt(r.s, def.f) + '</span>' + (how(r) ? '<small>' + how(r) + '</small>' : '') + '<div class="lbstep"></div></div>'; }).join('') + '</div>';
  h += '<div class="lbme">' + (d.me ? 'You: <b>#' + d.me.pos + '</b> of ' + d.n + ' · ' + profFmt(d.me.s, def.f) + ' · <span class="ptag rank t' + d.me.tier + '">R' + d.me.tier + '</span>' : 'You are not on this board yet: play to get on it.') + ' <span class="dimtxt">' + d.n + ' on this board</span> <button class="lbre" data-lbretry="1" title="Refresh this board">⟳ Refresh</button>' +
    (d.rows.length > 6 ? '<input id="lb-find" class="lbfind" type="search" placeholder="Find a player..." autocomplete="off" spellcheck="false">' : '') + '</div>';
  var rest = d.rows.slice(3);
  if (rest.length) h += '<table class="plb"><tr><th>#</th><th>Player</th><th>' + profEsc(def.lo ? 'Time' : 'Score') + '</th><th>Rank</th><th>How</th><th>When</th></tr>' + rest.map(function (r) { var cs = cosOfU(r.u);
    return '<tr class="' + (r.me ? 'me' : '') + '"><td>' + r.pos + '</td><td>' + profPfp(cs.p, 22, cs.img) + ' ' + profEsc(r.n) + '</td><td><b>' + profFmt(r.s, def.f) + '</b></td><td><span class="ptag rank t' + r.tier + '">R' + r.tier + '</span></td><td class="how">' + how(r) + '</td><td class="when">' + new Date(r.at).toLocaleDateString() + '</td></tr>'; }).join('') + '</table>';
  return '<div class="lbwrap">' + side + h + '</div></div>';
}
document.addEventListener('click', function (e) {
  var b = e.target && e.target.closest && e.target.closest('[data-lbretry]'); if (!b) return;
  PROF.lbErr = ''; if (typeof feedNow === 'function') feedNow();
  if (PROF.lbData && PROF.lbData.board === PROF.lbBoard) profLoadBoard(PROF.lbBoard, false); else { PROF.lbAsked = ''; lbRender(); profRender(); }
});
document.addEventListener('change', function (e) { if (e.target && e.target.id === 'lb-level' && e.target.value) { PROF.lbBoard = e.target.value; PROF.lbData = null; lbRender(); } });
// the Leaderboards tab: every game's boards (the same boards the Profile used to show)
function lbRender() {
  var box = document.getElementById('view-lb'); if (!box || box.hidden) return;
  var L = window.HGGrapevine, c = L && L.me() && L.eco && L.eco.catalog();
  if (!c) { box.innerHTML = '<div class="pempty">' + (L && L.me() ? 'Loading the leaderboards...' : 'Sign in to see the leaderboards.') + '</div>'; return; }
  var had = document.activeElement && document.activeElement.id === 'lb-find';
  box.innerHTML = lbView(c);
  var f = document.getElementById('lb-find'); if (f && PROF.lbFind) { f.value = PROF.lbFind; lbFindApply(); } if (f && had) { f.focus(); try { f.setSelectionRange(f.value.length, f.value.length); } catch (e) {} }
}
// "Find a player": hide the rows that do not match (the podium stays)
function lbFindApply() {
  var q = String(PROF.lbFind || '').trim().toLowerCase();
  [].forEach.call(document.querySelectorAll('#view-lb .plb tr'), function (tr, i) { if (!i) return; var td = tr.children[1]; tr.hidden = !!q && !(td && td.textContent.toLowerCase().indexOf(q) >= 0); });
  [].forEach.call(document.querySelectorAll('#view-lb .lbp'), function (p) { var b = p.querySelector('b'); p.classList.toggle('dim', !!q && !(b && b.textContent.toLowerCase().indexOf(q) >= 0)); });
}
document.addEventListener('input', function (e) { if (e.target && e.target.id === 'lb-find') { PROF.lbFind = e.target.value; lbFindApply(); } });
function profEarn(e) {
  var rows = [['📅', 'Open the launcher every day', '1 goon a day, 3 on every 7th day in a row' + (e.streak ? ' (you: ' + e.streak + ' in a row)' : '')], ['🏆', 'Every achievement', '1 goon each (the Account tab lists them all)'], ['🌊', 'Clear 15 waves in Blocky Shooter', '1 goon'],
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
    '<h4>Give a custom title</h4><p class="pnote">Any words you like (2 to 24 characters), for one person. They wear it like any other title.</p>' +
    '<div class="prow"><input id="pa-ctext" maxlength="24" placeholder="e.g. Pizza Lord" autocomplete="off"><button class="pb" data-padm="custom">Give custom title</button></div>' +
    '<h4>Give goons</h4><div class="prow"><input id="pa-n" type="number" min="-100" max="500" value="5" style="width:90px"><button class="pb" data-padm="goons">Give goons</button></div>' +
    '<h4>Look up an account</h4><p class="pnote">For "I lost everything": their goons, saves and leaderboard places, and any copies the server kept of saves that lost progress (it keeps one per game since r69).</p>' +
    '<div class="prow"><input id="pa-look" maxlength="40" placeholder="Their exact name" autocomplete="off"><button class="pb" data-padm="look">Look up</button></div><div id="pa-lookout" class="pnote" style="white-space:pre-wrap;margin:6px 0 0"></div>' +
    '<h4>Database use</h4><p class="pnote">How much data the database has sent the server since it last started (the free plan allows 5 GB a month, about 7 MB an hour).</p>' +
    '<div class="prow"><button class="pb" data-padm="dbout">Check now</button></div><pre id="pa-dbout" class="pnote" style="white-space:pre-wrap;margin:6px 0 0"></pre></div>';
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
  else if (d.pex) {
    if (d.pex === 'crate') { if (confirm('Open a mystery crate?')) L.eco.crate(); }
    else if (d.pex === 'gift') { var fn = document.getElementById('px-friend').value, gn = Math.floor(+document.getElementById('px-n').value || 0); if (gn < 1) return; if (confirm('Give ' + gn + ' goon' + (gn === 1 ? '' : 's') + ' to ' + fn + '?')) L.eco.gift(fn, gn); }
    else if (d.pex === 'casino') { var cg = GAMES.filter(function (g) { return g.dir === 'Casino'; })[0]; if (cg) { homeRecent(cg); play(cg); } }
    return;
  }
  else if (d.padm === 'rebuild' || d.padm === 'rebuild-go') {
    var rn = (document.getElementById('pa-look').value || '').trim(), ro = document.getElementById('pa-lookout');
    if (!PROF.look || PROF.look.name.toLowerCase() !== rn.toLowerCase()) { hubToast('Look them up first.'); return; }
    if (d.padm === 'rebuild-go' && !confirm('Write the rebuilt saves into ' + PROF.look.name + "'s account?")) return;
    rbRun(rn, PROF.look, ro, d.padm === 'rebuild-go');
    return;
  }
  else if (d.padm === 'look' || d.padm === 'restore') {
    var ln = (document.getElementById('pa-look').value || '').trim(), lo = document.getElementById('pa-lookout'); if (!ln) { hubToast('Type their name first.'); return; }
    if (d.padm === 'restore' && !confirm('Put back every kept copy for ' + ln + '? Their current saves of those games are replaced (each one had less progress).')) return;
    lo.textContent = 'Asking...';
    var show = function (r) {
      if (!r.ok) { lo.textContent = r.err || 'Could not look that up.'; return; }
      if (r.saves) PROF.look = r;
      if (r.restored != null) { lo.textContent = 'Put back ' + r.restored + ' save(s) for ' + r.name + '. They load on their device within a minute (or when they close the game).'; return; }
      var when = function (t) { return t ? new Date(t).toLocaleString() : '?'; };
      lo.innerHTML = '<b>' + profEsc(r.name) + '</b> \u00b7 last seen ' + profEsc(when(r.lastSeen)) + '<br>' + profFmt(r.goons, 'int') + ' goons, ' + profFmt(r.chips, 'int') + ' chips, ' + r.owned + ' shop items, ' + r.earned + ' earned<br>' +
        r.saves.length + ' saves (' + Math.round(r.saves.reduce(function (t, x) { return t + (x.bytes || 0); }, 0) / 1024) + ' KB), newest ' + profEsc(when(Math.max.apply(null, r.saves.map(function (x) { return x.at; }).concat([0])))) + '<br>' +
        'On ' + r.boards.length + ' leaderboards' + (r.boards.length ? ': ' + r.boards.slice(0, 12).map(function (b) { return profEsc(b.key) + ' #' + b.pos + ' (' + profFmt(b.s, 'int') + ')'; }).join(', ') : '') + '<br>' +
        '<button class="pb" data-padm="rebuild">Rebuild from leaderboards</button><br>' +
        (r.backups.length ? r.backups.length + ' kept copies: ' + r.backups.map(function (b) { return profEsc(b.k) + ' (' + profEsc(when(b.at)) + ')'; }).join(', ') + '<br><button class="pb" data-padm="restore">Put back the kept copies</button>' : 'No kept copies.') +
        (r.log && r.log.length ? '<br>Recent goons: ' + r.log.map(function (l) { return (l.n > 0 ? '+' : '') + l.n + ' ' + profEsc(l.why); }).join('; ') : '');
    };
    (d.padm === 'look' ? L.eco.acctLook(ln) : L.eco.savesRestore(ln)).then(show, function (e) { lo.textContent = String(e && e.message || e); });
    return;
  }
  else if (d.padm === 'dbout') {
    var out = document.getElementById('pa-dbout'); out.textContent = 'Asking...';
    L.eco.dbOut().then(function (r) {
      out.textContent = r.mbPerHour + ' MB an hour over the last ' + r.hours + ' hours (' + (r.mbPerHour * 24 * 30 / 1024).toFixed(1) + ' GB a month at this rate), ' + r.sessions + ' people on now.\n' +
        (r.top || []).map(function (t) { return t.kb + ' KB  ' + t.calls + 'x  ' + t.q; }).join('\n');
    }, function (e) { out.textContent = String(e && e.message || e); });
    return;
  }
  else if (d.padm) {
    var nm = (document.getElementById('pa-name').value || '').trim(); if (!nm) { hubToast('Type their name first.'); return; }
    if (d.padm === 'custom') { var ct = (document.getElementById('pa-ctext').value || '').trim(); if (ct.length < 2) { hubToast('Type the title first (2 to 24 characters).'); return; } L.eco.admin('custom', nm, null, 0, ct); hubToast('Gave the title "' + ct + '" to ' + nm + '.'); return; }
    if (d.padm === 'goons') { var n = Math.round(+document.getElementById('pa-n').value || 0); if (!n) return; L.eco.admin('goons', nm, null, n); hubToast('Sent ' + n + ' goons to ' + nm + '.'); return; }
    var t = document.getElementById('pa-title').value, it = profItem(t);
    L.eco.admin(d.padm, nm, t); hubToast((d.padm === 'give' ? 'Gave ' : 'Took back ') + (it ? it.n : t) + (d.padm === 'give' ? ' to ' : ' from ') + nm + '.'); return;
  }
  else return;
  profRender(); lbRender();
});
function profMount() {
  var L = window.HGGrapevine; if (!L || profMount.done) return; profMount.done = true;
  L.on('eco', function (m) {
    profRender(); lbRender(); paintChip(); if (!m) return;
    if (m.bought) { var it = profItem(m.bought); if (it) hubToast('Bought ' + it.n + '!'); }
    if (m.crate) { var ci = profItem0(m.crate); if (ci) { PROF.tab = 'locker'; PROF.cat = ci.k; PROF.grp = ''; profRender(); hubToast('The crate had: ' + ci.n + ' (' + (RAR[ci.r] || ci.r) + ')! It is in your Locker.'); } }
    if (m.gifted) hubToast('Gave ' + m.gifted.n + ' goon' + (m.gifted.n === 1 ? '' : 's') + ' to ' + m.gifted.to + '.');
  });
  L.on('cos', function () { if (PROF.tab === 'lb') profRender(); });
  L.on('ecoError', function (m) { hubToast(m.text || 'That did not work.'); });
}
function hubToast(t) { var el = document.createElement('div'); el.className = 'htoast'; el.textContent = t; document.body.appendChild(el); setTimeout(function () { el.remove(); }, 3200); }
