
// ===== What the server is told, so goons and leaderboards follow your play =====
// - playtime: once a minute while a game is open AND you touched it (key, click, tap) in that minute
// - claims: unlocked achievements (gv/ach.js keeps them in 'hgach:v1'), Blocky waves cleared and ranks gained
// - leaderboards: each game's best numbers, read from its own save (games do not have to report anything)
// The server checks and caps every claim; this only says what happened.
var FEED = { lastInput: 0, sent: {} };
try { FEED.sent = JSON.parse(localStorage.getItem('hgv:lbsent') || '{}'); } catch (e) {}
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
// Blocky Shooter: total XP over every prestige (rank r needs 600 + 200r XP; 50 ranks)
function blockyXP(l) { var per = 0; for (var r = 1; r < 50; r++) per += 600 + 200 * r; return feedNum(l.prestige) * per + feedNum(l.xp); }
function blockyRanks(l) { var x = feedNum(l.xp), r = 1; while (r < 50 && x >= 600 + 200 * r) { x -= 600 + 200 * r; r++; } return feedNum(l.prestige) * 49 + (r - 1); }
// board -> [value, details] from the saves (0 / nothing = not on the board yet)
var LB_FEED = [
  ['spikes:level', function () { var s = feedRd('spikes100_progress') || {}; return [feedNum(s.unlocked)]; }],
  ['spikes:onelife', function () { var s = feedRd('spikes100_progress') || {}; return [feedNum(s.bestOneLife)]; }],
  ['spikes:endless', function () { var s = feedRd('spikes100_progress') || {}; return [feedNum(s.bestEndless)]; }],
  ['tetris:score', function () { var t = feedRd('huntingtonTetrisSurge1') || {}, st = t.stats || {}; return [Math.max(feedNum(feedRd('tetrisHighScore')), feedNum(st.best), feedNum(st.highScore), feedNum(t.best)), { lines: feedNum(st.lines) }]; }],
  ['tetris:lines', function () { var st = (feedRd('huntingtonTetrisSurge1') || {}).stats || {}; return [feedNum(st.lines), { tetrises: feedNum(st.tetrises) }]; }],
  ['clicker:total', function () { var b = feedRd('brownEClickerSave') || {}, s = b.state || {}; return [Math.max(feedNum(s.totalBrownEs), feedNum(s.allTime), feedNum(s.brownEs)), { ascensions: feedNum((b.meta || {}).ascensions) }]; }],
  ['coffee:best', function () { var s = (feedRd('beanBrewSaveV2') || {}).stats || {}; return [feedNum(s.earned), { served: feedNum(s.served) }]; }],
  ['market:worth', function () { return [Math.max(feedNum(feedRd('netWorthPB')), feedNum(feedRd('lifeScorePB')))]; }],
  ['td:endless', function () { var t = feedRd('td2_records') || {}; return [feedNum(t.bestEndless), { kills: feedNum(t.kills) }]; }],
  ['frontline:wins', function () { var f = feedRd('frontline_profile_v2') || {}; return [feedNum(f.wins), { kills: feedNum(f.kills), online: feedNum(f.mpWins) }]; }],
  ['sov:best', function () { var s = feedRd('sov.hgach') || {}; return [feedNum(s.conquered), { wars: feedNum(s.warsWon), years: feedNum(s.years) }]; }],
  ['neon:best', function () { var a = feedRd('neonScores') || [], b = 0; (Array.isArray(a) ? a : []).forEach(function (x) { b = Math.max(b, feedNum(x && x.val)); }); return [b]; }],
  ['blocky:xp', function () { var l = feedRd('blocky21_life') || {}; return [blockyXP(l), { prestige: feedNum(l.prestige), kills: feedNum(l.kills) }]; }],
  ['blocky:wave', function () { var l = feedRd('blocky21_life') || {}, b = 0, k = ''; for (var x in (l.best || {})) if (feedNum(l.best[x]) > b) { b = feedNum(l.best[x]); k = x; } return [b, k ? { mode: k } : null]; }],
  ['blocky:kills', function () { var l = feedRd('blocky21_life') || {}; return [feedNum(l.kills), { headshots: feedNum(l.headshots) }]; }],
  ['imposter:wins', function () { var s = feedRd('imposter_save') || {}, st = s.stats || s; return [feedNum(st.wins) || (feedNum(st.crewWins) + feedNum(st.impWins))]; }],
  // Last Light: every level's best time, and the full game = all of them added up (only once all 17 are done)
  ['lumi:*', function () {
    var lv = (feedRd('lumi_save') || {}).levels || {}, out = [], ids = [], sum = 0;
    for (var w = 1; w <= 4; w++) for (var n = 1; n <= 4; n++) ids.push(w + '-' + n); ids.push('5-1');
    ids.forEach(function (id) { var b = lv[id] && feedNum(lv[id].best); if (b > 0) { out.push(['lumi:lv' + id, b]); sum += b; } });
    if (out.length === ids.length) out.push(['lumi:full', +sum.toFixed(2), { levels: 17 }]);
    var lr = feedRd('lumi_save') || {};
    if (lr.runs && feedNum(lr.runs.full) > 0) out.push(['lumi:run', feedNum(lr.runs.full)]);
    if (lr.runs && feedNum(lr.runs.onelife) > 0) out.push(['lumi:onelife', feedNum(lr.runs.onelife)]);
    return out;
  }]
];
function feedNow() {
  var L = window.HGGrapevine; if (!L || !L.me() || !L.online() || !L.eco) return;
  var send = function (board, v, d) {
    if (!(v > 0)) return; if (FEED.sent[board] === v) return;
    FEED.sent[board] = v; L.eco.lbSubmit(board, v, d || null);
  };
  LB_FEED.forEach(function (x) {
    try { var r = x[1](); if (x[0] === 'lumi:*') r.forEach(function (y) { send(y[0], y[1], y[2]); }); else send(x[0], r[0], r[1]); } catch (e) {}
  });
  try { localStorage.setItem('hgv:lbsent', JSON.stringify(FEED.sent)); } catch (e) {}
  // goon claims
  var got = feedRd('hgach:v1') || {}, claimed = feedRd('hgv:claimed') || {}, n = 0;
  for (var id in got) if (!claimed[id] && n < 40) { L.eco.claim('ach', id); claimed[id] = 1; n++; }
  try { localStorage.setItem('hgv:claimed', JSON.stringify(claimed)); } catch (e) {}
  var bl = feedRd('blocky21_life');
  if (bl) { if (feedNum(bl.waves) > 0) L.eco.claim('waves', null, feedNum(bl.waves)); var rk = blockyRanks(bl); if (rk > 0) L.eco.claim('rank', null, rk); }
}
setInterval(feedNow, 120000);
function feedMount() {
  var L = window.HGGrapevine; if (!L || feedMount.done) return; feedMount.done = true;
  L.on('eco', function () { if (!FEED.first) { FEED.first = 1; setTimeout(feedNow, 1500); } });
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
