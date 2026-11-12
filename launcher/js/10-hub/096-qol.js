// ===== Quality of life: find a game fast, keep your favourites, see what changed =====
// On the Games page: a search box ("/" jumps to it), tag chips, a sort order, favourites (the star on a card, kept
// first), a "Surprise me" button, smaller cards, and under each game how long you have played it and when. In the
// player: a star, a Restart button and the game's name on the browser tab. Also: a "What's new" card after an update
// and a note while the device is offline.
// Favourites ('hgq:fav') and the play log ('hgq:play') travel with the account like saves; the page's own choices (sort
// order, small cards) stay on the device ('hgv:gamesui').
var QOL = { q: '', tag: '', sort: 'default', dense: false, fav: [], log: {}, cur: null };
function qolRd(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
function qolWr(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function qolLoad() {
  if (QOL.cur) qolLogSave();      // minutes counted in this visit are written before anything is read back
  var f = qolRd('hgq:fav', []), l = qolRd('hgq:play', {}), ui = qolRd('hgv:gamesui', {});
  QOL.fav = Array.isArray(f) ? f.filter(function (d) { return typeof d === 'string'; }).slice(0, 60) : [];
  QOL.log = l && typeof l === 'object' && !Array.isArray(l) ? l : {};
  QOL.sort = /^(default|recent|most|az)$/.test(ui.sort) ? ui.sort : 'default'; QOL.dense = !!ui.dense;
}
function qolGame(dir) { for (var i = 0; i < GAMES.length; i++) if (GAMES[i].dir === dir) return GAMES[i]; return null; }
function qolIsFav(dir) { return QOL.fav.indexOf(dir) >= 0; }
function qolFav(dir, on) {
  qolLoad();
  var i = QOL.fav.indexOf(dir); if (on === undefined) on = i < 0;
  if (on && i < 0) QOL.fav.unshift(dir); else if (!on && i >= 0) QOL.fav.splice(i, 1);
  qolWr('hgq:fav', QOL.fav); qolBar(); qolDecorate(); qolApply(); qolPlayerBar();
}
function qolDur(sec) { sec = Math.floor(sec || 0); var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60); return h ? h + 'h ' + m + 'm' : m ? m + ' min' : 'under a minute'; }
function qolAgo(ts) {
  var d = Math.floor((Date.now() - ts) / 1000);
  if (d < 90) return 'just now'; if (d < 3600) return Math.floor(d / 60) + ' min ago'; if (d < 86400) return Math.floor(d / 3600) + ' h ago';
  var days = Math.floor(d / 86400); return days === 1 ? 'yesterday' : days < 30 ? days + ' days ago' : new Date(ts).toLocaleDateString();
}
// --- the toolbar ---
function qolBar() {
  var bar = document.getElementById('gbar'); if (!bar) return;
  var count = {}; GAMES.forEach(function (g) { (g.tags || []).forEach(function (t) { count[t] = (count[t] || 0) + 1; }); });
  var tags = Object.keys(count).filter(function (t) { return count[t] >= 2 && t !== 'Minigame'; }).sort(function (a, b) { return (a === 'New' ? -1 : b === 'New' ? 1 : 0) || count[b] - count[a] || a.localeCompare(b); }).slice(0, 7);
  if (QOL.tag && QOL.tag !== '*fav' && tags.indexOf(QOL.tag) < 0) QOL.tag = '';
  if (QOL.tag === '*fav' && !QOL.fav.length) QOL.tag = '';
  var chip = function (v, label) { return '<button class="gchip' + (QOL.tag === v ? ' on' : '') + '" data-gtag="' + v + '">' + label + '</button>'; };
  if (!bar.firstChild) {
    bar.innerHTML = '<div class="gsearch"><input id="gq" type="search" placeholder="Search games   ( / )" autocomplete="off" spellcheck="false" aria-label="Search games"></div><div id="gtags"></div>' +
      '<span class="gsp"></span><select id="gsort" title="Order of the games" aria-label="Sort games"><option value="default">Featured</option><option value="recent">Recently played</option><option value="most">Most played</option><option value="az">A to Z</option></select>' +
      '<button id="gdense" title="Smaller cards, more games on screen">&#9638;</button><button id="grandom" title="Open a random game">&#127922; Surprise me</button>';
    var q = document.getElementById('gq');
    q.oninput = function () { QOL.q = q.value; qolApply(); };
    q.onkeydown = function (e) {
      if (e.key === 'Escape') { q.value = ''; QOL.q = ''; qolApply(); q.blur(); }
      else if (e.key === 'Enter') { var c = document.querySelector('#grid .game:not([hidden]), #grid-mini .game:not([hidden])'); if (c && QOL.q) c.click(); }
    };
    document.getElementById('gsort').onchange = function () { QOL.sort = this.value; qolWr('hgv:gamesui', { sort: QOL.sort, dense: QOL.dense }); qolApply(); };
    document.getElementById('gdense').onclick = function () { QOL.dense = !QOL.dense; qolWr('hgv:gamesui', { sort: QOL.sort, dense: QOL.dense }); qolApply(); };
    document.getElementById('grandom').onclick = function () {
      var c = [].slice.call(document.querySelectorAll('#grid .game:not([hidden]), #grid-mini .game:not([hidden])')); if (!c.length) return;
      c[Math.floor(Math.random() * c.length)].click();
    };
    bar.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-gtag]'); if (!b) return; QOL.tag = QOL.tag === b.dataset.gtag ? '' : b.dataset.gtag; qolBar(); qolApply(); });
  }
  document.getElementById('gsort').value = QOL.sort;
  document.getElementById('gtags').innerHTML = chip('', 'All') + (QOL.fav.length ? chip('*fav', '&#9733; Favourites') : '') + tags.map(function (t) { return chip(t, t); }).join('');
}
// --- stars, play time and "updated" on the cards (run again whenever the cards are drawn) ---
function qolDecorate() {
  [].forEach.call(document.querySelectorAll('#grid .game, #grid-mini .game'), function (b) {
    var dir = b.dataset.dir, g = qolGame(dir); if (!g) return;
    var shot = b.querySelector('.shot'), info = b.querySelector('.info'), fav = qolIsFav(dir), lg = QOL.log[dir];
    var star = b.querySelector('.gfav');
    if (!star && shot) {
      star = document.createElement('span'); star.className = 'gfav'; star.setAttribute('role', 'button');
      star.onclick = function (e) { e.stopPropagation(); e.preventDefault(); qolFav(dir); };
      shot.appendChild(star);
    }
    if (star) { star.textContent = fav ? '★' : '☆'; star.title = fav ? 'Remove from favourites' : 'Add to favourites (kept at the front)'; star.classList.toggle('on', fav); }
    b.classList.toggle('isfav', fav);
    var st = b.querySelector('.gstat');
    if (!st && info) { st = document.createElement('div'); st.className = 'gstat'; info.appendChild(st); }
    if (st) st.textContent = lg && lg.last ? 'Played ' + qolDur(lg.sec) + ' · ' + qolAgo(lg.last) : '';
    // a game whose version changed since you last opened it
    var up = b.querySelector('.gupd'), changed = !!(lg && lg.ver && lg.ver !== g.name);
    if (changed && !up && shot) { up = document.createElement('span'); up.className = 'gupd'; up.textContent = 'Updated'; up.title = 'New version since you last played'; shot.appendChild(up); }
    else if (!changed && up) up.remove();
    // a second way in (Brown E Clicker's Rebalanced beta)
    if (g.alt && !b.querySelector('.galt') && info) {
      var a = document.createElement('span'); a.className = 'galt'; a.setAttribute('role', 'button'); a.textContent = g.alt.label; a.title = g.alt.title || '';
      a.onclick = function (e) { e.stopPropagation(); e.preventDefault(); try { g.alt.go(); } catch (x) {} homeRecent(g); play(g); };
      info.appendChild(a);
    }
  });
}
// --- filter and order ---
function qolApply() {
  var q = QOL.q.trim().toLowerCase(), words = q ? q.split(/\s+/) : [], shown = 0, miniShown = 0;
  var grids = [document.getElementById('grid'), document.getElementById('grid-mini')];
  var idx = {}; GAMES.forEach(function (g, i) { idx[g.dir] = i; });
  var rec = qolRd('hgv:recent', []);
  grids.forEach(function (grid, gi) {
    if (!grid) return;
    var cards = [].slice.call(grid.querySelectorAll('.game'));
    cards.forEach(function (b) {
      var g = qolGame(b.dataset.dir); if (!g) return;
      var hay = (g.name + ' ' + String(g.desc || '').replace(/<[^>]+>/g, ' ') + ' ' + (g.tags || []).join(' ') + ' ' + (g.credit || '')).toLowerCase();
      var ok = words.every(function (w) { return hay.indexOf(w) >= 0; });
      if (ok && QOL.tag) ok = QOL.tag === '*fav' ? qolIsFav(g.dir) : (g.tags || []).indexOf(QOL.tag) >= 0;
      b.hidden = !ok; if (ok) { shown++; if (gi) miniShown++; }
    });
    var key = function (b) {
      var d = b.dataset.dir, lg = QOL.log[d] || {};
      if (QOL.sort === 'az') return [0, (qolGame(d) || {}).name || ''];
      if (QOL.sort === 'recent') return [-(lg.last || 0), idx[d]];
      if (QOL.sort === 'most') return [-(lg.sec || 0), idx[d]];
      return [qolIsFav(d) ? 0 : 1, idx[d]];
    };
    var want = cards.slice().sort(function (a, b) { var x = key(a), y = key(b); return x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : (typeof x[1] === 'string' ? x[1].localeCompare(y[1]) : x[1] - y[1]); });
    var same = want.every(function (c, i) { return c === cards[i]; });
    if (!same) want.forEach(function (c) { grid.appendChild(c); });
  });
  var mh = document.getElementById('mini-h'); if (mh) mh.hidden = !miniShown;
  var none = document.getElementById('gnone'); if (none) none.hidden = shown > 0;
  var jump = document.getElementById('jump'); if (jump) jump.style.display = q || QOL.tag ? 'none' : '';
  document.documentElement.classList.toggle('gdense', QOL.dense);
  var gd = document.getElementById('gdense'); if (gd) gd.classList.toggle('on', QOL.dense);
}
function qolClear() { QOL.q = ''; QOL.tag = ''; var q = document.getElementById('gq'); if (q) q.value = ''; qolBar(); qolApply(); }
// the cards are drawn by render() (010 piece): decorate them every time it runs
(function () {
  var r0 = render;
  render = function () { var r = r0.apply(this, arguments); try { qolLoad(); qolBar(); qolDecorate(); qolApply(); } catch (e) {} return r; };
})();
// "/" jumps to the search box (not while typing somewhere, not while a game is open)
document.addEventListener('keydown', function (e) {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
  var a = document.activeElement, typing = a && (/INPUT|TEXTAREA|SELECT/.test(a.tagName) || a.isContentEditable);
  if (typing || document.documentElement.classList.contains('playing') || document.getElementById('view-games').hidden) return;
  var q = document.getElementById('gq'); if (q && q.offsetParent) { e.preventDefault(); q.focus(); q.select(); }
});
// --- the play log, and the player's own buttons ---
function qolLogSave() { qolWr('hgq:play', QOL.log); }
function qolPlayerBar() {
  var b = document.getElementById('pfav'), g = typeof current !== 'undefined' && current && current.game; if (!b) return;
  var known = !!(g && qolGame(g.dir)); b.hidden = !known;
  if (known) { var f = qolIsFav(g.dir); b.textContent = f ? '★' : '☆'; b.classList.toggle('on', f); b.title = f ? 'Remove from favourites' : 'Add to favourites'; }
}
(function () {
  var pn = playNow, cp = closePlayer, title0 = document.title;
  playNow = function (g) {
    var r = pn.apply(this, arguments);
    try {
      qolLoad();
      if (qolGame(g.dir)) {
        var same = QOL.cur && QOL.cur.dir === g.dir;                       // a Restart is not another visit
        var lg = QOL.log[g.dir] = QOL.log[g.dir] || { sec: 0, n: 0 };
        if (!same) lg.n = (lg.n || 0) + 1;
        lg.last = Date.now(); lg.ver = g.name; QOL.cur = { dir: g.dir }; qolLogSave();
      } else QOL.cur = null;
      document.title = g.name + ' · Huntington Games';
      qolPlayerBar();
    } catch (e) {}
    return r;
  };
  closePlayer = function () {
    try { QOL.cur = null; document.title = title0; qolLogSave(); qolDecorate(); qolApply(); } catch (e) {}
    return cp.apply(this, arguments);
  };
  // time counts while the game is open, the page is showing and you touched the game in the last minute
  setInterval(function () {
    if (!QOL.cur || document.hidden || !document.documentElement.classList.contains('playing')) return;
    try { if (typeof feedWatch === 'function') feedWatch(); } catch (e) {}
    if (typeof FEED !== 'undefined' && Date.now() - FEED.lastInput > 60000) return;
    var lg = QOL.log[QOL.cur.dir]; if (!lg) return;
    lg.sec = (lg.sec || 0) + 15; lg.last = Date.now();
    if (Math.floor(lg.sec / 15) % 4 === 0) qolLogSave();
  }, 15000);
  addEventListener('pagehide', function () { if (QOL.cur) qolLogSave(); });
  var pf = document.getElementById('pfav'), rs = document.getElementById('prestart');
  if (pf) pf.onclick = function () { if (current && current.game) qolFav(current.game.dir); };
  if (rs) rs.onclick = function () {
    if (!current || !current.game) return;
    if (!confirm('Restart ' + current.game.name + '?\n\nAnything the game has not saved yet is lost.')) return;
    playNow(current.game);
  };
})();
// --- what's new: once after an update, on the Games page ---
var WHATSNEW = { id: 'r65', items: [
  ['Leaderboards fixed', 'Brown E Clicker ranks by every E you ever made, Tetris by your real best score, and boards refresh by themselves.'],
  ['Find games faster', 'Search (press /), filter by tag, sort, and star your favourites to keep them first.'],
  ['Faster, sturdier loading', 'Games you hover or played last are fetched ahead, slow servers are skipped, and a failed load has a Try again button.'],
  ['Brown E Clicker: Rebalanced beta', 'A smoother version of the game with its own save and leaderboard. Classic is untouched.'],
  ['Last Light 1.4', 'The final boss no longer hurts you when you stomp it, and it has six new attacks.']
] };
function qolNews(force) {
  var box = document.getElementById('whatsnew'); if (!box) return;
  var seen = null, first = false;
  try { seen = localStorage.getItem('hgv:seennew'); first = !localStorage.getItem('hgv:booted'); } catch (e) {}
  if (!force && (seen === WHATSNEW.id || first)) { if (first) { try { localStorage.setItem('hgv:seennew', WHATSNEW.id); } catch (e) {} } box.hidden = true; return; }
  box.innerHTML = '<div class="wn-h"><b>&#10024; What\'s new</b><button id="wn-x" title="Hide this">Got it</button></div><ul>' + WHATSNEW.items.map(function (i) { return '<li><b>' + i[0] + '</b> ' + i[1] + '</li>'; }).join('') + '</ul>';
  box.hidden = false;
  document.getElementById('wn-x').onclick = function () { try { localStorage.setItem('hgv:seennew', WHATSNEW.id); } catch (e) {} box.hidden = true; };
}
window.HG_whatsNew = function () { showTab('games'); qolNews(true); try { document.getElementById('whatsnew').scrollIntoView({ block: 'nearest' }); } catch (e) {} };
// --- offline / back online ---
(function () {
  var bar = document.getElementById('netbar'), t = 0; if (!bar) return;
  function paint(back) {
    clearTimeout(t);
    if (navigator.onLine === false) { bar.textContent = 'You are offline. Games saved on this device still open; scores, saves and chat catch up when you are back.'; bar.className = 'off'; bar.hidden = false; }
    else if (back) { bar.textContent = 'Back online.'; bar.className = 'on'; bar.hidden = false; t = setTimeout(function () { bar.hidden = true; }, 2500); }
    else bar.hidden = true;
  }
  addEventListener('offline', function () { paint(false); }); addEventListener('online', function () { paint(true); });
  paint(false);
})();
qolLoad(); qolNews(false);
try { qolBar(); qolDecorate(); qolApply(); } catch (e) {}      // the cards drawn before this piece loaded
var gn = document.getElementById('gnone'); if (gn) gn.onclick = function (e) { if (e.target.tagName === 'BUTTON') qolClear(); };
// saves pulled from the account can bring favourites and play times from another device
(function wait() {
  var L = window.HGGrapevine; if (!L || !L.on) return setTimeout(wait, 3000);
  L.on('sync', function (m) { if (m && m.state === 'ok' && !QOL.cur) { try { qolLoad(); qolBar(); qolDecorate(); qolApply(); } catch (e) {} } });
})();
