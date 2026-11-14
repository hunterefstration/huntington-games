
// ===== What the server is told, so goons and leaderboards follow your play =====
// - playtime: once a minute while a game is open AND you touched it (key, click, tap) in that minute
// - claims: unlocked achievements (gv/ach.js keeps them in 'hgach:v1'), Blocky waves cleared and ranks gained
// - leaderboards: each game's best numbers, read from its own save (games do not have to report anything)
// The server checks and caps every claim; this only says what happened.
var FEED = { lastInput: 0, sent: {}, left: {}, uid: '' };
try { localStorage.removeItem('hgv:lbsent'); localStorage.removeItem('hgv:claimed'); } catch (e) {}      // (the old per-device memory: it made a second account, or a refused frame, never send)
function feedRd(k) { try { var v = localStorage.getItem(k); if (v == null) return null; try { return JSON.parse(v); } catch (e) { return v; } } catch (e) { return null; } }
function feedNum(v) { v = Number(v); return isFinite(v) ? v : 0; }
// you are playing when you press, click or tap in the game (its page is ours, so we can listen to it)
function feedWatch() {
  var f = document.getElementById('frame'); if (!f) return;
  var mark = function () { FEED.lastInput = Date.now(); };
  try {
    var w = f.contentWindow; if (!w || w.__hgFeed) return; w.__hgFeed = 1;
    ['keydown', 'pointerdown', 'touchstart', 'wheel'].forEach(function (t) { w.addEventListener(t, mark, { passive: true, capture: true }); });
    var mm = 0; w.addEventListener('mousemove', function () { if (++mm % 20 === 0) mark(); }, { passive: true, capture: true });
  } catch (e) {}
}
setInterval(function () {
  var L = window.HGGrapevine; if (!L || !L.me() || !L.online()) return;
  if (typeof current !== 'undefined' && current && current.game) {
    feedWatch();
    if (!document.hidden && Date.now() - FEED.lastInput < 65000) L.eco.play(current.game.name, true);
  }
}, 60000);
function clickerTotal(key) {
  var b = feedRd(key) || {}, s = b.state || {}, l = b.life || {}, r = b.run || {}, m = b.meta || {};
  return [Math.max(feedNum(l.earned), feedNum(r.earned), feedNum(s.brownEs)), { ascensions: feedNum(m.ascensions) }];
}
// Blocky Shooter: total XP over every prestige (rank r needs 600 + 200r XP; 50 ranks)
function blockyXP(l) { var per = 0; for (var r = 1; r < 50; r++) per += 600 + 200 * r; return feedNum(l.prestige) * per + feedNum(l.xp); }
function blockyRanks(l) { var x = feedNum(l.xp), r = 1; while (r < 50 && x >= 600 + 200 * r) { x -= 600 + 200 * r; r++; } return feedNum(l.prestige) * 49 + (r - 1); }
// board -> [value, details] from the saves (0 / nothing = not on the board yet)
var LB_FEED = [
  ['spikes:level', function () { var s = feedRd('spikes100_progress') || {}; return [feedNum(s.unlocked)]; }],
  ['spikes:onelife', function () { var s = feedRd('spikes100_progress') || {}; return [feedNum(s.bestOneLife)]; }],
  ['spikes:endless', function () { var s = feedRd('spikes100_progress') || {}; return [feedNum(s.bestEndless)]; }],
  // Tetris Surge keeps its top 5 per mode in best[mode] = [{ s: score, l: lines, t: ms, ... }] (sprint is sorted by time)
  ['tetris:score', function () { var t = feedRd('huntingtonTetrisSurge1') || {}, b = 0, m = '', bl = 0; for (var k in (t.best || {})) if (k !== 'sprint') (Array.isArray(t.best[k]) ? t.best[k] : []).forEach(function (e) { if (e && feedNum(e.s) > b) { b = feedNum(e.s); m = k; bl = feedNum(e.l); } }); b = Math.max(b, feedNum(feedRd('tetrisHighScore'))); return [b, m ? { mode: m, lines: bl } : null]; }],
  ['tetris:lines', function () { var st = (feedRd('huntingtonTetrisSurge1') || {}).stats || {}; return [feedNum(st.lines), { tetrises: feedNum(st.tetrises), games: feedNum(st.games) }]; }],
  ['tetris:floor', function () { var st = (feedRd('huntingtonTetrisSurge1') || {}).stats || {}; return [feedNum(st.bestFloor), { bosses: feedNum(st.bosses) }]; }],
  ['tetris:sprint', function () { var a = ((feedRd('huntingtonTetrisSurge1') || {}).best || {}).sprint, b = 0; (Array.isArray(a) ? a : []).forEach(function (e) { var t = e && feedNum(e.t) / 1000; if (t >= 1 && (!b || t < b)) b = t; }); return [b ? +b.toFixed(2) : 0]; }],
  // Brown E Clicker: every E ever made is life.earned (the balance in state.brownEs goes down when you spend or ascend).
  // Three auto-clicker strikes (the game's own guard, 'brownEClicker_ac') take you off its boards.
  ['clicker:total', function () { if (feedNum(feedRd('brownEClicker_ac')) >= 3) return [0, null, 'leave']; return clickerTotal('brownEClickerSave'); }],
  ['clicker:asc', function () { if (feedNum(feedRd('brownEClicker_ac')) >= 3) return [0, null, 'leave']; return [feedNum(((feedRd('brownEClickerSave') || {}).meta || {}).ascensions)]; }],
  ['clicker:rb', function () { if (feedNum(feedRd('brownEClicker_ac')) >= 3) return [0, null, 'leave']; return clickerTotal('brownEClickerSave_rb'); }],
  ['coffee:best', function () { var s = (feedRd('beanBrewSaveV2') || {}).stats || {}; return [feedNum(s.earned), { served: feedNum(s.served) }]; }],
  ['market:worth', function () { if (feedNum(feedRd('marketLife_ac')) >= 3) return [0, null, 'leave']; return [feedNum(feedRd('netWorthPB'))]; }],      // (3 autoclicker strikes: off the board)
  ['market:score', function () { if (feedNum(feedRd('marketLife_ac')) >= 3) return [0, null, 'leave']; return [Math.floor(feedNum(feedRd('lifeScorePB')))]; }],
  ['td:endless', function () { var t = feedRd('td2_records') || {}; return [feedNum(t.bestEndless), { kills: feedNum(t.kills) }]; }],
  ['td:best', function () { var t = feedRd('td2_records') || {}; return [feedNum(t.best), { games: feedNum(t.games) }]; }],
  ['mayhem:crowns', function () { var s = (feedRd('mayhem_save') || {}).stats || {}; return [feedNum(s.crowns), { shows: feedNum(s.shows) }]; }],
  ['mayhem:qualified', function () { var s = (feedRd('mayhem_save') || {}).stats || {}; return [feedNum(s.qualified), { shows: feedNum(s.shows) }]; }],
  ['steel:wins', function () { var s = (feedRd('steelstorm_save') || {}).stats || {}; return [feedNum(s.wins), { matches: feedNum(s.matches) }]; }],
  ['steel:kills', function () { var s = (feedRd('steelstorm_save') || {}).stats || {}; return [feedNum(s.kills), { deaths: feedNum(s.deaths) }]; }],
  ['frontline:wins', function () { var f = feedRd('frontline_profile_v2') || {}; return [feedNum(f.wins), { kills: feedNum(f.kills), online: feedNum(f.mpWins) }]; }],
  ['sov:best', function () { var s = feedRd('sov.hgach') || {}; return [feedNum(s.conquered), { wars: feedNum(s.warsWon), years: feedNum(s.years) }]; }],
  ['neon:best', function () { var a = feedRd('neonScores') || [], b = 0; (Array.isArray(a) ? a : []).forEach(function (x) { var v = feedNum(x && x.val); if (v < 100000) b = Math.max(b, v); }); return [b]; }],      // (Legend mode's 100 quadrillion never counts)
  ['blocky:xp', function () { var l = feedRd('blocky21_life') || {}; return [blockyXP(l), { prestige: feedNum(l.prestige), kills: feedNum(l.kills) }]; }],
  ['blocky:wave', function () { var l = feedRd('blocky21_life') || {}, b = 0, k = ''; for (var x in (l.best || {})) if (feedNum(l.best[x]) > b) { b = feedNum(l.best[x]); k = x; } return [b, k ? { mode: k } : null]; }],
  ['blocky:kills', function () { var l = feedRd('blocky21_life') || {}; return [feedNum(l.kills), { headshots: feedNum(l.headshots) }]; }],
  ['blocky:classes', function () { var l = feedRd('blocky21_life') || {}; return [Math.min(240, feedNum(l.clsTotal)), null]; }],      // (5.4: the sum of the 8 class levels)
  ['elementlab:ch', function () { var d = feedRd('elementlab_challenges') || {}; return [Object.keys(d).length]; }],
  ['imposter:wins', function () { var s = feedRd('imposter_save') || {}, st = s.stats || s; return [feedNum(st.wins) || (feedNum(st.crewWins) + feedNum(st.impWins))]; }],
  // Last Light: every level's best time, and the full game = all of them added up (only once all 17 are done)
  ['lumi:*', function () {
    var lv = (feedRd('lumi_save') || {}).levels || {}, out = [], ids = [], sum = 0;
    for (var w = 1; w <= 4; w++) for (var n = 1; n <= 10; n++) ids.push(w + '-' + n); ids.push('5-1');      // (Last Light 1.2: 10 levels a world)
    ids.forEach(function (id) { var b = lv[id] && feedNum(lv[id].best); if (b > 0) { out.push(['lumi:lv' + id, b]); sum += b; } });
    if (out.length === ids.length) out.push(['lumi:full', +sum.toFixed(2), { levels: 41 }]);
    var lr = feedRd('lumi_save') || {};
    if (lr.runs && feedNum(lr.runs.onelife) > 0) out.push(['lumi:onelife', feedNum(lr.runs.onelife)]);
    var fl = 0; for (var k in lv) if (lv[k] && lv[k].perfect === true) fl++;
    if (fl > 0) out.push(['lumi:flawless', Math.min(fl, 41), { of: 41 }]);
    return out;
  }]
];
// Scores go up in one frame (lbBatch) and the server answers with what it holds, so nothing is "sent" until the server
// has it. What was sent is remembered per account and only for this visit: a launcher that opens sends everything once
// (the server keeps the better number), which also repairs a board the server lost or refused before.
function feedBoards() {
  var out = [], leave = [];
  LB_FEED.forEach(function (x) {
    try {
      var r = x[1]();
      if (x[0] === 'lumi:*') r.forEach(function (y) { out.push([y[0], y[1], y[2]]); });
      else if (r[2] === 'leave') leave.push(x[0]);
      else out.push([x[0], r[0], r[1]]);
    } catch (e) {}
  });
  return { out: out, leave: leave };
}
function feedNow() {
  var L = window.HGGrapevine; if (!L || !L.me() || !L.online() || !L.eco) return;
  var uid = L.me().userId || L.me().name; if (FEED.uid !== uid) { FEED.uid = uid; FEED.sent = {}; FEED.left = {}; }
  var f = feedBoards(), items = [];
  f.out.forEach(function (y) { var v = y[1]; if (!(v > 0) || !isFinite(v) || FEED.sent[y[0]] === v) return; items.push({ b: y[0], s: v, d: y[2] || null }); });
  f.leave.forEach(function (b) { if (!FEED.left[b]) { FEED.left[b] = 1; L.eco.lbLeave(b); } });
  if (items.length) L.eco.lbBatch(items).then(function (m) {
    items.forEach(function (it) { FEED.sent[it.b] = it.s; });
    if (typeof lbRefresh === 'function') lbRefresh(Object.keys((m && m.best) || {}));
  }, function () {      // a server from before lbBatch never answers it: send them one by one, as before
    if (FEED.uid === uid && L.online()) items.forEach(function (it) { FEED.sent[it.b] = it.s; L.eco.lbSubmit(it.b, it.s, it.d); });
  });
  // goon claims: exactly the achievements the server does not have yet (it tells us which it has)
  var got = feedRd('hgach:v1') || {}, e = L.eco.state() || {}, has = {}, n = 0;
  if (Array.isArray(e.achIds)) e.achIds.forEach(function (id) { has[id] = 1; });
  else { try { has = JSON.parse(localStorage.getItem('hgv:claimed:' + uid) || '{}'); } catch (x) { has = {}; } }
  FEED.claimed = FEED.claimed || {};
  for (var id in got) if (!has[id] && !FEED.claimed[id] && n < 60) { L.eco.claim('ach', id); FEED.claimed[id] = 1; has[id] = 1; n++; }
  if (!Array.isArray(e.achIds)) { try { localStorage.setItem('hgv:claimed:' + uid, JSON.stringify(has)); } catch (x) {} }
  var bl = feedRd('blocky21_life');
  if (bl) {
    var wv = feedNum(bl.waves), rk = blockyRanks(bl);
    if (wv > 0 && FEED.waves !== wv) { FEED.waves = wv; L.eco.claim('waves', null, wv); }
    if (rk > 0 && FEED.rank !== rk) { FEED.rank = rk; L.eco.claim('rank', null, rk); }
  }
}
setInterval(feedNow, 120000);
function feedMount() {
  var L = window.HGGrapevine; if (!L || feedMount.done) return; feedMount.done = true;
  L.on('eco', function () {
    if (!FEED.first) { FEED.first = 1; setTimeout(feedNow, 1500); }
    var e = L.eco.state(); if (e && !e.checkedIn && !FEED.daily) { FEED.daily = 1; L.eco.claim('daily'); }      // the daily check-in goon (once a day, the server decides)
  });
  // the wheel, for the launcher's own chats (the hub rooms): the server spins it and may ban
  L.on('spin', function (m) { if (!document.querySelector('#gvapp') || document.getElementById('view-chat').hidden) hubWheel(m); });
}
function hubWheel(m) {
  var old = document.getElementById('hwheel'); if (old) old.remove();
  var w = document.createElement('div'); w.id = 'hwheel'; var labels = ['BAN', 'SAFE', 'SAFE', 'SAFE', 'SAFE'];
  w.innerHTML = '<div class="wcard"><h2>You said the word.</h2><p>Spin the wheel. One slot in five bans you for good.</p><div class="wwrap"><div class="wptr">&#9660;</div><div class="wdisc">' +
    labels.map(function (l, i) { return '<span style="transform:rotate(' + (i * 72 + 36) + 'deg) translateY(-62px)">' + l + '</span>'; }).join('') + '</div></div><div class="wres"></div><button class="wok" style="display:none">Got it</button></div>';
  document.body.appendChild(w);
  var disc = w.querySelector('.wdisc'), turn = 360 * 6 - (m.seg * 72 + 36) + (Math.random() * 40 - 20);
  requestAnimationFrame(function () { requestAnimationFrame(function () { disc.style.transform = 'rotate(' + turn + 'deg)'; }); });
  setTimeout(function () { var r = w.querySelector('.wres'); if (m.ban) { r.className = 'wres ban'; r.textContent = 'BAN. You are banned for good.'; }
    else { r.className = 'wres safe'; r.textContent = 'Safe. That was your other chance.'; var ok = w.querySelector('.wok'); ok.style.display = ''; ok.onclick = function () { w.remove(); }; } }, 5200);
}
