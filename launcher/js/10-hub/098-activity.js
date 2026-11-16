
// ===== The Activity tab (2026-11-16): how many people play, which games are most played, who is playing what right now =====
// Everything comes from one server answer (Grapevine 082-stats.js), cached there for 30 s; this page asks again at most
// every 30 s while it is open.
var ACT = { data: null, at: 0, span: 'week', timer: 0 };
function actFmtMin(m) { return m >= 120 ? Math.round(m / 60) + ' h' : m + ' min'; }
function actDay(d) { var t = new Date(d + 'T12:00:00Z'); return t.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
function actRender() {
  var box = document.getElementById('act-home'); if (!box) return;
  var L = window.HGGrapevine;
  if (!L || !L.stats || !L.online()) { setHtml(box, '<div class="act-empty">Sign in to see the activity.</div>'); return; }
  clearInterval(ACT.timer); ACT.timer = setInterval(function () { if (document.getElementById('view-act').hidden) return clearInterval(ACT.timer); actRender(); }, 30000);
  if (ACT.data && Date.now() - ACT.at < 25000) return actPaint();
  L.stats().then(function (d) { ACT.data = d; ACT.at = Date.now(); actPaint(); }, function () { if (!ACT.data) setHtml(box, '<div class="act-empty">Could not load the activity. Try again in a moment.</div>'); });
}
function actPaint() {
  var d = ACT.data, box = document.getElementById('act-home'); if (!d || !box) return;
  var today = d.perDay.filter(function (x) { return x.d === d.today; })[0] || { players: 0, minutes: 0, peak: 0 };
  var tile = function (n, label, sub) { return '<div class="act-tile"><b>' + n + '</b><span>' + label + '</span>' + (sub ? '<em>' + sub + '</em>' : '') + '</div>'; };
  var h = '<div class="act-head"><h2>Activity</h2><div class="rdesc">Live numbers from everyone playing Huntington Games.</div></div>' +
    '<div class="act-tiles">' + tile(d.online, 'online now') + tile(today.players, 'played today') + tile(actFmtMin(today.minutes), 'played today', 'all games together') + tile(today.peak, 'most online at once today') + '</div>';
  // most played: horizontal bars, one hue, values written at the end of each bar
  var games = ACT.span === 'week' ? d.week : d.month, top = games.slice(0, 12), max = Math.max(1, top.reduce(function (m, g) { return Math.max(m, g.minutes); }, 0));
  h += '<div class="act-card"><div class="act-ct"><b>Most played</b><div class="act-seg"><button data-act-span="week" class="' + (ACT.span === 'week' ? 'on' : '') + '">7 days</button><button data-act-span="month" class="' + (ACT.span === 'month' ? 'on' : '') + '">30 days</button></div></div>' +
    (top.length ? '<div class="act-rank">' + top.map(function (g, i) {
      return '<div class="act-row" title="' + profEsc(g.name) + ': ' + actFmtMin(g.minutes) + ' played, ' + g.plays + ' player-days"><span class="act-pos">' + (i + 1) + '</span><span class="act-gn">' + profEsc(g.name) + '</span>' +
        '<span class="act-track"><i style="width:' + Math.max(2, Math.round(100 * g.minutes / max)) + '%"></i></span><span class="act-val">' + actFmtMin(g.minutes) + '</span></div>';
    }).join('') + '</div>' : '<div class="act-empty">Nothing played yet in this time.</div>') + '</div>';
  // players per day: vertical bars, hover for the numbers
  var pd = d.perDay.slice(-30), pmax = Math.max(1, pd.reduce(function (m, x) { return Math.max(m, x.players); }, 0)), W = 640, H = 170, bw = W / Math.max(pd.length, 1);
  var bars = pd.map(function (x, i) { var hh = Math.max(2, Math.round((H - 24) * x.players / pmax)), bx = i * bw + 1, w = Math.max(2, bw - 2);
    return '<g class="act-bar" data-tip="' + profEsc(actDay(x.d) + ': ' + x.players + ' players · ' + actFmtMin(x.minutes) + ' played · ' + x.peak + ' online at once') + '"><rect x="' + bx + '" y="0" width="' + w + '" height="' + H + '" fill="transparent"/>' +
      '<path d="M' + bx + ',' + H + ' V' + (H - hh + 4) + ' q0,-4 4,-4 h' + Math.max(0, w - 8) + ' q4,0 4,4 V' + H + ' Z" class="' + (x.d === d.today ? 'today' : '') + '"/></g>'; }).join('');
  h += '<div class="act-card"><div class="act-ct"><b>Players per day</b><span class="rdesc">since ' + actDay(d.since) + ' · busiest: ' + pmax + '</span></div>' +
    (pd.length ? '<div class="act-chart"><svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Players per day">' + bars + '</svg><div class="act-axis"><span>' + actDay(pd[0].d) + '</span><span>today</span></div><div class="act-tip" hidden></div></div>' : '<div class="act-empty">No days counted yet.</div>') + '</div>';
  // right now
  h += '<div class="act-card"><div class="act-ct"><b>Playing right now</b></div>' + (d.playingNow.length ? '<div class="act-now">' + d.playingNow.map(function (g) {
    return '<span class="act-chip"><i></i>' + profEsc(g.name) + ' <b>' + g.n + '</b></span>'; }).join('') + '</div>' : '<div class="act-empty">Nobody is in a game this minute.</div>') + '</div>';
  setHtml(box, h);
}
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-act-span]'); if (!b) return;
  ACT.span = b.dataset.actSpan; actPaint();
});
document.addEventListener('mousemove', function (e) {
  var g = e.target.closest && e.target.closest('.act-bar'), tip = document.querySelector('#act-home .act-tip'); if (!tip) return;
  if (!g) { tip.hidden = true; return; }
  var c = tip.parentNode.getBoundingClientRect(); tip.hidden = false; tip.textContent = g.dataset.tip;
  tip.style.left = Math.min(c.width - tip.offsetWidth, Math.max(0, e.clientX - c.left - tip.offsetWidth / 2)) + 'px';
});
document.getElementById('tab-act').addEventListener('click', function () { showTab('act'); });
